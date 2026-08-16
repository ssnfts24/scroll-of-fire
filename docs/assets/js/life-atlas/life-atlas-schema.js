/**
 * Codex Life Atlas
 * Canonical LifeRecord schema and normalization layer.
 *
 * This module intentionally has no dependency on:
 * - DOM
 * - Three.js
 * - network access
 * - IndexedDB
 * - service workers
 *
 * It is the portable data boundary for the Life Atlas.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.CodexLifeAtlasSchema = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_VERSION = "1.0.0";

  const RECORD_TYPES = Object.freeze([
    "event",
    "witness",
    "journal",
    "media",
    "artifact",
    "project",
    "journey",
    "place",
    "person",
    "relationship",
    "oracle",
    "astronomy",
    "environment",
    "milestone",
    "note",
    "custom"
  ]);

  const VISIBILITY = Object.freeze([
    "private",
    "trusted",
    "shared",
    "public"
  ]);

  const PRECISION = Object.freeze([
    "exact",
    "approximate",
    "region",
    "hidden",
    "unknown"
  ]);

  function isPlainObject(value) {
    return (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    );
  }

  function cleanString(value, fallback = "") {
    if (value === null || value === undefined) return fallback;
    return String(value).trim();
  }

  function cleanNullableString(value) {
    const result = cleanString(value);
    return result || null;
  }

  function finiteNumber(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function booleanValue(value, fallback = false) {
    return typeof value === "boolean" ? value : fallback;
  }

  function uniqueStrings(values) {
    if (!Array.isArray(values)) return [];

    return [
      ...new Set(
        values
          .map(value => cleanString(value))
          .filter(Boolean)
      )
    ];
  }

  function isoOrNull(value) {
    const text = cleanString(value);
    if (!text) return null;

    const time = Date.parse(text);
    if (!Number.isFinite(time)) return null;

    return new Date(time).toISOString();
  }

  function makeId(prefix = "life") {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return `${prefix}:${crypto.randomUUID()}`;
    }

    return `${prefix}:${Date.now().toString(36)}:${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }

  function normalizeTemporal(input = {}) {
    const source = isPlainObject(input) ? input : {};

    return {
      instant: isoOrNull(source.instant),
      start: isoOrNull(source.start),
      end: isoOrNull(source.end),

      timezone: cleanNullableString(source.timezone),
      boundaryMode: cleanNullableString(source.boundaryMode),

      civilDate: cleanNullableString(source.civilDate),

      patternYear: finiteNumber(source.patternYear),
      moon: finiteNumber(source.moon),
      moonDay: finiteNumber(source.moonDay),
      patternDay: finiteNumber(source.patternDay),
      week: finiteNumber(source.week),

      weekGate: cleanNullableString(source.weekGate),
      outsideDay: booleanValue(source.outsideDay, false)
    };
  }

  function normalizeSpatial(input = {}) {
    const source = isPlainObject(input) ? input : {};

    const latitude = finiteNumber(source.latitude);
    const longitude = finiteNumber(source.longitude);
    const altitude = finiteNumber(source.altitude);

    return {
      latitude:
        latitude !== null && latitude >= -90 && latitude <= 90
          ? latitude
          : null,

      longitude:
        longitude !== null && longitude >= -180 && longitude <= 180
          ? longitude
          : null,

      altitude,

      placeId: cleanNullableString(source.placeId),
      placeLabel: cleanNullableString(source.placeLabel),

      precision: PRECISION.includes(source.precision)
        ? source.precision
        : "unknown"
    };
  }

  function normalizeProvenance(input = {}) {
    const source = isPlainObject(input) ? input : {};

    return {
      sourceType: cleanNullableString(source.sourceType),
      sourceId: cleanNullableString(source.sourceId),

      createdAt:
        isoOrNull(source.createdAt) || new Date().toISOString(),

      updatedAt:
        isoOrNull(source.updatedAt) ||
        isoOrNull(source.createdAt) ||
        new Date().toISOString(),

      importedAt: isoOrNull(source.importedAt),

      confidence:
        finiteNumber(source.confidence) !== null
          ? Math.max(0, Math.min(1, finiteNumber(source.confidence)))
          : null,

      calculationAuthority:
        cleanNullableString(source.calculationAuthority)
    };
  }

  function normalizePrivacy(input = {}) {
    const source = isPlainObject(input) ? input : {};

    return {
      visibility: VISIBILITY.includes(source.visibility)
        ? source.visibility
        : "private",

      containsPersonalData:
        booleanValue(source.containsPersonalData, false),

      shareAllowed:
        booleanValue(source.shareAllowed, false)
    };
  }

  function normalizeRelation(input) {
    if (typeof input === "string") {
      return {
        id: makeId("relation"),
        type: "related",
        targetId: cleanString(input),
        direction: "outgoing",
        metadata: {}
      };
    }

    if (!isPlainObject(input)) return null;

    const targetId = cleanString(
      input.targetId || input.recordId || input.id
    );

    if (!targetId) return null;

    return {
      id: cleanString(input.relationId) || makeId("relation"),
      type: cleanString(input.type, "related"),
      targetId,
      direction: cleanString(input.direction, "outgoing"),
      metadata: isPlainObject(input.metadata)
        ? { ...input.metadata }
        : {}
    };
  }

  function normalizeRelations(values) {
    if (!Array.isArray(values)) return [];

    return values
      .map(normalizeRelation)
      .filter(Boolean);
  }

  function normalizeLifeRecord(input = {}) {
    const source = isPlainObject(input) ? input : {};

    const type = RECORD_TYPES.includes(source.type)
      ? source.type
      : "custom";

    return {
      id: cleanString(source.id) || makeId(type),

      schemaVersion: SCHEMA_VERSION,

      type,
      subtype: cleanNullableString(source.subtype),

      title: cleanString(source.title),
      summary: cleanString(source.summary),

      temporal: normalizeTemporal(source.temporal),
      spatial: normalizeSpatial(source.spatial),

      relations: normalizeRelations(source.relations),
      tags: uniqueStrings(source.tags),

      provenance: normalizeProvenance(source.provenance),
      privacy: normalizePrivacy(source.privacy),

      payload: isPlainObject(source.payload)
        ? { ...source.payload }
        : {}
    };
  }

  function validateLifeRecord(record) {
    const errors = [];

    if (!isPlainObject(record)) {
      return {
        valid: false,
        errors: ["LifeRecord must be an object."]
      };
    }

    if (!cleanString(record.id)) {
      errors.push("id is required.");
    }

    if (record.schemaVersion !== SCHEMA_VERSION) {
      errors.push(
        `schemaVersion must be ${SCHEMA_VERSION}.`
      );
    }

    if (!RECORD_TYPES.includes(record.type)) {
      errors.push(`Unknown record type: ${record.type}`);
    }

    if (!isPlainObject(record.temporal)) {
      errors.push("temporal must be an object.");
    }

    if (!isPlainObject(record.spatial)) {
      errors.push("spatial must be an object.");
    }

    if (!Array.isArray(record.relations)) {
      errors.push("relations must be an array.");
    }

    if (!Array.isArray(record.tags)) {
      errors.push("tags must be an array.");
    }

    if (!isPlainObject(record.provenance)) {
      errors.push("provenance must be an object.");
    }

    if (!isPlainObject(record.privacy)) {
      errors.push("privacy must be an object.");
    }

    if (!isPlainObject(record.payload)) {
      errors.push("payload must be an object.");
    }

    if (
      record.privacy &&
      record.privacy.visibility === "public" &&
      record.privacy.containsPersonalData &&
      !record.privacy.shareAllowed
    ) {
      errors.push(
        "Public records containing personal data require explicit shareAllowed."
      );
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  function createLifeRecord(input = {}) {
    const record = normalizeLifeRecord(input);
    const validation = validateLifeRecord(record);

    if (!validation.valid) {
      const error = new Error(
        `Invalid LifeRecord: ${validation.errors.join(" ")}`
      );

      error.validation = validation;
      throw error;
    }

    return record;
  }

  function cloneLifeRecord(record) {
    return createLifeRecord(
      JSON.parse(JSON.stringify(record))
    );
  }

  return Object.freeze({
    SCHEMA_VERSION,
    RECORD_TYPES,
    VISIBILITY,
    PRECISION,

    createLifeRecord,
    normalizeLifeRecord,
    validateLifeRecord,
    cloneLifeRecord,

    normalizeTemporal,
    normalizeSpatial,
    normalizeProvenance,
    normalizePrivacy,
    normalizeRelations
  });
});
