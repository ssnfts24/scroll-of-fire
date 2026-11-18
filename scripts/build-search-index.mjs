#!/usr/bin/env node
/*
 * Living Search indexer — builds the site-wide search index from the
 * same sealed sources the site already generates, so the index served
 * by Netlify and by the GitHub Pages mirror is literally the same
 * artifact, generated from the repository, and cannot drift from it.
 *
 * Sources (all committed, all hash-recorded in the manifest):
 *   docs/data/site-catalog.json                    (Atlas resources)
 *   docs/scroll/data/library.json                  (Scroll sections)
 *   docs/scroll/data/reader-segments.json          (Scroll segments)
 *   docs/scroll/search/lexicon/lexicon-index.json  (Hebrew lexicon)
 *   docs/scroll/evidence/claim-register.json       (Claim Register)
 *   docs/**.html                                   (site pages)
 *
 * Generation order (documented in the R2 dependency map):
 *   site:catalog -> search:index -> r2-extract -> r2:inventory
 * Run after site:catalog so the Atlas shard reflects the sealed catalog.
 *
 * Usage: node scripts/build-search-index.mjs [--check]
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { transliterationKey } = require("../docs/scroll/assets/search-normalize.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docs = path.join(root, "docs");
const args = new Set(process.argv.slice(2));
const outputRoot = process.env.LIVING_SEARCH_OUT
  ? path.resolve(process.env.LIVING_SEARCH_OUT)
  : path.join(docs, "assets", "search");

const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const readJson = (...parts) => JSON.parse(fs.readFileSync(path.join(root, ...parts), "utf8"));
const sourceHash = (...parts) => sha(fs.readFileSync(path.join(root, ...parts)));

const PAGE_BODY_CAP = 4000;
const PAGE_HEADINGS_CAP = 1200;
const SEGMENT_BODY_CAP = 2000;
const CLAIM_BODY_CAP = 2000;

/* Pages excluded from the "pages" area, with reasons recorded in the manifest:
 * scroll/ pages are covered by the scrolls/lexicon/claims areas; the utility
 * pages carry no searchable content; search.html is the search page itself. */
const PAGE_EXCLUDED_PREFIXES = ["scroll/"];
const PAGE_EXCLUDED_FILES = ["404.html", "offline.html", "caravan.html", "search.html"];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out.sort();
}

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'", "&apos;": "'", "&nbsp;": " ", "&rsquo;": "’", "&lsquo;": "‘", "&ldquo;": "“", "&rdquo;": "”", "&mdash;": "—", "&ndash;": "–", "&hellip;": "…" };
function decodeEntities(text) {
  return text.replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp|rsquo|lsquo|ldquo|rdquo|mdash|ndash|hellip);/g, entity => ENTITIES[entity] ?? entity)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}
const stripTags = html => decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

function extractPage(html) {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ");
  const rawTitle = stripTags(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "");
  const description = decodeEntities(html.match(/<meta\s+name="description"\s+content="([\s\S]*?)"/i)?.[1] || "").replace(/\s+/g, " ").trim();
  const headings = [...withoutNoise.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map(match => ({ level: Number(match[1]), text: stripTags(match[2]) }))
    .filter(heading => heading.text);
  const h1 = headings.find(heading => heading.level === 1)?.text || "";
  const title = h1 || rawTitle.split("|")[0].replace(/\s+[—–-]\s+Scroll of Fire\s*$/, "").trim() || rawTitle;
  const headingText = [rawTitle, description, ...headings.filter(heading => heading.text !== title).map(heading => heading.text)]
    .filter(Boolean).join(" ").slice(0, PAGE_HEADINGS_CAP);
  const main = withoutNoise.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] || withoutNoise;
  const body = stripTags(main).slice(0, PAGE_BODY_CAP);
  return { title, headings: headingText, body };
}

/* ---------------- pages ---------------- */
const curation = readJson("scripts", "site-catalog-curation.json");
const areaByPagePath = new Map(curation.entries.filter(entry => entry.path).map(entry => [entry.path, entry.area]));

function buildPages() {
  const files = walk(docs).filter(file => file.endsWith(".html"));
  const pages = [];
  for (const file of files) {
    const rel = path.relative(docs, file).split(path.sep).join("/");
    if (PAGE_EXCLUDED_PREFIXES.some(prefix => rel.startsWith(prefix))) continue;
    if (PAGE_EXCLUDED_FILES.includes(rel)) continue;
    const { title, headings, body } = extractPage(fs.readFileSync(file, "utf8"));
    if (!title) continue;
    pages.push({ i: `page:${rel}`, a: "pages", t: title, u: rel, h: headings, b: body, x: areaByPagePath.get(rel) || "" });
  }
  return pages.sort((a, b) => a.i.localeCompare(b.i));
}

