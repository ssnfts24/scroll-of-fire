#!/usr/bin/env python3
"""Extract text statistics and metadata from index-listed PDF, DOCX, TXT and ZIP files.

Writes site-audit/r2/document-extracts.json. The extract records only measurable facts
(page count, character and word counts, embedded metadata, Hebrew/Greek presence, a
short opening excerpt, extraction status). A PDF with no text layer is recorded as
"no-text-layer" and flagged for visual review rather than treated as reviewed.
Stage intentional new source files before extraction; untracked files are excluded.

Usage: python3 scripts/r2-extract-documents.py   (needs: pypdf)
"""
import hashlib
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "site-audit" / "r2" / "document-extracts.json"
EXTS = {".pdf", ".docx", ".txt", ".zip"}
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None


def tracked():
    out = subprocess.check_output(
        ["git", "ls-files", "-z", "--cached"], cwd=ROOT
    ).decode("utf8")
    return sorted(p for p in out.split("\0") if p and Path(p).suffix.lower() in EXTS and (ROOT / p).is_file())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def scripts_present(text):
    return {
        "hebrew": bool(re.search(r"[\u0590-\u05FF]", text)),
        "greek": bool(re.search(r"[\u0370-\u03FF\u1F00-\u1FFF]", text)),
    }


def summarize(text):
    flat = re.sub(r"\s+", " ", text).strip()
    return {
        "characters": len(flat),
        "words": len(flat.split()) if flat else 0,
        "scripts": scripts_present(flat),
        "excerpt": flat[:160],
    }


def do_pdf(path):
    if PdfReader is None:
        return {"status": "parser-unavailable"}
    try:
        reader = PdfReader(str(path))
        pages = len(reader.pages)
        text = "\n".join((p.extract_text() or "") for p in reader.pages)
        meta = reader.metadata or {}
        info = {k.lstrip("/"): str(v)[:120] for k, v in dict(meta).items() if k in ("/Title", "/Author", "/Creator", "/Producer", "/CreationDate")}
    except Exception as exc:  # corrupt or encrypted PDFs are recorded, not hidden
        return {"status": "extract-error", "error": type(exc).__name__}
    result = {"pages": pages, "metadata": info, **summarize(text)}
    result["status"] = "text-extracted" if result["characters"] > 50 else "no-text-layer"
    return result


def do_docx(path):
    try:
        with zipfile.ZipFile(path) as z:
            names = z.namelist()
            root = ET.fromstring(z.read("word/document.xml"))
            paragraphs = []
            for p in root.iter(W + "p"):
                paragraphs.append("".join(t.text or "" for t in p.iter(W + "t")))
            core = {}
            if "docProps/core.xml" in names:
                for el in ET.fromstring(z.read("docProps/core.xml")):
                    tag = el.tag.split("}")[1]
                    if tag in ("title", "creator", "lastModifiedBy", "created", "modified") and el.text:
                        core[tag] = el.text[:120]
            media = [n for n in names if n.startswith("word/media/")]
    except Exception as exc:
        return {"status": "extract-error", "error": type(exc).__name__}
    result = {"paragraphs": len([p for p in paragraphs if p.strip()]), "embeddedMedia": len(media), "metadata": core, **summarize("\n".join(paragraphs))}
    result["status"] = "text-extracted" if result["characters"] > 50 else "no-text-layer"
    return result


def do_txt(path):
    text = path.read_text("utf8", errors="replace")
    return {"status": "text-extracted", "lines": text.count("\n") + 1, **summarize(text)}


def do_zip(path):
    try:
        with zipfile.ZipFile(path) as z:
            infos = z.infolist()
            members = [i.filename for i in infos if not i.is_dir()]
            exts = {}
            for m in members:
                e = Path(m).suffix.lower() or "(none)"
                exts[e] = exts.get(e, 0) + 1
            return {
                "status": "listed-only",
                "members": len(members),
                "uncompressedBytes": sum(i.file_size for i in infos),
                "memberExtensions": exts,
                "firstMembers": members[:8],
            }
    except Exception as exc:
        return {"status": "extract-error", "error": type(exc).__name__}


def main():
    records = {}
    for rel in tracked():
        path = ROOT / rel
        ext = path.suffix.lower()
        handler = {".pdf": do_pdf, ".docx": do_docx, ".txt": do_txt, ".zip": do_zip}[ext]
        records[rel] = {"sha256": sha(path), "bytes": path.stat().st_size, "format": ext[1:], **handler(path)}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schema": "codex-r2-document-extracts/1",
        "note": "Measured text statistics only; extraction is not editorial review.",
        "files": records,
    }
    OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True) + "\n", "utf8")
    by = {}
    for r in records.values():
        by[r["status"]] = by.get(r["status"], 0) + 1
    print(f"extracted {len(records)} files:", by)


if __name__ == "__main__":
    sys.exit(main())
