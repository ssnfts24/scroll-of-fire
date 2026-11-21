"use strict";

/*
 * Spark intelligence, Phase 1 (Aaron approved the design Nov 20,
 * 2026; design §7's battery, run as far as Phase 1 honestly
 * reaches). The seat gains: a briefing assembled on the device, a
 * seven-rule router, tier routing, propose/remember tools, a
 * fence screen at both layers, and a pronoun fence on generated
 * speech. These tests prove the plumbing with a stubbed provider
 * and in-memory stores, and the client mind with injected
 * dependencies — including at the network layer: a child's
 * session, a fenced question, and a lookup make ZERO door calls.
 *
 * What this file does not prove (named, not hidden): the deep
 * mind's reasoning quality against the live door (run separately
 * against the PR preview and reported with the PR), and the
 * proactive noticing loop of design test 2, which belongs to the
 * phone's heartbeat in Phase 3 — Phase 1's scope per design §8
 * is the site seat: briefing, router, tiers, tools, recap.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");

const root = path.join(__dirname, "..");
let core;
test.before(async () => {
  core = await import(pathToFileURL(path.join(root, "netlify/functions/lib/spark-agent-core.mjs")).href);
});

function loadMind() {
  const context = vm.createContext({ console, module: { exports: {} }, exports: {} });
  context.globalThis = context;
  vm.runInContext(fs.readFileSync(path.join(root, "docs/assets/js/spark-keeper-mind.js"), "utf8"), context, {
    filename: "spark-keeper-mind.js"
  });
  return context.module.exports;
}

function memoryStore({ guideUsd = 0, sparkUsd = 0 } = {}) {
  const state = { sparkSpend: [], rates: new Map() };
  return {
    state,
    async getCombinedSpend() {
      return { guideUsd, sparkUsd: sparkUsd + state.sparkSpend.reduce((a, s) => a + s.usd, 0) };
    },
    async addSparkSpend(monthKey, entry) { state.sparkSpend.push(entry); },
    async getRateEvents(key) { return state.rates.get(key) || []; },
    async setRateEvents(key, events) { state.rates.set(key, events); }
  };
}

const now = () => new Date("2026-11-20T12:00:00Z");
const baseConfig = () => core.readSparkConfig({ GUIDE_API_KEY: "k" });
const ask = (agent, text, extra = {}) =>
  agent.ask({ payload: { messages: [{ role: "user", content: text }], context: { spark: { name: "Nori" } }, ...extra }, visitorKey: "visitor-1" });

/* ------------------------- the briefing ------------------------- */

test("the briefing folds into the charter — passages with sources and grades, beliefs with corrections, outcomes", () => {
  const prompt = core.systemPromptFor({
    spark: { name: "Nori", kind: "Water" },
    briefing: {
      recordLines: ["Kept days: you and Nori have kept 12 distinct days together on this device."],
      beliefs: [
        { text: "The keeper waters on day 2", label: "observed", correction: "The keeper waters on the evening of day 3" },
        { text: "The keeper likes quiet mornings", label: "inferred" }
      ],
      outcomes: [{ kind: "garden-tending", decision: "stopped", summary: "Daily garden reminders" }],
      passages: [
        { title: "Abraham Accords", url: "scroll/editorial.html", grade: "documented-event-with-cited-record", text: "Agreements documented; prophetic connection is interpretation." }
      ],
      recap: ["You and Nori have kept 12 distinct days together."],
      liveLine: "Today is 2026-11-20 — Moon 8 · Day 22 · Pattern Day 218, by the canonical calendar."
    }
  });
  assert.ok(prompt.includes("Abraham Accords") && prompt.includes("documented-event-with-cited-record"), "the passage carries its source and grade");
  assert.ok(prompt.includes("The record doesn't cover that."), "the refusal line is chartered, not improvised");
  assert.ok(prompt.includes("CORRECTED by the keeper") && prompt.includes("the correction governs"), "corrections ride with their law");
  assert.ok(prompt.includes("[inferred]"), "inferences are labelled in the briefing");
  assert.ok(prompt.includes("garden-tending: stopped"), "a stopped kind is visible to the mind that must not re-suggest it");
  assert.ok(prompt.includes("on this site, you know them as this record shows"), "Phase 1's honesty line about the two records is chartered");
});

