"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

function loadSphereContext() {
  const context = {
    Intl,
    Date,
    URL,
    console,
    location: { href: "https://codexofreality.org/living-time-sphere.html", hostname: "codexofreality.org" }
  };
  context.globalThis = context;
  context.window = context;

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
    "docs/assets/js/sphere/living-time-sphere-model.js",
    "docs/assets/js/sphere/living-time-sphere-layout.js",
    "docs/assets/js/sphere/living-time-sphere-renderer-svg.js",
    "docs/assets/js/sphere/living-time-sphere-accessibility.js",
    "docs/assets/js/sphere/living-time-sphere-export.js",
    "docs/assets/js/sphere/living-time-sphere-url-state.js"
  ];

  for (const rel of scripts) {
    const code = read(rel);
    vm.runInNewContext(code, context);
  }
  return context;
}

// ── Version ───────────────────────────────────────────────────────────

test("LivingTimeSphereVersion: version string is correct", () => {
  const ctx = loadSphereContext();
  assert.equal(ctx.LivingTimeSphereVersion.version, "living-time-sphere/1.0.0");
});

test("LivingTimeSphereVersion: coordinate conventions are documented", () => {
  const ctx = loadSphereContext();
  const cc = ctx.LivingTimeSphereVersion.coordinateConventions;
  assert.ok(cc.zeroPosition);
  assert.ok(cc.direction);
  assert.ok(cc.angleUnit);
});

// ── Sphere model ──────────────────────────────────────────────────────

test("LivingTimeSphereModel: buildYearModel returns expected fields", () => {
  const ctx = loadSphereContext();
  const model = ctx.LivingTimeSphereModel.buildYearModel({ year: 2026 });
  assert.equal(model.year, 2026);
  assert.equal(model.schemaVersion, "living-time-sphere/1.0.0");
  assert.ok(typeof model.patternAngle       === "number");
  assert.ok(typeof model.lunarAngle         === "number");
  assert.ok(typeof model.solarSeasonAngle   === "number");
  assert.ok(typeof model.passageStartAngle  === "number");
  assert.ok(typeof model.passageEndAngle    === "number");
  assert.ok(typeof model.yearSpiralAngle    === "number");
  assert.ok(typeof model.yearSpiralRadius   === "number");
});

test("LivingTimeSphereModel: buildYearModel is deterministic", () => {
  const ctx = loadSphereContext();
  const m1 = ctx.LivingTimeSphereModel.buildYearModel({ year: 2024 });
  const m2 = ctx.LivingTimeSphereModel.buildYearModel({ year: 2024 });
  assert.equal(m1.patternAngle, m2.patternAngle);
  assert.equal(m1.lunarAngle,   m2.lunarAngle);
  assert.equal(m1.passageStartAngle, m2.passageStartAngle);
});

test("LivingTimeSphereModel: patternAngle in [0, 360)", () => {
  const ctx = loadSphereContext();
  for (const year of [2014, 2018, 2022, 2026]) {
    const model = ctx.LivingTimeSphereModel.buildYearModel({ year });
    assert.ok(model.patternAngle >= 0 && model.patternAngle < 360,
      `patternAngle out of range for ${year}: ${model.patternAngle}`);
  }
});

test("LivingTimeSphereModel: yearSpiralRadius in [0, 1]", () => {
  const ctx = loadSphereContext();
  for (const year of [2014, 2020, 2026]) {
    const model = ctx.LivingTimeSphereModel.buildYearModel({ year });
    assert.ok(model.yearSpiralRadius >= 0 && model.yearSpiralRadius <= 1,
      `spiralRadius out of range for ${year}: ${model.yearSpiralRadius}`);
  }
});

test("LivingTimeSphereModel: moonSectors has 13 entries", () => {
  const ctx = loadSphereContext();
  const model = ctx.LivingTimeSphereModel.buildYearModel({ year: 2026 });
  assert.equal(model.moonSectors.length, 13);
});

test("LivingTimeSphereModel: moon sector angles span 0–360", () => {
  const ctx = loadSphereContext();
  const model = ctx.LivingTimeSphereModel.buildYearModel({ year: 2026 });
  const last = model.moonSectors[12];
  assert.ok(last.endAngle > 350 && last.endAngle <= 360);
  assert.equal(model.moonSectors[0].startAngle, 0);
});

