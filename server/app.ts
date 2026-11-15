import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { ZodError, z } from 'zod';
import { AllocationGateError, allocationGate, DEMO_CLINICAL_POLICY, type ClinicalPolicy } from '../shared/clinical-policy.js';
import { COUNTRY_PROFILES, getCountryProfile, isCountryCode } from '../shared/countries.js';
import { assessDataset, assessStock, buildOverview, DEFAULT_SCENARIO, qualityReport } from '../shared/domain.js';
import { answerQuestion, buildBriefing, searchEvidence } from '../shared/evidence.js';
import { planCsv, risksCsv } from '../shared/export.js';
import { previewAggregateImport } from '../shared/imports.js';
import { runScenario } from '../shared/planner.js';
import { buildDashboard, dashboardRegions, dashboardScenario, resolveDashboardFilters, type DashboardFilters } from '../shared/dashboard.js';
import { advanceSchema, approveSchema, assistantSchema, dashboardAuditSchema, dashboardNoteSchema, dashboardQuerySchema, dashboardSupportSchema, riskQuerySchema, savePlanSchema, scenarioSchema } from '../shared/schemas.js';
import type { Dataset, DatasetManifest } from '../shared/types.js';
import { ConflictError, NotFoundError, PlanRepository } from './repository.js';

const idParam = z.string().min(1).max(120);
const scopeQuery = z.object({
  districtId: z.string().max(80).optional(),
  horizonDays: z.preprocess((v) => v === undefined ? 30 : Number(v), z.union([z.literal(14), z.literal(30), z.literal(60)])),
}).strict();
const locationSchema = z.object({ countryCode: z.string().refine(isCountryCode, 'Unknown country/location') }).strict();

class RoleScopeError extends Error { constructor(message: string) { super(message); this.name = 'RoleScopeError'; } }

