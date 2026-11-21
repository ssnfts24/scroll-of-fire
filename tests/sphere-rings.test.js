"use strict";

/* Living Sphere design, Phase 1 — the ring architecture
 * (Aaron approved the full Sphere design Nov 20, 2026).
 *
 * These tests pin the Phase 1 contract:
 *  - every ring carries a charter (source, label, owner, span)
 *    and reads dates only through the canonical line;
 *  - the label law: house rings carry Counted / Measured /
 *    Story only, each in its own grammar — the blending test:
 *    no two rings share a grammar, and a field ring may never
 *    borrow a house label;
 *  - the clutter law: fixed seating, Pattern always on, at
 *    most four optional rings ride with the core;
 *  - off means absent: Sky off drives every mapped granular
 *    layer off through its own change event and hides the Sky
 *    readout; Kept Days off clears the record data the page
 *    layer feeds the face (markers, trail, hub count);
 *  - Kept Days privacy: its sources are the on-device planner,
 *    the local companion record, and the Living Trail — the
 *    refresh path makes no network call of any kind;
 *  - field rings: the admittance rule is in code (a charter
 *    naming a checkable source, an owner, and a span), and no
 *    field ring rides in this phase.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const handoff = read("docs/assets/js/sphere-armillary.js");
const shellCss = read("docs/assets/css/sphere-armillary.css");

function architectureCore() {
  const begin = handoff.indexOf("var SphereRingArchitecture");
  const end = handoff.indexOf("/* Sphere rings architecture — END TESTABLE CORE");
  assert.ok(begin > -1 && end > begin, "the architecture core is locatable");
  return handoff.slice(begin, end);
}

function loadArchitecture() {
  const context = { window: {} };
  context.window = context;
  vm.runInNewContext(architectureCore(), context);
  return context.window.SphereRings;
}

const Rings = loadArchitecture();

test("architecture: the core loads and names the canonical line", () => {
  assert.ok(Rings, "SphereRings is exported");
  assert.equal(
    Rings.canonicalLine,
    "SOFTemporalCursor → PatternCalendar → Canonical Living State → LivingProjectionBus"
  );
  assert.deepEqual([...Rings.phaseOneRingIds], ["pattern", "sky", "kept-days"]);
});

test("charters: every house ring declares source, label, owner, and span", () => {
  // Phase 1 shipped three charters; Phase 3 (Sphere design)
  // seats Farm and Story beside them — five house rings.
  assert.equal(Rings.charters.length, 5);
  for (const charter of Rings.charters) {
    assert.ok(charter.source && charter.source.length > 10, `${charter.id} names its source`);
    assert.ok(Rings.houseLabels.includes(charter.label), `${charter.id} carries a house label`);
    assert.ok(charter.owner, `${charter.id} names its owner`);
    assert.ok(charter.span, `${charter.id} declares its span`);
    assert.ok(charter.grammar, `${charter.id} names its grammar`);
  }
  const pattern = Rings.charterFor("pattern");
  assert.equal(pattern.alwaysOn, true, "Pattern is always on");
  assert.equal(pattern.label, "Counted");
  assert.ok(pattern.source.includes("PatternCalendar"), "Pattern's source is the calendar itself");
  assert.ok(pattern.source.includes(Rings.canonicalLine), "Pattern reads through the canonical line only");
  const sky = Rings.charterFor("sky");
  assert.equal(sky.label, "Measured");
  assert.ok(sky.source.includes("Naval Observatory"), "Sky names its measured source");
  const kept = Rings.charterFor("kept-days");
  assert.equal(kept.label, "Counted");
  assert.equal(kept.owner, "The keeper");
  assert.ok(/on-device|this device/.test(kept.source + kept.span), "Kept Days is the keeper's on-device record");
});

test("seating: the fixed order is the design's, and Phase 1 rides a subsequence of it", () => {
  assert.deepEqual(
    [...Rings.seatingOrder],
    ["pattern", "sky", "farm", "kept-days", "family", "story", "field"]
  );
  const seats = Rings.charters.map((c) => Rings.seatingOrder.indexOf(c.id));
  assert.ok(seats.every((seat, i) => i === 0 || seat > seats[i - 1]), "charters are declared in seating order");
  for (const charter of Rings.charters) assert.equal(charter.seat, Rings.seatingOrder.indexOf(charter.id));
});

test("clutter law: Pattern + at most four optional rings", () => {
  assert.equal(Rings.maxOptionalRings, 4);
  assert.equal(Rings.canEnable([], "sky"), true);
  assert.equal(Rings.canEnable(["sky", "farm", "kept-days", "family"], "story"), false, "a fifth optional ring is refused");
  assert.equal(Rings.canEnable(["sky", "farm", "kept-days", "family"], "sky"), true, "an already-riding ring stays");
  assert.equal(Rings.canEnable(["sky", "farm", "kept-days", "family"], "pattern"), true, "the core is not counted");
  assert.equal(Rings.optionalActiveCount(["pattern", "sky", "sky", "farm"]), 2, "duplicates and the core do not inflate the count");
});

test("blending test: each ring's grammar is its own, and labels never leak across kinds", () => {
  const grammars = Rings.charters.map((c) => c.grammar);
  assert.equal(new Set(grammars).size, grammars.length, "no two rings share a grammar");
  // The mark alone must tell a stranger its kind: Pattern and
  // Kept Days are Counted but in different grammars (the count
  // itself vs the keeper's record); Sky is Measured and never
  // wears Pattern dress.
  const byId = Object.fromEntries(Rings.charters.map((c) => [c.id, c]));
  assert.notEqual(byId.pattern.grammar, byId["kept-days"].grammar);
  assert.equal(byId.sky.label, "Measured");
  assert.ok(!byId.sky.layers.includes("pattern"), "Sky never drives the Pattern layer");
  assert.ok(!byId.sky.layers.includes("personal") && !byId.sky.layers.includes("witness"), "Sky never drives a record layer");
  assert.equal(Rings.fieldRingPrototype.label, "Source-named", "a field ring carries its source's name, not a house label");
  assert.ok(!Rings.houseLabels.includes(Rings.fieldRingPrototype.label));
});

test("field rings: admittance requires a charter naming a checkable source — and nothing rides yet", () => {
  const noSource = Rings.admitFieldRing({ id: "x", name: "X", owner: "Me", span: "2026", label: "Mine" });
  assert.equal(noSource.admitted, false);
  assert.ok(noSource.reasons.some((r) => /source/.test(r)), "a missing source is named as the failure");

  const uncheckable = Rings.admitFieldRing({
    id: "x", name: "X", owner: "Me", span: "2026", label: "Mine",
    source: { name: "My notebook", checkable: false, reference: "drawer 3" },
  });
  assert.equal(uncheckable.admitted, false);
  assert.ok(uncheckable.reasons.some((r) => /checkable/.test(r)), "an uncheckable source is refused");

  const borrowedLabel = Rings.admitFieldRing({
    id: "x", name: "X", owner: "Me", span: "2026", label: "Measured",
    source: { name: "A dataset", checkable: true, reference: "dataset v1" },
  });
  assert.equal(borrowedLabel.admitted, false);
  assert.ok(borrowedLabel.reasons.some((r) => /borrow a house label/.test(r)), "house labels cannot be borrowed");

  const valid = Rings.admitFieldRing({
    id: "school", name: "School year", owner: "A teacher", span: "2026–2027 terms", label: "District calendar",
    source: { name: "District calendar", checkable: true, reference: "district-calendar-2026.pdf" },
  });
  assert.equal(valid.status, "specified-not-riding", "a valid charter is specified, not shipped");
  assert.equal(valid.rides, false, "no field ring rides in Phase 1");
  assert.ok(handoff.includes("none ride in this phase"), "the panel says so in words");
  assert.ok(!handoff.includes('id="sphere-ring-field"'), "no field-ring toggle exists");
});

test("sky ring: the readout is prefixed, and off drives the mapped layers off through their own events", () => {
  assert.ok(handoff.includes('"Sky: " + season'), "the season readout line begins with the Sky: prefix");
  assert.ok(handoff.includes('setAttribute("data-sky-readout", "")'), "the Sky readout is marked as such");
  assert.ok(handoff.includes("seasonLineRef.hidden = !skyRingSelected"), "Sky off hides the readout — absent, not dimmed");
  assert.ok(handoff.includes('cb.dispatchEvent(new Event("change", { bubbles: true }))'), "granular layers move through their own change events");
  for (const layer of ["lunar", "solar", "planets", "markers", "passage"]) {
    assert.ok(Rings.charterFor("sky").layers.includes(layer), `Sky maps the ${layer} layer`);
  }
  assert.ok(handoff.includes("ringInputId(charter.id)"), "the ring toggles are built from the one id rule");
  for (const id of ["sky", "kept-days", "farm", "story"]) {
    assert.ok(handoff.includes(`charter.id === "${id}"`), `the ${id} ring's toggle is wired`);
  }
  assert.ok(shellCss.includes(".sphere-ring-row"), "the ring panel is styled in the overlay's own sheet");
});

test("kept days: off clears the face's record data; the ring rides only when a record exists", () => {
  assert.ok(handoff.includes("renderer.setRecordMarkers([])"), "off clears the record gems");
  assert.ok(handoff.includes("renderer.setTrailMarkers([])"), "off clears the trail lights");
  assert.ok(handoff.includes('window.__sofHubPlans = { key: todayIso + ":0", count: 0 }'), "off clears the hub plate's plan count");
  assert.ok(handoff.includes("if (!keptDaysAvailable)"), "no record, no ring");
  assert.ok(handoff.includes("No kept days on this device yet"), "a first visitor is told plainly, not shown a hollow ring");
  assert.ok(handoff.includes("if (!keptDaysUserSet) keptDaysEnabled = true;"), "a keeper's ring rides by default once a record exists");
});

test("kept days privacy: the refresh path reads on-device sources and makes no network call", () => {
  const start = handoff.indexOf("async function refreshRecordMarkers()");
  const end = handoff.indexOf("function showSparkAlert", start);
  assert.ok(start > -1 && end > start, "the record refresh is locatable");
  const body = handoff.slice(start, end);
  assert.ok(body.includes("planner.plansForYear"), "the planner is a named source");
  assert.ok(body.includes("window.localStorage.getItem"), "the companion record is read locally");
  assert.ok(body.includes("window.LivingTrail"), "the Living Trail is read locally");
  for (const network of ["fetch(", "XMLHttpRequest", "sendBeacon", "WebSocket", "EventSource"]) {
    assert.ok(!body.includes(network), `the Kept Days refresh never calls ${network}`);
  }
});

test("defaults: a first visitor rides Pattern + Sky; the architecture core computes no dates of its own", () => {
  assert.ok(handoff.includes("var skyRingSelected = true;"), "Sky rides by default");
  assert.ok(handoff.includes("var keptDaysEnabled = false;"), "Kept Days waits for a record to exist");
  const core = architectureCore();
  assert.ok(!core.includes("PatternCalendar."), "the ring core never calls the calendar directly");
  assert.ok(!core.includes("new Date("), "the ring core never computes a date");
});
