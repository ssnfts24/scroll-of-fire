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
  assert.ok(presence.includes("spark-presence-panel"), "the Your Spark panel rides the bubble");
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
    ".spark-presence-panel",
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
  assert.ok(presence.includes("spark-share-btn"), "the panel carries the share action");
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

test("v4 conversation rides the presence: a thread, chips for buttons, a body that answers", () => {
  const presence = read("docs/assets/js/spark-presence.js");
  for (const hook of [
    "spark-convo-thread",
    "spark-convo-chips",
    "spark-convo-reply",
    "convoLineFor",
    "startConvo",
    "openConvo",
    "answerInBody",
    "setChips",
    "replyEcho",
    "doAround",
    "doExplain",
    "doKindle",
    "doPlay",
    "doRest",
    "doShare",
    "doTrail",
    "doBye"
  ]) {
    assert.ok(presence.includes(hook), `the presence carries ${hook}`);
  }
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(presence), "the conversation sends nothing anywhere");
  const css = read("docs/assets/css/spark-companion.css");
  assert.ok(css.includes(".spark-convo-thread"), "the thread is styled");
  assert.ok(css.includes(".spark-convo-chips"), "the chips are styled");
  const chipBlock = css.slice(css.indexOf(".spark-chip {"), css.indexOf(".spark-chip {") + 500);
  assert.ok(chipBlock.includes("min-height: 44px"), "a chip is a thumb-sized target");
  const v4Start = css.indexOf("v4: the conversation");
  assert.ok(v4Start > -1, "the v4 interaction section is in the stylesheet");
  const careAt = css.indexOf(".spark-care-buttons button {", v4Start);
  const careBlock = css.slice(careAt, careAt + 300);
  assert.ok(careBlock.includes("min-height: 44px"), "a care button is a thumb-sized target");
  const shareAt = css.indexOf(".spark-share-btn {", v4Start);
  assert.ok(css.slice(shareAt, shareAt + 300).includes("min-height: 44px"), "the share button is a thumb-sized target");
});

test("v5 spoken voice: the seed pitches it, the temperament paces it", () => {
  const a = Core.generate(SEED_A);
  const first = Core.voiceFor(a);
  assert.deepEqual(Core.voiceFor(a), first, "the same Spark settles the same voice anywhere");
  assert.ok(first.pitch >= 0.75 && first.pitch <= 1.3, "pitch sits inside the speech scale");
  assert.ok(first.rate >= 0.85 && first.rate <= 1.15, "rate stays near natural speech");
  /* The pitch follows the chirp: the lowest kind (Earth) speaks
   * lower than the highest (Light), for any seed jitter. */
  const earth = Core.generate(Core.makeSeed({ moon: 3, patternDay: 40, kindIndex: 4, nonce: "voice0001" }));
  const light = Core.generate(Core.makeSeed({ moon: 3, patternDay: 40, kindIndex: 5, nonce: "voice0001" }));
  assert.ok(Core.chirpFor(earth).first < Core.chirpFor(light).first, "the chirp ordering the voice follows");
  assert.ok(Core.voiceFor(earth).pitch < Core.voiceFor(light).pitch, "a low chirp speaks low; a high chirp speaks high");
  /* The pace is the temperament's: bold quicker than gentle,
   * whatever the seed's small jitter. */
  const bold = Core.generate(Core.makeSeed({ moon: 3, patternDay: 40, kindIndex: 0, nonce: "voice0002" }));
  const gentle = Core.generate(Core.makeSeed({ moon: 3, patternDay: 40, kindIndex: 1, nonce: "voice0002" }));
  assert.ok(Core.voiceFor(bold).rate > Core.voiceFor(gentle).rate, "bold speaks a touch quicker than gentle");
  assert.equal(Core.voiceFor(null), null, "no companion, no voice settings");
});

test("v5 voice choice: the device's warm en-US voice wins, in the stated order", () => {
  const david = { name: "Microsoft David - English (United States)", lang: "en-US", default: true };
  const google = { name: "Google US English", lang: "en-US", default: false };
  const uk = { name: "Google UK English Female", lang: "en-GB", default: false };
  const french = { name: "Google français", lang: "fr-FR", default: false };
  assert.equal(Core.pickVoice([david, google, uk]).name, "Google US English", "the warm named en-US voice wins");
  assert.equal(Core.pickVoice([david, uk]).name, david.name, "any en-US voice beats another English voice");
  assert.equal(Core.pickVoice([french, uk]).name, uk.name, "any English voice beats a non-English default");
  const samantha = { name: "Samantha", lang: "en-US", default: true };
  assert.equal(Core.pickVoice([uk, samantha]).name, "Samantha", "a named en-US voice beats a plainer English one");
  assert.equal(Core.pickVoice([]), null, "no voices offered, no voice chosen");
  assert.equal(Core.pickVoice(null), null, "a missing list chooses nothing");
});

test("v5 speech text: she says the opening, in whole sentences, capped", () => {
  assert.equal(Core.speechTextFor("A short line."), "A short line.", "a short line is spoken whole");
  assert.equal(Core.speechTextFor(""), "", "silence stays silence");
  const long =
    "First sentence of the page, stated plainly. " +
    "Second sentence, carrying the next fact of it. " +
    "Third sentence, with a good deal more of the page's own wording in it to carry the count upward. " +
    "Fourth sentence, also the page's own, and by now the spoken cap is close at hand for this line. " +
    "Fifth sentence, which the voice leaves for the text to carry, since the opening has been said.";
  const spoken = Core.speechTextFor(long);
  assert.ok(spoken.length <= 280, "the spoken opening is capped");
  assert.ok(long.startsWith(spoken), "what she says is the opening of the line, word for word");
  assert.ok(/[.!?]$/.test(spoken), "she stops at a sentence's end, not mid-thought");
  const oneLong = "word ".repeat(120).trim() + ".";
  assert.ok(Core.speechTextFor(oneLong).length <= 280, "even one long sentence is capped");
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

test("v5 voice rides the presence: default quiet, keeper-switched, mute-ruled, tap-gated", () => {
  const presence = read("docs/assets/js/spark-presence.js");
  for (const hook of [
    "spark-presence-voice",
    "sof.spark.voice",
    "speechSynthesis",
    "SpeechSynthesisUtterance",
    "voiceFor",
    "pickVoice",
    "speechTextFor",
    "stopSpeaking",
    "Tell me more",
    "moreChunksFor",
    "pageFollowingText",
    "tellingFor",
    "dayTellingHeadline",
    "spark-guide-more"
  ]) {
    assert.ok(presence.includes(hook), `the presence carries ${hook}`);
  }
  assert.ok(
    presence.includes('window.localStorage.getItem(VOICE_KEY) === "on"'),
    "voice rests quiet unless the keeper stored it on — default quiet"
  );
  const speakAt = presence.indexOf("function speak(text)");
  const gate = presence.slice(speakAt, speakAt + 220);
  assert.ok(gate.includes("!voiceOn()"), "she does not speak while Voice is off");
  assert.ok(gate.includes("soundOff()"), "the Sounds mute silences her voice too");
  assert.ok(gate.includes("!voiceArmed"), "she does not speak before a keeper tap arms the talk");
  const closeAt = presence.indexOf("const closeBubble");
  assert.ok(
    presence.slice(closeAt, closeAt + 320).includes("stopSpeaking()"),
    "closing the talk stills her voice"
  );
  assert.ok(
    presence.includes('speechSynthesis.addEventListener("voiceschanged"') ||
      presence.includes("voiceschanged"),
    "the device voice list is followed as it loads"
  );
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(presence), "the voice sends nothing anywhere");
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
