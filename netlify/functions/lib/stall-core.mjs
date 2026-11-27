/* The Spark Stall's Stripe core — the catalogue's own
 * till (Nov 27, 2026), written in the discipline of its
 * two elders: the door's socket (lib/stripe-core.mjs)
 * and the shop shelf (lib/shop-core.mjs). Where they
 * differ is the point:
 *
 * THE SHOP SHELF SELLS BY PRICE ID: its two standard
 * pieces charge whatever Aaron's Stripe says, through
 * price names in his environment. THE STALL SELLS BY
 * THE CATALOGUE: docs/assets/data/spark-goods.json is
 * the one price book (bands $2 / $7 / $19, set in the
 * open), so a stall session is built with inline
 * price_data from the catalogue's own amounts — no
 * dashboard price IDs, nothing for Aaron to create in
 * Stripe beyond the connection itself. If the
 * catalogue's amount and a paid session's amount ever
 * disagree, the order is refused by name below: the
 * catalogue is the truth, Stripe's echo must match it.
 *
 * THE TILL STAYS DARK UNTIL AARON CONNECTS STRIPE.
 * This code holds no key: it reads STRIPE_SECRET_KEY
 * and STRIPE_WEBHOOK_SECRET from the environment,
 * names only, and with them absent every charging
 * path refuses plainly and fails closed — the same
 * law as the socket and the shelf. The catalogue's
 * standing line stays true until then: nothing here
 * can be bought yet, and no price charges anyone.
 *
 * THE CATALOGUE'S OWN FENCES ARE ENFORCED HERE, not
 * merely printed: earned goods are never sold (they
 * carry no price, and asking is refused by name); an
 * item with no price is never sold; the Spark itself
 * is not in the catalogue and can never be asked for.
 * Every session carries the item id — and the Spark's
 * passport code, when the keeper's own page offers it
 * — in its metadata, so a fulfilled order knows what
 * was bought and whose Spark it dresses.
 *
 * ORDERS ARE RECORDED in the store pattern the site
 * already uses (the aiyana-stories pattern: a core
 * over an injected store, Netlify Blobs in production,
 * a memory double in proofs), under the session's own
 * id. The webhook writes them; the keeper's return
 * reads them back to write the good's provenance on
 * the keeper's own device, in the catalogue's lineage
 * shape — the brass tag, written "purchased", forever.
 */

import {
  NOT_CONNECTED_WORDS, STRIPE_ENV, verifyWebhook,
} from "./stripe-core.mjs";

export { NOT_CONNECTED_WORDS, verifyWebhook };

const present = (env, name) =>
  typeof env[name] === "string" && env[name].length > 0;

/** The stall till's standing, read from names alone.
 *  `sellable` counts what the catalogue itself offers
 *  the road: priced, and not earned. */
export function stallConfig(env, catalogue) {
  const items = catalogueItems(catalogue);
  let sellable = 0;
  for (const item of items) if (refusalFor(item) === null) sellable++;
  return {
    connected: present(env, STRIPE_ENV.secretKey),
    webhook: present(env, STRIPE_ENV.webhookSecret),
    sellable,
    catalogueSize: items.length,
  };
}

function catalogueItems(catalogue) {
  return catalogue && Array.isArray(catalogue.items) ? catalogue.items : [];
}

export function catalogueItem(catalogue, id) {
  return catalogueItems(catalogue).find((it) => it && it.id === id) || null;
}

/** Why this item may not be sold by the stall road, or
 *  null when it may. The catalogue's fences, as code:
 *  earned goods are never sold; unpriced goods are
 *  never sold. */
function refusalFor(item) {
  if (!item) return "item-unknown";
  if (item.rarity && item.rarity.type === "earned-only") {
    return "item-earned-never-sold";
  }
  if (typeof item.price !== "number" || !(item.price > 0)) {
    return "item-has-no-price";
  }
  return null;
}

const REFUSAL_WORDS = {
  "item-unknown":
    "That good is not in the catalogue, so it cannot be bought here.",
  "item-earned-never-sold":
    "That good is earned, never sold — it carries no price, ever. " +
    "It comes by living the days, not by paying.",
  "item-has-no-price":
    "That good carries no price in the catalogue, so the till " +
    "cannot sell it.",
};

