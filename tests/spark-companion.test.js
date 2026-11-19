/*
 * Spark companion — the creature, its seed, its growth, its voice.
 *
 * The Spark is procedural: a seed string builds the whole companion,
 * and the same seed must build the same companion anywhere, forever —
 * that is what lets a Spark be a Spark and not a database row. The
 * seed is rooted in Living Time (Moon + Pattern Day of the adoption
 * day, read by the page from the canonical PatternCalendar; the core
 * never computes dates itself).
 *
 * The seed speaks the Spark's name: the same seed grows the same
 * name anywhere. The keeper may add a name of their own in the
 * record — the name it answers to — and guidance speaks that first.
 *
 * Growth is counted from plain on-device facts: return days, pages
 * seen, practice days sealed. Nothing here may reach for a network,
 * an account, or a protected R1.7 file.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const Core = require(path.join(root, "docs/assets/js/spark-companion.js"));

const SEED_A = Core.makeSeed({ moon: 8, patternDay: 216, kindIndex: 1, nonce: "ab12cd34" });
const SEED_B = Core.makeSeed({ moon: 8, patternDay: 216, kindIndex: 1, nonce: "zz98yy76" });

test("the same seed builds the same Spark, twice over", () => {
  assert.deepEqual(Core.generate(SEED_A), Core.generate(SEED_A));
});

test("different seeds build different Sparks", () => {
  const a = Core.generate(SEED_A);
  const b = Core.generate(SEED_B);
  assert.notDeepEqual(
    { form: a.form, markings: a.markings, palette: a.palette, trait: a.trait },
    { form: b.form, markings: b.markings, palette: b.palette, trait: b.trait }
  );
});

test("a seed survives the round trip and carries its birth coordinate", () => {
  const parsed = Core.parseSeed(SEED_A);
  assert.equal(parsed.moon, 8);
  assert.equal(parsed.patternDay, 216);
  assert.equal(Core.makeSeed(parsed), SEED_A);
  const spark = Core.generate(SEED_A);
  assert.equal(spark.birthMoon, 8);
  assert.equal(spark.birthPatternDay, 216);
});

test("bad seeds are refused, not guessed at", () => {
  assert.equal(Core.parseSeed("spark1-99-216-1-ab12cd34"), null);
  assert.equal(Core.parseSeed("spark1-8-999-1-ab12cd34"), null);
  assert.equal(Core.parseSeed("spark1-8-216-9-ab12cd34"), null);
  assert.equal(Core.parseSeed("not-a-seed"), null);
  assert.equal(Core.generate("not-a-seed"), null);
  assert.equal(Core.generate(null), null);
});

test("a Day Out of Time adoption still roots in Living Time", () => {
  const seed = Core.makeSeed({ moon: null, patternDay: null, kindIndex: 5, nonce: "doot0001" });
  const spark = Core.generate(seed);
  assert.equal(spark.birthMoon, null);
  assert.equal(spark.birthPatternDay, 365);
  assert.equal(spark.kindName, "Light");
});

test("the six kinds are the Noods kinds, each with its temperament", () => {
  assert.deepEqual(
    Core.KINDS.map((k) => k.id),
    ["fire", "water", "shadow", "air", "earth", "light"]
  );
  const byId = Object.fromEntries(Core.KINDS.map((k) => [k.id, k.temperament]));
  assert.equal(byId.fire, "bold");
  assert.equal(byId.earth, "steady");
  assert.equal(byId.shadow, "quiet");
  assert.equal(byId.water, "gentle");
  assert.equal(byId.air, "curious");
  assert.equal(byId.light, "bright");
});

test("answers outvote the coordinate; a tie falls back to it", () => {
  const coord = Core.coordinateKindIndex(8, 216);
  assert.equal(
    Core.resolveKindIndex({ moon: 8, patternDay: 216, answers: [] }),
    coord
  );
  const fire = Core.kindIndexById("fire");
  assert.equal(
    Core.resolveKindIndex({ moon: 8, patternDay: 216, answers: ["fire", "fire", "water"] }),
    fire
  );
  const tied = Core.resolveKindIndex({
    moon: 8,
    patternDay: 216,
    answers: ["fire", "water"]
  });
  assert.ok([fire, Core.kindIndexById("water"), coord].includes(tied));
});

test("the adoption questions are three, light, and every answer leans somewhere", () => {
  assert.equal(Core.QUESTIONS.length, 3);
  for (const q of Core.QUESTIONS) {
    assert.ok(q.ask.length > 0);
    assert.ok(q.options.length >= 3);
    for (const opt of q.options) assert.ok(Core.kindIndexById(opt.kind) >= 0, opt.kind);
  }
});

test("the keeper's name is kept with the record, cleaned", () => {
  const record = Core.newRecord({ seed: SEED_A, name: "  Ember   Lee ", civilDate: "2026-11-18" });
  assert.equal(record.name, "Ember Lee");
  assert.equal(record.seed, SEED_A);
  const blank = Core.newRecord({ seed: SEED_A, name: "", civilDate: "2026-11-18" });
  assert.equal(blank.name, "", "blank stays blank — the seed-name still speaks");
  assert.equal(Core.cleanName("x".repeat(40)).length, 24);
});

test("the seed speaks the name: same seed, same name, anywhere", () => {
  const a = Core.generate(SEED_A);
  const b = Core.generate(SEED_A);
  assert.ok(a.name && a.name.length >= 3, "a seed-name exists");
  assert.equal(a.name, b.name);
  assert.equal(Core.seedNameFor(SEED_A, a.kind), a.name);
  const names = new Set();
  for (let i = 0; i < 40; i++) {
    const seed = Core.makeSeed({ moon: 8, patternDay: 216, kindIndex: i % 6, nonce: `n${i}` });
    names.add(Core.generate(seed).name);
  }
  assert.ok(names.size > 20, `names vary across seeds (got ${names.size} of 40)`);
});

test("the spoken name: the keeper's name first, the seed-name otherwise", () => {
  const companion = Core.generate(SEED_A);
  const named = Core.newRecord({ seed: SEED_A, name: "Ember", civilDate: "2026-11-18" });
  assert.equal(Core.displayName(named, companion), "Ember");
  const unnamed = Core.newRecord({ seed: SEED_A, name: "", civilDate: "2026-11-18" });
  assert.equal(Core.displayName(unnamed, companion), companion.name);
  const g1 = Core.guidanceFor({ record: named, companion, todayPatternDay: 216 });
  assert.equal(g1.name, "Ember");
  const g2 = Core.guidanceFor({ record: unnamed, companion, todayPatternDay: 216 });
  assert.equal(g2.name, companion.name);
});

test("shape: size, glow, gait and pace are the seed's own, in range", () => {
  const a = Core.generate(SEED_A);
  const b = Core.generate(SEED_A);
  assert.deepEqual(a.shape, b.shape);
  assert.ok(a.shape.size >= 0.85 && a.shape.size <= 1.18, a.shape.size);
  assert.ok(["soft", "bright", "deep"].includes(a.shape.glow), a.shape.glow);
  assert.ok(["stroll", "drift", "hop"].includes(a.shape.gait), a.shape.gait);
  assert.ok(a.shape.pace >= 0.9 && a.shape.pace <= 1.1, a.shape.pace);
  const svg = Core.renderSVG(a, { stage: 0 });
  assert.ok(svg.includes(`data-spark-gait="${a.shape.gait}"`));
  assert.ok(svg.includes(`data-spark-size="${a.shape.size}"`));
});

test("growth counts return days, pages, and practice — each once", () => {
  let record = Core.newRecord({ seed: SEED_A, name: "Ember", civilDate: "2026-11-18" });
  record = Core.recordVisit(record, { patternDay: 216, page: "index.html" });
  record = Core.recordVisit(record, { patternDay: 216, page: "index.html" });
  assert.deepEqual(record.daysSeen, [216]);
  assert.deepEqual(record.pagesSeen, ["index.html"]);
  record = Core.recordVisit(record, { patternDay: 217, page: "moons.html" });
  record = Core.recordPractice(record, { patternDay: 217 });
  record = Core.recordPractice(record, { patternDay: 217 });
  assert.deepEqual(record.practiceDays, [217]);
  /* 1 return day x2 + 1 practice day x3 + 2 pages = 7 points */
  assert.equal(Core.growthPoints(record), 7);
  assert.equal(Core.stageOf(record).name, "Kindled");
});