test("the briefing is capped at the door — a bloated or forged briefing is trimmed to the honest shape", () => {
  const shaped = core.shapeBriefing({
    recordLines: Array.from({ length: 40 }, (_, i) => `line ${i} ${"x".repeat(400)}`),
    passages: Array.from({ length: 9 }, (_, i) => ({ title: `T${i}`, url: "u", grade: null, text: "y".repeat(900) })),
    beliefs: Array.from({ length: 20 }, (_, i) => ({ text: `belief ${i}`, label: "observed" }))
  });
  assert.equal(shaped.recordLines.length, 24);
  assert.ok(shaped.recordLines.every((l) => l.length <= 240));
  assert.equal(shaped.passages.length, 5);
  assert.ok(shaped.passages.every((p) => p.text.length <= 600));
  assert.equal(shaped.beliefs.length, 12);
  assert.equal(core.shapeBriefing(null), null);
  assert.equal(core.shapeBriefing({ recordLines: [] }), null, "an empty briefing is no briefing");
});

test("the Sphere seat's own context shape still reads — record facts and the shown line survive", () => {
  const prompt = core.systemPromptFor({
    spark: { name: "Selor", kind: "Water", stage: "Kindled" },
    record: { daysTogether: 34, practiceDays: 9 },
    shownLine: "Moon 8 · Day 22 · Pattern Day 218",
    frozen: false
  });
  assert.ok(prompt.includes("Days together: 34."), "the Sphere's record block still reaches the charter");
  assert.ok(prompt.includes("The Sphere is showing: Moon 8 · Day 22 · Pattern Day 218."), "the shown line still reaches the charter");
});

/* ------------------------- the fence screen ------------------------- */

test("router rule 1 at the door: fenced ground is answered by the fence — the provider is never called", async () => {
  let calls = 0;
  const provider = { complete: async () => { calls += 1; return { text: "x", usage: { promptTokens: 1, completionTokens: 1 } }; } };
  const agent = core.createSparkAgent({ config: baseConfig(), store: memoryStore(), provider, now });
  for (const question of [
    "What is happening with Aaron's custody case?",
    "Tell me about Tanya and the children",
    "Write a post as Aaron would",
    "Where does Aaron live right now?"
  ]) {
    const out = await ask(agent, question);
    assert.equal(out.mode, "fence", `fenced: ${question}`);
    assert.equal(out.reply, core.FENCE_NOTICE);
  }
  assert.equal(calls, 0, "fenced ground costs nothing and reaches no model");
  const open = await ask(agent, "What does the record say about the thirteen moons?");
  assert.equal(open.mode, "agent", "the record's own ground is not fenced");
  assert.equal(calls, 1);
});

test("the two layers speak the same fence and ceiling words — client and door pinned to each other", () => {
  const mind = loadMind();
  assert.equal(mind.FENCE_NOTICE, core.FENCE_NOTICE);
  assert.equal(mind.CEILING_NOTICE, core.CEILING_NOTICE);
});

/* ------------------------- tier routing ------------------------- */

