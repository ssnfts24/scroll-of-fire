/**
 * Codex Life Atlas
 * IndexedDB persistence adapter.
 *
 * Versioned, local-first, renderer-independent storage.
 */
(function (root, factory) {
  let Schema = root.CodexLifeAtlasSchema;

  if (typeof module === "object" && module.exports) {
    Schema = require("./life-atlas-schema.js");
    module.exports = factory(Schema);
    return;
  }

  root.CodexLifeAtlasIndexedDb = factory(Schema);
})(typeof globalThis !== "undefined" ? globalThis : this, function (Schema) {
  "use strict";

  if (!Schema) {
    throw new Error("CodexLifeAtlasSchema is required.");
  }

  const DB_NAME = "codex-life-atlas";
  const DB_VERSION = 1;

  const STORES = Object.freeze({
    records: "records",
    relations: "relations",
    media: "media",
    settings: "settings",
    migrations: "migrations"
  });

  function clone(value) {
    return value == null
      ? value
      : JSON.parse(JSON.stringify(value));
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error || new Error("IndexedDB request failed."));
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error || new Error("IndexedDB transaction failed."));
      transaction.onabort = () =>
        reject(transaction.error || new Error("IndexedDB transaction aborted."));
    });
  }

  function hasIndexedDb(indexedDBLike) {
    return Boolean(
      indexedDBLike &&
      typeof indexedDBLike.open === "function"
    );
  }

  function openDatabase({
    indexedDB: indexedDBLike =
      typeof globalThis !== "undefined"
        ? globalThis.indexedDB
        : null,
    name = DB_NAME,
    version = DB_VERSION
  } = {}) {
    if (!hasIndexedDb(indexedDBLike)) {
      return Promise.reject(
        new Error("IndexedDB is unavailable.")
      );
    }

    return new Promise((resolve, reject) => {
      const request =
        indexedDBLike.open(name, version);

      request.onupgradeneeded = event => {
        const db = request.result;
        const oldVersion = event.oldVersion || 0;

        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains(STORES.records)) {
            const records = db.createObjectStore(
              STORES.records,
              { keyPath: "id" }
            );

            records.createIndex(
              "type",
              "type",
              { unique: false }
            );

            records.createIndex(
              "civilDate",
              "temporal.civilDate",
              { unique: false }
            );

            records.createIndex(
              "patternYear",
              "temporal.patternYear",
              { unique: false }
            );

            records.createIndex(
              "patternDay",
              "temporal.patternDay",
              { unique: false }
            );

            records.createIndex(
              "moon",
              "temporal.moon",
              { unique: false }
            );

            records.createIndex(
              "moonDay",
              "temporal.moonDay",
              { unique: false }
            );
          }

          if (!db.objectStoreNames.contains(STORES.relations)) {
            const relations = db.createObjectStore(
              STORES.relations,
              { keyPath: "id" }
            );

            relations.createIndex(
              "fromId",
              "fromId",
              { unique: false }
            );

            relations.createIndex(
              "toId",
              "toId",
              { unique: false }
            );

            relations.createIndex(
              "type",
              "type",
              { unique: false }
            );
          }

          if (!db.objectStoreNames.contains(STORES.media)) {
            db.createObjectStore(
              STORES.media,
              { keyPath: "id" }
            );
          }

          if (!db.objectStoreNames.contains(STORES.settings)) {
            db.createObjectStore(
              STORES.settings,
              { keyPath: "key" }
            );
          }

          if (!db.objectStoreNames.contains(STORES.migrations)) {
            db.createObjectStore(
              STORES.migrations,
              { keyPath: "id" }
            );
          }
        }
      };

      request.onsuccess = () =>
        resolve(request.result);

      request.onerror = () =>
        reject(
          request.error ||
          new Error("Unable to open Life Atlas database.")
        );

      request.onblocked = () =>
        reject(
          new Error("Life Atlas database upgrade is blocked.")
        );
    });
  }

  function createRecordAdapter(options = {}) {
    let dbPromise = null;

    function db() {
      if (!dbPromise) {
        dbPromise = openDatabase(options);
      }

      return dbPromise;
    }

    async function withStore(mode, fn) {
      const database = await db();

      const transaction =
        database.transaction(
          STORES.records,
          mode
        );

      const store =
        transaction.objectStore(
          STORES.records
        );

      const result =
        await fn(store, transaction);

      await transactionDone(transaction);

      return result;
    }

    async function get(id) {
      if (!id) return null;

      return withStore(
        "readonly",
        async store =>
          clone(
            await requestToPromise(
              store.get(String(id))
            )
          ) || null
      );
    }

    async function set(input) {
      const record =
        Schema.createLifeRecord(input);

      await withStore(
        "readwrite",
        async store => {
          await requestToPromise(
            store.put(clone(record))
          );

          return null;
        }
      );

      return clone(record);
    }

    async function deleteRecord(id) {
      if (!id) return false;

      const existing =
        await get(id);

      if (!existing) return false;

      await withStore(
        "readwrite",
        async store => {
          await requestToPromise(
            store.delete(String(id))
          );

          return null;
        }
      );

      return true;
    }

    async function values() {
      return withStore(
        "readonly",
        async store => {
          if (
            typeof store.getAll === "function"
          ) {
            const records =
              await requestToPromise(
                store.getAll()
              );

            return clone(records || []);
          }

          const records = [];

          await new Promise((resolve, reject) => {
            const request =
              store.openCursor();

            request.onsuccess = () => {
              const cursor =
                request.result;

              if (!cursor) {
                resolve();
                return;
              }

              records.push(
                clone(cursor.value)
              );

              cursor.continue();
            };

            request.onerror = () =>
              reject(
                request.error ||
                new Error("Life Atlas cursor failed.")
              );
          });

          return records;
        }
      );
    }

    async function clear() {
      await withStore(
        "readwrite",
        async store => {
          await requestToPromise(
            store.clear()
          );

          return null;
        }
      );
    }

    async function size() {
      return withStore(
        "readonly",
        async store =>
          Number(
            await requestToPromise(
              store.count()
            )
          ) || 0
      );
    }

    async function close() {
      if (!dbPromise) return;

      try {
        const database =
          await dbPromise;

        database.close();
      } finally {
        dbPromise = null;
      }
    }

    return Object.freeze({
      get,
      set,
      delete: deleteRecord,
      values,
      clear,
      size,
      close
    });
  }

  async function diagnostics(options = {}) {
    const indexedDBLike =
      options.indexedDB ??
      (
        typeof globalThis !== "undefined"
          ? globalThis.indexedDB
          : null
      );

    const result = {
      available:
        hasIndexedDb(indexedDBLike),
      dbName:
        options.name || DB_NAME,
      dbVersion:
        options.version || DB_VERSION,
      stores:
        Object.values(STORES),
      opened: false,
      error: null
    };

    if (!result.available) {
      return result;
    }

    try {
      const db =
        await openDatabase(options);

      result.opened = true;
      db.close();
    } catch (error) {
      result.error =
        error?.message ||
        String(error);
    }

    return result;
  }

  return Object.freeze({
    DB_NAME,
    DB_VERSION,
    STORES,

    hasIndexedDb,
    openDatabase,
    createRecordAdapter,
    diagnostics,

    _internals: Object.freeze({
      requestToPromise,
      transactionDone
    })
  });
});
