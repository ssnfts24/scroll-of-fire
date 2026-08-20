"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

function loadTemporal() {
  const context = vm.createContext({ console });
  context.globalThis = context;
  vm.runInContext(read("docs/assets/js/sphere/living-time-sphere-temporal.js"), context);
  return context.LivingTimeSphereTemporal;
}

function loadFullPageBootContext() {
  const noop = () => {};
  const classList = { add: noop, remove: noop, toggle: noop, contains: () => false };
  const container = {
    id: "sphere-container",
    clientWidth: 338,
    clientHeight: 352,
    isConnected: true,
    dataset: {},
    style: {},
    classList,
    parentElement: null,
    addEventListener: noop,
    removeEventListener: noop,
    querySelector: () => null,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ width: 338, height: 352, left: 0, top: 0, right: 338, bottom: 352 }),
    appendChild: noop,
    prepend: noop,
  };
  container.parentElement = container;
  const document = {
    hidden: false,
    lastModified: "",
    baseURI: "https://example.test/living-time-sphere.html",
    documentElement: { classList, dataset: {} },
    body: { classList, dataset: {}, appendChild: noop },
    getElementById: id => id === "sphere-container" ? container : null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: tag => ({
      tagName: String(tag).toUpperCase(),
      dataset: {},
      style: {},
      classList: { ...classList },
      setAttribute: noop,
      addEventListener: noop,
      querySelector: () => null,
      querySelectorAll: () => [],
      appendChild: noop,
      remove: noop,
    }),
    addEventListener: noop,
    removeEventListener: noop,
  };
  const storage = { length: 0, getItem: () => null, setItem: noop, removeItem: noop, key: () => null };
  let svgRenderCount = 0;
  const context = vm.createContext({
    Intl,
    Date,
    URL,
    URLSearchParams,
    console,
    document,
    localStorage: storage,
    sessionStorage: storage,
    location: {
      href: "https://example.test/living-time-sphere.html?preview=boot",
      hostname: "example.test",
      origin: "https://example.test",
      pathname: "/living-time-sphere.html",
      search: "?preview=boot",
    },
    history: { replaceState: noop },
    navigator: {
      deviceMemory: 4,
      onLine: true,
      serviceWorker: { controller: null, getRegistration: async () => null },
    },
    performance: { now: () => Date.now(), getEntriesByType: () => [] },
    requestAnimationFrame: callback => { callback(Date.now()); return 1; },
    cancelAnimationFrame: noop,
    setTimeout,
    clearTimeout,
    addEventListener: noop,
    removeEventListener: noop,
    matchMedia: () => ({ matches: false, addEventListener: noop }),
    innerWidth: 390,
    devicePixelRatio: 2,
    ResizeObserver: undefined,
    MutationObserver: undefined,
    PerformanceObserver: undefined,
    getComputedStyle: () => ({
      display: "block",
      visibility: "visible",
      opacity: "1",
      position: "relative",
      zIndex: "auto",
      overflow: "hidden",
      transform: "none",
      contain: "none",
      contentVisibility: "visible",
    }),
  });
  context.globalThis = context;
  context.window = context;
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
    "docs/assets/js/sphere/living-time-sphere-version.js",
    "docs/assets/js/sphere/living-time-sphere-model.js",
    "docs/assets/js/sphere/living-time-sphere-temporal.js",
    "docs/assets/js/sphere/living-time-sphere-state.js",
    "docs/assets/js/sphere/living-time-sphere-semantic-zoom.js",
    "docs/assets/js/sphere/living-time-sphere-layout.js",
    "docs/assets/js/sphere/living-time-sphere-connections.js",
    "docs/assets/js/environment/environment-state.js",
    "docs/assets/js/sphere/living-time-sphere-live-data.js",
    "docs/assets/js/sphere/living-time-sphere-accessibility.js",
  ];
  scripts.forEach(relative => vm.runInContext(read(relative), context, { filename: relative }));
  context.LivingTimeSphereRendererSvg = { renderInto: () => { svgRenderCount += 1; } };
  context.LivingTimeSphereInteraction = { init: noop };
  context.LivingTimeSphereUrlState = { parseSphereUrl: () => ({}), buildSphereUrl: () => context.location.href };
  context.LivingTimeSphereEffects = { detectWebGl: () => false };
  context.LivingTimeSphereCamera = {
    MODE_POSITIONS: {
      today: { distance: 2.3 },
      passage: { distance: 2.3 },
      years: { distance: 2.3 },
      pattern: { distance: 2.3 },
    },
    getState: () => ({}),
  };
  context.LivingTimeSphereRenderer3d = {};
  vm.runInContext(read("docs/assets/js/sphere/living-time-sphere-ui.js"), context, { filename: "living-time-sphere-ui.js" });
  return { context, getSvgRenderCount: () => svgRenderCount };
}

