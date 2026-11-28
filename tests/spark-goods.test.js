/* The Spark Stall catalogue — the data is the stock, so the data
   is what gets tested: every designed good present, every fence
   carried in the data itself, rarity honest, the till dark. */
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "docs/assets/data/spark-goods.json"), "utf8"));
const items = data.items;
const byName = new Map(items.map((i) => [i.name, i]));

// The 35 goods of the designed shelves (Nov 23 catalogue + world
// goods, tabulated in the Nov 25 stall list) — none may go missing.
const DESIGNED_35 = [
  "The Wayfarer's Lantern", "The Seed Pouch", "The Scroll-Case", "The Traveller's Satchel",
  "The Astrolabe Charm", "The North Bead", "The Key of the Thirteenth Door", "The Kind Scarf",
  "The Moon-Phase Band", "The Cloak-Clasp of the Road", "The Ember Circlet",
  "The Ribbon of the Day Out of Time", "The Veil of Quiet Hours", "Petal Drift", "Ember Motes",
  "Ripple-Step", "Season Motes", "The Long Ribbon", "Chime Set — The Moon Tones",
  "Chime Set — Hearth & Copper", "The Arrival Bell", "The Keeper's Bench", "The Reading Stone",
  "The Resting Hammock", "The Clearing Lamp", "The Path Lanterns (set of three)", "The Hearth Ring",
  "Path Stones (set of seven)", "The Garden Gate", "The Stepping Bridge", "The Round Fountain",
  "The Rain Barrel & Dipper", "The Young Orchard Tree", "The Vine Pergola", "The Threshold Stone",
];

test("all 35 designed goods are on the shelf", () => {
  for (const name of DESIGNED_35) assert.ok(byName.has(name), "missing: " + name);
});

test("every task category is present and non-empty", () => {
  const cats = new Set(items.map((i) => i.category));
  for (const c of ["carried", "worn", "trails", "wraps", "expressions", "stickers", "themes", "home", "game", "sound"])
    assert.ok(cats.has(c), "empty category: " + c);
  assert.strictEqual(data.categories.length, 10);
});

test("every item is a real catalogue entry", () => {
  const ids = new Set();
  for (const it of items) {
    assert.ok(it.id && !ids.has(it.id), "id missing or duplicated: " + it.name);
    ids.add(it.id);
    assert.ok(it.sellingPoint && it.sellingPoint.length > 10, "selling point: " + it.name);
    assert.ok(it.onSpark && it.onSpark.length > 10, "on-Spark line: " + it.name);
    assert.ok(!("gates" in it), "no good may gate anything: " + it.name);
    const text = (it.name + " " + it.sellingPoint).toLowerCase();
    for (const banned of ["loot", "mystery box", "chance of", "random draw", "gacha"])
      assert.ok(!text.includes(banned), "blind-pack language in: " + it.name);
  }
});

test("band prices are the set bands; Heirloom carries no Embers price", () => {
  const price = { Pocket: 2, Keeper: 7, Heirloom: 19 };
  const embers = { Pocket: 20, Keeper: 75, Heirloom: null };
  for (const it of items) {
    if (!it.band) continue; // earned-only
    assert.strictEqual(it.price, price[it.band], it.name);
    assert.strictEqual(it.embers, embers[it.band], it.name);
  }
});

test("the earned-only tier is visibly distinct: no band, no price, marked earned", () => {
  const earned = items.filter((i) => i.rarity && i.rarity.type === "earned-only");
  assert.ok(earned.length >= 2, "earned-only hum packs present");
  for (const it of earned) {
    assert.strictEqual(it.band, null);
    assert.strictEqual(it.price, null);
    assert.strictEqual(it.embers, null);
    assert.match(it.rarity.note, /Earned, never sold/);
  }
});

