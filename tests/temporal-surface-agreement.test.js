"use strict";

/**
 * Temporal surface agreement — Today, 13 Moons, and the homepage.
 *
 * Every surface that shows a Pattern position must read the same day
 * from the one shared time source (SOFTemporalCursor →
 * PatternCalendar; docs/development/TEMPORAL-AUTHORITY-CONTRACT.md).
 * These tests pin the agreement at the value level: for the same
 * civil instant, PatternCalendar.fromCivilDate, the cursor's
 * resolvePosition, the cursor's selected coordinate, and the Sphere
 * day view's selection must all name the same Moon, day, and Pattern
 * Day — including the year boundary and the Day Out of Time — and at
 * the wiring level: each surface's page loads the canonical cursor.
 *
 * Fixture values are the calendar's own: Jul 17, 2026 = Moon 4 ·
 * Day 8 · Pattern Day 92 and Sep 15, 2026 = Pattern Day 152 ·
 * Moon 6 · Day 12 are Aaron's reference fixtures; Nov 18, 2026 =
 * Moon 8 · Day 20 · Pattern Day 216 is the day this test was written.
 */

const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

const path =
  require("node:path");

const vm =
  require("node:vm");

const dayZoom =
  require(
    path.resolve(
      __dirname,
      "../docs/assets/js/sphere/living-time-sphere-day-zoom.js"
    )
  );

const CALENDAR_FILES = [
  "docs/assets/js/calendar/pattern-calendar-version.js",
  "docs/assets/js/calendar/pattern-calendar-data.js",
  "docs/assets/js/calendar/pattern-calendar-format.js",
  "docs/assets/js/calendar/pattern-calendar-boundary.js",
  "docs/assets/js/calendar/pattern-calendar.js",
  "docs/assets/js/calendar/temporal-coordinate-engine.js",
  "docs/assets/js/calendar/temporal-cursor-controller.js"
];

function loadTemporalStack() {
  class CustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  }

  const listeners = {};

  const context = {
    console,
    Date,
    Intl,
    CustomEvent,
    URLSearchParams,
    queueMicrotask,

    location: { search: "" },

    addEventListener(type, callback) {
      (listeners[type] ??= []).push(callback);
    },

    removeEventListener() {},

    dispatchEvent(event) {
      for (const callback of listeners[event.type] || []) {
        callback(event);
      }

      return true;
    }
  };

  context.window = context;
  context.globalThis = context;

  // Pin the cursor's timezone/boundary so the agreement assertions
  // are deterministic on any machine.
  context.SOFObservatoryState = {
    timezone: "UTC",
    boundary: "midnight"
  };

  vm.createContext(context);

  for (const file of CALENDAR_FILES) {
    vm.runInContext(
      fs.readFileSync(
        path.resolve(__dirname, "..", file),
        "utf8"
      ),
      context,
      { filename: file }
    );
  }

  return context;
}

const RESOLVE_OPTIONS = {
  timeZone: "UTC",
  boundaryMode: "midnight",
  sunsetTime: "18:00"
};

function noonUtc(civilDate) {
  return new Date(`${civilDate}T12:00:00Z`);
}

// civil date → the one true position. patternYear is PatternCalendar's
// cycle numbering; coordinatePatternYear is the coordinate engine's
// civil anchor year (the year Life Atlas records are stamped with).
const FIXTURES = [
  { civil: "2026-04-17", patternYear: 1, coordinatePatternYear: 2026, patternDay: 1, moon: 1, moonDay: 1 },
  { civil: "2026-07-17", patternYear: 1, coordinatePatternYear: 2026, patternDay: 92, moon: 4, moonDay: 8 },
  { civil: "2026-09-15", patternYear: 1, coordinatePatternYear: 2026, patternDay: 152, moon: 6, moonDay: 12 },
  { civil: "2026-11-18", patternYear: 1, coordinatePatternYear: 2026, patternDay: 216, moon: 8, moonDay: 20 },
  { civil: "2026-12-31", patternYear: 1, coordinatePatternYear: 2026, patternDay: 259, moon: 10, moonDay: 7 },
  { civil: "2027-04-15", patternYear: 1, coordinatePatternYear: 2026, patternDay: 364, moon: 13, moonDay: 28 },
  { civil: "2027-04-17", patternYear: 2, coordinatePatternYear: 2027, patternDay: 1, moon: 1, moonDay: 1 }
];

// Days outside the 364-day count: no Pattern Day exists to agree on,
// and every surface must say so instead of inventing one.
const OUTSIDE_FIXTURES = [
  { civil: "2026-04-16", coordinatePatternYear: 2025 },
  { civil: "2027-04-16", coordinatePatternYear: 2026 }
];

