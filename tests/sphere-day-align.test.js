"use strict";

/*
 * The Sphere page reads the house day, everywhere (Aaron's
 * ruling, Nov 26, 2026: the whole site reads the day from
 * local midnight; audit flaw F2, Nov 27, 2026).
 *
 * PR #402 aligned the demonstration card. The same bare-UTC
 * calls still stood in the page's own layers: the ambient
 * greeting (sphere-ambient.js — the coordinate line and moon
 * line above the stage, and the telling headline), the Spark
 * seat's telling answer (sphere-spark.js), and the Play room's
 * quest stamp, answer-card stamp and hunt target
 * (sphere-play.js). At Aaron's screenshot instant (Fri Nov 27,
 * 2026, 21:07 PST) the bare call named Pattern Day 226 while
 * the page's cursor named 225 — two days on one page.
 *
 * The fix is #402's shape verbatim at each site: the device's
 * own zone (Intl.DateTimeFormat().resolvedOptions().timeZone)
 * and the midnight boundary ride the call; sphere-spark.js
 * passes its standing todayOptions(), which carries both.
 * Conversions of a NAMED day (a selected date, a viewed civil
 * date) are not today reads and keep their own treatment —
 * this pin forbids only the bare today shapes.
 *
 * These tests run the real calendar and the real telling
 * under the pinned clock, call functions extracted whole from
 * the shipped files, and scan the whole Sphere page family
 * (docs/assets/js/sphere-*.js and docs/assets/js/sphere/) so
 * a bare today call cannot return to the page quietly.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const ZONE = "America/Los_Angeles";
const SCREENSHOT = Date.UTC(2026, 10, 28, 5, 7, 0); // Nov 27, 21:07 in Los Angeles

/* A world with a pinned clock and a pinned home zone,
 * carrying the site's real calendar stack and telling. */
function buildWorld(pinnedMs) {
  const RealDate = Date;
  class PinnedDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [pinnedMs])); }
    static now() { return pinnedMs; }
  }
  const RealDTF = Intl.DateTimeFormat;
  function PinnedDTF(locales, options) {
    const opts = { ...(options || {}) };
    if (!opts.timeZone) opts.timeZone = ZONE;
    return new RealDTF(locales, opts);
  }
  PinnedDTF.supportedLocalesOf = RealDTF.supportedLocalesOf;
  const intl = { ...Intl, DateTimeFormat: PinnedDTF };
  const ctx = {
    console, Math, JSON, Object, Array, Number, String, Boolean,
    RegExp, Error, TypeError, Map, Set, Promise, Symbol,
    Date: PinnedDate,
    Intl: intl,
    addEventListener() {},
    removeEventListener() {},
    document: { addEventListener() {} }
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  const dir = "docs/assets/js/calendar/";
  for (const f of [
    "pattern-calendar-version.js",
    "pattern-calendar-data.js",
    "pattern-calendar-format.js",
    "pattern-calendar-boundary.js",
    "pattern-calendar.js"
  ]) {
    vm.runInContext(read(dir + f), ctx, { filename: f });
  }
  vm.runInContext(read("docs/assets/js/day-telling.js"), ctx, { filename: "day-telling.js" });
  return ctx;
}

/* Pull one function out of a shipped file, whole, by
 * balancing its braces — the test calls the code as it
 * ships, not a copy of it. */
