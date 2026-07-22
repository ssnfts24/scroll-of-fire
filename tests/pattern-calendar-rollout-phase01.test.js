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

const oracleScripts = [
  "docs/assets/js/oracle/oracle-version.js",
  "docs/assets/js/oracle/oracle-data.js",
  "docs/assets/js/oracle/oracle-name-code.js",
  "docs/assets/js/oracle/oracle-aspects.js",
  "docs/assets/js/oracle/oracle-signature.js",
  "docs/assets/js/oracle/oracle-reading.js",
  "docs/assets/js/oracle/oracle-compatibility.js",
  "docs/assets/js/oracle/oracle-storage.js",
  "docs/assets/js/oracle/oracle-engine.js"
];

function loadContext({ now = Date, localStorageSeed = {} } = {}) {
  const storage = new Map(Object.entries(localStorageSeed));
  const context = {
    Date: now,
    Intl,
    URL,
    URLSearchParams,
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
    }
  };

  context.globalThis = context;
  context.window = context;

  for (const script of [...calendarScripts, ...oracleScripts]) {
    vm.runInNewContext(read(script), context);
  }

  return context;
}

function baseInput(overrides = {}) {
  return {
    name: "Aaron-Paul O'Neil",
    birthDate: "2026-07-17",
    birthTime: "07:12",
    timeZone: "UTC",
    boundaryMode: "midnight",
    sunsetTime: "18:00",
    ...overrides
  };
}

test("single shared calendar mapping resolves foundational checkpoints", () => {
  const context = loadContext();

  const april17 = context.PatternCalendar.fromCivilDate({ date: "2026-04-17", timeZone: "UTC", boundaryMode: "midnight" });
  assert.equal(april17.moon, 1);
  assert.equal(april17.day, 1);
  assert.equal(april17.dayOfPatternYear, 1);

  const july17 = context.PatternCalendar.fromCivilDate({ date: "2026-07-17", timeZone: "UTC", boundaryMode: "midnight" });
  assert.equal(july17.moon, 4);
  assert.equal(july17.day, 8);
  assert.equal(july17.dayOfPatternYear, 92);

  const oracle = context.GenesisOracleEngine.run(baseInput());
  assert.equal(oracle.patternPosition.moonNumber, july17.moon);
  assert.equal(oracle.patternPosition.dayInMoon, july17.day);
  assert.equal(oracle.patternPosition.dayOfPatternYear, july17.dayOfPatternYear);
});

test("pre-epoch dates, moon 13 day 28, and outside days are represented", () => {
  const context = loadContext();

  const preEpoch = context.PatternCalendar.fromCivilDate({ date: "2026-04-16", timeZone: "UTC", boundaryMode: "midnight" });
  assert.equal(preEpoch.isDayOutOfTime, true);

  const moon13day28 = context.PatternCalendar.fromCivilDate({ date: "2027-04-15", timeZone: "UTC", boundaryMode: "midnight" });
  assert.equal(moon13day28.moon, 13);
  assert.equal(moon13day28.day, 28);

  const dayOut = context.PatternCalendar.fromCivilDate({ date: "2027-04-16", timeZone: "UTC", boundaryMode: "midnight" });
  assert.equal(dayOut.isDayOutOfTime, true);
  assert.equal(dayOut.isDeepTimeDay, false);

  const deep = context.PatternCalendar.fromCivilDate({ date: "2028-04-16", timeZone: "UTC", boundaryMode: "midnight" });
  assert.equal(deep.isDeepTimeDay, true);
});

test("midnight sunset and manual boundary modes diverge correctly", () => {
  const context = loadContext();
  const instant = "2026-07-18T02:30:00Z";

  const midnight = context.PatternCalendar.fromCivilDate({ date: instant, timeZone: "America/Los_Angeles", boundaryMode: "midnight" });
  const sunset = context.PatternCalendar.fromCivilDate({ date: instant, timeZone: "America/Los_Angeles", boundaryMode: "sunset", sunsetTime: "18:00" });
  const manual = context.PatternCalendar.fromCivilDate({ date: instant, timeZone: "America/Los_Angeles", boundaryMode: "manual", sunsetTime: "18:00" });

  assert.equal(midnight.dayOfPatternYear, 92);
  assert.equal(sunset.dayOfPatternYear, 93);
  assert.equal(manual.dayOfPatternYear, 93);
});

test("oracle engine returns deterministic identical results for identical inputs", () => {
  const context = loadContext();
  const first = context.GenesisOracleEngine.run(baseInput());
  const second = context.GenesisOracleEngine.run(baseInput());

  assert.deepEqual(
    {
      patternPosition: first.patternPosition,
      coreSignature: first.coreSignature,
      nameSignature: first.nameSignature,
      reading: first.reading,
      methods: first.methods.relationshipRules
    },
    {
      patternPosition: second.patternPosition,
      coreSignature: second.coreSignature,
      nameSignature: second.nameSignature,
      reading: second.reading,
      methods: second.methods.relationshipRules
    }
  );
});

