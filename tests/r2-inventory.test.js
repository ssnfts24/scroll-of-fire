"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const r2 = path.join(root, "site-audit", "r2");
const registry = JSON.parse(fs.readFileSync(path.join(r2, "CODEX_R2_RESOURCE_REGISTRY.json"), "utf8"));
const approved = JSON.parse(fs.readFileSync(path.join(r2, "CODEX_R2_APPROVED_PUBLIC_MANIFEST.json"), "utf8"));
const FROZEN = "81a015fb937f1664c2383fa38fddf956d281c6309a9584382c6dbc9d8b691400";
const VOCAB = new Set(registry.statusVocabulary);
const sha = f => crypto.createHash("sha256").update(fs.readFileSync(path.join(root, f))).digest("hex");

test("R2 reports are current", () => {
  execFileSync("node", ["scripts/build-r2-inventory.mjs", "--check"], { cwd: root, stdio: "pipe" });
});

test("every file in the registry exists, is hashed, and is classified", () => {
  assert.ok(registry.resources.length > 1500);
  for (const r of registry.resources) {
    assert.ok(fs.existsSync(path.join(root, r.path)), r.path);
    assert.match(r.sha256, /^[0-9a-f]{64}$/);
    assert.notEqual(r.group, "unclassified", r.path);
    assert.notEqual(r.publicationEligibility, "unclassified", r.path);
    assert.ok(VOCAB.has(r.status) || ["live", "source-only", "planned"].includes(r.status), `${r.path}: ${r.status}`);
  }
  const ids = registry.resources.map(r => r.id);
  assert.equal(new Set(ids).size, ids.length, "resource IDs are unique");
});

test("registry hashes match files on disk (protected and document files)", () => {
  const sample = registry.resources.filter(r => /^(archive\/|Full_Scroll_Unsealed$|7_Ledger)/.test(r.path) || r.extract);
  assert.ok(sample.length > 60);
  for (const r of sample) assert.equal(sha(r.path), r.sha256, r.path);
});

test("frozen original is byte-identical in all three locations", () => {
  assert.equal(registry.integrityProof.allMatch, true);
  for (const f of ["Full_Scroll_Unsealed", "archive/Full_Scroll_Unsealed/1.0.0/Full_Scroll_Unsealed", "docs/scroll/archive/Full_Scroll_Unsealed.txt"]) assert.equal(sha(f), FROZEN, f);
  const r = registry.resources.find(x => x.path === "Full_Scroll_Unsealed");
  assert.equal(r.publicationEligibility, "protected-immutable");
});

test("registry does not claim verification it has not performed", () => {
  for (const r of registry.resources) {
    assert.notEqual(r.status, "verified", r.path);
    for (const [k, v] of Object.entries(r.reviews)) assert.ok(!/^(verified|complete)$/.test(v), `${r.path} ${k}`);
  }
});

test("every PDF, DOCX, TXT and ZIP has extraction evidence", () => {
  for (const r of registry.resources.filter(x => ["pdf", "docx", "txt", "zip"].includes(x.format))) {
    assert.ok(r.extract, `${r.path} has no extraction record`);
    assert.notEqual(r.examination, "inventoried-only", r.path);
  }
});

test("approved-public manifest contains only approved, hashed, deployed files", () => {
  assert.ok(approved.approved.length > 1000);
  for (const a of approved.approved) {
    assert.ok(a.path.startsWith("docs/"), a.path);
    assert.equal(sha(a.path), a.sha256, a.path);
  }
  const approvedPaths = new Set(approved.approved.map(a => a.path));
  for (const d of approved.needsDecision) assert.ok(!approvedPaths.has(d.path), d.path);
});

test("witness, scribe, symbol, handoff and unlabelled-image material is never approved-public", () => {
  for (const r of registry.resources) {
    if (/^(2_Witness_Scrolls|5_Living_Scribe|6_Images_and_Symbols)\//.test(r.path) || r.group === "unlabelled-image" || r.group === "dev-handoff") {
      assert.notEqual(r.publicationEligibility, "approved-public", r.path);
      assert.equal(r.deployed, false, r.path);
    }
  }
});

test("scripture scan covers all 50 Genesis and 40 Exodus chapters", () => {
  const scan = JSON.parse(fs.readFileSync(path.join(r2, "scripture-preliminary-scan.json"), "utf8"));
  assert.equal(new Set(scan.Genesis.map(c => c.chapter)).size, 50);
  assert.equal(new Set(scan.Exodus.map(c => c.chapter)).size, 40);
  assert.match(scan.note, /Preliminary/);
});

test("Atlas filter form stays hidden without JavaScript", () => {
  const css = fs.readFileSync(path.join(root, "docs/assets/css/site-atlas.css"), "utf8");
  const html = fs.readFileSync(path.join(root, "docs/codex-atlas.html"), "utf8");
  assert.match(css, /\.atlas-filters\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(html, /<noscript>[\s\S]*Filtering needs JavaScript/);
  assert.ok((html.match(/class="atlas-card/g) || []).length >= 63);
});
