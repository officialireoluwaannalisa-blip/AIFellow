import type { Assessment, StoredPlan } from './types.js';

export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function toCsv(rows: unknown[][]): string { return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'; }

export function risksCsv(assessments: Assessment[], asOf: string, version: string, synthetic = true): string {
  const notice = synthetic ? 'SYNTHETIC DEMO — NOT FOR OPERATIONAL USE' : 'AUTHORIZED AGGREGATE — NO PATIENT-LEVEL DATA — HUMAN REVIEW REQUIRED';
  return toCsv([
    ['notice', 'dataset_version', 'as_of', 'district', 'facility_id', 'facility', 'product_id', 'product', 'unit', 'risk', 'usable_units', 'forecast_daily', 'days_cover', 'first_stockout_day', 'unmet_units_30d_or_selected_horizon', 'modeled_gap', 'quality_flags'],
    ...assessments.map((a) => [notice, version, asOf, a.districtName, a.facilityId, a.facilityName, a.productId, a.productName, a.unit, a.risk, a.usableUnits, a.forecastDaily, a.daysCover ?? '', a.firstStockoutDay ?? '', a.unmetUnits, a.needUnits, a.qualityIssues.join('; ')]),
  ]);
}

export function planCsv(plan: StoredPlan, synthetic = true): string {
  const notice = synthetic ? 'SYNTHETIC DEMO — NO REAL ORDER OR PAYMENT' : 'AUTHORIZED AGGREGATE — NO AUTONOMOUS EXECUTION — HUMAN REVIEW REQUIRED';
  return toCsv([
    ['notice', 'plan_id', 'plan_name', 'dataset_version', 'as_of', 'item_id', 'kind', 'donor_facility', 'recipient_facility', 'product', 'quantity', 'cost_usd_cents', 'arrival_days', 'status', 'rationale', 'optimizer_status', 'optimizer_gap', 'clinical_policy_status'],
    ...plan.items.map((item) => [notice, plan.id, plan.name, plan.result.datasetVersion, plan.result.asOf, item.id, item.kind, item.donorFacilityId ?? '', item.facilityId, item.productId, item.quantity, item.costCents, item.arrivalDays, item.status, item.rationale, plan.result.optimization?.status ?? 'legacy', plan.result.optimization?.relativeGap ?? '', plan.result.clinicalPolicy?.approvalStatus ?? 'legacy']),
  ]);
}
