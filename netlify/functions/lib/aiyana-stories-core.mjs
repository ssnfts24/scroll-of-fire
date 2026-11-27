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

import { submissionIsClean, textIsClean } from "./aiyana-language-guard.mjs";

export const LIMITS = Object.freeze({
  penName: 40,
  title: 80,
  story: 2000,
  welcome: 120,
  about: 400,
  headline: 80,
  authorLine: 40,
  feelLine: 80,
  favourite: 60,
  favouritesMax: 5,
  drawingMax: 220000,
  submitPerHour: 5,
  gateFailsPerHour: 8,
  sessionMs: 12 * 60 * 60 * 1000
});

/*
 * Her page, as it stands today. These are the DEFAULTS: until
 * Aiyana changes something in her dashboard, her page renders
 * exactly this — the settings store stays empty and her page
 * shows what it has always shown. The words match her page's
 * own sign, eyebrow, and intro, word for word (a test pins
 * that). Blocks her page does not have today (her author
 * line, her feel line, her favourite things, a top picture)
 * default to ABSENT — they appear only when she makes them.
 */
export const DEFAULT_PAGE = Object.freeze({
  welcome: "Hi, this is Aiyana\u2019s world, have fun.",
  headline: "A little world inside the Codex",
  about:
    "This is a place where people can show their thinking and express themselves. " +
    "Pick how you feel, pin a thought, draw a picture \u2014 and at the end, you can share a story.",
  authorLine: "",
  banner: null,
  mood: null,
  topPicture: null,
  trim: null,
  featuredId: null,
  storyOrder: [],
  feelLine: "",
  favourites: [],
  showStories: true,
  showFavourites: true,
  showFeel: true,
  storySize: "big"
});

/* The banner colours she may pick for her sign — her own
   palette, named the way she would name them. Nothing
   outside this list can ever reach her page. */
export const BANNERS = Object.freeze([
  { id: "purple", name: "Purple" },
  { id: "sky", name: "Sky Blue" },
  { id: "pink", name: "Pink" },
  { id: "sunny", name: "Sunny Gold" },
  { id: "leaf", name: "Leaf Green" },
  { id: "ginger", name: "Ginger" }
]);
const BANNER_IDS = new Set(BANNERS.map((b) => b.id));

/* Whole-page colour moods, also hers. */
export const MOODS = Object.freeze([
  { id: "sunset", name: "Sunset" },
  { id: "ocean", name: "Ocean" },
  { id: "forest", name: "Forest" },
  { id: "berry", name: "Berry" }
]);
const MOOD_IDS = new Set(MOODS.map((m) => m.id));

/* The trims she can put around her words: drawn things, in
   her style. "none" is a pick too — it is stored as null. */
export const TRIMS = Object.freeze([
  { id: "butterflies", name: "Butterflies" },
  { id: "stars", name: "Stars" },
  { id: "moons", name: "Moons" }
]);
const TRIM_IDS = new Set(TRIMS.map((t) => t.id));

/* Her top picture: pictures that already live on her page,
   plus one she can draw herself in her dashboard. */
export const TOP_PICTURES = Object.freeze([
  { id: "story-drawing", name: "My first story's picture" },
  { id: "my-drawing", name: "A picture I drew" }
]);
const TOP_PICTURE_IDS = new Set(TOP_PICTURES.map((t) => t.id));

const INDEX_KEY = "stories:index";
const PAGE_KEY = "page:settings";
const PAGE_HELD_KEY = "page:settings-held";
const PAGE_PREV_KEY = "page:settings-prev";
const DRAWING_KEY = "page:drawing";
const SPARK_KEY = "spark:record";
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
    status: ["pending", "approved", "away", "held", "mine"].includes(value.status) ? value.status : "pending",
    ts: Number(value.ts) || 0,
    decidedTs: Number(value.decidedTs) || 0,
    /* A story Aiyana wrote herself. It lives on her own shelf
       (status "mine") until SHE taps "put it in my world". */
    mine: value.mine === true,
    /* A grown-up reviewed a held story and passed it. The
       guard steps aside for that story from then on. */
    parentOk: value.parentOk === true
  };
}

const idOrNull = (v) =>
  typeof v === "string" && /^[a-z0-9-]{1,64}$/i.test(v) ? v : null;

