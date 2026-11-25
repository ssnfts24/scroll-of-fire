/*
 * Living nav + homepage activity (part 2 of the living site update).
 *
 * The one travel bar: every content page carries one slim travel bar
 * (Home · Sphere · Companions · 13 Moons · Library · Witness World · Shop · Witness) with
 * the current room marked, plus one external Support door last
 * (Aaron's Cash App, decided Nov 17, 2026 — never a local target,
 * never the current area), and Home resolves to the site homepage
 * from every page — the Scroll section used to trap the reader with
 * no persistent route home. The nav is inserted into hand-maintained pages
 * by scripts/apply-living-nav.mjs and emitted by the generators for the
 * pages they own (build-scroll-library.mjs for docs/scroll/,
 * r2_02_pages.py for docs/scripture/); these tests verify the result
 * uniformly, however each page got it.
 *
 * Excluded by design: docs/living-time-sphere.html (R1.7-protected —
 * the known exception), 404.html, offline.html, and the caravan.html
 * meta-refresh stub.
 *
 * The homepage witness line: teachings harvested verbatim from the
 * site's own pages (each line names its source), rotating calmly with
 * reduced-motion and no-JS visitors keeping the first line, statically.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const docsDir = path.join(root, "docs");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const EXCLUDED = new Set([
  "living-time-sphere.html",
  "404.html",
  "offline.html",
  "caravan.html",
  // Gate G (G2): the account page is a utility page (noindex,
  // catalog-classified Utility), excluded as offline.html is.
  "account.html",
  // Page programme (Nov 24, 2026): the theory doorway merges folded
  // these four pages into their practical homes; they are now
  // meta-refresh redirect stubs, as caravan.html is.
  "theory/ethics.html",
  "theory/glossary.html",
  "theory/witness.html",
  "theory/frequency-governance.html"
]);

const AREAS = [
  { id: "home", label: "Home", target: "index.html" },
  { id: "sphere", label: "Sphere", target: "living-time-sphere.html" },
  { id: "companions", label: "Companions", target: "companions.html" },
  { id: "moons", label: "13 Moons", target: "moons.html" },
  { id: "library", label: "Library", target: "downloads.html" },
  { id: "witness-world", label: "Witness World", target: "witness-world.html" },
  { id: "shop", label: "Shop", target: "shop.html" },
  { id: "witness", label: "Witness", target: "witness.html" }
];

/* The one external door, always last in the bar. */
const SUPPORT = { label: "Support", href: "https://cash.app/$AaronLaird7" };

function walk(dir, prefix = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name), rel));
    else if (entry.isFile() && entry.name.endsWith(".html")) out.push(rel);
  }
  return out;
}

const allPages = walk(docsDir).sort();
const contentPages = allPages.filter((rel) => !EXCLUDED.has(rel));

function normalizeJoin(dir, ref) {
  const parts = (dir ? dir.split("/") : []).concat(ref.split("/"));
  const out = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

/* Resolve an href the way a browser on this page would: against the
 * page's <base href> when present, else the page's own directory. */
function resolveHref(pageRel, html, href) {
  const pageDir = pageRel.includes("/") ? pageRel.slice(0, pageRel.lastIndexOf("/")) : "";
  const baseMatch = html.match(/<base\b[^>]*\bhref="([^"]*)"/i);
  const baseDir = baseMatch ? normalizeJoin(pageDir, baseMatch[1].replace(/\/$/, "")) : pageDir;
  const clean = href.split("#")[0].split("?")[0];
  if (!clean) return pageRel;
  if (clean.startsWith("/")) return clean.slice(1);
  return normalizeJoin(baseDir, clean);
}

function navBlock(html) {
  const match = html.match(/<div class="living-nav travel-bar" data-living-nav data-travel-bar>([\s\S]*?)<\/div>/);
  return match ? match[1] : null;
}

