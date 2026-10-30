# Full Scroll Unsealed archival edition

`1.0.0/Full_Scroll_Unsealed` is the byte-for-byte archival copy of the root manuscript as it existed at the commit recorded in `1.0.0/edition.json`. The root `Full_Scroll_Unsealed` remains in place. The archive is immutable; `scroll:freeze` refuses to replace an existing edition.

## Provenance artifacts

- `1.0.0/edition.json` records the source commit, source path, byte length, line count, encoding, and SHA-256.
- `1.0.0/paragraph-map.json` maps every nonempty paragraph to its one-based original line range and includes the paragraph text and a stable, commit-pinned source link. IDs use the first source line, such as `paragraph-line-000001`.
- `1.0.0/content-audit.json` inventories detected sections, both Part I–XVIII sequences, appendices, Genesis chapter headings, Hebrew forms, repeated boilerplate, and duplicate or missing-item diagnostics.

Heading recognition is deliberately heuristic. The audit's claim candidates are all non-heading paragraphs, not a judgment that every paragraph is a factual claim. They are marked as inventory-only: factual source verification and editorial decisions belong to later project stages. Repeated and duplicate source passages remain intact and visible in the archive and diagnostics.

Regenerate the derived inventories with `npm run scroll:audit`. Create an archival edition only once with `npm run scroll:freeze`; it exits rather than overwriting an existing version. `npm run validate` includes checks for byte-for-byte preservation, complete paragraph-line mapping, stable provenance links, chapter inventory, and reproducible audit artifacts.
