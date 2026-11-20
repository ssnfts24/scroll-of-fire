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

// Seals at landing (foundation F6 — SEALS-AT-LANDING-PLAN.md): the committed seals
// describe the tree at the last landing — the "seal commit", the newest commit that
// touched the registry. Files changed since then are this branch's work and are
// pending re-seal: their seal entries are checked for internal consistency, not
// against disk. Files the branch did NOT touch stay fully disk-checked, and
// protected files (frozen archive, ledger, public Scroll copy) are disk-checked
// always — no branch may move them behind a pending re-seal.
const PROTECTED_PATH = /^(archive\/|Full_Scroll_Unsealed$|7_Ledger_and_Documentation\/|docs\/scroll\/archive\/)/;
const SEAL_OUTPUTS = ["CODEX_R2_RESOURCE_REGISTRY.json", "CODEX_R2_APPROVED_PUBLIC_MANIFEST.json", "CODEX_R2_MASTER_INVENTORY.md", "CODEX_R2_DUPLICATE_MAP.md", "CODEX_R2_PUBLICATION_REVIEW.md", "CODEX_R2_DEPENDENCY_MAP.md", "CODEX_R2_KNOWN_DEFECTS.md", "scripture-preliminary-scan.json", "document-extracts.json"];
let sealCommit = null;
let changedSinceSeal = new Set();
try {
  sealCommit = execFileSync("git", ["log", "-1", "--format=%H", "--", "site-audit/r2/CODEX_R2_RESOURCE_REGISTRY.json"], { cwd: root }).toString("utf8").trim() || null;
  if (sealCommit) {
    const out = execFileSync("git", ["diff", "--name-only", "-z", sealCommit, "--", "."], { cwd: root, maxBuffer: 1 << 26 }).toString("utf8");
    changedSinceSeal = new Set(out.split("\0").filter(Boolean));
  }
} catch { /* no usable git history: changedSinceSeal stays empty, so every check below is disk-strict, exactly as before */ }
const pendingReseal = p => changedSinceSeal.has(p) && !PROTECTED_PATH.test(p);
const registryByPath = new Map(registry.resources.map(r => [r.path, r]));

test("inventory generators use only index-listed paths, excluding untracked artifacts", () => {
  const inventoryBuilder = fs.readFileSync(path.join(root, "scripts/build-r2-inventory.mjs"), "utf8");
  const catalogBuilder = fs.readFileSync(path.join(root, "scripts/build-site-catalog.mjs"), "utf8");
  assert.match(inventoryBuilder, /"ls-files", "-z", "--cached"/);
  assert.doesNotMatch(inventoryBuilder, /"--others"/);
  assert.match(catalogBuilder, /"ls-files", "-z", "--cached"/);
  assert.doesNotMatch(catalogBuilder, /"--others"/);

  const dir = path.join(root, `.site-scan-race-probe-${process.pid}`);
  const probe = path.join(dir, "page.html");
  fs.mkdirSync(dir);
  fs.writeFileSync(probe, "<html>temporary test artifact</html>\n");
  try {
    const indexedPaths = execFileSync("git", ["ls-files", "-z", "--cached"], { cwd: root }).toString("utf8").split("\0");
    assert.ok(!indexedPaths.includes(path.relative(root, probe)), "temporary probe must not be in the index");
  } finally {
    fs.unlinkSync(probe);
    fs.rmdirSync(dir);
  }
});

test("every file in the registry exists, is hashed, and is classified", () => {
  assert.ok(registry.resources.length > 1500);
  for (const r of registry.resources) {
    assert.ok(fs.existsSync(path.join(root, r.path)) || pendingReseal(r.path), r.path);
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
  // Files this branch changed are pending re-seal; protected files never are
  // (pendingReseal excludes them), so the frozen/ledger sample stays disk-strict.
  for (const r of sample) { if (pendingReseal(r.path)) continue; assert.equal(sha(r.path), r.sha256, r.path); }
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
    if (pendingReseal(a.path)) {
      // Branch-changed file: the manifest must still agree with the sealed
      // registry itself; its disk hash is proven at landing by strict check.
      assert.equal(a.sha256, registryByPath.get(a.path)?.sha256, `${a.path}: manifest disagrees with sealed registry`);
    } else {
      assert.equal(sha(a.path), a.sha256, a.path);
    }
  }
  const approvedPaths = new Set(approved.approved.map(a => a.path));
  for (const d of approved.needsDecision) assert.ok(!approvedPaths.has(d.path), d.path);
});

test("committed seals are main's landing seal, untouched by this branch", () => {
  assert.equal(registry.integrityProof.allMatch, true);
  if (!sealCommit) return; // no git history in this checkout: nothing further can be proven here
  // The seal commit must be an ancestor of HEAD: the seals on any branch are
  // main's seals, carried — never a branch's own regeneration.
  execFileSync("git", ["merge-base", "--is-ancestor", sealCommit, "HEAD"], { cwd: root });
  for (const name of SEAL_OUTPUTS) {
    assert.ok(!changedSinceSeal.has("site-audit/r2/" + name), `${name} changed since the landing seal — branches do not carry seals (SEALS-AT-LANDING-PLAN.md)`);
  }
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
  const catalog = JSON.parse(fs.readFileSync(path.join(root, "docs/data/site-catalog.json"), "utf8"));
  assert.equal((html.match(/data-atlas-card(?:[ >])/g) || []).length, catalog.entries.length);
});
