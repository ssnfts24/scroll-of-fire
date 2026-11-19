"use strict";

/*
 * Living Search — core engine (no DOM, no network).
 *
 * The same file runs in the browser and in Node tests. It consumes the
 * sharded index built by scripts/build-search-index.mjs and ranks with
 * field-weighted BM25: title (×5) over headings (×3) over body (×1).
 *
 * Text rules intentionally mirror docs/scroll/assets/search-normalize.js
 * so a query behaves the same here as in Scroll Search: Unicode NFKD,
 * combining marks (Hebrew niqqud and cantillation, Latin diacritics)
 * removed, Hebrew final letters folded to medial forms, apostrophes
 * dropped, everything lower-cased. Normalization is for matching only;
 * the text a reader sees is never altered.
 *
 * Query fallbacks, in order, per token: exact term → prefix expansion
 * (as-you-type) → transliteration key (lets "bereshit" meet the Hebrew
 * lexicon) → fuzzy edit-distance over trigram candidates. A token that
 * resolves through a fallback scores at a reduced factor.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LivingSearchCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const FINALS = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFKD")
      .replace(/\p{M}+/gu, "")
      .replace(/[ךםןףץ]/g, letter => FINALS[letter])
      .replace(/[‘’ʼ'`]/g, "")
      .toLocaleLowerCase("en")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  }

  function tokenize(value) {
    const normalized = normalize(value);
    return normalized ? normalized.split(" ") : [];
  }

  function hasHebrew(value) {
    return /[֐-׿]/.test(String(value ?? ""));
  }

  /* Same folding as the Scroll lexicon: a search aid, not a linguistic claim. */
  function transliterationKey(value) {
    let text = normalize(value).replace(/ /g, "");
    const folds = [
      [/tz|ts|ẓ/g, "ts"],
      [/ch|kh|x/g, "h"],
      [/ph/g, "f"],
      [/th/g, "t"],
      [/sh/g, "s"],
      [/[qc]/g, "k"],
      [/w/g, "v"],
      [/[aeiou]/g, ""],
      [/(.)\1+/g, "$1"]
    ];
    for (const [pattern, replacement] of folds) text = text.replace(pattern, replacement);
    return text;
  }

  const FIELD_WEIGHTS = { t: 5, h: 3, b: 1 };
  const FIELD_NAMES = ["t", "h", "b"];
  const K1 = 1.2;
  const B = 0.75;

  function createIndex() {
    return {
      docs: [],
      /* term -> Map(docIndex -> [tfTitle, tfHeadings, tfBody]) */
      postings: new Map(),
      /* transliteration key -> Set(docIndex) */
      keyPostings: new Map(),
      fieldLengths: { t: 0, h: 0, b: 0 },
      docFieldLengths: []
    };
  }

  function addDocuments(index, docs) {
    for (const doc of docs) {
      const docIndex = index.docs.length;
      index.docs.push(doc);
      const lengths = { t: 0, h: 0, b: 0 };
      FIELD_NAMES.forEach((field, fieldIndex) => {
        const tokens = tokenize(doc[field] || "");
        lengths[field] = tokens.length;
        index.fieldLengths[field] += tokens.length;
        const counts = new Map();
        for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
        for (const [token, tf] of counts) {
          if (!index.postings.has(token)) index.postings.set(token, new Map());
          const posting = index.postings.get(token);
          if (!posting.has(docIndex)) posting.set(docIndex, [0, 0, 0]);
          posting.get(docIndex)[fieldIndex] = tf;
        }
      });
      index.docFieldLengths.push(lengths);
      for (const key of doc.k || []) {
        if (!index.keyPostings.has(key)) index.keyPostings.set(key, new Set());
        index.keyPostings.get(key).add(docIndex);
      }
    }
    return index;
  }

  function idf(index, df) {
    const n = index.docs.length;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  function bm25Field(index, field, tf, docIndex) {
    const total = index.fieldLengths[field];
    const n = index.docs.length;
    if (!total || !n) return 0;
    const avgdl = total / n;
    const dl = index.docFieldLengths[docIndex][field];
    return (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * (avgdl ? dl / avgdl : 0)));
  }

  function termScore(index, term, docIndex) {
    const posting = index.postings.get(term);
    if (!posting || !posting.has(docIndex)) return 0;
    const tfs = posting.get(docIndex);
    const termIdf = idf(index, posting.size);
    let score = 0;
    FIELD_NAMES.forEach((field, fieldIndex) => {
      if (tfs[fieldIndex]) score += FIELD_WEIGHTS[field] * termIdf * bm25Field(index, field, tfs[fieldIndex], docIndex);
    });
    return score;
  }

  function editDistance(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) {
      const current = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
        rowMin = Math.min(rowMin, current[j]);
      }
      if (rowMin > max) return max + 1;
      previous = current;
    }
    return previous[b.length];
  }

  function trigrams(text) {
    const padded = `  ${text} `;
    const out = new Set();
    for (let i = 0; i + 3 <= padded.length; i += 1) out.add(padded.slice(i, i + 3));
    return out;
  }

  /* Resolve one query token to candidate index terms with score factors. */
  function resolveToken(index, token, isLast) {
    if (index.postings.has(token)) {
      const candidates = [{ term: token, factor: 1 }];
      if (isLast && token.length >= 2) {
        let added = 0;
        for (const term of index.postings.keys()) {
          if (added >= 8) break;
          if (term !== token && term.startsWith(token)) { candidates.push({ term, factor: 0.6 }); added += 1; }
        }
      }
      return candidates;
    }
    if (token.length >= 2) {
      const prefixed = [];
      for (const term of index.postings.keys()) {
        if (term.startsWith(token)) prefixed.push(term);
        if (prefixed.length >= 8) break;
      }
      if (prefixed.length) return prefixed.map(term => ({ term, factor: 0.6 }));
    }
    const key = transliterationKey(token);
    if (key && key !== token && index.keyPostings.has(key)) {
      /* Represent key hits through a synthetic candidate handled by search(). */
      return [{ key, factor: 0.8 }];
    }
    if (token.length >= 3) {
      const maxDistance = token.length <= 5 ? 1 : 2;
      const queryGrams = trigrams(token);
      const scored = [];
      for (const term of index.postings.keys()) {
        if (Math.abs(term.length - token.length) > maxDistance) continue;
        const termGrams = trigrams(term);
        let shared = 0;
        for (const gram of queryGrams) if (termGrams.has(gram)) shared += 1;
        if (!shared) continue;
        const distance = editDistance(token, term, maxDistance);
        if (distance <= maxDistance) scored.push({ term, factor: 0.5, distance, shared });
      }
      scored.sort((a, b) => a.distance - b.distance || b.shared - a.shared || a.term.localeCompare(b.term));
      return scored.slice(0, 5).map(({ term, factor }) => ({ term, factor }));
    }
    return [];
  }

  function search(index, query, options = {}) {
    const tokens = [...new Set(tokenize(query))];
    if (!tokens.length || !index.docs.length) return { results: [], matchedTokens: 0, unresolved: tokens };
    const areas = options.areas ? new Set(options.areas) : null;
    const limit = options.limit ?? 30;
    const scores = new Map();
    const matched = new Map();
    const unresolved = [];
    tokens.forEach((token, position) => {
      const candidates = resolveToken(index, token, position === tokens.length - 1);
      if (!candidates.length) { unresolved.push(token); return; }
      for (const candidate of candidates) {
        if (candidate.key) {
          for (const docIndex of index.keyPostings.get(candidate.key)) {
            /* A transliteration-key hit is a headings-strength match. */
            scores.set(docIndex, (scores.get(docIndex) || 0) + candidate.factor * FIELD_WEIGHTS.h * idf(index, index.keyPostings.get(candidate.key).size));
            if (!matched.has(docIndex)) matched.set(docIndex, new Set());
            matched.get(docIndex).add(token);
          }
          continue;
        }
        const posting = index.postings.get(candidate.term);
        if (!posting) continue;
        for (const docIndex of posting.keys()) {
          scores.set(docIndex, (scores.get(docIndex) || 0) + candidate.factor * termScore(index, candidate.term, docIndex));
          if (!matched.has(docIndex)) matched.set(docIndex, new Set());
          matched.get(docIndex).add(token);
        }
      }
    });
    const phrase = tokens.join(" ");
    const results = [];
    for (const [docIndex, rawScore] of scores) {
      const doc = index.docs[docIndex];
      if (areas && !areas.has(doc.a)) continue;
      let score = rawScore * (1 + 0.1 * Math.max(0, (matched.get(docIndex)?.size || 1) - 1));
      if (tokens.length > 1) {
        if (normalize(doc.t).includes(phrase)) score *= 1.5;
        else if (normalize(doc.b).includes(phrase)) score *= 1.15;
      }
      results.push({ doc, score, matched: [...(matched.get(docIndex) || [])] });
    }
    results.sort((a, b) => b.score - a.score || a.doc.i.localeCompare(b.doc.i));
    return { results: results.slice(0, limit), matchedTokens: tokens.length - unresolved.length, unresolved, total: results.length };
  }

  /*
   * Fold a ranked result list for display. Results that share an
   * identical title within one area become one row: the strongest
   * (first, since the list arrives score-sorted) stays visible and the
   * rest fold under it, in rank order. A result whose title, home
   * (doc.w) and target (doc.u) are all identical to one already seen
   * is a true duplicate and collapses entirely.
   *
   * The grouping key prefers doc.g — the Scroll Library's own
   * duplicateGroups key, carried into the index by the builder — so
   * the folding follows the grouping the library already computed
   * instead of a second, invented one. Documents without a g fall
   * back to their normalized title. A title that normalizes to
   * nothing (pure punctuation) never groups.
   */
  function groupResults(results) {
    const seen = new Set();
    const groups = [];
    const byKey = new Map();
    for (const result of results) {
      const doc = result.doc;
      const duplicateKey = [doc.a, normalize(doc.t), doc.w || "", doc.u].join("|");
      if (seen.has(duplicateKey)) continue;
      seen.add(duplicateKey);
      const titleKey = doc.g || normalize(doc.t);
      const key = titleKey ? `${doc.a}|${titleKey}` : doc.i;
      let group = byKey.get(key);
      if (!group) {
        group = { doc, score: result.score, matched: result.matched, folded: [] };
        byKey.set(key, group);
        groups.push(group);
      } else {
        group.folded.push(result);
      }
    }
    return groups;
  }

  /* Nearest vocabulary terms for a token that resolved to nothing. */
  function suggestTerms(index, token, limit = 3) {
    const normalized = tokenize(token)[0] || "";
    if (!normalized || index.postings.has(normalized)) return [];
    const maxDistance = normalized.length <= 5 ? 1 : 2;
    const queryGrams = trigrams(normalized);
    const scored = [];
    for (const term of index.postings.keys()) {
      if (Math.abs(term.length - normalized.length) > maxDistance + 1) continue;
      const termGrams = trigrams(term);
      let shared = 0;
      for (const gram of queryGrams) if (termGrams.has(gram)) shared += 1;
      if (!shared) continue;
      const distance = editDistance(normalized, term, maxDistance + 1);
      if (distance <= maxDistance + 1) scored.push({ term, distance, shared });
    }
    scored.sort((a, b) => a.distance - b.distance || b.shared - a.shared || a.term.localeCompare(b.term));
    return scored.slice(0, limit).map(entry => entry.term);
  }

  /*
   * A snippet of the document's own words around the first matched word,
   * with [start, end) ranges (into the returned text) for highlighting.
   * Matching compares normalized words, so pointed Hebrew in the text is
   * found by an unpointed query and the original pointing is preserved.
   */
  function snippetFor(doc, query, radius = 90) {
    const tokens = new Set(tokenize(query));
    const body = String(doc.b || doc.h || doc.t || "");
    if (!body) return { text: "", ranges: [] };
    const words = [...body.matchAll(/\S+/g)];
    let anchor = -1;
    words.forEach((word, i) => {
      if (anchor >= 0) return;
      const normalized = normalize(word[0]);
      if (tokens.has(normalized) || [...tokens].some(token => token.length >= 2 && normalized.startsWith(token))) anchor = i;
    });
    if (anchor < 0) {
      const text = body.slice(0, radius * 2).trim();
      return { text: body.length > text.length ? `${text}…` : text, ranges: [] };
    }
    const anchorStart = words[anchor].index;
    const start = Math.max(0, anchorStart - radius);
    const end = Math.min(body.length, anchorStart + radius);
    const text = `${start > 0 ? "…" : ""}${body.slice(start, end).trim()}${end < body.length ? "…" : ""}`;
    const ranges = [];
    for (const word of text.matchAll(/\S+/g)) {
      const normalized = normalize(word[0].replace(/^…|…$/g, ""));
      if (tokens.has(normalized) || [...tokens].some(token => token.length >= 2 && normalized.startsWith(token))) {
        ranges.push([word.index, word.index + word[0].length]);
      }
    }
    return { text, ranges };
  }

  return {
    normalize, tokenize, hasHebrew, transliterationKey,
    createIndex, addDocuments, search, groupResults, suggestTerms, snippetFor,
    FIELD_WEIGHTS
  };
});
