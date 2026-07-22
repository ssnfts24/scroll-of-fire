(function () {
  "use strict";

  const DAY = 86400000;
  const SYNODIC_MONTH = 29.530588853;
  const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);

  const DEFAULT_CONFIG = {
    dayBoundary: "sunset",
    fallbackSunset: "18:00"
  };

  const suppliedConfig = window.SOF_MOONS_CONFIG || {};
  const CONFIG = {
    ...DEFAULT_CONFIG,
    ...suppliedConfig
  };

  function getSharedMoons() {
    return Array.isArray(globalThis.PatternCalendarData?.moons)
      ? globalThis.PatternCalendarData.moons
      : [];
  }

  function assertPatternCalendar() {
    if (!globalThis.PatternCalendar) {
      throw new Error(
        "The shared Pattern Calendar engine is unavailable. Calendar calculation was stopped to prevent a conflicting result."
      );
    }
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function getTZ() {
    const params = new URLSearchParams(window.location.search);
    return (
      params.get("tz") ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "America/Los_Angeles"
    );
  }

  function formatParts(date, timeZone, options) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      ...options
    })
      .formatToParts(date)
      .reduce(function (result, part) {
        if (part.type !== "literal") {
          result[part.type] = part.value;
        }
        return result;
      }, {});
  }

  function parseClock(value) {
    const match = /^(\d{2}):(\d{2})$/.exec(String(value || ""));
    if (!match) return { hour: 18, minute: 0, minutes: 18 * 60 };

    const hour = Math.max(0, Math.min(23, Number(match[1])));
    const minute = Math.max(0, Math.min(59, Number(match[2])));
    return { hour: hour, minute: minute, minutes: hour * 60 + minute };
  }

  function wallDate(iso) {
    const values = String(iso || "").split("-").map(Number);
    if (values.length !== 3 || values.some(Number.isNaN)) return null;
    return new Date(Date.UTC(values[0], values[1] - 1, values[2], 12, 0, 0));
  }

  function addDays(date, amount) {
    return new Date(date.getTime() + amount * DAY);
  }

  function todayISO(tz) {
    const zone = tz || getTZ();
    const parts = formatParts(new Date(), zone, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    });

    const iso = [parts.year, parts.month, parts.day].join("-");
    const boundary = CONFIG.dayBoundary || "midnight";

    if (boundary === "midnight") {
      return iso;
    }

    const sunset = parseClock(CONFIG.fallbackSunset);
    const minutes = Number(parts.hour) * 60 + Number(parts.minute);

    if (minutes < sunset.minutes) {
      return iso;
    }

    const effective = addDays(wallDate(iso), 1);
    return [
      effective.getUTCFullYear(),
      pad(effective.getUTCMonth() + 1),
      pad(effective.getUTCDate())
    ].join("-");
  }

  function mapWithSharedCalendar(inputISO, tz) {
    assertPatternCalendar();

    const zone = tz || getTZ();
    const iso = inputISO || todayISO(zone);
    const mapped = globalThis.PatternCalendar.fromCivilDate({
      date: iso,
      timeZone: zone,
      boundaryMode: CONFIG.dayBoundary === "midnight" ? "midnight" : "sunset",
      sunsetTime: CONFIG.fallbackSunset
    });

    const inside = Boolean(mapped.insideCountedYear);
    if (!inside) {
      const label = mapped.isDeepTimeDay ? "Deep Time Day" : "Day Out of Time";
      return {
        iso,
        tz: zone,
        isDayOutOfTime: true,
        label,
        moon: null,
        moonName: label,
        moonEssence: "Outside the counted 13-moon cycle",
        day: null,
        week: null,
        tone: null,
        toneName: "Outside Count",
        dayIndex: 364 + Math.max(0, Number(mapped.intercalaryIndex || 1) - 1),
        year: mapped.patternYear,
        source: "PatternCalendar"
      };
    }

    const tone = ((mapped.dayOfPatternYear - 1) % 13) + 1;
    const sharedMoon = getSharedMoons()[mapped.moon - 1] || {};

    return {
      iso,
      tz: zone,
      isDayOutOfTime: false,
      moon: mapped.moon,
      moonName: mapped.moonName,
      moonEssence: sharedMoon.essence || "",
      day: mapped.day,
      week: mapped.weekOfMoon,
      tone,
      toneName: `Tone ${tone}`,
      dayIndex: mapped.dayOfPatternYear - 1,
      year: mapped.patternYear,
      label: `${mapped.moonName} Moon · Day ${mapped.day} · Tone ${tone}`,
      source: "PatternCalendar"
    };
  }

  function get13Moon(inputISO, tz) {
    return mapWithSharedCalendar(inputISO, tz);
  }

  function moonAge(input) {
    const date = input instanceof Date ? input : wallDate(input || todayISO(getTZ()));
    if (!date) return 0;
    const time = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      12,
      0,
      0
    );
    const days = (time - KNOWN_NEW_MOON) / DAY;
    return ((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
  }

  function illumination(age) {
    const safeAge = typeof age === "number" ? age : moonAge(age);
    return (1 - Math.cos((safeAge / SYNODIC_MONTH) * Math.PI * 2)) / 2;
  }

  function phaseName(age) {
    const safeAge = typeof age === "number" ? age : moonAge(age);

    if (safeAge < 1.2 || safeAge > 28.3) return "New Moon";
    if (safeAge < 6.4) return "Waxing Crescent";
    if (safeAge < 8.4) return "First Quarter";
    if (safeAge < 13.8) return "Waxing Gibbous";
    if (safeAge < 16.2) return "Full Moon";
    if (safeAge < 21.6) return "Waning Gibbous";
    if (safeAge < 23.6) return "Last Quarter";
    return "Waning Crescent";
  }

  function getMoonPhase(input) {
    const age = moonAge(input);
    return {
      age,
      name: phaseName(age),
      illumination: illumination(age)
    };
  }

  function formatLocalTime(date) {
    return new Intl.DateTimeFormat([], {
      hour: "numeric",
      minute: "2-digit"
    }).format(date || new Date());
  }

  function formatLocalDate(date) {
    return new Intl.DateTimeFormat([], {
      weekday: "long",
      month: "long",
      day: "numeric"
    }).format(date || new Date());
  }

  function daypart(date) {
    const current = date || new Date();
    const hour = current.getHours();

    if (hour >= 5 && hour < 10) return "Dawn";
    if (hour >= 10 && hour < 17) return "Day";
    if (hour >= 17 && hour < 21) return "Dusk";
    return "Night";
  }

  window.SOFCalendar = {
    CONFIG,
    MOONS: getSharedMoons(),
    TONES: Object.freeze(Array.from({ length: 13 }, (_, idx) => ({ number: idx + 1, name: `Tone ${idx + 1}` }))),
    getTZ,
    todayISO,
    get13Moon,
    moonAge,
    illumination,
    phaseName,
    getMoonPhase,
    formatLocalTime,
    formatLocalDate,
    daypart,
    wallDate,
    pad
  };
})();
