import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildReaderSegments } from "./lib/reader-segments.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const editionRoot = path.join(root, "archive", "Full_Scroll_Unsealed", "1.0.0");
const outputRoot = path.join(root, "docs", "scroll");
const map = JSON.parse(fs.readFileSync(path.join(editionRoot, "paragraph-map.json"), "utf8"));
const audit = JSON.parse(fs.readFileSync(path.join(editionRoot, "content-audit.json"), "utf8"));
const edition = JSON.parse(fs.readFileSync(path.join(editionRoot, "edition.json"), "utf8"));
const sourcePath = path.join(editionRoot, "Full_Scroll_Unsealed");
const sourceBytes = fs.readFileSync(sourcePath);
const sourceText = sourceBytes.toString("utf8");
const sourceLines = sourceText.split(/\r\n|\n|\r/);
if (/(?:\r\n|\n|\r)$/.test(sourceText)) sourceLines.pop();
const shelves = [
  { id: "foundations", title: "Foundations", note: "Opening declarations, purpose, and the manuscript’s first movements.", icon: "01" },
  { id: "scripture", title: "Scripture", note: "Genesis and other scripture-rooted passages in the original sequence.", icon: "02" },
  { id: "history", title: "History", note: "Historical subjects and chronology as presented in the manuscript.", icon: "03" },
  { id: "evidence", title: "Evidence", note: "Evidence archives and testimony; claims remain the author’s unless separately verified.", icon: "04" },
  { id: "technology", title: "Technology", note: "Digital systems, artificial intelligence, and technology-related passages.", icon: "05" },
  { id: "prophecy", title: "Prophecy", note: "Prophetic readings, symbolism, and future-facing interpretation.", icon: "06" },
  { id: "witness", title: "Witness", note: "Personal testimony, declarations, prayer, and remnant identity.", icon: "07" },
  { id: "reference", title: "Reference", note: "Appendices, indices, glossary passages, and remaining source sections.", icon: "08" }
];
function hash(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[character]);
}

function classify(section) {
  const title = section.title.toLocaleLowerCase("en");
  if (section.type === "genesis-chapter" || /\b(genesis|exodus|scripture|psalm|bible|hebrew|covenant)\b/.test(title)) return "scripture";
  if (/\b(history|histor|empire|fire|orphan|century|timeline|world.?s fair)\b/.test(title)) return "history";
  if (/\b(evidence|proof|testimony|archive|confirm|claim|witness report)\b/.test(title)) return "evidence";
  if (/\b(technology|digital|artificial intelligence|ai doctrine|machine|network|surveillance|code|system|frequency|science|quantum)\b/.test(title)) return "technology";
  if (/\b(prophe|revelation|end.?time|babylon|enoch|beast|war|cosmic|hidden|watchman)\b/.test(title)) return "prophecy";
  if (/\b(witness|prayer|remnant|blessing|testimony|declaration|identity|activation)\b/.test(title)) return "witness";
  if (section.line < 595) return "foundations";
  if (section.type === "appendix" || /\b(index|glossary|reference|contents|appendix)\b/.test(title)) return "reference";
  return "reference";
}

