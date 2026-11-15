# StockSense design system — "Calm Clinic"

Inspiration: the uploaded healthcare reference (`docs/assets/design-inspiration.jpg`) — a soft sage/mint clinical palette, generous rounded surfaces, frosted floating panels, and calm, confident typography. We adapt that mood to a **decision-support workspace**, not a marketing site: the action queue and risk tables stay the heroes.

The visual language is a deliberate **four-way blend**, each technique assigned to the layer where it reads best:

| Technique | Where it lives | Why |
|---|---|---|
| **Glassmorphism** | Top bar, modals/dialogs, toasts, backdrop | Chrome and overlays float above content like frosted glass; blur + translucency signal "temporary layer" without hiding the workspace behind it. |
| **Neumorphism** | Buttons, inputs, selects, search wells, icon buttons, progress tracks | Controls look extruded from / pressed into the same soft material, giving tactile affordance. Pressed state uses an inset well. |
| **Claymorphism** | Cards, stat tiles, summary strip, badges/pills, icon chips | Puffy, hand-formed pastel surfaces with inner highlight + outer soft shadow make dense data feel approachable and grouped. |
| **Skeuomorphism** | Role switcher (physical segmented switch), audit trail (ruled paper ledger), risk map (pin-board), sidebar (lacquered panel) | Real-world metaphors for things that behave like physical objects: a switch you flip, a ledger you write in, a board you pin risks to. |

## Tokens

- Base surfaces: `#eef9f6` workspace wash, `#ffffff`→`#f6fbf7` clay card gradient, `#f4faf6` neumorphic well.
- Authority / action: `#17453a` deep clinical green, `#1f6c59` green, `#cfe8a2` soft lime accent.
- Text: `#173132` primary, `#4f625d` muted (AA on clay surfaces).
- Status (text + dot, never color alone): green `#1f6c59` on track, amber `#80550e` watch, red `#b3453c` urgent, gray `#58646e` unknown.
- Radii: cards `22px`, overlays `26px`, controls/pills `999px`, wells `14px`.
- Shadows: `--clay-shadow` (outer soft + inner highlight), `--neu-shadow` / `--neu-inset` (extrude / press), `--glass-shadow` + `backdrop-filter: blur() saturate()` for glass.
- Type: Manrope Variable (headings, decisive numbers), Inter Variable (labels, tables, explanations). No external font requests.

## Rules

1. **One technique per layer.** Never stack glass on clay on neu on the same element; the blend is across layers, not within one surface.
2. **Semantics first.** The theme (`src/theme.css`) overrides surfaces only — never layout, heading order, table semantics, or focus order. It loads after `src/styles.css`.
3. **Contrast is non-negotiable.** Body and muted text meet AA on their surfaces; status always carries a text label.
4. **Motion stays quiet.** Pressed/inset states are instant; spatial animation remains gated behind `prefers-reduced-motion: no-preference`.
5. **Forced-colors fallback.** Shadows collapse to solid borders under `forced-colors: active`.
6. **Honesty chrome.** Synthetic-data and real-name-reference notices use the same calm notice strip so disclaimers feel part of the product, not bolted on.

## Real facility names

Facility display names reference real public institutions in the Gates Foundation's Africa focus countries (Nigeria, Burkina Faso, Ethiopia, Kenya, South Africa). Every operational figure remains synthetic; names do not imply Foundation funding or describe actual stock. See `docs/FACILITY_NAMES.md`. The theme renders these disclaimers as first-class notice strips and table sub-labels.

## Verification

**Status: v0.4.0 gates pass.** Results are recorded in `docs/DASHBOARD_DESIGN.md`.

Release gates (record results in `docs/DASHBOARD_DESIGN.md` after each pass):

- `npm run check` and `npm run test:e2e` pass with the theme loaded.
- Desktop and 390×844 screenshots reviewed; no horizontal page overflow; text/status contrast meets AA.
- Keyboard focus is visible; native dialogs trap/return focus; reduced-motion and forced-colors fallbacks exercised.
- Facility view keeps stock actions ahead of secondary filters; leadership columns remain balanced.
