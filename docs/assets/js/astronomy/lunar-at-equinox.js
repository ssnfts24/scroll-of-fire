(() => {
  "use strict";

  const SYNODIC_MONTH = 29.530588853;
  const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);

  function moonAge(date) {
    const days = (date.getTime() - KNOWN_NEW_MOON) / 86400000;
    return ((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
  }

  function illuminationFromAge(age) {
    return (1 - Math.cos((2 * Math.PI * age) / SYNODIC_MONTH)) / 2;
  }

  function cyclePosition(age) {
    return age / SYNODIC_MONTH;
  }

  function phaseNameFromAge(age) {
    const position = cyclePosition(age);
    if (position < 0.0625 || position >= 0.9375) return "New Moon";
    if (position < 0.1875) return "Waxing Crescent";
    if (position < 0.3125) return "First Quarter";
    if (position < 0.4375) return "Waxing Gibbous";
    if (position < 0.5625) return "Full Moon";
    if (position < 0.6875) return "Waning Gibbous";
    if (position < 0.8125) return "Last Quarter";
    return "Waning Crescent";
  }

  function buildLayer(date) {
    const instant = date instanceof Date ? new Date(date) : new Date(date);
    const age = moonAge(instant);
    const illumination = illuminationFromAge(age);
    return {
      source: "approximate-synodic-phase",
      sourceVersion: "13-moons-synodic/1.0.0",
      status: "approximate",
      ageDays: Number(age.toFixed(6)),
      cyclePosition: Number(cyclePosition(age).toFixed(6)),
      illumination: Number(illumination.toFixed(6)),
      illuminationPercent: Number((illumination * 100).toFixed(1)),
      phaseName: phaseNameFromAge(age)
    };
  }

  globalThis.LunarAtEquinox = Object.freeze({
    SYNODIC_MONTH,
    moonAge,
    illuminationFromAge,
    cyclePosition,
    phaseNameFromAge,
    buildLayer
  });
})();
