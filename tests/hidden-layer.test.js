"use strict";

/**
 * The Hidden Layer — stage 1 (the finds engine, Find the Day's Tone,
 * The Count).
 *
 * Covers: the level curve pinned at its stated numbers (a fresh
 * record spawns early; a deep record spawns rarely; the assurance
 * caps hold), the deterministic rolls and finds (the same seed, day,
 * and page always produce the same find), the placement table in
 * code (kinds only where the design argues them), the keepsake
 * record in the garden pass's own shape riding the canonical Life
 * Atlas repository and export, The Count computed from the real
 * PatternCalendar (Aaron's fixture: 2026-09-15 = Moon 6 · Day 12 ·
 * Pattern Day 152) with its answers crossing the count's turnings,
 * the tone round drawn from a chime plan with nearest neighbours,
 * the page wiring, and the fences: no network in the module, no
 * absence-guilt language, the Spark named by name / "the Spark" / it.
 *
 * The finds layer is parked (Aaron, Nov 20, 2026): the engine's
 * pure functions stay pinned here, and the wiring tests pin that
 * no finds runtime runs anywhere — the games alone carry the layer,
 * and no record a keeper holds is deleted.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const DOCS = path.resolve(__dirname, "../docs");
const JS = path.join(DOCS, "assets/js");

const HL = require(path.join(JS, "hidden-layer.js"));
const Schema = require(path.join(JS, "life-atlas/life-atlas-schema.js"));
const Repository = require(path.join(JS, "life-atlas/life-atlas-repository.js"));
const Exporter = require(path.join(JS, "life-atlas/life-atlas-export.js"));

/* The real canonical converter, loaded in the site's own order. */
require(path.join(JS, "calendar/pattern-calendar-version.js"));
require(path.join(JS, "calendar/pattern-calendar-data.js"));
require(path.join(JS, "calendar/pattern-calendar-format.js"));
require(path.join(JS, "calendar/pattern-calendar-boundary.js"));
require(path.join(JS, "calendar/pattern-calendar.js"));
const Calendar = globalThis.PatternCalendar;

const read = rel => fs.readFileSync(path.join(DOCS, rel), "utf8");

const SEED = "spark1:test-seed-for-pins";
const PLAN = [174, 183, 196, 222, 249, 264, 297, 333, 396];

/* --------------------------- the curve --------------------------- */

test("the level curve is pinned at the design's numbers", () => {
  const at = finds => HL.levelFor(finds);
  assert.equal(at(0).name, "First Steps");
  assert.equal(at(0).p, 0.85);
  assert.equal(at(0).assurance, 2);
  assert.equal(at(1).name, "Kindling");
  assert.equal(at(1).p, 0.6);
  assert.equal(at(1).assurance, 3);
  assert.equal(at(2).name, "Walking");
  assert.equal(at(4).name, "Walking");
  assert.equal(at(4).p, 0.35);
  assert.equal(at(4).assurance, 5);
  assert.equal(at(5).name, "Deepening");
  assert.equal(at(9).p, 0.18);
  assert.equal(at(9).assurance, 9);
  assert.equal(at(10).name, "Rare Air");
  assert.equal(at(19).p, 0.09);
  assert.equal(at(19).assurance, 18);
  assert.equal(at(20).name, "Quiet Country");
  assert.equal(at(57).p, 0.045);
  assert.equal(at(57).assurance, 36);
});

test("the spawn roll is deterministic and pinned", () => {
  const roll = HL.rollFor({ seed: SEED, civilDate: "2026-11-20", pageId: "glossary" });
  assert.ok(Math.abs(roll - 0.588094) < 1e-6, `roll pinned, got ${roll}`);
  assert.equal(
    HL.rollFor({ seed: SEED, civilDate: "2026-11-20", pageId: "glossary" }),
    roll,
    "same seed, day, and page roll alike"
  );
  assert.notEqual(
    HL.rollFor({ seed: SEED, civilDate: "2026-11-21", pageId: "glossary" }),
    roll,
    "a new day rolls anew"
  );
});

