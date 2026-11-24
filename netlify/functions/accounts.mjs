/*
 * The accounts side of the door — Gate G, Phase 3 (G2;
 * gate-g-live-plan-2026-11-24 §2).
 *
 * Served by Netlify at /.netlify/functions/accounts on
 * codexofreality.org only. This is the door's THIRD seat,
 * and it is not a talking seat: it links surfaces to one
 * account (sign in once, either side) and carries copies
 * of the record's lines between them (sync). The Guide
 * seat and the Spark seat are untouched by this file, and
 * nothing here spends against the public door's ceiling —
 * accounts are not talk (two purses, plan §3.3 working
 * default, ASSISTANT-INFERRED).
 *
 *   GET   -> public state: whether the accounts side is
 *            configured, the sign-in shape, the store kind.
 *   POST  -> one JSON envelope, {action, ...}:
 *            request-link {email, adultConfirmed}
 *            verify       {token}            -> {session, email}
 *            push         {session, lines}   -> append-only
 *            pull         {session}          -> the line set
 *            end-account  {session}          -> true deletion
 *
 * Fail-closed, as every seat at this door: an unconfigured
 * store (Aaron's Atlas environment not yet set — see
 * lib/ACCOUNTS-SETUP.md) answers "unconfigured" and does
 * nothing. No credential is ever logged, returned, or
 * stored in this repo; the store connection and the
 * session secret are read from the environment by name.
 *
 * The magic link's delivery: when ACCOUNTS_EMAIL_WEBHOOK
 * is set, the link is POSTed there for Aaron's mailer to
 * send. ACCOUNTS_DEV_EXPOSE_TOKEN exists for Aaron's own
 * test deployments only — it returns the token in the
 * response — and the deployment checklist forbids it in
 * production, in those words.
 */

import {
  endAccount,
  pullLines,
  pushLines,
  readSession,
  requestMagicLink,
  verifyMagicLink,
} from "./lib/accounts-core.mjs";

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

async function deliverMagicLink(email, token) {
  const webhook = process.env.ACCOUNTS_EMAIL_WEBHOOK;
  const base = process.env.SITE_URL || "https://codexofreality.org";
  const link = `${base}/account.html?signin=${encodeURIComponent(token)}`;
  if (!webhook) return "no-mailer";
  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, link, purpose: "spark-living-day-signin" }),
    });
    return res.ok ? "sent" : "mailer-refused";
  } catch {
    return "mailer-unreachable";
  }
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
      accounts: storeKind !== "unconfigured",
      store: storeKind,
      signIn: "email-magic-link",
      note: "One account links the website and the app. The account "
        + "never holds your Spark's identity — that stays with your "
        + "Spark, on your device.",
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
  const sessionSecret = process.env.ACCOUNTS_SESSION_SECRET || null;

  let store;
  try {
    store = await getStore();
  } catch {
    return json(503, { ok: false, reason: "door-unconfigured" });
  }

  if (action === "request-link") {
    const result = await requestMagicLink(store, {
      email: body.email,
      adultConfirmed: body.adultConfirmed === true,
    }, nowMs);
    if (!result.ok) return json(400, result);
    const delivery = await deliverMagicLink(body.email, result.token);
    const out = { ok: true, delivery };
    // Aaron's own test deployments only — forbidden in
    // production by the deployment checklist.
    if (process.env.ACCOUNTS_DEV_EXPOSE_TOKEN === "1") out.token = result.token;
    return json(200, out);
  }

  if (action === "verify") {
    const result = await verifyMagicLink(store, { token: body.token }, nowMs, sessionSecret);
    if (!result.ok) return json(400, { ok: false, reason: result.reason });
    return json(200, {
      ok: true,
      session: result.session,
      email: result.account.email,
      accountId: result.account.id,
    });
  }

  // Everything past here needs a live session over a
  // standing account.
  const session = readSession(body?.session, sessionSecret, nowMs);
  if (!session) return json(401, { ok: false, reason: "session" });
  const account = await store.getAccountById(session.accountId);
  if (!account) return json(401, { ok: false, reason: "session" });

  if (action === "push") {
    const result = await pushLines(store, account.id, body.lines);
    return json(result.ok ? 200 : 400, result);
  }
  if (action === "pull") {
    const result = await pullLines(store, account.id);
    return json(200, result);
  }
  if (action === "end-account") {
    const result = await endAccount(store, account);
    return json(200, result);
  }
  return json(400, { ok: false, reason: "action-unknown" });
}
