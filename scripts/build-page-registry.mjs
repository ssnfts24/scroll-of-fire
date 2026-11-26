#!/usr/bin/env node
// ULS-002 slice 1 — builds the authoritative page registry.
//
// Adopted by Aaron, Nov 25, 2026: ULS-002 (Universal Page Integration
// Standard) is the integration standard. Its section 7 requires one
// centrally registered definition per page; its section 14 requires
// automated enforcement so future pages cannot bypass the standard.
// This generator is the registry's single source: the registry file is
// GENERATED from the pages as they stand, the site catalog's master
// inventory, and the link graph — never hand-maintained. The domain
// rules below are generation logic: a page the rules cannot place
// fails the build loudly, so a new page forces a named domain decision
// instead of drifting in unregistered.
//
// Fields that cannot be sourced truthfully yet are present in every
// entry with the explicit marker "unsourced" — never invented values.
// Filling them is slice-2 work (see UNSOURCED_FIELDS).
//
// Usage: node scripts/build-page-registry.mjs [--check]
// Output: docs/assets/data/page-registry.json
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const docs = path.join(root, "docs");
const OUTPUT = path.join(docs, "assets", "data", "page-registry.json");
const INVENTORY = path.join(root, "site-audit", "site-master-inventory.json");
const GRAPH = path.join(docs, "assets", "data", "link-graph.json");
const BASE_URL = "https://codexofreality.org/";
const check = process.argv.slice(2).includes("--check");

const DOMAINS = [
  "Observatory", "Knowledge", "Research", "Living", "Spark",
  "Play", "Stories", "Community", "Tools", "Products",
];

// ULS-002 section 7 fields with no truthful source on the site today.
// They ship in the schema marked "unsourced" so no consumer can
// mistake an absent fact for a measured one.
const UNSOURCED_FIELDS = [
  "search_keywords",
  "available_actions",
  "spark_capabilities",
  "permissions",
  "offline_capabilities",
  "mobile_behavior",
];
const UNSOURCED = "unsourced";

const read = file => fs.readFileSync(file, "utf8");
const sha256 = text => crypto.createHash("sha256").update(text).digest("hex");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out.sort();
}
const rel = file => path.relative(docs, file).split(path.sep).join("/");

// ------------------------------------------------------------- domains
// One primary home per page (ULS-002 section 3), assigned from the
// page's actual purpose. Ordered: first match wins. A page no rule
// claims is a build error, named in the failure — never a silent
// default.
const DOMAIN_RULES = [
  [p => p.startsWith("scripture/"), "Knowledge"],
  [p => p.startsWith("scroll/"), "Knowledge"],
  [p => p === "glossary.html" || p === "glyphs.html" || p === "genesis-5-timeline.html", "Knowledge"],
  [p => p === "theory.html" || p.startsWith("theory/"), "Research"],
  [p => [
    "13-moon-whitepaper.html", "codex-white-paper.html",
    "scroll-of-fire-codex-of-reality-remnant-whitepaper.html",
    "claims-atlas.html", "hub.html", "ethics.html", "methods.html", "witness-method.html",
    "provenance.html", "lab.html",
    "systems/archive.html", "systems/frequencies.html",
    "systems/t-7.html", "systems/witness.html",
  ].includes(p), "Research"],
  [p => [
    "living-time-sphere.html", "moons.html", "equinox-passage.html",
    "alignment-ledger.html", "timeline.html", "index.html", "start.html",
  ].includes(p), "Observatory"],
  [p => p === "companions.html" || p === "codex-guide.html" || p === "card-album.html", "Spark"],
  [p => p === "witness-world.html" || p === "spark-echo.html", "Play"],
  [p => [
    "about-aaron.html", "aiyanas-world.html", "caravan.html",
    "covenant-caravan.html", "episodes.html", "map.html",
  ].includes(p), "Stories"],
  [p => p === "witness.html", "Community"],
  [p => [
    "shop.html", "downloads.html", "install.html",
    "assets/data/downloads-archive.html",
  ].includes(p), "Products"],
  [p => [
    "account.html", "circle.html", "garden.html", "guide.html",
    "ledger.html", "micro.html", "practices.html", "teach.html", "read-your-own-day.html",
    "systems/mind-renewal.html",
  ].includes(p), "Living"],
  [p => [
    "404.html", "offline.html", "privacy-policy.html", "search.html",
    "sending-test.html", "ab.html", "codex-atlas.html",
    "genesis-oracle.html", "invoke.html", "systems/recoder.html",
  ].includes(p), "Tools"],
];

