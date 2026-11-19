"use strict";

/*
 * Sphere R2 rework (preview, Nov 18, 2026) — the switchable options
 * Aaron judges in the preview PR:
 *
 *   - Moon-name placement: "always" (the B7.55/B7.57 persistent-
 *     identity doctrine) vs "fit" (priority + collision resolution).
 *   - The adaptive-quality governor (Living Strata Phase F): sheds
 *     cloud density, then pixel ratio, then floating labels and
 *     effects, and restores with hysteresis.
 *   - The options store: doctrine-true defaults, device-local
 *     persistence, governor sync.
 *   - Wiring: the label manager and renderer consult the new modules
 *     only behind their switches, so default behaviour is untouched.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const placement = require(
  "../docs/assets/js/sphere/living-time-sphere-label-placement.js"
);
const governorModule = require(
  "../docs/assets/js/sphere/living-time-sphere-quality-governor.js"
);
// The options module reads the governor singleton from globalThis.
globalThis.LivingTimeSphereQualityGovernor = governorModule;
require("../docs/assets/js/sphere/living-time-sphere-options.js");
const options = globalThis.LivingTimeSphereOptions;

const BOUNDS = { minX: 0, minY: 0, maxX: 390, maxY: 844 };

function stackedItems() {
  // Three names projected onto nearly the same spot — the phone-size
  // cluster Aaron reported.
  return [
    { id: 8, priority: 100, selected: true, rect: { x: 150, y: 400, w: 90, h: 20 } },
    { id: 7, priority: 40, selected: false, rect: { x: 155, y: 405, w: 80, h: 20 } },
    { id: 9, priority: 30, selected: false, rect: { x: 148, y: 398, w: 85, h: 20 } }
  ];
}

function visibleOverlapPairs(results) {
  const visible = results.filter(r => r.visible);
  let pairs = 0;
  for (let i = 0; i < visible.length; i += 1) {
    for (let j = i + 1; j < visible.length; j += 1) {
      if (placement.overlapArea(visible[i].rect, visible[j].rect) >= 4) {
        pairs += 1;
      }
    }
  }
  return pairs;
}

/* ── Label placement ──────────────────────────────────────────── */

test("r2 placement: collision index finds and clears overlaps", () => {
  const index = placement.createCollisionIndex(48);
  const a = { x: 10, y: 10, w: 50, h: 20 };
  assert.equal(index.test(a), false);
  index.insert(a);
  assert.equal(index.test({ x: 30, y: 15, w: 50, h: 20 }), true);
  assert.equal(index.test({ x: 300, y: 300, w: 50, h: 20 }), false);
  index.clear();
  assert.equal(index.test(a), false);
});

test("r2 placement: always mode keeps every name (the doctrine)", () => {
  const items = stackedItems();
  const { results, stats } = placement.resolveMoonLabelOverlaps(
    items,
    { mode: "always", bounds: BOUNDS }
  );
  assert.equal(stats.visible, 3);
  assert.equal(stats.hidden, 0);
  assert.equal(stats.moved, 0);
  // The stacking is measured and reported, not hidden away.
  assert.ok(stats.overlapPairs >= 2);
  assert.ok(results.every(r => r.visible));
});

test("r2 placement: fit mode resolves the stack with no visible overlaps", () => {
  const items = stackedItems();
  const { results, stats } = placement.resolveMoonLabelOverlaps(
    items,
    { mode: "fit", bounds: BOUNDS }
  );
  assert.equal(visibleOverlapPairs(results), 0);
  assert.ok(stats.moved + stats.hidden >= 2);
});

test("r2 placement: fit mode never hides the selected Moon", () => {
  // A stage so crowded nothing can move: 13 names on one spot, tiny
  // bounds — the selected one must still be standing.
  const items = [];
  for (let moon = 1; moon <= 13; moon += 1) {
    items.push({
      id: moon,
      priority: moon === 5 ? 100 : 10,
      selected: moon === 5,
      rect: { x: 40, y: 40, w: 90, h: 20 }
    });
  }
  const { results } = placement.resolveMoonLabelOverlaps(items, {
    mode: "fit",
    bounds: { minX: 0, minY: 0, maxX: 120, maxY: 80 }
  });
  const selected = results.find(r => r.id === 5);
  assert.equal(selected.visible, true);
});

test("r2 placement: fit mode keeps rects inside the stage bounds", () => {
  const items = [
    { id: 1, priority: 90, selected: true, rect: { x: 370, y: 830, w: 90, h: 20 } },
    { id: 2, priority: 10, selected: false, rect: { x: 375, y: 832, w: 90, h: 20 } }
  ];
  const { results } = placement.resolveMoonLabelOverlaps(items, {
    mode: "fit",
    bounds: BOUNDS
  });
  for (const r of results) {
    if (!r.visible) continue;
    assert.ok(r.rect.x >= BOUNDS.minX && r.rect.y >= BOUNDS.minY);
    assert.ok(r.rect.x + r.rect.w <= BOUNDS.maxX);
    assert.ok(r.rect.y + r.rect.h <= BOUNDS.maxY);
  }
});

test("r2 placement: higher priority keeps its projected spot", () => {
  const items = stackedItems();
  const { results } = placement.resolveMoonLabelOverlaps(items, {
    mode: "fit",
    bounds: BOUNDS
  });
  const selected = results.find(r => r.id === 8);
  assert.equal(selected.visible, true);
  assert.equal(selected.moved, false);
  assert.equal(selected.rect.x, 150);
  assert.equal(selected.rect.y, 400);
});

/* ── Quality governor ─────────────────────────────────────────── */

