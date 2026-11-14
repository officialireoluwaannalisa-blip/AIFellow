# Changelog

## 0.2.0 — 2026-11-14

Exact global optimization and country-aware authorized data boundary.

### Added
- HiGHS fixed-charge integer-flow MILP with lexicographic weighted-unit/cost objective, zero-gap optimality certificate, model hash, and independent feasibility re-check.
- Conservative donor transferable-batch calculation by FEFO demand replay and buffer reservation.
- Country/location profiles for Demo Republic, Nigeria, Ethiopia, South Africa, and Kenya; location setting and allocation gate reasons.
- Authorized aggregate pack schema, privacy/identifier scanning, quality preview, and operator validation CLI (`npm run data:validate-import`).
- Clinical-policy schema separating safety guardrails from locally approved prioritization weights; real-country allocation fails closed without authorization and approval.
- Planner optimality certificate UI, Data & evidence country connections/import preview, Funding decision-trace notice, and updated methodology.
- Optimizer, country, clinical-policy, and aggregate-import tests; expanded API tests.

### Changed
- Replaced adaptive greedy allocation as the active engine. Greedy remains only as historical v0.1 context.
- Public demo remains synthetic; operator-controlled authorized aggregate ingestion is available but disabled by default.
- Exports and briefing labels distinguish synthetic demo from authorized aggregate mode.
- Documentation updated: PRD v0.2, model card, architecture, data contract, API, country data, decisions, security, responsible AI, testing, roadmap.

### Known limits
- No live government API connector is configured; portal links are reference entry points, not verified data endpoints.
- Patient-level records are rejected. Real-country use requires signed authorization, local clinical governance, authenticated deployment, and prospective evaluation.
- MILP optimality is scoped to the modeled integer-flow problem, not real-world clinical utility or equity.
- Node SQLite API is experimental; production hardening is required.

## 0.1.0 — 2026-11-14

Initial synthetic-data portfolio MVP.

### Added
- PRD and engineering/product/safety/teaching documentation.
- Deterministic synthetic Demo Republic dataset: 18 facilities, 5 products, 90 stock records, manifest checksum.
- Demand baseline, FEFO/expiry-aware projection, confirmed inbound handling, risk labels, Unknown gates, and quality report.
- Budget-aware adaptive greedy planner with exact-product transfers, donor buffer, shelf-life, cold-chain, and route constraints.
- Procurement need separated from pre-lead-time unmet demand to avoid repeated ineffective orders.
- React workspace: Overview, Stockout risk, Scenario planner, Funding trace, Data & evidence, Methodology.
- SQLite saved plans, idempotent submission, explicit demo approval, stepwise simulated workflow, and append-only audit events.
- Formula-safe CSV exports, grounded Markdown briefing, bounded retrieval assistant with clinical refusal.
- Strict TypeScript, 29 automated tests, isolated browser smoke test, mobile overflow check.
- Project-local agent skills for planning interviews and browser QA.

### Known limits
- No real data, authentication, live LMIS/procurement/payment integration, or connected LLM.
- Heuristic allocation is not globally optimal or clinically validated.
- Node SQLite API is experimental; production hardening is required.
