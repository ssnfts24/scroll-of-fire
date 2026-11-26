"use strict";

/*
 * The Codex Card System — first slice (Aaron's commission, Nov 25,
 * 2026; design: codex-card-system-design-2026-11-25.md).
 *
 * These tests pin the slice's promises:
 *   - the registry is complete (27 designs: 13 Moons, 8 Words, 6 Kinds)
 *     and every card carries the game's full field contract;
 *   - every value is grounded in the record — Moon frequencies and
 *     names from PatternCalendarData itself, Kind data from the
 *     companion core itself, Word Hebrew/transliteration/Strong's from
 *     the live study pages; no card references a hum the record does
 *     not give;
 *   - resonance values match the paper's hand-computed pins;
 *   - every triad the harmony table names actually closes, and
 *     harmony keys are symmetric;
 *   - Moon-window logic against the calendar's own fixtures;
 *   - the collection store: one copy per design, unique instance ids,
 *     lineage head-hash changing on a recorded transfer and on
 *     nothing else, tombstones, never-trade classes refused;
 *   - the First Card deriving deterministically from a Spark record
 *     fixture, carrying its never-trade class;
 *   - the match foundation: same code → same initial state; a
 *     scripted move sequence → the same hash on both "sides"; a
 *     mismatched hash refuses the move whole (§7.2).
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

function loadModule(relativePath, extraFiles = []) {
  const context = vm.createContext({ console, module: { exports: {} }, exports: {} });
  context.globalThis = context;
  for (const file of extraFiles) {
    vm.runInContext(read(file), context, { filename: path.basename(file) });
  }
  vm.runInContext(read(relativePath), context, { filename: path.basename(relativePath) });
  return context.module.exports || context.CodexCards || context.SparkCompanion || context.PatternCalendarData;
}

function loadGlobal(relativePath, extraFiles, globalName) {
  const context = vm.createContext({ console });
  context.globalThis = context;
  for (const file of [...extraFiles, relativePath]) {
    vm.runInContext(read(file), context, { filename: path.basename(file) });
  }
  return context[globalName];
}

const Cards = loadModule("docs/assets/js/codex-cards.js");
const CalendarData = loadGlobal("docs/assets/js/calendar/pattern-calendar-data.js", [], "PatternCalendarData");
const calendarContext = vm.createContext({ console });
calendarContext.globalThis = calendarContext;
for (const file of ["pattern-calendar-data.js", "pattern-calendar-format.js",
  "pattern-calendar-boundary.js", "pattern-calendar-version.js", "pattern-calendar.js"]) {
  vm.runInContext(read("docs/assets/js/calendar/" + file), calendarContext, { filename: file });
}
const PatternCalendar = calendarContext.PatternCalendar;
// Dates must be built inside the calendar's own realm — a host-realm
// Date fails the engine's instanceof check and it falls back to now.
const realmDate = (expr) => vm.runInContext(expr, calendarContext);
const Companion = loadModule("docs/assets/js/spark-companion.js");

function shimStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
}

/* ------------------------- registry completeness ------------------------- */

test("registry: 27 designs — 13 Moons, 8 Words, 6 Kinds, unique ids", () => {
  assert.equal(Cards.REGISTRY.length, 27);
  const bySet = { moons: 0, words: 0, kinds: 0 };
  const ids = new Set();
  for (const card of Cards.REGISTRY) {
    bySet[card.set] += 1;
    assert.ok(!ids.has(card.id), "duplicate id " + card.id);
    ids.add(card.id);
  }
  assert.deepEqual(bySet, { moons: 13, words: 8, kinds: 6 });
});

test("registry: every card carries the full game field contract", () => {
  for (const card of Cards.REGISTRY) {
    assert.ok(card.id && card.name && card.set, card.id);
    assert.ok(card.art && Array.isArray(card.art.palette) && card.art.palette.length === 2, card.id);
    assert.ok(card.home && card.home.page && card.home.act, card.id);
    assert.ok(["common", "moon-window", "earned-only"].includes(card.rarity), card.id);
    assert.ok(card.edition && card.edition.name === "First Edition", card.id);
    assert.ok(card.element, card.id);
    assert.ok(card.hum && (card.hum.hz || card.hum.motif), card.id);
    assert.ok(Array.isArray(card.moonAffinity) && card.moonAffinity.length >= 1, card.id);
    assert.ok(Number.isInteger(card.resonance) && card.resonance >= 0 && card.resonance <= 3, card.id);
    assert.ok(Array.isArray(card.harmonyKeys) && card.harmonyKeys.length >= 1, card.id);
    assert.ok(card.retune && Array.isArray(card.retune.by) && card.retune.by.length >= 1, card.id);
    assert.equal(card.playCost.light, 1, card.id);
    assert.ok(card.gameRole, card.id);
  }
});

/* ------------------------- grounding in the record ------------------------- */

