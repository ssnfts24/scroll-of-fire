"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

test("UI renderer orchestration keeps separate requested/active renderer state", () => {
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  assert.ok(ui.includes("requestedRendererMode"), "requested renderer mode should exist");
  assert.ok(ui.includes("activeRendererMode"), "active renderer mode should exist");
  assert.ok(ui.includes("_state.requestedRendererMode = rendererSelect.value || \"auto\""), "renderer selector should update requested mode");
  assert.ok(!ui.includes("_state.rendererMode = activeRenderer"), "active renderer sync must not overwrite requested mode");
});

test("UI renderer orchestration does not clear working renderer before 3D init", () => {
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  const start = ui.indexOf("async function _render3d(");
  const end = ui.indexOf("function _teardown3d()", start);
  const slice = start >= 0 && end > start ? ui.slice(start, end) : "";
  assert.equal(slice.includes("container.innerHTML = \"\""), false, "3D init path must not blank the container");
  assert.ok(slice.includes("_renderSvgFallback(container"), "SVG baseline should stay active while upgrading");
  assert.ok(slice.includes("_state._pending3dPayload"), "in-flight init should keep latest payload for retry/refresh safety");
});

test("URL explicit layers are locked against mode-default mutation", () => {
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  assert.ok(ui.includes("if (_urlHasExplicitLayers) return;"), "mode defaults should not override explicit URL layers");
  assert.ok(ui.includes("if (parsed.hasExplicitLayers)"), "URL parser explicit-layer marker should be respected");
});

test("Homepage mini sphere uses progressive auto renderer mode", () => {
  const home = read("docs/assets/js/home-observatory-instrument.js");
  assert.ok(home.includes("renderer: \"auto\""), "homepage should start on baseline and upgrade progressively");
});
