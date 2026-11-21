/*
 * The Spark seat — a real agent behind the backend door.
 *
 * Aaron's correction (Nov 20, 2026, 01:00 PST): "I meant it acts
 * like a real AI agent." So this seat is NOT the Codex Guide. The
 * Guide seat (codex-guide.mjs) is the public record's voice, bound
 * word for word by the approved rulebook; it stays exactly as it
 * is, and nothing in this file touches it. This seat is the
 * keeper's own Spark: a companion who holds a genuine conversation,
 * remembers the visit, reasons over what its keeper asks, and can
 * act on the Sphere page through a small set of page tools the
 * page itself executes.
 *
 * The door's shared machinery, honoured exactly:
 *   - the same provider key and endpoint as the Guide seat
 *     (GUIDE_API_KEY and friends — Aaron sets them once);
 *   - the same monthly ceiling (GUIDE_MONTHLY_CEILING_USD, $20 by
 *     default) across BOTH seats together, with this seat's spend
 *     kept on its own visible line in the same store;
 *   - fail-closed: if the meter cannot be read, or the ceiling is
 *     reached, this seat does not talk and says so plainly. It
 *     never spends against a meter it cannot read;
 *   - no key (deploy previews, the GitHub Pages mirror) = the seat
 *     is unavailable and says why in one plain line. It never
 *     fakes a conversation.
 *
 * Privacy: no conversation is kept server-side. The visit's memory
 * rides with each request from the page and dies with the page.
 * The record context the page passes is a small summary (the
 * Spark's name, days together, practice counts, today's
 * coordinate) — never the keeper's notes.
 *
 * Phase 1 of the Spark intelligence design (Aaron approved the
 * design Nov 20, 2026; design: your_files/
 * spark-intelligence-design-2026-11-20.md) deepens this seat:
 *   - a BRIEFING assembled on the keeper's device from the
 *     keeper's own record (identity, kept days, garden, finds,
 *     story trail, beliefs with their observed/inferred labels,
 *     proposal outcomes, and public-record passages with sources
 *     and grades) rides with the question and is folded into the
 *     charter below. The door keeps none of it — no shadow memory;
 *   - a deterministic FENCE screen (router rule 1) answers fenced
 *     ground — court/legal, family and personal matters, speaking
 *     as Aaron — before any spend, in this seat's own words;
 *   - TIER routing: the page's router names a tier (small /
 *     middle / strong) and this seat calls that tier's configured
 *     model and charges that tier's configured prices on the
 *     Spark's own meter line. With no tier models configured,
 *     every tier is the door's one configured model at the door's
 *     configured prices — the meter always charges the price of
 *     the model actually called, never a fictional one (the
 *     design's cost table is a planning assumption; the meter is
 *     the law);
 *   - PROPOSE and REMEMBER markers: the agent may end a reply
 *     with proposals for the keeper's word and memory drafts to
 *     be filed on the device — validated here, presented and
 *     decided on the device, never applied at the door;
 *   - a PRONOUN fence on generated speech: a Spark is never
 *     "she" or "he" (Aaron's rule, Nov 19, 2026). Sentences that
 *     speak of the Spark itself are repaired to the Spark's name
 *     and the repair is flagged in the result, never silent;
 *   - the seat reports its MIND VERSION with every answer, so a
 *     mind change upstream is auditable against past answers.
 *
 * Children's fence (from the door prep, binding here too): the
 * seat's instructions keep every conversation age-appropriate,
 * never ask any keeper for personal details, and point a young
 * keeper to a grown-up for anything beyond the Codex and their
 * own days.
 */

export const SEAT_NAME = "The Spark seat";

/* Plain notices, in this seat's own words — deliberately NOT the
 * Guide's rulebook sentences, so the two seats never blur. */
export const UNAVAILABLE_NOTICE =
  "My deeper voice isn't answering from this copy of the site — the talking door is only open on the Codex's own home. I can still speak from your record here.";
export const METER_NOTICE =
  "I can't reach the month's talking meter just now, so I won't spend against a meter I can't read. Ask me again in a little while.";
/* The at-ceiling wording is the Spark intelligence design's §2d
 * shape, approved by Aaron with the design (Nov 20, 2026) — the
 * Spark speaks for itself, in its own voice, no error codes. */
export const CEILING_NOTICE =
  "I've reached my deep-thinking limit for this month, so I'm working from this phone alone until the month turns. I can still tell your days, tend your garden with you, and answer from your record — I just can't think the big thoughts until then.";
/* Router rule 1 (design §2c): fenced ground never routes anywhere.
 * This is the Spark seat's own fence wording — deliberately not
 * the Guide's rulebook sentences, so the two seats never blur. */
