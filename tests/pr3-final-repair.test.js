"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

test("renderer 3d readiness gate and diagnostics keys exist", () => {
  const code = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
  assert.ok(code.includes("SCENE_CONTENT_INCOMPLETE"), "3D init should fail when scene-content readiness fails");
  [
    "sceneObjectCount",
    "visibleObjectCount",
    "meshCount",
    "lineCount",
    "patternGroupChildren",
    "astronomyGroupChildren",
    "selectedGroupChildren",
    "activeLayerSet",
    "sceneBounds",
    "cameraPosition",
    "cameraTarget",
    "cameraNear",
    "cameraFar",
    "lastSceneBuildTimestamp",
    "geometryBuildRevision"
  ].forEach(key => assert.ok(code.includes(key), `expected diagnostics key: ${key}`));
});

test("svg fallback rendering avoids destructive container wipes", () => {
  const svg = read("docs/assets/js/sphere/living-time-sphere-renderer-svg.js");
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  assert.equal(svg.includes("container.innerHTML = svg"), false, "svg renderer should not blank container");
  assert.ok(svg.includes("replaceWith(nextSvg)"), "svg renderer should replace only the baseline node");
  assert.equal(ui.includes("container.innerHTML = \"\""), false, "ui fallback path should not wipe container");
});

test("selected-day updates use lightweight renderer path and diagnostics counters", () => {
  const renderer = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  assert.ok(renderer.includes("function updateSelectedState("), "renderer should expose selected-day incremental update API");
  assert.ok(renderer.includes("selectedStateUpdateCount"), "renderer diagnostics should track lightweight selected-state updates");
  assert.ok(renderer.includes("updateSelectedState,"), "renderer export should include updateSelectedState");
  assert.ok(ui.includes("renderer.updateSelectedState({"), "UI selected-day transaction should call renderer.updateSelectedState");
  assert.ok(ui.includes("selectedLightweightUpdateCount"), "UI diagnostics should track lightweight selected-day updates");
});

test("day navigation routes through selected-day transaction pipeline", () => {
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  assert.ok(ui.includes("function _requestSelectedDayUpdate(container, day)"), "selected-day request API should exist");
  assert.ok(ui.includes("function _flushSelectedDayUpdates(container)"), "selected-day queue/coalescing pipeline should exist");
  assert.ok(ui.includes("shiftSelectedDay = delta =>"), "day shift control should exist");
  assert.ok(ui.includes("_requestSelectedDayUpdate(container, baseDay + delta)"), "Next/Previous day should use selected-day transaction path");
  assert.ok(ui.includes("window.addEventListener(\"popstate\""), "history back/forward should route through same selected-day update path");
});

test("spiral geometry is cached between adjacent selected-day updates", () => {
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  assert.ok(ui.includes("function _getCachedSpiral()"), "UI should cache spiral for non-structural day updates");
  assert.ok(ui.includes("const spiral   = _getCachedSpiral();"), "full render should reuse cached spiral");
  assert.ok(ui.includes("const spiral = _getCachedSpiral();"), "selected-day update path should reuse cached spiral");
});

test("broken bottom resource handling captures fixed/sticky diagnostics and collapses broken shells", () => {
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  const css = read("docs/assets/css/living-time-sphere.css");
  const site = read("docs/assets/js/site.js");
  assert.ok(ui.includes("function _collectFixedStickyDiagnostics()"), "runtime diagnostics should include fixed/sticky nodes");
  assert.ok(ui.includes("sphere-broken-resource-shell-hidden"), "UI broken-resource guard should collapse broken media shells");
  assert.ok(css.includes(".sphere-broken-resource-shell-hidden { display:none !important; }"), "CSS should hide collapsed broken shells");
  assert.ok(site.includes("if (shell) shell.hidden = true;"), "global image fallback should hide failed media shells");
});
