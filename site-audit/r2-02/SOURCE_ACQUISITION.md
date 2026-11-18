# Source acquisition and verification

```
python3 scripts/r2_02_acquire_sources.py --verify   # offline, checks committed copies against pinned SHA-256
python3 scripts/r2_02_acquire_sources.py            # downloads from the pinned commits and verifies
python3 scripts/r2_02_build.py --occurrences        # rebuilds the all-39-books index from the verified acquisition cache
python3 scripts/r2_02_build.py                      # regenerates docs/scripture, data and site-audit/r2-02
python3 scripts/r2_02_verify.py                     # compares generated verses, morphology and BDB senses to sources
python3 scripts/r2_02_build.py --check              # fails if any generated file is stale
git add <the intentional generated and source paths>
npm run site:catalog
npm run r2:inventory
npm run validate
```

The Hebrew is never Unicode-normalised. The build needs Python 3 standard library only. The occurrence index is pinned by digest and will not be overwritten by a non-matching rebuild. Run the catalog before R2 inventory; both generators read staged paths, so stage only the intended files.
