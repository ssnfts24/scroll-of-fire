"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const docs = path.join(root, "docs");
const searchRoot = path.join(docs, "assets", "search");
const readJson = (...parts) => JSON.parse(fs.readFileSync(path.join(...parts), "utf8"));
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

const manifest = readJson(searchRoot, "manifest.json");
const shards = {};
for (const area of manifest.areas) shards[area.id] = readJson(searchRoot, area.shard || manifest.shards[area.id].file);

const Core = require(path.join(docs, "assets", "js", "living-search-core.js"));
const Memory = require(path.join(docs, "assets", "js", "living-search-memory.js"));
const ScrollNormalize = require(path.join(docs, "scroll", "assets", "search-normalize.js"));

test("the Living Search index rebuilds byte-for-byte from its sealed sources", () => {
  const output = execFileSync(process.execPath, [path.join(root, "scripts", "build-search-index.mjs"), "--check"], { cwd: root, encoding: "utf8" });
  assert.match(output, /reproduces byte-for-byte/);
});

test("manifest source hashes match the committed source files", () => {
  for (const [relative, expected] of Object.entries(manifest.sources)) {
    assert.equal(sha(fs.readFileSync(path.join(root, relative))), expected, relative);
  }
});

test("indexed counts equal the counts of the catalogued sources", () => {
  const catalog = readJson(docs, "data", "site-catalog.json");
  const library = readJson(docs, "scroll", "data", "library.json");
  const segments = readJson(docs, "scroll", "data", "reader-segments.json");
  const lexicon = readJson(docs, "scroll", "search", "lexicon", "lexicon-index.json");
  const register = readJson(docs, "scroll", "evidence", "claim-register.json");
  assert.equal(manifest.counts.atlas, catalog.entries.length);
  assert.equal(manifest.counts.lexicon, lexicon.count);
  assert.equal(manifest.counts.claims, register.claims.length);
  assert.equal(manifest.counts.scrollSections, library.sections.length);
  assert.equal(manifest.counts.scrollSegments, segments.segments.length);
  assert.equal(manifest.counts.scrolls, library.sections.length + segments.segments.length);
  for (const area of manifest.areas) {
    /* The pages shard holds passages, not pages: its document
     * count is counts.pagePassages, while counts.pages stays the
     * count of pages themselves (pinned by the walk test below). */
    const expectedDocs = area.id === "pages" ? manifest.counts.pagePassages : manifest.counts[area.id];
    assert.equal(shards[area.id].count, expectedDocs, area.id);
    assert.equal(shards[area.id].docs.length, expectedDocs, area.id);
    const info = manifest.shards[area.id];
    const bytes = fs.readFileSync(path.join(searchRoot, info.file));
    assert.equal(bytes.length, info.bytes, area.id);
    assert.equal(sha(bytes), info.sha256, area.id);
  }
  assert.equal(manifest.counts.total,
    manifest.counts.pagePassages + manifest.counts.scrolls + manifest.counts.atlas + manifest.counts.lexicon + manifest.counts.claims);
});

test("the pages count equals an independent walk of the site with the recorded exclusions", () => {
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
  const html = walk(docs).filter(file => file.endsWith(".html"))
    .map(file => path.relative(docs, file).split(path.sep).join("/"));
  const expected = html.filter(rel =>
    !manifest.pageExclusions.prefixes.some(prefix => rel.startsWith(prefix)) &&
    !manifest.pageExclusions.files.includes(rel));
  assert.equal(manifest.counts.pages, expected.length);
});

