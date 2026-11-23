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

test("record safety: the fold gives the old garden's passes no window, and mutates nothing it reads", () => {
  /* Aaron removed the Shroom Search passes legacy entirely
   * (Nov 20, 2026), superseding the earlier count-and-name ruling:
   * the fold neither counts a pass nor carries a field for one. */
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
  assert.ok(!("oldPasses" in state), "the fold carries no pass count");
  assert.equal(Garden.countOldPasses, undefined, "the pass counter is removed, not renamed");
  assert.equal(Garden.SUBTYPES.OLD_PASS, undefined, "the pass subtype is no longer exported");
  assert.equal(state.keepsakes.length, 0, "an old pass is never re-badged as a keepsake");
});

test("the module makes no network calls of its own record path and names the remake honestly", () => {
  const source = fs.readFileSync(path.join(JS, "pattern-garden.js"), "utf8");
  assert.ok(source.includes("RECORD SAFETY"), "the safety law is stated in the module");
  assert.ok(source.includes("never writes, edits, or deletes"), "in plain words");
});

/* ----------------- the keeper's ground: thirty-nine counties ----------------- */

const WA_COUNTY_IDS = [
  "adams", "asotin", "benton", "chelan", "clallam", "clark", "columbia",
  "cowlitz", "douglas", "ferry", "franklin", "garfield", "grant",
  "grays-harbor", "island", "jefferson", "king", "kitsap", "kittitas",
  "klickitat", "lewis", "lincoln", "mason", "okanogan", "pacific",
  "pend-oreille", "pierce", "san-juan", "skagit", "skamania",
  "snohomish", "spokane", "stevens", "thurston", "wahkiakum",
  "walla-walla", "whatcom", "whitman", "yakima"
];

test("the farm dataset carries all thirty-nine Washington counties, each with its provenance", () => {
  const ids = farmWest.locations.map(l => l.id).sort();
  assert.deepEqual(ids, [...WA_COUNTY_IDS].sort());
  for (const loc of farmWest.locations) {
    assert.ok(loc.provenance, `${loc.id} carries provenance`);
    assert.ok(
      loc.provenance.kind === "published" || loc.provenance.kind === "computed",
      `${loc.id} provenance is labeled published or computed`
    );
    assert.ok(loc.provenance.basis.length > 40, `${loc.id} provenance names its basis`);
  }
  const computed = farmWest.locations.filter(l => l.provenance.kind === "computed").map(l => l.id);
  assert.deepEqual(computed, ["asotin"], "only Asotin is computed — no NOAA normals station stands in it");
  const asotin = farmWest.locations.find(l => l.id === "asotin");
  assert.ok(asotin.provenance.basis.includes("Ice Harbor Dam"), "the computed county names its anchor stations");
  assert.deepEqual(asotin.frostSources, ["garden-county-rule"], "the computed county cites the stated rule, not a station");
});

test("Lewis County's entered record stands exactly as it was — the expansion added provenance only", () => {
  assert.equal(lewis.lastSpringFrost, "04-22");
  assert.equal(lewis.safeLastSpringFrost, "04-30");
  assert.equal(lewis.firstFallFrost, "10-27");
  assert.equal(lewis.safeFirstFallFrost, "10-19");
  assert.equal(lewis.frostFreeDays, 188);
  assert.equal(lewis.station, "Centralia, WA — NOAA 1991–2020 normals");
  const snohomish = farmWest.locations.find(l => l.id === "snohomish");
  assert.equal(snohomish.lastSpringFrost, "03-24");
  assert.equal(snohomish.safeLastSpringFrost, "05-01");
  assert.equal(snohomish.firstFallFrost, "11-02");
});