test("Pattern-day math clamps direct selection and wraps relative navigation", () => {
  const temporal = loadTemporal();
  assert.equal(temporal.clampDay(-10), 1);
  assert.equal(temporal.clampDay(999), 364);
  assert.equal(temporal.wrapDay(365), 1);
  assert.equal(temporal.wrapDay(0), 364);
  assert.equal(temporal.stepDay(364, 1), 1);
  assert.equal(temporal.stepDay(1, -1), 364);
});

test("playback can loop inside a Pattern week, Moon, or full year", () => {
  const temporal = loadTemporal();
  assert.equal(temporal.stepWithinScope(7, 1, "pattern-week"), 1);
  assert.equal(temporal.stepWithinScope(28, 1, "pattern-moon"), 1);
  assert.equal(temporal.stepWithinScope(56, 1, "pattern-moon"), 29);
  assert.equal(temporal.stepWithinScope(364, 1, "pattern-year"), 1);
});

test("Today target resolves one canonical day, Pattern year, and semantic marker", () => {
  const temporal = loadTemporal();
  const target = temporal.resolveTodayTarget({
    snapshot: {
      year: 2026,
      pattern: {
        patternYear: 2026,
        dayOfPatternYear: 122,
        civilDate: "2026-08-15",
        effectiveDate: "2026-08-16",
      },
    },
    supportedYears: [2024, 2025, 2026],
    fallbackYear: 2025,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(target)), {
    dayOfPatternYear: 122,
    moon: 5,
    day: 10,
    week: 2,
    dayOfWeek: 3,
    year: 2026,
    patternYear: 2026,
    marker: "today",
    civilDate: "2026-08-15",
    effectiveDate: "2026-08-16",
    exactYearMatch: true,
  });
});

test("Today target keeps live Pattern identity when alignment data needs a nearest year", () => {
  const temporal = loadTemporal();
  const target = temporal.resolveTodayTarget({
    snapshot: { year: 2026, pattern: { patternYear: 2028, dayOfPatternYear: 9, effectiveDate: "2028-04-25" } },
    supportedYears: [2024, 2025, 2026],
  });
  assert.equal(target.patternYear, 2028);
  assert.equal(target.year, 2026);
  assert.equal(target.dayOfPatternYear, 9);
  assert.equal(target.exactYearMatch, false);
});

test("selected-versus-Today comparison uses the shortest circular arc", () => {
  const temporal = loadTemporal();
  const comparison = temporal.compareToToday(
    { dayOfPatternYear: 2, effectiveDate: "2027-04-18" },
    { dayOfPatternYear: 363, effectiveDate: "2027-04-15" },
  );
  assert.equal(comparison.forwardDays, 3);
  assert.equal(comparison.backwardDays, 361);
  assert.equal(comparison.shortestSignedDays, 3);
  assert.equal(comparison.civilDayDelta, 3);
  assert.equal(comparison.isLiveToday, false);
});

test("same Pattern coordinate in another year is not mislabeled Live Today", () => {
  const temporal = loadTemporal();
  const comparison = temporal.compareToToday(
    { dayOfPatternYear: 122, effectiveDate: "2025-08-16", isToday: false },
    { dayOfPatternYear: 122, effectiveDate: "2026-08-16" },
  );
  assert.equal(comparison.samePatternDay, true);
  assert.equal(comparison.isLiveToday, false);
  assert.match(comparison.relationshipLabel, /civil days behind/);
});

test("full Sphere exposes an accessible Temporal Lens", () => {
  const html = read("docs/living-time-sphere.html");
  assert.ok(html.includes("living-time-sphere-temporal.js"));
  assert.ok(html.includes('id="sphere-return-today"'));
  assert.ok(html.includes('id="sphere-day-scrubber"'));
  assert.ok(html.includes('id="sphere-temporal-play"'));
  assert.ok(html.includes('id="sphere-temporal-scope"'));
  assert.ok(html.includes('id="sphere-temporal-comparison"'));
});

