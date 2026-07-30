(() => {
  "use strict";

  const VERSION = "1.1.0";
  const RANGE = Object.freeze({ start: 1000, end: 3000 });
  const EVENTS = Object.freeze([
    { key: "marchEquinox", label: "March Equinox", seasonNorth: "Spring", seasonSouth: "Autumn" },
    { key: "juneSolstice", label: "June Solstice", seasonNorth: "Summer", seasonSouth: "Winter" },
    { key: "septemberEquinox", label: "September Equinox", seasonNorth: "Autumn", seasonSouth: "Spring" },
    { key: "decemberSolstice", label: "December Solstice", seasonNorth: "Winter", seasonSouth: "Summer" }
  ]);

  // Meeus polynomial coefficients for mean dynamical seasonal-event JDE0.
  const COEFFICIENTS = Object.freeze({
    early: Object.freeze({
      marchEquinox: [1721139.29189, 365242.13740, 0.06134, 0.00111, -0.00071],
      juneSolstice: [1721233.25401, 365241.72562, -0.05323, 0.00907, 0.00025],
      septemberEquinox: [1721325.70455, 365242.49558, -0.11677, -0.00297, 0.00074],
      decemberSolstice: [1721414.39987, 365242.88257, -0.00769, -0.00933, -0.00006]
    }),
    modern: Object.freeze({
      marchEquinox: [2451623.80984, 365242.37404, 0.05169, -0.00411, -0.00057],
      juneSolstice: [2451716.56767, 365241.62603, 0.00325, 0.00888, -0.00030],
      septemberEquinox: [2451810.21715, 365242.01767, -0.11575, 0.00337, 0.00078],
      decemberSolstice: [2451900.05952, 365242.74049, -0.06223, -0.00823, 0.00032]
    })
  });

  // Periodic correction terms from Meeus, Astronomical Algorithms, chapter 27.
  const PERIODIC_TERMS = Object.freeze([
    [485,324.96,1934.136],[203,337.23,32964.467],[199,342.08,20.186],[182,27.85,445267.112],
    [156,73.14,45036.886],[136,171.52,22518.443],[77,222.54,65928.934],[74,296.72,3034.906],
    [70,243.58,9037.513],[58,119.81,33718.147],[52,297.17,150.678],[50,21.02,2281.226],
    [45,247.54,29929.562],[44,325.15,31555.956],[29,60.93,4443.417],[18,155.12,67555.328],
    [17,288.79,4562.452],[16,198.04,62894.029],[14,199.76,31436.921],[12,95.39,14577.848],
    [12,287.11,31931.756],[12,320.81,34777.259],[9,227.73,1222.114],[8,15.45,16859.074]
  ]);

  const degToRad = degrees => degrees * Math.PI / 180;
  const polynomial = (coeff, value) => coeff.reduceRight((sum, item) => sum * value + item, 0);

  function meanJde0(year, eventKey) {
    // The supported range begins at 1000, so Meeus' modern coefficient set applies.
    const scale = (year - 2000) / 1000;
    return polynomial(COEFFICIENTS.modern[eventKey], scale);
  }

  function correctedJde(year, eventKey) {
    const jde0 = meanJde0(year, eventKey);
    const T = (jde0 - 2451545.0) / 36525;
    const W = degToRad(35999.373 * T - 2.47);
    const deltaLambda = 1 + 0.0334 * Math.cos(W) + 0.0007 * Math.cos(2 * W);
    const periodicSum = PERIODIC_TERMS.reduce((sum, [amplitude, phase, rate]) =>
      sum + amplitude * Math.cos(degToRad(phase + rate * T)), 0);
    return jde0 + (0.00001 * periodicSum) / deltaLambda;
  }

  // Piecewise NASA/Espenak-Meeus Delta-T approximation, seconds.
  function deltaTSeconds(yearDecimal) {
    const y = Number(yearDecimal);
    let u, t;
    if (y < 1600) {
      u = (y - 1000) / 100;
      return 1574.2 - 556.01*u + 71.23472*u**2 + 0.319781*u**3 - 0.8503463*u**4 - 0.005050998*u**5 + 0.0083572073*u**6;
    }
    if (y < 1700) { t = y - 1600; return 120 - 0.9808*t - 0.01532*t**2 + t**3/7129; }
    if (y < 1800) { t = y - 1700; return 8.83 + 0.1603*t - 0.0059285*t**2 + 0.00013336*t**3 - t**4/1174000; }
    if (y < 1860) { t = y - 1800; return 13.72 - 0.332447*t + 0.0068612*t**2 + 0.0041116*t**3 - 0.00037436*t**4 + 0.0000121272*t**5 - 0.0000001699*t**6 + 0.000000000875*t**7; }
    if (y < 1900) { t = y - 1860; return 7.62 + 0.5737*t - 0.251754*t**2 + 0.01680668*t**3 - 0.0004473624*t**4 + t**5/233174; }
    if (y < 1920) { t = y - 1900; return -2.79 + 1.494119*t - 0.0598939*t**2 + 0.0061966*t**3 - 0.000197*t**4; }
    if (y < 1941) { t = y - 1920; return 21.20 + 0.84493*t - 0.076100*t**2 + 0.0020936*t**3; }
    if (y < 1961) { t = y - 1950; return 29.07 + 0.407*t - t**2/233 + t**3/2547; }
    if (y < 1986) { t = y - 1975; return 45.45 + 1.067*t - t**2/260 - t**3/718; }
    if (y < 2005) { t = y - 2000; return 63.86 + 0.3345*t - 0.060374*t**2 + 0.0017275*t**3 + 0.000651814*t**4 + 0.00002373599*t**5; }
    if (y < 2050) { t = y - 2000; return 62.92 + 0.32217*t + 0.005589*t**2; }
    if (y < 2150) { return -20 + 32*((y - 1820)/100)**2 - 0.5628*(2150-y); }
    u = (y - 1820) / 100;
    return -20 + 32*u**2;
  }

  function eventYearFraction(year, eventKey) {
    const fractions = { marchEquinox: 0.216, juneSolstice: 0.471, septemberEquinox: 0.727, decemberSolstice: 0.970 };
    return year + fractions[eventKey];
  }

  function ttJdeToUtcDate(jdeTT, year, eventKey) {
    const deltaT = deltaTSeconds(eventYearFraction(year, eventKey));
    const utcJd = jdeTT - deltaT / 86400;
    return { date: new Date((utcJd - 2440587.5) * 86400000), utcJd, deltaT };
  }

  function uncertaintyForYear(year) {
    const distance = Math.abs(year - 2000);
    if (distance <= 100) return Object.freeze({ minutes: 5, tier: "computed-high", label: "Computed · high confidence" });
    if (distance <= 500) return Object.freeze({ minutes: 25, tier: "computed-medium", label: "Computed · estimated" });
    return Object.freeze({ minutes: 120, tier: "computed-deep", label: "Computed · deep-time estimate" });
  }

  function patternPosition(date, timeZone = "UTC") {
    if (!globalThis.PatternCalendar?.fromCivilDate) return null;
    try {
      const p = globalThis.PatternCalendar.fromCivilDate({ date, timeZone, boundaryMode: "midnight" });
      return Object.freeze({
        patternYear: p.patternYear, moon: p.moon, moonName: p.moonName, day: p.day,
        dayOfPatternYear: p.dayOfPatternYear, weekOfMoon: p.weekOfMoon, weekOfYear: p.weekOfYear,
        isDayOutOfTime: p.isDayOutOfTime, isDeepTimeDay: p.isDeepTimeDay, effectiveDate: p.effectiveDate
      });
    } catch (_) { return null; }
  }

  function sourcedEvent(year, eventKey) {
    if (eventKey !== "marchEquinox") return null;
    const source = globalThis.EquinoxReferenceData;
    if (!source) return null;
    try {
      const candidate = source.getRecord?.(year) || source.byYear?.[year] || source.records?.find?.(r => Number(r.year) === Number(year));
      const instant = candidate && (candidate.utcInstant || candidate.instant || candidate.datetime || candidate.date);
      if (!instant) return null;
      const date = new Date(instant);
      return Number.isFinite(date.getTime()) ? { date, source: candidate } : null;
    } catch (_) { return null; }
  }

  function buildEvent(year, eventKey, options = {}) {
    const eventDef = EVENTS.find(item => item.key === eventKey);
    if (!eventDef) throw new RangeError(`Unknown seasonal event: ${eventKey}`);
    if (!Number.isInteger(year) || year < RANGE.start || year > RANGE.end) throw new RangeError(`Year must be between ${RANGE.start} and ${RANGE.end}`);

    const verified = sourcedEvent(year, eventKey);
    const jdeTT = correctedJde(year, eventKey);
    const converted = ttJdeToUtcDate(jdeTT, year, eventKey);
    const date = verified?.date || converted.date;
    const uncertainty = verified
      ? Object.freeze({ minutes: 2, tier: "sourced", label: "Sourced · validated" })
      : uncertaintyForYear(year);

    return Object.freeze({
      schemaVersion: VERSION,
      id: `seasonal-${year}-${eventKey}`,
      year, eventKey, label: eventDef.label,
      utcInstant: date.toISOString(),
      julianEphemerisDateTT: Number(jdeTT.toFixed(8)),
      julianDateUTC: Number(converted.utcJd.toFixed(8)),
      deltaTSeconds: Number(converted.deltaT.toFixed(2)),
      status: uncertainty.tier,
      statusLabel: uncertainty.label,
      uncertaintyMinutes: uncertainty.minutes,
      seasonNorth: eventDef.seasonNorth,
      seasonSouth: eventDef.seasonSouth,
      pattern: patternPosition(date, options.timeZone || "UTC"),
      method: verified ? "repository-equinoctial-reference" : "meeus-seasonal-polynomial-periodic-correction-delta-t",
      provenance: Object.freeze({
        sourceType: verified ? "stored-reference" : "computed",
        sourceRecord: verified?.source || null,
        calculationVersion: VERSION,
        timeStandard: verified ? "UTC from stored source" : "TT seasonal-event solution converted to approximate UTC using Delta-T",
        algorithm: verified ? "Repository reference lookup" : "Meeus JDE0 polynomial + 24-term periodic correction + piecewise Delta-T approximation",
        limitations: verified
          ? "Stored repository reference; precision depends on its original source metadata."
          : "Computed seasonal turning point. UTC uncertainty grows in deep time because Earth-rotation history and future Delta-T cannot be known exactly."
      })
    });
  }

  function buildYear(year, options = {}) {
    return Object.freeze({ schemaVersion: VERSION, year, events: Object.freeze(EVENTS.map(event => buildEvent(year, event.key, options))) });
  }

  function listRange(startYear, endYear, options = {}) {
    const start = Math.max(RANGE.start, Math.min(RANGE.end, Math.trunc(startYear)));
    const end = Math.max(start, Math.min(RANGE.end, Math.trunc(endYear)));
    const output = [];
    for (let year = start; year <= end; year += 1) output.push(buildYear(year, options));
    return Object.freeze(output);
  }

  function nearest(date = new Date(), options = {}) {
    const target = new Date(date);
    const year = target.getUTCFullYear();
    const candidates = [];
    for (let y = Math.max(RANGE.start, year - 1); y <= Math.min(RANGE.end, year + 1); y += 1) {
      for (const event of buildYear(y, options).events) candidates.push({ event, distance: Math.abs(new Date(event.utcInstant) - target) });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0]?.event || null;
  }

  function exportYear(year, options = {}) {
    return JSON.stringify(buildYear(year, options), null, 2);
  }

  globalThis.DeepTimeSeasonalLedger = Object.freeze({
    version: VERSION, supportedRange: RANGE, eventDefinitions: EVENTS,
    buildEvent, buildYear, listRange, nearest, exportYear, deltaTSeconds
  });
})();
