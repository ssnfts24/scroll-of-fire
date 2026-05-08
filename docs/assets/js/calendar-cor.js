(function () {
  "use strict";

  const DAY = 86400000;

  const CONFIG = {
    yearStartMonth: 4,
    yearStartDay: 1,
    skipLeapDay: true,
    skipDayOutOfTime: true,
    dayOutOfTimeMonth: 3,
    dayOutOfTimeDay: 31
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

  const TONES = [
    "Magnetic", "Lunar", "Electric", "Self-Existing", "Overtone",
    "Rhythmic", "Resonant", "Galactic", "Solar", "Planetary",
    "Spectral", "Crystal", "Cosmic"
  ];

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function getTZ() {
    const q = new URLSearchParams(location.search);
    return q.get("tz") || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
  }

  function wallDateFromISO(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  }

  function todayISO(tz = getTZ()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date()).reduce((a, p) => {
      a[p.type] = p.value;
      return a;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function isLeapYear(y) {
    return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  }

  function yearStartFor(date) {
    const y = date.getUTCFullYear();
    const start = new Date(Date.UTC(y, CONFIG.yearStartMonth - 1, CONFIG.yearStartDay, 12));
    return date < start
      ? new Date(Date.UTC(y - 1, CONFIG.yearStartMonth - 1, CONFIG.yearStartDay, 12))
      : start;
  }

  function countSkippedDays(start, date) {
    let skipped = 0;

    for (let y = start.getUTCFullYear(); y <= date.getUTCFullYear(); y++) {
      if (CONFIG.skipLeapDay && isLeapYear(y)) {
        const leap = new Date(Date.UTC(y, 1, 29, 12));
        if (leap >= start && leap <= date) skipped++;
      }

      if (CONFIG.skipDayOutOfTime) {
        const doot = new Date(Date.UTC(y, CONFIG.dayOutOfTimeMonth - 1, CONFIG.dayOutOfTimeDay, 12));
        if (doot >= start && doot <= date) skipped++;
      }
    }

    return skipped;
  }

  function isDayOutOfTime(date) {
    return (
      date.getUTCMonth() + 1 === CONFIG.dayOutOfTimeMonth &&
      date.getUTCDate() === CONFIG.dayOutOfTimeDay
    );
  }

  function get13Moon(inputISO, tz = getTZ()) {
    const iso = inputISO || todayISO(tz);
    const date = wallDateFromISO(iso);
    const start = yearStart
