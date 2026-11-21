"use strict";

/**
 * Their Home — the Spark's 3D world on the companions page
 * (Aaron, Nov 20, 2026).
 *
 * The law under test: everything standing in the world is there
 * because a real record on the device put it there. The shelf is
 * the hidden layer's keepsake records and nothing else; the
 * garden ring is the Pattern Garden's own fold; the path counts
 * the Spark record's own days; the road marker counts the
 * trail's found chapters against the spine; the home's form is
 * the Spark's own stage, from the same stageOf the companion
 * card uses — this module never re-derives a Spark. And where a
 * record is empty, the world says so plainly instead of dressing
 * the slot.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const DOCS = path.resolve(__dirname, "../docs");
const JS = path.join(DOCS, "assets/js");

/* The canonical calendar, loaded in the site's own order. */
require(path.join(JS, "calendar/pattern-calendar-version.js"));
require(path.join(JS, "calendar/pattern-calendar-data.js"));
require(path.join(JS, "calendar/pattern-calendar-format.js"));
require(path.join(JS, "calendar/pattern-calendar-boundary.js"));
require(path.join(JS, "calendar/pattern-calendar.js"));

const Core = require(path.join(JS, "spark-companion.js"));
const Hidden = require(path.join(JS, "hidden-layer.js"));
const Garden = require(path.join(JS, "pattern-garden.js"));
const Schema = require(path.join(JS, "life-atlas/life-atlas-schema.js"));
const World = require(path.join(JS, "spark-home-world.js"));

const read = rel => fs.readFileSync(path.join(DOCS, rel), "utf8");

const SEED = Core.makeSeed({ moon: 8, patternDay: 217, kindIndex: 1, nonce: "ab12cd34" });

function sparkRecordWithDays(days) {
  let record = Core.newRecord({ seed: SEED, name: "", civilDate: "2026-11-19" });
  for (const d of days) record = Core.recordVisit(record, { patternDay: d, page: "index.html" });
  return record;
}

function temporalOn(civilDate, extra = {}) {
  return {
    instant: `${civilDate}T12:00:00.000Z`,
    start: `${civilDate}T12:00:00.000Z`,
    end: null,
    timezone: "UTC",
    boundaryMode: "midnight",
    civilDate,
    patternYear: 2026,
    moon: null,
    moonDay: null,
    patternDay: null,
    week: null,
    weekGate: null,
    outsideDay: false,
    ...extra
  };
}

function keepsakeRecord(kind, name, detail) {
  return Schema.createLifeRecord(
    Hidden.buildKeepsakeRecord(
      { kind, name, detail, where: "garden", source: "find" },
      temporalOn("2026-11-10")
    )
  );
}

const TODAY = { moon: 8, day: 22, dayOfPatternYear: 218, patternYear: 2, moonName: "Deep Mirror", isDayOutOfTime: false, isDeepTimeDay: false };

function model(overrides = {}) {
  const record = sparkRecordWithDays([210, 212, 215]);
  const companion = Core.generate(record.seed);
  return World.buildModel({
    sparkRecord: record,
    companion,
    stage: Core.stageOf(record, companion),
    displayName: Core.displayName(record, companion),
    atlasRecords: [],
    gardenFold: null,
    trailFinds: {},
    chapters: [],
    today: TODAY,
    hour: 15,
    ...overrides
  });
}

/* ------------------------------ the sky ------------------------------ */

test("the sky's phase comes from the visitor's own hour", () => {
  assert.equal(World.phaseForHour(3), "night");
  assert.equal(World.phaseForHour(6), "dawn");
  assert.equal(World.phaseForHour(12), "day");
  assert.equal(World.phaseForHour(18.5), "dusk");
  assert.equal(World.phaseForHour(22), "night");
});

test("the season is the counted year in quarters from the Year Gate", () => {
  assert.equal(World.seasonForPatternDay(1), "spring");
  assert.equal(World.seasonForPatternDay(92), "summer");
  assert.equal(World.seasonForPatternDay(218), "autumn", "Nov 20, 2026 — Pattern Day 218 — is the year's autumn");
  assert.equal(World.seasonForPatternDay(300), "winter");
  assert.equal(World.seasonForPatternDay(null), "winter", "the Day Out of Time stands at the year's end");
});

/* --------------------------- the Spark itself --------------------------- */

