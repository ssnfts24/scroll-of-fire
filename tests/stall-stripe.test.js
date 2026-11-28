/*
 * The Spark Stall's Stripe road — Nov 27, 2026.
 *
 * What is proven, all against the REAL catalogue
 * (docs/assets/data/spark-goods.json, read from disk),
 * injected environment names, a double transport and
 * a memory order store — no key, no network:
 *
 * the till is DARK and refuses plainly while Aaron
 * has not connected Stripe; the probe reports the
 * catalogue's own shape (65 goods, 63 the road may
 * sell); a session payload is built for EVERY priced
 * good in the book and every amount matches the
 * catalogue's own price, in cents, with the good's
 * own name as the product name; the two earned goods
 * are refused by name, here and everywhere; the
 * session carries the item id and the keeper's Spark
 * passport code in its metadata; return addresses
 * must be the site's own; a webhook event is believed
 * only behind a verified signature (a bad signature
 * is rejected, a stale one too); a paid, completed
 * checkout whose amount matches the catalogue is
 * recorded as an order, once, under its session id;
 * a paid session whose amount does NOT match the
 * catalogue records nothing; and fulfilment reads the
 * record back — or, when the webhook has not landed
 * yet, asks Stripe for the session and records it
 * through the same law.
 *
 * THE FAILURE SIDE (Nov 27, 2026, Aaron's word: "add
 * in tests for failed purchases etc."): unpaid endings
 * (expired, async-failed, completed-but-unpaid) record
 * nothing and cannot be fulfilled; a failure followed
 * by a success leaves exactly one order, from the
 * success; replayed and redelivered webhooks still
 * record exactly once; the cancel road writes nothing
 * on the keeper's device; checkout-time failures (an
 * API error, a session with no URL, a transport that
 * throws) answer plainly and leave the till untouched;
 * a valid signature does not let a passport carry a
 * wrong amount past the catalogue check; broken shapes
 * (missing item, unknown item, malformed session id)
 * record nothing; and a store that fails mid-record
 * heals its index on redelivery, so no order is ever
 * left half-written.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";

import {
  MemoryOrderStore, buildSessionForm, createStallCheckout,
  fulfilStallOrder, orderFromStallCheckoutCompleted, readOrder,
  recordOrder, stallConfig, verifyWebhook,
} from "../netlify/functions/lib/stall-core.mjs";

const catalogue = JSON.parse(fs.readFileSync(
  new URL("../docs/assets/data/spark-goods.json", import.meta.url), "utf8"));

const SECRET = "sk_test_double";
const WHSEC = "whsec_test_double";
const NOW = 1_800_000_000;

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

const OK_URLS = {
  successUrl: "https://codexofreality.org/companions.html?order=placed&session_id={CHECKOUT_SESSION_ID}",
  cancelUrl: "https://codexofreality.org/companions.html?order=cancelled",
  siteOrigin: "https://codexofreality.org",
};

function completedEvent(item, amountCents, extra = {}) {
  return {
    type: "checkout.session.completed",
    data: {
      object: {
        id: extra.id || "cs_test_9",
        payment_status: "paid",
        amount_total: amountCents,
        currency: "usd",
        payment_method_types: ["card", "cashapp"],
        metadata: { item, ...(extra.passport ? { passport: extra.passport } : {}) },
      },
    },
  };
}

test("the catalogue stands as the price book: 65 goods, 63 sellable, 2 earned", () => {
  assert.equal(catalogue.items.length, 65);
  const config = stallConfig({}, catalogue);
  assert.equal(config.catalogueSize, 65);
  assert.equal(config.sellable, 63);
  const earned = catalogue.items.filter(
    (it) => it.rarity && it.rarity.type === "earned-only");
  assert.equal(earned.length, 2);
  for (const it of earned) assert.equal(it.price, null);
});

test("dark till: with no environment, the stall refuses plainly", async () => {
  const config = stallConfig({}, catalogue);
  assert.equal(config.connected, false);
  assert.equal(config.webhook, false);
  const out = await createStallCheckout({
    env: {}, transport: noTransport, catalogue,
    item: "the-wayfarers-lantern", ...OK_URLS,
  });
  assert.equal(out.ok, false);
  assert.equal(out.reason, "stripe-not-connected");
  assert.match(out.words, /Stripe is not connected/);
  const verdict = verifyWebhook({
    env: {}, rawBody: "{}", signatureHeader: "t=1,v1=abc", nowSeconds: NOW,
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, "stripe-not-connected");
});

test("the probe lights by names alone: key present, webhook present", () => {
  const config = stallConfig(
    { STRIPE_SECRET_KEY: SECRET, STRIPE_WEBHOOK_SECRET: WHSEC }, catalogue);
  assert.equal(config.connected, true);
  assert.equal(config.webhook, true);
});

test("a session payload is built for every priced good, amounts exact", () => {
  let built = 0;
  for (const item of catalogue.items) {
    const out = buildSessionForm({
      catalogue, item: item.id, passport: "SPK1-8-217-1-IUEBK69Z-SELOR-8I",
      successUrl: OK_URLS.successUrl, cancelUrl: OK_URLS.cancelUrl,
    });
    if (item.rarity && item.rarity.type === "earned-only") {
      assert.equal(out.ok, false, item.id);
      assert.equal(out.reason, "item-earned-never-sold", item.id);
      continue;
    }
    assert.equal(out.ok, true, item.id);
    const form = out.form;
    assert.equal(form.get("mode"), "payment");
    assert.equal(form.get("payment_method_types[0]"), "card");
    assert.equal(form.get("payment_method_types[1]"), "cashapp");
    assert.equal(form.get("line_items[0][price_data][currency]"), "usd");
    assert.equal(form.get("line_items[0][price_data][product_data][name]"), item.name);
    assert.equal(form.get("line_items[0][price_data][unit_amount]"),
      String(Math.round(item.price * 100)), item.id);
    assert.equal(form.get("line_items[0][quantity]"), "1");
    assert.equal(form.get("metadata[item]"), item.id);
    assert.equal(form.get("metadata[passport]"), "SPK1-8-217-1-IUEBK69Z-SELOR-8I");
    built++;
  }
  assert.equal(built, 63);
});

test("the earned goods and unknown goods are refused by name at checkout", async () => {
  const env = { STRIPE_SECRET_KEY: SECRET };
  for (const [item, reason] of [
    ["episode-hums---the-first-shelf", "item-earned-never-sold"],
    ["the-moon-hum-repertoire", "item-earned-never-sold"],
    ["the-spark-itself", "item-unknown"],
    ["no-such-good", "item-unknown"],
  ]) {
    const out = await createStallCheckout({
      env, transport: noTransport, catalogue, item, ...OK_URLS,
    });
    assert.equal(out.ok, false, item);
    assert.equal(out.reason, reason, item);
  }
});

test("a malformed passport is never carried; a sound one is", () => {
  const bad = buildSessionForm({
    catalogue, item: "the-wayfarers-lantern", passport: "not a passport",
    successUrl: OK_URLS.successUrl, cancelUrl: OK_URLS.cancelUrl,
  });
  assert.equal(bad.ok, true);
  assert.equal(bad.form.get("metadata[passport]"), null);
});

test("checkout posts the catalogue's form to Stripe and answers its URL", async () => {
  const capture = {};
  const out = await createStallCheckout({
    env: { STRIPE_SECRET_KEY: SECRET }, transport: recordingTransport(capture),
    catalogue, item: "the-wayfarers-lantern",
    passport: "SPK1-8-217-1-IUEBK69Z-SELOR-8I", ...OK_URLS,
  });
  assert.equal(out.ok, true);
  assert.equal(out.url, "https://checkout.stripe.com/c/cs_test_1");
  assert.equal(capture.url, "https://api.stripe.com/v1/checkout/sessions");
  assert.equal(capture.options.headers.authorization, `Bearer ${SECRET}`);
  const sent = new URLSearchParams(capture.options.body);
  assert.equal(sent.get("line_items[0][price_data][unit_amount]"), "700");
});

test("return addresses must be the site's own", async () => {
  const out = await createStallCheckout({
    env: { STRIPE_SECRET_KEY: SECRET }, transport: noTransport, catalogue,
    item: "the-wayfarers-lantern",
    successUrl: "https://elsewhere.example/ok",
    cancelUrl: OK_URLS.cancelUrl, siteOrigin: OK_URLS.siteOrigin,
  });
  assert.equal(out.ok, false);
  assert.equal(out.reason, "return-url-not-the-sites");
});

test("the webhook is believed only behind a verified signature", () => {
  const env = { STRIPE_WEBHOOK_SECRET: WHSEC };
  const raw = JSON.stringify(completedEvent("the-wayfarers-lantern", 700));
  const good = verifyWebhook({
    env, rawBody: raw, signatureHeader: signedHeader(WHSEC, raw, NOW), nowSeconds: NOW,
  });
  assert.equal(good.ok, true);
  const forged = verifyWebhook({
    env, rawBody: raw, signatureHeader: signedHeader("whsec_forged", raw, NOW), nowSeconds: NOW,
  });
  assert.equal(forged.ok, false);
  assert.equal(forged.reason, "signature-mismatch");
  const stale = verifyWebhook({
    env, rawBody: raw, signatureHeader: signedHeader(WHSEC, raw, NOW - 3600), nowSeconds: NOW,
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, "signature-stale");
  const tampered = verifyWebhook({
    env, rawBody: raw + " ", signatureHeader: signedHeader(WHSEC, raw, NOW), nowSeconds: NOW,
  });
  assert.equal(tampered.ok, false);
});

test("a paid, matching checkout is recorded once, under its session id", async () => {
  const store = new MemoryOrderStore();
  const event = completedEvent("the-wayfarers-lantern", 700,
    { passport: "SPK1-8-217-1-IUEBK69Z-SELOR-8I" });
  const resolved = orderFromStallCheckoutCompleted(
    event, catalogue, "2026-11-27T21:00:00.000Z");
  assert.equal(resolved.ok, true);
  assert.equal(resolved.order.item, "the-wayfarers-lantern");
  assert.equal(resolved.order.name, "The Wayfarer's Lantern");
  assert.equal(resolved.order.passport, "SPK1-8-217-1-IUEBK69Z-SELOR-8I");
  assert.equal(resolved.order.amountTotalCents, 700);
  const first = await recordOrder(store, resolved.order);
  assert.equal(first.ok, true);
  assert.equal(first.already, false);
  const second = await recordOrder(store, resolved.order);
  assert.equal(second.ok, true);
  assert.equal(second.already, true);
  const read = await readOrder(store, "cs_test_9");
  assert.equal(read.item, "the-wayfarers-lantern");
});

test("a paid session whose amount is not the catalogue's records nothing", () => {
  for (const bad of [
    completedEvent("the-wayfarers-lantern", 701),
    completedEvent("the-wayfarers-lantern", 200),
    { ...completedEvent("the-wayfarers-lantern", 700),
      data: { object: { ...completedEvent("the-wayfarers-lantern", 700).data.object, currency: "eur" } } },
  ]) {
    const out = orderFromStallCheckoutCompleted(bad, catalogue, "2026-11-27T21:00:00.000Z");
    assert.equal(out.ok, false);
    assert.equal(out.reason, "order-amount-mismatch");
  }
  const unpaid = completedEvent("the-wayfarers-lantern", 700);
  unpaid.data.object.payment_status = "unpaid";
  assert.equal(orderFromStallCheckoutCompleted(unpaid, catalogue, "").reason,
    "checkout-not-paid");
  const earned = orderFromStallCheckoutCompleted(
    completedEvent("episode-hums---the-first-shelf", 0), catalogue, "");
  assert.equal(earned.ok, false);
  assert.equal(earned.reason, "order-shape-incomplete");
});

test("fulfilment reads the record, and heals its own race from Stripe", async () => {
  const env = { STRIPE_SECRET_KEY: SECRET, STRIPE_WEBHOOK_SECRET: WHSEC };
  const store = new MemoryOrderStore();
  // the webhook has not landed: fulfilment asks Stripe, records, answers
  const stripeSession = completedEvent("the-wayfarers-lantern", 700).data.object;
  const healed = await fulfilStallOrder({
    env, store, catalogue, sessionId: "cs_test_9",
    atIso: "2026-11-27T21:05:00.000Z",
    transport: async (url, options) => {
      assert.match(url, /\/v1\/checkout\/sessions\/cs_test_9$/);
      assert.equal(options.headers.authorization, `Bearer ${SECRET}`);
      return { status: 200, json: stripeSession };
    },
  });
  assert.equal(healed.ok, true);
  assert.equal(healed.source, "stripe");
  assert.equal(healed.order.item, "the-wayfarers-lantern");
  // now the record stands: a second read never touches the transport
  const again = await fulfilStallOrder({
    env, store, catalogue, sessionId: "cs_test_9", transport: noTransport,
    atIso: "2026-11-27T21:06:00.000Z",
  });
  assert.equal(again.ok, true);
  assert.equal(again.source, "record");
  // a session id that is not a session id is refused before any lookup
  const malformed = await fulfilStallOrder({
    env, store, catalogue, sessionId: "../../etc", transport: noTransport, atIso: "",
  });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.reason, "session-id-malformed");
  // an unknown session at Stripe answers plainly, records nothing
  const missing = await fulfilStallOrder({
    env, store, catalogue, sessionId: "cs_test_absent", atIso: "",
    transport: async () => ({ status: 404, json: null }),
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, "order-not-recorded-yet");
  assert.equal(await readOrder(store, "cs_test_absent"), null);
});

/* ------------------------------------------------------------------ */
/* The failure side — failed purchases and everything that can go      */
/* wrong around them (Nov 27, 2026).                                   */
/* ------------------------------------------------------------------ */

