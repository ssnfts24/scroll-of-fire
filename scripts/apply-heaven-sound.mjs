#!/usr/bin/env node
/*
 * apply-heaven-sound.mjs — give the house its Sound of the Day.
 *
 * For each hand-maintained content page under docs/, this script
 * ensures the heaven-sound module (assets/js/heaven-sound.js) is
 * loaded exactly once, deferred, in the <head>. The module is the
 * place's generative soundscape: opt-in, gesture-armed, silent by
 * default, its chimes seeded by the canonical Pattern Day. It builds
 * its own quiet toggle where a page provides none.
 *
 * Exclusions, following the living-nav / spark-presence discipline:
 *   - docs/living-time-sphere.html — R1.7-protected; never edited.
 *   - docs/404.html, docs/offline.html — utility pages.
 *   - docs/caravan.html — meta-refresh redirect stub.
 *   - docs/scroll/ and docs/scripture/ — generator-owned pages. Their
 *     generators emit their own stacks, so this script stays out:
 *     one owner per page. The Sound reaches the reader pages in a
 *     later wave through those generators.
 *
 * Idempotent: anything already present is left exactly as it is.
 *
 * Usage: node scripts/apply-heaven-sound.mjs [--dry-run]
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
  "caravan.html"
]);
const EXCLUDED_DIRS = new Set(["scroll", "scripture"]);

const STAMP = "20261119-1";
const SCRIPT_TAG = `<script defer src="assets/js/heaven-sound.js?v=${STAMP}"></script>`;

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

  const depth = rel.split("/").length - 1;
  const prefix = depth > 0 ? "../".repeat(depth) : "";
  const scriptTag = SCRIPT_TAG.replace('src="assets/', `src="${prefix}assets/`);

  html = html.replace(
    /heaven-sound\.js\?v=[0-9A-Za-z-]+/g,
    `heaven-sound.js?v=${STAMP}`
  );

  if (!html.includes("heaven-sound.js")) {
    if (!html.includes("</head>")) {
      console.warn(`${rel}: no </head>, skipped`);
      skipped++;
      continue;
    }
    html = html.replace("</head>", `  ${scriptTag}\n</head>`);
  }

  if (html !== before) {
    changed++;
    if (!dryRun) fs.writeFileSync(file, html);
    console.log(`${rel}: sound added`);
  } else {
    already++;
  }
}

console.log(
  `heaven sound: ${changed} changed, ${already} already present, ${skipped} skipped${dryRun ? " (dry run)" : ""}`
);
