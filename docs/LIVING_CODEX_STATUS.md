# Living Codex — Implementation Status

This document describes the current state of the Activate the Living Codex update as actually implemented.  
It reflects what is live in the repository, not the original plan.

---

## Completed Stages

| Stage | Description | Status |
|-------|-------------|--------|
| 1 | Core architecture, shared CSS, token system | ✅ Complete |
| 2 | Signal bar (living-codex.js, all major pages) | ✅ Complete |
| 3 | Today in the Codex panel | ✅ Complete |
| 4 | Continue Your Path panel | ✅ Complete |
| 5 | Recent Signals / Codex Activity panel | ✅ Complete |
| 6 | Field Notes as Codex update types | ✅ Complete |
| 7 | Hub system map (hub.html) | ✅ Complete |
| 8 | Next Gate components on major pages | ✅ Complete |
| 9 | Ambient motion system | ✅ Complete |
| 10 | Maintenance documentation and data tools | ✅ Complete |

---

## Architecture Overview

The site is a **static site** deployed to GitHub Pages and the custom domain `codexofreality.org`.

All pages live in `docs/`. There is no build step, bundler, or server-side rendering.

### Key directories

```
docs/
  assets/
    css/          — Shared stylesheets (codex.css, tokens.css, animations.css, …)
    data/         — JSON data files (codex-updates.json, moons.json)
    img/          — Images and icons
    js/           — Shared JavaScript modules
  systems/        — Sub-pages for Hub systems (frequencies.html, t-7.html, …)
  theory/         — Theory section sub-pages
  CODEX_MAINTENANCE.md   — Maintenance guide (written for Aaron)
  LIVING_CODEX_STATUS.md — This file
  templates/      — JSON templates for data entry

scripts/
  validate-codex-data.js  — Node.js data validator (no npm required)
```

---

## Files and Modules

### CSS

| File | Purpose |
|------|---------|
| `tokens.css` | Design tokens: colors, spacing, typography, motion tokens |
| `codex.css` | Global reset, base styles, shared layout |
| `animations.css` | All animation keyframes, motion classes, reduced-motion rules |
| `navigation.css` | Shared site header and mobile menu |
| `components.css` | Shared component styles (buttons, cards, forms) |
| `home.css` | Homepage-specific layout and styles |
| `hub.css` | Systems Hub layout |
| `moons.css` | 13 Moons calendar page |
| `theory.css` | Theory/Canon page |
| `teach.css` | Manifest / teach.html page |

### JavaScript

| File | Purpose |
|------|---------|
| `site.js` | Shared navigation, active-nav marking, image fallbacks, utility functions |
| `living-codex.js` | Living Codex state engine: daypart, moon, signal bar, Today panel, Continue Your Path, Recent Signals |
| `motion.js` | Motion system: section reveals, canvas breath animation, page visibility, View Transitions |
| `calendar-cor.js` | Remnant 13 Moons calendar calculations (SOFCalendar module) |
| `moons.js` | 13 Moons page interactive calendar |
| `theory.js` | Theory page navigation and section reveals |
| `teach.js` | Manifest page — Ledger, breath ring, observer loop |
| `frequency-governance.js` | Frequency Governance console |
| `genesis-oracle.js` | Genesis Oracle |
| `caravan.js` | Covenant Caravan page |

### Data

| File | Purpose |
|------|---------|
| `codex-updates.json` | Recent Codex Activity entries (authored manually) |
| `moons.json` | Moon catalog: 13 moon names, essences, tones, affirmations |
| `moons.data.js` | Legacy moon data (inline JS module) |

---

## Data Sources

| Data | Source | Live |
|------|--------|------|
| Current date/time | `new Date()` in browser | ✅ |
| Daypart (Dawn/Day/Dusk/Night) | Local time calculation in living-codex.js | ✅ |
| Moon cycle position | calendar-cor.js (SOFCalendar module) | ✅ |
| Moon catalog (names, essences) | moons.json (fetched) | ✅ |
| Moon phase / illumination | calendar-cor.js (astronomical) | ✅ |
| Witness count | localStorage | ✅ |
| Last gate / Continue Your Path | localStorage | ✅ |
| Recent Codex activity | codex-updates.json (fetched) | ✅ |
| Artifact data | Inline HTML in shop.html | Manual |
| Field notes | codex-updates.json (type: "field note") | ✅ |

No data is fabricated, randomized, or simulated. All counters and dates reflect real local state or manually authored content.

---

## localStorage Behavior

| Key | Contains | Cleared by |
|-----|---------|------------|
| `sof.codex.last-visit.v1` | ISO timestamp of last visit | Browser clear / expiry |
| `sof.codex.last-gate.v1` | `{ href, title, timestamp }` | Clear path button |
| `scroll_of_fire_witness_ledger_v3` | Witness ledger entries array | Manual browser clear |
| `sof_moon_logs_v3` | Moon log entries array | Manual browser clear |
| `covenant-caravan.notes` | Caravan notes text | Manual browser clear |
| `sof.theory.settings.v3` | Theory page settings | Manual browser clear |
| `sof_frequency_governance_journal_v2` | Frequency journal entries | Manual browser clear |
| `sof_moons_tz_v2` | Timezone preference | Manual browser clear |
| `sof_moons_boundary_v1` | Day boundary preference | Manual browser clear |

All data is stored only in the visitor's browser. No server receives any of it. No account is required.

---

## Current Living Features

