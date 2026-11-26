/*
 * Spark Echo — the Spark's memory game (Play).
 *
 * The Spark plays a short sequence — lights and tones on a ring of
 * glowing stones — and the visitor plays it back. Each round adds
 * one step. Three modes share one board's heart:
 *
 *   LIGHT & TONE — six jewel stones, each singing one note of a
 *     ladder rooted on 432 Hz, the site's carrier.
 *   WORDS — eight Hebrew words from the word studies, sounded by
 *     the pronunciation engine (pointed text only, its law stands).
 *     A miss opens the word's own card: the teaching hides inside
 *     the game.
 *   TONES — the frequency page's own set, the nine solfeggio tones
 *     with their names from the Frequency Governance presets, each
 *     pad labelled with its exact Hz and played at exactly that Hz.
 *
 * The family face is SPARK! — Wake the World's: bright, lush,
 * colourful, the Spark expressive and reacting, a celebration when
 * a long echo lands. The fences are Aaron's, as everywhere in the
 * Play family: no streaks, no guilt, nothing losable, no leaderboard,
 * no timer pressing an answer. A miss is met kindly — hear the same
 * sequence again, slower, or take a fresh one. The best echo in
 * each mode is kept on this device only, as the visitor's own mark.
 *
 * The daily game is seeded by the Pattern Day, read from the
 * canonical PatternCalendar by the page wiring at the bottom of
 * this file — the same sequence family for everyone that day.
 * Free play is seeded by the keeper's own Spark where one is
 * adopted (its seed, from the companion core), else by a nonce
 * struck on this device. Nothing leaves the device.
 *
 * The engine above the wiring knows nothing of the DOM, the clock,
 * or storage, so the test suite can prove the sequences, the ramp,
 * and the alphabets before any visitor plays.
 */