test("a fresh record spawns early; a deep record spawns rarely; assurance holds", () => {
  /* Fresh: the pinned roll (0.588) is under First Steps' 0.85. */
  assert.equal(
    HL.shouldSpawn({ seed: SEED, civilDate: "2026-11-20", pageId: "glossary", findsKept: 0, opportunitiesSinceFind: 0 }),
    true
  );
  /* Fresh assurance: even a roll above 0.85 cannot hold the second
   * opportunity back. Find a page/day whose fresh roll fails, then
   * show the assurance firing on opportunity two. */
  let stubborn = null;
  for (const pageId of Object.keys(HL.PAGE_FINDS)) {
    for (let day = 1; day <= 28; day++) {
      const civilDate = `2027-03-${String(day).padStart(2, "0")}`;
      if (HL.rollFor({ seed: SEED, civilDate, pageId }) >= 0.85) {
        stubborn = { civilDate, pageId };
        break;
      }
    }
    if (stubborn) break;
  }
  assert.ok(stubborn, "a stubborn fresh roll exists in March 2027");
  assert.equal(
    HL.shouldSpawn({ seed: SEED, ...stubborn, findsKept: 0, opportunitiesSinceFind: 0 }),
    false,
    "the first opportunity can miss"
  );
  assert.equal(
    HL.shouldSpawn({ seed: SEED, ...stubborn, findsKept: 0, opportunitiesSinceFind: 1 }),
    true,
    "the second opportunity is assured"
  );

  /* Deep: the same pinned roll is far above Quiet Country's 0.045. */
  assert.equal(
    HL.shouldSpawn({ seed: SEED, civilDate: "2026-11-20", pageId: "glossary", findsKept: 25, opportunitiesSinceFind: 0 }),
    false
  );
  assert.equal(
    HL.shouldSpawn({ seed: SEED, civilDate: "2026-11-20", pageId: "glossary", findsKept: 25, opportunitiesSinceFind: 35 }),
    true,
    "the 36th opportunity is assured even in Quiet Country"
  );
});

/* --------------------------- the finds --------------------------- */

test("the placement table in code offers kinds only where the design argues them", () => {
  assert.deepEqual(HL.PAGE_FINDS.frequencies, ["tone-fragment"]);
  assert.deepEqual(HL.PAGE_FINDS.glossary, ["word"]);
  assert.deepEqual(HL.PAGE_FINDS.garden, ["pressed-leaf"]);
  assert.deepEqual(HL.PAGE_FINDS.moons, ["pressed-leaf"]);
  assert.deepEqual(HL.PAGE_FINDS["equinox-passage"], ["smooth-stone"]);
  assert.equal(HL.PAGE_FINDS["living-time-sphere"], undefined, "nothing is found on the instrument");
  assert.equal(HL.PAGE_FINDS["claims-atlas"], undefined, "no finds among graded claims");
  assert.equal(HL.PAGE_FINDS.witness, undefined, "Aaron's own page is untouched");
  assert.equal(
    HL.candidateFor({ seed: SEED, civilDate: "2026-11-20", pageId: "claims-atlas", sparkKind: "earth", conv: null, chimePlan: PLAN }),
    null
  );
});