/* The webhook road composed exactly as stall.mjs walks it: verify
 * the signature over the raw body, resolve the event, record only
 * a resolved order. Returns what the road did, so a proof can say
 * plainly whether anything was written. */
async function deliverWebhook(store, event, atSec = NOW) {
  const raw = JSON.stringify(event);
  const verdict = verifyWebhook({
    env: { STRIPE_WEBHOOK_SECRET: WHSEC }, rawBody: raw,
    signatureHeader: signedHeader(WHSEC, raw, atSec), nowSeconds: atSec,
  });
  assert.equal(verdict.ok, true, "the event is properly signed");
  const resolved = orderFromStallCheckoutCompleted(
    event, catalogue, "2026-11-27T22:00:00.000Z");
  if (!resolved.ok) return { recorded: false, reason: resolved.reason };
  const recorded = await recordOrder(store, resolved.order);
  return {
    recorded: recorded.ok, already: !!recorded.already,
    reason: recorded.reason,
  };
}

function unpaidSession(extra = {}) {
  return {
    id: "cs_test_fail",
    payment_status: "unpaid",
    status: "open",
    amount_total: 700,
    currency: "usd",
    payment_method_types: ["card", "cashapp"],
    metadata: { item: "the-wayfarers-lantern" },
    ...extra,
  };
}

