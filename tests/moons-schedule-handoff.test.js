const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const moonsHandoff = fs.readFileSync(
  'docs/assets/js/moons-schedule-handoff.js',
  'utf8'
);

const moonsPage = fs.readFileSync('docs/moons.html', 'utf8');

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

test('13 Moons page loads the schedule hand-off', () => {
  assert.match(moonsPage, /assets\/js\/moons-schedule-handoff\.js/);
});

test('13 Moons catches the schedule tap the label manager dispatches', () => {
  // The label manager dispatches this event from the "+ Schedule" button
  // on the selected-day card; on the 13 Moons page there is no planner to
  // catch it, so the moons hand-off must — exactly as the homepage
  // instrument does since PR #118.
  assert.match(
    labelManager,
    /sof:sphere-schedule-selected-day/
  );
  assert.match(
    moonsHandoff,
    /document\.addEventListener\(\s*"sof:sphere-schedule-selected-day"/
  );
});

test('hand-off names the day with the marker the Sphere page already reads', () => {
  // The event detail carries pattern.dayOfPatternYear (1..364). The hand-off
  // turns it into ?marker=day-N, which parseSphereUrl reads and
  // _selectedDayFromMarker turns back into the selected day on load.
  assert.match(
    moonsHandoff,
    /detail\?\.pattern\?\.dayOfPatternYear/
  );
  assert.match(
    moonsHandoff,
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
    moonsHandoff,
    /living-time-sphere\.html.*#living-planner/
  );
  // A tap with no usable day still leaves the dead end: the visitor lands
  // on the Observatory instead of nowhere.
  assert.match(
    moonsHandoff,
    /if \(patternDay\) params\.set/
  );
  assert.match(
    moonsHandoff,
    /window\.location\.assign\(/
  );
});

test('13 Moons does not pretend to own a planner', () => {
  // The planner lives only on the Observatory page. The 13 Moons page must
  // hand off, never click a planner open button that is not there.
  assert.doesNotMatch(
    moonsHandoff,
    /getElementById\(\s*"living-planner-open"\s*\)/
  );
  assert.doesNotMatch(
    moonsHandoff,
    /plannerOpen\.click\(\)/
  );
  assert.doesNotMatch(
    moonsHandoff,
    /living-planner-date/
  );
  assert.doesNotMatch(moonsPage, /id="living-planner-open"/);
});
