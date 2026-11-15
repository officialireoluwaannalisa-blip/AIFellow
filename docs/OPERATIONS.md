# Operations runbook (demo)

## Run

```bash
npm ci
npm run dev                 # development, port 3000, 0.0.0.0
npm run build && npm start  # production bundle, port 3000
```

Environment variables are read from the process; `.env.example` documents defaults. Use a process manager to load environment files if desired.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address for preview/container use |
| `DATABASE_PATH` | `.data/stocksense.sqlite` | Demo workflow database |
| `ALLOWED_HOSTS` | empty | Exact extra hosts for mutation Origin checks |
| `NODE_ENV` | unset | `production` serves `dist/client` |
| `E2E_PORT` | `3100` | Isolated browser smoke server port |
| `AGENT_BROWSER_EXECUTABLE_PATH` | unset | Optional system Chrome for smoke tests |
| `DATA_SHARING_AUTHORIZED` | unset | Operator attestation required for authorized aggregate ingestion |
| `AUTHORIZED_AGGREGATE_PACK_PATH` | unset | Secure path to an aggregate-only pack; disables synthetic default when set |
| `CLINICAL_POLICY_PATH` | unset | Secure path to a locally approved jurisdiction-matched clinical policy |

Node 22 prints an experimental warning for `node:sqlite`; this is expected in the demo. The repository adapter isolates that dependency.

## Vercel deployment

The repository ships `vercel.json` and `api/index.ts` for a same-origin Vercel deployment:

```text
Static client: dist/client
API function:  api/index.ts -> Express app from server/app.ts
Node version:  22.x, selected by package.json engines
Storage:       temporary SQLite file in the function instance's /tmp
```

Recommended settings if configuring manually:

