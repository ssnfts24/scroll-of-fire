(() => {
  "use strict";

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function toISODateKey(parts) {
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  }

  function parseClock(value, fallback = "18:00") {
    const raw = typeof value === "string" ? value : fallback;
    const match = /^(\d{2}):(\d{2})$/.exec(raw || "");
    if (!match) return parseClock(fallback, "18:00");

    const hour = Math.max(0, Math.min(23, Number(match[1])));
    const minute = Math.max(0, Math.min(59, Number(match[2])));

    return { hour, minute, minutes: hour * 60 + minute, text: `${pad(hour)}:${pad(minute)}` };
  }

  function coerceDate(input) {
    if (input instanceof Date) return new Date(input);

    if (typeof input === "string") {
      if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
        const [year, month, day] = input.split("-").map(Number);
        return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      }

      const parsed = new Date(input);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    if (typeof input === "number") {
      const parsed = new Date(input);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    return new Date();
  }

  globalThis.PatternCalendarFormat = Object.freeze({
    pad,
    toISODateKey,
    parseClock,
    coerceDate
  });
})();
