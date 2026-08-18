const fs = require("node:fs");
const test = require("node:test");
const assert = require("node:assert/strict");

const read = path => fs.readFileSync(path, "utf8");

const cursor = read("docs/assets/js/calendar/temporal-cursor-controller.js");
const sphereUi = read("docs/assets/js/sphere/living-time-sphere-ui.js");
const sphereState = read("docs/assets/js/sphere/living-time-sphere-state.js");
const workbench = read("docs/assets/js/sphere/living-time-calendar-workbench.js");
const bridge = read("docs/assets/js/life-atlas/life-atlas-temporal-bridge.js");
const world = read("docs/assets/js/life-atlas/life-atlas-world-model.js");
const builder = read("docs/assets/js/life-atlas/life-atlas-world-builder.js");
const home = read("docs/assets/js/home-living-interface.js");

test("canonical temporal cursor exists", () => {
  assert.match(cursor, /SOFTemporalCursor/);
  assert.match(cursor, /sof:temporal-cursor-change/);
  assert.match(cursor, /sof:temporal-cursor-ready/);
});

test("Sphere consumes canonical cursor", () => {
  assert.match(sphereUi, /SOFTemporalCursor/);
  assert.match(sphereUi, /_applyTemporalCursorToSphere/);
  assert.match(sphereUi, /_wireTemporalCursorBridge/);
});

test("Calendar Workbench uses canonical cursor", () => {
  assert.match(workbench, /SOFTemporalCursor/);
  assert.match(workbench, /_setTemporalCursorDate/);
});

test("Sphere state remains analytical state", () => {
  assert.match(sphereState, /function createState/);
  assert.match(sphereState, /selectedYear/);
});

test("Life Atlas bridge preserves temporal authority", () => {
  assert.match(bridge, /SOFTemporalCursor/);
  assert.match(bridge, /another source of temporal truth/i);
});

test("Life Atlas world model does not replace cursor", () => {
  assert.match(world, /does NOT replace SOFTemporalCursor/i);
});

test("Life Atlas world builder does not duplicate truth", () => {
  assert.match(builder, /never duplicate canonical temporal truth/i);
});

test("homepage remains a temporal projection/controller", () => {
  assert.match(home, /sof:home-temporal-selection/);
  assert.match(home, /returnToday/);
  assert.match(home, /canonical Pattern coordinate system/);
});
