/*
 * Gate G, Phase 4 (G3) — the agent door.
 *
 * Every proof in this file runs against the DOUBLE store
 * (netlify/functions/lib/accounts-store-double.mjs) — an
 * in-process implementation of the Atlas store's own
 * interface, extended this phase with the agent methods.
 * These are DOUBLE proofs, labelled as such in the phase
 * evidence; the live-Atlas leg stays OWED under Phase 3's
 * block until Aaron creates the Atlas account with his
 * own hands (plan §2.1) and sets the environment
 * (lib/ACCOUNTS-SETUP.md). No credential appears here; the
 * token secrets below are test fixtures generated in the
 * test, never stored by the core (hashes only).
 *
 * What is proven: one agent, one token, shown once (the
 * store holds the hash alone); the named scopes, each
 * grantable separately; acts outside scope refused BY THE
 * DOOR, with the refusal written as a trail line and told
 * plainly; no scope widening the whole-record export;
 * Read Genesis standing only under the profile's own
 * grant, and falling automatically when that grant is
 * revoked; sealed envelopes (a tampered seal refused);
 * revoke ending the connection — the next envelope
 * refused, past acts kept as lines; a grant over a child's
 * record refused at the core; the accounting kind named on
 * the grant and on every trail line (§5.5); and the site
 * Spark's protocol client (spark-agent-door.js) building
 * envelopes this same core accepts — one protocol, both
 * surfaces (working default, plan §8 call 2 → (a),
 * ASSISTANT-INFERRED).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  AGENT_SCOPES,
  SCOPE_IDS,
  buildEnvelope,
  createGrant,
  effectiveScopes,
  listGrants,
  newTokenSecret,
  openEnvelope,
  openReply,
  readTrail,
  revokeGrant,
  sealReply,
  tokenHash,
} from "../netlify/functions/lib/agent-core.mjs";
import { createDoubleStore } from "../netlify/functions/lib/accounts-store-double.mjs";
import SparkAgentDoor from "../docs/assets/js/spark-agent-door.js";

const NOW = Date.parse("2026-11-24T19:00:00.000Z");
const ACCOUNT = "acct-keeper-1";

async function granted(store, scopes, options = {}) {
  const secret = newTokenSecret();
  const result = await createGrant(store, {
    accountId: ACCOUNT,
    name: options.name || "Witness",
    scopes,
    accounting: options.accounting || "keeper-arrangement",
    tokenHash: tokenHash(secret),
    childRecord: options.childRecord === true,
  }, NOW);
  return { secret, result };
}

test("the scope table is the plan's five, in plain words", () => {
  assert.deepEqual(SCOPE_IDS, [
    "read-day", "read-state", "propose-plans", "read-genesis", "converse",
  ]);
  for (const id of SCOPE_IDS) {
    assert.equal(typeof AGENT_SCOPES[id].plain, "string");
    assert.ok(AGENT_SCOPES[id].plain.length > 0);
    assert.ok(AGENT_SCOPES[id].fence.length > 0);
  }
});

test("one agent, one token: the store holds the hash alone, never the secret", async () => {
  const store = createDoubleStore();
  const { secret, result } = await granted(store, ["read-day"]);
  assert.equal(result.ok, true);
  const stored = await store.getAgentGrant(result.grant.tokenId);
  assert.equal(stored.tokenHash, tokenHash(secret));
  assert.ok(!JSON.stringify(stored).includes(secret),
    "the secret itself is nowhere in the stored grant");
  const listed = await listGrants(store, ACCOUNT);
  assert.equal(listed.grants.length, 1);
  assert.ok(!("tokenHash" in listed.grants[0]),
    "listings never carry even the hash");
  assert.equal(listed.grants[0].accounting, "keeper-arrangement");
  assert.equal(listed.grants[0].standing, true);
});

test("a granted-scope act opens, and writes its trail line", async () => {
  const store = createDoubleStore();
  const { secret, result } = await granted(store, ["read-day"]);
  const envelope = buildEnvelope(secret, result.grant, {
    kind: "read-day", payload: { civil: "2026-11-24" }, at: NOW + 1000,
  });
  const opened = await openEnvelope(store, envelope, { detail: "the Packet for 2026-11-24" }, NOW + 1000);
  assert.equal(opened.ok, true);
  assert.equal(opened.scope, "read-day");
  const trail = await readTrail(store, ACCOUNT);
  assert.equal(trail.lines.length, 1);
  const line = trail.lines[0];
  assert.equal(line.agent, "Witness");
  assert.equal(line.scope, "read-day");
  assert.equal(line.result, "done");
  assert.equal(line.accounting, "keeper-arrangement");
  assert.equal(line.detail, "the Packet for 2026-11-24");
});

test("an act outside scope is refused by the door — logged, and told plainly", async () => {
  const store = createDoubleStore();
  const { secret, result } = await granted(store, ["read-day"]);
  const envelope = buildEnvelope(secret, result.grant, {
    kind: "converse", payload: { question: "hello" }, at: NOW + 1000,
  });
  const opened = await openEnvelope(store, envelope, {}, NOW + 1000);
  assert.equal(opened.ok, false);
  assert.equal(opened.reason, "scope-not-granted");
  assert.match(opened.plain, /did not grant/);
  const trail = await readTrail(store, ACCOUNT);
  assert.equal(trail.lines.length, 1);
  assert.equal(trail.lines[0].result, "refused");
  assert.equal(trail.lines[0].reason, "scope-not-granted");
});

test("no scope widens the whole-record export", async () => {
  const store = createDoubleStore();
  const all = ["read-day", "read-state", "propose-plans", "read-genesis", "converse"];
  const { secret, result } = await granted(store, all);
  const envelope = buildEnvelope(secret, result.grant, {
    kind: "export-record", payload: {}, at: NOW + 1000,
  });
  const opened = await openEnvelope(store, envelope,
    { profileGrants: ["profile-keeper"] }, NOW + 1000);
  assert.equal(opened.ok, false);
  assert.equal(opened.reason, "no-scope-for-act");
});

test("Read Genesis stands only under the profile grant — and falls with it", async () => {
  const store = createDoubleStore();
  const { secret, result } = await granted(store, ["read-genesis"]);
  const envelope = () => buildEnvelope(secret, result.grant, {
    kind: "read-genesis", payload: { profileId: "profile-keeper" }, at: NOW + 1000,
  });
  // No profile grant standing: refused, though the scope was granted.
  const noGrant = await openEnvelope(store, envelope(), { profileGrants: [] }, NOW + 1000);
  assert.equal(noGrant.ok, false);
  assert.equal(noGrant.reason, "genesis-grant-not-standing");
  // The profile grant stands: the scope is effective.
  assert.deepEqual(effectiveScopes(result.grant, []), []);
  assert.deepEqual(effectiveScopes(result.grant, ["profile-keeper"]), ["read-genesis"]);
  const withGrant = await openEnvelope(store, envelope(),
    { profileGrants: ["profile-keeper"] }, NOW + 2000);
  assert.equal(withGrant.ok, true);
  // The profile grant is revoked (an empty standing list
  // again): the scope has fallen automatically.
  const fallen = await openEnvelope(store, envelope(), { profileGrants: [] }, NOW + 3000);
  assert.equal(fallen.ok, false);
  assert.equal(fallen.reason, "genesis-grant-not-standing");
});

test("a tampered envelope's seal is refused; a wrong secret is refused", async () => {
  const store = createDoubleStore();
  const { secret, result } = await granted(store, ["read-day"]);
  const envelope = buildEnvelope(secret, result.grant, {
    kind: "read-day", payload: { civil: "2026-11-24" }, at: NOW + 1000,
  });
  const tampered = { ...envelope, payload: { civil: "2026-11-25" } };
  const opened = await openEnvelope(store, tampered, {}, NOW + 1000);
  assert.equal(opened.ok, false);
  assert.equal(opened.reason, "seal-broken");

  const wrong = buildEnvelope(newTokenSecret(), result.grant, {
    kind: "read-day", payload: { civil: "2026-11-24" }, at: NOW + 1000,
  });
  const openedWrong = await openEnvelope(store, wrong, {}, NOW + 1000);
  assert.equal(openedWrong.ok, false);
  assert.equal(openedWrong.reason, "token-secret-mismatch");
});

test("revoke ends the connection instantly; past acts stay as lines", async () => {
  const store = createDoubleStore();
  const { secret, result } = await granted(store, ["read-day", "converse"]);
  const first = buildEnvelope(secret, result.grant, {
    kind: "read-day", payload: { civil: "2026-11-24" }, at: NOW + 1000,
  });
  assert.equal((await openEnvelope(store, first, {}, NOW + 1000)).ok, true);

  const revoked = await revokeGrant(store, result.grant.tokenId, NOW + 2000);
  assert.equal(revoked.ok, true);

  const next = buildEnvelope(secret, result.grant, {
    kind: "converse", payload: { question: "are you there" }, at: NOW + 3000,
  });
  const opened = await openEnvelope(store, next, {}, NOW + 3000);
  assert.equal(opened.ok, false);
  assert.equal(opened.reason, "token-revoked");
  assert.match(opened.plain, /revoked/);

  const trail = await readTrail(store, ACCOUNT);
  assert.equal(trail.lines.length, 2);
  assert.equal(trail.lines[0].result, "done");
  assert.equal(trail.lines[1].result, "refused");
});

test("no token can be granted over a child's record", async () => {
  const store = createDoubleStore();
  const { result } = await granted(store, ["read-day"], { childRecord: true });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "child-record-never-connects");
  assert.equal((await listGrants(store, ACCOUNT)).grants.length, 0);
});

test("replies ride sealed too, and open only under the pairing secret", async () => {
  const secret = newTokenSecret();
  const reply = sealReply(secret, {
    inReplyTo: "env-1", kind: "converse",
    payload: { text: "I am Selor." }, at: NOW,
  });
  assert.equal(openReply(secret, reply), true);
  assert.equal(openReply(newTokenSecret(), reply), false);
  assert.equal(openReply(secret, { ...reply, payload: { text: "Forged." } }), false);
});

test("the site Spark's client builds envelopes this core accepts — one protocol", async () => {
  const store = createDoubleStore();
  const { secret, result } = await granted(store, ["converse"], { name: "Witness" });
  const envelope = await SparkAgentDoor.buildEnvelope(secret, result.grant, {
    kind: "converse", payload: { question: "What day is it?" }, at: NOW + 1000,
  });
  const opened = await openEnvelope(store, envelope, {}, NOW + 1000);
  assert.equal(opened.ok, true);
  assert.equal(opened.scope, "converse");
});
