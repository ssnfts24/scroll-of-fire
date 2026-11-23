"use strict";

/* The Sphere redesign — the armillary face (Aaron, Nov 20, 2026):
 * "the sphere itself didn't get any design edits it seems", and his
 * word to redesign the Sphere's face after the approved cartoon,
 * under his mapping rule (every cartoon characteristic maps to
 * something real in the instrument, never mere decoration) and the
 * standing TRUTH fence. These tests pin:
 *  - the materials carry the armillary palette and dimensions, and
 *    the element colours are the house hues as hex;
 *  - the renderer builds the dressing from the canonical record
 *    (PatternCalendarData), and no dressing mesh joins a picking
 *    list — selection stays the old face's selection;
 *  - the gear law is a function of the shown Pattern Day only;
 *  - the first-load fix is present in the UI module (SVG class
 *    names read truly; covered-only verdicts re-check, never
 *    teardown);
 *  - the page carries the warm portrait and its handoff, and the
 *    portrait asset exists;
 *  - the guard declaration for this change set exists. */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const page = read("docs/living-time-sphere.html");
const renderer = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
const camera = read("docs/assets/js/sphere/living-time-sphere-camera.js");
const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
const handoff = read("docs/assets/js/sphere-armillary.js");
const shell = read("docs/assets/js/sphere-rebuild.js");
const shellCss = read("docs/assets/css/sphere-armillary.css");
const guard = read("tests/homepage-sphere.test.js");

function loadMaterials() {
  const context = {};
  vm.runInNewContext(read("docs/assets/js/sphere/living-time-sphere-materials.js"), context);
  return context.LivingTimeSphereM;
}

test("materials: the armillary palette and dimensions ride the export", () => {
  const M = loadMaterials();
  assert.ok(M, "LivingTimeSphereM loads");
  for (const key of ["brass", "brassDark", "wood", "woodDark", "parchment", "scriptGlow"]) {
    assert.equal(typeof M.COLORS[key], "number", `COLORS.${key} present`);
  }
  // The element colours are the house hues (spark-companion's
  // MOON_ELEMENT_HUES) stated as hex, so a Moon's face and its
  // Spark agree.
  assert.deepEqual(
    Object.keys(M.ELEMENT_COLORS).sort(),
    ["Aether", "Air", "Earth", "Fire", "Water"]
  );
  const A = M.ARMILLARY;
  assert.ok(A, "ARMILLARY dimensions exported");
  assert.ok(A.bandInner < M.SIZES.patternRing && M.SIZES.patternRing < A.bandOuter,
    "the wooden band straddles the Pattern rail it dresses");
  assert.ok(A.scriptRadius > 0.95 && A.scriptRadius < A.cageRadius,
    "the script rim stands outside the annual markers' orbit and inside the cage");
  assert.equal(A.gearTeeth, 12);
  assert.equal(A.gearLargeTeeth, 16);
});

test("renderer: the dressing is built and synced, from the canonical record", () => {
  assert.ok(renderer.includes("function _buildArmillaryDressing()"), "the dressing builder exists");
  assert.ok(renderer.includes("function _syncArmillaryDressing("), "the dressing sync exists");
  assert.ok(renderer.includes("_buildArmillaryDressing();"), "buildScene builds the dressing");
  assert.ok(renderer.includes("_syncArmillaryDressing();"), "updateScene syncs the dressing");
  // The script band and the Moon faces read the record itself.
  assert.ok(renderer.includes("PatternCalendarData?.moons"), "moon identity comes from PatternCalendarData");
  assert.ok(renderer.includes("dayArchetypes"), "the day's telling comes from the record's archetypes");
  // The held light borrows the shown Moon's tint.
  assert.ok(renderer.includes("MOON_IDENTITY_COLORS[selectedMoon - 1]"), "the lamp tints by the shown Moon");
});

test("renderer: no dressing mesh joins a picking list", () => {
  const start = renderer.indexOf("// ── Armillary face");
  const end = renderer.indexOf("function _buildMoonAnchors");
  assert.ok(start > -1 && end > start, "the armillary section is locatable");
  const section = renderer.slice(start, end);
  for (const list of ["pickableDayMarkers", "pickableMoonMarkers", "pickableYearMarkers", "_pickables"]) {
    assert.ok(!section.includes(`${list}.push`), `the dressing never pushes into ${list}`);
    assert.ok(!section.includes(`${list} =`), `the dressing never assigns ${list}`);
  }
  assert.ok(!section.includes("_registerPickable"), "the dressing registers no pickables");
});

