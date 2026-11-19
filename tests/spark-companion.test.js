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
  assert.equal(Core.stageOf(record).name, "Ember");
  /* One more practice day carries it over the Flame threshold. */
  record = Core.recordPractice(record, { patternDay: 218 });
  assert.equal(Core.growthPoints(record), 10);
  assert.equal(Core.stageOf(record).name, "Flame");
});

test("stages rise in order and never fall", () => {
  const names = Core.STAGES.map((s) => s.name);
  assert.deepEqual(names, ["Ember", "Flame", "Radiant"]);
  let last = -1;
  for (let points = 0; points <= 30; points++) {
    const ix = Core.stageFor(points).index;
    assert.ok(ix >= last, `stage fell at ${points}`);
    last = ix;
  }
  assert.equal(Core.stageFor(25).name, "Radiant");
});

test("evolution: three stages, one creature, grown by returns alone", () => {
  const spark = Core.generate(SEED_A);
  assert.equal(Core.STAGES.length, 3, "three stages, as the Noods grew");
  assert.equal(Core.stageFor(0).name, "Ember");
  assert.equal(Core.stageFor(8).name, "Flame");
  assert.equal(Core.stageFor(25).name, "Radiant");

  /* The same seed at every stage: form, palette and gait never
   * change — only the body's development does. */
  const ember = Core.renderSVG(spark, { stage: 0 });
  const flame = Core.renderSVG(spark, { stage: 1 });
  const radiant = Core.renderSVG(spark, { stage: 2 });
  for (const svg of [ember, flame, radiant]) {
    assert.ok(svg.includes(`data-spark-form="${spark.form}"`), "same form at every stage");
    assert.ok(svg.includes(spark.palette.body), "same seed-true colours at every stage");
  }
  assert.ok(ember.includes('data-spark-stage="0"'));
  assert.ok(!ember.includes("stroke-dasharray"), "an Ember wears no ring yet");
  assert.ok(!ember.includes("M38 12"), "and no crown");
  assert.ok(flame.includes('data-spark-stage="1"'));
  assert.ok(flame.includes('r="44"'), "a Flame gains its plain ring");
  assert.ok(!flame.includes("stroke-dasharray"), "but not the dashed ring");
  assert.ok(radiant.includes("stroke-dasharray"), "a Radiant wears the dashed gold ring");
  assert.ok(radiant.includes("M38 12"), "and the crown");
  /* Growth is visible in the drawing itself: the body stands
   * larger at each stage. */
  const scaleOf = (svg) => Number(svg.match(/translate\(50 54\) scale\(([\d.]+)\)/)[1]);
  assert.ok(scaleOf(ember) < scaleOf(flame), "Flame stands larger than Ember");
  assert.ok(scaleOf(flame) < scaleOf(radiant), "Radiant stands largest");

  /* Progress is honest: the record's own counts, the next stage,
   * and the points it stands at. */
  let record = Core.newRecord({ seed: SEED_A, name: "", civilDate: "2026-11-18" });
  record = Core.recordVisit(record, { patternDay: 216, page: "index.html" });
  const progress = Core.progressOf(record, spark);
  assert.equal(progress.stage.name, "Ember");
  assert.equal(progress.next.name, "Flame");
  assert.equal(progress.counts.days, 1);
  assert.equal(progress.counts.pages, 1);
  assert.equal(progress.counts.practice, 0);
  assert.ok(progress.nextAt >= 8, "Flame stands at 8 points, bent only by its own pace");
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
  assert.ok(!young.includes("stroke-dasharray"), "no dashed ring for an Ember");
  const grown = Core.renderSVG(spark, { stage: 2 });
  assert.ok(grown.includes("stroke-dasharray"), "the dashed ring appears at Radiant");
  assert.ok(grown.includes('data-spark-stage="2"'));
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

test("the Spark plays: it roams free, dodges a near pointer by temperament, and a tap still lands", () => {
  const presence = read("docs/assets/js/spark-presence.js");
  /* Free roam: a real character engine, not a corner stroll. */
  assert.ok(presence.includes("requestAnimationFrame"), "movement runs on the frame loop");
  assert.ok(presence.includes("pickTarget"), "it chooses where to wander: floor, sides, open middle");
  assert.ok(presence.includes("visibilitychange"), "it rests when the tab is hidden");
  assert.ok(presence.includes("is-flipped"), "it turns to face the way it travels");
  /* Pointer play, shaped by temperament. */
  assert.ok(presence.includes("pointermove"), "it feels a cursor approach");
  assert.ok(presence.includes("pointerdown"), "and a finger's landing — touch has no hover");
  assert.ok(presence.includes("const PLAY = {"), "the play is a table of temperaments");
  for (const t of ["bold", "curious", "bright", "gentle", "steady", "quiet"]) {
    assert.ok(presence.includes(`${t}: { radius:`), `${t} has its own radius, scoot, and cooldown`);
  }
  assert.ok(presence.includes("approach"), "bold and curious Sparks sometimes come to look instead");
  assert.ok(presence.includes("settleUntil"), "after three quick scoots it settles, where a tap can reach it");
  assert.ok(presence.includes("play.cooldown"), "a cooldown caps how often it may scoot");
  assert.ok(presence.includes("hooks.isOpen()"), "it never scoots or roams while its bubble is open");
  /* Character reactions, in motion only. */
  assert.ok(presence.includes("is-delighted"), "a tap lands as a delighted bounce");
  assert.ok(presence.includes("SIGNATURE"), "its idle signature leans to its temperament");
  for (const cls of ["is-spinning", "is-stretching", "is-looking"]) {
    assert.ok(presence.includes(cls), `idle life includes ${cls}`);
  }
  const css = read("docs/assets/css/spark-companion.css");
  for (const kf of ["spark-delight", "spark-spin-once", "spark-stretch", "spark-look", "spark-evolve"]) {
    assert.ok(css.includes(`@keyframes ${kf}`), `${kf} is drawn`);
  }
  const reduceBlock = css.slice(css.indexOf("prefers-reduced-motion"));
  for (const cls of ["is-delighted", "is-spinning", "is-stretching", "is-looking", "is-evolving"]) {
    assert.ok(reduceBlock.includes(cls), `reduced motion stills ${cls}`);
  }
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(presence), "the play sends nothing anywhere either");
  /* The research layer: predictive, anticipated, chosen, steered. */
  assert.ok(presence.includes("pointerPredicted"), "it flees from where the pointer will be, not only where it is");
  assert.ok(presence.includes("trackPointer"), "the pointer is tracked with its velocity");
  assert.ok(presence.includes('state = "anticipate"'), "a crouch — anticipation — stands between the startle and the dart");
  assert.ok(presence.includes("ctrl.crouch()"), "and the 3D body is told to gather itself");
  assert.ok(presence.includes("peekWanted"), "the tease: after a dodge, a still pointer earns a peek back");
  assert.ok(presence.includes("chooseBehavior"), "idle choices are scored by a small utility brain");
  assert.ok(presence.includes("playfulness"), "whose weights are the temperament's own curves");
  assert.ok(presence.includes("maxForce"), "it travels by steering — velocity and a capped force — never by sliding");
});

test("the Spark has a 3D body: seed-grown WebGL, honestly falling back to the flat figure", () => {
  const d3 = read("docs/assets/js/spark-3d.js");
  assert.ok(d3.includes("Spark3D"), "the renderer stands as its own module");
  assert.ok(d3.includes('getContext("webgl"'), "hand-rolled WebGL1, no library");
  assert.ok(!/https?:\/\//.test(d3), "nothing is fetched — the site stays static and offline");
  assert.ok(d3.includes("return null"), "where WebGL is not to be had, the mount declines");
  assert.ok(d3.includes("buildGeometry"), "the body is built from the companion, not shipped as a model");
  for (const form of ["orb", "shard", "comet", "sprout", "wave", "moth"]) {
    assert.ok(d3.includes(`"${form}"`), `the ${form} form has a 3D body family`);
  }
  assert.ok(d3.includes("speckle"), "markings map onto the form's own faces");
  assert.ok(d3.includes("marks3d"), "from their own seed stream");
  assert.ok(d3.includes("stage >= 2"), "evolution changes the 3D form: the Radiant gains ring and crown");
  assert.ok(d3.includes("dart") && d3.includes("delight") && d3.includes("celebrate"), "its movements are its life's: dart, delight, celebrate");
  assert.ok(d3.includes("lookAt"), "it looks toward a near pointer");
  assert.ok(d3.includes("visibilitychange"), "its loop rests when the tab hides");
  assert.ok(d3.includes("tier"), "and steps its own quality down on a slow device");
  assert.ok(d3.includes("prefers-reduced-motion"), "reduced motion gets one still frame");
  /* The research layer, in the body: a gaze with saccades and
   * blinks, a spring that lands the same at any frame rate, a
   * wrap-and-rim light, a soft blob shadow, seed-true shape. */
  assert.ok(d3.includes("nextSaccade"), "its gaze jumps in saccades, with an occasional aversion");
  assert.ok(d3.includes("blinkScale"), "and now and then it blinks");
  assert.ok(d3.includes("eyeYaw"), "the eyes lead; the head follows");
  assert.ok(d3.includes("1 / 240"), "its bounce is a spring stepped at a fixed 240Hz");
  assert.ok(d3.includes("uRim"), "a rim of its own glow colour rims the form");
  assert.ok(d3.includes("wrap"), "lit by a wrap diffuse, not a flat Lambert");
  assert.ok(d3.includes("SHADOW_VERT"), "a fake soft shadow grounds it — no shadow maps");
  assert.ok(d3.includes('":shape"'), "its exact proportions grow from its seed too");
  assert.ok(d3.includes("lastActivity"), "a long-resting Spark draws ever more rarely");
  const presence = read("docs/assets/js/spark-presence.js");
  assert.ok(presence.includes("Spark3D"), "the presence mounts the 3D body");
  assert.ok(presence.includes("has-3d"), "and the flat drawing steps aside only when it stands");
  assert.ok(presence.includes("renderSVG"), "the flat figure remains — the fallback is the original");
  const page = read("docs/assets/js/spark-companions-page.js");
  assert.ok(page.includes("Spark3D"), "its home panel stands in 3D too");
  for (const p of ["index.html", "moons.html", "companions.html"]) {
    assert.ok(read(`docs/${p}`).includes("spark-3d.js"), `${p} loads the renderer before the presence`);
  }
});

test("evolution is celebrated in the presence, never as a modal", () => {
  const presence = read("docs/assets/js/spark-presence.js");
  assert.ok(presence.includes("stageBefore"), "the stage is read before the visit's facts land");
  assert.ok(presence.includes("stageAfter"), "and after — the crossing is this visit's own");
  assert.ok(presence.includes("is-evolving"), "the growth shows as a flourish of the body");
  assert.ok(presence.includes("chirpCelebration"), "and a chirp, only through the voice a tap already woke");
  assert.ok(presence.includes("voiceArmed"), "an unwoken voice stays silent — nothing autoplays");
  const page = read("docs/assets/js/spark-companions-page.js");
  assert.ok(page.includes("progressOf"), "the panel shows honest progress from the record");
  assert.ok(page.includes("Stage ${stage.index + 1} of"), "with the stage named, of three");
});

test("the meeting speaks first: the Spark introduces itself by its seed-name", () => {
  const companion = Core.generate(SEED_A);
  const words = Core.encounterFor({ companion });
  assert.equal(words.greeting, "Hey — I'm the Spark you adopt.");
  assert.ok(words.intro.includes(companion.name), "the introduction speaks the seed-born name");
  assert.ok(words.intro.includes(companion.kindName), "and its kind");
  assert.match(words.born, /Moon 8, Pattern Day 216/, "and the day it was made from");
  assert.equal(words.adoptLabel, `Adopt ${companion.name}`, "one tap adopts it, by name");
  assert.equal(words.laterLabel, "Not now");
  assert.match(words.invite, /only on this device/, "the invitation is honest about where it lives");
});

test("a Day Out of Time meeting does not invent a moon", () => {
  const seed = Core.makeSeed({ moon: null, patternDay: null, kindIndex: 5, nonce: "doot0001" });
  const words = Core.encounterFor({ companion: Core.generate(seed) });
  assert.match(words.born, /Day Out of Time/);
  assert.ok(!/Moon \d/.test(words.born), "no moon is claimed for the day outside the moons");
});

test("the guide names the place you arrived at, and points to a fitting next door", () => {
  const companion = Core.generate(SEED_A);
  let record = Core.newRecord({ seed: SEED_A, name: "Ember", civilDate: "2026-11-18" });
  record = Core.recordVisit(record, { patternDay: 216, page: "index.html" });
  const a = Core.arrivalFor({ record, companion, todayPatternDay: 216, page: "index.html" });
  assert.match(a.text, /Front Door/, "it says where you are");
  assert.equal(a.href, "moons.html", "and suggests the fitting next door");
  assert.equal(a.name, "Ember", "speaking to the keeper's name, as always");

  /* Once that next door is walked, the record's own standing
   * suggestion speaks instead of repeating the same pointer. */
  record = Core.recordVisit(record, { patternDay: 216, page: "moons.html" });
  const again = Core.arrivalFor({ record, companion, todayPatternDay: 216, page: "index.html" });
  assert.equal(again.href, Core.guidanceFor({ record, companion, todayPatternDay: 216 }).href);

  /* A page the guide cannot name falls back to the record, whole. */
  const unknown = Core.arrivalFor({ record, companion, todayPatternDay: 216, page: "ab.html" });
  assert.deepEqual(unknown, Core.guidanceFor({ record, companion, todayPatternDay: 216 }));
});

test("every door the guide points to is a real page", () => {
  for (const [page, info] of Object.entries(Core.PAGE_GUIDE)) {
    assert.ok(info.place && info.line, `${page} has a name and a line`);
    assert.ok(
      fs.existsSync(path.join(root, "docs", info.next.href)),
      `${page} points to ${info.next.href}, which exists`
    );
  }
});

test("the pop-up meeting rides the presence: one tap, a remembered not-now, a waiting ember", () => {
  const presence = read("docs/assets/js/spark-presence.js");
  assert.ok(presence.includes("PENDING_KEY"), "the waiting Spark's seed is kept on the device");
  assert.ok(presence.includes("spark-encounter"), "the Spark pops up and introduces itself");
  assert.ok(presence.includes("spark-encounter-adopt"), "one button adopts it");
  assert.ok(presence.includes("spark-ember"), "after not-now it waits as an ember at the edge");
  assert.ok(presence.includes("arrivalFor"), "arriving somewhere new, it speaks as a guide");
  assert.ok(presence.includes("le-rail"), "its furniture lifts clear of the homepage's bottom path rail");
  assert.ok(presence.includes("lpo-overlay"), "the guide also waits for a page opening, not only the homepage entry");
  assert.ok(presence.includes("encounterFor"), "its first words come from the core, in its own voice");
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(presence), "the meeting sends nothing anywhere either");
  const page = read("docs/assets/js/spark-companions-page.js");
  assert.ok(page.includes("PENDING_KEY"), "a Spark kept on its home page ends the ember's wait");
  const css = read("docs/assets/css/spark-companion.css");
  assert.match(css, /\.spark-encounter\s*\{/, "the meeting has its card");
  assert.match(css, /\.spark-ember\s*\{/, "the ember has its place at the edge");
});

test("no R1.7 protected file is touched by the Spark", () => {
  const manifest = read("docs/development/R1.7-PROTECTED-MANIFEST.md");
  for (const rel of [
    "docs/assets/js/spark-companion.js",
    "docs/assets/js/spark-presence.js",
    "docs/assets/js/spark-companions-page.js",
    "docs/assets/js/spark-3d.js",
    "docs/companions.html"
  ]) {
    const base = rel.split("/").pop();
    assert.ok(!manifest.includes(base), `${base} must not be a protected file`);
  }
});