/*
 * Her page settings, shaped for keeping. Every field falls
 * back to the page as it stands today; a colour, mood, trim,
 * or picture outside her own lists is no choice at all, and
 * her story order keeps only story-shaped ids, once each.
 */
export function shapePage(value) {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_PAGE, storyOrder: [], favourites: [], parentOk: false };
  }
  const order = [];
  if (Array.isArray(value.storyOrder)) {
    for (const id of value.storyOrder) {
      const clean = idOrNull(id);
      if (clean && !order.includes(clean)) order.push(clean);
      if (order.length >= 100) break;
    }
  }
  const favourites = [];
  if (Array.isArray(value.favourites)) {
    for (const f of value.favourites) {
      const clean = cleanText(f, LIMITS.favourite);
      if (clean) favourites.push(clean);
      if (favourites.length >= LIMITS.favouritesMax) break;
    }
  }
  return {
    welcome: cleanText(value.welcome, LIMITS.welcome) || DEFAULT_PAGE.welcome,
    headline: cleanText(value.headline, LIMITS.headline) || DEFAULT_PAGE.headline,
    about: cleanText(value.about, LIMITS.about) || DEFAULT_PAGE.about,
    authorLine: cleanText(value.authorLine, LIMITS.authorLine),
    banner: BANNER_IDS.has(value.banner) ? value.banner : null,
    mood: MOOD_IDS.has(value.mood) ? value.mood : null,
    topPicture: TOP_PICTURE_IDS.has(value.topPicture) ? value.topPicture : null,
    trim: TRIM_IDS.has(value.trim) ? value.trim : null,
    featuredId: idOrNull(value.featuredId),
    storyOrder: order,
    feelLine: cleanText(value.feelLine, LIMITS.feelLine),
    favourites,
    showStories: value.showStories !== false,
    showFavourites: value.showFavourites !== false,
    showFeel: value.showFeel !== false,
    storySize: value.storySize === "bigger" ? "bigger" : "big",
    /* A grown-up passed these words; the guard steps aside. */
    parentOk: value.parentOk === true
  };
}

/* Every public word she writes passes the guard — her
   welcome, her headline, her about-me, her author line, her
   feel line, and every favourite thing. */
function pageIsClean(page) {
  return (
    textIsClean(page.welcome) &&
    textIsClean(page.headline) &&
    textIsClean(page.about) &&
    textIsClean(page.authorLine) &&
    textIsClean(page.feelLine) &&
    page.favourites.every((f) => textIsClean(f))
  );
}

/*
 * Her Spark's record, shaped for keeping. The Spark itself is
 * generated by the site's own Spark core on her dashboard
 * (seed → the same Spark anywhere); this store is only its
 * memory, kept behind her gate so the same Spark meets her on
 * any device. The shaper keeps the canonical record's own
 * fields and nothing else, and a record whose seed does not
 * speak the seed's language is no record at all.
 */
const SEED_RE = /^spark1-(\d{1,2})-(\d{1,3})-(\d)-([a-z0-9]{1,24})$/;

export function seedSpeaks(seed) {
  if (typeof seed !== "string") return false;
  const m = SEED_RE.exec(seed);
  if (!m) return false;
  const moon = Number(m[1]);
  const day = Number(m[2]);
  const kind = Number(m[3]);
  return moon >= 0 && moon <= 13 && day >= 1 && day <= 365 && kind >= 0 && kind <= 5;
}

const dayList = (v) => {
  if (!Array.isArray(v)) return [];
  const out = [...new Set(v.filter((n) => Number.isInteger(n) && n >= 1 && n <= 365))];
  return out.sort((a, b) => a - b).slice(0, 366);
};
const num0 = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const dayOrNull = (v) => (Number.isInteger(v) && v >= 1 && v <= 365 ? v : null);

