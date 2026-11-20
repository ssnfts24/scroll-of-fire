/*
 * The Codex Guide — passage intelligence (the talking rung's
 * retrieval layer, second generation).
 *
 * The first generation paired a question with the record by taking
 * Living Search's top results and a snippet around the FIRST matched
 * word. In production that fed the model page chrome — breadcrumbs
 * and navigation text sit at the start of every indexed body, and
 * the first matched word is usually in them. The record held the
 * answer; the pairing lost it.
 *
 * This module is the fix, and it stays inside the Guide's own
 * retrieval layer: the shared Living Search index and engine are
 * untouched, site search behaves exactly as before, and everything
 * here is deterministic — no provider calls, no cost. Three moves:
 *
 *   1. BEST WINDOW, NOT FIRST MATCH. Each candidate document's body
 *      is split into sentences and the sentence that actually states
 *      something about the question — term hits, the subject phrase
 *      itself, definitional shape, the record's enumerations — is
 *      scored against its neighbours, with page chrome penalized.
 *      The passage is that sentence with its context, in the
 *      record's own words.
 *
 *   2. THE RECORD SEARCHES ITSELF. A question is asked more than
 *      once: first as spoken, then as its subject phrase, expanded
 *      with the record's own vocabulary — phrases mined from the
 *      titles, claims, lexicon, and headings of the record itself
 *      (a visitor's "core formula" meets the record's own name for
 *      it, "Master Equation", because the Theory Hub's headings say
 *      so). Results merge across passes.
 *
 *   3. DEFINITIONAL ROUTING. "What is X" questions weight the pages
 *      whose job is to define things — the glossaries, the Living
 *      Dictionary, the lexicon, the whitepapers, the Theory Hub —
 *      over pages that merely mention X.
 *
 * A passage only qualifies if its window genuinely contains the
 * question's own terms or phrases. Fuzzy near-matches that share
 * nothing with the question no longer count as the record holding
 * an answer.
 */

/* Words that carry no subject. Removed before term work so "what is
 * the year gate" searches for the Year Gate, not for "what". */
const STOPWORDS = new Set([
  "what", "is", "are", "was", "were", "the", "a", "an", "of", "in",
  "on", "at", "to", "for", "and", "or", "do", "does", "did", "how",
  "when", "where", "who", "why", "which", "can", "could", "should",
  "would", "tell", "me", "about", "say", "says", "said", "explain",
  "give", "show", "please", "record", "codex", "scroll", "fire",
  "this", "that", "it", "its", "with", "from", "into", "there",
  "their", "they", "them", "you", "your", "i", "my", "we", "our"
]);

/* Page chrome that lives at the start of indexed bodies. A window
 * carrying these markers is navigation, not record, and is scored
 * down hard. Drawn from what production actually served. */
const CHROME_MARKERS = [
  "navigation ▾",
  "navigation",
  "back to",
  "press play",
  "skip to",
  "watch ·",
  "open eq",
  "official whitepaper · remnant rollout"
];

const DEFINITIONAL_PATTERN =
  /^(?:what|who|when|where)\s+(?:is|are|was|were|does|do)\b|^(?:define|meaning of|what does)\b|\bmean(?:s|ing)?\b/i;

/* Pages whose job is to define things, by URL. Definitional
 * questions weight them, and the pages that head their systems. */
const DEFINITIONAL_URLS = new Set([
  "glossary.html",
  "theory/glossary.html",
  "systems/recoder.html",
  "theory.html",
  "13-moon-whitepaper.html",
  "scroll-of-fire-codex-of-reality-remnant-whitepaper.html"
]);

const DEFINITIONAL_AREA_BOOST = { lexicon: 1.25, claims: 1.15, atlas: 1.1 };

