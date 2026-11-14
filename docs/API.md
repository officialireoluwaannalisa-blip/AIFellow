# API reference

Base path: `/api`. All responses are JSON unless an export is requested. The demo has **no authentication**; the audit actor is the fixed label `Demo analyst`. Do not expose this API to real data or untrusted networks.

## Conventions

- Input validation: Zod; invalid bodies/queries return `400`.
- Unknown resources/scopes: `404`. Invalid/stale state transitions or cross-origin mutations: `409`.
- Error shape: `{ "error": { "code": "...", "message": "...", "details": [{ "path": "...", "message": "..." }] } }`.
- JSON body limit: 32 KB. Money: integer USD cents. Dates: `YYYY-MM-DD` for snapshot data; audit timestamps are ISO UTC.
- Mutations with an `Origin` header must match the request host, an Arena `.e2b.app` preview host, or a configured exact allowed host.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness, demo flag, dataset version/date |
| GET | `/meta` | Districts, facilities, products, manifest, quality, defaults |
| GET | `/overview?districtId=&horizonDays=30` | Network counts, district summary, top risks |
| GET | `/risks?districtId=&productId=&risk=all&q=&horizonDays=30` | Filtered, urgency-sorted assessments |
| GET | `/risks/:facilityId/:productId` | Full assessment and projection evidence |
| POST | `/scenarios/preview` | Recompute a budget-aware scenario |
| GET | `/plans` | Up to 100 saved plans with snapshots/items/audit |
| POST | `/plans` | Save a server-recomputed scenario |
| GET | `/plans/:id` | Saved plan detail |
| POST | `/plans/:id/approve` | Explicit demo approval |
| POST | `/plans/:id/items/:itemId/advance` | One-step simulated workflow transition |
| GET | `/evidence?q=` | Search illustrative evidence snippets |
| POST | `/assistant` | Bounded retrieval answer; no LLM |
| GET | `/briefing?districtId=` | Download grounded Markdown briefing |
| GET | `/export/risks.csv?...` | Download formula-safe risk CSV |
| GET | `/export/plans/:id.csv` | Download formula-safe plan CSV |
| GET | `/data/manifest` | Provenance manifest |
| GET | `/data/seed.json` | Download synthetic dataset |

## Scenario input

```json
{
  "budgetCents": 2500000,
  "horizonDays": 30,
  "bufferDays": 7,
  "districtId": null
}
```

`horizonDays` ∈ {14, 30, 60}; `bufferDays` ∈ [0, 14]; `budgetCents` ∈ [0, 100000000]. `districtId` is null or a known district ID. Preview returns selected actions, unfunded needs, exact totals, before/after estimates, assumptions, dataset version/hash, and snapshot date.

## Save and idempotency

```json
{
  "name": "District replenishment review",
  "scenario": { "budgetCents": 2500000, "horizonDays": 30, "bufferDays": 7, "districtId": null },
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
curl 'http://localhost:3000/api/risks?districtId=central&risk=critical'
curl -X POST http://localhost:3000/api/scenarios/preview \
  -H 'Content-Type: application/json' \
  -d '{"budgetCents":1000000,"horizonDays":30,"bufferDays":7,"districtId":null}'
```
