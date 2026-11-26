"use strict";

/**
 * Teach Evolution — the Spark leads the Manifest Practice sitting
 * (Aaron, Nov 25, 2026: the exercise "needs to be very interactive as
 * well" and "your Spark should play into this somehow").
 *
 * Covers: the settle dynamics (the field answers touch and breath),
 * the guide light's path, the Echo Duet (the Spark's own echoFor
 * pattern when a companion is present; the day-dealt pattern when
 * not), the seal's spark block + real duration in the Life Atlas
 * record, the learning proposal (suggests from sealed sittings,
 * applies nothing — the keeper decides), the carrier glide, the
 * child-mode mirror, and the page wiring pins (panel, overlay, Ξ
 * estimate caption, pronoun + framing fences).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const DOCS = path.resolve(__dirname, "../docs");
const JS = path.join(DOCS, "assets/js");

const Spark = require(path.join(JS, "manifest-spark.js"));
const Practice = require(path.join(JS, "manifest-practice.js"));
const Companion = require(path.join(JS, "spark-companion.js"));
const Schema = require(path.join(JS, "life-atlas/life-atlas-schema.js"));

const teachHtml = fs.readFileSync(path.join(DOCS, "teach.html"), "utf8");
const sparkSource = fs.readFileSync(path.join(JS, "manifest-spark.js"), "utf8");

/* ------------------------------ settle ------------------------------ */

test("settle rises while the keeper follows and breathes, eases back otherwise", () => {
  let s = 0;
  for (let i = 0; i < 20; i++) {
    s = Spark.settleStep(s, { following: true, breathing: true, dtSeconds: 1 });
  }
  assert.ok(s >= Spark.SETTLE_TARGET, `settle reached ${s}`);

  let fallen = 0.9;
  for (let i = 0; i < 20; i++) {
    fallen = Spark.settleStep(fallen, { dtSeconds: 1 });
  }
  assert.ok(fallen < 0.9 && fallen >= 0, `settle eased to ${fallen}`);

  /* Deterministic: same inputs, same outputs. */
  assert.equal(
    Spark.settleStep(0.4, { following: true, dtSeconds: 0.5 }),
    Spark.settleStep(0.4, { following: true, dtSeconds: 0.5 })
  );

  /* Clamped at both ends. */
  assert.equal(Spark.settleStep(1, { following: true, breathing: true, dtSeconds: 5 }), 1);
  assert.equal(Spark.settleStep(0, { dtSeconds: 5 }), 0);
});

test("the guide light travels a followable path and stills under reduced motion", () => {
  const a = Spark.lightPosition(10);
  const b = Spark.lightPosition(40);
  assert.ok(a.x >= 0 && a.x <= 1 && a.y >= 0 && a.y <= 1);
  assert.notDeepEqual(a, b, "the light moves");
  assert.deepEqual(Spark.lightPosition(10, { reducedMotion: true }), { x: 0.5, y: 0.5 });
  assert.deepEqual(Spark.lightPosition(99, { reducedMotion: true }), { x: 0.5, y: 0.5 });
});

/* ------------------------------ echo duet ------------------------------ */

test("echo pattern: the Spark's own echoFor when a companion is present", () => {
  const passport = Companion.parsePassportCode("SPK1-8-217-1-IUEBK69Z-SELOR-8I");
  assert.ok(passport, "the keeper's passport reads back");
  const companion = passport.companion;
  const pattern = Spark.echoPatternFor({ companion, round: 2 }, Companion);

  assert.equal(pattern.source, "spark");
  assert.equal(pattern.pads.length, 4);
  assert.ok(pattern.steps.length >= 3);
  assert.ok(pattern.steps.every(step => step >= 0 && step <= 3));

  /* Same companion, same round — the same pattern, every time. */
  assert.deepEqual(
    Spark.echoPatternFor({ companion, round: 2 }, Companion).steps,
    pattern.steps
  );
});

test("echo pattern: dealt from the Pattern Day when no Spark record is held", () => {
  const a = Spark.echoPatternFor({ patternDay: 223, round: 1 });
  const b = Spark.echoPatternFor({ patternDay: 223, round: 1 });
  const c = Spark.echoPatternFor({ patternDay: 224, round: 1 });

  assert.equal(a.source, "day");
  assert.deepEqual(a.steps, b.steps, "same day, same echo");
  assert.notDeepEqual(a.steps, c.steps, "a new day deals a new echo");
});

test("matchEcho scores the keeper's answer as a sequence", () => {
  const pattern = { steps: [2, 0, 3] };

  assert.deepEqual(Spark.matchEcho(pattern, [2, 0, 3]), {
    matched: 3, total: 3, complete: true, failedAt: null
  });
  assert.deepEqual(Spark.matchEcho(pattern, [2, 1]), {
    matched: 1, total: 3, complete: false, failedAt: 1
  });
  assert.equal(Spark.matchEcho(pattern, [2]).complete, false);
  assert.equal(Spark.matchEcho(pattern, []).matched, 0);
});

