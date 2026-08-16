(function () {
  'use strict';

  const VERSION = '2.0.0';

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April',
    'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'
  ];

  const WEEKDAY_NAMES = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday',
    'Thursday', 'Friday', 'Saturday'
  ];

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function validDate(value) {
    return value instanceof Date && !Number.isNaN(value.getTime());
  }

  function cloneDate(value) {
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    return validDate(date) ? date : null;
  }

  function isLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  function daysInYear(year) {
    return isLeapYear(year) ? 366 : 365;
  }

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const current = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    return Math.floor((current - start) / 86400000);
  }

  function getISOWeek(date) {
    const target = new Date(
      Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      )
    );

    const dayNumber = target.getUTCDay() || 7;

    target.setUTCDate(
      target.getUTCDate() + 4 - dayNumber
    );

    const isoYear = target.getUTCFullYear();
    const yearStart = new Date(Date.UTC(isoYear, 0, 1));

    const week = Math.ceil(
      (((target - yearStart) / 86400000) + 1) / 7
    );

    return {
      year: isoYear,
      week,
      weekday: dayNumber,
      label: `${isoYear}-W${pad2(week)}-${dayNumber}`
    };
  }

  function getQuarter(date) {
    return Math.floor(date.getMonth() / 3) + 1;
  }

  function getSeason(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();

    /*
      Approximate meteorological/seasonal labeling.
      Precise astronomical season boundaries belong
      to the astronomy adapter, not the civil calendar.
    */

    if (
      (month === 3 && day >= 20) ||
      month === 4 ||
      month === 5 ||
      (month === 6 && day < 21)
    ) return 'Spring';

    if (
      (month === 6 && day >= 21) ||
      month === 7 ||
      month === 8 ||
      (month === 9 && day < 22)
    ) return 'Summer';

    if (
      (month === 9 && day >= 22) ||
      month === 10 ||
      month === 11 ||
      (month === 12 && day < 21)
    ) return 'Autumn';

    return 'Winter';
  }

  function gregorianFromDate(input) {
    const date = cloneDate(input);

    if (!date) {
      return null;
    }

    const year = date.getFullYear();
    const monthIndex = date.getMonth();
    const month = monthIndex + 1;
    const day = date.getDate();

    const dayOfYear = getDayOfYear(date);
    const totalDays = daysInYear(year);
    const isoWeek = getISOWeek(date);
    const quarter = getQuarter(date);

    return {
      calendar: 'gregorian',

      isoDate: [
        year,
        pad2(month),
        pad2(day)
      ].join('-'),

      year,
      month,
      monthIndex,
      monthName: MONTH_NAMES[monthIndex],
      monthShort: MONTH_NAMES[monthIndex].slice(0, 3),
      day,

      weekday: date.getDay(),
      weekdayName: WEEKDAY_NAMES[date.getDay()],
      weekdayShort: WEEKDAY_NAMES[date.getDay()].slice(0, 3),

      dayOfYear,
      daysInYear: totalDays,
      daysRemainingInYear: totalDays - dayOfYear,

      dayOfMonth: day,
      daysInMonth: daysInMonth(year, month),

      quarter,
      quarterLabel: `Q${quarter}`,

      isoWeek,
      isoWeekNumber: isoWeek.week,
      isoWeekYear: isoWeek.year,

      leapYear: isLeapYear(year),

      seasonApprox: getSeason(date),

      progress: {
        year: dayOfYear / totalDays,
        month: day / daysInMonth(year, month),
        quarter:
          (
            monthIndex % 3 +
            (day - 1) / daysInMonth(year, month)
          ) / 3
      },

      labels: {
        full: `${WEEKDAY_NAMES[date.getDay()]}, ${MONTH_NAMES[monthIndex]} ${day}, ${year}`,
        compact: `${MONTH_NAMES[monthIndex].slice(0, 3)} ${day}, ${year}`,
        numeric: `${month}/${day}/${year}`,
        iso: `${year}-${pad2(month)}-${pad2(day)}`,
        dayOfYear: `Day ${dayOfYear}/${totalDays}`,
        week: `ISO Week ${isoWeek.week}`,
        quarter: `Q${quarter} ${year}`
      }
    };
  }

  function buildTemporalCoordinate(input, options = {}) {
    const date =
      input instanceof Date
        ? cloneDate(input)
        : cloneDate(input || Date.now());

    if (!date) {
      return null;
    }

    const gregorian = gregorianFromDate(date);

    return {
      version: VERSION,

      timestamp: date.getTime(),
      instantISO: date.toISOString(),

      timezone:
        options.timezone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        'UTC',

      boundary: options.boundary || 'midnight',

      gregorian,

      adapters: {
        remnant13Moons: null,
        astronomy: null,
        environment: null,
        julianDay: null,
        hebrew: null,
        islamic: null
      }
    };
  }

  window.SOFTemporalCoordinate = {
    version: VERSION,

    constants: {
      MONTH_NAMES: [...MONTH_NAMES],
      WEEKDAY_NAMES: [...WEEKDAY_NAMES]
    },

    isLeapYear,
    daysInYear,
    daysInMonth,
    getDayOfYear,
    getISOWeek,
    getQuarter,
    getSeason,

    gregorianFromDate,
    buildTemporalCoordinate
  };

  window.dispatchEvent(
    new CustomEvent('sof:temporal-engine-ready', {
      detail: {
        version: VERSION
      }
    })
  );
})();