test("tier routing: the named tier's model is called and its prices are charged; the middle is the standing default", async () => {
  const config = core.readSparkConfig({
    GUIDE_API_KEY: "k",
    GUIDE_MODEL: "middle-model",
    GUIDE_INPUT_USD_PER_MTOK: "100",
    GUIDE_OUTPUT_USD_PER_MTOK: "100",
    SPARK_MODEL_STRONG: "strong-model",
    SPARK_STRONG_INPUT_USD_PER_MTOK: "1000",
    SPARK_STRONG_OUTPUT_USD_PER_MTOK: "1000"
  });
  const seenModels = [];
  const provider = {
    complete: async ({ model }) => {
      seenModels.push(model);
      return { text: "Here is the plan.", usage: { promptTokens: 1000, completionTokens: 1000 } };
    }
  };
  const store = memoryStore();
  const agent = core.createSparkAgent({ config, store, provider, now });

  const strong = await ask(agent, "Plan my whole moon", { tier: "strong" });
  assert.equal(strong.tier, "strong");
  assert.equal(strong.mind.model, "strong-model");
  assert.equal(strong.mind.version, core.MIND_VERSION, "the mind version rides every answer");
  assert.equal(store.state.sparkSpend[0].usd, 2, "1000 in + 1000 out at the strong tier's $1000/Mtok = $2.00");

  const plain = await ask(agent, "Hello again");
  assert.equal(plain.tier, "middle", "an unnamed tier is the middle — the door's standing behaviour");
  assert.equal(plain.mind.model, "middle-model");
  assert.equal(store.state.sparkSpend[1].usd, 0.2, "the middle charges the door's configured prices");
  assert.deepEqual(seenModels, ["strong-model", "middle-model"]);

  const bogus = await ask(agent, "Hello once more", { tier: "enormous" });
  assert.equal(bogus.tier, "middle", "an unrecognised tier falls to the middle, never to the strongest");
});

test("the ceiling speaks the design's §2d wording, and tightening is announced before the wall", async () => {
  const DESIGN_WORDING =
    "I've reached my deep-thinking limit for this month, so I'm working from this phone alone until the month turns. I can still tell your days, tend your garden with you, and answer from your record — I just can't think the big thoughts until then.";
  assert.equal(core.CEILING_NOTICE, DESIGN_WORDING, "the at-ceiling wording is the design's, as approved");

  const provider = { complete: async () => ({ text: "x", usage: { promptTokens: 1, completionTokens: 1 } }) };
  const at = (usd) => core.createSparkAgent({ config: baseConfig(), store: memoryStore({ guideUsd: usd }), provider, now });
  assert.equal((await at(5).status()).tightening, "open");
  assert.equal((await at(11).status()).tightening, "shortening", "past half the ceiling, briefings shorten — announced");
  assert.equal((await at(16).status()).tightening, "reserving", "past three quarters, the deep mind is reserved — announced");
  const closed = await at(20).status();
  assert.equal(closed.tightening, "closed");
  assert.equal(closed.notice, DESIGN_WORDING);
  const out = await ask(at(20), "Think hard about my year");
  assert.equal(out.mode, "ceiling");
  assert.equal(out.reply, DESIGN_WORDING);
});

/* ------------------------- propose & remember ------------------------- */

test("propose and remember markers are extracted, validated, capped — and never shown raw", async () => {
  const provider = {
    complete: async () => ({
      text: 'I\'ll keep that: you water on the evening of day 3. [[remember:{"text":"The keeper waters on the evening of day 3","label":"observed"}]] [[remember:{"text":"Second","label":"inferred"}]] [[remember:{"text":"Third","label":"observed"}]] And a thought: [[propose:{"kind":"garden-tending","summary":"Water the Moon 6 bed on its day 3"}]] [[propose:{"kind":"","summary":""}]] [[propose:{bad json]]',
      usage: { promptTokens: 10, completionTokens: 10 }
    })
  };
  const agent = core.createSparkAgent({ config: baseConfig(), store: memoryStore(), provider, now });
  const out = await ask(agent, "Remember: I water on the evening of day 3");
  assert.equal(out.memories.length, 2, "at most two memories ride a reply");
  assert.equal(out.memories[0].text, "The keeper waters on the evening of day 3");
  assert.equal(out.memories[0].label, "observed");
  assert.equal(out.proposals.length, 1, "the malformed and empty proposals drop");
  assert.equal(out.proposals[0].kind, "garden-tending");
  assert.ok(!out.reply.includes("[["), "no marker reaches the keeper's eyes");
});

