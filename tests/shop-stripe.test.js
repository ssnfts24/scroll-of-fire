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
 * payment, with the price taken from the shelf's own
 * record (payments sweep, Nov 27, 2026 — inline
 * price_data, never a dashboard price ID); return
 * addresses must be the site's own; a webhook event
 * is believed only behind a verified signature under
 * its OWN function's secret; and an order record is
 * born only from a paid, completed checkout whose
 * amount matches the record.
 *
 * The sweep's rules are pinned here too: no probe
 * lights on the key alone (each surface's charging
 * needs its whole road, and the dark answer names
 * the first missing piece); each function verifies
 * webhooks under its own secret and no other's; and
 * a paid session for the wrong amount records
 * nothing.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import {
  CHARGEABLE_TIERS, DOOR_WEBHOOK_SECRET_ENV,
  grantFromCheckoutCompleted,
  stripeConfig, createCheckoutSession,
} from "../netlify/functions/lib/stripe-core.mjs";
import {
  SHOP_ENV, SHOP_ITEMS, buildShopSessionForm, createShopCheckout,
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
    [DOOR_WEBHOOK_SECRET_ENV]: "whsec_door_double",
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
  /* The shelf's prices live in its own record now —
   * what a key-only till refuses is the missing order
   * line: the shop's own webhook secret. */
  const noOrderLine = await createShopCheckout({
    env, transport: noTransport, item: "tensor-band",
    successUrl: "https://codexofreality.org/shop.html?order=placed",
    cancelUrl: "https://codexofreality.org/shop.html?order=cancelled",
    siteOrigin: "https://codexofreality.org",
  });
  assert.equal(noOrderLine.reason, "stripe-webhook-not-set");
});

test("a shop checkout: payment mode, both rails, price from the shelf's record only", async () => {
  const capture = {};
  const env = {
    STRIPE_SECRET_KEY: "sk_test_double",
    [SHOP_ENV.webhookSecret]: "whsec_shop_double",
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
  /* Inline price_data from the record — no dashboard
   * price ID anywhere in the form. */
  assert.equal(form.get("line_items[0][price]"), null);
  assert.equal(form.get("line_items[0][price_data][currency]"), "usd");
  assert.equal(form.get("line_items[0][price_data][unit_amount]"), "8888");
  assert.equal(form.get("line_items[0][price_data][product_data][name]"),
    "Tensor Band — Pair Forged Together");
  assert.equal(form.get("metadata[item]"), "tensor-band-pair");
  const offSite = await createShopCheckout({
    env, transport: noTransport, item: "tensor-band-pair",
    successUrl: "https://elsewhere.example/ok",
    cancelUrl: "https://codexofreality.org/shop.html?order=cancelled",
    siteOrigin: "https://codexofreality.org",
  });
  assert.equal(offSite.reason, "return-url-not-the-sites");
});

test("the shop session form is built for every shelf piece, amounts exact", () => {
  const expected = { "tensor-band": "4444", "tensor-band-pair": "8888" };
  for (const [item, cents] of Object.entries(expected)) {
    const built = buildShopSessionForm({
      item,
      successUrl: "https://codexofreality.org/shop.html?order=placed",
      cancelUrl: "https://codexofreality.org/shop.html?order=cancelled",
    });
    assert.equal(built.ok, true, item);
    assert.equal(
      built.form.get("line_items[0][price_data][unit_amount]"), cents, item);
    assert.equal(SHOP_ITEMS[item].priceCents, Number(cents), item);
  }
});

test("a webhook is believed only behind a verified signature", () => {
  const secret = "whsec_shop_double";
  const env = { [SHOP_ENV.webhookSecret]: secret };
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
    nowSeconds: nowSec, secretName: SHOP_ENV.webhookSecret,
  });
  assert.equal(good.ok, true);
  const resolved = orderFromCheckoutCompleted(JSON.parse(rawBody),
    "2026-11-24T00:00:00.000Z");
  assert.equal(resolved.ok, true);
  assert.equal(resolved.order.item, "tensor-band-pair");
  assert.equal(resolved.order.amountTotalCents, 8888);
  assert.equal(resolved.order.rail, "stripe-card");
  const forged = verifyWebhook({
    env, rawBody, nowSeconds: nowSec, secretName: SHOP_ENV.webhookSecret,
    signatureHeader: signedHeader("whsec_other", rawBody, nowSec),
  });
  assert.equal(forged.ok, false);
  const stale = verifyWebhook({
    env, rawBody, nowSeconds: nowSec, secretName: SHOP_ENV.webhookSecret,
    signatureHeader: signedHeader(secret, rawBody, nowSec - 3600),
  });
  assert.equal(stale.reason, "signature-stale");
  const noSecret = verifyWebhook({
    env: {}, rawBody, signatureHeader: "t=1,v1=abc", nowSeconds: nowSec,
    secretName: SHOP_ENV.webhookSecret,
  });
  assert.equal(noSecret.reason, "stripe-not-connected");
});

