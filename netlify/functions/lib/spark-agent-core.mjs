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
export const CEILING_NOTICE =
  "We've reached the talking limit for this month, so my deeper voice rests until the month turns. I can still speak from your record here.";
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
  return {
    apiKey: env.GUIDE_API_KEY || "",
    apiBaseUrl: (env.GUIDE_API_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
    model: env.GUIDE_MODEL || "gpt-4o-mini",
    ceilingUsd: numberFrom(env.GUIDE_MONTHLY_CEILING_USD, 20),
    inputUsdPerMtok: numberFrom(env.GUIDE_INPUT_USD_PER_MTOK, 0.15),
    outputUsdPerMtok: numberFrom(env.GUIDE_OUTPUT_USD_PER_MTOK, 0.6),
    maxOutputTokens: Math.floor(numberFrom(env.SPARK_MAX_OUTPUT_TOKENS, 700)),
    rateLimitPerMinute: Math.floor(numberFrom(env.GUIDE_RATE_LIMIT_PER_MINUTE, 10)),
    rateLimitPerHour: Math.floor(numberFrom(env.GUIDE_RATE_LIMIT_PER_HOUR, 60)),
    maxHistoryPairs: 8,
    maxMessageChars: 1200
  };
}

/* The month key the spend counters live under (UTC) — the same
 * shape the Guide seat uses, so the two lines sit side by side. */
export function monthKeyFor(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
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
    "Keep replies short enough to be spoken aloud comfortably — a few sentences at a time.",
    "Children: if your keeper is young, keep everything gentle and age-appropriate, never ask for personal details (no real names beyond what they call themselves here, no addresses, no school, no photos), and for anything beyond the Codex and their own days, suggest asking a grown-up. Never arrange meetings, purchases, or messages to other people.",
    "Privacy: this conversation is not kept. It lives in this page visit and dies with it."
  ];
  const facts = [];
  if (spark.kind) facts.push(`Kind: ${spark.kind}.`);
  if (spark.stageName) facts.push(`Growth stage: ${spark.stageName}.`);
  if (Number.isFinite(spark.daysTogether)) facts.push(`Days together: ${spark.daysTogether}.`);
  if (Number.isFinite(spark.practiceDays)) facts.push(`Practice days kept: ${spark.practiceDays}.`);
  if (typeof spark.practicedToday === "boolean") facts.push(`A practice is ${spark.practicedToday ? "" : "not yet "}sealed for today.`);
  if (context.todayLine) facts.push(`Today on the Sphere: ${context.todayLine}.`);
  if (context.selectedLine) facts.push(`The Sphere is showing: ${context.selectedLine}.`);
  if (typeof context.frozen === "boolean") facts.push(`The Sphere is currently ${context.frozen ? "frozen still" : "awake and turning"}.`);
  if (facts.length) lines.push(`What you know from your keeper's record, read on their device at their invitation:\n${facts.join(" ")}`);
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
      return {
        ...base,
        talkingEnabled: open,
        notice: open ? "" : CEILING_NOTICE,
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

    const at = now().getTime();
    try {
      if (await checkRateLimit(visitorKey, at)) {
        return { mode: "rate", reply: RATE_NOTICE, actions: [], httpStatus: 200 };
      }
    } catch {
      return { mode: "unavailable", reply: METER_NOTICE, actions: [], httpStatus: 200 };
    }

    const system = systemPromptFor(payload?.context || {});
    const fullMessages = [{ role: "system", content: system }, ...messages];

    /* Fail closed on the estimate too: if the worst case for this
     * exchange would cross the ceiling, do not spend it. */
    const inputTokens = fullMessages.reduce((sum, m) => sum + approxTokens(m.content), 0);
    const worstCaseUsd =
      (inputTokens * config.inputUsdPerMtok + config.maxOutputTokens * config.outputUsdPerMtok) / 1_000_000;
    if (combinedUsd + worstCaseUsd > config.ceilingUsd) {
      return { mode: "ceiling", reply: CEILING_NOTICE, actions: [], httpStatus: 200 };
    }

    let completion;
    try {
      completion = await provider.complete({ messages: fullMessages, maxOutputTokens: config.maxOutputTokens });
    } catch {
      return { mode: "error", reply: ERROR_NOTICE, actions: [], httpStatus: 200 };
    }

    const costUsd = completion?.usage
      ? (completion.usage.promptTokens * config.inputUsdPerMtok +
          completion.usage.completionTokens * config.outputUsdPerMtok) /
        1_000_000
      : worstCaseUsd;
    try {
      await store.addSparkSpend(meter.monthKey, { usd: costUsd, exchanges: 1 });
    } catch {
      /* The answer was already bought; a failed write is reported
       * in the meter on the next read rather than faked here. */
    }

    const { reply, actions } = extractActions(completion?.text || "");
    return {
      mode: "agent",
      reply: reply || "I'm here. Ask me again in a few words?",
      // The page runs actions as { name, args } — the same shape
      // the Spark seat's charter names. Translate once, here, so
      // the validated { tool, ... } form never reaches the page.
      actions: actions.map((a) => {
        const { tool, ...args } = a;
        return { name: tool, args };
      }),
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
    async complete({ messages, maxOutputTokens }) {
      const response = await fetchImpl(`${config.apiBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
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
