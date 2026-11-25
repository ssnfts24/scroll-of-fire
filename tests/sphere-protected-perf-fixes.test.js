"use strict";

/*
 * The protected performance fixes (Nov 24, 2026). Aaron released
 * the protected Sphere files in plain words for exactly the four
 * prepared fixes — "Release the protected Sphere fixes" — and
 * this file is the change set's signature in
 * tests/homepage-sphere.test.js:
 *
 *   1. The 3D renderer: the semantic screen width is cached
 *      (container + viewport keyed, ResizeObserver-invalidated)
 *      instead of forcing a layout flush on every camera sync,
 *      and the renderer's own semantic-target build is memoized
 *      on the model object plus a fingerprint of every input it
 *      reads. Extension targets are still appended fresh.
 *   2. The Sphere UI: element inspections are cached per node
 *      (WeakMap) for a short 200 ms window and reset wholesale
 *      on scroll/resize; still-loading media is never cached.
 *      Values come from the original inspection body. No
 *      mutation observer — the PR3 guard stands.
 *   3. The temporal cursor: only the Intl timezone fallback is
 *      memoized; the observatory value is still read live on
 *      every call, and the memo drops when the keeper returns
 *      to the tab (the travel moment).
 *   4. The calendar geometry + label manager: geometry builds
 *      are memoized on their complete input sets and returned
 *      frozen (identical values, verified against the original
 *      module over the full input table), and the label track
 *      loop's pill guard serves a bounded slice per frame —
 *      selected pill first, then nearest the selection — with
 *      one full unbudgeted pass when the camera settles, so the
 *      settled state is exactly the state the unbudgeted guard
 *      computes.
 *
 * These tests pin the shape of the four fixes and, just as
 * hard, the things that must not move: the canonical calendar
 * values, the picking round-trip, and the observatory's live
 * read in the timezone resolution.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");

const geometryPath = path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-calendar-geometry.js");
const geometrySource = fs.readFileSync(geometryPath, "utf8");
const renderer = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
const sphereUi = read("docs/assets/js/sphere/living-time-sphere-ui.js");
const labels = read("docs/assets/js/sphere/living-time-sphere-label-manager.js");
const cursor = read("docs/assets/js/calendar/temporal-cursor-controller.js");

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(geometrySource, sandbox, { filename: geometryPath });
const geometry = sandbox.LivingTimeSphereCalendarGeometry;

test("protected-perf 4a: geometry builds are memoized, frozen, and value-true", () => {
  // Day 215 is the standing fixture: Moon 8, day 19, week 3.
  const cell = geometry.calendarCell(215);
  assert.equal(cell.moon, 8);
  assert.equal(cell.moonDay, 19);
  assert.ok(Math.abs(cell.radialFactor - 1.358) < 1e-9, "canonical week-3 lane");
  assert.strictEqual(geometry.calendarCell(215), cell, "repeat build returns the same object");
  assert.ok(Object.isFrozen(cell), "memoized cells are frozen against drift");
  assert.throws(() => { cell.moon = 99; }, TypeError);
  assert.equal(geometry.calendarCell(215).moon, 8, "the cache cannot be poisoned by a caller");

  const display = geometry.calendarDisplayCell(215);
  assert.strictEqual(geometry.calendarDisplayCell(215), display);
  assert.equal(display.angle, cell.angle, "the display reading angle stays canonical");
  assert.strictEqual(geometry.dayAddress(215), geometry.dayAddress(215));
  assert.equal(geometry.dayAddress(215).moon, 8);
  assert.equal(geometry.dayAddress(215).moonDay, 19);
  assert.strictEqual(geometry.moonAddress(8), geometry.moonAddress(8));
  assert.strictEqual(geometry.yearGate(2026), geometry.yearGate(2026));
  assert.equal(geometry.yearGate(2026).after.patternDay, 364);
  assert.equal(geometry.yearGate(2026).before.patternDay, 1);
  assert.strictEqual(geometry.dayBoundary(215, 2026), geometry.dayBoundary(215, 2026));
  assert.notStrictEqual(geometry.calendarCell(216), cell, "different inputs, different builds");
});

test("protected-perf 4a: picking round-trips for all 364 days over the cached builds", () => {
  for (let day = 1; day <= 364; day += 1) {
    const display = geometry.calendarDisplayCell(day);
    const found = geometry.nearestDisplayCell(
      display.angle,
      display.dayNumberRadialFactor
    );
    assert.equal(found.dayOfPatternYear, day, `day ${day} must round-trip through the cached display geometry`);
    assert.equal(found.moon, display.moon);
    assert.equal(found.moonDay, display.moonDay);
  }
});

test("protected-perf 1: the renderer caches the semantic width and memoizes its own targets", () => {
  assert.match(renderer, /_semanticWidthCache/, "the width cache exists");
  assert.match(renderer, /new ResizeObserver/, "a ResizeObserver invalidates the width cache");
  assert.match(renderer, /cache\.el === el && cache\.innerWidth === inner/, "the cache is keyed by container + viewport");
  assert.match(renderer, /_semanticTargetsMemo/, "the targets memo exists");
  assert.match(renderer, /memo\.model === _model && memo\.key === key/, "the memo is keyed by model identity + input fingerprint");
  assert.match(renderer, /sof:life-atlas-records-changed/, "record changes drop the memo (planner summaries stay fresh)");
  assert.match(renderer, /function _buildOwnSemanticTargets/, "the original build survives as the memo's miss path");
  assert.match(renderer, /semanticTargetsAll/, "extension targets are still gathered on every call");
});

test("protected-perf 2: the sphere UI caches inspections per node, briefly, with no observer", () => {
  assert.match(sphereUi, /let _inspectCache = new WeakMap\(\)/, "inspections are cached per node");
  assert.match(sphereUi, /function _inspectElementNodeUncached/, "the original inspection body computes the values");
  assert.match(sphereUi, /const INSPECT_CACHE_TTL_MS = 200;/, "the cache window is short and explicit");
  assert.match(sphereUi, /document\.addEventListener\("scroll", reset, true\)/, "scroll resets the cache (rects are viewport-relative)");
  assert.match(sphereUi, /result\.complete === false/, "still-loading media is never cached");
  assert.equal(sphereUi.includes("new MutationObserver"), false, "the PR3 guard stands: no whole-document mutation observer in this UI");
});

test("protected-perf 3: only the Intl timezone fallback is memoized; the observatory stays live", () => {
  const body = /function getTimezone\(\) \{([\s\S]*?)\n  \}/.exec(cursor);
  assert.ok(body, "getTimezone is present");
  assert.ok(
    body[1].indexOf("SOFObservatoryState") < body[1].indexOf("_intlTimezoneMemo"),
    "the observatory value is read before the memo is consulted"
  );
  assert.match(cursor, /let _intlTimezoneMemo = null;/, "the fallback memo exists");
  assert.match(cursor, /visibilitychange/, "the memo drops when the keeper returns to the tab");
});

test("protected-perf 4b: the label guard is budgeted per frame and exact when settled", () => {
  assert.match(labels, /const GUARD_PILLS_PER_FRAME = 8;/, "the per-frame pill budget");
  assert.match(labels, /const GUARD_PAIRS_PER_FRAME = 40;/, "the per-frame pair budget");
  assert.match(labels, /const fullGuard = cameraSettled;/, "a settled camera runs one full unbudgeted pass");
  assert.match(labels, /if \(cameraSettled && _guardCycleDone\)/, "the loop may sleep only once the cycle is complete");
  assert.match(labels, /_fadeOwner/, "plate fades are owner-stamped so unserved pills hold their fades");
  assert.match(labels, /_guardCycleDone = false;/, "a fresh layout pass reopens the cycle");
});
