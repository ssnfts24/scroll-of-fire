const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const zoomPath = path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-semantic-zoom.js");
const labelsPath = path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-label-manager.js");
const rendererPath = path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
const spherePath = path.join(ROOT, "docs/living-time-sphere.html");

const zoomSource = fs.readFileSync(zoomPath, "utf8");
const labels = fs.readFileSync(labelsPath, "utf8");
const renderer = fs.readFileSync(rendererPath, "utf8");
const sphere = fs.readFileSync(spherePath, "utf8");

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(zoomSource, sandbox, { filename: zoomPath });
const zoom = sandbox.LivingTimeSphereSemanticZoom;

test("B7.60 overhead gate engages at top-down elevations only", () => {
  assert.equal(zoom.OVERHEAD_PHI_TOLERANCE, 0.35);
  // Top View is the pattern camera preset: phi 1.28, focus-raised to ~1.33.
  assert.equal(zoom.isOverheadPhi(Math.PI / 2), true);
  assert.equal(zoom.isOverheadPhi(1.28), true);
  assert.equal(zoom.isOverheadPhi(1.33), true);
  // Drag clamp maxes at 1.5 rad, still inside the overhead window.
  assert.equal(zoom.isOverheadPhi(1.5), true);
  // Window edge: pi/2 - 0.35 ~= 1.2208.
  assert.equal(zoom.isOverheadPhi(1.23), true);
  assert.equal(zoom.isOverheadPhi(1.21), false);
});

test("B7.60 tilted elevations are never overhead (existing behavior preserved)", () => {
  assert.equal(zoom.isOverheadPhi(0.7), false); // default mode phi
  assert.equal(zoom.isOverheadPhi(0.78), false); // today preset phi
  assert.equal(zoom.isOverheadPhi(0.62), false); // passage preset phi
  assert.equal(zoom.isOverheadPhi(0.82), false); // years preset phi
  assert.equal(zoom.isOverheadPhi(0), false);
  assert.equal(zoom.isOverheadPhi(-1.5), false);
  assert.equal(zoom.isOverheadPhi(Number.NaN), false);
  assert.equal(zoom.isOverheadPhi(undefined), false);
  assert.equal(zoom.isOverheadPhi("top"), false);
});

test("B7.60 distance band resolution is untouched by the elevation gate", () => {
  assert.equal(zoom.resolveBand({ distance: 3.25, screenWidth: 1280 }), "far");
  assert.equal(zoom.resolveBand({ distance: 3.24, screenWidth: 1280 }), "medium");
  assert.equal(zoom.resolveBand({ distance: 2.35, screenWidth: 1280 }), "medium");
  assert.equal(zoom.resolveBand({ distance: 2.05, screenWidth: 1280 }), "near");
  assert.equal(zoom.resolveBand({ distance: 1.62, screenWidth: 1280 }), "near");
  assert.equal(zoom.resolveBand({ distance: 1.61, screenWidth: 1280 }), "detail");
  assert.equal(zoom.resolveBand({ distance: 3.01, screenWidth: 390 }), "far");
  assert.equal(zoom.resolveBand({ distance: 1.37, screenWidth: 390 }), "detail");
  assert.equal(zoom.resolveBand({}), "medium");
  // The band table itself still maps DETAIL to "all"; the cap lives in the
  // renderer's effective-mode computation, not in the table.
  assert.equal(zoom.BAND_VISIBILITY.detail.dayLabelMode, "all");
  assert.equal(zoom.BAND_VISIBILITY.far.dayLabelMode, "hidden");
  assert.equal(
    zoom.resolveVisibility({ baseLayers: {}, band: "detail" }).dayLabelMode,
    "all"
  );
});

test("B7.60 label manager routes overhead rails through the far skeleton gate", () => {
  assert.match(labels, /cameraOverhead = false/);
  assert.match(labels, /cameraOverhead \? "overhead" : "tilted"/);
  assert.match(labels, /const overhead = !!cameraOverhead;/);
  assert.match(labels, /if \(band === "far" \|\| overhead\)/);
  // Reveal All cannot flood the rail overhead (both numeral kinds).
  const revealGates = [...labels.matchAll(/revealAll && !overhead/g)];
  assert.ok(revealGates.length >= 2, "intercalary + pattern-day reveal gates");
  // The far skeleton anchors themselves are unchanged.
  assert.match(labels, /farFrontAnchor[\s\S]*?moonDay === 7[\s\S]*?moonDay === 21/);
  assert.match(labels, /farNeighborAnchor[\s\S]*?moonDay === 14[\s\S]*?moonDay === 28/);
  // The tilted aperture fallback still terminates railLabelVisible.
  assert.match(labels, /Populate ALL canonical days which physically enter the aperture/);
});

test("B7.60 selected and pinned days survive the overhead gate", () => {
  const railStart = labels.indexOf("const railLabelVisible");
  assert.ok(railStart > -1);
  const rail = labels.slice(railStart, railStart + 7000);
  const selectedIdx = rail.indexOf("target.selected");
  const skeletonIdx = rail.indexOf('band === "far" || overhead');
  // The pattern-day reveal gate is the one immediately before the skeleton
  // gate (an earlier gate covers intercalary numerals, a different kind).
  const revealGateIdx = rail.lastIndexOf("revealAll && !overhead", skeletonIdx);
  assert.ok(selectedIdx > -1 && revealGateIdx > -1 && skeletonIdx > -1);
  // For pattern-day numerals the selected/pinned return happens before both
  // the reveal gate and the skeleton gate, so the selected day and today
  // always show overhead.
  assert.ok(selectedIdx < revealGateIdx, "selected check precedes reveal gate");
  assert.ok(selectedIdx < skeletonIdx, "selected check precedes skeleton gate");
  assert.ok(revealGateIdx < skeletonIdx, "reveal gate precedes skeleton gate");
});

test("B7.60 renderer feeds camera phi into semantic state and caps all overhead", () => {
  assert.match(renderer, /const phi = Number\(cameraState\.phi\);/);
  assert.match(renderer, /phi: Number\.isFinite\(phi\) \? phi : null,\s*\n\s*overhead,/);
  assert.match(renderer, /!!next\.overhead !== !!_semanticZoomState\.overhead/);
  assert.match(renderer, /function _cameraOverhead\(\)/);
  // DETAIL/explicit "all" collapses to key while overhead; preference intact.
  assert.match(renderer, /if \(mode === "all" && _cameraOverhead\(\)\) \{\s*\n\s*return "key";/);
  assert.match(renderer, /cameraOverhead: _cameraOverhead\(\),/);
  // B7.58.5 ownership still holds: camera state never writes the preference.
  assert.match(renderer, /_dayLabelMode = _resolveDayLabelPreference\(dayLabelMode\)/);
});

test("B7.60 changed modules carry a fresh shared cache identity", () => {
  const rendererUrls = [...sphere.matchAll(/assets\/js\/sphere\/living-time-sphere-renderer-3d\.js\?[^"' ]+/g)].map(m => m[0]);
  assert.equal(rendererUrls.length, 2);
  assert.equal(rendererUrls[0], rendererUrls[1]);
  assert.match(rendererUrls[0], /t=20261117-b760-topviewgate/);
  const labelUrls = [...sphere.matchAll(/assets\/js\/sphere\/living-time-sphere-label-manager\.js\?[^"' ]+/g)].map(m => m[0]);
  assert.equal(labelUrls.length, 1);
  assert.match(labelUrls[0], /t=20261117-b760-topviewgate/);
});