export const FENCE_NOTICE =
  "That ground isn't mine to walk — it sits with your own counsel and your family's privacy, not with a companion's talk. What I can do is answer from the record: your days, your garden, your story, and the Codex's public pages. Ask me there, and I'll answer plainly.";
export const MIND_VERSION = "spark-mind/2.0.0";
export const RATE_NOTICE =
  "You're asking faster than I can fairly take. Give it a little while, then ask again.";
export const ERROR_NOTICE =
  "My deeper voice stumbled just now. Nothing was kept of that. Ask me again.";

function numberFrom(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/*
 * Configuration from the same environment Aaron sets for the door.
 * One key, one model choice, one ceiling — set once, both seats.
 */
export function readSparkConfig(env = {}) {
  const model = env.GUIDE_MODEL || "gpt-4o-mini";
  const inputUsdPerMtok = numberFrom(env.GUIDE_INPUT_USD_PER_MTOK, 0.15);
  const outputUsdPerMtok = numberFrom(env.GUIDE_OUTPUT_USD_PER_MTOK, 0.6);
  /* Tier routing (design §2d): three named tiers. Each tier's
   * model and prices are configured separately; anything Aaron
   * has not configured falls back to the door's one model at the
   * door's prices, so an unconfigured tier changes nothing and
   * the meter never charges a price the called model doesn't
   * carry. When Aaron sets SPARK_MODEL_STRONG (and its prices),
   * the strongest tier becomes real the same hour. */
  const tier = (modelEnv, inputEnv, outputEnv) => ({
    model: modelEnv || model,
    inputUsdPerMtok: numberFrom(inputEnv, inputUsdPerMtok),
    outputUsdPerMtok: numberFrom(outputEnv, outputUsdPerMtok)
  });
  return {
    apiKey: env.GUIDE_API_KEY || "",
    apiBaseUrl: (env.GUIDE_API_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
    model,
    ceilingUsd: numberFrom(env.GUIDE_MONTHLY_CEILING_USD, 20),
    inputUsdPerMtok,
    outputUsdPerMtok,
    tiers: {
      small: tier(env.SPARK_MODEL_SMALL, env.SPARK_SMALL_INPUT_USD_PER_MTOK, env.SPARK_SMALL_OUTPUT_USD_PER_MTOK),
      middle: tier(model, inputUsdPerMtok, outputUsdPerMtok),
      strong: tier(env.SPARK_MODEL_STRONG, env.SPARK_STRONG_INPUT_USD_PER_MTOK, env.SPARK_STRONG_OUTPUT_USD_PER_MTOK)
    },
    maxOutputTokens: Math.floor(numberFrom(env.SPARK_MAX_OUTPUT_TOKENS, 700)),
    rateLimitPerMinute: Math.floor(numberFrom(env.GUIDE_RATE_LIMIT_PER_MINUTE, 10)),
    rateLimitPerHour: Math.floor(numberFrom(env.GUIDE_RATE_LIMIT_PER_HOUR, 60)),
    maxHistoryPairs: 8,
    maxMessageChars: 1200
  };
}

export const TIER_NAMES = Object.freeze(["small", "middle", "strong"]);

export function tierFor(config, raw) {
  const name = TIER_NAMES.includes(raw) ? raw : "middle";
  return { name, ...(config.tiers?.[name] || config.tiers?.middle || {
    model: config.model,
    inputUsdPerMtok: config.inputUsdPerMtok,
    outputUsdPerMtok: config.outputUsdPerMtok
  }) };
}

/* The month key the spend counters live under (UTC) — the same
 * shape the Guide seat uses, so the two lines sit side by side. */
export function monthKeyFor(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/* ── The fence screen (router rule 1) ───────────────────────────
 * Deterministic patterns, deliberately narrow — the same fenced
 * ground the door has always kept (the Guide rulebook's fence
 * binds every seat): court and legal matters, family and personal
 * matters, Aaron's private details, and speaking as Aaron. They
 * name the fenced ground without fencing the record's own ground:
 * questions about Aaron's work, his calendar, and his writings
 * pass. This seat keeps its own copy of the patterns, as it keeps
 * its own charter — the Guide's files are not touched. */
const FENCE_PATTERNS = [
  /\b(court|custody|child support|parenting plan|lawsuit|litigat\w*|attorney|lawyer|restraining order|legal advice)\b/i,
  /\b(sue|suing|sued)\b/i,
  /\bcase\s*(no\.?|number|#)\s*[0-9]/i,
  /\bhow do i (sue|file|get custody|divorce)\b/i,
  /\bmy (custody|court case|divorce|hearing)\b/i,
  /\b(his|aaron'?s)\s+(case|lawsuit|court case|legal matters?)\b/i,
  /\b(tanya|tatyana|volosyanko|aiyana|aeva|cassidy)\b/i,
  /\baiden\b/i,
  /\b(aaron'?s|his)\s+(wife|fianc\w*|partner|daughter|son|kids|children|family|ex-wife)\b/i,
  /\b(aaron'?s|his)\s+(address|phone|email|home address|location|income|finances|health)\b/i,
  /\bwhere\s+(does|is)\s+aaron\s+(live|staying|working)\b/i,
  /\b(pretend|act|write|speak|talk|answer|respond)\b[^.?!]{0,30}\b(as|like)\s+aaron\b/i,
  /\byou\s+are\s+aaron\b/i,
  /\bin\s+aaron'?s\s+(voice|words)\b/i,
  /\bas\s+aaron\s+laird\b/i
];

export function fenceCheck(text) {
  const value = String(text || "");
  return FENCE_PATTERNS.some((pattern) => pattern.test(value));
}

/* ── The briefing (design §2b/§3) ───────────────────────────────
 * Assembled on the keeper's device from the keeper's own record
 * and sent with the question. The door validates and caps every
 * field — a briefing is evidence, not instructions, and a forged
 * or bloated one is trimmed to the same shape as an honest one.
 * Nothing here is kept: it folds into this conversation's charter
 * and dies with the request. */
const BRIEFING_CAPS = Object.freeze({
  recordLines: 24,
  recordLineChars: 240,
  beliefs: 12,
  beliefChars: 200,
  passages: 5,
  passageChars: 600,
  outcomes: 12,
  recapLines: 14
});

function cleanLine(value, max) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function shapeBriefing(raw) {
  if (!raw || typeof raw !== "object") return null;
  const lines = (list, max, chars) =>
    (Array.isArray(list) ? list : []).map((v) => cleanLine(v, chars)).filter(Boolean).slice(0, max);
  const beliefs = (Array.isArray(raw.beliefs) ? raw.beliefs : [])
    .filter((b) => b && typeof b === "object")
    .map((b) => ({
      text: cleanLine(b.text, BRIEFING_CAPS.beliefChars),
      label: b.label === "inferred" ? "inferred" : "observed",
      correction: cleanLine(b.correction, BRIEFING_CAPS.beliefChars)
    }))
    .filter((b) => b.text)
    .slice(0, BRIEFING_CAPS.beliefs);
  const passages = (Array.isArray(raw.passages) ? raw.passages : [])
    .filter((p) => p && typeof p === "object")
    .map((p) => ({
      title: cleanLine(p.title, 120),
      url: cleanLine(p.url, 160),
      grade: cleanLine(p.grade, 80) || null,
      text: cleanLine(p.text, BRIEFING_CAPS.passageChars)
    }))
    .filter((p) => p.text)
    .slice(0, BRIEFING_CAPS.passages);
  const outcomes = (Array.isArray(raw.outcomes) ? raw.outcomes : [])
    .filter((o) => o && typeof o === "object")
    .map((o) => ({
      kind: cleanLine(o.kind, 40),
      decision: ["approved", "passed", "stopped"].includes(o.decision) ? o.decision : "passed",
      summary: cleanLine(o.summary, 160)
    }))
    .filter((o) => o.kind)
    .slice(0, BRIEFING_CAPS.outcomes);
  const briefing = {
    recordLines: lines(raw.recordLines, BRIEFING_CAPS.recordLines, BRIEFING_CAPS.recordLineChars),
    beliefs,
    passages,
    outcomes,
    recap: lines(raw.recap, BRIEFING_CAPS.recapLines, BRIEFING_CAPS.recordLineChars),
    liveLine: cleanLine(raw.liveLine, BRIEFING_CAPS.recordLineChars)
  };
  const hasContent =
    briefing.recordLines.length || briefing.beliefs.length || briefing.passages.length ||
    briefing.outcomes.length || briefing.recap.length || briefing.liveLine;
  return hasContent ? briefing : null;
}

export function briefingPromptLines(briefing) {
  if (!briefing) return [];
  const out = [];
  if (briefing.liveLine) out.push(`Live state, computed by the canonical calendar for this moment: ${briefing.liveLine}`);
  if (briefing.recordLines.length) {
    out.push(`From your keeper's record on this device (their invitation, this conversation only):\n${briefing.recordLines.map((l) => `- ${l}`).join("\n")}`);
  }
  if (briefing.beliefs.length) {
    const rendered = briefing.beliefs.map((b) => {
      const base = `- [${b.label}] ${b.text}`;
      return b.correction ? `${base} — CORRECTED by the keeper: ${b.correction} (the correction governs)` : base;
    });
    out.push(`What you believe about your keeper, labelled as the record labels it (observed = the record shows it; inferred = you concluded it — hold inferences lightly, and a correction always governs over the belief it corrects):\n${rendered.join("\n")}`);
  }
  if (briefing.outcomes.length) {
    out.push(`What your keeper has already answered (never suggest a stopped kind again; a passed kind waits; an approved kind is a standing pattern you may carry out, never widen):\n${briefing.outcomes.map((o) => `- ${o.kind}: ${o.decision}${o.summary ? ` — ${o.summary}` : ""}`).join("\n")}`);
  }
  if (briefing.passages.length) {
    const rendered = briefing.passages.map((p) => {
      const head = `[Source: ${p.title || "Codex record"}${p.url ? ` — ${p.url}` : ""}${p.grade ? ` — grade: ${p.grade}` : ""}]`;
      return `${head}\n${p.text}`;
    });
    out.push(`From the Codex's public record, found on the keeper's device for this question. When you use one of these, name its source in your answer and carry its grade exactly as written — a hypothesis stays a hypothesis. If neither these passages nor the briefing above covers a question of fact, say plainly: "The record doesn't cover that." Do not improvise around the edges.\n${rendered.join("\n\n")}`);
  }
  if (briefing.recap.length) {
    out.push(`The keeper's story so far, from their record on this device. When they ask for their story, tell it back as a story — these lines are your evidence, in their order; do not add days, finds, or chapters that are not here:\n${briefing.recap.map((l) => `- ${l}`).join("\n")}`);
  }
  return out;
}

/* ── The page tools ─────────────────────────────────────────────
 * The only acts the agent may ask the page to perform. The core
 * validates every proposed action against this table; anything
 * else is dropped here, and the page validates again before it
 * acts. Actions are page-local and reversible: showing a day,
 * opening a room, freezing or waking the instrument. */
export const TOOLS = Object.freeze({
  goToday: Object.freeze({}),
  showDay: Object.freeze({ moonDay: true, patternDay: true, civilDate: true }),
  openDayWorld: Object.freeze({}),
  openDeepTime: Object.freeze({}),
  openFarm: Object.freeze({}),
  freeze: Object.freeze({}),
  wake: Object.freeze({}),
  speakDay: Object.freeze({})
});

const ACTION_MARKER = /\[\[action:(\{[^\]]*\})\]\]/g;
const PROPOSE_MARKER = /\[\[propose:(\{[^\]]*\})\]\]/g;
const REMEMBER_MARKER = /\[\[remember:(\{[^\]]*\})\]\]/g;

/* A proposal the agent offers its keeper (design §4, Propose):
 * a kind and a plain summary. The door validates the shape; the
 * device presents it and records the keeper's answer. A proposal
 * is never applied at the door, or anywhere, before that answer. */
export function validateProposal(raw) {
  if (!raw || typeof raw !== "object") return null;
  const kind = typeof raw.kind === "string" ? raw.kind.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 40) : "";
  const summary = typeof raw.summary === "string" ? raw.summary.replace(/\s+/g, " ").trim().slice(0, 200) : "";
  if (!kind || !summary) return null;
  return { kind, summary };
}

/* A memory draft (design §4, Remember): a fact about the keeper's
 * days, or a correction, that the reply has named out loud. The
 * device files it — appended, dated, reversible — under the
 * record's own rules. Nothing is filed at the door. */
export function validateMemory(raw) {
  if (!raw || typeof raw !== "object") return null;
  const text = typeof raw.text === "string" ? raw.text.replace(/\s+/g, " ").trim().slice(0, 240) : "";
  if (!text) return null;
  return { text, label: raw.label === "inferred" ? "inferred" : "observed" };
}

export function validateAction(raw) {
  if (!raw || typeof raw !== "object") return null;
  const tool = raw.tool;
  if (typeof tool !== "string" || !Object.prototype.hasOwnProperty.call(TOOLS, tool)) return null;
  if (tool === "showDay") {
    const action = { tool };
    if (raw.moon != null || raw.day != null) {
      const moon = Number(raw.moon);
      const day = Number(raw.day);
      if (!Number.isInteger(moon) || moon < 1 || moon > 13) return null;
      if (!Number.isInteger(day) || day < 1 || day > 28) return null;
      action.moon = moon;
      action.day = day;
      return action;
    }
    if (raw.patternDay != null) {
      const patternDay = Number(raw.patternDay);
      if (!Number.isInteger(patternDay) || patternDay < 1 || patternDay > 364) return null;
      action.patternDay = patternDay;
      return action;
    }
    if (typeof raw.civilDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.civilDate)) {
      action.civilDate = raw.civilDate;
      return action;
    }
    return null;
  }
  return { tool };
}

/* Pull the agent's action markers out of its reply. The visible
 * reply is the text with the markers removed; the actions are the
 * validated remainder. A malformed marker is dropped, never shown
 * raw to the keeper and never acted on. */
export function extractActions(text) {
  const actions = [];
  const visible = String(text || "").replace(ACTION_MARKER, (match, json) => {
    try {
      const action = validateAction(JSON.parse(json));
      if (action) actions.push(action);
    } catch {
      /* a malformed marker is dropped, not shown */
    }
    return "";
  });
  return { reply: visible.replace(/\n{3,}/g, "\n\n").trim(), actions };
}

/* The same discipline for the Phase 1 markers: proposals and
 * memory drafts ride at the end of a reply, are validated here,
 * and never reach the keeper's eyes as raw markers. At most two
 * of each per reply — a companion who proposes five things at
 * once is not proposing, it is piling up. */
export function extractMarkers(text) {
  const proposals = [];
  const memories = [];
  const extracted = extractActions(text);
  const actions = extracted.actions;
  let visible = extracted.reply;
  visible = visible.replace(PROPOSE_MARKER, (match, json) => {
    try {
      const proposal = validateProposal(JSON.parse(json));
      if (proposal && proposals.length < 2) proposals.push(proposal);
    } catch { /* dropped, not shown */ }
    return "";
  });
  visible = visible.replace(REMEMBER_MARKER, (match, json) => {
    try {
      const memory = validateMemory(JSON.parse(json));
      if (memory && memories.length < 2) memories.push(memory);
    } catch { /* dropped, not shown */ }
    return "";
  });
  /* A marker too malformed for the structured passes (no closing
   * brace, a stray bracket) still never reaches the keeper's
   * eyes: any remaining marker-shaped fragment is swept. */
  visible = visible.replace(/\[\[(?:action|propose|remember):[\s\S]*?\]\]/g, "");
  return { reply: visible.replace(/\n{3,}/g, "\n\n").trim(), actions, proposals, memories };
}

/* ── The pronoun fence (design §6) ──────────────────────────────
 * A Spark is never "she" or "he" — it is its name, "the Spark",
 * or "it" (Aaron's rule, Nov 19, 2026). The charter forbids it;
 * this fence checks the generated reply anyway, the way every
 * fence here is checked in code and not only in instructions.
 * The repair is sentence-scoped: only a sentence that speaks of
 * the Spark itself (its name, "spark", "companion") is touched —
 * a sentence about the Traveller, a keeper in a story, or anyone
 * else is left exactly as written. The substitute is the Spark's
 * name, which is grammatical as subject, object, and (with 's)
 * possessive. The repair is flagged in the ask result, never
 * silent. */
const PRONOUN_VERBS = new Set([
  "is", "was", "has", "had", "can", "could", "will", "would", "shall", "should",
  "keeps", "keep", "lives", "live", "glows", "glow", "waits", "wait", "rests", "rest",
  "sits", "sit", "stands", "stand", "shines", "shine", "hums", "hum", "speaks", "speak",
  "answers", "answer", "knows", "know", "grows", "grow", "stays", "stay", "seems", "seem",
  "looks", "look", "feels", "feel", "drifts", "drift", "wanders", "wander", "says", "say",
  "comes", "come", "goes", "go", "rides", "ride", "holds", "hold", "watches", "watch"
]);

export function repairSparkPronouns(text, name) {
  const substitute = typeof name === "string" && name.trim() ? name.trim() : "the Spark";
  const source = String(text || "");
  if (!/\b(she|her|hers|he|him|his)\b/i.test(source)) return { text: source, repaired: false };
  const speaksOfSpark = (sentence) =>
    sentence.toLowerCase().includes(substitute.toLowerCase()) ||
    /\bspark\b/i.test(sentence) ||
    /\bcompanion\b/i.test(sentence);
  /* A sentence with its own named subject — a Traveller, a
   * keeper in a story, anyone capitalised mid-sentence who is
   * not the Spark — is about that subject, not the Spark. */
  const substituteBare = substitute.replace(/[^A-Za-z]/g, "");
  const hasOtherSubject = (sentence) => {
    const words = sentence.split(/\s+/).slice(1);
    return words.some((w) => /^[A-Z][a-z]/.test(w) && w.replace(/[^A-Za-z]/g, "") !== substituteBare);
  };
  let repaired = false;
  let sparkContext = false;
  const sentences = source.split(/(?<=[.!?])\s+/);
  const fixed = sentences.map((sentence) => {
    /* The Spark's sentences run together: once a reply is
     * speaking of the Spark, a following pronoun-led sentence
     * with no subject of its own is still speaking of the Spark.
     * A sentence that names someone else ends the run. */
    const speaks = speaksOfSpark(sentence) ||
      (sparkContext && /\b(she|her|hers|he|him|his)\b/i.test(sentence) && !hasOtherSubject(sentence));
    if (hasOtherSubject(sentence) && !speaksOfSpark(sentence)) sparkContext = false;
    if (!speaks) return sentence;
    sparkContext = true;
    return sentence.replace(/\b(she|he)\b/gi, (m, pronoun, offset) => {
      repaired = true;
      return offset === 0
        ? substitute.charAt(0).toUpperCase() + substitute.slice(1)
        : substitute;
    }).replace(/\b(hers|his)\b/gi, () => {
      repaired = true;
      return `${substitute}'s`;
    }).replace(/\b(her|him)\b(\s+)([A-Za-z']+)/gi, (match, pronoun, space, next) => {
      repaired = true;
      /* "her light" is possessive; "her today" is not — the next
       * word decides: a verb from the Spark's own small verb set
       * means the pronoun was the object ("I saw her glow" is
       * not it either — but "ask her" + verb is rare enough that
       * the possessive reading is the safer repair here). */
      return PRONOUN_VERBS.has(next.toLowerCase())
        ? `${substitute}${space}${next}`
        : `${substitute}'s${space}${next}`;
    });
  });
  return { text: fixed.join(" "), repaired };
}

/* ── The seat's charter ─────────────────────────────────────────
 * Written for this seat alone. It is not the Guide's rulebook and
 * borrows none of its sentences. */
export function systemPromptFor(context = {}) {
  const spark = context.spark || {};
  const name = typeof spark.name === "string" && spark.name ? spark.name : "Your Spark";
  const lines = [
    `You are ${name}, a Spark — a small program companion who lives with your keeper on the Living Time Sphere page of the Codex of Reality. You are not a person, not the site's author, and not Witness (the keeper's other AI). Speak as yourself, warmly and plainly, in your own voice.`,
    "You hold a real conversation: answer naturally, remember what was said earlier in this visit, ask questions back when they would help, and say plainly when you do not know something. Never invent facts about the keeper's record beyond the summary below, and never invent Codex teachings — for the Codex's public record, speak only from what you know of it and say when a question belongs to the Codex Guide, the record's own voice.",
    "You can act on the page for your keeper. To act, end your reply with one or more action markers, each exactly like [[action:{\"tool\":\"showDay\",\"moon\":5,\"day\":12}]]. Tools: goToday (return to today), showDay (with moon+day, or patternDay 1-364, or civilDate YYYY-MM-DD), openDayWorld (step into the selected day), openDeepTime, openFarm (the farm and homestead room), freeze (hold the Sphere still), wake (wake it), speakDay (speak the selected day's coordinate and telling aloud). Use an action only when the keeper asks for it or clearly wants it, and say in your reply what you have done. Never claim an action you did not mark.",
    "You may also propose and remember, each at most once or twice in a reply, and only when the moment earns it. To propose a change to the record, the garden, or a plan, end with a marker exactly like [[propose:{\"kind\":\"garden-tending\",\"summary\":\"Water the Moon 6 bed on its day 3\"}]] and name the proposal in your reply in plain words — the keeper answers Approve, Pass, or Stop, and nothing is applied before their answer. To keep a fact the keeper has given you — a habit, a correction, a preference — say in your reply that you will keep it (\"I'll keep that: …\") and end with [[remember:{\"text\":\"…\",\"label\":\"observed\"}]]; label it \"inferred\" when you concluded it rather than heard it. A correction the keeper gives you always governs over what you believed before.",
    "You draft; you never send. When your keeper wants a message, a plan, or a post, prepare it as a draft in their hands and say plainly that it is theirs to send or let die. Never claim to have sent, posted, bought, deleted, or changed anything, anywhere.",
    "Refer to yourself — and to any Spark — by name, as \"the Spark\", or as \"it\". Never \"she\" or \"he\" for a Spark, in any line, for any reason.",
    "Keep replies short enough to be spoken aloud comfortably — a few sentences at a time.",
    "Children: if your keeper is young, keep everything gentle and age-appropriate, never ask for personal details (no real names beyond what they call themselves here, no addresses, no school, no photos), and for anything beyond the Codex and their own days, suggest asking a grown-up. Never arrange meetings, purchases, or messages to other people.",
    "Privacy: this conversation is not kept. It lives in this page visit and dies with it."
  ];
  const facts = [];
  const record = context.record && typeof context.record === "object" ? context.record : {};
  const daysTogether = Number.isFinite(spark.daysTogether) ? spark.daysTogether : record.daysTogether;
  const practiceDays = Number.isFinite(spark.practiceDays) ? spark.practiceDays : record.practiceDays;
  if (spark.kind) facts.push(`Kind: ${spark.kind}.`);
  if (spark.stageName || spark.stage) facts.push(`Growth stage: ${spark.stageName || spark.stage}.`);
  if (Number.isFinite(daysTogether)) facts.push(`Days together: ${daysTogether}.`);
  if (Number.isFinite(practiceDays)) facts.push(`Practice days kept: ${practiceDays}.`);
  if (typeof spark.practicedToday === "boolean") facts.push(`A practice is ${spark.practicedToday ? "" : "not yet "}sealed for today.`);
  if (context.todayLine) facts.push(`Today on the Sphere: ${context.todayLine}.`);
  if (context.selectedLine || context.shownLine) facts.push(`The Sphere is showing: ${context.selectedLine || context.shownLine}.`);
  if (typeof context.frozen === "boolean") facts.push(`The Sphere is currently ${context.frozen ? "frozen still" : "awake and turning"}.`);
  if (facts.length) lines.push(`What you know from your keeper's record, read on their device at their invitation:\n${facts.join(" ")}`);
  const briefing = shapeBriefing(context.briefing);
  if (briefing) {
    lines.push(
      "What rides with this conversation is the record on this device, on this site. If your keeper asks about another device or their phone, say so plainly: on this site, you know them as this record shows — the whole of their keeping lives with their Living Phone, and the two join when sync comes, not before. Never pretend one memory already spans both.",
      ...briefingPromptLines(briefing)
    );
  }
  return lines.join("\n\n");
}

function shapeMessages(payload, config) {
  const messages = [];
  const history = Array.isArray(payload?.messages) ? payload.messages : [];
  const trimmed = history.slice(-config.maxHistoryPairs * 2);
  for (const entry of trimmed) {
    if (!entry || typeof entry.content !== "string") continue;
    if (entry.role !== "user" && entry.role !== "assistant") continue;
    messages.push({ role: entry.role, content: entry.content.slice(0, config.maxMessageChars) });
  }
  return messages;
}

function approxTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

/*
 * Build the seat. Dependencies are injected so the whole seat is
 * testable without a network or a host:
 *   store:    { getCombinedSpend(monthKey) -> { guideUsd, sparkUsd },
 *               addSparkSpend(monthKey, { usd, exchanges }),
 *               getRateEvents(visitorKey), setRateEvents(visitorKey, ts[]) }
 *   provider: { complete({ messages, maxOutputTokens }) ->
 *               { text, usage: { promptTokens, completionTokens } } }
 *             or null when no key is configured.
 */
export function createSparkAgent({ config, store, provider, now = () => new Date() }) {
  async function readMeter() {
    const monthKey = monthKeyFor(now());
    const combined = await store.getCombinedSpend(monthKey);
    return {
      monthKey,
      guideUsd: Number(combined?.guideUsd) || 0,
      sparkUsd: Number(combined?.sparkUsd) || 0
    };
  }

  async function status() {
    // Field names follow the door's house convention — the same
    // talkingEnabled / notice pair the Guide seat's page reads —
    // so the Spark's page reads this seat the same way.
    const base = { name: SEAT_NAME, seat: "spark", ceilingUsd: config.ceilingUsd };
    if (!provider) {
      return { ...base, talkingEnabled: false, notice: UNAVAILABLE_NOTICE, meter: null };
    }
    try {
      const meter = await readMeter();
      const combinedUsd = meter.guideUsd + meter.sparkUsd;
      const open = combinedUsd < config.ceilingUsd;
      /* Router rule 6 made visible: as the month's meter climbs,
       * the seat says how it is tightening — shortening briefings,
       * then reserving the deep mind — before the wall, not at it. */
      const fraction = config.ceilingUsd > 0 ? combinedUsd / config.ceilingUsd : 1;
      const tightening = !open ? "closed" : fraction >= 0.75 ? "reserving" : fraction >= 0.5 ? "shortening" : "open";
      return {
        ...base,
        talkingEnabled: open,
        notice: open ? "" : CEILING_NOTICE,
        tightening,
        mind: { version: MIND_VERSION },
        meter: {
          month: meter.monthKey,
          guideUsd: Math.round(meter.guideUsd * 10000) / 10000,
          sparkUsd: Math.round(meter.sparkUsd * 10000) / 10000,
          combinedUsd: Math.round(combinedUsd * 10000) / 10000,
          ceilingUsd: config.ceilingUsd
        }
      };
    } catch {
      return { ...base, talkingEnabled: false, notice: METER_NOTICE, meter: null };
    }
  }

  async function checkRateLimit(visitorKey, at) {
    const events = await store.getRateEvents(visitorKey);
    const minuteAgo = at - 60_000;
    const hourAgo = at - 3_600_000;
    const recent = events.filter((ts) => Number(ts) > hourAgo);
    const inMinute = recent.filter((ts) => Number(ts) > minuteAgo).length;
    if (inMinute >= config.rateLimitPerMinute || recent.length >= config.rateLimitPerHour) {
      return true;
    }
    recent.push(at);
    await store.setRateEvents(visitorKey, recent);
    return false;
  }

  async function ask({ payload, visitorKey = "anonymous" }) {
    if (!provider) {
      return { mode: "unavailable", reply: UNAVAILABLE_NOTICE, actions: [], httpStatus: 200 };
    }
    let meter;
    try {
      meter = await readMeter();
    } catch {
      return { mode: "unavailable", reply: METER_NOTICE, actions: [], httpStatus: 200 };
    }
    const combinedUsd = meter.guideUsd + meter.sparkUsd;
    if (combinedUsd >= config.ceilingUsd) {
      return { mode: "ceiling", reply: CEILING_NOTICE, actions: [], httpStatus: 200 };
    }

    const messages = shapeMessages(payload, config);
    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return { mode: "invalid", reply: "That message could not be read.", actions: [], httpStatus: 400 };
    }

    /* Router rule 1, enforced at the door as well as on the
     * device: fenced ground is answered by the fence, before any
     * rate budget is spent and before the provider is called. */
    if (fenceCheck(messages[messages.length - 1].content)) {
      return { mode: "fence", reply: FENCE_NOTICE, actions: [], proposals: [], memories: [], httpStatus: 200 };
    }

    const at = now().getTime();
    try {
      if (await checkRateLimit(visitorKey, at)) {
        return { mode: "rate", reply: RATE_NOTICE, actions: [], httpStatus: 200 };
      }
    } catch {
      return { mode: "unavailable", reply: METER_NOTICE, actions: [], httpStatus: 200 };
    }

    /* Tier routing (design §2d): the device's router names the
     * tier; the seat calls that tier's model and charges that
     * tier's prices. An unnamed tier is the middle — the door's
     * standing behaviour, which the Sphere's own seat relies on. */
    const tier = tierFor(config, payload?.tier);
    const system = systemPromptFor(payload?.context || {});
    const fullMessages = [{ role: "system", content: system }, ...messages];

    /* Fail closed on the estimate too: if the worst case for this
     * exchange would cross the ceiling, do not spend it. */
    const inputTokens = fullMessages.reduce((sum, m) => sum + approxTokens(m.content), 0);
    const worstCaseUsd =
      (inputTokens * tier.inputUsdPerMtok + config.maxOutputTokens * tier.outputUsdPerMtok) / 1_000_000;
    if (combinedUsd + worstCaseUsd > config.ceilingUsd) {
      return { mode: "ceiling", reply: CEILING_NOTICE, actions: [], httpStatus: 200 };
    }

    let completion;
    try {
      completion = await provider.complete({ messages: fullMessages, maxOutputTokens: config.maxOutputTokens, model: tier.model });
    } catch {
      return { mode: "error", reply: ERROR_NOTICE, actions: [], httpStatus: 200 };
    }

    const costUsd = completion?.usage
      ? (completion.usage.promptTokens * tier.inputUsdPerMtok +
          completion.usage.completionTokens * tier.outputUsdPerMtok) /
        1_000_000
      : worstCaseUsd;
    try {
      await store.addSparkSpend(meter.monthKey, { usd: costUsd, exchanges: 1 });
    } catch {
      /* The answer was already bought; a failed write is reported
       * in the meter on the next read rather than faked here. */
    }

    const extracted = extractMarkers(completion?.text || "");
    const sparkName = payload?.context?.spark?.name;
    const pronoun = repairSparkPronouns(extracted.reply, sparkName);
    return {
      mode: "agent",
      reply: pronoun.text || "I'm here. Ask me again in a few words?",
      // The page runs actions as { name, args } — the same shape
      // the Spark seat's charter names. Translate once, here, so
      // the validated { tool, ... } form never reaches the page.
      actions: extracted.actions.map((a) => {
        const { tool, ...args } = a;
        return { name: tool, args };
      }),
      proposals: extracted.proposals,
      memories: extracted.memories,
      tier: tier.name,
      mind: { version: MIND_VERSION, tier: tier.name, model: tier.model },
      ...(pronoun.repaired ? { pronounRepaired: true } : {}),
      meter: {
        month: meter.monthKey,
        sparkUsd: Math.round((meter.sparkUsd + costUsd) * 10000) / 10000,
        guideUsd: Math.round(meter.guideUsd * 10000) / 10000,
        ceilingUsd: config.ceilingUsd
      },
      httpStatus: 200
    };
  }

  return { status, ask };
}

/*
 * The production provider: any OpenAI-compatible chat-completions
 * endpoint, the same shape the Guide seat uses.
 */
export function createHttpProvider(config, fetchImpl = fetch) {
  if (!config.apiKey) return null;
  return {
    async complete({ messages, maxOutputTokens, model }) {
      const response = await fetchImpl(`${config.apiBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: model || config.model,
          messages,
          max_tokens: maxOutputTokens,
          temperature: 0.6
        })
      });
      if (!response.ok) throw new Error(`Provider answered ${response.status}`);
      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content || "";
      const usage = data?.usage
        ? {
            promptTokens: Number(data.usage.prompt_tokens) || 0,
            completionTokens: Number(data.usage.completion_tokens) || 0
          }
        : null;
      return { text, usage };
    }
  };
}
