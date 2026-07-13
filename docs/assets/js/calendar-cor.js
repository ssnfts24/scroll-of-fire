(function () {
  "use strict";

  const DAY = 86400000;
  const SYNODIC_MONTH = 29.530588853;
  const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);

  const CONFIG = {
    yearStartMonth: 4,
    yearStartDay: 1,
    dayOutOfTimeMonth: 3,
    dayOutOfTimeDay: 31,
    skipLeapDay: true,
    skipDayOutOfTime: true
  };

  const MOONS = [
    ["Magnetic", "Unify · Purpose"],
    ["Lunar", "Polarize · Challenge"],
    ["Electric", "Activate · Service"],
    ["Self-Existing", "Define · Form"],
    ["Overtone", "Empower · Radiance"],
    ["Rhythmic", "Organize · Equality"],
    ["Resonant", "Channel · Attunement"],
    ["Galactic", "Harmonize · Integrity"],
    ["Solar", "Pulse · Intention"],
    ["Planetary", "Perfect · Manifestation"],
    ["Spectral", "Dissolve · Liberation"],
    ["Crystal", "Dedicate · Cooperation"],
    ["Cosmic", "Endure · Presence"]
  ];

  const TONES = MOONS.map(function (moon) {
    return moon[0];
  });

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
    const parts = formatParts(new Date(), tz || getTZ(), {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });

    return [parts.year, parts.month, parts.day].join("-");
  }

  function wallDate(iso) {
    const values = String(iso || "").split("-").map(Number);
    if (values.length !== 3 || values.some(Number.isNaN)) return null;
    return new Date(Date.UTC(values[0], values[1] - 1, values[2], 12, 0, 0));
  }

  function leap(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  function yearStartFor(date) {
    const year = date.getUTCFullYear();
    const start = new Date(
      Date.UTC(year, CONFIG.yearStartMonth - 1, CONFIG.yearStartDay, 12, 0, 0)
    );

    if (date < start) {
      return new Date(
        Date.UTC(year - 1, CONFIG.yearStartMonth - 1, CONFIG.yearStartDay, 12, 0, 0)
      );
    }

    return start;
  }

  function isDayOutOfTime(date) {
    return (
      date.getUTCMonth() + 1 === CONFIG.dayOutOfTimeMonth &&
      date.getUTCDate() === CONFIG.dayOutOfTimeDay
    );
  }

  function skippedDays(start, date) {
    let count = 0;

    for (let year = start.getUTCFullYear(); year <= date.getUTCFullYear(); year += 1) {
      if (CONFIG.skipLeapDay && leap(year)) {
        const leapDay = new Date(Date.UTC(year, 1, 29, 12, 0, 0));
        if (leapDay >= start && leapDay <= date) count += 1;
      }

      if (CONFIG.skipDayOutOfTime) {
        const doot = new Date(
          Date.UTC(year, CONFIG.dayOutOfTimeMonth - 1, CONFIG.dayOutOfTimeDay, 12, 0, 0)
        );
        if (doot >= start && doot <= date) count += 1;
      }
    }

    return count;
  }

  function get13Moon(inputISO, tz) {
    const zone = tz || getTZ();
    const iso = inputISO || todayISO(zone);
    const date = wallDate(iso);

    if (!date) return null;

    const start = yearStartFor(date);

    if (isDayOutOfTime(date)) {
      return {
        iso: iso,
        tz: zone,
        isDayOutOfTime: true,
        label: "Day Out of Time",
        moon: null,
        moonName: "Day Out of Time",
        moonEssence: "Pause · Witness · Reset",
        day: null,
        week: null,
        tone: null,
        toneName: "Pause",
        dayIndex: null,
        year: start.getUTCFullYear() + "/" + (start.getUTCFullYear() + 1)
      };
    }

    let index = Math.floor((date - start) / DAY) - skippedDays(start, date);
    index = Math.max(0, Math.min(363, index));

    const moon = Math.floor(index / 28) + 1;
    const day = (index % 28) + 1;
    const week = Math.floor((day - 1) / 7) + 1;
    const tone = (index % 13) + 1;

    return {
      iso: iso,
      tz: zone,
      isDayOutOfTime: false,
      moon: moon,
      moonName: MOONS[moon - 1][0],
      moonEssence: MOONS[moon - 1][1],
      day: day,
      week: week,
      tone: tone,
      toneName: TONES[tone - 1],
      dayIndex: index,
      year: start.getUTCFullYear() + "/" + (start.getUTCFullYear() + 1),
      label: MOONS[moon - 1][0] + " Moon · Day " + day + " · Tone " + tone
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
