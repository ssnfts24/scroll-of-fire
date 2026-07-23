(() => {
  "use strict";

  function clamp(value, min = 0, max = 1) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function canonicalOf(record) {
    return record?.canonicalRecord || record || {};
  }

  function liveOf(record) {
    return record?.liveState || null;
  }

  function fromRecord(record) {
    const canonical = canonicalOf(record);
    const liveState = liveOf(record);
    const normalized = canonical.normalizedValues || {};
    const dayIndex = clamp(normalized.dayIndex, 0, 27);
    const moonIndex = clamp(normalized.moonIndex, 0, 12);
    const passageProgress = clamp(liveState?.progress, 0, 1);
    const lunarCyclePosition = canonical.lunarLayer ? clamp(normalized.lunarCyclePosition, 0, 1) : null;
    const phaseName = canonical.lunarLayer?.phaseName || "Lunar data unavailable";
    const illuminationPercent = canonical.lunarLayer?.illuminationPercent ?? null;

    return {
      patternCyclePosition: clamp(normalized.patternCyclePosition, 0, 1),
      moonIndex,
      dayIndex,
      yearProgress: clamp(normalized.yearProgress, 0, 1),
      passageProgress,
      equinoxCyclePosition: clamp(normalized.equinoxCyclePosition, 0, 1),
      lunarCyclePosition,
      solarSeasonPosition: clamp(normalized.solarSeasonPosition, 0, 1),
      rings: {
        moonSectors: Array.from({ length: 13 }, (_, index) => ({ index, active: index === moonIndex })),
        moonDayPoints: Array.from({ length: 28 }, (_, index) => ({ index, active: index === dayIndex })),
        fixedPatternCalendarRing: {
          moonIndex,
          dayIndex,
          progress: clamp(normalized.patternCyclePosition, 0, 1)
        }
      },
      equinoxPassageArc: {
        start: 0,
        current: passageProgress,
        end: 1,
        label: `${canonical.selectedYear || "Unknown"} Equinox Passage`
      },
      movingEquinoxMarker: {
        position: 0,
        label: canonical.equinox?.utcInstant || "Unknown equinox"
      },
      lunarPhaseOrbit: {
        position: lunarCyclePosition,
        label: illuminationPercent == null ? phaseName : `${phaseName} · ${illuminationPercent}%`
      },
      solarSeasonAxis: {
        position: clamp(normalized.solarSeasonPosition, 0, 1),
        label: "March equinox baseline"
      },
      annualComparisonLayers: [],
      futureWitnessPoints: [],
      futureOracleProfileMarkers: [],
      accessibleText: [
        `Pattern ring position: moon ${moonIndex + 1}, day ${dayIndex + 1}.`,
        `Passage progress: ${(passageProgress * 100).toFixed(1)}%.`,
        illuminationPercent == null ? "Lunar orbit data unavailable." : `Lunar orbit: ${phaseName} at ${illuminationPercent}% illumination.`
      ]
    };
  }

  globalThis.EquinoxPassageVisualizationData = Object.freeze({ fromRecord });
})();
