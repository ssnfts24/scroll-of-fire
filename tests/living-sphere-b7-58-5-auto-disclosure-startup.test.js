const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const renderer = fs.readFileSync(
  "docs/assets/js/sphere/living-time-sphere-renderer-3d.js",
  "utf8"
);

const extension = fs.readFileSync(
  "docs/assets/js/sphere/life-atlas-record-sphere-extension.js",
  "utf8"
);

const ui = fs.readFileSync(
  "docs/assets/js/sphere/living-time-sphere-ui.js",
  "utf8"
);

const geometry = fs.readFileSync(
  "docs/assets/js/sphere/living-time-sphere-calendar-geometry.js",
  "utf8"
);

const sphere = fs.readFileSync(
  "docs/living-time-sphere.html",
  "utf8"
);

test("B7.58.5 keeps Auto preference separate from semantic camera LOD", () => {
  assert.doesNotMatch(renderer, /_dayLabelMode = next\.dayLabelMode/);
  assert.match(renderer, /function _effectiveDayLabelMode\(\)/);
  assert.match(
    renderer,
    /if \(_lastSemanticDistance == null\) \{[\s\S]*?return "key";/
  );
  assert.match(
    renderer,
    /_dayLabelMode = _resolveDayLabelPreference\(dayLabelMode\);/
  );
});

test("B7.58.5 extension context exposes raw and effective day modes", () => {
  assert.match(
    renderer,
    /function _extensionContext\(extra = \{\}\)[\s\S]*?dayLabelMode: _dayLabelMode \|\| "key",[\s\S]*?effectiveDayLabelMode: _effectiveDayLabelMode\(\)/
  );
  assert.match(
    extension,
    /const revealAll = String\(context\?\.dayLabelMode \|\| "key"\) === "all"/
  );
});

test("B7.58.5 3D receives raw preference while SVG retains effective presentation", () => {
  assert.match(
    ui,
    /renderer\.init\(\{[\s\S]*?dayLabelMode: _state\.dayLabelMode \|\| "key",[\s\S]*?semanticZoomState/
  );
  assert.match(
    ui,
    /renderer\.refresh\([\s\S]*?_state\.moonLabelDistance,[\s\S]*?_state\.dayLabelMode \|\| "key",[\s\S]*?connectionRegistry/
  );
  assert.match(
    ui,
    /LivingTimeSphereRendererSvg\.renderInto\([\s\S]*?dayLabelMode: effectiveDayLabelMode/
  );
});

test("B7.58.5 quick disclosure control has clear action semantics", () => {
  assert.match(ui, /function _syncDayDisclosureButton\(\)/);
  assert.match(
    ui,
    /\? "Return to Auto"[\s\S]*?: "Reveal all days"/
  );
  assert.match(
    ui,
    /_state\.dayLabelMode =[\s\S]*?revealAll[\s\S]*?\? "key"[\s\S]*?: "all"/
  );
  assert.match(ui, /event\.stopImmediatePropagation\(\)/);
  assert.match(
    sphere,
    /<option value="key" selected>Auto · camera-aware<\/option>/
  );
});

test("B7.58.5 preserves B7.58.4 root rail geometry", () => {
  assert.match(
    geometry,
    /radialFactor: 1\.298 \+ \(address\.week - 1\) \* 0\.030/
  );
  assert.match(renderer, /calendarMatrixWeek1: 1\.298/);
  assert.match(renderer, /calendarMatrixWeekStep: 0\.030/);
});

test("B7.58.5 preserves one batched schedule field and explicit Reveal All", () => {
  assert.match(extension, /living-plan-day-points/);
  assert.match(
    extension,
    /B7\.58\.2 schedule symbol scale[\s\S]*?\* 0\.90/
  );
  assert.match(
    extension,
    /uniforms\.uRevealAll\.value = revealAll \? 1 : 0/
  );
  assert.doesNotMatch(
    extension,
    /setDrawRange\(/
  );
});

test("B7.58.5 cache-busts changed 3D/UI authorities", () => {
  assert.match(
    sphere,
    /living-time-sphere-renderer-3d\.js\?[^"' ]+&a=20260820-b7585v3-auto/
  );
  assert.match(
    sphere,
    /living-time-sphere-ui\.js\?[^"' ]+&a=20260820-b7585v3-auto/
  );
});
