# Product Requirements Document — StockSense Africa

**Version:** 0.1 · **Status:** working MVP specification · **Date:** 2026-11-14
**Product:** Essential-medicines stockout decision support
**Context:** An independent portfolio prototype inspired by the Gates Foundation AI Fellows (Africa) job description. It is not an official foundation product, endorsed deployment, or job application guarantee.

## 1. Problem

District health teams need to identify which facilities and medicines are likely to run out, decide what to do under a limited budget, and follow recommended actions through procurement and cash release. Stock, consumption, shipment, expiry, and financial information often live in different systems. A useful prototype must make its inputs, uncertainty, constraints, and human approval steps visible rather than hide them behind a confident chatbot.

The first release focuses on the job description's medicines-availability and budget-prioritization problems. Multi-country financing-flow integration is a later extension, not a claimed capability of this MVP.

## 2. Product vision

Give a non-technical health supply planner a clear, explainable path:

**trusted snapshot → risk triage → feasible action → budget-aware plan → human approval → simulated procurement/cash trace → export and review.**

The product should demonstrate applied AI/ML judgment, data engineering, optimization, software quality, and capacity building. Deterministic calculations are the source of truth. An LLM must never invent stock balances, silently approve expenditure, or replace the optimization engine.

## 3. Users and needs

| Persona | Needs | MVP support |
|---|---|---|
| District supply/pharmacy officer | Find urgent shortages, inspect evidence, compare transfers and replenishment | Risk register, detail drawer, scenario planner |
| Health planning/budget officer | Stay within a ceiling and understand trade-offs | Explicit costs, selected/unfunded actions, before/after estimates |
| Program manager | Review and track decisions without confusing a demo with execution | Approval gate, item-level workflow, immutable audit events |
| Data/M&E officer | Understand freshness, missingness, provenance, and model limits | Data-quality page, manifest, methodology, exports |
| Fellowship reviewer / facilitator | Run and teach the prototype safely | Synthetic dataset, reproducible setup, tests, demo script, playbook |

No patient-facing or prescriber workflow is included.

## 4. Goals and non-goals

### MVP goals

1. Provide a usable, responsive web application with a persistent synthetic demo workspace.
2. Forecast near-term stockouts using consumption history, usable batches, expiry, and confirmed inbound shipments.
3. Explain every risk classification and expose missing/stale data as **Unknown**, not low risk.
4. Generate feasible same-product redistribution and replenishment options.
5. Rank actions under a hard budget ceiling using a transparent, reproducible heuristic.
6. Require human approval before simulated procurement and cash-release steps.
7. Preserve plan snapshots and an append-only audit trail in SQLite.
8. Export reviewable CSV artifacts and a grounded briefing.
9. Document assumptions, validation, limitations, and a responsible path to real deployment.

### Non-goals for v0.1

- Real patient, facility, government, or donor data.
- Clinical diagnosis, prescribing, medicine substitution, or dosing advice.
- Autonomous purchasing, payments, supplier selection, or government-system writes.
- Claims of calibrated stockout probabilities, clinical effectiveness, or globally optimal allocation.
- Live DHIS2/LMIS/ERP integration, authentication/SSO, or production multi-tenancy.
- A live LLM dependency. Retrieval and briefing are deterministic and explicitly labeled.
- Cross-country financial reconciliation, routing on real roads, or expiry-disposal decisions.

## 5. Scope and user journeys

### J1 — Triage the network

A planner opens Overview, sees network coverage, high-risk items, projected stockout days, and expiring stock. They filter the risk register by district, product, risk level, or text. Opening an item shows inputs, a stock projection, batches, inbound shipments, quality warnings, and the risk calculation.

**Acceptance:** filters compose; empty results have a reset action; unknown data is distinguishable; all displayed counts derive from the same snapshot and horizon.

### J2 — Build a budget-aware scenario

The planner chooses a district scope, 14/30/60-day horizon, safety buffer, and USD budget ceiling. The server validates inputs, computes current risk, proposes exact-product transfers and procurement, and returns selected actions plus unfunded needs.

