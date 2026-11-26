"use strict";

/**
 * Read Your Own Day — the guided practice.
 *
 * The fences these tests hold:
 *  (a) Every Living Time value the practice displays equals the
 *      temporal authority's own summary (PatternCalendar) — for
 *      Aaron's canonical fixtures and for the run date itself.
 *  (b) No hard-coded dates: the module and the page carry no ISO
 *      date, no "Pattern Day <number>", no "Moon <number>" literal
 *      in code (comments stripped) — a hard-coded day would be a
 *      second clock, and this house keeps one.
 *  (c) The resume state round-trips through storage, clamps to
 *      the road, and degrades to a blank state on corrupt data —
 *      the Spark keeps your place, and only your place.
 *  (d) The doors point at the real surfaces: the Sphere page and
 *      Day Notes on the 13 Moons page (which carries the anchor).
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const scripts = [
  "docs/assets/js/calendar/pattern-calendar-version.js",
  "docs/assets/js/calendar/pattern-calendar-data.js",
  "docs/assets/js/calendar/pattern-calendar-format.js",
  "docs/assets/js/calendar/pattern-calendar-boundary.js",
  "docs/assets/js/calendar/pattern-calendar.js",
  "docs/assets/js/read-your-own-day.js"
];

function loadPractice() {
  const context = { Date, Intl, URL, URLSearchParams, console };
  context.globalThis = context;
  context.window = context;
  scripts.forEach((script) => vm.runInNewContext(read(script), context));
  return context;
}

const ctx = loadPractice();
const { PatternCalendar, PatternCalendarData, ReadYourOwnDay } = ctx;

function summaryFor(iso) {
  return PatternCalendar.fromCivilDate({ date: iso, timeZone: "UTC", boundaryMode: "midnight" });
}

const plain = (value) => JSON.parse(JSON.stringify(value));

function figure(reading, label) {
  const found = reading.figures.find((entry) => entry.label === label);
  return found ? found.value : null;
}

test("fixture 2026-07-17: the reading repeats the authority — Moon 4, Day 8, Pattern Day 92", () => {
  const summary = summaryFor("2026-07-17");
  assert.deepEqual([summary.moon, summary.day, summary.dayOfPatternYear], [4, 8, 92]);
  const reading = ReadYourOwnDay.readingFor(summary, PatternCalendarData);
  assert.equal(reading.kind, "counted");
  assert.match(figure(reading, "Moon"), /Moon 4/);
  assert.match(figure(reading, "Day of the Moon"), /Day 8 of 28/);
  assert.match(figure(reading, "Pattern Day"), /Pattern Day 92 of 364/);
  assert.match(reading.headline, /Pattern Day 92 of 364/);
  assert.match(reading.sparkLine, /Pattern Day 92/);
});

test("fixture 2026-09-15: the reading repeats the authority — Moon 6, Day 12, Pattern Day 152", () => {
  const summary = summaryFor("2026-09-15");
  assert.deepEqual([summary.moon, summary.day, summary.dayOfPatternYear], [6, 12, 152]);
  const reading = ReadYourOwnDay.readingFor(summary, PatternCalendarData);
  assert.equal(reading.kind, "counted");
  assert.match(figure(reading, "Moon"), /Moon 6/);
  assert.match(figure(reading, "Pattern Day"), /Pattern Day 152 of 364/);
});

test("run date: every displayed figure is the authority's own value for today", () => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  const summary = PatternCalendar.fromCivilDate({ date: iso, timeZone, boundaryMode: "midnight" });
  const reading = ReadYourOwnDay.readingFor(summary, PatternCalendarData);
  assert.ok(reading, "a reading stands for the run date");
  if (summary.insideCountedYear) {
    assert.equal(figure(reading, "Moon"), "Moon " + summary.moon + " — " + summary.moonName);
    assert.equal(figure(reading, "Day of the Moon"), "Day " + summary.day + " of 28");
    assert.equal(
      figure(reading, "Pattern Day"),
      "Pattern Day " + summary.dayOfPatternYear + " of 364"
    );
    assert.equal(figure(reading, "Pattern Year"), "Year " + summary.patternYear);
  } else {
    assert.notEqual(reading.kind, "counted");
  }
});

test("the day outside the count is read honestly, not forced into a moon", () => {
  /* The Day Out of Time for the 2026 window: epoch + 364 days. */
  const anchor = PatternCalendar.epochForYear(2026);
  const dot = new Date(anchor.getTime() + 364 * 86400000);
  const iso = dot.toISOString().slice(0, 10);
  const summary = summaryFor(iso);
  assert.equal(summary.insideCountedYear, false, "the engine itself places " + iso + " outside the count");
  const reading = ReadYourOwnDay.readingFor(summary, PatternCalendarData);
  assert.equal(reading.kind, "day-out-of-time");
  assert.match(reading.sparkLine, /outside the count/);
  assert.equal(figure(reading, "Pattern Day"), null, "no Pattern Day is invented for it");
});

