"""Report generators for R2-02. Pure functions: inputs -> {relpath: json-object | markdown-text}."""
import json

D = "site-audit/r2-02/"


def make_reports(manifest, comparison, cov, uncert, originals, curated, lemma_records):
    out = {}
    verse_rows = sorted(cov.values(), key=lambda r: (r["hebrewId"].split(".")[0] != "Gen", int(r["hebrewId"].split(".")[1]), int(r["hebrewId"].split(".")[2])))
    out[D + "verse-coverage-manifest.json"] = {
        "edition": manifest["edition"], "totals": manifest["totals"],
        "chaptersExpected": {"Gen": 50, "Exod": 40}, "versesExpected": {"Gen": 1533, "Exod": 1213},
        "rule": "Every verse of the pinned WLC for Gen 1-50 and Exod 1-40 is listed; 'englishId' differs from 'hebrewId' only where OSHB VerseMap.xml records a versification difference (these are NOT missing verses).",
        "verses": verse_rows}

    bad = [c for c in comparison if c["status"] != "complete-marker-sequence"]
    out[D + "original-to-derived-comparison.json"] = {
        "originals": {k: {"file": v["file"], "sha256": v["sha256"], "bytes": v["bytes"], "lines": v["lines"], "verseMarkers": len(v["blocks"])} for k, v in originals.items()},
        "method": "Verse markers in the preserved manuscripts are compared with the WLC verse list of each chapter (best fit of Hebrew vs English numbering). Results are structural leads, not a judgement on the author's text.",
        "summary": {"chapters": len(comparison), "chaptersNeedingRepairLead": len(bad), "chaptersWithCompleteMarkerSequence": len(comparison) - len(bad)},
        "chapters": comparison}

    kinds = {}
    for u in uncert:
        kinds[u["kind"]] = kinds.get(u["kind"], 0) + 1
    out[D + "textual-uncertainty-register.json"] = {
        "summary": kinds,
        "witnessesNotLoaded": [
            {"witness": "Masoretic Text other than WLC", "state": "not loaded", "effect": "Aleppo/other MT comparisons not made."},
            {"witness": "Septuagint (LXX)", "state": "not loaded", "effect": "No LXX alignment is asserted; tradition notes citing LXX are marked needs-source-check."},
            {"witness": "Dead Sea Scrolls", "state": "not loaded", "effect": "No DSS variant is claimed."},
            {"witness": "Samaritan Pentateuch", "state": "not loaded", "effect": "No Samaritan variant is claimed."}],
        "items": uncert}

    t = manifest["totals"]
    c = manifest["completeness"]
    sel = curated["selections"]
    out[D + "COMPLETION_REPORT.md"] = f"""# R2-02 completion report (draft checkpoint)

Status: **draft pending review**. Nothing here is labelled verified or linguistically reviewed.

## Coverage (generated)

| Item | Count |
|---|---|
| Chapters | {t['chapters']} (Genesis 50, Exodus 40) |
| Verses (WLC numbering) | {t['verses']} |
| Hebrew word tokens | {t['wordTokens']} |
| Word parts (prefix/stem/suffix segments) | {t['wordParts']} |
| Parts with lemma id | {t['wordPartsWithLemma']} |
| Parts whose lemma has BDB senses in the dataset | {t['wordPartsWithBdbSenses']} |
| Distinct lemmas in edition | {t['distinctLemmasInEdition']} |
| Lemmas with BDB senses | {t['lemmasWithBdbSenses']} |
| Sense records | {t['senseRecords']} |
| Ketiv/qere words | {t['ketivQere']} |
| Versification-difference verses | {t['versificationDifferences']} |

## Three completeness levels

1. **Original word and morphology**: {c['level1_originalWordAndMorphology']['status']}; machine-compared to the pinned OSHB source in validation, without claiming independent scholarly collation.
2. **Lexical senses**: {c['level2_lexicalSenses']['status']}; {len(c['level2_lexicalSenses']['lemmasWithoutSenses'])} lemmas have no BDB senses in the dataset and show an unavailable state.
3. **Reviewed contextual interpretation**: 0 reviewed; {len(sel)} draft selections.

## Original manuscripts vs derived edition

{len(bad)} of {len(comparison)} chapters have a structural lead (missing/duplicate/unexpected verse markers or an unterminated final line). See `original-to-derived-comparison.json`. The original files are unchanged; the WLC text and the author's text are kept in separate layers.

## Browser evidence

The static reader was exercised at three viewport widths. The Genesis 1:2 רוּחַ study panel displayed nine BDB sense records, with no horizontal overflow at mobile width:

- Desktop reader (1440 px): `screenshots/desktop-1440-scripture.png`
- Desktop multi-sense panel (1440 px): `screenshots/desktop-1440-genesis1-ruach-panel.png`
- Tablet multi-sense panel (768 px): `screenshots/tablet-768-genesis1-ruach-panel.png`
- Mobile multi-sense panel (390 px): `screenshots/mobile-390-genesis1-ruach-panel.png`

## Not done / needs a human decision

- Contextual selections and tradition summaries need scholarly review.
- LXX, DSS, Samaritan and other MT witnesses are not loaded.
- WEB text was taken from a wrapper repository because eBible.org was unreachable; confirm against eBible.org before publication.
- Transliteration is mechanical and approximate.
"""

    out[D + "LICENSING_AND_ATTRIBUTION.md"] = """# Licensing and attribution (R2-02)

| Material | Source | Licence | Required attribution |
|---|---|---|---|
| WLC Hebrew text | Open Scriptures Hebrew Bible (morphhb), commit `3d15126fb1ef74867fc1434be1942e837932691f` (2024-08-27) | Public domain text | Credit WLC / OSHB; [pinned source](https://github.com/openscriptures/morphhb/tree/3d15126fb1ef74867fc1434be1942e837932691f) |
| Lemma and morphology layer | OSHB, same pinned commit; code legend at [`HebrewMorphologyCodes.html`](https://github.com/openscriptures/morphhb/blob/3d15126fb1ef74867fc1434be1942e837932691f/parsing/HebrewMorphologyCodes.html) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | "Original work of the Open Scriptures Hebrew Bible available at https://github.com/openscriptures/morphhb" |
| Lexicon mapping (LexicalIndex, AugIndex) and BDB digitisation | openscriptures/HebrewLexicon, commit `21c9add13bc727d3a951361778e97e3ff7afd1ce` (2019-09-02) | CC BY 4.0 layer over public-domain BDB (1906) | [Pinned source](https://github.com/openscriptures/HebrewLexicon/tree/21c9add13bc727d3a951361778e97e3ff7afd1ce); BDB citation and record ID shown per lemma |
| Strong's Hebrew | HebrewLexicon | Public domain text | Credit |
| English translation | World English Bible, public domain; wrapper commit `68669ba3be9719ae4d1135b19d9e0b6587b7c356` (2025-11-24), included source notice dated 2017-06-14 | Public domain per included notice | [Pinned wrapper](https://github.com/TehShrike/world-english-bible/tree/68669ba3be9719ae4d1135b19d9e0b6587b7c356); "World English Bible" is an eBible.org trademark; publisher-edition fidelity not independently verified |
| Scroll commentary | Repository originals | Repository's own terms | Not relicensed |

Pinned commits, URLs and SHA-256 checksums: `sources/r2-02/SOURCES.json`. The repository's noncommercial licence is not applied to third-party material above.
"""

    out[D + "SOURCE_ACQUISITION.md"] = """# Source acquisition and verification

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
"""
    return out
