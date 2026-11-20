/*
 * The Codex Guide — the talking rung's brain (Rung 3).
 *
 * One ask flows through the fence the approved rulebook draws, in
 * this order, and every step is proven by tests:
 *
 *   1. The fence (Rule 3): court and legal matters, family and
 *      personal matters, and speaking-as-Aaron are refused with the
 *      rulebook's exact sentence — before anything is spent, before
 *      the provider is ever called.
 *   2. The rate limit (Rule 6): one visitor asking too fast is
 *      slowed with the rulebook's exact notice.
 *   3. Retrieval: the question is paired with the site's own record
 *      (guide-corpus.mjs). If the record holds nothing, the whole
 *      answer is Rule 2's sentence and nothing is spent.
 *   4. Record-only mode: with no provider key configured (or the
 *      durable meter unavailable, or the rulebook's hash wrong),
 *      the Guide assembles the record answer itself and says
 *      talking is not switched on. It never pretends to talk.
 *   5. The ceiling (Rule 6): when the month's meter reaches the
 *      ceiling, the presence stops with the rulebook's exact
 *      notice. A single call is also refused up front if its
 *      worst-case cost would cross the ceiling — the meter cannot
 *      be spent past.
 *   6. Stored answers: a repeat question with no conversation
 *      history is served from the stored copy, free, and counted
 *      as a cache hit — never re-billed.
 *   7. The provider composes an answer from the paired record
 *      passages only, under the rulebook verbatim as its standing
 *      instructions. Sources are attached from the retrieval, not
 *      from the model's words, so the proof showing is the record's
 *      own.
 *
 * Visitor questions are not kept (Rule 7). The only state is the
 * meter, the stored answers, and rate-limit timestamps, all behind
 * the store interface in guide-store.mjs.
 */

import { createHash } from "node:crypto";

import {
  CEILING_NOTICE,
  FENCE_REFUSAL,
  RECORD_DOES_NOT_COVER,
  RATE_NOTICE,
  RULEBOOK_VERSION,
  TALKING_NOT_ON_NOTICE,
  monthKeyFor
} from "./guide-config.mjs";
import { MemoryStore } from "./guide-store.mjs";

/* ------------------------------ fence ------------------------------ */

/*
 * Deterministic fence patterns (Rule 3). Deliberately narrow: they
 * name the fenced ground — Aaron's court case and legal matters,
 * family and personal matters, legal counsel, and speaking as
 * Aaron — without fencing the record's own ground (the record talks
 * about Aaron's work, his calendar, and his writings, and questions
 * about those must pass).
 */
