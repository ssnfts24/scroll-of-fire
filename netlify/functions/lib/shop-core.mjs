/* The shop's Stripe core — the shop sibling of the
 * door's socket (lib/stripe-core.mjs), written for the
 * one-PR redesign (Nov 24, 2026) in the socket's own
 * discipline, and converted by the payments sweep
 * (Nov 27, 2026) to the stall's proven pattern:
 *
 * THE SHELF NOW SELLS BY ITS OWN RECORD, the way the
 * stall sells by its catalogue. Until the sweep, a
 * charged price reached this code only as a Stripe
 * Price ID through an environment name — two prices
 * Aaron would have had to create in his dashboard,
 * and a till whose probe lit on the key alone while
 * its webhook events had no destination and its
 * orders were never persisted. Now the shelf's own
 * price record below (the amounts that already stand
 * in the open on docs/shop.html) is sent as inline
 * price_data, a paid session's amount is CHECKED
 * against that record before an order may resolve,
 * the shop keeps its OWN webhook secret, its probe
 * lights only when its whole road stands, and its
 * orders persist (the function face writes them to
 * the shop's Blobs store through the stall's store
 * machinery). Nothing for Aaron to create in Stripe
 * beyond the connection and this function's own
 * webhook destination.
 *
 * THE TILL STAYS DARK UNTIL ITS WHOLE ROAD STANDS.
 * With the key or the shop's webhook secret absent,
 * every charging path refuses plainly and fails
 * closed, and the shop's standing order road — email,
 * confirmed by hand before the forge — stands
 * untouched as the way to order.
 *
 * WHAT MAY EVER BE A CHECKOUT ITEM: the standard,
 * repeatable shelf pieces whose prices already stand
 * in the open on the shop shelf — today, the Tensor
 * Band and the Pair Forged Together. One-of-one
 * pieces and custom work are NEVER checkout items:
 * they are ordered through the forge conversation
 * (email), where sizing, finish, and the piece itself
 * are confirmed by hand. Asking this code for one is
 * refused by name. Crypto is not built and never
 * offered (rails paper, Rail 3).
 *
 * The shelf prices below are the shop's price RECORD,
 * copied from docs/shop.html where Aaron's bench
 * pricing already stands in public. They are now the
 * charge as well as the display: the amounts sent to
 * Stripe, and the amounts a paid order is checked
 * against. Prices are Aaron's calls — these stand as
 * he set them ($44.44 / $88.88) and this sweep moved
 * none of them.
 */

import {
  NOT_CONNECTED_WORDS, STRIPE_ENV, verifyWebhook,
} from "./stripe-core.mjs";

export { NOT_CONNECTED_WORDS, verifyWebhook };

/** Environment NAMES — never values. The shared key
 *  name lives in stripe-core's STRIPE_ENV
 *  (STRIPE_SECRET_KEY). The webhook secret is the
 *  SHOP'S OWN (payments sweep): Stripe issues one
 *  secret per destination, and the shop's destination
 *  is its own — the stall's STRIPE_WEBHOOK_SECRET
 *  verifies the stall's events, never the shop's.
 *  (The old STRIPE_PRICE_TENSOR_BAND /
 *  STRIPE_PRICE_TENSOR_BAND_PAIR names are no longer
 *  read by anything: the shelf sells by its record.) */
export const SHOP_ENV = {
  webhookSecret: "STRIPE_SHOP_WEBHOOK_SECRET",
};

/** The checkout shelf: standard pieces only, each
 *  with the price the shop page already shows — now
 *  the record the charge is built from and checked
 *  against, in cents beside the words. */
export const SHOP_ITEMS = {
  "tensor-band": {
    shelf: "Tensor Band — Single Band",
    shelfPriceWords: "$44.44 USD",
    priceCents: 4444,
  },
  "tensor-band-pair": {
    shelf: "Tensor Band — Pair Forged Together",
    shelfPriceWords: "$88.88 USD",
    priceCents: 8888,
  },
};

const present = (env, name) =>
  typeof env[name] === "string" && env[name].length > 0;

/** The shop till's standing, read from names alone.
 *  `charging` is the whole-road rule: the key AND the
 *  shop's own webhook secret together — the key alone
 *  lit this probe once, while no destination fed it
 *  and no order persisted. Never again. */
export function shopConfig(env) {
  const items = {};
  for (const [id, item] of Object.entries(SHOP_ITEMS)) {
    items[id] = {
      shelf: item.shelf,
      shelfPriceWords: item.shelfPriceWords,
      priceCents: item.priceCents,
      sellable: true,
    };
  }
  const connected = present(env, STRIPE_ENV.secretKey);
  const webhook = present(env, SHOP_ENV.webhookSecret);
  return {
    connected,
    webhook,
    charging: connected && webhook,
    items,
  };
}

function refuse(reason) {
  return { ok: false, reason, words: NOT_CONNECTED_WORDS };
}

