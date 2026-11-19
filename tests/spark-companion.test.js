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
  assert.ok(!young.includes("stroke-dasharray"), "no stage ring before Radiant");
  const grown = Core.renderSVG(spark, { stage: 2 });
  assert.ok(grown.includes("stroke-dasharray"), "the dashed stage ring appears at Radiant");
  const radiant = Core.renderSVG(spark, { stage: 2 });
  assert.ok(radiant.includes('data-spark-stage="2"'));
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
  for (const page of [
    "index.html", "moons.html", "teach.html", "witness.html", "hub.html", "shop.html",
    "scripture/index.html", "scripture/about.html", "scripture/lemma.html",
    "scripture/genesis/01.html", "scripture/genesis/50.html",
    "scripture/exodus/01.html", "scripture/exodus/40.html",
    "scroll/index.html", "scroll/reader.html", "scroll/search.html",
    "scroll/lexicon.html", "scroll/atlas.html", "scroll/editorial.html"
  ]) {
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

test("the Spark travels into the Scripture reader and the Scroll Library, and the generators keep it there", () => {
  /* Aaron's rule: the companion travels with its keeper everywhere.
   * The scripture and scroll pages are generator-owned, so the pin is
   * two-sided: every generated page on disk carries the presence, and
   * each generator's source emits it — a rebuild cannot quietly
   * strand the Spark outside the reading rooms again. */
  const htmlUnder = (dir) => {
    const out = [];
    const walk = (d, prefix) => {
      for (const entry of fs.readdirSync(path.join(root, d), { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) walk(`${d}/${entry.name}`, rel);
        else if (entry.name.endsWith(".html")) out.push(`${dir}/${rel}`);
      }
    };
    walk(dir, "");
    return out.sort();
  };
  for (const dir of ["docs/scripture", "docs/scroll"]) {
    const pages = htmlUnder(dir);
    assert.ok(pages.length > 0, `${dir} has pages to check`);
    for (const page of pages) {
      assert.ok(read(page).includes("spark-presence.js"), `${page} carries the presence`);
      assert.ok(read(page).includes("spark-companion.js"), `${page} carries the core`);
      assert.ok(read(page).includes("spark-companion.css"), `${page} carries the stylesheet`);
    }
  }
  assert.ok(
    read("scripts/r2_02_pages.py").includes("spark-presence.js"),
    "the scripture generator emits the presence"
  );
  assert.ok(
    read("scripts/build-scroll-library.mjs").includes("spark-presence.js"),
    "the scroll library generator emits the presence"
  );
});

test("the Spark roams: it walks in, strolls, and respects reduced motion", () => {
  const presence = read("docs/assets/js/spark-presence.js");
  assert.ok(presence.includes("prefers-reduced-motion"), "reduced motion is checked before any walking");
  assert.ok(presence.includes("spark-walker"), "the Spark travels in its walker");
  const css = read("docs/assets/css/spark-companion.css");
  assert.match(css, /\.spark-presence\s*\{[^}]*pointer-events:\s*none/, "the walking strip never blocks the page");
  assert.match(css, /prefers-reduced-motion/, "the stylesheet stills the Spark for reduced motion");
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
  assert.ok(presence.includes("arrivalGuideFor"), "arriving somewhere new, it speaks as a guide — with a memory, since v2");
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

/* ---------- v2: a living meeting, a memory, visible growth ---------- */

test("the meeting speaks in its temperament's voice, and its look can be seen", () => {
  const companion = Core.generate(SEED_A);
  const words = Core.encounterFor({ companion });
  assert.equal(words.voice, Core.VOICE_LINES[companion.kind], "one line, in character");
  assert.ok(words.voice.length > 10);
  assert.ok(words.look.includes(companion.form), "the look line names its form");
  assert.ok(words.look.includes(companion.markings.style), "and its markings");
  assert.ok(words.look.includes(companion.shape.glow), "and its glow");
  for (const kind of Core.KINDS) {
    assert.ok(Core.VOICE_LINES[kind.id], `${kind.id} has a voice`);
  }
  const voices = new Set(Object.values(Core.VOICE_LINES));
  assert.equal(voices.size, Core.KINDS.length, "no two kinds speak alike");
});

test("three voices, one pitch: greeting, adoption song, growth chime", () => {
  const companion = Core.generate(SEED_A);
  const sounds = Core.soundsFor(companion);
  const chirp = Core.chirpFor(companion);
  assert.deepEqual(sounds.greeting, [chirp.first, chirp.second], "the greeting is the chirp");
  assert.equal(sounds.adopt.length, 4, "adoption is a four-note arpeggio");
  for (let i = 1; i < sounds.adopt.length; i++) {
    assert.ok(sounds.adopt[i] > sounds.adopt[i - 1], "and it rises");
  }
  assert.equal(sounds.growth.length, 3, "growth is a rising three");
  assert.ok(sounds.growth[2] > sounds.growth[0]);
  assert.notDeepEqual(sounds.growth, sounds.adopt);
  assert.deepEqual(sounds, Core.soundsFor(Core.generate(SEED_A)), "same seed, same voices");
  assert.equal(Core.soundsFor(null), null);
});

test("the record remembers where its person left off", () => {
  let record = Core.newRecord({ seed: SEED_A, name: "Ember", civilDate: "2026-11-18" });
  assert.equal(record.lastPage, null);
  assert.equal(record.prevPage, null);
  record = Core.recordVisit(record, { patternDay: 216, page: "index.html" });
  assert.equal(record.lastPage, "index.html");
  assert.equal(record.prevPage, null, "nowhere to have left off from, yet");
  record = Core.recordVisit(record, { patternDay: 216, page: "moons.html" });
  assert.equal(record.lastPage, "moons.html");
  assert.equal(record.prevPage, "index.html");
  /* A reload of the same page is not a journey: the thread stays. */
  record = Core.recordVisit(record, { patternDay: 217, page: "moons.html" });
  assert.equal(record.prevPage, "index.html");
  record = Core.recordVisit(record, { patternDay: 217, page: "teach.html" });
  assert.equal(record.prevPage, "moons.html");
});

test("the guide greets with the day, then picks the thread back up", () => {
  const companion = Core.generate(SEED_A);
  let record = Core.newRecord({ seed: SEED_A, name: "Ember", civilDate: "2026-11-18" });
  record = Core.recordVisit(record, { patternDay: 216, page: "index.html" });
  record = Core.recordVisit(record, { patternDay: 216, page: "moons.html" });
  record = Core.recordVisit(record, { patternDay: 217, page: "index.html" });
  const today = { moon: 8, day: 21, dayOfPatternYear: 217 };
  const g = Core.arrivalGuideFor({ record, companion, today, page: "index.html" });
  assert.equal(g.coordinate, "Moon 8 · Day 21 · Pattern Day 217", "the day, in Living Time");
  assert.equal(g.kind, "observed", "a remembered thread is counted from the record");
  assert.match(g.text, /left off at the 13 Moons page/);
  assert.equal(g.href, "living-time-sphere.html", "the door they were heading toward");

  /* When that door has been walked, the offer is the place itself. */
  record = Core.recordVisit(record, { patternDay: 217, page: "living-time-sphere.html" });
  record = Core.recordVisit(record, { patternDay: 217, page: "moons.html" });
  record = Core.recordVisit(record, { patternDay: 217, page: "index.html" });
  const back = Core.arrivalGuideFor({ record, companion, today, page: "index.html" });
  assert.equal(back.href, "moons.html", "the thread's door is walked: return to where you left off");
  assert.match(back.text, /left off at the 13 Moons page/);

  /* No thread to remember: the standing guidance speaks, labeled a suggestion. */
  const fresh = Core.newRecord({ seed: SEED_A, name: "", civilDate: "2026-11-18" });
  const f = Core.arrivalGuideFor({ record: fresh, companion, today, page: "ab.html" });
  assert.equal(f.kind, "inferred");
  assert.equal(f.coordinate, "Moon 8 · Day 21 · Pattern Day 217");
});

test("a Day Out of Time greeting invents no moon", () => {
  const line = Core.coordinateLineFor({ moon: null, moonName: "Day Out of Time", dayOfPatternYear: 365 });
  assert.match(line, /Day Out of Time/);
  assert.ok(!/Moon \d/.test(line));
});

test("growth is announced once: against the stage its person last saw", () => {
  const companion = Core.generate(SEED_A);
  let record = Core.newRecord({ seed: SEED_A, name: "Ember", civilDate: "2026-11-18" });
  assert.equal(Core.growthEventFor({ record, companion }).grew, false, "just born is not growth");
  for (let d = 0; d < 8; d++) {
    record = Core.recordVisit(record, { patternDay: 216 + d, page: `p${d}.html` });
  }
  const event = Core.growthEventFor({ record, companion });
  assert.equal(event.grew, true, "eight days together outgrow Ember");
  assert.ok(event.stage.index > 0);
  const line = Core.growthLineFor({ record, companion, stage: event.stage });
  assert.match(line, /I grew — Day 8 of us/);
  assert.ok(line.includes(event.stage.name));
  /* Once seen, it is not news again. */
  const seen = Core.markStageSeen(record, event.stage.index);
  assert.equal(Core.growthEventFor({ record: seen, companion }).grew, false);
  /* A record kept by the first build carries no seen-stage: its
   * stage is taken as seen, so it never cries growth over old news. */
  const legacy = { ...record };
  delete legacy.stageSeen;
  assert.equal(Core.growthEventFor({ record: legacy, companion }).grew, false);
});

test("growth shows on the drawing: satellites, then a second ring", () => {
  const spark = Core.generate(SEED_A);
  const born = Core.renderSVG(spark, { stage: 0 });
  assert.ok(!born.includes("spark-satellite"), "no satellites at birth");
  const kindled = Core.renderSVG(spark, { stage: 1 });
  assert.ok(kindled.includes("spark-satellite"), "satellites arrive at Flame");
  assert.ok(!kindled.includes("spark-stage-ring2"), "no second ring yet");
  const bright = Core.renderSVG(spark, { stage: 2 });
  assert.ok(bright.includes("spark-stage-ring2"), "a second ring stands at Radiant");
  assert.ok(bright.includes('class="spark-eye"'), "the eye carries its blink class");
  assert.ok(bright.includes('class="spark-halo"'), "the halo carries its class");
});

test("the panel: both names, its character, its growth, its labeled notices", () => {
  const companion = Core.generate(SEED_A);
  let record = Core.newRecord({ seed: SEED_A, name: "Nori", civilDate: "2026-11-18" });
  record = Core.recordVisit(record, { patternDay: 216, page: "index.html" });
  record = Core.recordVisit(record, { patternDay: 217, page: "moons.html" });
  record = Core.recordPractice(record, { patternDay: 217 });
  const panel = Core.panelFor({
    record,
    companion,
    today: { moon: 8, day: 21, dayOfPatternYear: 217 }
  });
  assert.equal(panel.name, "Nori", "the name it answers to");
  assert.equal(panel.seedName, companion.name, "and its seed name, underneath");
  assert.equal(panel.kindName, companion.kindName);
  assert.equal(panel.temperament, companion.temperament);
  assert.equal(panel.trait, companion.trait);
  assert.equal(panel.daysTogether, 2);
  assert.equal(panel.coordinate, "Moon 8 · Day 21 · Pattern Day 217");
  assert.ok(panel.stageName.length > 0);
  assert.ok(panel.notices.length >= 3, "a walked record has things to say");
  for (const notice of panel.notices) {
    assert.ok(["observed", "inferred"].includes(notice.kind), "every notice is labeled");
    assert.ok(notice.text.length > 0);
  }
  const observed = panel.notices.filter((n) => n.kind === "observed");
  const inferred = panel.notices.filter((n) => n.kind === "inferred");
  assert.ok(observed.length >= 2 && inferred.length >= 1, "both kinds present, never merged");
  assert.ok(
    observed.some((n) => /2 days together/.test(n.text)),
    "observed facts are counted from the record"
  );
  assert.ok(
    observed.some((n) => /Practice sealed on 1 day/.test(n.text)),
    "practice is observed, not suggested"
  );
});

test("the v2 life rides the presence: celebration, naming, panel, growth", () => {
  const presence = read("docs/assets/js/spark-presence.js");
  assert.ok(presence.includes("spark-encounter-artbtn"), "the Spark itself is tappable at the meeting");
  assert.ok(presence.includes("is-celebrating"), "adoption is a moment, not a form submit");
  assert.ok(presence.includes("spark-encounter-bigname"), "its name stands large in the moment");
  assert.ok(presence.includes("spark-encounter-name-input"), "the keeper's name is offered in the same flow");
  assert.ok(presence.includes("Name it answers to — optional"), "and it is plainly optional");
  assert.ok(presence.includes("spark-encounter-name-skip"), "and skippable in one tap");
  assert.ok(presence.includes("soundsFor"), "the three voices come from the core");
  assert.ok(presence.includes("adoptSong"), "adoption has its own song");
  assert.ok(presence.includes("growthChimeWaiting"), "the growth chime waits for a tap, never autoplays");
  assert.ok(presence.includes("arrivalGuideFor"), "the guide speaks with a memory");
  assert.ok(presence.includes("spark-panel"), "the control panel rides the bubble");
  assert.ok(presence.includes("panelFor"), "the panel is filled from the core's panel data");
  assert.ok(presence.includes("growthEventFor"), "growth is checked against the last seen stage");
  assert.ok(presence.includes("is-reacting"), "a tap is answered in the body");
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(presence), "v2 sends nothing anywhere either");
  const css = read("docs/assets/css/spark-companion.css");
  for (const hook of [
    "spark-pop-hop",
    "spark-pop-drift",
    "spark-bloom",
    "spark-breathe",
    "spark-blink",
    "spark-glance",
    "spark-wiggle",
    ".spark-panel-grid",
    ".spark-notice-kind"
  ]) {
    assert.ok(css.includes(hook), `the stylesheet carries ${hook}`);
  }
  const blockStart = css.indexOf("prefers-reduced-motion");
  const reduced = css.slice(blockStart, blockStart + 1600);
  assert.ok(reduced.includes(".spark-eye"), "reduced motion stills the blink");
  assert.ok(reduced.includes(".spark-presence-art svg"), "reduced motion stills the breathing");
  assert.ok(reduced.includes(".is-celebrating"), "reduced motion stills the celebration");
});


test("evolution: three stages, one creature grown, driven by faithfulness alone", () => {
  assert.deepEqual(Core.STAGES.map((s) => s.name), ["Ember", "Flame", "Radiant"]);
  assert.deepEqual(Core.STAGES.map((s) => s.min), [0, 8, 25]);
  const spark = Core.generate(SEED_A);
  const stages = [0, 1, 2].map((stage) => Core.renderSVG(spark, { stage }));
  for (const svg of stages) {
    assert.ok(svg.includes(`data-spark-form="${spark.form}"`), "the same form at every stage");
  }
  assert.ok(stages[0].includes("scale(0.8)"), "an Ember stands small");
  assert.ok(stages[2].includes("scale(1.03)"), "a Radiant stands full");
  assert.ok(
    !stages[0].includes("spark-satellite") && stages[1].includes("spark-satellite"),
    "company arrives at Flame"
  );
  /* Progress, in honest counts from its own record. */
  let record = Core.newRecord({ seed: SEED_A, name: "", civilDate: "2026-11-18" });
  record = Core.recordVisit(record, { patternDay: 216, page: "index.html" });
  record = Core.recordVisit(record, { patternDay: 217, page: "moons.html" });
  record = Core.recordPractice(record, { patternDay: 217 });
  const progress = Core.progressOf(record, spark);
  assert.equal(progress.points, 7);
  assert.equal(progress.stage.name, "Ember");
  assert.equal(progress.next, "Flame");
  assert.equal(progress.counts.returnDays, 1);
  assert.equal(progress.counts.practiceDays, 1);
  assert.equal(progress.counts.pagesSeen, 2);
  assert.ok(progress.toGo >= 1, "points still to go, at its own pace");
});

test("the Spark is alive on the page: it roams, and it plays", () => {
  const presence = read("docs/assets/js/spark-presence.js");
  assert.ok(presence.includes("startRoam"), "a character engine, not a corner stroll");
  assert.ok(presence.includes("pickTarget"), "it chooses where to wander: floor, sides, open middle");
  assert.ok(presence.includes("visibilitychange"), "it rests when the tab is hidden");
  assert.ok(presence.includes("is-flipped"), "it turns to face the way it travels");
  assert.ok(presence.includes("pointermove"), "it feels a cursor approach");
  assert.ok(presence.includes("pointerdown"), "and a finger's landing — touch has no hover");
  assert.ok(presence.includes("const PLAY = {"), "the play is a table of temperaments");
  for (const t of ["bold", "curious", "bright", "gentle", "steady", "quiet"]) {
    assert.ok(presence.includes(`${t}: { radius:`), `${t} has its own radius, scoot, and cooldown`);
  }
  assert.ok(presence.includes("settleUntil"), "after three quick scoots it settles, where a tap can reach it");
  assert.ok(presence.includes("play.cooldown"), "a cooldown caps how often it may scoot");
  assert.ok(presence.includes("bubbleOpen()"), "it never scoots or roams while its bubble is open");
  assert.ok(presence.includes("SIGNATURE"), "its idle signature leans to its temperament");
  for (const cls of ["is-spinning", "is-stretching", "is-looking"]) {
    assert.ok(presence.includes(cls), `idle life includes ${cls}`);
  }
  /* The research layer: predictive, anticipated, chosen, steered. */
  assert.ok(presence.includes("pointerPredicted"), "it flees from where the pointer will be, not only where it is");
  assert.ok(presence.includes("trackPointer"), "the pointer is tracked with its velocity");
  assert.ok(presence.includes('state = "anticipate"'), "a crouch — anticipation — stands between the startle and the dart");
  assert.ok(presence.includes("ctrl.crouch()"), "and the 3D body is told to gather itself");
  assert.ok(presence.includes("peekWanted"), "the tease: after a dodge, a still pointer earns a peek back");
  assert.ok(presence.includes("chooseBehavior"), "idle choices are scored by a small utility brain");
  assert.ok(presence.includes("playfulness"), "whose weights are the temperament's own curves");
  assert.ok(presence.includes("maxForce"), "it travels by steering — velocity and a capped force — never by sliding");
  const css = read("docs/assets/css/spark-companion.css");
  for (const kf of ["spark-spin-once", "spark-stretch", "spark-look", "spark-evolve"]) {
    assert.ok(css.includes(`@keyframes ${kf}`), `${kf} is drawn`);
  }
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
  /* The research layer, in the body. */
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
  assert.ok(presence.includes("is-evolving"), "a growth is celebrated in the body when it walks in");
  assert.ok(presence.includes("ctrl.celebrate()"), "in 3D as in flat: a flourish, never a modal");
  const page = read("docs/assets/js/spark-companions-page.js");
  assert.ok(page.includes("Spark3D"), "its home panel stands in 3D too");
  for (const p of ["index.html", "moons.html", "companions.html"]) {
    assert.ok(read(`docs/${p}`).includes("spark-3d.js"), `${p} loads the renderer before the presence`);
  }
});

test("v3 care: kindling, play, and rest are counted, and the bond grows gently", () => {
  let record = Core.newRecord({ seed: SEED_A, name: "Nori", civilDate: "2026-11-18" });
  record = Core.applyCare(record, { action: "kindle", patternDay: 216 });
  record = Core.applyCare(record, { action: "kindle", patternDay: 216 });
  let care = Core.careOf(record);
  assert.equal(care.kindles, 2, "every kindle is remembered");
  assert.equal(care.bond, 1, "but the bond warms once a day");
  record = Core.applyCare(record, { action: "kindle", patternDay: 217 });
  assert.equal(Core.careOf(record).bond, 2, "a new day warms it again");
  record = Core.applyCare(record, { action: "play", patternDay: 217 });
  record = Core.applyCare(record, { action: "play", patternDay: 217 });
  record = Core.applyCare(record, { action: "play", patternDay: 217 });
  care = Core.careOf(record);
  assert.equal(care.plays, 3);
  assert.equal(care.bond, 2 + 4, "the first two chases of a day run deepest");
  record = Core.applyCare(record, { action: "rest", patternDay: 217 });
  assert.equal(Core.careOf(record).bond, 7);
  const before = Core.growthPoints(record);
  assert.ok(before > 0, "the bond counts toward growth");
  /* Care never subtracts: an unknown act changes nothing, and a
   * record kept by an earlier build reads as unharmed. */
  const untouched = Core.applyCare(record, { action: "neglect", patternDay: 218 });
  assert.deepEqual(Core.careOf(untouched), Core.careOf(record));
  const legacy = { seed: SEED_A, daysSeen: [216], pagesSeen: [], practiceDays: [] };
  assert.equal(Core.careOf(legacy).bond, 0);
});

test("v3 care state: plain words, and behaviour shaped by today's care", () => {
  const companion = Core.generate(SEED_A);
  let record = Core.newRecord({ seed: SEED_A, name: "Nori", civilDate: "2026-11-18" });
  let state = Core.careStateFor({ record, companion, todayPatternDay: 216 });
  assert.equal(state.behavior.playful, false);
  assert.match(state.lines.join(" "), /Bond:/);
  record = Core.applyCare(record, { action: "play", patternDay: 216 });
  record = Core.applyCare(record, { action: "kindle", patternDay: 216 });
  state = Core.careStateFor({ record, companion, todayPatternDay: 216 });
  assert.equal(state.behavior.playful, true, "played with today, it plays back");
  assert.ok(state.behavior.playfulnessBoost > 0);
  assert.equal(state.kindledToday, true);
  assert.match(state.warmth, /kindled today/);
  record = Core.applyCare(record, { action: "rest", patternDay: 216 });
  state = Core.careStateFor({ record, companion, todayPatternDay: 216 });
  assert.ok(state.behavior.wanderCalm < 1, "rested today, it travels calm");
  const tomorrow = Core.careStateFor({ record, companion, todayPatternDay: 217 });
  assert.equal(tomorrow.behavior.playful, false, "a new day starts fresh — nothing is owed");
});

test("v3 trail: three small steps, framed as discovery, completed by walking them", () => {
  const companion = Core.generate(SEED_A);
  const today = { moon: 8, day: 20, dayOfPatternYear: 216 };
  let record = Core.newRecord({ seed: SEED_A, name: "Nori", civilDate: "2026-11-18" });
  record = Core.recordVisit(record, { patternDay: 216, page: "index.html" });
  const trail = Core.trailFor({ record, companion, today, page: "index.html" });
  assert.equal(trail.steps.length, 3);
  const [telling, door, practice] = trail.steps;
  assert.equal(telling.href, "moons.html");
  assert.match(door.label, /I found a door for us/, "the door is a discovery, not a gap");
  assert.ok(!record.pagesSeen.includes(door.href), "the door is one the walk has not opened");
  assert.equal(door.done, false);
  assert.equal(practice.done, false);
  const bondBefore = Core.careOf(record).bond;
  record = Core.recordTrailStep(record, { patternDay: 216, stepId: "telling" });
  record = Core.recordTrailStep(record, { patternDay: 216, stepId: "telling" });
  assert.equal(Core.careOf(record).bond, bondBefore + 1, "a step deepens the bond once");
  const again = Core.trailFor({ record, companion, today, page: "moons.html" });
  assert.equal(again.steps[0].done, true);
  record = Core.recordPractice(record, { patternDay: 216 });
  const walked = Core.trailFor({ record, companion, today, page: "teach.html" });
  assert.equal(walked.steps[2].done, true, "the practice step completes from the practice day itself");
  const nextDay = Core.trailFor({
    record,
    companion,
    today: { moon: 8, day: 21, dayOfPatternYear: 217 },
    page: "index.html"
  });
  assert.equal(nextDay.steps[0].done, false, "a new day keeps only its own steps");
});

test("v3 copy audit: no absence framing anywhere the Spark speaks", () => {
  const banned = /you have not|haven't|have not|not done|not yet|missed|incomplete/i;
  const companion = Core.generate(SEED_A);
  const today = { moon: 8, day: 20, dayOfPatternYear: 216 };
  const spoken = [];
  spoken.push(Core.encounterFor({ companion }).greeting);
  spoken.push(Core.encounterFor({ companion }).intro);
  spoken.push(Core.encounterFor({ companion }).invite);
  let fresh = Core.newRecord({ seed: SEED_A, name: "Nori", civilDate: "2026-11-18" });
  spoken.push(Core.guidanceFor({ record: fresh, companion, todayPatternDay: 216 }).text);
  fresh = Core.recordVisit(fresh, { patternDay: 216, page: "index.html" });
  fresh = Core.recordVisit(fresh, { patternDay: 217, page: "moons.html" });
  spoken.push(Core.guidanceFor({ record: fresh, companion, todayPatternDay: 217 }).text);
  spoken.push(Core.guidanceFor({ record: fresh, companion, todayPatternDay: 217 }).text);
  for (const notice of Core.noticesFor({ record: fresh, companion, todayPatternDay: 217 })) spoken.push(notice.text);
  for (const step of Core.trailFor({ record: fresh, companion, today, page: "index.html" }).steps) spoken.push(step.label);
  for (const line of Core.careStateFor({ record: fresh, companion, todayPatternDay: 217 }).lines) spoken.push(line);
  for (const text of spoken) assert.ok(!banned.test(text), `absence framing in: ${text}`);
  /* And in the source itself: no string literal in any Spark
   * file may carry the banned framing. Comments are not copy;
   * literals are. */
  const literal = /'([^'\\\n]*)'|"([^"\\\n]*)"|`([^`\\]*)`/g;
  for (const rel of [
    "docs/assets/js/spark-companion.js",
    "docs/assets/js/spark-presence.js",
    "docs/assets/js/spark-companions-page.js",
    "docs/companions.html"
  ]) {
    const src = read(rel);
    let m;
    while ((m = literal.exec(src)) !== null) {
      const text = m[1] || m[2] || m[3] || "";
      assert.ok(!banned.test(text), `${rel} carries banned copy: ${text.slice(0, 80)}`);
    }
  }
});

test("v3 guide: doors come only from the page's own links; explanations from its own words", () => {
  const doors = Core.doorsFor({
    page: "theory.html",
    links: [
      { href: "moons.html", label: "Calendar" },
      { href: "moons.html", label: "Duplicate" },
      { href: "theory.html", label: "Itself" },
      { href: "some-real-page.html", label: "A real door" },
      { href: "index.html", label: "Home" }
    ]
  });
  const hrefs = doors.map((d) => d.href);
  assert.deepEqual(new Set(hrefs).size, hrefs.length, "no door offered twice");
  assert.ok(!hrefs.includes("theory.html"), "the page you are on is not a next door");
  assert.ok(hrefs.every((h) => ["moons.html", "some-real-page.html", "index.html"].includes(h)), "only doors the page carries");
  const moons = doors.find((d) => d.href === "moons.html");
  assert.match(moons.label, /13 Moons/, "a known door gets its place-name");
  const ex = Core.explainFor({
    explainerText: "One plain sentence. A second one follows. A third must not ride along.",
    introText: "Ignored intro."
  });
  assert.equal(ex.source, "explainer");
  assert.ok(!ex.text.includes("third"), "two sentences at most");
  const fallback = Core.explainFor({ explainerText: "", introText: "The page's own opening. Said plainly." });
  assert.equal(fallback.source, "page");
  assert.match(fallback.text, /opening/);
  assert.equal(Core.explainFor({ explainerText: "", introText: "" }).source, "none");
  const resume = Core.resumeFor({
    record: { prevPage: "moons.html" }
  });
  assert.equal(resume.href, "moons.html");
  assert.match(resume.text, /left off at the 13 Moons page/);
});

test("v3 life rides the presence: care, chase, rest, trail, and a real guide", () => {
  const presence = read("docs/assets/js/spark-presence.js");
  for (const hook of [
    "spark-care-kindle",
    "spark-care-play",
    "spark-care-rest",
    "applyCare",
    "careStateFor",
    "trailFor",
    "recordTrailStep",
    "startPlay",
    "catchSpark",
    "is-resting",
    "is-napping",
    "perchTarget",
    "ANTICS_CAP",
    "pageLinks",
    "pageExplainSource",
    "doorsFor",
    "explainFor",
    "resumeFor",
    "spark-guide-around",
    "spark-guide-explain"
  ]) {
    assert.ok(presence.includes(hook), `the presence carries ${hook}`);
  }
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(presence), "v3 sends nothing anywhere either");
  const css = read("docs/assets/css/spark-companion.css");
  for (const hook of ["spark-kindling", "spark-playful", "spark-rest-breathe", ".spark-trail-steps", ".spark-guide-doors"]) {
    assert.ok(css.includes(hook), `the stylesheet carries ${hook}`);
  }
  const blockStart = css.indexOf("prefers-reduced-motion");
  const reduced = css.slice(blockStart, blockStart + 2400);
  assert.ok(reduced.includes(".is-playful"), "reduced motion stills the chase-wait bounce");
  assert.ok(reduced.includes(".is-resting"), "reduced motion stills the resting breath");
});