test("LivingTimeSphereModel: passage arc fields present", () => {
  const ctx = loadSphereContext();
  const model = ctx.LivingTimeSphereModel.buildYearModel({ year: 2026 });
  assert.ok(typeof model.passage.startAngle    === "number");
  assert.ok(typeof model.passage.endAngle      === "number");
  assert.ok(typeof model.passage.durationDays  === "number");
  assert.ok(typeof model.passage.durationHours === "number");
  assert.ok(model.passage.durationDays > 0);
});

test("LivingTimeSphereModel: markers present with labels", () => {
  const ctx = loadSphereContext();
  const model = ctx.LivingTimeSphereModel.buildYearModel({ year: 2026 });
  assert.ok(model.markers.equinoxGate.label, "equinoxGate must have label");
  assert.ok(model.markers.yearGate.label,    "yearGate must have label");
  assert.ok(model.markers.lunarMarker.label, "lunarMarker must have label");
});

test("LivingTimeSphereModel: buildSpiral returns 13 years", () => {
  const ctx = loadSphereContext();
  const spiral = ctx.LivingTimeSphereModel.buildSpiral();
  assert.equal(spiral.years.length, 13);
  assert.equal(spiral.years[0].year,  2014);
  assert.equal(spiral.years[12].year, 2026);
});

test("LivingTimeSphereModel: spiral year indices are sequential", () => {
  const ctx = loadSphereContext();
  const spiral = ctx.LivingTimeSphereModel.buildSpiral();
  for (let i = 0; i < spiral.years.length; i++) {
    assert.equal(spiral.years[i].spiralYearIndex, i, `index mismatch at position ${i}`);
  }
});

test("LivingTimeSphereModel: patternAngleForDayOfYear(1) = 0", () => {
  const ctx = loadSphereContext();
  assert.equal(ctx.LivingTimeSphereModel.patternAngleForDayOfYear(1), 0);
});

test("LivingTimeSphereModel: patternAngleForDayOfYear(365) ≈ 360", () => {
  const ctx = loadSphereContext();
  const angle = ctx.LivingTimeSphereModel.patternAngleForDayOfYear(365);
  // 364/364 * 360 = 360 but clamped to 363 (last index 363 of 364 total)
  assert.ok(angle > 358 && angle <= 360, `angle was ${angle}`);
});

// ── Layout ────────────────────────────────────────────────────────────

test("LivingTimeSphereLayout: resolveLayout returns numeric fields", () => {
  const ctx = loadSphereContext();
  const layout = ctx.LivingTimeSphereLayout.resolveLayout({ containerWidth: 400, containerHeight: 400 });
  assert.ok(typeof layout.cx === "number");
  assert.ok(typeof layout.cy === "number");
  assert.ok(typeof layout.radius === "number");
  assert.ok(layout.radius >= ctx.LivingTimeSphereLayout.MIN_RADIUS);
  assert.ok(layout.radius <= ctx.LivingTimeSphereLayout.MAX_RADIUS);
});

test("LivingTimeSphereLayout: resolveLayout handles narrow 320px container", () => {
  const ctx = loadSphereContext();
  const layout = ctx.LivingTimeSphereLayout.resolveLayout({ containerWidth: 320, containerHeight: 320 });
  assert.ok(layout.radius > 0);
  assert.ok(layout.rings.patternRing < layout.rings.outerBorder);
});

test("LivingTimeSphereLayout: polarToXY(0°) is at top of circle", () => {
  const ctx = loadSphereContext();
  const { x, y } = ctx.LivingTimeSphereLayout.polarToXY({ angle: 0, r: 100, cx: 200, cy: 200 });
  assert.ok(Math.abs(x - 200) < 0.01, `x should be center: ${x}`);
  assert.ok(Math.abs(y - 100) < 0.01, `y should be top: ${y}`);
});

test("LivingTimeSphereLayout: buildPassageArc returns numeric arc fields", () => {
  const ctx = loadSphereContext();
  const arc = ctx.LivingTimeSphereLayout.buildPassageArc({ startAngle: 30, endAngle: 10, r: 100, cx: 200, cy: 200 });
  assert.ok(typeof arc.startX === "number");
  assert.ok(typeof arc.endX   === "number");
  assert.ok(arc.sweepDegrees > 0);
});

// ── SVG renderer ──────────────────────────────────────────────────────

