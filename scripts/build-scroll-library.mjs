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
    <nav class="masthead-links" aria-label="Library navigation"><a href="#shelves">The shelves</a><a href="#genesis">Genesis 1–50</a><a href="search.html">Search</a><a href="lexicon.html">Hebrew lexicon</a><a href="atlas.html">Atlas</a><a href="#full-index">Full index</a></nav>
    <details class="mobile-menu"><summary>Browse</summary><nav aria-label="Library navigation"><a href="search.html">Search</a><a href="lexicon.html">Hebrew lexicon</a><a href="atlas.html">Reference atlas</a><a href="#shelves">The shelves</a><a href="#genesis">Genesis 1–50</a><a href="#full-index">Full index</a><a href="archive/Full_Scroll_Unsealed.txt">Original edition</a></nav></details>
    <a class="archive-link" href="archive/Full_Scroll_Unsealed.txt">Original edition <span aria-hidden="true">↗</span></a>
  </header>
  <main id="main">
    <section class="library-hero">
      <div class="hero-copy">
        <p class="eyebrow"><span aria-hidden="true">✦</span> Preserved manuscript · Edition ${escapeHtml(edition.editionVersion)}</p>
        <h1>A scroll kept<br><em>whole.</em></h1>
        <p class="hero-description">Enter the author’s complete manuscript through a quieter reading room. Every passage remains in its original words, with a path back to the source.</p>
        <a class="primary-link" href="${sectionReaderHref(sections[0])}">Begin reading <span aria-hidden="true">→</span></a>
        <form class="hero-search" role="search" action="search.html" method="get"><label for="hero-q">Search the whole manuscript</label><div><input id="hero-q" type="search" name="q" autocomplete="off" placeholder="A word, phrase, Hebrew term, or Genesis 24"><button type="submit">Search</button></div></form>
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
    <section class="research-section" id="research">
      <div class="section-heading"><div><p class="eyebrow">Research tools · every result traces to the original</p><h2>Search, lexicon, and connections</h2></div><p>All tools run locally from this site. Each result links to its reading passage and to the exact original manuscript line.</p></div>
      <div class="research-grid">
        <a class="research-card" href="search.html"><b aria-hidden="true">⌕</b><strong>Full-text search</strong><span>Find any phrase across all ${segments.length.toLocaleString("en-US")} reading segments, filtered by shelf.</span></a>
        <a class="research-card" href="lexicon.html"><b aria-hidden="true">א</b><strong>Hebrew lexicon</strong><span>${audit.hebrewTerms.length} Hebrew forms, with and without vowel marks, linked to every occurrence.</span></a>
        <a class="research-card" href="atlas.html"><b aria-hidden="true">◈</b><strong>Reference atlas</strong><span>Scripture citations, repeated passages, people, places, and subjects, each labelled by relationship.</span></a>
        <a class="research-card" href="../glossary.html"><b aria-hidden="true">✧</b><strong>Codex glossary</strong><span>The existing Codex glossary of symbols and terms.</span></a>
      </div>
      <p class="future-note">Later phases: evidence register and historical atlas are not part of this release.</p>
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
  <script defer src="assets/search-normalize.js"></script>
  <script defer src="assets/reader.js"></script>
</head>
<body class="reader-page">
  <a class="skip-link" href="#reading">Skip to passage</a>
  <header class="reader-masthead">
    <a class="wordmark" href="./"><span class="wordmark-mark" aria-hidden="true">✦</span><span><strong>SCROLL OF FIRE</strong><small>UNSEALED LIBRARY</small></span></a>
    <div class="reader-actions" aria-label="Reading settings">
      <a class="search-link" href="search.html" aria-label="Search the manuscript">⌕ <span>Search</span></a>
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
      <aside class="related-panel" data-related hidden aria-labelledby="related-title"></aside>
    </article>
  </main>
  <div class="reader-bottom">
    <a data-previous href="./">← Previous passage</a>
    <a href="./">Return to the library</a>
    <a href="search.html">Search</a>
    <a data-next href="./">Next passage →</a>
  </div>
  <footer class="reader-footer"><p>Words are presented as preserved. Contextual grouping does not independently verify historical or scientific claims.</p><a href="archive/edition.json">Edition ${escapeHtml(edition.editionVersion)} provenance ↗</a></footer>