test("each function verifies under its own secret, and no other's", () => {
  const nowSec = Math.floor(Date.now() / 1000);
  const rawBody = JSON.stringify({ type: "checkout.session.completed" });
  const env = {
    STRIPE_WEBHOOK_SECRET: "whsec_stall_double",
    [SHOP_ENV.webhookSecret]: "whsec_shop_double",
    [DOOR_WEBHOOK_SECRET_ENV]: "whsec_door_double",
  };
  /* The stall's secret signs for the stall (the
   * verifier's default name)… */
  assert.equal(verifyWebhook({
    env, rawBody, nowSeconds: nowSec,
    signatureHeader: signedHeader("whsec_stall_double", rawBody, nowSec),
  }).ok, true);
  /* …but never for the shop or the door. */
  for (const name of [SHOP_ENV.webhookSecret, DOOR_WEBHOOK_SECRET_ENV]) {
    assert.equal(verifyWebhook({
      env, rawBody, nowSeconds: nowSec, secretName: name,
      signatureHeader: signedHeader("whsec_stall_double", rawBody, nowSec),
    }).ok, false, name);
    assert.equal(verifyWebhook({
      env, rawBody, nowSeconds: nowSec, secretName: name,
      signatureHeader: signedHeader(
        name === SHOP_ENV.webhookSecret
          ? "whsec_shop_double" : "whsec_door_double", rawBody, nowSec),
    }).ok, true, name);
  }
  /* A surface whose own secret is absent refuses
   * every event, however the others stand. */
  const shopBlind = verifyWebhook({
    env: { STRIPE_WEBHOOK_SECRET: "whsec_stall_double" },
    rawBody, nowSeconds: nowSec, secretName: SHOP_ENV.webhookSecret,
    signatureHeader: signedHeader("whsec_stall_double", rawBody, nowSec),
  });
  assert.equal(shopBlind.reason, "stripe-not-connected");
});

