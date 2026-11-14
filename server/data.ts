import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { datasetSchema } from '../shared/schemas';
import type { Dataset, DatasetManifest } from '../shared/types';

export function loadDataset(root = process.cwd()): { dataset: Dataset; manifest: DatasetManifest; hash: string } {
  const raw = readFileSync(resolve(root, 'data/synthetic/seed.json'), 'utf8');
  const manifest = JSON.parse(readFileSync(resolve(root, 'data/synthetic/manifest.json'), 'utf8')) as DatasetManifest;
  const hash = createHash('sha256').update(raw).digest('hex');
  if (!manifest.synthetic || manifest.sha256 !== hash) throw new Error('Synthetic dataset checksum/provenance mismatch');
  const dataset = datasetSchema.parse(JSON.parse(raw)) as Dataset;
  if (dataset.version !== manifest.version || dataset.asOf !== manifest.asOf) throw new Error('Dataset manifest version/date mismatch');
  return { dataset, manifest, hash };
}
