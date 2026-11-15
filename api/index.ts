import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Request, Response } from 'express';
import { restoreVercelApiPath } from '../server/vercel-path.js';

/**
 * Vercel Node Function adapter.
 *
 * The local server (`server/index.ts`) owns a long-lived HTTP listener and a
 * durable SQLite file. Vercel Functions are request-scoped and do not provide a
 * durable writable disk, so this adapter reuses the same Express app but keeps
 * workflow state in a temporary SQLite file. State may reset between cold
 * starts/instances; the API and UI label that boundary explicitly.
 *
 * Two platform constraints shape this file:
 *
 * 1. `@vercel/node` transpiles TypeScript without bundling, and the package is
 *    `"type": "module"`. Every relative specifier in this graph therefore needs
 *    an explicit `.js` extension or native Node ESM throws ERR_MODULE_NOT_FOUND
 *    at load time. `tests/esm-specifiers.test.ts` guards that invariant.
 * 2. Initialization is lazy and guarded. A module-scope throw here would surface
 *    as an opaque platform-level `FUNCTION_INVOCATION_FAILED` on every route;
 *    importing inside the request handler lets us log the cause and answer with
 *    readable JSON instead.
 */
type ExpressHandler = (req: Request, res: Response) => unknown;

let appPromise: Promise<ExpressHandler> | null = null;

async function initialize(): Promise<ExpressHandler> {
  const [{ createApp }, { loadDataset }, { PlanRepository }] = await Promise.all([
    import('../server/app.js'),
    import('../server/data.js'),
    import('../server/repository.js'),
  ]);
  // No explicit root: let the loader find the packaged dataset even when the
  // function's working directory is not the bundle root.
  const { dataset, manifest, hash, policy, dataAuthorized } = loadDataset();
  const repository = new PlanRepository(join(tmpdir(), 'stocksense-vercel.sqlite'));
  return createApp({
    dataset,
    manifest,
    hash,
    repository,
    policy,
    dataAuthorized,
    storageMode: 'ephemeral',
  }) as unknown as ExpressHandler;
}

function describeFailure(error: unknown): string {
  const candidate = error as { code?: unknown; name?: unknown } | null;
  if (candidate && typeof candidate.code === 'string' && candidate.code) return candidate.code;
  if (candidate && typeof candidate.name === 'string' && candidate.name) return candidate.name;
  return 'UnknownError';
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const restored = restoreVercelApiPath(req.url ?? '/');
  req.url = restored;
  (req as IncomingMessage & { originalUrl?: string }).originalUrl = restored;

  let app: ExpressHandler;
  try {
    appPromise ??= initialize();
    app = await appPromise;
  } catch (error) {
    // Allow a later request to retry rather than poisoning the instance forever.
    appPromise = null;
    console.error('[stocksense] API initialization failed:', error);
    const reason = describeFailure(error);
    const verbose = process.env.STOCKSENSE_DEBUG_ERRORS === 'true';
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({
      error: {
        code: 'SERVICE_INIT_FAILED',
        message: 'The demo API failed to start. See the Vercel function runtime logs for details.',
        reason,
        ...(verbose && error instanceof Error ? { detail: error.message } : {}),
      },
    }));
    return;
  }

  return app(req as unknown as Request, res as unknown as Response);
}
