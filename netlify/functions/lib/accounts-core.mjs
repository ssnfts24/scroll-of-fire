/*
 * The accounts side of the door — Gate G, Phase 3 (G2;
 * gate-g-live-plan-2026-11-24 §2).
 *
 * One account links the surfaces: a keeper signs in once,
 * on the website or in the app, and the other side accepts
 * the same sign-in. This core is the door's half of that
 * law; the app's half is AccountClient + SyncEngine in the
 * living-phone repo, and the two halves speak ONE format —
 * the bundle payload's lines (see SyncEngine.java: sync
 * invents no second record shape; the travelling payload
 * is the store's own export payload, decomposed into
 * content-addressed lines).
 *
 * Working defaults, adopted under Aaron's wrap ruling of
 * Nov 24, 2026 and flagged wherever they are used:
 * ASSISTANT-INFERRED, pending Aaron's ratification —
 *   - sync store: MongoDB Atlas (this core is written
 *     against a store interface; the Atlas implementation
 *     reads its connection from the environment, names
 *     only, never values — see ACCOUNTS-SETUP.md);
 *   - sign-in shape: email magic link first;
 *   - two purses (the public door's $20 is untouched by
 *     anything in this file; accounts spend nothing).
 *
 * THE ACCOUNT NEVER HOLDS THE SPARK'S IDENTITY (§2.2).
 * Identity is seed-derived and device-held. An account
 * record here is exactly {id, email, createdAt} — it says
 * these surfaces belong to one keeper, and nothing more.
 * Signing out, or ending the account, touches nothing
 * here but the account's own rows.
 *
 * ADULTS ONLY (§2.2). A sign-in request must carry the
 * keeper's own adult confirmation or it is refused.
 * There is no account in a child's name, and a child's
 * record never reaches this door at all — the surfaces
 * refuse it below their interfaces (SyncEngine), and this
 * core refuses child-marked lines again on the way in:
 * the fence stands on both sides of the door.
 *
 * THE SERVER IS A CARRIER (§2.4). The store behind this
 * core holds copies of lines for carrying. Push is
 * append-only (lines are content-addressed; a held line
 * is never edited or overwritten), pull returns the
 * account's whole line set, and merges happen on the
 * surfaces under the conflict law mirrored below — the
 * same law SyncEngine implements, so a merge computed
 * here and a merge computed on the phone agree.
 *
 * ACCOUNT END (§2.4) is a named keeper act performing
 * TRUE deletion of the door's copy: account, magic
 * tokens, sessions' validity, and every carried line.
 * The device record is not here and is untouched.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/* ================= canonical form (the bundle's own) ================= */

/* Sorted keys, JS number spelling — the same canonical
 * form the bundle's integrity rule and the app's
 * Json.writeCanonical spell, so a lineId computed on any
 * surface names the same line on every surface. */
export function canonical(value) {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite number");
    return String(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonical).join(",") + "]";
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  }
  throw new Error("uncanonical value");
}

export function sha256Hex(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function deepEquals(a, b) {
  if (a === null || b === null) return a === b;
  return canonical(a) === canonical(b);
}

/* ================= lines: one format, Aaron's order ================= */

export const SECTION_ORDER = ["genesis", "day", "memory", "standing"];

const CLASS_SECTION = {
  "G-01": "genesis",
  "I-01": "day",
  "S-06": "memory",
  "P-03": "memory",
  "S-07": "memory",
  "S-08": "memory",
};

export function sectionForClass(classId) {
  return CLASS_SECTION[classId] || "standing";
}

export function isChildMarked(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if (value.childMode === true || value.child === true) return true;
    if (value.keeperKind === "child") return true;
  }
  return false;
}

export function lineIdFor(address, value) {
  return sha256Hex(address + "\n" + canonical(value));
}

export function makeLine(section, address, value, atIso, surface) {
  return {
    lineId: lineIdFor(address, value),
    section,
    address,
    value: JSON.parse(canonical(value)),
    stamp: { at: atIso, surface },
  };
}