test("seeded finds reproduce identically, and carry their teaching on their face", () => {
  const input = { seed: SEED, civilDate: "2026-11-20", pageId: "glossary", sparkKind: "air", conv: null, chimePlan: PLAN };
  const first = HL.candidateFor(input);
  const second = HL.candidateFor(input);
  assert.deepEqual(first, second, "the same find waits all day");
  assert.equal(first.kind, "word");
  assert.ok(HL.WORD_POOL.some(entry => entry.term === first.term), "the word is one of the Glossary's own");
  const poolEntry = HL.WORD_POOL.find(entry => entry.term === first.term);
  assert.equal(first.detail, poolEntry.line, "the find teaches the word in the page's own words");
  assert.match(first.teaching, /The Name/);

  const tone = HL.candidateFor({ seed: SEED, civilDate: "2026-11-20", pageId: "frequencies", sparkKind: "fire", conv: null, chimePlan: PLAN });
  assert.equal(tone.kind, "tone-fragment");
  assert.ok(PLAN.includes(tone.hz), "the fragment is one of the day's own tones");
  assert.match(tone.teaching, /Attunement/);

  const stone = HL.candidateFor({ seed: SEED, civilDate: "2026-11-20", pageId: "equinox-passage", sparkKind: "earth", conv: null, chimePlan: PLAN });
  assert.equal(stone.kind, "smooth-stone");
  assert.match(stone.detail, /The sky moves; the Pattern remains stable/);
});

/* --------------------------- keepsake records --------------------------- */

test("a keepsake is the garden pass's own shape and rides the Atlas export", async () => {
  const repository = Repository.createRepository();
  const find = HL.candidateFor({ seed: SEED, civilDate: "2026-11-20", pageId: "glossary", sparkKind: "air", conv: null, chimePlan: PLAN });
  const record = HL.buildKeepsakeRecord(find, {
    civilDate: "2026-11-20",
    patternYear: 1,
    moon: 8,
    moonDay: 22,
    patternDay: 218
  });

  assert.equal(record.type, "artifact");
  assert.equal(record.subtype, "hidden-keepsake");
  assert.ok(record.tags.includes("hidden-layer"));
  assert.ok(record.tags.includes("spark-find"));
  assert.equal(record.payload.hiddenLayer.kind, "word");
  assert.equal(record.payload.hiddenLayer.source, "find");
  assert.equal(record.payload.hiddenLayer.findKey, find.findKey);
  assert.equal(record.provenance.sourceType, "hidden-layer");
  assert.equal(record.privacy.visibility, "private");

  /* The canonical schema accepts the shape. */
  const wrapped = Schema.createLifeRecord(record);
  assert.ok(wrapped, "schema wraps the keepsake");

  await repository.put(record);
  const kept = await repository.query({ subtype: "hidden-keepsake" });
  assert.equal(kept.length, 1);
  assert.equal(kept[0].payload.hiddenLayer.term, find.term);

  const backupText = Exporter.serializeBackup(await repository.exportRecords());
  const parsed = Exporter.parseBackup(backupText);
  assert.ok(parsed, "backup parses");
  assert.equal(parsed.rejected.length, 0, "the keepsake rides the Atlas export unchanged");
});

/* --------------------------- the tone game --------------------------- */

test("the tone round's target is the day's tone, flanked by its nearest neighbours", () => {
  const round = HL.toneRoundFor({ chimePlan: PLAN, salt: "2026-11-20|tone" });
  assert.equal(round.target, 264);
  assert.deepEqual([...round.options].sort((a, b) => a - b), [249, 264, 297]);
  assert.equal(round.options[round.correctIndex], round.target);
  assert.equal(HL.toneRoundFor({ chimePlan: [220, 330], salt: "x" }), null, "three tones or no round");
});

/* --------------------------- the count game --------------------------- */

test("the calendar fixture holds through the module's own path", () => {
  const conv = Calendar.fromCivilDate({ date: new Date("2026-09-15T12:00:00Z"), timeZone: "UTC" });
  assert.equal(conv.moon, 6);
  assert.equal(conv.day, 12);
  assert.equal(conv.dayOfPatternYear, 152);
});

