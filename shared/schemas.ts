import { z } from 'zod';
import { isCountryCode } from './countries';

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD').refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');
const id = z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const count = z.number().int().nonnegative().max(10_000_000);
const positiveCount = z.number().int().positive().max(10_000_000);

export const batchSchema = z.object({ id, quantity: count, expiryDate: isoDate, status: z.enum(['released', 'quarantined']) }).strict();
export const inboundSchema = z.object({ id, quantity: positiveCount, expectedDate: isoDate, expiryDate: isoDate, status: z.enum(['confirmed', 'planned']) }).strict();
export const stockSchema = z.object({
  facilityId: id, productId: id, reportedAt: isoDate, usableUnits: count, quarantinedUnits: count,
  history: z.array(count).max(28), batches: z.array(batchSchema).max(30), inbound: z.array(inboundSchema).max(30),
  leadTimeDays: z.number().int().min(1).max(90),
}).strict();
export const productSchema = z.object({
  id, name: z.string().min(1).max(160), form: z.string().min(1).max(80), unit: z.string().min(1).max(30),
  essential: z.boolean(), coldChain: z.boolean(), unitCostCents: positiveCount,
  minRemainingShelfLifeDays: z.number().int().min(0).max(365), shelfLifeDays: z.number().int().min(30).max(1825),
  priorityWeight: z.number().min(1).max(2),
}).strict();
export const regionSchema = z.object({ id, name: z.string().min(1).max(100) }).strict();
export const districtSchema = z.object({ id, name: z.string().min(1).max(100), regionId: id.optional() }).strict();
export const facilitySchema = z.object({
  id, name: z.string().min(1).max(160), districtId: id, type: z.enum(['hospital', 'health_centre', 'clinic']),
  mapPosition: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).strict().optional(),
}).strict();
export const routeSchema = z.object({
  fromFacilityId: id, toFacilityId: id, days: z.number().int().min(1).max(14), costCents: count,
  coldChainCapable: z.boolean(), sameDistrict: z.boolean(),
}).strict();
export const evidenceSchema = z.object({ id, title: z.string().min(1).max(200), category: z.string().min(1).max(80), text: z.string().min(1).max(4000), source: z.string().min(1).max(200) }).strict();
export const datasetSchema = z.object({
  version: z.string().min(1).max(40), asOf: isoDate, country: z.string().min(1).max(100), countryCode: z.string().max(10).optional(), currency: z.literal('USD'),
  regions: z.array(regionSchema).max(50).optional(),
  districts: z.array(districtSchema).min(1).max(50),
  facilities: z.array(facilitySchema).min(1).max(1000), products: z.array(productSchema).min(1).max(200),
  stocks: z.array(stockSchema).max(50_000), routes: z.array(routeSchema).max(20_000), evidence: z.array(evidenceSchema).max(200),
}).strict().superRefine((data, ctx) => {
  const issue = (message: string, path: (string | number)[]) => ctx.addIssue({ code: 'custom', message, path });
  const unique = (items: { id: string }[], label: string) => {
    if (new Set(items.map((x) => x.id)).size !== items.length) issue(`Duplicate ${label} IDs`, [label]);
  };
  unique(data.districts, 'districts'); unique(data.facilities, 'facilities'); unique(data.products, 'products'); unique(data.evidence, 'evidence');
  if (data.regions) unique(data.regions, 'regions');
  const regionIds = new Set((data.regions ?? []).map((x) => x.id));
  data.districts.forEach((d, i) => { if (d.regionId && !regionIds.has(d.regionId)) issue('Unknown region', ['districts', i, 'regionId']); });
  const districts = new Set(data.districts.map((x) => x.id));
  const facilities = new Map(data.facilities.map((x) => [x.id, x]));
  const products = new Set(data.products.map((x) => x.id));
  data.facilities.forEach((f, i) => { if (!districts.has(f.districtId)) issue('Unknown district', ['facilities', i, 'districtId']); });
  const keys = new Set<string>();
  data.stocks.forEach((s, i) => {
    const key = `${s.facilityId}:${s.productId}`;
    if (keys.has(key)) issue('Duplicate stock observation', ['stocks', i]);
    keys.add(key);
    if (!facilities.has(s.facilityId)) issue('Unknown facility', ['stocks', i, 'facilityId']);
    if (!products.has(s.productId)) issue('Unknown product', ['stocks', i, 'productId']);
    if (new Set(s.batches.map((b) => b.id)).size !== s.batches.length) issue('Duplicate batch IDs', ['stocks', i, 'batches']);
    const released = s.batches.filter((b) => b.status === 'released' && b.expiryDate >= data.asOf).reduce((sum, b) => sum + b.quantity, 0);
    const quarantined = s.batches.filter((b) => b.status === 'quarantined').reduce((sum, b) => sum + b.quantity, 0);
    if (released !== s.usableUnits) issue('Released non-expired batches do not reconcile to usable units', ['stocks', i, 'usableUnits']);
    if (quarantined !== s.quarantinedUnits) issue('Quarantined batches do not reconcile', ['stocks', i, 'quarantinedUnits']);
  });
  const routeKeys = new Set<string>();
  data.routes.forEach((r, i) => {
    const from = facilities.get(r.fromFacilityId); const to = facilities.get(r.toFacilityId);
    if (!from || !to) issue('Unknown route endpoint', ['routes', i]);
    if (r.fromFacilityId === r.toFacilityId) issue('Route endpoints must differ', ['routes', i]);
    if (from && to && r.sameDistrict !== (from.districtId === to.districtId)) issue('Route district flag mismatch', ['routes', i, 'sameDistrict']);
    const key = `${r.fromFacilityId}:${r.toFacilityId}`;
    if (routeKeys.has(key)) issue('Duplicate route', ['routes', i]);
    routeKeys.add(key);
  });
});

