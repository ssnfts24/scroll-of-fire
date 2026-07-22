(() => {
  "use strict";

  function parseBirthDateParts(dateStr) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || "");
    if (!match) return null;
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3])
    };
  }

  function todayPattern({ timeZone, boundaryMode, sunsetTime }) {
    return globalThis.PatternCalendar.fromCivilDate({
      date: new Date(),
      timeZone,
      boundaryMode,
      sunsetTime
    });
  }

  function run(input) {
    const timeZone = input.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const boundaryMode = ["midnight", "sunset", "manual"].includes(input.boundaryMode) ? input.boundaryMode : "midnight";
    const sunsetTime = input.sunsetTime || "18:00";

    if (!globalThis.PatternCalendar) {
      throw new Error("Pattern Calendar engine is unavailable.");
    }

    const birthParts = parseBirthDateParts(input.birthDate);
    if (!birthParts) {
      throw new Error("Birth date must be in YYYY-MM-DD format.");
    }

    const timeKnown = Boolean((input.birthTime || "").trim());
    const effectiveBirthMoment = `${input.birthDate}T${timeKnown ? input.birthTime : "12:00"}:00`;
    const mapped = globalThis.PatternCalendar.fromCivilDate({
      date: effectiveBirthMoment,
      timeZone,
      boundaryMode,
      sunsetTime
    });

    const patternPosition = globalThis.GenesisOracleSignature.patternPosition(
      mapped,
      boundaryMode,
      mapped.civilWeekday,
      {
        name: input.name || "",
        birthDate: input.birthDate,
        birthTime: timeKnown ? input.birthTime : "",
        timeKnown,
        timeZone,
        sunsetTime,
        boundaryMode,
        effectiveBirthMoment
      }
    );

    const coreSignature = globalThis.GenesisOracleSignature.coreSignature(patternPosition, birthParts);

    const nameSignature = globalThis.GenesisOracleNameCode.compute(input.name || "", {
      moonNumber: patternPosition.moonNumber,
      dayInMoon: patternPosition.dayInMoon,
      tone: coreSignature.tone,
      resonantSum: coreSignature.resonantSum,
      carrierReduction: coreSignature.carrier.reduction
    });

    const birthTimeLayer = {
      ...globalThis.GenesisOracleAspects.timeGateFor(input.birthTime, timeKnown),
      timezone: timeZone,
      source: timeKnown ? "provided-local-time" : "time-unknown"
    };

    const relationships = {
      nameToBirthResonance: nameSignature.nameToBirthResonance,
      elementRelationship: coreSignature.element
    };

    const reading = globalThis.GenesisOracleReading.compose({
      patternPosition,
      coreSignature,
      nameSignature
    });

    const today = todayPattern({ timeZone, boundaryMode, sunsetTime });
    const todayPosition = globalThis.GenesisOracleSignature.patternPosition(today, boundaryMode, today.civilWeekday, {
      name: "today",
      birthDate: today.civilDate,
      birthTime: "",
      timeKnown: false,
      timeZone,
      sunsetTime,
      boundaryMode
    });
    const todayCore = globalThis.GenesisOracleSignature.coreSignature(todayPosition, {
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      day: new Date().getDate()
    });

    const currentDayTransit = {
      symbolicNotice: "Symbolic reflection only. Not a prediction.",
      birthMoonVsCurrentMoon: `${patternPosition.moonName || "Outside"} → ${todayPosition.moonName || "Outside"}`,
      birthDayArchetypeVsCurrentDayArchetype: `${patternPosition.dayArchetype?.name || "Outside"} → ${todayPosition.dayArchetype?.name || "Outside"}`,
      birthToneVsCurrentTone: `${coreSignature.tone} → ${todayCore.tone}`,
      birthElementVsCurrentElement: `${coreSignature.element.moonElement} → ${todayCore.element.moonElement}`,
      currentEmphasis: todayCore.toneProfile?.function || "Observe the current pattern.",
      supportivePattern: todayCore.element.explanation,
      possibleTension: coreSignature.tone === todayCore.tone ? "Low tonal tension." : "Different tones may require pacing.",
      witnessPrompt: todayCore.toneProfile?.witnessPrompt || "Record one observed pattern.",
      groundedAction: todayCore.toneProfile?.groundingAction || "Take one practical step."
    };

    const methods = {
      inputNormalization: "Name trimmed; birth date must be YYYY-MM-DD; timezone falls back to browser timezone.",
      effectiveCivilDate: mapped.civilDate,
      patternCalendarResult: {
        calendarVersion: mapped.calendarVersion,
        moon: mapped.moon,
        day: mapped.day,
        dayOfPatternYear: mapped.dayOfPatternYear,
        outside: !mapped.insideCountedYear,
        boundaryMode,
        sunsetTime
      },
      formulasUsed: coreSignature.derivation,
      nameCodeValues: {
        pythagorean: nameSignature.latinPythagorean,
        a1z26: nameSignature.latinA1Z26,
        hebrew: nameSignature.hebrew
      },
      relationshipRules: {
        nameToBirth: "direct=2+ key matches, harmonic=1 match, complementary=parity contrast, neutral=otherwise",
        elements: "state lookup from deterministic element relationship matrix"
      },
      calendarVersion: globalThis.GenesisOracleVersion?.calendarVersion || mapped.calendarVersion,
      oracleVersion: globalThis.GenesisOracleVersion?.oracleVersion || "genesis-oracle/2.0.0",
      distinctions: {
        calculatedValues: "Pattern mapping, tone, sums, reductions, and matrix lookups.",
        symbolicMappings: "Living Law, Flame Path, archetypal labels tied to deterministic indexes.",
        reflectiveInterpretation: "Human-readable sections generated from deterministic values.",
        futureExperimentalLayers: "No experimental/random layers are active in Oracle 2.0."
      }
    };

    return {
      calendarVersion: methods.calendarVersion,
      oracleVersion: methods.oracleVersion,
      input: {
        name: input.name || "",
        birthDate: input.birthDate,
        birthTime: timeKnown ? input.birthTime : "",
        timeKnown,
        timeZone,
        boundaryMode,
        sunsetTime
      },
      patternPosition,
      coreSignature,
      nameSignature,
      birthTimeLayer,
      relationships,
      reading,
      currentDayTransit,
      dailyMirror: currentDayTransit,
      methods
    };
  }

  globalThis.GenesisOracleEngine = Object.freeze({
    run,
    compareProfiles: globalThis.GenesisOracleCompatibility.compare
  });
})();
