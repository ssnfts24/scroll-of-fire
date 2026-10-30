"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const scrollRoot = path.join(root, "docs", "scroll");
const data = JSON.parse(fs.readFileSync(path.join(scrollRoot, "data", "library.json"), "utf8"));
const home = fs.readFileSync(path.join(scrollRoot, "index.html"), "utf8");
const reader = fs.readFileSync(path.join(scrollRoot, "reader.html"), "utf8");
const readerScript = fs.readFileSync(path.join(scrollRoot, "assets", "reader.js"), "utf8");
const css = fs.readFileSync(path.join(scrollRoot, "assets", "library.css"), "utf8");
const archivedSource = fs.readFileSync(path.join(root, "archive", "Full_Scroll_Unsealed", "1.0.0", "Full_Scroll_Unsealed"));
const publishedSource = fs.readFileSync(path.join(scrollRoot, data.edition.archiveUrl));

function hash(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

test("the library publishes the exact frozen source and all original paragraph text", () => {
  assert.deepEqual(publishedSource, archivedSource);
  assert.equal(hash(publishedSource), data.edition.sourceSha256);
  assert.equal(data.paragraphs.length, data.coverage.paragraphCount);
  assert.equal(data.coverage.allSourceParagraphsIncluded, true);
  for (const paragraph of data.paragraphs) {
    assert.ok(paragraph.text.length > 0, `${paragraph.id} is empty`);
    assert.equal(paragraph.sourceUrl, `https://github.com/ssnfts24/scroll-of-fire/blob/${data.edition.sourceCommit}/Full_Scroll_Unsealed#L${paragraph.lineStart}`);
    assert.ok(paragraph.lineStart <= paragraph.lineEnd);
    assert.ok(data.sections.some(section => section.id === paragraph.sectionId), `${paragraph.id} has no reading section`);
  }
  assert.ok(data.paragraphs.some(paragraph => /\p{Script=Hebrew}/u.test(paragraph.text)), "Hebrew source text is missing from reader data");
});

test("all eight shelves and all mapped sections have a reader route", () => {
  for (const shelf of ["Foundations", "Scripture", "History", "Evidence", "Technology", "Prophecy", "Witness", "Reference"]) {
    assert.ok(home.includes(shelf), `missing shelf ${shelf}`);
  }
  for (const section of data.sections) {
    assert.ok(home.includes(encodeURIComponent(section.id)), `missing index route for ${section.id}`);
    assert.ok(section.sourceUrl.startsWith(`https://github.com/ssnfts24/scroll-of-fire/blob/${data.edition.sourceCommit}/Full_Scroll_Unsealed#L`));
  }
  assert.ok(home.includes("archive/Full_Scroll_Unsealed.txt"));
  assert.match(reader, /data-toc/);
  assert.match(reader, /data-previous/);
  assert.match(reader, /data-next/);
  assert.match(home, /class="mobile-menu"/);
  assert.match(home, /aria-label="Library navigation"/);
});

test("all 50 Genesis chapter entries link to an accessible source section", () => {
  assert.equal(data.coverage.genesisChapters.length, 50);
  for (const chapter of data.coverage.genesisChapters) {
    assert.ok(chapter.sectionIds.length > 0, `Genesis ${chapter.chapter} is missing`);
    for (const id of chapter.sectionIds) {
      const section = data.sections.find(item => item.id === id);
      assert.ok(section, `Genesis ${chapter.chapter} section ${id} is not in the reader`);
      assert.equal(section.shelf, "scripture");
      assert.ok(home.includes(`reader.html?section=${encodeURIComponent(id)}#reading`));
    }
  }
});

test("duplicate source headings link to every retained occurrence", () => {
  assert.ok(data.duplicateGroups.length > 0);
  for (const duplicate of data.duplicateGroups) {
    assert.ok(duplicate.sectionIds.length > 1);
    for (const id of duplicate.sectionIds) {
      assert.ok(home.includes(`reader.html?section=${encodeURIComponent(id)}#reading`), `duplicate occurrence ${id} is not accessible`);
    }
  }
  assert.match(home, /All \d+ occurrences:/);
  assert.match(readerScript, /This heading appears/);
});

test("reader provides RTL handling, persistent reading controls, print, and reduced motion", () => {
  assert.match(readerScript, /content\.dir = "auto"/);
  assert.match(readerScript, /localStorage/);
  assert.match(readerScript, /querySelector\("\[data-theme-toggle\]"\)/);
  assert.match(readerScript, /sourceLink\(paragraph\.sourceUrl/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 360px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media print/);
  assert.match(css, /:root\[data-theme="dark"\]/);
  assert.match(css, /:root\[data-theme="light"\]/);
});

test("the static reader data is reproducible from the preserved manuscript", () => {
  const { execFileSync } = require("node:child_process");
  execFileSync("node", ["scripts/build-scroll-library.mjs"], { cwd: root, stdio: "pipe" });
  const regenerated = JSON.parse(fs.readFileSync(path.join(scrollRoot, "data", "library.json"), "utf8"));
  assert.equal(regenerated.edition.sourceSha256, data.edition.sourceSha256);
  assert.equal(regenerated.paragraphs.length, data.paragraphs.length);
  assert.deepEqual(regenerated.paragraphs, data.paragraphs);
});
