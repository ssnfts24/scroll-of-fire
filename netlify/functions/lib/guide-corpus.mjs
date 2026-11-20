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

import {
  DEFINITIONAL_URLS,
  analyzeQuestion,
  bestPassage,
  buildVocabulary,
  definitionalWeight,
  expansionPhrases,
  headingPhrases
} from "./guide-passages.mjs";

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

  /* The record's own vocabulary, built from the same index the
   * search runs on: titles, claim names, lexicon entries, and the
   * name-like phrases in page headings. Expansions only ever add
   * the record's own words to a search. */
  const vocabulary = buildVocabulary(index.docs, register);

  /*
   * Pair a question with the record. Calendar answers are computed
   * by the one calendar authority and claim cards matched as
   * before; passages are found by the passage-intelligence layer
   * (guide-passages.mjs):
   *
   *   pass 1 — the question as spoken;
   *   pass 2 — the question's subject, expanded with the record's
   *            own vocabulary and with the name-like heading
   *            phrases of the pages pass 1 already surfaced;
   *   merge  — scores combine across passes, definitional
   *            questions weight the pages that define things;
   *   window — each surviving document contributes its best
   *            passage window, and a window qualifies only if it
   *            genuinely carries the question's terms or phrases.
   *
   * All of it is local and deterministic: retrieval makes no
   * provider calls, so the one-provider-call-per-question economy
   * and the answer cache are untouched.
   */
  function retrieve(question, now = new Date()) {
    const intent = guide.parseCalendarIntent(question);
    const calendarAnswer = intent
      ? guide.answerCalendarIntent(intent, { calendar, now })
      : null;

    const claimCards = guide
      .matchClaims(question, register)
      .map(guide.buildClaimCard)
      .filter(Boolean);

    const analysis = analyzeQuestion(core, question);

    const first = core.search(index, question, { limit: 30 });

    /* Expansion phrases: near-named vocabulary, plus the heading
     * names of the strongest first-pass pages. */
    const expansions = expansionPhrases(analysis, vocabulary);
    const mined = [];
    for (const result of first.results.slice(0, 3)) {
      for (const entry of headingPhrases(result.doc)) {
        const normalized = core.normalize(entry.phrase);
        if (
          normalized &&
          !core.normalize(question).includes(normalized) &&
          !mined.some(item => item.normalized === normalized)
        ) {
          mined.push({ phrase: entry.phrase, tokens: entry.tokens, normalized });
        }
      }
      if (mined.length >= 2) break;
    }

    const secondQuery = [
      analysis.subject,
      ...expansions.filter(entry => !entry.exact).map(entry => entry.phrase),
      ...mined.slice(0, 2).map(entry => entry.phrase)
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    const merged = new Map();
    const mergePass = (results, weight) => {
      for (const result of results) {
        const key = result.doc.i;
        const existing = merged.get(key);
        if (existing) existing.score += weight * result.score;
        else merged.set(key, { doc: result.doc, score: weight * result.score, matched: result.matched });
      }
    };
    mergePass(first.results, 1);
    if (secondQuery && core.normalize(secondQuery) !== core.normalize(question)) {
      mergePass(core.search(index, secondQuery, { limit: 30 }).results, 0.9);
    }

    for (const entry of merged.values()) {
      entry.score *= definitionalWeight(entry.doc, analysis);
    }

    const ranked = [...merged.values()].sort((a, b) => b.score - a.score);
    const groups =
      typeof core.groupResults === "function" ? core.groupResults(ranked) : ranked;

    /* The window-scoring vocabulary. The question's own terms are
     * the heavy signal; the bridged vocabulary (near-named phrases
     * and the heading names mined from the first-pass pages) ranks
     * lightly and never qualifies a window alone. Phrases are the
     * subject and the record's canonical phrases for it — mined
     * heading phrases are excluded on purpose: a page's contents
     * list contains them all, and crowning it was the original
     * failure. */
    const questionTerms = [
      ...new Set([...analysis.terms, ...analysis.subjectTokens])
    ];
    const questionTermSet = new Set(questionTerms);
    const expansionTerms = [
      ...new Set([
        ...expansions.flatMap(entry => entry.tokens),
        ...mined.flatMap(entry => entry.tokens)
      ])
    ].filter(token => !questionTermSet.has(token));
    const windowPhrases = [
      ...new Set(
        [analysis.subject, ...expansions.map(entry => entry.phrase)]
          .map(phrase => core.normalize(phrase || ""))
          .filter(phrase => phrase.length >= 3)
      )
    ];
    const context = {
      normalize: core.normalize,
      tokenize: core.tokenize,
      terms: questionTerms,
      expansionTerms,
      phrases: windowPhrases,
      definitional: analysis.definitional
    };

    const AREA_LABELS = {
      pages: "Page",
      scrolls: "Scroll",
      lexicon: "Hebrew Lexicon",
      claims: "Claim Register",
      atlas: "Codex Atlas"
    };

    const passages = [];
    for (const group of groups.slice(0, 8)) {
      const doc = group.doc || {};
      const window = bestPassage(doc.b || doc.h || doc.t || "", context);
      if (!window.text || (window.termHits < 1 && window.phraseHits < 1)) continue;
      passages.push({
        title: doc.t || "Untitled",
        area: doc.a || "",
        areaLabel: AREA_LABELS[doc.a] || doc.a || "Record",
        url: doc.u || null,
        snippet: window.snippet,
        text: window.text,
        isLexicon: doc.a === "lexicon",
        folded: Array.isArray(group.folded) ? group.folded.length : 0,
        quality: window.score + Math.log1p(Math.max(0, group.score || 0))
      });
      if (passages.length >= 12) break;
    }
    /* Definitional routing, made concrete: for a "what is X"
     * question, the pages whose job is to define things are read
     * directly, whatever the ranking said — a single-term question
     * floods the ranking with chapters that merely carry the term
     * in their titles, while the Glossary's own definition sits in
     * a long page's body where term ranking cannot see it. A
     * defining page joins the passages only when its own window
     * earns it: the question's term, stated definitionaly. */
    if (analysis.definitional) {
      const present = new Set(passages.map(passage => passage.url));
      for (const url of DEFINITIONAL_URLS) {
        if (present.has(url)) continue;
        const doc = index.docs.find(candidate => candidate.u === url);
        if (!doc) continue;
        const window = bestPassage(doc.b || doc.h || doc.t || "", context);
        if (!window.text || window.termHits < 1 || window.score < 8) continue;
        passages.push({
          title: doc.t || "Untitled",
          area: doc.a || "",
          areaLabel: AREA_LABELS[doc.a] || doc.a || "Record",
          url: doc.u || null,
          snippet: window.snippet,
          text: window.text,
          isLexicon: doc.a === "lexicon",
          folded: 0,
          quality: window.score + 8
        });
      }
    }

    passages.sort((a, b) => b.quality - a.quality);

    /* A heading with nothing under it is not a passage. Windows
     * too thin to say anything are dropped while anything
     * substantive remains. */
    const substantive = passages.filter(passage => (passage.text || "").length >= 50);
    const topPassages = (substantive.length ? substantive : passages)
      .slice(0, 5)
      .map(({ quality, ...passage }) => passage);

    let suggestions = [];
    if (!topPassages.length && first.unresolved?.length) {
      suggestions = [
        ...new Set(first.unresolved.flatMap(token => core.suggestTerms(index, token)))
      ].slice(0, 5);
    }

    return { calendar: calendarAnswer, claimCards, passages: topPassages, suggestions };
  }

  return { index, claims: register, fingerprint, retrieve, vocabularySize: vocabulary.length };
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
