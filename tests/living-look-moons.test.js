"use strict";

/* Living Look — Remnant 13 Moons as an instrument (moons.html).
 * Pins the preview's shape: the one token sheet consumed, the Moon
 * you are in as the stage's face, the thirteen moons standing with
 * today in gold, one clear action (open today), memory drawn only
 * from the page's own existing records, the astrology fence kept,
 * and no R1.7 protected file carrying the remake. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const html = read("docs/moons.html");
const css = read("docs/assets/css/moons-living.css");
const js = read("docs/assets/js/moons-living.js");

test("the page wears the one token sheet and the Moon's tint sheet, once each new layer", () => {
  assert.ok(html.includes("assets/css/codex.css"), "codex.css is the token sheet");
  assert.equal((html.match(/moons-living\.css/g) || []).length, 1, "moons-living.css exactly once");
  assert.equal((html.match(/moons-living\.js/g) || []).length, 1, "moons-living.js exactly once");
  assert.ok(css.includes("var(--gold)"), "gold comes from the token sheet");
  assert.ok(css.includes("var(--radius-lg)"), "radii come from the token sheet");
  assert.ok(css.includes("var(--moon-accent"), "the Moon's tint lights the room");
  const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/#05070d|#08101a|#f3c97a|#d99545|#f4f1e8/i.test(cssNoComments), "no re-declared palette hexes");
});

test("the real day stands on the face, from the canonical calendar only", () => {
  assert.ok(html.includes("moons-stage"), "the stage stands on the page");
  assert.ok(js.includes("PatternCalendar"), "coordinate read from PatternCalendar");
  assert.ok(js.includes("fromCivilDate"), "through its public converter only");
  assert.ok(js.includes("PatternCalendarData"), "moon names from the site's existing data");
  assert.ok(!/86400000/.test(js), "no private calendar math");
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(js), "no tracking or fetching");
});

test("the thirteen moons are the face, and the one action is opening today", () => {
  const stage = html.indexOf("moons-stage");
  const explainer = html.indexOf("moons-explainer");
  assert.ok(stage > -1 && explainer > stage, "the stage stands before the explainer and the tools");
  assert.ok(html.includes('id="moons-open-today"'), "the one action stands in the stage");
  assert.ok(html.includes('id="moons-strip"'), "the thirteen moons stand in the stage");
  assert.ok(js.includes("sof:activate-tab"), "tab moves go through the page's own tab surface");
  assert.ok(js.includes("todaySummaryMoonGrid"), "the action lands on the page's own 28-day map");
});

test("memory is the page's own record — read only, no new store", () => {
  assert.ok(js.includes("sof_moons_last_tab_v1"), "reads the last room the page itself kept");
  assert.ok(js.includes("sof_moon_logs_v3"), "reads the page's saved witness logs");
  assert.ok(!/localStorage\.setItem/.test(js), "writes no local record of its own");
  assert.ok(js.includes("I kept your place"), "welcome framing");
  assert.ok(!/missed|streak|you have not/i.test(js), "no absence or guilt framing");
});

test("the astrology fence is kept: this layer never loads it", () => {
  assert.ok(!/astrology\.js/.test(js), "the living layer does not load the astrology engine");
  assert.ok(!/astrology/.test(css), "the living layer does not restyle the astrology panel");
});

test("motion has a still twin", () => {
  assert.ok(css.includes("prefers-reduced-motion: no-preference"), "motion only where motion is welcome");
  assert.ok(css.includes("@media (prefers-reduced-motion: reduce)"), "the still design stands whole");
  assert.ok(js.includes("prefers-reduced-motion: reduce"), "the intro is never injected for reduced motion");
});

test("no R1.7 protected file carries the remake", () => {
  const manifest = read("docs/development/R1.7-PROTECTED-MANIFEST.md");
  for (const rel of [
    "docs/assets/js/moons-living.js",
    "docs/assets/css/moons-living.css",
  ]) {
    assert.ok(!manifest.includes(path.basename(rel)), `${rel} is not a protected file`);
  }
  assert.ok(!js.includes("LivingTimeSphere"), "the sphere stack is not touched or driven");
});
