import { createServer } from 'node:http';
import { resolve } from 'node:path';
import express from 'express';
import { createApp } from './app.js';
import { loadDataset } from './data.js';
import { PlanRepository } from './repository.js';

const root = process.cwd();
const { dataset, manifest, hash, policy, dataAuthorized } = loadDataset(root);
const repository = new PlanRepository(process.env.DATABASE_PATH ?? resolve(root, '.data/stocksense.sqlite'));
const app = createApp({ dataset, manifest, hash, repository, policy, dataAuthorized });
const server = createServer(app);
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const production = process.env.NODE_ENV === 'production';
let closeVite: (() => Promise<void>) | undefined;

if (production) {
  const client = resolve(root, 'dist/client');
  app.use(express.static(client, { index: false, maxAge: '1h' }));
  app.get('/{*splat}', (_req, res) => res.sendFile(resolve(client, 'index.html')));
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({ configFile: resolve(root, 'vite.config.ts'), server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
  closeVite = () => vite.close();
  app.use(vite.middlewares);
}
server.listen(port, host, () => console.log(`StockSense Africa listening on http://${host}:${port} · ${dataset.version} · ${manifest.synthetic ? 'synthetic data only' : 'authorized aggregate mode'}`));
server.on('error', (error) => { console.error('Server failed:', error); process.exitCode = 1; void shutdown(); });
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return; shuttingDown = true;
  await closeVite?.();
  server.close(() => { repository.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
