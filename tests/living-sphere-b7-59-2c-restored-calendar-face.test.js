const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const geometryPath = path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-calendar-geometry.js");
const rendererPath = path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
const extensionPath = path.join(ROOT, "docs/assets/js/sphere/life-atlas-record-sphere-extension.js");
const labelsPath = path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-label-manager.js");
const spherePath = path.join(ROOT, "docs/living-time-sphere.html");

const geometrySource = fs.readFileSync(geometryPath, "utf8");
const renderer = fs.readFileSync(rendererPath, "utf8");
const extension = fs.readFileSync(extensionPath, "utf8");
const labels = fs.readFileSync(labelsPath, "utf8");
const sphere = fs.readFileSync(spherePath, "utf8");

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(geometrySource, sandbox, { filename: geometryPath });
const geometry = sandbox.LivingTimeSphereCalendarGeometry;

test("B7.59.2C keeps compact canonical cells while restoring the broad visual 4x7 face", () => {
  const canonical = [1.298, 1.328, 1.358, 1.388];
  const visual = [1.320, 1.412, 1.504, 1.596];

  for (let week = 1; week <= 4; week += 1) {
    const day = 1 + (week - 1) * 7;
    const cell = geometry.calendarCell(day);
    assert.ok(Math.abs(cell.radialFactor - canonical[week - 1]) < 1e-9);
    assert.ok(visual[week - 1] > canonical[week - 1]);
  }

  assert.match(renderer, /dayNumberPresentationWeek1: 1\.320/);
  assert.match(renderer, /dayNumberPresentationWeekStep: 0\.092/);
});

test("B7.59.2C derives numeral position from canonical week but does not mutate calendarCell", () => {
  assert.match(
    renderer,
    /const presentationWeek =[\s\S]*?calendarCell\?\.week[\s\S]*?Math\.floor\(\(moonDay - 1\) \/ 7\) \+ 1/
  );
  assert.match(
    renderer,
    /const dayPresentationRadius =[\s\S]*?dayNumberPresentationWeek1[\s\S]*?dayNumberPresentationWeekStep/
  );
  assert.match(
    renderer,
    /kind: "pattern-day-number"[\s\S]*?worldX: presentationPoint\.x,[\s\S]*?worldZ: presentationPoint\.z/
  );
});

test("B7.59.2C/B7.59.2D keeps the broad 4x7 number face while schedule marks derive from the same display cell", () => {
  assert.match(renderer, /scheduleSymbolInset: 0\.046/);
  assert.match(extension, /calendarDisplayCell\?\.\(patternDay/);
  assert.match(extension, /displayCell\?\.scheduleRadialFactor/);
  assert.match(extension, /displayCell\?\.dayNumberRadialFactor/);
  assert.match(extension, /living-plan-day-points/);
  assert.doesNotMatch(extension, /setDrawRange\(/);
});

test("B7.59.2C preserves B7.59.2A semantic disclosure and fresh runtime identity", () => {
  assert.match(labels, /B7\.59\.2A — FAR CALENDAR SKELETON/);
  assert.match(labels, /farFrontAnchor/);
  assert.match(labels, /farNeighborAnchor/);
  assert.match(sphere, /living-time-sphere-renderer-3d\.js\?[^"']*f=20260820-b7592c-face/);
  assert.match(sphere, /life-atlas-record-sphere-extension\.js\?[^"']*f=20260820-b7592c-face/);
});
