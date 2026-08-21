const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const renderer = fs.readFileSync(
  'docs/assets/js/sphere/living-time-sphere-renderer-3d.js',
  'utf8'
);

const ui = fs.readFileSync(
  'docs/assets/js/sphere/living-time-sphere-ui.js',
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


test('B7.56 environment remains visible through camera motion', () => {
  const budgetStart = renderer.indexOf(
    'function _applyGestureVisualBudget(active)'
  );

  const budgetEnd = renderer.indexOf(
    'function setCameraGestureActive',
    budgetStart
  );

  const budget = renderer.slice(
    budgetStart,
    budgetEnd
  );

  assert.doesNotMatch(
    budget,
    /_objects\.environmentGroup,[\s\S]*object\.visible = false/
  );

  assert.match(
    renderer,
    /function _applyEnvironmentGestureBudget\(active\)/
  );

  assert.match(
    renderer,
    /group\.visible = true/
  );

  assert.match(
    renderer,
    /environmentCloudBands\.visible =[\s\S]*!active/
  );

  assert.match(
    renderer,
    /environmentPrecip\.visible =[\s\S]*!active/
  );
});


test('B7.56 environmental shell is subtle rather than a blue full-sphere wash', () => {
  assert.match(
    renderer,
    /side: THREE\.BackSide/
  );

  assert.match(
    renderer,
    /blending: THREE\.AdditiveBlending/
  );

  assert.match(
    renderer,
    /0\.025[\s\S]*cloud[\s\S]*0\.045[\s\S]*humidity[\s\S]*0\.035/
  );

  assert.doesNotMatch(
    renderer,
    /0\.06 \+ \(cloud \/ 100\) \* 0\.24/
  );
});


test('B7.56 environment has separate readable weather channels', () => {
  assert.match(
    renderer,
    /environment-compass/
  );

  assert.match(
    renderer,
    /environment-wind-arrows/
  );

  assert.match(
    renderer,
    /environment-temperature-marker/
  );

  assert.match(
    renderer,
    /environment-pressure-ring/
  );

  assert.match(
    renderer,
    /new THREE\.Points\([\s\S]*precipGeometry/
  );

  assert.match(
    renderer,
    /environment-day-night-terminator/
  );
});


test('B7.56 bridge exposes real live values and can show the environment', () => {
  assert.match(
    ui,
    /Cloud \$\{Math\.round\(cloud\)\}%/
  );

  assert.match(
    ui,
    /Wind \$\{Math\.round\(windSpeed\)\} km\/h/
  );

  assert.match(
    ui,
    /Humidity \$\{Math\.round\(humidity\)\}%/
  );

  assert.match(
    ui,
    /Show Environment/
  );

  assert.match(
    ui,
    /ENVIRONMENT_SHOW_FROM_BRIDGE/
  );

  assert.match(
    css,
    /B7\.56 ENVIRONMENT FIELD START/
  );
});


test('B7.56 carries a fresh cache and app identity', () => {
  assert.match(
    sphere,
    /living-time-sphere-renderer-3d\.js\?v=20260819-b7523[^"' ]*&r=20260820-b75[3-8]/
  );

  assert.match(
    sphere,
    /living-time-sphere-ui\.js\?v=20260819-b752&r=20260820-b75[3-8]/
  );

  assert.match(
    sphere,
    /living-time-sphere\.css\?v=20260819-b752&r=20260820-b75[3-8]/
  );

  assert.match(
    version,
    /APP_VERSION = "2026\.08\.20\.(?:56|57|58)"/
  );
});
