/*
 * The Codex Card System — registry, collection, and the deterministic
 * match foundation.
 *
 * Design: ~/workspace/your_files/codex-card-system-design-2026-11-25.md
 * (Aaron's commission, Nov 25, 2026: cards placed all around the site,
 * found through real engagement, collected in an album in the Hearth;
 * a resonance game designed FIRST so the cards' fields serve it and no
 * card is ever reissued; same-room play by match + turn codes with no
 * connection; trading by passport-style codes, keeper to keeper).
 *
 * This module is the data + rules core. It holds:
 *   - the card registry (the first 27 designs: 13 Moons, 8 Words,
 *     6 Kinds), every field derived from the record — Moon frequencies
 *     from PatternCalendarData, Word motifs from the studies, Kind
 *     frequencies by the paper's stated derivation — never invented;
 *   - the First Card class (a special instance derived deterministically
 *     from a keeper's Spark record; earned/keepsake; never tradable);
 *   - the collection store: instances with lineage chains and
 *     head-hashes, tombstones for traded-away copies;
 *   - the match foundation: match codes in the passport family, a
 *     deterministic initial state from a code + two collection hashes,
 *     and a state hash both sides verify before a move applies (§7 of
 *     the design). The game itself is designed, not built; this is its
 *     proven root.
 *
 * Pure and storage-injected: the browser layer passes a localStorage-like
 * object; tests pass a shim. No DOM in here.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.CodexCards = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ------------------------- small hashes ------------------------- */

  // FNV-1a 32-bit — the same hash family the companion core uses
  // (SparkCompanion.hashString is a sibling implementation).
  function hashString(str) {
    let h = 0x811c9dc5;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function hash36(str) {
    return hashString(str).toString(36);
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Canonical JSON: object keys sorted recursively, so two devices
  // holding the same state produce the same string — and the same hash.
  function canonical(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    const keys = Object.keys(value).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  }

  function stateHash(state) {
    return hash36(canonical(state));
  }

  /* ------------------------- the record's data ------------------------- */

  // The Thirteen Moons, from PatternCalendarData (the calendar's own
  // record — tests pin this table against pattern-calendar-data.js).
  const MOONS = [
    { idx: 1, name: "Seed Flame", element: "Fire", freq: 144, essence: "Beginning, ignition, first witness" },
    { idx: 2, name: "Root Waters", element: "Water", freq: 432, essence: "Memory, cleansing, emotional ground" },
    { idx: 3, name: "Breath Gate", element: "Air", freq: 369, essence: "Word, air, signal, exchange" },
    { idx: 4, name: "Stone Witness", element: "Earth", freq: 174, essence: "Body, structure, faithful record" },
    { idx: 5, name: "Living Word", element: "Aether", freq: 528, essence: "Speech, vow, creative command" },
    { idx: 6, name: "Fire Trial", element: "Fire", freq: 417, essence: "Testing, courage, purification" },
    { idx: 7, name: "Crown Balance", element: "Aether", freq: 963, essence: "Completion, justice, centered rule" },
    { idx: 8, name: "Deep Mirror", element: "Water", freq: 396, essence: "Reflection, hidden pattern, inner waters" },
    { idx: 9, name: "Return Path", element: "Earth", freq: 285, essence: "Restoration, repentance, spiral home" },
    { idx: 10, name: "Builder’s Hand", element: "Earth", freq: 741, essence: "Craft, repair, stewardship" },
    { idx: 11, name: "Star Remembrance", element: "Air", freq: 852, essence: "Inheritance, names, celestial memory" },
    { idx: 12, name: "River of Signs", element: "Water", freq: 639, essence: "Movement, omens, living flow" },
    { idx: 13, name: "Completion Seal", element: "Aether", freq: 111, essence: "Harvest, sealing, preparation for reset" }
  ];

  // The eight studied words, from their studies (Hebrew, transliteration,
  // Strong's number, gloss — the study pages' own data; tests pin the
  // Hebrew + transliteration against the live study pages).
  // homeMoon + ground: the design paper §5.2 table (Aaron's to amend).
  const WORDS = [
    { slug: "or", hebrew: "אוֹר", translit: "or", strongs: "H216", gloss: "light", homeMoon: 1, ground: "Day-one light against “beginning, ignition, first witness”" },
    { slug: "adam", hebrew: "אָדָם", translit: "adam", strongs: "H120", gloss: "man, humankind", homeMoon: 4, ground: "The formed body; Genesis 1–5 worked sense by sense, the faithful record" },
    { slug: "adamah", hebrew: "אֲדָמָה", translit: "adamah", strongs: "H127", gloss: "ground, land", homeMoon: 9, ground: "The study's own arc is curse-and-lifting, Genesis 3 to 8 — restoration, return" },
    { slug: "enosh", hebrew: "אֱנוֹשׁ", translit: "enosh", strongs: "H582", gloss: "man as mortal", homeMoon: 8, ground: "Mortality faced in reflection — hidden pattern, inner waters" },
    { slug: "ruach", hebrew: "רוּחַ", translit: "ruach", strongs: "H7307", gloss: "wind, breath, spirit", homeMoon: 3, ground: "Breath itself against “word, air, signal, exchange”" },
    { slug: "nephesh", hebrew: "נֶפֶשׁ", translit: "nephesh", strongs: "H5315", gloss: "life, being, self", homeMoon: 2, ground: "The seat of appetite and feeling against “memory, emotional ground”" },
    { slug: "shem", hebrew: "שֵׁם", translit: "shem", strongs: "H8034", gloss: "name, reputation, the Name", homeMoon: 11, ground: "“Remember names, lineage, signs, and the long story”" },
    { slug: "davar", hebrew: "דָּבָר", translit: "davar", strongs: "H1697", gloss: "word, thing, matter", homeMoon: 5, ground: "The Word itself against “speech, vow, creative command”" }
  ];

  // The six kinds, from the companion core (id, name, temperament, line,
  // hue range — tests pin against spark-companion.js's KINDS).
  const KINDS = [
    { id: "fire", name: "Fire", temperament: "bold", line: "Quick to start, warm to sit beside.", hues: [14, 38] },
    { id: "water", name: "Water", temperament: "gentle", line: "Calm on the surface, deep underneath.", hues: [188, 214] },
    { id: "shadow", name: "Shadow", temperament: "quiet", line: "Notices what the light walks past.", hues: [258, 286] },
    { id: "air", name: "Air", temperament: "curious", line: "Always halfway to the next question.", hues: [168, 196] },
    { id: "earth", name: "Earth", temperament: "steady", line: "Slow to move, hard to shake.", hues: [84, 128] },
    { id: "light", name: "Light", temperament: "bright", line: "First up, and glad about it.", hues: [42, 56] }
  ];

  /* ------------------------- game derivations ------------------------- */

  // The kindred table (design §5.2): a Moon's element and the Kinds that
  // harmonize with it. Aether kindred with Light and Shadow.
  const KINDRED = { Fire: ["fire"], Water: ["water"], Air: ["air"], Earth: ["earth"], Aether: ["light", "shadow"] };
  const KIND_ELEMENT = { fire: "Fire", water: "Water", shadow: "Aether", air: "Air", earth: "Earth", light: "Aether" };

  function kindredMoonsForKind(kindId) {
    return MOONS.filter((m) => (KINDRED[m.element] || []).includes(kindId)).map((m) => m.idx);
  }

  function firstKindredMoon(kindId) {
    // The paper's stated derivation: a Kind sounds the first Moon of its
    // kindred element — except Shadow, which takes the second Aether
    // Moon so Light (Moon 5) and Shadow (Moon 7) sound differently.
    const moons = kindredMoonsForKind(kindId);
    if (kindId === "shadow") return moons[1];
    return moons[0];
  }

  // Resonance (design §6): the consonance class of a frequency against
  // the root tone 432 Hz, folded by octaves into one octave and read
  // against the interval table — unison/octave 3, fifth/fourth 2,
  // major third/sixth 1, else 0. Tolerance 1.5%.
  const ROOT_HZ = 432;
  const INTERVALS = [ [1.0, 3], [1.5, 2], [4 / 3, 2], [1.25, 1], [5 / 3, 1], [2.0, 3] ];
  function resonanceForHz(hz) {
    if (!hz || !(hz > 0)) return 0;
    let r = hz / ROOT_HZ;
    while (r >= 2) r /= 2;
    while (r < 1) r *= 2;
    for (const [target, value] of INTERVALS) {
      if (Math.abs(r - target) / target <= 0.015) return value;
    }
    return 0;
  }

  // A word's resonance is its Hebrew letter count, capped at 3 — a word
  // sounds as many beats as it has letters (design §6). Counts base
  // letters only (nikkud and cantillation are not letters; final forms
  // are letters).
  function hebrewLetterCount(hebrew) {
    return [...String(hebrew)].filter((ch) => /[\u05D0-\u05EA]/.test(ch)).length;
  }

  const ELEMENT_PALETTES = {
    Fire: ["#2a1408", "#d99545"],
    Water: ["#07182b", "#3f8fae"],
    Air: ["#10201c", "#9fd8c9"],
    Earth: ["#171a10", "#a8b06a"],
    Aether: ["#170f2e", "#c9b8ff"]
  };

  const EDITION = { name: "First Edition", window: "Founding Pattern Year" };

  /* ------------------------- the registry ------------------------- */

  function buildRegistry() {
    const cards = [];

    for (const moon of MOONS) {
      cards.push({
        id: "moon-" + String(moon.idx).padStart(2, "0"),
        set: "moons",
        name: moon.name,
        sub: "Moon " + moon.idx + " of 13",
        essence: moon.essence,
        art: { palette: ELEMENT_PALETTES[moon.element], motif: "moon-" + moon.idx, hue: null },
        home: { page: "moons.html", act: "witness-day", moon: moon.idx },
        rarity: "moon-window",
        edition: { ...EDITION },
        element: moon.element,
        hum: { hz: moon.freq },
        moonAffinity: [moon.idx],
        resonance: resonanceForHz(moon.freq),
        retune: { by: ["element:" + moon.element, "moon:" + moon.idx] },
        playCost: { light: 1 },
        gameRole: "anchor",
        tradable: true,
        seedVariant: false
      });
    }

    for (const word of WORDS) {
      const homeMoon = MOONS[word.homeMoon - 1];
      const beats = hebrewLetterCount(word.hebrew);
      cards.push({
        id: "word-" + word.slug,
        set: "words",
        name: word.hebrew + " · " + word.translit,
        sub: word.gloss + " · " + word.strongs,
        essence: word.ground,
        art: { palette: ELEMENT_PALETTES[homeMoon.element], motif: "word-" + word.slug, hue: null },
        home: { page: "scripture/word-studies/" + word.slug + ".html", act: "hear-the-word", moon: word.homeMoon },
        rarity: "common",
        edition: { ...EDITION },
        element: homeMoon.element,
        hum: { motif: word.translit, beats, hebrew: word.hebrew },
        moonAffinity: [word.homeMoon],
        resonance: Math.min(beats, 3),
        retune: { by: ["element:" + homeMoon.element, "moon:" + word.homeMoon] },
        playCost: { light: 1 },
        gameRole: "voice",
        tradable: true,
        seedVariant: false,
        word: { hebrew: word.hebrew, translit: word.translit, strongs: word.strongs, gloss: word.gloss }
      });
    }

    for (const kind of KINDS) {
      const moons = kindredMoonsForKind(kind.id);
      const soundMoon = MOONS[firstKindredMoon(kind.id) - 1];
      cards.push({
        id: "kind-" + kind.id,
        set: "kinds",
        name: kind.name,
        sub: "The " + kind.name + " kind · " + kind.temperament,
        essence: kind.line,
        art: { palette: ELEMENT_PALETTES[KIND_ELEMENT[kind.id]], motif: "kind-" + kind.id, hueRange: kind.hues },
        home: { page: "companions.html", act: "adoption", moon: null },
        rarity: "earned-only",
        edition: { ...EDITION },
        element: KIND_ELEMENT[kind.id],
        hum: { hz: soundMoon.freq, derivedFrom: "moon-" + String(soundMoon.idx).padStart(2, "0") },
        moonAffinity: moons,
        resonance: resonanceForHz(soundMoon.freq),
        retune: { by: ["element:" + KIND_ELEMENT[kind.id]].concat(moons.map((m) => "moon:" + m)) },
        playCost: { light: 1 },
        gameRole: "sound",
        tradable: false, // earned-only: giftable under the trade protocol, never a priced sale (design §8)
        giftOnly: true,
        seedVariant: true,
        kind: { id: kind.id, temperament: kind.temperament, line: kind.line }
      });
    }

    // Harmony keys, computed from the kindred + home-Moon tables (§5.2):
    // a Moon duets with its kindred Kinds and triads with its home Word;
    // a Word triads with its home Moon and that Moon's kindred Kinds;
    // a Kind duets with its kindred Moons and triads with their words.
    const byId = new Map(cards.map((c) => [c.id, c]));
    const homeWordByMoon = new Map(WORDS.map((w) => [w.homeMoon, "word-" + w.slug]));
    for (const card of cards) {
      const keys = new Set();
      if (card.set === "moons") {
        const moon = MOONS[card.moonAffinity[0] - 1];
        for (const k of KINDRED[moon.element]) keys.add("kind-" + k);
        if (homeWordByMoon.has(moon.idx)) keys.add(homeWordByMoon.get(moon.idx));
      } else if (card.set === "words") {
        const moonIdx = card.moonAffinity[0];
        keys.add("moon-" + String(moonIdx).padStart(2, "0"));
        for (const k of KINDRED[MOONS[moonIdx - 1].element]) keys.add("kind-" + k);
      } else if (card.set === "kinds") {
        for (const m of card.moonAffinity) {
          keys.add("moon-" + String(m).padStart(2, "0"));
          if (homeWordByMoon.has(m)) keys.add(homeWordByMoon.get(m));
        }
      }
      card.harmonyKeys = [...keys].filter((id) => byId.has(id)).sort();
    }

    return cards;
  }

  const REGISTRY = buildRegistry();
  const CARDS_BY_ID = new Map(REGISTRY.map((c) => [c.id, c]));

  function cardById(id) {
    return CARDS_BY_ID.get(id) || null;
  }

  // A triad closes when the three cards are a Moon, its home Word, and
  // one of its kindred Kinds — mechanically, each names the other two
  // among its harmony keys (design §5.2; the tests prove every triad
  // the table names actually closes).
  function triadCloses(moonId, wordId, kindId) {
    const moon = cardById(moonId), word = cardById(wordId), kind = cardById(kindId);
    if (!moon || !word || !kind) return false;
    if (moon.set !== "moons" || word.set !== "words" || kind.set !== "kinds") return false;
    return moon.harmonyKeys.includes(wordId) && moon.harmonyKeys.includes(kindId)
      && word.harmonyKeys.includes(moonId) && word.harmonyKeys.includes(kindId)
      && kind.harmonyKeys.includes(moonId) && kind.harmonyKeys.includes(wordId);
  }

  function namedTriads() {
    const out = [];
    for (const word of WORDS) {
      const moonId = "moon-" + String(word.homeMoon).padStart(2, "0");
      for (const k of KINDRED[MOONS[word.homeMoon - 1].element]) {
        out.push({ moon: moonId, word: "word-" + word.slug, kind: "kind-" + k });
      }
    }
    return out;
  }

  /* ------------------------- the First Card ------------------------- */

  // The First Card (design §4.1): a special instance class, generated
  // from the keeper's real Spark record at the meeting. Deterministic —
  // the same record always derives the same First Card. Its seed parse
  // follows the passport family shape (spark1-<moon>-<patternDay>-
  // <kindIndex>-<check>); the companion core is the seed's authority,
  // this is a read-only derivation from the same string.
  const FIRST_CARD = {
    id: "first-card",
    set: "first",
    rarity: "earned-only",
    class: "first-card",
    tradable: false,
    giftOnly: false,
    edition: { ...EDITION },
    playCost: { light: 1 },
    gameRole: "keepsake"
  };

  function parseSparkSeed(seed) {
    if (typeof seed !== "string") return null;
    const parts = seed.split("-");
    if (parts.length < 5 || parts[0] !== "spark1") return null;
    const moon = Number(parts[1]);
    const patternDay = Number(parts[2]);
    const kindIndex = Number(parts[3]);
    if (!Number.isInteger(moon) || moon < 1 || moon > 13) return null;
    if (!Number.isInteger(patternDay) || patternDay < 1 || patternDay > 366) return null;
    if (!Number.isInteger(kindIndex) || kindIndex < 0 || kindIndex >= KINDS.length) return null;
    return { moon, patternDay, kindIndex };
  }

  function firstCardFor(record, sparkName) {
    if (!record || typeof record.seed !== "string") return null;
    const parsed = parseSparkSeed(record.seed);
    if (!parsed) return null;
    const kind = KINDS[parsed.kindIndex];
    const moon = MOONS[parsed.moon - 1];
    const instanceId = "first-" + hash36("first-card:" + record.seed);
    const found = { patternDay: parsed.patternDay, moon: parsed.moon, via: "the-meeting" };
    const headHash = hash36(canonical({ instance: instanceId, found, keepers: ["the-keeper"] }));
    return {
      designId: FIRST_CARD.id,
      class: FIRST_CARD.class,
      instanceId,
      name: "The First Card",
      sparkName: sparkName || null,
      kind: kind.id,
      kindName: kind.name,
      moon: parsed.moon,
      moonName: moon.name,
      patternDay: parsed.patternDay,
      hueRange: kind.hues,
      seedVariant: true,
      tradable: false,
      state: "held",
      lineage: { found, keepers: ["the-keeper"], headHash }
    };
  }

  /* ------------------------- the collection store ------------------------- */

  const STORE_PREFIX = "sof.cards.v1.";

  function keeperKeyForSeed(seed) {
    return seed ? "k" + hash36("keeper:" + seed) : "guest";
  }

  function emptyCollection() {
    return { counter: 0, copies: {}, byDesign: {}, firstSeedPinned: null, firstCardAck: false, declined: {} };
  }

  // Storage is injected: anything with getItem/setItem (localStorage or
  // a test shim). The store is keyed per keeper (design §4).
  function createStore(storage, keeperKey) {
    const key = STORE_PREFIX + keeperKey;
    function load() {
      try {
        const raw = storage.getItem(key);
        if (!raw) return emptyCollection();
        const data = JSON.parse(raw);
        if (!data || typeof data !== "object" || !data.copies) return emptyCollection();
        return Object.assign(emptyCollection(), data);
      } catch {
        return emptyCollection();
      }
    }
    function save(data) {
      try { storage.setItem(key, JSON.stringify(data)); } catch { /* the album rests */ }
    }

    function lineageHead(instanceId, found, keepers) {
      return hash36(canonical({ instance: instanceId, found, keepers }));
    }

    return {
      keeperKey,
      load,
      // Find a card: one copy per design (design §4). Collecting an
      // already-held design returns the existing copy — never a
      // duplicate. Traded-away copies stay as tombstones and are NOT
      // silently re-minted by a repeat find of the same design in this
      // slice (a design found again after parting is the trade
      // protocol's chapter, not the find flow's).
      collect(designId, found) {
        const design = cardById(designId);
        if (!design) return null;
        const data = load();
        if (data.byDesign[designId]) {
          return data.copies[data.byDesign[designId]] || null;
        }
        data.counter += 1;
        const instanceId = "cx" + hash36(keeperKey + ":" + designId + ":" + data.counter);
        const foundRecord = {
          patternDay: found && Number.isInteger(found.patternDay) ? found.patternDay : null,
          moon: found && Number.isInteger(found.moon) ? found.moon : (design.home.moon || null),
          via: found && found.via ? String(found.via) : design.home.act
        };
        const copy = {
          designId,
          instanceId,
          state: "held",
          tradable: design.tradable,
          giftOnly: !!design.giftOnly,
          lineage: {
            found: foundRecord,
            keepers: ["the-keeper"],
            headHash: lineageHead(instanceId, foundRecord, ["the-keeper"])
          }
        };
        data.copies[instanceId] = copy;
        data.byDesign[designId] = instanceId;
        save(data);
        return copy;
      },
      // A recorded transfer event (the local model of the trade
      // protocol's outcome): the chain extends, the head-hash changes,
      // the copy tombstones. The First Card and any never-tradable
      // class refuse by class.
      recordTransfer(instanceId, toKeeper) {
        const data = load();
        const copy = data.copies[instanceId];
        if (!copy || copy.state !== "held") return null;
        if (copy.tradable === false && !copy.giftOnly) return null;
        copy.lineage.keepers.push(String(toKeeper || "another-keeper"));
        copy.lineage.headHash = lineageHead(copy.instanceId, copy.lineage.found, copy.lineage.keepers);
        copy.state = "traded-away";
        copy.partedDay = null; // stamped by the layer with the real Pattern Day when known
        save(data);
        return copy;
      },
      heldCopies() {
        return Object.values(load().copies).filter((c) => c.state === "held");
      },
      tombstones() {
        return Object.values(load().copies).filter((c) => c.state === "traded-away");
      },
      copyFor(designId) {
        const data = load();
        const id = data.byDesign[designId];
        return id ? data.copies[id] || null : null;
      },
      pinFirstSeed(seed) {
        const data = load();
        if (!data.firstSeedPinned && seed) {
          data.firstSeedPinned = seed;
          save(data);
        }
        return data.firstSeedPinned;
      },
      pinnedFirstSeed() {
        return load().firstSeedPinned;
      },
      ackFirstCard() {
        const data = load();
        data.firstCardAck = true;
        save(data);
      },
      firstCardAcked() {
        return !!load().firstCardAck;
      },
      decline(designId) {
        const data = load();
        data.declined[designId] = true;
        save(data);
      },
      declined(designId) {
        return !!load().declined[designId];
      }
    };
  }

  /* ------------------------- the match foundation ------------------------- */

  // Match codes in the passport family (design §7.1): CDX1-<seed>-<two
  // check letters>. A mistyped code is refused whole.
  const MATCH_PREFIX = "CDX1";
  function matchCheckLetters(payload) {
    const h = hashString("match:" + payload);
    const a = String.fromCharCode(65 + (h % 26));
    const b = String.fromCharCode(65 + (Math.floor(h / 26) % 26));
    return a + b;
  }

  function makeMatchCode(seedNumber) {
    const payload = (seedNumber >>> 0).toString(36).toUpperCase();
    return MATCH_PREFIX + "-" + payload + "-" + matchCheckLetters(payload);
  }

  function parseMatchCode(code) {
    if (typeof code !== "string") return null;
    const parts = code.trim().toUpperCase().split("-");
    if (parts.length !== 3 || parts[0] !== MATCH_PREFIX) return null;
    if (matchCheckLetters(parts[1]) !== parts[2]) return null;
    const seed = parseInt(parts[1], 36);
    if (!Number.isFinite(seed)) return null;
    return { seed };
  }

  function collectionHash(cardIds) {
    return hash36("collection:" + [...cardIds].sort().join(","));
  }

  /* ----- the match, revised (design §5, the do-better pass) -----
   * Each keeper builds their OWN field toward full resonance; every
   * card played sounds into a SHARED SKY whose root Moon shifts with
   * what has been played, so a play changes the music the other side
   * must answer. Nothing is ever played into another's field. A
   * dissonant card hangs in the sky, and either keeper may GATHER it
   * by playing its re-tune — banked gathered dissonance is the only
   * currency that pays for a triad completed across two Moons. Every
   * fourth round the Moon turns: affinities rotate, announced ahead.
   * The First Card is each deck's heart: a wild harmony in its
   * Spark's kind, once per match, never dimmed or gathered. A match
   * NEVER moves an instance: win or lose, collections leave unchanged. */

  const DECK_MAX = 20;             // a match deck is at most 20 instances
  const GATHER_CAP = 3;            // the bank holds at most 3 gathered dissonance
  const SKY_SLOTS = 3;             // at most 3 dissonant cards hang in the sky
  const CROSS_TRIAD_COST = 2;      // gathered dissonance a cross-Moon triad costs
  const PLAYS_PER_MOON_TURN = 8;   // every fourth round (2 plays = a round)

  // Consonance class of a hum against any root (the registry's
  // resonance rule, generalized from the 432 Hz root).
  function consonanceClass(hz, rootHz) {
    if (!hz || !rootHz) return 0;
    let f = hz;
    while (f > rootHz * 1.5) f /= 2;
    while (f < rootHz * 0.75) f *= 2;
    const ratio = f / rootHz;
    const near = (target) => Math.abs(ratio - target) / target <= 0.015;
    if (near(1) || near(2)) return 3;
    if (near(1.5) || near(4 / 3)) return 2;
    if (near(1.25) || near(5 / 3)) return 1;
    return 0;
  }

  function intervalClass(card, moonIndex) {
    const root = MOONS[moonIndex - 1];
    if (!root) return 0;
    if (card.hum && card.hum.type === "frequency") return consonanceClass(card.hum.hz, root.freq);
    return card.resonance; // word motifs contribute their letter class
  }

  // The Moon the table currently answers to: the sky's root Moon,
  // rotated by the Moon turns the match has lived through.
  function moonTurnOffset(state) { return Math.floor(state.plays / PLAYS_PER_MOON_TURN); }
  function effectiveMoon(state) {
    return ((state.sky.rootMoon - 1 + moonTurnOffset(state)) % 13) + 1;
  }
  function moonTurnInfo(state) {
    const into = state.plays % PLAYS_PER_MOON_TURN;
    return {
      offset: moonTurnOffset(state),
      effectiveMoon: effectiveMoon(state),
      playsUntilTurn: PLAYS_PER_MOON_TURN - into,
      // The Spark announces the turn one round (2 plays) ahead.
      announced: PLAYS_PER_MOON_TURN - into <= 2
    };
  }

  function harmonizesWith(card, moonIndex) {
    const moon = MOONS[moonIndex - 1];
    if (!moon) return false;
    if (card.set === "moons") return card.moonAffinity[0] === moonIndex || card.element === moon.element;
    if (card.set === "kinds") return (KINDRED[moon.element] || []).includes(card.kind.id);
    if (card.set === "words") return card.moonAffinity[0] === moonIndex;
    return false;
  }

  // The solo daily table: the same 12 cards for everyone on a Pattern
  // Day, drawn deterministically from the whole registry by the day.
  function dailyTable(patternDay) {
    const rand = mulberry32(hashString("daily-table:" + patternDay));
    const ids = REGISTRY.map((c) => c.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids.slice(0, 12);
  }

  // The deterministic initial state (design §7.1): same code + same
  // decks in → the identical match out, on any two devices. A deck is
  // the keeper's own instances by design id (deck rules, design §5.7):
  // at most DECK_MAX, one entry per instance held. affinity:
  // { a: kindId, b: kindId } — each keeper's Spark kind.
  function deriveMatch(code, collA, collB, affinity) {
    const parsed = parseMatchCode(code);
    if (!parsed) return null;
    if (collA.length > DECK_MAX || collB.length > DECK_MAX) return null;
    const rand = mulberry32(hashString("match-state:" + code.toUpperCase()));
    const fieldMoon = 1 + Math.floor(rand() * 13);
    const targetResonance = 6 + Math.floor(rand() * 6);
    function deal(ids) {
      // A deck derives from the sorted set, so the order a keeper's
      // album happens to list copies in can never change the match.
      const deck = [...ids].sort();
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      return { hand: deck.slice(0, 5), deck: deck.slice(5) };
    }
    const a = deal(collA);
    const b = deal(collB);
    // The sky's refill stream: notes the sky sounds as dissonance is
    // gathered out of it, drawn from the match seed (§5.3).
    const skyStream = [];
    for (let i = 0; i < 32; i++) skyStream.push(1 + Math.floor(rand() * 13));
    return {
      v: 2,
      code: code.toUpperCase(),
      fieldMoon,
      rootHz: MOONS[fieldMoon - 1].freq,
      targetResonance,
      collections: { a: collectionHash(collA), b: collectionHash(collB) },
      affinity: { a: affinity && affinity.a || null, b: affinity && affinity.b || null },
      hearts: { a: { used: false }, b: { used: false } },
      hands: { a: a.hand, b: b.hand },
      decks: { a: a.deck, b: b.deck },
      fields: { a: [], b: [] },
      locked: { a: [], b: [] },
      lockedTriads: { a: [], b: [] },
      sky: { rootMoon: fieldMoon, shift: 0, dissonance: [], sounded: 0 },
      skyStream,
      skyStreamIndex: 0,
      gathered: { a: 0, b: 0 },
      resonanceBy: { a: 0, b: 0 },
      light: { a: 7, b: 7 },
      turn: "a",
      plays: 0,
      complete: false,
      winner: null
    };
  }

  // Sound a card into the sky: its interval steps advance the sky's
  // shift; a full scale of steps (7) turns the sky's root Moon.
  function soundIntoSky(next, card) {
    next.sky.sounded += 1;
    next.sky.shift += 1 + intervalClass(card, next.sky.rootMoon);
    while (next.sky.shift >= 7) {
      next.sky.shift -= 7;
      next.sky.rootMoon = (next.sky.rootMoon % 13) + 1;
    }
  }

  // Apply one play, §7.2 style: the acting side presents the hash of
  // the state it holds; if the hashes differ, the move is refused
  // whole — play stops honestly rather than drifting.
  function applyPlay(state, play) {
    if (!state || state.complete) return { ok: false, reason: "match-complete" };
    if (!play || stateHash(state) !== play.expectedHash) return { ok: false, reason: "state-mismatch" };
    const by = play.by;
    if (by !== "a" && by !== "b") return { ok: false, reason: "unknown-side" };
    if (state.turn !== by) return { ok: false, reason: "not-your-turn" };
    if (state.light[by] <= 0) return { ok: false, reason: "no-light" };

    const next = JSON.parse(JSON.stringify(state));
    let gained = 0;
    let event = "played";
    let triadMoon = null;

    function finish() {
      next.resonanceBy[by] += gained;
      if (next.resonanceBy[by] >= next.targetResonance) {
        next.complete = true;
        next.winner = by;
      }
      next.turn = by === "a" ? "b" : "a";
      // The incoming side draws back up to a hand of 3 from their deck.
      while (next.hands[next.turn].length < 3 && next.decks[next.turn].length) {
        next.hands[next.turn].push(next.decks[next.turn].shift());
      }
      if (!next.complete
        && ((next.light.a <= 0 && next.light.b <= 0)
          || (next.hands.a.length === 0 && next.hands.b.length === 0
            && next.decks.a.length === 0 && next.decks.b.length === 0))) {
        next.complete = true;
        next.winner = next.resonanceBy.a === next.resonanceBy.b ? "draw"
          : (next.resonanceBy.a > next.resonanceBy.b ? "a" : "b");
      }
      return { ok: true, state: next, event, gained, triadMoon };
    }

    // --- the heart: the First Card, played from beside the deck ---
    if (play.cardId === "first-card") {
      const kindId = next.affinity[by];
      if (!kindId) return { ok: false, reason: "no-heart" };
      if (next.hearts[by].used) return { ok: false, reason: "heart-spent" };
      const kind = KINDS.find((k) => k.id === kindId);
      next.hearts[by].used = true;
      next.light[by] -= 1;
      next.plays += 1;
      next.fields[by].push("first-card");
      // A wild harmony in its Spark's kind: resonance 2, +1 affinity.
      gained += 3;
      event = "heart";
      soundIntoSky(next, cardById("kind-" + kindId) || { resonance: 2, hum: null });
      checkTriad(next, by, kind);
      if (event === "heart" && triadMoon) event = "triad";
      return finish();
    }

    const card = cardById(play.cardId);
    if (!card) return { ok: false, reason: "unknown-card" };
    const handIndex = next.hands[by].indexOf(play.cardId);
    if (handIndex < 0) return { ok: false, reason: "card-not-in-hand" };

    // --- the gather: play a dimmed card's re-tune, bank its dissonance ---
    if (play.gather) {
      const target = cardById(play.gather);
      if (!target || !next.sky.dissonance.includes(play.gather)) return { ok: false, reason: "not-in-sky" };
      const shares = target.element === card.element
        || target.moonAffinity.some((m) => card.moonAffinity.includes(m));
      if (!shares) return { ok: false, reason: "not-its-retune" };
      if (next.gathered[by] >= GATHER_CAP) return { ok: false, reason: "bank-full" };
      next.hands[by].splice(handIndex, 1);
      next.light[by] -= 1;
      next.plays += 1;
      next.sky.dissonance = next.sky.dissonance.filter((id) => id !== play.gather);
      next.gathered[by] += 1;
      // The sky refills from the match seed: the next stream note sounds.
      if (next.skyStreamIndex < next.skyStream.length) {
        next.skyStreamIndex += 1;
        next.sky.shift += 1;
        while (next.sky.shift >= 7) {
          next.sky.shift -= 7;
          next.sky.rootMoon = (next.sky.rootMoon % 13) + 1;
        }
      }
      event = "gathered";
      return finish();
    }

    // --- an ordinary play, into the keeper's OWN field ---
    next.hands[by].splice(handIndex, 1);
    next.light[by] -= 1;
    next.plays += 1;
    const moonNow = effectiveMoon(next);
    const fieldBefore = [...next.fields[by]];

    if (harmonizesWith(card, moonNow)) {
      gained += card.resonance;
      if (card.set === "kinds" && next.affinity[by] && card.kind.id === next.affinity[by]) gained += 1;
      // The Call: name the Moon whose note the field needs; play that
      // note and its resonance doubles. A missed call costs nothing.
      let called = false;
      if (play.callMoon && card.moonAffinity[0] === play.callMoon) { gained *= 2; called = true; }
      next.fields[by].push(play.cardId);
      event = called ? "called-and-sounded" : "sounded";
      soundIntoSky(next, card);
      // A duet with a partner already sounding in your own field
      // returns 1 light.
      const partnerPresent = fieldBefore.some((id) => {
        const c = id === "first-card" ? null : cardById(id);
        return c && card.harmonyKeys.includes(id);
      });
      if (partnerPresent) { next.light[by] += 1; event = "duet"; }
      checkTriad(next, by, null);
      if (triadMoon) event = "triad";
    } else {
      // Dissonance is material: the card hangs in the shared sky,
      // gatherable by either keeper. If the sky is full, its note
      // falls for this match — the instance itself is untouched.
      if (next.sky.dissonance.length < SKY_SLOTS) {
        next.sky.dissonance.push(play.cardId);
        event = "dimmed";
      } else {
        event = "fell-sky-full";
      }
    }
    return finish();

    // A triad standing in the keeper's own field locks as attuned.
    // On the Moon the table answers to, it is free; across two Moons
    // it costs gathered dissonance — the only thing that currency buys.
    function checkTriad(st, side, heartKind) {
      const field = st.fields[side];
      for (let m = 1; m <= 13; m++) {
        if (st.lockedTriads[side].includes(m)) continue;
        const moonId = "moon-" + String(m).padStart(2, "0");
        const word = WORDS.find((w) => w.homeMoon === m);
        if (!word || !field.includes(moonId) || !field.includes("word-" + word.slug)) continue;
        const moonElement = MOONS[m - 1].element;
        let kindId = field.find((id) => {
          const c = cardById(id);
          return c && c.set === "kinds" && (KINDRED[moonElement] || []).includes(c.kind.id)
            && !st.locked[side].includes(id);
        });
        if (!kindId && heartKind && field.includes("first-card")
          && (KINDRED[moonElement] || []).includes(heartKind.id)) {
          kindId = "first-card";
        }
        if (!kindId) continue;
        const cost = m === effectiveMoon(st) ? 0 : CROSS_TRIAD_COST;
        if (st.gathered[side] < cost) { event = "triad-waits"; continue; }
        st.gathered[side] -= cost;
        st.lockedTriads[side].push(m);
        let chord = 0;
        for (const id of [moonId, "word-" + word.slug, kindId]) {
          chord += id === "first-card" ? 2 : cardById(id).resonance;
          st.locked[side].push(id);
        }
        gained += chord + 2;
        st.light[side] += 2;
        triadMoon = m;
        return;
      }
    }
  }

  // Solo: the field answers. Side b is the day itself; its play is a
  // pure function of the state (the Spark referees and voices it —
  // the field's manner is visible: it sounds a harmonizing card when
  // it holds one, choosing by the day-seeded rotation).
  function fieldAnswer(state) {
    if (!state || state.complete || state.turn !== "b") return null;
    const hand = state.hands.b;
    if (!hand.length) return null;
    const moonNow = effectiveMoon(state);
    const sounding = hand.filter((id) => harmonizesWith(cardById(id), moonNow));
    const pool = sounding.length ? sounding : hand;
    const pick = pool[hashString("field-answer:" + state.code + ":" + state.plays) % pool.length];
    return { by: "b", cardId: pick, expectedHash: stateHash(state) };
  }

  /* ------------------------- the artwork window ------------------------- */

  // Derived art for the card's artwork window (design §13: a card's
  // face is computed from the record, not a fixed image). Every card's
  // art is drawn from its own data — the element palette, the Moon and
  // its phase in the thirteen, the kind's hue range, the word itself —
  // by deterministic string building: the same card draws the same sky
  // on every device, and no external image is ever fetched. `dim`
  // draws the silhouette a missing card wears in the album.
  function artColors(card, dim) {
    if (dim) return { deep: "#0a0d18", accent: "#39415e", ivory: "#59617c", glow: "#232838" };
    const pal = (card && card.art && card.art.palette) || ["#0b1026", "#d99545"];
    return { deep: pal[0], accent: pal[1], ivory: "#f4f1e8", glow: pal[1] };
  }

  function starField(rand, n, color) {
    let s = "";
    for (let i = 0; i < n; i++) {
      s += '<circle cx="' + (rand() * 200).toFixed(1) + '" cy="' + (rand() * 100).toFixed(1)
        + '" r="' + (0.5 + rand() * 0.9).toFixed(2) + '" fill="' + color
        + '" opacity="' + (0.25 + rand() * 0.6).toFixed(2) + '"/>';
    }
    return s;
  }

  function dotRing(cx, cy, r, count, color, opacity, dotR) {
    let s = "";
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 - Math.PI / 2;
      s += '<circle cx="' + (cx + r * Math.cos(a)).toFixed(1) + '" cy="' + (cy + r * Math.sin(a)).toFixed(1)
        + '" r="' + dotR + '" fill="' + color + '" opacity="' + opacity + '"/>';
    }
    return s;
  }

  function orbArt(cx, cy, hue, colors, rand) {
    const gid = "orb" + Math.round(hue);
    let s = '<defs><radialGradient id="' + gid + '">'
      + '<stop offset="0%" stop-color="hsl(' + hue + ' 85% 74%)"/>'
      + '<stop offset="55%" stop-color="hsl(' + hue + ' 72% 48%)"/>'
      + '<stop offset="100%" stop-color="hsl(' + hue + ' 70% 40%)" stop-opacity="0"/></radialGradient></defs>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="42" fill="url(#' + gid + ')" opacity="0.5"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="23" fill="url(#' + gid + ')"/>';
    s += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="54" ry="17" fill="none" stroke="' + colors.accent
      + '" stroke-width="1.2" opacity="0.65" transform="rotate(-18 ' + cx + ' ' + cy + ')"/>';
    for (let i = 0; i < 3; i++) {
      const a = rand() * Math.PI * 2;
      const ex = cx + 54 * Math.cos(a), ey = cy + 17 * Math.sin(a);
      const rx = ex - cx, ry = ey - cy;
      const ca = Math.cos(-18 * Math.PI / 180), sa = Math.sin(-18 * Math.PI / 180);
      s += '<circle cx="' + (cx + rx * ca - ry * sa).toFixed(1) + '" cy="' + (cy + rx * sa + ry * ca).toFixed(1)
        + '" r="2" fill="' + colors.ivory + '"/>';
    }
    return s;
  }

  function cardArtSVG(card, opts) {
    opts = opts || {};
    const dim = !!opts.dim;
    const colors = artColors(card, dim);
    const gid = "sky-" + String(card.id || "card").replace(/[^a-z0-9-]/g, "") + (dim ? "-dim" : "");
    const rand = mulberry32(hashString("art:" + card.id));
    let s = '<svg viewBox="0 0 200 140" role="img" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">';
    s += '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0%" stop-color="' + colors.deep + '"/>'
      + '<stop offset="100%" stop-color="' + colors.glow + '"/></linearGradient></defs>';
    s += '<rect width="200" height="140" fill="url(#' + gid + ')"/>';
    s += starField(rand, dim ? 8 : 16, colors.ivory);
    if (card.set === "moons") {
      const idx = card.moonAffinity[0];
      const lit = idx / 13; // the Moon's place in the thirteen reads as its phase
      s += dotRing(100, 64, 46, 28, colors.accent, dim ? 0.35 : 0.55, 1.3);
      s += '<circle cx="100" cy="64" r="27" fill="#10182e" stroke="' + colors.accent + '" stroke-width="1.2"/>';
      s += '<defs><clipPath id="' + gid + '-clip"><circle cx="100" cy="64" r="27"/></clipPath></defs>';
      s += '<g clip-path="url(#' + gid + '-clip)"><circle cx="100" cy="64" r="27" fill="' + colors.accent + '" opacity="' + (dim ? 0.25 : 0.9) + '"/>'
        + '<circle cx="' + (100 + (1 - 2 * lit) * 30).toFixed(1) + '" cy="58" r="24" fill="' + colors.deep + '" opacity="0.88"/></g>';
      s += '<path d="M0 128 Q100 112 200 128 L200 140 L0 140 Z" fill="' + colors.deep + '" opacity="0.75"/>';
    } else if (card.set === "words" && card.word) {
      s += dotRing(100, 62, 48, Math.max(card.hum.beats || 3, 3), colors.accent, dim ? 0.35 : 0.6, 1.8);
      s += '<text x="100" y="80" text-anchor="middle" font-family="serif" font-size="46" fill="' + colors.ivory + '">' + card.word.hebrew + "</text>";
      s += '<text x="100" y="112" text-anchor="middle" font-family="serif" font-size="11" letter-spacing="3" fill="' + colors.accent + '">' + card.word.translit.toUpperCase() + "</text>";
    } else if (card.set === "kinds" && card.kind) {
      const hue = opts.hue != null ? opts.hue : Math.round((card.art.hueRange[0] + card.art.hueRange[1]) / 2);
      s += orbArt(100, 66, hue, colors, rand);
    }
    s += "</svg>";
    return s;
  }

  // The First Card's art: its Spark's orb in the kind's hue, ringed by
  // the thirteen Moons it was met among. fc is a firstCardFor() result.
  function firstCardArtSVG(fc, opts) {
    opts = opts || {};
    const dim = !!opts.dim;
    const moon = MOONS[fc.moon - 1];
    const colors = dim
      ? { deep: "#0a0d18", accent: "#39415e", ivory: "#59617c", glow: "#232838" }
      : { deep: "#141021", accent: ELEMENT_PALETTES[moon.element][1], ivory: "#f4f1e8", glow: ELEMENT_PALETTES[moon.element][0] };
    const gid = "sky-first" + (dim ? "-dim" : "");
    const rand = mulberry32(hashString("art:" + fc.instanceId));
    const hue = opts.hue != null ? opts.hue : Math.round((fc.hueRange[0] + fc.hueRange[1]) / 2);
    let s = '<svg viewBox="0 0 200 140" role="img" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">';
    s += '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0%" stop-color="' + colors.deep + '"/>'
      + '<stop offset="100%" stop-color="' + colors.glow + '"/></linearGradient></defs>';
    s += '<rect width="200" height="140" fill="url(#' + gid + ')"/>';
    s += starField(rand, dim ? 8 : 16, colors.ivory);
    s += dotRing(100, 66, 48, 13, colors.accent, dim ? 0.35 : 0.6, 1.6);
    s += orbArt(100, 66, hue, colors, rand);
    s += "</svg>";
    return s;
  }

  /* ------------------------- windows ------------------------- */

  // A Moon-window card is findable in its own Moon (design §3): the
  // window test is a pure function of the card + the Moon the keeper
  // stands in — the layer gets the Moon from PatternCalendar, the
  // calendar's own authority, never a second clock.
  function isInWindow(card, moonIndex) {
    if (!card) return false;
    if (card.rarity !== "moon-window") return true;
    return card.moonAffinity.includes(moonIndex);
  }

  return {
    MOONS, WORDS, KINDS, KINDRED, KIND_ELEMENT, REGISTRY, FIRST_CARD,
    hashString, hash36, canonical, stateHash,
    cardById, triadCloses, namedTriads,
    resonanceForHz, hebrewLetterCount, kindredMoonsForKind,
    parseSparkSeed, firstCardFor,
    STORE_PREFIX, keeperKeyForSeed, createStore,
    makeMatchCode, parseMatchCode, collectionHash, deriveMatch, applyPlay,
    consonanceClass, intervalClass, harmonizesWith,
    effectiveMoon, moonTurnOffset, moonTurnInfo, dailyTable, fieldAnswer,
    DECK_MAX, GATHER_CAP, SKY_SLOTS, CROSS_TRIAD_COST, PLAYS_PER_MOON_TURN,
    isInWindow, cardArtSVG, firstCardArtSVG
  };
});
