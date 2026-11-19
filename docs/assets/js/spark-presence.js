"use strict";

/*
 * Spark companion — presence (browser glue).
 *
 * The meeting comes to the visitor. On a first arrival anywhere on
 * the site, the Spark itself pops up, introduces itself by the name
 * its seed grew, and one tap adopts it. "Not now" is remembered on
 * this device: the pop-up goes, and the same Spark waits quietly as
 * a small ember at the page's edge, tappable whenever its person is
 * ready. No form, no quiz stands in front of the meeting.
 *
 * Once adopted, the Spark is a guide as well as a companion, and
 * it is alive on the page: it roams the screen like a small
 * character, plays shy (or bold) of your cursor and finger, idles
 * with a character of its own, and evolves — Ember, Flame,
 * Radiant — as its record of returns grows, celebrating the
 * change with a flourish when it happens. Arriving somewhere new,
 * it names the place and points to a fitting next door, in short
 * lines that never block the page. Its record is kept up to date on this
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

  /* The waiting Spark: a seed kept on the device after the pop-up
   * has been shown once, so "Not now" is remembered and the same
   * Spark — not a new stranger — waits at the edge as an ember. */
  function readPending() {
    try {
      const seed = window.localStorage.getItem(Core.PENDING_KEY);
      return seed && Core.parseSeed(seed) ? seed : null;
    } catch {
      return null;
    }
  }

  function writePending(seed) {
    try {
      window.localStorage.setItem(Core.PENDING_KEY, seed);
    } catch {
      /* the meeting simply comes again next time */
    }
  }

  function clearPending() {
    try {
      window.localStorage.removeItem(Core.PENDING_KEY);
    } catch {
      /* nothing to clear */
    }
  }

  function civilToday() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /* The Spark that would be met today: its kind leaned by the
   * day's own coordinate, the way the companions page leans it
   * before any answers are given. The questions there may flavour
   * a meeting held on that page; they never gate this one. */
  function makePendingSeed(today) {
    const kindIndex = Core.resolveKindIndex({
      moon: today ? today.moon : null,
      patternDay: today ? today.dayOfPatternYear : null,
      answers: []
    });
    return Core.makeSeed({
      moon: today ? today.moon : null,
      patternDay: today ? today.dayOfPatternYear : null,
      kindIndex,
      nonce: Core.randomNonce()
    });
  }

  /* The site's own doors: pages open with a living entry
   * (.le-overlay) or a page opening (.lpo-overlay) first. While
   * either is up it owns the screen — the Spark waits for it to
   * lift before speaking, and a tap spent lifting it is never
   * counted as a tap on the page beneath. */
  const OPENING_SELECTOR = ".le-overlay, .lpo-overlay";
  function openingUp() {
    return !!document.querySelector(OPENING_SELECTOR);
  }

  /* The homepage keeps a fixed path rail along the bottom on
   * small screens. The Spark's furniture — the meeting card, the
   * ember, the walker — lifts clear of it, measured from the rail
   * itself rather than guessed, and only where the rail truly
   * sits at the bottom of the screen. */
  function bottomLift() {
    const rail = document.querySelector(".le-rail");
    if (!rail) return 0;
    const rect = rail.getBoundingClientRect();
    const atBottom = Math.abs(rect.bottom - window.innerHeight) <= 2;
    return atBottom && rect.height > 0 ? Math.ceil(rect.height) + 8 : 0;
  }

  function liftClear(host) {
    const lift = bottomLift();
    if (lift > 0) host.style.bottom = `${12 + lift}px`;
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

  function renderPresence(record, companion, today, arrival, grew) {
    const stage = Core.stageOf(record, companion);
    /* Arriving somewhere new — or just adopted — the Spark speaks
     * as a guide: where you are, and a fitting next door. The rest
     * of the time its standing suggestion, drawn from the record,
     * waits behind a tap. */
    const guide = arrival
      ? Core.arrivalFor({
          record,
          companion,
          todayPatternDay: today ? today.dayOfPatternYear : null,
          page: pageKey()
        })
      : Core.guidanceFor({
          record,
          companion,
          todayPatternDay: today ? today.dayOfPatternYear : null
        });

    const displayName = Core.displayName(record, companion);
    const host = document.createElement("div");
    host.className = "spark-presence";
    const walker = document.createElement("div");
    walker.className = "spark-walker";
    liftClear(walker);
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
    const art = host.querySelector(".spark-presence-art");
    let arrivalTimer = null;
    const closeBubble = () => {
      bubble.setAttribute("hidden", "");
      button.setAttribute("aria-expanded", "false");
      if (arrivalTimer) {
        window.clearTimeout(arrivalTimer);
        arrivalTimer = null;
      }
    };
    button.addEventListener("click", () => {
      chirpFromGesture(companion);
      /* A tap lands as happiness: a small delighted bounce —
       * a bounce-and-spin in its 3D body, where it has one. */
      if (ctrl3d) ctrl3d.delight();
      if (art) {
        art.classList.remove("is-delighted");
        void art.offsetWidth;
        art.classList.add("is-delighted");
        window.setTimeout(() => art.classList.remove("is-delighted"), 700);
      }
      const open = bubble.hasAttribute("hidden");
      if (open) {
        bubble.removeAttribute("hidden");
        button.setAttribute("aria-expanded", "true");
      } else {
        closeBubble();
      }
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
      if (!soundOff()) chirpFromGesture(companion);
    });
    paintSound();
    /* Pointerdown, not click — and a tap on a page's living entry
     * is never counted: that tap lifts the entry's door, and the
     * click that follows it belongs to the same gesture. It must
     * not fold a line the tap never saw. */
    document.addEventListener("pointerdown", (event) => {
      if (event.target && event.target.closest && event.target.closest(OPENING_SELECTOR)) return;
      if (!host.contains(event.target)) closeBubble();
    });
    document.body.appendChild(host);
    /* Its 3D body, grown from the same seed, where WebGL is to
     * be had: the flat drawing steps aside for it. Where it is
     * not, the flat Spark stands as it always did — the mount
     * returns null and nothing here changes. */
    let ctrl3d = null;
    if (window.Spark3D && art) {
      try {
        ctrl3d = window.Spark3D.mount(art, companion, {
          stage: stage.index,
          px: Math.round(46 * (companion.shape ? companion.shape.size : 1))
        });
      } catch {
        ctrl3d = null;
      }
      if (ctrl3d) art.classList.add("has-3d");
    }
    roam(walker, art, companion, {
      isOpen: () => !bubble.hasAttribute("hidden"),
      ctrl: ctrl3d
    });
    /* It grew — on this very visit, from the facts just written
     * down. The moment is small and never blocks the page: a
     * flourish of the body, and its chirp if its voice has been
     * woken by a tap before. The bubble's first line already
     * speaks the new stage's name. */
    if (grew) {
      if (art && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        art.classList.add("is-evolving");
        window.setTimeout(() => art.classList.remove("is-evolving"), 1700);
      }
      if (ctrl3d) ctrl3d.celebrate();
      chirpCelebration(companion);
    }
    /* A guide speaks first on arrival, briefly, then steps back:
     * the line shows itself, and folds away on its own. A tap on
     * the Spark, or anywhere else, folds it sooner. Pages open
     * with a living entry first, though — so while that door is
     * up, the guide waits, and speaks the moment it lifts. */
    if (arrival) {
      const openBubble = () => {
        if (!bubble.hasAttribute("hidden")) return;
        bubble.removeAttribute("hidden");
        button.setAttribute("aria-expanded", "true");
        arrivalTimer = window.setTimeout(closeBubble, 11000);
      };
      let waited = 0;
      const speakWhenClear = () => {
        if (!openingUp()) {
          openBubble();
          return;
        }
        waited += 250;
        if (waited <= 20000) window.setTimeout(speakWhenClear, 250);
      };
      speakWhenClear();
    }
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
  /* Its voice wakes only by touch: a chirp asked for by a tap (or
   * the adoption tap, or the sound switch) arms it for the page.
   * The one moment the Spark ever speaks unasked — the flourish
   * when it evolves — borrows that armed voice, and stays silent
   * on any page where no tap has woken it. Sound rules unchanged:
   * nothing autoplays, the off switch still rules. */
  let voiceArmed = false;
  function chirpFromGesture(companion) {
    voiceArmed = true;
    chirp(companion);
  }
  function chirpCelebration(companion) {
    if (voiceArmed) chirp(companion);
  }
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

  /* The living Spark. It is not pinned to its corner any more:
   * once it has walked in, it roams the whole screen like a small
   * character — along the floor, up the sides, now and then across
   * the open middle — pausing to bob, spin, stretch, or look
   * around, each move shaped by the gait and pace its seed grew.
   * It plays with the pointer, too: a cursor, or a finger coming
   * down near it, makes it scoot away a short hop — and how soon
   * it flees, how far, and how soon it will flee again is its
   * temperament's own. A bold Spark barely budges and sometimes
   * comes closer to look; a quiet one darts early and far. But it
   * never flees the screen, it tires of fleeing and settles where
   * a tap can reach it, and a true tap on it always lands.
   *
   * The fences hold: the strip it travels in takes no clicks, so
   * it never blocks the page — approached, it moves out from
   * under the pointer rather than covering anything. While its
   * guidance bubble is open it holds still. When the tab is
   * hidden it rests. Its loop sleeps while it idles, so a resting
   * Spark costs the page nothing. And a visitor whose device asks
   * for reduced motion gets a Spark that simply appears in its
   * corner and stays there. */
  function roam(walker, art, companion, hooks) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const button = walker.querySelector(".spark-presence-button");
    if (!button) return;
    const gait =
      (companion && companion.shape && companion.shape.gait) || walker.dataset.gait || "stroll";
    const pace = (companion && companion.shape && companion.shape.pace) || 1;
    const temperament = (companion && companion.temperament) || "steady";
    /* Its 3D body, when it has one: the engine speaks, it moves. */
    const ctrl = hooks.ctrl || null;

    /* How it plays is its temperament's own: how close a pointer
     * may come before it scoots (radius), how far the scoot
     * carries, how long before it will scoot again (cooldown),
     * and how often it comes to look instead of fleeing. The
     * last two are its utility curves — how much it loves to
     * wander, and how playful it is — the weights its small
     * brain scores its choices with. Temperament is parameters,
     * never code paths: a bold Spark and a shy one run the same
     * engine on different numbers. */
    const PLAY = {
      bold: { radius: 52, scoot: [36, 64], cooldown: 1400, approach: 0.35, wander: 1.1, playfulness: 0.8 },
      curious: { radius: 84, scoot: [56, 96], cooldown: 1900, approach: 0.4, wander: 1.25, playfulness: 0.9 },
      bright: { radius: 76, scoot: [64, 110], cooldown: 2000, approach: 0.15, wander: 1.0, playfulness: 1.0 },
      gentle: { radius: 88, scoot: [70, 120], cooldown: 2400, approach: 0.1, wander: 0.8, playfulness: 0.6 },
      steady: { radius: 64, scoot: [44, 80], cooldown: 2200, approach: 0.05, wander: 0.7, playfulness: 0.4 },
      quiet: { radius: 118, scoot: [120, 190], cooldown: 3000, approach: 0, wander: 0.6, playfulness: 0.5 }
    };
    const play = PLAY[temperament] || PLAY.steady;
    const SPEED = { stroll: 62, drift: 34, hop: 100 }[gait] || 62;
    /* Its signature idle move leans to its temperament, too. */
    const SIGNATURE = {
      bold: "is-spinning",
      bright: "is-spinning",
      gentle: "is-looking",
      curious: "is-looking",
      steady: "is-stretching",
      quiet: "is-stretching"
    };
    const FLOURISHES = ["is-spinning", "is-stretching", "is-looking"];

    /* Position is an offset from its home corner — x leftward,
     * y upward — clamped inside the screen by the bounds, and
     * never higher than the lower half's reach, so its bubble
     * always has room to open above it. */
    const pos = { x: 0, y: 0 };
    let home = null;
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    function measure() {
      const r = button.getBoundingClientRect();
      home = { cx: r.left + r.width / 2 - pos.x, cy: r.top + r.height / 2 - pos.y };
      minX = -(r.left - pos.x - 10);
      maxX = window.innerWidth - 10 - (r.right - pos.x);
      minY = Math.max(-(r.top - pos.y - 10), -(window.innerHeight * 0.55));
      maxY = window.innerHeight - 10 - (r.bottom - pos.y);
    }
    const clampPos = (p) => ({
      x: Math.max(minX, Math.min(maxX, p.x)),
      y: Math.max(minY, Math.min(maxY, p.y))
    });
    const apply = () => {
      walker.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    };
    const center = () => ({ x: home.cx + pos.x, y: home.cy + pos.y });

    let target = null;
    let state = "enter";
    let rafId = null;
    let lastTs = 0;
    let idleTimer = null;
    let lastDodgeAt = 0;
    let dodgeStreak = 0;
    let lastStreakAt = 0;
    let settleUntil = 0;
    let anticipateUntil = 0;
    let peekWanted = false;
    let activeStreak = 0;
    /* The body moves by steering, not by animation: a velocity,
     * a desired velocity, and a capped force between them — so
     * it accelerates, arcs, and eases to a stop like a creature,
     * and feels the same at any frame rate. */
    const vel = { x: 0, y: 0 };
    /* The pointer is tracked with its velocity, so the Spark can
     * flee from where the pointer WILL be, not only where it is. */
    const pointer = { x: 0, y: 0, vx: 0, vy: 0, seenAt: 0, lastMoveAt: 0 };
    const pointerPredicted = (lead) => ({
      x: pointer.x + pointer.vx * lead,
      y: pointer.y + pointer.vy * lead
    });
    function trackPointer(e) {
      const now = performance.now();
      const dt = Math.max(1, now - (pointer.lastMoveAt || now)) / 1000;
      if (pointer.lastMoveAt) {
        const ivx = (e.clientX - pointer.x) / dt;
        const ivy = (e.clientY - pointer.y) / dt;
        pointer.vx = pointer.vx * 0.6 + ivx * 0.4;
        pointer.vy = pointer.vy * 0.6 + ivy * 0.4;
      }
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.seenAt = now;
      pointer.lastMoveAt = now;
    }

    function wake() {
      if (rafId != null) return;
      lastTs = performance.now();
      rafId = window.requestAnimationFrame(tick);
    }
    function sleep() {
      if (rafId != null) window.cancelAnimationFrame(rafId);
      rafId = null;
    }
    function goIdle(pauseMs) {
      state = "idle";
      if (art) art.classList.remove("is-walking");
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(nextBehavior, pauseMs);
      sleep();
    }
    /* Its small utility brain: at each idle moment it scores the
     * things a Spark can do — wander, come and look, flourish,
     * rest — against the world as it stands (a pointer nearby and
     * holding still invites a look; a long active streak invites
     * rest), weighted by its temperament's curves and a little
     * noise so it never turns mechanical. The dodge is NOT scored
     * here: that is a reflex, and reflexes do not deliberate. */
    function chooseBehavior() {
      const c = center();
      const pointerNear =
        performance.now() - pointer.lastMoveAt < 2500 &&
        Math.hypot(pointer.x - c.x, pointer.y - c.y) < 340;
      const pointerStill = performance.now() - pointer.lastMoveAt > 1100;
      const scores = {
        wander: play.wander,
        approach: pointerNear ? play.approach * 2.4 + (pointerStill ? 0.25 : 0) : play.approach * 0.3,
        flourish: 0.5 * play.playfulness + 0.12,
        rest: 0.22 + activeStreak * 0.2
      };
      let best = "wander";
      let bestScore = -1;
      for (const [name, score] of Object.entries(scores)) {
        const weighted = score * (0.75 + Math.random() * 0.5);
        if (weighted > bestScore) {
          bestScore = weighted;
          best = name;
        }
      }
      return best;
    }
    function nextBehavior() {
      if (document.hidden) {
        idleTimer = window.setTimeout(nextBehavior, 4000);
        return;
      }
      if (hooks.isOpen()) {
        idleTimer = window.setTimeout(nextBehavior, 3000);
        return;
      }
      /* The tease: it dodged you, you held still — stillness is
       * safety — so it peeks back and comes a little closer. */
      if (peekWanted) {
        peekWanted = false;
        const c = center();
        const dx = pointer.x - c.x;
        const dy = pointer.y - c.y;
        const dist = Math.hypot(dx, dy);
        if (dist > play.radius * 1.25) {
          const stepIn = dist - play.radius * 1.2;
          target = clampPos({
            x: pos.x + (dx / dist) * stepIn,
            y: pos.y + (dy / dist) * stepIn
          });
          state = "approach";
          activeStreak += 1;
          wake();
          return;
        }
      }
      const choice = chooseBehavior();
      if (choice === "flourish") {
        flourish();
        activeStreak += 1;
        goIdle((5000 + Math.random() * 9000) / pace);
      } else if (choice === "approach") {
        const c = center();
        const dx = pointer.x - c.x;
        const dy = pointer.y - c.y;
        const dist = Math.hypot(dx, dy) || 1;
        const stepIn = Math.max(24, dist - play.radius * 1.3);
        target = clampPos({
          x: pos.x + (dx / dist) * stepIn,
          y: pos.y + (dy / dist) * stepIn
        });
        state = "approach";
        activeStreak += 1;
        wake();
      } else if (choice === "rest") {
        activeStreak = 0;
        goIdle((14000 + Math.random() * 14000) / pace);
      } else {
        target = pickTarget();
        state = "move";
        activeStreak += 1;
        wake();
      }
    }
    function flourish() {
      if (!art) return;
      const cls =
        Math.random() < 0.6
          ? SIGNATURE[temperament] || "is-looking"
          : FLOURISHES[Math.floor(Math.random() * FLOURISHES.length)];
      art.classList.add(cls);
      if (ctrl) ctrl.flourish(cls);
      window.setTimeout(() => art.classList.remove(cls), 1500);
    }
    function pickTarget() {
      const r = Math.random();
      let fx, fy;
      if (r < 0.55) {
        /* along the floor */
        fx = Math.random();
        fy = Math.random() * 0.22;
      } else if (r < 0.8) {
        /* up one of the sides */
        fx = Math.random() < 0.5 ? Math.random() * 0.18 : 0.82 + Math.random() * 0.18;
        fy = Math.random() * 0.7;
      } else {
        /* across the open middle */
        fx = Math.random();
        fy = 0.3 + Math.random() * 0.55;
      }
      return clampPos({ x: minX + (maxX - minX) * fx, y: maxY + (minY - maxY) * fy });
    }
    function arrive() {
      if (art) art.classList.remove("is-walking");
      if (ctrl) ctrl.setTravel(false, 0);
      vel.x = 0;
      vel.y = 0;
      if (state === "dodge") {
        /* It fled; if the pointer has held still since, the
         * tease is armed — when it next stirs, it peeks back. */
        const c = center();
        peekWanted =
          performance.now() - pointer.lastMoveAt > 900 &&
          Math.hypot(pointer.x - c.x, pointer.y - c.y) < 320 &&
          play.approach > 0;
        goIdle(1100 + Math.random() * 1200);
      }
      else if (state === "approach") {
        flourish();
        goIdle(6000 + Math.random() * 6000);
      } else goIdle((6000 + Math.random() * 10000) / pace);
    }
    function tick(ts) {
      rafId = null;
      const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0);
      lastTs = ts;
      if (state === "idle") return;
      if (state === "hold") {
        if (!hooks.isOpen()) {
          goIdle(2500);
          return;
        }
        rafId = window.requestAnimationFrame(tick);
        return;
      }
      if (hooks.isOpen()) {
        state = "hold";
        rafId = window.requestAnimationFrame(tick);
        return;
      }
      /* Anticipation: the little crouch before the dart. It
       * gathers itself for a breath — about a tenth of a second —
       * then the dart fires. */
      if (state === "anticipate") {
        vel.x *= 0.8;
        vel.y *= 0.8;
        if (ts >= anticipateUntil) {
          state = "dodge";
          if (ctrl) ctrl.dart();
        }
        rafId = window.requestAnimationFrame(tick);
        return;
      }
      /* A resting pointer it is wandering toward still startles
       * it out from under the cursor. */
      if (state === "move" && ts - pointer.seenAt < 3000 && tryPlay(ts)) {
        rafId = window.requestAnimationFrame(tick);
        return;
      }
      if (!target) {
        goIdle(3000);
        return;
      }
      /* Steering: seek the target with a capped force, easing
       * out as it nears (the arrive), so every journey starts
       * with a gather and ends with a settle — never a slide. */
      const dx = target.x - pos.x;
      const dy = target.y - pos.y;
      const dist = Math.hypot(dx, dy);
      const maxSpeed =
        state === "dodge" ? SPEED * 3.4 : state === "enter" ? SPEED * 1.15 : state === "approach" ? SPEED * 0.7 : SPEED;
      const maxForce = state === "dodge" ? 1500 : 280;
      const arriveRadius = state === "dodge" ? 0 : 90;
      const speedNow = dist < arriveRadius ? maxSpeed * Math.max(0.12, dist / arriveRadius) : maxSpeed;
      let sx = (dx / (dist || 1)) * speedNow - vel.x;
      let sy = (dy / (dist || 1)) * speedNow - vel.y;
      const sLen = Math.hypot(sx, sy);
      if (sLen > maxForce) {
        sx = (sx / sLen) * maxForce;
        sy = (sy / sLen) * maxForce;
      }
      vel.x += sx * dt;
      vel.y += sy * dt;
      pos.x += vel.x * dt;
      pos.y += vel.y * dt;
      const clamped = clampPos(pos);
      pos.x = clamped.x;
      pos.y = clamped.y;
      apply();
      const vLen = Math.hypot(vel.x, vel.y);
      if (ctrl) ctrl.setTravel(vLen > 6, vel.x);
      if (art) {
        art.classList.add("is-walking");
        /* It turns to face the way it travels. */
        if (vel.x < -8) art.classList.add("is-flipped");
        else if (vel.x > 8) art.classList.remove("is-flipped");
      }
      if (dist < 5 && vLen < 16) {
        pos.x = target.x;
        pos.y = target.y;
        apply();
        arrive();
        return;
      }
      rafId = window.requestAnimationFrame(tick);
    }
    /* The play itself — a reflex, deliberately not part of the
     * utility brain: deliberation is for idle moments, and a
     * startle is not one. Returns true when it acted. Capped
     * three ways, so it charms and never torments: a cooldown
     * between scoots, no scooting while its bubble is open or
     * while it is still walking in, and after three quick scoots
     * it settles for a while, where a tap can always reach it. */
    function tryPlay(now) {
      if (!home || state === "dodge" || state === "anticipate" || state === "enter" || state === "hold") return false;
      if (hooks.isOpen()) return false;
      if (now < settleUntil || now - lastDodgeAt < play.cooldown) return false;
      const c = center();
      /* Evade is predictive: it flees from where the pointer
       * will be a breath from now, not where it is — a plain
       * flee-from-here reads as a proximity sensor going off;
       * fleeing the pointer's path reads as being alive. */
      const ahead = pointerPredicted(0.28);
      const dx = c.x - ahead.x;
      const dy = c.y - ahead.y;
      const dist = Math.hypot(dx, dy);
      if (dist > play.radius) return false;
      if (Math.random() < play.approach && state === "idle") {
        /* It comes to look instead: a step toward the pointer,
         * stopping politely short of it. */
        const stepIn = dist - play.radius * 0.85;
        if (stepIn < 8) return false;
        const ux = dx / (dist || 1);
        const uy = dy / (dist || 1);
        target = clampPos({ x: pos.x - ux * stepIn, y: pos.y - uy * stepIn });
        state = "approach";
        window.clearTimeout(idleTimer);
        wake();
        return true;
      }
      const away = dist > 1 ? { x: dx / dist, y: dy / dist } : { x: -1, y: 0 };
      const far = play.scoot[0] + Math.random() * (play.scoot[1] - play.scoot[0]);
      target = clampPos({
        x: pos.x + away.x * far,
        y: pos.y + away.y * far * 0.7 - far * 0.18
      });
      /* First the crouch — anticipation — then the dart. */
      state = "anticipate";
      anticipateUntil = now + 110;
      if (ctrl) ctrl.crouch();
      lastDodgeAt = now;
      if (now - lastStreakAt > 6000) dodgeStreak = 0;
      lastStreakAt = now;
      dodgeStreak += 1;
      if (dodgeStreak >= 3) {
        settleUntil = now + 8000;
        dodgeStreak = 0;
      }
      window.clearTimeout(idleTimer);
      wake();
      return true;
    }
    window.addEventListener(
      "pointermove",
      (e) => {
        trackPointer(e);
        /* Near, but not yet startling it: it looks toward you —
         * the gaze lands before the body ever reacts. */
        if (ctrl && home) {
          const c = center();
          const lx = pointer.x - c.x;
          const ly = pointer.y - c.y;
          if (Math.hypot(lx, ly) < play.radius * 2.4) ctrl.lookAt(lx / 140, ly / 140);
        }
        tryPlay(pointer.seenAt);
      },
      { passive: true }
    );
    document.addEventListener(
      "pointerdown",
      (e) => {
        /* A finger has no hover: its approach is its landing.
         * A landing near the Spark startles it the same way —
         * but a landing ON it is a tap, and a tap always lands. */
        if (button.contains(e.target)) return;
        trackPointer(e);
        tryPlay(pointer.seenAt);
      },
      { passive: true }
    );
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        sleep();
        window.clearTimeout(idleTimer);
      } else if (state === "idle") {
        idleTimer = window.setTimeout(nextBehavior, 1200);
      } else {
        wake();
      }
    });
    window.addEventListener("resize", () => {
      measure();
      const c = clampPos(pos);
      pos.x = c.x;
      pos.y = c.y;
      apply();
    });

    /* Walk in from a little way across the floor, then live. */
    measure();
    pos.x = minX * 0.55;
    pos.y = 0;
    apply();
    target = clampPos({ x: minX * 0.1, y: 0 });
    state = "enter";
    window.setTimeout(wake, 500);
  }

  /* The adopted life, on any page: keep the record honest, then
   * walk in — speaking as a guide when this page is new to the
   * record, or when the adoption just happened on this very page. */
  async function adoptedStart(record, companion, today, justAdopted) {
    const patternDay = today ? today.dayOfPatternYear : null;
    const isNewPage = !(record.pagesSeen || []).includes(pageKey());
    /* Evolution is read off the record, before and after this
     * visit's facts land: if the stage rose, this visit is the
     * one that grew it, and the Spark celebrates when it walks in. */
    const stageBefore = Core.stageOf(record, companion).index;
    record = Core.recordVisit(record, { patternDay, page: pageKey() });
    record = await sensePractice(record);
    writeRecord(record);
    const stageAfter = Core.stageOf(record, companion);
    const grew = stageAfter.index > stageBefore ? stageAfter : null;
    /* On its own home page the Spark is already centre stage. */
    if (pageKey() !== "companions.html") {
      renderPresence(record, companion, today, justAdopted || isNewPage, grew);
    }
  }

  /* The pop-up meeting. The Spark itself appears — its drawing,
   * its name, its own short words — with one button that adopts
   * it and one quiet way to say "Not now". Nothing is asked first:
   * no form, no questions. The keeper's own name for it, if they
   * ever want one, waits on the companions page as it always did. */
  function renderEncounter(companion, seed, today) {
    const words = Core.encounterFor({ companion });
    const host = document.createElement("div");
    host.className = "spark-encounter-host";
    host.innerHTML =
      `<div class="spark-encounter" role="dialog" aria-label="Meet your Spark">` +
      `<div class="spark-encounter-art">${Core.renderSVG(companion, { stage: 0 })}</div>` +
      `<div class="spark-encounter-words">` +
      `<p class="spark-encounter-greet"></p>` +
      `<p class="spark-encounter-intro"></p>` +
      `<p class="spark-encounter-born"></p>` +
      `<p class="spark-encounter-invite"></p>` +
      `<div class="spark-encounter-actions">` +
      `<button type="button" class="spark-encounter-adopt"></button>` +
      `<button type="button" class="spark-encounter-later"></button>` +
      `</div></div></div>`;
    host.querySelector(".spark-encounter-greet").textContent = words.greeting;
    host.querySelector(".spark-encounter-intro").textContent = words.intro;
    host.querySelector(".spark-encounter-born").textContent = words.born;
    host.querySelector(".spark-encounter-invite").textContent = words.invite;
    const adopt = host.querySelector(".spark-encounter-adopt");
    adopt.textContent = words.adoptLabel;
    const later = host.querySelector(".spark-encounter-later");
    later.textContent = words.laterLabel;
    /* The meeting shows its 3D body too, where WebGL is to be
     * had — a newborn Ember, turning gently as it introduces
     * itself. Its context is let go when the meeting ends. */
    let ctrl3d = null;
    const teardown = () => {
      if (ctrl3d) ctrl3d.dispose();
      ctrl3d = null;
      host.remove();
    };
    adopt.addEventListener("click", () => {
      const record = Core.newRecord({ seed, name: "", civilDate: civilToday() });
      clearPending();
      writeRecord(record);
      chirpFromGesture(companion);
      teardown();
      adoptedStart(record, companion, today, true);
    });
    later.addEventListener("click", () => {
      teardown();
      renderEmber(companion, seed, today);
    });
    liftClear(host);
    document.body.appendChild(host);
    const artBox = host.querySelector(".spark-encounter-art");
    if (window.Spark3D && artBox) {
      try {
        ctrl3d = window.Spark3D.mount(artBox, companion, { stage: 0, px: 84 });
      } catch {
        ctrl3d = null;
      }
      if (ctrl3d) artBox.classList.add("has-3d");
    }
  }

  /* The ember: after "Not now", the same Spark waits at the edge
   * of the page — a small, quiet light. It does not pop up again
   * on its own. One tap on the ember, whenever its person is
   * ready, brings the meeting back. */
  function renderEmber(companion, seed, today) {
    const host = document.createElement("div");
    host.className = "spark-ember-host";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "spark-ember";
    button.title = "A Spark is waiting";
    button.setAttribute(
      "aria-label",
      `A Spark is waiting to meet you — ${companion.name}. Tap to say hello.`
    );
    button.innerHTML = `<span class="spark-ember-art">${Core.renderSVG(companion, { stage: 0 })}</span>`;
    button.addEventListener("click", () => {
      host.remove();
      renderEncounter(companion, seed, today);
    });
    host.appendChild(button);
    liftClear(host);
    document.body.appendChild(host);
  }

  async function start() {
    const hasCalendar = await ensureCalendar();
    const today = hasCalendar ? todayCoordinate() : null;

    const record = readRecord();
    if (record) {
      const companion = Core.generate(record.seed);
      if (!companion) return;
      await adoptedStart(record, companion, today, false);
      return;
    }

    /* Not adopted yet: the meeting comes to the visitor, wherever
     * they first arrive. A Spark already waiting from an earlier
     * "Not now" does not pop up again — it keeps to its ember. */
    let seed = readPending();
    const hadPending = !!seed;
    if (!seed) {
      seed = makePendingSeed(today);
      writePending(seed);
    }
    const companion = Core.generate(seed);
    if (!companion) return;
    if (hadPending) renderEmber(companion, seed, today);
    else renderEncounter(companion, seed, today);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
