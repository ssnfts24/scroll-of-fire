const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const labels = fs.readFileSync(
  'docs/assets/js/sphere/living-time-sphere-label-manager.js',
  'utf8'
);

const css = fs.readFileSync(
  'docs/assets/css/living-time-sphere.css',
  'utf8'
);

const sphere = fs.readFileSync(
  'docs/living-time-sphere.html',
  'utf8'
);

const planner = fs.readFileSync(
  'docs/assets/js/life-atlas/life-atlas-planner-ui.js',
  'utf8'
);

const version = fs.readFileSync(
  'docs/assets/js/moons-version.js',
  'utf8'
);


test('B7.58 selected Moon/day card exposes explicit Schedule action', () => {
  assert.match(
    labels,
    /sphere-semantic-label-schedule/
  );

  assert.match(
    labels,
    /textContent =\s*"\+ Schedule"/
  );

  assert.match(
    labels,
    /target\.id ===[\s\S]*"selected-day"[\s\S]*target\.kind ===[\s\S]*"moon"[\s\S]*target\.selected/
  );
});


test('B7.58 schedule action delegates date authority to temporal cursor', () => {
  assert.match(
    labels,
    /SOFTemporalCursor/
  );

  assert.match(
    labels,
    /getDate\?\.\(\)/
  );

  assert.match(
    labels,
    /getCoordinate\?\.\(\)[\s\S]*remnant13Moons/
  );

  assert.match(
    labels,
    /getFullYear\(\)/
  );

  assert.match(
    labels,
    /getMonth\(\)/
  );

  assert.match(
    labels,
    /getDate\(\)/
  );

  assert.doesNotMatch(
    labels,
    /toISOString\(\)\.slice\(0,\s*10\)/
  );
});


test('B7.58 reuses released Living Planner instead of creating a second scheduler', () => {
  assert.match(
    labels,
    /getElementById\([\s\S]*"living-planner-open"/
  );

  assert.match(
    labels,
    /plannerOpen\.click\(\)/
  );

  assert.match(
    labels,
    /getElementById\([\s\S]*"living-planner-date"/
  );

  assert.match(
    planner,
    /function\s+openPlanner\s*\(/
  );

  assert.match(
    sphere,
    /id="living-planner-open"/
  );

  assert.match(
    sphere,
    /id="living-planner-date"/
  );
});


test('B7.58 prefills selected civil date after planner reset', () => {
  assert.match(
    labels,
    /dateInput\.value =[\s\S]*selectedCivilDate/
  );

  assert.match(
    labels,
    /requestAnimationFrame\([\s\S]*applySelectedDay/
  );

  assert.match(
    labels,
    /setTimeout\([\s\S]*applySelectedDay/
  );

  assert.match(
    labels,
    /living-planner-pattern-readout/
  );
});


test('B7.58 emits an integration event for future planner adapters', () => {
  assert.match(
    labels,
    /sof:sphere-schedule-selected-day/
  );

  assert.match(
    labels,
    /__SOF_PENDING_SCHEDULE_DAY__/
  );
});


test('B7.58 schedule action is compact and touchable', () => {
  assert.match(
    css,
    /B7\.58 SELECTED DAY SCHEDULE START/
  );

  assert.match(
    css,
    /sphere-semantic-label-schedule/
  );

  assert.match(
    css,
    /touch-action:\s*manipulation/
  );

  assert.match(
    css,
    /sphere-semantic-label-schedule\[hidden\]/
  );
});


test('B7.58 advances app and cache identity', () => {
  assert.match(
    version,
    /APP_VERSION = "2026\.08\.20\.58"/
  );

  assert.match(
    sphere,
    /living-time-sphere-label-manager\.js\?v=[^"' ]+&r=20260820-b758/
  );

  assert.match(
    sphere,
    /living-time-sphere\.css\?v=[^"' ]+&r=20260820-b758/
  );
});
