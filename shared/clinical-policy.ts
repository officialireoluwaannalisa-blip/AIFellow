import { z } from 'zod';

/**
 * Clinical governance is split into two layers:
 * 1. Enforceable logistics/pharmacy safety guardrails (exact product, expiry,
 *    quarantine, cold chain, donor buffer, route arrival limits).
 * 2. Locally approved prioritization weights. The app never invents a clinical
 *    priority rule for a real country and never executes allocation autonomously.
 */
export const clinicalPolicySchema = z.object({
  version: z.string().min(1).max(40),
  jurisdiction: z.string().min(2).max(10),
  approvalStatus: z.enum(['unapproved', 'approved']),
  approvedBy: z.string().max(200).optional(),
  approvedAt: z.string().max(40).optional(),
  syntheticDemo: z.boolean(),
  autonomousExecution: z.literal(false),
  safety: z.object({
    exactProductOnly: z.literal(true),
    excludeExpired: z.literal(true),
    excludeQuarantined: z.literal(true),
    coldChainRequired: z.literal(true),
    minRemainingShelfLifeDays: z.number().int().min(0).max(365),
    minDonorBufferDays: z.number().int().min(0).max(30),
    maxTransferArrivalDays: z.number().int().min(1).max(14),
  }).strict(),
  prioritization: z.object({
    source: z.enum(['synthetic_demo', 'approved_local_policy']),
    productWeights: z.record(z.string().min(1).max(80), z.number().positive().max(1000)),
    guidance: z.string().max(2000),
  }).strict(),
}).strict().superRefine((policy, ctx) => {
  if (policy.approvalStatus === 'approved' && (!policy.approvedBy || !policy.approvedAt)) {
    ctx.addIssue({ code: 'custom', message: 'Approved policies require approver and timestamp', path: ['approvalStatus'] });
  }
  if (policy.syntheticDemo && policy.jurisdiction !== 'DEMO') {
    ctx.addIssue({ code: 'custom', message: 'Synthetic demo policy cannot be used for a real jurisdiction', path: ['jurisdiction'] });
  }
  if (!policy.syntheticDemo && policy.approvalStatus === 'approved' && policy.prioritization.source !== 'approved_local_policy') {
    ctx.addIssue({ code: 'custom', message: 'Approved real-country policy must use approved_local_policy weights', path: ['prioritization', 'source'] });
  }
});
export type ClinicalPolicy = z.infer<typeof clinicalPolicySchema>;
export class AllocationGateError extends Error {
  constructor(message: string) { super(message); this.name = 'AllocationGateError'; }
}

export const DEMO_CLINICAL_POLICY: ClinicalPolicy = {
  version: 'demo-safety-v1', jurisdiction: 'DEMO', approvalStatus: 'unapproved', syntheticDemo: true, autonomousExecution: false,
  safety: {
    exactProductOnly: true, excludeExpired: true, excludeQuarantined: true, coldChainRequired: true,
    minRemainingShelfLifeDays: 0, minDonorBufferDays: 0, maxTransferArrivalDays: 14,
  },
  prioritization: { source: 'synthetic_demo', productWeights: {}, guidance: 'Synthetic product weights only; no clinical allocation policy is enabled.' },
};

export function allocationGate(countryCode: string, policy: ClinicalPolicy, dataAuthorized: boolean): { allowed: boolean; reason: string } {
  if (countryCode === 'DEMO' && policy.syntheticDemo) {
    return { allowed: true, reason: 'Synthetic demo with conservative safety constraints; no clinical allocation policy is enabled.' };
  }
  if (!dataAuthorized) return { allowed: false, reason: 'Real-country allocation requires an authorized aggregate data pack. Patient-level records are not accepted.' };
  if (policy.jurisdiction !== countryCode) return { allowed: false, reason: 'Clinical policy jurisdiction does not match the selected country/location.' };
  if (policy.approvalStatus !== 'approved') return { allowed: false, reason: 'Real-country allocation requires a locally approved clinical/safety policy.' };
  return { allowed: true, reason: 'Authorized aggregate data and locally approved policy present. Human approval is still required before any execution.' };
}

export function policyWeight(policy: ClinicalPolicy, productId: string, demoWeight: number): number {
  if (policy.syntheticDemo) return demoWeight;
  const weight = policy.prioritization.productWeights[productId];
  if (weight === undefined) throw new AllocationGateError(`Approved clinical policy is missing a priority weight for product ${productId}`);
  return weight;
}
