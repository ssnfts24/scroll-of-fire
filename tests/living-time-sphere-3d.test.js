"use strict";

const assert = require("node:assert/strict");
const fs     = require("node:fs");
const path   = require("node:path");
const test   = require("node:test");
const vm     = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

// ── Shared context builder ────────────────────────────────────────────

function loadSphereContext() {
  const context = {
    Intl,
    Date,
    URL,
    console,
    performance: { now: () => Date.now() },
    requestAnimationFrame: () => {},
    cancelAnimationFrame:  () => {},
    devicePixelRatio: 1,
    location: {
      href:     "https://codexofreality.org/living-time-sphere.html",
      hostname: "codexofreality.org",
      origin:   "https://codexofreality.org",
      pathname: "/living-time-sphere.html"
    },
    navigator: { deviceMemory: 4 },
    window: null,
    sessionStorage: {
      _store: {},
      getItem(k)    { return this._store[k] ?? null; },
      setItem(k, v) { this._store[k] = String(v); },
      removeItem(k) { delete this._store[k]; },
    },
    localStorage: {
      _store: {},
      getItem(k)    { return this._store[k] ?? null; },
      setItem(k, v) { this._store[k] = String(v); },
      removeItem(k) { delete this._store[k]; },
    },
    IntersectionObserver: null,  // not available in Node
    ResizeObserver:       null,
    document: null,
  };
  context.globalThis = context;
  context.window     = context;

  const scripts = [
    "docs/assets/js/calendar/pattern-calendar-version.js",
    "docs/assets/js/calendar/pattern-calendar-data.js",
    "docs/assets/js/calendar/pattern-calendar-format.js",
    "docs/assets/js/calendar/pattern-calendar-boundary.js",
    "docs/assets/js/calendar/pattern-calendar.js",
    "docs/assets/js/astronomy/astronomy-version.js",
    "docs/assets/js/astronomy/astronomy-sources.js",
    "docs/assets/js/astronomy/timezone-tools.js",
    "docs/assets/js/astronomy/equinox-reference-data.js",
    "docs/assets/js/astronomy/lunar-at-equinox.js",
    "docs/assets/js/astronomy/equinox-engine.js",
    "docs/assets/js/equinox/equinox-passage-format.js",
    "docs/assets/js/equinox/equinox-passage-engine.js",
    "docs/assets/js/equinox/equinox-passage-data.js",
    "docs/assets/js/alignment/alignment-version.js",
    "docs/assets/js/alignment/alignment-ledger-engine.js",
    "docs/assets/js/alignment/alignment-ledger-data.js",
    "docs/assets/js/alignment/alignment-comparison.js",
    "docs/assets/js/alignment/alignment-recurrence.js",
    "docs/assets/js/alignment/alignment-offsets.js",
    "docs/assets/js/alignment/alignment-signature.js",
    "docs/assets/js/alignment/alignment-export.js",
    "docs/assets/js/alignment/alignment-url-state.js",
    "docs/assets/js/sphere/living-time-sphere-version.js",
    "docs/assets/js/sphere/living-time-sphere-state.js",
    "docs/assets/js/sphere/living-time-sphere-model.js",
    "docs/assets/js/sphere/living-time-sphere-layout.js",
    "docs/assets/js/sphere/living-time-sphere-connections.js",
    "docs/assets/js/sphere/living-time-sphere-renderer-svg.js",
    "docs/assets/js/sphere/living-time-sphere-accessibility.js",
    "docs/assets/js/sphere/living-time-sphere-export.js",
    "docs/assets/js/sphere/living-time-sphere-url-state.js",
    "docs/assets/js/sphere/living-time-sphere-materials.js",
    "docs/assets/js/sphere/living-time-sphere-camera.js",
    "docs/assets/js/sphere/living-time-sphere-animation.js",
    "docs/assets/js/sphere/living-time-sphere-effects.js",
    "docs/assets/js/sphere/living-time-sphere-live-data.js",
    "docs/assets/js/sphere/living-time-sphere-mount.js",
    "docs/assets/js/sphere/living-time-sphere-today.js",
  ];

  for (const rel of scripts) {
    const code = read(rel);
    vm.runInNewContext(code, context);
  }
  return context;
}

