(() => {
  "use strict";

  /*
   * The Evolution Opening — how the Sphere grew, told on the Sphere.
   *
   * Aaron's design, in his words (Nov 23, 2026): "the first time
   * they go and they look at the sphere page it shows the calendars
   * the 13 moons then it starts to show the sphere how it used to
   * look when it first started evolving. Like when I first had that
   * the working prototype, then it evolves into the sphere it is
   * now. And then the spark appears. And then that spark gives the
   * tour and all that the intro and all that stuff." — "Build it."
   *
   * Four stages, inside the real Sphere page, ending inside the
   * real, live Sphere:
   *   1. The Calendars — the 13 Moons as their flat calendar form,
   *      a 13 × 28 grid drawn from PatternCalendarData, with today
   *      marked from PatternCalendar itself.
   *   2. The First Sphere — the Sphere as it actually looked in
   *      its first build (July 23, 2026, PR #63, commit eb9afbc5):
   *      a flat ring of thirteen numbered wedges on a dark disc.
   *      The portrait below is drawn again from that build's own
   *      drawing code — its layout fractions, its elements, its
   *      colours — with the markers standing where the page's own
   *      Alignment Ledger places them today. Nothing about the old
   *      look is invented; where the ledger cannot speak, an
   *      element is left out rather than placed by guess.
   *   3. The Sphere Now — the overlay steps aside and the visitor
   *      is standing in front of the real Sphere, live. No second
   *      canvas, no picture of it: the instrument itself.
   *   4. The Spark Appears — narration only. The demonstration
   *      presents no Spark of its own: no figure, no name, no
   *      tour (Aaron, Nov 27, 2026: "Take out the 1 through 4
   *      spark thing. Your actual spark like on the home page
   *      etc can help if needed."). A demo must never present a
   *      generated stand-in as the keeper's Spark. Instead, as
   *      this beat stands, the keeper's actual Spark — when a
   *      companion record stands on this device — is invited
   *      through the page's presence layer (SparkIntro.attend):
   *      it rises from its own seat in its seed's gait and
   *      speaks its line as itself, by its real name. When no
   *      record stands, the beat is words alone, and the
   *      meeting itself stands where it always stood — under
   *      the Sphere, at the doorstep.
   *
   * The fences, held: this is a demonstration and says so on its
   * face, the whole time. It shows only on a first visit (a local
   * flag), never when the visitor arrived at a shared view (a
   * marker or year in the URL), and never twice in one session.
   * Skip stands at every stage. It is replayable afterwards from
   * the guide bar's "See how it grew" door. Reduced motion gets
   * stills and the same words. It drives nothing in the Sphere
   * except, at the very end and only at the visitor's tap, the
   * guide bar's own Today button — the page's public controls,
   * like every companion-layer piece before it. No protected file
   * is touched; the loader in sphere-companion-layer.js is the
   * only hook.
   *
   * The cinematic amendment (Aaron, Nov 23, 2026, over the
   * preview): "I think this should play automatically and
   * cinematically. With music and everything." — and, a breath
   * later: the film opens on a held title card, "Welcome to the
   * Sphere", and it plays automatically ONLY for a first-time
   * visitor; once it has played or been skipped it never
   * autoplays again, and the door's replay stays a choice. So
   * the staged walk above is now a film: the welcome beat, then
   * the four stages advancing on their own timing — holds
   * weighted by each stage's weight, slow crossfades, a gentle
   * push-in, held quiet between the beats (the bible's §10: the
   * road has quiet places; silence here is composed, not empty).
   * The walk after the film keeps its keeper-paced form, and
   * the film ends where the opening always ended — the Spark's
   * beat standing, "Take me to today" at the last.
   *
   * The sound is ONE opening cinematic sound — Aaron's word
   * over the earlier composed score (Nov 23, 2026): "Rather
   * then doing music and sound it can auto play with a opening
   * cinematic type of sound that's fitting for the Codex of
   * reality." So there is no score any more: a single deep
   * swell at the root, D — a low struck bowl and a slow breath
   * rising together, tuned at A=432 like everything on this
   * instrument — swelling as the film opens, holding through
   * the growth, and settling as the scrim lifts into the live
   * Sphere. It is synthesised on the device at play time; the
   * opening carries no audio file. THE SOUND RULE, held
   * exactly: no sound before a first touch. Browsers will not
   * start audio before a gesture, and this site never
   * autoplays sound — so the film starts moving silently, the
   * welcome beat carries the invitation ("touch anywhere to
   * let it in") as part of the scene, and the first touch
   * brings the swell in at the film's current point. A keeper
   * who never touches watches the whole film silent, and it
   * is built to stand silent. A replay tapped at the door is
   * itself a touch, so a replay sounds from the first beat.
   *
   * The seen flag (v2): the v1 flag recorded the staged
   * click-through that stood here before the film existed —
   * a visitor who closed that walk had "seen" a thing that
   * was not the film, and the film then never played for
   * them (Aaron's own phone, Nov 23, 2026). The film keeps
   * its own first-visit flag. And the flag is earned by a
   * first beat actually painting — never by the overlay
   * merely being built: a botched or blocked load, or an
   * open in a background tab nobody looked at, does not rob
   * a first-time visitor of the opening.
   */

  const VERSION = "sphere-evolution-opening/1.3.0";
  const SEEN_KEY = "sof.sphere.evolutionOpening.v2";
  const SESSION_KEY = "sof.sphere.evolutionOpening.session";

  /* ── Pure core (also loaded by the tests) ───────────────────── */

  const MOONS = 13;
  const DAYS_PER_MOON = 28;
  const PATTERN_DAYS = 364;

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  // The first build's own convention: degrees, clockwise from the
  // top (12 o'clock = 0°). Copied from living-time-sphere-layout.js
  // at eb9afbc5 — a file that is, in fact, byte-identical on main
  // today; the fractions below are its ring fractions verbatim.
  function polarToXY(angle, r, cx, cy) {
    const radians = ((angle - 90) * Math.PI) / 180;
    return {
      x: Number((cx + r * Math.cos(radians)).toFixed(4)),
      y: Number((cy + r * Math.sin(radians)).toFixed(4)),
    };
  }

  function patternAngleForDayOfYear(dayOfYear) {
    const idx = clamp((dayOfYear || 1) - 1, 0, PATTERN_DAYS - 1);
    return Number(((idx / PATTERN_DAYS) * 360).toFixed(6));
  }

  // The first build's spiral formulas, verbatim from
  // living-time-sphere-model.js at eb9afbc5.
  function spiralAngleForYear(year, range) {
    const { start, end } = range || { start: 2014, end: 2026 };
    const span = end - start;
    const idx = clamp(year - start, 0, span);
    return Number(((idx / (span || 1)) * 360 * (span / 13 + 1)).toFixed(6));
  }

  function spiralRadiusForYear(year, range) {
    const { start, end } = range || { start: 2014, end: 2026 };
    const span = end - start;
    const idx = clamp(year - start, 0, span);
    return Number((idx / (span || 1)).toFixed(6));
  }

  // Stage 1's data: thirteen moons of twenty-eight days, with
  // today's cell flagged when a real coordinate is supplied.
  function buildCalendarGrid({ moonNames, today } = {}) {
    const names = Array.isArray(moonNames) && moonNames.length === MOONS
      ? moonNames
      : Array.from({ length: MOONS }, (_, i) => `Moon ${i + 1}`);
    return names.map((name, i) => {
      const moon = i + 1;
      const days = Array.from({ length: DAYS_PER_MOON }, (_, d) => {
        const day = d + 1;
        return {
          day,
          isToday: Boolean(today && today.moon === moon && today.day === day),
        };
      });
      return {
        moon,
        name,
        days,
        isTodayMoon: Boolean(today && today.moon === moon),
      };
    });
  }

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Stage 2's portrait: the first Sphere, drawn again from its own
  // build's drawing code (living-time-sphere-renderer-svg.js and
  // living-time-sphere-layout.js at eb9afbc5). `data` carries only
  // positions the page's own records supplied; any element whose
  // position is missing is omitted, exactly as the first renderer
  // omitted layers it was not given.
  function buildFirstSphereSVG(data = {}, size = 400) {
    const w = size, h = size, cx = w / 2, cy = h / 2;
    const radius = (Math.min(w, h) / 2) - Math.round(Math.min(w, h) * 0.05);
    const rings = {
      outerBorder: radius,
      annualMarkers: Number((radius * 0.95).toFixed(2)),
      solarAxis: Number((radius * 0.90).toFixed(2)),
      passageArc: Number((radius * 0.85).toFixed(2)),
      lunarOrbit: Number((radius * 0.78).toFixed(2)),
      patternRing: Number((radius * 0.70).toFixed(2)),
      moonSectors: Number((radius * 0.68).toFixed(2)),
      moonDayPoints: Number((radius * 0.60).toFixed(2)),
      spiralOuter: Number((radius * 0.50).toFixed(2)),
      spiralInner: Number((radius * 0.10).toFixed(2)),
    };
    const parts = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" class="evo-first-sphere-svg" role="img" aria-label="The first Sphere, as it was drawn in July 2026: a flat ring of thirteen numbered moons on a dark disc">`);
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${rings.outerBorder}" fill="#0a0a14" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" />`);
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${rings.patternRing}" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2" />`);

    // Moon sectors — wedges with their numbers, the active moon
    // (today's, when known) filled amber, as the first build did.
    for (let i = 0; i < MOONS; i++) {
      const startAngle = (i / MOONS) * 360;
      const endAngle = ((i + 1) / MOONS) * 360;
      const active = data.todayMoon === i + 1;
      const { x: x1, y: y1 } = polarToXY(startAngle, rings.moonSectors, cx, cy);
      const { x: x2, y: y2 } = polarToXY(endAngle, rings.moonSectors, cx, cy);
      const label = polarToXY((startAngle + endAngle) / 2, rings.moonDayPoints - 8, cx, cy);
      const large = (endAngle - startAngle) > 180 ? 1 : 0;
      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${rings.moonSectors} ${rings.moonSectors} 0 ${large} 1 ${x2} ${y2} Z`;
      const fill = active ? "rgba(220,160,80,0.25)" : "rgba(255,255,255,0.04)";
      parts.push(`<path d="${d}" fill="${fill}" stroke="rgba(255,255,255,0.15)" stroke-width="1"><title>Moon ${i + 1}</title></path>`);
      parts.push(`<text x="${label.x}" y="${label.y}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="rgba(255,255,255,0.5)">${i + 1}</text>`);
    }

    // The solar axis — a dashed line through the centre.
    const ax1 = polarToXY(0, rings.solarAxis, cx, cy);
    const ax2 = polarToXY(180, rings.solarAxis, cx, cy);
    parts.push(`<line x1="${ax1.x}" y1="${ax1.y}" x2="${ax2.x}" y2="${ax2.y}" stroke="rgba(255,220,80,0.3)" stroke-width="1" stroke-dasharray="4 4" />`);

    // The year spiral — one point per study year, each placed by
    // the first build's own formulas at that year's equinox angle.
    const years = Array.isArray(data.years) ? data.years.filter((y) => y && y.equinoxAngle != null) : [];
    if (years.length > 1) {
      const pts = years.map((y) => {
        const r = rings.spiralInner
          + (rings.spiralOuter - rings.spiralInner) * spiralRadiusForYear(y.year, data.studyRange);
        return polarToXY(y.equinoxAngle, r, cx, cy);
      });
      const d = "M " + pts.map((p) => `${p.x} ${p.y}`).join(" L ");
      parts.push(`<path d="${d}" fill="none" stroke="rgba(100,200,180,0.4)" stroke-width="1.5" />`);
      // Annual markers on their ring; the selected year in gold.
      for (const y of years) {
        const p = polarToXY(y.equinoxAngle, rings.annualMarkers, cx, cy);
        const sel = y.selected === true;
        parts.push(`<circle cx="${p.x}" cy="${p.y}" r="${sel ? 6 : 4}" fill="${sel ? "rgba(251,191,36,1)" : "rgba(255,255,255,0.5)"}"><title>${esc(String(y.year))}</title></circle>`);
      }
    }

    // The Equinox Passage arc — from the equinox position back to
    // the Year Gate at the top, as the first build drew it.
    if (data.equinoxAngle != null) {
      let sweep = 0 - data.equinoxAngle;
      if (sweep <= 0) sweep += 360;
      const start = polarToXY(data.equinoxAngle, rings.passageArc, cx, cy);
      const end = polarToXY(data.equinoxAngle + sweep, rings.passageArc, cx, cy);
      const large = sweep > 180 ? 1 : 0;
      parts.push(`<path d="M ${start.x} ${start.y} A ${rings.passageArc} ${rings.passageArc} 0 ${large} 1 ${end.x} ${end.y}" fill="none" stroke="rgba(251,191,36,0.8)" stroke-width="3" stroke-linecap="round"><title>Equinox Passage${data.passageDays ? `: ${esc(String(data.passageDays))} days` : ""}</title></path>`);
      const gate = polarToXY(data.equinoxAngle, rings.patternRing, cx, cy);
      parts.push(`<circle cx="${gate.x}" cy="${gate.y}" r="7" fill="rgba(251,191,36,0.9)" stroke="#0a0a14" stroke-width="2"><title>Equinox Gate</title></circle>`);
    }

    // The lunar orbit — its ring, and the moon's marker where the
    // ledger places it today.
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${rings.lunarOrbit}" fill="none" stroke="rgba(180,180,255,0.2)" stroke-width="1" />`);
    if (data.lunarAngle != null) {
      const m = polarToXY(data.lunarAngle, rings.lunarOrbit, cx, cy);
      parts.push(`<circle cx="${m.x}" cy="${m.y}" r="6" fill="rgba(180,180,255,0.8)" stroke="#0a0a14" stroke-width="1.5"><title>Lunar cycle position</title></circle>`);
    }

    // The Year Gate at the top, and the centre point.
    const yg = polarToXY(0, rings.patternRing, cx, cy);
    parts.push(`<circle cx="${yg.x}" cy="${yg.y}" r="7" fill="rgba(100,255,180,0.9)" stroke="#0a0a14" stroke-width="2"><title>Year Gate (Moon 1, Day 1)</title></circle>`);
    parts.push(`<circle cx="${cx}" cy="${cy}" r="4" fill="rgba(255,255,255,0.6)" />`);
    parts.push(`</svg>`);
    return parts.join("\n");
  }

  // The stage deck. Copy stays short and plain; anything about
  // today is filled from the real coordinate at show time, never
  // written in advance.
  const STAGES = Object.freeze([
    {
      id: "calendars",
      kicker: "How it grew · 1 of 4",
      title: "First, the year lay flat.",
      line: "Thirteen moons of twenty-eight days — 364 days, counted flat. This is the calendar the Sphere grew from.",
    },
    {
      id: "first-sphere",
      kicker: "How it grew · 2 of 4",
      title: "Then the year stood up in a ring.",
      line: "The first Sphere, July 23, 2026: thirteen numbered wedges on a dark disc, drawn with lines. This portrait is drawn again from that build's own drawing code — and its markers stand where the record places them today.",
    },
    {
      id: "sphere-now",
      kicker: "How it grew · 3 of 4",
      title: "And then it kept growing.",
      line: "This is the Sphere now — the real one, live under your hand. Rings for the farm, the sky, and the story; every day a place you can enter.",
    },
    {
      id: "spark",
      kicker: "How it grew · 4 of 4",
      title: "And then the Spark came.",
      line: "",
    },
  ]);

  // The Spark's beat, as narration. The demonstration tells
  // this beat; it does not cast it — no figure, no name, no
  // tour stands in the demo (Aaron, Nov 27, 2026). Which line
  // stands depends on whether the visitor's own Spark stands
  // on this device, read at show time, never written in
  // advance. The Spark itself, when one stands, attends
  // through the presence layer — see inviteSpark below.
  const SPARK_LINE_OWN =
    "Your Spark rides this Sphere with you, and answers from your record, on this device. It stands by the Sphere — tap it there to talk.";
  const SPARK_LINE_NONE =
    "The Spark rides this Sphere with its keeper, and answers from their record, on their device. When you meet your own Spark — the meeting stands under the Sphere — it will ride here with you.";

  function shouldAutoOpen({ seen, sessionShown, sharedView } = {}) {
    return !seen && !sessionShown && !sharedView;
  }

  /* ── The film ─────────────────────────────────────────────── */

  // The film's beats and their holds. The welcome is a held
  // title card (Aaron's words for it: "Welcome to the Sphere");
  // each stage then holds by its weight, not a metronome. The
  // whole film runs just under forty seconds; the crossfades
  // ride inside the holds.
  const FILM_STAGES = Object.freeze([
    { id: "welcome", holdMs: 2600 },
    { id: "calendars", holdMs: 10400 },
    { id: "first-sphere", holdMs: 9500 },
    { id: "sphere-now", holdMs: 8500 },
    { id: "spark", holdMs: 8500 },
  ]);
  const FILM_TOTAL_MS = FILM_STAGES.reduce((n, s) => n + s.holdMs, 0);

  // The film plays wherever motion is welcome. Reduced motion
  // keeps the staged form — the still version — exactly as it
  // stands above; the film is never forced on it.
  function shouldPlayFilm({ reducedMotion } = {}) {
    return !reducedMotion;
  }

  /* ── The one sound ────────────────────────────────────────── */

  // A=432 throughout: notes are MIDI numbers, tuned from
  // A4 = 432 Hz. The root is D — the showcase's own root —
  // taken two octaves down, where a struck bowl lives. The
  // plan is data, so the tests can hold it to the film's
  // shape. There is exactly one event: the swell. Its
  // envelope rises slowly over the welcome and the calendars,
  // holds its depth over the first Sphere, and settles as
  // the scrim lifts into the live Sphere — the sphere-now
  // beat begins at 22.5s — falling quiet a breath after, so
  // the Spark's beat stands in silence.
  const SWELL_ROOT_MIDI = 38; // D2

  function freqFor(midi) {
    return Number((432 * Math.pow(2, (midi - 69) / 12)).toFixed(2));
  }

  function buildCinematicSwell() {
    return Object.freeze({
      voice: "swell",
      midi: SWELL_ROOT_MIDI,
      freq: freqFor(SWELL_ROOT_MIDI),
      at: 0,
      dur: 27,
      // (seconds into the film, level) — a slow rise, a held
      // depth, then the settle, done just after the reveal.
      envelope: Object.freeze([
        Object.freeze([0, 0]),
        Object.freeze([7, 1]),
        Object.freeze([20, 0.85]),
        Object.freeze([27, 0]),
      ]),
    });
  }

  const api = Object.freeze({
    VERSION,
    SEEN_KEY,
    SESSION_KEY,
    STAGES,
    SPARK_LINE_OWN,
    SPARK_LINE_NONE,
    FILM_STAGES,
    FILM_TOTAL_MS,
    SWELL_ROOT_MIDI,
    buildCalendarGrid,
    buildFirstSphereSVG,
    patternAngleForDayOfYear,
    spiralAngleForYear,
    spiralRadiusForYear,
    shouldAutoOpen,
    shouldPlayFilm,
    freqFor,
    buildCinematicSwell,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof document === "undefined") return;

  /* ── Browser boot ───────────────────────────────────────────── */

  const global = typeof globalThis !== "undefined" ? globalThis : window;
  global.SphereEvolutionOpening = Object.freeze({
    VERSION,
    open: () => openOpening("door"),
    // A read-only window onto the film, for the tests and for
    // anyone checking the sound rule from the console: the mode
    // (closed / still / film / kept), the stage standing, and
    // whether a touch has armed the sound yet.
    filmState: () => currentFilmState(),
    reset: () => {
      try { localStorage.removeItem(SEEN_KEY); } catch { /* private mode */ }
    },
  });

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (sel, base) => (base || document).querySelector(sel);

  function storeGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function storeSet(key, value) {
    try { localStorage.setItem(key, value); } catch { /* private mode */ }
  }
  function sessionGet(key) {
    try { return sessionStorage.getItem(key); } catch { return null; }
  }
  function sessionSet(key, value) {
    try { sessionStorage.setItem(key, value); } catch { /* private mode */ }
  }

  function todayCoordinate() {
    try {
      if (window.PatternCalendar?.fromCivilDate) {
        // The house day (Aaron's ruling, Nov 26, 2026 — the whole
        // site reads the day from local midnight): the device's own
        // zone and the midnight boundary, the same call the page's
        // Today chip is fed by. A bare call read the UTC day and
        // the card named tomorrow while the page named today
        // (Aaron's screenshot, Nov 27, 2026, 21:07 PST: the card
        // said Pattern Day 226 on Pattern Day 225).
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        return window.PatternCalendar.fromCivilDate({ date: new Date(), timeZone, boundaryMode: "midnight" });
      }
    } catch { /* fall through */ }
    return null;
  }

  function todayLine(today) {
    if (!today || today.moon == null || today.day == null) return "";
    const moonName = today.moonName ? ` · ${today.moonName}` : "";
    return `Today is Moon ${today.moon} · Day ${today.day}${moonName} — Pattern Day ${today.dayOfPatternYear}.`;
  }

  // Stage 2's live positions, from the page's own Alignment
  // Ledger — the same source the first build's model read. Every
  // read is guarded; whatever the ledger cannot give is omitted
  // from the portrait, never guessed.
  function firstSphereData(today) {
    const data = {
      todayMoon: today?.moon ?? null,
      equinoxAngle: null,
      passageDays: 0,
      lunarAngle: null,
      years: [],
      studyRange: null,
    };
    try {
      const ledger = window.AlignmentLedgerData;
      if (!ledger?.getRecord || !ledger?.listSupportedYears) return data;
      const range = global.AlignmentVersion?.studyRange;
      if (range && Number.isFinite(range.start) && Number.isFinite(range.end)) {
        data.studyRange = { start: range.start, end: range.end };
      }
      const years = ledger.listSupportedYears();
      if (!Array.isArray(years) || !years.length) return data;
      const nowYear = new Date().getUTCFullYear();
      const selected = years.includes(nowYear) ? nowYear : years[years.length - 1];
      data.years = years.map((year) => {
        const rec = ledger.getRecord({ year });
        const doy = rec?.equinox?.patternPosition?.dayOfPatternYear;
        return {
          year,
          equinoxAngle: doy != null ? patternAngleForDayOfYear(doy) : null,
          selected: year === selected,
        };
      });
      const rec = ledger.getRecord({ year: selected });
      const doy = rec?.equinox?.patternPosition?.dayOfPatternYear;
      if (doy != null) data.equinoxAngle = patternAngleForDayOfYear(doy);
      data.passageDays = rec?.offsets?.equinoxToYearGateDays || 0;
      const lunarPos = rec?.normalized?.lunarCyclePosition;
      if (lunarPos != null) data.lunarAngle = Number((lunarPos * 360).toFixed(6));
    } catch { /* the portrait stands on what it has */ }
    return data;
  }

  // Whether the visitor's own Spark stands on this device —
  // the same read the Spark seat makes: the companion record,
  // by its seed. Read-only; the demonstration writes nothing,
  // and it draws nothing from the record either: the record
  // only chooses which narration line stands.
  function hasSparkRecord() {
    try {
      const Core = window.SparkCompanion;
      if (!Core?.STORAGE_KEY) return false;
      const raw = localStorage.getItem(Core.STORAGE_KEY);
      const record = raw ? JSON.parse(raw) : null;
      return Boolean(record?.seed);
    } catch { return false; }
  }

  // The Spark's beat invites the keeper's actual Spark
  // through the page's presence layer — the same layer that
  // walks the tours and answers the Ask. The Spark rises as
  // itself, by its real name, in its seed's gait and voice.
  // If the layer is not standing, or no Spark stands, the
  // beat remains narration and nothing is invented to fill it.
  function inviteSpark() {
    try {
      const intro = window.SparkIntro;
      if (intro && typeof intro.attend === "function") intro.attend();
    } catch { /* the narration stands */ }
  }

  // Leaving the beat rests the attending Spark back home.
  function leaveSparkBeat() {
    try {
      const intro = window.SparkIntro;
      if (intro && typeof intro.dismissAttend === "function") intro.dismissAttend();
    } catch { /* nothing to rest */ }
  }

  let overlay = null;
  let stageIndex = 0;
  let lastFocus = null;

  /* ── The film's state ─────────────────────────────────────── */

  let filmActive = false;
  let filmTimers = [];
  let filmStartedAt = 0;
  let soundArmed = false;
  let audioCtx = null;
  let audioMaster = null;
  let swellSources = [];
  let noiseBuffer = null;

  function currentFilmState() {
    return {
      mode: !overlay ? "closed" : reducedMotion ? "still" : filmActive ? "film" : "kept",
      stage: overlay ? overlay.dataset.stage || "" : "",
      soundArmed,
      audioStarted: Boolean(audioCtx),
    };
  }

  function filmElapsed() {
    return filmStartedAt ? (performance.now() - filmStartedAt) / 1000 : 0;
  }

  function showSoundCue() {
    const cue = overlay?.querySelector('[data-evo="sound"]');
    if (cue && filmActive && !soundArmed) cue.hidden = false;
  }

  function hideSoundCue() {
    const cue = overlay?.querySelector('[data-evo="sound"]');
    if (cue) cue.hidden = true;
  }

  function restartPush() {
    const card = overlay?.querySelector(".evo-card");
    if (!card || !filmActive) return;
    card.classList.remove("is-pushing");
    void card.offsetWidth; // restart the push-in on the new beat
    card.classList.add("is-pushing");
  }

  function crossfadeTo(fn) {
    if (!overlay) return;
    overlay.classList.add("is-xfade");
    window.setTimeout(() => {
      if (!overlay) return;
      fn();
      overlay.classList.remove("is-xfade");
      restartPush();
    }, 560);
  }

  function renderWelcome() {
    if (!overlay) return;
    overlay.dataset.stage = "welcome";
    overlay.classList.remove("is-reveal");
    overlay.querySelector('[data-evo="kicker"]').textContent = "How it grew";
    overlay.querySelector('[data-evo="title"]').textContent = "Welcome to the Sphere";
    overlay.querySelector('[data-evo="visual"]').innerHTML = "";
    overlay.querySelector('[data-evo="line"]').textContent =
      "A short film — how this instrument grew, told once, before the day begins.";
    overlay.querySelector('[data-evo="today"]').textContent = "";
    overlay.querySelector('[data-evo="dots"]').innerHTML = STAGES.map(() =>
      `<span class="evo-dot"></span>`).join("");
    showSoundCue();
  }

  function startFilm() {
    if (!overlay || reducedMotion) return;
    filmActive = true;
    filmStartedAt = performance.now();
    overlay.classList.add("is-film");
    renderWelcome();
    restartPush();
    let at = FILM_STAGES[0].holdMs;
    FILM_STAGES.slice(1).forEach((stage, i) => {
      const filmIdx = i + 1;
      filmTimers.push(window.setTimeout(() => advanceFilm(filmIdx), at));
      at += stage.holdMs;
    });
    filmTimers.push(window.setTimeout(endFilm, FILM_TOTAL_MS));
  }

  function advanceFilm(filmIdx) {
    if (!overlay || !filmActive) return;
    const target = FILM_STAGES[filmIdx];
    crossfadeTo(() => {
      if (!overlay || !filmActive) return;
      if (target.id === "spark") { stageIndex = STAGES.length - 1; }
      else stageIndex = filmIdx - 1;
      renderStage();
    });
  }

  // The film's last hold runs out: the Spark's beat is
  // standing, and the keeper takes the walk from here,
  // ending at "Take me to today".
  function endFilm() {
    if (!overlay) return;
    filmActive = false;
    filmTimers.forEach((t) => window.clearTimeout(t));
    filmTimers = [];
    overlay.classList.remove("is-film");
    overlay.classList.remove("is-xfade");
    hideSoundCue();
  }

  // The keeper touches the walk — a button, an arrow key — and
  // the film hands over: timers stop, the sound fades, the
  // staged controls stand again.
  function stopFilm() {
    if (!filmActive) return;
    endFilm();
    stopSound();
  }

  /* ── The one sound, synthesised ───────────────────────────── */

  // THE SOUND RULE: this is the only door to sound in the
  // module, and it is opened only by a gesture — the door tap
  // that replays the film, or the first touch or keypress while
  // the film is playing. No AudioContext exists before it.
  function armSound() {
    if (soundArmed || reducedMotion || !overlay) return;
    soundArmed = true;
    hideSoundCue();
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      audioCtx = new AC();
      const comp = audioCtx.createDynamicsCompressor();
      comp.threshold.value = -20;
      comp.ratio.value = 6;
      comp.connect(audioCtx.destination);
      audioMaster = audioCtx.createGain();
      audioMaster.gain.value = 0;
      audioMaster.connect(comp);
      audioMaster.gain.setTargetAtTime(0.55, audioCtx.currentTime, 0.4);
      if (audioCtx.resume) audioCtx.resume();
      startSwell();
    } catch { audioCtx = null; }
  }

  function onFirstGesture() {
    if (overlay && filmActive) armSound();
  }

  // The swell's clock is the film's clock: a first touch at
  // second twenty brings the sound in AT second twenty — the
  // swell met at the depth it has already reached, its
  // remaining shape played out from there. A touch after the
  // swell has settled brings nothing: the moment has passed,
  // and the film stands silent, as it was built to.
  function startSwell() {
    if (!audioCtx || !audioMaster) return;
    const swell = buildCinematicSwell();
    const offset = filmElapsed();
    if (offset >= swell.dur) return;
    playSwell(swell, offset);
  }

  function swellLevelAt(swell, t) {
    const pts = swell.envelope;
    if (t <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (t <= pts[i][0]) {
        const [t0, l0] = pts[i - 1];
        const [t1, l1] = pts[i];
        return l0 + (l1 - l0) * ((t - t0) / (t1 - t0));
      }
    }
    return pts[pts.length - 1][1];
  }

  // One sound, two strands: a low struck bowl at the root —
  // its partials hanging together — and a breath of filtered
  // noise rising slowly beneath it, both breathing through
  // the one envelope.
  function playSwell(swell, offset) {
    const ctx = audioCtx;
    const now = ctx.currentTime + 0.05;
    const remaining = swell.dur - offset;
    const g = ctx.createGain();
    g.gain.setValueAtTime(swellLevelAt(swell, offset) * 0.6, now);
    for (const [t, level] of swell.envelope) {
      if (t > offset) g.gain.linearRampToValueAtTime(level * 0.6, now + (t - offset));
    }
    g.connect(audioMaster);
    const partials = [[1, 1], [1.5, 0.38], [2.02, 0.5], [2.74, 0.27], [3.76, 0.14]];
    for (const [ratio, amp] of partials) {
      const og = ctx.createGain();
      og.gain.value = amp;
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = swell.freq * ratio;
      o.connect(og);
      og.connect(g);
      o.start(now);
      o.stop(now + remaining + 0.1);
      swellSources.push(o);
    }
    const noise = noiseSource();
    if (noise) {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 1.1;
      const riseEnd = Math.max(0.1, Math.min(7 - offset, remaining));
      bp.frequency.setValueAtTime(offset < 7 ? 240 + 640 * (offset / 7) : 880, now);
      bp.frequency.linearRampToValueAtTime(880, now + riseEnd);
      if (remaining > riseEnd) {
        bp.frequency.linearRampToValueAtTime(320, now + remaining);
      }
      const ng = ctx.createGain();
      ng.gain.value = 0.14;
      noise.connect(bp);
      bp.connect(ng);
      ng.connect(g);
      noise.start(now);
      noise.stop(now + remaining + 0.1);
      swellSources.push(noise);
    }
  }

  function stopSound() {
    swellSources = [];
    if (!audioCtx) return;
    const ctx = audioCtx;
    const master = audioMaster;
    audioCtx = null;
    audioMaster = null;
    // A short fade, then the context closes — no tail of
    // sound follows the keeper out of the opening.
    try {
      if (master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
    } catch { /* the close below still stands */ }
    window.setTimeout(() => { try { ctx.close(); } catch { /* already closed */ } }, 450);
  }

  function noiseSource() {
    if (!audioCtx) return null;
    if (!noiseBuffer) {
      const len = audioCtx.sampleRate;
      noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    return src;
  }

  function buildOverlay() {
    const wrap = $(".sphere-canvas-wrap");
    if (!wrap) return null;
    const el = document.createElement("div");
    el.className = "evo-opening";
    el.setAttribute("data-evolution-opening", "");
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "How the Sphere grew — a short introduction");
    if (reducedMotion) el.classList.add("is-still");
    el.innerHTML = `
      <div class="evo-scrim" aria-hidden="true"></div>
      <div class="evo-card">
        <p class="evo-demo">A short demonstration — the real Sphere is live underneath</p>
        <p class="evo-kicker" data-evo="kicker"></p>
        <h2 class="evo-title" data-evo="title"></h2>
        <div class="evo-visual" data-evo="visual"></div>
        <p class="evo-line" data-evo="line"></p>
        <p class="evo-today" data-evo="today"></p>
        <p class="evo-sound" data-evo="sound" hidden>The opening carries a sound — touch anywhere to let it in.</p>
        <div class="evo-controls">
          <button type="button" class="evo-btn evo-skip" data-evo="skip">Skip the story</button>
          <span class="evo-dots" data-evo="dots" aria-hidden="true"></span>
          <span class="evo-nav">
            <button type="button" class="evo-btn" data-evo="back">Back</button>
            <button type="button" class="evo-btn evo-next" data-evo="next">Next</button>
          </span>
        </div>
      </div>`;
    wrap.appendChild(el);
    el.querySelector('[data-evo="skip"]').addEventListener("click", () => closeOpening(false));
    el.querySelector('[data-evo="back"]').addEventListener("click", () => step(-1));
    el.querySelector('[data-evo="next"]').addEventListener("click", () => step(1));
    el.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); closeOpening(false); }
      if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
    });
    return el;
  }

  function renderStage() {
    if (!overlay) return;
    const stage = STAGES[stageIndex];
    const today = todayCoordinate();
    overlay.dataset.stage = stage.id;
    overlay.classList.toggle("is-reveal", stage.id === "sphere-now");
    overlay.querySelector('[data-evo="kicker"]').textContent = stage.kicker;
    overlay.querySelector('[data-evo="title"]').textContent = stage.title;
    const visual = overlay.querySelector('[data-evo="visual"]');
    const line = overlay.querySelector('[data-evo="line"]');
    const todayEl = overlay.querySelector('[data-evo="today"]');
    const back = overlay.querySelector('[data-evo="back"]');
    const next = overlay.querySelector('[data-evo="next"]');
    const dots = overlay.querySelector('[data-evo="dots"]');
    dots.innerHTML = STAGES.map((s, i) =>
      `<span class="evo-dot${i === stageIndex ? " is-on" : ""}"></span>`).join("");
    back.hidden = stageIndex === 0;
    todayEl.textContent = "";
    // The today-door belongs to the last beat only; the Spark
    // branch stands it up there. Never let it linger on
    // another stage.
    const staleCta = overlay.querySelector('[data-evo="today-cta"]');
    if (staleCta) staleCta.remove();
    // Leaving the Spark's beat rests the attending Spark.
    if (stage.id !== "spark") leaveSparkBeat();

    if (stage.id === "calendars") {
      const names = global.PatternCalendarData?.moonNames;
      const grid = buildCalendarGrid({ moonNames: names, today });
      visual.innerHTML = `<div class="evo-cal-grid">${grid.map((m) => `
        <div class="evo-cal-moon${m.isTodayMoon ? " is-today-moon" : ""}">
          <p class="evo-cal-moon-name"><span>${m.moon}</span> ${esc(m.name)}</p>
          <div class="evo-cal-days">${m.days.map((d) =>
            `<span class="evo-cal-day${d.isToday ? " is-today" : ""}">${d.day}</span>`).join("")}</div>
        </div>`).join("")}</div>`;
      line.textContent = stage.line;
      todayEl.textContent = todayLine(today);
      next.textContent = "Next";
    } else if (stage.id === "first-sphere") {
      visual.innerHTML = buildFirstSphereSVG(firstSphereData(today));
      line.textContent = stage.line;
      next.textContent = "Next";
    } else if (stage.id === "sphere-now") {
      visual.innerHTML = "";
      line.textContent = stage.line;
      todayEl.textContent = todayLine(today);
      next.textContent = "Next";
    } else if (stage.id === "spark") {
      // Narration only: the demonstration casts no Spark.
      // The keeper's own Spark, when one stands, attends
      // through the presence layer beside the card.
      visual.innerHTML = "";
      line.textContent = hasSparkRecord() ? SPARK_LINE_OWN : SPARK_LINE_NONE;
      todayEl.textContent = todayLine(today);
      next.textContent = "Done";
      // The last beat offers the visitor the door into today itself.
      const cta = document.createElement("button");
      cta.type = "button";
      cta.className = "evo-btn evo-cta";
      cta.setAttribute("data-evo", "today-cta");
      cta.textContent = "Take me to today";
      cta.addEventListener("click", () => closeOpening(true));
      overlay.querySelector(".evo-controls").prepend(cta);
      inviteSpark();
    }
    showSoundCue();
    // During the film the walk drives itself; focus stays
    // where the keeper left it, not on a hidden button.
    if (!filmActive) {
      const focusTarget = overlay.querySelector('[data-evo="next"]');
      if (focusTarget) { try { focusTarget.focus({ preventScroll: true }); } catch { /* focus stands */ } }
    }
  }

  function step(dir) {
    if (!overlay) return;
    // A keeper's step during the film ends the film: the walk
    // is theirs from this beat on.
    stopFilm();
    const nextIndex = stageIndex + dir;
    if (nextIndex < 0) return;
    if (nextIndex >= STAGES.length) { closeOpening(false); return; }
    stageIndex = nextIndex;
    renderStage();
  }

  // The seen flag is earned here — at the moment a first
  // beat actually paints. requestAnimationFrame waits for
  // the visitor's eyes: an overlay built in a background tab,
  // or a load that never reaches a paint, leaves the flag
  // unset, and the visitor's first real look still meets the
  // opening. The session flag is set at the same moment, so
  // a botched load retries on the next visit while a shown
  // opening never repeats within the session.
  let openingRendered = false;

  function markSeenOnceRendered() {
    requestAnimationFrame(() => {
      if (!overlay || openingRendered) return;
      openingRendered = true;
      storeSet(SEEN_KEY, "1");
      sessionSet(SESSION_KEY, "1");
    });
  }

  function openOpening(source) {
    if (overlay) return;
    const wrap = $(".sphere-canvas-wrap");
    if (!wrap) return;
    lastFocus = document.activeElement;
    document.addEventListener("keydown", onDocumentKeydown);
    overlay = buildOverlay();
    if (!overlay) return;
    openingRendered = false;
    stageIndex = 0;
    if (shouldPlayFilm({ reducedMotion })) {
      // The film: it starts moving silently, on its own
      // timing. The first touch arms the sound (see armSound);
      // a door replay is opened BY a touch, so its sound is
      // armed here, inside that very tap, from the first beat.
      document.addEventListener("pointerdown", onFirstGesture, true);
      document.addEventListener("keydown", onFirstGesture, true);
      startFilm();
      if (source === "door") armSound();
    } else {
      renderStage();
    }
    markSeenOnceRendered();
    if (source === "auto") {
      try { wrap.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" }); } catch { /* scroll stands */ }
    }
  }

  function onDocumentKeydown(event) {
    if (event.key === "Escape" && overlay) {
      event.preventDefault();
      closeOpening(false);
    }
  }

  function closeOpening(goToday) {
    if (!overlay) return;
    document.removeEventListener("keydown", onDocumentKeydown);
    document.removeEventListener("pointerdown", onFirstGesture, true);
    document.removeEventListener("keydown", onFirstGesture, true);
    // However the opening closes — played through, skipped,
    // or stepped out of — the film stops and the sound fades
    // with it. The seen flag is NOT set here: it was earned
    // at the first painted beat (markSeenOnceRendered), and
    // a close before any paint leaves the visitor unmarked,
    // so a botched load never costs them the opening.
    stopFilm();
    stopSound();
    leaveSparkBeat();
    const el = overlay;
    overlay = null;
    el.classList.add("is-closing");
    const remove = () => { el.remove(); };
    if (reducedMotion) remove();
    else window.setTimeout(remove, 260);
    if (goToday) {
      // The page's own public control, as the companion layer
      // itself uses it — nothing here reaches into the Sphere.
      window.setTimeout(() => {
        const btn = document.querySelector('[data-sgb="today"]')
          || document.getElementById("sphere-everyday-today")
          || document.querySelector('[data-app-action="today"]');
        if (btn) btn.click();
      }, reducedMotion ? 0 : 280);
    }
    if (lastFocus && document.contains(lastFocus)) {
      try { lastFocus.focus({ preventScroll: true }); } catch { /* focus stands */ }
    }
  }

  // The replay door: "See how it grew", standing in the guide
  // bar beside its own buttons once the bar exists.
  function plantReplayDoor() {
    const actions = $(".sphere-guide-bar .sgb-actions");
    if (!actions) return false;
    if (actions.querySelector("[data-evo-door]")) return true;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sgb-btn";
    btn.setAttribute("data-evo-door", "");
    btn.textContent = "See how it grew";
    btn.addEventListener("click", () => openOpening("door"));
    actions.appendChild(btn);
    return true;
  }

  function boot() {
    const wrap = $(".sphere-canvas-wrap");
    if (!wrap) return;

    // The replay door, planted when the guide bar lands.
    let doorTries = 0;
    const doorTimer = window.setInterval(() => {
      doorTries += 1;
      if (plantReplayDoor() || doorTries > 40) window.clearInterval(doorTimer);
    }, 250);

    // First visit only: no seen flag, not already shown this
    // session, and not a shared view (a marker or a year in the
    // URL means the visitor came for a particular day — the
    // story never stands in front of it, and the flag is left
    // unset so a plain visit later can still meet the opening).
    // The visit is judged by the URL the visitor ARRIVED with,
    // caught by the companion layer's loader before the Sphere's
    // own state-keeping wrote its year and marker into the
    // address bar; the live address is only a fallback.
    const arrivalSearch = typeof window.__sofEvolutionOpeningArrival === "string"
      ? window.__sofEvolutionOpeningArrival
      : window.location.search;
    const params = new URLSearchParams(arrivalSearch);
    const sharedView = params.has("marker") || params.has("year");
    if (!shouldAutoOpen({
      seen: Boolean(storeGet(SEEN_KEY)),
      sessionShown: Boolean(sessionGet(SESSION_KEY)),
      sharedView,
    })) return;

    // Wait for the instrument to be standing — a canvas or an
    // SVG in the container, or the Spark's presence — but never
    // longer than a patient count; the first two stages do not
    // need it, and the reveal will find it standing.
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const ready = document.querySelector(
        "#sphere-container canvas, #sphere-container svg, .sphere-spark-presence"
      );
      if (ready || tries > 32) {
        window.clearInterval(timer);
        openOpening("auto");
      }
    }, 250);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
