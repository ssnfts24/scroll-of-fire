"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const calendarScripts = [
  "docs/assets/js/calendar/pattern-calendar-version.js",
  "docs/assets/js/calendar/pattern-calendar-data.js",
  "docs/assets/js/calendar/pattern-calendar-format.js",
  "docs/assets/js/calendar/pattern-calendar-boundary.js",
  "docs/assets/js/calendar/pattern-calendar.js"
];

function loadPatternCalendarContext(base = {}) {
  const context = {
    Date,
    Intl,
    URL,
    URLSearchParams,
    ...base
  };
  context.globalThis = context;
  context.window = context;
  for (const script of calendarScripts) {
    vm.runInNewContext(read(script), context);
  }
  return context;
}

function loadGenesisOracleContext({ localStorageValue = "[]", search = "" } = {}) {
  const storage = new Map([[ "sofGenesisProfiles", localStorageValue ]]);
  let domReady = null;
  const context = loadPatternCalendarContext({
    console,
    navigator: { clipboard: { writeText: async () => {} } },
    location: {
      search,
      origin: "https://example.test",
      pathname: "/genesis-oracle.html"
    },
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      }
    },
    document: {
      readyState: "loading",
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      addEventListener(type, callback) {
        if (type === "DOMContentLoaded") domReady = callback;
      },
      body: {
        appendChild() {},
        removeChild() {}
      },
      createElement() {
        return {
          click() {},
          remove() {}
        };
      }
    },
    window: null,
    setTimeout,
    clearTimeout
  });
  context.window = context;
  context.confirm = () => true;
  context.URL.createObjectURL = () => "blob:mock";
  context.URL.revokeObjectURL = () => {};

  vm.runInNewContext(read("docs/assets/js/genesis-oracle.js"), context);
  if (domReady) domReady();
  return context;
}

test("fixed anchor and July checkpoint resolve exactly", () => {
  const context = loadPatternCalendarContext();

  const april17 = context.PatternCalendar.fromCivilDate({
    date: "2026-04-17",
    timeZone: "UTC",
    boundaryMode: "midnight"
  });
  assert.equal(april17.moon, 1);
  assert.equal(april17.day, 1);
  assert.equal(april17.dayOfPatternYear, 1);
  assert.equal(april17.insideCountedYear, true);

  const july17 = context.PatternCalendar.fromCivilDate({
    date: "2026-07-17",
    timeZone: "UTC",
    boundaryMode: "midnight"
  });
  assert.equal(july17.moon, 4);
  assert.equal(july17.day, 8);
  assert.equal(july17.dayOfPatternYear, 92);
});

test("pre-anchor, day 364, day out of time, leap year, and deep time day are covered", () => {
  const context = loadPatternCalendarContext();

  const preAnchor = context.PatternCalendar.fromCivilDate({
    date: "2026-04-16",
    timeZone: "UTC",
    boundaryMode: "midnight"
  });
  assert.equal(preAnchor.isDayOutOfTime, true);
  assert.equal(preAnchor.intercalaryIndex, 1);

  const day364 = context.PatternCalendar.fromCivilDate({
    date: "2027-04-15",
    timeZone: "UTC",
    boundaryMode: "midnight"
  });
  assert.equal(day364.moon, 13);
  assert.equal(day364.day, 28);
  assert.equal(day364.dayOfPatternYear, 364);

  const dayOutOfTime = context.PatternCalendar.fromCivilDate({
    date: "2027-04-16",
    timeZone: "UTC",
    boundaryMode: "midnight"
  });
  assert.equal(dayOutOfTime.isDayOutOfTime, true);
  assert.equal(dayOutOfTime.isDeepTimeDay, false);

  const leapWindow = context.PatternCalendar.fromCivilDate({
    date: "2028-04-15",
    timeZone: "UTC",
    boundaryMode: "midnight"
  });
  assert.equal(leapWindow.countedYearLength, 366);
  assert.equal(leapWindow.isDayOutOfTime, true);

  const deepTimeDay = context.PatternCalendar.fromCivilDate({
    date: "2028-04-16",
    timeZone: "UTC",
    boundaryMode: "midnight"
  });
  assert.equal(deepTimeDay.countedYearLength, 366);
  assert.equal(deepTimeDay.isDayOutOfTime, false);
  assert.equal(deepTimeDay.isDeepTimeDay, true);
  assert.equal(deepTimeDay.intercalaryIndex, 2);
});

