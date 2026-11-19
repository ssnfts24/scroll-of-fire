"use strict";

/**
 * Shroom Search — the Garden (garden.html).
 *
 * Covers: the tier ladder counted from records alone, the
 * one-tend-per-bed-per-day rule, the practice-rain window, the
 * harvest → pass flow through the canonical Life Atlas repository
 * (including the Atlas export/backup round-trip), the temporal stamp
 * read from the real PatternCalendar (Aaron's fixtures:
 * 2026-09-15 = Moon 6 · Day 12 · Pattern Day 152;
 * 2026-11-19 = Moon 8 · Day 21 · Pattern Day 217), the record shapes
 * against the canonical schema, the page wiring, and the fences:
 * no network calls in the garden module, no absence-guilt or decay
 * language anywhere in the garden's copy, reduced-motion still mode.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const DOCS = path.resolve(__dirname, "../docs");
const JS = path.join(DOCS, "assets/js");

const Garden = require(path.join(JS, "shroom-garden.js"));
const Schema = require(path.join(JS, "life-atlas/life-atlas-schema.js"));
const Repository = require(path.join(JS, "life-atlas/life-atlas-repository.js"));
const Exporter = require(path.join(JS, "life-atlas/life-atlas-export.js"));

/* The real canonical converter, loaded in the site's own order. */
require(path.join(JS, "calendar/pattern-calendar-version.js"));
require(path.join(JS, "calendar/pattern-calendar-data.js"));
require(path.join(JS, "calendar/pattern-calendar-format.js"));
require(path.join(JS, "calendar/pattern-calendar-boundary.js"));
require(path.join(JS, "calendar/pattern-calendar.js"));

const read = rel => fs.readFileSync(path.join(DOCS, rel), "utf8");

function temporalOn(civilDate, patternDay) {
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
    patternDay: patternDay ?? null,
    week: null,
    weekGate: null,
    outsideDay: false
  };
}

let dayCounter = 0;

function tendRecord(bedId, cycle, civilDate) {
  dayCounter += 1;
  return Schema.createLifeRecord(
    Garden.buildTendRecord({ bedId, cycle }, temporalOn(civilDate, dayCounter))
  );
}

function tierRecord(bedId, cycle, tierIndex, civilDate) {
  return Schema.createLifeRecord(
    Garden.buildTierRecord({ bedId, cycle, tierIndex }, temporalOn(civilDate))
  );
}

function passRecord(bedId, cycle, civilDate) {
  return Schema.createLifeRecord(
    Garden.buildPassRecord({ bedId, cycle }, temporalOn(civilDate))
  );
}

function practiceRecord(civilDate) {
  return Schema.createLifeRecord({
    type: "event",
    subtype: Garden.PRACTICE_SUBTYPE,
    title: "Manifest practice session",
    temporal: temporalOn(civilDate),
    tags: ["manifest-practice"],
    provenance: { sourceType: "manifest-visual-exercise", sourceId: "teach.html#manifest", calculationAuthority: "PatternCalendar" },
    privacy: { visibility: "private", containsPersonalData: true, shareAllowed: false },
    payload: { manifestPractice: { version: 1 } }
  });
}

/* ------------------------------ tiers ------------------------------ */

test("the tier ladder turns at the recorded thresholds", () => {
  assert.equal(Garden.tierForGrowth(0), 0);
  assert.equal(Garden.tierForGrowth(1), 0);
  assert.equal(Garden.tierForGrowth(2), 1);
  assert.equal(Garden.tierForGrowth(4), 1);
  assert.equal(Garden.tierForGrowth(5), 2);
  assert.equal(Garden.tierForGrowth(8), 2);
  assert.equal(Garden.tierForGrowth(9), 3);
  assert.equal(Garden.tierForGrowth(40), 3);
  assert.deepEqual([...Garden.TIER_THRESHOLDS], [0, 2, 5, 9]);
  assert.equal(Garden.TIERS[Garden.tierForGrowth(9)].name, "Bloom");
  assert.equal(Garden.nextTierAt(0), 2);
  assert.equal(Garden.nextTierAt(3), null);
});

