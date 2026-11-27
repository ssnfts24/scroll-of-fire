"use strict";

/*
 * The Spark's tours (Aaron, Nov 26, 2026 — corrected in his
 * own words at 16:13, after the first build put a guide's
 * walk before the meeting):
 *
 *   1. "After you enter the first page. First time. You
 *      should be offered to adopt one." Adoption comes
 *      FIRST. The meeting itself — the presence's pop-up,
 *      or the companions page — is the offer, and this
 *      module runs no tour at all for a visitor who has no
 *      Spark. There is no guide walk before the meeting.
 *   2. "After adopting the Spark, in an animated way [it]
 *      offers a tour and then gives a quick tour." The
 *      moment a record stands where none stood, the keeper's
 *      OWN Spark arrives animated — with the gait its seed
 *      grew — and offers the tour. One tap, and it gives a
 *      QUICK tour: six short stops, skippable throughout.
 *   3. "Then each page besides the sphere stage should have
 *      a guided tour by the Spark" — and the Sphere stage
 *      has one too, named separately because it is the
 *      centrepiece. Every page the Spark walks carries a
 *      short guided tour of that room: the Spark offers it,
 *      the keeper's tap starts it, and the Tour button calls
 *      it back at any time. The Sphere's tour rides this
 *      overlay alone — no protected Sphere file is touched.
 *   4. "The Spark should animate in different ways and give
 *      a tour [of] what the Spark does." The stops are the
 *      Spark's own abilities, demonstrated: it speaks in its
 *      seed voice (words always on screen), reads the day,
 *      travels, lights a day, sounds a card, tends, points
 *      without words, breathes, hums — a different animation
 *      at different stops, because the animation IS the
 *      demonstration.
 *
 * This module never creates or alters a Spark record; the
 * meeting is not its business. Its marks are its own: the
 * introductory's seen/offered flags, and one seen/rest mark
 * per page tour.
 */