test("LivingTimeSphereRendererSvg: buildSvgString produces SVG markup", () => {
  const ctx = loadSphereContext();
  const model  = ctx.LivingTimeSphereModel.buildYearModel({ year: 2026 });
  const spiral = ctx.LivingTimeSphereModel.buildSpiral();
  const layout = ctx.LivingTimeSphereLayout.resolveLayout({ containerWidth: 400, containerHeight: 400 });
  const svg    = ctx.LivingTimeSphereRendererSvg.buildSvgString({ model, spiral, layout, selectedYear: 2026 });
  assert.ok(svg.startsWith("<svg"), "should start with <svg");
  assert.ok(svg.includes("</svg>"), "should end with </svg>");
  assert.ok(svg.includes("sphere-moon-sector"), "should include moon sectors");
  assert.ok(svg.includes("sphere-passage-arc"), "should include passage arc");
});

test("LivingTimeSphereRendererSvg: SVG does not contain unescaped user data", () => {
  const ctx = loadSphereContext();
  const model  = ctx.LivingTimeSphereModel.buildYearModel({ year: 2026 });
  const spiral = ctx.LivingTimeSphereModel.buildSpiral();
  const layout = ctx.LivingTimeSphereLayout.resolveLayout({ containerWidth: 400, containerHeight: 400 });
  const svg    = ctx.LivingTimeSphereRendererSvg.buildSvgString({ model, spiral, layout, selectedYear: 2026 });
  // Should not contain raw < or > inside attribute values
  assert.ok(!svg.includes('aria-label="<'), "no unescaped < in aria-label");
  assert.ok(!svg.includes('aria-label=">'), "no unescaped > in aria-label");
});

test("LivingTimeSphereRendererSvg: hidden layers produce smaller SVG", () => {
  const ctx = loadSphereContext();
  const model  = ctx.LivingTimeSphereModel.buildYearModel({ year: 2026 });
  const spiral = ctx.LivingTimeSphereModel.buildSpiral();
  const layout = ctx.LivingTimeSphereLayout.resolveLayout({ containerWidth: 400, containerHeight: 400 });
  const svgFull   = ctx.LivingTimeSphereRendererSvg.buildSvgString({ model, spiral, layout, selectedYear: 2026, visibleLayers: { pattern: true, passage: true, lunar: true, solar: true, markers: true, recurrence: true, spiral: true } });
  const svgMinimal = ctx.LivingTimeSphereRendererSvg.buildSvgString({ model, spiral, layout, selectedYear: 2026, visibleLayers: { pattern: false, passage: false, lunar: false, solar: false, markers: false, recurrence: false, spiral: false } });
  assert.ok(svgFull.length > svgMinimal.length, "full SVG should be larger than minimal");
});

// ── Accessibility ─────────────────────────────────────────────────────

test("LivingTimeSphereAccessibility: buildYearDescription returns string", () => {
  const ctx = loadSphereContext();
  const model = ctx.LivingTimeSphereModel.buildYearModel({ year: 2026 });
  const desc  = ctx.LivingTimeSphereAccessibility.buildYearDescription({ model });
  assert.ok(typeof desc === "string" && desc.length > 20);
  assert.ok(desc.includes("2026"));
});

test("LivingTimeSphereAccessibility: buildSpiralDescription references all years", () => {
  const ctx = loadSphereContext();
  const spiral = ctx.LivingTimeSphereModel.buildSpiral();
  const desc   = ctx.LivingTimeSphereAccessibility.buildSpiralDescription(spiral);
  assert.ok(desc.includes("2014"));
  assert.ok(desc.includes("2026"));
});

test("LivingTimeSphereAccessibility: buildPassageDescription includes passage arc info", () => {
  const ctx = loadSphereContext();
  const model = ctx.LivingTimeSphereModel.buildYearModel({ year: 2026 });
  const desc  = ctx.LivingTimeSphereAccessibility.buildPassageDescription(model);
  assert.ok(desc.toLowerCase().includes("passage"));
});

// ── URL state ─────────────────────────────────────────────────────────

test("LivingTimeSphereUrlState: round-trip sphere URL", () => {
  const ctx = loadSphereContext();
  const link = ctx.LivingTimeSphereUrlState.buildSphereUrl({
    year: 2024, viewMode: "passage", layers: ["pattern", "passage"], marker: "eq-2024",
    timeZone: "America/Los_Angeles", boundaryMode: "sunset", manualSunset: "18:00"
  });
  const parsed = ctx.LivingTimeSphereUrlState.parseSphereUrl(link);
  assert.equal(parsed.year,         2024);
  assert.equal(parsed.viewMode,     "passage");
  assert.equal(JSON.stringify(parsed.layers), JSON.stringify(["pattern", "passage"]));
  assert.equal(parsed.marker,       "eq-2024");
  assert.equal(parsed.timeZone,     "America/Los_Angeles");
  assert.equal(parsed.boundaryMode, "sunset");
  assert.equal(parsed.manualSunset, "18:00");
});

