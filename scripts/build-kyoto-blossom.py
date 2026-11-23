#!/usr/bin/env python3
"""
Build docs/assets/data/sphere-test-kyoto-blossom.json — the Kyoto
cherry-blossom full-flowering day-index pack for the Sphere's
Living test layer.

Sources (read 2026-11-23):
  1. Yasuyuki Aono's own workbook, "Full-flowering dates of
     Japanese cherry (Prunus jamasakura) at Kyoto, Japan"
     (KyotoFullFlower7.xls, latest version Jun. 12, 2012; the file's
     metadata names Yasuyuki AONO as author). Distributed from
     Aono's page at Osaka Prefecture University:
       http://atmenv.envi.osakafu-u.ac.jp/aono/kyophenotemp4/
     The university server did not answer on 2026-11-23; the file
     was read from the Internet Archive's snapshot of the same URL
     (web.archive.org, snapshot 2025-04-25). The workbook's single
     sheet is a text table: column A = year AD, column B = full-
     flowering day of year, column C = calendar date code
     (e.g. 402 = April 2), column D = source code (Taguchi 1939;
     Sekiguchi 1969; Aono & Omoto 1994; Aono & Kazui 2008; Aono &
     Saito 2010; Aono 2011; Aono 2012). The generator's input is a
     CSV transcription of those four columns, made by reading the
     workbook with xlrd — no value altered in transcription.
  2. Our World in Data's republication of the same dataset,
     "Date of the peak cherry tree blossom in Kyoto" (CC BY 4.0),
     grapher CSV read the same day. Aono's workbook ends at 2015;
     OWID continues the series to the present from Aono and his
     successor Genki Katata. The pack takes 2016 onward from OWID.

Decisions, made at ingestion and recorded here:
  * 1923: Aono's workbook says day 97 (April 7). OWID's current
    grapher CSV says 98 — a one-cell error in the republication,
    confirmed against Aono's own file and against two independent
    cleaned copies of the OWID series (both 97). The pack carries
    Aono's 97: the compiler's own hand outranks a copyist's slip.
  * Everywhere else the two sources agree exactly (827 recorded
    years in Aono 812–2015; 11 more from OWID 2016–2026; 838 in
    all, with 377 years of 812–2026 carrying no record — those
    years are simply absent from the pack, and the layer draws
    the absence as a gap, never as a bead).
  * The recorded date is stored as Aono published it (day of year
    + calendar month/day). The Pattern Day slot is computed from
    that published calendar date under proleptic Gregorian
    arithmetic, by the same day-difference the canonical
    PatternCalendar uses (days from the April 17 window start).
    Where Aono's day-of-year and his calendar date disagree under
    that arithmetic (Julian-era leap reckoning), the calendar
    date governs the slot and the published day-of-year is kept
    for the thread; the generator counts and reports such years.

Usage: python3 scripts/build-kyoto-blossom.py <aono-transcription.csv> <owid.csv>
Output: docs/assets/data/sphere-test-kyoto-blossom.json (written
beside the repo root — run from the repo root).
"""

import csv
import json
import sys
from datetime import date, timedelta
from pathlib import Path

FIRST_YEAR = 812


def shell_and_slot(d):
    """(shell year, day slot) by the canonical PatternCalendar
    arithmetic: the window opens April 17; counted days are slots
    1–364, then the Day Out of Time (365) and, in a 366-day
    window, the Deep Time Day (366)."""
    start = date(d.year, 4, 17)
    if d < start:
        start = date(d.year - 1, 4, 17)
    return start.year, (d - start).days + 1


def month_day_from_code(code):
    s = str(int(code))
    if len(s) == 3:
        return int(s[0]), int(s[1:])
    return int(s[:2]), int(s[2:])


def month_day_from_doy(year, doy):
    d = date(year, 1, 1) + timedelta(days=doy - 1)
    return d.month, d.day


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    aono_path, owid_path = sys.argv[1], sys.argv[2]

    records = {}  # civil year -> {doy, month, day, origin}
    with open(aono_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["doy"] == "":
                continue  # a year in the table with no record: a gap
            year = int(row["year"])
            doy = int(row["doy"])
            month, day = month_day_from_code(row["calendar_date_code"])
            records[year] = {"doy": doy, "month": month, "day": day, "origin": "aono"}

    tail = 0
    with open(owid_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            value = row["Day of the year with peak cherry blossom"]
            if not value:
                continue
            year = int(row["Year"])
            if year in records:
                continue  # Aono's own file governs where it speaks
            doy = int(float(value))
            month, day = month_day_from_doy(year, doy)
            records[year] = {"doy": doy, "month": month, "day": day, "origin": "owid-tail"}
            tail += 1

    years = sorted(y for y in records if y >= FIRST_YEAR)
    if len(years) != 838:
        sys.exit(f"FAIL: expected 838 recorded years, got {len(years)}")
    span = (years[0], years[-1])
    gaps = [y for y in range(span[0], span[1] + 1) if y not in records]
    if len(gaps) != 377:
        sys.exit(f"FAIL: expected 377 gap years, got {len(gaps)}")

    doy_mismatch = 0
    packed = []
    for year in years:
        rec = records[year]
        civil = date(year, rec["month"], rec["day"])
        if (civil - date(year, 1, 1)).days + 1 != rec["doy"]:
            doy_mismatch += 1
        shell, slot = shell_and_slot(civil)
        packed.append([year, rec["doy"], rec["month"], rec["day"], shell, slot])

    pack = {
        "layer": "kyoto-blossom",
        "version": 1,
        "kind": "annual-points",
        "class": "recorded",
        "source": "Kyoto cherry-blossom full flowering, recorded 812–present — Yasuyuki Aono (Osaka Prefecture University), via Our World in Data (CC BY 4.0)",
        "sourceDetail": "Aono's own workbook KyotoFullFlower7.xls (2012) for 812–2015; Our World in Data's continuation of the same dataset for 2016–2026. Read 2026-11-23.",
        "read": "2026-11-23",
        "span": [span[0], span[1]],
        "recordedYears": len(packed),
        "gapYears": len(gaps),
        "fields": ["civilYear", "dayOfYear", "month", "day", "shellYear", "patternSlot"],
        "records": packed,
    }

    out = Path("docs/assets/data/sphere-test-kyoto-blossom.json")
    out.write_text(json.dumps(pack, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size} bytes)")
    print(f"records: {len(packed)}  span: {span[0]}–{span[1]}  gaps: {len(gaps)}  owid tail years: {tail}")
    print(f"doy/calendar-date mismatches under proleptic Gregorian arithmetic: {doy_mismatch} (calendar date governs the slot)")
    print(f"earliest bloom: {min(packed, key=lambda r: r[1])}  latest bloom: {max(packed, key=lambda r: r[1])}")


if __name__ == "__main__":
    main()