test("every county's dates are calendrically sane and its windows never run backwards", () => {
  const stamp = mmdd => { const [m, d] = mmdd.split("-").map(Number); return Date.UTC(2026, m - 1, d); };
  const home = JSON.parse(read("assets/data/farm-homestead-western-wa.json"));
  const crops = [...farmWest.crops];
  for (const cc of home.coverCrops || []) {
    if (cc && cc.id && cc.sowWindow) {
      crops.push({ id: cc.id, name: cc.name, frostClass: "cover", fall: { startMonthDay: cc.sowWindow.start, endMonthDay: cc.sowWindow.end, sources: cc.sources || [] } });
    }
  }
  for (const loc of farmWest.locations) {
    assert.ok(stamp(loc.lastSpringFrost) < stamp(loc.safeLastSpringFrost), `${loc.id}: safe spring stands after the median`);
    assert.ok(stamp(loc.safeFirstFallFrost) < stamp(loc.firstFallFrost), `${loc.id}: safe fall stands before the median`);
    assert.ok(stamp(loc.safeLastSpringFrost) < stamp(loc.safeFirstFallFrost), `${loc.id}: the safe season is a season`);
    for (const crop of crops) {
      for (const year of [2026, 2027]) {
        for (const w of Garden.cropWindows(crop, loc, year)) {
          assert.ok(w.start <= w.end, `${loc.id} ${crop.id} ${w.kind}: window opens before it closes`);
        }
      }
    }
    const offered = new Set();
    for (let moon = 1; moon <= 13; moon++) {
      for (const o of Garden.plantableForSpan(crops, loc, Garden.moonSpan(2026, moon))) offered.add(o.cropId);
    }
    assert.ok(offered.size >= 30, `${loc.id} offers a real table across the year (got ${offered.size})`);
  }
});

test("the county resolves plainly: the keeper's choice, else Lewis, else the first ground", () => {
  const locs = farmWest.locations;
  assert.equal(Garden.DEFAULT_COUNTY_ID, "lewis");
  assert.equal(Garden.resolveCountyId(locs, "king"), "king");
  assert.equal(Garden.resolveCountyId(locs, "multnomah"), "lewis", "an unknown county falls back to the home ground");
  assert.equal(Garden.resolveCountyId(locs, null), "lewis", "no choice yet reads as Lewis — nothing changes for an existing keeper");
  assert.equal(Garden.resolveCountyId([], "king"), null);
  assert.equal(Garden.resolveCountyId([{ id: "king" }], null), "king", "without Lewis in the data, the first ground stands");
});

test("a planting record carries its county, and the fold shows it — changing ground never rewrites it", () => {
  const king = farmWest.locations.find(l => l.id === "king");
  const planting = Schema.createLifeRecord(
    Garden.buildPlantRecord(
      { moon: 4, anchorYear: 2026, cropId: "kale", cropName: "Kale", method: "sow", plantedCivilDate: "2026-07-10", countyId: king.id, countyName: king.county },
      temporalOn("2026-07-10", { moon: 4 })
    )
  );
  const payload = Garden.gardenPayload(planting);
  assert.equal(payload.countyId, "king");
  assert.equal(payload.countyName, "King County");
  const state = Garden.foldGarden({
    records: [planting],
    keptDates: [],
    today: todayOn("2026-07-20", 4),
    moonNames: []
  });
  assert.equal(state.beds[3].plantings[0].countyId, "king");
  assert.equal(state.beds[3].plantings[0].countyName, "King County");
  /* A planting written before counties were stamped still folds, unnamed. */
  const unstamped = Schema.createLifeRecord(
    Garden.buildPlantRecord(
      { moon: 4, anchorYear: 2026, cropId: "kale", cropName: "Kale", method: "sow", plantedCivilDate: "2026-07-10" },
      temporalOn("2026-07-10", { moon: 4 })
    )
  );
  const state2 = Garden.foldGarden({
    records: [unstamped],
    keptDates: [],
    today: todayOn("2026-07-20", 4),
    moonNames: []
  });
  assert.equal(state2.beds[3].plantings[0].countyName, null);
});

test("the picker is remembered on the device and the page names the whole state", () => {
  const source = fs.readFileSync(path.join(JS, "pattern-garden.js"), "utf8");
  assert.ok(source.includes("sof.pattern-garden.county.v1"), "the county rests under the garden's own storage key");
  assert.ok(source.includes("readStoredCountyId"), "the garden reads the remembered county back");
  assert.ok(source.includes("storeCountyId"), "and writes it when the keeper chooses");
  const page = read("garden.html");
  assert.ok(page.includes("thirty-nine counties"), "the page names the whole state's data");
  assert.ok(page.includes("every planting record carries"), "the page states the per-planting county plainly");
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
  assert.ok(!page.includes('id="garden-old-passes"'), "the passes section is gone — Aaron removed the passes legacy (Nov 20, 2026)");
  assert.ok(!page.includes("Your Shroom Search passes"), "no pass display remains on the page");
});

