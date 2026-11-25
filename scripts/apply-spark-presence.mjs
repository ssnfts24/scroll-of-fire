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
 * It also stamps the Spark agent seat (spark-agent-seat.css +
 * spark-agent-seat.js, Nov 20, 2026): the same talking seat the
 * Sphere carries, for every page the Spark travels to — local
 * on-device answers everywhere, the talking door metered on its
 * own line, fail-closed. The Sphere's page is excluded (it has
 * its own seat); Companions is excluded (the Spark's home has
 * its own panel).
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
 *   - docs/scroll/ and docs/scripture/ — generator-owned pages. Their
 *     generators (scripts/build-scroll-library.mjs and
 *     scripts/r2_02_pages.py) emit the presence themselves, so this
 *     script stays out: one owner per page, and a rebuild keeps the
 *     Spark travelling with its keeper there too.
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
  "theory/ethics.html",
  "theory/glossary.html",
  "theory/witness.html",
  "theory/frequency-governance.html",
  "start.html",
  "witness-world.html",
  "companions.html",
  /* The Guide's own pages: they carry the Codex Guide's seat,
   * and the two seats stay separate — the Spark seat does not
   * stand in the Guide's house (the Guide-seat fence test in
   * tests/spark-agent.test.js guards the Guide's files). */
  "guide.html",
  "codex-guide.html"
]);
const EXCLUDED_DIRS = new Set(["scroll", "scripture"]);

const STAMP = "20261119-1";
const CSS_TAG =
  `<link rel="stylesheet" href="assets/css/spark-companion.css?v=${STAMP}">`;
/* The relations extract (Q-05) rides between the core and the
 * presence: data shipped in the bundle, loaded by tag, never
 * fetched. Its stamp is its own — the extract changes when the
 * record does, not when the Spark's code does. */
const RELATIONS_STAMP = "20261122-1";
const RELATIONS_TAG =
  `<script defer src="assets/js/spark-relations.js?v=${RELATIONS_STAMP}"></script>`;
const SCRIPT_TAGS =
  `<script defer src="assets/js/spark-companion.js?v=${STAMP}"></script>\n` +
  `  ${RELATIONS_TAG}\n` +
  `  <script defer src="assets/js/spark-presence.js?v=${STAMP}"></script>`;
const SEAT_STAMP = "20261120-2";
const SEAT_CSS_TAG =
  `<link rel="stylesheet" href="assets/css/spark-agent-seat.css?v=${SEAT_STAMP}">`;
const SEAT_SCRIPT_TAG =
  `<script defer src="assets/js/spark-agent-seat.js?v=${SEAT_STAMP}"></script>`;

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
  const relationsTag = RELATIONS_TAG.replace('src="assets/', `src="${prefix}assets/`);
  const seatCssTag = SEAT_CSS_TAG.replace('href="assets/', `href="${prefix}assets/`);
  const seatScriptTag = SEAT_SCRIPT_TAG.replace('src="assets/', `src="${prefix}assets/`);

  /* The cache stamp moves with the Spark's code: an older stamp
   * on an existing tag is brought up to the current one, so a
   * returning visitor's browser does not keep yesterday's Spark. */
  html = html
    .replace(/spark-companion\.css\?v=[0-9A-Za-z-]+/g, `spark-companion.css?v=${STAMP}`)
    .replace(/spark-companion\.js\?v=[0-9A-Za-z-]+/g, `spark-companion.js?v=${STAMP}`)
    .replace(/spark-presence\.js\?v=[0-9A-Za-z-]+/g, `spark-presence.js?v=${STAMP}`)
    .replace(/spark-relations\.js\?v=[0-9A-Za-z-]+/g, `spark-relations.js?v=${RELATIONS_STAMP}`)
    .replace(/spark-agent-seat\.css\?v=[0-9A-Za-z-]+/g, `spark-agent-seat.css?v=${SEAT_STAMP}`)
    .replace(/spark-agent-seat\.js\?v=[0-9A-Za-z-]+/g, `spark-agent-seat.js?v=${SEAT_STAMP}`);

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
  } else if (!html.includes("spark-relations.js")) {
    /* The presence already stands here: the extract takes its
     * place in the same line, immediately before it. */
    html = html.replace(
      /([ \t]*)<script defer src="[^"]*spark-presence\.js\?v=[0-9A-Za-z-]+"><\/script>/,
      (whole, indent) => `${indent}${relationsTag}\n${whole}`
    );
  }
  if (!html.includes("spark-agent-seat.css")) {
    html = html.replace("</head>", `  ${seatCssTag}\n</head>`);
  }
  if (!html.includes("spark-agent-seat.js")) {
    html = html.replace("</head>", `  ${seatScriptTag}\n</head>`);
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