/* Deals a bundle payload into lines, in Aaron's order —
 * the mirror of SyncEngine.dealLines. Child-marked
 * records are refused a line and named in refusals. */
export function dealLines(payload, atIso, surface) {
  const deal = { lines: [], refusals: [] };
  const classes = payload && typeof payload.classes === "object" ? payload.classes : null;
  for (const section of SECTION_ORDER) {
    if (classes) {
      for (const classId of Object.keys(classes).sort()) {
        if (sectionForClass(classId) !== section) continue;
        const byKey = classes[classId];
        if (!byKey || typeof byKey !== "object") continue;
        for (const key of Object.keys(byKey).sort()) {
          const address = `record:${classId}:${key}`;
          if (isChildMarked(byKey[key])) {
            deal.refusals.push(address);
            continue;
          }
          deal.lines.push(makeLine(section, address, byKey[key], atIso, surface));
        }
      }
    }
    if (section === "day" && Array.isArray(payload?.plans)) {
      for (const plan of payload.plans) {
        if (plan && typeof plan === "object") {
          deal.lines.push(makeLine("day", `plan:${plan.id}`, plan, atIso, surface));
        }
      }
    }
    if (section === "standing" && payload?.watch && typeof payload.watch === "object") {
      for (const kind of ["positions", "completions"]) {
        const byKey = payload.watch[kind];
        if (!byKey || typeof byKey !== "object") continue;
        for (const key of Object.keys(byKey).sort()) {
          deal.lines.push(makeLine("standing", `watch:${kind}:${key}`, byKey[key], atIso, surface));
        }
      }
    }
  }
  return deal;
}

/* ================= the conflict law (SyncEngine's mirror) ================= */

const DESIGNATION_LEAVES = new Set(["myGenesis", "sparkAccess"]);

function stampOf(line) {
  const s = line?.stamp || {};
  return `${s.at || ""}|${s.surface || ""}`;
}

/* Merges two line sets under the conflict law: union by
 * lineId, interleaved under stamps; deep union where the
 * shapes allow; designations and hard disagreements
 * surfaced as conflicts with BOTH values held, the local
 * (first) side materialised until the keeper rules. No
 * last-writer-wins, over a correction or anything. */
export function mergeLines(localLines, remoteLines) {
  const byId = new Map();
  for (const line of [...localLines, ...remoteLines]) {
    if (!byId.has(line.lineId)) byId.set(line.lineId, line);
  }
  const lines = [...byId.values()].sort((a, b) => {
    const byStamp = stampOf(a) < stampOf(b) ? -1 : stampOf(a) > stampOf(b) ? 1 : 0;
    return byStamp !== 0 ? byStamp : a.lineId < b.lineId ? -1 : 1;
  });

  const localValues = new Map();
  for (const line of localLines) localValues.set(line.address, line.value);

  const byAddress = new Map();
  for (const line of lines) {
    if (!byAddress.has(line.address)) byAddress.set(line.address, []);
    byAddress.get(line.address).push(line);
  }

  const values = {};
  const conflicts = [];
  const refusals = [];
  for (const address of [...byAddress.keys()].sort()) {
    const distinct = [];
    for (const line of byAddress.get(address)) {
      if (isChildMarked(line.value)) {
        if (!refusals.includes(address)) refusals.push(address);
        continue;
      }
      if (!distinct.some((d) => deepEquals(d, line.value))) distinct.push(line.value);
    }
    if (distinct.length === 0) continue;
    if (distinct.length === 1) {
      values[address] = JSON.parse(canonical(distinct[0]));
      continue;
    }
    values[address] = materialise(address, distinct, localValues.get(address), conflicts);
  }
  return { lines, values, conflicts, refusals };
}