function navAnchors(block) {
  const anchors = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    const attrs = m[1];
    const href = (attrs.match(/\bhref="([^"]*)"/) || [])[1];
    anchors.push({
      href,
      text: m[2]
        .replace(/<span[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/span>/g, "")
        .replace(/<[^>]+>/g, "")
        .trim(),
      current: /\baria-current="page"/.test(attrs),
      isCurrentClass: /\bclass="[^"]*\bis-current\b/.test(attrs),
      target: (attrs.match(/\btarget="([^"]*)"/) || [])[1] || null,
      rel: (attrs.match(/\brel="([^"]*)"/) || [])[1] || "",
      supportClass: /\bclass="[^"]*\bliving-nav-support\b/.test(attrs)
    });
  }
  return anchors;
}

function areaOf(rel) {
  if (rel === "index.html") return "home";
  if (rel === "companions.html") return "companions";
  if (rel === "moons.html") return "moons";
  if (rel === "downloads.html") return "library";
  if (rel === "witness-world.html") return "witness-world";
  if (rel === "shop.html") return "shop";
  if (rel === "witness.html") return "witness";
  return null;
}

test("the census is the whole site, not a sample", () => {
  assert.ok(contentPages.length >= 160, `expected >=160 content pages, got ${contentPages.length}`);
  for (const rel of EXCLUDED) assert.ok(allPages.includes(rel), `${rel} should exist and be excluded`);
});

test("every content page carries exactly one unified living nav", () => {
  for (const rel of contentPages) {
    const html = read(`docs/${rel}`);
    assert.equal((html.match(/data-living-nav/g) || []).length, 1, `${rel}: nav count`);
    assert.equal((html.match(/data-travel-bar/g) || []).length, 1, `${rel}: travel bar count`);
    const block = navBlock(html);
    assert.ok(block, `${rel}: nav block present`);
    const anchors = navAnchors(block);
    assert.equal(anchors.length, AREAS.length + 2, `${rel}: brand + ${AREAS.length} area links + Support`);
    assert.equal(anchors[0].text, "Codex of Reality", `${rel}: brand label`);
    assert.equal(resolveHref(rel, html, anchors[0].href), "index.html", `${rel}: brand goes home`);
    AREAS.forEach((area, i) => {
      const anchor = anchors[i + 1];
      assert.equal(anchor.text, area.label, `${rel}: link ${i + 1} label`);
      assert.equal(
        resolveHref(rel, html, anchor.href),
        area.target,
        `${rel}: ${area.label} link target`
      );
    });
    const support = anchors[AREAS.length + 1];
    assert.equal(support.text, SUPPORT.label, `${rel}: Support door is last`);
    assert.equal(support.href, SUPPORT.href, `${rel}: Support door target`);
    assert.equal(support.target, "_blank", `${rel}: Support door opens externally`);
    assert.match(support.rel, /\bnoopener\b/, `${rel}: Support door rel`);
    assert.ok(support.supportClass, `${rel}: Support door carries its gold-tint class`);
    assert.equal(support.current, false, `${rel}: Support door is never the current area`);
    assert.equal(
      anchors.filter((a) => a.text === SUPPORT.label).length,
      1,
      `${rel}: exactly one Support door`
    );
  }
});

test("the Support door and the travel rooms are emitted by all three nav emission paths", () => {
  /* The census above proves the pages; this proves a regeneration
   * cannot wipe the bar: every source that emits the nav carries it. */
  for (const source of [
    "scripts/apply-living-nav.mjs",
    "scripts/build-scroll-library.mjs",
    "scripts/r2_02_pages.py"
  ]) {
    assert.ok(read(source).includes(SUPPORT.href), `${source} emits the Support door`);
    assert.ok(read(source).includes("data-travel-bar"), `${source} emits the travel bar`);
    assert.ok(read(source).includes("Witness World"), `${source} emits the Witness World room`);
    assert.ok(read(source).includes("witness-world.html"), `${source} links the Witness World room`);
    assert.ok(read(source).includes("13 Moons"), `${source} emits the 13 Moons room`);
    assert.ok(read(source).includes("moons.html"), `${source} links the 13 Moons room`);
  }
  const css = read("docs/assets/css/living-ui.css");
  assert.match(css, /\.living-nav-links a\.living-nav-support\s*\{[^}]*color:\s*var\(--lnav-gold\)/,
    "Support door carries the gold tint at the same tap target");
});

