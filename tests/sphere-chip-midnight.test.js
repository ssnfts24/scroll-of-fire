"use strict";

/*
 * Pass 8b, item 3 — the Sphere reads midnight too (Aaron's
 * ruling, Nov 26, 2026, 21:32 PST: "Make the Sphere read
 * midnight too.").
 *
 * At 20:20 PST on Thu Nov 26, 2026, the Sphere page's own
 * Today chip — the pinned day label on the face, echoed by the
 * state strip, the guide bar's readout and the day scrubber —
 * named Moon 9 · Day 1 · Pattern Day 225, while the page's
 * TODAY panel and the Spark named Pattern Day 224. The chip's
 * road was the Observatory's sunset boundary (the day rolls
 * forward at 18:00), carried in the instrument's state from
 * its arrival URL; the Sphere-side Spark layers had their own
 * unpinned copies besides — sphere-spark.js's stamp resolved
 * through the cursor with no options (sunset again), and
 * sphere-spark-schedule.js's todayCivil through the bare
 * calendar (UTC, rolling forward from 16:00 Pacific).
 *
 * The fix, in the companion layer only — no protected file's
 * content changes; the protected page moves three loader
 * stamps and nothing else:
 *   - sphere-companion-layer.js sets the arrival URL's
 *     `boundary` reading to midnight where the URL names none
 *     (it evaluates before the instrument mounts on
 *     DOMContentLoaded, and the instrument takes its boundary
 *     from that URL — its own designed input). A URL naming a
 *     boundary keeps its own word.
 *   - Every Sphere-side copy of "today" (sphere-spark.js's
 *     stamp and summary, sphere-spark-schedule.js's
 *     todayCivil, sphere-spark-inhabitant.js's stamp and
 *     position, sphere-day-world.js's today civil date) is
 *     pinned to the device's zone at a midnight boundary, on
 *     both roads, in pass 8's shape.
 *
 * Before / after at the pinned instant (Nov 26, 20:20 in
 * America/Los_Angeles): the chip's reading 225 → 224.
 * These tests run the REAL calendar and cursor under the
 * pinned clock and call the today functions extracted,
 * unmodified, from the shipped files.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const ZONE = "America/Los_Angeles";
const EVENING = Date.UTC(2026, 10, 27, 4, 20, 0); // Nov 26, 20:20 in Los Angeles
const AFTER_MIDNIGHT = Date.UTC(2026, 10, 27, 8, 30, 0); // Nov 27, 00:30 in Los Angeles

/* A world with a pinned clock and a pinned home zone,
 * carrying the site's real calendar stack and cursor. */
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
  class PinnedCustomEvent {
    constructor(type, init) { this.type = type; this.detail = init && init.detail; }
  }
  const ctx = {
    console, Math, JSON, Object, Array, Number, String, Boolean,
    RegExp, Error, TypeError, Map, Set, Promise, Symbol,
    Date: PinnedDate,
    Intl: intl,
    CustomEvent: PinnedCustomEvent,
    dispatchEvent() { return true; },
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
    "pattern-calendar.js",
    "temporal-cursor-controller.js"
  ]) {
    vm.runInContext(read(dir + f), ctx, { filename: f });
  }
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

test("before / after at the pinned evening: the sunset road names 225, the midnight road names 224", () => {
  const world = buildWorld(EVENING);
  const sunset = vm.runInContext(
    "SOFTemporalCursor.resolvePosition(new Date(), { timeZone: 'America/Los_Angeles', boundaryMode: 'sunset' })",
    world
  );
  assert.equal(sunset.dayOfPatternYear, 225, "the chip's old reading: sunset rolls the day forward");
  assert.equal(sunset.moon, 9);
  assert.equal(sunset.day, 1);
  const midnight = vm.runInContext(
    "SOFTemporalCursor.resolvePosition(new Date(), { timeZone: 'America/Los_Angeles', boundaryMode: 'midnight' })",
    world
  );
  assert.equal(midnight.dayOfPatternYear, 224, "the ruled reading: the day turns at midnight");
  assert.equal(midnight.moon, 8);
  assert.equal(midnight.day, 28);
});

test("sphere-spark.js: the Spark's stamp and summary name the page's day at the pinned evening", () => {
  const world = buildWorld(EVENING);
  const src = read("docs/assets/js/sphere-spark.js");
  const helpers = [
    extractFunction(src, "todayOptions"),
    extractFunction(src, "daypartForHour"),
    extractFunction(src, "patternStamp"),
    extractFunction(src, "todaySummary")
  ].join("\n");
  const stamp = vm.runInContext(`${helpers}\npatternStamp(globalThis, new Date())`, world);
  assert.equal(stamp.patternDay, 224, "the stamp's Pattern Day matches the page");
  assert.equal(stamp.moon, 8);
  assert.equal(stamp.day, 28);
  assert.equal(stamp.civilDate, "2026-11-26");
  const summary = vm.runInContext(`${helpers}\ntodaySummary()`, world);
  assert.equal(summary.dayOfPatternYear, 224, "the summary's day matches the page");
});

