"use strict";

/*
 * The Hebrew pronunciation layer (Aaron's commission, Nov 25,
 * 2026: "Commission the Hebrew pronunciation layer").
 *
 * E2's Listen reads English only: device voices pronounce raw
 * Hebrew unreliably. This layer reads the POINTED Hebrew of
 * the seven word studies through a rule engine
 * (docs/assets/js/hebrew-pronunciation.js) — consonants,
 * nikkud, dagesh, shewa by rule, furtive patach, maqaf,
 * stress — and speaks a careful transliteration track through
 * the read-aloud engine's Hebrew mode, highlighting the
 * Hebrew itself.
 *
 * The studies are the authority. These tests pin the engine's
 * agreement with the transliteration printed in each word's
 * own study, compared after the declared folding
 * (normalizeScholarly: macrons/circumflexes to plain vowels,
 * ḏ→d, š→sh, ḥ→ch, ṣ→ts, ʾ/ʿ drop, ə→e, ph→f).
 *
 * DOCUMENTED EXCEPTIONS — reported, never silently resolved
 * (design paper §3; the study wins in print, the engine
 * follows the pointing, Aaron may rule):
 *   1. אֲדָמָה: a study pairing prints "adamah"; the engine
 *      says "adama" (final ה silent — the study's own
 *      scholarly ʾăḏāmâ folds to "adama" and agrees).
 *   2. נֶפֶשׁ: the study prints "nepeš / nephesh". "nephesh"
 *      folds to the engine's "nefesh" and agrees; "nepeš"
 *      writes p where the page's pointing (no dagesh on the
 *      pe) sounds f by rule.
 *   3. נָפַשׁ: the study prints nāpaš; the engine says
 *      "nafash" — the same p-against-pointing family as (2).
 *   4. רוּחַ (Aramaic pairing): the study prints rûḥā for the
 *      Aramaic cognate. The engine is a Hebrew engine and
 *      reads "ruach", the study's own Hebrew headword form.
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

const HP = loadModule("docs/assets/js/hebrew-pronunciation.js");
const spoken = (hebrew) => {
  const result = HP.transliterateWord(hebrew);
  return result && result.spoken;
};

/* ---- the eight studied headwords ---------------------------- */
/* [pointed, the study's printed transliteration, engine track] */
const HEADWORDS = [
  ["שֵׁם", "shem", "shem"],
  ["אָדָם", "ʾāḏām", "adam"],
  ["אֲדָמָה", "ʾăḏāmâ", "adama"],
  ["אֱנוֹשׁ", "ʾĕnôš", "enosh"],
  ["רוּחַ", "rûaḥ", "ruach"],
  ["נֶפֶשׁ", "nephesh", "nefesh"],
  ["אוֹר", "ʾôr", "or"],
  ["דָּבָר", "dāvār", "davar"] // the filed eighth study, hebrew-study-dabar-2026-11-23.md
];

test("the engine agrees with all eight studied headwords", () => {
  for (const [hebrew, printed, engine] of HEADWORDS) {
    assert.equal(spoken(hebrew), engine, hebrew);
    assert.equal(HP.normalizeScholarly(printed), engine, `${hebrew} vs printed ${printed}`);
  }
});

/* ---- the wider corpus: pointed forms the studies print
 *      beside their own transliterations ---------------------- */
const CORPUS = [
  ["שֵׁמוֹת", "shemot"],
  ["אֶרֶץ", "ʾereṣ"],
  ["שָׁמַיִם", "shāmayim"],
  ["מְאֹד", "məʾōḏ"],
  ["אַדְמַת", "ʾaḏmaṯ"],
  ["אַדְמוֹנִי", "ʾaḏmônî"],
  ["אָדַם", "ʾāḏam"],
  ["אָדֹם", "ʾāḏōm"],
  ["אָנַשׁ", "ʾānaš"],
  ["אֹדֶם", "ʾōḏem"],
  ["אֱנָשׁ", "ʾĕnāš"],
  ["אֲנָשִׁים", "ʾănāšîm"],
  ["דָּם", "dām"],
  ["נְהוֹרָא", "nəhôrā"],
  ["רֵיחַ", "rêaḥ"],
  ["שָׁמַע", "shāmaʿ"],
  ["שׂוּם", "śûm"]
];

test("the engine agrees with the studies' wider printed corpus", () => {
  for (const [hebrew, printed] of CORPUS) {
    assert.equal(spoken(hebrew), HP.normalizeScholarly(printed), `${hebrew} vs printed ${printed}`);
  }
});

test("phrases and maqaf joins transliterate whole", () => {
  assert.equal(HP.transliterate("נִשְׁמַת חַיִּים").spoken,
    HP.normalizeScholarly("nishmat ḥayyim"));
  assert.equal(HP.transliterate("אָז הוּחַל").spoken,
    HP.normalizeScholarly("ʾāz hûḥal"));
  assert.equal(HP.transliterate("שֵׁם־").spoken, "shem");
});