/* ------------- the completion: grading, waiting, doctrine -------------
 * (Nov 23, 2026 — the play redesign's garden answers, built: the
 * harvest line stays 7; below it a planting is tended, not failed,
 * and its seed is gathered back; harvests and returns wait for the
 * keeper's hand; nothing earned evaporates.) */

function temporalYear(civilDate, year, opts = {}) {
  return { ...temporalOn(civilDate, opts), patternYear: year };
}

function todayYear(civilDate, moon, patternYear) {
  return { civilDate, patternYear, moon, outsideDay: false };
}

function plantYear(civilDate, plantedDate, { moon = 4, anchorYear = 2026, cropId = "kale", cropName = "Kale", seedBackPlantingId = null, seedId = null, foundSeed = false } = {}) {
  return Schema.createLifeRecord(
    Garden.buildPlantRecord(
      { moon, anchorYear, cropId, cropName, method: "sow", plantedCivilDate: plantedDate, seedBackPlantingId, seedId, foundSeed },
      temporalYear(civilDate, anchorYear, { moon })
    )
  );
}

function daysFrom(start, count) {
  const out = [];
  const base = new Date(`${start}T12:00:00Z`).getTime();
  for (let i = 0; i < count; i += 1) out.push(new Date(base + i * 86400000).toISOString().slice(0, 10));
  return out;
}

test("the grade line: slept at none, tended below seven, kept at seven, flourished at half the Moon", () => {
  assert.deepEqual([...Garden.GRADES], ["slept", "tended", "kept", "flourished"]);
  assert.equal(Garden.gradeFor(0), "slept");
  assert.equal(Garden.gradeFor(1), "tended");
  assert.equal(Garden.gradeFor(6), "tended");
  assert.equal(Garden.gradeFor(7), "kept");
  assert.equal(Garden.gradeFor(13), "kept");
  assert.equal(Garden.gradeFor(14), "flourished");
  assert.equal(Garden.gradeFor(28), "flourished");
});

test("a turned planting is graded on its bed; a growing one is not graded yet", () => {
  const slept = plantYear("2026-06-12", "2026-06-12", { moon: 3, cropId: "peas", cropName: "Peas" });
  const tended = plantYear("2026-07-10", "2026-07-10", { moon: 4 });
  const keptP = plantYear("2026-08-07", "2026-08-07", { moon: 5, cropId: "beans", cropName: "Beans" });
  const flourished = plantYear("2026-05-15", "2026-05-15", { moon: 2, cropId: "corn", cropName: "Corn" });
  const growing = plantYear("2026-09-04", "2026-09-04", { moon: 6, cropId: "squash", cropName: "Squash" });
  const state = Garden.foldGarden({
    records: [slept, tended, keptP, flourished, growing],
    keptDates: [
      ...daysFrom("2026-07-10", 3),
      ...daysFrom("2026-08-07", 9),
      ...daysFrom("2026-05-15", 15),
      ...daysFrom("2026-09-04", 4)
    ],
    today: todayOn("2026-09-15", 6),
    moonNames: []
  });
  const grade = m => state.beds[m - 1].plantings[0].grade;
  assert.equal(grade(3), "slept");
  assert.equal(state.beds[2].plantings[0].goneToSeed, true);
  assert.equal(grade(4), "tended");
  assert.equal(state.beds[3].plantings[0].goneToSeed, true);
  assert.equal(grade(5), "kept");
  assert.equal(state.beds[4].plantings[0].canHarvest, true);
  assert.equal(grade(2), "flourished");
  assert.equal(grade(6), null, "a planting still inside its Moon is growing, not graded");
});

