/**
 * Codex Life Atlas
 * Safe legacy migration framework.
 *
 * IMPORTANT:
 * - Detects legacy sources.
 * - Previews conversions before import.
 * - Never deletes legacy source data.
 * - Adapters must explicitly normalize source data.
 * - Migration receipts are independent from source stores.
 */
(function (root, factory) {
  let Schema = root.CodexLifeAtlasSchema;

  if (
    typeof module === "object" &&
    module.exports
  ) {
    Schema = require("./life-atlas-schema.js");
    module.exports = factory(Schema);
    return;
  }

  root.CodexLifeAtlasMigrations =
    factory(Schema);
})(
  typeof globalThis !== "undefined"
    ? globalThis
    : this,
  function (Schema) {
    "use strict";

    if (!Schema) {
      throw new Error(
        "CodexLifeAtlasSchema is required."
      );
    }

    const VERSION = "1.0.0";

    const MIGRATION_POLICY =
      Object.freeze({
        deleteLegacyData: false,
        overwriteLegacyData: false,
        requirePreviewBeforeImport: true,
        preserveUnknownFields: true
      });

    function clone(value) {
      return value == null
        ? value
        : JSON.parse(
            JSON.stringify(value)
          );
    }

    function cleanString(value) {
      if (
        value === null ||
        value === undefined
      ) {
        return "";
      }

      return String(value).trim();
    }

    function safeJsonParse(value) {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        return {
          ok: false,
          value: null,
          error: null
        };
      }

      try {
        return {
          ok: true,
          value:
            typeof value === "string"
              ? JSON.parse(value)
              : clone(value),
          error: null
        };
      } catch (error) {
        return {
          ok: false,
          value: null,
          error:
            error?.message ||
            String(error)
        };
      }
    }

    function createStorageReader(
      storage = null
    ) {
      function available() {
        return Boolean(
          storage &&
          typeof storage.getItem ===
            "function"
        );
      }

      function has(key) {
        if (!available()) {
          return false;
        }

        try {
          return (
            storage.getItem(key) !== null
          );
        } catch {
          return false;
        }
      }

      function raw(key) {
        if (!available()) {
          return null;
        }

        try {
          return storage.getItem(key);
        } catch {
          return null;
        }
      }

      function json(key) {
        return safeJsonParse(
          raw(key)
        );
      }

      return Object.freeze({
        available,
        has,
        raw,
        json
      });
    }

    function validateAdapter(adapter) {
      const errors = [];

      if (
        !adapter ||
        typeof adapter !== "object"
      ) {
        return {
          valid: false,
          errors: [
            "Migration adapter must be an object."
          ]
        };
      }

      if (!cleanString(adapter.id)) {
        errors.push(
          "Migration adapter id is required."
        );
      }

      if (!cleanString(adapter.label)) {
        errors.push(
          "Migration adapter label is required."
        );
      }

      if (
        typeof adapter.detect !==
        "function"
      ) {
        errors.push(
          "Migration adapter detect() is required."
        );
      }

      if (
        typeof adapter.preview !==
        "function"
      ) {
        errors.push(
          "Migration adapter preview() is required."
        );
      }

      return {
        valid: errors.length === 0,
        errors
      };
    }

    function createRegistry() {
      const adapters = new Map();

      function register(adapter) {
        const validation =
          validateAdapter(adapter);

        if (!validation.valid) {
          throw new Error(
            `Invalid Life Atlas migration adapter: ${validation.errors.join(" ")}`
          );
        }

        const id =
          cleanString(adapter.id);

        if (adapters.has(id)) {
          throw new Error(
            `Migration adapter already registered: ${id}`
          );
        }

        adapters.set(
          id,
          Object.freeze({
            ...adapter,
            id,
            label:
              cleanString(
                adapter.label
              )
          })
        );

        return adapters.get(id);
      }

      function unregister(id) {
        return adapters.delete(
          cleanString(id)
        );
      }

      function get(id) {
        return (
          adapters.get(
            cleanString(id)
          ) || null
        );
      }

      function list() {
        return [
          ...adapters.values()
        ];
      }

      function clear() {
        adapters.clear();
      }

      return Object.freeze({
        register,
        unregister,
        get,
        list,
        clear
      });
    }

    async function detectAdapter(
      adapter,
      context = {}
    ) {
      const detected =
        await adapter.detect(
          context
        );

      return {
        id: adapter.id,
        label: adapter.label,
        detected:
          Boolean(
            detected?.detected ??
            detected
          ),

        count:
          Number.isFinite(
            Number(detected?.count)
          )
            ? Number(
                detected.count
              )
            : null,

        sourceKeys:
          Array.isArray(
            detected?.sourceKeys
          )
            ? [
                ...detected.sourceKeys
              ]
            : [],

        detail:
          clone(
            detected?.detail ||
            null
          )
      };
    }

    async function detectAll(
      registry,
      context = {}
    ) {
      const results = [];

      for (
        const adapter
        of registry.list()
      ) {
        try {
          results.push(
            await detectAdapter(
              adapter,
              context
            )
          );
        } catch (error) {
          results.push({
            id: adapter.id,
            label:
              adapter.label,
            detected: false,
            count: null,
            sourceKeys: [],
            detail: null,
            error:
              error?.message ||
              String(error)
          });
        }
      }

      return results;
    }

    function normalizePreviewRecord(
      input
    ) {
      return Schema.createLifeRecord(
        input
      );
    }

    async function previewAdapter(
      adapter,
      context = {}
    ) {
      const detection =
        await detectAdapter(
          adapter,
          context
        );

      if (!detection.detected) {
        return {
          id: adapter.id,
          label:
            adapter.label,
          detected: false,
          records: [],
          rejected: [],
          warnings: [],
          sourceKeys:
            detection.sourceKeys
        };
      }

      const preview =
        await adapter.preview(
          context
        );

      const rawRecords =
        Array.isArray(
          preview?.records
        )
          ? preview.records
          : [];

      const records = [];
      const rejected = [];

      rawRecords.forEach(
        (record, index) => {
          try {
            records.push(
              normalizePreviewRecord(
                record
              )
            );
          } catch (error) {
            rejected.push({
              index,
              message:
                error?.message ||
                String(error)
            });
          }
        }
      );

      return {
        id: adapter.id,
        label:
          adapter.label,
        detected: true,

        sourceKeys:
          detection.sourceKeys,

        records,
        rejected,

        warnings:
          Array.isArray(
            preview?.warnings
          )
            ? [
                ...preview.warnings
              ]
            : [],

        metadata:
          clone(
            preview?.metadata ||
            {}
          )
      };
    }

    async function importPreview({
      preview,
      repository,
      migrationId = null
    } = {}) {
      if (
        !preview ||
        !Array.isArray(
          preview.records
        )
      ) {
        throw new TypeError(
          "A migration preview is required."
        );
      }

      if (
        !repository ||
        typeof repository.put !==
          "function"
      ) {
        throw new TypeError(
          "A Life Atlas repository is required."
        );
      }

      const imported = [];
      const rejected = [];

      for (
        let index = 0;
        index <
          preview.records.length;
        index += 1
      ) {
        const record =
          preview.records[index];

        try {
          const saved =
            await repository.put(
              record
            );

          imported.push(saved);
        } catch (error) {
          rejected.push({
            index,
            id:
              record?.id ||
              null,
            message:
              error?.message ||
              String(error)
          });
        }
      }

      return {
        migrationId:
          migrationId ||
          `migration:${Date.now()}`,

        adapterId:
          preview.id ||
          null,

        imported,
        rejected,

        sourceKeys:
          Array.isArray(
            preview.sourceKeys
          )
            ? [
                ...preview.sourceKeys
              ]
            : [],

        policy:
          clone(
            MIGRATION_POLICY
          ),

        completedAt:
          new Date()
            .toISOString()
      };
    }

    async function verifyImport({
      receipt,
      repository
    } = {}) {
      if (
        !receipt ||
        !repository
      ) {
        return {
          verified: false,
          checked: 0,
          missing: []
        };
      }

      const missing = [];

      for (
        const record
        of receipt.imported || []
      ) {
        const stored =
          await repository.get(
            record.id
          );

        if (!stored) {
          missing.push(
            record.id
          );
        }
      }

      return {
        verified:
          missing.length === 0,

        checked:
          (
            receipt.imported ||
            []
          ).length,

        missing
      };
    }

    return Object.freeze({
      VERSION,
      MIGRATION_POLICY,

      safeJsonParse,
      createStorageReader,

      validateAdapter,
      createRegistry,

      detectAdapter,
      detectAll,
      previewAdapter,

      importPreview,
      verifyImport
    });
  }
);