test("grounding: Moon cards equal PatternCalendarData, value for value", () => {
  for (const moon of CalendarData.moons) {
    const card = Cards.cardById("moon-" + String(moon.idx).padStart(2, "0"));
    assert.ok(card, "moon " + moon.idx);
    assert.equal(card.name, moon.name);
    assert.equal(card.element, moon.element);
    assert.equal(card.hum.hz, parseInt(moon.freq, 10), moon.name + " frequency");
    assert.deepEqual([...card.moonAffinity], [moon.idx]);
  }
});

test("grounding: Kind cards equal the companion core's KINDS", () => {
  assert.equal(Companion.KINDS.length, 6);
  for (const kind of Companion.KINDS) {
    const card = Cards.cardById("kind-" + kind.id);
    assert.ok(card, kind.id);
    assert.equal(card.name, kind.name);
    assert.equal(card.kind.temperament, kind.temperament);
    assert.equal(card.kind.line, kind.line);
    assert.deepEqual([...card.art.hueRange], [...kind.hues]);
  }
});

test("grounding: Word cards match their live study pages (Hebrew, transliteration, Strong's)", () => {
  for (const word of Cards.WORDS) {
    if (word.slug === "davar") continue; // its page lands with PR #359; the registry leads, the page follows
    const html = read("docs/scripture/word-studies/" + word.slug + ".html");
    assert.ok(html.includes(word.hebrew), word.slug + " Hebrew on its page");
    assert.ok(html.includes("(" + word.translit + ", " + word.strongs + ")"),
      word.slug + " transliteration + Strong's on its page");
    const card = Cards.cardById("word-" + word.slug);
    assert.equal(card.word.hebrew, word.hebrew);
    assert.equal(card.hum.motif, word.translit);
    assert.equal(card.hum.hz, undefined, "a Word carries no frequency — only the sounded word");
  }
});

test("grounding: no card references a hum the record does not give", () => {
  const recordFreqs = new Set(CalendarData.moons.map((m) => parseInt(m.freq, 10)));
  for (const card of Cards.REGISTRY) {
    if (card.hum.hz) {
      assert.ok(recordFreqs.has(card.hum.hz), card.id + " hum " + card.hum.hz + " is a record frequency");
    }
    if (card.set === "kinds") {
      const source = Cards.cardById(card.hum.derivedFrom);
      assert.ok(source && source.set === "moons", card.id + " derivation source exists");
      assert.equal(source.hum.hz, card.hum.hz, card.id + " sounds its stated Moon");
    }
  }
});

/* ------------------------- resonance pins ------------------------- */

test("resonance: the paper's hand-computed pins hold", () => {
  assert.equal(Cards.resonanceForHz(432), 3);
  assert.equal(Cards.resonanceForHz(144), 2);
  assert.equal(Cards.resonanceForHz(369), 0);
  const pins = {
    "moon-01": 2, "moon-02": 3, "moon-03": 0, "moon-09": 2, "moon-11": 3, "moon-12": 2,
    "kind-fire": 2, "kind-water": 3, "kind-air": 0, "kind-earth": 0, "kind-light": 0, "kind-shadow": 0,
    "word-shem": 2, "word-adamah": 3, "word-or": 3
  };
  for (const [id, value] of Object.entries(pins)) {
    assert.equal(Cards.cardById(id).resonance, value, id);
  }
  assert.equal(Cards.hebrewLetterCount("שֵׁם"), 2);
  assert.equal(Cards.hebrewLetterCount("אֲדָמָה"), 4);
});

/* ------------------------- harmony ------------------------- */

test("harmony: every triad the table names actually closes; false triads do not", () => {
  const triads = Cards.namedTriads();
  assert.equal(triads.length, 9); // 8 home Words; Davar's Aether Moon kindreds with two Kinds
  for (const t of triads) {
    assert.ok(Cards.triadCloses(t.moon, t.word, t.kind), JSON.stringify(t));
  }
  assert.equal(Cards.triadCloses("moon-01", "word-or", "kind-water"), false);
  assert.equal(Cards.triadCloses("moon-08", "word-enosh", "kind-fire"), false);
});

test("harmony: keys are symmetric across the whole registry", () => {
  for (const card of Cards.REGISTRY) {
    for (const key of card.harmonyKeys) {
      const other = Cards.cardById(key);
      assert.ok(other, card.id + " → " + key + " exists");
      assert.ok(other.harmonyKeys.includes(card.id), key + " names " + card.id + " back");
    }
  }
});

/* ------------------------- windows ------------------------- */

test("windows: Moon-window logic against the calendar's own fixtures", () => {
  const july = PatternCalendar.fromCivilDate({ date: realmDate("new Date(Date.UTC(2026, 6, 17, 12))"), timeZone: "UTC" });
  assert.equal(july.moon, 4);
  assert.equal(july.dayOfPatternYear, 92);
  const sept = PatternCalendar.fromCivilDate({ date: realmDate("new Date(Date.UTC(2026, 8, 15, 12))"), timeZone: "UTC" });
  assert.equal(sept.moon, 6);
  assert.equal(sept.dayOfPatternYear, 152);

  assert.equal(Cards.isInWindow(Cards.cardById("moon-04"), july.moon), true);
  assert.equal(Cards.isInWindow(Cards.cardById("moon-05"), july.moon), false);
  assert.equal(Cards.isInWindow(Cards.cardById("moon-06"), sept.moon), true);
  assert.equal(Cards.isInWindow(Cards.cardById("word-or"), july.moon), true, "common cards are always in window");
  assert.equal(Cards.isInWindow(Cards.cardById("kind-fire"), sept.moon), true, "earned-only cards are always in window");
});