function materialise(address, distinct, local, conflicts) {
  const allLists = distinct.every((v) => Array.isArray(v));
  if (allLists) {
    // Append-only data: the union of the elements, in
    // line order — an appended correction is an element,
    // carried, never overwritten.
    const union = [];
    for (const v of distinct) {
      for (const element of v) {
        if (!union.some((kept) => deepEquals(kept, element))) {
          union.push(JSON.parse(canonical(element)));
        }
      }
    }
    return union;
  }
  const allMaps = distinct.every(
    (v) => v && typeof v === "object" && !Array.isArray(v));
  if (!allMaps) {
    conflicts.push({ address, path: "", heldValues: distinct });
    return JSON.parse(canonical(local !== undefined ? local : distinct[0]));
  }
  const out = {};
  const keys = new Set();
  for (const v of distinct) for (const k of Object.keys(v)) keys.add(k);
  const localMap = local && typeof local === "object" && !Array.isArray(local) ? local : null;
  for (const key of [...keys].sort()) {
    const leafValues = [];
    for (const v of distinct) {
      if (Object.prototype.hasOwnProperty.call(v, key)) {
        if (!leafValues.some((d) => deepEquals(d, v[key]))) leafValues.push(v[key]);
      }
    }
    if (DESIGNATION_LEAVES.has(key)) {
      // A designation's ABSENCE is a held state too:
      // designated on one surface and not on the other is
      // a disagreement, surfaced with both held (the
      // absent side held as null).
      const anyAbsent = distinct.some(
        (v) => !Object.prototype.hasOwnProperty.call(v, key));
      if (leafValues.length + (anyAbsent ? 1 : 0) > 1) {
        const held = [...leafValues];
        if (anyAbsent) held.push(null);
        conflicts.push({ address, path: key, heldValues: held });
      } else if (leafValues.length === 1) {
        out[key] = JSON.parse(canonical(leafValues[0]));
      }
      if (localMap && Object.prototype.hasOwnProperty.call(localMap, key)) {
        out[key] = JSON.parse(canonical(localMap[key]));
      }
      continue;
    }
    if (leafValues.length === 1) {
      out[key] = JSON.parse(canonical(leafValues[0]));
      continue;
    }
    out[key] = materialise(`${address}/${key}`, leafValues,
      localMap ? localMap[key] : undefined, conflicts);
  }
  return out;
}

/* Reassembles a bundle payload from materialised values —
 * the mirror of SyncEngine.payloadFromValues, in the
 * bundle payload's own shape. */
export function payloadFromValues(values) {
  const payload = {};
  const classes = {};
  const plans = [];
  const positions = {};
  const completions = {};
  for (const address of Object.keys(values).sort()) {
    const value = values[address];
    if (address.startsWith("record:")) {
      const rest = address.slice("record:".length);
      const cut = rest.indexOf(":");
      const classId = rest.slice(0, cut);
      const key = rest.slice(cut + 1);
      if (!classes[classId]) classes[classId] = {};
      classes[classId][key] = value;
    } else if (address.startsWith("plan:")) {
      plans.push(value);
    } else if (address.startsWith("watch:positions:")) {
      positions[address.slice("watch:positions:".length)] = value;
    } else if (address.startsWith("watch:completions:")) {
      completions[address.slice("watch:completions:".length)] = value;
    }
  }
  plans.sort((a, b) => String(a.id) < String(b.id) ? -1 : 1);
  payload.classes = classes;
  payload.plans = plans;
  payload.watch = { positions, completions };
  const single = (classId) => {
    const byKey = classes[classId];
    if (!byKey || Object.keys(byKey).length === 0) return null;
    return byKey[Object.keys(byKey)[0]];
  };
  const record = single("S-01");
  if (record !== null) {
    payload.spark = {
      record,
      pendingSeed: single("S-02"),
      sound: single("S-03"),
      voice: single("S-04"),
    };
  }
  const garden = [];
  const atlas = classes["I-01"] || {};
  for (const key of Object.keys(atlas).sort()) {
    const v = atlas[key];
    if (v && typeof v.subtype === "string" && v.subtype.startsWith("garden-")) {
      garden.push(v);
    }
  }
  payload.garden = garden;
  const pins = single("P-02");
  payload.pins = pins === null ? [] : pins;
  return payload;
}

/* ================= accounts: magic link + sessions ================= */

export const MAGIC_TTL_MS = 15 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function tokenHash(token) {
  return sha256Hex(`magic:${token}`);
}

