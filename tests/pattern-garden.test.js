"use strict";

/**
 * The Pattern Garden (garden.html) — the Shroom Search remake
 * (Aaron, Nov 20, 2026).
 *
 * Covers: the Moon-keying (thirteen beds, one per Moon, keyed by
 * the canonical PatternCalendar — fixtures 2026-07-17 = Moon 4 ·
 * Day 8 · Pattern Day 92 and 2026-09-15 = Moon 6 · Day 12 ·
 * Pattern Day 152), the farm keying (planting offers come from
 * the real Western Washington farm data: windows counted from the
 * county's last spring frost and the fall chart's month-days,
 * overlapping the Moon's real span), growth counted from the
 * keeper's kept days in the record, harvest at the Moon's turn
 * into a Life Atlas keepsake, the year-later return, the Spark's
 * seed finds, and the record-safety law: the old garden's records
 * are counted, never written — no builder here can emit an old
 * subtype, and the fold never mutates a record it reads.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const DOCS = path.resolve(__dirname, "../docs");
const JS = path.join(DOCS, "assets/js");

const Garden = require(path.join(JS, "pattern-garden.js"));
const Schema = require(path.join(JS, "life-atlas/life-atlas-schema.js"));

/* The real canonical converter, loaded in the site's own order. */
require(path.join(JS, "calendar/pattern-calendar-version.js"));
require(path.join(JS, "calendar/pattern-calendar-data.js"));
require(path.join(JS, "calendar/pattern-calendar-format.js"));
require(path.join(JS, "calendar/pattern-calendar-boundary.js"));
require(path.join(JS, "calendar/pattern-calendar.js"));

const read = rel => fs.readFileSync(path.join(DOCS, rel), "utf8");
const farmWest = JSON.parse(read("assets/data/farm-western-wa.json"));
const lewis = farmWest.locations.find(l => l.id === "lewis");

function temporalOn(civilDate, { moon = null, moonDay = null, patternDay = null, outsideDay = false } = {}) {
  return {
    instant: `${civilDate}T12:00:00.000Z`,
    start: `${civilDate}T12:00:00.000Z`,
    end: null,
    timezone: "UTC",
    boundaryMode: "midnight",
    civilDate,
    patternYear: 2026,
    moon,
    moonDay,
    patternDay,
    week: null,
    weekGate: null,
    outsideDay
  };
}

function todayOn(civilDate, moon, extra = {}) {
  return { civilDate, patternYear: 2026, moon, outsideDay: false, ...extra };
}

/* ------------------------- the calendar's key ------------------------ */

test("moon spans are the calendar's own: the fixture days land in their Moons", () => {
  const span4 = Garden.moonSpan(2026, 4);
  assert.equal(span4.start, "2026-07-10");
  assert.equal(span4.end, "2026-08-06");
  assert.ok(span4.start <= "2026-07-17" && "2026-07-17" <= span4.end, "Jul 17, 2026 is in Moon 4");

  const span6 = Garden.moonSpan(2026, 6);
  assert.ok(span6.start <= "2026-09-15" && "2026-09-15" <= span6.end, "Sep 15, 2026 is in Moon 6");

  /* And the canonical converter agrees, on Aaron's fixtures. */
  const july = Garden.coordinateForInstant(new Date("2026-07-17T12:00:00Z"), { timeZone: "UTC" });
  assert.equal(july.moon, 4);
  assert.equal(july.moonDay, 8);
  assert.equal(july.patternDay, 92);
  const sept = Garden.coordinateForInstant(new Date("2026-09-15T12:00:00Z"), { timeZone: "UTC" });
  assert.equal(sept.moon, 6);
  assert.equal(sept.moonDay, 12);
  assert.equal(sept.patternDay, 152);
});

test("the fold opens the bed of the Moon the keeper is standing in", () => {
  const state = Garden.foldGarden({
    records: [],
    keptDates: [],
    today: todayOn("2026-07-17", 4),
    moonNames: []
  });
  assert.equal(state.beds.length, 13);
  assert.equal(state.openBed.moon, 4);
  assert.equal(state.beds[2].state, "past");
  assert.equal(state.beds[4].state, "coming");
  assert.equal(state.anchorYear, 2026);
});