/* ---------------- scrolls ---------------- */
function buildScrolls() {
  const library = readJson("docs", "scroll", "data", "library.json");
  const segmentData = readJson("docs", "scroll", "data", "reader-segments.json");
  const shelfTitle = new Map(library.shelves.map(shelf => [shelf.id, shelf.title]));
  const sectionById = new Map(library.sections.map(section => [section.id, section]));
  const docsOut = [];
  for (const section of library.sections) {
    const firstSegment = section.segmentIds?.[0];
    docsOut.push({
      i: `sec:${section.id}`, a: "scrolls", t: section.title,
      u: `scroll/reader.html?section=${encodeURIComponent(section.id)}${firstSegment ? `#${encodeURIComponent(firstSegment)}` : ""}`,
      h: [shelfTitle.get(section.shelf) || "", section.genesisChapter ? `Genesis ${section.genesisChapter}` : "", section.label || ""].filter(Boolean).join(" "),
      b: "", x: shelfTitle.get(section.shelf) || ""
    });
  }
  for (const segment of segmentData.segments) {
    const section = sectionById.get(segment.sectionId);
    docsOut.push({
      i: `seg:${segment.id}`, a: "scrolls", t: section?.title || "Scroll segment",
      u: `scroll/reader.html?section=${encodeURIComponent(segment.sectionId)}#${encodeURIComponent(segment.id)}`,
      h: [section ? shelfTitle.get(section.shelf) || "" : "", segment.genesisChapter ? `Genesis ${segment.genesisChapter}` : ""].filter(Boolean).join(" "),
      b: String(segment.text || "").slice(0, SEGMENT_BODY_CAP),
      x: section?.title || ""
    });
  }
  return docsOut.sort((a, b) => a.i.localeCompare(b.i));
}

/* ---------------- atlas ---------------- */
function buildAtlas() {
  const catalog = readJson("docs", "data", "site-catalog.json");
  const areaTitle = new Map(catalog.areas.map(area => [area.id, area.title]));
  return catalog.entries.map(entry => {
    const isRepo = typeof entry.url === "string" && entry.url.includes("github.com");
    /* Planned entries have no page of their own yet; their Atlas card is the destination. */
    const url = isRepo ? entry.url
      : entry.path === "scroll/index.html" ? "scroll/"
      : entry.path || "codex-atlas.html";
    return {
      i: `atlas:${entry.id}`, a: "atlas", t: entry.title, u: url,
      h: [entry.category || "", areaTitle.get(entry.area) || "", entry.resourceType || ""].filter(Boolean).join(" "),
      b: entry.description || "", x: entry.status || ""
    };
  }).sort((a, b) => a.i.localeCompare(b.i));
}

/* ---------------- lexicon ---------------- */
function buildLexicon() {
  const lexicon = readJson("docs", "scroll", "search", "lexicon", "lexicon-index.json");
  return lexicon.entries.map(entry => {
    const keys = [...new Set([...(entry.k || []), transliterationKey(entry.r || "")].filter(key => key && key.length >= 2))];
    return {
      i: `lex:${entry.id}`, a: "lexicon", t: entry.c,
      u: `scroll/lexicon.html?term=${encodeURIComponent(entry.id)}`,
      h: [entry.r || "", ...(entry.a || []), ...(entry.p || [])].filter(Boolean).join(" "),
      b: (entry.f || []).join(" "),
      k: keys,
      x: `${entry.n} occurrences in the Scroll`
    };
  }).sort((a, b) => a.i.localeCompare(b.i));
}

/* ---------------- claims ---------------- */
function flattenText(value, depth = 0) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(item => flattenText(item, depth + 1)).filter(Boolean).join(" ");
  if (value && typeof value === "object" && depth < 2) {
    return Object.values(value).map(item => flattenText(item, depth + 1)).filter(Boolean).join(" ");
  }
  return "";
}

