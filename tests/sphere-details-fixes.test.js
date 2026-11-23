"use strict";

/*
 * The Sphere details fixes (Nov 23, 2026). Aaron, reviewing the
 * visual sweep's three held items, opened the protected Sphere
 * files for exactly these fixes in one pass — "might as well
 * give me the Sphere details all together. To review all at once
 * in one PR" — and this file is the change set's signature in
 * tests/homepage-sphere.test.js:
 *
 *   1. The rim tags clipped at the stage edges (sweep B1). The
 *      season and gate name tags are sprites standing on rim
 *      markers; when a marker neared the stage's edge, half the
 *      tag drew outside the frame and the word read sliced. The
 *      renderer now keeps every standing tag whole: each frame
 *      the tag's recorded anchor is projected, and if the tag's
 *      screen box would cross the stage's edge its centre is
 *      clamped the smallest step inward that keeps it whole, at
 *      the anchor's own depth. The anchors, geometry, lanes,
 *      calendar math, picking, and the label cadence PR #267 set
 *      do not move; when a marker leaves the rim, the tag stands
 *      on it again exactly.
 *   2. The centre plaque's third line (sweep B2). The hub plate
 *      read the faced day's archetype by its bare name, and Day
 *      25's archetype is named "Name" — the plate read "Deep
 *      Mirror — Name", the one word on the instrument that reads
 *      as an unfilled placeholder. The line now carries the
 *      day's own archetype text — the telling the calendar keeps
 *      beside the name ("Recover identity and purpose." for Day
 *      25) — for every day of the 364, proven below for all 364
 *      positions and for the outside days, whose plate branch
 *      never carried the line and does not change.
 *   3. The year chip's jargon (sweep P4). The temporal strata's
 *      semantic targets carried the instrument's internal name
 *      "temporal membrane" on a public face. The detail now says
 *      in plain words what the marker is: the same day in that
 *      year.
 *
 * The last test pins what must not move: PR #267's day spread,
 * swell, and label cadence, and the canonical lanes.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const rendererPath = path.join(root, "docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
const strataPath = path.join(root, "docs/assets/js/sphere/living-time-sphere-temporal-strata.js");
const geometryPath = path.join(root, "docs/assets/js/sphere/living-time-sphere-calendar-geometry.js");
const labelsPath = path.join(root, "docs/assets/js/sphere/living-time-sphere-label-manager.js");
const renderer = fs.readFileSync(rendererPath, "utf8");

// Extract one top-level function from a source file so the test
// runs the file's own words, not a copy of them.
function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists in its source`);
  const open = source.indexOf("{", start);
  let depth = 0;
  let i = open;
  for (; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  assert.ok(depth === 0, `${name} closes`);
  return source.slice(start, i + 1);
}

// ── Fix 1: the rim tags, kept whole ─────────────────────────────

test("details 1: the tag clamp keeps the whole box inside the stage", () => {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(
    `${extractFunction(renderer, "_armillaryTagClampCentre")}; globalThis.__clamp = _armillaryTagClampCentre;`,
    sandbox
  );
  const clamp = sandbox.__clamp;
  const margin = 0.012;
  for (const half of [0.01, 0.03, 0.08, 0.16, 0.3, 0.5, 0.9]) {
    for (let v = -1.8; v <= 1.8; v += 0.02) {
      const c = clamp(v, half, margin);
      // The centre never leaves the allowed band…
      assert.ok(
        Math.abs(c) <= Math.max(0, 1 - half - margin) + 1e-12,
        `centre ${c} outside the band for half=${half}, v=${v}`
      );
      // …and when the tag can fit whole, the clamped box is whole.
      if (half + margin < 1) {
        assert.ok(
          Math.abs(c) + half <= 1 - margin + 1e-9,
          `box crosses the edge for half=${half}, v=${v}`
        );
      }
      // A value already inside the band stands exactly where it was:
      // the anchors do not move when there is room.
      if (Math.abs(v) <= 1 - half - margin) {
        assert.equal(c, v, `inside value moved for half=${half}, v=${v}`);
      }
    }
    // A value at the very rim comes in by exactly the overflow.
    assert.equal(clamp(1, half, margin), Math.max(0, 1 - half - margin));
    assert.equal(clamp(-1, half, margin), -Math.max(0, 1 - half - margin));
  }
});

test("details 1: the keep-whole pass stands in the frame loop, on the recorded anchors", () => {
  // place() records each standing tag's anchor…
  assert.ok(
    renderer.includes("sprite.userData.armillaryTagAnchor = {"),
    "the sync records each tag's anchor"
  );
  // …the pass exists and runs on those anchors…
  assert.ok(renderer.includes("function _keepArmillaryNameTagsWhole()"), "the pass exists");
  const pass = extractFunction(renderer, "_keepArmillaryNameTagsWhole");
  assert.ok(pass.includes("armillaryTagAnchor"), "the pass reads the recorded anchors");
  assert.ok(pass.includes("_armillaryTagClampCentre"), "the pass uses the pinned clamp");
  assert.ok(pass.includes("projected.z > 1 || projected.z < -1"), "the pass leaves off-frame depths alone");
  // …and it runs in the frame loop after the Moon labels, before the render.
  const callAt = renderer.indexOf("_keepArmillaryNameTagsWhole();");
  const labelsAt = renderer.indexOf("_updateMoonLabels(_viewMode, nowMs);");
  const renderAt = renderer.indexOf("_renderer.render(_scene, _camera);");
  assert.ok(callAt > labelsAt && callAt < renderAt, "the pass runs between the labels and the render");
  // The sync PR #265/#267 established still stands, texts and all.
  for (const pin of [
    "function _armillaryNameTag(",
    "function _syncArmillaryNameTags()",
    "YEAR GATE", "MARCH EQUINOX", "EQUINOX PASSAGE",
    "JUNE SOLSTICE", "SEPTEMBER EQUINOX", "DECEMBER SOLSTICE",
    "_objects.yearGate?.position",
    "armillaryNameTagGroup.visible = !!_visibleLayers?.pattern"
  ]) {
    assert.ok(renderer.includes(pin), `the armillary tag sync keeps: ${pin}`);
  }
});

// ── Fix 2: the hub plate's third line ───────────────────────────

function calendarSandbox() {
  const sandbox = {};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const file of ["pattern-calendar-version.js", "pattern-calendar-data.js", "pattern-calendar-format.js", "pattern-calendar-boundary.js", "pattern-calendar.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, "docs/assets/js/calendar", file), "utf8"), sandbox, { filename: file });
  }
  return sandbox;
}

test("details 2: the hub plate's third line is the day's own archetype text — all 364 days", () => {
  const sandbox = calendarSandbox();
  vm.runInContext(
    `${extractFunction(renderer, "_armillaryHubThirdLine")}; globalThis.__line = _armillaryHubThirdLine;`,
    sandbox
  );
  const line = sandbox.__line;
  const data = sandbox.PatternCalendarData;
  assert.ok(data?.dayArchetypes?.length === 28, "the calendar carries 28 archetypes");
  for (let moon = 1; moon <= 13; moon += 1) {
    for (let day = 1; day <= 28; day += 1) {
      const third = line(day);
      assert.equal(third, data.dayArchetypes[day - 1][1], `Moon ${moon} Day ${day}`);
      assert.ok(third.length > 0, `Moon ${moon} Day ${day} has a third line`);
      // The bare archetype name never stands as the line — that was
      // the "Name" leak.
      assert.notEqual(third, data.dayArchetypes[day - 1][0], `Moon ${moon} Day ${day}`);
    }
  }
  // The day that named the fix:
  assert.equal(line(25), "Recover identity and purpose.");
});

test("details 2: the plate draws the line inside its counted branch; the outside days are untouched", () => {
  const draw = extractFunction(renderer, "_drawArmillaryHubPlate");
  // The counted branch calls the helper; the bare-name read is gone.
  const countedAt = draw.indexOf("if (moon >= 1 && day >= 1 && doy >= 1 && doy <= 364)");
  const callAt = draw.indexOf("_armillaryHubThirdLine(day)");
  const outsideAt = draw.indexOf("} else if (moon >= 1) {");
  assert.ok(countedAt >= 0 && callAt > countedAt && callAt < outsideAt, "the helper is called inside the counted branch");
  assert.ok(!/dayArchetypes[\s\S]{0,40}\[0\]/.test(draw), "the plate no longer reads the archetype's bare name");
  // The outside branch stands as it stood.
  assert.ok(draw.includes("outside the count"), "the outside branch keeps its own words");
  assert.ok(!draw.slice(outsideAt).includes("_armillaryHubThirdLine"), "the outside branch never calls the helper");

  // And the outside days can never reach the counted branch: the
  // canonical conversion gives them no moon, no day, no pattern
  // position. Found by scanning real dates through the real
  // calendar, not by trusting a remembered date.
  const sandbox = calendarSandbox();
  const calendar = sandbox.PatternCalendar;
  const found = { dot: null, deep: null };
  const dayMs = 24 * 60 * 60 * 1000;
  for (let t = Date.UTC(2026, 3, 1); t <= Date.UTC(2028, 5, 1) && !(found.dot && found.deep); t += dayMs) {
    // Date strings, not Date objects: the calendar's own coerceDate
    // reads them realm-safely.
    const conv = calendar.fromCivilDate({ date: new Date(t).toISOString().slice(0, 10) });
    if (conv.isDayOutOfTime && !found.dot) found.dot = conv;
    if (conv.isDeepTimeDay && !found.deep) found.deep = conv;
  }
  assert.ok(found.dot, "a Day Out of Time stands in the scanned span");
  assert.ok(found.deep, "a Deep Time Day stands in the scanned span");
  for (const conv of [found.dot, found.deep]) {
    assert.equal(conv.moon, null, "outside days carry no moon");
    assert.equal(conv.day, null, "outside days carry no day");
    assert.equal(conv.dayOfPatternYear, null, "outside days carry no pattern position");
  }
});

// ── Fix 3: the year chip in plain words ─────────────────────────

test("details 3: the year targets say the same day in that year — no jargon stands", () => {
  const strata = require(strataPath);
  const targets = strata.semanticTargets({
    selectedYear: 2026,
    model: { selectedPatternPosition: { dayOfPatternYear: 221 } }
  });
  assert.ok(Array.isArray(targets) && targets.length > 0, "the year targets stand");
  for (const target of targets) {
    const year = target.id.replace("strata-year-", "");
    assert.equal(target.detail, `Pattern day 221 · the same day in ${year}`, target.id);
    assert.ok(!/temporal membrane/i.test(target.detail), target.id);
  }
  const source = fs.readFileSync(strataPath, "utf8");
  assert.ok(!source.includes("temporal membrane"), "the strata source carries no 'temporal membrane'");
  // The module's own maths do not move with its words.
  assert.equal(strata.state.enabled, true, "the strata layer still stands by default");
});

// ── What must not move: PR #267's landed behaviour ──────────────

test("details: PR #267's spread, swell, and cadence stand exactly as landed", () => {
  // The label cadence (renderer, as landed): the labels re-place at
  // the pace the camera moves — 96 ms in the interaction's lite
  // form, 500 ms at rest.
  assert.ok(renderer.includes("interactionLite ? 96 : 500"), "the label cadence stands");
  // The day spread, read the way PR #267's own signature reads it:
  // canonical lanes underneath, widened presentation lanes on top.
  const sandbox = {};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(geometryPath, "utf8"), sandbox, { filename: geometryPath });
  const geometry = sandbox.LivingTimeSphereCalendarGeometry;
  const canonical = [1.298, 1.328, 1.358, 1.388];
  const visual = [1.380, 1.530, 1.680, 1.830];
  for (let week = 1; week <= 4; week += 1) {
    const day = 1 + (week - 1) * 7;
    assert.ok(Math.abs(geometry.calendarCell(day).radialFactor - canonical[week - 1]) < 1e-9, `canonical lane, week ${week}`);
    assert.ok(Math.abs(geometry.calendarDisplayCell(day).dayNumberRadialFactor - visual[week - 1]) < 1e-9, `presentation lane, week ${week}`);
  }
  assert.match(renderer, /dayNumberPresentationWeek1: 1\.380/);
  assert.match(renderer, /dayNumberPresentationWeekStep: 0\.150/);
  // The swell ramp still stands in the label manager.
  const labels = fs.readFileSync(labelsPath, "utf8");
  assert.match(labels, /function swellForDistance\(distance\)/, "the swell ramp stands");
});