**Acceptance:** total selected cost never exceeds the ceiling; donor stock is not double-allocated; expired/quarantined stock is excluded; transfers preserve donor buffer and minimum remaining shelf life; cold-chain products require compatible routes; identical inputs produce identical ordering; the UI labels the heuristic and assumptions.

### J3 — Review and approve

The planner inspects each action's quantity, source/destination, arrival assumption, cost, and rationale, then saves a named plan. Approval requires an explicit demonstration-only confirmation.

**Acceptance:** the server recomputes the plan rather than trusting client totals; saved plans retain scenario/result snapshots; duplicate submission keys do not create duplicate plans; approval is an audited state transition.

### J4 — Trace simulated execution

On Funding trace, an approved item advances one step at a time:

**Approved → Procurement requested → Funds released → Received.**

Transfers use the same statuses as a simplified demo workflow; no external order or payment is created. The UI shows released funds and an audit timeline.

**Acceptance:** statuses cannot skip; stale transitions conflict safely; released funds cannot exceed the saved plan cost; every transition records actor, timestamp, note, and previous/new status; the demo actor is clearly identified.

### J5 — Understand data and evidence

The user reviews dataset version, snapshot date, row counts, checksums, and quality findings; downloads synthetic source data; searches an illustrative evidence library; and asks a constrained evidence-assistant question.

**Acceptance:** unsupported assistant questions receive a bounded refusal; supported answers cite retrieved evidence and computed snapshot facts; the interface states that no LLM is connected; no answer can trigger an action.

### J6 — Export and teach

The user exports risk or plan CSVs and follows the demo script/workshop guide. Facilitators can explain the formulas and challenge assumptions without reading code.

**Acceptance:** exports contain provenance/demo labels and are spreadsheet-formula-safe; documentation matches actual behavior; setup and tests work from a clean checkout with Node 22.

## 6. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Load and validate a versioned synthetic dataset at startup | Must |
| FR-02 | Compute demand, cover, FEFO-aware stockout projection, expiry exposure, and risk | Must |
| FR-03 | Filter/sort risks and inspect calculation evidence | Must |
| FR-04 | Preview scenarios with validated budget, horizon, buffer, and district | Must |
| FR-05 | Enforce budget, donor surplus, product identity, route, cold-chain, and shelf-life constraints | Must |
| FR-06 | Show selected actions, unfunded needs, costs, and estimated before/after outcomes | Must |
| FR-07 | Save, approve, and advance plans with SQLite persistence and audit events | Must |
| FR-08 | Export CSV and grounded Markdown briefing | Must |
| FR-09 | Show data-quality and methodology pages | Must |
| FR-10 | Provide responsive keyboard-accessible UI with loading/error/empty states | Must |
| FR-11 | Optional provider-backed LLM adapter with citation/action gates | Later |
| FR-12 | Validated CSV/LMIS ingestion with quarantine and lineage | Later |
| FR-13 | Authenticated roles, tenant isolation, and production observability | Before real deployment |

## 7. Decision logic

- Forecast demand from 28 daily consumption observations using a documented mean/trend rule.
- Project stock day by day, consuming released batches first-expiry-first-out; add only confirmed arrivals on their expected dates.
- Report **Critical**, **Watch**, **Stable**, or **Unknown** using cover thresholds and data-quality gates. These are triage labels, not probabilities.
- Generate a replenishment gap for the planning horizon plus safety buffer.
- Consider same-product transfers from same-district donors with surplus and eligible shelf life.
- Use adaptive greedy cost-effectiveness ranking; recompute marginal needs after each selection. Do not call it a global optimum.
- Simulate selected arrivals and donor debits to estimate changes in stockout days and unmet demand.

Full formulas and failure modes: [Model card](docs/MODEL_CARD.md).

## 8. Data requirements

