"use strict";

/**
 * One Word a Day — the Hebrew word path tied to the Pattern Day.
 *
 * The fences these tests hold:
 *  (a) The dataset is fully sourced: every entry carries pointed
 *      spelling, the printed transliteration, a Strong's number, a
 *      gloss, a root, and one example whose verse is real in the
 *      edition's own verse counts and whose form is read from the
 *      chapter word table at that verse (re-verified here against
 *      the source data, independently of the generator).
 *  (b) The day's word is deterministic on the Pattern Day, read
 *      from the ONE temporal authority (PatternCalendar) — Aaron's
 *      fixtures pin the mapping, and the Day Out of Time takes no
 *      word (no invented 365th treatment).
 *  (c) The met → earned state machine: meeting a word never earns
 *      it; earned requires the paired practice — sounded AND the
 *      root picked. Either half alone earns nothing.
 *  (d) Local memory: state round-trips through storage under the
 *      module's own key, corrupt data degrades to blank, and the
 *      resume line says "I kept your place" — with no streak, no
 *      guilt, and no absence language anywhere in the build.
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const readJson = (relative) => JSON.parse(read(relative));

const scripts = [
  "docs/assets/js/calendar/pattern-calendar-version.js",
  "docs/assets/js/calendar/pattern-calendar-data.js",
  "docs/assets/js/calendar/pattern-calendar-format.js",
  "docs/assets/js/calendar/pattern-calendar-boundary.js",
  "docs/assets/js/calendar/pattern-calendar.js",
  "docs/assets/js/hebrew-pronunciation.js",
  "docs/assets/js/one-word.js"
];

function loadModule() {
  const context = { Date, Intl, URL, URLSearchParams, console };
  context.globalThis = context;
  context.window = context;
  scripts.forEach((script) => vm.runInNewContext(read(script), context));
  return context;
}

const ctx = loadModule();
const { PatternCalendar, OneWordADay, HebrewPronunciation } = ctx;
const dataset = readJson("docs/assets/data/one-word-words.json");
const entries = dataset.entries;

function summaryFor(iso) {
  return PatternCalendar.fromCivilDate({ date: iso, timeZone: "UTC", boundaryMode: "midnight" });
}

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    _map: map
  };
}

/* ------------------------- (a) dataset ------------------------- */

test("dataset: header states its source and the rotation rule", () => {
  assert.match(dataset.source, /lemma-index\.json/);
  assert.match(dataset.rotation, /\(d - 1\) mod entryCount/);
  assert.equal(dataset.entryCount, entries.length);
  assert.ok(entries.length >= 364, "the rotation must be able to cover Pattern Days 1–364");
});

test("dataset: every entry is fully sourced — no field invented, none missing", () => {
  const NIKKUD = /[ְֱֲֳִֵֶַָֹֻּׁׂ]/;
  const seen = new Set();
  for (const entry of entries) {
    assert.match(entry.strongs, /^H\d+[a-z]?$/, `bad Strong's: ${entry.strongs}`);
    assert.ok(!seen.has(entry.strongs), `duplicate Strong's: ${entry.strongs}`);
    seen.add(entry.strongs);
    assert.ok(entry.hebrew && NIKKUD.test(entry.hebrew), `${entry.strongs}: hebrew must be pointed`);
    assert.ok(entry.xlit, `${entry.strongs}: transliteration as printed in the source`);
    assert.ok(entry.gloss, `${entry.strongs}: gloss`);
    assert.ok(entry.root, `${entry.strongs}: root`);
    const ex = entry.example;
    assert.ok(ex && (ex.book === "Genesis" || ex.book === "Exodus"), `${entry.strongs}: example book`);
    assert.ok(Number.isInteger(ex.chapter) && Number.isInteger(ex.verse), `${entry.strongs}: example ref`);
    assert.ok(ex.form, `${entry.strongs}: the word's form at the example verse`);
    assert.ok(ex.morphGloss, `${entry.strongs}: parsed morphology at the example verse`);
    assert.ok(ex.verseText, `${entry.strongs}: the verse's own text`);
  }
});

