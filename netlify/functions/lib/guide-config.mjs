/*
 * The Codex Guide — configuration for the talking rung (Rung 3).
 *
 * Everything that spends money or names a provider comes from the
 * environment Aaron sets in Netlify himself. No key, model secret, or
 * credential ever lives in this repo. With GUIDE_API_KEY unset, the
 * Guide answers in record-only mode and says talking is not switched
 * on — it never pretends to talk.
 *
 * The exact sentences below are quoted from the approved rulebook
 * (codex-guide-rulebook.md, version 1, approved word for word by
 * Aaron, Nov 19, 2026). tests/codex-guide-talking.test.js asserts
 * each one appears verbatim in the rulebook file, so the code and
 * the rulebook cannot drift apart silently.
 */

export const RULEBOOK_VERSION = 1;

/* SHA-256 of codex-guide-rulebook.md as approved. If the file in the
 * repo does not hash to this, the Guide refuses to talk (record-only
 * mode) rather than run under unapproved rules. */
export const RULEBOOK_SHA256 =
  "0d71597b18a21a2893f25ef0e4eb1e91c031621c2e05a84c96f25449490c8d99";

/* Rule 2 — the whole answer when the record holds nothing. */
export const RECORD_DOES_NOT_COVER = "The record doesn't cover that.";

/* Rule 3 — the whole answer on fenced ground. */
export const FENCE_REFUSAL =
  "I can't talk about that. My answers come from the Codex's public " +
  "record, and that subject is kept outside it.";

/* Rule 6 — said when the month's talking limit is reached. */
export const CEILING_NOTICE =
  "The Codex Guide has reached its talking limit for this month. " +
  "I can't take new questions until the month turns. The rest of " +
  "the site still works, and the ask-the-record Guide is still here.";

/* Rule 6 — said when one visitor asks faster than is fair. */
export const RATE_NOTICE =
  "You're asking faster than I can fairly take. Give it a little " +
  "while, then ask again.";

/* Rule 7 — shown on the page before the first question. */
export const PRIVACY_NOTICE =
  "Before you ask: your question is sent to an AI company to be " +
  "answered, and the answer comes back with the record passages it " +
  "was drawn from. Your questions are not kept. Your own notes and " +
  "records on this device never reach this page.";

/* The Guide speaking plainly about its own state (page copy, not a
 * rulebook quote): shown when no provider key is configured. */
export const TALKING_NOT_ON_NOTICE =
  "Talking is not switched on yet. Until it is, the Guide answers " +
  "from the record only — the same record the ask-the-record Guide " +
  "above searches, with its sources showing.";

function numberFrom(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/*
 * Read the Guide's configuration from an environment map (process.env
 * in the function; a plain object in tests).
 */
export function readConfig(env = {}) {
  const ceilingUsd = numberFrom(env.GUIDE_MONTHLY_CEILING_USD, 20);

  return {
    /* The provider key. Absent key = talking off, record-only mode. */
    apiKey: env.GUIDE_API_KEY || null,
    /* Any OpenAI-compatible chat-completions endpoint. */
    apiBaseUrl: (env.GUIDE_API_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
    /* A small, fast model by default; the ceiling, not the model,
     * is the real guard. */
    model: env.GUIDE_MODEL || "gpt-4o-mini",
    /* Rule 6: the hard monthly ceiling, all visitors together. */
    ceilingUsd,
    /* Cost accounting rates (USD per million tokens). Defaults are
     * the published shape of a small fast model; Aaron can correct
     * them in the environment when he picks a provider, and the
     * first digest reports the measured cost either way. */
    inputUsdPerMtok: numberFrom(env.GUIDE_INPUT_USD_PER_MTOK, 0.15),
    outputUsdPerMtok: numberFrom(env.GUIDE_OUTPUT_USD_PER_MTOK, 0.6),
    /* Short answers (Rule 8): the most one answer may generate. */
    maxOutputTokens: Math.floor(numberFrom(env.GUIDE_MAX_OUTPUT_TOKENS, 600)),
    /* One visitor cannot spend the whole month (Rule 6). */
    rateLimitPerMinute: Math.floor(numberFrom(env.GUIDE_RATE_LIMIT_PER_MINUTE, 10)),
    rateLimitPerHour: Math.floor(numberFrom(env.GUIDE_RATE_LIMIT_PER_HOUR, 60)),
    /* Conversation memory the client may send back per ask. Nothing
     * is kept server-side (Rule 7); history rides with the request. */
    maxHistoryPairs: 6,
    maxQuestionChars: 1000
  };
}

/* The month key the spend counter and cache live under (UTC). */
export function monthKeyFor(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}
