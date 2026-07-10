(function () {
  "use strict";

  const DAY = 86400000;

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

  const TONES = MOONS.map(m => m[0]);

  function getTZ() {
    const q = new URLSearchParams(location.search);
    return q.get("tz") || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
  }

  function todayISO(tz = getTZ()) {
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date()).reduce((a, x) => (a[x.type] = x.value, a), {});
    return `${p.year}-${p.month}-${p.day}`;
  }

  function wallDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12));
  }

  function leap(y) {
    return y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  }

  function yearStartFor(date) {
    const y = date.getUTCFullYear();
    const start = new Date(Date.UTC(y, CONFIG.yearStartMonth - 1, CONFIG.yearStartDay, 12));
    return date < start ? new Date(Date.UTC(y - 1, 3, 1, 12)) : start;
  }

  function isDOOT(date) {
    return date.getUTCMonth() + 1 === CONFIG.dayOutOfTimeMonth &&
           date.getUTCDate() === CONFIG.dayOutOfTimeDay;
  }

  function skipped(start, date) {
    let n = 0;
    for (let y = start.getUTCFullYear(); y <= date.getUTCFullYear(); y++) {
      const feb29 = new Date(Date.UTC(y, 1, 29, 12));
      const doot = new Date(Date.UTC(y, 2, 31, 12));
      if (CONFIG.skipLeapDay && leap(y) && feb29 >= start && feb29 <= date) n++;
      if (CONFIG.skipDayOutOfTime && doot >= start && doot <= date) n++;
    }
    return n;
  }

  function get13Moon(inputISO, tz = getTZ()) {
    const iso = inputISO || todayISO(tz);
    const date = wallDate(iso);
    const start = yearStartFor(date);

    if (isDOOT(date)) {
      return {
        iso, tz, isDayOutOfTime: true,
        label: "Day Out of Time",
        moon: null, day: null, week: null,
        tone: null, toneName: "Pause",
        year: `${start.getUTCFullYear()}/${start.getUTCFullYear() + 1}`
      };
    }

    let idx = Math.floor((date - start) / DAY) - skipped(start, date);
    idx = Math.max(0, Math.min(363, idx));

    const moon = Math.floor(idx / 28) + 1;
    const day = (idx % 28) + 1;
    const week = Math.floor((day - 1) / 7) + 1;
    const tone = (idx % 13) + 1;

    return {
      iso, tz,
      isDayOutOfTime: false,
      moon,
      moonName: MOONS[moon - 1][0],
      moonEssence: MOONS[moon - 1][1],
      day,
      week,
      tone,
      toneName: TONES[tone - 1],
      dayIndex: idx,
      year: `${start.getUTCFullYear()}/${start.getUTCFullYear() + 1}`,
      label: `${MOONS[moon - 1][0]} Moon · Day ${day} · Tone ${tone}`
    };
  }

  window.SOFCalendar = { CONFIG, MOONS, TONES, getTZ, todayISO, get13Moon };
})();
