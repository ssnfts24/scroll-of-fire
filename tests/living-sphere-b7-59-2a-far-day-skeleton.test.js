const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const geometryPath = path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-calendar-geometry.js");
const labelsPath = path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-label-manager.js");
const rendererPath = path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
const spherePath = path.join(ROOT, "docs/living-time-sphere.html");

const geometrySource = fs.readFileSync(geometryPath, "utf8");
const labels = fs.readFileSync(labelsPath, "utf8");
const renderer = fs.readFileSync(rendererPath, "utf8");
const sphere = fs.readFileSync(spherePath, "utf8");

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(geometrySource, sandbox, { filename: geometryPath });
const geometry = sandbox.LivingTimeSphereCalendarGeometry;

test("B7.59.2A keeps the 13x28 calendar constitution unchanged", () => {
  assert.equal(geometry.MOONS, 13);
  assert.equal(geometry.DAYS_PER_MOON, 28);
  assert.equal(geometry.WEEKS_PER_MOON, 4);
  assert.equal(geometry.DAYS_PER_WEEK, 7);
  assert.equal(geometry.PATTERN_DAYS, 364);

  for (let day = 1; day <= 364; day += 1) {
    const a = geometry.dayAddress(day);
    const c = geometry.calendarCell(day);
    assert.equal(geometry.dayOfPatternYear(a.moon, a.moonDay), day);
    assert.equal(c.dayOfPatternYear, day);
    assert.equal(c.week, Math.floor((a.moonDay - 1) / 7) + 1);
    assert.equal(c.weekday, ((a.moonDay - 1) % 7) + 1);
  }
});

test("B7.59.2A far policy exposes front-week anchors and sparse neighbor anchors", () => {
  const p = geometry.numeralPolicy;

  for (const day of [1, 7, 14, 21, 28]) {
    assert.equal(p({ moon: 5, moonDay: day, selectedMoon: 5, band: "far", frontRank: 0, focusEligible: true }), true);
  }
  assert.equal(p({ moon: 5, moonDay: 2, selectedMoon: 5, band: "far", frontRank: 0, focusEligible: true }), false);

  for (const day of [1, 14, 28]) {
    assert.equal(p({ moon: 6, moonDay: day, selectedMoon: 5, band: "far", frontRank: 1, focusEligible: true }), true);
  }
  assert.equal(p({ moon: 6, moonDay: 7, selectedMoon: 5, band: "far", frontRank: 1, focusEligible: true }), false);
  assert.equal(p({ moon: 7, moonDay: 14, selectedMoon: 5, band: "far", frontRank: 2, focusEligible: true }), false);
  assert.equal(p({ moon: 7, moonDay: 2, selectedMoon: 5, band: "far", frontRank: 2, focusEligible: false, selected: true }), true);
});

test("B7.59.2A label manager keeps far dates sparse and schedule-aware", () => {
  assert.match(labels, /B7\.59\.2A — FAR CALENDAR SKELETON/);
  assert.match(labels, /farFrontAnchor[\s\S]*?moonDay === 7[\s\S]*?moonDay === 21/);
  assert.match(labels, /farNeighborAnchor[\s\S]*?moonDay === 14[\s\S]*?moonDay === 28/);
  assert.match(labels, /structural[\s\S]*?\|\| scheduled/);
  assert.match(labels, /dataset\.farSkeleton/);
});

test("B7.59.2A preserves preference authority and uses one renderer cache identity", () => {
  assert.doesNotMatch(renderer, /_dayLabelMode = dayLabelMode \|\| "key"/);
  assert.match(renderer, /_dayLabelMode = _resolveDayLabelPreference\(dayLabelMode\)/);

  const urls = [...sphere.matchAll(/assets\/js\/sphere\/living-time-sphere-renderer-3d\.js\?[^"' ]+/g)].map(m => m[0]);
  assert.equal(urls.length, 2);
  assert.equal(urls[0], urls[1]);
  assert.match(urls[0], /b=20260820-b7592a-farskeleton/);
});
