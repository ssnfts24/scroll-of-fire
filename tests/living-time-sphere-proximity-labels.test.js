"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }

function loadLabelManager() {
  const context = {
    globalThis: null,
    window: { innerWidth: 390 },
    console,
    Set,
    Map,
    Object,
    Array,
    Number,
    String,
    Math
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(read("docs/assets/js/sphere/living-time-sphere-label-manager.js"), context);
  return context.LivingTimeSphereLabelManager;
}

test("semantic targets normalize bounded enter/reset hysteresis", () => {
  const api = loadLabelManager();
  const target = api._internals.normalizeSemanticTarget({
    id: "moon-5",
    label: "Moon 5",
    position: { x: 1, y: 0, z: 0 },
    showDistance: 1.8,
    resetDistance: 2.2
  });
  assert.equal(target.id, "moon-5");
  assert.equal(target.showDistance, 1.8);
  assert.equal(target.resetDistance, 2.2);
});

test("dismissal persists in-zone and resets only after exit distance", () => {
  const api = loadLabelManager();
  const state = api._internals.createProximityState();
  const target = {
    id: "equinox",
    label: "March Equinox",
    position: { x: 0, y: 0, z: 0 },
    showDistance: 2.25,
    resetDistance: 2.68
  };
  assert.equal(state.resolve(target, 2.0).visible, true);
  assert.equal(state.dismiss("equinox"), true);
  assert.equal(state.resolve(target, 2.1).visible, false);
  assert.equal(state.resolve(target, 2.5).dismissed, true);
  const exited = state.resolve(target, 2.8);
  assert.equal(exited.reset, true);
  assert.equal(exited.dismissed, false);
  assert.equal(state.resolve(target, 2.0).visible, true);
});

test("semantic label budgets are hard-capped for phone and desktop", () => {
  const api = loadLabelManager();
  assert.equal(api.constants.SEMANTIC_TARGET_CAP, 96);
  assert.equal(api.constants.SEMANTIC_MOBILE_LABEL_CAP, 6);
  assert.equal(api.constants.SEMANTIC_DESKTOP_LABEL_CAP, 12);
});

test("renderer routes semantic targets through existing render lifecycle", () => {
  const code = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
  assert.match(code, /function _buildSemanticTargets\(/);
  assert.match(code, /semanticTargets: _buildSemanticTargets\(\)/);
  assert.match(code, /_moonLabelManager\?\.dispose\?\.\(\)/);
  assert.doesNotMatch(code, /semanticLabel.*requestAnimationFrame/i);
});

test("base target registry covers the principal sphere marker classes", () => {
  const code = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
  for (const id of ["moon-", "live-today", "selected-day", "year-gate", "march-equinox", "lunar-today", "solar-today", "spiral-year-"]) {
    assert.ok(code.includes(id), `missing semantic target ${id}`);
  }
});

test("temporal strata and Life Atlas contribute semantic targets without scene traversal", () => {
  const host = read("docs/assets/js/sphere/living-time-sphere-extension-host.js");
  const strata = read("docs/assets/js/sphere/living-time-sphere-temporal-strata.js");
  const lifeAtlas = read("docs/assets/js/sphere/life-atlas-record-sphere-extension.js");
  assert.match(host, /semanticTargetsAll/);
  assert.match(strata, /semanticTargets\(context\)/);
  assert.match(strata, /strata-year-/);
  assert.match(lifeAtlas, /Private Life Atlas record/);
  assert.match(lifeAtlas, /semanticTargets\(\)/);
});

test("interactive overlay has dismissal CSS and is not aria-hidden", () => {
  const css = read("docs/assets/css/living-time-sphere.css");
  const html = read("docs/living-time-sphere.html");
  assert.match(css, /\.sphere-semantic-label-close/);
  assert.match(css, /pointer-events:\s*auto/);
  assert.match(html, /id="sphere-moon-labels" aria-label="Sphere labels"/);
  assert.doesNotMatch(html, /id="sphere-moon-labels" aria-hidden="true"/);
});

test("service worker caches semantic temporal legibility dependency", () => {
  const sw = read("docs/service-worker.js");
  assert.ok(sw.includes("./assets/js/sphere/living-time-sphere-temporal-legibility.js"));
  assert.ok(sw.includes("./assets/js/sphere/living-time-sphere-temporal-strata.js"));
  assert.ok(sw.includes("./assets/js/sphere/life-atlas-record-sphere-extension.js"));
});

test("semantic proximity envelope expands monotonically with zoom detail", () => {
  const api = loadLabelManager();
  const target = {
    id: "moon-5",
    label: "Moon 5",
    position: { x: 1, y: 0, z: 0 },
    showDistance: 1.8,
    resetDistance: 2.18
  };

  const medium = api._internals.resolveProximityEnvelope(target, {
    band: "medium",
    mobile: true
  });
  const near = api._internals.resolveProximityEnvelope(target, {
    band: "near",
    mobile: true
  });
  const detail = api._internals.resolveProximityEnvelope(target, {
    band: "detail",
    mobile: true
  });

  assert.ok(medium.showDistance > 1.8);
  assert.ok(near.showDistance > medium.showDistance);
  assert.ok(detail.showDistance > near.showDistance);
  assert.ok(detail.resetDistance > detail.showDistance);
});

test("selected semantic target has a phone-safe proximity floor", () => {
  const api = loadLabelManager();
  const target = api._internals.resolveProximityEnvelope({
    id: "selected-moon",
    label: "Selected Moon",
    position: { x: 1, y: 0, z: 0 },
    showDistance: 1.8,
    resetDistance: 2.18,
    selected: true
  }, {
    band: "medium",
    mobile: true
  });

  assert.ok(target.showDistance >= 3.25);
  assert.ok(target.resetDistance >= target.showDistance + 0.42);
});

test("renderer passes semantic zoom band into proximity label manager", () => {
  const code = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
  assert.match(code, /semanticBand:\s*[\s\S]{0,180}_semanticZoomState\?\.band/);
  assert.match(code, /_activeSemanticBand/);
});