function extractFunction(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const open = src.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

test("before / after at Aaron's screenshot instant: the bare call names 226, the house call names 225", () => {
  const world = buildWorld(SCREENSHOT);
  const bare = vm.runInContext("PatternCalendar.fromCivilDate({ date: new Date() })", world);
  assert.equal(bare.dayOfPatternYear, 226, "the flaw as shipped: the UTC day, one ahead in the evening");
  const house = vm.runInContext(
    "PatternCalendar.fromCivilDate({ date: new Date(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, boundaryMode: 'midnight' })",
    world
  );
  assert.equal(house.dayOfPatternYear, 225, "the ruled reading: the local day, turning at midnight");
  assert.equal(house.moon, 9);
  assert.equal(house.day, 1);
});

test("the telling follows the same road: bare names tomorrow's telling, the house options name today's", () => {
  const world = buildWorld(SCREENSHOT);
  const bareTelling = vm.runInContext("DayTelling.tellForDate(new Date())", world);
  const houseTelling = vm.runInContext(
    "DayTelling.tellForDate(new Date(), { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, boundaryMode: 'midnight' })",
    world
  );
  const houseSummary = vm.runInContext(
    "PatternCalendar.fromCivilDate({ date: new Date(), timeZone: 'America/Los_Angeles', boundaryMode: 'midnight' })",
    world
  );
  assert.deepEqual(houseTelling, vm.runInContext(`DayTelling.tell(${JSON.stringify(houseSummary)})`, world),
    "the house telling is the telling of Pattern Day 225");
  assert.notDeepEqual(bareTelling, houseTelling, "the bare telling is a different day's telling");
});

test("sphere-spark.js: the seat's telling rides todayOptions() — the device's zone at midnight", () => {
  const world = buildWorld(SCREENSHOT);
  const src = read("docs/assets/js/sphere-spark.js");
  const optionsFn = extractFunction(src, "todayOptions");
  const telling = vm.runInContext(
    `${optionsFn}\nDayTelling.tellForDate(new Date(), todayOptions())`,
    world
  );
  const houseTelling = vm.runInContext(
    "DayTelling.tellForDate(new Date(), { timeZone: 'America/Los_Angeles', boundaryMode: 'midnight' })",
    world
  );
  assert.deepEqual(telling, houseTelling, "the seat speaks today's telling, not tomorrow's");
  assert.ok(src.includes("tellForDate(new Date(), todayOptions())"), "the telling case passes the house options");
});

test("sphere-play.js: the quest stamp and the hunt target are drawn from the house day", () => {
  const world = buildWorld(SCREENSHOT);
  const src = read("docs/assets/js/sphere-play.js");
  const questCivilDate = extractFunction(src, "questCivilDate");
  const civil = vm.runInContext(`(${questCivilDate})()`, world);
  assert.equal(civil, "2026-11-27", "the quest is stamped with the local civil date, not the UTC date (2026-11-28)");

  const drawHuntTarget = extractFunction(src, "drawHuntTarget");
  const target = vm.runInContext(
    `Math.random = () => 0;\n(${drawHuntTarget})()`,
    world
  );
  assert.equal(target.patternDay, 245, "the target stands 20 days from the true today (225), not from 226");
  assert.equal(target.moon, 9);
  assert.equal(target.day, 21);
});

test("the fixed sites carry the house shape in the shipped source", () => {
  const ambient = read("docs/assets/js/sphere-ambient.js");
  assert.ok(ambient.includes('fromCivilDate({ date: new Date(), timeZone, boundaryMode: "midnight" })'),
    "sphere-ambient.js: the greeting's calendar call carries the zone and the midnight boundary");
  assert.ok(ambient.includes('tellForDate(new Date(), { timeZone, boundaryMode: "midnight" })'),
    "sphere-ambient.js: the greeting's telling call carries the zone and the midnight boundary");
  assert.ok(ambient.includes("Intl.DateTimeFormat().resolvedOptions().timeZone"),
    "sphere-ambient.js: the zone is the device's own");

  const play = read("docs/assets/js/sphere-play.js");
  assert.ok(play.includes('fromCivilDate?.({ date: new Date(), timeZone, boundaryMode: "midnight" })'),
    "sphere-play.js: the quest stamp's fallback call carries the house shape");
  assert.ok((play.match(/boundaryMode: "midnight"/g) || []).length >= 3,
    "sphere-play.js: all three today reads carry the midnight boundary");
  assert.ok(play.includes("Intl.DateTimeFormat().resolvedOptions().timeZone"),
    "sphere-play.js: the zone is the device's own");
});

test("no bare today call stands anywhere in the Sphere page family", () => {
  const bareShapes = [
    [/fromCivilDate\(\{\s*date:\s*new Date\(\)\s*\}\)/, "a bare calendar today call"],
    [/fromCivilDate\?\.\(\{\s*date:\s*new Date\(\)\s*\}\)/, "a bare optional calendar today call"],
    [/tellForDate\(new Date\(\)\)/, "a bare telling today call"],
    [/tellForDate\(new Date\(\),\s*\{\s*\}\)/, "a telling today call with empty options"]
  ];
  const files = [];
  for (const f of fs.readdirSync(path.join(root, "docs/assets/js"))) {
    if (/^sphere-.*\.js$/.test(f)) files.push(`docs/assets/js/${f}`);
  }
  for (const f of fs.readdirSync(path.join(root, "docs/assets/js/sphere"))) {
    if (f.endsWith(".js")) files.push(`docs/assets/js/sphere/${f}`);
  }
  assert.ok(files.length > 40, "the family scan really covers the page's files");
  for (const file of files) {
    const src = read(file);
    for (const [shape, label] of bareShapes) {
      assert.ok(!shape.test(src), `${file}: no ${label} — today is read the house way or not at all`);
    }
  }
});

test("the changed files ride fresh loaders on the page", () => {
  const page = read("docs/living-time-sphere.html");
  assert.ok(page.includes("sphere-ambient.js?v=20261127-1"), "the ambient layer's stamp moved");
  assert.ok(page.includes("sphere-spark.js?v=20261127-1"), "the Sphere Spark's stamp moved");
  assert.ok(page.includes("sphere-play.js?v=20261127-1"), "the Play room's stamp moved");
});
