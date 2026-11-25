#!/usr/bin/env node
/*
 * apply-living-nav.mjs — give every content page the unified living
 * navigation (part 2 of the living site update, stacked on PR #92).
 *
 * For each content page under docs/ (recursive), this script:
 *   1. ensures the shared living layer stylesheet (living-ui.css) is
 *      referenced exactly once — the nav's styles live there;
 *   2. inserts the one travel bar (Home · Sphere · Companions ·
 *      13 Moons · Library · Witness World · Shop · Witness,
 *      current room marked, plus the external Support door last) immediately after the page's skip
 *      link, or right after <body> when the page has no skip link.
 *      Pages that already carry the nav get their emitted block
 *      refreshed in place, so emission changes reach them too;
 *   3. removes the legacy site-header brand anchor (the "Scroll of
 *      Fire / Codex of Reality" home button inside <header
 *      class="site-header" data-sof-header>) from every page it
 *      processes. Once the unified nav is present, its brand is the
 *      one brand/home element on the page; the legacy header keeps
 *      its menu toggle and its deep navigation, but no second brand.
 *      Pages this script never touches (the exclusions below, and
 *      the R1.7 sphere page above all) keep their header as-is.
 *
 * Link hrefs are computed the way a browser resolves them: against the
 * page's <base href> when one is present, otherwise against the page's
 * own directory. <base> tags are never modified.
 *
 * Exclusions (the same set PR #92 named, plus the R1.7 discipline):
 *   - docs/living-time-sphere.html — R1.7-protected; never edited here.
 *   - docs/404.html, docs/offline.html — utility pages.
 *   - docs/caravan.html — meta-refresh redirect stub.
 *
 * Generator-owned pages are never hand-edited here either: the Scroll
 * library pages (docs/scroll/) are emitted by build-scroll-library.mjs
 * and the Scripture reader (docs/scripture/) by r2_02_pages.py — both
 * generators emit this same nav themselves, and a rebuild (the reader
 * test suite rebuilds the library pages) would wipe a hand edit. This
 * script only verifies those pages carry the nav and reports them.
 *
 * The script is idempotent: the stylesheet link is only added when
 * missing, the nav only when absent, and the legacy brand strip is a
 * no-op once the brand is gone.
 *
 * Usage: node scripts/apply-living-nav.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = path.join(root, "docs");
const dryRun = process.argv.includes("--dry-run");

const EXCLUDED = new Set([
  "living-time-sphere.html",
  "404.html",
  "offline.html",
  "caravan.html",
  "theory/ethics.html",
  "theory/glossary.html",
  "theory/witness.html",
  "theory/frequency-governance.html",
  // Gate G (G2): account.html is a self-contained utility
  // page — tests/living-nav.test.js has always expected it
  // excluded; the stamper now agrees (one-PR redesign,
  // Nov 24, 2026; apply-site-mobile.mjs carries the twin fix).
  "account.html"
]);

/* The main rooms, in travel order (Aaron's one-travel-bar direction,
 * Nov 19, 2026): the bar carries a visitor between the rooms they
 * live in, and only those. The deeper shelves (Scroll, Atlas,
 * Lexicon, Scripture, Living Search) stay one tap deeper — through
 * the site header's deep menu where a page carries one, and through
 * the rooms themselves. Targets are docs-relative paths. */
const AREAS = [
  { id: "home", label: "Home", target: "index.html" },
  { id: "sphere", label: "Sphere", target: "living-time-sphere.html" },
  /* The Spark's home (Aaron's companions direction, Nov 18, 2026). */
  { id: "companions", label: "Companions", target: "companions.html" },
  { id: "moons", label: "13 Moons", target: "moons.html" },
  /* The Library room is Downloads: the shelf of files a visitor can
   * take with them. */
  { id: "library", label: "Library", target: "downloads.html" },
  { id: "witness-world", label: "Witness World", target: "witness-world.html" },
  { id: "shop", label: "Shop", target: "shop.html" },
  /* Witness's own page (Aaron's grant, Nov 18, 2026): the last room,
   * standing just before the Support door. */
  { id: "witness", label: "Witness", target: "witness.html" }
];

/* One external door, always last in the bar: support for the work.
 * Not an area — it is never the current page and never resolves to a
 * local file. Aaron's Cash App, decided Nov 17, 2026. */