test("the world's Spark is the keeper's own: same seed, same name, same stage", () => {
  const record = sparkRecordWithDays([210, 212, 215]);
  const companion = Core.generate(record.seed);
  const m = model({ sparkRecord: record, companion });
  assert.equal(m.spark.name, Core.displayName(record, companion));
  assert.equal(m.spark.kindName, companion.kindName);
  assert.equal(m.spark.stageIndex, Core.stageOf(record, companion).index);
  assert.equal(m.spark.stageName, Core.stageOf(record, companion).name);
  assert.equal(m.spark.bornMoon, 8);
  assert.equal(m.spark.bornPatternDay, 217);
});

test("the home grows with the Spark's own stage ladder", () => {
  /* Stage 0 — a brand-new Spark: a hearth. */
  const young = sparkRecordWithDays([]);
  const youngCompanion = Core.generate(young.seed);
  const m0 = model({ sparkRecord: young, companion: youngCompanion, stage: Core.stageOf(young, youngCompanion) });
  assert.equal(m0.spark.stageIndex, 0);
  assert.equal(m0.home.form, "hearth");

  /* A faithful record climbs the same ladder stageOf climbs. */
  let grown = Core.newRecord({ seed: SEED, name: "", civilDate: "2026-04-17" });
  for (let d = 1; d <= 30; d++) grown = Core.recordVisit(grown, { patternDay: d, page: `p${d}.html` });
  for (let d = 1; d <= 10; d++) grown = Core.recordPractice(grown, { patternDay: d });
  const grownCompanion = Core.generate(grown.seed);
  const grownStage = Core.stageOf(grown, grownCompanion);
  const m2 = model({ sparkRecord: grown, companion: grownCompanion, stage: grownStage });
  assert.equal(m2.home.stageIndex, grownStage.index);
  assert.equal(m2.home.form, grownStage.index === 2 ? "hall" : grownStage.index === 1 ? "cottage" : "hearth");
});

test("no Spark yet: an undecorated young world, honestly empty", () => {
  const m = World.buildModel({ today: TODAY, hour: 10 });
  assert.equal(m.spark, null);
  assert.equal(m.home.form, "plot");
  assert.equal(m.path.keptDays, 0);
  assert.match(m.lines.home, /undecorated/);
  assert.match(m.lines.shelf, /Your finds will rest here/);
  assert.match(m.lines.path, /no stones yet/i);
  assert.match(m.lines.story, /no chapters walked yet/i);
});

/* ------------------------------ the shelf ------------------------------ */

test("the shelf holds exactly the hidden layer's keepsake records, with their answer cards", () => {
  const leaf = keepsakeRecord("pressed-leaf", "A pressed leaf", "A leaf kept from the Garden, holding the day it grew in.");
  const word = keepsakeRecord("word", "The word Witness", "Witness: a dated record of an observation.");
  const notAKeepsake = Schema.createLifeRecord({
    type: "event",
    subtype: "practice-session",
    title: "A practice session",
    summary: "Not a keepsake.",
    temporal: temporalOn("2026-11-01")
  });
  const gardenKeepsake = Schema.createLifeRecord(
    Garden.buildKeepsakeRecord(
      { moon: 4, anchorYear: 2026, cropId: "kale", cropName: "Kale", plantingId: "x", witnessedDays: 8 },
      temporalOn("2026-08-07")
    )
  );
  const m = model({ atlasRecords: [leaf, word, notAKeepsake, gardenKeepsake] });
  assert.equal(m.keepsakeTotal, 2, "only subtype hidden-keepsake stands on the shelf — garden keepsakes rest by the door instead");
  assert.deepEqual(m.keepsakes.map(k => k.kind).sort(), ["pressed-leaf", "word"]);
  const leafModel = m.keepsakes.find(k => k.kind === "pressed-leaf");
  assert.equal(leafModel.title, leaf.title);
  assert.equal(leafModel.summary, leaf.summary, "the answer card travels with the keepsake, whole");
});

/* ------------------------------ the garden ------------------------------ */

