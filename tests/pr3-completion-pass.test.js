"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

function loadContext() {
  const ctx = {
    Intl,
    Date,
    URL,
    console,
    location: { href: "https://codexofreality.org/living-time-sphere.html", hostname: "codexofreality.org", origin: "https://codexofreality.org", pathname: "/living-time-sphere.html" },
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  const scripts = [
    "docs/assets/js/calendar/pattern-calendar-version.js",
    "docs/assets/js/calendar/pattern-calendar-data.js",
    "docs/assets/js/calendar/pattern-calendar-format.js",
    "docs/assets/js/calendar/pattern-calendar-boundary.js",
    "docs/assets/js/calendar/pattern-calendar.js",
    "docs/assets/js/astronomy/astronomy-version.js",
    "docs/assets/js/astronomy/astronomy-sources.js",
    "docs/assets/js/astronomy/timezone-tools.js",
    "docs/assets/js/astronomy/equinox-reference-data.js",
    "docs/assets/js/astronomy/lunar-at-equinox.js",
    "docs/assets/js/astronomy/equinox-engine.js",
    "docs/assets/js/equinox/equinox-passage-format.js",
    "docs/assets/js/equinox/equinox-passage-engine.js",
    "docs/assets/js/equinox/equinox-passage-data.js",
    "docs/assets/js/alignment/alignment-version.js",
    "docs/assets/js/alignment/alignment-ledger-engine.js",
    "docs/assets/js/alignment/alignment-ledger-data.js",
    "docs/assets/js/alignment/alignment-comparison.js",
    "docs/assets/js/alignment/alignment-recurrence.js",
    "docs/assets/js/alignment/alignment-offsets.js",
    "docs/assets/js/alignment/alignment-signature.js",
    "docs/assets/js/alignment/alignment-export.js",
    "docs/assets/js/alignment/alignment-url-state.js",
    "docs/assets/js/sphere/living-time-sphere-version.js",
    "docs/assets/js/sphere/living-time-sphere-camera.js",
    "docs/assets/js/sphere/living-time-sphere-model.js",
    "docs/assets/js/sphere/living-time-sphere-connections.js",
    "docs/assets/js/sphere/living-time-sphere-url-state.js",
  ];
  for (const rel of scripts) vm.runInNewContext(read(rel), ctx);
  return ctx;
}

function dayToDateIso(ctx, year, dayOfYear) {
  const epoch = ctx.PatternCalendar.epochForYear(year);
  const d = new Date(epoch.getTime() + (dayOfYear - 1) * 86400000);
  return d.toISOString().slice(0, 10);
}

test("calendar matrix: key 13-moon checkpoints resolve correctly", () => {
  const ctx = loadContext();
  const points = [
    { name: "Moon 1 Day 1", day: 1, moon: 1, moonDay: 1 },
    { name: "Moon 1 Day 28", day: 28, moon: 1, moonDay: 28 },
    { name: "Moon 2 Day 1", day: 29, moon: 2, moonDay: 1 },
    { name: "Moon 13 Day 28", day: 364, moon: 13, moonDay: 28 },
  ];
  for (const p of points) {
    const iso = dayToDateIso(ctx, 2026, p.day);
    const result = ctx.PatternCalendar.fromCivilDate({ date: `${iso}T12:00:00Z`, timeZone: "UTC", boundaryMode: "midnight" });
    assert.equal(result.moon, p.moon, `${p.name}: moon`);
    assert.equal(result.day, p.moonDay, `${p.name}: day`);
    assert.equal(result.dayOfPatternYear, p.day, `${p.name}: dayOfPatternYear`);
  }
});

test("calendar matrix: day 364, Day Out of Time, and rollover are distinct", () => {
  const ctx = loadContext();
  const day364 = ctx.PatternCalendar.fromCivilDate({ date: "2027-04-15T12:00:00Z", timeZone: "UTC", boundaryMode: "midnight" });
  const doot = ctx.PatternCalendar.fromCivilDate({ date: "2027-04-16T12:00:00Z", timeZone: "UTC", boundaryMode: "midnight" });
  const rollover = ctx.PatternCalendar.fromCivilDate({ date: "2027-04-17T12:00:00Z", timeZone: "UTC", boundaryMode: "midnight" });
  assert.equal(day364.dayOfPatternYear, 364);
  assert.equal(day364.isDayOutOfTime, false);
  assert.equal(doot.isDayOutOfTime, true);
  assert.equal(doot.moon, null);
  assert.equal(rollover.patternYear, day364.patternYear + 1);
  assert.equal(rollover.moon, 1);
  assert.equal(rollover.day, 1);
});

test("calendar matrix: leap window includes Deep Time Day handling", () => {
  const ctx = loadContext();
  const deep = ctx.PatternCalendar.fromCivilDate({ date: "2028-04-16T12:00:00Z", timeZone: "UTC", boundaryMode: "midnight" });
  assert.equal(deep.isDeepTimeDay, true);
  assert.equal(deep.moon, null);
  assert.equal(deep.day, null);
});

test("boundary matrix: sunset/manual/midnight cutovers resolve as expected", () => {
  const ctx = loadContext();
  const before = ctx.PatternCalendar.fromCivilDate({ date: "2026-07-23T00:59:00Z", timeZone: "America/Los_Angeles", boundaryMode: "sunset", sunsetTime: "18:00" });
  const at = ctx.PatternCalendar.fromCivilDate({ date: "2026-07-23T01:00:00Z", timeZone: "America/Los_Angeles", boundaryMode: "manual", sunsetTime: "18:00" });
  const after = ctx.PatternCalendar.fromCivilDate({ date: "2026-07-23T01:01:00Z", timeZone: "America/Los_Angeles", boundaryMode: "manual", sunsetTime: "18:00" });
  const preMidnight = ctx.PatternCalendar.fromCivilDate({ date: "2026-07-22T23:59:00Z", timeZone: "UTC", boundaryMode: "midnight" });
  const atMidnight = ctx.PatternCalendar.fromCivilDate({ date: "2026-07-23T00:00:00Z", timeZone: "UTC", boundaryMode: "midnight" });
  assert.equal(before.afterBoundary, false);
  assert.equal(at.afterBoundary, true);
  assert.equal(after.afterBoundary, true);
  assert.equal(at.dayOfPatternYear, before.dayOfPatternYear + 1);
  assert.equal(atMidnight.dayOfPatternYear, preMidnight.dayOfPatternYear + 1);
});

test("boundary matrix: DST-sensitive date and timezone differences remain stable", () => {
  const ctx = loadContext();
  const la = ctx.PatternCalendar.fromCivilDate({ date: "2026-07-23T00:30:00Z", timeZone: "America/Los_Angeles", boundaryMode: "manual", sunsetTime: "18:00" });
  const ny = ctx.PatternCalendar.fromCivilDate({ date: "2026-07-23T00:30:00Z", timeZone: "America/New_York", boundaryMode: "manual", sunsetTime: "18:00" });
  const dst = ctx.PatternCalendar.fromCivilDate({ date: "2026-03-08T18:30:00Z", timeZone: "America/Los_Angeles", boundaryMode: "sunset", sunsetTime: "18:00" });
  assert.ok(Number.isInteger(la.patternYear) && Number.isInteger(la.dayOfPatternYear || 0));
  assert.ok(Number.isInteger(ny.patternYear) && Number.isInteger(ny.dayOfPatternYear || 0));
  assert.notEqual(la.effectiveDate, ny.effectiveDate);
  assert.equal(typeof dst.afterBoundary, "boolean");
});

test("geometry matrix: canonical day-angle continuity across day 27→28→29", () => {
  const ctx = loadContext();
  const a27 = ctx.LivingTimeSphereModel.patternAngleForDayOfYear(27);
  const a28 = ctx.LivingTimeSphereModel.patternAngleForDayOfYear(28);
  const a29 = ctx.LivingTimeSphereModel.patternAngleForDayOfYear(29);
  const step = Number((360 / 364).toFixed(6));
  assert.equal(Number((a28 - a27).toFixed(6)), step);
  assert.equal(Number((a29 - a28).toFixed(6)), step);
});

test("geometry matrix: moon sectors and day subdivisions map to expected size", () => {
  const ctx = loadContext();
  const model = ctx.LivingTimeSphereModel.buildYearModel({ year: 2026 });
  const moonStep = 360 / 13;
  const dayStep = 360 / 364;
  assert.equal(Number((model.moonSectors[1].startAngle - model.moonSectors[0].startAngle).toFixed(6)), Number(moonStep.toFixed(6)));
  const m2d1 = ctx.LivingTimeSphereModel.dayAngleWithinMoon(1, 0);
  const doy29 = ctx.LivingTimeSphereModel.patternAngleForDayOfYear(29);
  assert.equal(m2d1, doy29);
  assert.equal(Number((ctx.LivingTimeSphereModel.patternAngleForDayOfYear(2) - ctx.LivingTimeSphereModel.patternAngleForDayOfYear(1)).toFixed(6)), Number(dayStep.toFixed(6)));
});

test("geometry matrix: Year Gate, seasonal, and lunar coordinates remain distinct", () => {
  const ctx = loadContext();
  const model = ctx.LivingTimeSphereModel.buildYearModel({ year: 2026 });
  assert.equal(model.passageEndAngle, 0);
  assert.notEqual(model.patternAngle, model.lunarAngle);
  assert.notEqual(model.patternAngle, model.solarSeasonAngle);
  assert.ok(model.solarGeometry?.source?.includes("seasonal-anchor"));
});

test("labels matrix: all 13 moon labels exist in DOM and label manager supports full set", () => {
  const html = read("docs/living-time-sphere.html");
  for (let moon = 1; moon <= 13; moon += 1) {
    assert.ok(html.includes(`data-moon="${moon}"`), `moon label ${moon} exists`);
  }
  const context = { globalThis: null, window: {}, console };
  context.globalThis = context;
  vm.runInNewContext(read("docs/assets/js/sphere/living-time-sphere-label-manager.js"), context);
  const set = context.LivingTimeSphereLabelManager._internals.buildLabelSet({
    labelMode: "all", selectedMoon: 7, todayMoon: 7, equinoxMoon: 13, mobile: false, showAllMobileLabels: true,
  });
  assert.equal(set.size, 13);
});

test("camera matrix: reset/top/tilted/edge controls map to distinct camera presets", () => {
  const ctx = loadContext();
  const html = read("docs/living-time-sphere.html");
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  assert.ok(html.includes("sphere-cam-reset"));
  assert.ok(html.includes("sphere-cam-pattern"));
  assert.ok(html.includes("sphere-cam-passage"));
  assert.ok(html.includes("sphere-cam-years"));
  assert.ok(ui.includes("case \"pattern\": globalThis.LivingTimeSphereCamera?.setMode?.(\"pattern\""));
  assert.ok(ui.includes("case \"passage\": globalThis.LivingTimeSphereCamera?.setMode?.(\"passage\""));
  assert.ok(ui.includes("case \"years\":   globalThis.LivingTimeSphereCamera?.setMode?.(\"years\""));
  assert.equal(ui.includes("case \"pattern\": globalThis.LivingTimeSphereRenderer3d?.setMode"), false, "camera presets must not mutate semantic view mode");
  const p = ctx.LivingTimeSphereCamera.MODE_POSITIONS.pattern;
  const pa = ctx.LivingTimeSphereCamera.MODE_POSITIONS.passage;
  const y = ctx.LivingTimeSphereCamera.MODE_POSITIONS.years;
  assert.ok(p.distance !== pa.distance || p.phi !== pa.phi || p.theta !== pa.theta);
  assert.ok(y.distance !== pa.distance || y.phi !== pa.phi || y.theta !== pa.theta);
});

test("gesture matrix: one/two-finger transitions, pinch+twist+pan logic is wired", () => {
  const code = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
  assert.ok(code.includes("pointerCache.size === 2"), "two-finger branch");
  assert.ok(code.includes("onPinchStart"));
  assert.ok(code.includes("onPinchMove"));
  assert.ok(code.includes("twistDelta"));
  assert.ok(code.includes("onPanMove?.("));
  assert.ok(code.includes("if (pointerCache.size === 1)"), "2→1 transition branch");
  assert.ok(code.includes("touchAction = \"pan-y\""), "page scroll preserved outside active interaction");
});

test("spiral + connection controls: UI toggles are wired through state to renderer layers", () => {
  const html = read("docs/living-time-sphere.html");
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  const renderer = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
  assert.ok(html.includes("sphere-layer-spiral"));
  assert.ok(html.includes("sphere-layer-connections"));
  assert.ok(ui.includes("_requestLayerStateUpdate(container, layer, next)"));
  assert.ok(ui.includes("requestAnimationFrame(_flushLayerStateUpdates)"));
  assert.ok(renderer.includes("_objects.spiralGroup.visible"));
  assert.ok(renderer.includes("_objects.connectionGroup.visible"));
  assert.ok(renderer.includes("_disposeGroupChildren(_objects.connectionGroup)"), "connection rebuild disposes and clears duplicates");
});

test("field + astronomy + degree semantics: explanatory provenance is present", () => {
  const html = read("docs/living-time-sphere.html");
  const model = read("docs/assets/js/sphere/living-time-sphere-model.js");
  assert.ok(html.includes("FIXED PATTERN CENTRE"));
  assert.ok(html.includes("MOVING ASTRONOMICAL LAYERS"));
  assert.ok(html.includes("All coordinates are measured in degrees"));
  assert.ok(html.includes("patternAngle"));
  assert.ok(html.includes("lunarAngle"));
  assert.ok(html.includes("solarSeasonAngle"));
  assert.ok(model.includes("PatternCalendar.fromCivilDate"));
  assert.ok(model.includes("seasonal-anchor interpolation"));
});

test("URL/state matrix: today URL handoff parses, invalid params are rejected, day marker is supported", () => {
  const ctx = loadContext();
  const parsedToday = ctx.LivingTimeSphereUrlState.parseSphereUrl("https://codexofreality.org/living-time-sphere.html?view=today&source=home");
  const parsedInvalid = ctx.LivingTimeSphereUrlState.parseSphereUrl("https://codexofreality.org/living-time-sphere.html?view=nope&year=1492");
  const parsedMarker = ctx.LivingTimeSphereUrlState.parseSphereUrl("https://codexofreality.org/living-time-sphere.html?marker=day-364");
  assert.equal(parsedToday.viewMode, "today");
  assert.equal(parsedInvalid.viewMode, null);
  assert.equal(parsedInvalid.year, null);
  assert.equal(parsedMarker.marker, "day-364");
});

test("resize/orientation + broken-resource audit: no duplicate-canvas path and no img directly under camera controls", () => {
  const renderer = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
  const html = read("docs/living-time-sphere.html");
  const css = read("docs/assets/css/living-time-sphere.css");
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  assert.ok(renderer.includes("if (_initializing || _initialized)"));
  assert.ok(renderer.includes("if (_canvas && _canvas.parentNode) _canvas.parentNode.removeChild(_canvas)"));
  assert.ok(renderer.includes("new ResizeObserver"));
  const start = html.indexOf('class="sphere-camera-controls"');
  const next = html.indexOf('id="sphere-data-table-section"', start);
  const section = start >= 0 && next > start ? html.slice(start, next) : "";
  assert.ok(!section.includes("<img"), "camera-controls block does not include an image tag");
  assert.ok(html.includes('id="sphere-environment-bridge"'));
  assert.ok(html.includes('id="sphere-environment-focus"'));
  assert.equal((ui.match(/data-sphere-action="open-field-map"/g) || []).length, 1, "open-field-map action is not duplicated");
  assert.equal((ui.match(/data-sphere-action="show-fields"/g) || []).length, 1, "show-fields action is not duplicated");
  assert.ok(ui.includes("function _updateEnvironmentBridge(model)"));
  assert.ok(ui.includes("function _installBrokenResourceGuard()"));
  assert.ok(css.includes(".sphere-broken-resource-hidden { display:none !important; }"));
  assert.ok(css.includes("grid-template-areas"));
});
