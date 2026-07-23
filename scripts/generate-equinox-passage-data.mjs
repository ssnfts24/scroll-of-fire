import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import process from "node:process";

const root = process.cwd();
const sourcePath = path.join(root, "docs/data/equinox-passage/equinox-source-metadata.json");
const referenceJsonPath = path.join(root, "docs/data/equinox-passage/equinox-reference-2014-2026.json");
const passageJsonPath = path.join(root, "docs/data/equinox-passage/equinox-passage-2014-2026.json");
const passageCsvPath = path.join(root, "docs/data/equinox-passage/equinox-passage-2014-2026.csv");
const referenceJsPath = path.join(root, "docs/assets/js/astronomy/equinox-reference-data.js");
const sourcesJsPath = path.join(root, "docs/assets/js/astronomy/astronomy-sources.js");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeIfChanged(filePath, content) {
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, "utf8") === content) return false;
  fs.writeFileSync(filePath, content);
  return true;
}

function verifyFile(filePath, content) {
  if (!fs.existsSync(filePath)) return `${path.relative(root, filePath)} is missing`;
  const existing = fs.readFileSync(filePath, "utf8");
  return existing === content ? null : `${path.relative(root, filePath)} differs from deterministic output`;
}

function absoluteDeltaSeconds(a, b) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 1000;
}

function deepFreezeExpression(name, value) {
  return `const ${name} = deepFreeze(${JSON.stringify(value, null, 2)});`;
}

function buildSourcesScript(metadata) {
  return `(() => {\n  "use strict";\n\n  function deepFreeze(value) {\n    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;\n    Object.freeze(value);\n    Object.keys(value).forEach(key => deepFreeze(value[key]));\n    return value;\n  }\n\n  ${deepFreezeExpression("sourceMetadata", metadata)}\n\n  const sources = Object.freeze({\n    primary: Object.freeze({\n      id: "janmr-third-party-import",\n      label: sourceMetadata.primarySource.label,\n      source: "Third-party equinox table imported into this repository",\n      sourceVersion: sourceMetadata.primarySource.sourceRevisionOrChecksum,\n      sourceIntegrityStatus: sourceMetadata.sourceIntegrityStatus,\n      dataOrigin: sourceMetadata.dataOrigin,\n      url: sourceMetadata.primarySource.websiteUrl,\n      primarySourceUrl: sourceMetadata.primarySource.primarySourceUrl,\n      sourceTableUrl: sourceMetadata.primarySource.sourceTableUrl,\n      timestampResolutionSeconds: sourceMetadata.timestampResolutionSeconds,\n      validationToleranceSeconds: sourceMetadata.validationToleranceSeconds,\n      maximumMeasuredDeviationSeconds: sourceMetadata.maximumMeasuredDeviationSeconds,\n      maximumDeviationYear: sourceMetadata.maximumDeviationYear,\n      skyfieldVersion: sourceMetadata.primarySource.skyfieldVersion,\n      jplKernelFilename: sourceMetadata.primarySource.jplKernelFilename,\n      ephemerisVersionOrChecksum: sourceMetadata.primarySource.ephemerisVersionOrChecksum,\n      timescale: sourceMetadata.primarySource.timescale,\n      equinoxFindingAlgorithm: sourceMetadata.primarySource.equinoxFindingAlgorithm,\n      generationScriptPath: sourceMetadata.primarySource.generationScriptPath,\n      timestampRoundingPolicy: sourceMetadata.primarySource.timestampRoundingPolicy,\n      generationTimestamp: sourceMetadata.generationTimestamp\n    }),\n    validation: Object.freeze({\n      id: "bazica-solar-term-validation",\n      label: sourceMetadata.independentValidation.label,\n      source: "Independent validation reference",\n      sourceVersion: sourceMetadata.independentValidation.sourceRevisionOrChecksum,\n      url: sourceMetadata.independentValidation.independentValidationUrl,\n      validationMethod: sourceMetadata.independentValidation.validationMethod\n    }),\n    lunar: Object.freeze({\n      id: sourceMetadata.lunarMethod.source,\n      label: sourceMetadata.lunarMethod.label,\n      source: "Deterministic synodic-cycle approximation",\n      sourceVersion: sourceMetadata.lunarMethod.sourceVersion,\n      approximate: sourceMetadata.lunarMethod.approximate,\n      calculationInstantPolicy: sourceMetadata.lunarMethod.calculationInstantPolicy\n    })\n  });\n\n  globalThis.AstronomySources = Object.freeze({\n    sourceMetadata,\n    sources\n  });\n})();\n`;
}

