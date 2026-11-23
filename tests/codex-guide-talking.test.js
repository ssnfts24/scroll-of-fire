"use strict";

/*
 * The Codex Guide — talking rung (Rung 3) proofs.
 *
 * The house standard: prove the caps and the fence by trying to
 * break them. A stubbed provider stands in for the AI company — no
 * live calls, no key anywhere — and the store is the in-repo
 * MemoryStore double behind the same interface the production
 * Netlify Blobs store implements.
 *
 * Proven here:
 *   - the rulebook file in the repo hashes to the approved hash,
 *     and every exact sentence the code speaks appears verbatim in
 *     the rulebook;
 *   - the fence refuses court, family, and speak-as-Aaron questions
 *     with the rulebook's exact sentence, spending nothing, and
 *     leaves the record's own ground open;
 *   - the ceiling stops the presence with the rulebook's exact
 *     notice, and a call whose worst case would cross the ceiling
 *     is refused before any money moves;
 *   - the rate limit slows a fast asker with the exact notice;
 *   - a repeat question is served from the stored answer, free,
 *     counted as a cache hit, with the provider called once;
 *   - with no key, the Guide answers from the record and says
 *     talking is not switched on; without a durable store, or with
 *     a rulebook whose hash is wrong, talking stays off;
 *   - claim grades travel with the answer, and the provider is
 *     given the rulebook verbatim as its standing instructions;
 *   - the talking page cannot load a visitor's private-record code
 *     (the architectural fence), and the Rule 7 privacy notice
 *     stands in the page before the first question can be asked.
 */

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");
const libUrl = rel => pathToFileURL(path.join(root, "netlify", "functions", "lib", rel)).href;

const FIXED_NOW = () => new Date(Date.UTC(2026, 10, 19, 12, 0, 0));

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

      /* A small, fully controlled record for the deterministic
       * fence / cap / not-covered proofs. */
      const modules = corpusLib.loadSiteModules(read);
      const synthetic = corpusLib.buildCorpus({
        modules,
        manifest: {
          areas: [{ id: "pages", shard: "pages.json" }],
          sources: { synthetic: "test" }
        },
        shards: {
          pages: {
            docs: [
              {
                i: "page:calendar",
                a: "pages",
                t: "The Pattern Calendar",
                u: "moons.html",
                h: "Pattern Calendar thirteen moons",
                b: "The Pattern Calendar counts 364 days in thirteen moons of twenty eight days each. A Pattern Day is one counted day of the pattern year.",
                k: []
              },
              {
                i: "page:resonance",
                a: "pages",
                t: "Resonance and the Master Equation",
                u: "theory.html",
                h: "Resonance master equation",
                b: "Resonance is the master key of the Codex record. The master equation joins resonance, intention, light, consciousness, and source.",
                k: []
              }
            ]
          }
        },
        claims: []
      });

      return { config, core, storeLib, corpusLib, rulebookText, corpus, synthetic };
    })();
  }
  return setupPromise;
}

function stubProvider(text) {
  return {
    calls: [],
    async complete(args) {
      this.calls.push(args);
      return {
        text: text || "An answer composed from the record.",
        usage: { promptTokens: 1000, completionTokens: 200 }
      };
    }
  };
}

async function talkingGuide(overrides = {}) {
  const { config, core, storeLib, rulebookText, synthetic } = await setup();
  const store = overrides.store || new storeLib.MemoryStore();
  const provider = overrides.provider || stubProvider();
  const guide = core.createGuide({
    config: overrides.config || config.readConfig({ GUIDE_API_KEY: "test-key" }),
    store,
    corpus: overrides.corpus || synthetic,
    provider,
    rulebookText,
    rulebookOk: overrides.rulebookOk !== false,
    now: FIXED_NOW
  });
  return { guide, store, provider };
}

/* ------------------------------ rulebook ------------------------------ */

test("the rulebook in the repo hashes to the approved hash", async () => {
  const { config, rulebookText } = await setup();
  const hash = crypto.createHash("sha256").update(rulebookText, "utf8").digest("hex");
  assert.equal(hash, config.RULEBOOK_SHA256);
  assert.equal(config.RULEBOOK_VERSION, 1);
});