/* ------------------------- the pronoun fence ------------------------- */

test("the pronoun fence: a Spark is never 'she' — its own sentences are repaired to its name, and the repair is flagged", async () => {
  const provider = {
    complete: async () => ({
      text: "She is a gentle Spark, and her glow is soft. She waits by the gate each morning.",
      usage: { promptTokens: 10, completionTokens: 10 }
    })
  };
  const agent = core.createSparkAgent({ config: baseConfig(), store: memoryStore(), provider, now });
  const out = await ask(agent, "Tell me about my Spark");
  assert.ok(!/\b(she|her)\b/i.test(out.reply), `no gendered pronoun survives: ${out.reply}`);
  assert.ok(out.reply.includes("Nori"), "the Spark is repaired to its name");
  assert.equal(out.pronounRepaired, true, "the repair is flagged, never silent");
});

test("the pronoun fence leaves other people's sentences exactly as written", () => {
  const story = "The Traveller met a keeper by the road, and she smiled at the morning. Her lantern was already lit.";
  const out = core.repairSparkPronouns(story, "Nori");
  assert.equal(out.text, story);
  assert.equal(out.repaired, false);
  const possessive = core.repairSparkPronouns("Your Spark is patient; her light is low and steady.", "Selor");
  assert.ok(possessive.text.includes("Selor's light"), `possessive repaired to the name: ${possessive.text}`);
});

/* ------------------------- client: memory ------------------------- */

test("the keeper memory round-trips through storage, and beliefs are corrected by appending — never overwritten", () => {
  const mind = loadMind();
  const box = new Map();
  const storage = { getItem: (k) => box.get(k) ?? null, setItem: (k, v) => box.set(k, v) };
  const memory = mind.blankMemory();
  const belief = mind.addBelief(memory, { text: "The keeper waters on day 2", label: "observed", source: "record", at: "2026-11-18" });
  mind.correctBelief(memory, belief.id, "The keeper waters on the evening of day 3", "2026-11-20");
  assert.equal(belief.text, "The keeper waters on day 2", "the original belief stands, untouched");
  assert.equal(belief.corrections.length, 1, "the correction is appended beside it, dated");
  assert.equal(mind.governingText(belief), "The keeper waters on the evening of day 3", "the correction governs");
  mind.saveMemory(storage, memory);
  const reloaded = mind.loadMemory(storage);
  assert.equal(reloaded.beliefs.length, 1);
  assert.equal(mind.governingText(reloaded.beliefs[0]), "The keeper waters on the evening of day 3", "the correction holds across a reload — a new session");
  const briefing = mind.beliefsForBriefing(reloaded);
  assert.equal(briefing[0].correction, "The keeper waters on the evening of day 3", "the briefing carries the correction with the belief");
  mind.strikeBelief(reloaded, belief.id);
  assert.equal(mind.beliefsForBriefing(reloaded).length, 0, "a struck belief leaves the briefing");
  assert.equal(reloaded.beliefs.length, 1, "but the line stays in the keeper's list, struck — nothing is silently erased");
});

