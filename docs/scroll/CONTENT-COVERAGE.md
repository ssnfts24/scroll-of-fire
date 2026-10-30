# Scroll of Fire Library — Phase 2 coverage

The static reader data is generated from the immutable `Full_Scroll_Unsealed` 1.0.0 paragraph map. It contains every source paragraph verbatim, its source line range, stable paragraph ID, reading-section ID, and commit-pinned original link. The published plain-text archival edition is byte-identical to the frozen source.

| Inventory | Reader coverage |
| --- | ---: |
| Original source | 610,424 bytes · 11,295 lines |
| Paragraphs mapped and published | 742 / 742 |
| Detected sections published | 816, plus an opening-matter route when needed |
| Genesis chapters | 50 / 50 accessible under Scripture |
| Duplicate headings | Every mapped occurrence remains separately accessible and links to its original line |
| Hebrew terms | Original Hebrew material remains in the source paragraphs; right-to-left direction is automatic |

The eight homepage shelves are navigational groupings based on existing headings and title keywords. They do not change source order, assert that a passage is historically accurate, or represent editorial fact-checking. The complete source-section index remains available below the shelves.

## Routes

- `/scroll/` — library home, eight shelves, Genesis 1–50, future-stage entry points, complete section index, and archival source access.
- `/scroll/reader.html?section=section-line-NNNNNN` — section reader with table of contents, provenance links, duplicate-occurrence links, and adjacent-section navigation.
- `/scroll/archive/Full_Scroll_Unsealed.txt` — exact preserved original in plain text.
- `/scroll/archive/edition.json` — frozen edition metadata.
- `/scroll/CONTENT-COVERAGE.md` — this coverage and limitations report.

## Limitations

This phase does not implement full-text search, evidence review, timeline, lexicon, or a claim graph; those are reserved for later phases. The section parser is heuristic, so some title groupings may be imperfect; the full paragraph map and source index retain coverage independently of categorization. Markdown-like source punctuation is displayed as preserved text rather than editorially rewritten. Genesis translations, verse boundaries, manuscript comparisons, and Hebrew morphology have not been independently reviewed.
