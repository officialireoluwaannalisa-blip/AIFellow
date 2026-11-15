# Country-aware authorized data connections

## Status

The public demo remains synthetic. Country profiles configure **where authorized aggregate data would come from** and what governance gates apply; they do not claim live government API access. No patient-level records are accepted. Real-country allocation is blocked until an operator activates an authorized aggregate pack and a locally approved clinical policy in a non-public deployment.

## Supported location profiles

| Code | Location | Health authority entry point | Data-protection reference | Connection state in public demo |
|---|---|---|---|---|
| `DEMO` | Demo Republic | Synthetic demonstration | Synthetic data only | Active synthetic demo |
| `NG` | Nigeria | Federal Ministry of Health portal | Nigeria Data Protection Act 2023 (NDPA) | Not connected |
| `BF` | Burkina Faso | Ministry of Health (verify custodian) | Loi n°010-2004/AN; verify current amendments and health-data rules | Not connected |
| `ET` | Ethiopia | Ministry of Health portal | Personal Data Protection Proclamation No. 1321/2024 | Not connected |
| `ZA` | South Africa | National Department of Health portal | Protection of Personal Information Act (POPIA) | Not connected |
| `KE` | Kenya | Ministry of Health portal | Data Protection Act 2019; health-data governance requirements | Not connected |

Portal entry points:

- Nigeria: https://health.gov.ng/ and https://ndpc.gov.ng/
- Burkina Faso: https://www.cil.bf/ (data-protection regulator; health-data custodian still to be verified)
- Ethiopia: https://moh.gov.et/
- South Africa: https://www.health.gov.za/
- Kenya: https://www.health.go.ke/

These are reference entry points, not verified machine-to-machine endpoints. Before connecting, confirm the current data custodian, aggregate extract schema, authorization terms, retention rules, and whether subnational approval is required. Legal references are operational reminders, not legal advice.

## Ingestion boundary

Accepted input is an **authorized aggregate pack**:

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
  "dataset": {
    "version": "ng-aggregate-2026.11.14-v1",
    "asOf": "2026-11-14",
    "country": "Nigeria",
    "countryCode": "NG",
    "currency": "USD",
    "districts": [],
    "facilities": [],
    "products": [],
    "stocks": [],
    "routes": [],
    "evidence": []
  }
}
```

The dataset must satisfy the same structural contract as the demo: exact product IDs, integer units, batch reconciliation, explicit inbound expiry, known references, and route feasibility. Money remains integer USD cents in this prototype; local-currency normalization and FX provenance are a pilot adapter requirement.

## Privacy and quality gates

1. `patientLevelData` must be `false`; `aggregateOnly` must be `true`.
2. Direct identifier fields and obvious contact values are rejected by key/value scanning.
3. Country code must match between provenance and dataset.
4. Batch totals must reconcile; stale/short/zero history remains visible as Unknown.
5. Preview returns row counts, issues, quality report, and SHA-256. It does **not** activate data.
6. Operator activation requires `DATA_SHARING_AUTHORIZED=true`, `AUTHORIZED_AGGREGATE_PACK_PATH`, and `CLINICAL_POLICY_PATH`.
7. The clinical policy must be approved, non-synthetic, and jurisdiction-matched.
8. Human approval remains required before any simulated or real workflow execution.

## Operator validation

```bash
npm run data:validate-import -- /secure/path/aggregate-pack.json /secure/path/clinical-policy.json
```

The command exits non-zero when validation or policy matching fails. It is a pre-ingestion check, not an authorization grant.

## What is still required for a real connector

- Signed data-sharing agreement and lawful basis review.
- Source authentication, endpoint allowlist, TLS, and secret management.
- Aggregate extraction schedule, observation period, and unit normalization.
- Row-level quarantine lineage and reconciliation with the custodian.
- Authenticated roles, tenant/country isolation, audit identity, and retention/deletion.
- Local clinical governance approval of prioritization weights and safety rules.
- Prospective shadow evaluation before operational recommendations.

Do not paste real patient records, sensitive government extracts, or credentials into the public demo or issue tracker.

## Public reference checks

These references informed the initial profile reminders and are not a substitute for local legal review:

- Burkina Faso CIL official reference: [1](https://www.cil.bf/index.php/la-cil/nous-ecrire)
- Nigeria health-sector NDPA overview: [3](https://healthlaw.com.ng/wp-content/uploads/2024/03/Nigeria-Data-Protection-Legislation-and-the-Health-Sector-1.pdf)
- Ethiopia Personal Data Protection Proclamation overview: [3](https://www.lolinemag.com/articles/ethiopia-data-protection-law-explained)
- South Africa Department of Health contact directory: [1](https://www.gov.za/about-government/contact-directory/departments/health-department)
- Kenya Health Data Governance Framework reference: [2](https://transformhealthcoalition.org/wp-content/uploads/2026/09/Kenya-Health-Data-Governance-Framework.pdf)
