# Model and decision-engine card

## Intended use

A teaching/portfolio baseline for triaging synthetic essential-medicine stock records and comparing budget-constrained actions. **Not** a calibrated risk model, clinical decision rule, validated forecast, or autonomous allocation authority.

## Inputs and outputs

Inputs: 28-day consumption history, usable/released batches and expiry, confirmed inbound shipments, reporting date, lead time, product constraints, and fictional routes. Outputs: daily-demand estimate, days of cover, projected first stockout day, unmet demand, expiry exposure, triage label, urgency score, and explainable action candidates.

## Demand baseline

Let `m28` be mean daily consumption over the available 28 observations, `m7` the last 7 days, and `m21` the preceding 21 days. When both windows have positive demand:

`forecastDaily = m28 × clamp(m7 / m21, 0.8, 1.2)`.

Otherwise use `m28` when positive. Fewer than 14 observations, stale reporting (>7 days), or zero total history yields **Unknown** rather than a fabricated zero-risk result. The trend cap is a demo assumption, not a fitted parameter.

## Stock projection

Simulate each day from the fixed snapshot:
1. Add confirmed arrivals due that day; planned shipments do not count.
2. Remove expired stock; consume released batches first-expiry-first-out.
3. Consume rounded daily demand; record unmet demand and ending usable stock.

`daysCover = usableUnits / forecastDaily`. Effective cover is the smaller of simple cover and projected first-stockout day. The first stockout is the first day with unmet demand or zero ending stock; an initially empty facility is day 0.

## Risk labels

- **Unknown:** freshness/history gate fails.
- **Critical:** effective cover < 7 days.
- **Watch:** effective cover < planning horizon.
- **Stable:** otherwise, within the modeled horizon only.

`urgencyScore = round(100 × max(0, 1 − effectiveCover / (horizon + buffer)))`, bounded to 0–100. This is a transparent triage index, **not a probability**. Buffer defaults to 7 days and is user-adjustable.

## Replenishment need

Project over `horizon + buffer`. Total modeled need is cumulative unmet demand plus the shortfall below the ending safety-stock target (`forecastDaily × buffer`). Procurement need separately counts unmet demand **after its lead time** plus the ending safety shortfall, because adding a later procurement arrival cannot repair earlier unmet demand. Earlier gaps require a faster transfer or explicit escalation. These are quantities to review, not prescriptions or purchase orders.

## Candidate constraints

- Exact same product ID; no therapeutic substitution.
- Donor and recipient in the same fictional district with an explicit route.
- Donor retains target cover for the scenario horizon plus buffer.
- Only released, non-expired donor batches with minimum remaining shelf life after arrival.
- Cold-chain products require a cold-chain-capable route.
- Procurement uses integer unit costs plus a fixed synthetic order cost.
- Every action has positive quantity and fits the remaining integer-cent budget.

## Exact allocation engine

The planner generates integer flow candidates: procurement quantities and exact-product transfer quantities from conservative donor surplus. Donor transferable supply is computed by replaying the donor's own FEFO demand over `horizon + buffer`, reserving the safety buffer, and excluding confirmed inbound that has not arrived. Each shipment has a binary fixed-charge activation; batch flows share one fixed cost.

HiGHS solves a two-stage lexicographic MILP:

1. **Maximize weighted units** subject to budget, recipient need caps, donor surplus caps, batch caps, fixed-charge links, and safety eligibility.
2. **Minimize integer-cent cost** subject to preserving the stage-1 optimal benefit.

Both stages must return `Optimal` with `mip_rel_gap = 0` and `mip_abs_gap = 0`. The server independently re-checks integer quantities, binary activations, budget, donor/batch/recipient caps, and fixed-cost consistency before returning a plan. The certificate records solver version, objective, benefit, cost, candidate/variable/constraint counts, solve time, model SHA-256, and scope `modeled_integer_flow_problem`.

This is **globally optimal for the modeled integer-flow problem and stated objective**. It is not a claim of real-world clinical optimality, calibrated health benefit, or normative equity. Product weights are synthetic demo assumptions unless a locally approved clinical policy supplies them. Real-country allocation is gated until authorized aggregate data and an approved jurisdiction-matched policy are present. Unfunded needs remain visible.

## Estimated effect

Apply selected procurement arrivals and transfer debits/arrivals to a copy of the snapshot, then rerun the same projection. Report changes in stockout days and unmet demand as **scenario estimates**. Authorization is assumed immediate; cash-release delays, supplier failure, transport disruption, and consumption feedback are not modeled.

## Evaluation

Automated tests cover deterministic demand, FEFO/expiry, confirmed-only inbound, Unknown gates, budget limits, donor preservation, exact-product matching, shelf life, cold chain, stable ordering, workflow invariants, exact MILP knapsack/fixed-charge behavior, country gating, clinical-policy approval, and aggregate-import privacy/quality checks. Synthetic tests demonstrate implementation correctness, **not external validity**. No accuracy, fairness, or impact metric from real populations is claimed.

Before a pilot: backtest by facility/product/district with rolling origins; compare against naive mean and current practice; measure alert precision/recall, missed shortages, calibration where probabilistic models are introduced, burden, and subgroup performance; run prospective shadow mode with human review.

## Known failure modes

- Consumption can change abruptly during outbreaks, strikes, or seasonality.
- Stock adjustments, losses, and reverse logistics are absent.
- Batch reconciliation may hide real-world data-entry problems.
- The weighted-unit objective can leave small/remote facilities unfunded unless local equity constraints are added.
- Fixed lead times and immediate authorization overstate feasibility.
- Synthetic routes and prices do not represent actual markets.
- Unknown records are excluded from allocation, which can hide need unless the quality queue is acted on.

## LLM boundary

The current release has **no connected LLM**. The evidence assistant uses bounded retrieval and computed facts with citations. A future LLM may summarize verified evidence only; it must not alter arithmetic, invent citations, infer missing stock as zero, or execute actions. See [Responsible AI](RESPONSIBLE_AI.md).
