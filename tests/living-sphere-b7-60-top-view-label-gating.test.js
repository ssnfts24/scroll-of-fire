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

/*
 * B7.60.1 — behavioral harness: railLabelVisible is a closure inside the
 * label manager, so extract its source and bind stub closure dependencies.
 * The stubs deliberately simulate the degenerate top-down case: the shared
 * Moon window names an unrelated Moon and the X-only aperture is shut.
 */
function loadRailLabelVisible(overrides = {}) {
  const start = labels.indexOf("const railLabelVisible");
  assert.ok(start > -1, "railLabelVisible declaration present");
  const end = labels.indexOf("const dayRailCandidates", start);
  assert.ok(end > start, "railLabelVisible slice is bounded");
  const chunk = labels.slice(start, end);
  const deps = {
    railZoomOpacity: () => 1,
    railApertureOpacity: () => 0,
    sharedMoonWindow: new Set([3]),
    semanticBand: "detail",
    dayLabelMode: "key",
    cameraOverhead: true,
    calendarDisclosure: { centerMoon: 8, moons: [8] },
    ...overrides
  };
  const names = [
    "railZoomOpacity",
    "railApertureOpacity",
    "sharedMoonWindow",
    "semanticBand",
    "dayLabelMode",
    "cameraOverhead",
    "calendarDisclosure"
  ];
  const factory = new Function(...names, `${chunk}\nreturn railLabelVisible;`);
  return factory(...names.map(name => deps[name]));
}

const dayCandidate = (moon, moonDay, extra = {}) => ({
  target: {
    kind: "pattern-day-number",
    moon,
    moonDay,
    railLocked: true,
    ...extra
  }
});

test("B7.60.1 overhead skeleton derives its window from centerMoon distance", () => {
  const visible = loadRailLabelVisible();
  // Front Moon (8): week anchors survive, non-anchors do not.
  for (const day of [1, 7, 14, 21, 28]) {
    assert.equal(visible(dayCandidate(8, day)), true, `front anchor ${day}`);
  }
  for (const day of [2, 13, 27]) {
    assert.equal(visible(dayCandidate(8, day)), false, `front non-anchor ${day}`);
  }
  // Neighbor Moons (7 and 9): sparse anchors only.
  for (const moon of [7, 9]) {
    for (const day of [1, 14, 28]) {
      assert.equal(visible(dayCandidate(moon, day)), true, `neighbor ${moon}/${day}`);
    }
    for (const day of [7, 21]) {
      assert.equal(visible(dayCandidate(moon, day)), false, `neighbor ${moon}/${day}`);
    }
  }
  // Far Moons: no anchors at any week position.
  for (const moon of [5, 11]) {
    for (const day of [1, 14, 28]) {
      assert.equal(visible(dayCandidate(moon, day)), false, `far ${moon}/${day}`);
    }
  }
  // Scheduled days survive inside the window, not outside it.
  assert.equal(visible(dayCandidate(7, 3, { dayScheduleCount: 2 })), true);
  assert.equal(visible(dayCandidate(9, 20, { symbol: "*" })), true);
  assert.equal(visible(dayCandidate(11, 3, { dayScheduleCount: 2 })), false);
  // Selected/pinned still short-circuit, even on a far Moon.
  assert.equal(visible(dayCandidate(11, 5, { selected: true })), true);
  assert.equal(visible(dayCandidate(11, 5, { pinned: true })), true);
});

test("B7.60.1 overhead window wraps around the Moon circle", () => {
  const visible = loadRailLabelVisible({
    calendarDisclosure: { centerMoon: 1, moons: [1] }
  });
  assert.equal(visible(dayCandidate(1, 21)), true); // front anchor
  assert.equal(visible(dayCandidate(13, 14)), true); // wrapped neighbor anchor
  assert.equal(visible(dayCandidate(13, 7)), false); // wrapped neighbor non-anchor
  assert.equal(visible(dayCandidate(2, 28)), true); // neighbor anchor
  assert.equal(visible(dayCandidate(12, 1)), false); // distance 2 stays hidden
});

test("B7.60.1 tilted far skeleton still answers to window and aperture", () => {
  const base = {
    cameraOverhead: false,
    semanticBand: "far",
    calendarDisclosure: { centerMoon: 8, moons: [7, 8, 9] },
    sharedMoonWindow: new Set([7, 8, 9])
  };
  const open = loadRailLabelVisible({ ...base, railApertureOpacity: () => 1 });
  assert.equal(open(dayCandidate(8, 1)), true);
  assert.equal(open(dayCandidate(7, 14)), true);
  assert.equal(open(dayCandidate(8, 2)), false);
  assert.equal(open(dayCandidate(11, 1)), false); // outside the window
  const shut = loadRailLabelVisible({ ...base, railApertureOpacity: () => 0 });
  assert.equal(shut(dayCandidate(8, 1)), false); // aperture still governs tilted
  const narrow = loadRailLabelVisible({
    ...base,
    railApertureOpacity: () => 1,
    sharedMoonWindow: new Set([8])
  });
  assert.equal(narrow(dayCandidate(7, 14)), false); // window still governs tilted
});

