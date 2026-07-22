(() => {
  "use strict";

  globalThis.GenesisOracleVersion = Object.freeze({
    oracleVersion: "genesis-oracle/2.0.0",
    calendarVersion: globalThis.PatternCalendarVersion?.version || "pattern-calendar/unknown"
  });
})();