/* ------------------------- the collection store ------------------------- */

test("store: one copy per design, unique instance ids, lineage at the find", () => {
  const store = Cards.createStore(shimStorage(), "testkeeper");
  const a = store.collect("moon-08", { patternDay: 217, moon: 8, via: "witness-day" });
  assert.ok(a && a.state === "held");
  assert.equal(a.lineage.found.patternDay, 217);
  assert.equal(a.lineage.found.via, "witness-day");
  assert.deepEqual([...a.lineage.keepers], ["the-keeper"]);
  const again = store.collect("moon-08", { patternDay: 218, moon: 8, via: "witness-day" });
  assert.equal(again.instanceId, a.instanceId, "a repeat find returns the same copy — never a duplicate");
  assert.equal(store.heldCopies().length, 1);

  const ids = new Set([a.instanceId]);
  for (const card of Cards.REGISTRY) {
    if (card.id === "moon-08") continue; // already held — the same copy comes back
    const copy = store.collect(card.id, { patternDay: 220, moon: 8, via: card.home.act });
    assert.ok(!ids.has(copy.instanceId), "instance id unique: " + copy.instanceId);
    ids.add(copy.instanceId);
  }
  assert.equal(ids.size, 27);
  assert.equal(store.heldCopies().length, 27);
});

test("store: a recorded transfer extends the chain, changes the head-hash, tombstones the copy", () => {
  const store = Cards.createStore(shimStorage(), "testkeeper");
  const copy = store.collect("moon-08", { patternDay: 217, moon: 8, via: "witness-day" });
  const other = store.collect("word-or", { patternDay: 217, moon: 8, via: "hear-the-word" });
  const headBefore = copy.lineage.headHash;
  const otherHeadBefore = other.lineage.headHash;

  const moved = store.recordTransfer(copy.instanceId, "another-keeper");
  assert.equal(moved.state, "traded-away");
  assert.notEqual(moved.lineage.headHash, headBefore, "the head-hash changes on a recorded transfer");
  assert.deepEqual([...moved.lineage.keepers], ["the-keeper", "another-keeper"]);
  assert.equal(store.tombstones().length, 1);
  assert.equal(store.tombstones()[0].instanceId, copy.instanceId);
  assert.ok(!store.heldCopies().some((c) => c.instanceId === copy.instanceId));

  const otherAfter = store.copyFor("word-or");
  assert.equal(otherAfter.lineage.headHash, otherHeadBefore, "an unrelated copy's head-hash changes on nothing else");
  assert.equal(store.recordTransfer(copy.instanceId, "third-keeper"), null, "a tombstoned copy cannot move again");
});

test("store: never-trade classes are refused by class; earned-only kinds may gift", () => {
  const storage = shimStorage();
  const store = Cards.createStore(storage, "testkeeper");
  // A stored copy of a never-tradable class (the First Card's shape):
  const data = {
    counter: 1,
    copies: {
      "first-x": {
        designId: "first-card", instanceId: "first-x", state: "held",
        tradable: false, giftOnly: false,
        lineage: { found: { patternDay: 217, moon: 8, via: "the-meeting" }, keepers: ["the-keeper"], headHash: "abc" }
      }
    },
    byDesign: { "first-card": "first-x" },
    firstSeedPinned: null, firstCardAck: false, declined: {}
  };
  storage.setItem(Cards.STORE_PREFIX + "testkeeper", JSON.stringify(data));
  assert.equal(store.recordTransfer("first-x", "another-keeper"), null, "the First Card's class refuses transfer");
  assert.equal(store.copyFor("first-card").state, "held");

  const kind = store.collect("kind-water", { patternDay: 217, moon: 8, via: "adoption" });
  assert.equal(kind.tradable, false);
  assert.equal(kind.giftOnly, true);
  const gifted = store.recordTransfer(kind.instanceId, "another-keeper");
  assert.ok(gifted && gifted.state === "traded-away", "an earned-only kind may move as a gift");
});

/* ------------------------- the First Card ------------------------- */

