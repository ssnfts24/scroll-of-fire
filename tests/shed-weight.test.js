/**
 * Shed hidden weight — Page Evolution Batch E4 (Nov 25, 2026).
 *
 * The plan's charge: the site's heaviest pages carried their
 * weight where a visitor could not see it — closed shelves,
 * a closed archive door, a dictionary baked into a page,
 * engines for panels never opened. These tests pin the diet:
 * the weight now rides behind the doors it belongs to, every
 * door still opens onto the whole of what it held, and the
 * homepage's 52-script stack runs deferred in its own order.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const docs = path.join(__dirname, "..", "docs");
const read = (rel) => fs.readFileSync(path.join(docs, rel), "utf8");

test("the Scroll index ships the shelves alone; each list rides behind its shelf", () => {
  const index = read("scroll/index.html");
  assert.ok(fs.statSync(path.join(docs, "scroll/index.html")).size < 60_000, "index back under 60 KB");
  assert.equal((index.match(/<a /g) || []).length < 200, true, "the 1,989-link DOM is gone from first load");
  for (const shelf of ["foundations", "scripture", "history", "evidence", "technology", "prophecy", "witness", "reference"]) {
    assert.ok(index.includes(`data-shelf-src="data/shelf-${shelf}.html"`), `${shelf} shelf points at its fragment`);
    const fragment = read(`scroll/data/shelf-${shelf}.html`);
    assert.ok(fragment.includes(`data-shelf-list="${shelf}"`), `${shelf} fragment carries its list`);
    assert.ok(fragment.includes("reader.html?section="), `${shelf} fragment carries real reader links`);
  }
  assert.ok(index.includes('src="assets/shelf-loader.js"'), "the shelf loader rides the page");
  assert.ok(read("scroll/assets/shelf-loader.js").includes('"toggle"'), "the loader fetches on open");
});

test("the downloads archive rides behind its door, seals intact", () => {
  const page = read("downloads.html");
  assert.ok(fs.statSync(path.join(docs, "downloads.html")).size < 40_000, "downloads back under 40 KB");
  assert.ok(page.includes('href="assets/data/downloads-archive.html"'), "the door keeps its plain link");
  assert.ok(page.includes("data-archive-mount"), "the door carries its mount");
  const archive = read("assets/data/downloads-archive.html");
  assert.ok(archive.length > 150_000, "the archive fragment holds the whole archive");
  assert.ok((archive.match(/[a-f0-9]{64}/g) || []).length > 100, "the SHA-256 seals ride the fragment");
  assert.ok(read("assets/js/downloads-archive.js").includes("archive-door"), "the loader watches the door");
});

test("the Recoder dictionary is data now, whole and in its own file", () => {
  const page = read("systems/recoder.html");
  assert.ok(fs.statSync(path.join(docs, "systems/recoder.html")).size < 60_000, "recoder page back under 60 KB");
  assert.ok(page.includes("const DICTIONARY = window.RECODER_DICTIONARY || [];"), "the page reads the split dictionary");
  assert.ok(page.includes('<script src="../assets/js/recoder-dictionary.js"></script>'), "the data file loads before the page script");
  global.window = {};
  require(path.join(docs, "assets/js/recoder-dictionary.js"));
  assert.equal(window.RECODER_DICTIONARY.length, 194, "every dictionary entry made the move");
  assert.equal(window.RECODER_DICTIONARY[0].old, "Reality", "the first entry is the dictionary's own first entry");
  delete global.window;
});

test("the homepage's script stack is deferred, in its own order", () => {
  const index = read("index.html");
  const tags = [...index.matchAll(/<script[^>]*src="[^"]+"[^>]*>/g)].map((m) => m[0]);
  assert.equal(tags.length, 52, "the stack is whole");
  assert.ok(tags.every((t) => /\bdefer\b/.test(t)), "every script in the stack defers");
});

test("moons: the astrology engine waits behind its own tab", () => {
  const moons = read("moons.html");
  assert.ok(!moons.includes('<script src="assets/js/astrology.js'), "astrology no longer rides first load");
  const engine = read("assets/js/moons.js");
  assert.ok(engine.includes("ensureAstrology"), "moons.js carries the lazy loader");
  assert.ok(engine.includes('id === "astrologyPanel"'), "the loader hangs on the astrology tab");
  assert.ok(read("assets/js/astrology.js").includes("readyState"), "the engine boots when loaded late");
});
