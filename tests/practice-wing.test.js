"use strict";

/**
 * Practices — the Exercises Wing (practices.html).
 *
 * Covers: the exercise registry (five doors, one per family), the
 * timed phase plans, the attention return counter, the sealed
 * record's shape against the canonical Life Atlas schema — the
 * exact manifest-practice shape (type "event", subtype
 * "practice-session", payload.manifestPractice) with the wing's
 * exercise detail in one added sub-object — the temporal stamp from
 * the real PatternCalendar (Aaron's fixture: 2026-11-19 = Moon 8 ·
 * Day 21 · Pattern Day 217), the bench honouring the shape with no
 * changes anywhere else (the garden folds a wing session as
 * practice rain; the Manifest marker logic marks the day), the page
 * wiring, and the fences: no network calls, no absence-guilt or
 * score-keeping language, reduced-motion still mode.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const DOCS = path.resolve(__dirname, "../docs");
const JS = path.join(DOCS, "assets/js");

const Wing = require(path.join(JS, "practice-wing.js"));
const Garden = require(path.join(JS, "shroom-garden.js"));
const Manifest = require(path.join(JS, "manifest-practice.js"));
const Schema = require(path.join(JS, "life-atlas/life-atlas-schema.js"));
const Repository = require(path.join(JS, "life-atlas/life-atlas-repository.js"));

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

/* ----------------------------- registry ----------------------------- */

test("the wing opens with five exercises, one per family", () => {
  assert.equal(Wing.EXERCISES.length, 5);

  const families = Wing.EXERCISES.map(exercise => exercise.family).sort();
  assert.deepEqual(families, ["attention", "breath", "intention", "memory", "witness"]);

  for (const exercise of Wing.EXERCISES) {
    assert.ok(exercise.id && exercise.name && exercise.trains && exercise.intro);
    assert.equal(Wing.exerciseById(exercise.id), exercise);
    assert.ok(exercise.phases.length >= 2, `${exercise.id} has phases`);
  }

  assert.equal(Wing.exerciseById("no-such-exercise"), null);
});

test("each exercise's timed plan is honest and its manual phases wait", () => {
  const expected = {
    "fourfold-breath": 178,
    "count-the-returns": 196,
    "sixty-seconds-of-seeing": 66,
    "the-keeping": 20,
    "the-sealed-intention": 128
  };

  for (const exercise of Wing.EXERCISES) {
    const plan = Wing.phasePlan(exercise);
    assert.equal(plan.plannedSeconds, expected[exercise.id], exercise.id);

    let offset = 0;
    for (const entry of plan.phases) {
      assert.equal(entry.startAt, offset, `${exercise.id} phase offsets accumulate`);
      offset += Math.max(0, entry.seconds || 0);
      if (entry.ask || entry.write) {
        assert.equal(entry.seconds, 0, `${exercise.id} manual phases carry no timer`);
      }
    }
  }

  const breath = Wing.phasePlan(Wing.exerciseById("fourfold-breath"));
  assert.equal(breath.phases.filter(entry => entry.round).length, 40, "ten rounds of four");
});

/* --------------------------- return counter -------------------------- */

test("a return is a Here that follows a Drifted — drifting is the weight, returning is the rep", () => {
  assert.deepEqual(Wing.countReturns([]), { prompts: 0, here: 0, drifted: 0, returns: 0 });
  assert.deepEqual(
    Wing.countReturns(["here", "here", "here"]),
    { prompts: 3, here: 3, drifted: 0, returns: 0 }
  );
  assert.deepEqual(
    Wing.countReturns(["drifted", "here", "drifted", "drifted", "here"]),
    { prompts: 5, here: 2, drifted: 3, returns: 2 }
  );
  assert.deepEqual(
    Wing.countReturns(["here", "drifted", "here"]),
    { prompts: 3, here: 2, drifted: 1, returns: 1 }
  );
  /* Noise is not an answer. */
  assert.deepEqual(
    Wing.countReturns(["here", "maybe", null, "drifted"]),
    { prompts: 2, here: 1, drifted: 1, returns: 0 }
  );
});

/* ---------------------------- record shape --------------------------- */

