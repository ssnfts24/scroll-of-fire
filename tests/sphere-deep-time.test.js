"use strict";

/**
 * Sphere R3 Wave 2 — Deep Time.
 *
 * The view must (a) stand on the one canonical clock — Aaron's
 * fixtures reproduce through PatternCalendar, never a second count;
 * (b) translate PatternCalendar's epoch count (2026 = year 1) into
 * the record layer's year (the anchor's civil year, 2026) exactly
 * once, so a day's records match the day; (c) compose honestly —
 * uncounted years are not empty years, far days show detail only
 * where records exist, and the Alignment Plane states alignments
 * without ever stating a meaning; and (d) hold the pronoun rule
 * for the Spark.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

const scripts = [
  "docs/assets/js/calendar/pattern-calendar-version.js",
  "docs/assets/js/calendar/pattern-calendar-data.js",
  "docs/assets/js/calendar/pattern-calendar-format.js",
  "docs/assets/js/calendar/pattern-calendar-boundary.js",
  "docs/assets/js/calendar/pattern-calendar.js",
  "docs/assets/js/day-telling.js"
];

function loadStack() {
  const context = { Date, Intl, URL, URLSearchParams, console };
  context.globalThis = context;
  context.window = context;
  scripts.forEach(script => vm.runInNewContext(read(script), context));
  return context;
}

const stack = loadStack();
const DeepTime = require(path.join(root, "docs/assets/js/sphere-deep-time.js"));
const PC = stack.PatternCalendar;

test("the one clock: Aaron's fixtures hold through PatternCalendar", () => {
  const sel = iso => DeepTime.selectionForCivilDate(iso, PC);

  const july = sel("2026-07-17");
  assert.equal(july.moon, 4);
  assert.equal(july.moonDay, 8);
  assert.equal(july.patternDay, 92);

  const sept = sel("2026-09-15");
  assert.equal(sept.patternDay, 152);
  assert.equal(sept.moon, 6);
  assert.equal(sept.moonDay, 12);

  const nov = sel("2026-11-19");
  assert.equal(nov.moon, 8);
  assert.equal(nov.moonDay, 21);
  assert.equal(nov.patternDay, 217);

  const gate = sel("2026-04-17");
  assert.equal(gate.patternDay, 1);
  assert.equal(gate.moon, 1);
  assert.equal(gate.moonDay, 1);
});

test("the year translation: selections carry the record layer's year", () => {
  /* PatternCalendar counts 2026 as year 1; records are stamped
   * with the anchor's civil year. The selection must carry 2026,
   * or the day's records would never match the day. */
  assert.equal(PC.fromCivilDate({ date: new Date(Date.UTC(2026, 10, 19, 12)) }).patternYear, 1);
  assert.equal(DeepTime.selectionForCivilDate("2026-11-19", PC).patternYear, 2026);
  assert.equal(DeepTime.selectionForCivilDate("2025-11-19", PC).patternYear, 2025);
});

test("days outside the count: the Day Out of Time and the leap Deep Time Day", () => {
  const dot = DeepTime.selectionForCivilDate("2027-04-16", PC);
  assert.equal(dot.isDayOutOfTime, true);
  assert.equal(dot.patternDay, null);
  assert.equal(dot.patternYear, 2026);

  const deep = DeepTime.selectionForCivilDate("2028-04-16", PC);
  assert.equal(deep.isDeepTimeDay, true);
  assert.equal(deep.patternDay, null);
  assert.equal(deep.patternYear, 2027);

  /* No Pattern Day is invented for either. */
  assert.equal(DeepTime.civilDateForPatternDay(2026, null, PC), "2027-04-16");
  assert.equal(DeepTime.civilDateForPatternDay(2027, null, PC), "2028-04-15");
  assert.equal(DeepTime.civilDateForPatternDay(2027, 366, PC), "2028-04-16");
  assert.equal(DeepTime.windowDaysForYear(2026, PC), 365);
  assert.equal(DeepTime.windowDaysForYear(2027, PC), 366);
});