const ofType = (type, object) => ({ type, data: { object } });

test("unpaid endings record nothing: expired, async-failed, completed-but-unpaid", async () => {
  const store = new MemoryOrderStore();
  const expired = await deliverWebhook(store, ofType(
    "checkout.session.expired",
    unpaidSession({ status: "expired" })));
  assert.equal(expired.recorded, false);
  assert.equal(expired.reason, "event-not-a-completed-checkout");
  const asyncFailed = await deliverWebhook(store, ofType(
    "checkout.session.async_payment_failed",
    unpaidSession({ status: "complete" })));
  assert.equal(asyncFailed.recorded, false);
  assert.equal(asyncFailed.reason, "event-not-a-completed-checkout");
  const completedUnpaid = await deliverWebhook(store, ofType(
    "checkout.session.completed", unpaidSession({ status: "complete" })));
  assert.equal(completedUnpaid.recorded, false);
  assert.equal(completedUnpaid.reason, "checkout-not-paid");
  // nothing stands in the store: no order, no index entry
  assert.equal(store.values.size, 0);
  assert.equal(await readOrder(store, "cs_test_fail"), null);
});

test("fulfilment refuses sessions Stripe reports unpaid, open, or expired", async () => {
  const env = { STRIPE_SECRET_KEY: SECRET };
  const store = new MemoryOrderStore();
  for (const session of [
    unpaidSession({ status: "open" }),
    unpaidSession({ status: "expired" }),
    unpaidSession({ status: "complete" }), // async payment failed
  ]) {
    const out = await fulfilStallOrder({
      env, store, catalogue, sessionId: session.id, atIso: "",
      transport: async () => ({ status: 200, json: session }),
    });
    assert.equal(out.ok, false, session.status);
    assert.equal(out.reason, "checkout-not-paid", session.status);
  }
  assert.equal(store.values.size, 0);
});

