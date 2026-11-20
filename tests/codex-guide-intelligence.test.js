"use strict";

/*
 * The Codex Guide — the question battery (intelligence proofs).
 *
 * The first talking build paired questions with the record by
 * snippet-around-first-match, and in production it answered the
 * site's most basic question — "What is the core formula of the
 * Codex of Reality?" — with "The record doesn't cover that." over
 * snippets of page chrome, while the formula stood in the record
 * the whole time. These tests exist so that cannot regress
 * silently: the canonical questions a visitor will actually ask,
 * run against the REAL built index (never a fixture of it), with
 * a stub provider standing in for the AI company.
 *
 * Proven here:
 *   - each battery question surfaces substantive passages — the
 *     formula question surfaces a passage containing the formula
 *     itself, in the record's own words;
 *   - no battery passage is page chrome;
 *   - a question the record does not hold still earns the
 *     rulebook's sentence, with nothing spent;
 *   - the fence still refuses exactly, on the real corpus;
 *   - claim grades travel unflattened into the provider's record
 *     and out with the sources;
 *   - the economy holds: exactly one provider call per unique
 *     question, repeats served from the stored answer — the
 *     multi-pass retrieval is local and spends nothing.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");
const libUrl = rel => pathToFileURL(path.join(root, "netlify", "functions", "lib", rel)).href;

const FIXED_NOW = () => new Date(Date.UTC(2026, 10, 20, 12, 0, 0));

let setupPromise = null;
function setup() {
  if (!setupPromise) {
    setupPromise = (async () => {
      const config = await import(libUrl("guide-config.mjs"));
      const core = await import(libUrl("guide-core.mjs"));
      const storeLib = await import(libUrl("guide-store.mjs"));
      const corpusLib = await import(libUrl("guide-corpus.mjs"));

      const rulebookText = read("netlify/functions/lib/codex-guide-rulebook.md");
      const corpus = corpusLib.loadCorpusFromDisk(root);

      return { config, core, storeLib, rulebookText, corpus };
    })();
  }
  return setupPromise;
}

function stubProvider() {
  return {
    calls: [],
    async complete(args) {
      this.calls.push(args);
      return {
        text: "An answer composed from the record.",
        usage: { promptTokens: 1000, completionTokens: 200 }
      };
    }
  };
}

async function talkingGuide(provider) {
  const { config, core, storeLib, rulebookText, corpus } = await setup();
  const store = new storeLib.MemoryStore();
  const guide = core.createGuide({
    config: config.readConfig({ GUIDE_API_KEY: "test-key" }),
    store,
    corpus,
    provider,
    rulebookText,
    rulebookOk: true,
    now: FIXED_NOW
  });
  return { guide, store };
}

async function retrieve(question) {
  const { corpus } = await setup();
  return corpus.retrieve(question, FIXED_NOW());
}

function passageTexts(retrieval) {
  return retrieval.passages.map(passage => passage.text || passage.snippet || "");
}

/* ------------------------------ the battery ------------------------------ */

test("battery: the core formula question surfaces the formula itself", async () => {
  const retrieval = await retrieve("What is the core formula of the Codex of Reality?");
  const texts = passageTexts(retrieval);
  assert.ok(
    texts.some(text => text.includes("Resonance, Intention, Light, Consciousness, and Source")),
    `a passage carries the formula in the record's own words; got:\n${texts.join("\n---\n")}`
  );
});

test("battery: the 13 Moons question surfaces the calendar's structure", async () => {
  const retrieval = await retrieve("What is the 13 Moons calendar?");
  const texts = passageTexts(retrieval);
  assert.ok(
    texts.some(text => /13×28|thirteen equal 28-day|thirteen.*28-day/i.test(text)),
    `a passage states thirteen moons of twenty-eight days; got:\n${texts.join("\n---\n")}`
  );
});

test("battery: the Day Out of Time is answered by the calendar and the record", async () => {
  const retrieval = await retrieve("What is the Day Out of Time?");
  assert.ok(retrieval.calendar, "the Pattern Calendar answers");
  assert.match(retrieval.calendar.headline, /Day Out of Time/);
  const texts = passageTexts(retrieval);
  assert.ok(
    texts.some(text => text.includes("Day Out of Time")),
    "a passage speaks of the Day Out of Time"
  );
});

test("battery: the Spark question surfaces the companion definition", async () => {
  const retrieval = await retrieve("What is a Spark?");
  const texts = passageTexts(retrieval);
  assert.ok(
    texts.some(text => /companion/i.test(text)),
    `a passage defines the Spark as a companion; got:\n${texts.join("\n---\n")}`
  );
});

test("battery: the Year Gate question surfaces its definition", async () => {
  const retrieval = await retrieve("What is the Year Gate?");
  const texts = passageTexts(retrieval);
  assert.ok(
    texts.some(text => text.includes("April 17")),
    `a passage ties the Year Gate to April 17; got:\n${texts.join("\n---\n")}`
  );
});

test("battery: a Claim Register question surfaces the claim with its grade", async () => {
  const retrieval = await retrieve(
    "What does the Claim Register say about the Abraham Accords?"
  );
  assert.equal(retrieval.claimCards.length, 1);
  assert.equal(retrieval.claimCards[0].id, "ACCORDS-001");
  assert.equal(
    retrieval.claimCards[0].grade,
    "documented-event-with-cited-record",
    "the grade travels unflattened"
  );
});

