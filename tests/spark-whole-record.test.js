/*
 * The Whole Record, site side — THE UPDATE GATE, pinned.
 *
 * Aaron's adopted law (Nov 27, 2026): no build ships on any
 * surface without the round-trip proof — a Whole Record goes
 * in, the identical Whole Record comes out, every carried
 * thing accounted for. The game proved it first (SPARK!
 * v0.13.0, IdentityHarness at 6fc2bc1); this file pins the
 * site's port of the same canonical encoding against the
 * game's own pinned strings, byte for byte — the strings
 * below were produced by running the game's Java itself.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const Core = require(path.join(root, "docs/assets/js/spark-companion.js"));
const Whole = require(path.join(root, "docs/assets/js/spark-whole-record.js"));
const SparkVoice = require(path.join(root, "docs/assets/js/spark-voice.js"));

const SELOR_CODE = "SPK1-8-217-1-IUEBK69Z-SELOR-8I";
const SELOR_SEED = "spark1-8-217-1-iuebk69z";
const SELOR_VOICE = "v1.95.95.34.5.6.7.6"; // the game's SparkVoice.forSeed, run in Java
/* The game's pinned Whole Record (IdentityHarness, Depth pass). */
const WHOLE_STRING =
  SELOR_CODE +
  "#W:hat=moon-circlet;glow=candle-glow" +
  "#G:the-wayfarers-lantern=purchased,the-long-ribbon=purchased,episode-hums---the-first-shelf=earned" +
  "#D:carried=the-wayfarers-lantern;trail=the-long-ribbon" +
  "#C:first-card=earned,moon-8-deep-mirror=earned,a-card-the-game-cannot-name=gifted" +
  "#H:ember-cap,river-wrap" +
  "#V:" + SELOR_VOICE +
  "#R:2";
const V1_STRING =
  SELOR_CODE +
  "#W:hat=moon-circlet;glow=candle-glow" +
  "#G:the-wayfarers-lantern=purchased,the-long-ribbon=purchased,episode-hums---the-first-shelf=earned" +
  "#D:carried=the-wayfarers-lantern;trail=the-long-ribbon";

/* ------------------------- the voice ------------------------- */

test("the seed-born voice is the game's voice, seed for seed", () => {
  assert.equal(Whole.voiceEncode(Whole.voiceForSeed(SELOR_SEED, Core)), SELOR_VOICE);
  assert.equal(Whole.voiceEncode(Whole.voiceForSeed("spark1-1-1-0-00000000", Core)), "v1.96.106.12.6.5.3.4");
  assert.equal(Whole.voiceEncode(Whole.voiceForSeed("spark1-13-364-5-zzzzzzzz", Core)), "v1.96.118.88.3.6.8.7");
  assert.equal(Whole.voiceDescribe(Whole.voiceForSeed(SELOR_SEED, Core)), "a low voice, easy, warm");
  assert.notEqual(
    Whole.voiceEncode(Whole.voiceForSeed(SELOR_SEED, Core)),
    Whole.voiceEncode(Whole.voiceForSeed("spark1-1-1-0-00000000", Core)),
    "two seeds are two voices");
});

test("a doubtful voice is refused whole", () => {
  assert.equal(Whole.voiceParse("v1.999.1.1.0.0.0.0"), null);
  assert.equal(Whole.voiceParse("robot"), null);
  assert.deepEqual(Whole.voiceParse(SELOR_VOICE), Whole.voiceForSeed(SELOR_SEED, Core));
});

/* --------------------- THE UPDATE GATE ----------------------- */