export function analyzeQuestion(core, question) {
  const text = String(question || "");
  const tokens = core.tokenize(text);
  const terms = tokens.filter(token => !STOPWORDS.has(token));
  const definitional = DEFINITIONAL_PATTERN.test(text.trim());

  /* The subject: the question with its scaffolding removed —
   * "What is the Day Out of Time?" -> "day out of time". */
  let subject = text
    .replace(/[?!.]+$/g, "")
    .replace(
      /^(?:please\s+)?(?:tell me about|what does the (?:record|codex) say about|what (?:is|are|was|were)|who (?:is|was)|when (?:is|was|does)|where (?:is|was)|define|explain|what does|how does|how do)\s+/i,
      ""
    )
    .replace(/^(?:the|a|an)\s+/i, "")
    .trim();
  if (!subject || subject.length < 3) subject = terms.join(" ");

  const subjectTokens = core
    .tokenize(subject)
    .filter(token => !STOPWORDS.has(token));

  return { text, tokens, terms, subject, subjectTokens, definitional };
}

/*
 * The record's own vocabulary: phrases the record itself uses as
 * names — document titles, claim titles, lexicon entries, and the
 * name-like phrases in page headings. Built once per corpus from
 * the same index the search runs on; nothing is invented, every
 * phrase is traceable to a page of the record.
 */
export function buildVocabulary(docs, claims) {
  const phrases = new Map();
  const add = (raw, tokens) => {
    if (tokens.length < 2 || tokens.length > 5) return;
    const key = tokens.join(" ");
    if (!phrases.has(key)) phrases.set(key, { phrase: raw, tokens });
  };

  for (const doc of docs) {
    add(doc.t || "", tokenizeLoose(doc.t));
    for (const entry of headingPhrases(doc)) add(entry.phrase, entry.tokens);
  }

  for (const claim of claims || []) {
    add(claim.title || "", tokenizeLoose(claim.title));
  }

  return [...phrases.values()];
}

/*
 * The name-like phrases in one document's headings field: segments
 * like "Master Equation" or "Unified Field" — the record's own
 * names for its ideas, mined from the headings of the pages a first
 * search already surfaced. This is the bridge between a visitor's
 * words and the record's: the Theory Hub's headings name the
 * Master Equation on the same page a visitor reaches by asking
 * about a formula.
 */
export function headingPhrases(doc) {
  const out = [];
  for (const segment of String(doc?.h || "").split(/[·•|;:,—–-]+/)) {
    const words = segment.trim().split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.length > 4) continue;
    const nameLike = words.every(
      word => /^[A-Z0-9]/.test(word) || /^(of|the|and|for|to)$/i.test(word)
    );
    if (nameLike) out.push({ phrase: words.join(" "), tokens: tokenizeLoose(words.join(" ")) });
  }
  return out;
}