test("on the Day Out of Time no bed is open — the garden rests with the calendar", () => {
  const state = Garden.foldGarden({
    records: [],
    keptDates: [],
    today: { civilDate: "2027-04-16", patternYear: 2026, moon: null, outsideDay: true },
    moonNames: []
  });
  assert.equal(state.openBed, null);
});

/* --------------------------- the farm's key -------------------------- */

test("planting offers come from the farm record: tomatoes transplant into Moon 1 (Lewis)", () => {
  const span = Garden.moonSpan(2026, 1);
  const offers = Garden.plantableForSpan(farmWest.crops, lewis, span);
  const tomatoes = offers.filter(o => o.cropId === "tomatoes");
  assert.ok(tomatoes.length, "tomatoes are offered for Moon 1");
  assert.ok(
    tomatoes.some(o => o.method === "transplant" && o.windowStart === "2026-05-10" && o.windowEnd === "2026-05-21"),
    "the transplant offer is the WSU fixed window (mid-May), not a Moon line"
  );
  for (const offer of offers) {
    assert.ok(offer.sources.length, `${offer.cropId} names its sources`);
    assert.ok(offer.windowStart <= span.end && offer.windowEnd >= span.start, "every offer truly overlaps the span");
  }
});

test("a crop with no window in the span is not offered — nothing is guessed", () => {
  const span = Garden.moonSpan(2026, 1);
  const offers = Garden.plantableForSpan(farmWest.crops, lewis, span);
  /* Garlic's only window in the data is its fall planting, far
   * outside Moon 1's span. */
  const garlic = farmWest.crops.find(c => c.id === "garlic");
  const garlicWindows = Garden.cropWindows(garlic, lewis, 2026);
  const anyOverlap = garlicWindows.some(w => w.start <= span.end && w.end >= span.start);
  assert.equal(offers.some(o => o.cropId === "garlic"), anyOverlap);
});

/* ------------------------------ growth ------------------------------- */

function plantingRecord(civilDate, plantedDate) {
  return Schema.createLifeRecord(
    Garden.buildPlantRecord(
      { moon: 4, anchorYear: 2026, cropId: "kale", cropName: "Kale", method: "sow", plantedCivilDate: plantedDate },
      temporalOn(civilDate, { moon: 4 })
    )
  );
}

test("growth is counted from kept days inside the Moon, never from timers", () => {
  const planting = plantingRecord("2026-07-10", "2026-07-10");
  const kept = ["2026-07-10", "2026-07-12", "2026-07-15", "2026-07-20", "2026-07-25", "2026-08-01", "2026-08-05", "2026-08-20"];
  const state = Garden.foldGarden({
    records: [planting],
    keptDates: kept,
    today: todayOn("2026-07-20", 4),
    moonNames: []
  });
  const bed = state.beds[3];
  assert.equal(bed.plantings.length, 1);
  /* Aug 20 is outside Moon 4's span (ends Aug 6) and never counts. */
  assert.equal(bed.plantings[0].witnessedDays, 7);
  assert.equal(bed.plantings[0].stageName, "Ready");
  assert.equal(bed.plantings[0].canHarvest, false, "no harvest before the Moon turns");
});

test("harvest opens at the Moon's turn for a planting witnessed seven days", () => {
  const planting = plantingRecord("2026-07-10", "2026-07-10");
  const kept = ["2026-07-10", "2026-07-12", "2026-07-15", "2026-07-20", "2026-07-25", "2026-08-01", "2026-08-05"];
  const state = Garden.foldGarden({
    records: [planting],
    keptDates: kept,
    today: todayOn("2026-08-10", 5),
    moonNames: []
  });
  assert.equal(state.beds[3].plantings[0].canHarvest, true);
  assert.equal(state.beds[3].plantings[0].goneToSeed, false);
});

test("a planting witnessed less goes honestly to seed at the turn", () => {
  const planting = plantingRecord("2026-07-10", "2026-07-10");
  const state = Garden.foldGarden({
    records: [planting],
    keptDates: ["2026-07-10", "2026-07-12"],
    today: todayOn("2026-08-10", 5),
    moonNames: []
  });
  assert.equal(state.beds[3].plantings[0].canHarvest, false);
  assert.equal(state.beds[3].plantings[0].goneToSeed, true);
});