test("no hard-coded dates in the module or the page (comments stripped)", () => {
  const strip = (source) =>
    source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const sources = {
    "read-your-own-day.js": strip(read("docs/assets/js/read-your-own-day.js")),
    "read-your-own-day.html": strip(read("docs/read-your-own-day.html"))
  };
  for (const [name, source] of Object.entries(sources)) {
    assert.ok(!/\b20\d{2}-\d{2}-\d{2}\b/.test(source), name + " carries an ISO date literal");
    assert.ok(!/Pattern Day \d/.test(source), name + " carries a hard-coded Pattern Day");
    assert.ok(!/\bMoon \d/.test(source), name + " carries a hard-coded Moon number");
    assert.ok(
      !/\b(January|February|March|April|May|June|July|August|September|October|November|December) \d/.test(source),
      name + " carries a written-out date"
    );
  }
});

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key)
  };
}

test("resume state round-trips through storage", () => {
  const storage = fakeStorage();
  assert.deepEqual(plain(ReadYourOwnDay.loadState(storage)), { step: 0, done: false });

  ReadYourOwnDay.saveState(storage, { step: 2, done: false });
  assert.deepEqual(plain(ReadYourOwnDay.loadState(storage)), { step: 2, done: false });

  ReadYourOwnDay.saveState(storage, { step: 3, done: true });
  assert.deepEqual(plain(ReadYourOwnDay.loadState(storage)), { step: 3, done: true });

  ReadYourOwnDay.saveState(storage, ReadYourOwnDay.blankState());
  assert.deepEqual(plain(ReadYourOwnDay.loadState(storage)), { step: 0, done: false });
});

test("resume state clamps to the road and survives corrupt data", () => {
  const storage = fakeStorage();
  ReadYourOwnDay.saveState(storage, { step: 99, done: false });
  assert.equal(ReadYourOwnDay.loadState(storage).step, ReadYourOwnDay.STEPS.length - 1);

  storage.setItem(ReadYourOwnDay.STORAGE_KEY, "{not json");
  assert.deepEqual(plain(ReadYourOwnDay.loadState(storage)), { step: 0, done: false });

  storage.setItem(ReadYourOwnDay.STORAGE_KEY, JSON.stringify({ step: "two", done: "yes" }));
  assert.deepEqual(plain(ReadYourOwnDay.loadState(storage)), { step: 0, done: false });

  assert.deepEqual(plain(ReadYourOwnDay.loadState(null)), { step: 0, done: false });
});

test("the road is four steps, in order, and the Spark's lines carry no absence framing", () => {
  assert.deepEqual(
    plain(ReadYourOwnDay.STEPS.map((step) => step.id)),
    ["find", "see", "holds", "witness"]
  );
  const summary = summaryFor("2026-07-17");
  const reading = ReadYourOwnDay.readingFor(summary, PatternCalendarData);
  const lines = [
    ReadYourOwnDay.sparkLineFor("find", reading),
    ReadYourOwnDay.sparkLineFor("see", reading),
    ReadYourOwnDay.sparkLineFor("holds", reading),
    ReadYourOwnDay.sparkLineFor("witness", reading),
    ReadYourOwnDay.sparkLineFor("done", reading),
    ReadYourOwnDay.sparkLineFor("welcome", reading)
  ];
  for (const line of lines) {
    assert.ok(typeof line === "string" && line.length > 20, "every step has a real line");
    assert.ok(
      !/you (haven't|have not|didn't|did not|missed)|behind schedule|streak/i.test(line),
      "no absence framing in: " + line
    );
  }
  assert.match(ReadYourOwnDay.sparkLineFor("holds", reading), /any one touch/i);
});

test("the doors point at the real surfaces", () => {
  assert.equal(ReadYourOwnDay.SPHERE_HREF, "living-time-sphere.html");
  assert.ok(fs.existsSync(path.join(root, "docs", ReadYourOwnDay.SPHERE_HREF)));

  const [notesPage, anchor] = ReadYourOwnDay.DAY_NOTES_HREF.split("#");
  assert.equal(notesPage, "moons.html");
  const moons = read("docs/moons.html");
  assert.ok(
    new RegExp('id="' + anchor + '"').test(moons),
    "the Day Notes anchor stands on the 13 Moons page"
  );

  const page = read("docs/read-your-own-day.html");
  assert.match(page, /living-time-sphere\.html/, "the page doors to the Sphere");
  assert.match(page, /moons\.html#day-notes/, "the page doors to Day Notes");
  assert.match(moons, /read-your-own-day\.html/, "the 13 Moons page doors back to the practice");
  const home = read("docs/index.html");
  assert.match(home, /read-your-own-day\.html/, "the homepage (Today) doors to the practice");
});
