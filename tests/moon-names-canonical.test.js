/*
 * One set of moon names: PatternCalendarData governs.
 *
 * Aaron's ruling (Nov 23, 2026): the names the site and the app
 * already agree on — the PatternCalendarData set (Moon 8 = Deep
 * Mirror, Moon 9 = Return Path, …) — are the single canonical set.
 * The Moons page data (docs/assets/data/moons.json) long carried a
 * second family (Magnetic … Cosmic) for the same thirteen moons.
 * This test pins moons.json to the canonical names for all 13 moons,
 * so the two sets can never drift apart again.
 *
 * moons.json keeps everything else it carries — essence, affirmation,
 * psalm, links, practices, and its slugs (which are page addresses,
 * not names). The share style "Moon of the ___" is a spoken style of
 * these same names, not a separate set, and is not pinned here.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

require(path.join(root, "docs/assets/js/calendar/pattern-calendar-data.js"));
const canonical = globalThis.PatternCalendarData;

const moonsJson = JSON.parse(
  fs.readFileSync(path.join(root, "docs/assets/data/moons.json"), "utf8")
);

test("PatternCalendarData carries exactly 13 moons", () => {
  assert.equal(canonical.moons.length, 13);
  assert.equal(canonical.moonNames.length, 13);
});

test("moons.json names equal PatternCalendarData names for all 13 moons", () => {
  assert.equal(moonsJson.length, 13);
  const byIdx = new Map(moonsJson.map((m) => [m.idx, m.name]));
  for (const moon of canonical.moons) {
    assert.equal(
      byIdx.get(moon.idx),
      moon.name,
      `Moon ${moon.idx}: moons.json says ${byIdx.get(moon.idx)}, PatternCalendarData says ${moon.name}`
    );
  }
  assert.deepEqual(
    [...byIdx.keys()].sort((a, b) => a - b),
    canonical.moons.map((m) => m.idx)
  );
});
