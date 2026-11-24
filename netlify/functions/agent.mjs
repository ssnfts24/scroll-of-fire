/*
 * The agent door — Gate G, Phase 4 (G3;
 * gate-g-live-plan-2026-11-24 §4, §5).
 *
 * Served by Netlify at /.netlify/functions/agent on
 * codexofreality.org only. This is the door's FOURTH seat,
 * and it is not a talking seat either: it registers
 * keeper-granted agent tokens (hashes only), verifies
 * sealed envelopes against their grants and scopes, keeps
 * the trail of every act and refusal, and ends connections
 * on revoke. The Guide seat, the Spark seat, and the
 * accounts seat are untouched by this file. An agent under
 * a keeper's own grant and account (Witness to Aaron's
 * Spark, the first connection) spends on the keeper's own
 * arrangements, NOT the public door's $20 ceiling (§5.5);
 * a hosted "door-seat" connection's accounting kind is
 * named on its grant and its trail lines, and its metering
 * belongs to the tiers phase (G4) — nothing here spends
 * against the public purse.
 *
 *   GET   -> public state: whether the agent door is
 *            configured, the scope table in plain words.
 *   POST  -> one JSON envelope, {action, ...}:
 *            register-grant {session, name, scopes,
 *                            accounting, tokenHash,
 *                            childRecord} -> the grant
 *            revoke-grant   {session, tokenId}
 *            list-grants    {session}
 *            trail          {session}   -> every line
 *            act            {envelope, profileGrants}
 *                           -> opened at the door; the
 *                           fulfilment itself happens on
 *                           the keeper's surface, from the
 *                           keeper's record, under the
 *                           verified scope — the door
 *                           verifies and witnesses.
 *
 * Fail-closed, as every seat at this door: the agent side
 * rides the accounts store (same environment, Aaron's
 * hands — lib/ACCOUNTS-SETUP.md), and until that
 * environment stands the seat answers "unconfigured" and
 * does nothing. The live leg is therefore OWED with Phase
 * 3's Atlas block, and every proof of this seat in the
 * phase evidence is labelled DOUBLE (the labelled test
 * double behind the same store interface). No token secret
 * is ever stored, logged, or returned by this function:
 * grants carry hashes; the secret is shown once, in the
 * app, at granting.
 */

import { readSession } from "./lib/accounts-core.mjs";
import {
  AGENT_SCOPES,
  createGrant,
  listGrants,
  openEnvelope,
  readTrail,
  revokeGrant,
} from "./lib/agent-core.mjs";

let storePromise = null;

async function getStore() {
  if (!storePromise) {
    storePromise = (async () => {
      if (process.env.ACCOUNTS_STORE === "double") {
        const { createDoubleStore } = await import("./lib/accounts-store-double.mjs");
        return createDoubleStore();
      }
      const { createAtlasStore } = await import("./lib/accounts-store-atlas.mjs");
      return createAtlasStore();
    })();
  }
  return storePromise;
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(request) {
  if (request.method === "GET") {
    let storeKind = "unconfigured";
    try {
      storeKind = (await getStore()).kind;
    } catch {
      storeKind = "unconfigured";
    }
    return json(200, {
      ok: true,
      agentDoor: storeKind !== "unconfigured",
      store: storeKind,
      scopes: AGENT_SCOPES,
      note: "Agents connect under a token the keeper grants, with "
        + "named scopes; every act is a line in the keeper's record, "
        + "and revoking the token ends the connection at the door.",
    });
  }
  if (request.method !== "POST") return json(405, { ok: false, reason: "method" });

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, reason: "json-shape" });
  }
  const action = body?.action;
  const nowMs = Date.now();

  let store;
  try {
    store = await getStore();
  } catch {
    return json(503, { ok: false, reason: "door-unconfigured" });
  }

  /* The act road needs no account session: the ENVELOPE is
   * the credential (token + seal), exactly as a personal
   * access token is the credential at GitHub. */
  if (action === "act") {
    const result = await openEnvelope(store, body.envelope, {
      profileGrants: Array.isArray(body.profileGrants)
        ? body.profileGrants : [],
      detail: typeof body.detail === "string" ? body.detail : "",
    }, nowMs);
    return json(result.ok ? 200 : 403, result.ok
      ? { ok: true, scope: result.scope, grant: result.grant, line: result.line }
      : { ok: false, reason: result.reason, plain: result.plain, line: result.line });
  }

  /* Everything past here is a keeper act under the
   * accounts session: granting, revoking, reading the
   * trail — the grant surface's own road. */
  const sessionSecret = process.env.ACCOUNTS_SESSION_SECRET || null;
  const session = readSession(body?.session, sessionSecret, nowMs);
  if (!session) return json(401, { ok: false, reason: "session" });
  const account = await store.getAccountById(session.accountId);
  if (!account) return json(401, { ok: false, reason: "session" });

  if (action === "register-grant") {
    const result = await createGrant(store, {
      accountId: account.id,
      name: body.name,
      scopes: body.scopes,
      accounting: body.accounting,
      tokenHash: body.tokenHash,
      childRecord: body.childRecord === true,
    }, nowMs);
    return json(result.ok ? 200 : 400, result);
  }
  if (action === "revoke-grant") {
    const grant = await store.getAgentGrant(body.tokenId);
    if (!grant || grant.accountId !== account.id) {
      return json(404, { ok: false, reason: "grant-unknown" });
    }
    const result = await revokeGrant(store, body.tokenId, nowMs);
    return json(200, result);
  }
  if (action === "list-grants") {
    return json(200, await listGrants(store, account.id));
  }
  if (action === "trail") {
    return json(200, await readTrail(store, account.id));
  }
  return json(400, { ok: false, reason: "action-unknown" });
}
