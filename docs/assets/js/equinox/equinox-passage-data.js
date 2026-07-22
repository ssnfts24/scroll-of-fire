(() => {
  "use strict";

  function listYears() {
    return globalThis.EquinoxReferenceData.records.map(record => record.year);
  }

  function buildHistoricalDataset({ timeZone, boundaryMode, manualSunset, asOf } = {}) {
    return listYears().map(year => globalThis.EquinoxPassageEngine.buildRecord({
      selectedYear: year,
      timeZone: timeZone || globalThis.AstronomyVersion.defaultStudyTimeZone,
      boundaryMode: boundaryMode || globalThis.AstronomyVersion.defaultBoundaryMode,
      manualSunset: manualSunset || globalThis.AstronomyVersion.defaultSunset,
      asOf
    }));
  }

  globalThis.EquinoxPassageData = Object.freeze({
    listYears,
    buildHistoricalDataset
  });
})();
