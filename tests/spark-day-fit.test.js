"use strict";

/*
 * Pass 8 — the Spark's day is the page's day, and its blocks
 * fit the glass (Aaron's phone, Nov 26, 2026, ~20:20 PST).
 *
 * The day: on his Galaxy A16 the homepage's TODAY panel read
 * Thursday, November 26 · Moon 8 · Deep Mirror · Day 28 ·
 * Pattern Day 224, while the Spark's doorstep offered
 * "Pattern Day 225, day 1 of the Return Path moon". The
 * panel resolves today through the canonical calendar in
 * the device's timezone at a midnight boundary
 * (home-telling.js). The Spark layer's copies of
 * todayCoordinate resolved it two other ways: through the
 * cursor with no options — whose boundary defaults to the
 * Observatory's sunset (18:00), rolling the day forward in
 * the evening — and, where no cursor stands, through
 * PatternCalendar.fromCivilDate({ date }) with no zone —
 * whose default zone is UTC, rolling the day forward from
 * 16:00 Pacific. Both roads are pinned in this pass: every
 * companion-layer copy now passes the device's zone and a
 * midnight boundary, on both roads.
 *
 * These tests run the REAL calendar and the REAL cursor
 * under a pinned clock (Thu Nov 26, 2026, 20:20 in
 * America/Los_Angeles = Nov 27 04:20 UTC) and call the
 * todayCoordinate function extracted, unmodified, from each
 * shipped file. Before the fix every one of them answered
 * 225; the page's answer is 224.
 *
 * The fit: on the same screenshots the doorstep's last line
 * ran under the homepage's bottom rail, cut mid-sentence;
 * the Ask button sat on the doorstep's "Not now"; the Tour
 * button stood wholly under the rail; and on the Sphere
 * page the Ask button sat on the demonstration caption's
 * last words. The structural pins for those fixes stand at
 * the bottom of this file; the measured proof is the
 * 390px browser walk in the pass record.
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

const DAY_FILES = [
  "docs/assets/js/spark-presence.js",
  "docs/assets/js/spark-living.js",
  "docs/assets/js/spark-intro.js",
  "docs/assets/js/spark-companions-page.js",
  "docs/assets/js/spark-home-world.js"
];

test("at 20:20 in Los Angeles the page's own answer is Pattern Day 224 — and the old roads answer 225", () => {
  const world = buildWorld(EVENING);
  const page = vm.runInContext(
    "PatternCalendar.fromCivilDate({ date: new Date(), timeZone: 'America/Los_Angeles', boundaryMode: 'midnight' })",
    world
  );
  assert.equal(page.dayOfPatternYear, 224, "the panel's road: local zone, midnight");
  assert.equal(page.moon, 8);
  assert.equal(page.day, 28);
  const utcRoad = vm.runInContext("PatternCalendar.fromCivilDate({ date: new Date() })", world);
  assert.equal(utcRoad.dayOfPatternYear, 225, "the bare calendar call defaults to UTC and rolls forward");
  const sunsetRoad = vm.runInContext("SOFTemporalCursor.resolvePosition(new Date())", world);
  assert.equal(sunsetRoad.dayOfPatternYear, 225, "the unpinned cursor defaults to the sunset boundary and rolls forward");
});

for (const file of DAY_FILES) {
  test(`${file.split("/").pop()}: its todayCoordinate answers the page's day at the pinned evening`, () => {
    const world = buildWorld(EVENING);
    const fn = extractFunction(read(file), "todayCoordinate");
    const pos = vm.runInContext(`(${fn})()`, world);
    assert.ok(pos, "a coordinate stands");
    assert.equal(pos.dayOfPatternYear, 224, "Pattern Day 224, matching the page");
    assert.equal(pos.moon, 8, "Moon 8, Deep Mirror");
    assert.equal(pos.day, 28, "day 28 of the Moon");
  });
}

test("spark-play.js: the match table's day is the page's day at the pinned evening", () => {
  const world = buildWorld(EVENING);
  const fn = extractFunction(read("docs/assets/js/spark-play.js"), "todayPatternDay");
  const pd = vm.runInContext(`(${fn})()`, world);
  assert.equal(pd, 224);
});

test("the pinned day still turns at the local midnight — it is a boundary, not a freeze", () => {
  const world = buildWorld(AFTER_MIDNIGHT);
  const fn = extractFunction(read("docs/assets/js/spark-living.js"), "todayCoordinate");
  const pos = vm.runInContext(`(${fn})()`, world);
  assert.equal(pos.dayOfPatternYear, 225, "Nov 27, 00:30 in Los Angeles is Pattern Day 225");
  assert.equal(pos.moon, 9);
  assert.equal(pos.day, 1);
});

test("no companion-layer copy resolves today unpinned any more", () => {
  for (const file of [...DAY_FILES, "docs/assets/js/spark-play.js"]) {
    const src = read(file);
    assert.ok(!src.includes("resolvePosition(new Date())"), `${file}: no bare cursor call`);
    assert.ok(!src.includes("fromCivilDate({ date: new Date() })"), `${file}: no bare calendar call`);
    assert.ok(src.includes('boundaryMode: "midnight"'), `${file}: the midnight boundary is named`);
    assert.ok(src.includes("resolvedOptions().timeZone"), `${file}: the device's zone is read`);
  }
});

/* ---- the fit ---- */

