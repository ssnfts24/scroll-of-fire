# Codex Homepage and Remnant 13 Moons Restoration Audit

**Scope:** current production files in `docs/`, preserved sources in
`archive/pre-rebuild-20260716/`, and rebuild commits `70da546`, `7ff2616`,
and `2e59655`.  This audit is the recovery baseline; archived files remain
reference sources and are not runtime dependencies.

## Architecture decision

`docs/moons.html` is the one complete application.  `docs/moons/index.html`
is a query-string- and hash-preserving bridge to `../moons.html`.  Restoration
will extend the modular `moons-data`, `moons-engine`, `moons-storage`,
`moons-ui`, and `moons-app` stack rather than load archived `moons.js`.

Homepage-only rules will remain under `.page-home`; Moons-only rules will
remain under `.page-moons`.  No legacy stylesheet will be loaded wholesale.

## Homepage comparison

| System / section | Current status | Archived source and dependencies | Recovery action |
| --- | --- | --- | --- |
| Hero, title, primary actions, seal row | Preserved but simplified | `index.html` hero; `home.css`; `home-codex-living-system-exact-13-final.webp` | Retain current visual foundation; restore layered signal, guidance, and motion treatment in scoped CSS. |
| Living signal / day-part guidance | Missing | `index.html` `.living-signal-shell`; `living-codex.js`; `home.css` | Port state-driven dawn/day/dusk/night copy to the new homepage runtime. |
| Live Today / Witness panel | Preserved but simplified | `index.html` `.today-codex-panel`, `.your-codex-panel`; `calendar-cor.js`, `living-codex.js` | Replace duplicate homepage date math with shared `moons-engine`; add phase, illumination, boundary, Shabbat, and resilient fallback text. |
| Continue-path / local witness state | Missing | `index.html` `.continue-path-panel`, `.your-codex-panel`; `living-codex.js`; legacy local-storage keys | Adapt safe reads and migration-aware counts; never make storage availability a prerequisite. |
| Activity / living signal | Present but simplified | `index.html` `.codex-activity-panel`; `living-codex.js`; `assets/data/codex-updates.json` | Retain local curated feed and restore contextual active-system presentation without fabricated activity. |
| System map | Missing as a distinct system | Hero artwork and `assets/img/home/sections/home-core-gates.webp` | Restore a mapped relationship treatment for calendar, witness, frequency, artifacts, theory, caravan, oracle, and living technology. |
| Gateway hierarchy | Preserved but simplified | `index.html` main systems, “What You Can Do”, and feature cards; `home.css` | Restore differentiated gateways for all existing destinations, not an equal-card directory. |
| 60-second Codex entry / breath field | Missing | `index.html` `.exercise-card`; `home.css`; archived motion integration | Restore reduced-motion-safe interaction using the existing motion approach, adapted to scoped DOM. |
| Covenant Caravan | Preserved but simplified | `index.html` `.caravan-card`; `home.css`; `home-gate-covenant-caravan.webp` | Restore “21st century traveling artisan,” Stabilize/Practice/Build/Trade/Move, family, animals, craft, and road exchange. |
| Remnant 13 Moons gateway | Preserved but simplified | `index.html` `.moon-panel`; `home.css`; `home-gate-13-moons.webp` | Keep the current gateway but bind it to the authoritative calendar state. |
| Artifact archive | Preserved and working, but simplified | `index.html` `.artifact-card-mini`; `home.css`; registry images | Preserve existing identifiers/images and restore richer registry/status treatment; no commerce-card replacement. |
| Daily Return | Missing | `index.html` `.witness-card`; `home.css`; `home-daily-return.webp` | Restore a closing return/seal with Observe, Name, and Return. |
| Theory / equation | Missing | `index.html` `.codex-title`; `home.css`; theory routes | Restore a real theory gateway containing the central equation and its linked concepts. |
| Frequency preview | Missing | gateway/feature-card markup; Frequency page assets and `frequency-governance.js` | Build a compact user-initiated preview: carrier, beat, intention and visual mode; never autoplay. |
| Navigation | Preserved and working | current `navigation.js`, current grouped markup; archived `navigation.css` | Keep the grouped Today / Explore / Build / Artifacts / About model and canonical Moons links. |
| Approved imagery | Preserved but incomplete | archived references, `assets/img/home/**`, `assets/img/artifacts/registry/**` | Verify every referenced image; use intentional symbolic fallback only for genuine absences. |

## Moons application comparison

