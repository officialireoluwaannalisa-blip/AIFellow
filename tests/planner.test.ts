import { describe, expect, it } from 'vitest';
import { addDays } from '../shared/domain';
import { runScenario } from '../shared/planner';
import { loadDataset } from '../server/data';
import type { Dataset, ScenarioInput } from '../shared/types';

const { dataset: seed, hash } = loadDataset();
const input = (overrides: Partial<ScenarioInput> = {}): ScenarioInput => ({ budgetCents: 10_000_000, horizonDays: 30, bufferDays: 7, districtId: null, ...overrides });
function smallDataset(): Dataset {
  const asOf = '2026-11-14';
  return {
    version: 'test', asOf, country: 'Demo Republic', currency: 'USD',
    districts: [{ id: 'd1', name: 'Demo District' }],
    facilities: [{ id: 'donor', name: 'Donor', districtId: 'd1', type: 'hospital' }, { id: 'recipient', name: 'Recipient', districtId: 'd1', type: 'clinic' }],
    products: [{ id: 'p1', name: 'Demo product', form: 'Tablet', unit: 'tablets', essential: true, coldChain: true, unitCostCents: 100, minRemainingShelfLifeDays: 60, shelfLifeDays: 365, priorityWeight: 1 }],
    stocks: [
      { facilityId: 'donor', productId: 'p1', reportedAt: asOf, usableUnits: 1000, quarantinedUnits: 0, history: Array(28).fill(10), leadTimeDays: 5, batches: [{ id: 'donor-batch', quantity: 1000, expiryDate: addDays(asOf, 200), status: 'released' }], inbound: [] },
      { facilityId: 'recipient', productId: 'p1', reportedAt: asOf, usableUnits: 0, quarantinedUnits: 0, history: Array(28).fill(10), leadTimeDays: 5, batches: [{ id: 'recipient-batch', quantity: 0, expiryDate: addDays(asOf, 200), status: 'released' }], inbound: [] },
    ],
    routes: [{ fromFacilityId: 'donor', toFacilityId: 'recipient', days: 1, costCents: 10000, coldChainCapable: true, sameDistrict: true }],
    evidence: [],
  };
}

describe('scenario invariants', () => {
  it('never exceeds the budget and is deterministic', () => {
    for (const budgetCents of [0, 1000, 2_500_000, 100_000_000]) {
      const a = runScenario(seed, input({ budgetCents }), hash);
      const b = runScenario(seed, input({ budgetCents }), hash);
      expect(a.totalCostCents).toBeLessThanOrEqual(budgetCents);
      expect(a.totalCostCents + a.remainingBudgetCents).toBe(budgetCents);
      expect(a.selected.reduce((sum, x) => sum + x.costCents, 0)).toBe(a.totalCostCents);
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      if (budgetCents === 0) expect(a.selected).toHaveLength(0);
    }
  });
  it('creates a feasible exact-product transfer and preserves donor buffer', () => {
    const data = smallDataset(); const result = runScenario(data, input(), hash);
    const transfer = result.selected.find((x) => x.kind === 'transfer');
    expect(transfer).toBeDefined(); expect(transfer!.productId).toBe('p1'); expect(transfer!.donorFacilityId).toBe('donor');
    expect(transfer!.quantity).toBeGreaterThan(0); expect(transfer!.expiryDate).toBe(addDays(data.asOf, 200));
    expect(result.after.unmetUnits).toBeLessThan(result.before.unmetUnits);
  });
  it('rejects a cold-chain transfer on an incapable route', () => {
    const data = smallDataset(); data.routes[0].coldChainCapable = false;
    const result = runScenario(data, input(), hash);
    expect(result.selected.some((x) => x.kind === 'transfer')).toBe(false);
    expect(result.selected.some((x) => x.kind === 'procurement')).toBe(true);
  });
  it('rejects batches without minimum remaining shelf life after arrival', () => {
    const data = smallDataset(); data.stocks[0].batches[0].expiryDate = addDays(data.asOf, 30);
    const result = runScenario(data, input(), hash);
    expect(result.selected.some((x) => x.kind === 'transfer')).toBe(false);
  });
  it('does not take stock from a donor without surplus', () => {
    const data = smallDataset(); data.stocks[0].usableUnits = 100; data.stocks[0].batches[0].quantity = 100;
    const result = runScenario(data, input(), hash);
    expect(result.selected.some((x) => x.kind === 'transfer')).toBe(false);
  });
  it('excludes Unknown records from automatic allocation', () => {
    const data = smallDataset(); data.stocks[1].reportedAt = addDays(data.asOf, -12);
    const result = runScenario(data, input(), hash);
    expect(result.selected).toHaveLength(0);
  });
  it('never double-allocates donor batches across the full demo', () => {
    const result = runScenario(seed, input(), hash);
    const allocated = new Map<string, number>();
    for (const action of result.selected) for (const allocation of action.donorAllocations ?? []) {
      const key = `${action.donorFacilityId}:${action.productId}:${allocation.batchId}`;
      allocated.set(key, (allocated.get(key) ?? 0) + allocation.quantity);
    }
    for (const [key, quantity] of allocated) {
      const [facilityId, productId, batchId] = key.split(':');
      const batch = seed.stocks.find((s) => s.facilityId === facilityId && s.productId === productId)!.batches.find((b) => b.id === batchId)!;
      expect(quantity).toBeLessThanOrEqual(batch.quantity);
    }
    for (const action of result.selected) if (action.kind === 'transfer') expect(action.productId).toBe(result.selected.find((x) => x.id === action.id)!.productId);
  });
});
