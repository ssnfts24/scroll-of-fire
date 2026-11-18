"use strict";

/**
 * Manifest Practice Loop — Seal → Life Atlas → markers.
 *
 * Covers: the practice-session record against the canonical Life Atlas
 * schema, the seal's repository round-trip through the existing Atlas
 * export/backup, the pure marker-day computation, the read-only Moon
 * summary, the temporal stamp read from the real PatternCalendar
 * (Aaron's fixtures: 2026-11-17 = Moon 8 · Day 19 · Pattern Day 215;
 * 2026-09-15 = Moon 6 · Day 12 · Pattern Day 152), and the day-zoom
 * panel's practice entries + marker fields.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const DOCS = path.resolve(__dirname, "../docs");
const JS = path.join(DOCS, "assets/js");

const Practice = require(path.join(JS, "manifest-practice.js"));
const Schema = require(path.join(JS, "life-atlas/life-atlas-schema.js"));
const Repository = require(path.join(JS, "life-atlas/life-atlas-repository.js"));
const Exporter = require(path.join(JS, "life-atlas/life-atlas-export.js"));
const DayZoom = require(path.join(JS, "sphere/living-time-sphere-day-zoom.js"));

/* The real canonical converter, loaded in the site's own order. */
require(path.join(JS, "calendar/pattern-calendar-version.js"));
require(path.join(JS, "calendar/pattern-calendar-data.js"));
require(path.join(JS, "calendar/pattern-calendar-format.js"));
require(path.join(JS, "calendar/pattern-calendar-boundary.js"));
require(path.join(JS, "calendar/pattern-calendar.js"));

function fixtureConversion(overrides = {}) {
  return {
    civilDate: "2026-11-17",
    effectiveDate: "2026-11-17",
    /* PatternCalendar's internal ordinal — the Atlas must NOT persist it. */
    patternYear: 1,
    insideCountedYear: true,
    moon: 8,
    moonName: "Observer",
    day: 19,
    dayOfPatternYear: 215,
    weekOfYear: 31,
    isDayOutOfTime: false,
    anchorDate: new Date(Date.UTC(2026, 3, 17, 12, 0, 0)),
    timeZone: "America/Los_Angeles",
    boundaryMode: "midnight",
    ...overrides
  };
}

function sealedRecord(input = {}, temporalOverrides = {}) {
  const temporal = Practice.temporalFromConversion(
    fixtureConversion(),
    new Date("2026-11-17T21:30:00.000Z")
  );

  const built = Practice.buildSessionRecord(
    {
      intention: "Hold the line; witness the work.",
      carriers: [432],
      sequencePath: "Ground 144 → 432",
      visualMode: { value: "3", label: "Rose" },
      seed: 4242.5,
      breathPattern: "Box 4-4-4-4",
      xi: 0.42,
      sessionKind: "practice",
      materials: "",
      witnessNote: "The field steadied at the third cycle.",
      ...input
    },
    { ...temporal, ...temporalOverrides }
  );

  return Schema.createLifeRecord(built);
}

/* ------------------------- temporal stamping ------------------------- */

test("temporal stamp persists the anchor civil year, not the ordinal", () => {
  const temporal = Practice.temporalFromConversion(
    fixtureConversion(),
    new Date("2026-11-17T21:30:00.000Z")
  );

  assert.equal(temporal.patternYear, 2026);
  assert.equal(temporal.moon, 8);
  assert.equal(temporal.moonDay, 19);
  assert.equal(temporal.patternDay, 215);
  assert.equal(temporal.week, 31);
  assert.equal(temporal.civilDate, "2026-11-17");
  assert.equal(temporal.outsideDay, false);
  assert.equal(temporal.instant, "2026-11-17T21:30:00.000Z");
});