test("Home is one tap away from every content page (the Scroll trap is closed)", () => {
  for (const rel of contentPages) {
    const html = read(`docs/${rel}`);
    const anchors = navAnchors(navBlock(html));
    const home = anchors.find((a) => a.text === "Home");
    assert.ok(home, `${rel}: Home link present`);
    assert.equal(resolveHref(rel, html, home.href), "index.html", `${rel}: Home resolves to the homepage`);
  }
});

test("every nav target exists on disk", () => {
  for (const area of AREAS) {
    assert.ok(fs.existsSync(path.join(docsDir, area.target)), `missing nav target ${area.target}`);
  }
});

test("the current area is marked exactly where the page belongs", () => {
  for (const rel of contentPages) {
    const html = read(`docs/${rel}`);
    const anchors = navAnchors(navBlock(html));
    const marked = anchors.filter((a) => a.current);
    const support = anchors.find((a) => a.text === SUPPORT.label);
    assert.ok(support && !support.current && !support.isCurrentClass,
      `${rel}: the Support door is never marked current`);
    const expected = areaOf(rel);
    if (!expected) {
      assert.equal(marked.length, 0, `${rel}: no area should be marked`);
    } else {
      assert.equal(marked.length, 1, `${rel}: exactly one current link`);
      const area = AREAS.find((a) => a.id === expected);
      assert.equal(marked[0].text, area.label, `${rel}: current link is ${area.label}`);
      assert.ok(marked[0].isCurrentClass, `${rel}: current link carries .is-current`);
    }
  }
});

test("every content page loads the living layer stylesheet exactly once", () => {
  for (const rel of contentPages) {
    const html = read(`docs/${rel}`);
    assert.equal((html.match(/living-ui\.css/g) || []).length, 1, `${rel}: living-ui.css count`);
  }
});

test("excluded pages stay untouched by the nav", () => {
  for (const rel of EXCLUDED) {
    const html = read(`docs/${rel}`);
    assert.ok(!html.includes("data-living-nav"), `${rel} must not carry the nav`);
  }
  const sphere = read("docs/living-time-sphere.html");
  assert.ok(!sphere.includes("living-nav"), "the R1.7 sphere page carries no nav markup at all");
});

test("nav styles are standalone (subdirectory pages load the sheet for the nav alone)", () => {
  const css = read("docs/assets/css/living-ui.css");
  assert.match(css, /\.living-nav\s*\{[^}]*position:\s*sticky/, "nav bar is persistent (sticky)");
  assert.ok(!/body\.living-ui\s+\.living-nav/.test(css), "nav rules must not be gated on body.living-ui");
  assert.match(css, /\.living-nav-links a\.is-current/, "current-area styling present");
});

test("the lui-nav from PR #92 is extinct: exactly one nav system survives", () => {
  for (const rel of allPages) {
    const html = read(`docs/${rel}`);
    assert.ok(!html.includes("lui-nav"), `${rel}: lui-nav must not appear anywhere`);
  }
  const css = read("docs/assets/css/living-ui.css");
  assert.ok(!css.includes("lui-nav"), "living-ui.css carries no lui-nav rules");
  const js = read("docs/assets/js/living-ui.js");
  assert.ok(!js.includes("lui-nav"), "living-ui.js carries no lui-nav references");
});