test("a tended planting's seed is gathered back to head its bed next year — and keeps until planted", () => {
  const tended2026 = plantYear("2026-07-10", "2026-07-10", { moon: 4 });
  const keptDates = daysFrom("2026-07-10", 4);
  const folded = Garden.foldGarden({
    records: [tended2026],
    keptDates,
    today: todayYear("2027-07-20", 4, 2027),
    moonNames: []
  });
  assert.equal(folded.beds[3].seedBacks.length, 1);
  assert.equal(folded.beds[3].seedBacks[0].plantingId, tended2026.id);
  assert.equal(folded.beds[3].seedBacks[0].cropId, "kale");
  assert.equal(folded.beds[3].seedBacks[0].anchorYear, 2026);

  /* Two years on, unplanted, it is still offered. */
  const later = Garden.foldGarden({
    records: [tended2026],
    keptDates,
    today: todayYear("2028-07-20", 4, 2028),
    moonNames: []
  });
  assert.equal(later.beds[3].seedBacks.length, 1);

  /* Once a planting names it, the offer is spent. */
  const planted2027 = plantYear("2027-07-12", "2027-07-12", { moon: 4, anchorYear: 2027, seedBackPlantingId: tended2026.id });
  const after = Garden.foldGarden({
    records: [tended2026, planted2027],
    keptDates,
    today: todayYear("2027-07-20", 4, 2027),
    moonNames: []
  });
  assert.equal(after.beds[3].seedBacks.length, 0);
});

test("no seed is gathered from a kept or a slept planting", () => {
  const keptP = plantYear("2026-07-10", "2026-07-10", { moon: 4, cropId: "beans", cropName: "Beans" });
  const sleptP = plantYear("2026-08-07", "2026-08-07", { moon: 5, cropId: "corn", cropName: "Corn" });
  const folded = Garden.foldGarden({
    records: [keptP, sleptP],
    keptDates: daysFrom("2026-07-10", 9),
    today: todayYear("2027-07-20", 4, 2027),
    moonNames: []
  });
  assert.equal(folded.beds[3].seedBacks.length, 0);
  assert.equal(folded.beds[4].seedBacks.length, 0);
});

test("a past year's Ready planting waits at the garden's head until gathered", () => {
  const ready2025 = plantYear("2025-07-10", "2025-07-10", { moon: 4, anchorYear: 2025 });
  const keptDates = daysFrom("2025-07-10", 10);
  const folded = Garden.foldGarden({
    records: [ready2025],
    keptDates,
    today: todayOn("2026-09-15", 6),
    moonNames: []
  });
  assert.equal(folded.waitingHarvests.length, 1);
  assert.equal(folded.waitingHarvests[0].recordId, ready2025.id);
  assert.equal(folded.waitingHarvests[0].grade, "kept");
  assert.equal(folded.waitingHarvests[0].witnessedDays, 10);
  assert.equal(folded.beds[3].plantings.length, 0, "it waits at the head, not on this year's bed");

  const gathered = Schema.createLifeRecord(
    Garden.buildKeepsakeRecord(
      { moon: 4, anchorYear: 2025, cropId: "kale", cropName: "Kale", plantingId: ready2025.id, witnessedDays: 10 },
      temporalOn("2026-09-15", { moon: 6 })
    )
  );
  const after = Garden.foldGarden({
    records: [ready2025, gathered],
    keptDates,
    today: todayOn("2026-09-15", 6),
    moonNames: []
  });
  assert.equal(after.waitingHarvests.length, 0, "gathered at last — a year late, and nothing was lost");
});

test("a waiting harvest can carry the flourished honour", () => {
  const rich2025 = plantYear("2025-07-10", "2025-07-10", { moon: 4, anchorYear: 2025 });
  const folded = Garden.foldGarden({
    records: [rich2025],
    keptDates: daysFrom("2025-07-10", 16),
    today: todayOn("2026-09-15", 6),
    moonNames: []
  });
  assert.equal(folded.waitingHarvests.length, 1);
  assert.equal(folded.waitingHarvests[0].grade, "flourished");
});

