/*
 * Gate G, Phase 3 (G2) — the accounts side of the door.
 *
 * Every proof in this file runs against the DOUBLE store
 * (netlify/functions/lib/accounts-store-double.mjs) — an
 * in-process implementation of the Atlas store's own
 * interface. These are DOUBLE proofs, labelled as such in
 * the phase evidence; the live-Atlas proof stays OWED
 * until Aaron creates the Atlas account with his own
 * hands (plan §2.1) and sets the environment
 * (lib/ACCOUNTS-SETUP.md). No credential appears here.
 *
 * What is proven: the magic-link sign-in under the
 * adults-only rule (single-use, expiring); one account
 * per email accepted on both surfaces' shared door;
 * append-only push (a held line is never edited, a
 * forged line id is refused, a child-marked line is
 * refused); the conflict law (lines interleave, appended
 * corrections unite and are never overwritten, a
 * designation disagreement surfaces with BOTH values
 * held); the ONE-format equivalence (payload → lines →
 * payload, field by field); and account end as TRUE
 * deletion of the door's copy.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  canonical,
  dealLines,
  endAccount,
  mergeLines,
  payloadFromValues,
  pullLines,
  pushLines,
  readSession,
  requestMagicLink,
  verifyMagicLink,
} from "../netlify/functions/lib/accounts-core.mjs";
import { createDoubleStore } from "../netlify/functions/lib/accounts-store-double.mjs";

const SECRET = "test-session-secret-not-a-credential";
const NOW = Date.parse("2026-11-24T18:00:00.000Z");

async function signedIn(store, email = "keeper@example.org") {
  const req = await requestMagicLink(store, { email, adultConfirmed: true }, NOW);
  assert.equal(req.ok, true);
  const ver = await verifyMagicLink(store, { token: req.token }, NOW + 1000, SECRET);
  assert.equal(ver.ok, true);
  return ver;
}

test("sign-in refuses without the adult confirmation", async () => {
  const store = createDoubleStore();
  const no = await requestMagicLink(store, { email: "a@b.co", adultConfirmed: false }, NOW);
  assert.equal(no.ok, false);
  assert.equal(no.reason, "adults-only");
});

test("magic link: single use, expiring, one account per email", async () => {
  const store = createDoubleStore();
  const first = await signedIn(store);
  assert.equal(first.account.email, "keeper@example.org");

  // The same token cannot be spent twice.
  const req = await requestMagicLink(store, { email: "keeper@example.org", adultConfirmed: true }, NOW);
  await verifyMagicLink(store, { token: req.token }, NOW + 10, SECRET);
  const again = await verifyMagicLink(store, { token: req.token }, NOW + 20, SECRET);
  assert.equal(again.ok, false);
  assert.equal(again.reason, "token-used");

  // An expired token is refused.
  const old = await requestMagicLink(store, { email: "keeper@example.org", adultConfirmed: true }, NOW);
  const expired = await verifyMagicLink(store, { token: old.token }, NOW + 16 * 60 * 1000, SECRET);
  assert.equal(expired.ok, false);
  assert.equal(expired.reason, "token-expired");

  // A second sign-in for the same email is the SAME account.
  const second = await signedIn(store);
  assert.equal(second.account.id, first.account.id);

  // Sessions read back; a forged signature does not.
  const payload = readSession(first.session, SECRET, NOW + 2000);
  assert.equal(payload.accountId, first.account.id);
  assert.equal(readSession(first.session + "x", SECRET, NOW + 2000), null);
});

test("push is append-only; forged and child-marked lines are refused", async () => {
  const store = createDoubleStore();
  const { account } = await signedIn(store);
  const deal = dealLines({
    classes: { "S-01": { record: { name: "Selor", seed: "spark1-8-217-1-iuebk69z" } } },
    plans: [], watch: { positions: {}, completions: {} },
  }, "2026-11-24T18:00:00.000Z", "website");
  const pushed = await pushLines(store, account.id, deal.lines);
  assert.equal(pushed.ok, true);
  assert.equal(pushed.accepted.length, 1);

  // The same line carried twice is held once.
  const again = await pushLines(store, account.id, deal.lines);
  assert.equal(again.accepted.length, 0);
  const held = await pullLines(store, account.id);
  assert.equal(held.lines.length, 1);

  // A line whose id does not match its content is refused.
  const forged = { ...deal.lines[0], value: { name: "Other" } };
  const refusedForged = await pushLines(store, account.id, [forged]);
  assert.equal(refusedForged.refused.length, 1);
  assert.equal(refusedForged.refused[0].reason, "line-id-mismatch");

  // A child-marked line never crosses, even well-formed.
  const childDeal = dealLines({
    classes: { "S-01": { record: { name: "Kid", childMode: true } } },
    plans: [], watch: { positions: {}, completions: {} },
  }, "2026-11-24T18:00:00.000Z", "website");
  assert.equal(childDeal.lines.length, 0);
  assert.deepEqual(childDeal.refusals, ["record:S-01:record"]);
});

test("conflict law: appends interleave; a correction is never overwritten", () => {
  const base = { classes: {
    "S-06": { "belief:days": { subject: "days", lines: [{ text: "first", at: "t1" }] } },
  }, plans: [], watch: { positions: {}, completions: {} } };
  const phoneSide = { classes: {
    "S-06": { "belief:days": { subject: "days", lines: [{ text: "first", at: "t1" }, { text: "correction from phone", at: "t2" }] } },
  }, plans: [], watch: { positions: {}, completions: {} } };
  const siteSide = { classes: {
    "S-06": { "belief:days": { subject: "days", lines: [{ text: "first", at: "t1" }, { text: "note from site", at: "t3" }] } },
  }, plans: [], watch: { positions: {}, completions: {} } };
  const a = dealLines(phoneSide, "2026-11-24T18:01:00.000Z", "phone").lines;
  const b = dealLines(siteSide, "2026-11-24T18:02:00.000Z", "website").lines;
  void base;
  const merged = mergeLines(a, b);
  const belief = merged.values["record:S-06:belief:days"];
  const texts = belief.lines.map((l) => l.text);
  assert.ok(texts.includes("first"));
  assert.ok(texts.includes("correction from phone"));
  assert.ok(texts.includes("note from site"));
  assert.equal(merged.conflicts.length, 0);
});

test("conflict law: a designation disagreement surfaces with both held", () => {
  const mk = (flag) => ({ classes: {
    "G-01": { "profile-1": { id: "profile-1", input: { name: "Keeper" }, myGenesis: flag } },
  }, plans: [], watch: { positions: {}, completions: {} } });
  const a = dealLines(mk(true), "2026-11-24T18:01:00.000Z", "phone").lines;
  const b = dealLines(mk(false), "2026-11-24T18:02:00.000Z", "website").lines;
  const merged = mergeLines(a, b);
  assert.equal(merged.conflicts.length, 1);
  assert.equal(merged.conflicts[0].path, "myGenesis");
  assert.deepEqual(
    merged.conflicts[0].heldValues.map(String).sort(), ["false", "true"]);
  // The local side stands until the keeper rules; the
  // other value is held in the conflict, not resolved.
  assert.equal(merged.values["record:G-01:profile-1"].myGenesis, true);
});

test("one format: payload -> lines -> payload, field by field", () => {
  const payload = {
    classes: {
      "G-01": { "profile-1": { id: "profile-1", oracleVersion: "2.0.0", input: { name: "Keeper" }, calculated: { core: 7 }, sparkAccess: true } },
      "S-01": { record: { name: "Selor", seed: "spark1-8-217-1-iuebk69z", kind: "water" } },
      "S-06": { "belief:x": { lines: [{ text: "kept" }] } },
      "I-01": { "garden-1": { subtype: "garden-bed", tended: 3 } },
    },
    plans: [{ id: "plan-1", title: "Tend", done: false, payload: { witnessKind: "kept" } }],
    watch: { positions: { "ep-1": 42 }, completions: { "ep-2": { at: "t" } } },
    spark: { record: { name: "Selor", seed: "spark1-8-217-1-iuebk69z", kind: "water" }, pendingSeed: null, sound: null, voice: null },
    garden: [{ subtype: "garden-bed", tended: 3 }],
    pins: [],
  };
  const deal = dealLines(payload, "2026-11-24T18:00:00.000Z", "phone");
  // Aaron's order: genesis, day, memory, standing.
  const sections = deal.lines.map((l) => l.section);
  assert.deepEqual(sections, [...sections].sort(
    (x, y) => ["genesis", "day", "memory", "standing"].indexOf(x)
      - ["genesis", "day", "memory", "standing"].indexOf(y)));
  const merged = mergeLines(deal.lines, deal.lines);
  assert.equal(merged.conflicts.length, 0);
  const back = payloadFromValues(merged.values);
  assert.equal(canonical(back), canonical(payload));
});

test("account end is TRUE deletion of the door's copy", async () => {
  const store = createDoubleStore();
  const { account } = await signedIn(store);
  const deal = dealLines({
    classes: { "S-01": { record: { name: "Selor" } } },
    plans: [{ id: "p1", title: "x", done: false, payload: {} }],
    watch: { positions: {}, completions: {} },
  }, "2026-11-24T18:00:00.000Z", "phone");
  await pushLines(store, account.id, deal.lines);
  const before = await store.countAll();
  assert.ok(before.accounts === 1 && before.lines === 2);

  const ended = await endAccount(store, account);
  assert.equal(ended.ok, true);
  assert.equal(ended.deleted.lines, 2);
  const after = await store.countAll();
  assert.deepEqual(after, { accounts: 0, magicTokens: 0, lines: 0 });
  const held = await pullLines(store, account.id);
  assert.equal(held.lines.length, 0);
});

test("the function answers end to end against the double", async () => {
  process.env.ACCOUNTS_STORE = "double";
  process.env.ACCOUNTS_SESSION_SECRET = SECRET;
  process.env.ACCOUNTS_DEV_EXPOSE_TOKEN = "1";
  const { default: handler } = await import("../netlify/functions/accounts.mjs");
  const post = (body) => handler(new Request("https://codexofreality.org/.netlify/functions/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));

  const state = await (await handler(new Request(
    "https://codexofreality.org/.netlify/functions/accounts"))).json();
  assert.equal(state.ok, true);
  assert.equal(state.store, "double");
  assert.equal(state.signIn, "email-magic-link");

  const noAdult = await (await post({ action: "request-link", email: "k@e.co", adultConfirmed: false })).json();
  assert.equal(noAdult.ok, false);
  assert.equal(noAdult.reason, "adults-only");

  const link = await (await post({ action: "request-link", email: "k@e.co", adultConfirmed: true })).json();
  assert.equal(link.ok, true);
  assert.equal(typeof link.token, "string");

  const verified = await (await post({ action: "verify", token: link.token })).json();
  assert.equal(verified.ok, true);
  assert.equal(verified.email, "k@e.co");

  const deal = dealLines({
    classes: { "G-01": { p: { id: "p", input: {} } } },
    plans: [], watch: { positions: {}, completions: {} },
  }, "2026-11-24T18:00:00.000Z", "website");
  const pushed = await (await post({ action: "push", session: verified.session, lines: deal.lines })).json();
  assert.equal(pushed.accepted.length, 1);
  const pulled = await (await post({ action: "pull", session: verified.session })).json();
  assert.equal(pulled.lines.length, 1);

  const ended = await (await post({ action: "end-account", session: verified.session })).json();
  assert.equal(ended.ok, true);
  const afterEnd = await (await post({ action: "pull", session: verified.session })).json();
  assert.equal(afterEnd.ok, false);
  assert.equal(afterEnd.reason, "session");
});
