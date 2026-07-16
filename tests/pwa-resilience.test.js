"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

function serviceWorkerHarness(failingPath, { failPromotion = false } = {}) {
  const listeners = {};
  const stores = new Map();
  const clientMessages = [];
  const cacheApi = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async put(key, value) {
          if (failPromotion &&
              name === "sof-13-moons-core-2026.07.16.2" &&
              String(key).endsWith("/assets/js/pwa.js")) {
            throw new Error("promotion failed");
          }
          store.set(String(key), value);
        },
        async match(key, options = {}) {
          const requested = key?.url || String(key);
          if (!options.ignoreSearch) return store.get(requested);
          const withoutSearch = new URL(requested).origin + new URL(requested).pathname;
          for (const [storedKey, value] of store) {
            const storedUrl = new URL(storedKey);
            if (`${storedUrl.origin}${storedUrl.pathname}` === withoutSearch) return value;
          }
          return undefined;
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
    clients: {
      claim: async () => {},
      matchAll: async () => [{
        postMessage(message) {
          clientMessages.push(message);
        }
      }]
    },
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
    Response,
    importScripts() {},
    fetch: async request => {
      const url = String(request);
      if (failingPath && url.endsWith(failingPath)) {
        return { ok: false, status: 404, statusText: "Not Found" };
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        url,
        body: `NEW:${url}`,
        clone() {
          return this;
        }
      };
    }
  };
  vm.runInNewContext(read("docs/service-worker.js"), context);
  return { context, listeners, stores, clientMessages };
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

async function activateWorker(harness) {
  let activation;
  harness.listeners.activate({
    waitUntil(promise) {
      activation = promise;
    }
  });
  return activation;
}

async function messageWorker(harness, data) {
  let result;
  harness.listeners.message({
    data,
    source: null,
    waitUntil(promise) {
      result = promise;
    }
  });
  return result;
}

async function fetchWorker(harness, url, destination) {
  let result;
  harness.listeners.fetch({
    request: {
      method: "GET",
      mode: "same-origin",
      destination,
      url
    },
    respondWith(promise) {
      result = promise;
    }
  });
  return result;
}

test("missing optional image does not block install or offline startup", async () => {
  const harness = serviceWorkerHarness("apple-touch-icon.png");
  await installWorker(harness);
  assert.deepEqual(
    { ...harness.clientMessages.at(-1) },
    {
      type: "APP_SHELL_READY",
      appVersion: "2026.07.16.2",
      serviceWorkerBuild: "2026.07.16.2",
      mandatoryAssetCount: 26
    }
  );
  await activateWorker(harness);
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
  assert.equal(harness.clientMessages.at(-1).type, "APP_SHELL_FAILED");
  assert.equal(harness.stores.has("sof-13-moons-install-2026.07.16.2"), false);
});

test("normal activation retires old caches after mandatory precaching", async () => {
  const harness = serviceWorkerHarness();
  await Promise.all([
    harness.context.caches.open("sof-13-moons-core-old"),
    harness.context.caches.open("sof-13-moons-runtime-old"),
    harness.context.caches.open("sof-13-moons-images-old"),
    harness.context.caches.open("sof-13-moons-core-older"),
    harness.context.caches.open("sof-13-moons-runtime-2026.07.16.2"),
    harness.context.caches.open("sof-13-moons-images-2026.07.16.2")
  ]);
  await installWorker(harness);
  await activateWorker(harness);
  assert.deepEqual(
    [...harness.stores.keys()].sort(),
    [
      "sof-13-moons-core-2026.07.16.2",
      "sof-13-moons-images-2026.07.16.2",
      "sof-13-moons-runtime-2026.07.16.2"
    ]
  );
});

test("verified manual refresh preserves recovery caches through activation", async () => {
  const harness = serviceWorkerHarness();
  await Promise.all([
    harness.context.caches.open("sof-13-moons-core-old"),
    harness.context.caches.open("sof-13-moons-runtime-old")
  ]);
  await installWorker(harness);
  await messageWorker(harness, {
    type: "ACTIVATE_VERIFIED_REFRESH",
    recoveryCaches: ["sof-13-moons-core-old"]
  });
  await activateWorker(harness);
  assert.equal(harness.stores.has("sof-13-moons-core-old"), true);
  assert.equal(harness.stores.has("sof-13-moons-runtime-old"), false);
});

test("stale completed refresh metadata does not retain old caches", async () => {
  const harness = serviceWorkerHarness();
  await Promise.all([
    harness.context.caches.open("sof-13-moons-core-old"),
    harness.context.caches.open("sof-13-moons-refresh-preserve-2026.07.16.2")
  ]);
  await installWorker(harness);
  await activateWorker(harness);
  assert.equal(harness.stores.has("sof-13-moons-core-old"), false);
  assert.equal(
    harness.stores.has("sof-13-moons-refresh-preserve-2026.07.16.2"),
    false
  );
});

test("failed current-core promotion preserves last working caches", async () => {
  const harness = serviceWorkerHarness(null, { failPromotion: true });
  await harness.context.caches.open("sof-13-moons-core-old");
  await installWorker(harness);
  await assert.rejects(activateWorker(harness), /promotion failed/);
  assert.equal(harness.stores.has("sof-13-moons-core-old"), true);
});

test("core requests resolve from the current named cache, never an older cache", async () => {
  const harness = serviceWorkerHarness();
  const legacy = await harness.context.caches.open("legacy-unrelated-cache");
  const urls = [
    "https://example.test/project/assets/js/pwa.js",
    "https://example.test/project/assets/css/moons.css",
    "https://example.test/project/offline.html"
  ];
  await Promise.all(urls.map(url => legacy.put(url, {
    ok: true,
    body: `OLD:${url}`,
    clone() {
      return this;
    }
  })));
  await installWorker(harness);
  await activateWorker(harness);
  harness.context.fetch = async () => {
    throw new Error("offline");
  };

  const responses = await Promise.all([
    fetchWorker(
      harness,
      `${urls[0]}?v=20260716-2`,
      "script"
    ),
    fetchWorker(
      harness,
      `${urls[1]}?v=20260716-2`,
      "style"
    ),
    fetchWorker(harness, urls[2], "document")
  ]);
  responses.forEach(response => assert.match(response.body, /^NEW:/));
  assert.equal([...harness.stores.keys()].filter(name =>
    name.startsWith("sof-13-moons-") &&
    /-(?:old|older)$/.test(name)
  ).length, 0);
});

test("service-worker build marker matches the central app version", () => {
  const version = read("docs/assets/js/moons-version.js")
    .match(/APP_VERSION = "([^"]+)"/)[1];
  const build = read("docs/service-worker.js")
    .match(/SERVICE_WORKER_BUILD = "([^"]+)"/)[1];
  assert.equal(version, "2026.07.16.2");
  assert.equal(build, version);
  assert.match(read("docs/service-worker.js"), new RegExp(`core-\\$\\{VERSION\\}`));
  assert.doesNotMatch(read("docs/service-worker.js"), /\bcaches\.match\(/);
  assert.match(read("docs/assets/js/pwa.js"), /setText\("appVersion", APP_VERSION\)/);
  assert.match(read("docs/13-moons-release-checklist.md"), /App version: `2026\.07\.16\.2`/);
  assert.match(read("docs/13-moons-version-history.md"), /## 2026\.07\.16\.2/);
  const cacheBusters = [
    ...read("docs/moons.html").matchAll(/[?&]v=(\d{8}-\d+)/g)
  ].map(match => match[1]);
  assert.ok(cacheBusters.length > 0);
  assert.deepEqual([...new Set(cacheBusters)], ["20260716-2"]);
});

class MockEventTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }

  removeEventListener(type, callback) {
    this.listeners.get(type)?.delete(callback);
  }

  dispatch(type, event = {}) {
    this.listeners.get(type)?.forEach(callback => callback(event));
  }
}

