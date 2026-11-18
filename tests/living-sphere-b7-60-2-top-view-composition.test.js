const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const labelsPath = path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-label-manager.js");
const labelsSource = fs.readFileSync(labelsPath, "utf8");

/*
 * B7.60.2 — COMPOSITION tests. The B7.60.1 gate tests evaluate
 * railLabelVisible in isolation and passed while the deploy preview
 * showed the full tilted rail in Top View: the composed pipeline
 * (candidate construction -> gate -> render-pass opacity -> DOM sweep)
 * is the unit that failed, so it is the unit tested here. These tests
 * load the real label manager and drive its real update() with the
 * full numeral set composed the way the renderer composes it
 * (disclosure-window day targets, railLocked, selected = Pattern Day
 * 215), behind DOM/THREE stubs that only project anchors onto a ring.
 */

function makeEl(tag = "div") {
  return {
    tagName: tag.toUpperCase(),
    style: {},
    dataset: {},
    className: "",
    children: [],
    offsetWidth: 26,
    offsetHeight: 16,
    hidden: false,
    textContent: "",
    _listeners: {},
    classList: {
      _set: new Set(),
      toggle(name, force) { if (force) this._set.add(name); else this._set.delete(name); },
      add(...names) { names.forEach(n => this._set.add(n)); },
      remove(...names) { names.forEach(n => this._set.delete(n)); },
      contains(name) { return this._set.has(name); }
    },
    setAttribute() {},
    getAttribute() { return null; },
    append(...kids) { this.children.push(...kids); },
    appendChild(kid) { this.children.push(kid); return kid; },
    insertBefore(kid) { this.children.push(kid); return kid; },
    addEventListener(name, fn) { this._listeners[name] = fn; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    remove() {},
    getBoundingClientRect() { return { width: 1060, height: 800, left: 0, top: 0, right: 1060, bottom: 800 }; }
  };
}

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
  project(camera) { const p = camera.__project(this); this.x = p.x; this.y = p.y; this.z = p.z; return this; }
  applyMatrix4(m) { const p = m.__apply(this); this.x = p.x; this.y = p.y; this.z = p.z; return this; }
  clone() { return new Vector3(this.x, this.y, this.z); }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  length() { return Math.hypot(this.x, this.y, this.z); }
  normalize() { const l = this.length() || 1; return this.multiplyScalar(1 / l); }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
}

