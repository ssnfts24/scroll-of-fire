const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const geometryPath = path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-calendar-geometry.js");
const rendererPath = path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-renderer-3d.js");

const geometrySource = fs.readFileSync(geometryPath, "utf8");
const renderer = fs.readFileSync(rendererPath, "utf8");

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(geometrySource, sandbox, { filename: geometryPath });
const geometry = sandbox.LivingTimeSphereCalendarGeometry;

// The renderer's presentation-lane constants (CALENDAR_RAIL in renderer-3d).
const RAIL = { dayNumberWeek1: 1.320, dayNumberWeekStep: 0.092 };

test("B7.61 canonical calendarCell lanes are untouched", () => {
  const expected = [1.298, 1.328, 1.358, 1.388];
  for (let week = 1; week <= 4; week += 1) {
    const cell = geometry.calendarCell(1 + (week - 1) * 7);
    assert.ok(Math.abs(cell.radialFactor - expected[week - 1]) < 1e-9);
  }
});

test("B7.61 a tap at every day numeral's exact centre selects that exact day", () => {
  for (let day = 1; day <= 364; day += 1) {
    const display = geometry.calendarDisplayCell(day, RAIL);
    const hit = geometry.nearestDisplayCell(display.angle, display.dayNumberRadialFactor, {
      ...RAIL,
      maxDistance: 0.12,
    });
    assert.ok(hit, `no hit for day ${day}`);
    assert.equal(
      hit.dayOfPatternYear,
      day,
      `tap on numeral ${day} selected ${hit.dayOfPatternYear} (the +7 week-row defect)`
    );
  }
});

test("B7.61 display-lane picking never lands one week row over", () => {
  // The measured defect: weeks 1-3 resolved to day+7, week 3 sometimes +8.
  for (let day = 1; day <= 357; day += 1) {
    const display = geometry.calendarDisplayCell(day, RAIL);
    const hit = geometry.nearestDisplayCell(display.angle, display.dayNumberRadialFactor, {
      ...RAIL,
      maxDistance: 0.12,
    });
    assert.notEqual(hit.dayOfPatternYear, day + 7);
    assert.notEqual(hit.dayOfPatternYear, day + 8);
  }
});

test("B7.61 display-lane picking still resolves taps between close columns to the nearer day", () => {
  // Midpoint between two adjacent columns of the same week must resolve to
  // one of the two neighbours, never to a different week.
  const a = geometry.calendarDisplayCell(10, RAIL); // Moon 1, week 2, weekday 3
  const b = geometry.calendarDisplayCell(11, RAIL); // next column
  const midAngle = (a.angle + b.angle) / 2;
  const hit = geometry.nearestDisplayCell(midAngle, a.dayNumberRadialFactor, {
    ...RAIL,
    maxDistance: 0.12,
  });
  assert.ok([10, 11].includes(hit.dayOfPatternYear), `midpoint resolved to ${hit.dayOfPatternYear}`);
});

test("B7.61 empty space far from every numeral selects nothing", () => {
  const hit = geometry.nearestDisplayCell(10, 0.4, { ...RAIL, maxDistance: 0.12 });
  assert.equal(hit, null);
});

test("B7.61 the renderer's canvas pick searches the display lanes", () => {
  const start = renderer.indexOf("function _handleClick");
  const end = renderer.indexOf("function _wireResize", start);
  const handleClick = renderer.slice(start, end);
  assert.match(handleClick, /nearestDisplayCell/);
  assert.match(handleClick, /CALENDAR_RAIL\.dayNumberPresentationWeek1/);
  assert.match(handleClick, /CALENDAR_RAIL\.dayNumberPresentationWeekStep/);
  assert.doesNotMatch(handleClick, /nearestCalendarCell/);
});

test("B7.61 picking invariant: canvas pinned to container origin, telemetry overlays", () => {
  const renderer = fs.readFileSync(path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-renderer-3d.js"), "utf8");
  assert.match(renderer, /_canvas\.style\.position = "absolute"/);
  assert.match(renderer, /_canvas\.style\.left = "0"/);
  assert.match(renderer, /_canvas\.style\.top = "0"/);
  const css = fs.readFileSync(path.join(ROOT, "docs/assets/css/living-time-sphere.css"), "utf8");
  const telemetryRule = css.slice(css.indexOf(".sphere-live-environment-telemetry {"), css.indexOf(".sphere-live-environment-telemetry {") + 700);
  assert.match(telemetryRule, /position:\s*absolute/);
  assert.doesNotMatch(telemetryRule, /position:\s*relative/);
});

test("B7.61 picking invariant: expanded semantic cards are click-through except controls", () => {
  const css = fs.readFileSync(path.join(ROOT, "docs/assets/css/living-time-sphere.css"), "utf8");
  assert.match(css, /\.sphere-semantic-label \{\s*pointer-events: none;/);
  assert.match(css, /\.sphere-semantic-label\[data-semantic-id="selected-day"\] button,/);
  assert.match(css, /data-semantic-kind="living-plan"\] \.sphere-semantic-label-body/);
});

test("B7.61 picking invariant: readout-card schedule buttons are click-through", () => {
  const css = fs.readFileSync(path.join(ROOT, "docs/assets/css/living-time-sphere.css"), "utf8");
  assert.match(css, /\.sphere-semantic-label \.sphere-semantic-label-schedule \{\s*pointer-events: none;/);
  assert.match(css, /\.sphere-semantic-label\[data-semantic-id="selected-day"\] \.sphere-semantic-label-schedule/);
});
