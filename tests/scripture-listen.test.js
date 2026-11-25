"use strict";

/*
 * Scripture learns to be heard (Page Evolution Batch E2, Aaron's
 * order, Nov 25, 2026: "Start all").
 *
 * The 90 chapters passed every standard except being heard, two
 * audits running. These tests pin what E2 built and its fences:
 *   - one shared read-aloud engine (docs/assets/js/read-aloud.js):
 *     device speech only, chunks in order, nothing written;
 *   - the Listen control lives in the chapters' own controls bar,
 *     built by scripture.js — so one build reaches all 90
 *     chapters — and it reads the English (WEB) lines verse by
 *     verse, saying plainly that the pointed Hebrew is not read;
 *   - listening never marks a chapter read: the deliberate tap
 *     stays the only road to that state;
 *   - the seven word studies gain tappable Genesis/Exodus
 *     citations (runtime-wrapped; citations with no chapter page
 *     here are never linked) and an authored 3-question recall
 *     strip each, drawn from the study's own text;
 *   - the reader and the white paper opt into the same engine.
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

test("the read-aloud engine exists, is device-speech only, and writes nothing", () => {
  const RA = loadModule("docs/assets/js/read-aloud.js");
  assert.equal(typeof RA.createSession, "function");
  assert.equal(typeof RA.paragraphChunks, "function");
  const source = read("docs/assets/js/read-aloud.js");
  assert.match(source, /speechSynthesis/);
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|localStorage|sessionStorage/);
});

test("the Listen control is built by scripture.js into the chapters' controls bar", () => {
  const js = read("docs/scripture/assets/scripture.js");
  assert.match(js, /id: 'sf-listen'/);
  assert.match(js, /toggleListen/);
  assert.match(js, /verseChunks/);
  assert.match(js, /read-aloud\.js/);
  /* The note says what is read and what is not, plainly. */
  assert.match(js, /English \(World English Bible\) text aloud/);
  assert.match(js, /Listening does not mark the chapter read/);
});

test("listening never touches the read state", () => {
  const js = read("docs/scripture/assets/scripture.js");
  const listenBlock = js.slice(js.indexOf("/* ---------------- listen"), js.indexOf("function toggleRead()"));
  assert.doesNotMatch(listenBlock, /toggleRead|state\.read\.push|save\(state\)/);
});

test("all 90 chapter pages carry the controls host the Listen button lands in", () => {
  let count = 0;
  for (const [book, chapters] of [["genesis", 50], ["exodus", 40]]) {
    for (let i = 1; i <= chapters; i++) {
      const name = `docs/scripture/${book}/${String(i).padStart(2, "0")}.html`;
      assert.match(read(name), /id="sf-controls"/, name);
      count += 1;
    }
  }
  assert.equal(count, 90);
});

test("every word study carries the citation runtime and an authored recall strip", () => {
  for (const name of ["adam", "adamah", "enosh", "ruach", "nephesh", "or", "shem"]) {
    const html = read(`docs/scripture/word-studies/${name}.html`);
    assert.match(html, /word-study\.js/, name);
    assert.match(html, /class="recall-strip"/, name);
    const questions = html.match(/class="recall-q"/g) || [];
    assert.equal(questions.length, 3, `${name} recall strip holds exactly 3 questions`);
  }
});

test("the citation runtime only links what has a chapter page here", () => {
  const js = read("docs/scripture/assets/word-study.js");
  assert.match(js, /Genesis\|Gen\|Exodus\|Exod\|Ex/);
  /* The panel-opening road: first word of the verse, from the
   * chapter's own data, with the plain anchor as fallback. */
  assert.match(js, /data\/chapters\//);
  assert.match(js, /fallback/);
});

test("the reader and the white paper opt into the same engine", () => {
  const reader = read("docs/scroll/reader.html");
  assert.match(reader, /data-read-aloud/);
  assert.match(reader, /read-aloud\.js/);
  const paper = read("docs/codex-white-paper.html");
  assert.match(paper, /data-read-aloud/);
  assert.match(paper, /read-aloud\.js/);
});
