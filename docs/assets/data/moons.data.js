/* =======================================================================
   Scroll of Fire — 13 Moons Data Pack
   Exposes: __MOONS__, __PRACTICES__, __NUMEROLOGY__, __VERSES__, MoonData
   Stable API for moons.html / moons.js
   ======================================================================= */

(function () {
  "use strict";

  // --- 13 Moons (index 1..13)
  // color chosen to softly theme the UI per-moon; keep good contrast on dark UI
  const MOONS = [
    { idx: 1,  name: "Magnetic",    essence: "Unify · Purpose",         color: "#6FE7FF", sigil: "assets/glyphs/moon-01.svg" },
    { idx: 2,  name: "Lunar",       essence: "Polarize · Challenge",     color: "#B1C7FF", sigil: "assets/glyphs/moon-02.svg" },
    { idx: 3,  name: "Electric",    essence: "Activate · Service",       color: "#7AF3FF", sigil: "assets/glyphs/moon-03.svg" },
    { idx: 4,  name: "Self-Existing", essence: "Define · Form",          color: "#7BF3B8", sigil: "assets/glyphs/moon-04.svg" },
    { idx: 5,  name: "Overtone",    essence: "Empower · Radiance",       color: "#FFD27A", sigil: "assets/glyphs/moon-05.svg" },
    { idx: 6,  name: "Rhythmic",    essence: "Organize · Equality",      color: "#A7FFCF", sigil: "assets/glyphs/moon-06.svg" },
    { idx: 7,  name: "Resonant",    essence: "Channel · Attunement",     color: "#D5B6FF", sigil: "assets/glyphs/moon-07.svg" },
    { idx: 8,  name: "Galactic",    essence: "Harmonize · Integrity",    color: "#A8FFD9", sigil: "assets/glyphs/moon-08.svg" },
    { idx: 9,  name: "Solar",       essence: "Pulse · Intention",        color: "#FFBC6F", sigil: "assets/glyphs/moon-09.svg" },
    { idx:10,  name: "Planetary",   essence: "Perfect · Manifestation",  color: "#A2FFD1", sigil: "assets/glyphs/moon-10.svg" },
    { idx:11,  name: "Spectral",    essence: "Dissolve · Liberation",    color: "#A8B8FF", sigil: "assets/glyphs/moon-11.svg" },
    { idx:12,  name: "Crystal",     essence: "Dedicate · Cooperation",   color: "#FFD7A8", sigil: "assets/glyphs/moon-12.svg" },
    { idx:13,  name: "Cosmic",      essence: "Endure · Presence",        color: "#9DDAFF", sigil: "assets/glyphs/moon-13.svg" }
  ];

  // --- Practices & prompts (lightweight; UI picks a few each day)
  const PRACTICES = [
    { id: "breath-crown",    title: "Crown the breath",        text: "Count 4–4–4–4. Inhale, hold, exhale, hold. Keep the crown light." },
    { id: "order-the-week",  title: "Order the week",          text: "Name your four anchors: body, mind, craft, kin. One act each." },
    { id: "witness-note",    title: "Witness note",            text: "Write one clear, unblended line about today. No spin, only witness." },
    { id: "release-one",     title: "Release one thing",       text: "Pick a minor weight and set it down. A drawer, a tab, a worry." },
    { id: "field-brighten",  title: "Brighten the field",      text: "Practice one kind turn that leaves no ledger—just warmth." },
    { id: "seal-intent",     title: "Seal intent",             text: "Say it once aloud, slow. Close with gratitude and quiet." },
    { id: "walk-quiet",      title: "Walk in quiet",           text: "Ten minutes walking without phone. Track breath + horizon." },
    { id: "craft-15",        title: "Fifteen on the craft",    text: "Uninterrupted micro-sprint on your craft. No scrolling." }
  ];

  // --- Simple numerology lines (sum of YYYYMMDD and moon/day; lightweight flavor)
  const NUMEROLOGY = {
    format(n) { return String(n).split("").join(" + ") + " = " + n; },
    energy(n) {
      const m = n % 9 || 9;
      const lines = {
        1: "Origin spark — start clean, cut the drag.",
        2: "Bond and balance — pair up, reconcile edges.",
        3: "Voice and shape — say it, sketch it, share it.",
        4: "Define and lay bricks — form gives freedom.",
        5: "Change with calm — move, but steer.",
        6: "Tend the circle — keep the commons bright.",
        7: "Attune and inquire — go quiet, listen deeper.",
        8: "Weigh and wield — power as stewardship.",
        9: "Finish and free — complete the loop, return it."
      };
      return { root: m, text: lines[m] };
    }
  };

  // --- Verses of the day (Hebrew/English)
  const VERSES = [
    { he: "בְּכָל־לְבָבְךָ", en: "With all your heart.", ref: "Deut 6:5" },
    { he: "אֱמֶת וְשָׁלוֹם אֱהָבוּ", en: "Love truth and peace.", ref: "Zech 8:19" },
    { he: "שִׁוִּיתִי יְהוָה לְנֶגְדִּי תָמִיד", en: "I set YHWH before me always.", ref: "Ps 16:8" },
    { he: "אוֹר זָרֻעַ לַצַּדִּיק", en: "Light is sown for the upright.", ref: "Ps 97:11" },
    { he: "הַחֲזֵק וֶאֱמָץ", en: "Be strong and courageous.", ref: "Josh 1:9" }
  ];

  // --- Helper: stable pick per-date (so the same day shows the same verse/practices without storage)
  function dailyIndex(seedStr, mod) {
    // simple xorshift32 seeded by date string
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    // xorshift-ish
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return Math.abs(h >>> 0) % mod;
  }

  function pickForDate(dateISO) {
    const iVerse = dailyIndex(dateISO + "::verse", VERSES.length);
    const iPractice = (k) => (dailyIndex(dateISO + "::p"+k, PRACTICES.length));
    const practices = [PRACTICES[iPractice(0)], PRACTICES[iPractice(1)], PRACTICES[iPractice(2)]]
      .filter(Boolean)
      .reduce((acc, p) => {
        if (!acc.find(x => x.id === p.id)) acc.push(p); // avoid dupes
        return acc;
      }, [])
      .slice(0, 3);

    return { verse: VERSES[iVerse], practices };
  }

  // --- API surface
  const MoonData = {
    get moons() { return MOONS.slice(); },
    get practices() { return PRACTICES.slice(); },
    get verses() { return VERSES.slice(); },
    numerology(date) {
      try {
        const y = Number(date.slice(0, 4));
        const m = Number(date.slice(5, 7));
        const d = Number(date.slice(8, 10));
        const sum = (y + m + d);
        const info = NUMEROLOGY.energy(sum);
        return { sum, root: info.root, line: NUMEROLOGY.format(sum), energy: info.text };
      } catch {
        return { sum: NaN, root: NaN, line: "—", energy: "—" };
      }
    },
    daily(dateISO) { return pickForDate(dateISO); }
  };

  // Expose globals for moons.js and the page
  window.__MOONS__ = MOONS;
  window.__PRACTICES__ = PRACTICES;
  window.__NUMEROLOGY__ = NUMEROLOGY;
  window.__VERSES__ = VERSES;
  window.MoonData = MoonData;

})();