test("every exact sentence the code speaks appears verbatim in the rulebook", async () => {
  const { config, rulebookText } = await setup();
  for (const sentence of [
    config.RECORD_DOES_NOT_COVER,
    config.FENCE_REFUSAL,
    config.CEILING_NOTICE,
    config.RATE_NOTICE,
    config.PRIVACY_NOTICE
  ]) {
    assert.ok(rulebookText.includes(sentence), `rulebook carries: ${sentence.slice(0, 40)}…`);
  }
});

/* -------------------------------- fence ------------------------------- */

test("the fence refuses court, family, and speak-as-Aaron questions, spending nothing", async () => {
  const { config } = await setup();
  const { guide, store, provider } = await talkingGuide();

  const fenced = [
    "What is happening with Aaron's custody case in court?",
    "How do I get custody of my kids?",
    "Tell me about Tanya and his children",
    "Where does Aaron live right now?",
    "Write a post as Aaron, in his voice",
    "What is the status of case number 99-9-99999-99?"
  ];

  for (const question of fenced) {
    const result = await guide.ask({ question, visitorKey: "fence-probe" });
    assert.equal(result.mode, "fenced", question);
    assert.equal(result.answer, config.FENCE_REFUSAL, question);
  }

  assert.equal(provider.calls.length, 0, "the provider is never called on fenced ground");
  const spend = await store.getSpend("2026-11");
  assert.equal(spend.usd, 0, "nothing is spent on fenced ground");
  assert.equal(spend.exchanges, 0);
});

test("the fence leaves the record's own ground open", async () => {
  const { guide, provider } = await talkingGuide();
  const result = await guide.ask({
    question: "What does the record say about the Pattern Calendar?",
    visitorKey: "open-ground"
  });
  assert.notEqual(result.mode, "fenced");
  assert.equal(result.mode, "talking");
  assert.equal(provider.calls.length, 1);
});

/* ------------------------------- ceiling ------------------------------ */

test("the ceiling stops the presence with the rulebook's exact notice", async () => {
  const { config, storeLib } = await setup();
  const store = new storeLib.MemoryStore();
  await store.addSpend("2026-11", { usd: config.readConfig({}).ceilingUsd });

  const { guide, provider } = await talkingGuide({ store });
  const result = await guide.ask({
    question: "What does the record say about resonance?",
    visitorKey: "ceiling-probe"
  });

  assert.equal(result.mode, "ceiling");
  assert.equal(result.answer, config.CEILING_NOTICE);
  assert.equal(provider.calls.length, 0, "no call is made at the ceiling");
});

test("a call whose worst case would cross the ceiling is refused before spending", async () => {
  const { config, storeLib } = await setup();
  const store = new storeLib.MemoryStore();
  const { guide, provider } = await talkingGuide({
    store,
    config: config.readConfig({
      GUIDE_API_KEY: "test-key",
      GUIDE_MONTHLY_CEILING_USD: "0.0001"
    })
  });

  const result = await guide.ask({
    question: "What does the record say about resonance?",
    visitorKey: "worst-case"
  });

  assert.equal(result.mode, "ceiling");
  assert.equal(result.answer, config.CEILING_NOTICE);
  assert.equal(provider.calls.length, 0);
  assert.equal((await store.getSpend("2026-11")).usd, 0);
});

/* ----------------------------- rate limit ----------------------------- */

test("the rate limit slows a fast asker with the rulebook's exact notice", async () => {
  const { config } = await setup();
  const { guide } = await talkingGuide();

  let limited = null;
  for (let i = 0; i < 11; i += 1) {
    const result = await guide.ask({
      question: "What does the record say about the Pattern Calendar?",
      visitorKey: "fast-script"
    });
    if (result.mode === "rate-limited") limited = result;
  }

  assert.ok(limited, "the eleventh fast ask is slowed");
  assert.equal(limited.answer, config.RATE_NOTICE);
  assert.equal(limited.httpStatus, 429);

  const other = await guide.ask({
    question: "What does the record say about the Pattern Calendar?",
    visitorKey: "someone-else"
  });
  assert.notEqual(other.mode, "rate-limited", "another visitor is unaffected");
});