/* --------------------------- record shapes -------------------------- */

test("garden records validate against the canonical Life Atlas schema", () => {
  const temporal = Garden.temporalFromConversion(
    {
      civilDate: "2026-11-19",
      patternYear: 1,
      insideCountedYear: true,
      moon: 8,
      day: 21,
      dayOfPatternYear: 217,
      weekOfYear: 32,
      anchorDate: new Date(Date.UTC(2026, 3, 17, 12, 0, 0)),
      timeZone: "America/Los_Angeles",
      boundaryMode: "midnight"
    },
    new Date("2026-11-19T17:00:00.000Z")
  );

  /* The Atlas convention: patternYear is the anchor civil year,
     never PatternCalendar's internal ordinal. */
  assert.equal(temporal.patternYear, 2026);
  assert.equal(temporal.patternDay, 217);
  assert.equal(temporal.moon, 8);
  assert.equal(temporal.moonDay, 21);

  const tend = Schema.createLifeRecord(Garden.buildTendRecord({ bedId: "open", cycle: 1 }, temporal));
  assert.equal(tend.type, "event");
  assert.equal(tend.subtype, "garden-tend");
  assert.equal(tend.privacy.visibility, "private");
  assert.equal(tend.privacy.shareAllowed, false);
  assert.equal(tend.provenance.calculationAuthority, "PatternCalendar");
  assert.equal(tend.payload.shroomGarden.bedId, "open");

  const pass = Schema.createLifeRecord(Garden.buildPassRecord({ bedId: "open", cycle: 1 }, temporal));
  assert.equal(pass.type, "artifact");
  assert.equal(pass.subtype, "garden-pass");
  assert.equal(pass.payload.shroomGarden.status, "held");
  assert.equal(pass.payload.shroomGarden.earnedBy, "bloom-harvest");
});

test("the temporal stamp comes from the real PatternCalendar (Aaron's fixtures)", () => {
  const sep15 = Garden.coordinateForInstant(new Date("2026-09-15T12:00:00.000Z"), { timeZone: "UTC" });
  assert.equal(sep15.patternDay, 152);
  assert.equal(sep15.moon, 6);
  assert.equal(sep15.moonDay, 12);
  assert.equal(sep15.patternYear, 2026);

  const nov19 = Garden.coordinateForInstant(new Date("2026-11-19T12:00:00.000Z"), { timeZone: "UTC" });
  assert.equal(nov19.patternDay, 217);
  assert.equal(nov19.moon, 8);
  assert.equal(nov19.moonDay, 21);
  assert.equal(Garden.coordinateLabel(nov19), "Moon 8 · Day 21 · Pattern Day 217");
});

/* ------------------------------- fold ------------------------------- */

test("growth folds from tends alone, one cycle at a time", () => {
  const records = [
    tendRecord("shaded", 1, "2026-11-01"),
    tendRecord("shaded", 1, "2026-11-02"),
    tendRecord("shaded", 1, "2026-11-03"),
    tendRecord("open", 1, "2026-11-03")
  ];

  const state = Garden.foldGarden(records, []);
  const shaded = state.beds.find(bed => bed.bedId === "shaded");
  const open = state.beds.find(bed => bed.bedId === "open");
  const deep = state.beds.find(bed => bed.bedId === "deep");

  assert.equal(shaded.tends, 3);
  assert.equal(shaded.growth, 3);
  assert.equal(shaded.tierIndex, 1);
  assert.equal(shaded.tierName, "Thread");
  assert.equal(shaded.nextTierAt, 5);
  assert.equal(shaded.canHarvest, false);
  assert.equal(open.growth, 1);
  assert.equal(deep.growth, 0);
  assert.equal(deep.tierName, "Spore");
  assert.equal(state.passes.length, 0);
});

