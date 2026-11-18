"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const docsDir = path.join(root, "docs");

/*
 * Unified living navigation: every content page on the site carries the
 * same slim lui-nav bar (Home + Atlas, Scroll Library, Lexicon, Sphere,
 * Scripture, Shop) and the living-ui layer. Exclusions are explicit and
 * identical to tests/living-ui.test.js:
 * - living-time-sphere.html: R1.7-protected, never edited here.
 * - 404.html / offline.html / caravan.html: error, offline-fallback and
 *   redirect-stub utility pages.
 */
const EXCLUDED = new Set([
  "living-time-sphere.html",
  "404.html",
  "offline.html",
  "caravan.html"
]);

function walk(dir, base) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? base + "/" + entry.name : entry.name;
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
    else if (entry.name.endsWith(".html")) out.push(rel);
  }
  return out;
}

const allPages = walk(docsDir, "").sort();
const wiredPages = allPages.filter((rel) => !EXCLUDED.has(rel));

function read(rel) {
  return fs.readFileSync(path.join(docsDir, rel), "utf8");
}

/* Resolve an href the way a browser does: against the page's <base>
 * when one is declared, otherwise against the page's own directory. */
function resolveHref(rel, html, href) {
  const dir = path.posix.dirname(rel) === "." ? "" : path.posix.dirname(rel);
  const baseMatch = html.match(/<base href="([^"]*)">/);
  const effectiveDir = baseMatch
    ? path.posix.normalize(path.posix.join(dir, baseMatch[1]))
    : dir;
  const clean = effectiveDir === "." ? "" : effectiveDir;
  return path.posix.normalize(path.posix.join(clean, href));
}

test("every content page family is covered", () => {
  const families = {};
  for (const rel of wiredPages) {
    const fam = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "(top-level)";
    families[fam] = (families[fam] || 0) + 1;
  }
  assert.equal(families["(top-level)"], 27);
  assert.equal(families["scroll"], 6);
  assert.equal(families["scripture"], 3);
  assert.equal(families["scripture/genesis"], 50);
  assert.equal(families["scripture/exodus"], 40);
  assert.equal(families["theory"], 15);
  assert.equal(families["theory/equations"], 19);
  assert.equal(families["systems"], 6);
  assert.equal(wiredPages.length, 166);
});

test("every wired page carries the living layer and the unified nav", () => {
  for (const rel of wiredPages) {
    const html = read(rel);
    assert.equal((html.match(/assets\/css\/living-ui\.css/g) || []).length, 1,
      `${rel}: living-ui.css exactly once`);
    assert.equal((html.match(/assets\/js\/living-ui\.js/g) || []).length, 1,
      `${rel}: living-ui.js exactly once`);
    const body = html.match(/<body\b[^>]*>/);
    assert.ok(body && /class="[^"]*\bliving-ui\b/.test(body[0]),
      `${rel}: body carries living-ui`);
    assert.equal((html.match(/<nav class="lui-nav"/g) || []).length, 1,
      `${rel}: exactly one lui-nav`);
    assert.ok(!html.includes("lui-reveal-pending"),
      `${rel}: hidden reveal state never in markup`);
  }
});

test("every nav link resolves to a real page, Home first", () => {
  for (const rel of wiredPages) {
    const html = read(rel);
    const nav = html.match(/<nav class="lui-nav"[\s\S]*?<\/nav>/);
    assert.ok(nav, `${rel}: nav block present`);
    const hrefs = [...nav[0].matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(hrefs.length, 7, `${rel}: nav has seven links`);
    assert.equal(resolveHref(rel, html, hrefs[0]), "index.html",
      `${rel}: Home link must resolve to the homepage`);
    for (const href of hrefs) {
      const target = resolveHref(rel, html, href);
      assert.ok(fs.existsSync(path.join(docsDir, target)),
        `${rel}: nav link ${href} -> ${target} must exist`);
    }
  }
});

test("excluded pages carry neither the layer nor the nav", () => {
  for (const rel of EXCLUDED) {
    const html = read(rel);
    assert.ok(!html.includes("living-ui"), `${rel}: no living layer`);
    assert.ok(!html.includes("lui-nav"), `${rel}: no unified nav`);
  }
});
