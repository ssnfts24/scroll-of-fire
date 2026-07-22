(() => {
  "use strict";

  function fromRecord(record) {
    const dayIndex = record.normalizedValues.dayIndex;
    const moonIndex = record.normalizedValues.moonIndex;
    return {
      normalizedValues: record.normalizedValues,
      rings: {
        moonSectors: Array.from({ length: 13 }, (_, index) => ({ index, active: index === moonIndex })),
        moonDayPoints: Array.from({ length: 28 }, (_, index) => ({ index, active: index === dayIndex })),
        fixedPatternCalendarRing: {
          moonIndex,
          dayIndex,
          progress: record.normalizedValues.patternCyclePosition
        }
      },
      equinoxPassageArc: {
        start: 0,
        current: record.normalizedValues.passageProgress,
        end: 1,
        label: `${record.selectedYear} Equinox Passage`
      },
      movingEquinoxMarker: {
        position: 0,
        label: record.equinox.utcInstant
      },
      lunarPhaseOrbit: {
        position: record.normalizedValues.lunarCyclePosition,
        label: `${record.lunarLayer.phaseName} · ${record.lunarLayer.illuminationPercent}%`
      },
      solarSeasonAxis: {
        position: record.normalizedValues.solarSeasonPosition,
        label: "March equinox baseline"
      },
      annualComparisonLayers: [],
      futureWitnessPoints: [],
      futureOracleProfileMarkers: [],
      accessibleText: [
        `Pattern ring position: moon ${moonIndex + 1}, day ${dayIndex + 1}.`,
        `Passage progress: ${(record.normalizedValues.passageProgress * 100).toFixed(1)}%.`,
        `Lunar orbit: ${record.lunarLayer.phaseName} at ${record.lunarLayer.illuminationPercent}% illumination.`
      ]
    };
  }

  globalThis.EquinoxPassageVisualizationData = Object.freeze({ fromRecord });
})();
