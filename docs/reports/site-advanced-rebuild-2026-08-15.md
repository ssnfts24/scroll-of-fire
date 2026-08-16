# Scroll of Fire Advanced Rebuild Report

Release: `2026.08.15.6`
Audit date: 2026-08-15
Deployment root: `docs/`

## Outcome

This release turns the Living Time Sphere into the site's primary interactive instrument, connects the previously static Observatory shells, repairs deployment freshness, and adds an exhaustive site contract for every deployed route. The homepage now uses the same progressive sphere system as the full Observatory without exposing the full control deck.

## Baseline findings

The production baseline was inspected before implementation. The homepage Sphere could remain blank, the full Sphere could stay on an unexplained fallback, advanced controls crowded the main field, Observatory record/question/quest/map shells had no application controller, several deployed images failed despite existing in source, and cache rules could preserve outdated stable filenames. Several legacy pages also lacked useful headings, canonical metadata, descriptions, or resolvable local links.

## Phase 1 — deployment and shared resilience

- Bumped the unified application/service-worker build to `2026.08.15.6`.
- Changed scripts, styles, and HTML to revalidate on deploy; made the worker itself `no-store`.
- Changed core JS/CSS/manifest requests in the worker to network-first with a cached offline fallback.
- Kept nonessential Observatory assets optional during service-worker installation so one advanced surface cannot prevent the base PWA from installing.
- Replaced the missing local Inter font resource with an explicit system fallback stack.
- Extended shared broken-media handling so failed resources and their empty presentation shells collapse safely.

## Phase 2 — homepage and full Sphere

- Rebuilt the homepage section as a sphere-first composition with the real shared mount, ambient field, four compact readings, renderer status, and one deep link.
- Removed location, layer, date, and mode controls from the homepage instance.
- Added the complete 3D dependency sequence to the lazy loader and prevented offscreen observation from destroying a reusable mount.
- Added renderer lifecycle state to the shared mount: baseline, upgrading, ready, fallback, context loss, and teardown.
- Preserved SVG/Canvas as functional progressive fallbacks instead of treating non-WebGL devices as failures.
- Rebalanced the full Observatory layout around a large visual field and collapsible advanced controls.
- Corrected the Android renderer-recovery loop discovered during same-device preview: diagnostics now reuse one cached WebGL probe, temporary probe contexts are released, and interrupted renderer generations are disposed before a single replacement canvas is mounted.
- Corrected the Android location freeze discovered after 3D acceptance: live snapshot reads no longer initiate provider work, refreshes install their in-flight guard before announcing loading, same-place requests coalesce, superseded requests cannot overwrite current state, and provider waits are bounded.

## Phase 3 — Observatory application layer

Added a versioned, local-first workspace with:

- quick and full witness capture;
- local-calendar-day grouping for witnesses and recent actions across UTC rollover hours;
- observation/interpretation/uncertainty/action/outcome separation;
- local drafts, record bounds, archive, filters, outcome updates, and confirmed deletion;
- explicit geolocation capture and optional environmental fields;
- versioned JSON export/import with size limits, validation, normalization, deduplication, and safe malformed-date handling;
- context-aware personal questions with categories, cadence, quiet hours, snooze, skip, and prompt rationale;
- recurring quests on daily, weekly, monthly, interval, and Moon Day schedules;
- explainable recurrence scoring that does not make causal claims; and
- a responsive 200-year SVG map with record nodes and optional recurrence lines.

All personal records remain in browser storage unless the visitor deliberately exports them. Location is not requested until the visitor activates the control.

## Phase 4 — every-page audit and content repair

The new audit evaluates every HTML page and every stylesheet. It verifies document structure, language, title, viewport, useful description, production canonical, exactly one H1, shared runtime inclusion, duplicate IDs, internal links, fragments, local assets, image alternatives, and CSS URLs.

Page-specific repairs include canonical corrections, missing descriptions/headings, dead icons/links, a missing top anchor, an Invocation provenance section, a completed Equation 9 ethics/containment section, and a glossary expansion from the unfinished A–C fragment through the declared D–W index. Shared page-intro styling brings the upgraded legacy routes into the same visual language.

