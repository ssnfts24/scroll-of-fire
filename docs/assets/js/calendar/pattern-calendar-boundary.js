(() => {
  "use strict";

  const DAY = 86400000;

  function datePartsInTimeZone(date, timeZone) {
    let parts;

    try {
      parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        weekday: "long",
        hour12: false
      }).formatToParts(date);
    } catch {
      parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        weekday: "long",
        hour12: false
      }).formatToParts(date);
    }

    const result = {};
    for (const part of parts) {
      if (part.type === "literal") continue;
      if (part.type === "weekday") {
        result.weekday = part.value;
        continue;
      }
      const numeric = Number(part.value);
      result[part.type] = (part.type === "hour" && numeric === 24) ? 0 : numeric;
    }

    return result;
  }

  function fromParts(parts) {
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
  }

  function addDays(date, amount) {
    return new Date(date.getTime() + amount * DAY);
  }

  function dayDiff(a, b) {
    const A = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
    const B = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
    return Math.floor((A - B) / DAY);
  }

  function weekdayIndexFromName(name) {
    const week = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const idx = week.indexOf(name);
    return idx >= 0 ? idx : 0;
  }

  function resolveBoundary({ now, timeZone, mode, sunsetTime }) {
    const parts = datePartsInTimeZone(now, timeZone);
    const civilDate = fromParts(parts);
    const clock = PatternCalendarFormat.parseClock(sunsetTime);
    const nowMinutes = parts.hour * 60 + parts.minute;
    const usesSunset = mode === "sunset" || mode === "manual";
    const afterBoundary = usesSunset && nowMinutes >= clock.minutes;
    const effectiveDate = afterBoundary ? addDays(civilDate, 1) : civilDate;

    return {
      civilDate,
      effectiveDate,
      civilWeekday: parts.weekday,
      civilWeekdayIndex: weekdayIndexFromName(parts.weekday),
      boundaryMode: mode,
      sunsetTime: clock.text,
      afterBoundary,
      timeZone
    };
  }

  globalThis.PatternCalendarBoundary = Object.freeze({
    DAY,
    datePartsInTimeZone,
    addDays,
    dayDiff,
    resolveBoundary,
    weekdayIndexFromName
  });
})();