/**
 * The exact form a shop Checkout Session is created
 * with — a pure function of the shelf record, in the
 * stall's pattern, so a proof can build it for every
 * piece and check every amount against the record
 * itself. Inline price_data: the record's cents are
 * the charge; the piece's shelf name is the product
 * name Stripe shows. Card AND Cash App Pay in one
 * session (rails paper, Rails 1–2).
 */
export function buildShopSessionForm({ item, successUrl, cancelUrl }) {
  if (!(item in SHOP_ITEMS)) {
    return { ok: false, reason: "item-never-sold",
      words: "That piece is not sold by checkout: one-of-one " +
        "and custom work is ordered through the forge " +
        "conversation, by email, and confirmed by hand." };
  }
  const row = SHOP_ITEMS[item];
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("payment_method_types[0]", "card");
  form.set("payment_method_types[1]", "cashapp");
  form.set("line_items[0][price_data][currency]", "usd");
  form.set("line_items[0][price_data][product_data][name]", row.shelf);
  form.set("line_items[0][price_data][unit_amount]", String(row.priceCents));
  form.set("line_items[0][quantity]", "1");
  form.set("success_url", successUrl);
  form.set("cancel_url", cancelUrl);
  form.set("metadata[item]", item);
  return { ok: true, form };
}

/**
 * Creates a Stripe Checkout session for one standard
 * shelf piece — through the injected transport (the
 * function's real transport is fetch; proofs use a
 * double). Refuses, in order: not connected; an item
 * that is never sold by checkout; the shop's webhook
 * secret not set (the whole-road rule at the till
 * itself — a session is never opened while its order
 * line is missing); a return address that is not the
 * site's own. Sizing and finish are still confirmed
 * by email before the forge: payment reserves the
 * piece, the forge conversation finishes the order —
 * the shop's own standing steps, unchanged.
 */
export async function createShopCheckout({
  env, transport, item, successUrl, cancelUrl, siteOrigin,
}) {
  const config = shopConfig(env);
  if (!config.connected) return refuse("stripe-not-connected");
  const built = buildShopSessionForm({ item, successUrl, cancelUrl });
  if (!built.ok) return built;
  if (!config.webhook) {
    return { ok: false, reason: "stripe-webhook-not-set",
      words: "Stripe is connected, but the shop's webhook " +
        "secret is not set, so a paid order could not be " +
        "recorded. The till stays dark until it is." };
  }
  const origin = siteOrigin || "https://codexofreality.org";
  for (const url of [successUrl, cancelUrl]) {
    if (typeof url !== "string" || !url.startsWith(origin + "/")) {
      return { ok: false, reason: "return-url-not-the-sites" };
    }
  }
  let res = null;
  try {
    res = await transport("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env[STRIPE_ENV.secretKey]}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: built.form.toString(),
    });
  } catch {
    /* The road itself failed — the same plain answer
     * as an API error, never an exception (the stall's
     * lesson, applied here by the sweep). */
    return { ok: false, reason: "stripe-session-failed",
      words: "Stripe did not open a checkout. Nothing was charged." };
  }
  if (!res || res.status !== 200 || !res.json || !res.json.url) {
    return { ok: false, reason: "stripe-session-failed",
      words: "Stripe did not open a checkout. Nothing was charged." };
  }
  return { ok: true, url: res.json.url, sessionId: res.json.id };
}

/**
 * Order-on-payment: a verified checkout.session.completed
 * event with payment standing paid resolves to an
 * order record — the piece, how it arrived, the rail,
 * and what Stripe itself reports was paid. The amount
 * is CHECKED against the shelf record, the stall's
 * law: a paid session whose total is not the record's
 * price for that piece, in USD, records nothing and
 * is refused by name. Any other event, or an unpaid
 * session, records nothing.
 */
export function orderFromCheckoutCompleted(event, atIso) {
  if (!event || event.type !== "checkout.session.completed") {
    return { ok: false, reason: "event-not-a-completed-checkout" };
  }
  const session = event.data && event.data.object;
  if (!session || session.payment_status !== "paid") {
    return { ok: false, reason: "checkout-not-paid" };
  }
  const md = session.metadata || {};
  if (!md.item || !(md.item in SHOP_ITEMS)) {
    return { ok: false, reason: "order-shape-incomplete" };
  }
  const row = SHOP_ITEMS[md.item];
  if (session.currency !== "usd"
      || session.amount_total !== row.priceCents) {
    return { ok: false, reason: "order-amount-mismatch" };
  }
  const methods = session.payment_method_types || [];
  const rail = methods.includes("cashapp") && !methods.includes("card")
    ? "cash-app-pay" : "stripe-card";
  return {
    ok: true,
    order: {
      item: md.item,
      shelf: row.shelf,
      how: "stripe-checkout",
      rail,
      receivedAt: atIso || "",
      sessionId: session.id || "",
      amountTotalCents: session.amount_total,
      currency: session.currency,
    },
  };
}
