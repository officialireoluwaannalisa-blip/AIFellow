import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { ZodError, z } from 'zod';
import { assessDataset, assessStock, buildOverview, DEFAULT_SCENARIO, qualityReport } from '../shared/domain';
import { answerQuestion, buildBriefing, searchEvidence } from '../shared/evidence';
import { planCsv, risksCsv } from '../shared/export';
import { runScenario } from '../shared/planner';
import { advanceSchema, approveSchema, assistantSchema, riskQuerySchema, savePlanSchema, scenarioSchema } from '../shared/schemas';
import type { Dataset, DatasetManifest } from '../shared/types';
import { ConflictError, NotFoundError, PlanRepository } from './repository';

const idParam = z.string().min(1).max(120);
const scopeQuery = z.object({
  districtId: z.string().max(80).optional(),
  horizonDays: z.preprocess((v) => v === undefined ? 30 : Number(v), z.union([z.literal(14), z.literal(30), z.literal(60)])),
}).strict();

export function createApp(options: { dataset: Dataset; manifest: DatasetManifest; hash: string; repository: PlanRepository }) {
  const { dataset, manifest, hash, repository } = options;
  const app = express();
  app.disable('x-powered-by');
  // Demo is embedded by the Arena live preview. Production must replace this with
  // an explicit CSP frame-ancestors policy and authenticated access controls.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, frameguard: false }));
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use('/api', (req, _res, next) => {
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (!origin) return next();
    try {
      const host = new URL(origin).host;
      const configured = (process.env.ALLOWED_HOSTS ?? '').split(',').map((x) => x.trim()).filter(Boolean);
      if (host === req.get('host') || host.endsWith('.e2b.app') || configured.includes(host)) return next();
    } catch { /* reject malformed origins */ }
    return next(new ConflictError('Cross-origin mutation is not allowed'));
  });
  const assertDistrict = (id: string | null | undefined) => {
    if (id && !dataset.districts.some((d) => d.id === id)) throw new NotFoundError('District not found');
  };
  const assertProduct = (id: string | null | undefined) => {
    if (id && !dataset.products.some((p) => p.id === id)) throw new NotFoundError('Product not found');
  };

  app.get('/api/health', (_req, res) => res.json({ ok: true, demo: true, datasetVersion: dataset.version, asOf: dataset.asOf }));
  app.get('/api/meta', (_req, res) => res.json({
    country: dataset.country, asOf: dataset.asOf, version: dataset.version, currency: dataset.currency,
    districts: dataset.districts, facilities: dataset.facilities, products: dataset.products,
    manifest, quality: qualityReport(dataset), defaultScenario: DEFAULT_SCENARIO,
  }));
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
  app.post('/api/scenarios/preview', (req, res) => {
    const input = scenarioSchema.parse(req.body); assertDistrict(input.districtId);
    res.json(runScenario(dataset, input, hash));
  });
  app.get('/api/plans', (_req, res) => res.json({ plans: repository.listPlans() }));
  app.post('/api/plans', (req, res) => {
    const input = savePlanSchema.parse(req.body); assertDistrict(input.scenario.districtId);
    const result = runScenario(dataset, input.scenario, hash);
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
    res.setHeader('Content-Disposition', 'attachment; filename="stocksense-demo-briefing.md"');
    res.send(buildBriefing(dataset, query.districtId));
  });
  app.get('/api/export/risks.csv', (req, res) => {
    const query = riskQuerySchema.parse(req.query); assertDistrict(query.districtId);
    const rows = assessDataset(dataset, query.horizonDays, DEFAULT_SCENARIO.bufferDays, query.districtId)
      .filter((a) => (!query.productId || a.productId === query.productId) && (query.risk === 'all' || a.risk === query.risk));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="stocksense-synthetic-risks.csv"');
    res.send(risksCsv(rows, dataset.asOf, dataset.version));
  });
  app.get('/api/export/plans/:id.csv', (req, res) => {
    const plan = repository.getPlan(idParam.parse(req.params.id)); if (!plan) throw new NotFoundError('Plan not found');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="stocksense-demo-plan-${plan.id.slice(0, 8)}.csv"`);
    res.send(planCsv(plan));
  });
  app.get('/api/data/manifest', (_req, res) => res.json({ manifest }));
  app.get('/api/data/seed.json', (_req, res) => {
    res.setHeader('Content-Disposition', 'attachment; filename="stocksense-synthetic-seed.json"');
    res.json(dataset);
  });
  app.use('/api', (_req, _res, next) => next(new NotFoundError('API endpoint not found')));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) } });
    if (error instanceof NotFoundError) return res.status(404).json({ error: { code: 'NOT_FOUND', message: error.message } });
    if (error instanceof ConflictError) return res.status(409).json({ error: { code: 'CONFLICT', message: error.message } });
    if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Malformed JSON body' } });
    console.error('Unhandled API error:', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
  });
  return app;
}
