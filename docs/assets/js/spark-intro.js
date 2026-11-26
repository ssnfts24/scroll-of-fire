"use strict";

/*
 * The Spark-led introduction (Aaron, Nov 26, 2026).
 *
 * "The Spark should lead the person along to adopting one and
 * into the introductory right away." One flow, not separate
 * doors:
 *
 *   1. A visitor with no Spark is greeted by a guide Spark —
 *      plainly a guide, never the visitor's own — and invited
 *      to walk. The walk itself shows what a Spark is.
 *   2. Adoption is the walk's destination (the meeting itself
 *      lives on the companions page, under the standing mint
 *      rules — this module never creates or alters a record).
 *   3. The moment a record stands where none stood, the
 *      introductory begins, led by the keeper's OWN Spark:
 *      it speaks in its seed voice (words always on screen),
 *      reads the day, travels around the screen to show how it
 *      moves, lights a day on the Sphere, sounds a card, shows
 *      its home and the shelves, and points honestly down the
 *      road at what is coming — each thing labelled as it is.
 *
 * The full tour plays once per keeper; Skip is always there;
 * afterwards it lives as a "Show me" the keeper can call up
 * from the homepage or the companions page.
 */
(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const Core = window.SparkCompanion;
  if (!Core) return;

  const SEEN_KEY = "sof.spark.intro.v1";
  const AUTOSTART_KEY = "sof.spark.intro.autostart";

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

  /* What of the walk has been seen. The guide's walk and the
   * keeper's own tour are different walks: seeing the guide's
   * must not spend the keeper's — the moment a record stands,
   * the introductory is owed again, led by their own Spark
   * (Aaron's one flow, Nov 26, 2026). The first build's single
   * mark ({ seen: true }) reads as the keeper's walk seen, so
   * no keeper who already walked is ever toured twice. */
  function seenFlags() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(SEEN_KEY) || "null");
      if (!raw) return { guide: false, keeper: false };
      return { guide: !!raw.guide, keeper: !!(raw.keeper || raw.seen) };
    } catch {
      return { guide: false, keeper: false };
    }
  }

  function markSeen(keeperLed) {
    try {
      const flags = seenFlags();
      if (keeperLed) flags.keeper = true;
      else flags.guide = true;
      window.localStorage.setItem(SEEN_KEY, JSON.stringify({ ...flags, at: Date.now() }));
    } catch { /* the tour rests */ }
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

  function guideCompanion() {
    const seed = Core.makeSeed({ moon: 13, patternDay: 365, kindIndex: 0, nonce: "guide001" });
    return Core.generate(seed);
  }

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

  /* ---------------- the tour itself ---------------- */
  let tourStarting = false;

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  /* The meeting owns the screen while it stands (Aaron's
   * ruling, Nov 19, 2026): the tour never stacks over it. A
   * manual "Show me" first puts the meeting gently aside the
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

  async function startTour() {
    if (tourStarting || document.querySelector(".spark-tour")) return;
    tourStarting = true;
    try {
      if (!(await yieldToMeeting())) return;
      if (document.querySelector(".spark-tour")) return;
      await runTour();
    } finally {
      tourStarting = false;
    }
  }

  async function runTour() {
    if (document.querySelector(".spark-tour")) return;
    await ensureCalendar();
    await ensureVoice();
    const record = readRecord();
    const keeper = record ? Core.generate(record.seed) : null;
    const guide = guideCompanion();
    const lead = keeper || guide;
    if (!lead) return;
    const today = todayCoordinate();
    const stage = keeper ? Core.stageOf(record, keeper).index : 0;
    const name = keeper ? Core.displayName(record, keeper) : lead.name;

    const scenes = [];
    if (!keeper) {
      scenes.push({
        pos: "pos-center",
        who: "The Guide Spark",
        text: `I am a guide Spark — not yours, a guide. Walk with me a little, and I will show you what a Spark is. Yours is waiting at the end of the walk.`,
        speak: true
      });
    } else {
      scenes.push({
        pos: "pos-center",
        who: name,
        text: `I am ${name}, your Spark. Let me show you what I can do — by doing it.`,
        speak: true
      });
    }
    scenes.push({
      pos: "pos-left",
      who: name,
      text: `This is my voice. It grows from my seed, so it is the same voice on every device that ever carries me — and no other Spark sounds quite like me.`,
      speak: true
    });
    if (today && today.moon != null) {
      scenes.push({
        pos: "pos-right",
        who: name,
        text: `You are standing in Moon ${today.moon} · Day ${today.day} — Pattern Day ${today.dayOfPatternYear}. I read the day from the same calendar the whole house keeps, so I always know where we are standing.`,
        visual: "day"
      });
    }
    scenes.push({
      pos: "pos-left",
      who: name,
      text: `And I travel. Across this screen, across the site, and — when the door is open — onto your phone, and I am still me. Watch: this is the Sphere, every day of the year standing in its ring. I can light the day you are looking for.`,
      visual: "sphere"
    });
    scenes.push({
      pos: "pos-right",
      who: name,
      text: `Cards are found by doing the work, and each one sounds its own tone. Hear this one — that is the Moon it belongs to, sounding.`,
      visual: "card"
    });
    scenes.push({
      pos: "pos-center",
      who: name,
      text: `I have a home — Their Home, and the Hearth — and shelves of things I can wear and carry. What I wear, you will see me wearing, here and everywhere.`,
      visual: "home"
    });
    scenes.push({
      pos: "pos-left",
      who: name,
      text: `Down the road, honestly labelled: Spark. Living Day, my app, is on its way. SPARK! Wake the World, the game, is on its way. PayBack, the first Living Tool, is on its way. Nothing here will ever pretend to be more than it is.`,
      visual: "road"
    });
    scenes.push({
      pos: "pos-center",
      who: keeper ? name : "The Guide Spark",
      text: keeper
        ? `That is the shape of it. The day is yours — I will be in the rooms you walk, quiet until something matters.`
        : `Your own Spark is waiting to meet you. The meeting is short, the Spark is permanent, and the introductory you just walked becomes its own first words to you.`,
      final: true
    });

    const overlay = document.createElement("div");
    overlay.className = "spark-tour";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "The Spark's introductory tour");
    overlay.innerHTML =
      `<div class="spark-tour-card">
        <div class="spark-tour-stage">
          <div class="spark-tour-visual" hidden></div>
          <div class="spark-tour-figure pos-center"></div>
        </div>
        <p class="spark-tour-who"></p>
        <p class="spark-tour-text" aria-live="polite"></p>
        <div class="spark-tour-dots" aria-hidden="true"></div>
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

    let at = 0;
    function drawFigure(companionToDraw, st) {
      figureEl.innerHTML = Core.renderSVG(companionToDraw, {
        stage: st,
        revealed: keeper ? Core.revealsFor({ record, companion: keeper }).revealed : null,
        wrap: keeper ? Core.wrapFor(record) : null
      });
    }
    drawFigure(lead, stage);

    function render() {
      const scene = scenes[at];
      figureEl.className = "spark-tour-figure " + scene.pos;
      whoEl.textContent = scene.who;
      textEl.textContent = scene.text;
      dotsEl.querySelectorAll("span").forEach((d, i) => d.classList.toggle("is-on", i === at));
      backBtn.disabled = at === 0;
      nextBtn.textContent = scene.final ? (keeper ? "Begin the day" : "Meet my Spark") : "Next";
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
      if (scene.speak) speak(lead, scene.text);
    }

    function end() {
      stopSpeaking();
      markSeen(!!keeper);
      document.body.classList.remove("spark-tour-open");
      overlay.remove();
    }

    nextBtn.addEventListener("click", () => {
      const scene = scenes[at];
      if (scene.final) {
        end();
        if (!keeper) {
          if (window.location.pathname.endsWith("companions.html")) {
            const meet = document.querySelector("#spark-meet");
            if (meet) {
              meet.hidden = false;
              meet.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          } else {
            window.location.href = "companions.html#spark-meet";
          }
        }
        return;
      }
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

  /* ---- the invitation, and the moment after the meeting ---- */
  function invite() {
    if (document.querySelector(".spark-tour-invite")) return;
    if (document.querySelector(".spark-tour")) return;
    const record = readRecord();
    const lead = record ? Core.generate(record.seed) : guideCompanion();
    if (!lead) return;
    const card = document.createElement("div");
    card.className = "spark-tour-invite";
    card.setAttribute("role", "note");
    card.innerHTML =
      `<span class="spark-tour-invite-art"></span>
       <span class="spark-tour-invite-text">${record
         ? "Your Spark can show you what it does — a short walk, by doing."
         : "A Spark is waiting to show you the way. Walk with the guide a little?"}</span>
       <button type="button" class="spark-tour-invite-go">Show me</button>
       <button type="button" class="spark-tour-invite-no">Not now</button>`;
    card.querySelector(".spark-tour-invite-art").innerHTML =
      Core.renderSVG(lead, { stage: 0, flameTier: "glyph" });
    card.querySelector(".spark-tour-invite-go").addEventListener("click", () => {
      card.remove();
      startTour();
    });
    card.querySelector(".spark-tour-invite-no").addEventListener("click", () => card.remove());
    document.body.appendChild(card);
  }

  function boot() {
    const showBtn = document.querySelector("#spark-intro-show");
    if (showBtn) {
      showBtn.hidden = false;
      showBtn.addEventListener("click", startTour);
    }
    if (seenFlags().keeper) return;
    const hadRecord = !!readRecord();
    if (hadRecord) {
      window.setTimeout(invite, 2500);
      return;
    }
    /* A visitor: wait until the meeting pop-up is not standing,
     * then invite; and watch for the meeting completing — the
     * moment a record stands, the introductory begins, led by
     * the keeper's own Spark. */
    let waited = 0;
    const inviteTimer = window.setInterval(() => {
      waited += 1;
      if (readRecord() || document.querySelector(".spark-tour")) {
        window.clearInterval(inviteTimer);
        return;
      }
      if (!document.querySelector(".spark-encounter") && waited >= 2) {
        window.clearInterval(inviteTimer);
        invite();
      }
      if (waited > 14) window.clearInterval(inviteTimer);
    }, 1500);
    let watched = 0;
    const meetTimer = window.setInterval(() => {
      watched += 1;
      if (readRecord() && !seenFlags().keeper) {
        window.clearInterval(meetTimer);
        try {
          if (window.sessionStorage.getItem(AUTOSTART_KEY)) return;
          window.sessionStorage.setItem(AUTOSTART_KEY, "1");
        } catch { /* the start stands */ }
        const stale = document.querySelector(".spark-tour-invite");
        if (stale) stale.remove();
        startTour();
      }
      if (watched > 120) window.clearInterval(meetTimer);
    }, 1500);
  }

  window.SparkIntro = { start: startTour, invite };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