function buildReferenceScript(metadata) {
  const records = metadata.records.map(record => ({
    ...record,
    source: metadata.primarySource.label,
    sourceVersion: metadata.primarySource.sourceRevisionOrChecksum,
    timestampResolutionSeconds: metadata.timestampResolutionSeconds,
    validationToleranceSeconds: metadata.validationToleranceSeconds,
    maximumMeasuredDeviationSeconds: metadata.maximumMeasuredDeviationSeconds,
    maximumDeviationYear: metadata.maximumDeviationYear,
    dataOrigin: metadata.dataOrigin,
    sourceIntegrityStatus: metadata.sourceIntegrityStatus,
    calculated: false,
    validationStatus: "validated-against-independent-table",
    importedAt: metadata.generationTimestamp
  }));
  const baseMetadata = {
    schemaVersion: metadata.datasetVersion,
    astronomyVersion: metadata.astronomyVersion,
    calendarVersion: metadata.calendarVersion,
    defaultStudyTimeZone: metadata.canonicalDataset.timeZone,
    defaultBoundaryMode: metadata.canonicalDataset.boundaryMode,
    defaultSunset: metadata.canonicalDataset.manualSunset,
    timestampResolutionSeconds: metadata.timestampResolutionSeconds,
    validationToleranceSeconds: metadata.validationToleranceSeconds,
    maximumMeasuredDeviationSeconds: metadata.maximumMeasuredDeviationSeconds,
    maximumDeviationYear: metadata.maximumDeviationYear,
    sourceIntegrityStatus: metadata.sourceIntegrityStatus,
    dataOrigin: metadata.dataOrigin,
    sourceMetadata: metadata
  };
  return `(() => {\n  "use strict";\n\n  function deepFreeze(value) {\n    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;\n    Object.freeze(value);\n    Object.keys(value).forEach(key => deepFreeze(value[key]));\n    return value;\n  }\n\n  ${deepFreezeExpression("sourceMetadata", metadata)}\n  ${deepFreezeExpression("baseMetadata", baseMetadata)}\n  const records = Object.freeze(${JSON.stringify(records, null, 2)}.map(record => deepFreeze(record)));\n\n  function byYear(year) {\n    return records.find(record => record.year === Number(year)) || null;\n  }\n\n  globalThis.EquinoxReferenceData = Object.freeze({\n    metadata: baseMetadata,\n    sourceMetadata,\n    records,\n    byYear\n  });\n})();\n`;
}

function buildReferenceJson(metadata) {
  const records = metadata.records.map(record => ({
    ...record,
    source: metadata.primarySource.label,
    sourceVersion: metadata.primarySource.sourceRevisionOrChecksum,
    timestampResolutionSeconds: metadata.timestampResolutionSeconds,
    validationToleranceSeconds: metadata.validationToleranceSeconds,
    maximumMeasuredDeviationSeconds: metadata.maximumMeasuredDeviationSeconds,
    maximumDeviationYear: metadata.maximumDeviationYear,
    dataOrigin: metadata.dataOrigin,
    sourceIntegrityStatus: metadata.sourceIntegrityStatus,
    calculated: false,
    validationStatus: "validated-against-independent-table",
    importedAt: metadata.generationTimestamp
  }));
  const content = {
    metadata: {
      schemaVersion: metadata.datasetVersion,
      astronomyVersion: metadata.astronomyVersion,
      calendarVersion: metadata.calendarVersion,
      defaultStudyTimeZone: metadata.canonicalDataset.timeZone,
      defaultBoundaryMode: metadata.canonicalDataset.boundaryMode,
      defaultSunset: metadata.canonicalDataset.manualSunset,
      timestampResolutionSeconds: metadata.timestampResolutionSeconds,
      validationToleranceSeconds: metadata.validationToleranceSeconds,
      maximumMeasuredDeviationSeconds: metadata.maximumMeasuredDeviationSeconds,
      maximumDeviationYear: metadata.maximumDeviationYear,
      sourceIntegrityStatus: metadata.sourceIntegrityStatus,
      dataOrigin: metadata.dataOrigin,
      sourceMetadata: metadata
    },
    records
  };
  return `${JSON.stringify(content, null, 2)}\n`;
}

