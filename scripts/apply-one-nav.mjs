#!/usr/bin/env node
/*
 * apply-one-nav.mjs — Page Evolution Batch E3: one navigation.
 *
 * The site carried two navigation systems on 76 pages: the
 * unified living travel bar and the legacy site header
 * (<header class="site-header" data-sof-header>) with its deep
 * menu. The fold the Nov 24 release note mapped and the Nov 25
 * page-by-page evolution plan ordered (Batch E3):
 *
 *   1. The legacy header's 31 deep links are homed first — and
 *      were verified homed before this script ran: the Scroll
 *      doors on the Library shelf (scroll/index.html), Theory
 *      and Canon on the Theory hub, the Systems doors on the
 *      Systems Archive, and the rest on the Codex Atlas Start
 *      Here path (tests/one-navigation.test.js pins the census).
 *   2. The legacy header block is removed from every page that
 *      carries BOTH systems.
 *   3. Theory-wing pages also lose their secondary nav panel
 *      (div.theory-subnav), so the wing's stack — header, theory
 *      nav, travel bar, breadcrumb — comes down to the travel
 *      bar and the breadcrumb, with the pages' own prev/next
 *      chains (the wing's one good next step) untouched.
 *   4. account.html, which carried neither system, gains the
 *      travel bar and joins the one-nav system (the plan's
 *      named step; its door itself stays honestly closed until
 *      the owner configures the account backend).
 *
 * Never touched, by law:
 *   - docs/living-time-sphere.html — R1.7-protected.
 *   - docs/404.html — a utility page; its legacy header is its
 *     only brand and stays.
 *   - docs/aiyanas-world.html — Aiyana's design authority; the
 *     menu over her world is hers and Aaron's to rule.
 *
 * The script is idempotent: a folded page has no legacy header
 * left to remove, and account.html gains its bar only when it
 * has none.
 *
 * Usage: node scripts/apply-one-nav.mjs [--dry-run]
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
  "aiyanas-world.html"
]);

function walk(dir, prefix = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
    else if (entry.isFile() && entry.name.endsWith(".html")) out.push(rel);
  }
  return out.sort();
}

const HEADER_RE = /<header\b[^>]*\bdata-sof-header[^>]*>[\s\S]*?<\/header>\s*/;

/* Remove the balanced <div class="theory-subnav" ...> block. */
function removeTheorySubnav(html) {
  const start = html.search(/<div\b[^>]*\bdata-theory-nav[\s>]/);
  if (start < 0) return html;
  let depth = 0;
  let i = start;
  const tagRe = /<div\b[^>]*>|<\/div>/g;
  tagRe.lastIndex = start;
  let m;
  while ((m = tagRe.exec(html))) {
    if (m[0].startsWith("</")) {
      depth -= 1;
      if (depth === 0) {
        const end = tagRe.lastIndex;
        const tail = html[end] === "\n" ? end + 1 : end;
        return html.slice(0, start) + html.slice(tail);
      }
    } else {
      depth += 1;
    }
    i = tagRe.lastIndex;
  }
  return html; // unbalanced — leave the page exactly as it stands
}

/* The travel bar block, in the emission format apply-living-nav
 * writes, for a root-level page with no current room. */
function travelBarBlock() {
  const areas = [
    ["index.html", "Home"],
    ["living-time-sphere.html", "Sphere"],
    ["companions.html", "Companions"],
    ["moons.html", "13 Moons"],
    ["downloads.html", "Library"],
    ["witness-world.html", "Witness World"],
    ["shop.html", "Shop"],
    ["witness.html", "Witness"]
  ];
  const items = areas
    .map(([href, label]) => `        <li><a href="${href}">${label}</a></li>`)
    .join("\n");
  return `<div class="living-nav travel-bar" data-living-nav data-travel-bar>\n    <nav class="living-nav-inner" aria-label="Travel bar — main rooms">\n      <a class="living-nav-brand" href="index.html"><span class="living-nav-mark" aria-hidden="true">☲</span> Codex of Reality</a>\n      <ul class="living-nav-links">\n${items}\n        <li><a class="living-nav-support" href="https://cash.app/$AaronLaird7" target="_blank" rel="noopener">Support</a></li>\n      </ul>\n    </nav>\n  </div>`;
}