/* ===== Remnant 13 Moons bridge ===== */
(function () {
  'use strict';

  if (!window.SOFTemporalCoordinate) return;

  function getPatternCalendarData() {
    const registry =
      globalThis.PatternCalendarData ||
      window.PatternCalendarData ||
      null;

    if (!registry || !Array.isArray(registry.moons)) {
      return null;
    }

    return registry;
  }

  function getMoonRecord(moon) {
    const registry = getPatternCalendarData();

    if (
      !registry ||
      !Number.isInteger(Number(moon)) ||
      Number(moon) < 1
    ) {
      return null;
    }

    const moonNumber = Number(moon);

    return (
      registry.moons.find(
        entry => Number(entry?.idx) === moonNumber
      ) ||
      registry.moons[moonNumber - 1] ||
      null
    );
  }

  function getMoonName(moon) {
    const record = getMoonRecord(moon);

    return record?.name || `Moon ${moon}`;
  }

  function getMoonCount() {
    const count = getPatternCalendarData()?.moons?.length;

    return Number.isInteger(count) && count > 0
      ? count
      : 13;
  }

  const DEFAULT_ANCHOR = {
    year: 2026,
    month: 4,
    day: 17
  };

  function atLocalNoon(year, month, day) {
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  function normalizeDate(input) {
    const date =
      input instanceof Date
        ? new Date(input.getTime())
        : new Date(input);

    if (Number.isNaN(date.getTime())) return null;

    return atLocalNoon(
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate()
    );
  }

  function daysBetween(a, b) {
    const utcA = Date.UTC(
      a.getFullYear(),
      a.getMonth(),
      a.getDate()
    );

    const utcB = Date.UTC(
      b.getFullYear(),
      b.getMonth(),
      b.getDate()
    );

    return Math.round((utcB - utcA) / 86400000);
  }

  function positiveModulo(value, modulus) {
    return ((value % modulus) + modulus) % modulus;
  }

  function remnant13MoonsFromDate(input, options = {}) {
    const date = normalizeDate(input);

    if (!date) return null;

    const anchorConfig = options.anchor || DEFAULT_ANCHOR;

    const anchor = atLocalNoon(
      anchorConfig.year,
      anchorConfig.month,
      anchorConfig.day
    );

    const offset = daysBetween(anchor, date);

    const yearIndex = Math.floor(offset / 365);
    const dayWithinCycle = positiveModulo(offset, 365);

    const patternDay =
      dayWithinCycle < 364
        ? dayWithinCycle + 1
        : null;

    const isYearGate = dayWithinCycle === 364;

    const moon =
      patternDay !== null
        ? Math.floor((patternDay - 1) / 28) + 1
        : null;

    const moonDay =
      patternDay !== null
        ? positiveModulo(patternDay - 1, 28) + 1
        : null;

    const week =
      moonDay !== null
        ? Math.floor((moonDay - 1) / 7) + 1
        : null;

    const weekdayWithinPattern =
      patternDay !== null
        ? positiveModulo(patternDay - 1, 7) + 1
        : null;

    const moonRecord =
      moon !== null
        ? getMoonRecord(moon)
        : null;

    const moonName =
      moon !== null
        ? getMoonName(moon)
        : 'Year Gate';

    return {
      calendar: 'remnant-13-moons',

      anchor: {
        isoDate: `${anchorConfig.year}-${String(anchorConfig.month).padStart(2, '0')}-${String(anchorConfig.day).padStart(2, '0')}`,
        year: anchorConfig.year,
        month: anchorConfig.month,
        day: anchorConfig.day
      },

      cycleYearIndex: yearIndex,

      // The civil-alignment year containing this 13 × 28 cycle.
      // Anchor 2026 = Pattern Year 2026.
      patternYear:
        anchorConfig.year + yearIndex,

      offsetFromAnchorDays: offset,

      dayWithinCycle: dayWithinCycle + 1,

      patternDay,

      moon,
      moonName,
      moonDay,

      moonRecord: moonRecord
        ? {
            idx: moonRecord.idx,
            name: moonRecord.name,
            element: moonRecord.element || null,
            frequency: moonRecord.freq || null,
            essence: moonRecord.essence || null,
            practice: moonRecord.practice || null
          }
        : null,

      week,
      weekdayWithinPattern,

      isYearGate,

      isPatternDay: !isYearGate,

      progress: {
        cycle: (dayWithinCycle + 1) / 365,
        pattern:
          patternDay !== null
            ? patternDay / 364
            : 1,
        moon:
          moonDay !== null
            ? moonDay / 28
            : null
      },

      labels: {
        compact: isYearGate
          ? 'Year Gate'
          : `Moon ${moon} · Day ${moonDay}`,

        full: isYearGate
          ? 'Year Gate · Outside the 13 × 28 pattern'
          : `Moon ${moon} · ${moonName} · Day ${moonDay}/28 · Day ${patternDay}/364`,

        moon: isYearGate
          ? 'Year Gate'
          : `Moon ${moon} · ${moonName}`,

        patternDay: isYearGate
          ? 'Outside Day'
          : `Day ${patternDay}/364`,

        week: isYearGate
          ? 'Outside Week'
          : `Week ${week}`
      }
    };
  }

  const originalBuild =
    window.SOFTemporalCoordinate.buildTemporalCoordinate;

  window.SOFTemporalCoordinate.remnant13MoonsFromDate =
    remnant13MoonsFromDate;

  window.SOFTemporalCoordinate.getPatternCalendarData =
    getPatternCalendarData;

  window.SOFTemporalCoordinate.getMoonRecord =
    getMoonRecord;

  window.SOFTemporalCoordinate.buildTemporalCoordinate =
    function (input, options = {}) {
      const coordinate =
        originalBuild.call(
          window.SOFTemporalCoordinate,
          input,
          options
        );

      if (!coordinate) return null;

      coordinate.remnant13Moons =
        remnant13MoonsFromDate(
          new Date(coordinate.timestamp),
          options.remnant || {}
        );

      coordinate.adapters.remnant13Moons =
        coordinate.remnant13Moons;

      coordinate.labels = {
        gregorian:
          coordinate.gregorian?.labels?.full || '',

        remnant:
          coordinate.remnant13Moons?.labels?.full || '',

        paired:
          [
            coordinate.gregorian?.labels?.full,
            coordinate.remnant13Moons?.labels?.full
          ]
            .filter(Boolean)
            .join(' · ')
      };

      return coordinate;
    };

  window.dispatchEvent(
    new CustomEvent('sof:remnant-calendar-bridge-ready', {
      detail: {
        anchor: DEFAULT_ANCHOR,
        moons: getMoonCount()
      }
    })
  );
})();
