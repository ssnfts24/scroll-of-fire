const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Protocol = require('../docs/assets/js/sealed-protocol.js');
const Sending = require('../docs/assets/js/sending-test.js');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const near = (actual, expected, eps = 1e-4) =>
  assert.ok(Math.abs(actual - expected) <= eps, `${actual} !~= ${expected}`);

/* ---------------------------------------------------------- protocol: drawing */

test('protocol: the same seed always draws the same sequence', () => {
  const a = Protocol.generateSequence(123456789, 40, 4);
  const b = Protocol.generateSequence(123456789, 40, 4);
  assert.deepEqual(a, b);
  assert.equal(a.length, 40);
  assert.ok(a.every(v => Number.isInteger(v) && v >= 0 && v < 4));
  const other = Protocol.generateSequence(987654321, 40, 4);
  assert.notDeepEqual(a, other);
});

test('protocol: drawing honours the choice count (the bench is not four-only)', () => {
  const seq = Protocol.generateSequence(42, 30, 2);
  assert.ok(seq.every(v => v === 0 || v === 1));
  assert.throws(() => Protocol.generateSequence(1, 0, 4), /length/);
  assert.throws(() => Protocol.generateSequence(1, 5, 1), /choices/);
});

/* ---------------------------------------------------------- protocol: the seal */

