const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repoRoot = path.resolve(__dirname, "..");
const docsRoot = path.join(repoRoot, "docs");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function loadMark() {
  const context = vm.createContext({ console, module: { exports: {} }, exports: {} });
  context.globalThis = context;
  vm.runInContext(read("docs/assets/js/witness-mark.js"), context, { filename: "witness-mark.js" });
  return context.module.exports;
}

const TEMPORAL = { civilDate: "2026-11-20", patternDay: 218, moon: 8, moonDay: 22, patternYear: 2026 };

test("the mark is a record in the house shape, stamped and private", () => {
  const mark = loadMark();
  const record = mark.buildMarkRecord(
    { pageTitle: "13 Moons Whitepaper", path: "13-moon-whitepaper.html", reflection: "The year is a garden that walks." },
    TEMPORAL
  );
  assert.equal(record.type, "event");
  assert.equal(record.subtype, "witness-mark");
  assert.ok(record.tags.includes("witness-mark"));
  assert.equal(record.provenance.sourceType, "witness-mark");
  assert.equal(record.provenance.calculationAuthority, "PatternCalendar");
  assert.equal(record.privacy.visibility, "private");
  assert.equal(record.temporal.patternDay, 218);
  assert.equal(record.payload.witnessMark.reflection, "The year is a garden that walks.");
  const bare = mark.buildMarkRecord({ pageTitle: "X", path: "x.html", reflection: "" }, TEMPORAL);
  assert.equal(bare.payload.witnessMark.reflection, null, "no reflection is a null, never an invented line");
});

test("one mark per page per day: the fold recognises today's mark and no other", () => {
  const mark = loadMark();
  const record = mark.buildMarkRecord({ pageTitle: "X", path: "x.html" }, TEMPORAL);
  assert.equal(mark.alreadyWitnessedOn([record], "x.html", "2026-11-20"), true);
  assert.equal(mark.alreadyWitnessedOn([record], "x.html", "2026-11-21"), false, "another day may be witnessed anew");
  assert.equal(mark.alreadyWitnessedOn([record], "other.html", "2026-11-20"), false, "another page is another mark");
  assert.equal(mark.alreadyWitnessedOn([], "x.html", "2026-11-20"), false);
});

test("the named wave-3 pages carry the mark: both whitepapers and Mind-Renewal", () => {
  for (const page of ["13-moon-whitepaper.html", "scroll-of-fire-codex-of-reality-remnant-whitepaper.html", "systems/mind-renewal.html"]) {
    const html = fs.readFileSync(path.join(docsRoot, page), "utf8");
    assert.ok(html.includes("data-witness-mark"), `${page} carries the witness-mark strip`);
    assert.ok(html.includes("witness-mark.js"), `${page} loads the module`);
    assert.ok(html.includes("record-helpers.js"), `${page} loads the shared record helpers before it`);
    assert.ok(html.includes("living-trail.js"), `${page} loads the trail so the day ties on`);
  }
});
