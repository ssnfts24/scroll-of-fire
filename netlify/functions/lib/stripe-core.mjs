/* The Stripe socket — Gate G, Phase 5 (G4's build side;
 * gate-g-live-plan-2026-11-24 §3.4 and §7's G4 block;
 * the shop payment-rails paper of Nov 19, 2026 governs
 * whole).
 *
 * CARRIED TO THE SITE (Nov 24, 2026, the one-PR
 * redesign): this file is the door's stripe-core.mjs,
 * carried verbatim from living-phone/door/ into the
 * site's Netlify Functions, beside its shop sibling
 * (lib/shop-core.mjs). The header below was written
 * for the door folder; where it says the socket stands
 * in the app repo undeployed, read it now as: deployed
 * with the site, still DARK — it reads environment
 * names only, and Aaron's Stripe connection (his
 * account, his keys, set by his own hands) is the one
 * step between this code and a live till.
 *
 * THE DELIVERABLE IS THE SOCKET, NOT THE PLUG. Stripe
 * is the engine (rails paper, Rail 1); Cash App Pay is
 * a payment method inside the same Stripe checkout
 * (Rail 2, Form B); crypto is last and optional and is
 * NOT built here (Rail 3 — a request for it is refused
 * by name, below). Stripe is NOT CONNECTED: Aaron
 * connects it himself, in his own name, in the secure
 * flow, when he chooses. No Stripe key exists anywhere
 * in this house today — none was created, requested, or
 * stored by this build — and this code holds none: it
 * reads its keys from ENVIRONMENT NAMES ONLY
 * (STRIPE_ENV below), and with them absent every
 * charging path refuses plainly and fails closed
 * (NOT_CONNECTED_WORDS). The socket is also NOT
 * DEPLOYED: it stands in the app repo as prepared door
 * code; carrying it to the site's functions is part of
 * Aaron's connection act, not this phase's.
 *
 * GRANT-ON-PAYMENT. A completed checkout resolves to
 * the ONE grant shape (the rails paper: one grant
 * shape, regardless of rail) — the same fields, in the
 * same order, as the app's hand grants
 * (TierLedger.GRANT_FIELDS; the phase tests hold the
 * two field sets equal). The grant carries NO price
 * and NO amount: prices are Aaron's calls (§3.4) and
 * none is set — a Stripe price id reaches this code
 * only through Aaron's own environment when he
 * connects, and what the record learns is that a
 * payment completed, on which rail, for which keeper
 * and tier — never a card number or a credential.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** Environment NAMES — never values. The connection
 *  exists only when Aaron has set these in the door's
 *  environment himself. */
export const STRIPE_ENV = {
  secretKey: "STRIPE_SECRET_KEY",
  webhookSecret: "STRIPE_WEBHOOK_SECRET",
  priceConnected: "STRIPE_PRICE_CONNECTED",
  priceAgentHosted: "STRIPE_PRICE_AGENT_HOSTED",
};

/** EACH FUNCTION KEEPS ITS OWN WEBHOOK SECRET
 *  (payments sweep, Nov 27, 2026): Stripe issues one
 *  signing secret per webhook destination, and each
 *  destination points at ONE function — so a secret
 *  can only ever verify its own function's events.
 *  STRIPE_WEBHOOK_SECRET above is the STALL's own
 *  (the name production already holds for the stall's
 *  destination, kept). The shop reads
 *  STRIPE_SHOP_WEBHOOK_SECRET (lib/shop-core.mjs) and
 *  this door socket reads the name below. No two
 *  functions share a variable again: a secret standing
 *  in the environment must never make a second
 *  function's probe claim a webhook road that no
 *  destination feeds. */
export const DOOR_WEBHOOK_SECRET_ENV = "STRIPE_DOOR_WEBHOOK_SECRET";

/** Said plainly wherever a charging path is asked for
 *  while the connection does not exist. */
export const NOT_CONNECTED_WORDS =
  "Charging is dark: Stripe is not connected. Aaron connects it " +
  "himself, in his own name, when he chooses — until then no " +
  "payment can be taken and no tier is sold.";

/** The one grant shape, field-for-field with the app's
 *  TierLedger.GRANT_FIELDS. */
export const GRANT_FIELDS = [
  "keeper", "tier", "how", "rail", "grantedBy",
  "grantedAt", "capMicroUsd", "revokedAt",
];

/** The tiers a checkout may ever sell. Free is the
 *  ground and is never sold; BYO carries no cap from
 *  us and no charge through us — neither is a checkout
 *  tier, and asking is refused by name. */
export const CHARGEABLE_TIERS = {
  connected: STRIPE_ENV.priceConnected,
  "agent-hosted": STRIPE_ENV.priceAgentHosted,
};

/** The connection's standing, read from names alone.
 *  Values are never returned, logged, or compared
 *  beyond presence. `webhookSecretName` names whose
 *  webhook secret to read (each function its own —
 *  see DOOR_WEBHOOK_SECRET_ENV); it defaults to the
 *  stall's name for the shared verifier's sake.
 *
 *  `charging` is the WHOLE-ROAD rule (payments sweep,
 *  Nov 27, 2026): this socket lights only when every
 *  piece of its road stands — the key, BOTH tier
 *  prices Aaron sets in his dashboard, and the door's
 *  own webhook secret (a paid tier whose grant no
 *  verified event can deliver is not a road). While
 *  any piece is missing, `darkReason` names the first
 *  one, in plain code words the probe can carry. */
