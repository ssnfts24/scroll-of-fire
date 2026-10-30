import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { normalize, tokenize, transliterationKey, consonantalRomanization } =
  require("../docs/scroll/assets/search-normalize.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scrollRoot = path.join(root, "docs", "scroll");
const editionRoot = path.join(root, "archive", "Full_Scroll_Unsealed", "1.0.0");
const args = new Set(process.argv.slice(2));
const outputRoot = process.env.SCROLL_SEARCH_OUT ? path.resolve(process.env.SCROLL_SEARCH_OUT) : scrollRoot;

const library = JSON.parse(fs.readFileSync(path.join(scrollRoot, "data", "library.json"), "utf8"));
const segmentData = JSON.parse(fs.readFileSync(path.join(scrollRoot, "data", "reader-segments.json"), "utf8"));
const audit = JSON.parse(fs.readFileSync(path.join(editionRoot, "content-audit.json"), "utf8"));
const edition = JSON.parse(fs.readFileSync(path.join(editionRoot, "edition.json"), "utf8"));
const sourceBytes = fs.readFileSync(path.join(editionRoot, "Full_Scroll_Unsealed"));
const sourceSha256 = crypto.createHash("sha256").update(sourceBytes).digest("hex");
if (sourceSha256 !== edition.sha256 || segmentData.sourceSha256 !== edition.sha256) {
  throw new Error("Search build refused: source SHA-256 does not match the frozen edition.");
}
const sourceText = sourceBytes.toString("utf8");
const sourceLines = sourceText.split(/\r\n|\n|\r/);
if (/(?:\r\n|\n|\r)$/.test(sourceText)) sourceLines.pop();

const CHUNK_SIZE = 40;
const files = new Map();
function emit(relativePath, value) {
  const bytes = Buffer.from(typeof value === "string" ? value : `${JSON.stringify(value)}\n`, "utf8");
  files.set(relativePath, bytes);
}
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const hex = text => [...text].map(char => char.codePointAt(0).toString(16).padStart(4, "0")).join("");

const shelves = library.shelves;
const shelfIndex = new Map(shelves.map((shelf, index) => [shelf.id, index]));
const sections = library.sections;
const sectionIndex = new Map(sections.map((section, index) => [section.id, index]));
const segments = segmentData.segments;
const segmentOrdinal = new Map(segments.map((segment, index) => [segment.id, index]));
const sourceBase = audit.sourceUrl;

/* ---------- section / segment tables ---------- */
const sectionRows = sections.map(section => [
  section.id, section.title, shelfIndex.get(section.shelf), section.line,
  sectionIndex.get(section.readerTargetId), section.genesisChapter ?? 0
]);
const genesis = library.coverage.genesisChapters.map(chapter => {
  const section = sections.find(item => item.id === chapter.sectionIds[0]);
  return { chapter: chapter.chapter, sectionId: section.id, segmentId: section.segmentIds[0], line: chapter.lineStart };
});
const sectionsPayload = {
  schemaVersion: 1,
  sourceUrl: sourceBase.replace(/#L\d+$/, ""),
  shelves: shelves.map(shelf => ({ id: shelf.id, title: shelf.title })),
  sections: sectionRows,
  genesis,
  segIds: segments.map(segment => segment.id),
  segSection: segments.map(segment => sectionIndex.get(segment.sectionId)),
  segStart: segments.map(segment => segment.lineStart),
  segEnd: segments.map(segment => segment.lineEnd),
  segChapter: segments.map(segment => segment.genesisChapter ?? 0)
};

/* ---------- text chunks (lazy; fetched only for matched segments) ---------- */
const chunkCount = Math.ceil(segments.length / CHUNK_SIZE);
for (let chunk = 0; chunk < chunkCount; chunk += 1) {
  emit(`search/text/t-${String(chunk).padStart(3, "0")}.json`,
    segments.slice(chunk * CHUNK_SIZE, (chunk + 1) * CHUNK_SIZE).map(segment => segment.text));
}

/* ---------- inverted index, sharded by the first two characters ---------- */
const postings = new Map();
let totalTokens = 0;
segments.forEach((segment, ordinal) => {
  const counts = new Map();
  for (const token of tokenize(segment.text)) counts.set(token, (counts.get(token) ?? 0) + 1);
  for (const [token, count] of counts) {
    totalTokens += count;
    if (!postings.has(token)) postings.set(token, []);
    postings.get(token).push([ordinal, count]);
  }
});
const shards = new Map();
for (const token of [...postings.keys()].sort()) {
  const key = [...token].slice(0, 2).join("");
  if (!shards.has(key)) shards.set(key, {});
  let previous = 0;
  const d = [];
  const f = [];
  for (const [ordinal, count] of postings.get(token)) {
    d.push(ordinal - previous);
    f.push(count);
    previous = ordinal;
  }
  shards.get(key)[token] = { d, f };
}
const shardKeys = [...shards.keys()].sort();
for (const key of shardKeys) emit(`search/index/ix-${hex(key)}.json`, shards.get(key));
emit("search/sections.json", { ...sectionsPayload, shards: shardKeys });

/* ---------- source-line helpers ---------- */
const segmentsByLine = new Map();
segments.forEach(segment => {
  for (let line = segment.lineStart; line <= segment.lineEnd; line += 1) {
    if (!segmentsByLine.has(line)) segmentsByLine.set(line, []);
    segmentsByLine.get(line).push(segment);
  }
});
const squashed = new Map(segments.map(segment => [segment.id, normalize(segment.text).replace(/ /g, "")]));
function segmentForLine(line, needle) {
  const candidates = segmentsByLine.get(line) ?? [];
  if (candidates.length <= 1) return candidates[0];
  const match = needle ? candidates.find(segment => squashed.get(segment.id).includes(needle)) : null;
  return match ?? candidates[0];
}
const pageOfSegment = segment => sections[sectionIndex.get(segment.sectionId)].readerTargetId;

/* ---------- Hebrew lexicon ---------- */
const hebrewCanonical = form => form.normalize("NFKC").replace(/[\u0591-\u05C7]/g, "").replace(/[׳״'"-]/g, "");
const authorNotes = new Map();
const addNote = (canonical, note) => {
  if (!authorNotes.has(canonical)) authorNotes.set(canonical, []);
  authorNotes.get(canonical).push(note);
};
const pairPattern = /([\u0590-\u05FF][\u0590-\u05FF\s\u05BE'’\-]*[\u0590-\u05FF])\s*\(([A-Za-z][A-Za-z’'‘ʼ.\-\s/]{0,58})\)/gu;
const NOTE_CONTEXT_LENGTH = 220;
sourceLines.forEach((line, index) => {
  const lineNumber = index + 1;
  for (const match of line.matchAll(pairPattern)) {
    const phrase = match[1].trim();
    const words = phrase.split(/\s+/).map(hebrewCanonical).filter(Boolean);
    const isRoot = /Root:\s*$/.test(line.slice(Math.max(0, match.index - 12), match.index + 1)) ||
      /Root:\s*$/.test(line.slice(0, match.index).trimEnd().slice(-12));
    const segment = segmentForLine(lineNumber, words[0]);
    if (!segment) continue;
    const note = {
      kind: isRoot ? "author-root-note" : (words.length === 1 ? "author-word-pair" : "author-phrase-pair"),
      line: lineNumber,
      segmentId: segment.id,
      hebrew: phrase,
      transliteration: match[2].trim(),
      context: line.slice(match.index, match.index + NOTE_CONTEXT_LENGTH)
    };
    for (const word of new Set(words)) addNote(word, note);
  }
});

const lexiconTerms = audit.hebrewTerms;
const lexiconEntries = lexiconTerms.map(term => {
  const needle = normalize(term.canonical).replace(/ /g, "");
  const occurrences = term.lines.map(line => {
    const segment = segmentForLine(line, needle);
    return [line, segment?.id ?? null, segment?.genesisChapter ?? 0];
  });
  const notes = authorNotes.get(term.canonical) ?? [];
  const authorTransliterations = [...new Set(notes.filter(note => note.kind !== "author-phrase-pair").map(note => note.transliteration))];
  const phraseTransliterations = [...new Set(notes.filter(note => note.kind === "author-phrase-pair").map(note => note.transliteration))];
  return {
    id: `heb-${hex(term.canonical)}`,
    canonical: term.canonical,
    search: needle,
    forms: Object.entries(term.forms).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "he")),
    occurrences: term.occurrences,
    lines: term.lines,
    romanization: consonantalRomanization(term.canonical),
    authorTransliterations,
    phraseTransliterations,
    genesisChapters: [...new Set(occurrences.map(item => item[2]).filter(Boolean))].sort((a, b) => a - b),
    occurrenceRefs: occurrences,
    notes
  };
});
const lexiconIndex = lexiconEntries.map(entry => ({
  id: entry.id,
  c: entry.canonical,
  s: entry.search,
  f: entry.forms.map(form => form[0]),
  n: entry.occurrences,
  r: entry.romanization,
  a: entry.authorTransliterations,
  p: entry.phraseTransliterations,
  g: entry.genesisChapters,
  k: [...new Set([...entry.authorTransliterations, ...entry.phraseTransliterations].map(transliterationKey).filter(key => key.length >= 2))],
  x: entry.notes.length
}));
emit("search/lexicon/lexicon-index.json", { schemaVersion: 1, count: lexiconIndex.length, entries: lexiconIndex });
const detailBuckets = new Map();
for (const entry of lexiconEntries) {
  const bucket = [...normalize(entry.canonical)][0] ?? "x";
  if (!detailBuckets.has(bucket)) detailBuckets.set(bucket, {});
  detailBuckets.get(bucket)[entry.id] = {
    forms: entry.forms,
    lines: entry.lines,
    occurrences: entry.occurrenceRefs,
    notes: entry.notes
  };
}
const lexiconBucketKeys = [...detailBuckets.keys()].sort();
for (const key of lexiconBucketKeys) emit(`search/lexicon/entries-${hex(key)}.json`, detailBuckets.get(key));

/* ---------- reference atlas ---------- */
const books = [
  ["Genesis", ["Gen"]], ["Exodus", ["Exod", "Ex"]], ["Leviticus", ["Lev"]], ["Numbers", ["Num"]], ["Deuteronomy", ["Deut"]],
  ["Joshua", ["Josh"]], ["Judges", ["Judg"]], ["Ruth", []], ["Samuel", ["Sam"]], ["Kings", []], ["Chronicles", ["Chron"]],
  ["Ezra", []], ["Nehemiah", ["Neh"]], ["Esther", []], ["Job", []], ["Psalms", ["Psalm", "Ps"]], ["Proverbs", ["Prov"]],
  ["Ecclesiastes", ["Eccl"]], ["Isaiah", ["Isa"]], ["Jeremiah", ["Jer"]], ["Lamentations", ["Lam"]], ["Ezekiel", ["Ezek"]],
  ["Daniel", ["Dan"]], ["Hosea", ["Hos"]], ["Joel", []], ["Amos", []], ["Obadiah", ["Obad"]], ["Jonah", []], ["Micah", ["Mic"]],
  ["Nahum", []], ["Habakkuk", ["Hab"]], ["Zephaniah", ["Zeph"]], ["Haggai", ["Hag"]], ["Zechariah", ["Zech"]], ["Malachi", ["Mal"]],
  ["Matthew", ["Matt"]], ["Mark", []], ["Luke", []], ["John", []], ["Acts", []], ["Romans", ["Rom"]], ["Corinthians", ["Cor"]],
  ["Galatians", ["Gal"]], ["Ephesians", ["Eph"]], ["Philippians", ["Phil"]], ["Colossians", ["Col"]], ["Thessalonians", ["Thess"]],
  ["Timothy", ["Tim"]], ["Titus", []], ["Philemon", []], ["Hebrews", ["Heb"]], ["James", []], ["Peter", ["Pet"]], ["Jude", []],
  ["Revelation", ["Rev"]], ["Enoch", []], ["Jubilees", []]
];
const numbered = new Set(["Samuel", "Kings", "Chronicles", "Corinthians", "Thessalonians", "Timothy", "Peter", "Enoch", "John"]);
const bookAlias = new Map();
for (const [name, aliases] of books) {
  bookAlias.set(name, name);
  for (const alias of aliases) bookAlias.set(alias, name);
}
const aliasPattern = [...bookAlias.keys()].sort((a, b) => b.length - a.length).join("|");
const refPattern = new RegExp(`(?<![\\p{L}\\p{N}])((?:[1-3]|I{1,3})[ \\t])?(${aliasPattern})\\.?[ \\t]+(\\d{1,3})(?:[ \\t]*:[ \\t]*(\\d{1,3})(?:[ \\t]*[–-][ \\t]*(\\d{1,3}))?)?(?![\\d:])`, "gu");
const romanNumber = { I: "1", II: "2", III: "3" };
const references = new Map();
const genesisHeading = /^\W*(?:📜\s*)?Genesis\s+\d+\W*$/u;
const segmentRefs = new Map();
for (const segment of segments) {
  if (segment.kind === "heading" && genesisHeading.test(segment.text.trim())) continue;
  for (const match of segment.text.matchAll(refPattern)) {
    const book = bookAlias.get(match[2]);
    if (!book) continue;
    const prefix = match[1] ? (romanNumber[match[1].trim()] ?? match[1].trim()) : "";
    if (prefix && !numbered.has(book)) continue;
    const label = `${prefix ? `${prefix} ` : ""}${book} ${Number(match[3])}${match[4] ? `:${Number(match[4])}${match[5] ? `–${Number(match[5])}` : ""}` : ""}`;
    if (!references.has(label)) {
      references.set(label, { ref: label, book: `${prefix ? `${prefix} ` : ""}${book}`, chapter: Number(match[3]), verse: match[4] ? Number(match[4]) : 0, segments: [] });
    }
    const entry = references.get(label);
    if (!entry.segments.includes(segment.id)) entry.segments.push(segment.id);
    if (!segmentRefs.has(segment.id)) segmentRefs.set(segment.id, new Set());
    segmentRefs.get(segment.id).add(label);
  }
}
const referenceList = [...references.values()].sort((a, b) =>
  a.book.localeCompare(b.book, "en", { numeric: true }) || a.chapter - b.chapter || a.verse - b.verse);
emit("search/atlas/scriptures.json", {
  schemaVersion: 1,
  relationship: "direct-citation",
  note: "A reference appears here only when the manuscript text names it. A citation shows what the author cites, not that the author's use of it is verified.",
  count: referenceList.length,
  references: referenceList
});

const gazetteer = [
  ["person", "Adam", ["Adam"]], ["person", "Eve", ["Eve", "Chavvah", "Chawwah"]], ["person", "Cain", ["Cain", "Qayin", "Kayin"]],
  ["person", "Abel", ["Abel", "Hevel"]], ["person", "Seth", ["Seth"]], ["person", "Enoch", ["Enoch", "Chanoch"]],
  ["person", "Noah", ["Noah", "Noach"]], ["person", "Abraham", ["Abraham", "Abram", "Avraham"]], ["person", "Sarah", ["Sarah", "Sarai"]],
  ["person", "Hagar", ["Hagar"]], ["person", "Isaac", ["Isaac", "Yitzchak"]], ["person", "Rebekah", ["Rebekah", "Rebecca", "Rivkah"]],
  ["person", "Jacob", ["Jacob", "Yaakov"]], ["person", "Esau", ["Esau"]], ["person", "Joseph", ["Joseph", "Yosef"]],
  ["person", "Moses", ["Moses", "Moshe"]], ["person", "Pharaoh", ["Pharaoh"]], ["person", "Jesus (Yeshua)", ["Jesus", "Yeshua"]],
  ["person", "David", ["David"]], ["person", "Solomon", ["Solomon"]], ["person", "Nimrod", ["Nimrod"]],
  ["place", "Eden", ["Eden"]], ["place", "Babel / Babylon", ["Babel", "Babylon"]], ["place", "Egypt", ["Egypt", "Mitzrayim"]],
  ["place", "Canaan", ["Canaan"]], ["place", "Sodom and Gomorrah", ["Sodom", "Gomorrah"]], ["place", "Jerusalem", ["Jerusalem"]],
  ["place", "Zion", ["Zion"]], ["place", "Mount Sinai", ["Sinai"]], ["place", "Ararat", ["Ararat"]], ["place", "Bethel", ["Bethel"]],
  ["place", "Hebron", ["Hebron"]], ["place", "Chicago", ["Chicago"]],
  ["subject", "The Flood", ["Flood"]], ["subject", "Covenant", ["covenant"]], ["subject", "Sabbath (Shabbat)", ["Sabbath", "Shabbat"]],
  ["subject", "Remnant", ["Remnant"]], ["subject", "Watchers / Nephilim", ["Watchers", "Nephilim"]],
  ["subject", "Septuagint (LXX)", ["Septuagint", "LXX"]], ["subject", "Dead Sea Scrolls (DSS)", ["Dead Sea Scrolls", "DSS"]],
  ["subject", "Masoretic Text (MT)", ["Masoretic", "MT"]], ["subject", "Orphan trains", ["orphan train", "orphan trains"]],
  ["subject", "World’s fairs", ["World’s Fair", "World's Fair", "Columbian Exposition", "World’s Columbian Exposition"]],
  ["subject", "Artificial intelligence", ["artificial intelligence", "AI"]], ["subject", "Digital identity", ["digital identity", "digital ID"]],
  ["subject", "Surveillance", ["surveillance"]], ["subject", "Frequency", ["frequency", "frequencies"]],
  ["subject", "Revelation (book)", ["Revelation"]], ["subject", "Book of Enoch", ["Book of Enoch", "1 Enoch"]],
  ["subject", "Hebrew language", ["Hebrew"]], ["subject", "Yahweh (YHWH)", ["Yahweh", "YHWH"]]
];
const entities = [];
for (const [type, label, aliases] of gazetteer) {
  const matchers = aliases.map(alias => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, /^[A-Z]{2,}$/.test(alias) ? "u" : "iu");
  });
  const hits = segments.filter(segment => matchers.some(pattern => pattern.test(segment.text))).map(segment => segment.id);
  if (!hits.length) continue;
  entities.push({ id: `entity-${normalize(label).replace(/ /g, "-")}`, type, label, aliases, segments: hits });
}
emit("search/atlas/entities.json", {
  schemaVersion: 1,
  relationship: "shared-subject",
  note: "Entries are matched by name in the manuscript text. Sharing a name or subject does not establish a historical, causal, or doctrinal connection.",
  count: entities.length,
  entities
});
const entityIndexLine = entities.map(entity => ({ id: entity.id, label: entity.label, type: entity.type, aliases: entity.aliases, count: entity.segments.length }));
emit("search/atlas/entity-index.json", { schemaVersion: 1, entities: entityIndexLine });

