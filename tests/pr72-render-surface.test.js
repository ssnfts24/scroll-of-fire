"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

test("UI enforces render-surface verification before claiming 3D active", () => {
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  assert.ok(ui.includes("function _verifyRenderSurface("), "UI must define render-surface verifier");
  assert.ok(ui.includes("RENDER_SURFACE_INVALID"), "UI must fail over when surface validation fails");
  assert.ok(ui.includes("sphere-verify-render-surface"), "UI must wire Verify Render Surface action");
  assert.ok(ui.includes("document.elementsFromPoint"), "UI surface verifier must inspect center stack");
});

test("renderer diagnostics expose canvas ownership and first-frame pixel probe", () => {
  const renderer = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
  assert.ok(renderer.includes("sphereRenderSurface"), "renderer canvas must mark render-surface ownership");
  assert.ok(renderer.includes("firstFramePixelProbe"), "renderer diagnostics must expose first-frame pixel probe");
  assert.ok(renderer.includes("drawingBufferWidth"), "renderer diagnostics must expose drawing-buffer size");
  assert.ok(renderer.includes("contextLossCount"), "renderer diagnostics must track context loss count");
});

test("performance-runtime no longer duplicates broken-image suppression owned by site.js", () => {
  const perf = read("docs/assets/js/performance-runtime.js");
  assert.equal(perf.includes("suppressBrokenImages"), false, "performance runtime should not duplicate broken-image suppression");
});
