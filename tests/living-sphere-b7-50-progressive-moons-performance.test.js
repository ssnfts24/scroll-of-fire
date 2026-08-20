const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('B7.50 renders the 13 calendar Moons as one instanced GPU marker field', () => {
  const src = read('docs/assets/js/sphere/living-time-sphere-renderer-3d.js');
  assert.match(src, /function _buildMoonIdentityMarkers\(/);
  assert.match(src, /new _THREE\.InstancedMesh\(geometry, material, 13\)/);
  assert.match(src, /moonIdentityMarkers/);
  assert.match(src, /_syncMoonIdentityMarkers\(\)/);
  assert.match(src, /MOON_IDENTITY_COLORS/);
});

test('B7.50 Moon labels and physical bodies share the same canonical anchors', () => {
  const src = read('docs/assets/js/sphere/living-time-sphere-renderer-3d.js');
  assert.match(src, /dummy\.position\.set\(anchor\.worldX, anchor\.worldY(?: \+ 0\.010)?, anchor\.worldZ\)/);
  assert.match(src, /_buildMoonAnchors\([\s\S]*?_syncMoonIdentityMarkers\(\);/);
  assert.match(src, /moonIdentityMarkers\.visible = !!vl\.pattern/);
});

test('B7.50 first interactive frame no longer awaits extension hydration', () => {
  const src = read('docs/assets/js/sphere/living-time-sphere-renderer-3d.js');
  const initStart = src.indexOf('async function init(');
  const firstFrame = src.indexOf('_markStage("firstFrame", "requested")', initStart);
  const directMount = src.indexOf('await globalThis.LivingTimeSphereExtensionHost.mountAll', initStart);
  assert.ok(firstFrame > initStart);
  assert.equal(directMount, -1);
  assert.match(src, /function _scheduleDeferredExtensionHydration\(/);
  assert.match(src, /requestIdleCallback/);
  assert.match(src, /lifecycle: "deferred-mount"/);
});

test('B7.50 caps settled phone DPR and trims decorative mobile geometry', () => {
  const src = read('docs/assets/js/sphere/living-time-sphere-renderer-3d.js');
  assert.match(src, /mobileSettledDprCap = (?:_isMobileWidth\(\) \? 1\.25 : Infinity|mobileFastPath \? MOBILE_SETTLED_DPR_CAP : Infinity)/);
  assert.match(src, /_isMobileWidth\(\) \? 128 : 224/);
  assert.match(src, /Math\.min\(Number\(_quality\?\.starCount \?\? 150\), 56\)/);
});

test('B7.50/B7.52 standalone Sphere stays cache-busted while Moons uses its SVG ambient fast path', () => {
  const sphere = read('docs/living-time-sphere.html');
  const moons = read('docs/moons.html');
  const sw = read('docs/service-worker.js');
  const version = read('docs/assets/js/moons-version.js');
  assert.match(sphere, /living-time-sphere-renderer-3d\.js\?v=20260819-b75(?:0|1|2)/);
  assert.doesNotMatch(moons, /living-time-sphere-renderer-3d\.js/);
  assert.match(moons, /B7\.52 AMBIENT FAST PATH/);
  assert.match(sw, /moons-version\.js\?v=20260819-b75(?:0|1|2)/);
  assert.match(version, /APP_VERSION = "2026\.(?:08\.19\.(?:50|51|52)|08\.20\.(?:53|54|55|56|57))"/);
});
