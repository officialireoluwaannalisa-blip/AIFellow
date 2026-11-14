# Delivery roadmap

A fellowship-aligned plan that separates a credible prototype from partner validation and scale. Dates are relative to project start; no hiring outcome or foundation endorsement is implied.

## Phase 0 — Portfolio MVP (complete)

- PRD, architecture, data contract, model card, responsible-AI/security docs.
- Synthetic dataset and deterministic forecast/risk engine.
- Budget-aware transfer/replenishment heuristic (v0.1; superseded by exact MILP in v0.2).
- Saved plans, approval gate, simulated funding trace, audit trail.
- Evidence retrieval, exports, quality/methodology pages.
- Strict types, automated tests, browser smoke, live preview.

**Exit evidence:** reproducible demo, passing checks, documented limits, facilitator walkthrough.

## Phase 0.2 — Exact optimization and country boundary (complete)

- HiGHS fixed-charge integer-flow MILP with zero-gap certificate and feasibility re-check.
- Country/location profiles, authorized aggregate import preview, clinical-policy gates.
- Operator validation CLI and updated safety/model documentation.

**Exit evidence:** optimizer tests beat greedy counterexamples; real-country allocation fails closed; public demo remains synthetic.

## Phase 0.3 — Role-based dashboard overview (complete)

- Five demo role views on one data/MILP engine; URL-backed scope filters and search.
- Schematic risk map, explainable ranked actions, bottlenecks, forecast, budget/pipeline panels, facility minimal actions, partner notes/comparison, audit trail.
- Offline-tolerant caching and local facility outbox; dashboard tests and browser smoke.

**Exit evidence:** role scope locks and “Why this?” explanations tested; demo-role and not-connected limits explicit; no real outcome claim.

## Phase 1 — Weeks 1–4: co-design and data reality

- Confirm country/district, users, authoritative stock definitions, and approval roles.
- Map existing LMIS/DHIS2/ERP/finance sources and reporting cadence.
- Extend aggregate preview into live custodian connectors with row-level errors, quarantine, and lineage.
- Replace synthetic assumptions with locally reviewed lead times, routes, shelf-life rules, and budget categories.
- Run usability sessions with supply and budget officers; revise the workflow.

**Gate:** data-use agreement, named product owner, approved schema, no real data in the public demo.

## Phase 2 — Months 2–3: evaluation and decision quality

- Rolling-origin backtests against naive mean and current practice.
- Alert precision/recall, missed shortages, burden, and district/product subgroup review.
- Sensitivity analysis for demand shocks, lead times, prices, and buffer.
- Evaluate MILP objective choices and add explicit locally approved equity constraints.
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

- Service-equity constraints over the exact MILP contract.
- Probabilistic forecasting only after calibration/validation.
- Real transport routing and cold-chain monitoring.
- Supplier reliability and cash-release delay modeling.
- Accessibility audit, localization, offline/low-bandwidth mode.
- Dependency/security scanning in CI and production observability.
