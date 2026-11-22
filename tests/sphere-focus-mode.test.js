"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const armillary = read("docs/assets/js/sphere-armillary.js");
const rebuild = read("docs/assets/js/sphere-rebuild.js");
const shellCss = read("docs/assets/css/sphere-armillary.css");
const spark = read("docs/assets/js/sphere-spark.js");
const armillaryCss = read("docs/assets/css/sphere-armillary.css");

test("Sphere Rebuild and Armillary own one shell; Focus never re-enters B7.61", () => {
  assert.match(rebuild, /if \(document\.body\.classList\.contains\("sphere-app"\)\)/);
  // The Rebuild shell is authoritative on arrival, and the app
  // view stays a keeper's choice (PR #232 review, Nov 21, 2026):
  // its enter button is relocated into the controls door,
  // never removed and never clicked by the Focus layer.
  assert.match(rebuild, /details\.appendChild\(btn\)/);
  assert.doesNotMatch(rebuild, /btn\.remove\(\)/);
  assert.doesNotMatch(armillary, /initializeFocusMode|buildFocusDock|sphere-app-enter.*\.click/);
  assert.match(armillary, /document\.documentElement\.classList\.add\("armillary-app"\)/);
  assert.match(shellCss, /html\.living-time-sphere-page body:not\(\.sphere-app\) \.sphere-rebuild-dock/);
});

test("the five primary actions are present and secondary doorways stay in More", () => {
  assert.match(rebuild, /data-sphere-rebuild-today>Today/);
  assert.match(rebuild, /data-sphere-rebuild-schedule>Schedule/);
  assert.match(armillary, /data-sphere-rebuild-daydetails/);
  assert.match(rebuild, /data-sphere-rebuild-spark>Your Spark/);
  assert.match(armillary, /moreButton\.textContent = "More"/);
  assert.match(armillary, /\["dayworld", "deeptime", "farm", "freeze"\]/);
  for (const action of ["openDayWorld", "openDeepTime", "openFarm", "freeze", "wake", "openSchedule", "goToday"]) {
    assert.match(rebuild, new RegExp(`function ${action}\\(`), `${action} remains wired`);
  }
  assert.match(armillary, /sphere-more-tools/);
  assert.match(armillary, /dock\.replaceChildren\(/);
});

test("Day Details carries the selected-day readout within the shared rooms panel", () => {
  assert.match(armillary, /id = "sphere-day-details"/);
  assert.match(armillary, /dayDetails\.appendChild\(card\)/);
  assert.match(armillaryCss, /\.sphere-day-details > \.sphere-day-readout/);
  assert.match(armillaryCss, /\.sphere-day-readout-wheel/);
  assert.match(armillaryCss, /\.sphere-day-readout-actions/);
});

test("Spark opens its own visible conversation without routing through Day Details", () => {
  assert.match(rebuild, /sphere:open-rooms/);
  assert.match(armillary, /document\.addEventListener\("sphere:open-rooms"/);
  assert.doesNotMatch(rebuild, /rootEl\.classList\.add\("armillary-rooms-open"\)/);
  assert.match(rebuild, /\$\("\[data-sphere-spark-talk\]", \$\("\.sphere-sidebar"\) \|\| document\)/);
  assert.match(rebuild, /input\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(rebuild, /data-sphere-rebuild-spark[\s\S]{0,800}data-app-action="open-day"/);
  assert.match(spark, /sphere-spark-talk-privacy/);
  assert.match(spark, /sphere-spark-talk-log/);
  assert.match(spark, /SphereSpark/);
});

test("rooms panel supports focus containment, restoration, Escape, backdrop and touch dismissal", () => {
  assert.match(armillary, /className = "sphere-rooms-backdrop"/);
  assert.match(armillary, /event\.key === "Escape"/);
  assert.match(armillary, /event\.key !== "Tab"/);
  assert.match(armillary, /returnFocus\.focus\(\{ preventScroll: true \}\)/);
  assert.match(armillary, /el\.setAttribute\("inert", ""\)/);
  assert.match(armillary, /event\.clientY - startY > 60/);
  assert.match(shellCss, /max-height:\s*min\(84dvh, 60rem\)/);
  assert.match(shellCss, /width:\s*min\(34rem, 44vw\)/);
  assert.match(shellCss, /max-height:\s*none/);
  assert.match(shellCss, /safe-area-inset-bottom/);
  assert.match(shellCss, /orientation:\s*landscape/);
  assert.match(shellCss, /prefers-reduced-motion:\s*reduce/);
});

test("the rooms backdrop stands beside the sheet, never inside it", () => {
  // The sweep keeps the backdrop out of the sheet: inside, it
  // would cover the sheet's own rooms and eat their clicks.
  assert.match(armillary, /el\.classList\.contains\("sphere-rooms-backdrop"\)/);
  assert.match(armillary, /sidebar\.before\(backdrop\)/);
});

test("the same shell switches between Focus and full-page presentation", () => {
  assert.match(armillary, /modeToggle\.addEventListener\("click"/);
  assert.match(armillary, /classList\.toggle\("sphere-full-page"\)/);
  assert.match(shellCss, /sphere-full-page body:not\(\.sphere-app\) main\.sphere-page/);
  assert.match(shellCss, /sphere-full-page body:not\(\.sphere-app\) \.sphere-sidebar/);
});

test("legacy app-shell Focus styles do not participate in this page", () => {
  const legacyCss = read("docs/assets/css/living-time-sphere-app.css");
  assert.doesNotMatch(legacyCss, /sphere-focus-more|body\.sphere-app \.sphere-sidebar\.sphere-sheet/);
});
