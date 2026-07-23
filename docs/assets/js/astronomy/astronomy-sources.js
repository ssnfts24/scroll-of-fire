(() => {
  "use strict";

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return value;
  }

  const sourceMetadata = deepFreeze({
  "schemaVersion": "equinox-source-metadata/1.0.0",
  "datasetVersion": "equinox-passage/1.0.0",
  "astronomyVersion": "astronomy/1.0.0",
  "calendarVersion": "pattern-calendar/1.0.0",
  "dataOrigin": "third-party-copied-and-validated",
  "sourceIntegrityStatus": "partial-unverified-third-party-source-chain",
  "canonicalDataset": {
    "timeZone": "America/Los_Angeles",
    "boundaryMode": "sunset",
    "manualSunset": "18:00"
  },
  "timestampResolutionSeconds": 1,
  "validationToleranceSeconds": 3,
  "maximumMeasuredDeviationSeconds": 2.057,
  "maximumDeviationYear": 2022,
  "generationTimestamp": "2026-07-22T00:00:00Z",
  "primarySource": {
    "label": "janmr.com equinoxes and solstices table",
    "websiteUrl": "https://janmr.com/",
    "primarySourceUrl": "unknown",
    "sourceTableUrl": "unknown",
    "retrievalDate": "2026-07-22",
    "sourceRevisionOrChecksum": "6262e4eb07b8de0d45f2256eef9f5b94bf3f8fdc",
    "copiedIntoRepository": true,
    "generatedInsideRepository": false,
    "skyfieldVersion": "unknown",
    "jplKernelFilename": "unknown",
    "ephemerisVersionOrChecksum": "unknown",
    "timescale": "UTC",
    "equinoxFindingAlgorithm": "unknown; repository imports third-party whole-second March equinox timestamps rather than reproducing the original computation",
    "generationScriptPath": "scripts/generate-equinox-passage-data.mjs",
    "timestampRoundingPolicy": "Imported whole-second UTC timestamps are stored exactly as copied; the repository does not invent sub-second values"
  },
  "independentValidation": {
    "label": "bazica solar-term validation table",
    "independentValidationUrl": "unknown",
    "sourceRevisionOrChecksum": "79b48bf2",
    "validationMethod": "Compare each stored whole-second UTC equinox instant against the independent validation instant and record the absolute difference in seconds",
    "observedDifferencesSource": "Per-year UTC comparisons bundled in this repository"
  },
  "lunarMethod": {
    "label": "Approximate synodic lunar phase",
    "authoritative": true,
    "source": "approximate-synodic-phase",
    "sourceVersion": "13-moons-synodic/1.0.0",
    "knownNewMoonUtc": "2000-01-06T18:14:00Z",
    "synodicMonthDays": 29.530588853,
    "calculationInstantPolicy": "Compute phase name and illumination at the exact equinox UTC instant",
    "approximate": true
  },
  "records": [
    {
      "year": 2014,
      "utcInstant": "2014-03-20T16:57:05Z",
      "validationUtcInstant": "2014-03-20T16:57:06.760Z",
      "validationDeltaSeconds": 1.76
    },
    {
      "year": 2015,
      "utcInstant": "2015-03-20T22:45:09Z",
      "validationUtcInstant": "2015-03-20T22:45:10.500Z",
      "validationDeltaSeconds": 1.5
    },
    {
      "year": 2016,
      "utcInstant": "2016-03-20T04:30:11Z",
      "validationUtcInstant": "2016-03-20T04:30:12.330Z",
      "validationDeltaSeconds": 1.33
    },
    {
      "year": 2017,
      "utcInstant": "2017-03-20T10:28:37Z",
      "validationUtcInstant": "2017-03-20T10:28:39.049Z",
      "validationDeltaSeconds": 2.049
    },
    {
      "year": 2018,
      "utcInstant": "2018-03-20T16:15:27Z",
      "validationUtcInstant": "2018-03-20T16:15:28.473Z",
      "validationDeltaSeconds": 1.473
    },
    {
      "year": 2019,
      "utcInstant": "2019-03-20T21:58:25Z",
      "validationUtcInstant": "2019-03-20T21:58:26.961Z",
      "validationDeltaSeconds": 1.961
    },
    {
      "year": 2020,
      "utcInstant": "2020-03-20T03:49:37Z",
      "validationUtcInstant": "2020-03-20T03:49:38.267Z",
      "validationDeltaSeconds": 1.267
    },
    {
      "year": 2021,
      "utcInstant": "2021-03-20T09:37:28Z",
      "validationUtcInstant": "2021-03-20T09:37:29.688Z",
      "validationDeltaSeconds": 1.688
    },
    {
      "year": 2022,
      "utcInstant": "2022-03-20T15:33:24Z",
      "validationUtcInstant": "2022-03-20T15:33:26.057Z",
      "validationDeltaSeconds": 2.057
    },
    {
      "year": 2023,
      "utcInstant": "2023-03-20T21:24:26Z",
      "validationUtcInstant": "2023-03-20T21:24:27.653Z",
      "validationDeltaSeconds": 1.653
    },
    {
      "year": 2024,
      "utcInstant": "2024-03-20T03:06:24Z",
      "validationUtcInstant": "2024-03-20T03:06:25.264Z",
      "validationDeltaSeconds": 1.264
    },
    {
      "year": 2025,
      "utcInstant": "2025-03-20T09:01:28Z",
      "validationUtcInstant": "2025-03-20T09:01:30.009Z",
      "validationDeltaSeconds": 2.009
    },
    {
      "year": 2026,
      "utcInstant": "2026-03-20T14:45:57Z",
      "validationUtcInstant": "2026-03-20T14:45:58.471Z",
      "validationDeltaSeconds": 1.471
    }
  ]
});

  const sources = Object.freeze({
    primary: Object.freeze({
      id: "janmr-third-party-import",
      label: sourceMetadata.primarySource.label,
      source: "Third-party equinox table imported into this repository",
      sourceVersion: sourceMetadata.primarySource.sourceRevisionOrChecksum,
      sourceIntegrityStatus: sourceMetadata.sourceIntegrityStatus,
      dataOrigin: sourceMetadata.dataOrigin,
      url: sourceMetadata.primarySource.websiteUrl,
      primarySourceUrl: sourceMetadata.primarySource.primarySourceUrl,
      sourceTableUrl: sourceMetadata.primarySource.sourceTableUrl,
      timestampResolutionSeconds: sourceMetadata.timestampResolutionSeconds,
      validationToleranceSeconds: sourceMetadata.validationToleranceSeconds,
      maximumMeasuredDeviationSeconds: sourceMetadata.maximumMeasuredDeviationSeconds,
      maximumDeviationYear: sourceMetadata.maximumDeviationYear,
      skyfieldVersion: sourceMetadata.primarySource.skyfieldVersion,
      jplKernelFilename: sourceMetadata.primarySource.jplKernelFilename,
      ephemerisVersionOrChecksum: sourceMetadata.primarySource.ephemerisVersionOrChecksum,
      timescale: sourceMetadata.primarySource.timescale,
      equinoxFindingAlgorithm: sourceMetadata.primarySource.equinoxFindingAlgorithm,
      generationScriptPath: sourceMetadata.primarySource.generationScriptPath,
      timestampRoundingPolicy: sourceMetadata.primarySource.timestampRoundingPolicy,
      generationTimestamp: sourceMetadata.generationTimestamp
    }),
    validation: Object.freeze({
      id: "bazica-solar-term-validation",
      label: sourceMetadata.independentValidation.label,
      source: "Independent validation reference",
      sourceVersion: sourceMetadata.independentValidation.sourceRevisionOrChecksum,
      url: sourceMetadata.independentValidation.independentValidationUrl,
      validationMethod: sourceMetadata.independentValidation.validationMethod
    }),
    lunar: Object.freeze({
      id: sourceMetadata.lunarMethod.source,
      label: sourceMetadata.lunarMethod.label,
      source: "Deterministic synodic-cycle approximation",
      sourceVersion: sourceMetadata.lunarMethod.sourceVersion,
      approximate: sourceMetadata.lunarMethod.approximate,
      calculationInstantPolicy: sourceMetadata.lunarMethod.calculationInstantPolicy
    })
  });

  globalThis.AstronomySources = Object.freeze({
    sourceMetadata,
    sources
  });
})();