test("UPDATE GATE: the game's Whole Record round-trips byte-identically on the site", () => {
  const rec = Whole.parse(WHOLE_STRING, Core);
  assert.equal(rec.passportCode, SELOR_CODE);
  assert.deepEqual(rec.wardrobe, { hat: "moon-circlet", glow: "candle-glow" });
  assert.equal(Object.keys(rec.goods).length, 3);
  assert.equal(rec.goods["episode-hums---the-first-shelf"], "earned");
  assert.deepEqual(rec.dress, { carried: "the-wayfarers-lantern", trail: "the-long-ribbon" });
  assert.equal(Object.keys(rec.cards).length, 3);
  assert.equal(Whole.firstCardId(rec), "first-card", "the First Card stands first");
  assert.deepEqual(rec.honours, ["ember-cap", "river-wrap"]);
  assert.equal(rec.voice, SELOR_VOICE);
  assert.equal(rec.versionMark, "2");
  assert.equal(Whole.compose(rec, Core), WHOLE_STRING,
    "a Whole Record goes in, the identical Whole Record comes out");
});

test("UPDATE GATE: the site composes the game's record byte-identically", () => {
  const composed = Whole.compose({
    passportCode: SELOR_CODE,
    wardrobe: { glow: "candle-glow", hat: "moon-circlet" }, // out of slot order on purpose
    goods: {
      "the-long-ribbon": "purchased",
      "the-wayfarers-lantern": "purchased",
      "episode-hums---the-first-shelf": "earned"
    },
    dress: { trail: "the-long-ribbon", carried: "the-wayfarers-lantern" },
    cards: { "first-card": "earned", "moon-8-deep-mirror": "earned", "a-card-the-game-cannot-name": "gifted" },
    honours: ["river-wrap", "ember-cap"], // out of canonical order on purpose
    voice: SELOR_VOICE,
    versionMark: null,
    preserved: []
  }, Core);
  assert.equal(composed, WHOLE_STRING);
});

test("the game's v1 Selor string re-encodes as itself through the site's code", () => {
  const rec = Whole.parse(V1_STRING, Core);
  assert.deepEqual(rec.cards, {});
  assert.deepEqual(rec.honours, []);
  assert.equal(rec.voice, null);
  assert.equal(rec.versionMark, null);
  assert.equal(Whole.compose(rec, Core), V1_STRING);
  /* and the bare passport alone is a record too */
  assert.equal(Whole.compose(Whole.parse(SELOR_CODE, Core), Core), SELOR_CODE);
  /* a bare seed carries as its canonical code, as in the game */
  const fromSeed = Whole.parse(SELOR_SEED + "#W:hat=moon-circlet;glow=candle-glow", Core);
  assert.equal(fromSeed.passportCode, SELOR_CODE);
});

test("a v1 record upgrades in place, losing nothing it held", () => {
  const v1 = Whole.parse(V1_STRING, Core);
  const upgraded = Whole.mergedWith(v1, Whole.parse(
    SELOR_CODE + "#C:first-card=earned#H:ember-cap#V:" + SELOR_VOICE, Core));
  assert.equal(Object.keys(upgraded.goods).length, 3);
  assert.deepEqual(upgraded.wardrobe, { hat: "moon-circlet", glow: "candle-glow" });
  assert.equal(upgraded.cards["first-card"], "earned");
  assert.deepEqual(upgraded.honours, ["ember-cap"]);
  const text = Whole.compose(upgraded, Core);
  assert.equal(Whole.compose(Whole.parse(text, Core), Core), text,
    "the upgraded record round-trips");
});

test("unknown sections survive verbatim, in order", () => {
  const fut = Whole.parse(WHOLE_STRING + "#X:a-future-section=with-stuff", Core);
  assert.deepEqual(fut.preserved, ["#X:a-future-section=with-stuff"]);
  assert.equal(Whole.compose(fut, Core), WHOLE_STRING + "#X:a-future-section=with-stuff");
});