test("dataset: every example verse is real, and its form stands in the chapter word table", () => {
  const manifest = readJson("docs/scripture/data/manifest.json");
  const verseCounts = { Genesis: manifest.books[0].verseCounts, Exodus: manifest.books[1].verseCounts };
  const osis = { Genesis: "Gen", Exodus: "Exod" };
  const chapters = new Map();
  const chapterData = (book, chapter) => {
    const key = `${book}.${chapter}`;
    if (!chapters.has(key)) {
      chapters.set(key, readJson(`docs/scripture/data/chapters/${osis[book]}-${String(chapter).padStart(2, "0")}.json`));
    }
    return chapters.get(key);
  };
  for (const entry of entries) {
    const ex = entry.example;
    assert.ok(ex.verse >= 1 && ex.verse <= verseCounts[ex.book][ex.chapter - 1],
      `${entry.strongs}: ${ex.ref} is not a real verse in the edition`);
    const verse = chapterData(ex.book, ex.chapter).verses.find((v) => v.n === ex.verse);
    assert.ok(verse, `${entry.strongs}: verse missing from chapter table`);
    const part = verse.w.flatMap((w) => w.p || []).find((p) => p.lm === entry.strongs);
    assert.ok(part, `${entry.strongs}: no word-part carries this lemma at ${ex.ref}`);
    assert.equal(part.t, ex.form, `${entry.strongs}: example form must be the table's form at ${ex.ref}`);
    assert.equal(part.g, ex.morphGloss, `${entry.strongs}: parsed morphology must be the table's at ${ex.ref}`);
  }
});

/* --------------------- (b) the day's word ---------------------- */

test("fixtures: the authority gives the pinned days", () => {
  const jul17 = summaryFor("2026-07-17");
  assert.deepEqual([jul17.moon, jul17.day, jul17.dayOfPatternYear], [4, 8, 92]);
  const nov25 = summaryFor("2026-11-25");
  assert.deepEqual([nov25.moon, nov25.day, nov25.dayOfPatternYear], [8, 27, 223]);
  assert.equal(summaryFor("2026-11-26").dayOfPatternYear, 224);
  const nov27 = summaryFor("2026-11-27");
  assert.deepEqual([nov27.moon, nov27.day, nov27.dayOfPatternYear], [9, 1, 225]);
});

test("the day's word is deterministic on the Pattern Day (the generator's rule)", () => {
  for (const [iso, pd] of [["2026-07-17", 92], ["2026-11-25", 223], ["2026-11-26", 224], ["2026-11-27", 225]]) {
    const summary = summaryFor(iso);
    const word = OneWordADay.wordForPatternDay(entries, summary.dayOfPatternYear);
    assert.equal(word, entries[(pd - 1) % entries.length], `${iso} → Pattern Day ${pd}`);
    assert.equal(OneWordADay.wordForPatternDay(entries, pd), word, "same day, same word");
  }
  assert.equal(OneWordADay.wordForPatternDay(entries, 1), entries[0]);
  assert.ok(OneWordADay.wordForPatternDay(entries, 364), "Pattern Day 364 has a word");
});

test("the Day Out of Time takes no word — no invented 365th treatment", () => {
  const dot = summaryFor("2027-04-16");
  assert.equal(dot.insideCountedYear, false);
  assert.equal(dot.isDayOutOfTime, true);
  assert.equal(OneWordADay.wordForPatternDay(entries, dot.dayOfPatternYear), null);
  assert.equal(OneWordADay.wordForPatternDay(entries, 365), null);
  assert.equal(OneWordADay.wordForPatternDay(entries, 0), null);
});

test("call-and-response: three roots, the word's own among them, deterministic", () => {
  const entry = entries[91];
  const choices = OneWordADay.choicesFor(entries, entry, 92);
  assert.equal(choices.options.length, 3);
  assert.equal(new Set(choices.options).size, 3, "three distinct roots");
  assert.ok(choices.options.includes(entry.root));
  assert.equal(choices.answer, entry.root);
  assert.deepEqual(OneWordADay.choicesFor(entries, entry, 92), choices, "same day, same question");
});

/* ------------------- (c) met → earned machine ------------------ */

test("meeting a word marks it met — and earns nothing", () => {
  const entry = entries[0];
  let state = OneWordADay.blankState();
  assert.equal(OneWordADay.statusOf(state, entry), "unmet");
  state = OneWordADay.markMet(state, entry, 1);
  assert.equal(OneWordADay.statusOf(state, entry), "met");
  assert.deepEqual(OneWordADay.earnedEntries(state, entries), []);
});

