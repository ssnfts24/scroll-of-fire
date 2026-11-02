# CODEX R2 — Known Defects (as of R2-01)

Evidence-based list. "Observed" means measured in this repository; unresolved items are marked as such.

## Scripture (preliminary scan — not a verse audit)

Chapter headings found: Genesis 51/50, Exodus 40/40. Chapters with a gap in observed verse markers, a repeated marker, or a last prose line without terminal punctuation are listed below. These are leads: the verse-level audit against a named edition is R2-02.

| Chapter | Markers | Highest | Missing in-range markers | Repeated markers | Last prose ends cleanly |
| --- | --- | --- | --- | --- | --- |
| `Genesis 23` | 20 | 20 | — | — | **no** |
| `Genesis 24` | 33 | 33 (heading ×2) | — | — | yes |
| `Genesis 24` | 15 | 48 (heading ×2) | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33 | — | yes |
| `Genesis 39` | 19 | 23 | 7, 8, 9, 10 | — | yes |
| `Genesis 41` | 37 | 52 | 33, 34, 35, 36, 37, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50 | — | yes |
| `Genesis 50` | 26 | 26 | — | — | **no** |
| `Exodus 2` | 30 | 25 | — | 5 | yes |
| `Exodus 7` | 9 | 9 | — | — | **no** |

Genesis distinct chapters: 50/50 (51 headings). Exodus distinct chapters: 40/40 (40 headings).

### Chapters named in the project directive, as observed

| Chapter | Markers | Highest marker | Last prose ends cleanly |
| --- | --- | --- | --- |
| `Exodus 7` | 9 | 9 | **no** |
| `Exodus 8` | 6 | 6 | yes |
| `Exodus 32` | 14 | 14 | yes |

Whether these stop short of the full chapter is confirmed only in R2-02 against a named edition. Exodus 7 visibly ends mid-sentence. Exodus headings without an English heading line: 6.

Full per-chapter data: `scripture-preliminary-scan.json`.

## Publication

- 71 deployed files need a publish/withdraw decision (see Publication Review).
- Deployed bundle archives under `docs/codex_final_upload/` have not had their contents inspected.
- Root images with upload-style names have not been visually reviewed.

## Integrity

- `7_Ledger_and_Documentation/SHA256_Placeholders_2025.md` contains placeholder values; they must never be labelled cryptographically verified.
- The historical integrity ledger has not yet been recomputed in this release.

## Documents

- 1 document(s) have no text layer and need visual review.
- 8 ZIP archives were listed but not unpacked into review.
- No manuscript outside the Scroll Library has had a completed editorial, scripture or evidence review.

## Deployment

- GitHub Pages versus Netlify role is undecided and undocumented.
- External source links cannot be live-checked from the development environment; all external inspection is **pending**.

## Navigation / experience (carried from PR 5A report)

- Fixed in R2-01: the Atlas filter form (`hidden` attribute) was displayed with JavaScript off because author CSS overrode `hidden`, leaving inert controls. Now `.atlas-filters[hidden]` is hidden and the full card list remains readable (screenshot: `screenshots/atlas-no-javascript-390.png`).
- Some nav labels differ from page titles; some pages are not directly linked from the homepage; `404`, `offline` and the caravan redirect are intentionally unreachable from navigation.
