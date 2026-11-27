/*
 * Aiyana's World — the story waiting place.
 *
 * Kids send stories from Aiyana's page. A story NEVER appears
 * anywhere public on its own: it lands here as "pending", and
 * only Aiyana's yes — given in her own dashboard, behind her
 * picture-word gate — moves it to "approved", which is the one
 * list her page reads back. Her "not yet" moves a story to
 * "away": out of her list, never deleted, restorable.
 *
 * Child-safety by construction: a submission carries only a
 * pen name (a made-up story name), a title, and the story.
 * There is no field for a real name, an email, a place, or
 * anything else about the child who wrote it.
 *
 * The store is Netlify Blobs (the durable store built into the
 * site's host — the same machinery the Guide seat uses), behind
 * one small interface. Tests use the in-repo MemoryStoryStore
 * double, which implements the same interface. The gate words
 * live only in the deployment's environment (AIYANA_DASH_WORDS,
 * comma-separated, set by Aaron) — never in this repo. Without
 * them the dashboard side answers "not-ready" and does nothing;
 * submissions and the approved list still work.
 *
 * In front of all of it stands the language guard
 * (aiyana-language-guard.mjs): a submission with bad words is
 * HELD, never delivered to Aiyana, and the held shelf opens
 * only to the parent code (AIYANA_PARENT_CODE, also Aaron's to
 * set). A grown-up can release a held story — the guard then
 * steps aside for that story — or put it away for good.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { submissionIsClean } from "./aiyana-language-guard.mjs";

export const LIMITS = Object.freeze({
  penName: 40,
  title: 80,
  story: 2000,
  submitPerHour: 5,
  gateFailsPerHour: 8,
  sessionMs: 12 * 60 * 60 * 1000
});

const INDEX_KEY = "stories:index";
const storyKey = (id) => `story:${id}`;
const rateKey = (kind, who) => `rate:${kind}:${who}`;

function cleanText(value, max) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+\n/g, "\n")
    .trim()
    .slice(0, max);
}

export function shapeStory(value) {
  if (!value || typeof value !== "object" || !value.id) return null;
  return {
    id: String(value.id),
    penName: cleanText(value.penName, LIMITS.penName) || "a friend",
    title: cleanText(value.title, LIMITS.title) || "A story",
    story: cleanText(value.story, LIMITS.story),
    status: ["pending", "approved", "away", "held"].includes(value.status) ? value.status : "pending",
    ts: Number(value.ts) || 0,
    decidedTs: Number(value.decidedTs) || 0,
    /* A grown-up reviewed a held story and passed it. The
       guard steps aside for that story from then on. */
    parentOk: value.parentOk === true
  };
}

function publicShape(s) {
  return { id: s.id, penName: s.penName, title: s.title, story: s.story, ts: s.ts };
}

/* ------------------------------------------------------------------ */
/* Stores                                                              */
/* ------------------------------------------------------------------ */

/*
 * The store interface, both implementations:
 *   get(key)            -> parsed JSON value or null
 *   set(key, value)     -> stores JSON
 */
export class MemoryStoryStore {
  constructor() {
    this.values = new Map();
  }

  async get(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  async set(key, value) {
    this.values.set(key, value);
  }
}

export class NetlifyBlobsStoryStore {
  constructor(blobs) {
    this.blobs = blobs;
  }

  async get(key) {
    return (await this.blobs.get(key, { type: "json" })) || null;
  }