test("temporal stamp for a Day Out of Time carries no Pattern Day", () => {
  const temporal = Practice.temporalFromConversion(
    fixtureConversion({
      insideCountedYear: false,
      moon: null,
      day: null,
      dayOfPatternYear: null,
      weekOfYear: null,
      isDayOutOfTime: true
    }),
    new Date("2027-04-17T12:00:00.000Z")
  );

  assert.equal(temporal.patternDay, null);
  assert.equal(temporal.moon, null);
  assert.equal(temporal.outsideDay, true);
});

test("coordinateForInstant reads Aaron's fixtures from the real PatternCalendar", () => {
  const nov17 = Practice.coordinateForInstant(
    new Date("2026-11-17T20:00:00.000Z"),
    { timeZone: "America/Los_Angeles", boundaryMode: "midnight" }
  );

  assert.equal(nov17.civilDate, "2026-11-17");
  assert.equal(nov17.moon, 8);
  assert.equal(nov17.moonDay, 19);
  assert.equal(nov17.patternDay, 215);
  assert.equal(nov17.patternYear, 2026);

  const sep15 = Practice.coordinateForInstant(
    new Date("2026-09-15T12:00:00.000Z"),
    { timeZone: "UTC", boundaryMode: "midnight" }
  );

  assert.equal(sep15.civilDate, "2026-09-15");
  assert.equal(sep15.moon, 6);
  assert.equal(sep15.moonDay, 12);
  assert.equal(sep15.patternDay, 152);
});

/* --------------------------- record shape ---------------------------- */

test("sealed session validates against the canonical Life Atlas schema", () => {
  const record = sealedRecord();

  assert.equal(record.schemaVersion, "1.0.0");
  assert.equal(record.type, "event");
  assert.equal(record.subtype, "practice-session");
  assert.ok(record.tags.includes("manifest-practice"));
  assert.equal(record.privacy.visibility, "private");
  assert.equal(record.privacy.shareAllowed, false);

  const payload = record.payload.manifestPractice;
  assert.equal(payload.intention, "Hold the line; witness the work.");
  assert.deepEqual(payload.carriersHz, [432]);
  assert.equal(payload.sequencePath, "Ground 144 → 432");
  assert.equal(payload.visualMode.label, "Rose");
  assert.equal(payload.seed, 4242.5);
  assert.equal(payload.breathPattern, "Box 4-4-4-4");
  assert.equal(payload.witnessNote, "The field steadied at the third cycle.");

  /* The console tracks no session timer: duration is honestly null. */
  assert.equal(payload.durationSeconds, null);

  /* Ξ is stored as the console's own estimate, labeled as such. */
  assert.equal(payload.xi.value, 0.42);
  assert.match(payload.xi.label, /console coherence estimate/);
});

test("buildSessionRecord clamps Ξ, dedupes carriers, defaults the kind", () => {
  const built = Practice.buildSessionRecord(
    {
      intention: "x",
      carriers: [528, 432, 432, -5, "nope"],
      xi: 1.7,
      sessionKind: "not-a-kind"
    },
    null
  );

  assert.deepEqual(built.payload.manifestPractice.carriersHz, [432, 528]);
  assert.equal(built.payload.manifestPractice.xi.value, 1);
  assert.equal(built.payload.manifestPractice.sessionKind, "practice");
  assert.equal(built.type, "event");
  assert.equal(built.subtype, "practice-session");
});

test("isPracticeSession requires the subtype and the practice payload/tag", () => {
  assert.equal(Practice.isPracticeSession(sealedRecord()), true);
  assert.equal(Practice.isPracticeSession({ subtype: "practice-session" }), false);
  assert.equal(
    Practice.isPracticeSession({ subtype: "event", payload: { manifestPractice: {} } }),
    false
  );
  assert.equal(Practice.isPracticeSession(null), false);
});

/* ------------------------- repository round-trip ------------------------ */