function buildClaims() {
  const register = readJson("docs", "scroll", "evidence", "claim-register.json");
  return register.claims.map(claim => ({
    i: `claim:${claim.id}`, a: "claims", t: claim.title, u: "scroll/editorial.html",
    h: [claim.id, claim.classification || "", claim.evidenceStatus || ""].filter(Boolean).join(" "),
    b: [claim.statusLabel || "", flattenText(claim.establishes), flattenText(claim.unverified)].filter(Boolean).join(" ").slice(0, CLAIM_BODY_CAP),
    x: claim.evidenceStatus || ""
  })).sort((a, b) => a.i.localeCompare(b.i));
}

/* ---------------- assemble ---------------- */
const AREAS = [
  { id: "pages", title: "Pages", shard: "pages.json" },
  { id: "scrolls", title: "Scrolls", shard: "scrolls.json" },
  { id: "atlas", title: "Atlas", shard: "atlas.json" },
  { id: "lexicon", title: "Lexicon", shard: "lexicon.json" },
  { id: "claims", title: "Claims", shard: "claims.json" }
];

const builders = { pages: buildPages, scrolls: buildScrolls, atlas: buildAtlas, lexicon: buildLexicon, claims: buildClaims };
const files = new Map();
const shardInfo = {};
const counts = {};
let total = 0;
for (const area of AREAS) {
  const docsForArea = builders[area.id]();
  counts[area.id] = docsForArea.length;
  total += docsForArea.length;
  const bytes = Buffer.from(`${JSON.stringify({ schemaVersion: 1, area: area.id, count: docsForArea.length, docs: docsForArea })}\n`, "utf8");
  files.set(area.shard, bytes);
  shardInfo[area.id] = { file: area.shard, count: docsForArea.length, bytes: bytes.length, sha256: sha(bytes) };
}
const library = readJson("docs", "scroll", "data", "library.json");
const segmentData = readJson("docs", "scroll", "data", "reader-segments.json");

const manifest = {
  schemaVersion: 1,
  generator: "scripts/build-search-index.mjs",
  engine: "living-search-bm25-v1",
  note: "Generated from the sealed catalog and Scroll data. The index Netlify and GitHub Pages serve is this committed artifact; regenerate with npm run search:index after site:catalog.",
  sources: {
    "docs/data/site-catalog.json": sourceHash("docs", "data", "site-catalog.json"),
    "docs/scroll/data/library.json": sourceHash("docs", "scroll", "data", "library.json"),
    "docs/scroll/data/reader-segments.json": sourceHash("docs", "scroll", "data", "reader-segments.json"),
    "docs/scroll/search/lexicon/lexicon-index.json": sourceHash("docs", "scroll", "search", "lexicon", "lexicon-index.json"),
    "docs/scroll/evidence/claim-register.json": sourceHash("docs", "scroll", "evidence", "claim-register.json")
  },
  areas: AREAS,
  counts: {
    pages: counts.pages,
    scrollSections: library.sections.length,
    scrollSegments: segmentData.segments.length,
    scrolls: counts.scrolls,
    atlas: counts.atlas,
    lexicon: counts.lexicon,
    claims: counts.claims,
    total
  },
  shards: shardInfo,
  pageExclusions: { prefixes: PAGE_EXCLUDED_PREFIXES, files: PAGE_EXCLUDED_FILES }
};
files.set("manifest.json", Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"));

if (args.has("--check")) {
  let drift = 0;
  for (const [name, bytes] of files) {
    const target = path.join(outputRoot, name);
    if (!fs.existsSync(target) || !fs.readFileSync(target).equals(bytes)) { drift += 1; console.error(`DRIFT: ${name}`); }
  }
  if (fs.existsSync(outputRoot)) {
    for (const entry of fs.readdirSync(outputRoot, { withFileTypes: true })) {
      if (entry.isFile() && !files.has(entry.name)) { drift += 1; console.error(`UNEXPECTED: ${entry.name}`); }
    }
  }
  if (drift) { console.error(`Living Search index is stale (${drift} differences). Run npm run search:index.`); process.exit(1); }
  console.log(`Living Search index reproduces byte-for-byte (${files.size} files, ${total} documents).`);
  process.exit(0);
}

fs.mkdirSync(outputRoot, { recursive: true });
for (const [name, bytes] of files) fs.writeFileSync(path.join(outputRoot, name), bytes);
const totalBytes = [...files.values()].reduce((sum, bytes) => sum + bytes.length, 0);
console.log(`Built Living Search index: ${total} documents (${counts.pages} pages, ${counts.scrolls} scrolls, ${counts.atlas} atlas, ${counts.lexicon} lexicon, ${counts.claims} claims), ${totalBytes} bytes across ${files.size} files.`);
