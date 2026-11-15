import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Request, Response } from 'express';
import { createApp } from '../server/app';
import { loadDataset } from '../server/data';
import { PlanRepository } from '../server/repository';
import { restoreVercelApiPath } from '../server/vercel-path';

/**
 * Vercel Node Function adapter.
 *
 * The local server (`server/index.ts`) owns a long-lived HTTP listener and a
 * durable SQLite file. Vercel Functions are request-scoped and do not provide a
 * durable writable disk, so this adapter reuses the same Express app but keeps
 * workflow state in a temporary SQLite file. State may reset between cold
 * starts/instances; the API and UI label that boundary explicitly.
 */
const root = process.cwd();
const { dataset, manifest, hash, policy, dataAuthorized } = loadDataset(root);
const repository = new PlanRepository(join(tmpdir(), 'stocksense-vercel.sqlite'));

const app = createApp({
  dataset,
  manifest,
  hash,
  repository,
  policy,
  dataAuthorized,
  storageMode: 'ephemeral',
});

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const restored = restoreVercelApiPath(req.url ?? '/');
  req.url = restored;
  (req as IncomingMessage & { originalUrl?: string }).originalUrl = restored;
  return app(req as unknown as Request, res as unknown as Response);
}
