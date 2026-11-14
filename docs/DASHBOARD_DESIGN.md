# Dashboard design plan

## Brief
One decision-support workspace for African medicine-supply and financing teams. The primary job is to turn a verified snapshot into a short, explainable action queue without hiding budget, safety, or data-quality limits.

## Design tokens
- Base: `#F5F7F4` workspace, `#FFFFFF` panel, `#123C32` authority/action, `#1C2F27` text.
- Status: green `#247A59` on track, amber `#AD741D` watch, red `#BD4B43` urgent, gray `#6C7882` unknown.
- Type: Manrope Variable for headings and decisive numbers; Inter Variable for labels, tables, and explanations. No external font request.
- Layout: left workspace navigation remains; dashboard opens with a role/scope command bar, then a compact summary strip, then role-specific panels. Tables stay semantic and scroll inside named regions; narrow containers stack rows with visible labels.

## Wireframe
```text
[role switcher] [country > region > district > facility] [search] [period]
[availability] [budget] [critical] [unknown]
[map / priority actions]          [bottlenecks / forecast]
[role panel: pipeline | facility stock | partner comparison]
[audit trail]
```

## Principles
- The action queue is the hero, not a marketing banner.
- Every recommendation has a short “Why this?” and a link to the full rationale.
- Unknown is never green. Synthetic, demo-role, and not-connected states are explicit.
- Facility view is a short list with large touch targets and minimal forms.
- Motion is limited to state changes and respects reduced motion.

## Self-critique
The first pass resembled a generic SaaS card grid. The revised pass keeps cards only for summary metrics and uses tables, a schematic map, and ranked lists for the actual work. The map is labeled schematic because the demo has no verified geographic boundaries.

## Browser verification (2026-11-14)

| Guide | Check | Evidence |
|---|---|---|
| responsive-table | Semantic tables, named scroll regions, stacked labeled rows under 600px container | Facility/risk tables render at 390px without page overflow |
| accessibility | Skip link, labels, native dialog, Escape/focus return, status text not color-only | “Why this?” dialog opens modal, focuses Close, Escape removes dialog |
| navbar | Current page indicated, mobile navigation opens | Smoke test opens navigation at 390×844 |
| motion | Reduced motion removes spatial/persistent motion, keeps color feedback | Computed transition duration 1e-05s under reduce vs 0.15s under no-preference |
| css-layout / responsive-design | Grid/flex, container queries, no horizontal page overflow | `scrollWidth <= innerWidth + 1` true at 390×844 |
| performance | CLS ≤ 0.1 | Dashboard vitals CLS 0.05 (baseline overview 0.03; both pass threshold) |

Automated browser checks are not a substitute for testing with disabled users or real district/facility usability sessions.