test("known and unknown birth time behavior is explicit", () => {
  const context = loadContext();
  const known = context.GenesisOracleEngine.run(baseInput({ birthTime: "06:15" }));
  const unknown = context.GenesisOracleEngine.run(baseInput({ birthTime: "" }));

  assert.equal(known.birthTimeLayer.gate, "dawn");
  assert.equal(unknown.birthTimeLayer.gate, "unknown");
  assert.match(unknown.birthTimeLayer.note, /omitted/i);
});

test("name code handles punctuation accents and multiple words", () => {
  const context = loadContext();
  const result = context.GenesisOracleEngine.run(baseInput({ name: "Éliyahu ben-David O'Connor" }));

  assert.equal(result.nameSignature.source, "Éliyahu ben-David O'Connor");
  assert.ok(Array.isArray(result.nameSignature.individualWordValues));
  assert.ok(result.nameSignature.individualWordValues.length >= 3);
  assert.ok(result.nameSignature.vowelTotal >= 0);
  assert.ok(result.nameSignature.consonantTotal >= 0);
});

test("empty name does not break deterministic outputs", () => {
  const context = loadContext();
  const result = context.GenesisOracleEngine.run(baseInput({ name: "" }));

  assert.equal(result.nameSignature.source, "");
  assert.ok(Number.isFinite(result.nameSignature.covenantSeal));
});

test("native Hebrew and transliteration distinction is explicit", () => {
  const context = loadContext();
  const nativeHebrew = context.GenesisOracleEngine.run(baseInput({ name: "אהרן" }));
  const latin = context.GenesisOracleEngine.run(baseInput({ name: "Aharon" }));

  assert.equal(nativeHebrew.nameSignature.hebrew.mode, "native-hebrew-input");
  assert.equal(latin.nameSignature.hebrew.mode, "transliteration-not-applied");
});

test("daily mirror and transit layer are present and symbolic", () => {
  const context = loadContext();
  const result = context.GenesisOracleEngine.run(baseInput());

  assert.equal(result.dailyMirror.symbolicNotice, "Symbolic reflection only. Not a prediction.");
  assert.ok(result.currentDayTransit.groundedAction.length > 0);
});

test("profile comparison is symmetric for stable fields", () => {
  const context = loadContext();
  const a = context.GenesisOracleEngine.run(baseInput({ name: "A One" }));
  const b = context.GenesisOracleEngine.run(baseInput({ name: "B Two", birthDate: "2026-09-01" }));

  const ab = context.GenesisOracleEngine.compareProfiles(a, b);
  const ba = context.GenesisOracleEngine.compareProfiles(b, a);

  assert.equal(ab.toneRelationship, ba.toneRelationship);
  assert.equal(ab.weekGateRelationship, ba.weekGateRelationship);
});

test("storage keeps legacy profiles and validates imports", () => {
  const context = loadContext({
    localStorageSeed: {
      sofGenesisProfiles: JSON.stringify([{ name: "Legacy", birth: "1990-01-01", moon: 1, day: 1 }])
    }
  });

  const profiles = context.GenesisOracleStorage.readProfiles();
  assert.equal(profiles[0].legacyRecord, true);

  assert.throws(
    () => context.GenesisOracleStorage.importProfiles("{ bad json"),
    /JSON|property name/i
  );

  assert.throws(
    () => context.GenesisOracleStorage.importProfiles(JSON.stringify([{ bad: true }])),
    /No valid Oracle 2.0 profiles/
  );
});

test("obsolete remnant-anchor logic is not active in Oracle 2.0 assets", () => {
  const oracleController = read("docs/assets/js/genesis-oracle.js");
  const oracleHtml = read("docs/genesis-oracle.html");

  assert.doesNotMatch(oracleController, /\bapproxAnchor\b/);
  assert.doesNotMatch(oracleController, /\bmapToRemnant\b/);
  assert.doesNotMatch(oracleHtml, /first New Moon after Spring Equinox/i);
});

test("oracle and moons both load shared pattern calendar scripts", () => {
  const moonsHtml = read("docs/moons.html");
  const oracleHtml = read("docs/genesis-oracle.html");

  const shared = [
    "assets/js/calendar/pattern-calendar-version.js",
    "assets/js/calendar/pattern-calendar-data.js",
    "assets/js/calendar/pattern-calendar-format.js",
    "assets/js/calendar/pattern-calendar-boundary.js",
    "assets/js/calendar/pattern-calendar.js"
  ];

  for (const script of shared) {
    assert.match(moonsHtml, new RegExp(script.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(oracleHtml, new RegExp(script.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(oracleHtml, /assets\/js\/oracle\/oracle-engine\.js/);
  assert.doesNotMatch(oracleHtml, /assets\/js\/calendar-cor\.js/);
});