// ── WebGL detection ───────────────────────────────────────────────────

test("LivingTimeSphereEffects: detectWebGl returns boolean", () => {
  const ctx = loadSphereContext();
  // In Node.js there is no WebGL; should return false gracefully
  const result = ctx.LivingTimeSphereEffects.detectWebGl();
  assert.equal(typeof result, "boolean");
  assert.equal(result, false, "WebGL should not be available in Node test runner");
});

// ── Fallback to SVG guard ─────────────────────────────────────────────

test("LivingTimeSphereEffects: detectWebGl false implies SVG fallback needed", () => {
  const ctx = loadSphereContext();
  const webglAvailable = ctx.LivingTimeSphereEffects.detectWebGl();
  // When WebGL is unavailable, resolveAutoPreset returns a non-3D preset
  const preset = ctx.LivingTimeSphereM.resolveAutoPreset({ webglAvailable });
  // Even in fallback mode, a preset object is returned (balanced/lowpower)
  assert.ok(preset !== null);
  assert.ok(typeof preset.antialias === "boolean");
});

// ── Materials module ──────────────────────────────────────────────────

test("LivingTimeSphereM: COLORS has required keys", () => {
  const ctx = loadSphereContext();
  const c   = ctx.LivingTimeSphereM.COLORS;
  assert.ok(c.bg        !== undefined, "bg");
  assert.ok(c.equinox   !== undefined, "equinox");
  assert.ok(c.yearGate  !== undefined, "yearGate");
  assert.ok(c.passage   !== undefined, "passage");
  assert.ok(c.lunar     !== undefined, "lunar");
});

test("LivingTimeSphereM: SIZES.sphereRadius is 1.0", () => {
  const ctx = loadSphereContext();
  assert.equal(ctx.LivingTimeSphereM.SIZES.sphereRadius, 1.0);
});

test("LivingTimeSphereM: QUALITY_PRESETS has all named presets", () => {
  const ctx = loadSphereContext();
  const qp  = ctx.LivingTimeSphereM.QUALITY_PRESETS;
  assert.ok(qp.auto      !== undefined, "auto");
  assert.ok(qp.high      !== undefined, "high");
  assert.ok(qp.balanced  !== undefined, "balanced");
  assert.ok(qp.lowpower  !== undefined, "lowpower");
  assert.equal(qp.svgonly, null, "svgonly should be null sentinel");
});

test("LivingTimeSphereM: resolveAutoPreset returns lowpower for narrow screens", () => {
  const ctx = loadSphereContext();
  const p   = ctx.LivingTimeSphereM.resolveAutoPreset({ screenWidth: 320, deviceMemoryGb: 1, webglAvailable: true });
  assert.equal(p.idleDrift, false, "low-power mode should disable idle drift");
});

test("LivingTimeSphereM: resolveAutoPreset returns balanced/lowpower under reduced motion", () => {
  const ctx = loadSphereContext();
  const p   = ctx.LivingTimeSphereM.resolveAutoPreset({ reducedMotion: true, webglAvailable: true });
  // Reduced motion should not select the full high preset
  assert.equal(p.breathing, false, "reduced motion should disable breathing");
  assert.equal(p.idleDrift, false, "reduced motion should disable idle drift");
});

test("LivingTimeSphereM: STAR_POSITIONS has 900 floats (300 stars × 3)", () => {
  const ctx = loadSphereContext();
  assert.equal(ctx.LivingTimeSphereM.STAR_POSITIONS.length, 900);
});

// ── Camera module ─────────────────────────────────────────────────────

