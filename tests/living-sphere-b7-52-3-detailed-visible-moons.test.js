const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const renderer = fs.readFileSync('docs/assets/js/sphere/living-time-sphere-renderer-3d.js', 'utf8');
const html = fs.readFileSync('docs/living-time-sphere.html', 'utf8');

test('B7.52.3/B7.53 keeps thirteen visible Moon bodies without adding per-Moon meshes', () => {
  assert.match(renderer, /MOON_IDENTITY_BODY_FACTOR\s*=\s*0\.078/);
  assert.match(renderer, /MOON_IDENTITY_BODY_MIN\s*=\s*0\.044/);
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

test('B7.52.3/B7.55 retains the recoverable atlas implementation but uses persistent Moon labels', () => {
  assert.match(
    renderer,
    /function _moonIdentityAtlasTexture\(\)/
  );

  assert.match(
    renderer,
    /function _buildMoonNumberField\(\)/
  );

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
});

test('B7.52.3 keeps selected/today day geometry separate from the Moon identity lane', () => {
  assert.match(renderer, /MOON_IDENTITY_LANE_FACTOR = 0\.80/);
  assert.match(renderer, /const r = mat\.SIZES\.patternRing \* MOON_IDENTITY_LANE_FACTOR/);
  assert.match(renderer, /angleToXZ\(selectedAngle, mat\.SIZES\.patternRing\)/);
});

test('B7.52.3 changes only the standalone Sphere renderer asset version', () => {
  assert.match(html, /living-time-sphere-renderer-3d\.js\?v=20260819-b7523/);
});
