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
 *    text has not changed.
 *
 * Pass 2 (Nov 24, 2026, Aaron: "the lag and stickiness when
 * everything is turned on needs to be fixed") adds, in the same
 * spirit and the same unprotected layer:
 *  - the breathing light builds its radial gradient once per
 *    size and hue and carries the breathe in globalAlpha (the
 *    stops' colours and their 1 / 0.45 ratio are unchanged);
 *  - the Spark inhabitant finds its day plate once per posted
 *    day, caches the wrap's rect, re-reads the plate's rect only
 *    when the plate's own inline style is rewritten or the
 *    keeper is actively turning the instrument, caches the
 *    in-day station, and writes its transform only on change;
 *  - the sky dome defers renders while its panel is off screen
 *    (drawn on becoming visible) and skips renders whose inputs
 *    are unchanged;
 *  - the armillary's sun segment is memoized per civil day,
 *    place and timezone offset, and its readout lines are
 *    written only when the words change. */

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
  // The drawn light itself is unchanged: same gradient stops,
  // same colours, same 1 / 0.45 ratio — the breathe is carried
  // by globalAlpha over a cached gradient (pass 2).
  assert.ok(rebuild.includes("72%, 62%, 1)") && rebuild.includes("68%, 48%, 0.45)"));
  assert.ok(rebuild.includes("ctx.globalAlpha = alpha;"), "the breathe rides on globalAlpha");
  assert.ok(rebuild.includes("function lightGradient(w, h, hueValue)"), "the gradient is built once per size and hue");
  assert.ok(!frameBody.includes("createRadialGradient"), "frame loop must not rebuild the gradient");
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

const inhabitant = read("docs/assets/js/sphere-spark-inhabitant.js");
const skyLayer = read("docs/assets/js/sphere-sky-layer.js");

test("inhabitant: plate found once per day, rects cached, transform written on change", () => {
  assert.ok(inhabitant.includes("plateCache.el && plateCache.pd === pd && plateCache.el.isConnected"), "the plate element is kept per posted day");
  assert.ok(inhabitant.includes('attributeFilter: ["style"]'), "plate movement is signalled by the plate's own style writes");
  assert.ok(inhabitant.includes("function wrapRect()"), "the wrap's rect is cached");
  assert.ok(inhabitant.includes("if (holder.style.transform !== next) holder.style.transform = next;"), "the transform is written only when it changes");
  assert.ok(inhabitant.includes("if (stationCache) return stationCache;"), "the in-day station is cached");
  const frameStart = inhabitant.indexOf("function frame(now)");
  const frameBody = inhabitant.slice(frameStart, inhabitant.indexOf("\n    function ", frameStart + 10));
  assert.ok(!frameBody.includes("document.querySelector"), "the frame loop never hunts the document");
  assert.ok(!frameBody.includes("getBoundingClientRect"), "the frame loop reads no layout directly — positions come from the caches");
});

test("sky dome: hidden renders deferred, unchanged renders skipped", () => {
  assert.ok(skyLayer.includes("if (!domeVisible) { renderPending = true; return; }"), "an off-screen dome defers its render");
  assert.ok(skyLayer.includes("if (domeVisible && renderPending) render();"), "the deferred render is drawn when the panel comes into view");
  assert.ok(skyLayer.includes("if (renderKey === lastRenderKey) return;"), "a render with unchanged inputs is skipped");
});

test("armillary: sun segment memoized, readout lines written on change", () => {
  assert.ok(armillary.includes("function sunSegment(civil, place, engine)"), "the sun segment is computed once per day and place");
  assert.ok(armillary.includes("if (sunMemo.has(key)) return sunMemo.get(key);"), "the memo answers repeat days");
  assert.ok(armillary.includes("function setText(el, text) { if (el.textContent !== text) el.textContent = text; }"), "readout lines are written only when the words change");
});

/* Pass 3 (Nov 24, 2026, Aaron: "Upgrade the sphere for performance
 * and details and everything to work nicely") — the scheduling
 * beacons, the newest companion layer, take the same law:
 *  - a beacon's place is parsed from its label's published
 *    geometry (inline left/top centre + inline transform scale),
 *    with the label's size cached per (element, font size, text);
 *    the per-frame loop's only layout read is the fallback for a
 *    label that publishes nothing;
 *  - a beacon whose day has no label standing in the view is
 *    hidden — never left at a stale place or the layer origin;
 *  - re-rendering the model builds no throwaway beacon elements:
 *    the record carries what was rendered and is compared
 *    field by field;
 *  - the beacon stylesheet promotes no permanent layers and
 *    gives the tap a 40px target. */

const scheduleLayer = read("docs/assets/js/sphere-spark-schedule.js");
const scheduleCss = read("docs/assets/css/sphere-spark-schedule.css");

test("beacons: place parsed from the label's published geometry, size cached", () => {
  assert.ok(scheduleLayer.includes("function labelPoint(label, pd)"), "the beacon's place comes from the label's published geometry");
  assert.ok(scheduleLayer.includes("parseFloat(label.style.left)"), "the centre is read from the label's inline style, not its rect");
  assert.ok(scheduleLayer.includes("size.fontSize !== fontSize || size.text !== text"), "the size cache is keyed by element, font size and text");
  const loopStart = scheduleLayer.indexOf("function positionBeacons()");
  const loopBody = scheduleLayer.slice(loopStart, scheduleLayer.indexOf("\n  let raf", loopStart));
  assert.ok(loopBody.includes("labelPoint(label, pd)"), "the frame loop places beacons from the parsed geometry");
  assert.ok(!loopBody.includes("labelEls.get(pd).getBoundingClientRect"), "the frame loop never reads a label rect on the main road");
});

test("beacons: a day with no label standing hides its beacon", () => {
  assert.ok(scheduleLayer.includes("rec.shown = false"), "an unplaced beacon is folded away");
  assert.ok(scheduleLayer.includes('el.style.display = "none";'), "a fresh beacon starts hidden until the loop places it");
  assert.ok(scheduleLayer.includes("return { hidden: true }"), "a label laid out hidden in this view folds its beacon with it");
});

test("beacons: re-render builds no throwaway elements", () => {
  const renderStart = scheduleLayer.indexOf("function renderBeacons()");
  const renderBody = scheduleLayer.slice(renderStart, scheduleLayer.indexOf("\n  let foldNote", renderStart));
  assert.ok(renderBody.includes("existing.state !== beacon.state"), "the rendered state is compared from the record");
  assert.ok(renderBody.includes("existing.labelText !== labelText"), "the rendered words are compared from the record");
  assert.ok(!renderBody.includes("fresh.className"), "no element is built just to compare its class");
});

test("beacons stylesheet: no permanent layers, a fair tap target", () => {
  assert.ok(!scheduleCss.includes("will-change:"), "24 standing beacons hold no permanent compositor layers");
  assert.ok(scheduleCss.includes("width: 40px"), "the beacon's tap target is 40px wide");
});
