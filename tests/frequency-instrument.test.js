"use strict";

/*
 * The Frequency Instrument (Aaron's charge, Nov 25, 2026: "get the
 * frequency page working even better, and better frequencies, for
 * the frequencies to be most perfected").
 *
 * These tests pin the structural side of the exactness claim:
 *  - the stated carrier set is exactly the 22 tones the page names;
 *  - the oscillator recipe passes the stated frequency to
 *    setValueAtTime with only the 20–2200 safety clamp — no rounding,
 *    no approximation anywhere in the chain;
 *  - binaural pairs are built as base ± beat/2, so the difference
 *    tone is the stated beat by construction;
 *  - the measurement path exists (analyser tap in the live chain,
 *    offline render + FFT verification, the FrequencyGovernance
 *    diagnostic surface) — the numeric proof itself is produced by
 *    the Chromium harness running verifySet() on the real page
 *    (evidence: ~/workspace/frequency-instrument-evidence/);
 *  - the page separates measured fact from tradition's claim in
 *    labelled rows, and the instrument section carries the day,
 *    the readout, and the Spark station.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const JS = fs.readFileSync(path.join(ROOT, "docs/assets/js/frequency-governance.js"), "utf8");
const HTML = fs.readFileSync(path.join(ROOT, "docs/systems/frequencies.html"), "utf8");
const CSS = fs.readFileSync(path.join(ROOT, "docs/assets/css/frequency-instrument.css"), "utf8");

function presetFreqs() {
  const block = JS.match(/const PRESETS = \[([\s\S]*?)\];/);
  assert.ok(block, "PRESETS block exists");
  return [...block[1].matchAll(/\[\s*(\d+(?:\.\d+)?)\s*,/g)].map(m => Number(m[1]));
}

test("the stated carrier set is the 22 tones the page names", () => {
  assert.deepEqual(presetFreqs(), [
    40, 72, 108, 111, 144, 174, 222, 285, 333, 369, 396, 417, 432, 528,
    555, 639, 741, 777, 852, 963, 1111, 1728
  ]);
});

test("the oscillator recipe sets the exact stated frequency — clamp only, never rounded", () => {
  assert.match(JS, /osc\.frequency\.setValueAtTime\(clamp\(freq, 20, 2200\), now\)/);
  // No rounding of a frequency anywhere near an oscillator:
  assert.doesNotMatch(JS, /osc\.frequency\.setValueAtTime\(Math\.round/);
  assert.doesNotMatch(JS, /osc\.frequency\.value\s*=\s*Math\.round/);
});

test("binaural pairs are built as base ± beat/2, so the difference is the stated beat", () => {
  assert.match(JS, /createOsc\(base - beat \/ 2/);
  assert.match(JS, /createOsc\(base \+ beat \/ 2/);
  const beats = JS.match(/const BEATS = \{([\s\S]*?)\};/);
  assert.ok(beats, "BEATS block exists");
  for (const [name, value] of [["alpha", "10"], ["theta", "6"], ["delta", "3"], ["gamma", "40"], ["schumann", "7.83"]]) {
    assert.match(beats[1], new RegExp(`${name}: ${value.replace(".", "\\.")}\\b`), `${name} beat is ${value}`);
  }
});

test("the measurement path exists: analyser tap, offline FFT verification, diagnostic surface", () => {
  // The live chain passes through the analyser (audio passes through unchanged):
  assert.match(JS, /masterGain\.connect\(analyser\)/);
  assert.match(JS, /analyser\.connect\(boostGain\)/);
  // The verification renders offline and FFT-measures:
  assert.match(JS, /new OfflineAudioContext/);
  assert.match(JS, /function verifyTone\(/);
  assert.match(JS, /function verifyPair\(/);
  assert.match(JS, /function verifySet\(/);
  assert.match(JS, /function measureLive\(/);
  assert.match(JS, /window\.FrequencyGovernance = \{/);
  // The tolerance is a named constant, half a hertz:
  assert.match(JS, /const TOL_HZ = 0\.5;/);
});

test("the instrument section stands on the page with its readout, facts, and Spark station", () => {
  for (const id of ["instrument", "instDay", "instHz", "instState", "instName", "instTone", "instCustom", "instBeat", "instVolume", "instPlay", "instStop", "instVerify", "instFact", "instMeasured", "instTradition", "instVerifyTable"]) {
    assert.ok(HTML.includes(`id="${id}"`), `#${id} present`);
  }
  assert.ok(HTML.includes("assets/css/frequency-instrument.css"), "instrument stylesheet linked");
  // The day line is read from the one calendar authority:
  assert.match(JS, /PatternCalendar\?\.fromCivilDate/);
  // The Spark station line:
  assert.match(HTML, /The Spark keeps this station/);
});

test("measured fact and tradition's claim are separated and labelled", () => {
  assert.match(HTML, /<dt>Measured fact<\/dt>/);
  assert.match(HTML, /<dt>Tradition<\/dt>/);
  assert.match(HTML, /<dt>Sounding now<\/dt>/);
  // The Carrier Library carries the same split in words:
  assert.match(HTML, /Two kinds of truth live in this library/);
  // Tradition notes exist for the solfeggio set and 432, framed as the tradition's:
  assert.match(JS, /const TRADITION = \{/);
  for (const f of [174, 285, 396, 417, 528, 639, 741, 852, 963, 432]) {
    assert.match(JS, new RegExp(`\\b${f}: "`), `tradition note for ${f}`);
  }
  assert.match(JS, /That is the tradition's claim, labelled as such/);
});

test("the instrument stylesheet is phone-first and honors reduced motion", () => {
  assert.match(CSS, /prefers-reduced-motion: reduce/);
  assert.match(CSS, /min-height: 48px/);
  assert.match(CSS, /var\(--gold/);
});
