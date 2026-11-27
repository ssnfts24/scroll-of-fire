"use strict";

/*
 * Sphere deep-fix (Aaron, Nov 22, 2026) — the faced Moon's days.
 *
 * Aaron's report from his phone: facing Moon 13 dead centre in
 * "Find the day", none of its day numbers appeared. The label
 * layer measured out to three strangling rules, all in
 * living-time-sphere-label-manager.js:
 *
 *   1. The screen-X aperture (B7.55) is a window for CONTEXT Moons,
 *      but it also governed the faced Moon: as the keeper zooms
 *      toward a Moon its 4×7 day grid grows wider than the fixed
 *      ±39% window, so the closer the approach, the fewer of the
 *      faced Moon's numbers survive.
 *   2. The far (Year View) skeleton thinned even the faced Moon to
 *      five week anchors, so at the phone's resting distance the
 *      Moon a keeper turned to face showed five numbers.
 *   3. The medium-band (Moon View) softening washed the faced
 *      Moon's numerals toward illegibility over the moving face.
 *
 * The fix: the disclosure-centre Moon is exempt from the aperture,
 * discloses its whole face at Year View, and reads at full
 * strength at Moon View. Neighbours keep every quieting rule —
 * the clutter law stands. The gate half of (2) is proven in
 * living-sphere-b7-60-top-view-label-gating.test.js; this file
 * proves the aperture and the zoom-opacity halves by extracting
 * the real functions with stubbed closure dependencies (the
 * B7.60.1 harness technique), and pins the day-zoom module's
 * staged zoom (Day Approach → Living Day → Immersive Day, named
 * for the Living Sphere Evolution directive).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const labels = fs.readFileSync(
  path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-label-manager.js"),
  "utf8"
);
const dayZoom = require(
  path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-day-zoom.js")
);

function extractFn(source, startMarker, endMarker, depNames, deps) {
  const start = source.indexOf(startMarker);
  assert.ok(start > -1, `start marker present: ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.ok(end > start, `end marker present: ${endMarker}`);
  const chunk = source.slice(start, end);
  const fnName = startMarker.replace(/^const\s+/, "").trim();
  const factory = new Function(...depNames, `${chunk}\nreturn ${fnName};`);
  return factory(...depNames.map((name) => deps[name]));
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function loadAperture(frontMoon) {
  return extractFn(
    labels,
    "const railApertureOpacity",
    "/*\n       * B7.57 — semantic zoom LOD",
    ["frontMoon", "stageRect", "centerX", "clamp"],
    { frontMoon, stageRect: { width: 390 }, centerX: 195, clamp }
  );
}

function loadZoomOpacity(semanticBand, frontMoon) {
  return extractFn(
    labels,
    "const railZoomOpacity",
    "const railLabelVisible",
    ["semanticBand", "frontMoon"],
    { semanticBand, frontMoon }
  );
}

const dayCandidate = (moon, anchorX, extra = {}) => ({
  target: { kind: "pattern-day-number", moon, moonDay: 9, ...extra },
  anchorX
});

test("deep-fix: the faced Moon's numerals never pass through the context aperture", () => {
  const aperture = loadAperture(13);
  // Far outside the ±39% window on either side: a context Moon is
  // fully extinguished there; the faced Moon is untouched by it.
  assert.equal(aperture(dayCandidate(13, -80)), 1);
  assert.equal(aperture(dayCandidate(13, 195)), 1);
  assert.equal(aperture(dayCandidate(13, 470)), 1);
  // Neighbours still answer to the window (the clutter law stands).
  assert.equal(aperture(dayCandidate(12, 470)), 0);
  assert.equal(aperture(dayCandidate(12, 195)), 1);
  // Selected days kept their standing exemption.
  assert.equal(aperture(dayCandidate(4, 470, { selected: true })), 1);
  // A different faced Moon works the same (no Moon is special).
  const aperture7 = loadAperture(7);
  assert.equal(aperture7(dayCandidate(7, 470)), 1);
  assert.equal(aperture7(dayCandidate(13, 470)), 0);
});

test("deep-fix: the faced Moon reads at full strength at Moon View; Year View softening unchanged", () => {
  const medium = loadZoomOpacity("medium", 13);
  assert.equal(medium(dayCandidate(13, 195)), 1);
  assert.equal(medium(dayCandidate(12, 195)), 0.56); // context, unscheduled
  assert.equal(medium(dayCandidate(12, 195, { dayScheduleCount: 1 })), 0.84);
  const far = loadZoomOpacity("far", 13);
  // Year View keeps its honest distance softening even for the
  // faced Moon: disclosed, but quiet — Moon View is where it
  // comes to full strength.
  assert.equal(far(dayCandidate(13, 195)), 0.58);
  assert.equal(far(dayCandidate(13, 195, { dayScheduleCount: 2 })), 0.84);
  const near = loadZoomOpacity("near", 13);
  assert.equal(near(dayCandidate(13, 195)), 1);
});

test("deep-fix: zoom stages follow the Evolution directive's names and hold their boundaries", () => {
  const stage = dayZoom.zoomStageForDistance;
  assert.equal(stage(4.06, "year"), "year"); // the phone's resting distance
  assert.equal(stage(2.55, "year"), "moon"); // Moon View
  assert.equal(stage(1.9, "moon"), "approach"); // Day Approach
  assert.equal(stage(1.45, "approach"), "living"); // Living Day
  assert.equal(stage(1.15, "living"), "immersive"); // Immersive Day
  // Hysteresis: a held deeper stage survives inside its exit band,
  // so resting on a boundary never flutters.
  assert.equal(stage(1.55, "living"), "living");
  assert.equal(stage(1.7, "living"), "approach");
  assert.equal(stage(1.35, "immersive"), "immersive");
  assert.equal(stage(1.5, "immersive"), "living");
  assert.equal(stage(2.1, "approach"), "approach");
  assert.equal(stage(2.2, "approach"), "moon");
  // No reading, no stage.
  assert.equal(stage(NaN, "living"), "year");
  assert.deepEqual(dayZoom.ZOOM_STAGES, ["year", "moon", "approach", "living", "immersive"]);
});

test("deep-fix: the world card carries the same glyphs the face carries", () => {
  const glyph = dayZoom.dayWorldGlyphForEntry;
  assert.equal(glyph({ type: "task" }), "✓");
  assert.equal(glyph({ type: "reminder" }), "⚑");
  assert.equal(glyph({ type: "planting" }), "🌱");
  assert.equal(glyph({ type: "harvest" }), "🌾");
  assert.equal(glyph({ type: "watering" }), "💧");
  assert.equal(glyph({ type: "milestone" }), "★");
  assert.equal(glyph({ practice: true, markerGlyph: "🜚" }), "🜚");
  assert.equal(glyph({ type: "something-new" }), "●");
});

test("deep-fix: the disclosure measures each Moon at its sector centre, not its start edge", () => {
  // The disclosure's old sample (a column-1 day) returns the
  // sector's START angle, because calendarCell(day).angle steps
  // by day-of-week column. Measured against the real geometry:
  // facing the last column of Moon 13 (356.7°) put Moon 1's start
  // (3.3°) closer to the view centre than Moon 13's own start
  // (335.6°) — the disclosure named the neighbour, and the faced
  // Moon went bare (Aaron's phone, Nov 22, 2026). The renderer
  // now averages each sector's first and last day angles the
  // short way around; this test pins that arithmetic against the
  // real geometry module.
  const geometrySource = fs.readFileSync(
    path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-calendar-geometry.js"),
    "utf8"
  );
  const mod = { exports: {} };
  new Function("module", "exports", "globalThis", geometrySource)(mod, mod.exports, globalThis);
  const G = globalThis.LivingTimeSphereCalendarGeometry || mod.exports;

  const startOf = (moon) => Number(G.calendarCell((moon - 1) * 28 + 1).angle);
  const endOf = (moon) => Number(G.calendarCell(moon * 28).angle);
  const centreOf = (moon) => {
    const start = startOf(moon);
    const span = ((endOf(moon) - start + 540) % 360) - 180;
    return (start + span / 2 + 360) % 360;
  };
  const dist = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
  const nearestBy = (facing, measure) => {
    let best = null;
    let bestDist = Infinity;
    for (let m = 1; m <= 13; m++) {
      const d = dist(facing, measure(m));
      if (d < bestDist) { bestDist = d; best = m; }
    }
    return best;
  };

  // Every sector centre sits about half a sector (10.6°) from its
  // start edge — the size of the old bias.
  for (let m = 1; m <= 13; m++) {
    assert.ok(Math.abs(dist(centreOf(m), startOf(m)) - 10.56) < 0.6, `Moon ${m} centre offset`);
  }
  // Facing Moon 13's centre names Moon 13 under the new measure…
  assert.equal(nearestBy(centreOf(13), centreOf), 13);
  // …and facing its last column (356.7°) still names Moon 13,
  // where the old start-edge measure named Moon 1.
  assert.equal(nearestBy(356.7, centreOf), 13);
  assert.equal(nearestBy(356.7, startOf), 1);
  // The renderer carries the corrected measurement.
  const renderer = fs.readFileSync(
    path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-renderer-3d.js"),
    "utf8"
  );
  assert.match(renderer, /DEEP-FIX \(Aaron, Nov 22, 2026\) — the midpoint must be the/);
  assert.match(renderer, /firstCell[\s\S]*?lastCell[\s\S]*?span \/ 2/);
});

test("deep-fix: camera carries a release glide and an eased wheel destination", () => {
  const camera = fs.readFileSync(
    path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-camera.js"),
    "utf8"
  );
  // The glide is the drag's own velocity, friction-decayed in tick,
  // and reduced-motion keepers are exempt.
  assert.match(camera, /_dragSamples/);
  assert.match(camera, /prefers-reduced-motion: reduce/);
  assert.match(camera, /Math\.exp\(-dt \/ 140\)/);
  // The wheel names a destination; tick eases the distance to it.
  assert.match(camera, /_distTarget/);
  assert.match(camera, /Math\.exp\(-dt \/ 110\)/);
  // A fresh touch, a pinch, or a named flight always owns the
  // instrument again (both are cancelled, never fought).
  assert.match(camera, /_glide\s*=\s*null/);
  assert.match(camera, /isAnimating\(\) \{\s*\n\s*return !!_transition \|\| _dragging \|\| !!_glide \|\| _distTarget != null;/);
});

test("deep-fix: the glide actually moves the Sphere — velocity in, friction out", () => {
  // Behavioral: load the real camera module with a stub THREE and
  // a fake clock, drag fast, release, and tick. The Sphere must
  // keep turning after the hand leaves (the old camera stopped
  // dead), the glide must decay to a stop, a slow drag must NOT
  // glide, and a wheel notch must ease the distance rather than
  // teleport it.
  const source = fs.readFileSync(
    path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-camera.js"),
    "utf8"
  );
  let now = 1000;
  const realPerformance = globalThis.performance;
  globalThis.performance = { now: () => now };
  const THREE = {
    PerspectiveCamera: class {
      constructor() { this.position = { set() {} }; }
      lookAt() {}
      updateProjectionMatrix() {}
    }
  };
  try {
    new Function("globalThis", source)(globalThis);
    const Cam = globalThis.LivingTimeSphereCamera;
    Cam.create(THREE, 390, 844);
    Cam.setState({ theta: 0, phi: 0.5, dist: 3.4 });

    // A fast drag: 40px steps every 16ms of fake time.
    Cam.onPointerDown(100, 400);
    for (let i = 1; i <= 6; i++) {
      now += 16;
      Cam.onPointerMove(100 + i * 40, 400);
    }
    const atRelease = Cam.getState().theta;
    Cam.onPointerUp();
    assert.equal(Cam.isAnimating(), true, "the glide keeps the loop alive after release");
    let previous = atRelease;
    let travelled = 0;
    for (let i = 0; i < 40; i++) {
      now += 50;
      Cam.tick(now);
      const theta = Cam.getState().theta;
      travelled += Math.abs(theta - previous);
      previous = theta;
    }
    assert.ok(travelled > 0.15, `the Sphere glides on after release (travelled ${travelled.toFixed(3)} rad)`);
    assert.equal(Cam.isAnimating(), false, "the glide decays to a stop");

    // A slow drag produces no glide at all.
    Cam.setState({ theta: 0, phi: 0.5, dist: 3.4 });
    Cam.onPointerDown(100, 400);
    now += 300;
    Cam.onPointerMove(106, 400);
    now += 300;
    Cam.onPointerUp();
    assert.equal(Cam.isAnimating(), false, "a deliberate slow release does not glide");

    // A wheel notch eases: the distance approaches the destination
    // across ticks instead of arriving in one step.
    Cam.setState({ dist: 3.4 });
    const before = Cam.getState().dist;
    Cam.onWheel({ deltaY: -100 });
    now += 50;
    Cam.tick(now);
    const midway = Cam.getState().dist;
    assert.ok(midway < before && midway > before - 0.5, `the wheel eases toward its destination (midway ${midway.toFixed(3)})`);
    for (let i = 0; i < 30; i++) { now += 50; Cam.tick(now); }
    assert.ok(Math.abs(Cam.getState().dist - (before - 0.5)) < 0.01, "and lands on it");
  } finally {
    globalThis.performance = realPerformance;
    delete globalThis.LivingTimeSphereCamera;
  }
});

test("plate-cap: a day plate may never overlap its neighbours (Aaron, Nov 22, 2026)", () => {
  // Aaron's phone, the visibility pass's own preview: the faced
  // Moon's plates heaped over each other at the opening view. The
  // band ladder sizes plates from the zoom band alone, but the
  // grid's on-screen pitch is set by the stage's aspect and the
  // grid plane's tilt — measured in the lab: 412×915 Moon View
  // served 20.8px plates onto a 20.0px minimum pitch (9
  // intersecting pairs across three Moons); the 390×844 opening
  // served 10.6px chips onto a 9.8px pitch (7 pairs). The law:
  // each plate's diameter is capped at PLATE_PITCH_CAP_FRACTION
  // of its own nearest-neighbour pitch, measured per Moon per
  // layout pass from the label anchors themselves.
  assert.match(labels, /const PLATE_PITCH_CAP_FRACTION = 0\.8;/);
  // The cap pass collects the composed calendar-face day plates
  // and measures nearest neighbours from the anchors. (Repair
  // pass, Nov 22, 2026: the search is global across Moons — the
  // original per-Moon grouping never measured two adjacent
  // Moons' edge days against each other, and Aaron's top-down
  // shot showed grids colliding across Moon borders.)
  assert.match(labels, /plateCapPlates[\s\S]*?plateTarget\.kind !== "pattern-day-number"[\s\S]*?!plateTarget\.calendarFace/);
  assert.match(labels, /for \(const other of plateCapPlates\)/);
  assert.match(labels, /candidate\._plateCapPx = cap;/);
  // Overnight pass (Nov 22, 2026, 23:19 — "the day shrinks when I
  // click on it. The day should grow as I approach it."): the
  // selected day's growth is manager-owned (the stylesheet's
  // standalone `scale` rules were keyed on #sphere-container,
  // which never contains a label, so the growth never rendered
  // while the old cap division shrank the selected day by the
  // phantom factor). The selected day's box is now bounded by its
  // FULL pitch divided by the eased growth in force, so its
  // rendered diameter may use the whole pitch.
  assert.match(labels, /const SELECTED_PITCH_BOUND = 1;/);
  assert.match(labels, /cap = \(nearest \* SELECTED_PITCH_BOUND\) \/ Math\.max\(_growthEased, 1\);/);
  assert.match(labels, /candidate\._platePitchPx = nearest;/);
  // Application: a stale cap is cleared and the natural size
  // re-measured before the capped box is written (no ratchet),
  // the four size properties are written inline !important (the
  // band ladder's sizes are stylesheet !important), and the
  // numeral scales with the plate.
  assert.match(labels, /delete el\.dataset\.plateCapped;[\s\S]*?const plateCap = candidate\._plateCapPx;/);
  assert.match(labels, /el\.style\.setProperty\("min-width", `\$\{cappedW\.toFixed\(1\)\}px`, "important"\)/);
  assert.match(labels, /naturalFont \* \(plateCap \/ natural\)/);

  // The guarantee, swept over synthetic tilted grids (7×4,
  // foreshortened rows — the geometry that heaped): compute caps
  // exactly as the pass does, then no two discs may intersect.
  const fraction = 0.8;
  const capFor = (pts) => pts.map((p, i) => {
    let nn = Infinity;
    for (let j = 0; j < pts.length; j++) {
      if (j === i) continue;
      nn = Math.min(nn, Math.hypot(p.x - pts[j].x, p.y - pts[j].y));
    }
    return fraction * nn;
  });
  for (const [hPitch, vPitch] of [[28, 14], [20, 20], [10, 10], [10.3, 9.8], [44, 19]]) {
    const pts = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 7; col++) {
        pts.push({ x: col * hPitch + row * hPitch * 0.18, y: row * vPitch });
      }
    }
    const caps = capFor(pts);
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        assert.ok(
          (caps[i] + caps[j]) / 2 < d,
          `pitch ${hPitch}x${vPitch}: discs ${i} and ${j} keep clear (caps ${caps[i].toFixed(1)}/${caps[j].toFixed(1)}, distance ${d.toFixed(1)})`
        );
      }
    }
    // And the pre-fix band sizes DID intersect on the measured
    // geometries — the law is what changed, not the grids.
    const bandSize = hPitch === 10.3 ? 10.6 : hPitch === 20 ? 20.8 : 0;
    if (bandSize) {
      let intersects = 0;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) < bandSize - 0.5) intersects++;
        }
      }
      assert.ok(intersects > 0, `pitch ${hPitch}x${vPitch}: the uncapped band size heaped here`);
    }
    // The grown selected day (overnight pass): one disc rendered
    // at the FULL pitch bound (1.0× its own nearest-neighbour
    // distance — box × the 1.55 growth, bounded), the rest at the
    // ordinary 0.8 law. The worst pair sums to 0.5 + 0.4 = 0.9 of
    // its distance, so no two discs may intersect here either.
    const grownCaps = capFor(pts);
    const selIdx = 10;
    let selNN = Infinity;
    for (let j = 0; j < pts.length; j++) {
      if (j === selIdx) continue;
      selNN = Math.min(selNN, Math.hypot(pts[selIdx].x - pts[j].x, pts[selIdx].y - pts[j].y));
    }
    grownCaps[selIdx] = 1.0 * selNN;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        assert.ok(
          (grownCaps[i] + grownCaps[j]) / 2 < d,
          `pitch ${hPitch}x${vPitch}: grown selected disc ${selIdx} and ${j} keep clear (caps ${grownCaps[i].toFixed(1)}/${grownCaps[j].toFixed(1)}, distance ${d.toFixed(1)})`
        );
      }
    }
  }
});

/*
 * Repair pass (Aaron, Nov 22, 2026, 18:12 — "a multitude of
 * things wrong here on mobile now. The days are sticky. They are
 * not coming in and going how they should. Some things cut off
 * and don't display correctly."). The plate law above solved
 * same-Moon stills; these pins cover what it never reached:
 * cross-Moon spacing, graded disclosure at high elevation, the
 * micro-plate pitch floor, per-frame anchor tracking, Moon-pill
 * protection, the Play pill as blocked ground, and the guide
 * bar's place inside the rooms sheet.
 */

