import { assessDataset, DEFAULT_SCENARIO, diffDays, outcomeMetrics } from './domain';
import { COUNTRY_PROFILES } from './countries';
import { runScenario } from './planner';
import { dashboardCapabilities, type DashboardCapabilities, type DashboardRole } from './dashboard-meta';
import type { ClinicalPolicy } from './clinical-policy';
import type { Assessment, DashboardAuditEvent, DashboardNote, DashboardSupportRequest, Dataset, PlanAction, RiskLevel, ScenarioResult, StoredPlan } from './types';

export { DASHBOARD_ROLES, dashboardCapabilities } from './dashboard-meta';
export type { DashboardRole } from './dashboard-meta';
export type DashboardHorizon = 30 | 60 | 90;
export interface DashboardFilters {
  role: DashboardRole;
  countryCode?: string;
  regionId?: string | null;
  districtId?: string | null;
  facilityId?: string | null;
  productId?: string | null;
  horizonDays: DashboardHorizon;
  q: string;
  budgetCents: number;
}
export interface DashboardRegion { id: string; name: string; districtIds: string[] }
export interface DashboardSummary {
  role: DashboardRole; scopeLabel: string; country: string; countryCode: string; asOf: string;
  facilityCount: number; recordCount: number; knownCount: number; unknownCount: number;
  criticalCount: number; watchCount: number; stableCount: number;
  availabilityPct: number; onTrackPct: number;
  budgetCeilingCents: number; plannedCostCents: number; releasedCostCents: number; budgetUtilizationPct: number;
  expiringSoonUnits: number; stockoutDays: number; unmetUnits: number;
}
export interface DashboardMapFacility {
  id: string; name: string; districtId: string; type: string; risk: RiskLevel;
  x?: number; y?: number; critical: number; watch: number; unknown: number; records: number;
}
export interface DashboardMapDistrict {
  id: string; name: string; regionId: string; risk: RiskLevel;
  critical: number; watch: number; unknown: number; records: number;
  facilities: DashboardMapFacility[]; polygon?: { x: number; y: number }[];
}
export interface DashboardIntervention {
  id: string; kind: PlanAction['kind']; facilityId: string; facilityName: string;
  productId: string; productName: string; unit: string; quantity: number; costCents: number;
  arrivalDays: number; priorityScore: number; why: string; rationale: string; donorFacilityName?: string;
}
export interface DashboardBottleneck {
  id: string; severity: 'red' | 'amber' | 'green'; category: string; title: string; detail: string; count: number; href: string;
}
export interface DashboardForecast { horizonDays: DashboardHorizon; critical: number; watch: number; unknown: number; stockoutDays: number; unmetUnits: number }
export interface DashboardPipelineStage { id: string; label: string; itemCount: number; valueCents: number }
export interface DashboardPipeline {
  source: 'saved_demo_plans'; stages: DashboardPipelineStage[]; totalValueCents: number;
  pending: { planId: string; itemId: string; facilityName: string; productName: string; status: string; ageDays: number; valueCents: number }[];
}
export interface DashboardAlert { id: string; severity: 'red' | 'amber' | 'green'; title: string; detail: string; href: string }

