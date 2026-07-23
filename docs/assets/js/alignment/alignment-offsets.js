(() => {
  "use strict";

  // Alignment offset helpers — extract and format offset measurements from records.

  function assertRecord(record) {
    if (!record || typeof record.offsets !== "object") throw new Error("AlignmentOffsets: invalid record");
  }

  function offsetSummary(record) {
    assertRecord(record);
    const o = record.offsets;
    const passageDays  = o.equinoxToYearGateDays;
    const passageHours = Number((passageDays * 24).toFixed(4));
    const passageMins  = Number((passageDays * 1440).toFixed(2));

    const pos = record.equinox?.patternPosition || {};

    return {
      year:                          record.year,
      equinoxUtcInstant:             record.equinox?.utcInstant || "",
      yearGateInstant:               record.yearGate?.instant   || "",
      equinoxToYearGateMilliseconds: o.equinoxToYearGateMilliseconds,
      equinoxToYearGateDays:         passageDays,
      equinoxToYearGateHours:        passageHours,
      equinoxToYearGateMinutes:      passageMins,
      patternDayOffset:              o.patternDayOffset,
      moonOffset:                    o.moonOffset,
      dayWithinMoonOffset:           o.dayWithinMoonOffset,
      weekGateOffset:                o.weekGateOffset,
      toneOffset:                    o.toneOffset,
      lunarCycleOffset:              o.lunarCycleOffset,
      equinoxMoon:                   pos.moon     || null,
      equinoxMoonName:               pos.moonName || null,
      equinoxDay:                    pos.day      || null,
      equinoxWeekGate:               pos.weekGate || null,
      equinoxArchetype:              pos.archetype || null,
      equinoxLunarPhase:             record.equinox?.lunarLayer?.phaseName || null,
      equinoxLunarIllumination:      record.equinox?.lunarLayer?.illuminationPercent ?? null
    };
  }

  function passageLength(record) {
    assertRecord(record);
    const ms    = record.offsets.equinoxToYearGateMilliseconds;
    const days  = record.offsets.equinoxToYearGateDays;
    const hours = Number((days * 24).toFixed(4));
    return { milliseconds: ms, days, hours };
  }

  function patternMovement(record) {
    assertRecord(record);
    return {
      patternDayOffset:    record.offsets.patternDayOffset,
      moonOffset:          record.offsets.moonOffset,
      dayWithinMoonOffset: record.offsets.dayWithinMoonOffset
    };
  }

  function lunarOffset(record) {
    assertRecord(record);
    return {
      lunarCycleOffset: record.offsets.lunarCycleOffset,
      lunarPhase:       record.equinox?.lunarLayer?.phaseName || null,
      illumination:     record.equinox?.lunarLayer?.illuminationPercent ?? null,
      cyclePosition:    record.normalized?.lunarCyclePosition ?? null
    };
  }

  globalThis.AlignmentOffsets = Object.freeze({
    offsetSummary,
    passageLength,
    patternMovement,
    lunarOffset
  });
})();