/* ------------------------------ the seal's record ------------------------------ */

function sealedWithSpark(sparkInput, extra = {}) {
  return Practice.buildSessionRecord(
    {
      intention: "Hold the line",
      sessionKind: "practice",
      carriers: [432],
      visualMode: { value: "3", label: "Rose" },
      durationSeconds: 240,
      spark: sparkInput,
      ...extra
    },
    {}
  );
}

test("the seal carries the spark block and the sitting's real duration", () => {
  const record = sealedWithSpark({
    ledBySpark: true, echoRounds: 2, settlePeak: 0.93, secondsToSettle: 41
  });

  const mp = record.payload.manifestPractice;
  assert.deepEqual(mp.spark, {
    led: true, echoRounds: 2, settlePeak: 0.93, secondsToSettle: 41
  });
  assert.equal(mp.durationSeconds, 240);

  /* The record still validates against the canonical Atlas schema. */
  const normalized = Schema.normalizeLifeRecord(record);
  assert.equal(normalized.subtype, "practice-session");
  assert.equal(normalized.payload.manifestPractice.spark.secondsToSettle, 41);
});

test("without a sitting, the spark block and duration stay honestly null", () => {
  const record = Practice.buildSessionRecord({ intention: "Plain seal" }, {});
  assert.equal(record.payload.manifestPractice.spark, null);
  assert.equal(record.payload.manifestPractice.durationSeconds, null);
});

test("the spark block cleans impossible values instead of storing them", () => {
  const record = sealedWithSpark({
    ledBySpark: "yes", echoRounds: -3, settlePeak: 7, secondsToSettle: -9
  });
  assert.deepEqual(record.payload.manifestPractice.spark, {
    led: false, echoRounds: 0, settlePeak: 1, secondsToSettle: null
  });
});

/* ------------------------------ learning proposal ------------------------------ */

function settledRecord({ carrier = 432, mode = "3", label = "Rose", seconds = 40 } = {}) {
  return sealedWithSpark(
    { ledBySpark: true, echoRounds: 1, settlePeak: 0.9, secondsToSettle: seconds },
    { carriers: [carrier], visualMode: { value: mode, label } }
  );
}

test("suggestSettling proposes the fastest-settling pairing after two sittings", () => {
  const records = [
    settledRecord({ carrier: 432, seconds: 60 }),
    settledRecord({ carrier: 432, seconds: 40 }),
    settledRecord({ carrier: 528, mode: "1", label: "Lattice", seconds: 90 }),
    settledRecord({ carrier: 528, mode: "1", label: "Lattice", seconds: 110 })
  ];

  const suggestion = Spark.suggestSettling(records);
  assert.equal(suggestion.carrierHz, 432);
  assert.equal(suggestion.visualModeValue, "3");
  assert.equal(suggestion.visualModeLabel, "Rose");
  assert.equal(suggestion.sessions, 2);
  assert.equal(suggestion.meanSecondsToSettle, 50);
});

test("suggestSettling stays silent below two settled sittings and ignores unsettled ones", () => {
  assert.equal(Spark.suggestSettling([settledRecord({})]), null);
  assert.equal(Spark.suggestSettling([]), null);

  const unsettled = sealedWithSpark({
    ledBySpark: true, echoRounds: 0, settlePeak: 0.4, secondsToSettle: null
  });
  assert.equal(Spark.suggestSettling([unsettled, unsettled]), null);

  const foreign = { subtype: "note", payload: { manifestPractice: { spark: { secondsToSettle: 1 } } } };
  assert.equal(Spark.suggestSettling([foreign, foreign]), null);
});

test("proposal discipline: the module proposes and never auto-applies", () => {
  /* The only place console settings are written is the Use handler —
     pinned by source: the proposal loader renders text + unhides the
     card; the freq/visMode writes live behind proposalUse's click. */
  const useHandler = sparkSource.indexOf('els.proposalUse?.addEventListener');
  assert.ok(useHandler > -1, "the Use handler exists");

  const loaderStart = sparkSource.indexOf("async function loadProposal()");
  const loaderEnd = sparkSource.indexOf("els.proposalUse?.addEventListener");
  const loader = sparkSource.slice(loaderStart, loaderEnd);
  assert.ok(!/visMode\.value\s*=/.test(loader), "loader never writes the field mode");
  assert.ok(!/freqInput\.value\s*=|freqSlider\.value\s*=/.test(loader), "loader never writes the carrier");

  const proposal = Spark.proposalLine({
    sparkName: "Selor",
    suggestion: Spark.suggestSettling([
      settledRecord({ seconds: 30 }), settledRecord({ seconds: 50 })
    ])
  });
  assert.match(proposal, /Selor has watched your sittings settle/);
  assert.match(proposal, /432 Hz/);
  assert.match(proposal, /The choice stays yours/);
});

