"use strict";

// Sphere animation visibility — regression pin for the blank-stage
// defect of Nov 27, 2026.
//
// On Aaron's phone the Sphere "loaded in at first" and then showed
// nothing: the page shell rearranges the stage while the page boots,
// the canvas crosses the IntersectionObserver threshold out and back
// inside a single delivery batch, and the observer queued both
// crossings oldest-first. The animation module's handler read only
// the FIRST entry, paused the render loop on the stale "left the
// screen" report, and discarded the "came back" report — so the
// pause never lifted, the frozen boot frame was the last thing ever
// painted (and the first resize cleared even that), while the DOM
// labels kept tracking drags over a dark stage.
//
// The fix: the handler acts on the LAST entry of each batch, the
// canvas's standing state. These tests pin that behaviour both ways:
// a batch ending visible must leave the loop running and painting;
// a batch ending hidden must leave it paused.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const MODULE_PATH = path.join(
  __dirname, "..", "docs", "assets", "js", "sphere",
  "living-time-sphere-animation.js",
);

function loadAnimation() {
  const rafQueue = new Map();
  let rafSeq = 0;
  let ioCallback = null;
  let ioInstance = null;

  class FakeIntersectionObserver {
    constructor(callback) { ioCallback = callback; ioInstance = this; this.disconnected = false; }
    observe() {}
    unobserve() {}
    disconnect() { this.disconnected = true; }
  }

  const sandbox = {
    console,
    performance: { now: () => 0 },
    document: { hidden: false, addEventListener() {}, removeEventListener() {} },
    IntersectionObserver: FakeIntersectionObserver,
    requestAnimationFrame(cb) { const id = ++rafSeq; rafQueue.set(id, cb); return id; },
    cancelAnimationFrame(id) { rafQueue.delete(id); },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(MODULE_PATH, "utf8"), sandbox, { filename: MODULE_PATH });

  const anim = sandbox.LivingTimeSphereAnimation;
  assert.ok(anim, "animation module published its API");

  let now = 0;
  const pump = () => {
    now += 100;
    const callbacks = [...rafQueue.values()];
    rafQueue.clear();
    for (const cb of callbacks) cb(now);
  };
  const deliver = (entries) => {
    assert.ok(ioCallback, "an IntersectionObserver was attached");
    ioCallback(entries, ioInstance);
  };
  return { anim, pump, deliver };
}

test("a visibility batch ending visible leaves the loop running and painting", () => {
  const { anim, pump, deliver } = loadAnimation();
  let renders = 0;
  anim.start(() => { renders += 1; });
  anim.attachIntersection({}); // any stand-in canvas object
  pump();

  // The boot flap: out and back inside one delivery batch.
  deliver([{ isIntersecting: false }, { isIntersecting: true }]);
  assert.equal(anim.isRunning(), true,
    "the last entry is the standing state: the canvas is back on screen, so the loop must be running");

  anim.markDirty();
  pump();
  assert.ok(renders >= 1, "a dirty frame paints after the flap");
});

test("a visibility batch ending hidden pauses, and a later visible report resumes the owed frame", () => {
  const { anim, pump, deliver } = loadAnimation();
  let renders = 0;
  anim.start(() => { renders += 1; });
  anim.attachIntersection({});
  pump();

  deliver([{ isIntersecting: true }, { isIntersecting: false }]);
  assert.equal(anim.isRunning(), false,
    "the last entry says off-screen: the loop must pause");

  anim.markDirty();
  pump();
  assert.equal(renders, 0, "a paused loop paints nothing");

  deliver([{ isIntersecting: true }]);
  assert.equal(anim.isRunning(), true, "returning to the screen resumes the loop");
  pump();
  assert.ok(renders >= 1, "the frame owed from the pause paints on resume");
});

test("single-entry reports behave exactly as before", () => {
  const { anim, deliver } = loadAnimation();
  anim.start(() => {});
  anim.attachIntersection({});
  deliver([{ isIntersecting: false }]);
  assert.equal(anim.isRunning(), false);
  deliver([{ isIntersecting: true }]);
  assert.equal(anim.isRunning(), true);
});
