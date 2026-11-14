import type { Assessment, StoredPlan } from './types';

export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function toCsv(rows: unknown[][]): string { return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'; }

export function risksCsv(assessments: Assessment[], asOf: string, version: string): string {
  return toCsv([
    ['notice', 'dataset_version', 'as_of', 'district', 'facility_id', 'facility', 'product_id', 'product', 'unit', 'risk', 'usable_units', 'forecast_daily', 'days_cover', 'first_stockout_day', 'unmet_units_30d_or_selected_horizon', 'modeled_gap', 'quality_flags'],
    ...assessments.map((a) => ['SYNTHETIC DEMO — NOT FOR OPERATIONAL USE', version, asOf, a.districtName, a.facilityId, a.facilityName, a.productId, a.productName, a.unit, a.risk, a.usableUnits, a.forecastDaily, a.daysCover ?? '', a.firstStockoutDay ?? '', a.unmetUnits, a.needUnits, a.qualityIssues.join('; ')]),
  ]);
}

export function planCsv(plan: StoredPlan): string {
  return toCsv([
    ['notice', 'plan_id', 'plan_name', 'dataset_version', 'as_of', 'item_id', 'kind', 'donor_facility', 'recipient_facility', 'product', 'quantity', 'cost_usd_cents', 'arrival_days', 'status', 'rationale'],
    ...plan.items.map((item) => ['SYNTHETIC DEMO — NO REAL ORDER OR PAYMENT', plan.id, plan.name, plan.result.datasetVersion, plan.result.asOf, item.id, item.kind, item.donorFacilityId ?? '', item.facilityId, item.productId, item.quantity, item.costCents, item.arrivalDays, item.status, item.rationale]),
  ]);
}
