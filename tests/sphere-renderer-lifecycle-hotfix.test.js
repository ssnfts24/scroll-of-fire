"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

test("WebGL capability probing is cached and releases its temporary context", () => {
  let canvasCreateCount = 0;
  let loseContextCount = 0;
  const gl = {
    getExtension(name) {
      if (name !== "WEBGL_lose_context") return null;
      return { loseContext() { loseContextCount += 1; } };
    },
  };
  const context = {
    console,
    setTimeout,
    clearTimeout,
    navigator: { deviceMemory: 4, hardwareConcurrency: 8, connection: null },
    devicePixelRatio: 2,
    document: {
      createElement() {
        canvasCreateCount += 1;
        return {
          getContext(type) {
            if (type === "webgl2") return null;
            if (type === "webgl" || type === "experimental-webgl") return gl;
            return null;
          },
        };
      },
    },
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  new vm.Script(read("docs/assets/js/sphere/observatory-capability-manager.js")).runInContext(context);

  const first = context.ObservatoryCapabilityManager.probeWebGl();
  const second = context.ObservatoryCapabilityManager.probeWebGl();
  assert.equal(first.webgl, true);
  assert.equal(second.webgl, true);
  assert.equal(canvasCreateCount, 1, "repeated diagnostics must reuse one cached capability result");
  assert.equal(loseContextCount, 1, "the temporary probe context must be explicitly released");
});

test("renderer owns one generation-tagged canvas and prunes orphan generations", () => {
  const renderer = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
  assert.ok(renderer.includes("function _pruneRendererOwnedCanvases("));
  assert.ok(renderer.includes('"pre-init-orphan-cleanup"'));
  assert.ok(renderer.includes('"post-append-orphan-cleanup"'));
  assert.ok(renderer.includes('"renderer-teardown"'));
  assert.ok(renderer.includes("sphereRenderGeneration"));
  assert.ok(renderer.includes("function getCanvas()"));
  assert.equal(
    renderer.slice(renderer.indexOf("function getDiagnostics()"), renderer.indexOf("function exportPng"))
      .includes('document.createElement("canvas")'),
    false,
    "diagnostics must not allocate WebGL probe canvases"
  );
});

test("full-page UI suppresses duplicate initialization and resets before retry", () => {
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  assert.ok(ui.includes("duplicate-ui-init-suppressed"));
  assert.ok(ui.includes("function _disposeRendererForRetry("));
  assert.ok(ui.includes('_disposeRendererForRetry(container, "context-lost")'));
  assert.ok(ui.includes('_scheduleRetry(container, "context-lost")'));
  const lostStart = ui.indexOf("onContextLost: () => {");
  const restoredStart = ui.indexOf("onContextRestored: () => {", lostStart);
  const lostHandler = ui.slice(lostStart, restoredStart);
  assert.equal(
    lostHandler.includes("renderSphere(container)"),
    false,
    "context loss must not immediately launch another renderer on top of the lost canvas"
  );
});
