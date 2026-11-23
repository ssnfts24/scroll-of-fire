"use strict";

/**
 * Website Evolution Phase B prototype — the immersive homepage.
 *
 * Pins the prototype's contract without touching the protected
 * set: the hero reuses the one Observatory mount, ambient mode
 * keeps the stage pointer-transparent, interactive mode is an
 * intentional act with a clean return, and the Observatory door
 * carries the faced day and camera through the Observatory's own
 * URL contract (marker / cam_t / cam_d).
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const HTML = read("docs/index.html");
const CSS = read("docs/assets/css/homepage-sphere.css");
const JS = read("docs/assets/js/homepage-sphere.js");

test("the hero offers an intentional way in and a clean way back", () => {
  assert.match(HTML, /data-hs-activate[^>]*>Explore the Sphere</);
  assert.match(HTML, /data-hs-release[^>]*>Done — back to the page</);
  assert.match(HTML, /data-hs-context/);
  assert.match(HTML, /<a data-hs-door[^>]*href="\.\/living-time-sphere\.html">Enter the Observatory</);
});

test("ambient mode keeps the stage pointer-transparent; interactive hands it back", () => {
  assert.match(
    CSS,
    /\[data-hs-mode="ambient"\] \.homepage-sphere-stage \{\s*pointer-events: none;/
  );
  assert.match(
    CSS,
    /\[data-hs-mode="interactive"\] \.homepage-sphere-stage \{\s*pointer-events: auto;/
  );
});

test("the sphere becomes the hero environment, not a wider card", () => {
  assert.match(CSS, /\.home-hero \[data-homepage-sphere\]\.hero-image-card \{\s*position: absolute;/);
  assert.match(CSS, /width: 100vw;/);
  assert.match(CSS, /\.home-hero \.home-hero-grid \{\s*position: relative;\s*display: block;/);
});

test("the static poster stands whole until the live sphere takes the stage", () => {
  assert.match(
    CSS,
    /:not\(\[data-state="live"\]\)[^{]*\[data-hs-fallback\] \{\s*object-fit: contain;/
  );
});

test("modes are set by the module and Escape returns the room", () => {
  assert.match(JS, /function setSphereMode\(mode\)/);
  assert.match(JS, /setSphereMode\("ambient"\)/);
  assert.match(JS, /setSphereMode\("interactive"\)/);
  assert.match(JS, /event\.key === "Escape"/);
});

test("the door is re-aimed through the Observatory URL contract", () => {
  assert.match(JS, /params\.set\("marker", isToday \? "today" : `day-\$\{day\}`\)/);
  assert.match(JS, /params\.set\("cam_t"/);
  assert.match(JS, /params\.set\("cam_d"/);
  assert.match(JS, /selectedDayFromMount/);
  assert.match(JS, /calendarCell\(day\)/);
});

test("the prototype adds no second sphere renderer", () => {
  assert.match(JS, /LivingTimeSphere\.mount\(\)/);
  // The module never touches a rendering library itself; the only
  // canvas it creates is the pre-existing WebGL availability probe.
  assert.doesNotMatch(JS, /THREE\.|WebGLRenderer/);
});
