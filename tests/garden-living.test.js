"use strict";

/**
 * The Pattern Garden — the Living Look deepening (PR #349, second pass).
 *
 * Tending is real: the living layer keeps its OWN small tending record
 * (the Episodes resume-record precedent — a layer-local record,
 * separate from the house records), per bed, each mark stamped with
 * the Pattern Day it happened. Beds answer on their face, and a return
 * visit is spoken back from the record in welcome language. The
 * garden's own engine (pattern-garden.js) and the Life Atlas record
 * are never written by this layer.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");
const js = read("docs/assets/js/garden-living.js");
const css = read("docs/assets/css/garden-living.css");
const html = read("docs/garden.html");

test("garden.html wears the living layer exactly once", () => {
  assert.equal((html.match(/garden-living\.css/g) || []).length, 1);
  assert.equal((html.match(/garden-living\.js/g) || []).length, 1);
});

test("the tending record is the layer's own, per bed, Pattern-Day stamped", () => {
  assert.ok(js.includes("sof.pattern-garden.tending.v1"), "layer-local record key");
  assert.ok(js.includes("patternDay: coord.patternDay"), "marks carry the Pattern Day");
  assert.ok(js.includes("record.beds[bedId]"), "marks are kept per bed");
});

test("one mark per kind per bed per day — a second tap never stacks", () => {
  assert.ok(js.includes("already"), "dedupe check stands in addMark");
  assert.ok(/m\.kind === kind/.test(js) && /m\.patternDay === coord\.patternDay/.test(js));
});

test("the day comes from the canonical PatternCalendar only", () => {
  assert.ok(js.includes("PatternCalendar"));
  assert.ok(js.includes("fromCivilDate"));
  assert.ok(!/86400000/.test(js), "no private date arithmetic");
});

test("this layer never writes the house records", () => {
  assert.ok(!/life-atlas/i.test(js), "no Life Atlas writes or reads");
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(js), "no network, no tracking");
  assert.ok(!/require\(|import\s/.test(js), "the garden engine is not loaded or rebuilt here");
});

test("tending answers on the bed's face and is spoken back on return", () => {
  assert.ok(js.includes("gl-bed-tended-today"), "the bed's face changes when tended today");
  assert.ok(js.includes("Kept in this bed's own tending record"), "marks accumulate on the bed");
  assert.ok(js.includes("I kept your place — welcome back. You "), "welcome speaks the record back");
  assert.ok(js.includes("KIND_VERB[latest.mark.kind]"), "the spoken verb comes from the kept mark");
});

test("no absence framing anywhere in the layer", () => {
  for (const bad of ["you have not", "you haven't", "you missed", "days missed", "streak"]) {
    assert.ok(!js.toLowerCase().includes(bad), `absent framing found: ${bad}`);
  }
});

test("the witnessed mark is read off the house act, never minted by a layer button", () => {
  assert.ok(js.includes('["tended", "watered"]'), "layer buttons tend and water only");
  assert.ok(/Witnessed today/.test(js), "witnessed is derived from the bed's own face");
});

test("the pickers are woven into the stage by moving the same elements", () => {
  assert.ok(js.includes("gl-stage-tools"));
  assert.ok(js.includes(":has(#garden-county)"), "the county picker itself is moved");
  assert.ok(js.includes(":has(#garden-guide-crop)"), "the guide picker itself is moved");
  assert.ok(css.includes(".gl-stage-tools"), "the stage tools are styled");
});

test("reduced motion keeps the still design whole", () => {
  assert.ok(js.includes('matchMedia("(prefers-reduced-motion: reduce)")'));
  assert.ok(css.includes("prefers-reduced-motion: reduce"), "still twin stands in the sheet");
  assert.ok(css.includes(".gl-tending"), "tending stands in the still design too");
});
