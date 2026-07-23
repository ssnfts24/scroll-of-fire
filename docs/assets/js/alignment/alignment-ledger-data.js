(() => {
  "use strict";

  // In-memory cache: keyed by "year:tz:boundary:sunset"
  const _cache = new Map();

  function cacheKey(year, timeZone, boundaryMode, manualSunset) {
    return `${year}:${timeZone}:${boundaryMode}:${manualSunset}`;
  }

  function assertDependencies() {
    const required = ["AlignmentLedgerEngine", "AlignmentVersion"];
    for (const name of required) {
      if (!globalThis[name]) throw new Error(`AlignmentLedgerData: ${name} is unavailable`);
    }
  }

  function getRecord({ year, timeZone, boundaryMode, manualSunset } = {}) {
    assertDependencies();
    const tz       = timeZone     || "America/Los_Angeles";
    const boundary = boundaryMode || "sunset";
    const sunset   = manualSunset || "18:00";
    const key      = cacheKey(year, tz, boundary, sunset);

    if (_cache.has(key)) return _cache.get(key);

    const record = globalThis.AlignmentLedgerEngine.buildRecord({
      selectedYear: year,
      timeZone: tz,
      boundaryMode: boundary,
      manualSunset: sunset
    });
    _cache.set(key, record);
    return record;
  }

  function getAllRecords({ timeZone, boundaryMode, manualSunset } = {}) {
    assertDependencies();
    return globalThis.AlignmentLedgerEngine.listSupportedYears().map(year =>
      getRecord({ year, timeZone, boundaryMode, manualSunset })
    );
  }

  function listSupportedYears() {
    assertDependencies();
    return globalThis.AlignmentLedgerEngine.listSupportedYears();
  }

  function clearCache() {
    _cache.clear();
  }

  globalThis.AlignmentLedgerData = Object.freeze({
    getRecord,
    getAllRecords,
    listSupportedYears,
    clearCache
  });
})();