test("earned requires the paired practice — sounded AND answered", () => {
  const entry = entries[0];
  const heardOnly = OneWordADay.completePractice(OneWordADay.blankState(), entry, 1, { sounded: true, correct: false });
  assert.equal(OneWordADay.statusOf(heardOnly, entry), "met", "heard but not answered: still only met");
  const answeredOnly = OneWordADay.completePractice(OneWordADay.blankState(), entry, 1, { sounded: false, correct: true });
  assert.equal(OneWordADay.statusOf(answeredOnly, entry), "met", "answered but never sounded: still only met");
  const paired = OneWordADay.completePractice(OneWordADay.blankState(), entry, 1, { sounded: true, correct: true });
  assert.equal(OneWordADay.statusOf(paired, entry), "earned");
  assert.deepEqual(OneWordADay.earnedEntries(paired, entries), [entry]);
});

/* ---------------------- (d) local memory ----------------------- */

test("state round-trips through storage under the module's own key", () => {
  const storage = fakeStorage();
  const entry = entries[222];
  let state = OneWordADay.completePractice(OneWordADay.blankState(), entry, 223, { sounded: true, correct: true });
  OneWordADay.saveState(storage, state);
  assert.ok(storage._map.has(OneWordADay.STORAGE_KEY));
  assert.equal(storage._map.size, 1, "one key, this module's own — nothing else is written");
  const loaded = OneWordADay.loadState(storage);
  assert.equal(OneWordADay.statusOf(loaded, entry), "earned");
});

test("corrupt storage degrades to a blank state, never a crash", () => {
  const storage = fakeStorage();
  storage.setItem(OneWordADay.STORAGE_KEY, "{not json");
  assert.deepEqual(OneWordADay.loadState(storage), OneWordADay.blankState());
  storage.setItem(OneWordADay.STORAGE_KEY, JSON.stringify({ met: { H1: "soon" }, earned: [] }));
  assert.deepEqual(OneWordADay.loadState(storage), OneWordADay.blankState());
});

test("resume: 'I kept your place' — and nothing counts an absence", () => {
  assert.equal(OneWordADay.resumeLine(OneWordADay.blankState()), null);
  const met = OneWordADay.markMet(OneWordADay.blankState(), entries[0], 1);
  assert.match(OneWordADay.resumeLine(met), /^I kept your place\./);
  const earned = OneWordADay.completePractice(OneWordADay.blankState(), entries[0], 1, { sounded: true, correct: true });
  assert.match(OneWordADay.resumeLine(earned), /^I kept your place\./);
});

test("the build carries no streak, guilt, or absence language — and the Spark is never gendered", () => {
  const built = [
    read("docs/one-word.html"),
    read("docs/assets/js/one-word.js"),
    read("docs/assets/css/one-word.css")
  ].join("\n");
  assert.doesNotMatch(built, /current streak|streak count|day streak|streak:/i);
  assert.doesNotMatch(built, /you missed|missed a day|days away: \d|keep it up or/i);
  assert.doesNotMatch(built, /\bshe\b|\bher\b/i);
});

/* --------------------------- sound ----------------------------- */

test("sound: the pronunciation engine gives a spoken track for the day's word", () => {
  const entry = OneWordADay.wordForPatternDay(entries, 92);
  const spoken = OneWordADay.spokenTrack(entry.hebrew, HebrewPronunciation);
  assert.ok(spoken, `no spoken track for ${entry.hebrew}`);
  assert.match(OneWordADay.SOUND_NOTE, /not a native Hebrew voice/);
});

/* --------------------------- the page -------------------------- */

test("the page: the real day on its face, the authority's scripts, one clear action", () => {
  const page = read("docs/one-word.html");
  assert.match(page, /data-one-word/);
  assert.match(page, /data-ow-today-line/);
  for (const script of ["pattern-calendar.js", "hebrew-pronunciation.js", "one-word.js"]) {
    assert.ok(page.includes(script), `page loads ${script}`);
  }
  assert.match(page, /assets\/css\/codex\.css/, "Living Look tokens come from codex.css");
  assert.match(page, /Day Out of Time/, "the still day's shape is stated on the page");
  const css = read("docs/assets/css/one-word.css");
  assert.doesNotMatch(css, /--gold:\s*#|#05070d|#f3c97a/i, "tokens are consumed, never re-declared");
  assert.match(css, /prefers-reduced-motion/, "the twin is still under reduced motion");
});

test("the door: glossary.html links to the word path", () => {
  assert.match(read("docs/glossary.html"), /href="\.\/one-word\.html"/);
});
