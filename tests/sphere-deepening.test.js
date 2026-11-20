"use strict";

/* Sphere deepening — Aaron's direction (Nov 18, 2026): Nori on the
 * Sphere as their own overlay layer, a reachable full screen, easier
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

test("the Spark's page presence was RESET (Nov 20, 2026): the orbit and bubble guide left this layer", () => {
  // Aaron's order: a full reset of the Spark layer, built fresh —
  // not patched. The deepening build's orbit + bubble guide are
  // gone from the companion layer; the fresh presence lives in
  // sphere-spark.js, on the Spark core's own pinned derivations,
  // so no keeper's Spark changed. This test now pins the reset.
  assert.ok(!layer.includes("sphere-nori-orbit"), "the old orbit is gone from this layer");
  assert.ok(!layer.includes("buildSphereGuide"), "the old bubble guide is gone from this layer");
  assert.ok(layer.includes("RESET (Nov 20, 2026)"), "the layer names the reset where the presence stood");
  const spark = read("docs/assets/js/sphere-spark.js");
  assert.ok(spark.includes("sphere-spark-orbit"), "the fresh presence carries the orbit");
  assert.ok(spark.includes("prefers-reduced-motion: reduce"), "the fresh presence honours reduced motion");
  assert.ok(spark.includes("renderSVG"), "the Spark is drawn from its own seed art");
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

test("Share this view rides the guide bar, keeper-sent, with compose-door fallbacks", () => {
  assert.ok(layer.includes("Share this view"), "the guide bar offers the share");
  assert.ok(layer.includes("navigator.share"), "the device share sheet is the first door");
  assert.ok(layer.includes("facebook.com/sharer/sharer.php"), "the Facebook compose door");
  assert.ok(layer.includes("twitter.com/intent/tweet"), "the X compose door");
  assert.ok(!layer.includes("connect.facebook.net"), "no Facebook SDK");
  assert.ok(!layer.includes("platform.twitter.com"), "no X widget SDK");
});

test("the share text is composed from the public readout, coordinate first, in the almanac frame", () => {
  assert.ok(layer.includes("parseReadout"), "the readout is parsed, never the engine");
  assert.ok(layer.includes("PatternCalendarData"), "Moon names come from the calendar's own data, where they actually live");
  const start = layer.indexOf("function buildShareText");
  const end = layer.indexOf("function captureStageImage");
  assert.ok(start > 0 && end > start, "the share builder stands before the capture code");
  const builder = layer.slice(start, end);
  assert.ok(builder.includes("Pattern Day"), "the coordinate leads with its Pattern Day");
  assert.ok(builder.includes("Looking at this day on the Living Time Sphere."), "one short line");
  assert.ok(builder.includes("Observe. Breathe. Align. Return."), "the closing ritual");
  assert.ok(builder.includes("#13Moons #LivingTime #CodexOfReality"), "the small hashtag set");
  assert.ok(!builder.includes("—"), "plain punctuation, no em-dashes");
});

test("the picture is an honest capture or a labelled drawn card, never a fake screenshot", () => {
  assert.ok(layer.includes("captureStageImage"), "a true capture is attempted and pixel-checked");
  assert.ok(layer.includes("drawShareCard"), "the drawn card fallback exists");
  assert.ok(layer.includes("not a screenshot"), "the card is labelled as drawn, in plain words");
});

test("clean full screen: the layer marks the root and folds the guide bar to a slim line", () => {
  assert.ok(layer.includes("sgb-fs"), "the root element carries the full-screen mark");
  assert.ok(layer.includes("syncCleanFs"), "one sync keeps the mark honest on every fullscreenchange");
  assert.ok(layer.includes("sgb-bar-slim"), "the guide bar folds while full screen is on");
  assert.ok(layer.includes('data-sgb="guide"'), "a Guide button brings the full bar back on tap");
  assert.ok(layer.includes("toggleGuideBar"), "the Guide button folds and opens the bar");
  assert.ok(css.includes(".sgb-bar-slim"), "the folded bar is styled slim");
  assert.ok(css.includes(".sgb-clean-toggle"), "the Guide button lives only in full screen");
});

test("clean full screen: the chrome steps aside in both views, the instrument fills the stage", () => {
  assert.ok(css.includes("html.sgb-fs body.sphere-app .sphere-app-topbar"), "app top bar steps aside");
  assert.ok(css.includes("html.sgb-fs body.sphere-app .sphere-app-daybar"), "selected-day bar steps aside");
  assert.ok(css.includes("html.sgb-fs body.sphere-app .sphere-app-dock"), "dock steps aside");
  assert.ok(css.includes(".sphere-canvas-wrap > :not(.sphere-instrument-shell)"), "inside the stage column only the instrument rides along");
  assert.ok(css.includes("html.sgb-fs body:not(.sphere-app) .sphere-wrapper"), "the classic wrapper becomes the stage");
  assert.ok(css.includes("html.sgb-fs body:not(.sphere-app) #sphere-container"), "the classic instrument fills its stage");
});

test("clean full screen: touch interaction is switched on through the page's own Interact button", () => {
  assert.ok(layer.includes("sphere-interact-btn"), "the layer drives the public Interact button");
  assert.ok(layer.includes("sphere-interact-end-btn"), "interaction state is read from the public end button");
  assert.ok(layer.includes("sgb-fs-interact-off"), "while interaction stays off, its bar stays in view");
  assert.ok(css.includes("sgb-fs-interact-off"), "the stylesheet carries the carve-out");
});

test("the everyday stage keeps a measured space for the guide bar, so the bar rests under the Sphere", () => {
  assert.ok(layer.includes("fitBarReserve"), "the reserve is fitted, not guessed");
  assert.ok(layer.includes("paddingBottom"), "the stage column carries the reserve");
  assert.ok(layer.includes("ResizeObserver"), "the reserve follows the bar's own height");
});

test("mobile rescue: the guide bar starts slim on portrait phones, so the stage keeps the screen", () => {
  assert.ok(layer.includes("sgb-slim-default"), "the root carries the slim-default mark");
  assert.ok(layer.includes("applySlimDefault"), "one function owns the slim default");
  assert.ok(layer.includes("(max-width: 720px) and (orientation: portrait)"), "the fold is scoped to portrait phones");
  assert.ok(layer.includes("sphere-app"), "the fold applies in the app view, the phone's default");
  assert.ok(css.includes("html.sgb-slim-default .sgb-clean-toggle"), "the Guide button is available in the slim default");
  assert.ok(css.includes("html.sgb-slim-default .sphere-guide-bar.sgb-bar-slim"), "the slim fold is styled outside full screen");
  assert.ok(css.includes("flex-wrap: nowrap"), "the slim line never wraps to a second row");
});

test("mobile rescue: the app stage carries a floor above the renderer's minimum height", () => {
  const appCss = read("docs/assets/css/living-time-sphere-app.css");
  assert.ok(appCss.includes("min-height: 200px"), "the app stage never drops to the 2D-fallback zone");
  assert.ok(appCss.includes("clamp(300px, 45dvh, 520px)"), "on portrait phones the stage is sized to the phone's own height");
  assert.ok(appCss.includes("(max-width: 720px) and (orientation: portrait)"), "the portrait sizing is scoped to portrait phones");
  assert.ok(appCss.includes(".sphere-environment-bridge"), "the environment strip gives its height back as one row");
  assert.ok(appCss.includes(".sphere-interact-bar"), "the Interact bar gives its height back as one row");
});

test("the homepage hint rides the top corner, clear of the Sphere's selected-year card", () => {
  const homeCss = read("docs/assets/css/homepage-sphere.css");
  const start = homeCss.indexOf(".homepage-sphere-hint {");
  assert.ok(start > 0, "the hint is styled by the homepage's own stylesheet");
  const block = homeCss.slice(start, homeCss.indexOf("}", start));
  assert.ok(block.includes("top:"), "the hint sits at the top of the frame");
  assert.ok(!block.includes("bottom:"), "the hint no longer sits where the card anchors");
});
