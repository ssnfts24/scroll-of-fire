const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const renderer = fs.readFileSync('docs/assets/js/sphere/living-time-sphere-renderer-3d.js', 'utf8');
const html = fs.readFileSync('docs/living-time-sphere.html', 'utf8');

test('B7.52.1 keeps touch optimization helper at renderer module scope', () => {
  const defs = renderer.match(/function _isTouchOptimizedSurface\s*\(/g) || [];
  assert.equal(defs.length, 1);
  const wireStart = renderer.indexOf('function _wirePointerEvents(');
  const helperStart = renderer.indexOf('function _isTouchOptimizedSurface(');
  assert.ok(helperStart >= 0 && helperStart < wireStart, 'helper must be module-scoped before pointer wiring');
});

test('B7.52.1 initialization may call touch helper before pointer events are wired', () => {
  const initStart = renderer.indexOf('async function init(');
  const wireStart = renderer.indexOf('function _wirePointerEvents(');
  const initChunk = renderer.slice(initStart, wireStart);
  assert.match(initChunk, /const mobileFastPath = _isTouchOptimizedSurface\(\)/);
});

test('B7.52.1 cache-busts the repaired renderer on the standalone sphere page', () => {
  assert.match(html, /living-time-sphere-renderer-3d\.js\?v=20260819-b752(?:1|2|3)/);
});
