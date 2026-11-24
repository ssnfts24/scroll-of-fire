/*
 * The agent door — Gate G, Phase 4 (G3;
 * gate-g-live-plan-2026-11-24 §4 entire, §5's protocol).
 *
 * Agents are let in the way Witness is let into GitHub
 * (Aaron's own comparison, Nov 24, 2026): a keeper-granted
 * token, named scopes, every act attributable, revocable
 * at any time. This core is the door's half of that law;
 * the app's half is AgentDoor + AgentSpark in the
 * living-phone repo. The two halves speak ONE protocol —
 * the same grant model, the same scopes, the same sealed
 * envelopes — and, under the working default of plan §8
 * call 2 → (a) (ASSISTANT-INFERRED, pending Aaron's
 * ratification), the SAME protocol backs the site Spark in
 * this phase: one protocol, proven once. The Guide seat
 * and its rulebook are untouched by everything here.
 *
 * TOKENS (§4.1). One agent, one token, one grant. The
 * token's secret is shown ONCE, at granting, to the keeper
 * who carries it to the agent (pairing by a keeper-carried
 * secret, §4.4 — a grant act, never a URL). The door stores
 * only the secret's hash. There is no standing open port
 * and no shared secret among agents.
 *
 * SCOPES (§4.2). Named in plain words, each grantable
 * separately (AGENT_SCOPES). An act outside a token's
 * scopes is REFUSED BY THE DOOR — not by the agent's good
 * behaviour — the refusal is written as a trail line, and
 * the agent is told the refusal in plain terms. No scope
 * widens the whole-record export: the bundle export stays
 * the keeper's own act in the app, and an envelope asking
 * for it is refused like any other act with no scope.
 *
 * GENESIS (§4.2). The Read Genesis scope stands ONLY under
 * the profile's existing per-profile grant: the door
 * builds no second road into Genesis. Effective scopes are
 * computed at act time from the standing profile grants —
 * no profile grant, no scope; and revoking the profile
 * grant revokes this scope automatically, with no act at
 * this door needed or possible.
 *
 * ENVELOPES (§4.4). An agent's acts and the door's replies
 * travel as sealed, attributable envelopes; nothing rides
 * outside an envelope, so nothing rides unlogged. The
 * seal binds the envelope's core to the pairing secret:
 * seal = sha256(secret + "|" + canonical(core)). The
 * secret itself rides only inside the envelope it seals,
 * over HTTPS, the way a personal access token rides its
 * requests; the door keeps its hash alone. PR #86 is a
 * SKETCH — its pairing-and-envelope pattern only is taken;
 * none of its code is revived, and it stays parked.
 *
 * EVERY ACT A LINE (§4.3). Each act under a token —
 * granted-scope acts and refusals alike — writes a trail
 * line naming the agent (its token's keeper-given name),
 * the scope used, what was read or proposed or done, and
 * when. The keeper reads the agent's whole trail in the
 * record (the app keeps the record's own copy; this store
 * holds the door's copy for carrying).
 *
 * REVOKE (§4.1). Revoking a token ends the connection at
 * the door instantly and completely: the next envelope
 * under it is refused. The record keeps past acts as the
 * lines they are. A lost token is revoked, not chased.
 *
 * CHILDREN (§4.5, §9). No token can be granted over a
 * child's record — a grant naming a child record is
 * refused here, at the door's core, below any interface.
 * A child-mode Spark has no agent door at all; that half
 * of the fence stands on the surfaces (the app's
 * AgentDoor refuses before any transport exists).
 *
 * ACCOUNTING (§5.5). A grant names which kind of
 * connection it is: "keeper-arrangement" (the agent rides
 * the keeper's own arrangements — Witness to Aaron's Spark
 * is the first — NOT the public door's $20 ceiling) or
 * "door-seat" (a hosted connection spending against its
 * tier's meter). The trail line for a connection names
 * its kind, so the accounting is auditable from the
 * record itself. Two purses (plan §8 call 1 → (b)) is the
 * standing working default — ASSISTANT-INFERRED.
 */

import { createHash, randomBytes } from "node:crypto";
import { canonical, sha256Hex } from "./accounts-core.mjs";

export { canonical, sha256Hex };

/* ================= the first scopes (§4.2) ================= */

export const AGENT_SCOPES = {
  "read-day": {
    plain: "Read the day",
    fence: "Read-only; the Living Day Packet for days the keeper's "
      + "record holds, its own permission rules intact inside it.",
  },
  "read-state": {
    plain: "Read the record's state",
    fence: "Read-only; states and summaries — never a whole-record "
      + "export. The bundle export stays the keeper's own act.",
  },
  "propose-plans": {
    plain: "Propose plans",
    fence: "Proposals only, through the one planner write path; "
      + "nothing lands without the path's own verification and the "
      + "keeper's standing approval rules.",
  },
  "read-genesis": {
    plain: "Read Genesis",
    fence: "Only under the profile's existing per-profile grant. "
      + "No profile grant, no scope; revoking the profile grant "
      + "revokes this scope automatically.",
  },
  "converse": {
    plain: "Converse",
    fence: "Stand behind the keeper's Spark under §5's protocol: "
      + "be briefed, answer as that Spark, identity absolute.",
  },
};

