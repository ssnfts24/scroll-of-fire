(() => {
  "use strict";

  // Year Gate: Moon 1 Day 1 of the Pattern Year.
  // The Pattern Calendar epoch is April 17, 2026 = Moon 1 · Day 1.
  // The Year Gate for any civil year is April 17 of that year at midnight UTC.
  // The Passage is the interval from the March equinox to the Year Gate.

  const YEAR_GATE_MONTH = 4;   // April
  const YEAR_GATE_DAY   = 17;  // 17th

  function yearGateUtc(year) {
    return new Date(Date.UTC(year, YEAR_GATE_MONTH - 1, YEAR_GATE_DAY, 0, 0, 0));
  }

  function assertDependencies() {
    const required = [
      "AlignmentVersion",
      "EquinoxPassageEngine",
      "EquinoxReferenceData",
      "PatternCalendar",
      "PatternCalendarData",
      "PatternCalendarBoundary",
      "AstronomyVersion"
    ];
    for (const name of required) {
      if (!globalThis[name]) throw new Error(`AlignmentLedgerEngine: ${name} is unavailable`);
    }
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function buildOffsets(equinoxInstant, gateInstant, canonicalRecord) {
    const equinoxMs  = equinoxInstant.getTime();
    const gateMs     = gateInstant.getTime();
    const diffMs     = gateMs - equinoxMs;
    const diffDays   = diffMs / 86400000;

    const eqPos  = canonicalRecord.patternPosition || {};
    const gatePos = buildPatternPositionForInstant(gateInstant,
      globalThis.AstronomyVersion.defaultStudyTimeZone,
      globalThis.AstronomyVersion.defaultBoundaryMode,
      globalThis.AstronomyVersion.defaultSunset);

    const moonOffset         = (gatePos.moon   || 1) - (eqPos.moon  || 1);
    const dayWithinMoonOffset = (gatePos.day    || 1) - (eqPos.day   || 1);
    const weekGateOffset      = 0; // resolved symbolically
    const toneOffset          = 0;
    const lunarCycleOffset    = 0;
    const patternDayOffset    = (gatePos.dayOfPatternYear || 1) - (eqPos.dayOfPatternYear || 1);

    return {
      equinoxToYearGateMilliseconds: Math.round(diffMs),
      equinoxToYearGateDays:         Number(diffDays.toFixed(6)),
      patternDayOffset,
      moonOffset,
      dayWithinMoonOffset,
      weekGateOffset,
      toneOffset,
      lunarCycleOffset
    };
  }

  function buildPatternPositionForInstant(instant, timeZone, boundaryMode, sunsetTime) {
    const mapped = globalThis.PatternCalendar.fromCivilDate({
      date: instant,
      timeZone,
      boundaryMode,
      sunsetTime
    });
    const weekGateIndex = mapped.weekOfMoon ? mapped.weekOfMoon - 1 : null;
    const weekGate = weekGateIndex != null
      ? (globalThis.PatternCalendarData.weekGates?.[weekGateIndex]?.[0] || "Outside Gate")
      : "Outside Gate";
    return {
      effectiveDate:      mapped.effectiveDate,
      patternYear:        mapped.patternYear,
      moon:               mapped.moon,
      moonName:           mapped.moonName,
      day:                mapped.day,
      dayOfPatternYear:   mapped.dayOfPatternYear,
      weekGate,
      archetype:          mapped.dayArchetype?.[0] || mapped.moonName || "Outside Gate",
      tone:               mapped.dayArchetype?.[0] || null,
      insideCountedYear:  mapped.insideCountedYear,
      isDayOutOfTime:     mapped.isDayOutOfTime,
      isDeepTimeDay:      mapped.isDeepTimeDay
    };
  }

  function buildNormalized(canonicalRecord, offsets) {
    const eqPos  = canonicalRecord.patternPosition || {};
    const dayOfYear = eqPos.dayOfPatternYear || 364;
    const equinoxInstant = new Date(canonicalRecord.equinox.utcInstant);
    const lunarPos = canonicalRecord.lunarLayer?.cyclePosition ?? 0;

    return {
      patternCyclePosition:   Number(((dayOfYear - 1) / 364).toFixed(6)),
      equinoxCyclePosition:   Number(((equinoxInstant.getUTCMonth() * 31 + equinoxInstant.getUTCDate()) / 366).toFixed(6)),
      lunarCyclePosition:     Number(clamp(lunarPos, 0, 1).toFixed(6)),
      passageLengthPosition:  Number(clamp(offsets.equinoxToYearGateDays / 40, 0, 1).toFixed(6))
    };
  }

  function buildSignature(year, canonicalRecord) {
    const pos = canonicalRecord.patternPosition || {};
    const duration = Math.abs(canonicalRecord.passage?.totalMilliseconds || 0) / 3600000;
    return {
      year,
      patternPosition: `${pos.moonName || "Outside Gate"} · Day ${pos.day || "—"}`,
      weekGate:   pos.weekGate  || "—",
      archetype:  pos.archetype || "—",
      lunarPhase: canonicalRecord.lunarLayer?.phaseName || "—",
      passageHours: Number(duration.toFixed(2)),
      measured: true,
      symbolic: false,
      note: "Signature derived from measured Pattern Calendar position at equinox instant."
    };
  }

  function buildYearGateSection(year, timeZone, boundaryMode, sunsetTime) {
    const gateInstant = yearGateUtc(year);
    const patternPosition = buildPatternPositionForInstant(gateInstant, timeZone, boundaryMode, sunsetTime);
    return {
      instant: gateInstant.toISOString(),
      patternPosition
    };
  }

  function buildRecord({ selectedYear, timeZone, boundaryMode, manualSunset } = {}) {
    assertDependencies();

    const tz       = timeZone    || globalThis.AstronomyVersion.defaultStudyTimeZone;
    const boundary = boundaryMode || globalThis.AstronomyVersion.defaultBoundaryMode;
    const sunset   = manualSunset || globalThis.AstronomyVersion.defaultSunset;

    const canonical = globalThis.EquinoxPassageEngine.buildCanonicalRecord({
      selectedYear,
      timeZone: tz,
      boundaryMode: boundary,
      manualSunset: sunset
    });

    const equinoxInstant = new Date(canonical.equinox.utcInstant);
    const gateInstant    = yearGateUtc(selectedYear);
    const offsets        = buildOffsets(equinoxInstant, gateInstant, canonical);
    const normalized     = buildNormalized(canonical, offsets);
    const signature      = buildSignature(selectedYear, canonical);
    const yearGate       = buildYearGateSection(selectedYear, tz, boundary, sunset);

    const record = {
      schemaVersion: globalThis.AlignmentVersion.alignmentLedgerVersion,
      year: selectedYear,
      equinox: {
        utcInstant:      canonical.equinox.utcInstant,
        patternPosition: canonical.patternPosition,
        lunarLayer:      canonical.lunarLayer,
        source:          canonical.source || {}
      },
      yearGate,
      offsets,
      normalized,
      signature,
      sources: canonical.sources || [],
      generatedAt: "2026-07-23T00:00:00Z"
    };

    return Object.freeze(record);
  }

  function listSupportedYears() {
    const { start, end } = globalThis.AlignmentVersion.studyRange;
    const years = [];
    for (let y = start; y <= end; y++) years.push(y);
    return years;
  }

  globalThis.AlignmentLedgerEngine = Object.freeze({
    buildRecord,
    listSupportedYears,
    yearGateUtc
  });
})();
