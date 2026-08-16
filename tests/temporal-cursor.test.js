const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test(
  'temporal cursor maintains one selected instant',
  () => {
    const source = fs.readFileSync(
      'docs/assets/js/calendar/temporal-cursor-controller.js',
      'utf8'
    );

    const events = [];

    class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    }

    const listeners = {};

    const window = {
      addEventListener(type, callback) {
        listeners[type] ??= [];
        listeners[type].push(callback);
      },

      dispatchEvent(event) {
        events.push(event);

        for (
          const callback of
          listeners[event.type] || []
        ) {
          callback(event);
        }
      }
    };

    const context = {
      window,
      console,
      Date,
      CustomEvent,
      URLSearchParams,
      queueMicrotask,
      Intl,

      location: {
        search: ''
      }
    };

    vm.createContext(context);
    vm.runInContext(source, context);

    const cursor =
      window.SOFTemporalCursor;

    assert.ok(cursor);

    cursor.setDate(
      '2026-08-16T12:00:00'
    );

    const first =
      cursor.getDate();

    assert.equal(
      first.getFullYear(),
      2026
    );

    assert.equal(
      first.getMonth(),
      7
    );

    assert.equal(
      first.getDate(),
      16
    );

    cursor.shiftDays(1);

    const second =
      cursor.getDate();

    assert.equal(
      second.getDate(),
      17
    );

    cursor.setDate(
      '2026-04-17T12:00:00'
    );

    const state =
      cursor.getState();

    assert.equal(
      state.selectedDate.getFullYear(),
      2026
    );

    assert.equal(
      state.selectedDate.getMonth(),
      3
    );

    assert.equal(
      state.selectedDate.getDate(),
      17
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
