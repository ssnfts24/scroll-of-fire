"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

function loadWorkbench() {
  const context = {
    console,
    Date,
    Intl,
    URL,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    localStorage: { getItem: () => null, setItem() {} },
  };
  context.globalThis = context;
  vm.createContext(context);
  [
    "docs/assets/js/calendar/pattern-calendar-version.js",
    "docs/assets/js/calendar/pattern-calendar-data.js",
    "docs/assets/js/calendar/pattern-calendar-format.js",
    "docs/assets/js/calendar/pattern-calendar-boundary.js",
    "docs/assets/js/calendar/pattern-calendar.js",
    "docs/assets/js/sphere/living-time-sphere-temporal.js",
    "docs/assets/js/sphere/living-time-calendar-workbench.js",
  ].forEach(relative => new vm.Script(read(relative), { filename: relative }).runInContext(context));
  return context.LivingTimeCalendarWorkbench;
}

test("Calendar Atlas has valid syntax and a frozen public API", () => {
  assert.doesNotThrow(() => new vm.Script(read("docs/assets/js/sphere/living-time-calendar-workbench.js")));
  const api = loadWorkbench();
  assert.ok(Object.isFrozen(api));
  assert.equal(api.version, "living-time-calendar-workbench/1.1.0-b724");
});

test("civil and Pattern dates map through the canonical calendar", () => {
  const api = loadWorkbench();
  assert.equal(api.civilDateForPatternDay(2026, 1), "2026-04-17");
  assert.equal(api.civilDateForPatternDay(2026, 364), "2027-04-15");

  const counted = api.resolveCivilDate("2026-04-17", [2014, 2015, 2026]);
  assert.equal(counted.valid, true);
  assert.equal(counted.inside, true);
  assert.equal(counted.alignmentYear, 2026);
  assert.equal(counted.patternYear, 1, "canonical Pattern Year must not be confused with Gregorian 2026");
  assert.equal(counted.dayOfPatternYear, 1);
  assert.equal(counted.moon, 1);
  assert.equal(counted.day, 1);

  const outside = api.resolveCivilDate("2027-04-16", [2014, 2015, 2026]);
  assert.equal(outside.valid, true);
  assert.equal(outside.inside, false);
  assert.equal(outside.isDayOutOfTime, true);
  assert.equal(outside.dayOfPatternYear, null, "outside days must never be forced into Moon 13");
});

test("all four calendar scales stay synchronized at year edges", () => {
  const api = loadWorkbench();
  assert.deepEqual(Array.from(api.scaleDays("day", 1)), [363, 364, 1, 2, 3]);
  assert.deepEqual(Array.from(api.scaleDays("week", 9)), [8, 9, 10, 11, 12, 13, 14]);
  assert.equal(api.scaleDays("moon", 29).length, 28);
  assert.deepEqual(Array.from(api.scaleDays("year", 364)), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
});

test("boundary clock is timezone-aware and labels configured sunset honestly", () => {
  const api = loadWorkbench();
  const before = api.boundaryStatus(new Date("2026-08-16T00:59:00Z"), "America/Los_Angeles", "sunset", "18:00");
  assert.equal(before.localClock, "17:59");
  assert.equal(before.remainingMinutes, 1);
  assert.match(before.boundaryLabel, /Configured sunset/);

  const atBoundary = api.boundaryStatus(new Date("2026-08-16T01:00:00Z"), "America/Los_Angeles", "sunset", "18:00");
  assert.equal(atBoundary.localClock, "18:00");
  assert.equal(atBoundary.remainingMinutes, 1440);
});

test("pinned comparisons use shortest Pattern distance and civil distance", () => {
  const api = loadWorkbench();
  const comparison = api.compareCoordinates(
    { dayOfPatternYear: 360, civilDate: "2027-04-11" },
    { dayOfPatternYear: 3, civilDate: "2026-04-19" },
  );
  assert.equal(comparison.signedPatternDays, 7);
  assert.equal(comparison.absolutePatternDays, 7);
  assert.equal(comparison.sameCoordinate, false);
  assert.equal(typeof comparison.civilDays, "number");
});

test("pin storage is validated, deduplicated, and capped", () => {
  const api = loadWorkbench();
  const pins = api.normalizePins([
    { year: 2026, dayOfPatternYear: 1 },
    { year: 2026, dayOfPatternYear: 1 },
    { year: 2025, dayOfPatternYear: 2 },
    { year: 2024, dayOfPatternYear: 3 },
    { year: 2023, dayOfPatternYear: 4 },
    { year: 2022, dayOfPatternYear: 5 },
    { year: 2026, dayOfPatternYear: 365 },
  ]);
  assert.equal(pins.length, 4);
  assert.equal(new Set(pins.map(pin => pin.id)).size, 4);
  assert.ok(pins.every(pin => pin.dayOfPatternYear >= 1 && pin.dayOfPatternYear <= 364));
});

test("private notes validate locally and round-trip through iCalendar", () => {
  const api = loadWorkbench();
  const notes = api.normalizeNotes([
    { year: 2026, dayOfPatternYear: 1, title: "Year Gate", note: "Begin, align; witness." },
    { year: 2026, dayOfPatternYear: 1, title: "Duplicate" },
    { year: 2026, dayOfPatternYear: 365, title: "Invalid" },
  ]);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].civilDate, "2026-04-17");
  const ics = api.buildIcs(notes, { generatedAt: new Date("2026-08-15T12:00:00Z") });
  assert.match(ics, /BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20260417/);
  assert.match(ics, /SUMMARY:Year Gate/);
  assert.match(ics, /DESCRIPTION:Pattern Moon 1\\, Day 1\\, Day 1\/364\\n\\nBegin\\, align\\; witness\./);
  const imported = api.parseIcs(ics, [2026]);
  assert.equal(imported.length, 1);
  assert.equal(imported[0].year, 2026);
  assert.equal(imported[0].dayOfPatternYear, 1);
  assert.equal(imported[0].title, "Year Gate");
});

