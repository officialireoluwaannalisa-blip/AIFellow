import type { Arrival, Assessment, Dataset, Overview, Projection, QualityReport, RiskLevel, ScenarioInput, Stock } from './types';

export const DAY_MS = 86_400_000;
export const DEFAULT_SCENARIO: ScenarioInput = { budgetCents: 2_500_000, horizonDays: 30, bufferDays: 7, districtId: null };
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export const round = (value: number, digits = 1) => Number(value.toFixed(digits));
export const dateAt = (value: string) => new Date(`${value}T00:00:00Z`);
export const addDays = (value: string, days: number) => new Date(dateAt(value).getTime() + days * DAY_MS).toISOString().slice(0, 10);
export const diffDays = (later: string, earlier: string) => Math.round((dateAt(later).getTime() - dateAt(earlier).getTime()) / DAY_MS);
export const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
export const stockKey = (facilityId: string, productId: string) => `${facilityId}:${productId}`;

export function forecastDemand(history: number[]): { daily: number; method: string } {
  const m28 = mean(history);
  if (history.length < 14 || m28 <= 0) return { daily: 0, method: 'Insufficient consumption history' };
  const recent = history.slice(-7);
  const previous = history.slice(0, -7);
  const m7 = mean(recent); const m21 = mean(previous);
  if (m7 > 0 && m21 > 0) return { daily: m28 * clamp(m7 / m21, 0.8, 1.2), method: '28-day mean × capped recent trend' };
  return { daily: m28, method: '28-day mean (no trend adjustment)' };
}

export function projectStock(stock: Stock, asOf: string, days: number, dailyDemand: number, extraArrivals: Arrival[] = []): Projection {
  const batches = stock.batches.filter((b) => b.status === 'released' && b.expiryDate >= asOf && b.quantity > 0)
    .map((b) => ({ ...b })).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.id.localeCompare(b.id));
  const arrivals = [
    ...stock.inbound.filter((x) => x.status === 'confirmed').map((x) => ({ id: x.id, date: x.expectedDate, quantity: x.quantity, expiryDate: x.expiryDate })),
    ...extraArrivals,
  ];
  const demand = Math.max(0, Math.round(dailyDemand));
  const total = () => batches.reduce((sum, b) => sum + b.quantity, 0);
  let firstStockoutDay: number | null = total() === 0 ? 0 : null;
  let unmetUnits = 0; let expiredUnits = 0;
  const points = [{ day: 0, date: asOf, stock: total(), unmet: 0 }];
  for (let day = 1; day <= days; day++) {
    const date = addDays(asOf, day);
    for (const arrival of arrivals.filter((a) => a.date === date)) {
      batches.push({ id: arrival.id, quantity: arrival.quantity, expiryDate: arrival.expiryDate, status: 'released' });
    }
    batches.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.id.localeCompare(b.id));
    for (const batch of batches) {
      if (batch.expiryDate < date) { expiredUnits += batch.quantity; batch.quantity = 0; }
    }
    let remaining = demand;
    for (const batch of batches) {
      if (batch.expiryDate < date || remaining === 0) continue;
      const used = Math.min(batch.quantity, remaining); batch.quantity -= used; remaining -= used;
    }
    unmetUnits += remaining;
    const ending = total();
    if (firstStockoutDay === null && (remaining > 0 || ending === 0)) firstStockoutDay = day;
    points.push({ day, date, stock: ending, unmet: remaining });
  }
  return { points, firstStockoutDay, unmetUnits, endingStock: total(), expiredUnits };
}

export function qualityFlags(stock: Stock, asOf: string): string[] {
  const flags: string[] = [];
  if (diffDays(asOf, stock.reportedAt) > 7) flags.push('STALE_REPORT');
  if (stock.history.length < 14) flags.push('SHORT_HISTORY');
  if (stock.history.length > 0 && stock.history.reduce((a, b) => a + b, 0) === 0) flags.push('ZERO_DEMAND');
  if (stock.batches.some((b) => b.status === 'released' && b.expiryDate >= asOf && diffDays(b.expiryDate, asOf) <= 60)) flags.push('EXPIRING_SOON');
  if (stock.inbound.some((b) => b.status === 'planned')) flags.push('PLANNED_INBOUND');
  return flags;
}