test("LivingTimeSphereCamera: MIN_ZOOM and MAX_ZOOM are reasonable", () => {
  const ctx = loadSphereContext();
  const cam = ctx.LivingTimeSphereCamera;
  assert.ok(cam.MIN_ZOOM >= 1.0,  "MIN_ZOOM should be at least 1");
  assert.ok(cam.MAX_ZOOM <= 12.0, "MAX_ZOOM should be at most 12");
  assert.ok(cam.MIN_ZOOM < cam.MAX_ZOOM, "MIN < MAX");
});

test("LivingTimeSphereCamera: MODE_POSITIONS has all view modes", () => {
  const ctx = loadSphereContext();
  const mp  = ctx.LivingTimeSphereCamera.MODE_POSITIONS;
  assert.ok(mp.today,   "today");
  assert.ok(mp.passage, "passage");
  assert.ok(mp.years,   "years");
  assert.ok(mp.pattern, "pattern");
  assert.ok(mp.default, "default");
});

test("LivingTimeSphereCamera: mode distances are within zoom bounds", () => {
  const ctx = loadSphereContext();
  const cam = ctx.LivingTimeSphereCamera;
  for (const [name, pos] of Object.entries(cam.MODE_POSITIONS)) {
    assert.ok(pos.distance >= cam.MIN_ZOOM, `${name} distance ${pos.distance} < MIN_ZOOM`);
    assert.ok(pos.distance <= cam.MAX_ZOOM, `${name} distance ${pos.distance} > MAX_ZOOM`);
  }
});

test("LivingTimeSphereCamera: getState returns expected keys", () => {
  const ctx = loadSphereContext();
  const s   = ctx.LivingTimeSphereCamera.getState();
  assert.ok("dist"         in s, "dist");
  assert.ok("phi"          in s, "phi");
  assert.ok("theta"        in s, "theta");
  assert.ok("driftEnabled" in s, "driftEnabled");
});

test("LivingTimeSphereCamera: isDragging false initially", () => {
  const ctx = loadSphereContext();
  assert.equal(ctx.LivingTimeSphereCamera.isDragging(), false);
});

test("LivingTimeSphereCamera: isDrifting false initially", () => {
  const ctx = loadSphereContext();
  assert.equal(ctx.LivingTimeSphereCamera.isDrifting(), false);
});

// ── Animation module ──────────────────────────────────────────────────

test("LivingTimeSphereAnimation: breathValue returns 0–1", () => {
  const ctx = loadSphereContext();
  const v   = ctx.LivingTimeSphereAnimation.breathValue();
  assert.ok(v >= 0 && v <= 1, `breathValue ${v} out of range`);
});

test("LivingTimeSphereAnimation: flowValue returns 0–1", () => {
  const ctx = loadSphereContext();
  const v   = ctx.LivingTimeSphereAnimation.flowValue();
  assert.ok(v >= 0 && v <= 1, `flowValue ${v} out of range`);
});

test("LivingTimeSphereAnimation: reduced motion disables drift and breathing", () => {
  const ctx = loadSphereContext();
  const anim = ctx.LivingTimeSphereAnimation;
  anim.setReducedMotion(true);
  anim.applyPreset(ctx.LivingTimeSphereM.QUALITY_PRESETS.high);
  // After applying reduced motion, drift should be off regardless of preset
  assert.equal(ctx.LivingTimeSphereCamera.isDrifting(), false);
});

test("LivingTimeSphereAnimation: low-power mode disables idle drift", () => {
  const ctx = loadSphereContext();
  const anim = ctx.LivingTimeSphereAnimation;
  anim.setLowPower(true);
  anim.applyPreset(ctx.LivingTimeSphereM.QUALITY_PRESETS.high);
  assert.equal(ctx.LivingTimeSphereCamera.isDrifting(), false);
});

