import { createHash } from 'node:crypto';
import { z } from 'zod';
import { isCountryCode, getCountryProfile } from './countries.js';
import { qualityReport } from './domain.js';
import { datasetSchema, isoDate } from './schemas.js';

export const aggregateProvenanceSchema = z.object({
  countryCode: z.string().refine(isCountryCode, 'Unknown country/location'),
  sourceName: z.string().min(3).max(200),
  sourceSystemId: z.string().min(1).max(120),
  sourceUrl: z.string().url().max(500).optional(),
  authorizationReference: z.string().min(3).max(200),
  dataUsePurpose: z.string().min(10).max(500),
  extractedAt: z.string().min(10).max(40),
  observationStart: isoDate,
  observationEnd: isoDate,
  transformationVersion: z.string().min(1).max(40),
  patientLevelData: z.literal(false),
  aggregateOnly: z.literal(true),
}).strict();

export const authorizedAggregatePackSchema = z.object({
  provenance: aggregateProvenanceSchema,
  dataset: datasetSchema,
}).strict().superRefine((pack, ctx) => {
  if (pack.dataset.countryCode !== pack.provenance.countryCode) {
    ctx.addIssue({ code: 'custom', message: 'Dataset countryCode must match provenance countryCode', path: ['dataset', 'countryCode'] });
  }
  if (pack.provenance.observationEnd < pack.provenance.observationStart) {
    ctx.addIssue({ code: 'custom', message: 'observationEnd must be on or after observationStart', path: ['provenance', 'observationEnd'] });
  }
  if (pack.dataset.asOf < pack.provenance.observationEnd) {
    ctx.addIssue({ code: 'custom', message: 'Dataset asOf must be on or after the observation period end', path: ['dataset', 'asOf'] });
  }
});
export type AuthorizedAggregatePack = z.infer<typeof authorizedAggregatePackSchema>;

const forbiddenKey = /(^|_)(patient|client|subject|dob|birth|national_id|nin|bvn|phone|email|address|diagnosis|hiv|pregnan|prescription|encounter|visit|household)(_|$)/i;
const normalizeKey = (key: string) => key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
const forbiddenValue = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b(?:\+?\d[\d -]{8,}\d)\b/i;

export function scanPersonalData(value: unknown, path = 'root'): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return issues;
    if (forbiddenValue.test(value)) issues.push({ path, message: 'Possible direct identifier or contact value is not allowed in aggregate imports.' });
    return issues;
  }
  if (Array.isArray(value)) {
    value.forEach((child, i) => issues.push(...scanPersonalData(child, `${path}[${i}]`)));
    return issues;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenKey.test(normalizeKey(key))) issues.push({ path: `${path}.${key}`, message: 'Patient-level or direct identifier field is not allowed; aggregate only.' });
      issues.push(...scanPersonalData(child, `${path}.${key}`));
    }
  }
  return issues;
}

export function previewAggregateImport(input: unknown) {
  const rawDataset = input && typeof input === 'object' && 'dataset' in input ? (input as { dataset: unknown }).dataset : undefined;
  const earlyPrivacyIssues = rawDataset === undefined ? [] : scanPersonalData(rawDataset, 'dataset');
  if (earlyPrivacyIssues.length) {
    return { acceptedRows: 0, rejectedRows: 0, issues: earlyPrivacyIssues, quality: null, sha256: null, country: null };
  }
  const parsed = authorizedAggregatePackSchema.safeParse(input);
  if (!parsed.success) {
    return {
      acceptedRows: 0, rejectedRows: 0, issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      quality: null, sha256: null, country: null,
    };
  }
  const pack = parsed.data;
  const privacyIssues = scanPersonalData(pack.dataset, 'dataset');
  if (privacyIssues.length) return { acceptedRows: 0, rejectedRows: pack.dataset.stocks.length, issues: privacyIssues, quality: null, sha256: null, country: null };
  const canonical = JSON.stringify(pack);
  const profile = getCountryProfile(pack.provenance.countryCode)!;
  return {
    acceptedRows: pack.dataset.stocks.length,
    rejectedRows: 0,
    issues: [],
    quality: qualityReport(pack.dataset),
    sha256: createHash('sha256').update(canonical).digest('hex'),
    country: { code: profile.code, name: profile.name, healthAuthority: profile.healthAuthority, dataProtection: profile.dataProtection },
    activationBlocked: true,
    activationReason: 'Preview only. Public demo does not activate real-country data. Operator-controlled authorized ingestion and local clinical approval are required.',
  };
}