test("standalone Sphere ships the interactive Atlas as an offline app-shell feature", () => {
  const html = read("docs/living-time-sphere.html");
  const sw = read("docs/service-worker.js");
  assert.ok(html.includes('id="calendar-workbench"'));
  assert.ok(html.includes('id="calendar-civil-date"'));
  assert.ok(html.includes('data-calendar-scale="year"'));
  assert.ok(html.includes('id="calendar-compare-tray"'));
  assert.ok(html.includes('id="calendar-note-title"'));
  assert.ok(html.includes('id="calendar-local-agenda"'));
  assert.ok(html.includes('id="calendar-export-ics"'));
  assert.match(html, /living-time-calendar-workbench\.js\?v=20260819-b7\d+/);
  assert.ok(html.includes("living-time-calendar-workbench.css?v=20260819-b728"));
  assert.ok(sw.includes("./assets/js/sphere/living-time-calendar-workbench.js"));
  assert.ok(sw.includes("./assets/css/living-time-calendar-workbench.css"));
});

test("every Today-labeled entry point carries semantic Today authority", () => {
  [
    "docs/index.html",
    "docs/moons.html",
    "docs/assets/js/living-time-app-enhancements.js",
    "docs/assets/js/sphere/living-time-sphere-live-data.js",
  ].forEach(relative => {
    const source = read(relative);
    assert.ok(source.includes("marker=today"), `${relative} must carry marker=today`);
  });
});

test("deep links reject invalid timezones and impossible boundary clocks", () => {
  const context = { console, URL, Intl, LivingTimeSphereCamera: { MIN_ZOOM: 1, MAX_ZOOM: 9 } };
  context.globalThis = context;
  vm.createContext(context);
  new vm.Script(read("docs/assets/js/sphere/living-time-sphere-url-state.js")).runInContext(context);
  const parsed = context.LivingTimeSphereUrlState.parseSphereUrl(
    "https://codexofreality.org/living-time-sphere.html?tz=Definitely/Not_A_Zone&sunset=29:99",
  );
  assert.equal(parsed.timeZone, null);
  assert.equal(parsed.manualSunset, null);
  const valid = context.LivingTimeSphereUrlState.parseSphereUrl(
    "https://codexofreality.org/living-time-sphere.html?tz=America/Los_Angeles&sunset=18:00",
  );
  assert.equal(valid.timeZone, "America/Los_Angeles");
  assert.equal(valid.manualSunset, "18:00");
});

