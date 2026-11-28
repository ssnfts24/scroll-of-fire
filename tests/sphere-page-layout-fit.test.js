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
//
// Second round (same day, Aaron's A16 test of the first fix:
// "the sphere and the boxes still didn't really fit right").
// The first round was measured at the lab's default font; on
// Aaron's phone the system font stands larger, and at an
// enlarged font three more failures stood measured (settled
// boot, stability-checked, 412px wide):
//  1. the guide bar's stage reserve. The companion layer pads
//     the canvas wrap by the guide bar's height + 14 so the bar
//     can rest under the instrument — but the shell sweep homes
//     the bar in the rooms sheet, and the reserve kept being
//     measured on that sheet room and added under the stage.
//     At a 1.15 font the room stood 639px tall, so the wrap
//     stood 653px where the frame allotted the stage 389px;
//     the frame clipped the overflow and the Sphere and the
//     demonstration card were cut at the screen's edge (the
//     card's own controls past the clip, the Patterns door
//     standing over the stage's span — Aaron's screenshot).
//     The reserve now stands only while the bar itself stands
//     in the stage column, and clears otherwise.
//  2. the caption standing rigid. At the same font it grew
//     180px → 331px and, flex-rigid, evicted the stage. It now
//     yields first: it may shrink, never takes more than 44%
//     of the screen height, and scrolls inside itself — every
//     word whole and reachable.
//  3. the demonstration card's own overflow. At a large font
//     on a short stage the card's standing parts outgrow the
//     stage and its hidden overflow clipped its controls. At
//     phone widths the card is now the one scroll region.
// And the card's day: it read the UTC day (a bare calendar
// call) while the page read local midnight — Aaron's
// screenshot showed the card naming Pattern Day 226 at
// 21:07 PST on Pattern Day 225. Its call now carries the
// device's zone and the midnight boundary, the house pattern
// every other Sphere module already follows.

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

test("the guide-bar reserve stands only while the bar stands in the stage column", () => {
  const layer = read("docs/assets/js/sphere-companion-layer.js");
  const start = layer.indexOf("function fitBarReserve()");
  const body = layer.slice(start, layer.indexOf("\n  }", start));
  assert.ok(start >= 0 && body.length > 0, "fitBarReserve stands in the companion layer");
  assert.match(body, /!wrap\.contains\(bar\)/, "a bar homed in the rooms sheet earns no reserve under the stage");
  assert.match(body, /wrap\.style\.paddingBottom = "";/, "the reserve clears when the bar does not stand in the wrap");
  assert.match(body, /h > 0 \? `\$\{h \+ 14\}px` : ""/, "a hidden bar clears the reserve instead of leaving a stale one");
});

test("the demonstration card reads the house day — local midnight, the device's zone", () => {
  const opening = read("docs/assets/js/sphere-evolution-opening.js");
  assert.doesNotMatch(opening, /fromCivilDate\(\{ date: new Date\(\) \}\)/, "no bare UTC-day call remains in the opening");
  assert.match(opening, /fromCivilDate\(\{ date: new Date\(\), timeZone, boundaryMode: "midnight" \}\)/, "the card's day call carries the zone and the midnight boundary");
  assert.match(opening, /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/, "the zone is the device's own, as the page's cursor resolves it");
});

test("the demonstration card scrolls as one piece at phone widths", () => {
  const css = read("docs/assets/css/sphere-evolution-opening.css");
  const start = css.indexOf("the card scrolls as one piece");
  const block = css.slice(start, css.indexOf("/* ── Small screens", start));
  assert.ok(block.length > 0, "the card scroll block stands in the opening sheet");
  assert.match(block, /@media \(max-width: 700px\)/);
  assert.match(block, /\.evo-card \{\s*overflow-y: auto;/, "the card itself is the scroll region");
  assert.match(block, /\.evo-visual \{\s*flex: 0 1 auto;\s*overflow-y: visible;/, "the picture unfurls into the card's scroll");
});

test("the changed files ride fresh stamps", () => {
  const page = read("docs/living-time-sphere.html");
  const layer = read("docs/assets/js/sphere-companion-layer.js");
  assert.ok(page.includes("sphere-companion-layer.js?v=20261127-2"), "the companion layer's stamp moved");
  assert.ok(page.includes("sphere-armillary.css?v=20261127-6-fitfix"), "the frame sheet's stamp moved");
  assert.ok(layer.includes("sphere-evolution-opening.css?v=20261127-2"), "the opening sheet's stamp moved");
  assert.ok(layer.includes("sphere-evolution-opening.js?v=20261127-2"), "the opening's stamp moved");
});

test("the caption folds slimmer at phone widths, words whole", () => {
  const start = frameCss.indexOf("The caption folds slimmer on a phone");
  const block = frameCss.slice(start, frameCss.indexOf("/* ── 5. The rings", start));
  assert.ok(block.length > 0, "the caption slimming block stands in the frame sheet");
  assert.match(block, /@media \(max-width: 700px\)/);
  assert.match(block, /\.sphere-rebuild-caption \{\s*padding: 0\.35rem 5rem 0\.2rem 0\.75rem;/);
  assert.match(block, /\.sphere-rebuild-caption \{[^}]*flex: 0 1 auto;/, "the caption may shrink — it yields before the stage does");
  assert.match(block, /\.sphere-rebuild-caption \{[^}]*min-height: 0;/, "the caption's shrink is not floored");
  assert.match(block, /\.sphere-rebuild-caption \{[^}]*max-height: 44dvh;/, "the caption never takes more than 44% of the screen");
  assert.match(block, /\.sphere-rebuild-caption \{[^}]*overflow-y: auto;/, "what does not fit scrolls inside the caption, whole");
  assert.match(block, /\.sphere-season-line \{\s*font-size: 0\.8rem;/);
  assert.doesNotMatch(block, /-webkit-line-clamp|line-clamp/, "no line clamp cuts a word");
  assert.doesNotMatch(block, /display: none/, "nothing in the caption is hidden away");
});
