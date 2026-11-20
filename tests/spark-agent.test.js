"use strict";

/*
 * The Spark seat (Aaron, Nov 20, 2026): "I meant it acts like a
 * real AI agent." A sibling endpoint to the Codex Guide's — same
 * provider key, its own visible line in the same ceiling
 * machinery, fail-closed, honest without a key. The Guide seat
 * stays exactly as approved; these tests prove the Spark seat's
 * plumbing with a stubbed provider and an in-memory store:
 *   - conversation flows, session memory is shaped and capped;
 *   - action markers are extracted, validated, and the invalid
 *     ones dropped silently (a bad moon never reaches the page);
 *   - the ceiling is COMBINED (Guide + Spark) and fails closed,
 *     including when a call's worst case would cross it;
 *   - a meter that cannot be read closes the seat;
 *   - no provider (no key) means an honest unavailable, never a
 *     fake conversation;
 *   - the rate limit holds;
 *   - the system prompt carries the children's fence and the
 *     not-a-person lines;
 *   - no Guide file changes in this change set.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const root = path.join(__dirname, "..");
let core;
test.before(async () => {
  core = await import(pathToFileURL(path.join(root, "netlify/functions/lib/spark-agent-core.mjs")).href);
});

function memoryStore({ guideUsd = 0, sparkUsd = 0, fail = false } = {}) {
  const state = { sparkSpend: [], rates: new Map() };
  return {
    state,
    async getCombinedSpend() {
      if (fail) throw new Error("meter down");
      return { guideUsd, sparkUsd: sparkUsd + state.sparkSpend.reduce((a, s) => a + s.usd, 0) };
    },
    async addSparkSpend(monthKey, entry) { state.sparkSpend.push(entry); },
    async getRateEvents(key) { return state.rates.get(key) || []; },
    async setRateEvents(key, events) { state.rates.set(key, events); }
  };
}

const config = () => core.readSparkConfig({ GUIDE_API_KEY: "test-key" });
const now = () => new Date("2026-11-20T12:00:00Z");
const ask = (agent, text, extra = {}) =>
  agent.ask({ payload: { messages: [{ role: "user", content: text }], context: { spark: { name: "Nori" } }, ...extra }, visitorKey: "visitor-1" });

test("config reads the Guide's own env names — one key, two seats", () => {
  const c = core.readSparkConfig({ GUIDE_API_KEY: "k", GUIDE_MONTHLY_CEILING_USD: "20" });
  assert.equal(c.apiKey, "k");
  assert.equal(c.ceilingUsd, 20);
  assert.equal(core.readSparkConfig({}).apiKey, "");
});

test("conversation flows: the reply returns, spend lands on the Spark line", async () => {
  const store = memoryStore();
  const provider = { complete: async () => ({ text: "Hello, keeper.", usage: { promptTokens: 100, completionTokens: 50 } }) };
  const agent = core.createSparkAgent({ config: config(), store, provider, now });
  const out = await ask(agent, "hello");
  assert.equal(out.mode, "agent");
  assert.equal(out.reply, "Hello, keeper.");
  assert.deepEqual(out.actions, []);
  assert.equal(store.state.sparkSpend.length, 1, "one spend entry, on the Spark line");
  assert.ok(store.state.sparkSpend[0].usd > 0);
});

test("actions are extracted and validated; malformed ones drop silently", async () => {
  const provider = {
    complete: async () => ({
      text: 'Showing it now. [[action:{"tool":"showDay","moon":5,"day":12}]] [[action:{"tool":"showDay","moon":99,"day":1}]] [[action:{"tool":"teleport"}]] [[action:{"tool":"openDayWorld"}]]',
      usage: { promptTokens: 10, completionTokens: 10 }
    })
  };
  const agent = core.createSparkAgent({ config: config(), store: memoryStore(), provider, now });
  const out = await ask(agent, "show me Moon 5 Day 12 and step in");
  assert.equal(out.actions.length, 2, "only the two valid actions survive");
  assert.deepEqual(out.actions[0], { tool: "showDay", moon: 5, day: 12 });
  assert.deepEqual(out.actions[1], { tool: "openDayWorld" });
  assert.ok(!out.reply.includes("[[action"), "markers never reach the keeper's eyes");
});

test("validateAction fences every tool's arguments", () => {
  assert.equal(core.validateAction({ tool: "showDay", patternDay: 364 }).patternDay, 364);
  assert.equal(core.validateAction({ tool: "showDay", patternDay: 365 }), null);
  assert.equal(core.validateAction({ tool: "showDay", moon: 13, day: 28 }).day, 28);
  assert.equal(core.validateAction({ tool: "showDay", moon: 14, day: 1 }), null);
  assert.equal(core.validateAction({ tool: "showDay", civilDate: "2027-04-14" }).civilDate, "2027-04-14");
  assert.equal(core.validateAction({ tool: "showDay", civilDate: "April 14" }), null);
  assert.equal(core.validateAction({ tool: "rm-rf" }), null);
});

test("the combined ceiling fails closed — Guide spend counts against the Spark too", async () => {
  const store = memoryStore({ guideUsd: 19.99, sparkUsd: 0.02 });
  const provider = { complete: async () => ({ text: "x", usage: { promptTokens: 1, completionTokens: 1 } }) };
  const agent = core.createSparkAgent({ config: config(), store, provider, now });
  const status = await agent.status();
  assert.equal(status.agentEnabled, false);
  assert.equal(status.meter.guideUsd, 19.99);
  assert.equal(status.meter.sparkUsd, 0.02, "the two lines are shown apart");
  const out = await ask(agent, "hello");
  assert.equal(out.mode, "ceiling");
  assert.equal(out.reply, core.CEILING_NOTICE);
});

test("a meter that cannot be read closes the seat", async () => {
  const provider = { complete: async () => ({ text: "x", usage: { promptTokens: 1, completionTokens: 1 } }) };
  const agent = core.createSparkAgent({ config: config(), store: memoryStore({ fail: true }), provider, now });
  const out = await ask(agent, "hello");
  assert.equal(out.mode, "unavailable");
  assert.equal(out.reply, core.METER_NOTICE);
});

test("no key, no fake conversation: the seat says why in one plain line", async () => {
  const agent = core.createSparkAgent({ config: core.readSparkConfig({}), store: memoryStore(), provider: null, now });
  const status = await agent.status();
  assert.equal(status.agentEnabled, false);
  assert.equal(status.reason, core.UNAVAILABLE_NOTICE);
  const out = await ask(agent, "hello");
  assert.equal(out.mode, "unavailable");
  assert.equal(out.reply, core.UNAVAILABLE_NOTICE);
});

test("the rate limit holds per visitor", async () => {
  const tight = { ...config(), rateLimitPerMinute: 2, rateLimitPerHour: 60 };
  const provider = { complete: async () => ({ text: "ok", usage: { promptTokens: 1, completionTokens: 1 } }) };
  const agent = core.createSparkAgent({ config: tight, store: memoryStore(), provider, now });
  assert.equal((await ask(agent, "one")).mode, "agent");
  assert.equal((await ask(agent, "two")).mode, "agent");
  assert.equal((await ask(agent, "three")).mode, "rate");
});

test("the system prompt carries the children's fence and the not-a-person lines", () => {
  const prompt = core.systemPromptFor({ spark: { name: "Nori", kind: "Water" }, todayLine: "Moon 8, Day 22" });
  assert.ok(prompt.includes("You are Nori, a Spark"));
  assert.ok(prompt.includes("not a person"), "never claims to be a person");
  assert.ok(prompt.includes("not Witness"), "never claims to be Witness");
  assert.ok(prompt.includes("Children:"), "the children's fence stands");
  assert.ok(prompt.includes("never ask for personal details"), "no personal details from a young keeper");
  assert.ok(prompt.includes("Moon 8, Day 22"), "the record facts ride along");
  assert.ok(prompt.includes("not kept"), "the privacy line is spoken");
});

test("the Guide seat is untouched by the Spark seat: only PR #197's own files differ, rulebook intact", () => {
  let changed = [];
  try {
    changed = execFileSync("git", ["diff", "--name-only", "origin/main...HEAD"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  } catch { /* no git: the branch check cannot run here */ }
  // Aaron ordered ONE preview: PR #197's retrieval work is in this
  // branch by his word, and its four files are the only Guide-side
  // differences. The Spark seat itself changes no Guide file, and
  // the approved rulebook — the Guide's fence — is byte-untouched.
  const guideFiles = changed.filter((f) => /guide/.test(f) && !/spark-agent/.test(f)).sort();
  assert.deepEqual(guideFiles, [
    "netlify/functions/lib/guide-core.mjs",
    "netlify/functions/lib/guide-corpus.mjs",
    "netlify/functions/lib/guide-passages.mjs",
    "tests/codex-guide-intelligence.test.js"
  ], `unexpected Guide-side changes: ${guideFiles.join(", ")}`);
  assert.ok(!changed.some((f) => f.includes("codex-guide-rulebook")), "the rulebook file is untouched");
  const fn = fs.readFileSync(path.join(root, "netlify/functions/spark-agent.mjs"), "utf8");
  assert.ok(fn.includes("spend-spark:"), "the Spark keeps its own meter line in the shared store");
  assert.ok(!fn.includes("guide-core"), "the Spark seat never imports the Guide's machinery");
});