function refuse(reason) {
  return { ok: false, reason, words: NOT_CONNECTED_WORDS };
}

function refuseItem(reason) {
  return { ok: false, reason, words: REFUSAL_WORDS[reason] || reason };
}

/**
 * The exact form a stall Checkout Session is created
 * with — a pure function of the catalogue row, so a
 * proof can build it for every good in the book and
 * check every amount against the catalogue itself.
 * Inline price_data: the catalogue's dollar amount,
 * in cents, is the charge; the good's own name is the
 * product name Stripe shows. Card AND Cash App Pay in
 * one session, like the socket and the shelf (rails
 * paper, Rails 1–2). Metadata carries the item id,
 * and the Spark's passport code when the keeper's
 * page offered one (a short code, validated in shape
 * here — it is never trusted beyond being carried).
 */
export function buildSessionForm({
  catalogue, item, passport, successUrl, cancelUrl,
}) {
  const row = catalogueItem(catalogue, item);
  const refusal = refusalFor(row);
  if (refusal) return refuseItem(refusal);
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("payment_method_types[0]", "card");
  form.set("payment_method_types[1]", "cashapp");
  form.set("line_items[0][price_data][currency]", "usd");
  form.set("line_items[0][price_data][product_data][name]", row.name);
  form.set("line_items[0][price_data][unit_amount]",
    String(Math.round(row.price * 100)));
  form.set("line_items[0][quantity]", "1");
  form.set("success_url", successUrl);
  form.set("cancel_url", cancelUrl);
  form.set("metadata[item]", row.id);
  if (typeof passport === "string" && /^SPK1-[A-Z0-9-]{4,64}$/.test(passport)) {
    form.set("metadata[passport]", passport);
  }
  return { ok: true, form };
}

/**
 * Creates a Stripe Checkout session for one catalogue
 * good — through the injected transport (the function's
 * real transport is fetch; proofs use a double).
 * Refuses, in order: not connected; a good the
 * catalogue will not sell; a return address that is
 * not the site's own.
 */