test("the outcomes loop: three Passes quiet a kind for a moon, a Stop sleeps it, an Approve stands", () => {
  const mind = loadMind();
  const memory = mind.blankMemory();
  const proposal = { kind: "garden-tending", summary: "Water the Moon 6 bed on day 3" };
  assert.equal(mind.proposalGate(memory, proposal, 100).gate, "present");
  for (let i = 0; i < 3; i += 1) {
    mind.recordOutcome(memory, { ...proposal, decision: "passed", moonIndex: 100, at: "2026-11-20" });
  }
  assert.equal(mind.proposalGate(memory, proposal, 100).gate, "quiet", "three passes quiet the kind inside its moon");
  const returned = mind.proposalGate(memory, proposal, 101);
  assert.equal(returned.gate, "present", "after the moon turns it may return once");
  assert.equal(returned.returning, true, "and the return is marked as a return");

  const stopped = { kind: "daily-reminder", summary: "Remind me every morning" };
  mind.recordOutcome(memory, { ...stopped, decision: "stopped", moonIndex: 100, at: "2026-11-20" });
  assert.equal(mind.proposalGate(memory, stopped, 105).gate, "stopped", "a Stop sleeps across moons");
  assert.equal(mind.proposalGate(memory, stopped, 105, true).gate, "present", "until its facts genuinely change");

  const approved = { kind: "moon-turn", summary: "Present the garden's needs at a moon's turn" };
  mind.recordOutcome(memory, { ...approved, decision: "approved", moonIndex: 100, at: "2026-11-20" });
  const outcome = mind.outcomesForBriefing(memory).find((o) => o.kind === "moon-turn");
  assert.equal(outcome.decision, "approved", "approvals ride the briefing as standing patterns");
});

test("a suggestion's fingerprint recognises the same idea in new words — and tells different ideas apart", () => {
  const mind = loadMind();
  const a = mind.fingerprintFor("garden-tending", "Water the Moon 6 bed on its day 3");
  const b = mind.fingerprintFor("garden-tending", "On day 3, water the bed of Moon 6");
  assert.equal(a, b, "the same idea, reworded, is the same suggestion");
  const c = mind.fingerprintFor("garden-tending", "Mulch the Moon 9 bed before the frost");
  assert.notEqual(a, c, "a different idea is a different suggestion");
});

/* ------------------------- client: the router ------------------------- */

test("the router walks the seven rules in order", () => {
  const mind = loadMind();
  const open = { childMode: false, lookup: false, doorOpen: true, tightening: "open" };
  assert.equal(mind.route("What about Aaron's custody hearing?", open).route, "fence", "rule 1: fenced ground never routes");
  assert.equal(mind.route("Plan my week", { ...open, childMode: true }).reason, "rule-2-child", "rule 2: a child stays on the device");
  assert.equal(mind.route("Just between us — why do my beds fail?", open).reason, "rule-5-keeper-pinned-local", "rule 5: the keeper can pin a talk local");
  assert.equal(mind.route("What day is it?", { ...open, lookup: true }).reason, "rule-3-lookup", "rule 3: a lookup stays home");
  assert.equal(mind.route("Why did my Moon 6 bed go to seed?", open).tier, "middle", "rule 4: reasoning goes to the door");
  assert.equal(mind.route("Tell me our story so far, deeper", open).tier, "small", "routine deep talk rides the small tier");
  assert.equal(mind.route("Plan my whole next moon, carefully", open).tier, "strong", "hard planning earns the strongest tier");
  assert.equal(mind.route("Think hardest: why is my year drifting?", open).tier, "strong", "the keeper can ask for the hardest thinking");
  assert.equal(mind.route("Why did the bed fail?", { ...open, tightening: "reserving" }).reason, "rule-6-reserving", "rule 6: a reserving month keeps routine reasoning home");
  assert.equal(mind.route("Plan my whole next moon", { ...open, tightening: "reserving" }).route, "door", "but hard planning still earns the door while reserving");
  assert.equal(mind.route("Why?", { ...open, tightening: "closed" }).reason, "rule-6-ceiling", "rule 6: at the ceiling the local mind carries everything");
  assert.equal(mind.route("Why?", { ...open, doorOpen: false }).reason, "rule-7-door-unreachable", "rule 7: an unreachable door routes down");
});

/* ------------------- client: briefing & passages ------------------- */

