"use strict";

/* The Spark layer reset (Aaron, Nov 20, 2026): "Give them an
 * upgrade and a full reset… We can create these things even
 * better, no?" — with the one invariant standing: character
 * persistence. These tests pin:
 *  - the fresh layer derives identity ONLY from the Spark core's
 *    pinned derivations (the living-voice test vectors of PR #195
 *    pass through the layer's own plan function, unchanged);
 *  - the body-stage rename (Spark / Kindled / Guardian) changed
 *    names only — thresholds and indices untouched;
 *  - the talk panel names its two sources, the agent seat is the
 *    sibling endpoint, and actions run through SphereRebuild;
 *  - the pattern stamp reads the one canonical clock, and the
 *    play summary counts from the record's own stamps;
 *  - no she/her for the Spark anywhere in the new files. */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const Core = require("../docs/assets/js/spark-companion.js");
const Layer = require("../docs/assets/js/sphere-spark.js");

const SEED_A = Core.makeSeed({ moon: 8, patternDay: 216, kindIndex: 1, nonce: "ab12cd34" });

test("persistence: the pinned living-voice vectors pass through the fresh layer unchanged", () => {
  const companion = Core.generate(SEED_A);
  const record = { seed: SEED_A, daysSeen: [], practiceDays: [], pagesSeen: [] };
  const plan = Layer.planNotesFor(Core, companion, record, "greeting", { hour: 12, greeted: true });
  assert.ok(plan, "the layer produces a plan");
  assert.deepEqual(plan.identity.signatureSteps, [0, 2, 3, 3, 1], "signature steps identical to PR #195's pinned vector");
  assert.deepEqual(plan.identity.signature.map((n) => n.f0), [458, 572.5, 611.4, 611.4, 515.3], "signature notes identical");
  assert.deepEqual(plan.identity.variationSteps, [4, 3], "variation steps identical");
  const direct = Core.livingVoiceIdentityFor(companion);
  assert.deepEqual(plan.identity, direct, "the layer's identity IS the core's derivation, byte for byte");
});

test("the stage rename changed names only: thresholds and indices stand", () => {
  assert.deepEqual(Core.STAGES.map((s) => s.name), ["Spark", "Kindled", "Guardian"]);
  assert.deepEqual(Core.STAGES.map((s) => s.min), [0, 8, 25], "thresholds untouched");
  assert.equal(Core.stageFor(0).index, 0);
  assert.equal(Core.stageFor(8).index, 1);
  assert.equal(Core.stageFor(25).index, 2);
  assert.deepEqual(Core.LIVING_VOICE_STAGES.map((s) => s.id), ["spark", "kindled", "bearer", "guardian"], "the voice ladder keeps all four of Aaron's names");
});

test("router rule 2 reaches the Sphere route: the child-mode gate reads the Spark's own memory store", () => {
  const box = new Map();
  const storage = { getItem: (k) => box.get(k) ?? null, setItem: (k, v) => box.set(k, v), removeItem: (k) => box.delete(k) };
  assert.equal(Layer.childModeFor(storage, SEED_A), false, "no store on the device, no gate");
  box.set(Layer.memoryKeyFor(SEED_A), JSON.stringify({ childMode: true, beliefs: [], outcomes: [], mindLog: [] }));
  assert.equal(Layer.childModeFor(storage, SEED_A), true, "the keyed store's child flag gates the Sphere route");
  box.set(Layer.memoryKeyFor(SEED_A), JSON.stringify({ childMode: false, beliefs: [], outcomes: [], mindLog: [] }));
  assert.equal(Layer.childModeFor(storage, SEED_A), false, "the flag off is the gate off");
  const legacyBox = new Map();
  const legacyStorage = { getItem: (k) => legacyBox.get(k) ?? null, setItem: (k, v) => legacyBox.set(k, v), removeItem: (k) => legacyBox.delete(k) };
  legacyBox.set(Layer.MEMORY_KEY, JSON.stringify({ childMode: true, beliefs: [], outcomes: [], mindLog: [] }));
  assert.equal(Layer.childModeFor(legacyStorage, SEED_A), true, "a legacy store not yet carried over still gates — the promise holds before migration too");
  assert.equal(Layer.childModeFor(null, SEED_A), false, "no storage at all: no gate, and no throw");
});

test("the Sphere's memory key and child notice are pinned to the keeper mind's copies", () => {
  const Mind = require("../docs/assets/js/spark-keeper-mind.js");
  assert.equal(Layer.MEMORY_KEY, Mind.MEMORY_KEY, "one legacy key, named in both clients");
  assert.equal(Layer.memoryKeyFor(SEED_A), Mind.memoryKeyFor(SEED_A), "one keyed-store formula, in both clients");
  assert.equal(Layer.memoryKeyFor(null), Mind.memoryKeyFor(null), "the no-seed fallback agrees too");
  assert.equal(Layer.CHILD_NOTICE, Mind.CHILD_NOTICE, "a child hears the same words on the Sphere as at the seat");
});

