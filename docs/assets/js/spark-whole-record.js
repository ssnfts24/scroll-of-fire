/**
 * The Spark's Whole Record — the site side (Whole Record v2,
 * Aaron's adopted law, Nov 27, 2026: "so a Spark never needs a
 * reset again"; paper: spark-whole-record-never-reset-2026-11-27).
 *
 * ONE string a keeper can carry — between this site and the
 * game, between phones — holding the Spark whole: its passport,
 * its seed-born voice, and EVERYTHING it carries. Nothing else
 * is in it: no progress, no record of days — a surface's local
 * progress is the only thing a reset may ever clear, and it
 * never lives here.
 *
 * This module is a faithful port of the game's canonical
 * encoding (SPARK! Wake the World, CarriedRecord / SparkVoice /
 * Wardrobe / GoodsCatalogue at the depth build, 6fc2bc1), so a
 * record string written here parses whole in the game and vice
 * versa. The format: the canonical passport code, then the
 * sections, each standing only when it holds something, in this
 * canonical order —
 *   "#W:" the wardrobe's equip string ("slot=id;…");
 *   "#G:" the catalogue goods held, "id=origin" comma-joined
 *         in catalogue order;
 *   "#D:" the dressing, "channel=id" pairs in channel order;
 *   "#C:" the CARDS held, "id=origin" comma-joined in the
 *         record's own order — the First Card first;
 *   "#H:" the HONOURS, comma-joined in canonical order;
 *   "#V:" the VOICE profile, born of the Spark's seed;
 *   "#R:" the record's version mark ("2" for this shape).
 * A section this build does not know is preserved verbatim and
 * written back after the known sections (law 3 — forward only,
 * losslessly). Origins are the record's own words — "earned",
 * "purchased", "gifted" — and they never blur.
 *
 * Two honest differences of surface, both deliberate:
 *   - The goods space here is the SITE's catalogue (the 65
 *     goods of assets/data/spark-goods.json, embedded below in
 *     the JSON's own order and pinned against it by test). The
 *     43 goods with a game form stand in the same relative
 *     order in the game's catalogue, so a record both surfaces
 *     can read composes byte-identically on either. A good with
 *     no game form (a sticker set, a home good) is carried here
 *     whole; the game drops what it cannot read, by its own
 *     law — the site never drops its own Spark's goods.
 *   - The site originates the passport, the goods (from its
 *     shelf), the cards (from its album) and the voice (from
 *     the seed). The wardrobe, dressing and honours sections
 *     are the game's to originate; the site carries them whole
 *     when a record brings them, and never invents them.
 *
 * The laws, pinned by tests/spark-whole-record.test.js (the
 * Update Gate: a Whole Record goes in and comes out IDENTICAL,
 * every carried thing accounted for):
 *   · a damaged passport is refused whole, and every other
 *     section still reads;
 *   · compose(parse(x)) is byte-identical to x for any record
 *     this build composes, v1 or v2 — the game's own pinned
 *     strings included;
 *   · a v1 record upgrades in place, losing nothing it held;
 *   · the Link's merge is additions only — nothing standing is
 *     ever taken away, and an earning is never un-said by a
 *     purchase (origin rank: earned > gifted > purchased).
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.SparkWholeRecord = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function (root) {
    "use strict";

    const VERSION = "spark-whole-record/2.0.0";
    const RECORD_KEY = "sof.spark.whole.v1";
    const LINKED_KEY = "sof.spark.whole.linked.v1";
    const GOODS_SHELF_KEY = "sof.spark.goods.v1"; // spark-stall-checkout.js
    const RECORD_VERSION = "2";

    /* ----------------- the canonical lists ----------------- */

    /* The site's catalogue, in spark-goods.json's own order:
     * [id, channel]. Pinned against the JSON by test. */
    const GOODS = [
      ["the-wayfarers-lantern", "carried"], ["the-seed-pouch", "carried"],
      ["the-scroll-case", "carried"], ["the-travellers-satchel", "carried"],
      ["the-astrolabe-charm", "carried"], ["the-north-bead", "carried"],
      ["the-key-of-the-thirteenth-door", "carried"],
      ["the-kind-scarf", "worn"], ["the-moon-phase-band", "worn"],
      ["the-cloak-clasp-of-the-road", "worn"], ["the-ember-circlet", "worn"],
      ["the-ribbon-of-the-day-out-of-time", "worn"], ["the-veil-of-quiet-hours", "worn"],
      ["petal-drift", "trail"], ["ember-motes", "trail"], ["ripple-step", "trail"],
      ["season-motes", "trail"], ["the-long-ribbon", "trail"], ["comet-tail", "trail"],
      ["firefly-scatter", "trail"], ["moonlit-wake", "trail"],
      ["the-hearth-wrap", "wrap"], ["the-storm-wrap", "wrap"],
      ["the-petal-wrap", "wrap"], ["the-return-path-wrap", "wrap"],
      ["brightenings---the-first-set", "face"], ["the-startle-set", "face"],
      ["the-celebration-set", "face"], ["quiet-manners", "face"],
      ["your-spark-in-stickers", "stickers"], ["codex-glyph-stickers", "stickers"],
      ["moons-and-days-stickers", "stickers"], ["the-road-stickers", "stickers"],
      ["sparklight-emoji", "stickers"],
      ["observatory-night", "theme"], ["garden-morning", "theme"],
      ["hearth-evening", "theme"], ["moon-of-the-return-path", "theme"],
      ["the-keepers-bench", "home"], ["the-reading-stone", "home"],
      ["the-resting-hammock", "home"], ["the-clearing-lamp", "home"],
      ["the-path-lanterns-set-of-three", "home"], ["the-hearth-ring", "home"],
      ["path-stones-set-of-seven", "home"], ["the-garden-gate", "home"],
      ["the-stepping-bridge", "home"], ["the-round-fountain", "home"],
      ["the-rain-barrel-and-dipper", "home"], ["the-young-orchard-tree", "home"],
      ["the-vine-pergola", "home"], ["the-threshold-stone", "home"],
      ["the-token-shelf", "home"], ["the-hum-rail", "home"],
      ["the-chronicle-shelf", "home"],
      ["comet-trail---spark!", "trail"], ["the-wake-wrap---spark!", "wrap"],
      ["game-expressions---spark!", "face"], ["floating-isles-theme---spark!", "theme"],
      ["victory-brightening---spark!", "face"],
      ["chime-set---the-moon-tones", "sound"], ["chime-set---hearth-and-copper", "sound"],
      ["the-arrival-bell", "sound"], ["episode-hums---the-first-shelf", "sound"],
      ["the-moon-hum-repertoire", "sound"]
    ];
    const GOOD_CHANNEL = new Map(GOODS);
    const GOOD_NAME = new Map([
      ["the-wayfarers-lantern", "The Wayfarer's Lantern"], ["the-seed-pouch", "The Seed Pouch"],
      ["the-scroll-case", "The Scroll-Case"], ["the-travellers-satchel", "The Traveller's Satchel"],
      ["the-astrolabe-charm", "The Astrolabe Charm"], ["the-north-bead", "The North Bead"],
      ["the-key-of-the-thirteenth-door", "The Key of the Thirteenth Door"],
      ["the-kind-scarf", "The Kind Scarf"], ["the-moon-phase-band", "The Moon-Phase Band"],
      ["the-cloak-clasp-of-the-road", "The Cloak-Clasp of the Road"],
      ["the-ember-circlet", "The Ember Circlet"],
      ["the-ribbon-of-the-day-out-of-time", "The Ribbon of the Day Out of Time"],
      ["the-veil-of-quiet-hours", "The Veil of Quiet Hours"],
      ["petal-drift", "Petal Drift"], ["ember-motes", "Ember Motes"],
      ["ripple-step", "Ripple-Step"], ["season-motes", "Season Motes"],
      ["the-long-ribbon", "The Long Ribbon"], ["comet-tail", "Comet Tail"],
      ["firefly-scatter", "Firefly Scatter"], ["moonlit-wake", "Moonlit Wake"],
      ["the-hearth-wrap", "The Hearth Wrap"], ["the-storm-wrap", "The Storm Wrap"],
      ["the-petal-wrap", "The Petal Wrap"], ["the-return-path-wrap", "The Return-Path Wrap"],
      ["brightenings---the-first-set", "Brightenings — The First Set"],
      ["the-startle-set", "The Startle Set"], ["the-celebration-set", "The Celebration Set"],
      ["quiet-manners", "Quiet Manners"],
      ["observatory-night", "Observatory Night"], ["garden-morning", "Garden Morning"],
      ["hearth-evening", "Hearth Evening"], ["moon-of-the-return-path", "Moon of the Return Path"],
      ["comet-trail---spark!", "Comet Trail — SPARK!"], ["the-wake-wrap---spark!", "The Wake Wrap — SPARK!"],
      ["game-expressions---spark!", "Game Expressions — SPARK!"],
      ["floating-isles-theme---spark!", "Floating Isles Theme — SPARK!"],
      ["victory-brightening---spark!", "Victory Brightening — SPARK!"],
      ["chime-set---the-moon-tones", "Chime Set — The Moon Tones"],
      ["chime-set---hearth-and-copper", "Chime Set — Hearth & Copper"],
      ["the-arrival-bell", "The Arrival Bell"],
      ["episode-hums---the-first-shelf", "Episode Hums — The First Shelf"],
      ["the-moon-hum-repertoire", "The Moon Hum Repertoire"]
    ]);

    /* The game's wardrobe: slots in order, items id → slot,
     * and the six game-native honours in canonical order —
     * carried whole here, originated in the game. */
    const SLOTS = ["hat", "wrap", "trail", "glow"];
    const WARDROBE_SLOT = new Map([
      ["ember-cap", "hat"], ["moon-circlet", "hat"], ["star-crown", "hat"], ["comet-crest", "hat"],
      ["dawn-wrap", "wrap"], ["river-wrap", "wrap"], ["storm-wrap", "wrap"],
      ["petal-trail", "trail"], ["comet-trail", "trail"], ["prism-trail", "trail"],
      ["candle-glow", "glow"], ["hearth-glow", "glow"], ["aurora-glow", "glow"]
    ]);
    const WARDROBE_NAME = new Map([
      ["ember-cap", "Ember Cap"], ["moon-circlet", "Moon Circlet"], ["star-crown", "Star Crown"],
      ["comet-crest", "Comet Crest"], ["dawn-wrap", "Dawn Wrap"], ["river-wrap", "River Wrap"],
      ["storm-wrap", "Storm Wrap"], ["petal-trail", "Petal Trail"], ["comet-trail", "Comet Trail"],
      ["prism-trail", "Prism Trail"], ["candle-glow", "Candle Glow"], ["hearth-glow", "Hearth Glow"],
      ["aurora-glow", "Aurora Glow"]
    ]);
    const HONOURS = ["ember-cap", "star-crown", "dawn-wrap", "river-wrap", "candle-glow", "hearth-glow"];
    const CHANNELS = ["carried", "worn", "trail", "wrap", "face", "theme", "sound"];

    const ORIGINS = ["earned", "purchased", "gifted"];
    const isOrigin = (o) => ORIGINS.includes(o);
    const originRank = (o) => (o === "earned" ? 3 : o === "gifted" ? 2 : o === "purchased" ? 1 : 0);

    /* ------------- the seed's arithmetic (mirrors) ---------- */

    /* The companion core's own hash and stream, mirrored the
     * way spark-voice.js mirrors them, so a seed means the
     * same thing here as everywhere else it is read. */
    function hashString(text) {
      let h = 0x811c9dc5;
      const s = String(text);
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      return h >>> 0;
    }

    function mulberry32(seed) {
      let a = seed >>> 0;
      return function () {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    /* ------------------- the voice profile ------------------ */

    /* The seed-born voice (the game's SparkVoice, ported draw
     * for draw): pitch family, pace, warmth, and a four-step
     * signature call, from the seed's own ":voice" side stream.
     * LADDER_STEPS is the game's ladder size (15). */
    const LADDER_STEPS = 15;

    function voiceDerive(rand) {
      const ratePct = 88 + Math.floor(rand() * 27);
      const pacePct = 85 + Math.floor(rand() * 36);
      const warmth = Math.floor(rand() * 101);
      const steps = [2 + Math.floor(rand() * 6)];
      for (let i = 1; i < 4; i++) {
        const move = Math.floor(rand() * 6) - 2;
        steps.push(Math.max(0, Math.min(LADDER_STEPS - 1, steps[i - 1] + move)));
      }
      return { ratePct, pacePct, warmth, callSteps: steps };
    }

    function voiceForSeed(seed, core) {
      if (typeof seed !== "string" || !seed) return null;
      if (core && typeof core.parseSeed === "function" && !core.parseSeed(seed)) return null;
      return voiceDerive(mulberry32(hashString(seed + ":voice")));
    }

    function voiceEncode(profile) {
      if (!profile) return "";
      return ["v1", profile.ratePct, profile.pacePct, profile.warmth,
        ...profile.callSteps].join(".");
    }

    /* A doubtful voice is refused whole, like a doubtful
     * passport — the seed speaks the voice afresh instead. */
    function voiceParse(text) {
      if (typeof text !== "string") return null;
      const p = text.trim().split(".");
      if (p.length !== 8 || p[0] !== "v1") return null;
      const nums = p.slice(1).map((s) => (/^-?\d+$/.test(s) ? Number(s) : NaN));
      if (nums.some((n) => !Number.isInteger(n))) return null;
      const [rate, pace, warmth, ...steps] = nums;
      if (rate < 80 || rate > 125 || pace < 70 || pace > 140 || warmth < 0 || warmth > 100) return null;
      if (steps.some((s) => s < 0 || s >= LADDER_STEPS)) return null;
      return { ratePct: rate, pacePct: pace, warmth, callSteps: steps };
    }

    function voiceDescribe(profile) {
      if (!profile) return "";
      const pitch = profile.ratePct < 97 ? "low" : profile.ratePct > 106 ? "high" : "middle";
      const pace = profile.pacePct < 95 ? "unhurried" : profile.pacePct > 108 ? "brisk" : "easy";
      const warm = profile.warmth < 34 ? "clear and bright" : profile.warmth > 66 ? "soft and breathy" : "warm";
      return `a ${pitch} voice, ${pace}, ${warm}`;
    }

    /* --------------------- the sections --------------------- */

    const MARKS = ["#W:", "#G:", "#D:", "#C:", "#H:", "#V:", "#R:"];

    function parseWardrobe(text) {
      const out = {};
      if (typeof text === "string") {
        for (const part of text.split(";")) {
          const eq = part.indexOf("=");
          if (eq <= 0) continue;
          const slot = part.slice(0, eq).trim();
          const id = part.slice(eq + 1).trim();
          if (WARDROBE_SLOT.get(id) === slot) out[slot] = id;
        }
      }
      const ordered = {};
      for (const slot of SLOTS) if (out[slot]) ordered[slot] = out[slot];
      return ordered;
    }

    function encodeWardrobe(wardrobe) {
      if (!wardrobe) return "";
      const parts = [];
      for (const slot of SLOTS) {
        const id = wardrobe[slot];
        if (id && WARDROBE_SLOT.get(id) === slot) parts.push(`${slot}=${id}`);
      }
      return parts.join(";");
    }

    function parseGoods(text) {
      const found = new Map();
      if (typeof text === "string") {
        for (const part of text.split(",")) {
          const eq = part.indexOf("=");
          if (eq <= 0) continue;
          const id = part.slice(0, eq).trim();
          const origin = part.slice(eq + 1).trim();
          if (!GOOD_CHANNEL.has(id) || !isOrigin(origin)) continue;
          found.set(id, origin);
        }
      }
      const out = {};
      for (const [id] of GOODS) if (found.has(id)) out[id] = found.get(id);
      return out;
    }

    function encodeGoods(goods) {
      if (!goods) return "";
      const parts = [];
      for (const [id] of GOODS) {
        const origin = goods[id];
        if (origin && isOrigin(origin)) parts.push(`${id}=${origin}`);
      }
      return parts.join(",");
    }

    function parseDress(text) {
      const found = new Map();
      if (typeof text === "string") {
        for (const part of text.split(";")) {
          const eq = part.indexOf("=");
          if (eq <= 0) continue;
          const channel = part.slice(0, eq).trim();
          const id = part.slice(eq + 1).trim();
          if (GOOD_CHANNEL.get(id) !== channel) continue;
          found.set(channel, id);
        }
      }
      const out = {};
      for (const ch of CHANNELS) if (found.has(ch)) out[ch] = found.get(ch);
      return out;
    }

    function encodeDress(dress) {
      if (!dress) return "";
      const parts = [];
      for (const ch of CHANNELS) {
        const id = dress[ch];
        if (id && GOOD_CHANNEL.get(id) === ch) parts.push(`${ch}=${id}`);
      }
      return parts.join(";");
    }

    /* A card id's shape: a lowercase slug — the album's ids
     * are the family's; the shape is checked, never the
     * membership, exactly as the game checks it. */
    function isCardId(id) {
      return typeof id === "string" && id.length >= 1 && id.length <= 48 &&
        /^[a-z0-9-]+$/.test(id);
    }

    function parseCards(text) {
      const out = {};
      if (typeof text === "string") {
        for (const part of text.split(",")) {
          const eq = part.indexOf("=");
          if (eq <= 0) continue;
          const id = part.slice(0, eq).trim();
          const origin = part.slice(eq + 1).trim();
          if (!isCardId(id) || !isOrigin(origin)) continue;
          if (!(id in out)) out[id] = origin;
        }
      }
      return out;
    }

    function encodeCards(cards) {
      if (!cards) return "";
      const parts = [];
      for (const [id, origin] of Object.entries(cards)) {
        if (isCardId(id) && isOrigin(origin)) parts.push(`${id}=${origin}`);
      }
      return parts.join(",");
    }

    function parseHonours(text) {
      const found = new Set();
      if (typeof text === "string") {
        for (const part of text.split(",")) {
          const id = part.trim();
          if (HONOURS.includes(id)) found.add(id);
        }
      }
      return HONOURS.filter((h) => found.has(h));
    }

    function encodeHonours(honours) {
      if (!Array.isArray(honours)) return "";
      return HONOURS.filter((h) => honours.includes(h)).join(",");
    }

    /* ------------------- parse and compose ------------------ */

    /* Cut the sections this build does not know out of the
     * working string, keeping them verbatim (mark and all),
     * in the order they stood. A '#' begins a section; a
     * stray '#' with no mark is junk and drops like any junk. */
    function extractUnknown(record, preserved) {
      if (record == null) return null;
      const text = String(record);
      let out = "";
      let i = 0;
      while (i < text.length) {
        const hash = text.indexOf("#", i);
        if (hash < 0) { out += text.slice(i); break; }
        out += text.slice(i, hash);
        const known = MARKS.some((m) => text.startsWith(m, hash));
        const next = text.indexOf("#", hash + 1) < 0 ? text.length : text.indexOf("#", hash + 1);
        if (known) {
          out += text.slice(hash, next);
        } else {
          let colon = -1;
          for (let k = hash + 1; k < Math.min(text.length, hash + 10); k++) {
            const ch = text[k];
            if (ch === ":") { colon = k; break; }
            if (!/[A-Za-z]/.test(ch)) break;
          }
          if (colon > hash + 1) preserved.push(text.slice(hash, next));
        }
        i = next;
      }
      return out;
    }

    function canonicalCode(passportText, core) {
      if (!core || typeof core.parsePassportCode !== "function" ||
          typeof core.passportCodeFor !== "function") return null;
      const parsed = core.parsePassportCode(passportText);
      if (!parsed) return null;
      return core.passportCodeFor({ seed: parsed.seed, name: parsed.name || "" });
    }

    /* Read a carried record back. Each part may be absent or
     * damaged independently of the others; a passport that
     * does not verify is refused whole (passportCode null)
     * and every other section still reads. */
    function parse(text, core) {
      const preserved = [];
      const work = extractUnknown(text == null ? null : String(text), preserved);
      const sec = new Array(MARKS.length).fill(null);
      let passportPart = null;
      if (work != null) {
        const at = MARKS.map((m) => work.indexOf(m));
        let first = work.length;
        for (const a of at) if (a >= 0) first = Math.min(first, a);
        passportPart = work.slice(0, first);
        for (let i = 0; i < MARKS.length; i++) {
          if (at[i] < 0) continue;
          let end = work.length;
          for (let j = 0; j < MARKS.length; j++) {
            if (at[j] > at[i]) end = Math.min(end, at[j]);
          }
          sec[i] = work.slice(at[i] + MARKS[i].length, end);
        }
      }
      const voiceProfile = sec[5] == null ? null : voiceParse(sec[5]);
      return {
        passportCode: passportPart && passportPart.trim()
          ? canonicalCode(passportPart, core) : null,
        wardrobe: parseWardrobe(sec[0] || ""),
        goods: parseGoods(sec[1] || ""),
        dress: parseDress(sec[2] || ""),
        cards: parseCards(sec[3] || ""),
        honours: parseHonours(sec[4] || ""),
        voice: voiceProfile ? voiceEncode(voiceProfile) : null,
        voiceProfile,
        versionMark: sec[6] == null || !sec[6].trim() ? null : sec[6].trim(),
        preserved
      };
    }

    /* Compose the Whole Record: every section, in canonical
     * order. The version mark stands when any v2 section
     * (cards, honours, voice) holds something, or when a mark
     * is handed in. A passport that does not verify is left
     * out whole — the record never carries a doubtful Spark. */
    function compose(rec, core) {
      if (!rec) return "";
      const code = rec.passportCode
        ? canonicalCode(rec.passportCode, core) : null;
      const w = encodeWardrobe(rec.wardrobe);
      const g = encodeGoods(rec.goods);
      const dr = encodeDress(rec.dress);
      const cd = encodeCards(rec.cards);
      const hn = encodeHonours(rec.honours);
      const vp = rec.voice ? voiceParse(rec.voice) : null;
      const vc = vp ? voiceEncode(vp) : "";
      const v2 = Boolean(cd || hn || vc || rec.versionMark);
      let out = "";
      if (code) out += code;
      if (w) out += "#W:" + w;
      if (g) out += "#G:" + g;
      if (dr) out += "#D:" + dr;
      if (cd) out += "#C:" + cd;
      if (hn) out += "#H:" + hn;
      if (vc) out += "#V:" + vc;
      if (v2) out += "#R:" + (rec.versionMark || RECORD_VERSION);
      if (Array.isArray(rec.preserved)) out += rec.preserved.join("");
      return out;
    }

    /* ------------------------ the merge --------------------- */

    /* The Link's merge: what the incoming record brings is
     * ADDED to what stands here — nothing standing is ever
     * taken away. Goods and cards keep the honester origin;
     * the wardrobe and dressing fill only empty slots; the
     * incoming voice stands when it carries one; unknown
     * sections from either side survive. */
    function mergedWith(standing, incoming) {
      if (!incoming) return standing;
      if (!standing) return incoming;
      const wardrobe = { ...standing.wardrobe };
      for (const [slot, id] of Object.entries(incoming.wardrobe || {})) {
        if (!(slot in wardrobe)) wardrobe[slot] = id;
      }
      const goods = { ...standing.goods };
      for (const [id, origin] of Object.entries(incoming.goods || {})) {
        if (!(id in goods) || originRank(origin) > originRank(goods[id])) goods[id] = origin;
      }
      const dress = { ...standing.dress };
      for (const [ch, id] of Object.entries(incoming.dress || {})) {
        if (!(ch in dress)) dress[ch] = id;
      }
      const cards = { ...standing.cards };
      for (const [id, origin] of Object.entries(incoming.cards || {})) {
        if (!(id in cards) || originRank(origin) > originRank(cards[id])) cards[id] = origin;
      }
      const honours = HONOURS.filter(
        (h) => (standing.honours || []).includes(h) || (incoming.honours || []).includes(h));
      const preserved = [...(standing.preserved || [])];
      for (const p of incoming.preserved || []) {
        if (!preserved.includes(p)) preserved.push(p);
      }
      return {
        passportCode: incoming.passportCode || standing.passportCode,
        wardrobe, goods, dress, cards, honours,
        voice: incoming.voice || standing.voice,
        voiceProfile: (incoming.voice ? voiceParse(incoming.voice) : null) ||
          standing.voiceProfile || null,
        versionMark: standing.versionMark || incoming.versionMark,
        preserved
      };
    }

    /* ---------------------- plain words --------------------- */

    function passportOf(rec, core) {
      if (!rec || !rec.passportCode || !core ||
          typeof core.parsePassportCode !== "function") return null;
      return core.parsePassportCode(rec.passportCode);
    }

    /* The Link's permission line — what a code holds, said
     * plainly BEFORE anything joins, in the game's own words. */
    function linkSummary(rec, core) {
      const parts = [];
      const cardCount = Object.keys(rec.cards || {}).length;
      const goodCount = Object.keys(rec.goods || {}).length;
      if (cardCount) parts.push(cardCount === 1 ? "1 card" : `${cardCount} cards`);
      if (goodCount) parts.push(goodCount === 1 ? "1 thing carried" : `${goodCount} things carried`);
      if ((rec.honours || []).length) {
        parts.push(rec.honours.length === 1 ? "1 honour" : `${rec.honours.length} honours`);
      }
      if (Object.keys(rec.wardrobe || {}).length) parts.push("its wardrobe");
      if (rec.voice) parts.push("its own voice");
      const joined = parts.join(", ");
      const parsed = passportOf(rec, core);
      if (parsed) {
        const name = parsed.name || (parsed.companion && parsed.companion.name) || "Spark";
        const kind = parsed.companion && parsed.companion.kindName
          ? parsed.companion.kindName : "";
        return `This code carries ${name}, ${kind}: ` +
          (parts.length ? joined + "." : "the Spark alone.");
      }
      if (!parts.length) return "This code carries nothing this page can read.";
      return `This code carries ${joined} — no Spark travels with it; ` +
        "the Spark here keeps its home.";
    }

    /* "What my Spark carries", in plain words — the view's
     * list and the proof's list are this one list. */
    function carriesLines(rec, core) {
      const out = [];
      const parsed = passportOf(rec, core);
      if (parsed) {
        const name = parsed.name || (parsed.companion && parsed.companion.name) || "Spark";
        const c = parsed.companion || {};
        out.push(`${name} — ${c.kindName || ""} · ${c.temperament || ""}`);
      } else {
        out.push("No Spark's passport stands in this record");
      }
      const cardIds = Object.keys(rec.cards || {});
      if (cardIds.length) {
        out.push("CARDS");
        cardIds.forEach((id, i) => {
          out.push(i === 0 ? `The First Card — ${rec.cards[id]}` : `Card · ${id} — ${rec.cards[id]}`);
        });
      }
      const goodIds = Object.keys(rec.goods || {});
      if (goodIds.length) {
        out.push("THINGS CARRIED");
        for (const id of goodIds) {
          out.push(`${GOOD_NAME.get(id) || id} — ${rec.goods[id]}`);
        }
      }
      if ((rec.honours || []).length) {
        out.push("HONOURS");
        for (const h of rec.honours) out.push(`${WARDROBE_NAME.get(h) || h} — earned by waking`);
      }
      const slots = SLOTS.filter((s) => rec.wardrobe && rec.wardrobe[s]);
      if (slots.length) {
        out.push("WARDROBE, WORN");
        for (const slot of slots) {
          out.push(`${slot} · ${WARDROBE_NAME.get(rec.wardrobe[slot]) || rec.wardrobe[slot]}`);
        }
      }
      out.push("VOICE");
      const vp = rec.voiceProfile || (rec.voice ? voiceParse(rec.voice) : null);
      if (vp) {
        out.push(`Its own voice — ${voiceDescribe(vp)}, born of its seed`);
      } else if (parsed) {
        const born = voiceForSeed(parsed.seed, core);
        out.push(`Its own voice — ${born ? voiceDescribe(born) : "born of its seed"}, born of its seed`);
      } else {
        out.push("Its own voice, born of its seed");
      }
      return out;
    }

    /* ---------------- the site's own sources ---------------- */

    /* The goods shelf (sof.spark.goods.v1): an array of
     * entries in the stall checkout's lineage shape
     * ({ itemId, obtained, … }), or { goods: [...] } /
     * { owned: [...] }. The origin word is the entry's own
     * "obtained" when it is one of the record's words. */
    function goodsFromShelf(shelfRaw) {
      let parsed = null;
      try { parsed = shelfRaw ? JSON.parse(shelfRaw) : null; } catch { parsed = null; }
      const list = Array.isArray(parsed) ? parsed
        : (parsed && (parsed.goods || parsed.owned)) || [];
      const out = {};
      for (const entry of Array.isArray(list) ? list : []) {
        if (!entry || typeof entry !== "object") continue;
        const id = entry.itemId || entry.id;
        const origin = entry.obtained || entry.origin || "purchased";
        if (GOOD_CHANNEL.has(id) && isOrigin(origin) && !(id in out)) out[id] = origin;
      }
      const ordered = {};
      for (const [id] of GOODS) if (id in out) ordered[id] = out[id];
      return ordered;
    }

    /* The album's held cards, in the album's own order, the
     * First Card first when the album's pinned seed is this
     * Spark's seed (the meeting is the album's to pin; the
     * record only carries what the album holds). Album cards
     * are found by doing — their origin word is "earned". */
    function cardsFromAlbum(albumData, recordSeed) {
      const out = {};
      if (!albumData || typeof albumData !== "object") return out;
      if (albumData.firstSeedPinned && albumData.firstSeedPinned === recordSeed) {
        out["first-card"] = "earned";
      }
      const copies = albumData.copies || {};
      const byDesign = albumData.byDesign || {};
      for (const designId of Object.keys(byDesign)) {
        const copy = copies[byDesign[designId]];
        if (copy && copy.state === "held" && isCardId(designId) && !(designId in out)) {
          out[designId] = "earned";
        }
      }
      return out;
    }

    /* Assemble the site's Whole Record from its own sources:
     * the Spark record (identity), the goods shelf, the album,
     * and the seed-born voice. Pure over its inputs, so the
     * proof and the page read the same assembly. */
    function assembleSiteRecord({ core, sparkRecord, shelfRaw, albumData }) {
      if (!core || !sparkRecord || !core.parseSeed ||
          !core.parseSeed(sparkRecord.seed)) return null;
      const passportCode = typeof core.passportCodeFor === "function"
        ? core.passportCodeFor(sparkRecord) : null;
      if (!passportCode) return null;
      const profile = voiceForSeed(sparkRecord.seed, core);
      return {
        passportCode,
        wardrobe: {},
        goods: goodsFromShelf(shelfRaw),
        dress: {},
        cards: cardsFromAlbum(albumData, sparkRecord.seed),
        honours: [],
        voice: profile ? voiceEncode(profile) : null,
        voiceProfile: profile,
        versionMark: RECORD_VERSION,
        preserved: []
      };
    }

    /* -------------------- storage roads --------------------- */

    function readStored(storage) {
      try {
        const raw = storage && storage.getItem(RECORD_KEY);
        return raw ? String(raw) : null;
      } catch { return null; }
    }

    function writeStored(storage, text) {
      try {
        if (storage && text) storage.setItem(RECORD_KEY, text);
      } catch { /* the record rests */ }
    }

    function readSparkRecord(storage, core) {
      try {
        const raw = storage && core && storage.getItem(core.STORAGE_KEY);
        if (!raw) return null;
        const record = JSON.parse(raw);
        return record && core.parseSeed(record.seed) ? record : null;
      } catch { return null; }
    }

    function readAlbumData(storage, core, sparkRecord) {
      try {
        if (!root || !root.CodexCards || typeof root.CodexCards.createStore !== "function") {
          return null;
        }
        const key = typeof root.CodexCards.keeperKeyForSeed === "function"
          ? root.CodexCards.keeperKeyForSeed(sparkRecord.seed)
          : null;
        if (!key) return null;
        return root.CodexCards.createStore(storage, key).load();
      } catch { return null; }
    }

    /* Refresh the stored Whole Record from the site's own
     * sources, merged additions-only with what already stands
     * (so a section only a travelled record carries — the
     * wardrobe, the honours, a card the album cannot name —
     * is never dropped by a refresh). Returns the record. */
    function refreshStored(storage, core) {
      const sparkRecord = readSparkRecord(storage, core);
      if (!sparkRecord) return null;
      let shelfRaw = null;
      try { shelfRaw = storage.getItem(GOODS_SHELF_KEY); } catch { shelfRaw = null; }
      const assembled = assembleSiteRecord({
        core, sparkRecord, shelfRaw,
        albumData: readAlbumData(storage, core, sparkRecord)
      });
      if (!assembled) return null;
      const standingText = readStored(storage);
      const standing = standingText ? parse(standingText, core) : null;
      const merged = standing && standing.passportCode === assembled.passportCode
        ? mergedWith(standing, assembled) : assembled;
      writeStored(storage, compose(merged, core));
      return merged;
    }

    /* The Link's receiving road, storage side: parse the
     * incoming code and say plainly what it carries. NOTHING
     * is written here — the keeper's "Yes, bring everything"
     * is the only door, and it calls applyIncoming. */
    function previewIncoming(storage, core, text) {
      const incoming = parse(text, core);
      const readable = incoming.passportCode ||
        Object.keys(incoming.goods).length || Object.keys(incoming.cards).length ||
        incoming.honours.length || Object.keys(incoming.wardrobe).length ||
        incoming.voice || incoming.preserved.length;
      return { incoming, readable: Boolean(readable), summary: linkSummary(incoming, core) };
    }

    /* Apply a confirmed incoming record, additions only:
     * the stored Whole Record unions; goods also land on the
     * shelf (so the stall and the Hearth see them), and cards
     * the album can name are collected into the album (so the
     * album shows them) — a card the album cannot name is
     * still carried whole in the record. The Spark record
     * itself (identity, days, growth) is never touched here:
     * moving a different Spark in stays the passport door's
     * own deliberate act. */
    function applyIncoming(storage, core, incoming) {
      const standingText = readStored(storage);
      const standing = standingText ? parse(standingText, core)
        : refreshStored(storage, core);
      const merged = standing ? mergedWith(standing, incoming) : incoming;
      writeStored(storage, compose(merged, core));
      try { storage.setItem(LINKED_KEY, "1"); } catch { /* a courtesy flag */ }
      mergeGoodsIntoShelf(storage, incoming.goods);
      mergeCardsIntoAlbum(storage, core, incoming.cards);
      return merged;
    }

    function mergeGoodsIntoShelf(storage, goods) {
      const ids = Object.keys(goods || {});
      if (!ids.length) return;
      try {
        const raw = storage.getItem(GOODS_SHELF_KEY);
        let parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) {
          if (parsed && Array.isArray(parsed.goods)) parsed = parsed.goods;
          else if (parsed && Array.isArray(parsed.owned)) parsed = parsed.owned;
          else parsed = [];
        }
        const have = new Set(parsed.map((e) => e && (e.itemId || e.id)));
        for (const id of ids) {
          if (!have.has(id)) parsed.push({ itemId: id, obtained: goods[id], via: "the-link" });
        }
        storage.setItem(GOODS_SHELF_KEY, JSON.stringify(parsed));
      } catch { /* the record still carries them */ }
    }

    function mergeCardsIntoAlbum(storage, core, cards) {
      const ids = Object.keys(cards || {}).filter((id) => id !== "first-card");
      if (!ids.length) return;
      try {
        if (!root || !root.CodexCards || typeof root.CodexCards.createStore !== "function" ||
            typeof root.CodexCards.cardById !== "function") return;
        const sparkRecord = readSparkRecord(storage, core);
        if (!sparkRecord) return;
        const key = typeof root.CodexCards.keeperKeyForSeed === "function"
          ? root.CodexCards.keeperKeyForSeed(sparkRecord.seed) : null;
        if (!key) return;
        const store = root.CodexCards.createStore(storage, key);
        for (const id of ids) {
          if (root.CodexCards.cardById(id)) {
            store.collect(id, { via: "the-link" });
          }
        }
      } catch { /* the record still carries them */ }
    }

    function hasLinked(storage) {
      try { return Boolean(storage && storage.getItem(LINKED_KEY)); } catch { return false; }
    }

    return {
      VERSION,
      RECORD_KEY,
      LINKED_KEY,
      GOODS_SHELF_KEY,
      GOODS,
      SLOTS,
      CHANNELS,
      HONOURS,
      hashString,
      mulberry32,
      voiceForSeed,
      voiceEncode,
      voiceParse,
      voiceDescribe,
      parse,
      compose,
      mergedWith,
      linkSummary,
      carriesLines,
      goodsFromShelf,
      cardsFromAlbum,
      assembleSiteRecord,
      readStored,
      writeStored,
      refreshStored,
      previewIncoming,
      applyIncoming,
      hasLinked,
      firstCardId(rec) {
        const ids = Object.keys((rec && rec.cards) || {});
        return ids.length ? ids[0] : null;
      }
    };
  }
);
