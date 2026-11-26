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