export function assessStock(dataset: Dataset, stock: Stock, horizonDays = 30, bufferDays = 7): Assessment {
  const facility = dataset.facilities.find((f) => f.id === stock.facilityId)!;
  const product = dataset.products.find((p) => p.id === stock.productId)!;
  const district = dataset.districts.find((d) => d.id === facility.districtId)!;
  const flags = qualityFlags(stock, dataset.asOf);
  const ageDays = diffDays(dataset.asOf, stock.reportedAt);
  const { daily } = forecastDemand(stock.history);
  const unknown = ageDays > 7 || stock.history.length < 14 || daily <= 0;
  const targetDays = horizonDays + bufferDays;
  const projection = projectStock(stock, dataset.asOf, targetDays, daily);
  const horizonPoints = projection.points.slice(1, horizonDays + 1);
  const unmetUnits = horizonPoints.reduce((sum, p) => sum + p.unmet, 0);
  const endingStock = projection.points[horizonDays]?.stock ?? projection.endingStock;
  const firstInHorizon = projection.firstStockoutDay !== null && projection.firstStockoutDay <= horizonDays ? projection.firstStockoutDay : null;
  const daysCover = daily > 0 ? round(stock.usableUnits / daily) : null;
  const effectiveCover = Math.min(daysCover ?? targetDays + 1, firstInHorizon ?? targetDays + 1);
  let risk: RiskLevel = 'stable';
  if (unknown) risk = 'unknown';
  else if (effectiveCover < 7) risk = 'critical';
  else if (effectiveCover < horizonDays) risk = 'watch';
  const urgencyScore = unknown ? 0 : Math.round(100 * clamp(1 - effectiveCover / targetDays, 0, 1));
  const safetyTarget = daily * bufferDays;
  const needUnits = unknown ? 0 : Math.max(0, Math.ceil(projection.unmetUnits + Math.max(0, safetyTarget - projection.endingStock)));
  const unmetAfterLead = projection.points.filter((p) => p.day > stock.leadTimeDays).reduce((sum, p) => sum + p.unmet, 0);
  const procurementNeedUnits = unknown || stock.leadTimeDays >= targetDays ? 0 : Math.max(0, Math.ceil(unmetAfterLead + Math.max(0, safetyTarget - projection.endingStock)));
  const expiringSoonUnits = stock.batches.filter((b) => b.status === 'released' && b.expiryDate >= dataset.asOf && diffDays(b.expiryDate, dataset.asOf) <= 60).reduce((sum, b) => sum + b.quantity, 0);
  return {
    facilityId: facility.id, facilityName: facility.name, districtId: district.id, districtName: district.name,
    productId: product.id, productName: product.name, unit: product.unit, reportedAt: stock.reportedAt, ageDays,
    usableUnits: stock.usableUnits, quarantinedUnits: stock.quarantinedUnits, forecastDaily: round(daily), daysCover,
    firstStockoutDay: firstInHorizon, unmetUnits, endingStock, expiringSoonUnits, risk, urgencyScore, needUnits, procurementNeedUnits,
    qualityIssues: flags, projection: projection.points.slice(0, horizonDays + 1), targetProjection: projection.points, batches: stock.batches,
    inbound: stock.inbound, leadTimeDays: stock.leadTimeDays,
  };
}

export function assessDataset(dataset: Dataset, horizonDays = 30, bufferDays = 7, districtId?: string | null): Assessment[] {
  const facilities = new Map(dataset.facilities.map((f) => [f.id, f]));
  return dataset.stocks.filter((s) => !districtId || facilities.get(s.facilityId)?.districtId === districtId)
    .map((s) => assessStock(dataset, s, horizonDays, bufferDays))
    .sort((a, b) => b.urgencyScore - a.urgencyScore || a.facilityName.localeCompare(b.facilityName) || a.productId.localeCompare(b.productId));
}

