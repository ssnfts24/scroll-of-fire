#!/usr/bin/env node
/*
 * apply-living-nav.mjs — give every content page the unified living
 * navigation (part 2 of the living site update, stacked on PR #92).
 *
 * For each content page under docs/ (recursive), this script:
 *   1. ensures the shared living layer stylesheet (living-ui.css) is
 *      referenced exactly once — the nav's styles live there;
 *   2. inserts the unified nav bar (Home · Scroll · Atlas · Lexicon ·
 *      Scripture · Sphere · Shop, current area marked) immediately
 *      after the page's skip link, or right after <body> when the page
 *      has no skip link.
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
 * The script is idempotent: pages already carrying data-living-nav are
 * skipped, and the stylesheet link is only added when missing.
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
  "caravan.html"
]);

/* The seven areas, in nav order. Targets are docs-relative paths. */
const AREAS = [
  { id: "home", label: "Home", target: "index.html" },
  { id: "scroll", label: "Scroll", target: "scroll/index.html" },
  { id: "atlas", label: "Atlas", target: "codex-atlas.html" },
  { id: "lexicon", label: "Lexicon", target: "scroll/lexicon.html" },
  { id: "scripture", label: "Scripture", target: "scripture/index.html" },
  { id: "sphere", label: "Sphere", target: "living-time-sphere.html" },
  { id: "shop", label: "Shop", target: "shop.html" }
];

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
  if (rel === "scroll/lexicon.html") return "lexicon";
  if (rel.startsWith("scroll/")) return "scroll";
  if (rel === "codex-atlas.html") return "atlas";
  if (rel.startsWith("scripture/")) return "scripture";
  if (rel === "shop.html") return "shop";
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
  return [
    `  <div class="living-nav" data-living-nav>`,
    `    <nav class="living-nav-inner" aria-label="Site navigation">`,
    `      <a class="living-nav-brand" href="${home}"><span class="living-nav-mark" aria-hidden="true">☲</span> Codex of Reality</a>`,
    `      <ul class="living-nav-links">`,
    items,
    `      </ul>`,
    `    </nav>`,
    `  </div>`
  ].join("\n");
}

const report = [];

for (const full of [...walk(docsDir)].sort()) {
  const rel = path.relative(docsDir, full).split(path.sep).join("/");
  if (EXCLUDED.has(rel)) {
    report.push({ rel, action: "excluded" });
    continue;
  }
  let html = fs.readFileSync(full, "utf8");
  if (html.includes("data-living-nav")) {
    report.push({ rel, action: "already has nav" });
    continue;
  }

  const pageDir = posixDirname(rel);
  const baseMatch = html.match(/<base\b[^>]*\bhref="([^"]*)"/i);
  const baseDir = baseMatch ? resolveDir(pageDir, baseMatch[1]) : pageDir;

  const changes = [];

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
    base: baseMatch ? baseMatch[1] : "(none)",
    area: currentAreaFor(rel) || "—"
  });
}

for (const row of report) {
  console.log(
    `${row.rel.padEnd(58)} ${String(row.action).padEnd(16)} base=${row.base ?? ""} area=${row.area ?? ""}`
  );
}
const changed = report.filter((r) => r.action.includes("nav")).length;
console.log(`\n${dryRun ? "[dry-run] " : ""}${changed} pages ${dryRun ? "would gain" : "gained"} the unified nav; ${report.length} pages examined.`);
