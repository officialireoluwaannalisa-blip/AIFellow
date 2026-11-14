# Dashboard overview

The dashboard is the default workspace view (`/`). It reuses the same synthetic/authorized dataset, domain risk engine, and exact MILP planner as the rest of StockSense. It does not introduce a second recommendation formula.

## Role views

| Role | Scope | Primary panels | Actions |
|---|---|---|---|
| National/MoH leadership | Country, optional region/district drill-down | Summary strip, schematic risk map, top 5 interventions, bottlenecks, budget vs plan, 30/60/90 forecast | Export briefing, review recommendation |
| Supply-chain & financing officers | Country/region/district/facility | Pipeline from saved demo plans, ranked interventions, expiry/redistribution alerts, risk table | Review recommendation, open planner/funding trace |
| District health management team | Locked to a district (demo default: first district) | District map, facilities at risk, urgent actions, alerts, budget | Record district support request |
| Facility users | Locked to a facility (demo default: first facility) | Risk-sorted stock, days cover, upcoming deliveries, recent receipts/requests | Request support, confirm receipt, report discrepancy, usage note |
| Foundation/partners | Active country; other profiles shown as not connected | Country comparison, goals, local prototype metrics, notes | Save annotation, export briefing |

**Important:** role switching is a demo simulation. There is no authentication, identity provider, or production authorization boundary in this release. Server endpoints validate the declared demo role and scope, but a real pilot must replace this with authenticated RBAC before handling real government data.

## Filters and search

Country → region → district → facility, commodity, 30/60/90-day period, and text search are URL-backed. Region/district/facility selections clear invalid descendants. Facility and district roles keep their scope lock. The 90-day view forecasts 90 days but ranks interventions with the supported 60-day allocation horizon; the UI states this explicitly.

## Explainability and audit

Every ranked intervention has a short “Why this?” dialog plus the planner rationale. Dashboard decisions (support requests, receipt confirmations, discrepancies, usage notes, partner annotations, recommendation reviews, briefing exports) are stored in SQLite and shown in the audit trail. Plan approval/funding transitions remain in the existing plan audit log.

## Offline and low-bandwidth behavior

- A production service worker caches the app shell and last successful dashboard response.
- The page also keeps a role-local localStorage snapshot and shows an offline/cached banner.
- Facility requests can be queued locally and synced when connectivity returns.
- No map tiles, external fonts, or third-party analytics are required. The map is a lightweight schematic SVG, not verified geography.
- Tables use semantic headers and stack into labeled rows in narrow containers.

## Data additions

The synthetic seed now includes optional `regions`, district `regionId`, and facility `mapPosition` fields. These are schematic demo coordinates only. Authorized aggregate packs may supply real region/district structure; map coordinates remain optional. No real country financing, adoption, or outcome data is fabricated.

## API

- `GET /api/dashboard` — role-scoped dashboard payload.
- `GET /api/dashboard/briefing` — markdown briefing; leadership/supply-chain/partner only.
- `POST /api/dashboard/support` — district/facility request, receipt confirmation, discrepancy, or usage note.
- `POST /api/dashboard/notes` — partner annotation for the active country.
- `POST /api/dashboard/audit` — record recommendation review/export/decision events.

See `docs/API.md` for schemas and status codes.