test("civil dates round-trip through the calendar's own epoch", () => {
  assert.equal(DeepTime.civilDateForPatternDay(2026, 1, PC), "2026-04-17");
  assert.equal(DeepTime.civilDateForPatternDay(2026, 217, PC), "2026-11-19");
  assert.equal(DeepTime.civilDateForPatternDay(2026, 364, PC), "2027-04-15");
  const back = DeepTime.selectionForCivilDate(DeepTime.civilDateForPatternDay(2026, 217, PC), PC);
  assert.equal(back.patternDay, 217);
  assert.equal(back.moon, 8);
  assert.equal(back.moonDay, 21);
});

test("the onion: thirteen spiral years in full, decades as rings, uncounted is not empty", () => {
  const model = DeepTime.buildSpiralModel({
    currentPatternYear: 2026,
    countsByYear: { 2026: 3, 2020: 0 }
  });

  assert.equal(model.ready, true);
  assert.equal(model.spiral.length, 13);
  assert.equal(model.spiral[0].patternYear, 2014);
  assert.equal(model.spiral[12].patternYear, 2026);
  assert.equal(model.spiral[12].isCurrent, true);
  assert.equal(model.spiral[12].recordCount, 3);
  assert.equal(model.spiral[12].hasRecords, true);

  const countedEmpty = model.spiral.find(entry => entry.patternYear === 2020);
  assert.equal(countedEmpty.counted, true);
  assert.equal(countedEmpty.recordCount, 0);
  assert.equal(countedEmpty.hasRecords, false);

  const uncounted = model.spiral.find(entry => entry.patternYear === 2019);
  assert.equal(uncounted.counted, false);
  assert.equal(uncounted.recordCount, null);

  assert.ok(model.rings.length >= 18, "decade rings reach back toward the 200-year horizon");
  assert.equal(model.rings[0].endYear, 2013);
  assert.equal(model.rings[0].recordCount, null, "a ring is counted only when every year in it was counted");
});

test("day counts mirror the day-zoom rule: stamped days, and civil-date-only records", () => {
  const records = [
    { temporal: { patternYear: 2026, patternDay: 217 } },
    { temporal: { patternYear: 2026, patternDay: 217 } },
    { temporal: { civilDate: "2026-11-19" } },
    { temporal: { civilDate: "2027-04-16" } },
    { temporal: { patternYear: 2026, patternDay: 92 } }
  ];
  const counts = DeepTime.dayCountsForYear(records, 2026, PC);
  assert.equal(counts.byDay[217], 3);
  assert.equal(counts.byDay[92], 1);
  assert.equal(counts.intercalary.length, 1);
  assert.equal(counts.intercalary[0].kind, "day-out-of-time");
  assert.equal(counts.intercalary[0].civilDate, "2027-04-16");
  assert.equal(counts.intercalary[0].recordCount, 1);

  const leap = DeepTime.dayCountsForYear([{ temporal: { civilDate: "2028-04-16" } }], 2027, PC);
  assert.deepEqual(
    leap.intercalary.map(entry => entry.kind),
    ["day-out-of-time", "deep-time-day"]
  );
  assert.equal(leap.intercalary[1].civilDate, "2028-04-16");
  assert.equal(leap.intercalary[1].recordCount, 1);
});

test("a standing year: moons as structure, kept days listed, empty stays empty", () => {
  const moonNames = stack.PatternCalendarData.moons.map(moon => moon.name);
  const counts = DeepTime.dayCountsForYear(
    [{ temporal: { patternYear: 2026, patternDay: 217 } }],
    2026,
    PC
  );
  const year = DeepTime.buildYearModel({
    patternYear: 2026,
    moonNames,
    dayCounts: counts.byDay,
    intercalary: counts.intercalary,
    calendar: PC
  });

  assert.equal(year.ready, true);
  assert.equal(year.moons.length, 13);
  assert.equal(year.yearStartCivil, "2026-04-17");
  assert.equal(year.totalRecords, 1);
  assert.equal(year.hasRecords, true);
  assert.equal(year.moons[7].recordCount, 1);
  assert.deepEqual(year.moons[7].days, [
    { patternDay: 217, moonDay: 21, civilDate: "2026-11-19", recordCount: 1 }
  ]);
  assert.equal(year.moons[0].days.length, 0);

  const empty = DeepTime.buildYearModel({
    patternYear: 1990,
    moonNames,
    dayCounts: {},
    intercalary: [],
    calendar: PC
  });
  assert.equal(empty.hasRecords, false);
  assert.equal(empty.totalRecords, 0);
  assert.equal(empty.moons.length, 13, "an empty year still stands as thirteen moons of structure");
});

