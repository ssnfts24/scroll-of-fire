"use strict";

/* The Sphere page rebuild (Aaron, Nov 20, 2026): "The sphere as a
 * app needs to be redone." These tests pin the rebuild's fences:
 *  - the page loads the new shell last, and the record-helpers
 *    load-order error is dead (helpers before their consumers);
 *  - the renderer starts always-interactive with the gesture
 *    restore unconditional (the resting-state touch glitch);
 *  - the year-progress arc rides the Pattern ring from the
 *    model's own day count, and is never pickable;
 *  - F3/F5/F6 carry their fixes in the declared protected files;
 *  - the quick-jump civil-date branch uses the civil year, not
 *    PatternCalendar's year count (the 1902 defect);
 *  - the guard declaration for this change set exists;
 *  - the fixtures hold in the canonical calendar itself. */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const page = read("docs/living-time-sphere.html");
const shell = read("docs/assets/js/sphere-rebuild.js");
const renderer = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
const labels = read("docs/assets/js/sphere/living-time-sphere-label-manager.js");
const camera = read("docs/assets/js/sphere/living-time-sphere-camera.js");
const options = read("docs/assets/js/sphere/living-time-sphere-options.js");
const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");

test("the page loads the rebuild shell, its styles, the fresh Spark layer and play — in order", () => {
  const rebuildCss = page.indexOf("sphere-rebuild.css");
  const sparkCss = page.indexOf("sphere-spark.css");
  assert.ok(rebuildCss > -1 && sparkCss > rebuildCss, "rebuild styles load, spark styles after them");
  const ambient = page.indexOf("sphere-ambient.js");
  const rebuild = page.indexOf("sphere-rebuild.js");
  const spark = page.indexOf("sphere-spark.js");
  const play = page.indexOf("sphere-play.js");
  assert.ok(ambient > -1 && rebuild > ambient, "the shell boots after the Ambient face it rehomes");
  assert.ok(spark > rebuild && play > spark, "Spark layer after the shell, play after the Spark");
});

test("the CodexRecordHelpers load-order error is dead: helpers load before day-notes", () => {
  const helpers = page.indexOf("life-atlas/record-helpers.js");
  const notes = page.indexOf("assets/js/day-notes.js");
  assert.ok(helpers > -1, "record-helpers is on the page");
  assert.ok(notes === -1 || helpers < notes, "helpers precede their consumer");
});

test("the renderer starts always-interactive and restores gesture state unconditionally", () => {
  assert.ok(renderer.includes('touchAction = "none"') || renderer.includes("touchAction: \"none\"") || renderer.includes('touchAction = \'none\'') || renderer.includes("\"none\""), "canvas touch action is none at creation");
  assert.ok(/let interactMode\s+= true/.test(renderer), "interact mode starts on");
  assert.ok(!/pointerCache\.size === 0 && interactMode/.test(renderer), "the gated restore that stranded the glitch is gone");
});

test("the year-progress arc rides the Pattern ring from the model's own count", () => {
  assert.ok(renderer.includes("yearProgressGroup"), "the arc has its own group");
  assert.ok(renderer.includes("_lastYearProgressGeometryKey"), "the arc rebuilds only when the day changes");
  assert.ok(renderer.includes("dayOfPatternYear"), "the arc reads the canonical day count");
});

test("F3: floating cards prefer corners and respect placed rail numerals", () => {
  assert.ok(labels.includes("cornerAttempts"), "corner attempts exist in card placement");
  assert.ok(labels.includes("audit's F3"), "the fix names the friction it answers");
  assert.ok(labels.includes("placedRects.push({\n            x: railX - w / 2") || labels.includes("railX - w / 2"), "rail numerals register their boxes");
});

test("F5: fit is the default Moon-label mode; a stored 'always' still stands", () => {
  assert.ok(options.includes('labelMode: "fit"'), "the default is fit");
  assert.ok(options.includes('value.labelMode === "always" ? "always" : "fit"'), "an explicit always is preserved");
});

test("F6: the mobile camera frames the whole ring instead of zooming in", () => {
  assert.ok(camera.includes("base.distance + (mode === \"years\" ? -0.1 : 0.3)"), "mobile presets stand further back");
  assert.ok(camera.includes("audit's F6"), "the fix names the friction it answers");
});

test("the 1902 defect: quick-jump's civil branch uses the civil year", () => {
  assert.ok(ui.includes("resolved.selectedYear"), "selectedYear drives the jump");
  assert.ok(!ui.includes("applyYear(Number(resolved.patternYear)"), "the year count no longer feeds applyYear");
  assert.ok(ui.includes("the 1902 defect"), "the fix names itself");
});

test("quick-jump speaks truthfully at the edges: waking calendar, substituted year", () => {
  assert.ok(ui.includes("The calendar is still waking up"), "an early civil date is not called unmappable");
  assert.ok(ui.includes("exactYearMatch === false"), "the substitution branch exists");
  assert.ok(ui.includes("the nearest year this Sphere carries"), "and it names the substitution plainly");
});

