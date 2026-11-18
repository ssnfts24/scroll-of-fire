"use strict";

// Tests that the Today card derives its Pattern position through the
// canonical temporal cursor (SOFTemporalCursor.resolvePosition), per
// docs/development/TEMPORAL-AUTHORITY-CONTRACT.md — not by calling
// PatternCalendar directly. The cursor resolution is a pure read: it
// must not move the cursor's selection. When the cursor has not
// initialized, the bootstrap position (the model's stored result)
// preserves the card's previous behavior.

const assert = require("node:assert/strict");
const fs     = require("node:fs");
const path   = require("node:path");
const test   = require("node:test");
const vm     = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

// ── Context loader ────────────────────────────────────────────────────────────

function loadContext({ withCursor = true } = {}) {
  const listeners = new Map();
  const ctx = {
    Intl,
    Date,
    URL,
    console,
    location: {
      href: "https://codexofreality.org/moons.html",
      hostname: "codexofreality.org",
      origin: "https://codexofreality.org",
      pathname: "/moons.html",
    },
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail || {};
      }
    },
    addEventListener(type, fn) {
      listeners.set(type, [...(listeners.get(type) || []), fn]);
    },
    removeEventListener() {},
    dispatchEvent(event) {
      for (const fn of listeners.get(event.type) || []) fn(event);
      return true;
    },
  };
  ctx.globalThis = ctx;
  ctx.window     = ctx;

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
    "docs/assets/js/sphere/living-time-sphere-model.js",
    "docs/assets/js/sphere/living-time-sphere-layout.js",
    "docs/assets/js/sphere/living-time-sphere-renderer-svg.js",
    "docs/assets/js/sphere/living-time-sphere-accessibility.js",
    "docs/assets/js/sphere/living-time-sphere-export.js",
    "docs/assets/js/sphere/living-time-sphere-url-state.js",
    "docs/assets/js/calendar/temporal-coordinate-engine.js",
    ...(withCursor ? ["docs/assets/js/calendar/temporal-cursor-controller.js"] : []),
    "docs/assets/js/sphere/living-time-sphere-today.js",
  ];

  for (const rel of scripts) vm.runInNewContext(read(rel), ctx);
  return ctx;
}

// ── Fake DOM root ─────────────────────────────────────────────────────────────