test("a failed attempt, then a success, leaves exactly one order — the success", async () => {
  const env = { STRIPE_SECRET_KEY: SECRET };
  const store = new MemoryOrderStore();
  const failed = await deliverWebhook(store, ofType(
    "checkout.session.expired",
    unpaidSession({ id: "cs_test_fail", status: "expired" })));
  assert.equal(failed.recorded, false);
  // the keeper returns and tries again, and pays
  const won = await deliverWebhook(store,
    completedEvent("the-wayfarers-lantern", 700, { id: "cs_test_win" }));
  assert.equal(won.recorded, true);
  assert.deepEqual(await store.get("index"), ["cs_test_win"]);
  const order = await readOrder(store, "cs_test_win");
  assert.equal(order.item, "the-wayfarers-lantern");
  // and the failed session can never be fulfilled after the fact
  const zombie = await fulfilStallOrder({
    env, store, catalogue, sessionId: "cs_test_fail", atIso: "",
    transport: async () => ({
      status: 200, json: unpaidSession({ status: "expired" }),
    }),
  });
  assert.equal(zombie.ok, false);
  assert.equal(zombie.reason, "checkout-not-paid");
  assert.equal(await readOrder(store, "cs_test_fail"), null);
});

test("replayed and redelivered webhooks still record exactly once", async () => {
  const store = new MemoryOrderStore();
  const eventA = completedEvent("the-wayfarers-lantern", 700, { id: "cs_test_a" });
  const first = await deliverWebhook(store, eventA);
  assert.equal(first.recorded, true);
  assert.equal(first.already, false);
  // the same event delivered a second time (Stripe retries)
  const replay = await deliverWebhook(store, eventA);
  assert.equal(replay.recorded, true);
  assert.equal(replay.already, true);
  // a second, later purchase of another priced good
  const other = catalogue.items.find((it) => it.id !== "the-wayfarers-lantern"
    && !(it.rarity && it.rarity.type === "earned-only")
    && typeof it.price === "number" && it.price > 0);
  const eventB = completedEvent(other.id, Math.round(other.price * 100),
    { id: "cs_test_b" });
  const second = await deliverWebhook(store, eventB);
  assert.equal(second.recorded, true);
  // the OLDER event redelivered after the newer one landed
  const lateReplay = await deliverWebhook(store, eventA);
  assert.equal(lateReplay.already, true);
  assert.deepEqual(await store.get("index"), ["cs_test_a", "cs_test_b"]);
  assert.equal((await readOrder(store, "cs_test_a")).item,
    "the-wayfarers-lantern");
  assert.equal((await readOrder(store, "cs_test_b")).item, other.id);
});