export function createApp(options: {
  dataset: Dataset; manifest: DatasetManifest; hash: string; repository: PlanRepository;
  policy?: ClinicalPolicy; dataAuthorized?: boolean; storageMode?: 'persistent' | 'ephemeral';
}) {
  const { dataset, manifest, hash, repository } = options;
  const policy = options.policy ?? DEMO_CLINICAL_POLICY;
  const dataAuthorized = options.dataAuthorized ?? false;
  const storageMode = options.storageMode ?? 'persistent';
  const storage = {
    mode: storageMode,
    note: storageMode === 'ephemeral'
      ? 'Hosted demo storage is temporary. Saved plans, notes, and audit history may reset between requests or instances.'
      : 'Demo workflow state is stored in the configured local SQLite database.',
  };
  const dataMode = manifest.synthetic ? 'synthetic' : 'authorized_aggregate';
  const datasetCountry = dataset.countryCode ?? 'DEMO';
  const app = express();
  app.disable('x-powered-by');
  // Demo is embedded by the Arena live preview. Production must replace this with
  // an explicit CSP frame-ancestors policy and authenticated access controls.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, frameguard: false }));
  app.use('/api/imports/preview', express.json({ limit: '2mb' }));
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api', (req, _res, next) => {
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (!origin) return next();
    try {
      const host = new URL(origin).host;
      const configured = (process.env.ALLOWED_HOSTS ?? '').split(',').map((x) => x.trim()).filter(Boolean);
      const forwardedHost = process.env.VERCEL === '1' ? req.get('x-forwarded-host')?.split(',')[0]?.trim() : undefined;
      if (host === req.get('host') || host === forwardedHost || host === process.env.VERCEL_URL || host.endsWith('.e2b.app') || configured.includes(host)) return next();
    } catch { /* reject malformed origins */ }
    return next(new ConflictError('Cross-origin mutation is not allowed'));
  });
  const assertDistrict = (id: string | null | undefined) => {
    if (id && !dataset.districts.some((d) => d.id === id)) throw new NotFoundError('District not found');
  };
  const assertProduct = (id: string | null | undefined) => {
    if (id && !dataset.products.some((p) => p.id === id)) throw new NotFoundError('Product not found');
  };
  const activeLocation = () => repository.getSetting('countryCode') ?? datasetCountry;
  const policySummary = () => ({
    version: policy.version, jurisdiction: policy.jurisdiction, approvalStatus: policy.approvalStatus,
    autonomousExecution: false as const, safetyConstraintsEnforced: true as const,
    prioritizationSource: policy.prioritization.source,
  });
  const scenarioCache = new Map<string, ReturnType<typeof dashboardScenario>>();
  const cachedDashboardScenario = (filters: DashboardFilters) => {
    const resolved = resolveDashboardFilters(dataset, filters);
    const key = JSON.stringify([hash, policy.version, dataAuthorized, resolved.countryCode, resolved.districtId, resolved.facilityId, resolved.budgetCents, resolved.horizonDays]);
    let entry = scenarioCache.get(key);
    if (!entry) {
      entry = dashboardScenario(dataset, hash, resolved, policy, dataAuthorized);
      scenarioCache.set(key, entry);
      if (scenarioCache.size > 24) scenarioCache.delete(scenarioCache.keys().next().value as string);
      void entry.catch(() => scenarioCache.delete(key));
    }
    return entry;
  };
  const assertDashboardScope = (filters: DashboardFilters) => {
    if (filters.regionId && !dashboardRegions(dataset).some((r) => r.id === filters.regionId)) throw new NotFoundError('Region not found');
    assertDistrict(filters.districtId); assertProduct(filters.productId);
    if (filters.facilityId && !dataset.facilities.some((f) => f.id === filters.facilityId)) throw new NotFoundError('Facility not found');
    if (filters.countryCode && filters.countryCode !== datasetCountry) throw new RoleScopeError('Selected country does not match the active dataset. Connect an authorized aggregate pack first.');
  };

  app.get('/api/health', (_req, res) => res.json({ ok: true, demo: manifest.synthetic, dataMode, countryCode: datasetCountry, datasetVersion: dataset.version, asOf: dataset.asOf, storage }));
  app.get('/api/meta', (_req, res) => res.json({
    country: dataset.country, countryCode: datasetCountry, dataMode, asOf: dataset.asOf, version: dataset.version, currency: dataset.currency,
    districts: dataset.districts, facilities: dataset.facilities, products: dataset.products,
    manifest, quality: qualityReport(dataset), defaultScenario: { ...DEFAULT_SCENARIO, countryCode: activeLocation() },
    location: activeLocation(), clinicalPolicy: policySummary(), storage,
  }));
  app.get('/api/countries', (_req, res) => res.json({
    countries: COUNTRY_PROFILES.map((profile) => ({
      ...profile,
      connectionState: profile.code === datasetCountry && dataAuthorized ? 'authorized_aggregate_active'
        : profile.code === 'DEMO' && manifest.synthetic ? 'synthetic_demo_active' : 'not_connected',
      allocationGate: allocationGate(profile.code, policy, dataAuthorized && profile.code === datasetCountry),
    })),
  }));
  app.get('/api/location', (_req, res) => {
    const code = activeLocation(); const profile = getCountryProfile(code)!;
    res.json({ countryCode: code, profile, allocationGate: allocationGate(code, policy, dataAuthorized && code === datasetCountry) });
  });
  app.put('/api/location', (req, res) => {
    const input = locationSchema.parse(req.body); repository.setSetting('countryCode', input.countryCode);
    const profile = getCountryProfile(input.countryCode)!;
    res.json({ countryCode: input.countryCode, profile, allocationGate: allocationGate(input.countryCode, policy, dataAuthorized && input.countryCode === datasetCountry) });
  });
  app.post('/api/imports/preview', (req, res) => res.json(previewAggregateImport(req.body)));
  app.get('/api/dashboard', async (req, res) => {
    const query = dashboardQuerySchema.parse(req.query);
    const filters = resolveDashboardFilters(dataset, query as DashboardFilters);
    assertDashboardScope(filters);
    const { scenario, gateReason } = await cachedDashboardScenario(filters);
    const data = buildDashboard({
      dataset, hash, filters, plans: repository.listPlans(), supportRequests: repository.listSupportRequests(),
      notes: repository.listNotes(), audit: repository.listDashboardAudit(), policy, dataAuthorized, scenario, gateReason,
    });
    res.setHeader('X-Dashboard-Role', filters.role);
    res.json(data);
  });
  app.post('/api/dashboard/support', (req, res) => {
    const input = dashboardSupportSchema.parse(req.body);
    const facility = dataset.facilities.find((f) => f.id === input.facilityId);
    if (!facility) throw new NotFoundError('Facility not found');
    if (input.productId) assertProduct(input.productId);
    if (input.role === 'facility' && input.kind === 'receipt_confirmation' && !input.referenceId) throw new RoleScopeError('Receipt confirmation requires a delivery reference.');
    const request = repository.addSupportRequest({ ...input, actor: `Demo ${input.role} user` });
    res.status(201).json({ request });
  });
  app.post('/api/dashboard/notes', (req, res) => {
    const input = dashboardNoteSchema.parse(req.body);
    if (input.countryCode !== datasetCountry) throw new RoleScopeError('Notes are limited to the active country dataset.');
    res.status(201).json({ note: repository.addNote({ ...input, actor: 'Demo partner user' }) });
  });
  app.post('/api/dashboard/audit', (req, res) => {
    const input = dashboardAuditSchema.parse(req.body);
    res.status(201).json({ event: repository.addDashboardAudit({ ...input, actor: `Demo ${input.role} user` }) });
  });
  app.get('/api/dashboard/briefing', async (req, res) => {
    const query = dashboardQuerySchema.parse(req.query);
    const filters = resolveDashboardFilters(dataset, query as DashboardFilters);
    assertDashboardScope(filters);
    if (filters.role !== 'leadership' && filters.role !== 'supply_chain' && filters.role !== 'partner') throw new RoleScopeError('This role cannot export a briefing.');
    const { scenario, gateReason } = await cachedDashboardScenario(filters);
    const data = buildDashboard({ dataset, hash, filters, plans: repository.listPlans(), supportRequests: repository.listSupportRequests(), notes: repository.listNotes(), audit: repository.listDashboardAudit(), policy, dataAuthorized, scenario, gateReason });
    repository.addDashboardAudit({ role: filters.role, action: 'briefing_exported', scope: data.summary.scopeLabel, note: 'Dashboard briefing exported.', actor: `Demo ${filters.role} user` });
    const lines = [
      `# StockSense dashboard briefing — ${data.summary.scopeLabel}`,
      '', `Data mode: ${manifest.synthetic ? 'SYNTHETIC DEMO' : 'authorized aggregate'} · As of ${data.summary.asOf} · Role view: ${filters.role}`,
      '', '## Summary',
      `- Medicine availability (known records with usable stock): ${data.summary.availabilityPct}%`,
      `- Critical records: ${data.summary.criticalCount}; Watch: ${data.summary.watchCount}; Unknown: ${data.summary.unknownCount}`,
      `- Budget ceiling: ${(data.summary.budgetCeilingCents / 100).toFixed(2)} USD; planned interventions: ${(data.summary.plannedCostCents / 100).toFixed(2)} USD`,
      '', '## Recommended interventions',
      ...data.interventions.map((a, i) => `${i + 1}. ${a.productName} → ${a.facilityName}: ${a.quantity} ${a.unit}, ${(a.costCents / 100).toFixed(2)} USD. Why: ${a.why}`),
      '', '## Bottlenecks', ...data.bottlenecks.map((b) => `- ${b.title}: ${b.detail}`),
      '', '## Boundaries',
      '- Role views are a demo simulation, not authenticated access control.',
      '- Recommendations require human review; no autonomous procurement, payment, or clinical execution.',
      '- Forecasts are deterministic projections on the active snapshot, not measured real-world outcomes.',
      gateReason ? `- Allocation gate: ${gateReason}` : '- Allocation gate: passed for the active dataset.',
    ];
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="stocksense-dashboard-${manifest.synthetic ? 'demo' : 'authorized'}-${filters.role}.md"`);
    res.send(lines.join('\n') + '\n');
  });
  app.get('/api/overview', (req, res) => {
    const query = scopeQuery.parse(req.query); assertDistrict(query.districtId);
    res.json(buildOverview(dataset, query.horizonDays, query.districtId));
  });
  app.get('/api/risks', (req, res) => {
    const query = riskQuerySchema.parse(req.query); assertDistrict(query.districtId); assertProduct(query.productId);
    const q = query.q.toLowerCase();
    const rows = assessDataset(dataset, query.horizonDays, DEFAULT_SCENARIO.bufferDays, query.districtId)
      .filter((a) => (!query.productId || a.productId === query.productId) && (query.risk === 'all' || a.risk === query.risk)
        && (!q || `${a.facilityName} ${a.productName} ${a.districtName}`.toLowerCase().includes(q)));
    res.json({ asOf: dataset.asOf, horizonDays: query.horizonDays, total: rows.length, rows });
  });
  app.get('/api/risks/:facilityId/:productId', (req, res) => {
    const facilityId = idParam.parse(req.params.facilityId); const productId = idParam.parse(req.params.productId);
    const stock = dataset.stocks.find((s) => s.facilityId === facilityId && s.productId === productId);
    if (!stock) throw new NotFoundError('Stock record not found');
    res.json(assessStock(dataset, stock));
  });
  app.post('/api/scenarios/preview', async (req, res) => {
    const input = scenarioSchema.parse(req.body); assertDistrict(input.districtId);
    res.json(await runScenario(dataset, input, hash, policy, dataAuthorized));
  });
  app.get('/api/plans', (_req, res) => res.json({ plans: repository.listPlans() }));
  app.post('/api/plans', async (req, res) => {
    const input = savePlanSchema.parse(req.body); assertDistrict(input.scenario.districtId);
    const result = await runScenario(dataset, input.scenario, hash, policy, dataAuthorized);
    const plan = repository.createPlan(input.name, input.scenario, result, input.idempotencyKey);
    res.status(201).json({ plan });
  });
  app.get('/api/plans/:id', (req, res) => {
    const plan = repository.getPlan(idParam.parse(req.params.id)); if (!plan) throw new NotFoundError('Plan not found'); res.json({ plan });
  });
  app.post('/api/plans/:id/approve', (req, res) => {
    const input = approveSchema.parse(req.body ?? {});
    res.json({ plan: repository.approvePlan(idParam.parse(req.params.id), input.note) });
  });
  app.post('/api/plans/:id/items/:itemId/advance', (req, res) => {
    const input = advanceSchema.parse(req.body);
    res.json({ plan: repository.advanceItem(idParam.parse(req.params.id), idParam.parse(req.params.itemId), input.expectedStatus, input.note) });
  });
  app.get('/api/evidence', (req, res) => {
    const query = z.object({ q: z.string().max(200).default('') }).strict().parse(req.query);
    res.json({ evidence: searchEvidence(dataset, query.q) });
  });
  app.post('/api/assistant', (req, res) => {
    const input = assistantSchema.parse(req.body); assertDistrict(input.districtId);
    res.json(answerQuestion(dataset, input.question, input.districtId));
  });
  app.get('/api/briefing', (req, res) => {
    const query = z.object({ districtId: z.string().max(80).optional() }).strict().parse(req.query); assertDistrict(query.districtId);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="stocksense-${manifest.synthetic ? 'demo' : 'authorized-aggregate'}-briefing.md"`);
    res.send(buildBriefing(dataset, query.districtId));
  });
  app.get('/api/export/risks.csv', (req, res) => {
    const query = riskQuerySchema.parse(req.query); assertDistrict(query.districtId);
    const rows = assessDataset(dataset, query.horizonDays, DEFAULT_SCENARIO.bufferDays, query.districtId)
      .filter((a) => (!query.productId || a.productId === query.productId) && (query.risk === 'all' || a.risk === query.risk));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="stocksense-${manifest.synthetic ? 'synthetic' : 'authorized-aggregate'}-risks.csv"`);
    res.send(risksCsv(rows, dataset.asOf, dataset.version, manifest.synthetic));
  });
  app.get('/api/export/plans/:id.csv', (req, res) => {
    const plan = repository.getPlan(idParam.parse(req.params.id)); if (!plan) throw new NotFoundError('Plan not found');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="stocksense-${manifest.synthetic ? 'demo' : 'authorized-aggregate'}-plan-${plan.id.slice(0, 8)}.csv"`);
    res.send(planCsv(plan, manifest.synthetic));
  });
  app.get('/api/data/manifest', (_req, res) => res.json({ manifest }));
  app.get('/api/data/seed.json', (_req, res) => {
    res.setHeader('Content-Disposition', `attachment; filename="stocksense-${manifest.synthetic ? 'synthetic-seed' : 'authorized-aggregate'}.json"`);
    res.json(dataset);
  });
  app.use('/api', (_req, _res, next) => next(new NotFoundError('API endpoint not found')));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) } });
    if (error instanceof AllocationGateError) return res.status(409).json({ error: { code: 'ALLOCATION_BLOCKED', message: error.message } });
    if (error instanceof RoleScopeError) return res.status(403).json({ error: { code: 'ROLE_SCOPE', message: error.message } });
    if (error instanceof NotFoundError) return res.status(404).json({ error: { code: 'NOT_FOUND', message: error.message } });
    if (error instanceof ConflictError) return res.status(409).json({ error: { code: 'CONFLICT', message: error.message } });
    if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Malformed JSON body' } });
    console.error('Unhandled API error:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  });
  return app;
}
