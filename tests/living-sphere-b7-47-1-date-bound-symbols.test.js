const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const renderer = fs.readFileSync(path.join(root, 'docs/assets/js/sphere/living-time-sphere-renderer-3d.js'), 'utf8');
const labels = fs.readFileSync(path.join(root, 'docs/assets/js/sphere/living-time-sphere-label-manager.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'docs/assets/css/living-time-sphere.css'), 'utf8');
const sphere = fs.readFileSync(path.join(root, 'docs/living-time-sphere.html'), 'utf8');
const moons = fs.readFileSync(path.join(root, 'docs/moons.html'), 'utf8');

test('B7.47.1 preserves B7.45 as the single camera calendar disclosure authority', () => {
  assert.match(renderer, /B7\.45 — unified camera calendar disclosure authority/);
  assert.match(renderer, /calendarDisclosure:\s*extra\?\.calendarDisclosure \|\| _cameraCalendarDisclosure\(\)/);
  assert.match(labels, /const sharedMoonWindow/);
});

test('B7.47.1 binds planner symbol and count directly to the canonical day target', () => {
  assert.match(renderer, /dayScheduleCount: Number\(plannerSummary\.count\) \|\| 0/);
  assert.match(renderer, /symbol: plannerSummary\.primarySymbol \|\| null/);
  assert.match(renderer, /recordId: plannerSummary\.primaryRecordId \|\| null/);
});

test('B7.47.1 preserves legacy scheduleCount through semantic normalization', () => {
  assert.match(labels, /target\.dayScheduleCount \?\? target\.scheduleCount/);
  assert.match(labels, /if \(target\.symbol\) el\.dataset\.planSymbol = target\.symbol/);
  assert.match(labels, /if \(target\.dayScheduleCount\) el\.dataset\.scheduleCount/);
});

test('B7.47.1 keeps schedule metadata on canonical day labels without a duplicate pseudo-glyph', () => {
  assert.doesNotMatch(css, /content:\s*attr\(data-plan-symbol\)/);
  assert.match(css, /data-plan-symbol\]::after[\s\S]*content: none !important/);
  assert.match(renderer, /dayScheduleCount: Number\(plannerSummary\.count\) \|\| 0/);
  assert.match(renderer, /symbol: plannerSummary\.primarySymbol \|\| null/);
});

test('B7.47.1 contract remains cache-busted in the B7.52 full-sphere / ambient-Moons split', () => {
  assert.match(sphere, /living-time-sphere\.css\?v=20260819-b752/);
  assert.match(sphere, /living-time-sphere-label-manager\.js\?v=20260819-b750/);
  assert.match(sphere, /living-time-sphere-renderer-3d\.js\?v=20260819-b7523/);
  assert.match(moons, /living-time-sphere\.css\?v=20260819-b752/);
  assert.doesNotMatch(moons, /living-time-sphere-renderer-3d\.js/);
});