export function stripeConfig(env, webhookSecretName = STRIPE_ENV.webhookSecret) {
  const present = (name) =>
    typeof env[name] === "string" && env[name].length > 0;
  const connected = present(STRIPE_ENV.secretKey);
  const webhook = present(webhookSecretName);
  const prices = {
    connected: present(STRIPE_ENV.priceConnected),
    "agent-hosted": present(STRIPE_ENV.priceAgentHosted),
  };
  const charging = connected && webhook
    && prices.connected && prices["agent-hosted"];
  const darkReason = charging ? null
    : !connected ? "stripe-not-connected"
    : !webhook ? "stripe-webhook-not-set"
    : "stripe-price-not-set";
  return { connected, webhook, prices, charging, darkReason };
}

function refuse(reason) {
  return { ok: false, reason, words: NOT_CONNECTED_WORDS };
}

/**
 * Creates a Stripe Checkout session for a tier —
 * through the injected transport (the function's real
 * transport is fetch; proofs use a double). Refuses,
 * in order: not connected; a tier that is never sold;
 * a price Aaron has not set in his own environment.
 * The session asks Stripe for card AND Cash App Pay —
 * one checkout, both methods (rails paper, Rails 1–2).
 * Crypto is not among them and is never added here.
 */
export async function createCheckoutSession({
  env, transport, keeper, tier, capMicroUsd, successUrl, cancelUrl,
}) {
  const config = stripeConfig(env);
  if (!config.connected) return refuse("stripe-not-connected");
  if (!(tier in CHARGEABLE_TIERS)) {
    return { ok: false, reason: "tier-never-sold",
      words: "That tier is not sold: Free simply stands, and a BYO " +
        "agent runs on the keeper's own account, not through us." };
  }
  if (!config.prices[tier]) {
    return { ok: false, reason: "stripe-price-not-set",
      words: "No price is set for that tier. Prices are Aaron's " +
        "calls, set in his own Stripe when he connects it." };
  }
  if (!stripeConfig(env, DOOR_WEBHOOK_SECRET_ENV).webhook) {
    return { ok: false, reason: "stripe-webhook-not-set",
      words: "Stripe is connected, but the door's own webhook " +
        "secret is not set, so a paid tier's grant could not " +
        "arrive verified. The till stays dark until it is." };
  }
  if (!keeper || typeof keeper !== "string") {
    return { ok: false, reason: "keeper-required" };
  }
  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("payment_method_types[0]", "card");
  form.set("payment_method_types[1]", "cashapp");
  form.set("line_items[0][price]", env[CHARGEABLE_TIERS[tier]]);
  form.set("line_items[0][quantity]", "1");
  form.set("success_url", successUrl);
  form.set("cancel_url", cancelUrl);
  form.set("metadata[keeper]", keeper);
  form.set("metadata[tier]", tier);
  form.set("metadata[capMicroUsd]", String(capMicroUsd ?? 0));
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
 * Verifies a Stripe webhook signature — HMAC-SHA256
 * over "<timestamp>.<raw body>" under the webhook
 * secret from the environment, with Stripe's five-
 * minute tolerance. With no webhook secret set, every
 * webhook is refused: an unverifiable event grants
 * nothing, ever.
 */
export function verifyWebhook({
  env, rawBody, signatureHeader, nowSeconds, secretName,
}) {
  const name = secretName || STRIPE_ENV.webhookSecret;
  const config = stripeConfig(env, name);
  if (!config.webhook) return refuse("stripe-not-connected");
  if (typeof signatureHeader !== "string") {
    return { ok: false, reason: "signature-missing" };
  }
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }));
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || !v1) {
    return { ok: false, reason: "signature-malformed" };
  }
  if (Math.abs(nowSeconds - t) > 300) {
    return { ok: false, reason: "signature-stale" };
  }
  const expected = createHmac("sha256", env[name])
    .update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "signature-mismatch" };
  }
  return { ok: true };
}

/**
 * Grant-on-payment: a verified checkout.session.completed
 * event with payment standing paid resolves to a grant
 * in the ONE shape — the same record the hand path
 * writes, with how/rail naming how it truly arrived.
 * Any other event, or an unpaid session, grants
 * nothing. The rail is named from the methods the
 * session carried: a Cash-App-only session is
 * cash-app-pay; anything else is the card rail. (Crypto is not built: no session this
 * socket creates can carry it.)
 */
export function grantFromCheckoutCompleted(event, atIso) {
  if (!event || event.type !== "checkout.session.completed") {
    return { ok: false, reason: "event-not-a-completed-checkout" };
  }
  const session = event.data && event.data.object;
  if (!session || session.payment_status !== "paid") {
    return { ok: false, reason: "checkout-not-paid" };
  }
  const md = session.metadata || {};
  if (!md.keeper || !(md.tier in CHARGEABLE_TIERS)) {
    return { ok: false, reason: "grant-shape-incomplete" };
  }
  const methods = session.payment_method_types || [];
  const rail = methods.includes("cashapp") && !methods.includes("card")
    ? "cash-app-pay" : "stripe-card";
  const grant = {};
  grant.keeper = md.keeper;
  grant.tier = md.tier;
  grant.how = "stripe-checkout";
  grant.rail = rail;
  grant.grantedBy = "Stripe checkout (Aaron's connection)";
  grant.grantedAt = atIso || "";
  grant.capMicroUsd = Number(md.capMicroUsd ?? 0) || 0;
  grant.revokedAt = "";
  return { ok: true, grant };
}