test("r2 governor: tiers shed in order — clouds, pixel ratio, labels/effects", () => {
  const tiers = governorModule.TIERS;
  assert.equal(tiers.length, 4);
  for (let i = 1; i < tiers.length; i += 1) {
    assert.ok(tiers[i].cloudCap <= tiers[i - 1].cloudCap);
    assert.ok(tiers[i].dprScale <= tiers[i - 1].dprScale);
    assert.ok(tiers[i].semanticScale <= tiers[i - 1].semanticScale);
  }
  assert.equal(tiers[0].cloudCap, 3);
  assert.equal(tiers[3].effects, false);
  assert.ok(tiers[3].semanticScale < 1);
  assert.ok(tiers[1].semanticScale === 1 && tiers[2].semanticScale === 1);
});

test("r2 governor: sustained slow frames shed tiers stepwise", () => {
  const gov = governorModule.createGovernor();
  const feed = (ms, frames) => {
    let last = null;
    for (let i = 0; i < frames; i += 1) last = gov.sampleFrame(ms);
    return last;
  };
  // One evaluation window = 1500ms of accumulated frame time:
  // 50 frames at 30ms. Feed 55 to close each window with margin.
  assert.equal(gov.tier(), 0);
  feed(30, 55);
  assert.equal(gov.tier(), 1);
  feed(30, 55);
  assert.equal(gov.tier(), 2);
  feed(30, 55);
  assert.equal(gov.tier(), 3);
  feed(30, 110);
  assert.equal(gov.tier(), 3); // never sheds past the floor
});

test("r2 governor: windows close on frame time, not frame count", () => {
  // At 100ms per frame (a struggling device), only 15 frames fill a
  // 1500ms window — the governor must still step in promptly.
  const gov = governorModule.createGovernor();
  for (let i = 0; i < 15; i += 1) gov.sampleFrame(100);
  assert.equal(gov.tier(), 1);
});

test("r2 governor: recovery needs consecutive good windows (hysteresis)", () => {
  const gov = governorModule.createGovernor();
  for (let i = 0; i < 160; i += 1) gov.sampleFrame(30);
  assert.equal(gov.tier(), 3);
  // At 10ms per frame a window needs 150 frames.
  for (let i = 0; i < 155; i += 1) gov.sampleFrame(10);
  assert.equal(gov.tier(), 3); // one good window is not enough
  for (let i = 0; i < 155; i += 1) gov.sampleFrame(10);
  assert.equal(gov.tier(), 2); // two in a row restore one tier
});

test("r2 governor: changed flag fires only on the transition sample", () => {
  const gov = governorModule.createGovernor();
  let changes = 0;
  for (let i = 0; i < 50; i += 1) {
    if (gov.sampleFrame(30).changed) changes += 1;
  }
  assert.equal(changes, 1);
  assert.equal(gov.tier(), 1);
});

test("r2 governor: disabled singleton reports full quality", () => {
  governorModule.setEnabled(false);
  try {
    assert.equal(governorModule.tier(), 0);
    assert.equal(governorModule.cloudCap(), 3);
    assert.equal(governorModule.dprScale(), 1);
    assert.equal(governorModule.semanticScale(), 1);
    assert.equal(governorModule.effectsEnabled(), true);
  } finally {
    governorModule.setEnabled(true);
  }
});

/* ── Options store ────────────────────────────────────────────── */

test("r2 options: defaults are the doctrine-true behaviour", () => {
  assert.deepEqual({ ...options.DEFAULTS }, {
    labelMode: "always",
    zoomFeel: "current",
    skyIntensity: "full",
    governor: true
  });
  const current = options.get();
  assert.equal(current.labelMode, "always");
  assert.equal(current.zoomFeel, "current");
  assert.equal(current.skyIntensity, "full");
  assert.equal(current.governor, true);
});

test("r2 options: set normalizes, notifies once, and syncs the governor", () => {
  let calls = 0;
  const off = options.onChange(() => { calls += 1; });
  try {
    options.set({ labelMode: "fit" });
    assert.equal(options.get().labelMode, "fit");
    assert.equal(calls, 1);
    options.set({ labelMode: "nonsense" });
    assert.equal(options.get().labelMode, "always");
    options.set({ governor: false });
    assert.equal(governorModule.isEnabled(), false);
    options.set({ governor: true });
    assert.equal(governorModule.isEnabled(), true);
  } finally {
    off();
    options.set({ ...options.DEFAULTS });
  }
});

/* ── Wiring (default behaviour untouched) ─────────────────────── */

test("r2 wiring: label manager runs fit mode only behind the switch", () => {
  const source = read("docs/assets/js/sphere/living-time-sphere-label-manager.js");
  assert.match(source, /labelMode === "fit"/);
  assert.match(source, /resolveMoonLabelOverlaps/);
  // The doctrine branch itself is untouched.
  assert.match(source, /runtimeProfile === "observatory"/);
});

test("r2 wiring: renderer consults the governor and the sky switch", () => {
  const source = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
  assert.match(source, /LivingTimeSphereQualityGovernor/);
  assert.match(source, /_applyGovernorTier/);
  assert.match(source, /_skyIntensityScale/);
  // The historic cloud-only governor still runs when R2 is off.
  assert.match(source, /_cloudGovernorFrames >= 90/);
});

test("r2 wiring: page loads the modules and hosts the options panel", () => {
  const html = read("docs/living-time-sphere.html");
  assert.match(html, /living-time-sphere-label-placement\.js/);
  assert.match(html, /living-time-sphere-quality-governor\.js/);
  assert.match(html, /living-time-sphere-options\.js/);
  assert.match(html, /id="sphere-r2-options"/);
  const sw = read("docs/service-worker.js");
  assert.match(sw, /living-time-sphere-label-placement\.js/);
  assert.match(sw, /living-time-sphere-quality-governor\.js/);
  assert.match(sw, /living-time-sphere-options\.js/);
});