test("the cancel road writes nothing on the device and says nothing was charged", () => {
  const source = fs.readFileSync(new URL(
    "../docs/assets/js/spark-stall-checkout.js", import.meta.url), "utf8");
  const writes = [];
  const fetches = [];
  const created = [];
  const fakeElement = () => ({
    className: "", innerHTML: "", textContent: "", style: {},
    children: [],
    setAttribute() {},
    appendChild(child) { this.children.push(child); return child; },
    insertBefore(child) { this.children.push(child); return child; },
    addEventListener() {},
    querySelector() { return null; },
  });
  const section = fakeElement();
  const sandbox = {
    console,
    URLSearchParams,
    fetch: (...args) => {
      fetches.push(args);
      return Promise.reject(new Error("must not be called"));
    },
    document: {
      getElementById: (id) => (id === "spark-stall" ? section : null),
      createElement: () => {
        const el = fakeElement();
        created.push(el);
        return el;
      },
    },
    window: {
      location: {
        search: "?order=cancelled",
        origin: "https://codexofreality.org",
        assign() {},
      },
      localStorage: {
        getItem: () => null,
        setItem: (key, value) => writes.push([key, value]),
      },
    },
  };
  sandbox.window.document = sandbox.document;
  vm.runInNewContext(source, sandbox);
  // the cancelled standing is spoken, plainly
  assert.match(created[0].innerHTML, /Checkout was left unfinished/);
  assert.match(created[0].innerHTML, /nothing was charged/);
  // nothing written to the goods shelf, no fulfilment asked for
  assert.deepEqual(writes, []);
  assert.deepEqual(fetches, []);
});

