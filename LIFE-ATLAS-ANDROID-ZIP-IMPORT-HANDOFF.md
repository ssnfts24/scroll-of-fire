# Life Atlas Android + ZIP Import Hotfix — 2026-08-17

## Purpose
Remove Android file-picker MIME/extension gating and make the Life Atlas importer accept user-selected export files first, then identify their format locally.

## Changes
- Removed restrictive `accept=` filtering from the Life Atlas file input.
- Added content sniffing for extensionless/oddly named ICS, JSON/JS, and CSV files.
- Added a browser-side ZIP central-directory reader that uses Blob slices rather than loading a large ZIP into memory at once.
- ZIP imports inspect candidate text/data entries and inflate only supported entries.
- Added mobile safety limits: max 12,000 ZIP entries, 24 MB per text entry, 96 MB total inflated text per selected ZIP pass.
- Added staged sample preview, ZIP diagnostics, drag/drop support, and clearer Select → Analyze → Review → Import flow.
- Imported records remain private and unreviewed until explicit commit.

## Expected Android test
1. Open Living Time Sphere.
2. Go to Build My Life Atlas.
3. Tap `Choose exports or ZIP archives`.
4. The Android picker should allow the previously greyed-out file to be selected.
5. If its content is ICS/JSON/CSV, Codex should identify it even if Android gave it an unusual filename/MIME type.
6. Nothing is written until `Import as Private Records` is pressed.

## Limits
- ZIP64 is intentionally rejected for now.
- Encrypted ZIP entries are not supported.
- Only stored (method 0) and deflate (method 8) ZIP entries are supported.
- Very large individual JSON files should eventually move to a streaming parser.
- Media binaries are not imported yet; this phase indexes text/data history only.

## Validation
`npm run validate`

- 771 tests passed
- 0 failed
- 69 HTML pages audited
- 36 stylesheets audited
- 4,118 local references checked
- Site audit PASS
