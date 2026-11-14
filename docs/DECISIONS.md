# Decision records

## ADR-001 — Focus the MVP on medicines availability and budget trace

**Status:** accepted. **Context:** the job spans financing flows, stockouts, and prioritization. **Decision:** build one coherent vertical slice—risk → budget-aware action → approval → simulated funding trace—rather than three shallow dashboards. **Consequence:** multi-country financing integration is explicitly deferred.

## ADR-002 — Synthetic data only

**Status:** accepted. **Decision:** fictional Demo Republic, fixed snapshot, deterministic generator, manifest checksum. **Why:** safe public portfolio demo without partner data agreements. **Consequence:** no real-world accuracy or impact claims; pilot requires governed ingestion.

## ADR-003 — Deterministic core before LLM

**Status:** accepted. **Decision:** transparent demand/FEFO/risk engines, exact MILP allocation, bounded retrieval assistant; no connected LLM. **Why:** arithmetic and constraints must be auditable and reproducible without credentials. **Consequence:** future LLM is an optional summarization layer behind citation/action gates.

## ADR-004 — TypeScript monorepo with one origin

**Status:** accepted. **Decision:** React/Vite + Express + shared domain modules; Express serves Vite middleware in dev and built client in production. **Why:** shared contracts, simple preview, no browser localhost calls. **Consequence:** host allowlist must include the preview environment.

## ADR-005 — Node 22 built-in SQLite for demo workflow

**Status:** accepted. **Decision:** persist plans/items/audit in SQLite via `node:sqlite`; dataset remains versioned files. **Why:** durable local workflow without external services. **Consequence:** API is experimental in Node 22; isolate repository adapter and harden/replace before production.

## ADR-006 — Adaptive greedy allocation (superseded)

**Status:** superseded by ADR-010. **Decision:** v0.1 ranked affordable candidates by marginal priority units per dollar. **Why:** understandable initial baseline. **Consequence:** retained only as historical context; the active engine is exact MILP.

## ADR-007 — Procurement cannot repair pre-lead-time unmet demand

**Status:** accepted. **Decision:** compute procurement need from unmet demand after lead time plus ending safety shortfall; transfers can address earlier gaps. **Why:** prevents repeated orders that cannot arrive in time. **Consequence:** early gaps remain visible for faster action/escalation.

## ADR-008 — Explicit simulated workflow and audit

**Status:** accepted. **Decision:** approval confirmation, one-step transitions, expected-status checks, fixed demo actor, append-only events. **Why:** demonstrates governance without pretending to execute procurement/payments. **Consequence:** authenticated identity and source-system reconciliation are production blockers.

## ADR-009 — Project-local browser QA without global installs

**Status:** accepted. **Decision:** `agent-browser` and `@sparticuz/chromium` as dev dependencies; smoke test starts an isolated server/temporary DB. **Why:** reproducible QA in a restricted network sandbox. **Consequence:** browser package is large but excluded from Git via node_modules; normal Chrome can be supplied by environment variable.

## ADR-010 — Exact fixed-charge integer-flow MILP

**Status:** accepted. **Decision:** replace greedy selection with HiGHS WASM MILP. Stage 1 maximizes weighted units; stage 2 minimizes cost without reducing benefit. Require `Optimal`, zero gap, and independent integer feasibility checks. **Why:** the user requested global optimality; fixed charges and shared batch caps make greedy selection insufficient. **Consequence:** optimality is scoped to the modeled problem, not real-world clinical utility; solver timing is excluded from determinism comparisons.

## ADR-011 — Country-aware authorized aggregate ingestion only

**Status:** accepted. **Decision:** add country profiles, location setting, aggregate-pack preview, and operator-controlled file ingestion. Reject patient-level records and direct identifiers. Public demo remains synthetic; real-country activation requires authorization attestation and a non-public deployment. **Why:** nation/location-aware data is required, but patient records and unapproved government extracts cannot be safely ingested. **Consequence:** live government API connectors remain unconnected until custodian endpoints and agreements are supplied.

## ADR-012 — Clinical policy is a gated governance artifact

**Status:** accepted. **Decision:** separate enforceable safety guardrails from locally approved prioritization weights. Synthetic demo weights are labeled; real-country allocation requires an approved jurisdiction-matched policy. Autonomous execution is always disabled. **Why:** clinical prioritization is a local governance decision, not an invented app default. **Consequence:** real-country planning fails closed until policy and data gates pass.