test("v3 share card: the keeper's own panel facts, plainly a Codex Spark, made on-device", () => {
  const companion = Core.generate(SEED_A);
  let record = Core.newRecord({ seed: SEED_A, name: "Nori", civilDate: "2026-11-18" });
  record = Core.recordVisit(record, { patternDay: 216, page: "index.html" });
  const card = Core.shareCardFor({
    record,
    companion,
    today: { moon: 8, day: 20, dayOfPatternYear: 216 }
  });
  assert.equal(card.name, "Nori", "the name it answers to stands first");
  assert.ok(card.seedLine.includes(companion.name), "its seed name rides underneath");
  assert.match(card.kindLine, new RegExp(companion.kindName), "its kind and character");
  assert.match(card.stageLine, /Stage 1 of 3: Ember/);
  assert.match(card.bornLine, /Born Moon 8 · Pattern Day 216/, "the day it was born from");
  assert.match(card.todayLine, /Moon 8 · Day 20 · Pattern Day 216/, "and today, in Living Time");
  assert.match(card.brand, /A Codex Spark/, "the card says plainly what it is");
  const doot = Core.shareCardFor({
    record: Core.newRecord({ seed: Core.makeSeed({ moon: null, patternDay: null, kindIndex: 5, nonce: "doot0001" }), name: "", civilDate: "2027-04-16" }),
    companion: Core.generate(Core.makeSeed({ moon: null, patternDay: null, kindIndex: 5, nonce: "doot0001" })),
    today: { moon: null, moonName: "Day Out of Time", dayOfPatternYear: 365 }
  });
  assert.match(doot.bornLine, /Day Out of Time/, "a Day Out of Time birth invents no moon");
  const presence = read("docs/assets/js/spark-presence.js");
  assert.ok(presence.includes('bubbleBtn("Share"'), "the panel carries the share action as a bubble");
  assert.ok(presence.includes("shareCardFor"), "the card's words come from the core");
  assert.ok(presence.includes("toDataURL"), "the picture is drawn and downloaded locally");
  assert.ok(presence.includes('a.download'), "as the keeper's own file");
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(presence), "sharing uploads nothing, posts nothing");
});