export function resolveDashboardFilters(dataset: Dataset, input: DashboardFilters): DashboardFilters {
  const filters = { ...input };
  const cap = dashboardCapabilities(filters.role);
  if (cap.scopeLock === 'facility') {
    filters.facilityId = filters.facilityId ?? dataset.facilities[0]?.id ?? null;
    const facility = dataset.facilities.find((f) => f.id === filters.facilityId);
    filters.districtId = facility?.districtId ?? null;
    filters.regionId = facility ? districtRegionId(dataset, facility.districtId) : null;
  } else if (cap.scopeLock === 'district') {
    filters.districtId = filters.districtId ?? dataset.districts[0]?.id ?? null;
    filters.regionId = filters.districtId ? districtRegionId(dataset, filters.districtId) : null;
    if (filters.facilityId && !dataset.facilities.some((f) => f.id === filters.facilityId && f.districtId === filters.districtId)) filters.facilityId = null;
  } else {
    if (filters.districtId) filters.regionId = districtRegionId(dataset, filters.districtId);
    if (filters.facilityId) {
      const facility = dataset.facilities.find((f) => f.id === filters.facilityId);
      filters.districtId = facility?.districtId ?? null;
      filters.regionId = facility ? districtRegionId(dataset, facility.districtId) : null;
    }
  }
  return filters;
}
export interface DashboardPartnerMetrics {
  savedPlans: number; approvedPlans: number; auditEvents: number; supportRequests: number; notes: number;
  goals: { label: string; status: 'demo_only' | 'not_connected' | 'measured_locally'; detail: string }[];
  countries: { code: string; name: string; connectionState: string; critical?: number; availabilityPct?: number }[];
}
export interface DashboardData {
  filters: DashboardFilters;
  regions: DashboardRegion[];
  summary: DashboardSummary;
  map: { schematic: boolean; districts: DashboardMapDistrict[] };
  interventions: DashboardIntervention[];
  interventionNote: string;
  gateReason: string | null;
  bottlenecks: DashboardBottleneck[];
  forecast: DashboardForecast[];
  pipeline: DashboardPipeline;
  alerts: DashboardAlert[];
  riskRows: Assessment[];
  facilityStock: Assessment[];
  upcomingDeliveries: { id: string; facilityId: string; facilityName: string; productId: string; productName: string; quantity: number; unit: string; expectedDate: string; status: string }[];
  recentReceipts: { id: string; facilityName: string; productName: string; quantity: number; unit: string; date: string }[];
  supportRequests: DashboardSupportRequest[];
  notes: DashboardNote[];
  audit: DashboardAuditEvent[];
  capabilities: DashboardCapabilities;
  partner: DashboardPartnerMetrics | null;
  optimization: ScenarioResult['optimization'] | null;
  clinicalPolicy: ScenarioResult['clinicalPolicy'] | null;
}

const riskRank: Record<RiskLevel, number> = { critical: 3, watch: 2, unknown: 1, stable: 0 };
export const worstRisk = (risks: RiskLevel[]): RiskLevel => risks.reduce<RiskLevel>((worst, risk) => riskRank[risk] > riskRank[worst] ? risk : worst, 'stable');
export const dashboardRegions = (dataset: Dataset): DashboardRegion[] => {
  const regions = dataset.regions?.length ? dataset.regions : dataset.districts.map((d) => ({ id: d.id, name: d.name }));
  return regions.map((r) => ({ ...r, districtIds: dataset.districts.filter((d) => (d.regionId ?? d.id) === r.id).map((d) => d.id) }));
};
export const districtRegionId = (dataset: Dataset, districtId: string) => dataset.districts.find((d) => d.id === districtId)?.regionId ?? districtId;

