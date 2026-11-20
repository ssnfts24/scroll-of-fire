/*
 * The Codex Guide — the record, server-side.
 *
 * The talking rung answers from the same corpus the record-only
 * Guide (Rung 2) uses: the Living Search index shards and the Claim
 * Register, both committed static files in docs/. Retrieval here is
 * the page's own flow, unchanged — LivingSearchCore for passages,
 * CodexGuide's pure functions for claim cards and snippets, and
 * PatternCalendar (the one calendar authority) for calendar answers,
 * computed, never searched. Nothing here keeps a second clock or a
 * second index.
 *
 * The browser modules are loaded in a vm sandbox, the same way the
 * house test suite loads them (see tests/day-telling.test.js).
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const CALENDAR_FILES = [
  "docs/assets/js/calendar/pattern-calendar-version.js",
  "docs/assets/js/calendar/pattern-calendar-data.js",
  "docs/assets/js/calendar/pattern-calendar-format.js",
  "docs/assets/js/calendar/pattern-calendar-boundary.js",
  "docs/assets/js/calendar/pattern-calendar.js"
];

const CORE_FILE = "docs/assets/js/living-search-core.js";
const GUIDE_FILE = "docs/assets/js/codex-guide.js";
const MANIFEST_FILE = "docs/assets/search/manifest.json";
const REGISTER_FILE = "docs/scroll/evidence/claim-register.json";

/*
 * Load the site's own browser modules into one sandbox and return
 * { core, guide, calendar }. `readFile(relativePath)` supplies the
 * file text, so tests and the function share this loader.
 */
export function loadSiteModules(readFile) {
  const context = { Date, Intl, URL, URLSearchParams, console };
  context.globalThis = context;
  context.window = context;
  vm.createContext(context);

  for (const file of CALENDAR_FILES) {
    vm.runInContext(readFile(file), context, { filename: file });
  }

  const loadUmd = file => {
    const module = { exports: {} };
    const sandbox = { ...context, module, exports: module.exports };
    sandbox.globalThis = sandbox;
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(readFile(file), sandbox, { filename: file });
    return sandbox.module.exports;
  };

  return {
    core: loadUmd(CORE_FILE),
    guide: loadUmd(GUIDE_FILE),
    calendar: context.PatternCalendar || null
  };
}

/*
 * Build a corpus from loaded modules plus the index payload.
 * `shards` maps area id -> parsed shard JSON.
 */
export function buildCorpus({ modules, manifest, shards, claims }) {
  const { core, guide, calendar } = modules;
  const index = core.createIndex();

  const areas = Array.isArray(manifest?.areas) ? manifest.areas : [];
  for (const area of areas) {
    const payload = shards[area.id];
    if (payload && Array.isArray(payload.docs)) {
      core.addDocuments(index, payload.docs);
    }
  }

  /* A fingerprint of the sealed sources the index was built from.
   * Stored answers are keyed under it, so when the record changes,
   * yesterday's stored answers retire themselves. */
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(manifest?.sources || {}))
    .digest("hex")
    .slice(0, 16);

  const register = Array.isArray(claims) ? claims : [];

  function retrieve(question, now = new Date()) {
    const intent = guide.parseCalendarIntent(question);
    const calendarAnswer = intent
      ? guide.answerCalendarIntent(intent, { calendar, now })
      : null;

    const claimCards = guide
      .matchClaims(question, register)
      .map(guide.buildClaimCard)
      .filter(Boolean);

    let passages = [];
    let suggestions = [];

    const { results, unresolved } = core.search(index, question, { limit: 30 });
    passages = guide.shapePassages(results, core, question);

    if (!passages.length && unresolved?.length) {
      suggestions = [
        ...new Set(unresolved.flatMap(token => core.suggestTerms(index, token)))
      ].slice(0, 5);
    }

    return { calendar: calendarAnswer, claimCards, passages, suggestions };
  }

  return { index, claims: register, fingerprint, retrieve };
}

/* Read a corpus from a repo-shaped directory on disk. */
export function loadCorpusFromDisk(rootDir) {
  const readFile = relative =>
    fs.readFileSync(path.join(rootDir, relative), "utf8");
  const readJson = relative => JSON.parse(readFile(relative));

  const modules = loadSiteModules(readFile);
  const manifest = readJson(MANIFEST_FILE);

  const shards = {};
  for (const area of manifest.areas || []) {
    const file = area.shard || manifest.shards?.[area.id]?.file;
    if (file) shards[area.id] = readJson(`docs/assets/search/${file}`);
  }

  const register = readJson(REGISTER_FILE);

  return buildCorpus({
    modules,
    manifest,
    shards,
    claims: Array.isArray(register?.claims) ? register.claims : []
  });
}

/*
 * Fallback: read the corpus from the site's own published files.
 * The record the function speaks from is the record the site serves;
 * if the files are not beside the function, they are on the site.
 * (docs/ is the publish root, so repo paths under docs/ map to the
 * same path on the site.)
 */
export async function loadCorpusFromHttp(origin, fetchImpl = fetch) {
  const base = String(origin || "").replace(/\/+$/, "");
  const readRemote = async relative => {
    const url = `${base}/${relative.replace(/^docs\//, "")}`;
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`Corpus fetch failed: ${url}`);
    return response.text();
  };

  const files = [...CALENDAR_FILES, CORE_FILE, GUIDE_FILE, MANIFEST_FILE, REGISTER_FILE];
  const texts = new Map();
  await Promise.all(
    files.map(async file => texts.set(file, await readRemote(file)))
  );

  const manifest = JSON.parse(texts.get(MANIFEST_FILE));
  const shardFiles = new Map();
  await Promise.all(
    (manifest.areas || []).map(async area => {
      const file = area.shard || manifest.shards?.[area.id]?.file;
      if (!file) return;
      const relative = `docs/assets/search/${file}`;
      shardFiles.set(area.id, await readRemote(relative));
    })
  );

  const modules = loadSiteModules(relative => {
    const text = texts.get(relative);
    if (text === undefined) throw new Error(`Module not fetched: ${relative}`);
    return text;
  });

  const shards = {};
  for (const [areaId, text] of shardFiles) shards[areaId] = JSON.parse(text);

  const register = JSON.parse(texts.get(REGISTER_FILE));

  return buildCorpus({
    modules,
    manifest,
    shards,
    claims: Array.isArray(register?.claims) ? register.claims : []
  });
}

/*
 * Candidate on-disk roots for the corpus, in order: an explicit
 * override, then the repo layout relative to this file (the layout
 * the tests run in, and the layout Netlify's included_files mirror).
 */
export function candidateCorpusRoots(moduleUrl) {
  const roots = [];
  if (process.env.GUIDE_CORPUS_ROOT) roots.push(process.env.GUIDE_CORPUS_ROOT);

  const here = path.dirname(fileURLToPath(moduleUrl));
  roots.push(path.resolve(here, "..", "..", "..")); // netlify/functions/lib -> repo root
  roots.push(path.resolve(here, "..", "..")); // functions/lib mirror layouts
  roots.push(process.cwd());

  return [...new Set(roots)];
}

export function corpusRootExists(rootDir) {
  return fs.existsSync(path.join(rootDir, MANIFEST_FILE));
}
