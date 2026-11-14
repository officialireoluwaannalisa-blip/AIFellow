import type { Assessment, DatasetManifest, District, Evidence, Facility, Product, QualityReport, ScenarioInput, StoredPlan } from '../shared/types';
export interface Meta {
  country: string; asOf: string; version: string; currency: 'USD'; districts: District[]; facilities: Facility[]; products: Product[];
  manifest: DatasetManifest; quality: QualityReport; defaultScenario: ScenarioInput;
}
export interface RisksResponse { asOf: string; horizonDays: number; total: number; rows: Assessment[] }
export interface PlansResponse { plans: StoredPlan[] }
export interface PlanResponse { plan: StoredPlan }
export interface EvidenceResponse { evidence: (Evidence & { score?: number })[] }
