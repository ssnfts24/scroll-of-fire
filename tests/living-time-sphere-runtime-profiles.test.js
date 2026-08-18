"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

test("Sphere mount exposes observatory instrument and ambient runtime profiles", () => {
  const code = read(
    "docs/assets/js/sphere/living-time-sphere-mount.js"
  );

  assert.ok(code.includes("RUNTIME_PROFILES"));
  assert.ok(code.includes('observatory: Object.freeze'));
  assert.ok(code.includes('instrument: Object.freeze'));
  assert.ok(code.includes('ambient: Object.freeze'));
  assert.ok(code.includes("resolveRuntimeProfile"));
});

test("ambient runtime is explicitly SVG and low-power by default", () => {
  const code = read(
    "docs/assets/js/sphere/living-time-sphere-mount.js"
  );

  const ambientStart = code.indexOf("ambient: Object.freeze");
  const stateStart = code.indexOf("state: Object.freeze", ambientStart);

  assert.ok(ambientStart >= 0);
  assert.ok(stateStart > ambientStart);

  const ambient = code.slice(ambientStart, stateStart);

  assert.ok(
    ambient.includes('renderer: "svg"'),
    "ambient background must not silently allocate a second WebGL renderer"
  );

  assert.ok(ambient.includes('quality: "lowpower"'));
  assert.ok(ambient.includes("connections: false"));
  assert.ok(ambient.includes("recurrence: false"));
});

test("mount publishes runtime profile identity to the container", () => {
  const code = read(
    "docs/assets/js/sphere/living-time-sphere-mount.js"
  );

  assert.ok(
    code.includes(
      'container.dataset.ltsRuntimeProfile = runtimeProfile.id'
    )
  );
});

test("homepage sphere explicitly uses the instrument profile", () => {
  const code = read(
    "docs/assets/js/home-observatory-instrument.js"
  );

  assert.ok(
    code.includes(
      'runtimeProfile: "instrument"'
    )
  );
});

test("ambient profile retains canonical Pattern and astronomical anchors", () => {
  const code = read(
    "docs/assets/js/sphere/living-time-sphere-mount.js"
  );

  const ambientStart = code.indexOf("ambient: Object.freeze");
  const stateStart = code.indexOf("state: Object.freeze", ambientStart);

  assert.ok(ambientStart >= 0);
  assert.ok(stateStart > ambientStart);

  const ambient = code.slice(ambientStart, stateStart);

  for (const expected of [
    "pattern: true",
    "weekGates: true",
    "lunar: true",
    "solar: true",
    "passage: true",
    "markers: true",
  ]) {
    assert.ok(
      ambient.includes(expected),
      `ambient profile should retain ${expected}`
    );
  }
});
