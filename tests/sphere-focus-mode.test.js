"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const armillary = read("docs/assets/js/sphere-armillary.js");
const appCss = read("docs/assets/css/living-time-sphere-app.css");
const armillaryCss = read("docs/assets/css/sphere-armillary.css");

test("Sphere Focus keeps the five primary actions and routes secondary tools through More", () => {
  const primaryLabels = [
    'aria-hidden="true">◷</span>Today',
    'aria-hidden="true">＋</span>Schedule',
    'aria-hidden="true">▤</span>Day',
    'aria-hidden="true">✧</span>Spark',
    'aria-hidden="true">•••</span>More',
  ];
  for (const label of primaryLabels) {
    assert.ok(armillary.includes(label), `primary action ${label} is present`);
  }
  for (const action of ["cam-top", "cam-tilt", "cam-edge", "rotate", "open-atlas", "open-planner", "open-settings", "fullscreen", "fullpage"]) {
    assert.ok(armillary.includes(`"${action}"`), `secondary action ${action} remains available`);
  }
  assert.match(armillary, /window\.SphereRebuild\.openSchedule/);
  assert.match(armillary, /data-sphere-rebuild-spark/);
});

test("the selected-day readout and its wheel live in Day Details, not over the Sphere", () => {
  assert.match(armillary, /var daySheet = document\.body\.classList\.contains\("sphere-app"\)/);
  assert.match(armillary, /card\.classList\.add\("sphere-day-readout-details"\)/);
  assert.match(armillary, /sheetBar\.after\(card\)/);
  assert.match(armillary, /currentBar\.after\(readout\)/);
  assert.match(armillaryCss, /\.sphere-day-readout-wheel/);
  assert.match(armillaryCss, /\.sphere-day-readout-actions/);
  assert.match(appCss, /sphere-canvas-wrap > \.sphere-day-readout\s*\{\s*display:\s*none/);
  assert.match(appCss, /sphere-sheet \.sphere-day-readout\s*\{\s*position:\s*relative/);
});

test("day-sheet dismissal supports touch, focus containment, close, and browser Escape behavior", () => {
  assert.match(armillary, /sphere-sheet-handle/);
  assert.match(armillary, /event\.clientY - startY > 60/);
  assert.match(armillary, /event\.key !== "Tab"/);
  assert.match(armillary, /closeButton\.click\(\)/);
  assert.match(armillary, /aria-modal", "true"/);
  assert.match(armillary, /sidebar\.removeAttribute\("aria-modal"\)/);
  assert.match(armillary, /sidebar\.setAttribute\("aria-hidden", "true"\)/);
  assert.match(appCss, /body\.sphere-app \.sphere-app-scrim/);
  assert.match(appCss, /prefers-reduced-motion:\s*reduce/);
});

test("the responsive app shell keeps the Sphere central and reserves safe areas", () => {
  assert.match(appCss, /grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(appCss, /height:\s*100dvh/);
  assert.match(appCss, /html\.living-time-sphere-page body\.sphere-app \.sphere-wrapper/);
  assert.match(appCss, /body\.sphere-app \.sphere-sidebar\.sphere-sheet\s*\{\s*max-height:\s*84dvh/);
  assert.match(appCss, /body\.sphere-app \.spark-ember-host\s*\{\s*display:\s*none/);
  assert.match(appCss, /env\(safe-area-inset-bottom/);
  assert.match(appCss, /orientation:\s*landscape/);
  assert.match(appCss, /min-width:\s*900px/);
});

test("the secondary control menu is a native dismissible dialog", () => {
  assert.match(armillary, /document\.createElement\("dialog"\)/);
  assert.match(armillary, /menu\.showModal\(\)/);
  assert.match(armillary, /menu\.querySelector\("\.sphere-focus-more-close"\)/);
  assert.match(appCss, /\.sphere-focus-more::backdrop/);
});

test("Focus mode activates on the initial page load and follows app-mode changes", () => {
  assert.match(armillary, /document\.querySelector\("\.sphere-app-enter"\)\?\.click\(\)/);
  assert.match(armillary, /new MutationObserver\(sync\)\.observe\(document\.body/);
});