const segmented = buildReaderSegments({
  lines: sourceLines,
  sections: map.sections,
  paragraphs: map.paragraphs,
  sourceCommit: edition.sourceCommit
});
const sections = segmented.sections.map(section => ({
  ...section,
  shelf: classify(section),
  originalUrl: section.sourceUrl
}));
const segments = segmented.segments;
const sectionById = new Map(sections.map(section => [section.id, section]));
const shelfSections = Object.fromEntries(shelves.map(shelf => [shelf.id, sections.filter(section => section.shelf === shelf.id)]));
function sectionReaderHref(section) {
  return `reader.html?section=${encodeURIComponent(section.id)}#reading`;
}
const groupedDuplicateSections = new Map();
for (const group of audit.duplicateHeadings) {
  const ids = group.sectionIds.filter(id => sectionById.has(id));
  if (ids.length > 1) groupedDuplicateSections.set(`${group.type}:${group.title}`, ids);
}
const duplicateBySection = new Map();
for (const [key, ids] of groupedDuplicateSections) {
  for (const id of ids) duplicateBySection.set(id, { key, sectionIds: ids });
}
const data = {
  schemaVersion: 2,
  edition: {
    title: edition.title,
    version: edition.editionVersion,
    sourceCommit: edition.sourceCommit,
    sourceSha256: edition.sha256,
    byteLength: edition.byteLength,
    sourceLines: edition.lineCount,
    sourceUrl: audit.sourceUrl,
    archiveUrl: "archive/Full_Scroll_Unsealed.txt",
    archiveMetadataUrl: "archive/edition.json"
  },
  shelves,
  sections,
  paragraphs: map.paragraphs.map(paragraph => ({
    id: paragraph.id,
    lineStart: paragraph.lineStart,
    lineEnd: paragraph.lineEnd,
    lineCount: paragraph.lineCount,
    sectionId: paragraph.sectionId ?? "section-opening-matter",
    kind: paragraph.kind,
    text: paragraph.text,
    sourceUrl: paragraph.sourceUrl
  })),
  duplicateGroups: [...groupedDuplicateSections.entries()].map(([key, sectionIds]) => ({
    key,
    sectionIds,
    title: sectionById.get(sectionIds[0]).title
  })),
  coverage: {
    paragraphCount: map.paragraphCount,
    sectionCount: sections.length,
    contentBearingSections: segmented.coverage.contentBearingSections,
    sectionsWithoutDirectBody: segmented.coverage.sectionsWithoutDirectBody,
    trueEmptyStructuralHeadings: segmented.coverage.trueEmptyStructuralHeadings,
    chapterContextSections: segmented.coverage.chapterContextSections,
    segmentCount: segmented.coverage.segmentCount,
    sourceLineCount: segmented.coverage.sourceLineCount,
    sourceNonblankLineCount: segmented.coverage.sourceNonblankLineCount,
    maximumRenderedSegmentLength: segmented.coverage.maximumRenderedSegmentLength,
    maximumSegmentLineCount: segmented.coverage.maximumSegmentLineCount,
    genesisChapters: segmented.genesisChapters,
    duplicateSectionCount: [...duplicateBySection.keys()].length,
    allSourceParagraphsIncluded: map.paragraphs.length === audit.summary.paragraphs
  }
};
const segmentData = {
  schemaVersion: 1,
  editionVersion: edition.editionVersion,
  sourceCommit: edition.sourceCommit,
  sourceSha256: edition.sha256,
  sourceUrl: audit.sourceUrl,
  sections: sections.map(section => ({
    sectionId: section.id,
    lineStart: section.lineStart,
    lineEnd: section.lineEnd,
    readerTargetId: section.readerTargetId,
    contentBearing: section.contentBearing,
    genesisChapter: section.genesisChapter,
    segmentIds: section.segmentIds
  })),
  segments,
  coverage: segmented.coverage
};

const dataBytes = Buffer.from(`${JSON.stringify(data)}\n`, "utf8");
const segmentBytes = Buffer.from(`${JSON.stringify(segmentData)}\n`, "utf8");
if (hash(sourceBytes) !== edition.sha256) {
  throw new Error("The frozen source does not match the edition SHA-256.");
}
if (data.paragraphs.length !== map.paragraphs.length || !data.coverage.allSourceParagraphsIncluded) {
  throw new Error("Reader data does not include every original paragraph.");
}
if (data.coverage.genesisChapters.length !== 50 || data.coverage.genesisChapters.some(chapter => !chapter.sectionIds.length)) {
  throw new Error("Reader data does not include every Genesis chapter.");
}
if (data.coverage.genesisChapters.some(chapter => !chapter.segmentCount)) {
  throw new Error("A Genesis chapter has no line-based reading segments.");
}

fs.mkdirSync(path.join(outputRoot, "data"), { recursive: true });
fs.mkdirSync(path.join(outputRoot, "archive"), { recursive: true });
fs.writeFileSync(path.join(outputRoot, "data", "library.json"), dataBytes);
fs.writeFileSync(path.join(outputRoot, "data", "reader-segments.json"), segmentBytes);
fs.copyFileSync(sourcePath, path.join(outputRoot, "archive", "Full_Scroll_Unsealed.txt"));
fs.copyFileSync(path.join(editionRoot, "edition.json"), path.join(outputRoot, "archive", "edition.json"));