test("first card: derives deterministically from a Spark record fixture, never tradable", () => {
  // The conformance fixture from the record: Selor's seed.
  const fixture = { seed: "spark1-8-217-1-iuebk69z" };
  const a = Cards.firstCardFor(fixture, "Selor");
  const b = Cards.firstCardFor(fixture, "Selor");
  assert.deepEqual(a, b, "the same record always derives the same First Card");
  assert.equal(a.kind, "water", "kindIndex 1 is Water in the companion core's order");
  assert.equal(a.moon, 8);
  assert.equal(a.moonName, "Deep Mirror");
  assert.equal(a.patternDay, 217);
  assert.equal(a.class, "first-card");
  assert.equal(a.tradable, false);
  assert.equal(a.state, "held");
  assert.deepEqual([...a.lineage.keepers], ["the-keeper"]);
  assert.equal(a.lineage.found.via, "the-meeting");

  const other = Cards.firstCardFor({ seed: "spark1-8-217-3-proofb02" }, "Other");
  assert.notEqual(other.instanceId, a.instanceId);
  assert.equal(Cards.firstCardFor({ seed: "not-a-seed" }), null);
  assert.equal(Cards.firstCardFor(null), null);
  assert.equal(Cards.FIRST_CARD.tradable, false);
});

/* ------------------------- the match foundation ------------------------- */

test("match codes: passport-family shape, roundtrip, mistyped refused whole", () => {
  const code = Cards.makeMatchCode(20261125);
  assert.match(code, /^CDX1-[0-9A-Z]+-[A-Z]{2}$/);
  assert.equal(Cards.parseMatchCode(code).seed, 20261125);
  const tampered = code.slice(0, -1) + (code.endsWith("A") ? "B" : "A");
  assert.equal(Cards.parseMatchCode(tampered), null);
  assert.equal(Cards.parseMatchCode("SPK1-8-217-1-IUEBK69Z"), null, "a passport is not a match code");
  assert.equal(Cards.deriveMatch(tampered, ["moon-01"], ["moon-02"]), null);
});

test("match: same code + same collections → identical state and hash on both sides", () => {
  const collA = ["moon-08", "kind-water", "word-enosh", "moon-02", "word-nephesh", "kind-fire"];
  const collB = ["moon-01", "kind-fire", "word-or", "moon-05", "word-davar", "kind-light"];
  const code = Cards.makeMatchCode(4242);
  const sideA = Cards.deriveMatch(code, collA, collB, { a: "water", b: "fire" });
  const sideB = Cards.deriveMatch(code, [...collA].reverse(), [...collB].reverse(), { a: "water", b: "fire" });
  assert.deepEqual(sideA, sideB, "collection order does not matter — the hash is over the sorted set");
  assert.equal(Cards.stateHash(sideA), Cards.stateHash(sideB));
  assert.equal(sideA.rootHz, Cards.MOONS[sideA.fieldMoon - 1].freq);
  assert.equal(Cards.collectionHash(collA), Cards.collectionHash([...collA].reverse()));

  const other = Cards.deriveMatch(code, collA, ["moon-03"], { a: "water", b: "fire" });
  assert.notEqual(Cards.stateHash(other), Cards.stateHash(sideA), "a different collection is a different match");
});

test("match: a scripted move sequence lands on the same hash on both sides; a mismatched hash refuses the move", () => {
  const collA = Cards.REGISTRY.slice(0, 14).map((c) => c.id);
  const collB = Cards.REGISTRY.slice(13).map((c) => c.id);
  const code = Cards.makeMatchCode(777);
  let a = Cards.deriveMatch(code, collA, collB, { a: "water", b: "light" });
  let b = Cards.deriveMatch(code, collA, collB, { a: "water", b: "light" });
  assert.equal(Cards.stateHash(a), Cards.stateHash(b));

  // A move presented against a state the other side does not hold is
  // refused whole (§7.2) and changes nothing.
  const refused = Cards.applyPlay(a, { by: a.turn, cardId: a.hands[a.turn][0], expectedHash: "deadbeef" });
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "state-mismatch");

  let steps = 0;
  while (!a.complete && steps < 14) {
    const side = a.turn;
    const cardId = a.hands[side][0];
    if (!cardId) break;
    // The turn code: the move + the hash of the state it was made against.
    const turnCode = { by: side, cardId, expectedHash: Cards.stateHash(a) };
    const ra = Cards.applyPlay(a, turnCode);
    const rb = Cards.applyPlay(b, turnCode);
    assert.equal(ra.ok, true, "step " + steps + " applies on side A");
    assert.equal(rb.ok, true, "step " + steps + " applies on side B");
    a = ra.state; b = rb.state;
    assert.equal(Cards.stateHash(a), Cards.stateHash(b), "hashes agree after step " + steps);
    steps += 1;
  }
  assert.ok(steps >= 4, "the scripted sequence actually played (" + steps + " plays)");
});

/* ------------- the do-better match model (design §5, revised) ------------- */

