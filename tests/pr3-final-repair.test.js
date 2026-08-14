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
