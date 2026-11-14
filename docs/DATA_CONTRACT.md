# Data contract and provenance

## Status and source

All records are **synthetic**. `Demo Republic`, its districts, facilities, quantities, prices, routes, and consumption histories are fictional. Real medicine names are used only as recognizable product labels; nothing here is clinical guidance. The fixed analysis date is **2026-11-14**. Regenerate with `npm run data:generate`; the generator is deterministic and writes a manifest with SHA-256 checksums.

## Entities

### Dataset envelope
- `version`: semantic dataset version.
- `asOf`: ISO date used for all calculations.
- `country`: display name.
- `countryCode`: optional location code (`DEMO`, `NG`, `ET`, `ZA`, `KE`); defaults to `DEMO` for the synthetic snapshot.
- `currency`: `USD` for synthetic comparison only.
- `districts`, `facilities`, `products`, `stocks`, `routes`, `evidence`.

### Facility
`id`, `name`, `districtId`, `type` (`hospital|health_centre|clinic`). IDs are stable within the demo. No coordinates or personal identifiers are included.

### Product
`id`, `name`, `form`, `unit`, `essential`, `coldChain`, `unitCostCents`, `minRemainingShelfLifeDays`, `shelfLifeDays`. Product identity includes the exact identifier; the planner never substitutes a different strength/form.

### Stock observation
One record per `(facilityId, productId)`:
- `reportedAt`: ISO date; older than 7 days raises a freshness warning.
- `usableUnits`: released, non-expired units at the snapshot.
- `quarantinedUnits`: excluded from availability.
- `history`: up to 28 daily consumption counts, oldest first; fewer than 14 observations or zero total demand prevents a confident risk label.
- `batches`: `id`, `quantity`, `expiryDate`, `status` (`released|quarantined`). Released batch quantities must reconcile to usable units after excluding expired batches.
- `inbound`: `id`, `quantity`, `expectedDate`, `expiryDate`, `status` (`confirmed|planned`). Only confirmed arrivals enter the projection; expected batch expiry is explicit rather than silently imputed.
- `leadTimeDays`: assumed replenishment lead time after authorization.

### Route
`fromFacilityId`, `toFacilityId`, `days`, `costCents`, `coldChainCapable`, `sameDistrict`. v0.1 only uses explicitly present same-district routes; it does not infer roads or geographic feasibility.

### Evidence
`id`, `title`, `category`, `text`, `source`. Snippets are illustrative demo guidance, not external clinical or financial policy. Answers must cite their IDs.

## Units and money

Quantities are integer product units (e.g., tablets, vials, packs) and are never summed across products as if clinically equivalent. Network totals count **records/items**, not interchangeable medicines. Money is integer USD cents; budget comparisons are exact. Costs and lead times are synthetic assumptions.

## Validation layers

1. **Structural:** Zod schemas reject malformed dates, negative counts, unknown references, duplicate keys, invalid statuses, and inconsistent batch totals.
2. **Quality:** stale reports, short/zero history, near-expiry batches, and planned-only inbound are surfaced without silently imputing safety.
3. **Decision gates:** stale/insufficient observations produce Unknown risk and are excluded from automatic allocation until reviewed.
4. **Workflow:** saved plans snapshot the dataset hash and computed result; later dataset changes do not rewrite history.

## Expiry and FEFO

Expired and quarantined batches are unavailable. Projection consumes released batches first-expiry-first-out and removes batches when they expire. Transfers carry the donor batch expiry and must retain the product's minimum remaining shelf life after arrival. Procurement assumes a new batch with the product's nominal shelf life; this assumption is displayed.

## Privacy and retention

No patient-level fields, credentials, or real facility identifiers are accepted by the public demo. Operator-controlled authorized aggregate mode may contain real facility/product aggregates only after data-sharing authorization; it still rejects patient-level fields and direct identifiers. SQLite contains plan names, notes, statuses, settings, and the fixed demo actor. Do not enter real sensitive information in plan notes. Local database retention/reset is operator-controlled; see [Operations](OPERATIONS.md).

## Authorized aggregate ingestion contract

See [Country data connections](COUNTRY_DATA.md). An aggregate pack adds provenance: country code, source-system ID, authorization reference, data-use purpose, extract timestamp, observation period, transformation version, `patientLevelData: false`, and `aggregateOnly: true`. The dataset must pass the same structural/reconciliation checks. Preview validates and hashes the pack but does not activate it. Operator activation requires authorization attestation and a locally approved clinical policy. A live connector must additionally authenticate the custodian endpoint, quarantine row-level errors, normalize units/currency, and prevent cross-tenant leakage before any model runs.
