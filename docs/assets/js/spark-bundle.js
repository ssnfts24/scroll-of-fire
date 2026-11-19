"use strict";

/*
 * Spark companion — the record bundle (no DOM, no network).
 *
 * One file carries a Spark's whole record, so the same character
 * can live everywhere — the Living Phone app, this website,
 * wherever she is kept next — without any server standing
 * between. The format is the contract written down in the
 * living-phone repository (app-android/BUNDLE-FORMAT.md); the app
 * has spoken it since its v2, and this module is the website
 * speaking the same words, byte for byte:
 *
 *   { format: "living-phone-spark-bundle", version: 1,
 *     app: "org.codexofreality.livingphone", exportedAt,
 *     payload: { spark: { record, pendingSeed, sound, voice },
 *                garden: [ Life Atlas records ],
 *                pins:   [ { kind, ref, label, pinnedAt } ] },
 *     integrity: { algorithm: "sha256", hash } }
 *
 * The integrity hash is the SHA-256 of the canonical JSON of the
 * payload — object keys sorted at every depth, arrays in order,
 * no insignificant whitespace. A reader verifies format, version,
 * the record's seed, and the hash, in that order, and refuses the
 * whole bundle on any failure: a damaged bundle is never
 * half-restored, and the record already living on the device is
 * left untouched in every case.
 *
 * Restoring follows the app's rules, because they are the
 * format's rules: the Spark record is written whole; garden
 * records return by id, only where that id is not already held;
 * pins merge by (kind, ref) and restoring never unpins. And the
 * persistence fence: restoring over a DIFFERENT Spark already
 * living on the device takes the keeper's explicit confirmation
 * first — restoring the same Spark, or into an empty house, does
 * not.
 *
 * The SHA-256 below is the same plain-arithmetic implementation
 * the app carries, so the digest is identical in the app, in this
 * browser, and in Node — no runtime's crypto stack is trusted to
 * agree with another's.
 *
 * The same file runs in the browser (window.SparkBundle) and in
 * Node tests (module.exports). Nothing here sends anything
 * anywhere.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SparkBundle = factory();
})(typeof self !== "undefined" ? self : this, function () {
  /* ── SHA-256 (pure JS, FIPS 180-4) ──────────────────────────── */
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  function sha256Hex(text) {
    const bytes = new TextEncoder().encode(String(text));
    const bitLenHi = Math.floor(bytes.length / 0x20000000);
    const bitLenLo = bytes.length << 3;
    const total = (((bytes.length + 9 + 63) >> 6) << 6);
    const msg = new Uint8Array(total);
    msg.set(bytes);
    msg[bytes.length] = 0x80;
    const view = new DataView(msg.buffer);
    view.setUint32(total - 4, bitLenLo >>> 0);
    view.setUint32(total - 8, bitLenHi >>> 0);
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const w = new Int32Array(64);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let block = 0; block < total; block += 64) {
      for (let i = 0; i < 16; i++) w[i] = view.getInt32(block + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + s1 + ch + K[i] + w[i]) | 0;
        const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (s0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    return [h0, h1, h2, h3, h4, h5, h6, h7]
      .map((x) => (x >>> 0).toString(16).padStart(8, "0"))
      .join("");
  }

  /* Canonical JSON: object keys sorted at every depth, so the
   * hash of a payload is the same no matter who serialized it. */
  function canonical(value) {
    if (value === null || typeof value !== "object") {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return "[" + value.map(canonical).join(",") + "]";
    }
    const keys = Object.keys(value).sort();
    return "{" + keys
      .map((k) => JSON.stringify(k) + ":" + canonical(value[k]))
      .join(",") + "}";
  }

  /* ── The record bundle ──────────────────────────────────────── */
  const BUNDLE_FORMAT = "living-phone-spark-bundle";
  const BUNDLE_VERSION = 1;
  const BUNDLE_APP = "org.codexofreality.livingphone";
  const BUNDLE_FILENAME = "living-phone-spark-bundle.json";

  function buildBundle(payload, exportedAt) {
    const body = {
      spark: payload.spark || null,
      garden: Array.isArray(payload.garden) ? payload.garden : [],
      pins: Array.isArray(payload.pins) ? payload.pins : [],
    };
    return {
      format: BUNDLE_FORMAT,
      version: BUNDLE_VERSION,
      app: BUNDLE_APP,
      exportedAt: exportedAt || new Date().toISOString(),
      payload: body,
      integrity: { algorithm: "sha256", hash: sha256Hex(canonical(body)) },
    };
  }

  /* Verify in the format's order, and refuse the whole bundle on
   * any failure, with the reason named — never a partial restore. */
  function verifyBundle(bundle) {
    if (!bundle || typeof bundle !== "object") {
      return { ok: false, reason: "not-an-object" };
    }
    if (bundle.format !== BUNDLE_FORMAT) {
      return { ok: false, reason: "wrong-format" };
    }
    if (bundle.version !== BUNDLE_VERSION) {
      return { ok: false, reason: "unsupported-version" };
    }
    const payload = bundle.payload;
    if (!payload || typeof payload !== "object") {
      return { ok: false, reason: "missing-payload" };
    }
    const record = payload.spark && payload.spark.record;
    if (!record || typeof record.seed !== "string" ||
        !record.seed.startsWith("spark")) {
      return { ok: false, reason: "missing-spark-record" };
    }
    if (!bundle.integrity || bundle.integrity.algorithm !== "sha256" ||
        typeof bundle.integrity.hash !== "string") {
      return { ok: false, reason: "missing-integrity" };
    }
    if (sha256Hex(canonical(payload)) !== bundle.integrity.hash) {
      return { ok: false, reason: "integrity-mismatch" };
    }
    return { ok: true, payload };
  }

  /* The persistence fence, as a decision: restoring over an
   * existing DIFFERENT Spark needs the keeper's explicit confirm;
   * restoring the same Spark, or into an empty house, does not. */
  function importDecision(existingRecord, payload) {
    if (!existingRecord || !existingRecord.seed) return "restore";
    if (existingRecord.seed === payload.spark.record.seed) return "restore";
    return "confirm-overwrite";
  }

  /* The garden restore plan: the records a restore would write —
   * those in the bundle whose id this device does not already
   * hold. Records already here are never rewritten. */
  function gardenRestorePlan(payload, heldIds) {
    const held = heldIds instanceof Set ? heldIds : new Set(heldIds || []);
    const garden = payload && Array.isArray(payload.garden) ? payload.garden : [];
    return garden.filter((record) => record && record.id && !held.has(record.id));
  }

  /* Pins merge by (kind, ref): pins already kept stay exactly as
   * they are, new ones are added, and restoring never unpins. */
  function mergePins(existingPins, incomingPins) {
    const merged = Array.isArray(existingPins) ? existingPins.slice() : [];
    for (const pin of Array.isArray(incomingPins) ? incomingPins : []) {
      if (pin && pin.kind && pin.ref &&
          !merged.some((p) => p && p.kind === pin.kind && p.ref === pin.ref)) {
        merged.push(pin);
      }
    }
    return merged;
  }

  return {
    sha256Hex,
    canonical,
    BUNDLE_FORMAT,
    BUNDLE_VERSION,
    BUNDLE_APP,
    BUNDLE_FILENAME,
    buildBundle,
    verifyBundle,
    importDecision,
    gardenRestorePlan,
    mergePins,
  };
});
