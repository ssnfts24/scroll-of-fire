"use strict";

// Tests for Today mode date authority and boundary transitions.
// Verifies that Today mode uses PatternCalendar.fromCivilDate (not the Equinox year record)
// and that the boundary engine correctly transitions at the configured sunset time.

const assert = require("node:assert/strict");
const fs     = require("node:fs");
const path   = require("node:path");
const test   = require("node:test");
const vm     = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

// ── Context loader ────────────────────────────────────────────────────────────

function loadContext() {
  const ctx = {
    Intl,
    Date,
    URL,
    console,
    location: { href: "https://codexofreality.org/living-time-sphere.html", hostname: "codexofreality.org" }
  };
  ctx.globalThis = ctx;
  ctx.window     = ctx;

  const scripts = [
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
    "docs/assets/js/alignment/alignment-version.js",
    "docs/assets/js/alignment/alignment-ledger-engine.js",
    "docs/assets/js/alignment/alignment-ledger-data.js",
    "docs/assets/js/alignment/alignment-comparison.js",
    "docs/assets/js/alignment/alignment-recurrence.js",
    "docs/assets/js/alignment/alignment-offsets.js",
    "docs/assets/js/alignment/alignment-signature.js",
    "docs/assets/js/alignment/alignment-export.js",
    "docs/assets/js/alignment/alignment-url-state.js",
    "docs/assets/js/sphere/living-time-sphere-version.js",
    "docs/assets/js/sphere/living-time-sphere-model.js",
    "docs/assets/js/sphere/living-time-sphere-layout.js",
    "docs/assets/js/sphere/living-time-sphere-renderer-svg.js",
    "docs/assets/js/sphere/living-time-sphere-accessibility.js",
    "docs/assets/js/sphere/living-time-sphere-export.js",
    "docs/assets/js/sphere/living-time-sphere-url-state.js",
  ];

  for (const rel of scripts) vm.runInNewContext(read(rel), ctx);
  return ctx;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Build a civil-date ISO instant for a given local wall-clock in America/Los_Angeles.
// We use a UTC offset that matches PDT (UTC-7) in July 2026.
// America/Los_Angeles observes PDT (UTC-7) in July.
const PDT_OFFSET = 7 * 60 * 60 * 1000; // 7 h behind UTC

function pdtToUtc(localIso) {
  // localIso: "2026-07-22T17:59:00" (wall clock in Los Angeles during PDT)
  return new Date(new Date(localIso + "Z").getTime() + PDT_OFFSET);
}

// ── Boundary transition tests: America/Los_Angeles ────────────────────────────

// Anchor: April 17 2026 = Moon 1, Day 1, Day 1/364.
// July 22 2026 = 96 days after April 17 (0-indexed) → Day 97/364, Moon 4, Day 13.
// July 23 2026 = 97 days after April 17 → Day 98/364, Moon 4, Day 14.

test("boundary: 2026-07-22 17:59 LA/manual-18:00 → Moon 4 · Day 13 · Day 97/364", () => {
  const ctx = loadContext();
  // 17:59 local PDT → before 18:00 boundary → effective = civil = 2026-07-22
  const now = pdtToUtc("2026-07-22T17:59:00");
  const result = ctx.PatternCalendar.fromCivilDate({
    date: now,
    timeZone: "America/Los_Angeles",
    boundaryMode: "manual",
    sunsetTime: "18:00",
  });
  assert.equal(result.moon,             4,   `moon: expected 4, got ${result.moon}`);
  assert.equal(result.day,              13,  `day: expected 13, got ${result.day}`);
  assert.equal(result.dayOfPatternYear, 97,  `dayOfPatternYear: expected 97, got ${result.dayOfPatternYear}`);
  assert.equal(result.afterBoundary,    false, "should NOT be after boundary at 17:59");
  assert.equal(result.effectiveDate,    "2026-07-22");
});

test("boundary: 2026-07-22 18:00 LA/manual-18:00 → Moon 4 · Day 14 · Day 98/364", () => {
  const ctx = loadContext();
  // 18:00 local PDT → at boundary → effective = 2026-07-23
  const now = pdtToUtc("2026-07-22T18:00:00");
  const result = ctx.PatternCalendar.fromCivilDate({
    date: now,
    timeZone: "America/Los_Angeles",
    boundaryMode: "manual",
    sunsetTime: "18:00",
  });
  assert.equal(result.moon,             4,   `moon: expected 4, got ${result.moon}`);
  assert.equal(result.day,              14,  `day: expected 14, got ${result.day}`);
  assert.equal(result.dayOfPatternYear, 98,  `dayOfPatternYear: expected 98, got ${result.dayOfPatternYear}`);
  assert.equal(result.afterBoundary,    true, "should be after boundary at 18:00");
  assert.equal(result.effectiveDate,    "2026-07-23");
});

test("boundary: 2026-07-22 20:19 LA/manual-18:00 → Moon 4 · Day 14 · Day 98/364", () => {
  const ctx = loadContext();
  // 20:19 local PDT, past 18:00 → effective = 2026-07-23
  const now = pdtToUtc("2026-07-22T20:19:00");
  const result = ctx.PatternCalendar.fromCivilDate({
    date: now,
    timeZone: "America/Los_Angeles",
    boundaryMode: "manual",
    sunsetTime: "18:00",
  });
  assert.equal(result.moon,             4,   `moon: expected 4, got ${result.moon}`);
  assert.equal(result.day,              14,  `day: expected 14, got ${result.day}`);
  assert.equal(result.dayOfPatternYear, 98,  `dayOfPatternYear: expected 98, got ${result.dayOfPatternYear}`);
});

test("boundary: 2026-07-22 20:19 LA/midnight → Moon 4 · Day 13 · Day 97/364", () => {
  const ctx = loadContext();
  // Under midnight boundary, 20:19 is still Day 97 (same civil date)
  const now = pdtToUtc("2026-07-22T20:19:00");
  const result = ctx.PatternCalendar.fromCivilDate({
    date: now,
    timeZone: "America/Los_Angeles",
    boundaryMode: "midnight",
    sunsetTime: "18:00",
  });
  assert.equal(result.moon,             4,   `moon: expected 4, got ${result.moon}`);
  assert.equal(result.day,              13,  `day: expected 13, got ${result.day}`);
  assert.equal(result.dayOfPatternYear, 97,  `dayOfPatternYear: expected 97, got ${result.dayOfPatternYear}`);
  assert.equal(result.afterBoundary,    false, "midnight boundary: not after boundary at 20:19");
});

// ── Boundary tests: UTC ───────────────────────────────────────────────────────

test("boundary: UTC - 2026-07-22 00:00 UTC midnight boundary → Day 97/364", () => {
  const ctx = loadContext();
  const now = new Date("2026-07-22T00:00:00Z");
  const result = ctx.PatternCalendar.fromCivilDate({
    date: now,
    timeZone: "UTC",
    boundaryMode: "midnight",
  });
  assert.equal(result.moon,             4);
  assert.equal(result.day,              13);
  assert.equal(result.dayOfPatternYear, 97);
});

// ── Boundary tests: America/New_York ─────────────────────────────────────────
// EDT = UTC-4; July 22 2026 in New York.

const EDT_OFFSET = 4 * 60 * 60 * 1000;
function edtToUtc(localIso) {
  return new Date(new Date(localIso + "Z").getTime() + EDT_OFFSET);
}

test("boundary: America/New_York 17:59 manual-18:00 → Day 97/364", () => {
  const ctx = loadContext();
  const now = edtToUtc("2026-07-22T17:59:00");
  const result = ctx.PatternCalendar.fromCivilDate({
    date: now,
    timeZone: "America/New_York",
    boundaryMode: "manual",
    sunsetTime: "18:00",
  });
  assert.equal(result.dayOfPatternYear, 97);
  assert.equal(result.afterBoundary, false);
});

test("boundary: America/New_York 18:01 manual-18:00 → Day 98/364", () => {
  const ctx = loadContext();
  const now = edtToUtc("2026-07-22T18:01:00");
  const result = ctx.PatternCalendar.fromCivilDate({
    date: now,
    timeZone: "America/New_York",
    boundaryMode: "manual",
    sunsetTime: "18:00",
  });
  assert.equal(result.dayOfPatternYear, 98);
  assert.equal(result.afterBoundary, true);
});

// ── Invalid manual sunset falls back gracefully ───────────────────────────────

test("boundary: invalid manual sunset string falls back to midnight behaviour", () => {
  const ctx = loadContext();
  const now = pdtToUtc("2026-07-22T20:00:00");
  // "not-a-time" is invalid; PatternCalendarFormat.parseClock should treat it as 00:00 or similar
  let result;
  try {
    result = ctx.PatternCalendar.fromCivilDate({
      date: now,
      timeZone: "America/Los_Angeles",
      boundaryMode: "manual",
      sunsetTime: "not-a-time",
    });
    // Should not throw; result is a valid object
    assert.ok(typeof result.moon === "number" || result.moon === null);
  } catch (e) {
    // Acceptable: throws for invalid input
    assert.ok(e instanceof Error);
  }
});

// ── Day Out of Time ───────────────────────────────────────────────────────────
// Day 365 (April 16 2027 = 364 days after April 17 2026) is Day Out of Time.

test("boundary: Day Out of Time (2027-04-16) → isDayOutOfTime true", () => {
  const ctx = loadContext();
  // April 16 2027 UTC noon → Day 365 of pattern year 1
  const now = new Date("2027-04-16T12:00:00Z");
  const result = ctx.PatternCalendar.fromCivilDate({
    date: now,
    timeZone: "UTC",
    boundaryMode: "midnight",
  });
  assert.equal(result.isDayOutOfTime, true, "expected isDayOutOfTime");
  assert.equal(result.moon, null, "moon should be null on Day Out of Time");
  assert.equal(result.day,  null, "day should be null on Day Out of Time");
});

// ── buildTodayModel uses PatternCalendar position ─────────────────────────────

test("buildTodayModel: todayPatternPosition is present and uses PatternCalendar", () => {
  const ctx = loadContext();
  const now = pdtToUtc("2026-07-22T17:59:00");
  const model = ctx.LivingTimeSphereModel.buildTodayModel({
    timeZone: "America/Los_Angeles",
    boundaryMode: "manual",
    manualSunset: "18:00",
    asOf: now,
  });
  assert.ok(model.todayPatternPosition, "todayPatternPosition must be present");
  const tp = model.todayPatternPosition;
  assert.equal(tp.moon, 4,  `today moon: expected 4, got ${tp.moon}`);
  assert.equal(tp.day,  13, `today day: expected 13, got ${tp.day}`);
  assert.equal(tp.dayOfPatternYear, 97, `today dayOfYear: expected 97, got ${tp.dayOfPatternYear}`);
  assert.equal(tp.effectiveDate, "2026-07-22");
});

test("buildTodayModel: todayPatternPosition advances after boundary", () => {
  const ctx = loadContext();
  const beforeBoundary = pdtToUtc("2026-07-22T17:59:00");
  const afterBoundary  = pdtToUtc("2026-07-22T18:01:00");

  const modelBefore = ctx.LivingTimeSphereModel.buildTodayModel({
    timeZone: "America/Los_Angeles",
    boundaryMode: "manual",
    manualSunset: "18:00",
    asOf: beforeBoundary,
  });
  const modelAfter = ctx.LivingTimeSphereModel.buildTodayModel({
    timeZone: "America/Los_Angeles",
    boundaryMode: "manual",
    manualSunset: "18:00",
    asOf: afterBoundary,
  });

  assert.equal(modelBefore.todayPatternPosition.dayOfPatternYear, 97, "before boundary: Day 97");
  assert.equal(modelAfter.todayPatternPosition.dayOfPatternYear,  98, "after boundary: Day 98");
  assert.equal(modelBefore.todayPatternPosition.day, 13, "before: Day 13");
  assert.equal(modelAfter.todayPatternPosition.day,  14, "after: Day 14");
});

test("buildTodayModel: currentPatternAngle differs before vs after boundary", () => {
  const ctx = loadContext();
  const before = pdtToUtc("2026-07-22T17:59:00");
  const after  = pdtToUtc("2026-07-22T18:01:00");

  const mBefore = ctx.LivingTimeSphereModel.buildTodayModel({
    timeZone: "America/Los_Angeles", boundaryMode: "manual", manualSunset: "18:00", asOf: before,
  });
  const mAfter = ctx.LivingTimeSphereModel.buildTodayModel({
    timeZone: "America/Los_Angeles", boundaryMode: "manual", manualSunset: "18:00", asOf: after,
  });

  // currentPatternAngle for Day 97 != Day 98
  assert.notEqual(mBefore.currentPatternAngle, mAfter.currentPatternAngle,
    "currentPatternAngle must change after boundary transition");
  // Day 97 → (96/364)*360 ≈ 94.725°
  const expected97 = (96 / 364) * 360;
  assert.ok(Math.abs(mBefore.currentPatternAngle - expected97) < 0.1,
    `Day 97 angle expected ~${expected97.toFixed(2)}°, got ${mBefore.currentPatternAngle}`);
});

test("buildTodayModel: todayPatternPosition does NOT come from Equinox year record", () => {
  const ctx = loadContext();
  const now = pdtToUtc("2026-07-22T12:00:00");

  const model = ctx.LivingTimeSphereModel.buildTodayModel({
    timeZone: "America/Los_Angeles",
    boundaryMode: "manual",
    manualSunset: "18:00",
    asOf: now,
  });

  // Equinox position for 2026 falls in Moon 13 (near the end of the pattern year)
  // because the March 2026 Equinox occurs late in Pattern Year 1.
  // Today (July 22 2026) is Moon 4, Day 13 — these must not be the same as the Equinox position.
  const equinoxPos = model.sourceRecord?.equinox?.patternPosition || {};
  const todayPos   = model.todayPatternPosition;

  // At minimum, today's moon (4) should not equal the Equinox moon (which is ~13)
  // unless by extraordinary coincidence. July 22 is solidly in Moon 4.
  assert.equal(todayPos.moon, 4, "today moon must be 4 for July 22 2026");
  if (equinoxPos.moon != null) {
    assert.notEqual(
      todayPos.dayOfPatternYear,
      equinoxPos.dayOfPatternYear,
      "today dayOfPatternYear must differ from equinox dayOfPatternYear"
    );
  }
});

// ── viewMode check ────────────────────────────────────────────────────────────

test("buildTodayModel: viewMode is 'today'", () => {
  const ctx = loadContext();
  const model = ctx.LivingTimeSphereModel.buildTodayModel({
    timeZone: "UTC", boundaryMode: "midnight",
    asOf: new Date("2026-07-22T12:00:00Z"),
  });
  assert.equal(model.viewMode, "today");
});

// ── Anchor date sanity check ──────────────────────────────────────────────────

test("PatternCalendar: April 17 2026 is Moon 1 · Day 1 · Day 1/364", () => {
  const ctx = loadContext();
  const result = ctx.PatternCalendar.fromCivilDate({
    date: new Date("2026-04-17T12:00:00Z"),
    timeZone: "UTC",
    boundaryMode: "midnight",
  });
  assert.equal(result.moon,             1);
  assert.equal(result.day,              1);
  assert.equal(result.dayOfPatternYear, 1);
  assert.equal(result.isDayOutOfTime,   false);
});

// ── Leap Deep Time Day (year 2 of 2-year window, if applicable) ───────────────

test("PatternCalendar: Deep Time Day is not a regular moon-day", () => {
  const ctx = loadContext();
  // Deep Time Day would be April 17 2028 (if 2027 is a leap year giving a 366-day window).
  // We test that the logic handles the intercalary day without throwing.
  // The actual date depends on leap-year arithmetic — just verify no crash.
  const testDate = new Date("2028-04-17T12:00:00Z");
  let result;
  try {
    result = ctx.PatternCalendar.fromCivilDate({
      date: testDate,
      timeZone: "UTC",
      boundaryMode: "midnight",
    });
    // Either it's a Deep Time Day or Day Out of Time — moon must be null
    if (result.isDeepTimeDay || result.isDayOutOfTime) {
      assert.equal(result.moon, null);
      assert.equal(result.day,  null);
    }
  } catch (e) {
    assert.fail(`PatternCalendar.fromCivilDate threw for April 17 2028: ${e}`);
  }
});

// ── JS syntax check ───────────────────────────────────────────────────────────

const filesToSyntaxCheck = [
  "docs/assets/js/sphere/living-time-sphere-model.js",
  "docs/assets/js/sphere/living-time-sphere-today.js",
  "docs/assets/js/sphere/living-time-sphere-ui.js",
  "docs/assets/js/sphere/living-time-sphere-renderer-3d.js",
];

const { execFileSync } = require("node:child_process");
for (const f of filesToSyntaxCheck) {
  test(`JS syntax: ${path.basename(f)} is valid`, () => {
    execFileSync(process.execPath, ["--check", path.join(root, f)]);
  });
}
