import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEMO_CLINICAL_POLICY, clinicalPolicySchema, type ClinicalPolicy } from '../shared/clinical-policy';
import { getCountryProfile } from '../shared/countries';
import { authorizedAggregatePackSchema } from '../shared/imports';
import { datasetSchema } from '../shared/schemas';
import type { Dataset, DatasetManifest } from '../shared/types';

export interface LoadedData {
  dataset: Dataset; manifest: DatasetManifest; hash: string;
  policy: ClinicalPolicy; dataAuthorized: boolean; dataMode: 'synthetic' | 'authorized_aggregate';
}

export function loadDataset(root = process.cwd()): LoadedData {
  const packPath = process.env.AUTHORIZED_AGGREGATE_PACK_PATH;
  if (packPath) {
    if (process.env.DATA_SHARING_AUTHORIZED !== 'true') throw new Error('Authorized aggregate pack requires DATA_SHARING_AUTHORIZED=true operator attestation.');
    const policyPath = process.env.CLINICAL_POLICY_PATH;
    if (!policyPath) throw new Error('Authorized aggregate pack requires CLINICAL_POLICY_PATH.');
    const raw = readFileSync(resolve(root, packPath), 'utf8');
    const pack = authorizedAggregatePackSchema.parse(JSON.parse(raw));
    if (pack.provenance.countryCode === 'DEMO') throw new Error('Authorized aggregate ingestion is for real jurisdictions, not the synthetic demo.');
    const policy = clinicalPolicySchema.parse(JSON.parse(readFileSync(resolve(root, policyPath), 'utf8')));
    if (policy.syntheticDemo || policy.approvalStatus !== 'approved' || policy.jurisdiction !== pack.provenance.countryCode) {
      throw new Error('Clinical policy must be locally approved and match the aggregate pack jurisdiction.');
    }
    const profile = getCountryProfile(pack.provenance.countryCode)!;
    const hash = createHash('sha256').update(raw).digest('hex');
    const dataset = { ...pack.dataset, countryCode: pack.provenance.countryCode, country: profile.name };
    const manifest: DatasetManifest = {
      version: dataset.version, asOf: dataset.asOf, generator: 'authorized-aggregate-import', seed: 0,
      sourceFile: packPath, sha256: hash, synthetic: false,
      counts: {
        districts: dataset.districts.length, facilities: dataset.facilities.length, products: dataset.products.length,
        stockRecords: dataset.stocks.length, routes: dataset.routes.length, evidence: dataset.evidence.length,
      },
    };
    return { dataset, manifest, hash, policy, dataAuthorized: true, dataMode: 'authorized_aggregate' };
  }
  const raw = readFileSync(resolve(root, 'data/synthetic/seed.json'), 'utf8');
  const manifest = JSON.parse(readFileSync(resolve(root, 'data/synthetic/manifest.json'), 'utf8')) as DatasetManifest;
  const hash = createHash('sha256').update(raw).digest('hex');
  if (!manifest.synthetic || manifest.sha256 !== hash || !Number.isFinite(manifest.seed)) throw new Error('Synthetic dataset checksum/provenance mismatch');
  const dataset = datasetSchema.parse(JSON.parse(raw)) as Dataset;
  if (dataset.version !== manifest.version || dataset.asOf !== manifest.asOf) throw new Error('Dataset manifest version/date mismatch');
  return { dataset: { ...dataset, countryCode: dataset.countryCode ?? 'DEMO' }, manifest, hash, policy: DEMO_CLINICAL_POLICY, dataAuthorized: false, dataMode: 'synthetic' };
}