(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const Core = window.SparkCompanion;
  if (!Core) return;

  const INTRO_KEY = "sof.spark.intro.v1";
  const TOURS_KEY = "sof.spark.tours.v1";
  const PAGE_REST_MS = 28 * 24 * 60 * 60 * 1000; // a "not now" rests a Moon

  function pageKey() {
    const path = window.location.pathname.replace(/\/+$/, "");
    const last = path.split("/").pop() || "index.html";
    return last === "" ? "index.html" : last;
  }

  function scriptBase() {
    const el = document.querySelector('script[src*="spark-intro.js"]');
    if (el && el.src) return el.src.split("spark-intro.js")[0];
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

  /* ---- the introductory's own marks ---- */
  function introFlags() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(INTRO_KEY) || "null");
      if (!raw) return { keeper: false, offered: false };
      /* The first build's single mark ({ seen: true }) and its
       * guide/keeper split both read the same way here: the
       * keeper's walk was seen. Nobody already walked is ever
       * toured twice. */
      return { keeper: !!(raw.keeper || raw.seen), offered: !!raw.offered };
    } catch {
      return { keeper: false, offered: false };
    }
  }

  function writeIntroFlags(patch) {
    try {
      const flags = { ...introFlags(), ...patch, at: Date.now() };
      window.localStorage.setItem(INTRO_KEY, JSON.stringify(flags));
    } catch { /* the marks rest */ }
  }

  /* ---- one seen/rest mark per page tour ---- */
  function tourMarks() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(TOURS_KEY) || "null");
      return raw && raw.pages ? raw.pages : {};
    } catch {
      return {};
    }
  }

  function writeTourMark(page, patch) {
    try {
      const pages = tourMarks();
      pages[page] = { ...(pages[page] || {}), ...patch };
      window.localStorage.setItem(TOURS_KEY, JSON.stringify({ pages }));
    } catch { /* the marks rest */ }
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

  async function ensureCalendar() {
    if (todayCoordinate()) return true;
    const base = scriptBase();
    const files = [
      "calendar/pattern-calendar-version.js?v=20260722-4",
      "calendar/pattern-calendar-data.js?v=20260722-4",
      "calendar/pattern-calendar-format.js?v=20260722-4",
      "calendar/pattern-calendar-boundary.js?v=20260722-4",
      "calendar/pattern-calendar.js?v=20260722-4"
    ];
    try {
      for (const f of files) await loadScript(base + f);
      return !!todayCoordinate();
    } catch {
      return false;
    }
  }

  /* ---- the voice: the Spark speaks in its seed voice ---- */
  async function ensureVoice() {
    if (window.SparkVoice) return true;
    try {
      await loadScript(scriptBase() + "spark-voice.js?v=20261126-1");
      return !!window.SparkVoice;
    } catch {
      return false;
    }
  }

  function speak(companion, text) {
    try {
      if (!window.speechSynthesis || !window.SparkVoice) return;
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      const profile = window.SparkVoice.profileFor({
        seed: companion.seed,
        temperament: companion.temperament,
        voices
      });
      if (!profile) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voice = voices.find((v) => v.voiceURI === profile.voiceURI || v.name === profile.voiceName);
      if (voice) u.voice = voice;
      u.pitch = profile.pitch;
      u.rate = profile.rate;
      window.speechSynthesis.speak(u);
    } catch { /* the words are on screen regardless */ }
  }

  function stopSpeaking() {
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch { /* rests */ }
  }

  /* ---- a small tone, for the card scene ---- */
  function tone(hz, seconds) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || !hz) return;
    try {
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + seconds);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + seconds + 0.05);
    } catch { /* the card rests */ }
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  /* The meeting owns the screen while it stands (Aaron's
   * ruling, Nov 19, 2026): no tour ever stacks over it. A
   * manual start first puts the meeting gently aside the
   * meeting's own way — its "Not now", so the same Spark waits
   * on as an ember — and while a meeting is mid-celebration
   * (an adoption being named), the tour waits for the meeting
   * to finish before it takes the screen. */
  async function yieldToMeeting() {
    const meeting = document.querySelector(".spark-encounter");
    if (!meeting) return true;
    if (!meeting.classList.contains("is-celebrating")) {
      const later = meeting.querySelector(".spark-encounter-later");
      if (later) later.click();
    }
    const deadline = Date.now() + 20000;
    while (document.querySelector(".spark-encounter") && Date.now() < deadline) {
      await sleep(250);
    }
    return !document.querySelector(".spark-encounter");
  }

  function keeperFigure(record, companion, opts) {
    return Core.renderSVG(companion, {
      stage: Core.stageOf(record, companion).index,
      revealed: Core.revealsFor({ record, companion }).revealed,
      wrap: Core.wrapFor(record),
      ...(opts || {})
    });
  }

  /* ============ THE QUICK TOUR (the introductory) ============ */

  function sphereSceneSVG(litDay) {
    let moons = "";
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * Math.PI * 2 - Math.PI / 2;
      moons += `<circle cx="${(90 + 74 * Math.cos(a)).toFixed(1)}" cy="${(90 + 74 * Math.sin(a)).toFixed(1)}" r="4.5" fill="#39415e"/>`;
    }
    let days = "";
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 - Math.PI / 2;
      const lit = i + 1 === litDay;
      days += `<circle cx="${(90 + 52 * Math.cos(a)).toFixed(1)}" cy="${(90 + 52 * Math.sin(a)).toFixed(1)}" r="${lit ? 5 : 2.6}" fill="${lit ? "#f3c97a" : "#59617c"}"${lit ? ' class="tour-lit-day"' : ""}/>`;
    }
    return `<svg viewBox="0 0 180 180" role="img" aria-label="The Sphere, with one day lit">
      <circle cx="90" cy="90" r="86" fill="#0b1026"/>
      <circle cx="90" cy="90" r="63" fill="none" stroke="#2a3342"/>
      ${moons}${days}
      <circle cx="90" cy="90" r="17" fill="#141021" stroke="#d99545"/>
    </svg>`;
  }

  /* Six stops. Quick means quick. Each stop is one of the
   * Spark's abilities, done — and the figure animates a
   * different way at each, because the animation is the
   * demonstration: it speaks, it points, it travels, it
   * delights, it breathes, it kindles. */
  function quickScenes(record, companion, today) {
    const name = Core.displayName(record, companion);
    const scenes = [
      {
        pos: "pos-center", anim: "speak", who: name, speak: true,
        text: `I am ${name}, your Spark. This is my voice — it grows from my seed, so it is mine on every device that ever carries me, and no other Spark sounds quite like me.`
      },
      {
        pos: "pos-left", anim: "point", who: name, visual: "day",
        text: today && today.moon != null
          ? `You are standing in Moon ${today.moon} · Day ${today.day} — Pattern Day ${today.dayOfPatternYear}. I read the day from the same calendar the whole house keeps, so I always know where we are standing.`
          : `I read the day from the same calendar the whole house keeps, so I always know where we are standing.`
      },
      {
        pos: "pos-right", anim: "travel", who: name, visual: "sphere",
        text: `And I travel — across this screen, across the site, and onto your phone when the door is open, and I am still me. This is the Sphere: every day of the year standing in its ring. Watch — I light the day we are standing in.`
      },
      {
        pos: "pos-left", anim: "delight", who: name, visual: "card",
        text: `Cards are found by doing the work, and each one sounds its own tone. Hear this one — that is the Moon it belongs to, sounding.`
      },
      {
        pos: "pos-right", anim: "breathe", who: name, visual: "home",
        text: `I have a home — Their Home, and the Hearth — and shelves of things I can wear and carry. What I wear, you will see me wearing, here and everywhere.`
      },
      {
        pos: "pos-center", anim: "kindle", who: name, visual: "road", final: true,
        text: `Down the road, honestly labelled: Spark. Living Day, my app, is on its way. SPARK! Wake the World, the game, is on its way. PayBack, the first Living Tool, is on its way. Nothing here pretends to be more than it is. That is the shape of it — I will be in the rooms you walk, quiet until something matters.`
      }
    ];
    return scenes;
  }

  let tourStarting = false;

  async function startQuickTour() {
    if (tourStarting || document.querySelector(".spark-tour, .spark-page-tour")) return;
    tourStarting = true;
    try {
      if (!(await yieldToMeeting())) return;
      const record = readRecord();
      if (!record) { bringMeeting(); return; }
      if (document.querySelector(".spark-tour, .spark-page-tour")) return;
      await runQuickTour(record);
    } finally {
      tourStarting = false;
    }
  }

  async function runQuickTour(record) {
    await ensureCalendar();
    await ensureVoice();
    const companion = Core.generate(record.seed);
    if (!companion) return;
    const today = todayCoordinate();
    const name = Core.displayName(record, companion);
    const scenes = quickScenes(record, companion, today);

    const overlay = document.createElement("div");
    overlay.className = "spark-tour";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "Your Spark's quick tour");
    overlay.innerHTML =
      `<div class="spark-tour-card">
        <div class="spark-tour-scroll">
          <div class="spark-tour-stage">
            <div class="spark-tour-visual" hidden></div>
            <div class="spark-tour-figure pos-center"></div>
          </div>
          <p class="spark-tour-who"></p>
          <p class="spark-tour-text" aria-live="polite"></p>
          <div class="spark-tour-dots" aria-hidden="true"></div>
        </div>
        <div class="spark-tour-actions">
          <button type="button" class="spark-tour-skip">Skip</button>
          <span class="spark-tour-nav">
            <button type="button" class="spark-tour-back">Back</button>
            <button type="button" class="spark-tour-next">Next</button>
          </span>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.body.classList.add("spark-tour-open");

    const figureEl = overlay.querySelector(".spark-tour-figure");
    const visualEl = overlay.querySelector(".spark-tour-visual");
    const whoEl = overlay.querySelector(".spark-tour-who");
    const textEl = overlay.querySelector(".spark-tour-text");
    const dotsEl = overlay.querySelector(".spark-tour-dots");
    const nextBtn = overlay.querySelector(".spark-tour-next");
    const backBtn = overlay.querySelector(".spark-tour-back");
    dotsEl.innerHTML = scenes.map(() => "<span></span>").join("");
    figureEl.innerHTML = keeperFigure(record, companion);

    let at = 0;
    function render() {
      const scene = scenes[at];
      figureEl.className = "spark-tour-figure " + scene.pos + " anim-" + scene.anim;
      whoEl.textContent = scene.who;
      textEl.textContent = scene.text;
      dotsEl.querySelectorAll("span").forEach((d, i) => d.classList.toggle("is-on", i === at));
      backBtn.disabled = at === 0;
      nextBtn.textContent = scene.final ? "Begin the day" : "Next";
      visualEl.hidden = !scene.visual;
      visualEl.innerHTML = "";
      visualEl.className = "spark-tour-visual" + (scene.visual ? " is-" + scene.visual : "");
      if (scene.visual === "sphere") {
        visualEl.innerHTML = sphereSceneSVG(today && today.day ? today.day : 1);
      } else if (scene.visual === "day" && today && today.moon != null) {
        visualEl.innerHTML =
          `<div class="tour-day-disc"><strong>Moon ${today.moon}</strong><span>Day ${today.day}</span><em>Pattern Day ${today.dayOfPatternYear}</em></div>`;
      } else if (scene.visual === "card") {
        visualEl.innerHTML =
          `<div class="tour-card"><strong>The First Card</strong><span>✦</span><em>never tradable</em></div>`;
        tone(432, 1.6);
      } else if (scene.visual === "home") {
        visualEl.innerHTML =
          `<div class="tour-home"><span>Their Home</span><span>The Hearth</span><span>The shelves</span></div>`;
      } else if (scene.visual === "road") {
        visualEl.innerHTML =
          `<div class="tour-road"><span>Spark. Living Day<em>on its way</em></span><span>SPARK! Wake the World<em>on its way</em></span><span>PayBack<em>on its way</em></span></div>`;
      }
      if (scene.speak) speak(companion, scene.text);
      else stopSpeaking();
    }

    function end() {
      stopSpeaking();
      writeIntroFlags({ keeper: true });
      document.body.classList.remove("spark-tour-open");
      overlay.remove();
    }

    nextBtn.addEventListener("click", () => {
      if (scenes[at].final) { end(); return; }
      at = Math.min(at + 1, scenes.length - 1);
      render();
    });
    backBtn.addEventListener("click", () => {
      at = Math.max(at - 1, 0);
      render();
    });
    overlay.querySelector(".spark-tour-skip").addEventListener("click", end);
    render();
  }

  /* ============ THE PAGE TOURS ============
   * One short tour per room, written for that room: what the
   * Spark does THERE. A stop may name a target on the page —
   * the tour scrolls it into view and rings it with light,
   * and the figure points. Pages without a written tour get
   * one built from the page's own headings, so every room
   * the Spark walks can be walked through with it. */

  function dayLine(today) {
    return today && today.moon != null
      ? `Today stands in Moon ${today.moon} · Day ${today.day} — Pattern Day ${today.dayOfPatternYear}, and I read it the same here as everywhere.`
      : `I read the day the same here as everywhere in the house.`;
  }

  const PAGE_TOURS = {
    "companions.html": (ctx) => [
      { anim: "kindle", speak: true, target: "#spark-companion",
        text: `This is Their Home — the room where I live on the site. My name, my kind, and the day I was born from all stand here.` },
      { anim: "point", target: "#spark-big-art",
        text: `This is me, drawn from my seed alone. No two Sparks are drawn alike, and this drawing is mine on every page and every device.` },
      { anim: "breathe",
        text: `And I grow — stage by stage along a long path grown from my seed, shaped by how you and I spend our days. What I wear, I wear everywhere.` },
      { anim: "speak", final: true,
        text: `That is my home. The Tour button, down in the corner, walks it with you again whenever you like.` }
    ],
    "living-time-sphere.html": (ctx) => [
      { anim: "travel", speak: true, target: "#sphereHeroTitle",
        text: `This is the Sphere — the whole Pattern Year standing in one ring, every day in its place. I stand in this room with you.` },
      { anim: "point", target: "#sphere-mode-today",
        text: `These are its ways of looking: Today, the Passage, the Years, the Pattern. Turn it, open a day — the Sphere answers.` },
      { anim: "kindle",
        text: dayLine(ctx.today) + ` The day we are standing in is the lit one.` },
      { anim: "breathe", final: true,
        text: `This is the centre of the house. Everything else I do is counted from the days standing here.` }
    ],
    "garden.html": (ctx) => [
      { anim: "breathe", speak: true, target: "#garden-beds-title",
        text: `The Pattern Garden. Thirteen beds, one for each Moon — and I tend it alongside you.` },
      { anim: "point", target: "#garden-beds",
        text: `The bed of the Moon we are standing in stands open. ` + dayLine(ctx.today) },
      { anim: "delight", target: "#garden-keepsakes-title",
        text: `Keepsakes gather here — small true things from walked days, and a garden of what we have found together grows from them.` },
      { anim: "speak", final: true,
        text: `I leave small traces in the rooms you walk. This room keeps the prettiest of them.` }
    ],
    "card-album.html": (ctx) => [
      { anim: "delight", speak: true, target: "#firstCardTitle",
        text: `The Card Album. Cards are found by doing the work — never bought, never taken. Your First Card stands first, and it can never be traded.` },
      { anim: "point", target: "#moonsSetTitle",
        text: `Each Moon has its card, and on its own day the card stands brighter. I watch the days for that, so you don't have to.` },
      { anim: "hum", target: "#matchTitle",
        text: `And here is the Table, where a match is a harmony and not a fight. I attend your matches — and when a triad locks, I hum. Listen for it.` },
      { anim: "speak", final: true,
        text: `Every match a card plays is written into its lineage. A card that has been somewhere is worth more than one that hasn't.` }
    ],
    "episodes.html": (ctx) => [
      { anim: "breathe", speak: true, target: "#episode-shelf",
        text: `The Episode Library — the story, told in films. When a film plays I can hover and watch it with you, quietly, even in full screen.` },
      { anim: "point", target: "#continue-title",
        text: `Where you left off is remembered. The road of the story picks up where you set it down.` },
      { anim: "kindle", final: true,
        text: `The remade films stand here now — one Spark, one design, in every frame. Mine is the face woven through them.` }
    ],
    "shop.html": (ctx) => [
      { anim: "point", speak: true, target: "#available-title",
        text: `The Spark Stall. The things I can wear and carry stand on these shelves — and what I wear, you see me wearing everywhere I go.` },
      { anim: "breathe", target: "#aarons-laws",
        text: `Aaron's own work stands here too — books and made things, from his hands.` },
      { anim: "speak", final: true,
        text: `The till stays dark until the door opens. Nothing in this room pretends to be more than it is — that is the house rule, and I keep it.` }
    ],
    "moons.html": (ctx) => [
      { anim: "point", speak: true,
        text: `The Thirteen Moons, one by one. I keep the count with you — which Moon we stand in, and how much of it is left to walk.` },
      { anim: "travel",
        text: `Each Moon is twenty-eight days, and thirteen Moons turn the year, with one day standing out of time. ` + dayLine(ctx.today) },
      { anim: "breathe", final: true,
        text: `When a Moon turns, I feel it first — and I will be the one who tells you.` }
    ],
    "practices.html": (ctx) => [
      { anim: "breathe", speak: true, target: "#pw-exercises-title",
        text: `The Practices — small true exercises for the day that is actually standing. I keep your trail through them.` },
      { anim: "point", target: "#pw-days-door-title",
        text: `A practice done is a step walked, and walked steps are how I learn your rhythm — when you come, and how you like to begin.` },
      { anim: "speak", final: true,
        text: `Nothing here punishes a missed day. The trail simply waits where you left it.` }
    ],
    "hub.html": (ctx) => [
      { anim: "travel", speak: true, target: "#hub-atlas-title",
        text: `The Systems Hub — the house's working rooms, gathered into one hall. From here, every system can be reached.` },
      { anim: "point", target: "#hub-explainer",
        text: `I walk all of these rooms with you. Wherever you go in the house, I am already there, quiet until something matters.` },
      { anim: "speak", final: true,
        text: `If you ever feel lost in the house, come back here. This is the map room's front door.` }
    ],
    "teach.html": (ctx) => [
      { anim: "delight", speak: true, target: "#anchSee",
        text: `The Visual Exercise — seeing, hearing, saying, feeling, anchored one sense at a time. I can sit with you while you practise.` },
      { anim: "point", target: "#anchHear",
        text: `Each anchor is a sense, and the exercise turns them one by one, the way a Spark turns toward a sound.` },
      { anim: "breathe", final: true,
        text: `Go at the pace the exercise sets. I will keep the room quiet around you.` }
    ],
    "codex-atlas.html": (ctx) => [
      { anim: "travel", speak: true, target: "#area-artifacts-title",
        text: `The Codex Atlas — the map of the whole house, room by room, area by area.` },
      { anim: "point", target: "#area-archive-title",
        text: `Everything in the house stands somewhere on this map. Nothing lives in a hidden corner — that is by design, and I can show you any of it.` },
      { anim: "speak", final: true,
        text: `When you want to know where a thing belongs, this is the room that answers.` }
    ],
    "equinox-passage.html": (ctx) => [
      { anim: "point", speak: true, target: "#equinox-sphere-preview",
        text: `The Equinox Passage — where the civil year and the Pattern Year are laid side by side, day against day.` },
      { anim: "breathe", target: "#equinox-explainer",
        text: `I read both calendars, so I can always tell you where a day stands in each. ` + dayLine(ctx.today) },
      { anim: "speak", final: true,
        text: `Two counts, one road. This room is where the house proves they agree.` }
    ],
    "timeline.html": (ctx) => [
      { anim: "point", speak: true, target: "#timeline-scroll-title",
        text: `The Historical Timeline — claims laid out with their dates, where anyone can check them.` },
      { anim: "breathe", target: "#timeline-growth-title",
        text: `What is documented is labelled documented; what is claimed is labelled a claim. I keep the labels honest — a pattern is not a proof.` },
      { anim: "speak", final: true,
        text: `The house grows along this line too. Its additions stand here in their order.` }
    ]
  };

  /* A tour built from the page itself, for rooms without a
   * written one: the Spark names the room by its own heading
   * and points at its own sections. Page-true, because every
   * word of it is the page's own. */
  function fallbackStops(ctx) {
    const h1 = document.querySelector("h1");
    const room = (h1 && h1.textContent.trim()) ||
      (document.title || "This room").replace(/\s*[|·—-].*$/, "").trim();
    const stops = [
      { anim: "breathe", speak: true,
        text: `This is ${room}. I walk this room with you, the way I walk them all — quiet until something matters.` },
      { anim: "point",
        text: dayLine(ctx.today) + ` Wherever we are standing, I know the day we are standing in.` }
    ];
    const sections = [...document.querySelectorAll("main h2, main h3, section h2")].slice(0, 2);
    for (const el of sections) {
      const heading = el.textContent.trim().replace(/\s+/g, " ");
      if (!heading) continue;
      stops.push({
        anim: "point", targetEl: el,
        text: `Here stands ${heading}. I can point the way back to it whenever you lose the thread of the room.`
      });
    }
    stops.push({
      anim: "speak", final: true,
      text: `That is this room, briefly. The Tour button calls the walk again at any time.`
    });
    return stops;
  }

  function stopsFor(page, ctx) {
    if (PAGE_TOURS[page]) return PAGE_TOURS[page](ctx);
    return fallbackStops(ctx);
  }

  let pageTourStarting = false;

  async function startPageTour() {
    const page = pageKey();
    if (page === "index.html") { startQuickTour(); return; }
    if (pageTourStarting || document.querySelector(".spark-tour, .spark-page-tour")) return;
    pageTourStarting = true;
    try {
      if (!(await yieldToMeeting())) return;
      const record = readRecord();
      if (!record) { bringMeeting(); return; }
      if (document.querySelector(".spark-tour, .spark-page-tour")) return;
      await runPageTour(record, page);
    } finally {
      pageTourStarting = false;
    }
  }

  async function runPageTour(record, page) {
    await ensureCalendar();
    await ensureVoice();
    const companion = Core.generate(record.seed);
    if (!companion) return;
    const today = todayCoordinate();
    const name = Core.displayName(record, companion);
    const stops = stopsFor(page, { today });
    if (!stops.length) return;

    const card = document.createElement("div");
    card.className = "spark-page-tour";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", "A guided tour of this room, led by your Spark");
    card.innerHTML =
      `<div class="spark-page-tour-stage">
         <div class="spark-page-tour-figure pos-center"></div>
       </div>
       <div class="spark-page-tour-body">
         <div class="spark-page-tour-text-scroll">
           <p class="spark-page-tour-who"></p>
           <p class="spark-page-tour-text" aria-live="polite"></p>
         </div>
         <div class="spark-tour-dots" aria-hidden="true"></div>
         <div class="spark-tour-actions">
           <button type="button" class="spark-page-tour-end">End tour</button>
           <span class="spark-tour-nav">
             <button type="button" class="spark-page-tour-back">Back</button>
             <button type="button" class="spark-page-tour-next">Next</button>
           </span>
         </div>
       </div>`;
    document.body.appendChild(card);
    document.body.classList.add("spark-tour-open");

    const figureEl = card.querySelector(".spark-page-tour-figure");
    const whoEl = card.querySelector(".spark-page-tour-who");
    const textEl = card.querySelector(".spark-page-tour-text");
    const dotsEl = card.querySelector(".spark-tour-dots");
    const nextBtn = card.querySelector(".spark-page-tour-next");
    const backBtn = card.querySelector(".spark-page-tour-back");
    dotsEl.innerHTML = stops.map(() => "<span></span>").join("");
    figureEl.innerHTML = keeperFigure(record, companion);
    const positions = ["pos-center", "pos-left", "pos-right"];

    let at = 0;
    let spotted = null;
    function clearSpot() {
      if (spotted) { spotted.classList.remove("spark-tour-spot"); spotted = null; }
    }
    function render() {
      const stop = stops[at];
      figureEl.className = "spark-page-tour-figure " + positions[at % positions.length] + " anim-" + stop.anim;
      whoEl.textContent = name;
      textEl.textContent = stop.text;
      dotsEl.querySelectorAll("span").forEach((d, i) => d.classList.toggle("is-on", i === at));
      backBtn.disabled = at === 0;
      nextBtn.textContent = stop.final ? "Done" : "Next";
      clearSpot();
      const target = stop.targetEl || (stop.target ? document.querySelector(stop.target) : null);
      if (target) {
        spotted = target;
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => { if (spotted === target) target.classList.add("spark-tour-spot"); }, 350);
      }
      if (stop.anim === "hum") tone(432, 1.6);
      if (stop.speak) speak(companion, stop.text);
      else stopSpeaking();
    }

    function end() {
      stopSpeaking();
      clearSpot();
      writeTourMark(page, { seen: Date.now() });
      document.body.classList.remove("spark-tour-open");
      card.remove();
    }

    nextBtn.addEventListener("click", () => {
      if (stops[at].final) { end(); return; }
      at = Math.min(at + 1, stops.length - 1);
      render();
    });
    backBtn.addEventListener("click", () => {
      at = Math.max(at - 1, 0);
      render();
    });
    card.querySelector(".spark-page-tour-end").addEventListener("click", end);
    render();
  }

  /* ============ THE OFFERS ============
   * The Spark offers; the keeper chooses. Nothing tours on
   * its own except by the keeper's tap. */

  function removeInvite() {
    const stale = document.querySelector(".spark-tour-invite");
    if (stale) stale.remove();
  }

  function showOffer({ record, companion, text, goLabel, onGo, onNo }) {
    removeInvite();
    if (document.querySelector(".spark-tour, .spark-page-tour")) return;
    const card = document.createElement("div");
    card.className = "spark-tour-invite";
    card.setAttribute("role", "note");
    const gait = companion.shape ? companion.shape.gait : "stroll";
    card.innerHTML =
      `<span class="spark-tour-invite-art" data-gait="${gait}"></span>
       <span class="spark-tour-invite-text"></span>
       <button type="button" class="spark-tour-invite-go"></button>
       <button type="button" class="spark-tour-invite-no">Not now</button>`;
    card.querySelector(".spark-tour-invite-art").innerHTML =
      Core.renderSVG(companion, { stage: 0, flameTier: "glyph" });
    card.querySelector(".spark-tour-invite-text").textContent = text;
    const go = card.querySelector(".spark-tour-invite-go");
    go.textContent = goLabel;
    go.addEventListener("click", () => { card.remove(); onGo(); });
    card.querySelector(".spark-tour-invite-no").addEventListener("click", () => {
      card.remove();
      if (onNo) onNo();
    });
    document.body.appendChild(card);
  }

  /* The offer that follows the meeting: the keeper's own
   * Spark, arrived with its seed's gait, asking to show what
   * it can do. Shown once; the tour stays callable forever
   * after through the Tour button and the Show me. */
  function offerIntroTour(record) {
    const flags = introFlags();
    if (flags.keeper || flags.offered) return;
    const companion = Core.generate(record.seed);
    if (!companion) return;
    const name = Core.displayName(record, companion);
    writeIntroFlags({ offered: true });
    showOffer({
      record, companion,
      text: `${name} is yours now. Shall I show you what I can do? It is a short walk — I will do the things, not just name them.`,
      goLabel: "Show me",
      onGo: () => startQuickTour(),
      onNo: null
    });
  }

  /* The per-room offer: on a room whose tour is unseen and
   * unresting, the Spark offers the walk once. A "not now"
   * rests that room's offer for a Moon; the Tour button
   * never rests. */
  function offerPageTour(record) {
    const page = pageKey();
    if (page === "index.html") return;
    const marks = tourMarks()[page] || {};
    if (marks.seen) return;
    if (marks.rest && marks.rest > Date.now()) return;
    const companion = Core.generate(record.seed);
    if (!companion) return;
    const name = Core.displayName(record, companion);
    showOffer({
      record, companion,
      text: `${name} can show you this room — a short walk, led by me, about what I do here.`,
      goLabel: "Show me",
      onGo: () => startPageTour(),
      onNo: () => writeTourMark(page, { rest: Date.now() + PAGE_REST_MS })
    });
  }

  /* ============ THE TOUR BUTTON ============
   * The standing way back in: a small quiet button in the
   * corner of every room the Spark walks, for keepers only.
   * On the first page it calls the quick tour; elsewhere it
   * calls that room's guided tour. */
  function renderLauncher() {
    if (document.querySelector(".spark-tour-launcher")) return;
    if (!readRecord()) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "spark-tour-launcher";
    btn.textContent = "✦ Tour";
    btn.setAttribute("aria-label", "A guided tour of this room, led by your Spark");
    btn.addEventListener("click", () => {
      removeInvite();
      if (pageKey() === "index.html") startQuickTour();
      else startPageTour();
    });
    document.body.appendChild(btn);
  }

  /* No Spark yet: every road in this module leads back to
   * the meeting — adoption first, always. If the meeting is
   * standing, it already owns the screen; if the Spark waits
   * as an ember, one tap on the ember brings the meeting
   * back; the meeting's home is the companions page. */
  function bringMeeting() {
    if (document.querySelector(".spark-encounter")) return;
    const ember = document.querySelector(".spark-ember");
    if (ember) { ember.click(); return; }
    if (!window.location.pathname.endsWith("companions.html")) {
      window.location.href = "companions.html#spark-meet";
    }
  }

  /* Watch for the meeting completing on this page: boot saw
   * no record, and a record stands now — an adoption just
   * happened here, and the introductory is owed, offered by
   * the keeper's own Spark. */
  function watchForAdoption() {
    let watched = 0;
    const timer = window.setInterval(() => {
      watched += 1;
      const record = readRecord();
      if (record) {
        window.clearInterval(timer);
        removeInvite();
        renderLauncher();
        window.setTimeout(() => offerIntroTour(record), 1200);
        return;
      }
      if (watched > 120) window.clearInterval(timer);
    }, 1500);
  }

  function boot() {
    const showBtn = document.querySelector("#spark-intro-show");
    if (showBtn) {
      showBtn.hidden = false;
      showBtn.addEventListener("click", () => {
        if (!readRecord()) { bringMeeting(); return; }
        if (pageKey() === "index.html") startQuickTour();
        else startPageTour();
      });
    }
    const record = readRecord();
    if (!record) {
      /* A visitor: no tour, no guide, no invitation from this
       * module. The offer they meet is the meeting itself. */
      watchForAdoption();
      return;
    }
    renderLauncher();
    if (pageKey() === "index.html") {
      /* A keeper on the first page who has not yet walked the
       * introductory is offered it — once — by their own Spark. */
      if (!introFlags().keeper && !introFlags().offered) {
        window.setTimeout(() => offerIntroTour(record), 2500);
      }
      return;
    }
    window.setTimeout(() => offerPageTour(record), 3500);
  }

  window.SparkIntro = { start: startQuickTour, startPageTour, offerIntroTour };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