test("practice rain counts sealed-practice days inside the tend window only", () => {
  const tends = [
    tendRecord("deep", 1, "2026-11-01"),
    tendRecord("deep", 1, "2026-11-05")
  ];

  const practice = [
    practiceRecord("2026-10-31"), /* before the window: no rain */
    practiceRecord("2026-11-02"),
    practiceRecord("2026-11-02"), /* same day twice: still one rain day */
    practiceRecord("2026-11-04"),
    practiceRecord("2026-11-09") /* after the last tend: not yet rain */
  ];

  const bed = Garden.foldGarden(tends, practice).beds.find(entry => entry.bedId === "deep");
  assert.equal(bed.tends, 2);
  assert.equal(bed.rainDays, 2);
  assert.equal(bed.growth, 4);

  /* The keeper tends again on the 9th: the window extends and the
     practice of the 9th rains too — nothing was lost. */
  const later = [...tends, tendRecord("deep", 1, "2026-11-09")];
  const grown = Garden.foldGarden(later, practice).beds.find(entry => entry.bedId === "deep");
  assert.equal(grown.tends, 3);
  assert.equal(grown.rainDays, 3);
  assert.equal(grown.growth, 6);
  assert.equal(grown.tierName, "Cap");
});

test("a bed with no tends drinks no rain", () => {
  const bed = Garden.foldGarden([], [practiceRecord("2026-11-02")])
    .beds.find(entry => entry.bedId === "open");
  assert.equal(bed.rainDays, 0);
  assert.equal(bed.growth, 0);
});

test("one tend per bed per day, read from the records", () => {
  const records = [tendRecord("open", 1, "2026-11-10")];
  assert.equal(Garden.tendedOn(records, "open", "2026-11-10"), true);
  assert.equal(Garden.tendedOn(records, "open", "2026-11-11"), false);
  assert.equal(Garden.tendedOn(records, "deep", "2026-11-10"), false);
});

test("pending tier turns are the tiers the fold proves but no record names", () => {
  const records = [
    tendRecord("open", 1, "2026-11-01"),
    tendRecord("open", 1, "2026-11-02"),
    tendRecord("open", 1, "2026-11-03"),
    tendRecord("open", 1, "2026-11-04"),
    tendRecord("open", 1, "2026-11-05"),
    tierRecord("open", 1, 1, "2026-11-02")
  ];

  const bed = Garden.foldGarden(records, []).beds.find(entry => entry.bedId === "open");
  assert.equal(bed.tierIndex, 2);
  assert.equal(bed.recordedTier, 1);
  assert.deepEqual(bed.pendingTiers, [2]);
});

/* --------------------------- harvest flow --------------------------- */

test("nine tends grow a bed to Bloom; the harvest writes a pass and a new cycle begins", async () => {
  const repository = Repository.createRepository();

  for (let day = 1; day <= 9; day += 1) {
    await repository.put(
      Garden.buildTendRecord(
        { bedId: "shaded", cycle: 1 },
        temporalOn(`2026-11-${String(day).padStart(2, "0")}`, day)
      )
    );
  }

  let records = [
    ...(await repository.query({ subtype: Garden.TEND_SUBTYPE })),
    ...(await repository.query({ subtype: Garden.TIER_SUBTYPE })),
    ...(await repository.query({ subtype: Garden.PASS_SUBTYPE }))
  ];

  let bed = Garden.foldGarden(records, []).beds.find(entry => entry.bedId === "shaded");
  assert.equal(bed.growth, 9);
  assert.equal(bed.tierName, "Bloom");
  assert.equal(bed.canHarvest, true);

  await repository.put(
    Garden.buildPassRecord({ bedId: "shaded", cycle: bed.cycle }, temporalOn("2026-11-09", 9))
  );

  records = [
    ...(await repository.query({ subtype: Garden.TEND_SUBTYPE })),
    ...(await repository.query({ subtype: Garden.PASS_SUBTYPE }))
  ];

  const state = Garden.foldGarden(records, []);
  bed = state.beds.find(entry => entry.bedId === "shaded");

  assert.equal(state.passes.length, 1);
  assert.equal(state.passes[0].bedName, "The Shaded Bed");
  assert.equal(state.passes[0].status, "held");
  assert.equal(state.passes[0].civilDate, "2026-11-09");
  assert.equal(bed.cycle, 2);
  assert.equal(bed.completedCycles, 1);
  assert.equal(bed.growth, 0);
  assert.equal(bed.tierName, "Spore");

  /* The pass rides the Atlas export/backup like every other record. */
  const backupText = Exporter.serializeBackup(await repository.exportRecords());
  const parsed = Exporter.parseBackup(backupText);
  assert.ok(parsed, "backup parses");
  assert.equal(parsed.rejected.length, 0);
  assert.ok(parsed.records.some(record => record.subtype === "garden-pass"));
  assert.ok(parsed.records.some(record => record.subtype === "garden-tend"));
});

