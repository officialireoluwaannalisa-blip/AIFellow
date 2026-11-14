# Capacity-building playbook

## Purpose

Help non-technical health supply and planning teams understand, challenge, and safely use the prototype. Teaching is part of the product, not an afterthought.

## 60-minute workshop

### 0–10 min — Problem and boundaries
- Ask participants how they currently identify stockouts and prioritize expenditure.
- Show the synthetic-data notice and explain what the demo does not do.
- Define usable stock, confirmed inbound, buffer, and Unknown.

### 10–25 min — Guided triage
- Each participant filters a district and inspects one Critical and one Unknown record.
- Exercise: list the three inputs they would verify before acting.
- Discuss why missing consumption is not zero demand.

### 25–40 min — Scenario trade-offs
- Run the same scope at two budget ceilings.
- Compare selected actions, unfunded needs, and before/after estimates.
- Exercise: identify a facility that remains unfunded and propose a non-model action (data refresh, escalation, manual review).
- Discuss why greedy cost-effectiveness is not an equity rule.

### 40–50 min — Human workflow
- Save and explicitly approve a demo plan; advance one item; inspect the audit trail.
- Discuss who should hold approval authority in a real system and what evidence they need.

### 50–60 min — Responsible use and feedback
- Ask the evidence assistant a supported and an unsupported question.
- Review the model card and future LLM gates.
- Collect adoption barriers: language, connectivity, time, trust, and source-system fit.

## Facilitator checklist

- [ ] Use synthetic data only; never paste real patient or government records.
- [ ] Confirm the dataset version/date shown in the UI.
- [ ] Explain heuristic vs optimum and estimate vs impact.
- [ ] Keep Unknown and unfunded needs visible.
- [ ] Record participant assumptions and override reasons.
- [ ] End with a named owner for follow-up questions, not an autonomous action.

## Job aids

### “Before I act” card
1. Is the report fresh and the history sufficient?
2. Are batches released and not expired? Is inbound confirmed?
3. Does the action preserve donor buffer and meet route/shelf-life/cold-chain rules?
4. Does the cost fit the reviewed ceiling, and what remains unfunded?
5. Who is authorized to approve, and what source system records the decision?

### Prompt guide for the current retrieval assistant
Supported: snapshot summary, risk explanation, missing data, transfers/expiry, budget ranking, model/LLM boundary.
Unsupported: diagnosis, dosing, patient advice, real facility facts, autonomous actions.

### Future LLM prompt template (not enabled)
“You are summarizing only the supplied evidence snippets and deterministic tool output. Cite every factual claim with supplied source IDs. If evidence is missing, say so. Do not invent stock, prices, citations, or clinical advice. Do not approve or execute actions. Return the validated schema.”

## Measuring learning

- Pre/post confidence ratings are not enough. Ask participants to correctly classify an Unknown record, explain a budget trade-off, and identify the human approval step.
- Track workshop attendance, job-aid use, support questions, and time to first reviewed plan in a pilot.
- Feed confusion and language/accessibility issues back into the PRD.