test("v4 conversation voice: every beat, in every temperament, from the seed — and clean copy", () => {
  const banned = /you have not|haven't|have not|not done|not yet|missed|incomplete/i;
  const beats = [
    "greet", "welcome", "ask", "next", "kindle", "play", "caught", "rest",
    "care", "around", "explain", "today", "trail", "share", "record", "resume", "bye"
  ];
  for (let kindIndex = 0; kindIndex < 6; kindIndex++) {
    const seed = Core.makeSeed({ moon: 8, patternDay: 216, kindIndex, nonce: `voice${kindIndex}zz` });
    const companion = Core.generate(seed);
    for (const beat of beats) {
      const line = Core.convoLineFor({ companion, beat });
      assert.ok(line && line.length > 3, `${companion.temperament} has a ${beat} line`);
      assert.ok(!banned.test(line), `${companion.temperament}'s ${beat} line is clean copy: ${line}`);
      assert.equal(
        Core.convoLineFor({ companion, beat }),
        line,
        "the same Spark speaks consistently"
      );
    }
    assert.notEqual(
      Core.convoLineFor({ companion, beat: "greet" }),
      Core.convoLineFor({ companion, beat: "bye" }),
      "different beats, different words"
    );
  }
  assert.equal(Core.convoLineFor({ companion: null, beat: "greet" }), "", "no companion, no line");
  assert.equal(
    Core.convoLineFor({ companion: Core.generate(SEED_A), beat: "no-such-beat" }),
    "",
    "an unknown beat stays silent rather than inventing"
  );
});