export const SCOPE_IDS = Object.keys(AGENT_SCOPES);

/* Envelope kinds, and the scope each one spends. A kind
 * with no entry here has no scope — the door refuses it,
 * whatever the token holds. "export-record" is named in
 * the tests precisely because it must stay refused. */
export const KIND_SCOPE = {
  "read-day": "read-day",
  "read-state": "read-state",
  "propose": "propose-plans",
  "read-genesis": "read-genesis",
  "converse": "converse",
};

export const ACCOUNTING_KINDS = ["keeper-arrangement", "door-seat"];

export const REFUSED_CHILD = "child-record-never-connects";

/* ================= tokens and grants ================= */

export function newTokenSecret() {
  return "agt_" + randomBytes(24).toString("hex");
}

export function tokenHash(secret) {
  return sha256Hex(String(secret || ""));
}

/**
 * The grant act, door side. The keeper grants in the app
 * (the grant surface of §4.3) and the grant is registered
 * here under the keeper's account session, carrying only
 * the token's HASH — the secret is shown once in the app,
 * carried by the keeper to the agent, and never stored
 * anywhere. Returns the standing grant (no secret in it).
 */
export async function createGrant(store, input, nowMs) {
  const name = String(input?.name || "").trim();
  if (!name) return { ok: false, reason: "agent-name-required" };
  if (input?.childRecord === true) {
    // §4.5: ground the door does not stand on.
    return { ok: false, reason: REFUSED_CHILD };
  }
  const scopes = Array.isArray(input?.scopes) ? input.scopes : [];
  for (const scope of scopes) {
    if (!AGENT_SCOPES[scope]) return { ok: false, reason: "scope-unknown" };
  }
  if (scopes.length === 0) return { ok: false, reason: "scope-required" };
  const accounting = ACCOUNTING_KINDS.includes(input?.accounting)
    ? input.accounting : null;
  if (!accounting) return { ok: false, reason: "accounting-kind-required" };
  const hash = String(input?.tokenHash || "");
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    return { ok: false, reason: "token-hash-shape" };
  }
  const tokenId = "agent-" + sha256Hex(hash + "|" + nowMs).slice(0, 12);
  const grant = {
    tokenId,
    accountId: input.accountId,
    name,
    tokenHash: hash,
    scopes: [...new Set(scopes)],
    accounting,
    createdAt: nowMs,
    revokedAt: null,
  };
  await store.putAgentGrant(grant);
  return { ok: true, grant: publicGrant(grant) };
}

/** The grant as any reader may see it: never the hash. */
export function publicGrant(grant) {
  if (!grant) return null;
  const { tokenHash: _hash, ...rest } = grant;
  return { ...rest, standing: grant.revokedAt == null };
}

/**
 * The scopes a grant effectively holds RIGHT NOW. Read
 * Genesis stands only while a per-profile grant stands
 * (§4.2): profileGrants is the standing list of profile
 * ids the keeper has granted Spark access to (the profile
 * record's own fact, carried to the door by the surface).
 */
export function effectiveScopes(grant, profileGrants) {
  const scopes = [...(grant?.scopes || [])];
  if (scopes.includes("read-genesis")
      && (!Array.isArray(profileGrants) || profileGrants.length === 0)) {
    return scopes.filter((s) => s !== "read-genesis");
  }
  return scopes;
}

/** Revoke: ends the connection at the door, instantly and
 *  completely. Past trail lines are untouched. */
export async function revokeGrant(store, tokenId, nowMs) {
  const grant = await store.getAgentGrant(tokenId);
  if (!grant) return { ok: false, reason: "grant-unknown" };
  if (grant.revokedAt == null) {
    await store.revokeAgentGrant(tokenId, nowMs);
  }
  return { ok: true, tokenId, revokedAt: nowMs };
}

export async function listGrants(store, accountId) {
  const grants = await store.listAgentGrants(accountId);
  return { ok: true, grants: grants.map(publicGrant) };
}

/* ================= sealed envelopes (§4.4) ================= */

export function envelopeCore(envelope) {
  return {
    id: envelope.id,
    tokenId: envelope.tokenId,
    scope: envelope.scope,
    kind: envelope.kind,
    payload: envelope.payload ?? null,
    at: envelope.at,
  };
}

export function sealEnvelope(secret, envelope) {
  return sha256Hex(String(secret) + "|" + canonical(envelopeCore(envelope)));
}

