# Repository guidance for coding agents

## Product boundary
StockSense Africa is an independent synthetic-data portfolio prototype inspired by the Gates Foundation AI Fellows role. Never describe it as an official foundation deployment, a job guarantee, or validated clinical software.

## Source of truth
- Product scope: `prd.md`
- Behavior/limits: `docs/MODEL_CARD.md`, `docs/DATA_CONTRACT.md`
- Architecture: `docs/ARCHITECTURE.md`
- Safety: `docs/RESPONSIBLE_AI.md`, `docs/SECURITY.md`

## Engineering rules
1. Keep deterministic domain logic in `shared/`; the API and UI must not duplicate formulas.
2. Validate external inputs with Zod. Treat missing/stale data as Unknown, never as low risk.
3. Preserve budget, donor-surplus, exact-product, expiry, route, and cold-chain invariants.
4. Do not let an LLM invent facts or execute procurement/payment actions. No live LLM is configured in v0.1.
5. Use synthetic data only. Never commit secrets, real patient data, SQLite databases, build output, or browser artifacts.
6. Keep the UI honest: label simulations, heuristic rankings, and unvalidated assumptions.
7. Add/update tests and documentation with behavior changes. Run `npm run check` before handing off.
8. Servers bind to `0.0.0.0`; browser code uses relative `/api` URLs. Permit the Arena preview host without disabling all host checks.
9. Work only on the current Arena branch. Do not create alternate branches or rewrite repository history.

## Project skills
- `grill-me` delegates to `grilling`: use for explicit plan-stress-testing requests; do not block reversible implementation on an interview the user did not request.
- `agent-browser`: load `npx agent-browser skills get core` before browser QA. Use a project-local dependency, not a global install.

## Useful commands
```bash
npm ci
npm run dev
npm run check
npm run build && npm run test:e2e   # isolated production server + project-local browser
```
