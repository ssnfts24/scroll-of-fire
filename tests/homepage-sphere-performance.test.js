"use strict";

/* Homepage sphere performance pass (Aaron, Nov 20, 2026: "The sphere
 * kind of lags as its turning on the homepage").
 *
 * The hero sphere is the Observatory's own renderer, mounted by
 * homepage-sphere.js; its geometry, labels, motion, and readouts are
 * untouched, and no R1.7-protected file changes. The lag came from
 * the homepage's own housekeeping competing with the turning on the
 * same main thread. These tests pin the four savings so a future
 * edit cannot quietly restore the costs:
 *  - the semantic-depth sampler (home-living-interface) runs only
 *    while the instrument section is on or near the screen, and
 *    skips its DOM writes when the band has not changed — it no
 *    longer buys a full renderer diagnostics pass every 900 ms
 *    while the visitor watches the hero;
 *  - the instrument's fx glow (home-observatory-instrument) reads
 *    its size from a ResizeObserver cache instead of layout every
 *    frame, and its loop can only run while the section is on
 *    screen — a tab return no longer restarts it off-screen or
 *    starts a second chain;
 *  - living-codex fetches the growth record once per visit instead
 *    of re-fetching and re-parsing it on every refresh tick;
 *  - the hero ambient field redraws at ~20 fps instead of ~30 —
 *    the same field (its motion is a function of elapsed time),
 *    composited under the WebGL sphere less often.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const INTERFACE = read("docs/assets/js/home-living-interface.js");
const INSTRUMENT = read("docs/assets/js/home-observatory-instrument.js");
const CODEX = read("docs/assets/js/living-codex.js");
const AMBIENT = read("docs/assets/js/home-ambient-life.js");

test("depth sampler is gated on the instrument section being near the screen", () => {
  assert.match(INTERFACE, /startDepthSampler/);
  assert.match(INTERFACE, /stopDepthSampler/);
  assert.match(INTERFACE, /depthObserver/);
  assert.match(INTERFACE, /"\[data-home-live-root\]"/);
  // The 900 ms cadence itself is unchanged.
  assert.match(INTERFACE, /900/);
  // The sampler still reads renderer diagnostics for its band.
  assert.match(INTERFACE, /getRendererDiagnostics/);
  assert.match(INTERFACE, /semanticBand/);
});

test("depth readout skips DOM writes when the band has not changed", () => {
  assert.match(INTERFACE, /lastDepthBand/);
  assert.match(INTERFACE, /if \(band === lastDepthBand\) return;/);
});

test("fx glow reads size from a cache, not layout per frame", () => {
  assert.match(INSTRUMENT, /fxCanvasSize/);
  assert.match(INSTRUMENT, /new ResizeObserver/);
  const drawFxBody = INSTRUMENT.slice(INSTRUMENT.indexOf("function drawFx"));
  assert.ok(!drawFxBody.slice(0, drawFxBody.indexOf("fxCanvasSize(canvas);") + 20).includes("getBoundingClientRect"),
    "drawFx must not measure layout before using the cached size");
});

test("fx loop runs only while its section is on screen", () => {
  assert.match(INSTRUMENT, /fxOnScreen/);
  assert.match(INSTRUMENT, /!fxVisible \|\| !fxOnScreen/);
  // A tab return alone must not restart it: visibility is ANDed with on-screen state.
  assert.match(INSTRUMENT, /fxVisible = !document\.hidden && !!activeRoot && fxOnScreen;/);
});

test("fx loop does not spin for a canvas that is not rendered", () => {
  // On constrained devices the fx canvas is display:none by design;
  // painting it anyway was a 60 fps loop for an invisible glow.
  assert.match(INSTRUMENT, /if \(width <= 1 \|\| height <= 1\) return;/);
  assert.match(INSTRUMENT, /if \(size\.width > 1 && size\.height > 1\) fxSize = size;/);
});

test("living-codex fetches the growth record once per visit", () => {
  assert.match(CODEX, /recentUpdatesLoaded/);
  assert.match(CODEX, /if \(recentUpdatesLoaded\) return recentUpdates;/);
  // The moon catalog's established cache pattern is mirrored, not replaced.
  assert.match(CODEX, /if \(moonCatalog\.length\) return moonCatalog;/);
});

test("ambient field redraws at ~20 fps while drawing the same field", () => {
  assert.match(AMBIENT, /timestamp - lastFrame >= 50/);
  assert.ok(!/timestamp - lastFrame >= 33/.test(AMBIENT), "the old ~30 fps gate must not return");
  // Motion still derives from elapsed time and real deltas.
  assert.match(AMBIENT, /particle\.drift \* delta/);
  assert.match(AMBIENT, /draw\(elapsed\)/);
});
