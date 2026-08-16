# Living Time Temporal Lens Phase Handoff

Release: `2026.08.15.4`

## Purpose

This phase repairs the broken Today behavior and begins the advanced-calendar architecture on top of the accepted Android 3D and location fixes. It is an overlay for the existing `codex/advanced-living-time-observatory-pr72-2026-08-15` branch; it must not be applied to `main` directly.

## Defects repaired

- The top **Today** button previously changed only the visual mode and camera. It now restores the canonical live Pattern day, supported alignment year, semantic `today` marker, field range, selectors, details, URL, accessible announcement, and renderer state.
- Sidebar **Now** and **Today** previously refused to reset after a historical year was selected. They now use the same authoritative reset transaction while remaining decoupled from the top viewing mode.
- A `marker=today` history/deep link could be overridden by an older local selection. Explicit Today state now outranks saved exploration state.
- **Copy Link** omitted the selected marker. Shared URLs now preserve either `today` or the exact selected Pattern day.
- Camera preset buttons temporarily changed the renderer's semantic mode without changing the visible mode controls. Top/Tilted/Edge now move only the camera.
- Data Table and Text renderer choices exposed empty surfaces. Both are now populated from the same canonical model as the visual Sphere.
- Previous/next could appear broken at the ends of the 364-day ring. Relative Pattern navigation now wraps deterministically.

## First advanced-calendar layer

The new renderer-neutral `LivingTimeSphereTemporal` module provides:

- exact 13 × 28 coordinate conversion;
- clamped direct selection and circular relative navigation;
- week-, Moon-, and full-Pattern-year playback scopes;
- canonical Today target resolution with alignment-data fallback;
- selected-versus-Today forward/backward/shortest arc math;
- civil-day and angular deltas; and
- same-Moon and same-Week-Gate comparison.

The full Observatory exposes this through a mobile-responsive **Temporal Lens** with a 364-day scrubber, day/week/Moon jumps, reduced-motion-aware playback, explicit return to live Today, comparison metrics, and a selected-to-Today line in both WebGL and SVG renderers.

## Mobile performance protections

- Live snapshots are coalesced for one second inside a render transaction and invalidated immediately when location/environment state changes.
- Historical selected-day solar context uses a solar-only calculation instead of rebuilding weather, history, witness, and recurrence state.
- Scrubber input is frame-coalesced.
- Playback pauses when the document is hidden or the page is left.
- Reduced-motion visitors cannot enter the fastest playback cadence.

## Validation

From the repository root:

```bash
node --test tests/*.test.js
node scripts/audit-site.mjs
git diff --check
```

Expected source result:

- `630` tests pass;
- `69` HTML pages and `34` stylesheets pass the exhaustive audit;
- `4,092` local references resolve; and
- `git diff --check` prints nothing.

## Required phone preview

Before committing, serve `docs/`, open the full Sphere on the same Android device, and check:

1. Move at least three days away, tap the top **Today** button, and confirm the selected day/status/URL all return to live Today.
2. Enter Passage mode, move one day, tap the sidebar **Today** chip, and confirm the day resets while Passage mode remains active.
3. Drag the Temporal Lens across Moon boundaries; use ±Day, ±Week, and ±Moon at Day 1 and Day 364.
4. Run Pattern Year, Selected Moon, and Selected Week playback, then background the browser and confirm playback pauses.
5. Select Data Table and Text Summary and confirm both contain canonical values.
6. Use Top, Tilted, and Edge camera presets and confirm the top viewing-mode button does not change.
7. Load/refresh a location while rapidly navigating and confirm the tab remains responsive.

Do not merge until the existing 3D, location, and these temporal-navigation checks all pass on the phone.