test("LivingTimeSphereAnimation: intro dismissal persists in localStorage", () => {
  const ctx = loadSphereContext();
  assert.equal(ctx.LivingTimeSphereAnimation.isIntroDismissed(), false);
  ctx.LivingTimeSphereAnimation.dismissIntro();
  assert.equal(ctx.LivingTimeSphereAnimation.isIntroDismissed(), true);
  assert.equal(ctx.localStorage.getItem("lts-intro-dismissed"), "1");
  ctx.LivingTimeSphereAnimation.resetIntroForSession();
  assert.equal(ctx.LivingTimeSphereAnimation.isIntroDismissed(), false);
  assert.equal(ctx.localStorage.getItem("lts-intro-dismissed"), null);
});

// ── Effects module ────────────────────────────────────────────────────

test("LivingTimeSphereEffects: witnessLayer is disabled stub", () => {
  const ctx = loadSphereContext();
  const wl  = ctx.LivingTimeSphereEffects.witnessLayer;
  assert.equal(wl.enabled,            false);
  assert.equal(wl.source,             "local-only");
  assert.equal(wl.witnessPoints.length, 0, "witnessPoints must be empty in Phase 03");
});

test("LivingTimeSphereEffects: personalSealStub is disabled", () => {
  const ctx = loadSphereContext();
  const ps  = ctx.LivingTimeSphereEffects.personalSealStub;
  assert.equal(ps.enabled,            false);
  assert.equal(ps.personalSealMarker, null);
  assert.equal(ps.privacy,            "local-only");
});

test("LivingTimeSphereEffects: soundLayer is disabled and muted by default", () => {
  const ctx = loadSphereContext();
  const sl  = ctx.LivingTimeSphereEffects.soundLayer;
  assert.equal(sl.enabled, false);
  assert.equal(sl.muted,   true);
});

// ── URL state — Phase 03 additions ────────────────────────────────────

test("LivingTimeSphereUrlState: valid renderer values round-trip", () => {
  const ctx = loadSphereContext();
  for (const r of ["3d", "svg", "table", "text"]) {
    const url    = ctx.LivingTimeSphereUrlState.buildSphereUrl({ renderer: r });
    const parsed = ctx.LivingTimeSphereUrlState.parseSphereUrl(url);
    assert.equal(parsed.renderer, r, `renderer=${r} should round-trip`);
  }
});

test("LivingTimeSphereUrlState: invalid renderer rejected", () => {
  const ctx    = loadSphereContext();
  const parsed = ctx.LivingTimeSphereUrlState.parseSphereUrl("https://x.com/?renderer=hackmode");
  assert.equal(parsed.renderer, null);
});

test("LivingTimeSphereUrlState: valid quality values round-trip", () => {
  const ctx = loadSphereContext();
  for (const q of ["auto", "high", "balanced", "lowpower", "svgonly"]) {
    const url    = ctx.LivingTimeSphereUrlState.buildSphereUrl({ quality: q });
    const parsed = ctx.LivingTimeSphereUrlState.parseSphereUrl(url);
    assert.equal(parsed.quality, q, `quality=${q} should round-trip`);
  }
});

test("LivingTimeSphereUrlState: invalid quality rejected", () => {
  const ctx    = loadSphereContext();
  const parsed = ctx.LivingTimeSphereUrlState.parseSphereUrl("https://x.com/?quality=ultra");
  assert.equal(parsed.quality, null);
});

test("LivingTimeSphereUrlState: valid camera theta round-trips", () => {
  const ctx    = loadSphereContext();
  const url    = ctx.LivingTimeSphereUrlState.buildSphereUrl({ cameraTheta: 1.234 });
  const parsed = ctx.LivingTimeSphereUrlState.parseSphereUrl(url);
  assert.ok(Math.abs((parsed.cameraTheta || 0) - 1.234) < 0.001);
});

test("LivingTimeSphereUrlState: out-of-range camera theta rejected", () => {
  const ctx    = loadSphereContext();
  const parsed = ctx.LivingTimeSphereUrlState.parseSphereUrl("https://x.com/?cam_t=999");
  assert.equal(parsed.cameraTheta, null);
});

test("LivingTimeSphereUrlState: malformed camera dist rejected", () => {
  const ctx    = loadSphereContext();
  const parsed = ctx.LivingTimeSphereUrlState.parseSphereUrl("https://x.com/?cam_d=NaN");
  assert.equal(parsed.cameraDist, null);
});

