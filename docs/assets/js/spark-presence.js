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

  /* The site's root, as an absolute address: this script's own
   * folder, two steps up. The Spark walks pages that live in
   * folders of their own — the Scroll Library under /scroll/,
   * the systems under /systems/ — and the doors the core names
   * for their are root pages ("moons.html", the Sphere, their own
   * companions page). Resolved from a folder page, a bare name
   * lands on a gate that does not exist (/scroll/moons.html —
   * the broken gate Aaron found, Nov 19, 2026). So every door
   * they offer is resolved here, in the glue: a bare name the
   * guide knows as a root page is taken to the root; anything
   * else — a page's own relative link, a sibling page — is
   * left exactly as it stands. */
  function siteRoot() {
    const base = scriptBase();
    return base.endsWith("assets/js/") ? base.slice(0, -"assets/js/".length) : base;
  }

  function doorHref(href) {
    if (!href || typeof href !== "string") return href;
    const clean = href.split("#")[0].split("?")[0];
    if (/^[a-z0-9-]+\.html$/i.test(clean) && Core.PAGE_GUIDE && Core.PAGE_GUIDE[clean]) {
      return siteRoot() + clean + href.slice(clean.length);
    }
    return href;
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

  /* The record state's rows, from the core's panel data: their
   * face, both names and which is which, its kind and
   * character, its growth, the days together, and what it has
   * noticed — observed labeled observed, inferred labeled
   * inferred, never merged. Built with text nodes throughout:
   * nothing the record holds is ever treated as markup. Kept
   * compact on purpose — short rows, so the whole record
   * stands in the panel at phone size. */
  function buildRecordRows(container, record, companion, today) {
    const data = Core.panelFor({ record, companion, today });
    container.innerHTML = "";
    const face = document.createElement("div");
    face.className = "spark-panel-face";
    face.innerHTML = Core.renderSVG(companion, {
      stage: data.stageIndex,
      revealed: Core.revealsFor({ record, companion }).revealed
    });
    container.appendChild(face);
    const row = (label, value) => {
      const p = document.createElement("p");
      p.className = "spark-panel-row";
      const b = document.createElement("strong");
      b.textContent = label;
      p.appendChild(b);
      p.appendChild(document.createTextNode(` ${value}`));
      container.appendChild(p);
    };
    row("Answers to:", data.name);
    if (data.seedName && data.seedName !== data.name) row("Seed name:", data.seedName);
    row("Kind:", `${data.kindName} — ${data.temperament}, ${data.trait}`);
    const herSound = Core.soundFor(companion);
    if (herSound) row("Sound:", `${herSound.familyName} — theirs alone.`);
    /* Their rarity, counted from their own draws — the standing
     * first, then each notable trait with its odds, then the
     * marks birth and life gave them. Facts, plainly kept. */
    if (data.rarity) {
      row("Standing:", `${data.rarity.tierName} — about 1 in ${data.rarity.oneInText}, counted from their draws.`);
      for (const trait of data.rarity.traits) row("Notable:", trait.line);
      for (const special of data.rarity.specials) row("Birth & life:", special.line);
    }
    const prog = Core.progressOf(record, companion);
    row(
      "Stage:",
      prog.next
        ? `${data.stageName} · ${data.points} points · ${prog.toGo} to ${prog.next}`
        : `${data.stageName} · fully grown`
    );
    row("Together:", `${data.daysTogether} day${data.daysTogether === 1 ? "" : "s"}`);
    if (data.mood) row("Mood:", data.mood.line);
    if (data.play) {
      const bits = [];
      if (data.play.tricksKnown > 0) bits.push(`Tricks ${data.play.tricksKnown} of ${data.play.tricksTotal}`);
      if (data.play.bestChase > 0) bits.push(`best chase ${data.play.bestChase}`);
      if (data.play.echoBest > 0) bits.push(`best echo round ${data.play.echoBest}`);
      if (data.play.pets > 0) bits.push(`${data.play.pets} pets`);
      if (bits.length) row("Play:", bits.join(" · "));
    }
    if (data.care) row("Bond:", `${data.care.bond} · ${data.care.warmth}`);
    for (const notice of data.notices.slice(0, 3)) {
      const p = document.createElement("p");
      p.className = "spark-panel-row spark-panel-notice";
      const tag = document.createElement("span");
      tag.className = `spark-notice-kind is-${notice.kind}`;
      tag.textContent = notice.kind === "observed" ? "Observed" : "Inferred";
      p.appendChild(tag);
      p.appendChild(document.createTextNode(" "));
      if (notice.href) {
        const a = document.createElement("a");
        a.href = doorHref(notice.href);
        a.textContent = notice.text;
        p.appendChild(a);
      } else {
        p.appendChild(document.createTextNode(notice.text));
      }
      container.appendChild(p);
    }
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
      /* The link is kept as the page wrote it: from a folder
       * page, "../moons.html" already points at the real door,
       * and a bare sibling name points at the sibling. Cutting
       * it down to its file name — as this once did — broke
       * every such door from inside a folder (the /scroll/
       * broken gate). The core names doors by file name; the
       * walking uses the link as written. */
      out.push({ href, label: (a.textContent || "").replace(/\s+/g, " ").trim().slice(0, 48) });
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
      `<div class="spark-panel">` +
      `<p class="spark-panel-line" aria-live="polite"><strong class="spark-panel-who"></strong> <span class="spark-panel-text"></span></p>` +
      `<p class="spark-panel-coord"></p>` +
      `<div class="spark-panel-rows"></div>` +
      `<div class="spark-echo" hidden><div class="spark-echo-pads" role="group" aria-label="Echo game colours"></div></div>` +
      `<div class="spark-panel-grid" role="group" aria-label="Your Spark's options"></div>` +
      `</div></div>` +
      `<button type="button" class="spark-presence-button" aria-expanded="false">` +
      `<span class="spark-presence-art">${Core.renderSVG(companion, { stage: stage.index, revealed: Core.revealsFor({ record, companion }).revealed })}</span>` +
      `<span class="spark-presence-name"></span></button>`;
    host.querySelector(".spark-presence-button").setAttribute(
      "aria-label",
      `Your Spark, ${displayName} — tap for a suggestion`
    );
    host.querySelector(".spark-presence-name").textContent = displayName;
    host.querySelector(".spark-panel-who").textContent = displayName;
    host.querySelector(".spark-panel-coord").textContent = Core.coordinateLineFor(today);
    /* The moon they are under, from the same canonical position
     * that counts their day: its name flavors their greeting, and
     * its element lends its hue family to their light — their
     * glow, never their seed-grown colours, which stay theirs. */
    const moonElement =
      today && today.moon != null && window.PatternCalendarData && Array.isArray(window.PatternCalendarData.moons)
        ? (window.PatternCalendarData.moons[today.moon - 1] || {}).element || null
        : null;
    const moonTemper = Core.moonTemperFor({ today, element: moonElement });
    if (moonTemper) {
      walker.style.setProperty("--spark-moon-hue", String(moonTemper.hue));
      walker.dataset.moonElement = moonTemper.element || "";
    }

    /* ---- v3: the care life and the real guide ---- */
    const getRecord = () => (store ? store.get() : record);
    /* v6: what just happened, kept only in this page's memory —
     * the fresh facts their mood is derived from. Nothing here is
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
      /* Their reveals ride the same one path as their tricks: a
       * detail that has arrived since the last write is news
       * exactly once — marked in the record as told, announced
       * gently, and their face is drawn again wearing it. */
      const arrived = Core.newRevealsBetween({ before: getRecord(), after: next, companion });
      if (arrived.length) next = Core.markRevealsSeen(next, arrived);
      if (store) store.set(next);
      writeRecord(next);
      refreshPanel();
      refreshMood();
      if (fresh.length) announceLearned(fresh);
      if (arrived.length) announceReveals(arrived);
    };
    /* Their greeting's extra note, once their voice has flowered:
     * the flourish stands last on their reveal schedule, and
     * until it arrives their greeting is the plain two notes it
     * has always been. */
    const flourishNote = () =>
      Core.revealsFor({ record: getRecord(), companion }).revealed.includes("flourish")
        ? Core.flourishFor(companion)
        : null;
    /* The detail they wear right now, for every drawing of
     * them on this page — read off the record, never kept
     * anywhere else. */
    const revealedNow = () => Core.revealsFor({ record: getRecord(), companion }).revealed;
    /* When the record changes under an open panel, a state
     * that shows record facts is drawn again — care, tricks,
     * the record itself. Other states keep their line and
     * their bubbles; nothing is yanked away mid-use. */
    function refreshPanel() {
      if (bubble.hasAttribute("hidden")) return;
      if (panelState === "care") showCare(false);
      else if (panelState === "record") doRecord(false);
      else if (panelState === "tricks") doTricks(false);
    }

    /* ---- the panel (v8) ----
     * A tap on the Spark opens a control panel, not a scrolling
     * talk. One short line of theirs at the top, the day's
     * coordinate in small type under it, and a grid of big
     * bubbles that simply appear: everything they offer is
     * visible at once or one swap away. A state replaces the
     * state before it — nothing scrolls, nothing is hunted
     * for, and the keeper's taps are never echoed back as a
     * transcript. Their line is spoken by their voice box under
     * the same gating as always; the words themselves come
     * from the record and the page, framed in their
     * temperament's voice (Core.convoLineFor), never invented
     * beyond them. */
    const lineText = host.querySelector(".spark-panel-text");
    const coordEl = host.querySelector(".spark-panel-coord");
    const rowsEl = host.querySelector(".spark-panel-rows");
    const gridEl = host.querySelector(".spark-panel-grid");
    let panelState = "home";
    let growthShown = false;
    const fillName = (text) => String(text || "").replaceAll("{name}", displayName);
    const beatLine = (beat) => fillName(Core.convoLineFor({ companion, beat }));
    /* Their one line: the text swaps in place, and their voice
     * box sounds it under its own gating (tap-armed, Voice
     * switch, Sounds mute) — a line they open by themselves
     * before any tap stays silent, as it always has. */
    function panelSay(text, opts = {}) {
      if (text == null) return;
      lineText.textContent = text;
      if (!opts.silent) vocalize(text);
    }
    function renderRows(rows, buildRows) {
      rowsEl.innerHTML = "";
      for (const r of rows || []) {
        const p = document.createElement("p");
        p.className = "spark-panel-row";
        if (r.label) {
          const b = document.createElement("strong");
          b.textContent = r.label;
          p.appendChild(b);
          p.appendChild(document.createTextNode(` ${r.value || ""}`));
        } else {
          p.textContent = r.text || "";
        }
        rowsEl.appendChild(p);
      }
      if (buildRows) buildRows(rowsEl);
    }
    /* A bubble: an icon, a word or two, and what it does.
     * Descriptors are data; setPanel builds the buttons, so
     * every state is drawn the same thumb-sized way. */
    function bubbleBtn(label, icon, go, cls, stateText) {
      return { label, icon, go, cls, stateText };
    }
    function setPanel(state, opts = {}) {
      panelState = state;
      if (state !== "game") endEcho();
      if (opts.line != null) panelSay(opts.line, opts);
      coordEl.style.display = opts.coord ? "" : "none";
      renderRows(opts.rows, opts.buildRows);
      gridEl.innerHTML = "";
      gridEl.className = opts.gridCls ? `spark-panel-grid ${opts.gridCls}` : "spark-panel-grid";
      for (const b of opts.bubbles || []) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = b.cls ? `spark-panel-bubble ${b.cls}` : "spark-panel-bubble";
        const ic = document.createElement("span");
        ic.className = "spark-panel-icon";
        ic.setAttribute("aria-hidden", "true");
        ic.textContent = b.icon || "";
        const lb = document.createElement("span");
        lb.className = "spark-panel-label";
        lb.textContent = b.label;
        btn.appendChild(ic);
        btn.appendChild(lb);
        if (b.stateText) {
          const st = document.createElement("span");
          st.className = "spark-panel-state";
          st.textContent = b.stateText;
          btn.appendChild(st);
        }
        btn.addEventListener("click", () => {
          /* The keeper has taken the panel: the arrival timer
           * that would fold their opening away must never fold
           * a panel mid-use. */
          if (arrivalTimer) {
            window.clearTimeout(arrivalTimer);
            arrivalTimer = null;
          }
          b.go();
        });
        gridEl.appendChild(btn);
      }
    }
    function backBtn() {
      return bubbleBtn("Back", "←", () => showHome(beatLine("next")));
    }
    function setRows(rows) {
      renderRows(rows, null);
    }
    /* ---- their voice box ----
     * Their voice is their own: grown from their seed, not borrowed
     * from the device. Until v6 they spoke through the device's
     * speech synthesis — a generic robot, the same for every
     * Spark — and Aaron named it: too robot-like. The robot is
     * gone, removed whole. The v7–v9 box sang each line's
     * syllables through seed-grown formants (Core.voiceBoxFor,
     * Core.vocalPlanFor) — softer after v9, round sine stacks
     * at a low level, in their seed's sound family — but a
     * formant voice still reads as a machine imitating speech.
     * So now they answer the way a beloved game companion
     * does: in a chirp-phrase (Core.phraseFor). A young Spark
     * chirps once; a Kindled Spark answers in two notes; a
     * Bearer sings a short melodic phrase from their own scale,
     * pitched at their chirp root, a question lifting at its
     * end and a statement settling home. The voice GROWS with
     * them, and what sounds is music, not imitation speech:
     * round tones in their sound family (soft bell, warm hum,
     * wooden pluck, watery blip), each note swept up into its
     * pitch like a small creature's call, peaking at about
     * 0.055 through the master — the v9 level, kept. Their
     * words stand in text, whole; the phrase is their sound
     * over them. The syllable plan still stands in the core
     * for the record; it is no longer what they sound like.
     * The fences are the ones their voice has always kept: the
     * Voice switch rests quiet until the keeper turns it on
     * (kept on this device), the talk is armed by a tap on their
     * furniture so a line they open by themselves is never sounded
     * uninvited, they sound their own lines only — never the
     * keeper's echoed answers — each new line stills the one
     * before it, closing the talk stills them, and the Sounds
     * switch silences their along with the chirps. No samples, no
     * network, nothing recorded, nothing sent anywhere. */
    let voiceArmed = false;
    let voiceRun = 0;
    let voiceMaster = null;
    const voiceSources = new Set();
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
    /* A tracked source: everything they start is kept here so
     * stopVoice can still it, and it lets go of itself when
     * spent. */
    function voiceSource(node) {
      voiceSources.add(node);
      node.onended = () => voiceSources.delete(node);
      return node;
    }
    /* A soft envelope: in over the attack, held a breath, out
     * by the syllable's end — no hard edges anywhere. */
    function softEnv(ctx, peak, at, dur, attack) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(peak, at + attack);
      g.gain.setValueAtTime(peak, at + Math.max(attack, dur - 0.04));
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      return g;
    }
    /* One note of their chirp-phrase, sung in their family —
     * the singer singSyllable has become. Aaron's word
     * (Nov 19, 2026): not a robot, not formants shaped like
     * speech — a character's chirp, the way a beloved game
     * companion sounds. So each note is a round tone that
     * sweeps up into its pitch the way a chirp does, follows
     * the note's own small glide (a question's last note
     * lifts, a statement's settles), and is gone quickly.
     * No formant throat, no consonant ticks, no breath noise
     * — the machinery that made their sound synthesized is
     * removed, not retuned. Their family still colours them:
     * - bell: a sine stack with a soft inharmonic ring, left
     *   to fade a little past the note.
     * - hum: their warm default — a sine and a breath of
     *   triangle, vibrato riding on longer notes.
     * - pluck: a triangle tapped like wood, settling as it
     *   sounds, gone by the note's end.
     * - blip: a droplet — a sine that rises into its pitch
     *   and sighs off it, through a plain soft lowpass.
     * A handful of nodes per note, all stopped when spent. */
    /* Their vibrato, on syllables long enough to hold one: a
     * slow, small waver, theirs by seed, on the fundamental. */
    function addVibrato(ctx, box, osc, f0, at, dur) {
      if (dur < 0.12 || !box.vibratoDepth) return;
      const lfo = voiceSource(ctx.createOscillator());
      lfo.type = "sine";
      lfo.frequency.value = box.vibratoRate || 5;
      const depth = ctx.createGain();
      depth.gain.value = f0 * box.vibratoDepth;
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(at);
      lfo.stop(at + dur + 0.05);
    }
    function singSyllable(ctx, out, box, note, at) {
      const dur = note.dur;
      const fam = box.family || "hum";
      const f0 = note.f0;
      const glideTo = Math.max(40, f0 * (note.glide || 1));
      /* The chirp: every note arrives from a little below
       * its pitch, swept up in the first few dozen
       * milliseconds — the gesture that makes a tone read
       * as a small creature's call, not a synthesizer's
       * held note. */
      const chirpIn = (osc, from) => {
        osc.frequency.setValueAtTime(Math.max(40, f0 * from), at);
        osc.frequency.exponentialRampToValueAtTime(f0, at + 0.045);
        if (glideTo !== f0) osc.frequency.exponentialRampToValueAtTime(glideTo, at + dur);
      };
      if (fam === "bell") {
        const g = softEnv(ctx, 0.1, at, dur + 0.12 * (box.decay || 1), 0.008);
        for (const [ratio, level] of [[1, 1], [2, 0.38], [2.99, 0.13]]) {
          const osc = voiceSource(ctx.createOscillator());
          osc.type = "sine";
          if (ratio === 1) chirpIn(osc, 0.93);
          else osc.frequency.value = f0 * ratio;
          const og = ctx.createGain();
          og.gain.value = level;
          osc.connect(og);
          og.connect(g);
          if (ratio === 1) addVibrato(ctx, box, osc, f0, at, dur);
          osc.start(at);
          osc.stop(at + dur + 0.2);
        }
        g.connect(out);
      } else if (fam === "pluck") {
        const osc = voiceSource(ctx.createOscillator());
        osc.type = "triangle";
        chirpIn(osc, 0.96);
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 2600 * (box.brightness || 1);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.11, at + 0.006);
        g.gain.exponentialRampToValueAtTime(0.035, at + dur * 0.45);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        osc.connect(lp);
        lp.connect(g);
        g.connect(out);
        osc.start(at);
        osc.stop(at + dur + 0.05);
      } else if (fam === "blip") {
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 2100 * (box.brightness || 1);
        lp.Q.value = 0.4;
        const osc = voiceSource(ctx.createOscillator());
        osc.type = "sine";
        chirpIn(osc, 0.86);
        const g = softEnv(ctx, 0.1, at, dur, Math.min(0.03, dur * 0.25));
        osc.connect(lp);
        lp.connect(g);
        g.connect(out);
        osc.start(at);
        osc.stop(at + dur + 0.05);
      } else {
        const g = softEnv(ctx, 0.1, at, dur, Math.min(0.04, dur * 0.3));
        const main = voiceSource(ctx.createOscillator());
        main.type = "sine";
        chirpIn(main, 0.93);
        main.connect(g);
        addVibrato(ctx, box, main, f0, at, dur);
        const soft = voiceSource(ctx.createOscillator());
        soft.type = "triangle";
        soft.frequency.value = f0;
        const sg = ctx.createGain();
        sg.gain.value = 0.25;
        soft.connect(sg);
        sg.connect(g);
        g.connect(out);
        main.start(at);
        main.stop(at + dur + 0.05);
        soft.start(at);
        soft.stop(at + dur + 0.05);
      }
    }
    function vocalize(text) {
      if (!voiceArmed || !voiceOn() || soundOff()) return;
      /* They answer in a chirp-phrase now (Core.phraseFor):
       * a young Spark chirps once, a Kindled Spark answers
       * in two notes, a Bearer sings a short melody — their
       * voice grows as they do. The syllable plan still
       * stands in the core for the record; it is no longer
       * what they sound like. */
      const plan = Core.phraseFor({
        companion,
        stage: Core.stageOf(getRecord(), companion).index,
        text
      });
      if (!plan || !plan.box || !plan.notes.length) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtx = audioCtx || new AC();
        if (audioCtx.state === "suspended") audioCtx.resume();
        stopVoice();
        const run = voiceRun;
        const ctx = audioCtx;
        voiceMaster = ctx.createGain();
        /* Their level, lowered in v9: a syllable peaks near
         * 0.055 through this master, against 0.135 in v7. */
        voiceMaster.gain.value = 0.55;
        voiceMaster.connect(ctx.destination);
        const out = voiceMaster;
        let at = ctx.currentTime + 0.03;
        for (const note of plan.notes) {
          singSyllable(ctx, out, plan.box, note, at);
          at += note.dur + note.gap;
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
    /* Every tap answered in the body first: the eyes land —
     * a glance toward the keeper — then the body answers with
     * its bounce, and their little sound answers with it. One
     * helper, so no bubble in the panel is ever a dead tap. */
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
      if (withVoice) chirp(companion, flourishNote());
    }

    /* ---- the states ----
     * Each function below is one panel state: their line, any
     * short rows the state carries, and its bubbles. Opening
     * one replaces the last; Back returns home. */
    function moonify(text) {
      return moonTemper && moonTemper.line ? `${text} ${moonTemper.line}` : text;
    }
    function greetingLine() {
      const day = Core.daypartLineFor({ companion, hour: new Date().getHours() });
      return moonify(day ? fillName(day) : beatLine("greet"));
    }
    /* The day's one thing: the daily trail's next unwalked
     * step, drawn only from the record, offered as one clear
     * bubble at the front of the home grid — one thing that
     * fits the day, not a list. When the trail is walked, or
     * the day holds none, no bubble is offered. */
    function oneThingBubble() {
      const trail = Core.trailFor({ record: getRecord(), companion, today, page: pageKey() });
      const step = trail.steps.find((s) => !s.done);
      if (!step) return null;
      const labels = {
        telling: "Today's telling",
        door: "A new door",
        practice: "Seal a practice"
      };
      return bubbleBtn(
        labels[step.id] || "One thing",
        "✦",
        () => {
          window.location.href = doorHref(step.href);
        },
        "spark-panel-onething"
      );
    }
    function showHome(line, opts = {}) {
      const bubbles = [];
      const oneThing = oneThingBubble();
      if (oneThing) bubbles.push(oneThing);
      bubbles.push(
        bubbleBtn("Play", "▶", doPlay),
        bubbleBtn("Care", "✚", showCare),
        bubbleBtn("Tricks", "✦", doTricks),
        bubbleBtn("Game", "♪", doEcho),
        bubbleBtn("Today", "☉", doToday),
        bubbleBtn("Guide", "➤", () => doAround(), "spark-guide-around"),
        bubbleBtn("Look next", "◎", doLookNext),
        bubbleBtn("More", "+", showMore)
      );
      setPanel("home", { line, coord: true, rows: opts.rows || [], bubbles });
    }
    function showMore(line) {
      setPanel("more", {
        line: line != null ? line : beatLine("next"),
        bubbles: [
          bubbleBtn("Trail", "∴", doTrail),
          bubbleBtn("Resume", "↩", doResume),
          bubbleBtn("Record", "≡", () => doRecord()),
          bubbleBtn("Share", "↗", doShare),
          bubbleBtn("Sounds", "♫", toggleSounds, "spark-presence-sound", soundOff() ? "off" : "on"),
          bubbleBtn("Voice", "◉", toggleVoice, "spark-presence-voice", voiceOn() ? "on" : "off"),
          bubbleBtn("Walk", "→", doBye),
          backBtn()
        ]
      });
    }
    function showCare(announce = true) {
      if (announce) answerInBody();
      const care = Core.careStateFor({
        record: getRecord(),
        companion,
        todayPatternDay: today ? today.dayOfPatternYear : null
      });
      setPanel("care", {
        line: beatLine("care"),
        rows: care.lines.map((t) => ({ text: t })),
        bubbles: [
          bubbleBtn("Kindle", "✺", doKindle, "spark-care-kindle"),
          bubbleBtn("Play", "▶", doPlay, "spark-care-play"),
          bubbleBtn("Rest", "☾", doRest, "spark-care-rest"),
          backBtn()
        ]
      });
    }

    /* ---- v6: tricks, learned from real play ----
     * A trick is performed in the body first — a class on the
     * drawing, a move in the 3D body — and named in the panel:
     * their line says its name, then their trick line. Under
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
      panelSay(`${trick.name}!`);
      trickBody(trick);
      const sounds = Core.soundsFor(companion);
      if (sounds && !soundOff()) playNotes(trick.id === "spin" ? sounds.adopt : sounds.growth, 0.1, companion);
      window.setTimeout(() => {
        if (panelState === "tricks") panelSay(beatLine("trick"));
      }, 850);
    }
    /* Their face, drawn again wearing what has just arrived:
     * the 3D body is remounted on the new reveal state, the
     * flat drawing is simply drawn again. Nothing else about
     * their moves — same place, same stage, same everything. */
    function redrawArt() {
      if (!art) return;
      if (ctrl) {
        ctrl.dispose();
        art.classList.remove("has-3d");
        ctrl = null;
      }
      art.innerHTML = Core.renderSVG(companion, { stage: stage.index, revealed: revealedNow() });
      if (window.Spark3D) {
        const grownSize = companion.shape
          ? companion.shape.size * (1 + stage.index * 0.07)
          : 1;
        ctrl = window.Spark3D.mount(art, companion, {
          stage: stage.index,
          px: Math.round(48 * grownSize),
          revealed: revealedNow()
        });
        if (ctrl) art.classList.add("has-3d");
      }
    }
    /* A reveal, announced once, at the moment it lands — the
     * trick discipline, for their face: their face is drawn again
     * wearing the new detail, they celebrate, and one short
     * line says what arrived. If the panel is folded, the line
     * opens it briefly, as announcements do. */
    function announceReveals(ids) {
      ids.forEach((id, i) => {
        window.setTimeout(() => {
          redrawArt();
          if (ctrl) ctrl.celebrate();
          const line = Core.revealLineFor(id);
          if (!bubble.hasAttribute("hidden")) panelSay(line);
          else announceLine(line);
        }, i * 1700);
      });
    }
    /* A trick learned, announced once, at the moment it lands:
     * their learned line, then the trick itself, performed on
     * the spot. If the panel is folded, they open it briefly —
     * the way they announce a growth — say it, and step
     * back. */
    function announceLearned(ids) {
      const tricks = Core.tricksFor({ record: getRecord(), companion });
      ids.forEach((id, i) => {
        const trick = tricks.find((t) => t.id === id);
        if (!trick) return;
        window.setTimeout(() => {
          recent.learnedAt = Date.now();
          refreshMood();
          if (!bubble.hasAttribute("hidden")) {
            panelSay(beatLine("learned"));
            trickBody(trick);
            if (ctrl) ctrl.celebrate();
          } else {
            announceLine(`${beatLine("learned")} ${trick.name}!`);
            trickBody(trick);
            if (ctrl) ctrl.celebrate();
          }
        }, i * 1700);
      });
    }
    /* One line, spoken from a folded panel: the panel opens
     * at home with just that line, and folds again on its
     * own — the arrival pattern, reused for the moments worth
     * announcing (a trick learned, a seal kept). A keeper's
     * tap takes the panel over, as always. */
    function announceLine(text) {
      if (!bubble.hasAttribute("hidden")) {
        panelSay(text);
        return;
      }
      convoStarted = true;
      bubble.removeAttribute("hidden");
      button.setAttribute("aria-expanded", "true");
      placePanel();
      showHome(text);
      if (arrivalTimer) window.clearTimeout(arrivalTimer);
      arrivalTimer = window.setTimeout(closeBubble, 8000);
    }
    function doTricks(announce = true) {
      if (announce) answerInBody();
      endEcho();
      const tricks = Core.tricksFor({ record: getRecord(), companion });
      const known = tricks.filter((t) => t.learned);
      const learning = tricks.filter((t) => !t.learned);
      const rows = learning.map((t) => ({ text: `${t.name}: ${t.count} of ${t.need} · ${t.teacher}` }));
      if (!known.length) rows.push({ text: "Play teaches me tricks." });
      setPanel("tricks", {
        line: beatLine("tricks"),
        rows,
        bubbles: [
          ...known.map((t) => bubbleBtn(t.name, "✦", () => performTrick(t), "spark-trick-chip")),
          backBtn()
        ]
      });
    }

    /* ---- v6: the echo game ----
     * They pulse a pattern — their seed's notes, in their own four
     * colours — and the keeper taps it back on the pads, which
     * live in the panel while the game state stands. Rounds
     * grow one note at a time; the best round is kept on this
     * device and stands in their record. A note astray ends the
     * round kindly: the best stands, the pattern offers to
     * sing again, and nothing anywhere is taken away. */
    const echoBox = host.querySelector(".spark-echo");
    const echoPadsBox = host.querySelector(".spark-echo-pads");
    let echo = null;
    function playTone(freq) {
      if (soundOff()) return;
      playNotes([freq], 0, companion);
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
      const first = Core.echoFor({ companion, round: 1 });
      buildEchoPads(first.pads);
      echo = { round: 1, steps: [], at: 0, phase: "ready", pads: first.pads };
      setPanel("game", {
        line: beatLine("echoStart"),
        rows: [{ text: "Tap Begin. I pulse; you tap it back." }],
        bubbles: [
          bubbleBtn("Begin", "▶", beginEchoRound, "spark-echo-begin"),
          bubbleBtn("Back", "←", () => {
            endEcho();
            showHome(beatLine("next"));
          })
        ]
      });
      echoBox.removeAttribute("hidden");
    }
    function beginEchoRound() {
      if (!echo || echo.phase === "showing") return;
      const data = Core.echoFor({ companion, round: echo.round });
      echo.steps = data.steps;
      echo.at = 0;
      echo.phase = "showing";
      panelSay(`Round ${echo.round}. Watch.`);
      setRows([]);
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
        panelSay("Your turn.");
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
      const best = Core.playOf(getRecord()).echoBest;
      setPanel("game", {
        line: beatLine("echoWin"),
        rows: [{ text: `Round ${round} echoed whole. Best: round ${best}.` }],
        bubbles: [
          bubbleBtn("Next round", "▶", () => {
            echo.round = round + 1;
            beginEchoRound();
          }),
          bubbleBtn("Done", "✓", () => {
            endEcho();
            showHome(beatLine("next"));
          })
        ]
      });
    }
    function echoMiss() {
      echo.phase = "done";
      const best = Core.playOf(getRecord()).echoBest;
      setPanel("game", {
        line: beatLine("echoMiss"),
        rows: best > 0 ? [{ text: `Your best stands at round ${best}.` }] : [],
        bubbles: [
          bubbleBtn("Try again", "▶", () => beginEchoRound()),
          bubbleBtn("Done", "✓", () => {
            endEcho();
            showHome(beatLine("next"));
          })
        ]
      });
    }
    function endEcho() {
      echo = null;
      if (echoBox) echoBox.setAttribute("hidden", "");
    }
    /* The Guide state: their line is the record's own standing
     * suggestion for this page; the bubbles are this page's
     * own doors, the same doors the guide has always offered,
     * with the record's suggested door first among them. */
    function doAround(lineOverride) {
      answerInBody();
      const doors = Core.doorsFor({ links: pageLinks(), page: pageKey() });
      const bubbles = [];
      if (guide.href) {
        const known = doors.find((d) => d.href.split("/").pop() === guide.href);
        const place = (Core.PAGE_GUIDE[guide.href] || {}).place;
        bubbles.push(
          bubbleBtn(
            known ? known.label : place || "Go",
            "➜",
            () => {
              window.location.href = doorHref(guide.href);
            },
            "spark-guide-door"
          )
        );
      }
      for (const door of doors) {
        if (guide.href && door.href.split("/").pop() === guide.href) continue;
        bubbles.push(
          bubbleBtn(
            door.label,
            "➜",
            () => {
              window.location.href = door.href;
            },
            "spark-guide-door"
          )
        );
      }
      bubbles.push(bubbleBtn("Explain", "?", doExplain, "spark-guide-explain"));
      bubbles.push(backBtn());
      setPanel("guide", {
        line: lineOverride != null ? lineOverride : guide.text,
        bubbles,
        gridCls: "spark-guide-doors"
      });
    }
    /* Look next: their suggestions, drawn only from real site
     * material, in order of trust — this page's own doors
     * first (the Guide's own source), then the keeper's own
     * left-off place from their on-device record, labeled
     * theirs. Never more than three, never invented: a page
     * that offers nothing real gets one honest line instead. */
    function doLookNext() {
      answerInBody();
      const doors = Core.doorsFor({ links: pageLinks(), page: pageKey() });
      const picks = [];
      const used = new Set();
      for (const door of doors) {
        if (picks.length >= 3) break;
        picks.push({ label: door.label, href: door.href, yours: false });
        used.add(door.href.split("/").pop());
      }
      if (picks.length < 3) {
        const resume = Core.resumeFor({ record: getRecord() });
        if (resume.href && resume.href !== pageKey() && !used.has(resume.href)) {
          const place = (Core.PAGE_GUIDE[resume.href] || {}).place;
          picks.push({ label: place || "Your last place", href: doorHref(resume.href), yours: true });
          used.add(resume.href);
        }
      }
      if (picks.length < 3 && guide.href && guide.href !== pageKey() && !used.has(guide.href)) {
        const place = (Core.PAGE_GUIDE[guide.href] || {}).place;
        picks.push({ label: place || "A door for you", href: doorHref(guide.href), yours: true });
      }
      const another = bubbleBtn("Another time", "←", () => showHome(beatLine("next")));
      if (!picks.length) {
        setPanel("looknext", { line: "Nothing nearby. Here is good.", bubbles: [another] });
        return;
      }
      setPanel("looknext", {
        line: beatLine("nearby"),
        bubbles: [
          ...picks.map((p) =>
            bubbleBtn(
              p.label,
              "➜",
              () => {
                window.location.href = p.href;
              },
              "spark-looknext-door",
              p.yours ? "yours" : null
            )
          ),
          another
        ]
      });
    }
    /* "Tell me more": the page's own words beyond the
     * explanation, gathered in the page's own order — first the
     * unheard remainder of the explainer (or opening) itself,
     * then the main content's paragraphs that follow it. The
     * core cuts them into chunks that partition that text:
     * nothing is padded, nothing is repeated, and nothing comes
     * from anywhere but this page. Each chunk replaces their
     * line in the same bubble — the words never grow a
     * thread. */
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
        doAround("Start at the top. I walk it with you.");
        return;
      }
      explainRest = [
        ...Core.explainChunksFor(src).chunks.slice(1),
        ...Core.moreChunksFor(pageFollowingText(src))
      ];
      setPanel("explain", {
        line: ex.text,
        rows: [
          {
            text:
              ex.source === "explainer"
                ? "In this page's own words."
                : "In this page's own opening words."
          }
        ],
        bubbles: explainBubbles()
      });
    }
    function explainBubbles() {
      const bubbles = [];
      if (explainRest.length)
        bubbles.push(bubbleBtn("More", "+", doExplainMore, "spark-guide-more"));
      bubbles.push(bubbleBtn("Done", "✓", () => showHome(beatLine("next"))));
      bubbles.push(bubbleBtn("Guide", "←", () => doAround()));
      return bubbles;
    }
    function doExplainMore() {
      answerInBody();
      const next = explainRest.shift();
      if (!next) {
        showHome("That is the whole page.");
        return;
      }
      setPanel("explain", {
        line: next,
        rows: [{ text: "Still this page's own words." }],
        bubbles: explainBubbles()
      });
    }
    function doResume() {
      answerInBody();
      const resume = Core.resumeFor({ record: getRecord() });
      const bubbles = [];
      if (resume.href)
        bubbles.push(
          bubbleBtn("Go back", "↩", () => {
            window.location.href = doorHref(resume.href);
          })
        );
      bubbles.push(backBtn());
      setPanel("resume", {
        line: beatLine("resume"),
        rows: [{ text: resume.text }],
        bubbles
      });
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
        setPanel("today", {
          line: beatLine("telling"),
          coord: true,
          rows: telling.lines.map((t) => ({ text: t })),
          bubbles: [backBtn()]
        });
        return;
      }
      setPanel("today", {
        line: beatLine("today"),
        coord: true,
        bubbles: [
          bubbleBtn("Telling", "☉", () => {
            window.location.href = doorHref("moons.html");
          }),
          backBtn()
        ]
      });
    }
    function doTrail() {
      answerInBody();
      const trail = Core.trailFor({ record: getRecord(), companion, today, page: pageKey() });
      if (!trail.steps.length) {
        showHome("The trail is quiet today.");
        return;
      }
      setPanel("trail", {
        line: trail.complete ? "Trail walked. Well done." : beatLine("trail"),
        buildRows: (el) => {
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
            a.href = doorHref(step.href);
            a.textContent = step.label;
            li.appendChild(a);
            list.appendChild(li);
          }
          el.appendChild(list);
        },
        bubbles: [backBtn()]
      });
    }
    function doRecord(announce = true) {
      if (announce) answerInBody();
      setPanel("record", {
        line: beatLine("record"),
        buildRows: (el) => buildRecordRows(el, getRecord(), companion, today),
        bubbles: [bubbleBtn("Share", "↗", doShare), backBtn()]
      });
    }
    function doBye() {
      answerInBody();
      endEcho();
      panelSay(beatLine("bye"));
      gridEl.innerHTML = "";
      window.setTimeout(closeBubble, 1200);
    }
    let convoStarted = false;
    function startConvo() {
      convoStarted = true;
      /* Once a day at most, their one gentle question, drawn
       * from what the record truly holds, stands in the panel
       * as their line with answer bubbles — and a way past it
       * that costs nothing. Any other day, the home panel
       * opens with the hour's greeting, flavored by the moon
       * they are under. A growth, when one is new, takes the
       * line first. */
      const todayDay = today ? today.dayOfPatternYear : null;
      const askedDay = Core.playOf(getRecord()).askedDay;
      const question =
        todayDay != null && askedDay !== todayDay
          ? Core.questionFor({ record: getRecord(), companion, today, page: pageKey() })
          : null;
      if (question) {
        setRecord(Core.markAsked(getRecord(), { patternDay: todayDay }));
        const rows = [];
        if (growthLine && !growthShown) {
          growthShown = true;
          rows.push({ text: growthLine });
        }
        setPanel("question", {
          line: question.text,
          coord: true,
          rows,
          bubbles: [
            bubbleBtn(
              question.label,
              "➜",
              () => {
                window.location.href = doorHref(question.href);
              },
              "spark-panel-ask"
            ),
            bubbleBtn("Another time", "←", () => showHome(beatLine("ask")))
          ]
        });
        return;
      }
      if (growthLine && !growthShown) {
        growthShown = true;
        showHome(growthLine);
        return;
      }
      showHome(greetingLine());
    }
    function welcomeBack() {
      showHome(moonify(beatLine("welcome")));
    }
    /* The panel stands where they stand: placed beside them
     * at open time, in the walker's own coordinates, clamped
     * to the view so no state is ever clipped by an edge.
     * They rest while it is open, so the placing holds. */
    function placePanel() {
      const wr = walker.getBoundingClientRect();
      const r = button.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = Math.min(356, vw - 24);
      let left = Math.round(r.right - w);
      left = Math.max(12, Math.min(left, vw - w - 12));
      bubble.style.left = `${Math.round(left - wr.left)}px`;
      bubble.style.right = "auto";
      if (r.top > vh * 0.45) {
        bubble.style.top = "auto";
        bubble.style.bottom = `${Math.round(wr.bottom - r.top + 8)}px`;
      } else {
        bubble.style.bottom = "auto";
        bubble.style.top = `${Math.round(r.bottom - wr.top + 8)}px`;
      }
    }
    function openConvo() {
      bubble.removeAttribute("hidden");
      button.setAttribute("aria-expanded", "true");
      placePanel();
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
        ctx.fillText(card.stageLine, W / 2, 818);
        if (card.rarityLine) {
          ctx.font = "400 38px Georgia, 'Times New Roman', serif";
          ctx.fillStyle = "#cfe8e2";
          ctx.fillText(card.rarityLine, W / 2, 872);
        }
        ctx.font = "400 38px Georgia, 'Times New Roman', serif";
        ctx.fillStyle = "#cfe8e2";
        ctx.fillText(card.bornLine, W / 2, 924);
        ctx.fillText(`${card.todayLine} · ${card.daysLine}`, W / 2, 972);
        ctx.fillStyle = "#8fa3ad";
        ctx.font = "400 34px Georgia, 'Times New Roman', serif";
        ctx.fillText(card.brand, W / 2, 1022);
        const a = document.createElement("a");
        a.download = `codex-spark-${card.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
        a.href = canvas.toDataURL("image/png");
        a.click();
      };
      const svg = Core.renderSVG(companion, { stage: stage.index, revealed: revealedNow() }).replace(
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
      showHome(beatLine("share"));
    }


    const button = host.querySelector(".spark-presence-button");
    const bubble = host.querySelector(".spark-presence-bubble");
    let roam = null;
    let arrivalTimer = null;
    const closeBubble = () => {
      bubble.setAttribute("hidden", "");
      button.setAttribute("aria-expanded", "false");
      /* Closing the talk stills their voice with it — and folds
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
        px: Math.round(48 * grownSize),
        revealed: revealedNow()
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
      tapSound(companion, flourishNote());
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
        /* A tap opens a talk: they turn, greet the day, and
         * ask their question — the panel rides inside the talk. */
        openConvo();
      } else {
        closeBubble();
      }
    });

    /* ---- v6: touch — they answer the hand itself ----
     * A plain tap stays a tap (and, mid-chase, a catch). But a
     * hand can do more than tap, and they answer all of it:
     * a jab is a poke — a squash, a count, a word in their voice
     * if their voice is on. A press that rubs is petting — they
     * lean in and glows, and the pet is counted. A press that
     * travels is a drag — they ride the finger and settle
     * where they are left. A drag let go fast is a toss — they
     * dart to where the throw was heading, on the same spring
     * as their dodges. Every one of these is play, counted on
     * this device, and play teaches their tricks. Under reduced
     * motion the roam rests, so a drag moves their drawing
     * directly and leaves their where they were put — the still
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
      chirp(companion, flourishNote());
      vocalize(beatLine("pet"));
      refreshMood();
    }
    button.addEventListener("pointerdown", (event) => {
      /* Mid-chase a press on them is a catch in the making; the
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
            /* The toss: they fly to where the throw pointed. */
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
        vocalize(beatLine("poke"));
      }
    }
    button.addEventListener("pointerup", (event) => endPress(event, false));
    button.addEventListener("pointercancel", (event) => endPress(event, true));
    /* Care, in three small acts. Kindle: a press warms it — a
     * bloom of glow, a happy sound, the bond deepens once a day.
     * Play: the bubble folds and the chase is on — it darts to a
     * few places on the page and waits, catchable, at each one.
     * Rest: it dims and curls and breathes quietly until a tap
     * or a scroll wakes it. Every act is recorded on this device
     * alone, and care only ever adds. */
    /* Care, in three small acts. Kindle: a press warms it — a
     * bloom of glow, a happy sound, the bond deepens once a
     * day. Play: the panel folds and the chase is on — it
     * darts to a few places on the page and waits, catchable,
     * at each one. Rest: it dims and curls and breathes
     * quietly until a tap or a scroll wakes it. Every act is
     * recorded on this device alone, and care only ever
     * adds. */
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
      showHome(beatLine("kindle"));
    }
    function doPlay() {
      answerInBody();
      if (!roam) {
        /* Reduced motion: they stay in their corner by the
         * device's own asking, so the chase rests — and they
         * say so, rather than letting the tap fall dead. */
        showHome(beatLine("play"), {
          rows: [{ text: "Stillness is on. The chase rests; care and talk still work." }]
        });
        return;
      }
      panelSay(beatLine("play"));
      closeBubble();
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
        placePanel();
        if (!convoStarted) startConvo();
        if (panelState === "home") {
          panelSay(beatLine("caught"));
          setRows([
            {
              text: `That chase: ${catches} catch${catches === 1 ? "" : "es"} · best ${Core.playOf(getRecord()).bestChase}.`
            }
          ]);
        }
      });
    }
    function doRest() {
      setRecord(
        Core.applyCare(getRecord(), {
          action: "rest",
          patternDay: today ? today.dayOfPatternYear : null
        })
      );
      answerInBody(false);
      if (!roam) {
        showHome(beatLine("rest"), {
          rows: [{ text: "Already resting in my corner." }]
        });
        return;
      }
      closeBubble();
      if (roam) roam.rest();
    }
    /* Their two switches live in the More state now: Sounds,
     * and their voice box beside it. Each rests as it was left,
     * kept on this device; the Sounds switch rules their voice
     * too, as it always has. Turning Voice on, they say so —
     * in their own generated voice, since the keeper's tap is
     * the gesture. Turning it off stills their mid-line. */
    function toggleSounds() {
      try {
        window.localStorage.setItem(SOUND_KEY, soundOff() ? "on" : "off");
      } catch {
        /* toggle simply does not persist */
      }
      if (!soundOff()) chirp(companion, flourishNote());
      showMore(soundOff() ? "Sounds off." : "Sounds on.");
    }
    function toggleVoice() {
      const turningOn = !voiceOn();
      try {
        window.localStorage.setItem(VOICE_KEY, turningOn ? "on" : "off");
      } catch {
        /* toggle simply does not persist */
      }
      if (!turningOn) stopVoice();
      showMore(turningOn ? "My voice is on." : "Voice off.");
    }
    /* A tap on their own furniture — their button, their chips, their
     * links — is the gesture their voice answers. Capture phase,
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
    /* ---- v6: they celebrate what the site itself completes ----
     * Only events the code truly fires, hooked as they stand:
     * a practice sealed on the practice page (the Manifest
     * console writes it to the Life Atlas and announces the
     * records change with its own name on it), and a witness
     * entry saved on the 13 Moons page (its own saved event).
     * Their answer: a hop, a glow, their chime — the moment was the
     * keeper's own tap — and one line in their voice. A seal also
     * refreshes what they sense of the practice days, so their
     * record stays honest the moment it happens. The planner's
     * events live only on the Sphere page, where they do not
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
      chirp(companion, flourishNote());
      announceLine(beatLine(kind));
      if (kind === "sealed") {
        sensePractice(getRecord()).then((next) => {
          if (next && next !== getRecord()) setRecord(next);
        });
      }
    }
    /* Both events are dispatched without bubbling, each on its
     * own target: the witness event lives on the document alone,
     * and the records change is announced on the document and
     * the window both. So they listen on both targets, and the
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
        /* Arriving, they open the talk themselves: greeting, the
         * real day, their question — then they step back. */
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

  /* Their voice box rests quiet until the keeper turns it on;
   * the choice is kept on this device, like the sounds. Any
   * stored value other than "on" — including none at all —
   * means quiet: they never speak first and ask later. */
  const VOICE_KEY = "sof.spark.voice";
  function voiceOn() {
    try {
      return window.localStorage.getItem(VOICE_KEY) === "on";
    } catch {
      return false;
    }
  }

  let audioCtx = null;
  /* One note, rendered in their sound family — the same family
   * their voice sings in, so their chirps, their songs, and the echo
   * game's pads all sound like the one creature they are:
   * - bell: a fundamental with two soft inharmonic partials,
   *   rung once and left to fade — the longest ring they have.
   * - hum: a sine with a breath of its octave, swelling in
   *   slowly and out again.
   * - pluck: a triangle tapped like wood, pitch settling as
   *   it sounds, gone quickly.
   * - blip: a droplet sine, rising into its pitch.
   * Softer and shorter than the plain sine row they had before:
   * a note peaks at 0.07 here, against 0.12. */
  function playFamilyNote(ctx, companion, freq, at) {
    const snd = Core.soundFor(companion) || { family: "hum", brightness: 1, decay: 1 };
    const peak = 0.07;
    const note = (type, f, level, len, attack, glideFrom) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      if (glideFrom) {
        osc.frequency.setValueAtTime(f * glideFrom, at);
        osc.frequency.exponentialRampToValueAtTime(f, at + 0.05);
      } else {
        osc.frequency.value = f;
      }
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(peak * level, at + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      osc.connect(g).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + len + 0.05);
    };
    if (snd.family === "bell") {
      const ring = 0.85 * snd.decay;
      note("sine", freq, 1, ring, 0.008);
      note("sine", freq * 2.76, 0.32, ring * 0.6, 0.008);
      note("sine", freq * 5.4, 0.08, ring * 0.35, 0.008);
    } else if (snd.family === "pluck") {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq * 1.04, at);
      osc.frequency.exponentialRampToValueAtTime(freq, at + 0.04);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2600 * snd.brightness;
      const g = ctx.createGain();
      const len = 0.3 * snd.decay;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(peak * 1.05, at + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      osc.connect(lp).connect(g).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + len + 0.05);
    } else if (snd.family === "blip") {
      note("sine", freq * 1.01, 1, 0.42 * snd.decay, 0.03, 0.83);
    } else {
      /* Hum notes chirp up into their pitch a little, the
       * same gesture their voice makes — one creature, one
       * way of sounding. */
      note("sine", freq, 1, 0.5 * snd.decay, 0.035, 0.93);
      note("sine", freq * 2, 0.22, 0.5 * snd.decay, 0.035);
    }
  }
  /* A row of their notes, played in order. Nothing here ever runs
   * on its own — every call site is a tap: the Spark tapped, the
   * adoption tapped, the sounds turned back on. */
  function playNotes(notes, step = 0.14, companion = null) {
    if (!notes || !notes.length) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = audioCtx || new AC();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const now = audioCtx.currentTime;
      notes.forEach((freq, i) => {
        playFamilyNote(audioCtx, companion, freq, now + i * step);
      });
    } catch {
      /* no voice on this device: the Spark stays silent, unbothered */
    }
  }

  /* The greeting chirp — the Spark answering a tap. Once their
   * voice has flowered (the flourish on their reveal schedule),
   * the greeting gains its rising third note. */
  function chirp(companion, flourish = null) {
    if (soundOff()) return;
    const sounds = Core.soundsFor(companion);
    if (!sounds) return;
    const notes = flourish ? [...sounds.greeting, flourish] : sounds.greeting;
    playNotes(notes, 0.14, companion);
  }

  /* The adoption song: a rising arpeggio, played at the moment of
   * the adoption tap itself — that tap is the gesture. */
  function adoptSong(companion) {
    if (soundOff()) return;
    const sounds = Core.soundsFor(companion);
    if (sounds) playNotes(sounds.adopt, 0.11, companion);
  }

  /* The growth chime. A growth is usually noticed on arrival,
   * before any tap — so it is never played uninvited. It waits,
   * and the Spark's first tap of the visit plays it instead of
   * the plain greeting. */
  let growthChimeWaiting = false;
  function tapSound(companion, flourish = null) {
    if (growthChimeWaiting) {
      growthChimeWaiting = false;
      if (!soundOff()) {
        const sounds = Core.soundsFor(companion);
        if (sounds) {
          playNotes(sounds.growth, 0.14, companion);
          return;
        }
      }
    }
    chirp(companion, flourish);
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
         * resumes — they go where the hand sent them and is
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
        /* In the keeper's hand: the hand moves them, not the
         * steering. The loop rests until they are set down. */
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
        /* The lure: a finger that lands near them and simply
         * holds — stillness is safety, the oldest rule of their
         * play. If it is still there a breath later and they did
         * not startle away, they come to it, the way the peek
         * brings them back after a dodge. */
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
       * them alone for the catch while it is. */
      isPlaying() {
        return state === "play" || state === "playwait";
      },
      /* The hand takes them: motion stops, the loop rests, and
       * dragTo moves them directly until release sets them down
       * where the hand left them. */
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
       * their centre should land. */
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