function convexHull(points: { x: number; y: number }[]): { x: number; y: number }[] {
  if (points.length < 3) return points;
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: { x: number; y: number }[] = [];
  for (const p of sorted) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  const upper: { x: number; y: number }[] = [];
  for (const p of sorted.reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
const padHull = (hull: { x: number; y: number }[], pad = 4) => hull.map((p) => ({ x: Math.min(98, Math.max(2, p.x + (p.x < 50 ? -pad : pad))), y: Math.min(98, Math.max(2, p.y + (p.y < 50 ? -pad : pad))) }));

export interface DashboardContext {
  dataset: Dataset; hash: string; filters: DashboardFilters;
  plans: StoredPlan[]; supportRequests: DashboardSupportRequest[]; notes: DashboardNote[]; audit: DashboardAuditEvent[];
  policy: ClinicalPolicy; dataAuthorized: boolean;
  scenario: ScenarioResult | null;
  gateReason?: string | null;
}

export function buildDashboard(ctx: DashboardContext): DashboardData {
  const { dataset, plans, supportRequests, notes, audit, scenario } = ctx;
  const filters = resolveDashboardFilters(dataset, ctx.filters);
  const facilities = new Map(dataset.facilities.map((f) => [f.id, f]));
  const products = new Map(dataset.products.map((p) => [p.id, p]));
  const districts = new Map(dataset.districts.map((d) => [d.id, d]));
  const regions = dashboardRegions(dataset);
  const regionDistrictIds = filters.regionId ? new Set(regions.find((r) => r.id === filters.regionId)?.districtIds ?? []) : null;
  const scopedFacilityIds = new Set(dataset.facilities.filter((f) =>
    (!filters.districtId || f.districtId === filters.districtId)
    && (!regionDistrictIds || regionDistrictIds.has(f.districtId))
    && (!filters.facilityId || f.id === filters.facilityId)).map((f) => f.id));
  const q = filters.q.toLowerCase();
  const matches = (a: Assessment) => (!filters.productId || a.productId === filters.productId)
    && (!q || `${a.facilityName} ${a.productName} ${a.districtName}`.toLowerCase().includes(q));
  const all = assessDataset(dataset, filters.horizonDays, DEFAULT_SCENARIO.bufferDays, null);
  const rows = all.filter((a) => scopedFacilityIds.has(a.facilityId) && matches(a));
  const known = rows.filter((a) => a.risk !== 'unknown');
  const criticalCount = rows.filter((a) => a.risk === 'critical').length;
  const watchCount = rows.filter((a) => a.risk === 'watch').length;
  const stableCount = rows.filter((a) => a.risk === 'stable').length;
  const unknownCount = rows.filter((a) => a.risk === 'unknown').length;
  const availabilityPct = known.length ? Math.round(100 * known.filter((a) => a.usableUnits > 0).length / known.length) : 0;
  const scopeLabel = filters.facilityId ? facilities.get(filters.facilityId)?.name ?? 'Facility'
    : filters.districtId ? districts.get(filters.districtId)?.name ?? 'District'
    : filters.regionId ? regions.find((r) => r.id === filters.regionId)?.name ?? 'Region'
    : dataset.country;

  const mapDistricts = dataset.districts.filter((d) => scopedFacilityIds.size === 0 || dataset.facilities.some((f) => f.districtId === d.id && scopedFacilityIds.has(f.id))).map((d) => {
    const districtRows = rows.filter((a) => a.districtId === d.id);
    const mapFacilities = dataset.facilities.filter((f) => f.districtId === d.id && scopedFacilityIds.has(f.id)).map((f) => {
      const fr = districtRows.filter((a) => a.facilityId === f.id);
      return { id: f.id, name: f.name, districtId: d.id, type: f.type, risk: worstRisk(fr.map((a) => a.risk)), x: f.mapPosition?.x, y: f.mapPosition?.y,
        critical: fr.filter((a) => a.risk === 'critical').length, watch: fr.filter((a) => a.risk === 'watch').length, unknown: fr.filter((a) => a.risk === 'unknown').length, records: fr.length };
    });
    const points = mapFacilities.filter((f) => f.x !== undefined && f.y !== undefined).map((f) => ({ x: f.x!, y: f.y! }));
    return { id: d.id, name: d.name, regionId: districtRegionId(dataset, d.id), risk: worstRisk(districtRows.map((a) => a.risk)),
      critical: districtRows.filter((a) => a.risk === 'critical').length, watch: districtRows.filter((a) => a.risk === 'watch').length,
      unknown: districtRows.filter((a) => a.risk === 'unknown').length, records: districtRows.length,
      facilities: mapFacilities, polygon: points.length >= 3 ? padHull(convexHull(points)) : undefined };
  });

  const scopedActions = (scenario?.selected ?? []).filter((a) => scopedFacilityIds.has(a.facilityId) && (!filters.productId || a.productId === filters.productId));
  const limit = filters.role === 'leadership' ? 5 : filters.role === 'facility' ? 5 : 10;
  const interventions = [...scopedActions].sort((a, b) => b.priorityScore - a.priorityScore || a.id.localeCompare(b.id)).slice(0, limit).map((a) => {
    const product = products.get(a.productId)!; const facility = facilities.get(a.facilityId)!;
    return { id: a.id, kind: a.kind, facilityId: a.facilityId, facilityName: facility.name, productId: a.productId, productName: product.name, unit: product.unit,
      quantity: a.quantity, costCents: a.costCents, arrivalDays: a.arrivalDays, priorityScore: a.priorityScore,
      why: a.kind === 'transfer' ? 'Donor surplus can reach this facility within shelf-life, cold-chain, and route limits.' : 'Replenishment covers the modeled post-lead-time gap within the budget ceiling.',
      rationale: a.rationale, donorFacilityName: a.donorFacilityId ? facilities.get(a.donorFacilityId)?.name : undefined };
  });
  const plannedCostCents = scopedActions.reduce((sum, a) => sum + a.costCents, 0);

  const scopedPlanItems = plans.flatMap((plan) => plan.items.map((item) => ({ plan, item }))).filter(({ item }) => scopedFacilityIds.has(item.facilityId) && (!filters.productId || item.productId === filters.productId));
  const releasedCostCents = scopedPlanItems.filter(({ item }) => item.status === 'funds_released' || item.status === 'received').reduce((sum, { item }) => sum + item.costCents, 0);
  const stages = [
    { id: 'approved', label: 'Approved', itemCount: scopedPlanItems.filter(({ item }) => item.status === 'approved').length, valueCents: scopedPlanItems.filter(({ item }) => item.status === 'approved').reduce((s, { item }) => s + item.costCents, 0) },
    { id: 'procurement_requested', label: 'Procurement', itemCount: scopedPlanItems.filter(({ item }) => item.status === 'procurement_requested').length, valueCents: scopedPlanItems.filter(({ item }) => item.status === 'procurement_requested').reduce((s, { item }) => s + item.costCents, 0) },
    { id: 'funds_released', label: 'Funds released', itemCount: scopedPlanItems.filter(({ item }) => item.status === 'funds_released').length, valueCents: scopedPlanItems.filter(({ item }) => item.status === 'funds_released').reduce((s, { item }) => s + item.costCents, 0) },
    { id: 'received', label: 'Facility receipt', itemCount: scopedPlanItems.filter(({ item }) => item.status === 'received').length, valueCents: scopedPlanItems.filter(({ item }) => item.status === 'received').reduce((s, { item }) => s + item.costCents, 0) },
  ];
  const now = new Date().toISOString().slice(0, 10);
  const pending = scopedPlanItems.filter(({ item }) => item.status === 'approved' || item.status === 'procurement_requested').map(({ plan, item }) => ({
    planId: plan.id, itemId: item.id, facilityName: facilities.get(item.facilityId)?.name ?? item.facilityId,
    productName: products.get(item.productId)?.name ?? item.productId, status: item.status,
    ageDays: Math.max(0, diffDays(now, plan.updatedAt.slice(0, 10))), valueCents: item.costCents,
  })).sort((a, b) => b.ageDays - a.ageDays).slice(0, 10);

  const bottlenecks: DashboardBottleneck[] = [];
  const stale = rows.filter((a) => a.qualityIssues.includes('STALE_REPORT'));
  if (stale.length) bottlenecks.push({ id: 'stale', severity: 'amber', category: 'Data', title: `${stale.length} stale stock reports`, detail: 'Refresh reports before treating risk labels as current.', count: stale.length, href: '/data' });
  if (unknownCount) bottlenecks.push({ id: 'unknown', severity: 'amber', category: 'Data', title: `${unknownCount} Unknown records`, detail: 'Missing or stale data is excluded from automatic allocation.', count: unknownCount, href: '/risks?risk=unknown' });
  const longLead = rows.filter((a) => a.leadTimeDays > filters.horizonDays);
  if (longLead.length) bottlenecks.push({ id: 'lead', severity: 'red', category: 'Procurement', title: `Procurement lag in ${longLead.length} records`, detail: `Lead times exceed the ${filters.horizonDays}-day horizon; consider redistribution or escalation.`, count: longLead.length, href: '/planner' });
  const expiring = rows.reduce((sum, a) => sum + a.expiringSoonUnits, 0);
  if (expiring) bottlenecks.push({ id: 'expiry', severity: 'amber', category: 'Expiry', title: `${expiring.toLocaleString('en-US')} units nearing expiry`, detail: 'Review FEFO and redistribution options before batches expire.', count: expiring, href: '/risks' });
  const delayedCash = pending.filter((p) => p.ageDays >= 7);
  if (delayedCash.length) bottlenecks.push({ id: 'cash', severity: 'red', category: 'Financing', title: `Cash release pending in ${delayedCash.length} demo items`, detail: 'Saved plan items have waited at least 7 days for the next simulated step.', count: delayedCash.length, href: '/funding' });
  const coldChainGaps = rows.filter((a) => products.get(a.productId)?.coldChain && !dataset.routes.some((r) => r.toFacilityId === a.facilityId && r.coldChainCapable));
  if (coldChainGaps.length) bottlenecks.push({ id: 'cold', severity: 'red', category: 'Cold chain', title: `${coldChainGaps.length} cold-chain records lack capable inbound routes`, detail: 'Redistribution is blocked until a cold-chain-capable route is confirmed.', count: coldChainGaps.length, href: '/planner' });
  if (!bottlenecks.length) bottlenecks.push({ id: 'none', severity: 'green', category: 'Pipeline', title: 'No modeled bottleneck detected', detail: 'Continue monitoring data freshness and pending approvals.', count: 0, href: '/data' });

  const forecast = ([30, 60, 90] as DashboardHorizon[]).map((horizonDays) => {
    const fa = assessDataset(dataset, horizonDays, DEFAULT_SCENARIO.bufferDays, null).filter((a) => scopedFacilityIds.has(a.facilityId) && matches(a));
    const metrics = outcomeMetrics(fa);
    return { horizonDays, critical: fa.filter((a) => a.risk === 'critical').length, watch: fa.filter((a) => a.risk === 'watch').length, unknown: fa.filter((a) => a.risk === 'unknown').length, stockoutDays: metrics.stockoutDays, unmetUnits: metrics.unmetUnits };
  });

  const alerts: DashboardAlert[] = [];
  for (const action of scopedActions.filter((a) => a.kind === 'transfer').slice(0, 5)) alerts.push({ id: `redist-${action.id}`, severity: 'green', title: `Redistribute ${action.quantity.toLocaleString('en-US')} ${products.get(action.productId)?.unit ?? 'units'}`, detail: `${products.get(action.productId)?.name ?? action.productId} from ${facilities.get(action.donorFacilityId ?? '')?.name ?? 'donor'} to ${facilities.get(action.facilityId)?.name ?? 'facility'}.`, href: '/planner' });
  for (const row of rows.filter((a) => a.risk === 'critical').slice(0, 5)) alerts.push({ id: `critical-${row.facilityId}-${row.productId}`, severity: 'red', title: `${row.facilityName}: ${row.productName} critical`, detail: `${row.daysCover ?? 0} days of cover; ${row.needUnits.toLocaleString('en-US')} ${row.unit} modeled gap.`, href: `/risks?q=${encodeURIComponent(row.facilityName)}` });
  for (const row of rows.filter((a) => a.expiringSoonUnits > 0).slice(0, 5)) alerts.push({ id: `expiry-${row.facilityId}-${row.productId}`, severity: 'amber', title: `${row.expiringSoonUnits.toLocaleString('en-US')} ${row.unit} expiring soon`, detail: `${row.productName} at ${row.facilityName}.`, href: '/risks' });

  const facilityStock = filters.facilityId ? rows.filter((a) => a.facilityId === filters.facilityId).sort((a, b) => riskRank[b.risk] - riskRank[a.risk] || a.productId.localeCompare(b.productId)) : [];
  const upcomingDeliveries = dataset.stocks.filter((s) => scopedFacilityIds.has(s.facilityId) && (!filters.productId || s.productId === filters.productId)).flatMap((s) => s.inbound.map((i) => ({
    id: i.id, facilityId: s.facilityId, facilityName: facilities.get(s.facilityId)?.name ?? s.facilityId, productId: s.productId, productName: products.get(s.productId)?.name ?? s.productId,
    quantity: i.quantity, unit: products.get(s.productId)?.unit ?? 'units', expectedDate: i.expectedDate, status: i.status,
  }))).sort((a, b) => a.expectedDate.localeCompare(b.expectedDate)).slice(0, 20);
  const recentReceipts = scopedPlanItems.filter(({ item }) => item.status === 'received').map(({ plan, item }) => ({ id: `${plan.id}:${item.id}`, facilityName: facilities.get(item.facilityId)?.name ?? item.facilityId, productName: products.get(item.productId)?.name ?? item.productId, quantity: item.quantity, unit: products.get(item.productId)?.unit ?? 'units', date: plan.updatedAt })).slice(0, 10);

  const partner: DashboardPartnerMetrics | null = filters.role === 'partner' ? {
    savedPlans: plans.length, approvedPlans: plans.filter((p) => p.status === 'approved').length,
    auditEvents: plans.reduce((sum, p) => sum + p.audit.length, 0), supportRequests: supportRequests.length, notes: notes.length,
    goals: [
      { label: 'Stockout reduction', status: 'demo_only', detail: 'Modeled before/after estimates only; no real outcome measurement.' },
      { label: 'Decision quality', status: 'measured_locally', detail: `${plans.filter((p) => p.status === 'approved').length} locally approved demo plans with audit trails.` },
      { label: 'Adoption', status: 'measured_locally', detail: `${plans.length} saved plans and ${supportRequests.length} facility requests in this local workspace.` },
    ],
    countries: COUNTRY_PROFILES.map((profile) => ({ code: profile.code, name: profile.name,
      connectionState: profile.code === (dataset.countryCode ?? 'DEMO') ? 'active_dataset' : 'not_connected',
      critical: profile.code === (dataset.countryCode ?? 'DEMO') ? criticalCount : undefined,
      availabilityPct: profile.code === (dataset.countryCode ?? 'DEMO') ? availabilityPct : undefined })),
  } : null;

  return {
    filters, regions,
    summary: { role: filters.role, scopeLabel, country: dataset.country, countryCode: dataset.countryCode ?? 'DEMO', asOf: dataset.asOf,
      facilityCount: scopedFacilityIds.size, recordCount: rows.length, knownCount: known.length, unknownCount,
      criticalCount, watchCount, stableCount, availabilityPct, onTrackPct: known.length ? Math.round(100 * stableCount / known.length) : 0,
      budgetCeilingCents: filters.budgetCents, plannedCostCents, releasedCostCents,
      budgetUtilizationPct: filters.budgetCents ? Math.min(100, Math.round(100 * plannedCostCents / filters.budgetCents)) : 0,
      expiringSoonUnits: expiring, stockoutDays: outcomeMetrics(rows).stockoutDays, unmetUnits: outcomeMetrics(rows).unmetUnits },
    map: { schematic: mapDistricts.some((d) => d.polygon), districts: mapDistricts },
    interventions,
    interventionNote: filters.horizonDays === 90 ? 'The 90-day view shows a 90-day risk forecast; ranked interventions use the supported 60-day allocation horizon.' : filters.regionId && !filters.districtId ? 'Interventions are filtered from a national budget-ceiling scenario; region-level re-optimization is a pilot extension.' : 'Interventions come from the exact MILP scenario under the selected budget ceiling and safety constraints.',
    gateReason: ctx.gateReason ?? null,
    bottlenecks: bottlenecks.slice(0, 6), forecast,
    pipeline: { source: 'saved_demo_plans', stages, totalValueCents: scopedPlanItems.reduce((sum, { item }) => sum + item.costCents, 0), pending },
    alerts: alerts.slice(0, 10), riskRows: rows.slice(0, 100), facilityStock, upcomingDeliveries, recentReceipts,
    supportRequests: supportRequests.filter((r) => scopedFacilityIds.has(r.facilityId)),
    notes: notes.filter((n) => n.countryCode === (dataset.countryCode ?? 'DEMO')),
    audit: audit.filter((e) => filters.role === 'partner' || filters.role === 'leadership' || e.role === filters.role || (filters.facilityId && e.scope === filters.facilityId) || (filters.districtId && e.scope.includes(filters.districtId))).slice(0, 30),
    capabilities: dashboardCapabilities(filters.role),
    partner, optimization: scenario?.optimization ?? null, clinicalPolicy: scenario?.clinicalPolicy ?? null,
  };
}

export async function dashboardScenario(dataset: Dataset, hash: string, filters: DashboardFilters, policy: ClinicalPolicy, dataAuthorized: boolean): Promise<{ scenario: ScenarioResult | null; gateReason: string | null }> {
  const resolved = resolveDashboardFilters(dataset, filters);
  const districtId = resolved.facilityId ? dataset.facilities.find((f) => f.id === resolved.facilityId)?.districtId ?? null : resolved.districtId ?? null;
  const horizonDays = resolved.horizonDays === 90 ? 60 : resolved.horizonDays;
  try {
    const scenario = await runScenario(dataset, { budgetCents: resolved.budgetCents, horizonDays, bufferDays: DEFAULT_SCENARIO.bufferDays, districtId, countryCode: resolved.countryCode ?? dataset.countryCode ?? 'DEMO' }, hash, policy, dataAuthorized);
    return { scenario, gateReason: null };
  } catch (error) {
    return { scenario: null, gateReason: error instanceof Error ? error.message : 'Allocation is unavailable for this scope.' };
  }
}