test("LivingTimeSphereUrlState: camera dist below MIN_ZOOM rejected", () => {
  const ctx    = loadSphereContext();
  const parsed = ctx.LivingTimeSphereUrlState.parseSphereUrl("https://x.com/?cam_d=0.1");
  assert.equal(parsed.cameraDist, null, "dist < 1.0 should be rejected");
});

// ── Today card module ─────────────────────────────────────────────────

test("LivingTimeSphereTodayCard: buildLink includes expected params", () => {
  const ctx  = loadSphereContext();
  const link = ctx.LivingTimeSphereTodayCard.buildLink({
    year: 2026, timeZone: "America/Los_Angeles", boundaryMode: "sunset",
    manualSunset: "18:00", source: "moons"
  });
  assert.ok(link.includes("view=today"),       "should include view=today");
  assert.ok(link.includes("year=2026"),        "should include year");
  assert.ok(link.includes("tz="),              "should include timezone");
  assert.ok(link.includes("boundary=sunset"),  "should include boundary");
  assert.ok(link.includes("source=moons"),     "should include source");
  assert.ok(link.includes("layers="),          "should include layers");
  // Must not include private/personal data
  assert.ok(!link.includes("birth"),   "must not include birth data");
  assert.ok(!link.includes("witness"), "must not include witness data");
  assert.ok(!link.includes("genesis"), "must not include genesis data");
});

test("LivingTimeSphereLiveData: snapshot exposes shared astronomy and witness context", () => {
  const ctx = loadSphereContext();
  ctx.CodexMemory = {
    getState() {
      return {
        recentWitness: { label: "Witness entry", date: "2026-07-24" },
        currentCycle: { witnessedDays: ["2026-07-20", "2026-07-21"] },
      };
    }
  };
  const snapshot = ctx.LivingTimeSphereLiveData.getSnapshot({
    asOf: new Date("2026-07-24T12:00:00Z"),
    timeZone: "UTC",
    boundaryMode: "midnight",
  });
  assert.equal(snapshot.pattern.civilDate, "2026-07-24");
  assert.ok(snapshot.lunar.phaseName, "lunar state available");
  assert.ok(snapshot.solar.gate, "solar gate available");
  assert.equal(snapshot.witness.count, 2);
});

test("LivingTimeSphereTodayCard: buildTextSummary returns multi-line string", () => {
  const ctx = loadSphereContext();
  const supported = ctx.AlignmentLedgerData.listSupportedYears();
  const year      = supported[supported.length - 1];
  const model     = ctx.LivingTimeSphereModel.buildTodayModel({ year });
  const record    = ctx.AlignmentLedgerData.getRecord({ year });
  const data = {
    year,
    todayModel: model,
    record,
    pos:    record?.equinox?.patternPosition || {},
    lunar:  record?.equinox?.lunarLayer      || {},
    offs:   record?.offsets                  || {},
    passageStatus: null
  };
  const text = ctx.LivingTimeSphereTodayCard.buildTextSummary(data);
  assert.ok(typeof text === "string" && text.length > 10);
  assert.ok(text.includes("Year:"));
  assert.ok(text.includes("Passage:"));
});

// ── 3D renderer module (no WebGL — test non-GPU functions) ────────────

test("LivingTimeSphereRenderer3d: THREE_VERSION is documented", () => {
  // Load renderer-3d module separately (it only exports the API, doesn't init WebGL)
  const ctx = loadSphereContext();
  const code = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
  vm.runInNewContext(code, ctx);
  assert.ok(ctx.LivingTimeSphereRenderer3d.THREE_VERSION,   "THREE_VERSION must be set");
  assert.ok(ctx.LivingTimeSphereRenderer3d.THREE_LOCAL_REL, "THREE_LOCAL_REL must be set");
});

