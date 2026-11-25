/*
 * The sign-in mailer — the door's missing half (Gate G,
 * Phase 3 completion; commissioned Nov 24, 2026, built
 * Nov 25, 2026 under Aaron's "Start all").
 *
 * The accounts seat (../accounts.mjs) delivers a magic
 * link by POSTing {email, link, purpose} to the HTTPS
 * endpoint named by ACCOUNTS_EMAIL_WEBHOOK. Until now
 * that endpoint did not exist: the checklist named it
 * "Aaron's mailer" and no mailer stood anywhere. This
 * core is that endpoint's brain, and
 * ../accounts-mailer.mjs is the endpoint itself — the
 * webhook Aaron points at the door's OWN function:
 *   ACCOUNTS_EMAIL_WEBHOOK =
 *     https://codexofreality.org/.netlify/functions/accounts-mailer
 *
 * THE FENCES THIS FILE CARRIES
 * - ONE PURPOSE. The mailer sends sign-in mail and
 *   nothing else. The only purpose it accepts is the
 *   one the accounts seat sends; anything else is
 *   refused by name. It is not a general mail relay,
 *   and it cannot be borrowed for any other sending.
 * - THE LINK IS FENCED. A delivery is accepted only
 *   when its link is an https URL on the site's own
 *   origin, on the account page, carrying a sign-in
 *   token. An endpoint that mails arbitrary links
 *   under the keeper's own mail account would be a
 *   phishing machine; this one cannot be made to
 *   carry a stranger's link.
 * - ADULTS ONLY, UPSTREAM AND HERE. Accounts exist
 *   only for keepers who confirmed they are adults
 *   (accounts-core refuses otherwise before a token
 *   exists at all). This mailer adds no path around
 *   that: no token, no link, no mail.
 * - FAIL CLOSED. With no transport configured the
 *   mailer answers "unconfigured" and sends nothing —
 *   the same posture as every seat at this door. It
 *   never pretends a delivery happened.
 * - NO CREDENTIAL IN THIS REPO. The real transport
 *   reads its service endpoint, key, and From address
 *   from environment NAMES only (see
 *   accounts-mailer-transport-https.mjs and
 *   ACCOUNTS-SETUP.md). No email credential exists in
 *   this house yet; Aaron provides the email service
 *   with his own hands.
 * - TWO PURSES. Sign-in mail is accounts plumbing,
 *   not talk: nothing here spends against the public
 *   door's $20/month ceiling, and the Guide seat's
 *   rulebook is untouched by this file.
 */

import { timingSafeEqual } from "node:crypto";

/* The one purpose the door sends (accounts.mjs,
 * deliverMagicLink). Anything else is refused. */
export const SIGNIN_PURPOSE = "spark-living-day-signin";

/* The header the accounts seat uses to prove a delivery
 * came from the door itself, when the shared secret is
 * set (ACCOUNTS_EMAIL_WEBHOOK_SECRET — one name, read
 * by both functions; Netlify environment is site-wide). */
export const MAILER_SECRET_HEADER = "x-codex-mailer-secret";

const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/* Checks a webhook delivery against the contract and
 * the fences. Returns the normalised delivery or a
 * refusal with a named reason — nothing is silently
 * dropped, and a refusal sends nothing. */
export function validateDelivery(payload, { siteUrl } = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, reason: "payload-shape" };
  }
  if (payload.purpose !== SIGNIN_PURPOSE) {
    return { ok: false, reason: "purpose-refused" };
  }
  if (typeof payload.email !== "string" || !EMAIL_SHAPE.test(payload.email)) {
    return { ok: false, reason: "email-shape" };
  }
  if (typeof payload.link !== "string" || payload.link.length === 0) {
    return { ok: false, reason: "link-shape" };
  }
  let link;
  let base;
  try {
    link = new URL(payload.link);
    base = new URL(siteUrl || "https://codexofreality.org");
  } catch {
    return { ok: false, reason: "link-shape" };
  }
  if (link.protocol !== "https:" || link.origin !== base.origin
      || link.pathname !== "/account.html"
      || !link.searchParams.get("signin")) {
    return { ok: false, reason: "link-refused" };
  }
  return {
    ok: true,
    email: payload.email.toLowerCase(),
    link: payload.link,
    purpose: payload.purpose,
  };
}

/* The message itself: plain words, the link, how long
 * it lives, and what to do if it was not you. No
 * tracking, no images, no marketing — a sign-in mail
 * is a key being carried, nothing more. */
export function composeSigninMessage(delivery, { from }) {
  return {
    from,
    to: delivery.email,
    subject: "Your sign-in link for the Codex of Reality",
    text: [
      "Here is your sign-in link for the Codex of Reality:",
      "",
      delivery.link,
      "",
      "It works once, and it stops working after 15 minutes.",
      "Open it on the website or in Spark. Living Day — the same",
      "account answers on both.",
      "",
      "If you did not ask for this link, do nothing: without the",
      "link, nothing can be signed in, and it expires on its own.",
    ].join("\n"),
  };
}

/* Constant-time comparison of the shared secret, when
 * one is set. An unset secret means the check is not
 * in force (the double transport's test posture); the
 * function refuses the REAL transport without one —
 * see accounts-mailer.mjs. */
export function secretMatches(provided, expected) {
  if (!expected) return true;
  if (typeof provided !== "string" || provided.length === 0) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/* Hands a composed message to a transport and reports
 * the outcome in the door's own words. Never throws:
 * a transport's failure is a named result, not a crash
 * the webhook caller has to guess at. */
export async function deliverMail(transport, message) {
  if (!transport) return { ok: false, reason: "mailer-unconfigured" };
  try {
    const result = await transport.send(message);
    if (result && result.ok) return { ok: true, delivery: "sent" };
    return { ok: false, reason: (result && result.reason) || "transport-refused" };
  } catch {
    return { ok: false, reason: "transport-unreachable" };
  }
}
