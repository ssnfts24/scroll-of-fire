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

  function buildAnnualSignature(record) {
    const duration = globalThis.EquinoxPassageFormat.durationText(record.passage.totalMilliseconds);
    return {
      calculated: `Equinox entered at ${record.patternPosition.moonName || "Outside Gate"}${record.patternPosition.day ? ` · Day ${record.patternPosition.day}` : ""}.`,
      astronomical: `${record.lunarLayer.phaseName} with approximately ${record.lunarLayer.illuminationPercent}% illumination.`,
      symbolic: `${record.patternPosition.weekGate} frames a ${record.patternPosition.archetype} threshold without claiming causation.`,
      observational: `Passage length: ${duration}. No conclusion until witness records are collected.`
    };
  }

  function normalizedValues(record) {
    const dayIndex = record.patternPosition.day ? record.patternPosition.day - 1 : 27;
    const moonIndex = record.patternPosition.moon ? record.patternPosition.moon - 1 : 12;
    const dayOfYear = record.patternPosition.dayOfPatternYear || 364;
    return {
      patternCyclePosition: Number((((dayOfYear - 1) || 0) / 364).toFixed(6)),
      moonIndex,
      dayIndex,
      yearProgress: Number((((dayOfYear - 1) || 0) / 364).toFixed(6)),
      passageProgress: Number(record.passage.progress.toFixed(6)),
      equinoxCyclePosition: Number((((new Date(record.equinox.utcInstant).getUTCMonth() * 31) + new Date(record.equinox.utcInstant).getUTCDate()) / 366).toFixed(6)),
      lunarCyclePosition: Number(record.lunarLayer.cyclePosition.toFixed(6)),
      solarSeasonPosition: 0
    };
  }

  function buildRecord({ selectedYear, timeZone, boundaryMode, manualSunset, asOf } = {}) {
    assertDependencies();
    const year = globalThis.EquinoxEngine.normalizeYear(selectedYear);
    const zone = globalThis.TimeZoneTools.safeTimeZone(timeZone || globalThis.AstronomyVersion.defaultStudyTimeZone);
    const mode = safeBoundaryMode(boundaryMode || globalThis.AstronomyVersion.defaultBoundaryMode);
    const sunsetTime = safeSunset(manualSunset || globalThis.AstronomyVersion.defaultSunset);
    const evaluationDate = asOf ? new Date(asOf) : new Date();
    const equinox = globalThis.EquinoxEngine.describeEquinox(year, zone);
    const patternPosition = patternPositionForInstant(equinox.utcDate, zone, mode, sunsetTime);
    const endDate = globalThis.TimeZoneTools.startOfPatternYearUtc(year, zone, mode, sunsetTime);
    const totalMilliseconds = endDate.getTime() - equinox.utcDate.getTime();
    const elapsedMilliseconds = clamp(evaluationDate.getTime() - equinox.utcDate.getTime(), 0, totalMilliseconds);
    const remainingMilliseconds = clamp(endDate.getTime() - evaluationDate.getTime(), 0, totalMilliseconds);
    const progress = totalMilliseconds > 0 ? elapsedMilliseconds / totalMilliseconds : 0;
    const civilDate = globalThis.TimeZoneTools.localDateKey(equinox.utcDate, zone);
    const endCivilDate = globalThis.TimeZoneTools.localDateKey(endDate, zone);
    const effectiveTarget = `${year}-04-17`;
    const selectedPatternBoundariesCrossed = dayDiffIso(effectiveTarget, patternPosition.effectiveDate);
    const civilMidnightsCrossed = dayDiffIso(endCivilDate, civilDate);
    const passageState = evaluationDate < equinox.utcDate ? "before-passage" : evaluationDate > endDate ? "after-passage" : "active-passage";

    const record = {
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
        precisionSeconds: equinox.precisionSeconds,
        claimedPrecision: equinox.claimedPrecision,
        status: equinox.status,
        validationStatus: equinox.validationStatus,
        validationDeltaSeconds: equinox.validationDeltaSeconds,
        generatedOrImportedAt: equinox.importedAt
      },
      patternPosition,
      passage: {
        state: passageState,
        startInstant: equinox.utcInstant,
        endInstant: endDate.toISOString(),
        totalMilliseconds,
        totalDays: Number((totalMilliseconds / 86400000).toFixed(6)),
        elapsedMilliseconds,
        remainingMilliseconds,
        progress,
        civilMidnightsCrossed,
        selectedPatternBoundariesCrossed
      },
      lunarLayer: equinox.lunarLayer,
      annualSignature: null,
      normalizedValues: null,
      sources: [
        {
          layer: "astronomical-fact",
          source: equinox.source,
          sourceVersion: equinox.sourceVersion,
          exactUtcInstant: equinox.utcInstant,
          precisionSeconds: equinox.precisionSeconds,
          sourced: true,
          validationStatus: equinox.validationStatus,
          validationDeltaSeconds: equinox.validationDeltaSeconds,
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
      ],
      generatedAt: new Date().toISOString()
    };

    record.annualSignature = buildAnnualSignature(record);
    record.normalizedValues = normalizedValues(record);
    return record;
  }

  function compareYears(firstRecord, secondRecord) {
    return {
      firstYear: firstRecord.selectedYear,
      secondYear: secondRecord.selectedYear,
      durationDifferenceMilliseconds: secondRecord.passage.totalMilliseconds - firstRecord.passage.totalMilliseconds,
      equinoxShiftSeconds: Math.round((new Date(secondRecord.equinox.utcInstant) - new Date(firstRecord.equinox.utcInstant)) / 1000),
      patternPositionDifference: `${firstRecord.patternPosition.moonName || "Outside"} ${firstRecord.patternPosition.day || ""}`.trim() + ` → ${secondRecord.patternPosition.moonName || "Outside"} ${secondRecord.patternPosition.day || ""}`.trim(),
      lunarPhaseDifference: `${firstRecord.lunarLayer.phaseName} → ${secondRecord.lunarLayer.phaseName}`,
      recurrenceNotes: "Observation only. Repeated offsets are not treated as proof of causation."
    };
  }

  globalThis.EquinoxPassageEngine = Object.freeze({
    buildRecord,
    compareYears
  });
})();
