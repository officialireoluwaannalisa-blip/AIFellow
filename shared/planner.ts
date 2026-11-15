import { allocationGate, AllocationGateError, DEMO_CLINICAL_POLICY, policyWeight, type ClinicalPolicy } from './clinical-policy.js';
import { addDays, assessDataset, DEFAULT_SCENARIO, forecastDemand, outcomeMetrics, stockKey } from './domain.js';
import { solveAllocation, type AllocationCandidate } from './optimizer.js';
import type { Batch, Dataset, PlanAction, ScenarioInput, ScenarioResult, Stock, UnfundedNeed } from './types.js';

export const ORDER_COST_CENTS = 15_000;
export const HANDLING_COST_CENTS = 5_000;
const WEIGHT_SCALE = 1000;

export function cloneStocks(stocks: Stock[]): Stock[] { return structuredClone(stocks); }

/**
 * Conservative donor surplus: replay the donor's own FEFO demand over the
 * target horizon, then reserve the safety buffer. Only leftover released,
 * non-expired batch units may be transferred. Confirmed inbound is deliberately
 * not counted as transferable supply because it has not arrived yet.
 */
export function transferableDonorBatches(stock: Stock, asOf: string, targetDays: number, daily: number, bufferDays: number): Batch[] {
  const batches = stock.batches.filter((b) => b.status === 'released' && b.expiryDate >= asOf && b.quantity > 0)
    .map((b) => ({ ...b })).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.id.localeCompare(b.id));
  const demand = Math.max(0, Math.round(daily));
  for (let day = 1; day <= targetDays; day++) {
    const date = addDays(asOf, day);
    for (const batch of batches) if (batch.expiryDate < date) batch.quantity = 0;
    let remaining = demand;
    for (const batch of batches) {
      if (batch.expiryDate < date || remaining === 0) continue;
      const used = Math.min(batch.quantity, remaining); batch.quantity -= used; remaining -= used;
    }
  }
  let reserve = Math.ceil(Math.max(0, daily) * bufferDays);
  for (const batch of batches) {
    if (reserve === 0) break;
    const used = Math.min(batch.quantity, reserve); batch.quantity -= used; reserve -= used;
  }
  return batches.filter((b) => b.quantity > 0);
}

interface TransferMeta {
  activationKey: string; donorFacilityId: string; recipientFacilityId: string; productId: string;
  arrivalDays: number; fixedCostCents: number; weight: number; unit: string;
  allocations: { batchId: string; quantity: number; expiryDate: string }[];
}

/**
 * Exact fixed-charge integer-flow allocation. Safety guardrails are enforced;
 * real-country prioritization requires an approved local clinical policy.
 */
