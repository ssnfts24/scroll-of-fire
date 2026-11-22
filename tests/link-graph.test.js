"use strict";

/**
 * Q-04 — Garden of Paths, first slice (recommendation approved by
 * Aaron, Nov 22, 2026; program §D1).
 *
 * The link graph is counted at build time from the pages as they
 * stand: a page's trails are the links inside its own <main>, and
 * "Who points here" is the same trails read backwards. These tests
 * hold that shape:
 *
 *   - the committed graph is exactly what the generator builds
 *     from the catalog's inventory and the pages on disk;
 *   - no trail is a page's standing door (nav/header/footer links
 *     never enter the graph), and no page points at itself;
 *   - the panel's first two rooms — the Scroll Library's opening
 *     and the Documentation Hub — carry the slot, and the library's
 *     stands in its generator, where the page is made.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");

const Paths = require(path.join(DOCS, "assets/js/paths-from-here.js"));

test("the committed link graph is the generator's own build, fresh", async () => {
  const { buildGraph, renderGraph } = await import(
    path.join(ROOT, "scripts/build-link-graph.mjs")
  );
  const inventory = JSON.parse(
    fs.readFileSync(path.join(ROOT, "site-audit/site-master-inventory.json"), "utf8")
  );
  const graph = buildGraph(inventory, (p) => {
    const file = path.join(DOCS, p);
    return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  });
  const committed = fs.readFileSync(path.join(DOCS, "assets/data/link-graph.json"), "utf8");
  assert.equal(committed, renderGraph(graph), "run: npm run paths:graph");
});

test("the graph holds only content trails: no self-links, no invented paths", async () => {
  const graph = JSON.parse(
    fs.readFileSync(path.join(DOCS, "assets/data/link-graph.json"), "utf8")
  );
  const keys = new Set(Object.keys(graph.pages));
  assert.ok(keys.size > 150, "the graph covers the site's live pages");
  for (const [page, entry] of Object.entries(graph.pages)) {
    for (const link of entry.out) {
      assert.notEqual(link.path, page, `${page} must not point at itself`);
      assert.ok(keys.has(link.path), `${page} points at unknown page ${link.path}`);
    }
    for (const link of entry.in) {
      const source = graph.pages[link.path];
      /* A capped list cannot prove a negative; where the source's
       * trails stand in full, the backlink must be among them. */
      if (source.out.length === source.outTotal) {
        assert.ok(
          source.out.some((o) => o.path === page),
          `${link.path} is listed as pointing at ${page} but does not`
        );
      }
    }
  }
  /* The library and the hub — the first slice's two rooms — have
   * real trails in both directions. */
  assert.ok(graph.pages["scroll/index.html"].out.length > 0);
  assert.ok(graph.pages["scroll/index.html"].in.length > 0);
  assert.ok(graph.pages["hub.html"].out.length > 0);
  assert.ok(graph.pages["hub.html"].in.length > 0);
});

test("contentLinks reads a page's own words, not its standing doors", async () => {
  const { contentLinks } = await import(path.join(ROOT, "scripts/build-link-graph.mjs"));
  const html = `<html><body>
    <nav><a href="moons.html">13 Moons</a></nav>
    <main><p>Begin with <a href="teach.html">the practice</a> and
    <a href="teach.html">again</a>, or <a href="hub.html">the hub</a>.</p></main>
    <footer><a href="shop.html">Shop</a></footer></body></html>`;
  const pageSet = new Set(["index.html", "moons.html", "teach.html", "hub.html", "shop.html"]);
  assert.deepEqual(contentLinks(html, "index.html", pageSet), ["teach.html", "hub.html"]);
});

test("pageKeyFromPath and relHref speak the site's own addresses", () => {
  assert.equal(Paths.pageKeyFromPath("/"), "index.html");
  assert.equal(Paths.pageKeyFromPath("/scroll/"), "scroll/index.html");
  assert.equal(Paths.pageKeyFromPath("/hub.html"), "hub.html");
  assert.equal(Paths.relHref("hub.html", "systems/t-7.html"), "systems/t-7.html");
  assert.equal(Paths.relHref("scroll/index.html", "scroll/reader.html"), "reader.html");
  assert.equal(Paths.relHref("scroll/index.html", "hub.html"), "../hub.html");
  assert.equal(Paths.relHref("scroll/reader.html", "index.html"), "../index.html");
});

test("groupByArea keeps the page's own order and names the countries", () => {
  const groups = Paths.groupByArea([
    { path: "a.html", area: "systems" },
    { path: "b.html", area: "evidence" },
    { path: "c.html", area: "systems" }
  ]);
  assert.deepEqual(groups.map((g) => g.name), ["Systems", "Evidence"]);
  assert.deepEqual(groups[0].links.map((l) => l.path), ["a.html", "c.html"]);
});

test("the first two rooms carry the panel", () => {
  const hub = fs.readFileSync(path.join(DOCS, "hub.html"), "utf8");
  assert.match(hub, /data-paths-from-here/);
  assert.match(hub, /data-paths-page="hub\.html"/);
  assert.match(hub, /paths-from-here\.js/);
  assert.match(hub, /assets\/css\/paths\.css/);
  assert.ok(
    hub.indexOf("site-catalog:hub-strip:end") < hub.indexOf("data-paths-from-here"),
    "the hub's panel stands outside the catalog-regenerated strip"
  );

  const library = fs.readFileSync(path.join(DOCS, "scroll/index.html"), "utf8");
  assert.match(library, /data-paths-from-here/);
  assert.match(library, /data-paths-page="scroll\/index\.html"/);

  const generator = fs.readFileSync(path.join(ROOT, "scripts/build-scroll-library.mjs"), "utf8");
  assert.match(generator, /data-paths-from-here/, "the library's panel lives in its generator");
  assert.match(generator, /paths-from-here\.js/);
});