test("checkout-time failures answer plainly and leave the till untouched", async () => {
  const env = { STRIPE_SECRET_KEY: SECRET };
  // Stripe answers an error
  const apiError = await createStallCheckout({
    env, catalogue, item: "the-wayfarers-lantern", ...OK_URLS,
    transport: async () => ({
      status: 500, json: { error: { message: "boom" } },
    }),
  });
  assert.equal(apiError.ok, false);
  assert.equal(apiError.reason, "stripe-session-failed");
  assert.match(apiError.words, /Nothing was charged/);
  // Stripe answers 200 but no hosted URL — nothing to send the keeper to
  const noUrl = await createStallCheckout({
    env, catalogue, item: "the-wayfarers-lantern", ...OK_URLS,
    transport: async () => ({ status: 200, json: { id: "cs_test_1" } }),
  });
  assert.equal(noUrl.ok, false);
  assert.equal(noUrl.reason, "stripe-session-failed");
  // the road itself fails: the transport throws (a network failure)
  const thrown = await createStallCheckout({
    env, catalogue, item: "the-wayfarers-lantern", ...OK_URLS,
    transport: async () => { throw new Error("network down"); },
  });
  assert.equal(thrown.ok, false);
  assert.equal(thrown.reason, "stripe-session-failed");
  assert.match(thrown.words, /Nothing was charged/);
  // a foreign CANCEL address is refused, as a foreign success one is
  const foreignCancel = await createStallCheckout({
    env, transport: noTransport, catalogue, item: "the-wayfarers-lantern",
    successUrl: OK_URLS.successUrl,
    cancelUrl: "https://elsewhere.example/no",
    siteOrigin: OK_URLS.siteOrigin,
  });
  assert.equal(foreignCancel.ok, false);
  assert.equal(foreignCancel.reason, "return-url-not-the-sites");
  // re-pinned beside the failures: unknown and earned goods refuse
  for (const [item, reason] of [
    ["no-such-good", "item-unknown"],
    ["the-moon-hum-repertoire", "item-earned-never-sold"],
  ]) {
    const out = await createStallCheckout({
      env, transport: noTransport, catalogue, item, ...OK_URLS,
    });
    assert.equal(out.ok, false, item);
    assert.equal(out.reason, reason, item);
  }
  // the till itself is untouched: the probe still reads connected,
  // and the next honest checkout opens as it always did
  assert.equal(stallConfig(env, catalogue).connected, true);
  const capture = {};
  const after = await createStallCheckout({
    env, transport: recordingTransport(capture), catalogue,
    item: "the-wayfarers-lantern", ...OK_URLS,
  });
  assert.equal(after.ok, true);
  assert.equal(after.url, "https://checkout.stripe.com/c/cs_test_1");
});

test("fulfilment answers plainly when the road to Stripe fails", async () => {
  const out = await fulfilStallOrder({
    env: { STRIPE_SECRET_KEY: SECRET }, store: new MemoryOrderStore(),
    catalogue, sessionId: "cs_test_9", atIso: "",
    transport: async () => { throw new Error("network down"); },
  });
  assert.equal(out.ok, false);
  assert.equal(out.reason, "order-not-recorded-yet");
});

