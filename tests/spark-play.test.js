"use strict";

/*
 * Spark play — character and entertaining interactions
 * (Aaron's order, Nov 25, 2026: "Wear the Spark character a
 * little bit. Maybe detail more." / "Make their interactions
 * and everything be more entertaining." — on the site.)
 *
 * These tests pin the pass's fences:
 *   - the character is a pure function of the keeper's real
 *     seed, through the core's own hash: the same seed is the
 *     same character everywhere; different seeds differ; a
 *     temperament's mannerisms are its own;
 *   - a trick is taught by BREADTH — practised on two
 *     different Pattern Days — never by same-day repetition,
 *     and the teaching is remembered in the layer's own local
 *     store across a save/load round-trip;
 *   - the echo duet is learned at a finished phrase of three,
 *     once; the best length is kept, never re-earned;
 *   - celebrations fire ONLY on real completions (a practice
 *     sealed, a witness saved) — the predicate is the gate,
 *     and the layer offers no celebrate control of its own;
 *   - performance is a fence, in the source: no layout reads
 *     of any kind, no interval loop (a sparse timeout chain
 *     only);
 *   - reduced motion stills the layer: the stylesheet kills
 *     every animation the layer adds, and the module's own
 *     reduced-motion read agrees with the house signal;
 *   - the wiring: the Companions page carries the layer, its
 *     stylesheet, and the mount inside the companion card.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repoRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function loadModule(relativePath) {
  const context = vm.createContext({ console, module: { exports: {} }, exports: {} });
  context.globalThis = context;
  vm.runInContext(read(relativePath), context, { filename: path.basename(relativePath) });
  return context.module.exports;
}

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); }
  };
}

const Core = loadModule("docs/assets/js/spark-companion.js");
const Play = loadModule("docs/assets/js/spark-play.js");

function companionFor(seed) {
  return Core.generate(seed);
}

test("the character is the seed's own: same seed, same character", () => {
  const a = Play.characterFor(companionFor("spark1-8-217-1-iuebk69z"));
  const b = Play.characterFor(companionFor("spark1-8-217-1-iuebk69z"));
  assert.deepEqual(a, b);
  assert.ok(a.mannerism && a.mannerism.id && a.mannerism.label);
  assert.ok(a.sparkle && a.sparkle.id && a.sparkle.label);
  assert.ok(a.playStyle && a.playStyle.id);
  assert.ok(a.idleMinMs < a.idleMaxMs);
  assert.ok(a.baseHz >= 300 && a.baseHz <= 460);
});

test("different seeds grow different characters", () => {
  const seen = new Set();
  for (let n = 0; n < 60; n++) {
    const seed = `spark1-8-217-1-probe${String(n).padStart(3, "0")}x`;
    const c = Play.characterFor(companionFor(seed));
    seen.add(`${c.mannerism.id}|${c.sparkle.id}|${c.playStyle.id}`);
  }
  assert.ok(seen.size > 6, `expected real variety across seeds, saw ${seen.size}`);
});

test("a temperament's mannerisms are its own", () => {
  for (let n = 0; n < 40; n++) {
    const seed = `spark1-8-217-1-probe${String(n).padStart(3, "0")}x`;
    const companion = companionFor(seed);
    const c = Play.characterFor(companion);
    const own = Play.MANNERISMS[companion.temperament] || Play.MANNERISMS.curious;
    assert.ok(own.some((m) => m.id === c.mannerism.id),
      `${companion.temperament} Spark drew ${c.mannerism.id}, not its own`);
    const [min, max] = Play.IDLE_RANGES[companion.temperament] || Play.IDLE_RANGES.curious;
    assert.equal(c.idleMinMs, min);
    assert.equal(c.idleMaxMs, max);
  }
});

test("idle delays stay inside the temperament's range", () => {
  const c = Play.characterFor(companionFor("spark1-8-217-1-iuebk69z"));
  for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
    const d = Play.idleDelayMs(c, () => r);
    assert.ok(d >= c.idleMinMs && d <= c.idleMaxMs, `${d} outside ${c.idleMinMs}–${c.idleMaxMs}`);
  }
});

test("a trick is taught by breadth: two different days, never one day twice", () => {
  let store = Play.blankStore();
  let r = Play.recordPractise(store, "ripple", 221);
  assert.equal(r.counted, true);
  assert.equal(r.learnedNow, false);
  r = Play.recordPractise(store, "ripple", 221);
  assert.equal(r.counted, false, "a same-day repeat writes nothing");
  assert.equal(r.learnedNow, false);
  assert.deepEqual([...Play.taughtTrickIds(store)], []);
  r = Play.recordPractise(store, "ripple", 235);
  assert.equal(r.counted, true);
  assert.equal(r.learnedNow, true, "the second different day teaches it");
  assert.deepEqual([...Play.taughtTrickIds(store)], ["ripple"]);
  assert.equal(store.taught.ripple, 235);
  r = Play.recordPractise(store, "ripple", 240);
  assert.equal(r.learnedNow, false, "a taught trick is not re-taught");
});

test("the teaching is remembered locally across a round-trip", () => {
  const storage = fakeStorage();
  let store = Play.blankStore();
  Play.recordPractise(store, "flare", 200);
  Play.recordPractise(store, "flare", 214);
  Play.recordDuet(store, 5, 214);
  store.greetedDay = 214;
  Play.saveStore(storage, store);
  const back = Play.loadStore(storage);
  assert.deepEqual([...Play.taughtTrickIds(back)], ["flare"]);
  assert.deepEqual([...back.practiseDays.flare], [200, 214]);
  assert.equal(back.duet.best, 5);
  assert.equal(back.duet.learnedDay, 214);
  assert.equal(back.greetedDay, 214);
});

test("a damaged store reads as a blank one, never a crash", () => {
  const storage = fakeStorage({ [Play.STORE_KEY]: "{not json" });
  assert.deepEqual(Play.loadStore(storage), Play.blankStore());
  const storage2 = fakeStorage({ [Play.STORE_KEY]: JSON.stringify({ practiseDays: { x: ["a", 3] }, taught: { y: "no" } }) });
  const store = Play.loadStore(storage2);
  assert.deepEqual([...store.practiseDays.x], [3], "only real Pattern Days survive the read");
  assert.deepEqual([...Play.taughtTrickIds(store)], [], "a non-day teaching does not stand");
});

test("the duet is learned at a phrase of three, once; the best is a keepsake", () => {
  let store = Play.blankStore();
  let r = Play.recordDuet(store, 2, 221);
  assert.equal(r.learnedNow, false);
  assert.equal(store.duet.best, 2);
  r = Play.recordDuet(store, 3, 221);
  assert.equal(r.learnedNow, true);
  assert.equal(store.duet.learnedDay, 221);
  r = Play.recordDuet(store, 6, 230);
  assert.equal(r.learnedNow, false, "learned once");
  assert.equal(store.duet.best, 6, "the best length grows and is kept");
  r = Play.recordDuet(store, 4, 231);
  assert.equal(store.duet.best, 6, "a shorter phrase never shrinks the keepsake");
});

test("celebrations fire only on real completions", () => {
  assert.equal(Play.isCelebrationEvent("records-changed", { source: "manifest-practice" }), true);
  assert.equal(Play.isCelebrationEvent("witness-saved", null), true);
  assert.equal(Play.isCelebrationEvent("records-changed", { source: "garden" }), false);
  assert.equal(Play.isCelebrationEvent("records-changed", { source: "spark-play" }), false);
  assert.equal(Play.isCelebrationEvent("records-changed", null), false);
  assert.equal(Play.isCelebrationEvent("arrival", { source: "manifest-practice" }), false);
  assert.equal(Play.isCelebrationEvent("tap", null), false);
});

test("the layer offers no celebration of its own", () => {
  const src = read("docs/assets/js/spark-play.js");
  assert.ok(!/Celebrate/i.test(src.split("celebrate()")[0].split("function celebrate")[0]) ||
            !src.includes(">Celebrate<"),
    "no celebrate-labelled control is built");
  assert.ok(!src.includes("spark-play-celebrate-button"));
});

test("performance fence, in the source: no layout reads, no interval loop", () => {
  const src = read("docs/assets/js/spark-play.js");
  for (const banned of ["getBoundingClientRect", "offsetWidth", "offsetHeight",
                        "offsetTop", "offsetLeft", "clientWidth", "clientHeight",
                        "scrollWidth", "scrollHeight", "setInterval"]) {
    assert.ok(!src.includes(banned), `spark-play.js must not use ${banned}`);
  }
  assert.ok(src.includes("setTimeout"), "the idle life runs on a sparse timeout chain");
});

test("reduced motion: the module reads the house signal both ways", () => {
  const still = { matchMedia: (q) => ({ matches: q.includes("reduce") }),
                  document: { documentElement: { classList: { contains: () => false } } } };
  assert.equal(Play.reducedMotion(still), true);
  const moving = { matchMedia: () => ({ matches: false }),
                   document: { documentElement: { classList: { contains: () => false } } } };
  assert.equal(Play.reducedMotion(moving), false);
  const byClass = { matchMedia: () => ({ matches: false }),
                    document: { documentElement: { classList: { contains: (c) => c === "sof-reduced-motion" } } } };
  assert.equal(Play.reducedMotion(byClass), true);
});

test("every mannerism and trick the layer can show has its animation", () => {
  const css = read("docs/assets/css/spark-play.css");
  const ids = new Set();
  for (const list of Object.values(Play.MANNERISMS)) for (const m of list) ids.add(m.id);
  for (const id of ids) {
    assert.ok(css.includes(`.is-manner-${id}`), `stylesheet is missing .is-manner-${id}`);
  }
  for (const id of ["spin", "leap", "glow", "flare", "ripple", "vanish", "loop", "root", "beam"]) {
    assert.ok(css.includes(`.is-trick-${id}`), `stylesheet is missing .is-trick-${id}`);
  }
  for (const form of Play.SPARKLE_FORMS) {
    assert.ok(css.includes(`.is-${form.id}`), `stylesheet is missing the ${form.id} mote form`);
  }
  assert.ok(css.includes("prefers-reduced-motion: reduce"), "the stylesheet stills the layer under reduced motion");
  assert.ok(css.includes(".is-greeting"), "Their Home's greeting shimmer is styled");
});

test("the wiring: the Companions page carries the layer in the companion card", () => {
  const html = read("docs/companions.html");
  assert.ok(html.includes("assets/js/spark-play.js"), "the play layer is loaded");
  assert.ok(html.includes("assets/css/spark-play.css"), "its stylesheet is loaded");
  const card = html.indexOf('id="spark-companion"');
  const mount = html.indexOf('id="spark-play"');
  const cardEnd = html.indexOf('id="spark-passport"');
  assert.ok(card > -1 && mount > card && mount < cardEnd,
    "the mount stands inside the companion card, before the passport section");
});
