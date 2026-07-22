(() => {
  "use strict";

  const TONE_COUNT = 13;

  function carrierFor(number) {
    const carriers = globalThis.GenesisOracleData?.carriers || [];
    const index = Math.abs((Number(number) || 1) - 1) % Math.max(1, carriers.length);
    const active = carriers[index] || { hz: 432, meaning: "Grounding cadence and embodied stability." };
    return {
      ...active,
      reduction: globalThis.GenesisOracleNameCode.reduceNum(active.hz)
    };
  }

  function patternPosition(mapped, boundaryMode, civilWeekday, input) {
    const inside = Boolean(mapped.insideCountedYear);
    const weekGate = inside
      ? globalThis.PatternCalendarData?.weekGates?.[(mapped.weekOfMoon || 1) - 1] || ["Week Gate", ""]
      : [mapped.isDeepTimeDay ? "Deep Time Day" : "Day Out of Time", "Outside the counted 364-day cycle."];

    return {
      patternYear: mapped.patternYear,
      moonNumber: mapped.moon,
      moonName: mapped.moonName,
      dayInMoon: mapped.day,
      dayOfPatternYear: mapped.dayOfPatternYear,
      patternWeekNumber: mapped.weekOfYear,
      weekGate: {
        title: weekGate[0],
        meaning: weekGate[1]
      },
      dayArchetype: mapped.dayArchetype ? { name: mapped.dayArchetype[0], meaning: mapped.dayArchetype[1] } : null,
      civilWeekday,
      boundaryMode,
      outsideDayStatus: {
        outsideCountedYear: !inside,
        isDayOutOfTime: Boolean(mapped.isDayOutOfTime),
        isDeepTimeDay: Boolean(mapped.isDeepTimeDay),
        intercalaryIndex: Number(mapped.intercalaryIndex || 0)
      },
      input
    };
  }

  function coreSignature(patternPosition, birthDateParts) {
    const inside = !patternPosition.outsideDayStatus.outsideCountedYear;
    const tone = inside ? ((patternPosition.dayOfPatternYear - 1) % TONE_COUNT) + 1 : 13;
    const toneData = globalThis.GenesisOracleData?.tones?.[tone - 1];
    const moonData = globalThis.PatternCalendarData?.moons?.[(patternPosition.moonNumber || 13) - 1];
    const dayElement = globalThis.GenesisOracleAspects.dayElement(patternPosition.dayInMoon);
    const moonElement = moonData?.element || "Aether";
    const elementRel = globalThis.GenesisOracleAspects.elementState(moonElement, dayElement);
    const resonantSum = globalThis.GenesisOracleNameCode.reduceNum(
      Number(birthDateParts.year) + Number(birthDateParts.month) + Number(birthDateParts.day)
    );

    const carrier = carrierFor(tone + resonantSum);
    const law = globalThis.GenesisOracleData?.livingLaws?.[tone - 1];
    const flame = globalThis.GenesisOracleData?.flamePaths?.[tone - 1];

    return {
      moonKey: inside ? `M${patternPosition.moonNumber}` : "M-OUTSIDE",
      dayKey: inside ? `D${patternPosition.dayInMoon}` : "D-OUTSIDE",
      weekGate: patternPosition.weekGate.title,
      tone,
      toneProfile: toneData,
      resonantSum,
      element: {
        moonElement,
        dayElement,
        relationship: elementRel.state,
        explanation: elementRel.explanation
      },
      carrier,
      livingLaw: law,
      flamePath: flame,
      primaryArchetype: patternPosition.dayArchetype?.name || patternPosition.weekGate.title,
      supportingArchetype: patternPosition.weekGate.title,
      challengeArchetype: toneData?.imbalance || "Overreach",
      returnPractice: law?.dailyPractice || "Complete one grounded action.",
      derivation: {
        tone: inside
          ? `((dayOfPatternYear - 1) mod 13) + 1 = ${tone}`
          : "Outside-count days are routed to Tone 13 (Seal).",
        resonantSum: `reduce(${birthDateParts.year} + ${birthDateParts.month} + ${birthDateParts.day}) = ${resonantSum}`,
        carrier: `carrier index = (tone + resonantSum - 1) mod ${globalThis.GenesisOracleData?.carriers?.length || 5}`,
        livingLaw: "living law index follows tone index",
        flamePath: "flame path index follows tone index",
        element: "moon element from shared calendar moon metadata + day element from deterministic day-element table"
      }
    };
  }

  globalThis.GenesisOracleSignature = Object.freeze({
    patternPosition,
    coreSignature,
    carrierFor
  });
})();