export function qualityReport(dataset: Dataset, horizonDays = 30, districtId?: string | null): QualityReport {
  const assessments = assessDataset(dataset, horizonDays, DEFAULT_SCENARIO.bufferDays, districtId);
  const issues: QualityReport['issues'] = [];
  const labels: Record<string, string> = {
    STALE_REPORT: 'Report is older than 7 days; risk is Unknown until refreshed.',
    SHORT_HISTORY: 'Fewer than 14 consumption observations; demand cannot be estimated reliably.',
    ZERO_DEMAND: 'Zero recorded consumption; verify whether this means no demand or missing data.',
    EXPIRING_SOON: 'Released batch expires within 60 days; review FEFO and redistribution options.',
    PLANNED_INBOUND: 'Planned shipment is not confirmed and is excluded from the projection.',
  };
  for (const a of assessments) for (const code of a.qualityIssues) issues.push({ severity: code === 'EXPIRING_SOON' || code === 'PLANNED_INBOUND' ? 'info' : 'warning', code, facilityId: a.facilityId, productId: a.productId, message: `${a.facilityName} · ${a.productName}: ${labels[code]}` });
  return {
    recordCount: assessments.length,
    freshCount: assessments.filter((a) => a.ageDays <= 7).length,
    staleCount: assessments.filter((a) => a.ageDays > 7).length,
    shortHistoryCount: assessments.filter((a) => a.qualityIssues.includes('SHORT_HISTORY')).length,
    zeroDemandCount: assessments.filter((a) => a.qualityIssues.includes('ZERO_DEMAND')).length,
    unknownCount: assessments.filter((a) => a.risk === 'unknown').length,
    expiringSoonUnits: assessments.reduce((sum, a) => sum + a.expiringSoonUnits, 0), issues,
  };
}

export function buildOverview(dataset: Dataset, horizonDays = 30, districtId?: string | null): Overview {
  const assessments = assessDataset(dataset, horizonDays, DEFAULT_SCENARIO.bufferDays, districtId);
  const quality = qualityReport(dataset, horizonDays, districtId);
  const facilities = dataset.facilities.filter((f) => !districtId || f.districtId === districtId);
  return {
    asOf: dataset.asOf, country: dataset.country, version: dataset.version,
    facilityCount: facilities.length, productCount: dataset.products.length, recordCount: assessments.length,
    knownCount: assessments.filter((a) => a.risk !== 'unknown').length,
    unknownCount: assessments.filter((a) => a.risk === 'unknown').length,
    criticalCount: assessments.filter((a) => a.risk === 'critical').length,
    watchCount: assessments.filter((a) => a.risk === 'watch').length,
    stableCount: assessments.filter((a) => a.risk === 'stable').length,
    projectedStockoutDays: assessments.reduce((sum, a) => sum + a.projection.filter((p) => p.day > 0 && (p.stock === 0 || p.unmet > 0)).length, 0),
    expiringSoonUnits: assessments.reduce((sum, a) => sum + a.expiringSoonUnits, 0),
    reportingCompleteness: assessments.length ? Math.round(100 * assessments.filter((a) => a.ageDays <= 7).length / assessments.length) : 0,
    districtSummary: dataset.districts.filter((d) => !districtId || d.id === districtId).map((d) => {
      const rows = assessments.filter((a) => a.districtId === d.id);
      return { id: d.id, name: d.name, facilities: dataset.facilities.filter((f) => f.districtId === d.id).length, records: rows.length, critical: rows.filter((a) => a.risk === 'critical').length, watch: rows.filter((a) => a.risk === 'watch').length, unknown: rows.filter((a) => a.risk === 'unknown').length };
    }),
    topRisks: assessments.filter((a) => a.risk === 'critical' || a.risk === 'watch').slice(0, 6), quality,
  };
}

export function outcomeMetrics(assessments: Assessment[]): { stockoutDays: number; unmetUnits: number; atRisk: number } {
  return {
    stockoutDays: assessments.reduce((sum, a) => sum + a.projection.filter((p) => p.day > 0 && (p.stock === 0 || p.unmet > 0)).length, 0),
    unmetUnits: assessments.reduce((sum, a) => sum + a.unmetUnits, 0),
    atRisk: assessments.filter((a) => a.risk === 'critical' || a.risk === 'watch').length,
  };
}
