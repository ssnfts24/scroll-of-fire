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