test("v8 panel rides the presence: one line, big bubbles, states that swap — no thread", () => {
  const presence = read("docs/assets/js/spark-presence.js");
  for (const hook of [
    "spark-panel",
    "spark-panel-line",
    "spark-panel-coord",
    "spark-panel-grid",
    "spark-panel-bubble",
    "setPanel",
    "panelSay",
    "bubbleBtn",
    "showHome",
    "showMore",
    "showCare",
    "convoLineFor",
    "startConvo",
    "openConvo",
    "answerInBody",
    "doAround",
    "doExplain",
    "doLookNext",
    "doKindle",
    "doPlay",
    "doRest",
    "doShare",
    "doTrail",
    "doBye"
  ]) {
    assert.ok(presence.includes(hook), `the presence carries ${hook}`);
  }
  /* The scrolling transcript is gone as the interaction
   * surface: no thread element, no echoed keeper lines, no
   * chip machinery anywhere in her code or her styles. */
  assert.ok(!presence.includes("spark-convo"), "no conversation thread remains in the presence");
  assert.ok(!presence.includes("replyEcho"), "the keeper's taps are never echoed back");
  assert.ok(!presence.includes("scrollTop"), "nothing in the panel scrolls a transcript");
  const css = read("docs/assets/css/spark-companion.css");
  assert.ok(!css.includes(".spark-convo"), "no thread styles remain in the stylesheet");
  assert.ok(css.includes(".spark-panel-grid"), "the bubble grid is styled");
  assert.ok(css.includes(".spark-panel-bubble"), "the bubbles are styled");
  const bubbleAt = css.indexOf(".spark-panel-bubble {");
  const bubbleBlock = css.slice(bubbleAt, bubbleAt + 700);
  const minHeight = /min-height:\s*(\d+)px/.exec(bubbleBlock);
  assert.ok(minHeight && Number(minHeight[1]) >= 48, "a panel bubble is a thumb-sized target, 48px or more");
  const bubbleRule = /\.spark-presence-bubble\s*\{[^}]*\}/g;
  for (const rule of css.match(bubbleRule) || []) {
    assert.ok(!/overflow-y:\s*auto/.test(rule), "the panel bubble itself never scrolls");
  }
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(presence), "the panel sends nothing anywhere");
});

test("v8 word diet: her lines are short, in every temperament, and still distinct", () => {
  const banned = /you have not|haven't|have not|not done|not yet|missed|incomplete/i;
  const words = (line) => line.replace("{name}", "Nori").split(/\s+/).filter(Boolean).length;
  let total = 0;
  let count = 0;
  let longest = 0;
  for (const [beat, byTemperament] of Object.entries(Core.CONVO)) {
    const variants = new Set();
    for (const [temperament, lines] of Object.entries(byTemperament)) {
      for (const line of lines) {
        const w = words(line);
        total += w;
        count += 1;
        longest = Math.max(longest, w);
        variants.add(line);
        assert.ok(!banned.test(line), `${temperament}'s ${beat} line is clean copy: ${line}`);
      }
    }
    assert.ok(variants.size >= 4, `the ${beat} beat keeps its temperaments distinct (${variants.size} of 6)`);
  }
  for (const [part, byTemperament] of Object.entries(Core.DAYPART_GREET)) {
    for (const line of Object.values(byTemperament)) {
      const w = words(line);
      total += w;
      count += 1;
      longest = Math.max(longest, w);
      assert.ok(!banned.test(line), `the ${part} greeting is clean copy: ${line}`);
    }
  }
  assert.ok(count >= 190, `the whole table was measured (${count} lines)`);
  assert.ok(longest <= 10, `no line runs past ten words (longest: ${longest})`);
  assert.ok(total / count <= 6, `her lines average six words or fewer (got ${(total / count).toFixed(1)})`);
});

test("v8 moon temper: her greeting and her light answer the moon she is under", () => {
  const today = { moon: 8, moonName: "Deep Mirror", day: 21, dayOfPatternYear: 217 };
  const temper = Core.moonTemperFor({ today, element: "Water" });
  assert.equal(temper.name, "Deep Mirror", "the moon's own name, as the calendar states it");
  assert.equal(temper.line, "Under Deep Mirror.", "the greeting carries the moon, in few words");
  assert.equal(temper.hue, 208, "Water lends its hue family");
  assert.equal(Core.moonTemperFor({ today, element: "Fire" }).hue, 14, "Fire lends its own");
  assert.equal(Core.moonTemperFor({ today, element: "Earth" }).hue, 96, "Earth lends its own");
  assert.notEqual(
    Core.moonTemperFor({ today, element: "Fire" }).hue,
    Core.moonTemperFor({ today, element: "Water" }).hue,
    "each element's light differs"
  );
  /* A day outside the moons borrows no temper. */
  assert.equal(
    Core.moonTemperFor({ today: { moon: null, moonName: "Day Out of Time", dayOfPatternYear: 365 }, element: "Water" }),
    null,
    "the Day Out of Time invents no moon temper"
  );
  assert.equal(Core.moonTemperFor({ today: null, element: "Fire" }), null, "no day, no temper");
  /* Her seed-grown body is untouched by the moon: the same
   * seed builds the same colours, temper or no temper. */
  const spark = Core.generate(SEED_A);
  Core.moonTemperFor({ today, element: "Fire" });
  assert.deepEqual(Core.generate(SEED_A).palette, spark.palette, "her colours stay hers");
  const presence = read("docs/assets/js/spark-presence.js");
  assert.ok(presence.includes("moonTemperFor"), "the presence reads the moon's temper");
  assert.ok(presence.includes("--spark-moon-hue"), "and lends it to her light");
  assert.ok(presence.includes("PatternCalendarData"), "the element comes from the calendar's own data");
  const css = read("docs/assets/css/spark-companion.css");
  assert.ok(css.includes("--spark-moon-hue"), "her glow styles borrow the moon's hue");
});

test("v8 one thing and Look next: offers drawn only from what is real", () => {
  const presence = read("docs/assets/js/spark-presence.js");
  /* The day's one thing: the trail's next step, one bubble
   * at the front of the home grid. */
  const oneThingAt = presence.indexOf("function oneThingBubble()");
  const oneThing = presence.slice(oneThingAt, oneThingAt + 700);
  assert.ok(oneThing.includes("trailFor"), "the one thing is the trail's next step, from the record");
  assert.ok(oneThing.includes("spark-panel-onething"), "it stands as its own wide bubble");
  assert.ok(presence.includes('bubbleBtn("Look next"'), "the home grid carries Look next");
  /* Look next, in order of trust: this page's own doors
   * first, then the keeper's own left-off place, labeled
   * theirs — and an honest line when nothing is real. */
  const lookAt = presence.indexOf("function doLookNext()");
  const look = presence.slice(lookAt, lookAt + 2400);
  assert.ok(look.includes("doorsFor"), "first trust: the page's own doors");
  assert.ok(look.includes("resumeFor"), "then the keeper's own record");
  assert.ok(look.includes('"yours"'), "the keeper's own suggestion is labeled theirs");
  assert.ok(look.includes("Another time"), "a way past it is always there");
  assert.ok(look.includes("Nothing nearby"), "a page with nothing real gets an honest line, not an invention");
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(look), "suggestions fetch nothing");
});

