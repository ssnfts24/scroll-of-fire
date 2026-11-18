#!/usr/bin/env node
/**
 * Generate the language-neutral Pattern Calendar test-vector corpus.
 *
 * The corpus is the D1 binding contract between the two pattern-calendar
 * implementations (JS PatternCalendar on the site, the future Python
 * implementation in living-phone): neither implementation wins — the
 * fixtures win. Vectors are generated FROM the JS implementation (the
 * fixture-verified reference), but generation is only trusted after the
 * implementation reproduces Aaron's two canonical fixtures exactly:
 *
 *   July 17, 2026 = Moon 4 Day 8, Pattern Day 92
 *   Sept 15, 2026 = Moon 6 Day 12, Pattern Day 152
 *
 * If either anchor fails, this script exits non-zero and writes nothing.
 *
 * Output: tests/fixtures/pattern-calendar-vectors.json
 * The vendored copy in ssnfts24/living-phone (tests/fixtures/) must stay
 * byte-identical; both suites assert the same vectorsSha256 digest over
 * the canonical serialization of the vectors array.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

const calendar = loadCalendar();

/** Stable stringify: recursively sorted keys, no whitespace. Must produce
 *  bytes identical to Python json.dumps(..., sort_keys=True,
 *  separators=(",", ":"), ensure_ascii=False). */
function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

/** UTC instant for a wall-clock date/time in an IANA time zone. */
function zonedTimeToUtc(dateStr, timeStr, timeZone) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  let guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
    }).formatToParts(new Date(guess));
    const p = {};
    for (const part of parts) if (part.type !== "literal") p[part.type] = Number(part.value);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour === 24 ? 0 : p.hour, p.minute, p.second);
    const next = guess + (Date.UTC(y, m - 1, d, hh, mm, 0) - asUtc);
    if (next === guess) break;
    guess = next;
  }
  return new Date(guess).toISOString();
}

function expectedOf(result) {
  return {
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
}

const vectors = [];
function addVector(group, input, note) {
  const result = calendar.fromCivilDate({
    date: input.instantUtc,
    timeZone: input.timeZone,
    boundaryMode: input.boundaryMode,
    sunsetTime: input.sunsetTime
  });
  const vector = {
    id: `${group}-${String(vectors.filter(v => v.group === group).length + 1).padStart(3, "0")}`,
    group,
    input,
    expected: expectedOf(result)
  };
  if (note) vector.note = note;
  vectors.push(vector);
  return vector;
}

const utcMidnight = dateStr => ({
  instantUtc: `${dateStr}T12:00:00.000Z`,
  timeZone: "UTC",
  boundaryMode: "midnight",
  sunsetTime: "18:00"
});

function addDays(dateStr, amount) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + amount * 86400000);
  return t.toISOString().slice(0, 10);
}

/* --- 1. Aaron's canonical fixtures — asserted before anything is trusted. */
const anchorSpecs = [
  { date: "2026-07-17", moon: 4, day: 8, patternDay: 92 },
  { date: "2026-09-15", moon: 6, day: 12, patternDay: 152 }
];
for (const spec of anchorSpecs) {
  const v = addVector("anchors", utcMidnight(spec.date),
    "Aaron's canonical fixture — asserted against his stated values before generation is trusted.");
  const e = v.expected;
  if (e.moon !== spec.moon || e.day !== spec.day || e.patternDay !== spec.patternDay) {
    console.error(`ANCHOR FAILURE: ${spec.date} produced Moon ${e.moon} Day ${e.day} Pattern Day ${e.patternDay}, ` +
      `expected Moon ${spec.moon} Day ${spec.day} Pattern Day ${spec.patternDay}. Refusing to generate.`);
    process.exit(1);
  }
}
console.log("Anchors verified: 2026-07-17 = Moon 4 Day 8 PD 92; 2026-09-15 = Moon 6 Day 12 PD 152.");

/* --- 2. Full daily sweeps of two counted-year windows. */
function sweep(group, startDate, endDate) {
  for (let d = startDate; ; d = addDays(d, 1)) {
    const v = addVector(group, utcMidnight(d));
    const e = v.expected;
    if (e.patternDay === 1) v.note = "Year Gate — Moon 1 Day 1.";
    else if (e.patternDay === 364) v.note = "Day 364 — Moon 13 Day 28, last counted day.";
    else if (e.isDayOutOfTime) v.note = "Day Out of Time — intercalary day 1, outside the 364-day count.";
    else if (e.isDeepTimeDay) v.note = "Deep Time Day — leap intercalary day 2, outside the 364-day count.";
    else if (e.day === 1) v.note = `Moon ${e.moon} begins.`;
    if (d === endDate) break;
  }
}
sweep("sweep-2026", "2026-04-17", "2027-04-16");       // 365-day window, Day Out of Time at the end
sweep("sweep-2027-leap", "2027-04-17", "2028-04-17");  // 366-day leap window: Day Out of Time + Deep Time Day

