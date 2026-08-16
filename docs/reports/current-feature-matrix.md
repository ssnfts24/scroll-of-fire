# Current Feature Matrix

Audit date: 2026-08-15
Release: `2026.08.15.6`

Status legend: **WORKING**, **VERIFIED**, **GRACEFUL FALLBACK**, **PROVIDER-LIMITED**

| Feature | Status | Evidence |
|---|---|---|
| Homepage sphere | **VERIFIED** | The homepage mounts the shared Living Time Sphere with `renderer: "auto"`, loads the complete 3D stack in authority order, reports renderer state, and exposes only the sphere plus four compact readings and a deep link. |
| Progressive 3D activation | **VERIFIED** | Baseline SVG/Canvas is painted first; WebGL2 is required explicitly for Three r167; one cached probe is released immediately; timeout cancellation invalidates late generations; retry generations dispose scene/GPU state and orphan contexts before mounting exactly one replacement surface. |
| Full Observatory sphere | **VERIFIED** | Responsive sphere-first workspace gives the visual field priority, with a 680px minimum presentation on large screens and compact controls moved into collapsible instrument panels. Integrated boot execution now requires the canonical model to produce one accessible baseline render before 3D activation. |
| SVG fallback | **WORKING** | Shared mount keeps SVG available when WebGL is absent, constrained, lost, or slow. Existing renderer tests remain green. |
| Canvas renderer | **WORKING** | Canvas renderer remains available to the shared mount and passes the retained renderer suite. |
| Camera, animation, labels, effects | **WORKING** | Required scripts load before the 3D mount; camera-only presets cannot mutate the semantic view mode; shared camera, animation, label, material, and effects tests pass. |
| Calendar Today | **VERIFIED** | Top Today, sidebar Now/Today, semantic history marker, and Temporal Lens all resolve one canonical day/year/URL transaction; explicit Today outranks stale local exploration. |
| Temporal Lens | **VERIFIED** | Exact 364-day scrubber, circular ±day/week/Moon navigation, Week/Moon/Year playback scopes, civil/Pattern/angular comparison, and selected-to-Today renderer connections pass dedicated regressions. |
| Synchronized Calendar Atlas | **VERIFIED** | Civil-date and exact Pattern-coordinate jumps drive synchronized Day, Week, Moon, and Year views; outside days remain visibly outside the 364-day count; keyboard navigation, focused layer lenses, pins, and shortest-arc comparisons work without WebGL. |
| Private calendar / agenda | **VERIFIED** | Per-day titles and notes stay in local browser storage, appear on calendar cells and a year agenda, never enter shared URLs, and can be deliberately imported/exported as bounded iCalendar data. |
| Alternate data views | **VERIFIED** | Data Table and Text Summary are populated from the same canonical selected/today/astronomy/alignment model instead of exposing empty surfaces. |
| Pattern conversion | **WORKING** | Pattern calendar, year-model, conversion, and boundary tests pass. |
| Passage | **WORKING** | Passage alignment and parity tests pass. |
| Years / deep time | **WORKING** | Spiral, year-model, alignment-ledger, and deep-time tests pass. |
| Environment layers | **GRACEFUL FALLBACK** | Forecast/location data may enrich the sphere, while unavailable or timed-out providers cannot prevent core rendering. Air-quality and space-weather remain optional. |
| Weather forecast | **VERIFIED** | Open-Meteo refreshes are bounded, re-entry safe, deduplicated per place, and separated from pure Sphere snapshot reads; persisted-place and explicit removal workflows pass dedicated regressions. |
| Historical reanalysis | **PROVIDER-LIMITED** | The interface classifies and explains historical availability, but true reanalysis still requires a compatible provider. No historical result is presented as live data. |
| Explicit location capture | **VERIFIED** | Geolocation is requested only after a user action; device, manual, persisted, and continue-without-weather paths remain responsive and deterministic. |
| Local witness records | **VERIFIED** | Full and quick capture, local-day grouping across UTC rollover, schema normalization, validation, outcome updates, archive, tag filtering, confirmed deletion, draft state, and a 5,000-record bound are implemented. |
| JSON import/export | **VERIFIED** | Versioned export, 5 MB import bound, malformed-date protection, schema normalization, invalid-record rejection, deduplication, and record/quest merge are implemented. |
| Personal questions | **VERIFIED** | Context-aware prompts, category controls, cadence levels, quiet hours, snooze, skip, reason display, and keyboard submission are wired. |
| Recurring quests | **VERIFIED** | Daily, weekly, monthly, interval, and Moon Day schedules support answer, pause/resume, and confirmed deletion. |
| Recurrence review | **VERIFIED** | Similarity scores are bounded and explained using shared tags/place/Moon/season/proximity; the interface explicitly avoids causal claims. |
| 50–500-year map | **VERIFIED** | Container-aware SVG geometry renders adaptive year ticks, Pattern-day position, the current marker, record nodes, and optional explainable recurrence lines without mobile horizontal overflow or an extra-tall empty state. |
| PWA shell | **VERIFIED** | Mandatory cache list, refresh recovery, offline shell, worker version parity, and cache migration tests pass. |
| Deployment freshness | **VERIFIED** | HTML and source assets revalidate every deploy, the service worker is never stored, and the worker uses network-first behavior for scripts/styles/core resources. |
| Site-wide resilience | **VERIFIED** | All 69 HTML pages and 35 stylesheets pass structural, metadata, duplicate-ID, fragment, image-alt, and local-reference checks across 4,095 local references. |
| Sharing and export | **WORKING** | Sphere Copy Link preserves semantic Today or the exact selected day; browser history restores the complete serialized state without rewriting the popped entry; private calendar entries export only after an explicit `.ics` action. |

## Verification boundary

The pre-rebuild production site was inspected in a cloud browser and supplied the baseline defects. The rebuilt local source was then verified through 644 automated tests, syntax checks, and the exhaustive static route/reference audit. WebGL hardware selection remains device-dependent by design: WebGL1-only and unsupported devices receive a working SVG renderer and a readable reason instead of a blank field.
