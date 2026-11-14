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