- **Signal bar** — appears on all major pages; shows daypart, moon state, witness count, last gate, and recent update count.
- **Today in the Codex** — homepage panel with current moon, witness prompt, breathing pattern, and day action.
- **Continue Your Path** — homepage panel showing the last gate visited in this browser.
- **Recent Codex Activity** — homepage panel driven by `codex-updates.json`.
- **Daypart-aware eyebrow** — hero heading and action change with Dawn/Day/Dusk/Night.
- **First-visit detection** — `data-codex-first-visit` attribute added to the HTML root on genuinely first visits.
- **Privacy note** — displayed on the Continue Your Path panel explaining local-only storage.

---

## Motion Features

All motion is implemented in:
- `docs/assets/css/animations.css` — keyframes, classes, reduced-motion rules
- `docs/assets/css/tokens.css` — motion timing tokens (`--motion-fast`, `--motion-medium`, `--motion-slow`, `--motion-field`, `--motion-pulse`, `--motion-seal`, `--ease-signal`, `--ease-breath`)
- `docs/assets/js/motion.js` — runtime motion behavior

### Active motion features

| Feature | Class / Element | Behavior |
|---------|----------------|----------|
| Ambient field drift | `.living-aura` | Slow radial gradient drift, 18s cycle |
| Daypart-aware ambient | `[data-codex-daypart]` CSS selectors | Brightness and speed adjust per daypart |
| Signal pulse | `.pulse-active`, `.moon-mark` | Slow 4.5s opacity + scale pulse |
| Seal rotation | `.seal-spin`, `.seal-spin-rev` | 28s slow rotation; counter-rotation variant |
| Section reveals | `.reveal` → `.in` | IntersectionObserver fade-in, major sections only |
| Stagger reveals | `.reveal-group > *:nth-child(N)` | Up to 300ms stagger for card groups |
| Canvas breath | `#codexExerciseCanvas` | Inhale 4 / Hold 2 / Exhale 6 ring animation |
| Connection flow | `.hub-connection-line` | Directional shimmer along lines |
| View Transitions | `@view-transition { navigation: auto }` | Cross-fade on same-origin navigation (Chrome 111+) |
| Page visibility | `visibilitychange` event | Canvas loop pauses when tab is hidden |

### Reduced-motion behavior

When `prefers-reduced-motion: reduce` is active:
- All CSS animations and transitions are set to `none` via `animations.css`.
- `.reveal` elements are immediately visible (opacity:1, transform:none).
- Canvas breath shows one static frame and stops.
- View Transitions are disabled.
- Seal rotation stops.
- Stagger delays are removed.

The `prefersReducedMotion()` function in `site.js` exposes this check to JavaScript modules.

---

## Maintenance Steps

See `docs/CODEX_MAINTENANCE.md` for detailed instructions covering:
- How to add a Codex update
- How to add a field note
- How to add an artifact
- How to change system relationships
- How to test custom domain and GitHub Pages paths
- How to disable or adjust motion
- How to troubleshoot failed JSON loading

---

## Data Validation

Run at any time with:

```bash
node scripts/validate-codex-data.js
```

Checks:
- Required fields present
- Valid date formats (YYYY-MM-DD)
- No duplicate IDs
- No unknown update types
- Malformed arrays / non-array roots

---

## Known Limitations

1. **Artifact data is inline HTML** — `shop.html` contains artifact cards as HTML, not JSON. A future `artifacts.json` would allow the validator and templates to be fully useful.
2. **Field notes are Codex updates** — There is no separate `field-notes.json` at this time. Field notes are authored as `"type": "field note"` entries in `codex-updates.json`.
3. **No `system-map.json`** — Hub system relationships are described in HTML card text, not structured data.
4. **View Transitions** — Progressive enhancement only; requires Chrome 111+ / Edge 111+. All other browsers receive normal page navigation.
5. **Canvas breath on iOS** — The canvas animation runs at 60fps but the `codexExerciseCanvas` element is only present on the homepage. Performance was not tested on iOS hardware below iPhone 11.
6. **Signal bar on non-homepage pages** — The signal bar is rendered on all pages, but the Today panel and Continue Your Path panel are homepage-only. Other pages show the signal bar items only.

---

## Future Enhancements

- Separate `field-notes.json` with its own rendering component.
- Separate `artifacts.json` to allow dynamic artifact counting and filtering.
- `system-map.json` for structured Hub relationship data.
- Optional sound layer for Frequency Governance and Manifest (documented as future work; no audio assets added yet).
- Moon-phase image overlays in the 13 Moons calendar.
- Print stylesheet for Theory / Canon pages.

---

## Testing Completed

- JavaScript syntax validated: all `.js` files pass `node --check`.
- `validate-codex-data.js` runs clean on current data files.
- Reduced-motion rules verified in CSS (`animations.css`).
- Page visibility pausing verified in `motion.js`.
- `data-codex-first-visit` attribute set on first visit via `living-codex.js`.

Manual visual testing at the following breakpoints is recommended:
320px, 360px, 412px, tablet portrait, tablet landscape, 1024px, 1440px.

---

## Remaining Manual Content Needed from Aaron

- Artifact photography and artifact entries for `shop.html`.
- Additional `codex-updates.json` entries as the Codex grows.
- Field notes authored as `"type": "field note"` entries.
- Moon `essay` and `codex` content in `moons.json` (currently blank for most moons).
- Social cover image at `assets/img/shared/social/codex-og-cover.jpg` (referenced in Open Graph metadata).
- Confirm correct moon epoch date in `calendar-cor.js` for the Remnant 13 Moons system.

---

*Last updated: 2026-07-13*  
*Latest commit at time of writing: f855007*
