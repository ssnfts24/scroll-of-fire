# CODEX R2 — Dependency Map

## npm scripts

| Script | Command |
| --- | --- |
| `test` | `node --test tests/*.test.js` |
| `audit` | `node scripts/audit-site.mjs` |
| `scroll:freeze` | `node scripts/scroll-source-audit.mjs freeze` |
| `scroll:audit` | `node scripts/scroll-source-audit.mjs audit --write` |
| `scroll:build` | `node scripts/build-scroll-library.mjs` |
| `scroll:search` | `node scripts/build-scroll-search.mjs` |
| `scroll:search:check` | `node scripts/build-scroll-search.mjs --check` |
| `scroll:editorial` | `node scripts/build-scroll-editorial.mjs` |
| `scroll:editorial:check` | `node scripts/build-scroll-editorial.mjs --check` |
| `site:catalog` | `node scripts/build-site-catalog.mjs` |
| `site:catalog:check` | `node scripts/build-site-catalog.mjs --check` |
| `search:index` | `node scripts/build-search-index.mjs` |
| `search:index:check` | `node scripts/build-search-index.mjs --check` |
| `r2:inventory` | `node scripts/build-r2-inventory.mjs` |
| `r2:inventory:check` | `node scripts/build-r2-inventory.mjs --check` |
| `r2:inventory:check:branch` | `node scripts/build-r2-inventory.mjs --check=branch` |
| `site:seal` | `npm run site:catalog && npm run search:index && python3 scripts/r2-extract-documents.py && npm run r2:inventory` |
| `validate` | `npm run test && npm run site:catalog:check && npm run search:index:check && npm run r2:inventory:check:branch && npm run audit` |
| `validate:landing` | `npm run test && npm run site:catalog:check && npm run search:index:check && npm run r2:inventory:check && npm run audit` |

## Workflows

- **build-sha-index.yml** (workflow_dispatch, push)
  - `|`
  - `|`
  - `|`
- **remnant-phase-1-tests.yml** (pull_request)
  - `|`
  - `node --test tests/remnant-legacy-guardrails.test.js`
  - `|`
  - `|`
  - `|`
  - `node --test tests/pwa-resilience.test.js`
  - `|`
- **remnant-phase-2-equinox-tests.yml** (push, pull_request)
  - `|`
  - `node --test tests/equinox-passage.test.js`
  - `|`
- **remnant-phase-3-alignment-sphere-tests.yml** (push, pull_request)
  - `|`
  - `node --test tests/alignment-ledger.test.js`
  - `node --test tests/living-time-sphere.test.js`
  - `|`
  - `|`
  - `node --test tests/equinox-passage.test.js`
  - `node --test tests/pwa-resilience.test.js`
  - `|`
  - `|`
- **validate-codex-data.yml** (push, pull_request, workflow_dispatch)
  - `node scripts/validate-codex-data.js`

## Scripts and the generated paths they reference

| Script | Referenced output paths (first 8) |
| --- | --- |
| `scripts/apply-heaven-sound.mjs` | `docs/living-time-sphere.html`, `docs/404.html`, `docs/offline.html`, `docs/caravan.html` |
| `scripts/apply-living-nav.mjs` | `docs/living-time-sphere.html`, `docs/404.html`, `docs/offline.html`, `docs/caravan.html` |
| `scripts/apply-spark-presence.mjs` | `docs/living-time-sphere.html`, `docs/404.html`, `docs/offline.html`, `docs/caravan.html`, `docs/companions.html` |
| `scripts/apply-theory-work.mjs` | `docs/theory.html` |
| `scripts/audit-site.mjs` | — |
| `scripts/build-r2-inventory.mjs` | `site-audit/r2/document-extracts.json`, `docs/scroll/archive/Full_Scroll_Unsealed.txt`, `docs/development/TEMPORAL-AUTHORITY-CONTRACT.md`, `site-audit/r2/CODEX_R2_RESOURCE_REGISTRY.json` |
| `scripts/build-scroll-editorial.mjs` | `docs/scroll/data/editorial-edition.json`, `docs/scroll/evidence/claim-register.json`, `docs/scroll/evidence/register.md` |
| `scripts/build-scroll-library.mjs` | `archive/Full_Scroll_Unsealed.txt`, `archive/edition.json` |
| `scripts/build-scroll-search.mjs` | — |
| `scripts/build-search-index.mjs` | `docs/data/site-catalog.json`, `docs/scroll/data/library.json`, `docs/scroll/data/reader-segments.json`, `docs/scroll/search/lexicon/lexicon-index.json`, `docs/scroll/evidence/claim-register.json` |
| `scripts/build-site-catalog.mjs` | `site-audit/pr5a-body.md`, `docs/downloads.html`, `docs/data/site-catalog.json` |
| `scripts/build-world-lands.mjs` | `docs/data/site-catalog.json` |
| `scripts/free_all_circuits.py` | — |
| `scripts/generate-equinox-passage-data.mjs` | `docs/data/equinox-passage/equinox-source-metadata.json`, `docs/data/equinox-passage/equinox-reference-2014-2027.json`, `docs/data/equinox-passage/equinox-passage-2014-2027.json` |
| `scripts/generate-pattern-calendar-vectors.mjs` | — |
| `scripts/r2-extract-documents.py` | `site-audit/r2/document-extracts.json` |
| `scripts/r2_02_acquire_sources.py` | — |
| `scripts/r2_02_build.py` | `docs/scripture/data/lemma-index.json`, `docs/scripture/data/context.json`, `docs/scripture/data/manifest.json` |
| `scripts/r2_02_lib.py` | — |
| `scripts/r2_02_pages.py` | `docs/scripture/index.html`, `docs/scripture/about.html`, `docs/scripture/lemma.html` |
| `scripts/r2_02_reports.py` | — |
| `scripts/r2_02_verify.py` | `docs/scripture/data/manifest.json`, `docs/scroll/archive/Full_Scroll_Unsealed.txt`, `site-audit/r2-02/original-to-derived-comparison.json` |
| `scripts/scroll-source-audit.mjs` | — |
| `scripts/scroll_signal.py` | — |
| `scripts/validate-codex-data.js` | `docs/assets/data/codex-updates.json`, `docs/assets/data/moons.json`, `docs/assets/data/field-notes.json`, `docs/assets/data/artifacts.json` |

