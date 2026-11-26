"use strict";

/* Living Look — the Scroll Library as a room (scroll/index.html).
 * Pins the preview's shape: the one token sheet worn, the day's line
 * and today's reading first, the reader's own record as the only
 * memory, and the shelf fragments untouched behind the room. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const html = read("docs/scroll/index.html");
const css = read("docs/scroll/assets/living-look-library.css");
const js = read("docs/scroll/assets/living-look-library.js");
const generator = read("scripts/build-scroll-library.mjs");

test("the room is generated, not hand-edited: the generator carries it", () => {
  assert.ok(generator.includes("living-look-library.css"), "generator emits the room's stylesheet");
  assert.ok(generator.includes("living-look-library.js"), "generator emits the room's script");
  assert.ok(generator.includes("ll-today"), "generator emits today's reading panel");
});

test("the page wears the one token sheet and the Moon's tint sheet", () => {
  assert.equal((html.match(/assets\/css\/codex\.css/g) || []).length, 1, "codex.css exactly once");
  assert.equal((html.match(/living-moon-theme\.css/g) || []).length, 1, "moon tint sheet exactly once");
  assert.ok(css.includes("var(--bg)"), "night ground comes from the token sheet");
  assert.ok(css.includes("var(--gold)"), "gold comes from the token sheet");
  assert.ok(css.includes("var(--radius-md)"), "radii come from the token sheet");
  const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/#05070d|#08101a|#f3c97a|#d99545|#f4f1e8/i.test(cssNoComments), "no drifting re-declared palette — the token hexes live only in codex.css");
});

test("the real day stands on the face, from the canonical calendar only", () => {
  assert.ok(html.includes("data-ll-day-text"), "the day's line stands in the hero");
  assert.ok(js.includes("PatternCalendar"), "coordinate read from PatternCalendar");
  assert.ok(js.includes("fromCivilDate"), "through the canonical converter");
  assert.ok(!/86400000|getTime\(\)\s*[-+]/.test(js), "no private calendar math");
  assert.ok(!/fetch\(.*moons|XMLHttpRequest|sendBeacon/.test(js), "no tracking");
});

test("today's reading is the one clear action, offered first", () => {
  const today = html.indexOf("ll-today");
  const search = html.indexOf("hero-search");
  assert.ok(today > -1 && search > today, "today's reading panel stands before the search tool");
  assert.ok(html.includes("Today’s reading"), "the panel names today's reading");
  assert.ok(html.includes("ll-spark"), "the Spark stands at its station beside it, no bubble");
});

test("memory is the reader's own record — one record, no new store", () => {
  assert.ok(js.includes("sof-scroll-last-passage"), "reads the reader's existing record");
  assert.ok(!/localStorage\.setItem|sessionStorage\.setItem/.test(js), "writes no store of its own");
  assert.ok(js.includes("I kept your place"), "welcome framing");
  assert.ok(!/missed|streak|you have not/i.test(js), "no absence or guilt framing in the room's own layer");
  assert.ok(js.includes("data/shelf-"), "the shelf is found in the lists the page already loads");
});

test("motion has a still twin", () => {
  assert.ok(css.includes("prefers-reduced-motion"), "reduced motion is designed for");
  assert.ok(css.includes("@media (prefers-reduced-motion: reduce)"), "the still design stands whole");
});

test("the shelf fragments behind the room are untouched territory", () => {
  for (const shelf of ["foundations", "scripture", "history", "evidence", "technology", "prophecy", "witness", "reference"]) {
    const fragment = read(`docs/scroll/data/shelf-${shelf}.html`);
    assert.ok(!fragment.includes("living-look"), `${shelf} fragment carries no living-look remake`);
    assert.ok(html.includes(`data-shelf-src="data/shelf-${shelf}.html"`), `${shelf} shelf still loads its fragment`);
  }
});