test("LivingTimeSphereRenderer3d: isInitialized returns false before init", () => {
  const ctx  = loadSphereContext();
  const code = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
  vm.runInNewContext(code, ctx);
  assert.equal(ctx.LivingTimeSphereRenderer3d.isInitialized(), false);
});

// ── Renderer-neutral model parity ─────────────────────────────────────

test("3D parity: model angle functions match SVG renderer expectations", () => {
  const ctx = loadSphereContext();
  // The 3D renderer uses the same center-of-day convention as the SVG renderer.
  const angle = ctx.LivingTimeSphereModel.patternAngleForDayOfYear(1);
  assert.equal(angle, Number((0.5 / 364 * 360).toFixed(6)), "Day 1 should use the first day center");
});

test("3D parity: model passage startAngle matches alignment record for each year", () => {
  const ctx  = loadSphereContext();
  const years = ctx.AlignmentLedgerData.listSupportedYears();
  for (const year of years) {
    const model  = ctx.LivingTimeSphereModel.buildYearModel({ year });
    const record = ctx.AlignmentLedgerData.getRecord({ year });
    const dayOfYear = record?.equinox?.patternPosition?.dayOfPatternYear;
    if (dayOfYear == null) continue;
    const expectedAngle = ctx.LivingTimeSphereModel.patternAngleForDayOfYear(dayOfYear);
    assert.equal(model.passageStartAngle, expectedAngle,
      `Year ${year}: sphere model passage start should match record`);
  }
});

test("3D parity: year gate is always at 0°", () => {
  const ctx   = loadSphereContext();
  const model = ctx.LivingTimeSphereModel.buildYearModel({ year: 2026 });
  assert.equal(model.passageEndAngle, 0, "Year Gate must always be at 0°");
});

// ── No duplicate calculations ─────────────────────────────────────────

test("No calc duplication: renderer-3d does not independently compute Equinox position", () => {
  const code = read("docs/assets/js/sphere/living-time-sphere-renderer-3d.js");
  // The renderer must not independently recalculate passage/equinox angles.
  // Pattern coordinates must come from model data, not be recalculated here.
  assert.ok(!code.includes("equinoxToYearGate"), "renderer-3d must not recalculate passage durations");
  assert.ok(!code.includes("patternPosition.dayOfPatternYear"), "renderer-3d must not extract pattern position directly");
  // Visual geometry (360 / 13, 360 / 364) is allowed as display-only positioning
});

test("No calc duplication: today-card does not contain independent cycle formulas", () => {
  const code = read("docs/assets/js/sphere/living-time-sphere-today.js");
  assert.ok(!code.includes("lunarCyclePosition ="), "today card must not recompute lunar cycle");
  assert.ok(!code.includes("equinoxToYearGate ="),  "today card must not recompute passage");
});

// ── Homepage: sphere not loaded in initial HTML ───────────────────────

test("Homepage: 3D renderer JS not in critical load path", () => {
  const html = read("docs/index.html");
  // The 3D-specific renderer files should NOT be synchronously loaded by the homepage
  assert.ok(!html.includes("living-time-sphere-renderer-3d.js") ||
            html.includes("SPHERE_SCRIPTS") ||
            html.includes("IntersectionObserver"),
    "3D renderer must not be in the homepage critical load path");
  // The homepage lazy-loads sphere scripts (via IntersectionObserver or DOMContentLoaded fallback)
  assert.ok(html.includes("IntersectionObserver"), "homepage must use IntersectionObserver for lazy init");
});

test("Homepage: observatory section exists with expected elements", () => {
  const html = read("docs/index.html");
  assert.ok(html.includes("home-sphere-observatory"),     "observatory section ID present");
  assert.ok(html.includes("Enter Today's Sphere"),        "CTA link present");
  assert.ok(html.includes("home-sphere-today-preview"),   "preview element present");
  assert.ok(html.includes("home-sphere-today-open-link"), "open link element present");
  assert.ok(html.includes("data-sphere-mode=\"pattern\""),  "interactive pattern mode present");
  assert.ok(html.includes("data-home-sphere-reset"),  "homepage reset control present");
  assert.ok(html.includes("home-sphere-today-witness"),   "witness summary present");
});

