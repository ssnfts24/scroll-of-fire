"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

function loadSound({ dayOfPatternYear = 217, storage = {} } = {}) {
  const listeners = {};
  const created = [];
  const appended = [];
  const audioContexts = [];
  const makeEl = tag => ({
    tagName: String(tag).toUpperCase(),
    style: {},
    attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener() {}
  });
  const document = {
    head: { appendChild: el => appended.push(el) },
    body: { dataset: {}, appendChild: el => appended.push(el) },
    getElementById: id => appended.find(el => el.id === id) || null,
    createElement: tag => { const el = makeEl(tag); created.push(el); return el; },
    addEventListener() {}
  };
  const window = {
    PatternCalendar: {
      fromCivilDate: () => ({ patternYear: 1, dayOfPatternYear, moon: 8 })
    },
    AudioContext: function () { audioContexts.push(this); },
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener() {}
  };
  const context = {
    window,
    document,
    location: { pathname: "/" },
    localStorage: {
      getItem: k => (Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null),
      setItem: (k, v) => { storage[k] = String(v); }
    },
    matchMedia: () => ({ matches: false }),
    Math, Date, JSON, Array, Object, Number, String,
    setTimeout: () => 0,
    clearTimeout() {}
  };
  vm.runInNewContext(read("docs/assets/js/heaven-sound.js"), context);
  return {
    sound: window.SOFSound,
    created,
    audioContexts,
    boot: () => (listeners.DOMContentLoaded || []).forEach(fn => fn())
  };
}

test("same Pattern Day gives the same seed and chime plan across fresh loads", () => {
  const a = loadSound();
  const b = loadSound();
  assert.equal(a.sound.daySeed(), b.sound.daySeed());
  assert.deepEqual(Array.from(a.sound.chimePlan(8)), Array.from(b.sound.chimePlan(8)));
});

test("a different Pattern Day gives a different seed and chime plan", () => {
  const a = loadSound({ dayOfPatternYear: 217 });
  const b = loadSound({ dayOfPatternYear: 218 });
  assert.notEqual(a.sound.daySeed(), b.sound.daySeed());
  assert.notDeepEqual(Array.from(a.sound.chimePlan(8)), Array.from(b.sound.chimePlan(8)));
});

test("boot creates the toggle but no AudioContext", () => {
  const env = loadSound();
  env.boot();
  assert.equal(env.audioContexts.length, 0);
  const toggle = env.created.find(el => el.id === "heavenToggle");
  assert.ok(toggle, "#heavenToggle should be created");
  assert.equal(toggle.tagName, "BUTTON");
});

test("master sound switch off keeps enable() silent", () => {
  const env = loadSound({ storage: { "sof.spark.sound": "off" } });
  env.boot();
  env.sound.enable();
  assert.equal(env.audioContexts.length, 0);
});

test("script wiring: deferred on the home page, absent from the sphere page", () => {
  const index = read("docs/index.html");
  assert.match(index, /<script\b[^>]*\bdefer\b[^>]*src="[^"]*heaven-sound\.js[^"]*"/);
  assert.match(index, /<script\b[^>]*\bdefer\b[^>]*src="[^"]*spark-3d\.js[^"]*"/);
  assert.equal(read("docs/living-time-sphere.html").includes("heaven-sound"), false);
});