  async set(key, value) {
    await this.blobs.setJSON(key, value);
  }
}

export async function createProductionStoryStore() {
  const blobs = await import("@netlify/blobs");
  const store = blobs.getStore({ name: "aiyana-stories", consistency: "strong" });
  return new NetlifyBlobsStoryStore(store);
}

/* ------------------------------------------------------------------ */
/* The waiting place                                                   */
/* ------------------------------------------------------------------ */

export function createWaitingPlace({ store, dashWords, parentCode, now = () => Date.now(), makeId }) {
  if (!store) throw new Error("a store is required");
  const idOf =
    makeId ||
    (() => `${now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`);
  const gateReady = Array.isArray(dashWords) && dashWords.length >= 3;
  const parentReady = typeof parentCode === "string" && parentCode.length >= 6;

  async function readIndex() {
    const ids = await store.get(INDEX_KEY);
    return Array.isArray(ids) ? ids.filter((x) => typeof x === "string") : [];
  }

  async function readStory(id) {
    if (typeof id !== "string" || !/^[a-z0-9-]{1,64}$/i.test(id)) return null;
    return shapeStory(await store.get(storyKey(id)));
  }

  async function listByStatus(status) {
    const ids = await readIndex();
    const out = [];
    for (const id of ids) {
      const s = await readStory(id);
      if (s && s.status === status) out.push(s);
    }
    return out;
  }

  /*
   * The guard's second watch: any story on a shelf Aiyana or
   * the public can read is screened again on the way out. One
   * that trips is quietly moved to the held shelf and never
   * served. A story a grown-up already passed (parentOk) is
   * left in peace.
   */
  async function screenedList(status) {
    const all = await listByStatus(status);
    const out = [];
    for (const s of all) {
      if (!s.parentOk && !submissionIsClean(s)) {
        s.status = "held";
        await store.set(storyKey(s.id), s);
        continue;
      }
      out.push(s);
    }
    return out;
  }

  async function rateLimited(kind, who, limit) {
    const key = rateKey(kind, who);
    const hour = Math.floor(now() / 3600000);
    const rec = (await store.get(key)) || {};
    const events = Array.isArray(rec[hour]) ? rec[hour] : [];
    if (events.length >= limit) return true;
    events.push(now());
    await store.set(key, { [hour]: events });
    return false;
  }

  /* ----- the gate: three picture-words, in her order ----- */

  function wordsMatch(given) {
    if (!gateReady || !Array.isArray(given) || given.length !== dashWords.length) return false;
    const norm = (w) => String(w || "").trim().toLowerCase();
    return dashWords.every((w, i) => norm(w) === norm(given[i]));
  }

  function issueSession() {
    const exp = now() + LIMITS.sessionMs;
    const sig = createHmac("sha256", dashWords.join(",")).update(String(exp)).digest("base64url");
    return `${exp}.${sig}`;
  }

  function sessionOk(token) {
    if (!gateReady || typeof token !== "string") return false;
    const dot = token.indexOf(".");
    if (dot < 1) return false;
    const exp = Number(token.slice(0, dot));
    const sig = token.slice(dot + 1);
    if (!Number.isFinite(exp) || exp < now()) return false;
    const want = createHmac("sha256", dashWords.join(",")).update(String(exp)).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(want);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /* ----- actions ----- */

  async function submit(input, who) {
    const penName = cleanText(input?.penName, LIMITS.penName);
    const title = cleanText(input?.title, LIMITS.title);
    const story = cleanText(input?.story, LIMITS.story);
    if (!story) return { ok: false, reason: "empty-story" };
    if (await rateLimited("submit", who, LIMITS.submitPerHour)) {
      return { ok: false, reason: "slow-down" };
    }
    /*
     * The language guard stands here, before anything else can
     * happen to the story. A story that trips it is HELD — kept
     * whole on the grown-ups' shelf, never shown to Aiyana, and
     * the sender hears only that some words need changing.
     */
    const clean = submissionIsClean({ penName, title, story });
    const entry = {
      id: idOf(),
      penName: penName || "a friend",
      title: title || "A story",
      story,
      status: clean ? "pending" : "held",
      ts: now(),
      decidedTs: 0,
      parentOk: false
    };
    await store.set(storyKey(entry.id), entry);
    const ids = await readIndex();
    ids.unshift(entry.id);
    await store.set(INDEX_KEY, ids.slice(0, 500));
    if (!clean) return { ok: false, reason: "words-to-fix" };
    return { ok: true, id: entry.id };
  }

  async function approvedList() {
    return (await screenedList("approved")).map(publicShape);
  }

  async function gate(given, who) {
    if (!gateReady) return { ok: false, reason: "not-ready" };
    if (await rateLimited("gate", who, LIMITS.gateFailsPerHour + 20)) {
      return { ok: false, reason: "slow-down" };
    }
    if (!wordsMatch(given)) {
      await rateLimited("gatefail", who, LIMITS.gateFailsPerHour * 10);
      const fails = await store.get(rateKey("gatefail", who));
      const hour = Math.floor(now() / 3600000);
      const count = Array.isArray(fails?.[hour]) ? fails[hour].length : 0;
      if (count > LIMITS.gateFailsPerHour) return { ok: false, reason: "slow-down" };
      return { ok: false, reason: "wrong-words" };
    }
    return { ok: true, token: issueSession() };
  }

  async function dashboardList(token) {
    if (!sessionOk(token)) return { ok: false, reason: "gate-first" };
    const [pending, approved, away] = await Promise.all([
      screenedList("pending"),
      screenedList("approved"),
      listByStatus("away")
    ]);
    return { ok: true, pending: pending.map(publicShape), approved: approved.map(publicShape), away: away.map(publicShape) };
  }

  async function decide(token, id, status) {
    if (!sessionOk(token)) return { ok: false, reason: "gate-first" };
    const s = await readStory(id);
    if (!s) return { ok: false, reason: "no-such-story" };
    if (s.status === "held") return { ok: false, reason: "held-for-a-grown-up" };
    /* The guard watches the accept move too: a story that
       trips it can never be waved onto her page. */
    if (status === "approved" && !s.parentOk && !submissionIsClean(s)) {
      s.status = "held";
      await store.set(storyKey(s.id), s);
      return { ok: false, reason: "held-for-a-grown-up" };
    }
    s.status = status;
    s.decidedTs = now();
    await store.set(storyKey(s.id), s);
    return { ok: true, id: s.id, status: s.status };
  }

  /* ----- the grown-ups' shelf: held stories ----- */

  function parentOk(code) {
    if (!parentReady || typeof code !== "string") return false;
    const a = Buffer.from(code);
    const b = Buffer.from(parentCode);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async function heldList(code) {
    if (!parentOk(code)) return { ok: false, reason: "parent-code-first" };
    const held = await listByStatus("held");
    return { ok: true, held: held.map(publicShape) };
  }

  async function heldDecide(code, id, status) {
    if (!parentOk(code)) return { ok: false, reason: "parent-code-first" };
    const s = await readStory(id);
    if (!s || s.status !== "held") return { ok: false, reason: "no-such-story" };
    s.status = status;
    s.parentOk = true;
    s.decidedTs = now();
    await store.set(storyKey(s.id), s);
    return { ok: true, id: s.id, status: s.status };
  }

  return {
    gateReady,
    parentReady,
    submit,
    approvedList,
    gate,
    dashboardList,
    accept: (token, id) => decide(token, id, "approved"),
    putAway: (token, id) => decide(token, id, "away"),
    restore: (token, id) => decide(token, id, "pending"),
    heldList,
    heldRelease: (code, id) => heldDecide(code, id, "pending"),
    heldAway: (code, id) => heldDecide(code, id, "away")
  };
}

export function readParentCode(env = process.env) {
  const code = (env.AIYANA_PARENT_CODE || "").trim();
  return code.length >= 6 ? code : null;
}

export function readDashWords(env = process.env) {
  const raw = env.AIYANA_DASH_WORDS || "";
  const words = raw.split(",").map((w) => w.trim().toLowerCase()).filter(Boolean);
  return words.length >= 3 ? words : null;
}
