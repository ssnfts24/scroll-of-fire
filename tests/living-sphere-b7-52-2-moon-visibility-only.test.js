const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const renderer = fs.readFileSync('docs/assets/js/sphere/living-time-sphere-renderer-3d.js', 'utf8');
const html = fs.readFileSync('docs/living-time-sphere.html', 'utf8');

test('B7.52.2+/B7.53 keeps readable but refined Pattern Moon identity bodies', () => {
  assert.match(
    renderer,
    /MOON_IDENTITY_BODY_FACTOR\s*=\s*0\.078/
  );

  assert.match(
    renderer,
    /MOON_IDENTITY_BODY_MIN\s*=\s*0\.044/
  );

  assert.match(
    renderer,
    /Math\.max\(\s*MOON_IDENTITY_BODY_MIN,[\s\S]*MOON_IDENTITY_BODY_FACTOR/
  );

  assert.match(
    renderer,
    /new _THREE\.MeshStandardMaterial/
  );
});

test('B7.52.2+/B7.55 keeps all thirteen Moon identities present through labels', () => {
  assert.match(
    renderer,
    /const MOON_NUMBER_FIELD_ENABLED = false/
  );

  assert.match(
    renderer,
    /return new Set\([\s\S]*Array\.from\([\s\S]*length: 13/
  );
});

test('B7.52.2+ retains one instanced body field and one number field', () => {
  assert.match(renderer, /new _THREE\.InstancedMesh\(geometry, material, 13\)/);
  assert.match(renderer, /new _THREE\.Points\(geometry, material\)/);
});

test('B7.52.2+ keeps the repaired renderer cache-busted', () => {
  assert.match(html, /living-time-sphere-renderer-3d\.js\?v=20260819-b752(?:2|3)/);
});
