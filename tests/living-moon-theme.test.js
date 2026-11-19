"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const PAGES = ("13-moon-whitepaper ab about-aaron alignment-ledger circle claims-atlas codex-atlas covenant-caravan downloads equinox-passage ethics genesis-oracle glossary glyphs guide hub index invoke lab ledger micro moons scroll-of-fire-codex-of-reality-remnant-whitepaper search sending-test shop start teach theory timeline witness").split(" ");

test("moon theme module and stylesheet exist", () => {
  assert.ok(fs.existsSync(path.join(root, "docs/assets/js/living-moon-theme.js")));
  assert.ok(fs.existsSync(path.join(root, "docs/assets/css/living-moon-theme.css")));
});

test("every main-house content page carries the theme exactly once", () => {
  for (const name of PAGES) {
    const html = read(`docs/${name}.html`);
    assert.equal((html.match(/living-moon-theme\.css/g) || []).length, 1, name);
    assert.equal((html.match(/living-moon-theme\.js/g) || []).length, 1, name);
    assert.ok(html.includes("pattern-calendar-data"), `${name} must load the canonical calendar before the theme`);
  }
});

test("the Sphere page does NOT carry the moon theme (R1.7 exclusion)", () => {
  const html = read("docs/living-time-sphere.html");
  assert.ok(!html.includes("living-moon-theme"), "sphere page keeps its own sky");
});

test("module reads only the canonical PatternCalendar and invents no calendar math", () => {
  const js = read("docs/assets/js/living-moon-theme.js");
  assert.ok(js.includes("PatternCalendar"));
  assert.ok(js.includes("fromCivilDate"));
  assert.ok(!/86400000|getTime\(\)\s*[-+]/ .test(js), "no private date arithmetic");
  assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(js), "no network, no tracking");
});

test("stylesheet defines a palette for all 13 moons plus outside", () => {
  const css = read("docs/assets/css/living-moon-theme.css");
  for (let m = 1; m <= 13; m += 1) {
    assert.ok(css.includes(`html[data-moon="${m}"]`), `moon ${m}`);
  }
  assert.ok(css.includes('html[data-moon="outside"]'));
  for (const dp of ["morning", "day", "dusk", "night"]) {
    assert.ok(css.includes(`data-daypart="${dp}"`), dp);
  }
});

test("the one thing comes from the calendar's own day archetypes", () => {
  const js = read("docs/assets/js/living-moon-theme.js");
  assert.ok(js.includes("dayArchetype"), "drawn from the canonical summary's archetype");
  assert.ok(js.includes("moons.html"), "doors to the day's telling");
});