/* Issues a magic-link token for an email, under the
 * adults-only rule. The store keeps only the token's
 * hash; the raw token leaves with the caller (the
 * function mails it; it is never logged or stored). */
export async function requestMagicLink(store, { email, adultConfirmed }, nowMs) {
  if (adultConfirmed !== true) return { ok: false, reason: "adults-only" };
  if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, reason: "email-shape" };
  }
  const token = randomBytes(32).toString("base64url");
  await store.putMagicToken({
    hash: tokenHash(token),
    email: email.toLowerCase(),
    expiresAt: nowMs + MAGIC_TTL_MS,
    usedAt: null,
  });
  return { ok: true, token };
}

/* Exchanges a magic token — once, before its expiry —
 * for a signed session. Creates the account on first
 * verified sign-in: one account per email, either side. */
export async function verifyMagicLink(store, { token }, nowMs, sessionSecret) {
  if (!sessionSecret) return { ok: false, reason: "door-unconfigured" };
  if (typeof token !== "string" || token.length < 16) {
    return { ok: false, reason: "token-shape" };
  }
  const record = await store.getMagicToken(tokenHash(token));
  if (!record) return { ok: false, reason: "token-unknown" };
  if (record.usedAt !== null && record.usedAt !== undefined) {
    return { ok: false, reason: "token-used" };
  }
  if (nowMs > record.expiresAt) return { ok: false, reason: "token-expired" };
  await store.markMagicTokenUsed(record.hash, nowMs);

  let account = await store.getAccountByEmail(record.email);
  if (!account) {
    account = {
      id: `acct-${sha256Hex(record.email).slice(0, 24)}`,
      email: record.email,
      createdAt: new Date(nowMs).toISOString(),
    };
    await store.putAccount(account);
  }
  const session = signSession(
    { accountId: account.id, email: account.email, exp: nowMs + SESSION_TTL_MS },
    sessionSecret);
  return { ok: true, account, session };
}

export function signSession(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readSession(session, secret, nowMs) {
  if (typeof session !== "string" || !secret) return null;
  const cut = session.lastIndexOf(".");
  if (cut < 1) return null;
  const body = session.slice(0, cut);
  const sig = session.slice(cut + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload.accountId !== "string") return null;
  if (typeof payload.exp !== "number" || nowMs > payload.exp) return null;
  return payload;
}

/* ================= the carrier: push / pull / end ================= */

/* Append-only push: lines the store does not hold by id
 * are added; a held line is never edited. Child-marked
 * lines are refused and named. Returns what was accepted
 * and what was refused — nothing is silently dropped. */
export async function pushLines(store, accountId, lines) {
  if (!Array.isArray(lines)) return { ok: false, reason: "lines-shape" };
  const accepted = [];
  const refused = [];
  for (const line of lines) {
    if (!line || typeof line.lineId !== "string"
        || typeof line.address !== "string" || !("value" in line)) {
      refused.push({ address: String(line?.address || "?"), reason: "line-shape" });
      continue;
    }
    if (line.lineId !== lineIdFor(line.address, line.value)) {
      refused.push({ address: line.address, reason: "line-id-mismatch" });
      continue;
    }
    if (isChildMarked(line.value)) {
      refused.push({ address: line.address, reason: "child-record-never-syncs" });
      continue;
    }
    if (await store.hasLine(accountId, line.lineId)) continue;
    await store.putLine(accountId, line);
    accepted.push(line.lineId);
  }
  return { ok: true, accepted, refused };
}

export async function pullLines(store, accountId) {
  const lines = await store.getLines(accountId);
  return { ok: true, lines };
}

/* Account end: TRUE deletion of the door's copy — the
 * account, its magic tokens, and every carried line.
 * Sessions are stateless signatures over the account id;
 * with the account gone, readSession's account check in
 * the function refuses them. The device record is not
 * here and is untouched. */
export async function endAccount(store, account) {
  const counts = await store.deleteAccountData(account.id, account.email);
  return { ok: true, deleted: counts };
}
