"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

function loadContext() {
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
    "docs/assets/js/equinox/equinox-passage-export.js"
  ].forEach(script => vm.runInNewContext(read(script), context));
  return context;
}

test("reference instants match bundled authoritative values", () => {
  const context = loadContext();
  assert.equal(context.EquinoxEngine.getReferenceRecord(2014).utcInstant, "2014-03-20T16:57:05Z");
  assert.equal(context.EquinoxEngine.getReferenceRecord(2020).utcInstant, "2020-03-20T03:49:37Z");
  assert.equal(context.EquinoxEngine.getReferenceRecord(2026).utcInstant, "2026-03-20T14:45:57Z");
});

test("historical dataset is complete and chronologically ordered for 2014-2026", () => {
  const context = loadContext();
  const years = context.EquinoxPassageData.listYears();
  assert.equal(years.length, 13);
  assert.equal(years[0], 2014);
  assert.equal(years.at(-1), 2026);
  const instants = years.map(year => context.EquinoxEngine.getReferenceRecord(year).utcInstant);
  assert.deepEqual([...instants].sort(), instants);
});

test("timezone conversion supports Los Angeles, New York, and UTC with DST-safe local instants", () => {
  const context = loadContext();
  assert.equal(context.EquinoxEngine.describeEquinox(2026, "America/Los_Angeles").localInstant, "2026-03-20T07:45:57");
  assert.equal(context.EquinoxEngine.describeEquinox(2026, "America/New_York").localInstant, "2026-03-20T10:45:57");
  assert.equal(context.EquinoxEngine.describeEquinox(2026, "UTC").localInstant, "2026-03-20T14:45:57");
});

test("midnight, sunset, and manual sunset modes keep the equinox instant fixed while changing passage end handling", () => {
  const context = loadContext();
  const midnight = context.EquinoxPassageEngine.buildRecord({ selectedYear: 2026, timeZone: "America/Los_Angeles", boundaryMode: "midnight", asOf: "2026-03-25T12:00:00Z" });
  const sunset = context.EquinoxPassageEngine.buildRecord({ selectedYear: 2026, timeZone: "America/Los_Angeles", boundaryMode: "sunset", manualSunset: "18:00", asOf: "2026-03-25T12:00:00Z" });
  const manual = context.EquinoxPassageEngine.buildRecord({ selectedYear: 2026, timeZone: "America/Los_Angeles", boundaryMode: "manual", manualSunset: "19:30", asOf: "2026-03-25T12:00:00Z" });
  assert.equal(midnight.equinox.utcInstant, sunset.equinox.utcInstant);
  assert.equal(sunset.equinox.utcInstant, manual.equinox.utcInstant);
  assert.notEqual(midnight.passage.endInstant, sunset.passage.endInstant);
  assert.notEqual(sunset.passage.endInstant, manual.passage.endInstant);
});

test("pattern mapping matches shared Pattern Calendar parity for the 2026 gate", () => {
  const context = loadContext();
  const record = context.EquinoxPassageEngine.buildRecord({ selectedYear: 2026, timeZone: "America/Los_Angeles", boundaryMode: "sunset", manualSunset: "18:00", asOf: "2026-03-25T12:00:00Z" });
  assert.equal(record.patternPosition.moon, 13);
  assert.equal(record.patternPosition.day, 2);
  assert.equal(record.patternPosition.dayOfPatternYear, 338);
  assert.equal(record.patternPosition.weekGate, "Week 1 · Ignition");
});