/* ------------------------------ fences ------------------------------ */

test("the garden module makes no network calls", () => {
  const source = read("assets/js/shroom-garden.js");
  assert.ok(!/fetch\s*\(/.test(source), "no fetch");
  assert.ok(!/XMLHttpRequest/.test(source), "no XHR");
  assert.ok(!/WebSocket/.test(source), "no WebSocket");
  assert.ok(!/sendBeacon/.test(source), "no beacon");
});

test("no absence-guilt or decay language anywhere in the garden's copy", () => {
  const banned = [
    "missed you",
    "while you were gone",
    "while you were away",
    "you forgot",
    "neglect",
    "lonely",
    "disappointed",
    "ran away",
    "wilted",
    "starving",
    "is sick",
    "punish"
  ];

  for (const rel of ["garden.html", "assets/js/shroom-garden.js", "assets/css/shroom-garden.css"]) {
    const text = read(rel).toLowerCase();
    for (const phrase of banned) {
      assert.ok(!text.includes(phrase), `${rel} must not say "${phrase}"`);
    }
  }

  /* The register instead: the garden keeps your place. */
  assert.ok(read("garden.html").includes("keeps your place"));
});

test("reduced-motion still mode is honored in the garden stylesheet", () => {
  const css = read("assets/css/shroom-garden.css");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
});

/* ------------------------------ wiring ------------------------------ */

test("garden.html loads the canonical converter, the Atlas stack, and the garden module", () => {
  const html = read("garden.html");
  assert.match(html, /calendar\/pattern-calendar\.js/);
  assert.match(html, /life-atlas\/life-atlas-schema\.js/);
  assert.match(html, /life-atlas\/life-atlas-repository\.js/);
  assert.match(html, /life-atlas\/life-atlas-runtime\.js/);
  assert.match(html, /assets\/js\/shroom-garden\.js/);
  assert.match(html, /assets\/css\/shroom-garden\.css/);
  assert.match(html, /id="garden-beds"/);
  assert.match(html, /id="garden-passes"/);
  assert.match(html, /id="garden-status"/);
  assert.match(html, /id="garden-today-coords"/);
  /* The honest label: a pass is held today, and the page says so. */
  assert.match(html, /today, a pass is held/);
  assert.match(html, /Day World/);
  /* Exactly one unified living nav, like every content page. */
  assert.equal((html.match(/data-living-nav/g) || []).length, 1);
});

test("the Lab bench grid doors into the garden, and the catalog knows the page", () => {
  const lab = read("lab.html");
  assert.match(lab, /href="\.\/garden\.html"/);
  assert.match(lab, /Shroom Search — the Garden/);

  const curation = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../scripts/site-catalog-curation.json"), "utf8")
  );
  const entry = curation.entries.find(item => item.id === "shroom-garden");
  assert.ok(entry, "curation entry exists");
  assert.equal(entry.path, "garden.html");
  assert.equal(entry.status, "live");

  assert.match(read("sitemap.xml"), /codexofreality\.org\/garden\.html/);
});
