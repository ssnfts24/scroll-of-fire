# Living Codex — Phase 1: The Living Day

**Status:** Complete  
**Production site:** https://codexofreality.org  
**Implemented:** July 2026

---

## What Was Implemented

Phase 1 makes the homepage visibly reflect the current Remnant 13 Moons calendar day. Every time a visitor opens the homepage, the page displays:

- Current Moon number and Moon name
- Current day within the 28-day Moon
- Current day within the 364-day year
- Current week gate
- Visible lunar phase
- Shabbat, Preparation, Return, or ordinary-day state
- One short daily movement or practice (deterministic — same day always gives the same recommendation)
- One recommended Codex destination
- One recommended Frequency Governance preset (shown as text; deep-linking not yet supported)

The information updates automatically as the calendar changes, and the homepage atmosphere (background glow, accent hue) shifts with the active Moon.

---

## Files Created

| File | Purpose |
|------|---------|
| `docs/assets/js/codex-state.js` | Shared daily-state module |
| `docs/assets/css/living-day.css` | Living Day Panel styles, signal bar toggle, Moon atmosphere classes |
| `tests/living-codex-phase1.test.js` | Phase 1 focused tests |
| `docs/LIVING-CODEX-PHASE-1.md` | This document |

---

## Files Modified

| File | Change |
|------|--------|
| `docs/index.html` | Added CSS links, `codex-state.js` script, upgraded signal bar HTML, upgraded Today in the Codex panel |
| `docs/assets/js/living-codex.js` | Extended `renderHomeState()` to render new fields; updated `renderSignalBar()` for compact format; added `renderLivingDayPanel()` and `setupLivingDayPanel()` |

---

## Calendar Logic Reused

All date, Moon, and lunar calculations are delegated to **`window.SOFCalendar`** (`docs/assets/js/calendar-cor.js`). No duplicate logic was introduced.

| Capability | Source |
|-----------|--------|
| Moon number, day, week | `SOFCalendar.get13Moon(iso, tz)` |
| Year day | `SOFCalendar.get13Moon()` → `result.dayIndex + 1` |
| Timezone | `SOFCalendar.getTZ()` |
| Today ISO | `SOFCalendar.todayISO(tz)` |
| Lunar phase name | `SOFCalendar.getMoonPhase(iso).name` |
| Lunar illumination | `SOFCalendar.getMoonPhase(iso).illumination` |
| Boundary mode | `SOFCalendar.CONFIG.dayBoundary` |

---

## Static Data in `codex-state.js`

The following data is embedded in `codex-state.js`. It mirrors the corresponding arrays in `moons.js` but lives here so `codex-state.js` works independently of the 13 Moons app bundle.

### `DAY_ARCHETYPES` (28 entries)
One archetype per day within the Moon. Indexed by `moonDay - 1`. Used to derive `dailyMovement` and `movementCategory`. The same Moon day always returns the same archetype (deterministic).

### `WEEK_GATES` (4 entries)
One gate per 7-day week within a Moon. Indexed by `weekNumber - 1`.

| Week | Name | Description |
|------|------|-------------|
| 1 | Week 1 · Ignition | Begin, gather signal, establish the first witness. |
| 2 | Week 2 · Formation | Shape the pattern through body, speech, and daily structure. |
| 3 | Week 3 · Testing | Watch pressure, resistance, correction, and refinement. |
| 4 | Week 4 · Sealing | Harvest the lesson, close loops, and prepare the next moon. |

### `MOON_PATHS` (13 entries)
Suggested Codex page per Moon number. Shabbat-day overrides apply when `shabbatState !== "ordinary"`.

### `MOON_FREQS` (13 entries)
Suggested Frequency Governance preset per Moon. Text-only — deep-link not yet supported. Format: `"Preset Name · NNN Hz"`.

---

## Shabbat State Logic

Derived from `new Date().getDay()` (weekday of the effective Codex date). Mirrors the logic in `moons.js shabbatInfo()` without importing that module.

| `getDay()` result | `shabbatState` | `shabbatLabel` |
|-------------------|---------------|----------------|
| 5 (Friday) | `"preparation"` | Preparation Gate |
| 6 (Saturday) | `"active"` | Shabbat · Rest |
| 0 (Sunday) | `"return"` | Return Gate |
| All others | `"ordinary"` | Ordinary Day |

`shabbatState` is written to `document.body.dataset.shabbatState` so styles can respond to it.

---

## localStorage Keys

| Key | Set By | Purpose |
|-----|--------|---------|
| `sof.codexState.v1` | `codex-state.js` | Non-sensitive daily state cache (moon number, name, day, year day, week gate, phase, shabbat state) |

### Existing keys left unchanged

The following keys remain untouched by Phase 1:

- `sof.codex.last-visit.v1`
- `sof.codex.last-gate.v1`
- `scroll_of_fire_witness_ledger_v3`
- `sof_moon_logs_v3`
- `covenant-caravan.notes`
- `sof.theory.settings.v3`
- `sof_frequency_governance_journal_v2`
- `sof_moons_tz_v2`
- `sof_moons_boundary_v1`

