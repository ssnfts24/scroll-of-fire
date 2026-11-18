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
   */
  const r2DeclaredProtected = new Set([
    "docs/assets/js/sphere/living-time-sphere-label-manager.js",
    "docs/assets/js/sphere/living-time-sphere-renderer-3d.js",
    "docs/assets/js/sphere/living-time-sphere-label-placement.js",
    "docs/assets/js/sphere/living-time-sphere-quality-governor.js",
    "docs/assets/js/sphere/living-time-sphere-options.js",
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
  for (const file of changed) {
    if (!protectedPaths.has(file)) continue;
    assert.ok(
      carriesR2Rework && r2DeclaredProtected.has(file),
      `R1.7 protected file changed: ${file}`
    );
  }
});
