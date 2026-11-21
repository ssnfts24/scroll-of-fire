"use strict";

/**
 * Day Telling: the plain-language reading generated from the canonical
 * PatternCalendar. The module must (a) reproduce Aaron's canonical
 * fixtures as facts, (b) keep arithmetic (position/arc) separate from
 * the Codex's interpretive layer (reading), and (c) cover every day of
 * the counted year from data + position rules — no hand-written days.
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

function loadTelling() {
  const context = { Date, Intl, URL, URLSearchParams };
  context.globalThis = context;
  context.window = context;
  scripts.forEach(script => vm.runInNewContext(read(script), context));
  return context;
}

const { DayTelling } = loadTelling();

function tell(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return DayTelling.tellForDate(new Date(Date.UTC(y, m - 1, d, 12)), { timeZone: "UTC" });
}

test("fixture 2026-07-17: Moon 4 Day 8, Pattern Day 92", () => {
  const t = tell("2026-07-17");
  assert.equal(t.kind, "counted");
  assert.deepEqual(
    [t.coordinate.moon, t.coordinate.day, t.coordinate.patternDay],
    [4, 8, 92]
  );
  assert.equal(t.headline, "Day 8 of the Stone Witness moon");
  assert.match(t.position.join(" "), /Pattern Day 92 of 364/);
  assert.match(t.position.join(" "), /Week 2 of this moon/);
  assert.match(t.arc.join(" "), /Living Word/);
  assert.match(t.reading.join(" "), /Day 8 is Gate/);
  assert.match(t.reading.join(" "), /Build structure\. Repair the physical\. Record what happened\./);
});

test("fixture 2026-09-15: Moon 6 Day 12, Pattern Day 152", () => {
  const t = tell("2026-09-15");
  assert.deepEqual(
    [t.coordinate.moon, t.coordinate.day, t.coordinate.patternDay],
    [6, 12, 152]
  );
  assert.equal(t.headline, "Day 12 of the Fire Trial moon");
  assert.match(t.position.join(" "), /Pattern Day 152 of 364/);
  assert.match(t.reading.join(" "), /Day 12 is River/);
  assert.match(t.arc.join(" "), /Crown Balance/);
});

test("fixture 2026-11-18: Moon 8 Day 20, Pattern Day 216", () => {
  const t = tell("2026-11-18");
  assert.deepEqual(
    [t.coordinate.moon, t.coordinate.day, t.coordinate.patternDay],
    [8, 20, 216]
  );
  assert.equal(t.headline, "Day 20 of the Deep Mirror moon");
  assert.match(t.position.join(" "), /Wednesday, November 18, 2026/);
  assert.match(t.position.join(" "), /Pattern Day 216 of 364/);
  assert.match(t.position.join(" "), /148 counted days remain after today/);
  assert.match(t.position.join(" "), /Week 3 of this moon/);
  assert.match(t.arc.join(" "), /8 days of this moon remain after today/);
  assert.match(t.arc.join(" "), /Return Path/);
  assert.match(t.reading.join(" "), /Day 20 is Bread/);
  assert.match(t.reading.join(" "), /Testing week/);
  assert.match(t.reading.join(" "), /396 Hz/);
});

test("position stays arithmetic: no Codex reading leaks into the facts", () => {
  const t = tell("2026-11-18");
  const facts = [...t.position, ...t.arc].join(" ");
  assert.doesNotMatch(facts, /396 Hz/);
  assert.doesNotMatch(facts, /Bread/);
  assert.doesNotMatch(facts, /Journal before judging/);
  assert.equal(t.readingLabel, "The Codex's reading");
});

test("Day Out of Time 2027-04-16 stands outside the count", () => {
  const t = tell("2027-04-16");
  assert.equal(t.kind, "day-out-of-time");
  assert.equal(t.headline, "The Day Out of Time");
  assert.match(t.position.join(" "), /outside the 364-day count/);
  assert.match(t.arc.join(" "), /April 17, 2027/);
  assert.match(t.arc.join(" "), /Seed Flame/);
});

test("Deep Time Day 2028-04-16 is the leap arrangement", () => {
  const t = tell("2028-04-16");
  assert.equal(t.kind, "deep-time");
  assert.equal(t.headline, "The Deep Time Day");
  assert.match(t.position.join(" "), /366 days instead of 365/);
});

test("Pattern Day 364 closes the counted year", () => {
  const t = tell("2027-04-15");
  assert.equal(t.coordinate.patternDay, 364);
  assert.match(t.position.join(" "), /last counted day of the year/);
  assert.match(t.arc.join(" "), /Day Out of Time/);
});

test("telling is deterministic and each day speaks differently", () => {
  assert.deepEqual(tell("2026-11-18"), tell("2026-11-18"));
  const next = tell("2026-11-19");
  assert.equal(next.coordinate.patternDay, 217);
  assert.match(next.reading.join(" "), /Day 21 is Watch/);
  assert.notEqual(next.headline, tell("2026-11-18").headline);
});

test("every day of the counted year gets a telling, in order", () => {
  const start = Date.UTC(2026, 3, 17, 12);
  let expectedPatternDay = 0;
  let counted = 0;
  let intercalary = 0;
  for (let i = 0; i < 365; i++) {
    const t = DayTelling.tellForDate(new Date(start + i * 86400000), { timeZone: "UTC" });
    assert.ok(t, `no telling for offset ${i}`);
    assert.ok(t.position.length > 0 && t.arc.length > 0 && t.reading.length > 0);
    if (t.kind === "counted") {
      counted++;
      expectedPatternDay++;
      assert.equal(t.coordinate.patternDay, expectedPatternDay);
    } else {
      intercalary++;
    }
  }
  assert.equal(counted, 364);
  assert.equal(intercalary, 1); // the Day Out of Time closes the 365-day window
});

test("moons page carries the telling panel, module, and plain static fallback", () => {
  const html = read("docs/moons.html");
  assert.match(html, /id="dayTellingPanel"/);
  assert.match(html, /assets\/js\/day-telling\.js/);
  // The static fallback is date-neutral: a sealed day (the panel once
  // carried 2026-11-18, Moon 8 Day 20, Pattern Day 216) is false on
  // every other day. The generated telling above pins the real math.
  const panel = html.slice(html.indexOf('id="dayTellingPanel"'), html.indexOf("manifest-today"));
  assert.match(panel, /Today in the Pattern calendar/);
  assert.ok(!/November 18, 2026/.test(panel), "no sealed civil date in the static fallback");
  assert.ok(!/Day 20 of the Deep Mirror moon/.test(panel), "no sealed coordinate in the static fallback");
  assert.ok(!/Pattern Day 216/.test(panel), "no sealed Pattern Day in the static fallback");
  assert.match(html, /The Codex's reading/);

  const moonsJs = read("docs/assets/js/moons.js");
  assert.match(moonsJs, /renderDayTelling\(context\)/);
  assert.match(moonsJs, /globalThis\.DayTelling/);
  assert.match(moonsJs, /CALENDAR\.fromCivilDate/);

  const css = read("docs/assets/css/moons-interface.css");
  assert.match(css, /\.day-telling/);
});