test("every indexed entry's URL resolves to a real file in docs/ or its catalogued GitHub URL", () => {
  const catalog = readJson(docs, "data", "site-catalog.json");
  const githubUrls = new Set(catalog.entries.map(entry => entry.url).filter(url => typeof url === "string" && url.includes("github.com")));
  for (const area of manifest.areas) {
    for (const doc of shards[area.id].docs) {
      assert.ok(doc.u, `${doc.i} has no URL`);
      if (/^https?:\/\//.test(doc.u)) {
        assert.ok(githubUrls.has(doc.u), `${doc.i} points off-catalogue: ${doc.u}`);
        continue;
      }
      const clean = doc.u.split(/[?#]/)[0];
      const target = clean === "" || clean.endsWith("/") ? path.join(docs, clean, "index.html") : path.join(docs, clean);
      assert.ok(fs.existsSync(target), `${doc.i} -> ${doc.u} does not resolve`);
    }
  }
});

test("normalization parity with the Scroll search module, including pointed Hebrew", () => {
  for (const sample of ["בְּרֵאשִׁית", "Da’at", "Élohim — the Mighty", "אֶרֶץ", "Nachash (נָחָשׁ)"]) {
    assert.deepEqual(Core.tokenize(sample), ScrollNormalize.tokenize(sample), sample);
    assert.equal(Core.transliterationKey(sample), ScrollNormalize.transliterationKey(sample), sample);
  }
  assert.deepEqual(Core.tokenize("בראשית"), Core.tokenize("בְּרֵאשִׁית"));
});

function fixtureIndex() {
  const index = Core.createIndex();
  Core.addDocuments(index, [
    { i: "a", a: "pages", t: "Resonance and Light", u: "a.html", h: "Frequency carriers", b: "A short passage about tuning and coherence." },
    { i: "b", a: "pages", t: "Unrelated Notes", u: "b.html", h: "", b: "resonance resonance resonance mentioned only in passing text here" },
    { i: "c", a: "scrolls", t: "Genesis", u: "c.html", h: "", b: "בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם" },
    { i: "d", a: "lexicon", t: "בראשית", u: "d.html", h: "the first word of the Scroll", b: "בְּרֵאשִׁית", k: [Core.transliterationKey("Bereishit")] }
  ]);
  return index;
}

test("BM25 field weighting ranks a title match above repeated body mentions", () => {
  const { results } = Core.search(fixtureIndex(), "resonance");
  assert.ok(results.length >= 2);
  assert.equal(results[0].doc.i, "a");
});

test("Hebrew is found pointed or unpointed, in both directions", () => {
  const index = fixtureIndex();
  assert.ok(Core.search(index, "בראשית").results.some(result => result.doc.i === "c"));
  assert.ok(Core.search(index, "בְּרֵאשִׁית").results.some(result => result.doc.i === "c"));
});

test("lexicon entries are findable by transliteration key", () => {
  const { results } = Core.search(fixtureIndex(), "bereshit");
  assert.ok(results.some(result => result.doc.i === "d"));
});

test("prefix expansion and typo tolerance keep near-miss queries alive", () => {
  const index = fixtureIndex();
  assert.ok(Core.search(index, "reson").results.some(result => result.doc.i === "a"));
  assert.ok(Core.search(index, "resonanse").results.some(result => result.doc.i === "a"));
  assert.ok(Core.suggestTerms(index, "resonanse").includes("resonance"));
  assert.deepEqual(Core.suggestTerms(index, "resonance"), []);
});

test("area filters restrict results to the chosen area", () => {
  const index = fixtureIndex();
  const { results } = Core.search(index, "בראשית", { areas: ["lexicon"] });
  assert.deepEqual(results.map(result => result.doc.i), ["d"]);
});

test("snippets anchor on the matched word and preserve the original pointing", () => {
  const doc = { t: "Genesis", h: "", b: "In the beginning — בְּרֵאשִׁית — the word is spoken and the heavens open over the deep waters of the earth." };
  const snippet = Core.snippetFor(doc, "בראשית");
  assert.ok(snippet.text.includes("בְּרֵאשִׁית"));
  assert.ok(snippet.ranges.length >= 1);
  const [start, end] = snippet.ranges[0];
  assert.equal(snippet.text.slice(start, end), "בְּרֵאשִׁית");
});

function stubStorage() {
  const map = new Map();
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
    _map: map
  };
}

test("memory: recents dedupe case-insensitively, cap at the limit, and clear", () => {
  const memory = Memory.createMemory(stubStorage());
  memory.addRecent("Resonance");
  memory.addRecent("orphan trains");
  memory.addRecent("resonance");
  assert.deepEqual(memory.getRecents(), ["resonance", "orphan trains"]);
  for (let i = 0; i < 15; i += 1) memory.addRecent(`query ${i}`);
  assert.equal(memory.getRecents().length, Memory.MAX_RECENTS);
  assert.equal(memory.getRecents()[0], "query 14");
  memory.clearAll();
  assert.deepEqual(memory.getRecents(), []);
  assert.deepEqual(memory.getVisits(), []);
});

test("memory: visits dedupe by URL, keep the newest first, and validate their shape", () => {
  const memory = Memory.createMemory(stubStorage());
  memory.addVisit({ t: "Moons", u: "moons.html", a: "pages" });
  memory.addVisit({ t: "Atlas", u: "codex-atlas.html", a: "pages" });
  memory.addVisit({ t: "Moons again", u: "moons.html", a: "pages" });
  assert.deepEqual(memory.getVisits().map(visit => visit.u), ["moons.html", "codex-atlas.html"]);
  memory.addVisit({ t: "", u: "x.html" });
  memory.addVisit({ u: "y.html" });
  assert.equal(memory.getVisits().length, 2);
});

test("memory: unavailable or corrupt storage degrades to a no-op, never a throw", () => {
  const unavailable = Memory.createMemory(null);
  assert.equal(unavailable.available, false);
  unavailable.addRecent("resonance");
  unavailable.addVisit({ t: "Moons", u: "moons.html" });
  unavailable.clearAll();
  assert.deepEqual(unavailable.getRecents(), []);
  const corrupt = Memory.createMemory({ getItem: () => "{not json", setItem: () => {}, removeItem: () => {} });
  assert.deepEqual(corrupt.getRecents(), []);
  const throwing = Memory.createMemory({ getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); }, removeItem: () => {} });
  throwing.addRecent("resonance");
  assert.deepEqual(throwing.getRecents(), []);
});