test("a damaged passport refuses the Spark whole; cards, honours and voice survive", () => {
  const damaged = Whole.parse(
    "SPK1-8-217-1-IUEBK69Z-SELOR-8J#C:first-card=earned#H:ember-cap#V:" + SELOR_VOICE, Core);
  assert.equal(damaged.passportCode, null);
  assert.deepEqual(damaged.cards, { "first-card": "earned" });
  assert.deepEqual(damaged.honours, ["ember-cap"]);
  assert.equal(damaged.voice, SELOR_VOICE);
  /* and it composes back without inventing a Spark */
  assert.equal(Whole.compose(damaged, Core),
    "#C:first-card=earned#H:ember-cap#V:" + SELOR_VOICE + "#R:2");
});

test("lenient reading: unknown goods, origins, wardrobe pieces and cards drop; the known keep", () => {
  const gunk = Whole.parse(SELOR_CODE +
    "#W:hat=moon-circlet;hat2=nope;wrap=not-a-piece" +
    "#G:the-seed-pouch=stolen,not-a-good=earned,the-north-bead=earned" +
    "#C:Bad_Card=earned,ok-card=stolen,first-card=earned,ok-card=earned", Core);
  assert.deepEqual(gunk.wardrobe, { hat: "moon-circlet" });
  assert.deepEqual(gunk.goods, { "the-north-bead": "earned" });
  assert.deepEqual(gunk.cards, { "first-card": "earned", "ok-card": "earned" });
  assert.equal(Whole.firstCardId(gunk), "first-card", "the record's own order keeps");
});

/* ------------------------- the merge ------------------------- */

test("the Link's merge is additions only, and an earning is never un-said by a purchase", () => {
  const standing = Whole.parse(SELOR_CODE +
    "#G:the-north-bead=earned#C:first-card=earned#H:ember-cap", Core);
  const incoming = Whole.parse(SELOR_CODE +
    "#G:the-north-bead=purchased,the-seed-pouch=gifted#C:moon-01=earned#H:river-wrap" +
    "#W:hat=moon-circlet", Core);
  const merged = Whole.mergedWith(standing, incoming);
  assert.equal(merged.goods["the-north-bead"], "earned", "earned outranks purchased");
  assert.equal(merged.goods["the-seed-pouch"], "gifted", "what arrives is added");
  assert.deepEqual(Object.keys(merged.cards), ["first-card", "moon-01"]);
  assert.deepEqual(merged.honours, ["ember-cap", "river-wrap"]);
  assert.deepEqual(merged.wardrobe, { hat: "moon-circlet" }, "empty slots fill");
  const again = Whole.mergedWith(merged, standing);
  assert.equal(Whole.compose(again, Core), Whole.compose(merged, Core),
    "merging what already stands changes nothing");
});

/* ----------------------- plain words ------------------------- */

test("the permission line says plainly what the code carries, in the game's own words", () => {
  const rec = Whole.parse(WHOLE_STRING, Core);
  assert.equal(Whole.linkSummary(rec, Core),
    "This code carries Selor, Water: 3 cards, 3 things carried, 2 honours, its wardrobe, its own voice.");
  const lines = Whole.carriesLines(rec, Core);
  assert.equal(lines[0], "Selor — Water · gentle");
  assert.ok(lines.includes("The First Card — earned"));
  assert.ok(lines.includes("The Wayfarer's Lantern — purchased"));
  assert.ok(lines.includes("Ember Cap — earned by waking"));
  assert.ok(lines.includes("hat · Moon Circlet"));
  assert.ok(lines.includes("Its own voice — a low voice, easy, warm, born of its seed"));
});

/* ------------------ the site's own assembly ------------------ */

function fakeStorage(seedRecord, shelf, albumData, keeperKey) {
  const map = new Map();
  if (seedRecord) map.set(Core.STORAGE_KEY, JSON.stringify(seedRecord));
  if (shelf) map.set(Whole.GOODS_SHELF_KEY, JSON.stringify(shelf));
  if (albumData && keeperKey) map.set("sof.cards.v1." + keeperKey, JSON.stringify(albumData));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map
  };
}