test("Homepage: shared mount initializer is used", () => {
  const html = read("docs/index.html");
  assert.ok(html.includes("LivingTimeSphere.mount"), "homepage uses shared mount initializer");
});

// ── 13 Moons page: Today sphere card present ──────────────────────────

test("Moons page: Today Sphere card is in Today tab", () => {
  const html = read("docs/moons.html");
  assert.ok(html.includes("moons-sphere-today-card"), "Today Sphere card ID present");
  assert.ok(html.includes("Enter Today's Sphere"),    "CTA link present");
  assert.ok(html.includes("moons-sphere-today-preview"), "preview element present");
  assert.ok(html.includes("living-time-sphere-live-data.js"), "shared live-data module script present");
  assert.ok(html.includes("living-time-sphere-today.js"), "today module script present");
});

test("Moons page: Today Sphere card loads today module", () => {
  const html = read("docs/moons.html");
  assert.ok(html.includes("LivingTimeSphereTodayCard"), "initTodaySphereCard references module");
});

test("Moons page: shared mount initializer is used", () => {
  const html = read("docs/moons.html");
  assert.ok(html.includes("LivingTimeSphere.mount"), "moons page uses shared mount initializer");
});

// ── Sphere page: Phase 03 scripts and UI controls ─────────────────────

test("Sphere page: 3D module scripts included", () => {
  const html = read("docs/living-time-sphere.html");
  assert.ok(html.includes("living-time-sphere-materials.js"),  "materials loaded");
  assert.ok(html.includes("living-time-sphere-camera.js"),     "camera loaded");
  assert.ok(html.includes("living-time-sphere-animation.js"),  "animation loaded");
  assert.ok(html.includes("living-time-sphere-effects.js"),    "effects loaded");
  assert.ok(html.includes("living-time-sphere-live-data.js"),  "live-data module loaded");
  assert.ok(html.includes("living-time-sphere-renderer-3d.js"),"renderer-3d loaded");
  assert.ok(html.includes("living-time-sphere-today.js"),      "today module loaded");
});

test("Sphere page: quality and renderer controls present", () => {
  const html = read("docs/living-time-sphere.html");
  assert.ok(html.includes("sphere-quality-select"),   "quality selector present");
  assert.ok(html.includes("sphere-renderer-select"),  "renderer selector present");
  assert.ok(html.includes("sphere-moon-label-distance"), "moon label distance selector present");
  assert.ok(html.includes("sphere-day-label-mode"), "day label mode selector present");
  assert.ok(html.includes("sphere-connection-mode"), "connection mode selector present");
  assert.ok(html.includes("sphere-intro"),            "intro panel present");
  assert.ok(html.includes("sphere-cam-reset"),        "camera reset button present");
  assert.ok(html.includes("sphere-interact-btn"),     "mobile interact button present");
});

test("Sphere page: field layer observatory controls present", () => {
  const html = read("docs/living-time-sphere.html");
  const ui = read("docs/assets/js/sphere/living-time-sphere-ui.js");
  assert.ok(html.includes("sphere-field-range-now"), "field range now control present");
  assert.ok(html.includes("sphere-field-range-historical"), "historical comparison range control present");
  assert.ok(ui.includes("Record Observation"), "record observation action present");
  assert.ok(ui.includes("Compare Historical Fields"), "historical comparison action present");
});

test("Sphere page: shared mount initializer is used", () => {
  const html = read("docs/living-time-sphere.html");
  assert.ok(html.includes("LivingTimeSphere.mount"), "full sphere page uses shared mount initializer");
});

test("Equinox Passage page: shared mount initializer is used", () => {
  const html = read("docs/equinox-passage.html");
  assert.ok(html.includes("equinox-sphere-preview"), "passage sphere preview present");
  assert.ok(html.includes("LivingTimeSphere.mount"), "passage page uses shared mount initializer");
});