require(
  path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-label-manager.js")
);
const repairInternals = globalThis.LivingTimeSphereLabelManager._internals;
const armillaryCss = fs.readFileSync(
  path.join(ROOT, "docs/assets/css/sphere-armillary.css"),
  "utf8"
);

test("repair: cross-Moon neighbours are inside the plate law", () => {
  // Two grids side by side, pitch 20 inside each Moon, but the
  // border pair stands only 12px apart — the geometry of Aaron's
  // top-down shot. Per-Moon caps (0.8 × 20 = 16px discs) collide
  // across the border; the global search caps the border plates
  // at 0.8 × 12 and nothing intersects anywhere.
  const grid = (x0) => {
    const pts = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 7; col++) {
        pts.push({ x: x0 + col * 20, y: row * 20 });
      }
    }
    return pts;
  };
  const all = [...grid(0), ...grid(132)];
  const capGlobal = (pts) => pts.map((p, i) => {
    let nn = Infinity;
    for (let j = 0; j < pts.length; j++) {
      if (j === i) continue;
      nn = Math.min(nn, Math.hypot(p.x - pts[j].x, p.y - pts[j].y));
    }
    return 0.8 * nn;
  });
  const caps = capGlobal(all);
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const d = Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y);
      assert.ok((caps[i] + caps[j]) / 2 < d, `global caps keep discs ${i}/${j} clear`);
    }
  }
  // And the border pair under the old per-Moon rule DID collide:
  assert.ok(0.8 * 20 > 12, "per-Moon caps would have overlapped the 12px border pair");
});

