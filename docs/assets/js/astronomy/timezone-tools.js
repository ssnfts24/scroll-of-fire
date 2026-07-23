(() => {
  "use strict";

  function pad(value, width = 2) {
    return String(value).padStart(width, "0");
  }

  function safeTimeZone(timeZone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
      return timeZone;
    } catch {
      return "UTC";
    }
  }

  function formatParts(date, timeZone) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: safeTimeZone(timeZone),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(date);

    const output = {};
    for (const part of parts) {
      if (part.type === "literal") continue;
      const numeric = Number(part.value);
      output[part.type] = part.type === "hour" && numeric === 24 ? 0 : numeric;
    }
    return output;
  }

  function localIsoFromInstant(date, timeZone) {
    const parts = formatParts(date, timeZone);
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
  }

  function localDateKey(date, timeZone) {
    const parts = formatParts(date, timeZone);
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  }

  function displayLabel(date, timeZone, options = {}) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: safeTimeZone(timeZone),
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: options.dateOnly ? undefined : "numeric",
      minute: options.dateOnly ? undefined : "2-digit",
      second: options.includeSeconds ? "2-digit" : undefined,
      hour12: options.dateOnly ? undefined : true,
      timeZoneName: options.dateOnly ? undefined : "short"
    }).format(date);
  }

  function offsetMs(date, timeZone) {
    const parts = formatParts(date, timeZone);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return asUtc - date.getTime();
  }

  function zonedDateTimeToUtc(parts, timeZone) {
    const zone = safeTimeZone(timeZone);
    const target = {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour || 0),
      minute: Number(parts.minute || 0),
      second: Number(parts.second || 0),
      millisecond: Number(parts.millisecond || 0)
    };

    let guess = Date.UTC(
      target.year,
      target.month - 1,
      target.day,
      target.hour,
      target.minute,
      target.second,
      target.millisecond
    );

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const offset = offsetMs(new Date(guess), zone);
      const next = Date.UTC(
        target.year,
        target.month - 1,
        target.day,
        target.hour,
        target.minute,
        target.second,
        target.millisecond
      ) - offset;
      if (Math.abs(next - guess) < 1) {
        guess = next;
        break;
      }
      guess = next;
    }

    return new Date(guess);
  }

  function startOfPatternYearUtc(year, timeZone, boundaryMode, sunsetTime = "18:00") {
    const zone = safeTimeZone(timeZone);
    if (boundaryMode === "midnight") {
      return zonedDateTimeToUtc({ year, month: 4, day: 17, hour: 0, minute: 0, second: 0 }, zone);
    }

    const clock = globalThis.PatternCalendarFormat?.parseClock
      ? globalThis.PatternCalendarFormat.parseClock(sunsetTime)
      : { hour: 18, minute: 0 };
    return zonedDateTimeToUtc({
      year,
      month: 4,
      day: 16,
      hour: clock.hour,
      minute: clock.minute,
      second: 0
    }, zone);
  }

  globalThis.TimeZoneTools = Object.freeze({
    pad,
    safeTimeZone,
    formatParts,
    localIsoFromInstant,
    localDateKey,
    displayLabel,
    offsetMs,
    zonedDateTimeToUtc,
    startOfPatternYearUtc
  });
})();