export async function createStallCheckout({
  env, transport, catalogue, item, passport,
  successUrl, cancelUrl, siteOrigin,
}) {
  const config = stallConfig(env, catalogue);
  if (!config.connected) return refuse("stripe-not-connected");
  const built = buildSessionForm({
    catalogue, item, passport, successUrl, cancelUrl,
  });
  if (!built.ok) return built;
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
    /* The road itself failed — a network error between here
     * and Stripe. That is the same plain answer as an API
     * error, never an exception thrown at the keeper. */
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
 * event with payment standing paid resolves to a stall
 * order record — the good, whose Spark it dresses, how
 * it arrived, the rail, and what Stripe itself reports
 * was paid. The amount is CHECKED against the
 * catalogue: a paid session whose total is not the
 * catalogue's price for that good, in USD, records
 * nothing and is refused by name. Any other event, or
 * an unpaid session, records nothing.
 */
export function orderFromStallCheckoutCompleted(event, catalogue, atIso) {
  if (!event || event.type !== "checkout.session.completed") {
    return { ok: false, reason: "event-not-a-completed-checkout" };
  }
  const session = event.data && event.data.object;
  if (!session || session.payment_status !== "paid") {
    return { ok: false, reason: "checkout-not-paid" };
  }
  const md = session.metadata || {};
  const row = catalogueItem(catalogue, md.item);
  const refusal = refusalFor(row);
  if (refusal) return { ok: false, reason: "order-shape-incomplete" };
  if (session.currency !== "usd"
      || session.amount_total !== Math.round(row.price * 100)) {
    return { ok: false, reason: "order-amount-mismatch" };
  }
  const methods = session.payment_method_types || [];
  const rail = methods.includes("cashapp") && !methods.includes("card")
    ? "cash-app-pay" : "stripe-card";
  return {
    ok: true,
    order: {
      item: row.id,
      name: row.name,
      passport: typeof md.passport === "string" ? md.passport : "",
      how: "stripe-checkout",
      rail,
      receivedAt: atIso || "",
      sessionId: session.id || "",
      amountTotalCents: session.amount_total,
      currency: session.currency,
    },
  };
}

/* ------------------------------------------------------------------ */
/* The order store — the aiyana-stories pattern: an injected store,    */
/* Netlify Blobs in production, a memory double in proofs.             */
/* ------------------------------------------------------------------ */

const orderKey = (sessionId) => `order:${sessionId}`;
const INDEX_KEY = "index";

export class MemoryOrderStore {
  constructor() { this.values = new Map(); }
  async get(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }
  async set(key, value) { this.values.set(key, value); }
}

export class NetlifyBlobsOrderStore {
  constructor(blobs) { this.blobs = blobs; }
  async get(key) {
    return (await this.blobs.get(key, { type: "json" })) || null;
  }
  async set(key, value) { await this.blobs.setJSON(key, value); }
}

export async function createProductionOrderStore() {
  const blobs = await import("@netlify/blobs");
  const store = blobs.getStore({ name: "spark-stall-orders", consistency: "strong" });
  return new NetlifyBlobsOrderStore(store);
}

const SESSION_ID_SHAPE = /^cs_[A-Za-z0-9_]{6,200}$/;

/** Records a resolved order under its session id.
 *  Idempotent: the same session recorded twice is the
 *  same record, written once. */
export async function recordOrder(store, order) {
  if (!store || !order || !SESSION_ID_SHAPE.test(order.sessionId || "")) {
    return { ok: false, reason: "order-shape-incomplete" };
  }
  const existing = await store.get(orderKey(order.sessionId));
  if (existing) {
    /* Already recorded — but a first write may have died
     * between the order and the index, leaving the order
     * standing with no index naming it. A redelivery
     * heals that half-state before it answers. */
    const index = await store.get(INDEX_KEY);
    const ids = Array.isArray(index) ? index : [];
    if (!ids.includes(order.sessionId)) {
      ids.push(order.sessionId);
      await store.set(INDEX_KEY, ids);
    }
    return { ok: true, order: existing, already: true };
  }
  await store.set(orderKey(order.sessionId), order);
  const index = await store.get(INDEX_KEY);
  const ids = Array.isArray(index) ? index : [];
  if (!ids.includes(order.sessionId)) {
    ids.push(order.sessionId);
    await store.set(INDEX_KEY, ids);
  }
  return { ok: true, order, already: false };
}

export async function readOrder(store, sessionId) {
  if (!store || !SESSION_ID_SHAPE.test(sessionId || "")) return null;
  const order = await store.get(orderKey(sessionId));
  return order && typeof order === "object" ? order : null;
}

/**
 * Fulfilment, read by the keeper's own returning page:
 * the stored order if the webhook already wrote it;
 * otherwise Stripe itself is asked for the session
 * (through the injected transport), and a session
 * standing paid — passed through the very same
 * order resolution the webhook uses, amount check and
 * all — is recorded on the spot and returned. The
 * webhook remains the record of first resort; this is
 * the road healing its own race, never a second truth.
 */
export async function fulfilStallOrder({
  env, transport, store, catalogue, sessionId, atIso,
}) {
  if (!SESSION_ID_SHAPE.test(sessionId || "")) {
    return { ok: false, reason: "session-id-malformed" };
  }
  const stored = await readOrder(store, sessionId);
  if (stored) return { ok: true, order: stored, source: "record" };
  const config = stallConfig(env, catalogue);
  if (!config.connected) return refuse("stripe-not-connected");
  let res = null;
  try {
    res = await transport(
      `https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
        method: "GET",
        headers: { authorization: `Bearer ${env[STRIPE_ENV.secretKey]}` },
      });
  } catch {
    /* The road itself failed: the order is simply not
     * readable yet — the same plain answer as a session
     * Stripe does not know, never an exception. */
    return { ok: false, reason: "order-not-recorded-yet" };
  }
  if (!res || res.status !== 200 || !res.json) {
    return { ok: false, reason: "order-not-recorded-yet" };
  }
  const resolved = orderFromStallCheckoutCompleted({
    type: "checkout.session.completed",
    data: { object: res.json },
  }, catalogue, atIso);
  if (!resolved.ok) return { ok: false, reason: resolved.reason };
  const recorded = await recordOrder(store, resolved.order);
  if (!recorded.ok) return recorded;
  return { ok: true, order: recorded.order, source: "stripe" };
}
