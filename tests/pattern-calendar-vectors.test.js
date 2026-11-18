"use strict";

/**
 * D1 conformance: the JS PatternCalendar must reproduce every vector in
 * the language-neutral corpus (tests/fixtures/pattern-calendar-vectors.json).
 *
 * The corpus is the binding contract between this implementation and the
 * Python side in ssnfts24/living-phone, which vendors a byte-identical
 * copy and asserts the same vectorsSha256 digest. Neither implementation
 * wins — the fixtures win. Regenerate with
 * scripts/generate-pattern-calendar-vectors.mjs (it refuses to write if
 * Aaron's canonical fixtures no longer reproduce).
 */

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
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
  "docs/assets/js/calendar/pattern-calendar.js"
];

function loadCalendar() {
  const context = { Date, Intl, URL, URLSearchParams };
  context.globalThis = context;
  context.window = context;
  scripts.forEach(script => vm.runInNewContext(read(script), context));
  return context.PatternCalendar;
}

const corpus = JSON.parse(read("tests/fixtures/pattern-calendar-vectors.json"));

/** Canonical serialization — must match Python json.dumps(sort_keys=True,
 *  separators=(",", ":"), ensure_ascii=False) byte for byte. */
function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

test("corpus digest matches the recorded vectorsSha256", () => {
  const digest = createHash("sha256").update(stableStringify(corpus.vectors), "utf8").digest("hex");
  assert.equal(digest, corpus.vectorsSha256);
  assert.equal(corpus.vectors.length, corpus.vectorCount);
});

test("Aaron's canonical fixtures are the corpus anchors", () => {
  const anchors = corpus.vectors.filter(v => v.group === "anchors");
  assert.equal(anchors.length, 2);
  const byDate = Object.fromEntries(anchors.map(v => [v.expected.civilDate, v.expected]));
  assert.equal(byDate["2026-07-17"].moon, 4);
  assert.equal(byDate["2026-07-17"].day, 8);
  assert.equal(byDate["2026-07-17"].patternDay, 92);
  assert.equal(byDate["2026-09-15"].moon, 6);
  assert.equal(byDate["2026-09-15"].day, 12);
  assert.equal(byDate["2026-09-15"].patternDay, 152);
});

test("PatternCalendar reproduces every corpus vector", () => {
  const calendar = loadCalendar();
  const failures = [];
  for (const vector of corpus.vectors) {
    const result = calendar.fromCivilDate({
      date: vector.input.instantUtc,
      timeZone: vector.input.timeZone,
      boundaryMode: vector.input.boundaryMode,
      sunsetTime: vector.input.sunsetTime
    });
    const actual = {
      civilDate: result.civilDate,
      effectiveDate: result.effectiveDate,
      patternYear: result.patternYear,
      insideCountedYear: result.insideCountedYear,
      moon: result.moon,
      moonName: result.moonName,
      day: result.day,
      patternDay: result.dayOfPatternYear,
      weekOfMoon: result.weekOfMoon,
      weekOfYear: result.weekOfYear,
      civilWeekday: result.civilWeekday,
      isDayOutOfTime: result.isDayOutOfTime,
      isDeepTimeDay: result.isDeepTimeDay,
      intercalaryIndex: result.intercalaryIndex,
      countedYearLength: result.countedYearLength
    };
    try {
      assert.deepEqual(actual, vector.expected);
    } catch {
      failures.push(`${vector.id}: expected ${JSON.stringify(vector.expected)}, got ${JSON.stringify(actual)}`);
    }
  }
  assert.deepEqual(failures, [], `${failures.length} vector(s) diverged:\n${failures.slice(0, 10).join("\n")}`);
});
