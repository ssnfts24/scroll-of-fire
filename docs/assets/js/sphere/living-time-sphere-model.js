(() => {
  "use strict";

  // Living Time Sphere Model — renderer-neutral data layer.
  // All coordinates follow LivingTimeSphereVersion.coordinateConventions.
  // Zero = Moon 1 Day 1 (Year Gate) at top (0°), clockwise.

  const MOONS = 13;
  const DAYS_PER_MOON = 28;
  const PATTERN_DAYS = 364; // 13 × 28

  function assertDependencies() {
    const required = ["AlignmentLedgerData", "LivingTimeSphereVersion"];
    for (const name of required) {
      if (!globalThis[name]) throw new Error(`LivingTimeSphereModel: ${name} is unavailable`);
    }
  }

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  // Pattern ring: 364 positions, one per Pattern day.
  // Angle 0° = Moon 1 Day 1 (Year Gate), 360° / 364 per day, clockwise.
  function patternAngleForDayOfYear(dayOfYear) {
    const idx = clamp((dayOfYear || 1) - 1, 0, PATTERN_DAYS - 1);
    return Number(((idx / PATTERN_DAYS) * 360).toFixed(6));
  }

  // Moon-sector angle: center of Moon m's sector.
  function moonSectorAngle(moonIndex) {
    const idx = clamp(moonIndex, 0, MOONS - 1);
    const sectorWidth = 360 / MOONS;
    return Number(((idx * sectorWidth) + sectorWidth / 2).toFixed(6));
  }

  // Day angle within a moon sector.
  function dayAngleWithinMoon(moonIndex, dayIndex) {
    const m = clamp(moonIndex, 0, MOONS - 1);
    const d = clamp(dayIndex,  0, DAYS_PER_MOON - 1);
    const sectorStart = (m / MOONS) * 360;
    const dayStep     = (1 / MOONS / DAYS_PER_MOON) * 360;
    return Number((sectorStart + d * dayStep + dayStep / 2).toFixed(6));
  }

  // Lunar cycle angle: 0° = new moon, 360° = full cycle.
  function lunarAngleForCyclePosition(cyclePosition) {
    return Number((clamp(cyclePosition, 0, 1) * 360).toFixed(6));
  }

  // Solar season angle: 0° = March equinox, 90° = June solstice, etc.
  function solarSeasonAngleForCyclePosition(solarPos) {
    return Number((clamp(solarPos, 0, 1) * 360).toFixed(6));
  }

  // Year spiral: 13-year study window, each year one revolution.
  // Angle 0° = first year (2014), 360° per revolution.
  // Radius: normalized 0–1 from center outward.
  function spiralAngleForYear(year) {
    const { start, end } = globalThis.AlignmentVersion?.studyRange || { start: 2014, end: 2026 };
    const span  = end - start;
    const idx   = clamp(year - start, 0, span);
    return Number(((idx / (span || 1)) * 360 * (span / 13 + 1)).toFixed(6));
  }

  function spiralRadiusForYear(year) {
    const { start, end } = globalThis.AlignmentVersion?.studyRange || { start: 2014, end: 2026 };
    const span = end - start;
    const idx  = clamp(year - start, 0, span);
    return Number((idx / (span || 1)).toFixed(6));
  }

  // Build a complete model for a single year.
  function buildYearModel({ year, timeZone, boundaryMode, manualSunset } = {}) {
    assertDependencies();
    const record = globalThis.AlignmentLedgerData.getRecord({ year, timeZone, boundaryMode, manualSunset });
    const pos    = record.equinox?.patternPosition || {};
    const lunar  = record.equinox?.lunarLayer       || {};
    const offs   = record.offsets                   || {};
    const norm   = record.normalized                || {};

    const dayOfYear    = pos.dayOfPatternYear || 364;
    const moonIndex    = (pos.moon  || 1) - 1;
    const dayIndex     = (pos.day   || 1) - 1;
    const lunarPos     = norm.lunarCyclePosition  || 0;
    const solarPos     = norm.equinoxCyclePosition || 0;

    const passageStartAngle = patternAngleForDayOfYear(dayOfYear);       // equinox position
    const passageEndAngle   = 0;                                          // Year Gate = 0°

    return Object.freeze({
      schemaVersion:   globalThis.LivingTimeSphereVersion.version,
      year,
      patternAngle:         patternAngleForDayOfYear(dayOfYear),
      moonSectorAngle:      moonSectorAngle(moonIndex),
      dayAngleWithinMoon:   dayAngleWithinMoon(moonIndex, dayIndex),
      lunarAngle:           lunarAngleForCyclePosition(lunarPos),
      solarSeasonAngle:     solarSeasonAngleForCyclePosition(solarPos),
      passageStartAngle,
      passageEndAngle,
      yearSpiralAngle:      spiralAngleForYear(year),
      yearSpiralRadius:     spiralRadiusForYear(year),
      layerDepth:           0,
      markers: Object.freeze({
        equinoxGate: Object.freeze({
          angle:  passageStartAngle,
          label:  `${year} Equinox Gate`,
          detail: record.equinox?.utcInstant || ""
        }),
        yearGate: Object.freeze({
          angle:  passageEndAngle,
          label:  `${year} Year Gate (Moon 1, Day 1)`,
          detail: record.yearGate?.instant || ""
        }),
        lunarMarker: Object.freeze({
          angle:  lunarAngleForCyclePosition(lunarPos),
          label:  lunar.phaseName || "Lunar marker",
          detail: lunar.illuminationPercent != null ? `~${lunar.illuminationPercent}% illumination` : ""
        }),
        dayOutOfTime: Object.freeze({
          angle:   patternAngleForDayOfYear(365),
          label:   "Day Out of Time",
          visible: pos.isDayOutOfTime || false
        })
      }),
      passage: Object.freeze({
        startAngle:    passageStartAngle,
        endAngle:      passageEndAngle,
        durationDays:  offs.equinoxToYearGateDays || 0,
        durationHours: Number(((offs.equinoxToYearGateDays || 0) * 24).toFixed(4))
      }),
      moonSectors: Object.freeze(
        Array.from({ length: MOONS }, (_, i) => Object.freeze({
          index:       i,
          moonNumber:  i + 1,
          startAngle:  Number(((i / MOONS) * 360).toFixed(6)),
          endAngle:    Number((((i + 1) / MOONS) * 360).toFixed(6)),
          active:      i === moonIndex
        }))
      ),
      sourceRecord: record
    });
  }

  // Build the 13-year spiral model.
  function buildSpiral({ timeZone, boundaryMode, manualSunset } = {}) {
    assertDependencies();
    const years = globalThis.AlignmentLedgerData.listSupportedYears();
    const yearModels = years.map(year => {
      const m = buildYearModel({ year, timeZone, boundaryMode, manualSunset });
      return Object.freeze({
        year,
        spiralYearIndex: year - (globalThis.AlignmentVersion?.studyRange?.start || 2014),
        yearSpiralAngle: m.yearSpiralAngle,
        yearSpiralRadius: m.yearSpiralRadius,
        equinoxMarkerAngle: m.passageStartAngle,
        yearGateMarkerAngle: m.passageEndAngle,
        passageArcStart: m.passage.startAngle,
        passageArcEnd:   m.passage.endAngle,
        lunarMarkerAngle: m.lunarAngle,
        passageDurationDays: m.passage.durationDays
      });
    });

    return Object.freeze({
      schemaVersion: globalThis.LivingTimeSphereVersion.version,
      studyRange:    globalThis.AlignmentVersion?.studyRange || { start: 2014, end: 2026 },
      years:         Object.freeze(yearModels)
    });
  }

  // Build the "Today" view model using the current date.
  // The today pattern position is derived from PatternCalendar.fromCivilDate using the
  // real current instant, timezone, and boundary mode — NOT from the Equinox year record.
  function buildTodayModel({ timeZone, boundaryMode, manualSunset, asOf } = {}) {
    assertDependencies();
    const now = asOf ? new Date(asOf) : new Date();
    const tz   = timeZone     || "America/Los_Angeles";
    const bm   = boundaryMode || "sunset";
    const ss   = manualSunset || "18:00";

    // Determine which Alignment year record provides the background geometry.
    const nowYear  = now.getUTCFullYear();
    const supported = globalThis.AlignmentLedgerData.listSupportedYears();
    const selectedYear = supported.includes(nowYear) ? nowYear : supported[supported.length - 1];
    const model = buildYearModel({ year: selectedYear, timeZone: tz, boundaryMode: bm, manualSunset: ss });

    // Canonical today Pattern position — always via PatternCalendar, never from the
    // Equinox year record which carries the Equinox-moment position, not today's.
    let todayPatternPosition = null;
    let currentPatternAngle  = model.patternAngle;

    if (globalThis.PatternCalendar) {
      try {
        const pcResult = globalThis.PatternCalendar.fromCivilDate({
          date:         now,
          timeZone:     tz,
          boundaryMode: bm,
          sunsetTime:   ss,
        });
        todayPatternPosition = pcResult;
        if (pcResult.dayOfPatternYear != null) {
          currentPatternAngle = patternAngleForDayOfYear(pcResult.dayOfPatternYear);
        } else {
          // Outside counted year (Day Out of Time / Deep Time Day)
          currentPatternAngle = patternAngleForDayOfYear(365);
        }
      } catch (_) { /* fall back to year-model angle */ }
    }

    return Object.freeze(Object.assign({}, model, {
      currentPatternAngle,
      todayPatternPosition,
      viewMode: "today"
    }));
  }

  globalThis.LivingTimeSphereModel = Object.freeze({
    buildYearModel,
    buildSpiral,
    buildTodayModel,
    patternAngleForDayOfYear,
    moonSectorAngle,
    dayAngleWithinMoon,
    lunarAngleForCyclePosition,
    spiralAngleForYear,
    spiralRadiusForYear,
    MOONS,
    DAYS_PER_MOON,
    PATTERN_DAYS
  });
})();
