const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const ext = read('docs/assets/js/sphere/life-atlas-record-sphere-extension.js');
const renderer = read('docs/assets/js/sphere/living-time-sphere-renderer-3d.js');
const labels = read('docs/assets/js/sphere/living-time-sphere-label-manager.js');
const capability = read('docs/assets/js/sphere/observatory-capability-manager.js');
const projection = read('docs/assets/js/life-atlas/life-atlas-calendar-projection.js');
const planner = read('docs/assets/js/life-atlas/life-atlas-planner.js');
const css = read('docs/assets/css/living-time-sphere.css');
const sphere = read('docs/living-time-sphere.html');
const moons = read('docs/moons.html');
const version = read('docs/assets/js/moons-version.js');

function functionBody(source, name, nextName) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} exists`);
  const end = nextName ? source.indexOf(`function ${nextName}`, start + 1) : source.length;
  assert.ok(end > start, `${name} body is bounded`);
  return source.slice(start, end);
}

test('B7.48 renders every occupied schedule day through one GPU symbol-atlas Points field', () => {
  const body = functionBody(ext, '_buildPlannerSummaryPoints', '_cameraFacingMoon');
  assert.match(body, /_buildSymbolAtlas\(THREE, symbols\)/);
  assert.match(body, /new THREE\.ShaderMaterial\(/);
  assert.match(body, /aSymbolIndex/);
  assert.match(body, /uAtlas/);
  assert.match(body, /gl_PointCoord/);
  assert.match(body, /living-plan-day-symbol-atlas/);
  assert.equal((body.match(/new THREE\.Points\(/g) || []).length, 1);
  assert.doesNotMatch(body, /bySymbol\s*=\s*new Map/);
  assert.doesNotMatch(body, /new THREE\.PointsMaterial/);
});

test('B7.48 schedule reveal consumes renderer calendarDisclosure and changes uniforms instead of draw ranges', () => {
  const body = functionBody(ext, '_syncPlannerSummaryReveal', '_plannerEntryVisible');
  assert.match(body, /calendarDisclosure\?\.centerMoon/);
  assert.match(body, /uCenterMoon\.value/);
  assert.match(body, /uHalfWindow\.value/);
  assert.match(body, /uRevealAll\.value/);
  assert.doesNotMatch(body, /setDrawRange/);
  assert.doesNotMatch(body, /moonRanges/);
});

test('B7.48 keeps floating cards out of the active gesture path while dates and GPU symbols remain', () => {
  assert.match(renderer, /_buildSemanticTargets\(\{ calendarDisclosure, interactionLite \}\)/);
  assert.match(renderer, /target\?\.kind === "pattern-day-number"[\s\S]*target\?\.kind === "intercalary-day-number"/);
  assert.doesNotMatch(functionBody(renderer, '_updateMoonLabels', 'buildScene'), /target\?\.kind === "living-plan-summary"/);
  assert.match(labels, /const cardCandidates = interactionLite \? \[\] : nonRailSemanticCandidates/);
  assert.match(ext, /if \(context\?\.interactionLite\) return \[\]/);
});

test('B7.48 calendar semantic targets are aperture-built instead of constructing all 364 on each camera projection', () => {
  const body = functionBody(renderer, '_buildSemanticTargets', '_labelProjectionKey');
  assert.match(body, /const dayAperture/);
  assert.match(body, /new Set\(calendarDisclosure\.moons\.map\(Number\)\)/);
  assert.match(body, /if \(dayAperture && !dayAperture\.has\(Number\(moon\)\)/);
  assert.match(renderer, /let _calendarDisclosureDirty = true/);
  assert.match(renderer, /if \(!_calendarDisclosureDirty && _calendarDisclosureCache\) return _calendarDisclosureCache/);
  assert.match(renderer, /calendarDisclosure:\s*extra\?\.calendarDisclosure \|\| _cameraCalendarDisclosure\(\)/);
});

test('B7.48/B7.52 active touch gestures use bounded fill-rate and suspend decorative layers', () => {
  assert.match(renderer, /MOBILE_GESTURE_DPR_CAP = 1\.00/);
  assert.match(renderer, /MOBILE_GESTURE_DPR_LOWPOWER = 0\.72/);
  assert.match(renderer, /MOBILE_INTERACTION_FPS = 30/);
  assert.match(renderer, /MOBILE_INTERACTION_FPS_LOWPOWER = 24/);
  assert.match(renderer, /_activeTier === "lowpower" \? MOBILE_GESTURE_DPR_LOWPOWER : MOBILE_GESTURE_DPR_CAP/);
  assert.match(renderer, /_applyGestureVisualBudget\(_cameraGestureActive\)/);
  for (const token of ['_objects.starField','_objects.hazeShell','_objects.planetaryGroup','_objects.environmentGroup','_objects.connectionGroup','_objects.recurrenceGroup','_objects.spiralGroup']) {
    assert.ok(renderer.includes(token), token);
  }
  assert.match(css, /B7\.48 HIGH-PERFORMANCE SYMBOL FIELD START/);
  assert.match(css, /is-camera-gesture-active[\s\S]*box-shadow: none !important/);
});

test('B7.48 Auto quality caps coarse/mobile surfaces at Balanced while explicit High remains possible', () => {
  const context = {
    console,
    navigator: { deviceMemory: 8, hardwareConcurrency: 8, connection: {} },
    window: { innerWidth: 412 },
    matchMedia: () => ({ matches: true }),
    devicePixelRatio: 3,
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(capability, context);
  const manager = context.ObservatoryCapabilityManager;
  assert.equal(manager.selectTier({ webglAvailable: true }), 'balanced');
  assert.equal(manager.selectTier({ webglAvailable: true, override: 'high' }), 'high');
});

test('B7.48 Calendar projection indexes records once rather than filtering the whole plan set per cell', () => {
  assert.match(projection, /let recordsByDay = new Map\(\)/);
  assert.match(projection, /let recordsByMoon = new Map\(\)/);
  assert.match(projection, /function _rebuildRecordIndexes\(\)/);
  assert.match(functionBody(projection, 'recordsForDay', 'recordsForMoon'), /recordsByDay\.get/);
  assert.doesNotMatch(functionBody(projection, 'recordsForDay', 'recordsForMoon'), /records\.filter/);
  assert.match(projection, /_rebuildRecordIndexes\(\);[\s\S]*decorate\(\)/);
});

test('B7.48 expands everyday planner categories and symbol choices without adding schedule draw calls', () => {
  for (const category of ['home','family','pets','food','shopping','vehicle','construction','coding','writing','research','creative','cleaning','appointment','community','camping','fieldwork']) {
    assert.match(planner, new RegExp(`${category}:\\s*\\{`));
  }
  for (const token of ['value="🌳"','value="🐾"','value="🧹"','value="📷"','value="🎨"','value="🎵"','value="📖"','value="🎉"']) {
    assert.ok(sphere.includes(token), token);
  }
});

test('B7.48/B7.52 removes the duplicate pseudo-glyph and keeps current surface cache identity', () => {
  assert.doesNotMatch(css, /B7\.47\.1 DATE-BOUND SCHEDULE SYMBOLS START/);
  assert.doesNotMatch(css, /content:\s*attr\(data-plan-symbol\)/);
  assert.match(css, /data-plan-symbol\]::after[\s\S]*content: none !important/);
  assert.match(sphere, /living-time-sphere\.css\?v=20260819-b752/);
  assert.match(sphere, /living-time-sphere-renderer-3d\.js\?v=20260819-b7523/);
  assert.match(sphere, /life-atlas-record-sphere-extension\.js\?v=20260819-b750/);
  assert.match(moons, /living-time-sphere\.css\?v=20260819-b752/);
  assert.doesNotMatch(moons, /living-time-sphere-renderer-3d\.js/);
  assert.doesNotMatch(moons, /life-atlas-record-sphere-extension\.js/);
  assert.match(version, /APP_VERSION = "2026\.(?:08\.19\.52|08\.20\.(?:53|54|55|56|57|58))"/);
});
