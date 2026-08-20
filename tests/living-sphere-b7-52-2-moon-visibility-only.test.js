const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const renderer = fs.readFileSync('docs/assets/js/sphere/living-time-sphere-renderer-3d.js', 'utf8');
const html = fs.readFileSync('docs/living-time-sphere.html', 'utf8');

test('B7.52.2+ keeps enlarged Pattern Moon identity bodies', () => {
  assert.match(renderer, /MOON_IDENTITY_BODY_FACTOR\s*=\s*0\.(?:090|105)/);
  assert.match(renderer, /MOON_IDENTITY_BODY_MIN\s*=\s*0\.(?:050|058)/);
  assert.match(renderer, /Math\.max\(\s*MOON_IDENTITY_BODY_MIN,[\s\S]*MOON_IDENTITY_BODY_FACTOR/);
});

test('B7.52.2+ keeps all thirteen Moon numbers present', () => {
  assert.match(renderer, /visible\.setX\(i,\s*1\)/);
  assert.match(renderer, /uPointSize:\s*\{\s*value:\s*_isMobileWidth\(\)\s*\?\s*(?:33|44)\s*:\s*(?:38|50)\s*\}/);
});

test('B7.52.2+ retains one instanced body field and one number field', () => {
  assert.match(renderer, /new _THREE\.InstancedMesh\(geometry, material, 13\)/);
  assert.match(renderer, /new _THREE\.Points\(geometry, material\)/);
});

test('B7.52.2+ keeps the repaired renderer cache-busted', () => {
  assert.match(html, /living-time-sphere-renderer-3d\.js\?v=20260819-b752(?:2|3)/);
});