test("match v2: deck rules — at most 20 instances, short decks legal, inputs never mutated", () => {
  const code = Cards.makeMatchCode(99);
  const big = Cards.REGISTRY.slice(0, 21).map((c) => c.id);
  assert.equal(Cards.deriveMatch(code, big, ["moon-01"]), null, "a 21-card deck is refused");
  const twenty = Cards.REGISTRY.slice(0, 20).map((c) => c.id);
  assert.ok(Cards.deriveMatch(code, twenty, ["moon-01"]), "20 is a legal deck");
  const collA = ["moon-08", "kind-water", "word-enosh"];
  const snapshot = JSON.stringify(collA);
  let s = Cards.deriveMatch(code, collA, ["moon-01", "kind-fire", "word-or"], { a: "water", b: "fire" });
  let guard = 0;
  while (!s.complete && guard++ < 12) {
    const side = s.turn;
    const cardId = s.hands[side][0];
    if (!cardId) break;
    const r = Cards.applyPlay(s, { by: side, cardId, expectedHash: Cards.stateHash(s) });
    assert.equal(r.ok, true);
    s = r.state;
  }
  assert.equal(JSON.stringify(collA), snapshot, "a match never mutates the keeper's collection");
});

test("match v2: the Moon turns every fourth round — rotation and announcement derive from plays alone", () => {
  const fresh = { plays: 0, sky: { rootMoon: 5 } };
  assert.equal(Cards.effectiveMoon(fresh), 5);
  const info = Cards.moonTurnInfo(fresh);
  assert.equal(info.offset, 0);
  assert.equal(info.effectiveMoon, 5);
  assert.equal(info.playsUntilTurn, 8);
  assert.equal(info.announced, false);
  const soon = { plays: 6, sky: { rootMoon: 5 } };
  assert.equal(Cards.moonTurnInfo(soon).announced, true, "the turn is announced one round ahead");
  assert.equal(Cards.moonTurnInfo(soon).playsUntilTurn, 2);
  const turned = { plays: 8, sky: { rootMoon: 5 } };
  assert.equal(Cards.effectiveMoon(turned), 6, "after the turn, affinities answer to the next Moon");
  assert.equal(Cards.effectiveMoon({ plays: 8 * 12, sky: { rootMoon: 5 } }), 4, "rotation wraps the thirteen");
});

test("match v2: the shared sky shifts identically on both sides as cards sound into it", () => {
  const code = Cards.makeMatchCode(31337);
  const collA = Cards.REGISTRY.slice(0, 14).map((c) => c.id);
  const collB = Cards.REGISTRY.slice(13).map((c) => c.id);
  let a = Cards.deriveMatch(code, collA, collB, { a: "water", b: "light" });
  let b = Cards.deriveMatch(code, collA, collB, { a: "water", b: "light" });
  assert.deepEqual(a.skyStream, b.skyStream, "the sky's refill stream derives from the match seed");
  assert.equal(a.sky.rootMoon, a.fieldMoon, "the sky opens on the match's Moon");
  let steps = 0;
  while (!a.complete && steps < 10) {
    const side = a.turn;
    const cardId = a.hands[side][0];
    if (!cardId) break;
    const play = { by: side, cardId, expectedHash: Cards.stateHash(a) };
    const ra = Cards.applyPlay(a, play);
    const rb = Cards.applyPlay(b, play);
    assert.equal(ra.ok && rb.ok, true);
    a = ra.state; b = rb.state;
    assert.deepEqual(a.sky, b.sky, "sky state identical after play " + steps);
    assert.equal(Cards.stateHash(a), Cards.stateHash(b));
    steps += 1;
  }
  assert.ok(a.sky.sounded > 0, "cards sounded into the sky (" + a.sky.sounded + ")");
});

test("match v2: dissonance hangs in the sky and is gathered by its re-tune — banked, capped, sky refilled", () => {
  const code = Cards.makeMatchCode(777);
  const collA = Cards.REGISTRY.slice(0, 14).map((c) => c.id);
  const collB = Cards.REGISTRY.slice(13).map((c) => c.id);
  let s = Cards.deriveMatch(code, collA, collB, { a: "water", b: "light" });
  // Play honestly until some card dims into the sky (deterministic).
  let guard = 0;
  while (s.sky.dissonance.length === 0 && !s.complete && guard++ < 14) {
    const side = s.turn;
    const cardId = s.hands[side][0];
    if (!cardId) break;
    s = Cards.applyPlay(s, { by: side, cardId, expectedHash: Cards.stateHash(s) }).state;
  }
  assert.ok(s.sky.dissonance.length > 0, "a dissonant card hangs in the sky");
  const dimmedId = s.sky.dissonance[0];
  const dimmed = Cards.cardById(dimmedId);
  // Either keeper may gather: pass honestly until the side to act
  // holds the dimmed card's re-tune.
  let side = null;
  let retune = null;
  for (let attempt = 0; attempt < 8 && !retune; attempt++) {
    const t = s.turn;
    const found = s.hands[t].find((id) => {
      const c = Cards.cardById(id);
      return c.element === dimmed.element || c.moonAffinity.some((m) => dimmed.moonAffinity.includes(m));
    });
    if (found) { side = t; retune = found; break; }
    const filler = s.hands[t][0];
    if (!filler || s.complete) break;
    s = Cards.applyPlay(s, { by: t, cardId: filler, expectedHash: Cards.stateHash(s) }).state;
  }
  assert.ok(retune, "a re-tune for the sky's dissonance reaches a hand");
  const streamBefore = s.skyStreamIndex;
  const r = Cards.applyPlay(s, { by: side, cardId: retune, gather: dimmedId, expectedHash: Cards.stateHash(s) });
  assert.equal(r.ok, true, "the gather applies");
  assert.equal(r.event, "gathered");
  assert.equal(r.state.gathered[side], 1, "the dissonance is banked");
  assert.ok(!r.state.sky.dissonance.includes(dimmedId), "the gathered card leaves the sky");
  assert.equal(r.state.skyStreamIndex, streamBefore + 1, "the sky refills from the match seed");

  // A gather that is not the card's re-tune is refused; a full bank refuses too.
  const crafted = JSON.parse(JSON.stringify(r.state));
  crafted.sky.dissonance = [dimmedId];
  crafted.gathered[crafted.turn] = Cards.GATHER_CAP;
  crafted.light[crafted.turn] = 5;
  crafted.hands[crafted.turn] = ["moon-" + String(dimmed.moonAffinity[0]).padStart(2, "0")];
  const full = Cards.applyPlay(crafted, {
    by: crafted.turn, cardId: crafted.hands[crafted.turn][0], gather: dimmedId,
    expectedHash: Cards.stateHash(crafted)
  });
  assert.equal(full.ok, false);
  assert.equal(full.reason, "bank-full", "hoarding cannot stall the match — the bank is capped");
});

