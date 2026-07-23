"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

function loadAlignmentContext() {
  const context = {
    Intl,
    Date,
    URL,
    console,
    location: { href: "https://codexofreality.org/alignment-ledger.html", hostname: "codexofreality.org" }
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
    "docs/assets/js/alignment/alignment-url-state.js"
  ];

  for (const rel of scripts) {
    const code = read(rel);
    vm.runInNewContext(code, context);
  }
  return context;
}

// ── Version ───────────────────────────────────────────────────────────

test("AlignmentVersion: exports correct version strings", () => {
  const ctx = loadAlignmentContext();
  assert.equal(ctx.AlignmentVersion.alignmentLedgerVersion, "alignment-ledger/1.0.0");
  assert.equal(ctx.AlignmentVersion.sphereVersion, "living-time-sphere/1.0.0");
  assert.equal(ctx.AlignmentVersion.studyRange.start, 2014);
  assert.equal(ctx.AlignmentVersion.studyRange.end,   2026);
});

test("AlignmentVersion: versionBlock matches expected keys", () => {
  const ctx = loadAlignmentContext();
  const vb = ctx.AlignmentVersion.versionBlock;
  assert.equal(vb.alignmentLedgerVersion, "alignment-ledger/1.0.0");
  assert.equal(vb.sphereVersion, "living-time-sphere/1.0.0");
  assert.equal(vb.equinoxPassageVersion, "equinox-passage/1.0.0");
  assert.equal(vb.calendarVersion, "pattern-calendar/1.0.0");
});

// ── Engine ────────────────────────────────────────────────────────────

test("AlignmentLedgerEngine: buildRecord returns expected schema", () => {
  const ctx = loadAlignmentContext();
  const rec = ctx.AlignmentLedgerEngine.buildRecord({ selectedYear: 2026 });
  assert.equal(rec.schemaVersion, "alignment-ledger/1.0.0");
  assert.equal(rec.year, 2026);
  assert.ok(rec.equinox?.utcInstant, "should have equinox.utcInstant");
  assert.ok(rec.yearGate?.instant, "should have yearGate.instant");
  assert.ok(typeof rec.offsets.equinoxToYearGateMilliseconds === "number");
  assert.ok(typeof rec.offsets.equinoxToYearGateDays === "number");
  assert.ok(typeof rec.normalized.patternCyclePosition === "number");
  assert.ok(rec.signature, "should have signature");
  assert.ok(Array.isArray(rec.sources) || rec.sources != null);
});

test("AlignmentLedgerEngine: buildRecord is deterministic", () => {
  const ctx = loadAlignmentContext();
  const r1 = ctx.AlignmentLedgerEngine.buildRecord({ selectedYear: 2024 });
  const r2 = ctx.AlignmentLedgerEngine.buildRecord({ selectedYear: 2024 });
  assert.equal(r1.offsets.equinoxToYearGateMilliseconds, r2.offsets.equinoxToYearGateMilliseconds);
  assert.equal(r1.normalized.patternCyclePosition, r2.normalized.patternCyclePosition);
  assert.equal(r1.equinox.utcInstant, r2.equinox.utcInstant);
});

test("AlignmentLedgerEngine: listSupportedYears returns 2014–2026", () => {
  const ctx = loadAlignmentContext();
  const years = ctx.AlignmentLedgerEngine.listSupportedYears();
  assert.equal(years[0],  2014);
  assert.equal(years[years.length - 1], 2026);
  assert.equal(years.length, 13);
});

test("AlignmentLedgerEngine: yearGateUtc returns April 17", () => {
  const ctx = loadAlignmentContext();
  const gate = ctx.AlignmentLedgerEngine.yearGateUtc(2026);
  assert.equal(gate.getUTCMonth(), 3); // April = month 3
  assert.equal(gate.getUTCDate(),  17);
  assert.equal(gate.getUTCHours(), 0);
});

