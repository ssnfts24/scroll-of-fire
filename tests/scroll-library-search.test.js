"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const scrollRoot = path.join(root, "docs", "scroll");
const searchRoot = path.join(scrollRoot, "search");
const N = require(path.join(scrollRoot, "assets", "search-normalize.js"));
const read = (...parts) => JSON.parse(fs.readFileSync(path.join(...parts), "utf8"));
const manifest = read(searchRoot, "manifest.json");
const sections = read(searchRoot, "sections.json");
const segmentData = read(scrollRoot, "data", "reader-segments.json");
const lexicon = read(searchRoot, "lexicon", "lexicon-index.json");
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const hex = text => [...text].map(char => char.codePointAt(0).toString(16).padStart(4, "0")).join("");

const chunkCache = new Map();
function segmentText(ordinal) {
  const chunk = Math.floor(ordinal / manifest.counts.chunkSize);
  if (!chunkCache.has(chunk)) chunkCache.set(chunk, read(searchRoot, "text", `t-${String(chunk).padStart(3, "0")}.json`));
  return chunkCache.get(chunk)[ordinal % manifest.counts.chunkSize];
}

// Exact-token lookup mirroring the browser: load only the shard for the token.
function lookup(query) {
  const [token] = N.tokenize(query);
  const key = [...token].slice(0, 2).join("");
  const file = path.join(searchRoot, "index", `ix-${hex(key)}.json`);
  if (!fs.existsSync(file)) return [];
  const posting = read(file)[token];
  if (!posting) return [];
  let ordinal = 0;
  return posting.d.map(delta => (ordinal += delta));
}

function positionalLookup(query) {
  const [token] = N.tokenize(query);
  const key = [...token].slice(0, 2).join("");
  const posting = read(searchRoot, "index", `ix-${hex(key)}.json`)[token];
  if (!posting) return new Map();
  const found = new Map();
  let ordinal = 0;
  posting.d.forEach((delta, index) => {
    ordinal += delta;
    let position = 0;
    found.set(ordinal, posting.p[index].map(value => (position += value)));
  });
  return found;
}

function phraseLookup(query) {
  const tokens = N.tokenize(query);
  const postings = tokens.map(positionalLookup);
  if (postings.some(posting => !posting.size)) return [];
  const positions = postings.slice(1).map(posting => new Map(
    [...posting].map(([ordinal, values]) => [ordinal, new Set(values)])
  ));
  return [...postings[0]].filter(([ordinal, first]) =>
    positions.every(posting => posting.has(ordinal)) &&
    first.some(position => positions.every((posting, offset) => posting.get(ordinal).has(position + offset + 1)))
  ).map(([ordinal]) => ordinal);
}

test("search artifacts are pinned to the frozen source and count every segment", () => {
  assert.equal(manifest.sourceSha256, "81a015fb937f1664c2383fa38fddf956d281c6309a9584382c6dbc9d8b691400");
  assert.equal(manifest.sourceCommit, "980b1f56fdc9974ed57e1c12ccedb0819d39e6b6");
  assert.equal(manifest.counts.segments, 1609);
  assert.equal(segmentData.segments.length, 1609);
  assert.deepEqual(sections.segIds, segmentData.segments.map(segment => segment.id));
  assert.ok(sections.sourceUrl.includes(manifest.sourceCommit));
});

test("every segment's text is searchable and identical to the reader segment", () => {
  segmentData.segments.forEach((segment, ordinal) => {
    assert.equal(segmentText(ordinal), segment.text, `text of ${segment.id}`);
  });
});

