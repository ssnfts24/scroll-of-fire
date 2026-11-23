"use strict";

/*
 * Temporal Worlds slice — unit coverage for the pure logic the
 * day-world adapter gained: the years stage in the stage machine,
 * the depth names, the years line's bounded range, the trackable
 * inventory (groups cover the record layer's categories exactly
 * once), the symbol rule mirrored from the record layer, and the
 * pattern index + lit-day filtering (kinds, standings, recorded
 * recurrences). Browser behaviour is covered by
 * tests/sphere-temporal-worlds-browser.test.js.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const adapter = require(path.join(root, "docs/assets/js/sphere-day-world-adapter.js"));
const source = fs.readFileSync(path.join(root, "docs/assets/js/sphere-day-world-adapter.js"), "utf8");

test("the stage machine gains a years stage beyond Year View, with hysteresis", () => {
  assert.equal(adapter.stageForDistance(4.6, "year"), "years");
  assert.equal(adapter.stageForDistance(4.45, "year"), "years");
  assert.equal(adapter.stageForDistance(4.44, "year"), "year");
  assert.equal(adapter.stageForDistance(4.3, "years"), "years", "the line holds to 4.25");
  assert.equal(adapter.stageForDistance(4.24, "years"), "year");
  // The Phase B bands are untouched.
  assert.equal(adapter.stageForDistance(3.6, "living"), "year");
  assert.equal(adapter.stageForDistance(1.2, "approach"), "immersive");
});

test("depth names follow the commission's words", () => {
  assert.equal(adapter.depthNameForStage("years"), "Years");
  assert.equal(adapter.depthNameForStage("year"), "Year");
  assert.equal(adapter.depthNameForStage("moon"), "Moon");
  assert.equal(adapter.depthNameForStage("approach"), "Day");
  assert.equal(adapter.depthNameForStage("living"), "Day");
  assert.equal(adapter.depthNameForStage("immersive"), "Inside the day");
  assert.deepEqual([...adapter.DEPTH_CRUMBS], ["Years", "Year", "Moon", "Day", "Inside the day"]);
});

test("the years line runs Year 1 through the current year plus a bounded road ahead", () => {
  assert.deepEqual(adapter.yearsLineRange(2026, 2026), [2026, 2027, 2028]);
  assert.deepEqual(adapter.yearsLineRange(2027, 2027), [2026, 2027, 2028, 2029]);
  assert.deepEqual(adapter.yearsLineRange(null, null), [2026, 2027, 2028]);
  // A keeper standing further out still finds their year on the line.
  assert.deepEqual(adapter.yearsLineRange(2026, 2031), [2026, 2027, 2028, 2029, 2030, 2031]);
  assert.equal(adapter.EPOCH_ALIGNMENT_YEAR, 2026);
  assert.equal(adapter.YEARS_AHEAD, 2);
});

test("the pattern groups cover the record layer's categories exactly once", () => {
  const grouped = adapter.PATTERN_GROUPS.flatMap((group) => [...group.categories]);
  const inventory = Object.keys(adapter.SYMBOL_BY_CATEGORY);
  assert.equal(grouped.length, inventory.length, "no category grouped twice or dropped");
  assert.deepEqual([...grouped].sort(), [...inventory].sort());
  // Farm & Home stands first — Aaron named farming himself.
  assert.equal(adapter.PATTERN_GROUPS[0].id, "farm-home");
  for (const farmKind of ["planting", "watering", "harvest", "growing", "livestock", "seasonal", "maintenance"]) {
    assert.ok(adapter.PATTERN_GROUPS[0].categories.includes(farmKind), `${farmKind} is farm & home`);
  }
  for (const category of inventory) {
    assert.ok(adapter.KIND_NAMES[category], `${category} has a human name`);
    assert.ok(Number.isInteger(adapter.COLOUR_BY_CATEGORY[category]), `${category} has the face's colour`);
  }
});

test("the symbol rule mirrors the record layer: explicit, workflow, category", () => {
  const base = { subtype: "task", payload: { planner: { category: "task" } } };
  assert.equal(adapter.symbolForRecord(base), "✓");
  assert.equal(adapter.symbolForRecord({ ...base, payload: { planner: { category: "task", symbol: "🌟" } } }), "🌟");
  assert.equal(adapter.symbolForRecord({ ...base, payload: { planner: { category: "task", symbol: "auto" } } }), "✓");
  assert.equal(adapter.symbolForRecord({ ...base, payload: { planner: { category: "task", workflow: "codex-of-reality" } } }), "✎");
  assert.equal(adapter.symbolForRecord({ ...base, payload: { planner: { category: "task", workflow: "living-phone" } } }), "☎");
  assert.equal(adapter.symbolForRecord({ subtype: "watering", payload: {} }), "💧");
  assert.equal(adapter.symbolForRecord({ subtype: "something-new", payload: {} }), "●");
  assert.equal(adapter.categoryForRecord({ subtype: "Farming", payload: {} }), "farming");
});

/* ── Pattern index fixtures ── */

const TODAY = { patternYear: 2026, patternDay: 220, nowHour: 12 };

function planRecord({ id, category, day, year = 2026 }) {
  return {
    id,
    title: `Plan ${id}`,
    subtype: category,
    tags: ["living-planner", category],
    provenance: { source: "living-planner" },
    temporal: { patternYear: year, patternDay: day },
    payload: { planner: { category } },
  };
}

