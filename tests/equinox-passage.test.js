"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

function loadCoreContext() {
  const storage = new Map();
  const context = {
    Intl,
    Date,
    URL,
    localStorage: {
      getItem(key) { return storage.get(key) ?? null; },
      setItem(key, value) { storage.set(key, String(value)); }
    }
  };
  context.globalThis = context;
  context.window = context;
  [
    "docs/assets/js/calendar/pattern-calendar-version.js",
    "docs/assets/js/calendar/pattern-calendar-data.js",
    "docs/assets/js/calendar/pattern-calendar-format.js",
    "docs/assets/js/calendar/pattern-calendar-boundary.js",
    "docs/assets/js/calendar/pattern-calendar.js",
    "docs/assets/js/astronomy/astronomy-version.js",
    "docs/assets/js/astronomy/astronomy-sources.js",
    "docs/assets/js/astronomy/timezone-tools.js",
    "docs/assets/js/astronomy/equinox-reference-data.js",
    "docs/assets/js/astronomy/lunar-at-equinox.js",
    "docs/assets/js/astronomy/equinox-engine.js",
    "docs/assets/js/equinox/equinox-passage-format.js",
    "docs/assets/js/equinox/equinox-passage-engine.js",
    "docs/assets/js/equinox/equinox-passage-data.js",
    "docs/assets/js/equinox/equinox-passage-export.js",
    "docs/assets/js/equinox/equinox-passage-storage.js",
    "docs/assets/js/equinox/equinox-passage-visualization-data.js"
  ].forEach(script => vm.runInNewContext(read(script), context));
  return context;
}

function createNode(value = "") {
  return {
    value,
    textContent: "",
    innerHTML: "",
    style: {},
    attributes: {},
    setAttribute(name, nextValue) { this.attributes[name] = String(nextValue); },
    getAttribute(name) { return this.attributes[name] || null; },
    addEventListener() {}
  };
}

function loadUiContext({ url = "https://codexofreality.org/equinox-passage.html", nodes = {}, scrollOfFireMoons } = {}) {
  const context = loadCoreContext();
  const documentNodes = new Map(Object.entries(nodes));
  const document = {
    readyState: "complete",
    body: {},
    getElementById(id) { return documentNodes.get(id) || null; },
    addEventListener() {},
    dispatchEvent() {}
  };
  context.location = new URL(url);
  context.document = document;
  context.CustomEvent = function CustomEvent(type, init) { return { type, detail: init?.detail }; };
  context.ScrollOfFireMoons = scrollOfFireMoons;
  context.RemnantShare = {
    nativeShare: async () => {},
    copySignal() {},
    copyStandard() {},
    copyFullScroll() {},
    copyPermanentLink() {}
  };
  vm.runInNewContext(read("docs/assets/js/share/remnant-share-url.js"), context);
  vm.runInNewContext(read("docs/assets/js/equinox/equinox-passage-ui.js"), context);
  return { context, nodes: documentNodes };
}

test("reference instants match bundled authoritative values", () => {
  const context = loadCoreContext();
  assert.equal(context.EquinoxEngine.getReferenceRecord(2014).utcInstant, "2014-03-20T16:57:05Z");
  assert.equal(context.EquinoxEngine.getReferenceRecord(2020).utcInstant, "2020-03-20T03:49:37Z");
  assert.equal(context.EquinoxEngine.getReferenceRecord(2026).utcInstant, "2026-03-20T14:45:57Z");
});

test("historical dataset is complete and chronologically ordered for 2014-2026", () => {
  const context = loadCoreContext();
  const years = context.EquinoxPassageData.listYears();
  assert.equal(years.length, 13);
  assert.equal(years[0], 2014);
  assert.equal(years.at(-1), 2026);
  const instants = years.map(year => context.EquinoxEngine.getReferenceRecord(year).utcInstant);
  assert.equal([...instants].sort().join("|"), instants.join("|"));
});

test("timezone conversion supports Los Angeles, New York, and UTC with DST-safe local instants", () => {
  const context = loadCoreContext();
  assert.equal(context.EquinoxEngine.describeEquinox(2026, "America/Los_Angeles").localInstant, "2026-03-20T07:45:57");
  assert.equal(context.EquinoxEngine.describeEquinox(2026, "America/New_York").localInstant, "2026-03-20T10:45:57");
  assert.equal(context.EquinoxEngine.describeEquinox(2026, "UTC").localInstant, "2026-03-20T14:45:57");
});

