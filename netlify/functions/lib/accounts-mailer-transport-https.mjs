/*
 * The REAL mailer transport: an HTTPS JSON call to
 * Aaron's email service.
 *
 * It reads its connection from environment NAMES only
 * (set by Aaron — ACCOUNTS-SETUP.md):
 *   ACCOUNTS_MAILER_API_URL  the service's send endpoint
 *   ACCOUNTS_MAILER_API_KEY  the service's API key
 *   ACCOUNTS_MAILER_FROM     the From address, on a
 *                            domain the service has
 *                            verified for Aaron
 * No value is ever logged, returned, or stored in this
 * repo. The call shape is the common transactional
 * one — a JSON POST {from, to, subject, text} under a
 * Bearer key (the shape Resend and its peers accept).
 * If Aaron's chosen service speaks a different shape,
 * this file is the one place that changes.
 *
 * With any of the three names absent the factory
 * returns null and the mailer stands unconfigured —
 * fail-closed, like every seat at this door.
 */

export function createHttpsMailerTransport(env, fetchImpl) {
  const apiUrl = env.ACCOUNTS_MAILER_API_URL;
  const apiKey = env.ACCOUNTS_MAILER_API_KEY;
  const from = env.ACCOUNTS_MAILER_FROM;
  if (!apiUrl || !apiKey || !from) return null;
  const send = fetchImpl || fetch;
  return {
    kind: "https",
    from,

    async send(message) {
      const res = await send(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: message.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
        }),
      });
      return res.ok ? { ok: true } : { ok: false, reason: `provider-${res.status}` };
    },
  };
}
