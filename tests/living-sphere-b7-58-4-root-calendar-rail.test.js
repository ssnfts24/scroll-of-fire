const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const geometrySource = fs.readFileSync(
  "docs/assets/js/sphere/living-time-sphere-calendar-geometry.js",
  "utf8"
);

const renderer = fs.readFileSync(
  "docs/assets/js/sphere/living-time-sphere-renderer-3d.js",
  "utf8"
);

const extension = fs.readFileSync(
  "docs/assets/js/sphere/life-atlas-record-sphere-extension.js",
  "utf8"
);

const sphere = fs.readFileSync(
  "docs/living-time-sphere.html",
  "utf8"
);

function loadGeometry() {
  const context = {};
  context.globalThis = context;
  vm.runInNewContext(geometrySource, context);
  return context.LivingTimeSphereCalendarGeometry;
}

test("B7.58.4 puts the four 7-day rows immediately above the visible rail", () => {
  const geometry = loadGeometry();

  const expected = [
    [1, 1.298],
    [8, 1.328],
    [15, 1.358],
    [22, 1.388],
  ];

  for (const [day, radius] of expected) {
    const cell = geometry.calendarCell(day);
    assert.equal(Number(cell.radialFactor.toFixed(3)), radius);
  }

  const outerSectorRail = 1.285;
  const first = geometry.calendarCell(1).radialFactor;
  const fourth = geometry.calendarCell(22).radialFactor;

  assert.ok(first > outerSectorRail);
  assert.ok(first - outerSectorRail <= 0.015);
  assert.ok(fourth - first <= 0.091);
  assert.ok(fourth <= 1.390);
});

test("B7.58.4 preserves canonical date and angle authority", () => {
  const geometry = loadGeometry();

  for (const day of [1, 7, 8, 14, 28, 29, 126, 364]) {
    const address = geometry.dayAddress(day);
    const cell = geometry.calendarCell(day);

    assert.equal(cell.dayOfPatternYear, address.dayOfPatternYear);
    assert.equal(cell.moon, address.moon);
    assert.equal(cell.moonDay, address.moonDay);
    assert.equal(cell.week, address.week);
    assert.equal(cell.canonicalAngle, address.angle);
  }
});

test("B7.58.4 pointer selection follows the compact calendar cells", () => {
  const geometry = loadGeometry();

  for (const day of [1, 8, 15, 22, 126, 364]) {
    const cell = geometry.calendarCell(day);
    const hit = geometry.nearestCalendarCell(
      cell.angle,
      cell.radialFactor,
      { maxDistance: 0.02 }
    );

    assert.ok(hit);
    assert.equal(hit.dayOfPatternYear, day);
  }
});

test("B7.58.4 renderer fallback and weekday grid match the root authority", () => {
  assert.match(renderer, /calendarMatrixWeek1: 1\.298/);
  assert.match(renderer, /calendarMatrixWeekStep: 0\.030/);
  assert.match(renderer, /calendarMatrixWeek1 - 0\.012/);
  assert.match(
    renderer,
    /3 \* CALENDAR_RAIL\.calendarMatrixWeekStep \+ 0\.012/
  );
});

test("B7.58.4 keeps B7.58.2 vertical placement unchanged for clean diagnosis", () => {
  assert.match(
    renderer,
    /kind: "pattern-day-number"[\s\S]*?worldY: 0\.010/
  );
});

test("B7.58.4 schedule and planner geometry remain bound to calendarCell radialFactor", () => {
  assert.match(
    extension,
    /const cellRadius = patternRingRadius \* Number\(cell\.radialFactor \|\| 1\)/
  );
  assert.match(
    extension,
    /calendarCell && Number\.isFinite\(Number\(calendarCell\.radialFactor\)\)/
  );
  assert.match(
    extension,
    /const radius = patternRingRadius \* Number\(cell\.radialFactor \|\| 1\)/
  );
  assert.match(extension, /living-plan-day-points/);
  assert.match(
    extension,
    /B7\.58\.2 schedule symbol scale[\s\S]*?\* 0\.90/
  );
});

test("B7.58.4 cache-busts the changed geometry modules", () => {
  assert.match(
    sphere,
    /living-time-sphere-calendar-geometry\.js\?[^"' ]+&r=20260820-b7584-rootrail/
  );

  assert.match(
    sphere,
    /living-time-sphere-renderer-3d\.js\?[^"' ]+&r=20260820-b7584-rootrail/
  );
});
