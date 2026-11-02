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
| `r2:inventory` | `node scripts/build-r2-inventory.mjs` |
| `r2:inventory:check` | `node scripts/build-r2-inventory.mjs --check` |
| `validate` | `npm run test && npm run audit` |

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
  - `node --test tests/*.test.js`
- **remnant-phase-2-equinox-tests.yml** (push, pull_request)
  - `|`
  - `node --test tests/equinox-passage.test.js`
  - `node --test tests/*.test.js`
- **remnant-phase-3-alignment-sphere-tests.yml** (push, pull_request)
  - `|`
  - `node --test tests/alignment-ledger.test.js`
  - `node --test tests/living-time-sphere.test.js`
  - `node --test tests/*.test.js`
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
| `scripts/audit-site.mjs` | — |
| `scripts/build-r2-inventory.mjs` | `site-audit/r2/document-extracts.json`, `docs/scroll/archive/Full_Scroll_Unsealed.txt`, `docs/development/TEMPORAL-AUTHORITY-CONTRACT.md` |
| `scripts/build-scroll-editorial.mjs` | `docs/scroll/data/editorial-edition.json`, `docs/scroll/evidence/claim-register.json`, `docs/scroll/evidence/register.md` |
| `scripts/build-scroll-library.mjs` | `archive/Full_Scroll_Unsealed.txt`, `archive/edition.json` |
| `scripts/build-scroll-search.mjs` | — |
| `scripts/build-site-catalog.mjs` | `site-audit/pr5a-body.md`, `docs/downloads.html`, `docs/data/site-catalog.json` |
| `scripts/free_all_circuits.py` | — |
| `scripts/generate-equinox-passage-data.mjs` | `docs/data/equinox-passage/equinox-source-metadata.json`, `docs/data/equinox-passage/equinox-reference-2014-2026.json`, `docs/data/equinox-passage/equinox-passage-2014-2026.json` |
| `scripts/r2-extract-documents.py` | `site-audit/r2/document-extracts.json` |
| `scripts/scroll-source-audit.mjs` | — |
| `scripts/scroll_signal.py` | — |
| `scripts/validate-codex-data.js` | `docs/assets/data/codex-updates.json`, `docs/assets/data/moons.json`, `docs/assets/data/field-notes.json`, `docs/assets/data/artifacts.json` |

## Most widely shared runtime assets across deployed pages

| Stylesheet | Pages |
| --- | --- |
| `docs/assets/css/codex.css` | 35 |
| `docs/assets/css/navigation.css` | 29 |
| `docs/theory/equations/assets/css/codex.css` | 19 |
| `docs/theory/equations/assets/css/navigation.css` | 19 |
| `docs/theory/equations/assets/css/theory.css` | 19 |
| `docs/assets/css/animations.css` | 18 |
| `docs/theory/assets/css/codex.css` | 15 |
| `docs/theory/assets/css/navigation.css` | 15 |
| `docs/theory/assets/css/theory.css` | 15 |
| `docs/scroll/assets/library.css` | 6 |
| `docs/systems/assets/css/codex.css` | 6 |
| `docs/systems/assets/css/navigation.css` | 6 |

| Script | Pages |
| --- | --- |
| `docs/assets/js/site.js` | 35 |
| `docs/theory/equations/https:/cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js` | 19 |
| `docs/theory/equations/assets/js/site.js` | 19 |
| `docs/theory/equations/assets/js/theory.js` | 19 |
| `docs/assets/js/living-codex.js` | 18 |
| `docs/assets/js/calendar-cor.js` | 16 |
| `docs/theory/https:/cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js` | 15 |
| `docs/theory/assets/js/site.js` | 15 |
| `docs/theory/assets/js/theory.js` | 15 |
| `docs/assets/js/codex-witness.js` | 8 |
| `docs/assets/js/share/remnant-share-url.js` | 6 |
| `docs/assets/js/share/remnant-share.js` | 6 |

## Protected systems (do not modify)

- Frozen archive and hash manifests: `archive/`, `Full_Scroll_Unsealed`, `7_Ledger_and_Documentation/`.
- Scroll Library generated data: `docs/scroll/data/`, `docs/scroll/search/`, `docs/scroll/evidence/`.
- `docs/service-worker.js` and the Living Time Sphere calendar, temporal cursor and renderer (R1.7), documented in `docs/development/TEMPORAL-AUTHORITY-CONTRACT.md`.

## Deployment

- Netlify: `publish = "docs"`, no build step, so every generated artifact must be committed.
- GitHub Pages mirror/redirect status: **undetermined**; to be decided and documented in the deployment audit (R2-08). Pages use a `<base href>` switch for `ssnfts24.github.io/scroll-of-fire/`.
