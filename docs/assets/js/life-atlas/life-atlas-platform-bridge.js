/** Life Atlas ↔ Living Platform permission-scoped handoff bridge. No network access. */
(function (root, factory) {
  let Contract = root.LivingPlatformContract;
  let Schema = root.CodexLifeAtlasSchema;
  if (typeof module === "object" && module.exports) {
    Contract = require("./living-platform-contract.js");
    Schema = require("./life-atlas-schema.js");
    module.exports = factory(Contract, Schema, root);
    return;
  }
  root.CodexLifeAtlasPlatformBridge = factory(Contract, Schema, root);
})(typeof globalThis !== "undefined" ? globalThis : this, function (Contract, Schema, root) {
  "use strict";
  if (!Contract) throw new Error("LivingPlatformContract is required.");
  if (!Schema) throw new Error("CodexLifeAtlasSchema is required.");

  const VERSION = "1.0.0";
  const WRITE_SCOPE = "life_atlas.write";

  function scopeSet(scopes) {
    return new Set((Array.isArray(scopes) ? scopes : []).map(value => String(value || "").trim()).filter(Boolean));
  }

  function stableRecordId(envelope, record, index) {
    const supplied = record.lifeRecord?.id || record.recordId;
    if (supplied) return String(supplied);
    return `living-platform:${envelope.sourceModule}:${envelope.envelopeId || "envelope"}:${index}`;
  }

  function toLifeRecord(envelope, platformRecord, index = 0) {
    Contract.requireValidEnvelope({ ...envelope, records: [platformRecord] });
    const source = platformRecord.lifeRecord || {};
    const provenance = platformRecord.provenance || {};
    const requestedPrivacy = source.privacy || {};
    const payload = source.payload && typeof source.payload === "object" && !Array.isArray(source.payload)
      ? { ...source.payload }
      : {};

    payload.livingPlatform = {
      contractVersion: envelope.contractVersion,
      platformVersion: envelope.platformVersion || null,
      envelopeId: envelope.envelopeId || null,
      sourceModule: envelope.sourceModule,
      provenanceClass: provenance.class,
      independentEvidence: provenance.independentEvidence === true,
      originalVisibility: requestedPrivacy.visibility || null
    };

    return Schema.createLifeRecord({
      ...source,
      id: stableRecordId(envelope, platformRecord, index),
      tags: [
        ...(Array.isArray(source.tags) ? source.tags : []),
        "living-platform",
        `module:${envelope.sourceModule}`,
        `provenance:${provenance.class}`
      ],
      provenance: {
        ...(source.provenance || {}),
        sourceType: `living-platform:${envelope.sourceModule}`,
        sourceId: provenance.sourceId || source.provenance?.sourceId || platformRecord.recordId || null,
        importedAt: new Date().toISOString(),
        confidence: provenance.confidence ?? source.provenance?.confidence ?? null,
        calculationAuthority: source.provenance?.calculationAuthority || envelope.sourceModule
      },
      privacy: {
        visibility: "private",
        containsPersonalData: requestedPrivacy.containsPersonalData !== false,
        shareAllowed: false
      },
      payload
    });
  }

  function previewEnvelope(envelope) {
    Contract.requireValidEnvelope(envelope);
    return envelope.records.map((record, index) => toLifeRecord(envelope, record, index));
  }

  async function resolveRepository(explicitRepository) {
    if (explicitRepository) return explicitRepository;
    const runtime = root.CodexLifeAtlasRuntime;
    if (!runtime?.ready) throw new Error("Life Atlas runtime is not ready.");
    return runtime.ready;
  }

  async function importEnvelope(envelope, options = {}) {
    Contract.requireValidEnvelope(envelope);
    const granted = scopeSet(options.grantedScopes);
    if (!granted.has(WRITE_SCOPE)) {
      throw new Error(`Living Platform import requires explicit ${WRITE_SCOPE} authorization from the receiving surface.`);
    }
    const repository = await resolveRepository(options.repository);
    const records = previewEnvelope(envelope);
    const imported = [];
    for (const record of records) imported.push(await repository.put(record));
    root.dispatchEvent?.(new CustomEvent("sof:living-platform-imported", {
      detail: {
        envelopeId: envelope.envelopeId || null,
        sourceModule: envelope.sourceModule,
        imported: imported.length
      }
    }));
    return { imported, count: imported.length };
  }

  return Object.freeze({ VERSION, WRITE_SCOPE, toLifeRecord, previewEnvelope, importEnvelope });
});