test("no probe lights on the key alone — the whole-road rule", () => {
  /* The door socket: key, then prices, then its own
   * webhook secret; the dark answer names the first
   * missing piece at each step. */
  const key = { STRIPE_SECRET_KEY: "sk_test_double" };
  assert.equal(stripeConfig({}, DOOR_WEBHOOK_SECRET_ENV).charging, false);
  assert.equal(stripeConfig({}, DOOR_WEBHOOK_SECRET_ENV).darkReason,
    "stripe-not-connected");
  assert.equal(stripeConfig(key, DOOR_WEBHOOK_SECRET_ENV).charging, false);
  assert.equal(stripeConfig(key, DOOR_WEBHOOK_SECRET_ENV).darkReason,
    "stripe-webhook-not-set");
  const pricedNoHook = {
    ...key,
    STRIPE_PRICE_CONNECTED: "price_connected_double",
    STRIPE_PRICE_AGENT_HOSTED: "price_agent_double",
  };
  assert.equal(stripeConfig(pricedNoHook, DOOR_WEBHOOK_SECRET_ENV).charging,
    false);
  assert.equal(stripeConfig(pricedNoHook, DOOR_WEBHOOK_SECRET_ENV).darkReason,
    "stripe-webhook-not-set");
  const hookedNoPrices = {
    ...key, [DOOR_WEBHOOK_SECRET_ENV]: "whsec_door_double",
  };
  assert.equal(stripeConfig(hookedNoPrices, DOOR_WEBHOOK_SECRET_ENV).charging,
    false);
  assert.equal(stripeConfig(hookedNoPrices, DOOR_WEBHOOK_SECRET_ENV).darkReason,
    "stripe-price-not-set");
  const wholeRoad = {
    ...pricedNoHook, [DOOR_WEBHOOK_SECRET_ENV]: "whsec_door_double",
  };
  assert.equal(stripeConfig(wholeRoad, DOOR_WEBHOOK_SECRET_ENV).charging, true);
  assert.equal(stripeConfig(wholeRoad, DOOR_WEBHOOK_SECRET_ENV).darkReason, null);
  /* The stall's secret standing in the environment
   * does not light the door: the door reads its own. */
  assert.equal(stripeConfig(
    { ...pricedNoHook, STRIPE_WEBHOOK_SECRET: "whsec_stall_double" },
    DOOR_WEBHOOK_SECRET_ENV).charging, false);

  /* The shop: key + its own secret, or dark. */
  assert.equal(shopConfig({}).charging, false);
  assert.equal(shopConfig(key).charging, false);
  assert.equal(shopConfig(
    { STRIPE_WEBHOOK_SECRET: "whsec_stall_double", ...key }).charging, false);
  assert.equal(shopConfig(
    { ...key, [SHOP_ENV.webhookSecret]: "whsec_shop_double" }).charging, true);
  const items = shopConfig({}).items;
  assert.equal(items["tensor-band"].sellable, true);
  assert.equal(items["tensor-band"].priceCents, 4444);
  assert.equal(items["tensor-band-pair"].priceCents, 8888);
});

test("a tier checkout refuses while the door's own webhook secret is unset", async () => {
  const env = {
    STRIPE_SECRET_KEY: "sk_test_double",
    STRIPE_PRICE_CONNECTED: "price_connected_double",
  };
  const out = await createCheckoutSession({
    env, transport: noTransport, tier: "connected", keeper: "keeper-1",
    successUrl: "https://codexofreality.org/ok",
    cancelUrl: "https://codexofreality.org/no",
  });
  assert.equal(out.ok, false);
  assert.equal(out.reason, "stripe-webhook-not-set");
});

test("a paid shop session for the wrong amount records nothing", () => {
  const base = {
    type: "checkout.session.completed",
    data: { object: {
      id: "cs_test_1", payment_status: "paid",
      payment_method_types: ["card"],
      metadata: { item: "tensor-band" },
    } },
  };
  const wrongAmount = orderFromCheckoutCompleted({
    ...base, data: { object: {
      ...base.data.object, amount_total: 4443, currency: "usd",
    } },
  }, "2026-11-27T00:00:00.000Z");
  assert.equal(wrongAmount.ok, false);
  assert.equal(wrongAmount.reason, "order-amount-mismatch");
  const wrongCurrency = orderFromCheckoutCompleted({
    ...base, data: { object: {
      ...base.data.object, amount_total: 4444, currency: "eur",
    } },
  }, "2026-11-27T00:00:00.000Z");
  assert.equal(wrongCurrency.reason, "order-amount-mismatch");
  const exact = orderFromCheckoutCompleted({
    ...base, data: { object: {
      ...base.data.object, amount_total: 4444, currency: "usd",
    } },
  }, "2026-11-27T00:00:00.000Z");
  assert.equal(exact.ok, true);
  assert.equal(exact.order.amountTotalCents, 4444);
});
