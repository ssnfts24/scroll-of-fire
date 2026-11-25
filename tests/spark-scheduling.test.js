"use strict";

/**
 * spark-scheduling.test.js — the scheduling programme's pins
 * (Nov 24, 2026, Aaron's rulings): the Spark parses by word and
 * voice, PROPOSES before it writes, writes only on the keeper's
 * yes through the one planner path, projects beacons from record
 * lines only under the density cap, generates under the
 * generative clause, stays silent on scheduling in child mode,
 * and leaves the Spark's identity untouched.
 *
 * The pure core is tested directly; the panel and marker layers
 * are pinned by their source discipline, the house pattern for
 * DOM-bound modules.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const Core = require(path.join(ROOT, "docs/assets/js/spark-schedule-core.js"));

// Tuesday, November 24, 2026 — Moon 8 · Day 26, Pattern Day 222.
const CTX = { todayCivil: "2026-11-24", todayPatternDay: 222, todayAnchorYear: 2026 };

function planRecord({ id, title, category = "task", date, status = "planned", time = null, patternYear, patternDay }) {
  const stamp = Core.stampForCivil(date);
  return {
    id, title, subtype: category,
    temporal: {
      civilDate: date,
      patternYear: patternYear != null ? patternYear : stamp.patternYear,
      patternDay: patternDay != null ? patternDay : stamp.patternDay,
      moon: stamp.moon, moonDay: stamp.day, outsideDay: stamp.outsideDay,
    },
    payload: {
      schedule: {
        kind: "task", status, allDay: !time,
        start: time ? `${date}T${time}:00` : null,
        startDate: time ? null : date, endDate: date,
      },
    },
  };
}

test("the parser reads the keeper's phrasings — weekday, time, both calendars", () => {
  const a = Core.parseScheduleRequest("remind me to call the hall on Thursday at 10am", CTX);
  assert.equal(a.kind, "schedule");
  assert.equal(a.title, "Call the hall");
  assert.equal(a.time, "10:00");
  assert.equal(a.stamp.civilDate, "2026-11-26", "Thursday from Tuesday Nov 24 is Nov 26");
  assert.equal(a.stamp.patternDay, 224);
  assert.equal(a.stamp.moon, 8);
  assert.equal(a.stamp.day, 28);

  const b = Core.parseScheduleRequest("schedule Tomatoes on Moon 5 Day 16", CTX);
  assert.equal(b.stamp.patternDay, 128);
  assert.equal(b.stamp.civilDate, "2027-08-22", "a passed Pattern day takes its next standing — parity with the first-generation parser");

  const c = Core.parseScheduleRequest("schedule Water the beds on Nov 27", CTX);
  assert.equal(c.stamp.civilDate, "2026-11-27");
  assert.equal(c.stamp.patternDay, 225);
  assert.equal(c.stamp.moon, 9);
  assert.equal(c.stamp.day, 1);

  const d = Core.parseScheduleRequest("schedule Fix the gate", CTX);
  assert.equal(d.needsDay, true, "no day named — the Spark asks, it does not guess");

  const e = Core.parseScheduleRequest("schedule Something on Moon 14 Day 3", CTX);
  assert.equal(e.kind, "invalid");

  assert.equal(Core.parseScheduleRequest("tell me a story about dragons", CTX), null, "ordinary talk is not an intent");
  assert.equal(Core.parseScheduleRequest("what day is it today?", CTX), null, "questions stay questions");
});

test("the parser reads asking, finishing, moving, removing, and generating", () => {
  assert.deepEqual(Core.parseScheduleRequest("what's on Thursday", CTX).ask, "day");
  assert.equal(Core.parseScheduleRequest("what's next", CTX).ask, "next");
  assert.equal(Core.parseScheduleRequest("what's overdue", CTX).ask, "overdue");
  const done = Core.parseScheduleRequest("mark Call the hall done", CTX);
  assert.equal(done.kind, "complete");
  assert.equal(done.title, "Call the hall");
  const move = Core.parseScheduleRequest("move Water the beds to Friday", CTX);
  assert.equal(move.kind, "move");
  assert.equal(move.stamp.civilDate, "2026-11-27");
  const un = Core.parseScheduleRequest("unschedule Tomatoes on Moon 5 Day 16", CTX);
  assert.equal(un.kind, "unschedule");
  const gen = Core.parseScheduleRequest("make me a quiet schedule for tomorrow", CTX);
  assert.equal(gen.kind, "generate");
  assert.equal(gen.keyword, "quiet");
  assert.equal(gen.stamp.civilDate, "2026-11-25");
  const genRandom = Core.parseScheduleRequest("make me a random schedule", CTX);
  assert.equal(genRandom.mode, "random");
});

test("view commands parse to the public actions and nothing else", () => {
  assert.deepEqual(Core.parseShowCommand("show me Moon 9", CTX), { action: "moon", moon: 9 });
  assert.deepEqual(Core.parseShowCommand("take me to today", CTX), { action: "today" });
  assert.deepEqual(Core.parseShowCommand("show me the whole year", CTX), { action: "year" });
  assert.deepEqual(Core.parseShowCommand("follow the day-line back a year", CTX), { action: "dayLine", years: -1 });
  assert.deepEqual(Core.parseShowCommand("same day next year", CTX), { action: "dayLine", years: 1 });
  assert.deepEqual(Core.parseShowCommand("turn on the planets layer", CTX), { action: "layer", slot: "planets", on: true });
  assert.deepEqual(Core.parseShowCommand("turn off the schedule marks", CTX), { action: "layer", slot: "markers", on: false });
  assert.equal(Core.parseShowCommand("tell me a story", CTX), null);
  assert.equal(Core.parseShowCommand("schedule the farm visit on Friday", CTX), null, "a scheduling sentence is not a view command");
});

test("the timeline computes states from record lines only", () => {
  const plans = [
    planRecord({ id: "1", title: "Old task", date: "2026-11-20" }),
    planRecord({ id: "2", title: "Done thing", date: "2026-11-21", status: "completed" }),
    planRecord({ id: "3", title: "Today thing", date: "2026-11-24", time: "09:00" }),
    planRecord({ id: "4", title: "Future thing", date: "2026-11-30" }),
    planRecord({ id: "5", title: "Cancelled thing", date: "2026-11-25", status: "cancelled" }),
  ];
  const timeline = Core.buildTimeline(plans, "2026-11-24");
  assert.equal(timeline.length, 4, "cancelled lines leave the timeline");
  assert.deepEqual(timeline.map((e) => [e.title, e.state]), [
    ["Old task", "overdue"],
    ["Done thing", "done"],
    ["Today thing", "today"],
    ["Future thing", "upcoming"],
  ]);
  assert.equal(timeline[2].time, "09:00", "a timed line keeps its time");
});

test("the marker model: one beacon per day, worst state leads, the cap is exact", () => {
  const plans = [
    planRecord({ id: "1", title: "A", date: "2026-11-24" }),
    planRecord({ id: "2", title: "B", date: "2026-11-24", status: "completed" }),
    planRecord({ id: "3", title: "C", date: "2026-11-20" }),
    planRecord({ id: "4", title: "Other year", date: "2027-11-24" }),
  ];
  const model = Core.markerModel(plans, 2026, "2026-11-24");
  assert.equal(model.beacons.length, 2, "one beacon per day in the face's year; the other year's line does not project");
  const today = model.beacons.find((b) => b.patternDay === 222);
  assert.equal(today.count, 2, "the day's things cluster into one beacon with a count");
  assert.equal(today.state, "today", "today outranks done on the same plate");
  const overdue = model.beacons.find((b) => b.patternDay === 218);
  assert.equal(overdue.state, "overdue");

  const many = [];
  for (let i = 0; i < 30; i += 1) {
    many.push(planRecord({ id: `m${i}`, title: `Thing ${i}`, date: Core.addDays("2026-11-24", i + 1) }));
  }
  const capped = Core.markerModel(many, 2026, "2026-11-24");
  assert.equal(capped.beacons.length, Core.MARKER_CAP, "never more beacons than the density budget");
  assert.equal(Core.MARKER_CAP, 24, "the cap is the Day World density budget");
  assert.equal(capped.foldedDays, 6, "folded days are counted honestly, never silently dropped");
});

test("the generative clause: every item traceable, teaching, honestly labelled", () => {
  for (const [mode, keyword] of [["random", null], ["keyword", "quiet"], ["keyword", "garden"], ["keyword", "deep work"], ["keyword", "family"]]) {
    const gen = Core.generateSchedule(
      { titles: ["Water the beds"], planCount: 6, practiceDays: 5, usualDaypart: "dawn", keywordKnown: true },
      { mode, keyword, stamp: Core.stampForCivil("2026-11-25"), rng: Core.rngFrom("seed-1") });
    assert.ok(gen.items.length >= 3, `${mode}/${keyword} composes a day`);
    for (const item of gen.items) {
      assert.ok(["record", "keyword", "lot"].includes(item.source), `item source is traceable: ${item.title} (${item.source})`);
      assert.ok(item.sourceLine && item.sourceLine.length > 2, "every item names its source in words");
      assert.ok(item.why && item.why.length > 10, "every item carries its teaching line (Aaron's cross-note, Nov 24)");
      assert.ok(item.time, "every item carries a suggested time");
    }
    assert.equal(gen.starter, false, "a rich record is not labelled a starter");
    const again = Core.generateSchedule(
      { titles: ["Water the beds"], planCount: 6, practiceDays: 5, usualDaypart: "dawn", keywordKnown: true },
      { mode, keyword, stamp: Core.stampForCivil("2026-11-25"), rng: Core.rngFrom("seed-1") });
    assert.deepEqual(again.items.map((i) => i.title), gen.items.map((i) => i.title), "a seeded lot is reproducible — declared randomness, not dressed-up knowledge");
  }
  const thin = Core.generateSchedule(
    { titles: [], planCount: 0, practiceDays: 0 },
    { mode: "random", stamp: Core.stampForCivil("2026-11-25"), rng: Core.rngFrom("seed-2") });
  assert.equal(thin.starter, true, "a thin record earns the starter label");
  assert.ok(thin.items.every((i) => i.source !== "record"), "a thin record invents no record items — no facts about a life it does not hold");
  const thinKnowledge = Core.generateSchedule(
    { titles: ["File the papers"], planCount: 9, practiceDays: 9, keywordKnown: false },
    { mode: "keyword", keyword: "garden", stamp: Core.stampForCivil("2026-11-25"), rng: Core.rngFrom("seed-3") });
  assert.equal(thinKnowledge.starter, true, "a keyword domain the record shows no history in earns the starter plan label (thin knowledge, not only a thin record)");
});

test("proposal-before-write: the panel writes only inside a settled proposal", () => {
  const src = read("docs/assets/js/sphere-spark.js");
  assert.ok(!src.includes("handleSchedule"), "the first-generation direct-write handler is gone");
  assert.ok(src.includes("Nothing is written until you say yes"), "the proposal card says the law out loud");
  assert.ok(src.includes("pendingProposal"), "a proposal can settle by word as by button");
  const askAt = src.indexOf("if (intent.kind && childModeFor");
  const handleAt = src.indexOf("await handleIntent(intent)");
  assert.ok(askAt > -1 && handleAt > askAt, "the child-mode gate stands before the scheduling branch in ask()");
  for (const fn of ["proposeSchedule", "proposeUnschedule", "proposeComplete", "proposeMove", "proposeGenerated"]) {
    assert.ok(src.includes(`function ${fn}`) || src.includes(`async function ${fn}`), `${fn} stands in the panel`);
  }
  const writeAt = src.indexOf("async function writeSchedule");
  const confirmAt = src.indexOf("onConfirm: () => writeSchedule(intent)");
  assert.ok(writeAt > -1 && confirmAt > -1, "the schedule write is reached only as a proposal's confirmation");
  assert.ok(src.includes("CodexMemory") && src.includes("recordWitness"), "completion writes the day's witness — a completed task is a witnessed touch (Nov 23 ruling)");
});

test("child mode silent: both seats refuse the scheduling family locally", () => {
  const panel = read("docs/assets/js/sphere-spark.js");
  assert.ok(panel.includes("CHILD_SCHEDULE_LINE"), "the Sphere panel holds the plain child line");
  const mind = read("docs/assets/js/spark-keeper-mind.js");
  assert.ok(mind.includes("CHILD_SCHEDULE_LINE"), "the keeper mind holds the same refusal");
  assert.ok(mind.includes("scheduleAnswer"), "the mind reads the timeline through its schedule answer");
  assert.ok(mind.includes("spark-schedule-core.js"), "the mind lazy-loads the one pure core — one parser, one timeline");
  assert.ok(mind.includes("Scheduling itself lives on the Sphere"), "a write request away from the Sphere names the road instead of pretending");
});

test("markers are a projection of record lines only — no second store", () => {
  const src = read("docs/assets/js/sphere-spark-schedule.js");
  assert.ok(src.includes("CodexLivingPlanner"), "the beacons read the one planner record");
  assert.ok(src.includes("markerModel("), "the beacons are the core's model of that record");
  assert.ok(!src.includes("localStorage"), "the marker layer keeps no store of its own");
  assert.ok(!src.includes("sof.spark.v1"), "the marker layer never touches the Spark's own record — identity untouched");
  assert.ok(src.includes("SphereSparkControl"), "the Spark's hands on the Sphere are this layer's public control");
  const coreSrc = read("docs/assets/js/spark-schedule-core.js");
  assert.ok(!coreSrc.includes("localStorage") && !coreSrc.includes("document."), "the core is pure — no storage, no DOM");
});

test("the layers load in their places and the page carries the core", () => {
  const page = read("docs/living-time-sphere.html");
  assert.ok(page.includes("spark-schedule-core.js"), "the Sphere page loads the pure core");
  assert.ok(page.indexOf("spark-schedule-core.js") < page.indexOf("sphere-spark.js"), "the core loads before the panel that reads it");
  const layer = read("docs/assets/js/sphere-companion-layer.js");
  assert.ok(layer.includes("sphere-spark-schedule.js"), "the companion layer loads the schedule layer as it loads the inhabitant");
  assert.ok(layer.includes("sphere-spark-schedule.css"), "with its stylesheet");
});
