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
 * Once adopted, the Spark is a guide as well as a companion. It
 * draws in the corner of the page, small and quiet, walks with its
 * person page to page, and — arriving somewhere new — names the
 * place and points to a fitting next door, in short lines that
 * never block the page. Its record is kept up to date on this
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

  /* A tap reaction: the wiggle class lands, plays, and is taken
   * back off, so the Spark's ordinary breathing resumes. */
  function react(el) {
    el.classList.remove("is-reacting");
    void el.offsetWidth;
    el.classList.add("is-reacting");
    window.setTimeout(() => el.classList.remove("is-reacting"), 500);
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

  /* The panel's contents, from the core's panel data: both names
   * and which is which, its kind and character, its growth, the
   * days together, and what it has noticed — observed labeled
   * observed, inferred labeled inferred, never merged. Built with
   * text nodes throughout: nothing the record holds is ever
   * treated as markup. */
  function fillPanel(host, record, companion, today) {
    const panel = host.querySelector(".spark-presence-panel");
    if (!panel) return;
    const data = Core.panelFor({ record, companion, today });
    panel.innerHTML = "";
    const row = (label, value) => {
      const p = document.createElement("p");
      p.className = "spark-panel-row";
      const b = document.createElement("strong");
      b.textContent = label;
      p.appendChild(b);
      p.appendChild(document.createTextNode(` ${value}`));
      panel.appendChild(p);
    };
    row("Answers to:", data.name);
    if (data.seedName && data.seedName !== data.name) row("Seed name:", data.seedName);
    row("Kind:", `${data.kindName} — ${data.temperament}, and ${data.trait}`);
    row("Growth:", `${data.stageName} · ${data.points} points`);
    row("Together:", `${data.daysTogether} day${data.daysTogether === 1 ? "" : "s"}`);
    const head = document.createElement("p");
    head.className = "spark-panel-row spark-panel-notices-head";
    head.textContent = "Noticed, on this device:";
    panel.appendChild(head);
    const list = document.createElement("ul");
    list.className = "spark-notices";
    for (const notice of data.notices) {
      const li = document.createElement("li");
      const tag = document.createElement("span");
      tag.className = `spark-notice-kind is-${notice.kind}`;
      tag.textContent = notice.kind === "observed" ? "Observed" : "Inferred";
      li.appendChild(tag);
      li.appendChild(document.createTextNode(" "));
      if (notice.href) {
        const a = document.createElement("a");
        a.href = notice.href;
        a.textContent = notice.text;
        li.appendChild(a);
      } else {
        li.appendChild(document.createTextNode(notice.text));
      }
      list.appendChild(li);
    }
    panel.appendChild(list);
  }

  function renderPresence(record, companion, today, arrival, growthLine) {
    const stage = Core.stageOf(record, companion);
    /* Arriving somewhere new — or just adopted — the Spark speaks
     * as a guide with a memory: today's coordinate first, then the
     * thread it remembers, then a fitting next door. The rest of
     * the time its standing suggestion, drawn from the record,
     * waits behind a tap. */
    const guide = arrival
      ? Core.arrivalGuideFor({ record, companion, today, page: pageKey() })
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
     * moves — and growth you can see, each stage standing a
     * little larger than the last. The walking strip itself stays
     * pointer-events: none; only the button takes taps. */
    if (companion.shape) {
      walker.dataset.gait = companion.shape.gait;
      const grownSize = companion.shape.size * (1 + stage.index * 0.07);
      walker.style.setProperty("--spark-size", String(Math.round(grownSize * 100) / 100));
    }
    host.appendChild(walker);
    walker.innerHTML =
      `<div class="spark-presence-bubble" hidden>` +
      `<p class="spark-presence-line"><strong class="spark-presence-who"></strong> · ${stage.name}</p>` +
      `<p class="spark-presence-today"></p>` +
      `<p class="spark-presence-growth" hidden></p>` +
      `<p class="spark-presence-guide"></p>` +
      `<p class="spark-presence-links"><a class="spark-presence-go" href="#">See it</a> ` +
      `<a class="spark-presence-panel-link" href="#">Your Spark</a> ` +
      `<a class="spark-presence-visit" href="companions.html">Visit</a> ` +
      `<a class="spark-presence-sound" href="#">Sounds: on</a></p>` +
      `<div class="spark-presence-panel" hidden></div></div>` +
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
    host.querySelector(".spark-presence-today").textContent = Core.coordinateLineFor(today);
    host.querySelector(".spark-presence-guide").textContent = guide.text;
    const growthEl = host.querySelector(".spark-presence-growth");
    if (growthLine) {
      growthEl.textContent = growthLine;
      growthEl.removeAttribute("hidden");
    }
    const go = host.querySelector(".spark-presence-go");
    if (guide.href) go.setAttribute("href", guide.href);
    else go.remove();
    fillPanel(host, record, companion, today);

    const button = host.querySelector(".spark-presence-button");
    const bubble = host.querySelector(".spark-presence-bubble");
    let arrivalTimer = null;
    const closeBubble = () => {
      bubble.setAttribute("hidden", "");
      button.setAttribute("aria-expanded", "false");
      if (arrivalTimer) {
        window.clearTimeout(arrivalTimer);
        arrivalTimer = null;
      }
    };
    const art = host.querySelector(".spark-presence-art");
    button.addEventListener("click", () => {
      tapSound(companion);
      /* A tap is answered in body as well as voice: a small
       * bounce of delight, gone as soon as it lands. */
      if (art) react(art);
      const open = bubble.hasAttribute("hidden");
      if (open) {
        bubble.removeAttribute("hidden");
        button.setAttribute("aria-expanded", "true");
      } else {
        closeBubble();
      }
    });
    /* The Your Spark panel: who it is, how it has grown, and what
     * it has noticed — folded inside the bubble, one tap away. */
    const panel = host.querySelector(".spark-presence-panel");
    const panelLink = host.querySelector(".spark-presence-panel-link");
    panelLink.addEventListener("click", (event) => {
      event.preventDefault();
      if (panel.hasAttribute("hidden")) panel.removeAttribute("hidden");
      else panel.setAttribute("hidden", "");
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
    /* Pointerdown, not click — and a tap on a page's living entry
     * is never counted: that tap lifts the entry's door, and the
     * click that follows it belongs to the same gesture. It must
     * not fold a line the tap never saw. */
    document.addEventListener("pointerdown", (event) => {
      if (event.target && event.target.closest && event.target.closest(OPENING_SELECTOR)) return;
      if (!host.contains(event.target)) closeBubble();
    });
    document.body.appendChild(host);
    roam(walker, host.querySelector(".spark-presence-art"));
    /* A guide speaks first on arrival, briefly, then steps back:
     * the line shows itself, and folds away on its own. A growth
     * is spoken the same way, once, when it is new. A tap on
     * the Spark, or anywhere else, folds it sooner. Pages open
     * with a living entry first, though — so while that door is
     * up, the guide waits, and speaks the moment it lifts. */
    if (arrival || growthLine) {
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
  /* A row of soft notes, played in order. Nothing here ever runs
   * on its own — every call site is a tap: the Spark tapped, the
   * adoption tapped, the sounds turned back on. */
  function playNotes(notes, step = 0.14) {
    if (!notes || !notes.length) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = audioCtx || new AC();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const now = audioCtx.currentTime;
      notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = now + i * step;
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

  /* The greeting chirp — the Spark answering a tap. */
  function chirp(companion) {
    if (soundOff()) return;
    const sounds = Core.soundsFor(companion);
    if (sounds) playNotes(sounds.greeting);
  }

  /* The adoption song: a rising arpeggio, played at the moment of
   * the adoption tap itself — that tap is the gesture. */
  function adoptSong(companion) {
    if (soundOff()) return;
    const sounds = Core.soundsFor(companion);
    if (sounds) playNotes(sounds.adopt, 0.11);
  }

  /* The growth chime. A growth is usually noticed on arrival,
   * before any tap — so it is never played uninvited. It waits,
   * and the Spark's first tap of the visit plays it instead of
   * the plain greeting. */
  let growthChimeWaiting = false;
  function tapSound(companion) {
    if (growthChimeWaiting) {
      growthChimeWaiting = false;
      if (!soundOff()) {
        const sounds = Core.soundsFor(companion);
        if (sounds) {
          playNotes(sounds.growth);
          return;
        }
      }
    }
    chirp(companion);
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

  /* The adopted life, on any page: keep the record honest, then
   * walk in — speaking as a guide when this page is new to the
   * record, or when the adoption just happened on this very page.
   * Growth is checked against the stage its person last saw: a
   * new stage is announced once, in words on arrival and in the
   * growth chime at the first tap, and then it is simply how the
   * Spark is. */
  async function adoptedStart(record, companion, today, justAdopted) {
    const patternDay = today ? today.dayOfPatternYear : null;
    const isNewPage = !(record.pagesSeen || []).includes(pageKey());
    record = Core.recordVisit(record, { patternDay, page: pageKey() });
    record = await sensePractice(record);
    const growth = Core.growthEventFor({ record, companion });
    record = Core.markStageSeen(record, growth.stage.index);
    writeRecord(record);
    if (growth.grew) growthChimeWaiting = true;
    /* On its own home page the Spark is already centre stage. */
    if (pageKey() !== "companions.html") {
      renderPresence(
        record,
        companion,
        today,
        justAdopted || isNewPage,
        growth.grew ? Core.growthLineFor({ record, companion, stage: growth.stage }) : null
      );
    }
  }

  /* The pop-up meeting. The Spark itself arrives — flying,
   * hopping or drifting in with the gait its seed grew, drawn so
   * its uniqueness reads at a glance — and speaks in its
   * temperament's voice: its kind, its trait, its seed-born name,
   * the day it was made from. It answers a tap before it is
   * adopted: a chirp and a wiggle. One button adopts it; one
   * quiet way says "Not now". Nothing is asked first: no form,
   * no quiz. The adoption itself is a moment — a bloom of light,
   * its song, its name large — and inside that same moment the
   * keeper may give it a name of their own, or skip and let the
   * seed name be the name it answers to. */
  function renderEncounter(companion, seed, today) {
    const words = Core.encounterFor({ companion });
    const gait = companion.shape ? companion.shape.gait : "stroll";
    const host = document.createElement("div");
    host.className = "spark-encounter-host";
    host.innerHTML =
      `<div class="spark-encounter" role="dialog" aria-label="Meet your Spark" data-gait="${gait}">` +
      `<button type="button" class="spark-encounter-artbtn" aria-label="Say hello to ${companion.name}">` +
      `<span class="spark-encounter-art">${Core.renderSVG(companion, { stage: 0 })}</span></button>` +
      `<div class="spark-encounter-words">` +
      `<p class="spark-encounter-greet"></p>` +
      `<p class="spark-encounter-intro"></p>` +
      `<p class="spark-encounter-voice"></p>` +
      `<p class="spark-encounter-look"></p>` +
      `<p class="spark-encounter-born"></p>` +
      `<p class="spark-encounter-invite"></p>` +
      `<div class="spark-encounter-actions">` +
      `<button type="button" class="spark-encounter-adopt"></button>` +
      `<button type="button" class="spark-encounter-later"></button>` +
      `</div>` +
      `<div class="spark-encounter-celebrate" hidden>` +
      `<p class="spark-encounter-bigname"></p>` +
      `<p class="spark-encounter-seednote"></p>` +
      `<label class="spark-encounter-namelabel" for="spark-encounter-name-input">Name it answers to — optional</label>` +
      `<input type="text" class="spark-encounter-name-input" id="spark-encounter-name-input" maxlength="24" autocomplete="off">` +
      `<div class="spark-encounter-actions">` +
      `<button type="button" class="spark-encounter-name-keep">Keep that name</button>` +
      `<button type="button" class="spark-encounter-name-skip"></button>` +
      `</div></div>` +
      `</div></div>`;
    host.querySelector(".spark-encounter-greet").textContent = words.greeting;
    host.querySelector(".spark-encounter-intro").textContent = words.intro;
    host.querySelector(".spark-encounter-voice").textContent = words.voice;
    host.querySelector(".spark-encounter-look").textContent = words.look;
    host.querySelector(".spark-encounter-born").textContent = words.born;
    host.querySelector(".spark-encounter-invite").textContent = words.invite;
    const card = host.querySelector(".spark-encounter");
    const artBtn = host.querySelector(".spark-encounter-artbtn");
    const art = host.querySelector(".spark-encounter-art");
    /* Before adoption, a tap on the Spark itself is answered:
     * its greeting chirp, and a wiggle of delight. */
    artBtn.addEventListener("click", () => {
      chirp(companion);
      react(art);
    });
    const adopt = host.querySelector(".spark-encounter-adopt");
    adopt.textContent = words.adoptLabel;
    const later = host.querySelector(".spark-encounter-later");
    later.textContent = words.laterLabel;
    adopt.addEventListener("click", () => {
      /* The moment itself: the song, the bloom, the name large —
       * and the one optional question, asked inside the moment,
       * skippable with a single tap. */
      adoptSong(companion);
      card.classList.add("is-celebrating");
      host.querySelector(".spark-encounter-actions").setAttribute("hidden", "");
      host.querySelector(".spark-encounter-invite").setAttribute("hidden", "");
      const celebrate = host.querySelector(".spark-encounter-celebrate");
      celebrate.removeAttribute("hidden");
      host.querySelector(".spark-encounter-bigname").textContent = companion.name;
      host.querySelector(".spark-encounter-seednote").textContent =
        `${companion.name} is the name its seed speaks — its true name, the same anywhere. ` +
        `Give it a name of your own below and it will answer to that, with ${companion.name} underneath.`;
      host.querySelector(".spark-encounter-name-skip").textContent =
        `Skip — keep ${companion.name}`;
      const finish = (keeperName) => {
        const record = Core.newRecord({ seed, name: keeperName, civilDate: civilToday() });
        clearPending();
        writeRecord(record);
        host.remove();
        adoptedStart(record, companion, today, true);
      };
      host
        .querySelector(".spark-encounter-name-keep")
        .addEventListener("click", () =>
          finish(host.querySelector(".spark-encounter-name-input").value)
        );
      host
        .querySelector(".spark-encounter-name-skip")
        .addEventListener("click", () => finish(""));
    });
    later.addEventListener("click", () => {
      host.remove();
      renderEmber(companion, seed, today);
    });
    liftClear(host);
    document.body.appendChild(host);
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
