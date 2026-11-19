"use strict";

/*
 * Spark companion — presence (browser glue).
 *
 * If the visitor has adopted a Spark, this draws it in the corner of
 * the page, small and quiet, and keeps its record up to date on this
 * device only: today's visit, the page seen, and — on pages where
 * the Life Atlas is already open (the practice page, the companions
 * page) — the practice days sealed there. Nothing is sent anywhere;
 * the record lives in this browser's local storage.
 *
 * Today's coordinate comes from the canonical PatternCalendar (the
 * same converter the temporal cursor delegates to). If the calendar
 * is not on the page yet, the five calendar files are loaded from
 * the same folder as this script. No protected file is touched.
 */
(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const Core = window.SparkCompanion;
  if (!Core) return;

  const CALENDAR_FILES = [
    "calendar/pattern-calendar-version.js?v=20260722-4",
    "calendar/pattern-calendar-data.js?v=20260722-4",
    "calendar/pattern-calendar-format.js?v=20260722-4",
    "calendar/pattern-calendar-boundary.js?v=20260722-4",
    "calendar/pattern-calendar.js?v=20260722-4"
  ];

  function scriptBase() {
    const el = document.querySelector('script[src*="spark-presence.js"]');
    if (el && el.src) return el.src.split("spark-presence.js")[0];
    return "assets/js/";
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function ensureCalendar() {
    if (window.PatternCalendar) return true;
    const base = scriptBase();
    try {
      for (const file of CALENDAR_FILES) await loadScript(base + file);
    } catch {
      return false;
    }
    return !!window.PatternCalendar;
  }

  function todayCoordinate() {
    if (window.SOFTemporalCursor && typeof window.SOFTemporalCursor.resolvePosition === "function") {
      try {
        const pos = window.SOFTemporalCursor.resolvePosition(new Date());
        if (pos) return pos;
      } catch {
        /* fall through to the calendar itself */
      }
    }
    if (window.PatternCalendar) {
      return window.PatternCalendar.fromCivilDate({ date: new Date() });
    }
    return null;
  }

  function readRecord() {
    try {
      const raw = window.localStorage.getItem(Core.STORAGE_KEY);
      if (!raw) return null;
      const record = JSON.parse(raw);
      if (!record || !Core.parseSeed(record.seed)) return null;
      return record;
    } catch {
      return null;
    }
  }

  function writeRecord(record) {
    try {
      window.localStorage.setItem(Core.STORAGE_KEY, JSON.stringify(record));
    } catch {
      /* storage full or blocked: the Spark simply rests */
    }
  }

  function pageKey() {
    const path = window.location.pathname.replace(/\/+$/, "");
    const last = path.split("/").pop() || "index.html";
    return last === "" ? "index.html" : last;
  }

  /* Practice days, read from the Life Atlas when this page already
   * has it open. The Spark keeps no practice store of its own. */
  async function sensePractice(record) {
    const repo = window.CodexLifeAtlasRepository;
    if (!repo || typeof repo.query !== "function") return record;
    try {
      const sessions = await repo.query({ subtype: "practice-session" });
      let next = record;
      for (const s of Array.isArray(sessions) ? sessions : []) {
        const day = s && s.temporal && s.temporal.patternDay;
        if (Number.isInteger(day) && day >= 1 && day <= 364) {
          next = Core.recordPractice(next, { patternDay: day });
        }
      }
      return next;
    } catch {
      return record;
    }
  }

  function renderPresence(record, companion, today) {
    const stage = Core.stageOf(record, companion);
    const guide = Core.guidanceFor({
      record,
      companion,
      todayPatternDay: today ? today.dayOfPatternYear : null
    });

    const displayName = Core.displayName(record, companion);
    const host = document.createElement("div");
    host.className = "spark-presence";
    const walker = document.createElement("div");
    walker.className = "spark-walker";
    /* Its own shape, from its seed: how big it stands, how it
     * moves. The walking strip itself stays pointer-events: none;
     * only the button takes taps. */
    if (companion.shape) {
      walker.dataset.gait = companion.shape.gait;
      walker.style.setProperty("--spark-size", String(companion.shape.size));
    }
    host.appendChild(walker);
    walker.innerHTML =
      `<div class="spark-presence-bubble" hidden>` +
      `<p class="spark-presence-line"><strong class="spark-presence-who"></strong> · ${stage.name}</p>` +
      `<p class="spark-presence-guide"></p>` +
      `<p class="spark-presence-links"><a class="spark-presence-go" href="#">See it</a> ` +
      `<a class="spark-presence-visit" href="companions.html">Visit</a> ` +
      `<a class="spark-presence-sound" href="#">Sounds: on</a></p></div>` +
      `<button type="button" class="spark-presence-button" aria-expanded="false">` +
      `<span class="spark-presence-art">${Core.renderSVG(companion, { stage: stage.index })}</span>` +
      `<span class="spark-presence-name"></span></button>`;
    host.querySelector(".spark-presence-button").setAttribute(
      "aria-label",
      `Your Spark, ${displayName} — tap for a suggestion`
    );
    host.querySelector(".spark-presence-name").textContent = displayName;
    host.querySelector(".spark-presence-who").textContent = displayName;
    host.querySelector(".spark-presence-visit").textContent = `Visit ${displayName}`;
    host.querySelector(".spark-presence-guide").textContent = guide.text;
    const go = host.querySelector(".spark-presence-go");
    if (guide.href) go.setAttribute("href", guide.href);
    else go.remove();

    const button = host.querySelector(".spark-presence-button");
    const bubble = host.querySelector(".spark-presence-bubble");
    button.addEventListener("click", () => {
      chirp(companion);
      const open = bubble.hasAttribute("hidden");
      if (open) bubble.removeAttribute("hidden");
      else bubble.setAttribute("hidden", "");
      button.setAttribute("aria-expanded", String(open));
    });
    const soundToggle = host.querySelector(".spark-presence-sound");
    const paintSound = () =>
      (soundToggle.textContent = soundOff() ? "Sounds: off" : "Sounds: on");
    soundToggle.addEventListener("click", (event) => {
      event.preventDefault();
      try {
        window.localStorage.setItem(SOUND_KEY, soundOff() ? "on" : "off");
      } catch {
        /* toggle simply does not persist */
      }
      paintSound();
      if (!soundOff()) chirp(companion);
    });
    paintSound();
    document.addEventListener("click", (event) => {
      if (!host.contains(event.target)) {
        bubble.setAttribute("hidden", "");
        button.setAttribute("aria-expanded", "false");
      }
    });
    document.body.appendChild(host);
    roam(walker, host.querySelector(".spark-presence-art"));
  }

  /* The Spark's little voice: two soft notes, pitched by its kind,
   * played only when its person taps it (or turns sounds back on).
   * No audio files, nothing autoplayed, and the off switch is kept
   * on this device like everything else about the Spark. */
  const SOUND_KEY = "sof.spark.sound";
  function soundOff() {
    try {
      return window.localStorage.getItem(SOUND_KEY) === "off";
    } catch {
      return false;
    }
  }

  let audioCtx = null;
  function chirp(companion) {
    if (soundOff()) return;
    const notes = Core.chirpFor(companion);
    if (!notes) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = audioCtx || new AC();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const now = audioCtx.currentTime;
      [notes.first, notes.second].forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = now + i * 0.14;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.12, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + 0.36);
      });
    } catch {
      /* no voice on this device: the Spark stays silent, unbothered */
    }
  }

  /* Roaming: the Spark walks in when a page opens, settles in its
   * corner, and now and then strolls a little way along the bottom
   * of the page and back — the same companion, wandering its site.
   * The strip it walks in takes no clicks, so it never blocks the
   * page. A visitor whose device asks for reduced motion gets a
   * Spark that simply appears in its corner and stays there. */
  function roam(walker, art) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const maxStroll = () => Math.max(60, Math.min(430, window.innerWidth * 0.38));
    /* How it moves is its own, from its seed: a drifter floats, a
     * hopper hurries, a stroller keeps the plain pace. */
    const gait = walker.dataset.gait || "stroll";
    const gaitFactor = gait === "drift" ? 1.9 : gait === "hop" ? 0.65 : 1;
    const gaitEase = gait === "drift" ? "ease-in-out" : "linear";
    const walkTo = (distance, done) => {
      const duration = Math.max(900, Math.min(6800, distance * 9 * gaitFactor));
      walker.style.transition = `transform ${duration}ms ${gaitEase}`;
      walker.style.transform = `translateX(${-distance}px)`;
      if (art) art.classList.add("is-walking");
      window.setTimeout(() => {
        if (art) art.classList.remove("is-walking");
        if (done) done();
      }, duration);
    };
    const stroll = () => {
      const pause = 14000 + Math.random() * 22000;
      window.setTimeout(() => {
        const out = 40 + Math.random() * maxStroll() * 0.55;
        walkTo(out, () => window.setTimeout(() => walkTo(0, stroll), 2600));
      }, pause);
    };
    /* Walk in from a little way across the page, then settle. */
    walker.style.transform = `translateX(${-maxStroll()}px)`;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => walkTo(0, stroll));
    });
  }

  async function start() {
    let record = readRecord();
    if (!record) return; /* not adopted yet: stay invisible */
    const companion = Core.generate(record.seed);
    if (!companion) return;

    const hasCalendar = await ensureCalendar();
    const today = hasCalendar ? todayCoordinate() : null;
    const patternDay = today ? today.dayOfPatternYear : null;

    record = Core.recordVisit(record, { patternDay, page: pageKey() });
    record = await sensePractice(record);
    writeRecord(record);
    /* On its own home page the Spark is already centre stage. */
    if (pageKey() !== "companions.html") renderPresence(record, companion, today);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
