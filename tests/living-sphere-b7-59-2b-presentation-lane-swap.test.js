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

test("B7.59.2B leaves canonical 13x28 calendarCell geometry untouched", () => {
  assert.equal(geometry.MOONS, 13);
  assert.equal(geometry.DAYS_PER_MOON, 28);
  assert.equal(geometry.PATTERN_DAYS, 364);

  const expected = [1.298, 1.328, 1.358, 1.388];
  for (let week = 1; week <= 4; week += 1) {
    const day = 1 + (week - 1) * 7;
    const cell = geometry.calendarCell(day);
    assert.ok(Math.abs(cell.radialFactor - expected[week - 1]) < 1e-9);
    assert.equal(cell.radialLane, week);
  }
});

test("B7.59.2B/B7.59.2C day numerals use a presentation lane independent of canonical geometry", () => {
  assert.match(renderer, /dayNumberPresentationWeek1: 1\.320/);
  assert.match(renderer, /dayNumberPresentationWeekStep: 0\.092/);
  assert.match(renderer, /scheduleSymbolPresentationOffset: 0\.000/);
  assert.match(
    renderer,
    /const dayPresentationRadius =[\s\S]*?CALENDAR_RAIL\.dayNumberPresentationWeek1[\s\S]*?CALENDAR_RAIL\.dayNumberPresentationWeekStep/
  );
  assert.match(
    renderer,
    /kind: "pattern-day-number"[\s\S]*?worldX: presentationPoint\.x,[\s\S]*?worldZ: presentationPoint\.z/
  );
});

test("B7.59.2B/B7.59.2D schedule symbols use one derived presentation authority", () => {
  assert.match(extension, /calendarDisplayCell\?\.\(patternDay/);
  assert.match(extension, /displayCell\?\.scheduleRadialFactor/);
  assert.match(
    extension,
    /const markerRadius =[\s\S]*?cellRadius[\s\S]*?presentationRail\.scheduleSymbolPresentationOffset/
  );
  assert.match(
    extension,
    /const scheduleMarkerRadius =[\s\S]*?cellRadius[\s\S]*?rail\.scheduleSymbolPresentationOffset/
  );
  assert.match(
    extension,
    /const endRadius =[\s\S]*?presentationRail\.dayNumberPresentationWeek1[\s\S]*?presentationRail\.dayNumberPresentationWeekStep/
  );
  assert.match(extension, /living-plan-day-points/);
  assert.doesNotMatch(extension, /setDrawRange\(/);
});

test("B7.59.2B preserves B7.59.2A disclosure and cache identity", () => {
  assert.match(labels, /B7\.59\.2A — FAR CALENDAR SKELETON/);
  assert.match(labels, /farFrontAnchor/);
  assert.match(labels, /farNeighborAnchor/);
  assert.match(sphere, /living-time-sphere-renderer-3d\.js\?[^"']*s=20260820-b7592b-laneswap/);
  assert.match(sphere, /life-atlas-record-sphere-extension\.js\?[^"']*s=20260820-b7592b-laneswap/);
});
