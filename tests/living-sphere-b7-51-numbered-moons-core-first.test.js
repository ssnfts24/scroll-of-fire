const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('B7.51/B7.55 keeps all 13 Pattern Moons distinct while Moon identity is label-driven', () => {
  const src = read('docs/assets/js/sphere/living-time-sphere-renderer-3d.js');

  assert.match(
    src,
    /MOON_IDENTITY_COLORS = Object\.freeze\(\[/
  );

  assert.match(
    src,
    /MOON_IDENTITY_SHAPES = Object\.freeze\(\[/
  );

  assert.match(
    src,
    /new _THREE\.InstancedMesh\(geometry, material, 13\)/
  );

  assert.match(
    src,
    /const MOON_NUMBER_FIELD_ENABLED = false/
  );

  assert.match(
    src,
    /return new Set\([\s\S]*Array\.from\([\s\S]*length: 13/
  );
});

test('B7.51 separates Pattern Moon identity lane from the selected-day rail', () => {
  const src = read('docs/assets/js/sphere/living-time-sphere-renderer-3d.js');
  assert.match(src, /MOON_IDENTITY_LANE_FACTOR = 0\.80/);
  assert.match(src, /const r = mat\.SIZES\.patternRing \* MOON_IDENTITY_LANE_FACTOR/);
  assert.match(src, /angleToXZ\(selectedAngle, mat\.SIZES\.patternRing\)/);
  assert.match(src, /cannot geometrically intersect the Moon bodies/);
});

test('B7.51/B7.55 mobile calendar keeps adjacent Moons available for a flowing screen aperture', () => {
  const src = read('docs/assets/js/sphere/living-time-sphere-renderer-3d.js');

  assert.match(
    src,
    /CAMERA_CALENDAR_HALF_WINDOW_DESKTOP = 2/
  );

  assert.match(
    src,
    /function _calendarDisclosureHalfWindow\(\)[\s\S]*return 1;/
  );

  assert.match(
    src,
    /const halfWindow = _calendarDisclosureHalfWindow\(\)/
  );

  assert.match(
    src,
    /_calendarDisclosureDirty = true/
  );
});

test('B7.51 defers non-critical planner/import/workspace code until first Sphere frame', () => {
  const renderer = read('docs/assets/js/sphere/living-time-sphere-renderer-3d.js');
  const sphere = read('docs/living-time-sphere.html');
  assert.match(renderer, /sof:sphere-first-frame/);
  assert.match(sphere, /B7\.(?:51|52) CORE-FIRST BOOT/);
  assert.match(sphere, /document\.addEventListener\("sof:sphere-first-frame"/);
  assert.match(sphere, /const phaseOne = \[/);
  assert.match(sphere, /const phaseTwo = \[/);
  for (const asset of [
    'life-atlas-planner-ui.js', 'living-command-window.js', 'life-atlas-importers.js',
    'life-atlas-ingestion.js', 'life-atlas-runtime.js', 'life-atlas-import-ui.js',
    'living-time-observatory-workspace.js'
  ]) assert.match(sphere, new RegExp(asset.replaceAll('.', '\\.') + '.*v='));
});

test('B7.51 service worker avoids local full-shell refetch and eager optional precache', () => {
  const sw = read('docs/service-worker.js');
  assert.match(sw, /developmentMandatoryUrls/);
  assert.match(sw, /requiredInstallUrls = development \? developmentMandatoryUrls : mandatoryUrls/);
  assert.match(sw, /Promise\.all\(requiredInstallUrls\.map/);
  assert.doesNotMatch(sw, /Promise\.allSettled\(optionalUrls\.map/);
  assert.match(sw, /optional assets are intentionally not prefetched during install/);
});

test('B7.51/B7.52 cache-busts the full Sphere while Moons remains ambient-only', () => {
  const sphere = read('docs/living-time-sphere.html');
  const moons = read('docs/moons.html');
  const sw = read('docs/service-worker.js');
  const version = read('docs/assets/js/moons-version.js');
  assert.match(sphere, /living-time-sphere-renderer-3d\.js\?v=20260819-b75(?:1|2)/);
  assert.doesNotMatch(moons, /living-time-sphere-renderer-3d\.js/);
  assert.match(moons, /B7\.52 AMBIENT FAST PATH/);
  assert.match(sw, /moons-version\.js\?v=20260819-b75(?:1|2)/);
  assert.match(version, /APP_VERSION = "2026\.(?:08\.19\.(?:51|52)|08\.20\.(?:53|54|55|56|57))"/);
});
