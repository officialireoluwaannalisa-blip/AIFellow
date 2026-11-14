# Contributing

Thanks for helping improve StockSense Africa. Keep the product honest, safe, and teachable.

## Setup

```bash
npm ci
npm run dev
npm run check
npm run build && npm run test:e2e
```

Use Node 22.13+. No API keys are required. Work on the current Arena branch; do not create alternate branches or rewrite history.

## Development rules

1. Read `prd.md`, `AGENTS.md`, and the relevant model/data/security docs before changing behavior.
2. Put shared calculations in `shared/`; do not duplicate formulas in UI/server.
3. Validate external inputs with Zod. Preserve Unknown-data handling and all planner invariants.
4. Add or update tests for behavior changes. Keep synthetic data deterministic and update the manifest when regenerating.
5. Never commit secrets, real personal/government data, SQLite files, build output, or browser artifacts.
6. Label simulations and limitations in the UI. Do not imply foundation endorsement, clinical validity, or guaranteed hiring outcomes.
7. Keep browser-facing URLs relative; servers bind to `0.0.0.0` and allow the preview host explicitly.
8. Update documentation and `CHANGELOG.md` with user-visible changes.

## Pull request checklist

- [ ] `npm run check` passes.
- [ ] Browser smoke passes for UI/workflow changes.
- [ ] Budget, donor, expiry, cold-chain, and Unknown invariants remain tested.
- [ ] New assumptions are documented and visible where decisions are made.
- [ ] No real data or secrets are included.
- [ ] Accessibility: labels, focus states, text alternatives, and mobile overflow considered.

## Commit style

Use concise imperative subjects, for example:
- `feat: add CSV ingestion quarantine preview`
- `fix: prevent repeated procurement for pre-lead-time gaps`
- `docs: clarify pilot evaluation gates`

## Reporting problems

Include reproduction steps, dataset version, expected/actual behavior, and whether synthetic data was used. Never include sensitive records in public issues.
