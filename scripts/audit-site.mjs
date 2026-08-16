import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const siteRoot = path.join(projectRoot, "docs");
const errors = [];
const warnings = [];
let checkedReferences = 0;

function walk(directory, predicate) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walk(absolute, predicate));
    else if (!predicate || predicate(absolute)) result.push(absolute);
  }
  return result;
}

function relative(file) {
  return path.relative(siteRoot, file).split(path.sep).join("/");
}

function addError(file, message) {
  errors.push(`${relative(file)}: ${message}`);
}

function addWarning(file, message) {
  warnings.push(`${relative(file)}: ${message}`);
}

function matches(source, expression) {
  return [...source.matchAll(expression)];
}

function attribute(tag, name) {
  const result = tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`, "is"));
  return result?.[2] ?? null;
}

function stripQueryAndHash(value) {
  return value.split("#", 1)[0].split("?", 1)[0];
}

function fileExistsForUrl(pathname) {
  let clean = pathname.replace(/^\/+/, "");
  if (clean.startsWith("scroll-of-fire/")) clean = clean.slice("scroll-of-fire/".length);
  try { clean = decodeURIComponent(clean); } catch { return false; }
  const normalized = path.normalize(clean || "index.html");
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) return false;
  const candidate = path.join(siteRoot, normalized);
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return true;
  if (!path.extname(candidate) && fs.existsSync(`${candidate}.html`)) return true;
  if (fs.existsSync(path.join(candidate, "index.html"))) return true;
  return false;
}

function checkReference(file, rawValue, baseHref, ids, kind) {
  const value = String(rawValue || "").trim();
  if (!value || value === "#" || /^(?:mailto:|tel:|sms:|javascript:|data:|blob:)/i.test(value)) return;
  if (/[{}<>]/.test(value)) return;
  if (value.startsWith("#")) {
    const target = value.slice(1);
    if (target && !ids.has(target)) addError(file, `${kind} points to missing fragment #${target}`);
    return;
  }
  let resolved;
  try {
    const page = relative(file);
    const pageUrl = new URL(page, "https://audit.local/");
    const baseUrl = baseHref ? new URL(baseHref, pageUrl) : pageUrl;
    resolved = new URL(value, baseUrl);
  } catch {
    addError(file, `${kind} has an invalid URL: ${value}`);
    return;
  }
  if (resolved.origin !== "https://audit.local" && !["https://codexofreality.org", "https://www.codexofreality.org"].includes(resolved.origin)) return;
  checkedReferences += 1;
  if (!fileExistsForUrl(stripQueryAndHash(resolved.pathname))) {
    addError(file, `${kind} target is missing: ${value}`);
    return;
  }
  if (resolved.hash && /\.html?$/.test(resolved.pathname)) {
    const targetPath = stripQueryAndHash(resolved.pathname).replace(/^\/+/, "").replace(/^scroll-of-fire\//, "") || "index.html";
    const targetFile = path.join(siteRoot, targetPath);
    if (fs.existsSync(targetFile)) {
      const targetSource = fs.readFileSync(targetFile, "utf8");
      const targetIds = new Set(matches(targetSource, /\sid\s*=\s*(["'])(.*?)\1/gi).map(match => match[2]));
      if (!targetIds.has(decodeURIComponent(resolved.hash.slice(1)))) addError(file, `${kind} points to missing fragment ${resolved.hash} in ${targetPath}`);
    }
  }
}

function auditHtml(file) {
  const source = fs.readFileSync(file, "utf8");
  if (!/^\s*<!doctype html>/i.test(source)) addError(file, "missing HTML5 doctype");
  if (!/<html\b[^>]*\blang\s*=\s*["'][^"']+["']/i.test(source)) addError(file, "missing html lang attribute");
  if (!/<title>\s*[^<]+\s*<\/title>/i.test(source)) addError(file, "missing non-empty title");
  if (!/<meta\b[^>]*\bname\s*=\s*["']viewport["'][^>]*>/i.test(source)) addError(file, "missing viewport metadata");
  if (!/<meta\b[^>]*\bname\s*=\s*["']description["'][^>]*\bcontent\s*=\s*["'][^"']{20,}["'][^>]*>/i.test(source) &&
      !/<meta\b[^>]*\bcontent\s*=\s*["'][^"']{20,}["'][^>]*\bname\s*=\s*["']description["'][^>]*>/i.test(source)) {
    addError(file, "missing useful meta description");
  }
  const canonicalTag = matches(source, /<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*>/gi)[0]?.[0] || "";
  const canonical = attribute(canonicalTag, "href");
  if (!canonical) addError(file, "missing canonical URL");
  else if (!/^https:\/\/(?:www\.)?codexofreality\.org\//i.test(canonical)) addError(file, `canonical must use the production origin: ${canonical}`);
  else {
    const canonicalUrl = new URL(canonical);
    if (!fileExistsForUrl(canonicalUrl.pathname)) addError(file, `canonical target is missing: ${canonical}`);
  }

  const openGraphUrlTag = matches(source, /<meta\b[^>]*>/gi)
    .map(match => match[0])
    .find(tag => String(attribute(tag, "property") || "").toLowerCase() === "og:url");
  const openGraphUrl = attribute(openGraphUrlTag || "", "content");
  if (canonical && openGraphUrl && canonical !== openGraphUrl) addError(file, `og:url does not match canonical: ${openGraphUrl}`);

  const h1Count = matches(source, /<h1\b[^>]*>/gi).length;
  if (h1Count !== 1) addError(file, `expected exactly one h1, found ${h1Count}`);
  if (!/<main\b/i.test(source)) addWarning(file, "missing main landmark");
  if (!/class\s*=\s*["'][^"']*skip-link/i.test(source)) addWarning(file, "missing skip link");
  if (relative(file) !== "offline.html" && !/assets\/js\/site\.js(?:[?"'])/i.test(source)) addError(file, "does not load shared site.js");

  const idMatches = matches(source, /\sid\s*=\s*(["'])(.*?)\1/gi);
  const ids = new Set();
  for (const match of idMatches) {
    if (ids.has(match[2])) addError(file, `duplicate id: ${match[2]}`);
    ids.add(match[2]);
  }
  const baseTag = matches(source, /<base\b[^>]*>/gi)[0]?.[0] || "";
  const baseHref = attribute(baseTag, "href");
  const tags = matches(source, /<(?:a|link|script|img|source|video|audio|iframe|object|embed|form)\b[^>]*>/gi).map(match => match[0]);
  for (const tag of tags) {
    const tagName = tag.match(/^<([a-z]+)/i)?.[1]?.toLowerCase() || "element";
    if (tagName === "img" && attribute(tag, "alt") == null) addError(file, `image missing alt attribute: ${attribute(tag, "src") || "unknown source"}`);
    if (tagName === "img" && (!attribute(tag, "width") || !attribute(tag, "height"))) addWarning(file, `image has no explicit width/height: ${attribute(tag, "src") || "unknown source"}`);
    for (const name of ["href", "src", "poster", "data", "action"]) {
      if (tagName === "link" && /\brel\s*=\s*["']canonical["']/i.test(tag)) continue;
      const value = attribute(tag, name);
      if (value != null) checkReference(file, value, baseHref, ids, `${tagName}[${name}]`);
    }
    const srcset = attribute(tag, "srcset");
    if (srcset) srcset.split(",").map(part => part.trim().split(/\s+/, 1)[0]).forEach(value => checkReference(file, value, baseHref, ids, `${tagName}[srcset]`));
  }
}

function auditCss(file) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of matches(source, /url\(\s*(["']?)(.*?)\1\s*\)/gi)) {
    const value = match[2].trim();
    if (!value || /^(?:data:|https?:|#|var\()/i.test(value)) continue;
    checkedReferences += 1;
    const clean = stripQueryAndHash(value);
    const target = path.resolve(path.dirname(file), clean);
    if (!target.startsWith(siteRoot + path.sep) || !fs.existsSync(target)) addError(file, `CSS url target is missing: ${value}`);
  }
}

function auditSitemap(htmlFiles) {
  const sitemapFile = path.join(siteRoot, "sitemap.xml");
  if (!fs.existsSync(sitemapFile)) {
    addError(sitemapFile, "missing sitemap.xml");
    return;
  }

  const sitemap = fs.readFileSync(sitemapFile, "utf8");
  const locations = matches(sitemap, /<loc>\s*(https:\/\/[^<]+)\s*<\/loc>/gi).map(match => match[1].trim());
  const listed = new Set();
  for (const location of locations) {
    if (listed.has(location)) addError(sitemapFile, `duplicate sitemap URL: ${location}`);
    listed.add(location);
    let url;
    try { url = new URL(location); }
    catch {
      addError(sitemapFile, `invalid sitemap URL: ${location}`);
      continue;
    }
    if (!/^(?:www\.)?codexofreality\.org$/i.test(url.hostname) || url.protocol !== "https:") {
      addError(sitemapFile, `non-production sitemap URL: ${location}`);
    }
    if (!fileExistsForUrl(url.pathname)) addError(sitemapFile, `sitemap target is missing: ${location}`);
  }

  const expected = new Set();
  for (const file of htmlFiles) {
    const source = fs.readFileSync(file, "utf8");
    const noindex = matches(source, /<meta\b[^>]*>/gi)
      .map(match => match[0])
      .filter(tag => String(attribute(tag, "name") || "").toLowerCase() === "robots")
      .some(tag => /(?:^|[,\s])noindex(?:[,\s]|$)/i.test(attribute(tag, "content") || ""));
    const canonicalTag = matches(source, /<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*>/gi)[0]?.[0] || "";
    const canonical = attribute(canonicalTag, "href");
    if (!canonical) continue;
    let canonicalUrl;
    try { canonicalUrl = new URL(canonical); } catch { continue; }
    const route = relative(file) === "index.html" ? "/" : `/${relative(file)}`;
    if (!noindex && canonicalUrl.pathname === route) expected.add(`https://codexofreality.org${route}`);
  }

  for (const location of expected) {
    if (!listed.has(location)) addError(sitemapFile, `indexable canonical page is missing: ${location}`);
  }
  for (const location of listed) {
    const normalized = location.replace("https://www.codexofreality.org", "https://codexofreality.org");
    if (!expected.has(normalized)) addError(sitemapFile, `URL is noindex, non-canonical, or outside the deployed page set: ${location}`);
  }
}

if (!fs.existsSync(siteRoot)) {
  console.error("Site audit failed: docs/ was not found.");
  process.exit(2);
}

const htmlFiles = walk(siteRoot, file => file.endsWith(".html"));
const cssFiles = walk(path.join(siteRoot, "assets", "css"), file => file.endsWith(".css"));
htmlFiles.forEach(auditHtml);
cssFiles.forEach(auditCss);
auditSitemap(htmlFiles);

console.log(`Site audit: ${htmlFiles.length} HTML pages, ${cssFiles.length} stylesheets, ${checkedReferences} local references.`);
if (warnings.length) {
  console.log(`Warnings (${warnings.length}):`);
  warnings.forEach(message => console.log(`  - ${message}`));
}
if (errors.length) {
  console.error(`Errors (${errors.length}):`);
  errors.forEach(message => console.error(`  - ${message}`));
  process.exitCode = 1;
} else {
  console.log("Result: PASS — no structural, metadata, sitemap, duplicate-ID, or local-reference failures.");
}