function loadContext(referenceScript, sourcesScript) {
  const context = {
    Intl,
    Date,
    URL,
    console
  };
  context.globalThis = context;
  context.window = context;
  const scripts = [
    "docs/assets/js/calendar/pattern-calendar-version.js",
    "docs/assets/js/calendar/pattern-calendar-data.js",
    "docs/assets/js/calendar/pattern-calendar-format.js",
    "docs/assets/js/calendar/pattern-calendar-boundary.js",
    "docs/assets/js/calendar/pattern-calendar.js",
    "docs/assets/js/astronomy/astronomy-version.js",
    sourcesScript,
    "docs/assets/js/astronomy/timezone-tools.js",
    referenceScript,
    "docs/assets/js/astronomy/lunar-at-equinox.js",
    "docs/assets/js/astronomy/equinox-engine.js",
    "docs/assets/js/equinox/equinox-passage-format.js",
    "docs/assets/js/equinox/equinox-passage-engine.js",
    "docs/assets/js/equinox/equinox-passage-data.js",
    "docs/assets/js/equinox/equinox-passage-export.js"
  ];
  scripts.forEach(entry => {
    const code = entry.includes("(() =>") ? entry : fs.readFileSync(path.join(root, entry), "utf8");
    vm.runInNewContext(code, context);
  });
  return context;
}

function validateMetadata(metadata) {
  const required = [
    metadata.primarySource.primarySourceUrl,
    metadata.independentValidation.independentValidationUrl,
    metadata.primarySource.skyfieldVersion,
    metadata.primarySource.jplKernelFilename,
    metadata.primarySource.ephemerisVersionOrChecksum,
    metadata.primarySource.timescale,
    metadata.primarySource.equinoxFindingAlgorithm,
    metadata.primarySource.generationScriptPath,
    metadata.primarySource.timestampRoundingPolicy,
    metadata.generationTimestamp,
    metadata.independentValidation.validationMethod
  ];
  if (required.some(value => typeof value !== "string" || !value.length)) {
    throw new Error("Source metadata fields must be present even when their value is 'unknown'");
  }
  const years = metadata.records.map(record => record.year);
  const sortedYears = [...years].sort((a, b) => a - b);
  if (years.join(",") !== sortedYears.join(",")) throw new Error("Source metadata years must be sorted");
  metadata.records.forEach(record => {
    const measured = absoluteDeltaSeconds(record.utcInstant, record.validationUtcInstant);
    if (Math.abs(measured - record.validationDeltaSeconds) > 0.0005) {
      throw new Error(`Validation delta mismatch for ${record.year}`);
    }
    if (record.validationDeltaSeconds > metadata.validationToleranceSeconds) {
      throw new Error(`Validation delta exceeds tolerance for ${record.year}`);
    }
  });
  const maxRecord = metadata.records.reduce((best, record) => record.validationDeltaSeconds > best.validationDeltaSeconds ? record : best, metadata.records[0]);
  if (Math.abs(maxRecord.validationDeltaSeconds - metadata.maximumMeasuredDeviationSeconds) > 0.0005) {
    throw new Error("Maximum measured deviation metadata does not match yearly records");
  }
  if (maxRecord.year !== metadata.maximumDeviationYear) {
    throw new Error("Maximum deviation year metadata does not match yearly records");
  }
}

function main() {
  const verifyOnly = process.argv.includes("--verify");
  const metadata = readJson(sourcePath);
  validateMetadata(metadata);
  const referenceScript = buildReferenceScript(metadata);
  const sourcesScript = buildSourcesScript(metadata);
  const referenceJson = buildReferenceJson(metadata);
  const context = loadContext(referenceScript, sourcesScript);
  const canonicalDataset = context.EquinoxPassageData.buildCanonicalDataset(metadata.canonicalDataset);
  const historicalJson = `${JSON.stringify(canonicalDataset, null, 2)}\n`;
  const historicalCsv = context.EquinoxPassageExport.historicalCsv(canonicalDataset);
  const checks = [
    [referenceJsonPath, referenceJson],
    [passageJsonPath, historicalJson],
    [passageCsvPath, historicalCsv],
    [referenceJsPath, referenceScript],
    [sourcesJsPath, sourcesScript]
  ];

  if (verifyOnly) {
    const mismatches = checks.map(([filePath, content]) => verifyFile(filePath, content)).filter(Boolean);
    if (mismatches.length) {
      mismatches.forEach(message => console.error(message));
      process.exit(1);
    }
    console.log("Equinox Passage dataset verification passed.");
    return;
  }

  let changed = 0;
  checks.forEach(([filePath, content]) => {
    if (writeIfChanged(filePath, content)) changed += 1;
  });
  console.log(`Equinox Passage dataset generated. Updated ${changed} file(s).`);
}

main();
