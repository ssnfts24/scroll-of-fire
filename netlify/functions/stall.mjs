/* The Spark Stall's function face — the catalogue
 * till's seat beside stripe.mjs and shop.mjs, in their
 * own shape (lib/stall-core.mjs holds the law).
 *
 * GET answers the till's standing: is charging
 * connected, is the webhook's secret set, and how
 * much of the catalogue the road may sell — names and
 * counts only, never a key. The stall page reads it
 * to decide whether buy buttons exist at all; while
 * the answer is dark, no button is drawn and the
 * catalogue stands exactly as it stands today.
 *
 * POST with a Stripe-Signature header is the webhook
 * road: the signature is verified against the raw
 * body or the event is refused; a paid, completed
 * checkout for a catalogue good is recorded in the
 * stall's order store, under its session id.
 *
 * POST { action: "checkout", item, passport,
 * successUrl, cancelUrl } creates a session for one
 * catalogue good and answers its hosted URL. Return
 * addresses must be the site's own.
 *
 * POST { action: "fulfilment", sessionId } answers
 * the keeper's returning page: the recorded order for
 * that session, so the page can write the good's
 * provenance onto the keeper's own device.
 *
 * The catalogue reaches this function as a file the
 * build carries (netlify.toml's included_files, the
 * Guide's own road): docs/assets/data/spark-goods.json,
 * read from the candidate roots below. If it cannot
 * be read, the till answers dark and plain — a stall
 * that cannot read its own price book sells nothing.
 *
 * Like the seats beside it: built, dark, fail-closed.
 * Aaron's two pastes are the only missing steps.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createProductionOrderStore, createStallCheckout, fulfilStallOrder,
  orderFromStallCheckoutCompleted, recordOrder, stallConfig,
  verifyWebhook,
} from "./lib/stall-core.mjs";
import { NOT_CONNECTED_WORDS } from "./lib/stripe-core.mjs";

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

let catalogueCache = null;
function loadCatalogue() {
  if (catalogueCache) return catalogueCache;
  const candidates = [];
  if (process.env.STALL_CATALOGUE_PATH) {
    candidates.push(process.env.STALL_CATALOGUE_PATH);
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  candidates.push(path.join(here, "..", "..", "docs", "assets", "data", "spark-goods.json"));
  candidates.push(path.join(process.cwd(), "docs", "assets", "data", "spark-goods.json"));
  candidates.push(path.join(here, "docs", "assets", "data", "spark-goods.json"));
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, "utf8"));
      if (parsed && Array.isArray(parsed.items)) {
        catalogueCache = parsed;
        return catalogueCache;
      }
    } catch { /* try the next candidate */ }
  }
  return null;
}

export default async function handler(req) {
  const env = process.env;
  const catalogue = loadCatalogue();
  if (!catalogue) {
    return json({
      ok: false, charging: false, reason: "catalogue-unreadable",
      words: "The stall cannot read its own catalogue just now, " +
        "so its till stays closed. Nothing can be charged.",
    }, 200);
  }
  const config = stallConfig(env, catalogue);

  if (req.method === "GET") {
    return json({
      ok: true, charging: config.connected,
      stripe: { connected: config.connected, webhook: config.webhook },
      sellable: config.sellable,
      catalogueSize: config.catalogueSize,
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
    let stripeEvent = null;
    try { stripeEvent = JSON.parse(raw); } catch { stripeEvent = null; }
    if (!stripeEvent) return json({ ok: false, reason: "body-not-json" }, 400);
    const resolved = orderFromStallCheckoutCompleted(
      stripeEvent, catalogue, new Date().toISOString());
    if (!resolved.ok) return json({ ok: true, recorded: false, reason: resolved.reason });
    const store = await createProductionOrderStore();
    const recorded = await recordOrder(store, resolved.order);
    return json(recorded.ok
      ? { ok: true, recorded: true, already: !!recorded.already }
      : { ok: false, reason: recorded.reason }, recorded.ok ? 200 : 400);
  }

  let body = null;
  try { body = JSON.parse(raw); } catch { body = null; }
  if (!body || (body.action !== "checkout" && body.action !== "fulfilment")) {
    return json({ ok: false, reason: "action-unknown" }, 400);
  }
  const origin = env.SITE_URL || "https://codexofreality.org";
  if (body.action === "checkout") {
    const session = await createStallCheckout({
      env, transport: fetchTransport, catalogue,
      item: body.item, passport: body.passport,
      successUrl: body.successUrl, cancelUrl: body.cancelUrl,
      siteOrigin: origin,
    });
    return json(session, session.ok ? 200 : 400);
  }
  const store = await createProductionOrderStore();
  const fulfilled = await fulfilStallOrder({
    env, transport: fetchTransport, store, catalogue,
    sessionId: body.sessionId, atIso: new Date().toISOString(),
  });
  return json(fulfilled, fulfilled.ok ? 200 : 400);
}
