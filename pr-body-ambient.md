## The Sphere gained its quiet face — R3 Wave 3, in the films' language

Aaron's direction (voice call, Nov 20, 2026): the options round for the Sphere's visual reworking was waived — *"Go with what you're closest to — what you're going with in the videos."* So this is Witness's closest judgment, built in the films' visual language: warm wood and brass (brass `#daa45b`, sampled from the film), held light, daypart light from the visitor's clock, the Moon's hue, a halo breathing at the Spark's own 4.6 s cadence. PR #188 carried that language onto the instrument's surfaces as accent; this PR extends it from accent to **environment** — and builds the Ambient face, R3's third wave.

**Open for Aaron's review — not merged.**

### The Ambient face (new: `sphere-ambient.js` + `sphere-ambient.css`)

A resting state for the Sphere page. On arrival the day meets the visitor quietly, in front of the instrument:

- **Today's coordinate** — `Moon 8 · Day 22 · Pattern Day 218`, read through the one canonical line (PatternCalendar → DayTelling). This module keeps no clock of its own for the calendar and computes no calendar math.
- **The day's telling** — the telling module's own headline and civil line, verbatim from the record.
- **The day's light** — the visitor's part of day in the front door's four bands (dawn / daylight / dusk / night), from their own clock.
- **The Spark, present** — when a Spark lives on this device, it is named in the greeting ("Selor is here, resting with the day."). When none does, there is no Spark line and no pitch.
- **The instrument stays visible** — the veil is held light: clear at the centre, resting in wood shadow at the edges. The Sphere is seen, resting, behind it. One tap on **Enter the Sphere** wakes it, with Today selected through the page's own public controls; the guide bar gains a **Rest** button to bring the resting face back.
- **A carried view wakes** — a link bearing the Sphere's own URL state opens straight into the instrument: a shared day is a day someone meant to show you.
- **Honesty fences** — a day outside the count is greeted by its own telling and never given a Pattern Day (pinned by test against April 16, 2027). Nothing is generated to fill a gap. Under `prefers-reduced-motion` the held light rests: no breathing, the designed still face, the same rule #188's halo follows.

### The room

The page around the stage becomes the observatory as a warm wooden room at the day's hour: a wooden frame ring and brass hairline around the stage (full-page view; the app view keeps its full-screen stage), the daypart horizon glow rising behind the instrument, the Moon-on-show's hue held at the room's centre — all spent from #188's own variables (`--warm-glow`, `--warm-ground`, `--sphere-moon-hue`), not re-minted.

### The audit's remaining fixes — what landed, what is held

From `sphere-page-improvement-audit-2026-11-19.md` (F7/F8 landed in #190):

| Fix | State | How |
|---|---|---|
| **F10** — plain explainer below the instrument | **Landed** (overlay form) | The audit's exact line — *"A living calendar: 13 moons of 28 days, turning around today. Tap a moon, then a day, to look at it."* — now stands **above** the stage in the page flow, resting or awake, inserted by the Ambient module. The audit's surface was the protected page HTML; the same line is delivered by the overlay instead. |
| **F1** — first screen is an adoption pitch | **Landed** (this page) | On the Sphere page at phone widths, the Ambient module moves the Spark encounter to stand **below the stage**, in the flow, so the instrument introduces itself first; the meeting itself is untouched. On wider screens the corner card stays, capped narrower (330 px) so it covers less of the instrument. |
| **F2** — four stacked bars above the stage | **Landed** | Page-scoped CSS in `sphere-ambient.css` (loads last on this page): the location strip, interact gate, and quick nav fold to slim single rows on phone. |
| **F4** — "You are looking at" truncates mid-word | **Landed** | The audit's exact prepared change, in `sphere-deepening.css`'s phone block (free since #188 landed): the readout wraps whole (`white-space: normal; overflow: visible; text-overflow: clip`) and the bar's height grows. |
| **F3** — floating cards overlap the day ring | **Held** | Renderer anchor placement — `living-time-sphere-renderer-3d.js` + the protected stylesheet. Protected; belongs to a declared protected pass with regression verification. |
| **F5** — moon labels cluster | **Held** | Label-manager placement logic. Protected; a CSS nudge would lie about the anchors. |
| **F6** — day numbers clip at the stage's bottom edge | **Held** | Camera framing / protected stylesheet. Protected. |
| **F9** — tech material as visitor content | **Held** | Its prepared changes edit the page HTML's content (metric rows, headings, table wording). The page is protected; this PR's page touch is tags only, per the guard declaration. |

### Protected-file accounting

Zero R1.7 protected files changed beyond the established pattern: `docs/living-time-sphere.html` gains **one stylesheet link and one script tag** (plus their comment), declared in `tests/homepage-sphere.test.js` by the Ambient signature file, exactly as the Day World (#183) and Deep Time (#187) declarations did. No geometry, rendering, camera, motion, selection, or label code is touched anywhere. The companion layer gains one guide-bar button; the deepening stylesheet gains the F4 rule.

### Verification

- `npm run validate` on the committed tree: **1,698/1,698** (1,690 baseline + 8 new in `tests/sphere-ambient.test.js`), site audit **PASS** (179 pages), catalog/search/R2 checks green. Seals untouched on the branch, per the seals-at-landing rule; the growth entry ("The Sphere gained its quiet face") is in `codex-updates.json` and both homepage lists, per the #193/#195 convention.
- Browser lab (phone 390×844 + desktop): the resting face renders over a visible instrument, the greeting speaks the true coordinate, Enter wakes to the working Sphere with the same state-strip readout as the untouched page, Rest returns, and the encounter stands below the stage on phone. Shots are linked in the build report.
