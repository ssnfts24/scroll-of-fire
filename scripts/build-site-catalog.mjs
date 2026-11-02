#!/usr/bin/env node
// Builds the shared site catalog, the master inventory and the visibility reports.
// Usage: node scripts/build-site-catalog.mjs [--check] [--baseline <docs-root>]
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const docs = path.join(root, "docs");
const auditDir = path.join(root, "site-audit");
const args = process.argv.slice(2);
const check = args.includes("--check");
const baselineIndex = args.indexOf("--baseline");

const STATUSES = ["live", "source-only", "prototype", "archived", "planned"];
const STATUS_LABEL = { live: "Live", "source-only": "Source only", prototype: "Prototype", archived: "Archived", planned: "Planned" };
const GLOBAL_START = "<!-- site-nav:global:start -->";
const GLOBAL_END = "<!-- site-nav:global:end -->";
const EXPLORE_START = "<!-- site-nav:explore:start -->";
const EXPLORE_END = "<!-- site-nav:explore:end -->";

const curation = JSON.parse(fs.readFileSync(path.join(scriptDir, "site-catalog-curation.json"), "utf8"));
const read = file => fs.readFileSync(file, "utf8");
const esc = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rel = file => path.relative(docs, file).split(path.sep).join("/");
const sha256 = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

function walk(dir, skip = () => false) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (skip(full, entry)) continue;
    if (entry.isDirectory()) out.push(...walk(full, skip));
    else out.push(full);
  }
  return out.sort();
}

// ---------------------------------------------------------------- scanning
function scanPages(siteRoot) {
  const files = walk(siteRoot).filter(f => f.endsWith(".html"));
  const pages = new Map();
  for (const file of files) {
    const p = path.relative(siteRoot, file).split(path.sep).join("/");
    const html = read(file);
    const title = (html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+/g, " ").trim();
    const description = html.match(/<meta\s+name="description"\s+content="([\s\S]*?)"/i)?.[1] || "";
    const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1] || "";
    const robots = html.match(/<meta\s+name="robots"\s+content="([^"]+)"/i)?.[1] || "";
    const baseHref = html.match(/<base\s+href="([^"]*)"/i)?.[1] || "";
    const navMatch = html.match(/<nav[^>]*data-site-nav[^>]*>([\s\S]*?)<\/nav>/i);
    const footerMatch = html.match(/<footer[\s\S]*?<\/footer>/i);
    const resolve = href => resolveHref(p, baseHref, href);
    const anchors = list => [...(list || "").matchAll(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)]
      .map(m => ({ target: resolve(m[1]), label: m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() }))
      .filter(a => a.target);
    pages.set(p, {
      path: p, title, description, canonical, robots, hasNav: Boolean(navMatch),
      hasLibraryLink: Boolean(navMatch && /scroll\/(?:index\.html)?"/.test(navMatch[1])),
      nav: anchors(navMatch?.[1]), footer: anchors(footerMatch?.[0]), all: anchors(html)
    });
  }
  return pages;
}

