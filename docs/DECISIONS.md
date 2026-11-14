# Decision records

## ADR-001 — Focus the MVP on medicines availability and budget trace

**Status:** accepted. **Context:** the job spans financing flows, stockouts, and prioritization. **Decision:** build one coherent vertical slice—risk → budget-aware action → approval → simulated funding trace—rather than three shallow dashboards. **Consequence:** multi-country financing integration is explicitly deferred.

## ADR-002 — Synthetic data only

**Status:** accepted. **Decision:** fictional Demo Republic, fixed snapshot, deterministic generator, manifest checksum. **Why:** safe public portfolio demo without partner data agreements. **Consequence:** no real-world accuracy or impact claims; pilot requires governed ingestion.

## ADR-003 — Deterministic core before LLM

**Status:** accepted. **Decision:** transparent demand/FEFO/risk/greedy engines; bounded retrieval assistant; no connected LLM. **Why:** arithmetic and constraints must be auditable and reproducible without credentials. **Consequence:** future LLM is an optional summarization layer behind citation/action gates.

## ADR-004 — TypeScript monorepo with one origin

**Status:** accepted. **Decision:** React/Vite + Express + shared domain modules; Express serves Vite middleware in dev and built client in production. **Why:** shared contracts, simple preview, no browser localhost calls. **Consequence:** host allowlist must include the preview environment.

## ADR-005 — Node 22 built-in SQLite for demo workflow

**Status:** accepted. **Decision:** persist plans/items/audit in SQLite via `node:sqlite`; dataset remains versioned files. **Why:** durable local workflow without external services. **Consequence:** API is experimental in Node 22; isolate repository adapter and harden/replace before production.

## ADR-006 — Adaptive greedy allocation, not “AI optimizer” branding

**Status:** accepted. **Decision:** rank affordable candidates by marginal priority units per dollar, recompute state, expose unfunded needs. **Why:** understandable, testable, fast for the demo. **Consequence:** not globally optimal or normatively fair; future constrained optimization and equity rules required.

## ADR-007 — Procurement cannot repair pre-lead-time unmet demand

**Status:** accepted. **Decision:** compute procurement need from unmet demand after lead time plus ending safety shortfall; transfers can address earlier gaps. **Why:** prevents repeated orders that cannot arrive in time. **Consequence:** early gaps remain visible for faster action/escalation.

## ADR-008 — Explicit simulated workflow and audit

**Status:** accepted. **Decision:** approval confirmation, one-step transitions, expected-status checks, fixed demo actor, append-only events. **Why:** demonstrates governance without pretending to execute procurement/payments. **Consequence:** authenticated identity and source-system reconciliation are production blockers.

## ADR-009 — Project-local browser QA without global installs

**Status:** accepted. **Decision:** `agent-browser` and `@sparticuz/chromium` as dev dependencies; smoke test starts an isolated server/temporary DB. **Why:** reproducible QA in a restricted network sandbox. **Consequence:** browser package is large but excluded from Git via node_modules; normal Chrome can be supplied by environment variable.
