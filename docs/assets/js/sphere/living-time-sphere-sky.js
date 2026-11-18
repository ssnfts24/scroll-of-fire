(() => {
  "use strict";

  /*
   * B7.61 — DATA-BOUND SKY.
   *
   * Every visual parameter of the sphere's environment layer is computed
   * here, in one pure function, from the live Open-Meteo snapshot held by
   * SofEnvironmentState — the same snapshot, with the same timestamp, that
   * the ENV strip renders. Nothing in the sky is decorative:
   *
   *   cloud bands   <- hourly cloud_cover_low / mid / high (fallback: total)
   *   precipitation <- current precipitation + WMO weather_code
   *                    (rain = fine streaked veil, snow = slow motes)
   *   light         <- current is_day + total cover
   *                    (clear day / overcast grey / night)
   *   drift speed   <- current wind_speed_10m
   *
   * No current snapshot (location unset, fetch failed) -> hasData is false
   * and callers must render the honest unset state: no invented weather.
   * The mapping is unit-tested (tests/living-sphere-b7-61-sky-data-binding)
   * so the binding is regression-locked, not hand-tuned per screenshot.
   */

  // WMO weather interpretation codes (Open-Meteo `weather_code`).
  const RAIN_CODES = Object.freeze([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
  const SNOW_CODES = Object.freeze([71, 73, 75, 77, 85, 86]);
  const RAIN_SET = new Set(RAIN_CODES);
  const SNOW_SET = new Set(SNOW_CODES);

  const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
  const num = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  function precipitationMode(weatherCode, precipitationMm) {
    const code = Number(weatherCode);
    if (SNOW_SET.has(code)) return "snow";
    if (RAIN_SET.has(code)) return "rain";
    return num(precipitationMm, 0) > 0.02 ? "rain" : "none";
  }

  // 0% cover -> absent; ~50% -> clearly visible soft band; 100% -> full
  // breathing overcast. The curve is monotonic so the sky can never
  // disagree with the number on the ENV strip.
  function bandOpacity(cover) {
    const c = clamp(num(cover, 0), 0, 100);
    return c <= 0 ? 0 : 0.1 + (c / 100) * 0.75;
  }

  // How many of a band's three sub-tori are lit: depth grows with cover.
  function bandDensity(cover) {
    const c = clamp(num(cover, 0), 0, 100);
    if (c <= 0) return 0;
    if (c < 34) return 1;
    if (c < 67) return 2;
    return 3;
  }

  // Wind drives the drift of the whole cloud shell: still air barely
  // moves, a gale sweeps. Radians per second around the sphere axis.
  function driftRadiansPerSecond(windKmh) {
    const w = Math.max(0, num(windKmh, 0));
    return 0.003 + Math.min(0.05, w * 0.0008);
  }

  function lightMode(isDay, totalCover) {
    if (isDay === false) return "night";
    if (isDay === true && totalCover >= 70) return "overcast";
    if (isDay === true) return "day";
    return "unknown";
  }

  // Palette: stone grey, teal shadow, gold rim — lit by the real condition.
  const LIGHT = Object.freeze({
    day: Object.freeze({ cloudColor: 0xe9f4f1, shellTint: 0x9fd8e8, glow: 1.0 }),
    overcast: Object.freeze({ cloudColor: 0xaebfc4, shellTint: 0x8fa5ad, glow: 0.55 }),
    night: Object.freeze({ cloudColor: 0x51677c, shellTint: 0x39506b, glow: 0.3 }),
    unknown: Object.freeze({ cloudColor: 0xd4edf0, shellTint: 0x7db4c1, glow: 0.7 }),
  });

  function _hourValue(hourly, key, fallback) {
    if (!hourly || typeof hourly !== "object") return fallback;
    const series = hourly[key];
    if (Array.isArray(series) && series.length) return num(series[0], fallback);
    return fallback;
  }

  function skyFromSnapshot(snapshot) {
    const current = snapshot?.current || null;
    if (!current) {
      return Object.freeze({
        hasData: false,
        bands: Object.freeze([]),
        totalCover: 0,
        veilOpacity: 0,
        precipitation: Object.freeze({ mode: "none", intensity: 0, mm: 0 }),
        light: Object.freeze({ mode: "unknown", isDay: null, ...LIGHT.unknown }),
        driftRadiansPerSecond: 0,
        windSpeedKmh: 0,
      });
    }

    const hourly = snapshot?.hourly || null;
    const total = clamp(num(current.cloudCover ?? current.cloud_cover, 0), 0, 100);
    const levels = ["low", "mid", "high"];
    const covers = [
      _hourValue(hourly, "cloud_cover_low", total),
      _hourValue(hourly, "cloud_cover_mid", total),
      _hourValue(hourly, "cloud_cover_high", total),
    ].map(value => clamp(value, 0, 100));

    const precipitationMm = Math.max(0, num(current.precipitation, 0));
    const mode = precipitationMode(current.weatherCode ?? current.weather_code, precipitationMm);
    const intensity = mode === "none" ? 0 : clamp(0.15 + precipitationMm / 5, 0, 1);

    const isDayRaw = current.isDay ?? current.is_day;
    const isDay = isDayRaw == null ? null : (isDayRaw === true || Number(isDayRaw) === 1);
    const light = lightMode(isDay, total);
    const wind = Math.max(0, num(current.windSpeed ?? current.wind_speed_10m, 0));

    return Object.freeze({
      hasData: true,
      bands: Object.freeze(covers.map((cover, index) => Object.freeze({
        level: levels[index],
        cover,
        opacity: bandOpacity(cover),
        density: bandDensity(cover),
      }))),
      totalCover: total,
      // A grey veil only gathers once cover is genuinely heavy; it is the
      // "depth" of an overcast, kept low enough that the calendar and the
      // gold marker stay readable through it.
      veilOpacity: total <= 40 ? 0 : clamp((total - 40) / 60, 0, 1) * 0.32,
      precipitation: Object.freeze({ mode, intensity, mm: precipitationMm }),
      light: Object.freeze({ mode: light, isDay, ...LIGHT[light] }),
      driftRadiansPerSecond: driftRadiansPerSecond(wind),
      windSpeedKmh: wind,
    });
  }

  globalThis.LivingTimeSphereSky = Object.freeze({
    skyFromSnapshot,
    precipitationMode,
    bandOpacity,
    bandDensity,
    driftRadiansPerSecond,
    lightMode,
    RAIN_CODES,
    SNOW_CODES,
  });
})();
