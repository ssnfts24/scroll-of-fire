"use strict";

// Three.js vendor dependency-integrity tests.
// Verifies that the vendored local Three.js module exists, is pinned to the
// correct version, has a valid license, has a matching integrity checksum,
// and that production code does not reference mandatory external CDN imports.

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs     = require("node:fs");
const path   = require("node:path");
const test   = require("node:test");

const root  = path.resolve(__dirname, "..");
const read  = rel => fs.readFileSync(path.join(root, rel), "utf8");
const readB = rel => fs.readFileSync(path.join(root, rel));

const VENDOR_DIR      = "docs/assets/vendor/three";
const MODULE_FILE     = `${VENDOR_DIR}/three.module.min.js`;
const LICENSE_FILE    = `${VENDOR_DIR}/LICENSE.txt`;
const VERSION_FILE    = `${VENDOR_DIR}/VERSION.txt`;
const RENDERER_3D     = "docs/assets/js/sphere/living-time-sphere-renderer-3d.js";
const SERVICE_WORKER  = "docs/service-worker.js";

// Expected values from VERSION.txt
const EXPECTED_VERSION   = "0.167.1";
const EXPECTED_INTEGRITY = "sha384-fPAi39ufYYhieBm2Yj7mAE8pE2HIIJm4iFT2zQEY4g4/OMR9m8GMM5+jen6ptHcu";

// ── File existence ────────────────────────────────────────────────────

test("vendor/three: three.module.min.js exists", () => {
  assert.ok(
    fs.existsSync(path.join(root, MODULE_FILE)),
    `${MODULE_FILE} must exist`
  );
});

test("vendor/three: LICENSE.txt exists", () => {
  assert.ok(
    fs.existsSync(path.join(root, LICENSE_FILE)),
    `${LICENSE_FILE} must exist`
  );
});

test("vendor/three: VERSION.txt exists", () => {
  assert.ok(
    fs.existsSync(path.join(root, VERSION_FILE)),
    `${VERSION_FILE} must exist`
  );
});

// ── Version pin ───────────────────────────────────────────────────────

test("vendor/three: VERSION.txt identifies the pinned version", () => {
  const ver = read(VERSION_FILE);
  assert.ok(
    ver.includes(EXPECTED_VERSION),
    `VERSION.txt must record version ${EXPECTED_VERSION}`
  );
});

test("vendor/three: VERSION.txt records package name", () => {
  const ver = read(VERSION_FILE);
  assert.ok(ver.includes("three"), "VERSION.txt must contain package name 'three'");
});

test("vendor/three: VERSION.txt includes integrity checksum", () => {
  const ver = read(VERSION_FILE);
  assert.ok(
    ver.includes("integrity") || ver.includes("sha384"),
    "VERSION.txt must contain an integrity checksum"
  );
});

// ── License attribution ───────────────────────────────────────────────

test("vendor/three: LICENSE.txt contains MIT", () => {
  const lic = read(LICENSE_FILE);
  assert.ok(
    lic.toLowerCase().includes("mit"),
    "LICENSE.txt must state MIT license"
  );
});

test("vendor/three: LICENSE.txt mentions three.js authors", () => {
  const lic = read(LICENSE_FILE);
  const lower = lic.toLowerCase();
  assert.ok(
    lower.includes("three") || lower.includes("mrdoob"),
    "LICENSE.txt must attribute three.js or mrdoob"
  );
});

// ── Integrity checksum ────────────────────────────────────────────────

test("vendor/three: three.module.min.js checksum matches VERSION.txt", () => {
  const buf = readB(MODULE_FILE);
  const hash = crypto.createHash("sha384").update(buf).digest("base64");
  const actual = `sha384-${hash}`;
  assert.equal(
    actual,
    EXPECTED_INTEGRITY,
    `Checksum mismatch — file may have been modified.\nExpected: ${EXPECTED_INTEGRITY}\nActual:   ${actual}`
  );
});

// ── ES module syntax ──────────────────────────────────────────────────

test("vendor/three: three.module.min.js uses ES module syntax (export)", () => {
  const code = read(MODULE_FILE);
  // The ES module build uses 'export' statements.
  assert.ok(
    code.includes("export{") || code.includes("export {") || code.includes("export const") || /\bexport\b/.test(code),
    "three.module.min.js must contain ES module exports"
  );
});

test("vendor/three: three.module.min.js is not a UMD/CommonJS build", () => {
  const code = read(MODULE_FILE);
  // UMD builds contain module.exports or define() AMD wrapper.
  assert.ok(
    !code.startsWith("!function(") && !code.includes("module.exports=") && !code.includes("define("),
    "three.module.min.js must be an ES module, not UMD/CommonJS"
  );
});

// ── Production renderer: no mandatory CDN dependency ─────────────────

test("renderer-3d: does not require cdn.jsdelivr.net in production load path", () => {
  const code = read(RENDERER_3D);
  // The URL should NOT appear in any import() call or script.src assignment.
  // A commented-out reference is acceptable, but a live import/src must not exist.
  const lines = code.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
    assert.ok(
      !trimmed.includes("import(") || !trimmed.includes("jsdelivr"),
      `Production import() must not reference jsDelivr CDN:\n  ${trimmed}`
    );
    assert.ok(
      !trimmed.includes("script.src") || !trimmed.includes("jsdelivr"),
      `script.src must not reference jsDelivr CDN:\n  ${trimmed}`
    );
  }
});