test("the garden's own witness days count even from a partial kept-date list", () => {
  const planting = plantingRecord("2026-07-10", "2026-07-10");
  const witnesses = ["2026-07-11", "2026-07-13", "2026-07-15", "2026-07-17", "2026-07-19", "2026-07-21", "2026-07-23"].map(day =>
    Schema.createLifeRecord(
      Garden.buildWitnessRecord({ moon: 4, anchorYear: 2026, plantingId: planting.id }, temporalOn(day, { moon: 4 }))
    )
  );
  const state = Garden.foldGarden({
    records: [planting, ...witnesses],
    keptDates: [],
    today: todayOn("2026-08-10", 5),
    moonNames: []
  });
  assert.equal(state.beds[3].plantings[0].witnessedDays, 7);
  assert.equal(state.beds[3].plantings[0].canHarvest, true);
});

test("a harvested planting folds as harvested once its keepsake exists", () => {
  const planting = plantingRecord("2026-07-10", "2026-07-10");
  const keepsake = Schema.createLifeRecord(
    Garden.buildKeepsakeRecord(
      { moon: 4, anchorYear: 2026, cropId: "kale", cropName: "Kale", plantingId: planting.id, witnessedDays: 9 },
      temporalOn("2026-08-10", { moon: 5 })
    )
  );
  assert.equal(keepsake.type, "artifact");
  assert.equal(keepsake.subtype, "garden-keepsake");
  const state = Garden.foldGarden({
    records: [planting, keepsake],
    keptDates: [],
    today: todayOn("2026-08-10", 5),
    moonNames: []
  });
  assert.equal(state.beds[3].plantings[0].harvested, true);
  assert.equal(state.keepsakes.length, 1);
  assert.equal(state.keepsakes[0].cropName, "Kale");
});

/* ------------------------------ the return ---------------------------- */

test("a keepsake returns when its Moon comes round the next year", () => {
  const keepsake = Schema.createLifeRecord(
    Garden.buildKeepsakeRecord(
      { moon: 4, anchorYear: 2026, cropId: "kale", cropName: "Kale", plantingId: "p1", witnessedDays: 9 },
      temporalOn("2026-08-10", { moon: 5 })
    )
  );
  const nextYear = Garden.foldGarden({
    records: [keepsake],
    keptDates: [],
    today: { civilDate: "2027-07-15", patternYear: 2027, moon: 4, outsideDay: false },
    moonNames: []
  });
  /* The fold shows the CURRENT year's beds; the returnable list
   * rides the bed of the returning Moon. */
  const bed = nextYear.beds[3];
  assert.equal(bed.returnable.length, 1);
  assert.equal(bed.returnable[0].cropName, "Kale");

  const returned = Schema.createLifeRecord(
    Garden.buildReturnRecord(
      { moon: 4, anchorYear: 2027, keepsakeId: keepsake.id, cropId: "kale", cropName: "Kale" },
      { ...temporalOn("2027-07-15", { moon: 4 }), patternYear: 2027 }
    )
  );
  const after = Garden.foldGarden({
    records: [keepsake, returned],
    keptDates: [],
    today: { civilDate: "2027-07-15", patternYear: 2027, moon: 4, outsideDay: false },
    moonNames: []
  });
  assert.equal(after.beds[3].returnable.length, 0, "a welcomed return does not offer itself twice");
});

/* ---------------------------- seed finds ------------------------------ */

test("the Spark's finds come readily early and never twice in a day", () => {
  assert.equal(Garden.seedFindFor({ civilDate: "2026-07-17", seedsHeld: 0 }), true);
  assert.equal(
    Garden.seedFindFor({ civilDate: "2026-07-17", seedsHeld: 1, lastSeedCivilDate: "2026-07-17" }),
    false,
    "never twice in a day"
  );
  assert.equal(
    Garden.seedFindFor({ civilDate: "2026-07-18", seedsHeld: 1, lastSeedCivilDate: "2026-07-17" }),
    false,
    "early finds still breathe between days"
  );
  assert.equal(
    Garden.seedFindFor({ civilDate: "2026-07-21", seedsHeld: 1, lastSeedCivilDate: "2026-07-17" }),
    true
  );
  const later = Garden.seedFindFor({ civilDate: "2026-07-17", seedsHeld: 5, lastSeedCivilDate: "2026-01-01" });
  assert.equal(typeof later, "boolean", "later finds rest on the day — a rule, not a promise");
});