test("renderer: the gear law reads the shown Pattern Day and nothing else", () => {
  assert.ok(renderer.includes("dayOfPatternYear"), "the gear angle derives from the Pattern Day");
  assert.ok(renderer.includes('addEffect("armillary-gearwork"'), "the turning is a bounded tween that removes itself");
  assert.ok(renderer.includes('removeEffect("armillary-gearwork")'), "the tween is removed at rest and when stilled");
});

test("first-load fix: covered-only verdicts re-check instead of tearing down", () => {
  assert.ok(ui.includes("function _isCoveredOnlyFailure("), "the covered-only test exists");
  assert.ok(ui.includes("surface-validation-covered-recheck"), "the init path re-verifies after a settle window");
  assert.ok(ui.includes("surface-covered-tolerated"), "the refresh path tolerates a covered-only verdict");
  assert.ok(ui.includes('getAttribute?.("class")'), "SVG class names are read through the class attribute");
});

test("the page carries the warm portrait and its handoff", () => {
  assert.ok(page.includes("sphere-armillary.css"), "the portrait styles load");
  assert.ok(page.includes("sphere-armillary.js"), "the portrait handoff loads");
  assert.ok(page.includes('data-sphere-portrait'), "the portrait still is in the stage");
  assert.ok(page.includes("assets/img/sphere/sphere-portrait.webp"), "the portrait points at its asset");
  assert.ok(handoff.includes('firstFrame === "rendered"'), "the handoff waits for the first real frame, not a timer");
  const portraitPath = path.join(root, "docs/assets/img/sphere/sphere-portrait.webp");
  assert.ok(fs.existsSync(portraitPath), "the portrait asset exists");
  assert.ok(fs.statSync(portraitPath).size > 10000, "the portrait asset is a real image, not a stub");
});

test("renderer: the hub plate carries the day, and record markers are a display-only API", () => {
  assert.ok(renderer.includes("function _drawArmillaryHubPlate()"), "the hub plate is drawn");
  assert.ok(renderer.includes("PATTERN DAY ${doy} OF 364"), "the hub plate writes the Pattern Day");
  assert.ok(renderer.includes("setRecordMarkers: _setRecordMarkers"), "the renderer exports setRecordMarkers");
  assert.ok(renderer.includes("function _syncArmillaryRecordMarkers()"), "the record gems sync");
});

test("the dock is Aaron's seven doors: Schedule stands where Choose a day stood", () => {
  assert.ok(shell.includes("data-sphere-rebuild-schedule>Schedule<"), "the Schedule door exists");
  assert.ok(shell.includes(">Enter this day<"), "the Enter door carries its plain name");
  assert.ok(!shell.includes("data-sphere-rebuild-choose"), "the old Choose a day door is gone");
  assert.ok(!shell.includes(">Step into this day<"), "the old Enter wording is gone");
  assert.ok(shell.includes("function openSchedule()"), "the schedule path exists");
  assert.ok(shell.includes("__SOF_PENDING_SCHEDULE_DAY__"), "the schedule path hands the planner its day the established way");
  assert.ok(shell.includes("openSchedule,"), "openSchedule is exported for the on-sphere readout");
});

test("the question guard stands for the page's whole life", () => {
  assert.ok(!shell.includes("watcher.disconnect(), 15000"), "the 15-second stand-down is gone");
  assert.ok(shell.includes("sphere-rebuild-obs-resting"), "the resting treatment remains");
});

test("the app shell: the page is the viewport, and everything else lives in the one sheet", () => {
  assert.ok(shellCss.includes("100dvh"), "the viewport lock is in the stylesheet");
  assert.ok(shellCss.includes("overflow: hidden"), "the page cannot scroll");
  assert.ok(shellCss.includes("armillary-rooms-open"), "the rooms sheet has an open state");
  assert.ok(handoff.includes("sphere-technical-door"), "technical material folds behind one door");
  assert.ok(handoff.includes("Technical details"), "the technical door is plainly labeled");
  assert.ok(handoff.includes("sphere-day-readout"), "the on-sphere readout is built");
  assert.ok(handoff.includes("Enter this day"), "the readout carries Enter");
  assert.ok(handoff.includes("Schedule something for this day"), "the readout carries Schedule");
  assert.ok(handoff.includes("setRecordMarkers"), "the page layer feeds record days to the face");
  assert.ok(handoff.includes("upcomingPlans"), "the Spark's alert reads the keeper's plans");
});