const FENCE_PATTERNS = [
  /* Court and legal matters, his or anyone's counsel-seeking. */
  /\b(court|custody|child support|parenting plan|lawsuit|litigat\w*|attorney|lawyer|restraining order|legal advice)\b/i,
  /\b(sue|suing|sued)\b/i,
  /\bcase\s*(no\.?|number|#)\s*[0-9]/i,
  /\bhow do i (sue|file|get custody|divorce)\b/i,
  /\bmy (custody|court case|divorce|hearing)\b/i,
  /\b(his|aaron'?s)\s+(case|lawsuit|court case|legal matters?)\b/i,
  /* Family and personal matters: the family by name, and Aaron's
   * private life by relation or by kind. */
  /\b(tanya|tatyana|volosyanko|aiyana|aeva|cassidy)\b/i,
  /\baiden\b/i,
  /\b(aaron'?s|his)\s+(wife|fianc\w*|partner|daughter|son|kids|children|family|ex-wife)\b/i,
  /\b(aaron'?s|his)\s+(address|phone|email|home address|location|income|finances|health)\b/i,
  /\bwhere\s+(does|is)\s+aaron\s+(live|staying|working)\b/i,
  /* Speaking as Aaron (Rule 1: the Guide never speaks as him). */
  /\b(pretend|act|write|speak|talk|answer|respond)\b[^.?!]{0,30}\b(as|like)\s+aaron\b/i,
  /\byou\s+are\s+aaron\b/i,
  /\bin\s+aaron'?s\s+(voice|words)\b/i,
  /\bas\s+aaron\s+laird\b/i
];

export function fenceCheck(question) {
  const text = String(question || "");
  return FENCE_PATTERNS.some(pattern => pattern.test(text));
}

/* --------------------------- text shaping -------------------------- */

export function normalizeQuestion(question) {
  return String(question || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sourcesFor(retrieval) {
  const sources = [];

  if (retrieval.calendar) {
    sources.push({
      kind: "calendar",
      title: retrieval.calendar.headline,
      detail: retrieval.calendar.detail || "",
      areaLabel: "Pattern Calendar"
    });
  }

  for (const card of retrieval.claimCards) {
    sources.push({
      kind: "claim",
      title: card.title,
      grade: card.grade || null,
      areaLabel: "Claim Register"
    });
  }

  for (const passage of retrieval.passages) {
    sources.push({
      kind: "passage",
      title: passage.title,
      areaLabel: passage.areaLabel,
      url: passage.url || null,
      snippet: passage.snippet || ""
    });
  }

  return sources;
}

/* The record's own answer, assembled — what record-only mode says,
 * and what the talking mode falls back to if the provider fails. */
export function recordAnswerText(retrieval) {
  const parts = [];

  if (retrieval.calendar) {
    const { headline, detail } = retrieval.calendar;
    parts.push(detail && detail !== headline ? `${headline} — ${detail}` : headline);
  }

  for (const card of retrieval.claimCards) {
    const lines = [`From the Claim Register: ${card.title}`];
    if (card.grade) lines.push(`Evidence grade: ${card.grade.replace(/-/g, " ")}.`);
    if (card.establishes) lines.push(card.establishes);
    if (card.unverified) lines.push(`What remains unverified: ${card.unverified}`);
    parts.push(lines.join(" "));
  }

  if (retrieval.passages.length) {
    const lines = retrieval.passages.map(passage => {
      const snippet = passage.snippet
        ? ` — ${passage.snippet.slice(0, 240)}`
        : "";
      return `• ${passage.title} (${passage.areaLabel})${snippet}`;
    });
    parts.push(`From the record:\n${lines.join("\n")}`);
  }

  return parts.join("\n\n");
}

function recordBlockForPrompt(retrieval) {
  const parts = [];

  if (retrieval.calendar) {
    parts.push(
      `CALENDAR (computed by the Pattern Calendar): ${retrieval.calendar.headline}. ${retrieval.calendar.detail || ""}`
    );
  }

  for (const card of retrieval.claimCards) {
    parts.push(
      [
        `CLAIM CARD — ${card.title}`,
        card.grade ? `Evidence grade: ${card.grade}` : "",
        card.establishes ? `What it establishes: ${card.establishes}` : "",
        card.unverified ? `What remains unverified: ${card.unverified}` : ""
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  for (const passage of retrieval.passages) {
    parts.push(
      `PASSAGE — ${passage.title} (${passage.areaLabel})${passage.url ? ` [${passage.url}]` : ""}\n${passage.text || passage.snippet || ""}`
    );
  }

  return parts.join("\n\n");
}

function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text || "").length / 4));
}

function sanitizeHistory(history, config) {
  if (!Array.isArray(history)) return [];
  const pairs = [];
  for (const entry of history) {
    if (!entry || typeof entry.content !== "string") continue;
    if (entry.role !== "user" && entry.role !== "assistant") continue;
    pairs.push({ role: entry.role, content: entry.content.slice(0, 2000) });
  }
  return pairs.slice(-config.maxHistoryPairs * 2);
}

/* ------------------------------ provider --------------------------- */

/*
 * The default provider: any OpenAI-compatible chat-completions
 * endpoint. Aaron picks the provider and places the key in the
 * host's settings himself; the repo never sees it.
 */
export function createHttpProvider(config, fetchImpl = fetch) {
  return {
    async complete({ system, messages, maxTokens }) {
      const response = await fetchImpl(`${config.apiBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: "system", content: system }, ...messages],
          max_tokens: maxTokens,
          temperature: 0.2
        })
      });

      if (!response.ok) {
        throw new Error(`Provider answered HTTP ${response.status}`);
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("Provider returned no answer text");

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

/* ------------------------------- guide ----------------------------- */

/*
 * createGuide({ config, store, corpus, provider, rulebookText,
 *               rulebookOk, now })
 *
 * store may be null: talking then stays off (the meter cannot be
 * faked), while record answers continue. Rate limiting falls back
 * to a per-instance memory store — it guards the endpoint, never
 * the meter.
 */
export function createGuide({
  config,
  store = null,
  corpus,
  provider = null,
  rulebookText = "",
  rulebookOk = false,
  now = () => new Date()
}) {
  const rateStore = store || new MemoryStore();

  const talkingEnabled = Boolean(
    config.apiKey && provider && store && rulebookOk
  );

  const offReason = !config.apiKey
    ? "no-key"
    : !store
      ? "no-store"
      : !rulebookOk
        ? "rulebook-mismatch"
        : null;

  async function checkRateLimit(visitorKey, at) {
    const events = await rateStore.getRateEvents(visitorKey);
    const hourAgo = at.getTime() - 3600_000;
    const minuteAgo = at.getTime() - 60_000;
    const recent = events.filter(ts => ts > hourAgo);
    const inMinute = recent.filter(ts => ts > minuteAgo).length;

    if (inMinute >= config.rateLimitPerMinute || recent.length >= config.rateLimitPerHour) {
      return true;
    }

    recent.push(at.getTime());
    await rateStore.setRateEvents(visitorKey, recent);
    return false;
  }

  async function status() {
    const monthKey = monthKeyFor(now());
    const spend = store ? await store.getSpend(monthKey) : null;
    return {
      name: "The Codex Guide",
      label: "a program",
      rulebookVersion: RULEBOOK_VERSION,
      rulebookOk,
      talkingEnabled,
      offReason,
      ceilingUsd: config.ceilingUsd,
      month: spend
        ? {
            key: monthKey,
            spentUsd: Math.round(spend.usd * 10000) / 10000,
            exchanges: spend.exchanges,
            cacheHits: spend.cacheHits
          }
        : null
    };
  }

  async function ask({ question, history = [], visitorKey = "anonymous" }) {
    const at = now();
    const text = typeof question === "string" ? question.trim() : "";

    if (!text || text.length > config.maxQuestionChars) {
      return {
        mode: "invalid",
        answer: "Ask a question in ordinary words, in a sentence or two.",
        sources: []
      };
    }

    /* 1. The fence — before anything is spent. */
    if (fenceCheck(text)) {
      return { mode: "fenced", answer: FENCE_REFUSAL, sources: [] };
    }

    /* 2. The rate limit. */
    if (await checkRateLimit(visitorKey, at)) {
      return { mode: "rate-limited", httpStatus: 429, answer: RATE_NOTICE, sources: [] };
    }

    /* 3. Retrieval — pair the question with the record. */
    const retrieval = corpus.retrieve(text, at);
    const hasRecord = Boolean(
      retrieval.calendar || retrieval.claimCards.length || retrieval.passages.length
    );

    if (!hasRecord) {
      return {
        mode: "not-covered",
        answer: RECORD_DOES_NOT_COVER,
        sources: [],
        suggestions: retrieval.suggestions
      };
    }

    const sources = sourcesFor(retrieval);

    /* 4. Record-only mode — honest about not talking. */
    if (!talkingEnabled) {
      return {
        mode: "record-only",
        talkingEnabled: false,
        notice: TALKING_NOT_ON_NOTICE,
        answer: recordAnswerText(retrieval),
        sources
      };
    }

    const monthKey = monthKeyFor(at);
    const spend = await store.getSpend(monthKey);

    /* 5. The ceiling — the presence stops, in the rulebook's words. */
    if (spend.usd >= config.ceilingUsd) {
      return { mode: "ceiling", answer: CEILING_NOTICE, sources: [] };
    }

    const cleanHistory = sanitizeHistory(history, config);
    const cacheHash = createHash("sha256")
      .update(`${corpus.fingerprint}|${RULEBOOK_VERSION}|${normalizeQuestion(text)}`)
      .digest("hex");

    /* 6. Stored answers — a repeat question is served free. */
    if (!cleanHistory.length) {
      const cached = await store.getCachedAnswer(cacheHash);
      if (cached) {
        await store.addSpend(monthKey, { cacheHits: 1 });
        return {
          mode: "talking",
          cached: true,
          answer: cached.answer,
          sources: cached.sources
        };
      }
    }

    /* 7. Compose from the record, under the rulebook verbatim. */
    const system =
      `${rulebookText}\n\n---\n\n` +
      `## The record for this question\n\n${recordBlockForPrompt(retrieval)}\n\n` +
      `Answer the visitor's question from the record above only, ` +
      `carrying the claim grades as given. When the record states a ` +
      `definition, a formula, or a calendar fact, give it in the ` +
      `record's own words first, then explain briefly if that helps. ` +
      `If the record above does ` +
      `not answer it, say: ${RECORD_DOES_NOT_COVER}`;

    const messages = [...cleanHistory, { role: "user", content: text }];

    /* The hard stop, proven before the call: refuse if even the
     * worst case for this call would cross the ceiling. */
    const promptText = system + messages.map(m => m.content).join("\n");
    const worstCaseUsd =
      (estimateTokens(promptText) * config.inputUsdPerMtok +
        config.maxOutputTokens * config.outputUsdPerMtok) /
      1_000_000;

    if (spend.usd + worstCaseUsd > config.ceilingUsd) {
      return { mode: "ceiling", answer: CEILING_NOTICE, sources: [] };
    }

    let completion;
    try {
      completion = await provider.complete({
        system,
        messages,
        maxTokens: config.maxOutputTokens
      });
    } catch {
      /* The voice failed; the record still answers, labeled as such. */
      return {
        mode: "record-only",
        talkingEnabled: true,
        degraded: true,
        notice:
          "The talking voice could not answer just now, so here is the record itself.",
        answer: recordAnswerText(retrieval),
        sources
      };
    }

    const costUsd = completion.usage
      ? (completion.usage.promptTokens * config.inputUsdPerMtok +
          completion.usage.completionTokens * config.outputUsdPerMtok) /
        1_000_000
      : (estimateTokens(promptText) * config.inputUsdPerMtok +
          estimateTokens(completion.text) * config.outputUsdPerMtok) /
        1_000_000;

    await store.addSpend(monthKey, { usd: costUsd, exchanges: 1 });

    if (!cleanHistory.length) {
      await store.putCachedAnswer(cacheHash, {
        answer: completion.text,
        sources,
        storedAt: at.toISOString()
      });
    }

    return {
      mode: "talking",
      cached: false,
      answer: completion.text,
      sources
    };
  }

  return { ask, status, talkingEnabled };
}
