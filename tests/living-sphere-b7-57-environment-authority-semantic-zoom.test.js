const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = path =>
  fs.readFileSync(path, 'utf8');

const history = read(
  'docs/assets/js/environment/providers/open-meteo-history.js'
);

const air = read(
  'docs/assets/js/environment/providers/open-meteo-air-quality.js'
);

const space = read(
  'docs/assets/js/environment/providers/space-weather-provider.js'
);

const authority = read(
  'docs/assets/js/environment/environment-authority.js'
);

const ui = read(
  'docs/assets/js/sphere/living-time-sphere-ui.js'
);

const renderer = read(
  'docs/assets/js/sphere/living-time-sphere-renderer-3d.js'
);

const labels = read(
  'docs/assets/js/sphere/living-time-sphere-label-manager.js'
);

const sphere = read(
  'docs/living-time-sphere.html'
);

const sw = read(
  'docs/service-worker.js'
);

const version = read(
  'docs/assets/js/moons-version.js'
);


test('B7.57 installs current, historical, air-quality and space-weather authorities', () => {
  assert.match(
    history,
    /historical-forecast-api\.open-meteo\.com\/v1\/forecast/
  );

  assert.match(
    history,
    /archive-api\.open-meteo\.com\/v1\/archive/
  );

  assert.match(
    history,
    /ARCHIVE_START = "1940-01-01"/
  );

  assert.match(
    air,
    /air-quality-api\.open-meteo\.com\/v1\/air-quality/
  );

  assert.match(
    air,
    /us_aqi/
  );

  assert.match(
    space,
    /noaa-planetary-k-index\.json/
  );

  assert.match(
    space,
    /noaa-scales\.json/
  );

  assert.match(
    space,
    /kp\.gfz\.de\/app\/json/
  );

  assert.match(
    space,
    /GFZ_START = "1932-01-01"/
  );

  assert.match(
    authority,
    /SofEnvironmentState[\s\S]*setEnvironmentState/
  );
});


test('B7.57 top telemetry always represents temperature in both C and F', () => {
  assert.match(
    ui,
    /function _dualTemperature/
  );

  assert.match(
    ui,
    /—°C \/ —°F/
  );

  assert.match(
    ui,
    /°C \/ \$\{Math\.round\(f\)\}°F/
  );

  assert.match(
    ui,
    /sphere-live-environment-telemetry/
  );

  assert.match(
    ui,
    /_formatKp/
  );

  assert.match(
    ui,
    /_formatAqi/
  );
});


test('B7.57 adds a low-overdraw geomagnetic Kp field to the environment group', () => {
  assert.match(
    renderer,
    /function _buildSpaceWeatherField\(\)/
  );

  assert.match(
    renderer,
    /environment-kp-ring-/
  );

  assert.match(
    renderer,
    /function _applySpaceWeatherField\(spaceWeather\)/
  );

  assert.match(
    renderer,
    /kp \/ 9/
  );

  assert.match(
    renderer,
    /geomagnetic-kp-field/
  );
});


test('B7.57 days dissipate at far semantic zoom while selected/scheduled information survives longer', () => {
  assert.match(
    labels,
    /const railZoomOpacity =/
  );

  assert.match(
    labels,
    /if \(band === "far"\)/
  );

  assert.match(
    labels,
    /scheduled[\s\S]*\? 0\.34[\s\S]*: 0/
  );

  assert.match(
    labels,
    /railZoomOpacity\([\s\S]*candidate/
  );
});


test('B7.57 loads and caches all provider modules before the Sphere UI', () => {
  for (const token of [
    'open-meteo-history.js',
    'open-meteo-air-quality.js',
    'space-weather-provider.js',
    'environment-authority.js'
  ]) {
    assert.ok(sphere.includes(token), token);
    assert.ok(sw.includes(token), `service worker ${token}`);
  }

  const authorityIndex =
    sphere.indexOf('environment-authority.js');

  const uiIndex =
    sphere.indexOf('living-time-sphere-ui.js');

  assert.ok(
    authorityIndex >= 0
    && uiIndex > authorityIndex
  );
});


test('B7.57 carries a fresh cache and app identity', () => {
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
    /living-time-sphere-ui\.js\?v=20260819-b752&r=20260820-b757/
  );

  assert.match(
    version,
    /APP_VERSION = "2026\.08\.20\.57"/
  );
});
