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
- `/scroll/archive/Full_Scroll_Unsealed.txt` — exact preserved original in plain text.
- `/scroll/archive/edition.json` — frozen edition metadata.
- `/scroll/CONTENT-COVERAGE.md` — this coverage and limitations report.

## Limitations

This phase does not implement full-text search, evidence review, timeline, lexicon, or a claim graph; those are reserved for later phases. Heading recognition and shelf classification remain heuristic, although recognized headings now establish line-accurate reader boundaries. Markdown-like source punctuation is displayed as preserved text rather than editorially rewritten. Genesis translations, verse boundaries, manuscript comparisons, and Hebrew morphology have not been independently reviewed.
