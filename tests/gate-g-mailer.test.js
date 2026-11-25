/*
 * Gate G, Phase 3 completion — the sign-in mailer, the
 * door's missing half (built Nov 25, 2026).
 *
 * Every proof in this file runs against the DOUBLE
 * mailer transport (netlify/functions/lib/accounts-
 * mailer-transport-double.mjs) or an injected fetch
 * stub. These are DOUBLE proofs, labelled as such; the
 * live proof — a real sign-in email arriving from
 * Aaron's own email service — stays OWED until Aaron
 * connects that service with his own hands
 * (lib/ACCOUNTS-SETUP.md, "The mailer"). No credential
 * appears here.
 *
 * What is proven: the webhook contract the accounts
 * seat speaks ({email, link, purpose}); the mailer's
 * fences (one purpose only; the link fenced to the
 * site's own account page carrying a token; the shared
 * secret the real transport requires); fail-closed
 * standing while unconfigured; the HTTPS transport's
 * call shape against a stubbed provider; and the whole
 * road end to end — the accounts seat's request-link
 * delivery landing in the mailer's outbox, and the
 * token in that very message verifying into a session.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SIGNIN_PURPOSE,
  composeSigninMessage,
  deliverMail,
  validateDelivery,
} from "../netlify/functions/lib/accounts-mailer-core.mjs";
import {
  clearDoubleOutbox,
  doubleOutbox,
} from "../netlify/functions/lib/accounts-mailer-transport-double.mjs";
import { createHttpsMailerTransport } from "../netlify/functions/lib/accounts-mailer-transport-https.mjs";
import mailerHandler from "../netlify/functions/accounts-mailer.mjs";

const LINK = "https://codexofreality.org/account.html?signin=test-token-0123456789";
const GOOD = { email: "Keeper@Example.org", link: LINK, purpose: SIGNIN_PURPOSE };

const MAILER_ENV = [
  "ACCOUNTS_MAILER_TRANSPORT", "ACCOUNTS_MAILER_API_URL",
  "ACCOUNTS_MAILER_API_KEY", "ACCOUNTS_MAILER_FROM",
  "ACCOUNTS_EMAIL_WEBHOOK_SECRET", "SITE_URL",
];

async function withEnv(vars, fn) {
  const saved = {};
  for (const name of MAILER_ENV) {
    saved[name] = process.env[name];
    delete process.env[name];
  }
  Object.assign(process.env, vars);
  try {
    return await fn();
  } finally {
    for (const name of MAILER_ENV) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
  }
}

const post = (body, headers = {}) => mailerHandler(new Request(
  "https://codexofreality.org/.netlify/functions/accounts-mailer", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  }));

test("the delivery contract: the door's own shape is accepted", () => {
  const out = validateDelivery(GOOD);
  assert.equal(out.ok, true);
  assert.equal(out.email, "keeper@example.org");
  assert.equal(out.purpose, SIGNIN_PURPOSE);
});

test("the fences refuse: other purposes, foreign links, bare links", () => {
  assert.equal(validateDelivery({ ...GOOD, purpose: "newsletter" }).reason, "purpose-refused");
  assert.equal(validateDelivery({ ...GOOD, link: "https://stranger.example/account.html?signin=x" }).reason, "link-refused");
  assert.equal(validateDelivery({ ...GOOD, link: "http://codexofreality.org/account.html?signin=x" }).reason, "link-refused");
  assert.equal(validateDelivery({ ...GOOD, link: "https://codexofreality.org/account.html" }).reason, "link-refused");
  assert.equal(validateDelivery({ ...GOOD, link: "https://codexofreality.org/other.html?signin=x" }).reason, "link-refused");
  assert.equal(validateDelivery({ ...GOOD, email: "not-an-email" }).reason, "email-shape");
  assert.equal(validateDelivery(null).reason, "payload-shape");
});

test("the composed message is plain, carries the link, and says the terms", () => {
  const delivery = validateDelivery(GOOD);
  const message = composeSigninMessage(delivery, { from: "door@codexofreality.org" });
  assert.equal(message.to, "keeper@example.org");
  assert.equal(message.from, "door@codexofreality.org");
  assert.ok(message.text.includes(LINK));
  assert.ok(message.text.includes("15 minutes"));
});

test("unconfigured, the mailer stands fail-closed and sends nothing", async () => {
  await withEnv({}, async () => {
    const state = await (await mailerHandler(new Request(
      "https://codexofreality.org/.netlify/functions/accounts-mailer"))).json();
    assert.equal(state.ok, true);
    assert.equal(state.mailer, false);
    assert.equal(state.transport, "unconfigured");
    const refused = await post(GOOD);
    assert.equal(refused.status, 503);
    assert.equal((await refused.json()).reason, "mailer-unconfigured");
  });
});

test("against the double, a valid delivery is sent and readable in the outbox", async () => {
  await withEnv({ ACCOUNTS_MAILER_TRANSPORT: "double" }, async () => {
    clearDoubleOutbox();
    const res = await post(GOOD);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).delivery, "sent");
    const outbox = doubleOutbox();
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].to, "keeper@example.org");
    assert.ok(outbox[0].text.includes(LINK));

    const fenced = await post({ ...GOOD, link: "https://stranger.example/account.html?signin=x" });
    assert.equal(fenced.status, 400);
    assert.equal((await fenced.json()).reason, "link-refused");
    assert.equal(doubleOutbox().length, 1);
  });
});

test("the shared secret guards the endpoint when set", async () => {
  await withEnv({
    ACCOUNTS_MAILER_TRANSPORT: "double",
    ACCOUNTS_EMAIL_WEBHOOK_SECRET: "test-webhook-secret-not-a-credential",
  }, async () => {
    assert.equal((await post(GOOD)).status, 401);
    assert.equal((await post(GOOD, { "x-codex-mailer-secret": "wrong" })).status, 401);
    const ok = await post(GOOD, { "x-codex-mailer-secret": "test-webhook-secret-not-a-credential" });
    assert.equal(ok.status, 200);
  });
});

test("the real transport will not stand without the shared secret", async () => {
  await withEnv({
    ACCOUNTS_MAILER_API_URL: "https://mail.example.test/send",
    ACCOUNTS_MAILER_API_KEY: "test-key-not-a-credential",
    ACCOUNTS_MAILER_FROM: "door@codexofreality.org",
  }, async () => {
    const state = await (await mailerHandler(new Request(
      "https://codexofreality.org/.netlify/functions/accounts-mailer"))).json();
    assert.equal(state.mailer, false);
    assert.equal((await post(GOOD)).status, 503);
  });
});

test("the HTTPS transport: absent names mean unconfigured; the call shape is the common one", async () => {
  assert.equal(createHttpsMailerTransport({}), null);
  assert.equal(createHttpsMailerTransport({ ACCOUNTS_MAILER_API_URL: "https://m.test" }), null);

  const calls = [];
  const stubOk = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200 };
  };
  const transport = createHttpsMailerTransport({
    ACCOUNTS_MAILER_API_URL: "https://mail.example.test/send",
    ACCOUNTS_MAILER_API_KEY: "test-key-not-a-credential",
    ACCOUNTS_MAILER_FROM: "door@codexofreality.org",
  }, stubOk);
  assert.equal(transport.kind, "https");
  const message = composeSigninMessage(validateDelivery(GOOD), { from: transport.from });
  assert.deepEqual(await deliverMail(transport, message), { ok: true, delivery: "sent" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers.Authorization, "Bearer test-key-not-a-credential");
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(sent.to, "keeper@example.org");
  assert.equal(sent.from, "door@codexofreality.org");
  assert.ok(sent.text.includes(LINK));

  const stubRefuse = async () => ({ ok: false, status: 500 });
  const refusing = createHttpsMailerTransport({
    ACCOUNTS_MAILER_API_URL: "https://mail.example.test/send",
    ACCOUNTS_MAILER_API_KEY: "k",
    ACCOUNTS_MAILER_FROM: "door@codexofreality.org",
  }, stubRefuse);
  assert.equal((await deliverMail(refusing, message)).reason, "provider-500");

  const stubDown = async () => { throw new Error("network down"); };
  const down = createHttpsMailerTransport({
    ACCOUNTS_MAILER_API_URL: "https://mail.example.test/send",
    ACCOUNTS_MAILER_API_KEY: "k",
    ACCOUNTS_MAILER_FROM: "door@codexofreality.org",
  }, stubDown);
  assert.equal((await deliverMail(down, message)).reason, "transport-unreachable");
});

test("end to end: the accounts seat's delivery lands in the mailer, and its token verifies", async () => {
  const savedEnv = {};
  const names = [
    "ACCOUNTS_STORE", "ACCOUNTS_SESSION_SECRET", "ACCOUNTS_EMAIL_WEBHOOK",
    "ACCOUNTS_EMAIL_WEBHOOK_SECRET", "ACCOUNTS_MAILER_TRANSPORT",
  ];
  for (const name of names) { savedEnv[name] = process.env[name]; }
  const realFetch = globalThis.fetch;
  try {
    process.env.ACCOUNTS_STORE = "double";
    process.env.ACCOUNTS_SESSION_SECRET = "test-session-secret-not-a-credential";
    process.env.ACCOUNTS_MAILER_TRANSPORT = "double";
    process.env.ACCOUNTS_EMAIL_WEBHOOK_SECRET = "test-webhook-secret-not-a-credential";
    process.env.ACCOUNTS_EMAIL_WEBHOOK =
      "https://codexofreality.org/.netlify/functions/accounts-mailer";
    // Route the accounts seat's webhook call into the
    // mailer function itself, in-process.
    globalThis.fetch = async (url, init) => {
      if (String(url) === process.env.ACCOUNTS_EMAIL_WEBHOOK) {
        return mailerHandler(new Request(url, init));
      }
      return realFetch(url, init);
    };

    const { default: accountsHandler } = await import("../netlify/functions/accounts.mjs");
    const postAccounts = (body) => accountsHandler(new Request(
      "https://codexofreality.org/.netlify/functions/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }));

    clearDoubleOutbox();
    const link = await (await postAccounts(
      { action: "request-link", email: "keeper@example.org", adultConfirmed: true })).json();
    assert.equal(link.ok, true);
    assert.equal(link.delivery, "sent");
    assert.equal(link.token, undefined);

    const outbox = doubleOutbox();
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].to, "keeper@example.org");
    const match = outbox[0].text.match(/signin=([A-Za-z0-9_-]+)/);
    assert.ok(match, "the mailed message carries the sign-in token");

    const verified = await (await postAccounts({ action: "verify", token: match[1] })).json();
    assert.equal(verified.ok, true);
    assert.equal(verified.email, "keeper@example.org");
  } finally {
    globalThis.fetch = realFetch;
    for (const name of names) {
      if (savedEnv[name] === undefined) delete process.env[name];
      else process.env[name] = savedEnv[name];
    }
  }
});