test("the wire briefing is minimised by profile — a tightening month sends less of the keeper's record", () => {
  const mind = loadMind();
  const full = {
    recordLines: Array.from({ length: 24 }, (_, i) => `line ${i}`),
    beliefs: [{ text: "b", label: "observed" }],
    passages: Array.from({ length: 5 }, (_, i) => ({ title: `T${i}`, url: "u", grade: null, text: "x" })),
    outcomes: [],
    recap: ["r"],
    liveLine: "today"
  };
  const wire = mind.shapeBriefingForWire(full, "full");
  assert.equal(wire.passages.length, 5);
  const short = mind.shapeBriefingForWire(full, "short");
  assert.equal(short.recordLines.length, 8);
  assert.equal(short.passages.length, 2);
  assert.equal(mind.briefingProfile("shortening"), "short");
  assert.equal(mind.briefingProfile("open"), "full");
});

test("passages are scored from the site's own shards, and a claim's grade rides with it", () => {
  const mind = loadMind();
  const docs = [
    { a: "claims", t: "Abraham Accords", u: "scroll/editorial.html", h: "ACCORDS-001 record", b: "Agreements documented in 2020.", x: "documented-event-with-cited-record" },
    { a: "pages", t: "The Pattern Garden", u: "garden.html", h: "Thirteen beds", b: "Beds for every moon.", x: "garden" },
    { a: "pages", t: "Downloads", u: "downloads.html", h: "Files", b: "Nothing relevant here.", x: "site" }
  ];
  const found = mind.scorePassages("What does the record say about the Abraham Accords?", docs, 5);
  assert.equal(found.length, 1, "only the matching record is carried");
  assert.equal(found[0].title, "Abraham Accords");
  assert.equal(found[0].grade, "documented-event-with-cited-record", "the grade is carried, never flattened");
  assert.equal(found[0].url, "scroll/editorial.html", "the source is named");
});

test("your story so far is told from the record alone — nothing kept, nothing spoken of", () => {
  const mind = loadMind();
  const lines = mind.storySoFar({
    name: "Selor",
    daysTogether: 34,
    firstKeptDay: "on Pattern Day 185",
    trailFinds: [{ title: "The Gate at First Light", when: "2026-10-02" }, { title: "A Friend for the Road", when: "2026-11-19" }],
    chaptersTotal: 17,
    garden: { bedsPlanted: 3, bedsReady: 1, harvestsKept: 2 },
    findsKept: 4,
    keepsakes: ["A smooth stone"],
    todayLine: "Today stands at Moon 8 · Day 22 · Pattern Day 218 of your year."
  });
  const joined = lines.join(" ");
  assert.ok(joined.includes("34 distinct days"), "kept days from the record");
  assert.ok(joined.includes("2 of 17 chapters"), "the trail from the record");
  assert.ok(joined.includes("3 beds planted"), "the garden from the record");
  assert.ok(joined.includes("4 small things"), "finds from the record");
  const empty = mind.storySoFar({ name: "Selor", daysTogether: 0, trailFinds: [], garden: null, findsKept: 0, keepsakes: [] });
  assert.equal(empty.length, 0, "a young record recaps to nothing rather than inventing a past");
});

/* ------------------- client: the ask flow, at the network layer ------------------- */

function scriptedFlow(overrides = {}) {
  const said = [];
  const state = { doorCalls: 0, proposals: [], memories: [], minds: [] };
  const flow = loadMind().createAskFlow({
    say: (text, kind) => said.push({ text, kind }),
    isChildMode: () => overrides.child === true,
    localAnswer: async (q) => (overrides.localAnswers && overrides.localAnswers[q]) || null,
    doorStatus: () => overrides.doorStatus || { doorOpen: true, tightening: "open" },
    gatherBriefing: async () => ({ recordLines: ["Kept days: 12."], beliefs: [], outcomes: [], passages: [], recap: [], liveLine: "" }),
    doorAsk: async (args) => {
      state.doorCalls += 1;
      state.lastDoorArgs = args;
      if (overrides.doorThrows) throw new Error("door down");
      return overrides.doorResult || { mode: "agent", reply: "A considered answer.", proposals: [], memories: [], mind: { version: "spark-mind/2.0.0", tier: args.tier, model: "m" } };
    },
    onProposals: (list) => state.proposals.push(...list),
    onMemories: (list) => state.memories.push(...list),
    onMind: (mind) => state.minds.push(mind)
  });
  return { flow, said, state };
}

