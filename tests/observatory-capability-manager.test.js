"use strict";

// Observatory Capability Manager — unit tests (PR1)
// Covers: fallback reason taxonomy, performance tier selection,
// pixel-ratio capping, legacy reason mapping, and module structure.

const assert = require("node:assert/strict");
const fs     = require("node:fs");
const path   = require("node:path");
const test   = require("node:test");
const vm     = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

const CAP_MGR_FILE = "docs/assets/js/sphere/observatory-capability-manager.js";

// ── Build a minimal globalThis context that satisfies the module ──────

function loadCapabilityManager(overrides = {}) {
  const ctx = {
    globalThis: null,
    console,
    setTimeout,
    clearTimeout,
    navigator: {
      deviceMemory: 8,
      hardwareConcurrency: 8,
      connection: null,
    },
    window: null,
    document: {
      createElement() {
        // Return a fake canvas that reports WebGL available by default
        return {
          getContext(type) {
            if (overrides.noWebgl) return null;
            if (type === "webgl2") return overrides.noWebgl2 ? null : {};
            if (type === "webgl" || type === "experimental-webgl") return {};
            return null;
          },
        };
      },
    },
    devicePixelRatio: 2,
    matchMedia: null,
    ...overrides,
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  const code = read(CAP_MGR_FILE);
  new vm.Script(code).runInContext(ctx);
  return ctx.ObservatoryCapabilityManager;
}

// ── JS syntax ─────────────────────────────────────────────────────────

test("observatory-capability-manager.js has valid JS syntax", () => {
  const code = read(CAP_MGR_FILE);
  assert.doesNotThrow(() => new vm.Script(code), "Must parse without syntax errors");
});

// ── Module structure ──────────────────────────────────────────────────

test("ObservatoryCapabilityManager is exported on globalThis", () => {
  const mgr = loadCapabilityManager();
  assert.ok(mgr, "module should expose ObservatoryCapabilityManager");
});

test("ObservatoryCapabilityManager is frozen", () => {
  const mgr = loadCapabilityManager();
  assert.ok(Object.isFrozen(mgr), "API object must be frozen");
});

// ── Fallback reason taxonomy ──────────────────────────────────────────

test("FALLBACK_REASONS contains all required taxonomy codes", () => {
  const mgr = loadCapabilityManager();
  const required = [
    "WEBGL_UNSUPPORTED",
    "THREE_IMPORT_FAILED",
    "CANVAS_INIT_FAILED",
    "CONTEXT_LOST",
    "DEVICE_MEMORY_GUARD",
    "INIT_TIMEOUT",
    "QUALITY_SVGONLY",
    "INIT_EXCEPTION",
    "MISSING_DEPENDENCY",
  ];
  for (const code of required) {
    assert.ok(mgr.FALLBACK_REASONS[code], `FALLBACK_REASONS must include ${code}`);
  }
});

test("FALLBACK_REASONS is frozen", () => {
  const mgr = loadCapabilityManager();
  assert.ok(Object.isFrozen(mgr.FALLBACK_REASONS), "FALLBACK_REASONS must be frozen");
});

test("FALLBACK_REASONS values are non-empty strings", () => {
  const mgr = loadCapabilityManager();
  for (const [key, val] of Object.entries(mgr.FALLBACK_REASONS)) {
    assert.equal(typeof val, "string", `${key} value must be a string`);
    assert.ok(val.length > 0, `${key} value must not be empty`);
  }
});

// ── Performance tiers ─────────────────────────────────────────────────

test("PERFORMANCE_TIERS contains expected tier keys", () => {
  const mgr = loadCapabilityManager();
  assert.ok(mgr.PERFORMANCE_TIERS.HIGH,     "HIGH tier must exist");
  assert.ok(mgr.PERFORMANCE_TIERS.BALANCED, "BALANCED tier must exist");
  assert.ok(mgr.PERFORMANCE_TIERS.LOWPOWER, "LOWPOWER tier must exist");
  assert.ok(mgr.PERFORMANCE_TIERS.MINIMAL,  "MINIMAL tier must exist");
});

test("PERFORMANCE_TIERS is frozen", () => {
  const mgr = loadCapabilityManager();
  assert.ok(Object.isFrozen(mgr.PERFORMANCE_TIERS), "PERFORMANCE_TIERS must be frozen");
});

// ── selectTier ────────────────────────────────────────────────────────

test("selectTier returns HIGH for capable device", () => {
  const mgr = loadCapabilityManager({ noWebgl: false });
  const tier = mgr.selectTier({ webglAvailable: true });
  assert.equal(tier, mgr.PERFORMANCE_TIERS.HIGH, "Capable device should get HIGH tier");
});

test("selectTier returns MINIMAL when WebGL unavailable", () => {
  const mgr = loadCapabilityManager({ noWebgl: true });
  const tier = mgr.selectTier({ webglAvailable: false });
  assert.equal(tier, mgr.PERFORMANCE_TIERS.MINIMAL, "No WebGL should force MINIMAL tier");
});

test("selectTier respects explicit override", () => {
  const mgr = loadCapabilityManager();
  const tier = mgr.selectTier({ override: mgr.PERFORMANCE_TIERS.LOWPOWER, webglAvailable: true });
  assert.equal(tier, mgr.PERFORMANCE_TIERS.LOWPOWER, "Override must be respected");
});

test("selectTier ignores invalid override and auto-selects", () => {
  const mgr = loadCapabilityManager();
  const tier = mgr.selectTier({ override: "invalid_tier", webglAvailable: true });
  // Should auto-select (not crash), result is HIGH for capable device
  assert.ok(Object.values(mgr.PERFORMANCE_TIERS).includes(tier), "Should return a valid tier");
});

// ── clampPixelRatio ───────────────────────────────────────────────────

test("clampPixelRatio caps DPR to tier maximum for HIGH tier", () => {
  const mgr = loadCapabilityManager();
  const result = mgr.clampPixelRatio(mgr.PERFORMANCE_TIERS.HIGH, 3.0);
  assert.ok(result <= 2.5, `HIGH tier cap is 2.5; got ${result}`);
});

test("clampPixelRatio caps DPR to tier maximum for LOWPOWER tier", () => {
  const mgr = loadCapabilityManager();
  const result = mgr.clampPixelRatio(mgr.PERFORMANCE_TIERS.LOWPOWER, 3.0);
  assert.ok(result <= 1.5, `LOWPOWER tier cap is 1.5; got ${result}`);
});

test("clampPixelRatio returns at least 0.5 for very low DPR", () => {
  const mgr = loadCapabilityManager();
  const result = mgr.clampPixelRatio(mgr.PERFORMANCE_TIERS.BALANCED, 0.1);
  assert.ok(result >= 0.5, `Result should be at least 0.5; got ${result}`);
});

test("clampPixelRatio returns finite number", () => {
  const mgr = loadCapabilityManager();
  const result = mgr.clampPixelRatio(mgr.PERFORMANCE_TIERS.BALANCED, 2.0);
  assert.ok(Number.isFinite(result), "clampPixelRatio should return a finite number");
});

// ── mapLegacyReason ───────────────────────────────────────────────────

test("mapLegacyReason maps known legacy strings to canonical codes", () => {
  const mgr = loadCapabilityManager();
  assert.equal(mgr.mapLegacyReason("webgl-unavailable"),    mgr.FALLBACK_REASONS.WEBGL_UNSUPPORTED);
  assert.equal(mgr.mapLegacyReason("three-load-failed"),    mgr.FALLBACK_REASONS.THREE_IMPORT_FAILED);
  assert.equal(mgr.mapLegacyReason("webgl-context-failed"), mgr.FALLBACK_REASONS.CANVAS_INIT_FAILED);
  assert.equal(mgr.mapLegacyReason("quality-svgonly"),      mgr.FALLBACK_REASONS.QUALITY_SVGONLY);
  assert.equal(mgr.mapLegacyReason("init-exception"),       mgr.FALLBACK_REASONS.INIT_EXCEPTION);
  assert.equal(mgr.mapLegacyReason("init-timeout"),         mgr.FALLBACK_REASONS.INIT_TIMEOUT);
});

test("mapLegacyReason passes through unknown strings unchanged", () => {
  const mgr = loadCapabilityManager();
  assert.equal(mgr.mapLegacyReason("unknown-custom-reason"), "unknown-custom-reason");
});

test("mapLegacyReason passes through canonical codes unchanged", () => {
  const mgr = loadCapabilityManager();
  const code = mgr.FALLBACK_REASONS.CONTEXT_LOST;
  assert.equal(mgr.mapLegacyReason(code), code, "Canonical codes should pass through");
});

// ── describeReason ────────────────────────────────────────────────────

test("describeReason returns non-empty string for all known codes", () => {
  const mgr = loadCapabilityManager();
  for (const code of Object.values(mgr.FALLBACK_REASONS)) {
    const desc = mgr.describeReason(code);
    assert.equal(typeof desc, "string", `${code} must return a string`);
    assert.ok(desc.length > 0, `${code} must return non-empty description`);
  }
});

test("describeReason returns a fallback string for unknown code", () => {
  const mgr = loadCapabilityManager();
  const desc = mgr.describeReason("TOTALLY_UNKNOWN");
  assert.ok(desc.includes("TOTALLY_UNKNOWN"), "Unknown code should appear in fallback description");
});

// ── probeWebGl ────────────────────────────────────────────────────────

test("probeWebGl returns boolean fields", () => {
  const mgr = loadCapabilityManager();
  const result = mgr.probeWebGl();
  assert.equal(typeof result.webgl,  "boolean", "webgl field must be boolean");
  assert.equal(typeof result.webgl2, "boolean", "webgl2 field must be boolean");
});

test("probeWebGl returns webgl:true when canvas context succeeds", () => {
  const mgr = loadCapabilityManager(); // default: webgl available
  const result = mgr.probeWebGl();
  assert.ok(result.webgl, "Should report webgl available");
});

// ── attachContextLossGuard ────────────────────────────────────────────

test("attachContextLossGuard returns a dispose function", () => {
  const mgr = loadCapabilityManager();
  // Minimal fake canvas
  const listeners = {};
  const fakeCanvas = {
    addEventListener(type, fn, opts) { listeners[type] = fn; },
    removeEventListener(type, fn, opts) { delete listeners[type]; },
  };
  const dispose = mgr.attachContextLossGuard(fakeCanvas, {
    onLost() {},
    onRestored() {},
  });
  assert.equal(typeof dispose, "function", "Should return a dispose function");
  assert.doesNotThrow(() => dispose(), "dispose should not throw");
});

test("attachContextLossGuard calls onLost when context is lost", () => {
  const mgr = loadCapabilityManager();
  let lostCalled = false;
  const listeners = {};
  const fakeCanvas = {
    addEventListener(type, fn) { listeners[type] = fn; },
    removeEventListener() {},
  };
  mgr.attachContextLossGuard(fakeCanvas, {
    onLost() { lostCalled = true; },
  });
  // Simulate context loss event
  listeners["webglcontextlost"]?.({ preventDefault() {} });
  assert.ok(lostCalled, "onLost should be called when webglcontextlost fires");
});

test("attachContextLossGuard calls onRestored when context is restored", () => {
  const mgr = loadCapabilityManager();
  let restoredCalled = false;
  const listeners = {};
  const fakeCanvas = {
    addEventListener(type, fn) { listeners[type] = fn; },
    removeEventListener() {},
  };
  mgr.attachContextLossGuard(fakeCanvas, {
    onRestored() { restoredCalled = true; },
  });
  listeners["webglcontextrestored"]?.();
  assert.ok(restoredCalled, "onRestored should be called when webglcontextrestored fires");
});

test("attachContextLossGuard returns no-op function for null canvas", () => {
  const mgr = loadCapabilityManager();
  const dispose = mgr.attachContextLossGuard(null, {});
  assert.equal(typeof dispose, "function", "Should return a function even for null canvas");
  assert.doesNotThrow(() => dispose(), "no-op dispose should not throw");
});

// ── initTimeout ───────────────────────────────────────────────────────

test("initTimeout rejects after given delay with INIT_TIMEOUT reason", async () => {
  const mgr = loadCapabilityManager();
  const start = Date.now();
  try {
    await mgr.initTimeout(50);
    assert.fail("Should have rejected");
  } catch (err) {
    assert.equal(err.reason, mgr.FALLBACK_REASONS.INIT_TIMEOUT, "Rejection reason should be INIT_TIMEOUT");
    const elapsed = Date.now() - start;
    assert.ok(elapsed >= 40, `Should take at least 40ms, took ${elapsed}ms`);
  }
});

// ── Service worker: caches capability manager ─────────────────────────

test("Service worker caches observatory-capability-manager.js", () => {
  const sw = read("docs/service-worker.js");
  assert.ok(sw.includes("observatory-capability-manager.js"), "Service worker must cache capability manager");
});

// ── HTML: capability manager script is included ───────────────────────

test("Sphere page includes observatory-capability-manager.js script", () => {
  const html = read("docs/living-time-sphere.html");
  assert.ok(html.includes("observatory-capability-manager.js"), "HTML must include capability manager script");
});

test("Sphere page: capability manager loads before renderer-3d", () => {
  const html = read("docs/living-time-sphere.html");
  const iCap = html.search(/<script[^>]+src="assets\/js\/sphere\/observatory-capability-manager\.js[^"]*"[^>]*><\/script>/);
  const i3d  = html.search(/<script[^>]+src="assets\/js\/sphere\/living-time-sphere-renderer-3d\.js[^"]*"[^>]*><\/script>/);
  assert.ok(iCap >= 0, "observatory-capability-manager.js must be in HTML");
  assert.ok(i3d  >= 0, "living-time-sphere-renderer-3d.js must be in HTML");
  assert.ok(iCap < i3d, "capability manager must appear before renderer-3d in HTML");
});

// ── Renderer: uses canonical reason codes ─────────────────────────────

test("Renderer 3D: uses canonical FALLBACK_REASONS codes (not legacy strings)", () => {
  const code = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
  assert.ok(code.includes("FALLBACK_REASONS"), "Renderer must reference FALLBACK_REASONS taxonomy");
  assert.ok(code.includes("WEBGL_UNSUPPORTED") || code.includes("FALLBACK_REASONS.WEBGL_UNSUPPORTED"),
    "Renderer should use WEBGL_UNSUPPORTED code");
  assert.ok(code.includes("THREE_IMPORT_FAILED") || code.includes("FALLBACK_REASONS.THREE_IMPORT_FAILED"),
    "Renderer should use THREE_IMPORT_FAILED code");
});

test("Renderer 3D: attaches context-loss guard via ObservatoryCapabilityManager", () => {
  const code = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
  assert.ok(code.includes("attachContextLossGuard"), "Renderer must call attachContextLossGuard");
});

test("Renderer 3D: disposes context-loss guard on teardown", () => {
  const code = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
  assert.ok(code.includes("_contextLossDispose"), "Renderer must have _contextLossDispose variable");
  assert.ok(code.includes("_contextLossDispose?.()"), "Renderer must call dispose on teardown");
});

// ── Audit document ────────────────────────────────────────────────────

test("Observatory audit document exists", () => {
  const p = path.join(root, "docs/observatory-audit-pr1.md");
  assert.ok(fs.existsSync(p), "docs/observatory-audit-pr1.md must exist");
});

test("Audit document contains required sections", () => {
  const md = read("docs/observatory-audit-pr1.md");
  assert.ok(md.includes("FALLBACK_REASONS"),         "Audit must document FALLBACK_REASONS");
  assert.ok(md.includes("WEBGL_UNSUPPORTED"),        "Audit must document WEBGL_UNSUPPORTED");
  assert.ok(md.includes("CONTEXT_LOST"),             "Audit must document CONTEXT_LOST");
  assert.ok(md.includes("Before") && md.includes("After"), "Audit must have before/after section");
  assert.ok(md.includes("Migration"),                "Audit must have migration notes");
});
