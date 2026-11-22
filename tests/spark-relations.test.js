"use strict";

/**
 * Q-05 — the Spark may see the library's relations, as a bundled
 * extract (Aaron's decision, option (a), Nov 22, 2026; program §C1).
 *
 * The fence is the point of the design: the Spark's layer reaches
 * for no network, ever. The relations therefore ship as data inside
 * the Spark's bundle (spark-relations.js, built ahead of time from
 * the record) and "Look next" reads them in tier 2 — after this
 * page's own doors, before the keeper's own left-off thread — with
 * every such suggestion labeled "from the record". These tests
 * hold that shape:
 *
 *   - the committed extract is exactly what the generator builds
 *     from the catalog record and the pages as they stand;
 *   - every relation points at a real page and carries a name;
 *   - relationsFor chooses honestly (record order, no self, no
 *     repeats, capped);
 *   - the presence wires tier 2 in and labels it, and neither the
 *     extract nor the Spark's files reach for a network.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");
const JS = path.join(DOCS, "assets/js");

const Core = require(path.join(JS, "spark-companion.js"));
const Extract = require(path.join(JS, "spark-relations.js"));

test("the committed extract is the generator's own build, fresh", async () => {
  const { buildRelations, renderRelations } = await import(
    path.join(ROOT, "scripts/build-spark-relations.mjs")
  );
  const catalog = JSON.parse(fs.readFileSync(path.join(DOCS, "data/site-catalog.json"), "utf8"));
  const inventory = JSON.parse(
    fs.readFileSync(path.join(ROOT, "site-audit/site-master-inventory.json"), "utf8")
  );
  const data = buildRelations({
    catalog,
    inventory,
    pageGuide: Core.PAGE_GUIDE,
    readPage: (p) => {
      const file = path.join(DOCS, p);
      return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    }
  });
  const committed = fs.readFileSync(path.join(JS, "spark-relations.js"), "utf8");
  assert.equal(committed, renderRelations(data), "run: npm run spark:relations");
});

test("every relation in the extract points at a real page and carries its name", () => {
  const pages = Object.keys(Extract.relations);
  assert.ok(pages.length >= 10, "the extract covers the Spark's named places");
  for (const page of pages) {
    assert.ok(Core.PAGE_GUIDE[page], `${page} is a place the Spark can name`);
    assert.notEqual(page, "guide.html", "the Guide's own page carries no Spark seat");
    const rels = Extract.relations[page];
    assert.ok(rels.length >= 1 && rels.length <= 4, `${page} keeps at most four relations`);
    for (const rel of rels) {
      assert.notEqual(rel.href, page, `${page} must not relate to itself`);
      assert.ok(fs.existsSync(path.join(DOCS, rel.href)), `${page} -> ${rel.href} exists`);
      assert.ok(rel.label && rel.label.trim().length > 0, `${page} -> ${rel.href} is named`);
    }
  }
  /* The library's own relations, the ones this card exists for. */
  const hub = Extract.relations["hub.html"].map((r) => r.href);
  assert.ok(hub.includes("codex-atlas.html"), "the Hub's relations reach the Atlas");
  const atlas = Extract.relations["codex-atlas.html"].map((r) => r.href);
  assert.ok(atlas.includes("scroll/index.html"), "the Atlas's relations reach the Scroll Library");
});

test("relationsFor chooses in the record's order, honestly", () => {
  const relations = {
    "hub.html": [
      { href: "systems/t-7.html", label: "T-7" },
      { href: "codex-atlas.html", label: "the Codex Atlas" },
      { href: "hub.html", label: "itself" },
      { href: "teach.html", label: "the practice page" }
    ]
  };
  assert.deepEqual(
    Core.relationsFor({ page: "hub.html", relations }).map((r) => r.href),
    ["systems/t-7.html", "codex-atlas.html"],
    "capped at two by default, self skipped"
  );
  assert.deepEqual(
    Core.relationsFor({ page: "hub.html", relations, exclude: ["t-7.html"], limit: 3 }).map(
      (r) => r.href
    ),
    ["codex-atlas.html", "teach.html"],
    "what tier 1 already offered is not offered again"
  );
  assert.deepEqual(Core.relationsFor({ page: "missing.html", relations }), []);
  assert.deepEqual(Core.relationsFor({ page: "hub.html", relations: null }), []);
  assert.deepEqual(Core.relationsFor({}), []);
});

test("the presence wires tier 2 between the doors and the keeper's thread, labeled", () => {
  const presence = fs.readFileSync(path.join(JS, "spark-presence.js"), "utf8");
  const lookNext = presence.slice(presence.indexOf("function doLookNext"));
  const doorsAt = lookNext.indexOf("Core.doorsFor");
  const relationsAt = lookNext.indexOf("Core.relationsFor");
  const resumeAt = lookNext.indexOf("Core.resumeFor");
  assert.ok(doorsAt !== -1 && relationsAt > doorsAt, "relations are read after the page's doors");
  assert.ok(resumeAt > relationsAt, "relations are read before the keeper's left-off thread");
  const doorsLoop = lookNext.slice(doorsAt, relationsAt);
  assert.match(
    doorsLoop,
    /picks\.length >= 2/,
    "the page's doors leave a place at the table for the record's relations"
  );
  assert.match(lookNext, /CodexSparkRelations/, "the extract is read from the bundle global");
  assert.match(lookNext, /"from the record"/, "tier-2 suggestions are labeled as the record's");
});

test("the fence stands: neither the extract nor the Spark reaches for a network", () => {
  for (const file of ["spark-relations.js", "spark-presence.js", "spark-companion.js"]) {
    const source = fs.readFileSync(path.join(JS, file), "utf8");
    assert.ok(
      !/fetch\(|XMLHttpRequest|sendBeacon/.test(source),
      `${file} sends nothing anywhere`
    );
  }
});

test("the seat's stamp carries the extract with the Spark", () => {
  const apply = fs.readFileSync(path.join(ROOT, "scripts/apply-spark-presence.mjs"), "utf8");
  assert.match(apply, /spark-relations\.js/, "the apply script stamps the extract");
  const hub = fs.readFileSync(path.join(DOCS, "hub.html"), "utf8");
  assert.ok(
    hub.indexOf("spark-companion.js") < hub.indexOf("spark-relations.js") &&
      hub.indexOf("spark-relations.js") < hub.indexOf("spark-presence.js"),
    "on the page, the extract loads between the core and the presence"
  );
  const guide = fs.readFileSync(path.join(DOCS, "guide.html"), "utf8");
  assert.ok(!guide.includes("spark-relations.js"), "the Guide's house keeps its own seat only");
});
