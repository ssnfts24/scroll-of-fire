"use strict";

/*
 * The Evolution Opening — how the Sphere grew, told on the Sphere.
 *
 * Unit coverage for the opening's pure core (the flat calendar
 * grid, the first Sphere's portrait drawn from its own build's
 * code, the spiral formulas, the auto-open rule), plus source
 * guards: the opening presents only — it lives outside the
 * protected set, loads through the companion layer's loader, and
 * reads the page's own public records (PatternCalendar, the
 * Alignment Ledger, the Spark core) without ever reaching into
 * the Sphere's kernel.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const opening = require(path.join(root, "docs/assets/js/sphere-evolution-opening.js"));
const source = fs.readFileSync(path.join(root, "docs/assets/js/sphere-evolution-opening.js"), "utf8");
const companionLayer = fs.readFileSync(path.join(root, "docs/assets/js/sphere-companion-layer.js"), "utf8");

test("the deck is four stages and four tour steps, in Aaron's order", () => {
  assert.deepEqual(opening.STAGES.map((s) => s.id),
    ["calendars", "first-sphere", "sphere-now", "spark"]);
  assert.deepEqual(opening.TOUR_STEPS.map((s) => s.id),
    ["meet", "turn", "rings", "keep"]);
});

test("the calendar grid is 13 moons of 28 days from the real names", () => {
  const names = Array.from({ length: 13 }, (_, i) => `Name ${i + 1}`);
  const grid = opening.buildCalendarGrid({ moonNames: names, today: null });
  assert.equal(grid.length, 13);
  assert.equal(grid.reduce((n, m) => n + m.days.length, 0), 364);
  assert.equal(grid[0].name, "Name 1");
  assert.equal(grid[12].moon, 13);
  assert.ok(grid.every((m) => !m.isTodayMoon));
});

test("today's cell is flagged exactly once, on the house fixture", () => {
  // House fixture: 2026-07-17 = Moon 4 Day 8, Pattern Day 92.
  const grid = opening.buildCalendarGrid({ moonNames: null, today: { moon: 4, day: 8 } });
  const flagged = grid.flatMap((m) => m.days).filter((d) => d.isToday);
  assert.equal(flagged.length, 1);
  assert.equal(grid[3].isTodayMoon, true);
  assert.equal(grid[3].days[7].isToday, true);
  assert.equal(grid[3].name, "Moon 4", "names fall back to numbers, never invented");
});

test("pattern angles follow the first build's convention", () => {
  assert.equal(opening.patternAngleForDayOfYear(1), 0);
  assert.equal(opening.patternAngleForDayOfYear(92), 90); // (91 / 364) * 360
  assert.equal(opening.patternAngleForDayOfYear(364), 359.010989);
});

test("the spiral formulas are the first build's own", () => {
  const range = { start: 2014, end: 2026 };
  assert.equal(opening.spiralRadiusForYear(2014, range), 0);
  assert.equal(opening.spiralRadiusForYear(2026, range), 1);
  assert.equal(opening.spiralAngleForYear(2014, range), 0);
  // (12/12) * 360 * (12/13 + 1) = 692.307692…
  assert.equal(opening.spiralAngleForYear(2026, range), 692.307692);
});

test("the first Sphere portrait draws thirteen numbered wedges", () => {
  const svg = opening.buildFirstSphereSVG({ todayMoon: 8 });
  assert.match(svg, /<svg/);
  assert.equal((svg.match(/<title>Moon \d+<\/title>/g) || []).length, 13);
  assert.equal((svg.match(/<text/g) || []).length, 13);
  // The active moon wears the first build's amber fill.
  assert.match(svg, /rgba\(220,160,80,0\.25\)/);
  // The Year Gate stands at the top, always.
  assert.match(svg, /Year Gate \(Moon 1, Day 1\)/);
});

test("the portrait omits what the record cannot place — never guesses", () => {
  const bare = opening.buildFirstSphereSVG({});
  assert.doesNotMatch(bare, /Equinox Passage/);
  assert.doesNotMatch(bare, /Lunar cycle position/);
  assert.doesNotMatch(bare, /sphere-spiral|100,200,180/);
  const full = opening.buildFirstSphereSVG({
    todayMoon: 1,
    equinoxAngle: 80,
    passageDays: 29,
    lunarAngle: 120,
    studyRange: { start: 2014, end: 2027 },
    years: [
      { year: 2014, equinoxAngle: 79, selected: false },
      { year: 2027, equinoxAngle: 81, selected: true },
    ],
  });
  assert.match(full, /Equinox Passage: 29 days/);
  assert.match(full, /Lunar cycle position/);
  assert.match(full, /rgba\(100,200,180,0\.4\)/, "the teal spiral stands when years are given");
  assert.match(full, /<title>2027<\/title>/);
});

test("auto-open is first-visit only, and never in front of a shared view", () => {
  assert.equal(opening.shouldAutoOpen({ seen: false, sessionShown: false, sharedView: false }), true);
  assert.equal(opening.shouldAutoOpen({ seen: true, sessionShown: false, sharedView: false }), false);
  assert.equal(opening.shouldAutoOpen({ seen: false, sessionShown: true, sharedView: false }), false);
  assert.equal(opening.shouldAutoOpen({ seen: false, sessionShown: false, sharedView: true }), false);
});

test("source guards: the opening presents, and only presents", () => {
  // It never reaches into the Sphere's kernel or its cursor.
  assert.doesNotMatch(source, /SOFTemporalCursor/);
  assert.doesNotMatch(source, /LivingTimeSphereRenderer3d/);
  assert.doesNotMatch(source, /LivingTimeSphereUi/);
  assert.doesNotMatch(source, /LivingTimeSphereDayZoom/);
  // It reads the page's public records, and says so.
  assert.match(source, /PatternCalendar/);
  assert.match(source, /AlignmentLedgerData/);
  assert.match(source, /SparkCompanion/);
  // The demonstration is labelled on its face.
  assert.match(source, /A short demonstration/);
  // First-visit flag + the replay door's name.
  assert.match(source, /sof\.sphere\.evolutionOpening\.v1/);
  assert.match(source, /See how it grew/);
  // The one public control it may press, at the visitor's tap.
  assert.match(source, /data-sgb="today"/);
});

test("the companion layer carries the loader, and nothing else changed shape", () => {
  assert.match(companionLayer, /data-sphere-evolution-opening/);
  assert.match(companionLayer, /sphere-evolution-opening\.js/);
  assert.match(companionLayer, /sphere-evolution-opening\.css/);
});