test("renderer lifecycle closes WebGL2, cancellation, retry, and GPU cleanup gaps", () => {
  const renderer = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  const animation = read("docs/assets/js/sphere/living-time-sphere-animation.js");
  assert.ok(renderer.includes('getContext("webgl2"'));
  assert.ok(renderer.includes("context:   _activeWebGlContext"));
  assert.ok(renderer.includes("function cancelInitialization("));
  assert.ok(renderer.includes("renderer.forceContextLoss?.()"));
  assert.ok(renderer.includes("_disposeObjectTree(_scene)"));
  assert.ok(renderer.indexOf("function _queueSceneRepair(") < renderer.indexOf("function _applyModeVisibilityOverrides("));
  assert.ok(ui.includes("pollCount >= 24"));
  assert.ok(ui.includes('cancelInitialization?.("ui-init-timeout")'));
  assert.ok(animation.includes("function detachPageVisibility("));
  assert.ok(animation.includes("if (_dirty || _needsContinuousFrames()) _scheduleFrame()"));
});

test("history restoration is fully authoritative without rewriting the popped entry", () => {
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  assert.ok(ui.includes("const URL_STATE_DEFAULTS = Object.freeze("));
  assert.ok(ui.includes("const markerDay = _applyParsedUrlState(parsed, { initial: false })"));
  assert.ok(ui.includes("const historyViewMode = parsed.viewMode || URL_STATE_DEFAULTS.viewMode"));
  assert.ok(ui.includes("if (_state._applyingHistoryState) return"));
  assert.ok(ui.includes("_state._applyingHistoryState = true"));
  assert.ok(ui.includes("_state._applyingHistoryState = false"));
  assert.ok(ui.includes("Number(live?.year) === Number(_state.year)"));
  assert.equal(ui.includes("live.pattern.patternYear === _state.year"), false);
});

test("WebGL1-only devices are routed to the SVG tier", () => {
  const legacyContext = {
    console,
    navigator: { deviceMemory: 4, hardwareConcurrency: 8, connection: null },
    document: {
      createElement() {
        return {
          getContext(type) {
            if (type === "webgl2") return null;
            if (type === "webgl" || type === "experimental-webgl") {
              return { drawArrays() {}, getExtension: () => null };
            }
            return null;
          },
        };
      },
    },
  };
  legacyContext.globalThis = legacyContext;
  legacyContext.window = legacyContext;
  vm.createContext(legacyContext);
  new vm.Script(read("docs/assets/js/sphere/observatory-capability-manager.js")).runInContext(legacyContext);
  new vm.Script(read("docs/assets/js/sphere/living-time-sphere-effects.js")).runInContext(legacyContext);
  const probe = legacyContext.ObservatoryCapabilityManager.probeWebGl();
  assert.equal(probe.webgl, true);
  assert.equal(probe.webgl2, false);
  assert.equal(legacyContext.LivingTimeSphereEffects.detectWebGl2(), false);
  assert.equal(
    legacyContext.ObservatoryCapabilityManager.selectTier(),
    legacyContext.ObservatoryCapabilityManager.PERFORMANCE_TIERS.MINIMAL,
  );
});

test("still animation renders on demand, quiesces when clean, and stops on errors", () => {
  const queue = [];
  let nextId = 1;
  let renders = 0;
  let reportedError = null;
  const context = {
    console: { ...console, error() {} },
    performance: { now: () => 16 },
    requestAnimationFrame(callback) { queue.push(callback); return nextId++; },
    cancelAnimationFrame() {},
    document: { addEventListener() {}, removeEventListener() {}, hidden: false },
    LivingTimeSphereCamera: {
      isAnimating: () => false,
      isDragging: () => false,
      isDrifting: () => false,
      stopDrift() {},
    },
  };
  context.globalThis = context;
  vm.createContext(context);
  new vm.Script(read("docs/assets/js/sphere/living-time-sphere-animation.js")).runInContext(context);
  const animation = context.LivingTimeSphereAnimation;
  animation.applyPreset({ pixelRatioMax: 1, idleDrift: false, breathing: false, passageFlow: false });
  animation.start(() => { renders += 1; }, error => { reportedError = error; });
  animation.markDirty();
  queue.shift()(16);
  assert.equal(renders, 1);
  assert.equal(queue.length, 0, "clean still mode must leave no perpetual RAF scheduled");

  animation.markDirty();
  assert.equal(queue.length, 1);
  queue.shift()(80);
  assert.equal(renders, 2);

  animation.stop();
  animation.start(() => { throw new Error("frame-boom"); }, error => { reportedError = error; });
  animation.markDirty();
  queue.shift()(160);
  assert.match(String(reportedError), /frame-boom/);
  assert.equal(animation.isRunning(), false);
});
