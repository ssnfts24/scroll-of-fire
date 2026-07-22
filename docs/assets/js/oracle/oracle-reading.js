(() => {
  "use strict";

  function compose({ patternPosition, coreSignature, nameSignature }) {
    const tone = coreSignature.toneProfile;
    const law = coreSignature.livingLaw;

    return {
      foundation: `Moon ${patternPosition.moonNumber || "Outside"} ${patternPosition.moonName || ""} with ${patternPosition.dayArchetype?.name || "Outside Day"} under ${patternPosition.weekGate.title}.`,
      naturalGift: `${tone?.strength || "Discernment"} expressed through ${coreSignature.element.moonElement.toLowerCase()} element discipline.`,
      tension: `${tone?.imbalance || "Overreach"} may appear when ${coreSignature.element.relationship} between moon/day elements is ignored.`,
      developmentPath: `${law?.dailyPractice || "Complete one grounded action."} ${tone?.groundingAction || "Ground through one practical step."}`,
      witnessPractice: tone?.witnessPrompt || "Record one observed pattern before interpretation.",
      practicalAction: `Take one ${coreSignature.flamePath?.name?.toLowerCase() || "coherent"} action and document the outcome.`
    };
  }

  globalThis.GenesisOracleReading = Object.freeze({ compose });
})();
