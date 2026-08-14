# Current Feature Matrix

Audit date: 2026-08-14

Status legend: **WORKING**, **VERIFIED COMPLETE**, **BLOCKED**, **BROKEN**, **DISABLED**, **NOT IMPLEMENTED**

| Feature | Status | Evidence |
|---|---|---|
| homepage instrument | WORKING | `tests/living-time-sphere-3d.test.js` homepage checks pass |
| calendar Today | WORKING | today model/boundary tests pass |
| Pattern conversion | WORKING | pattern calendar + model tests pass |
| Passage | WORKING | passage alignment parity tests pass |
| Years | WORKING | spiral/year model tests pass |
| 3D renderer | WORKING | sphere startup restored; renderer tests pass |
| Canvas renderer | VERIFIED COMPLETE | Browser smoke run in Playwright executed `LivingTimeSphereRendererCanvas.renderCanvas(...)` with live model/spiral/layout and returned `true` without runtime errors |
| SVG renderer | WORKING | SVG renderer tests pass; fallback path active |
| camera views | WORKING | camera presets and bounds tests pass |
| labels | WORKING | label manager logic tests pass |
| location | WORKING | first-run/manual coordinate workflow tests pass |
| weather | BLOCKED | Browser historical-range exercise confirms historical messaging paths, but true reanalysis remains unavailable because no reanalysis provider is wired in this runtime/environment |
| sunrise | WORKING | daily sunrise mapping present and validated in provider normalization |
| sunset | WORKING | daily sunset mapping present and validated in provider normalization |
| daylight | WORKING | daylight duration mapping present and rendered in sensor matrix |
| charts | VERIFIED COMPLETE | Playwright run at mobile widths exercised field-range flows (including historical button) with 22 rendered field cards and no app-breaking runtime exceptions |
| map | BLOCKED | Browser validation shows `#obs-century-map` remains empty in this branch/runtime and has no active render output to validate end-to-end |
| environment layers | VERIFIED COMPLETE | Playwright toggled environment/connection layers; layer state and renderer diagnostics updated safely (no app-breaking runtime exceptions) |
| records | BLOCKED | Browser validation shows observatory record controls are present but no active runtime record-write/list-update behavior is bound in this branch for full CRUD validation |
| questions | BLOCKED | Browser “Ask Me a Question” exercise did not surface an active question shell in this runtime; no functional question-flow handler is currently available to verify |
| quests | BLOCKED | Browser quest form exercise did not produce quest list entries; recurring-quest flow is not functionally wired for end-to-end validation in this branch |
| historical map | BLOCKED | Historical map section is present, but browser validation shows no rendered historical nodes/lines to exercise; end-to-end map behavior cannot be validated in this runtime |
| deep-time ledger | WORKING | alignment/deep-time ledger engine tests pass |
| PWA | WORKING | service-worker and PWA resilience tests pass |
| offline behavior | BLOCKED | In sandbox browser runs, `navigator.serviceWorker.controller` remains false on test page, so full controlled offline reload behavior cannot be conclusively exercised here |
| sharing | WORKING | share URL/state tests pass |
| export | WORKING | export tests pass |