test("the guard declaration names this change set", () => {
  assert.ok(guard.includes("Armillary face declaration"), "the declaration block exists");
  assert.ok(guard.includes("armillaryDeclaredProtected"), "the declared set exists");
  assert.ok(guard.includes('"docs/assets/js/sphere-armillary.js"'), "the signature file is the handoff module");
});

/* ── The corrective (Aaron's real phone, Nov 20, 09:11 PST) ────
 * His screenshots showed what the lab had missed: the Sphere
 * squeezed into a band, the Legend box standing on the stage,
 * the page shifting between two scroll offsets, and placeholder
 * dashes framed as data. These tests pin the corrective's
 * mechanisms; the phone-size behaviour itself is proven by the
 * lab's fixed-moment sampling (browser-lab/sphere-corrective-
 * verify.mjs), which asserts without ever waiting for a success
 * state — the earlier lab's waiting was how it missed all four. */

test("corrective: the legend fold searches the whole main, subtree-deep", () => {
  // The first sweep searched only the canvas wrap; the legend's
  // parent is the sphere WRAPPER, so the fold never happened on
  // any device. The sweep now queries main itself and stands
  // guard over its whole subtree.
  assert.ok(handoff.includes('main.querySelector(sel)'), "the chrome sweep queries the whole main");
  assert.ok(handoff.includes('[".sphere-guide-bar", "#sphere-legend"]'), "the sweep names the guide bar and the legend");
  assert.ok(handoff.includes("{ childList: true, subtree: true }"), "the sweep guard watches the subtree");
  // And while either piece is still in the stage's frame, the
  // stylesheet hides it — the surface is clean from first paint.
  assert.ok(shellCss.includes(".sphere-wrapper > #sphere-legend"), "the stylesheet hides the legend while it stands in the wrapper");
  assert.ok(shellCss.includes(".sphere-canvas-wrap .sphere-guide-bar"), "the stylesheet hides the guide bar while it stands in the stage");
});

test("corrective: standing the shell stands the page back at its top", () => {
  assert.ok(handoff.includes("window.scrollTo(0, 0)"), "the shell build returns the page to its top before the lock holds it");
});

test("corrective: the markers carry their names at their places on the face", () => {
  assert.ok(renderer.includes("function _armillaryNameTag("), "the name-tag inker exists");
  assert.ok(renderer.includes("function _syncArmillaryNameTags()"), "the name tags sync with the dressing");
  for (const name of ['"YEAR GATE"', '"MARCH EQUINOX"', '"EQUINOX PASSAGE"']) {
    assert.ok(renderer.includes(name), `the face inks ${name}`);
  }
  assert.ok(renderer.includes("_objects.yearGate?.position"), "the Year Gate tag stands on its live marker");
  assert.ok(renderer.includes("_objects.equinoxGate?.position"), "the equinox tag stands on its live marker");
  assert.ok(renderer.includes("passageStartAngle"), "the passage tag reads the model's canonical passage angles");
  assert.ok(renderer.includes("no tag is drawn"), "when the model carries no passage, no tag is invented");
  assert.ok(renderer.includes("armillaryNameTagGroup.visible = !!_visibleLayers?.pattern"), "the tags rest with the Pattern layer");
});

test("corrective: the sky line is real values or one honest line, never dashes", () => {
  assert.ok(handoff.includes("function adoptSkyline()"), "the page layer adopts the environment strip as the sky line");
  assert.ok(handoff.includes("Live sky data isn't available right now"), "the one honest line is stated plainly");
  assert.ok(handoff.includes('s !== "NOW"'), "only segments carrying real numbers stand as data");
});

test("corrective: the command trigger stays with More instead of competing with the primary dock", () => {
  assert.ok(handoff.includes("function dockCommandTrigger()"), "the trigger is docked by the page layer");
  assert.ok(handoff.includes('document.querySelector(".sphere-more-actions")'), "More owns secondary actions");
  assert.ok(handoff.includes("actions.appendChild(trigger)"), "the command trigger remains available in More");
});

/* ── The desktop-width corrective + polish (Aaron, Nov 20,
 * 11:04–11:09 PST) ─────────────────────────────────────────────
 * Witness's wide-browser verification found what the phone lab
 * could not: at ~1550px the rooms sheet's capped height left a
 * strip painted over the dock (the dock "missing", the page
 * "scrolling"), the camera had no framing floor at wide aspect,
 * and Chapter 4 lived only behind the Day World's step-in.
 * Aaron's polish on the face he likes: days more visible, the
 * environment arriving on its own, the seasons shown. */

