/* The shop till's function face — the sibling of
 * stripe.mjs for the shop shelf (lib/shop-core.mjs).
 *
 * GET answers the till's standing: is charging
 * connected, and is each standard piece's price set —
 * in plain words, names only, never a key. The shop
 * page reads it to decide whether to show its buy
 * buttons; while the answer is dark, the buttons stay
 * hidden and ordering by email stands as it always
 * has.
 *
 * POST with a Stripe-Signature header is the webhook
 * road: signature verified against the raw body or
 * the event is refused; a paid, completed checkout
 * resolves to an order record, answered in the reply
 * (order persistence rides the accounts store when
 * the door is live — the named seam, not a silent
 * gap).
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
  NOT_CONNECTED_WORDS, createShopCheckout,
  orderFromCheckoutCompleted, shopConfig, verifyWebhook,
} from "./lib/shop-core.mjs";

const env = () => process.env;

async function stripeTransport(url, options) {
  const res = await fetch(url, options);
  let json = null;
  try { json = await res.json(); } catch { /* answered below */ }
  return { status: res.status, json };
}

const json = (status, body) => ({
  statusCode: status,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  const e = env();
  const config = shopConfig(e);
  const signature = event.headers["stripe-signature"] ||
    event.headers["Stripe-Signature"];

  if (event.httpMethod === "GET") {
    return json(200, {
      ok: true, charging: config.connected,
      stripe: { connected: config.connected, webhook: config.webhook },
      items: config.items,
      ...(config.connected ? {}
        : { words: NOT_CONNECTED_WORDS }),
    });
  }
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, reason: "method-not-allowed" });
  }

  if (signature) {
    const verified = verifyWebhook({
      env: e, rawBody: event.body || "", signatureHeader: signature,
      nowSeconds: Math.floor(Date.now() / 1000),
    });
    if (!verified.ok) return json(400, verified);
    let stripeEvent = null;
    try { stripeEvent = JSON.parse(event.body || "null"); } catch {
      return json(400, { ok: false, reason: "body-not-json" });
    }
    const resolved = orderFromCheckoutCompleted(
      stripeEvent, new Date().toISOString());
    return json(200, resolved);
  }

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {
    return json(400, { ok: false, reason: "body-not-json" });
  }
  if (body.action === "checkout") {
    const session = await createShopCheckout({
      env: e, transport: stripeTransport, item: body.item,
      successUrl: body.successUrl, cancelUrl: body.cancelUrl,
      siteOrigin: e.SITE_URL || "https://codexofreality.org",
    });
    return json(session.ok ? 200 : 400, session);
  }
  return json(400, { ok: false, reason: "unknown-action" });
};
