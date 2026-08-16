# Renderer Lifecycle Hotfix Handoff

Release: `2026.08.15.3`

## Trigger

Same-device Android preview rendered a valid first WebGL frame but then reported
`DUPLICATE_CANVAS`. Diagnostics showed seven renderer canvases across seven
initialization generations.

## Root cause

- Repeated diagnostics created temporary WebGL contexts instead of reusing one
  cached capability result. Mobile browsers have a limited context budget and
  may evict the active renderer when that budget is exhausted.
- A context-loss retry appended a replacement canvas without disposing the
  interrupted renderer generation and pruning its orphaned canvas.
- The full-page UI could immediately request another 3D render from inside the
  context-loss callback, before the old surface had been removed.

## Repair

- Cache the WebGL capability probe for the page lifetime and explicitly release
  its temporary context.
- Make renderer diagnostics inspect the existing renderer context without
  allocating probe canvases.
- Give every 3D canvas a renderer generation and enforce one authoritative
  renderer-owned canvas per host.
- Dispose stale GPU state and remove orphan canvases before automatic or manual
  retries.
- Suppress duplicate full-page UI initialization and prevent immediate 3D
  relaunch from the context-loss callback.
- Bump the app/service-worker release so controlled browsers receive the repair.

## Verification

- Same-device Android recheck now confirms the 3D Sphere remains active with the repaired lifecycle.
- 615 automated tests pass, including renderer and environment lifecycle regressions.
- 69 HTML pages, 34 stylesheets, and 4,091 local references pass the site audit.
- Preview-deploy acceptance still requires a cold load showing one active canvas
  and no `DUPLICATE_CANVAS` fallback.
