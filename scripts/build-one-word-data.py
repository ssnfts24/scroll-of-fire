#!/usr/bin/env python3
"""Build the One Word a Day dataset (docs/assets/data/one-word-words.json).

SOURCE — every field is copied from the R2-02 lexicon data already in
this repo; nothing is written from memory and nothing is invented:

  - docs/scripture/data/lemma-index.json — the index behind the
    lemma finder (docs/scripture/lemma.html): pointed Hebrew form,
    printed transliteration, Strong's number, index gloss.
  - docs/scripture/data/lemmas/*.json — the lemma shards behind the
    same finder: part of speech, the lexicon-assigned root, and the
    occurrence list (flat [book, chapter, verse] triples over the
    pinned WLC; book 0 = Genesis, book 1 = Exodus).
  - docs/scripture/data/chapters/{Gen,Exod}-NN.json — the chapter
    word tables: at the example verse, the word-part carrying this
    lemma gives the word's actual form there, its morphology code,
    and its parsed morphology in words.
  - docs/scripture/data/manifest.json — book names and verse counts,
    used to prove every example verse is real.

AN ENTRY IS INCLUDED ONLY WHEN ALL OF THESE HOLD:
  - the index form carries vowel points (pointing is never invented);
  - a printed transliteration and an index gloss are present;
  - the lemma is not a proper name (part of speech Np) — this is a
    vocabulary path, not a name list;
  - the lemma occurs at least once in Genesis or Exodus;
  - the first Genesis/Exodus occurrence resolves, in the chapter
    word table, to a word-part carrying this lemma (form + parsed
    morphology read from that part). If it does not resolve, the
    entry is excluded — an example is never guessed.

ROTATION RULE (the page's rule, stated here so it can be checked):
  entries are ordered by Strong's number (the source index's own
  order). Pattern Day d (1..364) takes entry (d - 1) mod N, where N
  is the entry count. The Day Out of Time takes no entry: the page
  offers review of the keeper's earned words that day instead.

Run:  python3 scripts/build-one-word-data.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "docs" / "scripture" / "data"
OUT = ROOT / "docs" / "assets" / "data" / "one-word-words.json"

NIKKUD = set("ְֱֲֳִֵֶַָֹֻּׁׂ")


def has_pointing(text):
    return any(ch in NIKKUD for ch in text or "")


def main():
    manifest = json.loads((DATA / "manifest.json").read_text(encoding="utf-8"))
    books = manifest["books"]  # [Genesis, Exodus] in edition order
    book_names = {0: books[0]["name"], 1: books[1]["name"]}
    book_osis = {0: books[0]["osis"], 1: books[1]["osis"]}
    verse_counts = {0: books[0]["verseCounts"], 1: books[1]["verseCounts"]}

    index = json.loads((DATA / "lemma-index.json").read_text(encoding="utf-8"))["lemmas"]

    shards = {}
    chapters = {}

    def shard(name):
        if name not in shards:
            shards[name] = json.loads((DATA / "lemmas" / f"{name}.json").read_text(encoding="utf-8"))["lemmas"]
        return shards[name]

    def chapter(book_idx, chapter_no):
        key = (book_idx, chapter_no)
        if key not in chapters:
            osis = book_osis[book_idx]
            path = DATA / "chapters" / f"{osis}-{chapter_no:02d}.json"
            chapters[key] = json.loads(path.read_text(encoding="utf-8"))
        return chapters[key]

    entries = []
    excluded = {"unpointed": 0, "proper-name": 0, "no-gen-exod-occurrence": 0, "example-unresolved": 0, "missing-fields": 0}

    for item in index:
        strongs = item.get("id")
        hebrew = item.get("h")
        xlit = item.get("x")
        gloss = item.get("g")
        if not (strongs and hebrew and xlit and gloss):
            excluded["missing-fields"] += 1
            continue
        if not has_pointing(hebrew):
            excluded["unpointed"] += 1
            continue
        detail = shard(item["sh"]).get(strongs)
        if detail is None:
            excluded["missing-fields"] += 1
            continue
        if detail.get("pos") == "Np":
            excluded["proper-name"] += 1
            continue

        flat = (detail.get("occurrences") or {}).get("flat") or []
        triples = [flat[i:i + 3] for i in range(0, len(flat) - 2, 3)]
        in_edition = [t for t in triples if t[0] in (0, 1)]
        if not in_edition:
            excluded["no-gen-exod-occurrence"] += 1
            continue
        book_idx, chapter_no, verse_no = in_edition[0]
        # The example verse must be real in the edition's own counts.
        if not (1 <= chapter_no <= len(verse_counts[book_idx]) and 1 <= verse_no <= verse_counts[book_idx][chapter_no - 1]):
            excluded["example-unresolved"] += 1
            continue
        chapter_data = chapter(book_idx, chapter_no)
        verse = next((v for v in chapter_data["verses"] if v["n"] == verse_no), None)
        if verse is None:
            excluded["example-unresolved"] += 1
            continue
        part_found = None
        for word in verse["w"]:
            for part in word.get("p", []):
                if part.get("lm") == strongs:
                    part_found = part
                    break
            if part_found:
                break
        if part_found is None or not part_found.get("t") or not part_found.get("g"):
            excluded["example-unresolved"] += 1
            continue

        root_info = detail.get("root") or {}
        root_hebrew = root_info.get("root") or hebrew
        entries.append({
            "strongs": strongs,
            "hebrew": hebrew,
            "xlit": xlit,
            "gloss": gloss,
            "pos": detail.get("pos"),
            "root": root_hebrew,
            "example": {
                "book": book_names[book_idx],
                "chapter": chapter_no,
                "verse": verse_no,
                "ref": f"{book_names[book_idx]} {chapter_no}:{verse_no}",
                "form": part_found["t"],
                "morphGloss": part_found["g"],
                "verseText": verse.get("en"),
            },
        })

    payload = {
        "dataset": "one-word-a-day/1.0.0",
        "source": "R2-02 lexicon data in this repo: docs/scripture/data/lemma-index.json, docs/scripture/data/lemmas/*.json, docs/scripture/data/chapters/*.json (WLC/OSHB edition of Genesis and Exodus), transliterations and glosses exactly as printed in that data.",
        "rotation": "Entries in Strong's order; Pattern Day d (1..364) takes entry (d - 1) mod entryCount. The Day Out of Time takes no entry.",
        "entryCount": len(entries),
        "entries": entries,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(entries)} entries; excluded: {excluded}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