(() => {
  "use strict";

  /* ---------------- deterministic core ---------------- */

  function hashSeed(text) {
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
    return function next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRng(seedKey) {
    const next = mulberry32(hashSeed(seedKey));
    return {
      next,
      int(n) { return Math.floor(next() * n); },
      pick(list) { return list[Math.floor(next() * list.length)]; }
    };
  }

  /* ---------------- the alphabets ---------------- */

  /* Six stones. Semitones climb a minor pentatonic ladder over
   * 432 Hz — the Scroll carrier the frequency page names its
   * Foundation — so the board itself sings in the site's family. */
  const LIGHT_ROOT_HZ = 432;
  const LIGHT_PADS = [
    { id: "ember", name: "Ember Stone", hue: 8, semis: 0 },
    { id: "amber", name: "Amber Stone", hue: 36, semis: 3 },
    { id: "gold", name: "Gold Stone", hue: 48, semis: 5 },
    { id: "grove", name: "Grove Stone", hue: 132, semis: 7 },
    { id: "tide", name: "Tide Stone", hue: 190, semis: 10 },
    { id: "violet", name: "Violet Stone", hue: 268, semis: 12 }
  ];

  function lightFreq(padIndex) {
    const pad = LIGHT_PADS[padIndex];
    if (!pad) return null;
    return LIGHT_ROOT_HZ * Math.pow(2, pad.semis / 12);
  }

  /* The eight studied words. Pointed text only — the pronunciation
   * engine sounds them, and refuses anything unpointed. The gloss
   * and example lines are the studies' own, shortened, never new
   * doctrine: or (light, Genesis 1:3), shem (name), ruach (wind,
   * breath, spirit, Genesis 1:2), nephesh (life and being),
   * adam (the human), adamah (the ground), enosh (man as mortal),
   * davar (word, thing, matter). */
  const WORD_TILES = [
    { slug: "or", hebrew: "אוֹר", gloss: "light",
      line: "The day-one light: “Let there be light” (Genesis 1:3)." },
    { slug: "shem", hebrew: "שֵׁם", gloss: "name",
      line: "Name and reputation — Babel's made name against Abram's given one." },
    { slug: "ruach", hebrew: "רוּחַ", gloss: "wind, breath, spirit",
      line: "Moving over the waters at the beginning (Genesis 1:2)." },
    { slug: "nephesh", hebrew: "נֶפֶשׁ", gloss: "life, a living being",
      line: "The human becomes a living nephesh (Genesis 2:7) — animals are called it too." },
    { slug: "adam", hebrew: "אָדָם", gloss: "the human, mankind",
      line: "Formed from the ground, named with the ground's own word (Genesis 2:7)." },
    { slug: "adamah", hebrew: "אֲדָמָה", gloss: "the ground, soil",
      line: "The ground-word of the adam cluster — cursed, and lifted, across Genesis." },
    { slug: "enosh", hebrew: "אֱנוֹשׁ", gloss: "man as mortal",
      line: "The frail name for humankind; Enosh is also Seth's son (Genesis 4:26)." },
    { slug: "davar", hebrew: "דָּבָר", gloss: "word, thing, matter",
      line: "A word that is also the thing itself: “the davar of YHWH came” (Genesis 15:1)." }
  ];

  /* The frequency page's set: the nine solfeggio tones, names as
   * the Frequency Governance presets name them. Exact Hz — a pad
   * is played at the number printed on its face, nothing rounded,
   * nothing approximated. */
  const TONE_PADS = [
    { hz: 174, name: "Soft Release" },
    { hz: 285, name: "Repair Field" },
    { hz: 396, name: "Unburden" },
    { hz: 417, name: "Shift Gate" },
    { hz: 528, name: "Restoration" },
    { hz: 639, name: "Heart Link" },
    { hz: 741, name: "Clarity" },
    { hz: 852, name: "Vision" },
    { hz: 963, name: "Crown" }
  ];

  const MODES = ["light", "words", "tones"];

  /* ---------------- the ramp ----------------
   * Difficulty grows from the pattern, never from pressure:
   * sequences lengthen by one each round, the presentation pace
   * quickens gently toward a floor, and later steps widen the
   * alphabet — chord pairs in Tones, a sounded word folded into
   * a Light sequence in free play. The visitor's own pace setting
   * multiplies over the whole ramp, so a gentler setting stays
   * gentler at every round. */
  const MAX_LENGTH = 24;
  const WIDE_FROM = 6; /* step index where chords / mixed steps may appear */

  function lengthForRound(round) {
    return Math.min(MAX_LENGTH, Math.max(1, Math.trunc(round)) + 2);
  }

  const PACE_SETTINGS = { gentle: 1.3, steady: 1.0, swift: 0.78 };

  function paceForRound(round, paceSetting) {
    const mult = PACE_SETTINGS[paceSetting] || PACE_SETTINGS.steady;
    const base = Math.max(340, 640 * Math.pow(0.96, Math.max(0, Math.trunc(round) - 1)));
    return Math.round(base * mult);
  }

  const RAMP_TABLE = [
    { rounds: "1–3", length: "3–5 steps", pace: "full pace", element: "single stones, words, tones" },
    { rounds: "4–6", length: "6–8 steps", pace: "a breath quicker", element: "the alphabet settles in" },
    { rounds: "7+", length: "9 steps and beyond", pace: "toward the floor pace", element: "chord pairs in Tones; a sounded word inside Light (free play)" }
  ];

  /* ---------------- sequences ----------------
   * A sequence is one stream: buildSequence(length) is a prefix of
   * every longer build from the same seed, so a round grows the
   * same sequence by one step — the Spark never swaps the pattern
   * mid-game. A step is { pads: [i] } or { pads: [i, j] } (a chord,
   * Tones only, from step WIDE_FROM), or { word: i } (a sounded
   * word folded into Light, free play only, from step WIDE_FROM). */

  function buildSequence(seedKey, mode, length, freePlay) {
    const rng = makeRng(`${seedKey}|${mode}`);
    const steps = [];
    const want = Math.max(0, Math.trunc(length) || 0);
    for (let i = 0; i < want; i++) {
      if (mode === "words") {
        steps.push({ word: rng.int(WORD_TILES.length) });
        continue;
      }
      if (mode === "tones") {
        const first = rng.int(TONE_PADS.length);
        if (i >= WIDE_FROM && rng.next() < 0.3) {
          let second = rng.int(TONE_PADS.length - 1);
          if (second >= first) second += 1;
          steps.push({ pads: [first, second] });
        } else {
          steps.push({ pads: [first] });
        }
        continue;
      }
      /* light */
      if (freePlay && i >= WIDE_FROM && rng.next() < 0.2) {
        steps.push({ word: rng.int(WORD_TILES.length) });
        continue;
      }
      steps.push({ pads: [rng.int(LIGHT_PADS.length)] });
    }
    return steps;
  }

  function stepLabel(step, mode) {
    if (!step) return "";
    if (typeof step.word === "number") {
      const tile = WORD_TILES[step.word];
      return tile ? tile.hebrew : "";
    }
    if (mode === "tones") return step.pads.map((i) => `${TONE_PADS[i].hz} Hz`).join(" + ");
    return step.pads.map((i) => LIGHT_PADS[i].name).join(" + ");
  }

  const api = {
    constants: { LIGHT_PADS, WORD_TILES, TONE_PADS, MODES, LIGHT_ROOT_HZ, MAX_LENGTH, WIDE_FROM, PACE_SETTINGS, RAMP_TABLE },
    hashSeed, makeRng, lightFreq, lengthForRound, paceForRound, buildSequence, stepLabel
  };

  const root = typeof globalThis !== "undefined" ? globalThis : this;
  root.SparkEcho = api;
  if (typeof module === "object" && module.exports) module.exports = api;

  /* ================= page wiring (browser only) ================= */

  if (typeof document === "undefined" || typeof window === "undefined") return;

  const STORAGE_KEY = "sof.spark-echo.v1";
  const reducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (sel) => document.querySelector(sel);

  function loadRecord() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (parsed && typeof parsed === "object" && parsed.best) return parsed;
    } catch { /* a fresh record is a fine place to start */ }
    return {
      version: 1,
      best: { light: 0, words: 0, tones: 0 },
      settings: { pace: "steady", sound: true, calm: reducedMotion },
      visits: 0
    };
  }

  function saveRecord(record) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(record)); } catch { /* the game still plays */ }
  }

  /* The host: the keeper's own Spark where one is adopted — read
   * through the companion core's own record, never a second one.
   * An unadopted visitor plays with an unclaimed ember. */
  function hostSpark() {
    try {
      const Core = window.SparkCompanion;
      if (!Core) return null;
      const record = JSON.parse(localStorage.getItem(Core.STORAGE_KEY) || "null");
      if (!record || !record.seed || !Core.parseSeed(record.seed)) return null;
      const grown = Core.generate(record.seed);
      if (!grown) return null;
      return {
        seed: record.seed,
        name: record.name || grown.name,
        kindName: grown.kindName,
        temperament: grown.temperament,
        palette: grown.palette,
        hue: grown.hue
      };
    } catch { return null; }
  }

  /* Today's coordinate, read only through the canonical calendar —
   * the same public surface Pattern Breaker uses. */
  function todayContext() {
    const calendar = window.PatternCalendar;
    const data = window.PatternCalendarData;
    if (!calendar || typeof calendar.fromCivilDate !== "function") return null;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    const get = (t) => (parts.find((p) => p.type === t) || {}).value;
    if (!get("year")) return null;
    const iso = `${get("year")}-${get("month")}-${get("day")}`;
    const summary = calendar.fromCivilDate({ date: iso, timeZone, boundaryMode: "midnight" });
    const civil = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
    if (summary.insideCountedYear) {
      return {
        seedBase: `echo:daily:${summary.patternYear}:${summary.dayOfPatternYear}`,
        dayLine: `Moon ${summary.moon} · ${summary.moonName} · Day ${summary.day} · Pattern Day ${summary.dayOfPatternYear}`,
        civilLine: civil
      };
    }
    return {
      seedBase: `echo:daily:${summary.patternYear}:X${summary.intercalaryIndex || 1}`,
      dayLine: `${summary.moonName} · Pattern Year ${summary.patternYear}`,
      civilLine: civil
    };
  }

  /* ---------------- sound ----------------
   * One AudioContext, struck only after the visitor's first tap.
   * Tones are sine oscillators set at the exact stated frequency —
   * the frequency instrument's recipe — with a soft attack so a
   * tone lands as a chime, not a click. */

  let audioCtx = null;
  function ensureAudio() {
    if (audioCtx) {
      if (audioCtx.state === "suspended") audioCtx.resume();
      return audioCtx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC({ latencyHint: "interactive" });
    return audioCtx;
  }

  function playTone(freq, at, dur) {
    const ctx = ensureAudio();
    if (!ctx || !freq) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.22, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  function speakWord(tile) {
    const HP = window.HebrewPronunciation;
    const spoken = HP && tile ? HP.transliterate(tile.hebrew).spoken : null;
    if (!spoken) return null;
    if ("speechSynthesis" in window) {
      try {
        const utter = new SpeechSynthesisUtterance(spoken);
        utter.rate = 0.9;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
      } catch { /* the written form still shows */ }
    }
    return spoken;
  }

  /* ---------------- the game state ---------------- */

  const record = loadRecord();
  record.visits = (record.visits || 0) + 1;
  saveRecord(record);

  const state = {
    mode: "light",
    daily: true,
    round: 1,
    sequence: [],
    pos: 0,
    phase: "idle", /* idle | showing | input | missed | celebrated */
    chordHit: new Set(),
    runSalt: 0,
    presentToken: 0,
    host: null,
    today: null
  };

  function seedKey() {
    if (state.daily && state.today) return `${state.today.seedBase}:r${state.runSalt}`;
    const base = state.host && state.host.seed ? state.host.seed : "unclaimed-ember";
    return `echo:free:${base}:${state.runSalt}`;
  }

  function currentPace(slower) {
    const pace = paceForRound(state.round, record.settings.pace);
    return slower ? Math.round(pace * 1.35) : pace;
  }

  /* ---------------- rendering ---------------- */

  const boardEl = () => $("#se-board");
  const captionEl = () => $("#se-caption");
  const speechEl = () => $("#se-spark-line");

  function setSpeech(line) {
    const el = speechEl();
    if (el) el.textContent = line;
  }

  function setCaption(line) {
    const el = captionEl();
    if (el) el.textContent = line;
  }

  function padElementForStep(step) {
    if (!step) return [];
    if (typeof step.word === "number") {
      const el = boardEl().querySelector(`[data-word="${step.word}"]`);
      return el ? [el] : [];
    }
    return step.pads
      .map((i) => boardEl().querySelector(`[data-pad="${i}"]`))
      .filter(Boolean);
  }

  function renderBoard() {
    const board = boardEl();
    board.innerHTML = "";
    board.dataset.mode = state.mode;
    if (state.mode === "words") {
      WORD_TILES.forEach((tile, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "se-tile se-word-tile";
        btn.dataset.word = String(i);
        btn.style.setProperty("--pad-h", String(42 + i * 38));
        const spoken = window.HebrewPronunciation
          ? window.HebrewPronunciation.transliterate(tile.hebrew).spoken
          : null;
        btn.innerHTML =
          `<span class="se-word-hebrew" lang="he" dir="rtl">${tile.hebrew}</span>` +
          `<span class="se-word-spoken">${spoken || tile.slug}</span>` +
          `<span class="se-word-gloss">${tile.gloss}</span>`;
        btn.setAttribute("aria-label", `${tile.hebrew}, ${tile.gloss}`);
        btn.addEventListener("click", () => onPadTap({ word: i }));
        board.appendChild(btn);
      });
      return;
    }
    const pads = state.mode === "tones" ? TONE_PADS : LIGHT_PADS;
    pads.forEach((pad, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "se-tile se-stone";
      btn.dataset.pad = String(i);
      btn.style.setProperty("--pad-h", String(pad.hue != null ? pad.hue : 20 + i * 34));
      if (state.mode === "tones") {
        btn.innerHTML =
          `<span class="se-stone-hz">${pad.hz}</span>` +
          `<span class="se-stone-unit">Hz</span>` +
          `<span class="se-stone-name">${pad.name}</span>`;
        btn.setAttribute("aria-label", `${pad.hz} hertz, ${pad.name}`);
      } else {
        btn.innerHTML = `<span class="se-stone-name">${pad.name}</span>`;
        btn.setAttribute("aria-label", pad.name);
      }
      btn.addEventListener("click", () => onPadTap({ pads: [i] }));
      board.appendChild(btn);
    });
    if (state.mode === "light") {
      /* From the later rounds a sounded word can fold into a Light
       * sequence (free play) — the word strip stands under the
       * stones so the word has a tile to land on and be echoed by. */
      const strip = document.createElement("div");
      strip.className = "se-word-strip";
      strip.setAttribute("aria-label", "Words that may fold into the sequence");
      WORD_TILES.forEach((tile, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "se-tile se-word-chip";
        btn.dataset.word = String(i);
        btn.style.setProperty("--pad-h", String(42 + i * 38));
        const spoken = window.HebrewPronunciation
          ? window.HebrewPronunciation.transliterate(tile.hebrew).spoken
          : null;
        btn.innerHTML =
          `<span class="se-word-hebrew" lang="he" dir="rtl">${tile.hebrew}</span>` +
          `<span class="se-word-spoken">${spoken || tile.slug}</span>`;
        btn.setAttribute("aria-label", `${tile.hebrew}, ${tile.gloss}`);
        btn.addEventListener("click", () => onPadTap({ word: i }));
        strip.appendChild(btn);
      });
      board.appendChild(strip);
    }
  }

  function renderKeepsake() {
    const el = $("#se-keepsake");
    if (!el) return;
    const b = record.best;
    const parts = [];
    if (b.light) parts.push(`Light & Tone: an echo of ${b.light}`);
    if (b.words) parts.push(`Words: an echo of ${b.words}`);
    if (b.tones) parts.push(`Tones: an echo of ${b.tones}`);
    el.textContent = parts.length
      ? `Your longest echoes, kept on this device — ${parts.join(" · ")}.`
      : "Your longest echoes will be kept here, on this device only.";
  }

  function renderHost() {
    const orb = $("#se-orb");
    const hostLine = $("#se-host-line");
    const host = state.host;
    if (orb) {
      if (host && host.palette) {
        orb.style.setProperty("--orb-body", host.palette.body);
        orb.style.setProperty("--orb-glow", host.palette.glow);
      } else {
        orb.style.setProperty("--orb-body", "hsl(43, 90%, 58%)");
        orb.style.setProperty("--orb-glow", "hsl(43, 95%, 72%)");
      }
    }
    if (hostLine) {
      hostLine.textContent = host
        ? `${host.name}, your ${host.kindName} Spark, keeps the echo.`
        : "An unclaimed ember keeps the echo — play now, and meet your own Spark when you're ready.";
    }
    setSpeech(host
      ? `${host.name} is ${host.temperament} and listening. Tap “The Spark plays”, then play it back.`
      : "Tap “The Spark plays”, watch and listen, then play it back. Miss, and we'll hear it again, slower.");
  }

  /* ---------------- presentation & play ---------------- */

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function lightStep(step, holdMs) {
    const els = padElementForStep(step);
    els.forEach((el) => el.classList.add("is-lit"));
    if (typeof step.word === "number") {
      const tile = WORD_TILES[step.word];
      const spoken = record.settings.sound ? speakWord(tile) : null;
      setCaption(spoken ? `${tile.hebrew} — ${spoken} · ${tile.gloss}` : `${tile.hebrew} · ${tile.gloss}`);
    } else if (state.mode === "tones") {
      setCaption(step.pads.map((i) => `${TONE_PADS[i].hz} Hz · ${TONE_PADS[i].name}`).join("  +  "));
      if (record.settings.sound && audioCtx) {
        const at = audioCtx.currentTime + 0.02;
        step.pads.forEach((i) => playTone(TONE_PADS[i].hz, at, Math.max(0.3, holdMs / 1000)));
      }
    } else {
      setCaption(step.pads.map((i) => LIGHT_PADS[i].name).join("  +  "));
      if (record.settings.sound && audioCtx) {
        const at = audioCtx.currentTime + 0.02;
        step.pads.forEach((i) => playTone(lightFreq(i), at, Math.max(0.3, holdMs / 1000)));
      }
    }
    return wait(holdMs).then(() => els.forEach((el) => el.classList.remove("is-lit")));
  }

  async function presentSequence(slower) {
    const token = ++state.presentToken;
    state.phase = "showing";
    setControlsEnabled(false);
    setSpeech(state.daily
      ? "Watch and listen — this is today's sequence."
      : "Watch and listen…");
    await wait(420);
    const pace = currentPace(slower);
    for (const step of state.sequence) {
      if (token !== state.presentToken) return;
      await lightStep(step, Math.round(pace * 0.72));
      if (token !== state.presentToken) return;
      await wait(Math.round(pace * 0.38));
    }
    if (token !== state.presentToken) return;
    state.pos = 0;
    state.chordHit.clear();
    state.phase = "input";
    setControlsEnabled(true);
    setCaption("Your turn — play it back.");
    setSpeech("Your echo. Take all the time you like.");
  }

  function startRound(newRun) {
    if (newRun) state.round = 1;
    state.sequence = buildSequence(seedKey(), state.mode, lengthForRound(state.round), !state.daily);
    state.pos = 0;
    hideTreatment();
    renderBoard();
    presentSequence(false);
  }

  function stepMatches(step, tap) {
    if (!step) return false;
    if (typeof step.word === "number") return typeof tap.word === "number" && tap.word === step.word;
    if (typeof tap.word === "number") return false;
    return step.pads.length === 1 && tap.pads.length === 1 && step.pads[0] === tap.pads[0];
  }

  function onPadTap(tap) {
    ensureAudio();
    if (state.phase !== "input") {
      /* A tap outside the echo still answers: hear the stone. */
      if (state.phase === "idle" || state.phase === "celebrated" || state.phase === "missed") {
        const preview = typeof tap.word === "number" ? { word: tap.word } : { pads: tap.pads };
        lightStep(preview, 260);
      }
      return;
    }
    const step = state.sequence[state.pos];
    /* A chord step (two tones together, Tones' later rounds) is
     * echoed by tapping both stones, in either order. A stone
     * outside the chord is a miss, like any other wrong tap. */
    if (step && typeof step.word !== "number" && step.pads.length === 2 && typeof tap.word !== "number") {
      const pad = tap.pads[0];
      if (!step.pads.includes(pad)) { missRound(step); return; }
      if (state.chordHit.has(pad)) return;
      state.chordHit.add(pad);
      lightStep({ pads: [pad] }, 240);
      if (state.chordHit.size === 2) {
        state.chordHit.clear();
        state.pos += 1;
        if (state.pos >= state.sequence.length) completeRound();
      }
      return;
    }
    if (stepMatches(step, tap)) {
      lightStep(step, 240);
      state.pos += 1;
      if (state.pos >= state.sequence.length) completeRound();
    } else {
      missRound(step);
    }
  }

  function completeRound() {
    state.phase = "celebrated";
    const length = state.sequence.length;
    if (length > (record.best[state.mode] || 0)) {
      record.best[state.mode] = length;
      saveRecord(record);
      renderKeepsake();
    }
    const orb = $("#se-orb");
    if (orb) {
      orb.classList.remove("is-delighted");
      void orb.offsetWidth;
      orb.classList.add("is-delighted");
    }
    document.querySelector(".se-stage")?.classList.add("is-celebrating");
    setTimeout(() => document.querySelector(".se-stage")?.classList.remove("is-celebrating"), 1600);
    setCaption(`Echoed whole — ${length} ${length === 1 ? "step" : "steps"}.`);
    setSpeech(length >= 9
      ? "A long echo, held whole. Beautifully done."
      : "Held whole. The sequence grows by one…");
    state.round += 1;
    setTimeout(() => { if (state.phase === "celebrated") startRound(false); }, 1500);
  }

  function missRound(expectedStep) {
    state.phase = "missed";
    state.presentToken += 1;
    const name = state.host ? state.host.name : "The ember";
    setCaption("Not quite — and nothing is lost.");
    setSpeech(`${name} kept the sequence safe. Hear it again, slower, or take a fresh one.`);
    if (state.mode === "words" && expectedStep && typeof expectedStep.word === "number") {
      showTreatment(WORD_TILES[expectedStep.word]);
    }
    const miss = $("#se-miss");
    if (miss) miss.hidden = false;
  }

  function showTreatment(tile) {
    const card = $("#se-treatment");
    if (!card || !tile) return;
    const spoken = window.HebrewPronunciation
      ? window.HebrewPronunciation.transliterate(tile.hebrew).spoken
      : null;
    card.innerHTML =
      `<p class="se-treatment-word"><span lang="he" dir="rtl">${tile.hebrew}</span>` +
      (spoken ? ` <span class="se-treatment-spoken">${spoken}</span>` : "") + `</p>` +
      `<p class="se-treatment-gloss">${tile.gloss}</p>` +
      `<p class="se-treatment-line">${tile.line}</p>` +
      `<p class="se-treatment-door"><a href="scripture/word-studies/index.html">Open the word studies</a></p>`;
    card.hidden = false;
  }

  function hideTreatment() {
    const card = $("#se-treatment");
    if (card) card.hidden = true;
    const miss = $("#se-miss");
    if (miss) miss.hidden = true;
  }

  function setControlsEnabled(enabled) {
    document.querySelectorAll(".se-controls button, .se-controls select, #se-play")
      .forEach((el) => { el.disabled = !enabled; });
  }

  /* ---------------- controls ---------------- */

  function bindControls() {
    document.querySelectorAll("[data-se-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.seMode === state.mode) return;
        state.mode = btn.dataset.seMode;
        state.presentToken += 1;
        state.phase = "idle";
        document.querySelectorAll("[data-se-mode]").forEach((b) =>
          b.setAttribute("aria-pressed", String(b === btn)));
        hideTreatment();
        renderBoard();
        setCaption("A new board. Tap “The Spark plays” when you're ready.");
        setSpeech(modeIntro());
      });
    });
    document.querySelectorAll("[data-se-scope]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const daily = btn.dataset.seScope === "daily";
        if (daily === state.daily) return;
        state.daily = daily;
        state.runSalt += 1;
        state.presentToken += 1;
        state.phase = "idle";
        document.querySelectorAll("[data-se-scope]").forEach((b) =>
          b.setAttribute("aria-pressed", String(b === btn)));
        hideTreatment();
        setCaption(daily ? "Today's game — the same sequence family for everyone." : "Free play — sequences of your own, as long as you like.");
      });
    });
    $("#se-play").addEventListener("click", () => {
      ensureAudio();
      hideTreatment();
      startRound(true);
    });
    $("#se-again").addEventListener("click", () => {
      ensureAudio();
      hideTreatment();
      state.phase = "input";
      presentSequence(true);
    });
    $("#se-fresh").addEventListener("click", () => {
      ensureAudio();
      state.runSalt += 1;
      hideTreatment();
      startRound(true);
    });
    const pace = $("#se-pace");
    pace.value = record.settings.pace;
    pace.addEventListener("change", () => {
      record.settings.pace = pace.value;
      saveRecord(record);
    });
    const sound = $("#se-sound");
    sound.checked = record.settings.sound;
    sound.addEventListener("change", () => {
      record.settings.sound = sound.checked;
      saveRecord(record);
      if (!sound.checked && "speechSynthesis" in window) window.speechSynthesis.cancel();
    });
    const calm = $("#se-calm");
    calm.checked = record.settings.calm;
    document.body.classList.toggle("se-calm", record.settings.calm);
    calm.addEventListener("change", () => {
      record.settings.calm = calm.checked;
      saveRecord(record);
      document.body.classList.toggle("se-calm", calm.checked);
    });
  }

  function modeIntro() {
    if (state.mode === "words") return "Words this time — the Spark sounds each word; echo the words back.";
    if (state.mode === "tones") return "Tones this time — each stone is a frequency, played exactly as its face says.";
    return "Light and tone — watch the stones, hear their notes, play them back.";
  }

  /* ---------------- init ---------------- */

  function init() {
    state.host = hostSpark();
    state.today = todayContext();
    const dayline = $("#se-dayline");
    if (dayline) dayline.textContent = state.today ? state.today.dayLine : "The day is being read…";
    const civil = $("#se-civil");
    if (civil && state.today) civil.textContent = state.today.civilLine;
    if (!state.today) state.daily = false;
    document.querySelectorAll("[data-se-scope]").forEach((b) =>
      b.setAttribute("aria-pressed", String((b.dataset.seScope === "daily") === state.daily)));
    renderHost();
    renderBoard();
    renderKeepsake();
    bindControls();
    setCaption("Tap “The Spark plays” to begin.");
    /* A small handle for the test harness — the same surface the
     * page itself plays through. */
    window.SparkEchoGame = {
      state: () => ({
        mode: state.mode, daily: state.daily, round: state.round,
        phase: state.phase, sequence: state.sequence,
        pos: state.pos, best: { ...record.best }
      }),
      start: () => { ensureAudio(); hideTreatment(); startRound(true); },
      replaySlower: () => presentSequence(true),
      tap: (tap) => onPadTap(tap),
      setMode: (mode) => {
        document.querySelector(`[data-se-mode="${mode}"]`)?.click();
      }
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
