"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

test("view-mode transitions use requested/active atomic state fields", () => {
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  assert.ok(ui.includes("requestedViewMode"), "requested view mode should be tracked");
  assert.ok(ui.includes("activeViewMode"), "active view mode should be tracked");
  assert.ok(ui.includes("modeTransitionState"), "mode transition state should be tracked");
  assert.ok(ui.includes("modeTransitionRevision"), "mode transition revision should be tracked");
  assert.ok(ui.includes("latestRequestedMode"), "latest requested mode should be tracked");
  assert.ok(ui.includes("function _requestViewModeTransition("), "view-mode request API should exist");
  assert.ok(ui.includes("function _flushViewModeTransitions("), "view-mode transaction pipeline should exist");
  assert.ok(ui.includes("_requestViewModeTransition(container, mode)"), "mode buttons should route through the mode transaction path");
});

test("renderer caches spiral and passage geometry between mode toggles", () => {
  const renderer = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
  assert.ok(renderer.includes("function _spiralGeometrySignature("), "spiral signature helper should exist");
  assert.ok(renderer.includes("function _passageGeometrySignature("), "passage signature helper should exist");
  assert.ok(renderer.includes("_lastSpiralGeometryKey"), "spiral geometry cache key should exist");
  assert.ok(renderer.includes("_lastPassageGeometryKey"), "passage geometry cache key should exist");
  assert.ok(renderer.includes("_positionSelectionRingForYear"), "selected year ring should reuse cached spiral anchors");
});

test("environment bridge copy is decoupled from layer visibility and provider lifecycle", () => {
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  assert.ok(ui.includes("Weather loading in background"), "environment text should distinguish provider loading");
  assert.ok(ui.includes("Environment layer OFF"), "environment text should preserve layer OFF semantics");
  assert.ok(ui.includes("else if (_state.visibleLayers.environment)"), "environment change handler should avoid full rerender when layer is off");
});

test("global broken-media fallback collapses non-image failed resources", () => {
  const site = read("docs/assets/js/site.js");
  const css = read("docs/assets/css/codex.css");
  assert.ok(site.includes("object,iframe,embed,video,source,picture,svg image"), "global fallback should watch non-image media");
  assert.ok(site.includes("image-fallback-shell-hidden"), "failed media shells should be collapsed");
  assert.ok(css.includes(".image-fallback-shell-hidden"), "global css should hide collapsed media shells");
});

test("version metadata exports build marker fields for diagnostics", () => {
  const version = read("docs/assets/js/sphere/living-time-sphere-version.js");
  assert.ok(version.includes("buildMetadata"), "version module should expose build metadata");
  assert.ok(version.includes("commitSha"), "build metadata should include commit sha field");
  assert.ok(version.includes("buildTimestamp"), "build metadata should include build timestamp field");
  assert.ok(version.includes("rendererVersion"), "build metadata should include renderer version field");
});