/* ---- the documented exceptions stay exactly as documented --- */
test("documented exceptions: the study wins in print, the engine follows the pointing", () => {
  // (1) adamah: the pairing's final h against the silent final ה.
  assert.equal(spoken("אֲדָמָה"), "adama");
  assert.notEqual(HP.normalizeScholarly("adamah"), spoken("אֲדָמָה"));
  // (2) nephesh: "nephesh" agrees; "nepeš" is the listed divergence.
  assert.equal(HP.normalizeScholarly("nephesh"), spoken("נֶפֶשׁ"));
  assert.equal(HP.normalizeScholarly("nepeš"), "nepesh");
  assert.equal(spoken("נֶפֶשׁ"), "nefesh");
  // (3) napash: the verb's pe carries no dagesh on the page.
  assert.equal(HP.normalizeScholarly("nāpaš"), "napash");
  assert.equal(spoken("נָפַשׁ"), "nafash");
  // (3b) merachefet: the same family — the study prints
  // məraḥepet, the pointing sounds the pe soft.
  assert.equal(HP.normalizeScholarly("məraḥepet"), "merachepet");
  assert.equal(spoken("מְרַחֶפֶת"), "merachefet");
  // (4) the Aramaic pairing of ruach is outside the engine's language.
  assert.equal(HP.normalizeScholarly("rûḥā"), "rucha");
  assert.equal(spoken("רוּחַ"), "ruach");
});

/* ---- the rules themselves ----------------------------------- */
test("shewa sounds or stays silent by rule", () => {
  assert.equal(spoken("שְׁמִי"), "shemi");   // word start: sounded
  assert.equal(spoken("בְּשֵׁם"), "beshem"); // under dagesh: sounded
  assert.equal(spoken("נִשְׁמַת"), "nishmat"); // after a short vowel: silent
  assert.equal(spoken("שְׁמוֹ"), "shemo");
});

test("dagesh hardens the begedkefet letters; its absence softens them", () => {
  assert.equal(spoken("דָּבָר"), "davar");  // bet without dagesh: v
  assert.equal(spoken("דָּם"), "dam");
  assert.equal(spoken("שִׁמְךָ"), "shimkha"); // final kaf without dagesh: kh
});

test("furtive patach is heard before its letter", () => {
  assert.equal(spoken("רוּחַ"), "ruach");
  assert.equal(spoken("רֵיחַ"), "reach");
});

test("segolates carry their stress on the first syllable", () => {
  assert.equal(HP.transliterateWord("נֶפֶשׁ").stress, 0);
  assert.equal(HP.transliterateWord("אֶרֶץ").stress, 0);
  assert.equal(HP.transliterateWord("אָדָם").stress, 1);
  assert.equal(HP.transliterateWord("נִשְׁמַת").stress, 1);
});

test("unpointed text is refused, never guessed", () => {
  assert.equal(HP.transliterateWord("שם"), null);
  assert.equal(HP.transliterateWord(""), null);
  assert.equal(HP.hasPointing("שם"), false);
  assert.equal(HP.hasPointing("שֵׁם"), true);
});

/* ---- the integration ----------------------------------------- */
test("the read-aloud engine carries the Hebrew mode hook", () => {
  const RA = loadModule("docs/assets/js/read-aloud.js");
  assert.equal(typeof RA.createSession, "function");
  const source = read("docs/assets/js/read-aloud.js");
  assert.match(source, /speakText/);
  assert.match(source, /read-aloud\/1\.1\.0/);
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|localStorage|sessionStorage/);
});

test("the pronunciation engine is pure rules: no network, no storage", () => {
  const source = read("docs/assets/js/hebrew-pronunciation.js");
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|localStorage|sessionStorage|speechSynthesis/);
});

test("all seven word studies carry the Hebrew listening runtime and their printed words stand", () => {
  const pages = {
    "shem.html": "שֵׁם (shem, H8034)",
    "adam.html": "ʾāḏām",
    "adamah.html": "ʾăḏāmâ",
    "enosh.html": "ʾĕnôš",
    "ruach.html": "rûaḥ",
    "nephesh.html": "nepeš / nephesh",
    "or.html": "ʾôr"
  };
  for (const [page, printed] of Object.entries(pages)) {
    const html = read(`docs/scripture/word-studies/${page}`);
    assert.match(html, /word-study-hebrew\.js/, page);
    assert.ok(html.includes(printed), `${page} still prints ${printed}`);
  }
});

test("the study runtime gates on pointing and prints the honest limit", () => {
  const js = read("docs/scripture/assets/word-study-hebrew.js");
  assert.match(js, /hasPointing/);
  assert.match(js, /Hear the Hebrew/);
  assert.match(js, /not a native Hebrew voice/);
  assert.match(js, /hebrew-pronunciation\.js/);
  assert.match(js, /read-aloud\.js/);
  assert.doesNotMatch(js, /fetch\(|localStorage|sessionStorage/);
});
