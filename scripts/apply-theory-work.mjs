#!/usr/bin/env node
/**
 * apply-theory-work.mjs — emit the "Work This Page" hook into every
 * Theory library page (Interactivity Wave 2).
 *
 * The Theory family (docs/theory.html, docs/theory/*.html,
 * docs/theory/equations/*.html — 35 pages) shares one template but is
 * maintained as static HTML, so the shared module's hook is emitted
 * mechanically, the same way apply-living-nav.mjs emits the living
 * nav. Per page the change is exactly:
 *
 *   head:  one stylesheet link (assets/css/theory-work.css), placed
 *          after the theory.css link;
 *   tail:  the Life Atlas repository stack (schema, repository,
 *          indexeddb, runtime — the same tags and versions teach.html
 *          carries, so the witness note writes to the one canonical
 *          store) and the module itself (assets/js/theory-work.js),
 *          after the living-ui.js tag at the end of body.
 *
 * All paths are written relative to each page's <base href>, exactly
 * like the neighbouring tags, so they resolve from docs/theory/ and
 * docs/theory/equations/ alike.
 *
 * Idempotent: a page already carrying the hook is left untouched.
 * Run: node scripts/apply-theory-work.mjs [--check]
 *   --check exits 1 listing pages that still need the hook.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docs = join(root, "docs");

const CSS_TAG =
  '<link rel="stylesheet" href="assets/css/theory-work.css?v=20261119-tw1">';
const CSS_ANCHOR =
  '<link rel="stylesheet" href="assets/css/theory.css">';

const SCRIPT_TAGS = [
  '<script defer src="assets/js/life-atlas/life-atlas-schema.js?v=20260817-1"></script>',
  '<script defer src="assets/js/life-atlas/life-atlas-repository.js?v=20260819-b750"></script>',
  '<script defer src="assets/js/life-atlas/life-atlas-indexeddb.js?v=20260819-b750"></script>',
  '<script defer src="assets/js/life-atlas/life-atlas-runtime.js?v=20260819-b750"></script>',
  '<script defer src="assets/js/theory-work.js?v=20261119-tw1"></script>'
].join("\n  ");
const SCRIPT_ANCHOR =
  '<script defer src="assets/js/living-ui.js?v=20261117-1"></script>';

function theoryPages() {
  const pages = [join(docs, "theory.html")];
  const theoryDir = join(docs, "theory");

  for (const name of readdirSync(theoryDir)) {
    if (name.endsWith(".html")) pages.push(join(theoryDir, name));
  }

  const equationsDir = join(theoryDir, "equations");
  for (const name of readdirSync(equationsDir)) {
    if (name.endsWith(".html")) pages.push(join(equationsDir, name));
  }

  return pages.sort();
}

const checkOnly = process.argv.includes("--check");
const pending = [];
let changed = 0;

for (const page of theoryPages()) {
  const original = readFileSync(page, "utf8");

  if (original.includes("theory-work.css")) {
    continue;
  }

  if (!original.includes(CSS_ANCHOR) || !original.includes(SCRIPT_ANCHOR)) {
    pending.push(`${page} — anchor missing, hook NOT emitted`);
    continue;
  }

  if (checkOnly) {
    pending.push(page);
    continue;
  }

  const withCss = original.replace(
    CSS_ANCHOR,
    `${CSS_ANCHOR}\n${CSS_TAG}`
  );
  const withScripts = withCss.replace(
    SCRIPT_ANCHOR,
    `${SCRIPT_ANCHOR}\n  ${SCRIPT_TAGS}`
  );

  writeFileSync(page, withScripts);
  changed += 1;
}

if (checkOnly) {
  if (pending.length) {
    console.error(
      `theory-work hook missing on ${pending.length} page(s):`
    );
    for (const page of pending) console.error(`  ${page}`);
    process.exit(1);
  }
  console.log("theory-work hook present on every Theory page.");
} else {
  console.log(`theory-work hook emitted on ${changed} page(s).`);
  if (pending.length) {
    console.error("pages needing a hand look:");
    for (const page of pending) console.error(`  ${page}`);
    process.exit(1);
  }
}