function resolveHref(page, baseHref, href) {
  if (!href || /^(?:#|mailto:|tel:|javascript:|data:|https?:|\/\/)/i.test(href)) return null;
  const pageUrl = new URL(page, "https://audit.local/");
  const baseUrl = baseHref ? new URL(baseHref, pageUrl) : pageUrl;
  let pathname;
  try { pathname = new URL(href, baseUrl).pathname.replace(/^\//, ""); } catch { return null; }
  pathname = decodeURIComponent(pathname);
  if (!pathname || pathname.endsWith("/")) pathname += "index.html";
  return /\.html$/.test(pathname) ? pathname : null;
}

function sitemapPaths() {
  const xml = read(path.join(docs, "sitemap.xml"));
  return new Set([...xml.matchAll(/<loc>\s*https:\/\/codexofreality\.org\/([^<]*)<\/loc>/g)]
    .map(m => (m[1] === "" || m[1].endsWith("/") ? m[1] + "index.html" : m[1])));
}

function reach(pages, start, skipFrom = new Set()) {
  const dist = new Map([[start, 0]]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift();
    if (skipFrom.has(current)) continue;
    for (const link of pages.get(current)?.all || []) {
      if (pages.has(link.target) && !dist.has(link.target)) {
        dist.set(link.target, dist.get(current) + 1);
        queue.push(link.target);
      }
    }
  }
  return dist;
}

function discoverability(pages) {
  const sitemap = sitemapPaths();
  const home = pages.get("index.html");
  const homeDirect = new Set(home.all.map(a => a.target));
  const homeNav = new Set(home.nav.map(a => a.target));
  const hops = reach(pages, "index.html");
  const hopsNoAtlas = reach(pages, "index.html", new Set(["codex-atlas.html"]));
  const inbound = new Map();
  const navPages = new Map();
  for (const page of pages.values()) {
    for (const link of new Set(page.all.map(a => a.target))) {
      if (link === page.path) continue;
      inbound.set(link, (inbound.get(link) || 0) + 1);
    }
    for (const link of new Set(page.nav.map(a => a.target))) navPages.set(link, (navPages.get(link) || 0) + 1);
  }
  const rows = [...pages.values()].map(page => ({
    path: page.path,
    inSitemap: sitemap.has(page.path),
    inGlobalNav: homeNav.has(page.path),
    linkedFromHomepage: homeDirect.has(page.path),
    hopsFromHome: hops.has(page.path) ? hops.get(page.path) : null,
    hopsFromHomeWithoutAtlas: hopsNoAtlas.has(page.path) ? hopsNoAtlas.get(page.path) : null,
    inboundPages: inbound.get(page.path) || 0,
    pagesWithNavLinkToIt: navPages.get(page.path) || 0
  }));
  return rows;
}

// ---------------------------------------------------------------- catalog
function validateCatalog(pages) {
  const errors = [];
  const ids = new Set();
  const ownedPaths = new Set();
  for (const entry of curation.entries) {
    if (ids.has(entry.id)) errors.push(`duplicate catalog id ${entry.id}`);
    ids.add(entry.id);
    if (!STATUSES.includes(entry.status)) errors.push(`${entry.id}: invalid status ${entry.status}`);
    if (!curation.areas.some(a => a.id === entry.area)) errors.push(`${entry.id}: unknown area ${entry.area}`);
    if (!entry.description || entry.description.length < 20) errors.push(`${entry.id}: missing description`);
    if (entry.status === "planned") {
      if (entry.path) errors.push(`${entry.id}: planned entries must not claim a URL`);
      continue;
    }
    if (!entry.path) { errors.push(`${entry.id}: missing path`); continue; }
    const base = entry.pathKind === "repo" ? root : docs;
    if (!fs.existsSync(path.join(base, entry.path))) errors.push(`${entry.id}: path does not exist: ${entry.path}`);
    if (entry.pathKind !== "repo") ownedPaths.add(entry.path);
  }
  for (const entry of curation.entries) for (const r of entry.related) if (!ids.has(r)) errors.push(`${entry.id}: related id ${r} does not exist`);
  for (const area of curation.areas) {
    if (!ids.has(area.entryPoint)) errors.push(`${area.id}: entry point ${area.entryPoint} does not exist`);
  }
  for (const f of curation.frontDoor) if (!ids.has(f.target)) errors.push(`front door ${f.id}: unknown target ${f.target}`);
  for (const p of pages.keys()) {
    const covered = ownedPaths.has(p) || curation.utilityPages[p]
      || curation.collections.some(c => p.startsWith(c.pathPrefix));
    if (!covered) errors.push(`public page has no catalog entry or utility classification: ${p}`);
  }
  return errors;
}

const publicHref = entry => {
  if (!entry.path) return null;
  if (entry.pathKind === "repo") return `${curation.repoUrl}/blob/main/${encodeURI(entry.path)}`;
  return entry.path === "scroll/index.html" ? "scroll/" : entry.path;
};
const publicUrl = entry => {
  if (!entry.path) return null;
  if (entry.pathKind === "repo") return publicHref(entry);
  return curation.baseUrl + (entry.path === "scroll/index.html" ? "scroll/" : entry.path);
};

function recentUpdates() {
  const updates = JSON.parse(read(path.join(docs, "assets/data/codex-updates.json")));
  return [...updates].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function publicCatalog() {
  return {
    schemaVersion: curation.schemaVersion,
    description: "Shared catalog for the Codex Atlas, homepage front door and hub. Generated by scripts/build-site-catalog.mjs; edit scripts/site-catalog-curation.json instead.",
    baseRevision: curation.baseRevision,
    statuses: STATUSES,
    areas: curation.areas,
    frontDoor: curation.frontDoor,
    entries: curation.entries.map(e => ({
      id: e.id, title: e.title, description: e.description, area: e.area, category: e.category,
      resourceType: e.resourceType, status: e.status, path: e.path, url: publicUrl(e),
      related: e.related, featured: Boolean(e.featured), publicationEligibility: "approved-public"
    }))
  };
}

// ---------------------------------------------------------------- generated HTML
function cardLink(entry, prefix = "") {
  const href = publicHref(entry);
  if (!href) return `<span class="atlas-card-title">${esc(entry.title)}</span>`;
  const external = entry.pathKind === "repo";
  return `<a class="atlas-card-title" href="${external ? esc(href) : prefix + esc(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${esc(entry.title)}${external ? ' <span class="atlas-external" aria-label="(opens GitHub)">↗</span>' : ""}</a>`;
}

function atlasBlock() {
  const entries = curation.entries;
  const byId = new Map(entries.map(e => [e.id, e]));
  const unique = key => [...new Set(entries.map(e => e[key]))].sort((a, b) => a.localeCompare(b));
  const options = (values, labeler = v => v) => values.map(v => `<option value="${esc(v)}">${esc(labeler(v))}</option>`).join("");
  const areaOpts = curation.areas.map(a => `<option value="${a.id}">${esc(a.title)}</option>`).join("");
  const sections = curation.areas.map(area => {
    const items = entries.filter(e => e.area === area.id);
    return `    <section class="atlas-area" id="area-${area.id}" data-atlas-area="${area.id}" aria-labelledby="area-${area.id}-title">
      <header>
        <h2 id="area-${area.id}-title">${esc(area.title)}</h2>
        <p>${esc(area.description)}</p>
        <p class="atlas-area-entry"><a href="${esc(publicHref(byId.get(area.entryPoint)))}">Begin with ${esc(byId.get(area.entryPoint).title)} <span aria-hidden="true">→</span></a></p>
      </header>
      <ul class="atlas-list">
${items.map(e => `        <li class="atlas-card" data-atlas-card data-id="${e.id}" data-area="${e.area}" data-category="${esc(e.category)}" data-type="${e.resourceType}" data-status="${e.status}">
          <h3>${cardLink(e)}</h3>
          <p class="atlas-meta"><span class="atlas-badge atlas-badge--${e.status}">${STATUS_LABEL[e.status]}</span><span>${esc(e.resourceType)}</span><span>${esc(e.category)}</span></p>
          <p>${esc(e.description)}</p>
${e.related.length ? `          <p class="atlas-related"><strong>Related pages:</strong> ${e.related.map(id => {
  const related = byId.get(id);
  return related?.path ? `<a href="${esc(publicHref(related))}">${esc(related.title)}</a>` : "";
}).filter(Boolean).join(" · ")}</p>` : ""}
        </li>`).join("\n")}
      </ul>
    </section>`;
  }).join("\n");
  return `    <nav class="atlas-jump" aria-label="Jump to an area">
${curation.areas.map(a => `      <a href="#area-${a.id}">${esc(a.title)}</a>`).join("\n")}
    </nav>
    <form class="atlas-filters" data-atlas-filters hidden aria-label="Filter the Codex Atlas">
      <label>Search <input type="search" name="q" autocomplete="off" placeholder="Title or description"></label>
      <label>Area <select name="area"><option value="">All areas</option>${areaOpts}</select></label>
      <label>Category <select name="category"><option value="">All categories</option>${options(unique("category"))}</select></label>
      <label>Resource type <select name="type"><option value="">All types</option>${options(unique("resourceType"))}</select></label>
      <label>Status <select name="status"><option value="">All statuses</option>${options(STATUSES, s => STATUS_LABEL[s])}</select></label>
      <button type="reset" class="btn">Clear filters</button>
    </form>
    <p class="atlas-count" role="status" aria-live="polite" data-atlas-count>${entries.length} resources in ${curation.areas.length} areas</p>
    <p class="atlas-empty" data-atlas-empty hidden>No resources match these filters. Clear a filter or search for a different word.</p>
${sections}`;
}

function frontDoorBlock() {
  const byId = new Map(curation.entries.map(e => [e.id, e]));
  const featured = curation.entries.filter(e => e.featured && e.status === "live");
  const recent = recentUpdates().slice(0, 4);
  const hrefOf = id => { const e = byId.get(id); return e.pathKind === "repo" ? e.path : publicHref(e); };
  return `<section class="section-shell front-door" id="front-door" aria-labelledby="front-door-title">
      <p class="eyebrow">The Codex, from the front door</p>
      <h2 id="front-door-title">Where would you like to begin?</h2>
      <ul class="front-door-paths">
${curation.frontDoor.map(f => `        <li><a class="front-door-card" href="${esc(hrefOf(f.target))}"><strong>${esc(f.label)}</strong><span>${esc(f.description)}</span></a></li>`).join("\n")}
      </ul>
      <div class="front-door-grid">
        <section aria-labelledby="front-door-featured">
          <h3 id="front-door-featured">Featured</h3>
          <ul class="front-door-list">
${featured.map(e => `            <li><a href="${esc(publicHref(e))}">${esc(e.title)}</a> <span>${esc(e.description)}</span></li>`).join("\n")}
          </ul>
        </section>
        <section aria-labelledby="front-door-recent">
          <h3 id="front-door-recent">Recent additions</h3>
          <ul class="front-door-list">
${recent.map(u => `            <li><time datetime="${esc(u.date)}">${esc(u.date)}</time> <a href="${esc(u.url)}">${esc(u.title)}</a></li>`).join("\n")}
          </ul>
        </section>
      </div>
      <p class="front-door-actions"><a class="btn primary" href="codex-atlas.html">Open the full Codex Atlas</a> <a class="btn" href="scroll/">Enter the Scroll Library</a></p>
      <p class="atlas-note">Saved witness records, readings and settings live only in this browser. They do not synchronize between devices.</p>
    </section>`;
}

function hubBlock() {
  return `<section class="hub-atlas-strip" aria-labelledby="hub-atlas-title">
      <h2 id="hub-atlas-title">Beyond the systems</h2>
      <p>The Codex also holds the Scroll Library, evidence research, artifacts and the archive. <a href="codex-atlas.html">Open the Codex Atlas</a> or <a href="scroll/">enter the Scroll Library</a>.</p>
    </section>`;
}

function replaceBlock(html, name, content, anchorPattern, indent = "    ") {
  const start = `<!-- site-catalog:${name}:start -->`;
  const end = `<!-- site-catalog:${name}:end -->`;
  const block = `${start}\n${indent}${content}\n${indent}${end}`;
  if (html.includes(start)) return html.replace(new RegExp(`${start}[\\s\\S]*?${end}`), () => block);
  if (!anchorPattern) throw new Error(`missing markers for ${name}`);
  const match = anchorPattern.exec(html);
  if (!match) throw new Error(`anchor not found for ${name}`);
  return html.slice(0, match.index) + block + "\n\n" + indent + html.slice(match.index);
}

function syncNav(html, file) {
  const navOpen = /(<nav[^>]*data-site-nav[^>]*>)/i.exec(html);
  if (!navOpen) return { html, status: "no-nav" };
  const hasRootBase = /<base\s+href="\/"/i.test(html);
  const prefix = hasRootBase ? "./" : html.match(/href="((?:\.\.?\/)*)moons\.html"/)?.[1];
  if (!prefix) return { html, status: "no-prefix" };
  const global = `${GLOBAL_START}\n      <a class="is-featured" href="${prefix}scroll/">Scroll Library</a>\n      <a href="${prefix}codex-atlas.html">Atlas</a>\n      ${GLOBAL_END}`;
  const explore = `${EXPLORE_START}\n          <a href="${prefix}scroll/search.html">Scroll Search</a>\n          <a href="${prefix}scroll/lexicon.html">Hebrew Lexicon</a>\n          <a href="${prefix}scroll/atlas.html">Reference Atlas</a>\n          <a href="${prefix}scroll/editorial.html">Evidence Edition</a>\n          ${EXPLORE_END}`;
  const libraryMenu = `<div class="nav-dropdown" data-dropdown>\n        <button class="nav-drop-btn" type="button" aria-expanded="false" aria-controls="nav-scroll-library" data-dropdown-toggle>Library <span aria-hidden="true">▾</span></button>\n        <div id="nav-scroll-library" class="nav-drop-menu">\n          <a href="${prefix}scroll/search.html">Scroll Search</a>\n          <a href="${prefix}scroll/lexicon.html">Hebrew Lexicon</a>\n          <a href="${prefix}scroll/atlas.html">Reference Atlas</a>\n          <a href="${prefix}scroll/editorial.html">Evidence Edition</a>\n        </div>\n      </div>`;
  let out = html;
  out = out.includes(GLOBAL_START)
    ? out.replace(new RegExp(`${GLOBAL_START}[\\s\\S]*?${GLOBAL_END}`), () => global)
    : out.replace(navOpen[1], () => `${navOpen[1]}\n      ${global}`);
  const exploreOpen = /(id="nav-explore" class="nav-drop-menu">)/.exec(out);
  if (!exploreOpen) {
    const globalEnd = out.indexOf(GLOBAL_END);
    if (globalEnd >= 0 && !out.includes("nav-scroll-library")) {
      const afterMarker = globalEnd + GLOBAL_END.length;
      out = out.slice(0, afterMarker) + "\n      " + libraryMenu + out.slice(afterMarker);
    }
    return { html: out, status: "custom-menu" };
  }
  out = out.includes(EXPLORE_START)
    ? out.replace(new RegExp(`${EXPLORE_START}[\\s\\S]*?${EXPLORE_END}`), () => explore)
    : out.replace(exploreOpen[1], () => `${exploreOpen[1]}\n          ${explore}`);
  return { html: out, status: "synced" };
}

// ---------------------------------------------------------------- inventory
function parseDownloads() {
  const html = read(path.join(docs, "downloads.html"));
  const rows = [...html.matchAll(/<tr>\s*<td><strong>([\s\S]*?)<\/strong><\/td>\s*<td><code>([\s\S]*?)<\/code><\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td><code>([0-9a-f]{64})<\/code>/g)]
    .map(m => ({ title: m[1].trim(), path: m[2].replace(/&amp;/g, "&").trim(), size: m[4].trim(), sha256: m[5] }));
  return {
    rows,
    declaredFiles: Number(html.match(/<strong>(\d+) files<\/strong>/)?.[1] || 0),
    declaredSize: html.match(/Total sealed archive size: <strong>([^<]+)<\/strong>/)?.[1] || "",
    snapshotCommit: html.match(/commit\/([0-9a-f]{40})/)?.[1] || ""
  };
}

function trackedFiles() {
  try {
    return execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
      .split("\0").filter(Boolean).sort();
  } catch {
    return walk(root, (f, e) => e.isDirectory() && [".git", "node_modules"].includes(e.name)).map(f => path.relative(root, f).split(path.sep).join("/"));
  }
}

function reconcileDownloads(files) {
  const snapshot = parseDownloads();
  const inScope = f => (!f.includes("/") || /^[1-7]_/.test(f.split("/")[0])) && !["netlify.toml", "package.json", ".gitignore"].includes(f);
  const current = new Map(files.filter(inScope).map(f => [f, sha256(path.join(root, f))]));
  const listed = new Map(snapshot.rows.map(r => [r.path, r]));
  const added = [...current.keys()].filter(f => !listed.has(f));
  const removed = [...listed.keys()].filter(f => !current.has(f));
  const changed = [...listed.keys()].filter(f => current.has(f) && current.get(f) !== listed.get(f).sha256);
  const unchanged = [...listed.keys()].filter(f => current.has(f) && current.get(f) === listed.get(f).sha256);
  const bytes = [...current.keys()].reduce((n, f) => n + fs.statSync(path.join(root, f)).size, 0);
  return {
    note: "Report only. downloads.html and its integrity history were not modified.",
    snapshot: { commit: snapshot.snapshotCommit, declaredFiles: snapshot.declaredFiles, declaredSize: snapshot.declaredSize, parsedRows: snapshot.rows.length },
    current: { files: current.size, sizeMB: Number((bytes / 1048576).toFixed(2)) },
    counts: { added: added.length, removed: removed.length, changed: changed.length, unchanged: unchanged.length },
    added, removed,
    changed: changed.map(f => ({ path: f, snapshotSha256: listed.get(f).sha256, currentSha256: current.get(f) })),
    outsideSnapshotScope: files.filter(f => !inScope(f) && !f.startsWith("docs/")).filter(f => !/^(archive|scripts|tests|site-audit|\.github)\//.test(f) && f.includes("/")).length
  };
}

function classifyRoot(file, listedPaths, catalogPaths) {
  if (listedPaths.has(file)) return "published-via-downloads";
  if (catalogPaths.has(file)) return "approved-public";
  return "development-only";
}

function describeRootFile(file, eligibility) {
  const extension = path.extname(file).toLowerCase();
  const visibility = eligibility === "development-only"
    ? "Not approved for the public catalog; review before adding a site entry."
    : "Explicitly listed for public repository access.";
  if (extension === ".md") return `Root-level Markdown publication or project document. ${visibility}`;
  if (extension === ".zip") return `Root-level ZIP archive package. ${visibility}`;
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(extension)) {
    return `Root-level image asset; descriptive title and publication intent should be reviewed. ${visibility}`;
  }
  if (extension === ".docx") return `Root-level Word document; publication intent should be reviewed. ${visibility}`;
  return `Root-level repository file (${extension || "no extension"}). ${visibility}`;
}

function buildMaster(pages, disc, files, reconcile) {
  const byPath = new Map(curation.entries.filter(e => e.path && e.pathKind !== "repo").map(e => [e.path, e]));
  const catalogRepo = new Set(curation.entries.filter(e => e.pathKind === "repo").map(e => e.path));
  const listedPaths = new Set(parseDownloads().rows.map(r => r.path));
  const discByPath = new Map(disc.map(d => [d.path, d]));
  const homepageLinks = new Set(pages.get("index.html").all.map(a => a.target));
  const resources = [];
  const navLabels = new Map();
  for (const a of pages.get("index.html").nav) navLabels.set(a.target, a.label);
  for (const page of pages.values()) {
    const entry = byPath.get(page.path) || curation.collections.map(c => page.path.startsWith(c.pathPrefix) ? curation.entries.find(e => e.id === c.entry) : null).find(Boolean);
    const d = discByPath.get(page.path);
    const issues = [];
    const utility = curation.utilityPages[page.path];
    if (!page.description) issues.push("missing-meta-description");
    if (!d.inSitemap && !/noindex/.test(page.robots) && !utility) issues.push("not-in-sitemap");
    if (!page.hasNav && !utility && !page.path.startsWith("scroll/")) issues.push("no-global-navigation");
    if (d.hopsFromHome === null) issues.push("unreachable-from-homepage");
    else if (d.hopsFromHomeWithoutAtlas === null) issues.push("reachable-only-through-atlas");
    if (!utility && !homepageLinks.has(page.path) && !page.path.startsWith("theory/equations/") && !page.path.startsWith("scroll/")) issues.push("not-linked-directly-from-homepage");
    if (page.path === "caravan.html") issues.push("compatibility-redirect-page");
    const label = navLabels.get(page.path);
    const shortTitle = page.title.split(/ [—|] /)[0].replace(/&amp;/g, "&").trim();
    if (label && label.toLowerCase() !== shortTitle.toLowerCase()) issues.push(`nav-label-differs-from-title: "${label}" vs "${shortTitle}"`);
    resources.push({
      id: entry && byPath.get(page.path) ? entry.id : `docs:${page.path}`,
      title: page.title, description: page.description || entry?.description || "",
      category: entry?.category || (utility ? "Utility" : "Uncatalogued"),
      area: entry?.area || null, relatedProjects: entry?.related || [],
      sourcePath: `docs/${page.path}`, publicUrl: curation.baseUrl + (page.path === "index.html" ? "" : page.path),
      publicationStatus: entry ? entry.status : "live",
      lastVerifiedSourceRevision: curation.baseRevision,
      relatedPages: [...new Set(page.all.map(a => a.target))].filter(t => pages.has(t) && t !== page.path).sort(),
      canonicalUrl: page.canonical, privacyEligibility: utility ? "utility" : "approved-public",
      discoverability: d, issues
    });
  }
  const docsFiles = walk(docs).filter(f => !f.endsWith(".html"));
  const groups = new Map();
  for (const file of docsFiles) {
    const p = rel(file);
    const top = p.includes("/") ? p.split("/").slice(0, p.startsWith("assets/") || p.startsWith("scroll/") ? 2 : 1).join("/") : p;
    if (/\.md$/.test(p) && !p.startsWith("scroll/")) {
      resources.push({
        id: `docs:${p}`, title: p, description: "Markdown document deployed inside docs/ and therefore publicly fetchable, but not linked from the site.",
        category: "Development document", area: null, relatedProjects: [], sourcePath: `docs/${p}`, publicUrl: curation.baseUrl + p,
        publicationStatus: "source-only", lastVerifiedSourceRevision: curation.baseRevision, relatedPages: [], canonicalUrl: "",
        privacyEligibility: p.startsWith("reports/") || p.startsWith("development/") || /HANDOFF|PHASE|STATUS|MAINTENANCE|checklist|recovery|testing|version-history|audit/i.test(p) ? "development-only-deployed-publicly" : "documentation",
        discoverability: null, issues: ["deployed-but-unlinked"]
      });
      continue;
    }
    groups.set(top, (groups.get(top) || 0) + 1);
  }
  for (const [group, count] of groups) {
    resources.push({
      id: `docs-assets:${group}`, title: `docs/${group} (${count} files)`, description: "Static assets, data and generated artifacts served from docs/.",
      category: "Static assets", area: null, relatedProjects: [], sourcePath: `docs/${group}`, publicUrl: curation.baseUrl + group,
      publicationStatus: "live", lastVerifiedSourceRevision: curation.baseRevision, relatedPages: [], canonicalUrl: "",
      privacyEligibility: "supporting-asset", discoverability: null, issues: []
    });
  }
  const rootFiles = files.filter(f => !f.includes("/"));
  for (const f of rootFiles) {
    const privacy = classifyRoot(f, listedPaths, catalogRepo);
    const issues = [];
    if (privacy === "development-only") issues.push("not-published-in-catalog");
    if (/\.(jpg|png)$/i.test(f) && /^(\d{8}_|file_)/.test(f)) issues.push("unnamed-image-needs-descriptive-title");
    resources.push({
      id: `repo:${f}`, title: f, description: describeRootFile(f, privacy), category: "Repository root file", area: null, relatedProjects: [],
      sourcePath: f, publicUrl: privacy === "development-only" ? null : `${curation.repoUrl}/blob/main/${encodeURI(f)}`,
      publicationStatus: "source-only", lastVerifiedSourceRevision: curation.baseRevision, relatedPages: [], canonicalUrl: null,
      privacyEligibility: privacy, discoverability: null, issues
    });
  }
  const folders = new Map();
  for (const f of files.filter(x => x.includes("/") && !x.startsWith("docs/"))) {
    const top = f.split("/")[0];
    folders.set(top, (folders.get(top) || 0) + 1);
    if (/^[1-7]_/.test(top)) {
      const privacy = classifyRoot(f, listedPaths, catalogRepo);
      resources.push({
        id: `repo:${f}`, title: path.basename(f), description: `Archived file from ${top}; listed in the Downloads integrity catalog.`,
        category: "Numbered archive file", area: "archive", relatedProjects: ["downloads"],
        sourcePath: f, publicUrl: privacy === "development-only" ? null : `${curation.repoUrl}/blob/main/${encodeURI(f)}`,
        publicationStatus: privacy === "development-only" ? "source-only" : "archived",
        lastVerifiedSourceRevision: curation.baseRevision, relatedPages: ["docs/downloads.html"], canonicalUrl: "",
        privacyEligibility: privacy, discoverability: null,
        issues: privacy === "development-only" ? ["not-listed-in-downloads"] : []
      });
    }
  }
  for (const [folder, count] of folders) {
    const numbered = /^[1-7]_/.test(folder);
    resources.push({
      id: `repo-folder:${folder}`, title: `${folder}/ (${count} files)`,
      description: numbered
        ? "Numbered archive folder listed file-by-file in the Downloads catalog."
        : "Repository folder in the source tree; inventoried but not linked publicly without explicit curation.",
      category: numbered ? "Numbered archive folder" : "Repository folder", area: numbered ? "archive" : null, relatedProjects: numbered ? ["downloads"] : [],
      sourcePath: folder, publicUrl: numbered ? `${curation.repoUrl}/tree/main/${folder}` : null,
      publicationStatus: folder === "archive" ? "archived" : "source-only", lastVerifiedSourceRevision: curation.baseRevision, relatedPages: [], canonicalUrl: "",
      privacyEligibility: numbered ? "published-via-downloads" : folder === "archive" ? "approved-public-archive" : "development-only",
      discoverability: null, issues: []
    });
  }
  for (const entry of curation.entries.filter(e => e.status === "planned")) {
    resources.push({
      id: entry.id, title: entry.title, description: entry.description, category: entry.category, area: entry.area, relatedProjects: entry.related,
      sourcePath: null, publicUrl: null, publicationStatus: "planned", lastVerifiedSourceRevision: curation.baseRevision, relatedPages: [], canonicalUrl: "",
      privacyEligibility: "approved-public", discoverability: null, issues: ["no-public-url-yet"]
    });
  }
  resources.sort((a, b) => a.id.localeCompare(b.id));
  const issueCounts = {};
  for (const r of resources) for (const i of r.issues) { const k = i.split(":")[0]; issueCounts[k] = (issueCounts[k] || 0) + 1; }
  return {
    schemaVersion: 1,
    purpose: "Development-only master inventory. Do not publish; the public catalog is docs/data/site-catalog.json.",
    baseRevision: curation.baseRevision,
    summary: { resources: resources.length, publicHtmlPages: pages.size, catalogEntries: curation.entries.length, issueCounts },
    resources
  };
}

function reportMarkdown(master, disc, pages, reconcile, baseline) {
  const lines = [];
  const L = s => lines.push(s);
  const pg = master.resources.filter(r => r.sourcePath?.startsWith("docs/") && r.sourcePath.endsWith(".html"));
  const withIssue = key => pg.filter(r => r.issues.some(i => i.startsWith(key)));
  L("# Discoverability report");
  L("");
  L(`Generated by \`npm run site:catalog\` against base revision \`${curation.baseRevision}\`. Development document; not published.`);
  L("");
  L("## Summary");
  L("");
  L(`- Public HTML pages: **${pages.size}**`);
  L(`- Catalog entries: **${curation.entries.length}** (live ${curation.entries.filter(e => e.status === "live").length}, source-only ${curation.entries.filter(e => e.status === "source-only").length}, planned ${curation.entries.filter(e => e.status === "planned").length}, archived ${curation.entries.filter(e => e.status === "archived").length})`);
  L(`- Pages with the global navigation: **${[...pages.values()].filter(p => p.hasNav).length}**; with a Scroll Library link in it: **${[...pages.values()].filter(p => p.hasLibraryLink).length}**`);
  L(`- Pages reachable from the homepage: **${disc.filter(d => d.hopsFromHome !== null).length} / ${pages.size}**; without the Atlas: **${disc.filter(d => d.hopsFromHomeWithoutAtlas !== null).length} / ${pages.size}**`);
  L(`- Pages linked directly from the homepage: **${disc.filter(d => d.linkedFromHomepage).length}**`);
  if (baseline) {
    L("");
    L(`### Before (main @ ${baseline.revision})`);
    L("");
    L(`- Pages reachable from the homepage: ${baseline.reachableFromHome} / ${baseline.pages}; linked directly from homepage: ${baseline.linkedFromHomepage}`);
    L(`- Pages with a Scroll Library link in global navigation: ${baseline.pagesWithLibraryNavLink}`);
    L(`- Scroll Library pages reachable from the homepage: ${baseline.scrollPagesReachable} / ${baseline.scrollPages}`);
    L(`- Atlas page: ${baseline.hasAtlas ? "present" : "absent"}; homepage activity feed newest entry: ${baseline.newestUpdate}`);
  }
  L("");
  L("## Issue counts");
  L("");
  for (const [k, v] of Object.entries(master.summary.issueCounts).sort()) L(`- \`${k}\`: ${v}`);
  L("");
  const section = (title, key, hint) => {
    const rows = withIssue(key);
    L(`## ${title} (${rows.length})`);
    L("");
    L(hint);
    L("");
    for (const r of rows) L(`- \`${r.sourcePath.replace(/^docs\//, "")}\`${r.issues.filter(i => i.startsWith(key)).map(i => i.includes(":") ? ` — ${i.slice(i.indexOf(":") + 1).trim()}` : "").join("")}`);
    L("");
  };
  section("Unreachable from the homepage", "unreachable-from-homepage", "No chain of links leads to these pages from `index.html`.");
  section("Reachable only through the Atlas", "reachable-only-through-atlas", "Reachable after this PR only because the Atlas lists them; no other route from the homepage.");
  section("Pages without global navigation", "no-global-navigation", "These pages have no shared header navigation; readers cannot move to other sections from them.");
  section("Pages without a direct homepage link", "not-linked-directly-from-homepage", "These pages remain discoverable through the Atlas or linked pages, but are not linked directly from homepage content or menus.");
  section("Missing meta descriptions", "missing-meta-description", "Search engines and the Atlas fall back to catalog text for these pages.");
  section("Navigation label differs from page title", "nav-label-differs-from-title", "Inconsistent page naming between the menu and the page itself.");
  section("Compatibility redirects", "compatibility-redirect-page", "Kept for old links; not part of normal navigation.");
  const deployed = master.resources.filter(r => r.issues.includes("deployed-but-unlinked"));
  L(`## Documents deployed publicly but not linked (${deployed.length})`);
  L("");
  L("Everything under `docs/` is served by Netlify. These Markdown files are fetchable by URL although nothing links to them. No files were moved or removed in this PR; classify them in a follow-up.");
  L("");
  for (const r of deployed) L(`- \`${r.sourcePath}\` — ${r.privacyEligibility}`);
  L("");
  L("## Repository root and folders not published in the catalog");
  L("");
  for (const r of master.resources.filter(x => x.privacyEligibility === "development-only")) L(`- \`${r.sourcePath}\`${r.issues.length ? ` — ${r.issues.join(", ")}` : ""}`);
  L("");
  L("## Downloads catalog reconciliation");
  L("");
  L(`Snapshot commit \`${reconcile.snapshot.commit.slice(0, 12)}\` declares ${reconcile.snapshot.declaredFiles} files / ${reconcile.snapshot.declaredSize}; ${reconcile.snapshot.parsedRows} rows were parsed. The current repository scope holds ${reconcile.current.files} files / ${reconcile.current.sizeMB} MB.`);
  L("");
  L(`- Added since snapshot: **${reconcile.counts.added}**`);
  L(`- Removed since snapshot: **${reconcile.counts.removed}**`);
  L(`- Changed hash: **${reconcile.counts.changed}**`);
  L(`- Unchanged: **${reconcile.counts.unchanged}**`);
  L("");
  L("The page itself was not changed. Full lists are in `downloads-reconciliation.json`.");
  L("");
  L("## Per-page status");
  L("");
  L("| Page | Hops from home | Hops w/o Atlas | In nav | In sitemap | Inbound pages |");
  L("|---|---:|---:|:-:|:-:|---:|");
  for (const d of disc) L(`| \`${d.path}\` | ${d.hopsFromHome ?? "—"} | ${d.hopsFromHomeWithoutAtlas ?? "—"} | ${d.pagesWithNavLinkToIt ? "yes" : "no"} | ${d.inSitemap ? "yes" : "no"} | ${d.inboundPages} |`);
  L("");
  return lines.join("\n");
}

function coverageMarkdown(master) {
  const lines = [
    "# Site content coverage",
    "",
    `Generated from the shared catalog at base revision \`${curation.baseRevision}\`. This report is development-only; the unpublished-work inventory is not exposed under \`docs/\`.`,
    "",
    "## Public discovery areas",
    ""
  ];
  for (const area of curation.areas) {
    const entries = curation.entries.filter(e => e.area === area.id);
    lines.push(`### ${area.title} (${entries.length} catalog entries)`, "", area.description, "");
    for (const entry of entries) {
      const state = STATUS_LABEL[entry.status];
      lines.push(`- **${entry.title}** — ${state}; ${entry.description}`);
    }
    lines.push("");
  }
  const byType = new Map();
  for (const resource of master.resources) {
    const type = resource.sourcePath?.startsWith("docs/") && resource.sourcePath.endsWith(".html")
      ? "HTML pages"
      : resource.sourcePath?.startsWith("docs/") && resource.sourcePath.endsWith(".md")
        ? "Deployed Markdown documents"
        : resource.category;
    byType.set(type, (byType.get(type) || 0) + 1);
  }
  lines.push("## Repository and deployed-content coverage", "");
  lines.push(`- Public HTML pages inspected: **${master.summary.publicHtmlPages}**.`);
  lines.push(`- Total master-inventory records: **${master.summary.resources}**, including public pages, deployed files, repository-root items, numbered archive files, and planned discovery work.`);
  lines.push(`- Public-facing catalog entries: **${curation.entries.length}**; only explicitly curated entries appear on the Atlas.`);
  lines.push(`- Numbered archive folders are inventoried file-by-file, while downloads snapshot differences are kept separate from historical integrity data.`);
  lines.push(`- Root files not already published through the archive or explicitly approved remain classified as development-only; no such file is automatically linked from the public catalog.`);
  lines.push("");
  lines.push("## Follow-up roadmap", "");
  lines.push("1. Review the development-only report and classify the many Markdown handoffs under `docs/`; they are fetchable from Netlify today even though the site does not link them. Any publication-boundary change should be a separately reviewed migration.");
  lines.push("2. Resolve the 27 root-document differences in the Downloads snapshot explicitly. Preserve commit `af3078a5fc2c` and its 167-file / 208.44 MB historical record; do not silently rewrite old seals.");
  lines.push("3. Standardize the 24 menu-label/page-title differences and review which deeper theory and practice pages merit direct homepage menu links rather than Atlas discovery.");
  lines.push("4. Build a future site-wide index from the catalog and approved public content; keep it separate from the Scroll-specific full-manuscript search.");
  lines.push("5. Review the 21 timestamp-named root images and 27 files added since the Downloads snapshot for descriptive titles and intentional catalog inclusion.");
  lines.push("6. Connect public entry-point coverage to an automated link and navigation regression check for future page additions.");
  lines.push("");
  lines.push("## Current resource-type counts", "");
  for (const [type, count] of [...byType].sort((a, b) => a[0].localeCompare(b[0]))) lines.push(`- ${type}: ${count}`);
  lines.push("");
  return lines.join("\n");
}

function baselineSummary(siteRoot) {
  const pages = scanPages(siteRoot);
  const disc = discoverability(pages);
  const scroll = disc.filter(d => d.path.startsWith("scroll/"));
  const updates = JSON.parse(read(path.join(siteRoot, "assets/data/codex-updates.json")));
  return {
    revision: curation.baseRevision, pages: pages.size,
    reachableFromHome: disc.filter(d => d.hopsFromHome !== null).length,
    linkedFromHomepage: disc.filter(d => d.linkedFromHomepage).length,
    pagesWithLibraryNavLink: [...pages.values()].filter(p => p.hasLibraryLink).length,
    scrollPages: scroll.length, scrollPagesReachable: scroll.filter(d => d.hopsFromHome !== null).length,
    hasAtlas: pages.has("codex-atlas.html"),
    newestUpdate: updates.map(u => u.date).sort().at(-1)
  };
}

// ---------------------------------------------------------------- main
const outputs = new Map();
const put = (file, content) => outputs.set(file, content.endsWith("\n") ? content : content + "\n");

if (baselineIndex >= 0) {
  const summary = baselineSummary(path.resolve(args[baselineIndex + 1]));
  fs.mkdirSync(auditDir, { recursive: true });
  fs.writeFileSync(path.join(auditDir, "baseline-discoverability.json"), JSON.stringify(summary, null, 2) + "\n");
  console.log("baseline written", summary);
  process.exit(0);
}

// pages are edited in memory first so the reports describe the final state
const pageFiles = walk(docs).filter(f => f.endsWith(".html"));
const edited = new Map();
const navStatus = {};
for (const file of pageFiles) {
  let html = read(file);
  const original = html;
  const p = rel(file);
  if (!p.startsWith("scroll/")) {
    const synced = syncNav(html, file);
    html = synced.html;
    navStatus[p] = synced.status;
  }
  if (p === "index.html") html = replaceBlock(html, "front-door", frontDoorBlock(), /<!-- Authoritative Living Time Sphere/);
  if (p === "hub.html") html = replaceBlock(html, "hub-strip", hubBlock(), /<\/main>/);
  if (p === "codex-atlas.html") html = replaceBlock(html, "atlas", atlasBlock(), null, "");
  if (html !== original) edited.set(file, html);
}
for (const [file, html] of edited) put(file, html);

const errors = validateCatalog(scanPages(docs));
// scan the edited state, not the on-disk one, so --check and write agree
const pagesFinal = (() => {
  const tmp = fs.mkdtempSync(path.join(root, ".site-scan-"));
  try {
    for (const file of pageFiles) {
      const target = path.join(tmp, rel(file));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, edited.get(file) ?? read(file));
    }
    fs.copyFileSync(path.join(docs, "sitemap.xml"), path.join(tmp, "sitemap.xml"));
    return scanPages(tmp);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
})();
const disc = discoverability(pagesFinal);
const files = trackedFiles().filter(f => fs.existsSync(path.join(root, f)));
const reconcile = reconcileDownloads(files);
const master = buildMaster(pagesFinal, disc, files, reconcile);
const baselineFile = path.join(auditDir, "baseline-discoverability.json");
const baseline = fs.existsSync(baselineFile) ? JSON.parse(read(baselineFile)) : null;

put(path.join(docs, "data/site-catalog.json"), JSON.stringify(publicCatalog(), null, 2));
put(path.join(auditDir, "site-master-inventory.json"), JSON.stringify(master, null, 2));
put(path.join(auditDir, "downloads-reconciliation.json"), JSON.stringify(reconcile, null, 2));
put(path.join(auditDir, "DISCOVERABILITY_REPORT.md"), reportMarkdown(master, disc, pagesFinal, reconcile, baseline));
put(path.join(auditDir, "CONTENT-COVERAGE.md"), coverageMarkdown(master));

if (errors.length) {
  console.error(errors.map(e => `ERROR ${e}`).join("\n"));
  process.exit(1);
}

let stale = 0;
for (const [file, content] of outputs) {
  const exists = fs.existsSync(file);
  if (check) {
    if (!exists || read(file) !== content) { stale += 1; console.error(`STALE ${path.relative(root, file)}`); }
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (!exists || read(file) !== content) fs.writeFileSync(file, content);
  }
}
if (check) {
  if (stale) { console.error(`${stale} generated file(s) out of date; run npm run site:catalog`); process.exit(1); }
  console.log(`site catalog up to date (${curation.entries.length} entries, ${pagesFinal.size} pages)`);
} else {
  console.log(`site catalog written (${curation.entries.length} entries, ${pagesFinal.size} pages, ${outputs.size} generated files)`);
}