test("the search page is wired: canonical, shared scripts, mount point, sitemap", () => {
  const html = fs.readFileSync(path.join(docs, "search.html"), "utf8");
  assert.match(html, /<link rel="canonical" href="https:\/\/codexofreality\.org\/search\.html">/);
  assert.match(html, /assets\/js\/site\.js/);
  for (const name of ["living-search-core.js", "living-search-memory.js", "living-search.js"]) {
    assert.ok(html.includes(`assets/js/${name}`), name);
  }
  assert.ok(html.includes('id="living-search-app"'));
  assert.match(html, /only on this device|in this browser only/i);
  assert.ok(fs.readFileSync(path.join(docs, "sitemap.xml"), "utf8").includes("https://codexofreality.org/search.html"));
  const catalog = readJson(docs, "data", "site-catalog.json");
  const entry = catalog.entries.find(item => item.id === "site-search");
  assert.ok(entry, "catalogue entry exists");
  assert.equal(entry.status, "live");
  assert.equal(entry.path, "search.html");
});

test("the launcher line is on content pages and off the protected and Scroll pages", () => {
  for (const rel of ["index.html", "moons.html", "codex-atlas.html", "theory/equations/eq00.html", "shop.html", "13-moon-whitepaper.html"]) {
    assert.ok(fs.readFileSync(path.join(docs, rel), "utf8").includes("living-search-launcher.js"), rel);
  }
  for (const rel of ["living-time-sphere.html", "scroll/search.html", "scroll/lexicon.html", "404.html"]) {
    assert.ok(!fs.readFileSync(path.join(docs, rel), "utf8").includes("living-search-launcher.js"), rel);
  }
  const launcher = fs.readFileSync(path.join(docs, "assets", "js", "living-search-launcher.js"), "utf8");
  assert.match(launcher, /ctrlKey/);
  assert.match(launcher, /event\.key === "\/"/);
  assert.match(launcher, /data-site-nav/);
});