test("passage duration, elapsed time, remaining time, and progress support before active and after states", () => {
  const context = loadContext();
  const before = context.EquinoxPassageEngine.buildRecord({ selectedYear: 2026, timeZone: "UTC", boundaryMode: "midnight", asOf: "2026-03-19T00:00:00Z" });
  const active = context.EquinoxPassageEngine.buildRecord({ selectedYear: 2026, timeZone: "UTC", boundaryMode: "midnight", asOf: "2026-04-01T00:00:00Z" });
  const after = context.EquinoxPassageEngine.buildRecord({ selectedYear: 2026, timeZone: "UTC", boundaryMode: "midnight", asOf: "2026-04-20T00:00:00Z" });
  assert.equal(before.passage.state, "before-passage");
  assert.equal(before.passage.progress, 0);
  assert.equal(active.passage.state, "active-passage");
  assert.ok(active.passage.progress > 0 && active.passage.progress < 1);
  assert.equal(after.passage.state, "after-passage");
  assert.equal(after.passage.progress, 1);
});

test("leap year records are supported while invalid or missing years throw", () => {
  const context = loadContext();
  assert.doesNotThrow(() => context.EquinoxPassageEngine.buildRecord({ selectedYear: 2024, timeZone: "UTC" }));
  assert.throws(() => context.EquinoxPassageEngine.buildRecord({ selectedYear: 2100, timeZone: "UTC" }), /No equinox reference record|Missing source record/);
  assert.throws(() => context.EquinoxPassageEngine.buildRecord({ selectedYear: "bad", timeZone: "UTC" }), /Invalid year/);
});

test("invalid timezones fall back safely to UTC", () => {
  const context = loadContext();
  const record = context.EquinoxPassageEngine.buildRecord({ selectedYear: 2026, timeZone: "Mars/OlympusMons" });
  assert.equal(record.timeZone, "UTC");
});

test("precision labels and exports stay stable", () => {
  const context = loadContext();
  const record = context.EquinoxPassageEngine.buildRecord({ selectedYear: 2026, timeZone: "America/Los_Angeles", boundaryMode: "sunset", manualSunset: "18:00", asOf: "2026-03-25T12:00:00Z" });
  assert.equal(context.EquinoxPassageFormat.precisionLabel(record.equinox.precisionSeconds), "±1 second");
  assert.match(context.EquinoxPassageExport.annualJson(record), /"source": "janmr.com equinoxes and solstices"/);
  const csv = context.EquinoxPassageExport.historicalCsv([record]);
  assert.match(csv, /year,equinox_utc_instant,time_zone/);
  assert.match(csv, /2026-03-20T14:45:57Z/);
});

test("share-link reconstruction preserves Equinox Passage parameters", () => {
  const context = { URL, location: { href: "https://codexofreality.org/equinox-passage.html" } };
  context.globalThis = context;
  context.window = context;
  vm.runInNewContext(read("docs/assets/js/share/remnant-share-url.js"), context);
  const link = context.RemnantShareUrl.buildEquinoxShareLink({
    baseUrl: "https://codexofreality.org/equinox-passage.html",
    selectedYear: 2026,
    timeZone: "America/Los_Angeles",
    boundaryMode: "manual",
    manualSunset: "18:45",
    displayMode: "standard",
    datasetVersion: "equinox-passage/1.0.0",
    source: "equinox-passage"
  });
  const parsed = context.RemnantShareUrl.parseEquinoxShareLink(link);
  assert.equal(JSON.stringify(parsed), JSON.stringify({
    selectedYear: "2026",
    timeZone: "America/Los_Angeles",
    boundaryMode: "manual",
    manualSunset: "18:45",
    displayMode: "standard",
    datasetVersion: "",
    source: "equinox-passage"
  }));
});

test("dedicated page, compact card, sharing hook, and service worker cache wiring are present", () => {
  const page = read("docs/equinox-passage.html");
  const moons = read("docs/moons.html");
  const shareDay = read("docs/assets/js/share-day.js");
  const worker = read("docs/service-worker.js");
  assert.match(page, /assets\/js\/equinox\/equinox-passage-ui\.js/);
  assert.match(moons, /id="equinoxCompactCard"/);
  assert.match(shareDay, /"equinox-passage": equinoxPassagePayload/);
  assert.match(worker, /\.\/equinox-passage\.html/);
  assert.match(worker, /\.\/data\/equinox-passage\/equinox-reference-2014-2026\.json/);
});