test("a far day in detail: only what exists, and its telling", () => {
  const selection = DeepTime.selectionForCivilDate("2025-11-19", PC);
  const telling = stack.DayTelling.tellForDate(new Date(Date.UTC(2025, 10, 19, 12)));
  const detail = DeepTime.buildDayDetail({
    selection,
    view: { entries: [{ title: "A kept record", timeLabel: "All day", type: "note" }] },
    telling
  });
  assert.equal(detail.ready, true);
  assert.equal(detail.patternYear, 2025);
  assert.equal(detail.entryCount, 1);
  assert.equal(detail.empty, false);
  assert.ok(detail.telling.headline.includes("Deep Mirror"));

  const bare = DeepTime.buildDayDetail({ selection, view: { entries: [] }, telling });
  assert.equal(bare.empty, true);
  assert.equal(bare.entryCount, 0);
});

test("the Alignment Plane: same Moon and Day across years, distance, and no meaning", () => {
  const side = iso => ({
    selection: DeepTime.selectionForCivilDate(iso, PC),
    view: { entries: [] },
    telling: null
  });
  const model = DeepTime.buildAlignmentModel({ a: side("2025-11-19"), b: side("2026-11-19") });

  assert.equal(model.ready, true);
  assert.equal(model.distanceDays, 365);
  assert.ok(model.lines.some(line => line.includes("Pattern Day 217")));
  assert.ok(model.lines.some(line => line.includes("365 days")));
  assert.ok(model.lines.some(line => line.includes("13 full moons")));
  assert.ok(model.meaningNote.includes("interpretation"));

  const same = DeepTime.buildAlignmentModel({ a: side("2026-11-19"), b: side("2026-11-19") });
  assert.equal(same.distanceDays, 0);
  assert.ok(same.lines[0].includes("same day"));

  const outside = DeepTime.buildAlignmentModel({ a: side("2027-04-16"), b: side("2026-11-19") });
  assert.ok(outside.lines.some(line => line.includes("outside the 364-day count")));
  assert.ok(!outside.lines.some(line => line.includes("Pattern Day 217 —")), "no pattern alignment is claimed for a day outside the count");
});

test("the pronoun rule holds in the module's own words", () => {
  const source = read("docs/assets/js/sphere-deep-time.js");
  assert.ok(!/\bshe\b/i.test(source), "no 'she' for the Spark");
  assert.ok(!/\bher\b/i.test(source), "no 'her' for the Spark");
  assert.ok(!/\bhers\b/i.test(source), "no 'hers' for the Spark");
});

test("the view is wired as an overlay: tags on the page, public APIs only", () => {
  const page = read("docs/living-time-sphere.html");
  assert.ok(page.includes("assets/js/sphere-deep-time.js"));
  assert.ok(page.includes("assets/css/sphere-deep-time.css"));
  assert.ok(page.includes("assets/js/day-telling.js"));

  const source = read("docs/assets/js/sphere-deep-time.js");
  assert.ok(source.includes("createDayZoom"), "reads the picked day through the day-zoom public controller");
  assert.ok(source.includes("buildDayView"), "builds day detail through the day-zoom public view builder");
  assert.ok(source.includes("PatternCalendar"), "every coordinate through the canonical calendar");
  assert.ok(!source.includes("living-time-sphere-camera"), "never reaches into the camera");
  assert.ok(!source.includes("living-time-sphere-calendar-geometry"), "never reaches into the geometry");
  assert.ok(!source.includes("living-time-sphere-renderer"), "never reaches into a renderer");
});