const shelfCards = shelves.map(shelf => {
  const count = shelfSections[shelf.id].length;
  const first = shelfSections[shelf.id][0];
  return `<a class="shelf-card" href="${sectionReaderHref(first ?? sections[0])}"><span class="shelf-number">${shelf.icon}</span><span class="shelf-card-copy"><strong>${escapeHtml(shelf.title)}</strong><small>${escapeHtml(shelf.note)}</small></span><span class="shelf-count">${count} ${count === 1 ? "passage" : "passages"} <span aria-hidden="true">↗</span></span></a>`;
}).join("\n");
const genesisLinks = data.coverage.genesisChapters.map(chapter => {
  const section = sectionById.get(chapter.sectionIds[0]);
  return `<a class="chapter-link" href="${sectionReaderHref(section)}"><span>Genesis</span><strong>${String(chapter.chapter).padStart(2, "0")}</strong><span aria-hidden="true">↗</span></a>`;
}).join("\n");
const shelfIndex = shelves.map(shelf => {
  const links = shelfSections[shelf.id].map(section => {
    const duplicate = duplicateBySection.get(section.id);
    const duplicateLinks = duplicate && duplicate.sectionIds.length > 1
      ? `<span class="occurrence-links">All ${duplicate.sectionIds.length} occurrences: ${duplicate.sectionIds.map((id, index) => {
        const occurrence = sectionById.get(id);
        return `<a href="${sectionReaderHref(occurrence)}" aria-label="Occurrence ${index + 1}, original line ${occurrence.line}">#${index + 1}</a>`;
      }).join(" ")}</span>`
      : "";
    const structuralNote = section.contentBearing ? "" : `<small>Structural heading · opens in its reading context</small>`;
    return `<li><a href="${sectionReaderHref(section)}"><span>${escapeHtml(section.title)}</span><small>Original line ${section.line}</small>${structuralNote}</a>${duplicateLinks}</li>`;
  }).join("\n");
  return `<details class="index-shelf" id="shelf-${shelf.id}"><summary><span class="shelf-number">${shelf.icon}</span><span><strong>${escapeHtml(shelf.title)}</strong><small>${shelfSections[shelf.id].length} original sections</small></span></summary><ol>${links}</ol></details>`;
}).join("\n");

const homepage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Read the preserved Scroll of Fire manuscript in an organized, source-linked library.">
  <meta name="theme-color" content="#101a2b">
  <title>Scroll of Fire — Unsealed Library</title>
  <link rel="canonical" href="https://codexofreality.org/scroll/index.html">
  <link rel="stylesheet" href="assets/library.css">
  <script defer src="../assets/js/site.js"></script>
  <script defer src="assets/library.js"></script>
</head>
<body class="library-home">
  <a class="skip-link" href="#main">Skip to library</a>
  <header class="masthead">
    <a class="wordmark" href="./" aria-label="Scroll of Fire Unsealed Library home"><span class="wordmark-mark" aria-hidden="true">✦</span><span><strong>SCROLL OF FIRE</strong><small>UNSEALED LIBRARY</small></span></a>
    <nav class="masthead-links" aria-label="Library navigation"><a href="#shelves">The shelves</a><a href="#genesis">Genesis 1–50</a><a href="#full-index">Full index</a></nav>
    <details class="mobile-menu"><summary>Browse</summary><nav aria-label="Library navigation"><a href="#shelves">The shelves</a><a href="#genesis">Genesis 1–50</a><a href="#full-index">Full index</a><a href="archive/Full_Scroll_Unsealed.txt">Original edition</a></nav></details>
    <a class="archive-link" href="archive/Full_Scroll_Unsealed.txt">Original edition <span aria-hidden="true">↗</span></a>
  </header>
  <main id="main">
    <section class="library-hero">
      <div class="hero-copy">
        <p class="eyebrow"><span aria-hidden="true">✦</span> Preserved manuscript · Edition ${escapeHtml(edition.editionVersion)}</p>
        <h1>A scroll kept<br><em>whole.</em></h1>
        <p class="hero-description">Enter the author’s complete manuscript through a quieter reading room. Every passage remains in its original words, with a path back to the source.</p>
        <a class="primary-link" href="${sectionReaderHref(sections[0])}">Begin reading <span aria-hidden="true">→</span></a>
        <p class="hero-caption">Written by Aaron Paul Laird · A spiritual and prophetic work</p>
      </div>
      <div class="hero-art" role="img" aria-label="A gold-ink illuminated scroll motif">
        <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
        <div class="scroll-seal" aria-hidden="true"><span>א</span><i>✦</i></div>
        <span class="art-caption">WORDS KEPT<br>IN THE FIRE</span>
      </div>
    </section>
    <section class="preservation-note" aria-label="Preservation note">
      <span class="note-mark" aria-hidden="true">✧</span>
      <p><strong>A reading edition, not a replacement.</strong> The archival text is unchanged. Headings and shelves organize the source; repeated passages remain discoverable, and each reading passage links to its original manuscript line.</p>
      <a href="archive/edition.json">Edition record <span aria-hidden="true">↗</span></a>
    </section>
    <section class="shelves-section" id="shelves">
      <div class="section-heading"><div><p class="eyebrow">A library in eight movements</p><h2>Choose a shelf</h2></div><p>These are reading paths through the source, not a new order imposed on the manuscript.</p></div>
      <div class="shelf-grid">${shelfCards}</div>
    </section>
    <section class="genesis-section" id="genesis">
      <div class="section-heading"><div><p class="eyebrow">Scripture · 50 chapters represented</p><h2>Walk through Genesis</h2></div><a class="text-link" href="${sectionReaderHref(sectionById.get(data.coverage.genesisChapters[0].sectionIds[0]))}">Open the reader <span aria-hidden="true">→</span></a></div>
      <div class="chapter-grid">${genesisLinks}</div>
    </section>
    <section class="future-section">
      <p class="eyebrow">The library will grow in stages</p><h2>More paths are being prepared.</h2>
      <div class="future-links"><span><b>⌕</b> Full-text search <small>Planned for Phase 3</small></span><span><b>◇</b> Evidence register <small>Planned for Phase 3</small></span><span><b>◷</b> Historical atlas <small>Later phase</small></span><span><b>א</b> Hebrew lexicon <small>Planned for Phase 3</small></span></div>
    </section>
    <section class="full-index" id="full-index">
      <div class="section-heading"><div><p class="eyebrow">Nothing left behind</p><h2>Browse every source section</h2></div><p>${sections.length} indexed section entries · repeated headings link to every occurrence</p></div>
      ${shelfIndex}
    </section>
  </main>
  <footer class="library-footer"><a class="wordmark" href="./"><span class="wordmark-mark" aria-hidden="true">✦</span><span><strong>SCROLL OF FIRE</strong><small>UNSEALED LIBRARY</small></span></a><p>Original words · Clear provenance · Whole archive</p><a href="archive/Full_Scroll_Unsealed.txt">Read the preserved source ↗</a></footer>
</body>
</html>
`;

const reader = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Read a source-linked passage from the preserved Scroll of Fire manuscript.">
  <meta name="theme-color" content="#101a2b">
  <title>Reading the Scroll — Unsealed Library</title>
  <link rel="canonical" href="https://codexofreality.org/scroll/reader.html">
  <link rel="stylesheet" href="assets/library.css">
  <script defer src="../assets/js/site.js"></script>
  <script defer src="assets/reader.js"></script>
</head>
<body class="reader-page">
  <a class="skip-link" href="#reading">Skip to passage</a>
  <header class="reader-masthead">
    <a class="wordmark" href="./"><span class="wordmark-mark" aria-hidden="true">✦</span><span><strong>SCROLL OF FIRE</strong><small>UNSEALED LIBRARY</small></span></a>
    <div class="reader-actions" aria-label="Reading settings">
      <button type="button" data-font="smaller" aria-label="Decrease reading text size">A−</button><button type="button" data-font="larger" aria-label="Increase reading text size">A+</button>
      <button type="button" data-theme-toggle aria-label="Switch reading theme">Light theme</button>
      <a class="archive-link" href="archive/Full_Scroll_Unsealed.txt">Original edition <span aria-hidden="true">↗</span></a>
    </div>
  </header>
  <div class="reader-crumbs"><a href="./">Library</a><span aria-hidden="true">/</span><a data-shelf-link href="./#shelves">Shelf</a><span aria-hidden="true">/</span><span data-current-title>Loading passage</span></div>
  <main class="reader-layout">
    <details class="toc-panel" data-toc>
      <summary><span>Contents</span><span class="toc-count" data-toc-count></span></summary>
      <nav data-toc-nav aria-label="Reading table of contents"><p>Preparing table of contents…</p></nav>
    </details>
    <article class="reading-column" id="reading" data-reading aria-live="polite">
      <p class="eyebrow">The preserved source</p><h1 class="reader-title">Loading passage…</h1>
      <p class="reader-lede">The reader is opening this passage from the archival manuscript.</p>
      <div data-passage></div>
    </article>
  </main>
  <div class="reader-bottom">
    <a data-previous href="./">← Previous passage</a>
    <a href="./">Return to the library</a>
    <a data-next href="./">Next passage →</a>
  </div>
  <footer class="reader-footer"><p>Words are presented as preserved. Contextual grouping does not independently verify historical or scientific claims.</p><a href="archive/edition.json">Edition ${escapeHtml(edition.editionVersion)} provenance ↗</a></footer>
</body>
</html>
`;

fs.writeFileSync(path.join(outputRoot, "index.html"), homepage);
fs.writeFileSync(path.join(outputRoot, "reader.html"), reader);
console.log(`Built Scroll of Fire Library: ${sections.length} sections, ${map.paragraphCount} paragraphs, 50 Genesis chapters.`);
