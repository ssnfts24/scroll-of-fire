"use strict";

/**
 * ULS-002 slice 1 — the authoritative page registry, and the first
 * tooth of section 14's automated architectural enforcement.
 *
 * ULS-002 was adopted by Aaron on Nov 25, 2026. Its section 7 requires
 * one registered definition per page; this test is what keeps that
 * true as pages are added:
 *
 *   - every page under docs/ has exactly one registry entry, and the
 *     registry names no page that does not exist;
 *   - every entry carries exactly one primary domain, from the
 *     standard's ten;
 *   - every entry's canonical URL resolves in the paths graph
 *     (docs/assets/data/link-graph.json);
 *   - fields the registry marks unsourced carry the marker in every
 *     entry — an unsourced fact is never dressed as a measured one.
 *
 * The registry itself is generated (scripts/build-page-registry.mjs);
 * its freshness is held by `npm run pages:registry:check` in the
 * validate pipeline. These tests hold its coverage and honesty.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");

const registry = JSON.parse(fs.readFileSync(path.join(DOCS, "assets/data/page-registry.json"), "utf8"));
const graph = JSON.parse(fs.readFileSync(path.join(DOCS, "assets/data/link-graph.json"), "utf8"));

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out.sort();
}

const pagePaths = walk(DOCS)
  .filter(f => f.endsWith(".html"))
  .map(f => path.relative(DOCS, f).split(path.sep).join("/"));

test("every page under docs/ has exactly one registry entry, and no entry names a missing page", () => {
  const registered = registry.pages.map(e => e.path);
  assert.equal(new Set(registered).size, registered.length, "registry paths are unique");
  assert.deepEqual([...registered].sort(), [...pagePaths].sort(),
    "the registry covers exactly the pages on disk — an unregistered page fails here (ULS-002 sections 7 and 14)");
});

test("every entry carries one primary domain from the standard's ten", () => {
  assert.deepEqual(registry.domains, [
    "Observatory", "Knowledge", "Research", "Living", "Spark",
    "Play", "Stories", "Community", "Tools", "Products",
  ]);
  for (const entry of registry.pages) {
    assert.ok(registry.domains.includes(entry.primary_domain),
      `${entry.path}: primary_domain ${JSON.stringify(entry.primary_domain)} is not one of the ten domains`);
  }
});

test("every entry's canonical URL resolves in the paths graph", () => {
  for (const entry of registry.pages) {
    assert.ok(entry.canonical_url.startsWith(registry.baseUrl),
      `${entry.path}: canonical_url ${entry.canonical_url} is outside the site's base URL`);
    let p = entry.canonical_url.slice(registry.baseUrl.length);
    if (p === "" || p.endsWith("/")) p += "index.html";
    assert.ok(Object.prototype.hasOwnProperty.call(graph.pages, p),
      `${entry.path}: canonical URL resolves to ${p}, which the paths graph does not know`);
  }
});

test("unsourced fields carry the marker in every entry — never invented values", () => {
  assert.ok(Array.isArray(registry.unsourcedFields) && registry.unsourcedFields.length > 0,
    "the registry names its unsourced fields in the open");
  for (const entry of registry.pages) {
    for (const field of registry.unsourcedFields) {
      assert.equal(entry[field], "unsourced",
        `${entry.path}: ${field} must carry the "unsourced" marker until a truthful source exists (ULS-002 slice 2)`);
    }
  }
});