test("B7.60.1 tilted full rail still answers to window and aperture", () => {
  const base = {
    cameraOverhead: false,
    semanticBand: "medium",
    calendarDisclosure: { centerMoon: 8, moons: [8] },
    sharedMoonWindow: new Set([8])
  };
  const open = loadRailLabelVisible({ ...base, railApertureOpacity: () => 0.5 });
  assert.equal(open(dayCandidate(8, 2)), true); // every in-window day shows
  assert.equal(open(dayCandidate(9, 2)), false); // window still applies
  const shut = loadRailLabelVisible({ ...base, railApertureOpacity: () => 0 });
  assert.equal(shut(dayCandidate(8, 2)), false); // aperture still applies
});

test("B7.60.2 render-pass overhead exemption is tied to the gate verdict", () => {
  // The B7.60.1 blanket exemption (camera flag alone -> aperture 1) is gone:
  // it asserted, without checking, that every numeral reaching the render
  // pass had passed the gate — the composed pipeline does not guarantee
  // that (throttled, possibly mid-transition evaluations paint through
  // this same branch), and the deploy-preview recheck showed the full
  // tilted rail overhead. The exemption now spends only a recorded
  // per-candidate verdict from this update's gate run.
  assert.doesNotMatch(
    labels,
    /cameraOverhead\s*\n\s*\? 1\s*\n\s*: railApertureOpacity\(/
  );
  assert.match(labels, /const railGateVerdicts =\s*\n\s*new Map\(\)/);
  assert.match(labels, /railGateVerdicts\.set\(/);
  assert.match(
    labels,
    /cameraOverhead\s*\n\s*&& railGateVerdicts\.get\(/
  );
  // The overhead skeleton branch keys on circular centerMoon distance and
  // never consults the tilted window or aperture.
  const branchStart = labels.indexOf("B7.60.1 — overhead window");
  assert.ok(branchStart > -1);
  const overheadIdx = labels.indexOf("if (overhead)", branchStart);
  assert.ok(overheadIdx > branchStart);
  const blockEnd = labels.indexOf(");\n            }", overheadIdx);
  assert.ok(blockEnd > overheadIdx);
  const branch = labels.slice(branchStart, blockEnd);
  assert.match(branch, /if \(overhead\)/);
  assert.match(branch, /moonDistance <= 1/);
  assert.doesNotMatch(branch, /sharedMoonWindow/);
  assert.doesNotMatch(branch, /apertureOpacity/);
});

test("B7.60.2 renderer re-runs the gate when the overhead state flips", () => {
  // A mid-transition label evaluation must not persist over the settled
  // top-down scene: when the semantic-zoom overhead flag flips, the
  // renderer schedules the same forced settle refresh the gesture path
  // uses, so the gate re-evaluates against the settled camera.
  assert.match(renderer, /const overheadFlipped =/);
  assert.match(renderer, /if \(overheadFlipped\) \{/);
  const flipIdx = renderer.indexOf("if (overheadFlipped) {");
  assert.ok(flipIdx > -1);
  const settleBlock = renderer.slice(flipIdx, flipIdx + 1400);
  assert.match(settleBlock, /_labelSettleTimer = setTimeout\(/);
  assert.match(settleBlock, /_updateMoonLabels\(_viewMode, performance\.now\(\), true\)/);
});

test("B7.60.1 label manager carries the overhead-skeleton cache identity", () => {
  const labelUrls = [...sphere.matchAll(/assets\/js\/sphere\/living-time-sphere-label-manager\.js\?[^"' ]+/g)].map(m => m[0]);
  assert.equal(labelUrls.length, 1);
  assert.match(labelUrls[0], /t=20261117-b760-topviewgate/);
  assert.match(labelUrls[0], /s=20261117-b7602-gatetied/);
});

test("B7.60 changed modules carry a fresh shared cache identity", () => {
  const rendererUrls = [...sphere.matchAll(/assets\/js\/sphere\/living-time-sphere-renderer-3d\.js\?[^"' ]+/g)].map(m => m[0]);
  assert.equal(rendererUrls.length, 2);
  assert.equal(rendererUrls[0], rendererUrls[1]);
  assert.match(rendererUrls[0], /t=20261117-b760-topviewgate/);
  assert.match(rendererUrls[0], /s=20261117-b7602-gatetied/);
  const labelUrls = [...sphere.matchAll(/assets\/js\/sphere\/living-time-sphere-label-manager\.js\?[^"' ]+/g)].map(m => m[0]);
  assert.equal(labelUrls.length, 1);
  assert.match(labelUrls[0], /t=20261117-b760-topviewgate/);
});