function primaryDomain(p) {
  for (const [test, domain] of DOMAIN_RULES) if (test(p)) return domain;
  return null;
}

// ------------------------------------------------------- page typing
function pageType(p, html) {
  if (/<meta[^>]+http-equiv=["']?refresh/i.test(html)) return "redirect";
  if (p === "404.html") return "error";
  if (p === "offline.html") return "offline";
  if (/^scripture\/(genesis|exodus)\/\d+\.html$/.test(p)) return "chapter";
  if (p.startsWith("scripture/word-studies/") && p !== "scripture/word-studies/index.html") return "word-study";
  if (p.startsWith("theory/equations/")) return "equation-plate";
  if (p.startsWith("scroll/data/")) return "shelf-fragment";
  if (p === "assets/data/downloads-archive.html") return "fragment";
  if (path.posix.basename(p) === "index.html") return "index";
  return "page";
}

// ------------------------------------------------- maintenance state
function maintenanceStatus(p) {
  if (p === "aiyanas-world.html") return "excluded-aiyanas-own-design";
  if (p === "theory.html" || p.startsWith("theory/")) return "deferred-by-aarons-word";
  if (p === "living-time-sphere.html") return "r17-protected-terms";
  if (p === "sending-test.html") return "test-page";
  return "active";
}

// ------------------------------------------------------------ build
function buildRegistry() {
  const inventory = JSON.parse(read(INVENTORY));
  const graph = JSON.parse(read(GRAPH));
  const resourceByPath = new Map();
  for (const r of inventory.resources || []) {
    if (r.sourcePath && r.sourcePath.startsWith("docs/")) {
      const key = r.sourcePath.slice("docs/".length);
      if (!resourceByPath.has(key)) resourceByPath.set(key, r);
    }
  }

  const pagePaths = walk(docs).filter(f => f.endsWith(".html")).map(rel);
  const pageSet = new Set(pagePaths);

  const parentOf = p => {
    const dir = path.posix.dirname(p);
    let d = path.posix.basename(p) === "index.html"
      ? (dir === "." ? null : path.posix.dirname(dir))
      : dir;
    while (d !== null && d !== ".") {
      const candidate = d + "/index.html";
      if (pageSet.has(candidate) && candidate !== p) return candidate;
      d = path.posix.dirname(d);
    }
    if (p !== "index.html" && pageSet.has("index.html")) return "index.html";
    return null;
  };

  const unassigned = [];
  const usedIds = new Set();
  const pages = pagePaths.map(p => {
    const html = read(path.join(docs, p));
    const resource = resourceByPath.get(p);
    const title = (html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "")
      .replace(/\s+/g, " ").trim() || resource?.title || p;
    const description = html.match(/<meta\s+name="description"\s+content="([\s\S]*?)"/i)?.[1]
      || resource?.description || "";
    const declaredCanonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1] || "";
    const canonicalUrl = declaredCanonical || resource?.canonicalUrl || BASE_URL + p;

    const domain = primaryDomain(p);
    if (!domain) unassigned.push(p);

    // The catalog's curated ids are clean slugs ("ab", "companions");
    // its per-page fallback ids are raw paths ("docs:theory/..."),
    // which are locators, not ids — those pages take a path slug.
    const slug = p.replace(/\.html$/, "").replace(/\//g, "-");
    let id = resource?.id && /^[a-z0-9][a-z0-9-]*$/.test(resource.id) ? resource.id : slug;
    if (usedIds.has(id)) id = slug;
    if (usedIds.has(id)) throw new Error(`page registry: duplicate id ${id} for ${p}`);
    usedIds.add(id);

    const related = new Set();
    for (const t of graph.pages?.[p]?.out || []) if (pageSet.has(t.path) && t.path !== p) related.add(t.path);
    for (const t of resource?.relatedPages || []) if (pageSet.has(t) && t !== p) related.add(t);

    const disc = resource?.discoverability;
    let navigationVisibility;
    if (disc?.inGlobalNav) navigationVisibility = "global-nav";
    else if (disc?.inSitemap) navigationVisibility = "sitemap";
    else if (typeof disc?.hopsFromHome === "number") navigationVisibility = "linked";
    else if ((graph.pages?.[p]?.in || []).length > 0) navigationVisibility = "linked";
    else navigationVisibility = "unlisted";

    const temporalContext = /pattern-calendar|temporal-cursor|PatternCalendar|SOFTemporalCursor/.test(html)
      ? "pattern-calendar" : "none";

    const dataDeps = new Set();
    for (const m of html.matchAll(/["'(]\s*([^\s"')]*?\.json)["')]/g)) {
      let dep = m[1];
      if (/^(?:https?:|\/\/)/.test(dep)) continue;
      dep = path.posix.normalize(path.posix.join(path.posix.dirname(p), dep));
      if ((dep.includes("/data/") || dep.startsWith("data/")) && fs.existsSync(path.join(docs, dep))) dataDeps.add(dep);
    }

    const entry = {
      id,
      path: p,
      title,
      description,
      primary_domain: domain,
      page_type: pageType(p, html),
      canonical_url: canonicalUrl,
      parent: parentOf(p),
      related_pages: [...related].sort(),
      search_keywords: UNSOURCED,
      navigation_visibility: navigationVisibility,
      available_actions: UNSOURCED,
      spark_capabilities: UNSOURCED,
      temporal_context: temporalContext,
      data_dependencies: [...dataDeps].sort(),
      permissions: UNSOURCED,
      offline_capabilities: UNSOURCED,
      mobile_behavior: UNSOURCED,
      content_version: "sha256:" + sha256(html).slice(0, 12),
      maintenance_status: maintenanceStatus(p),
    };
    return entry;
  });

  if (unassigned.length) {
    throw new Error(
      "page registry: no domain rule claims these pages — assign each a primary domain in scripts/build-page-registry.mjs (ULS-002 section 3):\n  " +
      unassigned.join("\n  "));
  }

  const byDomain = {};
  for (const d of DOMAINS) byDomain[d] = 0;
  for (const e of pages) byDomain[e.primary_domain] += 1;

  return {
    schemaVersion: 1,
    standard: "ULS-002",
    slice: "1 — the authoritative page registry",
    scope: "Every HTML page of the scroll-of-fire site (docs/). Application, game and widget surfaces register in later slices.",
    description: "One registered definition per page: its primary domain, type, canonical URL, parent, relations, navigation standing, temporal context, data dependencies (the JSON data files the page itself references and that exist on the site), content version and maintenance status. Generated by scripts/build-page-registry.mjs from the pages as they stand, the site catalog's master inventory and the link graph; never hand-maintained.",
    generatedFrom: "docs/**/*.html + site-audit/site-master-inventory.json + docs/assets/data/link-graph.json",
    baseUrl: BASE_URL,
    domains: DOMAINS,
    unsourcedFields: UNSOURCED_FIELDS,
    unsourcedNote: "Fields named in unsourcedFields carry the marker \"unsourced\" in every entry: no truthful source exists for them yet, and no value was invented. Filling them is ULS-002 slice-2 work.",
    summary: { pages: pages.length, byDomain },
    pages,
  };
}

const rendered = JSON.stringify(buildRegistry(), null, 2) + "\n";

if (check) {
  const existing = fs.existsSync(OUTPUT) ? read(OUTPUT) : null;
  if (existing !== rendered) {
    console.error("page-registry.json is stale — run: npm run pages:registry");
    process.exit(1);
  }
  console.log("page registry is current");
} else {
  const existing = fs.existsSync(OUTPUT) ? read(OUTPUT) : null;
  if (existing !== rendered) fs.writeFileSync(OUTPUT, rendered);
  const parsed = JSON.parse(rendered);
  console.log(`page registry written (${parsed.summary.pages} pages, ${Object.values(parsed.summary.byDomain).filter(n => n > 0).length} domains in use)`);
}
