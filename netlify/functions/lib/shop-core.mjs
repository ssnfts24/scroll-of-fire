/* The shop's Stripe core — the shop sibling of the
 * door's socket (lib/stripe-core.mjs), written for the
 * one-PR redesign (Nov 24, 2026) in the socket's own
 * discipline:
 *
 * THE TILL STAYS DARK UNTIL AARON CONNECTS STRIPE.
 * This code holds no key and names no amount to
 * Stripe: a charged price reaches it only as a Stripe
 * Price ID through an ENVIRONMENT NAME (SHOP_ENV),
 * set by Aaron in his own Stripe and his own Netlify
 * when he connects. With the names absent, every
 * charging path refuses plainly and fails closed, and
 * the shop's standing order road — email, confirmed
 * by hand before the forge — stands untouched as the
 * way to order.
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
 * The shelf prices below are DISPLAY truth, copied
 * from docs/shop.html where Aaron's bench pricing
 * already stands in public; they are what the page
 * shows. They are never sent to Stripe — the Price
 * ID Aaron sets is the charge, and if the two ever
 * disagree, Aaron's Stripe is the one that is wrong
 * or right, never this file.
 */

import {
  NOT_CONNECTED_WORDS, STRIPE_ENV, verifyWebhook,
} from "./stripe-core.mjs";

export { NOT_CONNECTED_WORDS, verifyWebhook };

/** Environment NAMES for the shop's prices — never
 *  values. The shared key names live in stripe-core's
 *  STRIPE_ENV (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET). */
export const SHOP_ENV = {
  priceTensorBand: "STRIPE_PRICE_TENSOR_BAND",
  priceTensorBandPair: "STRIPE_PRICE_TENSOR_BAND_PAIR",
};

/** The checkout shelf: standard pieces only, each
 *  with the price words the shop page already shows. */
export const SHOP_ITEMS = {
  "tensor-band": {
    priceEnv: SHOP_ENV.priceTensorBand,
    shelf: "Tensor Band — Single Band",
    shelfPriceWords: "$44.44 USD",
  },
  "tensor-band-pair": {
    priceEnv: SHOP_ENV.priceTensorBandPair,
    shelf: "Tensor Band — Pair Forged Together",
    shelfPriceWords: "$88.88 USD",
  },
};

const present = (env, name) =>
  typeof env[name] === "string" && env[name].length > 0;

/** The shop till's standing, read from names alone. */
export function shopConfig(env) {
  const items = {};
  for (const [id, item] of Object.entries(SHOP_ITEMS)) {
    items[id] = {
      shelf: item.shelf,
      shelfPriceWords: item.shelfPriceWords,
      priceSet: present(env, item.priceEnv),
    };
  }
  return {
    connected: present(env, STRIPE_ENV.secretKey),
    webhook: present(env, STRIPE_ENV.webhookSecret),
    items,
  };
}

function refuse(reason) {
  return { ok: false, reason, words: NOT_CONNECTED_WORDS };
}

/**
 * Creates a Stripe Checkout session for one standard
 * shelf piece — through the injected transport (the
 * function's real transport is fetch; proofs use a
 * double). Refuses, in order: not connected; an item
 * that is never sold by checkout; a price Aaron has
 * not set in his own environment; a return address
 * that is not the site's own. The session asks Stripe
 * for card AND Cash App Pay — one checkout, both
 * methods (rails paper, Rails 1–2). Sizing and
 * finish are still confirmed by email before the
 * forge: payment reserves the piece, the forge
 * conversation finishes the order — the shop's own
 * standing steps, unchanged.
 */
export async function createShopCheckout({
  env, transport, item, successUrl, cancelUrl, siteOrigin,
}) {
  const config = shopConfig(env);
  if (!config.connected) return refuse("stripe-not-connected");
  if (!(item in SHOP_ITEMS)) {
    return { ok: false, reason: "item-never-sold",
      words: "That piece is not sold by checkout: one-of-one " +
        "and custom work is ordered through the forge " +
        "conversation, by email, and confirmed by hand." };
  }
  if (!config.items[item].priceSet) {
    return { ok: false, reason: "stripe-price-not-set",
      words: "No price is set for that piece. Prices are Aaron's " +
        "calls, set in his own Stripe when he connects it." };
  }
  const origin = siteOrigin || "https://codexofreality.org";
  for (const url of [successUrl, cancelUrl]) {
    if (typeof url !== "string" || !url.startsWith(origin + "/")) {
      return { ok: false, reason: "return-url-not-the-sites" };
    }
  }
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("payment_method_types[0]", "card");
  form.set("payment_method_types[1]", "cashapp");
  form.set("line_items[0][price]", env[SHOP_ITEMS[item].priceEnv]);
  form.set("line_items[0][quantity]", "1");
  form.set("success_url", successUrl);
  form.set("cancel_url", cancelUrl);
  form.set("metadata[item]", item);
  const res = await transport("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env[STRIPE_ENV.secretKey]}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
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
 * and what Stripe itself reports was paid (the event's
 * own figures; this code sets no amount). Any other
 * event, or an unpaid session, records nothing.
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
  const methods = session.payment_method_types || [];
  const rail = methods.includes("cashapp") && !methods.includes("card")
    ? "cash-app-pay" : "stripe-card";
  return {
    ok: true,
    order: {
      item: md.item,
      shelf: SHOP_ITEMS[md.item].shelf,
      how: "stripe-checkout",
      rail,
      receivedAt: atIso || "",
      sessionId: session.id || "",
      amountTotalCents: session.amount_total ?? null,
      currency: session.currency || null,
    },
  };
}