| System / section | Current status | Archived source and dependencies | Recovery action |
| --- | --- | --- | --- |
| Canonical route | Route-conflicted but bridge working | current `moons.html`, `moons/index.html`; archived routing | Keep `moons.html` canonical, keep bridge minimal, and normalize all internal links. |
| Calendar doctrine / date state | Preserved and working | current `moons-engine.js`, `moons-data.js`; archived `calendar-cor.js`, `moons.js` | Retain modular engine, tested 2026 anchor and Year Gate semantics; expose one shared state object. |
| Command Center | Preserved but simplified | archived `moons.html`, `moons.js`, `moons.css` | Restore effective date, year position, Year Gate, solar/field state, logs/pattern counts, artwork, and full metrics. |
| Time Gate controls | Preserved but simplified | archived `moons.html`, `moons.js`, `pwa-install.js` | Restore timezone, boundary modes, manual sunset, location sunset, copy link, installation and update controls. |
| Shabbat system | Present but broken/simplified | archived Shabbat panel, `moons.js`, `moons.css`, gate artwork | Restore preparation, active, return, readings, household/body/witness guidance, stop rule and continuous-week explanation. |
| Daily Flow | Preserved but simplified | archived flow markup and `moons.js` | Restore Read/Witness/Log/Pattern/Seal ritual and body/field guidance. |
| Pattern engine / timeline | Present but broken/simplified | archived pattern/timeline markup and `moons.js`; saved logs | Restore 3/7/14/28-day analysis, repeated-signal views, layers, and useful empty states. |
| Mirror Reading | Preserved but simplified | archived mirror markup and `moons.js`; current `buildMirrorReading` | Restore named focus modes, build/copy actions, all reading components, and selected-date state binding. |
| Daily Witness Builder | Missing / intentionally replaced by a small log form | archived witness markup and `moons.js`; local storage | Restore full fields, build/copy/save/clear output; normalize and migrate safely. |
| Astrology mirror | Present but broken (stub) | archived astrology markup and `moons.js`; astrology image assets | Restore symbolic solar gate, moon mirror, planet wheel, placement/aspect mirror and explicit approximate labels. |
| Calendar / Year Map | Present but simplified | archived calendar/year-map markup and `moons.js`; current engine | Restore 13×28 calendar, Gregorian overlay, selected/today states, moon details, practice and Year Gate. |
| Codex Seal | Present but broken (stub) | archived seal markup and `moons.js` | Restore selected-date summary, archetype, frequency, prompt, and copy action. |
| Field layers | Present but broken (stub) | archived field markup and `moons.js` | Restore body/mind/field/witness layers and explicitly symbolic/manual/unavailable environmental labels. |
| Saved logs | Preserved but simplified | archived saved-log controls and `moons.js`; current `moons-storage.js` | Restore detail, copy one/all, import/export, delete, clear, malformed-data safety, and migration. |
| Artwork | Preserved but simplified | archived `moons.html`, `moons.css`; `assets/img/moons/**`; current `moons-images.js` | Load only manifest-backed artwork and render symbolic fallback without broken requests. |
| PWA/cache | Preserved and working | current `service-worker.js`, `pwa.js`; archived PWA files | Bump cache, retain network-first document/JS strategy, and guarantee neither route yields a separate cached app. |
| Metadata / analytics | Preserved and working | current pages and archive metadata | Preserve schemas and exactly one GA loader per page. |

## Direct reuse and adaptation matrix

| Source | Directly reusable | Requires adaptation |
| --- | --- | --- |
| `archive/pre-rebuild-20260716/index.html` | content, section order, approved wording, destinations | markup classes and all layout ownership |
| `archive/pre-rebuild-20260716/home.css` | visual tokens and individual component treatments | all selectors must be re-scoped to `.page-home` |
| `archive/pre-rebuild-20260716/living-codex.js` | day-part copy, safe-storage patterns, feed semantics | state calculation must call current `moons-engine` |
| `archive/pre-rebuild-20260716/moons.html` | full interface semantics, labels, controls, accessibility targets | declarative bindings for current UI modules |
| `archive/pre-rebuild-20260716/moons.css` | component visual language and responsive treatments | all page-specific selectors must be `.page-moons` scoped |
| `archive/pre-rebuild-20260716/moons.js` | feature reference, copy, derived-display behavior | no direct loading; port bounded functions into modular files |
| `archive/pre-rebuild-20260716/calendar-cor.js` | historical calendar semantics | current engine remains authoritative after boundary tests |
| archived PWA files | install language and update affordances | current safe service-worker architecture remains authoritative |

## Known recovery constraints

