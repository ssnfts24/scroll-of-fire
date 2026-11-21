"use strict";

/**
 * The Pattern Garden's teaching layer (Aaron, Nov 20, 2026: "if
 * the garden's advantage is to teach people how and what to plant
 * then it needs a ton more information").
 *
 * Covers: every crop the farm record can plant — the thirty-six
 * in farm-western-wa.json and the six cover crops in
 * farm-homestead-western-wa.json — carries a full growing guide
 * in farm-garden-teaching.json; every field of every guide carries
 * sources that resolve in the file's own registry (the dataset's
 * provenance discipline: a guide ships with its sources or not at
 * all); the guide's dates are derived from the county record by
 * the garden module itself, so Lewis, Lincoln, and Jefferson
 * Counties — the state's long, shortest, and longest seasons —
 * give one crop three different "when"s; and the fence: no guide
 * text anywhere speaks a Moon line, because the calendar keys
 * when a bed is open and the farm record keys the planting.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const DOCS = path.resolve(__dirname, "../docs");
const JS = path.join(DOCS, "assets/js");

const Garden = require(path.join(JS, "pattern-garden.js"));

const read = rel => fs.readFileSync(path.join(DOCS, rel), "utf8");
const farmWest = JSON.parse(read("assets/data/farm-western-wa.json"));
const farmHome = JSON.parse(read("assets/data/farm-homestead-western-wa.json"));
const guideFile = JSON.parse(read("assets/data/farm-garden-teaching.json"));

const ALL_CROP_IDS = [
  ...farmWest.crops.map(c => c.id),
  ...farmHome.coverCrops.map(c => c.id)
];
const COVER_IDS = new Set(farmHome.coverCrops.map(c => c.id));
const registry = new Map((guideFile.sources || []).map(s => [s.id, s]));

/* ----------------------- completeness ------------------------- */

test("every plantable crop carries a guide — 36 vegetables and 6 cover crops", () => {
  assert.equal(ALL_CROP_IDS.length, 42, "the farm record plants 42 crops");
  for (const id of ALL_CROP_IDS) {
    assert.ok(guideFile.guides[id], `guide missing for ${id}`);
  }
  assert.equal(Object.keys(guideFile.guides).length, 42, "no orphan guides");
});

test("every guide carries its core teaching fields", () => {
  for (const id of ALL_CROP_IDS) {
    const g = guideFile.guides[id];
    const core = COVER_IDS.has(id)
      ? ["depth", "spacing", "sowHow", "termination"]
      : ["depth", "spacing", "sowHow"];
    for (const field of core) {
      assert.ok(g[field] && typeof g[field].text === "string" && g[field].text.length > 0,
        `${id} is missing its ${field}`);
    }
    if (Array.isArray(g.troubles)) {
      for (const t of g.troubles) {
        assert.ok(t.name && t.text, `${id} has a trouble with no name or no remedy`);
      }
    }
  }
});

test("a field left out for lack of a source is confessed in the crop's notes", () => {
  /* The dataset's rule is "real or absent" — and an absence the
   * research could not fill is written on the guide's face, in
   * its notes, never silently smoothed over. */
  /* Succession and companions are bonus teaching — present and
   * sourced where a source teaches them, absent without ceremony
   * where none does. The substantive fields below are the ones a
   * gardener would come looking for; those absences are confessed. */
  const expected = ["germination", "sun", "soil", "water", "storage", "harvest", "troubles"];
  for (const id of ALL_CROP_IDS) {
    if (COVER_IDS.has(id)) continue;
    const g = guideFile.guides[id];
    const notes = (g.notes || []).join(" ").toLowerCase();
    for (const field of expected) {
      const present = field === "troubles"
        ? Array.isArray(g.troubles) && g.troubles.length >= 1
        : Boolean(g[field]);
      if (!present) {
        assert.ok(notes.includes(field) || notes.includes("omitted"),
          `${id} omits ${field} without a note confessing the omission`);
      }
    }
  }
});

/* ----------------------- provenance --------------------------- */

test("every field of every guide carries sources that resolve in the registry", () => {
  const checkField = (cropId, fieldName, field) => {
    if (field == null) return;
    assert.ok(Array.isArray(field.sources) && field.sources.length >= 1,
      `${cropId}.${fieldName} carries no sources`);
    for (const id of field.sources) {
      assert.ok(registry.has(id), `${cropId}.${fieldName} cites unknown source ${id}`);
    }
  };
  for (const [cropId, g] of Object.entries(guideFile.guides)) {
    for (const [fieldName, field] of Object.entries(g)) {
      if (fieldName === "notes") {
        assert.ok(Array.isArray(field), `${cropId}.notes is a list`);
        continue;
      }
      if (fieldName === "troubles") {
        for (const t of field) checkField(cropId, "troubles", t);
        continue;
      }
      checkField(cropId, fieldName, field);
    }
  }
});

