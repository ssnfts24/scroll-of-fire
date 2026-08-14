(() => {
  "use strict";

  // Living Time Sphere Model — renderer-neutral data layer.
  // All coordinates follow LivingTimeSphereVersion.coordinateConventions.
  // Zero = Moon 1 Day 1 (Year Gate) at top (0°), clockwise.

  const MOONS = 13;
  const DAYS_PER_MOON = 28;
  const PATTERN_DAYS = 364; // 13 × 28
  const DEFAULT_SHABBAT_CONFIG = Object.freeze({
    moonDays: Object.freeze([2, 9, 16, 23]),
    preparationDay: 1,
    returnDay: 3,
  });
  const SOLAR_ANCHORS = Object.freeze([
    { key: "march-equinox", month: 2, day: 20, cycle: 0.0 },
    { key: "june-solstice", month: 5, day: 20, cycle: 0.25 },
    { key: "september-equinox", month: 8, day: 22, cycle: 0.5 },
    { key: "december-solstice", month: 11, day: 21, cycle: 0.75 },
  ]);

  function assertDependencies() {
    const required = ["AlignmentLedgerData", "LivingTimeSphereVersion"];
    for (const name of required) {
      if (!globalThis[name]) throw new Error(`LivingTimeSphereModel: ${name} is unavailable`);
    }
  }

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  function _canonicalShabbatConfig() {
    const cfg = globalThis.SOF_MOONS_CONFIG?.shabbat || {};
    const moonDays = Array.isArray(cfg.moonDays)
      ? cfg.moonDays.map(Number).filter(v => Number.isInteger(v) && v >= 1 && v <= DAYS_PER_MOON)
      : DEFAULT_SHABBAT_CONFIG.moonDays;
    const preparationDay = Number.isInteger(Number(cfg.preparationDay))
      ? Number(cfg.preparationDay)
      : DEFAULT_SHABBAT_CONFIG.preparationDay;
    const returnDay = Number.isInteger(Number(cfg.returnDay))
      ? Number(cfg.returnDay)
      : DEFAULT_SHABBAT_CONFIG.returnDay;
    return Object.freeze({
      moonDays: Object.freeze(moonDays.length ? moonDays : DEFAULT_SHABBAT_CONFIG.moonDays),
      preparationDay: clamp(preparationDay, 1, DAYS_PER_MOON),
      returnDay: clamp(returnDay, 1, DAYS_PER_MOON),
    });
  }

  // Pattern ring: 364 positions, one per Pattern day.
  // Uses the center of each counted day so every renderer, tooltip, and export
  // describes the same exact Pattern angle.
  function patternAngleForDayOfYear(dayOfYear) {
    const idx = clamp((dayOfYear || 1) - 0.5, 0.5, PATTERN_DAYS - 0.5);
    return Number(((idx / PATTERN_DAYS) * 360).toFixed(6));
  }

  function dayOfYearForPatternAngle(angle) {
    const normalized = ((((Number(angle) || 0) % 360) + 360) % 360);
    return clamp(Math.floor((normalized / 360) * PATTERN_DAYS) + 1, 1, PATTERN_DAYS);
  }

  function dayOfPatternYearFromMoonDay(moonNumber, dayNumber) {
    const moon = clamp(Math.round(Number(moonNumber) || 1), 1, MOONS);
    const day = clamp(Math.round(Number(dayNumber) || 1), 1, DAYS_PER_MOON);
    return ((moon - 1) * DAYS_PER_MOON) + day;
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
  function seasonalProgressAngleForCyclePosition(solarPos) {
    return Number((clamp(solarPos, 0, 1) * 360).toFixed(6));
  }

  function seasonalQuarterProgressForDate(dateInput) {
    const date = dateInput instanceof Date ? new Date(dateInput.getTime()) : new Date(dateInput || Date.now());
    if (Number.isNaN(date.getTime())) {
      return Object.freeze({
        sourceType: "seasonal-approximation",
        precision: "anchor-interpolation",
        source: "seasonal-anchor interpolation",
        anchorKey: "march-equinox",
        nextAnchorKey: "june-solstice",
        seasonalQuarterProgress: 0,
        seasonalCyclePosition: 0,
        seasonalProgressAngle: 0,
      });
    }
    const year = date.getUTCFullYear();
    const anchors = [
      { key: "march-equinox", start: Date.UTC(year, 2, 20), cycle: 0.0 },
      { key: "june-solstice", start: Date.UTC(year, 5, 20), cycle: 0.25 },
      { key: "september-equinox", start: Date.UTC(year, 8, 22), cycle: 0.5 },
      { key: "december-solstice", start: Date.UTC(year, 11, 21), cycle: 0.75 },
      { key: "march-equinox-next", start: Date.UTC(year + 1, 2, 20), cycle: 1.0 },
    ];
    let active = anchors[0];
    let next = anchors[1];
    const now = date.getTime();
    for (let i = 0; i < anchors.length - 1; i += 1) {
      if (now >= anchors[i].start && now < anchors[i + 1].start) {
        active = anchors[i];
        next = anchors[i + 1];
        break;
      }
      if (now < anchors[0].start) {
        active = { key: "december-solstice-prev", start: Date.UTC(year - 1, 11, 21), cycle: -0.25 };
        next = anchors[0];
      }
    }
    const span = Math.max(next.start - active.start, 1);
    const seasonalQuarterProgress = clamp((now - active.start) / span, 0, 1);
    const cycle = active.cycle + (next.cycle - active.cycle) * seasonalQuarterProgress;
    const seasonalCyclePosition = (cycle % 1 + 1) % 1;
    const seasonalProgressAngle = seasonalProgressAngleForCyclePosition(seasonalCyclePosition);
    return Object.freeze({
      sourceType: "seasonal-approximation",
      precision: "anchor-interpolation",
      source: "seasonal-anchor interpolation",
      anchorKey: active.key,
      nextAnchorKey: next.key,
      seasonalQuarterProgress: Number(seasonalQuarterProgress.toFixed(6)),
      seasonalCyclePosition: Number(seasonalCyclePosition.toFixed(6)),
      seasonalProgressAngle,
    });
  }

  function seasonalProgressAngleForDate(dateInput) {
    return seasonalQuarterProgressForDate(dateInput).seasonalProgressAngle;
  }

  function solarSeasonAngleForDate(dateInput) {
    return seasonalProgressAngleForDate(dateInput);
  }

  function dayMetadataForDayOfYear(dayOfPatternYear) {
    const dayOfYear = clamp(Math.round(Number(dayOfPatternYear) || 1), 1, PATTERN_DAYS);
    const moon = Math.floor((dayOfYear - 1) / DAYS_PER_MOON) + 1;
    const day = ((dayOfYear - 1) % DAYS_PER_MOON) + 1;
    const week = Math.floor((day - 1) / 7) + 1;
    const dayOfWeek = ((day - 1) % 7) + 1;
    const shabbatCfg = _canonicalShabbatConfig();
    const moonData = globalThis.PatternCalendarData?.moons?.[moon - 1] || null;
    const weekGate = globalThis.PatternCalendarData?.weekGates?.[week - 1] || null;
    return Object.freeze({
      type: "living-day",
      sourceType: "calendar-calculation",
      source: "PatternCalendarData + fixed-epoch arithmetic",
      moon,
      moonName: moonData?.name || `Moon ${moon}`,
      day,
      dayOfPatternYear: dayOfYear,
      week,
      dayOfWeek,
      weekGate: weekGate ? { label: weekGate[0], detail: weekGate[1] } : null,
      shabbatGate: shabbatCfg.moonDays.includes(day) ? "Shabbat Gate" : null,
      preparationGate: day === shabbatCfg.preparationDay ? "Preparation Gate" : null,
      returnGate: day === shabbatCfg.returnDay ? "Return Gate" : null,
    });
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
      seasonalProgressAngle: seasonalProgressAngleForCyclePosition(solarPos),
      solarSeasonAngle:      seasonalProgressAngleForCyclePosition(solarPos),
      solarGeometry: Object.freeze({
        sourceType: "seasonal-approximation",
        precision: "anchor-interpolation",
        source: "seasonal-anchor interpolation",
      }),
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
      currentSeasonalProgressAngle: seasonalProgressAngleForDate(now),
      currentSolarSeasonAngle: seasonalProgressAngleForDate(now),
      seasonalProgress: seasonalQuarterProgressForDate(now),
      todayPatternPosition,
      viewMode: "today"
    }));
  }

  globalThis.LivingTimeSphereModel = Object.freeze({
    buildYearModel,
    buildSpiral,
    buildTodayModel,
    patternAngleForDayOfYear,
    dayOfYearForPatternAngle,
    dayOfPatternYearFromMoonDay,
    moonSectorAngle,
    dayAngleWithinMoon,
    lunarAngleForCyclePosition,
    seasonalProgressAngleForCyclePosition,
    seasonalQuarterProgressForDate,
    seasonalProgressAngleForDate,
    solarSeasonAngleForDate,
    spiralAngleForYear,
    spiralRadiusForYear,
    dayMetadataForDayOfYear,
    SOLAR_ANCHORS,
    MOONS,
    DAYS_PER_MOON,
    PATTERN_DAYS
  });
})();
