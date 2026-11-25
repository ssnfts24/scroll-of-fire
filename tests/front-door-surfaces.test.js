"use strict";

/**
 * Front Door surfaces (Nov 23, 2026) — the door's small furniture,
 * stacked on PR #242's homepage.
 *
 * Pins the contract of the Front Door design's second section:
 * the three-hungers sorting (§i) with place honesty at the farm
 * edge (§m), the promises panel (§j) printing ONLY the lines true
 * today — the "No trackers" line must never appear while the
 * analytics tag stands (Decision 1 is Aaron's open call) — the
 * light thread out (§n), and the keeper's one-tap share (§d) on
 * the Observatory, which must capture through the renderer's own
 * exportPng route and must never reach the network.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const HTML = read("docs/index.html");
const GENERATOR = read("scripts/build-site-catalog.mjs");
const SPHERE_HTML = read("docs/living-time-sphere.html");
const SHARE_JS = read("docs/assets/js/front-door-share.js");

function frontDoorSection() {
  const start = HTML.indexOf('id="front-door"');
  assert.ok(start >= 0, "front door section exists");
  const end = HTML.indexOf("<!-- site-catalog:front-door:end -->", start);
  assert.ok(end > start, "front door section ends");
  return HTML.slice(start, end);
}

test("the sorting offers three hungers, each landing on its first gift", () => {
  const section = frontDoorSection();
  assert.match(section, /front-door-sorting/);
  assert.match(section, /<a class="front-door-card" href="living-time-sphere\.html"><strong>Curious<\/strong>/);
  assert.match(section, /<a class="front-door-card" href="garden\.html"><strong>Gardening<\/strong>/);
  assert.match(section, /<a class="front-door-card" href="companions\.html"><strong>With children<\/strong>/);
  // The children's door carries its fence in its own words.
  assert.match(section, /Nothing a child types ever leaves the device/);
});

test("place honesty: the farm edge is stated and the sky is offered instead", () => {
  const section = frontDoorSection();
  assert.match(section, /The farm record covers Western Washington's 39 counties so far/);
  assert.match(section, /<a href="living-time-sphere\.html">your sky<\/a>/);
});

test("the promises panel prints only the lines true today", () => {
  const section = frontDoorSection();
  assert.match(section, /front-door-promises/);
  for (const line of ["<li>Free.</li>", "<li>No ads.</li>", "<li>No account needed to begin.</li>", "<li>Your record lives on your device, and it is yours.</li>"]) {
    assert.ok(section.includes(line), `panel prints: ${line}`);
  }
  // Decision 1 (the analytics tag) is still Aaron's open call:
  // the "No trackers" line must NOT print, on the page or in the
  // generator that rebuilds the page.
  assert.ok(!section.includes("No trackers"), "the door does not claim 'No trackers' today");
  assert.ok(!GENERATOR.includes("<li>No trackers.</li>"), "the generator cannot print it either");
});

test("the light thread out asks for nothing", () => {
  const section = frontDoorSection();
  assert.match(section, /front-door-thread/);
  assert.match(section, /Follow the daily shares/);
  assert.match(section, /No account, no list, nothing asked of you/);
});

test("the door surfaces are generated, so regeneration cannot drop them", () => {
  for (const marker of ["front-door-sorting", "front-door-promises", "front-door-thread"]) {
    assert.ok(GENERATOR.includes(marker), `generator carries ${marker}`);
  }
});

test("the keeper's share rides the companion layer — the protected page is untouched", () => {
  const layer = read("docs/assets/js/sphere-companion-layer.js");
  assert.match(layer, /assets\/js\/front-door-share\.js/);
  assert.match(layer, /data-front-door-share/);
  // living-time-sphere.html is R1.7-protected: the surface must
  // NOT be wired into the page itself.
  assert.ok(!SPHERE_HTML.includes("front-door-share"),
    "the protected Observatory page carries no share wiring");
});

test("the share captures through the renderer's own exportPng route", () => {
  assert.match(SHARE_JS, /LivingTimeSphereRenderer3d\?\.exportPng/);
  // The day's true name comes from the one temporal authority.
  assert.match(SHARE_JS, /SOFTemporalCursor\?\.getCoordinate/);
  assert.match(SHARE_JS, /PatternCalendarData\?\.moonNames/);
  // The 2D fallback is the Observatory's own export, same caption.
  assert.match(SHARE_JS, /LivingTimeSphereExport/);
});

test("the share never reaches the network — nothing uploads", () => {
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(SHARE_JS),
    "front-door-share.js contains no network call");
});

test("the growth record carries the surfaces, and the homepage mirrors it", () => {
  const updates = JSON.parse(read("docs/assets/data/codex-updates.json"));
  assert.equal(updates[0].date, "2026-11-24");
  assert.equal(updates[0].title, "The Sphere's shining days were made true and light");
  const mirror = HTML.match(/data-le-growth[\s\S]*?<li><time datetime="2026-11-24">2026-11-24<\/time> <a href="\.\/living-time-sphere\.html">The Sphere's shining days were made true and light<\/a><\/li>/);
  assert.ok(mirror, "the homepage activity panel mirrors the newest entry (the one-redesign entry aged off the door's newest four at the sphere-upgrade landing, as entries before it aged off in their turn)");
});
