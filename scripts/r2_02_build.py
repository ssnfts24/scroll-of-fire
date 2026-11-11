#!/usr/bin/env python3
"""R2-02 build: derives the Genesis/Exodus Scripture edition from pinned sources.

  python3 scripts/r2_02_build.py             # write outputs
  python3 scripts/r2_02_build.py --check     # fail if committed outputs differ
  python3 scripts/r2_02_build.py --occurrences   # (re)build whole-Bible lemma index from the acquire cache

Inputs : sources/r2-02/** (pinned, hash-verified), Genesis-Restored.md, Exodus-Restored.md (read only),
         scripts/r2_02_curated.json (authored context layer)
Outputs: docs/scripture/data/**, docs/scripture/**/*.html, site-audit/r2-02/*.json|md
Deterministic: no timestamps, sorted keys, UTF-8, no Unicode normalization of source Hebrew.
"""
import hashlib, json, os, re, sys, xml.etree.ElementTree as ET
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from r2_02_lib import decode_morph_segment, transliterate, consonants, strip_marks  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "sources", "r2-02")
DOCS = os.path.join(ROOT, "docs", "scripture")
DATA = os.path.join(DOCS, "data")
AUDIT = os.path.join(ROOT, "site-audit", "r2-02")
CACHE = os.environ.get("R2_02_CACHE", "/tmp/r2-02-cache")
OCC_PATH = os.path.join(SRC, "derived", "wlc-lemma-occurrences.json")
OSIS_NS = "{http://www.bibletechnologies.net/2003/OSIS/namespace}"
LEX_NS = "{http://openscriptures.github.com/morphhb/namespace}"
BOOKS = [("Gen", "Genesis", "genesis", 50), ("Exod", "Exodus", "exodus", 40)]
ALL_BOOKS = ["Gen", "Exod", "Lev", "Num", "Deut", "Josh", "Judg", "1Sam", "2Sam", "1Kgs", "2Kgs", "Isa", "Jer", "Ezek",
             "Hos", "Joel", "Amos", "Obad", "Jonah", "Mic", "Nah", "Hab", "Zeph", "Hag", "Zech", "Mal", "Ps", "Job",
             "Prov", "Ruth", "Song", "Eccl", "Lam", "Esth", "Dan", "Ezra", "Neh", "1Chr", "2Chr"]
OUT = {}  # relative path -> bytes (written or compared at the end)


def sha(b):
    return hashlib.sha256(b).hexdigest()


def read(path):
    with open(path, "rb") as fh:
        return fh.read()