test("match v2: the Call doubles a sounded note's resonance; a missed call costs nothing", () => {
  const code = Cards.makeMatchCode(4242);
  const collA = ["moon-08", "kind-water", "word-enosh", "moon-02", "word-nephesh", "kind-fire"];
  const collB = ["moon-01", "kind-fire", "word-or", "moon-05", "word-davar", "kind-light"];
  // Craft the table: a's hand holds Moon 8's card and the sky answers
  // to Moon 8, so the card sounds by its home Moon.
  const s0 = JSON.parse(JSON.stringify(Cards.deriveMatch(code, collA, collB, { a: "water", b: "fire" })));
  s0.turn = "a";
  s0.sky.rootMoon = 8;
  s0.plays = 0;
  s0.hands.a = ["moon-08"];
  const moonNow = 8;
  const side = "a";
  const moonCardId = "moon-08";
  const plain = Cards.applyPlay(s0, { by: side, cardId: moonCardId, expectedHash: Cards.stateHash(s0) });
  const called = Cards.applyPlay(s0, { by: side, cardId: moonCardId, callMoon: moonNow, expectedHash: Cards.stateHash(s0) });
  assert.equal(plain.event, "sounded");
  assert.equal(called.event, "called-and-sounded");
  assert.equal(called.gained, plain.gained * 2, "the called note's resonance doubles");
  const missed = Cards.applyPlay(s0, { by: side, cardId: moonCardId, callMoon: (moonNow % 13) + 1, expectedHash: Cards.stateHash(s0) });
  assert.equal(missed.gained, plain.gained, "a missed call loses only the bonus");
  assert.equal(missed.state.light[side], plain.state.light[side], "a missed call costs no light");
});

test("match v2: the First Card is the deck's heart — wild harmony once, never twice, only with a Spark", () => {
  const code = Cards.makeMatchCode(555);
  const s0 = Cards.deriveMatch(code, ["moon-08", "kind-water"], ["moon-01", "kind-fire"], { a: "water", b: "fire" });
  const side = s0.turn;
  const r = Cards.applyPlay(s0, { by: side, cardId: "first-card", expectedHash: Cards.stateHash(s0) });
  assert.equal(r.ok, true);
  assert.equal(r.event, "heart");
  assert.ok(r.state.fields[side].includes("first-card"), "the heart sounds in its keeper's own field");
  assert.equal(r.state.hearts[side].used, true);
  // The other keeper's heart is their own (it answers for fire)…
  const other = Cards.applyPlay(r.state, { by: "b", cardId: "first-card", expectedHash: Cards.stateHash(r.state) });
  assert.equal(other.ok, true, "each keeper's heart is their own");
  // …but a heart once played cannot be played again.
  const again = Cards.applyPlay(other.state, { by: side, cardId: "first-card", expectedHash: Cards.stateHash(other.state) });
  assert.equal(again.ok, false);
  assert.equal(again.reason, "heart-spent");
  const noSpark = Cards.deriveMatch(code, ["moon-08"], ["moon-01"], {});
  const refused = Cards.applyPlay(noSpark, { by: noSpark.turn, cardId: "first-card", expectedHash: Cards.stateHash(noSpark) });
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "no-heart", "no Spark at the table, no heart to play");
});

