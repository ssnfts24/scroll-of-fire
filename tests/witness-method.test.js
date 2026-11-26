"use strict";

/*
 * The Witness Method — a short lesson in checking a claim.
 *
 * The sourcing table. Every practice claim comes from the Old World /
 * Tartaria investigation (tartaria-oldworld-investigation-2026-11-18.md),
 * and the label expected below is the standing the investigation itself
 * gave that claim:
 *
 *  cia-document    §1 "Documented record — Observation": the document is
 *                  real and specific; hub entry GOV-CIA-TARTARIA-001 is
 *                  graded documented-event-with-cited-record.
 *                  → VERIFIED RECORD
 *  sf-magnitude    §3 fires table: "Magnitude 7.8 in the USGS publication
 *                  opened (GIP-31; other USGS publications give differing
 *                  magnitudes — keep the figure tied to its source)".
 *                  → VERIFIED RECORD
 *  ortelius-map    §2 maps: the LOC record of what the 1570 map shows —
 *                  presented by the investigation as Observation.
 *                  → FIRSTHAND OBSERVATION
 *  peshtigo-report §3: "NOAA/NWS says one building in Peshtigo survived;
 *                  the 1951 Wisconsin Historical Society marker says
 *                  every building was lost — both cannot be literally
 *                  true, and this dossier flags rather than smooths it."
 *                  → REPORTED STATEMENT
 *  fires-clearing  §3 "Hypothesis (labeled): that fires served as a
 *                  clearing mechanism… a coordinated programme was not
 *                  found in the sources opened." Hub checked pattern:
 *                  "Unproven — a documented alternative stands." A claim
 *                  of a deliberate act, unproven, is practised under the
 *                  five labels as an allegation; the investigation's own
 *                  words stand in the reasoning, unstrengthened.
 *                  → ALLEGATION
 *  star-fort       §4a: the anomaly reading "does not hold up" on current
 *                  sourced evidence. Hub checked pattern: "Checked — it
 *                  did not hold." A conclusion drawn past the record.
 *                  → INFERENCE
 *  tartary-erasure §2: "The disappearance is gradual across the
 *                  1700s–1800s, map by map, not a single removal event."
 *                  Hub checked pattern: "Checked — it did not hold."
 *                  → INFERENCE
 *  cia-proof       §1, Interpretation (labeled): "Reading this document
 *                  as proof of a global Tartarian empire goes beyond
 *                  anything in its text." Hub checked pattern: "Checked —
 *                  it did not hold."
 *                  → INFERENCE
 *
 * Where a claim could not be sourced from the investigation, it does
 * not appear on the page. There are no invented claims.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

function loadEngine() {
  const context = { Intl, Date };
  context.globalThis = context;
  vm.runInNewContext(read("docs/assets/js/witness-method.js"), context);
  return context.WitnessMethod;
}

const WM = loadEngine();
const hub = JSON.parse(read("docs/assets/data/documentation-hub.json"));

const EXPECTED_LABELS = {
  "cia-document": "verified-record",
  "sf-magnitude": "verified-record",
  "ortelius-map": "firsthand-observation",
  "peshtigo-report": "reported-statement",
  "fires-clearing": "allegation",
  "star-fort": "inference",
  "tartary-erasure": "inference",
  "cia-proof": "inference",
};

test("the engine loads without a page and exposes the lesson", () => {
  assert.ok(WM, "WitnessMethod is exposed");
  assert.equal(WM.STORAGE_KEY, "sof.witness-method.v1");
  assert.equal(typeof WM.loadRecord, "function");
  assert.equal(typeof WM.nextUnplaced, "function");
});

test("the five labels stand in order, each fully taught", () => {
  assert.deepEqual(
    [...WM.LABELS.map((l) => l.id)],
    ["verified-record", "firsthand-observation", "reported-statement", "allegation", "inference"]
  );
  for (const label of WM.LABELS) {
    assert.ok(label.name.length > 3, `${label.id}: a name`);
    assert.ok(label.plain.length > 30, `${label.id}: a plain-words meaning`);
    assert.ok(label.carries.length > 20, `${label.id}: what it can carry`);
    assert.ok(label.cannot.length > 20, `${label.id}: what it cannot carry`);
    assert.ok(label.example.length > 20, `${label.id}: a labelled example`);
  }
});

test("the ladder stands in order: Observation, Interpretation, Hypothesis, Declaration", () => {
  assert.deepEqual(
    [...WM.LADDER.map((r) => r.step)],
    ["Observation", "Interpretation", "Hypothesis", "Declaration"]
  );
});

test("eight practice claims, each carrying the investigation's own standing", () => {
  assert.equal(WM.CLAIMS.length, 8);
  const labelIds = new Set(WM.LABELS.map((l) => l.id));
  const covered = new Set();
  for (const claim of WM.CLAIMS) {
    assert.ok(labelIds.has(claim.label), `${claim.id}: label is one of the five`);
    assert.equal(claim.label, EXPECTED_LABELS[claim.id], `${claim.id}: the investigation's standing`);
    assert.ok(claim.claim.length > 30, `${claim.id}: the claim itself`);
    assert.ok(claim.reasoning.length > 80, `${claim.id}: the investigation's reasoning is shown`);
    assert.ok(claim.hint.length > 10, `${claim.id}: a hint for a wrong shelf`);
    assert.ok(/Investigation §/.test(claim.source), `${claim.id}: sourced to the investigation`);
    covered.add(claim.label);
  }
  assert.deepEqual(
    [...covered].sort(),
    [...labelIds].sort(),
    "the practice covers all five labels"
  );
});

test("the failed checks keep the investigation's own verdict words", () => {
  const byId = Object.fromEntries(WM.CLAIMS.map((c) => [c.id, c]));
  assert.match(byId["star-fort"].reasoning, /did not hold/, "star forts: checked, did not hold");
  assert.match(byId["tartary-erasure"].reasoning, /150 years/, "the fade of about 150 years");
  assert.match(byId["tartary-erasure"].reasoning, /1885/, "the map sequence runs to 1885");
  assert.match(byId["cia-proof"].reasoning, /does not describe a global/, "the paper does not describe a global empire");
  assert.match(byId["cia-proof"].reasoning, /advanced technology/, "nor advanced technology");
  assert.match(byId["fires-clearing"].reasoning, /was not found in the sources opened/, "coordination not found, stated as not found");
  assert.match(byId["peshtigo-report"].reasoning, /cannot be literally true/, "the flagged discrepancy stands");
});

test("the verified records carry their checkable anchors", () => {
  const byId = Object.fromEntries(WM.CLAIMS.map((c) => [c.id, c]));
  assert.ok(byId["cia-document"].claim.includes("CIA-RDP78-02771R000200090002-6"), "the file number, checkable");
  assert.ok(byId["sf-magnitude"].claim.includes("GIP-31"), "the magnitude tied to its publication");
  assert.ok(byId["sf-magnitude"].claim.includes("7.8"), "the figure as the publication states it");
  assert.match(byId["sf-magnitude"].reasoning, /differing magnitudes/, "the documented difference is kept, not smoothed");
});

test("the hub's own record agrees with the lesson's standings", () => {
  const patterns = Object.fromEntries(hub.checkedPatterns.map((p) => [p.name, p]));
  assert.equal(patterns["Star forts as an anomaly"].verdict, "Checked — it did not hold");
  assert.equal(patterns["“Tartaria vanished suddenly”"].verdict, "Checked — it did not hold");
  assert.equal(
    patterns["The 1957 CIA document as proof of a hidden empire"].verdict,
    "Checked — it did not hold"
  );
  assert.match(
    patterns["The fires of October 1871 as a coordinated act"].verdict,
    /^Unproven/,
    "the fires claim stands unproven in the hub, as the lesson teaches"
  );
  const entries = Object.fromEntries(hub.entries.map((e) => [e.id, e]));
  assert.equal(entries["GOV-CIA-TARTARIA-001"].grade, "documented-event-with-cited-record");
  assert.equal(entries["OLD-TARTARY-MAP-001"].grade, "documented-event-with-cited-record");
});

test("the closing shape is exact: correlation documented, coordination not documented", () => {
  const html = read("docs/witness-method.html");
  assert.ok(html.includes("documented correlation"), "the cluster is a documented correlation");
  assert.ok(html.includes("Coordination"), "coordination is named");
  assert.ok(html.includes("not documented"), "and stands as not documented");
  assert.ok(html.includes("A pattern is not causation"), "a pattern is not causation");
  assert.ok(/nothing gets quietly upgraded/i.test(html), "the rule against quiet upgrades");
});

test("the page carries the living layer once, the calendar, and the Spark", () => {
  const html = read("docs/witness-method.html");
  assert.equal((html.match(/assets\/js\/living-ui\.js/g) || []).length, 1, "living-ui.js exactly once");
  assert.equal((html.match(/assets\/css\/living-ui\.css/g) || []).length, 1, "living-ui.css exactly once");
  assert.equal((html.match(/data-living-nav/g) || []).length, 1, "one travel bar");
  assert.ok(html.includes("assets/css/codex.css"), "the one token sheet");
  assert.ok(html.includes("assets/css/witness-method.css"), "the lesson's own sheet");
  assert.ok(html.includes("assets/js/witness-method.js"), "the lesson's script");
  assert.ok(html.includes("assets/js/calendar/pattern-calendar.js"), "the canonical calendar");
  assert.ok(html.includes("assets/js/spark-presence.js"), "the Spark is present");
  assert.ok(html.includes("wm-spark-station"), "the Spark has its station");
});

test("the doors run both ways: the hub teaches, the lesson returns", () => {
  const html = read("docs/witness-method.html");
  const atlas = read("docs/claims-atlas.html");
  assert.ok(html.includes('href="claims-atlas.html"'), "the lesson doors back to the Documentation Hub");
  assert.ok(atlas.includes('href="witness-method.html"'), "the Documentation Hub doors to the lesson");
  const story = JSON.parse(read("docs/assets/data/codex-story.json"));
  const lists = Object.values(story).filter(Array.isArray);
  const pagesList = lists.find((a) => a.some((e) => e && e.page === "micro.html"));
  assert.ok(pagesList.some((e) => e.page === "witness-method.html"), "the page stands in the site inventory");
});

test("no pressure mechanics: no streaks, no scores, no absence framing", () => {
  const html = read("docs/witness-method.html");
  const js = read("docs/assets/js/witness-method.js");
  for (const [name, text] of [["page", html], ["script", js]]) {
    assert.ok(!/streak/i.test(text), `${name}: no streaks`);
    assert.ok(!/you missed|missed a day|days in a row/i.test(text), `${name}: no absence framing`);
    assert.ok(!/your score|score:/i.test(text), `${name}: no score kept`);
  }
  assert.ok(js.includes("I kept your place"), "a returning visitor is welcomed, their place kept");
});

test("the record is local, named, and resumable", () => {
  const js = read("docs/assets/js/witness-method.js");
  assert.ok(js.includes("sof.witness-method.v1"), "one local record, named");
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(js), "nothing leaves the device");
  assert.ok(js.includes("PatternCalendar"), "the calendar is the only date authority");
  assert.ok(js.includes("fromCivilDate"), "read through the calendar's public surface");

  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
  let record = WM.loadRecord(storage);
  assert.deepEqual([...record.placed], []);
  assert.equal(WM.nextUnplaced(record), WM.CLAIMS[0].id);
  record.placed.push(WM.CLAIMS[0].id, WM.CLAIMS[1].id);
  record.current = WM.nextUnplaced(record);
  WM.saveRecord(storage, record);
  const resumed = WM.loadRecord(storage);
  assert.deepEqual([...resumed.placed], [WM.CLAIMS[0].id, WM.CLAIMS[1].id], "the place is kept");
  assert.equal(WM.nextUnplaced(resumed), WM.CLAIMS[2].id, "the walk resumes at the next unplaced claim");
  const full = { placed: WM.CLAIMS.map((c) => c.id), current: null, done: true };
  assert.equal(WM.nextUnplaced(full), null, "a finished walk has no next claim");
});

test("the sheet declares no palette of its own — tokens only", () => {
  const css = read("docs/assets/css/witness-method.css");
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css), "no hex colours outside codex.css tokens");
  assert.ok(css.includes("var(--gold)"), "the Codex gold, by token");
  assert.ok(css.includes("prefers-reduced-motion"), "reduced motion stands whole");
});