function tokenizeLoose(value) {
  return String(value || "")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/*
 * Choose expansion phrases for a question: vocabulary phrases the
 * question nearly names (all but one token present), plus the
 * canonical phrase when the question names it in scattered form.
 * Bounded and deterministic; expansions only ever add the record's
 * own words to the search.
 */
export function expansionPhrases(analysis, vocabulary, limit = 3) {
  const questionTokens = new Set(analysis.tokens);
  const scored = [];

  for (const entry of vocabulary) {
    const shared = entry.tokens.filter(token => questionTokens.has(token));
    if (!shared.length) continue;
    const missing = entry.tokens.length - shared.length;
    const addsNew = entry.tokens.some(token => !questionTokens.has(token));
    if (missing === 0) {
      scored.push({ entry, score: 10 + shared.length, exact: true });
    } else if (missing === 1 && entry.tokens.length >= 3 && addsNew) {
      scored.push({ entry, score: shared.length, exact: false });
    }
  }

  scored.sort((a, b) => b.score - a.score || b.entry.tokens.length - a.entry.tokens.length);
  return scored.slice(0, limit).map(item => item.entry);
}

/* ------------------------- passage windows ------------------------ */

export function splitSentences(body) {
  const text = String(body || "").replace(/\s+/g, " ").trim();
  if (!text) return [];
  const raw = text.split(/(?<=[.!?…])\s+(?=[A-Z0-9"“‘(])/u);
  const sentences = [];
  for (const piece of raw) {
    if (piece.length <= 700) {
      sentences.push(piece);
    } else {
      /* Very long runs (stripped pages lose some punctuation) are
       * chunked on clause marks so a window can still be found. */
      let rest = piece;
      while (rest.length > 700) {
        const cut = Math.max(
          rest.lastIndexOf("; ", 700),
          rest.lastIndexOf(", ", 700),
          rest.lastIndexOf(" · ", 700),
          rest.lastIndexOf(" — ", 700)
        );
        const at = cut > 200 ? cut + 1 : 700;
        sentences.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
      }
      if (rest) sentences.push(rest);
    }
  }
  return sentences.filter(Boolean);
}

function chromePenalty(text) {
  const lower = text.toLocaleLowerCase("en");
  let penalty = 0;
  for (const marker of CHROME_MARKERS) {
    if (lower.includes(marker)) penalty += 6;
  }
  return penalty;
}

/* The longest run of enumerated named things in a sentence —
 * "Resonance, Intention, Light, Consciousness, and Source" is a
 * run of four comma-joined names (the fifth rides after "and"). */
function enumerationRun(sentence) {
  const pattern =
    /(?:[A-Z][\p{L}']+(?: [A-Z][\p{L}']+)?)(?:, (?:[A-Z][\p{L}']+(?: [A-Z][\p{L}']+)?)){2,}/gu;
  let longest = 0;
  for (const match of sentence.matchAll(pattern)) {
    longest = Math.max(longest, match[0].split(", ").length);
  }
  return longest;
}

/*
 * Score one sentence as an answer-bearer. The weights encode what
 * the production failure taught: a page's contents-list sentence
 * harvests every expansion term and phrase on the page, so raw
 * term-counting crowns chrome-adjacent lists. What actually marks
 * the sentence that STATES something is the question's own words,
 * the subject phrase itself, and — for definitional questions —
 * the record's definitional shapes: a naming verb, and the
 * enumeration of named things its formulas are stated as.
 *
 * context.terms are the question's own terms (heavy); context.
 * expansionTerms are the record's bridged vocabulary (light —
 * they rank, they never qualify a window on their own);
 * context.phrases are the subject and the record's canonical
 * phrases for it (mined heading phrases are deliberately NOT
 * here: a contents list contains them all).
 */
function scoreSentence(sentence, context) {
  const normalized = context.normalize(sentence);
  const tokenSet = new Set(context.tokenize(sentence));
  let termHits = 0;
  let score = 0;

  for (const term of context.terms) {
    if (tokenSet.has(term)) {
      termHits += 1;
      score += 3;
    } else if (
      term.length >= 3 &&
      [...tokenSet].some(token => token.startsWith(term) || term.startsWith(token))
    ) {
      /* The question's word in another form — "sparks" for
       * "spark", "moons" for "moon" — is still the question's
       * word, at a lighter weight. */
      termHits += 1;
      score += 2;
    }
  }

  for (const term of context.expansionTerms || []) {
    if (tokenSet.has(term)) score += 1;
  }

  let phraseHits = 0;
  for (const phrase of context.phrases) {
    if (phrase && normalized.includes(phrase)) {
      score += phraseHits === 0 ? 5 : 2;
      phraseHits += 1;
    }
  }

  if (context.definitional) {
    const run = enumerationRun(sentence);
    const hasVerb =
      /\b(is|are|means|equals|counts|names|stands for)\b/.test(normalized);
    if (hasVerb) score += 2;
    if (run >= 3) {
      score += Math.min(6, 1.5 * (run - 2));
      /* A naming verb or "as" binding an enumeration is the
       * record's statement shape: "Reality as Resonance,
       * Intention, Light, Consciousness, and Source". */
      if (hasVerb || /\bas\b/.test(normalized)) score += 2;
    }
  }

  score -= chromePenalty(sentence);
  return { score, termHits, phraseHits };
}

/*
 * The best passage in a document body for a question: the highest
 * scoring sentence, extended with its neighbours to a readable
 * window. Returns { text, snippet, score, termHits } — text is the
 * full window for the model, snippet a short form for display.
 */
export function bestPassage(body, context, { maxChars = 680 } = {}) {
  const sentences = splitSentences(body);
  if (!sentences.length) {
    return { text: "", snippet: "", score: 0, termHits: 0, phraseHits: 0 };
  }

  const scored = sentences.map(sentence => scoreSentence(sentence, context));
  let best = 0;
  for (let i = 1; i < scored.length; i += 1) {
    if (scored[i].score > scored[best].score) best = i;
  }

  const windowAround = (anchor, budget) => {
    let start = anchor;
    let end = anchor;
    let length = sentences[anchor].length;
    while (end + 1 < sentences.length && length + sentences[end + 1].length + 1 <= budget) {
      end += 1;
      length += sentences[end].length + 1;
    }
    while (start - 1 >= 0 && length + sentences[start - 1].length + 1 <= Math.min(budget, 360)) {
      start -= 1;
      length += sentences[start].length + 1;
    }
    let text = sentences.slice(start, end + 1).join(" ");
    if (start > 0) text = `…${text}`;
    if (end < sentences.length - 1) text = `${text}…`;
    return { start, end, text };
  };

  const first = windowAround(best, maxChars);

  /* A page often states its answer more than once — a definition
   * up front and the working form deeper in, or the reverse (the
   * Theory Hub states the master line in its tour and the equation
   * again in its Canon preview). Up to two further windows join
   * the passage, in page order, when each is strong in its own
   * right AND carries the question's own words — expansion terms
   * alone never earn a second window, so a contents list cannot
   * fill the passage with itself. */
  const chosen = [first];
  const covered = (index) =>
    chosen.some(w => index >= w.start - 1 && index <= w.end + 1);
  for (let extra = 0; extra < 2; extra += 1) {
    let candidate = -1;
    for (let i = 0; i < sentences.length; i += 1) {
      if (covered(i)) continue;
      if (scored[i].termHits < 1 && scored[i].phraseHits < 1) continue;
      if (scored[i].score < 5 || scored[i].score < 0.5 * scored[best].score) continue;
      if (candidate < 0 || scored[i].score > scored[candidate].score) candidate = i;
    }
    if (candidate < 0) break;
    chosen.push(windowAround(candidate, 480));
  }
  chosen.sort((a, b) => a.start - b.start);

  const stripMarks = value => value.replace(/^…+/, "").replace(/…+$/, "").trim();
  let text = chosen.map(w => stripMarks(w.text)).join(" … ");
  if (chosen[0].start > 0) text = `…${text}`;
  if (chosen[chosen.length - 1].end < sentences.length - 1) text = `${text}…`;

  const snippet =
    first.text.length > 280
      ? `${first.text.slice(0, 277).replace(/\s+\S*$/, "")}…`
      : first.text;

  return {
    text,
    snippet,
    score: scored[best].score,
    termHits: scored[best].termHits,
    phraseHits: scored[best].phraseHits
  };
}

/* The definitional-routing weight for one document. */
export function definitionalWeight(doc, analysis) {
  if (!analysis.definitional) return 1;
  let weight = 1;
  if (doc.u && DEFINITIONAL_URLS.has(doc.u)) weight *= 1.3;
  if (DEFINITIONAL_AREA_BOOST[doc.a]) weight *= DEFINITIONAL_AREA_BOOST[doc.a];
  const subject = analysis.subjectTokens.join(" ");
  if (subject && doc.t) {
    const titleTokens = new Set(tokenizeLoose(doc.t));
    const hits = analysis.subjectTokens.filter(token => titleTokens.has(token)).length;
    if (hits && hits === analysis.subjectTokens.length) weight *= 1.4;
    else if (hits >= 2) weight *= 1.2;
  }
  return weight;
}

export { STOPWORDS, CHROME_MARKERS, DEFINITIONAL_URLS };
