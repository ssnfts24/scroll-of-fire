(function () {
  "use strict";

  const DAY = 86400000;
  const SYNODIC_MONTH = 29.530588853;
  const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);

  const DEFAULT_CONFIG = {
    dayBoundary: "sunset",
    fallbackSunset: "18:00",
    anchorOverrides: {
      2026: "2026-04-17"
    }
  };

  const suppliedConfig = window.SOF_MOONS_CONFIG || {};
  const CONFIG = {
    ...DEFAULT_CONFIG,
    ...suppliedConfig,
    anchorOverrides: {
      ...DEFAULT_CONFIG.anchorOverrides,
      ...(suppliedConfig.anchorOverrides || {})
    }
  };

  const SHARED_MOONS = Array.isArray(globalThis.PatternCalendarData?.moons)
    ? globalThis.PatternCalendarData.moons
    : [];

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

  function wallDate(iso) {
    const values = String(iso || "").split("-").map(Number);
    if (values.length !== 3 || values.some(Number.isNaN)) return null;
    return new Date(Date.UTC(values[0], values[1] - 1, values[2], 12, 0, 0));
  }

  function addDays(date, amount) {
    return new Date(date.getTime() + amount * DAY);
  }

  function parseClock(value) {
    const match = /^(\d{2}):(\d{2})$/.exec(String(value || ""));
    if (!match) return { hour: 18, minute: 0, minutes: 18 * 60 };

    const hour = Math.max(0, Math.min(23, Number(match[1])));
    const minute = Math.max(0, Math.min(59, Number(match[2])));
    return { hour: hour, minute: minute, minutes: hour * 60 + minute };
  }

  function dayDiff(a, b) {
    return Math.floor((a.getTime() - b.getTime()) / DAY);
  }

  function nearestNewMoonAfter(date) {
    let cursor = new Date(date);

    for (let index = 0; index < 40; index += 1) {
      const age = moonAge(cursor);
      const nextAge = moonAge(addDays(cursor, 1));

      if (age > 28.5 || nextAge < age) {
        return addDays(cursor, 1);
      }

      cursor = addDays(cursor, 1);
    }

    return cursor;
  }

  function anchorForYear(year) {
    const override = wallDate(CONFIG.anchorOverrides[year]);
    return override || nearestNewMoonAfter(new Date(Date.UTC(year, 2, 20, 12, 0, 0)));
  }

  function yearAnchorFor(date) {
    const year = date.getUTCFullYear();
    const candidate = anchorForYear(year);
    return date < candidate ? anchorForYear(year - 1) : candidate;
  }

  function mapWithSharedCalendar(inputISO, tz) {
    if (!globalThis.PatternCalendar) return null;
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
        iso: iso,
        tz: zone,
        isDayOutOfTime: true,
        label: label,
        moon: null,
        moonName: label,
        moonEssence: "Outside the counted 13-moon cycle",
        day: null,
        week: null,
        tone: null,
        toneName: "Outside Count",
        dayIndex: 364 + Math.max(0, Number(mapped.intercalaryIndex || 1) - 1),
        year: mapped.patternYear
      };
    }
    const moonMeta = SHARED_MOONS[mapped.moon - 1] || { name: mapped.moonName, essence: "" };
    return {
      iso: iso,
      tz: zone,
      isDayOutOfTime: false,
      moon: mapped.moon,
      moonName: mapped.moonName,
      moonEssence: moonMeta.essence || "",
      day: mapped.day,
      week: mapped.weekOfMoon,
      tone: ((mapped.dayOfPatternYear - 1) % 13) + 1,
      toneName: mapped.moonName,
      dayIndex: mapped.dayOfPatternYear - 1,
      year: mapped.patternYear,
      label: `${mapped.moonName} Moon · Day ${mapped.day} · Tone ${((mapped.dayOfPatternYear - 1) % 13) + 1}`
    };
  }

  function get13Moon(inputISO, tz) {
    const shared = mapWithSharedCalendar(inputISO, tz);
    if (shared) return shared;

    const zone = tz || getTZ();
    const iso = inputISO || todayISO(zone);
    const date = wallDate(iso);

    if (!date) return null;

    const anchor = yearAnchorFor(date);
    const dayIndex = dayDiff(date, anchor);
    const inside = dayIndex >= 0 && dayIndex < 13 * 28;

    if (!inside) {
      return {
        iso: iso,
        tz: zone,
        isDayOutOfTime: true,
        label: "Outside Count",
        moon: null,
        moonName: "Outside Count",
        moonEssence: "Outside the counted 13-moon cycle",
        day: null,
        week: null,
        tone: null,
        toneName: "Outside Count",
        dayIndex: dayIndex,
        year: anchor.getUTCFullYear() + "/" + (anchor.getUTCFullYear() + 1)
      };
    }

    const moon = Math.floor(dayIndex / 28) + 1;
    const day = (dayIndex % 28) + 1;
    const week = Math.floor((day - 1) / 7) + 1;
    const tone = (dayIndex % 13) + 1;

    return {
      iso: iso,
      tz: zone,
      isDayOutOfTime: false,
      moon: moon,
      moonName: SHARED_MOONS[moon - 1]?.name || "Legacy Moon",
      moonEssence: SHARED_MOONS[moon - 1]?.essence || "",
      day: day,
      week: week,
      tone: tone,
      toneName: SHARED_MOONS[tone - 1]?.name || "Legacy Tone",
      dayIndex: dayIndex,
      year: anchor.getUTCFullYear() + "/" + (anchor.getUTCFullYear() + 1),
      label: (SHARED_MOONS[moon - 1]?.name || "Legacy Moon") + " Moon · Day " + day + " · Tone " + tone
    };
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
      age: age,
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
    CONFIG: CONFIG,
    MOONS: MOONS,
    TONES: TONES,
    getTZ: getTZ,
    todayISO: todayISO,
    get13Moon: get13Moon,
    moonAge: moonAge,
    illumination: illumination,
    phaseName: phaseName,
    getMoonPhase: getMoonPhase,
    formatLocalTime: formatLocalTime,
    formatLocalDate: formatLocalDate,
    daypart: daypart,
    wallDate: wallDate,
    pad: pad
  };
})();