test("AlignmentLedgerEngine: offsets — equinoxToYearGateDays is positive for March equinox to April 17", () => {
  const ctx = loadAlignmentContext();
  const rec = ctx.AlignmentLedgerEngine.buildRecord({ selectedYear: 2026 });
  // March equinox (≈ March 20) to April 17 ≈ 28 days
  assert.ok(rec.offsets.equinoxToYearGateDays > 20, "expected passage > 20 days");
  assert.ok(rec.offsets.equinoxToYearGateDays < 40, "expected passage < 40 days");
});

test("AlignmentLedgerEngine: normalized values in [0,1]", () => {
  const ctx = loadAlignmentContext();
  const rec = ctx.AlignmentLedgerEngine.buildRecord({ selectedYear: 2026 });
  const n = rec.normalized;
  assert.ok(n.patternCyclePosition  >= 0 && n.patternCyclePosition  <= 1);
  assert.ok(n.equinoxCyclePosition  >= 0 && n.equinoxCyclePosition  <= 1);
  assert.ok(n.lunarCyclePosition    >= 0 && n.lunarCyclePosition    <= 1);
  assert.ok(n.passageLengthPosition >= 0 && n.passageLengthPosition <= 1);
});

// ── Data layer ────────────────────────────────────────────────────────

test("AlignmentLedgerData: getAllRecords returns 13 records", () => {
  const ctx = loadAlignmentContext();
  const recs = ctx.AlignmentLedgerData.getAllRecords();
  assert.equal(recs.length, 13);
});

test("AlignmentLedgerData: getRecord caches correctly (same object)", () => {
  const ctx = loadAlignmentContext();
  const r1 = ctx.AlignmentLedgerData.getRecord({ year: 2020 });
  const r2 = ctx.AlignmentLedgerData.getRecord({ year: 2020 });
  assert.equal(r1, r2); // same frozen reference from cache
});

// ── Comparison ────────────────────────────────────────────────────────

test("AlignmentComparison: compareTwo returns expected shape", () => {
  const ctx = loadAlignmentContext();
  const cmp = ctx.AlignmentComparison.compareTwo(2025, 2026);
  assert.equal(cmp.yearA, 2025);
  assert.equal(cmp.yearB, 2026);
  assert.ok(typeof cmp.equinoxUtcShiftHours === "number");
  assert.ok(Array.isArray(cmp.similarities));
  assert.ok(Array.isArray(cmp.differences));
  assert.ok(["longer", "shorter", "same", "unknown"].includes(cmp.movementDirection));
});

test("AlignmentComparison: compareToPrevious(2026) is same as compareTwo(2025,2026)", () => {
  const ctx = loadAlignmentContext();
  const cmpA = ctx.AlignmentComparison.compareToPrevious(2026);
  const cmpB = ctx.AlignmentComparison.compareTwo(2025, 2026);
  assert.equal(cmpA.yearA, cmpB.yearA);
  assert.equal(cmpA.yearB, cmpB.yearB);
  assert.equal(cmpA.equinoxUtcShiftHours, cmpB.equinoxUtcShiftHours);
});

test("AlignmentComparison: compareFullStudy returns 12 sequential pairs", () => {
  const ctx = loadAlignmentContext();
  const results = ctx.AlignmentComparison.compareFullStudy();
  assert.equal(results.length, 12);
  assert.equal(results[0].yearA, 2014);
  assert.equal(results[0].yearB, 2015);
});

// ── Recurrence ────────────────────────────────────────────────────────

test("AlignmentRecurrence: findRecurrences returns array", () => {
  const ctx = loadAlignmentContext();
  const results = ctx.AlignmentRecurrence.findRecurrences(2026, { minimumScore: 0.0 });
  assert.ok(Array.isArray(results));
  assert.equal(results.length, 12); // 12 other years
});

test("AlignmentRecurrence: similarity scores in [0,1]", () => {
  const ctx = loadAlignmentContext();
  const results = ctx.AlignmentRecurrence.findRecurrences(2026, { minimumScore: 0.0 });
  for (const r of results) {
    assert.ok(r.overallSimilarityScore >= 0 && r.overallSimilarityScore <= 1,
      `Score out of range: ${r.overallSimilarityScore} for year ${r.year}`);
  }
});

