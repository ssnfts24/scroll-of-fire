/**
 * Codex Life Atlas
 * Canonical relation graph helpers.
 *
 * Relations are explicit edges between canonical Life Atlas records.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }

  root.CodexLifeAtlasRelations = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const RELATION_TYPES = Object.freeze([
    "related-to",
    "occurred-at",
    "occurred-on",
    "involves",
    "created",
    "witnessed",
    "inspired-by",
    "part-of",
    "before",
    "after",
    "during",
    "revisits",
    "resembles",
    "supports",
    "contradicts",
    "references"
  ]);

  const DIRECTION = Object.freeze([
    "directed",
    "bidirectional"
  ]);

  function cleanString(value, fallback = "") {
    if (value === null || value === undefined) {
      return fallback;
    }

    return String(value).trim();
  }

  function isPlainObject(value) {
    return (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    );
  }

  function makeId() {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return `relation:${crypto.randomUUID()}`;
    }

    return `relation:${Date.now().toString(36)}:${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }

  function normalizeRelation(input = {}) {
    const source = isPlainObject(input) ? input : {};

    const fromId = cleanString(source.fromId);
    const toId = cleanString(source.toId);

    const type = RELATION_TYPES.includes(source.type)
      ? source.type
      : "related-to";

    const direction = DIRECTION.includes(source.direction)
      ? source.direction
      : "directed";

    return {
      id: cleanString(source.id) || makeId(),
      schemaVersion: "1.0.0",

      fromId,
      toId,

      type,
      direction,

      createdAt:
        source.createdAt &&
        Number.isFinite(Date.parse(source.createdAt))
          ? new Date(source.createdAt).toISOString()
          : new Date().toISOString(),

      metadata: isPlainObject(source.metadata)
        ? { ...source.metadata }
        : {}
    };
  }

  function validateRelation(relation) {
    const errors = [];

    if (!isPlainObject(relation)) {
      return {
        valid: false,
        errors: ["Relation must be an object."]
      };
    }

    if (!cleanString(relation.id)) {
      errors.push("id is required.");
    }

    if (!cleanString(relation.fromId)) {
      errors.push("fromId is required.");
    }

    if (!cleanString(relation.toId)) {
      errors.push("toId is required.");
    }

    if (
      relation.fromId &&
      relation.toId &&
      relation.fromId === relation.toId
    ) {
      errors.push(
        "A relation cannot connect a record to itself."
      );
    }

    if (!RELATION_TYPES.includes(relation.type)) {
      errors.push(`Unknown relation type: ${relation.type}`);
    }

    if (!DIRECTION.includes(relation.direction)) {
      errors.push(
        `Unknown relation direction: ${relation.direction}`
      );
    }

    if (!isPlainObject(relation.metadata)) {
      errors.push("metadata must be an object.");
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  function createRelation(input = {}) {
    const relation = normalizeRelation(input);
    const validation = validateRelation(relation);

    if (!validation.valid) {
      const error = new Error(
        `Invalid Life Atlas relation: ${validation.errors.join(" ")}`
      );

      error.validation = validation;
      throw error;
    }

    return relation;
  }

  function relationKey(relation) {
    const normalized = createRelation(relation);

    if (normalized.direction === "bidirectional") {
      const ids = [
        normalized.fromId,
        normalized.toId
      ].sort();

      return [
        normalized.type,
        normalized.direction,
        ids[0],
        ids[1]
      ].join("|");
    }

    return [
      normalized.type,
      normalized.direction,
      normalized.fromId,
      normalized.toId
    ].join("|");
  }

  function createRelationRepository(initialRelations = []) {
    const relations = new Map();
    const keys = new Map();

    function clone(value) {
      return JSON.parse(JSON.stringify(value));
    }

    async function put(input) {
      const relation = createRelation(input);
      const key = relationKey(relation);

      const existingId = keys.get(key);

      if (existingId && existingId !== relation.id) {
        return clone(relations.get(existingId));
      }

      relations.set(
        relation.id,
        clone(relation)
      );

      keys.set(
        key,
        relation.id
      );

      return clone(relation);
    }

    async function get(id) {
      if (!id || !relations.has(String(id))) {
        return null;
      }

      return clone(
        relations.get(String(id))
      );
    }

    async function remove(id) {
      const keyId = String(id);

      if (!relations.has(keyId)) {
        return false;
      }

      const relation = relations.get(keyId);
      const key = relationKey(relation);

      relations.delete(keyId);

      if (keys.get(key) === keyId) {
        keys.delete(key);
      }

      return true;
    }

    async function all() {
      return [...relations.values()]
        .map(clone);
    }

    async function forRecord(recordId) {
      const id = String(recordId);

      return [...relations.values()]
        .filter(relation =>
          relation.fromId === id ||
          relation.toId === id
        )
        .map(clone);
    }

    async function outgoing(recordId) {
      const id = String(recordId);

      return [...relations.values()]
        .filter(relation =>
          relation.fromId === id ||
          (
            relation.direction === "bidirectional" &&
            relation.toId === id
          )
        )
        .map(clone);
    }

    async function incoming(recordId) {
      const id = String(recordId);

      return [...relations.values()]
        .filter(relation =>
          relation.toId === id ||
          (
            relation.direction === "bidirectional" &&
            relation.fromId === id
          )
        )
        .map(clone);
    }

    async function between(firstId, secondId) {
      const a = String(firstId);
      const b = String(secondId);

      return [...relations.values()]
        .filter(relation => {
          if (
            relation.fromId === a &&
            relation.toId === b
          ) {
            return true;
          }

          if (
            relation.direction === "bidirectional" &&
            relation.fromId === b &&
            relation.toId === a
          ) {
            return true;
          }

          return false;
        })
        .map(clone);
    }

    async function removeForRecord(recordId) {
      const matches =
        await forRecord(recordId);

      for (const relation of matches) {
        await remove(relation.id);
      }

      return matches.length;
    }

    async function count() {
      return relations.size;
    }

    async function clear() {
      relations.clear();
      keys.clear();
    }

    for (const input of initialRelations) {
      const relation = createRelation(input);
      const key = relationKey(relation);

      if (!keys.has(key)) {
        relations.set(
          relation.id,
          clone(relation)
        );

        keys.set(
          key,
          relation.id
        );
      }
    }

    return Object.freeze({
      put,
      get,
      remove,
      all,
      forRecord,
      outgoing,
      incoming,
      between,
      removeForRecord,
      count,
      clear
    });
  }

  return Object.freeze({
    RELATION_TYPES,
    DIRECTION,

    createRelation,
    normalizeRelation,
    validateRelation,
    relationKey,

    createRelationRepository
  });
});