/* --- 3. Boundary / time-zone cases (sunset boundary is the site default). */
const LA = "America/Los_Angeles";
function zoned(group, dateStr, timeStr, timeZone, boundaryMode, sunsetTime, note) {
  addVector(group, {
    instantUtc: zonedTimeToUtc(dateStr, timeStr, timeZone),
    timeZone, boundaryMode, sunsetTime
  }, note);
}
// Sunset mode, Los Angeles: before vs after the 18:00 boundary on a fixture date.
zoned("boundary", "2026-07-17", "17:30", LA, "sunset", "18:00", "Sunset mode, before sunset: effective date is the civil date.");
zoned("boundary", "2026-07-17", "18:30", LA, "sunset", "18:00", "Sunset mode, after sunset: effective date rolls to the next day.");
zoned("boundary", "2026-07-17", "18:00", LA, "sunset", "18:00", "Sunset mode, exactly at sunset: boundary is inclusive, day rolls.");
zoned("boundary", "2026-07-17", "17:59", LA, "sunset", "18:00", "Sunset mode, one minute before sunset: no roll.");
// Year Gate crossing at sunset.
zoned("boundary", "2026-04-16", "19:00", LA, "sunset", "18:00", "Sunset on the intercalary eve: effective date is the Year Gate, Moon 1 Day 1.");
zoned("boundary", "2026-04-16", "10:00", LA, "sunset", "18:00", "Morning of the intercalary eve: still the Day Out of Time of the prior year.");
// Day Out of Time crossings at sunset.
zoned("boundary", "2027-04-15", "19:30", LA, "sunset", "18:00", "Sunset on Day 364: effective date is the Day Out of Time.");
zoned("boundary", "2027-04-16", "19:30", LA, "sunset", "18:00", "Sunset on the Day Out of Time: effective date is the next Year Gate.");
// Deep Time Day crossings at sunset (leap window).
zoned("boundary", "2028-04-15", "19:00", LA, "sunset", "18:00", "Sunset on the Day Out of Time (leap window): effective date is the Deep Time Day.");
zoned("boundary", "2028-04-16", "19:00", LA, "sunset", "18:00", "Sunset on the Deep Time Day: effective date is the next Year Gate.");
// Custom sunset time.
zoned("boundary", "2026-09-15", "17:45", LA, "sunset", "17:30", "Custom sunset 17:30, local 17:45: day rolls past the fixture date.");
zoned("boundary", "2026-09-15", "17:15", LA, "sunset", "17:30", "Custom sunset 17:30, local 17:15: no roll.");
// Midnight mode ignores the clock entirely, in any zone.
zoned("boundary", "2026-07-17", "23:30", LA, "midnight", "18:00", "Midnight mode late evening: no roll.");
zoned("boundary", "2026-07-17", "00:30", LA, "midnight", "18:00", "Midnight mode just after midnight: civil date rules.");
// A far-east zone: the same instant is already tomorrow there.
zoned("boundary", "2026-07-17", "23:30", "Pacific/Auckland", "sunset", "18:00", "Auckland evening after sunset: effective date rolls.");
zoned("boundary", "2026-07-18", "08:00", "Pacific/Auckland", "midnight", "18:00", "Auckland morning of the next civil day, midnight mode.");
// UTC sunset mode at the exact boundary.
zoned("boundary", "2026-09-15", "18:00", "UTC", "sunset", "18:00", "UTC sunset mode exactly at 18:00: inclusive boundary rolls the day.");

/* --- 4. Historical / far-future arithmetic (fixed-epoch model). */
const historical = [
  ["1600-04-17", "Year Gate deep in the pre-epoch past (pattern year is negative by arithmetic)."],
  ["1600-04-16", "Intercalary day deep in the pre-epoch past."],
  ["1900-06-15", "Ordinary mid-window day, 1900."],
  ["2000-01-01", "Civil year boundary inside a counted year — no pattern-calendar event."],
  ["2024-02-29", "Civil leap day inside a counted year — counted like any other day."],
  ["2025-04-17", "Year Gate of pattern year 0 (the window before the epoch year)."],
  ["2025-04-16", "Day Out of Time closing pattern year -1."],
  ["2400-04-16", "Deep Time Day in the far future: the 2399 window contains Feb 29, 2400 (divisible by 400)."],
  ["2400-04-17", "Year Gate, 2400."]
];
for (const [date, note] of historical) addVector("historical", utcMidnight(date), note);

/* --- Write the corpus. */
const digest = createHash("sha256").update(stableStringify(vectors), "utf8").digest("hex");
const corpus = {
  corpus: "pattern-calendar-vectors",
  version: 1,
  description: "Language-neutral conformance vectors for the 13 Moons Pattern Calendar. " +
    "Generated from the JS PatternCalendar in ssnfts24/scroll-of-fire (the fixture-verified reference) " +
    "by scripts/generate-pattern-calendar-vectors.mjs, after asserting Aaron's canonical fixtures. " +
    "Inputs are an unambiguous UTC instant plus timeZone/boundaryMode/sunsetTime; expected values are the " +
    "implementation's full scalar summary. The vendored copy in ssnfts24/living-phone must stay byte-identical.",
  anchors: [
    { civilDate: "2026-07-17", moon: 4, day: 8, patternDay: 92, source: "Aaron's canonical fixture" },
    { civilDate: "2026-09-15", moon: 6, day: 12, patternDay: 152, source: "Aaron's canonical fixture" }
  ],
  vectorCount: vectors.length,
  vectorsSha256: digest,
  vectors
};

const lines = [];
lines.push("{");
lines.push(`  "corpus": ${JSON.stringify(corpus.corpus)},`);
lines.push(`  "version": ${corpus.version},`);
lines.push(`  "description": ${JSON.stringify(corpus.description)},`);
lines.push(`  "anchors": ${JSON.stringify(corpus.anchors)},`);
lines.push(`  "vectorCount": ${corpus.vectorCount},`);
lines.push(`  "vectorsSha256": ${JSON.stringify(corpus.vectorsSha256)},`);
lines.push(`  "vectors": [`);
vectors.forEach((v, i) => lines.push(`    ${JSON.stringify(v)}${i < vectors.length - 1 ? "," : ""}`));
lines.push("  ]");
lines.push("}");

const outPath = path.join(root, "tests", "fixtures", "pattern-calendar-vectors.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
console.log(`Wrote ${vectors.length} vectors to ${path.relative(root, outPath)} (vectorsSha256 ${digest.slice(0, 12)}…)`);