## Phase 5 — authoritative Today and Temporal Lens

- Unified the top Today mode, sidebar Now/Today scope, browser history, and explicit Return to Live Today action behind one canonical selection transaction.
- Made the live target update the Pattern day, alignment year, semantic marker, field range, selectors, local state, deep-link URL, details, accessibility status, and both renderers together.
- Added a renderer-neutral temporal engine for exact 13 × 28 coordinate math, circular navigation, scoped playback, and selected-versus-Today comparison.
- Added a mobile-first Temporal Lens with an exact 364-day scrubber, ±day/week/Moon movement, reduced-motion-aware playback, and explainable arc/civil/Moon/Week deltas.
- Added a selected-to-Today comparison connection to WebGL and SVG.
- Repaired Copy Link marker preservation, camera-only presets, and previously empty Data Table/Text Summary renderers.
- Coalesced live snapshot reads and split selected-day solar context into a lightweight pure calculation so rapid navigation cannot repeatedly rebuild unrelated environment/history state.

## Verification

- 644 automated tests pass.
- 69 HTML pages audited.
- 35 stylesheets audited.
- 4,095 local references checked.
- JavaScript syntax checks pass for the homepage loader, shared mount, Observatory workspace, service worker, and audit script.
- No missing local target, fragment, canonical, duplicate ID, heading, description, viewport, or image-alt failure remains in the audited source.

## Phase 6 — boot-path and mobile cartography hotfix

- Repaired the release `.4` full-page startup `ReferenceError` caused by returning an undefined shorthand instead of the resolved live Today coordinate.
- Added integrated full-page boot execution using the real Pattern, astronomy, alignment, temporal, state, connection, environment, live-data, accessibility, layout, and UI modules. The gate requires one first render and one accessible SVG baseline.
- Rebuilt the Deep Time chart layout around measured container width, adaptive 50–500-year tick cadence, a bounded resize path, and an overlaid empty-state explanation.

## Phase 7 — Synchronized Calendar Atlas and renderer hardening

- Added one civil/Pattern Calendar Atlas with synchronized Day, Week, Moon, and Year scales, exact civil and Pattern jumps, explicit outside days, semantic Today, keyboard navigation, focused layer lenses, and pinned shortest-arc comparisons.
- Added a private local day journal and year agenda. Notes are bounded, never enter shared URLs, and move to or from another calendar only through an explicit iCalendar import/export action.
- Made WebGL2—not generic WebGL—the authoritative requirement for Three r167 and pass the exact canvas context into `WebGLRenderer`.
- Added renderer init epochs and explicit cancellation so a timeout cannot publish a late canvas; capped recovery polling and settled failures on the working SVG renderer.
- Disposed dynamic and full-scene geometries, materials, textures, orphan contexts, and renderer contexts; detached pointer, visibility, intersection, and resize lifecycle hooks.
- Converted still/clean animation to demand-driven rendering, capped animated presets, and routed frame exceptions into the existing fallback path.
- Restored every serialized URL field during browser history navigation, reset absent fields to documented defaults, and suppressed history writes while applying a popped entry.
- Separated the configured calendar boundary from provider sunset observations in the interface. Astronomical sunset remains an explicit future boundary mode rather than an unannounced substitution.

Run the same release gate with:

```bash
npm run validate
```

## Post-deploy checks

After merging, verify the homepage at desktop and mobile widths, open the full Sphere on one WebGL2-capable and one WebGL1-only/constrained device, confirm the renderer status is truthful, load and clear a location while the Sphere stays responsive, exercise Calendar Atlas scale/jump/note/`.ics` flows, move away from Today and exercise every return path, run each Temporal Lens scope, inspect Data Table/Text Summary, create/export/delete a test witness, create/answer a quest, inspect every 50–500-year map span, and confirm that a previously controlled browser receives release `2026.08.15.6`. Historical reanalysis remains provider-limited; optional air-quality and space-weather layers must continue to fail without affecting the core instrument.