function loadManager() {
  const sandbox = {
    console,
    document: {
      createElement: tag => makeEl(tag),
      createElementNS: (ns, tag) => makeEl(tag),
      getElementById: () => null,
      addEventListener() {},
      dispatchEvent() { return true; }
    },
    window: { innerWidth: 1280, innerHeight: 800, matchMedia: () => ({ matches: false }) },
    requestAnimationFrame: () => 0,
    CustomEvent: class { constructor(type, opts) { this.type = type; this.detail = opts?.detail; } },
    setTimeout,
    clearTimeout
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(labelsSource, sandbox, { filename: labelsPath });
  assert.ok(sandbox.LivingTimeSphereLabelManager, "label manager exported");
  return sandbox.LivingTimeSphereLabelManager;
}

const RING = 2.2;
function ringPoint(angleDeg, radius = RING) {
  const a = angleDeg * Math.PI / 180;
  return { x: Math.sin(a) * radius, z: -Math.cos(a) * radius };
}

function buildTargets(dayMoons = [7, 8, 9]) {
  const targets = [];
  for (let m = 1; m <= 13; m++) {
    const p = ringPoint(((m - 0.5) / 13) * 360, RING * 1.28);
    targets.push({
      id: `moon-${m}`, label: `Moon ${m}`, kind: "moon", moon: m,
      worldX: p.x, worldY: 0.02, worldZ: p.z,
      priority: m === 8 ? 88 : 46, showDistance: 1.8, resetDistance: 2.18,
      selected: m === 8
    });
  }
  // The renderer builds day targets only for the disclosure Moons
  // (dayAperture), plus selected/today — here the window is 7, 8, 9.
  for (const moon of dayMoons) {
    for (let moonDay = 1; moonDay <= 28; moonDay++) {
      const dayOfYear = (moon - 1) * 28 + moonDay;
      const week = Math.floor((moonDay - 1) / 7);
      const w = ringPoint(((dayOfYear - 1) / 364) * 360, RING * (1.02 + week * 0.055));
      const isSel = dayOfYear === 215;
      targets.push({
        id: `pattern-day-number-${dayOfYear}`,
        label: String(moonDay),
        detail: `Moon ${moon} · Day ${moonDay}`,
        kind: "pattern-day-number",
        moon, moonDay, dayOfPatternYear: dayOfYear,
        worldX: w.x, worldY: 0.010, worldZ: w.z,
        priority: isSel ? 100 : 44,
        showDistance: 99, resetDistance: 99, detailDistance: 0,
        haloOffset: 0, haloLane: "day", railLocked: true, quietRail: true,
        interactive: true,
        dayScheduleCount: 0, scheduleCount: 0, symbol: null,
        gateDay: moonDay === 1 || moonDay % 7 === 0,
        pinned: isSel, selected: isSel
      });
    }
  }
  return targets;
}

function makeCamera(matrixScale = 1, pos = null) {
  const half = 3.1;
  return {
    position: pos || new Vector3(0, 6.5, 0.001),
    matrixWorld: { elements: [matrixScale, 0, 0, 0, 0, matrixScale, 0, 0, 0, 0, matrixScale, 0, 0, 6.5, 0, 1] },
    matrixWorldInverse: { __apply: v => ({ x: v.x, y: v.z, z: -6.5 + v.y }) },
    __project: v => ({ x: v.x / half, y: v.z / half, z: 0 }),
    updateMatrixWorld() {},
    getWorldDirection(vec) { vec.set(0, -1, 0); return vec; }
  };
}

function makeStage() {
  const stageEl = makeEl("div");
  stageEl.getBoundingClientRect = () => ({ width: 1060, height: 800, left: 0, top: 0, right: 1060, bottom: 800 });
  const labelContainer = makeEl("div");
  const labelEls = Array.from({ length: 13 }, () => makeEl("div"));
  const connectorEl = makeEl("div");
  const anchors = [];
  for (let m = 1; m <= 13; m++) {
    const p = ringPoint(((m - 0.5) / 13) * 360, RING * 1.28);
    anchors.push({ moon: m, worldX: p.x, worldY: 0.02, worldZ: p.z });
  }
  return { stageEl, labelContainer, labelEls, connectorEl, anchors };
}

function updateArgs(stage, camera, cameraOverhead, overrides = {}) {
  return {
    camera,
    three: { Vector3 },
    anchors: stage.anchors,
    model: {
      todayPatternPosition: { moon: 8, day: 19, dayOfPatternYear: 215 },
      selectedPatternPosition: { moon: 8, day: 19, dayOfPatternYear: 215 },
      sourceRecord: {}
    },
    labelMode: "all",
    selectedPatternPosition: { moon: 8, day: 19, dayOfPatternYear: 215 },
    showAllMobileLabels: false,
    dayLabelMode: "key",
    cameraOverhead,
    calendarDisclosure: { centerMoon: 8, moons: [7, 8, 9], halfWindow: 1, key: "8:1:7,8,9" },
    selectedMarkerPosition: null,
    todayMarkerPosition: null,
    viewMode: "orbit",
    stageEl: stage.stageEl,
    visibleLayersKey: "",
    protectedRects: [],
    semanticTargets: buildTargets(),
    interactionLite: false,
    semanticBand: "medium",
    ...overrides
  };
}

function visibleNumerals(labelContainer) {
  const layer = labelContainer.children.find(c => c.className === "sphere-semantic-label-layer");
  assert.ok(layer, "semantic label layer exists");
  return layer.children
    .filter(el => el.dataset.semanticKind === "pattern-day-number")
    .filter(el => el.style.display !== "none" && parseFloat(el.style.opacity || "0") > 0.025)
    .map(el => ({
      day: Number(el.dataset.semanticId.replace("pattern-day-number-", "")),
      opacity: parseFloat(el.style.opacity || "0")
    }))
    .sort((a, b) => a.day - b.day);
}

// Front Moon 8 anchors 1/7/14/21/28 -> 197/203/210/217/224; neighbor
// Moons 7 and 9 anchors 1/14/28 -> 169/182/196 and 225/238/252; plus the
// selected day 215 (Moon 8 Day 19). Twelve numerals, nothing else.
const SKELETON_DAYS = [169, 182, 196, 197, 203, 210, 215, 217, 224, 225, 238, 252];

test("B7.60.2 composed overhead pipeline shows exactly the skeleton set", () => {
  const LM = loadManager();
  const stage = makeStage();
  const manager = LM.createManager();
  manager.init(stage);
  const ok = manager.update(updateArgs(stage, makeCamera(), true));
  assert.equal(ok, true);
  const visible = visibleNumerals(stage.labelContainer);
  assert.deepEqual(visible.map(v => v.day), SKELETON_DAYS);
  for (const v of visible) {
    assert.ok(v.opacity >= 0.25, `skeleton numeral ${v.day} readable (opacity ${v.opacity})`);
  }
});

test("B7.60.3 composed overhead pipeline keys the skeleton to the selected Moon when the camera faces another Moon", () => {
  // The divergence the B7.60.1/B7.60.2 harnesses never modeled — and
  // the one the real page actually has: in settled Top View the
  // renderer's disclosure window follows the camera azimuth (here
  // Moons 13/1/2, center Moon 1, as measured in a real browser at
  // theta = π), while the selection stays on Moon 8. With B7.60.3 the
  // renderer builds the selected Moon's neighborhood into the target
  // aperture overhead and the gate keys the skeleton to it, so the
  // composed visible set is the selected Moon's skeleton — and none
  // of the camera-center Moons' anchors.
  const LM = loadManager();
  const stage = makeStage();
  const manager = LM.createManager();
  manager.init(stage);
  const args = updateArgs(stage, makeCamera(), true, {
    calendarDisclosure: { centerMoon: 1, moons: [13, 1, 2], halfWindow: 1, key: "1:1:13,1,2" },
    semanticTargets: buildTargets([13, 1, 2, 7, 8, 9])
  });
  const ok = manager.update(args);
  assert.equal(ok, true);
  const visible = visibleNumerals(stage.labelContainer);
  assert.deepEqual(visible.map(v => v.day), SKELETON_DAYS);
  for (const v of visible) {
    assert.ok(v.opacity >= 0.25, `skeleton numeral ${v.day} readable (opacity ${v.opacity})`);
  }
});

test("B7.60.2 composed tilted pipeline is unchanged (full disclosure rail)", () => {
  const LM = loadManager();
  const stage = makeStage();
  const manager = LM.createManager();
  manager.init(stage);
  const ok = manager.update(updateArgs(stage, makeCamera(), false));
  assert.equal(ok, true);
  const visible = visibleNumerals(stage.labelContainer);
  const days = visible.map(v => v.day);
  // The tilted fall-through still paints the disclosure Moons' full
  // 1..28 faces (subject to the X-aperture), including non-anchor days.
  assert.ok(days.length >= 75, `tilted rail stays dense (${days.length} numerals)`);
  for (const day of [197, 198, 200, 210, 215, 224, 231]) {
    assert.ok(days.includes(day), `tilted rail includes day ${day}`);
  }
  for (let day = 197; day <= 224; day++) {
    assert.ok(days.includes(day), `front Moon face complete at day ${day}`);
  }
});

test("B7.60.2 tilted-then-overhead sequence re-gates to the skeleton", () => {
  const LM = loadManager();
  const stage = makeStage();
  const manager = LM.createManager();
  manager.init(stage);
  // First evaluation: mid-transition camera, not yet overhead — the
  // dense tilted rail is composed and painted.
  manager.update(updateArgs(stage, makeCamera(1), false));
  const tilted = visibleNumerals(stage.labelContainer);
  assert.ok(tilted.length >= 75, `mid-transition rail is dense (${tilted.length})`);
  // Settled evaluation: camera overhead (different camera signature) —
  // the sweep must retire every non-skeleton numeral the first pass
  // painted; only the skeleton set may remain visible.
  manager.update(updateArgs(stage, makeCamera(0.2, new Vector3(0.4, 6.5, 0.4)), true));
  const settled = visibleNumerals(stage.labelContainer);
  assert.deepEqual(settled.map(v => v.day), SKELETON_DAYS);
});
