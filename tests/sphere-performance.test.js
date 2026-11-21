"use strict";

/* Sphere performance pass (Aaron, Nov 20, 2026: "The sphere needs
 * a big performance improvement", aimed at his Galaxy A16).
 *
 * The pass touches ONLY non-protected overlay layers and changes
 * no behaviour: the same light is drawn, the same orbit is flown,
 * the same words are mirrored. These tests pin the mechanisms
 * that carry the saving, so a future edit cannot quietly restore
 * the per-frame/per-mutation costs:
 *  - the held-light loop reads computed style and layout from
 *    caches (hue at most twice a second, size via ResizeObserver),
 *    never per frame;
 *  - the Spark's orbit reads its size from a ResizeObserver cache
 *    and its removal guard watches only its wrap's child list,
 *    not the whole document subtree;
 *  - the armillary readout coalesces strip-mutation renders to
 *    one per animation frame, its chrome/day-world/skyline guards
 *    stand down once their work is done instead of observing the
 *    whole page for its whole life;
 *  - the companion layer skips readout/hue work when the strip
 *    text has not changed. */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const rebuild = read("docs/assets/js/sphere-rebuild.js");
const spark = read("docs/assets/js/sphere-spark.js");
const armillary = read("docs/assets/js/sphere-armillary.js");
const companionLayer = read("docs/assets/js/sphere-companion-layer.js");

test("held light: hue and shell size are cached, not read per frame", () => {
  const frameBody = rebuild.slice(rebuild.indexOf("function frame(now)"), rebuild.indexOf("if (reducedMotion) {", rebuild.indexOf("function frame(now)")));
  assert.ok(!frameBody.includes("getComputedStyle"), "frame loop must not read computed style");
  assert.ok(!frameBody.includes("clientWidth") && !frameBody.includes("clientHeight"), "frame loop must not read layout size");
  assert.ok(rebuild.includes("hueReadAt") && rebuild.includes(">= 500"), "hue cache refresh window stands");
  assert.ok(rebuild.includes('new ResizeObserver(measureShell)'), "shell size is kept by a ResizeObserver");
  // The drawn light itself is unchanged: same gradient stops.
  assert.ok(rebuild.includes("72%, 62%, ${alpha}") && rebuild.includes("68%, 48%, ${alpha * 0.45}"));
});

test("spark orbit: size cached, z-index written on side change only, guard narrowed", () => {
  assert.ok(spark.includes("new ResizeObserver(measureWrap)"), "orbit size kept by a ResizeObserver");
  assert.ok(spark.includes("front !== lastFront"), "z-index written only when the Spark crosses");
  assert.ok(spark.includes("}).observe(wrap, { childList: true });"), "removal guard watches the wrap's child list");
  assert.ok(!spark.includes("}).observe(document.body, { childList: true, subtree: true });\n    }\n    return holder;"), "no whole-document subtree guard remains on the orbit");
  // The orbit's own math is untouched.
  assert.ok(spark.includes("const angle = (now / 26000) * Math.PI * 2 + 0.8;"));
  assert.ok(spark.includes("0.82 + depth * 0.33"));
});

test("armillary: readout renders coalesce to one per frame", () => {
  assert.ok(armillary.includes("function renderSoon()"), "coalesced renderer stands");
  assert.ok(armillary.includes("new MutationObserver(renderSoon).observe(strip"), "strip observer uses the coalesced render");
  assert.ok(armillary.includes("window.setInterval(render, 4000);"), "the standing 4s refresh is unchanged");
});

test("armillary: page-wide guards stand down when their work is done", () => {
  assert.ok(armillary.includes("chromeWatcher.disconnect()"), "chrome guard disconnects once both pieces are folded");
  assert.ok(armillary.includes("bodyWatcher.disconnect()"), "day-world and skyline body watches disconnect after adoption");
  assert.ok(armillary.includes("new MutationObserver(dressDayWorld).observe(sheet, { childList: true })"), "day-world watch narrows to the sheet itself");
});

test("companion layer: unchanged strip text skips mirror and hue work", () => {
  assert.ok(companionLayer.includes("if (text === lastMirroredText) return;"));
  assert.ok(companionLayer.includes("if (hueText === lastHueText) return;"));
});