test("v9 voice box: the seed grows her voice — pitch, tract, breath, tempo, family", () => {
  const a = Core.generate(SEED_A);
  const first = Core.voiceBoxFor(a);
  assert.deepEqual(Core.voiceBoxFor(a), first, "the same Spark settles the same voice anywhere");
  assert.ok(first.basePitch >= 140 && first.basePitch <= 340, "her fundamental sits where a formant voice lives");
  assert.ok(first.formantScale >= 0.86 && first.formantScale <= 1.22, "her vocal tract is seed-sized");
  assert.ok(
    first.breathiness === 0 || (first.breathiness >= 0.05 && first.breathiness <= 0.3),
    "breath is a seed's choice: none at all, or a low whisper — never the old hiss"
  );
  assert.ok(first.tempo >= 3.5 && first.tempo <= 5.5, "her tempo is a speaking pace");
  /* Her sound family rides on the box, and it is the same
   * family soundFor settles — one creature, one sound. */
  const snd = Core.soundFor(a);
  assert.equal(first.family, snd.family, "the box sings in her own family");
  assert.equal(first.familyName, snd.familyName);
  assert.ok(Core.SOUND_FAMILIES.some((f) => f.id === first.family), "her family is one of the grown set");
  /* The pitch follows the same chirp root as everything she
   * sounds: the lowest kind (Earth) sounds lower than the
   * highest (Light), for any seed jitter. */
  const earth = Core.generate(Core.makeSeed({ moon: 3, patternDay: 40, kindIndex: 4, nonce: "voice0001" }));
  const light = Core.generate(Core.makeSeed({ moon: 3, patternDay: 40, kindIndex: 5, nonce: "voice0001" }));
  assert.ok(Core.chirpFor(earth).first < Core.chirpFor(light).first, "the chirp ordering the voice follows");
  assert.ok(
    Core.voiceBoxFor(earth).basePitch < Core.voiceBoxFor(light).basePitch,
    "a low chirp sounds low; a high chirp sounds high"
  );
  /* The pace is the temperament's: bold quicker than gentle,
   * whatever the seed's small jitter. */
  const bold = Core.generate(Core.makeSeed({ moon: 3, patternDay: 40, kindIndex: 0, nonce: "voice0002" }));
  const gentle = Core.generate(Core.makeSeed({ moon: 3, patternDay: 40, kindIndex: 1, nonce: "voice0002" }));
  assert.ok(Core.voiceBoxFor(bold).tempo > Core.voiceBoxFor(gentle).tempo, "bold sounds a touch quicker than gentle");
  /* Two Sparks do not share one voice. */
  const b = Core.generate(SEED_B);
  assert.notDeepEqual(Core.voiceBoxFor(b), first, "a different seed grows a different voice");
  assert.equal(Core.voiceBoxFor(null), null, "no companion, no voice box");
});

test("v7 syllables: a line is sounded out by its vowel groups", () => {
  assert.equal(Core.syllableCountFor(""), 0, "silence has no syllables");
  assert.equal(Core.syllableCountFor("Hello."), 2, "hello is two");
  assert.equal(Core.syllableCountFor("voice"), 1, "a trailing silent e folds into the syllable before it");
  assert.equal(Core.syllableCountFor("little"), 2, "the sounding -le keeps its syllable");
  assert.equal(Core.syllableCountFor("Are you ready to wander?"), 7, "the count is the line's true shape");
  const there = Core.wordSyllables("there");
  assert.equal(there.length, 1, "there is one syllable");
  assert.equal(there[0].onset, "fricative", "its th opens as a breath, not a tick");
  const ready = Core.wordSyllables("ready");
  assert.equal(ready.length, 2, "ready is two syllables");
  assert.equal(ready[1].onset, "plosive", "its second syllable opens on the d — a small tick");
  assert.equal(ready[0].onset, "soft", "its first syllable opens soft, on the r");
  assert.deepEqual(Core.wordSyllables("123"), [], "a word with no letters sounds nothing");
});

test("v9 vocal plan: a line's shape, sung syllable by syllable — first sentence only", () => {
  const a = Core.generate(SEED_A);
  const line = "Hello there. Are you ready to wander?";
  const plan = Core.vocalPlanFor({ companion: a, text: line });
  assert.equal(
    plan.syllables.length,
    Core.syllableCountFor("Hello there."),
    "she sounds the line's first sentence — the rest stands in text"
  );
  assert.ok(plan.seconds > 0.3 && plan.seconds < 6, "the plan lasts about as long as the sentence takes to say");
  assert.deepEqual(
    Core.vocalPlanFor({ companion: a, text: line }),
    plan,
    "the same Spark sounds the same line the same way twice"
  );
  for (const syl of plan.syllables) {
    assert.equal(syl.formants.length, 3, "each syllable carries its mouth shape — three formants");
    assert.ok(syl.f0 > 80 && syl.f0 < 500, "each syllable's pitch sits in her range");
    assert.ok(syl.dur > 0.05 && syl.dur < 0.6, "each syllable lasts a syllable's length");
  }
  /* The contour is the sentence's own: a question rises on its
   * last syllables; a statement settles. */
  const q = Core.vocalPlanFor({ companion: a, text: "Are you ready to wander?" });
  const s = Core.vocalPlanFor({ companion: a, text: "You are ready to wander." });
  const qLast = q.syllables[q.syllables.length - 1].f0;
  const sLast = s.syllables[s.syllables.length - 1].f0;
  assert.ok(qLast > sLast, "the question's last syllable stands higher than the statement's");
  /* A long line is sounded from its opening only: the first
   * sentence, and about a dozen syllables of it — whole words
   * to the cap, never a word cut in half; the rest is left to
   * the text, as it always has been. */
  const long =
    "First sentence of the page, stated plainly and in full here. " +
    "Second sentence, carrying the next fact of the page with it. " +
    "Third sentence, with a good deal more of the page's own wording. " +
    "Fourth sentence, also the page's own, and still in its order. " +
    "Fifth sentence, carrying the account further along its way. " +
    "Sixth sentence, which the voice leaves for the text to carry.";
  const capped = Core.vocalPlanFor({ companion: a, text: long });
  assert.ok(
    capped.syllables.length <= Core.VOICE_MAX_SYLLABLES + 4,
    "the sounded opening stays near the dozen-syllable cap (a word in flight finishes)"
  );
  assert.ok(
    capped.syllables.length < Core.syllableCountFor("First sentence of the page, stated plainly and in full here."),
    "even the first sentence is not sounded whole when it runs long"
  );
  assert.ok(
    capped.syllables.length < Core.syllableCountFor(long),
    "a long line is not sounded whole — its opening is"
  );
  /* A single long sentence caps the same way. */
  const oneLong = Core.vocalPlanFor({
    companion: a,
    text: "One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen."
  });
  assert.ok(
    oneLong.syllables.length >= Core.VOICE_MAX_SYLLABLES && oneLong.syllables.length <= Core.VOICE_MAX_SYLLABLES + 4,
    "a long single sentence sounds about a dozen syllables"
  );
  assert.deepEqual(Core.vocalPlanFor({ companion: a, text: "" }).syllables, [], "silence plans nothing");
  assert.deepEqual(Core.vocalPlanFor({ companion: null, text: "Hello." }).syllables, [], "no companion, no plan");
});

test("v5 tell me more: the explanation continues in the page's own words only", () => {
  const explainer =
    "One plain sentence opens it. A second one follows close behind. " +
    "A third sentence carries the middle of the page's own account of itself. " +
    "A fourth adds the next part of that account, still in the page's own words. " +
    "A fifth sentence rounds the account toward its close, in those same words. " +
    "A sixth and final sentence ends the account, exactly as the page wrote it.";
  const chunks = Core.explainChunksFor({ explainerText: explainer, introText: "Ignored." });
  assert.equal(chunks.source, "explainer", "the explainer is the source, as with the first chunk");
  assert.ok(chunks.chunks.length >= 3, "a six-sentence account cuts into several chunks");
  assert.equal(
    chunks.chunks.join(" "),
    explainer,
    "laid end to end, the chunks are the page's own words — nothing added, nothing repeated"
  );
  const first = Core.explainFor({ explainerText: explainer, introText: "" });
  assert.equal(first.text, chunks.chunks[0], "the explanation is the first chunk");
  assert.ok(
    !first.text.includes(chunks.chunks[1]) && !chunks.chunks[1].includes(first.text),
    "no chunk repeats another"
  );
  const fromIntro = Core.explainChunksFor({ explainerText: "", introText: explainer });
  assert.equal(fromIntro.source, "page", "with no explainer, the opening words carry the depth too");
  assert.deepEqual(fromIntro.chunks, chunks.chunks, "the same partition, from the page's opening");
  /* Beyond the explainer, the page's main content continues —
   * cut by the same partition, at the deeper cut. */
  const following =
    "The body of the page takes the account further, in its own order. " +
    "It names what the opening only pointed at, plainly and in full. " +
    "It closes the account the way the page itself closes it, word for word.";
  const more = Core.moreChunksFor(following);
  assert.ok(more.length >= 1, "the following content cuts into continuation chunks");
  assert.equal(more.join(" "), following, "the continuation is the page's own words, whole and in order");
  assert.deepEqual(Core.moreChunksFor(""), [], "no following words, no continuation");
  assert.deepEqual(Core.moreChunksFor("  "), [], "blank following words, no continuation");
});

test("v5 the telling: gathered from the blocks the page itself carries", () => {
  const telling = Core.tellingFor({
    headline: "  Day 21 of the Observer moon ",
    position: "Moon 8 · Day 21 · Pattern Day 217.",
    arc: "",
    reading: "The Codex's reading of the day, in its own words."
  });
  assert.equal(telling.has, true, "a page carrying a telling has one to read");
  assert.deepEqual(
    telling.lines,
    ["Day 21 of the Observer moon", "Moon 8 · Day 21 · Pattern Day 217.", "The Codex's reading of the day, in its own words."],
    "the blocks stand in their order, empties dropped, words only cleaned of space"
  );
  assert.equal(Core.tellingFor({}).has, false, "a page with no telling blocks hands back nothing");
  assert.equal(Core.tellingFor({ headline: " ", position: "" }).has, false, "blank blocks are no telling");
});

test("v5 conversation beats: more and telling, in every temperament, clean copy", () => {
  const banned = /you have not|haven't|have not|not done|not yet|missed|incomplete/i;
  for (let kindIndex = 0; kindIndex < 6; kindIndex++) {
    const companion = Core.generate(
      Core.makeSeed({ moon: 8, patternDay: 216, kindIndex, nonce: `v5beat${kindIndex}zz` })
    );
    for (const beat of ["more", "telling"]) {
      const line = Core.convoLineFor({ companion, beat });
      assert.ok(line && line.length > 3, `${companion.temperament} has a ${beat} line`);
      assert.ok(!banned.test(line), `${companion.temperament}'s ${beat} line is clean copy: ${line}`);
      assert.equal(Core.convoLineFor({ companion, beat }), line, "the same Spark speaks consistently");
    }
  }
});

