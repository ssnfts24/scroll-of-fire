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
 * walks with its person page to page, roaming the page like a
 * small living thing — wandering, pausing, playing shy or bold
 * by its temperament when a cursor or finger comes close — and,
 * arriving somewhere new, names the place and points to a fitting
 * next door, in short lines that never block the page. Where the
 * device can, it stands in 3D, grown from the same seed. Its
 * record is kept up to date on this
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
    const prog = Core.progressOf(record, companion);
    row(
      "Growth:",
      prog.next
        ? `Stage ${prog.stage.index + 1} of ${Core.STAGES.length}: ${data.stageName} · ${data.points} growth points — ${prog.toGo} to ${prog.next}`
        : `Stage ${prog.stage.index + 1} of ${Core.STAGES.length}: ${data.stageName} · ${data.points} growth points — fully grown`
    );
    row("Together:", `${data.daysTogether} day${data.daysTogether === 1 ? "" : "s"}`);
    if (data.mood) row("Mood:", data.mood.line);
    if (data.play) {
      const bits = [];
      bits.push(
        data.play.tricksKnown > 0
          ? `Tricks known: ${data.play.tricksKnown} of ${data.play.tricksTotal} — ${data.play.trickNames.join(", ")}`
          : "Tricks: play teaches them — petting, being moved by hand, the chase, the echo game"
      );
      if (data.play.bestChase > 0) bits.push(`Best chase: ${data.play.bestChase} catch${data.play.bestChase === 1 ? "" : "es"}`);
      if (data.play.echoBest > 0) bits.push(`Best echo: round ${data.play.echoBest}`);
      if (data.play.pets > 0) bits.push(`Pets given: ${data.play.pets}`);
      row("Play:", bits.join(" · "));
    }
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

  /* The doors this page itself carries, read from the page as it
   * stands: same-site page links, in the order the page offers
   * them, with the words the page itself gives them. The guide
   * offers only doors that are really here. */
  function pageLinks() {
    const out = [];
    const seen = new Set();
    document.querySelectorAll("a[href]").forEach((a) => {
      const raw = a.getAttribute("href") || "";
      if (!raw || raw.startsWith("#") || raw.startsWith("http") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return;
      const href = raw.split("#")[0].split("?")[0];
      const file = href.split("/").pop();
      if (!file.endsWith(".html") || seen.has(file)) return;
      seen.add(file);
      out.push({ href: file, label: (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 48) });
    });
    return out;
  }

  /* This page's own words about itself: its explainer's plain
   * statement where it carries one (the spoken tours state the
   * page in a paragraph), otherwise its own opening — the first
   * heading and the first words under it. Nothing is invented:
   * the guide reads the page, it does not describe it from
   * memory. */
  function pageExplainSource() {
    const ex =
      document.querySelector('section[id$="-explainer"] .section-heading p:not(.eyebrow)') ||
      document.querySelector('[id$="-explainer"] p:not(.eyebrow)');
    if (ex && ex.textContent.trim()) return { explainerText: ex.textContent.trim(), introText: "" };
    const main = document.querySelector("main") || document.body;
    const h = main.querySelector("h1, h2");
    const p = main.querySelector("p");
    const intro = [h ? h.textContent : "", p ? p.textContent : ""].join(" ").trim();
    return { explainerText: "", introText: intro };
  }

  function renderPresence(record, companion, today, arrival, growthLine, grew, store) {
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
      `<div class="spark-convo">` +
      `<div class="spark-convo-thread" aria-live="polite" aria-label="Talking with your Spark"></div>` +
      `<div class="spark-convo-chips" role="group" aria-label="Answers and offers"></div>` +
      `<div class="spark-echo" hidden><p class="spark-echo-status"></p>` +
      `<div class="spark-echo-pads" role="group" aria-label="Echo game colours"></div></div></div>` +
      `<p class="spark-presence-links"><a class="spark-presence-go" href="#">See it</a> ` +
      `<a class="spark-presence-panel-link" href="#">Your Spark</a> ` +
      `<a class="spark-presence-visit" href="companions.html">Visit</a> ` +
      `<a class="spark-presence-sound" href="#">Sounds: on</a> ` +
      `<a class="spark-presence-voice" href="#">Voice: quiet</a></p>` +
      `<div class="spark-presence-panel" hidden></div>` +
      `<div class="spark-presence-care" hidden>` +
      `<p class="spark-panel-row spark-care-head"><strong>Care</strong> <span class="spark-care-sub">— a pet's small life, kept on this device</span></p>` +
      `<div class="spark-care-lines"></div>` +
      `<p class="spark-care-buttons">` +
      `<button type="button" class="spark-care-kindle">Kindle</button> ` +
      `<button type="button" class="spark-care-play">Play</button> ` +
      `<button type="button" class="spark-care-rest">Rest</button></p>` +
      `<div class="spark-trail"></div>` +
      `<p class="spark-share-row"><button type="button" class="spark-share-btn">Share my Spark</button> ` +
      `<span class="spark-share-note">a portrait card, made here on your device — yours to post wherever you choose</span></p></div></div>` +
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

    /* ---- v3: the care life and the real guide ---- */
    const getRecord = () => (store ? store.get() : record);
    /* v6: what just happened, kept only in this page's memory —
     * the fresh facts her mood is derived from. Nothing here is
     * stored; the record keeps the counts, the page keeps the
     * glow of the moment. */
    const recent = { pettedAt: 0, playedAt: 0, learnedAt: 0, wonAt: 0 };
    function refreshMood() {
      const now = Date.now();
      const mood = Core.moodFor({
        record: getRecord(),
        companion,
        todayPatternDay: today ? today.dayOfPatternYear : null,
        hour: new Date().getHours(),
        recent: {
          petted: now - recent.pettedAt < 120000,
          played: now - recent.playedAt < 120000,
          learned: now - recent.learnedAt < 180000,
          won: now - recent.wonAt < 180000
        }
      });
      walker.dataset.mood = mood.id;
      const artEl = host.querySelector(".spark-presence-art");
      if (artEl) {
        artEl.classList.remove("is-mood-proud", "is-mood-bright", "is-mood-sleepy", "is-mood-calm", "is-mood-curious");
        artEl.classList.add(`is-mood-${mood.id}`);
      }
      return mood;
    }
    /* Every write passes through here — care, play, the trail —
     * so a trick learned by any of them is announced exactly
     * once, by this one path: the diff is taken from the counts
     * themselves, the announcement is kept in the record, and
     * no second path can repeat it. */
    const setRecord = (next) => {
      const fresh = Core.learnedBetween({ before: getRecord(), after: next, companion });
      if (fresh.length) next = Core.markTricksKnown(next, fresh);
      if (store) store.set(next);
      writeRecord(next);
      fillPanel(host, getRecord(), companion, today);
      fillCare();
      refreshMood();
      if (fresh.length) announceLearned(fresh);
    };
    const careBox = host.querySelector(".spark-presence-care");
    const careLines = host.querySelector(".spark-care-lines");
    const trailBox = host.querySelector(".spark-trail");
    function fillCare() {
      const current = getRecord();
      const care = Core.careStateFor({
        record: current,
        companion,
        todayPatternDay: today ? today.dayOfPatternYear : null
      });
      careLines.innerHTML = "";
      for (const line of care.lines) {
        const p = document.createElement("p");
        p.className = "spark-panel-row spark-care-line";
        p.textContent = line;
        careLines.appendChild(p);
      }
      trailBox.innerHTML = "";
      const trail = Core.trailFor({ record: current, companion, today, page: pageKey() });
      if (trail.steps.length) {
        const head = document.createElement("p");
        head.className = "spark-panel-row spark-trail-head";
        head.innerHTML = "";
        const b = document.createElement("strong");
        b.textContent = "Today's trail";
        head.appendChild(b);
        head.appendChild(
          document.createTextNode(
            trail.complete ? " — walked, all of it. Well done, both of you." : " — small steps, offered, never owed."
          )
        );
        trailBox.appendChild(head);
        const list = document.createElement("ul");
        list.className = "spark-trail-steps";
        for (const step of trail.steps) {
          const li = document.createElement("li");
          li.className = step.done ? "is-done" : "";
          const mark = document.createElement("span");
          mark.className = "spark-trail-mark";
          mark.textContent = step.done ? "●" : "○";
          li.appendChild(mark);
          li.appendChild(document.createTextNode(" "));
          const a = document.createElement("a");
          a.href = step.href;
          a.textContent = step.label;
          li.appendChild(a);
          list.appendChild(li);
        }
        trailBox.appendChild(list);
      }
    }
    fillCare();

    /* ---- the conversation ----
     * A tap on the Spark opens a talk, not a dashboard. She
     * speaks first — a greeting in her temperament's voice, the
     * real day from the canonical calendar, and the thread the
     * record holds — then she asks a question, and the keeper
     * answers with a tap on a chip. Every answer she gives is
     * assembled from the record and the page: the day's
     * coordinate, the doors this page carries, the page's own
     * words about itself, the trail, the care life. Her voice
     * frames those facts (Core.convoLineFor); it never invents
     * beyond them. The chips are the buttons, made thumb-sized;
     * every chip makes her answer in body, voice, and words at
     * once — a look, then the delight bounce, her little sound,
     * and a line in the thread. */
    const thread = host.querySelector(".spark-convo-thread");
    const chipsBox = host.querySelector(".spark-convo-chips");
    function trimThread() {
      while (thread.children.length > 9) thread.removeChild(thread.firstChild);
      thread.scrollTop = thread.scrollHeight;
    }
    /* ---- her voice box ----
     * Her voice is her own: grown from her seed, not borrowed
     * from the device. Until v6 she spoke through the device's
     * speech synthesis — a generic robot, the same for every
     * Spark — and Aaron named it: too robot-like. The robot is
     * gone, removed whole. What stands here is a small formant
     * voice the seed composes (Core.voiceBoxFor: her fundamental,
     * her vocal tract's size, her breathiness, her temperament's
     * tempo) and a plan for each line (Core.vocalPlanFor: its
     * syllables, mouth shapes, and pitch contour — rising for a
     * question, settling at a sentence's end), sung with
     * WebAudio: a glottal pulse through her formant filters,
     * breath under the tone, a consonant tick where one falls.
     * Her words stand in text, whole; the voice box is her sound
     * over them, the way a game companion vocalizes.
     * The fences are the ones her voice has always kept: the
     * Voice switch rests quiet until the keeper turns it on
     * (kept on this device), the talk is armed by a tap on her
     * furniture so a line she opens by herself is never sounded
     * uninvited, she sounds her own lines only — never the
     * keeper's echoed answers — each new line stills the one
     * before it, closing the talk stills her, and the Sounds
     * switch silences her along with the chirps. No samples, no
     * network, nothing recorded, nothing sent anywhere. */
    let voiceArmed = false;
    let voiceRun = 0;
    let voiceMaster = null;
    const voiceSources = new Set();
    let voiceNoise = null;
    function voiceNoiseBuffer(ctx) {
      if (!voiceNoise) {
        voiceNoise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = voiceNoise.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      }
      return voiceNoise;
    }
    function stopVoice() {
      voiceRun += 1;
      for (const src of voiceSources) {
        try {
          src.stop();
        } catch {
          /* already still */
        }
      }
      voiceSources.clear();
      if (voiceMaster) {
        try {
          voiceMaster.disconnect();
        } catch {
          /* already gone */
        }
        voiceMaster = null;
      }
    }
    /* One syllable of her voice: a sawtooth's pulse-train buzz
     * through a lowpass throat, shaped by her three formant
     * peaks for this syllable's vowel, with her breath riding
     * under it and a consonant tick at its head where the plan
     * marks one. A handful of nodes, all stopped when spent. */
    function singSyllable(ctx, out, box, syl, at) {
      const dur = syl.dur;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(syl.f0 * 1.05, at);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, syl.f0 * 0.95), at + dur);
      const throat = ctx.createBiquadFilter();
      throat.type = "lowpass";
      throat.frequency.value = 1100;
      throat.Q.value = 0.4;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.15, at + Math.min(0.03, dur * 0.3));
      gain.gain.setValueAtTime(0.15, at + Math.max(0.03, dur - 0.035));
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(throat);
      let node = throat;
      for (const f of syl.formants) {
        const peak = ctx.createBiquadFilter();
        peak.type = "peaking";
        peak.frequency.value = f;
        peak.Q.value = 4.5;
        peak.gain.value = 7;
        node.connect(peak);
        node = peak;
      }
      node.connect(gain);
      gain.connect(out);
      osc.start(at);
      osc.stop(at + dur + 0.05);
      voiceSources.add(osc);
      osc.onended = () => voiceSources.delete(osc);
      if (box.breathiness > 0.03) {
        const noise = ctx.createBufferSource();
        noise.buffer = voiceNoiseBuffer(ctx);
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = syl.formants[1] || 1200;
        bp.Q.value = 0.8;
        const ng = ctx.createGain();
        const level = 0.055 * box.breathiness;
        ng.gain.setValueAtTime(0.0001, at);
        ng.gain.exponentialRampToValueAtTime(level, at + 0.03);
        ng.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        noise.connect(bp);
        bp.connect(ng);
        ng.connect(out);
        noise.start(at, Math.random() * 0.4);
        noise.stop(at + dur + 0.02);
        voiceSources.add(noise);
        noise.onended = () => voiceSources.delete(noise);
      }
      if (syl.onset !== "soft") {
        const tick = ctx.createBufferSource();
        tick.buffer = voiceNoiseBuffer(ctx);
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = syl.onset === "fricative" ? 2600 : 1800;
        const tg = ctx.createGain();
        const td = syl.onset === "fricative" ? Math.min(0.07, dur * 0.5) : 0.025;
        tg.gain.setValueAtTime(0.0001, at);
        tg.gain.exponentialRampToValueAtTime(syl.onset === "fricative" ? 0.05 : 0.09, at + 0.008);
        tg.gain.exponentialRampToValueAtTime(0.0001, at + td);
        tick.connect(hp);
        hp.connect(tg);
        tg.connect(out);
        tick.start(at, Math.random() * 0.4);
        tick.stop(at + td + 0.02);
        voiceSources.add(tick);
        tick.onended = () => voiceSources.delete(tick);
      }
    }
    function vocalize(text) {
      if (!voiceArmed || !voiceOn() || soundOff()) return;
      const plan = Core.vocalPlanFor({ companion, text });
      if (!plan || !plan.box || !plan.syllables.length) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtx = audioCtx || new AC();
        if (audioCtx.state === "suspended") audioCtx.resume();
        stopVoice();
        const run = voiceRun;
        const ctx = audioCtx;
        voiceMaster = ctx.createGain();
        voiceMaster.gain.value = 0.9;
        voiceMaster.connect(ctx.destination);
        const out = voiceMaster;
        let at = ctx.currentTime + 0.03;
        for (const syl of plan.syllables) {
          singSyllable(ctx, out, plan.box, syl, at);
          at += syl.dur + syl.gap;
        }
        const totalMs = (at - ctx.currentTime + 0.3) * 1000;
        window.setTimeout(() => {
          if (run === voiceRun && voiceMaster === out) {
            try {
              out.disconnect();
            } catch {
              /* already gone */
            }
            voiceMaster = null;
          }
        }, totalMs);
      } catch {
        /* no voice box on this device: the words still stand */
      }
    }
    function say(text) {
      if (!text) return;
      const p = document.createElement("p");
      p.className = "spark-convo-line";
      const b = document.createElement("strong");
      b.textContent = displayName;
      p.appendChild(b);
      p.appendChild(document.createTextNode(` ${text}`));
      thread.appendChild(p);
      trimThread();
      vocalize(text);
    }
    function sayList(build) {
      const box = document.createElement("div");
      box.className = "spark-convo-line spark-convo-list";
      build(box);
      thread.appendChild(box);
      trimThread();
    }
    function sayDoor(text, href, hrefLabel) {
      vocalize(text);
      sayList((box) => {
        const p = document.createElement("p");
        p.className = "spark-guide-text";
        p.textContent = text;
        box.appendChild(p);
        if (href) {
          const a = document.createElement("a");
          a.className = "spark-guide-door";
          a.href = href;
          a.textContent = hrefLabel || "Go there";
          box.appendChild(a);
        }
      });
    }
    function replyEcho(label) {
      const p = document.createElement("p");
      p.className = "spark-convo-reply";
      p.textContent = label;
      thread.appendChild(p);
      trimThread();
    }
    /* Every tap answered in the body first: the eyes land —
     * a glance toward the keeper — then the body answers with
     * its bounce, and her voice answers with it. One helper, so
     * no control in the talk is ever a dead tap. */
    function answerInBody(withVoice = true) {
      if (art) {
        art.classList.add("is-looking");
        window.setTimeout(() => {
          art.classList.remove("is-looking");
          react(art);
        }, 100);
      }
      if (ctrl) {
        if (ctrl.lookAt) ctrl.lookAt(0.5, 0.15);
        if (ctrl.delight) ctrl.delight();
      }
      if (withVoice) chirp(companion);
    }
    function setChips(list) {
      chipsBox.innerHTML = "";
      for (const c of list) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = c.cls ? `spark-chip ${c.cls}` : "spark-chip";
        b.textContent = c.label;
        b.addEventListener("click", () => {
          /* The keeper has taken the talk: the arrival timer
           * that would fold her opening line away must never
           * fold a conversation mid-sentence. */
          if (arrivalTimer) {
            window.clearTimeout(arrivalTimer);
            arrivalTimer = null;
          }
          replyEcho(c.label);
          c.go();
        });
        chipsBox.appendChild(b);
      }
    }
    const chip = (label, go, cls) => ({ label, go, cls });
    function afterTalk() {
      endEcho();
      say(Core.convoLineFor({ companion, beat: "next" }));
      setChips(mainChips());
    }
    function mainChips() {
      return [
        chip("Show me around", doAround, "spark-guide-around"),
        chip("Explain this page", doExplain, "spark-guide-explain"),
        chip("Let's play", doPlay),
        chip("Care", offerCare),
        chip("Tricks", doTricks),
        chip("Today's trail", doTrail),
        chip("More", moreChips)
      ];
    }
    function moreChips() {
      answerInBody(false);
      setChips([
        chip("Today", doToday, "spark-guide-today"),
        chip("Echo game", doEcho, "spark-guide-echo"),
        chip("Where was I?", doResume, "spark-guide-resume"),
        chip("Share my Spark", doShare),
        chip("My record", doRecord),
        chip("Just walk with me", doBye),
        chip("Back", () => {
          say(Core.convoLineFor({ companion, beat: "ask" }));
          setChips(mainChips());
        })
      ]);
    }
    function offerCare() {
      answerInBody();
      say(Core.convoLineFor({ companion, beat: "care" }));
      setChips([
        chip("Kindle", doKindle, "spark-care-kindle"),
        chip("Play", doPlay, "spark-care-play"),
        chip("Rest", doRest, "spark-care-rest"),
        chip("Back", () => {
          say(Core.convoLineFor({ companion, beat: "ask" }));
          setChips(mainChips());
        })
      ]);
    }

    /* ---- v6: tricks, learned from real play ----
     * A trick is performed in the body first — a class on the
     * drawing, a move in the 3D body — and named aloud in the
     * talk: she says its name, then her line about it. Under
     * reduced motion the drawing holds still, as the device
     * asks, and the name and the line carry the performance —
     * the same honesty the chase has always kept. */
    const TRICK_ART = {
      spin: "is-spinning",
      leap: "is-leaping",
      glow: "is-pulsing",
      flare: "is-trick-flare",
      ripple: "is-trick-ripple",
      vanish: "is-trick-vanish",
      loop: "is-trick-loop",
      root: "is-trick-root",
      beam: "is-trick-beam"
    };
    function trickBody(trick) {
      const cls = TRICK_ART[trick.id];
      if (art && cls) {
        art.classList.remove(cls);
        void art.offsetWidth;
        art.classList.add(cls);
        window.setTimeout(() => art.classList.remove(cls), 1500);
      }
      if (ctrl) {
        if (trick.id === "spin") ctrl.flourish("is-spinning");
        else if (trick.id === "leap") ctrl.delight();
        else if (trick.id === "glow" || trick.id === "ripple") ctrl.flourish("is-stretching");
        else if (trick.id === "flare" || trick.id === "beam") ctrl.celebrate();
        else if (trick.id === "loop") ctrl.dart();
        else if (trick.id === "root") ctrl.crouch();
        else if (trick.id === "vanish") ctrl.lookAt(0.9, 0);
      }
    }
    function performTrick(trick) {
      answerInBody(false);
      say(`${trick.name}!`);
      trickBody(trick);
      const sounds = Core.soundsFor(companion);
      if (sounds && !soundOff()) playNotes(trick.id === "spin" ? sounds.adopt : sounds.growth, 0.1);
      say(Core.convoLineFor({ companion, beat: "trick" }));
    }
    /* A trick learned, announced once, at the moment it lands:
     * her learned line, then the trick itself, performed on the
     * spot. If the talk is folded, she opens it briefly — the
     * way she announces a growth — says it, and steps back. */
    function announceLearned(ids) {
      const tricks = Core.tricksFor({ record: getRecord(), companion });
      ids.forEach((id, i) => {
        const trick = tricks.find((t) => t.id === id);
        if (!trick) return;
        window.setTimeout(() => {
          recent.learnedAt = Date.now();
          refreshMood();
          if (!bubble.hasAttribute("hidden")) {
            say(Core.convoLineFor({ companion, beat: "learned" }));
            performTrick(trick);
          } else {
            announceLine(`${Core.convoLineFor({ companion, beat: "learned" })} ${trick.name}!`);
            trickBody(trick);
            if (ctrl) ctrl.celebrate();
          }
        }, i * 1700);
      });
    }
    /* One line, spoken from a folded talk: the bubble opens
     * with just that line and the standing offers, and folds
     * again on its own — the arrival pattern, reused for the
     * moments worth announcing (a trick learned, a seal kept).
     * A keeper's tap takes the talk over, as always. */
    function announceLine(text) {
      if (!bubble.hasAttribute("hidden")) {
        say(text);
        return;
      }
      convoStarted = true;
      bubble.removeAttribute("hidden");
      button.setAttribute("aria-expanded", "true");
      say(text);
      setChips(mainChips());
      if (arrivalTimer) window.clearTimeout(arrivalTimer);
      arrivalTimer = window.setTimeout(closeBubble, 8000);
    }
    function doTricks() {
      answerInBody();
      endEcho();
      say(Core.convoLineFor({ companion, beat: "tricks" }));
      const tricks = Core.tricksFor({ record: getRecord(), companion });
      const known = tricks.filter((t) => t.learned);
      const learning = tricks.filter((t) => !t.learned);
      if (learning.length) {
        sayList((box) => {
          const list = document.createElement("ul");
          list.className = "spark-guide-doors spark-trick-list";
          for (const t of learning) {
            const li = document.createElement("li");
            li.textContent = `${t.name} — learned from ${t.teacher}: ${t.count} of ${t.need} so far.`;
            list.appendChild(li);
          }
          box.appendChild(list);
        });
      }
      if (!known.length) {
        say("Play teaches me — pet me, move me by hand, chase me, echo me — and this list grows.");
      }
      setChips([
        ...known.map((t) => chip(t.name, () => performTrick(t), "spark-trick-chip")),
        chip("Back", () => {
          say(Core.convoLineFor({ companion, beat: "ask" }));
          setChips(mainChips());
        })
      ]);
    }

    /* ---- v6: the echo game ----
     * She pulses a pattern — her seed's notes, in her own four
     * colours — and the keeper taps it back. Rounds grow one
     * note at a time; the best round is kept on this device and
     * stands in her record. A note astray ends the round kindly:
     * the best stands, the pattern offers to sing again, and
     * nothing anywhere is taken away. */
    const echoBox = host.querySelector(".spark-echo");
    const echoStatus = host.querySelector(".spark-echo-status");
    const echoPadsBox = host.querySelector(".spark-echo-pads");
    let echo = null;
    function playTone(freq) {
      if (soundOff()) return;
      playNotes([freq], 0);
    }
    function buildEchoPads(pads) {
      echoPadsBox.innerHTML = "";
      pads.forEach((pad, i) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "spark-echo-pad";
        b.style.setProperty("--echo-pad", pad.color);
        b.setAttribute("aria-label", `Echo colour ${i + 1}`);
        b.addEventListener("click", () => echoTap(i));
        echoPadsBox.appendChild(b);
      });
    }
    function lightPad(i, ms = 420) {
      const el = echoPadsBox.children[i];
      if (!el) return;
      el.classList.add("is-lit");
      window.setTimeout(() => el.classList.remove("is-lit"), ms);
    }
    function doEcho() {
      answerInBody();
      say(Core.convoLineFor({ companion, beat: "echoStart" }));
      const first = Core.echoFor({ companion, round: 1 });
      buildEchoPads(first.pads);
      echoBox.removeAttribute("hidden");
      echoStatus.textContent = "Tap Begin, and I will pulse the pattern. Then tap it back to me, colour for colour.";
      echo = { round: 1, steps: [], at: 0, phase: "ready", pads: first.pads };
      setChips([
        chip("Begin", beginEchoRound, "spark-echo-begin"),
        chip("Back", () => {
          endEcho();
          say(Core.convoLineFor({ companion, beat: "ask" }));
          setChips(mainChips());
        })
      ]);
    }
    function beginEchoRound() {
      if (!echo) return;
      const data = Core.echoFor({ companion, round: echo.round });
      echo.steps = data.steps;
      echo.at = 0;
      echo.phase = "showing";
      echoStatus.textContent = `Round ${echo.round} — watch and listen.`;
      setChips([]);
      data.steps.forEach((padIx, i) => {
        window.setTimeout(() => {
          if (!echo) return;
          lightPad(padIx);
          playTone(data.pads[padIx].note);
        }, 450 + i * 640);
      });
      window.setTimeout(() => {
        if (!echo || echo.phase !== "showing") return;
        echo.phase = "answer";
        echoStatus.textContent = "Your turn — tap the colours back to me.";
      }, 450 + data.steps.length * 640 + 250);
    }
    function echoTap(i) {
      if (!echo || echo.phase !== "answer") return;
      lightPad(i, 300);
      playTone(echo.pads[i].note);
      if (i !== echo.steps[echo.at]) {
        echoMiss();
        return;
      }
      echo.at += 1;
      if (echo.at >= echo.steps.length) echoWin();
    }
    function echoWin() {
      const round = echo.round;
      echo.phase = "done";
      recent.wonAt = Date.now();
      setRecord(Core.recordPlay(getRecord(), { action: "echo", round }).record);
      refreshMood();
      say(Core.convoLineFor({ companion, beat: "echoWin" }));
      say(`Round ${round}, echoed whole. Your best stands at round ${Core.playOf(getRecord()).echoBest}.`);
      echoStatus.textContent = "Echoed whole. The next round grows by one note.";
      setChips([
        chip("Next round", () => {
          echo.round = round + 1;
          beginEchoRound();
        }),
        chip("Done for now", () => {
          endEcho();
          afterTalk();
        })
      ]);
    }
    function echoMiss() {
      echo.phase = "done";
      say(Core.convoLineFor({ companion, beat: "echoMiss" }));
      const best = Core.playOf(getRecord()).echoBest;
      if (best > 0) say(`Your best stands at round ${best}.`);
      echoStatus.textContent = "The round rests here. The pattern will sing again whenever you ask.";
      setChips([
        chip("Try again", () => beginEchoRound()),
        chip("Done for now", () => {
          endEcho();
          afterTalk();
        })
      ]);
    }
    function endEcho() {
      echo = null;
      if (echoBox) echoBox.setAttribute("hidden", "");
    }
    function doAround() {
      answerInBody();
      const doors = Core.doorsFor({ links: pageLinks(), page: pageKey() });
      if (!doors.length) {
        say("This page keeps its doors in the menu at the top — every one of them is real, and I walk them all with you.");
        afterTalk();
        return;
      }
      say(Core.convoLineFor({ companion, beat: "around" }));
      sayList((box) => {
        const list = document.createElement("ul");
        list.className = "spark-guide-doors";
        for (const door of doors) {
          const li = document.createElement("li");
          const a = document.createElement("a");
          a.href = door.href;
          a.textContent = door.line ? `${door.label} — ${door.line}` : door.label;
          li.appendChild(a);
          list.appendChild(li);
        }
        box.appendChild(list);
      });
      afterTalk();
    }
    /* "Tell me more": the page's own words beyond the
     * explanation, gathered in the page's own order — first the
     * unheard remainder of the explainer (or opening) itself,
     * then the main content's paragraphs that follow it. The
     * core cuts them into chunks that partition that text:
     * nothing is padded, nothing is repeated, and nothing comes
     * from anywhere but this page. */
    let explainRest = [];
    function pageFollowingText(src) {
      const main = document.querySelector("main") || document.body;
      const headText = (src.explainerText || src.introText || "").replace(/\s+/g, " ").trim();
      const paras = Array.from(main.querySelectorAll("p"))
        .filter((p) => !p.closest(".spark-presence"))
        .map((p) => (p.textContent || "").replace(/\s+/g, " ").trim())
        .filter((t) => t.length >= 40);
      let startAt = 0;
      const headIx = paras.findIndex((t) => headText && headText.includes(t));
      if (headIx >= 0) startAt = headIx + 1;
      return paras
        .slice(startAt)
        .filter((t) => t !== headText && !headText.includes(t))
        .join(" ");
    }
    function doExplain() {
      answerInBody();
      const src = pageExplainSource();
      const ex = Core.explainFor(src);
      if (!ex.text) {
        say("This page speaks from its first lines — start at the top and I'll walk it with you.");
        afterTalk();
        return;
      }
      explainRest = [
        ...Core.explainChunksFor(src).chunks.slice(1),
        ...Core.moreChunksFor(pageFollowingText(src))
      ];
      say(Core.convoLineFor({ companion, beat: "explain" }));
      say(
        ex.text +
          (ex.source === "explainer"
            ? " — in this page's own explainer's words."
            : " — in this page's own opening words.")
      );
      afterExplain();
    }
    function afterExplain() {
      say(Core.convoLineFor({ companion, beat: "next" }));
      if (explainRest.length) {
        setChips([chip("Tell me more", () => doExplainMore(), "spark-guide-more"), ...mainChips()]);
      } else {
        setChips(mainChips());
      }
    }
    function doExplainMore() {
      answerInBody();
      const next = explainRest.shift();
      if (!next) {
        say("That is everything this page says about itself — all of it in the page's own words.");
        afterTalk();
        return;
      }
      say(Core.convoLineFor({ companion, beat: "more" }));
      say(next + " — still this page's own words.");
      afterExplain();
    }
    function doResume() {
      answerInBody();
      const resume = Core.resumeFor({ record: getRecord() });
      say(Core.convoLineFor({ companion, beat: "resume" }));
      sayDoor(resume.text, resume.href, resume.href ? "Back to it" : null);
      afterTalk();
    }
    /* The day's telling, where this page itself carries it:
     * the 13 Moons page stands its telling in blocks, filled
     * there from the canonical calendar. The presence only
     * reads the blocks as they stand — it composes nothing. */
    function pageTellingSource() {
      const grab = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.textContent : "";
      };
      return {
        headline: grab("#dayTellingHeadline"),
        position: grab("#dayTellingPosition"),
        arc: grab("#dayTellingArc"),
        reading: grab("#dayTellingReading")
      };
    }
    function doToday() {
      answerInBody();
      const telling = Core.tellingFor(pageTellingSource());
      if (telling.has) {
        /* This page carries the telling itself: she reads it —
         * the coordinate first, then the telling's own lines,
         * in the order the page stands them. */
        say(Core.convoLineFor({ companion, beat: "telling" }));
        say(Core.coordinateLineFor(today));
        for (const line of telling.lines) say(line);
        afterTalk();
        return;
      }
      say(Core.convoLineFor({ companion, beat: "today" }));
      sayDoor(
        `${Core.coordinateLineFor(today)}. The day's telling is told in plain words on the 13 Moons page.`,
        "moons.html",
        "Hear today's telling"
      );
      afterTalk();
    }
    function doTrail() {
      answerInBody();
      say(Core.convoLineFor({ companion, beat: "trail" }));
      const trail = Core.trailFor({ record: getRecord(), companion, today, page: pageKey() });
      if (!trail.steps.length) {
        say("The trail is quiet today — the day itself is the step.");
        afterTalk();
        return;
      }
      sayList((box) => {
        const list = document.createElement("ul");
        list.className = "spark-trail-steps";
        for (const step of trail.steps) {
          const li = document.createElement("li");
          li.className = step.done ? "is-done" : "";
          const mark = document.createElement("span");
          mark.className = "spark-trail-mark";
          mark.textContent = step.done ? "●" : "○";
          li.appendChild(mark);
          li.appendChild(document.createTextNode(" "));
          const a = document.createElement("a");
          a.href = step.href;
          a.textContent = step.label;
          li.appendChild(a);
          list.appendChild(li);
        }
        box.appendChild(list);
      });
      if (trail.complete) say("Walked, all of it. Well done, both of you.");
      afterTalk();
    }
    function doRecord() {
      answerInBody();
      say(Core.convoLineFor({ companion, beat: "record" }));
      if (panel.hasAttribute("hidden")) panelLink.click();
      afterTalk();
    }
    function doBye() {
      answerInBody();
      say(Core.convoLineFor({ companion, beat: "bye" }));
      setChips([]);
      window.setTimeout(closeBubble, 1200);
    }
    let convoStarted = false;
    function startConvo() {
      convoStarted = true;
      /* The hour greets first, in her temperament's voice; then
       * the day itself, counted by the calendar; then — once a
       * day at most — her one gentle question, drawn from what
       * the record truly holds, with its door on a chip and a
       * way past it that costs nothing. Any other day, the
       * standing question opens the talk as it always has. */
      const dayLine = Core.daypartLineFor({ companion, hour: new Date().getHours() });
      if (dayLine) say(dayLine);
      say(`${Core.coordinateLineFor(today)}. ${guide.text}`);
      const todayDay = today ? today.dayOfPatternYear : null;
      const askedDay = Core.playOf(getRecord()).askedDay;
      const question =
        todayDay != null && askedDay !== todayDay
          ? Core.questionFor({ record: getRecord(), companion, today, page: pageKey() })
          : null;
      if (question) {
        setRecord(Core.markAsked(getRecord(), { patternDay: todayDay }));
        say(question.text);
        setChips([
          chip(question.label, () => {
            window.location.href = question.href;
          }),
          chip("Another time", () => {
            say(Core.convoLineFor({ companion, beat: "ask" }));
            setChips(mainChips());
          })
        ]);
        return;
      }
      say(Core.convoLineFor({ companion, beat: "ask" }));
      setChips(mainChips());
    }
    function welcomeBack() {
      say(Core.convoLineFor({ companion, beat: "welcome" }));
      setChips(mainChips());
    }
    function openConvo() {
      bubble.removeAttribute("hidden");
      button.setAttribute("aria-expanded", "true");
      if (!convoStarted) startConvo();
      else welcomeBack();
    }

    /* Share my Spark: a portrait card drawn here, on this
     * device, from the same record the panel shows — its
     * portrait, both names, its kind and stage, the day it was
     * born from, and today. The keeper downloads the picture
     * and posts it wherever they choose; nothing is uploaded,
     * nothing is posted for them. */
    function doShare() {
      answerInBody();
      const card = Core.shareCardFor({ record: getRecord(), companion, today });
      const stage = Core.stageOf(getRecord(), companion);
      const W = 1080;
      const H = 1080;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#0b0e18";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#d9a441";
      ctx.lineWidth = 6;
      ctx.strokeRect(28, 28, W - 56, H - 56);
      ctx.strokeStyle = "rgba(45,212,191,0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(44, 44, W - 88, H - 88);
      const drawWords = () => {
        ctx.textAlign = "center";
        ctx.fillStyle = "#f3ead8";
        ctx.font = "600 92px Georgia, 'Times New Roman', serif";
        ctx.fillText(card.name, W / 2, 640);
        ctx.font = "400 40px Georgia, 'Times New Roman', serif";
        ctx.fillStyle = "#cfe8e2";
        ctx.fillText(card.seedLine, W / 2, 700);
        ctx.fillText(card.kindLine, W / 2, 758);
        ctx.fillStyle = "#d9a441";
        ctx.font = "600 44px Georgia, 'Times New Roman', serif";
        ctx.fillText(card.stageLine, W / 2, 824);
        ctx.font = "400 38px Georgia, 'Times New Roman', serif";
        ctx.fillStyle = "#cfe8e2";
        ctx.fillText(card.bornLine, W / 2, 882);
        ctx.fillText(`${card.todayLine} · ${card.daysLine}`, W / 2, 934);
        ctx.fillStyle = "#8fa3ad";
        ctx.font = "400 34px Georgia, 'Times New Roman', serif";
        ctx.fillText(card.brand, W / 2, 1004);
        const a = document.createElement("a");
        a.download = `codex-spark-${card.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
        a.href = canvas.toDataURL("image/png");
        a.click();
      };
      const svg = Core.renderSVG(companion, { stage: stage.index }).replace(
        "<svg ",
        '<svg xmlns="http://www.w3.org/2000/svg" width="460" height="460" '
      );
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, (W - 460) / 2, 90, 460, 460);
        URL.revokeObjectURL(url);
        drawWords();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        drawWords();
      };
      img.src = url;
      say(Core.convoLineFor({ companion, beat: "share" }));
      afterTalk();
    }
    host.querySelector(".spark-share-btn").addEventListener("click", doShare);

    const button = host.querySelector(".spark-presence-button");
    const bubble = host.querySelector(".spark-presence-bubble");
    let roam = null;
    let arrivalTimer = null;
    const closeBubble = () => {
      bubble.setAttribute("hidden", "");
      button.setAttribute("aria-expanded", "false");
      /* Closing the talk stills her voice with it — and folds
       * the echo board away with the talk it belongs to. */
      stopVoice();
      endEcho();
      if (arrivalTimer) {
        window.clearTimeout(arrivalTimer);
        arrivalTimer = null;
      }
    };
    const art = host.querySelector(".spark-presence-art");
    /* Its 3D body, where this device can grow one: the same seed
     * in three dimensions, standing in the flat drawing's place.
     * Where WebGL is not to be had, the mount declines and the
     * drawing stands, honestly, as it always did. */
    let ctrl = null;
    if (window.Spark3D && art) {
      const grownSize = companion.shape
        ? companion.shape.size * (1 + stage.index * 0.07)
        : 1;
      ctrl = window.Spark3D.mount(art, companion, {
        stage: stage.index,
        px: Math.round(48 * grownSize)
      });
      if (ctrl) art.classList.add("has-3d");
    }
    button.addEventListener("click", () => {
      /* A press that became a petting or a dragging has already
       * been answered by the touch layer below; the click that
       * trails it must not also open the talk. */
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      if (arrivalTimer) {
        window.clearTimeout(arrivalTimer);
        arrivalTimer = null;
      }
      tapSound(companion);
      /* A tap is answered in body as well as voice: a small
       * bounce of delight, gone as soon as it lands. */
      if (art) react(art);
      if (ctrl) ctrl.delight();
      /* Mid-chase, a tap on the Spark is a catch — the game
       * counts it before the bubble thinks of opening. */
      if (roam && roam.catchSpark()) return;
      if (roam) roam.wake();
      const open = bubble.hasAttribute("hidden");
      if (open) {
        /* A tap opens a talk: she turns, greets the day, and
         * asks her question — the panel rides inside the talk. */
        openConvo();
      } else {
        closeBubble();
      }
    });

    /* ---- v6: touch — she answers the hand itself ----
     * A plain tap stays a tap (and, mid-chase, a catch). But a
     * hand can do more than tap, and she answers all of it:
     * a jab is a poke — a squash, a count, a word in her voice
     * if her voice is on. A press that rubs is petting — she
     * leans in and glows, and the pet is counted. A press that
     * travels is a drag — she rides the finger and settles
     * where she is left. A drag let go fast is a toss — she
     * darts to where the throw was heading, on the same spring
     * as her dodges. Every one of these is play, counted on
     * this device, and play teaches her tricks. Under reduced
     * motion the roam rests, so a drag moves her drawing
     * directly and leaves her where she was put — the still
     * equivalent, never a dead press. */
    let suppressClick = false;
    let press = null;
    const freeDrag = { x: 0, y: 0 };
    function doPet() {
      recent.pettedAt = Date.now();
      setRecord(Core.recordPlay(getRecord(), { action: "pet" }).record);
      if (art) {
        art.classList.add("is-petted");
        window.setTimeout(() => art.classList.remove("is-petted"), 1000);
      }
      if (roam) roam.glow();
      if (ctrl) ctrl.delight();
      chirp(companion);
      vocalize(Core.convoLineFor({ companion, beat: "pet" }));
      refreshMood();
    }
    button.addEventListener("pointerdown", (event) => {
      /* Mid-chase a press on her is a catch in the making; the
       * click that follows it does the counting, as always. */
      if (roam && roam.isPlaying()) return;
      press = {
        x: event.clientX,
        y: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        t: performance.now(),
        moved: 0,
        dirX: 0,
        reversals: 0,
        petted: false,
        dragging: false,
        offX: 0,
        offY: 0,
        baseX: freeDrag.x,
        baseY: freeDrag.y
      };
      const rect = walker.getBoundingClientRect();
      press.offX = event.clientX - rect.left;
      press.offY = event.clientY - rect.top;
      if (art) {
        art.classList.add("is-poked");
        window.setTimeout(() => art.classList.remove("is-poked"), 240);
      }
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        /* capture is a courtesy; the press works without it */
      }
    });
    button.addEventListener("pointermove", (event) => {
      if (!press) return;
      const dx = event.clientX - press.lastX;
      const dy = event.clientY - press.lastY;
      press.moved += Math.hypot(dx, dy);
      if (Math.abs(dx) > 2) {
        const dir = Math.sign(dx);
        if (press.dirX && dir !== press.dirX) press.reversals += 1;
        press.dirX = dir;
      }
      press.lastX = event.clientX;
      press.lastY = event.clientY;
      const disp = Math.hypot(event.clientX - press.x, event.clientY - press.y);
      if (!press.dragging && disp > 30 && performance.now() - press.t > 120) {
        press.dragging = true;
        if (roam) roam.grab();
      }
      if (press.dragging) {
        if (roam) roam.dragTo(event.clientX - press.offX, event.clientY - press.offY);
        else {
          walker.style.transform =
            `translate(${press.baseX + event.clientX - press.x}px, ${press.baseY + event.clientY - press.y}px)`;
        }
      } else if (!press.petted && press.moved > 130 && press.reversals >= 2) {
        press.petted = true;
        if (art) art.classList.add("is-petted");
      }
    });
    function endPress(event, cancelled) {
      if (!press) return;
      const p = press;
      press = null;
      if (art) art.classList.remove("is-petted");
      const dt = Math.max(1, performance.now() - p.t);
      if (p.dragging) {
        suppressClick = true;
        const vx = (p.lastX - p.x) / dt;
        const vy = (p.lastY - p.y) / dt;
        const speed = Math.hypot(vx, vy);
        if (roam) {
          if (!cancelled && dt < 420 && speed > 0.8) {
            /* The toss: she flies to where the throw pointed. */
            roam.tossTo(p.lastX + vx * 280, p.lastY + vy * 280);
          } else {
            roam.release();
          }
        } else {
          freeDrag.x = p.baseX + p.lastX - p.x;
          freeDrag.y = p.baseY + p.lastY - p.y;
        }
        setRecord(Core.recordPlay(getRecord(), { action: "drag" }).record);
        if (ctrl) ctrl.delight();
      } else if (p.petted) {
        suppressClick = true;
        if (!cancelled) doPet();
      } else if (!cancelled && dt < 260) {
        /* A plain tap — a poke, counted. The click that follows
         * does the rest, exactly as it always has. */
        setRecord(Core.recordPlay(getRecord(), { action: "poke" }).record);
        vocalize(Core.convoLineFor({ companion, beat: "poke" }));
      }
    }
    button.addEventListener("pointerup", (event) => endPress(event, false));
    button.addEventListener("pointercancel", (event) => endPress(event, true));
    /* The Your Spark panel: who it is, how it has grown, and what
     * it has noticed — folded inside the bubble, one tap away. */
    const panel = host.querySelector(".spark-presence-panel");
    const panelLink = host.querySelector(".spark-presence-panel-link");
    panelLink.addEventListener("click", (event) => {
      event.preventDefault();
      answerInBody();
      if (panel.hasAttribute("hidden")) {
        panel.removeAttribute("hidden");
        careBox.removeAttribute("hidden");
        fillCare();
      } else {
        panel.setAttribute("hidden", "");
        careBox.setAttribute("hidden", "");
      }
    });
    /* Care, in three small acts. Kindle: a press warms it — a
     * bloom of glow, a happy sound, the bond deepens once a day.
     * Play: the bubble folds and the chase is on — it darts to a
     * few places on the page and waits, catchable, at each one.
     * Rest: it dims and curls and breathes quietly until a tap
     * or a scroll wakes it. Every act is recorded on this device
     * alone, and care only ever adds. */
    function doKindle() {
      setRecord(
        Core.applyCare(getRecord(), {
          action: "kindle",
          patternDay: today ? today.dayOfPatternYear : null
        })
      );
      if (art) {
        art.classList.remove("is-kindling");
        void art.offsetWidth;
        art.classList.add("is-kindling");
        window.setTimeout(() => art.classList.remove("is-kindling"), 1200);
      }
      if (roam) roam.glow();
      answerInBody();
      say(Core.convoLineFor({ companion, beat: "kindle" }));
      afterTalk();
    }
    function doPlay() {
      answerInBody();
      say(Core.convoLineFor({ companion, beat: "play" }));
      if (!roam) {
        /* Reduced motion: she stays in her corner by the
         * device's own asking, so the chase rests — and she
         * says so, rather than letting the tap fall dead. */
        say("I stay in my corner while your device asks for stillness — the chase rests with me. Care and talk still work, all of it.");
        afterTalk();
        return;
      }
      closeBubble();
      if (roam) {
        roam.startPlay((catches) => {
          recent.playedAt = Date.now();
          let next = Core.applyCare(getRecord(), {
            action: "play",
            patternDay: today ? today.dayOfPatternYear : null
          });
          next = Core.recordPlay(next, { action: "chase", catches }).record;
          setRecord(next);
          refreshMood();
          bubble.removeAttribute("hidden");
          button.setAttribute("aria-expanded", "true");
          if (!convoStarted) startConvo();
          say(Core.convoLineFor({ companion, beat: "caught" }));
          say(
            `That chase: ${catches} catch${catches === 1 ? "" : "es"}. ` +
              `Your best chase stands at ${Core.playOf(getRecord()).bestChase}.`
          );
          say("Play is in my step now — the bond grew with that chase.");
          say(Core.convoLineFor({ companion, beat: "next" }));
          setChips(mainChips());
        });
      }
    }
    function doRest() {
      setRecord(
        Core.applyCare(getRecord(), {
          action: "rest",
          patternDay: today ? today.dayOfPatternYear : null
        })
      );
      answerInBody(false);
      say(Core.convoLineFor({ companion, beat: "rest" }));
      if (!roam) {
        say("I am already resting in my corner — stillness suits me here.");
        afterTalk();
        return;
      }
      closeBubble();
      if (roam) roam.rest();
    }
    host.querySelector(".spark-care-kindle").addEventListener("click", doKindle);
    host.querySelector(".spark-care-play").addEventListener("click", doPlay);
    host.querySelector(".spark-care-rest").addEventListener("click", doRest);
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
      say(
        soundOff()
          ? "Sounds are off. My voice rests until you turn it on again."
          : "Sounds are on — my little notes will answer your taps."
      );
    });
    paintSound();
    /* Her voice box, on its own switch beside Sounds: it
     * rests quiet until the keeper turns it on, and the choice
     * is kept on this device. Turning it on, she says so — in
     * her own generated voice, since the keeper's tap is the
     * gesture. Turning it off stills her mid-line. The Sounds
     * switch rules it too: sounds off means her voice rests
     * as well. */
    const voiceToggle = host.querySelector(".spark-presence-voice");
    const paintVoice = () =>
      (voiceToggle.textContent = voiceOn() ? "Voice: speak" : "Voice: quiet");
    voiceToggle.addEventListener("click", (event) => {
      event.preventDefault();
      const turningOn = !voiceOn();
      try {
        window.localStorage.setItem(VOICE_KEY, turningOn ? "on" : "off");
      } catch {
        /* toggle simply does not persist */
      }
      paintVoice();
      if (turningOn) {
        say("My voice is on — the voice my seed grew, no one else's. It hums along with my lines as we talk.");
      } else {
        stopVoice();
        say("My voice rests now. My words stay here on the page.");
      }
    });
    paintVoice();
    /* A tap on her own furniture — her button, her chips, her
     * links — is the gesture her voice answers. Capture phase,
     * so the arming lands before the tap's own click speaks. */
    host.addEventListener(
      "pointerdown",
      () => {
        voiceArmed = true;
      },
      true
    );
    /* Pointerdown, not click — and a tap on a page's living entry
     * is never counted: that tap lifts the entry's door, and the
     * click that follows it belongs to the same gesture. It must
     * not fold a line the tap never saw. */
    document.addEventListener("pointerdown", (event) => {
      if (event.target && event.target.closest && event.target.closest(OPENING_SELECTOR)) return;
      if (!host.contains(event.target)) closeBubble();
    });
    document.body.appendChild(host);
    roam = startRoam({
      walker,
      button,
      bubble,
      art,
      companion,
      ctrl,
      grew,
      care: Core.careStateFor({
        record: getRecord(),
        companion,
        todayPatternDay: today ? today.dayOfPatternYear : null
      })
    });
    refreshMood();
    /* ---- v6: she celebrates what the site itself completes ----
     * Only events the code truly fires, hooked as they stand:
     * a practice sealed on the practice page (the Manifest
     * console writes it to the Life Atlas and announces the
     * records change with its own name on it), and a witness
     * entry saved on the 13 Moons page (its own saved event).
     * Her answer: a hop, a glow, her chime — the moment was the
     * keeper's own tap — and one line in her voice. A seal also
     * refreshes what she senses of the practice days, so her
     * record stays honest the moment it happens. The planner's
     * events live only on the Sphere page, where she does not
     * walk; no reading anywhere on the site announces its end,
     * so no celebration is hooked to one. */
    let celebrateGuard = 0;
    function celebrate(kind) {
      const now = Date.now();
      if (now - celebrateGuard < 1600) return;
      celebrateGuard = now;
      if (art) {
        art.classList.remove("is-hopping");
        void art.offsetWidth;
        art.classList.add("is-hopping");
        window.setTimeout(() => art.classList.remove("is-hopping"), 1500);
      }
      if (ctrl) ctrl.celebrate();
      if (roam) roam.glow();
      chirp(companion);
      announceLine(Core.convoLineFor({ companion, beat: kind }));
      if (kind === "sealed") {
        sensePractice(getRecord()).then((next) => {
          if (next && next !== getRecord()) setRecord(next);
        });
      }
    }
    /* Both events are dispatched without bubbling, each on its
     * own target: the witness event lives on the document alone,
     * and the records change is announced on the document and
     * the window both. So she listens on both targets, and the
     * guard above keeps the double announcement to one answer. */
    const onRecordsChanged = (event) => {
      const detail = event && event.detail;
      if (detail && detail.source === "manifest-practice") celebrate("sealed");
    };
    const onWitnessSaved = () => celebrate("saved");
    document.addEventListener("sof:life-atlas-records-changed", onRecordsChanged);
    window.addEventListener("sof:life-atlas-records-changed", onRecordsChanged);
    document.addEventListener("sof:witness-saved", onWitnessSaved);
    window.addEventListener("sof:witness-saved", onWitnessSaved);

    /* A guide speaks first on arrival, briefly, then steps back:
     * the line shows itself, and folds away on its own. A growth
     * is spoken the same way, once, when it is new. A tap on
     * the Spark, or anywhere else, folds it sooner. Pages open
     * with a living entry first, though — so while that door is
     * up, the guide waits, and speaks the moment it lifts. */
    if (arrival || growthLine) {
      const openBubble = () => {
        if (!bubble.hasAttribute("hidden")) return;
        /* Arriving, she opens the talk herself: greeting, the
         * real day, her question — then she steps back. */
        openConvo();
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

  /* Her voice box rests quiet until the keeper turns it on;
   * the choice is kept on this device, like the sounds. Any
   * stored value other than "on" — including none at all —
   * means quiet: she never speaks first and asks later. */
  const VOICE_KEY = "sof.spark.voice";
  function voiceOn() {
    try {
      return window.localStorage.getItem(VOICE_KEY) === "on";
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

  /* The character engine. The Spark is not pinned to its corner:
   * it walks in when a page opens, then lives on the page — it
   * wanders the floor, the sides, and sometimes the open middle,
   * pausing, looking around, now and then doing a small signature
   * move. Bring a cursor or a finger close and it plays: most
   * Sparks scoot away with a little dart — sooner and farther the
   * shyer they are — and bold ones sometimes come to look instead.
   *
   * It moves by steering, not animation: a velocity, a desired
   * velocity, and a capped force between them, so it gathers,
   * arcs, and settles like a creature, the same at any frame
   * rate. The dodge is predictive — it flees from where the
   * pointer will be — and anticipated: a small crouch, a breath,
   * then the dart. Idle choices are scored by a small utility
   * brain whose weights are its temperament's own curves.
   *
   * The fences hold: the roaming field takes no clicks (only the
   * Spark itself does, and it moves out from under the pointer
   * rather than covering anything); it never dodges or roams
   * while its bubble is open; after three quick scoots it settles
   * where a tap can reach it, and a tap always lands; the loop
   * sleeps while the tab is hidden; and a visitor whose device
   * asks for reduced motion gets a Spark that simply appears in
   * its corner and stays there. */
  function startRoam({ walker, button, bubble, art, companion, ctrl, grew, care }) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
    const play = PLAY[companion.temperament] || PLAY.curious;
    const pace = companion.shape ? companion.shape.pace : 1;
    /* Care shapes the day: played with, it plays back harder;
     * rested, it travels calm. Same temperament, same seed —
     * the care its person gave it, felt in its step. */
    const carePlay = care && care.behavior ? care.behavior : {};
    const playfulness = Math.min(1.3, play.playfulness + (carePlay.playfulnessBoost || 0));
    const SPEED =
      ({ stroll: 62, drift: 34, hop: 100 }[companion.shape ? companion.shape.gait : "stroll"] || 62) *
      (carePlay.wanderCalm || 1);
    if (carePlay.kindled) walker.dataset.kindled = "true";
    const MARGIN = 10;
    const lift = bottomLift();
    const W = () => walker.offsetWidth || 120;
    const H = () => walker.offsetHeight || 52;

    walker.style.left = "0px";
    walker.style.top = "0px";
    walker.style.right = "auto";
    walker.style.bottom = "auto";
    walker.style.transition = "none";

    const homePos = () => ({
      x: Math.max(MARGIN, window.innerWidth - W() - 14),
      y: Math.max(MARGIN, window.innerHeight - H() - 14 - lift)
    });
    const clampPos = (p) => ({
      x: Math.min(Math.max(MARGIN, p.x), Math.max(MARGIN, window.innerWidth - W() - MARGIN)),
      y: Math.min(Math.max(MARGIN, p.y), Math.max(MARGIN, window.innerHeight - H() - MARGIN))
    });
    let pos = homePos();
    let belowBubble = false;
    function apply() {
      walker.style.transform = `translate3d(${Math.round(pos.x)}px, ${Math.round(pos.y)}px, 0)`;
      const below = pos.y < 330;
      if (below !== belowBubble) {
        belowBubble = below;
        walker.classList.toggle("bubble-below", below);
      }
    }
    const center = () => ({ x: pos.x + W() / 2, y: pos.y + H() / 2 });
    const bubbleOpen = () => !bubble.hasAttribute("hidden");

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
    /* v3 life: the chase, the nap, the investigation — and the
     * cap that keeps proactivity charming. Antics (flourishes,
     * investigations, scroll glances) are counted per page and
     * stop at six; the Spark then simply walks and rests. */
    let antics = 0;
    const ANTICS_CAP = 6;
    let lastInteractAt = performance.now();
    let playQueue = [];
    let playDone = null;
    let playCatches = 0;
    let lureTimer = null;
    let resting = false;
    let napping = false;
    const vel = { x: 0, y: 0 };
    const pointer = { x: 0, y: 0, vx: 0, vy: 0, seenAt: 0, lastMoveAt: 0 };
    const pointerPredicted = (lead) => ({
      x: pointer.x + pointer.vx * lead,
      y: pointer.y + pointer.vy * lead
    });
    function trackPointer(e) {
      const now = performance.now();
      const dt = Math.max(1, now - (pointer.lastMoveAt || now)) / 1000;
      if (pointer.lastMoveAt) {
        pointer.vx = pointer.vx * 0.6 + ((e.clientX - pointer.x) / dt) * 0.4;
        pointer.vy = pointer.vy * 0.6 + ((e.clientY - pointer.y) / dt) * 0.4;
      }
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.seenAt = now;
      pointer.lastMoveAt = now;
    }

    function pickTarget() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const home = homePos();
      const roll = Math.random();
      let t;
      if (roll < 0.55) {
        /* The floor: somewhere along the bottom it calls home. */
        t = { x: MARGIN + Math.random() * Math.max(10, vw - W() - MARGIN * 2), y: home.y };
      } else if (roll < 0.8) {
        /* A side: up one edge of the page or the other. */
        const left = Math.random() < 0.5;
        t = {
          x: left ? MARGIN + 6 : vw - W() - MARGIN - 6,
          y: vh * 0.3 + Math.random() * vh * 0.55
        };
      } else {
        /* The open middle, now and then — it is not afraid of
         * the room it lives in. */
        t = {
          x: vw * 0.15 + Math.random() * vw * 0.6,
          y: vh * 0.18 + Math.random() * vh * 0.5
        };
      }
      return clampPos(t);
    }

    function wake() {
      if (rafId == null) {
        lastTs = 0;
        rafId = window.requestAnimationFrame(tick);
      }
    }

    function goIdle(ms) {
      state = "idle";
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(nextBehavior, ms);
    }

    const SIGNATURE = {
      bold: "is-spinning",
      bright: "is-spinning",
      curious: "is-looking",
      gentle: "is-stretching",
      steady: "is-stretching",
      quiet: "is-looking"
    };
    function flourish() {
      antics += 1;
      const cls =
        Math.random() < 0.55
          ? SIGNATURE[companion.temperament] || "is-looking"
          : ["is-spinning", "is-stretching", "is-looking", "is-hopping"][Math.floor(Math.random() * 4)];
      if (art) {
        art.classList.add(cls);
        window.setTimeout(() => art.classList.remove(cls), 1500);
      }
      if (ctrl) ctrl.flourish(cls);
    }

    /* A place on the page worth a closer look: a heading or a
     * card, chosen from the page as it stands, with room beneath
     * it to perch. The Spark investigates what is actually here —
     * it invents no destinations. */
    function perchTarget() {
      const els = document.querySelectorAll("main h2, main .card, article h2, article .card, .card");
      if (!els.length) return null;
      const el = els[Math.floor(Math.random() * els.length)];
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.bottom < 40 || rect.top > window.innerHeight - 60) return null;
      return clampPos({
        x: rect.left + rect.width / 2 - W() / 2,
        y: rect.bottom + 10
      });
    }

    function chooseBehavior() {
      const c = center();
      const pointerNear =
        performance.now() - pointer.lastMoveAt < 2500 &&
        Math.hypot(pointer.x - c.x, pointer.y - c.y) < 340;
      const pointerStill = performance.now() - pointer.lastMoveAt > 1100;
      const capped = antics >= ANTICS_CAP;
      const scores = {
        wander: play.wander,
        approach: pointerNear ? play.approach * 2.4 + (pointerStill ? 0.25 : 0) : play.approach * 0.3,
        flourish: capped ? 0 : 0.5 * playfulness + 0.12,
        investigate: capped ? 0 : 0.3 * play.wander + 0.1,
        rest: 0.22 + activeStreak * 0.2 + (carePlay.rested ? 0.15 : 0)
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

    function enterNap() {
      napping = true;
      state = "idle";
      walker.classList.add("is-napping");
      if (ctrl) ctrl.setTravel(false, 0);
    }

    function leaveRest() {
      if (resting) {
        resting = false;
        walker.classList.remove("is-resting");
      }
      if (napping) {
        napping = false;
        walker.classList.remove("is-napping");
      }
    }

    function nextBehavior() {
      if (document.hidden) {
        idleTimer = window.setTimeout(nextBehavior, 4000);
        return;
      }
      if (resting || napping) {
        idleTimer = window.setTimeout(nextBehavior, 3000);
        return;
      }
      if (bubbleOpen()) {
        idleTimer = window.setTimeout(nextBehavior, 3000);
        return;
      }
      /* A long quiet page is a napping page: after real
       * inactivity it curls up and breathes, and any touch,
       * scroll, or key wakes it. */
      if (performance.now() - lastInteractAt > 45000) {
        enterNap();
        idleTimer = window.setTimeout(nextBehavior, 5000);
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
          target = clampPos({ x: pos.x + (dx / dist) * stepIn, y: pos.y + (dy / dist) * stepIn });
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
      } else if (choice === "investigate") {
        const perch = perchTarget();
        if (perch) {
          antics += 1;
          target = perch;
          state = "investigate";
          activeStreak += 1;
          wake();
        } else {
          target = pickTarget();
          state = "move";
          activeStreak += 1;
          wake();
        }
      } else if (choice === "approach") {
        const c = center();
        const dx = pointer.x - c.x;
        const dy = pointer.y - c.y;
        const dist = Math.hypot(dx, dy) || 1;
        const stepIn = Math.max(24, dist - play.radius * 1.3);
        target = clampPos({ x: pos.x + (dx / dist) * stepIn, y: pos.y + (dy / dist) * stepIn });
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

    function arrive() {
      if (art) art.classList.remove("is-walking");
      if (ctrl) ctrl.setTravel(false, 0);
      vel.x = 0;
      vel.y = 0;
      if (state === "play") {
        /* Arrived at a chase point: it waits there, bright and
         * catchable, until its person's tap lands. No timer
         * punishes a slow catch — the game waits with it. */
        state = "playwait";
        if (art) art.classList.add("is-playful");
        return;
      }
      if (state === "toss") {
        /* A throw, landed: a small delight, then the walk
         * resumes — she goes where the hand sent her and is
         * pleased about the journey. */
        if (ctrl) ctrl.delight();
        goIdle(1200 + Math.random() * 900);
        state = "idle";
        return;
      }
      if (state === "investigate") {
        if (art) art.classList.add("is-looking");
        window.setTimeout(() => art && art.classList.remove("is-looking"), 2600);
        goIdle(3800 + Math.random() * 2200);
      } else if (state === "dodge") {
        const c = center();
        peekWanted =
          performance.now() - pointer.lastMoveAt > 900 &&
          Math.hypot(pointer.x - c.x, pointer.y - c.y) < 320 &&
          play.approach > 0;
        goIdle(1100 + Math.random() * 1200);
      } else if (state === "enter") {
        /* A growth, celebrated in the body the moment it walks
         * in: a flourish of light and spin. The words are in the
         * bubble and the chime waits for the first tap — the
         * body simply rejoices, and nothing blocks the page. */
        if (grew) {
          if (art) {
            art.classList.add("is-evolving");
            window.setTimeout(() => art.classList.remove("is-evolving"), 1700);
          }
          if (ctrl) ctrl.celebrate();
        }
        goIdle((2500 + Math.random() * 3500) / pace);
      } else {
        goIdle((3500 + Math.random() * 8000) / pace);
      }
      state = "idle";
    }

    /* The play itself — a reflex, deliberately not part of the
     * utility brain: deliberation is for idle moments, and a
     * startle is not one. Returns true when it acted. Capped
     * three ways, so it charms and never torments: a cooldown
     * between scoots, no scooting while its bubble is open or
     * while it is still walking in, and after three quick scoots
     * it settles for a while, where a tap can always reach it. */
    function tryPlay(now) {
      if (state === "dodge" || state === "anticipate" || state === "enter" || state === "hold" || state === "play" || state === "playwait" || state === "held" || state === "toss") return false;
      if (bubbleOpen()) return false;
      if (now < settleUntil || now - lastDodgeAt < play.cooldown) return false;
      const c = center();
      /* Evade is predictive: it flees from where the pointer
       * will be a breath from now, not where it is. */
      const ahead = pointerPredicted(0.28);
      const dx = c.x - ahead.x;
      const dy = c.y - ahead.y;
      const dist = Math.hypot(dx, dy);
      if (dist > play.radius) return false;
      if (Math.random() < play.approach && state === "idle") {
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
      if (now - lastStreakAt < 6000) dodgeStreak += 1;
      else dodgeStreak = 1;
      lastStreakAt = now;
      if (dodgeStreak >= 3) {
        settleUntil = now + 8000;
        dodgeStreak = 0;
      }
      window.clearTimeout(idleTimer);
      wake();
      return true;
    }

    function tick(ts) {
      rafId = null;
      const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0);
      lastTs = ts;
      if (state === "idle") return;
      if (state === "held") {
        /* In the keeper's hand: the hand moves her, not the
         * steering. The loop rests until she is set down. */
        rafId = null;
        return;
      }
      if (bubbleOpen()) {
        state = "hold";
      }
      if (state === "hold") {
        if (bubbleOpen()) {
          rafId = window.requestAnimationFrame(tick);
          return;
        }
        state = "idle";
        goIdle(1200);
        return;
      }
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
      if (state === "move" && ts - pointer.seenAt < 3000 && tryPlay(ts)) {
        rafId = window.requestAnimationFrame(tick);
        return;
      }
      if (!target) {
        goIdle(3000);
        return;
      }
      /* Steering: seek the target with a capped force, easing
       * out as it nears, so every journey starts with a gather
       * and ends with a settle — never a slide. */
      const dx = target.x - pos.x;
      const dy = target.y - pos.y;
      const dist = Math.hypot(dx, dy);
      const maxSpeed =
        state === "dodge" ? SPEED * 3.4 : state === "toss" ? SPEED * 3.1 : state === "play" ? SPEED * 2.6 : state === "enter" ? SPEED * 1.15 : state === "approach" ? SPEED * 0.7 : SPEED;
      const maxForce = state === "dodge" ? 1500 : state === "toss" ? 1200 : state === "play" ? 900 : 280;
      const arriveRadius = state === "dodge" || state === "toss" ? 0 : 90;
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

    window.addEventListener(
      "pointermove",
      (e) => {
        lastInteractAt = performance.now();
        if (napping) {
          leaveRest();
          idleTimer = window.setTimeout(nextBehavior, 1500);
        }
        trackPointer(e);
        /* Near, but not yet startling it: it looks toward you —
         * the gaze lands before the body ever reacts. */
        if (ctrl) {
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
        lastInteractAt = performance.now();
        if (napping) leaveRest();
        /* A finger has no hover: its approach is its landing.
         * A landing near the Spark startles it the same way —
         * but a landing ON it is a tap, and a tap always lands. */
        if (button.contains(e.target)) return;
        trackPointer(e);
        /* The lure: a finger that lands near her and simply
         * holds — stillness is safety, the oldest rule of her
         * play. If it is still there a breath later and she did
         * not startle away, she comes to it, the way the peek
         * brings her back after a dodge. */
        const c0 = center();
        const d0 = Math.hypot(e.clientX - c0.x, e.clientY - c0.y);
        if (d0 < play.radius * 2.4 && d0 > 12 && !bubbleOpen()) {
          window.clearTimeout(lureTimer);
          lureTimer = window.setTimeout(() => {
            if (
              performance.now() - pointer.lastMoveAt > 850 &&
              !bubbleOpen() &&
              state !== "play" &&
              state !== "playwait" &&
              state !== "held" &&
              state !== "dodge"
            ) {
              const c = center();
              const dx = pointer.x - c.x;
              const dy = pointer.y - c.y;
              const dist = Math.hypot(dx, dy) || 1;
              const stepIn = dist - play.radius * 1.15;
              if (stepIn > 6) {
                target = clampPos({
                  x: pos.x + (dx / dist) * stepIn,
                  y: pos.y + (dy / dist) * stepIn
                });
                state = "approach";
                window.clearTimeout(idleTimer);
                wake();
              }
            }
          }, 950);
        }
        tryPlay(pointer.seenAt);
      },
      { passive: true }
    );
    /* Scrolling is company too: it glances toward the motion,
     * now and then, and any scroll wakes a resting Spark. The
     * glances count against the same antics cap as everything
     * else proactive. */
    let lastScrollGlance = 0;
    let lastScrollY = window.scrollY;
    window.addEventListener(
      "scroll",
      () => {
        lastInteractAt = performance.now();
        if (resting || napping) {
          leaveRest();
          if (state === "idle") idleTimer = window.setTimeout(nextBehavior, 1500);
          return;
        }
        const now = performance.now();
        const dir = window.scrollY > lastScrollY ? 1 : -1;
        lastScrollY = window.scrollY;
        if (now - lastScrollGlance < 1400 || antics >= ANTICS_CAP || bubbleOpen()) return;
        lastScrollGlance = now;
        antics += 1;
        if (ctrl) ctrl.lookAt(0, dir * 0.5);
        if (art) {
          art.classList.add("is-looking");
          window.setTimeout(() => art.classList.remove("is-looking"), 700);
        }
      },
      { passive: true }
    );
    window.addEventListener("keydown", () => {
      lastInteractAt = performance.now();
      if (napping) leaveRest();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (rafId != null) window.cancelAnimationFrame(rafId);
        rafId = null;
        window.clearTimeout(idleTimer);
      } else if (state === "idle") {
        idleTimer = window.setTimeout(nextBehavior, 1500);
      } else {
        wake();
      }
    });

    /* Walk in: it starts a little way across the floor and comes
     * home — the same arrival it has always made, now the first
     * step of a roam that never quite ends. */
    const home = homePos();
    pos = clampPos({ x: home.x - Math.min(430, window.innerWidth * 0.38), y: home.y });
    apply();
    target = home;
    state = "enter";
    wake();

    /* The care controls the bubble drives. */
    return {
      /* The chase: three to five darts across the floor and the
       * open middle, a bright wait at each, and a finish when
       * the last catch lands. */
      startPlay(done) {
        if (state === "play" || state === "playwait") return;
        leaveRest();
        const n = 3 + Math.floor(Math.random() * 3);
        playQueue = [];
        for (let i = 0; i < n; i++) playQueue.push(pickTarget());
        playDone = typeof done === "function" ? done : null;
        playCatches = 0;
        target = playQueue.shift();
        state = "play";
        window.clearTimeout(idleTimer);
        wake();
      },
      /* A tap landed mid-chase. Returns true when it counted.
       * The chase keeps its own score: how many catches landed
       * before the last one closed it — handed to the finish
       * so the talk can say the count aloud. */
      catchSpark() {
        if (state !== "playwait") return false;
        playCatches += 1;
        if (art) art.classList.remove("is-playful");
        if (playQueue.length) {
          target = playQueue.shift();
          state = "play";
          wake();
        } else {
          state = "idle";
          const done = playDone;
          playDone = null;
          goIdle(2500);
          if (done) done(playCatches);
        }
        return true;
      },
      /* Whether a chase is running — the touch layer leaves
       * her alone for the catch while it is. */
      isPlaying() {
        return state === "play" || state === "playwait";
      },
      /* The hand takes her: motion stops, the loop rests, and
       * dragTo moves her directly until release sets her down
       * where the hand left her. */
      grab() {
        if (state === "play" || state === "playwait") return;
        leaveRest();
        state = "held";
        window.clearTimeout(idleTimer);
        if (rafId != null) window.cancelAnimationFrame(rafId);
        rafId = null;
      },
      dragTo(x, y) {
        if (state !== "held") return;
        pos = clampPos({ x, y });
        vel.x = 0;
        vel.y = 0;
        apply();
      },
      release() {
        if (state !== "held") return;
        state = "idle";
        goIdle(1300);
      },
      /* The toss: a target thrown ahead of the hand, flown to
       * on the chase's own spring. The point given is where
       * her centre should land. */
      tossTo(x, y) {
        leaveRest();
        target = clampPos({ x: x - W() / 2, y: y - H() / 2 });
        state = "toss";
        window.clearTimeout(idleTimer);
        wake();
      },
      /* Rest: dims, curls, breathes — until woken. */
      rest() {
        resting = true;
        state = "idle";
        window.clearTimeout(idleTimer);
        if (rafId != null) window.cancelAnimationFrame(rafId);
        rafId = null;
        walker.classList.add("is-resting");
        if (ctrl) ctrl.setTravel(false, 0);
      },
      wake() {
        if (!resting && !napping) return;
        leaveRest();
        idleTimer = window.setTimeout(nextBehavior, 1200);
      },
      /* A kindle's warmth, in the body: a brief warm bloom. */
      glow() {
        walker.dataset.kindled = "true";
        if (art) {
          art.classList.remove("is-kindling");
          void art.offsetWidth;
          art.classList.add("is-kindling");
          window.setTimeout(() => art.classList.remove("is-kindling"), 1200);
        }
      }
    };
  }

  /* How it plays is its temperament's own: how close a pointer
   * may come before it scoots (radius), how far the scoot
   * carries, how long before it will scoot again (cooldown), and
   * how often it comes to look instead of fleeing. The last two
   * are its utility curves — how much it loves to wander, and how
   * playful it is — the weights its small brain scores its choices
   * with. Temperament is parameters, never code paths. */
  const PLAY = {
    bold: { radius: 52, scoot: [36, 64], cooldown: 1400, approach: 0.35, wander: 1.1, playfulness: 0.8 },
    curious: { radius: 84, scoot: [56, 96], cooldown: 1900, approach: 0.4, wander: 1.25, playfulness: 0.9 },
    bright: { radius: 76, scoot: [64, 110], cooldown: 2000, approach: 0.15, wander: 1.0, playfulness: 1.0 },
    gentle: { radius: 88, scoot: [70, 120], cooldown: 2400, approach: 0.1, wander: 0.8, playfulness: 0.6 },
    steady: { radius: 64, scoot: [44, 80], cooldown: 2200, approach: 0.05, wander: 0.7, playfulness: 0.4 },
    quiet: { radius: 118, scoot: [120, 190], cooldown: 3000, approach: 0, wander: 0.6, playfulness: 0.5 }
  };

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
    /* Today's trail, honestly kept: arriving at a step's door
     * today walks that step. The practice step completes from
     * the practice days themselves, sensed just above. */
    const trail = Core.trailFor({ record, companion, today, page: pageKey() });
    for (const step of trail.steps) {
      if (!step.done && step.id !== "practice" && step.href === pageKey()) {
        record = Core.recordTrailStep(record, { patternDay, stepId: step.id });
      }
    }
    const growth = Core.growthEventFor({ record, companion });
    record = Core.markStageSeen(record, growth.stage.index);
    writeRecord(record);
    if (growth.grew) growthChimeWaiting = true;
    /* On its own home page the Spark is already centre stage. */
    if (pageKey() !== "companions.html") {
      const store = {
        current: record,
        get() {
          return this.current;
        },
        set(next) {
          this.current = next;
        }
      };
      renderPresence(
        record,
        companion,
        today,
        justAdopted || isNewPage,
        growth.grew ? Core.growthLineFor({ record, companion, stage: growth.stage }) : null,
        growth.grew,
        store
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
    /* The meeting, in 3D where this device can grow it: the same
     * seed standing in three dimensions. Where it cannot, the
     * flat drawing stands, as it always did. */
    let encounterCtrl = null;
    if (window.Spark3D && art) {
      encounterCtrl = window.Spark3D.mount(art, companion, { stage: 0, px: 84 });
      if (encounterCtrl) art.classList.add("has-3d");
    }
    /* Before adoption, a tap on the Spark itself is answered:
     * its greeting chirp, and a wiggle of delight. */
    artBtn.addEventListener("click", () => {
      chirp(companion);
      react(art);
      if (encounterCtrl) encounterCtrl.delight();
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
      if (encounterCtrl) encounterCtrl.celebrate();
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
        if (encounterCtrl) encounterCtrl.dispose();
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
      if (encounterCtrl) encounterCtrl.dispose();
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