test("seal round-trips through the repository and the Atlas backup", async () => {
  const source = Repository.createRepository();
  const saved = await source.put(
    Practice.buildSessionRecord(
      {
        intention: "Round-trip the seal.",
        carriers: [432, 528],
        sessionKind: "craft",
        materials: "Copper, quartz",
        xi: 0.5,
        seed: 777
      },
      Practice.temporalFromConversion(
        fixtureConversion(),
        new Date("2026-11-17T21:30:00.000Z")
      )
    )
  );

  const byMoon = await source.query({
    subtype: "practice-session",
    patternYear: 2026,
    moon: 8
  });
  assert.equal(byMoon.length, 1);
  assert.equal(byMoon[0].id, saved.id);

  const byCivilDate = await source.query({
    subtype: "practice-session",
    civilDate: "2026-11-17"
  });
  assert.equal(byCivilDate.length, 1);

  /* The existing export/backup carries the new records unchanged. */
  const backupText = Exporter.serializeBackup(
    await source.exportRecords()
  );
  const parsed = Exporter.parseBackup(backupText);
  assert.ok(parsed, "backup parses");
  assert.equal(parsed.rejected.length, 0);
  assert.equal(parsed.records.length, 1);

  const restored = Repository.createRepository();
  const report = await restored.importRecords(parsed.records);
  assert.equal(report.rejected.length, 0);
  assert.equal(report.imported.length, 1);

  const again = await restored.query({ subtype: "practice-session" });
  assert.equal(again.length, 1);

  const payload = again[0].payload.manifestPractice;
  assert.equal(payload.intention, "Round-trip the seal.");
  assert.equal(payload.sessionKind, "craft");
  assert.equal(payload.materials, "Copper, quartz");
  assert.deepEqual(payload.carriersHz, [432, 528]);
  assert.equal(payload.seed, 777);
  assert.equal(payload.xi.value, 0.5);
  assert.equal(again[0].temporal.patternDay, 215);
});

/* ------------------------------ markers ------------------------------ */

test("markedPatternDays marks only practice days, with kinds and counts", () => {
  const records = [
    sealedRecord(),
    sealedRecord({ sessionKind: "craft" }),
    sealedRecord({}, { patternDay: 216, moonDay: 20, civilDate: "2026-11-18" }),
    /* An ordinary planner-style record on the same day: not a marker. */
    Schema.createLifeRecord({
      type: "event",
      subtype: "event",
      title: "Ordinary plan",
      temporal: { patternYear: 2026, patternDay: 215, moon: 8, moonDay: 19 }
    }),
    /* A Day Out of Time seal: counted as a record, but no day marker. */
    sealedRecord({}, { patternDay: null, moon: null, moonDay: null, outsideDay: true })
  ];

  const marked = Practice.markedPatternDays(records);

  assert.equal(marked.size, 2);

  const day215 = marked.get("2026:215");
  assert.equal(day215.count, 2);
  assert.deepEqual(day215.kinds, ["practice", "craft"]);

  const day216 = marked.get("2026:216");
  assert.equal(day216.count, 1);
  assert.deepEqual(day216.kinds, ["practice"]);
});

test("summarizeMoon counts kinds, carriers, and marked days — observed only", () => {
  const records = [
    sealedRecord(),
    sealedRecord({ sessionKind: "craft", carriers: [432, 528] }),
    sealedRecord({ sessionKind: "working", carriers: [528] }, { patternDay: 216, moonDay: 20 }),
    /* Another Moon: excluded from a Moon 8 summary. */
    sealedRecord({}, { moon: 9, moonDay: 3, patternDay: 227 })
  ];

  const summary = Practice.summarizeMoon(records, {
    patternYear: 2026,
    moon: 8
  });

  assert.equal(summary.count, 3);
  assert.deepEqual(summary.byKind, { practice: 1, craft: 1, working: 1 });
  assert.deepEqual(summary.carriers, [
    { hz: 432, count: 2 },
    { hz: 528, count: 2 }
  ]);
  assert.equal(summary.daysMarked, 2);
  assert.deepEqual(summary.patternDays, [215, 216]);
});

/* ------------------------------ day-zoom ------------------------------ */