test("a sealed wing record is the manifest-practice shape exactly, plus its exercise detail", () => {
  const temporal = Wing.temporalFromConversion(
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

  assert.equal(temporal.patternYear, 2026);
  assert.equal(temporal.patternDay, 217);

  const built = Wing.buildSessionRecord(
    {
      exerciseId: "count-the-returns",
      durationSeconds: 231,
      results: { answers: ["drifted", "here", "here", "drifted", "here"] }
    },
    temporal
  );

  const record = Schema.createLifeRecord(built);

  assert.equal(record.type, "event");
  assert.equal(record.subtype, "practice-session");
  assert.deepEqual(record.tags.slice(0, 2), ["manifest-practice", "practice"]);
  assert.ok(record.tags.includes("practice-wing"));
  assert.ok(record.tags.includes("attention"));
  assert.equal(record.privacy.visibility, "private");
  assert.equal(record.privacy.shareAllowed, false);
  assert.equal(record.provenance.sourceType, "practice-wing");
  assert.equal(record.provenance.sourceId, "practices.html");
  assert.equal(record.provenance.calculationAuthority, "PatternCalendar");

  const detail = record.payload.manifestPractice;
  assert.equal(detail.version, 1);
  assert.equal(detail.sessionKind, "practice");
  assert.equal(detail.durationSeconds, 231);
  assert.equal(detail.xi.value, null);
  assert.match(detail.xi.label, /not a measured effect/);
  assert.deepEqual(detail.exercise.results, { prompts: 5, here: 3, drifted: 2, returns: 2 });
  assert.equal(detail.exercise.id, "count-the-returns");
  assert.equal(detail.exercise.family, "attention");
  assert.match(record.summary, /2 returns counted/);

  /* The Manifest module itself recognises the record as a practice
     session — one bench, one record family. */
  assert.equal(Manifest.isPracticeSession(record), true);
  assert.equal(Wing.isWingSession(record), true);
});

test("the intention exercise carries its line in the manifest intention field", () => {
  const built = Wing.buildSessionRecord(
    {
      exerciseId: "the-sealed-intention",
      durationSeconds: 190,
      intention: "Finish the floor in the north room on Saturday."
    },
    temporalOn("2026-11-19", 217)
  );

  const record = Schema.createLifeRecord(built);
  assert.equal(
    record.payload.manifestPractice.intention,
    "Finish the floor in the north room on Saturday."
  );
  assert.equal(
    record.payload.manifestPractice.breathPattern,
    "Four slow breaths — in 4 · out 4"
  );
});

test("the keeping keeps its lines, and the seeing keeps its one thing", () => {
  const keeping = Schema.createLifeRecord(
    Wing.buildSessionRecord(
      {
        exerciseId: "the-keeping",
        durationSeconds: 154,
        results: { lines: ["  Aiyana's laugh at breakfast  ", "", "The light on the fir trees"] }
      },
      temporalOn("2026-11-19", 217)
    )
  );

  assert.deepEqual(keeping.payload.manifestPractice.exercise.results.lines, [
    "Aiyana's laugh at breakfast",
    "The light on the fir trees"
  ]);
  assert.match(keeping.payload.manifestPractice.witnessNote, /Aiyana's laugh/);

  const seeing = Schema.createLifeRecord(
    Wing.buildSessionRecord(
      {
        exerciseId: "sixty-seconds-of-seeing",
        durationSeconds: 88,
        note: "The refrigerator hums in two tones."
      },
      temporalOn("2026-11-19", 217)
    )
  );

  assert.equal(
    seeing.payload.manifestPractice.witnessNote,
    "The refrigerator hums in two tones."
  );
});

test("durations are measured or null — never the plan's estimate", () => {
  const unmeasured = Wing.buildSessionRecord(
    { exerciseId: "fourfold-breath" },
    temporalOn("2026-11-19", 217)
  );
  assert.equal(unmeasured.payload.manifestPractice.durationSeconds, null);

  const zero = Wing.buildSessionRecord(
    { exerciseId: "fourfold-breath", durationSeconds: 0 },
    temporalOn("2026-11-19", 217)
  );
  assert.equal(zero.payload.manifestPractice.durationSeconds, null);

  assert.equal(Wing.buildSessionRecord({ exerciseId: "nope" }, null), null);
});

test("the temporal stamp comes from the real PatternCalendar (Aaron's fixtures)", () => {
  const sep15 = Wing.coordinateForInstant(new Date("2026-09-15T12:00:00.000Z"), { timeZone: "UTC" });
  assert.equal(sep15.patternDay, 152);
  assert.equal(sep15.moon, 6);
  assert.equal(sep15.moonDay, 12);

  const nov19 = Wing.coordinateForInstant(new Date("2026-11-19T12:00:00.000Z"), { timeZone: "UTC" });
  assert.equal(nov19.patternDay, 217);
  assert.equal(nov19.moon, 8);
  assert.equal(nov19.moonDay, 21);
  assert.equal(Wing.coordinateLabel(nov19), "Moon 8 · Day 21 · Pattern Day 217");
});

/* --------------------- the bench honours the shape ------------------- */

test("a wing session rains on the garden and marks its day, with no garden or calendar changes", async () => {
  const repository = Repository.createRepository();

  await repository.put(
    Garden.buildTendRecord({ bedId: "open", cycle: 1 }, temporalOn("2026-11-18", 216))
  );
  await repository.put(
    Garden.buildTendRecord({ bedId: "open", cycle: 1 }, temporalOn("2026-11-20", 218))
  );

  const wingRecord = Wing.buildSessionRecord(
    { exerciseId: "fourfold-breath", durationSeconds: 181 },
    temporalOn("2026-11-19", 217)
  );
  await repository.put(wingRecord);

  const practice = await repository.query({ subtype: Garden.PRACTICE_SUBTYPE });
  assert.equal(practice.length, 1, "the garden's own query finds the wing session");

  const tends = [
    ...(await repository.query({ subtype: Garden.TEND_SUBTYPE }))
  ];

  const bed = Garden.foldGarden(tends, practice).beds.find(entry => entry.bedId === "open");
  assert.equal(bed.tends, 2);
  assert.equal(bed.rainDays, 1, "the wing's sealed day is rain");
  assert.equal(bed.growth, 3);

  /* The Manifest marker logic marks the day from the same record. */
  const marked = Manifest.markedPatternDays(practice);
  assert.equal(marked.get("2026:217")?.count, 1);
});

test("wing summaries and the bench's day count read from records alone", async () => {
  const repository = Repository.createRepository();

  await repository.put(
    Wing.buildSessionRecord({ exerciseId: "fourfold-breath", durationSeconds: 181 }, temporalOn("2026-11-19", 217))
  );
  await repository.put(
    Wing.buildSessionRecord(
      { exerciseId: "the-sealed-intention", durationSeconds: 190, intention: "One line." },
      temporalOn("2026-11-19", 217)
    )
  );
  await repository.put(
    Manifest.buildSessionRecord({ intention: "A console session", sessionKind: "practice" }, temporalOn("2026-11-19", 217))
  );

  const all = await repository.query({ subtype: "practice-session" });
  assert.equal(Wing.countSessionsOn(all, "2026-11-19"), 3, "wing and console together, one bench");
  assert.equal(Wing.countSessionsOn(all, "2026-11-18"), 0);

  const summary = Wing.summarizeWingSessions(all);
  assert.equal(summary.count, 2, "only the wing's own are the wing's");
  assert.deepEqual(summary.byFamily, { breath: 1, intention: 1 });
});

/* ------------------------------- fences ------------------------------ */

test("the wing module makes no network calls", () => {
  const source = read("assets/js/practice-wing.js");
  assert.ok(!/fetch\s*\(/.test(source), "no fetch");
  assert.ok(!/XMLHttpRequest/.test(source), "no XHR");
  assert.ok(!/WebSocket/.test(source), "no WebSocket");
  assert.ok(!/sendBeacon/.test(source), "no beacon");
});

test("no absence-guilt, streak, or score-keeping language anywhere in the wing's copy", () => {
  const banned = [
    "missed you",
    "while you were gone",
    "while you were away",
    "you forgot",
    "neglect",
    "lonely",
    "disappointed",
    "ran away",
    "streak",
    "don't break the chain",
    "keep your streak",
    "falling behind",
    "punish"
  ];

  for (const rel of ["practices.html", "assets/js/practice-wing.js", "assets/css/practice-wing.css"]) {
    const text = read(rel).toLowerCase();
    for (const phrase of banned) {
      assert.ok(!text.includes(phrase), `${rel} must not say "${phrase}"`);
    }
  }

  /* The register instead: the room keeps your place, and claims stay small. */
  assert.ok(read("practices.html").includes("keeps your place"));
  assert.ok(read("practices.html").includes("practices, not treatment"));
});

test("no medical promises are made anywhere in the wing's copy", () => {
  const banned = ["cure", "heal your", "treats anxiety", "lowers your blood pressure", "guaranteed"];

  for (const rel of ["practices.html", "assets/js/practice-wing.js"]) {
    const text = read(rel).toLowerCase();
    for (const phrase of banned) {
      assert.ok(!text.includes(phrase), `${rel} must not promise "${phrase}"`);
    }
  }
});

test("reduced-motion still mode is honored in the wing stylesheet", () => {
  const css = read("assets/css/practice-wing.css");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)/);
});

/* ------------------------------ wiring ------------------------------- */

test("practices.html loads the canonical converter, the Atlas stack, and the wing module", () => {
  const html = read("practices.html");
  assert.match(html, /calendar\/pattern-calendar\.js/);
  assert.match(html, /life-atlas\/life-atlas-schema\.js/);
  assert.match(html, /life-atlas\/life-atlas-repository\.js/);
  assert.match(html, /life-atlas\/life-atlas-runtime\.js/);
  assert.match(html, /assets\/js\/practice-wing\.js/);
  assert.match(html, /assets\/css\/practice-wing\.css/);
  assert.match(html, /id="pw-stage"/);
  assert.match(html, /id="pw-status"/);
  assert.match(html, /id="pw-today-coords"/);
  assert.match(html, /id="pw-today-count"/);

  for (const exercise of Wing.EXERCISES) {
    assert.match(html, new RegExp(`data-pw-begin="${exercise.id}"`), `${exercise.id} has its door`);
  }

  /* Exactly one unified living nav, like every content page. */
  assert.equal((html.match(/data-living-nav/g) || []).length, 1);
});

test("the Lab and the Garden door into the wing, and the catalog knows the page", () => {
  assert.match(read("lab.html"), /href="\.\/practices\.html"/);
  assert.match(read("lab.html"), /Practices — the Exercises Wing/);
  assert.match(read("garden.html"), /href="\.\/practices\.html"/);

  const curation = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../scripts/site-catalog-curation.json"), "utf8")
  );
  const entry = curation.entries.find(item => item.id === "practice-wing");
  assert.ok(entry, "curation entry exists");
  assert.equal(entry.path, "practices.html");
  assert.equal(entry.status, "live");

  assert.match(read("sitemap.xml"), /codexofreality\.org\/practices\.html/);
});
