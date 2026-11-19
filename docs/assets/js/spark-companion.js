"use strict";

/*
 * Spark companion — core (no DOM, no network, no storage of its own).
 *
 * A Spark is a small companion a visitor adopts on the Codex site.
 * It is made, not picked: a seed string builds the whole creature —
 * its kind, form, markings, colours and temperament — and the same
 * seed always builds the same Spark, on any device, forever. The
 * seed is rooted in Living Time: it carries the Moon and Pattern
 * Day of the adoption day, read from the canonical PatternCalendar
 * by the page, never computed here.
 *
 * The adopter names their Spark. The name is part of the record,
 * not of the seed: the creature is the seed; the name is the
 * relationship.
 *
 * Growth is counted from plain facts kept on the visitor's own
 * device: days they came back, pages they have seen, practice
 * sessions they sealed. Nothing here sends anything anywhere.
 *
 * The same file runs in the browser (window.SparkCompanion) and in
 * Node tests (module.exports).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SparkCompanion = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const SEED_PREFIX = "spark1";
  const STORAGE_KEY = "sof.spark.v1";
  const NAME_FALLBACK = "your Spark";
  const NAME_MAX = 24;

  /* The six kinds, from Aaron's Free The Noods work. Each kind has a
   * temperament word, a short plain description, and a home range of
   * colours (hue degrees) the generator jitters inside. */
  const KINDS = [
    { id: "fire", name: "Fire", temperament: "bold",
      line: "Quick to start, warm to sit beside.",
      hues: [14, 38] },
    { id: "water", name: "Water", temperament: "gentle",
      line: "Calm on the surface, deep underneath.",
      hues: [188, 214] },
    { id: "shadow", name: "Shadow", temperament: "quiet",
      line: "Notices what the light walks past.",
      hues: [258, 286] },
    { id: "air", name: "Air", temperament: "curious",
      line: "Always halfway to the next question.",
      hues: [168, 196] },
    { id: "earth", name: "Earth", temperament: "steady",
      line: "Slow to move, hard to shake.",
      hues: [84, 128] },
    { id: "light", name: "Light", temperament: "bright",
      line: "First up, and glad about it.",
      hues: [42, 56] }
  ];

  /* The adoption questions. Three, kept light. Each answer leans
   * toward one kind — the quiz-as-door from the Noods harvest:
   * courage → Fire, stability → Earth, mystery → Shadow,
   * compassion → Water, curiosity → Air, optimism → Light. */
  const QUESTIONS = [
    {
      ask: "A free hour opens up. Where do you go?",
      options: [
        { label: "Somewhere I have never been", kind: "air" },
        { label: "Outside, to work with my hands", kind: "earth" },
        { label: "To sit with someone who needs company", kind: "water" },
        { label: "Toward whatever feels most alive", kind: "fire" }
      ]
    },
    {
      ask: "When something is wrong, what do you trust first?",
      options: [
        { label: "What I can see plainly in front of me", kind: "light" },
        { label: "The quiet sense underneath it", kind: "shadow" },
        { label: "Steady work, one step at a time", kind: "earth" },
        { label: "A bold move, made early", kind: "fire" }
      ]
    },
    {
      ask: "Pick the hour you love most.",
      options: [
        { label: "Dawn, when the day is all promise", kind: "light" },
        { label: "Deep night, when things get honest", kind: "shadow" },
        { label: "Rainy afternoon, nowhere to be", kind: "water" },
        { label: "A windy ridge, everything moving", kind: "air" }
      ]
    }
  ];

  const FORMS = ["orb", "comet", "sprout", "shard", "wave", "moth"];
  const MARKINGS = ["rings", "speckles", "seam", "stripes", "stars"];
  const EYES = ["round", "half", "bright"];
  const CRESTS = ["none", "flame", "leaf", "halo", "curl"];
  const TRAITS = [
    "keeps good notes", "hums at low hours", "collects small stones",
    "asks one more question", "remembers every door", "likes high shelves",
    "watches the weather", "guards the quiet", "counts the moons",
    "follows old maps"
  ];

  /* Each kind has its own little voice: a home pitch for the soft
   * two-note chirp the Spark makes when it is tapped or first met.
   * The notes are pure data here; the browser glue plays them with
   * WebAudio, only ever in answer to a tap — never on its own. */
  const KIND_PITCH = { fire: 660, water: 440, shadow: 330, air: 560, earth: 300, light: 760 };

  function chirpFor(companion) {
    if (!companion) return null;
    const rand = mulberry32(hashString(companion.seed + ":voice"));
    const base = (KIND_PITCH[companion.kind] || 440) * (0.94 + rand() * 0.12);
    return { first: Math.round(base), second: Math.round(base * 1.335) };
  }

  /* Growth stages, in plain words. Points come from facts:
   * each return day after the first is worth 2, each practice day 3,
   * each new page seen 1 (counted up to 10 pages). */
  const STAGES = [
    { name: "Just born", min: 0 },
    { name: "Kindled", min: 3 },
    { name: "Growing", min: 8 },
    { name: "Bright", min: 15 },
    { name: "Radiant", min: 25 }
  ];

  /* ---- seed ---- */

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

  function makeSeed({ moon, patternDay, kindIndex, nonce }) {
    const m = moon == null ? 0 : moon;
    const p = patternDay == null ? 365 : patternDay;
    return [SEED_PREFIX, m, p, kindIndex, String(nonce)].join("-");
  }

  function parseSeed(seed) {
    if (typeof seed !== "string") return null;
    const parts = seed.split("-");
    if (parts.length !== 5 || parts[0] !== SEED_PREFIX) return null;
    const moon = Number(parts[1]);
    const patternDay = Number(parts[2]);
    const kindIndex = Number(parts[3]);
    const nonce = parts[4];
    if (!Number.isInteger(moon) || moon < 0 || moon > 13) return null;
    if (!Number.isInteger(patternDay) || patternDay < 1 || patternDay > 365) return null;
    if (!Number.isInteger(kindIndex) || kindIndex < 0 || kindIndex >= KINDS.length) return null;
    if (!nonce) return null;
    return { moon: moon === 0 ? null : moon, patternDay, kindIndex, nonce };
  }

  function randomNonce() {
    const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
    let out = "";
    const rand =
      typeof crypto !== "undefined" && crypto.getRandomValues
        ? () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296
        : Math.random;
    for (let i = 0; i < 8; i++) out += alphabet[Math.floor(rand() * 36)];
    return out;
  }

  /* ---- kind ---- */

  function kindIndexById(id) {
    return KINDS.findIndex((k) => k.id === id);
  }

  /* The coordinate's own lean: the moon and the day together point
   * at a kind before any answers are given. Deterministic. */
  function coordinateKindIndex(moon, patternDay) {
    const m = moon == null ? 13 : moon;
    const p = patternDay == null ? 365 : patternDay;
    return (m * 5 + p * 3) % KINDS.length;
  }

  /* Answers outvote the coordinate; a tie falls back to it. */
  function resolveKindIndex({ moon, patternDay, answers }) {
    const coord = coordinateKindIndex(moon, patternDay);
    if (!Array.isArray(answers) || answers.length === 0) return coord;
    const votes = new Array(KINDS.length).fill(0);
    for (const id of answers) {
      const ix = kindIndexById(id);
      if (ix >= 0) votes[ix]++;
    }
    const best = Math.max(...votes);
    if (best === 0) return coord;
    const winners = votes
      .map((v, i) => (v === best ? i : -1))
      .filter((i) => i >= 0);
    return winners.includes(coord) ? coord : winners[0];
  }

  /* ---- generation ---- */

  function hsl(h, s, l) {
    return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;
  }

  function generate(seed) {
    const parsed = parseSeed(seed);
    if (!parsed) return null;
    const rand = mulberry32(hashString(seed));
    const kind = KINDS[parsed.kindIndex];
    const [h0, h1] = kind.hues;
    const hue = h0 + rand() * (h1 - h0);
    const accentHue = hue + 30 + rand() * 40;
    return {
      seed,
      kind: kind.id,
      kindName: kind.name,
      kindLine: kind.line,
      temperament: kind.temperament,
      trait: TRAITS[Math.floor(rand() * TRAITS.length)],
      form: FORMS[Math.floor(rand() * FORMS.length)],
      markings: {
        style: MARKINGS[Math.floor(rand() * MARKINGS.length)],
        count: 2 + Math.floor(rand() * 4)
      },
      eye: EYES[Math.floor(rand() * EYES.length)],
      crest: CRESTS[Math.floor(rand() * CRESTS.length)],
      palette: {
        body: hsl(hue, 62 + rand() * 18, 52 + rand() * 12),
        glow: hsl(hue, 85, 68 + rand() * 10),
        accent: hsl(accentHue, 72, 60 + rand() * 10)
      },
      birthMoon: parsed.moon,
      birthPatternDay: parsed.patternDay
    };
  }

  /* ---- rendering (SVG string; the browser drops it into the page) ---- */

  function bodyShape(companion) {
    const { body, accent } = companion.palette;
    switch (companion.form) {
      case "comet":
        return `<path d="M50 62 Q18 78 8 92 Q30 88 44 76 Z" fill="${accent}" opacity="0.75"/><circle cx="56" cy="52" r="26" fill="${body}"/>`;
      case "sprout":
        return `<ellipse cx="50" cy="58" rx="25" ry="27" fill="${body}"/><path d="M50 32 Q44 16 30 12 Q46 10 52 24 Q60 8 74 8 Q64 22 54 30 Z" fill="${accent}"/>`;
      case "shard":
        return `<polygon points="50,14 74,44 62,88 38,88 26,44" fill="${body}"/><polyline points="50,14 50,88" stroke="${accent}" stroke-width="2" opacity="0.6" fill="none"/>`;
      case "wave":
        return `<path d="M22 62 Q30 34 50 34 Q70 34 78 58 Q84 76 68 84 Q50 92 34 84 Q16 76 22 62 Z" fill="${body}"/>`;
      case "moth":
        return `<ellipse cx="28" cy="46" rx="17" ry="24" fill="${body}" opacity="0.85"/><ellipse cx="72" cy="46" rx="17" ry="24" fill="${body}" opacity="0.85"/><ellipse cx="50" cy="56" rx="11" ry="26" fill="${body}"/>`;
      case "orb":
      default:
        return `<circle cx="50" cy="54" r="28" fill="${body}"/>`;
    }
  }

  function markingShapes(companion, rand) {
    const { accent, glow } = companion.palette;
    const out = [];
    const n = companion.markings.count;
    if (companion.markings.style === "rings") {
      for (let i = 0; i < n; i++)
        out.push(`<circle cx="50" cy="54" r="${12 + i * 6}" fill="none" stroke="${glow}" stroke-width="1.6" opacity="${0.5 - i * 0.08}"/>`);
    } else if (companion.markings.style === "speckles") {
      for (let i = 0; i < n * 2; i++) {
        const a = rand() * Math.PI * 2;
        const r = 8 + rand() * 17;
        out.push(`<circle cx="${(50 + Math.cos(a) * r).toFixed(1)}" cy="${(54 + Math.sin(a) * r).toFixed(1)}" r="${(1.4 + rand() * 1.6).toFixed(1)}" fill="${glow}" opacity="0.8"/>`);
      }
    } else if (companion.markings.style === "seam") {
      out.push(`<path d="M28 40 Q50 ${44 + n * 4} 72 38 M30 68 Q50 ${60 + n * 3} 70 66" stroke="${accent}" stroke-width="2" fill="none" opacity="0.7" stroke-linecap="round"/>`);
    } else if (companion.markings.style === "stripes") {
      for (let i = 0; i < n; i++)
        out.push(`<line x1="${34 + i * 9}" y1="34" x2="${30 + i * 9}" y2="76" stroke="${glow}" stroke-width="2.4" opacity="0.45" stroke-linecap="round"/>`);
    } else if (companion.markings.style === "stars") {
      for (let i = 0; i < n; i++) {
        const x = 30 + rand() * 40;
        const y = 32 + rand() * 42;
        out.push(`<path d="M${x} ${y - 4} L${x + 1.2} ${y - 1.2} L${x + 4} ${y} L${x + 1.2} ${y + 1.2} L${x} ${y + 4} L${x - 1.2} ${y + 1.2} L${x - 4} ${y} L${x - 1.2} ${y - 1.2} Z" fill="${glow}" opacity="0.9"/>`);
      }
    }
    return out.join("");
  }

  function crestShape(companion) {
    const { accent, glow } = companion.palette;
    switch (companion.crest) {
      case "flame":
        return `<path d="M50 6 Q56 16 52 24 Q50 27 48 24 Q44 15 50 6 Z" fill="${accent}"/>`;
      case "leaf":
        return `<path d="M50 22 Q50 8 64 6 Q64 20 50 22 Z" fill="${accent}"/>`;
      case "halo":
        return `<ellipse cx="50" cy="16" rx="15" ry="4.5" fill="none" stroke="${glow}" stroke-width="2.4"/>`;
      case "curl":
        return `<path d="M50 24 Q50 10 60 12 Q67 14 63 20" fill="none" stroke="${accent}" stroke-width="2.6" stroke-linecap="round"/>`;
      default:
        return "";
    }
  }

  function eyeShape(companion) {
    const cy = companion.form === "moth" ? 50 : 52;
    if (companion.eye === "half")
      return `<path d="M41 ${cy} Q50 ${cy - 7} 59 ${cy}" stroke="#0b0e18" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    const r = companion.eye === "bright" ? 8.5 : 7;
    return `<circle cx="50" cy="${cy}" r="${r}" fill="#0b0e18"/><circle cx="50" cy="${cy}" r="${r * 0.45}" fill="${companion.palette.glow}"/><circle cx="${50 + r * 0.3}" cy="${cy - r * 0.3}" r="${r * 0.18}" fill="#fff"/>`;
  }

  function renderSVG(companion, { stage = 0 } = {}) {
    if (!companion) return "";
    const rand = mulberry32(hashString(companion.seed + ":marks"));
    const stageRing =
      stage >= 2
        ? `<circle cx="50" cy="52" r="46" fill="none" stroke="${companion.palette.accent}" stroke-width="1.6" stroke-dasharray="4 6" opacity="0.8"/>`
        : "";
    const stageCrown =
      stage >= 4
        ? `<path d="M38 12 L44 4 L50 11 L56 4 L62 12 Z" fill="${companion.palette.accent}" opacity="0.95"/>`
        : "";
    return (
      `<svg viewBox="0 0 100 100" role="img" aria-label="A ${companion.kindName} Spark" data-spark-form="${companion.form}" data-spark-stage="${stage}">` +
      `<circle cx="50" cy="52" r="40" fill="${companion.palette.glow}" opacity="${0.14 + stage * 0.03}"/>` +
      stageRing +
      bodyShape(companion) +
      markingShapes(companion, rand) +
      crestShape(companion) +
      eyeShape(companion) +
      stageCrown +
      `</svg>`
    );
  }

  /* ---- the record: seed + name + what it has noticed ---- */

  function normalizeName(name) {
    const clean = String(name == null ? "" : name).replace(/\s+/g, " ").trim();
    if (!clean) return NAME_FALLBACK;
    return clean.slice(0, NAME_MAX);
  }

  function newRecord({ seed, name, civilDate }) {
    return {
      version: 1,
      seed,
      name: normalizeName(name),
      bornCivil: civilDate || null,
      daysSeen: [],
      pagesSeen: [],
      practiceDays: [],
      lastDay: null
    };
  }

  function recordVisit(record, { patternDay, page }) {
    const next = { ...record };
    if (patternDay != null && !next.daysSeen.includes(patternDay)) {
      next.daysSeen = [...next.daysSeen, patternDay].sort((a, b) => a - b);
    }
    if (page && !next.pagesSeen.includes(page)) {
      next.pagesSeen = [...next.pagesSeen, page];
    }
    if (patternDay != null) next.lastDay = patternDay;
    return next;
  }

  function recordPractice(record, { patternDay }) {
    const next = { ...record };
    if (patternDay != null && !next.practiceDays.includes(patternDay)) {
      next.practiceDays = [...next.practiceDays, patternDay].sort((a, b) => a - b);
    }
    return next;
  }

  function growthPoints(record) {
    const returnDays = Math.max(0, (record.daysSeen || []).length - 1);
    const practice = (record.practiceDays || []).length;
    const pages = Math.min(10, (record.pagesSeen || []).length);
    return returnDays * 2 + practice * 3 + pages;
  }

  function stageFor(points) {
    let ix = 0;
    STAGES.forEach((s, i) => {
      if (points >= s.min) ix = i;
    });
    return { index: ix, name: STAGES[ix].name, points };
  }

  function stageOf(record) {
    return stageFor(growthPoints(record));
  }

  /* ---- guidance: lines drawn only from what the record holds ---- */

  function guidanceFor({ record, companion, todayPatternDay }) {
    const name = normalizeName(record && record.name);
    const pages = (record && record.pagesSeen) || [];
    const practice = (record && record.practiceDays) || [];
    const days = (record && record.daysSeen) || [];
    const say = (text, href) => ({ name, text, href: href || null });

    if (todayPatternDay != null && record && record.lastDay != null) {
      const gap = todayPatternDay - record.lastDay;
      if (gap >= 7)
        return say(
          `You have been away ${gap} days of the pattern. Start with today's telling and see where the moon has got to.`,
          "moons.html"
        );
    }
    if (days.length <= 1)
      return say(
        `This is our first day. The 13 Moons page tells today in plain words — shall we start there?`,
        "moons.html"
      );
    if (practice.length === 0)
      return say(
        `You have not sealed a practice yet. A short one on the practice page is a good first mark.`,
        "teach.html"
      );
    if (!pages.some((p) => p.includes("living-time-sphere")))
      return say(
        `You have not stood in front of the Sphere together yet. It is the whole year, turning.`,
        "living-time-sphere.html"
      );
    if (!pages.some((p) => p.includes("witness")))
      return say(
        `There is a page here kept by Witness, the one who built this site with Aaron. Worth a look.`,
        "witness.html"
      );
    if (companion && todayPatternDay != null && todayPatternDay === companion.birthPatternDay)
      return say(
        `Today is the same Pattern Day I was born on — ${companion.birthPatternDay}. A good day to mark something.`,
        "teach.html"
      );
    return say(
      `Pattern Day ${todayPatternDay} of 364. The day has a name and a practice — the telling is on the 13 Moons page.`,
      "moons.html"
    );
  }

  return {
    SEED_PREFIX,
    STORAGE_KEY,
    NAME_FALLBACK,
    KINDS,
    QUESTIONS,
    FORMS,
    MARKINGS,
    STAGES,
    hashString,
    mulberry32,
    makeSeed,
    parseSeed,
    randomNonce,
    kindIndexById,
    coordinateKindIndex,
    resolveKindIndex,
    generate,
    renderSVG,
    chirpFor,
    normalizeName,
    newRecord,
    recordVisit,
    recordPractice,
    growthPoints,
    stageFor,
    stageOf,
    guidanceFor
  };
});