const yearPattern = /(?<![\p{L}\p{N}])(1[5-9]\d\d|20\d\d)(?![\p{L}\p{N}])/gu;
const years = new Map();
for (const segment of segments) {
  for (const match of segment.text.matchAll(yearPattern)) {
    if (!years.has(match[1])) years.set(match[1], []);
    if (!years.get(match[1]).includes(segment.id)) years.get(match[1]).push(segment.id);
  }
}
emit("search/atlas/years.json", {
  schemaVersion: 1,
  relationship: "shared-subject",
  note: "A year appears here when it is written in the manuscript. A shared year is a date mention, not verification of the event described.",
  years: [...years.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).map(([year, ids]) => ({ year: Number(year), segments: ids }))
});

/* repeated passages: section-level (original headings) and identical segment text */
const repeatedSections = library.duplicateGroups.map(group => ({
  relationship: "repeated-passage",
  kind: "heading",
  title: group.title,
  sectionIds: group.sectionIds,
  lines: group.sectionIds.map(id => sections[sectionIndex.get(id)].line)
}));
const byText = new Map();
for (const segment of segments) {
  if (segment.kind === "heading" || normalize(segment.text).length < 80) continue;
  const key = normalize(segment.text);
  if (!byText.has(key)) byText.set(key, []);
  byText.get(key).push(segment);
}
const repeatedText = [...byText.values()].filter(group => group.length > 1).map(group => ({
  relationship: "repeated-passage",
  kind: "identical-text",
  excerpt: group[0].text.slice(0, 160),
  segmentIds: group.map(segment => segment.id),
  lines: group.map(segment => segment.lineStart)
}));
emit("search/atlas/repeated.json", {
  schemaVersion: 1,
  relationship: "repeated-passage",
  note: "Repeated passages are identical or same-titled text in the original. Every occurrence is kept; none is deleted or merged.",
  headingGroups: repeatedSections,
  identicalTextGroups: repeatedText
});

