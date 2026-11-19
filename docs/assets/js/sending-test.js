/**
 * The Sending Test — the first face of the Codex Sealed Protocol.
 *
 * People talk about telepathy (mind to mind) and foresight (knowing
 * before). This instrument does not ask anyone to believe or disbelieve.
 * It runs the test the honest way, on the shared sealed protocol
 * (sealed-protocol.js): commit → try → reveal → score.
 *
 *   - The whole target list is drawn and sealed (SHA-256 fingerprint
 *     shown) before the first guess.
 *   - Receiver mode: a sender is shown each target on a pass-the-phone
 *     screen, hides it, and the receiver picks from four symbols.
 *   - Foresight mode: the visitor picks first; the target they are
 *     guessing at was already drawn and sealed before they started.
 *   - Scoring is the protocol's exact binomial verdict against the
 *     one-in-four chance line. Nothing is claimed beyond it.
 *
 * Sessions are stored by the page on the visitor's own device only.
 * Nothing is uploaded anywhere.
 */
(function (root, factory) {
  let protocol = root.CodexSealedProtocol;

  if (typeof module === "object" && module.exports) {
    protocol = require("./sealed-protocol.js");
    module.exports = factory(protocol);
    return;
  }

  root.CodexSendingTest = factory(protocol);
})(typeof globalThis !== "undefined" ? globalThis : this, function (Protocol) {
  "use strict";

  if (!Protocol) {
    throw new Error("CodexSealedProtocol is required (load sealed-protocol.js first).");
  }

  const FORMAT = "codex-sending-test-backup";
  const VERSION = "1.0.0";
  const PROTOCOL_TAG = "sof-sending-test/v1";
  const CHOICES = 4;

  const SYMBOLS = [
    { id: "circle", name: "Circle", glyph: "●" },
    { id: "triangle", name: "Triangle", glyph: "▲" },
    { id: "waves", name: "Waves", glyph: "≋" },
    { id: "star", name: "Star", glyph: "★" }
  ];

  const MODES = [
    { id: "receiver", name: "Receiver", claim: "telepathy — mind to mind" },
    { id: "foresight", name: "Foresight", claim: "precognition — knowing before" }
  ];

  const TRIAL_CHOICES = [20, 40];

  /* ---------------------------------------------------------- the seal */

  function commitmentPayload(record) {
    const sequence = Array.isArray(record.sequence) ? record.sequence : [];
    return Protocol.buildPayload(PROTOCOL_TAG, [
      ["mode", record.mode],
      ["trials", record.trials],
      ["seed", record.seed >>> 0],
      ["targets", sequence.join(",")]
    ]);
  }

  async function commitmentFor(record) {
    return Protocol.sha256Hex(commitmentPayload(record));
  }

  async function verifyCommitment(record) {
    if (!record || typeof record.commitment !== "string") return false;
    return (await commitmentFor(record)) === record.commitment;
  }

  /* ---------------------------------------------------------- scoring */

  function scoreSession(hits, trials) {
    return Protocol.scoreResult({ hits, trials, choices: CHOICES });
  }

  /* ---------------------------------------------------------- session flow */

  function isValidMode(mode) {
    return MODES.some(m => m.id === mode);
  }

  function createSession({ mode, trials, seed, startedAt } = {}) {
    if (!isValidMode(mode)) throw new Error(`unknown mode: ${mode}`);
    if (!TRIAL_CHOICES.includes(trials)) {
      throw new Error(`trials must be one of ${TRIAL_CHOICES.join(" or ")}.`);
    }
    const actualSeed = seed === undefined ? Protocol.newSeed() : seed >>> 0;
    return {
      format: "codex-sending-test-session",
      version: VERSION,
      mode,
      trials,
      seed: actualSeed,
      sequence: Protocol.generateSequence(actualSeed, trials, CHOICES),
      guesses: [],
      commitment: null, // filled by sealSession before the first guess
      startedAt: startedAt || null,
      finishedAt: null
    };
  }

  async function sealSession(session) {
    session.commitment = await commitmentFor(session);
    return session.commitment;
  }

  function currentTrial(session) {
    return session.guesses.length + 1;
  }

  function isFinished(session) {
    return session.guesses.length >= session.trials;
  }

  function currentTarget(session) {
    if (isFinished(session)) return null;
    return session.sequence[session.guesses.length];
  }

  function recordGuess(session, guess) {
    if (isFinished(session)) throw new Error("this session is already finished.");
    if (!Number.isInteger(guess) || guess < 0 || guess >= CHOICES) {
      throw new Error("a guess must be one of the four symbols.");
    }
    const target = currentTarget(session);
    session.guesses.push(guess);
    return {
      trial: session.guesses.length,
      target,
      guess,
      hit: guess === target,
      done: isFinished(session)
    };
  }

  function countHits(session) {
    return session.guesses.reduce(
      (total, guess, i) => total + (guess === session.sequence[i] ? 1 : 0),
      0
    );
  }

  // The storable, revealable record: after the session this is what is
  // kept, exported, and re-checked against the seal.
  function finishSession(session, finishedAt) {
    if (!isFinished(session)) throw new Error("the session still has trials to run.");
    if (!session.commitment) throw new Error("the session was never sealed.");
    return {
      format: "codex-sending-test-session",
      version: VERSION,
      mode: session.mode,
      trials: session.trials,
      seed: session.seed,
      sequence: [...session.sequence],
      guesses: [...session.guesses],
      hits: countHits(session),
      commitment: session.commitment,
      startedAt: session.startedAt,
      finishedAt: finishedAt || null
    };
  }

  /* ---------------------------------------------------------- backup door */

  function buildBackup(sessions, { exportedAt } = {}) {
    if (!Array.isArray(sessions)) throw new Error("sessions must be an array.");
    return Protocol.buildEnvelope({
      format: FORMAT,
      version: VERSION,
      exportedAt,
      count: sessions.length,
      extra: { sessions: sessions.map(s => ({ ...s })) }
    });
  }

  return {
    FORMAT,
    VERSION,
    PROTOCOL_TAG,
    CHOICES,
    SYMBOLS,
    MODES,
    TRIAL_CHOICES,
    commitmentPayload,
    commitmentFor,
    verifyCommitment,
    scoreSession,
    isValidMode,
    createSession,
    sealSession,
    currentTrial,
    isFinished,
    currentTarget,
    recordGuess,
    countHits,
    finishSession,
    buildBackup,
    // re-exported protocol pieces the page and tests use directly
    generateSequence: (seed, trials) => Protocol.generateSequence(seed, trials, CHOICES),
    binomialTail: Protocol.binomialTail,
    luckCeiling: trials => Protocol.luckCeiling(trials, 1 / CHOICES),
    frequencyText: Protocol.frequencyText,
    sha256Hex: Protocol.sha256Hex
  };
});
