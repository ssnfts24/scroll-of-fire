"use strict";

/**
 * life-atlas-runtime-persistence.test.js — the runtime must report
 * its storage honestly (ULS-001 claims check, Nov 25, 2026): when
 * IndexedDB fails and the repository falls back to the in-memory
 * adapter, the sof:life-atlas-ready event and Runtime.persistent
 * must say persistent: false — records then live in volatile
 * memory. Only the IndexedDB adapter may report true.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const RUNTIME_SRC = fs.readFileSync(
  path.join(ROOT, "docs/assets/js/life-atlas/life-atlas-runtime.js"), "utf8");

function bootRuntime({ indexedDbFails }) {
  const events = [];
  const memoryAdapter = { memory: true };
  const context = {
    CustomEvent: class {
      constructor(type, init) { this.type = type; this.detail = init && init.detail; }
    },
    dispatchEvent(event) { events.push(event); return true; },
    CodexLifeAtlasIndexedDb: {
      createRecordAdapter() {
        return {
          async size() {
            if (indexedDbFails) throw new Error("IndexedDB unavailable (simulated)");
            return 0;
          },
        };
      },
    },
    CodexLifeAtlasRepository: {
      createMemoryAdapter: () => memoryAdapter,
      createRepository: ({ adapter }) => ({ adapter }),
    },
  };
  context.globalThis = context;
  vm.runInNewContext(RUNTIME_SRC, context);
  return { runtime: context.CodexLifeAtlasRuntime, events, memoryAdapter };
}

test("IndexedDB adapter in use: the ready event reports persistent storage", async () => {
  const { runtime, events } = bootRuntime({ indexedDbFails: false });
  const repository = await runtime.ready;
  assert.equal(repository.adapter.memory, undefined, "the IndexedDB adapter backs the repository");
  assert.equal(runtime.persistent, true);
  const ready = events.filter((e) => e.type === "sof:life-atlas-ready");
  assert.equal(ready.length, 1);
  assert.equal(ready[0].detail.persistent, true);
});

test("IndexedDB failure: the memory fallback reports persistent: false", async () => {
  const { runtime, events, memoryAdapter } = bootRuntime({ indexedDbFails: true });
  const repository = await runtime.ready;
  assert.equal(repository.adapter, memoryAdapter, "the memory adapter backs the repository");
  assert.equal(runtime.persistent, false);
  const ready = events.filter((e) => e.type === "sof:life-atlas-ready");
  assert.equal(ready.length, 1);
  assert.equal(ready[0].detail.persistent, false,
    "volatile memory must never be reported as persistent storage");
});
