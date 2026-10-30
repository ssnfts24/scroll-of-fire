"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const scrollRoot = path.join(root, "docs", "scroll");
const data = JSON.parse(fs.readFileSync(path.join(scrollRoot, "data", "library.json"), "utf8"));
const segmentData = JSON.parse(fs.readFileSync(path.join(scrollRoot, "data", "reader-segments.json"), "utf8"));
const home = fs.readFileSync(path.join(scrollRoot, "index.html"), "utf8");
const reader = fs.readFileSync(path.join(scrollRoot, "reader.html"), "utf8");
const readerScript = fs.readFileSync(path.join(scrollRoot, "assets", "reader.js"), "utf8");
const css = fs.readFileSync(path.join(scrollRoot, "assets", "library.css"), "utf8");
const archivedSource = fs.readFileSync(path.join(root, "archive", "Full_Scroll_Unsealed", "1.0.0", "Full_Scroll_Unsealed"));
const publishedSource = fs.readFileSync(path.join(scrollRoot, data.edition.archiveUrl));
const sourceLines = publishedSource.toString("utf8").split(/\r\n|\n|\r/);
if (/(?:\r\n|\n|\r)$/.test(publishedSource.toString("utf8"))) sourceLines.pop();

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
    assert.ok(section.readerTargetId && data.sections.some(item => item.id === section.readerTargetId));
    assert.ok(section.segmentIds.length > 0, `section ${section.id} has no source segment`);
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
    assert.ok(chapter.segmentCount > 0, `Genesis ${chapter.chapter} has no rendered segments`);
    for (const id of chapter.sectionIds) {
      const section = data.sections.find(item => item.id === id);
      assert.ok(section, `Genesis ${chapter.chapter} section ${id} is not in the reader`);
      assert.equal(section.shelf, "scripture");
      assert.ok(home.includes(`reader.html?section=${encodeURIComponent(id)}#`));
    }
  }
});

test("the separate reader segment map preserves every source line exactly once and in order", () => {
  assert.equal(segmentData.sourceCommit, data.edition.sourceCommit);
  assert.equal(segmentData.sourceSha256, data.edition.sourceSha256);
  assert.equal(segmentData.coverage.sourceLineCount, sourceLines.length);
  assert.equal(segmentData.segments.length, data.coverage.segmentCount);
  const sectionsById = new Map(segmentData.sections.map(section => [section.sectionId, section]));
  const paragraphsByLine = new Array(sourceLines.length).fill(null);
  for (const paragraph of data.paragraphs) {
    for (let line = paragraph.lineStart; line <= paragraph.lineEnd; line += 1) {
      paragraphsByLine[line - 1] = paragraph.id;
    }
  }
  const slicesByLine = Array.from({ length: sourceLines.length }, () => []);
  let priorLine = 0;
  let priorEndOffset = 0;

  for (const segment of segmentData.segments) {
    const section = sectionsById.get(segment.sectionId);
    assert.ok(section, `${segment.id} has no owning section`);
    assert.ok(segment.lineStart >= section.lineStart && segment.lineEnd <= section.lineEnd);
    assert.equal(segment.sourceUrl, `https://github.com/ssnfts24/scroll-of-fire/blob/${data.edition.sourceCommit}/Full_Scroll_Unsealed#L${segment.lineStart}`);
    assert.ok(segment.text.length <= 4000, `${segment.id} exceeds the readable segment limit`);
    assert.deepEqual(segment.paragraphIds, [...new Set(segment.lineSlices.map(slice => slice[3]).filter(Boolean))]);
    assert.equal(segment.lineStart, Math.min(...segment.lineSlices.map(slice => slice[0])));
    assert.equal(segment.lineEnd, Math.max(...segment.lineSlices.map(slice => slice[0])));
    const reconstructedSegment = segment.lineSlices.map((slice, index) => {
      const [line, startOffset, endOffset] = slice;
      const text = sourceLines[line - 1].slice(startOffset, endOffset);
      return index && line !== segment.lineSlices[index - 1][0] ? `\n${text}` : text;
    }).join("");
    assert.equal(segment.text, reconstructedSegment, `${segment.id} display text differs from its source mapping`);

    for (const slice of segment.lineSlices) {
      const [line, startOffset, endOffset, paragraphId] = slice;
      assert.ok(line >= segment.lineStart && line <= segment.lineEnd);
      assert.equal(paragraphId, paragraphsByLine[line - 1]);
      assert.ok(startOffset <= endOffset);
      assert.ok(startOffset >= 0 && endOffset <= sourceLines[line - 1].length);
      assert.ok(line > priorLine || (line === priorLine && startOffset >= priorEndOffset), "segment lines are out of source order");
      priorLine = line;
      priorEndOffset = endOffset;
      slicesByLine[line - 1].push({
        startOffset,
        endOffset,
        text: sourceLines[line - 1].slice(startOffset, endOffset)
      });
    }
  }

  for (const [index, originalLine] of sourceLines.entries()) {
    const slices = slicesByLine[index].sort((left, right) => left.startOffset - right.startOffset);
    assert.ok(slices.length > 0, `source line ${index + 1} is absent from the reader mapping`);
    if (!originalLine.length) {
      assert.equal(slices.length, 1, `blank source line ${index + 1} is represented more than once`);
      assert.equal(slices[0].startOffset, 0);
      assert.equal(slices[0].endOffset, 0);
      continue;
    }
    let offset = 0;
    for (const slice of slices) {
      assert.equal(slice.startOffset, offset, `source line ${index + 1} has a gap or duplicate`);
      offset = slice.endOffset;
    }
    assert.equal(offset, originalLine.length, `source line ${index + 1} is truncated`);
    assert.equal(slices.map(slice => slice.text).join(""), originalLine, `source line ${index + 1} changed`);
  }

  assert.equal(segmentData.coverage.sourceNonblankLineCount, sourceLines.filter(line => line.trim()).length);
  assert.equal(data.coverage.maximumRenderedSegmentLength, Math.max(...segmentData.segments.map(segment => segment.text.length)));
});