test("midnight, sunset, and manual sunset modes keep the equinox instant fixed while changing passage end handling", () => {
  const context = loadCoreContext();
  const midnight = context.EquinoxPassageEngine.buildRecord({ selectedYear: 2026, timeZone: "America/Los_Angeles", boundaryMode: "midnight", asOf: "2026-03-25T12:00:00Z" });
  const sunset = context.EquinoxPassageEngine.buildRecord({ selectedYear: 2026, timeZone: "America/Los_Angeles", boundaryMode: "sunset", manualSunset: "18:00", asOf: "2026-03-25T12:00:00Z" });
  const manual = context.EquinoxPassageEngine.buildRecord({ selectedYear: 2026, timeZone: "America/Los_Angeles", boundaryMode: "manual", manualSunset: "19:30", asOf: "2026-03-25T12:00:00Z" });
  assert.equal(midnight.canonicalRecord.equinox.utcInstant, sunset.canonicalRecord.equinox.utcInstant);
  assert.equal(sunset.canonicalRecord.equinox.utcInstant, manual.canonicalRecord.equinox.utcInstant);
  assert.equal(midnight.canonicalRecord.passage.endInstant, "2026-04-17T07:00:00.000Z");
  assert.equal(sunset.canonicalRecord.passage.endInstant, "2026-04-17T01:00:00.000Z");
  assert.notEqual(sunset.canonicalRecord.passage.endInstant, manual.canonicalRecord.passage.endInstant);
});

test("pattern mapping matches shared Pattern Calendar parity for the 2026 gate", () => {
  const context = loadCoreContext();
  const record = context.EquinoxPassageEngine.buildRecord({ selectedYear: 2026, timeZone: "America/Los_Angeles", boundaryMode: "sunset", manualSunset: "18:00", asOf: "2026-03-25T12:00:00Z" });
  assert.equal(record.canonicalRecord.patternPosition.moon, 13);
  assert.equal(record.canonicalRecord.patternPosition.day, 2);
  assert.equal(record.canonicalRecord.patternPosition.dayOfPatternYear, 338);
  assert.equal(record.canonicalRecord.patternPosition.weekGate, "Week 1 · Ignition");
});

test("canonical annual record stays stable across different evaluation dates while live state changes", () => {
  const context = loadCoreContext();
  const before = context.EquinoxPassageEngine.buildRecord({ selectedYear: 2026, timeZone: "UTC", boundaryMode: "midnight", asOf: "2026-03-19T00:00:00Z" });
  const active = context.EquinoxPassageEngine.buildRecord({ selectedYear: 2026, timeZone: "UTC", boundaryMode: "midnight", asOf: "2026-04-01T00:00:00Z" });
  const after = context.EquinoxPassageEngine.buildRecord({ selectedYear: 2026, timeZone: "UTC", boundaryMode: "midnight", asOf: "2026-04-20T00:00:00Z" });
  assert.equal(JSON.stringify(before.canonicalRecord), JSON.stringify(active.canonicalRecord));
  assert.equal(JSON.stringify(active.canonicalRecord), JSON.stringify(after.canonicalRecord));
  assert.equal(before.liveState.status, "before-passage");
  assert.equal(before.liveState.progress, 0);
  assert.equal(active.liveState.status, "active-passage");
  assert.ok(active.liveState.progress > 0 && active.liveState.progress < 1);
  assert.equal(after.liveState.status, "after-passage");
  assert.equal(after.liveState.progress, 1);
});

test("leap year records are supported while invalid or missing years throw", () => {
  const context = loadCoreContext();
  assert.doesNotThrow(() => context.EquinoxPassageEngine.buildRecord({ selectedYear: 2024, timeZone: "UTC" }));
  assert.throws(() => context.EquinoxPassageEngine.buildRecord({ selectedYear: 2100, timeZone: "UTC" }), /No equinox reference record|Missing source record/);
  assert.throws(() => context.EquinoxPassageEngine.buildRecord({ selectedYear: "bad", timeZone: "UTC" }), /Invalid year/);
});

test("invalid timezones fall back safely to UTC", () => {
  const context = loadCoreContext();
  const record = context.EquinoxPassageEngine.buildRecord({ selectedYear: 2026, timeZone: "Mars/OlympusMons" });
  assert.equal(record.canonicalRecord.timeZone, "UTC");
});