/* ------------------------------ tone glide ------------------------------ */

test("the carrier glides toward home only as the keeper settles, in small steps", () => {
  assert.equal(Spark.glideStep(460, 432, 0.9), 457);
  assert.equal(Spark.glideStep(420, 432, 0.9), 423);
  assert.equal(Spark.glideStep(460, 432, 0.1), null, "no glide before settling");
  assert.equal(Spark.glideStep(432, 432, 0.9), null, "already home");
  assert.equal(Spark.glideStep(433, 432, 0.9), null, "within a hertz is home");
});

/* ------------------------------ voices and fences ------------------------------ */

test("the Spark opens by speaking the intention back, and witnesses the seal", () => {
  const open = Spark.openingLine({ sparkName: "Selor", intention: "Be still and know" });
  assert.match(open, /Selor holds your intention with you: “Be still and know”/);
  assert.match(open, /Follow the light/);

  const invite = Spark.openingLine({ sparkName: "", intention: "" });
  assert.match(invite, /The Spark is here to lead the sitting/);
  assert.ok(!/you have not|you haven't|not yet/i.test(invite), "no absence framing");

  const witness = Spark.witnessLine({
    sparkName: "Selor",
    coordinateLabel: "Moon 8 · Day 27 · Pattern Day 223",
    sessionKind: "practice"
  });
  assert.match(witness, /Selor witnessed the seal — Moon 8 · Day 27 · Pattern Day 223 · practice/);
  assert.match(witness, /Life Atlas/);
});

test("child mode follows the mirrored signal and silences the duet's audio", () => {
  const store = new Map();
  const storage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value)
  };

  assert.equal(Spark.childModeHere(storage, "seed-a"), false);
  store.set("sof.spark.memory.v1", JSON.stringify({ childMode: true }));
  assert.equal(Spark.childModeHere(storage, "seed-a"), true);

  /* Audio is gated on the child signal in the browser layer. */
  assert.match(sparkSource, /function chirp\(noteHz\) \{\s*if \(childMode\) return;/);

  /* Nothing in this module leaves the device: no network surface. */
  assert.ok(!/\bfetch\(|XMLHttpRequest|sendBeacon/.test(sparkSource));
});

test("Ξ is captioned as the console's estimate, in copy and in the record", () => {
  assert.match(Spark.XI_CAPTION, /console's coherence estimate/);
  assert.match(Spark.XI_CAPTION, /not a measurement of you/);
  assert.match(teachHtml, /Ξ is the console's coherence estimate — the console's own number, not a measurement of you\./);
  assert.match(Practice.XI_LABEL, /not a measured effect/);
});

/* ------------------------------ page wiring ------------------------------ */

test("teach.html wires the Spark panel, the guide overlay, and the module", () => {
  assert.match(teachHtml, /<canvas id="mpGuide" aria-hidden="true"><\/canvas>/);
  assert.match(teachHtml, /id="mpSparkPanel"/);
  assert.match(teachHtml, /id="mpSparkBegin"/);
  assert.match(teachHtml, /id="mpProposal"[^>]*hidden/);
  assert.match(teachHtml, /id="mpProposalUse"/);
  assert.match(teachHtml, /id="mpEchoPads"/);
  assert.match(teachHtml, /id="mpWitnessLine"/);
  assert.match(teachHtml, /assets\/js\/manifest-spark\.js\?v=20261125-te1/);
  assert.match(teachHtml, /assets\/js\/manifest-practice\.js\?v=20261125-te1/);

  /* The console's field answers through the sitting's hooks. */
  assert.match(teachHtml, /window\.__sofManifestSettle\(\)/);
  assert.match(teachHtml, /window\.__sofManifestTouch\(\)/);
  assert.match(teachHtml, /phi \+= s \* \(1 - 0\.30 \* settleNow\)/);
});

test("the Spark is never gendered in the new copy", () => {
  const panelStart = teachHtml.indexOf('id="mpSparkPanel"');
  const panelEnd = teachHtml.indexOf('id="mpSummaryBody"');
  const panel = teachHtml.slice(panelStart, panelEnd);
  assert.ok(!/\bshe\b|\bher\b/i.test(panel), "panel copy keeps the pronoun rule");
  assert.ok(!/\bshe\b|\bher\b/i.test(sparkSource.replace(/\/\*[\s\S]*?\*\//g, "")), "module copy keeps the pronoun rule");
});