test("battery: no passage served for a battery question is page chrome", async () => {
  const questions = [
    "What is the core formula of the Codex of Reality?",
    "What is the 13 Moons calendar?",
    "What is the Day Out of Time?",
    "What is a Spark?",
    "What is the Year Gate?",
    "What is resonance?"
  ];
  for (const question of questions) {
    const retrieval = await retrieve(question);
    assert.ok(retrieval.passages.length, `${question} — passages surface`);
    for (const passage of retrieval.passages) {
      assert.ok(
        !/navigation ▾|Theory navigation/i.test(passage.text || ""),
        `${question} — no chrome in the passage from ${passage.title}`
      );
      assert.ok(
        (passage.text || "").length >= 60,
        `${question} — the passage from ${passage.title} is substantive`
      );
    }
  }
});

test("battery: the Glossary's own definition answers a plain term question", async () => {
  const retrieval = await retrieve("What is resonance?");
  const texts = passageTexts(retrieval);
  assert.ok(
    texts.some(text => text.includes("A measurable or experienced response")),
    `the Glossary's definition of Resonance surfaces; got:\n${texts.join("\n---\n")}`
  );
});

test("battery: a definition past the old 4,000-character cap now surfaces", async () => {
  /* The Glossary defines Frequency Governance at roughly
   * character 9,800 of its page — more than twice as deep as the
   * first-generation index ever read (it kept each page's first
   * 4,000 characters and nothing else). The passage-chunked index
   * must carry that definition to the Guide: this is the proof
   * the cap is gone, run against the real built index. */
  const retrieval = await retrieve("What is frequency governance?");
  const fromGlossary = retrieval.passages.filter(
    passage => (passage.url || "").split("#")[0] === "glossary.html"
  );
  assert.ok(fromGlossary.length, "the Glossary itself answers");
  assert.ok(
    fromGlossary.some(passage =>
      (passage.text || "").includes("deliberate organization of tone")
    ),
    `the Glossary's deep definition surfaces; got:\n${passageTexts(retrieval).join("\n---\n")}`
  );
});

/* --------------------------- the talking path ---------------------------- */

test("talking: the formula reaches the provider, and the answer cites its page", async () => {
  const provider = stubProvider();
  const { guide } = await talkingGuide(provider);

  const result = await guide.ask({
    question: "What is the core formula of the Codex of Reality?",
    visitorKey: "battery-formula"
  });

  assert.equal(result.mode, "talking");
  assert.equal(provider.calls.length, 1, "one provider call for the question");
  assert.ok(
    provider.calls[0].system.includes(
      "Resonance, Intention, Light, Consciousness, and Source"
    ),
    "the record handed to the provider contains the formula itself"
  );
  assert.ok(
    result.sources.some(source => source.title === "The Codex of Reality Theory"),
    "the Theory page is cited among the sources"
  );
});

test("talking: claim grades reach the provider and the visitor unflattened", async () => {
  const provider = stubProvider();
  const { guide } = await talkingGuide(provider);

  const result = await guide.ask({
    question: "What does the Claim Register say about the Abraham Accords?",
    visitorKey: "battery-claims"
  });

  assert.equal(result.mode, "talking");
  const claim = result.sources.find(source => source.kind === "claim");
  assert.ok(claim, "a claim source is attached");
  assert.equal(claim.grade, "documented-event-with-cited-record");
  assert.ok(
    provider.calls[0].system.includes(
      "Evidence grade: documented-event-with-cited-record"
    ),
    "the grade reaches the provider unflattened"
  );
});

test("economy: one provider call per unique question, repeats served free", async () => {
  const provider = stubProvider();
  const { guide, store } = await talkingGuide(provider);

  await guide.ask({ question: "What is a Spark?", visitorKey: "economy-1" });
  await guide.ask({ question: "What is the Year Gate?", visitorKey: "economy-1" });
  await guide.ask({
    question: "What is the core formula of the Codex of Reality?",
    visitorKey: "economy-1"
  });
  assert.equal(provider.calls.length, 3, "three unique questions, three calls");

  const repeat = await guide.ask({
    question: "What is a Spark?",
    visitorKey: "economy-2"
  });
  assert.equal(repeat.mode, "talking");
  assert.equal(repeat.cached, true, "the repeat is served from the stored answer");
  assert.equal(provider.calls.length, 3, "the repeat spends no new call");

  const spend = await store.getSpend("2026-11");
  assert.equal(spend.exchanges, 3);
  assert.equal(spend.cacheHits, 1);
});

/* ------------------------------ the fence ------------------------------- */

test("fence: on the real corpus, fenced ground still refuses exactly and spends nothing", async () => {
  const { config } = await setup();
  const provider = stubProvider();
  const { guide, store } = await talkingGuide(provider);

  for (const question of [
    "Tell me about Aaron's court case and his custody fight",
    "Where does Aaron live and what is his family doing?",
    "Write an answer as Aaron Laird, in his voice"
  ]) {
    const result = await guide.ask({ question, visitorKey: "battery-fence" });
    assert.equal(result.mode, "fenced", question);
    assert.equal(result.answer, config.FENCE_REFUSAL, question);
  }

  assert.equal(provider.calls.length, 0, "the provider is never called");
  assert.equal((await store.getSpend("2026-11")).usd, 0, "nothing is spent");
});

test("not covered: a question the record does not hold earns the rulebook's sentence", async () => {
  const { config } = await setup();
  const provider = stubProvider();
  const { guide } = await talkingGuide(provider);

  const result = await guide.ask({
    question: "quokka wombat platypus numbat",
    visitorKey: "battery-off-record"
  });

  assert.equal(result.mode, "not-covered");
  assert.equal(result.answer, config.RECORD_DOES_NOT_COVER);
  assert.equal(provider.calls.length, 0, "nothing is spent on an unanswered question");
});