test("a return comes due with its Moon a year on, and waits — on its bed while open, at the head otherwise", () => {
  const keepsake = Schema.createLifeRecord(
    Garden.buildKeepsakeRecord(
      { moon: 4, anchorYear: 2026, cropId: "kale", cropName: "Kale", plantingId: "p1", witnessedDays: 9 },
      temporalOn("2026-08-10", { moon: 5 })
    )
  );
  const k = { anchorYear: 2026, moon: 4 };
  assert.equal(Garden.returnIsDue(k, todayYear("2026-12-01", 9, 2026)), false);
  assert.equal(Garden.returnIsDue(k, todayYear("2027-05-20", 2, 2027)), false);
  assert.equal(Garden.returnIsDue(k, todayYear("2027-07-15", 4, 2027)), true);
  assert.equal(Garden.returnIsDue(k, todayYear("2028-05-01", 1, 2028)), true);

  const early = Garden.foldGarden({ records: [keepsake], keptDates: [], today: todayYear("2027-05-20", 2, 2027), moonNames: [] });
  assert.equal(early.waitingReturns.length, 0);

  const laterMoon = Garden.foldGarden({ records: [keepsake], keptDates: [], today: todayYear("2027-09-10", 6, 2027), moonNames: [] });
  assert.equal(laterMoon.waitingReturns.length, 1);
  assert.equal(laterMoon.beds[3].returnable.length, 0);

  const itsMoon = Garden.foldGarden({ records: [keepsake], keptDates: [], today: todayYear("2027-07-15", 4, 2027), moonNames: [] });
  assert.equal(itsMoon.beds[3].returnable.length, 1);
  assert.equal(itsMoon.waitingReturns.length, 0);

  const welcomed = Schema.createLifeRecord(
    Garden.buildReturnRecord(
      { moon: 4, anchorYear: 2027, keepsakeId: keepsake.id, cropId: "kale", cropName: "Kale" },
      temporalYear("2027-09-10", 2027, { moon: 6 })
    )
  );
  const after = Garden.foldGarden({ records: [keepsake, welcomed], keptDates: [], today: todayYear("2027-09-10", 6, 2027), moonNames: [] });
  assert.equal(after.waitingReturns.length, 0, "welcomed, it waits nowhere");
});

test("payload v2: plantings name their provenance; keepsakes carry grade and provenance", () => {
  const gathered = Garden.buildPlantRecord(
    { moon: 4, anchorYear: 2027, cropId: "kale", cropName: "Kale", method: "sow", plantedCivilDate: "2027-07-12", seedBackPlantingId: "planting-x" },
    temporalYear("2027-07-12", 2027, { moon: 4 })
  );
  assert.equal(gathered.payload.patternGarden.version, 2);
  assert.equal(gathered.payload.patternGarden.provenance, "gathered");
  assert.equal(gathered.payload.patternGarden.seedBackPlantingId, "planting-x");

  const plain = Garden.buildPlantRecord(
    { moon: 4, anchorYear: 2027, cropId: "kale", cropName: "Kale", method: "sow", plantedCivilDate: "2027-07-12" },
    temporalYear("2027-07-12", 2027, { moon: 4 })
  );
  assert.equal(plain.payload.patternGarden.provenance, "chosen");

  const keepRich = Garden.buildKeepsakeRecord(
    { moon: 4, anchorYear: 2026, cropId: "kale", cropName: "Kale", plantingId: "p1", witnessedDays: 16, seedBackPlantingId: "planting-x" },
    temporalOn("2026-08-10", { moon: 5 })
  );
  assert.equal(keepRich.payload.patternGarden.version, 2);
  assert.equal(keepRich.payload.patternGarden.grade, "flourished");
  assert.equal(keepRich.payload.patternGarden.provenance, "gathered");

  const keepPlain = Garden.buildKeepsakeRecord(
    { moon: 4, anchorYear: 2026, cropId: "kale", cropName: "Kale", plantingId: "p2", witnessedDays: 9 },
    temporalOn("2026-08-10", { moon: 5 })
  );
  assert.equal(keepPlain.payload.patternGarden.grade, "kept");
});

test("a v1 keepsake folds with its grade read back from its witnessed count", () => {
  const v1 = Schema.createLifeRecord({
    type: "artifact",
    subtype: "garden-keepsake",
    title: "Garden keepsake — Kale",
    summary: "A keepsake written before grades were named in the payload.",
    temporal: temporalOn("2026-08-10", { moon: 5 }),
    tags: ["pattern-garden", "garden-keepsake"],
    provenance: { sourceType: "pattern-garden", sourceId: "garden.html", calculationAuthority: "PatternCalendar" },
    privacy: { visibility: "private", containsPersonalData: true, shareAllowed: false },
    payload: {
      patternGarden: {
        version: 1, action: "harvest", moon: 4, anchorYear: 2026,
        cropId: "kale", cropName: "Kale", plantingId: "p-old",
        witnessedDays: 16, foundSeed: false, status: "kept"
      }
    }
  });
  const folded = Garden.foldGarden({ records: [v1], keptDates: [], today: todayOn("2026-09-15", 6), moonNames: [] });
  assert.equal(folded.keepsakes.length, 1);
  assert.equal(folded.keepsakes[0].grade, "flourished");
  assert.equal(folded.keepsakes[0].provenance, "chosen");
});

