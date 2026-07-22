"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

const scripts = [
  "docs/assets/js/calendar/pattern-calendar-version.js",
  "docs/assets/js/calendar/pattern-calendar-data.js",
  "docs/assets/js/calendar/pattern-calendar-format.js",
  "docs/assets/js/calendar/pattern-calendar-boundary.js",
  "docs/assets/js/calendar/pattern-calendar.js",
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

function loadContext() {
  const storage = new Map();
  const context = {
    Date,
    Intl,
    URL,
    URLSearchParams,
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); }
    }
  };
  context.globalThis = context;
  context.window = context;
  scripts.forEach(script => vm.runInNewContext(read(script), context));
  return context;
}

function runInput(overrides = {}) {
  return {
    name: "Aaron-Paul O'Neil",
    birthDate: "2026-07-17",
    birthTime: "07:12",
    timeZone: "UTC",
    boundaryMode: "midnight",
    sunsetTime: "18:00",
    currentDate: "2026-07-19T12:00:00Z",
    ...overrides
  };
}

test("mirror-reading 2.0 stays deterministic for identical inputs and version", () => {
  const context = loadContext();
  const a = context.GenesisOracleEngine.run(runInput());
  const b = context.GenesisOracleEngine.run(runInput());

  assert.equal(a.mirrorReading.version, "mirror-reading/2.0.0");
  assert.deepEqual(a.mirrorReading, b.mirrorReading);
});

test("mirror through my seal adds symbolic comparison when a saved profile is selected", () => {
  const context = loadContext();

  const selectedProfile = context.GenesisOracleEngine.run(runInput({ name: "Saved Profile" }));
  const compared = context.GenesisOracleEngine.run(runInput({
    selectedProfile: {
      patternPosition: selectedProfile.patternPosition,
      coreSignature: selectedProfile.coreSignature
    }
  }));

  assert.equal(compared.mirrorReading.symbolicNotice, "Symbolic reflection only. Not a prediction.");
  assert.ok(compared.mirrorReading.mirrorThroughMySeal);
  assert.ok(compared.mirrorReading.mirrorThroughMySeal.support.length > 0);
  assert.ok(compared.mirrorReading.mirrorThroughMySeal.witnessQuestion.length > 0);
});
