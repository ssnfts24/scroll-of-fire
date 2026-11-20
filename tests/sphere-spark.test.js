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
