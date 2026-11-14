import { describe, expect, it } from 'vitest';
import { addDays, assessStock, forecastDemand, projectStock, qualityReport } from '../shared/domain';
import { csvCell, toCsv } from '../shared/export';
import { datasetSchema } from '../shared/schemas';
import { loadDataset } from '../server/data';
import type { Stock } from '../shared/types';

const { dataset } = loadDataset();
const stock = (overrides: Partial<Stock> = {}): Stock => ({
  facilityId: 'fac-11', productId: 'med-amox', reportedAt: dataset.asOf, usableUnits: 100, quarantinedUnits: 0,
  history: Array(28).fill(10) as number[], leadTimeDays: 5,
  batches: [{ id: 'b1', quantity: 100, expiryDate: addDays(dataset.asOf, 200), status: 'released' }], inbound: [], ...overrides,
});

describe('demand baseline', () => {
  it('uses a capped recent trend', () => {
    const history = [...Array(21).fill(10), ...Array(7).fill(20)] as number[];
    const result = forecastDemand(history);
    expect(result.daily).toBeCloseTo(12.5 * 1.2);
  });
  it('does not invent demand from short or zero history', () => {
    expect(forecastDemand([1, 2, 3]).daily).toBe(0);
    expect(forecastDemand(Array(28).fill(0)).daily).toBe(0);
  });
});

describe('FEFO projection', () => {
  it('consumes the earliest-expiring released batch first and removes expired stock', () => {
    const s = stock({ usableUnits: 30, batches: [
      { id: 'late', quantity: 20, expiryDate: addDays(dataset.asOf, 100), status: 'released' },
      { id: 'early', quantity: 10, expiryDate: addDays(dataset.asOf, 2), status: 'released' },
    ] });
    const result = projectStock(s, dataset.asOf, 4, 10);
    expect(result.points[1].stock).toBe(20);
    expect(result.points[2].stock).toBe(10);
    expect(result.points[3].stock).toBe(0);
    expect(result.expiredUnits).toBe(0);
  });
  it('counts confirmed arrivals only and respects explicit expiry', () => {
    const s = stock({ usableUnits: 0, batches: [{ id: 'b1', quantity: 0, expiryDate: addDays(dataset.asOf, 100), status: 'released' }], inbound: [
      { id: 'confirmed', quantity: 50, expectedDate: addDays(dataset.asOf, 2), expiryDate: addDays(dataset.asOf, 100), status: 'confirmed' },
      { id: 'planned', quantity: 500, expectedDate: addDays(dataset.asOf, 1), expiryDate: addDays(dataset.asOf, 100), status: 'planned' },
    ] });
    const result = projectStock(s, dataset.asOf, 3, 10);
    expect(result.points[1].stock).toBe(0);
    expect(result.points[2].stock).toBe(40);
    expect(result.points[3].stock).toBe(30);
  });
  it('excludes quarantined batches', () => {
    const s = stock({ usableUnits: 0, quarantinedUnits: 100, batches: [{ id: 'q', quantity: 100, expiryDate: addDays(dataset.asOf, 100), status: 'quarantined' }] });
    expect(projectStock(s, dataset.asOf, 2, 10).endingStock).toBe(0);
  });
});

describe('risk and quality gates', () => {
  it('marks stale reports Unknown rather than stable', () => {
    const a = assessStock(dataset, stock({ reportedAt: addDays(dataset.asOf, -12), usableUnits: 1000, batches: [{ id: 'b1', quantity: 1000, expiryDate: addDays(dataset.asOf, 200), status: 'released' }] }));
    expect(a.risk).toBe('unknown'); expect(a.needUnits).toBe(0); expect(a.qualityIssues).toContain('STALE_REPORT');
  });
  it('marks an empty facility critical with day-zero stockout', () => {
    const a = assessStock(dataset, stock({ usableUnits: 0, batches: [{ id: 'b1', quantity: 0, expiryDate: addDays(dataset.asOf, 200), status: 'released' }] }));
    expect(a.risk).toBe('critical'); expect(a.firstStockoutDay).toBe(0); expect(a.urgencyScore).toBe(100);
  });
  it('surfaces the seeded quality examples', () => {
    const report = qualityReport(dataset);
    expect(report.recordCount).toBe(90); expect(report.staleCount).toBe(1); expect(report.shortHistoryCount).toBe(1); expect(report.zeroDemandCount).toBe(1); expect(report.unknownCount).toBe(3);
  });
  it('rejects duplicate stock keys and broken batch reconciliation', () => {
    const duplicate = structuredClone(dataset); duplicate.stocks.push(structuredClone(duplicate.stocks[0]));
    expect(datasetSchema.safeParse(duplicate).success).toBe(false);
    const broken = structuredClone(dataset); broken.stocks[0].usableUnits += 1;
    expect(datasetSchema.safeParse(broken).success).toBe(false);
  });
});

describe('exports', () => {
  it('neutralizes spreadsheet formulas and escapes quotes', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell('+cmd')).toBe('"\'+cmd"');
    expect(toCsv([['a', 'b'], [1, 2]])).toBe('"a","b"\r\n"1","2"\r\n');
  });
});