test("day-zoom entries give practice sessions the special marker", () => {
  const view = DayZoom.buildDayView({
    selection: {
      civilDate: "2026-11-17",
      patternYear: 2026,
      patternDay: 215,
      moon: 8,
      moonDay: 19
    },
    records: [sealedRecord()],
    scheduling: null
  });

  assert.equal(view.count, 1);

  const entry = view.entries[0];
  assert.equal(entry.practice, true);
  assert.equal(entry.sessionKind, "practice");
  assert.equal(entry.markerGlyph, "🜚");
  assert.equal(entry.type, "Manifest · practice session");
});

test("day-zoom entries leave ordinary records unmarked", () => {
  const entry = DayZoom.entryForRecord(
    {
      id: "plan-1",
      type: "event",
      subtype: "event",
      title: "Ordinary plan",
      temporal: { patternYear: 2026, patternDay: 215 },
      payload: {}
    },
    null
  );

  assert.equal(entry.practice, false);
  assert.equal(entry.markerGlyph, null);
});

test("day-zoom refresh merges repository practice records with planner records", async () => {
  const coordinate = {
    remnant13Moons: {
      patternYear: 2026,
      patternDay: 215,
      moon: 8,
      moonDay: 19,
      week: 31
    },
    gregorian: { isoDate: "2026-11-17" }
  };

  const cursor = {
    getState: () => ({ selectedDate: new Date("2026-11-17T12:00:00Z"), coordinate }),
    getDate: () => new Date("2026-11-17T12:00:00Z"),
    getCoordinate: () => coordinate
  };

  const plannerRecord = {
    id: "plan-1",
    type: "event",
    subtype: "event",
    title: "Ordinary plan",
    summary: "",
    tags: ["living-planner"],
    temporal: { patternYear: 2026, patternDay: 215, moon: 8, moonDay: 19 },
    payload: {}
  };

  let rendered = null;

  const zoom = DayZoom.createDayZoom({
    cursor,
    planner: { plansForYear: async () => [plannerRecord] },
    scheduling: null,
    practiceRecordsProvider: async year => {
      assert.equal(year, 2026);
      return [sealedRecord()];
    },
    onRender: view => {
      rendered = view;
    }
  });

  const { view } = await zoom.refresh("test");

  assert.equal(view.count, 2);
  assert.equal(rendered.count, 2);

  const practice = view.entries.find(entry => entry.practice);
  assert.ok(practice, "practice entry present after merge");
  assert.equal(practice.markerGlyph, "🜚");

  const ordinary = view.entries.find(entry => !entry.practice);
  assert.ok(ordinary, "planner entry still present");
});

test("mergeRecords dedupes by id, primary wins", () => {
  const a = { id: "x", title: "primary" };
  const b = { id: "x", title: "duplicate" };
  const c = { id: "y", title: "extra" };

  assert.deepEqual(DayZoom.mergeRecords([a], [b, c]), [a, c]);
});

/* ---------------------------- page wiring ----------------------------- */

test("pages carry the practice-loop wiring", () => {
  const teach = fs.readFileSync(path.join(DOCS, "teach.html"), "utf8");
  assert.match(teach, /id="manifest"/);
  assert.match(teach, /Seal a session and it takes its place on the Sphere's day/);
  assert.match(teach, /id="mpKind"/);
  assert.match(teach, /id="mpSealStatus"/);
  assert.match(teach, /id="mpSummaryBody"/);
  assert.match(teach, /manifest-practice\.js/);
  assert.match(teach, /manifest-practice\.css/);
  assert.match(teach, /data-manifest-today/);
  /* The Lab guardrails stay: stop rule language intact. */
  assert.match(teach, /always bounded by the stop rule/);

  const moons = fs.readFileSync(path.join(DOCS, "moons.html"), "utf8");
  assert.match(moons, /data-manifest-today/);
  assert.match(moons, /teach\.html#manifest/);
  assert.match(moons, /manifest-practice\.js/);
  assert.match(moons, /manifest-practice\.css/);

  const index = fs.readFileSync(path.join(DOCS, "index.html"), "utf8");
  assert.match(index, /front-door-card" href="teach\.html"><strong>Practice<\/strong>/);
});
