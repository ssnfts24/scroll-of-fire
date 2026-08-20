const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('B7.52 lazy-builds environment and seasonal geometry only when data exists', () => {
  const src = read('docs/assets/js/sphere/living-time-sphere-renderer-3d.js');
  const env = src.slice(src.indexOf('function _applyEnvironmentState()'), src.indexOf('const _environmentController'));
  assert.ok(env.indexOf('const hasData') < env.indexOf('_buildEnvironmentLayerObjects()'));
  assert.match(env, /if \(!hasData\) \{[\s\S]*environmentGroup[\s\S]*return;/);
  const seasonStart = src.indexOf('function _updateLocationSeasonRing');
  const seasons = src.slice(seasonStart, src.indexOf('// B7.27', seasonStart));
  assert.ok(seasons.indexOf('const hasLocation') < seasons.indexOf('_buildLocationSeasonRing()'));
});

test('B7.52 progressive visual hydration keeps historical and connection builds off first paint', () => {
  const src = read('docs/assets/js/sphere/living-time-sphere-renderer-3d.js');
  assert.match(src, /function _scheduleDeferredVisualHydration\(/);
  assert.match(src, /_progressiveVisualsReady \|\| _viewMode === "years"/);
  assert.match(src, /_progressiveVisualsReady && !_connectionDiagnostics\.length/);
  assert.match(src, /if \(_cameraGestureActive\) \{[\s\S]*_scheduleDeferredVisualHydration/);
  assert.match(src, /_scheduleDeferredVisualHydration\(\);[\s\S]*_scheduleDeferredExtensionHydration\(\);/);
});

test('B7.52 caches repeated solar, Today-line and active-Moon geometry', () => {
  const src = read('docs/assets/js/sphere/living-time-sphere-renderer-3d.js');
  assert.match(src, /_lastSolarProgressGeometryKey/);
  assert.match(src, /_lastTodayLineGeometryKey/);
  assert.match(src, /_lastActiveMoonGeometryKey/);
  assert.match(src, /solarProgressKey/);
  assert.match(src, /todayLineKey/);
  assert.match(src, /activeMoonGeometryKey/);
});

test('B7.52/B7.53 phone renderer preserves gesture bounds while restoring settled clarity', () => {
  const src = read('docs/assets/js/sphere/living-time-sphere-renderer-3d.js');
  assert.match(src, /MOBILE_SETTLED_DPR_CAP = 1\.25/);
  assert.match(src, /MOBILE_GESTURE_DPR_CAP = 1\.00/);
  assert.match(src, /MOBILE_GESTURE_DPR_LOWPOWER = 0\.72/);
  assert.match(src, /const antialias = mobileFastPath \? !lowPowerRenderer : quality\.antialias !== false/);
  assert.match(src, /powerPreference = lowPowerRenderer \? "low-power" : "high-performance"/);
  assert.match(src, /const mobileCap = _isTouchOptimizedSurface\(\) \? MOBILE_SETTLED_DPR_CAP : Infinity/);
});

test('B7.52/B7.55 avoids a guaranteed measurement RAF and preloads dynamic Three.js', () => {
  const src = read('docs/assets/js/sphere/living-time-sphere-renderer-3d.js');
  const sphere = read('docs/living-time-sphere.html');

  assert.match(
    src,
    /let rect = container\.getBoundingClientRect\(\);[\s\S]*if \(!\(Number\(rect\.width\) > 0/
  );

  assert.match(
    sphere,
    /rel="modulepreload" href="assets\/vendor\/three\/three\.module\.min\.js" fetchpriority="high"/
  );

  assert.match(
    sphere,
    /rel="preload" href="assets\/js\/sphere\/living-time-sphere-renderer-3d\.js\?v=20260819-b752(?:1|2|3)?(?:&r=20260820-b757)?"/
  );
});

test('B7.52 label overlay is instrument-local and cannot spill into camera controls', () => {
  const sphere = read('docs/living-time-sphere.html');
  const css = read('docs/assets/css/living-time-sphere.css');
  const shell = sphere.indexOf('class="sphere-instrument-shell"');
  const labels = sphere.indexOf('id="sphere-moon-labels"');
  const corners = sphere.indexOf('class="sphere-instrument-corners"');
  const shellClose = sphere.indexOf('<!-- Camera controls', shell);
  assert.ok(shell >= 0 && labels > shell && labels < corners && corners < shellClose);
  assert.match(sphere, /B7\.52 INSTRUMENT-LOCAL LABEL OVERLAY/);
  assert.match(css, /\.sphere-instrument-shell > \.sphere-moon-labels/);
  assert.match(css, /contain: layout paint style/);
});

test('B7.52 standalone deferred tools yield around active camera input', () => {
  const sphere = read('docs/living-time-sphere.html');
  assert.match(sphere, /B7\.52 CORE-FIRST BOOT/);
  assert.match(sphere, /const phaseOne = \[/);
  assert.match(sphere, /const phaseTwo = \[/);
  assert.match(sphere, /const phaseThree = \[/);
  assert.match(sphere, /isInputPending/);
  assert.match(sphere, /waitForQuiet/);
  assert.match(sphere, /scheduler\?\.yield/);
});

test('B7.52 Moons page does not parse unused WebGL stack for its SVG ambient card', () => {
  const moons = read('docs/moons.html');
  assert.match(moons, /B7\.52 AMBIENT FAST PATH/);
  for (const forbidden of [
    'living-time-sphere-renderer-3d.js', 'living-time-sphere-camera.js',
    'living-time-sphere-animation.js', 'living-time-sphere-effects.js',
    'living-time-sphere-label-manager.js', 'living-time-sphere-temporal-strata.js',
    'life-atlas-record-sphere-extension.js'
  ]) assert.doesNotMatch(moons, new RegExp(forbidden.replaceAll('.', '\\.')));
  for (const required of [
    'living-time-sphere-model.js', 'living-time-sphere-layout.js',
    'living-time-sphere-renderer-svg.js', 'living-time-sphere-live-data.js',
    'living-time-sphere-mount.js', 'living-time-sphere-today.js'
  ]) assert.match(moons, new RegExp(required.replaceAll('.', '\\.')));
});

test('B7.52 coarse-pointer CSS removes expensive blur and defers below-fold panel paint', () => {
  const css = read('docs/assets/css/living-time-sphere.css');
  assert.match(css, /B7\.52 WHOLE-INSTRUMENT PERFORMANCE \+ CONTAINMENT/);
  assert.match(css, /@media \(pointer: coarse\), \(max-width: 720px\)/);
  assert.match(css, /backdrop-filter: none !important/);
  assert.match(css, /content-visibility: auto/);
  assert.match(css, /contain-intrinsic-size: auto 240px/);
});


test('B7.52 keeps environment, workbench and temporal tools off the first interactive paint', () => {
  const sphere = read('docs/living-time-sphere.html');
  const phaseThreeStart = sphere.indexOf('const phaseThree = [');
  const phaseThreeEnd = sphere.indexOf('];', phaseThreeStart);
  const phaseThree = sphere.slice(phaseThreeStart, phaseThreeEnd);
  for (const token of [
    'environment-state.js', 'open-meteo-adapter.js', 'location-command.js',
    'living-time-sphere-everyday.js', 'calendar-data-safety.js',
    'temporal-coordinate-engine.js', 'living-time-calendar-workbench.js'
  ]) assert.match(phaseThree, new RegExp(token.replaceAll('.', '\\.')));
  const fixedScripts = sphere.slice(phaseThreeEnd, sphere.indexOf('</head>'));
  assert.doesNotMatch(fixedScripts, /<script defer src="assets\/js\/environment\/environment-state\.js/);
  assert.doesNotMatch(fixedScripts, /<script defer src="assets\/js\/sphere\/living-time-calendar-workbench\.js/);
  assert.match(sphere, /SofLocationCommand\?\.mountAll/);
  assert.match(sphere, /LivingTimeCalendarWorkbench\?\.init/);
});

test('B7.52 UI avoids hidden alternate-view DOM churn and first-paint planner I-O', () => {
  const ui = read('docs/assets/js/sphere/living-time-sphere-ui.js');
  assert.match(ui, /if \(!model \|\| \(!tableMode && !textMode\)\) return/);
  assert.match(ui, /_pendingScheduleNavigatorModel/);
  assert.match(ui, /do not race an IndexedDB planner query against the first WebGL/);
  assert.match(ui, /requestIdleCallback\(hydrateScheduleNavigator/);
  assert.match(ui, /const startInitialRender = \(\) =>/);
  assert.match(ui, /if \(Number\(initialRect\.width\) >= 180/);
});

test('B7.52 local development does not request Google Analytics during Sphere startup', () => {
  const sphere = read('docs/living-time-sphere.html');
  assert.match(sphere, /127\\\.0\\\.0\\\.1\|localhost/);
  assert.doesNotMatch(sphere, /<script async src="https:\/\/www\.googletagmanager\.com/);
  assert.match(sphere, /document\.head\.appendChild\(script\)/);
});

test('B7.52 cache identity reaches CSS, renderer and service worker', () => {
  const sphere = read('docs/living-time-sphere.html');
  const moons = read('docs/moons.html');
  const sw = read('docs/service-worker.js');
  const version = read('docs/assets/js/moons-version.js');
  assert.match(sphere, /living-time-sphere\.css\?v=20260819-b752/);
  assert.match(moons, /living-time-sphere\.css\?v=20260819-b752/);
  assert.match(sphere, /living-time-sphere-renderer-3d\.js\?v=20260819-b752(?:1|2|3)?/);
  assert.match(sphere, /living-time-sphere-ui\.js\?v=20260819-b752/);
  assert.match(sw, /moons-version\.js\?v=20260819-b752/);
  assert.match(version, /APP_VERSION = "2026\.(?:08\.19\.52|08\.20\.(?:53|54|55|56|57))"/);
});
