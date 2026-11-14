# Changelog

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
