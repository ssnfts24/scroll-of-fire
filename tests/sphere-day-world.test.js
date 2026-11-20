"use strict";

/**
 * Sphere R3 Wave 1 — the Day World.
 *
 * The room must (a) stand on the one canonical clock — Aaron's
 * fixtures reproduce through PatternCalendar, never a second count;
 * (b) compose honestly — empty days show empty, the sky speaks only
 * for today and is labeled an estimate, the closing questions are
 * the vision's eight, verbatim; (c) find last cycle by the calendar's
 * own epoch; and (d) hold the pronoun rule for the Spark.
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
const DayWorld = require(path.join(root, "docs/assets/js/sphere-day-world.js"));

function summary(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return stack.PatternCalendar.fromCivilDate({ date: new Date(Date.UTC(y, m - 1, d, 12)) });
}

test("the one clock: Aaron's fixtures hold through PatternCalendar", () => {
  const july = summary("2026-07-17");
  assert.equal(july.moon, 4);
  assert.equal(july.day, 8);
  assert.equal(july.dayOfPatternYear, 92);

  const sept = summary("2026-09-15");
  assert.equal(sept.dayOfPatternYear, 152);
  assert.equal(sept.moon, 6);
  assert.equal(sept.day, 12);

  const nov = summary("2026-11-19");
  assert.equal(nov.moon, 8);
  assert.equal(nov.day, 21);
  assert.equal(nov.dayOfPatternYear, 217);

  const gate = summary("2026-04-17");
  assert.equal(gate.dayOfPatternYear, 1);
  assert.equal(gate.moon, 1);
  assert.equal(gate.day, 1);
});

test("last cycle: same Moon and Day one pattern year earlier, by the calendar's epoch", () => {
  const civil = DayWorld.lastCycleCivilDate(
    { patternYear: 2026, patternDay: 217 },
    stack.PatternCalendar
  );
  assert.equal(civil, "2025-11-19");

  const back = summary(civil);
  assert.equal(back.moon, 8);
  assert.equal(back.day, 21);
  assert.equal(back.dayOfPatternYear, 217);

  assert.equal(
    DayWorld.lastCycleCivilDate({ patternYear: 2026, patternDay: null }, stack.PatternCalendar),
    null
  );
});

test("the room composes: coordinate, telling, contents, Spark, closing questions", () => {
  const view = {
    civilDate: "2026-11-19",
    patternYear: 2026,
    patternDay: 217,
    moon: 8,
    moonDay: 21,
    week: 3,
    moonName: "Deep Mirror",
    entries: [{ title: "Tend the beds", timeLabel: "All day", type: "plan" }]
  };
  const telling = stack.DayTelling.tellForDate(new Date(Date.UTC(2026, 10, 19, 12)));
  const model = DayWorld.buildRoomModel({
    view,
    telling,
    environment: null,
    todayCivilDate: "2026-11-19",
    spark: { name: "Selor", kind: "water" },
    memoryRecords: [],
    memoryCivilDate: "2025-11-19"
  });

  assert.equal(model.ready, true);
  assert.equal(model.coordinate.patternDay, 217);
  assert.ok(model.telling.headline.includes("Deep Mirror"));
  assert.ok(model.telling.position.length > 0);
  assert.ok(model.telling.reading.length > 0);
  assert.equal(model.contents.count, 1);
  assert.equal(model.contents.entries[0].title, "Tend the beds");
  assert.equal(model.spark.name, "Selor");
  assert.equal(model.spark.tint, "water");
  assert.deepEqual(model.closingQuestions, [
    "What happened?",
    "Where?",
    "What was observed?",
    "What did we understand?",
    "What did we misunderstand?",
    "What repeated?",
    "What changed?",
    "What can we learn, create, or correct next?"
  ]);
  assert.ok(model.explainers.farm.includes("county extension"));
});

test("honesty: an empty day stays empty, and the sky never speaks for another day", () => {
  const view = {
    civilDate: "2026-07-17",
    patternYear: 2026,
    patternDay: 92,
    moon: 4,
    moonDay: 8,
    week: 2,
    moonName: null,
    entries: []
  };
  const model = DayWorld.buildRoomModel({
    view,
    telling: null,
    environment: { status: "ok", current: { temperatureC: 20 }, place: { name: "Randle" } },
    todayCivilDate: "2026-11-19",
    spark: null,
    memoryRecords: null
  });

  assert.equal(model.contents.empty, true);
  assert.equal(model.contents.count, 0);
  assert.ok(model.sky.includes("speaks for today"));
  assert.equal(model.spark, null);
  assert.equal(model.memory, null);
});

test("the sky for today is the environment layer's report, labeled an estimate", () => {
  const line = DayWorld.skyLine(
    { status: "ok", current: { temperatureC: 7.6, condition: "Light rain" }, place: { name: "Randle" } },
    true
  );
  assert.ok(line.includes("Light rain"));
  assert.ok(line.includes("8°C"));
  assert.ok(line.includes("estimate"));

  const silent = DayWorld.skyLine({ status: "unavailable", current: null }, true);
  assert.ok(silent.includes("No sky report"));
});

test("the pronoun rule holds in the module's own words", () => {
  const source = read("docs/assets/js/sphere-day-world.js");
  assert.ok(!/\bshe\b/i.test(source), "no 'she' for the Spark");
  assert.ok(!/\bher\b/i.test(source), "no 'her' for the Spark");
  assert.ok(!/\bhers\b/i.test(source), "no 'hers' for the Spark");
});

test("the room is wired as an overlay: tags on the page, public APIs only", () => {
  const page = read("docs/living-time-sphere.html");
  assert.ok(page.includes("assets/js/sphere-day-world.js"));
  assert.ok(page.includes("assets/css/sphere-day-world.css"));
  assert.ok(page.includes("assets/js/day-telling.js"));
  assert.ok(page.includes("assets/js/day-notes.js"));

  const source = read("docs/assets/js/sphere-day-world.js");
  assert.ok(source.includes("createDayZoom"), "reads the day through the day-zoom public controller");
  assert.ok(source.includes("CodexDayNotes"), "writes notes through the Day Notes module");
  assert.ok(!source.includes("living-time-sphere-camera"), "never reaches into the camera");
  assert.ok(!source.includes("living-time-sphere-calendar-geometry"), "never reaches into the geometry");
});