test("source metadata includes required source-chain fields and measured limits", () => {
  const context = loadCoreContext();
  const metadata = context.EquinoxReferenceData.sourceMetadata;
  assert.equal(metadata.timestampResolutionSeconds, 1);
  assert.equal(metadata.validationToleranceSeconds, 3);
  assert.equal(metadata.maximumMeasuredDeviationSeconds, 2.057);
  assert.equal(metadata.maximumDeviationYear, 2022);
  assert.equal(metadata.primarySource.skyfieldVersion, "unknown");
  assert.equal(metadata.primarySource.jplKernelFilename, "unknown");
  assert.equal(metadata.primarySource.ephemerisVersionOrChecksum, "unknown");
  assert.equal(metadata.primarySource.primarySourceUrl, "unknown");
  assert.equal(metadata.independentValidation.independentValidationUrl, "unknown");
  assert.equal(metadata.records.length, 13);
});

test("annual JSON export is canonical and historical CSV contains stable source metadata", () => {
  const context = loadCoreContext();
  const record = context.EquinoxPassageEngine.buildRecord({ selectedYear: 2026, timeZone: "America/Los_Angeles", boundaryMode: "sunset", manualSunset: "18:00", asOf: "2026-03-25T12:00:00Z" });
  const annualJson = context.EquinoxPassageExport.annualJson(record);
  const parsed = JSON.parse(annualJson);
  assert.equal(parsed.selectedYear, 2026);
  assert.equal(parsed.equinox.timestampResolutionSeconds, 1);
  assert.equal(parsed.equinox.validationToleranceSeconds, 3);
  assert.equal(parsed.equinox.maximumMeasuredDeviationSeconds, 2.057);
  assert.equal(Object.prototype.hasOwnProperty.call(parsed, "liveState"), false);
  const csv = context.EquinoxPassageExport.historicalCsv([record]);
  assert.match(csv, /timestamp_resolution_seconds/);
  assert.match(csv, /validation_tolerance_seconds/);
  assert.match(csv, /2\.057/);
});

test("2026 lunar layer is computed at the equinox instant and remains internally consistent", () => {
  const context = loadCoreContext();
  const record = context.EquinoxPassageEngine.buildRecord({ selectedYear: 2026, timeZone: "America/Los_Angeles", boundaryMode: "sunset", manualSunset: "18:00" });
  assert.equal(record.canonicalRecord.lunarLayer.calculationInstantUtc, record.canonicalRecord.equinox.utcInstant);
  assert.equal(record.canonicalRecord.lunarLayer.phaseName, "Waxing Crescent");
  assert.equal(record.canonicalRecord.lunarLayer.illuminationPercent, 4.2);
  assert.equal(record.canonicalRecord.annualSignature.astronomical.includes("Approximate lunar phase"), true);
});

test("visualization adapter is deterministic, dependency-free, clamped, and safe without lunar data", () => {
  const context = loadCoreContext();
  const record = context.EquinoxPassageEngine.buildRecord({ selectedYear: 2026, timeZone: "America/Los_Angeles", boundaryMode: "sunset", manualSunset: "18:00", asOf: "2026-03-25T12:00:00Z" });
  const first = context.EquinoxPassageVisualizationData.fromRecord(record);
  const second = context.EquinoxPassageVisualizationData.fromRecord(record);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.moonIndex >= 0 && first.moonIndex <= 12, true);
  assert.equal(first.dayIndex >= 0 && first.dayIndex <= 27, true);
  assert.equal(first.patternCyclePosition >= 0 && first.patternCyclePosition <= 1, true);
  assert.equal(first.yearProgress >= 0 && first.yearProgress <= 1, true);
  assert.equal(first.equinoxCyclePosition >= 0 && first.equinoxCyclePosition <= 1, true);
  assert.equal(first.solarSeasonPosition >= 0 && first.solarSeasonPosition <= 1, true);
  const clamped = context.EquinoxPassageVisualizationData.fromRecord({ canonicalRecord: record.canonicalRecord, liveState: { progress: 2 } });
  assert.equal(clamped.passageProgress, 1);
  const safe = context.EquinoxPassageVisualizationData.fromRecord({ canonicalRecord: { ...record.canonicalRecord, lunarLayer: null }, liveState: { progress: -1 } });
  assert.equal(safe.passageProgress, 0);
  assert.equal(safe.lunarPhaseOrbit.label, "Lunar data unavailable");
});

