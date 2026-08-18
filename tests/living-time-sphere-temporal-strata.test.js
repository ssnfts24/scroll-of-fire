const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const api = require(path.resolve(__dirname, '../docs/assets/js/sphere/living-time-sphere-temporal-strata.js'));

test('Living Strata v2.1 exposes the intended 13–200 year spans', () => {
  assert.match(api.VERSION, /2\.1\.0-reality-corridors/);
  assert.deepEqual(api.ALLOWED_SPANS, [13,25,50,100,200]);
  assert.equal(api.clampSpan(180), 200);
});

test('history window places selected year at the outer/current edge', () => {
  const w = api.yearWindow(2026, 200, 'history');
  assert.equal(w.start, 1827);
  assert.equal(w.end, 2026);
  assert.equal(w.reference, 2026);
  assert.equal(w.referenceIndex, 199);
  assert.equal(w.years.length, 200);
});

test('balanced window preserves exact analytical year count around reference', () => {
  const w = api.yearWindow(2026, 25, 'balanced');
  assert.equal(w.years.length, 25);
  assert.ok(w.start < 2026);
  assert.ok(w.end > 2026);
  assert.equal(w.years[w.referenceIndex], 2026);
});

test('future window starts on selected year and expands outward', () => {
  const w = api.yearWindow(2026, 13, 'future');
  assert.equal(w.start, 2026);
  assert.equal(w.end, 2038);
  assert.equal(w.referenceIndex, 0);
});

test('onion radii encode older years inward and future years outward', () => {
  const history = api.yearWindow(2026, 25, 'history');
  assert.ok(api.radiusForYear(2002, history) < api.radiusForYear(2026, history));
  assert.equal(api.radiusForYear(2026, history), api.REFERENCE_RADIUS);

  const balanced = api.yearWindow(2026, 25, 'balanced');
  assert.ok(api.radiusForYear(balanced.start, balanced) < api.REFERENCE_RADIUS);
  assert.ok(api.radiusForYear(balanced.end, balanced) > api.REFERENCE_RADIUS);
});

test('200 year history stays in a compact shell band around the core', () => {
  const w = api.yearWindow(2026, 200, 'history');
  const b = api.shellBounds(w, 0.22);
  assert.ok(b.inner >= 1.01);
  assert.equal(b.outer, api.REFERENCE_RADIUS);
  assert.ok(b.outer - b.inner <= 0.22 + 1e-9);
});

test('every analytical year can remain represented while LOD reduces curve detail', () => {
  const w = api.yearWindow(2026, 200, 'history');
  assert.equal(w.years.length, 200);
  assert.ok(api.radialSegments('low', 200) < api.radialSegments('high', 200));
  assert.ok(api.majorInterval(200, 'low') >= api.majorInterval(200, 'high'));
});

test('shell contour generator is lightweight line geometry, not opaque sphere geometry', () => {
  const positions = api.ringSegments(1.2, 24, 0, false);
  assert.equal(positions.length, 24 * 2 * 3);
  const cutaway = api.ringSegments(1.2, 24, 0, true);
  assert.ok(cutaway.length < positions.length);
  assert.ok(cutaway.length > 0);
});

test('chronology filament winds through year membranes instead of replacing them', () => {
  const w = api.yearWindow(2026, 50, 'history');
  const first = api.chronologyPoint(0, w, 0.22);
  const last = api.chronologyPoint(w.count - 1, w, 0.22);
  assert.notDeepEqual([first.x, first.y, first.z], [last.x, last.y, last.z]);
  assert.equal(first.year, w.start);
  assert.equal(last.year, w.end);
  assert.ok(api.chronologyTurns(200) > api.chronologyTurns(25));
});

test('major shell hierarchy keeps reference and boundaries emphasized', () => {
  const w = api.yearWindow(2026, 100, 'history');
  assert.equal(api.isMajorYear(w.start, w, 'high'), true);
  assert.equal(api.isMajorYear(w.reference, w, 'high'), true);
  assert.equal(api.isMajorYear(2016, w, 'high'), true);
});


test('selected Pattern day becomes a stable corridor coordinate', () => {
  assert.equal(api.selectedPatternDay({ model: { selectedPatternPosition: { dayOfPatternYear: 307 } } }), 307);
  const p = api.pointAtPatternAngle(307, 1.24);
  assert.ok(Number.isFinite(p.x));
  assert.ok(Number.isFinite(p.z));
});

test('Pattern Moon corridor preserves the 13 x 28 anatomy', () => {
  assert.deepEqual(api.moonBoundsForPatternDay(1), { moon: 1, startDay: 1, endDay: 28 });
  assert.deepEqual(api.moonBoundsForPatternDay(307), { moon: 11, startDay: 281, endDay: 308 });
  assert.deepEqual(api.moonBoundsForPatternDay(364), { moon: 13, startDay: 337, endDay: 364 });
});
