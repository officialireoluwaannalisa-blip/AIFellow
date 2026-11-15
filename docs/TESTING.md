# Testing and acceptance

## Commands

```bash
npm run typecheck   # strict TypeScript
npm test            # Vitest domain, API, and component tests
npm run build       # typecheck + Vite client + bundled Express server
npm run check       # all of the above
npm run build && npm run test:e2e
```

The browser smoke test starts an isolated production server on port 3100 (override `E2E_PORT`) with a temporary SQLite database, drives it with the project-local `agent-browser`, and cleans up. It uses `@sparticuz/chromium` from npm when no `AGENT_BROWSER_EXECUTABLE_PATH` is supplied, avoiding external browser-download hosts. On a normal workstation you may point that variable at an installed Chrome/Chromium.

## Automated coverage

### Domain
- Capped demand trend; short/zero history does not invent demand.
- FEFO consumption, expiry removal, quarantine exclusion, confirmed-only inbound with explicit expiry.
- Stale/empty records produce Unknown/Critical appropriately.
- Seeded quality examples and schema rejection of duplicates/broken reconciliation.
- Spreadsheet formula neutralization and CSV escaping.

### Planner
- Budget never exceeded; exact cost reconciliation; zero-budget behavior.
- Deterministic output for identical inputs apart from solve timing.
- Feasible exact-product transfer with donor buffer and shelf-life checks.
- Cold-chain route rejection, insufficient donor surplus rejection, Unknown exclusion.
- No donor batch double-allocation across the full demo.
- Real-country allocation blocked without authorized data/policy.

### Optimizer
- Empty optimal certificate.
- Fixed-charge knapsack case where greedy ratio selection is suboptimal.
- Shared fixed cost charged once across multiple batch flows.
- Lexicographic cost minimization without sacrificing optimal benefit.
- Duplicate candidate and inconsistent fixed-cost rejection.

### Country / clinical / imports
- Country profiles do not claim live patient data.
- Real-country gate requires authorized data and approved jurisdiction-matched policy.
- Aggregate pack preview accepts valid structure and returns quality/hash.
- Patient-level flags, direct identifier fields, country mismatch, and unreconciled batches are rejected.

### API/workflow
- Health/meta and composed risk filters.
- Invalid scenario/query/scope handling.
- Labeled CSV/briefing exports.
- Bounded assistant answers and clinical-question refusal.
- Cross-origin mutation rejection.
- Plan persistence, idempotent submission, approval gate, stepwise transitions, stale-transition conflict, audit events, name/note validation.

### Dashboard
- Facility/district demo scope locks; Unknown is not on-track; commodity/search filters; region fallback; forecast horizons; budget ceiling; every intervention has a short explanation.
- Every demo facility has a real-name reference source, matching country label, synthetic-data note, and finite manifest seed; EV-007 states names do not imply Foundation funding.

### Serverless deployment
- Every relative specifier in `api/`, `server/`, and `shared/` carries an explicit file extension and resolves to a real source file. Native Node ESM on Vercel rejects extensionless imports, which previously took down every API route while local gates stayed green.
- Vercel rewrite path restoration preserves nested paths and query parameters.
- The synthetic dataset resolves even when the working directory is not the bundle root, and `STOCKSENSE_DATA_ROOT` overrides it.

### Components
- Distinct Unknown/Stable labels, chart text alternative, dialog Escape/focus restoration, actionable empty state.

### Browser smoke
- Dashboard loads and leadership, facility, district, and partner role views render.
- Snapshot overview remains available at `/overview`.
- Risk search/filter and detail dialog work.
- Scenario runs; plan saves and navigates to Funding trace.
- Explicit demo approval and all three item advances work; audit event appears.
- Evidence assistant returns the no-LLM boundary answer.
- Methodology loads.
- 390×844 mobile viewport has no horizontal page overflow; navigation opens.
- No browser console errors in the production smoke run.

## Latest verification

- **Date:** 2026-11-14
- `npm run typecheck`: pass
- `npm test`: **57 tests passed** across 10 files
- `npm run build`: pass
- `npm run test:e2e`: pass (isolated production server + Chromium)
- Vercel function rehearsal: the real `@vercel/node` builder produced a `nodejs22.x` Lambda (440 files, including `data/synthetic/*.json` and `node_modules/highs/build/highs.wasm`). Running that bundle over HTTP returned 200 for `/api/health`, `/api/meta`, `/api/overview`, the rewritten `/api/index?__path=…` forms, the dashboard, and `POST /api/scenarios/preview` (`optimal`, objective 53,683,100, cost 2,499,926 cents). A deliberately broken module produced the guarded `503 SERVICE_INIT_FAILED` JSON, and the bundle still served health with its working directory outside the bundle root.
- Mobile overflow check: pass at 390×844
- `npm audit --omit=dev --audit-level=high`: 0 production vulnerabilities reported
- Default synthetic scenario: HiGHS `optimal`, gap 0; 51 selected actions, 2,499,926 USD cents, 98 candidates / 196 variables / 195 constraints; solve time approximately 3.9 s in the sandbox
- Accessibility: axe WCAG A/AA reports 0 violations on dashboard, overview, risks, planner, funding, data, and methodology; a solid-surface fallback audit also reports 0 contrast violations. See `docs/DASHBOARD_DESIGN.md`.

These results verify the synthetic prototype's implementation, not real-world forecast accuracy, fairness, security readiness, or health impact.

## Manual acceptance checklist

- [ ] Dashboard role switching is labeled demo simulation; facility/district scope locks hold.
- [ ] Every dashboard recommendation has a short “Why this?” explanation.
- [ ] Offline banner/cached snapshot and facility outbox sync are understood as demo tolerance, not production offline sync.
- [ ] Persistent synthetic/authorized-aggregate data notice is visible.
- [ ] Optimality certificate and clinical-policy status are visible in the planner.
- [ ] Country profiles show not-connected state for unconfigured real jurisdictions.
- [ ] Critical/Watch/Stable/Unknown are distinguishable by text, not color alone.
- [ ] Risk detail shows batches, inbound, quality flags, and calculation explanation.
- [ ] Changing scenario inputs marks the previous result stale until rerun.
- [ ] Selected cost never exceeds the ceiling; unfunded needs remain visible.
- [ ] Save recomputes server-side; duplicate submission does not duplicate a plan.
- [ ] Approval requires explicit demo confirmation.
- [ ] Funding actions are clearly simulated and audited.
- [ ] CSV/briefing downloads carry demo/provenance labels.
- [ ] Assistant refuses clinical advice and states no LLM is connected.
- [ ] Keyboard focus is visible; dialogs trap/restore focus; mobile navigation works.

## Before a real pilot

Add rolling-origin backtests, alert precision/recall and missed-shortage review, subgroup/equity analysis, sensitivity tests, ingestion quarantine tests, auth/tenant isolation tests, load/latency tests, dependency scanning, accessibility audit, disaster-recovery tests, and prospective shadow evaluation with local partners.
