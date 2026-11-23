/*
 * CodexSkyEngine — the sky, computed on this device.
 *
 * Aaron's order (Nov 23, 2026): "Get the stars and astronomy on
 * there" — and his standing rule for the face: real values or one
 * plain honest line; never fake data. This module is the real-math
 * class the calendar gap map (Gap 1) asked for: pure functions of
 * a moment and a place, no network, nothing fetched at runtime.
 * It sits in the presentation/data layer beside the calendar; it
 * never touches the calendar core or any R1.7 protected file.
 *
 * What it computes, and the class of each answer:
 *   - Sun position: Meeus low-precision solar coordinates
 *     (Astronomical Algorithms, ch. 25) — about 0.01 degrees.
 *   - Sunrise / sunset / solar noon / daylight: hour-angle method
 *     on the computed declination, iterated at the event instants —
 *     about ±1–2 minutes at temperate latitudes (the NOAA solar
 *     calculator's class).
 *   - Moon position: Schlyter's lunar elements with the principal
 *     perturbation terms — within about a degree; phase instants
 *     to about ±3 hours and illumination within about a percent
 *     (the measured classes, pinned in the tests).
 *   - Moonrise / moonset: the computed Moon's altitude walked
 *     across the local day, topocentrically corrected — about
 *     ±10 minutes.
 *   - Planets: Schlyter's low-precision orbital elements (the same
 *     published source family the Sphere's existing planetary
 *     module labels "low-precision-orbital-elements") —
 *     arcminute-class for Venus/Jupiter in this era, coarser for
 *     Mercury (up to about a degree). Labelled, never hidden.
 *   - Stars: the real catalog in bright-stars.js (Astronomical
 *     Almanac Bright Star List, epoch 2016.5, from the Yale Bright
 *     Star Catalogue), precessed from 2016.5 to the moment and
 *     placed by local sidereal time — arcminute-class for this
 *     decade; proper motion ignored (stated, below the class).
 *   - Season turns: root-found crossings of the Sun's apparent
 *     ecliptic longitude through 0/90/180/270 degrees, any year.
 *
 * Every returned value carries its source class in the result
 * ("computed" for the math, "catalog" for star identities) so a
 * surface can label what it shows, per the house label law.
 *
 * Inputs: a Date (a UTC instant), latitude/longitude in degrees
 * (east positive), and — for civil-day questions — the keeper's
 * timezone offset in minutes EAST of UTC (PDT = -420, PST = -480).
 * No place, no sky: callers must not invent a place, and this
 * module never defaults one.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.CodexSkyEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "codex-sky-engine/1.0.0";
  const DEG = Math.PI / 180;
  const RAD = 180 / Math.PI;
  const J2000 = 2451545.0;
  // Schlyter's elements count days from 2000 Jan 0.0 (JD 2451543.5),
  // not from J2000.0 — the same convention the Sphere's existing
  // planetary module uses. Mixing the two shifts the Moon by a day
  // and a half of travel; the tests pin the difference.
  const SCHLYTER_EPOCH = 2451543.5;
  const SYNODIC_DAYS = 29.530588853;

  const SOURCE_COMPUTED = "computed";
  const SOURCE_CATALOG = "catalog";

  /* ── Small math ─────────────────────────────────────────────── */

  function wrap360(deg) {
    const r = deg % 360;
    return r < 0 ? r + 360 : r;
  }

  function wrap180(deg) {
    const r = wrap360(deg);
    return r > 180 ? r - 360 : r;
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function julianDay(date) {
    return date.getTime() / 86400000 + 2440587.5;
  }

  function dateFromJulianDay(jd) {
    return new Date((jd - 2440587.5) * 86400000);
  }

  function centuries(date) {
    return (julianDay(date) - J2000) / 36525;
  }

  /* ── Sidereal time ──────────────────────────────────────────── */

  function gmstDegrees(date) {
    const jd = julianDay(date);
    const t = (jd - J2000) / 36525;
    return wrap360(
      280.46061837 +
      360.98564736629 * (jd - J2000) +
      0.000387933 * t * t -
      (t * t * t) / 38710000
    );
  }

  function localSiderealDegrees(date, longitude) {
    return wrap360(gmstDegrees(date) + longitude);
  }

  /* ── The Sun ────────────────────────────────────────────────── */

  function obliquityDegrees(date) {
    const t = centuries(date);
    return (
      23 +
      (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
    );
  }

  /* Meeus low-precision solar coordinates (AA ch. 25). */
  function sunPosition(date) {
    const n = julianDay(date) - J2000;
    const meanLongitude = wrap360(280.46 + 0.9856474 * n);
    const meanAnomaly = wrap360(357.528 + 0.9856003 * n);
    const mRad = meanAnomaly * DEG;
    const eclipticLongitude = wrap360(
      meanLongitude + 1.915 * Math.sin(mRad) + 0.02 * Math.sin(2 * mRad)
    );
    const eps = obliquityDegrees(date) * DEG;
    const lam = eclipticLongitude * DEG;
    const ra = wrap360(Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) * RAD);
    const dec = Math.asin(Math.sin(eps) * Math.sin(lam)) * RAD;
    const distanceAU =
      1.00014 - 0.01671 * Math.cos(mRad) - 0.00014 * Math.cos(2 * mRad);
    return {
      ra,
      dec,
      eclipticLongitude,
      distanceAU,
      source: SOURCE_COMPUTED,
      accuracy: "about 0.01 degrees (Meeus low-precision solar coordinates)"
    };
  }

  /* Equatorial → horizontal for a place and moment. Azimuth is
   * measured from true north, eastward. Refraction (Bennett) is
   * applied to the altitude, as published rise/set tables do. */
  function equatorialToHorizontal(ra, dec, date, latitude, longitude) {
    const lst = localSiderealDegrees(date, longitude);
    const ha = wrap180(lst - ra) * DEG;
    const phi = latitude * DEG;
    const delta = dec * DEG;
    const sinAlt =
      Math.sin(delta) * Math.sin(phi) +
      Math.cos(delta) * Math.cos(phi) * Math.cos(ha);
    let altitude = Math.asin(clamp(sinAlt, -1, 1)) * RAD;
    const cosAz =
      (Math.sin(delta) - Math.sin(altitude * DEG) * Math.sin(phi)) /
      (Math.cos(altitude * DEG) * Math.cos(phi));
    let azimuth = Math.acos(clamp(cosAz, -1, 1)) * RAD;
    if (Math.sin(ha) > 0) azimuth = 360 - azimuth;
    if (altitude > -1) {
      const r =
        1.02 / Math.tan((altitude + 10.3 / (altitude + 5.11)) * DEG) / 60;
      altitude += r;
    }
    return { altitude, azimuth };
  }

  function sunAltAz(date, latitude, longitude) {
    const sun = sunPosition(date);
    const horiz = equatorialToHorizontal(sun.ra, sun.dec, date, latitude, longitude);
    return {
      ...horiz,
      source: SOURCE_COMPUTED,
      accuracy: "about 0.01 degrees plus refraction model"
    };
  }

  /* Solar transit (local apparent noon) nearest a guess instant,
   * found by walking the hour angle to zero. */
  function solarTransitNear(guessDate, longitude) {
    let t = guessDate.getTime();
    for (let i = 0; i < 4; i += 1) {
      const date = new Date(t);
      const sun = sunPosition(date);
      const ha = wrap180(localSiderealDegrees(date, longitude) - sun.ra);
      t -= (ha / 15.0410687) * 3600000;
    }
    return new Date(t);
  }

  const SUN_ZENITH = 90.833; // includes refraction + solar semidiameter

  function sunHourAngleDegrees(latitude, dec) {
    const phi = latitude * DEG;
    const delta = dec * DEG;
    const cosH =
      (Math.cos(SUN_ZENITH * DEG) - Math.sin(phi) * Math.sin(delta)) /
      (Math.cos(phi) * Math.cos(delta));
    if (cosH < -1) return { polar: "day" };
    if (cosH > 1) return { polar: "night" };
    return { hourAngle: Math.acos(cosH) * RAD };
  }

  /* Sun events for one civil date at a place.
   * civilDate: { year, month, day } in the keeper's timezone;
   * tzOffsetMinutes: minutes EAST of UTC for that date. */
  function sunForCivilDate(civilDate, latitude, longitude, tzOffsetMinutes) {
    const localNoonUTC = Date.UTC(
      civilDate.year,
      civilDate.month - 1,
      civilDate.day,
      12, 0, 0
    ) - tzOffsetMinutes * 60000;
    const transit = solarTransitNear(new Date(localNoonUTC), longitude);
    const transitSun = sunPosition(transit);
    const first = sunHourAngleDegrees(latitude, transitSun.dec);
    if (first.polar) {
      return {
        sunrise: null,
        sunset: null,
        solarNoon: transit,
        daylightMinutes: first.polar === "day" ? 1440 : 0,
        polar: first.polar,
        source: SOURCE_COMPUTED,
        accuracy: "sun above/below the horizon all day at this place and date"
      };
    }
    function refine(eventDate, sign) {
      let t = eventDate.getTime();
      for (let i = 0; i < 3; i += 1) {
        const sun = sunPosition(new Date(t));
        const h = sunHourAngleDegrees(latitude, sun.dec);
        if (h.polar) return null;
        t = transit.getTime() + sign * (h.hourAngle / 15.0410687) * 3600000;
      }
      return new Date(t);
    }
    const halfMs = (first.hourAngle / 15.0410687) * 3600000;
    const sunrise = refine(new Date(transit.getTime() - halfMs), -1);
    const sunset = refine(new Date(transit.getTime() + halfMs), +1);
    const daylightMinutes =
      sunrise && sunset ? (sunset.getTime() - sunrise.getTime()) / 60000 : null;
    return {
      sunrise,
      sunset,
      solarNoon: transit,
      daylightMinutes,
      polar: null,
      source: SOURCE_COMPUTED,
      accuracy: "about ±1–2 minutes at temperate latitudes (NOAA class)"
    };
  }

  /* The instant the Sun's altitude crosses a target (twilight
   * workhorse): scan the local day in 4-minute steps, bisect the
   * crossing. direction: "set" looks for the downward crossing,
   * "rise" for the upward one. Returns null when it never happens. */
  function sunAltitudeCrossing(civilDate, latitude, longitude, tzOffsetMinutes, targetAltitude, direction) {
    const dayStartUTC = Date.UTC(civilDate.year, civilDate.month - 1, civilDate.day, 0, 0, 0) - tzOffsetMinutes * 60000;
    const stepMs = 4 * 60000;
    let prevT = dayStartUTC;
    let prevAlt = sunAltAz(new Date(prevT), latitude, longitude).altitude;
    for (let t = dayStartUTC + stepMs; t <= dayStartUTC + 86400000; t += stepMs) {
      const alt = sunAltAz(new Date(t), latitude, longitude).altitude;
      const crossed = direction === "set"
        ? prevAlt > targetAltitude && alt <= targetAltitude
        : prevAlt < targetAltitude && alt >= targetAltitude;
      if (crossed) {
        let lo = prevT, hi = t;
        for (let i = 0; i < 24; i += 1) {
          const mid = (lo + hi) / 2;
          const midAlt = sunAltAz(new Date(mid), latitude, longitude).altitude;
          if (direction === "set" ? midAlt > targetAltitude : midAlt < targetAltitude) lo = mid;
          else hi = mid;
        }
        return new Date((lo + hi) / 2);
      }
      prevT = t;
      prevAlt = alt;
    }
    return null;
  }

  /* ── Season turns ───────────────────────────────────────────── */

  const SEASON_TURN_DEFS = [
    { name: "March Equinox", season: "Spring", longitude: 0 },
    { name: "June Solstice", season: "Summer", longitude: 90 },
    { name: "September Equinox", season: "Autumn", longitude: 180 },
    { name: "December Solstice", season: "Winter", longitude: 270 }
  ];

  /* Root-find each turn of a year on the Sun's apparent ecliptic
   * longitude. Pinned in tests against the repo's USNO 2026–2027
   * table and the Skyfield/JPL March-equinox table 2014–2027. */
  function seasonTurns(year) {
    return SEASON_TURN_DEFS.map((def) => {
      const approxMonth = def.longitude === 0 ? 2 : def.longitude === 90 ? 5 : def.longitude === 180 ? 8 : 11;
      let lo = Date.UTC(year, approxMonth, 1, 0, 0, 0);
      let hi = Date.UTC(year, approxMonth + 1, 1, 0, 0, 0);
      const f = (t) => wrap180(sunPosition(new Date(t)).eclipticLongitude - def.longitude);
      let flo = f(lo);
      for (let i = 0; i < 60; i += 1) {
        const mid = (lo + hi) / 2;
        const fm = f(mid);
        if ((flo < 0 && fm < 0) || (flo >= 0 && fm >= 0)) { lo = mid; flo = fm; }
        else hi = mid;
      }
      return {
        name: def.name,
        season: def.season,
        at: new Date((lo + hi) / 2),
        source: SOURCE_COMPUTED,
        accuracy: "root-found on the computed solar longitude; within minutes of the published USNO/JPL instants (see tests)"
      };
    });
  }

  /* ── The Moon ───────────────────────────────────────────────── */

  /* Schlyter's lunar elements + principal perturbation terms. */
  function moonPosition(date) {
    const d = julianDay(date) - SCHLYTER_EPOCH;
    const N = wrap360(125.1228 - 0.0529538083 * d);
    const incl = 5.1454;
    const w = wrap360(318.0634 + 0.1643573223 * d);
    const a = 60.2666; // Earth radii
    const e = 0.0549;
    const M = wrap360(115.3654 + 13.0649929509 * d);

    // Eccentric anomaly, iterated.
    const mRad = M * DEG;
    let E = M + RAD * e * Math.sin(mRad) * (1 + e * Math.cos(mRad));
    for (let i = 0; i < 3; i += 1) {
      E = E - (E - RAD * e * Math.sin(E * DEG) - M) / (1 - e * Math.cos(E * DEG));
    }
    const eRad = E * DEG;
    const xv = a * (Math.cos(eRad) - e);
    const yv = a * (Math.sqrt(1 - e * e) * Math.sin(eRad));
    const v = wrap360(Math.atan2(yv, xv) * RAD);
    let r = Math.sqrt(xv * xv + yv * yv);

    const nRad = N * DEG, iRad = incl * DEG, vwRad = (v + w) * DEG;
    const xh = r * (Math.cos(nRad) * Math.cos(vwRad) - Math.sin(nRad) * Math.sin(vwRad) * Math.cos(iRad));
    const yh = r * (Math.sin(nRad) * Math.cos(vwRad) + Math.cos(nRad) * Math.sin(vwRad) * Math.cos(iRad));
    const zh = r * (Math.sin(vwRad) * Math.sin(iRad));
    let lon = wrap360(Math.atan2(yh, xh) * RAD);
    let lat = Math.atan2(zh, Math.sqrt(xh * xh + yh * yh)) * RAD;

    // Perturbations (Schlyter's principal terms).
    const Ms = wrap360(356.047 + 0.9856002585 * d);
    const Mm = M;
    const D = wrap360(297.8502 + 12.1907491172 * d); // mean elongation
    const F = wrap360(93.2721 + 13.2293502377 * d); // argument of latitude
    const s = (x) => Math.sin(x * DEG);
    const c = (x) => Math.cos(x * DEG);
    lon +=
      -1.274 * s(Mm - 2 * D) + 0.658 * s(2 * D) - 0.186 * s(Ms) -
      0.059 * s(2 * Mm - 2 * D) - 0.057 * s(Mm - 2 * D + Ms) +
      0.053 * s(Mm + 2 * D) + 0.046 * s(2 * D - Ms) +
      0.041 * s(Mm - Ms) - 0.035 * s(D) - 0.031 * s(Mm + Ms) -
      0.015 * s(2 * F - 2 * D) + 0.011 * s(Mm - 4 * D);
    lat +=
      -0.173 * s(F - 2 * D) - 0.055 * s(Mm - F - 2 * D) -
      0.046 * s(Mm + F - 2 * D) + 0.033 * s(F + 2 * D) +
      0.017 * s(2 * Mm + F);
    r += -0.58 * c(Mm - 2 * D) - 0.46 * c(2 * D);

    const eps = obliquityDegrees(date) * DEG;
    const lonRad = lon * DEG, latRad = lat * DEG;
    const xe = r * Math.cos(lonRad) * Math.cos(latRad);
    const ye = r * (Math.sin(lonRad) * Math.cos(latRad) * Math.cos(eps) - Math.sin(latRad) * Math.sin(eps));
    const ze = r * (Math.sin(lonRad) * Math.cos(latRad) * Math.sin(eps) + Math.sin(latRad) * Math.cos(eps));
    const ra = wrap360(Math.atan2(ye, xe) * RAD);
    const dec = Math.atan2(ze, Math.sqrt(xe * xe + ye * ye)) * RAD;

    return {
      ra,
      dec,
      eclipticLongitude: wrap360(lon),
      eclipticLatitude: lat,
      distanceKm: r * 6378.14,
      source: SOURCE_COMPUTED,
      accuracy: "within about a degree (Schlyter elements + principal perturbation terms; measured against published 2026 values — see tests)"
    };
  }

  function moonAltAz(date, latitude, longitude) {
    const moon = moonPosition(date);
    // Topocentric correction: published rise/set and alt/az values
    // are for an observer on the surface, and the Moon is close
    // enough that parallax moves it by up to a degree. Shift the
    // geocentric vector by the observer's own geocentric vector.
    const lst = localSiderealDegrees(date, longitude) * DEG;
    const phiPrime = Math.atan(0.99664719 * Math.tan(latitude * DEG));
    const obs = {
      x: 6378.14 * Math.cos(phiPrime) * Math.cos(lst),
      y: 6378.14 * Math.cos(phiPrime) * Math.sin(lst),
      z: 6378.14 * Math.sin(phiPrime)
    };
    const raRad = moon.ra * DEG, decRad = moon.dec * DEG;
    const gx = moon.distanceKm * Math.cos(decRad) * Math.cos(raRad) - obs.x;
    const gy = moon.distanceKm * Math.cos(decRad) * Math.sin(raRad) - obs.y;
    const gz = moon.distanceKm * Math.sin(decRad) - obs.z;
    const raTopo = wrap360(Math.atan2(gy, gx) * RAD);
    const decTopo = Math.atan2(gz, Math.sqrt(gx * gx + gy * gy)) * RAD;
    const horiz = equatorialToHorizontal(raTopo, decTopo, date, latitude, longitude);
    return { ...horiz, source: SOURCE_COMPUTED };
  }

  function elongationDegrees(date) {
    const sun = sunPosition(date);
    const moon = moonPosition(date);
    return wrap360(moon.eclipticLongitude - sun.eclipticLongitude);
  }

  function phaseNameFor(elongation) {
    const sector = Math.floor(wrap360(elongation + 22.5) / 45) % 8;
    return [
      "New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous",
      "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent"
    ][sector];
  }

  function moonPhase(date) {
    const elongation = elongationDegrees(date);
    const illum = (1 - Math.cos(elongation * DEG)) / 2;
    return {
      elongation,
      illumination: illum,
      name: phaseNameFor(elongation),
      waxing: elongation <= 180,
      source: SOURCE_COMPUTED,
      accuracy: "illumination within about one percent; phase instants within about ±3 hours (measured against published 2026 instants — see tests)"
    };
  }

  /* The next instant (after `date`) at which the elongation
   * reaches `target` degrees, by scan + bisection. */
  function nextPhaseInstant(date, target) {
    const f = (t) => wrap180(elongationDegrees(new Date(t)) - target);
    let prevT = date.getTime();
    let prevF = f(prevT);
    const stepMs = 6 * 3600000;
    for (let t = prevT + stepMs; t <= prevT + 40 * 86400000; t += stepMs) {
      const ft = f(t);
      if (prevF < 0 && ft >= 0) {
        let lo = prevT, hi = t;
        for (let i = 0; i < 40; i += 1) {
          const mid = (lo + hi) / 2;
          if (f(mid) < 0) lo = mid; else hi = mid;
        }
        return new Date((lo + hi) / 2);
      }
      prevT = t;
      prevF = ft;
    }
    return null;
  }

  /* Moonrise / moonset events inside one civil date at a place.
   * The Moon's altitude is walked in 4-minute steps against the
   * standard rise/set altitude (+0.125 degrees: upper limb,
   * parallax and refraction accounted in the constant), and each
   * crossing is bisected. Returns a list — a day may hold zero,
   * one, or two of each kind. */
  const MOON_RISE_ALTITUDE = 0.125;

  function moonForCivilDate(civilDate, latitude, longitude, tzOffsetMinutes) {
    const dayStartUTC = Date.UTC(civilDate.year, civilDate.month - 1, civilDate.day, 0, 0, 0) - tzOffsetMinutes * 60000;
    const events = [];
    // 4-minute bracketing (the crossings are then bisected to the
    // second): the Moon's altitude moves at most ~1 degree per
    // step, so no crossing can hide between samples.
    const stepMs = 4 * 60000;
    let prevT = dayStartUTC;
    let prevAlt = moonAltAz(new Date(prevT), latitude, longitude).altitude;
    for (let t = dayStartUTC + stepMs; t <= dayStartUTC + 86400000; t += stepMs) {
      const alt = moonAltAz(new Date(t), latitude, longitude).altitude;
      const rising = prevAlt < MOON_RISE_ALTITUDE && alt >= MOON_RISE_ALTITUDE;
      const setting = prevAlt >= MOON_RISE_ALTITUDE && alt < MOON_RISE_ALTITUDE;
      if (rising || setting) {
        let lo = prevT, hi = t;
        for (let i = 0; i < 20; i += 1) {
          const mid = (lo + hi) / 2;
          const midAlt = moonAltAz(new Date(mid), latitude, longitude).altitude;
          if (rising ? midAlt < MOON_RISE_ALTITUDE : midAlt >= MOON_RISE_ALTITUDE) lo = mid;
          else hi = mid;
        }
        events.push({ kind: rising ? "moonrise" : "moonset", at: new Date((lo + hi) / 2) });
      }
      prevT = t;
      prevAlt = alt;
    }
    return {
      events,
      source: SOURCE_COMPUTED,
      accuracy: "about ±10 minutes (measured against published Seattle tables — see tests)"
    };
  }

  /* ── Planets ────────────────────────────────────────────────── */

  /* Schlyter's low-precision elements (J2000 + per-day rates).
   * magBase/magSlope feed the standard distance-form magnitude
   * approximation; magnitudes are labelled approximate. */
  const PLANETS = [
    { name: "Mercury", N: 48.3313, Nd: 3.24587e-5, i: 7.0047, id: 5.00e-8, w: 29.1241, wd: 1.01444e-5, a: 0.387098, ad: 0, e: 0.205635, ed: 5.59e-10, M: 168.6562, Md: 4.0923344368, magBase: -0.6 },
    { name: "Venus", N: 76.6799, Nd: 2.46590e-5, i: 3.3946, id: 2.75e-8, w: 54.8910, wd: 1.38374e-5, a: 0.72333, ad: 0, e: 0.006773, ed: -1.302e-9, M: 48.0052, Md: 1.6021302244, magBase: -4.4 },
    { name: "Mars", N: 49.5574, Nd: 2.11081e-5, i: 1.8497, id: -1.78e-8, w: 286.5016, wd: 2.92961e-5, a: 1.523688, ad: 0, e: 0.093405, ed: 2.516e-9, M: 18.6021, Md: 0.5240207766, magBase: -1.52 },
    { name: "Jupiter", N: 100.4542, Nd: 2.76854e-5, i: 1.3032, id: -1.557e-7, w: 273.8777, wd: 1.64505e-5, a: 5.20256, ad: 0, e: 0.048498, ed: 4.469e-9, M: 19.8950, Md: 0.0830853001, magBase: -9.4 },
    { name: "Saturn", N: 113.6634, Nd: 2.38980e-5, i: 2.4886, id: -1.081e-7, w: 339.3939, wd: 2.97661e-5, a: 9.55475, ad: 0, e: 0.055546, ed: -9.499e-9, M: 316.9670, Md: 0.0334442282, magBase: -8.88 },
    { name: "Uranus", N: 74.0005, Nd: 1.3978e-5, i: 0.7733, id: 1.9e-8, w: 96.6612, wd: 3.0565e-5, a: 19.18171, ad: -1.55e-8, e: 0.047318, ed: 7.45e-9, M: 142.5905, Md: 0.011725806, magBase: -7.19, telescope: true },
    { name: "Neptune", N: 131.7806, Nd: 3.0173e-5, i: 1.77, id: -2.55e-7, w: 272.8461, wd: -6.027e-6, a: 30.05826, ad: 3.313e-8, e: 0.008606, ed: 2.15e-9, M: 260.2471, Md: 0.005995147, magBase: -6.87, telescope: true }
  ];

  function planetHeliocentric(p, d) {
    const N = wrap360(p.N + p.Nd * d);
    const incl = p.i + p.id * d;
    const w = wrap360(p.w + p.wd * d);
    const a = p.a + p.ad * d;
    const e = p.e + p.ed * d;
    const M = wrap360(p.M + p.Md * d);
    const mRad = M * DEG;
    let E = M + RAD * e * Math.sin(mRad) * (1 + e * Math.cos(mRad));
    if (e > 0.05) {
      for (let i = 0; i < 4; i += 1) {
        E = E - (E - RAD * e * Math.sin(E * DEG) - M) / (1 - e * Math.cos(E * DEG));
      }
    }
    const eRad = E * DEG;
    const xv = a * (Math.cos(eRad) - e);
    const yv = a * (Math.sqrt(1 - e * e) * Math.sin(eRad));
    const v = wrap360(Math.atan2(yv, xv) * RAD);
    const r = Math.sqrt(xv * xv + yv * yv);
    const nRad = N * DEG, iRad = incl * DEG, vwRad = (v + w) * DEG;
    return {
      x: r * (Math.cos(nRad) * Math.cos(vwRad) - Math.sin(nRad) * Math.sin(vwRad) * Math.cos(iRad)),
      y: r * (Math.sin(nRad) * Math.cos(vwRad) + Math.cos(nRad) * Math.sin(vwRad) * Math.cos(iRad)),
      z: r * (Math.sin(vwRad) * Math.sin(iRad)),
      r
    };
  }

  /* Earth's heliocentric position from the Sun's geocentric one. */
  function earthHeliocentric(date) {
    const sun = sunPosition(date);
    const lam = (sun.eclipticLongitude + 180) * DEG;
    return {
      x: sun.distanceAU * Math.cos(lam),
      y: sun.distanceAU * Math.sin(lam),
      z: 0
    };
  }

  function planetPositions(date) {
    const d = julianDay(date) - SCHLYTER_EPOCH;
    const earth = earthHeliocentric(date);
    const sun = sunPosition(date);
    const eps = obliquityDegrees(date) * DEG;
    return PLANETS.map((p) => {
      const helio = planetHeliocentric(p, d);
      const xg = helio.x - earth.x;
      const yg = helio.y - earth.y;
      const zg = helio.z - earth.z;
      const lon = wrap360(Math.atan2(yg, xg) * RAD);
      const latEcl = Math.atan2(zg, Math.sqrt(xg * xg + yg * yg)) * RAD;
      const distAU = Math.sqrt(xg * xg + yg * yg + zg * zg);
      const lonRad = lon * DEG, latRad = latEcl * DEG;
      const xe = Math.cos(lonRad) * Math.cos(latRad);
      const ye = Math.sin(lonRad) * Math.cos(latRad) * Math.cos(eps) - Math.sin(latRad) * Math.sin(eps);
      const ze = Math.sin(lonRad) * Math.cos(latRad) * Math.sin(eps) + Math.sin(latRad) * Math.cos(eps);
      const ra = wrap360(Math.atan2(ye, xe) * RAD);
      const dec = Math.atan2(ze, Math.sqrt(xe * xe + ye * ye)) * RAD;
      const elongation = Math.abs(wrap180(lon - sun.eclipticLongitude));
      const magnitude = p.magBase + 5 * Math.log10(Math.max(helio.r * distAU, 1e-6));
      return {
        name: p.name,
        ra,
        dec,
        eclipticLongitude: lon,
        eclipticLatitude: latEcl,
        distanceAU: distAU,
        elongationFromSun: elongation,
        magnitude: Math.round(magnitude * 10) / 10,
        telescope: !!p.telescope,
        source: SOURCE_COMPUTED,
        accuracy: "low-precision orbital elements (Schlyter); arcminute-class for the bright planets in this era, up to about a degree for Mercury; magnitudes approximate"
      };
    });
  }

  function planetsAltAz(date, latitude, longitude) {
    return planetPositions(date).map((p) => ({
      ...p,
      ...equatorialToHorizontal(p.ra, p.dec, date, latitude, longitude)
    }));
  }

  /* ── Stars ──────────────────────────────────────────────────── */

  /* Precession from the catalog epoch to the moment (Meeus ch. 21,
   * the rigorous three-angle form, epoch-general). */
  function precess(raDeg, decDeg, fromJulianDay, toDate) {
    const T0 = (fromJulianDay - J2000) / 36525;
    const T = (julianDay(toDate) - fromJulianDay) / 36525;
    const zeta = ((2306.2181 + T0 * (1.39656 - T0 * 0.000139)) * T +
      (0.30188 - T0 * 0.000344) * T * T + 0.017998 * T * T * T) / 3600;
    const z = ((2306.2181 + T0 * (1.39656 - T0 * 0.000139)) * T +
      (1.09468 + T0 * 0.000066) * T * T + 0.018203 * T * T * T) / 3600;
    const theta = ((2004.3109 - T0 * (0.8533 + T0 * 0.000217)) * T -
      (0.42665 + T0 * 0.000217) * T * T - 0.041833 * T * T * T) / 3600;
    const A = Math.cos(decDeg * DEG) * Math.sin((raDeg + zeta) * DEG);
    const B = Math.cos(theta * DEG) * Math.cos(decDeg * DEG) * Math.cos((raDeg + zeta) * DEG) -
      Math.sin(theta * DEG) * Math.sin(decDeg * DEG);
    const C = Math.sin(theta * DEG) * Math.cos(decDeg * DEG) * Math.cos((raDeg + zeta) * DEG) +
      Math.cos(theta * DEG) * Math.sin(decDeg * DEG);
    const raOut = wrap360(Math.atan2(A, B) * RAD + z);
    const decOut = Math.asin(clamp(C, -1, 1)) * RAD;
    return { ra: raOut, dec: decOut };
  }

  const CATALOG_EPOCH_JD = J2000 + 0.165 * 36525; // 2016.5

  /* The catalog's stars standing above the horizon at a place and
   * moment, brightest first. Reads globalThis.CodexBrightStars
   * (bright-stars.js); without the catalog there are no stars —
   * the function says so rather than inventing any. */
  function starsAboveHorizon(date, latitude, longitude, options) {
    const catalog = globalThis.CodexBrightStars;
    if (!catalog || !Array.isArray(catalog.stars)) {
      return { available: false, reason: "catalog-not-loaded", stars: [] };
    }
    const minAltitude = options && Number.isFinite(options.minAltitude) ? options.minAltitude : 0;
    const out = [];
    for (const row of catalog.stars) {
      const hr = row[0], raEpoch = row[1], decEpoch = row[2], vmag = row[3];
      const designation = row[4], spectral = row[5];
      const pos = precess(raEpoch, decEpoch, CATALOG_EPOCH_JD, date);
      const horiz = equatorialToHorizontal(pos.ra, pos.dec, date, latitude, longitude);
      if (horiz.altitude > minAltitude) {
        out.push({
          hr,
          name: designation || `HR ${hr}`,
          designation,
          spectral,
          magnitude: vmag,
          ra: pos.ra,
          dec: pos.dec,
          altitude: horiz.altitude,
          azimuth: horiz.azimuth,
          source: SOURCE_CATALOG,
          positionSource: SOURCE_COMPUTED
        });
      }
    }
    out.sort((a, b) => a.magnitude - b.magnitude);
    return {
      available: true,
      stars: out,
      catalogEpoch: catalog.epoch,
      credit: catalog.credit,
      source: SOURCE_CATALOG
    };
  }

  /* ── The whole sky for a civil date + place (the face's read) ── */

  function skyForCivilDate(civilDate, latitude, longitude, tzOffsetMinutes) {
    const sun = sunForCivilDate(civilDate, latitude, longitude, tzOffsetMinutes);
    const moon = moonForCivilDate(civilDate, latitude, longitude, tzOffsetMinutes);
    const localNoon = new Date(
      Date.UTC(civilDate.year, civilDate.month - 1, civilDate.day, 12, 0, 0) - tzOffsetMinutes * 60000
    );
    const phase = moonPhase(localNoon);
    const dusk = sun.sunset
      ? sunAltitudeCrossing(civilDate, latitude, longitude, tzOffsetMinutes, -12, "set")
      : null;
    return {
      sun,
      moon,
      phase,
      nauticalDusk: dusk,
      turns: seasonTurns(civilDate.year),
      source: SOURCE_COMPUTED
    };
  }

  return {
    VERSION,
    SYNODIC_DAYS,
    julianDay,
    dateFromJulianDay,
    gmstDegrees,
    localSiderealDegrees,
    sunPosition,
    sunAltAz,
    sunForCivilDate,
    sunAltitudeCrossing,
    seasonTurns,
    moonPosition,
    moonAltAz,
    moonPhase,
    nextPhaseInstant,
    moonForCivilDate,
    planetPositions,
    planetsAltAz,
    precess,
    starsAboveHorizon,
    skyForCivilDate,
    equatorialToHorizontal
  };
});