def emit_json(rel, obj):
    OUT[rel] = (json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf8")


def emit_pretty(rel, obj):
    OUT[rel] = (json.dumps(obj, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf8")


def emit_text(rel, text):
    OUT[rel] = text.encode("utf8")


def verify_sources():
    man = json.loads(read(os.path.join(SRC, "SOURCES.json")))
    for k, v in sorted(man["files"].items()):
        key, path = k.split("/", 1)
        got = sha(read(os.path.join(SRC, key, path)))
        if got != v["sha256"]:
            raise SystemExit(f"source hash mismatch: {k}")
    for path, v in sorted(man.get("derivedFiles", {}).items()):
        data = read(os.path.join(SRC, path))
        if sha(data) != v["sha256"] or len(data) != v["bytes"]:
            raise SystemExit(f"derived source hash/size mismatch: {path}")
    return man


def lemma_key(seg):
    """'1254 a' -> ('1254','a'); returns None for non-lexical (prefix) segments."""
    m = re.fullmatch(r"(\d+)\+?(?: ([a-z]))?", seg)
    if not m:
        return None
    return m.group(1), m.group(2) or ""


# ------------------------------------------------------------------ WLC parse
def parse_wlc(path):
    tree = ET.parse(path)
    chapters = []
    for ch in tree.getroot().iter(OSIS_NS + "chapter"):
        verses = []
        for v in ch.findall(OSIS_NS + "verse"):
            words, notes = [], []
            last = None
            for el in list(v):
                tag = el.tag.replace(OSIS_NS, "")
                if tag == "w":
                    last = {"id": el.get("id"), "t": el.text or "", "l": el.get("lemma"), "m": el.get("morph"),
                            "k": el.get("type"), "a": []}
                    words.append(last)
                elif tag == "seg":
                    if last is None:
                        raise SystemExit("seg before word")
                    last["a"].append([el.get("type"), el.text or ""])
                elif tag == "note":
                    nt = el.get("type")
                    rdg = el.find(OSIS_NS + "rdg")
                    if nt == "variant" and rdg is not None and rdg.get("type") == "x-qere" and last is not None:
                        qws, text = [], ""
                        for c in rdg:
                            if c.tag == OSIS_NS + "w":
                                qws.append({"id": c.get("id"), "t": c.text or "", "l": c.get("lemma"), "m": c.get("morph")})
                                text += c.text or ""
                            elif c.tag == OSIS_NS + "seg":
                                text += c.text or ""
                        text = text or (rdg.text or "")
                        last["q"] = {"id": qws[0]["id"] if qws else None, "t": text, "words": qws}
                    elif nt == "alternative" and rdg is not None:
                        last["alt"] = rdg.text
                    else:
                        notes.append({"type": nt, "text": "".join(el.itertext())})
                else:
                    raise SystemExit("unexpected element " + tag)
            verses.append({"osis": v.get("osisID"), "words": words, "notes": notes})
        chapters.append({"osis": ch.get("osisID"), "verses": verses})
    return chapters


def parse_versemap():
    t = read(os.path.join(SRC, "morphhb", "wlc", "VerseMap.xml")).decode("utf8")
    heb2eng = {}
    for m in re.finditer(r'<verse wlc="([^"]+)" kjv="([^"]+)" type="([^"]+)"/>', t):
        if m.group(1).split(".")[0] in ("Gen", "Exod"):
            heb2eng[m.group(1)] = (m.group(2), m.group(3))
    return heb2eng


def parse_web():
    out = {}
    for osis, name in (("Gen", "genesis"), ("Exod", "exodus")):
        data = json.loads(read(os.path.join(SRC, "web", "json", name + ".json")))
        for e in data:
            if e["type"] in ("paragraph text", "line text") and "verseNumber" in e:
                key = f"{osis}.{e['chapterNumber']}.{e['verseNumber']}"
                out.setdefault(key, []).append(e["value"].strip())
    return {k: " ".join(x for x in v if x) for k, v in out.items()}


# -------------------------------------------------------------------- lexicon
def render(el, skip_sense=True):
    parts = [el.text or ""]
    for ch in el:
        if not (skip_sense and ch.tag == LEX_NS + "sense"):
            parts.append(render(ch, skip_sense=False))
        parts.append(ch.tail or "")
    return "".join(parts)


def clean(s):
    return re.sub(r"\s+", " ", s).strip()


UNCERTAIN = re.compile(r"\b(?:perh|prob|poss|doubtful|dubious|cj|conj|emend|unknown|uncertain)\b\.?|\?")
FIGURATIVE = re.compile(r"\bfig\.|\bfigur")
IDIOM = re.compile(r"\bphr\.|\bidiom|\bin phr\b|\bformula")
SPECIAL = re.compile(r"\b(?:mythol|technical|t\.t\.|cultic|legal|military|eccles|poet)\b\.?")


def sense_record(entry_id, el, path, depth):
    text = clean(render(el))
    # nested sense refs belong to the nested sense, so recompute from own content only
    own_refs, own_gl, own_heb = [], [], []

    def walk(node):
        for ch in node:
            if ch.tag == LEX_NS + "sense":
                continue
            if ch.tag == LEX_NS + "ref" and ch.get("r"):
                own_refs.append({"r": ch.get("r"), "label": clean("".join(ch.itertext()))})
            elif ch.tag == LEX_NS + "def":
                own_gl.append(clean("".join(ch.itertext())))
            elif ch.tag == LEX_NS + "w":
                own_heb.append(clean("".join(ch.itertext())))
            walk(ch)
    walk(el)
    markers = sorted(set(m.group(0).strip(".") for m in UNCERTAIN.finditer(text)))
    category = "figurative" if FIGURATIVE.search(text) else "idiomatic" if IDIOM.search(text) else \
        "specialized" if SPECIAL.search(text) else "unmarked"
    cnt = re.search(r"\((\d+) t\.\)", text)
    return {
        "id": f"bdb:{entry_id}:s{path}", "n": path, "depth": depth,
        "level": "primary (top-level in BDB outline)" if depth == 0 else "secondary (subdivision in BDB outline)",
        "text": text, "glosses": own_gl, "hebrewExamples": own_heb, "refs": own_refs,
        "category": category, "categoryBasis": "abbreviation markers printed in the BDB entry text",
        "uncertaintyMarkers": markers,
        "attestation": "marked-uncertain-in-source" if markers else "listed-in-source",
        "bdbOccurrenceCount": int(cnt.group(1)) if cnt else None,
        "applicability": "not-assessed-for-any-verse-unless-listed-in-contextual-selections",
    }


def senses_of(entry_id, entry):
    out = []

    def rec(node, prefix, depth):
        for s in node.findall(LEX_NS + "sense"):
            n = s.get("n") or str(len(out) + 1)
            path = f"{prefix}.{n}" if prefix else n
            out.append(sense_record(entry_id, s, path, depth))
            rec(s, path, depth + 1)
    rec(entry, "", 0)
    return out


class Lexicon:
    def __init__(self):
        base = os.path.join(SRC, "hebrewlexicon")
        bdb = ET.parse(os.path.join(base, "BrownDriverBriggs.xml")).getroot()
        self.bdb = {e.get("id"): e for e in bdb.iter(LEX_NS + "entry")}
        li = ET.parse(os.path.join(base, "LexicalIndex.xml")).getroot()
        self.li = {e.get("id"): e for e in li.iter(LEX_NS + "entry")}
        aug = ET.parse(os.path.join(base, "AugIndex.xml")).getroot()
        self.aug = {w.get("aug"): w.text for w in aug.iter(LEX_NS + "w")}
        self.aug_rev = {v: k for k, v in self.aug.items()}
        st = ET.parse(os.path.join(base, "HebrewStrong.xml")).getroot()
        self.strong = {e.get("id"): e for e in st.iter(LEX_NS + "entry")}
        self.by_cons = {}
        for lid, e in self.li.items():
            w = e.find(LEX_NS + "w")
            if w is not None and w.text:
                self.by_cons.setdefault(consonants(w.text), []).append(lid)
        self.children = {}
        for lid, e in self.li.items():
            et = e.find(LEX_NS + "etym")
            if et is not None and et.get("type") == "main":
                self.children[lid] = [x.strip() for x in (et.text or "").split(",") if x.strip()]

    def li_summary(self, lid):
        e = self.li[lid]
        w = e.find(LEX_NS + "w")
        x = e.find(LEX_NS + "xref")
        d = e.find(LEX_NS + "def")
        p = e.find(LEX_NS + "pos")
        return {"liId": lid, "hebrew": clean("".join(w.itertext())) if w is not None else "",
                "xlit": w.get("xlit") if w is not None else None,
                "pos": p.text if p is not None else None, "gloss": clean("".join(d.itertext())) if d is not None else None,
                "strong": x.get("strong") if x is not None else None, "lemmaId": ("H" + self.aug_rev[lid]) if lid in self.aug_rev else None}

    def record(self, key):
        digits, letter = key
        lid = self.aug.get(digits + letter) or self.aug.get(digits)
        rec = {"id": f"H{digits}{letter}", "strong": digits, "aug": letter, "available": {"lexicalIndex": False, "bdb": False, "strongs": False}}
        s = self.strong.get("H" + digits)
        if s is not None:
            w = s.find(LEX_NS + "w")
            mean, usage, source = s.find(LEX_NS + "meaning"), s.find(LEX_NS + "usage"), s.find(LEX_NS + "source")
            rec["strongs"] = {"hebrew": clean("".join(w.itertext())) if w is not None else None,
                              "xlit": w.get("xlit") if w is not None else None, "pron": w.get("pron") if w is not None else None,
                              "source": clean("".join(source.itertext())) if source is not None else None,
                              "meaning": clean("".join(mean.itertext())) if mean is not None else None,
                              "usage": clean("".join(usage.itertext())) if usage is not None else None,
                              "note": "Strong's is a 1890 concordance dictionary; it is shown as one source and is not treated as a complete lexical definition."}
            rec["available"]["strongs"] = True
        if lid and lid in self.li:
            summ = self.li_summary(lid)
            rec.update({"liId": lid, "hebrew": summ["hebrew"], "xlit": summ["xlit"], "pos": summ["pos"], "indexGloss": summ["gloss"]})
            rec["available"]["lexicalIndex"] = True
            x = self.li[lid].find(LEX_NS + "xref")
            bid = x.get("bdb") if x is not None else None
            if x is not None and x.get("twot"):
                rec["twot"] = x.get("twot")
            if bid and bid in self.bdb:
                e = self.bdb[bid]
                ss = senses_of(bid, e)
                full = clean(render(e))
                if not ss:
                    ss = [{"id": f"bdb:{bid}:s0", "n": "0", "depth": 0, "level": "undivided entry (no numbered senses in dataset)", "text": full,
                           "glosses": [clean("".join(d.itertext())) for d in e.iter(LEX_NS + "def")],
                           "hebrewExamples": [clean("".join(w.itertext())) for w in e.iter(LEX_NS + "w")],
                           "refs": [{"r": r.get("r"), "label": clean("".join(r.itertext()))} for r in e.iter(LEX_NS + "ref") if r.get("r")],
                           "category": "unmarked", "categoryBasis": "no sub-senses in the dataset", "uncertaintyMarkers": [],
                           "attestation": "listed-in-source", "bdbOccurrenceCount": None,
                           "applicability": "not-assessed-for-any-verse-unless-listed-in-contextual-selections"}]
                head = clean((e.text or "") + "".join(render(c, False) + (c.tail or "") for c in e if c.tag != LEX_NS + "sense" and c.tag != LEX_NS + "status"))
                st = e.find(LEX_NS + "status")
                rec["bdb"] = {"entryId": bid, "mod": e.get("mod"), "cite": e.get("cite"), "datasetStatus": st.text if st is not None else None,
                              "headline": head, "crossReference": bool(len(full) < 90 and re.search(r"\bv\.", full)),
                              "senseCount": len(ss), "senses": ss,
                              "datasetNote": "OSHB's BDB file is a work-in-progress digitisation; senses are exactly those present in that file and may be fewer than in the printed lexicon."}
                rec["available"]["bdb"] = True
            else:
                rec["bdb"] = None
            # root family and homonyms
            et = self.li[lid].find(LEX_NS + "etym")
            main = None
            if et is not None and et.get("type") == "main":
                main = lid
            elif et is not None and et.get("type") == "sub" and et.text:
                main = et.text.strip()
            if main and main in self.li and main in self.children:
                me = self.li[main].find(LEX_NS + "etym")
                fam = [main] + self.children[main]
                rec["root"] = {"root": me.get("root"), "mainLiId": main,
                               "members": [self.li_summary(m) for m in fam if m != lid and m in self.li],
                               "note": "Members share a lexicon-assigned root. Shared consonants do not make meanings identical."}
            cons = consonants(rec["hebrew"])
            hom = [self.li_summary(h) for h in self.by_cons.get(cons, []) if h != lid]
            rec["homonyms"] = hom
        return rec


# ------------------------------------------------------------ original files
BOILER = re.compile(r"^Note:\s*These Hebrew roots? carry layered meanings")
HEAD = re.compile(r"^📜")
IDX = re.compile(r"^[^:]{1,40}: Paragraph \d+")
MARK = re.compile(r"^(\d+):(\d+)\s*(.*)$")


def parse_original(fname, osis):
    lines = read(os.path.join(ROOT, fname)).decode("utf8").split("\n")
    blocks, cur, stop = [], None, False
    for i, raw in enumerate(lines, 1):
        line = raw.rstrip("\r")
        if HEAD.match(line):
            cur = None
            continue
        if IDX.match(line):
            cur = None
            stop = True
        m = MARK.match(line)
        if m and not stop:
            cur = {"ch": int(m.group(1)), "v": int(m.group(2)), "start": i, "lines": []}
            blocks.append(cur)
            if m.group(3).strip():
                cur["lines"].append((i, m.group(3).strip()))
            continue
        if cur is not None and line.strip():
            cur["lines"].append((i, line.strip()))
    for b in blocks:
        b["end"] = b["lines"][-1][0] if b["lines"] else b["start"]
    return blocks, len(lines)


def classify_line(text):
    if BOILER.match(text):
        return "boilerplate-hebrew-root-note"
    if text.startswith("→ Prophetic insight") or text.startswith("🌿") or text.startswith("Deep tie"):
        return "author-interpretation"
    if text.startswith("→ Hebrew") or text.startswith("Hebrew:"):
        return "author-hebrew-note"
    return "author-scripture-paraphrase-or-commentary"


HEB_RUN = re.compile(r"[\u0590-\u05FF]+(?:[ \u05BE][\u0590-\u05FF]+)*")


def build_originals(chap_words):
    """chap_words: osis verse id -> list of consonant strings (Hebrew numbering)."""
    result = {}
    for osis, label, slug, nch in BOOKS:
        fname = f"{label}-Restored.md"
        blocks, nlines = parse_original(fname, osis)
        result[osis] = {"file": fname, "bytes": len(read(os.path.join(ROOT, fname))), "sha256": sha(read(os.path.join(ROOT, fname))),
                        "lines": nlines, "blocks": blocks}
    return result


def main():
    check = "--check" in sys.argv
    if "--occurrences" in sys.argv:
        return build_occurrences()
    import r2_02_pages
    man = verify_sources()
    heb2eng = parse_versemap()
    eng2heb = {v[0]: k for k, v in heb2eng.items()}
    web = parse_web()
    lex = Lexicon()
    occ = json.loads(read(OCC_PATH))
    book_idx = {b: i for i, b in enumerate(occ["books"])}

    chapters = {}
    lemma_keys = {}
    verse_total = word_total = 0
    for osis, label, slug, nch in BOOKS:
        chs = parse_wlc(os.path.join(SRC, "morphhb", "wlc", osis + ".xml"))
        assert len(chs) == nch, (osis, len(chs))
        for ci, ch in enumerate(chs, 1):
            assert ch["osis"] == f"{osis}.{ci}"
            verses_out = []
            for v in ch["verses"]:
                vn = int(v["osis"].rsplit(".", 1)[1])
                eng_ref = heb2eng.get(v["osis"], (v["osis"], "same"))[0]
                words_out = []
                for wi, w in enumerate(v["words"], 1):
                    surf = w["t"].split("/")
                    mo = (w["m"] or "")
                    lang = mo[:1] if mo[:1] in "HA" else "H"
                    msegs = mo[1:].split("/") if mo else []
                    lsegs = w["l"].split("/") if w["l"] else []
                    non_s = [i for i, m in enumerate(msegs) if not m.startswith("S")]
                    parts, li = [], 0
                    for si, st in enumerate(surf):
                        m = msegs[si] if si < len(msegs) else ""
                        take = False
                        if li < len(lsegs):
                            if not m.startswith("S"):
                                take = True
                            else:
                                remaining_nons = len([j for j in non_s if j > si])
                                take = (len(lsegs) - li) > remaining_nons
                        l = lsegs[li] if take else None
                        li += 1 if take else 0
                        lk = lemma_key(l) if l else None
                        lid = f"H{lk[0]}{lk[1]}" if lk else None
                        if lk:
                            lemma_keys[lk] = True
                        dm = decode_morph_segment(m, lang)
                        parts.append({"t": st, "x": transliterate(st), "m": m, "g": dm["text"],
                                      **({"lm": lid} if lid else {}), **({"fx": l} if l and not lk else {})})
                    rec = {"id": w["id"], "i": wi, "t": w["t"], "tr": "".join(p["x"] for p in parts),
                           "m": w["m"], "l": w["l"], "p": parts}
                    if w.get("k"):
                        rec["k"] = w["k"]
                    if w.get("q"):
                        qp = w["q"]
                        rec["q"] = {"id": qp["id"], "t": qp["t"], "tr": transliterate(qp["t"].replace("/", "")),
                                    "words": qp["words"]}
                    if w["a"]:
                        rec["a"] = w["a"]
                    if w.get("alt"):
                        rec["alt"] = w["alt"]
                    words_out.append(rec)
                    word_total += 1
                verses_out.append({"id": v["osis"], "n": vn, "en": web.get(eng_ref, ""), "enRef": eng_ref,
                                   "enNumbering": heb2eng.get(v["osis"], (None, "same"))[1] if v["osis"] in heb2eng else "same",
                                   "notes": v["notes"], "w": words_out})
                verse_total += 1
            chapters[(osis, ci)] = verses_out

    # ------------------------------------------------ lemma shards (+occurrence index)
    lemma_records = {}
    lemmas_in_edition = {}
    for (osis, ci), vs in chapters.items():
        for v in vs:
            for w in v["w"]:
                for p in w["p"]:
                    if p.get("lm"):
                        lemmas_in_edition.setdefault(p["lm"], {"forms": {}, "n": 0})
                        e = lemmas_in_edition[p["lm"]]
                        e["n"] += 1
                        f = strip_marks(p["t"])
                        e["forms"].setdefault(f, {"n": 0, "morph": {}})
                        e["forms"][f]["n"] += 1
                        e["forms"][f]["morph"][p["m"]] = e["forms"][f]["morph"].get(p["m"], 0) + 1
    lemma_index = []
    for lid in sorted(lemmas_in_edition, key=lambda x: (int(re.match(r"H(\d+)", x).group(1)), x)):
        m = re.fullmatch(r"H(\d+)([a-z]?)", lid)
        rec = lex.record((m.group(1), m.group(2)))
        info = lemmas_in_edition[lid]
        rec["inEdition"] = {"count": info["n"], "forms": [{"form": f, "count": d["n"], "morph": [{"code": c, "count": n} for c, n in sorted(d["morph"].items())]}
                                                         for f, d in sorted(info["forms"].items())]}
        o = occ["lemmas"].get(f"{m.group(1)}{m.group(2)}") or occ["lemmas"].get(m.group(1))
        rec["occurrences"] = {"flat": o or [], "total": len(o) // 3 if o else 0, "versification": "Hebrew (WLC) numbering",
                              "note": "Every occurrence of this lemma identifier in the pinned WLC (39 books). One entry per word-part that carries this lemma."}
        lemma_records[lid] = rec
        shard = f"L{int(m.group(1)) // 300:02d}"
        rec["shard"] = shard
        lemma_index.append({"id": lid, "h": rec.get("hebrew") or (rec.get("strongs") or {}).get("hebrew"), "x": rec.get("xlit"),
                            "g": rec.get("indexGloss") or ((rec.get("strongs") or {}).get("meaning")), "s": m.group(1), "n": info["n"],
                            "sc": rec["bdb"]["senseCount"] if rec.get("bdb") else 0, "sh": shard})
    shards = {}
    for lid, rec in lemma_records.items():
        shards.setdefault(rec["shard"], {})[lid] = rec
    for sh, d in sorted(shards.items()):
        emit_json(f"docs/scripture/data/lemmas/{sh}.json", {"shard": sh, "lemmas": d})
    emit_json("docs/scripture/data/lemma-index.json", {"lemmas": lemma_index})

    # ------------------------------------------------ originals / remnant / coverage
    originals = build_originals(None)
    curated = json.loads(read(os.path.join(ROOT, "scripts", "r2_02_curated.json")))
    verses_by_id = {v["id"]: v for vs in chapters.values() for v in vs}
    eng_ids_by_ch = {}
    for hid, v in verses_by_id.items():
        e = v["enRef"]
        c = int(e.split(".")[1])
        eng_ids_by_ch.setdefault((e.split(".")[0], c), {})[e] = hid

    remnant, coverage_rows, comparison = {}, [], []
    for osis, label, slug, nch in BOOKS:
        info = originals[osis]
        blocks = info["blocks"]
        by_ch = {}
        for b in blocks:
            by_ch.setdefault(b["ch"], []).append(b)
        rem = {}
        for ci in range(1, nch + 1):
            expected_eng = eng_ids_by_ch.get((osis, ci), {})
            expected_heb = {v["id"] for v in chapters[(osis, ci)]}
            exp_e_nums = sorted(int(k.rsplit(".", 1)[1]) for k in expected_eng)
            exp_h_nums = sorted(int(h.rsplit(".", 1)[1]) for h in expected_heb)
            found = by_ch.get(ci, [])
            nums = [b["v"] for b in found]
            seen, dups = set(), []
            for n in nums:
                if n in seen:
                    dups.append(n)
                seen.add(n)
            miss_e = [n for n in exp_e_nums if n not in seen]
            miss_h = [n for n in exp_h_nums if n not in seen]
            extra_e = sorted(n for n in seen if n not in exp_e_nums)
            extra_h = sorted(n for n in seen if n not in exp_h_nums)
            use_heb = (len(miss_h) + len(extra_h)) < (len(miss_e) + len(extra_e))
            missing, extra = (miss_h, extra_h) if use_heb else (miss_e, extra_e)
            last_text = found[-1]["lines"][-1][1] if found and found[-1]["lines"] else ""
            plain = [t for _, t in (found[-1]["lines"] if found else []) if classify_line(t) == "author-scripture-paraphrase-or-commentary"]
            ends_terminal = bool(plain) and bool(re.search(r"[.!?:;”’\")\]—…]\s*$", plain[0]))
            tail_flag = None
            if found and missing and max(seen) < max(exp_h_nums if use_heb else exp_e_nums):
                tail_flag = "ends-before-final-verse"
            if found and not ends_terminal:
                tail_flag = (tail_flag + "+" if tail_flag else "") + "last-verse-without-terminal-punctuation"
            status = "complete-marker-sequence" if not missing and not dups and not extra else "needs-repair"
            numbering = "hebrew" if use_heb else "english"
            comparison.append({"chapter": f"{osis}.{ci}", "expectedVerses": len(exp_e_nums if not use_heb else exp_h_nums),
                               "markersFound": len(nums), "uniqueMarkers": len(seen), "missing": missing, "duplicateMarkers": sorted(set(dups)),
                               "unexpectedMarkers": extra, "numberingBestFit": numbering, "tailFlag": tail_flag, "status": status,
                               "hebrewAndEnglishNumberingDiffer": exp_e_nums != exp_h_nums})
            for b in found:
                hid = None
                if use_heb:
                    hid = f"{osis}.{ci}.{b['v']}"
                else:
                    hid = eng_ids_by_ch.get((osis, ci), {}).get(f"{osis}.{ci}.{b['v']}")
                if hid not in verses_by_id:
                    continue
                kinds = []
                heb_hits = heb_tot = 0
                vc = [consonants(x) for w in verses_by_id[hid]["w"] for x in w["t"].split("/")]
                vjoined = "".join(consonants(w["t"].replace("/", "")) for w in verses_by_id[hid]["w"])
                for ln, t in b["lines"]:
                    kind = classify_line(t)
                    seg = t
                    if "| Hebrew:" in t or t.startswith("→ Hebrew"):
                        for tok in HEB_RUN.findall(t.split("Hebrew:", 1)[-1] if "Hebrew:" in t else t):
                            ct = consonants(tok)
                            if len(ct) >= 2:
                                heb_tot += 1
                                if ct in vjoined:
                                    heb_hits += 1
                    kinds.append({"line": ln, "kind": kind, "text": t})
                rem.setdefault(hid, []).append({"file": info["file"], "markerLine": b["start"], "endLine": b["end"], "manuscriptRef": f"{b['ch']}:{b['v']}",
                                                "manuscriptNumbering": numbering, "lines": [k for k in kinds],
                                                "hebrewTokensChecked": heb_tot, "hebrewTokensFoundInCitedVerse": heb_hits})
        remnant[osis] = rem
        emit_json(f"docs/scripture/data/remnant/{osis}.json", {"book": osis, "source": info["file"], "sha256": info["sha256"], "verses": rem,
                                                                 "note": "Author's manuscript text, unmodified, keyed to the verse it was written beside. Boilerplate repeated Hebrew-root notes are included here as 'boilerplate-hebrew-root-note' and collapsed in the reader."})

    # coverage manifest: every WLC verse
    cov_by_verse = {}
    for vid, v in verses_by_id.items():
        cov_by_verse[vid] = {"hebrewId": vid, "englishId": v["enRef"], "numbering": v["enNumbering"], "words": len(v["w"]),
                             "hasHebrew": bool(v["w"]), "hasTranslation": bool(v["en"]),
                             "originalManuscriptBlocks": len(remnant[vid.split(".")[0]].get(vid, []))}
    uncert = []
    for vid, v in sorted(verses_by_id.items(), key=lambda kv: (kv[0].split(".")[0], int(kv[0].split(".")[1]), int(kv[0].split(".")[2]))):
        for w in v["w"]:
            if w.get("k"):
                uncert.append({"kind": "ketiv-qere", "verse": vid, "word": w["id"], "ketiv": w["t"].replace("/", ""), "qere": (w.get("q") or {}).get("t", "").replace("/", "")})
            if w.get("alt"):
                uncert.append({"kind": "alternative-accent", "verse": vid, "word": w["id"], "primary": w["t"].replace("/", ""), "alternative": w["alt"].replace("/", "")})
        for n in v["notes"]:
            uncert.append({"kind": "wlc-note-" + str(n["type"]), "verse": vid, "text": n["text"]})
        if v["enNumbering"] != "same":
            uncert.append({"kind": "versification-difference", "verse": vid, "englishRef": v["enRef"], "type": v["enNumbering"]})

    # ----------------------------------------------------------- contextual layer
    sense_ids = {s["id"] for r in lemma_records.values() if r.get("bdb") for s in r["bdb"]["senses"]}
    for sel in curated["selections"]:
        v = verses_by_id[sel["verse"]]
        assert any(p.get("lm") == sel["lemma"] for w in v["w"] for p in w["p"]), ("lemma not in verse", sel["id"])
        for sid in sel["senseIds"] + sel.get("alternativeSenseIds", []):
            assert sid in sense_ids, ("unknown sense", sel["id"], sid)
    for t in curated["traditions"]:
        assert t["verse"] in verses_by_id, t["id"]
    for c in curated["chapterNotes"]:
        assert c in {f"{o}.{i}" for o, _, _, n in BOOKS for i in range(1, n + 1)}, c
    emit_json("docs/scripture/data/context.json", curated)

    # ------------------------------------------------------------ chapters
    statuses = {"words": {"total": word_total}, "lexical": {}, "contextual": {}}
    sel_by_verse = {}
    for sel in curated["selections"]:
        sel_by_verse.setdefault(sel["verse"], set()).add(sel["lemma"])
    chapter_meta = {}
    word_with_lemma = 0
    word_parts_total = word_parts_lex = word_parts_sense = 0
    for (osis, ci), vs in sorted(chapters.items(), key=lambda kv: (kv[0][0] != "Gen", kv[0][1])):
        cw = cl = cs = ccontext = 0
        for v in vs:
            for w in v["w"]:
                for p in w["p"]:
                    word_parts_total += 1
                    if p.get("lm"):
                        cl += 1
                        r = lemma_records[p["lm"]]
                        if r.get("bdb"):
                            cs += 1
                    if p.get("lm") and p["lm"] in sel_by_verse.get(v["id"], ()):
                        ccontext += 1
        word_parts_lex += cl
        word_parts_sense += cs
        slug = [b[2] for b in BOOKS if b[0] == osis][0]
        chapter_meta[f"{osis}.{ci}"] = {"verses": len(vs), "words": sum(len(v["w"]) for v in vs), "lemmaParts": cl, "partsWithBdbSenses": cs,
                                         "partsWithReviewedContext": 0, "partsWithDraftContext": ccontext, "path": f"{slug}/{ci:02d}.html"}
        emit_json(f"docs/scripture/data/chapters/{osis}-{ci:02d}.json", {
            "book": osis, "chapter": ci, "edition": "WLC/OSHB 3d15126 + WEB", "verses": vs})

    # ----------------------------------------------------- manifest and reports
    books_meta = []
    for osis, label, slug, nch in BOOKS:
        books_meta.append({"osis": osis, "name": label, "slug": slug, "chapters": nch,
                           "verseCounts": [len(chapters[(osis, c)]) for c in range(1, nch + 1)]})
    cmp_bad = [c for c in comparison if c["status"] != "complete-marker-sequence"]
    manifest = {
        "edition": {"id": "scroll-scripture-r2-02", "version": "0.1.0-draft", "status": "draft-pending-review",
                    "hebrew": "Westminster Leningrad Codex via Open Scriptures Hebrew Bible (OSHB), repository commit pinned in SOURCES.json",
                    "translation": "World English Bible (public domain), unmodified", "versification": "WLC (Hebrew) numbering with English cross-reference from OSHB VerseMap.xml"},
        "sources": {k: {"sha256": v["sha256"], "bytes": v["bytes"], "url": v["url"]} for k, v in man["files"].items()},
        "derivedOccurrenceIndex": man["derivedFiles"]["derived/wlc-lemma-occurrences.json"],
        "repos": man["repos"], "books": books_meta,
        "totals": {"chapters": 90, "verses": verse_total, "wordTokens": word_total, "wordParts": word_parts_total,
                   "wordPartsWithLemma": word_parts_lex, "wordPartsWithBdbSenses": word_parts_sense,
                   "distinctLemmasInEdition": len(lemma_records), "lemmasWithBdbSenses": sum(1 for r in lemma_records.values() if r.get("bdb")),
                   "senseRecords": sum(r["bdb"]["senseCount"] for r in lemma_records.values() if r.get("bdb")),
                   "ketivQere": sum(1 for u in uncert if u["kind"] == "ketiv-qere"), "versificationDifferences": sum(1 for u in uncert if u["kind"] == "versification-difference")},
        "completeness": {
            "level1_originalWordAndMorphology": {"status": "imported", "wordParts": word_parts_total,
                                                  "note": "Imported from OSHB. OSHB marks per-word verification status in its own project; this edition does not claim the morphology is verified."},
            "level2_lexicalSenses": {"status": "imported-from-dataset", "lemmasWithSenses": sum(1 for r in lemma_records.values() if r.get("bdb")),
                                     "lemmasWithoutSenses": sorted(l for l, r in lemma_records.items() if not r.get("bdb")),
                                     "note": "Sense completeness is relative to the OSHB BDB file, which is a work-in-progress digitisation."},
            "level3_reviewedContext": {"status": "not-started-for-review", "draftSelections": len(curated["selections"]),
                                       "reviewedSelections": 0, "note": "All contextual selections are drafts with no scholarly reviewer; no chapter is labelled linguistically verified."}},
        "chapters": chapter_meta, "licenses": {
            "wlcText": "Public domain", "oshbLemmaMorphology": "CC BY 4.0 (attribute: Original work of the Open Scriptures Hebrew Bible available at https://github.com/openscriptures/morphhb)",
            "bdbText": "Public domain (Brown–Driver–Briggs, 1906)", "oshbLexiconMapping": "CC BY 4.0 (attribute OSHB)",
            "strongs": "Public domain text (Strong's, 1890); OSHB layer CC BY 4.0",
            "web": "Public domain (eBible.org); the name 'World English Bible' is a trademark of eBible.org",
            "scrollCommentary": "Original Scroll text remains under the repository's own licence terms and is not relicensed here"}}
    emit_pretty("docs/scripture/data/manifest.json", manifest)

    report = build_reports(manifest, comparison, cov_by_verse, uncert, originals, curated, lemma_records)
    for rel, txt in report.items():
        if rel.endswith(".json"):
            emit_pretty(rel, txt)
        else:
            emit_text(rel, txt)
    r2_02_pages.render_all(OUT, emit_text, books_meta, chapters, manifest, remnant, curated, lemma_index)

    if check:
        bad = []
        for rel, data in sorted(OUT.items()):
            p = os.path.join(ROOT, rel)
            if not os.path.exists(p) or read(p) != data:
                bad.append(rel)
        print("scripture:check", "OK" if not bad else f"STALE ({len(bad)}): " + ", ".join(bad[:8]), f"[{len(OUT)} files]")
        sys.exit(1 if bad else 0)
    for rel, data in sorted(OUT.items()):
        p = os.path.join(ROOT, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        if not os.path.exists(p) or read(p) != data:
            with open(p, "wb") as fh:
                fh.write(data)
    print("wrote", len(OUT), "files;", verse_total, "verses;", word_total, "words;", len(lemma_records), "lemmas;", len(cmp_bad), "chapters need repair")


def build_reports(manifest, comparison, cov, uncert, originals, curated, lemma_records):
    from r2_02_reports import make_reports
    return make_reports(manifest, comparison, cov, uncert, originals, curated, lemma_records)


def build_occurrences():
    out = {"books": ALL_BOOKS, "lemmas": {}, "versification": "WLC (Hebrew) numbering",
           "source": "openscriptures/morphhb@3d15126fb1ef74867fc1434be1942e837932691f wlc/*.xml (all 39 files; hashes in sources/r2-02/SOURCES.json)"}
    man = json.loads(read(os.path.join(SRC, "SOURCES.json")))
    for bi, b in enumerate(ALL_BOOKS):
        data = read(os.path.join(CACHE, b + ".xml"))
        if sha(data) != man["wlcAll"][b]["sha256"]:
            raise SystemExit("cache hash mismatch " + b)
        for ch in parse_wlc(os.path.join(CACHE, b + ".xml")):
            for v in ch["verses"]:
                _, c, vv = v["osis"].split(".")
                for w in v["words"]:
                    for seg in (w["l"] or "").split("/"):
                        lk = lemma_key(seg)
                        if lk:
                            out["lemmas"].setdefault(lk[0] + lk[1], []).extend([bi, int(c), int(vv)])
    data = (json.dumps(out, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf8")
    expected = man.get("derivedFiles", {}).get("derived/wlc-lemma-occurrences.json")
    if expected and (sha(data) != expected["sha256"] or len(data) != expected["bytes"]):
        raise SystemExit("generated occurrence index differs from its pinned digest; refusing to overwrite")
    os.makedirs(os.path.dirname(OCC_PATH), exist_ok=True)
    with open(OCC_PATH, "wb") as fh:
        fh.write(data)
    print("occurrence index:", len(out["lemmas"]), "lemmas,", sum(len(v) for v in out["lemmas"].values()) // 3, "entries")


if __name__ == "__main__":
    main()
