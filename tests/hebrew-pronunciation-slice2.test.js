"use strict";

/*
 * The Hebrew pronunciation layer, slice 2 — the chapter pages
 * (Aaron approved this build Nov 25, 2026, as a preview for his
 * review; its landing waits on his ear passing slice 1 on his
 * phone).
 *
 * Slice 1 (PR #343) built the rule engine and the word studies'
 * Hebrew road. Slice 2 gives the 90 Genesis/Exodus chapter
 * pages a Hebrew choice beside the English one, entirely in the
 * shared chapter runtime (docs/scripture/assets/scripture.js):
 * per verse, the spoken track is built word by word from the
 * verse's own pointed forms — the .w spans of the verse's
 * Hebrew line — through the slice-1 engine, spoken through the
 * read-aloud engine's speakText hook while the verse itself is
 * highlighted, exactly as it is for English. The generator is
 * not touched: the Listen controls and their note live in the
 * runtime, not in the generated markup (proven by
 * `python3 scripts/r2_02_build.py --check`).
 *
 * The authority is the chapter page itself. These tests pin:
 *   - Exodus 21:24, a verse whose word-by-word table stands
 *     one row per word: the engine's track for the verse's
 *     pointed forms agrees, word for word, with the printed
 *     "Approx. transliteration" values on that same page.
 *   - Genesis 1:3, where the agreement is partial: the words
 *     that agree are pinned, and the two that differ are named
 *     (below), never silently resolved.
 *   - Aaron's three unresolved exceptions from slice 1 keep
 *     their named-difference behaviour in the chapter corpus:
 *     adamah's final h, nephesh's p against the pointing's f,
 *     and ruach's Aramaic pairing. The engine follows the
 *     pointing; the printed forms stand untouched.
 *
 * NAMED DIFFERENCES, Genesis 1:3 (chapter data's printed word
 * transliterations, folded by normalizeScholarly):
 *   - וַיֹּאמֶר: printed "wayomer", engine "vayomer" — the
 *     chapter transliteration is the mechanical OSHB spelling,
 *     which writes the vav as w; the engine sounds it v, as
 *     the word studies do.
 *   - וַיְהִי: printed "wayehi", engine "vayhi" — the same w/v
 *     difference, and the printed form sounds the shewa under
 *     the yud where the engine's rule (shewa after a short
 *     vowel is silent) leaves it silent.
 * Every other word of the verse agrees exactly.
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

/* The verse's pointed forms, from the chapter page's own
 * Hebrew line, in order — the same .w spans scripture.js reads. */
function pageHebrewWords(book, page, verseId) {
  const html = read(`docs/scripture/${book}/${page}.html`);
  const article = html.match(new RegExp(`<article class="verse" id="${verseId.replace(/\./g, "\\.")}"[\\s\\S]*?</article>`));
  assert.ok(article, `${verseId} article on the page`);
  const line = article[0].match(/<p class="heb"[^>]*>([\s\S]*?)<\/p>/);
  assert.ok(line, `${verseId} Hebrew line on the page`);
  return [...line[1].matchAll(/<span class="w"[^>]*>([^<]+)<\/span>/g)].map((m) => m[1]);
}

/* The verse's printed "Approx. transliteration" values, from
 * the chapter page's own word-by-word table, in order. */
