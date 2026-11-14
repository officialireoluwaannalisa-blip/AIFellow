import { addDays, assessDataset, DEFAULT_SCENARIO, outcomeMetrics, stockKey } from './domain';
import type { Assessment, Dataset, PlanAction, ScenarioInput, ScenarioResult, Stock, UnfundedNeed } from './types';

export const ORDER_COST_CENTS = 15_000;
export const HANDLING_COST_CENTS = 5_000;
const MAX_ACTIONS = 300;
interface Candidate extends PlanAction { recipientKey: string }

export function cloneStocks(stocks: Stock[]): Stock[] { return structuredClone(stocks); }

/**
 * Transparent adaptive greedy heuristic. Deterministic tools own all arithmetic.
 * Procurement addresses demand after its lead time; transfers can address earlier gaps.
 * This is not a global optimizer or a clinical allocation rule.
 */
export function runScenario(dataset: Dataset, input: ScenarioInput, datasetHash: string): ScenarioResult {
  const baseline = assessDataset(dataset, input.horizonDays, input.bufferDays, input.districtId);
  const state = cloneStocks(dataset.stocks);
  const scopedDataset = { ...dataset, stocks: state };
  const products = new Map(dataset.products.map((p) => [p.id, p]));
  const facilities = new Map(dataset.facilities.map((f) => [f.id, f]));
  const stockMap = new Map(state.map((s) => [stockKey(s.facilityId, s.productId), s]));
  const routeMap = new Map(dataset.routes.filter((r) => r.sameDistrict).map((r) => [`${r.fromFacilityId}:${r.toFacilityId}`, r]));
  const selected: PlanAction[] = [];
  const usedIds = new Set<string>();
  let remainingBudgetCents = input.budgetCents;
  const safetyTarget = (daily: number) => Math.ceil(daily * input.bufferDays);

  for (let iteration = 0; iteration < MAX_ACTIONS; iteration++) {
    const assessments = assessDataset(scopedDataset, input.horizonDays, input.bufferDays, input.districtId);
    const donorInfo = new Map<string, { assessment: Assessment; surplus: number; stock: Stock }>();
    for (const assessment of assessments) {
      if (assessment.risk === 'unknown') continue;
      const minimumProjected = Math.min(...assessment.targetProjection.map((p) => p.stock));
      const surplus = Math.max(0, minimumProjected - safetyTarget(assessment.forecastDaily));
      if (surplus > 0) donorInfo.set(stockKey(assessment.facilityId, assessment.productId), { assessment, surplus, stock: stockMap.get(stockKey(assessment.facilityId, assessment.productId))! });
    }
    const candidates: Candidate[] = [];
    for (const recipient of assessments) {
      if (recipient.risk === 'unknown') continue;
      const product = products.get(recipient.productId)!;
      const recipientKey = stockKey(recipient.facilityId, recipient.productId);
      const recipientStock = stockMap.get(recipientKey)!;
      if (recipient.procurementNeedUnits > 0) {
        const quantity = recipient.procurementNeedUnits;
        const costCents = quantity * product.unitCostCents + ORDER_COST_CENTS;
        const id = `proc:${recipient.facilityId}:${recipient.productId}`;
        if (!usedIds.has(id)) candidates.push({
          id, kind: 'procurement', facilityId: recipient.facilityId, productId: recipient.productId, quantity,
          costCents, arrivalDays: recipientStock.leadTimeDays,
          priorityScore: Number(((quantity * product.priorityWeight / costCents) * 100_000).toFixed(2)),
          rationale: `Replenish ${quantity.toLocaleString('en-US')} ${product.unit} for demand after the ${recipientStock.leadTimeDays}-day lead time plus the ${input.bufferDays}-day buffer. Current cover is ${recipient.daysCover ?? 'unknown'} days; earlier unmet demand needs a faster option or escalation.`,
          recipientKey,
        });
      }
      if (recipient.needUnits <= 0) continue;
      const recipientFacility = facilities.get(recipient.facilityId)!;
      for (const donor of donorInfo.values()) {
        if (donor.assessment.facilityId === recipient.facilityId || donor.assessment.productId !== recipient.productId) continue;
        const donorFacility = facilities.get(donor.assessment.facilityId)!;
        if (donorFacility.districtId !== recipientFacility.districtId) continue;
        const route = routeMap.get(`${donor.assessment.facilityId}:${recipient.facilityId}`);
        if (!route || (product.coldChain && !route.coldChainCapable)) continue;
        const minimumExpiry = addDays(dataset.asOf, route.days + product.minRemainingShelfLifeDays);
        const eligibleBatches = donor.stock.batches.filter((b) => b.status === 'released' && b.quantity > 0 && b.expiryDate >= minimumExpiry)
          .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.id.localeCompare(b.id));
        if (!eligibleBatches.length) continue;
        const eligibleUnits = eligibleBatches.reduce((sum, b) => sum + b.quantity, 0);
        const quantity = Math.min(recipient.needUnits, donor.surplus, eligibleUnits);
        if (quantity <= 0) continue;
        const id = `transfer:${donor.assessment.facilityId}:${recipient.facilityId}:${recipient.productId}`;
        if (usedIds.has(id)) continue;
        let left = quantity;
        const donorAllocations: { batchId: string; quantity: number; expiryDate: string }[] = [];
        for (const batch of eligibleBatches) {
          if (left <= 0) break;
          const take = Math.min(left, batch.quantity);
          donorAllocations.push({ batchId: batch.id, quantity: take, expiryDate: batch.expiryDate });
          left -= take;
        }
        const costCents = route.costCents + HANDLING_COST_CENTS;
        candidates.push({
          id, kind: 'transfer', facilityId: recipient.facilityId, productId: recipient.productId, donorFacilityId: donor.assessment.facilityId,
          donorBatchId: donorAllocations[0].batchId, donorAllocations, expiryDate: donorAllocations[0].expiryDate,
          quantity, costCents, arrivalDays: route.days,
          priorityScore: Number(((quantity * product.priorityWeight / costCents) * 100_000).toFixed(2)),
          rationale: `Move ${quantity.toLocaleString('en-US')} ${product.unit} from ${donor.assessment.facilityName}, preserving its modeled buffer. ${donorAllocations.length} eligible batch allocation(s), earliest expiry ${donorAllocations[0].expiryDate}; the ${route.days}-day route meets shelf-life${product.coldChain ? ' and cold-chain' : ''} requirements.`,
          recipientKey,
        });
      }
    }
    const choice = candidates.filter((c) => c.costCents <= remainingBudgetCents && c.quantity > 0)
      .sort((a, b) => b.priorityScore - a.priorityScore || a.costCents - b.costCents || a.id.localeCompare(b.id))[0];
    if (!choice) break;
    const { recipientKey, ...action } = choice;
    selected.push(action); usedIds.add(action.id); remainingBudgetCents -= action.costCents;
    const recipientStock = stockMap.get(recipientKey)!;
    const product = products.get(action.productId)!;
    if (action.kind === 'transfer') {
      const donorStock = stockMap.get(stockKey(action.donorFacilityId!, action.productId))!;
      for (const allocation of action.donorAllocations ?? []) {
        const batch = donorStock.batches.find((b) => b.id === allocation.batchId)!;
        batch.quantity -= allocation.quantity;
      }
      donorStock.usableUnits -= action.quantity;
    }
    recipientStock.inbound.push({
      id: action.id, quantity: action.quantity, expectedDate: addDays(dataset.asOf, action.arrivalDays),
      expiryDate: action.expiryDate ?? addDays(dataset.asOf, action.arrivalDays + product.shelfLifeDays), status: 'confirmed',
    });
  }

  const afterAssessments = assessDataset(scopedDataset, input.horizonDays, input.bufferDays, input.districtId);
  const unfunded: UnfundedNeed[] = afterAssessments.filter((a) => a.risk !== 'unknown' && a.needUnits > 0).map((a) => {
    const product = products.get(a.productId)!;
    const estimatedCostCents = a.needUnits * product.unitCostCents + ORDER_COST_CENTS;
    return { facilityId: a.facilityId, productId: a.productId, quantity: a.needUnits, estimatedCostCents,
      reason: estimatedCostCents > remainingBudgetCents ? 'Remaining budget cannot cover the next feasible replenishment.' : 'No affordable unique action remained under the demo constraints.' };
  }).sort((a, b) => a.facilityId.localeCompare(b.facilityId) || a.productId.localeCompare(b.productId));

  return {
    scenario: input, datasetVersion: dataset.version, datasetHash, asOf: dataset.asOf,
    selected, unfunded, totalCostCents: input.budgetCents - remainingBudgetCents, remainingBudgetCents,
    before: outcomeMetrics(baseline), after: outcomeMetrics(afterAssessments),
    assumptions: [
      'Synthetic data only; no real procurement or payment is executed.',
      'Adaptive greedy cost-effectiveness heuristic, not a globally optimal or clinical allocation rule.',
      'Authorization is assumed immediate; cash-release and supplier delays are not modeled.',
      'Demand uses a 28-day mean with a capped recent trend; unexpected shocks are not captured.',
      'Procurement addresses demand after its lead time; earlier gaps require faster action or escalation.',
      'Transfers require exact products, explicit same-district routes, donor buffer, shelf life, and cold-chain compatibility.',
      'Multi-batch transfers conservatively carry the earliest allocated expiry; new procurement uses nominal shelf life.',
      'Unknown records are excluded from automatic allocation and require data review.',
      'A preview is bounded to 300 unique actions; remaining modeled needs stay visible for review.',
    ],
  };
}

export const defaultScenario = (): ScenarioInput => ({ ...DEFAULT_SCENARIO });
