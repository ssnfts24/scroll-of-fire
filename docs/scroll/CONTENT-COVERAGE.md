# Scroll of Fire Library — Phase 2 coverage

The reader is generated from the immutable `Full_Scroll_Unsealed` 1.0.0 archival edition. The PR 1 paragraph map and audit remain unchanged. A separate line-based segment map now partitions the frozen source at every detected heading, including headings embedded inside archival paragraphs; Genesis chapter views collect their own section and nested-subsection segments up to the next chapter boundary.

| Inventory | Reader coverage |
| --- | ---: |
| Original source | 610,424 bytes · 11,295 lines |
| Paragraphs mapped and published | 742 / 742 |
| Detected section entries | 816 source headings, plus opening matter |
| Line-based reader segments | 1,609 · every source line's text represented once and in source order |
| Source lines with text | 9,936 / 9,936 represented verbatim |
| Sections with direct body text | 752 |
| True empty structural headings | 46, linked into their surrounding reading context |
| Chapter-context headings | 19, retained as Genesis chapter context |
| Maximum rendered segment | 3,999 characters |
| Genesis chapters | 50 / 50 open their own bounded chapter content, including nested headings |
| Duplicate headings | Every mapped occurrence remains separately accessible and links to its original line |
| Hebrew terms | Original Hebrew material remains in the source paragraphs; right-to-left direction is automatic |

The eight homepage shelves are navigational groupings based on existing headings and title keywords. They do not change source order, assert that a passage is historically accurate, or represent editorial fact-checking. The complete source-section index remains available below the shelves.

## Reader boundary correction

The original paragraph map deliberately groups consecutive nonblank lines. Its section assignment is the section active at the paragraph's first line, so a paragraph that crosses later headings cannot be used as the reader's content boundary. The reader now uses `data/reader-segments.json`, derived directly from original source lines and the existing stable section IDs. Each segment records its exact original line range, owning section, intersecting paragraph IDs, and a commit-pinned source link; long lines and blocks are split only at display time without changing source text.

Genesis pages include all line-owned subsections from their chapter heading through the line before the next Genesis chapter occurrence. Repeated Genesis 24 headings remain part of that chapter. Structural headings with no direct body text remain in the source mapping and link to a contextual reader page rather than an empty page. The archive, edition metadata, PR 1 paragraph map, and content audit are unchanged.

## Routes

- `/scroll/` — library home, eight shelves, Genesis 1–50, future-stage entry points, complete section index, and archival source access.
- `/scroll/reader.html?section=section-line-NNNNNN` — section reader with table of contents, provenance links, duplicate-occurrence links, and adjacent-section navigation.
- `/scroll/data/reader-segments.json` — generated line-range, ownership, paragraph-reference, and provenance mapping used by the reader.
- `/scroll/search.html` — local full-text search (`?q=&shelf=&page=`).
- `/scroll/lexicon.html` — Hebrew lexicon (`?term=`, `?q=`, `?letter=`, `?page=`).
- `/scroll/atlas.html` — connected reference atlas (`?ref=`, `?entity=`, `#scriptures|#entities|#repeated|#years`).
- `/scroll/archive/Full_Scroll_Unsealed.txt` — exact preserved original in plain text.
- `/scroll/archive/edition.json` — frozen edition metadata.
- `/scroll/CONTENT-COVERAGE.md` — this coverage and limitations report.

## Phase 3: search, Hebrew lexicon, and reference atlas

Search is a custom offline sharded index (`scripts/build-scroll-search.mjs`) rather than Pagefind: the reader is JavaScript-rendered, and a custom index lets Hebrew, shelf filters and exact segment links be controlled. No remote service, AI API or CDN is used. The index is committed under `docs/scroll/search/`, so Netlify serves it from `docs/` with no build command.

| Measure | Value |
|---|---|
| Indexed segments / sections | 1,609 / 817 |
| Unique / total tokens | 9,291 / 92,231 |
| Artifacts | 802 files, about 2.58 MB raw, about 704 KB gzipped |
| Index shards | 723, keyed by the first two characters of a token, loaded only when a query needs them |
| Segment text | 41 chunks of 40 segments, fetched only for displayed results |
| Lexicon | 911 forms (645 with author notes), 22 detail buckets |
| Atlas | 196 scripture references, 46 entities, 232 repeated heading groups, 214 repeated text groups |

Opening a chapter downloads none of the index. A first search downloads `sections.json` (138 KB) plus the shards for the query words and the text chunks of the visible results.

**Normalization** (`assets/search-normalize.js`, shared by browser and build): Unicode NFKD, removal of combining marks (niqqud and cantillation), Hebrew final-letter folding, maqaf and punctuation as word separators, apostrophes dropped, lower-casing. Hebrew queries also match the common prefix particles (ה ו ב כ ל מ ש). Normalization is used for matching only; displayed text is the original.

**Transliteration variants** are a search aid (tz/ts, ch/kh/h, ph/f, th/t, sh/s, q/c/k, w/v, vowels ignored). They only reach entries where the author wrote a transliteration; other entries are found by Hebrew letters.

**Lexicon rules**: each entry separates literal spelling, transliteration, grammatical root, lexical definition and the author's interpretation. A root or gloss appears only if the manuscript states it. No dictionary definition, morphology or manuscript reading has been added, and the 158 repeated boilerplate root notes are not attached.

**Atlas relationships**: direct citation, shared subject, lexical connection, repeated passage, author interpretation. A shared subject is a navigation aid, not evidence of a historical or causal link. The entity list is an editorial gazetteer limited to names found in the text and deliberately excludes political figures (reserved for the later editorial phase).

**Reproducibility**: `npm run scroll:search` regenerates the artifacts deterministically from the frozen source; `npm run scroll:search:check` fails if the committed files differ byte-for-byte. A test runs the check and verifies the manifest hashes.

## Limitations

Evidence review, the political editorial rewrite and the historical timeline are reserved for later phases. Search results are keyword-ranked, not semantic; there is no stemming, so inflected English forms must be typed or prefix-matched (three or more letters). The service worker does not precache the search index, so offline search works only for files already in the HTTP cache; a failed fetch shows a retry message. Scripture references and entities are matched by name, so a few may be missed or over-matched. Lexicon transliteration search covers only author-supplied transliterations. Heading recognition and shelf classification remain heuristic, although recognized headings now establish line-accurate reader boundaries. Markdown-like source punctuation is displayed as preserved text rather than editorially rewritten. Genesis translations, verse boundaries, manuscript comparisons, and Hebrew morphology have not been independently reviewed.
