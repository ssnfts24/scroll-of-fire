"use strict";

/*
 * The sky dome's pure helpers — the projection is the honesty of
 * the layer: a point's place on the dome must be its computed
 * altitude and azimuth, nothing else. Zenith at the centre, the
 * horizon at the rim, below-horizon points outside the rim (the
 * SVG clips them; they are never drawn standing up).
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

function loadLayer() {
  const context = { Intl, Date, URL, console };
  context.globalThis = context;
  context.window = context;
  vm.runInNewContext(read("docs/assets/js/sphere-sky-layer.js"), context);
  return context.CodexSphereSkyLayer;
}

test("projection: zenith is the centre, horizon is the rim", () => {
  const layer = loadLayer();
  const zenith = layer.project(90, 123, 140);
  assert.ok(Math.abs(zenith.x) < 1e-9 && Math.abs(zenith.y) < 1e-9);
  const north = layer.project(0, 0, 140);
  assert.ok(Math.abs(north.x) < 1e-9 && Math.abs(north.y + 140) < 1e-9, "north at the top rim");
  const south = layer.project(0, 180, 140);
  assert.ok(Math.abs(south.y - 140) < 1e-9, "south at the bottom rim");
  // Looking up: east stands to the left, west to the right.
  const east = layer.project(0, 90, 140);
  assert.ok(Math.abs(east.x + 140) < 1e-9, "east at the left rim");
  const west = layer.project(0, 270, 140);
  assert.ok(Math.abs(west.x - 140) < 1e-9, "west at the right rim");
  // Halfway up due south: half the radius, downward.
  const mid = layer.project(45, 180, 140);
  assert.ok(Math.abs(mid.x) < 1e-9 && Math.abs(mid.y - 70) < 1e-9);
  // Below the horizon falls outside the rim — clipped, never stood up.
  const below = layer.project(-10, 180, 140);
  assert.ok(Math.hypot(below.x, below.y) > 140);
});

test("moon disc: the terminator follows the computed illumination", () => {
  const layer = loadLayer();
  const half = layer.moonLitPath(0, 0, 10, 0.5, true);
  assert.ok(half.includes("A 0.10 10"), `half moon terminator is the diameter: ${half}`);
  const crescent = layer.moonLitPath(0, 0, 10, 0.25, true);
  assert.ok(crescent.includes("A 5.00 10"), `crescent terminator rx: ${crescent}`);
  const gibbous = layer.moonLitPath(0, 0, 10, 0.75, false);
  assert.ok(gibbous.includes("A 5.00 10"), `gibbous terminator rx: ${gibbous}`);
});

test("cursor detail: the civil date is read from the canonical coordinate", () => {
  const layer = loadLayer();
  assert.equal(
    layer.civilISOFromCursorDetail({ coordinate: { gregorian: { isoDate: "2026-11-23" } } }),
    "2026-11-23"
  );
  assert.equal(layer.civilISOFromCursorDetail({ civilDate: "2026-07-17" }), "2026-07-17");
  assert.equal(layer.civilISOFromCursorDetail({ civilDate: "not a date" }), null);
  assert.equal(layer.civilISOFromCursorDetail(null), null);
});