| Setting | Value |
|---|---|
| Framework preset | Other |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist/client` |
| Function max duration | 60 seconds |

The adapter includes the synthetic dataset and HiGHS WASM runtime in the function bundle. The default scenario solves in a few seconds in the sandbox, but cold starts can add latency.

### Native ESM constraint (caused a full API outage)

`@vercel/node` **transpiles TypeScript without bundling**, and `package.json` declares `"type": "module"`. The emitted files are therefore loaded by native Node ESM, which performs no extension resolution. Every relative import in the serverless graph (`api/`, `server/`, `shared/`) must carry an explicit `.js` extension:

```ts
import { createApp } from '../server/app.js';   // correct — resolves to server/app.ts at build time
import { createApp } from '../server/app';      // breaks the deployed function
```

An extensionless specifier compiles cleanly and passes `tsx`, `esbuild`, and Vitest locally, then throws `ERR_MODULE_NOT_FOUND` on Vercel. Because the throw happened during module initialization, **every** API route returned the platform's opaque `500 FUNCTION_INVOCATION_FAILED` while the static client still loaded, leaving the UI stuck on "Loading workspace…". `tests/esm-specifiers.test.ts` now fails the build if any specifier regresses.

Two further safeguards live in `api/index.ts` and `server/data.ts`:

- Initialization is lazy and guarded. A startup failure is logged with its stack and answered as `503` JSON (`error.code = SERVICE_INIT_FAILED`, `error.reason` such as `ERR_MODULE_NOT_FOUND`) instead of an opaque platform error. Set `STOCKSENSE_DEBUG_ERRORS=true` to include the raw message in the response; leave it unset on public deployments.
- The dataset root is resolved from `STOCKSENSE_DATA_ROOT`, the working directory, directories above the module, and `/var/task`, because a serverless working directory is not guaranteed to be the bundle root.

### Verifying a deployment

Check the API, not just the page — a healthy static shell says nothing about the function:

```bash
curl -sS https://<your-domain>/api/health   # expect {"ok":true,...,"storage":{"mode":"ephemeral"}}
curl -sS https://<your-domain>/api/meta     # expect districts/facilities/products
```

If a route returns `FUNCTION_INVOCATION_FAILED`, open the deployment's **Runtime Logs** in the Vercel dashboard and read the first stack trace; that is the initialization error. To reproduce the platform build offline, run the `@vercel/node` builder against a **copy** of the repository (never the working tree — its `download()` step rewrites files in place), materialize the emitted Lambda, and import it with Node.

**Hosted storage is ephemeral.** Vercel Functions do not provide a durable writable disk. The adapter keeps demo workflow state in a temporary SQLite file so the save/approve/funding flow works within an instance, but plans, notes, support requests, and audit history may disappear between cold starts, scaling events, or deployments. `/api/health` and `/api/meta` return `storage.mode = "ephemeral"`, and the UI shows a warning. Do not enter sensitive notes. For durable hosted state, replace the repository adapter with an external database before real use.

If Vercel Deployment Protection is enabled, the deployment URL may require Vercel login. That is an access-control setting, not an application failure. Keep protection enabled for non-public demos; use a custom domain or an approved access rule only when intentional.

## Data and persistence

- Synthetic inputs: `data/synthetic/seed.json` and `manifest.json`.
- Regenerate deterministically: `npm run data:generate`. Do not edit the seed without updating the manifest and tests.
- Validate an operator aggregate pack before ingestion: `npm run data:validate-import -- <pack.json> [policy.json]`.
- Authorized aggregate mode requires all three ingestion environment variables and a non-public deployment. Patient-level records are rejected.
- Workflow state: SQLite plans, items, audit events, and location setting. Plans snapshot scenario/results and dataset version/hash.
- The database is local and gitignored. The public preview has one shared demo workspace.

## Backup and restore (local demo)

1. Stop the server.
2. Copy the SQLite file and any `-wal`/`-shm` siblings to a safe location, or use SQLite backup tooling.
3. Restore by replacing the files while stopped, then start and check `/api/health` and `/api/plans`.

Do not treat this as a production backup strategy. Real deployment needs encryption, retention, restore drills, and access controls.

## Reset the demo

Stop the server, remove only the configured demo database files (for example `.data/stocksense.sqlite*`), and restart. This deletes saved demo plans/audit history. Do not reset a database containing anything you need to preserve. The synthetic dataset is untouched.

## Browser smoke

```bash
npm run build
npm run test:e2e
```

The script starts its own production server and temporary database, uses a project-local browser, and cleans up. If port 3100 is occupied, set `E2E_PORT`. If the npm browser cannot run on your OS, set `AGENT_BROWSER_EXECUTABLE_PATH` to a compatible Chrome/Chromium. The standard `agent-browser install` may require external download hosts unavailable in restricted sandboxes.

## Troubleshooting

| Symptom | Check |
|---|---|
| Preview blank after server restart | Reload the page; confirm `/api/health` and server logs |
| Host/origin rejection | Use the live preview URL; configure exact `ALLOWED_HOSTS` for deployment |
| Port in use | Change `PORT` or stop the conflicting process |
| Dataset checksum mismatch | Regenerate data or restore matching seed/manifest; do not bypass verification |
| Plan transition conflict | Refresh the plan; another update changed the expected status |
| No scenario actions | Budget may be zero/too small, scope may contain only Unknown records, or constraints block feasibility |
| Allocation blocked | Country/location does not match active dataset, or authorized aggregate/clinical-policy gates are unmet |
| Optimizer did not certify optimality | Narrow scope/budget; no greedy fallback is returned. Check solver time limit and model size |
| Mobile table scrolls horizontally | Intentional inside the table container; the page itself should not overflow |
| SQLite locked | Stop other processes using the same demo DB; avoid shared network filesystems |

## Production readiness

This runbook does not make the demo production-ready. See [Security](SECURITY.md) and [Roadmap](ROADMAP.md) for identity, tenant isolation, CSP, rate limiting, ingestion governance, monitoring, migrations, and incident response requirements.