test("AlignmentRecurrence: scoreDimensions returns scoreExplanation", () => {
  const ctx = loadAlignmentContext();
  const r1 = ctx.AlignmentLedgerData.getRecord({ year: 2024 });
  const r2 = ctx.AlignmentLedgerData.getRecord({ year: 2025 });
  const dims = ctx.AlignmentRecurrence.scoreDimensions(r1, r2);
  assert.ok(dims.scoreExplanation, "scoreExplanation must be present");
  assert.ok(dims.overallSimilarityScore >= 0 && dims.overallSimilarityScore <= 1);
});

test("AlignmentRecurrence: DEFAULT_TOLERANCES are exposed and documented", () => {
  const ctx = loadAlignmentContext();
  const tol = ctx.AlignmentRecurrence.DEFAULT_TOLERANCES;
  assert.ok(typeof tol.passageDurationHours === "number");
  assert.ok(typeof tol.lunarCycleDistance   === "number");
});

// ── Offsets ───────────────────────────────────────────────────────────

test("AlignmentOffsets: offsetSummary returns expected fields", () => {
  const ctx = loadAlignmentContext();
  const rec = ctx.AlignmentLedgerData.getRecord({ year: 2026 });
  const summary = ctx.AlignmentOffsets.offsetSummary(rec);
  assert.equal(summary.year, 2026);
  assert.ok(typeof summary.equinoxToYearGateDays === "number");
  assert.ok(typeof summary.equinoxToYearGateHours === "number");
});

test("AlignmentOffsets: passageLength is consistent with offsets", () => {
  const ctx = loadAlignmentContext();
  const rec = ctx.AlignmentLedgerData.getRecord({ year: 2026 });
  const pl = ctx.AlignmentOffsets.passageLength(rec);
  assert.ok(Math.abs(pl.hours - pl.days * 24) < 0.001);
});

// ── Signature ─────────────────────────────────────────────────────────

test("AlignmentSignature: build returns entries with type field", () => {
  const ctx = loadAlignmentContext();
  const rec = ctx.AlignmentLedgerData.getRecord({ year: 2026 });
  const sig = ctx.AlignmentSignature.build(rec);
  assert.ok(Array.isArray(sig.entries));
  const types = new Set(sig.entries.map(e => e.type));
  assert.ok(types.has("direct-measurement"));
  assert.ok(types.has("symbolic-mapping"));
  assert.ok(types.has("normalized-coordinate"));
  assert.ok(types.has("hypothesis-boundary"));
});

test("AlignmentSignature: accessibleText returns non-empty string", () => {
  const ctx = loadAlignmentContext();
  const rec = ctx.AlignmentLedgerData.getRecord({ year: 2026 });
  const txt = ctx.AlignmentSignature.accessibleText(rec);
  assert.ok(typeof txt === "string" && txt.length > 10);
});

// ── Export ────────────────────────────────────────────────────────────

test("AlignmentExport: toRecordJSON produces valid JSON", () => {
  const ctx = loadAlignmentContext();
  const rec = ctx.AlignmentLedgerData.getRecord({ year: 2026 });
  const json = ctx.AlignmentExport.toRecordJSON(rec);
  const parsed = JSON.parse(json);
  assert.equal(parsed.year, 2026);
  assert.equal(parsed.schemaVersion, "alignment-ledger/1.0.0");
});

test("AlignmentExport: toHistoricalCSV produces CSV with header and 13 data rows", () => {
  const ctx = loadAlignmentContext();
  const recs = ctx.AlignmentLedgerData.getAllRecords();
  const csv = ctx.AlignmentExport.toHistoricalCSV(recs);
  const lines = csv.split("\r\n").filter(l => l.trim());
  assert.equal(lines.length, 14); // 1 header + 13 data rows
});

test("AlignmentExport: toReadableText contains year and measurement labels", () => {
  const ctx = loadAlignmentContext();
  const rec = ctx.AlignmentLedgerData.getRecord({ year: 2026 });
  const txt = ctx.AlignmentExport.toReadableText(rec);
  assert.ok(txt.includes("2026"));
  assert.ok(txt.includes("Passage length"));
  assert.ok(txt.includes("Lunar phase"));
});

