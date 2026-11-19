#!/usr/bin/env node
/*
 * apply-spark-presence.mjs — let an adopted Spark follow its person.
 *
 * For each hand-maintained content page under docs/, this script
 * ensures two things are present exactly once, in the <head>:
 *   1. the Spark stylesheet (assets/css/spark-companion.css);
 *   2. the Spark core + presence scripts (spark-companion.js, then
 *      spark-presence.js), deferred.
 *
 * For a visitor who has adopted a Spark on that device, the
 * presence draws it in the corner and walks it with them. For a
 * visitor who has not, the presence carries the meeting to them:
 * the Spark pops up once, introduces itself, and — if they say
 * "Not now" — waits as a small ember at the page's edge.
 *
 * Exclusions, following the living-nav discipline:
 *   - docs/living-time-sphere.html — R1.7-protected; never edited.
 *   - docs/404.html, docs/offline.html — utility pages.
 *   - docs/caravan.html — meta-refresh redirect stub.
 *   - docs/companions.html — the Spark's home; it loads the core and
 *     its own page glue instead of the corner presence.
 *   - docs/scroll/ and docs/scripture/ — generator-owned pages; their
 *     generators do not emit the presence in v1, so a rebuild cannot
 *     wipe a hand edit that was never made. A later wave can teach
 *     the generators.
 *
 * Idempotent: anything already present is left exactly as it is.
 *
 * Usage: node scripts/apply-spark-presence.mjs [--dry-run]
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
  "companions.html"
]);
const EXCLUDED_DIRS = new Set(["scroll", "scripture"]);

const STAMP = "20261118-3";
const CSS_TAG =
  `<link rel="stylesheet" href="assets/css/spark-companion.css?v=${STAMP}">`;
const SCRIPT_TAGS =
  `<script defer src="assets/js/spark-companion.js?v=${STAMP}"></script>\n` +
  `  <script defer src="assets/js/spark-presence.js?v=${STAMP}"></script>`;

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
  const cssTag = CSS_TAG.replace('href="assets/', `href="${prefix}assets/`);
  const scriptTags = SCRIPT_TAGS.replaceAll('src="assets/', `src="${prefix}assets/`);

  /* The cache stamp moves with the Spark's code: an older stamp
   * on an existing tag is brought up to the current one, so a
   * returning visitor's browser does not keep yesterday's Spark. */
  html = html
    .replace(/spark-companion\.css\?v=[0-9A-Za-z-]+/g, `spark-companion.css?v=${STAMP}`)
    .replace(/spark-companion\.js\?v=[0-9A-Za-z-]+/g, `spark-companion.js?v=${STAMP}`)
    .replace(/spark-presence\.js\?v=[0-9A-Za-z-]+/g, `spark-presence.js?v=${STAMP}`);

  if (!html.includes("spark-companion.css")) {
    if (!html.includes("</head>")) {
      console.warn(`${rel}: no </head>, skipped`);
      skipped++;
      continue;
    }
    html = html.replace("</head>", `  ${cssTag}\n</head>`);
  }
  if (!html.includes("spark-presence.js")) {
    html = html.replace("</head>", `  ${scriptTags}\n</head>`);
  }

  if (html !== before) {
    changed++;
    if (!dryRun) fs.writeFileSync(file, html);
    console.log(`${rel}: presence added`);
  } else {
    already++;
  }
}

console.log(
  `spark presence: ${changed} changed, ${already} already present, ${skipped} skipped${dryRun ? " (dry run)" : ""}`
);