test("match v2: a triad across two Moons waits for gathered dissonance, then locks and pays", () => {
  const code = Cards.makeMatchCode(2024);
  let s = Cards.deriveMatch(code, ["moon-05"], ["moon-02"], { a: null, b: null });
  // Craft the table: Moon 5's Moon card and Word already sound in a's
  // field; the sky answers to Moon 7 — the other Aether Moon, so Moon
  // 5's kindred Kind (Light) still sounds, but Moon 5's triad completes
  // across two Moons. a holds Light in hand.
  s = JSON.parse(JSON.stringify(s));
  s.turn = "a";
  s.sky.rootMoon = 7;
  s.plays = 0;
  s.fields.a = ["moon-05", "word-davar"];
  s.hands.a = ["kind-light"];
  s.light.a = 7;
  const hash = Cards.stateHash(s);
  const waiting = Cards.applyPlay(s, { by: "a", cardId: "kind-light", expectedHash: hash });
  assert.equal(waiting.ok, true);
  assert.equal(waiting.event, "triad-waits", "without gathered dissonance the cross-Moon triad cannot lock");
  assert.equal(waiting.state.lockedTriads.a.length, 0);

  const funded = JSON.parse(JSON.stringify(s));
  funded.gathered.a = Cards.CROSS_TRIAD_COST;
  const locked = Cards.applyPlay(funded, { by: "a", cardId: "kind-light", expectedHash: Cards.stateHash(funded) });
  assert.equal(locked.event, "triad");
  assert.equal(locked.triadMoon, 5);
  assert.equal(locked.state.gathered.a, 0, "the gathered dissonance is spent, not kept");
  assert.equal(locked.state.lockedTriads.a.length, 1);
  assert.equal(locked.state.lockedTriads.a[0], 5);
  assert.ok(locked.state.locked.a.includes("moon-05") && locked.state.locked.a.includes("word-davar")
    && locked.state.locked.a.includes("kind-light"), "the three lock as attuned in the keeper's own field");
});

test("match v2: solo — the daily table is the same for everyone, and the field's answer is deterministic", () => {
  const t1 = Cards.dailyTable(224);
  const t2 = Cards.dailyTable(224);
  assert.deepEqual(t1, t2, "same Pattern Day, same table");
  assert.equal(t1.length, 12);
  assert.notDeepEqual(Cards.dailyTable(225), t1, "a new day deals a new table");
  const code = Cards.makeMatchCode(224);
  const keeperDeck = ["moon-08", "kind-water", "word-enosh", "moon-02", "word-nephesh", "kind-fire", "moon-05"];
  let s = Cards.deriveMatch(code, keeperDeck, t1, { a: "water", b: null });
  let twin = Cards.deriveMatch(code, keeperDeck, t1, { a: "water", b: null });
  // The keeper plays; the field answers; both replicas agree throughout.
  let rounds = 0;
  while (!s.complete && rounds < 6) {
    const mine = { by: "a", cardId: s.hands.a[0], expectedHash: Cards.stateHash(s) };
    if (!mine.cardId) break;
    const r1 = Cards.applyPlay(s, mine);
    const r2 = Cards.applyPlay(twin, mine);
    assert.equal(r1.ok && r2.ok, true);
    s = r1.state; twin = r2.state;
    if (s.complete) break;
    const answer = Cards.fieldAnswer(s);
    assert.deepEqual(answer, Cards.fieldAnswer(twin), "the field's answer derives from the state alone");
    if (!answer) break;
    const a1 = Cards.applyPlay(s, answer);
    const a2 = Cards.applyPlay(twin, answer);
    assert.equal(a1.ok && a2.ok, true, "the field's answer applies");
    s = a1.state; twin = a2.state;
    assert.equal(Cards.stateHash(s), Cards.stateHash(twin), "solo replicas never drift");
    rounds += 1;
  }
  assert.ok(rounds >= 2, "the solo exchange actually ran (" + rounds + " rounds)");
});

test("album interactivity (design §13): tap sounds and turns, hold shows lineage, held cards brighten — silhouettes never glow", () => {
  const album = read("docs/assets/js/codex-card-album.js");
  const css = read("docs/assets/css/codex-cards.css");
  assert.match(album, /function soundCard\(card\)/, "a tap sounds the card's own hum");
  assert.match(album, /card\.hum\.hz/, "frequency cards sound their Hz from the record");
  assert.match(album, /speakWord/, "a Word card speaks its word");
  assert.match(album, /function wireHold\(tile, panel\)/, "hold-for-lineage is wired");
  assert.match(album, /600/, "the hold is a deliberate press");
  assert.match(album, /function lineagePanel\(card, copy\)/, "the lineage panel reads the copy's real chain");
  assert.match(album, /fromCivilDate/, "faces are computed from the real day (PatternCalendar)");
  assert.match(album, /codex-card--set-complete/, "a completed set brightens its held cards");
  assert.match(album, /namedTriads\(\)/, "a completed triad brightens its held cards");
  assert.match(album, /heldIds\[t\.moon\] && heldIds\[t\.word\] && heldIds\[t\.kind\]/,
    "brightening is gated on the cards being HELD — a missing silhouette can never glow");
  assert.match(css, /\.codex-card--set-complete/, "the brightening is styled");
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*codex-card__face--kindred-motion \{ animation: none/,
    "reduced motion stills the kind's motion; states still change");
});

