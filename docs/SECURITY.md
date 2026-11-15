# Security and privacy boundary

## Status: local synthetic demo, not production-ready

The application has one shared workspace and no login, authenticated roles, tenant isolation, or authenticated audit identity. Dashboard role views are a labeled demo simulation with server-side declared-scope validation, not an access-control boundary. `Demo analyst` is a label, not proof of who acted. The live preview is for demonstration with synthetic data only. Operator-controlled authorized aggregate mode is intended for non-public deployments and still requires production access controls.

## Implemented controls

- Runtime input validation with Zod and strict object schemas.
- Dataset schema/reference/reconciliation checks and SHA-256 manifest verification at startup.
- Integer-cent budget arithmetic and server-side recomputation on save.
- SQLite transactions for plan/item/audit writes; expected-state checks for transitions.
- Append-only audit events through the API (no update/delete endpoint).
- JSON body size limit; generic 500 errors without stack traces to clients.
- Same-origin mutation check for browser requests with an Origin header.
- Formula-safe CSV exports and explicit synthetic/demo labels.
- Helmet security headers; no secrets or external model keys required. Frame restrictions are relaxed only so the synthetic demo can appear in the Arena live-preview iframe; production must set explicit `frame-ancestors`.
- Gitignored local database, environment files, build output, and browser artifacts.
- No patient data fields, external procurement writes, or payment integrations.
- Country/location and clinical-policy gates fail closed for real-country allocation.
- Dashboard endpoints validate declared demo role/scope, reject mismatched active-country requests, and record local demo audit events; this does not replace authenticated RBAC.
- Production service worker caches only same-origin shell/dashboard GET responses for offline tolerance; do not enable real sensitive data without a reviewed caching/retention policy.
- Aggregate import preview rejects patient-level flags, direct identifier fields/values, country mismatch, and unreconciled batches.
- Optimizer output is independently re-checked for integer feasibility, budget, donor/batch/recipient caps, and fixed-cost consistency.

## Known limitations / production blockers

1. **Authentication/authorization:** add SSO/OIDC, role-based approvals, least privilege, and session security.
2. **Tenant isolation:** enforce country/district/organization boundaries in every query and export.
3. **Audit integrity:** authenticated actor identity, tamper-evident storage, retention, and review controls.
4. **Transport/hosting:** TLS, exact host/origin allowlists, rate limiting, WAF/bot controls as appropriate.
5. **Database:** replace or harden the experimental Node SQLite adapter; migrations, backups, encryption, restore tests, and connection management.
6. **Ingestion:** live custodian connectors, malware scanning, quarantine, source authentication, lineage, currency/unit normalization, and reconciliation before real data activation.
7. **Secrets:** managed secret storage and rotation; never commit `.env` or credentials.
8. **Observability:** privacy-preserving logs, metrics, alerts, error tracking, and incident response.
9. **Dependency/browser supply chain:** review updates, pin lockfiles, and run vulnerability checks in CI.
10. **Content security policy / framing:** CSP is disabled and frame restrictions are relaxed for the Vite/Arena demo; add a tested production CSP with explicit `frame-ancestors` before deployment.
11. **Shared preview state:** anyone with preview access can view/create demo plans. Do not enter sensitive notes.
12. **Ephemeral hosted storage:** the Vercel adapter stores demo workflow state in temporary function storage. It is not durable, backed up, or suitable for audit retention; state may reset between instances or deployments.
13. **Initialization error disclosure:** the Vercel adapter answers startup failures with a generic `503 SERVICE_INIT_FAILED` body plus an error class such as `ERR_MODULE_NOT_FOUND`; stacks go to the runtime logs only. `STOCKSENSE_DEBUG_ERRORS=true` adds the raw message and must stay unset on public deployments.

## Threat model highlights

| Threat | Current mitigation | Remaining work |
|---|---|---|
| Malformed input | Zod, size limit, prepared statements | Fuzzing, rate limits, auth |
| Budget tampering | Server recomputation, integer cents | Authorized scenario policies |
| Stale workflow update | Expected-status conflict | Authenticated concurrency controls |
| Spreadsheet formula injection | Cell prefix/escaping | Export policy and DLP |
| Cross-site mutation | Origin check | CSRF tokens with sessions, exact origins |
| Sensitive data in notes | Warning + synthetic-only policy | DLP, retention, access controls |
| Prompt injection | No LLM; bounded retrieval | Future LLM isolation/validation |
| Preview exposure | Synthetic data only | Private hosting/access control for pilots |
| Unauthorized real data activation | Public preview blocks activation; operator env gates | Authenticated operator roles, DSA verification, audit |
| Solver tolerance violating safety cap | Independent integer feasibility re-check | Formal verification/load testing at scale |

## Reporting

Do not open public issues containing sensitive data. For this portfolio demo, report security concerns to the repository owner through a private channel. Before any real pilot, establish a formal security contact and disclosure process.