const SUPPORT = { label: "Support", href: "https://cash.app/$AaronLaird7" };

const LAYER_CSS_TARGET = "assets/css/living-ui.css";

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && entry.name.endsWith(".html")) yield full;
  }
}

function posixDirname(rel) {
  const idx = rel.lastIndexOf("/");
  return idx === -1 ? "" : rel.slice(0, idx);
}

/* Resolve a directory + a relative reference into a normalized
 * docs-relative directory ("" = docs root), POSIX-style. */
function resolveDir(fromDir, ref) {
  const parts = (fromDir ? fromDir.split("/") : []).concat(ref.split("/"));
  const out = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

/* Relative path from one docs-relative directory to a docs-relative
 * file target, as a browser would resolve it against that directory. */
function relativeHref(fromDir, target) {
  const fromParts = fromDir ? fromDir.split("/") : [];
  const targetParts = target.split("/");
  let common = 0;
  while (
    common < fromParts.length &&
    common < targetParts.length - 1 &&
    fromParts[common] === targetParts[common]
  ) {
    common += 1;
  }
  const ups = fromParts.length - common;
  const rest = targetParts.slice(common).join("/");
  return "../".repeat(ups) + rest;
}

function currentAreaFor(rel) {
  if (rel === "index.html") return "home";
  if (rel === "companions.html") return "companions";
  if (rel === "moons.html") return "moons";
  if (rel === "downloads.html") return "library";
  if (rel === "witness-world.html") return "witness-world";
  if (rel === "shop.html") return "shop";
  if (rel === "witness.html") return "witness";
  return null;
}

function buildNav(baseDir, currentArea) {
  const home = relativeHref(baseDir, "index.html");
  const items = AREAS.map((area) => {
    const href = relativeHref(baseDir, area.target);
    const current =
      area.id === currentArea
        ? ' class="is-current" aria-current="page"'
        : "";
    return `        <li><a href="${href}"${current}>${area.label}</a></li>`;
  }).join("\n");
  const support = `        <li><a class="living-nav-support" href="${SUPPORT.href}" target="_blank" rel="noopener">${SUPPORT.label}</a></li>`;
  return [
    `  <div class="living-nav travel-bar" data-living-nav data-travel-bar>`,
    `    <nav class="living-nav-inner" aria-label="Travel bar — main rooms">`,
    `      <a class="living-nav-brand" href="${home}"><span class="living-nav-mark" aria-hidden="true">☲</span> Codex of Reality</a>`,
    `      <ul class="living-nav-links">`,
    items,
    support,
    `      </ul>`,
    `    </nav>`,
    `  </div>`
  ].join("\n");
}

/* Pages whose nav is emitted by their own generator (see header). */
function generatorFor(rel) {
  if (rel.startsWith("scripture/")) return "r2_02_pages.py";
  if (rel.startsWith("scroll/")) return "build-scroll-library.mjs";
  return null;
}

/* The legacy brand anchor inside the shared site header: one anchor
 * with class "brand" (its tag may span lines, and its markup may be
 * one line or several). It never nests another anchor, so a lazy
 * match to its own </a> is exact. */
const LEGACY_BRAND_RE = /[ \t]*<a\b[^>]*\bclass="brand"[^>]*>[\s\S]*?<\/a>[ \t]*\r?\n?/;

/* Remove the legacy brand from the page's site header, if present.
 * Scoped to the <header class="site-header" data-sof-header> block
 * so a "brand" class anywhere else on the page is never touched.
 * Returns { html, stripped }. */
function stripLegacyBrand(html) {
  const header = html.match(/<header\b[^>]*\bdata-sof-header[^>]*>[\s\S]*?<\/header>/);
  if (!header || !LEGACY_BRAND_RE.test(header[0])) return { html, stripped: false };
  const cleaned = header[0].replace(LEGACY_BRAND_RE, "");
  /* Splice by index: String.replace would read $ sequences in the
   * header markup as replacement patterns. */
  return {
    html: html.slice(0, header.index) + cleaned + html.slice(header.index + header[0].length),
    stripped: true
  };
}

function hasLegacyBrand(html) {
  const header = html.match(/<header\b[^>]*\bdata-sof-header[^>]*>[\s\S]*?<\/header>/);
  return Boolean(header && LEGACY_BRAND_RE.test(header[0]));
}

const report = [];

for (const full of [...walk(docsDir)].sort()) {
  const rel = path.relative(docsDir, full).split(path.sep).join("/");
  if (EXCLUDED.has(rel)) {
    report.push({ rel, action: "excluded" });
    continue;
  }
  let html = fs.readFileSync(full, "utf8");
  const gen = generatorFor(rel);
  if (gen) {
    report.push({
      rel,
      action: html.includes("data-living-nav")
        ? "generator-owned"
        : `MISSING NAV (regenerate: ${gen})`,
      warn: hasLegacyBrand(html)
        ? "LEGACY BRAND PRESENT (generator-owned: strip in the generator)"
        : ""
    });
    continue;
  }
  const changes = [];

  /* 3. One brand per page: with the unified nav in place (or about
   * to be inserted below), the legacy site-header brand is a second
   * home button — strip it. The header's menu and deep navigation
   * are untouched. */
  const strip = stripLegacyBrand(html);
  if (strip.stripped) {
    html = strip.html;
    changes.push("brand-stripped");
  }

  const pageDir = posixDirname(rel);
  const baseMatch = html.match(/<base\b[^>]*\bhref="([^"]*)"/i);
  const baseDir = baseMatch ? resolveDir(pageDir, baseMatch[1]) : pageDir;

  if (html.includes("data-living-nav")) {
    /* Refresh the emitted block in place so emission changes (the
     * Support door) reach pages that already carry the nav. The block
     * holds no nested <div>, so its first </div> is its own close.
     * A brand strip above lands in the same single write. */
    const fresh = buildNav(baseDir, currentAreaFor(rel));
    const navRe = /^[ \t]*<div class="living-nav[^"]*" data-living-nav[^>]*>[\s\S]*?<\/div>/m;
    const next = html.replace(navRe, () => fresh);
    if (next !== html) {
      html = next;
      changes.push("nav refreshed");
    }
    if (changes.length && !dryRun) fs.writeFileSync(full, html);
    report.push({
      rel,
      action: changes.length ? changes.join("+") : "already has nav",
      changed: changes.length > 0,
      base: baseMatch ? baseMatch[1] : "(none)",
      area: currentAreaFor(rel) || "—"
    });
    continue;
  }

  /* 1. Stylesheet wiring for the shared living layer. */
  if (!/assets\/css\/living-ui\.css/.test(html)) {
    const href = relativeHref(baseDir, LAYER_CSS_TARGET);
    const linkTag = `<link rel="stylesheet" href="${href}">`;
    const linkRe = /<link\b[^>]*\brel="stylesheet"[^>]*>/gi;
    let last = null;
    let m;
    while ((m = linkRe.exec(html)) !== null) last = m;
    if (last) {
      const at = last.index + last[0].length;
      html = html.slice(0, at) + "\n  " + linkTag + html.slice(at);
    } else {
      html = html.replace(/<\/head>/i, "  " + linkTag + "\n</head>");
    }
    changes.push("css");
  }

  /* 2. The nav itself: after the skip link when one exists. */
  const nav = buildNav(baseDir, currentAreaFor(rel));
  const skip = html.match(/<a\b[^>]*\bclass="[^"]*skip-link[^"]*"[^>]*>[\s\S]*?<\/a>/i);
  if (skip) {
    const at = skip.index + skip[0].length;
    html = html.slice(0, at) + "\n" + nav + html.slice(at);
  } else {
    html = html.replace(/<body\b[^>]*>/i, (bodyTag) => bodyTag + "\n" + nav);
  }
  changes.push("nav");

  if (!dryRun) fs.writeFileSync(full, html);
  report.push({
    rel,
    action: changes.join("+"),
    changed: changes.length > 0,
    base: baseMatch ? baseMatch[1] : "(none)",
    area: currentAreaFor(rel) || "—"
  });
}

for (const row of report) {
  console.log(
    `${row.rel.padEnd(58)} ${String(row.action).padEnd(16)} base=${row.base ?? ""} area=${row.area ?? ""}${row.warn ? "  " + row.warn : ""}`
  );
}
const changed = report.filter((r) => r.changed).length;
const gained = report.filter((r) => r.changed && String(r.action).split("+").includes("nav")).length;
console.log(`\n${dryRun ? "[dry-run] " : ""}${changed} pages changed (${gained} gained the unified nav); ${report.length} pages examined.`);
