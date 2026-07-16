"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

function serviceWorkerHarness(failingPath) {
  const listeners = {};
  const stores = new Map();
  const cacheApi = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async put(key, value) {
          store.set(String(key), value);
        },
        async match(key) {
          return store.get(String(key));
        }
      };
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name) {
      return stores.delete(name);
    },
    async match(key) {
      for (const store of stores.values()) {
        if (store.has(String(key))) return store.get(String(key));
      }
      return undefined;
    }
  };
  const self = {
    SOF_13_MOONS: {
      APP_VERSION: "2026.07.16.2",
      CACHE_PREFIX: "sof-13-moons-"
    },
    registration: { scope: "https://example.test/project/" },
    location: { origin: "https://example.test", hostname: "example.test" },
    clients: { claim: async () => {} },
    addEventListener(type, callback) {
      listeners[type] = callback;
    },
    skipWaiting() {}
  };
  const context = {
    self,
    caches: cacheApi,
    URL,
    console,
    importScripts() {},
    fetch: async request => {
      const url = String(request);
      if (failingPath && url.endsWith(failingPath)) {
        return { ok: false, status: 404, statusText: "Not Found" };
      }
      return { ok: true, status: 200, statusText: "OK", url };
    }
  };
  vm.runInNewContext(read("docs/service-worker.js"), context);
  return { context, listeners, stores };
}

async function installWorker(harness) {
  let installation;
  harness.listeners.install({
    waitUntil(promise) {
      installation = promise;
    }
  });
  return installation;
}

test("missing optional image does not block install or offline startup", async () => {
  const harness = serviceWorkerHarness("apple-touch-icon.png");
  await installWorker(harness);
  const core = harness.stores.get("sof-13-moons-core-2026.07.16.2");
  assert.ok(core.has("https://example.test/project/moons.html"));
  assert.ok(core.has("https://example.test/project/offline.html"));

  harness.context.fetch = async () => {
    throw new Error("offline");
  };
  let response;
  harness.listeners.fetch({
    request: {
      method: "GET",
      mode: "navigate",
      url: "https://example.test/project/moons.html?offline=1"
    },
    respondWith(promise) {
      response = promise;
    }
  });
  assert.equal(
    (await response).url,
    "https://example.test/project/moons.html"
  );
});

test("missing mandatory shell file blocks service-worker installation", async () => {
  const harness = serviceWorkerHarness("offline.html");
  await assert.rejects(installWorker(harness), /404 Not Found/);
});

test("service-worker build marker matches the central app version", () => {
  const version = read("docs/assets/js/moons-version.js")
    .match(/APP_VERSION = "([^"]+)"/)[1];
  const build = read("docs/service-worker.js")
    .match(/SERVICE_WORKER_BUILD = "([^"]+)"/)[1];
  assert.equal(version, "2026.07.16.2");
  assert.equal(build, version);
  assert.match(read("docs/service-worker.js"), new RegExp(`core-\\$\\{VERSION\\}`));
});

function refreshHarness({ online = true } = {}) {
  const deleted = [];
  const unregistered = [];
  const registered = [];
  const messages = [];
  const storage = new Map([
    ["sof_moon_logs_v3", '[{"saved":"existing"}]'],
    ["sof_moons_tz_v2", "UTC"]
  ]);
  const workerUrl = "https://example.test/project/service-worker.js";
  const context = {
    URL,
    Date,
    window: {},
    document: { baseURI: "https://example.test/project/moons.html" },
    navigator: {
      onLine: online,
      serviceWorker: {
        async getRegistrations() {
          return [
            {
              scope: "https://example.test/project/",
              active: { scriptURL: workerUrl },
              async unregister() {
                unregistered.push("moons");
                return true;
              }
            },
            {
              scope: "https://example.test/",
              active: { scriptURL: "https://example.test/service-worker.js" },
              async unregister() {
                unregistered.push("codex");
                return true;
              }
            }
          ];
        },
        async register(url) {
          registered.push(url);
          return {
            scope: "https://example.test/project/",
            active: { state: "activated" }
          };
        }
      }
    },
    caches: {
      async keys() {
        return [
          "sof-13-moons-core-old",
          "sof-13-moons-runtime-old",
          "codex-shared-cache"
        ];
      },
      async delete(key) {
        deleted.push(key);
        return true;
      }
    },
    confirm: () => true,
    fetch: async () => ({ ok: true, status: 200 }),
    location: {
      replace(url) {
        context.replaced = url;
      }
    },
    localStorage: {
      getItem: key => storage.get(key) ?? null
    }
  };
  context.window = context;
  vm.runInNewContext(read("docs/assets/js/pwa-refresh.js"), context);
  return { context, deleted, unregistered, registered, messages, storage };
}

