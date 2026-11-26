/**
 * Spark play - character and entertaining interactions
 * (Aaron's order, Nov 25, 2026, live call ~19:28 PST:
 * "Wear the Spark character a little bit. Maybe detail more."
 * and "Make their interactions and everything be more
 * entertaining." - "No, I mean on the site.")
 *
 * This layer gives the Spark a character with a life of its
 * own between the keeper's touches, on the Spark's home
 * surfaces - the Companions page and Their Home - and nowhere
 * else:
 *   - CHARACTER. From the keeper's real seed, by the core's
 *     own hash and stream: a mannerism (weighted by its
 *     temperament), the form of the little sparks that gather
 *     around it when it lights up (Aaron's Nov 19 ruling: no
 *     bubble, ever - it lights up like a spark, with little
 *     sparks forming around it), and the play it loves most.
 *     A pure function of the seed: the same Spark is the same
 *     character on every visit and device. The identity is
 *     read, never written; nothing here mints or renames.
 *   - IDLE LIFE. On a sparse setTimeout chain (seconds, not a
 *     frame loop) the Spark does small things - its mannerism,
 *     a breath of glow, a peek - then settles. One class
 *     toggle per act, transform and opacity only. It never
 *     blocks, never opens anything, never speaks uninvited.
 *     Reduced motion stills it entirely, a hidden tab sleeps
 *     it, any touch from the keeper resets its clock.
 *   - ANSWERING BACK. A pet on the big stage is answered: the
 *     attendant little sparks burst in the Spark's own form,
 *     and its mannerism flashes with it.
 *   - TEACHABLE TRICKS, BY BREADTH (the ruled play / care /
 *     tricks design, Nov 23, 2026). The keeper can PRACTISE
 *     the kind signature together with the Spark here; a
 *     practise counts once per Pattern Day. Practised on two
 *     different days, the trick is TAUGHT: remembered in this
 *     layer's own small local store (sof.spark-play.v1), and
 *     performable from then on. Same-day repeats write nothing.
 *   - THE ECHO DUET (the ruled design's 1.2, in miniature).
 *     The Spark sounds a short phrase on four lit stones in
 *     its seed colours; the keeper echoes it; each finished
 *     round grows the phrase by one. A miss is gentle - shown
 *     again, slower, "watch me" - and nothing is lost.
 *   - CELEBRATIONS AT REAL COMPLETIONS ONLY. This layer
 *     listens for the same real events the presence layer
 *     celebrates (a practice sealed, a witness saved) and
 *     answers on the big stage. No celebrate button exists
 *     here, and nothing fires for showing up.
 *   - THE GREETING. Once per Pattern Day, Their Home answers
 *     the Spark's arrival with a shimmer across the stage. A
 *     reading, not a reward: it writes only the day it last
 *     shimmered, so it can never become a streak.
 *   - THE MOON-TURN HARVEST CARD (phase 2, adopted by Aaron
 *     the same evening). At each Moon's turn the Spark
 *     composes the keeper a card from the days actually
 *     witnessed together in that Moon - kept days, practices
 *     sealed, and the keeper's own words from their Atlas
 *     entries. Record facts only: a thin Moon yields an
 *     honestly spare card, an empty Moon composes nothing,
 *     and nothing absent is ever named.
 *   - KIND-ELEMENT NOTICING (phase 2, the same adoption). A
 *     Spark's kind leans into its element from the kept record
 *     only - a Water Spark remembers the rain in the keeper's
 *     own entries, a Light Spark the sunrise ones. No new data
 *     is collected; where the record holds nothing of its
 *     element, the Spark says nothing about it.
 *
 * The fences, by construction: companion layer only - no
 * protected file is touched and the Sphere itself is never
 * asked to react. Performance is a fence: no layout-measuring
 * call of any kind, no per-frame work, bursts are a bounded
 * handful of nodes removed within two seconds. Sound only
 * after the keeper's own tap, subtle, and never when the
 * standing sound switch on this device is off. Speech is not
 * depended on: every line is text in a live region first.
 * Children's rules unchanged: nothing here opens talking,
 * nothing leaves the device. No negative absence framing
 * anywhere: a return is met the standing way - the place
 * was kept.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.SparkPlay = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STORE_KEY = "sof.spark-play.v1";
  const SOUND_KEY = "sof.spark.sound";

  /* ---------------- the character ---------------- */

  /* One mannerism set per temperament: the small things this
   * Spark does when nothing is asked of it. `act` names the
   * idle class the stylesheet animates; `label` says it in
   * plain words for the character line. */
  const MANNERISMS = {
    bold: [
      { id: "flare-flick", label: "flicks its flame like a struck match" },
      { id: "dart-peek", label: "darts out a little way, then peeks back" }
    ],
    gentle: [
      { id: "ripple-sway", label: "sways the way water settles" },
      { id: "mote-drift", label: "lets its little sparks drift out, and home again" }
    ],
    quiet: [
      { id: "peek", label: "dims to almost nothing, then peeks back" },
      { id: "slow-breath", label: "breathes slow and low" }
    ],
    curious: [
      { id: "look-about", label: "looks about, taking everything in" },
      { id: "mote-juggle", label: "tosses its little sparks up and catches them" }
    ],
    steady: [
      { id: "root-settle", label: "settles low, grounded as a stone" },
      { id: "slow-breath", label: "breathes slow and low" }
    ],
    bright: [
      { id: "halo-rise", label: "lets a ring of light rise off it and settle back" },
      { id: "flare-flick", label: "flicks its flame like a struck match" }
    ]
  };

  /* The little sparks that form around it when it lights up —
   * the seed's own form for them (the appearance ruling's
   * seed-varied forms). */
  const SPARKLE_FORMS = [
    { id: "petals", label: "petals of light" },
    { id: "rings", label: "small rings" },
    { id: "shards", label: "bright shards" },
    { id: "beads", label: "round beads of light" }
  ];

  const PLAY_STYLES = [
    { id: "chase", label: "the chase" },
    { id: "echo", label: "echo games" },
    { id: "peek", label: "peek-and-find" }
  ];

  /* How long this temperament rests between idle acts, in
   * milliseconds — bold and bright sooner, quiet and steady
   * later. A range, so the life never ticks like a clock. */
  const IDLE_RANGES = {
    bold: [7000, 12000],
    gentle: [11000, 18000],
    quiet: [13000, 20000],
    curious: [8000, 13000],
    steady: [12000, 19000],
    bright: [9000, 15000]
  };

  /* The core's own hash and stream, when the core is at hand,
   * so this layer's derivations ride the same seed math as
   * everything else about the Spark. A small FNV stand-in
   * keeps the pure functions testable without the core. */
  function hashString(text) {
    const Core = typeof window !== "undefined" ? window.SparkCompanion : null;
    if (Core && typeof Core.hashString === "function") return Core.hashString(text);
    let h = 0x811c9dc5;
    const s = String(text == null ? "" : text);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function streamFor(seedText) {
    const Core = typeof window !== "undefined" ? window.SparkCompanion : null;
    if (Core && typeof Core.mulberry32 === "function") return Core.mulberry32(hashString(seedText));
    let a = hashString(seedText);
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* The character, whole: a pure function of the companion
   * (which is itself a pure function of the seed). */
  function characterFor(companion) {
    if (!companion || !companion.seed) return null;
    const rand = streamFor(companion.seed + ":play-character");
    const manners = MANNERISMS[companion.temperament] || MANNERISMS.curious;
    const mannerism = manners[Math.floor(rand() * manners.length)];
    const sparkle = SPARKLE_FORMS[Math.floor(rand() * SPARKLE_FORMS.length)];
    const playStyle = PLAY_STYLES[Math.floor(rand() * PLAY_STYLES.length)];
    const range = IDLE_RANGES[companion.temperament] || IDLE_RANGES.curious;
    return {
      mannerism,
      sparkle,
      playStyle,
      idleMinMs: range[0],
      idleMaxMs: range[1],
      /* The duet's four notes, grown from the seed: a base the
       * seed chooses, then the day's-scale steps above it. */
      baseHz: Math.round(300 + rand() * 160)
    };
  }

  function idleDelayMs(character, rand) {
    const r = typeof rand === "function" ? rand() : Math.random();
    return Math.round(character.idleMinMs + r * (character.idleMaxMs - character.idleMinMs));
  }

  /* ---------------- the small local store ---------------- */

  function blankStore() {
    return { v: 1, practiseDays: {}, taught: {}, duet: { best: 0, learnedDay: null }, greetedDay: null, harvestCards: {} };
  }

  function loadStore(storage) {
    try {
      const raw = storage && storage.getItem(STORE_KEY);
      if (!raw) return blankStore();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return blankStore();
      const store = blankStore();
      if (parsed.practiseDays && typeof parsed.practiseDays === "object") {
        for (const [k, v] of Object.entries(parsed.practiseDays)) {
          if (Array.isArray(v)) store.practiseDays[k] = v.filter((d) => Number.isFinite(d));
        }
      }
      if (parsed.taught && typeof parsed.taught === "object") {
        for (const [k, v] of Object.entries(parsed.taught)) {
          if (Number.isFinite(v)) store.taught[k] = v;
        }
      }
      if (parsed.duet && Number.isFinite(parsed.duet.best)) store.duet.best = parsed.duet.best;
      if (parsed.duet && Number.isFinite(parsed.duet.learnedDay)) store.duet.learnedDay = parsed.duet.learnedDay;
      if (Number.isFinite(parsed.greetedDay)) store.greetedDay = parsed.greetedDay;
      if (parsed.harvestCards && typeof parsed.harvestCards === "object") {
        for (const [k, v] of Object.entries(parsed.harvestCards)) {
          if (Number.isFinite(v)) store.harvestCards[k] = v;
        }
      }
      return store;
    } catch {
      return blankStore();
    }
  }

  function saveStore(storage, store) {
    try {
      storage.setItem(STORE_KEY, JSON.stringify(store));
    } catch {
      /* the Spark rests */
    }
    return store;
  }

  /* A practise counts once per Pattern Day; the trick is
   * taught when the practises stand on two different days —
   * breadth, the design's own rule for learning. */
  function recordPractise(store, trickId, patternDay) {
    if (!trickId || !Number.isFinite(patternDay)) return { store, learnedNow: false, counted: false };
    const days = Array.isArray(store.practiseDays[trickId]) ? store.practiseDays[trickId] : [];
    if (days.includes(patternDay)) return { store, learnedNow: false, counted: false };
    days.push(patternDay);
    store.practiseDays[trickId] = days;
    if (days.length >= 2 && !Number.isFinite(store.taught[trickId])) {
      store.taught[trickId] = patternDay;
      return { store, learnedNow: true, counted: true };
    }
    return { store, learnedNow: false, counted: true };
  }

  /* The duet is learned the first time a phrase of three is
   * finished; the best length is a keepsake, never a score. */
  function recordDuet(store, length, patternDay) {
    if (!Number.isFinite(length) || length <= 0) return { store, learnedNow: false };
    let learnedNow = false;
    if (length > store.duet.best) store.duet.best = length;
    if (length >= 3 && !Number.isFinite(store.duet.learnedDay) && Number.isFinite(patternDay)) {
      store.duet.learnedDay = patternDay;
      learnedNow = true;
    }
    return { store, learnedNow };
  }

  function taughtTrickIds(store) {
    return Object.keys(store.taught || {});
  }

  /* ---------------- phase 2: the harvest card ---------------- */

  /* The calendar's own shape: thirteen Moons of twenty-eight
   * days, and the Day Out of Time standing outside them. */
  function moonOfPatternDay(patternDay) {
    if (!Number.isFinite(patternDay) || patternDay < 1 || patternDay > 365) return null;
    if (patternDay === 365) return { moon: null, day: null };
    return { moon: Math.floor((patternDay - 1) / 28) + 1, day: ((patternDay - 1) % 28) + 1 };
  }

  function daysInMoon(days, moon) {
    return (Array.isArray(days) ? days : [])
      .filter((d) => {
        const at = moonOfPatternDay(d);
        return at && at.moon === moon;
      })
      .sort((a, b) => a - b);
  }

  /* The Moon-turn harvest card, composed whole from the kept
   * record: the days witnessed together in that Moon, the
   * practices sealed in it, and the keeper's own words — the
   * titles of their Atlas entries — that stand in it. Facts
   * only: a Moon with no witnessed day composes nothing, and
   * a thin Moon composes an honestly spare card. Nothing is
   * counted that was not kept, and nothing absent is named. */
  function harvestFor(facts, moon) {
    if (!facts || !Number.isFinite(moon)) return null;
    const witnessedDays = daysInMoon(facts.daysSeen, moon);
    if (!witnessedDays.length) return null;
    const sealedDays = daysInMoon(facts.practiceDays, moon);
    const words = (Array.isArray(facts.entries) ? facts.entries : [])
      .filter((e) => e && Number.isFinite(e.patternDay) && e.title
        && (moonOfPatternDay(e.patternDay) || {}).moon === moon)
      .sort((a, b) => a.patternDay - b.patternDay)
      .map((e) => ({ patternDay: e.patternDay, title: e.title }));
    return { moon, witnessedDays, sealedDays, words };
  }

  /* The latest Moon that has turned (every day in it stands
   * before today, and it is not the Moon today stands in)
   * that holds a card's worth of keeping. */
  function harvestMoonFor(facts, todayPatternDay) {
    if (!Number.isFinite(todayPatternDay)) return null;
    const todayMoon = (moonOfPatternDay(todayPatternDay) || {}).moon;
    for (let moon = 13; moon >= 1; moon--) {
      if (moon === todayMoon) continue;
      const days = daysInMoon(facts && facts.daysSeen, moon);
      if (!days.length) continue;
      if (Math.max(...days) < todayPatternDay) return moon;
    }
    return null;
  }

  /* ---------------- phase 2: kind-element noticing ---------------- */

  /* Each kind leans toward its element in the keeper's OWN
   * words — the titles of their kept entries. The lists are
   * small and plain on purpose: a noticing is the keeper's
   * record read back, never a guess about their life, and
   * never anything fetched from outside the record. */
  const ELEMENT_WORDS = {
    fire: ["fire", "flame", "forge", "bench", "ember", "burn", "candle"],
    water: ["rain", "water", "watering", "river", "shore", "wash", "sea", "lake", "well", "creek"],
    light: ["sunrise", "dawn", "first light", "early", "sun", "light", "morning"],
    air: ["wind", "sky", "breath", "storm", "bird", "breeze", "cloud"],
    earth: ["garden", "plant", "seed", "soil", "harvest", "bed", "grow", "tree"],
    shadow: ["night", "dark", "quiet", "dream", "rest", "shadow", "moon"]
  };

  const ELEMENT_NAMES = {
    fire: "the fire", water: "the water", light: "the early light",
    air: "the open sky", earth: "the garden", shadow: "the quiet"
  };

  function wordsMatch(title, words) {
    const text = ` ${String(title || "").toLowerCase()} `;
    return words.some((w) => text.includes(` ${w} `) || text.includes(` ${w},`) || text.includes(` ${w}.`)
      || text.includes(` ${w}'`) || text.includes(` ${w}s `) || text.includes(` ${w}ed `));
  }

  /* What this Spark's kind notices in the kept record, or
   * null — and where the record holds nothing of its element,
   * the Spark says nothing about it. Fire and Shadow also
   * hold one structural fact each, from the record's own
   * counters: the practices sealed at the Bench, and the
   * rests kept together. */
  function noticingFor(kind, facts) {
    if (!kind || !facts) return null;
    const words = ELEMENT_WORDS[kind];
    if (words) {
      const matches = (Array.isArray(facts.entries) ? facts.entries : [])
        .filter((e) => e && Number.isFinite(e.patternDay) && e.title && wordsMatch(e.title, words))
        .sort((a, b) => a.patternDay - b.patternDay);
      if (matches.length) {
        const latest = matches[matches.length - 1];
        return {
          kind, via: "words", count: matches.length,
          latestDay: latest.patternDay, latestTitle: latest.title,
          element: ELEMENT_NAMES[kind]
        };
      }
    }
    if (kind === "fire" && Array.isArray(facts.practiceDays) && facts.practiceDays.length) {
      return {
        kind, via: "sealed", count: facts.practiceDays.length,
        latestDay: facts.practiceDays[facts.practiceDays.length - 1], latestTitle: null,
        element: ELEMENT_NAMES.fire
      };
    }
    if (kind === "shadow" && Number.isFinite(facts.rests) && facts.rests > 0) {
      return {
        kind, via: "rests", count: facts.rests,
        latestDay: null, latestTitle: null, element: ELEMENT_NAMES.shadow
      };
    }
    return null;
  }

  /* ---------------- celebrations: real completions only ------- */

  /* The same two real moments the presence layer celebrates:
   * a practice sealed (the records-changed event whose source
   * is the practice page) and a witness saved. Anything else
   * — an open, an arrival, a tap — is not a completion, and
   * this predicate is the whole gate. */
  function isCelebrationEvent(kind, detail) {
    if (kind === "witness-saved") return true;
    if (kind === "records-changed") return Boolean(detail && detail.source === "manifest-practice");
    return false;
  }

  /* ---------------- reduced motion ---------------- */

  function reducedMotion(win) {
    const w = win || (typeof window !== "undefined" ? window : null);
    if (!w) return false;
    try {
      if (w.document && w.document.documentElement.classList.contains("sof-reduced-motion")) return true;
      return Boolean(w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch {
      return false;
    }
  }

  const api = {
    STORE_KEY,
    SOUND_KEY,
    MANNERISMS,
    SPARKLE_FORMS,
    PLAY_STYLES,
    IDLE_RANGES,
    characterFor,
    idleDelayMs,
    blankStore,
    loadStore,
    saveStore,
    recordPractise,
    recordDuet,
    taughtTrickIds,
    moonOfPatternDay,
    daysInMoon,
    harvestFor,
    harvestMoonFor,
    ELEMENT_WORDS,
    ELEMENT_NAMES,
    noticingFor,
    isCelebrationEvent,
    reducedMotion
  };

  /* ---------------- the browser layer ---------------- */

  if (typeof document === "undefined" || typeof window === "undefined") return api;

  const Core = window.SparkCompanion;
  if (!Core) return api;

  function readRecord() {
    try {
      const raw = window.localStorage.getItem(Core.STORAGE_KEY);
      if (!raw) return null;
      const record = JSON.parse(raw);
      return record && Core.parseSeed(record.seed) ? record : null;
    } catch {
      return null;
    }
  }

  function todayPatternDay() {
    try {
      if (window.SOFTemporalCursor && typeof window.SOFTemporalCursor.resolvePosition === "function") {
        const pos = window.SOFTemporalCursor.resolvePosition(new Date());
        if (pos && Number.isFinite(pos.dayOfPatternYear)) return pos.dayOfPatternYear;
      }
      if (window.PatternCalendar) {
        const pos = window.PatternCalendar.fromCivilDate({ date: new Date() });
        if (pos && Number.isFinite(pos.dayOfPatternYear)) return pos.dayOfPatternYear;
      }
    } catch {
      /* the day stands unnamed */
    }
    return null;
  }

  function soundAllowed() {
    try {
      return window.localStorage.getItem(SOUND_KEY) !== "off";
    } catch {
      return true;
    }
  }

  let audioCtx = null;
  function playNote(freq, at = 0, dur = 0.32) {
    if (!soundAllowed()) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const t0 = audioCtx.currentTime + at;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.08, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      /* silence is always allowed */
    }
  }

  let booted = false;
  function boot() {
    if (booted) return;
    const section = document.querySelector("#spark-companion");
    const mount = document.querySelector("#spark-play");
    if (!section || !mount) return;
    const record = readRecord();
    if (!record) {
      /* No Spark lives here yet — the meeting flow may stand
       * one up without a reload. Watch for the companion
       * section opening, and boot then. */
      const watcher = new MutationObserver(() => {
        if (!section.hidden && readRecord()) {
          watcher.disconnect();
          boot();
        }
      });
      watcher.observe(section, { attributes: true, attributeFilter: ["hidden"] });
      return;
    }
    booted = true;
    const companion = Core.generate(record.seed);
    const character = characterFor(companion);
    if (!character) return;
    const name = Core.displayName ? Core.displayName(record, companion) : companion.name;
    const still = reducedMotion(window);
    let store = loadStore(window.localStorage);
    const today = todayPatternDay();

    /* ----- build the section ----- */
    mount.innerHTML =
      `<div id="spark-play-harvest"></div>` +
      `<h3 style="margin:14px 0 4px">Play together</h3>` +
      `<p class="spark-note" id="spark-play-character"></p>` +
      `<p class="spark-note" id="spark-play-noticing" role="status" aria-live="polite"></p>` +
      `<div class="spark-play-tricks" id="spark-play-tricks" role="group" aria-label="Tricks to perform and practise"></div>` +
      `<p class="spark-note" id="spark-play-trick-note" role="status" aria-live="polite"></p>` +
      `<div class="spark-play-duet" id="spark-play-duet">` +
        `<p class="spark-note">${name} can trade phrases with you — the echo duet. ` +
        `It sounds a few notes on the lit stones; tap them back in the same order. ` +
        `Miss, and it shows you again, slower. Nothing is lost.</p>` +
        `<div class="spark-actions" style="justify-content:center">` +
          `<button type="button" class="spark-button" id="spark-play-duet-start">Start the duet</button>` +
        `</div>` +
        `<div class="spark-play-pads" id="spark-play-pads" role="group" aria-label="The four duet stones"></div>` +
        `<p class="spark-note" id="spark-play-duet-status" role="status" aria-live="polite"></p>` +
      `</div>` +
      `<p class="spark-note" id="spark-play-line" role="status" aria-live="polite"></p>`;

    const characterLine = mount.querySelector("#spark-play-character");
    characterLine.textContent =
      `Its character: ${name} ${character.mannerism.label}. ` +
      `When it lights up, the little sparks around it gather as ${character.sparkle.label}. ` +
      `Of all the games, it loves ${character.playStyle.label} best.`;

    const bigArt = document.querySelector("#spark-big-art");
    const line = mount.querySelector("#spark-play-line");
    const say = (text) => { if (line) line.textContent = text; };

    /* ----- the attendant little sparks ----- */
    let burstLayer = null;
    function burst(count = 10) {
      if (still || !bigArt) return;
      if (!burstLayer) {
        burstLayer = document.createElement("div");
        burstLayer.className = "spark-play-burst";
        burstLayer.setAttribute("aria-hidden", "true");
        bigArt.appendChild(burstLayer);
      }
      const rand = streamFor(companion.seed + ":burst:" + Date.now());
      for (let i = 0; i < count; i++) {
        const mote = document.createElement("span");
        mote.className = `spark-play-mote is-${character.sparkle.id}`;
        const angle = rand() * Math.PI * 2;
        const dist = 40 + rand() * 70;
        mote.style.setProperty("--mx", `${Math.round(Math.cos(angle) * dist)}px`);
        mote.style.setProperty("--my", `${Math.round(Math.sin(angle) * dist)}px`);
        mote.style.animationDelay = `${Math.round(rand() * 180)}ms`;
        burstLayer.appendChild(mote);
        window.setTimeout(() => mote.remove(), 2100);
      }
    }

    function flourish(actClass, ms = 2400) {
      if (still || !bigArt) return;
      /* Restart the animation without a layout read: drop the
       * class, let two frames pass, put it back. */
      bigArt.classList.remove(actClass);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          bigArt.classList.add(actClass);
          window.setTimeout(() => bigArt.classList.remove(actClass), ms);
        });
      });
    }

    /* ----- tricks: perform the known, practise the signature ----- */
    const tricksHost = mount.querySelector("#spark-play-tricks");
    const trickNote = mount.querySelector("#spark-play-trick-note");
    const TRICK_ART = {
      spin: "is-trick-spin", leap: "is-trick-leap", glow: "is-trick-glow",
      flare: "is-trick-flare", ripple: "is-trick-ripple", vanish: "is-trick-vanish",
      loop: "is-trick-loop", root: "is-trick-root", beam: "is-trick-beam"
    };

    function performTrick(trick) {
      flourish(TRICK_ART[trick.id] || "is-trick-glow", 1800);
      burst(8);
      say(`${trick.name}. ${name} performs it gladly.`);
    }

    function renderTricks() {
      const tricks = Core.tricksFor({ record: readRecord() || record, companion });
      const taught = new Set(taughtTrickIds(store));
      tricksHost.innerHTML = "";
      for (const trick of tricks) {
        const known = trick.learned || taught.has(trick.id);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "spark-button quiet spark-play-trick";
        if (known) {
          btn.textContent = `${trick.name} — perform`;
          btn.addEventListener("click", () => performTrick(trick));
        } else if (trick.kindTrick) {
          const days = (store.practiseDays[trick.id] || []).length;
          btn.textContent = days > 0
            ? `${trick.name} — practise together (kept on ${days} day${days === 1 ? "" : "s"})`
            : `${trick.name} — practise together`;
          btn.addEventListener("click", () => practiseTrick(trick));
        } else {
          continue;
        }
        tricksHost.appendChild(btn);
      }
      const signature = tricks.find((t) => t.kindTrick);
      if (signature && !signature.learned && !taught.has(signature.id)) {
        trickNote.textContent =
          `${signature.name} is ${name}'s own kind's trick. Practise it together on two ` +
          `different days and it is learned — breadth teaches here, not doing it over in a day.`;
      } else if (signature && taught.has(signature.id) && !signature.learned) {
        trickNote.textContent = `${signature.name} was learned here, together, by practising on different days.`;
      } else {
        trickNote.textContent = "";
      }
    }

    function practiseTrick(trick) {
      /* The Spark shows it slowly; the keeper answers with one
       * tap on the big stage as it lands. The practise counts
       * once for today, however it is enjoyed after. */
      flourish(TRICK_ART[trick.id] || "is-trick-glow", 3200);
      burst(6);
      say(`${name} shows you ${trick.name}, slowly. Tap ${name} as it lands, to answer.`);
      const answer = () => {
        window.clearTimeout(timer);
        if (today == null) {
          say(`That was the shape of it. The day could not be read, so nothing was written — the playing was still the playing.`);
          return;
        }
        const result = recordPractise(store, trick.id, today);
        store = result.store;
        saveStore(window.localStorage, store);
        if (result.learnedNow) {
          burst(14);
          flourish("is-celebrating", 2200);
          say(`${trick.name} — learned. Two different days of practising together, and now it is ${name}'s to perform.`);
        } else if (result.counted) {
          say(`Kept for today. Practise together on another day, and ${trick.name} is learned.`);
        } else {
          say(`Already kept for today — the learning grows on a different day. The playing still counts as playing.`);
        }
        renderTricks();
      };
      const timer = window.setTimeout(() => {
        bigArt.removeEventListener("click", answer);
      }, 6000);
      bigArt.addEventListener("click", answer, { once: true });
    }

    /* ----- answering back: a pet is answered ----- */
    if (bigArt) {
      bigArt.addEventListener("click", () => {
        burst(7);
        flourish(`is-manner-${character.mannerism.id}`, 1600);
        idleReset();
      });
    }

    /* ----- the echo duet ----- */
    const padsHost = mount.querySelector("#spark-play-pads");
    const duetStatus = mount.querySelector("#spark-play-duet-status");
    const duetStart = mount.querySelector("#spark-play-duet-start");
    const STEPS = [0, 3, 5, 7];
    const padEls = [];
    for (let i = 0; i < 4; i++) {
      const pad = document.createElement("button");
      pad.type = "button";
      pad.className = "spark-play-pad";
      pad.setAttribute("aria-label", `Duet stone ${i + 1}`);
      pad.addEventListener("click", () => duetTap(i));
      padsHost.appendChild(pad);
      padEls.push(pad);
    }
    const duet = { sequence: [], heard: 0, playing: false, round: 0 };
    const noteHz = (i) => Math.round(character.baseHz * Math.pow(2, STEPS[i] / 12));

    function lightPad(i, ms = 420) {
      const pad = padEls[i];
      if (!pad) return;
      pad.classList.add("is-lit");
      window.setTimeout(() => pad.classList.remove("is-lit"), ms);
    }

    function playSequence(slower = false) {
      duet.playing = true;
      duet.heard = 0;
      const step = slower ? 760 : 520;
      duet.sequence.forEach((padIdx, n) => {
        window.setTimeout(() => {
          lightPad(padIdx, slower ? 560 : 420);
          playNote(noteHz(padIdx));
          if (n === duet.sequence.length - 1) {
            window.setTimeout(() => { duet.playing = false; }, step);
          }
        }, 350 + n * step);
      });
    }

    function duetRound() {
      const rand = streamFor(companion.seed + ":duet:" + duet.round + ":" + (today || 0));
      const next = Math.floor(rand() * 4);
      duet.sequence.push(next);
      duetStatus.textContent = `${name} sings ${duet.sequence.length} note${duet.sequence.length === 1 ? "" : "s"}. Watch, then echo.`;
      playSequence(false);
    }

    function duetTap(i) {
      if (duet.playing || !duet.sequence.length) return;
      lightPad(i, 300);
      playNote(noteHz(i));
      if (i !== duet.sequence[duet.heard]) {
        duetStatus.textContent = `Not that one — watch ${name} again, slower. Nothing is lost.`;
        playSequence(true);
        return;
      }
      duet.heard += 1;
      if (duet.heard === duet.sequence.length) {
        const length = duet.sequence.length;
        const result = recordDuet(store, length, today);
        store = result.store;
        saveStore(window.localStorage, store);
        if (result.learnedNow) {
          burst(14);
          flourish("is-celebrating", 2200);
          duetStatus.textContent = `The duet is learned — you and ${name} can trade phrases now. Best phrase so far: ${store.duet.best}.`;
        } else {
          duetStatus.textContent = `Echoed whole. ${name} adds one more.`;
        }
        duet.round += 1;
        window.setTimeout(duetRound, 900);
      }
    }

    if (duetStart) {
      duetStart.addEventListener("click", () => {
        duet.sequence = [];
        duet.round = 0;
        duetRound();
        idleReset();
      });
    }
    if (store.duet.learnedDay != null) {
      duetStatus.textContent = `The duet is already learned together. Best phrase so far: ${store.duet.best}. Play again whenever — it is play now, not a lesson.`;
    }

    /* ----- celebrations: real completions only ----- */
    let celebrateGuard = 0;
    function celebrate() {
      const now = Date.now();
      if (now - celebrateGuard < 1600) return;
      celebrateGuard = now;
      burst(16);
      flourish("is-celebrating", 2200);
      say(`That one mattered, and ${name} felt it.`);
    }
    const onRecords = (event) => {
      if (isCelebrationEvent("records-changed", event && event.detail)) celebrate();
    };
    const onWitness = () => {
      if (isCelebrationEvent("witness-saved")) celebrate();
    };
    document.addEventListener("sof:life-atlas-records-changed", onRecords);
    window.addEventListener("sof:life-atlas-records-changed", onRecords);
    document.addEventListener("sof:witness-saved", onWitness);
    window.addEventListener("sof:witness-saved", onWitness);

    /* ----- the greeting: Their Home answers, once a day ----- */
    if (today != null && store.greetedDay !== today && !still) {
      window.setTimeout(() => {
        /* The stage is asked for at the moment of the greeting:
         * the home world may have re-stood its stage since this
         * layer booted, and the shimmer belongs on the stage
         * that stands. */
        const homeStage = document.querySelector("#spark-home-stage");
        if (!homeStage) return;
        homeStage.classList.add("is-greeting");
        window.setTimeout(() => homeStage.classList.remove("is-greeting"), 3400);
        store.greetedDay = today;
        saveStore(window.localStorage, store);
      }, 1200);
    }

    /* ----- phase 2: the harvest card + kind-element noticing -----
     * Both are readings of the kept record — the companion
     * record the layer already holds, and the keeper's Atlas
     * entries, read once, read-only, through the same resolver
     * Their Home uses. Nothing is collected, fetched, or
     * inferred: the card arranges the keeper's own kept days
     * and words back to them, and the noticing speaks only
     * when the record itself holds the Spark's element. */
    function scriptBase() {
      const el = document.querySelector('script[src*="spark-play.js"]');
      if (el && el.src) return el.src.split("spark-play.js")[0];
      return "assets/js/";
    }

    function loadScriptOnce(src) {
      return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    async function phaseTwo() {
      let entries = [];
      try {
        if (!window.CodexRecordHelpers) {
          await loadScriptOnce(`${scriptBase()}life-atlas/record-helpers.js`);
        }
        let repository = null;
        if (window.CodexRecordHelpers) {
          repository = await window.CodexRecordHelpers.createRepositoryResolver()();
        }
        if (!repository && window.CodexLifeAtlasRuntime) {
          repository = await window.CodexLifeAtlasRuntime.ready;
        }
        if (repository) {
          const records = await repository.query({});
          entries = (records || [])
            .map((r) => ({
              patternDay: r && r.temporal ? r.temporal.patternDay : null,
              title: r && r.title ? String(r.title) : ""
            }))
            .filter((e) => Number.isFinite(e.patternDay));
        }
      } catch {
        entries = [];
      }
      const fresh = readRecord() || record;
      const facts = {
        daysSeen: Array.isArray(fresh.daysSeen) ? fresh.daysSeen : [],
        practiceDays: Array.isArray(fresh.practiceDays) ? fresh.practiceDays : [],
        rests: fresh.care && Number.isFinite(fresh.care.rests) ? fresh.care.rests : 0,
        entries
      };

      /* The noticing: one line, only when the record speaks. */
      const noticing = noticingFor(companion.kind, facts);
      const noticingEl = mount.querySelector("#spark-play-noticing");
      if (noticing && noticingEl) {
        if (noticing.via === "words") {
          noticingEl.textContent =
            `${name} notices ${noticing.element} in your keeping: ${noticing.count} kept ` +
            `${noticing.count === 1 ? "entry speaks" : "entries speak"} of it — the latest, ` +
            `Pattern Day ${noticing.latestDay}: “${noticing.latestTitle}”.`;
        } else if (noticing.via === "sealed") {
          noticingEl.textContent =
            `${name} remembers the Bench: ${noticing.count} practice ${noticing.count === 1 ? "day" : "days"} sealed together.`;
        } else if (noticing.via === "rests") {
          noticingEl.textContent =
            `${name} remembers the quiet: you have rested together ${noticing.count} ${noticing.count === 1 ? "time" : "times"}.`;
        }
      }

      /* The harvest card: the latest turned Moon with keeping
       * in it, composed from the facts and kept standing. */
      const harvestHost = mount.querySelector("#spark-play-harvest");
      if (!harvestHost || today == null) return;
      const moon = harvestMoonFor(facts, today);
      if (moon == null) return;
      const card = harvestFor(facts, moon);
      if (!card) return;
      const moonName = (window.PatternCalendarData && window.PatternCalendarData.moons
        && window.PatternCalendarData.moons[moon - 1]
        && window.PatternCalendarData.moons[moon - 1].name) || null;
      const key = `moon-${moon}`;
      const isNew = !Number.isFinite(store.harvestCards[key]);
      const dayList = card.witnessedDays
        .map((d) => `Day ${(moonOfPatternDay(d) || {}).day}`).join(", ");
      const sealedLine = card.sealedDays.length
        ? `<p class="spark-note">Practices sealed: ${card.sealedDays
            .map((d) => `Day ${(moonOfPatternDay(d) || {}).day}`).join(", ")}.</p>`
        : "";
      const wordsLine = card.words.length
        ? `<p class="spark-note">In your own words, kept in it:</p>` +
          `<ul class="spark-play-harvest-words">` +
          card.words.slice(0, 4).map((w) =>
            `<li>Pattern Day ${w.patternDay} — “${w.title.replace(/</g, "&lt;")}”</li>`).join("") +
          `</ul>`
        : "";
      harvestHost.innerHTML =
        `<div class="spark-play-harvest-card">` +
          `<h3 style="margin:14px 0 4px">The Moon's turn — a card from ${name}</h3>` +
          `<p class="spark-note">Moon ${moon}${moonName ? ` · ${moonName}` : ""}, kept together.</p>` +
          `<p class="spark-note">Days witnessed together: ${dayList} — ${card.witnessedDays.length} ` +
          `${card.witnessedDays.length === 1 ? "day" : "days"}.</p>` +
          sealedLine + wordsLine +
          (isNew ? `<p class="spark-note">${name} composed this at the Moon's turn, from the days as they stand in the record — nothing added, nothing dressed up.</p>` : "") +
        `</div>`;
      if (isNew) {
        store.harvestCards[key] = today;
        saveStore(window.localStorage, store);
        burst(10);
      }
    }
    phaseTwo();

    /* ----- idle life ----- */
    let idleTimer = null;
    function idleAct() {
      idleTimer = null;
      if (!document.hidden && !still && bigArt && !section.hidden) {
        flourish(`is-manner-${character.mannerism.id}`, 2600);
        if (character.mannerism.id === "mote-drift" || character.mannerism.id === "mote-juggle") burst(5);
      }
      idleSchedule();
    }
    function idleSchedule() {
      if (still) return;
      idleTimer = window.setTimeout(idleAct, idleDelayMs(character));
    }
    function idleReset() {
      if (idleTimer) window.clearTimeout(idleTimer);
      idleSchedule();
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (idleTimer) window.clearTimeout(idleTimer);
      } else {
        idleReset();
      }
    });
    idleSchedule();

    renderTricks();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  return api;
});