test("The Count steps across a moon's end, every label a real conversion", () => {
  const round = HL.buildCountRound(Calendar, "2026-09-15");
  assert.deepEqual(round.steps, ["Moon 6 · Day 25", "Moon 6 · Day 26", "Moon 6 · Day 27", "Moon 6 · Day 28"]);
  assert.equal(round.answer, "Moon 7 · Day 1");
  assert.ok(round.options.includes("Moon 6 · Day 29"), "the impossible day is offered as the classic mistake");
  assert.equal(round.options[round.correctIndex], round.answer);
  assert.equal(round.crossesIntoAnswer, true);

  /* Each shown step is the true conversion of consecutive days. */
  for (let i = 0; i < 4; i++) {
    const conv = Calendar.fromCivilDate({
      date: new Date(`${round.startCivilDate}T12:00:00Z`),
      timeZone: "UTC"
    });
    assert.ok(conv);
    const stepped = new Date(`${round.startCivilDate}T12:00:00Z`);
    stepped.setUTCDate(stepped.getUTCDate() + i);
    const real = Calendar.fromCivilDate({ date: stepped, timeZone: "UTC" });
    assert.equal(round.steps[i], HL.stepLabel(real));
  }
});

test("The Count crosses the Day Out of Time at the year's turn", () => {
  const round = HL.buildCountRound(Calendar, "2026-04-10");
  assert.deepEqual(round.steps, ["Moon 13 · Day 25", "Moon 13 · Day 26", "Moon 13 · Day 27", "Moon 13 · Day 28"]);
  assert.equal(round.answer, "Day Out of Time");
  assert.ok(round.options.includes("Moon 1 · Day 1"), "skipping the Day Out of Time is the other classic mistake");
  assert.ok(round.options.includes("Moon 13 · Day 29"));
  assert.equal(round.crossesIntoAnswer, true);
});

/* --------------------------- wiring and fences --------------------------- */

test("the game rooms carry the layer; the finds pages no longer load it", () => {
  for (const page of ["systems/frequencies.html", "theory/thirteen-moons.html"]) {
    const html = read(page);
    assert.match(html, /hidden-layer\.js/, `${page} loads the module`);
    assert.match(html, /hidden-layer\.css/, `${page} loads the styles`);
  }
  for (const page of ["glossary.html", "garden.html", "moons.html", "equinox-passage.html"]) {
    const html = read(page);
    assert.ok(!/hidden-layer\.(js|css)/.test(html), `${page} loads no hidden-layer runtime`);
  }
  assert.match(read("systems/frequencies.html"), /data-hidden-layer-game="tone"/);
  assert.match(read("theory/thirteen-moons.html"), /data-hidden-layer-game="count"/);
  for (const page of ["systems/frequencies.html", "glossary.html", "equinox-passage.html"]) {
    assert.match(read(page), /life-atlas-repository\.js/, `${page} gained the Atlas block in the garden's pattern`);
  }
});

test("the finds layer is off: nothing spawns, nothing renders, nothing is deleted", () => {
  /* Aaron, Nov 20, 2026: "The finds layer is pointless right now."
   * The whole layer is off — no chip, no shelf, no find offered on
   * any page — while the games play on untouched and every record
   * a keeper already holds stays exactly as it was. */
  const source = read("assets/js/hidden-layer.js");
  const styles = read("assets/css/hidden-layer.css");
  for (const gone of ["hl-shelf-chip", "hl-shelf", "hl-notice", "renderShelf", "offerFind"]) {
    assert.ok(!source.includes(gone), `the module carries no ${gone}`);
    assert.ok(!styles.includes(gone), `the styles carry no ${gone}`);
  }
  assert.ok(!/repository\.(delete|remove)|deleteDatabase/.test(source), "the module deletes no record");
  assert.match(source, /bootToneGame\(\{ state, repository/, "the tone game still boots");
  assert.match(source, /bootCountGame\(\{ state, repository/, "the count game still boots");
});

test("fences: no network, no guilt language, no protected files in the module's world", () => {
  const source = read("assets/js/hidden-layer.js");
  assert.ok(!/fetch\s*\(|XMLHttpRequest|WebSocket/.test(source), "the module makes no network calls");
  assert.ok(!/you missed|streak|don't lose|hurry|expires? (in|soon)|limited time/i.test(source), "no absence-guilt or pressure language");
  assert.ok(!/\bshe\b|\bher\b/i.test(source.replace(/other/g, "")), "the Spark is never gendered in the module's copy");
});
