(() => {
  "use strict";

  function assertDependencies() {
    const required = ["PatternCalendar", "PatternCalendarData", "PatternCalendarBoundary", "EquinoxEngine", "TimeZoneTools", "AstronomyVersion"];
    required.forEach(name => {
      if (!globalThis[name]) throw new Error(`${name} is unavailable`);
    });
  }

  function safeBoundaryMode(boundaryMode) {
    return ["midnight", "sunset", "manual"].includes(boundaryMode) ? boundaryMode : "sunset";
  }

  function safeSunset(manualSunset) {
    return globalThis.PatternCalendarFormat?.parseClock(manualSunset || globalThis.AstronomyVersion.defaultSunset)?.text || globalThis.AstronomyVersion.defaultSunset;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function canonicalOf(record) {
    return record?.canonicalRecord || record;
  }

  function dayDiffIso(aIso, bIso) {
    const a = new Date(`${aIso}T12:00:00Z`);
    const b = new Date(`${bIso}T12:00:00Z`);
    return globalThis.PatternCalendarBoundary.dayDiff(a, b);
  }

  function patternPositionForInstant(date, timeZone, boundaryMode, sunsetTime) {
    const mapped = globalThis.PatternCalendar.fromCivilDate({
      date,
      timeZone,
      boundaryMode,
      sunsetTime
    });
    const weekGateIndex = mapped.weekOfMoon ? mapped.weekOfMoon - 1 : null;
    const weekGate = weekGateIndex != null ? globalThis.PatternCalendarData.weekGates[weekGateIndex] : null;
    return {
      effectiveDate: mapped.effectiveDate,
      patternYear: mapped.patternYear,
      moon: mapped.moon,
      moonName: mapped.moonName,
      day: mapped.day,
      dayOfPatternYear: mapped.dayOfPatternYear,
      weekGate: weekGate?.[0] || "Outside Gate",
      archetype: mapped.dayArchetype?.[0] || mapped.moonName || "Outside Gate",
      tone: mapped.dayArchetype?.[0] || null,
      insideCountedYear: mapped.insideCountedYear,
      isDayOutOfTime: mapped.isDayOutOfTime,
      isDeepTimeDay: mapped.isDeepTimeDay
    };
  }

  function buildAnnualSignature(canonicalRecord) {
    const duration = globalThis.EquinoxPassageFormat.durationText(canonicalRecord.passage.totalMilliseconds);
    return {
      calculated: `Equinox entered at ${canonicalRecord.patternPosition.moonName || "Outside Gate"}${canonicalRecord.patternPosition.day ? ` · Day ${canonicalRecord.patternPosition.day}` : ""}.`,
      astronomical: `Approximate lunar phase at the equinox instant: ${canonicalRecord.lunarLayer.phaseName} with approximately ${canonicalRecord.lunarLayer.illuminationPercent}% illumination.`,
      symbolic: `${canonicalRecord.patternPosition.weekGate} frames a ${canonicalRecord.patternPosition.archetype} threshold without claiming causation.`,
      observational: `Passage length under the declared boundary settings: ${duration}. No conclusion until witness records are collected.`
    };
  }

  function normalizedValues(canonicalRecord) {
    const dayIndex = canonicalRecord.patternPosition.day ? canonicalRecord.patternPosition.day - 1 : 27;
    const moonIndex = canonicalRecord.patternPosition.moon ? canonicalRecord.patternPosition.moon - 1 : 12;
    const dayOfYear = canonicalRecord.patternPosition.dayOfPatternYear || 364;
    const equinoxDate = new Date(canonicalRecord.equinox.utcInstant);
    return {
      patternCyclePosition: Number((((dayOfYear - 1) || 0) / 364).toFixed(6)),
      moonIndex,
      dayIndex,
      yearProgress: Number((((dayOfYear - 1) || 0) / 364).toFixed(6)),
      equinoxCyclePosition: Number((((equinoxDate.getUTCMonth() * 31) + equinoxDate.getUTCDate()) / 366).toFixed(6)),
      lunarCyclePosition: Number(canonicalRecord.lunarLayer.cyclePosition.toFixed(6)),
      solarSeasonPosition: 0
    };
  }

  function buildCanonicalRecord({ selectedYear, timeZone, boundaryMode, manualSunset } = {}) {
    assertDependencies();
    const year = globalThis.EquinoxEngine.normalizeYear(selectedYear);
    const zone = globalThis.TimeZoneTools.safeTimeZone(timeZone || globalThis.AstronomyVersion.defaultStudyTimeZone);
    const mode = safeBoundaryMode(boundaryMode || globalThis.AstronomyVersion.defaultBoundaryMode);
    const sunsetTime = safeSunset(manualSunset || globalThis.AstronomyVersion.defaultSunset);
    const equinox = globalThis.EquinoxEngine.describeEquinox(year, zone);
    const patternPosition = patternPositionForInstant(equinox.utcDate, zone, mode, sunsetTime);
    const endDate = globalThis.TimeZoneTools.startOfPatternYearUtc(year, zone, mode, sunsetTime);
    const totalMilliseconds = endDate.getTime() - equinox.utcDate.getTime();
    const civilDate = globalThis.TimeZoneTools.localDateKey(equinox.utcDate, zone);
    const endCivilDate = globalThis.TimeZoneTools.localDateKey(endDate, zone);
    const effectiveTarget = `${year}-04-17`;
    const selectedPatternBoundariesCrossed = dayDiffIso(effectiveTarget, patternPosition.effectiveDate);
    const civilMidnightsCrossed = dayDiffIso(endCivilDate, civilDate);

    const canonicalRecord = {
      schemaVersion: "equinox-passage/1.0.0",
      astronomyVersion: globalThis.AstronomyVersion.version,
      calendarVersion: globalThis.PatternCalendarVersion?.version || "pattern-calendar/1.0.0",
      selectedYear: year,
      timeZone: zone,
      boundaryMode: mode,
      manualSunset: mode === "midnight" ? null : sunsetTime,
      equinox: {
        utcInstant: equinox.utcInstant,
        localInstant: equinox.localInstant,
        civilDate,
        source: equinox.source,
        sourceVersion: equinox.sourceVersion,
        sourceIntegrityStatus: equinox.sourceIntegrityStatus,
        dataOrigin: equinox.dataOrigin,
        timestampResolutionSeconds: equinox.timestampResolutionSeconds,
        validationToleranceSeconds: equinox.validationToleranceSeconds,
        maximumMeasuredDeviationSeconds: equinox.maximumMeasuredDeviationSeconds,
        maximumDeviationYear: equinox.maximumDeviationYear,
        primarySourceUrl: equinox.primarySourceUrl,
        sourceTableUrl: equinox.sourceTableUrl,
        validationUrl: equinox.validationUrl,
        skyfieldVersion: equinox.skyfieldVersion,
        jplKernelFilename: equinox.jplKernelFilename,
        ephemerisVersionOrChecksum: equinox.ephemerisVersionOrChecksum,
        timescale: equinox.timescale,
        equinoxFindingAlgorithm: equinox.equinoxFindingAlgorithm,
        generationScriptPath: equinox.generationScriptPath,
        timestampRoundingPolicy: equinox.timestampRoundingPolicy,
        generationTimestamp: equinox.generationTimestamp,
        status: equinox.status,
        validationStatus: equinox.validationStatus,
        validationMethod: equinox.validationMethod,
        validationDeltaSeconds: equinox.validationDeltaSeconds,
        validationUtcInstant: equinox.validationUtcInstant,
        generatedOrImportedAt: equinox.importedAt
      },
      patternPosition,
      passage: {
        startInstant: equinox.utcInstant,
        endInstant: endDate.toISOString(),
        totalMilliseconds,
        totalDays: Number((totalMilliseconds / 86400000).toFixed(6)),
        civilMidnightsCrossed,
        selectedPatternBoundariesCrossed
      },
      lunarLayer: {
        ...equinox.lunarLayer,
        calculationInstantUtc: equinox.utcInstant,
        approximate: true
      },
      annualSignature: null,
      normalizedValues: null,
      sources: [
        {
          layer: "astronomical-fact",
          source: equinox.source,
          sourceVersion: equinox.sourceVersion,
          exactUtcInstant: equinox.utcInstant,
          timestampResolutionSeconds: equinox.timestampResolutionSeconds,
          validationToleranceSeconds: equinox.validationToleranceSeconds,
          validationStatus: equinox.validationStatus,
          validationMethod: equinox.validationMethod,
          validationDeltaSeconds: equinox.validationDeltaSeconds,
          maximumMeasuredDeviationSeconds: equinox.maximumMeasuredDeviationSeconds,
          maximumDeviationYear: equinox.maximumDeviationYear,
          sourceIntegrityStatus: equinox.sourceIntegrityStatus,
          generatedOrImportedAt: equinox.importedAt
        },
        {
          layer: "pattern-calculation",
          source: globalThis.PatternCalendarVersion?.version || "pattern-calendar/1.0.0",
          sourced: false,
          validationStatus: "deterministic-fixed-epoch-arithmetic"
        },
        {
          layer: "lunar-approximation",
          source: equinox.lunarLayer.source,
          sourceVersion: equinox.lunarLayer.sourceVersion,
          sourced: false,
          validationStatus: "approximate"
        }
      ]
    };

    canonicalRecord.annualSignature = buildAnnualSignature(canonicalRecord);
    canonicalRecord.normalizedValues = normalizedValues(canonicalRecord);
    return canonicalRecord;
  }

  function buildLiveState(canonicalRecord, asOf) {
    const evaluatedAt = asOf ? new Date(asOf) : new Date();
    const start = new Date(canonicalRecord.passage.startInstant).getTime();
    const end = new Date(canonicalRecord.passage.endInstant).getTime();
    const totalMilliseconds = canonicalRecord.passage.totalMilliseconds;
    const elapsedMilliseconds = clamp(evaluatedAt.getTime() - start, 0, totalMilliseconds);
    const remainingMilliseconds = clamp(end - evaluatedAt.getTime(), 0, totalMilliseconds);
    const progress = totalMilliseconds > 0 ? clamp(elapsedMilliseconds / totalMilliseconds, 0, 1) : 0;
    const status = evaluatedAt.getTime() < start ? "before-passage" : evaluatedAt.getTime() > end ? "after-passage" : "active-passage";
    return {
      evaluatedAt: evaluatedAt.toISOString(),
      status,
      elapsedMilliseconds,
      remainingMilliseconds,
      progress
    };
  }

  function buildRecord({ selectedYear, timeZone, boundaryMode, manualSunset, asOf } = {}) {
    const canonicalRecord = buildCanonicalRecord({ selectedYear, timeZone, boundaryMode, manualSunset });
    const liveState = buildLiveState(canonicalRecord, asOf);
    return {
      canonicalRecord,
      liveState
    };
  }

  function compareYears(firstRecord, secondRecord) {
    const first = canonicalOf(firstRecord);
    const second = canonicalOf(secondRecord);
    return {
      firstYear: first.selectedYear,
      secondYear: second.selectedYear,
      durationDifferenceMilliseconds: second.passage.totalMilliseconds - first.passage.totalMilliseconds,
      equinoxShiftSeconds: Math.round((new Date(second.equinox.utcInstant) - new Date(first.equinox.utcInstant)) / 1000),
      patternPositionDifference: `${first.patternPosition.moonName || "Outside"} ${first.patternPosition.day || ""}`.trim() + ` → ${second.patternPosition.moonName || "Outside"} ${second.patternPosition.day || ""}`.trim(),
      lunarPhaseDifference: `${first.lunarLayer.phaseName} → ${second.lunarLayer.phaseName}`,
      recurrenceNotes: "Observation only. Repeated offsets are not treated as proof of causation."
    };
  }

  globalThis.EquinoxPassageEngine = Object.freeze({
    buildCanonicalRecord,
    buildLiveState,
    buildRecord,
    compareYears
  });
})();
