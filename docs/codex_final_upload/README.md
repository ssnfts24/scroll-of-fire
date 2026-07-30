# Codex Final Upload

This folder temporarily holds the complete final Codex of Reality site payload for the `scroll-of-fire` repository.

It contains six independent ZIP archives:

- `CODEX-FINAL-UPLOAD-PART-01-OF-06.zip`
- `CODEX-FINAL-UPLOAD-PART-02-OF-06.zip`
- `CODEX-FINAL-UPLOAD-PART-03-OF-06.zip`
- `CODEX-FINAL-UPLOAD-PART-04-OF-06.zip`
- `CODEX-FINAL-UPLOAD-PART-05-OF-06.zip`
- `CODEX-FINAL-UPLOAD-PART-06-OF-06.zip`

Each archive contains part of the same `payload/` structure.

Together they include:

- The complete upgraded `docs/` website
- The full 13 Moons Remnant Living Time Observatory
- The Living Time Sphere and all renderers
- Deep-time seasonal and equinox calculations
- Observatory Mission Control
- Natural participation
- Guided questions and recurring quests
- Witness records, recurrence analysis, and archives
- Homepage Sphere integration
- PWA and service-worker updates
- Netlify configuration
- Repository tests
- Final audit and build documentation

## Copilot Instructions

Copilot should work only on the current branch.

1. Create a clean temporary extraction folder outside `docs/`.
2. Extract all six ZIP files into the same temporary folder.
3. Allow their shared `payload/` directories to merge.
4. Replace the repository `docs/` directory with `payload/docs/`.
5. Use `rsync --delete` or an equivalent method so outdated files are removed.
6. Replace the root `tests/` directory with `payload/tests/`.
7. Copy `payload/netlify.toml` to the repository root.
8. Copy `payload/FINAL-BUILD-README.txt` to the repository root.
9. Delete this temporary `docs/codex_final_upload/` folder after extraction succeeds.
10. Run:

```bash
node --test tests/*.test.js