function refreshHarness({ online = true, scenario = "success" } = {}) {
  const deleted = [];
  const unregistered = [];
  const registered = [];
  const messages = [];
  const storage = new Map([
    ["sof_moon_logs_v3", '[{"saved":"existing"}]'],
    ["sof_moons_tz_v2", "UTC"]
  ]);
  const workerUrl = "https://example.test/project/service-worker.js";
  const serviceWorkers = new MockEventTarget();
  const activationMessages = [];
  const worker = new MockEventTarget();
  worker.state = "installing";
  worker.scriptURL = workerUrl;
  const registration = new MockEventTarget();
  registration.scope = "https://example.test/project/";
  registration.installing = worker;
  let registerCount = 0;
  let readyRequested = false;
  const sendMessage = data => serviceWorkers.dispatch("message", { data, source: worker });
  const ready = (version = "2026.07.16.2", build = version) => sendMessage({
    type: "APP_SHELL_READY",
    appVersion: version,
    serviceWorkerBuild: build,
    mandatoryAssetCount: 26
  });
  const setWorkerState = state => {
    worker.state = state;
    worker.dispatch("statechange");
  };
  worker.postMessage = message => {
    if (message.type === "GET_APP_SHELL_READY" && worker.state === "activated") {
      setTimeout(() => ready(), 0);
      return;
    }
    if (message.type === "GET_APP_SHELL_READY" && !readyRequested) {
      readyRequested = true;
      if (scenario === "timeout") return;
      setTimeout(() => {
        if (scenario === "precache-failure") {
          sendMessage({
            type: "APP_SHELL_FAILED",
            appVersion: "2026.07.16.2",
            serviceWorkerBuild: "2026.07.16.2",
            mandatoryAssetCount: 26
          });
          setWorkerState("redundant");
          return;
        }
        if (scenario === "stale-only") {
          ready("2026.07.16.1", "2026.07.16.1");
          setWorkerState("installed");
          return;
        }
        if (scenario === "wrong-build-only") {
          ready("2026.07.16.2", "2026.07.16.1");
          setWorkerState("installed");
          return;
        }
        ready();
        setWorkerState("installed");
      }, 0);
    }
    if (["SKIP_WAITING", "ACTIVATE_VERIFIED_REFRESH"].includes(message.type)) {
      activationMessages.push(message);
      if (message.type === "ACTIVATE_VERIFIED_REFRESH") {
        deleted.push("sof-13-moons-runtime-old");
      }
      setTimeout(() => {
        setWorkerState("activating");
        registration.installing = null;
        registration.active = worker;
        setWorkerState("activated");
        serviceWorkers.controller = worker;
        serviceWorkers.dispatch("controllerchange");
      }, 0);
    }
  };
  registration.unregister = async () => {
    unregistered.push(registerCount ? "replacement" : "moons");
    return true;
  };
  serviceWorkers.getRegistrations = async () => [
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
  serviceWorkers.getRegistration = async () => registration;
  serviceWorkers.register = async url => {
    registered.push(url);
    registerCount += 1;
    if (registerCount > 1) {
      return {
        scope: registration.scope,
        active: { state: "activated", scriptURL: workerUrl },
        addEventListener() {}
      };
    }
    return registration;
  };
  const sessionValues = new Map();
  const context = {
    URL,
    Date,
    clearTimeout,
    setTimeout,
    window: {},
    document: { baseURI: "https://example.test/project/moons.html" },
    navigator: {
      onLine: online,
      serviceWorker: serviceWorkers
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
    },
    sessionStorage: {
      getItem: key => sessionValues.get(key) ?? null,
      setItem: (key, value) => sessionValues.set(key, String(value)),
      removeItem: key => sessionValues.delete(key)
    }
  };
  context.window = context;
  vm.runInNewContext(read("docs/assets/js/pwa-refresh.js"), context);
  return {
    context,
    activationMessages,
    deleted,
    unregistered,
    registered,
    messages,
    registration,
    serviceWorkers,
    sessionValues,
    storage,
    worker
  };
}

const refreshOptions = (harness, overrides = {}) => ({
  cachePrefix: "sof-13-moons-",
  currentCoreCache: "sof-13-moons-core-old",
  expectedVersion: "2026.07.16.2",
  expectedBuild: "2026.07.16.2",
  status: message => harness.messages.push(message),
  lifecycleTimeoutMs: 25,
  ...overrides
});

test("Refresh App Files performs no destructive action while offline", async () => {
  const harness = refreshHarness({ online: false });
  await harness.context.MoonsPwaRefresh.refreshAppFiles(refreshOptions(harness));
  assert.deepEqual(harness.deleted, []);
  assert.deepEqual(harness.unregistered, []);
  assert.deepEqual(harness.registered, []);
  assert.equal(
    harness.messages.at(-1),
    "Reconnect to the internet before refreshing app files."
  );
});

test("successful installation and startup retire only owned recovery caches", async () => {
  const harness = refreshHarness();
  const before = new Map(harness.storage);
  await harness.context.MoonsPwaRefresh.refreshAppFiles(refreshOptions(harness));
  assert.deepEqual(harness.deleted, ["sof-13-moons-runtime-old"]);
  assert.ok(
    harness.sessionValues.has("sof_moons_refresh_pending"),
    harness.messages.join(" | ")
  );
  await harness.context.MoonsPwaRefresh.completePendingRefresh(refreshOptions(harness));
  assert.deepEqual(
    harness.deleted.sort(),
    [
      "sof-13-moons-refresh-preserve-2026.07.16.2",
      "sof-13-moons-runtime-old"
    ]
  );
  assert.deepEqual(
    [...harness.activationMessages[0].recoveryCaches],
    ["sof-13-moons-core-old"]
  );
  assert.deepEqual(harness.unregistered, ["moons"]);
  assert.equal(harness.registered.length, 1);
  assert.deepEqual(harness.storage, before);
  assert.match(harness.context.replaced, /moons\.html\?refresh=/);
  assert.equal(harness.sessionValues.has("sof_moons_refresh_pending"), false);
  assert.match(harness.messages.at(-1), /safely retired/);
});

test("register success followed by mandatory precache failure preserves recovery", async () => {
  const harness = refreshHarness({ scenario: "precache-failure" });
  const before = new Map(harness.storage);
  await harness.context.MoonsPwaRefresh.refreshAppFiles(refreshOptions(harness));
  assert.deepEqual(harness.deleted, []);
  assert.equal(harness.context.replaced, undefined);
  assert.deepEqual(harness.storage, before);
  assert.equal(harness.worker.state, "redundant");
  assert.equal(harness.sessionValues.has("sof_moons_refresh_pending"), false);
  assert.equal(
    harness.messages.at(-1),
    "App file refresh could not be completed. Your previous recovery files were preserved. Please check your connection and try again."
  );
});

test("installation timeout preserves recovery and does not reload", async () => {
  const harness = refreshHarness({ scenario: "timeout" });
  await harness.context.MoonsPwaRefresh.refreshAppFiles(
    refreshOptions(harness, { lifecycleTimeoutMs: 5 })
  );
  assert.deepEqual(harness.deleted, []);
  assert.equal(harness.context.replaced, undefined);
  assert.equal(harness.sessionValues.has("sof_moons_refresh_pending"), false);
  assert.equal(harness.messages.at(-1), harness.context.MoonsPwaRefresh.failureMessage);
});

test("stale readiness and mismatched build do not authorize refresh", async () => {
  const harness = refreshHarness({ scenario: "stale-only" });
  await harness.context.MoonsPwaRefresh.refreshAppFiles(
    refreshOptions(harness, { lifecycleTimeoutMs: 10 })
  );
  assert.deepEqual(harness.deleted, []);
  assert.equal(harness.context.replaced, undefined);
  assert.equal(harness.sessionValues.has("sof_moons_refresh_pending"), false);
  assert.equal(harness.messages.at(-1), harness.context.MoonsPwaRefresh.failureMessage);
});

test("matching app version with the wrong worker build is rejected", async () => {
  const harness = refreshHarness({ scenario: "wrong-build-only" });
  await harness.context.MoonsPwaRefresh.refreshAppFiles(
    refreshOptions(harness, { lifecycleTimeoutMs: 10 })
  );
  assert.deepEqual(harness.deleted, []);
  assert.equal(harness.context.replaced, undefined);
  assert.equal(harness.sessionValues.has("sof_moons_refresh_pending"), false);
  assert.equal(harness.messages.at(-1), harness.context.MoonsPwaRefresh.failureMessage);
});

test("pending refresh cleanup is a no-op without a transaction marker", async () => {
  const harness = refreshHarness();
  const completed = await harness.context.MoonsPwaRefresh.completePendingRefresh(
    refreshOptions(harness)
  );
  assert.equal(completed, false);
  assert.deepEqual(harness.deleted, []);
  assert.deepEqual(harness.messages, []);
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
