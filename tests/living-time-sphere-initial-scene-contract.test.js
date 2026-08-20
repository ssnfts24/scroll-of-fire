const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const renderer = fs.readFileSync(path.resolve(__dirname, "../docs/assets/js/sphere/living-time-sphere-renderer-3d.js"), "utf8");
const html = fs.readFileSync(path.resolve(__dirname, "../docs/living-time-sphere.html"), "utf8");
const ui = fs.readFileSync(path.resolve(__dirname, "../docs/assets/js/sphere/living-time-sphere-ui.js"), "utf8");

test("3D extensions hydrate after the core first frame without blocking interaction", () => {
  assert.match(renderer, /B7\.50: extension hydration no longer blocks first paint/);
  assert.match(renderer, /function _scheduleDeferredExtensionHydration\(\)/);
  assert.match(renderer, /lifecycle: "deferred-mount"/);
  assert.match(renderer, /lifecycle: "deferred-initial-sync"/);
  assert.match(renderer, /extensions-deferred-ready/);
});

test("refreshes arriving during async init are queued and committed", () => {
  assert.match(renderer, /_pendingRefresh/);
  assert.match(renderer, /refresh-queued-during-init/);
  assert.match(renderer, /pending-refresh-commit/);
});

test("Living Strata are declaratively enabled on first load", () => {
  assert.match(html, /id="sphere-strata-enabled" type="checkbox" checked/);
  assert.match(html, /value="balanced" selected>Past \+ future/);
});

test("Reality State distinguishes record, present being, and future planning", () => {
  assert.match(html, /id="sphere-reality-state"/);
  assert.match(ui, /Future · Possibility/);
  assert.match(ui, /Future geometry is not a prediction/);
});
