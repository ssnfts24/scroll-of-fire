"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const docsDir = path.join(root, "docs");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

/*
 * The living motion wave rides the shared living layer (living-ui.css +
 * living-ui.js) — the same include every content page already loads.
 * Its fences:
 * - reveal states are JS-applied only; nothing is hidden by default
 *   and no markup ever carries the pending classes;
 * - reduced motion and the site's motion-off attribute still it fully;
 * - the homepage Sphere moment touches only the hero frame's overlay
 *   of light — the protected Sphere page is never referenced.
 */

test("the wave lives in the shared living layer, not in page markup", () => {
  const css = read("docs/assets/css/living-ui.css");
  const js = read("docs/assets/js/living-ui.js");
  assert.match(css, /\.lui-card-pending\s*\{[^}]*opacity:\s*0/);
  assert.match(css, /\.lui-card-armed/);
  assert.match(js, /classList\.add\("lui-card-pending"\)/);
  assert.match(js, /classList\.add\("lui-card-armed"\)/);
  assert.match(js, /IntersectionObserver/);
  for (const name of fs.readdirSync(docsDir).filter((n) => n.endsWith(".html"))) {
    const html = read("docs/" + name);
    assert.ok(!html.includes("lui-card-pending"), `${name}: card pending state is JS-only`);
    assert.ok(!html.includes("lui-card-armed"), `${name}: card armed state is JS-only`);
    assert.ok(!html.includes("lui-paused"), `${name}: pause state is JS-only`);
  }
});

test("the wave is gated on the same reduced-motion check as the reveals", () => {
  const js = read("docs/assets/js/living-ui.js");
  assert.match(js, /if \(reducedMotion\) return;/);
  const css = read("docs/assets/css/living-ui.css");
  const reduceBlock = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduceBlock, /\.lui-card-pending\s*\{[^}]*opacity:\s*1/);
  assert.match(reduceBlock, /\.ld-moon-line/);
  assert.match(reduceBlock, /homepage-sphere-frame::before/);
});

test("hover and press answers live only in the motion-safe media query", () => {
  const css = read("docs/assets/css/living-ui.css");
  const start = css.indexOf("@media (prefers-reduced-motion: no-preference)");
  assert.ok(start >= 0, "a no-preference block must exist");
  const block = css.slice(start, css.indexOf("/* Hidden tab:", start));
  assert.match(block, /translate:\s*0 -2px/);
  assert.match(block, /:active\s*\{[^}]*scale:/);
  assert.match(block, /\.ld-moon-line\s*\{[^}]*animation:\s*lui-soft-in/);
  assert.match(block, /\.homepage-sphere-frame::before\s*\{[^}]*animation:\s*lui-frame-breathe/);
  assert.match(block, /\.homepage-sphere-frame::before\s*\{[^}]*pointer-events:\s*none/);
});

test("the motion-off attribute stills the wave", () => {
  const css = read("docs/assets/css/living-ui.css");
  assert.match(css, /html\[data-codex-motion="off"\][^{]*\.ld-moon-line/);
  assert.match(css, /html\[data-codex-motion="off"\][^{]*homepage-sphere-frame::before/);
});

test("ambient animations pause while the tab is hidden", () => {
  const js = read("docs/assets/js/living-ui.js");
  const css = read("docs/assets/css/living-ui.css");
  assert.match(js, /visibilitychange/);
  assert.match(js, /lui-paused/);
  assert.match(css, /\.lui-paused[^{]*\{[^}]*animation-play-state:\s*paused/);
});

test("the wave names no theme of its own — colour ease only", () => {
  const css = read("docs/assets/css/living-ui.css");
  const wave = css.slice(css.indexOf("Living motion — the animation wave"));
  assert.match(wave, /background-color 0\.8s ease/);
  assert.ok(!/--lui-(moon|theme)/.test(wave), "the wave must stay theme-agnostic");
});

test("the protected sphere page carries none of the wave", () => {
  const html = read("docs/living-time-sphere.html");
  assert.ok(!html.includes("living-ui"), "the sphere page never loads the living layer");
});