test("the search index loads on first interaction, not when the UI is built", () => {
  const script = fs.readFileSync(path.join(docs, "assets", "js", "living-search.js"), "utf8");
  assert.match(script, /function ensureIndexStarted\(\)/, "the deferred starter exists");
  assert.match(script, /addEventListener\("pointerdown", ensureIndexStarted\)/, "a tap in the box starts the index");
  assert.match(script, /start: ensureIndexStarted/, "the overlay can start the index when it opens");
  assert.ok(!/^ {4}loadInitial\(\(\) =>/m.test(script), "buildUI no longer starts the index load eagerly");
  assert.match(script, /^ {6}loadInitial\(\(\) =>/m, "the only loadInitial call lives inside the starter");
});

test("the Living Search client is local-only: no remote endpoints in its scripts", () => {
  for (const name of ["living-search-core.js", "living-search-memory.js", "living-search.js", "living-search-launcher.js"]) {
    const script = fs.readFileSync(path.join(docs, "assets", "js", name), "utf8");
    assert.doesNotMatch(script, /https?:\/\//, name);
  }
  const memory = fs.readFileSync(path.join(docs, "assets", "js", "living-search-memory.js"), "utf8");
  assert.doesNotMatch(memory, /fetch|XMLHttpRequest|sendBeacon/);
});

test("grouping folds same-title results, keeps the strongest, and collapses true duplicates", () => {
  const results = [
    { doc: { i: "s1", a: "scrolls", t: "REMNANT RISING", u: "scroll/reader.html?section=one", w: "Scroll of Fire · Witness shelf", g: "uppercase-heading:REMNANT RISING" }, score: 9, matched: ["remnant"] },
    { doc: { i: "s2", a: "scrolls", t: "**REMNANT RISING**", u: "scroll/reader.html?section=two", w: "Scroll of Fire · Witness shelf", g: "uppercase-heading:REMNANT RISING" }, score: 8, matched: ["remnant"] },
    { doc: { i: "s3", a: "scrolls", t: "REMNANT RISING", u: "scroll/reader.html?section=one", w: "Scroll of Fire · Witness shelf", g: "uppercase-heading:REMNANT RISING" }, score: 7, matched: ["remnant"] },
    { doc: { i: "p1", a: "pages", t: "Remnant Rising", u: "rising.html" }, score: 6, matched: ["remnant"] }
  ];
  const groups = Core.groupResults(results);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].doc.i, "s1", "the strongest result leads its group");
  assert.deepEqual(groups[0].folded.map(entry => entry.doc.i), ["s2"], "s3 shares title, home and target with s1, so it collapses");
  assert.equal(groups[1].doc.i, "p1", "the same title in another area stays its own row");
});

test("every scroll result in the index names its home and its place in the Scroll", () => {
  for (const doc of shards.scrolls.docs) {
    assert.match(doc.w || "", /^Scroll of Fire · .+ shelf$/, doc.i);
    assert.ok(doc.p, doc.i);
  }
  const rising = shards.scrolls.docs.filter(doc => doc.g === "uppercase-heading:REMNANT RISING");
  assert.ok(rising.length >= 12, `the library's REMNANT RISING duplicate group reaches the index (got ${rising.length})`);
});

test("a search for remnant shows one Remnant Rising row with the repeats folded under it", () => {
  const index = Core.createIndex();
  for (const area of manifest.areas) Core.addDocuments(index, shards[area.id].docs);
  const { results } = Core.search(index, "remnant", { limit: 200 });
  const groups = Core.groupResults(results);
  const rising = groups.filter(group => Core.normalize(group.doc.t) === "remnant rising");
  assert.equal(rising.length, 1);
  assert.ok(rising[0].folded.length >= 7, `expected at least 7 folded repeats, got ${rising[0].folded.length}`);
});
