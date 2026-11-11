#!/usr/bin/env python3
"""Verify R2-02 derived Scripture against its pinned text and lexical sources."""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import r2_02_build as build


def load_json(path):
    with open(os.path.join(ROOT, path), encoding="utf8") as handle:
        return json.load(handle)


def verify_scripture():
    book_specs = [("Gen", "Genesis", "genesis", 50), ("Exod", "Exodus", "exodus", 40)]
    verse_map = build.parse_versemap()
    web = build.parse_web()
    totals = {"chapters": 0, "verses": 0, "words": 0}
    for osis, _, slug, chapter_count in book_specs:
        source = build.parse_wlc(os.path.join(build.SRC, "morphhb", "wlc", osis + ".xml"))
        assert len(source) == chapter_count, (osis, len(source), chapter_count)
        for chapter_number, source_chapter in enumerate(source, 1):
            derived = load_json(f"docs/scripture/data/chapters/{osis}-{chapter_number:02d}.json")
            assert derived["book"] == osis and derived["chapter"] == chapter_number
            assert len(derived["verses"]) == len(source_chapter["verses"])
            for source_verse, verse in zip(source_chapter["verses"], derived["verses"]):
                assert verse["id"] == source_verse["osis"], (verse["id"], source_verse["osis"])
                assert verse["n"] == int(source_verse["osis"].rsplit(".", 1)[1])
                assert len(verse["w"]) == len(source_verse["words"]), verse["id"]
                mapped = verse_map.get(source_verse["osis"], (source_verse["osis"], "same"))[0]
                assert verse["enRef"] == mapped, (verse["id"], verse["enRef"], mapped)
                assert verse["en"] == web.get(mapped, ""), (verse["id"], verse["enRef"])
                assert verse["en"].strip(), ("missing English translation", verse["id"], mapped)
                for original_word, word in zip(source_verse["words"], verse["w"]):
                    for field in ("id", "t", "l", "m", "k", "alt", "a"):
                        if original_word.get(field):
                            assert word.get(field) == original_word[field], (verse["id"], field, word["id"])
                    if "q" in original_word:
                        assert word["q"]["id"] == original_word["q"]["id"]
                        assert word["q"]["t"] == original_word["q"]["t"]
                    assert "".join(part["t"] for part in word["p"]) == word["t"].replace("/", ""), word["id"]
                    lang = (original_word["m"] or "")[:1]
                    if lang not in ("H", "A"):
                        lang = "H"
                    for part in word["p"]:
                        assert part["m"] in (word["m"] or "").replace("/", "") or part["m"] == "R", (word["id"], part)
                        assert part["g"] == build.decode_morph_segment(part["m"], lang)["text"], (word["id"], part)
                totals["verses"] += 1
                totals["words"] += len(verse["w"])
            page = os.path.join(ROOT, "docs/scripture", slug, f"{chapter_number:02d}.html")
            with open(page, encoding="utf8") as handle:
                html = handle.read()
            assert f'<body class="sf-chapter" data-book="{osis}" data-chapter="{chapter_number}"' in html
            assert f'id="{osis}.{chapter_number}.1"' in html
            totals["chapters"] += 1
    expected = load_json("docs/scripture/data/manifest.json")["totals"]
    assert totals["chapters"] == expected["chapters"] == 90, totals
    assert totals["verses"] == expected["verses"] == 2746, totals
    assert totals["words"] == expected["wordTokens"], totals
    return totals


def verify_lexicon():
    lexicon = build.Lexicon()
    manifest = load_json("docs/scripture/data/manifest.json")
    occurrence_index = load_json("sources/r2-02/derived/wlc-lemma-occurrences.json")
    assert occurrence_index["books"] == build.ALL_BOOKS
    for flat in occurrence_index["lemmas"].values():
        assert len(flat) % 3 == 0
        references = [tuple(flat[i:i + 3]) for i in range(0, len(flat), 3)]
        assert all(0 <= book < len(build.ALL_BOOKS) and chapter > 0 and verse > 0
                   for book, chapter, verse in references)
        assert references == sorted(references)
    seen = set()
    count = 0
    for filename in sorted(os.listdir(os.path.join(ROOT, "docs/scripture/data/lemmas"))):
        if not filename.endswith(".json"):
            continue
        shard = load_json("docs/scripture/data/lemmas/" + filename)
        for lemma_id, actual in shard["lemmas"].items():
            digits = actual["strong"]
            key = (digits, actual.get("aug") or "")
            expected = lexicon.record(key)
            assert actual["id"] == lemma_id
            assert actual.get("available", {}) == expected.get("available", {})
            if expected.get("bdb"):
                assert actual["bdb"]["entryId"] == expected["bdb"]["entryId"]
                actual_senses = actual["bdb"]["senses"]
                expected_senses = expected["bdb"]["senses"]
                assert [s["id"] for s in actual_senses] == [s["id"] for s in expected_senses], lemma_id
                assert [s["text"] for s in actual_senses] == [s["text"] for s in expected_senses], lemma_id
                assert [s["refs"] for s in actual_senses] == [s["refs"] for s in expected_senses], lemma_id
                count += len(actual_senses)
            seen.add(lemma_id)
    assert len(seen) == manifest["totals"]["distinctLemmasInEdition"]
    assert count == manifest["totals"]["senseRecords"], (count, manifest["totals"]["senseRecords"])
    required = ("H7307", "H5315", "H120", "H127", "H1697", "H3045", "H8104", "H5647",
                "H6754", "H1823", "H2617a", "H8034", "H5769", "H5175", "H5303")
    assert set(required).issubset(seen), set(required) - seen
    for lemma_id in required:
        shard_path = f"docs/scripture/data/lemmas/L{int(''.join(c for c in lemma_id if c.isdigit())) // 300:02d}.json"
        rec = load_json(shard_path)["lemmas"][lemma_id]
        assert rec["bdb"] and rec["bdb"]["senses"], lemma_id
    return len(seen), count


def verify_archival_sources():
    expected = "81a015fb937f1664c2383fa38fddf956d281c6309a9584382c6dbc9d8b691400"
    for path in (
        "Full_Scroll_Unsealed",
        "archive/Full_Scroll_Unsealed/1.0.0/Full_Scroll_Unsealed",
        "docs/scroll/archive/Full_Scroll_Unsealed.txt",
    ):
        data = open(os.path.join(ROOT, path), "rb").read()
        assert build.sha(data) == expected, path
    report = load_json("site-audit/r2-02/original-to-derived-comparison.json")["originals"]
    expected_originals = {
        "Gen": ("Genesis-Restored.md", "e3af941e7b0531f103d6e64b5fb1cda356f3591acd11c77cf724a1567fbd09f8"),
        "Exod": ("Exodus-Restored.md", "35d399afa8ec115c5f62170e6908c9cb8d2bb2c9446a0c7bc105d81644a9c1f1"),
    }
    for osis, (filename, expected_hash) in expected_originals.items():
        data = open(os.path.join(ROOT, filename), "rb").read()
        assert build.sha(data) == expected_hash == report[osis]["sha256"], filename


def main():
    build.verify_sources()
    verify_archival_sources()
    totals = verify_scripture()
    lemmas, senses = verify_lexicon()
    print(f"R2-02 source verification passed: {totals['chapters']} chapters, {totals['verses']} verses, "
          f"{totals['words']} WLC words, {lemmas} lemmas, {senses} source-matched BDB sense records")


if __name__ == "__main__":
    main()
