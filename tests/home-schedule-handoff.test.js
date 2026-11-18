const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const home = fs.readFileSync(
  'docs/assets/js/home-observatory-instrument.js',
  'utf8'
);

const urlState = fs.readFileSync(
  'docs/assets/js/sphere/living-time-sphere-url-state.js',
  'utf8'
);

const sphereUi = fs.readFileSync(
  'docs/assets/js/sphere/living-time-sphere-ui.js',
  'utf8'
);

const labelManager = fs.readFileSync(
  'docs/assets/js/sphere/living-time-sphere-label-manager.js',
  'utf8'
);

test('homepage catches the schedule tap the label manager dispatches', () => {
  // The label manager dispatches this event from the "+ Schedule" button
  // on the selected-day card; on the homepage there is no planner to catch
  // it, so the homepage instrument must.
  assert.match(
    labelManager,
    /sof:sphere-schedule-selected-day/
  );
  assert.match(
    home,
    /document\.addEventListener\(\s*"sof:sphere-schedule-selected-day"/
  );
});

test('hand-off names the day with the marker the Sphere page already reads', () => {
  // The event detail carries pattern.dayOfPatternYear (1..364). The hand-off
  // turns it into ?marker=day-N, which parseSphereUrl reads and
  // _selectedDayFromMarker turns back into the selected day on load.
  assert.match(
    home,
    /detail\?\.pattern\?\.dayOfPatternYear/
  );
  assert.match(
    home,
    /params\.set\(\s*"marker",\s*`day-\$\{patternDay\}`\s*\)/
  );
  assert.match(
    urlState,
    /marker:\s*normalizeMarker\(url\.searchParams\.get\("marker"\)\)/
  );
  assert.match(
    sphereUi,
    /\/\^day-\(\\d\+\)\$\//
  );
});

test('hand-off lands on the Observatory planner and degrades to the Observatory alone', () => {
  assert.match(
    home,
    /living-time-sphere\.html.*#living-planner/
  );
  // A tap with no usable day still leaves the dead end: the visitor lands
  // on the Observatory instead of nowhere.
  assert.match(
    home,
    /if \(patternDay\) params\.set/
  );
  assert.match(
    home,
    /window\.location\.assign\(/
  );
});

test('homepage does not pretend to own a planner', () => {
  // The planner lives only on the Observatory page. The homepage must hand
  // off, never click a planner open button that is not there.
  assert.doesNotMatch(
    home,
    /getElementById\(\s*"living-planner-open"\s*\)/
  );
  assert.doesNotMatch(
    home,
    /plannerOpen\.click\(\)/
  );
  assert.doesNotMatch(
    home,
    /living-planner-date/
  );
});
