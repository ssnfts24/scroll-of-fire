"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function loadShareModule(overrides = {}) {
  const context = {
    navigator: {},
    document: null,
    ...overrides
  };
  context.globalThis = context;
  vm.runInNewContext(read("docs/assets/js/share/remnant-share.js"), context);
  return context.RemnantShare;
}

test("copy helpers fallback when clipboard API is denied", async () => {
  const doc = {
    body: {
      appendChild() {},
      removeChild() {}
    },
    createElement() {
      return {
        value: "",
        style: {},
        setAttribute() {},
        select() {}
      };
    },
    execCommand() {
      return true;
    }
  };
  const api = loadShareModule({
    navigator: {
      clipboard: {
        async writeText() {
          throw new Error("Denied");
        }
      }
    },
    document: doc
  });
  await assert.doesNotReject(() => api.copyPermanentLink("https://codexofreality.org/moons.html"));
});

test("nativeShare rejects when unavailable", async () => {
  const api = loadShareModule({ navigator: {} });
  await assert.rejects(() => api.nativeShare({ title: "x" }), /Native share unavailable/);
});