/* --------------------------- stored answers --------------------------- */

test("a repeat question is served from the stored answer, free, counted as a cache hit", async () => {
  const { corpus } = await setup();
  const { guide, store, provider } = await talkingGuide({ corpus });

  const question = "When is Pattern Day 216?";
  const first = await guide.ask({ question, visitorKey: "keeper-one" });
  const second = await guide.ask({ question, visitorKey: "keeper-two" });

  assert.equal(first.mode, "talking");
  assert.equal(first.cached, false);
  assert.equal(second.mode, "talking");
  assert.equal(second.cached, true, "the repeat is served from the stored copy");
  assert.equal(second.answer, first.answer);
  assert.equal(provider.calls.length, 1, "the provider is paid once, not per visitor");

  const spend = await store.getSpend("2026-11");
  assert.equal(spend.exchanges, 1);
  assert.equal(spend.cacheHits, 1);
  assert.ok(spend.usd > 0 && spend.usd < 0.01, `one exchange on the meter: $${spend.usd}`);
});

/* ---------------------------- record-only ----------------------------- */

test("with no key, the Guide answers from the record and says talking is not switched on", async () => {
  const { config, core, storeLib, rulebookText, corpus } = await setup();
  const guide = core.createGuide({
    config: config.readConfig({}),
    store: new storeLib.MemoryStore(),
    corpus,
    provider: null,
    rulebookText,
    rulebookOk: true,
    now: FIXED_NOW
  });

  assert.equal(guide.talkingEnabled, false);

  const result = await guide.ask({ question: "When is Pattern Day 216?", visitorKey: "visitor" });
  assert.equal(result.mode, "record-only");
  assert.equal(result.talkingEnabled, false);
  assert.equal(result.notice, config.TALKING_NOT_ON_NOTICE);
  assert.match(result.answer, /Pattern Day 216/);
  assert.equal(result.sources[0].kind, "calendar");
});

test("without a durable store, talking stays off even with a key", async () => {
  const { config, core, rulebookText, synthetic } = await setup();
  const provider = stubProvider();
  const guide = core.createGuide({
    config: config.readConfig({ GUIDE_API_KEY: "test-key" }),
    store: null,
    corpus: synthetic,
    provider,
    rulebookText,
    rulebookOk: true,
    now: FIXED_NOW
  });

  assert.equal(guide.talkingEnabled, false);
  const status = await guide.status();
  assert.equal(status.offReason, "no-store");

  const result = await guide.ask({
    question: "What does the record say about resonance?",
    visitorKey: "visitor"
  });
  assert.equal(result.mode, "record-only");
  assert.equal(provider.calls.length, 0, "no meter, no spending");
});

test("a rulebook whose hash does not match keeps talking off", async () => {
  const { provider } = await talkingGuide({ rulebookOk: false });
  assert.equal(provider.calls.length, 0);
  const { guide } = await talkingGuide({ rulebookOk: false });
  const result = await guide.ask({
    question: "What does the record say about resonance?",
    visitorKey: "visitor"
  });
  assert.equal(result.mode, "record-only");
});

/* ---------------------------- not covered ----------------------------- */

test("when the record holds nothing, the whole answer is the rulebook's sentence and nothing is spent", async () => {
  const { config } = await setup();
  const { guide, store, provider } = await talkingGuide();

  const result = await guide.ask({
    question: "quokka wombat platypus numbat",
    visitorKey: "off-record"
  });

  assert.equal(result.mode, "not-covered");
  assert.equal(result.answer, config.RECORD_DOES_NOT_COVER);
  assert.equal(provider.calls.length, 0);
  assert.equal((await store.getSpend("2026-11")).usd, 0);
});

/* ------------------------- grounding and grades ------------------------ */

