#!/usr/bin/env python3
"""
Build docs/assets/data/sphere-test-salmon-bonneville.json — the
Bonneville Dam salmon-passage day-index pack for the Sphere's
Water test layer.

Source (read 2026-11-23): Columbia River DART, Columbia Basin
Research, University of Washington — Adult Passage Daily Counts
(https://www.cbr.washington.edu/dart/query/adult_daily), counts
by the U.S. Army Corps of Engineers. One CSV per calendar year
from DART's own query endpoint:
  https://www.cbr.washington.edu/dart/cs/php/rpt/adult_daily.php
    ?proj=BON&span=no&year=<YYYY>&startdate=1/1&enddate=12/31
    &outputFormat=csv
Data citation, as DART asks: Columbia River DART, Columbia Basin
Research, University of Washington. (2026). Adult Passage Daily
Counts. Data courtesy of the U.S. Army Corps of Engineers.

Span, verified at ingestion: DART labels Bonneville "[1938]" —
1938 was the dam's first counting year — but its daily-count
query serves no 1938 rows (the year list begins at 1939 and a
1938 query redirects away empty). The pack therefore spans
1939–2026, one year shorter than the census's "from 1938" —
recorded here, not smoothed over.

What the pack holds, and what it refuses:
  * Four adult runs, as DART's columns name them: Chinook (Chin),
    steelhead (Stlhd — the total; the wild-steelhead column is a
    subset of it and is not double-counted), sockeye (Sock),
    coho (Coho). Jacks (JChin, JCoho) are immature fish and are
    not in the pack; shad, lamprey, bull trout, chum and pink are
    outside this layer's commission.
  * A day enters the pack only where DART prints a number for
    that species (zero included — a counted zero is a record).
    An empty cell means no count was made or reported for that
    species that day (outside the counting season, above all in
    the early decades, when counting ran roughly mid-March to
    mid-November): the day is absent, and the layer draws the
    absence as a gap, never as a zero.
  * Negative daily values stand as published. They are the
    counters' own corrections (fish counted back downstream);
    the pack does not launder them into zeroes.
  * Each civil date is converted to the Sphere's day-index —
    (shell year, Pattern Day slot) — by the same day-difference
    the canonical PatternCalendar uses: the window opens
    April 17; counted days are slots 1–364, then the Day Out of
    Time (365) and, in a 366-day window, the Deep Time Day (366).
    Totals are per shell year, summed from the packed days, and
    are named as the Sphere's year (April–April) wherever the
    layer speaks them.

Usage: python3 scripts/build-salmon-bonneville.py [year-dir]
With no argument the script downloads each year's CSV from DART
itself (politely, one at a time). With a directory argument it
reads dart-bon-<YYYY>.csv files from there instead.
Output: docs/assets/data/sphere-test-salmon-bonneville.json
(run from the repo root).
"""

import csv
import io
import json
import sys
import time
import urllib.request
from datetime import date
from pathlib import Path

FIRST_YEAR = 1939
LAST_YEAR = 2026
URL = ("https://www.cbr.washington.edu/dart/cs/php/rpt/adult_daily.php"
       "?proj=BON&span=no&year={year}&startdate=1/1&enddate=12/31&outputFormat=csv")
SPECIES = {  # DART column -> pack key, label
    "Chin": ("chinook", "Chinook"),
    "Stlhd": ("steelhead", "Steelhead"),
    "Sock": ("sockeye", "Sockeye"),
    "Coho": ("coho", "Coho"),
}


def shell_and_slot(d):
    start = date(d.year, 4, 17)
    if d < start:
        start = date(d.year - 1, 4, 17)
    return start.year, (d - start).days + 1


def fetch_year(year):
    req = urllib.request.Request(URL.format(year=year), headers={"User-Agent": "codex-sphere-test-layer-ingest/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8", errors="replace")


def parse_year(text, year):
    """Return {species_key: {(shell, slot): count}} for one DART CSV."""
    found = {}
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None or "Date" not in reader.fieldnames:
        raise ValueError(f"{year}: no Date column in DART reply")
    for col in SPECIES:
        if col not in reader.fieldnames:
            raise ValueError(f"{year}: DART reply lacks the {col} column")
    for row in reader:
        raw_date = (row.get("Date") or "").strip()
        try:
            civil = date.fromisoformat(raw_date)
        except ValueError:
            continue  # the totals block and repeated headers end here
        if civil.year != year:
            continue
        shell, slot = shell_and_slot(civil)
        for col, (key, _label) in SPECIES.items():
            cell = (row.get(col) or "").strip()
            if cell == "":
                continue  # no count made/reported: absence, not zero
            found.setdefault(key, {})[(shell, slot)] = int(cell)
    return found


def main():
    year_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    merged = {}  # species key -> {(shell, slot): count}
    for year in range(FIRST_YEAR, LAST_YEAR + 1):
        if year_dir:
            text = (year_dir / f"dart-bon-{year}.csv").read_text(encoding="utf-8", errors="replace")
        else:
            text = fetch_year(year)
            time.sleep(0.3)
        found = parse_year(text, year)
        if not found:
            raise ValueError(f"{year}: DART reply held no counts at all")
        for key, days in found.items():
            clash = set(merged.get(key, {})) & set(days)
            if clash:
                raise ValueError(f"{key}: duplicate day-indexes from {year}: {sorted(clash)[:3]}")
            merged.setdefault(key, {}).update(days)
        print(f"{year}: " + ", ".join(f"{k} {len(v)}" for k, v in sorted(found.items())))

    species_pack = {}
    for col, (key, label) in SPECIES.items():
        days = merged.get(key, {})
        years = {}
        totals = {}
        for (shell, slot), count in sorted(days.items()):
            years.setdefault(str(shell), []).append([slot, count])
            totals[str(shell)] = totals.get(str(shell), 0) + count
        species_pack[key] = {
            "label": label,
            "column": col,
            "days": len(days),
            "years": years,
            "totals": totals,
        }
        print(f"{label}: {len(days)} counted days, shell years {min(map(int, years))}–{max(map(int, years))}")

    pack = {
        "layer": "salmon-bonneville",
        "version": 1,
        "kind": "daily-counts",
        "class": "counted",
        "source": "Salmon passage at Bonneville Dam, counted by the U.S. Army Corps of Engineers, via Columbia River DART (Columbia Basin Research, University of Washington)",
        "sourceDetail": "DART Adult Passage Daily Counts, one CSV per calendar year from DART's query endpoint. Read 2026-11-23. DART labels Bonneville [1938] but serves no 1938 daily rows; the pack spans 1939–2026.",
        "read": "2026-11-23",
        "civilSpan": [FIRST_YEAR, LAST_YEAR],
        "speciesOrder": [SPECIES[c][0] for c in SPECIES],
        "species": species_pack,
    }

    out = Path("docs/assets/data/sphere-test-salmon-bonneville.json")
    out.write_text(json.dumps(pack, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
