# 2026-08-17 Reality State / First-Frame Patch Handoff

## Problem confirmed from phone testing

The 3D geometry could appear to become complete only after Play or another temporal interaction. That indicates the initial async renderer lifecycle can miss state or extension synchronization that a later interaction subsequently forces.

## Fixes in this patch

- `living-time-sphere-renderer-3d.js`
  - adds an explicit extension `initial-sync` lifecycle during 3D initialization
  - directly renders extension geometry before interaction is required
  - queues the newest `refresh()` received while Three.js is still initializing
  - commits that pending refresh once the renderer becomes ready
  - resets queued refresh state on teardown

- `living-time-sphere-temporal-strata.js`
  - version `2.1.0-reality-corridors`
  - Living Strata defaults to enabled
  - default 25-year view is balanced around the selected year
  - separates past record shells from future planning shells
  - selected year remains a gold present/selected membrane
  - selected Pattern day creates a corridor through all visible year shells
  - selected Moon creates corridor boundary guides
  - future shells explicitly carry `predictive: false`

- `living-time-sphere-ui.js` / `living-time-sphere.html`
  - adds a Reality State panel: Past / Present / Future
  - future state copy explicitly says planning/possibility, not prediction
  - Living Strata controls match first-load runtime defaults
  - visual key explains record/present/planning/corridor/evidence

- `living-time-sphere.css`
  - styles the Reality State model and new temporal semantics

- `docs/index.html`
  - aligns homepage Observatory copy with the new temporal-atlas definition

- tests
  - adds initial-scene lifecycle regression coverage
  - adds Pattern corridor tests
  - full validation passes

## Validation

`npm run validate`

Result at package creation:

- 764 tests passed
- 0 failed
- site audit passed
- 69 HTML pages audited
- 36 stylesheets audited
- 4109 local references audited