## Most widely shared runtime assets across deployed pages

| Stylesheet | Pages |
| --- | --- |
| `docs/assets/css/spark-companion.css` | 177 |
| `docs/assets/css/living-ui.css` | 136 |
| `docs/scripture/assets/scripture.css` | 93 |
| `docs/assets/css/spark-agent-seat.css` | 74 |
| `docs/assets/css/codex.css` | 51 |
| `docs/assets/css/navigation.css` | 41 |
| `docs/assets/css/social-bridge.css` | 37 |
| `docs/assets/css/living-moon-theme.css` | 31 |
| `docs/assets/css/animations.css` | 23 |
| `docs/assets/css/story-layer.css` | 19 |
| `docs/theory/equations/assets/css/codex.css` | 19 |
| `docs/theory/equations/assets/css/navigation.css` | 19 |

| Script | Pages |
| --- | --- |
| `docs/assets/js/spark-companion.js` | 177 |
| `docs/assets/js/spark-presence.js` | 176 |
| `docs/assets/js/site.js` | 140 |
| `docs/assets/js/living-ui.js` | 136 |
| `docs/scripture/assets/scripture.js` | 93 |
| `docs/assets/js/heaven-sound.js` | 76 |
| `docs/assets/js/spark-agent-seat.js` | 74 |
| `docs/assets/js/spark-3d.js` | 72 |
| `docs/assets/js/calendar/pattern-calendar-version.js` | 42 |
| `docs/assets/js/calendar/pattern-calendar-data.js` | 42 |
| `docs/assets/js/calendar/pattern-calendar-format.js` | 42 |
| `docs/assets/js/calendar/pattern-calendar-boundary.js` | 42 |

## Protected systems (do not modify)

- Frozen archive and hash manifests: `archive/`, `Full_Scroll_Unsealed`, `7_Ledger_and_Documentation/`.
- Scroll Library generated data: `docs/scroll/data/`, `docs/scroll/search/`, `docs/scroll/evidence/`.
- `docs/service-worker.js` and the Living Time Sphere calendar, temporal cursor and renderer (R1.7), documented in `docs/development/TEMPORAL-AUTHORITY-CONTRACT.md`.

## Deployment

- Netlify: `publish = "docs"`, no build step, so every generated artifact must be committed.
- GitHub Pages mirror/redirect status: **undetermined**; to be decided and documented in the deployment audit (R2-08). Pages use a `<base href>` switch for `ssnfts24.github.io/scroll-of-fire/`.

## Reproducible generation order

Stage any intentional new files before generation. Feature branches never regenerate the seals: they run `npm run validate`, whose branch seal check reports staleness as pending re-seal. Seals regenerate exactly once at landing, on main:

```sh
npm run site:seal        # catalog -> search index -> document extract -> R2 inventory
# commit the regenerated site-audit/r2/ files as the landing seal commit
npm run validate:landing # strict: committed seals must byte-match the landed tree
```

The two `--check` commands are read-only. Catalog scanning uses an OS temporary directory, and both inventories use only index-listed paths. Run checks after the full test suite: the Scroll reader reproducibility test rebuilds tracked `docs/scroll/` outputs, which the R2 registry hashes.
