"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const archive = path.join(root, "archive", "Full_Scroll_Unsealed", "1.0.0");
const originalPath = path.join(root, "Full_Scroll_Unsealed");
const frozenPath = path.join(archive, "Full_Scroll_Unsealed");
const manifest = JSON.parse(fs.readFileSync(path.join(archive, "edition.json"), "utf8"));
const map = JSON.parse(fs.readFileSync(path.join(archive, "paragraph-map.json"), "utf8"));
const audit = JSON.parse(fs.readFileSync(path.join(archive, "content-audit.json"), "utf8"));

function hash(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function decodeLines(bytes) {
  const text = bytes.toString("utf8");
  const lines = text.split(/\r\n|\n|\r/);
  if (/(?:\r\n|\n|\r)$/.test(text)) lines.pop();
  return lines;
}

test("the archival edition is byte-identical to the source at the recorded main commit", () => {
  const original = fs.readFileSync(originalPath);
  const frozen = fs.readFileSync(frozenPath);
  const committed = execFileSync("git", ["show", `${manifest.sourceCommit}:Full_Scroll_Unsealed`], { cwd: root });

  assert.deepEqual(frozen, original);
  assert.deepEqual(frozen, committed);
  assert.equal(hash(frozen), manifest.sha256);
  assert.equal(frozen.length, manifest.byteLength);
  assert.equal(manifest.editionVersion, "1.0.0");
  assert.equal(manifest.preservation, "byte-for-byte copy; the root manuscript remains unchanged");
});

test("every nonempty original line maps exactly once with stable source provenance", () => {
  const sourceLines = decodeLines(fs.readFileSync(frozenPath));
  const coverage = new Array(sourceLines.length).fill(0);
  const reconstructedLines = sourceLines.map(line => line.trim() ? "" : line);
  const paragraphIds = new Set();
  const paragraphsById = new Map(map.paragraphs.map(paragraph => [paragraph.id, paragraph]));
  const commitPath = `https://github.com/ssnfts24/scroll-of-fire/blob/${manifest.sourceCommit}/Full_Scroll_Unsealed#L`;

  for (const paragraph of map.paragraphs) {
    assert.ok(!paragraphIds.has(paragraph.id), `duplicate paragraph ID ${paragraph.id}`);
    paragraphIds.add(paragraph.id);
    assert.match(paragraph.id, /^paragraph-line-\d{6}$/);
    assert.equal(paragraph.sourceUrl, `${commitPath}${paragraph.lineStart}`);
    assert.ok(paragraph.lineStart >= 1 && paragraph.lineEnd <= sourceLines.length);
    assert.equal(paragraph.lineCount, paragraph.lineEnd - paragraph.lineStart + 1);
    const textLines = paragraph.text.split("\n");
    assert.equal(textLines.length, paragraph.lineCount);
    assert.deepEqual(textLines, sourceLines.slice(paragraph.lineStart - 1, paragraph.lineEnd));
    assert.equal(
      paragraph.normalizedTextSha256,
      hash(Buffer.from(paragraph.text, "utf8"))
    );
    for (let line = paragraph.lineStart; line <= paragraph.lineEnd; line += 1) {
      coverage[line - 1] += 1;
      reconstructedLines[line - 1] = sourceLines[line - 1];
      assert.notEqual(sourceLines[line - 1].trim(), "", `blank line ${line} was mapped as paragraph content`);
    }
  }

  sourceLines.forEach((line, index) => {
    assert.equal(coverage[index], line.trim() ? 1 : 0, `unexpected paragraph mapping at line ${index + 1}`);
  });
  assert.deepEqual(reconstructedLines, sourceLines);
  assert.equal(map.sourceSha256, manifest.sha256);
  assert.equal(map.lineCount, sourceLines.length);
  assert.equal(map.paragraphCount, map.paragraphs.length);
  for (const section of map.sections) {
    assert.match(section.id, /^section-line-\d{6}$/);
    assert.equal(section.sourceUrl, `${commitPath}${section.line}`);
  }
});

test("the content audit diagnoses duplicate sequences and inventories Genesis and appendices", () => {
  const paragraphsById = new Map(map.paragraphs.map(paragraph => [paragraph.id, paragraph]));
  assert.deepEqual(audit.diagnostics.missingGenesisChapters, []);
  assert.equal(audit.genesisChapters.length, 50);
  assert.ok(audit.genesisChapters.every(chapter => chapter.occurrences.length > 0));
  assert.equal(audit.genesisChapters[0].occurrences.length, 1, "Genesis 1–50 overview is not a chapter heading");
  assert.deepEqual(audit.diagnostics.missingParts, []);
  assert.ok(audit.partSequenceRuns.length >= 2, "the duplicated Part I–XVIII sequence must remain visible");
  assert.ok(audit.parts.every(part => part.occurrences.length >= 2));
  assert.ok(audit.appendices.length > 0);
  assert.ok(audit.hebrewTerms.length > 0);
  assert.equal(audit.claimReview.status, "inventory only; factual claim verification is outside PR 1");
  assert.equal(audit.summary.claimReviewCandidates, audit.claimReview.candidateParagraphIds.length);
  for (const paragraphId of audit.claimReview.candidateParagraphIds) {
    assert.equal(paragraphsById.get(paragraphId)?.kind, "text", `claim candidate ${paragraphId} has no mapped source text`);
  }
  assert.ok(audit.repeatedBoilerplate.occurrenceCount > 0);
});

test("the committed provenance artifacts are reproducible", () => {
  execFileSync("node", ["scripts/scroll-source-audit.mjs", "audit"], { cwd: root, stdio: "pipe" });
});