test("sphere-spark-schedule.js: todayCivil is the local civil date at the pinned evening", () => {
  const world = buildWorld(EVENING);
  const fn = extractFunction(read("docs/assets/js/sphere-spark-schedule.js"), "todayCivil");
  const civil = vm.runInContext(`(${fn})()`, world);
  assert.equal(civil, "2026-11-26", "not the UTC date (2026-11-27) the bare calendar call returned");
  const later = buildWorld(AFTER_MIDNIGHT);
  const civilLater = vm.runInContext(`(${fn})()`, later);
  assert.equal(civilLater, "2026-11-27", "the day still turns at the local midnight — a boundary, not a freeze");
});

test("the companion layer's boundary setting: midnight where the URL names none, untouched where it names one", () => {
  const src = read("docs/assets/js/sphere-companion-layer.js");
  const start = src.indexOf("const arrival = new URL(location.href);");
  assert.ok(start >= 0, "the boundary setting stands in the companion layer");
  const tryStart = src.lastIndexOf("try {", start);
  const endMarker = "catch { /* the instrument keeps its own reading */ }";
  const end = src.indexOf(endMarker, start);
  assert.ok(tryStart >= 0 && end > start, "the setting is whole");
  const snippet = src.slice(tryStart, end + endMarker.length);

  const run = (href) => {
    const calls = [];
    const ctx = {
      URL,
      location: { href },
      history: { state: null, replaceState(state, title, url) { calls.push(String(url)); } }
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(snippet, ctx);
    return calls;
  };

  const bare = run("https://codexofreality.org/living-time-sphere.html");
  assert.equal(bare.length, 1, "a bare arrival is given the standing reading");
  assert.ok(bare[0].includes("boundary=midnight"), "the reading set is midnight");

  const named = run("https://codexofreality.org/living-time-sphere.html?boundary=sunset");
  assert.equal(named.length, 0, "a URL that names a boundary keeps its own word");
});

test("no Sphere-side copy resolves today unpinned any more", () => {
  const spark = read("docs/assets/js/sphere-spark.js");
  assert.ok(!spark.includes("fromCivilDate({ date })"), "sphere-spark.js: no bare calendar call");
  assert.ok(!spark.includes("fromCivilDate({ date: new Date() })"), "sphere-spark.js: no bare today call");
  assert.ok(!spark.includes("resolvePosition(date) : null"), "sphere-spark.js: no bare cursor call");
  const schedule = read("docs/assets/js/sphere-spark-schedule.js");
  assert.ok(!schedule.includes("fromCivilDate?.({ date: new Date() })"), "sphere-spark-schedule.js: no bare today call");
  const inhabitant = read("docs/assets/js/sphere-spark-inhabitant.js");
  assert.ok(!inhabitant.includes("fromCivilDate({ date })"), "sphere-spark-inhabitant.js: no bare calendar call");
  assert.ok(!inhabitant.includes("resolvePosition(date) : null"), "sphere-spark-inhabitant.js: no bare cursor call");
  assert.ok(!inhabitant.includes("resolvePosition(date)"), "sphere-spark-inhabitant.js: no unpinned cursor call");
  const dayWorld = read("docs/assets/js/sphere-day-world.js");
  assert.ok(!dayWorld.includes("fromCivilDate({ date: new Date() })"), "sphere-day-world.js: no bare today call");
  for (const [name, src] of [["sphere-spark.js", spark], ["sphere-spark-schedule.js", schedule], ["sphere-spark-inhabitant.js", inhabitant], ["sphere-day-world.js", dayWorld]]) {
    assert.ok(src.includes('boundaryMode: "midnight"'), `${name}: the midnight boundary is named`);
    assert.ok(src.includes("resolvedOptions().timeZone"), `${name}: the device's zone is read`);
  }
});

test("the changed files ride fresh loaders — three stamp lines on the protected page, two in the companion layer", () => {
  const page = read("docs/living-time-sphere.html");
  assert.ok(page.includes("sphere-companion-layer.js?v=20261127-2"), "the companion layer's stamp moved");
  assert.ok(page.includes("sphere-day-world.js?v=20261126-8"), "the day world's stamp moved");
  assert.ok(page.includes("sphere-spark.js?v=20261126-8"), "the Sphere Spark's stamp moved");
  const layer = read("docs/assets/js/sphere-companion-layer.js");
  assert.ok(layer.includes("sphere-spark-inhabitant.js?v=20261126-8"), "the inhabitant's stamp moved");
  assert.ok(layer.includes("sphere-spark-schedule.js?v=20261126-8"), "the schedule's stamp moved");
});