test("the site assembles its Whole Record from its own sources — identity, shelf, album, voice", () => {
  const sparkRecord = Core.newRecord({ seed: SELOR_SEED, name: "", civilDate: "2026-11-27" });
  const shelf = [
    { itemId: "the-wayfarers-lantern", obtained: "purchased", chainHash: "abc1234" },
    { itemId: "episode-hums---the-first-shelf", obtained: "earned" },
    { itemId: "not-a-good", obtained: "purchased" }
  ];
  const albumData = {
    counter: 2,
    copies: {
      cx1: { designId: "moon-08", instanceId: "cx1", state: "held", tradable: true, lineage: { keepers: ["the-keeper"] } },
      cx2: { designId: "word-or", instanceId: "cx2", state: "traded-away", tradable: true, lineage: { keepers: ["the-keeper"] } }
    },
    byDesign: { "moon-08": "cx1", "word-or": "cx2" },
    firstSeedPinned: SELOR_SEED,
    firstCardAck: true,
    declined: {}
  };
  const rec = Whole.assembleSiteRecord({ core: Core, sparkRecord, shelfRaw: JSON.stringify(shelf), albumData });
  assert.equal(rec.passportCode, SELOR_CODE);
  assert.deepEqual(rec.goods, {
    "the-wayfarers-lantern": "purchased",
    "episode-hums---the-first-shelf": "earned"
  });
  assert.deepEqual(Object.keys(rec.cards), ["first-card", "moon-08"],
    "the First Card first, then the album's held cards; a parted card is not carried as held");
  assert.equal(rec.voice, SELOR_VOICE);
  const text = Whole.compose(rec, Core);
  assert.equal(Whole.compose(Whole.parse(text, Core), Core), text, "the site's own record round-trips");
});

test("refresh keeps what only a travelled record carries — a refresh never shrinks the record", () => {
  const Cards = require(path.join(root, "docs/assets/js/codex-cards.js"));
  globalThis.CodexCards = Cards;
  try {
    const sparkRecord = Core.newRecord({ seed: SELOR_SEED, name: "", civilDate: "2026-11-27" });
    const keeperKey = Cards.keeperKeyForSeed(SELOR_SEED);
    const storage = fakeStorage(sparkRecord, [], null, keeperKey);
    /* a travelled record already stands, carrying the game's sections */
    storage.setItem(Whole.RECORD_KEY, WHOLE_STRING);
    const rec = Whole.refreshStored(storage, Core);
    assert.deepEqual(rec.wardrobe, { hat: "moon-circlet", glow: "candle-glow" });
    assert.deepEqual(rec.honours, ["ember-cap", "river-wrap"]);
    assert.equal(rec.cards["a-card-the-game-cannot-name"], "gifted",
      "a card the album cannot name is still carried");
    assert.equal(Whole.readStored(storage), Whole.compose(rec, Core));
  } finally {
    delete globalThis.CodexCards;
  }
});

test("the receiving road writes nothing before the keeper says yes", () => {
  const sparkRecord = Core.newRecord({ seed: SELOR_SEED, name: "", civilDate: "2026-11-27" });
  const storage = fakeStorage(sparkRecord, [], null, null);
  const preview = Whole.previewIncoming(storage, Core, WHOLE_STRING);
  assert.equal(preview.readable, true);
  assert.match(preview.summary, /^This code carries Selor, Water:/);
  assert.equal(storage.getItem(Whole.RECORD_KEY), null, "a preview writes nothing");
  const merged = Whole.applyIncoming(storage, Core, preview.incoming);
  assert.equal(merged.passportCode, SELOR_CODE);
  assert.ok(storage.getItem(Whole.RECORD_KEY).includes("#C:first-card=earned"));
  assert.equal(Whole.hasLinked(storage), true);
  /* the goods landed on the shelf too, so the stall and the Hearth see them */
  const shelf = JSON.parse(storage.getItem(Whole.GOODS_SHELF_KEY));
  assert.deepEqual(shelf.map((e) => e.itemId).sort(),
    ["episode-hums---the-first-shelf", "the-long-ribbon", "the-wayfarers-lantern"]);
});