test("midnight, sunset, manual sunset, and multi-timezone behavior are covered", () => {
  const context = loadPatternCalendarContext();
  const instant = "2026-07-18T02:30:00Z";

  const midnight = context.PatternCalendar.fromCivilDate({
    date: instant,
    timeZone: "America/Los_Angeles",
    boundaryMode: "midnight"
  });
  const sunset = context.PatternCalendar.fromCivilDate({
    date: instant,
    timeZone: "America/Los_Angeles",
    boundaryMode: "sunset",
    sunsetTime: "18:00"
  });
  const manual = context.PatternCalendar.fromCivilDate({
    date: instant,
    timeZone: "America/Los_Angeles",
    boundaryMode: "manual",
    sunsetTime: "18:00"
  });

  assert.equal(midnight.dayOfPatternYear, 92);
  assert.equal(sunset.dayOfPatternYear, 93);
  assert.equal(manual.dayOfPatternYear, 93);

  const utc = context.PatternCalendar.fromCivilDate({
    date: "2026-07-17T23:30:00Z",
    timeZone: "UTC",
    boundaryMode: "midnight"
  });
  const tokyo = context.PatternCalendar.fromCivilDate({
    date: "2026-07-17T23:30:00Z",
    timeZone: "Asia/Tokyo",
    boundaryMode: "midnight"
  });
  assert.equal(utc.dayOfPatternYear, 92);
  assert.equal(tokyo.dayOfPatternYear, 93);
});

test("genesis oracle uses the shared engine and versions legacy localStorage profiles", () => {
  const context = loadGenesisOracleContext({
    localStorageValue: JSON.stringify([
      { name: "Legacy", birth: "1990-01-01", moon: 1, day: 1, tone: 1, carrier: 432 }
    ])
  });

  const calendar = context.PatternCalendar.fromCivilDate({
    date: "2026-07-17",
    timeZone: "UTC",
    boundaryMode: "midnight"
  });
  const oracle = context.GenesisOracle.mapToPatternCalendar({
    dateStr: "2026-07-17",
    timeZone: "UTC"
  });

  assert.equal(oracle.moon, calendar.moon);
  assert.equal(oracle.day, calendar.day);
  assert.equal(oracle.index, calendar.dayOfPatternYear);
  assert.equal(oracle.calendarVersion, context.PatternCalendarVersion.version);

  const [legacy] = context.GenesisOracle.readSaved();
  assert.equal(legacy.legacyRecord, true);
  assert.equal(legacy.calendarVersion, "legacy/genesis-oracle/new-moon-anchor");
  assert.equal(legacy.oracleVersion, "legacy/genesis-oracle/pre-1.0.0");
});

test("legacy remnant-anchor logic and conflicting copy are removed from active pages", () => {
  const oracleJs = read("docs/assets/js/genesis-oracle.js");
  const oracleHtml = read("docs/genesis-oracle.html");
  const moonsHtml = read("docs/moons.html");

  assert.doesNotMatch(oracleJs, /\bapproxAnchor\b/);
  assert.doesNotMatch(oracleJs, /\bmapToRemnant\b/);
  assert.doesNotMatch(oracleHtml, /first New Moon after Spring Equinox/i);
  assert.doesNotMatch(moonsHtml, /first New Moon after Spring Equinox/i);
});

test("13 Moons and Genesis Oracle both load the same shared Pattern Calendar scripts", () => {
  const moonsHtml = read("docs/moons.html");
  const oracleHtml = read("docs/genesis-oracle.html");
  const expectedScripts = [
    "assets/js/calendar/pattern-calendar-version.js",
    "assets/js/calendar/pattern-calendar-data.js",
    "assets/js/calendar/pattern-calendar-format.js",
    "assets/js/calendar/pattern-calendar-boundary.js",
    "assets/js/calendar/pattern-calendar.js"
  ];

  for (const script of expectedScripts) {
    assert.match(moonsHtml, new RegExp(script.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(oracleHtml, new RegExp(script.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(moonsHtml, /assets\/js\/calendar-cor\.js/);
  assert.doesNotMatch(oracleHtml, /assets\/js\/calendar-cor\.js/);
});

test("android/iphone scrolling safeguards, tab/form controls, and installed-PWA behavior are present", () => {
  const moonsHtml = read("docs/moons.html");
  const moonsCss = read("docs/assets/css/moons.css");
  const manifest = JSON.parse(read("docs/manifest.webmanifest"));

  assert.match(moonsCss, /@media\s*\(hover:\s*none\)\s*and\s*\(pointer:\s*coarse\)\s*\{[\s\S]*?\.page-head\s*\{[\s\S]*?overflow:\s*clip;/);
  assert.match(moonsHtml, /<div class="tabs" aria-label="Calendar tools">/);
  assert.match(moonsHtml, /id="boundaryMode"/);
  assert.match(moonsHtml, /id="sunsetInput"/);

  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "./moons.html?source=installed");
  assert.equal(manifest.scope, "./");
});