test("Refresh App Files performs no destructive action while offline", async () => {
  const harness = refreshHarness({ online: false });
  await harness.context.MoonsPwaRefresh.refreshAppFiles({
    cachePrefix: "sof-13-moons-",
    currentCoreCache: "sof-13-moons-core-2026.07.16.2",
    status: message => harness.messages.push(message)
  });
  assert.deepEqual(harness.deleted, []);
  assert.deepEqual(harness.unregistered, []);
  assert.deepEqual(harness.registered, []);
  assert.equal(
    harness.messages.at(-1),
    "Reconnect to the internet before refreshing app files."
  );
});

test("Refresh App Files preserves data and removes only owned caches", async () => {
  const harness = refreshHarness();
  const before = new Map(harness.storage);
  await harness.context.MoonsPwaRefresh.refreshAppFiles({
    cachePrefix: "sof-13-moons-",
    currentCoreCache: "sof-13-moons-core-old",
    status: message => harness.messages.push(message)
  });
  assert.deepEqual(
    harness.deleted.sort(),
    ["sof-13-moons-runtime-old"]
  );
  assert.deepEqual(harness.unregistered, ["moons"]);
  assert.equal(harness.registered.length, 1);
  assert.deepEqual(harness.storage, before);
  assert.match(harness.context.replaced, /moons\.html\?refresh=/);
});

test("Refresh App Files keeps recovery caches when replacement install fails", async () => {
  const harness = refreshHarness();
  harness.context.navigator.serviceWorker.register = async url => {
    harness.registered.push(url);
    return { installing: { state: "redundant" } };
  };
  await harness.context.MoonsPwaRefresh.refreshAppFiles({
    cachePrefix: "sof-13-moons-",
    currentCoreCache: "sof-13-moons-core-old",
    status: message => harness.messages.push(message)
  });
  assert.deepEqual(harness.deleted, []);
  assert.equal(harness.context.replaced, undefined);
  assert.match(harness.messages.at(-1), /saved data was preserved/);
});

class MemoryStorage {
  constructor(entries = {}) {
    Object.entries(entries).forEach(([key, value]) => this.setItem(key, value));
  }

  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this, key) ? this[key] : null;
  }

  setItem(key, value) {
    this[key] = String(value);
  }

  removeItem(key) {
    delete this[key];
  }
}

function storageHarness(entries) {
  const localStorage = new MemoryStorage(entries);
  const window = {
    SOF_13_MOONS: { APP_VERSION: "2026.07.16.2" }
  };
  vm.runInNewContext(read("docs/assets/js/moons-storage.js"), {
    window,
    localStorage,
    URL,
    Blob,
    setTimeout
  });
  return { localStorage, storage: window.MoonsStorage };
}

test("Merge deduplicates logs and preserves settings and conflicts", () => {
  const existingLog = { saved: "2026-07-16T00:00:00Z", text: "existing" };
  const addedLog = { saved: "2026-07-16T01:00:00Z", text: "added" };
  const harness = storageHarness({
    sof_moon_logs_v3: JSON.stringify([existingLog]),
    sof_moons_tz_v2: "UTC"
  });
  const result = harness.storage.importData({
    exportSchemaVersion: 1,
    records: {
      sof_moon_logs_v3: JSON.stringify([
        existingLog,
        { ...existingLog, text: "conflicting edit" },
        addedLog
      ]),
      sof_moons_tz_v2: "America/New_York"
    }
  }, "merge");

  assert.deepEqual(
    JSON.parse(harness.localStorage.getItem("sof_moon_logs_v3")),
    [existingLog, addedLog]
  );
  assert.equal(harness.localStorage.getItem("sof_moons_tz_v2"), "UTC");
  assert.deepEqual(
    { ...result },
    { imported: 0, merged: 1, skipped: 2, conflicts: 1 }
  );
  const rollback = JSON.parse(
    harness.localStorage.getItem("sof_moons_import_rollback")
  );
  assert.equal(rollback.records.sof_moons_tz_v2, "UTC");
});

test("Merge combines object data without overwriting existing properties", () => {
  const harness = storageHarness({
    sof_moons_saved_patterns_v1: JSON.stringify({
      existing: "keep",
      same: true
    })
  });
  const result = harness.storage.importData({
    exportSchemaVersion: 1,
    records: {
      sof_moons_saved_patterns_v1: JSON.stringify({
        existing: "overwrite",
        same: true,
        added: "new"
      })
    }
  }, "merge");

  assert.deepEqual(
    JSON.parse(harness.localStorage.getItem("sof_moons_saved_patterns_v1")),
    { existing: "keep", same: true, added: "new" }
  );
  assert.deepEqual(
    { ...result },
    { imported: 0, merged: 1, skipped: 1, conflicts: 1 }
  );
});