test("every Today entry point routes through one authoritative reset transaction", () => {
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  assert.ok(ui.includes("function _returnToLiveToday("));
  assert.ok(ui.includes('source: "view-mode-today"'));
  assert.ok(ui.includes('source: `field-range-${range}`'));
  assert.ok(ui.includes('source: "temporal-lens"'));
  assert.ok(ui.includes('source: "browser-history"'));
  assert.match(ui, /else if \(markerDay != null\) \{[\s\S]*?_requestSelectedDayUpdate\(container, markerDay\);[\s\S]*?_requestViewModeTransition\(container, historyViewMode\);/);
  assert.ok(ui.includes('marker: "today"'));
  assert.ok(ui.includes('action: "RETURN_TO_LIVE_TODAY"'));
  assert.ok(ui.includes("todayResetCount"));
});

test("Today state patch updates selection, year, marker, range, and requested mode together", () => {
  const context = vm.createContext({ console });
  context.globalThis = context;
  vm.runInContext(read("docs/assets/js/sphere/living-time-sphere-ui.js"), context);
  const buildPatch = context.LivingTimeSphereUi._internals.buildTodaySelectionPatch;
  const fullReset = JSON.parse(JSON.stringify(buildPatch(
    { dayOfPatternYear: 122, year: 2026 },
    { fieldRange: "today", switchViewMode: true },
  )));
  assert.deepEqual(fullReset, {
    selectedDayOfYear: 122,
    year: 2026,
    selectedMarker: "today",
    fieldRange: "today",
    requestedViewMode: "today",
  });
  const rangeOnly = JSON.parse(JSON.stringify(buildPatch(
    { dayOfPatternYear: 5, year: 2025 },
    { fieldRange: "now", switchViewMode: false, currentViewMode: "passage" },
  )));
  assert.equal(rangeOnly.requestedViewMode, "passage");
  assert.equal(rangeOnly.fieldRange, "now");
  const decorated = context.LivingTimeSphereUi._internals.decorateModel({
    todayPatternPosition: { dayOfPatternYear: 122, moon: 5 },
    moonSectors: [],
  });
  assert.equal(decorated.todayPatternPosition.dayOfPatternYear, 122);
  const boot = loadFullPageBootContext();
  boot.context.LivingTimeSphereUi.init();
  assert.equal(boot.context.LivingTimeSphereUi.getState().fullRenderCount, 1);
  assert.equal(boot.getSvgRenderCount(), 1);
});

test("Sphere connection graph links an explored day directly to Today", () => {
  const temporal = loadTemporal();
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  const connections = read("docs/assets/js/sphere/living-time-sphere-connections.js");
  const renderer3d = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
  const rendererSvg = read("docs/assets/js/sphere/living-time-sphere-renderer-svg.js");
  const arc = temporal.comparisonArcSamples(363, 2);
  assert.ok(arc.samples.length >= 19);
  assert.ok(arc.deltaAngle > 0 && arc.deltaAngle <= 180);
  assert.equal(arc.samples[0].lift, 0);
  assert.ok(arc.samples[Math.floor(arc.samples.length / 2)].lift > 0.99);
  assert.ok(connections.includes("selected-today-${selected.dayOfPatternYear}"));
  assert.ok(connections.includes('targetMarkerId: "today"'));
  assert.ok(connections.includes('relationship: "Selected day compared with Today"'));
  assert.ok(connections.includes('style: "progression"'));
  assert.ok(renderer3d.includes("LivingTimeSphereTemporal?.comparisonArcSamples?."));
  assert.ok(rendererSvg.includes("sphere-temporal-comparison-arc"));
  assert.ok(ui.includes("mode: _state.viewMode"));
  assert.ok(ui.includes("selectedYear: _state.year"));
});

test("Data Table and Text renderers are populated from the canonical model", () => {
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  assert.ok(ui.includes("function _updateAlternateViews(model, spiral)"));
  assert.ok(ui.includes('document.getElementById("sphere-data-table")'));
  assert.ok(ui.includes("Canonical Living Time Sphere coordinates"));
  assert.ok(ui.includes('document.getElementById("sphere-text-summary-content")'));
  assert.ok(ui.includes("Relationship to Today:"));
  assert.ok(ui.includes("_updateAlternateViews(model, spiral);"));
});

test("camera-only presets cannot desynchronize semantic view state", () => {
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  const start = ui.indexOf('// Camera preset buttons.');
  const end = ui.indexOf('// Sphere year-select events', start);
  const section = ui.slice(start, end);
  assert.ok(section.includes("LivingTimeSphereCamera?.setMode?."));
  assert.equal(section.includes("LivingTimeSphereRenderer3d?.setMode"), false);
  assert.equal(section.includes("_state.viewMode ="), false);
});

test("Copy Link preserves the selected or semantic Today marker", () => {
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  const start = ui.indexOf("// Copy link.");
  const end = ui.indexOf("// Export PNG.", start);
  const section = ui.slice(start, end);
  assert.ok(section.includes('selected?.isToday'));
  assert.ok(section.includes('? "today"'));
  assert.ok(section.includes("marker,"));
});

test("selected-date solar calculations use the lightweight solar-only path", () => {
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  const liveData = read("docs/assets/js/sphere/living-time-sphere-live-data.js");
  assert.ok(ui.includes("LivingTimeSphereLiveData?.getSolarSnapshot?.({"));
  assert.ok(liveData.includes("function getSolarSnapshot(opts = {})"));
  assert.ok(liveData.includes("getSolarSnapshot,"));
  assert.ok(ui.includes("_liveSnapshotCacheAt"));
  assert.ok(ui.includes("_invalidateLiveSnapshotCache();"));
});

test("solar-only snapshots do not require environment, history, or renderer state", () => {
  const context = vm.createContext({ console, Date });
  context.globalThis = context;
  context.LivingTimeSphereModel = {
    seasonalProgressAngleForDate: () => 144.5,
  };
  vm.runInContext(read("docs/assets/js/sphere/living-time-sphere-live-data.js"), context);
  const solar = context.LivingTimeSphereLiveData.getSolarSnapshot({ asOf: "2026-08-15T12:00:00Z" });
  assert.equal(solar.gate, "Leo");
  assert.equal(solar.element, "Fire");
  assert.equal(solar.angle, 144.5);
  assert.equal(solar.provenance.precision, "anchor-interpolation");
});

test("selection authority keeps Live Today distinct from explicit Selected", () => {
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");

  /*
   * Temporal authority contract:
   *
   * Today    = live temporal coordinate.
   * Selected = explicit navigation coordinate.
   *
   * Merely rendering Today must not require manufacturing an
   * independent selected-day authority from the live coordinate.
   *
   * Explicit navigation may select the same coordinate as Today,
   * but that equality must not collapse the two semantic roles.
   */

  assert.ok(
    ui.includes("todayPatternPosition"),
    "UI must retain canonical Today position"
  );

  assert.ok(
    ui.includes("selectedPatternPosition"),
    "UI must retain an independently represented selected position"
  );

  assert.ok(
    ui.includes("_requestSelectedDayUpdate("),
    "explicit selections must use the selected-day transaction"
  );

  assert.ok(
    ui.includes("_returnToLiveToday("),
    "returning to Today must remain an explicit semantic transaction"
  );
});

test("selection authority preserves selected coordinate across temporal exploration", () => {
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");

  const start = ui.indexOf("function _selectTemporalYear(");
  const end = ui.indexOf("function _syncYearSelect", start);
  const section = start >= 0 && end > start
    ? ui.slice(start, end)
    : "";

  assert.ok(section.length > 0, "temporal-year selection handler must exist");

  assert.ok(
    section.includes("_state.selectedDayOfYear"),
    "year exploration must preserve or deliberately map the selected Pattern day"
  );

  assert.equal(
    section.includes("_returnToLiveToday("),
    false,
    "year exploration must not silently collapse Selected back into Today"
  );
});

test("Today and Selected may share a Pattern day without sharing semantic identity", () => {
  const temporal = loadTemporal();

  const comparison = temporal.compareToToday(
    {
      dayOfPatternYear: 122,
      effectiveDate: "2025-08-16",
      isToday: false
    },
    {
      dayOfPatternYear: 122,
      effectiveDate: "2026-08-16"
    }
  );

  assert.equal(
    comparison.samePatternDay,
    true,
    "same Pattern coordinate should be recognized"
  );

  assert.equal(
    comparison.isLiveToday,
    false,
    "same Pattern coordinate in another temporal context must not become Live Today"
  );
});