test("LivingTimeSphereUrlState: invalid year rejected", () => {
  const ctx = loadSphereContext();
  const parsed = ctx.LivingTimeSphereUrlState.parseSphereUrl("https://x.com/?year=1492");
  assert.equal(parsed.year, null);
});

test("LivingTimeSphereUrlState: invalid viewMode rejected", () => {
  const ctx = loadSphereContext();
  const parsed = ctx.LivingTimeSphereUrlState.parseSphereUrl("https://x.com/?view=hackmode");
  assert.equal(parsed.viewMode, null);
});

test("LivingTimeSphereUrlState: invalid layer filtered out", () => {
  const ctx = loadSphereContext();
  const parsed = ctx.LivingTimeSphereUrlState.parseSphereUrl("https://x.com/?layers=pattern,INVALID,passage");
  assert.equal(JSON.stringify(parsed.layers), JSON.stringify(["pattern", "passage"]));
});

// ── Export ────────────────────────────────────────────────────────────

test("LivingTimeSphereExport: FORMATS has square, portrait, story", () => {
  const ctx = loadSphereContext();
  assert.ok(ctx.LivingTimeSphereExport.FORMATS.square);
  assert.ok(ctx.LivingTimeSphereExport.FORMATS.portrait);
  assert.ok(ctx.LivingTimeSphereExport.FORMATS.story);
});

test("LivingTimeSphereExport: resolveFormat returns square for unknown name", () => {
  const ctx = loadSphereContext();
  const fmt = ctx.LivingTimeSphereExport.resolveFormat("unknown");
  assert.equal(fmt.width, 1080);
  assert.equal(fmt.height, 1080);
});

// ── Integration: Alignment Ledger ↔ Sphere ────────────────────────────

test("Integration: sphere model passage duration matches alignment record", () => {
  const ctx = loadSphereContext();
  const model  = ctx.LivingTimeSphereModel.buildYearModel({ year: 2026 });
  const record = ctx.AlignmentLedgerData.getRecord({ year: 2026 });
  assert.ok(Math.abs(model.passage.durationDays - record.offsets.equinoxToYearGateDays) < 0.01,
    "Sphere and alignment record passage durations should match");
});

test("Integration: sphere equinox angle matches pattern position", () => {
  const ctx = loadSphereContext();
  const model  = ctx.LivingTimeSphereModel.buildYearModel({ year: 2026 });
  const record = ctx.AlignmentLedgerData.getRecord({ year: 2026 });
  const expectedAngle = ctx.LivingTimeSphereModel.patternAngleForDayOfYear(
    record.equinox.patternPosition.dayOfPatternYear || 364
  );
  assert.equal(model.passageStartAngle, expectedAngle);
});

// ── PWA: service worker includes Phase 03 assets ──────────────────────

test("Service worker: includes alignment and sphere JS files", () => {
  const swCode = read("docs/service-worker.js");
  assert.ok(swCode.includes("alignment/alignment-version.js"), "SW must cache alignment-version.js");
  assert.ok(swCode.includes("sphere/living-time-sphere-model.js"), "SW must cache sphere model");
  assert.ok(swCode.includes("alignment-ledger.html"), "SW must cache alignment-ledger.html");
  assert.ok(swCode.includes("living-time-sphere.html"), "SW must cache living-time-sphere.html");
});

// ── Privacy: no private data in exports ──────────────────────────────

test("AlignmentExport: toRecordJSON does not include Oracle or witness fields", () => {
  const ctx = loadSphereContext();
  const rec = ctx.AlignmentLedgerData.getRecord({ year: 2026 });
  const json = ctx.AlignmentExport.toRecordJSON(rec);
  assert.ok(!json.includes("birthDate"), "should not include birthDate");
  assert.ok(!json.includes("birthTime"), "should not include birthTime");
  assert.ok(!json.includes("witnessPoints"), "should not include witnessPoints");
});

test("AlignmentUrlState: share links do not include Oracle fields", () => {
  const ctx = loadSphereContext();
  const link = ctx.AlignmentUrlState.buildAlignmentShareLink({ year: 2026 });
  assert.ok(!link.includes("birth"), "share link should not include birth data");
  assert.ok(!link.includes("witness"), "share link should not include witness data");
});