export function buildEnvelope(secret, grant, { kind, payload, at, id }) {
  const envelope = {
    id: id || "env-" + sha256Hex(String(at) + "|" + kind + "|"
      + canonical(payload ?? null)).slice(0, 12),
    tokenId: grant.tokenId,
    token: secret,
    scope: KIND_SCOPE[kind] || null,
    kind,
    payload: payload ?? null,
    at,
  };
  envelope.seal = sealEnvelope(secret, envelope);
  return envelope;
}

async function writeTrail(store, grant, envelope, result, reason, detail, nowMs) {
  const line = {
    lineId: "agent-line-" + sha256Hex(
      grant.tokenId + "|" + envelope.id + "|" + result + "|" + nowMs).slice(0, 16),
    accountId: grant.accountId,
    tokenId: grant.tokenId,
    agent: grant.name,
    scope: envelope.scope || KIND_SCOPE[envelope.kind] || null,
    kind: envelope.kind,
    detail: detail || "",
    result,
    reason: reason || "",
    accounting: grant.accounting,
    at: nowMs,
  };
  await store.appendAgentLine(grant.accountId, line);
  return line;
}

/**
 * Opens one envelope at the door: verifies the token's
 * standing, the seal, and the scope — in that order — and
 * writes the trail line either way (§4.3: refusals are
 * lines too). On success the caller fulfils the act from
 * the record (the record lives on the keeper's surfaces;
 * the door verifies and witnesses, it does not hold the
 * record). The refusal is told plainly, in words an agent
 * can relay to whoever sent it.
 */
export async function openEnvelope(store, envelope, options, nowMs) {
  const profileGrants = options?.profileGrants || [];
  if (!envelope || typeof envelope !== "object"
      || typeof envelope.tokenId !== "string"
      || typeof envelope.kind !== "string") {
    return { ok: false, reason: "envelope-shape", plain: "That envelope is not shaped like an envelope; nothing was done." };
  }
  const grant = await store.getAgentGrant(envelope.tokenId);
  if (!grant) {
    return { ok: false, reason: "token-unknown", plain: "This token is not known at the door; nothing was done." };
  }
  const refuse = async (reason, plain) => {
    const line = await writeTrail(store, grant, envelope, "refused", reason, "", nowMs);
    return { ok: false, reason, plain, line };
  };
  if (grant.revokedAt != null) {
    return refuse("token-revoked",
      "This token has been revoked by the keeper; the connection is ended and nothing was done.");
  }
  if (tokenHash(envelope.token) !== grant.tokenHash) {
    return refuse("token-secret-mismatch",
      "The secret carried does not match this token; nothing was done.");
  }
  if (envelope.seal !== sealEnvelope(envelope.token, envelope)) {
    return refuse("seal-broken",
      "This envelope's seal does not hold; its contents were not trusted and nothing was done.");
  }
  const needed = KIND_SCOPE[envelope.kind];
  if (!needed) {
    return refuse("no-scope-for-act",
      `No scope permits the act "${envelope.kind}" — scopes name what an agent may do, and this is not among them. Nothing was done.`);
  }
  if (envelope.scope !== needed) {
    return refuse("scope-mismatch",
      `This envelope names scope "${envelope.scope}" but the act needs "${needed}"; nothing was done.`);
  }
  if (!grant.scopes.includes(needed)) {
    return refuse("scope-not-granted",
      `The keeper did not grant the scope "${AGENT_SCOPES[needed].plain}" to this agent; nothing was done.`);
  }
  if (!effectiveScopes(grant, profileGrants).includes(needed)) {
    // Only Read Genesis can fall out of the effective set.
    return refuse("genesis-grant-not-standing",
      "Read Genesis stands only under the profile's own grant, and no profile grant stands; nothing was read.");
  }
  const line = await writeTrail(store, grant, envelope, "done", "",
    String(options?.detail || ""), nowMs);
  return { ok: true, grant: publicGrant(grant), scope: needed, line };
}

/** Seals a reply envelope under the same pairing secret —
 *  the door's answers ride sealed too, so a reply is as
 *  attributable as the act that asked for it. */
export function sealReply(secret, reply) {
  const core = {
    inReplyTo: reply.inReplyTo,
    kind: reply.kind,
    payload: reply.payload ?? null,
    at: reply.at,
  };
  return { ...core, seal: sha256Hex(String(secret) + "|" + canonical(core)) };
}

export function openReply(secret, reply) {
  if (!reply || typeof reply !== "object") return false;
  const { seal, ...core } = reply;
  return seal === sha256Hex(String(secret) + "|" + canonical(core));
}

/** The keeper's whole trail for one account (§4.3). */
export async function readTrail(store, accountId) {
  const lines = await store.getAgentLines(accountId);
  return { ok: true, lines };
}