test("v7 voice box rides the presence: generated, default quiet, mute-ruled, tap-gated — and the robot is gone", () => {
  const presence = read("docs/assets/js/spark-presence.js");
  const core = read("docs/assets/js/spark-companion.js");
  for (const hook of [
    "spark-presence-voice",
    "sof.spark.voice",
    "voiceBoxFor",
    "vocalPlanFor",
    "singSyllable",
    "stopVoice",
    "doExplainMore",
    "moreChunksFor",
    "pageFollowingText",
    "tellingFor",
    "dayTellingHeadline",
    "spark-guide-more"
  ]) {
    assert.ok(presence.includes(hook), `the presence carries ${hook}`);
  }
  /* The device's robot voice is removed whole, not merely
   * unwired: no speech synthesis anywhere in her code, no
   * voice picker, no utterance machinery. Her voice is the
   * generated one, or she is quiet. */
  for (const [name, src] of [["presence", presence], ["core", core]]) {
    assert.ok(!src.includes("speechSynthesis"), `no device speech remains in the ${name}`);
    assert.ok(!src.includes("SpeechSynthesisUtterance"), `no utterance machinery remains in the ${name}`);
    assert.ok(!src.includes("pickVoice"), `no device voice is picked in the ${name}`);
  }
  assert.ok(
    presence.includes('window.localStorage.getItem(VOICE_KEY) === "on"'),
    "voice rests quiet unless the keeper stored it on — default quiet"
  );
  const vocalAt = presence.indexOf("function vocalize(text)");
  const gate = presence.slice(vocalAt, vocalAt + 220);
  assert.ok(gate.includes("!voiceOn()"), "she does not sound while Voice is off");
  assert.ok(gate.includes("soundOff()"), "the Sounds mute silences her voice too");
  assert.ok(gate.includes("!voiceArmed"), "she does not sound before a keeper tap arms the talk");
  const closeAt = presence.indexOf("const closeBubble");
  assert.ok(
    presence.slice(closeAt, closeAt + 320).includes("stopVoice()"),
    "closing the talk stills her voice"
  );
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(presence), "the voice sends nothing anywhere");
});

test("v6 play record: touches counted as they happen, bests kept honestly", () => {
  const companion = Core.generate(SEED_A);
  /* A record kept by an earlier build carries no play block;
   * playOf reads it as a fresh, unplayed-with Spark — nothing
   * owed, nothing lost. */
  const legacy = { seed: SEED_A, daysSeen: [216] };
  assert.deepEqual(Core.playOf(legacy), {
    pets: 0, pokes: 0, drags: 0, catches: 0, bestChase: 0, echoBest: 0, tricks: [], askedDay: null
  });
  let record = Core.newRecord({ seed: SEED_A, name: "Nori", civilDate: "2026-11-18" });
  record = Core.recordPlay(record, { action: "pet" }).record;
  record = Core.recordPlay(record, { action: "pet" }).record;
  record = Core.recordPlay(record, { action: "poke" }).record;
  record = Core.recordPlay(record, { action: "drag" }).record;
  let play = Core.playOf(record);
  assert.equal(play.pets, 2, "pets counted");
  assert.equal(play.pokes, 1, "pokes counted");
  assert.equal(play.drags, 1, "drags counted");
  record = Core.recordPlay(record, { action: "chase", catches: 3 }).record;
  record = Core.recordPlay(record, { action: "chase", catches: 5 }).record;
  record = Core.recordPlay(record, { action: "chase", catches: 2 }).record;
  play = Core.playOf(record);
  assert.equal(play.catches, 10, "catches accumulate across chases");
  assert.equal(play.bestChase, 5, "the best chase is the fullest one");
  record = Core.recordPlay(record, { action: "echo", round: 2 }).record;
  record = Core.recordPlay(record, { action: "echo", round: 4 }).record;
  record = Core.recordPlay(record, { action: "echo", round: 3 }).record;
  assert.equal(Core.playOf(record).echoBest, 4, "the echo best only ever rises");
  const same = Core.recordPlay(record, { action: "dance" });
  assert.deepEqual(Core.playOf(same.record), Core.playOf(record), "an unknown act of play changes nothing");
  assert.deepEqual(same.learned, [], "and teaches nothing");
  assert.ok(companion, "the companion stands behind the record");
});

test("v6 tricks: play teaches them, each names its teacher, learning lands once", () => {
  const companion = Core.generate(SEED_A); /* Water — its own trick is Ripple */
  let record = Core.newRecord({ seed: SEED_A, name: "Nori", civilDate: "2026-11-18" });
  const names = Core.tricksFor({ record, companion }).map((t) => t.id);
  assert.deepEqual(names, ["spin", "leap", "glow", "ripple"], "three shared tricks and the kind's own");
  /* Spin: three drags by hand. */
  let out = Core.recordPlay(record, { action: "drag" });
  out = Core.recordPlay(out.record, { action: "drag" });
  assert.deepEqual(out.learned, [], "two drags teach nothing yet");
  out = Core.recordPlay(out.record, { action: "drag" });
  assert.deepEqual(out.learned, ["spin"], "the third drag teaches Spin");
  out = Core.recordPlay(out.record, { action: "drag" });
  assert.deepEqual(out.learned, [], "Spin is never announced twice");
  record = out.record;
  /* Leap: four catches in the chase. */
  out = Core.recordPlay(record, { action: "chase", catches: 3 });
  assert.deepEqual(out.learned, [], "three catches are a beginning");
  out = Core.recordPlay(out.record, { action: "chase", catches: 1 });
  assert.deepEqual(out.learned, ["leap"], "the fourth catch teaches Leap");
  record = out.record;
  /* Glow pulse: five pets. Ripple, Water's own: eight. */
  for (let i = 0; i < 4; i++) record = Core.recordPlay(record, { action: "pet" }).record;
  out = Core.recordPlay(record, { action: "pet" });
  assert.deepEqual(out.learned, ["glow"], "the fifth pet teaches the Glow pulse");
  record = out.record;
  for (let i = 0; i < 2; i++) record = Core.recordPlay(record, { action: "pet" }).record;
  out = Core.recordPlay(record, { action: "pet" });
  assert.deepEqual(out.learned, ["ripple"], "the eighth pet teaches Water's Ripple");
  record = out.record;
  const tricks = Core.tricksFor({ record, companion });
  assert.ok(tricks.every((t) => t.learned), "every trick stands learned in the list");
  const spin = tricks.find((t) => t.id === "spin");
  assert.equal(spin.teacher, "being moved by hand", "each trick names its teacher");
  assert.ok(spin.count >= spin.need, "and its count stands beside it");
});

test("v6 tricks: every kind carries its own trick, and care can teach too", () => {
  const own = { fire: "flare", water: "ripple", shadow: "vanish", air: "loop", earth: "root", light: "beam" };
  for (let kindIndex = 0; kindIndex < 6; kindIndex++) {
    const seed = Core.makeSeed({ moon: 8, patternDay: 216, kindIndex, nonce: `own${kindIndex}zz` });
    const companion = Core.generate(seed);
    const list = Core.trickListFor(companion);
    assert.equal(list.length, 4, `${companion.kindName} has three shared tricks and its own`);
    assert.equal(list[3].id, own[companion.kind], `${companion.kindName}'s own trick is ${own[companion.kind]}`);
    assert.equal(list[3].kindTrick, true, "marked as the kind's own");
  }
  /* Flare learns from kindling — a care act, not a play act:
   * the flip is there for any write to announce. */
  const fireSeed = Core.makeSeed({ moon: 8, patternDay: 216, kindIndex: 0, nonce: "flare001" });
  const fire = Core.generate(fireSeed);
  const fresh = Core.newRecord({ seed: fireSeed, name: "", civilDate: "2026-11-18" });
  let kindled = Core.applyCare(fresh, { action: "kindle", patternDay: 216 });
  kindled = Core.applyCare(kindled, { action: "kindle", patternDay: 216 });
  assert.deepEqual(
    Core.learnedBetween({ before: fresh, after: kindled, companion: fire }),
    ["flare"],
    "two kindles teach Flare, and the diff sees it"
  );
  const kept = Core.markTricksKnown(kindled, ["flare"]);
  assert.deepEqual(Core.playOf(kept).tricks, ["flare"], "an announced trick is kept in the record");
  assert.deepEqual(
    Core.learnedBetween({ before: kept, after: kept, companion: fire }),
    [],
    "a kept trick never flips again"
  );
});

