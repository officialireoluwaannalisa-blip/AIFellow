# API reference

Base path: `/api`. All responses are JSON unless an export is requested. The public demo has **no authentication**; the audit actor is the fixed label `Demo analyst`. Do not expose this API to real data or untrusted networks.

## Conventions

- Input validation: Zod; invalid bodies/queries return `400`.
- Unknown resources/scopes: `404`. Invalid/stale state transitions, cross-origin mutations, or allocation gates: `409`.
- Error shape: `{ "error": { "code": "...", "message": "...", "details": [{ "path": "...", "message": "..." }] } }`.
- JSON body limit: 32 KB, except `/imports/preview` which allows 2 MB. Money: integer USD cents. Dates: `YYYY-MM-DD` for snapshot data; audit timestamps are ISO UTC.
- Mutations with an `Origin` header must match the request host, an Arena `.e2b.app` preview host, or a configured exact allowed host.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness, data mode, country code, dataset version/date |
| GET | `/meta` | Districts, facilities, products, manifest, quality, defaults, location, clinical-policy summary |
| GET | `/countries` | Country profiles, connection state, allocation gate reason |
| GET | `/location` | Active location and allocation gate |
| PUT | `/location` | Set location `{ "countryCode": "NG" }`; does not import data |
| POST | `/imports/preview` | Validate an authorized aggregate pack; preview only, no activation |
| GET | `/overview?districtId=&horizonDays=30` | Network counts, district summary, top risks |
| GET | `/risks?districtId=&productId=&risk=all&q=&horizonDays=30` | Filtered, urgency-sorted assessments |
| GET | `/risks/:facilityId/:productId` | Full assessment and projection evidence |
| POST | `/scenarios/preview` | Recompute an exact MILP scenario |
| GET | `/plans` | Up to 100 saved plans with snapshots/items/audit |
| POST | `/plans` | Save a server-recomputed scenario |
| GET | `/plans/:id` | Saved plan detail |
| POST | `/plans/:id/approve` | Explicit demo approval |
| POST | `/plans/:id/items/:itemId/advance` | One-step simulated workflow transition |
| GET | `/evidence?q=` | Search illustrative evidence snippets |
| POST | `/assistant` | Bounded retrieval answer; no LLM |
| GET | `/briefing?districtId=` | Download grounded Markdown briefing |
| GET | `/export/risks.csv?...` | Download formula-safe risk CSV |
| GET | `/export/plans/:id.csv` | Download formula-safe plan CSV with optimizer/policy columns |
| GET | `/data/manifest` | Provenance manifest |
| GET | `/data/seed.json` | Download active dataset (synthetic in public demo) |

## Scenario input

```json
{
  "budgetCents": 2500000,
  "horizonDays": 30,
  "bufferDays": 7,
  "districtId": null,
  "countryCode": "DEMO"
}
```

`horizonDays` ∈ {14, 30, 60}; `bufferDays` ∈ [0, 14]; `budgetCents` ∈ [0, 100000000]. `districtId` is null or a known district ID. `countryCode` is optional and defaults to the active dataset country. It must match the active dataset; real-country allocation fails closed without authorized aggregate data and an approved clinical policy.

Preview returns selected actions, unfunded needs, exact totals, before/after estimates, assumptions, dataset version/hash, snapshot date, clinical-policy summary, and an optimization certificate:

```json
{
  "optimization": {
    "solver": "HiGHS",
    "solverVersion": "1.15.4",
    "status": "optimal",
    "objective": "lexicographic_weighted_units_then_cost",
    "objectiveValue": 53694900,
    "costCents": 2499966,
    "relativeGap": 0,
    "candidateCount": 113,
    "variableCount": 226,
    "constraintCount": 210,
    "solveTimeMs": 3226,
    "modelSha256": "…",
    "scope": "modeled_integer_flow_problem"
  }
}
```

If HiGHS cannot certify optimality, or independent feasibility checks fail, no plan is returned.

## Aggregate import preview

```json
{
  "provenance": {
    "countryCode": "NG",
    "sourceName": "Authorized district aggregate stock extract",
    "sourceSystemId": "lmis-custodian-id",
    "authorizationReference": "signed-DSA-reference",
    "dataUsePurpose": "District essential-medicines supply planning",
    "extractedAt": "2026-11-14T08:00:00Z",
    "observationStart": "2026-10-18",
    "observationEnd": "2026-11-14",
    "transformationVersion": "aggregate-v1",
    "patientLevelData": false,
    "aggregateOnly": true
  },
  "dataset": { "countryCode": "NG", "...": "see DATA_CONTRACT.md" }
}
```

Returns accepted/rejected row counts, issues, quality report, SHA-256, country summary, and `activationBlocked: true` in the public demo. Patient-level fields and obvious direct identifiers are rejected. Preview never activates data.

## Save and idempotency

```json
{
  "name": "District replenishment review",
  "scenario": { "budgetCents": 2500000, "horizonDays": 30, "bufferDays": 7, "districtId": null, "countryCode": "DEMO" },
  "idempotencyKey": "6f1e2f1e-1111-4111-8111-111111111111"
}
```

The server recomputes the scenario; client totals are never trusted. Reusing the same UUID returns the existing plan without creating a duplicate. Names are 3–100 characters. Notes are at most 500 characters and must not contain real sensitive data.

## Workflow

Item statuses:

`proposed → approved → procurement_requested → funds_released → received`

Approval body: `{ "note": "optional" }`. Advance body:

```json
{ "expectedStatus": "approved", "note": "optional" }
```

The expected status must match the current item status. Skipping steps, advancing a draft plan, repeating approval, or advancing a received item returns `409`. Transfers use the same simplified statuses; no external order, stock movement, or payment occurs.

## Assistant

```json
{ "question": "How is missing data handled?", "districtId": null }
```

Returns `{ mode: "retrieval", answer, facts, citations }`. Clinical/patient-specific questions are refused. Unsupported questions receive a bounded refusal. The assistant cannot mutate state.

## Examples

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/countries
curl -X PUT http://localhost:3000/api/location \
  -H 'Content-Type: application/json' -d '{"countryCode":"NG"}'
curl -X POST http://localhost:3000/api/scenarios/preview \
  -H 'Content-Type: application/json' \
  -d '{"budgetCents":1000000,"horizonDays":30,"bufferDays":7,"districtId":null,"countryCode":"DEMO"}'
```
