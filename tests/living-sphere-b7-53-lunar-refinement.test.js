const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const renderer = fs.readFileSync('docs/assets/js/sphere/living-time-sphere-renderer-3d.js', 'utf8');
const css = fs.readFileSync('docs/assets/css/living-time-sphere.css', 'utf8');
const sphere = fs.readFileSync('docs/living-time-sphere.html', 'utf8');
const version = fs.readFileSync('docs/assets/js/moons-version.js', 'utf8');

test('B7.53 makes Pattern Moons smaller without returning to per-Moon meshes', () => {
  assert.match(renderer, /MOON_IDENTITY_BODY_FACTOR = 0\.078/);
  assert.match(renderer, /MOON_IDENTITY_BODY_MIN = 0\.044/);
  assert.match(renderer, /MOON_IDENTITY_HALO_FACTOR = 1\.14/);
  assert.match(renderer, /new _THREE\.InstancedMesh\(geometry, material, 13\)/);
  assert.match(renderer, /moon === selectedMoon \? 1\.12 : moon === todayMoon \? 1\.06 : 1/);
});

test('B7.53 uses one shared lunar surface with rough lit material', () => {
  assert.match(renderer, /function _moonIdentitySurfaceTexture\(\)/);
  assert.match(renderer, /Broad maria \/ mineral fields/);
  assert.match(renderer, /Crater bowls/);
  assert.match(renderer, /new _THREE\.MeshStandardMaterial/);
  assert.match(renderer, /map: lunarSurface/);
  assert.match(renderer, /bumpMap: lunarSurface/);
  assert.match(renderer, /roughness: 0\.94/);
  assert.match(renderer, /SphereGeometry\(radius, _isMobileWidth\(\) \? 20 : 24, _isMobileWidth\(\) \? 14 : 18\)/);
});

test('B7.53 restores settled phone clarity but keeps the motion fast path', () => {
  assert.match(renderer, /MOBILE_SETTLED_DPR_CAP = 1\.25/);
  assert.match(renderer, /MOBILE_GESTURE_DPR_CAP = 1\.00/);
  assert.match(renderer, /MOBILE_GESTURE_DPR_LOWPOWER = 0\.72/);
  assert.match(renderer, /mobileFastPath \? !lowPowerRenderer/);
});

test('B7.53/B7.55 keeps lunar labels compact while restoring persistent Moon identity', () => {
  assert.match(renderer, /return new Set\([\s\S]*Array\.from\([\s\S]*length: 13/);
  assert.match(css, /B7\.53 LUNAR REFINEMENT START/);
});

test('B7.53 has a fresh cache/app identity', () => {
  assert.match(sphere, /living-time-sphere-renderer-3d\.js\?v=20260819-b7523&r=20260820-b75[3-8]/);
  assert.match(sphere, /living-time-sphere\.css\?v=20260819-b752&r=20260820-b75[3-8]/);
  assert.match(version, /APP_VERSION = "2026\.08\.20\.(?:53|54|55|56|57|58)"/);
});