test("v6 echo game: her seed's pattern, her colours, rounds that grow", () => {
  const companion = Core.generate(SEED_A);
  const r1 = Core.echoFor({ companion, round: 1 });
  assert.equal(r1.pads.length, 4, "four pads");
  assert.equal(r1.steps.length, 3, "the first round is three notes");
  assert.equal(Core.echoFor({ companion, round: 2 }).steps.length, 4, "each round grows by one");
  assert.equal(Core.echoFor({ companion, round: 30 }).steps.length, 9, "growth stops at a kind length");
  assert.deepEqual(Core.echoFor({ companion, round: 2 }).steps, Core.echoFor({ companion, round: 2 }).steps, "the same Spark sings the same round anywhere");
  assert.notDeepEqual(Core.echoFor({ companion, round: 1 }).steps, Core.echoFor({ companion, round: 3 }).steps, "rounds differ from each other");
  const base = Core.chirpFor(companion).first;
  assert.equal(r1.pads[0].note, base, "the first pad sounds her own first note");
  assert.ok(r1.pads.every((p, i) => i === 0 || p.note > r1.pads[i - 1].note), "the pads rise from her pitch");
  assert.ok(r1.pads.every((p) => /^hsl\(/.test(p.color)), "the pads wear colours, grown from her hue");
  assert.ok(r1.steps.every((s) => s >= 0 && s <= 3), "every step lands on a pad");
  assert.deepEqual(Core.echoFor({ companion: null, round: 1 }), { pads: [], steps: [], round: 0 }, "no companion, no game");
});

test("v6 moods: derived from what has happened — play, care, the hour", () => {
  const companion = Core.generate(SEED_A);
  let record = Core.newRecord({ seed: SEED_A, name: "Nori", civilDate: "2026-11-18" });
  const at = (hour, recent) =>
    Core.moodFor({ record, companion, todayPatternDay: 216, hour, recent }).id;
  assert.equal(at(10), "curious", "a plain morning is curious");
  assert.equal(at(23), "sleepy", "the late hours soften her");
  assert.equal(at(2), "sleepy", "the deep night too");
  assert.equal(at(20), "calm", "the evening settles her");
  assert.equal(at(10, { petted: true }), "bright", "a fresh pet leaves her bright");
  assert.equal(at(10, { learned: true }), "proud", "a trick learned leaves her proud");
  assert.equal(at(10, { won: true }), "proud", "a round echoed true, the same");
  assert.equal(at(23, { played: true }), "bright", "a chase just run leaves her bright, even in the late hours");
  const kindled = Core.applyCare(record, { action: "kindle", patternDay: 216 });
  assert.equal(
    Core.moodFor({ record: kindled, companion, todayPatternDay: 216, hour: 10 }).id,
    "bright",
    "kindled today is bright"
  );
  const rested = Core.applyCare(record, { action: "rest", patternDay: 216 });
  assert.equal(
    Core.moodFor({ record: rested, companion, todayPatternDay: 216, hour: 10 }).id,
    "calm",
    "rested today is calm"
  );
  const banned = /you have not|haven't|have not|not done|not yet|missed|incomplete/i;
  for (const id of Object.keys(Core.MOODS)) {
    assert.ok(!banned.test(Core.MOODS[id].line), `the ${id} mood line is clean copy`);
  }
  const panel = Core.panelFor({ record, companion, today: { moon: 8, day: 20, dayOfPatternYear: 216 }, hour: 10 });
  assert.equal(panel.mood.id, "curious", "the panel names her mood");
  assert.equal(panel.play.tricksTotal, 4, "and counts her tricks");
  assert.equal(panel.play.tricksKnown, 0, "honestly, before any play");
});

test("v6 daypart: the hour's own greeting, in her temperament's voice", () => {
  assert.equal(Core.daypartFor(4), "night");
  assert.equal(Core.daypartFor(5), "morning");
  assert.equal(Core.daypartFor(10), "morning");
  assert.equal(Core.daypartFor(11), "day");
  assert.equal(Core.daypartFor(16), "day");
  assert.equal(Core.daypartFor(17), "evening");
  assert.equal(Core.daypartFor(21), "evening");
  assert.equal(Core.daypartFor(22), "night");
  const banned = /you have not|haven't|have not|not done|not yet|missed|incomplete/i;
  for (let kindIndex = 0; kindIndex < 6; kindIndex++) {
    const companion = Core.generate(
      Core.makeSeed({ moon: 8, patternDay: 216, kindIndex, nonce: `dp${kindIndex}zzzz` })
    );
    const lines = new Set();
    for (const hour of [7, 13, 19, 23]) {
      const line = Core.daypartLineFor({ companion, hour });
      assert.ok(line && line.length > 3, `${companion.temperament} greets at hour ${hour}`);
      assert.ok(!banned.test(line), `the hour ${hour} greeting is clean copy: ${line}`);
      lines.add(line);
    }
    assert.equal(lines.size, 4, "four hours, four greetings");
  }
  assert.equal(Core.daypartLineFor({ companion: null, hour: 7 }), "", "no companion, no greeting");
});

test("v6 her question: drawn from the record, once a day, skippable forever", () => {
  const companion = Core.generate(SEED_A); /* born Pattern Day 216 */
  const today = { moon: 8, day: 20, dayOfPatternYear: 216 };
  let record = Core.newRecord({ seed: SEED_A, name: "Nori", civilDate: "2026-11-18" });
  const birthday = Core.questionFor({ record, companion, today, page: "index.html" });
  assert.ok(birthday && birthday.href === "teach.html", "her birth day in the pattern asks toward a practice");
  assert.match(birthday.text, /Pattern Day I was born on/, "and says why, plainly");
  const later = { moon: 8, day: 21, dayOfPatternYear: 217 };
  record = Core.recordVisit(record, { patternDay: 216, page: "index.html" });
  record = Core.recordVisit(record, { patternDay: 217, page: "moons.html" });
  const thread = Core.questionFor({ record, companion, today: later, page: "theory.html" });
  assert.ok(thread && thread.href === "index.html", "the left-off thread is a question with its door");
  /* Nothing true to ask: every door walked, the day practised,
   * no thread behind her — the question rests, honestly. */
  let walked = Core.newRecord({ seed: SEED_A, name: "Nori", civilDate: "2026-11-18" });
  for (const key of Object.keys(Core.PAGE_GUIDE)) {
    walked = Core.recordVisit(walked, { patternDay: 217, page: key });
  }
  walked = Core.recordPractice(walked, { patternDay: 217 });
  walked = { ...walked, prevPage: null, lastPage: "index.html" };
  assert.equal(
    Core.questionFor({ record: walked, companion, today: later, page: "index.html" }),
    null,
    "with nothing true to ask, she asks nothing"
  );
  const asked = Core.markAsked(walked, { patternDay: 217 });
  assert.equal(Core.playOf(asked).askedDay, 217, "asking is kept for the day, and only the asking");
  const banned = /you have not|haven't|have not|not done|not yet|missed|incomplete/i;
  for (const q of [birthday, thread]) assert.ok(!banned.test(q.text), `her question is clean copy: ${q.text}`);
});

test("v6 conversation beats: touch, tricks, echo, celebration — every temperament, clean copy", () => {
  const banned = /you have not|haven't|have not|not done|not yet|missed|incomplete/i;
  const beats = ["pet", "poke", "tricks", "learned", "trick", "echoStart", "echoWin", "echoMiss", "sealed", "saved"];
  for (let kindIndex = 0; kindIndex < 6; kindIndex++) {
    const companion = Core.generate(
      Core.makeSeed({ moon: 8, patternDay: 216, kindIndex, nonce: `v6beat${kindIndex}zz` })
    );
    for (const beat of beats) {
      const line = Core.convoLineFor({ companion, beat });
      assert.ok(line && line.length > 3, `${companion.temperament} has a ${beat} line`);
      assert.ok(!banned.test(line), `${companion.temperament}'s ${beat} line is clean copy: ${line}`);
      assert.equal(Core.convoLineFor({ companion, beat }), line, "the same Spark speaks consistently");
    }
  }
});

test("v6 play rides the presence: touch, tricks, echo, moods, celebration hooks", () => {
  const presence = read("docs/assets/js/spark-presence.js");
  for (const hook of [
    "setPointerCapture",
    "is-petted",
    "is-poked",
    "doPet",
    "recordPlay",
    "performTrick",
    "doTricks",
    "tricksFor",
    "learnedBetween",
    "markTricksKnown",
    "announceLearned",
    "announceLine",
    "spark-echo-pads",
    "spark-panel-line",
    "beginEchoRound",
    "echoTap",
    "echoWin",
    "echoMiss",
    "echoFor",
    "moodFor",
    "is-mood-",
    "daypartLineFor",
    "questionFor",
    "markAsked",
    "grab()",
    "dragTo",
    "tossTo",
    "isPlaying",
    "sof:life-atlas-records-changed",
    "manifest-practice",
    "sof:witness-saved",
    "celebrate("
  ]) {
    assert.ok(presence.includes(hook), `the presence carries ${hook}`);
  }
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(presence), "play sends nothing anywhere either");
  const css = read("docs/assets/css/spark-companion.css");
  for (const hook of [
    ".spark-echo-pad",
    ".is-leaping",
    ".is-pulsing",
    ".is-petted",
    ".is-mood-bright",
    ".is-mood-sleepy",
    "spark-trick-flare",
    "spark-trick-vanish",
    "spark-pet-lean",
    "spark-leap"
  ]) {
    assert.ok(css.includes(hook), `the stylesheet carries ${hook}`);
  }
  const padAt = css.indexOf(".spark-echo-pad {");
  assert.ok(css.slice(padAt, padAt + 400).includes("min-height: 56px"), "an echo pad is a thumb-sized target");
  const v6At = css.indexOf("v6: touch, tricks");
  assert.ok(v6At > -1, "the v6 section is in the stylesheet");
  const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)", v6At), css.length);
  assert.ok(reduced.includes(".is-leaping"), "reduced motion stills the leap");
  assert.ok(reduced.includes(".is-petted"), "reduced motion stills the petting lean");
  assert.ok(reduced.includes(".spark-echo-pad"), "reduced motion stills the pads' transitions");
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

/* ---- v9: her sound family — the seed picks how she sounds ---- */

test("v9 sound family: the seed picks her family, and settles her sound", () => {
  const a = Core.generate(SEED_A);
  const first = Core.soundFor(a);
  assert.deepEqual(Core.soundFor(a), first, "the same seed settles the same sound anywhere");
  assert.ok(Core.SOUND_FAMILIES.map((f) => f.id).includes(first.family), "her family is one of the grown set");
  assert.ok(first.familyName.length > 3, "her family has a name her record can speak");
  assert.ok(first.brightness >= 0.85 && first.brightness <= 1.15, "her brightness is a small seed jitter");
  assert.ok(first.decay >= 0.8 && first.decay <= 1.25, "her ring is a small seed jitter");
  assert.ok(first.vibratoDepth >= 0.002 && first.vibratoDepth <= 0.009, "her vibrato is a waver, not a wobble");
  assert.ok(first.vibratoRate >= 4.2 && first.vibratoRate <= 6.1, "her vibrato pace is a held note's pace");
  assert.equal(Core.soundFor(null), null, "no companion, no sound");
  /* Across many seeds, every family is somebody's — and two
   * Sparks of one family still differ inside it. */
  const seen = new Map();
  for (let i = 0; i < 80; i++) {
    const c = Core.generate(Core.makeSeed({ moon: 8, patternDay: 216, kindIndex: i % 6, nonce: `fam${i}zz` }));
    const s = Core.soundFor(c);
    if (!seen.has(s.family)) seen.set(s.family, []);
    seen.get(s.family).push(s);
  }
  assert.equal(seen.size, Core.SOUND_FAMILIES.length, "every family is reached by some seed");
  for (const [fam, list] of seen) {
    const shapes = new Set(list.map((s) => `${s.brightness}/${s.decay}/${s.vibratoRate}`));
    assert.ok(shapes.size > 1, `family ${fam} is not one fixed sound — its Sparks differ inside it`);
  }
  /* The flourish rises from her own chirp root. */
  const chirp = Core.chirpFor(a);
  assert.equal(Core.flourishFor(a), Math.round(chirp.first * 1.78), "the flourish is her pitch, risen");
  assert.ok(Core.flourishFor(a) > chirp.second, "and it stands above her greeting's second note");
});

test("v9 softer voice rides the presence: families rendered, no sawtooth, lower level", () => {
  const presence = read("docs/assets/js/spark-presence.js");
  for (const hook of [
    "playFamilyNote",
    "soundFor",
    "softThroat",
    "addVibrato",
    "announceReveals",
    "newRevealsBetween",
    "markRevealsSeen",
    "revealLineFor",
    "flourishNote",
    "hers alone"
  ]) {
    assert.ok(presence.includes(hook), `the presence carries ${hook}`);
  }
  assert.ok(!presence.includes('"sawtooth"'), "the buzz is gone: no sawtooth oscillator anywhere in her voice");
  assert.ok(
    presence.includes("voiceMaster.gain.value = 0.55"),
    "her master level is the lowered one (a syllable peaks near 0.055, against 0.135 in v7)"
  );
  for (const fam of ["bell", "hum", "pluck", "blip"]) {
    assert.ok(presence.includes(`"${fam}"`), `the ${fam} family is rendered`);
  }
});

/* ---- v9: her finer grain — detail every seed draws differently ---- */

test("v9 details: every seed draws its own finer grain", () => {
  const a = Core.generate(SEED_A);
  assert.deepEqual(Core.generate(SEED_A).details, a.details, "the same seed draws the same detail anywhere");
  const lists = {
    crestStyle: ["tuft", "horns", "fin", "halo", "leaf", "plain"],
    ears: ["fins", "tufts", "points", "none"],
    trail: ["wisp", "ribbon", "sparkles", "none"],
    cheeks: ["glow", "blush", "freckles", "none"],
    pattern: ["speckles", "bands", "belly", "none"],
    eyeVariant: ["sparkle", "lash", "ring", "plain"]
  };
  for (const [key, values] of Object.entries(lists)) {
    assert.ok(values.includes(a.details[key]), `her ${key} is one of its grown set`);
  }
  assert.ok(a.details.density >= 0.7 && a.details.density <= 1.3, "her marking density is a seed's share");
  /* The draws are independent, so the combinations multiply:
   * across sixty seeds the detail tuples are nearly all
   * distinct, and no single value sweeps its list. */
  const tuples = new Set();
  const counts = new Map();
  for (let i = 0; i < 60; i++) {
    const c = Core.generate(Core.makeSeed({ moon: 8, patternDay: 216, kindIndex: i % 6, nonce: `det${i}zz` }));
    const d = c.details;
    tuples.add([d.crestStyle, d.ears, d.trail, d.cheeks, d.pattern, d.eyeVariant].join("/"));
    counts.set(d.crestStyle, (counts.get(d.crestStyle) || 0) + 1);
  }
  assert.ok(tuples.size >= 45, `detail combinations multiply (saw ${tuples.size} distinct faces in 60 seeds)`);
  for (const [value, n] of counts) {
    assert.ok(n < 40, `crest style ${value} does not sweep the field (${n} of 60)`);
  }
  /* Her born identity does not move: the detail stream is its
   * own stream, so kind, form, markings, eye, crest and name
   * are exactly what the seed always grew. */
  const b = Core.generate(SEED_B);
  assert.notDeepEqual(b.details, a.details, "a different seed draws different detail");
});

test("v9 details on the face: born look first, arrivals only when revealed", () => {
  /* A seed with arrivals to show. */
  let companion = null;
  for (let i = 0; i < 40 && !companion; i++) {
    const c = Core.generate(Core.makeSeed({ moon: 8, patternDay: 216, kindIndex: i % 6, nonce: `face${i}zz` }));
    if (Core.revealScheduleFor(c).length >= 4) companion = c;
  }
  assert.ok(companion, "a seed with a full schedule was found");
  const born = Core.renderSVG(companion, { stage: 1 });
  assert.ok(born.includes('data-spark-shown=""'), "a first meeting shows her born look — no arrivals");
  const all = Core.revealScheduleFor(companion).map((s) => s.id);
  const later = Core.renderSVG(companion, { stage: 1, revealed: all });
  assert.notEqual(later, born, "the later face is not the born face");
  for (const id of all) {
    assert.ok(later.includes(id), `the later face names ${id} among what she wears`);
  }
  /* The arrivals are the same identity grown, at every stage:
   * what she wears at Ember she still wears at Radiant. */
  const ember = Core.renderSVG(companion, { stage: 0, revealed: all });
  const radiant = Core.renderSVG(companion, { stage: 2, revealed: all });
  assert.ok(ember.includes(`data-spark-shown="${all.join(" ")}"`), "her arrivals stand at Ember");
  assert.ok(radiant.includes(`data-spark-shown="${all.join(" ")}"`), "and the same arrivals stand at Radiant — grown, never swapped");
  /* The 3D builder reads the same detail and the same list. */
  const three = read("docs/assets/js/spark-3d.js");
  assert.ok(three.includes("companion.details"), "the 3D body grows from her detail");
  assert.ok(three.includes("revealed"), "and wears only what her schedule has brought");
  assert.ok(three.includes("options.revealed"), "the mount takes the reveal state in");
});

/* ---- v9: the reveal cadence — fast first, then stretching ---- */

test("v9 reveal schedule: first arrival fast, gaps strictly stretching, jitter bounded", () => {
  for (let i = 0; i < 24; i++) {
    const c = Core.generate(Core.makeSeed({ moon: 8, patternDay: 216, kindIndex: i % 6, nonce: `sch${i}zz` }));
    const sched = Core.revealScheduleFor(c);
    assert.ok(sched.length >= 1, "every Spark has at least the flourish to grow toward");
    assert.equal(sched[sched.length - 1].id, "flourish", "her voice flowers last");
    assert.ok(sched[0].at >= 3 && sched[0].at <= 5, `the first arrival comes after a handful of pages (at ${sched[0].at})`);
    for (let k = 1; k < sched.length; k++) {
      assert.ok(sched[k].gap > sched[k - 1].gap, "each gap is longer than the one before — never clockwork");
      assert.ok(sched[k].at > sched[k - 1].at, "the points themselves only move forward");
    }
    for (let k = 0; k < sched.length; k++) {
      const base = 4 * Math.pow(1.7, k);
      assert.ok(
        sched[k].gap >= Math.floor(base * 0.7) && sched[k].gap <= Math.ceil(base * 1.35) + k,
        `gap ${k} stays within its jittered band of the curve`
      );
    }
    assert.deepEqual(Core.revealScheduleFor(c), sched, "the same seed keeps the same schedule anywhere");
  }
  /* A feature her seed never drew is not on her schedule:
   * nothing is owed, nothing is missing. */
  let plain = null;
  for (let i = 0; i < 60 && !plain; i++) {
    const c = Core.generate(Core.makeSeed({ moon: 8, patternDay: 216, kindIndex: i % 6, nonce: `pln${i}zz` }));
    if (c.details.cheeks === "none") plain = c;
  }
  assert.ok(plain, "a cheekless seed exists in the field");
  assert.ok(
    !Core.revealScheduleFor(plain).some((s) => s.id === "cheeks"),
    "her schedule holds no cheeks she was never drawn with"
  );
});

test("v9 reveals: earned by walking, announced once, and time away costs nothing", () => {
  const companion = Core.generate(SEED_A);
  const sched = Core.revealScheduleFor(companion);
  const fresh = Core.newRecord({ seed: SEED_A, name: "Nori", civilDate: "2026-11-19" });
  assert.equal(Core.engagementOf(fresh), 0, "a fresh record has walked nowhere");
  assert.deepEqual(Core.revealsFor({ record: fresh, companion }).revealed, [], "no walking, no arrivals");
  assert.deepEqual(Core.revealsSeenOf(fresh), [], "and nothing has been announced");
  /* Surfing to the first point earns exactly the first arrival. */
  const walked = { ...fresh, pagesSeen: Array.from({ length: sched[0].at }, (_, i) => `p${i}`) };
  assert.deepEqual(
    Core.revealsFor({ record: walked, companion }).revealed,
    [sched[0].id],
    "the first arrival lands at its point, not before"
  );
  const justShort = { ...fresh, pagesSeen: Array.from({ length: sched[0].at - 1 }, (_, i) => `p${i}`) };
  assert.deepEqual(Core.revealsFor({ record: justShort, companion }).revealed, [], "one page short is still short");
  /* Announced exactly once, through the one path. */
  const news = Core.newRevealsBetween({ before: fresh, after: walked, companion });
  assert.deepEqual(news, [sched[0].id], "the arrival is news once");
  const told = Core.markRevealsSeen(walked, news);
  assert.deepEqual(Core.newRevealsBetween({ before: fresh, after: told, companion }), [], "and never news twice");
  assert.deepEqual(Core.newRevealsBetween({ before: told, after: told, companion }), [], "a kept telling stays kept");
  /* Time is not in the count at all: a record that only aged
   * — different days on its face, no new walking — ripens
   * nothing. The schedule waits; it never punishes. */
  const aged = { ...walked, lastDay: 999, bornCivil: "2031-01-01" };
  assert.equal(Core.engagementOf(aged), Core.engagementOf(walked), "the count reads counters, never clocks");
  assert.deepEqual(
    Core.revealsFor({ record: aged, companion }).revealed,
    Core.revealsFor({ record: walked, companion }).revealed,
    "away time reveals nothing and takes nothing"
  );
  /* Return days and care count too — the walking is the whole
   * of her life with her keeper, not pages alone. */
  const returned = { ...fresh, daysSeen: [216, 217] };
  assert.equal(Core.engagementOf(returned), 4, "a second day together counts four");
  const cared = Core.applyCare(fresh, { action: "kindle", patternDay: 217 });
  assert.ok(Core.engagementOf(cared) > Core.engagementOf(fresh), "care walks her forward too");
  /* Her arrival lines are clean copy, every one. */
  const banned = /you have not|haven't|have not|not done|not yet|missed|incomplete/i;
  for (const id of Core.REVEAL_ORDER) {
    assert.ok(!banned.test(Core.revealLineFor(id)), `the ${id} line is clean copy: ${Core.revealLineFor(id)}`);
  }
});
