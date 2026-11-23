#!/usr/bin/env python3
"""
Build docs/assets/js/astronomy/bright-stars.js — the Codex bright-star
catalog module — from the Astronomical Almanac Bright Star List.

Source (read 2026-11-23):
  The Astronomical Almanac's Bright Star List for epoch 2016.5, as
  distributed in the GitHub repository brettonw/YaleBrightStarCatalog
  (file Almanac-BrightStars-2016.txt). The list is derived from the
  Yale Bright Star Catalogue, 5th revised edition (Hoffleit & Warren
  1991, CDS V/50). Coordinates in the list are for epoch 2016.5
  (precession and proper motion already applied by the Almanac);
  the sky engine precesses from 2016.5 to the moment of use.

Subset: stars whose listed V magnitude is a single value <= 4.00.
Stars listed with a magnitude RANGE (long-period variables such as
Mira, HR 681, "2-10") are excluded — a range is not a magnitude.

Sign restoration (documented, deliberate): the distributed text file
drops the minus sign on the only three negative magnitudes in the
list. The published Almanac/BSC values are restored here and the
generator hard-fails if the source values ever differ from the
printed positives it expects:
  HR 2491 (Sirius)   printed  1.46 -> -1.46
  HR 2326 (Canopus)  printed  0.72 -> -0.72
  HR 5340 (Arcturus) printed  0.04 -> -0.04

Usage: python3 scripts/build-bright-stars.py <path-to-Almanac-BrightStars-2016.txt>
Output: docs/assets/js/astronomy/bright-stars.js (written beside the repo root
of the current working directory's clone — run from the repo root).
"""

import re
import sys
from pathlib import Path

MAG_LIMIT = 4.00

SIGN_RESTORATIONS = {2491: (-1.46, 1.46), 2326: (-0.72, 0.72), 5340: (-0.04, 0.04)}

LINE_RE = re.compile(
    r"^(.*?)\s+(\d{1,4})\s+(\d{1,2})\s+(\d{2})\s+(\d{2}\.\d)\s+"
    r"([+-])\s*(\d{1,2})\s+(\d{2})\s+(\d{2})\s+(.*)$"
)
V_RE = re.compile(r"^-?\d{1,2}\.\d{2}$")
COLOR_RE = re.compile(r"^[+-]?\d\.\d{2}$")
RANGE_RE = re.compile(r"^\d+-\d+$")
GARBLED_V = {"-", ".83+"}


