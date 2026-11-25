#!/usr/bin/env node
/*
 * apply-site-mobile.mjs — the site's mobile floor, on every page.
 *
 * For each hand-maintained content page under docs/, this script
 * ensures two things are present exactly once, in the <head>:
 *   1. the site manifest link (rel="manifest" ->
 *      manifest-site.webmanifest) — only on pages that do not
 *      already link a manifest of their own;
 *   2. the site-wide mobile stylesheet (assets/css/site-mobile.css),
 *      stamped last in the head so its small-screen floor rules
 *      stand after the page's own sheets.
 *
 * The manifest is the Codex's own (Nov 24, 2026, mobile +
 * manifest workstream): name "Codex of Reality", short_name
 * "Codex", the front door as its start, standalone, the site
 * palette. Pages that already carry a manifest keep theirs —
 * moons keeps the 13 Moons card, the white papers keep the one
 * they carry, and the Sphere keeps its own.
 *
 * Exclusions, following the living-nav / spark-presence
 * discipline (one owner per page):
 *   - docs/living-time-sphere.html — R1.7-protected; never
 *     edited. The Sphere's small-screen framing rides in its
 *     own presentation layer (sphere-app-mode), not here.
 *   - docs/404.html, docs/offline.html — utility pages.
 *   - docs/caravan.html — meta-refresh redirect stub.
 *   - docs/scroll/ and docs/scripture/ — generator-owned pages.
 *     Their generators (scripts/build-scroll-library.mjs and
 *     scripts/r2_02_pages.py) own their heads; since the
 *     one-PR redesign (Nov 24, 2026) both generators emit the
 *     same two lines themselves, as they already emit the
 *     Spark presence.
 *
 * Idempotent: anything already present is left exactly as it is.
 *
 * Usage: node scripts/apply-site-mobile.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = path.join(root, "docs");
const dryRun = process.argv.includes("--dry-run");

const EXCLUDED_FILES = new Set([
  "living-time-sphere.html",
  "404.html",
  "offline.html",
  "caravan.html",
  "theory/ethics.html",
  "theory/glossary.html",
  "theory/witness.html",
  "theory/frequency-governance.html",
  "start.html",
  "witness-world.html",
  "scroll-of-fire-codex-of-reality-remnant-whitepaper.html",
  // Gate G (G2): account.html is a utility page, as
  // offline.html — tests/site-mobile.test.js has
  // always expected it excluded; the stamper now
  // agrees (one-PR redesign, Nov 24, 2026).
  "account.html"
]);
const EXCLUDED_DIRS = new Set(["scroll", "scripture"]);

const STAMP = "20261124-1";
const MANIFEST_TAG = `<link rel="manifest" href="manifest-site.webmanifest">`;
const CSS_TAG =
  `<link rel="stylesheet" href="assets/css/site-mobile.css?v=${STAMP}">`;

function walk(dir, prefix = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!prefix && EXCLUDED_DIRS.has(entry.name)) continue;
      out.push(...walk(path.join(dir, entry.name), rel));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      out.push(rel);
    }
  }
  return out;
}

let changed = 0;
let already = 0;
let skipped = 0;

for (const rel of walk(docsDir).sort()) {
  if (EXCLUDED_FILES.has(rel)) {
    skipped++;
    continue;
  }
  const file = path.join(docsDir, rel);
  let html = fs.readFileSync(file, "utf8");
  const before = html;

  /* Depths below docs/ need ../ prefixes, the way the nav does. */
  const depth = rel.split("/").length - 1;
  const prefix = depth > 0 ? "../".repeat(depth) : "";
  const manifestTag = MANIFEST_TAG.replace(
    'href="manifest-site', `href="${prefix}manifest-site`);
  const cssTag = CSS_TAG.replace('href="assets/', `href="${prefix}assets/`);

  /* The cache stamp moves with the sheet: an older stamp on an
   * existing tag is brought up to the current one. */
  html = html.replace(
    /site-mobile\.css\?v=[0-9A-Za-z-]+/g, `site-mobile.css?v=${STAMP}`);

  if (!html.includes("</head>")) {
    console.warn(`${rel}: no </head>, skipped`);
    skipped++;
    continue;
  }
  /* A page that already links any manifest keeps its own; the
   * site card is for the pages that had none. */
  if (!html.includes('rel="manifest"')) {
    html = html.replace("</head>", `  ${manifestTag}\n</head>`);
  }
  if (!html.includes("site-mobile.css")) {
    html = html.replace("</head>", `  ${cssTag}\n</head>`);
  }

  if (html !== before) {
    changed++;
    if (!dryRun) fs.writeFileSync(file, html);
    console.log(`${rel}: mobile floor added`);
  } else {
    already++;
  }
}

console.log(
  `site mobile: ${changed} changed, ${already} already present, ${skipped} skipped${dryRun ? " (dry run)" : ""}`
);
