const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const geometryPath = 'docs/assets/js/sphere/living-time-sphere-calendar-geometry.js';
const geometrySource = fs.readFileSync(geometryPath, 'utf8');
const renderer = fs.readFileSync('docs/assets/js/sphere/living-time-sphere-renderer-3d.js', 'utf8');
const extension = fs.readFileSync('docs/assets/js/sphere/life-atlas-record-sphere-extension.js', 'utf8');
const labels = fs.readFileSync('docs/assets/js/sphere/living-time-sphere-label-manager.js', 'utf8');
const css = fs.readFileSync('docs/assets/css/living-time-sphere.css', 'utf8');
const sphere = fs.readFileSync('docs/living-time-sphere.html', 'utf8');

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(geometrySource, sandbox, { filename: geometryPath });
const geometry = sandbox.LivingTimeSphereCalendarGeometry;

test('B7.59.2D derives one display packet without moving canonical calendarCell', () => {
  assert.equal(geometry.MOONS, 13);
  assert.equal(geometry.DAYS_PER_MOON, 28);
  assert.equal(geometry.PATTERN_DAYS, 364);
  assert.equal(typeof geometry.calendarDisplayCell, 'function');

  const canonical = geometry.calendarCell(22);
  const display = geometry.calendarDisplayCell(22, {
    dayNumberWeek1: 1.320,
    dayNumberWeekStep: 0.092,
    scheduleInset: 0.046
  });

  assert.ok(Math.abs(canonical.radialFactor - 1.388) < 1e-9);
  assert.ok(Math.abs(display.dayNumberRadialFactor - 1.596) < 1e-9);
  assert.ok(Math.abs(display.scheduleRadialFactor - 1.550) < 1e-9);
  assert.equal(display.angle, canonical.angle);
  assert.equal(display.moon, canonical.moon);
  assert.equal(display.moonDay, canonical.moonDay);
});

test('B7.59.2D renderer and schedule field consume the shared display cell', () => {
  assert.match(renderer, /calendarDisplayCell\?\.\(dayOfYear/);
  assert.match(renderer, /scheduleSymbolInset: 0\.046/);
  assert.match(extension, /calendarDisplayCell\?\.\(patternDay/);
  assert.match(extension, /displayCell\?\.scheduleRadialFactor/);
  assert.match(extension, /displayCell\?\.dayNumberRadialFactor/);
});

test('B7.59.2D current-year schedules render once through the batched day field', () => {
  assert.match(extension, /living-plan-day-symbol-atlas/);
  assert.match(extension, /new THREE\.Points\(geometry, material\)/);
  assert.match(extension, /current-year plans are represented once by the batched/);
  assert.match(extension, /const countLabel =[\s\S]*?summary\.count > 9/);
  assert.match(extension, /const glyph = `\$\{symbol\}\$\{countLabel\}`/);
  assert.match(extension, /indexBySymbol\?\.get\(entry\.glyph \|\| entry\.symbol\)/);
  assert.doesNotMatch(extension, /setDrawRange\(/);
});

test('B7.59.2D scheduled dates and symbols co-disclose at far zoom', () => {
  assert.match(extension, /const visible = revealAll \|\| !!frontMoon;/);
  const pickStart = extension.indexOf('function _plannerEntryVisible');
  const pickEnd = extension.indexOf('function colorFor', pickStart);
  const pickBlock = extension.slice(pickStart, pickEnd);
  assert.doesNotMatch(pickBlock, /if \(band === "far"\) return false;/);
  assert.match(labels, /Scheduled days also survive/);
  assert.match(labels, /if \(target\.dayScheduleCount\) el\.dataset\.scheduleCount/);
  assert.match(labels, /if \(target\.dayScheduleCount\) el\.dataset\.hasSchedule = "true"/);
  assert.match(css, /B7\.59\.2D UNIFIED DAY \+ SCHEDULE PACKET START/);
  assert.match(css, /data-has-schedule="true"/);
});

test('B7.59.2D keeps automatic schedule cards quiet until selected or detail', () => {
  assert.match(extension, /if \(!summarySelected && band !== "detail"\) continue;/);
  assert.match(extension, /dayScheduleCount: summary\.count/);
  assert.match(extension, /data\.type !== "living-plan-day-points"/);
});

test('B7.59.2D cache identity reaches changed standalone assets', () => {
  assert.match(sphere, /living-time-sphere-calendar-geometry\.js\?[^"']*d=20260821-b7592d7-unified/);
  assert.match(sphere, /living-time-sphere-label-manager\.js\?[^"']*d=20260821-b7592d7-unified/);
  assert.match(sphere, /life-atlas-record-sphere-extension\.js\?[^"']*d=20260821-b7592d7-unified/);
  assert.match(sphere, /living-time-sphere-renderer-3d\.js\?[^"']*d=20260821-b7592d7-unified/);
});
