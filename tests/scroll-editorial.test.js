"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const archivePath = path.join(root, "archive/Full_Scroll_Unsealed/1.0.0/Full_Scroll_Unsealed");
const archive = fs.readFileSync(archivePath);
const source = archive.toString("utf8").split(/\r\n|\n|\r/);
if (/(?:\r\n|\n|\r)$/.test(archive.toString("utf8"))) source.pop();
const hash = crypto.createHash("sha256").update(archive).digest("hex");
const edition = JSON.parse(fs.readFileSync(path.join(root, "docs/scroll/data/editorial-edition.json"), "utf8"));
const register = JSON.parse(fs.readFileSync(path.join(root, "docs/scroll/evidence/claim-register.json"), "utf8"));
const builder = fs.readFileSync(path.join(root, "scripts/build-scroll-editorial.mjs"), "utf8");
const page = fs.readFileSync(path.join(root, "docs/scroll/editorial.html"), "utf8");
const reader = fs.readFileSync(path.join(root, "docs/scroll/reader.html"), "utf8");
const homepage = fs.readFileSync(path.join(root, "docs/scroll/index.html"), "utf8");

test("the separate editorial edition is pinned to the unchanged frozen manuscript", () => {
  assert.equal(hash, "81a015fb937f1664c2383fa38fddf956d281c6309a9584382c6dbc9d8b691400");
  assert.equal(edition.sourceSha256, hash);
  assert.equal(register.sourceSha256, hash);
  assert.equal(edition.sourceCommit, register.sourceCommit);
  assert.equal(fs.readFileSync(archivePath).length, 610424);
});

test("both repeated political sequences and both evidence archive occurrences remain linked", () => {
  assert.deepEqual(edition.originalOccurrences.map(item => [item.lineStart, item.lineEnd]), [
    [596, 740], [3265, 3437], [793, 938], [3505, 3653]
  ]);
  assert.match(edition.editorialNote, /links all complete political and evidence-archive occurrences/);
  for (const occurrence of edition.originalOccurrences) {
    assert.ok(source.slice(occurrence.lineStart - 1, occurrence.lineEnd).length > 0);
  }
});

test("the reading edition removes leader-as-savior language but retains spiritual and institutional critique", () => {
  const text = edition.sections.map(section => section.heading + "\n" + section.text).join("\n");
  assert.doesNotMatch(text, /Trump Was the First Firewall|Trump was a battering ram|first one bold enough/i);
  assert.match(text, /censorship, surveillance, political influence/i);
  assert.match(text, /The spiritual reading remains the author’s/);
  assert.match(text, /Ephesians 6:12/);
  assert.ok(edition.sections.some(section => section.classification === "author interpretation"));
});

test("every editorial section links to nonblank original manuscript lines", () => {
  for (const section of edition.sections) {
    assert.ok(section.sourceLines.length, `${section.id} has original source lines`);
    for (const line of section.sourceLines) {
      assert.ok(Number.isInteger(line) && line > 0 && source[line - 1]?.trim(), `${section.id} line ${line}`);
    }
  }
});

test("each claim quotes exact original lines and points to the pinned source", () => {
  assert.equal(register.claims.length, 21);
  const ids = new Set();
  for (const claim of register.claims) {
    assert.ok(!ids.has(claim.id), `duplicate claim id ${claim.id}`);
    ids.add(claim.id);
    assert.ok(claim.originalStatements.length > 0, `${claim.id} has original text`);
    for (const statement of claim.originalStatements) {
      const expected = statement.text.split("\n");
      for (const line of expected) assert.ok(source.slice(statement.lineStart - 1, statement.lineEnd).includes(line), `${claim.id}: original quote must match source`);
      assert.match(statement.sourceUrl, new RegExp(register.sourceCommit));
      assert.match(statement.sourceUrl, new RegExp(`#L${statement.lineStart}$`));
    }
  }
});

test("claim records distinguish source scope, contradiction, and editorial change", () => {
  const required = ["establishes", "unverified", "contradictoryEvidence", "editorialChange"];
  for (const claim of register.claims) {
    for (const key of required) assert.ok(claim[key].trim().length > 10, `${claim.id}.${key}`);
    for (const source of claim.sources) {
      assert.match(source.date, /^\d{4}-\d{2}(-\d{2})?$/);
      assert.match(source.url, /^https:\/\//);
      assert.ok(source.title && source.publisher && source.establishes && source.limits, claim.id);
    }
  }
  assert.ok(register.claims.some(claim => claim.status === "needs-verification" && claim.sources.length === 0));
  assert.ok(register.claims.some(claim => claim.sources.length > 0));
});

test("source statements include both copies where the source claim appears in both political sequences", () => {
  for (const id of ["QAT-001", "FSA-001", "INS-001", "LAPTOP-001", "CHAR-001", "DISINFECTANT-001"]) {
    const claim = register.claims.find(item => item.id === id);
    assert.ok(claim, id);
    const occurrences = new Set(claim.originalStatements.map(statement => statement.occurrence));
    assert.ok(occurrences.has("Political sequence 1"), `${id} first political occurrence`);
    assert.ok(occurrences.has("Political sequence 2"), `${id} second political occurrence`);
  }
  const fisa = register.claims.find(item => item.id === "FISA-001");
  assert.ok(fisa.originalStatements.some(statement => statement.occurrence === "Evidence archive 1"));
  assert.ok(fisa.originalStatements.some(statement => statement.occurrence === "Evidence archive 2"));
});

test("editorial route, evidence register, and change log are discoverable", () => {
  assert.match(page, /editorial\.js/);
  assert.match(page, /EVIDENCE_REGISTER\.md/);
  assert.match(homepage, /editorial\.html/);
  assert.match(reader, /editorial\.html/);
  assert.ok(fs.existsSync(path.join(root, "EVIDENCE_REGISTER.md")));
  assert.ok(fs.existsSync(path.join(root, "EDITORIAL_CHANGELOG.md")));
  assert.ok(fs.readFileSync(path.join(root, "docs/sitemap.xml"), "utf8").includes("/scroll/editorial.html"));
});

test("editorial artifacts are reproducible and source parser does not modify the archive", () => {
  const output = execFileSync(process.execPath, [path.join(root, "scripts/build-scroll-editorial.mjs"), "--check"], {
    cwd: root,
    encoding: "utf8"
  });
  assert.match(output, /reproduce byte-for-byte/);
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(archivePath)).digest("hex"), hash);
});

test("the phase keeps reader maps, search data, archive, and protected runtimes out of the diff", () => {
  const files = execFileSync("git", ["diff", "--name-only", "HEAD^", "HEAD"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  for (const file of files) {
    assert.doesNotMatch(file, /^archive\//, file);
    assert.notEqual(file, "docs/scroll/data/library.json", file);
    assert.notEqual(file, "docs/scroll/data/reader-segments.json", file);
    assert.doesNotMatch(file, /^docs\/scroll\/search\//, file);
    assert.notEqual(file, "docs/service-worker.js", file);
    assert.doesNotMatch(file, /observatory|calendar|renderer/i, file);
  }
});