export function shapeSparkRecord(value) {
  if (!value || typeof value !== "object" || !seedSpeaks(value.seed)) return null;
  const care = value.care && typeof value.care === "object" ? value.care : {};
  const play = value.play && typeof value.play === "object" ? value.play : {};
  return {
    version: 1,
    wrap: num0(value.wrap),
    seed: value.seed,
    name: cleanText(value.name, 24),
    bornCivil: typeof value.bornCivil === "string" ? value.bornCivil.slice(0, 24) : null,
    daysSeen: dayList(value.daysSeen),
    pagesSeen: Array.isArray(value.pagesSeen)
      ? [...new Set(value.pagesSeen.filter((p) => typeof p === "string").map((p) => p.slice(0, 80)))].slice(0, 60)
      : [],
    practiceDays: dayList(value.practiceDays),
    lastDay: dayOrNull(value.lastDay),
    lastPage: typeof value.lastPage === "string" ? value.lastPage.slice(0, 80) : null,
    prevPage: typeof value.prevPage === "string" ? value.prevPage.slice(0, 80) : null,
    stageSeen: num0(value.stageSeen),
    care: {
      kindles: num0(care.kindles),
      plays: num0(care.plays),
      rests: num0(care.rests),
      bond: num0(care.bond),
      kindleDay: dayOrNull(care.kindleDay),
      playDay: dayOrNull(care.playDay),
      playCount: num0(care.playCount),
      restDay: dayOrNull(care.restDay)
    },
    play: {
      pets: num0(play.pets),
      pokes: num0(play.pokes),
      drags: num0(play.drags),
      catches: num0(play.catches),
      bestChase: num0(play.bestChase),
      echoBest: num0(play.echoBest),
      tricks: Array.isArray(play.tricks)
        ? [...new Set(play.tricks.filter((t) => typeof t === "string").map((t) => t.slice(0, 40)))].slice(0, 40)
        : [],
      askedDay: dayOrNull(play.askedDay)
    },
    revealsSeen: Array.isArray(value.revealsSeen)
      ? [...new Set(value.revealsSeen.filter((t) => typeof t === "string").map((t) => t.slice(0, 40)))].slice(0, 60)
      : []
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
    const [pending, approved, away, mine, page] = await Promise.all([
      screenedList("pending"),
      screenedList("approved"),
      listByStatus("away"),
      listByStatus("mine"),
      readPage()
    ]);
    return {
      ok: true,
      pending: pending.map(publicShape),
      approved: approved.map(publicShape),
      away: away.map(publicShape),
      /* Her own stories are hers — they are NOT screened on
         the way to her own shelf. The guard meets them at the
         door to the public page, when she publishes. */
      mine: mine.map(publicShape),
      page: publicPage(page)
    };
  }

  /* ----- her own stories ----- */

  async function writeMine(token, input) {
    if (!sessionOk(token)) return { ok: false, reason: "gate-first" };
    const title = cleanText(input?.title, LIMITS.title);
    const story = cleanText(input?.story, LIMITS.story);
    if (!story) return { ok: false, reason: "empty-story" };
    const entry = {
      id: idOf(),
      penName: "Aiyana",
      title: title || "My story",
      story,
      status: "mine",
      ts: now(),
      decidedTs: 0,
      mine: true,
      parentOk: false
    };
    await store.set(storyKey(entry.id), entry);
    const ids = await readIndex();
    ids.unshift(entry.id);
    await store.set(INDEX_KEY, ids.slice(0, 500));
    return { ok: true, id: entry.id };
  }

  async function editMine(token, id, input) {
    if (!sessionOk(token)) return { ok: false, reason: "gate-first" };
    const s = await readStory(id);
    if (!s || !s.mine || s.status !== "mine") return { ok: false, reason: "no-such-story" };
    const story = cleanText(input?.story, LIMITS.story);
    if (!story) return { ok: false, reason: "empty-story" };
    s.title = cleanText(input?.title, LIMITS.title) || "My story";
    s.story = story;
    await store.set(storyKey(s.id), s);
    return { ok: true, id: s.id };
  }

  /*
   * Her tap on "put it in my world". The guard stands at this
   * door exactly as it stands at the submission door: a story
   * that trips it is HELD for a grown-up, never published, and
   * she hears the same kind message with no words named.
   */
  async function publishMine(token, id) {
    if (!sessionOk(token)) return { ok: false, reason: "gate-first" };
    const s = await readStory(id);
    if (!s || !s.mine || s.status !== "mine") return { ok: false, reason: "no-such-story" };
    if (!s.parentOk && !submissionIsClean(s)) {
      s.status = "held";
      await store.set(storyKey(s.id), s);
      return { ok: false, reason: "words-to-fix" };
    }
    s.status = "approved";
    s.decidedTs = now();
    await store.set(storyKey(s.id), s);
    return { ok: true, id: s.id, status: s.status };
  }

  /* ----- her page: the blocks that are hers to change ----- */

  async function readPage() {
    return shapePage(await store.get(PAGE_KEY));
  }

  /*
   * What her page may show: her stored choices, screened
   * again on the way out. A word that trips and was never
   * passed by a grown-up falls back to the page as it stands
   * today — a bad word can never reach her page by a side
   * road. Her featured story and her story order keep only
   * stories that truly stand on her page.
   */
  function publicPage(page) {
    const ok = (text) => page.parentOk || textIsClean(text);
    return {
      welcome: ok(page.welcome) ? page.welcome : DEFAULT_PAGE.welcome,
      headline: ok(page.headline) ? page.headline : DEFAULT_PAGE.headline,
      about: ok(page.about) ? page.about : DEFAULT_PAGE.about,
      authorLine: ok(page.authorLine) ? page.authorLine : "",
      banner: page.banner,
      mood: page.mood,
      topPicture: page.topPicture,
      trim: page.trim,
      featuredId: page.featuredId,
      storyOrder: page.storyOrder,
      feelLine: ok(page.feelLine) ? page.feelLine : "",
      favourites: page.favourites.filter((f) => ok(f)),
      showStories: page.showStories,
      showFavourites: page.showFavourites,
      showFeel: page.showFeel,
      storySize: page.storySize
    };
  }

  async function pagePublic() {
    const page = await readPage();
    const out = publicPage(page);
    const standing = new Set((await listByStatus("approved")).map((s) => s.id));
    if (out.featuredId && !standing.has(out.featuredId)) out.featuredId = null;
    out.storyOrder = out.storyOrder.filter((id) => standing.has(id));
    if (out.topPicture === "my-drawing" && !(await store.get(DRAWING_KEY))) {
      out.topPicture = null;
    }
    return out;
  }

  /*
   * Publishing her page. This is her YES: the guard screens
   * BEFORE anything is kept as her live page — a publish that
   * trips is held whole on the grown-ups' shelf (her live
   * page does not change) and she hears the same kind
   * message. Every publish keeps the version before it, so
   * her "put it back" always has somewhere to go.
   */
  async function pageSave(token, input) {
    if (!sessionOk(token)) return { ok: false, reason: "gate-first" };
    const page = shapePage({ ...(input || {}), parentOk: false });
    const standing = new Set((await listByStatus("approved")).map((s) => s.id));
    if (page.featuredId && !standing.has(page.featuredId)) page.featuredId = null;
    page.storyOrder = page.storyOrder.filter((id) => standing.has(id));
    if (!pageIsClean(page)) {
      await store.set(PAGE_HELD_KEY, page);
      return { ok: false, reason: "words-to-fix" };
    }
    const current = await store.get(PAGE_KEY);
    await store.set(PAGE_PREV_KEY, shapePage(current));
    await store.set(PAGE_KEY, page);
    return { ok: true, page: publicPage(page) };
  }

  /* Her "put it back": the live page and the kept previous
     version trade places — so putting back can itself be put
     back, and nothing she made is ever lost by the swap. */
  async function pageRestore(token) {
    if (!sessionOk(token)) return { ok: false, reason: "gate-first" };
    const prev = await store.get(PAGE_PREV_KEY);
    if (!prev) return { ok: false, reason: "nothing-to-put-back" };
    const current = await store.get(PAGE_KEY);
    await store.set(PAGE_KEY, prev);
    await store.set(PAGE_PREV_KEY, current ? shapePage(current) : null);
    return { ok: true, page: publicPage(shapePage(prev)) };
  }

  async function pageState(token) {
    if (!sessionOk(token)) return { ok: false, reason: "gate-first" };
    const page = await readPage();
    const prev = await store.get(PAGE_PREV_KEY);
    return { ok: true, page: publicPage(page), hasPrev: !!prev };
  }

  /* ----- her drawing: a picture she drew, kept as a choice ----- */

  async function drawingSave(token, input) {
    if (!sessionOk(token)) return { ok: false, reason: "gate-first" };
    const data = typeof input?.dataUrl === "string" ? input.dataUrl : "";
    if (!/^data:image\/(jpeg|png);base64,/.test(data) || data.length > LIMITS.drawingMax) {
      return { ok: false, reason: "not-a-picture" };
    }
    await store.set(DRAWING_KEY, { dataUrl: data, ts: now() });
    return { ok: true };
  }

  async function drawingPublic() {
    const held = await store.get(DRAWING_KEY);
    return held && typeof held.dataUrl === "string" ? held.dataUrl : null;
  }

  /* ----- her Spark: one meeting, one record, behind her gate ----- */

  async function sparkGet(token) {
    if (!sessionOk(token)) return { ok: false, reason: "gate-first" };
    const record = shapeSparkRecord(await store.get(SPARK_KEY));
    return { ok: true, record };
  }

  /*
   * The meeting is ONCE. The first record kept is her Spark,
   * forever: a later meeting attempt — from any device, with
   * any seed — is handed the Spark who already stands, and
   * the new seed is set aside untouched. Nothing in this
   * store can replace or delete her Spark.
   */
  async function sparkMeet(token, input) {
    if (!sessionOk(token)) return { ok: false, reason: "gate-first" };
    const existing = shapeSparkRecord(await store.get(SPARK_KEY));
    if (existing) return { ok: true, record: existing, created: false };
    const record = shapeSparkRecord(input?.record);
    if (!record || record.seed !== input?.seed) return { ok: false, reason: "seed-does-not-speak" };
    await store.set(SPARK_KEY, record);
    return { ok: true, record, created: true };
  }

  /* Her Spark grows — but it can only ever grow INTO itself:
     a save whose seed is not her Spark's seed is refused, so
     growth can never swap one Spark for another. */
  async function sparkSave(token, input) {
    if (!sessionOk(token)) return { ok: false, reason: "gate-first" };
    const existing = shapeSparkRecord(await store.get(SPARK_KEY));
    if (!existing) return { ok: false, reason: "no-spark-yet" };
    const record = shapeSparkRecord(input?.record);
    if (!record || record.seed !== existing.seed) return { ok: false, reason: "not-her-spark" };
    await store.set(SPARK_KEY, record);
    return { ok: true, record };
  }

  /* ----- the grown-ups' shelf: her held page words ----- */

  async function pageHeldList(code) {
    if (!parentOk(code)) return { ok: false, reason: "parent-code-first" };
    const held = await store.get(PAGE_HELD_KEY);
    if (!held) return { ok: true, held: null };
    const page = shapePage(held);
    const { parentOk: _drop, ...words } = page;
    return { ok: true, held: words };
  }

  async function pageHeldRelease(code) {
    if (!parentOk(code)) return { ok: false, reason: "parent-code-first" };
    const held = await store.get(PAGE_HELD_KEY);
    if (!held) return { ok: false, reason: "nothing-held" };
    const page = shapePage(held);
    page.parentOk = true;
    const current = await store.get(PAGE_KEY);
    await store.set(PAGE_PREV_KEY, shapePage(current));
    await store.set(PAGE_KEY, page);
    await store.set(PAGE_HELD_KEY, null);
    return { ok: true };
  }

  /* Aaron's road back to the page as it stands today: the
     live settings are set aside (kept as the previous
     version, so even this can be put back), and her page
     renders its defaults again. */
  async function pageDefaults(code) {
    if (!parentOk(code)) return { ok: false, reason: "parent-code-first" };
    const current = await store.get(PAGE_KEY);
    if (current) await store.set(PAGE_PREV_KEY, shapePage(current));
    await store.set(PAGE_KEY, null);
    return { ok: true };
  }

  async function pageHeldAway(code) {
    if (!parentOk(code)) return { ok: false, reason: "parent-code-first" };
    await store.set(PAGE_HELD_KEY, null);
    return { ok: true };
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
    /* One of her own stories goes back to her own shelf,
       not into the waiting queue. */
    s.status = status === "pending" && s.mine ? "mine" : status;
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
    writeMine,
    editMine,
    publishMine,
    pagePublic,
    pageSave,
    pageRestore,
    pageState,
    drawingSave,
    drawingPublic,
    sparkGet,
    sparkMeet,
    sparkSave,
    heldList,
    heldRelease: (code, id) => heldDecide(code, id, "pending"),
    heldAway: (code, id) => heldDecide(code, id, "away"),
    pageHeldList,
    pageHeldRelease,
    pageHeldAway,
    pageDefaults
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