// ── Service worker: caches new sphere files ───────────────────────────

test("Service worker: caches all Phase 03 sphere JS files", () => {
  const sw = read("docs/service-worker.js");
  assert.ok(sw.includes("living-time-sphere-state.js"), "state cached");
  assert.ok(sw.includes("living-time-sphere-connections.js"), "connections cached");
  assert.ok(sw.includes("living-time-sphere-materials.js"),  "materials cached");
  assert.ok(sw.includes("living-time-sphere-camera.js"),     "camera cached");
  assert.ok(sw.includes("living-time-sphere-animation.js"),  "animation cached");
  assert.ok(sw.includes("living-time-sphere-effects.js"),    "effects cached");
  assert.ok(sw.includes("living-time-sphere-live-data.js"),  "live-data cached");
  assert.ok(sw.includes("living-time-sphere-renderer-3d.js"),"renderer-3d cached");
  assert.ok(sw.includes("living-time-sphere-mount.js"),      "mount cached");
  assert.ok(sw.includes("living-time-sphere-today.js"),      "today card cached");
});

// ── Private data: no personal info in sphere links ────────────────────

test("Today card buildLink excludes private data for all years", () => {
  const ctx = loadSphereContext();
  const years = ctx.AlignmentLedgerData.listSupportedYears();
  for (const year of years) {
    const link = ctx.LivingTimeSphereTodayCard.buildLink({ year });
    assert.ok(!link.includes("birth"),   `Year ${year}: no birth data in link`);
    assert.ok(!link.includes("witness"), `Year ${year}: no witness data in link`);
    assert.ok(!link.includes("seal"),    `Year ${year}: no seal data in link`);
  }
});

// ── Determinism: today card returns consistent data ───────────────────

test("Today card buildTextSummary is deterministic for same input", () => {
  const ctx = loadSphereContext();
  const year = ctx.AlignmentLedgerData.listSupportedYears().at(-1);
  const model = ctx.LivingTimeSphereModel.buildTodayModel({ year });
  const record = ctx.AlignmentLedgerData.getRecord({ year });
  const data = {
    year, todayModel: model, record,
    pos:   record?.equinox?.patternPosition || {},
    lunar: record?.equinox?.lunarLayer      || {},
    offs:  record?.offsets                  || {},
    passageStatus: null
  };
  const t1 = ctx.LivingTimeSphereTodayCard.buildTextSummary(data);
  const t2 = ctx.LivingTimeSphereTodayCard.buildTextSummary(data);
  assert.equal(t1, t2, "buildTextSummary must be deterministic");
});

// ── JS syntax validation for all new sphere files ─────────────────────

const NEW_SPHERE_FILES = [
  "docs/assets/js/sphere/living-time-sphere-state.js",
  "docs/assets/js/sphere/living-time-sphere-materials.js",
  "docs/assets/js/sphere/living-time-sphere-camera.js",
  "docs/assets/js/sphere/living-time-sphere-animation.js",
  "docs/assets/js/sphere/living-time-sphere-effects.js",
  "docs/assets/js/sphere/living-time-sphere-connections.js",
  "docs/assets/js/sphere/living-time-sphere-live-data.js",
  "docs/assets/js/sphere/living-time-sphere-mount.js",
  "docs/assets/js/sphere/living-time-sphere-renderer-3d.js",
  "docs/assets/js/sphere/living-time-sphere-today.js",
  "docs/assets/js/sphere/living-time-sphere-ui.js",
  "docs/assets/js/sphere/living-time-sphere-interaction.js",
  "docs/assets/js/sphere/living-time-sphere-url-state.js",
];

for (const file of NEW_SPHERE_FILES) {
  test(`JS syntax: ${path.basename(file)} is valid`, () => {
    const code = read(file);
    // vm.Script will throw if syntax is invalid
    assert.doesNotThrow(() => new vm.Script(code), `${file} must have valid JS syntax`);
  });
}
