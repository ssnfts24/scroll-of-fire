/*
 * The Stripe socket carried to the site + its shop
 * sibling — one-PR redesign, Nov 24, 2026.
 *
 * What is proven, all against injected environment
 * names and a double transport (no key, no network):
 * the till is DARK and refuses plainly while Aaron
 * has not connected Stripe; the tier socket's own
 * discipline survived the carry (free and
 * bring-your-own tiers are never sold; a missing
 * price refuses; the grant shape is the door's one
 * shape, rail named by the session's own methods);
 * the shop shelf sells ONLY its two standard pieces
 * (a one-of-one is refused by name); a checkout asks
 * for card and Cash App Pay in one session, mode
 * payment, with the price taken from Aaron's
 * environment name and never from this code; return
 * addresses must be the site's own; a webhook event
 * is believed only behind a verified signature; and
 * an order record is born only from a paid,
 * completed checkout.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import {
  CHARGEABLE_TIERS, grantFromCheckoutCompleted,
  stripeConfig, createCheckoutSession,
} from "../netlify/functions/lib/stripe-core.mjs";
import {
  SHOP_ITEMS, createShopCheckout,
  orderFromCheckoutCompleted, shopConfig, verifyWebhook,
} from "../netlify/functions/lib/shop-core.mjs";

const noTransport = async () => {
  throw new Error("transport must not be called");
};

function recordingTransport(capture) {
  return async (url, options) => {
    capture.url = url;
    capture.options = options;
    return { status: 200, json: { id: "cs_test_1", url: "https://checkout.stripe.com/c/cs_test_1" } };
  };
}

function signedHeader(secret, rawBody, atSec) {
  const sig = createHmac("sha256", secret)
    .update(`${atSec}.${rawBody}`).digest("hex");
  return `t=${atSec},v1=${sig}`;
}

test("dark till: with no environment, both sockets refuse plainly", async () => {
  assert.equal(stripeConfig({}).connected, false);
  assert.equal(shopConfig({}).connected, false);
  const tier = await createCheckoutSession({
    env: {}, transport: noTransport, tier: "connected",
    keeper: "keeper-1",
    successUrl: "https://codexofreality.org/ok",
    cancelUrl: "https://codexofreality.org/no",
  });
  assert.equal(tier.ok, false);
  assert.equal(tier.reason, "stripe-not-connected");
  assert.match(tier.words, /Stripe is not connected/);
  const shop = await createShopCheckout({
    env: {}, transport: noTransport, item: "tensor-band",
    successUrl: "https://codexofreality.org/shop.html?order=placed",
    cancelUrl: "https://codexofreality.org/shop.html?order=cancelled",
    siteOrigin: "https://codexofreality.org",
  });
  assert.equal(shop.ok, false);
  assert.equal(shop.reason, "stripe-not-connected");
});

test("the carried socket keeps the door's tier discipline", async () => {
  const env = { STRIPE_SECRET_KEY: "sk_test_double" };
  for (const tier of ["spark-free", "agent-byo"]) {
    const out = await createCheckoutSession({
      env, transport: noTransport, tier, keeper: "keeper-1",
      successUrl: "https://codexofreality.org/ok",
      cancelUrl: "https://codexofreality.org/no",
    });
    assert.equal(out.reason, "tier-never-sold", tier);
  }
  const unpriced = await createCheckoutSession({
    env, transport: noTransport, tier: "connected", keeper: "keeper-1",
    successUrl: "https://codexofreality.org/ok",
    cancelUrl: "https://codexofreality.org/no",
  });
  assert.equal(unpriced.reason, "stripe-price-not-set");
  assert.deepEqual(Object.keys(CHARGEABLE_TIERS), ["connected", "agent-hosted"]);
});

test("a tier checkout asks one session for card and Cash App Pay", async () => {
  const capture = {};
  const env = {
    STRIPE_SECRET_KEY: "sk_test_double",
    STRIPE_PRICE_CONNECTED: "price_connected_double",
  };
  const out = await createCheckoutSession({
    env, transport: recordingTransport(capture), tier: "connected",
    keeper: "keeper-1",
    successUrl: "https://codexofreality.org/ok",
    cancelUrl: "https://codexofreality.org/no",
  });
  assert.equal(out.ok, true);
  const form = new URLSearchParams(capture.options.body);
  assert.equal(form.get("payment_method_types[0]"), "card");
  assert.equal(form.get("payment_method_types[1]"), "cashapp");
  assert.equal(form.get("line_items[0][price]"), "price_connected_double");
  assert.equal(form.get("metadata[keeper]"), "keeper-1");
  assert.equal(form.get("metadata[tier]"), "connected");
});

test("the grant shape is the door's one shape, rail named by the session", () => {
  const event = {
    type: "checkout.session.completed",
    data: { object: {
      payment_status: "paid",
      payment_method_types: ["card", "cashapp"],
      metadata: { keeper: "keeper-1", tier: "agent-hosted" },
    } },
  };
  const out = grantFromCheckoutCompleted(event, "2026-11-24T00:00:00.000Z");
  assert.equal(out.ok, true);
  assert.deepEqual(Object.keys(out.grant), [
    "keeper", "tier", "how", "rail", "grantedBy",
    "grantedAt", "capMicroUsd", "revokedAt",
  ]);
  assert.equal(out.grant.rail, "stripe-card");
  const cashOnly = grantFromCheckoutCompleted({
    type: "checkout.session.completed",
    data: { object: {
      payment_status: "paid",
      payment_method_types: ["cashapp"],
      metadata: { keeper: "keeper-1", tier: "connected" },
    } },
  }, "2026-11-24T00:00:00.000Z");
  assert.equal(cashOnly.grant.rail, "cash-app-pay");
  const unpaid = grantFromCheckoutCompleted({
    type: "checkout.session.completed",
    data: { object: {
      payment_status: "unpaid",
      payment_method_types: ["card"],
      metadata: { keeper: "keeper-1", tier: "connected" },
    } },
  }, "2026-11-24T00:00:00.000Z");
  assert.equal(unpaid.ok, false);
});

test("the shop shelf sells only its standard pieces, by name", async () => {
  const env = { STRIPE_SECRET_KEY: "sk_test_double" };
  assert.deepEqual(Object.keys(SHOP_ITEMS),
    ["tensor-band", "tensor-band-pair"]);
  const oneOfOne = await createShopCheckout({
    env, transport: noTransport, item: "covenant-band-green-tide",
    successUrl: "https://codexofreality.org/shop.html?order=placed",
    cancelUrl: "https://codexofreality.org/shop.html?order=cancelled",
    siteOrigin: "https://codexofreality.org",
  });
  assert.equal(oneOfOne.ok, false);
  assert.equal(oneOfOne.reason, "item-never-sold");
  assert.match(oneOfOne.words, /forge conversation/);
  const unpriced = await createShopCheckout({
    env, transport: noTransport, item: "tensor-band",
    successUrl: "https://codexofreality.org/shop.html?order=placed",
    cancelUrl: "https://codexofreality.org/shop.html?order=cancelled",
    siteOrigin: "https://codexofreality.org",
  });
  assert.equal(unpriced.reason, "stripe-price-not-set");
});

test("a shop checkout: payment mode, both rails, price from the environment only", async () => {
  const capture = {};
  const env = {
    STRIPE_SECRET_KEY: "sk_test_double",
    STRIPE_PRICE_TENSOR_BAND_PAIR: "price_pair_double",
  };
  const out = await createShopCheckout({
    env, transport: recordingTransport(capture), item: "tensor-band-pair",
    successUrl: "https://codexofreality.org/shop.html?order=placed",
    cancelUrl: "https://codexofreality.org/shop.html?order=cancelled",
    siteOrigin: "https://codexofreality.org",
  });
  assert.equal(out.ok, true);
  const form = new URLSearchParams(capture.options.body);
  assert.equal(form.get("mode"), "payment");
  assert.equal(form.get("payment_method_types[0]"), "card");
  assert.equal(form.get("payment_method_types[1]"), "cashapp");
  assert.equal(form.get("line_items[0][price]"), "price_pair_double");
  assert.equal(form.get("metadata[item]"), "tensor-band-pair");
  const offSite = await createShopCheckout({
    env, transport: noTransport, item: "tensor-band-pair",
    successUrl: "https://elsewhere.example/ok",
    cancelUrl: "https://codexofreality.org/shop.html?order=cancelled",
    siteOrigin: "https://codexofreality.org",
  });
  assert.equal(offSite.reason, "return-url-not-the-sites");
});

test("a webhook is believed only behind a verified signature", () => {
  const secret = "whsec_double";
  const env = { STRIPE_WEBHOOK_SECRET: secret };
  const nowSec = Math.floor(Date.now() / 1000);
  const event = {
    type: "checkout.session.completed",
    data: { object: {
      id: "cs_test_1", payment_status: "paid",
      payment_method_types: ["card"],
      amount_total: 8888, currency: "usd",
      metadata: { item: "tensor-band-pair" },
    } },
  };
  const rawBody = JSON.stringify(event);
  const good = verifyWebhook({
    env, rawBody, signatureHeader: signedHeader(secret, rawBody, nowSec),
    nowSeconds: nowSec,
  });
  assert.equal(good.ok, true);
  const resolved = orderFromCheckoutCompleted(JSON.parse(rawBody),
    "2026-11-24T00:00:00.000Z");
  assert.equal(resolved.ok, true);
  assert.equal(resolved.order.item, "tensor-band-pair");
  assert.equal(resolved.order.amountTotalCents, 8888);
  assert.equal(resolved.order.rail, "stripe-card");
  const forged = verifyWebhook({
    env, rawBody, nowSeconds: nowSec,
    signatureHeader: signedHeader("whsec_other", rawBody, nowSec),
  });
  assert.equal(forged.ok, false);
  const stale = verifyWebhook({
    env, rawBody, nowSeconds: nowSec,
    signatureHeader: signedHeader(secret, rawBody, nowSec - 3600),
  });
  assert.equal(stale.reason, "signature-stale");
  const noSecret = verifyWebhook({
    env: {}, rawBody, signatureHeader: "t=1,v1=abc", nowSeconds: nowSec,
  });
  assert.equal(noSecret.reason, "stripe-not-connected");
});