function pagePrintedTransliterations(book, page, verseId) {
  const html = read(`docs/scripture/${book}/${page}.html`);
  const article = html.match(new RegExp(`<article class="verse" id="${verseId.replace(/\./g, "\\.")}"[\\s\\S]*?</article>`));
  assert.ok(article, `${verseId} article on the page`);
  const table = article[0].match(/<details class="wtable">[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/);
  assert.ok(table, `${verseId} word table on the page`);
  return [...table[1].matchAll(/<tr><td[^>]*>[^<]+<\/td><td>([^<]+)<\/td>/g)].map((m) => m[1]);
}

function engineTrack(words) {
  return words.map((w) => {
    const result = HP.transliterate(w);
    return result && result.spoken;
  });
}

test("Exodus 21:24: the Hebrew track agrees word for word with the page's own printed transliterations", () => {
  const words = pageHebrewWords("exodus", "21", "Exod.21.24");
  const printed = pagePrintedTransliterations("exodus", "21", "Exod.21.24");
  assert.equal(words.length, 12);
  assert.equal(printed.length, words.length, "the table stands one row per word in this verse");
  const track = engineTrack(words);
  assert.ok(track.every(Boolean), "every pointed word of the verse is read, none guessed or dropped");
  assert.deepEqual(track, printed.map((p) => HP.normalizeScholarly(p)));
  assert.equal(track.join(" "), "ayin tachat ayin shen tachat shen yad tachat yad regel tachat ragel");
});

test("Genesis 1:3: the agreeing words agree, and the two differences are the named ones", () => {
  const data = JSON.parse(read("docs/scripture/data/chapters/Gen-01.json"));
  const verse = data.verses.filter((v) => v.id === "Gen.1.3")[0];
  assert.ok(verse, "the chapter's own data carries Gen.1.3");
  const words = pageHebrewWords("genesis", "01", "Gen.1.3");
  assert.deepEqual(words.map((w) => w.replace(/[־׃]$/, "")), verse.w.map((w) => w.t.replace(/\//g, "")),
    "the page's Hebrew line and the chapter data carry the same pointed forms (the page line keeps its maqaf and sof pasuq, which the data carries as annotations)");
  const track = engineTrack(words);
  const printed = verse.w.map((w) => HP.normalizeScholarly(w.tr));
  /* Agreeing, pinned exactly: elohim, yehi, or (twice). */
  assert.equal(track[1], printed[1]); // אֱלֹהִים elohim
  assert.equal(track[2], printed[2]); // יְהִי yehi
  assert.equal(track[3], printed[3]); // אוֹר or
  assert.equal(track[5], printed[5]); // אוֹר or
  /* Named differences (see the header): w/v, and the shewa. */
  assert.equal(printed[0], "wayomer");
  assert.equal(track[0], "vayomer");
  assert.equal(printed[4], "wayehi");
  assert.equal(track[4], "vayhi");
});

test("Aaron's three exceptions keep their named-difference behaviour in the chapter corpus", () => {
  const spoken = (h) => HP.transliterateWord(h).spoken;
  // (1) adamah: the common spelling keeps a final h the
  // pointing does not sound; the engine says "adama".
  assert.equal(spoken("אֲדָמָה"), "adama");
  assert.notEqual(HP.normalizeScholarly("adamah"), spoken("אֲדָמָה"));
  // (2) nephesh: a printed p where the pointing (no dagesh on
  // the pe) sounds f; the engine says "nefesh".
  assert.equal(spoken("נֶפֶשׁ"), "nefesh");
  assert.equal(HP.normalizeScholarly("nepeš"), "nepesh");
  // (3) ruach's Aramaic pairing prints rûḥā; the Hebrew engine
  // reads the Hebrew headword form, "ruach".
  assert.equal(spoken("רוּחַ"), "ruach");
  assert.equal(HP.normalizeScholarly("rûḥā"), "rucha");
});

test("every verse of Genesis 1 and Exodus 20 yields a Hebrew track with nothing guessed", () => {
  for (const [book, page, dataFile] of [["genesis", "01", "Gen-01"], ["exodus", "20", "Exod-20"]]) {
    const data = JSON.parse(read(`docs/scripture/data/chapters/${dataFile}.json`));
    for (const verse of data.verses) {
      const words = pageHebrewWords(book, page, verse.id);
      assert.ok(words.length, `${verse.id} carries pointed forms`);
      const track = engineTrack(words);
      assert.ok(track.every(Boolean), `${verse.id}: every pointed word reads, none is guessed`);
    }
  }
});

test("the chapter runtime builds the Hebrew choice in the shared controls, beside the English one", () => {
  const js = read("docs/scripture/assets/scripture.js");
  assert.match(js, /id: 'sf-listen'/);
  assert.match(js, /id: 'sf-listen-hebrew'/);
  assert.match(js, /hebrew-pronunciation\.js/);
  assert.match(js, /hebrewVerseChunks/);
  assert.match(js, /speakText/);
  assert.match(js, /hebrewSpoken/);
  /* The pointed form is read as printed (dataset.full), never
   * the display mode's stripped text. */
  assert.match(js, /dataset\.full/);
  /* The note says both roads plainly, with the honest limit. */
  assert.match(js, /English \(World English Bible\) text aloud/);
  assert.match(js, /pointed Hebrew aloud, verse by verse, as a careful transliteration/);
  assert.match(js, /not a native Hebrew voice/);
  assert.match(js, /Listening does not mark the chapter read/);
  /* No page may still claim the Hebrew is not read. */
  assert.doesNotMatch(js, /so it is not read/);
});

test("the Hebrew road keeps the Listen fences: no state written, nothing fetched or stored by the new code", () => {
  const js = read("docs/scripture/assets/scripture.js");
  const listenBlock = js.slice(js.indexOf("/* ---------------- listen"), js.indexOf("function toggleRead()"));
  assert.doesNotMatch(listenBlock, /toggleRead|state\.read\.push|save\(state\)|localStorage|fetch\(/);
  assert.match(listenBlock, /hasPointing/);
});

test("all 90 chapter pages still carry the controls host both choices land in", () => {
  let count = 0;
  for (const [book, chapters] of [["genesis", 50], ["exodus", 40]]) {
    for (let i = 1; i <= chapters; i++) {
      const name = `docs/scripture/${book}/${String(i).padStart(2, "0")}.html`;
      assert.match(read(name), /id="sf-controls"/, name);
      assert.match(read(name), /scripture\.js/, name);
      count += 1;
    }
  }
  assert.equal(count, 90);
});
