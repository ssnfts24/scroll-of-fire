"use strict";

/*
 * The sky panel's place control + the arrival fix (Nov 24, 2026).
 *
 * Aaron's screenshot, twice over: the Observatory guide sheet
 * stood over the Sphere on arrival — "it pops up over top of
 * the sphere. I can't see the sphere" — and the sky panel's
 * no-place sentence named a Set location control that could
 * not be found from where the sentence stands.
 *
 * Measured root of the arrival fault: the caption deck is a
 * flex 0 0 auto slot in a fixed-height frame, and the sky dome
 * (~260px) and the test layers (~165px) had taken seats inside
 * it, growing the caption to ~670px of an 844px phone screen
 * with the stage below the fold. The frame's own law is that
 * everything which is not the stage, the telling line, or the
 * dock rides in the guide sheet as a room — the two panels are
 * the caption's squatters, not its tenants.
 *
 * These tests pin the two repairs:
 *   1. The app-mode module (which owns the phone-width mark)
 *      moves the two panels into the guide sheet as rooms
 *      while the mode stands at phone width, and restores them
 *      to the caption, in order, when it no longer does.
 *      Desktop — no app mode — never moves them.
 *   2. The sky dome seats the page's one location command in
 *      its own panel (set / change / clear against the same
 *      kept place the sidebar writes — no second store), and
 *      the no-place sentence can be quieted for the session
 *      with Not now, leaving a plain Set location button.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const APP_MODE = read("docs/assets/js/sphere-app-mode.js");
const SKY_LAYER = read("docs/assets/js/sphere-sky-layer.js");
const TEST_LAYERS = read("docs/assets/js/sphere-test-layers.js");
const DOME_CSS = read("docs/assets/css/sphere-sky-dome.css");

test("arrival: the app-mode module seats the standing panels in the sheet at phone width", () => {
  assert.ok(APP_MODE.includes("[data-sphere-sky-dome]"),
    "the sky dome is one of the panels that ride");
  assert.ok(APP_MODE.includes("[data-sphere-test-layers]"),
    "the test layers are another");
  assert.ok(APP_MODE.includes(".sphere-story-doors"),
    "and the story doors — they seat themselves in the stage column's flow, " +
    "which inside the fixed frame is the stage's own room");
  assert.ok(APP_MODE.includes("observer.observe(wrapper, { childList: true })"),
    "the doors' seat is watched as well as the caption");
  assert.ok(APP_MODE.includes('document.querySelector(".sphere-sidebar")'),
    "the panels move into the guide sheet");
  assert.ok(APP_MODE.includes('classList.add("sphere-sheet-room")'),
    "they stand in the sheet as rooms, like everything the sweep folds");
  assert.ok(APP_MODE.includes('classList.remove("sphere-sheet-room")'),
    "and the room class comes off when they go home");
});

test("arrival: the move is gated on the app mode standing at phone width", () => {
  assert.ok(APP_MODE.includes('root.classList.contains("sof-app-mode")'),
    "no app mode, no move — the desktop page is untouched");
  assert.ok(APP_MODE.includes("panelMq.matches"),
    "the move holds only inside the max-width 700px line");
  assert.ok(APP_MODE.includes('addEventListener("change", syncPanels)'),
    "crossing the line either way re-seats the panels");
});

test("arrival: late panels are caught — the watcher stands on the caption", () => {
  assert.ok(APP_MODE.includes("new MutationObserver(syncPanels)"),
    "panels loaded late by the companion layer are moved when they land");
  assert.ok(APP_MODE.includes('observe(caption, { childList: true })'),
    "the watch is on the caption's children, where the panels arrive");
});

test("arrival: a relocated panel is never rebuilt in the caption", () => {
  assert.ok(TEST_LAYERS.includes('document.querySelector("[data-sphere-test-layers]")'),
    "the test layers' mount guard looks at the whole page, not only the caption — " +
    "a panel seated in the sheet stands, and no second one is built");
});

test("the dome seats the one location command in its own panel", () => {
  assert.ok(SKY_LAYER.includes("data-sky-place"),
    "the dome carries a place block of its own");
  assert.ok(SKY_LAYER.includes("window.SofLocationCommand.attach(block)"),
    "the block is attached by the page's one location command");
  assert.ok(SKY_LAYER.includes("tryAttachPlaceBlock"),
    "and the seat is retried — the command rides a later load phase than the dome");
  for (const hook of [
    "data-location-use-device", "data-location-search-submit",
    "data-location-coords-submit", "data-location-continue-without",
    "data-location-search-input", "data-location-lat",
    "data-location-lon", "data-location-name", "data-location-state",
  ]) {
    assert.ok(SKY_LAYER.includes(hook), `the command's ${hook} hook stands in the panel`);
  }
});

test("the dome keeps no second place store", () => {
  assert.ok(!SKY_LAYER.includes("sof.environment.activePlace"),
    "the dome never writes the adapter's active-place key itself");
  assert.ok(!SKY_LAYER.includes("sof.environment.places"),
    "the dome never writes the adapter's places key itself");
  assert.ok(SKY_LAYER.includes("SofEnvironmentState?.getEnvironmentState?.()"),
    "the dome still reads the place from the one environment state");
});

test("the no-place sentence can be quieted for the session, and the door stays", () => {
  assert.ok(SKY_LAYER.includes("data-sky-not-now"),
    "the panel offers Not now");
  assert.ok(SKY_LAYER.includes("data-sky-set-open"),
    "and keeps a plain Set location button in the panel");
  assert.ok(SKY_LAYER.includes("sessionStorage"),
    "the quiet is remembered in session storage — this visit, not forever");
  assert.ok(SKY_LAYER.includes("sof.skyPlaceNotice.dismissed"),
    "under its own named key");
  assert.ok(DOME_CSS.includes(".sky-place-quiet"),
    "the quieted state folds the form away in the dome's own sheet");
});

test("the honest sentence still stands, word for word", () => {
  assert.ok(SKY_LAYER.includes(
    "No place is kept on this device, so the sky can't be drawn for where you stand. " +
    "The season and Moon line above needs no place, and stands as computed. " +
    "Set a place with Set location on this page and the sky will draw."),
    "the sentence the control now answers to is unchanged");
});
