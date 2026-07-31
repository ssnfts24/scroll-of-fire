# Current Build Defect Inventory

Audit date: 2026-07-31  
Branch scope: current pull-request branch  
Pages exercised: `docs/index.html`, `docs/moons.html`, `docs/living-time-sphere.html`

## Defects

| ID | Severity | Visible symptom | Affected page | Source file | Probable cause | Exact reproduction | Expected behavior | Test coverage | Status |
|---|---|---|---|---|---|---|---|---|---|
| DEF-001 | BLOCKER | Sphere page fails during startup; 3D/SVG workflows never fully initialize | `living-time-sphere.html` | `docs/assets/js/sphere/living-time-sphere-ui.js` | `_selectedDayFromMarker` was accidentally scoped inside `_readLocalJson`, causing `ReferenceError` in `applyUrlState()` | Open `living-time-sphere.html` and check console before fix: `ReferenceError: _selectedDayFromMarker is not defined` | URL state and saved selected date should parse without runtime errors | `tests/living-time-sphere-3d.test.js` | **FIXED** |
| DEF-002 | CRITICAL | Selected date authority could not restore correctly from URL marker and saved state | `living-time-sphere.html` | `docs/assets/js/sphere/living-time-sphere-ui.js` | `_restoreSelectedStateIfNeeded` and related helpers were also incorrectly nested and unreachable | Open page with marker query (for example `?marker=day-120`) and observe startup failure before fix | Selected day should survive initialization and remain authoritative | `tests/living-time-sphere-3d.test.js` | **FIXED** |
| DEF-003 | CRITICAL | Location/place persistence fails across reloads; weather repeatedly appears unconfigured | `living-time-sphere.html` | `docs/assets/js/environment/open-meteo-adapter.js` | `safeWrite` rejected all keys except units, silently dropping active place, places list, and cached snapshots | Set manual coordinates, reload page, inspect location/weather state before fix | Active place and weather snapshot should persist safely in local storage | `tests/environmental-sphere-workflow.test.js` | **FIXED** |
| DEF-004 | HIGH | Date classification labels did not match required live/forecast/historical taxonomy | `living-time-sphere.html` | `docs/assets/js/sphere/living-time-sphere-ui.js` | `_classifyActiveDate` used coarse labels (`Current civil time`, generic historical) | Select dates across current/future/past contexts and inspect range badge before fix | Classification should map to `LIVE CURRENT`, `FORECAST`, `HISTORICAL FORECAST`, `REANALYSIS`, `UNAVAILABLE` | `tests/environmental-sphere-workflow.test.js` (indirect) | **FIXED** |
| DEF-005 | MEDIUM | External resources blocked in sandbox produce console noise | `index.html`, `moons.html`, `living-time-sphere.html` | third-party URLs in HTML headers | Blocked network for Google Fonts / GTM in test environment | Open pages in restricted environment and inspect console | Third-party failures should not break core rendering | `tests/site-links.test.js` (partial) | ACCEPTED (non-blocking external dependency) |
| DEF-006 | MEDIUM | WebGL software fallback warnings in headless browser | `living-time-sphere.html` | Browser runtime / GPU stack | Headless WebGL fallback behavior, not app logic failure | Open sphere page in headless browser; observe WebGL deprecation warnings | App should continue with working renderer path | `tests/living-time-sphere-3d.test.js` | ACCEPTED (environment warning) |
| DEF-007 | MEDIUM | Weather classification for reanalysis range still depends on provider capabilities not yet implemented | `living-time-sphere.html` | `docs/assets/js/sphere/living-time-sphere-ui.js`, provider stack | Reanalysis provider pathway is not currently wired into environment provider layer | Select older historical dates and inspect weather availability messaging | Reanalysis should be available when provider support is implemented | No dedicated reanalysis integration test | PARTIAL |
| DEF-008 | LOW | Optional environment sublayers `airQuality` and `spaceWeather` remain placeholders | `living-time-sphere.html` | `docs/assets/js/sphere/living-time-sphere-renderer-3d.js` | Layer hooks exist but no data mapping yet | Enable environment layer with available data and inspect diagnostics | Optional layer failure/absence should not break core 3D renderer | `tests/living-time-sphere-3d.test.js` (interface checks) | PARTIAL (safe optional disable) |

## Runtime error capture summary

- `index.html`: no app-breaking errors; blocked third-party font/GTM loads only.
- `moons.html`: no app-breaking errors; blocked third-party font/GTM loads only.
- `living-time-sphere.html`:
  - Before repair: `ReferenceError: _selectedDayFromMarker is not defined`.
  - After repair: no app-breaking runtime exceptions observed in startup path.

## Notes

- Core blocker resolution prioritized first root runtime error to prevent cascaded secondary failures.
- Optional subsystems continue to degrade without preventing core calendar and renderer operation.