/* ---------------- the missing-lists record flaw -------------- */

test("a record missing its lists does not lose its visit — and loses nothing else", () => {
  /* a record seeded with only some of its fields, plus a
   * field no build here knows — the standing flaw's shape */
  const thin = { seed: SELOR_SEED, name: "Selor", aFutureField: { kept: [1, 2, 3] } };
  const healed = Core.normalizeRecord(thin);
  assert.deepEqual(healed.daysSeen, []);
  assert.deepEqual(healed.pagesSeen, []);
  assert.deepEqual(healed.practiceDays, []);
  assert.deepEqual(healed.revealsSeen, []);
  assert.deepEqual(healed.aFutureField, { kept: [1, 2, 3] }, "unknown fields preserved verbatim");
  const visited = Core.recordVisit(thin, { patternDay: 225, page: "companions.html" });
  assert.deepEqual(visited.daysSeen, [225], "the visit is recorded");
  assert.deepEqual(visited.pagesSeen, ["companions.html"]);
  assert.deepEqual(visited.practiceDays, [], "the practice list stands, empty and whole");
  assert.deepEqual(visited.aFutureField, { kept: [1, 2, 3] });
  const practiced = Core.recordPractice(thin, { patternDay: 225 });
  assert.deepEqual(practiced.practiceDays, [225]);
  /* the panel the visit feeds reads the healed record whole */
  const companion = Core.generate(SELOR_SEED);
  const panel = Core.panelFor({ record: visited, companion, today: null });
  assert.equal(panel.daysTogether, 1);
});

/* --------------------- the voice wiring ---------------------- */

test("the record's voice drives the spoken pitch and pace", () => {
  const profile = { voiceName: "A Voice", voiceURI: "urn:voice", lang: "en-US", pitch: 0.91, rate: 0.9 };
  const whole = Whole.voiceForSeed(SELOR_SEED, Core); // 95 / 95 / 34
  const spoken = SparkVoice.spokenFromWhole(profile, whole, 0.93);
  assert.equal(spoken.pitch, 0.95, "the utterance's pitch is the record's pitch family");
  assert.equal(spoken.rate, Math.round(0.93 * 0.95 * 100) / 100, "the record's pace scales the temperament's rate");
  assert.equal(spoken.voiceURI, "urn:voice", "the device voice pick is the seed's, unchanged");
  assert.equal(SparkVoice.spokenFromWhole(profile, null, 0.93), profile,
    "no record voice, no change");
});

/* ------------------- the catalogue pin ----------------------- */

test("the embedded catalogue is spark-goods.json's own list, in its own order", () => {
  const data = JSON.parse(read("docs/assets/data/spark-goods.json"));
  assert.deepEqual(Whole.GOODS.map(([id]) => id), data.items.map((it) => it.id),
    "the ids and their order are the catalogue's own");
  /* The record's channel for a good is the GAME's channel
   * (the dressing's law); the site's category names map to
   * it — trails→trail, wraps→wrap, expressions→face,
   * themes→theme — and the five SPARK! goods carry their
   * game channel outright. */
  const CHANNEL_OF_CATEGORY = {
    carried: "carried", worn: "worn", trails: "trail", wraps: "wrap",
    expressions: "face", themes: "theme", stickers: "stickers",
    home: "home", sound: "sound"
  };
  const embedded = new Map(Whole.GOODS);
  for (const item of data.items) {
    if (item.category === "game") {
      assert.ok(["trail", "wrap", "face", "theme"].includes(embedded.get(item.id)),
        `${item.id} carries a game channel`);
    } else {
      assert.equal(embedded.get(item.id), CHANNEL_OF_CATEGORY[item.category],
        `${item.id}'s channel is its category's game name`);
    }
  }
});