// ── URL state ─────────────────────────────────────────────────────────

test("AlignmentUrlState: round-trip alignment link", () => {
  const ctx = loadAlignmentContext();
  const link = ctx.AlignmentUrlState.buildAlignmentShareLink({
    year: 2026, compareYear: 2025, timeZone: "America/Los_Angeles",
    boundaryMode: "sunset", manualSunset: "18:00", mode: "ledger"
  });
  const parsed = ctx.AlignmentUrlState.parseAlignmentShareLink(link);
  assert.equal(parsed.year,         2026);
  assert.equal(parsed.compareYear,  2025);
  assert.equal(parsed.timeZone,     "America/Los_Angeles");
  assert.equal(parsed.boundaryMode, "sunset");
  assert.equal(parsed.manualSunset, "18:00");
  assert.equal(parsed.mode,         "ledger");
});

test("AlignmentUrlState: invalid year is rejected", () => {
  const ctx = loadAlignmentContext();
  const parsed = ctx.AlignmentUrlState.parseAlignmentShareLink("https://x.com/?year=1999");
  assert.equal(parsed.year, null);
});

test("AlignmentUrlState: round-trip sphere link", () => {
  const ctx = loadAlignmentContext();
  const link = ctx.AlignmentUrlState.buildSphereShareLink({
    year: 2024, viewMode: "passage", layers: ["pattern", "passage"], marker: "eq-2024"
  });
  const parsed = ctx.AlignmentUrlState.parseSphereShareLink(link);
  assert.equal(parsed.year, 2024);
  assert.equal(parsed.viewMode, "passage");
  assert.equal(JSON.stringify(parsed.layers), JSON.stringify(["pattern", "passage"]));
  assert.equal(parsed.marker, "eq-2024");
});

test("AlignmentUrlState: invalid clock value is rejected", () => {
  const ctx = loadAlignmentContext();
  const parsed = ctx.AlignmentUrlState.parseSphereShareLink("https://x.com/?sunset=25:70");
  assert.equal(parsed.manualSunset, null);
});

// ── RemnantShareUrl integration ───────────────────────────────────────

test("RemnantShareUrl: exposes buildAlignmentShareLink and buildSphereShareLink", () => {
  const storage = new Map();
  const context = {
    Intl, Date, URL,
    location: { href: "https://codexofreality.org/" }
  };
  context.globalThis = context;
  const scripts = [
    "docs/assets/js/share/remnant-share-url.js"
  ];
  for (const rel of scripts) {
    vm.runInNewContext(read(rel), context);
  }
  assert.ok(typeof context.RemnantShareUrl.buildAlignmentShareLink === "function");
  assert.ok(typeof context.RemnantShareUrl.parseAlignmentShareLink === "function");
  assert.ok(typeof context.RemnantShareUrl.buildSphereShareLink === "function");
  assert.ok(typeof context.RemnantShareUrl.parseSphereShareLink === "function");
});

// ── 13-year study window ──────────────────────────────────────────────

test("AlignmentLedgerEngine: all 13 years produce complete records", () => {
  const ctx = loadAlignmentContext();
  for (const year of ctx.AlignmentLedgerEngine.listSupportedYears()) {
    const rec = ctx.AlignmentLedgerEngine.buildRecord({ selectedYear: year });
    assert.equal(rec.year, year, `year field mismatch for ${year}`);
    assert.ok(rec.offsets.equinoxToYearGateDays > 0, `positive passage for ${year}`);
    assert.ok(rec.normalized.lunarCyclePosition >= 0 && rec.normalized.lunarCyclePosition <= 1);
  }
});

// ── Source metadata ───────────────────────────────────────────────────

test("AlignmentLedgerEngine: record includes generatedAt field", () => {
  const ctx = loadAlignmentContext();
  const rec = ctx.AlignmentLedgerEngine.buildRecord({ selectedYear: 2026 });
  assert.ok(rec.generatedAt, "generatedAt must be present");
  assert.ok(/^\d{4}-\d{2}-\d{2}/.test(rec.generatedAt), "generatedAt must look like a date");
});