/* per reader page related data, sharded by shelf */
const pageBuckets = new Map(shelves.map(shelf => [shelf.id, {}]));
const lexiconByLine = new Map();
for (const entry of lexiconEntries) {
  for (const [, segmentId] of entry.occurrenceRefs) {
    if (!segmentId) continue;
    if (!lexiconByLine.has(segmentId)) lexiconByLine.set(segmentId, new Map());
    lexiconByLine.get(segmentId).set(entry.id, entry);
  }
}
const headingGroupBySection = new Map();
for (const group of repeatedSections) for (const id of group.sectionIds) headingGroupBySection.set(id, group);
const entityBySegment = new Map();
for (const entity of entities) {
  for (const id of entity.segments) {
    if (!entityBySegment.has(id)) entityBySegment.set(id, new Set());
    entityBySegment.get(id).add(entity.id);
  }
}
const entityById = new Map(entities.map(entity => [entity.id, entity]));
const textGroupBySegment = new Map();
for (const group of repeatedText) for (const id of group.segmentIds) textGroupBySegment.set(id, group);
const pageIds = sections.filter(section => section.readerTargetId === section.id);
for (const page of pageIds) {
  const pageSegments = segments.filter(segment =>
    sections[sectionIndex.get(segment.sectionId)].readerTargetId === page.id);
  const refs = new Set();
  const lex = new Map();
  const ents = new Set();
  const repeats = new Map();
  for (const segment of pageSegments) {
    for (const ref of segmentRefs.get(segment.id) ?? []) refs.add(ref);
    for (const [id, entry] of lexiconByLine.get(segment.id) ?? []) if (!lex.has(id)) lex.set(id, entry);
    for (const id of entityBySegment.get(segment.id) ?? []) ents.add(id);
    const group = textGroupBySegment.get(segment.id);
    if (group) {
      group.segmentIds.filter(id => id !== segment.id).forEach(id => {
        const other = segments[segmentOrdinal.get(id)];
        const otherPage = sections[sectionIndex.get(other.sectionId)];
        if (otherPage.readerTargetId !== page.id) repeats.set(id, { relationship: "repeated-passage", segmentId: id, sectionId: other.sectionId, line: other.lineStart, title: otherPage.title });
      });
    }
  }
  for (const section of sections.filter(item => item.readerTargetId === page.id)) {
    const group = headingGroupBySection.get(section.id);
    if (!group) continue;
    group.sectionIds.filter(id => id !== section.id).forEach(id => {
      const other = sections[sectionIndex.get(id)];
      repeats.set(id, { relationship: "repeated-passage", segmentId: other.segmentIds[0] ?? null, sectionId: id, line: other.line, title: other.title });
    });
  }
  const lexList = [...lex.values()];
  pageBuckets.get(page.shelf)[page.id] = {
    refs: [...refs].sort(),
    entities: [...ents].map(id => [id, entityById.get(id).label, entityById.get(id).type]).sort((a, b) => a[1].localeCompare(b[1])),
    repeats: [...repeats.values()].sort((a, b) => a.line - b.line),
    hebrewCount: lexList.length,
    hebrew: lexList.slice(0, 12).map(entry => [entry.id, entry.forms[0][0]])
  };
}
for (const [shelf, bucket] of pageBuckets) emit(`search/atlas/pages-${shelf}.json`, bucket);

