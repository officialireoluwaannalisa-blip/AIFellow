# Delivery roadmap

A fellowship-aligned plan that separates a credible prototype from partner validation and scale. Dates are relative to project start; no hiring outcome or foundation endorsement is implied.

## Phase 0 — Portfolio MVP (complete)

- PRD, architecture, data contract, model card, responsible-AI/security docs.
- Synthetic dataset and deterministic forecast/risk engine.
- Budget-aware transfer/replenishment heuristic.
- Saved plans, approval gate, simulated funding trace, audit trail.
- Evidence retrieval, exports, quality/methodology pages.
- Strict types, automated tests, browser smoke, live preview.

**Exit evidence:** reproducible demo, passing checks, documented limits, facilitator walkthrough.

## Phase 1 — Weeks 1–4: co-design and data reality

- Confirm country/district, users, authoritative stock definitions, and approval roles.
- Map existing LMIS/DHIS2/ERP/finance sources and reporting cadence.
- Build validated CSV ingestion with row-level errors, quarantine, and lineage.
- Replace synthetic assumptions with locally reviewed lead times, routes, shelf-life rules, and budget categories.
- Run usability sessions with supply and budget officers; revise the workflow.

**Gate:** data-use agreement, named product owner, approved schema, no real data in the public demo.

## Phase 2 — Months 2–3: evaluation and decision quality

- Rolling-origin backtests against naive mean and current practice.
- Alert precision/recall, missed shortages, burden, and district/product subgroup review.
- Sensitivity analysis for demand shocks, lead times, prices, and buffer.
- Compare greedy ranking with constrained optimization and explicit equity constraints.
- Add override reasons, plan versioning, and reviewer disagreement capture.

**Gate:** documented performance and failure modes; human reviewers accept the alert burden.

## Phase 3 — Months 3–6: responsible LLM and integration pilot

- Optional LLM summarization over approved evidence and deterministic tool outputs.
- Citation/numeric validation, prompt-injection tests, refusal/fallback behavior.
- Authenticated roles, tenant isolation, exact origins, rate limits, production CSP.
- Read-only source-system connectors; shadow-mode recommendations.
- Workshops and local-language/accessibility review.

**Gate:** security/privacy review, prospective shadow evaluation, no autonomous expenditure.

## Phase 4 — Months 6–9: controlled operational pilot

- Limited district pilot with explicit human approval and source-system reconciliation.
- Monitor stockout days, emergency orders, expiry losses, planner time, and equity indicators against baseline.
- Operational runbooks, backup/restore drills, incident response, and support ownership.
- Iterate on low-bandwidth/offline needs and adoption barriers.

**Gate:** independent review of usefulness, safety, and operational readiness.

## Phase 5 — Months 9–12: modular scale and handover

- Reusable connectors and country configuration without forking decision logic.
- Multi-country financing-flow diagnostics as a separate, governed module.
- Digital-public-good packaging, documentation, training-of-trainers, and maintenance plan.
- Publish methods/evaluation honestly, including negative results and limits.

**Gate:** funded ownership, support model, and partner-approved scale decision.

## Cross-cutting backlog

- Formal optimization with service-equity constraints.
- Probabilistic forecasting only after calibration/validation.
- Real transport routing and cold-chain monitoring.
- Supplier reliability and cash-release delay modeling.
- Accessibility audit, localization, offline/low-bandwidth mode.
- Dependency/security scanning in CI and production observability.
