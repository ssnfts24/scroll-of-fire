"use strict";

/*
 * Homepage Live Sphere — the actual Living Time Sphere in the homepage
 * hero (Aaron's direction, Nov 17, 2026): just the sphere, easy
 * controls, the site's own calendar path for today, static-art fallback,
 * and zero edits to the R1.7 protected files.
 *
 * The module under test contains no calendar math: today's coordinate
 * comes from PatternCalendar.fromCivilDate (the same call the entry
 * overlay makes) and every position from the Observatory's own
 * LivingTimeSphereCalendarGeometry, loaded read-only. These tests load
 * the real modules into a VM and prove that wiring, including Aaron's
 * anchor fixtures.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const HTML = read("docs/index.html");
const CSS = read("docs/assets/css/homepage-sphere.css");
const JS = read("docs/assets/js/homepage-sphere.js");

function htmlFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(full));
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

test("homepage sphere assets exist", () => {
  assert.ok(fs.existsSync(path.join(root, "docs/assets/js/homepage-sphere.js")));
  assert.ok(fs.existsSync(path.join(root, "docs/assets/css/homepage-sphere.css")));
});

test("homepage sphere assets are referenced only by the homepage", () => {
  const referencing = htmlFiles(path.join(root, "docs"))
    .filter((file) => fs.readFileSync(file, "utf8").includes("homepage-sphere"))
    .map((file) => path.relative(root, file));
  assert.deepEqual(referencing, ["docs/index.html"]);
});

test("homepage loads the assets after PatternCalendar and the calendar geometry", () => {
  assert.match(HTML, /<link rel="stylesheet" href="assets\/css\/homepage-sphere\.css\?v=[^"]+">/);
  assert.match(HTML, /<script defer src="assets\/js\/homepage-sphere\.js\?v=[^"]+"><\/script>/);
  const calendarAt = HTML.indexOf("assets/js/calendar/pattern-calendar.js");
  const geometryAt = HTML.indexOf("assets/js/sphere/living-time-sphere-calendar-geometry.js");
  const heroAt = HTML.indexOf("assets/js/homepage-sphere.js");
  assert.ok(calendarAt > -1 && heroAt > calendarAt, "homepage-sphere.js must load after pattern-calendar.js");
  assert.ok(geometryAt > -1 && heroAt > geometryAt, "homepage-sphere.js must load after the calendar geometry module");
});

test("hero carries the sphere stage, the static fallback art, and only the easy controls", () => {
  assert.match(HTML, /data-homepage-sphere/);
  assert.match(HTML, /data-hs-stage/);
  assert.match(HTML, /role="img"/);
  assert.match(HTML, /data-hs-fallback/);
  assert.ok(
    HTML.includes("assets/img/home/hero/home-codex-living-system-exact-13-final.webp"),
    "the existing static hero art remains as the fallback"
  );
  assert.match(HTML, /data-hs-toggle[^>]*>Pause rotation</);
  assert.match(HTML, /data-hs-today[^>]*>Today</);
  assert.match(HTML, /href="\.\/living-time-sphere\.html">Enter the Observatory</);
});

test("the guided hero survives: witness line and hero links intact", () => {
  assert.match(HTML, /data-living-witness/);
  assert.match(HTML, /<p class="living-witness-line is-active" data-source="docs\/start\.html">The Scroll does not begin with belief\.<\/p>/);
  for (const href of ["./start.html", "./moons.html", "./ledger.html", "./covenant-caravan.html", "./shop.html"]) {
    assert.ok(HTML.includes(`href="${href}"`), `hero link ${href} must survive`);
  }
});

test("fallbacks are structural: reduced motion, WebGL probe, protected three.js vendored import", () => {
  assert.match(JS, /prefers-reduced-motion: reduce/);
  assert.match(JS, /getContext\("webgl2"\)/);
  assert.match(JS, /assets\/vendor\/three\/three\.module\.min\.js/);
  assert.match(JS, /IntersectionObserver/);
  assert.match(JS, /visibilitychange/);
  assert.match(CSS, /prefers-reduced-motion: reduce/);
  assert.match(CSS, /min-height: 44px/, "controls keep large tap targets");
  // The module drives visibility with the hidden attribute; the site's
  // display rules (hero img display:block, .hs-btn inline-flex) would
  // otherwise override it and leak the fallback art / dead controls.
  assert.match(CSS, /\[data-homepage-sphere\] \[hidden\] \{\s*display: none !important;/);
});

test("the opening view is the Observatory's settled view on phone widths too", () => {
  // The shared camera module trims its "today" distance to 1.9 on
  // phone-width viewports, cropping the disc in the hero frame. The
  // hero therefore hears the mount's renderer reports and, once the
  // 3D renderer is live, eases the camera to the settled framing —
  // distance 2.25, phi 0.78 — the same framing the Today button
  // restores. A first 3D attempt that fell back to the flat SVG face
  // (the page's 3D renderer is a singleton; a slow phone can also
  // time the init out) is retried as the hero re-enters view.
  assert.match(JS, /onRendererChange: onHeroRendererChange/);
  assert.match(JS, /const SETTLED_DISTANCE = 2\.25/);
  assert.match(JS, /const SETTLED_PHI = 0\.78/);
  assert.match(JS, /moveTo\(\{\s*dist: SETTLED_DISTANCE,\s*phi: SETTLED_PHI,/);
  assert.match(JS, /mountHandle\.activate\(\)/);
  assert.match(JS, /const stackPromise = loadSphereStack\(\)/);
});

test("the module carries no calendar math of its own", () => {
  assert.doesNotMatch(JS, /EPOCH_YEAR|epochForYear|Date\.UTC\(2026, 3, 17/);
  assert.match(JS, /PatternCalendar/);
  assert.match(JS, /fromCivilDate/);
  assert.match(JS, /LivingTimeSphereCalendarGeometry/);
  assert.match(JS, /calendarCell/);
});

// ── Behavioural core, against the real calendar + geometry modules ──

function loadCore() {
  const sandbox = {
    console,
    document: { querySelector: () => null },
    window: null
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const files = [
    "docs/assets/js/calendar/pattern-calendar-version.js",
    "docs/assets/js/calendar/pattern-calendar-data.js",
    "docs/assets/js/calendar/pattern-calendar-format.js",
    "docs/assets/js/calendar/pattern-calendar-boundary.js",
    "docs/assets/js/calendar/pattern-calendar.js",
    "docs/assets/js/sphere/living-time-sphere-calendar-geometry.js",
    "docs/assets/js/homepage-sphere.js"
  ];
  for (const rel of files) {
    vm.runInContext(read(rel), sandbox, { filename: rel });
  }
  return sandbox;
}

test("today resolves through PatternCalendar — Aaron's fixtures hold", () => {
  const sandbox = loadCore();
  const core = sandbox.HomepageSphereCore;
  const calendar = sandbox.PatternCalendar;
  assert.ok(core && calendar, "core and PatternCalendar must load");

  const nov17 = core.resolveToday(calendar, new Date("2026-11-17T20:00:00Z"), "America/Los_Angeles");
  assert.equal(nov17.moon, 8);
  assert.equal(nov17.day, 19);
  assert.equal(nov17.dayOfPatternYear, 215);
  assert.equal(core.coordinateText(nov17), "Moon 8 · Day 19 · Pattern Day 215");

  const jul17 = core.resolveToday(calendar, new Date("2026-07-17T19:00:00Z"), "America/Los_Angeles");
  assert.equal(jul17.moon, 4);
  assert.equal(jul17.day, 8);
  assert.equal(jul17.dayOfPatternYear, 92);

  const sep15 = core.resolveToday(calendar, new Date("2026-09-15T19:00:00Z"), "America/Los_Angeles");
  assert.equal(sep15.moon, 6);
  assert.equal(sep15.day, 12);
  assert.equal(sep15.dayOfPatternYear, 152);
});

test("the model is the Observatory's geometry: 364 days, 13 Moons, today in place", () => {
  const sandbox = loadCore();
  const core = sandbox.HomepageSphereCore;
  const geometry = sandbox.LivingTimeSphereCalendarGeometry;
  const summary = core.resolveToday(
    sandbox.PatternCalendar,
    new Date("2026-11-17T20:00:00Z"),
    "America/Los_Angeles"
  );
  const model = core.buildModel(geometry, summary);
  assert.equal(model.days.length, 364);
  assert.equal(model.moons.length, 13);

  // Every day sits exactly where calendarCell puts it, at the
  // Observatory's pattern-ring radius — recomputed independently here.
  for (const d of model.days) {
    const cell = geometry.calendarCell(d.day);
    const radius = 0.7 * cell.radialFactor;
    const rad = ((cell.angle - 90) * Math.PI) / 180;
    assert.ok(Math.abs(d.x - radius * Math.cos(rad)) < 1e-9, `day ${d.day} x`);
    assert.ok(Math.abs(d.z - radius * Math.sin(rad)) < 1e-9, `day ${d.day} z`);
    assert.equal(d.moon, cell.moon);
    assert.equal(d.moonDay, cell.moonDay);
  }

  // Moons ride the identity lane at their sector centres.
  for (const m of model.moons) {
    const address = geometry.moonAddress(m.moon);
    const radius = 0.7 * 0.8;
    const rad = ((address.centerAngle - 90) * Math.PI) / 180;
    assert.ok(Math.abs(m.x - radius * Math.cos(rad)) < 1e-9, `moon ${m.moon} x`);
    assert.ok(Math.abs(m.z - radius * Math.sin(rad)) < 1e-9, `moon ${m.moon} z`);
  }

  assert.equal(model.today.day, 215);
  assert.equal(model.today.moon, 8);
  assert.equal(model.today.moonDay, 19);
  const todayCell = model.days[214];
  assert.equal(model.today.x, todayCell.x);
  assert.equal(model.today.z, todayCell.z);
  assert.ok(model.gate, "the Year Gate seam is present");
});

test("facingRotationY brings a day's position to face the camera (+Z)", () => {
  const sandbox = loadCore();
  const core = sandbox.HomepageSphereCore;
  const geometry = sandbox.LivingTimeSphereCalendarGeometry;
  const model = core.buildModel(geometry, { insideCountedYear: true, dayOfPatternYear: 215, moon: 8, day: 19, patternYear: 2026 });
  const r = core.facingRotationY(model.today.angle);
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  // THREE rotation about Y: x' = x·cosR + z·sinR, z' = −x·sinR + z·cosR.
  const x2 = model.today.x * cos + model.today.z * sin;
  const z2 = -model.today.x * sin + model.today.z * cos;
  assert.ok(Math.abs(x2) < 1e-9, `today should centre on the view axis, got x=${x2}`);
  assert.ok(z2 > 0, "today should sit on the camera side of the sphere");
});

test("marker sizes mirror the Observatory's post-fix slim halo", () => {
  const sandbox = loadCore();
  const c = sandbox.HomepageSphereCore.constants;
  assert.equal(c.TODAY_RADIUS, 0.038);
  assert.equal(c.TODAY_HALO, 0.0513);
  assert.ok(c.TODAY_HALO <= c.TODAY_RADIUS * 1.35, "halo stays under the ringed-planet cap");
  assert.equal(c.MOON_COLORS.length, 13);
});

// ── R1.7 protection ─────────────────────────────────────────────────

test("no R1.7 protected file is touched by this branch", () => {
  const protectedPaths = new Set();
  for (const entry of fs.readdirSync(path.join(root, "docs/assets/js/sphere"))) {
    protectedPaths.add(`docs/assets/js/sphere/${entry}`);
  }
  for (const entry of fs.readdirSync(path.join(root, "docs/assets/js/calendar"))) {
    protectedPaths.add(`docs/assets/js/calendar/${entry}`);
  }
  for (const extra of ["docs/living-time-sphere.html", "docs/service-worker.js", "docs/assets/js/moons-version.js"]) {
    protectedPaths.add(extra);
  }

  const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    .split("\n").filter(Boolean);
  const changed = new Set();
  // The branch was built stacked on PR #95 and refreshed onto main when
  // the stack landed; diff against the first base ref that exists.
  for (const base of ["origin/main", "origin/feature/living-nav-activity"]) {
    try {
      for (const f of git(["diff", "--name-only", `${base}...HEAD`])) changed.add(f);
      break;
    } catch {
      /* ref unavailable in this checkout: try the next base */
    }
  }
  try {
    for (const line of git(["status", "--porcelain"])) changed.add(line.slice(3));
  } catch {
    /* no git available: nothing further can be inspected */
  }
  /*
   * R2 rework declaration (Aaron's direction, Nov 17–18, 2026: the
   * sphere "still needs massive work — give me an entire upgraded
   * working or reworking of it"). The R1.7 manifest's rule is not
   * "never touch" — it is that every protected file a change touches
   * is named and regression-verified. On main, and on any branch that
   * does not declare itself below, the original rule stands: no
   * protected file may change. The R2 branch declares exactly this
   * set; a protected file outside it still fails this test loudly.
   *
   * Combined landing extension (Nov 19, 2026): this branch carries
   * the whole landing wave in one change set, so the declared set
   * also names the day-zoom module (the Sphere day view, PR #140).
   * The sphere page entry covers both the R2 rework and the Sphere
   * deepening's additions (PR #159: two stylesheet links and four
   * script tags on that page, its overlay module living outside the
   * protected directories), and the service-worker entry also
   * covers the equinox tables' precache update (PR #127). Every
   * other protected path still fails this test on sight.
   */
  const r2DeclaredProtected = new Set([
    "docs/assets/js/sphere/living-time-sphere-label-manager.js",
    "docs/assets/js/sphere/living-time-sphere-renderer-3d.js",
    "docs/assets/js/sphere/living-time-sphere-label-placement.js",
    "docs/assets/js/sphere/living-time-sphere-quality-governor.js",
    "docs/assets/js/sphere/living-time-sphere-options.js",
    "docs/assets/js/sphere/living-time-sphere-day-zoom.js",
    "docs/assets/css/living-time-sphere.css",
    "docs/living-time-sphere.html",
    "docs/service-worker.js"
  ]);
  /*
   * The change set declares itself as the R2 rework by carrying the
   * rework's signature file (the options module). Branch names are
   * not used: CI checks pull requests out in a detached HEAD, where
   * no branch name exists. A change set without that file gets the
   * original rule, untouched.
   */
  const carriesR2Rework = changed.has(
    "docs/assets/js/sphere/living-time-sphere-options.js"
  );
  /*
   * Day World declaration (Sphere R3 Wave 1, Nov 19, 2026 — Aaron
   * approved the R3 finishing plan with the Day World first). This
   * change set declares itself the same way, by carrying its
   * signature file (the Day World overlay module), and its declared
   * set names exactly one protected path: the Sphere page, changed
   * by links and tags only — one stylesheet link and three script
   * tags in the neighbourhood PR #159 opened, the module itself
   * living outside the protected directories. Every other protected
   * path still fails this test loudly.
   */
  const dayWorldDeclaredProtected = new Set([
    "docs/living-time-sphere.html"
  ]);
  const carriesDayWorld = changed.has(
    "docs/assets/js/sphere-day-world.js"
  );
  /*
   * Deep Time declaration (Sphere R3 Wave 2, Nov 19, 2026 — Aaron
   * approved the R3 finishing plan; Wave 1, the Day World, set this
   * declaration pattern). This change set declares itself the same
   * way, by carrying its signature file (the Deep Time overlay
   * module), and its declared set names exactly one protected path:
   * the Sphere page, changed by links and tags only — one
   * stylesheet link and two script tags in the neighbourhood
   * PR #159 opened, the module itself living outside the protected
   * directories. Every other protected path still fails this test
   * loudly.
   */
  const deepTimeDeclaredProtected = new Set([
    "docs/living-time-sphere.html"
  ]);
  const carriesDeepTime = changed.has(
    "docs/assets/js/sphere-deep-time.js"
  );
  /*
   * Ambient face declaration (Sphere R3 Wave 3, Nov 20, 2026 — Aaron
   * waived the options round: "Go with what you're closest to — what
   * you're going with in the videos"). This change set declares
   * itself the same way, by carrying its signature file (the Ambient
   * overlay module), and its declared set names exactly one
   * protected path: the Sphere page, changed by links and tags only
   * — one stylesheet link and one script tag in the neighbourhood
   * PR #159 opened, the module itself living outside the protected
   * directories. Every other protected path still fails this test
   * loudly.
   */
  const ambientDeclaredProtected = new Set([
    "docs/living-time-sphere.html"
  ]);
  const carriesAmbient = changed.has(
    "docs/assets/js/sphere-ambient.js"
  );
  /*
   * Sphere Page Rebuild declaration (Nov 20, 2026 — Aaron's orders
   * that night, in sequence: "The sphere as a app needs to be
   * redone. Get rid of it and rework that page"; "Make that sphere
   * work perfect. However you need to"; and the appearance fence
   * LIFTED — "The sphere needs to actually physically change. Like
   * animated it and make it awesome looking like everything else" —
   * with the TRUTH fence standing: the canonical pipeline and
   * PatternCalendar math untouched, selection exact, fixtures
   * proven). This change set declares itself by carrying its
   * signature file (the rebuild shell module, which lives outside
   * the protected directories), and its declared set names exactly
   * the protected paths the rebuild touches, each flagged in the
   * PR in capital terms with regression proof:
   *   - the page (new shell tags, the record-helpers load-order
   *     fix, F9's copy moves, the pronoun comment resolved);
   *   - the renderer (the always-interactive touch fix and the
   *     year-progress arc on the Pattern ring);
   *   - the materials (the warm palette, colours and opacity only);
   *   - the label manager (F3's collision rule for floating cards);
   *   - the camera (F6's mobile framing);
   *   - the options (F5: fit is the default Moon-label mode);
   *   - the UI module (the quick-jump civil-date year fix).
   *   - the temporal coordinate engine (the one-clock seam: its
   *     13-Moons adapter now takes its cycle decomposition from
   *     PatternCalendar, so the leap Deep Time Day reads outside
   *     the count in the published coordinate too).
   * Every other protected path still fails this test loudly.
   */
  const rebuildDeclaredProtected = new Set([
    "docs/living-time-sphere.html",
    "docs/assets/js/sphere/living-time-sphere-renderer-3d.js",
    "docs/assets/js/sphere/living-time-sphere-materials.js",
    "docs/assets/js/sphere/living-time-sphere-label-manager.js",
    "docs/assets/js/sphere/living-time-sphere-camera.js",
    "docs/assets/js/sphere/living-time-sphere-options.js",
    "docs/assets/js/sphere/living-time-sphere-ui.js",
    "docs/assets/js/calendar/temporal-coordinate-engine.js"
  ]);
  const carriesRebuild = changed.has(
    "docs/assets/js/sphere-rebuild.js"
  );
  /*
   * Armillary face declaration (Nov 20, 2026 — Aaron's verdict on
   * the rebuild: "the sphere itself didn't get any design edits it
   * seems", and his word to start the redesign of the Sphere's
   * FACE, under the appearance fence he lifted the night before,
   * with the TRUTH fence standing). This change set declares
   * itself by carrying its signature file (the portrait-handoff
   * module, which lives outside the protected directories), and
   * its declared set names exactly the protected paths the face
   * touches, each flagged in the PR with regression proof:
   *   - the page (the warm portrait still and its two tags);
   *   - the materials (the armillary palette and dimensions —
   *     colours and sizes only, no calendar data);
   *   - the renderer (the dressing build and sync: wooden band,
   *     script rim, cage rings, gearwork, centre globe, Moon
   *     medallions, the room backdrop and warm lights — geometry
   *     dressing only; the picking model, the marker lists, and
   *     every calendar reading are untouched, proven by the
   *     fixtures and the selection A/B in the PR);
   *   - the UI module (the first-load fix only: SVG class names
   *     read truly, and a covered-only surface verdict gets a
   *     settle re-check instead of a teardown).
   * PatternCalendar and the rest of the canonical pipeline are
   * byte-untouched. Every other protected path still fails this
   * test loudly.
   */
  const armillaryDeclaredProtected = new Set([
    "docs/living-time-sphere.html",
    "docs/assets/js/sphere/living-time-sphere-renderer-3d.js",
    "docs/assets/js/sphere/living-time-sphere-materials.js",
    "docs/assets/js/sphere/living-time-sphere-ui.js"
  ]);
  const carriesArmillary = changed.has(
    "docs/assets/js/sphere-armillary.js"
  );
  /*
   * Sphere day-legibility declaration (Nov 22, 2026 — Aaron's
   * phone report and work order: the question card half off his
   * screen, day numbers too small to read or tap, a check under a
   * scheduled day, games that explain themselves). This change
   * set declares itself by carrying its signature file (the
   * Sphere page's Spark layer, which lives outside the protected
   * directories), and its declared set names exactly the three
   * protected paths it touches, each presentation/binding only,
   * each flagged in the PR with regression proof:
   *   - the page (cache-version bumps on five asset tags only);
   *   - the observatory workspace (the question shell is portaled
   *     to <body> while shown and restored when hidden — the fix
   *     for the card the transformed sheet carried off-screen);
   *   - the Life Atlas record extension (the schedule summary
   *     card + leader line now stand for the selected day only;
   *     the day's glyph mark carries the rest).
   * No geometry, camera, motion, selection model, or calendar
   * math changes. Every other protected path still fails this
   * test loudly.
   */
  const spherefixDeclaredProtected = new Set([
    "docs/living-time-sphere.html",
    "docs/assets/js/sphere/living-time-observatory-workspace.js",
    "docs/assets/js/sphere/life-atlas-record-sphere-extension.js"
  ]);
  const carriesSpherefix = changed.has(
    "docs/assets/js/sphere-spark.js"
  );
  /*
   * Tracker-removal declaration (Nov 23, 2026 — Aaron opened the
   * Sphere page for this one change in plain words: "Open the
   * Sphere page for the tracker removal"). This change set declares
   * itself by carrying its signature file (the no-trackers guard
   * test, which lives outside the protected directories), and its
   * declared set names exactly one protected path: the Sphere page,
   * changed by the removal of its hand-rolled Google Analytics
   * loader only — the 16-line <script> block that stood first in
   * its <head>, nothing else on the page. Every other protected
   * path still fails this test loudly.
   */
  const trackerRemovalDeclaredProtected = new Set([
    "docs/living-time-sphere.html"
  ]);
  const carriesTrackerRemoval = changed.has(
    "tests/no-google-analytics.test.js"
  );
  /*
   * Pattern Quests declaration (Nov 23, 2026 — Aaron's go-ahead
   * on the play redesign's build order: the garden completed and
   * the quest frame's rung 1 built over the Sphere's three
   * games). This change set declares itself by carrying its
   * signature file (the quest-frame module, which lives outside
   * the protected directories), and its declared set names
   * exactly one protected path: the Sphere page, changed by
   * links and tags only — one script tag for the quest frame,
   * set between the record helpers and the play room in the
   * neighbourhood PR #159 opened, and cache-version bumps on
   * the play room's script tag and the play stylesheet link.
   * The quest module, the play room, and both garden files live
   * outside the protected directories; no geometry, rendering,
   * camera, motion, selection, label, or calendar file is
   * touched. Every other protected path still fails this test
   * loudly.
   */
  const questsDeclaredProtected = new Set([
    "docs/living-time-sphere.html"
  ]);
  const carriesQuests = changed.has(
    "docs/assets/js/pattern-quests.js"
  );
  /*
   * Sphere deep-fix declaration (Nov 22, 2026 — Aaron's direct
   * order from his phone: facing Moon 13 dead centre, none of its
   * day numbers appeared; "it needs to move and work perfect and
   * professionally"; zooming into a day should open that day's
   * world). This change set declares itself by carrying its
   * signature file (the armillary stylesheet, outside the protected
   * directories, which carries the zoom-stage styling), and its
   * declared set names exactly the protected paths it touches,
   * each flagged in the PR with regression proof:
   *   - the label manager (the faced Moon is exempt from the
   *     context-quieting screen-X aperture, reads at full strength
   *     in the Moon View band, and discloses its whole 4×7 face at
   *     Year View; one per-candidate allocation hoisted out of the
   *     per-pass loop — no label text, no calendar reading, and no
   *     disclosure-window changes);
   *   - the camera (a release glide from the drag's own velocity
   *     and eased wheel zoom — motion feel only; drag, pinch, pan,
   *     transitions, and drift semantics otherwise unchanged);
   *   - the day-zoom module (the staged zoom reveal named for the
   *     Living Sphere Evolution directive — Day Approach, Living
   *     Day, Immersive Day — reading the same one planner record;
   *     the module is extended, not replaced);
   *   - the renderer (ONE measurement corrected: the calendar
   *     disclosure sampled each Moon's "midpoint" from a
   *     column-1 day, which returns the sector's start angle —
   *     half a sector from the centre of the grid the keeper
   *     sees — so a centred Moon could be disclosed as its
   *     neighbour; it now measures the sector-centre angle from
   *     the sector's first and last days. No geometry, picking,
   *     or calendar data changes; the disclosure's window,
   *     half-window, and key are otherwise untouched);
   *   - the page (cache-version bumps on the changed assets only).
   * The calendar truth core (SOFTemporalCursor → PatternCalendar →
   * Canonical Living State) is byte-untouched, proven by the
   * canonical fixtures. Every other protected path still fails
   * this test loudly.
   */
  const deepfixDeclaredProtected = new Set([
    "docs/living-time-sphere.html",
    "docs/assets/js/sphere/living-time-sphere-label-manager.js",
    "docs/assets/js/sphere/living-time-sphere-camera.js",
    "docs/assets/js/sphere/living-time-sphere-day-zoom.js",
    "docs/assets/js/sphere/living-time-sphere-renderer-3d.js"
  ]);
  const carriesDeepfix = changed.has(
    "docs/assets/css/sphere-armillary.css"
  );
  /*
   * Protected-three declaration (Nov 23, 2026 — Aaron opened the
   * protected Sphere files in plain words for exactly three named
   * fixes from his live phone report: "Open the protected Sphere
   * files for these three fixes"). This change set declares itself
   * by carrying its signature file (the protected-three pin test,
   * which lives outside the protected directories), and its
   * declared set names exactly the protected paths it touches:
   *   - the calendar geometry (calendarDisplayCell's presentation
   *     lane defaults only — week 1 a little further out, the week
   *     step wider, so the faced Moon's wedge spreads at the
   *     opening distance; calendarCell and every canonical reading
   *     untouched);
   *   - the renderer (the same two CALENDAR_RAIL presentation
   *     constants, and the label projection cadence keyed to
   *     camera movement instead of a flat 500 ms gate outside
   *     gestures, so the wording stops trailing the Sphere);
   *   - the label manager (the faced Moon's continuous swell with
   *     camera distance — Aaron's calibration: the numbers expand
   *     steadily as you approach, full at the day's entry —
   *     composing under the existing pitch cap; the fit rules and
   *     the selected Moon's name protection untouched);
   *   - the page (cache-version bumps on the three changed assets
   *     only).
   * The canonical angle/selection math does not move. Every other
   * protected path still fails this test loudly.
   */
  const protectedThreeDeclaredProtected = new Set([
    "docs/living-time-sphere.html",
    "docs/assets/js/sphere/living-time-sphere-calendar-geometry.js",
    "docs/assets/js/sphere/living-time-sphere-renderer-3d.js",
    "docs/assets/js/sphere/living-time-sphere-label-manager.js"
  ]);
  const carriesProtectedThree = changed.has(
    "tests/sphere-protected-three-fixes.test.js"
  );
  /*
   * Sphere details declaration (Nov 23, 2026 — Aaron, reviewing
   * the visual sweep's held items: "might as well give me the
   * Sphere details all together. To review all at once in one
   * PR"). This change set declares itself by carrying its
   * signature file (the details pin test, which lives outside
   * the protected directories), and its declared set names
   * exactly the protected paths it touches:
   *   - the renderer (the rim name tags gain a per-frame
   *     keep-whole clamp in screen space, so a tag whose marker
   *     nears the stage's edge stays whole inside the stage —
   *     the anchors, geometry, lanes, and the label cadence do
   *     not move; and the hub plate's third line now carries
   *     the faced day's own archetype text instead of its bare
   *     name, whose Day 25 word "Name" read as template
   *     residue);
   *   - the temporal strata (the year targets' detail line
   *     drops the instrument's internal name "temporal
   *     membrane" for plain words: the same day in that year);
   *   - the page (cache-version bumps on the two changed
   *     assets only).
   * The day spread, the swell ramp, the label cadence, the
   * canonical calendar math, and picking do not move. Every
   * other protected path still fails this test loudly.
   */
  const detailsDeclaredProtected = new Set([
    "docs/living-time-sphere.html",
    "docs/assets/js/sphere/living-time-sphere-renderer-3d.js",
    "docs/assets/js/sphere/living-time-sphere-temporal-strata.js"
  ]);
  const carriesDetails = changed.has(
    "tests/sphere-details-fixes.test.js"
  );
  /*
   * Gate D app-mode declaration (Nov 23, 2026 — PREPARED at
   * Gate D of the Spark. Living Day app rework and held for
   * Aaron's own word before it merges; design v3 §3.2 move 8 /
   * §14 call 4: the Sphere page renders its own true app mode,
   * retiring the framing stylesheet the app shell injects).
   * This change set declares itself by carrying its signature
   * file (the app-mode module, which lives outside the
   * protected directories and is inert without the app-mode
   * flag), and its declared set names exactly one protected
   * path: the Sphere page, changed by exactly three insertions
   * — a small boot script early in the head that sets the
   * sof-app-mode class before first paint in app context only,
   * one stylesheet link after the app stylesheet, and one
   * defer script tag beside the app-shell tag. The app-mode
   * stylesheet and module live outside the protected
   * directories; no geometry, rendering, camera, motion,
   * selection, label, or calendar file is touched, and the
   * page's behaviour on the open web is unchanged (the boot
   * script sets nothing without the app flag). Every other
   * protected path still fails this test loudly.
   */
  const appModeDeclaredProtected = new Set([
    "docs/living-time-sphere.html"
  ]);
  const carriesAppMode = changed.has(
    "docs/assets/js/sphere-app-mode.js"
  );
  /*
   * Mobile stage declaration (Nov 24, 2026 — Aaron's named
   * release of this one piece, Dashboard #57, in his own
   * words: "Release the Sphere stage piece"; the same family
   * as the Gate D app-mode release above, PR #277). This
   * change set declares itself by carrying its signature file
   * (the mobile stage pin test, which lives outside the
   * protected directories), and its declared set names exactly
   * the protected paths it touches:
   *   - the sphere stylesheet (one phone-width block at its
   *     end: under html.sof-mobile-mode — the mark the app-mode
   *     module sets only when it acquired the mode itself on a
   *     phone browser, never in the app — the canvas wrap is
   *     floored at 80dvh, so the instrument shell and the
   *     container, its absolute fills, stand at the app
   *     framing's standard instead of the measured 0.286
   *     share of the usable height);
   *   - the page (the cache-version bump on that one
   *     stylesheet's link, nothing else).
   * No geometry, rendering, camera, motion, selection, label,
   * or calendar file is touched, and the desktop framing and
   * the app framing are unchanged. Every other protected path
   * still fails this test loudly.
   */
  const mobileStageDeclaredProtected = new Set([
    "docs/assets/css/living-time-sphere.css",
    "docs/living-time-sphere.html"
  ]);
  const carriesMobileStage = changed.has(
    "tests/sphere-mobile-stage.test.js"
  );
  for (const file of changed) {
    if (!protectedPaths.has(file)) continue;
    assert.ok(
      (carriesR2Rework && r2DeclaredProtected.has(file)) ||
        (carriesDayWorld && dayWorldDeclaredProtected.has(file)) ||
        (carriesDeepTime && deepTimeDeclaredProtected.has(file)) ||
        (carriesAmbient && ambientDeclaredProtected.has(file)) ||
        (carriesRebuild && rebuildDeclaredProtected.has(file)) ||
        (carriesArmillary && armillaryDeclaredProtected.has(file)) ||
        (carriesSpherefix && spherefixDeclaredProtected.has(file)) ||
        (carriesTrackerRemoval && trackerRemovalDeclaredProtected.has(file)) ||
        (carriesQuests && questsDeclaredProtected.has(file)) ||
        (carriesDeepfix && deepfixDeclaredProtected.has(file)) ||
        (carriesProtectedThree && protectedThreeDeclaredProtected.has(file)) ||
        (carriesDetails && detailsDeclaredProtected.has(file)) ||
        (carriesAppMode && appModeDeclaredProtected.has(file)) ||
        (carriesMobileStage && mobileStageDeclaredProtected.has(file)),
      `R1.7 protected file changed: ${file}`
    );
  }
});
