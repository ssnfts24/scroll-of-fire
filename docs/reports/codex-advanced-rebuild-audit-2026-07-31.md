# Codex Advanced Rebuild Audit (2026-07-31)

## Scope
- Audited `docs/` as the production static deployment root.
- Baseline inventory and runtime checks were run before rebuild edits.

## Inventory
- HTML pages: **69**
- CSS files: **29**
- JavaScript files: **90**
- JSON files: **9**
- Service worker: `docs/service-worker.js`
- PWA manifest: `docs/manifest.webmanifest`

### Core module families found
- Astronomy: `docs/assets/js/astronomy/*`
- Pattern Calendar: `docs/assets/js/calendar/*`, `docs/assets/js/calendar-cor.js`
- Sphere: `docs/assets/js/sphere/*`
- Equinox Passage: `docs/assets/js/equinox/*`
- Alignment Ledger: `docs/assets/js/alignment/*`
- Oracle: `docs/assets/js/oracle/*`, `docs/assets/js/genesis-oracle.js`
- Witness/memory: `docs/assets/js/codex-witness.js`, `docs/assets/js/codex-memory.js`
- Environmental hooks: `living-time-sphere-live-data.js` + field matrix logic in `living-time-sphere-ui.js`

## Baseline test status
- Ran: `node --test tests/*.test.js`
- Result: **428 pass / 3 fail**
- All failures were homepage sphere integration failures in `tests/living-time-sphere-3d.test.js`:
  - missing expected homepage lazy-init marker (`IntersectionObserver`)
  - missing expected homepage observatory elements/CTA strings
  - missing expected homepage shared mount initializer reference

## Defects and risk findings

### 1) Homepage observatory integration mismatch
- Homepage used an iframe embed for the sphere instead of an in-page shared instrument mount.
- This violated the existing test contract and introduced a split interaction model.

### 2) Dead sphere script references
- `docs/living-time-sphere.html` referenced non-existent files:
  - `living-time-seasonal-environment.js`
  - `living-time-observatory-records.js`
  - `living-time-observatory-recurrence.js`
  - `living-time-multiyear-map.js`
  - `living-time-observatory-dashboard.js`
  - `living-time-natural-participation.js`
  - `living-time-question-quests.js`
- These produced runtime 404s and broken script loading.

### 3) Environmental provider not wired
- `living-time-sphere-ui.js` had `providerConfigured = false` hardcoded in field snapshot assembly.
- Result: weather rows were permanently unavailable despite environment UI surface existing.

### 4) Duplicate ID
- `docs/moons.html` contains duplicate id usage for `id="today"`.

### 5) Broken-link clusters
- Automated local reference scan found major broken-link clusters, including deep `docs/theory/*` sub-pages using unresolved relative roots.
- A focused pass is required for theory subpage root-relative linking consistency.

### 6) Orphan/unused asset candidates
- CSS candidates not referenced directly by HTML include:
  - `docs/assets/css/tokens.css`
  - `docs/assets/css/start-show.css`
  - `docs/assets/css/frequency-governance.css`
  - `docs/assets/css/manifest-show.css`
  - `docs/assets/css/bridge.css`
  - `docs/assets/css/fonts.css`
- These need confirm/retain/removal decisions with route-level dependency tracing.

## Rebuild priorities executed from this audit
1. Replace homepage iframe observatory with a bounded in-page mission instrument using shared state/model.
2. Add Open-Meteo adapter and connect environment/weather telemetry and matrix freshness metadata.
3. Remove dead script references from sphere page.
4. Re-run full tests and static audits.

## Known remaining follow-up from audit
- Deep-time expansion target (1000–3000 CE) is not yet represented in current canonical alignment range.
- Theory subpage link normalization still requires a dedicated sweep.
- Duplicate `id="today"` in `moons.html` still requires targeted remediation.
