/*
 * The shop shelf's selling-point truths — Nov 24, 2026.
 *
 * Pins the claims a buyer relies on, so they cannot drift
 * stale the way the homepage's app section did: the buy
 * road that works TODAY is the human-confirmed Cash App
 * door (confirm in writing first, pay second, Aaron
 * confirms receipt by hand); the book is HELD by Aaron's
 * word and not sold anywhere; the Spark goods shelf shows
 * the catalogue's 21 goods at the set band prices, display
 * only, with no buy control anywhere but the two standard
 * Tensor Band pieces; and the buyer's practical page
 * (shipping, timing, returns) stands on the page.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const shop = readFileSync(new URL("../docs/shop.html", import.meta.url), "utf8");

test("the ordering road names the Cash App door, confirm before pay", () => {
  assert.match(shop, /Cash App/);
  assert.match(shop, /\$AaronLaird7/);
  assert.match(shop, /Nothing is\s+charged before that confirmation/);
  assert.match(shop, /Aaron confirms receipt by hand/);
  assert.match(shop, /No payment before confirmation, ever/);
});

test("the book stands held, not for sale", () => {
  const card = shop.slice(shop.indexOf('id="aarons-laws"'), shop.indexOf('id="spark-connected"'));
  assert.match(card, /not publishing it\s+yet/);
  assert.match(card, /not for sale anywhere/);
  assert.match(card, /Kindle \$4\.99 · Print \$14\.99/);
});

test("the goods shelf shows all 21 goods at the set band prices, display only", () => {
  const shelf = shop.slice(shop.indexOf('id="spark-goods-shelf"'), shop.indexOf('id="tensor-bands"'));
  const cards = shelf.match(/class="good-card"/g) || [];
  assert.equal(cards.length, 21);
  for (const band of ["Pocket · $2", "Keeper · $7", "Heirloom · $19"]) {
    assert.ok(shelf.includes(band), `band shown: ${band}`);
  }
  assert.match(shelf, /Display Only/);
  assert.match(shelf, /never\s+carry the tag/);
  assert.ok(!/data-shop-item/.test(shelf), "no buy control on the goods shelf");
});

test("only the two standard Tensor Band pieces carry buy buttons", () => {
  const items = [...shop.matchAll(/data-shop-item="([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(items, ["tensor-band", "tensor-band-pair"]);
});

test("the buyer's practical page stands: shipping, timing, returns", () => {
  const s = shop.slice(shop.indexOf('id="shipping-returns"'), shop.indexOf('Living Technology Archive'));
  for (const head of ["Timing", "Photographed before it ships", "Shipping", "If something is wrong", "Returns", "Copper, honestly"]) {
    assert.ok(s.includes(head), `section present: ${head}`);
  }
  assert.match(s, /maker's word is the warranty/);
});

test("joining no longer promises Stripe alone opens the tiers", () => {
  const tiers = shop.slice(shop.indexOf('id="spark-connected"'), shop.indexOf('id="spark-goods"'));
  assert.ok(!/Joining opens the moment Stripe is connected/.test(tiers));
  assert.match(tiers, /accounts standing/);
});
