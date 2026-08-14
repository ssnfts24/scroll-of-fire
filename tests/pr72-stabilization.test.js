"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

test("standalone sphere page isolates moons/app-enhancement dependencies", () => {
  const html = read("docs/living-time-sphere.html");
  assert.ok(!html.includes("assets/css/moons.css"), "standalone sphere must not load moons.css");
  assert.ok(!html.includes("assets/js/living-time-app-enhancements.js"), "standalone sphere must not load broad app-enhancements JS");
  assert.ok(!html.includes("assets/css/living-time-app-enhancements.css"), "standalone sphere must not load broad app-enhancements CSS");
  assert.ok(html.includes("assets/css/living-time-sphere-metrics.css"), "standalone sphere should load isolated metrics CSS");
  assert.ok(html.includes("assets/js/sphere/living-time-sphere-metrics.js"), "standalone sphere should load isolated metrics JS");
});

test("layer visibility path is visibility-first and defers repair", () => {
  const renderer = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
  assert.ok(renderer.includes("function _queueSceneRepair("), "renderer should expose deferred scene-repair queue");
  const setLayerVisibilityStart = renderer.indexOf("function setLayerVisibility(");
  const setLayerStatesStart = renderer.indexOf("function setLayerStates(");
  const setLayerVisibilitySection = setLayerVisibilityStart >= 0 && setLayerStatesStart > setLayerVisibilityStart
    ? renderer.slice(setLayerVisibilityStart, setLayerStatesStart)
    : "";
  assert.ok(setLayerVisibilitySection.includes("_queueSceneRepair(\"layer-visibility\")"), "single-layer toggle should queue repair");
  assert.equal(setLayerVisibilitySection.includes("updateScene("), false, "single-layer toggle should not synchronously rebuild scene");
});

test("batched layer visibility updates defer repair and avoid immediate rebuild", () => {
  const renderer = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
  const setLayerStatesStart = renderer.indexOf("function setLayerStates(");
  const spiralGeometryStart = renderer.indexOf("function _spiralGeometrySignature(", setLayerStatesStart);
  const setLayerStatesSection = setLayerStatesStart >= 0 && spiralGeometryStart > setLayerStatesStart
    ? renderer.slice(setLayerStatesStart, spiralGeometryStart)
    : "";
  assert.ok(setLayerStatesSection.includes("_queueSceneRepair(\"layer-batch-visibility\")"), "batched toggle should queue repair");
  assert.equal(setLayerStatesSection.includes("updateScene("), false, "batched toggle should not synchronously rebuild scene");
});

test("ui coalesces rapid layer changes into batched renderer updates", () => {
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  assert.ok(ui.includes("function _requestLayerStateUpdate("), "UI should expose layer state queue");
  assert.ok(ui.includes("requestAnimationFrame(_flushLayerStateUpdates)"), "UI should flush layer changes per frame");
  assert.ok(ui.includes("renderer.setLayerStates(pending)"), "UI should batch apply layer states");
});

test("broad document mutation observer removed from app enhancements", () => {
  const enhancements = read("docs/assets/js/living-time-app-enhancements.js");
  assert.equal(enhancements.includes("new MutationObserver"), false, "app enhancements should not mount a whole-document observer");
});

