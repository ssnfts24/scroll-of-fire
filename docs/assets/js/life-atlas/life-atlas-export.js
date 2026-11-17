/**
 * Codex Life Atlas — portable backup export and restore detection.
 *
 * The Life Atlas repository already exposes exportRecords(); this module is
 * the portable file boundary around it. A backup is a single JSON envelope
 * holding canonical LifeRecords, so a backup restores through the existing
 * repository.importRecords() path with original ids intact — unlike archive
 * imports (ICS / JSON / CSV), which are normalized into new private records
 * by the ingestion pipeline and cannot carry canonical records losslessly.
 *
 * No network calls. The downloaded file contains the user's private records
 * and must be labelled that way wherever it is offered.
 */
(function (root, factory) {
  let schema = root.CodexLifeAtlasSchema;

  if (typeof module === "object" && module.exports) {
    schema = require("./life-atlas-schema.js");
    module.exports = factory(schema);
    return;
  }

  root.CodexLifeAtlasExport = factory(schema);
})(typeof globalThis !== "undefined" ? globalThis : this, function (Schema) {
  "use strict";

  if (!Schema) {
    throw new Error("CodexLifeAtlasSchema is required.");
  }

  const FORMAT = "codex-life-atlas-backup";
  const VERSION = "1.0.0";

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function looksLikeLifeRecord(value) {
    return (
      isPlainObject(value) &&
      typeof value.id === "string" &&
      value.id.trim() !== "" &&
      value.schemaVersion === Schema.SCHEMA_VERSION &&
      isPlainObject(value.temporal) &&
      isPlainObject(value.spatial) &&
      isPlainObject(value.provenance) &&
      isPlainObject(value.privacy)
    );
  }

  // Returns "envelope" for a backup file produced here, "records" for a bare
  // array of canonical LifeRecords (e.g. a raw exportRecords() dump), or null
  // when the value is not a Life Atlas backup at all.
  function detectBackup(value) {
    if (Array.isArray(value)) {
      return value.length > 0 && value.every(looksLikeLifeRecord)
        ? "records"
        : null;
    }

    if (
      isPlainObject(value) &&
      value.format === FORMAT &&
      Array.isArray(value.records)
    ) {
      return "envelope";
    }

    return null;
  }

  function buildBackup(records, options = {}) {
    if (!Array.isArray(records)) {
      throw new TypeError("Life Atlas backup requires an array of records.");
    }

    const validated = records.map(record => Schema.createLifeRecord(record));

    return {
      format: FORMAT,
      version: VERSION,
      schemaVersion: Schema.SCHEMA_VERSION,
      exportedAt: options.exportedAt || new Date().toISOString(),
      recordCount: validated.length,
      records: validated
    };
  }

  function serializeBackup(records, options = {}) {
    return JSON.stringify(buildBackup(records, options), null, 2);
  }

  // Parses backup text (or an already-parsed value). Returns null when the
  // input is not a Life Atlas backup, so callers can fall through to the
  // generic archive importers. Records that fail schema validation are
  // reported in `rejected` instead of aborting the whole restore.
  function parseBackup(input) {
    let value = input;

    if (typeof input === "string") {
      try {
        value = JSON.parse(input);
      } catch (_) {
        return null;
      }
    }

    const kind = detectBackup(value);
    if (!kind) return null;

    const list = kind === "envelope" ? value.records : value;
    const records = [];
    const rejected = [];

    list.forEach((item, index) => {
      try {
        records.push(Schema.createLifeRecord(item));
      } catch (error) {
        rejected.push({ index, message: error.message });
      }
    });

    return { format: FORMAT, version: VERSION, kind, records, rejected };
  }

  function filenameFor(date = new Date()) {
    const when = date instanceof Date ? date : new Date(date);
    const stamp = Number.isNaN(when.getTime())
      ? new Date().toISOString().slice(0, 10)
      : when.toISOString().slice(0, 10);
    return `life-atlas-backup-${stamp}.json`;
  }

  // Browser-only download of every record as one JSON backup file.
  function downloadBackup(records, options = {}) {
    const text = serializeBackup(records, options);
    const filename = options.filename || filenameFor();
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { filename, bytes: blob.size, recordCount: records.length };
  }

  return Object.freeze({
    FORMAT,
    VERSION,
    looksLikeLifeRecord,
    detectBackup,
    buildBackup,
    serializeBackup,
    parseBackup,
    filenameFor,
    downloadBackup
  });
});
