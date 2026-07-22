(() => {
  "use strict";

  const VERSION = "astronomy/1.0.0";
  const DEFAULT_STUDY_TIME_ZONE = "America/Los_Angeles";
  const DEFAULT_BOUNDARY_MODE = "sunset";
  const DEFAULT_SUNSET = "18:00";
  const SUPPORTED_YEARS = Object.freeze({ start: 2014, end: 2026 });

  globalThis.AstronomyVersion = Object.freeze({
    version: VERSION,
    defaultStudyTimeZone: DEFAULT_STUDY_TIME_ZONE,
    defaultBoundaryMode: DEFAULT_BOUNDARY_MODE,
    defaultSunset: DEFAULT_SUNSET,
    supportedYears: SUPPORTED_YEARS
  });
})();
