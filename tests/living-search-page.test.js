"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const docs = path.join(root, "docs");
const searchRoot = path.join(docs, "assets", "search");
const readJson = (...parts) => JSON.parse(fs.readFileSync(path.join(...parts), "utf8"));

const manifest = readJson(searchRoot, "manifest.json");
const Page = require(path.join(docs, "assets", "js", "living-search-page.js"));

test("the search page carries the counts line and the Surprise me door", () => {
  const html = fs.readFileSync(path.join(docs, "search.html"), "utf8");
  assert.ok(html.includes('id="ls-counts"'), "counts line mount point");
  assert.ok(html.includes('id="ls-surprise-btn"'), "surprise button");
  assert.ok(html.includes("assets/js/living-search-page.js"), "page extras script");
});

test("the page extras stay local: no remote endpoints", () => {
  const script = fs.readFileSync(path.join(docs, "assets", "js", "living-search-page.js"), "utf8");
  assert.doesNotMatch(script, /https?:\/\//);
  assert.match(script, /assets\/search\/manifest\.json/);
});

test("the counts line is the manifest's own counts, word for word", () => {
  const line = Page.formatCounts(manifest.counts);
  const fmt = n => Number(n).toLocaleString("en-US");
  for (const key of ["total", "pages", "scrolls", "lexicon", "atlas", "claims"]) {
    assert.ok(line.includes(fmt(manifest.counts[key])), `${key} appears in the line`);
  }
  assert.match(line, /claims, each one graded/);
});

test("the surprise pick is weighted by area size and lands on real documents", () => {
  const areas = manifest.areas;
  /* Areas are weighed by the documents their shards hold: the
   * pages shard holds passages, so its weight is the passage
   * count, not the page count. */
  const weights = Page.docCounts(manifest);
  assert.equal(Page.pickArea(areas, weights, () => 0).id, areas[0].id);
  assert.equal(Page.pickArea(areas, weights, () => 0.999999).id, areas[areas.length - 1].id);
  for (const area of areas) {
    const shard = readJson(searchRoot, Page.shardFile(manifest, area));
    assert.equal(shard.docs.length, weights[area.id], `${area.id} shard matches its document count`);
    for (const roll of [0, 0.37, 0.999999]) {
      const doc = Page.pickDoc(shard.docs, () => roll);
      assert.equal(typeof doc.u, "string", `${area.id} pick has a url`);
      assert.ok(doc.u.length > 0);
    }
  }
});
