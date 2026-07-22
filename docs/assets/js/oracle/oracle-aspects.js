(() => {
  "use strict";

  function timeGateFor(time, timeKnown) {
    if (!timeKnown) {
      return {
        gate: "unknown",
        label: "Unknown",
        note: "Birth time not provided; time-specific layer omitted. Noon may still be used for stable date mapping only."
      };
    }

    const [hour] = String(time || "12:00").split(":").map(Number);
    if (hour >= 5 && hour < 8) return { gate: "dawn", label: "Dawn" };
    if (hour >= 8 && hour < 11) return { gate: "rising", label: "Rising" };
    if (hour >= 11 && hour < 14) return { gate: "zenith", label: "Zenith" };
    if (hour >= 14 && hour < 17) return { gate: "descending", label: "Descending" };
    if (hour >= 17 && hour < 20) return { gate: "dusk", label: "Dusk" };
    return { gate: "deep-night", label: "Deep Night" };
  }

  function elementState(moonElement, dayElement) {
    const state = globalThis.GenesisOracleData?.elementMatrix?.[moonElement]?.[dayElement] || "balance";
    const explanation = globalThis.GenesisOracleData?.elementRelationshipText?.[state] || "Element relationship is balanced.";
    return { state, explanation };
  }

  function dayElement(dayInMoon) {
    if (!dayInMoon) return "Aether";
    return globalThis.GenesisOracleData?.dayElements?.[Math.max(0, dayInMoon - 1)] || "Aether";
  }

  globalThis.GenesisOracleAspects = Object.freeze({
    timeGateFor,
    dayElement,
    elementState
  });
})();
