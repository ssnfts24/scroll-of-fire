"use strict";

/* Living Sphere Phase 3 (approved Sphere design): the Farm
 * Ring whole, the Story Ring, and the packed readout.
 *
 * What this file pins:
 *   1. The farm day-events engine reads the sourced dataset
 *      exactly — windows open and close on the days the
 *      dataset's own rules name, per county, and two counties
 *      give different days where their frost dates differ.
 *   2. The farm line speaks farm facts in farm words only —
 *      county and crops, never Moon language.
 *   3. The Story Ring places only the dates the story itself
 *      names, each carrying its basis; the spine assigns no
 *      dates today, the reader proves it, and a spine that
 *      ever assigns dates is read in unchanged.
 *   4. The label law extends: Farm is Measured in its own
 *      grammar, Story is Story in its own grammar, and no
 *      grammar or label leaks across rings.
 *   5. The readout's depth lives in words and in the readout
 *      card's own year wheel — the protected renderer is
 *      never given a span or arc API call.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const handoff = read("docs/assets/js/sphere-armillary.js");
const Panel = require(path.join(ROOT, "docs/assets/js/sphere-farm-panel.js"));
const farmData = JSON.parse(read("docs/assets/data/farm-western-wa.json"));
const spine = JSON.parse(read("docs/assets/data/codex-story.json"));

function loadCore(beginMarker, endMarker, name) {
  const start = handoff.indexOf(beginMarker);
  const end = handoff.indexOf(endMarker);
  assert.ok(start !== -1 && end !== -1 && end > start, `${name} testable core is present`);
  return new Function(`${handoff.slice(start, end)}; return ${name};`)();
}

const Rings = loadCore("var SphereRingArchitecture", "/* Sphere rings architecture — END TESTABLE CORE */", "SphereRingArchitecture");
const Readout = loadCore("var SphereReadoutCore", "/* Sphere readout — END TESTABLE CORE */", "SphereReadoutCore");

/* ── 1. The farm events engine, against the dataset ──────── */

test("farm events: garlic's fall window opens and closes on the dataset's own days", () => {
  const open = Panel.windowEventsForDate(farmData, "lewis", "2026-10-01");
  assert.equal(open.ok, true);
  assert.ok(open.opening.some((e) => e.crop === "Garlic" && e.kind === "fall"), "garlic fall sowing opens Oct 1 in Lewis");
  const close = Panel.windowEventsForDate(farmData, "lewis", "2026-11-30");
  assert.ok(close.closing.some((e) => e.crop === "Garlic" && e.kind === "fall"), "garlic fall sowing closes Nov 30 in Lewis");
  const mid = Panel.windowEventsForDate(farmData, "lewis", "2026-10-15");
  assert.ok(mid.openNow.some((e) => e.crop === "Garlic" && e.kind === "fall"), "garlic stands open mid-window");
  assert.equal(mid.opening.length + mid.closing.length, 0, "a mid-window day has no edge events");
});

test("farm events: the same crop opens on different days in different counties", () => {
  // Peas sow relative to last spring frost: Lewis Apr 22,
  // Snohomish Mar 24 — the dataset's own frost lines.
  const lewis = Panel.windowEventsForDate(farmData, "lewis", "2026-03-11");
  assert.ok(lewis.opening.some((e) => e.crop === "Peas" && e.kind === "sow"), "peas open Mar 11 in Lewis");
  const snohomishEarly = Panel.windowEventsForDate(farmData, "snohomish", "2026-03-11");
  assert.ok(!snohomishEarly.opening.some((e) => e.crop === "Peas" && e.kind === "sow"), "peas do not open Mar 11 in Snohomish");
  const snohomish = Panel.windowEventsForDate(farmData, "snohomish", "2026-02-10");
  assert.ok(snohomish.opening.some((e) => e.crop === "Peas" && e.kind === "sow"), "peas open Feb 10 in Snohomish");
  // A fixed window is a fixed window in every county.
  for (const county of ["lewis", "snohomish"]) {
    const t = Panel.windowEventsForDate(farmData, county, "2026-05-10");
    assert.ok(t.opening.some((e) => e.crop === "Tomatoes" && e.kind === "transplant"), `tomatoes go out May 10 in ${county}`);
  }
});

