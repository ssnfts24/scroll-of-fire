"use strict";

/*
 * One travel bar (Aaron's blanket approval, Nov 19, 2026).
 *
 * The audit found three bars stacked at the top of 19 pages: the
 * living nav, the living signal bar, and the social bridge bar —
 * on a phone, bars were the first thing a visitor met. Now there is
 * ONE slim travel bar:
 *
 *   - the travel bar itself (the living nav, re-roomed: Home ·
 *     Sphere · Companions · 13 Moons · Library · Witness World ·
 *     Shop · Witness, Support last) — pinned page-by-page in
 *     living-nav.test.js;
 *   - the signal bar is gone as a stacked bar: its section is
 *     removed from every page (the homepage keeps only its Living
 *     Day toggle and panel, which are a feature, not a bar);
 *   - the social bridge no longer stacks a second bar under the
 *     nav: its share button and follow doors live inside the travel
 *     bar, and its panel opens as a row of that same bar.
 *
 * The R1.7 sphere page is excluded, as always: it carries no travel
 * bar and keeps its own protected chrome.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const docsDir = path.join(root, "docs");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

function walk(dir, prefix = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
    else if (entry.isFile() && entry.name.endsWith(".html")) out.push(rel);
  }
  return out;
}

const allPages = walk(docsDir).sort();

test("the signal bar no longer stacks on any page", () => {
  for (const rel of allPages) {
    const html = read(`docs/${rel}`);
    assert.ok(
      !html.includes("data-living-signal-root"),
      `${rel}: signal bar root must be gone`
    );
    if (rel !== "index.html") {
      assert.ok(
        !html.includes("living-signal-shell"),
        `${rel}: signal shell must be gone`
      );
    }
  }
});

test("the homepage keeps its Living Day feature, minus the signal bar", () => {
  const home = read("docs/index.html");
  assert.ok(home.includes("data-living-day-toggle"), "Living Day toggle kept");
  assert.ok(home.includes("data-living-day-panel"), "Living Day panel kept");
  assert.ok(!home.includes("living-signal-bar"), "signal bar itself is gone");
});

test("the social bridge lives inside the travel bar, not under it", () => {
  const js = read("docs/assets/js/social-bridge.js");
  assert.match(js, /querySelector\("\.living-nav-inner"\)/, "bridge finds the travel bar's inner row");
  assert.match(js, /navInner\.appendChild\(bar\)/, "bridge slot is appended inside the bar");
  assert.match(js, /social-bridge-in-bar/, "bridge marks its in-bar form");
  assert.match(js, /navHost\.appendChild\(panel\)/, "the share panel opens as a row of the bar itself");
  const css = read("docs/assets/css/social-bridge.css");
  assert.match(css, /\.social-bridge\.social-bridge-in-bar\s*\{[^}]*background:\s*none/, "in-bar bridge carries no second background");
  assert.match(css, /\.social-bridge\.social-bridge-in-bar\s*\{[^}]*border-bottom:\s*none/, "in-bar bridge carries no second border");
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.social-bridge-in-bar \.social-bridge-follow\s*\{\s*display:\s*none/, "on a phone the follow doors rest; rooms and Share stay");
});

test("the travel bar is one slim row", () => {
  const css = read("docs/assets/css/living-ui.css");
  const h = css.match(/--living-nav-h:\s*(\d+)px/);
  assert.ok(h, "bar height is published");
  assert.ok(Number(h[1]) <= 48, `bar is slim (<= 48px), got ${h[1]}px`);
  assert.match(css, /\.travel-bar \.living-nav-inner\s*\{[^}]*flex-wrap:\s*nowrap/, "the bar never wraps into a second row");
  assert.match(css, /\.travel-bar \.living-nav-links\s*\{[^}]*min-width:\s*0/, "the room row can shrink and scroll inside the bar");
  assert.match(css, /\.living-nav\s*\{[^}]*position:\s*sticky/, "the bar stays in flow at the top (sticky, not fixed over content)");
  const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduced, /\.living-nav-links a\s*\{\s*transition:\s*none/, "reduced-motion visitors get a still bar");
});

test("the signal shell no longer sticks beneath the headers", () => {
  const css = read("docs/assets/css/navigation.css");
  const shell = css.match(/\.living-signal-shell\s*\{([^}]*)\}/);
  assert.ok(shell, "signal shell rule still styles the homepage's Living Day holder");
  assert.ok(!/position:\s*sticky/.test(shell[1]), "the shell is not a sticky stacked bar anymore");
});

test("excluded pages carry no travel bar", () => {
  for (const rel of ["living-time-sphere.html", "404.html", "offline.html", "caravan.html"]) {
    const html = read(`docs/${rel}`);
    assert.ok(!html.includes("data-travel-bar"), `${rel}: no travel bar`);
  }
  const sphere = read("docs/living-time-sphere.html");
  assert.ok(!sphere.includes("travel-bar"), "the R1.7 sphere page carries no travel-bar markup at all");
});
