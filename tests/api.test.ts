import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/app';
import { loadDataset } from '../server/data';
import { PlanRepository } from '../server/repository';
import { smallDataset } from './fixtures';

const { dataset, manifest, hash } = loadDataset();
let repository: PlanRepository; let app: ReturnType<typeof createApp>;
beforeEach(() => { repository = new PlanRepository(':memory:'); app = createApp({ dataset, manifest, hash, repository }); });
afterEach(() => repository.close());
const scenario = { budgetCents: 2_500_000, horizonDays: 30, bufferDays: 7, districtId: null };

describe('read API', () => {
  it('reports demo health and verified metadata', async () => {
    const health = await request(app).get('/api/health').expect(200);
    expect(health.body.demo).toBe(true);
    const meta = await request(app).get('/api/meta').expect(200);
    expect(meta.body.manifest.sha256).toBe(hash); expect(meta.body.facilities).toHaveLength(18);
  });
  it('composes product, district, risk, and text filters', async () => {
    const response = await request(app).get('/api/risks').query({ productId: 'med-amox', districtId: 'central', risk: 'critical', q: 'hospital', horizonDays: 14 }).expect(200);
    expect(response.body.rows.length).toBeGreaterThan(0);
    for (const row of response.body.rows) { expect(row.productId).toBe('med-amox'); expect(row.districtId).toBe('central'); expect(row.risk).toBe('critical'); }
  });
  it('validates scenario inputs and unknown scopes', async () => {
    await request(app).post('/api/scenarios/preview').send({ ...scenario, budgetCents: -1 }).expect(400);
    await request(app).post('/api/scenarios/preview').send({ ...scenario, horizonDays: 45 }).expect(400);
    await request(app).post('/api/scenarios/preview').send({ ...scenario, districtId: 'missing' }).expect(404);
    await request(app).get('/api/risks').query({ horizonDays: 'bad' }).expect(400);
  });
  it('exports labeled CSV and a grounded briefing', async () => {
    const csv = await request(app).get('/api/export/risks.csv').expect(200);
    expect(csv.headers['content-type']).toContain('text/csv'); expect(csv.text).toContain('SYNTHETIC DEMO');
    const briefing = await request(app).get('/api/briefing').expect(200);
    expect(briefing.text).toContain('no connected LLM'); expect(briefing.text).toContain('EV-001');
  });
  it('bounds assistant answers and refuses unsupported questions', async () => {
    const answer = await request(app).post('/api/assistant').send({ question: 'Is an LLM connected?' }).expect(200);
    expect(answer.body.mode).toBe('retrieval'); expect(answer.body.answer).toContain('No LLM is connected'); expect(answer.body.citations[0].id).toBe('EV-006');
    const unsupported = await request(app).post('/api/assistant').send({ question: 'What dose should a patient take?' }).expect(200);
    expect(unsupported.body.answer).toContain('cannot answer clinical questions');
  });
  it('rejects cross-origin mutations', async () => {
    await request(app).post('/api/scenarios/preview').set('Origin', 'https://evil.example').send(scenario).expect(409);
  });
  it('exposes country profiles, location gating, and aggregate import preview', async () => {
    const meta = await request(app).get('/api/meta').expect(200);
    expect(meta.body.dataMode).toBe('synthetic'); expect(meta.body.clinicalPolicy.autonomousExecution).toBe(false);
    const countries = await request(app).get('/api/countries').expect(200);
    expect(countries.body.countries.find((c: { code: string }) => c.code === 'NG').connectionState).toBe('not_connected');
    await request(app).put('/api/location').send({ countryCode: 'NG' }).expect(200);
    const blocked = await request(app).post('/api/scenarios/preview').send({ ...scenario, countryCode: 'NG' }).expect(409);
    expect(blocked.body.error.code).toBe('ALLOCATION_BLOCKED');
    const pack = {
      provenance: {
        countryCode: 'NG', sourceName: 'Authorized district aggregate stock extract', sourceSystemId: 'lmis-ng',
        authorizationReference: 'DSA-2026-001', dataUsePurpose: 'District essential-medicines supply planning under signed data-sharing agreement.',
        extractedAt: '2026-11-14T08:00:00Z', observationStart: '2026-10-18', observationEnd: '2026-11-14',
        transformationVersion: 'aggregate-v1', patientLevelData: false, aggregateOnly: true,
      },
      dataset: { ...smallDataset(), countryCode: 'NG', country: 'Nigeria' },
    };
    const preview = await request(app).post('/api/imports/preview').send(pack).expect(200);
    expect(preview.body.acceptedRows).toBe(2); expect(preview.body.activationBlocked).toBe(true);
    const pii = structuredClone(pack);
    (pii.dataset.stocks[0] as unknown as Record<string, unknown>).patient_id = 'P123';
    const rejected = await request(app).post('/api/imports/preview').send(pii).expect(200);
    expect(rejected.body.acceptedRows).toBe(0);
  });
});

describe('plan workflow', () => {
  it('persists snapshots, deduplicates submissions, and audits every transition', async () => {
    const key = randomUUID(); const payload = { name: 'Test district plan', scenario, idempotencyKey: key };
    const saved = await request(app).post('/api/plans').send(payload).expect(201);
    const again = await request(app).post('/api/plans').send(payload).expect(201);
    expect(again.body.plan.id).toBe(saved.body.plan.id);
    const id = saved.body.plan.id; expect(saved.body.plan.items.length).toBeGreaterThan(0);
    expect(saved.body.plan.result.totalCostCents).toBeLessThanOrEqual(scenario.budgetCents);
    expect(saved.body.plan.result.optimization.status).toBe('optimal');
    expect(saved.body.plan.result.clinicalPolicy.autonomousExecution).toBe(false);
    const itemId = saved.body.plan.items[0].id;
    await request(app).post(`/api/plans/${id}/items/${encodeURIComponent(itemId)}/advance`).send({ expectedStatus: 'approved' }).expect(409);
    await request(app).post(`/api/plans/${id}/approve`).send({ note: 'Reviewed synthetic trade-offs.' }).expect(200);
    await request(app).post(`/api/plans/${id}/approve`).send({}).expect(409);
    let status = 'approved';
    for (const next of ['procurement_requested', 'funds_released', 'received']) {
      const response = await request(app).post(`/api/plans/${id}/items/${encodeURIComponent(itemId)}/advance`).send({ expectedStatus: status, note: 'Demo step' }).expect(200);
      expect(response.body.plan.items.find((x: { id: string }) => x.id === itemId).status).toBe(next);
      status = next;
    }
    await request(app).post(`/api/plans/${id}/items/${encodeURIComponent(itemId)}/advance`).send({ expectedStatus: 'funds_released' }).expect(409);
    const fetched = await request(app).get(`/api/plans/${id}`).expect(200);
    expect(fetched.body.plan.audit.some((e: { action: string }) => e.action === 'item_received')).toBe(true);
    expect(fetched.body.plan.audit.every((e: { actor: string }) => e.actor === 'Demo analyst')).toBe(true);
  });
  it('validates plan names and notes', async () => {
    await request(app).post('/api/plans').send({ name: 'x', scenario, idempotencyKey: randomUUID() }).expect(400);
    const saved = await request(app).post('/api/plans').send({ name: 'Valid name', scenario, idempotencyKey: randomUUID() }).expect(201);
    await request(app).post(`/api/plans/${saved.body.plan.id}/approve`).send({ note: 'x'.repeat(501) }).expect(400);
  });
});