test("the garden ring is the garden's own fold: plantings grow where records say, bare beds stay bare", () => {
  const planting = Schema.createLifeRecord(
    Garden.buildPlantRecord(
      { moon: 4, anchorYear: 2026, cropId: "kale", cropName: "Kale", method: "sow", plantedCivilDate: "2026-07-10" },
      temporalOn("2026-07-10", { moon: 4 })
    )
  );
  const kept = ["2026-07-10", "2026-07-12", "2026-07-15", "2026-07-20", "2026-07-25", "2026-08-01"];
  const fold = Garden.foldGarden({
    records: [planting],
    keptDates: kept,
    today: { civilDate: "2026-07-20", patternYear: 2026, moon: 4, outsideDay: false },
    moonNames: []
  });
  const m = model({ gardenFold: fold });
  assert.equal(m.garden.readable, true);
  assert.equal(m.garden.beds.length, 13);
  assert.equal(m.garden.plantedBeds, 1);
  const bed4 = m.garden.beds[3];
  assert.equal(bed4.plantings.length, 1);
  assert.equal(bed4.plantings[0].cropName, "Kale");
  assert.equal(bed4.plantings[0].witnessedDays, 6, "the world's count is the fold's count — witnessed days inside the Moon");
  assert.equal(m.garden.beds[0].plantings.length, 0, "a bed with no planting record grows nothing");
});

test("an unreadable garden says so, and invents nothing", () => {
  const m = model({ gardenFold: null });
  assert.equal(m.garden.readable, false);
  assert.equal(m.garden.plantedBeds, 0);
  assert.match(m.lines.garden, /could not be read here/);
});

/* ------------------------------- the path ------------------------------- */

test("the path counts the Spark record's own kept days — no more, no fewer", () => {
  const m = model();
  assert.equal(m.path.keptDays, 3);
  assert.match(m.lines.path, /3 stones/);
  const none = World.buildModel({ today: TODAY, hour: 9 });
  assert.equal(none.path.keptDays, 0);
});

/* ------------------------------- the road ------------------------------- */

test("the road marker counts chapters the trail found AND the spine tells", () => {
  const chapters = [
    { id: "the-gate-at-first-light", n: 1, title: "The Gate at First Light" },
    { id: "a-friend-for-the-road", n: 2, title: "A Friend for the Road" },
    { id: "the-wheel", n: 3, title: "The Wheel" }
  ];
  const finds = {
    "the-gate-at-first-light": { patternDay: 200 },
    "a-friend-for-the-road": { patternDay: 205 },
    "a-chapter-not-in-the-spine": { patternDay: 206 }
  };
  const m = model({ trailFinds: finds, chapters });
  assert.equal(m.story.foundCount, 2, "a find the spine does not tell is not counted");
  assert.equal(m.story.furthest, 2);
  assert.equal(m.story.totalChapters, 3);
});

/* --------------------------- the page itself --------------------------- */

test("the companions page carries Their Home: the stage, the readout, the words", () => {
  const html = read("companions.html");
  assert.ok(html.includes('id="spark-home"'), "the section stands on the page");
  assert.ok(html.includes('id="spark-home-stage"'), "the 3D stage has a home");
  assert.ok(html.includes('id="spark-home-readout"'), "taps speak somewhere plain");
  assert.ok(html.includes('id="spark-home-list"'), "the world in words is on the page");
  assert.ok(html.includes("spark-home-world.js"), "the world module is loaded");
  assert.ok(html.includes("spark-home-world.css"), "the world's styles are loaded");
  assert.ok(html.includes("Their Home"), "the room carries Aaron's settled name");
  /* the page's existing doors all keep working */
  assert.ok(html.includes('id="spark-meet"'), "the meeting still stands");
  assert.ok(html.includes('id="spark-companion"'), "the companion card still stands");
  assert.ok(html.includes('id="spark-travel"'), "their record still travels");
});

test("the world module writes nothing: no record is created, edited, or sent", () => {
  const src = read("assets/js/spark-home-world.js");
  assert.ok(!/\.put\(/.test(src), "the world never writes a Life Atlas record");
  assert.ok(!/localStorage\.setItem/.test(src), "the world never writes the Spark's record or any other");
  assert.ok(!/localStorage\.removeItem/.test(src), "the world removes nothing");
  assert.ok(!/XMLHttpRequest|sendBeacon/.test(src), "nothing leaves the device through the world");
});

test("the Spark is never 'she' in the world's words", () => {
  const src = read("assets/js/spark-home-world.js");
  assert.ok(!/\bshe\b|\bher\b|\bhers\b/i.test(src), "pronoun rule: the Spark is its name, 'the Spark', or 'it'");
  const html = read("companions.html");
  const section = html.slice(html.indexOf('id="spark-home"'), html.indexOf('id="spark-travel"'));
  assert.ok(!/\bshe\b|\bher\b/i.test(section), "the section's own copy keeps the rule too");
});
