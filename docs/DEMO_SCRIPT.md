# Reviewer demo script (8–10 minutes)

**Setup:** `npm ci && npm run dev`, open the live preview or localhost:3000. No credentials. All data is synthetic. Keep the synthetic-data notice visible.

## 1. Frame the problem (1 min)

“District teams need to know what will run out, what they can afford to do, and whether a decision was reviewed. This prototype connects those steps. It is an independent portfolio demo inspired by the AI Fellows role—not an official deployment or validated clinical tool.”

Show Overview: facilities, Critical risks, projected stockout item-days, expiry exposure, and data readiness.

## 2. Inspect the evidence (2 min)

Open **Stockout risk**. Filter to Central Plateau or search a facility. Open an item.

Point out:
- usable stock vs quarantined/expired stock;
- confirmed vs planned inbound;
- FEFO projection and first-stockout day;
- Unknown handling for stale/short history;
- the risk formula and quality flags.

Say: “The label is a transparent triage index, not a probability. Missing data is a task, not safety.”

## 3. Build a scenario (2 min)

Open **Scenario planner**. Set a district, 30-day horizon, $10,000–$25,000 budget, and 7-day buffer. Run.

Point out:
- selected cost and remaining budget;
- procurement vs redistribution rationale;
- donor buffer, exact product, shelf life, and cold-chain checks;
- before/after estimates and unfunded needs;
- the greedy heuristic and immediate-authorization assumption.

Change the budget without rerunning to show the stale-result guard, then rerun.

## 4. Save, approve, trace (2 min)

Save a named plan. On **Funding trace**, use **Review & approve** and read the demonstration-only confirmation. Advance one item through fulfillment request, simulated cash release, and received. Show the audit trail and export the plan CSV.

Say: “No order, stock movement, or payment was created. The workflow demonstrates where human authority and source-system integration would sit.”

## 5. Data, evidence, and teaching (1–2 min)

Open **Data & evidence**. Show the manifest/checksum, quality queue, and synthetic JSON download. Ask the assistant “Is an LLM connected?” and “How is missing data handled?” Show citations and the bounded refusal for clinical questions.

Open **Methodology**. Close with the model card, responsible-AI gates, and roadmap: backtesting, co-design, equity constraints, security, and prospective shadow evaluation before any impact claim.

## Questions to invite

- Which assumptions would you change first for your district?
- What equity constraint should the planner enforce?
- Which source system is authoritative for stock and cash release?
- What would make this useful enough to adopt, and what would make it unsafe?

## Do not claim

- Real facility data, foundation endorsement, clinical validity, calibrated probabilities, global optimality, autonomous procurement, or guaranteed job selection.
