# Dashboard design plan

## Brief
One decision-support workspace for African medicine-supply and financing teams. The primary job is to turn a verified snapshot into a short, explainable action queue without hiding budget, safety, or data-quality limits.

The visual system is [Calm Clinic](../design.md), adapted from the uploaded healthcare reference (`assets/design-inspiration.jpg`). It blends glassmorphism, neumorphism, claymorphism, and skeuomorphism by layer rather than stacking every effect on every surface.

## Design tokens
- Base: `#EEF9F6` workspace wash, `#FFFFFF`→`#F6FBF7` clay card, `#17453A` authority/action, `#173132` text, `#4F625D` muted.
- Status: green `#1F6C59` on track, amber `#80550E` watch, red `#B3453C` urgent, gray `#58646E` unknown. Status always carries text, not color alone.
- Type: Manrope Variable for headings and decisive numbers; Inter Variable for labels, tables, and explanations. No external font request.
- Layout: left workspace navigation remains; dashboard opens with a role/scope command bar, then a compact summary strip, then role-specific panels. Facility view hides irrelevant scope filters and moves availability/critical counts into the stock-card subtitle. Tables stay semantic; wide operational tables stack in narrow containers, while compact map/forecast tables remain tabular in desktop side columns.

## Wireframe
```text
[role switch] [country > region > district > facility] [commodity] [period] [search]
[availability] [budget] [critical] [facilities]
[priority actions + bottlenecks]       [map / budget / forecast]
[role panel: pipeline | facility stock | partner comparison]
[audit trail]
```

## Principles
- The action queue is the hero, not a marketing banner.
- Every recommendation has a short “Why this?” and a link to the full rationale.
- Unknown is never green. Synthetic, demo-role, real-name-reference, and not-connected states are explicit.
- Facility view is a short stock list with large touch targets and minimal forms.
- One morphism per layer: glass chrome/overlays, neu controls/wells, clay cards/stats, skeuomorphic switch/ledger/map/sidebar.
- Motion is limited to state changes and respects reduced motion.

## Self-critique
The first dashboard pass resembled a generic SaaS card grid. The revised pass keeps cards for grouped metrics and uses tables, a schematic map, and ranked lists for the actual work. The Calm Clinic pass then fixed three concrete defects found in screenshots: mobile-only navigation buttons leaked onto desktop, leadership left/right columns were badly unbalanced, and the facility stock list was buried under irrelevant filters on mobile. The map is labeled schematic because the demo has no verified geographic boundaries; facility names are real public references with synthetic figures, not a verified Foundation grantee roster.

## Browser verification (2026-11-14, v0.4.0)

| Guide | Check | Evidence |
|---|---|---|
| responsive-table | Semantic tables, named scroll regions, stacked labeled rows for wide tables; compact map/forecast tables in side columns | Facility/risk/map/forecast tables render at 390px without page overflow |
| accessibility | Skip link, labels, native dialog, Escape/focus return, status text not color-only, focusable quality queue | “Why this?” focuses Close; Escape removes dialog and returns focus to the invoking “Why this?” button |
| navbar | Current page indicated, mobile navigation opens, desktop mobile buttons hidden | Smoke test opens navigation at 390×844; computed `.mobile-menu`/`.mobile-close` display is `none` at 1440px |
| motion | Reduced motion removes spatial/persistent motion, keeps color feedback | Under reduce: role/sidebar transitions `0s`, button transition limited to background/color; under no-preference role transition `0.15s` |
| forced colors | Shadows/gradients collapse to system borders/colors | CDP `forced-colors: active` audit: card/button/input/audit shadows `none`, gradients `none`, solid borders present |
| css-layout / responsive-design | Grid/flex, container queries, no horizontal page overflow | `scrollWidth <= innerWidth + 1` true for all five roles at 390×844; facility stock region begins at y≈668px |
| contrast | AA text/status contrast; gradient surfaces checked with a solid-surface fallback audit | axe WCAG A/AA: 0 violations on dashboard, overview, risks, planner, funding, data, methodology; solid-surface audit also 0 violations. Token pairs: muted/card 6.00, critical 4.71, watch 5.86, stable 5.56, unknown 5.30 |
| performance | CLS ≤ 0.1 | Dashboard vitals CLS 0.04, LCP 296ms, FCP 140ms in the sandbox |

Automated browser checks are not a substitute for testing with disabled users or real district/facility usability sessions.