test("desktop corrective: the rooms sheet is full-height at every width", () => {
  assert.ok(shellCss.includes("height: 100dvh;"), "the sheet declares the full viewport height");
  assert.ok(shellCss.includes("max-height: none;"), "the workspace sheets' 78vh cap is overridden in the sheet's own rule");
});

test("desktop corrective: the fit floor binds at every aspect and holds during drift", () => {
  assert.ok(!camera.includes("if (!_aspect || _aspect >= 1) return 0;"), "the portrait-only fit is gone");
  assert.ok(camera.includes("Math.min(sinHalfVertical, sinHalfHorizontal)"), "the fit is the nearer of the two fields");
  assert.ok(camera.includes("the fit floor"), "the drift branch names its floor");
  const drift = camera.slice(camera.indexOf("Idle drift (only when no transition"));
  assert.ok(drift.includes("_fitDistance()"), "drift consults the fit");
  assert.ok(drift.includes("if (fit && _dist < fit)"), "drift eases back out to the frame when left inside it");
});

test("desktop corrective: Chapter 4 stands on the Day World's door as well as in its room", () => {
  assert.ok(handoff.includes("function dressDayWorldDoor()"), "the door dressing exists");
  assert.ok(handoff.includes('slot.setAttribute("data-story-entry", "")'), "the entry slot is marked as the door's");
  assert.ok(handoff.includes('slot.setAttribute("data-story-chapter", "through-the-day-door")'), "the entry slot names Chapter 4");
});

test("polish: the days stand stronger — ticks, nodes, markers, numerals", () => {
  assert.ok(renderer.includes('band === "far" ? 0.5 : band === "medium" ? 0.7 : band === "near" ? 0.85 : 0.95'), "the tick opacity ladder is raised at every band");
  assert.ok(renderer.includes("opacity: _isMobileWidth() ? 0.55 : 0.5,"), "the ticks are built stronger");
  assert.ok(renderer.includes("size:        _isMobileWidth() ? 0.032 : 0.026,"), "the day nodes stand larger");
  assert.ok(renderer.includes("new THREE.SphereGeometry(0.03, 8, 8)"), "today's marker stands larger");
  assert.ok(renderer.includes("new THREE.SphereGeometry(0.034, 8, 8)"), "the shown day's marker stands larger");
  // Visibility pass (Nov 22, 2026): the day numerals moved to the
  // band-sized holographic plates — 0.68rem at Moon View, 0.52rem
  // in the far band, 0.74rem near/detail. Every band stays above
  // the old 8px engraving this line first pinned against.
  assert.ok(shellCss.includes('font-size: 0.68rem !important;'), "phone day numerals are no longer 8px");
  assert.ok(shellCss.includes('font-size: 0.52rem !important;'), "the far band keeps its numerals above 8px too");
});

test("polish: the environment is asked for once, on open, through the browser's own flow", () => {
  assert.ok(handoff.includes("function autoEnvironment()"), "the auto-ask exists");
  assert.ok(handoff.includes("adapter.requestDeviceLocation()"), "the ask is the adapter's device-location request");
  assert.ok(handoff.includes("sof.armillary.locationAsked"), "the ask happens once");
  assert.ok(handoff.includes("sof:location-changed"), "a granted place raises the location-changed word");
  assert.ok(handoff.includes("SofEnvironmentAuthority"), "the authority fetches the real providers");
  assert.ok(handoff.includes("__sofSkyLocationRefused"), "a refusal is remembered for the honest line");
  assert.ok(handoff.includes("Location is off, so the live sky line can't fill in."), "the refused line is one plain sentence");
});

test("polish: the seasons show — turns named on the face, the current season in a line", () => {
  for (const name of ['"JUNE SOLSTICE"', '"SEPTEMBER EQUINOX"', '"DECEMBER SOLSTICE"']) {
    assert.ok(renderer.includes(name), `the face inks ${name}`);
  }
  assert.ok(renderer.includes("_positionOnSolarAxis(angle, mat.SIZES.solarAxis)"), "the season tags stand on the solar-axis anchors");
  assert.ok(handoff.includes("SEASON_TURNS"), "the season line's dated table exists");
  assert.ok(handoff.includes("2026-09-23T00:05:00Z"), "the 2026 September Equinox is the USNO instant");
  assert.ok(handoff.includes("2026-12-21T20:50:00Z"), "the 2026 December Solstice is the USNO instant");
  assert.ok(handoff.includes("function seasonLine()"), "the season line is built");
  assert.ok(shellCss.includes(".sphere-season-line"), "the season line is styled");
});