test(
  "PatternCalendar and the cursor's resolvePosition agree on every fixture date",
  () => {
    const { PatternCalendar, SOFTemporalCursor } =
      loadTemporalStack();

    for (const fixture of [...FIXTURES, ...OUTSIDE_FIXTURES]) {
      const instant = noonUtc(fixture.civil);

      const direct =
        PatternCalendar.fromCivilDate({
          date: instant,
          ...RESOLVE_OPTIONS
        });

      const resolved =
        SOFTemporalCursor.resolvePosition(instant, RESOLVE_OPTIONS);

      assert.ok(resolved, fixture.civil);
      assert.equal(resolved.civilDate, fixture.civil);
      assert.equal(
        resolved.dayOfPatternYear,
        direct.dayOfPatternYear,
        fixture.civil
      );
      assert.equal(resolved.moon, direct.moon, fixture.civil);
      assert.equal(resolved.day, direct.day, fixture.civil);
      assert.equal(
        resolved.isDayOutOfTime,
        direct.isDayOutOfTime,
        fixture.civil
      );

      if ("patternDay" in fixture) {
        assert.equal(direct.patternYear, fixture.patternYear, fixture.civil);
        assert.equal(direct.dayOfPatternYear, fixture.patternDay, fixture.civil);
        assert.equal(direct.moon, fixture.moon, fixture.civil);
        assert.equal(direct.day, fixture.moonDay, fixture.civil);
        assert.equal(direct.isDayOutOfTime, false, fixture.civil);
      } else {
        assert.equal(direct.dayOfPatternYear, null, fixture.civil);
        assert.equal(direct.moon, null, fixture.civil);
        assert.equal(direct.isDayOutOfTime, true, fixture.civil);
      }
    }
  }
);

test(
  "the cursor's selected coordinate names the same day on every fixture date",
  () => {
    const { SOFTemporalCursor } =
      loadTemporalStack();

    for (const fixture of [...FIXTURES, ...OUTSIDE_FIXTURES]) {
      SOFTemporalCursor.setDate(noonUtc(fixture.civil), {
        source: "surface-agreement-test"
      });

      const coordinate =
        SOFTemporalCursor.getCoordinate();

      assert.ok(coordinate, fixture.civil);
      assert.equal(
        coordinate.gregorian.isoDate,
        fixture.civil,
        fixture.civil
      );

      const remnant = coordinate.remnant13Moons;

      assert.equal(
        remnant.patternYear,
        fixture.coordinatePatternYear,
        fixture.civil
      );
      assert.equal(
        remnant.patternDay,
        "patternDay" in fixture ? fixture.patternDay : null,
        fixture.civil
      );
      assert.equal(
        remnant.moon,
        "moon" in fixture ? fixture.moon : null,
        fixture.civil
      );
      assert.equal(
        remnant.moonDay,
        "moonDay" in fixture ? fixture.moonDay : null,
        fixture.civil
      );
    }
  }
);

test(
  "the Sphere day view reads the same day from the cursor coordinate",
  () => {
    const { SOFTemporalCursor } =
      loadTemporalStack();

    for (const fixture of [...FIXTURES, ...OUTSIDE_FIXTURES]) {
      const instant = noonUtc(fixture.civil);

      SOFTemporalCursor.setDate(instant, {
        source: "surface-agreement-test"
      });

      const selection =
        dayZoom.selectionFromCursor(SOFTemporalCursor);

      assert.ok(selection, fixture.civil);
      assert.equal(selection.civilDate, fixture.civil, fixture.civil);
      assert.equal(
        selection.patternYear,
        fixture.coordinatePatternYear,
        fixture.civil
      );
      assert.equal(
        selection.patternDay,
        "patternDay" in fixture ? fixture.patternDay : null,
        fixture.civil
      );
      assert.equal(
        selection.moon,
        "moon" in fixture ? fixture.moon : null,
        fixture.civil
      );
      assert.equal(
        selection.moonDay,
        "moonDay" in fixture ? fixture.moonDay : null,
        fixture.civil
      );

      const view = dayZoom.buildDayView({
        selection,
        records: []
      });

      assert.equal(
        view.isOutsideCount,
        !("patternDay" in fixture),
        fixture.civil
      );
    }
  }
);

test(
  "Today, 13 Moons, and the homepage all load the canonical cursor",
  () => {
    const read = file =>
      fs.readFileSync(
        path.resolve(__dirname, "..", file),
        "utf8"
      );

    // The Sphere page (Today card + day view) loads the cursor, and
    // its Today module resolves positions through it.
    const spherePage = read("docs/living-time-sphere.html");
    assert.match(spherePage, /temporal-cursor-controller\.js/);
    assert.match(spherePage, /living-time-sphere-day-zoom\.js/);

    const todayModule = read(
      "docs/assets/js/sphere/living-time-sphere-today.js"
    );
    assert.match(todayModule, /SOFTemporalCursor/);
    assert.match(todayModule, /cursor\.resolvePosition/);

    // The 13 Moons page loads the cursor controller alongside the
    // canonical calendar.
    const moonsPage = read("docs/moons.html");
    assert.match(moonsPage, /temporal-cursor-controller\.js/);
    assert.match(moonsPage, /pattern-calendar\.js/);

    // The homepage's Sphere instrument loads the cursor and drives
    // its Today transaction through it.
    const homeInstrument = read(
      "docs/assets/js/home-observatory-instrument.js"
    );
    assert.match(homeInstrument, /temporal-cursor-controller\.js/);
    assert.match(homeInstrument, /SOFTemporalCursor/);
    assert.match(homeInstrument, /cursor\?\.today/);
  }
);
