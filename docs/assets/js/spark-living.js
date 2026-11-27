"use strict";

/*
 * The Spark, alive in the rooms (Aaron, Nov 26, 2026).
 *
 * The living layer over the presence: small behaviours, each
 * quiet by default, that make the whole site feel kept by a
 * living companion —
 *   · traces: a small mark in a room the keeper has walked
 *     before, that they have been there together;
 *   · a breath: when the keeper returns to a room, or the
 *     light changes, the Spark shifts — it registers the change;
 *   · sound only when it matters: a hum when the Spark crosses
 *     a stage of its long path — silence is the default, so a
 *     tone means something;
 *   · the doorstep: ONE clear invitation at a time, grown from
 *     the keeper's own lean (spark-lean.js) — never a nudge
 *     engine; a tap on "Not now" is remembered for a Moon;
 *   · the films: the Spark hovers over a film even in full
 *     screen, watching alongside — present, quiet, never
 *     blocking the story;
 *   · a glance without words: a small light that drifts toward
 *     a door the keeper has never walked, once, then rests;
 *   · the garden of finds: on the garden page, what keeper and
 *     Spark have found together stands as blooms.
 *
 * Loaded lazily by spark-presence.js so no page pays for it
 * until the companion stands. Nothing here creates, alters, or
 * re-mints a Spark record; the lean is its own small record,
 * readable and resettable by the keeper (SparkLean.reset).
 */
