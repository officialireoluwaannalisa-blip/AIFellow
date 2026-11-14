import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDays } from '../shared/domain';
import { datasetSchema } from '../shared/schemas';
import type { Dataset, DatasetManifest, Stock } from '../shared/types';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const asOf = '2026-11-14';
const districts = [
  { id: 'north', name: 'Northern Valley' },
  { id: 'central', name: 'Central Plateau' },
  { id: 'south', name: 'Southern Coast' },
];
const facilityNames = [
  ['Northgate District Hospital', 'Riverbend Health Centre', 'Pine Hills Clinic', 'Lakeside Health Centre', 'Eastfield Clinic', 'Harmony District Hospital'],
  ['Central District Hospital', 'Sunrise Health Centre', 'Green Valley Clinic', 'Hilltop Health Centre', 'Market Road Clinic', 'Unity District Hospital'],
  ['Coastal District Hospital', 'Palm Grove Health Centre', 'Seabreeze Clinic', 'Lagoon Health Centre', 'Southpoint Clinic', 'Bridgeview District Hospital'],
];
const facilities = districts.flatMap((district, di) => facilityNames[di].map((name, fi) => ({
  id: `fac-${di + 1}${fi + 1}`, name, districtId: district.id,
  type: (fi === 0 || fi === 5 ? 'hospital' : fi === 1 || fi === 3 ? 'health_centre' : 'clinic') as 'hospital' | 'health_centre' | 'clinic',
})));
const products = [
  { id: 'med-amox', name: 'Amoxicillin 500 mg', form: 'Capsule', unit: 'capsules', essential: true, coldChain: false, unitCostCents: 8, minRemainingShelfLifeDays: 60, shelfLifeDays: 540, priorityWeight: 1.1 },
  { id: 'med-ors', name: 'Oral rehydration salts', form: 'Sachet', unit: 'sachets', essential: true, coldChain: false, unitCostCents: 12, minRemainingShelfLifeDays: 60, shelfLifeDays: 720, priorityWeight: 1.1 },
  { id: 'med-oxy', name: 'Oxytocin 10 IU/mL', form: 'Injection', unit: 'vials', essential: true, coldChain: true, unitCostCents: 95, minRemainingShelfLifeDays: 90, shelfLifeDays: 365, priorityWeight: 1.2 },
  { id: 'med-act', name: 'Artemether/lumefantrine', form: 'Tablet pack', unit: 'packs', essential: true, coldChain: false, unitCostCents: 180, minRemainingShelfLifeDays: 90, shelfLifeDays: 540, priorityWeight: 1.15 },
  { id: 'med-ins', name: 'Human insulin 100 IU/mL', form: 'Injection', unit: 'vials', essential: true, coldChain: true, unitCostCents: 420, minRemainingShelfLifeDays: 60, shelfLifeDays: 365, priorityWeight: 1.2 },
];
const baseDemand = [45, 30, 8, 22, 6];
const coverPattern = [0, 3, 8, 18, 35, 5, 22, 12, 45, 28, 10];
const stocks: Stock[] = facilities.flatMap((facility, i) => products.map((product, j) => {
  const pattern = (i * 5 + j) % coverPattern.length;
  const base = baseDemand[j] + (i % 5) * 3;
  const history = Array.from({ length: 28 }, (_, d) => Math.max(1, Math.round(base * (1 + 0.1 * Math.sin((d + i) * 0.8)) + (d >= 21 && pattern < 4 ? base * 0.12 : 0))));
  const daily = history.reduce((a, b) => a + b, 0) / history.length;
  let usableUnits = Math.round(daily * coverPattern[pattern]);
  const quarantinedUnits = (i + j) % 9 === 0 ? Math.max(2, Math.round(daily * 0.5)) : 0;
  let reportedAt = addDays(asOf, -(i % 4));
  let finalHistory = history;
  if (i === 4 && j === 2) finalHistory = history.slice(0, 7);
  if (i === 10 && j === 0) reportedAt = addDays(asOf, -12);
  if (i === 15 && j === 4) { finalHistory = Array(28).fill(0) as number[]; usableUnits = 120; }
  const nearExpiry = (i + j) % 6 === 0;
  const firstQty = nearExpiry ? Math.floor(usableUnits * 0.35) : Math.floor(usableUnits * 0.5);
  const batches = [
    { id: `batch-${facility.id}-${product.id}-a`, quantity: firstQty, expiryDate: addDays(asOf, nearExpiry ? 35 + (i % 20) : 150), status: 'released' as const },
    { id: `batch-${facility.id}-${product.id}-b`, quantity: usableUnits - firstQty, expiryDate: addDays(asOf, 260 + (j * 30)), status: 'released' as const },
    ...(quarantinedUnits ? [{ id: `batch-${facility.id}-${product.id}-q`, quantity: quarantinedUnits, expiryDate: addDays(asOf, 200), status: 'quarantined' as const }] : []),
  ];
  const inbound = pattern === 3 || pattern === 6 ? [{ id: `inbound-${facility.id}-${product.id}`, quantity: Math.round(daily * 10), expectedDate: addDays(asOf, 5 + (i % 4)), expiryDate: addDays(asOf, 300), status: 'confirmed' as const }]
    : pattern === 2 ? [{ id: `planned-${facility.id}-${product.id}`, quantity: Math.round(daily * 12), expectedDate: addDays(asOf, 10), expiryDate: addDays(asOf, 320), status: 'planned' as const }] : [];
  return { facilityId: facility.id, productId: product.id, reportedAt, usableUnits, quarantinedUnits, history: finalHistory, batches, inbound, leadTimeDays: 5 + (i % 4) * 3 };
}));
const routes = districts.flatMap((district, di) => {
  const members = facilities.filter((f) => f.districtId === district.id);
  return members.flatMap((from, fi) => members.filter((to) => to.id !== from.id).map((to, ti) => ({
    fromFacilityId: from.id, toFacilityId: to.id, days: 1 + ((fi + ti) % 2),
    costCents: 8000 + ((fi + ti + di) % 5) * 2500, coldChainCapable: (fi + ti + di) % 3 !== 0, sameDistrict: true,
  })));
});
const evidence = [
  { id: 'EV-001', title: 'Triage and human review', category: 'Risk workflow', text: 'Review Critical records first, then Watch records. Treat Unknown as a data-action queue, not as safety. A planner must verify local stock and shipment information before approving an action.', source: 'StockSense illustrative demo guidance' },
  { id: 'EV-002', title: 'Usable stock and FEFO', category: 'Stock accounting', text: 'Only released, non-expired batches count as usable. Project consumption first-expiry-first-out and count only confirmed inbound arrivals. Quarantine and planned shipments require separate review.', source: 'StockSense illustrative demo guidance' },
  { id: 'EV-003', title: 'Budget-aware action planning', category: 'Planning', text: 'Compare feasible actions under an explicit ceiling, keep unfunded needs visible, and record human approval. The demo uses adaptive greedy cost-effectiveness ranking and does not claim global optimality or clinical priority.', source: 'StockSense illustrative demo guidance' },
  { id: 'EV-004', title: 'Redistribution safeguards', category: 'Transfers', text: 'Transfer only the exact product on an explicit feasible route. Preserve donor buffer, check remaining shelf life after arrival, and require cold-chain capability for cold-chain products. Local authorization is mandatory.', source: 'StockSense illustrative demo guidance' },
  { id: 'EV-005', title: 'Data quality and provenance', category: 'Data governance', text: 'Track reporting freshness, consumption-history completeness, dataset version, and checksums. Distinguish missing from zero. Do not use real personal or government data in this demo workspace.', source: 'StockSense illustrative demo guidance' },
  { id: 'EV-006', title: 'AI and automation boundary', category: 'Responsible AI', text: 'This release has no connected LLM. Retrieval answers cite demo evidence and computed facts. Deterministic tools own arithmetic and constraints; no model may autonomously approve expenditure or create clinical instructions.', source: 'StockSense illustrative demo guidance' },
];
const dataset: Dataset = { version: 'synthetic-2026.11.14-v1', asOf, country: 'Demo Republic', countryCode: 'DEMO', currency: 'USD', districts, facilities, products, stocks, routes, evidence };
const parsed = datasetSchema.parse(dataset);
const json = JSON.stringify(parsed, null, 2) + '\n';
const sha256 = createHash('sha256').update(json).digest('hex');
const manifest: DatasetManifest = {
  version: dataset.version, asOf, generator: 'scripts/generate-data.ts', seed: 511e8440,
  sourceFile: 'data/synthetic/seed.json', sha256, synthetic: true,
  counts: { districts: districts.length, facilities: facilities.length, products: products.length, stockRecords: stocks.length, routes: routes.length, evidenceSnippets: evidence.length },
};
mkdirSync(resolve(root, 'data/synthetic'), { recursive: true });
writeFileSync(resolve(root, 'data/synthetic/seed.json'), json);
writeFileSync(resolve(root, 'data/synthetic/manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Generated ${stocks.length} synthetic stock records for ${facilities.length} facilities; SHA-256 ${sha256}`);