test("farm events: unknown county and unreadable date fail honestly, never inventively", () => {
  assert.equal(Panel.windowEventsForDate(farmData, "king", "2026-10-01").ok, false);
  assert.equal(Panel.windowEventsForDate(farmData, "lewis", "not-a-date").ok, false);
});

/* ── 2. The farm line's words ─────────────────────────────── */

test("farm line: names the county and the crops, and never speaks Moon language", () => {
  const loc = Panel.locationFor(farmData, "lewis");
  const line = Readout.farmLineText(Panel.windowEventsForDate(farmData, "lewis", "2026-10-01"), loc.county);
  assert.ok(line.startsWith("Farm · Lewis County:"), "the line is labelled by its ring and county");
  assert.ok(line.includes("Garlic"), "the line names the crop");
  assert.ok(!/Moon|Pattern Day/.test(line), "farm facts are never spoken in the count's words");
  const quiet = Readout.farmLineText(Panel.windowEventsForDate(farmData, "lewis", "2026-01-05"), loc.county);
  assert.ok(quiet === null || !/Moon/.test(quiet), "even a quiet day's line keeps the fence");
  assert.equal(Readout.farmLineText({ ok: false, opening: [], closing: [], openNow: [] }, "Lewis County"), null, "a failed read composes no line");
});

/* ── 3. The Story Ring's marks ────────────────────────────── */

test("story ring: only the dates the story itself names, each with its basis", () => {
  assert.equal(Readout.storyMarks.length, 2, "two cited marks ride today — no more were found in the record");
  for (const mark of Readout.storyMarks) {
    assert.ok(mark.basis && mark.basis.length > 10, `${mark.id} carries its basis`);
    assert.ok(mark.title, `${mark.id} is titled`);
  }
  const gate = Readout.storyMarks.find((m) => m.id === "the-gate-at-first-light");
  assert.equal(gate.patternDay, 1, "chapter 1 stands at Pattern Day 1 — the year's first morning, by its own opening");
  const seed = Readout.storyMarks.find((m) => m.id === "the-garden-of-thirteen-beds");
  assert.equal(seed.moon, 4, "the seed is found in Moon 4 — the storyline's own count");
});

test("story ring: the spine assigns no dates today — and a dated spine would be read in", () => {
  assert.deepEqual(Readout.storyMarksFromSpine(spine), [], "the shipped spine carries no chapter dates; the ring invents none");
  const dated = Readout.storyMarksFromSpine({ chapters: [{ n: 9, id: "x", title: "Dated One", patternDay: 100 }] });
  assert.equal(dated.length, 1);
  assert.equal(dated[0].patternDay, 100);
  assert.ok(dated[0].basis.includes("codex-story.json"), "a spine-given date names the spine as its basis");
});

test("story line: fires at its dates and is honestly absent everywhere else", () => {
  const atGate = Readout.storyLineFor(Readout.storyMarks, { moon: 1, dayOfPatternYear: 1 });
  assert.ok(atGate.startsWith("Story · "), "the story line is labelled as story");
  assert.ok(atGate.includes("The Gate at First Light"));
  const inMoon4 = Readout.storyLineFor(Readout.storyMarks, { moon: 4, dayOfPatternYear: 92 });
  assert.ok(inMoon4 && inMoon4.includes("Garden of Thirteen Beds"), "the Moon 4 span carries the seed's finding");
  assert.equal(Readout.storyLineFor(Readout.storyMarks, { moon: 8, dayOfPatternYear: 218 }), null, "an undated day gets no story line");
  assert.equal(Readout.storyLineFor(Readout.storyMarks, { moon: 2, dayOfPatternYear: 40 }), null);
});

/* ── 4. The label law, extended ───────────────────────────── */