function fakeRoot() {
  const elements = new Map();
  const el = sel => {
    if (!elements.has(sel)) {
      elements.set(sel, {
        textContent: "",
        href: "",
        innerHTML: "",
        dataset: {},
        clientWidth: 160,
        clientHeight: 160,
      });
    }
    return elements.get(sel);
  };
  return {
    root: { querySelector: sel => el(sel) },
    text: id => el(`#${id}`).textContent,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// America/Los_Angeles observes PDT (UTC-7) in July 2026.
const PDT_OFFSET = 7 * 60 * 60 * 1000;
function pdtToUtc(localIso) {
  return new Date(new Date(localIso + "Z").getTime() + PDT_OFFSET);
}

const RENDER_OPTS = {
  timeZone: "America/Los_Angeles",
  boundaryMode: "manual",
  manualSunset: "18:00",
};

// July 22 2026, 17:59 LA (before the 18:00 boundary):
// real position is Moon 4 · Day 13 · Day 97/364.
const BEFORE_BOUNDARY = pdtToUtc("2026-07-22T17:59:00");
// July 22 2026, 20:19 LA (after the 18:00 boundary):
// real position is Moon 4 · Day 14 · Day 98/364. A boundary-blind
// computation yields Day 97 here, so this instant discriminates.
const AFTER_BOUNDARY = pdtToUtc("2026-07-22T20:19:00");

// ── Today renders the cursor's coordinate, not its own computation ────────────

test("Today card renders the position resolved through SOFTemporalCursor", () => {
  const ctx = loadContext();
  assert.ok(ctx.SOFTemporalCursor?.resolvePosition, "cursor must expose resolvePosition");

  const calls = [];
  ctx.SOFTemporalCursor = {
    resolvePosition(instant, options) {
      calls.push({ instant, options });
      // Sentinel position: deliberately unlike the real position for the
      // rendered instant (Moon 4 · Day 13 · Day 97), so the rendered card
      // can only show these values if they came through the cursor.
      return {
        moon: 9,
        moonName: "Sentinel Moon",
        day: 9,
        dayOfPatternYear: 233,
        dayArchetype: "Sentinel Gate",
        isDayOutOfTime: false,
        isDeepTimeDay: false,
        civilDate: "2026-07-22",
        effectiveDate: "2026-07-22",
        afterBoundary: false,
        sunsetTime: "18:00",
        patternYear: 2026,
      };
    },
  };

  const { root: rootEl, text } = fakeRoot();
  const ok = ctx.LivingTimeSphereTodayCard.render(rootEl, {
    ...RENDER_OPTS,
    asOf: BEFORE_BOUNDARY,
  });

  assert.equal(ok, true, "render must succeed");
  assert.equal(calls.length, 1, "Today must resolve its position through the cursor exactly once");
  assert.equal(calls[0].instant.getTime(), BEFORE_BOUNDARY.getTime(), "cursor must receive the rendered instant");
  assert.equal(calls[0].options.timeZone, "America/Los_Angeles");
  assert.equal(calls[0].options.boundaryMode, "manual");
  assert.equal(calls[0].options.sunsetTime, "18:00");
  assert.equal(text("sphere-today-moon"), "Moon 9");
  assert.equal(text("sphere-today-moon-name"), "Sentinel Moon");
  assert.equal(text("sphere-today-moon-day"), "9");
  assert.equal(text("sphere-today-day-of-year"), "Day 233 of 364");
});

// ── Real cursor: boundary semantics preserved end to end ─────────────────────

test("Today through the real cursor keeps sunset-boundary semantics", () => {
  const ctx = loadContext();

  let resolutions = 0;
  const original = ctx.SOFTemporalCursor.resolvePosition;
  ctx.SOFTemporalCursor.resolvePosition = (instant, options) => {
    resolutions += 1;
    return original(instant, options);
  };

  const { root: rootEl, text } = fakeRoot();
  const ok = ctx.LivingTimeSphereTodayCard.render(rootEl, {
    ...RENDER_OPTS,
    asOf: AFTER_BOUNDARY,
  });

  assert.equal(ok, true, "render must succeed");
  assert.ok(resolutions >= 1, "Today must call cursor.resolvePosition");
  assert.equal(text("sphere-today-moon"), "Moon 4");
  assert.equal(text("sphere-today-moon-day"), "14");
  assert.equal(text("sphere-today-day-of-year"), "Day 98 of 364");
});

// ── Cursor resolution never moves the selection ───────────────────────────────

test("resolving Today's position does not move the cursor selection", () => {
  const ctx = loadContext();
  const cursor = ctx.SOFTemporalCursor;

  cursor.setGregorianDate(2026, 1, 15, { source: "test" });
  const before = cursor.getState();

  const { root: rootEl } = fakeRoot();
  const ok = ctx.LivingTimeSphereTodayCard.render(rootEl, {
    ...RENDER_OPTS,
    asOf: BEFORE_BOUNDARY,
  });

  assert.equal(ok, true, "render must succeed");
  const after = cursor.getState();
  assert.equal(after.selectedDate.getTime(), before.selectedDate.getTime(),
    "selection must be unchanged by a Today render");
  assert.equal(after.revision, before.revision,
    "revision must be unchanged — resolution is a pure read");
});

// ── Bootstrap: no cursor in the session, behavior preserved ──────────────────

test("without a cursor, Today falls back to the bootstrap position unchanged", () => {
  const ctx = loadContext({ withCursor: false });
  assert.equal(ctx.SOFTemporalCursor, undefined);

  const { root: rootEl, text } = fakeRoot();
  const ok = ctx.LivingTimeSphereTodayCard.render(rootEl, {
    ...RENDER_OPTS,
    asOf: BEFORE_BOUNDARY,
  });

  assert.equal(ok, true, "render must succeed");
  assert.equal(text("sphere-today-moon"), "Moon 4");
  assert.equal(text("sphere-today-moon-day"), "13");
  assert.equal(text("sphere-today-day-of-year"), "Day 97 of 364");
});
