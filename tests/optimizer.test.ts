import { describe, expect, it } from 'vitest';
import { solveAllocation, type AllocationCandidate } from '../shared/optimizer';

const candidate = (id: string, overrides: Partial<AllocationCandidate> = {}): AllocationCandidate => ({
  id, activationKey: id, kind: 'procurement', recipientKey: `r:${id}`, maxQuantity: 1,
  unitCostCents: 0, fixedCostCents: 0, benefitPerUnit: 1, ...overrides,
});

describe('exact integer-flow optimizer', () => {
  it('returns an optimal empty certificate', async () => {
    const result = await solveAllocation([], { budgetCents: 0, recipient: new Map(), donor: new Map(), batch: new Map() });
    expect(result.allocations).toHaveLength(0);
    expect(result.certificate.status).toBe('optimal');
    expect(result.certificate.relativeGap).toBe(0);
  });
  it('beats greedy ratio selection on a fixed-charge knapsack', async () => {
    // Greedy by benefit/cost picks A (6/6=1) and cannot afford B or C.
    // The global optimum is B+C with benefit 10 at cost 10.
    const candidates = [
      candidate('A', { fixedCostCents: 6, benefitPerUnit: 6 }),
      candidate('B', { fixedCostCents: 5, benefitPerUnit: 5 }),
      candidate('C', { fixedCostCents: 5, benefitPerUnit: 5 }),
    ];
    const result = await solveAllocation(candidates, { budgetCents: 10, recipient: new Map(), donor: new Map(), batch: new Map() });
    expect(result.allocations.map((a) => a.id).sort()).toEqual(['B', 'C']);
    expect(result.certificate.objectiveValue).toBe(10);
    expect(result.certificate.costCents).toBe(10);
  });
  it('charges a shared fixed cost once across multiple batch flows', async () => {
    const candidates = [
      candidate('batch-1', { activationKey: 'shipment', kind: 'transfer', recipientKey: 'r1', donorKey: 'd1', batchKey: 'b1', maxQuantity: 5, fixedCostCents: 5 }),
      candidate('batch-2', { activationKey: 'shipment', kind: 'transfer', recipientKey: 'r1', donorKey: 'd1', batchKey: 'b2', maxQuantity: 5, fixedCostCents: 5 }),
    ];
    const result = await solveAllocation(candidates, {
      budgetCents: 5, recipient: new Map([['r1', 10]]), donor: new Map([['d1', 10]]), batch: new Map([['b1', 5], ['b2', 5]]),
    });
    expect(result.allocations.reduce((sum, a) => sum + a.quantity, 0)).toBe(10);
    expect(result.certificate.costCents).toBe(5);
    expect(result.certificate.objectiveValue).toBe(10);
  });
  it('minimizes cost without sacrificing the optimal benefit', async () => {
    const candidates = [
      candidate('expensive', { recipientKey: 'r1', fixedCostCents: 10, benefitPerUnit: 5 }),
      candidate('cheap', { recipientKey: 'r1', fixedCostCents: 3, benefitPerUnit: 5 }),
    ];
    const result = await solveAllocation(candidates, { budgetCents: 20, recipient: new Map([['r1', 1]]), donor: new Map(), batch: new Map() });
    expect(result.allocations.map((a) => a.id)).toEqual(['cheap']);
    expect(result.certificate.objectiveValue).toBe(5);
    expect(result.certificate.costCents).toBe(3);
  });
  it('rejects duplicate candidate IDs and inconsistent fixed costs', async () => {
    await expect(solveAllocation([candidate('x'), candidate('x')], { budgetCents: 10, recipient: new Map(), donor: new Map(), batch: new Map() })).rejects.toThrow(/Duplicate/);
    await expect(solveAllocation([
      candidate('x', { activationKey: 'g', fixedCostCents: 1 }),
      candidate('y', { activationKey: 'g', fixedCostCents: 2 }),
    ], { budgetCents: 10, recipient: new Map(), donor: new Map(), batch: new Map() })).rejects.toThrow(/Inconsistent fixed cost/);
  });
});
