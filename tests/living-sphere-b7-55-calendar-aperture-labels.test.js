const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const renderer = fs.readFileSync(
  'docs/assets/js/sphere/living-time-sphere-renderer-3d.js',
  'utf8'
);

const labels = fs.readFileSync(
  'docs/assets/js/sphere/living-time-sphere-label-manager.js',
  'utf8'
);

const extension = fs.readFileSync(
  'docs/assets/js/sphere/life-atlas-record-sphere-extension.js',
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

const version = fs.readFileSync(
  'docs/assets/js/moons-version.js',
  'utf8'
);


test('B7.55 keeps adjacent calendar data available while rotating', () => {
  assert.match(
    renderer,
    /function _calendarDisclosureHalfWindow\(\)[\s\S]*return 1;/
  );
});


test('B7.55 disables Moon numeral field and keeps 13 Moon labels available', () => {
  assert.match(
    renderer,
    /const MOON_NUMBER_FIELD_ENABLED = false/
  );

  assert.match(
    renderer,
    /if \(!MOON_NUMBER_FIELD_ENABLED\) return/
  );

  assert.match(
    renderer,
    /return new Set\([\s\S]*Array\.from\([\s\S]*length: 13/
  );

  assert.match(
    labels,
    /labelMode === "all"[\s\S]*profile === "observatory"/
  );
});


test('B7.55 days use a central aperture with smooth dissipating edges', () => {
  assert.match(
    labels,
    /const railApertureOpacity =/
  );

  assert.match(
    labels,
    /stageRect\.width[\s\S]*0\.27/
  );

  assert.match(
    labels,
    /stageRect\.width[\s\S]*0\.39/
  );

  assert.match(
    labels,
    /smoothstep: no hard/
  );

  assert.match(
    labels,
    /el\.dataset\.apertureOpacity/
  );
});


test('B7.55 scheduled symbols consume the same projected aperture', () => {
  assert.match(
    extension,
    /float aperture =/
  );

  assert.match(
    extension,
    /smoothstep\([\s\S]*0\.54[\s\S]*0\.78/
  );

  assert.match(
    extension,
    /disclosed \*=[\s\S]*aperture/
  );

  assert.match(
    sphere,
    /life-atlas-record-sphere-extension\.js\?v=20260819-b750&r=20260820-b757/
  );
});


test('B7.55 maintains clean day styling and compact persistent Moon labels', () => {
  assert.match(
    css,
    /B7\.55 CALENDAR APERTURE \+ MOON LABELS START/
  );

  assert.match(
    css,
    /living-time-sphere-page[\s\S]*sphere-moon-label[\s\S]*font-size/
  );

  assert.match(
    css,
    /opacity 72ms linear/
  );
});


test('B7.55 carries a fresh app and renderer cache identity', () => {
  assert.match(
    sphere,
    /living-time-sphere-renderer-3d\.js\?v=20260819-b7523&r=20260820-b757/
  );

  assert.match(
    sphere,
    /living-time-sphere-label-manager\.js\?v=20260819-b750&r=20260820-b757/
  );

  assert.match(
    sphere,
    /living-time-sphere\.css\?v=20260819-b752&r=20260820-b757/
  );

  assert.match(
    version,
    /APP_VERSION = "2026\.08\.20\.(?:55|56|57)"/
  );
});