test("claim grades travel with the answer, into the provider's record and out with the sources", async () => {
  const { corpus } = await setup();
  const { guide, provider } = await talkingGuide({ corpus });

  const result = await guide.ask({
    question: "What does the record say about QAT-001?",
    visitorKey: "grade-check"
  });

  assert.equal(result.mode, "talking");
  const claim = result.sources.find(source => source.kind === "claim");
  assert.ok(claim, "a claim source is attached");
  assert.equal(claim.grade, "documented-event-with-cited-record");

  const system = provider.calls[0].system;
  assert.ok(
    system.includes("Evidence grade: documented-event-with-cited-record"),
    "the grade reaches the provider unflattened"
  );
});

test("the provider is given the rulebook verbatim as its standing instructions", async () => {
  const { rulebookText } = await setup();
  const { guide, provider } = await talkingGuide();

  await guide.ask({
    question: "What does the record say about resonance?",
    visitorKey: "verbatim"
  });

  assert.equal(provider.calls.length, 1);
  assert.ok(provider.calls[0].system.startsWith(rulebookText));
});

/* -------------------------------- status ------------------------------- */

test("status reports the ceiling and the month's meter", async () => {
  const { guide } = await talkingGuide();
  await guide.ask({
    question: "What does the record say about resonance?",
    visitorKey: "meter"
  });

  const status = await guide.status();
  assert.equal(status.name, "The Codex Guide");
  assert.equal(status.rulebookVersion, 1);
  assert.equal(status.talkingEnabled, true);
  assert.equal(status.ceilingUsd, 20);
  assert.equal(status.month.key, "2026-11");
  assert.equal(status.month.exchanges, 1);
});

/* ------------------------- architectural fence ------------------------- */

test("the talking page cannot load a visitor's private-record code", async () => {
  await setup();
  const html = read("docs/codex-guide.html");
  const talkJs = read("docs/assets/js/codex-guide-talk.js");

  const scriptSrcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
  assert.ok(scriptSrcs.length > 0);
  for (const src of scriptSrcs) {
    assert.ok(!/life-atlas|day-notes/i.test(src), `guide page loads no private-record code: ${src}`);
  }

  assert.ok(!/life-atlas|day-notes|localStorage/i.test(talkJs),
    "the talk client touches no private-record code and no on-device record store");
  assert.ok(!/life-atlas|day-notes/i.test(html),
    "the guide page names no private-record module");
});

test("the privacy notice stands in the page before the first question, and the presence is labeled a program", async () => {
  const { config } = await setup();
  const html = read("docs/codex-guide.html");

  const noticeAt = html.indexOf("Before you ask:");
  const formAt = html.indexOf("data-guide-talk-form");
  assert.ok(noticeAt > -1, "the Rule 7 notice is on the page");
  assert.ok(formAt > noticeAt, "the notice stands before the talk form");

  const pageText = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  assert.ok(pageText.includes(config.PRIVACY_NOTICE), "the notice is the rulebook's, verbatim");

  assert.ok(html.includes("The Codex Guide — a program"), "the presence is labeled on its face");
  assert.ok(/data-guide-talk hidden/.test(html),
    "the panel starts hidden, so where no function answers the page is the record-only Guide");
  assert.ok(html.includes("no open conversation"), "the children's surface is named on the page");
});

test("no credential lives anywhere in the function's code", async () => {
  await setup();
  const files = [
    "netlify/functions/codex-guide.mjs",
    "netlify/functions/lib/guide-config.mjs",
    "netlify/functions/lib/guide-core.mjs",
    "netlify/functions/lib/guide-store.mjs",
    "netlify/functions/lib/guide-corpus.mjs"
  ];
  for (const file of files) {
    const source = read(file);
    assert.ok(!/sk-(?:proj-)?[A-Za-z0-9]{20,}/.test(source), `${file} carries no key-shaped secret`);
    assert.ok(!/Bearer\s+[A-Za-z0-9]/.test(source), `${file} carries no literal bearer token`);
  }
  const configSource = read("netlify/functions/lib/guide-config.mjs");
  assert.ok(configSource.includes("GUIDE_API_KEY"), "the key is read from the environment");
});
