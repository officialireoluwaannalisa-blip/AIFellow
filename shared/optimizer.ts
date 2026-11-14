import { createHash } from 'node:crypto';
import loadHighs from 'highs';

export interface AllocationCandidate {
  id: string;
  activationKey: string;
  kind: 'procurement' | 'transfer';
  recipientKey: string;
  donorKey?: string;
  batchKey?: string;
  maxQuantity: number;
  unitCostCents: number;
  fixedCostCents: number;
  benefitPerUnit: number;
}
export interface AllocationCaps {
  budgetCents: number;
  recipient: Map<string, number>;
  donor: Map<string, number>;
  batch: Map<string, number>;
}
export interface OptimizationCertificate {
  solver: 'HiGHS';
  solverVersion: string;
  status: 'optimal';
  objective: 'lexicographic_weighted_units_then_cost';
  objectiveValue: number;
  costCents: number;
  relativeGap: 0;
  candidateCount: number;
  variableCount: number;
  constraintCount: number;
  solveTimeMs: number;
  modelSha256: string;
  scope: 'modeled_integer_flow_problem';
}
export interface OptimizerAllocation { id: string; quantity: number }

const HIGHS_VERSION = '1.15.4';
const MAX_CANDIDATES = 5000;
let highsPromise: ReturnType<typeof loadHighs> | null = null;
const getHighs = () => { highsPromise ??= loadHighs(); return highsPromise; };

function assertInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`);
  return value;
}

/**
 * Exact fixed-charge integer-flow MILP.
 * Stage 1 maximizes integer weighted units; stage 2 minimizes cost without
 * reducing stage-1 benefit. Both stages must return HiGHS status Optimal.
 * The certificate applies to this modeled problem, not to unmodeled clinical
 * utility, real-world routes, or unapproved policy choices.
 */
export async function solveAllocation(
  candidates: AllocationCandidate[],
  caps: AllocationCaps,
  timeLimitSeconds = 15,
): Promise<{ allocations: OptimizerAllocation[]; certificate: OptimizationCertificate }> {
  const start = Date.now();
  assertInteger(caps.budgetCents, 'budgetCents');
  if (candidates.length === 0) {
    return {
      allocations: [],
      certificate: {
        solver: 'HiGHS', solverVersion: HIGHS_VERSION, status: 'optimal',
        objective: 'lexicographic_weighted_units_then_cost', objectiveValue: 0, costCents: 0,
        relativeGap: 0, candidateCount: 0, variableCount: 0, constraintCount: 1,
        solveTimeMs: Date.now() - start, modelSha256: createHash('sha256').update('empty').digest('hex'),
        scope: 'modeled_integer_flow_problem',
      },
    };
  }
  if (candidates.length > MAX_CANDIDATES) throw new Error('Candidate set exceeds the demo solver safety limit; narrow the scope.');
  const ids = new Set<string>();
  for (const c of candidates) {
    if (ids.has(c.id)) throw new Error(`Duplicate optimizer candidate ${c.id}`);
    ids.add(c.id);
    assertInteger(c.maxQuantity, `${c.id}.maxQuantity`);
    assertInteger(c.unitCostCents, `${c.id}.unitCostCents`);
    assertInteger(c.fixedCostCents, `${c.id}.fixedCostCents`);
    assertInteger(c.benefitPerUnit, `${c.id}.benefitPerUnit`);
    if (c.maxQuantity === 0) throw new Error(`Zero-quantity candidate ${c.id}`);
  }
  const groups = new Map<string, { fixedCostCents: number; candidateIndexes: number[] }>();
  candidates.forEach((c, i) => {
    const existing = groups.get(c.activationKey);
    if (existing) {
      if (existing.fixedCostCents !== c.fixedCostCents) throw new Error(`Inconsistent fixed cost for ${c.activationKey}`);
      existing.candidateIndexes.push(i);
    } else groups.set(c.activationKey, { fixedCostCents: c.fixedCostCents, candidateIndexes: [i] });
  });
  const groupEntries = [...groups.entries()];
  const qName = (i: number) => `q${i}`;
  const yName = (g: number) => `y${g}`;
  const benefitTerms = candidates.map((c, i) => `${c.benefitPerUnit} ${qName(i)}`).join(' + ') || '0';
  const costTerms = [
    ...candidates.map((c, i) => c.unitCostCents ? `${c.unitCostCents} ${qName(i)}` : '').filter(Boolean),
    ...groupEntries.map(([, g], gi) => g.fixedCostCents ? `${g.fixedCostCents} ${yName(gi)}` : ''),
  ].filter(Boolean).join(' + ') || '0';

  const constraints: string[] = [` budget: ${costTerms} <= ${caps.budgetCents}`];
  const addCap = (prefix: string, cap: Map<string, number>, key: (c: AllocationCandidate) => string | undefined) => {
    for (const [id, max] of cap) {
      assertInteger(max, `${prefix}.${id}`);
      const terms = candidates.map((c, i) => ({ c, i })).filter(({ c }) => key(c) === id);
      if (!terms.length) continue;
      constraints.push(` ${prefix}_${constraints.length}: ${terms.map(({ i }) => `1 ${qName(i)}`).join(' + ')} <= ${max}`);
    }
  };
  addCap('recipient', caps.recipient, (c) => c.recipientKey);
  addCap('donor', caps.donor, (c) => c.donorKey);
  addCap('batch', caps.batch, (c) => c.batchKey);
  groupEntries.forEach(([activationKey, group], gi) => {
    for (const i of group.candidateIndexes) {
      constraints.push(` link_${constraints.length}: 1 ${qName(i)} - ${candidates[i].maxQuantity} ${yName(gi)} <= 0`);
    }
    if (activationKey.length === 0) throw new Error('Empty activation key');
  });

  const bounds = [
    ...candidates.map((c, i) => ` 0 <= ${qName(i)} <= ${c.maxQuantity}`),
    ...groupEntries.map((_, gi) => ` 0 <= ${yName(gi)} <= 1`),
  ];
  const generals = candidates.map((_, i) => qName(i));
  const binaries = groupEntries.map((_, gi) => yName(gi));
  const base = ['Subject To', ...constraints, 'Bounds', ...bounds, 'Generals', ` ${generals.join(' ') || 'dummy_q'}`, 'Binaries', ` ${binaries.join(' ') || 'dummy_y'}`];
  // HiGHS LP parser requires at least one variable in Generals/Binaires sections when present.
  // Empty candidate sets are handled before model construction.
  const stage1Model = ['Maximize', ` benefit: ${benefitTerms}`, ...base, 'End'].join('\n');
  const highs = await getHighs();
  const options = {
    output_flag: false, mip_rel_gap: 0, mip_abs_gap: 0, time_limit: timeLimitSeconds,
    random_seed: 0, threads: 1, presolve: 'on' as const, mip_feasibility_tolerance: 1e-9,
    primal_feasibility_tolerance: 1e-9, dual_feasibility_tolerance: 1e-9,
  };
  const stage1 = highs.solve(stage1Model, options);
  if (stage1.Status !== 'Optimal') throw new Error(`Optimizer did not certify global optimality (benefit stage: ${stage1.Status}). No plan was returned.`);
  const optimalBenefit = Math.round(stage1.ObjectiveValue);
  const stage2Model = ['Minimize', ` cost: ${costTerms}`, 'Subject To', ...constraints, ` stage1_benefit: ${benefitTerms} >= ${optimalBenefit}`, 'Bounds', ...bounds, 'Generals', ` ${generals.join(' ')}`, 'Binaries', ` ${binaries.join(' ')}`, 'End'].join('\n');
  const stage2 = highs.solve(stage2Model, options);
  if (stage2.Status !== 'Optimal') throw new Error(`Optimizer did not certify global optimality (cost stage: ${stage2.Status}). No plan was returned.`);

  const quantities = candidates.map((_, i) => {
    const primal = stage2.Columns[qName(i)]?.Primal;
    if (primal === undefined || !Number.isFinite(primal)) throw new Error('Optimizer returned a missing or non-finite quantity');
    const quantity = Math.round(primal);
    if (Math.abs(primal - quantity) > 1e-6) throw new Error('Optimizer returned a non-integer quantity');
    return quantity;
  });
  const activations = groupEntries.map((_, gi) => {
    const primal = stage2.Columns[yName(gi)]?.Primal;
    if (primal === undefined || !Number.isFinite(primal)) throw new Error('Optimizer returned a missing activation');
    const value = Math.round(primal);
    if (Math.abs(primal - value) > 1e-6 || (value !== 0 && value !== 1)) throw new Error('Optimizer returned a non-binary activation');
    return value;
  });

  // Independent integer feasibility check. Never trust solver tolerances for safety caps.
  let totalCost = 0; let totalBenefit = 0;
  const recipientUse = new Map<string, number>(); const donorUse = new Map<string, number>(); const batchUse = new Map<string, number>();
  candidates.forEach((c, i) => {
    const q = quantities[i];
    if (q > c.maxQuantity) throw new Error('Optimizer exceeded a candidate quantity cap');
    totalCost += q * c.unitCostCents; totalBenefit += q * c.benefitPerUnit;
    recipientUse.set(c.recipientKey, (recipientUse.get(c.recipientKey) ?? 0) + q);
    if (c.donorKey) donorUse.set(c.donorKey, (donorUse.get(c.donorKey) ?? 0) + q);
    if (c.batchKey) batchUse.set(c.batchKey, (batchUse.get(c.batchKey) ?? 0) + q);
  });
  groupEntries.forEach(([, group], gi) => {
    const groupQuantity = group.candidateIndexes.reduce((sum, i) => sum + quantities[i], 0);
    if (groupQuantity > 0 && activations[gi] !== 1) throw new Error('Optimizer used an inactive shipment');
    if (groupQuantity === 0 && activations[gi] !== 0 && group.fixedCostCents > 0) throw new Error('Optimizer charged an unused fixed cost');
    totalCost += activations[gi] * group.fixedCostCents;
  });
  if (!Number.isSafeInteger(totalBenefit)) throw new Error('Optimizer benefit exceeds safe integer range');
  if (totalCost > caps.budgetCents) throw new Error('Optimizer exceeded the budget');
  if (totalBenefit !== optimalBenefit) throw new Error('Optimizer cost stage changed the optimal benefit');
  for (const [key, use] of recipientUse) if (use > (caps.recipient.get(key) ?? Infinity)) throw new Error('Optimizer exceeded a recipient cap');
  for (const [key, use] of donorUse) if (use > (caps.donor.get(key) ?? Infinity)) throw new Error('Optimizer exceeded a donor cap');
  for (const [key, use] of batchUse) if (use > (caps.batch.get(key) ?? Infinity)) throw new Error('Optimizer exceeded a batch cap');

  const allocations = candidates.map((c, i) => ({ id: c.id, quantity: quantities[i] })).filter((a) => a.quantity > 0)
    .sort((a, b) => a.id.localeCompare(b.id));
  const modelSha256 = createHash('sha256').update(stage1Model).update('\n---stage2---\n').update(stage2Model).digest('hex');
  return {
    allocations,
    certificate: {
      solver: 'HiGHS', solverVersion: HIGHS_VERSION, status: 'optimal',
      objective: 'lexicographic_weighted_units_then_cost', objectiveValue: totalBenefit, costCents: totalCost,
      relativeGap: 0, candidateCount: candidates.length, variableCount: candidates.length + groupEntries.length,
      constraintCount: constraints.length + 1, solveTimeMs: Date.now() - start, modelSha256,
      scope: 'modeled_integer_flow_problem',
    },
  };
}
