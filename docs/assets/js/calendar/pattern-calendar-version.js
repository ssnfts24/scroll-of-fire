(() => {
  "use strict";

  const VERSION = "pattern-calendar/1.0.0";
  const EPOCH = "2026-04-17";

  globalThis.PatternCalendarVersion = Object.freeze({
    version: VERSION,
    epoch: EPOCH,
    epochMoon: 1,
    epochDay: 1,
    epochDayOfPatternYear: 1,
    epochDescription: "April 17, 2026 = Moon 1 · Day 1 · Day 1/364"
  });
})();