test("artwork window: art is derived from each card's own record — deterministic, distinct, self-contained", () => {
  const moon = Cards.cardById("moon-08");
  const a = Cards.cardArtSVG(moon);
  assert.equal(Cards.cardArtSVG(moon), a, "the same card draws the same sky on every device");
  assert.ok(a.startsWith("<svg"), "the art is an inline drawing, not an external image");
  assert.ok(!/https?:|<image|url\(http/.test(a), "no external reference is ever fetched");
  assert.ok(a.includes(moon.art.palette[1]), "a Moon's art is drawn in its element palette");
  assert.notEqual(Cards.cardArtSVG(Cards.cardById("moon-01")), a, "each Moon's phase in the thirteen differs");
  const word = Cards.cardArtSVG(Cards.cardById("word-ruach"));
  assert.ok(word.includes("רוּחַ"), "a Word's artwork window carries the word itself");
  const kind = Cards.cardById("kind-water");
  assert.notEqual(Cards.cardArtSVG(kind, { hue: 200 }), Cards.cardArtSVG(kind),
    "a seed-variant Kind's orb answers its keeper's hue");
  assert.notEqual(Cards.cardArtSVG(moon, { dim: true }), a, "the silhouette a missing card wears is its own dim drawing");
  const fc = Cards.firstCardFor({ seed: "spark1-8-217-1-iuebk69z" }, "Selor");
  const firstArt = Cards.firstCardArtSVG(fc);
  assert.ok(firstArt.startsWith("<svg") && !/https?:|<image/.test(firstArt), "the First Card's art is derived the same way");
  assert.equal(Cards.firstCardArtSVG(fc), firstArt, "the First Card's art is deterministic");
});

test("album faces (Aaron, Nov 25 2026): cards wear a trading card's anatomy — banner, art window, stamps, flip in frame", () => {
  const album = read("docs/assets/js/codex-card-album.js");
  const css = read("docs/assets/css/codex-cards.css");
  assert.match(album, /tcard__banner/, "a name banner heads the card");
  assert.match(album, /tcard__art/, "an artwork window sits under the banner");
  assert.match(album, /Cards\.cardArtSVG\(card/, "the window is filled from the card's own record");
  assert.match(album, /rarityMark\(card\)/, "kind and rarity marks ride the banner");
  assert.match(album, /setNumber\(card\)/, "set name and card number are read from the registry");
  assert.match(album, /foundStamp\(copy\)/, "the found stamp is read from the copy's real record");
  assert.match(album, /"Moon " \+ f\.moon/, "the found stamp names the Moon it was found in, from the record");
  assert.match(album, /" · PD " \+ \(f\.patternDay/, "the found stamp names the Pattern Day it was found, from the record");
  assert.match(album, /silhouetteFace\(card/, "uncollected cards stand as silhouettes of the same frame");
  assert.match(album, /\{ dim: true \}/, "a silhouette's art is the dim drawing, never a lit face");
  assert.match(album, /Never tradable/, "the First Card is sealed never-tradable on its face");
  assert.match(album, /Cards\.firstCardArtSVG\(fc\)/, "the First Card's window is its Spark's orb");
  assert.match(css, /\.tcard__inner \{[^}]*aspect-ratio: 5 \/ 7/, "the frame is a portrait trading card");
  assert.match(css, /\.codex-card\.is-game \.tcard__inner \{ transform: rotateY\(180deg\); \}/,
    "the card turns over inside its own frame");
  assert.match(css, /backface-visibility: hidden/, "each face is a real side of the card");
});

/* ------------------------- page wiring ------------------------- */

test("wiring: the find flow rides the three real surfaces; the album stands", () => {
  const moons = read("docs/moons.html");
  const dayNotesAt = moons.indexOf("day-notes.js");
  assert.ok(moons.indexOf("codex-cards.js", dayNotesAt) > dayNotesAt, "moons.html loads the registry after Day Notes");
  assert.ok(moons.indexOf("codex-cards-layer.js", dayNotesAt) > dayNotesAt, "moons.html loads the find layer");

  const companions = read("docs/companions.html");
  assert.ok(companions.includes("codex-cards.js"), "companions.html loads the registry");
  assert.ok(companions.includes("codex-cards-layer.js"), "companions.html loads the find layer");
  assert.ok(companions.includes("card-album.html"), "companions.html doors to the album");

  for (const word of Cards.WORDS) {
    if (word.slug === "davar") continue;
    const page = read("docs/scripture/word-studies/" + word.slug + ".html");
    assert.ok(page.includes("codex-cards.js"), word.slug + " loads the registry");
    assert.ok(page.includes("codex-cards-layer.js"), word.slug + " loads the find layer");
  }

  const album = read("docs/card-album.html");
  assert.ok(album.includes("codex-card-album.js"), "the album page loads its renderer");
  assert.ok(album.includes("codex-cards.js"), "the album page loads the registry");
});
