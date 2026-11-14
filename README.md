# StockSense Africa

**Essential-medicines supply intelligence — an explainable, synthetic-data portfolio prototype.**

StockSense helps a district planner move from stockout risk to a budget-aware action plan, then review and trace simulated procurement and cash release. It is inspired by the Gates Foundation AI Fellows (Africa) role, but is an independent demonstration—not an official foundation product or a claim of real-world impact.

> **Demo only:** fictional facilities and synthetic data. No patient records, live payments, procurement writes, or connected LLM. Human review is required.

## What works

- Network overview and filterable stockout-risk register.
- FEFO-aware stock projection, expiry exposure, confirmed inbound shipments, and Unknown-data handling.
- Explainable risk calculations and item-level evidence.
- Exact HiGHS MILP replenishment/transfer scenarios with optimality certificates, donor, shelf-life, route, and cold-chain checks.
- Country/location profiles, authorized aggregate import preview, and gated clinical-policy configuration.
- Saved plans, explicit demo approval, stepwise funding trace, and append-only audit history in SQLite.
- CSV exports, grounded briefing, searchable evidence library, and a bounded retrieval assistant.
- Data-quality/provenance and methodology pages.
- Responsive UI, strict TypeScript, automated tests, and browser smoke walkthrough.

## Quick start

Requires **Node.js 22.13+** and npm. No API keys are needed.

```bash
npm ci
npm run dev
```

Open the live preview, or http://localhost:3000 locally. The server binds to `0.0.0.0` and serves both the UI and `/api` on one origin. The synthetic dataset seeds automatically; demo plans persist in `.data/stocksense.sqlite` (gitignored).

```bash
npm run check       # types + tests + production build
npm run preview     # serve the built client without watch mode
npm start           # run the production bundle after npm run build
npm run build && npm run test:e2e  # isolated browser walkthrough
```

Optional configuration: copy `.env.example` to `.env` and load it with your process manager. The app reads process environment variables; it does not silently upload data or require external services. Node 22 may print an experimental warning for its built-in SQLite API; the demo isolates that adapter.

Browser QA uses project-local `agent-browser` and an npm-distributed Chromium dev dependency, so it does not require a global browser install. See [Testing](docs/TESTING.md) and [Operations](docs/OPERATIONS.md).

## Try the demo

1. Open **Stockout risk**, filter a district, and inspect an item's calculation.
2. Open **Scenario planner**, set a budget, and run a scenario.
3. Review selected and unfunded actions, then save and explicitly approve a demo plan.
4. Open **Funding trace** and advance an item through the simulated workflow.
5. Export a CSV, inspect **Data & evidence**, and read **Methodology**.

A facilitator-friendly walkthrough is in [Demo script](docs/DEMO_SCRIPT.md).

## Documentation

| Document | Purpose |
|---|---|
| [PRD](prd.md) | Users, scope, journeys, requirements, acceptance criteria |
| [Architecture](docs/ARCHITECTURE.md) | Stack, modules, data flow, deployment boundary |
| [API](docs/API.md) | Endpoints, validation, errors, examples |
| [Data contract](docs/DATA_CONTRACT.md) | Schemas, units, provenance, quality gates |
| [Country data](docs/COUNTRY_DATA.md) | Location profiles, authorized aggregate ingestion, privacy gates |
| [Model card](docs/MODEL_CARD.md) | Formulas, assumptions, evaluation, limitations |
| [Responsible AI](docs/RESPONSIBLE_AI.md) | Equity, privacy, human oversight, LLM gates |
| [Security & privacy](docs/SECURITY.md) | Demo threat model and production blockers |
| [Testing](docs/TESTING.md) | Automated checks and manual acceptance |
| [Roadmap](docs/ROADMAP.md) | Fellowship-aligned delivery phases |
| [Demo script](docs/DEMO_SCRIPT.md) | Reviewer walkthrough |
| [Capacity-building playbook](docs/PLAYBOOK.md) | Workshop and adoption guide |
| [Decisions](docs/DECISIONS.md) | Architecture/product decision records |
| [Operations](docs/OPERATIONS.md) | Run, backup, reset, troubleshoot |
| [Contributing](CONTRIBUTING.md) | Development conventions |
| [Changelog](CHANGELOG.md) | Release history |

## Project layout

```text
src/                 React UI and styles
server/              Express API, SQLite repository, startup
shared/              Validated types, forecasting, risk, planner, exports
data/synthetic/      Versioned demo inputs, evidence, manifest
scripts/             Deterministic data generation and browser smoke test
tests/               Domain, API, and component tests
docs/                Product, engineering, safety, and teaching documents
.claude/skills/      Project-local agent skills
```

## Important limits

The forecast is a transparent baseline, not a calibrated probability. Allocation is an exact fixed-charge integer-flow MILP, globally optimal for the modeled problem and objective—not a clinical priority rule or real-world impact guarantee. The public demo uses synthetic data; real-country use requires authorized aggregate data and a locally approved clinical policy. Patient-level records are rejected. Transfers are limited to exact products within configured routes. The funding workflow is a simulation. Authentication, live custodian connectors, and prospective evaluation are required before any pilot.

See the [model card](docs/MODEL_CARD.md) and [security boundary](docs/SECURITY.md) before adapting this project.
