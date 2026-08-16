/**
 * Codex Life Atlas
 * Local-first canonical record repository.
 *
 * Storage-independent by design.
 */
(function (root, factory) {
  let schema = root.CodexLifeAtlasSchema;

  if (typeof module === "object" && module.exports) {
    schema = require("./life-atlas-schema.js");
    module.exports = factory(schema);
    return;
  }

  root.CodexLifeAtlasRepository = factory(schema);
})(typeof globalThis !== "undefined" ? globalThis : this, function (Schema) {
  "use strict";

  if (!Schema) {
    throw new Error("CodexLifeAtlasSchema is required.");
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeQuery(query = {}) {
    return {
      type: query.type || null,
      subtype: query.subtype || null,
      tag: query.tag || null,
      text:
        typeof query.text === "string"
          ? query.text.trim().toLowerCase()
          : "",
      moon:
        Number.isFinite(Number(query.moon))
          ? Number(query.moon)
          : null,
      moonDay:
        Number.isFinite(Number(query.moonDay))
          ? Number(query.moonDay)
          : null,
      patternYear:
        Number.isFinite(Number(query.patternYear))
          ? Number(query.patternYear)
          : null,
      patternDay:
        Number.isFinite(Number(query.patternDay))
          ? Number(query.patternDay)
          : null,
      week:
        Number.isFinite(Number(query.week))
          ? Number(query.week)
          : null,
      civilDate:
        typeof query.civilDate === "string"
          ? query.civilDate.trim()
          : null,
      placeId: query.placeId || null,
      visibility: query.visibility || null
    };
  }

  function matches(record, rawQuery = {}) {
    const query = normalizeQuery(rawQuery);

    if (query.type && record.type !== query.type) return false;
    if (query.subtype && record.subtype !== query.subtype) return false;

    if (
      query.tag &&
      !record.tags.includes(query.tag)
    ) {
      return false;
    }

    if (
      query.moon !== null &&
      record.temporal.moon !== query.moon
    ) {
      return false;
    }

    if (
      query.moonDay !== null &&
      record.temporal.moonDay !== query.moonDay
    ) {
      return false;
    }

    if (
      query.patternYear !== null &&
      record.temporal.patternYear !== query.patternYear
    ) {
      return false;
    }

    if (
      query.patternDay !== null &&
      record.temporal.patternDay !== query.patternDay
    ) {
      return false;
    }

    if (
      query.week !== null &&
      record.temporal.week !== query.week
    ) {
      return false;
    }

    if (
      query.civilDate &&
      record.temporal.civilDate !== query.civilDate
    ) {
      return false;
    }

    if (
      query.placeId &&
      record.spatial.placeId !== query.placeId
    ) {
      return false;
    }

    if (
      query.visibility &&
      record.privacy.visibility !== query.visibility
    ) {
      return false;
    }

    if (query.text) {
      const haystack = [
        record.title,
        record.summary,
        record.type,
        record.subtype,
        ...record.tags
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(query.text)) return false;
    }

    return true;
  }

  function createMemoryAdapter(initialRecords = []) {
    const records = new Map();

    for (const input of initialRecords) {
      const record = Schema.createLifeRecord(input);
      records.set(record.id, clone(record));
    }

    return {
      async get(id) {
        return records.has(id)
          ? clone(records.get(id))
          : null;
      },

      async set(record) {
        records.set(record.id, clone(record));
        return clone(record);
      },

      async delete(id) {
        return records.delete(id);
      },

      async values() {
        return [...records.values()].map(clone);
      },

      async clear() {
        records.clear();
      },

      async size() {
        return records.size;
      }
    };
  }

  function createRepository(options = {}) {
    const adapter =
      options.adapter || createMemoryAdapter();

    async function put(input) {
      const existing =
        input && input.id
          ? await adapter.get(input.id)
          : null;

      const source = clone(input || {});

      if (existing) {
        source.provenance = {
          ...existing.provenance,
          ...(source.provenance || {}),
          createdAt: existing.provenance.createdAt,
          updatedAt: new Date().toISOString()
        };
      }

      const record = Schema.createLifeRecord(source);
      return adapter.set(record);
    }

    async function get(id) {
      if (!id) return null;
      return adapter.get(String(id));
    }

    async function remove(id) {
      if (!id) return false;
      return adapter.delete(String(id));
    }

    async function all() {
      return adapter.values();
    }

    async function query(criteria = {}) {
      const records = await adapter.values();

      return records
        .filter(record => matches(record, criteria))
        .sort((a, b) => {
          const aTime =
            Date.parse(
              a.temporal.instant ||
              a.temporal.start ||
              a.provenance.createdAt
            ) || 0;

          const bTime =
            Date.parse(
              b.temporal.instant ||
              b.temporal.start ||
              b.provenance.createdAt
            ) || 0;

          return bTime - aTime;
        });
    }

    async function count(criteria = null) {
      if (!criteria) {
        return adapter.size();
      }

      return (await query(criteria)).length;
    }

    async function clear() {
      return adapter.clear();
    }

    async function exportRecords(criteria = {}) {
      return clone(await query(criteria));
    }

    async function importRecords(records = []) {
      if (!Array.isArray(records)) {
        throw new TypeError(
          "Life Atlas import requires an array."
        );
      }

      const imported = [];
      const rejected = [];

      for (let index = 0; index < records.length; index += 1) {
        try {
          imported.push(await put(records[index]));
        } catch (error) {
          rejected.push({
            index,
            message: error.message
          });
        }
      }

      return {
        imported,
        rejected
      };
    }

    return Object.freeze({
      put,
      get,
      remove,
      all,
      query,
      count,
      clear,
      exportRecords,
      importRecords
    });
  }

  function createPersistentRepository(options = {}) {
    const IndexedDb =
      options.IndexedDb ||
      (
        typeof globalThis !== "undefined"
          ? globalThis.CodexLifeAtlasIndexedDb
          : null
      );

    if (
      !IndexedDb ||
      typeof IndexedDb.createRecordAdapter !== "function"
    ) {
      throw new Error(
        "CodexLifeAtlasIndexedDb adapter is required."
      );
    }

    return createRepository({
      adapter:
        IndexedDb.createRecordAdapter(
          options
        )
    });
  }

  return Object.freeze({
    createRepository,
    createMemoryAdapter,
    createPersistentRepository,
    matches,
    normalizeQuery
  });
});
