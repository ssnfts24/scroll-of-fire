# R2-02 completion report (draft checkpoint)

Status: **draft pending review**. Nothing here is labelled verified or linguistically reviewed.

## Coverage (generated)

| Item | Count |
|---|---|
| Chapters | 90 (Genesis 50, Exodus 40) |
| Verses (WLC numbering) | 2746 |
| Hebrew word tokens | 37325 |
| Word parts (prefix/stem/suffix segments) | 57818 |
| Parts with lemma id | 36562 |
| Parts whose lemma has BDB senses in the dataset | 36562 |
| Distinct lemmas in edition | 2460 |
| Lemmas with BDB senses | 2460 |
| Sense records | 7251 |
| Ketiv/qere words | 28 |
| Versification-difference verses | 96 |

## Three completeness levels

1. **Original word and morphology**: imported; machine-compared to the pinned OSHB source in validation, without claiming independent scholarly collation.
2. **Lexical senses**: imported-from-dataset; 0 lemmas have no BDB senses in the dataset and show an unavailable state.
3. **Reviewed contextual interpretation**: 0 reviewed; 54 draft selections.

## Original manuscripts vs derived edition

53 of 90 chapters have a structural lead (missing/duplicate/unexpected verse markers or an unterminated final line). See `original-to-derived-comparison.json`. The original files are unchanged; the WLC text and the author's text are kept in separate layers.

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
