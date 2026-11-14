# Security and privacy boundary

## Status: local synthetic demo, not production-ready

The application has one shared workspace and no login, roles, tenant isolation, or authenticated audit identity. `Demo analyst` is a label, not proof of who acted. The live preview is for demonstration with synthetic data only.

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

## Known limitations / production blockers

1. **Authentication/authorization:** add SSO/OIDC, role-based approvals, least privilege, and session security.
2. **Tenant isolation:** enforce country/district/organization boundaries in every query and export.
3. **Audit integrity:** authenticated actor identity, tamper-evident storage, retention, and review controls.
4. **Transport/hosting:** TLS, exact host/origin allowlists, rate limiting, WAF/bot controls as appropriate.
5. **Database:** replace or harden the experimental Node SQLite adapter; migrations, backups, encryption, restore tests, and connection management.
6. **Ingestion:** malware scanning, quarantine, source authentication, lineage, and reconciliation before real connectors.
7. **Secrets:** managed secret storage and rotation; never commit `.env` or credentials.
8. **Observability:** privacy-preserving logs, metrics, alerts, error tracking, and incident response.
9. **Dependency/browser supply chain:** review updates, pin lockfiles, and run vulnerability checks in CI.
10. **Content security policy / framing:** CSP is disabled and frame restrictions are relaxed for the Vite/Arena demo; add a tested production CSP with explicit `frame-ancestors` before deployment.
11. **Shared preview state:** anyone with preview access can view/create demo plans. Do not enter sensitive notes.

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

## Reporting

Do not open public issues containing sensitive data. For this portfolio demo, report security concerns to the repository owner through a private channel. Before any real pilot, establish a formal security contact and disclosure process.
