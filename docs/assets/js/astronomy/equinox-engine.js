(() => {
  "use strict";

  function assertDependencies() {
    if (!globalThis.EquinoxReferenceData) throw new Error("EquinoxReferenceData is unavailable");
    if (!globalThis.TimeZoneTools) throw new Error("TimeZoneTools is unavailable");
    if (!globalThis.LunarAtEquinox) throw new Error("LunarAtEquinox is unavailable");
  }

  function supportedYears() {
    assertDependencies();
    return globalThis.EquinoxReferenceData.records.map(record => record.year);
  }

  function normalizeYear(year) {
    const numeric = Number(year);
    if (!Number.isInteger(numeric)) throw new RangeError("Invalid year");
    const record = globalThis.EquinoxReferenceData.byYear(numeric);
    if (!record) throw new RangeError(`No equinox reference record for ${numeric}`);
    return numeric;
  }

  function getReferenceRecord(year) {
    assertDependencies();
    const numeric = normalizeYear(year);
    const record = globalThis.EquinoxReferenceData.byYear(numeric);
    if (!record) throw new RangeError(`Missing source record for ${numeric}`);
    return record;
  }

  function describeEquinox(year, timeZone) {
    const zone = globalThis.TimeZoneTools.safeTimeZone(timeZone || globalThis.AstronomyVersion?.defaultStudyTimeZone || "UTC");
    const reference = getReferenceRecord(year);
    const sourceMetadata = globalThis.EquinoxReferenceData.sourceMetadata;
    const utcDate = new Date(reference.utcInstant);
    const localInstant = globalThis.TimeZoneTools.localIsoFromInstant(utcDate, zone);
    const civilDate = globalThis.TimeZoneTools.localDateKey(utcDate, zone);
    const lunarLayer = globalThis.LunarAtEquinox.buildLayer(utcDate);

    return {
      year: reference.year,
      utcInstant: reference.utcInstant,
      utcDate,
      localInstant,
      civilDate,
      timeZone: zone,
      source: reference.source,
      sourceVersion: reference.sourceVersion,
      sourceIntegrityStatus: reference.sourceIntegrityStatus,
      dataOrigin: reference.dataOrigin,
      timestampResolutionSeconds: reference.timestampResolutionSeconds,
      validationToleranceSeconds: reference.validationToleranceSeconds,
      maximumMeasuredDeviationSeconds: reference.maximumMeasuredDeviationSeconds,
      maximumDeviationYear: reference.maximumDeviationYear,
      primarySourceUrl: sourceMetadata.primarySource.primarySourceUrl,
      sourceTableUrl: sourceMetadata.primarySource.sourceTableUrl,
      validationUrl: sourceMetadata.independentValidation.independentValidationUrl,
      validationMethod: sourceMetadata.independentValidation.validationMethod,
      skyfieldVersion: sourceMetadata.primarySource.skyfieldVersion,
      jplKernelFilename: sourceMetadata.primarySource.jplKernelFilename,
      ephemerisVersionOrChecksum: sourceMetadata.primarySource.ephemerisVersionOrChecksum,
      timescale: sourceMetadata.primarySource.timescale,
      equinoxFindingAlgorithm: sourceMetadata.primarySource.equinoxFindingAlgorithm,
      generationScriptPath: sourceMetadata.primarySource.generationScriptPath,
      timestampRoundingPolicy: sourceMetadata.primarySource.timestampRoundingPolicy,
      generationTimestamp: sourceMetadata.generationTimestamp,
      status: reference.calculated ? "calculated" : "sourced",
      calculated: reference.calculated,
      validationStatus: reference.validationStatus,
      validationDeltaSeconds: reference.validationDeltaSeconds,
      validationUtcInstant: reference.validationUtcInstant,
      importedAt: reference.importedAt,
      sourceMetadata,
      lunarLayer
    };
  }

  globalThis.EquinoxEngine = Object.freeze({
    supportedYears,
    normalizeYear,
    getReferenceRecord,
    describeEquinox
  });
})();
