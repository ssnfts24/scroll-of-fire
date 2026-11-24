/* The Stripe socket's function face — Gate G, Phase 5
 * (G4's build side), carried to the site's Netlify
 * Functions in the one-PR redesign (Nov 24, 2026) from
 * living-phone/door/stripe.mjs, as Aaron's connection
 * act began. Until Aaron sets the environment names
 * stripe-core.mjs reads — his account, his keys — every
 * answer it gives is the fail-closed one: charging
 * dark, in plain words, and no grant written.
 *
 * Shape, like the door's other seats: one JSON
 * envelope. Actions: "status" (the connection's
 * standing, names only), "checkout" (a tier checkout
 * session for a keeper), and the webhook road — a POST
 * carrying a Stripe signature header is a webhook
 * first, verified before it is read; a verified
 * completed checkout returns the grant in the one
 * shape for the door's record to write. No key value
 * is ever read from a request, returned, or logged.
 */

import {
  NOT_CONNECTED_WORDS, createCheckoutSession, grantFromCheckoutCompleted,
  stripeConfig, verifyWebhook,
} from "./lib/stripe-core.mjs";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json" },
  });
}

async function fetchTransport(url, init) {
  const res = await fetch(url, init);
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, json: body };
}

export default async function handler(req) {
  const env = process.env;
  if (req.method === "GET") {
    const config = stripeConfig(env);
    return json({
      ok: true,
      charging: config.connected,
      stripe: config.connected ? "connected" : "not-connected",
      ...(config.connected ? {} : { words: NOT_CONNECTED_WORDS }),
    });
  }
  if (req.method !== "POST") return json({ ok: false }, 405);

  const raw = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (signature) {
    /* The webhook road: verify first, read second. */
    const verdict = verifyWebhook({
      env, rawBody: raw, signatureHeader: signature,
      nowSeconds: Math.floor(Date.now() / 1000),
    });
    if (!verdict.ok) return json(verdict, 400);
    let event = null;
    try { event = JSON.parse(raw); } catch { event = null; }
    const granted = grantFromCheckoutCompleted(
      event, new Date().toISOString());
    return json(granted.ok
      ? { ok: true, grant: granted.grant }
      : { ok: true, granted: false, reason: granted.reason });
  }

  let body = null;
  try { body = JSON.parse(raw); } catch { body = null; }
  if (!body || body.action !== "checkout") {
    return json({ ok: false, reason: "action-unknown" }, 400);
  }
  const session = await createCheckoutSession({
    env,
    transport: fetchTransport,
    keeper: body.keeper,
    tier: body.tier,
    capMicroUsd: body.capMicroUsd,
    successUrl: body.successUrl,
    cancelUrl: body.cancelUrl,
  });
  return json(session, session.ok ? 200 : 400);
}