* The current rebuild has preserved modular calendar calculations, test coverage, a query-preserving bridge, grouped navigation, and safe service-worker routing; these are retained.
* The archived application is feature-complete reference material, not a stylesheet or runtime to load beside current code.
* Environmental readings are only restored as calculated, symbolic, manually entered, cached, or unavailable—never fabricated as live data.
* Image restoration is limited to verified existing assets. Missing daily artwork uses a symbolic fallback rather than speculative URLs.

## Missing / simplified feature restoration details

| Surface | Classification | Original source file | Original selector/section | Original CSS source | Original JS source | Required images/data | Restoration method |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Homepage living signal rail | Missing | `archive/pre-rebuild-20260716/index.html` | `.living-signal-shell`, `[data-living-signal-root]` | `archive/pre-rebuild-20260716/home.css` | `archive/pre-rebuild-20260716/living-codex.js` | local daypart + activity feed | Recreate rail in `docs/index.html`, wire to `home.js` daypart/state, and scope styles in `home-rebuild.css`. |
| Homepage Continue Path + Your Codex | Missing | `archive/pre-rebuild-20260716/index.html` | `.continue-path-panel`, `.your-codex-panel` | `archive/pre-rebuild-20260716/home.css` | `archive/pre-rebuild-20260716/living-codex.js` | local witness logs | Port continuity cards and bind to shared Remnant state + `moons-storage` log count/pattern count. |
| Homepage live Today depth | Preserved but simplified | `archive/pre-rebuild-20260716/index.html` | `.today-codex-panel` | `archive/pre-rebuild-20260716/home.css` | `archive/pre-rebuild-20260716/calendar-cor.js`, `living-codex.js` | moon/day/phase/shabbat/sunset fields | Expand homepage Today panel to show selected/effective date, moon/day/year metrics, boundary, phase, Shabbat, and field summary from `moons-engine`. |
| Homepage Daily Return section | Missing | `archive/pre-rebuild-20260716/index.html` | `#witness-title`, `.witness-grid` | `archive/pre-rebuild-20260716/home.css` | `archive/pre-rebuild-20260716/living-codex.js` | `assets/img/home/sections/home-daily-return.webp` | Restore dedicated Observe/Name/Return close section with strong hierarchy. |
| Moons command center metrics | Preserved but simplified | `archive/pre-rebuild-20260716/moons.html` | `#commandMoon`, command center metric blocks | `archive/pre-rebuild-20260716/moons.css` | `archive/pre-rebuild-20260716/moons.js` | solar gate + field + pattern/log counts | Add missing metrics and bind through modular `moons-ui` render path. |
| Time Gate controls + install hints | Preserved but simplified | `archive/pre-rebuild-20260716/moons.html` | date controls + install panel | `archive/pre-rebuild-20260716/moons.css` | `archive/pre-rebuild-20260716/pwa-install.js`, `moons.js` | install/update actions | Keep current controls, add explicit manual sunset mode language, iPhone A2HS guidance, and update surface. |
| Shabbat full reading blocks | Present but simplified | `archive/pre-rebuild-20260716/moons.html` | `#shabbatPanel` reading cards | `archive/pre-rebuild-20260716/moons.css` | `archive/pre-rebuild-20260716/moons.js` | gate guidance text | Restore preparation/active/return framing, seal, full reading, and household/body/witness guidance. |
| Daily Witness fields breadth | Preserved but simplified | `archive/pre-rebuild-20260716/moons.html` | witness form fields | `archive/pre-rebuild-20260716/moons.css` | `archive/pre-rebuild-20260716/moons.js` | storage keys and migration | Add weather/technology/animals fields and include in template/storage normalization. |
| Astrology body house/aspect distinction | Present but simplified | `archive/pre-rebuild-20260716/moons.html` | astrology cards, planetarium | `archive/pre-rebuild-20260716/moons.css` | `archive/pre-rebuild-20260716/moons.js` | `planetWheel`, solar gate data | Extend modular astrology output with symbolic body house and aspect mirror labels. |
| Calendars panel depth | Present but simplified | `archive/pre-rebuild-20260716/moons.html` | calendar panel + Gregorian overlay | `archive/pre-rebuild-20260716/moons.css` | `archive/pre-rebuild-20260716/moons.js` | year map + moon day labels | Add explicit current-moon 4x7 calendar grid with selected/today/highlight states and Gregorian mapping text. |
| PWA cache generation | Preserved but version stale | `archive/pre-rebuild-20260716/service-worker.js` | service worker install/activate/fetch | N/A | archived + current SW | cache namespace | Bump to `scroll-of-fire-v20260716-r4`, keep network-first docs/JS rules, and remove remnant legacy caches. |
