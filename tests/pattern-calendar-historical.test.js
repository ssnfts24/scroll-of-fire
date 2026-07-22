"use strict";

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
  "docs/assets/js/calendar/pattern-calendar.js"
];

function loadCalendar() {
  const context = { Date, Intl, URL, URLSearchParams };
  context.globalThis = context;
  context.window = context;
  scripts.forEach(script => vm.runInNewContext(read(script), context));
  return context.PatternCalendar;
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

function utcDate(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

test("historical conversion follows fixed April 17 counted-year model", () => {
  const calendar = loadCalendar();
  const years = [1600, 1700, 1800, 1900, 2000, 2024, 2025, 2026, 2027, 2100, 2400];

  for (const year of years) {
    const start = utcDate(year, 4, 17);
    const nextStart = utcDate(year + 1, 4, 17);
    const windowLength = Math.round((nextStart - start) / 86400000);

    const april16 = calendar.fromCivilDate({ date: `${year}-04-16`, timeZone: "UTC", boundaryMode: "midnight" });
    assert.equal(april16.insideCountedYear, false, `${year} April 16 should be intercalary`);

    const april17 = calendar.fromCivilDate({ date: `${year}-04-17`, timeZone: "UTC", boundaryMode: "midnight" });
    assert.equal(april17.insideCountedYear, true, `${year} April 17 must begin counted year`);
    assert.equal(april17.moon, 1);
    assert.equal(april17.day, 1);
    assert.equal(april17.dayOfPatternYear, 1);

    const day364Date = iso(new Date(start.getTime() + 363 * 86400000));
    const day364 = calendar.fromCivilDate({ date: day364Date, timeZone: "UTC", boundaryMode: "midnight" });
    assert.equal(day364.insideCountedYear, true, `${year} Day 364 should be inside counted year`);
    assert.equal(day364.moon, 13);
    assert.equal(day364.day, 28);
    assert.equal(day364.dayOfPatternYear, 364);

    const dayOutDate = iso(new Date(start.getTime() + 364 * 86400000));
    const dayOut = calendar.fromCivilDate({ date: dayOutDate, timeZone: "UTC", boundaryMode: "midnight" });
    assert.equal(dayOut.insideCountedYear, false, `${year} first intercalary day should be outside counted year`);
    assert.equal(dayOut.isDayOutOfTime, true);
    assert.equal(dayOut.intercalaryIndex, 1);

    if (windowLength === 366) {
      const deepDate = iso(new Date(start.getTime() + 365 * 86400000));
      const deep = calendar.fromCivilDate({ date: deepDate, timeZone: "UTC", boundaryMode: "midnight" });
      assert.equal(deep.insideCountedYear, false, `${year} leap window must include Deep Time Day`);
      assert.equal(deep.isDeepTimeDay, true);
      assert.equal(deep.intercalaryIndex, 2);
    }
  }
});