test("URL parsing restores supported state, falls back safely, and ignores malformed values", () => {
  const { context } = loadUiContext({
    url: "https://codexofreality.org/equinox-passage.html?year=9999&tz=Mars/OlympusMons&boundary=bad&sunset=25:61&display=invalid&dataset=equinox-passage/9.9.9&compareA=2014&compareB=9999&profile=private&witness=secret"
  });
  const parsed = context.ScrollOfFireEquinoxPassage.parseUrlState(context.location.href);
  assert.equal(parsed.selectedYear, 2026);
  assert.equal(parsed.timeZone, "UTC");
  assert.equal(parsed.boundaryMode, "sunset");
  assert.equal(parsed.manualSunset, "18:00");
  assert.equal(parsed.displayMode, "standard");
  assert.equal(parsed.datasetVersion, "equinox-passage/1.0.0");
  assert.equal(parsed.compareYearA, 2014);
  assert.equal(parsed.compareYearB, 2026);
  assert.equal(parsed.issues.length >= 5, true);
});

test("canonical URL builder and parser round-trip supported Equinox Passage state", () => {
  const { context } = loadUiContext();
  const link = context.ScrollOfFireEquinoxPassage.buildCanonicalUrl({
    selectedYear: 2026,
    timeZone: "America/Los_Angeles",
    boundaryMode: "manual",
    manualSunset: "18:45",
    displayMode: "standard",
    datasetVersion: "equinox-passage/1.0.0",
    compareYearA: 2018,
    compareYearB: 2026,
    baseUrl: "https://codexofreality.org/equinox-passage.html"
  });
  const parsed = context.ScrollOfFireEquinoxPassage.parseUrlState(link);
  assert.equal(parsed.selectedYear, 2026);
  assert.equal(parsed.timeZone, "America/Los_Angeles");
  assert.equal(parsed.boundaryMode, "manual");
  assert.equal(parsed.manualSunset, "18:45");
  assert.equal(parsed.compareYearA, 2018);
  assert.equal(parsed.compareYearB, 2026);
  assert.equal(parsed.issues.length, 0);
});

test("13 Moons compact card link preserves current equinox state and page restoration parity", () => {
  const nodes = {
    equinoxCompactCard: createNode(),
    equinoxCompactGate: createNode(),
    equinoxCompactPattern: createNode(),
    equinoxCompactStatus: createNode(),
    equinoxCompactLinkText: createNode(),
    boundaryMode: createNode("manual"),
    sunsetInput: createNode("18:45")
  };
  const { nodes: nodeMap } = loadUiContext({
    nodes,
    scrollOfFireMoons: { selectedTimezone: () => "America/Los_Angeles" }
  });
  const href = nodeMap.get("equinoxCompactLinkText").attributes.href;
  assert.match(href, /year=2026/);
  assert.match(href, /tz=America%2FLos_Angeles/);
  assert.match(href, /boundary=manual/);
  assert.match(href, /sunset=18%3A45/);
});

test("unsupported accuracy language guardrail stays absent from shipped equinox artifacts", () => {
  const targets = [
    "docs/assets/js/astronomy/astronomy-sources.js",
    "docs/assets/js/astronomy/equinox-reference-data.js",
    "docs/assets/js/equinox/equinox-passage-format.js",
    "docs/assets/js/equinox/equinox-passage-ui.js",
    "docs/data/equinox-passage/equinox-source-metadata.json",
    "docs/data/equinox-passage/equinox-reference-2014-2026.json",
    "docs/data/equinox-passage/equinox-passage-2014-2026.json",
    "docs/data/equinox-passage/equinox-passage-2014-2026.csv",
    "docs/specifications/equinox-passage-v1.md",
    "docs/reports/remnant-phase-02-validation.md",
    "docs/equinox-passage.html",
    "docs/13-moon-whitepaper.html",
    "README.md"
  ];
  targets.forEach(relative => {
    const content = read(relative);
    assert.equal(/±1\s*-?second/i.test(content), false, `${relative} still contains unsupported ±1-second language`);
    assert.equal(/accuracy/i.test(content) && /1 second/i.test(content), false, `${relative} still pairs accuracy with 1 second`);
  });
});

test("deterministic generator verify command passes", () => {
  childProcess.execFileSync("node", ["scripts/generate-equinox-passage-data.mjs", "--verify"], {
    cwd: root,
    stdio: "pipe"
  });
});
