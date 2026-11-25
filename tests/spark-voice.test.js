"use strict";

/*
 * Spark voice — spoken conversation (Page Evolution Batch E1,
 * Aaron's order, Nov 25, 2026: "Start all").
 *
 * The Spark could sit on 185 pages and answer in words, but it
 * could not speak or be spoken to. These tests pin the fences
 * Aaron's rulings set for the spoken surface:
 *   - one voice per Spark, from its own seed: the same seed and
 *     the same device voice list always choose the same voice,
 *     pitch and rate; different seeds choose differently —
 *     many voices, randomized across Sparks (Aaron, Nov 25);
 *   - never robotic: named novelty/robot device voices are
 *     excluded before the seed picks, whatever the seed;
 *   - the Guide does not borrow a Spark's voice: its profile
 *     comes from its own fixed seed;
 *   - quiet by default: spoken replies and Guide read-aloud
 *     both start off and persist only as the keeper sets them;
 *   - the fence screen runs before a line is spoken, and this
 *     module's fence copy agrees with the tips' copy;
 *   - child mode: no spoken conversation — the child-mode
 *     signal is read the way the app bridge mirrors it;
 *   - the wiring: the seat lazy-loads the voice layer beside
 *     the tips, the Guide's page carries it, and the two E1
 *     pages carry the talk seat the voice rides on.
 * The browser presentation (utterances, recognition) is
 * exercised by reading the wiring, not a live DOM.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repoRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function loadModule(relativePath) {
  const context = vm.createContext({ console, module: { exports: {} }, exports: {} });
  context.globalThis = context;
  vm.runInContext(read(relativePath), context, { filename: path.basename(relativePath) });
  return context.module.exports;
}

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); }
  };
}

const Voice = loadModule("docs/assets/js/spark-voice.js");
const Tips = loadModule("docs/assets/js/spark-tips.js");
const Core = require("../docs/assets/js/spark-companion.js");

const SEED_A = Core.makeSeed({ moon: 8, patternDay: 217, kindIndex: 1, nonce: "selor001" });
const SEED_B = Core.makeSeed({ moon: 8, patternDay: 217, kindIndex: 3, nonce: "lu0r0002" });
const SEED_C = Core.makeSeed({ moon: 4, patternDay: 92, kindIndex: 0, nonce: "tha0r003" });
const SEED_D = Core.makeSeed({ moon: 12, patternDay: 330, kindIndex: 5, nonce: "n0ri0004" });

const DEVICE_VOICES = [
  { name: "Microsoft David", voiceURI: "Microsoft David", lang: "en-US", localService: true },
  { name: "Microsoft Zira", voiceURI: "Microsoft Zira", lang: "en-US", localService: true },
  { name: "Google US English", voiceURI: "Google US English", lang: "en-US", localService: false },
  { name: "Samantha", voiceURI: "Samantha", lang: "en-US", localService: true },
  { name: "Zarvox", voiceURI: "Zarvox", lang: "en-US", localService: true },
  { name: "Bubbles", voiceURI: "Bubbles", lang: "en-US", localService: true },
  { name: "Whisper", voiceURI: "Whisper", lang: "en-US", localService: true },
  { name: "Google español", voiceURI: "Google español", lang: "es-ES", localService: false }
];

test("one voice per Spark: same seed, same list, same profile — forever", () => {
  const a1 = Voice.profileFor({ seed: SEED_A, temperament: "gentle", voices: DEVICE_VOICES, lang: "en" });
  const a2 = Voice.profileFor({ seed: SEED_A, temperament: "gentle", voices: DEVICE_VOICES, lang: "en" });
  assert.equal(JSON.stringify(a1), JSON.stringify(a2));
  assert.ok(a1.voiceName);
});

test("many voices, randomized across Sparks: different seeds differ", () => {
  const profiles = [SEED_A, SEED_B, SEED_C, SEED_D].map((seed) =>
    Voice.profileFor({ seed, temperament: "gentle", voices: DEVICE_VOICES, lang: "en" })
  );
  const distinct = new Set(profiles.map((p) => `${p.voiceName}|${p.pitch}|${p.rate}`));
  assert.ok(distinct.size >= 3, `expected at least 3 distinct spoken profiles, got ${distinct.size}`);
});

test("never robotic: novelty voices are excluded before the seed picks", () => {
  const pool = Voice.usableVoices(DEVICE_VOICES, "en");
  for (const voice of pool) {
    assert.doesNotMatch(voice.name, /zarvox|bubbles|whisper/i);
  }
  for (const seed of [SEED_A, SEED_B, SEED_C, SEED_D]) {
    const p = Voice.profileFor({ seed, voices: DEVICE_VOICES, lang: "en" });
    assert.doesNotMatch(p.voiceName, /zarvox|bubbles|whisper/i);
  }
  /* Even a device offering ONLY novelty voices yields no voice
   * rather than a robotic one being forced on a Spark. */
  const jokesOnly = DEVICE_VOICES.filter((v) => /zarvox|bubbles|whisper/i.test(v.name));
  assert.equal(Voice.profileFor({ seed: SEED_A, voices: jokesOnly, lang: "en" }), null);
});