test("repair: graded disclosure — distance grading and the pitch floor", () => {
  const allows = repairInternals.contextDisciplineAllows;
  const base = { centreMoon: 8, selectedMoon: 8, pitch: 30, active: true };
  // Inactive regime: everything passes, exactly as before.
  assert.equal(allows({ ...base, active: false, moon: 3, moonDay: 9 }), true);
  // The faced centre and the selected Moon keep their full grids.
  assert.equal(allows({ ...base, moon: 8, moonDay: 9 }), true);
  assert.equal(allows({ ...base, moon: 5, moonDay: 9, selectedMoon: 5 }), true);
  // Scheduled days always show, at any distance.
  assert.equal(allows({ ...base, moon: 3, moonDay: 9, scheduled: true }), true);
  // Distance ≥ 2: week anchors only.
  assert.equal(allows({ ...base, moon: 3, moonDay: 9 }), false);
  assert.equal(allows({ ...base, moon: 3, moonDay: 7 }), true);
  assert.equal(allows({ ...base, moon: 11, moonDay: 28 }), true);
  // Immediate neighbours: sparse anchors {1, 14, 28} only.
  assert.equal(allows({ ...base, moon: 9, moonDay: 7 }), false);
  assert.equal(allows({ ...base, moon: 9, moonDay: 14 }), true);
  assert.equal(allows({ ...base, moon: 7, moonDay: 1 }), true);
  // Circular distance wraps the year seam.
  assert.equal(repairInternals.circularMoonDistance(13, 1), 1);
  assert.equal(repairInternals.circularMoonDistance(1, 7), 6);
  assert.equal(allows({ ...base, centreMoon: 13, selectedMoon: 2, moon: 1, moonDay: 21 }), false);
  // Pitch floor: a compressed context Moon collapses to week
  // anchors whatever its distance; a healthy pitch does not.
  assert.equal(allows({ ...base, moon: 9, moonDay: 21, pitch: 10 }), true);
  assert.equal(allows({ ...base, moon: 9, moonDay: 22, pitch: 10 }), false);
  assert.equal(allows({ ...base, moon: 9, moonDay: 21, pitch: 30 }), false);
  // The floor never fires on a guess (no pitch measured).
  assert.equal(allows({ ...base, moon: 9, moonDay: 22, pitch: null }), false);
  assert.equal(repairInternals.PLATE_PITCH_FLOOR_PX, 16);
  // The discipline's regimes are the far band and Reveal All —
  // never a raw camera-elevation reading (B7.60.2: a
  // mid-transition composition must not be re-gated by geometry).
  assert.match(labels, /const disciplineActive =\s*semanticBand === "far"\s*\|\| String\(dayLabelMode/);
});

test("repair: graded disclosure — the faced Moon's own pitch floor (Nov 25, 2026)", () => {
  const allows = repairInternals.contextDisciplineAllows;
  const base = { centreMoon: 8, selectedMoon: 8, selectedDay: 27, pitch: 10, active: true };
  // Under the readability floor the faced Moon collapses to its
  // week anchors like any other Moon — the opening-distance pile
  // Aaron photographed on his phone (Nov 22 + Nov 25, 2026).
  assert.equal(allows({ ...base, moon: 8, moonDay: 9 }), false);
  assert.equal(allows({ ...base, moon: 8, moonDay: 7 }), true);
  assert.equal(allows({ ...base, moon: 8, moonDay: 28 }), true);
  // The selected day itself never collapses.
  assert.equal(allows({ ...base, moon: 8, moonDay: 27 }), true);
  // Scheduled days always show, even on the faced Moon under
  // the floor.
  assert.equal(allows({ ...base, moon: 8, moonDay: 9, scheduled: true }), true);
  // At a healthy pitch the faced Moon keeps its full grid,
  // exactly as the discipline always held.
  assert.equal(allows({ ...base, pitch: 30, moon: 8, moonDay: 9 }), true);
  // No pitch measured — the floor never fires on a guess.
  assert.equal(allows({ ...base, pitch: null, moon: 8, moonDay: 9 }), true);
});

test("repair: Moon grid pitches are measured per Moon from the anchors", () => {
  const mk = (moon, x, y) => ({ target: { kind: "pattern-day-number", moon }, anchorX: x, anchorY: y });
  const candidates = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) candidates.push(mk(4, c * 10, r * 10));
  for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) candidates.push(mk(9, 300 + c * 30, r * 30));
  candidates.push(mk(2, 0, 400), mk(2, 9, 400), mk(2, 18, 400));
  const pitches = repairInternals.moonGridPitches(candidates);
  assert.equal(pitches.get(4), 10);
  assert.equal(pitches.get(9), 30);
  assert.equal(pitches.has(2), false, "too few anchors to judge — no entry, no floor");
});

