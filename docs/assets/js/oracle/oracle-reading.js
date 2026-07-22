(() => {
  "use strict";

  function compose({ patternPosition, coreSignature, nameSignature }) {
    const tone = coreSignature.toneProfile;
    const law = coreSignature.livingLaw;
    const lawForms = law?.forms || {};
    const moonName = patternPosition.moonName || "Outside";
    const dayName = patternPosition.dayArchetype?.name || "Outside Day";
    const weekGate = patternPosition.weekGate.title;
    const element = coreSignature.element;
    const relationshipVerb = element.relationship === "reinforcement"
      ? "reinforce each other"
      : element.relationship === "friction"
        ? "create productive friction"
        : element.relationship === "transformation"
          ? "transform through integration"
          : element.relationship === "grounding"
            ? "ground each other"
            : "hold balance";

    return {
      foundation: `Moon ${patternPosition.moonNumber || "Outside"} ${moonName} carries ${dayName} within ${weekGate}.`,
      naturalGift: `${tone?.strength || "Discernment"} is available when ${lawForms.actionForm || "practice"} remains ${lawForms.qualityForm || "steady"}.`,
      tension: `${tone?.imbalance || "Overreach"} rises when ${element.moonElement} and ${element.dayElement} ${relationshipVerb} without conscious pacing.`,
      developmentPath: `${lawForms.matureExpression || law?.matureExpression || "Stay consistent with one coherent measure."}`,
      witnessPractice: `${tone?.witnessPrompt || "Record one observed pattern before interpretation."}`,
      practicalAction: `${lawForms.practicalExpression || law?.dailyPractice || "Complete one grounded action."}`,
      quickSeal: `${moonName} meets ${dayName} through Tone ${coreSignature.tone} (${tone?.name || "Seal"}) in ${weekGate}. ${element.moonElement} with ${element.dayElement} now ${relationshipVerb}; choose one grounded action and record the witness.`
    };
  }

  globalThis.GenesisOracleReading = Object.freeze({ compose });
})();
