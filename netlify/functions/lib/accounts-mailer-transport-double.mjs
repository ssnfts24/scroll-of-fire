/*
 * The TEST DOUBLE for the mailer transport — the
 * mailer's sibling of accounts-store-double.mjs.
 *
 * An in-process transport that "sends" by holding the
 * message in an outbox the proofs can read. It exists
 * so the sign-in mail path can be proven end to end —
 * accounts seat → webhook → mailer → outbox → verify —
 * without an email service, which only Aaron's hands
 * may connect (ACCOUNTS-SETUP.md).
 *
 * Every proof that ran against this double is labelled
 * DOUBLE-PROVEN; the live proof stays OWED until Aaron
 * sets the real transport's environment. This double is
 * never the production transport: the function selects
 * it only when ACCOUNTS_MAILER_TRANSPORT=double, which
 * the deployment checklist forbids in production, in
 * those words.
 */

const outbox = [];

export function createDoubleMailerTransport() {
  return {
    kind: "double",

    async send(message) {
      outbox.push({ ...message });
      return { ok: true };
    },
  };
}

/* Test-only introspection, mirroring the store double's
 * countAll: what the outbox holds, so a proof can read
 * the very message a keeper would have received. */
export function doubleOutbox() {
  return outbox.map((m) => ({ ...m }));
}

export function clearDoubleOutbox() {
  outbox.length = 0;
}