export const scenarioSchema = z.object({
  budgetCents: z.number().int().min(0).max(100_000_000),
  horizonDays: z.union([z.literal(14), z.literal(30), z.literal(60)]),
  bufferDays: z.number().int().min(0).max(14),
  districtId: id.nullable(),
  countryCode: z.string().max(10).refine((value) => isCountryCode(value), 'Unknown country/location').optional(),
}).strict();
export const savePlanSchema = z.object({
  name: z.string().trim().min(3).max(100), scenario: scenarioSchema, idempotencyKey: z.uuid(),
}).strict();
export const noteSchema = z.object({ note: z.string().trim().max(500).default('') }).strict();
export const approveSchema = noteSchema;
export const advanceSchema = z.object({ note: z.string().trim().max(500).default(''), expectedStatus: z.enum(['approved', 'procurement_requested', 'funds_released']) }).strict();
export const assistantSchema = z.object({ question: z.string().trim().min(3).max(500), districtId: id.nullable().default(null) }).strict();
export const riskQuerySchema = z.object({
  districtId: z.string().max(80).optional(), productId: z.string().max(80).optional(),
  risk: z.enum(['all', 'critical', 'watch', 'stable', 'unknown']).default('all'),
  q: z.string().max(120).default(''), horizonDays: z.preprocess((value) => value === undefined ? 30 : Number(value), z.union([z.literal(14), z.literal(30), z.literal(60)])),
}).strict();

export const dashboardRoleSchema = z.enum(['leadership', 'supply_chain', 'district', 'facility', 'partner']);
export const dashboardQuerySchema = z.object({
  role: dashboardRoleSchema.default('leadership'),
  countryCode: z.string().max(10).refine(isCountryCode, 'Unknown country/location').optional(),
  regionId: id.nullable().optional(), districtId: id.nullable().optional(), facilityId: id.nullable().optional(), productId: id.nullable().optional(),
  horizonDays: z.preprocess((value) => value === undefined ? 30 : Number(value), z.union([z.literal(30), z.literal(60), z.literal(90)])),
  q: z.string().max(120).default(''),
  budgetCents: z.preprocess((value) => value === undefined ? 2_500_000 : Number(value), z.number().int().min(0).max(100_000_000)),
}).strict();
export const dashboardSupportSchema = z.object({
  role: z.enum(['district', 'facility']), facilityId: id, productId: id.nullable().default(null), referenceId: id.nullable().default(null),
  kind: z.enum(['support', 'discrepancy', 'receipt_confirmation', 'usage_adjustment']),
  note: z.string().trim().min(3).max(500),
}).strict();
export const dashboardNoteSchema = z.object({
  role: z.literal('partner'), countryCode: z.string().max(10).refine(isCountryCode, 'Unknown country/location'),
  note: z.string().trim().min(3).max(1000),
}).strict();
export const dashboardAuditSchema = z.object({
  role: dashboardRoleSchema, action: z.enum(['briefing_exported', 'recommendation_reviewed', 'decision_recorded']),
  scope: z.string().max(200).default(''), note: z.string().trim().max(500).default(''),
}).strict();