---

## Custom Events

| Event name | Emitted by | When |
|------------|-----------|------|
| `codexstatechange` | `codex-state.js` | After `window.CodexState` is updated (initial load + on each `sof:codex-state` re-emit) |
| `sof:codex-state` | `living-codex.js` | After async moon catalog refresh (unchanged) |

`codexstatechange` is the Phase 1 / Phase 2 forward-compatible event. Components can listen to it to respond to daily state changes without knowing about `living-codex.js` internals.

---

## Moon Theme Classes

`codex-state.js` applies two sets of classes to `<body>` based on the current Moon:

| Class format | Range | Meaning |
|-------------|-------|---------|
| `codex-moon-01` … `codex-moon-13` | 01–13 | Phase 1/2 forward-compatible class (defined in `living-day.css`) |
| `theme-moon-1` … `theme-moon-13` | 1–13 | Backward-compatible class (defined in `themes.moons.css`) |

Both classes set `--moon-accent` to a Moon-specific hue that the homepage hero glow and card atmospheres read.

---

## Daily Movement Mapping

`dailyMovement` is derived from `DAY_ARCHETYPES[moonDay - 1][1]` — the description string for the current day's archetype within the Moon. The same Moon day always produces the same text (deterministic). The mapping is stored as a plain JavaScript array in `codex-state.js`, not scattered through conditionals.

Categories used: Spark · Witness · Breath · Root · Water · Stone · Fire · Gate · Mirror · Hand · Voice · River · Star · Balance · Seed · Trial · Mercy · Sword · Oil · Bread · Watch · Return · Crown · Lamp · Name · Field · Seal · Rest

---

## Suggested Path Mapping

| Moon | Name | Suggested page |
|------|------|---------------|
| 1 | Seed Flame | `moons.html` |
| 2 | Root Waters | `ledger.html` |
| 3 | Breath Gate | `theory.html` |
| 4 | Stone Witness | `ledger.html` |
| 5 | Living Word | `invoke.html` |
| 6 | Fire Trial | `systems/witness.html` |
| 7 | Crown Balance | `hub.html` |
| 8 | Deep Mirror | `genesis-oracle.html` |
| 9 | Return Path | `ledger.html` |
| 10 | Builder's Hand | `systems/mind-renewal.html` |
| 11 | Star Remembrance | `theory.html` |
| 12 | River of Signs | `systems/frequencies.html` |
| 13 | Completion Seal | `ledger.html` |

Shabbat overrides: Preparation and Return → `ledger.html`; Shabbat (active) → `theory.html`.

---

## Fallback Behaviour

- If `SOFCalendar` is not loaded, `computeState()` returns `null` — no state is published and no body classes are applied. The homepage remains functional with its static HTML fallback content.
- If `getMoonPhase` is absent from `SOFCalendar`, `phaseName` and `phaseIllumination` are empty strings / null.
- If the date is outside the 13-Moon count (`isDayOutOfTime: true`), `moonNumber`, `moonDay`, `yearDay`, `weekGate`, `dailyMovement` are all null / empty. The "Today in the Codex" calendar summary is hidden.
- The Living Day panel shows "Calculating today's moon state…" until JS resolves state.
- The `codex-suggested` section remains `hidden` until `suggestedPath` and `suggestedPathUrl` are available.

---

## How Phase 2 Can Enable the Signal Bar Site-Wide

Phase 1 implements the Living Day signal bar and expandable panel on the homepage only. To enable it site-wide in Phase 2:

1. Move the `<section class="living-signal-shell">` block from `index.html` into the shared site header template (or include it via a server-side include / build step).
2. Load `codex-state.js` and `living-day.css` globally (they are already self-contained).
3. The `codexstatechange` event propagates from `document` so any page can listen for it to update its own signal bar without knowing about `living-codex.js`.
4. Remove the `data-living-signal-root` population logic from `living-codex.js` and move it into `codex-state.js` or a new `signal-bar.js` module so it runs on every page.

---

## Known Limitations

- **Sunset time**: Phase 1 uses `SOFCalendar.CONFIG.fallbackSunset` (a static time string, e.g. `"18:00"`) rather than a real computed sunset from geolocation. Real sunset time calculation can be added in Phase 2 without breaking the existing API.
- **Frequency deep-linking**: The Frequency Governance page (`systems/frequencies.html`) does not currently support `?preset=xxx` URL parameters. The suggested frequency is shown as text only. Deep-link support can be added to `frequency-governance.js` in Phase 2.
- **Signal bar on non-homepage pages**: The signal bar is homepage-only in Phase 1. Phase 2 should extract it to a shared include.
- **Moon artwork**: Phase 1 applies CSS atmosphere via `--moon-accent`; per-Moon hero images are not added in this phase to avoid broken `<img>` elements.