test("days remaining in a Moon counts down to its last day, and is null outside it", () => {
  const span = Garden.moonSpan(2026, 4);
  assert.equal(Garden.daysRemainingInMoon(span, "2026-07-10"), 28);
  assert.equal(Garden.daysRemainingInMoon(span, "2026-08-06"), 1);
  assert.equal(Garden.daysRemainingInMoon(span, "2026-07-09"), null);
  assert.equal(Garden.daysRemainingInMoon(span, "2026-08-07"), null);
  assert.equal(Garden.daysRemainingInMoon(null, "2026-07-10"), null);
});

test("a found seed keeps across years for its Moon until a planting names it", () => {
  const seed = Schema.createLifeRecord(
    Garden.buildSeedRecord(
      { moon: 4, anchorYear: 2025, cropId: "kale", cropName: "Kale" },
      temporalYear("2025-07-20", 2025, { moon: 4 })
    )
  );
  const folded = Garden.foldGarden({ records: [seed], keptDates: [], today: todayYear("2027-07-20", 4, 2027), moonNames: [] });
  assert.equal(folded.seeds.length, 1);
  assert.equal(folded.seeds[0].used, false);
  const planted = plantYear("2027-07-20", "2027-07-20", { moon: 4, anchorYear: 2027, seedId: seed.id, foundSeed: true });
  const after = Garden.foldGarden({ records: [seed, planted], keptDates: [], today: todayYear("2027-07-20", 4, 2027), moonNames: [] });
  assert.equal(after.seeds[0].used, true);
});

test("the completed garden: waiting shelf on the page, no 12-cap, no uproot anywhere", () => {
  const garden = read("assets/js/pattern-garden.js");
  const page = read("garden.html");
  assert.ok(page.includes('id="garden-waiting"'), "the waiting shelf stands on the page");
  assert.ok(!garden.includes("slice(0, 12)"), "the table is whole, grouped by method — nothing capped away");
  assert.ok(!/uprootPlanting|removePlanting|deletePlanting/.test(garden), "no code path removes a planting — once written, it stands");
  assert.ok(page.includes("no uprooting it"), "the page states the doctrine plainly");
  assert.ok(garden.includes("waitingHarvests") && garden.includes("waitingReturns"));
  assert.ok(garden.includes("garden-plant-group"), "the table groups by method");
});

/* ------------------------- the Still Bed -------------------------
 * (Nov 23, 2026 — the play redesign's Ask 3, approved by Aaron
 * with its fence: a fourteenth place, unnumbered, open only on
 * the still days; one keepsake of the year now ending laid down
 * by its own record; found at the next still day; the year's
 * reading at the garden's head.) */

const STILL_DAY_2026 = { civilDate: "2027-04-16", patternYear: 2026, moon: null, outsideDay: true };
const STILL_DAY_2027 = { civilDate: "2028-04-16", patternYear: 2027, moon: null, outsideDay: true };

function keepsakeOf2026(witnessedDays = 9) {
  return Schema.createLifeRecord(
    Garden.buildKeepsakeRecord(
      { moon: 4, anchorYear: 2026, cropId: "kale", cropName: "Kale", plantingId: "p-still", witnessedDays },
      temporalOn("2026-08-10", { moon: 5 })
    )
  );
}

function laidDown(keepsake, laidYear = 2026, laidCivilDate = "2027-04-16") {
  return Schema.createLifeRecord(
    Garden.buildStillRecord(
      { moon: 4, anchorYear: laidYear, keepsakeId: keepsake.id, cropId: "kale", cropName: "Kale", laidCivilDate },
      temporalYear(laidCivilDate, laidYear, { outsideDay: true })
    )
  );
}

