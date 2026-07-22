(() => {
  "use strict";

  function compare(a, b) {
    const moonDelta = Math.abs((a?.patternPosition?.moonNumber || 0) - (b?.patternPosition?.moonNumber || 0));
    const toneDelta = Math.abs((a?.coreSignature?.tone || 0) - (b?.coreSignature?.tone || 0));

    const sameElement = a?.coreSignature?.element?.moonElement === b?.coreSignature?.element?.moonElement;
    const weekMatch = a?.patternPosition?.weekGate?.title === b?.patternPosition?.weekGate?.title;

    const communication = toneDelta <= 2 ? "Communication cadence is naturally aligned." : "Communication may need explicit pacing and recap.";

    return {
      moonRelationship: moonDelta === 0 ? "same moon" : moonDelta <= 3 ? "near-cycle" : "far-cycle",
      toneRelationship: toneDelta === 0 ? "same tone" : toneDelta <= 3 ? "adjacent tone" : "cross-tone",
      elementRelationship: sameElement ? "shared element" : `${a?.coreSignature?.element?.moonElement || "Unknown"} ↔ ${b?.coreSignature?.element?.moonElement || "Unknown"}`,
      weekGateRelationship: weekMatch ? "shared week gate" : "different week gates",
      nameNumberResonance: a?.nameSignature?.nameToBirthResonance?.classification === b?.nameSignature?.nameToBirthResonance?.classification
        ? "parallel resonance"
        : "mixed resonance",
      communicationTendency: communication,
      sharedStrength: weekMatch ? "Shared week gate provides synchronized pacing." : "Different week gates broaden perspective.",
      likelyTension: sameElement ? "Low elemental friction." : "Elemental contrast may create useful tension.",
      practicalBridge: "Set one shared witness prompt and one concrete action for each profile."
    };
  }

  globalThis.GenesisOracleCompatibility = Object.freeze({ compare });
})();