test("the child gate stands in ask() before the talking-door POST", () => {
  const src = read("docs/assets/js/sphere-spark.js");
  const gate = src.indexOf("childModeFor(window.localStorage");
  const post = src.indexOf('method: "POST"');
  assert.ok(gate > -1, "ask() checks the child-mode gate");
  assert.ok(post > -1 && gate < post, "the gate is checked before any POST to the talking door can happen");
});

test("the local router answers record questions on-device and nothing else", () => {
  assert.equal(Layer.classifyLocal("what day is it today?"), "today");
  assert.equal(Layer.classifyLocal("who are you?"), "who");
  assert.equal(Layer.classifyLocal("how many days together?"), "days");
  assert.equal(Layer.classifyLocal("play me your motif"), "motif");
  assert.equal(Layer.classifyLocal("what patterns do you see?"), "patterns");
  assert.equal(Layer.classifyLocal("tell me a story about dragons"), null, "everything else belongs to the talking door");
});

test("the pattern stamp reads the canonical clock; the play summary counts its stamps", () => {
  const fakeGlobal = {
    SOFTemporalCursor: {
      resolvePosition: () => ({ moon: 8, day: 22, dayOfPatternYear: 218, patternYear: 1, civilDate: "2026-11-20" })
    }
  };
  const stamp = Layer.patternStamp(fakeGlobal, new Date("2026-11-20T18:30:00"));
  assert.equal(stamp.patternDay, 218);
  assert.equal(stamp.daypart, "dusk", "18:30 is dusk in the house's own bands");
  const record = {
    playLog: [
      { kind: "hunt", stamp: { moon: 8, patternYear: 1, daypart: "dusk" } },
      { kind: "echo", stamp: { moon: 8, patternYear: 1, daypart: "dusk" } },
      { kind: "hunt", stamp: { moon: 3, patternYear: 1, daypart: "dawn" } }
    ]
  };
  const summary = Layer.playSummary(record, stamp);
  assert.equal(summary.total, 3);
  assert.equal(summary.thisMoon, 2);
  assert.equal(summary.usualDaypart, "dusk");
});

test("the talk panel names its sources and the seat is the sibling endpoint", () => {
  const src = read("docs/assets/js/sphere-spark.js");
  assert.ok(src.includes("/.netlify/functions/spark-agent"), "the Spark seat endpoint");
  assert.ok(src.includes("From your record, on this device"), "on-device answers are labelled");
  assert.ok(src.includes("Through the talking door"), "door answers are labelled");
  assert.ok(src.includes("SphereRebuild"), "page actions run through the shell's API");
  for (const name of Layer.ACTION_NAMES) assert.ok(src.includes(name), `action wired: ${name}`);
  assert.ok(src.includes("SpeechRecognition"), "speech in where the browser supports it");
  assert.ok(src.includes("speechSynthesis"), "spoken replies in the device voice");
  assert.ok(src.includes("sphere-spark-nameplate"), "the name plate exists");
  assert.ok(src.includes("500"), "the name-call hold is timed");
});

test("the reset is real: the companion layer no longer builds a Spark presence", () => {
  const layer = read("docs/assets/js/sphere-companion-layer.js");
  assert.ok(!layer.includes("sphere-nori-orbit"), "old orbit gone");
  assert.ok(!layer.includes("startOrbit"), "old orbit machinery gone");
  const presence = read("docs/assets/js/sphere-spark.js");
  assert.ok(presence.includes("sphere-spark-orbit"), "the fresh orbit stands in the new layer");
});

test("the Spark never rests in the corner: first frame at build, a chosen station when frozen", () => {
  const src = read("docs/assets/js/sphere-spark.js");
  // Aaron's report (Nov 23, 2026): the Spark sat still at the
  // face's edge. The holder's stylesheet default is the stage's
  // top-left corner, and the frozen gate only returned early —
  // so a gated loop left the Spark in the corner, or frozen at
  // an arbitrary orbit point. Now the first frame is written
  // at build, and a frozen Sphere parks the Spark at the same
  // resting station the reduced-motion Spark keeps.
  assert.ok(src.includes("orbit(performance.now());"), "first frame written at build");
  assert.ok(src.includes("const stationSpark = () => {"), "the orbit path carries the station");
  assert.ok(src.includes('holder.dataset.parked = "frozen"'), "the frozen park is marked on the holder");
  assert.ok(src.includes("delete holder.dataset.parked"), "the park clears when the Sphere wakes");
});