test("repair: labels track their anchors between layout passes", () => {
  // The mechanism: a manager-owned rAF loop re-projects the world
  // anchors the last full pass chose and shifts each label by the
  // anchor's screen delta — transform only.
  assert.match(labels, /function _trackFrame\(\)/);
  assert.match(labels, /requestAnimationFrame\(_trackFrame\)/);
  assert.match(labels, /kind: "plate"[\s\S]*?world: \[target\.worldX, target\.worldY, target\.worldZ\]/);
  // Sizes track too: each plate remembers its pass-time pitch and
  // the loop shrinks (never grows) its scale by the live ratio.
  // (Overnight pass: the pitch is stored directly as
  // _platePitchPx — the cap can no longer stand in for it now
  // that the selected day's cap is measured against its full
  // pitch and its growth.)
  assert.match(labels, /passNN: candidate\._platePitchPx/);
  assert.match(labels, /Math\.min\(1, nn \/ entry\.passNN\)/);
  // The selected day's growth eases in the same loop and its
  // rendered diameter is bounded at live geometry.
  assert.match(labels, /function _easeGrowth\(nowMs\)/);
  assert.match(labels, /renderedBound \/ unit/);
  assert.match(labels, /kind: "pill"/);
  assert.match(labels, /kind: "connector"/);
  // The loop wakes on passes and on signature-unchanged updates,
  // and dispose cancels it.
  assert.match(labels, /_ensureTrackLoop\(\);\n      return true;/);
  assert.match(labels, /cancelAnimationFrame\(_trackRaf\)/);
});