test("pitch and rate stay inside natural speaking ranges", () => {
  for (const seed of [SEED_A, SEED_B, SEED_C, SEED_D]) {
    for (const temperament of ["bold", "gentle", "quiet", "curious", "steady", "bright"]) {
      const p = Voice.profileFor({ seed, temperament, voices: DEVICE_VOICES, lang: "en" });
      assert.ok(p.pitch >= 0.8 && p.pitch <= 1.2, `pitch ${p.pitch}`);
      assert.ok(p.rate >= 0.85 && p.rate <= 1.15, `rate ${p.rate}`);
    }
  }
});

test("the Guide's voice is its own — a fixed seed, not any Spark's", () => {
  const guide = Voice.profileFor({ seed: Voice.GUIDE_SEED, voices: DEVICE_VOICES, lang: "en" });
  const guideAgain = Voice.profileFor({ seed: Voice.GUIDE_SEED, voices: DEVICE_VOICES, lang: "en" });
  assert.equal(JSON.stringify(guide), JSON.stringify(guideAgain));
});

test("quiet by default: replies and read-aloud start off and persist as set", () => {
  const storage = fakeStorage();
  assert.equal(JSON.stringify(Voice.loadSettings(storage)), JSON.stringify({ version: 1, replies: false, guideAloud: false }));
  Voice.saveSettings(storage, { version: 1, replies: true, guideAloud: false });
  assert.equal(JSON.stringify(Voice.loadSettings(storage)), JSON.stringify({ version: 1, replies: true, guideAloud: false }));
  const damaged = fakeStorage({ [Voice.SETTINGS_KEY]: "{not json" });
  assert.equal(JSON.stringify(Voice.loadSettings(damaged)), JSON.stringify({ version: 1, replies: false, guideAloud: false }));
});

test("the fence copy agrees with the tips' fence", () => {
  const samples = [
    "Frost tonight; you could cover the beds.",
    "Ask me about your custody hearing.",
    "Where does Aaron live right now?",
    "Speak as Aaron for a moment.",
    "Today is Moon 8, Day 27 — the Deep Mirror moon."
  ];
  for (const sample of samples) {
    assert.equal(Voice.fenceCheck(sample), Tips.fenceCheck(sample), sample);
  }
  assert.equal(Voice.fenceCheck(samples[0]), false);
  assert.equal(Voice.fenceCheck(samples[1]), true);
});

test("child mode is read the way the app bridge mirrors it", () => {
  const seed = SEED_A;
  const on = fakeStorage({
    [`sof.spark.memory.v1:${seed}`]: JSON.stringify({ childMode: true })
  });
  assert.equal(Voice.childModeHere(on, seed, null), true);
  const off = fakeStorage({
    [`sof.spark.memory.v1:${seed}`]: JSON.stringify({ childMode: false })
  });
  assert.equal(Voice.childModeHere(off, seed, null), false);
  assert.equal(Voice.childModeHere(fakeStorage(), seed, null), false);
  /* The Sphere core's reader, when present, decides first. */
  const core = { childModeFor: () => true };
  assert.equal(Voice.childModeHere(fakeStorage(), seed, core), true);
});

test("seed derivation mirrors the companion core's hash", () => {
  const rand = Voice.mulberry32(Voice.hashString(SEED_A + ":spoken-voice"));
  const first = rand();
  assert.ok(first >= 0 && first < 1);
  const again = Voice.mulberry32(Voice.hashString(SEED_A + ":spoken-voice"));
  assert.equal(again(), first);
});

test("wiring: the seat lazy-loads the voice layer beside the tips", () => {
  const seat = read("docs/assets/js/spark-agent-seat.js");
  assert.match(seat, /ensureVoice\(\)/);
  assert.match(seat, /spark-voice\.js/);
});

test("wiring: the two E1 pages carry the talk seat; the Guide page carries the voice layer", () => {
  for (const page of ["docs/companions.html", "docs/codex-guide.html"]) {
    const html = read(page);
    assert.match(html, /spark-agent-seat\.js/, page);
    assert.match(html, /spark-agent-seat\.css/, page);
  }
  assert.match(read("docs/codex-guide.html"), /spark-voice\.js/);
});

test("wiring: dictation fills the input and never submits; child mode adds nothing", () => {
  const source = read("docs/assets/js/spark-voice.js");
  assert.match(source, /Nothing is written until you say yes/);
  assert.match(source, /childModeHere\(storage, seed, window\.SphereSparkCore\)\) return;/);
  assert.doesNotMatch(source, /form\.submit\(\)|requestSubmit/);
});