def parse_rest(rest):
    """Return (vmag, spectral) or None when the magnitude is a range,
    garbled, or missing (the line is then excluded from the subset)."""
    tokens = rest.split()
    vmag = None
    idx = 0
    for i, tok in enumerate(tokens):
        if RANGE_RE.match(tok) or tok in GARBLED_V:
            return None
        if V_RE.match(tok):
            vmag = float(tok)
            idx = i
            break
        if COLOR_RE.match(tok):
            # A colour index before any magnitude means the magnitude
            # column was not a plain value on this line.
            return None
    if vmag is None:
        return None
    tail = tokens[idx + 1:]
    skipped = 0
    while tail and skipped < 2 and COLOR_RE.match(tail[0]):
        tail = tail[1:]
        skipped += 1
    return vmag, " ".join(tail).strip()


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: build-bright-stars.py <Almanac-BrightStars-2016.txt>")
    lines = Path(sys.argv[1]).read_text(encoding="utf-8").splitlines()

    stars = []
    parsed = 0
    excluded_range = 0
    for line in lines:
        m = LINE_RE.match(line)
        if not m:
            continue
        parsed += 1
        desig = " ".join(m.group(1).split())
        hr = int(m.group(2))
        ra_h, ra_m, ra_s = int(m.group(3)), int(m.group(4)), float(m.group(5))
        sign = 1 if m.group(6) == "+" else -1
        dec_d, dec_m, dec_s = int(m.group(7)), int(m.group(8)), int(m.group(9))
        got = parse_rest(m.group(10))
        if got is None:
            excluded_range += 1
            continue
        vmag, spectral = got
        if hr in SIGN_RESTORATIONS:
            restored, printed = SIGN_RESTORATIONS[hr]
            if abs(vmag - printed) > 1e-9:
                sys.exit(f"HR {hr}: expected printed V {printed}, found {vmag} — source changed; refusing to guess")
            vmag = restored
        if vmag > MAG_LIMIT:
            continue
        ra_deg = (ra_h + ra_m / 60 + ra_s / 3600) * 15.0
        dec_deg = sign * (dec_d + dec_m / 60 + dec_s / 3600)
        stars.append((hr, round(ra_deg, 4), round(dec_deg, 4), vmag, desig, spectral))

    stars.sort(key=lambda s: s[0])
    negatives = [s for s in stars if s[3] < 0]
    if len(negatives) != 3:
        sys.exit(f"expected exactly 3 negative magnitudes after restoration, found {len(negatives)}")

    out = []
    out.append("/*")
    out.append(" * The bright stars — a real catalog, carried in the repo.")
    out.append(" *")
    out.append(" * Source: the Astronomical Almanac's Bright Star List for epoch")
    out.append(" * 2016.5, derived from the Yale Bright Star Catalogue, 5th revised")
    out.append(" * edition (Hoffleit & Warren 1991; CDS catalogue V/50), as")
    out.append(" * distributed in the brettonw/YaleBrightStarCatalog repository")
    out.append(" * (Almanac-BrightStars-2016.txt, read 2026-11-23). Subset: every")
    out.append(" * star whose listed V magnitude is a single value <= 4.00; stars")
    out.append(" * listed with a magnitude range are not carried. Coordinates are")
    out.append(" * epoch 2016.5 (the Almanac list already carries precession and")
    out.append(" * proper motion to that epoch); CodexSkyEngine precesses from")
    out.append(" * 2016.5 to the moment of use and ignores proper motion, which")
    out.append(" * is below this layer's stated accuracy class for decades.")
    out.append(" *")
    out.append(" * Sign restoration: the distributed text drops the minus sign on")
    out.append(" * the list's only three negative magnitudes. The published")
    out.append(" * values are restored: Sirius (HR 2491) -1.46, Canopus (HR 2326)")
    out.append(" * -0.72, Arcturus (HR 5340) -0.04. See")
    out.append(" * scripts/build-bright-stars.py, which regenerates this file and")
    out.append(" * refuses to run if the source values differ from those printed")
    out.append(" * positives.")
    out.append(" *")
    out.append(" * Row shape: [hr, raDegrees, decDegrees, vMagnitude, designation, spectralType]")
    out.append(" */")
    out.append("(() => {")
    out.append('  "use strict";')
    out.append("")
    out.append("  const STARS = [")
    for hr, ra, dec, v, desig, spec in stars:
        desig_js = desig.replace("\\", "\\\\").replace('"', '\\"')
        spec_js = spec.replace("\\", "\\\\").replace('"', '\\"')
        out.append(f'    [{hr}, {ra:.4f}, {dec:.4f}, {v:.2f}, "{desig_js}", "{spec_js}"],')
    out.append("  ];")
    out.append("")
    out.append("  const catalog = Object.freeze({")
    out.append('    schemaVersion: "codex-bright-stars/1.0.0",')
    out.append('    sourceClass: "catalog",')
    out.append("    epoch: 2016.5,")
    out.append(f"    magnitudeLimit: {MAG_LIMIT:.2f},")
    out.append(f"    count: {len(stars)},")
    out.append('    credit: "Astronomical Almanac Bright Star List (epoch 2016.5), derived from the Yale Bright Star Catalogue, 5th revised ed. (Hoffleit & Warren 1991)",')
    out.append("    stars: Object.freeze(STARS.map((row) => Object.freeze(row))),")
    out.append("  });")
    out.append("")
    out.append("  globalThis.CodexBrightStars = catalog;")
    out.append("})();")
    out.append("")

    target = Path("docs/assets/js/astronomy/bright-stars.js")
    target.write_text("\n".join(out), encoding="utf-8")
    print(f"data lines parsed: {parsed}")
    print(f"excluded (range/garbled magnitude): {excluded_range}")
    print(f"subset V <= {MAG_LIMIT:.2f}: {len(stars)} stars")
    print(f"brightest: {sorted(stars, key=lambda s: s[3])[:5]}")
    print(f"wrote {target} ({target.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