test('protocol: sha256Hex matches the published SHA-256 test vector', async () => {
  assert.equal(
    await Protocol.sha256Hex('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  );
});

test('protocol: buildPayload is canonical — order and values are the seal', () => {
  const payload = Protocol.buildPayload('sof-test/v1', [['mode', 'receiver'], ['trials', 20]]);
  assert.equal(payload, 'sof-test/v1|mode=receiver|trials=20');
});

/* ---------------------------------------------------------- protocol: statistics */

test('protocol: binomial probabilities are exact at one-in-four', () => {
  let total = 0;
  for (let k = 0; k <= 20; k += 1) total += Protocol.binomialPmf(20, k, 0.25);
  near(total, 1, 1e-9);
  near(Protocol.binomialTail(20, 0, 0.25), 1);
  near(Protocol.binomialTail(20, 8, 0.25), 0.1018); // luck reaches 8+ about 1 time in 10
  near(Protocol.binomialTail(20, 9, 0.25), 0.0409); // 9+ about 1 time in 25
  near(Protocol.binomialTail(40, 16, 0.25), 0.0262);
  near(Protocol.binomialTail(40, 14, 0.25), 0.1032);
});

test('protocol: the luck ceiling is the first count luck reaches less than 1 time in 20', () => {
  assert.equal(Protocol.luckCeiling(20, 0.25), 9);
  assert.equal(Protocol.luckCeiling(40, 0.25), 16);
  assert.ok(Protocol.binomialTail(20, 8, 0.25) > 0.05);
  assert.ok(Protocol.binomialTail(20, 9, 0.25) <= 0.05);
});

test('protocol: scoreResult is generic over the number of choices', () => {
  const coin = Protocol.scoreResult({ hits: 15, trials: 20, choices: 2 });
  assert.equal(coin.expected, 10);
  assert.equal(coin.band, 'outside'); // P(X>=15 | 20, 0.5) ~= 0.0207
  near(coin.pValue, 0.0207);
  assert.match(coin.lines[1], /one of two/);
});

test('protocol: buildEnvelope carries format, version, and count', () => {
  const env = Protocol.buildEnvelope({
    format: 'x-backup', version: '1.0.0', exportedAt: '2026-11-18T00:00:00.000Z',
    count: 2, extra: { records: [1, 2] }
  });
  assert.equal(env.format, 'x-backup');
  assert.equal(env.schemaVersion, '1.0.0');
  assert.equal(env.recordCount, 2);
  assert.deepEqual(env.records, [1, 2]);
});

/* ---------------------------------------------------------- sending: the seal */

test('sending: a sealed session verifies; any tampering breaks the seal', async () => {
  const session = Sending.createSession({ mode: 'receiver', trials: 20, seed: 20261118 });
  const commitment = await Sending.sealSession(session);
  assert.match(commitment, /^[0-9a-f]{64}$/);

  while (!Sending.isFinished(session)) Sending.recordGuess(session, 0);
  const record = Sending.finishSession(session, '2026-11-18T17:00:00.000Z');
  assert.equal(await Sending.verifyCommitment(record), true);

  const flipTarget = { ...record, sequence: [...record.sequence] };
  flipTarget.sequence[5] = (flipTarget.sequence[5] + 1) % 4;
  assert.equal(await Sending.verifyCommitment(flipTarget), false, 'one changed target must fail');

  const otherSeed = { ...record, seed: record.seed + 1 };
  assert.equal(await Sending.verifyCommitment(otherSeed), false, 'a changed seed must fail');

  const otherTrials = { ...record, trials: 40 };
  assert.equal(await Sending.verifyCommitment(otherTrials), false, 'a changed trial count must fail');

  const otherMode = { ...record, mode: 'foresight' };
  assert.equal(await Sending.verifyCommitment(otherMode), false, 'a changed mode must fail');

  const unsealed = { ...record, commitment: null };
  assert.equal(await Sending.verifyCommitment(unsealed), false, 'a missing seal must fail');
});

test('sending: the commitment is fixed before the first guess is recorded', async () => {
  const session = Sending.createSession({ mode: 'foresight', trials: 20, seed: 777 });
  const before = await Sending.sealSession(session);
  Sending.recordGuess(session, 2);
  Sending.recordGuess(session, 1);
  assert.equal(session.commitment, before);
  assert.equal(await Sending.commitmentFor(session), before);
});

/* ---------------------------------------------------------- sending: session flow */

test('sending: session setup refuses unknown modes and unlisted lengths', () => {
  assert.throws(() => Sending.createSession({ mode: 'dream', trials: 20 }), /unknown mode/);
  assert.throws(() => Sending.createSession({ mode: 'receiver', trials: 25 }), /trials/);
  assert.deepEqual(Sending.TRIAL_CHOICES, [20, 40]);
});

test('sending: perfect play scores every hit; always-wrong play scores zero', async () => {
  const perfect = Sending.createSession({ mode: 'receiver', trials: 40, seed: 4242 });
  await Sending.sealSession(perfect);
  while (!Sending.isFinished(perfect)) {
    const result = Sending.recordGuess(perfect, Sending.currentTarget(perfect));
    assert.equal(result.hit, true);
  }
  assert.equal(Sending.finishSession(perfect, '2026-11-18T17:00:00.000Z').hits, 40);

  const wrong = Sending.createSession({ mode: 'foresight', trials: 20, seed: 4242 });
  await Sending.sealSession(wrong);
  while (!Sending.isFinished(wrong)) {
    Sending.recordGuess(wrong, (Sending.currentTarget(wrong) + 1) % 4);
  }
  assert.equal(Sending.finishSession(wrong, '2026-11-18T17:00:00.000Z').hits, 0);
});

test('sending: the flow cannot overrun, finish early, or finish unsealed', async () => {
  const session = Sending.createSession({ mode: 'foresight', trials: 20, seed: 9 });
  await Sending.sealSession(session);
  assert.throws(() => Sending.finishSession(session), /still has trials/);
  while (!Sending.isFinished(session)) Sending.recordGuess(session, 0);
  assert.throws(() => Sending.recordGuess(session, 0), /already finished/);
  assert.throws(() => Sending.recordGuess(session, 7), /already finished/);

  const unsealed = Sending.createSession({ mode: 'foresight', trials: 20, seed: 9 });
  while (!Sending.isFinished(unsealed)) Sending.recordGuess(unsealed, 0);
  assert.throws(() => Sending.finishSession(unsealed), /never sealed/);
});

/* ---------------------------------------------------------- sending: the verdict wording */

test('sending: a luck-range score is reported inside what luck explains — with the not-proof line', () => {
  const score = Sending.scoreSession(14, 40);
  assert.equal(score.band, 'inside');
  assert.equal(score.expected, 10);
  assert.equal(score.ceiling, 16);
  assert.equal(score.lines[0], '14 hits in 40 tries.');
  assert.match(score.lines[1], /would average 10 hits/);
  assert.match(score.lines[2], /inside what luck explains/);
  assert.match(score.lines[3], /is not proof/);
  assert.match(score.lines[3], /repeating across many sessions/);
});

test('sending: a score past the luck line is reported outside — and still not proof', () => {
  const score = Sending.scoreSession(17, 40);
  assert.equal(score.band, 'outside');
  assert.match(score.lines[2], /outside what luck usually explains/);
  assert.match(score.lines[2], /less than 1 time in 20/);
  assert.match(score.lines[3], /is not proof/);

  assert.equal(Sending.scoreSession(8, 20).band, 'inside');
  assert.equal(Sending.scoreSession(9, 20).band, 'outside');
  assert.equal(Sending.scoreSession(0, 20).pValue, 1);
});

test('sending: the verdict never upgrades the claim in either direction', () => {
  for (const [hits, trials] of [[0, 20], [5, 20], [14, 40], [17, 40], [40, 40]]) {
    const { lines } = Sending.scoreSession(hits, trials);
    const text = lines.join(' ');
    assert.doesNotMatch(text, /proves|proven|disproves|impossible|psychic ability confirmed/i);
    assert.match(text, /is not proof/);
  }
});

/* ---------------------------------------------------------- sending: the backup door */

test('sending: the backup envelope holds sessions whole and they still verify', async () => {
  const session = Sending.createSession({ mode: 'receiver', trials: 20, seed: 31337 });
  await Sending.sealSession(session);
  while (!Sending.isFinished(session)) Sending.recordGuess(session, 3);
  const record = Sending.finishSession(session, '2026-11-18T17:00:00.000Z');

  const backup = Sending.buildBackup([record], { exportedAt: '2026-11-18T18:00:00.000Z' });
  assert.equal(backup.format, 'codex-sending-test-backup');
  assert.equal(backup.format, Sending.FORMAT);
  assert.equal(backup.schemaVersion, '1.0.0');
  assert.equal(backup.recordCount, 1);
  assert.equal(backup.sessions.length, 1);
  assert.equal(await Sending.verifyCommitment(backup.sessions[0]), true);
});

/* ---------------------------------------------------------- the page and the site */

test('page: the instrument loads the protocol before the face before the wiring', () => {
  const html = read('docs/sending-test.html');
  const protocolAt = html.indexOf('assets/js/sealed-protocol.js');
  const faceAt = html.indexOf('assets/js/sending-test.js');
  const uiAt = html.indexOf('assets/js/sending-test-ui.js');
  assert.ok(protocolAt > -1 && faceAt > protocolAt && uiAt > faceAt);
});

test('page: the protocol is stated before the run — sealed, fixed count, one in four', () => {
  const html = read('docs/sending-test.html');
  assert.match(html, /targets are sealed/i);
  assert.match(html, /one in four/i);
  assert.match(html, /Nothing is uploaded anywhere/);
  assert.match(html, /already drawn and sealed before you started/i);
  assert.match(html, /pass-the-phone|hand the phone to the receiver/i);
  assert.match(html, /Ganzfeld/);
  assert.match(html, /What would count as evidence/);
});

test('page: the Lab links to the instrument and the sitemap lists it', () => {
  assert.match(read('docs/lab.html'), /href="\.\/sending-test\.html"/);
  assert.match(read('docs/sitemap.xml'), /https:\/\/codexofreality\.org\/sending-test\.html/);
  const html = read('docs/sending-test.html');
  assert.match(html, /<link rel="canonical" href="https:\/\/codexofreality\.org\/sending-test\.html">/);
});

test('page: the growth record carries the instrument, dated 2026-11-18', () => {
  const updates = JSON.parse(read('docs/assets/data/codex-updates.json'));
  const entry = updates.find(u => u.url === './sending-test.html');
  assert.ok(entry, 'growth record entry exists');
  assert.equal(entry.date, '2026-11-18');
});
