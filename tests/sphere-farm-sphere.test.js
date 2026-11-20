"use strict";

/**
 * The Farm on the Sphere: wiring the PR #186 farm layer into the
 * Sphere page's Selected day panel. Guards: (a) the season is named
 * plainly and correctly for a civil date; (b) the civil date and the
 * coordinate are read from the canonical cursor's own published
 * detail — never derived by a second clock; (c) a selected day
 * carried end to end (cursor detail → civil date → panel advice)
 * answers for THAT day, including at a frost edge; (d) the page
 * wiring stays an overlay — the companion layer only loads the farm
 * module, and no moon lines are ever passed to the panel, so no
 * Codex layer can appear blended with the facts.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const data = JSON.parse(
  fs.readFileSync(path.join(root, "docs/assets/data/farm-western-wa.json"), "utf8")
);
const panel = require(path.join(root, "docs/assets/js/sphere-farm-panel.js"));
const wiring = require(path.join(root, "docs/assets/js/sphere-farm-sphere.js"));

test("season: named plainly for the date, northern hemisphere", () => {
  assert.equal(wiring.seasonForCivilDate("2026-11-19").name, "Autumn");
  assert.equal(wiring.seasonForCivilDate("2026-04-22").name, "Spring");
  assert.equal(wiring.seasonForCivilDate("2026-07-04").name, "Summer");
  assert.equal(wiring.seasonForCivilDate("2027-01-15").name, "Winter");
  assert.equal(wiring.seasonForCivilDate("2026-03-19").name, "Winter");
  assert.equal(wiring.seasonForCivilDate("2026-03-20").name, "Spring");
  assert.equal(wiring.seasonForCivilDate("2026-12-21").name, "Winter");
  assert.equal(wiring.seasonForCivilDate("not-a-date"), null);
  assert.match(wiring.seasonForCivilDate("2026-11-19").line, /Season: Autumn in western Washington\./);
});

test("cursor detail: the civil date is read from the canonical coordinate", () => {
  // The shape the temporal coordinate engine publishes.
  const engineDetail = {
    coordinate: {
      gregorian: { isoDate: "2026-11-19" },
      remnant13Moons: { moon: 8, moonDay: 21, patternDay: 217, patternYear: 2026, moonName: "Deep Mirror" }
    }
  };
  assert.equal(wiring.civilISOFromCursorDetail(engineDetail), "2026-11-19");
  const coord = wiring.coordinateFromCursorDetail(engineDetail);
  assert.deepEqual(coord, { moon: 8, day: 21, patternDay: 217, moonName: "Deep Mirror" });
  assert.equal(wiring.coordinateLine(coord), "Moon 8 · Day 21 · Pattern Day 217");

  // The PatternCalendar summary shape rides the same readers.
  const summaryDetail = { coordinate: { civilDate: "2026-09-15", moon: 6, day: 12, dayOfPatternYear: 152 } };
  assert.equal(wiring.civilISOFromCursorDetail(summaryDetail), "2026-09-15");
  assert.equal(wiring.coordinateLine(wiring.coordinateFromCursorDetail(summaryDetail)), "Moon 6 · Day 12 · Pattern Day 152");

  assert.equal(wiring.civilISOFromCursorDetail(null), null);
  assert.equal(wiring.civilISOFromCursorDetail({ coordinate: { gregorian: { isoDate: "junk" } } }), null);
  assert.equal(wiring.coordinateFromCursorDetail({}), null);
});

test("selected day end to end: Moon 8 Day 21 answers for Nov 19, Lewis County", () => {
  const detail = {
    coordinate: {
      gregorian: { isoDate: "2026-11-19" },
      remnant13Moons: { moon: 8, moonDay: 21, patternDay: 217 }
    }
  };
  const iso = wiring.civilISOFromCursorDetail(detail);
  assert.equal(wiring.seasonForCivilDate(iso).name, "Autumn");
  const advice = panel.adviceForDate(data, wiring.DEFAULT_COUNTY, iso);
  assert.equal(advice.ok, true);
  assert.equal(advice.county, "Lewis County");
  assert.match(advice.seasonLine, /Lewis County/);
  // Nov 19 sits past the safe first fall frost (Oct 19): the fall
  // frost watch must be speaking for this selected day.
  assert.ok(advice.frostLines.length >= 1, "fall frost watch should speak on Nov 19");
  assert.match(advice.frostLines.join(" "), /fall edge is near/);
  assert.equal(advice.moonLayer, null);
});

test("selected day end to end: a spring frost-edge date in Lewis County", () => {
  // Apr 15, 2026 is inside the spring frost watch (from three weeks
  // before the Apr 22 median last frost through the Apr 30 safe line).
  const iso = "2026-04-15";
  assert.equal(wiring.seasonForCivilDate(iso).name, "Spring");
  const advice = panel.adviceForDate(data, "lewis", iso);
  assert.equal(advice.ok, true);
  assert.ok(advice.frostLines.length >= 1, "spring frost watch should speak on Apr 15");
  assert.match(advice.frostLines.join(" "), /Frost is still in play/);
  assert.match(advice.frostLines.join(" "), /cover tender plants tonight/);
});

test("county default is Lewis and the storage key is the farm's own", () => {
  assert.equal(wiring.DEFAULT_COUNTY, "lewis");
  assert.equal(wiring.COUNTY_STORAGE_KEY, "sof.sphere.farm.county.v1");
  const ids = data.locations.map((l) => l.id);
  assert.ok(ids.includes(wiring.DEFAULT_COUNTY));
});

test("wiring stays an overlay: loader only in the companion layer, no moon lines passed", () => {
  const layer = fs.readFileSync(path.join(root, "docs/assets/js/sphere-companion-layer.js"), "utf8");
  assert.match(layer, /sphere-farm-sphere\.js/);
  assert.match(layer, /sphere-farm-panel\.js/);
  assert.match(layer, /sphere-farm-sphere\.css/);

  const wiringSrc = fs.readFileSync(path.join(root, "docs/assets/js/sphere-farm-sphere.js"), "utf8");
  assert.ok(!/moonLines/.test(wiringSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")),
    "the wiring must never pass moon lines to the panel — the Codex layer is not generated here");
  assert.match(wiringSrc, /sof:selected-date-change/);
  assert.match(wiringSrc, /PatternCalendar/);
  assert.match(wiringSrc, /Selected day/);
});