The demo uses fictional **Demo Republic**, three fictional districts, 18 facilities, five medicine product identifiers, and a fixed 2026-11-14 snapshot. Product names are illustrative; all quantities, prices, routes, and histories are synthetic. No personal data is collected.

Required entities: facilities, products, stock observations, consumption history, batches, inbound shipments, routes, and evidence snippets. Units and dates are explicit. Invalid structural records fail validation; stale or insufficient observations remain visible as quality issues and produce Unknown risk where appropriate.

See [Data contract](docs/DATA_CONTRACT.md) and `data/synthetic/manifest.json`.

## 9. UX requirements

- Calm, legible operational interface; risk conveyed by text and icon as well as color.
- Persistent synthetic-data and human-review notices.
- Sidebar navigation: Overview, Stockout risk, Scenario planner, Funding trace, Data & evidence, Methodology.
- Desktop tables and mobile-friendly stacked layouts; no horizontal page overflow.
- Visible focus, semantic headings, labeled controls, accessible dialogs, and live status announcements.
- No invented live feeds, authentication, notifications, or successful-payment messages.

## 10. Architecture and quality

React + TypeScript + Vite UI; Express API; shared deterministic domain functions; Node 22 built-in SQLite for demo persistence; Zod input validation; Vitest/Testing Library and browser smoke tests. One origin serves UI and `/api` routes. See [Architecture](docs/ARCHITECTURE.md).

Required checks: strict type checking, unit tests for forecasting/constraints/budget, API validation/persistence tests, component tests, production build, and browser walkthrough. Test results are recorded in [Testing](docs/TESTING.md), not assumed.

## 11. Success measures

### Prototype acceptance (measurable now)

- All required checks pass; clean production build.
- A reviewer completes the six journeys without editing code or supplying credentials.
- Budget and transfer invariants hold in automated tests.
- Every recommendation exposes a rationale and assumptions.
- No real personal data, secrets, or external procurement side effects.

### Pilot hypotheses (require real partners and baseline data)

- Reduce time to produce a reviewed district action list.
- Improve reporting completeness and reduce unknown-risk records.
- Measure stockout days, emergency orders, expiry losses, and planner acceptance against a baseline.
- Evaluate district/product subgroups and false alerts/missed shortages.

No real-world impact or hiring outcome is claimed by the synthetic demo.

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Synthetic patterns mistaken for evidence | Persistent labels, manifest, model card, no impact claims |
| Missing data treated as safety | Unknown gate and quality warnings |
| Greedy allocation disadvantages a facility | Expose unfunded needs, allow scope/budget changes, require review; future equity constraints |
| Transfer harms donor | Preserve donor target cover and shelf-life/cold-chain constraints |
| Demo action mistaken for payment | Explicit confirmation, simulated statuses, no external integrations |
| Shared local workspace mistaken for secure production | Document lack of auth; block real-data deployment until controls exist |
| LLM hallucination in a future release | Retrieval grounding, validated citations, deterministic tools, no autonomous actions |

## 13. Release plan

1. **v0.1:** this synthetic vertical slice, documentation, tests, live local preview.
2. **v0.2:** CSV ingestion/quarantine, richer evaluation/backtesting, sensitivity analysis, optional grounded LLM adapter.
3. **Partner pilot:** data-sharing agreement, local co-design, security/roles, workflow integration, prospective shadow evaluation.
4. **Scale:** modular connectors, monitoring, equity review, operational ownership and training.

See [Roadmap](docs/ROADMAP.md).

## 14. Open questions for co-design

- Which country/district and existing LMIS should anchor a pilot?
- What reporting cadence, stock definitions, and shipment confirmation rules are authoritative?
- Who can approve transfers and expenditure, and what equity constraints are mandatory?
- What shelf-life, cold-chain, transport, and cash-release delays apply locally?
- Which languages, offline/low-bandwidth modes, and training formats do users need?
- What baseline and outcome data can be shared ethically to evaluate usefulness?

These questions do not block a reversible synthetic prototype; they do block claims of deployment readiness.
