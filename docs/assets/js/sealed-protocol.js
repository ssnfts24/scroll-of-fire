/**
 * Codex Sealed Protocol — the shared commit → try → reveal → score core.
 *
 * Every instrument on the bench (the Sending Test first) runs the same
 * honest shape:
 *
 *   COMMIT  Before the first try, the whole list of targets is drawn from
 *           a secret seed, and a SHA-256 fingerprint of that list — the
 *           commitment — is shown. The list is sealed from that moment.
 *   TRY     The visitor makes their picks against the sealed list. The
 *           list cannot change mid-session, and the seal proves it.
 *   REVEAL  After the last try, the seed and the full list are revealed,
 *           and anyone can re-hash them and check the fingerprint.
 *   SCORE   The result is scored with exact binomial math against the
 *           chance line, and the verdict wording says only what the math
 *           supports — including that one session is never proof.
 *
 * This module is machinery only: seeded drawing, the seal, the statistics,
 * and the shared backup envelope. It makes no claim about any ability.
 * Each instrument (a "face" of the protocol) supplies its own symbols,
 * modes, and session flow, and consumes this core.
 *
 * No network calls. Records built here live on the visitor's device.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
    return;
  }
  root.CodexSealedProtocol = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ALPHA = 0.05; // the "less than 1 time in 20" line

  const NUMBER_WORDS = {
    2: "two", 3: "three", 4: "four", 5: "five",
    6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten"
  };

  /* ---------------------------------------------------------- randomness
     A small seeded generator (mulberry32). The seed is the secret during
     the session and the proof afterward: the same seed always draws the
     same list, so a revealed seed can be checked against the seal. */

  function createRng(seed) {
    let a = seed >>> 0;
    return function next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function newSeed() {
    const cryptoObj = globalThis.crypto;
    if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
      const buf = new Uint32Array(1);
      cryptoObj.getRandomValues(buf);
      return buf[0];
    }
    return Math.floor(Math.random() * 0x100000000);
  }

  function generateSequence(seed, length, choices = 4) {
    if (!Number.isInteger(length) || length < 1) {
      throw new Error("length must be a positive whole number.");
    }
    if (!Number.isInteger(choices) || choices < 2) {
      throw new Error("choices must be a whole number of at least 2.");
    }
    const rng = createRng(seed);
    const sequence = [];
    for (let i = 0; i < length; i += 1) {
      sequence.push(Math.floor(rng() * choices));
    }
    return sequence;
  }

  /* ---------------------------------------------------------- the seal
     The commitment is a SHA-256 hash of one canonical line of text: a
     protocol tag plus key=value parts, in a fixed order. Change any part
     — even a single target — and the fingerprint no longer matches. */

  function buildPayload(protocolTag, entries) {
    const parts = entries.map(([key, value]) => `${key}=${value}`);
    return [protocolTag, ...parts].join("|");
  }

  async function sha256Hex(text) {
    const subtle = globalThis.crypto && globalThis.crypto.subtle;
    if (!subtle || typeof subtle.digest !== "function") {
      throw new Error("SHA-256 is not available here, so the seal cannot be made or checked.");
    }
    const bytes = new TextEncoder().encode(text);
    const digest = await subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /* ---------------------------------------------------------- statistics
     Exact binomial math. No approximations, no upgrades: the numbers
     below are the whole verdict. */

  function binomialPmf(n, k, p) {
    if (!Number.isInteger(n) || n < 0) throw new Error("n must be a non-negative whole number.");
    if (typeof p !== "number" || p <= 0 || p >= 1) throw new Error("p must be between 0 and 1.");
    if (k < 0 || k > n) return 0;
    let pmf = Math.pow(1 - p, n);
    for (let i = 0; i < k; i += 1) {
      pmf *= ((n - i) / (i + 1)) * (p / (1 - p));
    }
    return pmf;
  }

  // Probability that luck alone scores k hits or more in n tries.
  function binomialTail(n, k, p) {
    if (k <= 0) return 1;
    if (k > n) return 0;
    let sum = 0;
    for (let i = k; i <= n; i += 1) sum += binomialPmf(n, i, p);
    return Math.min(1, sum);
  }

  // The smallest hit count that luck alone reaches less than 1 time in
  // 20. Scores below this line are inside what luck explains; scores at
  // or above it are outside what luck usually explains.
  function luckCeiling(n, p, alpha = ALPHA) {
    for (let k = 0; k <= n; k += 1) {
      if (binomialTail(n, k, p) <= alpha) return k;
    }
    return n + 1;
  }

  function formatCount(value) {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  }

  // How often luck alone does at least this well, in plain words.
  function frequencyText(p) {
    if (p >= 0.995) return "nearly every time";
    if (p >= 0.01) return `about ${Math.round(p * 100)} times in 100`;
    if (p >= 0.001) return `about ${Math.round(p * 1000)} times in 1,000`;
    return "less than 1 time in 1,000";
  }

  /**
   * Score a finished run of tries.
   *   hits    — exact matches
   *   trials  — total tries, fixed before the session started
   *   choices — how many options each try offered (chance = 1/choices)
   * Returns the numbers and the verdict lines. The wording never claims
   * more than the math supports, in either direction.
   */
  function scoreResult({ hits, trials, choices = 4 } = {}) {
    if (!Number.isInteger(trials) || trials < 1) {
      throw new Error("trials must be a positive whole number.");
    }
    if (!Number.isInteger(choices) || choices < 2) {
      throw new Error("choices must be a whole number of at least 2.");
    }
    if (!Number.isInteger(hits) || hits < 0 || hits > trials) {
      throw new Error("hits must be a whole number between 0 and the trial count.");
    }
    const chance = 1 / choices;
    const expected = trials * chance;
    const ceiling = luckCeiling(trials, chance);
    const pValue = binomialTail(trials, hits, chance);
    const band = hits >= ceiling ? "outside" : "inside";
    const choiceWord = NUMBER_WORDS[choices] || String(choices);

    const lines = [
      `${hits} hits in ${trials} tries.`,
      `Chance alone — picking one of ${choiceWord} at random — would average ${formatCount(expected)} hits.`
    ];
    if (band === "inside") {
      lines.push(
        `Luck alone reaches a score this high or higher ${frequencyText(pValue)}. ` +
        `A score would have to reach ${ceiling} hits before luck alone would explain it ` +
        `less than 1 time in 20. This score sits inside what luck explains.`
      );
    } else {
      lines.push(
        `Luck alone reaches a score this high or higher ${frequencyText(pValue)} — ` +
        `less than 1 time in 20. This score sits outside what luck usually explains.`
      );
    }
    lines.push(
      "One session, either way, is not proof. Proof would take a result outside " +
      "the luck line repeating across many sessions, with the targets sealed every time."
    );

    return { hits, trials, choices, chance, expected, ceiling, pValue, band, lines };
  }

  /* ---------------------------------------------------------- backup door
     The same envelope shape as the Life Atlas backup: one JSON object,
     labelled with its format and version, holding the records whole. */

  function buildEnvelope({ format, version, exportedAt, count, extra } = {}) {
    if (!format) throw new Error("a backup envelope needs a format name.");
    return {
      format,
      schemaVersion: version,
      exportedAt: exportedAt || null,
      recordCount: count,
      ...(extra || {})
    };
  }

  return {
    ALPHA,
    createRng,
    newSeed,
    generateSequence,
    buildPayload,
    sha256Hex,
    binomialPmf,
    binomialTail,
    luckCeiling,
    frequencyText,
    formatCount,
    scoreResult,
    buildEnvelope
  };
});
