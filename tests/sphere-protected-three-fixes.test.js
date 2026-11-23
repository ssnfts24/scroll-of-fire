"use strict";

/*
 * The protected-three fixes (Nov 23, 2026). Aaron opened the
 * protected Sphere files in plain words for exactly three named
 * fixes from his live phone report — "Open the protected Sphere
 * files for these three fixes" — and this file is the change
 * set's signature in tests/homepage-sphere.test.js:
 *
 *   1. The days stuck together: the faced Moon's 28 plates stood
 *      in a 79×41px patch at the opening distance and the pitch
 *      cap shrank them to ~8px. The PRESENTATION lanes widened
 *      (week 1 further out, the week step wider) in the geometry
 *      defaults and the renderer's CALENDAR_RAIL together. The
 *      canonical calendarCell lanes and angles do not move.
 *   2. The day swell (Aaron's calibration: "they fade as normal
 *      but as you approach each day the number expands until you
 *      enter that day"): the faced Moon's plates now swell
 *      continuously with camera distance in the label manager,
 *      composing UNDER the existing pitch cap.
 *   3. The wording drifted behind the Sphere: the renderer's
 *      label projection cadence is keyed to camera movement
 *      instead of a flat 500 ms gate outside gestures.
 *
 * These tests pin the shape of all three fixes and, just as
 * hard, the things that must not move: the canonical lanes, the
 * canonical angle, and the pick round-trip over the widened
 * presentation lanes for every one of the 364 days.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const geometryPath = path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-calendar-geometry.js");
const rendererPath = path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
const labelsPath = path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-label-manager.js");

const geometrySource = fs.readFileSync(geometryPath, "utf8");
const renderer = fs.readFileSync(rendererPath, "utf8");
const labels = fs.readFileSync(labelsPath, "utf8");

const sandbox = {};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(geometrySource, sandbox, { filename: geometryPath });
const geometry = sandbox.LivingTimeSphereCalendarGeometry;

test("protected-three 1: presentation lanes widened, canonical lanes untouched", () => {
  const canonical = [1.298, 1.328, 1.358, 1.388];
  const visual = [1.380, 1.530, 1.680, 1.830];
  for (let week = 1; week <= 4; week += 1) {
    const day = 1 + (week - 1) * 7;
    const cell = geometry.calendarCell(day);
    assert.ok(
      Math.abs(cell.radialFactor - canonical[week - 1]) < 1e-9,
      `canonical lane for week ${week} moved: ${cell.radialFactor}`
    );
    // No options: the geometry defaults themselves carry the
    // widened lanes, so every caller lands on the same face.
    const display = geometry.calendarDisplayCell(day);
    assert.ok(
      Math.abs(display.dayNumberRadialFactor - visual[week - 1]) < 1e-9,
      `presentation lane for week ${week}: ${display.dayNumberRadialFactor}`
    );
    // The reading angle is canonical, widened lanes or not.
    assert.equal(display.angle, cell.angle);
  }
  assert.match(renderer, /dayNumberPresentationWeek1: 1\.380/);
  assert.match(renderer, /dayNumberPresentationWeekStep: 0\.150/);
});

test("protected-three 1: picking round-trips over the widened lanes for all 364 days", () => {
  // nearestDisplayCell searches the same display space the
  // numerals are drawn in, so the day under a widened numeral
  // is still the day that gets selected — for every day.
  for (let day = 1; day <= 364; day += 1) {
    const display = geometry.calendarDisplayCell(day);
    const found = geometry.nearestDisplayCell(
      display.angle,
      display.dayNumberRadialFactor
    );
    assert.equal(found.dayOfPatternYear, day, `day ${day} does not pick itself`);
    assert.equal(found.moon, display.moon);
    assert.equal(found.moonDay, display.moonDay);
  }
});

test("protected-three 2: the swell is a continuous distance ramp, neutral at range", () => {
  assert.match(labels, /const SWELL_START_DISTANCE = 2\.35;/);
  assert.match(labels, /const SWELL_KNEE_DISTANCE = 1\.62;/);
  assert.match(labels, /const SWELL_FULL_DISTANCE = 1\.05;/);
  assert.match(labels, /const SWELL_KNEE_FACTOR = 1\.15;/);
  assert.match(labels, /const SWELL_FULL_FACTOR = 1\.35;/);
  assert.match(labels, /function swellForDistance\(distance\)/);
  // The ramp's shape, restated from the pinned constants: 1 at
  // range (the ordinary laws govern), rising through the knee,
  // full at Living Day entry, continuous and monotonic between.
  const ramp = (d) => {
    if (!Number.isFinite(d) || d >= 2.35) return 1;
    if (d <= 1.05) return 1.35;
    if (d >= 1.62) return 1 + ((2.35 - d) / 0.73) * 0.15;
    return 1.15 + ((1.62 - d) / 0.57) * 0.20;
  };
  assert.equal(ramp(4.24), 1);
  assert.equal(ramp(2.35), 1);
  assert.ok(Math.abs(ramp(1.62) - 1.15) < 1e-9);
  assert.ok(Math.abs(ramp(1.05) - 1.35) < 1e-9);
  let prev = 1;
  for (let d = 2.35; d >= 1.05; d -= 0.01) {
    const v = ramp(d);
    assert.ok(v >= prev - 1e-9, `ramp not monotonic at ${d}`);
    prev = v;
  }
});

test("protected-three 2: the swell composes under the pitch cap at every application point", () => {
  // Cap pass: the faced plate's box bound is divided by the
  // eased swell in force — the same construction the selected
  // day's growth uses, at the ordinary 0.8 fraction.
  assert.match(
    labels,
    /cap = \(nearest \* PLATE_PITCH_CAP_FRACTION\) \/ Math\.max\(_swellEased, 1\);/
  );
  // Layout pass: the faced Moon's plates compose the eased swell.
  assert.match(labels, /apertureScale \* _swellEased/);
  // Tracked entries carry the swell flag from the faced Moon.
  assert.match(labels, /swell: !!\(/);
  // Per-frame composites ride the eased swell, in the write loop
  // and in the pill guard's plate geometry alike.
  assert.match(labels, /entry\.selected \? growth : entry\.swell \? swell : 1/);
  assert.match(labels, /entry\.selected \? growth : entry\.swell \? swell : 1\);/);
  // Frame guard: a swelling plate's rendered diameter is bounded
  // by the ordinary fraction of its live pitch.
  assert.match(
    labels,
    /const renderedBound = PLATE_PITCH_CAP_FRACTION \* nn;/
  );
  // The swell eases with the growth's own character — and on
  // its OWN clock. _easeGrowth stamps _growthLastMs earlier in
  // the same frame; a swell eased against that stamp measures
  // a zero step every frame and never moves (the lab caught
  // exactly this: target 1.21, eased 1.0008).
  assert.match(labels, /function _easeSwell\(nowMs\)/);
  assert.match(labels, /let _swellLastMs = 0;/);
  assert.match(labels, /const last = _swellLastMs \|\| nowMs;/);
  // The selected day's own stage growth is untouched.
  assert.match(labels, /const SELECTED_GROWTH_BY_STAGE = Object\.freeze\(\{\s+approach: 1\.3,\s+living: 1\.55,\s+immersive: 1\.55\s+\}\);/);
});

test("protected-three 3: label cadence is keyed to camera movement", () => {
  assert.match(
    renderer,
    /const cameraMoving = key !== _lastLabelProjectionKey;/
  );
  assert.match(
    renderer,
    /const interactionLite = \(_cameraGestureActive \|\| cameraMoving\) && !force;/
  );
  assert.match(
    renderer,
    /const minInterval = interactionLite \? 96 : 500;/
  );
});
