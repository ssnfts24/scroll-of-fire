"use strict";

// Sphere page layout fit — regression pin for the cut-off stage
// of Nov 27, 2026.
//
// On Aaron's Galaxy A16 the bottom of the Sphere page was cut
// off: the caption above the stage stood 203–278px tall at
// phone widths while the canvas wrap was floored at a bare
// 80dvh inside a 100dvh, overflow-hidden flex frame — so the
// stage's bottom ran past the viewport at every phone width
// (measured +129px at 360×740, +69px at 390×844, +42px at
// 412×892, +16px at 430×932) and the page could not scroll
// to reach it. Aaron's ruling: more of the Sphere has to
// show; there is too much boarding packed up above.
//
// The fix is layout sizing only, in two sheets:
//  1. the protected sheet's phone floor for the canvas wrap
//     is capped by the frame — min(80dvh, 100%) — so the wrap
//     can never outgrow the room the frame gives it;
//  2. the frame sheet folds the caption slimmer at phone
//     widths (padding, voice size, the season line's pill) —
//     every word whole, nothing clamped — returning the room
//     to the stage.
// No geometry, rendering, camera, motion, selection, or label
// rule moves; no Spark record code is touched.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const protectedCss = read("docs/assets/css/living-time-sphere.css");
const frameCss = read("docs/assets/css/sphere-armillary.css");

test("the phone stage floor is capped by the frame it stands in", () => {
  assert.match(
    protectedCss,
    /html\.living-time-sphere-page\.sof-mobile-mode \.sphere-canvas-wrap \{\s*\/\*[\s\S]*?\*\/\s*min-height: min\(80dvh, 100%\);/,
    "the 80dvh floor reads min(80dvh, 100%) under the mobile mark",
  );
  assert.doesNotMatch(
    protectedCss,
    /\.sphere-canvas-wrap \{\s*min-height: 80dvh;/,
    "no bare 80dvh floor remains for the canvas wrap",
  );
});

test("the caption folds slimmer at phone widths, words whole", () => {
  const start = frameCss.indexOf("The caption folds slimmer on a phone");
  const block = frameCss.slice(start, frameCss.indexOf("/* ── 5. The rings", start));
  assert.ok(block.length > 0, "the caption slimming block stands in the frame sheet");
  assert.match(block, /@media \(max-width: 700px\)/);
  assert.match(block, /\.sphere-rebuild-caption \{\s*padding: 0\.35rem 5rem 0\.2rem 0\.75rem;/);
  assert.match(block, /\.sphere-season-line \{\s*font-size: 0\.8rem;/);
  assert.doesNotMatch(block, /-webkit-line-clamp|line-clamp/, "no line clamp cuts a word");
  assert.doesNotMatch(block, /display: none/, "nothing in the caption is hidden away");
});