test("editions carry their issue day; moon windows announce themselves plainly", () => {
  const eds = items.filter((i) => i.rarity && i.rarity.type === "edition");
  assert.ok(eds.length >= 4);
  for (const it of eds) {
    assert.strictEqual(it.rarity.edition, "First Edition");
    assert.strictEqual(typeof it.rarity.issuedPatternDay, "number");
    assert.strictEqual(typeof it.rarity.issuedMoon, "number");
  }
  const win = items.filter((i) => i.rarity && i.rarity.type === "moon-window");
  assert.ok(win.length >= 2);
  for (const it of win) {
    assert.match(it.rarity.note, new RegExp("Issued for Moon " + it.rarity.issuedMoon + " only"));
    assert.ok(!/countdown|hurry|last chance|don't miss/i.test(it.rarity.note + it.sellingPoint), "no pressure copy: " + it.name);
  }
});

test("the own-Spark sticker pack is the seed-variant flagship", () => {
  const pack = byName.get("Your Spark, In Stickers");
  assert.ok(pack, "flagship pack exists");
  assert.strictEqual(pack.category, "stickers");
  assert.strictEqual(pack.rarity.type, "seed-variant");
  assert.match(pack.rarity.note, /one-of-one/);
});

test("provenance lineage fields ride in the catalogue", () => {
  for (const f of ["itemId", "edition", "issuedMoon", "issuedPatternDay", "obtained", "obtainedPatternDay", "fromWhom", "chainHash"])
    assert.ok(data.lineage.fields.includes(f), "lineage field: " + f);
  for (const v of ["purchased", "gifted", "earned"])
    assert.ok(data.lineage.obtainedValues.includes(v), "obtained value: " + v);
  assert.match(data.lineage.note, /no transfer/);
});

test("the fences stand in the data", () => {
  const all = data.fences.join(" ");
  assert.match(all, /never for sale/); // the Spark itself
  assert.match(all, /nothing is sold to children/i);
  assert.match(all, /No blind packs/);
  assert.match(all, /Earned goods are never sold/);
});

test("the page carries the stall, the dark till, and no checkout anywhere", () => {
  const html = fs.readFileSync(path.join(root, "docs/companions.html"), "utf8");
  assert.match(html, /id="spark-stall"/);
  assert.match(html, /The till is not open/);
  assert.match(html, /spark-goods\.js/);
  assert.match(html, /spark-goods\.css/);
  const js = fs.readFileSync(path.join(root, "docs/assets/js/spark-goods.js"), "utf8");
  for (const banned of ["stripe", "checkout", "addToCart", "buyNow", "payment"])
    assert.ok(!js.toLowerCase().includes(banned), "till must stay dark: found " + banned);
});

test("the stage can dress the Spark: many goods are stageable", () => {
  const stageable = items.filter((i) => i.stage);
  assert.ok(stageable.length >= 15, "stageable goods: " + stageable.length);
  // the three capture goods exist on the stage
  for (const n of ["The Wayfarer's Lantern", "The Kind Scarf", "The Ember Circlet"])
    assert.ok(byName.get(n).stage, n + " is stageable");
});

/* Nov 27, 2026 — Aaron's word on the voice call: every item in
   the shop is wearable by the keeper's Spark, or custom to it —
   carried, held, or been — and every item carries detail worth
   its price, with the design thought written down. */
test("every good is Spark-bound: all 65 stand on the Spark", () => {
  assert.strictEqual(items.length, 65, "the catalogue is 65 goods");
  for (const it of items) assert.ok(it.stage, "no stage drawing: " + it.name);
});

test("every good carries its full detail, design thought included", () => {
  for (const it of items) {
    assert.ok(it.detail, "no detail: " + it.name);
    for (const f of ["what", "means", "kinds", "design"])
      assert.ok(it.detail[f] && it.detail[f].length > 25, "detail." + f + " too thin: " + it.name);
  }
});

test("the converted families carry the form that binds them to the Spark", () => {
  const form = Object.fromEntries(items.map((i) => [i.id, i.form]));
  assert.strictEqual(form["brightenings---the-first-set"], "expression");
  assert.strictEqual(form["quiet-manners"], "expression");
  assert.strictEqual(form["your-spark-in-stickers"], "carried-sheet");
  assert.strictEqual(form["codex-glyph-stickers"], "carried-sheet");
  assert.strictEqual(form["observatory-night"], "ground-theme");
  assert.strictEqual(form["floating-isles-theme---spark!"], "ground-theme");
  assert.strictEqual(form["the-chronicle-shelf"], "ground-piece");
  assert.strictEqual(form["the-token-shelf"], "ground-piece");
  assert.strictEqual(form["chime-set---the-moon-tones"], "sound");
  assert.strictEqual(form["the-moon-hum-repertoire"], "sound");
  assert.strictEqual(form["game-expressions---spark!"], "game-expression");
  assert.strictEqual(form["victory-brightening---spark!"], "game-expression");
});

test("no sticker or sound line still denies the Spark its form", () => {
  for (const it of items) {
    if (it.category === "stickers" || it.category === "sound")
      assert.ok(!/wears nothing|Nothing to see/.test(it.onSpark), "stale onSpark: " + it.name);
  }
});

/* Nov 27, 2026 — the unified build (Aaron, main chat Nov 27,
   16:26–16:27 PST): one item, one id, everywhere. Goods bought
   on the site are carried to the app and the game; the detail
   is built heavily; in the game a good is presence only —
   nothing sold is power, progress, retries, or time. The law
   and the wardrobe mapping live in the catalogue's `unified`
   section; the keeper-readable record is
   docs/SPARK-GOODS-UNIFIED-DESIGN-2026-11-27.md. */
const NO_COUNTRY = "This one lives on the site and in the app; the game is not its country";
// The game's wardrobe, exactly as SPARK! carries it (Wardrobe.java).
const GAME_WARDROBE_13 = [
  "ember-cap", "moon-circlet", "star-crown", "comet-crest",
  "dawn-wrap", "river-wrap", "storm-wrap",
  "petal-trail", "comet-trail", "prism-trail",
  "candle-glow", "hearth-glow", "aurora-glow",
];

test("every good carries its story, its uses, its game presence, and its worth", () => {
  for (const it of items) {
    assert.ok(it.detail.story && it.detail.story.length > 25, "story: " + it.name);
    assert.ok(it.use && it.use.site && it.use.site.length > 25, "use.site: " + it.name);
    assert.ok(it.use.app && it.use.app.length > 25, "use.app: " + it.name);
    assert.ok(it.gamePresence && it.gamePresence.length > 25, "gamePresence: " + it.name);
    assert.ok(it.worth && it.worth.length > 25, "worth: " + it.name);
  }
});

test("the game split is honest: 43 goods have a game form, 22 say plainly they have none", () => {
  const withGame = items.filter((i) => i.use && i.use.game);
  const without = items.filter((i) => !(i.use && i.use.game));
  assert.strictEqual(withGame.length, 43, "goods with a game form");
  assert.strictEqual(without.length, 22, "goods with no game form");
  for (const it of withGame)
    assert.ok(!it.gamePresence.startsWith(NO_COUNTRY), "game form but no-country text: " + it.name);
  for (const it of without)
    assert.ok(it.gamePresence.startsWith(NO_COUNTRY), "no game form, but the card must say so: " + it.name);
  assert.deepStrictEqual(new Set(data.unified.noGameForm), new Set(without.map((i) => i.id)));
  assert.strictEqual(data.unified.counts.gamePresent, 43);
  assert.strictEqual(data.unified.counts.noGameForm, 22);
  assert.strictEqual(data.unified.counts.goods, 65);
});

test("no power promises anywhere in the new fields", () => {
  const banned = /stronger|faster|extra shots?|retr(y|ies)\b|unlock|easier|bonus power/i;
  for (const it of items) {
    const text = [it.detail.story, it.gamePresence, it.worth, ...Object.values(it.use || {})].join(" ");
    assert.ok(!banned.test(text), "power promise in the new fields of: " + it.name);
  }
});

test("the unified id space: the wardrobe mapping in the data matches the game and the catalogue", () => {
  const u = data.unified;
  assert.ok(u && u.law && u.forms && u.carryingPath.length >= 4, "the unified law stands in the data");
  const rows = u.wardrobeMapping;
  assert.strictEqual(rows.length, 13, "all thirteen wardrobe pieces are mapped");
  assert.deepStrictEqual(new Set(rows.map((r) => r.gameId)), new Set(GAME_WARDROBE_13));
  const catIds = new Set(items.map((i) => i.id));
  const sameGood = [];
  for (const r of rows) {
    assert.ok(["same-good", "slot-kin", "game-native"].includes(r.relation), "relation: " + r.gameId);
    if (r.relation === "game-native") assert.strictEqual(r.catalogueId, null, "game-native carries no catalogue id: " + r.gameId);
    else assert.ok(catIds.has(r.catalogueId), "mapped id exists in the catalogue: " + r.gameId);
    if (r.relation === "same-good") sameGood.push(r.catalogueId);
  }
  assert.deepStrictEqual(new Set(sameGood), new Set(["the-storm-wrap", "petal-drift", "comet-trail---spark!"]));
  // The three purchasable game-native pieces have no catalogue id:
  // under the law they cannot be sold anywhere until the catalogue
  // carries them, and their placeholder product ids stay inert.
  for (const gid of ["comet-crest", "prism-trail", "aurora-glow"]) {
    const row = rows.find((r) => r.gameId === gid);
    assert.ok(row && row.relation === "game-native" && row.catalogueId === null, "unsellable until catalogued: " + gid);
  }
  const fences = u.fencesCarried.join(" ");
  assert.match(fences, /never an item/); // the Spark itself
  assert.match(fences, /never purchasable/); // the earned-only tier
  assert.match(fences, /Nothing is sold to children/);
});

test("prices stand exactly as set: $2 x24, $7 x27, $19 x12, two earned at no price", () => {
  const counts = { "2": 0, "7": 0, "19": 0, "null": 0 };
  for (const it of items) counts[String(it.price)] += 1;
  assert.deepStrictEqual(counts, { "2": 24, "7": 27, "19": 12, "null": 2 });
});

test("the detail card renders the unified sections and reads the story from the record", () => {
  const js = fs.readFileSync(path.join(root, "docs/assets/js/spark-goods.js"), "utf8");
  assert.match(js, /How you\\'ll use it/);
  assert.match(js, /In the game/);
  assert.match(js, /data-use/);
  assert.match(js, /data-game/);
  assert.match(js, /d\.story \|\| rarityLine\(it\)/);
});
