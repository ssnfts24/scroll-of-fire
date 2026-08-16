# Advanced Rebuild Handoff

Release: `2026.08.15.4`

## What this overlay is

The delivery ZIP is a branch overlay, not a second repository. Extract it and merge its paths into the root of the existing Scroll of Fire repository. It preserves the existing directory structure and contains the rebuilt files, release reports, validation script, and relevant deployment image assets.

Read `RENDERER-HOTFIX-HANDOFF.md`, `LOCATION-REFRESH-HOTFIX-HANDOFF.md`, and `TEMPORAL-LENS-PHASE-HANDOFF.md` for the Android defects and calendar-control defects discovered and repaired during the required pre-merge device preview.

Do not upload the ZIP itself as a repository file: GitHub does not extract uploaded archives. Extract it first, then commit the extracted paths on a new branch.

## Release gate

Node.js 20 or newer is required. From the repository root:

```bash
npm run validate
```

Expected result:

- all 630 tests pass;
- the site audit passes all 69 HTML pages and 34 stylesheets; and
- all 4,092 discovered local references resolve.

## Architectural invariants

- Netlify publishes `docs/`; do not change the publish root.
- `docs/assets/js/moons-version.js` is the authority for the application and service-worker release.
- The homepage and full page share `LivingTimeSphere.mount`; do not fork the calendar or renderer math.
- The homepage must remain sphere-only: no full location/mode/layer command deck.
- Progressive SVG/Canvas output is intentional while the 3D stack initializes or when WebGL is unavailable.
- Observatory records and question preferences are local-first. Do not add remote transmission without a separate privacy design and explicit visitor consent.
- Do not describe recurrence scores as proof of causation.
- Keep workspace JS/CSS optional in the service-worker install list so a nonessential cache miss cannot block the PWA.

## Main implementation groups

- Deployment freshness: `netlify.toml`, `docs/service-worker.js`, `docs/assets/js/moons-version.js`.
- Homepage instrument: `docs/index.html`, `docs/assets/js/home-observatory-instrument.js`.
- Shared renderer lifecycle: `docs/assets/js/sphere/living-time-sphere-mount.js`, cached capability probing, single-canvas generation ownership, and stale-surface disposal before retry.
- Environment lifecycle: pure snapshot reads, one re-entry-safe request per place, bounded provider waits, and explicit location persistence/removal.
- Calendar navigation authority: every Today/Now entry point resolves one canonical live target; the URL, saved marker, year, selectors, details, field range, and renderer update together.
- Temporal Lens: circular day/week/Moon navigation, an exact 364-day scrubber, scoped playback, selected-versus-Today comparison metrics, and a renderer-neutral comparison connection.
- Selected-day performance: one-second live snapshot coalescing plus a solar-only calculation path keep rapid navigation and playback from rebuilding unrelated weather/history state.
- Local calendar continuity: witness and activity dates are grouped by the visitor's local calendar day, including UTC/local rollover hours.
- Full workspace: `docs/living-time-sphere.html`, `docs/assets/css/observatory-workspace.css`, `docs/assets/js/sphere/living-time-observatory-workspace.js`.
- Shared resilience/presentation: `docs/assets/js/site.js`, `docs/assets/css/codex.css`, `docs/assets/css/living-time-sphere.css`, `docs/assets/css/fonts.css`.
- Page-specific content/metadata repairs: the HTML files included in the overlay.
- Release assurance: `package.json`, `scripts/audit-site.mjs`, `tests/advanced-observatory-rebuild.test.js`, `tests/sphere-renderer-lifecycle-hotfix.test.js`, `tests/environmental-sphere-workflow.test.js`, and updated retained tests.

## Deployment review

After a preview deploy, perform the checks in `docs/reports/site-advanced-rebuild-2026-08-15.md`. In particular, test a returning service-worker-controlled browser, confirm release `2026.08.15.4`, exercise both a WebGL-capable and a fallback renderer path, load/clear a location without the tab becoming unresponsive, move away from Today, and verify every Today/Now control restores the live Pattern day.
