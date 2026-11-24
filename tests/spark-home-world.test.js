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
const plain = (v) => JSON.parse(JSON.stringify(v));

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

test("the world module's one sanctioned write: the carried line, and nothing else", () => {
  const src = read("assets/js/spark-home-world.js");
  /* Slice 5 amends slice 4's no-write fence by the design's own
   * word (§1.4): the first fetch of a keepsake writes ONE line
   * on the keepsake's own Atlas record, through the repository's
   * put. That is the module's only repository write — pinned by
   * count, so no second write can slip in unnamed. The carry's
   * life lines go through the inhabitant's writer door, never
   * through this module's own hand. */
  const puts = src.match(/\.put\(/g) || [];
  assert.equal(puts.length, 1, "exactly one repository write stands in the module: the carried line's");
  assert.ok(src.includes("carriedLineForRecord"), "the one write is the carried line's grammar");
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

/* --------------------- the Spark speaks at home --------------------- */

test("the Spark's speech at home is carried whole: the day's remark and its reactions", () => {
  const record = sparkRecordWithDays([210, 212, 215]);
  const companion = Core.generate(record.seed);
  const remark = Core.livingDayRemarkFor({ record, companion, today: TODAY, hour: 15 });
  assert.ok(remark.line.includes("Moon 8"), "the day remark speaks from the canonical cursor's own coordinate");
  const m = model({
    sparkRecord: record,
    companion,
    sparkSpeech: {
      dayLine: remark.line,
      reactions: [Core.convoLineFor({ companion, beat: "pet" }), Core.convoLineFor({ companion, beat: "poke" })]
    }
  });
  assert.equal(m.sparkSpeech.dayLine, remark.line, "the day line stands in the model, untampered");
  assert.equal(m.sparkSpeech.reactions.length, 2, "its reactions stand beside it");
  assert.ok(m.sparkSpeech.reactions.every((line) => typeof line === "string" && line.length > 0));
});

test("speech is filtered to honest strings, and a Spark-less world is silent", () => {
  const m = model({ sparkSpeech: { dayLine: 42, reactions: ["Here.", "", null, 7] } });
  assert.equal(m.sparkSpeech.dayLine, null, "a day line that is not words does not stand");
  assert.deepEqual(m.sparkSpeech.reactions, ["Here."], "only true lines are carried");
  const empty = World.buildModel({ today: TODAY, hour: 10, sparkSpeech: { dayLine: "Hello.", reactions: ["Here."] } });
  assert.equal(empty.sparkSpeech, null, "no Spark, no speech — the world does not invent a voice");
});

test("the home page offers the passport door inside Their Home", () => {
  const html = read("companions.html");
  const section = html.slice(html.indexOf('id="spark-home"'), html.indexOf('id="spark-travel"'));
  assert.ok(section.includes('id="spark-home-passport-input"'), "the door's field stands in Their Home");
  assert.ok(section.includes('id="spark-home-passport-go"'), "the door's button stands in Their Home");
  assert.ok(section.includes("Tap your Spark itself and it answers"),
    "the hint tells the keeper the Spark answers a tap, and what it says first");
});

/* ── Slice 4: the home answers the journey ───────────────────
 * The road so far, the gilded stones, the fetch's standing —
 * all read from the inhabitant's derivations, passed in as the
 * journey; the model names only what the record holds. */

const RICH_JOURNEY = {
  stageName: "Bearer",
  moonsKept: 8,
  landsWalked: 6,
  routes: [{ days: [222, 223, 225], learned: true }, { days: [10, 38], learned: false }],
  tricksLearned: ["Bow", "Ripple-Bow", "Fetch the Token"],
  daysClosedTogether: 4,
  hums: [{
    episodeId: "through-the-day-door", title: "Through the Day Door", token: "the Day Door",
    land: "the Observatory", moonName: "Breath Gate",
    rootHz: 174, scale: "Freygish", motifHz: [261, 348, 522], patternDay: 224
  }],
  fetchStands: true,
  lanternStands: true,
  markedDays: [
    { pd: 210, kinds: ["kept"] },
    { pd: 215, kinds: ["token", "kept"] },
    { pd: 66, kinds: ["genesis", "practice"] }
  ]
};

test("a journey the record cannot name degrades to absence, never invention", () => {
  assert.equal(World.journeyFromInput(null), null);
  assert.equal(World.journeyFromInput("a road"), null);
  const partial = World.journeyFromInput({
    moonsKept: "three",
    hums: [{ episodeId: "ep-x" }, { episodeId: "ep-y", motifHz: [440] }],
    markedDays: [{ pd: 400, kinds: ["kept"] }, { pd: 10, kinds: ["witnessed"] }]
  });
  assert.equal(partial.moonsKept, 0, "a Moon count that is not a number is no Moon at all");
  assert.equal(partial.hums.length, 1, "a hum without its motif is no hum");
  assert.deepEqual(plain(partial.markedDays), [{ pd: 10, kinds: ["witnessed"] }], "a day outside the year marks nothing");
});

test("a rich journey fills the road line with the record's own numbers — and only them", () => {
  const m = model({ journey: RICH_JOURNEY });
  assert.match(m.lines.road, /stands Bearer/);
  assert.match(m.lines.road, /8 Moons kept/);
  assert.match(m.lines.road, /6 lands walked/);
  assert.match(m.lines.road, /2 routes shown, 1 of them .*'s own/);
  assert.match(m.lines.road, /3 tricks learned/);
  assert.match(m.lines.road, /4 days closed together/);
  assert.match(m.lines.road, /1 hum learned/);
  assert.equal(m.lines.fetch, null, "when the fetch stands learned, the book carries it — no teaching line");
  assert.deepEqual(plain(m.path.stoneDays), [210, 212, 215], "each stone keeps its day, in the record's own order");
  assert.match(m.lines.path, /1 of them is gilded/,
    "only Pattern Day 215 carries a strong mark (a token's homecoming) among the kept days — a merely kept day's stone stays plain");
  assert.match(m.lines.path, /beyond the keeping itself/);
  assert.equal(m.journey.hums.length, 1);
  assert.equal(m.journey.hums[0].token, "the Day Door");
});

test("a thin journey is honestly spare: the road says so, and the fetch is named but not offered", () => {
  const m = model({ journey: { stageName: "Spark", moonsKept: 0, landsWalked: 0, routes: [], tricksLearned: [], daysClosedTogether: 0, hums: [], fetchStands: false, lanternStands: false, markedDays: [] } });
  assert.match(m.lines.road, /just setting out/);
  assert.match(m.lines.fetch, /not yet learned\. At Bearer/);
  assert.doesNotMatch(m.lines.path, /gilded/, "no marked days, no gilding");
});

test("no journey folds, the road says so — the home does not guess", () => {
  const m = model({});
  assert.equal(m.journey, null);
  assert.match(m.lines.road, /could not be read here/);
  assert.equal(m.lines.fetch, null);
});

test("the story corner's tokens carry their hums, from the watch records", () => {
  const m = model({
    storyWatches: {
      tokens: [
        {
          episodeId: "through-the-day-door",
          line: "Through the Day Door — of the Observatory, under Breath Gate, the Day Door",
          token: "the Day Door", moonName: "Breath Gate",
          hum: { rootHz: 174, scale: "Freygish", motifHz: [261, 348, 522] },
          skill: { n: 1, name: "Read the day", state: "met" },
          watchedOn: "Pattern Day 224", metAgainYears: []
        },
        { episodeId: "ep-bare", line: "A bare watch", token: "a stone", moonName: "", hum: null, skill: null, watchedOn: "Pattern Day 100", metAgainYears: [] }
      ]
    }
  });
  assert.equal(m.storyCorner.tokens[0].hum.motifHz.length, 3);
  assert.equal(m.storyCorner.tokens[1].hum, null, "a token without a hum carries none");
});

/* --------------------- slice 5: the home's temper --------------------- */

test("slice 5 — the home's temper counts what stands in it: spare, settled, full", () => {
  assert.deepEqual(plain(World.homeFullnessFor({})), { score: 0, tier: "spare" });
  assert.deepEqual(plain(World.homeFullnessFor({ keepsakes: 2, tokens: 1, plantedBeds: 1 })), { score: 4, tier: "settled" });
  assert.deepEqual(plain(World.homeFullnessFor({ keepsakes: 3, tokens: 2, plantedBeds: 1 })), { score: 6, tier: "full" });
  const spare = model();
  assert.equal(spare.fullness.tier, "spare");
  assert.match(spare.lines.temper, /spare/);
  assert.match(spare.lines.temper, /small round near the hearth/);
  const full = model({
    atlasRecords: [keepsakeRecord("pressed-leaf", "A", "a"), keepsakeRecord("smooth-stone", "B", "b"), keepsakeRecord("word", "C", "c")],
    storyWatches: { tokens: [
      { episodeId: "ep-1", line: "One", token: "Token One", watchedOn: "2026-11-20" },
      { episodeId: "ep-2", line: "Two", token: "Token Two", watchedOn: "2026-11-21" },
      { episodeId: "ep-3", line: "Three", token: "Token Three", watchedOn: "2026-11-22" }
    ] }
  });
  assert.equal(full.fullness.tier, "full");
  assert.match(full.lines.temper, /full/);
  assert.match(full.lines.temper, /ranges the whole ground/);
});

/* --------------------- slice 5: the carried line --------------------- */

test("slice 5 — a keepsake's carried line passes through to the readout's naming", () => {
  const kept = keepsakeRecord("pressed-leaf", "Leaf", "kept flat");
  const carried = { ...kept, payload: { ...kept.payload, carriedLines: [{ text: "carried to you, 2026-11-24", civilDate: "2026-11-24", patternDay: 222 }] } };
  const plain1 = World.keepsakesFromRecords([kept]);
  assert.equal(plain1[0].carried, null, "no line on the record, no naming");
  const withLine = World.keepsakesFromRecords([carried]);
  assert.equal(withLine[0].carried, "carried to you, 2026-11-24");
  const m = model({ atlasRecords: [carried] });
  assert.equal(m.keepsakes[0].carried, "carried to you, 2026-11-24");
  const corner = World.storyCornerFromFold({ tokens: [
    { episodeId: "ep-1", line: "One", token: "Token One", watchedOn: "2026-11-20", recordId: "watch-1", carried: "carried to you, 2026-11-24" }
  ] });
  assert.equal(corner.tokens[0].recordId, "watch-1", "a token carries its watch record's id for the write path");
  assert.equal(corner.tokens[0].carried, "carried to you, 2026-11-24");
});

/* --------------------- slice 5: the carrying --------------------- */

test("slice 5 — a standing carry is normalized into the journey and named in the words", () => {
  const journey = World.journeyFromInput({
    stageName: "Bearer",
    fetchStands: true,
    carrying: { ref: "keepsake:atlas-9", title: "The Smooth Stone", civilDate: "2026-11-24" }
  });
  assert.deepEqual(plain(journey.carrying), { ref: "keepsake:atlas-9", title: "The Smooth Stone", civilDate: "2026-11-24" });
  assert.equal(World.journeyFromInput({ fetchStands: true }).carrying, null);
  assert.equal(World.journeyFromInput({ carrying: { title: "No ref" } }).carrying, null, "a carry without its ref is no carry");
  const m = model({ journey: { stageName: "Bearer", fetchStands: true, carrying: { ref: "keepsake:atlas-9", title: "The Smooth Stone", civilDate: "2026-11-24" } } });
  assert.match(m.lines.carry, /carrying The Smooth Stone/);
  assert.match(m.lines.carry, /Take it back/);
  const none = model({ journey: { stageName: "Bearer", fetchStands: true } });
  assert.equal(none.lines.carry, null, "no carry standing, no carrying line");
});