test("repair: Moon pills are protected from plates geometrically", () => {
  assert.match(labels, /pr\.el\.dataset\.pillProtected = "true"/);
  assert.match(labels, /Number\(pr\.target\?\.moon \|\| 0\) === Number\(placed\.moon \|\| 0\)/);
  assert.match(labels, /pr\.target\?\.selected \|\| pr\.target\?\.pinned/);
});

test("overnight pass: the pill guard runs every frame, not at pass cadence", () => {
  // The §8 protection re-ran only when a layout pass ran; between
  // passes a tracked plate could drift onto a tracked pill and
  // stand there for a whole glide (lab: occlusions in 22 of 31
  // frames of a drag flick). The guard lives in the tracking
  // loop and re-checks live geometry each frame.
  assert.match(labels, /In-motion pill guard \(overnight pass/);
  // Sphere lag pass 2 (Nov 26, 2026): the guard's working set
  // is refilled into scratch storage each frame instead of a
  // fresh filter allocation — same entries, same order, same
  // per-frame cadence; only the storage changed.
  assert.match(labels, /const pillEntries = _scratchPills;/);
  assert.match(labels, /entry\.kind === "pill" && entry\.sx != null && entry\.rectW > 0/);
  // Shifts stay inside the pass's own 90px bound and out of
  // blocked ground; the tracking context carries the rects.
  assert.match(labels, /Math\.hypot\(tx, ty\) > 90/);
  assert.match(labels, /blockedRects\n      \};/);
  assert.match(labels, /const blocked = ctx\.blockedRects \|\| \[\];/);
  // Fades hit only non-exempt intruders: never the selected day,
  // never the pill's own Moon's plates.
  assert.match(labels, /if \(g\.entry\.selected\) continue;/);
  assert.match(labels, /if \(g\.moon && pillMoon && g\.moon === pillMoon\) continue;/);
  assert.match(labels, /g\.entry\.guardFade = 0\.1;/);
  // The fade rides the pass opacity and restores it exactly.
  assert.match(labels, /entry\.baseOpacityStr = entry\.el\.style\.opacity \|\| "";/);
  assert.match(labels, /: entry\.baseOpacityStr;/);
  // Pill registrations carry the live-geometry facts the guard
  // measures with.
  assert.match(labels, /rectW: placed\.rect\?\.w \|\| 0/);
  assert.match(labels, /cox: placed\.rect \? \(placed\.rect\.x \+ placed\.rect\.w \/ 2\) - placed\.anchorX : 0/);
  // The selected day is exempt from the pass-pitch shrink ratio:
  // its frame guard is the rendered bound at live pitch.
  assert.match(labels, /if \(entry\.selected\) \{[\s\S]*?entry\.shrink = 1;/);
});

test("repair: the Play pill is blocked ground; the sheet's guide bar stands in flow", () => {
  assert.match(labels, /querySelector\?\.\("\.sphere-play-bar"\)/);
  assert.match(
    armillaryCss,
    /\.sphere-sidebar \.sphere-guide-bar\.sphere-sheet-room \{\s*position: static;/
  );
});

test("repair: denied discipline verdicts leave the rail with a false gate verdict", () => {
  assert.match(labels, /railGateVerdicts\.set\(candidate, false\);\s*dayRailCandidates\.splice\(i, 1\);/);
  assert.match(labels, /const disciplinePitches = moonGridPitches\(semanticCandidates\);/);
});

test("repair: the marks live under the pitch law too (§7 remainder)", () => {
  // Both pseudo-element marks scale by the plate's cap ratio.
  assert.match(armillaryCss, /height: calc\(0\.95rem \* var\(--plate-mark-scale, 1\)\)/);
  assert.match(armillaryCss, /top: calc\(-0\.34rem \* var\(--plate-mark-scale, 1\)\)/);
  // The tucked and suppressed states exist in the stylesheet.
  assert.match(armillaryCss, /\[data-mark-tuck="true"\]::after \{\s*top: auto !important;/);
  assert.match(armillaryCss, /\[data-mark-chip="off"\]::after \{\s*display: none !important;/);
  assert.match(armillaryCss, /\[data-mark-badge="off"\]::before \{\s*display: none !important;/);
  // The manager decides per plate from its own disc, natural
  // size, and pitch, and writes the scale as the cap ratio.
  assert.match(labels, /el\.style\.setProperty\("--plate-mark-scale", markScale\.toFixed\(3\)\)/);
  assert.match(labels, /const markScale = discPx \/ naturalPx;/);
  assert.match(labels, /el\.dataset\.markTuck = "true";/);
  assert.match(labels, /el\.dataset\.markChip = "off";/);
  assert.match(labels, /el\.dataset\.markBadge = "off";/);
  // The scheduled exemption reads the normalized field.
  assert.match(labels, /scheduled: Boolean\(candidate\.target\.dayScheduleCount > 0/);
});

test("landing: the membrane inspector is clamped to the stage's room (§10 fit rule)", () => {
  const ui = fs.readFileSync(
    path.join(ROOT, "docs/assets/js/sphere/living-time-sphere-ui.js"),
    "utf8"
  );
  // The clamp lives in the inspector's own sync, reads the stage's
  // rect, and caps the inspector's inline max-width at the room to
  // the stage's right edge; it releases when the inspector fits.
  assert.match(ui, /Fit rule \(Aaron, Nov 23, 2026/);
  assert.match(ui, /"sphere-strata-year-inspector"/);
  assert.match(ui, /"sphere-container"/);
  assert.match(ui, /const room =\s*stageRect\.right - rect\.left;/);
  assert.match(ui, /inspector\.style\.maxWidth =\s*`\$\{Math\.floor\(room\)\}px`;/);
  assert.match(ui, /inspector\.style\.maxWidth = "";/);
});

test("landing: fit governs Moon names by default at stage widths of 320px or less", () => {
  // The R2 post-pass condition is the fit-by-default rule: fit when
  // the keeper chose it, or at ≤320px unless the keeper explicitly
  // chose "always".
  assert.match(
    labels,
    /const fitGoverns =\s*keeperLabelMode === "fit"\s*\|\| \(stageRect\.width <= 320 && keeperLabelMode !== "always"\);/
  );
  assert.match(labels, /fitGoverns\s*&& globalThis\.LivingTimeSphereLabelPlacement/);
  // Crossing the 320px line re-places: the narrow flag rides the
  // placement-identity signature.
  assert.match(labels, /stageRect\.width <= 320 \? "fit-default-narrow" : "wide"/);
  // The frame guard completes the rule between passes: a pair
  // still standing after every shift hides its lower-standing
  // name at ≤320px — never the selected Moon's, never under an
  // explicit "always".
  assert.match(labels, /Narrow fit default \(Aaron, Nov 23, 2026/);
  assert.match(labels, /if \(stageW <= 320\) \{/);
  assert.match(labels, /victim\.guardHidden = true;/);
  assert.match(labels, /if \(a\.guardHidden \|\| b\.guardHidden\) continue;/);
  // The guard knows the standing facts because the pill
  // registration now carries them.
  assert.match(labels, /moon: placed\.moon,\s*selected: Boolean\(placed\.selected\),\s*priority: placed\.priority \|\| 0,/);
});
