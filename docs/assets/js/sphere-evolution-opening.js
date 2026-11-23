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
   *   4. The Spark Appears — the Spark (the keeper's own, drawn by
   *      the Spark core's own renderer when a companion record
   *      stands on this device; otherwise the plain orb of light
   *      the films use) gives the intro: what this is, how to turn
   *      and dive, the rings in one breath, and the first beat of
   *      keeping a day — ending by stepping back to quiet.
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
   */

  const VERSION = "sphere-evolution-opening/1.0.0";
  const SEEN_KEY = "sof.sphere.evolutionOpening.v1";
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

  // The Spark's intro, one breath at a time. The first step is
  // filled with the visitor's own situation (their Spark's name,
  // or the meeting that stands waiting) at show time.
  const TOUR_STEPS = Object.freeze([
    { id: "meet", text: "" },
    {
      id: "turn",
      text: "Turn the Sphere with a drag. Dive toward a day to see it stand closer; pull back for the whole year.",
    },
    {
      id: "rings",
      text: "Rings lay over the year — the farm, the sky, the story. The guide bar under the Sphere lays one over, or a few, and the year reads differently.",
    },
    {
      id: "keep",
      text: "Keeping a day takes one true thing: tap a day, add a task, a planting, a note — and the day is kept. That is the whole practice.",
    },
  ]);

  function shouldAutoOpen({ seen, sessionShown, sharedView } = {}) {
    return !seen && !sessionShown && !sharedView;
  }

  const api = Object.freeze({
    VERSION,
    SEEN_KEY,
    SESSION_KEY,
    STAGES,
    TOUR_STEPS,
    buildCalendarGrid,
    buildFirstSphereSVG,
    patternAngleForDayOfYear,
    spiralAngleForYear,
    spiralRadiusForYear,
    shouldAutoOpen,
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
        return window.PatternCalendar.fromCivilDate({ date: new Date() });
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

  // The visitor's own Spark, when a companion record stands on
  // this device — read exactly as the Spark seat reads it, drawn
  // by the core's own renderer. Otherwise the plain orb.
  function sparkFigure() {
    try {
      const Core = window.SparkCompanion;
      if (Core?.generate && Core?.renderSVG && Core?.STORAGE_KEY) {
        const raw = localStorage.getItem(Core.STORAGE_KEY);
        const record = raw ? JSON.parse(raw) : null;
        if (record?.seed) {
          const companion = Core.generate(record.seed);
          if (companion) {
            const stage = Core.stageOf ? Core.stageOf(record, companion) : { index: 0, name: "" };
            const name = Core.displayName ? Core.displayName(record, companion) : "";
            return {
              svg: Core.renderSVG(companion, { stage: stage.index }),
              name,
              kindLine: `${companion.kindName || companion.kind || "Spark"}${stage.name ? ` · ${stage.name}` : ""}`,
              own: true,
            };
          }
        }
      }
    } catch { /* fall through to the plain orb */ }
    return {
      svg: `<svg viewBox="0 0 100 100" class="evo-spark-orb" role="img" aria-label="The Spark, a round orb of light"><defs><radialGradient id="evo-spark-glow" cx="50%" cy="42%" r="65%"><stop offset="0%" stop-color="#fff7dd" /><stop offset="45%" stop-color="#ffd97a" /><stop offset="100%" stop-color="#f5a83c" /></radialGradient></defs><circle cx="50" cy="50" r="34" fill="url(#evo-spark-glow)" /><circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,217,122,0.45)" stroke-width="2" /></svg>`,
      name: "",
      kindLine: "",
      own: false,
    };
  }

  let overlay = null;
  let stageIndex = 0;
  let tourIndex = 0;
  let lastFocus = null;

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
    // The tour's today-door belongs to the tour's last beat only;
    // renderTour re-creates it there. Never let it linger on
    // another stage.
    const staleCta = overlay.querySelector('[data-evo="today-cta"]');
    if (staleCta) staleCta.remove();

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
      renderTour(today);
      next.textContent = tourIndex === TOUR_STEPS.length - 1 ? "Done" : "Next";
    }
    const focusTarget = overlay.querySelector('[data-evo="next"]');
    if (focusTarget) { try { focusTarget.focus({ preventScroll: true }); } catch { /* focus stands */ } }
  }

  function renderTour(today) {
    if (!overlay) return;
    const visual = overlay.querySelector('[data-evo="visual"]');
    const line = overlay.querySelector('[data-evo="line"]');
    const todayEl = overlay.querySelector('[data-evo="today"]');
    const fig = sparkFigure();
    const stepDef = TOUR_STEPS[tourIndex];
    let text = stepDef.text;
    if (stepDef.id === "meet") {
      text = fig.own
        ? `This is ${fig.name || "your Spark"}${fig.kindLine ? ` — ${fig.kindLine}` : ""}. Your Spark rides this Sphere with you, and answers from your record, on this device. Tap it on the Sphere to talk.`
        : "The Spark rides this Sphere with its keeper, and answers from their record, on their device. When you meet your own Spark — the meeting stands under the Sphere — it will ride here with you.";
    }
    visual.innerHTML = `
      <div class="evo-spark-figure">${fig.svg}</div>
      <p class="evo-tour-count">The Spark's tour · ${tourIndex + 1} of ${TOUR_STEPS.length}</p>`;
    line.textContent = text;
    todayEl.textContent = stepDef.id === "keep" ? todayLine(today) : "";
    const next = overlay.querySelector('[data-evo="next"]');
    next.textContent = tourIndex === TOUR_STEPS.length - 1 ? "Done — take me to the Sphere" : "Next";
    // The last beat offers the visitor the door into today itself.
    let cta = overlay.querySelector('[data-evo="today-cta"]');
    if (stepDef.id === "keep") {
      if (!cta) {
        cta = document.createElement("button");
        cta.type = "button";
        cta.className = "evo-btn evo-cta";
        cta.setAttribute("data-evo", "today-cta");
        cta.textContent = "Take me to today";
        cta.addEventListener("click", () => closeOpening(true));
        overlay.querySelector(".evo-controls").prepend(cta);
      }
      cta.hidden = false;
    } else if (cta) {
      cta.hidden = true;
    }
  }

  function step(dir) {
    if (!overlay) return;
    const stage = STAGES[stageIndex];
    if (stage.id === "spark" && dir > 0 && tourIndex < TOUR_STEPS.length - 1) {
      tourIndex += 1;
      renderStage();
      return;
    }
    if (stage.id === "spark" && dir < 0 && tourIndex > 0) {
      tourIndex -= 1;
      renderStage();
      return;
    }
    const nextIndex = stageIndex + dir;
    if (nextIndex < 0) return;
    if (nextIndex >= STAGES.length) { closeOpening(false); return; }
    stageIndex = nextIndex;
    if (STAGES[stageIndex].id === "spark") tourIndex = 0;
    renderStage();
  }

  function openOpening(source) {
    if (overlay) return;
    const wrap = $(".sphere-canvas-wrap");
    if (!wrap) return;
    lastFocus = document.activeElement;
    sessionSet(SESSION_KEY, "1");
    document.addEventListener("keydown", onDocumentKeydown);
    overlay = buildOverlay();
    if (!overlay) return;
    stageIndex = 0;
    tourIndex = 0;
    renderStage();
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
    storeSet(SEEN_KEY, "1");
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
