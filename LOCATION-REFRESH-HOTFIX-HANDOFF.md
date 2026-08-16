# Location Refresh Lifecycle Hotfix Handoff

Release: `2026.08.15.3`

## Trigger

The repaired 3D Sphere passed same-device Android preview, but choosing the
device location made the full Observatory tab unresponsive while weather was
loading.

## Root cause

- Sphere live-data snapshot construction initiated a weather refresh as a side
  effect of reading the current model.
- The adapter announced `LOADING WEATHER` before publishing its in-flight
  promise. A synchronous environment-change listener could therefore read the
  model, start another refresh, announce loading again, and recursively repeat
  on the main thread.
- The location-change listener forced a second provider request after the
  location command had already awaited one.
- Provider and place-search network waits were unbounded, and a superseded
  location request could later overwrite the current location state.

## Repair

- Keep live snapshot construction side-effect free; adapter bootstrap and
  explicit user commands own refresh initiation.
- Install one coordinate-keyed in-flight operation before dispatching the
  loading state, coalescing forced and background requests for the same place.
- Abort superseded work and use a refresh generation so an older response
  cannot publish or persist over the current place.
- Coalesce location-change rendering without issuing a duplicate fetch.
- Bound forecast requests to 15 seconds and place searches to 12 seconds while
  preserving cached/offline fallback behavior.
- Make location-command mounting idempotent, expose useful progress messages,
  and fully clear persisted state when continuing without weather.
- Align witness and recent-action grouping to the visitor's local calendar day;
  the full gate exposed the mismatch while UTC had advanced to the next date.

## Verification

- Dedicated regression synchronously requests another refresh from inside the
  loading event and proves that only one loading event and one network request
  occur.
- Snapshot-purity, persistent-location-removal, and local-date rollover
  regressions pass.
- The complete release gate passes 615 tests plus the 69-page, 34-stylesheet,
  4,091-reference site audit.
- Final acceptance requires repeating device-location loading on the same
  Android preview while confirming the tab, 3D Sphere, controls, and scrolling
  remain responsive.