test("the doorstep stands above the button stack on a narrow screen, its words on their own row", () => {
  const css = read("docs/assets/css/spark-living.css");
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /bottom: calc\(128px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /\.spark-doorstep-text \{\s*flex: 1 1 calc\(100% - 19px\);/);
  assert.match(css, /max-height: 30dvh;\s*overflow-y: auto;/, "long words scroll inside their own measure");
  assert.match(css, /\.spark-doorstep \{[^}]*bottom: calc\(12px \+ env\(safe-area-inset-bottom\)\)/s, "the resting measure keeps the safe area");
});

test("one Spark block at a time: the doorstep rests while the Spark walks, and while the Sphere's demonstration stands", () => {
  const css = read("docs/assets/css/spark-living.css");
  assert.match(css, /body\.spark-roam-open \.spark-doorstep \{\s*visibility: hidden;/);
  assert.match(css, /body:has\(\.evo-opening\) \.spark-doorstep \{\s*visibility: hidden;/);
});

test("the living layer stands the doorstep clear of the rail and of the Spark's own seat, by measure", () => {
  const js = read("docs/assets/js/spark-living.js");
  assert.match(js, /document\.querySelector\("\.le-rail"\)/, "the rail is measured, not guessed");
  assert.match(js, /window\.innerWidth <= 640 \? 128 : 12/, "the narrow-screen base matches the stylesheet's");
  assert.match(js, /spark-presence-button/, "the seat is measured from the figure that stands");
  assert.match(js, /chip\.style\.maxWidth/, "the invitation narrows to the seat's clear side");
});

test("the Tour and Ask buttons rise clear of the first page's rail, by its own measure", () => {
  const js = read("docs/assets/js/spark-intro.js");
  assert.match(js, /function railLift\(\)/);
  assert.match(js, /function liftLaunchers\(\)/);
  assert.match(js, /12 \+ lift/);
  assert.match(js, /68 \+ lift/);
  assert.match(js, /addEventListener\("resize", liftLaunchers\)/);
});

test("while the Sphere's demonstration owns the stage, the Spark's buttons rest", () => {
  const css = read("docs/assets/css/spark-intro.css");
  assert.match(css, /body:has\(\.evo-opening\) \.spark-tour-launcher,\s*body:has\(\.evo-opening\) \.spark-ask-launcher \{\s*visibility: hidden;/);
});

test("the asking cluster keeps its whole height inside the glass", () => {
  const css = read("docs/assets/css/spark-intro.css");
  assert.match(css, /\.spark-roam\.is-ask \.spark-roam-text \{\s*max-height: 22dvh;/,
    "the answer's measure gives height to the questions, so the cluster fits");
  assert.match(css, /\.spark-roam\.is-ask \.spark-roam-choices \{[^}]*max-height: 36dvh;/s,
    "the questions keep their own scroll, as before");
});