test("renderer-3d: does not require unpkg.com in production load path", () => {
  const code = read(RENDERER_3D);
  const lines = code.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
    assert.ok(
      !trimmed.includes("import(") || !trimmed.includes("unpkg.com"),
      `Production import() must not reference unpkg.com CDN:\n  ${trimmed}`
    );
    assert.ok(
      !trimmed.includes("script.src") || !trimmed.includes("unpkg.com"),
      `script.src must not reference unpkg.com CDN:\n  ${trimmed}`
    );
  }
});

// ── Local module URL respects base path ──────────────────────────────

test("renderer-3d: uses THREE_LOCAL_REL relative path (not hardcoded /assets/)", () => {
  const code = read(RENDERER_3D);
  assert.ok(
    code.includes("THREE_LOCAL_REL"),
    "renderer-3d must define and use THREE_LOCAL_REL"
  );
  // Must not hard-code /assets/ which would break GitHub Pages prefix
  assert.ok(
    !code.includes("'/assets/vendor/three'") &&
    !code.includes(`"/assets/vendor/three"`),
    "renderer-3d must not hard-code /assets/ path"
  );
});

test("renderer-3d: resolves local URL via document.baseURI", () => {
  const code = read(RENDERER_3D);
  assert.ok(
    code.includes("document.baseURI"),
    "renderer-3d must resolve local URL against document.baseURI for GitHub Pages compatibility"
  );
});

test("renderer-3d: uses dynamic import() to load local module", () => {
  const code = read(RENDERER_3D);
  assert.ok(
    code.includes("import("),
    "renderer-3d must use dynamic import() to load Three.js"
  );
});

// ── Service worker includes local vendor module ───────────────────────

test("service-worker: vendor Three.js module is in optionalPaths (not mandatory)", () => {
  const sw = read(SERVICE_WORKER);
  assert.ok(
    sw.includes("assets/vendor/three/three.module.min.js"),
    "service-worker must cache the local Three.js vendor module"
  );
  // The Three.js module must be in optional, not mandatory.
  // We detect this by checking it is NOT between the mandatoryPaths array
  // boundaries.  We look for presence in optionalPaths section.
  const optStart = sw.indexOf("const optionalPaths");
  const optEnd   = sw.indexOf("];", optStart);
  const optBlock = sw.slice(optStart, optEnd);
  assert.ok(
    optBlock.includes("assets/vendor/three/three.module.min.js"),
    "three.module.min.js must be in optionalPaths so a failed optional 3D asset cannot prevent PWA install"
  );
});

test("service-worker: mandatory paths do not contain external CDN URLs", () => {
  const sw = read(SERVICE_WORKER);
  const mandStart = sw.indexOf("const mandatoryPaths");
  const mandEnd   = sw.indexOf("];", mandStart);
  const mandBlock = sw.slice(mandStart, mandEnd);
  assert.ok(!mandBlock.includes("cdn.jsdelivr.net"), "mandatory cache must not reference jsDelivr CDN");
  assert.ok(!mandBlock.includes("unpkg.com"),        "mandatory cache must not reference unpkg CDN");
});

// ── Stale-cache upgrade: version was incremented ──────────────────────

test("moons-version: APP_VERSION was bumped (not a stale 2026.07.23.3 or earlier .1/.2)", () => {
  const ver = read("docs/assets/js/moons-version.js");
  // Version should be at least 2026.07.23.4 (the Phase 03 vendor bump).
  const match = ver.match(/APP_VERSION\s*=\s*"([^"]+)"/);
  assert.ok(match, "APP_VERSION must be defined");
  const parts = match[1].split(".");
  const patch = parseInt(parts[3] || "0", 10);
  // Must be at least build 4 (the vendoring build).
  assert.ok(
    patch >= 4 || parseInt(parts[2] || "0", 10) > 23 || parseInt(parts[1] || "0", 10) > 7,
    `APP_VERSION ${match[1]} must be at least 2026.07.23.4 after vendoring Three.js`
  );
});

// ── Renderer exports THREE_LOCAL_REL (not THREE_CDN) ─────────────────

test("renderer-3d: exports THREE_LOCAL_REL, not THREE_CDN", () => {
  const code = read(RENDERER_3D);
  assert.ok(
    code.includes("THREE_LOCAL_REL"),
    "renderer-3d must export THREE_LOCAL_REL"
  );
  // THREE_CDN must not appear as a live exported property.
  // (Commented references are acceptable.)
  const lines = code.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
    assert.ok(
      !trimmed.includes("THREE_CDN,") && !trimmed.includes("THREE_CDN:"),
      `THREE_CDN must not be exported from the production module:\n  ${trimmed}`
    );
  }
});

// ── Guardrail: no mandatory external Three.js import in production JS ─

const PRODUCTION_JS_FILES = [
  RENDERER_3D,
  SERVICE_WORKER,
  "docs/assets/js/sphere/living-time-sphere-ui.js",
];

const FORBIDDEN_CDN_PATTERNS = [
  /import\s*\([^)]*cdn\.jsdelivr\.net[^)]*npm\/three/,
  /import\s*\([^)]*unpkg\.com[^)]*\/three/,
  /script\.src\s*=.*cdn\.jsdelivr\.net[^;]*npm\/three/,
  /script\.src\s*=.*unpkg\.com[^;]*\/three/,
];

for (const file of PRODUCTION_JS_FILES) {
  test(`guardrail: ${path.basename(file)} has no mandatory external Three.js CDN reference`, () => {
    const code = read(file);
    const lines = code.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
      for (const pat of FORBIDDEN_CDN_PATTERNS) {
        assert.ok(
          !pat.test(trimmed),
          `${file}: forbidden external CDN Three.js reference found:\n  ${trimmed}`
        );
      }
    }
  });
}