export async function runScenario(
  dataset: Dataset,
  input: ScenarioInput,
  datasetHash: string,
  policy: ClinicalPolicy = DEMO_CLINICAL_POLICY,
  dataAuthorized = false,
): Promise<ScenarioResult> {
  const countryCode = input.countryCode ?? dataset.countryCode ?? 'DEMO';
  const datasetCountry = dataset.countryCode ?? 'DEMO';
  if (countryCode !== datasetCountry) throw new AllocationGateError('Selected country/location does not match the active dataset. Import an authorized aggregate pack for that jurisdiction first.');
  const gate = allocationGate(countryCode, policy, dataAuthorized);
  if (!gate.allowed) throw new AllocationGateError(gate.reason);
  if (input.bufferDays < policy.safety.minDonorBufferDays) throw new AllocationGateError(`Safety buffer must be at least ${policy.safety.minDonorBufferDays} days under the active policy.`);

  const targetDays = input.horizonDays + input.bufferDays;
  const baseline = assessDataset(dataset, input.horizonDays, input.bufferDays, input.districtId);
  const products = new Map(dataset.products.map((p) => [p.id, p]));
  const facilities = new Map(dataset.facilities.map((f) => [f.id, f]));
  const stockMap = new Map(dataset.stocks.map((s) => [stockKey(s.facilityId, s.productId), s]));
  const routeMap = new Map(dataset.routes.filter((r) => r.sameDistrict).map((r) => [`${r.fromFacilityId}:${r.toFacilityId}`, r]));
  const candidates: AllocationCandidate[] = [];
  const transferMeta = new Map<string, TransferMeta>();
  const recipientCaps = new Map<string, number>();
  const donorCaps = new Map<string, number>();
  const batchCaps = new Map<string, number>();

  const donors = new Map<string, { facilityId: string; productId: string; surplus: number; batches: Batch[] }>();
  for (const assessment of baseline) {
    if (assessment.risk === 'unknown') continue;
    const stock = stockMap.get(stockKey(assessment.facilityId, assessment.productId))!;
    const daily = forecastDemand(stock.history).daily;
    const batches = transferableDonorBatches(stock, dataset.asOf, targetDays, daily, input.bufferDays);
    const surplus = batches.reduce((sum, b) => sum + b.quantity, 0);
    if (surplus <= 0) continue;
    const key = stockKey(assessment.facilityId, assessment.productId);
    donors.set(key, { facilityId: assessment.facilityId, productId: assessment.productId, surplus, batches });
    donorCaps.set(key, surplus);
    for (const batch of batches) batchCaps.set(`${assessment.facilityId}:${assessment.productId}:${batch.id}`, batch.quantity);
  }

  for (const recipient of baseline) {
    if (recipient.risk === 'unknown' || recipient.needUnits <= 0) continue;
    const product = products.get(recipient.productId)!;
    const recipientKey = stockKey(recipient.facilityId, recipient.productId);
    const recipientStock = stockMap.get(recipientKey)!;
    const daily = forecastDemand(recipientStock.history).daily;
    const safetyTarget = daily * input.bufferDays;
    const endingStock = recipient.targetProjection[recipient.targetProjection.length - 1]?.stock ?? 0;
    const bufferShortfall = Math.max(0, safetyTarget - endingStock);
    const weight = policyWeight(policy, product.id, product.priorityWeight);
    const benefitPerUnit = Math.max(1, Math.round(weight * WEIGHT_SCALE));
    recipientCaps.set(recipientKey, recipient.needUnits);

    if (recipient.procurementNeedUnits > 0) {
      const id = `proc:${recipient.facilityId}:${recipient.productId}`;
      candidates.push({
        id, activationKey: id, kind: 'procurement', recipientKey,
        maxQuantity: recipient.procurementNeedUnits, unitCostCents: product.unitCostCents,
        fixedCostCents: ORDER_COST_CENTS, benefitPerUnit,
      });
    }

    const recipientFacility = facilities.get(recipient.facilityId)!;
    for (const donor of donors.values()) {
      if (donor.facilityId === recipient.facilityId || donor.productId !== recipient.productId) continue;
      const donorFacility = facilities.get(donor.facilityId)!;
      if (donorFacility.districtId !== recipientFacility.districtId) continue;
      const route = routeMap.get(`${donor.facilityId}:${recipient.facilityId}`);
      if (!route || (product.coldChain && !route.coldChainCapable) || route.days > policy.safety.maxTransferArrivalDays) continue;
      const unmetAfterArrival = recipient.targetProjection.filter((p) => p.day >= route.days).reduce((sum, p) => sum + p.unmet, 0);
      const routeCap = Math.min(recipient.needUnits, Math.ceil(unmetAfterArrival + bufferShortfall));
      if (routeCap <= 0) continue;
      const minimumExpiry = addDays(dataset.asOf, route.days + Math.max(product.minRemainingShelfLifeDays, policy.safety.minRemainingShelfLifeDays));
      const eligibleBatches = donor.batches.filter((b) => b.expiryDate >= minimumExpiry)
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.id.localeCompare(b.id));
      if (!eligibleBatches.length) continue;
      const activationKey = `transfer:${donor.facilityId}:${recipient.facilityId}:${recipient.productId}`;
      const fixedCostCents = route.costCents + HANDLING_COST_CENTS;
      transferMeta.set(activationKey, {
        activationKey, donorFacilityId: donor.facilityId, recipientFacilityId: recipient.facilityId,
        productId: recipient.productId, arrivalDays: route.days, fixedCostCents, weight, unit: product.unit, allocations: [],
      });
      for (const batch of eligibleBatches) {
        const maxQuantity = Math.min(batch.quantity, routeCap);
        if (maxQuantity <= 0) continue;
        candidates.push({
          id: `${activationKey}:${batch.id}`, activationKey, kind: 'transfer', recipientKey,
          donorKey: stockKey(donor.facilityId, donor.productId),
          batchKey: `${donor.facilityId}:${donor.productId}:${batch.id}`,
          maxQuantity, unitCostCents: 0, fixedCostCents, benefitPerUnit,
        });
      }
    }
  }

  const { allocations, certificate } = await solveAllocation(candidates, {
    budgetCents: input.budgetCents, recipient: recipientCaps, donor: donorCaps, batch: batchCaps,
  });
  const quantityById = new Map(allocations.map((a) => [a.id, a.quantity]));
  const candidateById = new Map(candidates.map((c) => [c.id, c]));
  for (const allocation of allocations) {
    const candidate = candidateById.get(allocation.id)!;
    if (candidate.kind !== 'transfer') continue;
    const meta = transferMeta.get(candidate.activationKey)!;
    const batchId = candidate.batchKey!.split(':')[2];
    const donor = donors.get(candidate.donorKey!)!;
    const batch = donor.batches.find((b) => b.id === batchId)!;
    meta.allocations.push({ batchId, quantity: allocation.quantity, expiryDate: batch.expiryDate });
  }

  const selected: PlanAction[] = [];
  for (const candidate of candidates) {
    if (candidate.kind !== 'procurement') continue;
    const quantity = quantityById.get(candidate.id) ?? 0;
    if (quantity <= 0) continue;
    const product = products.get(candidate.recipientKey.split(':')[1])!;
    const [facilityId] = candidate.recipientKey.split(':');
    const leadTimeDays = stockMap.get(candidate.recipientKey)!.leadTimeDays;
    selected.push({
      id: candidate.id, kind: 'procurement', facilityId, productId: product.id, quantity,
      costCents: quantity * product.unitCostCents + ORDER_COST_CENTS, arrivalDays: leadTimeDays,
      priorityScore: Number(((quantity * candidate.benefitPerUnit / WEIGHT_SCALE / (quantity * product.unitCostCents + ORDER_COST_CENTS)) * 100_000).toFixed(2)),
      rationale: `Replenish ${quantity.toLocaleString('en-US')} ${product.unit} for demand after the ${leadTimeDays}-day lead time plus the ${input.bufferDays}-day buffer. Earlier unmet demand needs a faster option or escalation.`,
    });
  }
  for (const meta of transferMeta.values()) {
    if (!meta.allocations.length) continue;
    meta.allocations.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.batchId.localeCompare(b.batchId));
    const quantity = meta.allocations.reduce((sum, a) => sum + a.quantity, 0);
    const donorFacility = facilities.get(meta.donorFacilityId)!;
    selected.push({
      id: meta.activationKey, kind: 'transfer', facilityId: meta.recipientFacilityId, productId: meta.productId,
      donorFacilityId: meta.donorFacilityId, donorBatchId: meta.allocations[0].batchId, donorAllocations: meta.allocations,
      expiryDate: meta.allocations[0].expiryDate, quantity, costCents: meta.fixedCostCents, arrivalDays: meta.arrivalDays,
      priorityScore: Number(((quantity * meta.weight / meta.fixedCostCents) * 100_000).toFixed(2)),
      rationale: `Move ${quantity.toLocaleString('en-US')} ${meta.unit} from ${donorFacility.name}, preserving donor buffer. ${meta.allocations.length} eligible batch allocation(s), earliest expiry ${meta.allocations[0].expiryDate}; route meets shelf-life and cold-chain safety constraints.`,
    });
  }
  selected.sort((a, b) => a.id.localeCompare(b.id));

  const state = cloneStocks(dataset.stocks);
  const stateMap = new Map(state.map((s) => [stockKey(s.facilityId, s.productId), s]));
  for (const action of selected) {
    const recipientStock = stateMap.get(stockKey(action.facilityId, action.productId))!;
    const product = products.get(action.productId)!;
    if (action.kind === 'transfer') {
      const donorStock = stateMap.get(stockKey(action.donorFacilityId!, action.productId))!;
      for (const allocation of action.donorAllocations ?? []) {
        const batch = donorStock.batches.find((b) => b.id === allocation.batchId)!;
        batch.quantity -= allocation.quantity;
        if (batch.quantity < 0) throw new Error('Selected transfer exceeds donor batch supply');
      }
      donorStock.usableUnits -= action.quantity;
    }
    recipientStock.inbound.push({
      id: action.id, quantity: action.quantity, expectedDate: addDays(dataset.asOf, action.arrivalDays),
      expiryDate: action.expiryDate ?? addDays(dataset.asOf, action.arrivalDays + product.shelfLifeDays), status: 'confirmed',
    });
  }
  const afterAssessments = assessDataset({ ...dataset, stocks: state }, input.horizonDays, input.bufferDays, input.districtId);
  const totalCostCents = selected.reduce((sum, a) => sum + a.costCents, 0);
  if (totalCostCents !== certificate.costCents) throw new Error('Optimizer certificate cost does not match selected actions');
  const remainingBudgetCents = input.budgetCents - totalCostCents;
  const unfunded: UnfundedNeed[] = afterAssessments.filter((a) => a.risk !== 'unknown' && a.needUnits > 0).map((a) => {
    const product = products.get(a.productId)!;
    const estimatedCostCents = a.needUnits * product.unitCostCents + ORDER_COST_CENTS;
    return { facilityId: a.facilityId, productId: a.productId, quantity: a.needUnits, estimatedCostCents,
      reason: estimatedCostCents > remainingBudgetCents ? 'Remaining budget cannot cover the next feasible replenishment.' : 'No feasible candidate remained under the modeled safety constraints.' };
  }).sort((a, b) => a.facilityId.localeCompare(b.facilityId) || a.productId.localeCompare(b.productId));

  return {
    scenario: { ...input, countryCode }, datasetVersion: dataset.version, datasetHash, asOf: dataset.asOf,
    selected, unfunded, totalCostCents, remainingBudgetCents,
    before: outcomeMetrics(baseline), after: outcomeMetrics(afterAssessments),
    optimization: certificate,
    clinicalPolicy: {
      jurisdiction: countryCode, policyVersion: policy.version, approvalStatus: policy.approvalStatus,
      autonomousExecution: false, safetyConstraintsEnforced: true, prioritizationSource: policy.prioritization.source,
    },
    assumptions: [
      'Active dataset mode is declared by the server; the public demo uses synthetic data only.',
      'HiGHS fixed-charge integer-flow MILP certifies global optimality for the modeled problem: maximize weighted units, then minimize cost. It is not a claim of real-world clinical optimality.',
      'Conservative safety constraints are enforced: exact product, expired/quarantine exclusion, donor buffer, shelf life, cold chain, and route limits.',
      'No autonomous execution is enabled. Real-country prioritization requires authorized aggregate data and a locally approved clinical policy.',
      'Authorization is assumed immediate; cash-release and supplier delays are not modeled.',
      'Demand uses a 28-day mean with a capped recent trend; unexpected shocks are not captured.',
      'Procurement addresses demand after its lead time; earlier gaps require faster action or escalation.',
      'Donor transferable supply is computed by replaying donor FEFO demand and reserving the safety buffer; confirmed inbound is not transferable before arrival.',
      'Multi-batch transfers carry each allocated batch expiry; new procurement uses nominal shelf life.',
      'Unknown records are excluded from automatic allocation and require data review.',
    ],
  };
}

export const defaultScenario = (): ScenarioInput => ({ ...DEFAULT_SCENARIO, countryCode: 'DEMO' });