test("the still record is its own kind: it names a keepsake and can hold nothing else", () => {
  const keep = keepsakeOf2026();
  const record = Garden.buildStillRecord(
    { moon: 4, anchorYear: 2026, keepsakeId: keep.id, cropId: "kale", cropName: "Kale", laidCivilDate: "2027-04-16" },
    temporalYear("2027-04-16", 2026, { outsideDay: true })
  );
  assert.equal(record.subtype, "garden-still");
  assert.equal(record.type, "event");
  assert.ok(record.tags.includes("pattern-garden") && record.tags.includes("garden-still"));
  assert.doesNotThrow(() => Schema.createLifeRecord(record));
  assert.deepEqual(
    Object.keys(record.payload.patternGarden).sort(),
    ["action", "anchorYear", "cropId", "cropName", "keepsakeId", "laidCivilDate", "moon", "version"],
    "the still payload names a keepsake of the keeper's own Atlas — there is no field for anything else"
  );
  assert.equal(Garden.SUBTYPES.STILL, "garden-still");
});

test("still days are the days outside the count, and a still return comes due a full year on", () => {
  assert.equal(Garden.isStillDay(STILL_DAY_2026), true);
  assert.equal(Garden.isStillDay(todayYear("2027-07-15", 4, 2027)), false);
  assert.equal(Garden.isStillDay(null), false);
  assert.equal(Garden.stillReturnIsDue(2026, STILL_DAY_2026), false, "not on the day it is laid");
  assert.equal(Garden.stillReturnIsDue(2026, todayYear("2027-07-15", 4, 2027)), false, "not during the counted days of the year between");
  assert.equal(Garden.stillReturnIsDue(2026, STILL_DAY_2027), true, "at the next still day");
  assert.equal(Garden.stillReturnIsDue(2026, todayYear("2028-06-01", 3, 2028)), true, "and every day after, until written");
});

test("on a still day the bed opens: a keepsake of the year now ending may be laid down, once", () => {
  const keep = keepsakeOf2026();
  const older = Schema.createLifeRecord(
    Garden.buildKeepsakeRecord(
      { moon: 4, anchorYear: 2025, cropId: "kale", cropName: "Kale", plantingId: "p-old", witnessedDays: 9 },
      temporalYear("2025-08-10", 2025, { moon: 5 })
    )
  );
  const folded = Garden.foldGarden({ records: [keep, older], keptDates: [], today: STILL_DAY_2026, moonNames: [] });
  assert.equal(folded.still.isStillDay, true);
  assert.equal(folded.still.laidThisCycle, false);
  assert.deepEqual(folded.still.eligible.map(k => k.recordId), [keep.id], "only the year now ending's keepsakes may be laid");

  const after = Garden.foldGarden({ records: [keep, older, laidDown(keep)], keptDates: [], today: STILL_DAY_2026, moonNames: [] });
  assert.equal(after.still.laidThisCycle, true);
  assert.equal(after.still.eligible.length, 0, "one keepsake per still cycle — the offer is spent");
  assert.equal(after.still.inGround.length, 1);
  assert.equal(after.still.inGround[0].cropName, "Kale");

  /* On a counted day the bed does not open at all. */
  const counted = Garden.foldGarden({ records: [keep], keptDates: [], today: todayYear("2026-09-15", 6, 2026), moonNames: [] });
  assert.equal(counted.still.isStillDay, false);
  assert.equal(counted.still.eligible.length, 0);
  assert.equal(counted.yearReading, null, "the year's reading stands only on the still days");
});

test("a keepsake in the still ground makes no Moon return — its meeting is the still one", () => {
  const keep = keepsakeOf2026();
  const moonRound = Garden.foldGarden({ records: [keep, laidDown(keep)], keptDates: [], today: todayYear("2027-07-15", 4, 2027), moonNames: [] });
  assert.equal(moonRound.beds[3].returnable.length, 0);
  assert.equal(moonRound.waitingReturns.length, 0);
  assert.equal(moonRound.still.inGround.length, 1);
  assert.equal(moonRound.still.inGround[0].due, false, "its still day has not come yet");
});