(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const Core = window.SparkCompanion;
  const LeanApi = window.SparkLean;
  if (!Core || !LeanApi) return;

  const SOUND_KEY = "sof.spark.sound";
  const SESSION_CHIP = "sof.spark.living.chip";
  const SESSION_GLANCE = "sof.spark.living.glance";
  const SESSION_ROOM = "sof.spark.living.room";

  function pageName() {
    const p = window.location.pathname.split("/").pop();
    return p && p.endsWith(".html") ? p : "index.html";
  }

  function readRecord() {
    try {
      const raw = window.localStorage.getItem(Core.STORAGE_KEY);
      if (!raw) return null;
      const record = JSON.parse(raw);
      return record && record.seed ? record : null;
    } catch {
      return null;
    }
  }

  function todayCoordinate() {
    if (window.SOFTemporalCursor && typeof window.SOFTemporalCursor.resolvePosition === "function") {
      try {
        const pos = window.SOFTemporalCursor.resolvePosition(new Date());
        if (pos) return pos;
      } catch { /* fall through */ }
    }
    if (window.PatternCalendar) {
      try { return window.PatternCalendar.fromCivilDate({ date: new Date() }); } catch { return null; }
    }
    return null;
  }

  /* ---- the hum: sound only when it matters ---- */
  let audioCtx = null;
  function hum(companion, stage, text) {
    try {
      if (window.localStorage.getItem(SOUND_KEY) === "off") return;
    } catch { /* sound stands */ }
    const plan = Core.phraseFor({ companion, stage, text });
    if (!plan || !plan.notes || !plan.notes.length) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      audioCtx = audioCtx || new AC();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const out = audioCtx.createGain();
      out.gain.value = 0.08; // a breath, not a bell
      out.connect(audioCtx.destination);
      let at = audioCtx.currentTime + 0.05;
      for (const note of plan.notes) {
        const osc = audioCtx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(note.f0, at);
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, note.f0 * (note.glide || 1)), at + note.dur);
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(1, at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, at + note.dur);
        osc.connect(g); g.connect(out);
        osc.start(at); osc.stop(at + note.dur + 0.05);
        at += note.dur + (note.gap || 0);
      }
    } catch { /* the hum rests */ }
  }

  function whenWalker(fn) {
    const existing = document.querySelector(".spark-walker");
    if (existing) { fn(existing); return; }
    const obs = new MutationObserver(() => {
      const el = document.querySelector(".spark-walker");
      if (el) { obs.disconnect(); fn(el); }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => obs.disconnect(), 6000);
  }

  function boot() {
    const lean = LeanApi.createLean(window.localStorage);
    const record = readRecord();
    const page = pageName();
    const today = todayCoordinate();
    const day = today && typeof today.dayOfPatternYear === "number" ? today.dayOfPatternYear : null;
    const hour = new Date().getHours();

    const before = lean.load();
    const walkedBefore = (before.counts["room:" + page] || 0) >= 2;
    lean.note("room", page, { day, hour });

    /* traces in walked rooms */
    if (walkedBefore) {
      const trace = document.createElement("div");
      trace.className = "spark-trace";
      trace.title = "You have walked here together";
      trace.setAttribute("aria-hidden", "true");
      trace.innerHTML = "<span></span><span></span><span></span>";
      document.body.appendChild(trace);
    }

    /* a breath on returning to a room */
    let lastRoom = null;
    try { lastRoom = window.sessionStorage.getItem(SESSION_ROOM); } catch { /* no session */ }
    try { window.sessionStorage.setItem(SESSION_ROOM, page); } catch { /* rests */ }
    if (lastRoom && lastRoom !== page) {
      whenWalker((walker) => {
        walker.classList.add("is-breathing");
        window.setTimeout(() => walker.classList.remove("is-breathing"), 2600);
      });
    }
    /* and a breath when the light itself changes */
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onLight = () => whenWalker((walker) => {
        walker.classList.add("is-breathing");
        window.setTimeout(() => walker.classList.remove("is-breathing"), 2600);
      });
      if (mq.addEventListener) mq.addEventListener("change", onLight);
    }

    if (record) {
      const companion = Core.generate(record.seed);
      if (companion) {
        /* sound only when it matters: a stage of the long path crossed */
        if (Core.pathOf) {
          const path = Core.pathOf(record, companion);
          const grew = lean.pathGrowth(path.index);
          if (grew !== null) {
            const say = () => hum(companion, Core.stageOf(record, companion).index,
              `I grew — ${path.name} now.`);
            window.addEventListener("pointerdown", function once() {
              window.removeEventListener("pointerdown", once);
              say();
            });
            /* If the keeper never touches, the hum simply rests —
             * browsers keep sound behind a gesture anyway. */
          }
        }
        doorstep(lean, record, day);
        glance(lean, page);
      }
    }

    filmWatch(record);
    if (page === "garden.html") gardenOfFinds(record);
  }

  /* ---- the doorstep: one clear invitation ---- */

  /* The answers core, lazy: the doorstep's step is named
   * from the keeper's real state when the core is at hand. */
  function answersReady() {
    if (window.SparkAnswers) return Promise.resolve(true);
    return new Promise((resolve) => {
      const tag = document.querySelector('script[src*="spark-living.js"]');
      const base = tag && tag.src ? tag.src.split("spark-living.js")[0] : "assets/js/";
      const s = document.createElement("script");
      s.src = base + "spark-answers.js?v=20261126-6";
      s.onload = () => resolve(!!window.SparkAnswers);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  /* The state-named step (Aaron, Nov 26, 2026, 19:42):
   * the invitation stops being generic — it names the
   * keeper's actual things: the unwitnessed day by its
   * number and Moon, the room never walked, the card
   * found yesterday. It stands under the lean's own law —
   * the core checks the same refusals and shown marks,
   * with the lean's spans — and the chip's "Not now"
   * refuses its id exactly as it refuses a leaning's. */
  function stateNamedStep(lean, record, day) {
    if (!window.SparkAnswers) return null;
    try {
      const state = lean.load();
      const raw = todayCoordinate();
      const today = raw ? {
        moon: raw.moon,
        day: raw.day,
        dayOfPatternYear: raw.dayOfPatternYear,
        moonName: raw.moonName || null,
        dayName: null,
        dayGloss: null,
        outside: !!(raw.isDayOutOfTime || raw.isDeepTimeDay)
      } : null;
      const list = window.SparkAnswers.ROOM_LABELS.map(([page, label]) => ({
        page, label, visits: state.counts["room:" + page] || 0
      }));
      const world = {
        sparkName: null,
        day,
        today,
        sealedDays: Array.isArray(record.practiceDays) ? record.practiceDays : [],
        cards: null,
        rooms: list.some((r) => r.visits > 0) ? list : null,
        moved: state.moved || null,
        room: null,
        spans: { refusal: LeanApi.REFUSAL_SLEEP_DAYS, rest: LeanApi.OFFER_REST_DAYS }
      };
      return window.SparkAnswers.nextStep(world, state);
    } catch {
      return null;
    }
  }

  function doorstep(lean, record, day) {
    let shown = false;
    try { shown = window.sessionStorage.getItem(SESSION_CHIP) === "1"; } catch { /* rests */ }
    if (shown || day === null) return;
    answersReady().then(() => showDoorstep(lean, record, day));
  }

  function showDoorstep(lean, record, day) {
    let shownNow = false;
    try { shownNow = window.sessionStorage.getItem(SESSION_CHIP) === "1"; } catch { /* rests */ }
    if (shownNow) return;
    const sealedToday = Array.isArray(record.practiceDays) && record.practiceDays.includes(day);
    const offer = stateNamedStep(lean, record, day) ||
      LeanApi.chooseOffer(lean.load(), { day, sealedToday });
    if (!offer) return;
    lean.markShown(offer.id, { day });
    try { window.sessionStorage.setItem(SESSION_CHIP, "1"); } catch { /* rests */ }
    const chip = document.createElement("div");
    chip.className = "spark-doorstep";
    chip.setAttribute("role", "note");
    const dot = document.createElement("span");
    dot.className = "spark-doorstep-dot";
    dot.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.className = "spark-doorstep-text";
    text.textContent = offer.text;
    chip.appendChild(dot);
    chip.appendChild(text);
    if (offer.href) {
      const go = document.createElement("a");
      go.className = "spark-doorstep-go";
      go.href = offer.href;
      go.textContent = offer.label;
      chip.appendChild(go);
    }
    const no = document.createElement("button");
    no.type = "button";
    no.className = "spark-doorstep-no";
    no.textContent = "Not now";
    no.addEventListener("click", () => {
      lean.refuse(offer.id, { day });
      chip.remove();
    });
    chip.appendChild(no);
    document.body.appendChild(chip);
  }

  /* ---- a glance without words ---- */
  function glance(lean, page) {
    if (page !== "index.html") return;
    let done = false;
    try { done = window.sessionStorage.getItem(SESSION_GLANCE) === "1"; } catch { /* rests */ }
    if (done) return;
    const state = lean.load();
    if (state.counts["room:garden.html"]) return; // they know the garden
    const link = document.querySelector('a[href$="garden.html"]');
    if (!link) return;
    try { window.sessionStorage.setItem(SESSION_GLANCE, "1"); } catch { /* rests */ }
    window.setTimeout(() => {
      const mote = document.createElement("div");
      mote.className = "spark-glance";
      mote.setAttribute("aria-hidden", "true");
      document.body.appendChild(mote);
      const r = link.getBoundingClientRect();
      const tx = r.left + r.width / 2 - 5;
      const ty = r.top + r.height / 2 - 5 + window.scrollY;
      mote.style.top = ty + "px";
      mote.style.left = (window.innerWidth - 60) + "px";
      mote.animate(
        [
          { transform: "translate(0, 0)", opacity: 0 },
          { opacity: 0.9, offset: 0.25 },
          { transform: `translate(${tx - (window.innerWidth - 60)}px, 0)`, opacity: 0.9 },
          { transform: `translate(${tx - (window.innerWidth - 60)}px, 0) scale(1.8)`, opacity: 0 }
        ],
        { duration: 3400, easing: "ease-in-out" }
      );
      window.setTimeout(() => mote.remove(), 3500);
    }, 18000);
  }

  /* ---- the films: it watches with you ---- */
  function filmWatch(record) {
    if (!record) return;
    const companion = Core.generate(record.seed);
    if (!companion) return;
    const stage = Core.stageOf(record, companion).index;
    document.addEventListener("fullscreenchange", () => {
      const fs = document.fullscreenElement;
      document.querySelectorAll(".spark-film-watch").forEach((el) => el.remove());
      if (!fs || !fs.querySelector || !fs.querySelector("video")) return;
      const watch = document.createElement("div");
      watch.className = "spark-film-watch";
      watch.setAttribute("aria-hidden", "true");
      watch.title = "Watching with you";
      watch.innerHTML = Core.renderSVG(companion, {
        stage,
        revealed: Core.revealsFor({ record, companion }).revealed,
        wrap: Core.wrapFor(record)
      });
      fs.appendChild(watch);
    });
  }

  /* ---- the garden of finds ---- */
  function hash36(str) {
    let h = 0x811c9dc5;
    const s = String(str);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(36);
  }

  function gardenOfFinds(record) {
    const host = document.querySelector("#garden-living, .garden-living, main");
    if (!host) return;
    let cards = 0;
    const heldMoons = {};
    if (record && record.seed) {
      try {
        const key = "sof.cards.v1.k" + hash36("keeper:" + record.seed);
        const raw = window.localStorage.getItem(key);
        if (raw) {
          const data = JSON.parse(raw);
          if (data && data.copies) {
            Object.values(data.copies).forEach((c) => {
              if (c.state !== "held") return;
              cards++;
              const m = /^moon-(\d{2})$/.exec(c.designId || "");
              if (m) heldMoons[parseInt(m[1], 10)] = true;
            });
          }
        }
      } catch { /* the garden rests */ }
    }
    const sealed = record && Array.isArray(record.practiceDays) ? record.practiceDays.length : 0;
    const blooms = Math.min(cards, 14) + Math.min(sealed, 14);
    const section = document.createElement("section");
    section.className = "spark-finds";
    section.setAttribute("aria-label", "What you have found together");
    let dots = "";
    for (let i = 0; i < blooms; i++) dots += '<span class="spark-finds-bloom" aria-hidden="true"></span>';
    if (!blooms) dots = '<span class="spark-finds-bloom is-seed" aria-hidden="true"></span>';
    section.innerHTML =
      "<h3>What you have found together</h3>" +
      '<div class="spark-finds-row">' + dots + "</div>" +
      "<p>" +
      (blooms
        ? `A bloom for every finding: ${cards} card${cards === 1 ? "" : "s"} in the album, ${sealed} day${sealed === 1 ? "" : "s"} sealed. The garden keeps what the road gives.`
        : "Nothing found together yet — the first bloom comes with the first finding: a card on the road, a day sealed.") +
      "</p>";
    /* The thirteen beds in miniature, day-true: one bed for
     * each Moon, lit where the keeper holds that Moon's card,
     * and today's bed ringed — the same thirteen beds the
     * Atlas keeps below, seen from the Spark's height. */
    const today = todayCoordinate();
    let beds = "";
    for (let m = 1; m <= 13; m++) {
      beds += `<span class="spark-beds-dot${heldMoons[m] ? " is-held" : ""}${today && today.moon === m ? " is-today" : ""}" title="Moon ${m}${heldMoons[m] ? " — its card rests in your album" : ""}${today && today.moon === m ? " — today" : ""}"></span>`;
    }
    const bedsRow = document.createElement("div");
    bedsRow.className = "spark-beds";
    bedsRow.setAttribute("aria-label", "The thirteen beds, by Moon");
    const todayPd = today ? (today.patternDay != null ? today.patternDay : today.dayOfPatternYear) : null;
    bedsRow.innerHTML = beds +
      `<span class="spark-beds-line">${today && today.moon
        ? `Today the garden stands in Moon ${today.moon} · Pattern Day ${todayPd} — its bed is the open one, and the Spark tends it with you.`
        : "The garden keeps Living Time; its beds turn with the Moons."}</span>`;
    section.appendChild(bedsRow);
    host.appendChild(section);
    const walker = document.querySelector(".spark-walker");
    if (walker) walker.classList.add("is-gardening");
  }

  /* Other layers (the match table, the album) may tell the
   * living layer what happened, so the lean stays honest. */
  window.SparkLiving = {
    noteAct(kind, name) {
      const lean = LeanApi.createLean(window.localStorage);
      const today = todayCoordinate();
      lean.note(kind, name, {
        day: today && typeof today.dayOfPatternYear === "number" ? today.dayOfPatternYear : null,
        hour: new Date().getHours()
      });
    },
    noteMoved(moved) {
      const lean = LeanApi.createLean(window.localStorage);
      const today = todayCoordinate();
      lean.noteMoved(moved, {
        day: today && typeof today.dayOfPatternYear === "number" ? today.dayOfPatternYear : null
      });
    },
    humNow(text) {
      const record = readRecord();
      if (!record) return;
      const companion = Core.generate(record.seed);
      if (companion) hum(companion, Core.stageOf(record, companion).index, text || "Here.");
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
