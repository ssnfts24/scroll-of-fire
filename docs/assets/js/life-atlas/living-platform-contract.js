/** Living Platform shared contract — default-deny permission + provenance boundary. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.LivingPlatformContract = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CONTRACT_VERSION = "1.0.0";
  const PLATFORM_VERSION = "0.3.0";
  const PROVENANCE_CLASSES = Object.freeze([
    "source",
    "observation",
    "derived_fact",
    "inference",
    "generated_output",
    "user_confirmation",
    "external_authority"
  ]);
  const INDEPENDENT_EVIDENCE_ELIGIBLE = Object.freeze(new Set([
    "source",
    "external_authority"
  ]));

  function clean(value) {
    return value == null ? "" : String(value).trim();
  }

  function independentEvidenceAllowed(provenanceClass) {
    return INDEPENDENT_EVIDENCE_ELIGIBLE.has(clean(provenanceClass));
  }

  function validatePlatformRecord(record) {
    const errors = [];
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      return { valid: false, errors: ["Platform record must be an object."] };
    }
    const provenance = record.provenance;
    if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) {
      errors.push("Platform record provenance must be an object.");
    } else {
      const provenanceClass = clean(provenance.class);
      if (!PROVENANCE_CLASSES.includes(provenanceClass)) {
        errors.push(`Unknown provenance class: ${provenanceClass || "(empty)"}`);
      }
      if (provenance.independentEvidence === true && !independentEvidenceAllowed(provenanceClass)) {
        errors.push(`${provenanceClass} may not claim independentEvidence=true.`);
      }
    }
    if (!record.lifeRecord || typeof record.lifeRecord !== "object" || Array.isArray(record.lifeRecord)) {
      errors.push("Platform record requires a lifeRecord object.");
    }
    return { valid: errors.length === 0, errors };
  }

  function validateEnvelope(envelope) {
    const errors = [];
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
      return { valid: false, errors: ["Envelope must be an object."] };
    }
    if (envelope.contractVersion !== CONTRACT_VERSION) {
      errors.push(`Unsupported contractVersion: ${envelope.contractVersion}`);
    }
    if (!clean(envelope.sourceModule)) errors.push("sourceModule is required.");
    if (envelope.purpose !== "life-atlas-import") {
      errors.push("Only life-atlas-import envelopes are supported by the current contract.");
    }
    if (!Array.isArray(envelope.records)) {
      errors.push("records must be an array.");
    } else {
      envelope.records.forEach((record, index) => {
        const result = validatePlatformRecord(record);
        result.errors.forEach(error => errors.push(`records[${index}]: ${error}`));
      });
    }
    return { valid: errors.length === 0, errors };
  }

  function requireValidEnvelope(envelope) {
    const result = validateEnvelope(envelope);
    if (!result.valid) {
      const error = new Error(`Invalid Living Platform envelope: ${result.errors.join(" ")}`);
      error.validation = result;
      throw error;
    }
    return envelope;
  }

  return Object.freeze({
    CONTRACT_VERSION,
    PLATFORM_VERSION,
    PROVENANCE_CLASSES,
    INDEPENDENT_EVIDENCE_ELIGIBLE,
    independentEvidenceAllowed,
    validatePlatformRecord,
    validateEnvelope,
    requireValidEnvelope
  });
});
