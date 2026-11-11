#!/usr/bin/env python3
"""R2-02 source acquisition and verification (Python 3 standard library only).

Downloads pinned, immutable commit snapshots of the three public datasets used
by the Scripture edition, verifies each file against sources/r2-02/SOURCES.json
(SHA-256) and writes the committed copies under sources/r2-02/.

  python3 scripts/r2_02_acquire_sources.py            # download + verify
  python3 scripts/r2_02_acquire_sources.py --verify   # verify committed files only (offline)
  python3 scripts/r2_02_acquire_sources.py --pin      # first-time: record hashes

The remaining 37 WLC book files are fetched to a cache directory only to build
the whole-Bible occurrence index; they are hash-verified but not committed.
"""
import hashlib, json, os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "sources", "r2-02")
MANIFEST = os.path.join(OUT, "SOURCES.json")
CACHE = os.environ.get("R2_02_CACHE", "/tmp/r2-02-cache")

REPOS = {
    "morphhb": {"repo": "openscriptures/morphhb", "commit": "3d15126fb1ef74867fc1434be1942e837932691f"},
    "hebrewlexicon": {"repo": "openscriptures/HebrewLexicon", "commit": "21c9add13bc727d3a951361778e97e3ff7afd1ce"},
    "web": {"repo": "TehShrike/world-english-bible", "commit": "68669ba3be9719ae4d1135b19d9e0b6587b7c356"},
}
COMMITTED = {
    "morphhb": ["wlc/Gen.xml", "wlc/Exod.xml", "wlc/VerseMap.xml", "LICENSE.md", "README.md"],
    "hebrewlexicon": ["BrownDriverBriggs.xml", "LexicalIndex.xml", "AugIndex.xml", "HebrewStrong.xml", "readme.md"],
    "web": ["json/genesis.json", "json/exodus.json", "html/copyright.htm"],
}
BOOKS = ["Gen", "Exod", "Lev", "Num", "Deut", "Josh", "Judg", "1Sam", "2Sam", "1Kgs", "2Kgs", "Isa", "Jer", "Ezek",
         "Hos", "Joel", "Amos", "Obad", "Jonah", "Mic", "Nah", "Hab", "Zeph", "Hag", "Zech", "Mal", "Ps", "Job",
         "Prov", "Ruth", "Song", "Eccl", "Lam", "Esth", "Dan", "Ezra", "Neh", "1Chr", "2Chr"]


def url(key, path):
    r = REPOS[key]
    return f"https://raw.githubusercontent.com/{r['repo']}/{r['commit']}/{path}"


def fetch(key, path):
    with urllib.request.urlopen(url(key, path), timeout=120) as resp:
        return resp.read()


def sha(b):
    return hashlib.sha256(b).hexdigest()


def load_manifest():
    if os.path.exists(MANIFEST):
        return json.load(open(MANIFEST, encoding="utf8"))
    return {"files": {}, "wlcAll": {}}


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    man = load_manifest()
    bad = []
    if mode == "--verify":
        for key, paths in COMMITTED.items():
            for p in paths:
                f = os.path.join(OUT, key, p)
                want = man["files"].get(f"{key}/{p}", {}).get("sha256")
                got = sha(open(f, "rb").read()) if os.path.exists(f) else None
                if got != want:
                    bad.append(f"{key}/{p}: expected {want} got {got}")
        for p, expected in man.get("derivedFiles", {}).items():
            f = os.path.join(OUT, p)
            data = open(f, "rb").read() if os.path.exists(f) else None
            got = sha(data) if data is not None else None
            if got != expected["sha256"] or (data is not None and len(data) != expected["bytes"]):
                bad.append(f"{p}: derived file hash/size mismatch")
        print("verify:", "OK" if not bad else "FAILED")
        for b in bad:
            print(" ", b)
        sys.exit(1 if bad else 0)

    pin = mode == "--pin"
    for key, paths in COMMITTED.items():
        for p in paths:
            data = fetch(key, p)
            h = sha(data)
            k = f"{key}/{p}"
            if pin:
                man["files"][k] = {"url": url(key, p), "sha256": h, "bytes": len(data)}
            elif man["files"].get(k, {}).get("sha256") != h:
                bad.append(f"{k}: hash mismatch (got {h})")
                continue
            dest = os.path.join(OUT, key, p)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, "wb") as fh:
                fh.write(data)
            print("ok", k, h[:12])
    os.makedirs(CACHE, exist_ok=True)
    for b in BOOKS:
        data = fetch("morphhb", f"wlc/{b}.xml")
        h = sha(data)
        if pin:
            man["wlcAll"][b] = {"url": url("morphhb", f"wlc/{b}.xml"), "sha256": h, "bytes": len(data)}
        elif man["wlcAll"].get(b, {}).get("sha256") != h:
            bad.append(f"wlc/{b}.xml: hash mismatch (got {h})")
            continue
        with open(os.path.join(CACHE, f"{b}.xml"), "wb") as fh:
            fh.write(data)
    if pin:
        man["repos"] = REPOS
        with open(MANIFEST, "w", encoding="utf8") as fh:
            json.dump(man, fh, indent=2, sort_keys=True)
            fh.write("\n")
    print("acquire:", "OK" if not bad else "FAILED")
    for b in bad:
        print(" ", b)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