test("stages rise in order and never fall", () => {
  const names = Core.STAGES.map((s) => s.name);
  assert.deepEqual(names, ["Just born", "Kindled", "Growing", "Bright", "Radiant"]);
  let last = -1;
  for (let points = 0; points <= 30; points++) {
    const ix = Core.stageFor(points).index;
    assert.ok(ix >= last, `stage fell at ${points}`);
    last = ix;
  }
  assert.equal(Core.stageFor(25).name, "Radiant");
});

test("guidance is drawn from the record, in plain words, with a door", () => {
  const companion = Core.generate(SEED_A);
  let record = Core.newRecord({ seed: SEED_A, name: "Ember", civilDate: "2026-11-18" });
  record = Core.recordVisit(record, { patternDay: 216, page: "companions.html" });
  let g = Core.guidanceFor({ record, companion, todayPatternDay: 216 });
  assert.equal(g.href, "moons.html"); /* first day: the telling */

  record = Core.recordVisit(record, { patternDay: 217, page: "moons.html" });
  g = Core.guidanceFor({ record, companion, todayPatternDay: 217 });
  assert.equal(g.href, "teach.html"); /* no practice sealed yet */

  record = Core.recordPractice(record, { patternDay: 217 });
  g = Core.guidanceFor({ record, companion, todayPatternDay: 217 });
  assert.equal(g.href, "living-time-sphere.html"); /* the Sphere, together */

  const away = { ...record, lastDay: 200 };
  g = Core.guidanceFor({ record: away, companion, todayPatternDay: 217 });
  assert.match(g.text, /away 17 days/);
  assert.equal(g.href, "moons.html");
});

