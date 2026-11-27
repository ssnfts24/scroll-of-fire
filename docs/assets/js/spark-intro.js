"use strict";

/*
 * The Spark's tours (Aaron, Nov 26, 2026 — corrected in his
 * own words at 16:13, after the first build put a guide's
 * walk before the meeting; and again at 17:04, deeper):
 *
 *   "All that should be done without all the pop up windows
 *    though. I wanted the actual spark to just come up in a
 *    way and start with all that — or the spark moves around
 *    the screen in certain ways and brings you to things in
 *    a way where it can even scroll through the pages and
 *    show you different things if you wanted."
 *
 * So the tour is not a window. There is no card, no modal,
 * no button row. The tour is the keeper's own Spark, loose
 * on the page:
 *
 *   1. First page, first time: the visitor is offered to
 *      ADOPT a Spark — the meeting, which likewise stands
 *      unboxed now (see the presence). No tour stands
 *      before the meeting; this module runs nothing for a
 *      visitor who has no Spark.
 *   2. After adopting, the keeper's OWN Spark leaves its
 *      corner, comes up onto the page in its seed's gait,
 *      and OFFERS the tour — its words beside itself, its
 *      choices as tappable words travelling with it. A tap
 *      on the Spark, and it gives a QUICK tour: six short
 *      stops, each a thing the Spark does, done.
 *   3. Every room has the same free walk: the Spark travels
 *      across the screen to the thing it is showing, the
 *      page scrolls with it so the thing comes into view
 *      with the Spark beside it, and the Spark gestures —
 *      speaks, points, travels, delights, breathes, kindles,
 *      hums — a different animation at different stops,
 *      because the animation IS the demonstration. The
 *      Sphere stage's tour rides this overlay alone; no
 *      protected Sphere file is touched.
 *   4. The pacing is the keeper's, without buttons: tap the
 *      Spark to go on. The page stays live underneath the
 *      whole walk — no overlay, no dim, no cage. Scrolling
 *      away, tapping a link, or letting the Spark rest ends
 *      the walk, and the Spark glides home to its corner.
 *
 * And at 17:31, with his phone in his hand: "he should
 * come up from wherever the spark is on the page. Make
 * the reading better somehow." So the rise starts at the
 * Spark's measured seat — the walker's own button, the
 * stage figure, the ember — and its words carry a soft
 * pool of shadow that hugs them (the styles), while the
 * Spark itself settles, at every stop, on the calmest
 * ground nearby: the page's own words weighed, the
 * quietest stand taken.
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
  const ROAM_REST_MS = 30000; // let the Spark rest, and the walk is over
  const OFFER_REST_MS = 20000; // an unanswered offer settles home on its own

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

  /* The Spark's day is the page's day (pass 8): the device's
   * timezone at a midnight boundary, as the page's own panels
   * resolve it — never the cursor's sunset default or the
   * calendar's UTC default, which roll the day forward early. */
  function todayCoordinate() {
    let timeZone = "UTC";
    try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { /* UTC stands */ }
    if (window.SOFTemporalCursor && typeof window.SOFTemporalCursor.resolvePosition === "function") {
      try {
        const pos = window.SOFTemporalCursor.resolvePosition(new Date(), { timeZone, boundaryMode: "midnight" });
        if (pos) return pos;
      } catch { /* fall through */ }
    }
    if (window.PatternCalendar) {
      try { return window.PatternCalendar.fromCivilDate({ date: new Date(), timeZone, boundaryMode: "midnight" }); } catch { return null; }
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

  function reducedMotion() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }

  /* The meeting owns the screen while it stands (Aaron's
   * ruling, Nov 19, 2026): no tour ever stacks over it. A
   * manual start first puts the meeting gently aside the
   * meeting's own way — its "Not now", so the same Spark waits
   * on as an ember — and while a meeting is mid-celebration
   * (an adoption being named), the tour waits for the meeting
   * to finish before the Spark comes up. */
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

  /* ============ THE ROAMING SPARK ============
   * One loose Spark, shared by the offer and both walks: the
   * keeper's own figure, its words beside it, nothing boxed.
   * It stands where it is put by the centre of its figure;
   * it travels with a glide, wearing its seed's gait while
   * it moves; and when it is done it glides home to the
   * corner seat it left — which stands empty (its furniture
   * hidden) the whole while the Spark is out. */

  /* The Spark's seat: where its figure actually stands on
   * this page, measured — the walker's own button wherever
   * it has wandered to, the stage figure on its home page,
   * the waiting ember, the meeting's figure. (Earlier passes
   * read the presence host, but the host is the whole
   * screen, so the Spark "rose" from mid-air. Aaron, Nov 26,
   * 2026, 17:31: "he should come up from wherever the spark
   * is on the page.") The rise starts here, and home is
   * here: the keeper watches his own Spark leave its place. */
  function cornerPoint() {
    /* In the Spark's own order: its drawn figure first —
     * in the walker's button, on its home stage, in the
     * ember, in the meeting — then the furniture around
     * the figure, then the corner it has always kept. */
    const selectors = [
      ".spark-presence-art", "#spark-big-art", ".spark-ember-art",
      ".spark-encounter-art", ".spark-presence-button", ".spark-ember",
      ".spark-encounter-artbtn", ".spark-walker"
    ];
    for (const sel of selectors) {
      const seat = document.querySelector(sel);
      if (!seat) continue;
      const r = seat.getBoundingClientRect();
      if (r.width) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    return { x: window.innerWidth - 48, y: window.innerHeight - 54 };
  }

  function createRoamer(record, companion, figureHTML, fill) {
    const gait = companion.shape ? companion.shape.gait : "stroll";
    const el = document.createElement("div");
    el.className = "spark-roam";
    el.setAttribute("role", "group");
    el.setAttribute("aria-label", "Your Spark, out on the page");
    el.innerHTML =
      `<div class="spark-roam-stand">
         <div class="spark-roam-visual" hidden></div>
         <button type="button" class="spark-roam-figure" data-gait="${gait}">
           <span class="spark-roam-art">${figureHTML}</span>
         </button>
       </div>
       <div class="spark-roam-speech">
         <p class="spark-roam-who"></p>
         <p class="spark-roam-text" aria-live="polite"></p>
         <div class="spark-roam-choices" hidden></div>
         <p class="spark-roam-hint"></p>
       </div>`;
    document.body.appendChild(el);
    document.body.classList.add("spark-roam-open");
    const roam = {
      el,
      figureBtn: el.querySelector(".spark-roam-figure"),
      visualEl: el.querySelector(".spark-roam-visual"),
      whoEl: el.querySelector(".spark-roam-who"),
      textEl: el.querySelector(".spark-roam-text"),
      choicesEl: el.querySelector(".spark-roam-choices"),
      hintEl: el.querySelector(".spark-roam-hint"),
      flipped: false,
      gone: false
    };
    /* The words are laid in before the first placement:
     * the speech grows the cluster downward from a fixed
     * top, so a Spark placed before its words arrive would
     * sink as they land. Filled first, it stands on its
     * seat from the first frame. */
    if (fill) fill(roam);
    /* It rises from the seat it left: placed there without
     * a glide, then it comes up. The seat is remembered —
     * the presence underneath may wander on while hidden,
     * but home is the place the keeper saw it leave, and
     * that is where it glides back to. */
    roam.home = cornerPoint();
    placeRoam(roam, roam.home, true);
    window.requestAnimationFrame(() => el.classList.add("is-here"));
    return roam;
  }

  /* Put the Spark's figure-centre on the point (cx, cy),
   * clamped so the whole cluster — figure and speech —
   * stays on the screen. The speech changes sides when the
   * Spark stands in the right of the screen, so its words
   * never run off the edge. A stop's placement keeps a
   * floor reserve: the house's rooms carry their own fixed
   * bars along the bottom (the homepage's rail, the Sphere's
   * tabs), and the Spark stands above them, never on them;
   * only the glide home may settle to the very corner. */
  /* The figure's centre within the cluster, measured from
   * the live layout — never reckoned from the cluster's
   * size, because the speech grows after the Spark first
   * stands, and a reckoned centre sinks as the words
   * arrive. Measured, the figure lands on its point
   * whatever the words are doing. */
  function figureOffset(roam) {
    const er = roam.el.getBoundingClientRect();
    const fr = roam.figureBtn.getBoundingClientRect();
    if (!er.width || !fr.width) return { dx: 50, dy: (roam.el.offsetHeight || 170) - 50 };
    return {
      dx: fr.left + fr.width / 2 - er.left,
      dy: fr.top + fr.height / 2 - er.top
    };
  }

  /* Where the cluster would stand if its figure-centre
   * were put on the point: the box it would occupy, and
   * which side its speech would take. placeRoam applies
   * it; the calm sense below compares candidates with it. */
  function roamBox(roam, point, opts) {
    const el = roam.el;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = el.offsetWidth || 340;
    const h = el.offsetHeight || 170;
    const fig = figureOffset(roam);
    const floor = opts && opts.floor != null ? opts.floor : vh - 4;
    const y = Math.max(4, Math.min(point.y - fig.dy, floor - h));
    /* The Spark can stand with its words on either side of
     * it, and on a phone's width the two stands land its
     * figure in different places. It takes the stand that
     * lands its figure nearer the point it was given — so
     * a rise begins as close to its seat as its words
     * allow, and a stop stands as close to its subject as
     * it can. (In the layout as it stands the figure may
     * sit on the other side; mirrored, its distance from
     * the cluster's far edge is the same measure.) */
    const stands = roam.flipped
      ? [{ flip: true, cx: fig.dx }, { flip: false, cx: w - fig.dx }]
      : [{ flip: false, cx: fig.dx }, { flip: true, cx: w - fig.dx }];
    let best = null;
    for (const s of stands) {
      const x = Math.max(4, Math.min(point.x - s.cx, vw - w - 4));
      const miss = Math.abs(x + s.cx - point.x);
      if (!best || miss < best.miss) best = { flip: s.flip, x, miss };
    }
    return { flip: best.flip, w, h, x: best.x, y };
  }

  /* ---- the calm sense ----
   * The Spark settles where the ground is quietest: it
   * weighs the page's own words (headings, paragraphs,
   * lists) behind each nearby candidate stand and takes
   * the one its speech covers least, so its words are
   * never shouted over the room's. Aaron, Nov 26, 2026,
   * 17:31: "Make the reading better somehow." */
  function busyRects() {
    const out = [];
    const els = document.querySelectorAll("h1, h2, h3, p, li, blockquote, figcaption");
    for (const el of els) {
      if (el.closest(".spark-roam, .spark-presence, .spark-encounter-host, .spark-ember-host")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) continue;
      out.push(r);
      if (out.length >= 420) break;
    }
    return out;
  }

  function calmScore(box, rects) {
    let score = 0;
    for (const r of rects) {
      const ox = Math.min(box.x + box.w, r.right) - Math.max(box.x, r.left);
      const oy = Math.min(box.y + box.h, r.bottom) - Math.max(box.y, r.top);
      if (ox > 0 && oy > 0) score += ox * oy;
    }
    return score;
  }

  /* The calmest stand near the point the Spark was headed
   * for: the point itself, or a short step in any direction
   * — whichever leaves its words over the quietest ground. */
  function calmPoint(roam, point, opts) {
    const rects = busyRects();
    if (!rects.length) return point;
    const tries = [
      point,
      { x: point.x, y: point.y - 84 },
      { x: point.x, y: point.y + 84 },
      { x: point.x - 96, y: point.y },
      { x: point.x + 96, y: point.y },
      { x: point.x - 96, y: point.y - 84 },
      { x: point.x + 96, y: point.y - 84 }
    ];
    let best = point;
    let bestScore = Infinity;
    for (const t of tries) {
      const s = calmScore(roamBox(roam, t, opts), rects);
      if (s < bestScore) { bestScore = s; best = t; }
    }
    return best;
  }

  function placeRoam(roam, point, instant, opts) {
    const el = roam.el;
    const box = roamBox(roam, point, opts);
    if (box.flip !== roam.flipped) {
      roam.flipped = box.flip;
      el.classList.toggle("is-flipped", box.flip);
    }
    const x = box.x;
    const y = box.y;
    if (instant) el.classList.add("no-glide");
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    if (instant) {
      void el.offsetWidth;
      el.classList.remove("no-glide");
    } else {
      el.classList.add("is-travelling");
      window.setTimeout(() => el.classList.remove("is-travelling"), 980);
    }
  }

  /* A stage point, in fractions of the screen, for a stop
   * that shows the Spark itself rather than a thing on the
   * page. */
  function stagePoint(fx, fy) {
    return { x: Math.round(window.innerWidth * fx), y: Math.round(window.innerHeight * fy) };
  }

  /* The Spark goes home: it glides back to its corner, fades
   * as it settles, and the corner seat is its own again. */
  function sendHome(roam, done) {
    if (roam.gone) return;
    roam.gone = true;
    stopSpeaking();
    placeRoam(roam, roam.home || cornerPoint());
    roam.el.classList.add("is-leaving");
    window.setTimeout(() => {
      roam.el.remove();
      if (!document.querySelector(".spark-roam")) {
        document.body.classList.remove("spark-roam-open");
      }
      if (done) done();
    }, 1000);
  }

  function removeRoam(roam) {
    if (!roam || roam.gone) return;
    roam.gone = true;
    roam.el.remove();
    if (!document.querySelector(".spark-roam")) {
      document.body.classList.remove("spark-roam-open");
    }
  }

  /* ============ THE WALK ============
   * The engine of both tours. A walk is a list of stops; at
   * each stop the Spark travels to its place — beside the
   * thing it names, the page scrolling to bring that thing
   * into view first — speaks its words beside itself, and
   * waits. Tap the Spark to go on. Wander off — scroll away,
   * tap a link, touch the page elsewhere — or let it rest,
   * and the walk is over and the Spark goes home. */

  function runWalk({ record, companion, stops, onEnd }) {
    const name = Core.displayName(record, companion);
    const roam = createRoamer(record, companion, keeperFigure(record, companion));
    roam.el.classList.add("is-tour");
    const smooth = !reducedMotion();
    let at = -1;
    let over = false;
    let spotted = null;
    let walkToken = 0;
    let restTimer = null;
    let stopY = window.scrollY;
    let tourScrollUntil = 0;

    function clearSpot() {
      if (spotted) { spotted.classList.remove("spark-tour-spot"); spotted = null; }
    }

    function armRest() {
      window.clearTimeout(restTimer);
      restTimer = window.setTimeout(end, ROAM_REST_MS);
    }

    function end() {
      if (over) return;
      over = true;
      walkToken += 1;
      window.clearTimeout(restTimer);
      document.removeEventListener("pointerdown", onOutside, true);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKey, true);
      clearSpot();
      if (onEnd) onEnd();
      sendHome(roam);
    }

    function onOutside(e) {
      if (e.target.closest && e.target.closest(".spark-roam")) return;
      end(); // the keeper has turned back to the page
    }

    function onScroll() {
      if (Date.now() < tourScrollUntil) return; // the walk's own scrolling
      if (Math.abs(window.scrollY - stopY) > 120) end(); // scrolled away
    }

    function onKey(e) {
      if (e.key === "Escape") end();
    }

    document.addEventListener("pointerdown", onOutside, true);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKey, true);

    async function show(i) {
      const token = ++walkToken;
      at = i;
      const stop = stops[i];
      roam.figureBtn.className = "spark-roam-figure anim-" + stop.anim;
      roam.figureBtn.setAttribute("data-gait", companion.shape ? companion.shape.gait : "stroll");
      roam.figureBtn.setAttribute("aria-label",
        stop.final ? `You are listening to ${name}. Tap the Spark to finish.` : `You are listening to ${name}. Tap the Spark to go on.`);
      roam.whoEl.textContent = name;
      roam.textEl.textContent = stop.text;
      roam.hintEl.textContent = stop.final
        ? "Tap me, and I'll go home."
        : i === 0
          ? "Tap me to go on — or wander off, and I'll go home on my own."
          : `Tap me to go on · ${i + 1} of ${stops.length}`;
      roam.visualEl.hidden = !stop.visual;
      roam.visualEl.innerHTML = "";
      roam.visualEl.className = "spark-roam-visual" + (stop.visual ? " is-" + stop.visual : "");
      if (stop.visual === "sphere") {
        const today = stop.today;
        roam.visualEl.innerHTML = sphereSceneSVG(today && today.day ? today.day : 1);
      } else if (stop.visual === "day" && stop.today && stop.today.moon != null) {
        const today = stop.today;
        roam.visualEl.innerHTML =
          `<div class="tour-day-disc"><strong>Moon ${today.moon}</strong><span>Day ${today.day}</span><em>Pattern Day ${today.dayOfPatternYear}</em></div>`;
      } else if (stop.visual === "card") {
        roam.visualEl.innerHTML =
          `<div class="tour-card"><strong>The First Card</strong><span>✦</span><em>never tradable</em></div>`;
      }
      clearSpot();
      const target = stop.targetEl || (stop.target ? document.querySelector(stop.target) : null);
      if (target) {
        tourScrollUntil = Date.now() + 1500;
        target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
        await sleep(smooth ? 560 : 60);
        if (token !== walkToken || over) return;
        const r = target.getBoundingClientRect();
        const vh = window.innerHeight;
        let cy;
        const cx = Math.max(76, Math.min(r.left + Math.min(r.width / 2, 130), window.innerWidth - 76));
        if (r.height > vh * 0.9) {
          /* A thing taller than the screen: stand near the
           * foot of the part of it that is showing. */
          cy = Math.min(r.bottom, vh) - 150;
        } else {
          /* Above the thing, or below it — the standing
           * preference holds, unless the other side is
           * plainly calmer ground for the words. */
          const above = r.top > 230;
          const cyPref = above ? r.top - 96 : r.bottom + 96;
          const cyAlt = above ? r.bottom + 96 : r.top - 96;
          const rects = busyRects();
          const sPref = calmScore(roamBox(roam, { x: cx, y: cyPref }, { floor: vh - 88 }), rects);
          const sAlt = calmScore(roamBox(roam, { x: cx, y: cyAlt }, { floor: vh - 88 }), rects);
          cy = sAlt < sPref * 0.7 ? cyAlt : cyPref;
        }
        placeRoam(roam, { x: cx, y: cy }, false, { floor: vh - 88 });
        spotted = target;
        window.setTimeout(() => { if (spotted === target && !over) target.classList.add("spark-tour-spot"); }, 520);
        tourScrollUntil = Date.now() + 1200;
      } else {
        /* A stage stop: the Spark stands for itself, and
         * settles on the calmest ground near its mark. */
        const stand = calmPoint(roam, stop.place || stagePoint(0.5, 0.66), { floor: window.innerHeight - 88 });
        placeRoam(roam, stand, false, { floor: window.innerHeight - 88 });
      }
      await sleep(smooth ? 500 : 40);
      if (token !== walkToken || over) return;
      stopY = window.scrollY;
      armRest();
      if (stop.anim === "hum" || stop.visual === "card") tone(432, 1.6);
      if (stop.speak) speak(companion, stop.text);
      else stopSpeaking();
    }

    function advance() {
      if (over) return;
      if (stops[at] && stops[at].final) { end(); return; }
      if (at + 1 < stops.length) show(at + 1);
      else end();
    }

    roam.figureBtn.addEventListener("click", advance);
    show(0);
    return { end };
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
   * Spark's abilities, done — and the Spark animates a
   * different way at each, because the animation is the
   * demonstration: it speaks, it points, it travels, it
   * delights, it breathes, it kindles. The stops carry stage
   * points, not page targets, so the quick tour can be given
   * on whatever page the adoption completed on. */
  function quickScenes(record, companion, today) {
    const name = Core.displayName(record, companion);
    const scenes = [
      {
        anim: "speak", who: name, speak: true, place: stagePoint(0.5, 0.36),
        text: `I am ${name}, your Spark. This is my voice — it grows from my seed, so it is mine on every device that ever carries me, and no other Spark sounds quite like me.`
      },
      {
        anim: "point", who: name, visual: "day", today, place: stagePoint(0.32, 0.44),
        text: today && today.moon != null
          ? `You are standing in Moon ${today.moon} · Day ${today.day} — Pattern Day ${today.dayOfPatternYear}. I read the day from the same calendar the whole house keeps, so I always know where we are standing.`
          : `I read the day from the same calendar the whole house keeps, so I always know where we are standing.`
      },
      {
        anim: "travel", who: name, visual: "sphere", today, place: stagePoint(0.68, 0.38),
        text: `And I travel — across this screen, across the site, and onto your phone when the door is open, and I am still me. This is the Sphere: every day of the year standing in its ring. Watch — I light the day we are standing in.`
      },
      {
        anim: "delight", who: name, visual: "card", place: stagePoint(0.32, 0.44),
        text: `Cards are found by doing the work, and each one sounds its own tone. Hear this one — that is the Moon it belongs to, sounding.`
      },
      {
        anim: "breathe", who: name, place: stagePoint(0.68, 0.44),
        text: `I have a home — Their Home, and the Hearth — and shelves of things I can wear and carry. What I wear, you will see me wearing, here and everywhere.`
      },
      {
        anim: "kindle", who: name, final: true, place: stagePoint(0.5, 0.4),
        text: `Down the road, honestly labelled: Spark. Living Day, my app, is on its way. SPARK! Wake the World, the game, is on its way. PayBack, the first Living Tool, is on its way. Nothing here pretends to be more than it is. That is the shape of it — I will be in the rooms you walk, quiet until something matters.`
      }
    ];
    return scenes;
  }

  let tourStarting = false;

  async function startQuickTour() {
    if (tourStarting || document.querySelector(".spark-roam.is-tour")) return;
    tourStarting = true;
    try {
      dismissOffer();
      if (!(await yieldToMeeting())) return;
      const record = readRecord();
      if (!record) { bringMeeting(); return; }
      if (document.querySelector(".spark-roam.is-tour")) return;
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
    const scenes = quickScenes(record, companion, today);
    runWalk({
      record, companion, stops: scenes,
      onEnd: () => writeIntroFlags({ keeper: true })
    });
  }

  /* ============ THE PAGE TOURS ============
   * One short tour per room, written for that room: what the
   * Spark does THERE. A stop may name a target on the page —
   * the walk scrolls it into view, rings it with light, and
   * the Spark stands beside it and points. Pages without a
   * written tour get one built from the page's own headings,
   * so every room the Spark walks can be walked through
   * with it. */

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
    if (pageTourStarting || document.querySelector(".spark-roam.is-tour")) return;
    pageTourStarting = true;
    try {
      dismissOffer();
      if (!(await yieldToMeeting())) return;
      const record = readRecord();
      if (!record) { bringMeeting(); return; }
      if (document.querySelector(".spark-roam.is-tour")) return;
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
    const stops = stopsFor(page, { today });
    if (!stops.length) return;
    runWalk({
      record, companion, stops,
      onEnd: () => writeTourMark(page, { seen: Date.now() })
    });
  }

  /* ============ THE OFFERS ============
   * The Spark offers by coming up: it leaves its corner,
   * stands on the page, and speaks beside itself, its
   * choices as tappable words in its own speech. Tapping
   * the Spark itself is the yes. Nothing tours except by
   * the keeper's choice. */

  function dismissOffer() {
    const offer = document.querySelector(".spark-roam.is-offer");
    if (offer) offer.remove();
    if (!document.querySelector(".spark-roam")) {
      document.body.classList.remove("spark-roam-open");
    }
  }

  function showOffer({ record, companion, text, goLabel, onGo, onNo }) {
    dismissOffer();
    if (document.querySelector(".spark-roam.is-tour")) return;
    const name = Core.displayName(record, companion);
    const roam = createRoamer(record, companion,
      Core.renderSVG(companion, { stage: 0, flameTier: "glyph" }),
      (r) => {
        r.whoEl.textContent = name;
        r.textEl.textContent = text;
        r.hintEl.textContent = "Tap me — or choose a word.";
        r.choicesEl.hidden = false;
        r.choicesEl.innerHTML =
          `<button type="button" class="spark-roam-choice is-go"></button>
           <button type="button" class="spark-roam-choice is-no">Not now</button>`;
        r.choicesEl.querySelector(".is-go").textContent = goLabel;
      });
    roam.el.classList.add("is-offer");
    const goWord = roam.choicesEl.querySelector(".is-go");
    let settled = false;
    const restTimer = window.setTimeout(() => settle(null), OFFER_REST_MS);
    function settle(which) {
      if (settled) return;
      settled = true;
      window.clearTimeout(restTimer);
      sendHome(roam);
      if (which === "go" && onGo) onGo();
      if (which === "no" && onNo) onNo();
    }
    goWord.addEventListener("click", () => settle("go"));
    roam.choicesEl.querySelector(".is-no").addEventListener("click", () => settle("no"));
    roam.figureBtn.setAttribute("aria-label", `${name} is offering to show you around. Tap the Spark to say yes.`);
    roam.figureBtn.addEventListener("click", () => settle("go"));
    /* It comes up from where it lives: a short rise out of
     * its own seat — up the page a little, toward the middle
     * a little — and settles on the calmest ground nearby,
     * never at a stranger's stage mark. */
    window.setTimeout(() => {
      const seat = roam.home || cornerPoint();
      const desired = {
        x: seat.x + (seat.x > window.innerWidth / 2 ? -40 : 40),
        y: seat.y - 168
      };
      placeRoam(roam, calmPoint(roam, desired, { floor: window.innerHeight - 88 }),
        false, { floor: window.innerHeight - 88 });
    }, 60);
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
   * unresting, the Spark comes up and offers the walk once.
   * A "not now" rests that room's offer for a Moon; the Tour
   * button never rests. */
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

  /* ============ THE ASKING ============
   * The Spark, asked (Aaron, Nov 26, 2026, 19:42 PST:
   * "The spark needs to be way more intelligent"). The
   * keeper taps ✦ Ask, and their own Spark comes up the
   * same way it tours — loose on the page, words beside
   * itself in the pool — and can be asked about their own
   * world in plain words: tapped from the offered
   * questions, or typed on the line. It answers from the
   * real records, read in that moment on this device:
   * the calendar's day, the record's sealed days, the
   * album's held cards, the lean's counted walks, this
   * room's own tour knowledge. The answering itself lives
   * in spark-answers.js, a pure core that can only say
   * what the snapshot carries — an unread record is
   * answered as unseen, never as empty, and a question it
   * cannot ground is answered as not known. No network,
   * no outside service, and no record is written: the
   * Spark reads and speaks. This is the keeper's Spark,
   * not the Codex Guide — that program is a separate,
   * already-ruled piece, and nothing here builds to it. */

  async function ensureAnswers() {
    if (window.SparkAnswers) return true;
    try {
      await loadScript(scriptBase() + "spark-answers.js?v=20261126-7");
      return !!window.SparkAnswers;
    } catch {
      return false;
    }
  }

  async function ensureLean() {
    if (window.SparkLean) return true;
    try {
      await loadScript(scriptBase() + "spark-lean.js?v=20261126-1");
      return !!window.SparkLean;
    } catch {
      return false;
    }
  }

  async function ensureCards() {
    if (window.CodexCards) return true;
    try {
      await loadScript(scriptBase() + "codex-cards.js");
      return !!window.CodexCards;
    } catch {
      return false;
    }
  }

  /* The snapshot, assembled from the real records in this
   * moment. Anything that cannot be read stays null, so
   * the core answers it as unseen — never as empty. */
  async function collectWorld(record, companion) {
    await ensureCalendar();
    const raw = todayCoordinate();
    const today = raw ? {
      moon: raw.moon,
      day: raw.day,
      dayOfPatternYear: raw.dayOfPatternYear,
      moonName: raw.moonName || null,
      dayName: raw.dayArchetype ? raw.dayArchetype[0] : null,
      dayGloss: raw.dayArchetype ? raw.dayArchetype[1] : null,
      outside: !!(raw.isDayOutOfTime || raw.isDeepTimeDay)
    } : null;

    let cards = null;
    if (await ensureCards()) {
      try {
        const store = window.CodexCards.createStore(
          window.localStorage, window.CodexCards.keeperKeyForSeed(record.seed));
        cards = store.heldCopies().map((c) => {
          const design = window.CodexCards.cardById(c.designId);
          return {
            name: (design && design.name) || c.designId,
            foundDay: c.lineage && c.lineage.found ? c.lineage.found.patternDay : null
          };
        });
      } catch { cards = null; }
    }

    let rooms = null;
    let moved = null;
    let leanState = { refusals: {}, shown: {} };
    if (await ensureLean()) {
      try {
        const lean = window.SparkLean.createLean(window.localStorage);
        const state = lean.load();
        leanState = state;
        moved = state.moved || null;
        if (window.SparkAnswers) {
          const list = window.SparkAnswers.ROOM_LABELS.map(([page, label]) => ({
            page, label, visits: state.counts["room:" + page] || 0
          }));
          rooms = list.some((r) => r.visits > 0) ? list : null;
        }
      } catch { /* the walks rest uncounted */ }
    }

    let room = null;
    const page = pageKey();
    const stops = page === "index.html"
      ? fallbackStops({ today: raw })
      : stopsFor(page, { today: raw });
    if (stops && stops.length) {
      room = { name: page, about: stops.slice(0, 2).map((s) => s.text).join(" ") };
    }

    return {
      world: {
        sparkName: Core.displayName(record, companion),
        day: today ? today.dayOfPatternYear : null,
        today,
        sealedDays: Array.isArray(record.practiceDays) ? record.practiceDays : [],
        cards,
        rooms,
        moved,
        room,
        spans: window.SparkLean
          ? { refusal: window.SparkLean.REFUSAL_SLEEP_DAYS, rest: window.SparkLean.OFFER_REST_DAYS }
          : undefined
      },
      leanState
    };
  }

  let askStarting = false;

  async function startAsk() {
    if (askStarting || document.querySelector(".spark-roam")) return;
    askStarting = true;
    try {
      dismissOffer();
      if (!(await yieldToMeeting())) return;
      const record = readRecord();
      if (!record) { bringMeeting(); return; }
      if (document.querySelector(".spark-roam")) return;
      await runAsk(record);
    } finally {
      askStarting = false;
    }
  }

  async function runAsk(record) {
    await ensureVoice();
    if (!(await ensureAnswers())) return;
    const companion = Core.generate(record.seed);
    if (!companion) return;
    const Answers = window.SparkAnswers;
    const name = Core.displayName(record, companion);

    const roam = createRoamer(record, companion, keeperFigure(record, companion), (r) => {
      r.whoEl.textContent = name;
      r.textEl.textContent =
        "Ask me about your own world — the day, your cards, the days you've sealed. " +
        "I answer from your records, here on this device. And when I don't know, I'll say so.";
      r.hintEl.textContent = "Tap a question — or write your own on the line.";
    });
    roam.el.classList.add("is-ask");

    /* The line to type on, under the offered questions —
     * a keeper has to type somewhere, as with the naming. */
    const speech = roam.el.querySelector(".spark-roam-speech");
    const askBar = document.createElement("div");
    askBar.className = "spark-ask-bar";
    askBar.innerHTML =
      `<input type="text" class="spark-ask-input" placeholder="Ask me anything…" ` +
      `aria-label="Ask your Spark a question" autocomplete="off">` +
      `<button type="button" class="spark-ask-send">Ask</button>`;
    speech.appendChild(askBar);
    const input = askBar.querySelector(".spark-ask-input");
    const send = askBar.querySelector(".spark-ask-send");

    let over = false;
    let restTimer = null;
    const startY = window.scrollY;

    function armRest() {
      window.clearTimeout(restTimer);
      restTimer = window.setTimeout(end, ROAM_REST_MS + 15000);
    }

    function end() {
      if (over) return;
      over = true;
      window.clearTimeout(restTimer);
      document.removeEventListener("pointerdown", onOutside, true);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKey, true);
      sendHome(roam);
    }

    function onOutside(e) {
      if (e.target.closest && e.target.closest(".spark-roam")) return;
      end();
    }

    function onScroll() {
      if (Math.abs(window.scrollY - startY) > 160) end();
    }

    function onKey(e) {
      if (e.key === "Escape") end();
    }

    document.addEventListener("pointerdown", onOutside, true);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKey, true);
    roam.figureBtn.setAttribute("aria-label",
      `You are asking ${name}. Tap the Spark, and it will go home.`);
    roam.figureBtn.addEventListener("click", end);

    /* The offered questions stand as big tappable words;
     * an answer that names a road adds its word beside
     * them, gold, the way the Spark offers on a tour. */
    function showChoices(extra) {
      roam.choicesEl.hidden = false;
      roam.choicesEl.innerHTML = "";
      const add = (label, fn, go) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "spark-roam-choice" + (go ? " is-go" : "");
        b.textContent = label;
        b.addEventListener("click", fn);
        roam.choicesEl.appendChild(b);
      };
      for (const q of Answers.QUESTIONS.slice(0, 3)) {
        add(q.label, () => ask(q.id));
      }
      add("What is this room?", () => ask("room"));
      add("What should I do next?", () => ask("next"));
      if (extra && extra.href) {
        add(extra.label || "Go", () => { window.location.href = extra.href; }, true);
      }
    }

    async function ask(question) {
      if (over) return;
      armRest();
      const { world, leanState } = await collectWorld(record, companion);
      if (over) return;
      const a = Answers.answer(question, world, leanState);
      roam.textEl.textContent = a.text;
      roam.hintEl.textContent = "Ask me another — or tap me, and I'll go home.";
      showChoices(a.href ? { href: a.href, label: a.label } : null);
      speak(companion, a.text);
    }

    send.addEventListener("click", () => {
      const text = input.value.trim();
      if (text) { input.value = ""; ask(text); }
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const text = input.value.trim();
        if (text) { input.value = ""; ask(text); }
      }
      e.stopPropagation();
    });
    input.addEventListener("pointerdown", (e) => e.stopPropagation());

    showChoices(null);
    armRest();
    /* It comes up from its seat, as on a tour: a short
     * rise, settled on the calmest ground nearby. */
    window.setTimeout(() => {
      if (over) return;
      const seat = roam.home || cornerPoint();
      const desired = {
        x: seat.x + (seat.x > window.innerWidth / 2 ? -40 : 40),
        y: seat.y - 168
      };
      placeRoam(roam, calmPoint(roam, desired, { floor: window.innerHeight - 88 }),
        false, { floor: window.innerHeight - 88 });
    }, 60);
  }

  /* ============ THE TOUR BUTTON ============
   * The standing way back in: a small quiet button in the
   * corner of every room the Spark walks, for keepers only.
   * On the first page it calls the quick tour; elsewhere it
   * calls that room's guided tour. */
  /* The first page's path rail owns the bottom of the screen
   * on small screens (pass 8 — Aaron's phone: the Tour button
   * stood wholly underneath the rail, and the Ask button sat
   * on the doorstep's own "Not now"). The buttons rise by the
   * rail's own measure, the way the presence lifts its
   * furniture; where no rail stands, the stylesheet's measure
   * stands untouched. */
  function railLift() {
    try {
      const rail = document.querySelector(".le-rail");
      if (!rail) return 0;
      const rect = rail.getBoundingClientRect();
      const atBottom = Math.abs(rect.bottom - window.innerHeight) <= 2;
      return atBottom && rect.height > 0 ? Math.ceil(rect.height) + 8 : 0;
    } catch { return 0; }
  }

  function liftLaunchers() {
    const lift = railLift();
    const tour = document.querySelector(".spark-tour-launcher");
    const ask = document.querySelector(".spark-ask-launcher");
    if (tour) tour.style.bottom = lift > 0 ? `${12 + lift}px` : "";
    if (ask) ask.style.bottom = lift > 0 ? `${68 + lift}px` : "";
  }

  function renderLauncher() {
    if (document.querySelector(".spark-tour-launcher")) return;
    if (!readRecord()) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "spark-tour-launcher";
    btn.textContent = "✦ Tour";
    btn.setAttribute("aria-label", "A guided tour of this room, led by your Spark");
    btn.addEventListener("click", () => {
      dismissOffer();
      if (pageKey() === "index.html") startQuickTour();
      else startPageTour();
    });
    document.body.appendChild(btn);
    const askBtn = document.createElement("button");
    askBtn.type = "button";
    askBtn.className = "spark-ask-launcher";
    askBtn.textContent = "✦ Ask";
    askBtn.setAttribute("aria-label", "Ask your Spark about your own world");
    askBtn.addEventListener("click", () => {
      dismissOffer();
      startAsk();
    });
    document.body.appendChild(askBtn);
    liftLaunchers();
    window.addEventListener("resize", liftLaunchers);
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
        dismissOffer();
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

  window.SparkIntro = { start: startQuickTour, startPageTour, offerIntroTour, ask: startAsk };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