test("the registry itself is complete: every source names its publisher and page", () => {
  assert.ok(registry.size >= 15, `expected a real source base, got ${registry.size}`);
  for (const [id, s] of registry) {
    assert.ok(s.name && s.publisher && s.url, `source ${id} is incompletely named`);
    assert.match(s.url, /^https?:\/\//, `source ${id} url is a real page`);
  }
});

/* --------------------- county derivation ---------------------- */

const lewis = farmWest.locations.find(l => l.id === "lewis");
const lincoln = farmWest.locations.find(l => l.id === "lincoln");
const jefferson = farmWest.locations.find(l => l.id === "jefferson");
const crop = id => farmWest.crops.find(c => c.id === id);

test("one crop, three counties, three different 'when's — peppers", () => {
  const lines = loc => Garden.guideWhenLines(crop("peppers"), loc, 2026);
  const lew = lines(lewis), lin = lines(lincoln), jef = lines(jefferson);
  const indoor = w => w.lines.find(l => l.method === "indoor");
  const transplant = w => w.lines.find(l => l.method === "transplant");
  /* Indoor starts count back from each county's own last frost:
   * Lewis Apr 22, Lincoln Jun 6, Jefferson Mar 1 (NOAA normals). */
  assert.equal(indoor(lew).start, "2026-02-11");
  assert.equal(indoor(lin).start, "2026-03-28");
  assert.equal(indoor(jef).start, "2025-12-21");
  assert.equal(transplant(lew).start, "2026-05-06");
  assert.equal(transplant(lin).start, "2026-06-20");
  assert.equal(transplant(jef).start, "2026-03-15");
  /* And the guide names the ground it counted from. */
  for (const [w, loc] of [[lew, lewis], [lin, lincoln], [jef, jefferson]]) {
    assert.equal(w.county, loc.county);
    assert.equal(w.station, loc.station);
    assert.equal(w.lastSpringFrost, `2026-${loc.lastSpringFrost}`);
    assert.equal(w.safeLastSpringFrost, `2026-${loc.safeLastSpringFrost}`);
  }
});

test("the guide's windows are the offer's windows — they can never disagree", () => {
  for (const loc of [lewis, lincoln, jefferson]) {
    for (const id of ["tomatoes", "peas", "broccoli", "garlic"]) {
      const fromGuide = Garden.guideWhenLines(crop(id), loc, 2026).lines
        .map(l => `${l.method}:${l.start}→${l.end}`);
      const fromWindows = Garden.cropWindows(crop(id), loc, 2026)
        .map(w => `${w.kind}:${w.start}→${w.end}`);
      assert.deepEqual(fromGuide, fromWindows, `${id} in ${loc.id}`);
    }
  }
});

test("a guide read after the season turns speaks in the coming year, and says so", () => {
  assert.equal(Garden.guideYearFor(crop("garlic"), lewis, "2026-12-15"), 2027);
  assert.equal(Garden.guideYearFor(crop("tomatoes"), lewis, "2026-11-20"), 2027);
  assert.equal(Garden.guideYearFor(crop("tomatoes"), lewis, "2026-02-01"), 2026);
  const when = Garden.guideWhenLines(crop("garlic"), lewis, 2027);
  assert.equal(when.year, 2027);
  assert.ok(when.lines.some(l => l.method === "fall" && l.start === "2027-10-01"));
});

/* --------------------------- the fence ------------------------ */

test("no guide text speaks a Moon line — the calendar keys beds, not plantings", () => {
  const texts = [];
  const walk = v => {
    if (typeof v === "string") texts.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(guideFile.guides);
  for (const t of texts) {
    assert.ok(!/\bmoons?\b/i.test(t), `guide text speaks of Moons: ${t.slice(0, 80)}`);
  }
});

test("the garden page carries the guide surface and the module loads the guides file", () => {
  const html = read("garden.html");
  assert.match(html, /id="garden-guide"/);
  assert.match(html, /id="garden-guide-crop"/);
  const moduleSource = read("assets/js/pattern-garden.js");
  assert.match(moduleSource, /farm-garden-teaching\.json/);
  assert.match(moduleSource, /guideWhenLines/);
});
