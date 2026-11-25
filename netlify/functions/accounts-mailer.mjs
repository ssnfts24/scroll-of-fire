/*
 * The sign-in mailer endpoint — Gate G, Phase 3
 * completion (built Nov 25, 2026 under Aaron's
 * "Start all"; the mailer was the door's missing half,
 * owed since Nov 24).
 *
 * Served by Netlify at /.netlify/functions/accounts-mailer.
 * THIS is the endpoint ACCOUNTS_EMAIL_WEBHOOK names:
 * Aaron sets that variable to this function's own URL
 * and the accounts seat's deliveries land here. It is
 * not a talking seat and spends nothing against the
 * public door's ceiling — accounts are not talk.
 *
 *   GET   -> public state: whether the mailer is
 *            configured, and which transport stands.
 *   POST  -> the webhook contract, {email, link,
 *            purpose}: validated against the fences in
 *            lib/accounts-mailer-core.mjs (one purpose,
 *            the link fenced to the site's own account
 *            page), then handed to the transport.
 *
 * Fail-closed, as every seat at this door: with no
 * transport configured (Aaron's email-service
 * environment not yet set — see lib/ACCOUNTS-SETUP.md)
 * it answers "unconfigured" and sends nothing. The
 * REAL transport additionally refuses to stand without
 * the shared webhook secret (ACCOUNTS_EMAIL_WEBHOOK_
 * SECRET): an unauthenticated sending endpoint must
 * never stand open on the public site. The accounts
 * seat proves itself with that secret in the
 * x-codex-mailer-secret header when the secret is set.
 *
 * The double transport (ACCOUNTS_MAILER_TRANSPORT=
 * double) exists for proofs only; the deployment
 * checklist forbids it in production, in those words.
 */

import {
  MAILER_SECRET_HEADER,
  composeSigninMessage,
  deliverMail,
  secretMatches,
  validateDelivery,
} from "./lib/accounts-mailer-core.mjs";
import { createDoubleMailerTransport } from "./lib/accounts-mailer-transport-double.mjs";
import { createHttpsMailerTransport } from "./lib/accounts-mailer-transport-https.mjs";

function resolveTransport() {
  if (process.env.ACCOUNTS_MAILER_TRANSPORT === "double") {
    return createDoubleMailerTransport();
  }
  return createHttpsMailerTransport(process.env);
}

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(request) {
  const transport = resolveTransport();
  const secret = process.env.ACCOUNTS_EMAIL_WEBHOOK_SECRET || null;
  // The real transport never stands without the shared
  // secret; the double (proofs only) may stand without.
  const secretMissing = transport?.kind === "https" && !secret;
  const configured = Boolean(transport) && !secretMissing;

  if (request.method === "GET") {
    return json(200, {
      ok: true,
      mailer: configured,
      transport: configured ? transport.kind : "unconfigured",
      note: "This endpoint carries sign-in mail for the accounts "
        + "side of the door, and nothing else.",
    });
  }
  if (request.method !== "POST") return json(405, { ok: false, reason: "method" });
  if (!configured) return json(503, { ok: false, reason: "mailer-unconfigured" });

  if (secret && !secretMatches(request.headers.get(MAILER_SECRET_HEADER), secret)) {
    return json(401, { ok: false, reason: "mailer-secret" });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, reason: "json-shape" });
  }
  const delivery = validateDelivery(body, {
    siteUrl: process.env.SITE_URL || "https://codexofreality.org",
  });
  if (!delivery.ok) return json(400, delivery);

  const message = composeSigninMessage(delivery, {
    from: transport.from || "the Codex door (test double)",
  });
  const result = await deliverMail(transport, message);
  return json(result.ok ? 200 : 502, result);
}
