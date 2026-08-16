const test =
  require('node:test');

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const vm =
  require('node:vm');

function load() {
  const events = [];

  const windowObject = {
    dispatchEvent(event) {
      events.push(event);
    },

    addEventListener() {}
  };

  const context = {
    console,
    Date,
    Intl,

    window:
      windowObject,

    globalThis:
      windowObject,

    CustomEvent:
      class CustomEvent {
        constructor(
          type,
          options = {}
        ) {
          this.type = type;
          this.detail =
            options.detail || {};
        }
      }
  };

  vm.createContext(context);

  for (
    const path of [
      'docs/assets/js/calendar/pattern-calendar-data.js',
      'docs/assets/js/calendar/temporal-coordinate-engine.js',
      'docs/assets/js/calendar/temporal-cursor-controller.js'
    ]
  ) {
    vm.runInContext(
      fs.readFileSync(
        path,
        'utf8'
      ),
      context
    );
  }

  return {
    context,
    events
  };
}

test(
  'temporal cursor maintains one selected instant',
  () => {
    const {
      context,
      events
    } = load();

    const cursor =
      context.window
        .SOFTemporalCursor;

    cursor.setDate(
      new Date(
        '2026-08-16T12:00:00'
      ),
      {
        source: 'test'
      }
    );

    let state =
      cursor.getState();

    assert.equal(
      state.coordinate
        .gregorian
        .isoDate,
      '2026-08-16'
    );

    assert.equal(
      state.coordinate
        .remnant13Moons
        .moon,
      5
    );

    assert.equal(
      state.coordinate
        .remnant13Moons
        .moonDay,
      10
    );

    cursor.moveDays(
      1,
      {
        source: 'test'
      }
    );

    state =
      cursor.getState();

    assert.equal(
      state.coordinate
        .gregorian
        .isoDate,
      '2026-08-17'
    );

    assert.equal(
      state.coordinate
        .remnant13Moons
        .moonDay,
      11
    );

    cursor.setMoonDay(
      6,
      1,
      {
        source: 'test'
      }
    );

    state =
      cursor.getState();

    assert.equal(
      state.coordinate
        .remnant13Moons
        .moon,
      6
    );

    assert.equal(
      state.coordinate
        .remnant13Moons
        .moonDay,
      1
    );

    assert.ok(
      events.some(
        event =>
          event.type ===
          'sof:temporal-cursor-change'
      )
    );
  }
);