test("a valid signature does not let a passport carry a wrong amount", async () => {
  const store = new MemoryOrderStore();
  const passport = "SPK1-8-217-1-IUEBK69Z-SELOR-8I";
  const wrongAmount = await deliverWebhook(store, completedEvent(
    "the-wayfarers-lantern", 701, { id: "cs_test_p1", passport }));
  assert.equal(wrongAmount.recorded, false);
  assert.equal(wrongAmount.reason, "order-amount-mismatch");
  const wrongCurrency = completedEvent(
    "the-wayfarers-lantern", 700, { id: "cs_test_p2", passport });
  wrongCurrency.data.object.currency = "eur";
  const eur = await deliverWebhook(store, wrongCurrency);
  assert.equal(eur.recorded, false);
  assert.equal(eur.reason, "order-amount-mismatch");
  assert.equal(store.values.size, 0);
  // the control: the same passport with the catalogue's own amount
  // records, and the passport rides the order as it should
  const right = await deliverWebhook(store, completedEvent(
    "the-wayfarers-lantern", 700, { id: "cs_test_p3", passport }));
  assert.equal(right.recorded, true);
  assert.equal((await readOrder(store, "cs_test_p3")).passport, passport);
});

test("broken shapes record nothing: missing item, unknown item, malformed session", async () => {
  const store = new MemoryOrderStore();
  const noMetadata = completedEvent("the-wayfarers-lantern", 700,
    { id: "cs_test_s1" });
  delete noMetadata.data.object.metadata;
  const unknownItem = completedEvent("no-such-good", 700, { id: "cs_test_s2" });
  const emptyMetadata = completedEvent("the-wayfarers-lantern", 700,
    { id: "cs_test_s3" });
  emptyMetadata.data.object.metadata = {};
  for (const event of [noMetadata, unknownItem, emptyMetadata]) {
    const out = await deliverWebhook(store, event);
    assert.equal(out.recorded, false);
    assert.equal(out.reason, "order-shape-incomplete");
  }
  assert.equal(store.values.size, 0);
  // an order with no lawful session id is refused at the store door
  const shapeless = await recordOrder(store, {
    item: "the-wayfarers-lantern", sessionId: "not-a-session",
  });
  assert.equal(shapeless.ok, false);
  assert.equal(shapeless.reason, "order-shape-incomplete");
  // and fulfilment through a Stripe session with no metadata
  // records nothing either
  const healed = await fulfilStallOrder({
    env: { STRIPE_SECRET_KEY: SECRET }, store, catalogue,
    sessionId: "cs_test_s4", atIso: "",
    transport: async () => ({
      status: 200,
      json: { ...unpaidSession({ id: "cs_test_s4" }),
        payment_status: "paid", status: "complete", metadata: {} },
    }),
  });
  assert.equal(healed.ok, false);
  assert.equal(healed.reason, "order-shape-incomplete");
  assert.equal(await readOrder(store, "cs_test_s4"), null);
});

test("a store that fails mid-record heals its index on redelivery", async () => {
  const inner = new MemoryOrderStore();
  const flaky = {
    failed: false,
    async get(key) { return inner.get(key); },
    async set(key, value) {
      if (key === "index" && !this.failed) {
        this.failed = true;
        throw new Error("store write failed");
      }
      return inner.set(key, value);
    },
  };
  const resolved = orderFromStallCheckoutCompleted(
    completedEvent("the-wayfarers-lantern", 700, { id: "cs_test_heal" }),
    catalogue, "2026-11-27T22:00:00.000Z");
  assert.equal(resolved.ok, true);
  // the first write dies between the order and the index: the order
  // stands, the index does not — the half-state Stripe's retry must heal
  await assert.rejects(recordOrder(flaky, resolved.order));
  assert.equal((await readOrder(inner, "cs_test_heal")).item,
    "the-wayfarers-lantern");
  assert.equal(await inner.get("index"), null);
  // Stripe redelivers; the record is already there, and the retry
  // leaves the store whole: order present, index naming it once
  const retry = await recordOrder(flaky, resolved.order);
  assert.equal(retry.ok, true);
  assert.equal(retry.already, true);
  assert.deepEqual(await inner.get("index"), ["cs_test_heal"]);
});