test("Genesis routes contain their own complete chapter ranges, including nested headings", () => {
  for (const chapter of data.coverage.genesisChapters) {
    const segments = segmentData.segments.filter(segment => segment.genesisChapter === chapter.chapter);
    const firstOccurrence = data.sections.find(section => section.id === chapter.sectionIds[0]);
    assert.ok(segments.length, `Genesis ${chapter.chapter} rendered no content`);
    assert.ok(segments.some(segment => segment.sectionId === firstOccurrence.id && segment.kind === "heading"));
    assert.ok(segments.some(segment => segment.kind === "text" && segment.text.trim()), `Genesis ${chapter.chapter} has no body text`);
    assert.equal(chapter.lineStart, firstOccurrence.line);
    if (chapter.chapter < 50) {
      const nextChapter = data.coverage.genesisChapters[chapter.chapter];
      const nextSection = data.sections.find(section => section.id === nextChapter.sectionIds[0]);
      const next = nextSection.line;
      assert.equal(chapter.lineEnd, next - 1, `Genesis ${chapter.chapter} spills across the next chapter boundary`);
      assert.ok(segments.every(segment => segment.lineEnd < next));
      assert.ok(!segments.some(segment => segment.text.includes(nextSection.title)));
    }
  }

  for (const chapterNumber of [3, 4, 6, 11, 24, 50]) {
    const chapter = data.coverage.genesisChapters[chapterNumber - 1];
    const segments = segmentData.segments.filter(segment => segment.genesisChapter === chapterNumber);
    const title = data.sections.find(section => section.id === chapter.sectionIds[0]).title;
    assert.ok(segments.some(segment => segment.text === title), `Genesis ${chapterNumber} title is absent`);
    assert.ok(segments.some(segment => segment.kind === "text" && segment.text.trim()), `Genesis ${chapterNumber} body is absent`);
  }
  assert.ok(segmentData.segments.filter(segment => segment.genesisChapter === 24)
    .some(segment => segment.sectionId === data.coverage.genesisChapters[23].sectionIds[1]), "Genesis 24 continuation is missing");
  assert.ok(segmentData.segments.filter(segment => segment.genesisChapter === 50)
    .every(segment => segment.lineEnd < data.sections.find(section => section.title === "HEBREW TERMS GLOSSARY (ENRICHED & CORRECTED)").line));
});

test("empty structural headings resolve to contextual content rather than blank reader pages", () => {
  const sectionsById = new Map(data.sections.map(section => [section.id, section]));
  for (const section of data.sections) {
    const target = sectionsById.get(section.readerTargetId);
    assert.ok(target, `${section.id} has no reader target`);
    const visible = segmentData.segments.filter(segment =>
      target.type === "genesis-chapter"
        ? segment.genesisChapter === target.label
        : segment.sectionId === target.id || sectionsById.get(segment.sectionId)?.readerTargetId === target.id);
    assert.ok(visible.some(segment => segment.text.trim()), `${section.id} resolves to an empty reader page`);
  }
  assert.equal(data.coverage.sectionsWithoutDirectBody,
    data.coverage.trueEmptyStructuralHeadings + data.coverage.chapterContextSections);
});

test("duplicate source headings link to every retained occurrence", () => {
  assert.ok(data.duplicateGroups.length > 0);
  for (const duplicate of data.duplicateGroups) {
    assert.ok(duplicate.sectionIds.length > 1);
    for (const id of duplicate.sectionIds) {
      assert.ok(home.includes(`reader.html?section=${encodeURIComponent(id)}#`), `duplicate occurrence ${id} is not accessible`);
    }
  }
  assert.match(home, /All \d+ occurrences:/);
  assert.match(readerScript, /This heading appears/);
});

test("reader provides RTL handling, persistent reading controls, print, and reduced motion", () => {
  assert.match(readerScript, /content\.dir = "auto"/);
  assert.match(readerScript, /localStorage/);
  assert.match(readerScript, /querySelector\("\[data-theme-toggle\]"\)/);
  assert.match(readerScript, /sourceLink\(segment\.sourceUrl/);
  assert.match(readerScript, /reader-segments\.json/);
  assert.match(readerScript, /segment\.genesisChapter === selected\.label/);
  assert.match(readerScript, /heading\.id = titleSegment\?\.id/);
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
  const regeneratedSegments = JSON.parse(fs.readFileSync(path.join(scrollRoot, "data", "reader-segments.json"), "utf8"));
  assert.equal(regenerated.edition.sourceSha256, data.edition.sourceSha256);
  assert.equal(regenerated.paragraphs.length, data.paragraphs.length);
  assert.deepEqual(regenerated.paragraphs, data.paragraphs);
  assert.deepEqual(regeneratedSegments, segmentData);
});
