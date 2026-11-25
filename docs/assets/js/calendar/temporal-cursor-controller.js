(function () {
  'use strict';

  const VERSION = '1.0.0';

  const DAY_MS = 86400000;

  function validDate(value) {
    return (
      value instanceof Date &&
      !Number.isNaN(value.getTime())
    );
  }

  function normalizeDate(value) {
    const date =
      value instanceof Date
        ? new Date(value.getTime())
        : new Date(value);

    if (!validDate(date)) {
      return null;
    }

    return date;
  }

  function sameInstant(a, b) {
    return (
      validDate(a) &&
      validDate(b) &&
      a.getTime() === b.getTime()
    );
  }

  /*
   * The Intl fallback below is one of the slowest cheap-looking calls
   * in a browser, and the cursor resolves it on every step (it was
   * ~180 ms of the Nov 24 drag profile). The observatory value is
   * still read live on every call; only the Intl fallback is
   * memoized. The memo is dropped when the keeper returns to the
   * tab — the realistic moment a device timezone change (travel)
   * can have happened — so the next resolution re-reads the
   * environment. For an unchanged environment the resolved zone
   * cannot differ, so every caller sees the same answer.
   */
  let _intlTimezoneMemo = null;

  function getTimezone() {
    const observed = window.SOFObservatoryState?.timezone;
    if (observed) {
      return observed;
    }
    if (_intlTimezoneMemo) {
      return _intlTimezoneMemo;
    }
    _intlTimezoneMemo =
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      'UTC';
    return _intlTimezoneMemo;
  }

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        _intlTimezoneMemo = null;
      }
    });
  }

  function getBoundary() {
    return (
      window.SOFObservatoryState?.boundary ||
      'sunset'
    );
  }

  function buildCoordinate(date) {
    const engine = window.SOFTemporalCoordinate;

    if (!engine?.buildTemporalCoordinate) {
      return null;
    }

    return engine.buildTemporalCoordinate(
      date,
      {
        timezone: getTimezone(),
        boundary: getBoundary()
      }
    );
  }

  /*
   * Read-only Pattern position resolution through the canonical
   * pipeline (docs/development/TEMPORAL-AUTHORITY-CONTRACT.md).
   *
   * The cursor is the gateway projections use to convert an instant
   * into its PatternCalendar position, so no projection needs to call
   * PatternCalendar directly and become a second authority. This never
   * moves the selection, never mutates state, and never emits cursor
   * events — it only resolves the position for the instant given.
   */
  function resolvePosition(input, options = {}) {
    const date = normalizeDate(
      input || new Date()
    );

    if (!date) {
      return null;
    }

    const calendar = window.PatternCalendar;

    if (!calendar?.fromCivilDate) {
      return null;
    }

    try {
      return calendar.fromCivilDate({
        date,

        timeZone:
          options.timeZone ||
          getTimezone(),

        boundaryMode:
          options.boundaryMode ||
          options.boundary ||
          getBoundary(),

        sunsetTime:
          options.sunsetTime ||
          options.manualSunset ||
          '18:00'
      });
    } catch {
      return null;
    }
  }

  const state = {
    version: VERSION,

    selectedDate: new Date(),
    coordinate: null,

    source: 'initial',
    revision: 0,

    locked: false,

    history: []
  };

  function snapshot() {
    return {
      version: VERSION,

      selectedDate:
        new Date(state.selectedDate.getTime()),

      timestamp:
        state.selectedDate.getTime(),

      iso:
        state.selectedDate.toISOString(),

      coordinate:
        state.coordinate,

      source:
        state.source,

      revision:
        state.revision,

      timezone:
        getTimezone(),

      boundary:
        getBoundary()
    };
  }

  function emit(name, detail = {}) {
    window.dispatchEvent(
      new CustomEvent(name, {
        detail: {
          ...snapshot(),
          ...detail
        }
      })
    );
  }

  function updateGlobals() {
    window.SOF_SELECTED_DATE =
      new Date(state.selectedDate.getTime());

    window.SOF_SELECTED_INSTANT =
      state.selectedDate.toISOString();

    window.SOFCurrentTemporalCoordinate =
      state.coordinate;
  }

  function recordHistory() {
    const coordinate = state.coordinate;

    state.history.unshift({
      timestamp:
        state.selectedDate.getTime(),

      iso:
        state.selectedDate.toISOString(),

      source:
        state.source,

      revision:
        state.revision,

      gregorian:
        coordinate?.gregorian?.isoDate ||
        null,

      moon:
        coordinate?.remnant13Moons?.moon ||
        null,

      moonDay:
        coordinate?.remnant13Moons?.moonDay ||
        null,

      patternDay:
        coordinate?.remnant13Moons?.patternDay ||
        null
    });

    if (state.history.length > 50) {
      state.history.length = 50;
    }
  }

  function setDate(input, options = {}) {
    const date = normalizeDate(input);

    if (!date) {
      return null;
    }

    if (
      state.locked &&
      options.force !== true
    ) {
      return snapshot();
    }

    if (
      sameInstant(
        state.selectedDate,
        date
      ) &&
      options.force !== true
    ) {
      return snapshot();
    }

    state.selectedDate = date;

    state.coordinate =
      buildCoordinate(date);

    state.source =
      options.source ||
      'unknown';

    state.revision += 1;

    updateGlobals();
    recordHistory();

    if (options.silent !== true) {
      emit(
        'sof:temporal-cursor-change',
        {
          reason:
            options.reason ||
            'set-date'
        }
      );

      emit(
        'sof:selected-date-change',
        {
          reason:
            options.reason ||
            'set-date'
        }
      );
    }

    return snapshot();
  }

  function moveDays(days, options = {}) {
    const amount = Number(days);

    if (!Number.isFinite(amount)) {
      return snapshot();
    }

    const next =
      new Date(
        state.selectedDate.getTime()
      );

    next.setDate(
      next.getDate() + amount
    );

    return setDate(
      next,
      {
        ...options,
        reason:
          options.reason ||
          'move-days'
      }
    );
  }

  function moveWeeks(weeks, options = {}) {
    return moveDays(
      Number(weeks) * 7,
      {
        ...options,
        reason:
          options.reason ||
          'move-weeks'
      }
    );
  }

  function moveMoons(moons, options = {}) {
    return moveDays(
      Number(moons) * 28,
      {
        ...options,
        reason:
          options.reason ||
          'move-moons'
      }
    );
  }

  function moveYears(years, options = {}) {
    const amount = Number(years);

    if (!Number.isFinite(amount)) {
      return snapshot();
    }

    const next =
      new Date(
        state.selectedDate.getTime()
      );

    next.setFullYear(
      next.getFullYear() + amount
    );

    return setDate(
      next,
      {
        ...options,
        reason:
          options.reason ||
          'move-years'
      }
    );
  }

  function today(options = {}) {
    return setDate(
      new Date(),
      {
        ...options,
        source:
          options.source ||
          'today-button',

        reason:
          options.reason ||
          'today'
      }
    );
  }

  function setGregorianDate(
    year,
    month,
    day,
    options = {}
  ) {
    const date =
      new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        12,
        0,
        0,
        0
      );

    return setDate(
      date,
      {
        ...options,
        source:
          options.source ||
          'gregorian-calendar',

        reason:
          'gregorian-select'
      }
    );
  }

  function setPatternDay(
    patternDay,
    options = {}
  ) {
    const day =
      Number(patternDay);

    if (
      !Number.isInteger(day) ||
      day < 1 ||
      day > 364
    ) {
      return null;
    }

    const engine =
      window.SOFTemporalCoordinate;

    const current =
      state.coordinate ||
      buildCoordinate(
        state.selectedDate
      );

    const remnant =
      current?.remnant13Moons;

    if (!remnant) {
      return null;
    }

    const currentPatternDay =
      remnant.patternDay;

    if (currentPatternDay) {
      return moveDays(
        day - currentPatternDay,
        {
          ...options,
          source:
            options.source ||
            'pattern-calendar',

          reason:
            'pattern-day-select'
        }
      );
    }

    return null;
  }

  function setMoonDay(
    moon,
    moonDay,
    options = {}
  ) {
    const moonNumber =
      Number(moon);

    const dayNumber =
      Number(moonDay);

    if (
      !Number.isInteger(moonNumber) ||
      !Number.isInteger(dayNumber) ||
      moonNumber < 1 ||
      moonNumber > 13 ||
      dayNumber < 1 ||
      dayNumber > 28
    ) {
      return null;
    }

    const targetPatternDay =
      (moonNumber - 1) * 28 +
      dayNumber;

    return setPatternDay(
      targetPatternDay,
      {
        ...options,
        source:
          options.source ||
          '13-moons-calendar',

        reason:
          'moon-day-select'
      }
    );
  }

  function lock() {
    state.locked = true;

    emit(
      'sof:temporal-cursor-lock-change',
      {
        locked: true
      }
    );
  }

  function unlock() {
    state.locked = false;

    emit(
      'sof:temporal-cursor-lock-change',
      {
        locked: false
      }
    );
  }

  function handleExternalEvent(event) {
    const detail =
      event?.detail || {};

    if (
      detail.revision &&
      detail.revision === state.revision
    ) {
      return;
    }

    const candidates = [
      detail.date,
      detail.selectedDate,
      detail.instant,
      detail.iso,
      detail.isoDate,
      detail.timestamp
    ];

    for (const candidate of candidates) {
      if (
        candidate === undefined ||
        candidate === null
      ) {
        continue;
      }

      const date =
        normalizeDate(candidate);

      if (!date) {
        continue;
      }

      setDate(
        date,
        {
          source:
            event.type,

          reason:
            'external-event'
        }
      );

      break;
    }
  }

  [
    'sof:sphere-date-change',
    'sof:observatory-date-change',
    'sof:calendar-date-change'
  ].forEach(name => {
    window.addEventListener(
      name,
      handleExternalEvent
    );
  });

  window.addEventListener(
    'sof:temporal-engine-ready',
    () => {
      state.coordinate =
        buildCoordinate(
          state.selectedDate
        );

      updateGlobals();

      emit(
        'sof:temporal-cursor-ready'
      );
    }
  );

  window.SOFTemporalCursor = {
    version: VERSION,

    getState() {
      return snapshot();
    },

    getDate() {
      return new Date(
        state.selectedDate.getTime()
      );
    },

    getCoordinate() {
      return state.coordinate;
    },

    resolvePosition,

    getHistory() {
      return state.history.map(
        item => ({ ...item })
      );
    },

    setDate,
    today,

    moveDays,

    // Backward-compatible alias used by earlier cursor consumers.
    shiftDays: moveDays,

    moveWeeks,
    moveMoons,
    moveYears,

    setGregorianDate,
    setPatternDay,
    setMoonDay,

    lock,
    unlock,

    isLocked() {
      return state.locked;
    }
  };

  state.coordinate =
    buildCoordinate(
      state.selectedDate
    );

  updateGlobals();

  window.dispatchEvent(
    new CustomEvent(
      'sof:temporal-cursor-ready',
      {
        detail: snapshot()
      }
    )
  );
})();
