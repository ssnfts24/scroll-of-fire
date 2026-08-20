const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const renderer = fs.readFileSync('docs/assets/js/sphere/living-time-sphere-renderer-3d.js', 'utf8');
const html = fs.readFileSync('docs/living-time-sphere.html', 'utf8');

test('B7.52.3 makes the thirteen Moon bodies brighter without adding per-Moon meshes', () => {
  assert.match(renderer, /MOON_IDENTITY_BODY_FACTOR\s*=\s*0\.105/);
  assert.match(renderer, /MOON_IDENTITY_BODY_MIN\s*=\s*0\.058/);
  assert.match(renderer, /new Float32Array\(vertexCount \* 3\)\.fill\(1\)/);
  assert.match(renderer, /new _THREE\.InstancedMesh\(geometry, material, 13\)/);
  assert.match(renderer, /color:\s*0xffffff/);
  assert.match(renderer, /transparent:\s*false/);
});

test('B7.52.3 gives every Moon a bounded halo plus unique signature arc', () => {
  assert.match(renderer, /function _buildMoonIdentityDetails\(/);
  assert.match(renderer, /function _syncMoonIdentityDetails\(/);
  assert.match(renderer, /new _THREE\.LineSegments\(geometry, material\)/);
  assert.match(renderer, /signatureStart/);
  assert.match(renderer, /signatureSpan/);
  assert.match(renderer, /moonIdentityDetails/);
});

test('B7.52.3 makes the 1..13 atlas substantially stronger and fixes Android tile addressing', () => {
  assert.match(renderer, /const tile = 128/);
  assert.match(renderer, /uPointSize:\s*\{\s*value:\s*_isMobileWidth\(\)\s*\?\s*44\s*:\s*50\s*\}/);
  assert.match(renderer, /vec2 localUv = vec2\(gl_PointCoord\.x, 1\.0 - gl_PointCoord\.y\)/);
  assert.match(renderer, /vec2 uv = \(localUv \+ vec2\(col, row\)\) \/ grid/);
  assert.doesNotMatch(renderer, /\(grid - 1\.0\) - row/);
});

test('B7.52.3 keeps selected/today day geometry separate from the Moon identity lane', () => {
  assert.match(renderer, /MOON_IDENTITY_LANE_FACTOR = 0\.80/);
  assert.match(renderer, /const r = mat\.SIZES\.patternRing \* MOON_IDENTITY_LANE_FACTOR/);
  assert.match(renderer, /angleToXZ\(selectedAngle, mat\.SIZES\.patternRing\)/);
});

test('B7.52.3 changes only the standalone Sphere renderer asset version', () => {
  assert.match(html, /living-time-sphere-renderer-3d\.js\?v=20260819-b7523/);
});
