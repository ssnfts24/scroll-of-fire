"use strict";

/* Living Look — the front door as a place you enter (docs/index.html).
 * Pins the preview's shape: the one token sheet consumed, the real
 * day whole in one welcome line, one clear action (Enter the Sphere)
 * with every door still working, the Spark at its station with no
 * bubble, memory drawn only from the homepage's own existing records,
 * and the generated front-door block untouched. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const html = read("docs/index.html");
const css = read("docs/assets/css/home-living-look.css");
const js = read("docs/assets/js/home-living-look.js");

const doorAt = html.indexOf('id="ambient-door"');
const door = html.slice(doorAt, html.indexOf('id="step-witness"'));

test("the layer wears the one token sheet and the Moon's tint", () => {
  assert.ok(html.includes("home-living-look.css"), "the layer's sheet is loaded");
  assert.ok(css.includes("var(--gold)"), "gold comes from the token sheet");
  assert.ok(css.includes("var(--radius-lg)"), "radii come from the token sheet");
  assert.ok(css.includes("var(--moon-accent"), "the Moon's tint is the room's light");
  const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/#05070d|#08101a|#f3c97a|#d99545|#f4f1e8/i.test(cssNoComments), "no drifting re-declared palette — the token hexes live only in codex.css");
});

test("the real day stands whole on the face, from the canonical calendar only", () => {
  assert.ok(door.includes("data-ll-day-text"), "the welcome line stands in the door");
  assert.ok(js.includes("PatternCalendar"), "coordinate read from PatternCalendar");
  assert.ok(js.includes("fromCivilDate"), "through the canonical converter");
  assert.ok(js.includes("Pattern Day"), "Pattern Day rides in the same line as the civil date");
  assert.ok(!/86400000|getTime\(\)\s*[-+]/.test(js), "no private calendar math");
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(js), "no tracking, no fetch");
});

test("one clear action: Enter the Sphere first, every door still working", () => {
  assert.match(door, /class="btn primary" href="\.\/living-time-sphere\.html" data-ll-enter>Enter the Sphere/);
  assert.match(door, /href="\.\/companions\.html"/, "Meet the Spark still stands");
  assert.match(door, /href="#home-sphere-observatory"/, "Sit with the Sphere here still stands");
  assert.ok(css.includes(".ambient-actions .btn.primary"), "the one action is styled first");
  assert.ok(css.includes(".ambient-actions .btn:not(.primary)"), "the other doors stand by as quiet links");
});

test("the Spark stands at its station, no bubble, and answers the touch", () => {
  assert.ok(door.includes("ll-spark-station"), "the station stands in the door");
  assert.ok(door.includes("ll-spark-orb"), "the Spark lights up at its station");
  assert.ok(js.includes("is-lit"), "touching the action lights the station at once");
  assert.ok(js.includes("pointerdown"), "the answer comes at touch speed, before navigation");
});

test("memory is the homepage's own record — read only, one record", () => {
  assert.ok(js.includes("CodexMemory"), "reads Codex Memory through its public API");
  assert.ok(js.includes("getResumePath"), "the same resume the page already keeps");
  assert.ok(js.includes("sof-scroll-last-passage"), "the reader's record, as living-codex.js reads it");
  assert.ok(!/localStorage\.setItem|sessionStorage\.setItem/.test(js), "writes no store of its own");
  assert.ok(door.includes("I kept your place"), "welcome framing at the door");
  assert.ok(!/\bmissed\b|streak|you have not/i.test(js), "no absence or guilt framing in the layer");
});

test("motion has a still twin", () => {
  assert.ok(css.includes("prefers-reduced-motion: no-preference"), "motion only where motion is welcome");
  assert.ok(css.includes("@media (prefers-reduced-motion: reduce)"), "the still design stands whole");
});

test("the generated front-door block is pipeline-owned and untouched", () => {
  const start = html.indexOf("<!-- site-catalog:front-door:start -->");
  const end = html.indexOf("<!-- site-catalog:front-door:end -->");
  assert.ok(start > -1 && end > start, "the generated block still stands");
  const block = html.slice(start, end);
  assert.ok(!block.includes("home-living-look") && !block.includes("data-ll-") && !block.includes("ll-spark") && !block.includes("ll-day-line"), "no Living Look edits inside the generated block");
  assert.ok(block.includes('id="front-door"'), "the Front Door section keeps its place");
});

test("no protected R1.7 file is the layer's business", () => {
  assert.ok(!js.includes("living-time-sphere.js"), "the layer never reaches into the Sphere stack");
  assert.ok(html.includes("home-living-look.js"), "the layer's script is loaded");
  const scriptAt = html.indexOf("home-living-look.js");
  assert.ok(scriptAt > html.indexOf("pattern-calendar.js"), "the layer runs after the canonical calendar");
  assert.ok(scriptAt > html.indexOf("codex-memory.js"), "the layer runs after Codex Memory");
});
