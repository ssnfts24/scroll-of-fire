/*
 * The Spark leans toward its keeper (Aaron, Nov 26, 2026).
 *
 * "Based on how the user interacts with the Spark, the Spark
 * should grow from that… the coding grows towards the user —
 * what the user is searching, what the user's looking for."
 *
 * The growth lives where Aaron's standing rules put it: in a
 * plain local record the keeper can read, reset, and reverse —
 * never in silent self-editing code. This module counts, on this
 * device only, what the keeper actually does with the Spark:
 * rooms walked, searches made, cards found, days sealed, and
 * the moments that moved them. From those counts it derives
 * leanings, and from the leanings ONE clear offer at a time —
 * the standing rule: the Spark brings one clear thing at the
 * right time, and remembers a "no" (a refused offer sleeps for
 * a full Moon; an accepted season is never nagged twice).
 *
 * Pure and storage-injected, like the cards core: the browser
 * layer passes localStorage; tests pass a shim. The core never
 * computes dates — the layer hands it the Pattern Day.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.SparkLean = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STORE_KEY = "sof.spark.lean.v1";
  const REFUSAL_SLEEP_DAYS = 28; // a "no" is remembered for a Moon
  const OFFER_REST_DAYS = 7;     // a shown offer rests a week

  /* Which leaning a room or an act feeds. Pages are named the
   * way the site names them; acts are the find-flow's own words. */
  const ROOM_LEANINGS = {
    "living-time-sphere.html": "sphere",
    "moons.html": "sphere",
    "garden.html": "garden",
    "card-album.html": "cards",
    "companions.html": "home",
    "one-word.html": "study",
    "teach.html": "study",
    "episodes.html": "story",
    "index.html": "home"
  };
  const ACT_LEANINGS = {
    find: "cards",
    seal: "day",
    search: "study",
    match: "cards",
    tend: "garden",
    watch: "story"
  };

  function emptyState() {
    return {
      v: 1,
      counts: {},        // "room:garden.html" / "act:find" -> n
      hours: {},         // hour bucket "morning" -> visits
      lastRoom: null,
      lastDay: null,
      moved: null,       // { text, href, day } — the last thing that moved them
      refusals: {},      // offerId -> patternDay refused
      shown: {},         // offerId -> patternDay last shown
      lastPathIndex: null
    };
  }

  function hourBucket(hour) {
    if (typeof hour !== "number" || Number.isNaN(hour)) return null;
    if (hour < 5) return "deep night";
    if (hour < 11) return "morning";
    if (hour < 14) return "midday";
    if (hour < 18) return "afternoon";
    if (hour < 22) return "evening";
    return "night";
  }

  function leaningsFor(state) {
    const tally = {};
    for (const [key, n] of Object.entries((state && state.counts) || {})) {
      const [kind, name] = key.split(":");
      const leaning = kind === "room" ? ROOM_LEANINGS[name] : ACT_LEANINGS[name];
      if (leaning) tally[leaning] = (tally[leaning] || 0) + n;
    }
    return Object.entries(tally)
      .map(([leaning, count]) => ({ leaning, count }))
      .sort((a, b) => b.count - a.count || (a.leaning < b.leaning ? -1 : 1));
  }

  /* The offer catalogue: one honest door per leaning. Every
   * href is a real room of the site; nothing here invents a
   * destination. */
  const OFFERS = [
    { id: "lean-study", leaning: "study", text: "A word is waiting where you left the study.", href: "one-word.html", label: "One Word a Day" },
    { id: "lean-garden", leaning: "garden", text: "The garden keeps the hours you give it.", href: "garden.html", label: "Walk the garden" },
    { id: "lean-cards", leaning: "cards", text: "Your album — and the table — are where you left them.", href: "card-album.html", label: "Open the album" },
    { id: "lean-sphere", leaning: "sphere", text: "The Sphere is standing in today, same as you.", href: "living-time-sphere.html", label: "Stand in the Sphere" },
    { id: "lean-story", leaning: "story", text: "The story is on its shelf where you left it.", href: "episodes.html", label: "The story films" },
    { id: "lean-day", leaning: "day", text: "Today has not been sealed yet.", href: "index.html", label: "See today" }
  ];

  /* Choose the ONE offer, or none. A refused offer sleeps a
   * Moon; a shown offer rests a week; the warmth (the moved
   * moment) outranks leanings when it has had a day to become
   * a memory. ctx: { day, sealedToday } */
  function chooseOffer(state, ctx) {
    const day = ctx && typeof ctx.day === "number" ? ctx.day : null;
    const asleep = (id, table, span) => {
      const at = table && table[id];
      return typeof at === "number" && day !== null && day - at < span;
    };
    if (state.moved && day !== null && typeof state.moved.day === "number" && day > state.moved.day) {
      const warmth = {
        id: "warmth",
        leaning: "warmth",
        text: state.moved.text,
        href: state.moved.href || null,
        label: state.moved.label || "Return to it"
      };
      if (!asleep("warmth", state.refusals, REFUSAL_SLEEP_DAYS) && !asleep("warmth", state.shown, OFFER_REST_DAYS)) {
        return warmth;
      }
    }
    const leanings = leaningsFor(state);
    for (const { leaning } of leanings) {
      const offer = OFFERS.find((o) => o.leaning === leaning);
      if (!offer) continue;
      if (offer.id === "lean-day" && ctx && ctx.sealedToday) continue;
      if (asleep(offer.id, state.refusals, REFUSAL_SLEEP_DAYS)) continue;
      if (asleep(offer.id, state.shown, OFFER_REST_DAYS)) continue;
      return offer;
    }
    return null;
  }

  function createLean(storage) {
    function load() {
      try {
        const raw = storage.getItem(STORE_KEY);
        if (!raw) return emptyState();
        const data = JSON.parse(raw);
        if (!data || typeof data !== "object") return emptyState();
        return Object.assign(emptyState(), data);
      } catch {
        return emptyState();
      }
    }
    function save(state) {
      try { storage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* the lean rests */ }
    }
    return {
      load,
      /* Note one act of the keeper's. ctx: { day, hour } */
      note(kind, name, ctx) {
        const state = load();
        const key = kind + ":" + name;
        state.counts[key] = (state.counts[key] || 0) + 1;
        if (kind === "room") state.lastRoom = name;
        if (ctx && typeof ctx.day === "number") state.lastDay = ctx.day;
        const bucket = hourBucket(ctx && ctx.hour);
        if (bucket) state.hours[bucket] = (state.hours[bucket] || 0) + 1;
        save(state);
        return state;
      },
      noteMoved(moved, ctx) {
        const state = load();
        state.moved = {
          text: String((moved && moved.text) || ""),
          href: (moved && moved.href) || null,
          label: (moved && moved.label) || null,
          day: ctx && typeof ctx.day === "number" ? ctx.day : state.lastDay
        };
        save(state);
        return state;
      },
      /* The keeper said no: remember it for a Moon. */
      refuse(offerId, ctx) {
        const state = load();
        if (ctx && typeof ctx.day === "number") state.refusals[offerId] = ctx.day;
        save(state);
        return state;
      },
      markShown(offerId, ctx) {
        const state = load();
        if (ctx && typeof ctx.day === "number") state.shown[offerId] = ctx.day;
        save(state);
        return state;
      },
      /* Growth the keeper has not heard yet: the path stage the
       * record stands at, against the last one the lean heard.
       * Returns the new index when it has grown, else null. The
       * first sighting only sets the baseline — no Spark cries
       * "I grew" over old news. */
      pathGrowth(pathIndex) {
        const state = load();
        if (state.lastPathIndex === null || typeof state.lastPathIndex !== "number") {
          state.lastPathIndex = pathIndex;
          save(state);
          return null;
        }
        if (pathIndex > state.lastPathIndex) {
          state.lastPathIndex = pathIndex;
          save(state);
          return pathIndex;
        }
        return null;
      },
      rhythm() {
        const state = load();
        const top = Object.entries(state.hours).sort((a, b) => b[1] - a[1])[0];
        return top ? { bucket: top[0], visits: top[1] } : null;
      },
      reset() {
        try { storage.removeItem(STORE_KEY); } catch { /* already clear */ }
        return emptyState();
      }
    };
  }

  return {
    STORE_KEY,
    REFUSAL_SLEEP_DAYS,
    OFFER_REST_DAYS,
    ROOM_LEANINGS,
    ACT_LEANINGS,
    OFFERS,
    emptyState,
    hourBucket,
    leaningsFor,
    chooseOffer,
    createLean
  };
});
