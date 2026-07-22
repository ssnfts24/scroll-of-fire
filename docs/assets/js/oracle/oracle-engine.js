(() => {
  "use strict";

  const SYNODIC_MONTH = 29.530588853;
  const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);

  function parseBirthDateParts(dateStr) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || "");
    if (!match) return null;
    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3])
    };
  }

  function moonPhaseName(dateLike) {
    const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
    const noon = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0);
    const age = (((noon - KNOWN_NEW_MOON) / 86400000) % SYNODIC_MONTH + SYNODIC_MONTH) % SYNODIC_MONTH;

    if (age < 1.2 || age > 28.3) return "New Moon";
    if (age < 6.4) return "Waxing Crescent";
    if (age < 8.4) return "First Quarter";
    if (age < 13.8) return "Waxing Gibbous";
    if (age < 16.2) return "Full Moon";
    if (age < 21.6) return "Waning Gibbous";
    if (age < 23.6) return "Last Quarter";
    return "Waning Crescent";
  }

  function shabbatState(dateLike) {
    const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
    const weekday = date.getUTCDay();
    if (weekday === 5) return "Preparation Gate";
    if (weekday === 6) return "Shabbat · Rest";
    if (weekday === 0) return "Return Gate";
    return "Ordinary Day";
  }

  function todayPattern({ now, timeZone, boundaryMode, sunsetTime }) {
    return globalThis.PatternCalendar.fromCivilDate({
      date: now,
      timeZone,
      boundaryMode,
      sunsetTime
    });
  }

  function compareSealProfiles(birthProfile, currentProfile) {
    if (!birthProfile || !currentProfile) return null;

    const sameMoon = birthProfile.patternPosition.moonNumber === currentProfile.patternPosition.moonNumber;
    const sameDay = birthProfile.patternPosition.dayArchetype?.name === currentProfile.patternPosition.dayArchetype?.name;
    const sameTone = birthProfile.coreSignature.tone === currentProfile.coreSignature.tone;
    const sameElement = birthProfile.coreSignature.element.moonElement === currentProfile.coreSignature.element.moonElement;
    const sameWeek = birthProfile.patternPosition.weekGate.title === currentProfile.patternPosition.weekGate.title;

    const support = [];
    const friction = [];

    if (sameMoon) support.push("Birth Moon aligns with current Moon.");
    else friction.push("Birth Moon differs from current Moon rhythm.");

    if (sameDay) support.push("Birth Day Archetype echoes the current Day Archetype.");
    else friction.push("Birth Day Archetype contrasts the current Day Archetype.");

    if (sameTone) support.push("Birth Tone matches the current Tone.");
    else friction.push("Birth Tone and current Tone call for pacing.");

    if (sameElement) support.push("Elemental field is reinforcing.");
    else friction.push("Elemental field has contrast to integrate.");

    if (sameWeek) support.push("Week Gate relationship is coherent.");
    else friction.push("Week Gate relationship is transitional.");

    const presentEmphasis = sameTone && sameElement
      ? "Carry the day with confidence and restraint."
      : "Move deliberately and let contrast refine choices.";

    return {
      symbolicNotice: "Symbolic reflection only. Not a prediction.",
      birthMoonVsCurrentMoon: `${birthProfile.patternPosition.moonName || "Outside"} → ${currentProfile.patternPosition.moonName || "Outside"}`,
      birthDayArchetypeVsCurrentDayArchetype: `${birthProfile.patternPosition.dayArchetype?.name || "Outside"} → ${currentProfile.patternPosition.dayArchetype?.name || "Outside"}`,
      birthToneVsCurrentTone: `${birthProfile.coreSignature.tone} → ${currentProfile.coreSignature.tone}`,
      elementRelationship: `${birthProfile.coreSignature.element.moonElement} → ${currentProfile.coreSignature.element.moonElement}`,
      weekGateRelationship: `${birthProfile.patternPosition.weekGate.title} → ${currentProfile.patternPosition.weekGate.title}`,
      support: support.join(" ") || "Observe support where patterns align.",
      friction: friction.join(" ") || "Observe tension where patterns differ.",
      presentEmphasis,
      witnessQuestion: currentProfile.coreSignature.toneProfile?.question || "What did you observe before interpretation?",
      groundedAction: currentProfile.coreSignature.toneProfile?.groundingAction || "Take one grounded action."
    };
  }

  function buildMirrorReading({ input, birthPattern, birthCore, todayPatternResult, todayCore, todayPosition }) {
    const lunarPhase = moonPhaseName(todayPatternResult.effectiveDateObject || todayPatternResult.effectiveDate);
    const dailyGate = {
      civilDate: todayPatternResult.civilDate,
      effectiveDate: todayPatternResult.effectiveDate,
      patternYear: todayPatternResult.patternYear,
      moon: todayPatternResult.moon,
      moonName: todayPatternResult.moonName,
      moonDay: todayPatternResult.day,
      dayOf364: todayPatternResult.dayOfPatternYear,
      weekGate: todayPosition.weekGate.title,
      dayArchetype: todayPosition.dayArchetype?.name || "Outside Day",
      tone: todayCore.tone,
      visibleLunarPhase: lunarPhase,
      timeZone: todayPatternResult.timeZone,
      boundaryMode: input.boundaryMode,
      manualSunset: input.boundaryMode === "manual" ? input.sunsetTime : null,
      shabbatState: shabbatState(todayPatternResult.effectiveDateObject || todayPatternResult.effectiveDate),
      astronomySource: "approximate-synodic-phase"
    };

    const opening = `${dailyGate.moonName || "Outside"} opens with ${dailyGate.dayArchetype.toLowerCase()} emphasis in ${dailyGate.weekGate}.`;
    const pattern = `Pattern Year ${dailyGate.patternYear} · Moon ${dailyGate.moon || "Outside"} · Day ${dailyGate.moonDay || "Outside"} · Day ${dailyGate.dayOf364 || "Outside"}/364 · Tone ${dailyGate.tone}.`;
    const tension = birthCore.tone === todayCore.tone
      ? "Low tonal tension. Keep the pace steady."
      : "Tonal contrast is active. Slow down enough to integrate signal before action.";
    const practice = todayCore.toneProfile?.groundingAction || "Take one practical step that can be completed today.";
    const witnessQuestion = todayCore.toneProfile?.question || "What pattern did you verify through direct observation today?";
    const closingSeal = `${todayCore.element.explanation} ${todayCore.toneProfile?.witnessPrompt || "Record one observed pattern."}`;

    const threefoldCounsel = {
      signal: todayCore.toneProfile?.function || "Observe the current pattern.",
      crossing: todayCore.element.explanation,
      command: practice
    };

    const currentProfile = {
      patternPosition: todayPosition,
      coreSignature: todayCore
    };

    const mirrorThroughMySeal = input.selectedProfile
      ? compareSealProfiles(input.selectedProfile, currentProfile)
      : null;

    return {
      version: "mirror-reading/2.0.0",
      symbolicNotice: "Symbolic reflection only. Not a prediction.",
      dailyGate,
      opening,
      pattern,
      tension,
      practice,
      witnessQuestion,
      closingSeal,
      threefoldCounsel,
      mirrorThroughMySeal
    };
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
      carrierReduction: coreSignature.carrier.reduction,
      moonElement: coreSignature.element.moonElement,
      dayElement: coreSignature.element.dayElement
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
    const toneResonantDelta = Math.abs(Number(coreSignature.tone || 0) - Number(coreSignature.resonantSum || 0));
    const toneResonantRelationship = toneResonantDelta === 0
      ? "convergent"
      : toneResonantDelta <= 2
        ? "near-harmonic"
        : "divergent";

    const now = input.currentDate ? new Date(input.currentDate) : new Date();
    const today = todayPattern({ now, timeZone, boundaryMode, sunsetTime });
    const todayPosition = globalThis.GenesisOracleSignature.patternPosition(today, boundaryMode, today.civilWeekday, {
      name: "today",
      birthDate: today.civilDate,
      birthTime: "",
      timeKnown: false,
      timeZone,
      sunsetTime,
      boundaryMode
    });
    const nowUtc = new Date(now.toISOString());
    const todayCore = globalThis.GenesisOracleSignature.coreSignature(todayPosition, {
      year: nowUtc.getUTCFullYear(),
      month: nowUtc.getUTCMonth() + 1,
      day: nowUtc.getUTCDate()
    });

    const mirrorReading = buildMirrorReading({
      input,
      birthPattern: patternPosition,
      birthCore: coreSignature,
      todayPatternResult: today,
      todayCore,
      todayPosition
    });

    const currentDayTransit = {
      symbolicNotice: mirrorReading.symbolicNotice,
      birthMoonVsCurrentMoon: `${patternPosition.moonName || "Outside"} → ${todayPosition.moonName || "Outside"}`,
      birthDayArchetypeVsCurrentDayArchetype: `${patternPosition.dayArchetype?.name || "Outside"} → ${todayPosition.dayArchetype?.name || "Outside"}`,
      birthToneVsCurrentTone: `${coreSignature.tone} → ${todayCore.tone}`,
      birthElementVsCurrentElement: `${coreSignature.element.moonElement} → ${todayCore.element.moonElement}`,
      currentEmphasis: mirrorReading.threefoldCounsel.signal,
      supportivePattern: mirrorReading.threefoldCounsel.crossing,
      possibleTension: mirrorReading.tension,
      witnessPrompt: mirrorReading.witnessQuestion,
      groundedAction: mirrorReading.practice
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
      toneResonant: {
        toneRole: "Tone reflects current Pattern-day function and how the day expresses movement.",
        resonantSumRole: "Resonant Sum reflects birth-date reduction and long-cycle signature pressure.",
        relationshipState: toneResonantRelationship,
        delta: toneResonantDelta
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
      quickSeal: reading.quickSeal,
      currentDayTransit,
      dailyMirror: mirrorReading,
      mirrorReading,
      methods
    };
  }

  globalThis.GenesisOracleEngine = Object.freeze({
    run,
    compareProfiles: globalThis.GenesisOracleCompatibility.compare
  });
})();