test("every original nonblank line is covered by exactly one indexed segment, in order", () => {
  let previousEnd = 0;
  for (const segment of segmentData.segments) {
    assert.ok(segment.lineStart >= previousEnd, `${segment.id} overlaps its predecessor`);
    previousEnd = segment.lineEnd;
  }
  const source = fs.readFileSync(path.join(root, "archive", "Full_Scroll_Unsealed", "1.0.0", "Full_Scroll_Unsealed"), "utf8").split(/\r\n|\n|\r/);
  const covered = new Set();
  for (const segment of segmentData.segments) for (let line = segment.lineStart; line <= segment.lineEnd; line += 1) covered.add(line);
  source.forEach((text, index) => {
    if (text.trim()) assert.ok(covered.has(index + 1), `source line ${index + 1} is not covered`);
  });
});

test("artifact manifest hashes match the committed files and the index rebuilds byte-for-byte", () => {
  for (const artifact of manifest.artifacts) {
    const bytes = fs.readFileSync(path.join(searchRoot, artifact.path));
    assert.equal(bytes.length, artifact.bytes, artifact.path);
    assert.equal(sha(bytes), artifact.sha256, artifact.path);
  }
  const output = execFileSync(process.execPath, [path.join(root, "scripts", "build-scroll-search.mjs"), "--check"], { cwd: root, encoding: "utf8" });
  assert.match(output, /reproduce byte-for-byte/);
});

test("normalization folds niqqud, final letters and punctuation for matching only", () => {
  const plain = N.normalize("בראשית");
  assert.equal(N.normalize("בְּרֵאשִׁית"), plain);
  assert.equal(N.normalize("בראשית-ברא"), `${plain} ${N.normalize("ברא")}`);
  assert.equal(N.normalize("Da’at"), "daat");
  assert.equal(N.normalize("אֶרֶץ"), N.normalize("ארץ"));
  assert.equal(N.hasHebrew("Genesis"), false);
  assert.equal(N.hasHebrew("בראשית"), true);
  assert.equal(N.transliterationKey("Tzaddik"), N.transliterationKey("Tsadik"));
  assert.equal(N.transliterationKey("Chokmah"), N.transliterationKey("Hokmah"));
});

test("English phrases, Genesis chapters, and Hebrew with and without niqqud find the right segments", () => {
  const serpent = lookup("Nachash");
  assert.ok(serpent.length >= 2);
  for (const ordinal of serpent) assert.match(N.normalize(segmentText(ordinal)), /\bnachash\b/);
  const plain = lookup("בראשית");
  const pointed = lookup("בְּרֵאשִׁית");
  assert.ok(plain.length > 0);
  assert.deepEqual(pointed, plain);
  for (const ordinal of plain) assert.ok(N.tokenize(segmentText(ordinal)).includes(N.tokenize("בראשית")[0]));
  const phrase = lookup("serpent").filter(ordinal => segmentText(ordinal).includes("Did God really say"));
  assert.ok(phrase.length >= 1);
  const genesis3 = sections.genesis.find(entry => entry.chapter === 3);
  assert.equal(segmentData.segments.find(segment => segment.id === genesis3.segmentId).genesisChapter, 3);
});

test("positional postings verify exact phrases beyond the former 400-candidate cap", () => {
  const query = "and the";
  const tokens = N.tokenize(query);
  const postings = tokens.map(positionalLookup);
  for (const token of tokens) {
    const index = read(searchRoot, "index", `ix-${hex([...token].slice(0, 2).join(""))}.json`)[token];
    assert.equal(index.p.length, index.d.length);
    index.p.forEach((positions, indexOrdinal) => assert.equal(positions.length, index.f[indexOrdinal]));
  }
  const rankedCandidates = [];
  for (const [ordinal, frequency] of postings[0]) {
    if (!postings.every(posting => posting.has(ordinal))) continue;
    const score = postings.reduce((total, posting) =>
      total + (1 + Math.log(posting.get(ordinal).length)) *
        Math.log(1 + sections.segIds.length / posting.size), 0);
    rankedCandidates.push({ ordinal, score });
  }
  rankedCandidates.sort((a, b) => b.score - a.score || a.ordinal - b.ordinal);
  const exact = phraseLookup(query);
  const sourceMatches = segmentData.segments.map((segment, ordinal) => {
    const words = N.tokenize(segment.text);
    const hasPhrase = words.some((word, index) =>
      tokens.every((token, offset) => words[index + offset] === token)
    );
    return hasPhrase ? ordinal : -1;
  }).filter(ordinal => ordinal >= 0);
  assert.deepEqual(exact.sort((a, b) => a - b), sourceMatches);
  assert.equal(exact.length, 109);
  assert.ok(exact.some(ordinal => rankedCandidates.findIndex(candidate => candidate.ordinal === ordinal) >= 400));
});

