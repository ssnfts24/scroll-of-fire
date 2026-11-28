"use strict";

/*
 * The Sphere stage on a phone browser (Nov 24, 2026 — Aaron's
 * named release of this one piece, Dashboard #57, in his own
 * words: "Release the Sphere stage piece"; the same family as
 * the Gate D app-mode release, PR #277).
 *
 * This file is the SIGNATURE FILE for the release's one named
 * protected-set change, declared in tests/homepage-sphere.test.js:
 * the protected sphere stylesheet gains exactly one phone-width
 * block, and the Sphere page carries only that stylesheet's
 * cache-version bump. The declared protected paths are exactly:
 *   - docs/assets/css/living-time-sphere.css (the stage floor)
 *   - docs/living-time-sphere.html (the cache bump on that
 *     stylesheet's link, nothing else)
 *
 * What the block does: under html.sof-mobile-mode — the mark
 * the app-mode module sets only when IT acquired the app mode
 * on a phone-width viewport, never in the true app context —
 * the canvas wrap is floored at 80dvh. The instrument shell
 * and the container are the wrap's absolute fills, so the
 * stage stands at the app framing's standard (the great
 * majority of the usable screen) instead of the 0.286 share
 * measured before the release. These pins hold the block to
 * exactly that shape: one media query, one selector, one
 * declaration, gated on the mobile mark alone.
 *
 * Amendment (Nov 27, 2026 — Aaron's ruling on the cut-off
 * stage: "The bottom part of the sphere page is getting cut
 * off… more of the sphere has to show on that page — there's
 * too much boarding packed up above"). The wrap stands in a
 * 100dvh, overflow-hidden flex frame, and floored at a bare
 * 80dvh it outgrew the frame whenever the caption above it
 * stood tall: the stage's bottom ran past the viewport at
 * every phone width (measured +129px at 360×740, +42px at
 * 412×892) and the page could not scroll to reach it. The
 * one declaration now reads min(80dvh, 100%) — the floor,
 * capped by the frame it stands in — and the stylesheet
 * link's cache token is bumped for it (…&s=20261127-stagefit).
 * Still one media query, one selector, one declaration,
 * gated on the mobile mark alone; layout sizing only.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const CSS = fs.readFileSync(
  path.join(root, "docs/assets/css/living-time-sphere.css"), "utf8");
const PAGE = fs.readFileSync(
  path.join(root, "docs/living-time-sphere.html"), "utf8");
const MODULE = fs.readFileSync(
  path.join(root, "docs/assets/js/sphere-app-mode.js"), "utf8");

test("the protected sheet carries the stage floor, exactly one mobile-mark rule", () => {
  const occurrences = CSS.match(/sof-mobile-mode/g) || [];
  assert.equal(occurrences.length, 1,
    "the mobile mark appears once in the protected sheet: the stage block");
  assert.match(CSS,
    /@media \(max-width: 700px\) \{\s*html\.living-time-sphere-page\.sof-mobile-mode \.sphere-canvas-wrap \{\s*(?:\/\*[\s\S]*?\*\/\s*)?min-height: min\(80dvh, 100%\);\s*\}\s*\}/,
    "the block is one phone-width media query flooring the canvas wrap at min(80dvh, 100%)");
});

test("the stage block moves nothing else in the protected sheet", () => {
  // The base container rule — the desktop framing — stands as it was.
  assert.match(CSS,
    /#sphere-container \{\s*min-width: 0;\s*min-height: 400px;\s*height: clamp\(400px, 62vw, 640px\);/,
    "the base #sphere-container rule is untouched");
  // The desktop wrapper grid stands as it was.
  assert.match(CSS,
    /\.sphere-wrapper \{\s*display: grid;\s*grid-template-columns: minmax\(0, 1fr\);/,
    "the base .sphere-wrapper rule is untouched");
});

test("the mobile mark still means a phone browser, never the app", () => {
  // The gate the CSS relies on: the module adds sof-mobile-mode
  // only when it acquired the mode itself, which it does only
  // when the app context had not already set sof-app-mode.
  assert.match(MODULE,
    /function acquireMobileMode\(\) \{\s*if \(root\.classList\.contains\("sof-app-mode"\)\) return;\s*root\.classList\.add\("sof-app-mode"\);\s*root\.classList\.add\("sof-mobile-mode"\);/,
    "the module acquires the mobile mark only absent an app-set mode");
});

test("the page carries the stage cache bump on the protected stylesheet link", () => {
  assert.match(PAGE,
    /assets\/css\/living-time-sphere\.css\?v=20260819-b752[^"]*&s=20261127-stagefit"/,
    "the stylesheet link carries the stage-fit amendment's cache token");
});
