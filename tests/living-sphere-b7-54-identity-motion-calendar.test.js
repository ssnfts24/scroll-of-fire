const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const renderer =
  fs.readFileSync(
    'docs/assets/js/sphere/living-time-sphere-renderer-3d.js',
    'utf8'
  );

const labels =
  fs.readFileSync(
    'docs/assets/js/sphere/living-time-sphere-label-manager.js',
    'utf8'
  );

const css =
  fs.readFileSync(
    'docs/assets/css/living-time-sphere.css',
    'utf8'
  );

const sphere =
  fs.readFileSync(
    'docs/living-time-sphere.html',
    'utf8'
  );

const version =
  fs.readFileSync(
    'docs/assets/js/moons-version.js',
    'utf8'
  );

test(
  'B7.54 atlas implementation remains recoverable but B7.55 uses Moon labels',
  () => {
    assert.match(
      renderer,
      /function _buildMoonNumberField\(/
    );

    assert.match(
      renderer,
      /const MOON_NUMBER_FIELD_ENABLED = false/
    );

    assert.match(
      renderer,
      /if \(!MOON_NUMBER_FIELD_ENABLED\) return/
    );
  }
);
test(
  'B7.54 restores moving resolution without removing the gesture budget',
  () => {
    assert.match(
      renderer,
      /MOBILE_SETTLED_DPR_CAP = 1\.25/
    );

    assert.match(
      renderer,
      /MOBILE_GESTURE_DPR_CAP = 1\.00/
    );

    assert.match(
      renderer,
      /MOBILE_GESTURE_DPR_LOWPOWER = 0\.72/
    );

    assert.match(
      renderer,
      /_applyGestureVisualBudget\(_cameraGestureActive\)/
    );
  }
);

test(
  'B7.54/B7.55 keeps canonical dates camera-bound through one flowing aperture',
  () => {
    assert.match(
      labels,
      /const railApertureOpacity =/
    );

    assert.match(
      labels,
      /sharedMoonWindow[\s\S]*\.has\(moon\)/
    );

    assert.match(
      labels,
      /railLabelVisible\([\s\S]*candidate/
    );
  }
);
test(
  'B7.54 ordinary days are etched numbers rather than 28 pills',
  () => {
    assert.match(
      css,
      /B7\.54 CLEAN CALENDAR RAIL START/
    );

    assert.match(
      css,
      /data-quiet-rail="true"[\s\S]*?border: 0 !important/
    );

    assert.match(
      css,
      /data-quiet-rail="true"[\s\S]*?background: transparent !important/
    );

    assert.match(
      css,
      /data-gate-day="true"[\s\S]*?border-radius: 50%/
    );
  }
);

test(
  'B7.54 cache identity reaches renderer labels CSS and app version',
  () => {
    assert.match(
      sphere,
      /living-time-sphere-renderer-3d\.js\?v=20260819-b7523&r=20260820-b75[3-8]/
    );

    assert.match(
      sphere,
      /living-time-sphere-label-manager\.js\?v=20260819-b750&r=20260820-b75[3-8]/
    );

    assert.match(
      sphere,
      /living-time-sphere\.css\?v=20260819-b752&r=20260820-b75[3-8]/
    );

    assert.match(
      version,
      /APP_VERSION = "2026\.08\.20\.(?:55|56|57|58)"/
    );
  }
);
