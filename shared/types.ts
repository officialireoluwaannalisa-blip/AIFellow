export type RiskLevel = 'critical' | 'watch' | 'stable' | 'unknown';
export type ItemStatus = 'proposed' | 'approved' | 'procurement_requested' | 'funds_released' | 'received';
export type PlanStatus = 'draft' | 'approved';

export interface District { id: string; name: string }
export interface Facility { id: string; name: string; districtId: string; type: 'hospital' | 'health_centre' | 'clinic' }
export interface Product {
  id: string; name: string; form: string; unit: string; essential: boolean; coldChain: boolean;
  unitCostCents: number; minRemainingShelfLifeDays: number; shelfLifeDays: number; priorityWeight: number;
}
export interface Batch { id: string; quantity: number; expiryDate: string; status: 'released' | 'quarantined' }
export interface Inbound { id: string; quantity: number; expectedDate: string; expiryDate: string; status: 'confirmed' | 'planned' }
export interface Stock {
  facilityId: string; productId: string; reportedAt: string; usableUnits: number; quarantinedUnits: number;
  history: number[]; batches: Batch[]; inbound: Inbound[]; leadTimeDays: number;
}
export interface Route { fromFacilityId: string; toFacilityId: string; days: number; costCents: number; coldChainCapable: boolean; sameDistrict: boolean }
export interface Evidence { id: string; title: string; category: string; text: string; source: string }
export interface Dataset {
  version: string; asOf: string; country: string; currency: 'USD';
  districts: District[]; facilities: Facility[]; products: Product[]; stocks: Stock[]; routes: Route[]; evidence: Evidence[];
}
export interface ScenarioInput { budgetCents: number; horizonDays: 14 | 30 | 60; bufferDays: number; districtId: string | null }
export interface ProjectionPoint { day: number; date: string; stock: number; unmet: number }
export interface Arrival { id: string; date: string; quantity: number; expiryDate: string }
export interface Projection { points: ProjectionPoint[]; firstStockoutDay: number | null; unmetUnits: number; endingStock: number; expiredUnits: number }
export interface Assessment {
  facilityId: string; facilityName: string; districtId: string; districtName: string;
  productId: string; productName: string; unit: string; reportedAt: string; ageDays: number;
  usableUnits: number; quarantinedUnits: number; forecastDaily: number; daysCover: number | null;
  firstStockoutDay: number | null; unmetUnits: number; endingStock: number; expiringSoonUnits: number;
  risk: RiskLevel; urgencyScore: number; needUnits: number; procurementNeedUnits: number; qualityIssues: string[];
  projection: ProjectionPoint[]; targetProjection: ProjectionPoint[]; batches: Batch[]; inbound: Inbound[]; leadTimeDays: number;
}
export interface QualityIssue { severity: 'warning' | 'info'; code: string; facilityId?: string; productId?: string; message: string }
export interface QualityReport {
  recordCount: number; freshCount: number; staleCount: number; shortHistoryCount: number;
  zeroDemandCount: number; unknownCount: number; expiringSoonUnits: number; issues: QualityIssue[];
}
export interface DistrictSummary { id: string; name: string; facilities: number; records: number; critical: number; watch: number; unknown: number }
export interface Overview {
  asOf: string; country: string; version: string; facilityCount: number; productCount: number; recordCount: number;
  knownCount: number; unknownCount: number; criticalCount: number; watchCount: number; stableCount: number;
  projectedStockoutDays: number; expiringSoonUnits: number; reportingCompleteness: number;
  districtSummary: DistrictSummary[]; topRisks: Assessment[]; quality: QualityReport;
}
export interface PlanAction {
  id: string; kind: 'procurement' | 'transfer'; facilityId: string; productId: string;
  donorFacilityId?: string; donorBatchId?: string; donorAllocations?: { batchId: string; quantity: number; expiryDate: string }[]; expiryDate?: string;
  quantity: number; costCents: number; arrivalDays: number; priorityScore: number; rationale: string;
}
export interface UnfundedNeed { facilityId: string; productId: string; quantity: number; estimatedCostCents: number; reason: string }
export interface OutcomeMetrics { stockoutDays: number; unmetUnits: number; atRisk: number }
export interface ScenarioResult {
  scenario: ScenarioInput; datasetVersion: string; datasetHash: string; asOf: string;
  selected: PlanAction[]; unfunded: UnfundedNeed[]; totalCostCents: number; remainingBudgetCents: number;
  before: OutcomeMetrics; after: OutcomeMetrics; assumptions: string[];
}
export interface StoredPlanItem extends PlanAction { status: ItemStatus }
export interface AuditEvent {
  id: string; planId: string; itemId: string | null; action: string; fromStatus: string; toStatus: string;
  actor: string; note: string; createdAt: string;
}
export interface StoredPlan {
  id: string; name: string; status: PlanStatus; scenario: ScenarioInput; result: ScenarioResult;
  items: StoredPlanItem[]; audit: AuditEvent[]; createdAt: string; updatedAt: string;
}
export interface EvidenceCitation { id: string; title: string; source: string }
export interface EvidenceAnswer { mode: 'retrieval'; answer: string; facts: string[]; citations: EvidenceCitation[] }
export interface DatasetManifest {
  version: string; asOf: string; generator: string; seed: number; sourceFile: string; sha256: string;
  counts: Record<string, number>; synthetic: boolean;
}
