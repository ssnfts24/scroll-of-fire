"use strict";

/* Sphere deepening — Aaron's direction (Nov 18, 2026): Nori on the
 * Sphere as her own overlay layer, a reachable full screen, easier
 * navigation on the full page, and more detail on the page around
 * the instrument.
 *
 * The discipline pinned here: the layer drives the instrument ONLY
 * through the page's public controls (everyday Today button,
 * quick-jump field, mode buttons, app-shell dock actions) and reads
 * the page's own state strip. It never names the sphere engine's
 * internals — no renderer, no mount, no cursor writes — and the
 * protected sphere files keep their bytes (the R1.7 regression
 * suite proves behaviour; this test proves the layer's reach). */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const layer = read("docs/assets/js/sphere-companion-layer.js");
const css = read("docs/assets/css/sphere-deepening.css");
const page = read("docs/living-time-sphere.html");

test("the sphere page loads the companion layer after the presence, and its own stylesheet", () => {
  const presenceAt = page.indexOf("spark-presence.js");
  const layerAt = page.indexOf("sphere-companion-layer.js");
  assert.ok(presenceAt > 0 && layerAt > presenceAt, "layer loads after the presence");
  assert.ok(page.includes("sphere-deepening.css"), "page carries the deepening stylesheet");
  assert.ok(page.includes("spark-companion.css"), "page carries the companion stylesheet");
});

test("the layer drives only the page's public controls", () => {
  for (const id of [
    "sphere-everyday-today",      // the everyday Today button
    "sphere-quick-jump-input",    // the quick-jump field…
    "sphere-quick-jump-submit",   // …and its Go button
    "sphere-mode-pattern",        // the Pattern (whole year) mode button
    "sphere-state-strip",         // the instrument's own readout (read-only mirror)
    "calendar-return-today"       // fallback Today in the workbench
  ]) {
    assert.ok(layer.includes(id), `layer uses the public control ${id}`);
  }
  assert.ok(layer.includes('data-app-action="today"') || layer.includes("data-app-action"), "app-shell dock actions are driven, not rebuilt");
});

test("the layer never reaches into protected sphere internals", () => {
  for (const forbidden of [
    "LivingTimeSphere",          // the engine's mount/global
    "living-time-sphere-renderer",
    "living-time-sphere-day-zoom",
    "living-time-sphere-interaction",
    "SOFTemporalCursor.set",
    "setPosition",
    "selectPatternDay"
  ]) {
    assert.ok(!layer.includes(forbidden), `layer must not reference ${forbidden}`);
  }
  assert.ok(!/\.mount\(/.test(layer), "the layer never mounts the sphere");
});

test("full screen is offered on the stage itself, on the document element", () => {
  assert.ok(layer.includes("requestFullscreen"), "the layer requests fullscreen");
  assert.ok(layer.includes("documentElement"), "fullscreen targets the document so the sheets stay reachable");
  assert.ok(layer.includes("Exit full screen"), "leaving full screen is labelled in plain words");
});

test("the guide bar answers the first-time visitor: where am I, today, a moon, the day, the year", () => {
  for (const label of ["You are looking at", "Today", "Selected day", "Whole year", "Full screen"]) {
    assert.ok(layer.includes(label), `guide bar speaks: ${label}`);
  }
  assert.ok(css.includes(".sphere-guide-bar"), "guide bar is styled");
});

test("Nori's orbit is her own overlay, reduced-motion safe, and yields to her bubble", () => {
  assert.ok(layer.includes("sphere-nori-orbit"), "the orbit element exists");
  assert.ok(layer.includes("prefers-reduced-motion"), "reduced motion is checked before orbiting");
  assert.ok(layer.includes("renderSVG"), "she is drawn from her own seed art");
  assert.ok(css.includes("sphere-nori-orbiting"), "the corner walker rests while she orbits");
});

test("the dock fits a phone: the Full button comes on screen", () => {
  assert.ok(css.includes("max-width: 560px"), "a small-screen dock rule exists");
  assert.ok(css.includes(".sphere-dock-btn"), "dock buttons are tightened, not removed");
});

test("the copy carries no negative absence framing", () => {
  for (const banned of ["you have not", "haven't", "have not", "not yet", "missed", "incomplete"]) {
    assert.ok(!layer.toLowerCase().includes(banned), `layer copy must not say "${banned}"`);
  }
});
