"use strict";

const test =
  require("node:test");

const assert =
  require(
    "node:assert/strict"
  );

const path =
  require("node:path");

const fs =
  require("node:fs");

const api =
  require(
    path.resolve(
      __dirname,
      "../docs/assets/js/sphere/living-time-sphere-day-zoom.js"
    )
  );

function record(overrides = {}) {
  return {
    id: "rec-1",
    type: "event",
    subtype: "event",
    title: "Untitled",
    summary: "",
    tags: ["living-planner"],
    temporal: {
      civilDate: "2026-11-17",
      patternYear: 2026,
      patternDay: 215,
      moon: 8,
      moonDay: 19,
      week: 31
    },
    payload: {},
    ...overrides
  };
}

function fakeScheduling(schedules = {}) {
  return {
    getSchedule(recordInput) {
      return schedules[recordInput.id] || null;
    },
    isCompleted(recordInput) {
      return schedules[recordInput.id]?.status === "completed";
    }
  };
}

function fakeCursor(coordinate, date) {
  const calls = [];

  return {
    calls,

    getState() {
      return {
        selectedDate: date,
        coordinate
      };
    },

    getDate() {
      return new Date(date.getTime());
    },

    getCoordinate() {
      return coordinate;
    },

    setPatternDay(patternDay, options) {
      calls.push(["setPatternDay", patternDay, options]);
      return { patternDay };
    },

    moveDays(days, options) {
      calls.push(["moveDays", days, options]);
      return { days };
    },

    today(options) {
      calls.push(["today", options]);
      return { today: true };
    }
  };
}

const COORDINATE = {
  gregorian: { isoDate: "2026-11-17" },
  remnant13Moons: {
    patternYear: 2026,
    patternDay: 215,
    moon: 8,
    moonName: "Observer",
    moonDay: 19,
    week: 31,
    isYearGate: false
  }
};

test(
  "day zoom selection comes from the canonical cursor coordinate",
  () => {
    const selection =
      api.selectionFromCoordinate(
        COORDINATE,
        new Date("2026-11-17T12:00:00Z")
      );

    assert.equal(selection.civilDate, "2026-11-17");
    assert.equal(selection.patternYear, 2026);
    assert.equal(selection.patternDay, 215);
    assert.equal(selection.moon, 8);
    assert.equal(selection.moonDay, 19);
    assert.equal(selection.week, 31);
    assert.equal(selection.moonName, "Observer");
    assert.equal(selection.isYearGate, false);
  }
);

test(
  "day zoom selection reads the cursor through its public API only",
  () => {
    const cursor =
      fakeCursor(
        COORDINATE,
        new Date("2026-11-17T12:00:00Z")
      );

    const selection =
      api.selectionFromCursor(cursor);

    assert.equal(selection.patternDay, 215);
    assert.equal(selection.civilDate, "2026-11-17");
    assert.equal(api.selectionFromCursor(null), null);
  }
);

test(
  "recordsForDay matches pattern year + pattern day like the calendar projection",
  () => {
    const selection =
      api.selectionFromCoordinate(COORDINATE);

    const matching =
      record({ id: "a" });

    const otherDay =
      record({
        id: "b",
        temporal: {
          civilDate: "2026-11-18",
          patternYear: 2026,
          patternDay: 216,
          moon: 8,
          moonDay: 20,
          week: 31
        }
      });

    const otherYear =
      record({
        id: "c",
        temporal: {
          civilDate: "2027-11-17",
          patternYear: 2027,
          patternDay: 215,
          moon: 8,
          moonDay: 19,
          week: 31
        }
      });

    const civilOnly =
      record({
        id: "d",
        temporal: { civilDate: "2026-11-17" }
      });

    const found =
      api.recordsForDay(
        [matching, otherDay, otherYear, civilOnly],
        selection
      );

    assert.deepEqual(
      found.map(item => item.id),
      ["a", "d"]
    );
  }
);

test(
  "buildDayView sorts all-day first, then by start time, and reports depth fields",
  () => {
    const selection =
      api.selectionFromCoordinate(COORDINATE);

    const scheduling = fakeScheduling({
      timed: {
        kind: "event",
        status: "planned",
        allDay: false,
        start: "2026-11-17T15:30:00.000Z",
        end: "2026-11-17T16:30:00.000Z"
      },
      early: {
        kind: "event",
        status: "planned",
        allDay: false,
        start: "2026-11-17T08:00:00.000Z",
        end: null
      },
      allday: {
        kind: "event",
        status: "planned",
        allDay: true,
        start: null,
        startDate: "2026-11-17"
      }
    });

    const view = api.buildDayView({
      selection,
      scheduling,
      records: [
        record({ id: "timed", title: "Afternoon work" }),
        record({ id: "allday", title: "All day observance" }),
        record({ id: "early", title: "Morning task" })
      ]
    });

    assert.equal(view.civilDate, "2026-11-17");
    assert.equal(view.patternDay, 215);
    assert.equal(view.moon, 8);
    assert.equal(view.moonDay, 19);
    assert.equal(view.count, 3);
    assert.equal(view.empty, false);

    assert.deepEqual(
      view.entries.map(entry => entry.id),
      ["allday", "early", "timed"]
    );

    assert.equal(view.entries[0].timeLabel, "All day");
    assert.notEqual(view.entries[1].timeLabel, "");
    assert.equal(view.entries[1].allDay, false);
  }
);