</body>
</html>
`;


function toolPage({ file, title, description, bodyClass, current, intro, body, scripts }) {
  const tab = (href, label, id) => `<a href="${href}"${current === id ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="theme-color" content="#101a2b">
  <title>${escapeHtml(title)} — Scroll of Fire Library</title>
  <link rel="canonical" href="https://codexofreality.org/scroll/${file}">
  <link rel="stylesheet" href="assets/library.css">
  <script defer src="../assets/js/site.js"></script>
  <script defer src="assets/search-normalize.js"></script>
  <script defer src="assets/scroll-common.js"></script>
${scripts.map(script => `  <script defer src="assets/${script}"></script>`).join("\n")}
</head>
<body class="tool-body ${bodyClass}">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="reader-masthead">
    <a class="wordmark" href="./"><span class="wordmark-mark" aria-hidden="true">✦</span><span><strong>SCROLL OF FIRE</strong><small>UNSEALED LIBRARY</small></span></a>
    <div class="reader-actions" aria-label="Reading settings">
      <button type="button" data-theme-toggle aria-label="Switch reading theme">Light theme</button>
      <a class="archive-link" href="archive/Full_Scroll_Unsealed.txt">Original edition <span aria-hidden="true">↗</span></a>
    </div>
  </header>
  <nav class="library-tabs" aria-label="Library sections">${tab("./", "Library", "library")}${tab("search.html", "Search", "search")}${tab("lexicon.html", "Hebrew lexicon", "lexicon")}${tab("atlas.html", "Reference atlas", "atlas")}${tab("../glossary.html", "Codex glossary", "glossary")}</nav>
  <main id="main" class="tool-main">
    <section class="tool-intro">${intro}</section>
${body}
  </main>
  <footer class="reader-footer"><p>Search and references are generated from the frozen manuscript, edition ${escapeHtml(edition.editionVersion)}. Matches show where words appear; they do not verify claims.</p><a href="archive/edition.json">Edition provenance ↗</a></footer>
</body>
</html>
`;
}

const shelfChips = shelves.map(shelf => `<button type="button" class="chip" data-shelf="${shelf.id}" aria-pressed="false">${escapeHtml(shelf.title)}</button>`).join("");
const searchPage = toolPage({
  file: "search.html",
  title: "Search the Scroll",
  description: "Search every reading segment of the preserved Scroll of Fire manuscript, including Hebrew, with results linked to the original lines.",
  bodyClass: "search-page",
  current: "search",
  scripts: ["search.js"],
  intro: `<p class="eyebrow">Full-text search · local to this site</p><h1>Search the preserved manuscript</h1>
    <p>Searches the actual text of all ${segments.length.toLocaleString("en-US")} reading segments, not only headings. Hebrew matches with or without vowel marks. Quote a phrase to require it exactly.</p>`,
  body: `    <section class="search-panel" aria-label="Search">
      <form class="search-form" role="search" data-search-form>
        <label for="search-input">Search the manuscript</label>
        <div class="search-row">
          <input id="search-input" type="search" name="q" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Try Nachash, בראשית, Genesis 24, orphan train" data-search-input>
          <button type="submit" class="primary-button">Search</button>
          <button type="button" class="ghost-button" data-search-clear hidden>Clear</button>
        </div>
      </form>
      <fieldset class="shelf-filters"><legend>Filter by shelf</legend><button type="button" class="chip" data-shelf="" aria-pressed="true">All shelves</button>${shelfChips}</fieldset>
      <p class="scope-note" data-scope hidden></p>
      <p class="search-status" role="status" aria-live="polite" data-status>Enter a word or phrase to search. Press / to focus the search box.</p>
    </section>
    <section class="quick-results" data-quick aria-label="Related matches" hidden></section>
    <ol class="search-results" data-results></ol>
    <p class="more-row"><button type="button" class="ghost-button" data-more hidden>Show more results</button></p>
    <noscript><p class="notice">Search needs JavaScript. You can still <a href="./#full-index">browse every source section</a>.</p></noscript>
    <section class="search-help" aria-label="Search tips"><h2>Search tips</h2>
      <ul><li><strong>Phrases:</strong> put words in quotation marks to require them together.</li>
      <li><strong>Hebrew:</strong> vowel marks are optional; final letters and prefixes such as ו ה ב ל are matched.</li>
      <li><strong>English spellings:</strong> Hebrew lexicon matches also follow documented transliteration variants (for example Nachash, Nahash).</li>
      <li><strong>Genesis:</strong> type “Genesis 24” to open that chapter directly.</li></ul>
      <p>Try: <a href="search.html?q=Nachash">Nachash</a> · <a href="search.html?q=%D7%91%D7%A8%D7%90%D7%A9%D7%99%D7%AA">בראשית</a> · <a href="search.html?q=Genesis+24">Genesis 24</a> · <a href="search.html?q=orphan+train">orphan train</a> · <a href="search.html?q=Revelation+18%3A23">Revelation 18:23</a></p></section>`
});

const lexiconPage = toolPage({
  file: "lexicon.html",
  title: "Hebrew lexicon",
  description: "Browse every Hebrew form in the Scroll of Fire manuscript, with spelling, the author's notes, and links to each original occurrence.",
  bodyClass: "lexicon-page",
  current: "lexicon",
  scripts: ["lexicon.js"],
  intro: `<p class="eyebrow">Hebrew reference · ${audit.hebrewTerms.length} forms indexed</p><h1>Hebrew lexicon of the manuscript</h1>
    <p>Every Hebrew form that appears in the original, searchable with or without vowel marks. Each entry separates the literal spelling, the author’s own transliteration, the author’s stated root or gloss, and where the form occurs. No definitions have been added beyond what the manuscript itself says.</p>`,
  body: `    <section class="search-panel" aria-label="Lexicon search">
      <form class="search-form" role="search" data-lex-form>
        <label for="lex-input">Find a Hebrew form</label>
        <div class="search-row"><input id="lex-input" type="search" autocomplete="off" spellcheck="false" placeholder="Hebrew letters (with or without vowels) or an English spelling" data-lex-input><button type="submit" class="primary-button">Find</button><button type="button" class="ghost-button" data-lex-clear hidden>Clear</button></div>
      </form>
      <fieldset class="shelf-filters" data-letters><legend>First letter</legend></fieldset>
      <p class="scope-note" data-lex-scope hidden></p>
      <p class="search-status" role="status" aria-live="polite" data-lex-status></p>
    </section>
    <div class="lexicon-layout">
      <ol class="lexicon-list" data-lex-list aria-label="Hebrew forms"></ol>
      <article class="lexicon-detail" data-lex-detail aria-live="polite" tabindex="-1"><p class="empty-passage">Choose a Hebrew form to see its spelling, the author’s notes, and every occurrence.</p></article>
    </div>
    <p class="more-row"><button type="button" class="ghost-button" data-lex-more hidden>Show more forms</button></p>
    <section class="search-help" aria-label="Method"><h2>Method and limits</h2>
      <ul><li><strong>Literal spelling</strong> is the pointed form exactly as written in the manuscript; the consonantal skeleton removes vowel marks and folds final letters.</li>
      <li><strong>Transliteration</strong> is shown as the author wrote it where the manuscript gives one. The vowel-less romanization is automatic and is not a pronunciation guide.</li>
      <li><strong>Grammatical root</strong> and <strong>definition</strong> are shown only where the manuscript states them, quoted verbatim and labelled as the author’s. This phase adds no independent morphology or definitions.</li>
      <li><strong>Interpretation</strong> in the manuscript is the author’s theological reading, not a lexicon ruling. Repeated boilerplate root notes are not attached to individual entries.</li>
      <li>Related: the existing <a href="../glossary.html">Codex glossary</a>.</li></ul></section>`
});

const atlasPage = toolPage({
  file: "atlas.html",
  title: "Reference atlas",
  description: "Connected references in the Scroll of Fire manuscript: scripture citations, repeated passages, people, places, subjects and years, each labelled by relationship.",
  bodyClass: "atlas-page",
  current: "atlas",
  scripts: ["atlas.js"],
  intro: `<p class="eyebrow">Connected references</p><h1>Reference atlas</h1>
    <p>Follow scriptures, repeated passages, names, places, subjects, and years across the manuscript. Every link states <em>how</em> two things are related. A shared subject is a navigation aid, not proof of a historical or causal connection.</p>`,
  body: `    <section class="relationship-legend" aria-label="Relationship types"><h2>Relationship types</h2><dl>
      <div><dt><span class="badge badge-citation">Direct citation</span></dt><dd>The manuscript names a scripture reference.</dd></div>
      <div><dt><span class="badge badge-subject">Shared subject</span></dt><dd>A name, place, subject or year is mentioned. Not evidence of a causal link.</dd></div>
      <div><dt><span class="badge badge-lexical">Lexical connection</span></dt><dd>The same Hebrew form appears. See the <a href="lexicon.html">lexicon</a>.</dd></div>
      <div><dt><span class="badge badge-repeat">Repeated passage</span></dt><dd>The original repeats the same heading or text. Every occurrence is kept.</dd></div>
      <div><dt><span class="badge badge-author">Author interpretation</span></dt><dd>The author’s own gloss or root note, quoted in the lexicon.</dd></div></dl></section>
    <div class="atlas-tabs" role="tablist" aria-label="Atlas views">
      <button type="button" role="tab" id="tab-scriptures" aria-controls="panel-scriptures" data-tab="scriptures" aria-selected="true">Scripture</button>
      <button type="button" role="tab" id="tab-entities" aria-controls="panel-entities" data-tab="entities" aria-selected="false" tabindex="-1">People, places &amp; subjects</button>
      <button type="button" role="tab" id="tab-repeated" aria-controls="panel-repeated" data-tab="repeated" aria-selected="false" tabindex="-1">Repeated passages</button>
      <button type="button" role="tab" id="tab-years" aria-controls="panel-years" data-tab="years" aria-selected="false" tabindex="-1">Years</button>
    </div>
    <p class="search-status" role="status" aria-live="polite" data-atlas-status></p>
    <section role="tabpanel" id="panel-scriptures" aria-labelledby="tab-scriptures" data-panel="scriptures"></section>
    <section role="tabpanel" id="panel-entities" aria-labelledby="tab-entities" data-panel="entities" hidden></section>
    <section role="tabpanel" id="panel-repeated" aria-labelledby="tab-repeated" data-panel="repeated" hidden></section>
    <section role="tabpanel" id="panel-years" aria-labelledby="tab-years" data-panel="years" hidden></section>
    <noscript><p class="notice">The atlas needs JavaScript. You can still <a href="./#full-index">browse every source section</a>.</p></noscript>`
});

fs.writeFileSync(path.join(outputRoot, "index.html"), homepage);
fs.writeFileSync(path.join(outputRoot, "search.html"), searchPage);
fs.writeFileSync(path.join(outputRoot, "lexicon.html"), lexiconPage);
fs.writeFileSync(path.join(outputRoot, "atlas.html"), atlasPage);
fs.writeFileSync(path.join(outputRoot, "reader.html"), reader);
console.log(`Built Scroll of Fire Library: ${sections.length} sections, ${map.paragraphCount} paragraphs, 50 Genesis chapters.`);