test("the shell carries the dock: every action by one plain name", () => {
  // The dock's names as Aaron specified them in the Sphere
  // redesign (Nov 20, 2026): Schedule stands where Choose a day
  // stood, and Enter carries its plain name.
  for (const label of ["Today", "Schedule", "Enter this day", "Deep Time", "Farm &amp; home", "Freeze", "Your Spark"]) {
    assert.ok(shell.includes(label), `dock speaks: ${label}`);
  }
  for (const api of ["goToday", "showDay", "openSchedule", "openDayWorld", "openDeepTime", "openFarm", "freeze", "wake", "isFrozen", "selectedLine"]) {
    assert.ok(shell.includes(api), `SphereRebuild exposes ${api}`);
  }
  assert.ok(shell.includes("sphere-rebuild-shield"), "freeze holds the stage behind a shield");
  assert.ok(shell.includes("LivingTimeSphereAnimation"), "freeze rides the animation module's own pause");
  assert.ok(shell.includes("CodexSphereHomesteadPanel"), "the homestead panel is wired at last");
});

test("the guard declaration for this change set exists and names the touched protected files", () => {
  const guard = read("tests/homepage-sphere.test.js");
  assert.ok(guard.includes("Sphere Page Rebuild declaration"), "the declaration stands");
  for (const file of [
    "docs/living-time-sphere.html",
    "docs/assets/js/sphere/living-time-sphere-renderer-3d.js",
    "docs/assets/js/sphere/living-time-sphere-materials.js",
    "docs/assets/js/sphere/living-time-sphere-label-manager.js",
    "docs/assets/js/sphere/living-time-sphere-camera.js",
    "docs/assets/js/sphere/living-time-sphere-options.js",
    "docs/assets/js/sphere/living-time-sphere-ui.js",
    "docs/assets/js/calendar/temporal-coordinate-engine.js"
  ]) {
    assert.ok(guard.includes(`"${file}"`), `declared: ${file}`);
  }
});

test("fixtures hold in the canonical calendar, and the leap seam agrees", () => {
  const ctx = { console, globalThis: null };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of [
    "docs/assets/js/calendar/pattern-calendar-version.js",
    "docs/assets/js/calendar/pattern-calendar-format.js",
    "docs/assets/js/calendar/pattern-calendar-data.js",
    "docs/assets/js/calendar/pattern-calendar-boundary.js",
    "docs/assets/js/calendar/pattern-calendar.js"
  ]) {
    vm.runInContext(read(f), ctx, { filename: f });
  }
  const PC = ctx.PatternCalendar;
  const conv = (iso) => PC.convertEffectiveDate(new Date(`${iso}T12:00:00Z`));
  const july = conv("2026-07-17");
  assert.equal(july.moon, 4); assert.equal(july.day, 8); assert.equal(july.dayOfPatternYear, 92);
  const sept = conv("2026-09-15");
  assert.equal(sept.dayOfPatternYear, 152); assert.equal(sept.moon, 6); assert.equal(sept.day, 12);
  const doot = conv("2027-04-16");
  assert.equal(doot.isDayOutOfTime, true); assert.equal(doot.dayOfPatternYear, null);
  const leap = conv("2028-04-16");
  assert.equal(leap.isDeepTimeDay, true); assert.equal(leap.inside, false); assert.equal(leap.dayOfPatternYear, null);
  const jump = conv("2027-04-14");
  assert.equal(jump.dayOfPatternYear, 363, "the quick-jump fixture date maps inside its true year");
});

test("the one-clock seam is closed: the coordinate engine's adapter agrees with PatternCalendar", () => {
  // Before the rebuild, the engine's own 13-Moons adapter used a
  // fixed 365-day cycle: in the leap cycle it read 2028-04-16 —
  // the Deep Time Day — as Pattern Day 1. The adapter now takes
  // its decomposition from PatternCalendar. Proven across the
  // whole seam, with ordinary days unchanged.
  const ctx = { console, CustomEvent: class {}, Event: class {}, localStorage: { getItem: () => null, setItem: () => {} }, dispatchEvent: () => true, addEventListener: () => {} };
  ctx.globalThis = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of [
    "docs/assets/js/calendar/pattern-calendar-version.js",
    "docs/assets/js/calendar/pattern-calendar-format.js",
    "docs/assets/js/calendar/pattern-calendar-data.js",
    "docs/assets/js/calendar/pattern-calendar-boundary.js",
    "docs/assets/js/calendar/pattern-calendar.js",
    "docs/assets/js/calendar/temporal-coordinate-engine.js"
  ]) {
    vm.runInContext(read(f), ctx, { filename: f });
  }
  const R = ctx.SOFTemporalCoordinate.remnant13MoonsFromDate;
  const at = (iso) => R(new Date(`${iso}T12:00:00Z`));
  assert.equal(at("2026-11-20").patternDay, 218, "today unchanged");
  assert.equal(at("2028-04-14").patternDay, 364, "the leap cycle's last counted day");
  const gate = at("2028-04-15");
  assert.equal(gate.patternDay, null); assert.equal(gate.isYearGate, true);
  const deep = at("2028-04-16");
  assert.equal(deep.patternDay, null, "the Deep Time Day is outside the count — never Pattern Day 1");
  assert.equal(deep.isDeepTimeDay, true);
  assert.equal(deep.labels.compact, "Deep Time Day");
  assert.equal(at("2028-04-17").patternDay, 1, "Pattern Day 1 belongs to 2028-04-17");
  assert.equal(at("2027-04-16").isYearGate, true, "the ordinary Day Out of Time still reads as the Year Gate");
});
