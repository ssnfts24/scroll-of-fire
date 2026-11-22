#!/usr/bin/env node
/*
 * Build the Spark's relations extract (recommendation Q-05,
 * option (a) approved by Aaron Nov 22, 2026; program §C1).
 *
 * The Spark's "Look next" knew a page's own doors (tier 1) and the
 * keeper's left-off thread (tier 3), but tier 2 — the library's
 * relations — was skipped in v8 because reading them at runtime
 * would need a fetch, and the Spark's layer carries a no-network
 * fence. Aaron's ruling: ship the relations as a small extract
 * built ahead of time, inside the Spark's bundle. This generator
 * is that build. The extract is a data file loaded by script tag
 * alongside the Spark's own files; the Spark fetches nothing, and
 * the fence stands exactly as the tests assert it.
 *
 * The relations come from the record, in its own order of trust:
 *   1. the site catalog's stated relations (the same record the
 *      Atlas and the Hub strip are generated from) — a page's own
 *      `related` entries first, then the pages that name it back;
 *   2. the page's own content trails — the links inside its <main>,
 *      the same trail rule the Garden of Paths graph counts.
 * A relation exists in the extract only because the record states
 * it or a page's own words walk it. Nothing is inferred, nothing
 * is ranked by anything but that order, and every suggestion the
 * Spark makes from this file is labeled "from the record".
 *
 * Output: docs/assets/js/spark-relations.js. Regenerate after the
 * catalog:  npm run site:catalog && npm run spark:relations
 * `--check` compares the committed file against a fresh build.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docs = path.join(root, "docs");
const CATALOG = path.join(docs, "data", "site-catalog.json");
const INVENTORY = path.join(root, "site-audit", "site-master-inventory.json");
const OUTPUT = path.join(docs, "assets", "js", "spark-relations.js");

export const RELATIONS_CAP = 4;
/* The Guide's own page carries no Spark seat, so no relations are
 * keyed by it (its place-name still names doors for other pages). */
const NO_SEAT = new Set(["guide.html"]);

const require = createRequire(import.meta.url);

function shortTitle(title) {
  return String(title || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+[—|·]\s+Scroll of Fire.*$/, "")
    .replace(/\s*\|\s*Codex of Reality.*$/, "")
    .replace(/\s+—\s+Codex of Reality.*$/, "")
    .trim();
}

function resolveHref(pagePath, href) {
  if (!href || /^(?:#|mailto:|tel:|javascript:|data:|https?:|\/\/)/i.test(href)) return null;
  const clean = href.split("#")[0].split("?")[0];
  if (!clean) return null;
  try {
    const url = new URL(clean, `https://codexofreality.org/${pagePath}`);
    return decodeURIComponent(url.pathname).replace(/^\//, "") || null;
  } catch {
    return null;
  }
}

function contentLinks(html, pagePath, pageSet) {
  let region = html;
  const main = html.match(/<main\b[\s\S]*?<\/main>/i);
  if (main) {
    region = main[0];
  } else {
    region = html
      .replace(/<nav\b[\s\S]*?<\/nav>/gi, "")
      .replace(/<header\b[\s\S]*?<\/header>/gi, "")
      .replace(/<footer\b[\s\S]*?<\/footer>/gi, "");
  }
  const out = [];
  const seen = new Set();
  for (const match of region.matchAll(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const target = resolveHref(pagePath, match[1]);
    if (!target || target === pagePath || !pageSet.has(target) || seen.has(target)) continue;
    seen.add(target);
    out.push(target);
  }
  return out;
}

export function buildRelations({ catalog, inventory, readPage, pageGuide }) {
  const entries = catalog.entries || [];
  const byId = new Map(entries.map((e) => [e.id, e]));
  const byPath = new Map(entries.map((e) => [e.path, e]));

  const resources = (inventory.resources || []).filter(
    (r) =>
      typeof r.sourcePath === "string" &&
      r.sourcePath.startsWith("docs/") &&
      r.sourcePath.endsWith(".html") &&
      r.publicationStatus === "live"
  );
  const pageSet = new Set(resources.map((r) => r.sourcePath.replace(/^docs\//, "")));
  const inventoryTitle = new Map(
    resources.map((r) => [r.sourcePath.replace(/^docs\//, ""), shortTitle(r.title)])
  );

  const labelFor = (target) => {
    if (pageGuide[target]?.place) return pageGuide[target].place;
    if (byPath.get(target)?.title) return shortTitle(byPath.get(target).title);
    return inventoryTitle.get(target) || target;
  };

  const relations = {};
  for (const page of Object.keys(pageGuide).sort()) {
    if (NO_SEAT.has(page)) continue;
    const picked = [];
    const seen = new Set([page]);
    const offer = (target) => {
      if (picked.length >= RELATIONS_CAP) return;
      if (!target || seen.has(target) || !pageSet.has(target)) return;
      seen.add(target);
      picked.push({ href: target, label: labelFor(target) });
    };

    /* 1. the catalog's stated relations, out and back */
    const entry = byPath.get(page);
    if (entry) {
      for (const id of entry.related || []) {
        const target = byId.get(id);
        if (target) offer(target.path);
      }
    }
    for (const other of entries) {
      if (picked.length >= RELATIONS_CAP) break;
      if ((other.related || []).some((id) => byId.get(id)?.path === page)) offer(other.path);
    }

    /* 2. the page's own content trails */
    const html = readPage(page);
    if (html) {
      for (const target of contentLinks(html, page, pageSet)) offer(target);
    }

    if (picked.length) relations[page] = picked;
  }

  return {
    version: 1,
    generatedFrom:
      "docs/data/site-catalog.json (the record the Atlas and Hub are generated from) + the pages' own content links",
    relations
  };
}

export function renderRelations(data) {
  return `"use strict";

/*
 * The Spark's relations extract — data, built ahead of time
 * (recommendation Q-05, option (a); program §C1).
 *
 * "Look next" tier 2: the library's relations, shipped inside the
 * Spark's bundle so the Spark can point at a related page without
 * reaching for the network. The no-network fence stands — this
 * file is loaded by script tag with the Spark's own files, and
 * nothing here (or in the Spark) fetches anything.
 *
 * Every relation below comes from the record: the site catalog's
 * stated relations first, then the page's own content links.
 * The Spark labels each suggestion drawn from this file
 * "from the record". Generated by scripts/build-spark-relations.mjs
 * — do not edit by hand; regenerate with: npm run spark:relations
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.CodexSparkRelations = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  return ${JSON.stringify(data, null, 2).replace(/\n/g, "\n  ")};
});
`;
}

function main() {
  const check = process.argv.includes("--check");
  const catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
  const inventory = JSON.parse(fs.readFileSync(INVENTORY, "utf8"));
  const { PAGE_GUIDE } = require(path.join(docs, "assets", "js", "spark-companion.js"));
  const data = buildRelations({
    catalog,
    inventory,
    pageGuide: PAGE_GUIDE,
    readPage: (p) => {
      const file = path.join(docs, p);
      return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    }
  });
  const rendered = renderRelations(data);
  if (check) {
    const current = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, "utf8") : "";
    if (current !== rendered) {
      console.error("spark-relations.js is stale — run: npm run spark:relations");
      process.exit(1);
    }
    console.log(`spark relations check OK (${Object.keys(data.relations).length} pages)`);
    return;
  }
  fs.writeFileSync(OUTPUT, rendered);
  console.log(`spark relations written (${Object.keys(data.relations).length} pages)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
