"use strict";

/* The room's warmth — Aaron's direction (Nov 19, 2026): bring the
 * cartoon Sphere's warmth into the real instrument, only where it
 * maps to something the instrument already knows. Pinned here:
 * the daypart comes from the visitor's own clock in the front
 * door's four bands; the Moon's hue comes through the same
 * moonTemperFor the Spark's light borrows, fed by the calendar
 * data's own element; the halo breathes at the Spark's cadence
 * and rests under reduced motion. Overlay files only — the
 * protected instrument is never named. */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const layer = read("docs/assets/js/sphere-companion-layer.js");
const css = read("docs/assets/css/sphere-deepening.css");
const appCss = read("docs/assets/css/living-time-sphere-app.css");

test("the warmth reads the visitor's own clock, in the front door's four bands", () => {
  assert.ok(layer.includes("sphere-warm--"), "the root carries the daypart mark");
  for (const band of ["dawn", "day", "dusk", "night"]) {
    assert.ok(layer.includes(`"${band}"`), `band named: ${band}`);
  }
  assert.ok(layer.includes("getHours()"), "the hour is the visitor's own");
});

test("the Moon's hue comes through the Spark's own temper, from the calendar's data", () => {
  assert.ok(layer.includes("moonTemperFor"), "the same temper the Spark's light borrows");
  assert.ok(layer.includes("PatternCalendarData"), "the Moon's element comes from the calendar data");
  assert.ok(layer.includes("--sphere-moon-hue"), "the hue is handed to the room as one variable");
  assert.ok(layer.includes("parseReadout"), "the Moon is read from the public readout, never the engine");
});

test("the halo breathes at the Spark's cadence and rests in the still face", () => {
  assert.ok(css.includes("sphere-warm-breathe"), "the halo has its breath");
  assert.ok(css.includes("4.6s ease-in-out"), "the cadence is spark-breathe's own 4.6s");
  const still = css.slice(css.lastIndexOf("prefers-reduced-motion"));
  assert.ok(still.includes("sphere-canvas-wrap::before"), "the still face reaches the halo");
  assert.ok(still.includes("animation: none"), "in the still face the halo rests");
  assert.ok(css.includes("pointer-events: none"), "the light never takes a tap");
});

test("the warmth lives in overlay files and keeps the app stage floor", () => {
  assert.ok(css.includes("--warm-glow"), "daypart light is carried as variables");
  assert.ok(css.includes("sphere-warm--night"), "each part of day has its shade");
  assert.ok(appCss.includes("min-height: 200px"), "the app stage floor stands");
  assert.ok(appCss.includes("clamp(300px, 45dvh, 520px)"), "the portrait stage sizing stands");
});
