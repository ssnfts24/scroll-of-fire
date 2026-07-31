# Current Feature Matrix

Audit date: 2026-07-31

Status legend: **WORKING**, **PARTIAL**, **BROKEN**, **DISABLED**, **NOT IMPLEMENTED**

| Feature | Status | Evidence |
|---|---|---|
| homepage instrument | WORKING | `tests/living-time-sphere-3d.test.js` homepage checks pass |
| calendar Today | WORKING | today model/boundary tests pass |
| Pattern conversion | WORKING | pattern calendar + model tests pass |
| Passage | WORKING | passage alignment parity tests pass |
| Years | WORKING | spiral/year model tests pass |
| 3D renderer | WORKING | sphere startup restored; renderer tests pass |
| Canvas renderer | PARTIAL | fallback path exists; limited explicit integration validation |
| SVG renderer | WORKING | SVG renderer tests pass; fallback path active |
| camera views | WORKING | camera presets and bounds tests pass |
| labels | WORKING | label manager logic tests pass |
| location | WORKING | first-run/manual coordinate workflow tests pass |
| weather | PARTIAL | Open-Meteo flow works for active place; historical/reanalysis scope still limited |
| sunrise | WORKING | daily sunrise mapping present and validated in provider normalization |
| sunset | WORKING | daily sunset mapping present and validated in provider normalization |
| daylight | WORKING | daylight duration mapping present and rendered in sensor matrix |
| charts | PARTIAL | chart surfaces exist; no dedicated end-to-end chart verification in this pass |
| map | PARTIAL | map-related systems present but not fully validated in this stabilization pass |
| environment layers | PARTIAL | core environment layers work; air-quality/space-weather are placeholder-safe |
| records | PARTIAL | witness/record surfaces present; no full CRUD audit in this pass |
| questions | PARTIAL | optional subsystem present but not fully validated |
| quests | PARTIAL | optional subsystem present but not fully validated |
| historical map | PARTIAL | historical context features present; not fully end-to-end validated |
| deep-time ledger | WORKING | alignment/deep-time ledger engine tests pass |
| PWA | WORKING | service-worker and PWA resilience tests pass |
| offline behavior | PARTIAL | stale fallback path validated; broader offline UX not exhaustively exercised |
| sharing | WORKING | share URL/state tests pass |
| export | WORKING | export tests pass |