/* ---------- manifest ---------- */
const artifactPaths = [...files.keys()].sort();
const manifest = {
  schemaVersion: 1,
  generator: "scripts/build-scroll-search.mjs",
  engine: "scroll-local-sharded-index-v1",
  editionVersion: edition.editionVersion,
  sourceCommit: edition.sourceCommit,
  sourceSha256: edition.sha256,
  counts: {
    segments: segments.length,
    sections: sections.length,
    uniqueTokens: postings.size,
    totalTokens,
    indexShards: shardKeys.length,
    textChunks: chunkCount,
    chunkSize: CHUNK_SIZE,
    lexiconEntries: lexiconEntries.length,
    lexiconDetailBuckets: lexiconBucketKeys.length,
    lexiconEntriesWithAuthorNotes: lexiconEntries.filter(entry => entry.notes.length).length,
    scriptureReferences: referenceList.length,
    entities: entities.length,
    repeatedHeadingGroups: repeatedSections.length,
    repeatedTextGroups: repeatedText.length
  },
  shardKeys: shardKeys.map(key => ({ key, file: `index/ix-${hex(key)}.json` })),
  lexiconBuckets: lexiconBucketKeys.map(key => ({ key, file: `lexicon/entries-${hex(key)}.json` })),
  artifacts: artifactPaths.map(file => ({ path: file.replace(/^search\//, ""), bytes: files.get(file).length, sha256: sha(files.get(file)) }))
};
emit("search/manifest.json", manifest);

if (args.has("--check")) {
  let drift = 0;
  for (const [relative, bytes] of files) {
    const target = path.join(scrollRoot, relative);
    if (!fs.existsSync(target) || !fs.readFileSync(target).equals(bytes)) { drift += 1; console.error(`DRIFT: ${relative}`); }
  }
  const existing = fs.existsSync(path.join(scrollRoot, "search"))
    ? fs.readdirSync(path.join(scrollRoot, "search"), { recursive: true, withFileTypes: true }).filter(entry => entry.isFile())
        .map(entry => path.relative(scrollRoot, path.join(entry.parentPath, entry.name)).split(path.sep).join("/")) : [];
  for (const file of existing) if (!files.has(file)) { drift += 1; console.error(`UNEXPECTED: ${file}`); }
  if (drift) { console.error(`Search artifacts are stale (${drift} differences). Run npm run scroll:search.`); process.exit(1); }
  console.log(`Search artifacts reproduce byte-for-byte (${files.size} files).`);
  process.exit(0);
}

fs.rmSync(path.join(outputRoot, "search"), { recursive: true, force: true });
for (const [relative, bytes] of files) {
  const target = path.join(outputRoot, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
}
const total = [...files.values()].reduce((sum, bytes) => sum + bytes.length, 0);
console.log(`Built search: ${files.size} files, ${total} bytes, ${postings.size} tokens, ${shardKeys.length} shards, ${lexiconEntries.length} lexicon entries, ${referenceList.length} scripture refs, ${entities.length} entities.`);
if (args.has("--report")) {
  const gz = [...files.values()].reduce((sum, bytes) => sum + zlib.gzipSync(bytes, { level: 9 }).length, 0);
  console.log(`Gzip total: ${gz} bytes`);
}