test(
  "buildDayView handles the honest empty state",
  () => {
    const selection =
      api.selectionFromCoordinate(COORDINATE);

    const view = api.buildDayView({
      selection,
      records: []
    });

    assert.equal(view.count, 0);
    assert.equal(view.empty, true);
    assert.deepEqual(view.entries, []);
    assert.match(view.emptyMessage, /No Life Atlas records for this day yet/);
  }
);

test(
  "buildDayView marks the Year Gate as outside the count instead of inventing a day",
  () => {
    const selection =
      api.selectionFromCoordinate({
        gregorian: { isoDate: "2027-04-17" },
        remnant13Moons: {
          patternYear: 2027,
          patternDay: null,
          moon: null,
          moonDay: null,
          week: null,
          isYearGate: true
        }
      });

    const view = api.buildDayView({
      selection,
      records: []
    });

    assert.equal(view.isYearGate, true);
    assert.equal(view.isOutsideCount, true);
    assert.equal(view.patternDay, null);
    assert.match(
      api.coordinateLine(view),
      /Year Gate/
    );
  }
);

test(
  "controller refresh follows the cursor and the planner data path",
  async () => {
    const cursor =
      fakeCursor(
        COORDINATE,
        new Date("2026-11-17T12:00:00Z")
      );

    const planner = {
      async plansForYear(year) {
        assert.equal(year, 2026);

        return [
          record({ id: "a", title: "On the day" }),
          record({
            id: "b",
            title: "Another day",
            temporal: {
              civilDate: "2026-11-18",
              patternYear: 2026,
              patternDay: 216,
              moon: 8,
              moonDay: 20,
              week: 31
            }
          })
        ];
      }
    };

    const rendered = [];

    const zoom = api.createDayZoom({
      cursor,
      planner,
      scheduling: fakeScheduling(),
      onRender(view, reason) {
        rendered.push([view, reason]);
      }
    });

    const result =
      await zoom.refresh("test");

    assert.equal(result.stale, false);
    assert.equal(result.view.count, 1);
    assert.equal(result.view.entries[0].title, "On the day");
    assert.equal(zoom.getLastView().patternDay, 215);
    assert.equal(rendered.length, 1);
    assert.equal(rendered[0][1], "test");
  }
);

test(
  "controller selection requests go through the canonical cursor only",
  () => {
    const cursor =
      fakeCursor(
        COORDINATE,
        new Date("2026-11-17T12:00:00Z")
      );

    const zoom = api.createDayZoom({
      cursor,
      planner: { async plansForYear() { return []; } }
    });

    zoom.selectPatternDay(92);
    zoom.moveDays(-1);
    zoom.goToday();

    assert.deepEqual(
      cursor.calls.map(call => call[0]),
      ["setPatternDay", "moveDays", "today"]
    );

    assert.equal(cursor.calls[0][1], 92);
    assert.equal(cursor.calls[0][2].source, "sphere-day-zoom");
    assert.equal(cursor.calls[1][1], -1);
  }
);

test(
  "controller start subscribes to canonical cursor events and stop unsubscribes",
  async () => {
    const cursor =
      fakeCursor(
        COORDINATE,
        new Date("2026-11-17T12:00:00Z")
      );

    const handlers = new Map();

    const eventTarget = {
      addEventListener(name, handler) {
        handlers.set(name, handler);
      },
      removeEventListener(name) {
        handlers.delete(name);
      }
    };

    const zoom = api.createDayZoom({
      cursor,
      eventTarget,
      planner: { async plansForYear() { return []; } }
    });

    assert.equal(zoom.start(), true);
    assert.equal(zoom.isListening(), true);
    assert.ok(handlers.has("sof:temporal-cursor-change"));
    assert.ok(handlers.has("sof:temporal-cursor-ready"));

    handlers.get("sof:temporal-cursor-change")({
      detail: { reason: "pattern-day-select" }
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    assert.equal(zoom.getLastView().patternDay, 215);

    assert.equal(zoom.stop(), true);
    assert.equal(handlers.size, 0);
  }
);

test(
  "sphere page loads the day zoom module and panel, driven by the cursor",
  () => {
    const page = fs.readFileSync(
      path.resolve(__dirname, "../docs/living-time-sphere.html"),
      "utf8"
    );

    assert.match(page, /living-time-sphere-day-zoom\.js/);
    assert.match(page, /id="sphere-day-zoom-panel"/);
    assert.match(page, /id="sphere-day-zoom-list"/);
    assert.match(page, /id="sphere-day-zoom-pattern-day"/);
  }
);

test(
  "day zoom module never writes its own temporal truth",
  () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        "../docs/assets/js/sphere/living-time-sphere-day-zoom.js"
      ),
      "utf8"
    );

    assert.doesNotMatch(source, /SOF_SELECTED_DATE\s*=/);
    assert.doesNotMatch(source, /SOF_SELECTED_INSTANT\s*=/);
    assert.match(source, /SOFTemporalCursor/);
    assert.match(source, /sof:temporal-cursor-change/);
  }
);