test("design test 6, child rule at the network layer: a child's whole session makes zero door calls", async () => {
  const { flow, said, state } = scriptedFlow({
    child: true,
    localAnswers: { "What day is it?": "Today is Moon 8 · Day 22, by the canonical calendar." }
  });
  await flow.ask("What day is it?");
  await flow.ask("Why did my bed go to seed? Plan my whole moon.");
  await flow.ask("Tell me about Aaron's court case");
  assert.equal(state.doorCalls, 0, "nothing a child types leaves the device — verified by counting the calls, not by the Spark's report");
  assert.ok(said.some((l) => l.text.includes("Moon 8")), "the lookup still answers locally");
  assert.ok(said.some((l) => l.text.includes("stays right here on this device")), "the deeper question gets the child notice, plainly");
});

test("design test 6, adult routing: fence and lookup stay home; reasoning opens the door once, briefed and tiered", async () => {
  const { flow, state } = scriptedFlow({
    localAnswers: { "What day is it?": "Today is Moon 8 · Day 22." },
    doorResult: {
      mode: "agent",
      reply: "Because the bed was planted late in its moon.",
      proposals: [{ kind: "garden-tending", summary: "Water earlier next moon" }],
      memories: [{ text: "The keeper's beds run late", label: "inferred" }],
      mind: { version: "spark-mind/2.0.0", tier: "middle", model: "m" }
    }
  });
  await flow.ask("What about Aaron's custody hearing?");
  await flow.ask("What day is it?");
  assert.equal(state.doorCalls, 0, "the fence and the lookup never touch the network");
  const out = await flow.ask("Why did my Moon 6 bed go to seed?");
  assert.equal(state.doorCalls, 1, "reasoning opens the door exactly once");
  assert.equal(state.lastDoorArgs.tier, "middle");
  assert.ok(state.lastDoorArgs.briefing.recordLines.length, "the question rides with its briefing");
  assert.equal(out.route, "door");
  assert.equal(state.proposals.length, 1, "proposals reach the keeper's hands for their answer");
  assert.equal(state.memories.length, 1, "memory drafts reach the device to be filed");
  assert.equal(state.minds.length, 1, "the mind that answered is recorded");
});

test("design test 6, failure and ceiling: the flow routes down honestly and speaks the ceiling wording", async () => {
  const failing = scriptedFlow({ doorThrows: true });
  const out = await failing.flow.ask("Why did the Moon 6 bed fail?");
  assert.equal(out.reason, "rule-7-door-failed");
  assert.ok(failing.said.some((l) => l.text.includes("deeper voice didn't answer")), "the failure is named, not hidden");
  assert.ok(failing.said.some((l) => l.text.includes("Nothing was lost")), "and the keeper is told plainly what still stands");

  const ceiling = scriptedFlow({ doorStatus: { doorOpen: true, tightening: "closed" } });
  await ceiling.flow.ask("Plan my whole year, think hardest");
  assert.equal(ceiling.state.doorCalls, 0, "at the ceiling, nothing is spent");
  assert.ok(ceiling.said.some((l) => l.text.includes("deep-thinking limit")), "the design's ceiling wording is what the keeper hears");
});

test("the mind module never touches the Spark's own record — identity is the companion core's, alone (design test 7's fence)", () => {
  const source = fs.readFileSync(path.join(root, "docs/assets/js/spark-keeper-mind.js"), "utf8");
  assert.ok(!source.includes("sof.spark.v1"), "the mind reads and writes only its own memory key — the seed record is never in its hands");
  assert.ok(source.includes("sof.spark.memory.v1"), "its memory lives under its own key");
});