test("each Spark has its own little voice, pitched by its kind", () => {
  const a = Core.chirpFor(Core.generate(SEED_A));
  assert.ok(a.first > 0 && a.second > a.first);
  assert.deepEqual(a, Core.chirpFor(Core.generate(SEED_A)));
  const fire = Core.chirpFor(
    Core.generate(Core.makeSeed({ moon: 1, patternDay: 1, kindIndex: 0, nonce: "fire0001" }))
  );
  const earth = Core.chirpFor(
    Core.generate(Core.makeSeed({ moon: 1, patternDay: 1, kindIndex: 4, nonce: "erth0001" }))
  );
  assert.ok(fire.first > earth.first, "Fire chirps higher than Earth");
  const presence = read("docs/assets/js/spark-presence.js");
  assert.ok(presence.includes("AudioContext"), "the voice is made in the browser, no audio files");
  assert.ok(presence.includes("sof.spark.sound"), "the off switch is kept on the device");
});

test("the drawing is built from the parts, and growth shows on it", () => {
  const spark = Core.generate(SEED_A);
  const young = Core.renderSVG(spark, { stage: 0 });
  assert.match(young, /<svg/);
  assert.ok(young.includes(`data-spark-form="${spark.form}"`));
  assert.ok(!young.includes("stroke-dasharray"), "no stage ring before Growing");
  const grown = Core.renderSVG(spark, { stage: 2 });
  assert.ok(grown.includes("stroke-dasharray"), "stage ring appears at Growing");
  const radiant = Core.renderSVG(spark, { stage: 4 });
  assert.ok(radiant.includes('data-spark-stage="4"'));
});

test("the companions page carries the meeting: questions, a name, and the keep", () => {
  const html = read("docs/companions.html");
  assert.match(html, /<title>Companions/);
  assert.ok(html.includes('id="spark-name"'), "the keeper may add their own name for it on the page");
  assert.ok(html.includes('id="spark-preview-name"'), "the seed-name is spoken at the meeting");
  assert.ok(html.includes('id="spark-seed-name"'), "the seed-name is kept on the companion card");
  assert.ok(html.includes('id="spark-questions"'), "the adoption questions have a home");
  assert.ok(html.includes('id="spark-keep"'), "the keep button is there");
  assert.ok(html.includes("pattern-calendar.js"), "the birth coordinate comes from the canonical calendar");
  assert.ok(html.includes("spark-companion.js"), "the core is loaded");
  assert.ok(html.includes("spark-companions-page.js"), "the page glue is loaded");
  assert.ok(!html.includes("mongodb"), "no accounts machinery in v1");
});

test("the presence follows the visitor, and never enters protected ground", () => {
  for (const page of ["index.html", "moons.html", "teach.html", "witness.html", "hub.html", "shop.html"]) {
    assert.ok(read(`docs/${page}`).includes("spark-presence.js"), `${page} carries the presence`);
  }
  for (const page of ["living-time-sphere.html", "404.html", "offline.html"]) {
    assert.ok(!read(`docs/${page}`).includes("spark-presence"), `${page} stays untouched`);
  }
  const presence = read("docs/assets/js/spark-presence.js");
  assert.ok(presence.includes("CodexLifeAtlasRepository"), "practice is read from the Atlas, not re-stored");
  assert.ok(presence.includes("PatternCalendar"), "the day comes from the canonical calendar");
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(presence), "the presence sends nothing anywhere");
});

test("the Spark roams: it walks in, strolls, and respects reduced motion", () => {
  const presence = read("docs/assets/js/spark-presence.js");
  assert.ok(presence.includes("prefers-reduced-motion"), "reduced motion is checked before any walking");
  assert.ok(presence.includes("spark-walker"), "the Spark travels in its walker");
  const css = read("docs/assets/css/spark-companion.css");
  assert.match(css, /\.spark-presence\s*\{[^}]*pointer-events:\s*none/, "the walking strip never blocks the page");
  assert.match(css, /prefers-reduced-motion/, "the stylesheet stills the Spark for reduced motion");
});

test("no R1.7 protected file is touched by the Spark", () => {
  const manifest = read("docs/development/R1.7-PROTECTED-MANIFEST.md");
  for (const rel of [
    "docs/assets/js/spark-companion.js",
    "docs/assets/js/spark-presence.js",
    "docs/assets/js/spark-companions-page.js",
    "docs/companions.html"
  ]) {
    const base = rel.split("/").pop();
    assert.ok(!manifest.includes(base), `${base} must not be a protected file`);
  }
});