function schedulingFor(schedules = {}) {
  return {
    getSchedule(record) {
      return schedules[record.id] || { priority: "normal", status: "planned", allDay: true, recurrence: { frequency: "none" } };
    },
    isCompleted(record) {
      const schedule = schedules[record.id];
      return Boolean(schedule && (schedule.status === "completed" || schedule.completedAt));
    },
  };
}

test("pattern entries read the one record: states, priority, recurrence", () => {
  const scheduling = schedulingFor({
    done: { priority: "normal", status: "completed", allDay: true, recurrence: { frequency: "none" } },
    weekly: { priority: "high", status: "planned", allDay: true, recurrence: { frequency: "weekly", interval: 1 } },
  });
  const done = adapter.patternEntryForRecord(planRecord({ id: "done", category: "task", day: 100 }), scheduling, TODAY);
  assert.equal(done.completed, true);
  assert.equal(done.overdue, false, "completed work is never overdue");
  const standing = adapter.patternEntryForRecord(planRecord({ id: "old", category: "task", day: 100 }), scheduling, TODAY);
  assert.equal(standing.completed, false);
  assert.equal(standing.overdue, true, "a standing record on a past day is overdue");
  const weekly = adapter.patternEntryForRecord(planRecord({ id: "weekly", category: "watering", day: 230 }), scheduling, TODAY);
  assert.equal(weekly.important, true);
  assert.deepEqual(weekly.recurrence, { frequency: "weekly", interval: 1 });
  assert.equal(weekly.symbol, "💧");
  // Not the planner's record — never tracked.
  assert.equal(adapter.patternEntryForRecord(
    { id: "x", subtype: "task", temporal: { patternYear: 2026, patternDay: 5 }, payload: {} },
    scheduling, TODAY
  ), null);
  // Outside the counted year — no pattern day to light.
  assert.equal(adapter.patternEntryForRecord(
    planRecord({ id: "y", category: "task", day: 400 }), scheduling, TODAY
  ), null);
});

test("lit days: kinds light exactly their days, with counts", () => {
  const records = [
    planRecord({ id: "p1", category: "planting", day: 100 }),
    planRecord({ id: "w1", category: "watering", day: 110 }),
    planRecord({ id: "w2", category: "watering", day: 110 }),
    planRecord({ id: "h1", category: "harvest", day: 120 }),
    planRecord({ id: "t1", category: "task", day: 130 }),
    planRecord({ id: "p2", category: "planting", day: 100, year: 2027 }),
  ];
  const index = adapter.buildPatternIndex(records, schedulingFor(), TODAY);
  const farm = new Set(adapter.PATTERN_GROUPS[0].categories);
  const farmLit = adapter.litDaysFor(index, { categories: farm, standing: "any" });
  assert.deepEqual(farmLit.map((lit) => `${lit.year}:${lit.day}`), ["2026:100", "2026:110", "2026:120", "2027:100"]);
  const watering = adapter.litDaysFor(index, { categories: new Set(["watering"]), standing: "any" });
  assert.equal(watering.length, 1);
  assert.equal(watering[0].count, 2, "the count counts records on the day");
  assert.equal(watering[0].primarySymbol, "💧");
  const travel = adapter.litDaysFor(index, { categories: new Set(["travel"]), standing: "any" });
  assert.deepEqual(travel, [], "a kind with no records lights nothing");
  const counts = adapter.dayCountsByCategory(index);
  assert.equal(counts.get("watering"), 1, "day counts count days, not records");
  assert.equal(counts.get("planting"), 2);
});

test("lit days: standings and recorded recurrences filter honestly", () => {
  const scheduling = schedulingFor({
    done: { priority: "normal", status: "completed", allDay: true, recurrence: { frequency: "none" } },
    weekly: { priority: "normal", status: "planned", allDay: true, recurrence: { frequency: "weekly", interval: 1 } },
  });
  const records = [
    planRecord({ id: "done", category: "task", day: 100 }),
    planRecord({ id: "late", category: "task", day: 110 }),
    planRecord({ id: "weekly", category: "watering", day: 230 }),
    planRecord({ id: "soon", category: "task", day: 240 }),
  ];
  const index = adapter.buildPatternIndex(records, scheduling, TODAY);
  const tasks = new Set(["task"]);
  assert.deepEqual(
    adapter.litDaysFor(index, { categories: tasks, standing: "completed" }).map((lit) => lit.day),
    [100]
  );
  assert.deepEqual(
    adapter.litDaysFor(index, { categories: tasks, standing: "overdue" }).map((lit) => lit.day),
    [110]
  );
  assert.deepEqual(
    adapter.litDaysFor(index, { categories: tasks, standing: "open" }).map((lit) => lit.day),
    [110, 240]
  );
  const recurring = adapter.litDaysFor(index, { categories: null, standing: "any", recurringOnly: true });
  assert.deepEqual(recurring.map((lit) => lit.day), [230], "only the record carrying a recurrence lights");
});

test("the slice reads the one planner record and writes nothing new", () => {
  assert.match(source, /plansForYears/);
  assert.match(source, /buildPatternIndex/);
  // Patterns and the years line never write: the adapter's only
  // writes remain the planner's own (pinned in the Phase B tests).
  assert.doesNotMatch(source, /\.addRecord\(|\.updateRecord\(|\.deleteRecord\(/);
  assert.doesNotMatch(source, /indexedDB/);
});