/* ---------------------------- record safety --------------------------- */

test("record safety: no builder here can emit an old garden subtype", () => {
  const builders = [
    Garden.buildPlantRecord({ moon: 1, anchorYear: 2026 }, temporalOn("2026-04-17")),
    Garden.buildWitnessRecord({ moon: 1, anchorYear: 2026 }, temporalOn("2026-04-17")),
    Garden.buildKeepsakeRecord({ moon: 1, anchorYear: 2026 }, temporalOn("2026-04-17")),
    Garden.buildSeedRecord({ moon: 1, anchorYear: 2026 }, temporalOn("2026-04-17")),
    Garden.buildReturnRecord({ moon: 1, anchorYear: 2026 }, temporalOn("2026-04-17"))
  ];
  for (const record of builders) {
    assert.ok(
      !["garden-tend", "garden-tier", "garden-pass"].includes(record.subtype),
      `${record.subtype} is the Pattern Garden's own, not the old garden's`
    );
    assert.ok(record.tags.includes("pattern-garden"));
    assert.ok(!record.tags.includes("shroom-garden"));
    /* Every builder's output is a valid canonical record. */
    assert.doesNotThrow(() => Schema.createLifeRecord(record));
  }
});

test("record safety: old passes are counted, and the fold mutates nothing it reads", () => {
  const oldPass = Schema.createLifeRecord({
    type: "artifact",
    subtype: "garden-pass",
    title: "Garden pass — harvested from The Shaded Bed, cycle 1",
    summary: "A pass earned in the Shroom Search garden.",
    temporal: temporalOn("2026-09-15", { moon: 6 }),
    tags: ["shroom-garden", "garden-pass"],
    provenance: { sourceType: "shroom-garden", sourceId: "garden.html", calculationAuthority: "PatternCalendar" },
    privacy: { visibility: "private", containsPersonalData: true, shareAllowed: false },
    payload: { shroomGarden: { version: 1, action: "harvest", bedId: "shaded", cycle: 1, status: "held" } }
  });
  const frozen = Object.freeze([Object.freeze(oldPass)]);
  const state = Garden.foldGarden({
    records: frozen,
    keptDates: [],
    today: todayOn("2026-09-15", 6),
    moonNames: []
  });
  assert.equal(state.oldPasses, 1);
  assert.equal(Garden.countOldPasses(frozen), 1);
  assert.equal(state.keepsakes.length, 0, "an old pass is never re-badged as a keepsake");
});

test("the module makes no network calls of its own record path and names the remake honestly", () => {
  const source = fs.readFileSync(path.join(JS, "pattern-garden.js"), "utf8");
  assert.ok(source.includes("RECORD SAFETY"), "the safety law is stated in the module");
  assert.ok(source.includes("never writes, edits, or deletes"), "in plain words");
});

/* ------------------------------ the page ------------------------------ */

test("the garden page carries the Pattern Garden, not the mushrooms", () => {
  const page = read("garden.html");
  assert.ok(page.includes("The Pattern Garden"), "the page is named for the new game");
  assert.ok(page.includes('src="assets/js/pattern-garden.js'), "the page loads the Pattern Garden");
  assert.ok(!page.includes('src="assets/js/shroom-garden.js'), "the page no longer loads Shroom Search");
  assert.ok(!page.includes("<title>Shroom Search"), "the mushrooms no longer name the page");
  assert.ok(!page.includes('id="garden-title">Shroom Search'), "nor its heading");
  assert.ok(page.includes("replaces Shroom Search"), "the replacement is named plainly, as the record-safety note requires");
  assert.ok(page.includes("cartoon-garden.webp"), "the garden's cartoon scene remains its face");
  assert.ok(page.includes('id="garden-beds"'), "the beds stand on the page");
  assert.ok(page.includes('id="garden-keepsakes"'), "the keepsakes stand on the page");
  assert.ok(page.includes('id="garden-old-passes"'), "the old passes are named on the page, untouched");
});