test("at the next still day the laid keepsake is found, and its return is written beside it", () => {
  const keep = keepsakeOf2026();
  const laid = laidDown(keep);
  const found = Garden.foldGarden({ records: [keep, laid], keptDates: [], today: STILL_DAY_2027, moonNames: [] });
  assert.equal(found.still.dueFinds.length, 1);
  assert.equal(found.still.dueFinds[0].cropName, "Kale");
  assert.equal(found.still.dueFinds[0].laidYear, 2026);
  assert.equal(found.waitingReturns.length, 0, "on the still day it stands at the bed, not at the head");

  const returned = Schema.createLifeRecord(
    Garden.buildReturnRecord(
      { moon: 4, anchorYear: 2027, keepsakeId: keep.id, cropId: "kale", cropName: "Kale" },
      temporalYear("2028-04-16", 2027, { outsideDay: true })
    )
  );
  const after = Garden.foldGarden({ records: [keep, laid, returned], keptDates: [], today: STILL_DAY_2027, moonNames: [] });
  assert.equal(after.still.dueFinds.length, 0);
  assert.equal(after.still.inGround.length, 0, "met again, it leaves the ground");
});

test("a still return unwritten at the still day waits at the garden's head", () => {
  const keep = keepsakeOf2026();
  const later = Garden.foldGarden({
    records: [keep, laidDown(keep)],
    keptDates: [],
    today: todayYear("2028-06-01", 3, 2028),
    moonNames: []
  });
  assert.equal(later.waitingReturns.length, 1);
  assert.equal(later.waitingReturns[0].stillReturn, true);
  assert.equal(later.waitingReturns[0].laidYear, 2026);
});

test("the year's reading: thirteen lines — kept, flourished, tended, slept, rested", () => {
  const flourishedP = plantYear("2026-05-15", "2026-05-15", { moon: 2, cropId: "corn", cropName: "Corn" });
  const flourishedK = Schema.createLifeRecord(
    Garden.buildKeepsakeRecord(
      { moon: 2, anchorYear: 2026, cropId: "corn", cropName: "Corn", plantingId: flourishedP.id, witnessedDays: 16 },
      temporalOn("2026-06-20", { moon: 3 })
    )
  );
  const tendedP = plantYear("2026-06-12", "2026-06-12", { moon: 3, cropId: "peas", cropName: "Peas" });
  const sleptP = plantYear("2026-07-10", "2026-07-10", { moon: 4 });
  const keptP = plantYear("2026-08-07", "2026-08-07", { moon: 5, cropId: "beans", cropName: "Beans" });
  const keptK = Schema.createLifeRecord(
    Garden.buildKeepsakeRecord(
      { moon: 5, anchorYear: 2026, cropId: "beans", cropName: "Beans", plantingId: keptP.id, witnessedDays: 9 },
      temporalOn("2026-09-10", { moon: 6 })
    )
  );
  const folded = Garden.foldGarden({
    records: [flourishedP, flourishedK, tendedP, sleptP, keptP, keptK],
    keptDates: [...daysFrom("2026-05-15", 15), ...daysFrom("2026-06-12", 3), ...daysFrom("2026-08-07", 9)],
    today: STILL_DAY_2026,
    moonNames: []
  });
  assert.equal(folded.yearReading.length, 13);
  const outcome = m => folded.yearReading[m - 1].outcome;
  assert.equal(outcome(1), "rested");
  assert.equal(outcome(2), "flourished");
  assert.equal(outcome(3), "tended");
  assert.equal(outcome(4), "slept");
  assert.equal(outcome(5), "kept");
  assert.equal(outcome(13), "rested");
});

test("the Still Bed stands on the page, and nothing else in play ever points at it", () => {
  const page = read("garden.html");
  const play = read("assets/js/sphere-play.js");
  const quests = read("assets/js/pattern-quests.js");
  assert.ok(page.includes('id="garden-still-body"'), "the bed's place stands on the page");
  assert.ok(page.includes('id="garden-year-reading"'), "the year's reading stands at the head");
  assert.ok(page.includes("The Still Bed"), "the bed is named plainly");
  for (const src of [play, quests]) {
    assert.ok(!src.includes("Still Bed") && !src.includes("garden-still"), "no game, quest, or hint points at the Still Bed");
  }
});
