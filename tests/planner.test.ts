import { describe, expect, it } from 'vitest';
import { addDays } from '../shared/domain';
import { runScenario, transferableDonorBatches } from '../shared/planner';
import { loadDataset } from '../server/data';
import type { ScenarioInput } from '../shared/types';
import { smallDataset } from './fixtures';

const { dataset: seed, hash } = loadDataset();
const input = (overrides: Partial<ScenarioInput> = {}): ScenarioInput => ({ budgetCents: 10_000_000, horizonDays: 30, bufferDays: 7, districtId: null, countryCode: 'DEMO', ...overrides });
const stableResult = (result: Awaited<ReturnType<typeof runScenario>>) => JSON.stringify({ ...result, optimization: { ...result.optimization, solveTimeMs: 0 } });

describe('scenario invariants', () => {
  it('never exceeds the budget and is deterministic apart from solve timing', async () => {
    for (const budgetCents of [0, 1000, 2_500_000, 100_000_000]) {
      const a = await runScenario(seed, input({ budgetCents }), hash);
      const b = await runScenario(seed, input({ budgetCents }), hash);
      expect(a.totalCostCents).toBeLessThanOrEqual(budgetCents);
      expect(a.totalCostCents + a.remainingBudgetCents).toBe(budgetCents);
      expect(a.selected.reduce((sum, x) => sum + x.costCents, 0)).toBe(a.totalCostCents);
      expect(stableResult(a)).toBe(stableResult(b));
      expect(a.optimization.status).toBe('optimal');
      expect(a.optimization.relativeGap).toBe(0);
      if (budgetCents === 0) expect(a.selected).toHaveLength(0);
    }
  });
  it('creates a feasible exact-product transfer and preserves donor buffer', async () => {
    const data = smallDataset(); const result = await runScenario(data, input(), hash);
    const transfer = result.selected.find((x) => x.kind === 'transfer');
    expect(transfer).toBeDefined(); expect(transfer!.productId).toBe('p1'); expect(transfer!.donorFacilityId).toBe('donor');
    expect(transfer!.quantity).toBeGreaterThan(0); expect(transfer!.expiryDate).toBe(addDays(data.asOf, 200));
    expect(result.after.unmetUnits).toBeLessThan(result.before.unmetUnits);
  });
  it('rejects a cold-chain transfer on an incapable route', async () => {
    const data = smallDataset(); data.routes[0].coldChainCapable = false;
    const result = await runScenario(data, input(), hash);
    expect(result.selected.some((x) => x.kind === 'transfer')).toBe(false);
    expect(result.selected.some((x) => x.kind === 'procurement')).toBe(true);
  });
  it('rejects batches without minimum remaining shelf life after arrival', async () => {
    const data = smallDataset(); data.stocks[0].batches[0].expiryDate = addDays(data.asOf, 30);
    const result = await runScenario(data, input(), hash);
    expect(result.selected.some((x) => x.kind === 'transfer')).toBe(false);
  });
  it('does not take stock from a donor without surplus', async () => {
    const data = smallDataset(); data.stocks[0].usableUnits = 100; data.stocks[0].batches[0].quantity = 100;
    const result = await runScenario(data, input(), hash);
    expect(result.selected.some((x) => x.kind === 'transfer')).toBe(false);
    expect(transferableDonorBatches(data.stocks[0], data.asOf, 37, 10, 7)).toHaveLength(0);
  });
  it('excludes Unknown records from automatic allocation', async () => {
    const data = smallDataset(); data.stocks[1].reportedAt = addDays(data.asOf, -12);
    const result = await runScenario(data, input(), hash);
    expect(result.selected).toHaveLength(0);
  });
  it('never double-allocates donor batches across the full demo', async () => {
    const result = await runScenario(seed, input(), hash);
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
  });
  it('blocks real-country allocation without authorized data and approved policy', async () => {
    await expect(runScenario(seed, input({ countryCode: 'NG' }), hash)).rejects.toThrow(/does not match|authorized aggregate/i);
  });
});
