"use strict";

/**
 * spark-schedule-authority-equivalence.test.js — D-01 (ULS-001
 * claims check, Nov 25, 2026): the scheduling core must hold no
 * calendar arithmetic of its own. Its Pattern⇄civil conversions
 * are PatternCalendar's, asked at call time.
 *
 * Two proofs, either of which fails the build on drift:
 *
 * 1. LITERAL PINS. The tables below were generated from the core
 *    as it stood before the authority refactor (main 172851b3,
 *    when the core still carried its private epoch rule). Every
 *    named fixture — Pattern Days 1/92/152/217/223/364, the Day
 *    Out of Time, the leap window's Deep Time position, civil
 *    dates before and after the April 17 anchor — must reproduce
 *    exactly. The refactor changes where the arithmetic lives,
 *    never what it answers.
 *
 * 2. THE AUTHORITY SWEEP. For every civil day across four anchor
 *    windows, the core's stamp must equal the stamp derived
 *    directly from PatternCalendar (loaded independently, the
 *    vectors-test way), and civilDateForPatternDay must equal
 *    the authority's own epoch plus the day offset. If the two
 *    ever disagree, one of them moved — and only one may.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const Core = require(path.join(ROOT, "docs/assets/js/spark-schedule-core.js"));

function loadAuthority() {
  const context = { Date, Intl, URL, URLSearchParams };
  context.globalThis = context;
  context.window = context;
  for (const script of [
    "docs/assets/js/calendar/pattern-calendar-version.js",
    "docs/assets/js/calendar/pattern-calendar-data.js",
    "docs/assets/js/calendar/pattern-calendar-format.js",
    "docs/assets/js/calendar/pattern-calendar-boundary.js",
    "docs/assets/js/calendar/pattern-calendar.js",
  ]) vm.runInNewContext(read(script), context);
  return context.PatternCalendar;
}
const PatternCalendar = loadAuthority();

const PINS = {
 "cdfpd": {
  "2023:1": "2023-04-17",
  "2023:92": "2023-07-17",
  "2023:152": "2023-09-15",
  "2023:217": "2023-11-19",
  "2023:223": "2023-11-25",
  "2023:364": "2024-04-14",
  "2023:365": "2024-04-15",
  "2023:366": "2024-04-16",
  "2023:0": null,
  "2023:367": null,
  "2024:1": "2024-04-17",
  "2024:92": "2024-07-17",
  "2024:152": "2024-09-15",
  "2024:217": "2024-11-19",
  "2024:223": "2024-11-25",
  "2024:364": "2025-04-15",
  "2024:365": "2025-04-16",
  "2024:366": "2025-04-17",
  "2024:0": null,
  "2024:367": null,
  "2025:1": "2025-04-17",
  "2025:92": "2025-07-17",
  "2025:152": "2025-09-15",
  "2025:217": "2025-11-19",
  "2025:223": "2025-11-25",
  "2025:364": "2026-04-15",
  "2025:365": "2026-04-16",
  "2025:366": "2026-04-17",
  "2025:0": null,
  "2025:367": null,
  "2026:1": "2026-04-17",
  "2026:92": "2026-07-17",
  "2026:152": "2026-09-15",
  "2026:217": "2026-11-19",
  "2026:223": "2026-11-25",
  "2026:364": "2027-04-15",
  "2026:365": "2027-04-16",
  "2026:366": "2027-04-17",
  "2026:0": null,
  "2026:367": null,
  "2027:1": "2027-04-17",
  "2027:92": "2027-07-17",
  "2027:152": "2027-09-15",
  "2027:217": "2027-11-19",
  "2027:223": "2027-11-25",
  "2027:364": "2028-04-14",
  "2027:365": "2028-04-15",
  "2027:366": "2028-04-16",
  "2027:0": null,
  "2027:367": null,
  "2028:1": "2028-04-17",
  "2028:92": "2028-07-17",
  "2028:152": "2028-09-15",
  "2028:217": "2028-11-19",
  "2028:223": "2028-11-25",
  "2028:364": "2029-04-15",
  "2028:365": "2029-04-16",
  "2028:366": "2029-04-17",
  "2028:0": null,
  "2028:367": null
 },
 "stamps": {
  "2025-04-16": {
   "civilDate": "2025-04-16",
   "anchorYear": 2024,
   "patternYear": 2024,
   "patternDay": 365,
   "moon": null,
   "day": null,
   "outsideDay": true
  },
  "2025-04-17": {
   "civilDate": "2025-04-17",
   "anchorYear": 2025,
   "patternYear": 2025,
   "patternDay": 1,
   "moon": 1,
   "day": 1,
   "outsideDay": false
  },
  "2026-01-01": {
   "civilDate": "2026-01-01",
   "anchorYear": 2025,
   "patternYear": 2025,
   "patternDay": 260,
   "moon": 10,
   "day": 8,
   "outsideDay": false
  },
  "2026-04-16": {
   "civilDate": "2026-04-16",
   "anchorYear": 2025,
   "patternYear": 2025,
   "patternDay": 365,
   "moon": null,
   "day": null,
   "outsideDay": true
  },
  "2026-04-17": {
   "civilDate": "2026-04-17",
   "anchorYear": 2026,
   "patternYear": 2026,
   "patternDay": 1,
   "moon": 1,
   "day": 1,
   "outsideDay": false
  },
  "2026-07-17": {
   "civilDate": "2026-07-17",
   "anchorYear": 2026,
   "patternYear": 2026,
   "patternDay": 92,
   "moon": 4,
   "day": 8,
   "outsideDay": false
  },
  "2026-09-15": {
   "civilDate": "2026-09-15",
   "anchorYear": 2026,
   "patternYear": 2026,
   "patternDay": 152,
   "moon": 6,
   "day": 12,
   "outsideDay": false
  },
  "2026-11-23": {
   "civilDate": "2026-11-23",
   "anchorYear": 2026,
   "patternYear": 2026,
   "patternDay": 221,
   "moon": 8,
   "day": 25,
   "outsideDay": false
  },
  "2026-11-24": {
   "civilDate": "2026-11-24",
   "anchorYear": 2026,
   "patternYear": 2026,
   "patternDay": 222,
   "moon": 8,
   "day": 26,
   "outsideDay": false
  },
  "2026-11-25": {
   "civilDate": "2026-11-25",
   "anchorYear": 2026,
   "patternYear": 2026,
   "patternDay": 223,
   "moon": 8,
   "day": 27,
   "outsideDay": false
  },
  "2026-12-31": {
   "civilDate": "2026-12-31",
   "anchorYear": 2026,
   "patternYear": 2026,
   "patternDay": 259,
   "moon": 10,
   "day": 7,
   "outsideDay": false
  },
  "2027-04-15": {
   "civilDate": "2027-04-15",
   "anchorYear": 2026,
   "patternYear": 2026,
   "patternDay": 364,
   "moon": 13,
   "day": 28,
   "outsideDay": false
  },
  "2027-04-16": {
   "civilDate": "2027-04-16",
   "anchorYear": 2026,
   "patternYear": 2026,
   "patternDay": 365,
   "moon": null,
   "day": null,
   "outsideDay": true
  },
  "2027-04-17": {
   "civilDate": "2027-04-17",
   "anchorYear": 2027,
   "patternYear": 2027,
   "patternDay": 1,
   "moon": 1,
   "day": 1,
   "outsideDay": false
  },
  "2028-02-29": {
   "civilDate": "2028-02-29",
   "anchorYear": 2027,
   "patternYear": 2027,
   "patternDay": 319,
   "moon": 12,
   "day": 11,
   "outsideDay": false
  },
  "2028-04-14": {
   "civilDate": "2028-04-14",
   "anchorYear": 2027,
   "patternYear": 2027,
   "patternDay": 364,
   "moon": 13,
   "day": 28,
   "outsideDay": false
  },
  "2028-04-15": {
   "civilDate": "2028-04-15",
   "anchorYear": 2027,
   "patternYear": 2027,
   "patternDay": 365,
   "moon": null,
   "day": null,
   "outsideDay": true
  },
  "2028-04-16": {
   "civilDate": "2028-04-16",
   "anchorYear": 2027,
   "patternYear": 2027,
   "patternDay": 366,
   "moon": null,
   "day": null,
   "outsideDay": true
  },
  "2028-04-17": {
   "civilDate": "2028-04-17",
   "anchorYear": 2028,
   "patternYear": 2028,
   "patternDay": 1,
   "moon": 1,
   "day": 1,
   "outsideDay": false
  },
  "2024-02-29": {
   "civilDate": "2024-02-29",
   "anchorYear": 2023,
   "patternYear": 2023,
   "patternDay": 319,
   "moon": 12,
   "day": 11,
   "outsideDay": false
  },
  "2024-04-16": {
   "civilDate": "2024-04-16",
   "anchorYear": 2023,
   "patternYear": 2023,
   "patternDay": 366,
   "moon": null,
   "day": null,
   "outsideDay": true
  },
  "2023-04-17": {
   "civilDate": "2023-04-17",
   "anchorYear": 2023,
   "patternYear": 2023,
   "patternDay": 1,
   "moon": 1,
   "day": 1,
   "outsideDay": false
  },
  "2029-04-17": {
   "civilDate": "2029-04-17",
   "anchorYear": 2029,
   "patternYear": 2029,
   "patternDay": 1,
   "moon": 1,
   "day": 1,
   "outsideDay": false
  }
 },
 "anchors": {
  "2025-04-16": 2024,
  "2025-04-17": 2025,
  "2026-01-01": 2025,
  "2026-04-16": 2025,
  "2026-04-17": 2026,
  "2026-07-17": 2026,
  "2026-09-15": 2026,
  "2026-11-23": 2026,
  "2026-11-24": 2026,
  "2026-11-25": 2026,
  "2026-12-31": 2026,
  "2027-04-15": 2026,
  "2027-04-16": 2026,
  "2027-04-17": 2027,
  "2028-02-29": 2027,
  "2028-04-14": 2027,
  "2028-04-15": 2027,
  "2028-04-16": 2027,
  "2028-04-17": 2028,
  "2024-02-29": 2023,
  "2024-04-16": 2023,
  "2023-04-17": 2023,
  "2029-04-17": 2029
 }
};

test("literal pins: civilDateForPatternDay reproduces the pre-refactor table", () => {
  for (const [key, want] of Object.entries(PINS.cdfpd)) {
    const [y, pd] = key.split(":").map(Number);
    assert.equal(Core.civilDateForPatternDay(y, pd), want, `civilDateForPatternDay(${y}, ${pd})`);
  }
});

test("literal pins: stampForCivil and anchorYearForCivil reproduce the pre-refactor table", () => {
  for (const [iso, want] of Object.entries(PINS.stamps)) {
    assert.deepEqual(Core.stampForCivil(iso), want, `stampForCivil(${iso})`);
    assert.equal(Core.anchorYearForCivil(iso), PINS.anchors[iso], `anchorYearForCivil(${iso})`);
  }
});

test("the house fixtures stand: PD 92, PD 152, PD 221-223 of the 2026 anchor", () => {
  assert.equal(Core.stampForCivil("2026-07-17").patternDay, 92);
  assert.equal(Core.stampForCivil("2026-09-15").patternDay, 152);
  assert.equal(Core.stampForCivil("2026-11-23").patternDay, 221);
  assert.equal(Core.stampForCivil("2026-11-24").patternDay, 222);
  assert.equal(Core.stampForCivil("2026-11-25").patternDay, 223);
  const doot = Core.stampForCivil("2027-04-16");
  assert.equal(doot.patternDay, 365);
  assert.equal(doot.outsideDay, true);
  assert.equal(Core.dayWords(doot), "the Day Out of Time");
  const deep = Core.stampForCivil("2024-04-16");
  assert.equal(deep.anchorYear, 2023, "the 2023 window is the leap window (it holds Feb 29, 2024)");
  assert.equal(deep.patternDay, 366);
  assert.equal(deep.outsideDay, true);
});

test("authority sweep: every civil day in four windows, core stamp == authority stamp", () => {
  const DAY = 86400000;
  for (let ms = Date.UTC(2025, 3, 1); ms <= Date.UTC(2029, 4, 1); ms += DAY) {
    const iso = new Date(ms).toISOString().slice(0, 10);
    const s = PatternCalendar.fromCivilDate({ date: new Date(ms), timeZone: "UTC", boundaryMode: "midnight" });
    const stamp = Core.stampForCivil(iso);
    assert.ok(stamp, iso);
    assert.equal(stamp.anchorYear, s.anchorDate.getUTCFullYear(), iso);
    assert.equal(stamp.patternDay, s.insideCountedYear ? s.dayOfPatternYear : 364 + s.intercalaryIndex, iso);
    assert.equal(stamp.outsideDay, !s.insideCountedYear, iso);
    assert.equal(stamp.moon, s.moon, iso);
    assert.equal(stamp.day, s.day, iso);
  }
});

test("authority sweep: civilDateForPatternDay is the authority epoch plus the offset", () => {
  const DAY = 86400000;
  for (let y = 2023; y <= 2028; y += 1) {
    for (let pd = 1; pd <= 366; pd += 1) {
      const want = new Date(PatternCalendar.epochForYear(y).getTime() + (pd - 1) * DAY).toISOString().slice(0, 10);
      assert.equal(Core.civilDateForPatternDay(y, pd), want, `civilDateForPatternDay(${y}, ${pd})`);
    }
  }
});

test("the core names its authority: the duplication is gone from the source", () => {
  const source = read("docs/assets/js/spark-schedule-core.js");
  assert.match(source, /PatternCalendar/, "the core must route through PatternCalendar");
  assert.doesNotMatch(source, /Date\.UTC\(y, 3, 17\)/, "the private April 17 epoch must not survive");
  assert.doesNotMatch(source, />= "04-17"/, "the private anchor comparison must not survive");
});