test("pronoun rule: no she/her for the Spark in the new files", () => {
  for (const rel of ["docs/assets/js/sphere-spark.js", "docs/assets/js/sphere-rebuild.js", "docs/assets/js/sphere-play.js"]) {
    const src = read(rel);
    assert.ok(!/\bshe\b|\bher\b/i.test(src.replace(/other|whether|here|there|Where|Other/g, "")), `${rel} keeps the pronoun rule`);
  }
  const pageSrc = read("docs/living-time-sphere.html");
  assert.ok(!pageSrc.includes("and her Sphere layer"), "the protected comment from the pronoun sweep is resolved");
});

test("the quiet promise has its release in the Voice room, keeper-controlled and reversible", () => {
  const presence = read("docs/assets/js/spark-presence.js");
  assert.ok(presence.includes("Release the quiet promise"), "the release stands in the Voice room");
  assert.ok(presence.includes("Keep a quiet promise"), "and it can be kept again — reversible");
  assert.ok(presence.includes("removeItem(SOUND_KEY)"), "the release lifts the old switches' stored word");
});

test("scheduling by word of mouth: the parser reads the keeper's phrasings (Nov 22, 2026)", () => {
  // Today in the test is Pattern Day 220 of anchor year 2026
  // (Moon 8 · Day 24, 2026-11-22) — the day Aaron gave the order.
  const today = { patternDay: 220, anchorYear: 2026, civilDate: "2026-11-22" };
  const a = Layer.parseScheduleCommand("schedule Tomatoes on Moon 5 Day 16", today);
  assert.equal(a.action, "schedule");
  assert.equal(a.title, "Tomatoes");
  assert.equal(a.category, "task");
  assert.equal(a.patternDay, 128);
  assert.equal(a.moon, 5);
  assert.equal(a.day, 16);
  // Moon 5 Day 16 of anchor 2026 has passed by Nov 22, so the
  // next standing of that day is anchor 2027's.
  assert.equal(a.anchorYear, 2027);
  assert.equal(a.civilDate, "2027-08-22");

  const b = Layer.parseScheduleCommand("Schedule a reminder: Call the landlord on Pattern Day 221", today);
  assert.equal(b.category, "reminder");
  assert.equal(b.title, "Call the landlord");
  assert.equal(b.patternDay, 221);
  assert.equal(b.anchorYear, 2026);
  assert.equal(b.civilDate, "2026-11-23");

  const c = Layer.parseScheduleCommand("unschedule Tomatoes on Moon 5 Day 16", today);
  assert.equal(c.action, "unschedule");
  assert.equal(c.title, "Tomatoes");
  assert.equal(c.patternDay, 128);

  const d = Layer.parseScheduleCommand("schedule Water the beds tomorrow", today);
  assert.equal(d.patternDay, 221);
  assert.equal(d.title, "Water the beds");

  const e = Layer.parseScheduleCommand("schedule Fix the gate", today);
  assert.equal(e.needsDay, true, "no day named — the Spark asks which day");
  assert.equal(e.title, "Fix the gate");

  assert.equal(Layer.parseScheduleCommand("tell me a story about dragons", today), null, "ordinary talk is not a command");
  assert.equal(Layer.parseScheduleCommand("what day is it today?", today), null, "questions stay questions");
});

test("the pattern-day to civil-date conversion matches the house fixtures", () => {
  assert.equal(Layer.civilDateForPatternDay(2026, 92), "2026-07-17", "Pattern Day 92 = Moon 4 Day 8 = July 17, 2026");
  assert.equal(Layer.civilDateForPatternDay(2026, 152), "2026-09-15", "Pattern Day 152 = Moon 6 Day 12 = September 15, 2026");
  assert.equal(Layer.civilDateForPatternDay(2026, 1), "2026-04-17", "Moon 1 Day 1 is the anchor, April 17");
  assert.equal(Layer.anchorYearForCivil("2026-11-22"), 2026);
  assert.equal(Layer.anchorYearForCivil("2027-02-01"), 2026, "before April 17 the year still belongs to the 2026 anchor");
  assert.equal(Layer.anchorYearForCivil("2027-04-17"), 2027);
});

test("scheduling is written to the one planner record, on-device, and the greeting stands in the panel", () => {
  const src = read("docs/assets/js/sphere-spark.js");
  assert.ok(src.includes("CodexLivingPlanner"), "the Spark writes through the planner — the same record the planner room reads");
  assert.ok(src.includes("createPlan"), "scheduling creates the plan in that record");
  assert.ok(src.includes("removePlan"), "unscheduling removes it from the same record — reversible");
  assert.ok(src.includes("sof:life-atlas-records-changed"), "the Sphere hears the change and redraws the day's mark");
  assert.ok(src.includes("You are standing in Moon"), "the greeting names where the keeper stands in the year");
  assert.ok(src.includes("The next marked day in your record is"), "and notices the record's marked days");
});
