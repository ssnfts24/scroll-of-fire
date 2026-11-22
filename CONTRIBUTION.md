# Contributing

Thanks for helping improve the Scroll of Fire. Contributions are welcome for the public archive, website, accessibility, documentation, and validation.

## Find the right place

- The numbered `1_Codex_of_Reality/` through `7_Ledger_and_Documentation/` folders hold the source collections.
- `docs/` is the deployed static site. Keep site pages and their assets there; use its existing lowercase, hyphenated route and asset naming.
- `scripts/` contains generators and audits; `tests/` contains the Node.js regression suite.
- `docs/reports/` is for completed audit and validation reports; `docs/development/` is for active design notes and specifications.
- Preserve existing root-level handoffs and patch manifests unless a separately reviewed migration updates all references.

## Local checks

Node.js 20 or newer is required. From the repository root, run:

```sh
npm test
npm run validate
```

`npm run validate` includes the regression suite, generated catalog and search-index checks, the branch inventory check, and the static-site audit. Generated files should be changed through their existing scripts, then checked with the corresponding `--check` command where available. CI workflows in `.github/workflows/` run focused checks for the data and feature areas they cover.

## Contribution guidelines

- Follow the established filename style of the destination. For new source-collection documents, use **Title_Case_With_Underscores**; for website routes and assets, follow the existing lowercase, hyphenated names.
- Do not remove divine names.
- Keep personal data and secrets out of the repository.
- Add a clear commit message: `area: short verb – detail` (e.g., `codex: add convergence prologue`).
- Use the forms under `.github/ISSUE_TEMPLATE/` to report a bug or propose a feature.

By opening a PR you agree to the repo license (CC BY-NC 4.0).
