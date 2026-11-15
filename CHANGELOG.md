# Changelog

## 0.4.0 — 2026-11-14

Real public facility name references and the Calm Clinic design system.

### Added
- 18 real public facility name references across Nigeria, Burkina Faso, Ethiopia, Kenya, and South Africa, each with a `nameReference` source and synthetic-data disclaimer.
- Root `design.md` and `src/theme.css`: glass chrome/overlays, neumorphic controls, clay cards/stats, and skeuomorphic role switch, audit ledger, map board, and sidebar.
- `docs/FACILITY_NAMES.md`, uploaded design inspiration asset, Burkina Faso location profile, and methodology name-reference boundary.

### Changed
- Synthetic seed `synthetic-2026.11.14-v3`; country-labeled demo district groups replace fictional districts. Operational figures remain synthetic.
- Facility view hides irrelevant scope filters and shows a compact two-metric summary; leadership columns are balanced; compact map/forecast tables stay tabular in narrow desktop columns.
- Contrast tokens, focus rings, mobile navigation visibility, and forced-colors fallbacks tightened.

### Known limits
- Public sources and the connected workspace did not provide a verified Foundation facility-by-facility roster. Names do not imply Foundation funding or real stock/performance.
- The map remains schematic; role switching remains a demo simulation, not authenticated access control.

## 0.3.0 — 2026-11-14

Role-based dashboard overview on the same data and exact MILP engine.

### Added
- Default `/dashboard` workspace with five demo role views: leadership, supply-chain/financing, district, facility, and partner.
- URL-backed country → region → district → facility, commodity, period, and search filters; server-side demo scope locks for district/facility roles.
- Summary strip, schematic geographic risk map/table, top-ranked interventions with “Why this?”, bottleneck summary, 30/60/90 forecast, budget panel, saved-demo-plan pipeline, expiry/redistribution alerts, facility stock/delivery actions, partner country comparison/goals/notes, and dashboard audit trail.
- Dashboard APIs for scoped payloads, briefings, facility/support records, partner notes, and audit events; SQLite tables for local demo records.
- Offline-tolerant shell/dashboard caching, cached snapshot banner, and local facility request outbox with reconnect sync.
- Optional synthetic region and schematic map-coordinate fields; dashboard design plan and dashboard documentation.
- Dashboard shared/API tests and expanded browser smoke coverage (47 tests across 7 files).

### Changed
- Dashboard replaces the old overview as the default route; the previous snapshot overview remains at `/overview`.
- Synthetic seed version `synthetic-2026.11.14-v2`; evidence snippet EV-003 now describes the exact MILP engine.
- Reduced-motion handling is scoped to spatial/persistent motion instead of a global near-zero duration override.

### Known limits
- Role switching is a demo simulation, not authenticated RBAC. Real deployment requires identity, authorization, and audit hardening.
- Financing pipeline and adoption metrics come from local saved demo plans/records, not live treasury, procurement, or telemetry systems.
- The map is schematic demo geometry, not verified administrative boundaries or road routing.
- No real stockout prevention, spending improvement, or forecast calibration is claimed.

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
