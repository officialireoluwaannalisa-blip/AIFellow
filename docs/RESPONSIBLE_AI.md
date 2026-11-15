# Responsible AI policy

## Principle

Use AI only where it improves a real decision, and keep arithmetic, constraints, and authority in auditable systems. This prototype is decision support for supply planning—not clinical care, autonomous allocation, or a validated impact intervention.

## Current AI/automation boundary

- Forecasting is a deterministic documented baseline. Allocation is an exact MILP with a scoped optimality certificate, not an autonomous clinical authority.
- The evidence assistant is bounded retrieval over synthetic guidance and computed facts. **No LLM is connected.**
- No component can create a real purchase order, move stock, release funds, or message a patient.
- Human approval is required before simulated workflow advancement.

## Equity and fairness

1. Missing/stale data produces Unknown, not low risk. The quality queue is part of the workflow.
2. Unfunded needs remain visible; budget exhaustion is not presented as “no need.”
3. Product priority weights are explicit demo assumptions unless supplied by a locally approved clinical policy; they are not claims about whose health matters more.
4. Real-country clinical prioritization fails closed until an approved jurisdiction-matched policy is present. Autonomous execution is disabled.
5. Donor facilities retain modeled buffer; transfers cannot silently externalize shortage risk.
6. Before any pilot, review outcomes by district, facility type, product, and reporting completeness; add locally agreed minimum-service/equity constraints.
7. Do not optimize only for aggregate units while ignoring remote facilities or cold-chain access.

## Privacy and data governance

- Public demo is synthetic only. Operator-controlled authorized aggregate mode rejects patient identifiers and requires data-sharing authorization plus local clinical approval.
- Plan notes are stored locally; users are warned not to enter sensitive information.
- A real deployment requires a lawful basis/data-sharing agreement, purpose limitation, minimization, retention schedule, access controls, and deletion procedures.
- Do not send row-level health, financial, or personal data to an external model without explicit authorization and an approved processing arrangement.

## Explainability and contestability

Every risk exposes inputs, projection, batches, inbound status, and quality flags. Every action exposes quantity, cost, arrival assumption, and rationale. Scenario assumptions and unfunded needs are visible. A reviewer can change scope/budget, reject a plan, or export evidence. Production workflows need a formal override/appeal path and recorded reasons.

## Future LLM gates

An optional LLM adapter may be added only if it passes all of these gates:

1. **Grounding:** retrieve approved evidence and deterministic tool outputs; include source IDs and dataset version.
2. **No invented facts:** the model may not infer missing stock as zero, create citations, or alter arithmetic.
3. **Structured output:** validate schema, citation existence, and numeric consistency against tool results.
4. **No action authority:** model output cannot approve plans, advance funding, or write to source systems.
5. **Privacy:** minimize/redact context; use an approved endpoint; log metadata rather than sensitive payloads.
6. **Evaluation:** test hallucination, citation accuracy, refusal, prompt injection, subgroup language/accessibility, and latency/cost.
7. **Fallback:** deterministic briefing remains available when the model is unavailable or fails validation.
8. **Human factors:** label generated text, show sources, and let users report incorrect answers.

## Evaluation before impact claims

Synthetic invariant tests are necessary but insufficient. A pilot needs rolling-origin backtests, comparison to current practice, alert precision/recall, missed-shortage review, planner time/burden, subgroup analysis, and prospective shadow-mode evaluation. Stockout days, emergency orders, and expiry losses require baseline and follow-up data. Do not claim causality from a demo.

## Incident handling

If a recommendation appears unsafe or wrong: stop use, preserve the plan/dataset version and audit trail, record the issue, revert to manual review, and investigate data quality/model assumptions before re-enabling. Production requires an owner, escalation path, and rollback procedure.
