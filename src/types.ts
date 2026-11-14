import type { Assessment, DatasetManifest, District, Evidence, Facility, Product, QualityReport, ScenarioInput, StoredPlan } from '../shared/types';
import type { CountryProfile } from '../shared/countries';

export interface ClinicalPolicySummary {
  version: string; jurisdiction: string; approvalStatus: 'unapproved' | 'approved';
  autonomousExecution: false; safetyConstraintsEnforced: true;
  prioritizationSource: 'synthetic_demo' | 'approved_local_policy';
}
export interface Meta {
  country: string; countryCode: string; dataMode: 'synthetic' | 'authorized_aggregate';
  asOf: string; version: string; currency: 'USD'; districts: District[]; facilities: Facility[]; products: Product[];
  manifest: DatasetManifest; quality: QualityReport; defaultScenario: ScenarioInput;
  location: string; clinicalPolicy: ClinicalPolicySummary;
}
export interface CountryConnection extends CountryProfile {
  connectionState: 'authorized_aggregate_active' | 'synthetic_demo_active' | 'not_connected';
  allocationGate: { allowed: boolean; reason: string };
}
export interface CountriesResponse { countries: CountryConnection[] }
export interface LocationResponse { countryCode: string; profile: CountryProfile; allocationGate: { allowed: boolean; reason: string } }
export interface ImportPreviewResponse {
  acceptedRows: number; rejectedRows: number; issues: { path: string; message: string }[];
  quality: QualityReport | null; sha256: string | null;
  country: { code: string; name: string; healthAuthority: string; dataProtection: string } | null;
  activationBlocked?: boolean; activationReason?: string;
}
export interface RisksResponse { asOf: string; horizonDays: number; total: number; rows: Assessment[] }
export interface PlansResponse { plans: StoredPlan[] }
export interface PlanResponse { plan: StoredPlan }
export interface EvidenceResponse { evidence: (Evidence & { score?: number })[] }