test("ordinary search keeps every posting candidate and fetches text in visible pages", () => {
  const script = fs.readFileSync(path.join(scrollRoot, "assets", "search.js"), "utf8");
  assert.equal(lookup("the").length, 925);
  assert.doesNotMatch(script, /CANDIDATE_LIMIT/);
  assert.match(script, /async function loadPage\(from, to, id\)/);
  assert.match(script, /current\.results\.slice\(from, to\)/);
  assert.match(script, /await loadPage\(previous, next, id\)/);
  assert.match(script, /const PAGE_SIZE = 10/);
});

test("clearing or replacing a search invalidates stale asynchronous results", () => {
  const script = fs.readFileSync(path.join(scrollRoot, "assets", "search.js"), "utf8");
  assert.match(script, /if \(id !== runId\) return/);
  assert.match(script, /clearTimeout\(timer\);\s*runId \+= 1;\s*input\.value = ""/);
  assert.match(script, /function reset\(\) \{\s*runId \+= 1;/);
});

test("all 50 Genesis chapters remain addressable from the search tables", () => {
  assert.deepEqual(sections.genesis.map(entry => entry.chapter), Array.from({ length: 50 }, (_, index) => index + 1));
  for (const entry of sections.genesis) {
    const ordinal = sections.segIds.indexOf(entry.segmentId);
    assert.ok(ordinal >= 0, `Genesis ${entry.chapter}`);
    assert.equal(sections.segChapter[ordinal], entry.chapter);
  }
});

test("shelf filters cover the eight planned shelves and every section has one", () => {
  assert.deepEqual(sections.shelves.map(shelf => shelf.id ?? shelf), ["foundations", "scripture", "history", "evidence", "technology", "prophecy", "witness", "reference"].map(id => id));
  for (const row of sections.sections) assert.ok(Number.isInteger(row[2]) && row[2] >= 0 && row[2] < 8);
});

test("the lexicon indexes all 911 Hebrew forms and each links to original lines", () => {
  assert.equal(lexicon.count, 911);
  assert.equal(lexicon.entries.length, 911);
  const audit = read(root, "archive", "Full_Scroll_Unsealed", "1.0.0", "content-audit.json");
  assert.equal(audit.hebrewTerms.length, 911);
  const buckets = new Map();
  for (const entry of lexicon.entries) {
    const key = [...N.normalize(entry.c)][0] ?? "x";
    if (!buckets.has(key)) buckets.set(key, read(searchRoot, "lexicon", `entries-${hex(key)}.json`));
    const detail = buckets.get(key)[entry.id];
    assert.ok(detail, `${entry.id} has detail`);
    assert.ok(detail.lines.length > 0 && detail.occurrences.length > 0, `${entry.id} has occurrences`);
  }
});

test("lexicon notes quote only the author and attach no invented definitions", () => {
  const kinds = new Set();
  for (const file of fs.readdirSync(path.join(searchRoot, "lexicon")).filter(name => name.startsWith("entries-"))) {
    for (const detail of Object.values(read(searchRoot, "lexicon", file))) for (const note of detail.notes) kinds.add(note.kind);
  }
  for (const kind of kinds) assert.match(kind, /^author-/);
  assert.match(fs.readFileSync(path.join(scrollRoot, "assets", "lexicon.js"), "utf8"), /adds no independent dictionary definition/);
});

test("atlas links carry one of the five relationship labels and never claim causation", () => {
  const allowed = new Set(["direct-citation", "shared-subject", "lexical-connection", "repeated-passage", "author-interpretation"]);
  assert.equal(read(searchRoot, "atlas", "scriptures.json").relationship, "direct-citation");
  assert.equal(read(searchRoot, "atlas", "entities.json").relationship, "shared-subject");
  assert.equal(read(searchRoot, "atlas", "repeated.json").relationship, "repeated-passage");
  for (const name of ["scriptures", "entities", "repeated", "years"]) assert.ok(allowed.has(read(searchRoot, "atlas", `${name}.json`).relationship), name);
  assert.match(read(searchRoot, "atlas", "entities.json").note, /not proof|does not establish|navigation/i);
});

test("tool pages exist, link back to the original, and are listed in the sitemap and glossary", () => {
  for (const name of ["search", "lexicon", "atlas"]) {
    const html = fs.readFileSync(path.join(scrollRoot, `${name}.html`), "utf8");
    assert.match(html, /<link rel="canonical"/);
    assert.match(html, /<main/);
    assert.ok(fs.readFileSync(path.join(root, "docs", "sitemap.xml"), "utf8").includes(`/scroll/${name}.html`));
  }
  const home = fs.readFileSync(path.join(scrollRoot, "index.html"), "utf8");
  assert.match(home, /search\.html/);
  assert.match(home, /lexicon\.html/);
  assert.match(home, /atlas\.html/);
  assert.match(fs.readFileSync(path.join(scrollRoot, "reader.html"), "utf8"), /search\.html/);
  assert.match(fs.readFileSync(path.join(root, "docs", "glossary.html"), "utf8"), /\/scroll\/lexicon\.html/);
});

test("search assets are local-only with no CDN or remote service", () => {
  for (const name of ["search", "lexicon", "atlas", "scroll-common", "search-normalize", "reader"]) {
    const script = fs.readFileSync(path.join(scrollRoot, "assets", `${name}.js`), "utf8");
    assert.doesNotMatch(script, /https?:\/\/(?!github\.com\/ssnfts24|www\.sefaria\.org)/, name);
  }
  for (const name of ["search", "lexicon", "atlas"]) {
    assert.doesNotMatch(fs.readFileSync(path.join(scrollRoot, `${name}.html`), "utf8"), /<script[^>]+src="https?:/);
  }
});

test("the first search does not require the whole index", () => {
  const total = manifest.artifacts.reduce((sum, artifact) => sum + artifact.bytes, 0);
  assert.ok(total > 0);
  const largestShard = Math.max(...manifest.artifacts.filter(a => a.path.startsWith("index/")).map(a => a.bytes));
  assert.ok(largestShard < 200 * 1024, `largest shard ${largestShard}`);
  assert.ok(manifest.counts.indexShards > 100);
});

test("the archive and protected runtime files are unchanged by the search phase", () => {
  const archive = fs.readFileSync(path.join(root, "archive", "Full_Scroll_Unsealed", "1.0.0", "Full_Scroll_Unsealed"));
  assert.equal(sha(archive), manifest.sourceSha256);
  const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n").filter(Boolean);
  let changed;
  try {
    changed = git(["diff", "--name-only", "origin/main...HEAD"]);
  } catch {
    changed = []; // shallow checkout without a main ref: only working-tree changes can be inspected
  }
  changed.push(...git(["status", "--porcelain"]).map(line => line.slice(3)));
  for (const file of changed) {
    assert.doesNotMatch(file, /^archive\//, file);
    assert.doesNotMatch(file, /^docs\/service-worker\.js$/, file);
    assert.doesNotMatch(file, /observatory|calendar|renderer/i, file);
    assert.doesNotMatch(file, /^docs\/scroll\/data\//, file);
  }
});
