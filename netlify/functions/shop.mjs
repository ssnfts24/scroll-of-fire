/* The shop till's function face — the sibling of
 * stripe.mjs for the shop shelf (lib/shop-core.mjs),
 * in the same modern shape as the door's other seats.
 *
 * GET answers the till's standing: is charging
 * connected — the WHOLE road (payments sweep,
 * Nov 27, 2026): the key and the shop's own webhook
 * secret together — and each standard piece's record,
 * in plain words, names only, never a key. The shop
 * page reads it to decide whether to show its buy
 * buttons; while the answer is dark, the buttons stay
 * hidden and ordering by email stands as it always
 * has.
 *
 * POST with a Stripe-Signature header is the webhook
 * road: signature verified under the SHOP'S OWN
 * secret (STRIPE_SHOP_WEBHOOK_SECRET) against the raw
 * body or the event is refused; a paid, completed
 * checkout resolves to an order record and is WRITTEN
 * to the shop's order store (Netlify Blobs,
 * "codex-shop-orders", through the stall's store
 * machinery) under its session id. The seam this face
 * once named — orders answered in the reply and
 * persisted nowhere — is closed.
 *
 * POST { action: "checkout", item, successUrl,
 * cancelUrl } creates a session for one standard
 * piece and answers its hosted URL. Return addresses
 * must be the site's own.
 *
 * Like the socket beside it: built, dark, fail-closed.
 * Aaron's Stripe connection is the only missing step.
 */

import {
  NOT_CONNECTED_WORDS, SHOP_ENV, createShopCheckout,
  orderFromCheckoutCompleted, shopConfig, verifyWebhook,
} from "./lib/shop-core.mjs";
import {
  createProductionOrderStore, recordOrder,
} from "./lib/stall-core.mjs";

/** The shop's own order store name — its own shelf
 *  in Blobs, never the stall's. */
const SHOP_ORDER_STORE = "codex-shop-orders";

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
  const config = shopConfig(env);

  if (req.method === "GET") {
    return json({
      ok: true, charging: config.charging,
      stripe: { connected: config.connected, webhook: config.webhook },
      items: config.items,
      ...(config.charging ? {} : { words: NOT_CONNECTED_WORDS }),
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
      secretName: SHOP_ENV.webhookSecret,
    });
    if (!verdict.ok) return json(verdict, 400);
    let stripeEvent = null;
    try { stripeEvent = JSON.parse(raw); } catch { stripeEvent = null; }
    if (!stripeEvent) return json({ ok: false, reason: "body-not-json" }, 400);
    const resolved = orderFromCheckoutCompleted(
      stripeEvent, new Date().toISOString());
    if (!resolved.ok) {
      return json({ ok: true, recorded: false, reason: resolved.reason });
    }
    const store = await createProductionOrderStore(SHOP_ORDER_STORE);
    const recorded = await recordOrder(store, resolved.order);
    return json(recorded.ok
      ? { ok: true, recorded: true, already: !!recorded.already }
      : { ok: false, reason: recorded.reason }, recorded.ok ? 200 : 400);
  }

  let body = null;
  try { body = JSON.parse(raw); } catch { body = null; }
  if (!body || body.action !== "checkout") {
    return json({ ok: false, reason: "action-unknown" }, 400);
  }
  const session = await createShopCheckout({
    env, transport: fetchTransport, item: body.item,
    successUrl: body.successUrl, cancelUrl: body.cancelUrl,
    siteOrigin: env.SITE_URL || "https://codexofreality.org",
  });
  return json(session, session.ok ? 200 : 400);
}