const changed = [];
for (const rel of walk(docsDir)) {
  if (EXCLUDED.has(rel)) continue;
  const file = path.join(docsDir, rel);
  let html = fs.readFileSync(file, "utf8");
  const before = html;

  if (html.includes("data-sof-header") && html.includes("data-living-nav")) {
    html = html.replace(HEADER_RE, "");
    if (rel.startsWith("theory/")) html = removeTheorySubnav(html);
  }

  /* Two pages (13-moon-whitepaper, codex-white-paper) carry an
   * older emission of the same legacy header — the block without
   * the data-sof-header attribute, brand intact. It is the same
   * second system and folds the same way. The excluded pages
   * above are never reached by this rule. */
  if (html.includes("data-living-nav")) {
    html = html.replace(/<header\b[^>]*\bclass="site-header"[^>]*>[\s\S]*?<\/header>\s*/, "");
  }

  if (rel === "account.html" && !html.includes("data-living-nav")) {
    const block = travelBarBlock();
    /* The account page carried its own small rooms nav — the
     * one system replaces it, it does not stack on it. */
    const rooms = html.match(/<nav\b[^>]*\bclass="rooms"[^>]*>[\s\S]*?<\/nav>\s*/);
    if (rooms) {
      html = html.replace(rooms[0], block + "\n");
    } else {
      const skip = html.match(/<a\b[^>]*class="skip-link"[^>]*>[^<]*<\/a>\s*/);
      if (skip) {
        html = html.replace(skip[0], skip[0] + block + "\n");
      } else {
        html = html.replace(/(<body[^>]*>\s*)/, `$1${block}\n`);
      }
    }
    /* The bar's styles live in living-ui.css; ensure the sheet
     * is referenced exactly once, as apply-living-nav does. */
    if (!html.includes("living-ui.css")) {
      html = html.replace(
        /(<link rel="stylesheet" href="assets\/css\/site-mobile\.css[^"]*">)/,
        `<link rel="stylesheet" href="assets/css/living-ui.css">\n  $1`
      );
    }
  }

  /* Joining the one-nav system means carrying the living layer
   * the way every content page does: living-ui.js exactly once
   * and the living-ui body class (tests/living-nav.test.js). */
  if (rel === "account.html") {
    if (!html.includes('<base href="./">')) {
      html = html.replace(/(<head>\s*)/, `$1\n  <base href="./">`);
    }
    if (!html.includes("assets/js/living-ui.js")) {
      html = html.replace(
        /(<script defer src="assets\/js\/site\.js"><\/script>)/,
        `$1\n  <script defer src="assets/js/living-ui.js?v=20261117-1"></script>`
      );
    }
    html = html.replace(/<body>/, '<body class="living-ui">');
    /* A main-house page carrying the living opening must carry
     * the PatternCalendar, so the day line it speaks is always
     * the computed coordinate, never an invention
     * (tests/living-page-openings.test.js). */
    if (!html.includes("pattern-calendar")) {
      html = html.replace(
        /(<script defer src="assets\/js\/living-ui\.js\?v=20261117-1"><\/script>)/,
        [
          `<script defer src="assets/js/calendar/pattern-calendar-version.js?v=20260722-4"></script>`,
          `  <script defer src="assets/js/calendar/pattern-calendar-data.js?v=20260722-4"></script>`,
          `  <script defer src="assets/js/calendar/pattern-calendar-format.js?v=20260722-4"></script>`,
          `  <script defer src="assets/js/calendar/pattern-calendar-boundary.js?v=20260722-4"></script>`,
          `  <script defer src="assets/js/calendar/pattern-calendar.js?v=20260722-4"></script>`,
          `  $1`
        ].join("\n")
      );
    }
  }

  if (html !== before) {
    changed.push(rel);
    if (!dryRun) fs.writeFileSync(file, html);
  }
}

console.log(`${dryRun ? "would fold" : "folded"} ${changed.length} pages:`);
for (const rel of changed) console.log(`  ${rel}`);