test("the living layer PR #92 landed stays wired on every content page", () => {
  for (const rel of contentPages) {
    const html = read(`docs/${rel}`);
    assert.equal((html.match(/assets\/js\/living-ui\.js/g) || []).length, 1,
      `${rel}: living-ui.js exactly once`);
    const body = html.match(/<body\b[^>]*>/);
    assert.ok(body && /class="[^"]*\bliving-ui\b/.test(body[0]),
      `${rel}: body carries living-ui`);
    assert.ok(!html.includes("lui-reveal-pending"),
      `${rel}: hidden reveal state never in markup`);
  }
});

/* ------------------------- the witness line ------------------------- */

function renderedText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function witnessLines() {
  const html = read("docs/index.html");
  const block = html.match(/<div class="living-witness" data-living-witness>([\s\S]*?)<\/div>\s*<\/div>/);
  assert.ok(block, "homepage carries the witness block");
  const lines = [];
  const re = /<p class="living-witness-line([^"]*)" data-source="([^"]+)">([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(block[1])) !== null) {
    lines.push({ classes: m[1], source: m[2], text: m[3].replace(/<[^>]+>/g, "").trim() });
  }
  return lines;
}

test("the homepage witness block stands statically: first line active, nothing hidden", () => {
  const lines = witnessLines();
  assert.ok(lines.length >= 5, `expected at least 5 witness lines, got ${lines.length}`);
  assert.match(lines[0].classes, /\bis-active\b/, "the first line is active in the static markup");
  assert.equal(lines.filter((l) => /\bis-active\b/.test(l.classes)).length, 1, "exactly one active line");
  const html = read("docs/index.html");
  const lineTags = html.match(/<p class="living-witness-line[^>]*>/g) || [];
  assert.equal(lineTags.length, lines.length, "line tags found");
  for (const tag of lineTags) {
    assert.ok(!/\bhidden\b/.test(tag), "no line is hidden in the markup (no-JS visitors lose nothing)");
    assert.ok(!/style=/.test(tag), "no inline hiding styles in the markup");
  }
});

test("every witness line is verbatim from the site page it names", () => {
  for (const line of witnessLines()) {
    assert.ok(fs.existsSync(path.join(root, line.source)), `${line.source} exists`);
    const sourceText = renderedText(read(line.source));
    assert.ok(
      sourceText.includes(line.text),
      `line not found verbatim in ${line.source}: "${line.text}"`
    );
  }
});

test("the rotation script is calm, pausable, and reduced-motion safe", () => {
  const html = read("docs/index.html");
  assert.equal((html.match(/living-witness\.js/g) || []).length, 1, "witness script wired once, homepage only");
  for (const rel of contentPages) {
    if (rel === "index.html") continue;
    assert.ok(!read(`docs/${rel}`).includes("living-witness.js"), `${rel} must not load the witness script`);
  }
  const js = read("docs/assets/js/living-witness.js");
  const interval = js.match(/ROTATE_MS\s*=\s*(\d+)/);
  assert.ok(interval, "rotation interval is a named constant");
  assert.ok(Number(interval[1]) >= 8000, `rotation is calm (>= 8000 ms), got ${interval[1]}`);
  assert.match(js, /prefers-reduced-motion/, "reduced-motion visitors keep the static first line");
  assert.match(js, /mouseenter/, "rotation pauses on hover");
  assert.match(js, /focusin/, "rotation pauses on focus");
  assert.match(js, /visibilitychange/, "rotation pauses in a hidden tab");
  assert.ok(!/le-reveal|lui-reveal/.test(js), "rotation never touches the guided-path reveals");
});

test("the witness stage cannot shift layout (all lines share one grid cell)", () => {
  const css = read("docs/assets/css/living-entry.css");
  assert.match(css, /\.living-witness-stage\s*\{[^}]*display:\s*grid/, "stage is a grid");
  assert.match(css, /\.living-witness-line\s*\{[^}]*grid-area:\s*1\s*\/\s*1/, "lines stack in one cell — height is fixed by the longest line");
  const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduced, /\.living-witness-line\s*\{\s*transition:\s*none/, "crossfade is off under reduced motion");
});