test("label law extended: Farm and Story ride in their own grammars and labels", () => {
  assert.deepEqual([...Rings.phaseThreeRingIds], ["farm", "story"]);
  const farm = Rings.charterFor("farm");
  assert.equal(farm.label, "Measured", "farm facts are measured facts");
  assert.equal(farm.grammar, "farm-measured");
  assert.ok(farm.source.includes("farm-western-wa.json"), "the farm charter names the dataset");
  assert.ok(!/Moon/.test(farm.source), "the farm charter's source is not spoken in Moon language");
  const story = Rings.charterFor("story");
  assert.equal(story.label, "Story", "the story ring's label is Story — fiction, unmistakably");
  assert.equal(story.grammar, "story-tale");
  assert.ok(story.source.includes("codex-story.json"), "the story charter names the spine");
  const grammars = Rings.charters.map((c) => c.grammar);
  assert.equal(new Set(grammars).size, grammars.length, "no two rings share a grammar");
  for (const charter of Rings.charters) {
    assert.ok(!charter.layers.includes("record-day"), `${charter.id} never draws in the record's grammar`);
    assert.ok(!charter.layers.includes("record-trail"), `${charter.id} never draws in the trail's grammar`);
  }
  // Seating: the fixed order of the design holds with the
  // new rings seated — Pattern, Sky, Farm, Kept Days, Story.
  const seats = Rings.charters.map((c) => c.seat);
  assert.deepEqual(seats, [...seats].sort((a, b) => a - b), "charters stand in seating order");
  assert.equal(Rings.charterFor("farm").seat, 2);
  assert.equal(Rings.charterFor("story").seat, 5);
  // The clutter law still binds: Pattern + at most four.
  assert.equal(Rings.canEnable(["sky", "farm", "kept-days", "story"], "field-x"), false, "a fifth optional ring cannot ride");
  assert.equal(Rings.canEnable(["sky", "farm"], "story"), true);
});

/* ── 5. The readout and the wheel ─────────────────────────── */

test("readout: the packed telling is built — one labelled line per ring, the year in the where line", () => {
  for (const cls of ["sphere-day-readout-sky", "sphere-day-readout-farm", "sphere-day-readout-story", "sphere-day-readout-wheel"]) {
    assert.ok(handoff.includes(cls), `the readout builds ${cls}`);
  }
  assert.ok(handoff.includes('" · Pattern Year " + conv.patternYear'), "the where line carries the year position when the conversion is the canonical line's own");
  assert.ok(handoff.includes('"Kept Days · " + bits.join'), "the kept line names its ring like the others");
  assert.ok(handoff.includes("buildSkyText(new Date(selectedCivilISO"), "the readout's Sky line is the selected day's, from the one sky builder");
  assert.ok(handoff.includes('"sof.pattern-garden.county.v1"') || handoff.includes("sof.pattern-garden.county.v1"), "the garden's remembered county is honoured");
  assert.ok(handoff.includes("sof.sphere.farm.county.v1"), "the Sphere farm room's remembered county is honoured");
  assert.ok(handoff.includes("conversionForSelection"), "the readout converts only through the canonical line");
});

test("wheel geometry: arcs are true sectors of the 364-day year", () => {
  const partial = Readout.arcPathD(116, 116, 108, 85, 112);
  assert.ok(partial.startsWith("M ") && partial.includes(" A "), "a span draws as an arc");
  const full = Readout.arcPathD(116, 116, 100, 1, 364);
  assert.equal((full.match(/ A /g) || []).length, 2, "a full-year span closes as two arcs");
  assert.deepEqual(Readout.moonSpanDays(4), [85, 112], "Moon 4 spans Pattern Days 85–112");
  assert.deepEqual(Readout.moonSpanDays(13), [337, 364], "Moon 13 closes the counted year");
  const top = Readout.polarPoint(116, 116, 100, 1);
  assert.ok(Math.abs(top[0] - 116) < 0.01 && Math.abs(top[1] - 16) < 0.01, "Pattern Day 1 stands at the top");
});

test("fences: the wheel is the readout's own drawing — the protected renderer gains no span API", () => {
  assert.ok(!handoff.includes("setSpanMarkers"), "no span API is invented on the renderer");
  assert.ok(!handoff.includes("setArcMarkers"), "no arc API is invented on the renderer");
  assert.ok(handoff.includes("sphere-day-wheel-host"), "the wheel is hosted by the readout card");
  assert.ok(!/docs\/assets\/js\/sphere\//.test(""), "sanity");
});
