import { describe, expect, it } from 'vitest';
import { buildDashboard, dashboardCapabilities, dashboardRegions, resolveDashboardFilters, type DashboardFilters } from '../shared/dashboard';
import { DEMO_CLINICAL_POLICY } from '../shared/clinical-policy';
import { defaultScenario } from '../shared/planner';
import { loadDataset } from '../server/data';
import { smallDataset } from './fixtures';

const base: DashboardFilters = { role: 'leadership', horizonDays: 30, q: '', budgetCents: 2_500_000, regionId: null, districtId: null, facilityId: null, productId: null };
const ctx = (dataset: ReturnType<typeof smallDataset>, filters: DashboardFilters) => ({
  dataset, hash: 'test', filters, plans: [], supportRequests: [], notes: [], audit: [],
  policy: DEMO_CLINICAL_POLICY, dataAuthorized: false, scenario: null,
});

describe('dashboard shared engine', () => {
  it('locks facility and district demo roles to a scoped view', () => {
    const dataset = smallDataset();
    const facility = resolveDashboardFilters(dataset, { ...base, role: 'facility' });
    expect(facility.facilityId).toBe('donor'); expect(facility.districtId).toBe('d1');
    const district = resolveDashboardFilters(dataset, { ...base, role: 'district', facilityId: 'recipient' });
    expect(district.districtId).toBe('d1'); expect(district.facilityId).toBe('recipient');
    expect(dashboardCapabilities('facility').canRecordFacilityAction).toBe(true);
    expect(dashboardCapabilities('leadership').canRecordFacilityAction).toBe(false);
  });
  it('keeps Unknown distinct from on-track and filters by commodity/search', () => {
    const dataset = smallDataset();
    dataset.stocks[1].history = Array(7).fill(10);
    const data = buildDashboard(ctx(dataset, { ...base, q: 'Recipient', productId: 'p1' }));
    expect(data.summary.recordCount).toBe(1); expect(data.summary.unknownCount).toBe(1); expect(data.summary.criticalCount).toBe(0);
    expect(data.map.districts[0].risk).toBe('unknown');
  });
  it('falls back to district regions when no region level exists', () => {
    expect(dashboardRegions(smallDataset()).map((r) => r.id)).toEqual(['d1']);
  });
  it('builds a synthetic national dashboard with map coordinates and forecast horizons', async () => {
    const { dataset, hash } = loadDataset();
    const { runScenario } = await import('../shared/planner');
    const scenario = await runScenario(dataset, defaultScenario(), hash);
    const data = buildDashboard({ ...ctx(dataset, base), scenario });
    expect(data.summary.criticalCount).toBeGreaterThan(0);
    expect(data.forecast.map((f) => f.horizonDays)).toEqual([30, 60, 90]);
    expect(data.interventions.length).toBeLessThanOrEqual(5);
    expect(data.map.schematic).toBe(true);
    expect(data.interventions.every((i) => i.why.length > 10)).toBe(true);
    expect(data.summary.plannedCostCents).toBeLessThanOrEqual(data.summary.budgetCeilingCents);
  });
});
