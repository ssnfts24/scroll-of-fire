(() => {
  "use strict";

  const BRAND_LINE = "CodexOfReality.org/moons";
  const CANVAS_DIMS = {
    square: { width: 1080, height: 1080, label: "Square" },
    portrait: { width: 1080, height: 1350, label: "Portrait" },
    story: { width: 1080, height: 1920, label: "Story" }
  };

  const DESCRIPTION_MODES = {
    compact: { label: "Compact", min: 200, max: 350 },
    standard: { label: "Standard", min: 400, max: 750 },
    professional: { label: "Professional", min: 500, max: 900 }
  };

  const MOON_THEMES = {
    1: { accent: "#6FE7FF", glow: "#1f4f64", symbol: "✶", atmosphere: ["#040912", "#0a1e33"] },
    2: { accent: "#B1C7FF", glow: "#3d4f7a", symbol: "☵", atmosphere: ["#060913", "#15213f"] },
    3: { accent: "#7AF3FF", glow: "#1d5e66", symbol: "☲", atmosphere: ["#030911", "#0b2d39"] },
    4: { accent: "#7BF3B8", glow: "#1f6045", symbol: "◍", atmosphere: ["#040a0f", "#0e3122"] },
    5: { accent: "#FFD27A", glow: "#6a4d1f", symbol: "☉", atmosphere: ["#0a0906", "#32220d"] },
    6: { accent: "#A7FFCF", glow: "#275f4d", symbol: "✦", atmosphere: ["#050a0a", "#12302c"] },
    7: { accent: "#D5B6FF", glow: "#523875", symbol: "⬡", atmosphere: ["#08070f", "#24163b"] },
    8: { accent: "#A8FFD9", glow: "#266854", symbol: "☾", atmosphere: ["#040a0b", "#10332f"] },
    9: { accent: "#FFBC6F", glow: "#6b401f", symbol: "◯", atmosphere: ["#0a0806", "#331d10"] },
    10: { accent: "#A2FFD1", glow: "#2d6a54", symbol: "✧", atmosphere: ["#040a09", "#12312a"] },
    11: { accent: "#A8B8FF", glow: "#35467a", symbol: "✺", atmosphere: ["#050812", "#162544"] },
    12: { accent: "#FFD7A8", glow: "#6f4a2a", symbol: "☰", atmosphere: ["#0a0906", "#372414"] },
    13: { accent: "#9DDAFF", glow: "#295174", symbol: "◌", atmosphere: ["#040913", "#10304a"] }
  };

  const MOON_OPENING_HOOKS = {
    1: "☾ {moon} opens with first-light focus—name what is ready to begin.",
    2: "☾ {moon} steadies the day around foundations and honest support.",
    3: "☾ {moon} opens a listening day—clarify signal before action.",
    4: "☾ {moon} gathers what is scattered and asks for grounded attention.",
    5: "☾ {moon} invites embodied language—speak what you are prepared to live.",
    6: "☾ {moon} turns toward refinement through courageous, practical steps.",
    7: "☾ {moon} balances pressure and perspective so direction can mature.",
    8: "☾ {moon} reflects what is true beneath momentum and noise.",
    9: "☾ {moon} reopens the path through integration and deliberate return.",
    10: "☾ {moon} favors practical creation—build what can carry real use.",
    11: "☾ {moon} restores memory and pattern so meaning becomes actionable.",
    12: "☾ {moon} translates signs into movement and shared understanding.",
    13: "☾ {moon} gathers completion, gratitude, and release before renewal."
  };

  const MOON_REFLECTIONS = {
    1: "Choose one clear beginning and protect it from distraction.",
    2: "Strengthen what supports life before expanding the plan.",
    3: "Listen for alignment, then move with precision.",
    4: "Stabilize what already exists before adding something new.",
    5: "Let words and actions stay in covenant with each other.",
    6: "Refine the work through disciplined and honest iteration.",
    7: "Hold balance between conviction and humility.",
    8: "Use reflection to clarify what belongs in the next step.",
    9: "Integrate lessons and continue with intentional return.",
    10: "Build patiently so the structure can endure.",
    11: "Recover memory that can guide present practice.",
    12: "Translate insight into shared action and stewardship.",
    13: "Complete with care so the next cycle can open cleanly."
  };

  const MOON_DAY_MOVEMENTS = {
    1: "Spark a single intention and protect it.",
    2: "Gather what is needed before expanding.",
    3: "Name the signal and reduce noise.",
    4: "Ground scattered threads into one stable line.",
    5: "Give language to what is becoming real.",
    6: "Refine the method with patient discipline.",
    7: "Rest in balance and observe the pattern.",
    8: "Re-enter with clarity and practical motion.",
    9: "Strengthen structure before acceleration.",
    10: "Carry the work with humble precision.",
    11: "Remember what matters and return to it.",
    12: "Translate insight into usable form.",
    13: "Complete one open loop with gratitude.",
    14: "Create breathing room for honest review.",
    15: "Align effort with what is life-giving.",
    16: "Repair what weakens trust or coherence.",
    17: "Trim excess and keep the essential.",
    18: "Bring scattered commitments into one cadence.",
    19: "Anchor attention where depth is required.",
    20: "Choose the faithful step over the flashy one.",
    21: "Witness the progress already made.",
    22: "Prepare transition with clear boundaries.",
    23: "Carry learning forward through action.",
    24: "Simplify so the next movement is clean.",
    25: "Consolidate what must be kept.",
    26: "Loosen what no longer serves the cycle.",
    27: "Conclude with careful completion.",
    28: "Bless the ending and ready the opening."
  };

  const WEEK_GATE_REFLECTIONS = {
    1: "Week 1 calls for ignition: begin with decisive clarity.",
    2: "Week 2 emphasizes structuring: strengthen the frame before scaling.",
    3: "Week 3 highlights transmission: share what has become coherent.",
    4: "Week 4 points to completion: finish, release, and prepare transition."
  };

  const PHASE_CONTEXT = {
    "new": "A new lunar chamber is forming—set intention with restraint and care.",
    "waxing crescent": "Waxing crescent energy favors early commitments and steady momentum.",
    "first quarter": "First quarter tension invites clear decisions and committed action.",
    "waxing gibbous": "Waxing gibbous light supports refinement before full visibility.",
    "full": "Full moon visibility can reveal both fruit and friction—witness both honestly.",
    "waning gibbous": "Waning gibbous energy supports integration and teaching from what worked.",
    "last quarter": "Last quarter asks for release, correction, and directional honesty.",
    "waning crescent": "Waning crescent light favors completion, rest, and preparation."
  };

  const SPECIAL_DAY_LANGUAGE = {
    preparation: "Preparation day favors clearing, gathering, and completing what must be settled before rest.",
    shabbat: "Shabbat invites ceasing, gratitude, and attentive presence rather than productivity pressure.",
    return: "Return day supports re-entry, integration, and carrying rest-born clarity into movement.",
    dayOutOfTime: "Day Out of Time holds a threshold space for reflection, release, and completion between cycles."
  };

  const INVITATION_LINES = {
    compact: "Explore today's living calendar:",
    standard: "Explore today's full reading in the Remnant 13 Moons living calendar:",
    professional: "Explore today's full reading and movement context in the Remnant 13 Moons living calendar:"
  };

  const CORE_HASHTAGS = ["#CodexOfReality", "#Remnant13Moons", "#ScrollOfFire"];

  const MOON_ARTWORK = {
    1: "assets/img/moons/moons/moon-01-seed-flame.webp",
    2: "assets/img/moons/moons/moon-02-root-waters.webp",
    3: "assets/img/moons/moons/moon-03-breath-gate.webp",
    4: "assets/img/moons/moons/moon-04-stone-witness.webp",
    5: "assets/img/moons/moons/moon-05-living-word.webp",
    6: "assets/img/moons/moons/moon-06-fire-trial.webp",
    7: "assets/img/moons/moons/moon-07-crown-balance.webp",
    8: "assets/img/moons/moons/moon-08-deep-mirror.webp",
    9: "assets/img/moons/moons/moon-09-return-path.webp",
    10: "assets/img/moons/moons/moon-10-builders-hand.webp",
    11: "assets/img/moons/moons/moon-11-star-remembrance.webp",
    12: "assets/img/moons/moons/moon-12-river-of-signs.webp",
    13: "assets/img/moons/moons/moon-13-completion-seal.webp"
  };

  const state = {
    modal: null,
    trigger: null,
    currentFormat: "square",
    currentMode: "standard",
    options: {
      includePhase: true,
      includeMovement: true,
      includeSunset: false
    },
    captionOptions: {
      includeCalendar: true,
      includeReflection: true,
      includeLink: true,
      includeHashtags: true,
      includeIntention: false
    },
    lastDetail: null,
    currentShareState: null,
    currentSourceId: "today",
    currentSourcePayload: null,
    currentPackage: null,
    defaultCaption: "",
    userEditedCaption: false,
    cache: new Map(),
    artworkCache: new Map(),
    objectUrls: new Set(),
    inertedNodes: []
  };

  function clampText(value, max = 180) {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();
    return normalized.length > max ? normalized.slice(0, max - 1) + "…" : normalized;
  }

  function safeISO(iso) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || "")) ? String(iso) : "";
  }

  function toTitleDate(iso) {
    if (!safeISO(iso)) return "";
    const [year, month, day] = iso.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC"
    }).format(date);
  }

  function getTodayISO() {
    try {
      if (window.SOFCalendar && typeof window.SOFCalendar.todayISO === "function") {
        return window.SOFCalendar.todayISO(window.SOFCalendar.getTZ?.() || Intl.DateTimeFormat().resolvedOptions().timeZone);
      }
    } catch {}
    const now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("-");
  }

  function buildDeepLink(isoDate) {
    const safeDate = safeISO(isoDate);
    const tz = (() => {
      try { return localStorage.getItem("sof_moons_tz_v2") || Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
    })();
    const boundaryMode = (() => {
      try { return localStorage.getItem("sof_moons_boundary_v1") || window.CodexState?.boundaryMode || "sunset"; } catch { return window.CodexState?.boundaryMode || "sunset"; }
    })();
    const sunset = (() => {
      try { return localStorage.getItem("sof_moons_sunset_v1") || window.CodexState?.sunsetTime || ""; } catch { return window.CodexState?.sunsetTime || ""; }
    })();
    const selectedTab = new URLSearchParams(window.location.search).get("tab") || "";
    const readingVersion = "mirror-reading/2.0.0";

    if (window.RemnantShareUrl?.buildPermanentLink) {
      return window.RemnantShareUrl.buildPermanentLink({
        baseUrl: "./moons.html",
        date: safeDate,
        timeZone: tz,
        boundaryMode,
        manualSunset: sunset,
        selectedTab,
        readingVersion,
        displayMode: state.currentMode || "standard",
        source: "today"
      });
    }

    const url = new URL("./moons.html", window.location.href);
    if (safeDate) url.searchParams.set("date", safeDate);
    return url.toString();
  }

  function track(eventName, payload = {}) {
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, {
        event_category: "share_day",
        event_label: payload.format || "unknown",
        method: payload.method || "",
        non_interaction: false
      });
    }
  }

  function recordShareAction(type, shareState, detail = {}) {
    if (!window.CodexMemory || typeof window.CodexMemory.recordAction !== "function") return;
    window.CodexMemory.recordAction({
      type,
      label: `Share Day · ${type}`,
      path: shareState?.link || "",
      meta: {
        status: detail.status || "",
        format: detail.format || state.currentFormat,
        method: detail.method || "",
        sharedDate: shareState?.isoDate || "",
        source: shareState?.source || ""
      }
    });
  }

  function hashSeed(value) {
    const src = String(value || "");
    let hash = 0;
    for (let i = 0; i < src.length; i += 1) {
      hash = ((hash << 5) - hash + src.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  function pickDeterministic(list, seed) {
    if (!Array.isArray(list) || !list.length) return "";
    return list[hashSeed(seed) % list.length];
  }

  function normalizeShabbatCode(shareState) {
    const code = String(shareState?.shabbatCode || "").toLowerCase();
    const stateText = String(shareState?.shabbatState || "").toLowerCase();
    if (code.includes("prep") || stateText.includes("prep")) return "preparation";
    if (code.includes("shabbat") || stateText.includes("shabbat")) return "shabbat";
    if (code.includes("return") || stateText.includes("return")) return "return";
    return "ordinary";
  }

  function getMoonTheme(moonNumber) {
    return MOON_THEMES[Number(moonNumber)] || MOON_THEMES[1];
  }

  function canonicalMoonName(moonNumber) {
    const idx = Number(moonNumber) || 1;
    const moons = Array.isArray(globalThis.PatternCalendarData?.moons)
      ? globalThis.PatternCalendarData.moons
      : [];
    return moons[idx - 1]?.name || `Moon ${idx}`;
  }

  function getMoonName(moonNumber, fallback) {
    return clampText(fallback || canonicalMoonName(moonNumber) || "Living Day", 44);
  }

  function parseWeekNumber(weekGate) {
    const match = /week\s*(\d+)/i.exec(String(weekGate || ""));
    return match ? Number(match[1]) : 0;
  }

  function getPhaseKey(phaseName) {
    const value = String(phaseName || "").toLowerCase();
    if (!value) return "";
    if (value.includes("waxing crescent")) return "waxing crescent";
    if (value.includes("first quarter")) return "first quarter";
    if (value.includes("waxing gibbous")) return "waxing gibbous";
    if (value.includes("full")) return "full";
    if (value.includes("waning gibbous")) return "waning gibbous";
    if (value.includes("last quarter")) return "last quarter";
    if (value.includes("waning crescent")) return "waning crescent";
    if (value.includes("new")) return "new";
    return "";
  }

  function isDayOutOfTime(shareState) {
    const txt = `${shareState?.weekGate || ""} ${shareState?.moonName || ""} ${shareState?.shabbatState || ""}`.toLowerCase();
    return txt.includes("day out of time") || txt.includes("outside gate") || (!shareState?.moonDay && !shareState?.yearDay);
  }

  function isNewMoonTransition(shareState) {
    return Number(shareState?.moonDay) === 1 && Number(shareState?.moonNumber) >= 1;
  }

  function summarizeContextLine(shareState, includeCalendar = true) {
    if (!includeCalendar) return "";
    const parts = [];
    if (shareState.moonNumber && shareState.moonDay) {
      parts.push(`Moon ${shareState.moonNumber} · Day ${shareState.moonDay}/28`);
    }
    if (shareState.yearDay) parts.push(`Day ${shareState.yearDay}/364`);

    const lineA = parts.join(" · ");
    const lineBParts = [];
    if (shareState.phaseName) lineBParts.push(shareState.phaseName);
    if (shareState.weekGate) lineBParts.push(shareState.weekGate.replace(/\s*·\s*/g, " — "));

    const specialCode = normalizeShabbatCode(shareState);
    if (specialCode !== "ordinary" || isDayOutOfTime(shareState)) {
      lineBParts.push(clampText(shareState.shabbatState || "Special Day", 44));
    }

    const lineB = lineBParts.join(" · ");
    return [lineA, lineB].filter(Boolean).join("\n");
  }

  function buildOpeningHook(shareState) {
    if (isDayOutOfTime(shareState)) {
      return "☾ Day Out of Time arrives as a threshold for reflection, release, and completion between cycles.";
    }

    const shabbatCode = normalizeShabbatCode(shareState);
    if (shabbatCode === "preparation") {
      return "☾ Preparation day is here—clear what is unfinished and gather what must be ready.";
    }
    if (shabbatCode === "shabbat") {
      return "☾ Shabbat has opened—step back from striving and return to presence, gratitude, and witness.";
    }
    if (shabbatCode === "return") {
      return "☾ Return day begins—carry the rest into deliberate re-entry and practical integration.";
    }

    if (isNewMoonTransition(shareState)) {
      const moonNum = Number(shareState.moonNumber) || 1;
      const prev = moonNum === 1 ? 13 : moonNum - 1;
      return `☾ A new Moon chamber opens today as the Codex moves from ${canonicalMoonName(prev)} into ${getMoonName(moonNum, shareState.moonName)}.`;
    }

    return (MOON_OPENING_HOOKS[Number(shareState.moonNumber)] || MOON_OPENING_HOOKS[1]).replace("{moon}", getMoonName(shareState.moonNumber, shareState.moonName));
  }

  function buildReflection(shareState, mode, includeIntention) {
    const moonNumber = Number(shareState.moonNumber) || 1;
    const moonLine = MOON_REFLECTIONS[moonNumber] || MOON_REFLECTIONS[1];
    const dayMove = MOON_DAY_MOVEMENTS[Math.max(1, Math.min(28, Number(shareState.moonDay) || 1))] || "Move intentionally with what is already true.";
    const weekLine = WEEK_GATE_REFLECTIONS[parseWeekNumber(shareState.weekGate)] || "Stay attentive to the day's gate and move with integrity.";
    const phaseLine = PHASE_CONTEXT[getPhaseKey(shareState.phaseName)] || "Let the lunar rhythm guide pace, attention, and completion.";
    const shabbatCode = normalizeShabbatCode(shareState);

    const lines = [];
    if (isDayOutOfTime(shareState)) {
      lines.push(SPECIAL_DAY_LANGUAGE.dayOutOfTime);
    } else if (shabbatCode !== "ordinary") {
      lines.push(SPECIAL_DAY_LANGUAGE[shabbatCode]);
    }

    lines.push(moonLine);
    lines.push(weekLine);
    lines.push(`Today's movement is to ${String(shareState.movement || dayMove).replace(/[.]?$/, "").toLowerCase()}.`);

    if (includeIntention && shareState.intention) {
      lines.push(`If you're carrying an intention—${shareState.intention}—let today's actions stay aligned with it.`);
    }

    if (mode !== "compact") {
      lines.push(phaseLine);
    }
    if (mode === "professional") {
      lines.push("Treat this as symbolic calendar guidance and reflective practice, then translate insight into grounded action.");
    }

    return lines.slice(0, mode === "compact" ? 2 : mode === "standard" ? 3 : 5).join(" ");
  }

  function buildHashtags(shareState, mode) {
    const seed = `${shareState.isoDate}|${shareState.moonNumber}|${shareState.moonDay}|${mode}`;
    const tags = [];
    const add = tag => {
      if (!tag || tags.includes(tag)) return;
      if (tags.length < 5) tags.push(tag);
    };

    add("#CodexOfReality");
    add(hashSeed(seed) % 2 === 0 ? "#Remnant13Moons" : "#ScrollOfFire");

    const shabbatCode = normalizeShabbatCode(shareState);
    if (shabbatCode === "shabbat") {
      add("#Shabbat");
      add("#Rest");
      add("#LivingCalendar");
    } else if (shabbatCode === "preparation") {
      add("#LivingCalendar");
      add("#DailyReflection");
      add("#IntentionalLiving");
    } else if (shabbatCode === "return") {
      add("#LivingCalendar");
      add("#IntentionalLiving");
      add("#MoonCycle");
    } else if (isDayOutOfTime(shareState)) {
      add("#LivingCalendar");
      add("#DailyReflection");
      add("#SelfReflection");
    } else {
      add("#13Moons");
      add("#LivingCalendar");
      add((shareState.phaseName || "").toLowerCase().includes("lunar") ? "#LunarCycle" : "#MoonCycle");
    }

    if (mode === "professional") {
      add("#CreativeTechnology");
    }

    if (tags.length < 3) {
      ["#13Moons", "#LivingCalendar", "#MoonCycle"].forEach(add);
    }

    return tags.slice(0, 5);
  }

  function buildCompletePost(caption, link, hashtags, includeLink, includeHashtags) {
    const lines = [String(caption || "").trim()];
    if (includeLink && link) lines.push(link);
    if (includeHashtags && Array.isArray(hashtags) && hashtags.length) {
      if (includeLink && link) {
        lines.push("");
      }
      lines.push(hashtags.join(" "));
    }
    return lines.filter((line, index) => line || (includeLink && includeHashtags && index === lines.length - 2)).join("\n");
  }

  function buildDescriptionPackage(shareState, mode = state.currentMode, opts = state.captionOptions) {
    const safeMode = DESCRIPTION_MODES[mode] ? mode : "standard";
    const openingHook = buildOpeningHook(shareState);
    const context = summarizeContextLine(shareState, opts.includeCalendar);
    const reflection = opts.includeReflection ? buildReflection(shareState, safeMode, opts.includeIntention) : "";
    const invitation = opts.includeLink ? INVITATION_LINES[safeMode] : "";
    const link = opts.includeLink ? shareState.link : "";
    const hashtags = opts.includeHashtags ? buildHashtags(shareState, safeMode) : [];

    const descriptionSections = [openingHook, context, reflection, invitation].filter(Boolean);
    const description = descriptionSections.join("\n\n");
    const completePost = buildCompletePost(description, link, hashtags, opts.includeLink, opts.includeHashtags);

    return {
      mode: safeMode,
      openingHook,
      context,
      reflection,
      invitation,
      link,
      hashtags,
      description,
      completePost
    };
  }

  function buildDailyText(shareState, opts = state.captionOptions) {
    return buildDescriptionPackage(shareState, "standard", {
      includeCalendar: opts.includeCalendar !== false,
      includeReflection: opts.includeReflection !== false,
      includeLink: opts.includeLink !== false,
      includeHashtags: opts.includeHashtags !== false,
      includeIntention: opts.includeIntention === true
    }).completePost;
  }

  function fromEquinoxEngine() {
    const engine = window.ScrollOfFireEquinoxPassage;
    if (!engine || typeof engine.currentShareState !== "function") return null;
    const shareState = engine.currentShareState();
    return shareState && shareState.source === "equinox-passage" ? shareState : null;
  }

  function fromMoonEngine() {
    const engine = window.ScrollOfFireMoons;
    if (!engine || typeof engine.effectiveContext !== "function") return null;

    const context = engine.effectiveContext();
    const detail = state.lastDetail || {};
    const info = context?.info || detail.info || {};
    const moon = info.moon || {};
    const inside = !!info.inside;
    const moonNumber = inside ? Number(moon.idx) : Number(detail.info?.moon?.idx || 0);
    const isoDate = safeISO(context?.civilISO || detail.civilISO || detail.effectiveISO || "");
    const effectiveISO = safeISO(context?.effectiveISO || detail.effectiveISO || isoDate);
    const todayISO = getTodayISO();

    let illuminationPct = null;
    if (typeof detail.illumination === "number") {
      illuminationPct = Math.max(0, Math.min(100, Math.round(detail.illumination * 100)));
    } else if (typeof window.CodexState?.phaseIllumination === "number") {
      illuminationPct = Math.max(0, Math.min(100, Math.round(window.CodexState.phaseIllumination * 100)));
    }

    const intentionState = window.CodexMemory && typeof window.CodexMemory.getIntention === "function"
      ? window.CodexMemory.getIntention(isoDate || todayISO)
      : null;

    return {
      source: "moons",
      isoDate,
      effectiveISO,
      isSelectedDate: isoDate !== todayISO,
      shareButtonLabel: isoDate !== todayISO ? "Share This Day" : "Share Today",
      readableDate: toTitleDate(isoDate),
      moonNumber: Number.isFinite(moonNumber) && moonNumber > 0 ? moonNumber : Number(window.CodexState?.moonNumber || 1),
      moonName: getMoonName(moonNumber, moon.name || window.CodexState?.moonName),
      moonDay: inside ? Number(info.dayInMoon || window.CodexState?.moonDay || 0) : null,
      yearDay: inside ? Number(info.dayOfYear || window.CodexState?.yearDay || 0) : null,
      weekGate: clampText(detail.week?.[0] || window.CodexState?.weekGate || "Outside Gate", 56),
      phaseName: clampText(detail.phase || window.CodexState?.phaseName || "Unknown Phase", 48),
      phaseIllumination: illuminationPct,
      shabbatState: clampText(context?.shabbat?.state || window.CodexState?.shabbatLabel || "Ordinary Day", 56),
      shabbatCode: clampText(context?.shabbat?.code || window.CodexState?.shabbatState || "ordinary", 24),
      movement: clampText(detail.dayArch?.[1] || window.CodexState?.dailyMovement || "Notice what is moving, then record one clear line.", 220),
      mirrorLine: clampText(detail.solar?.[2] || detail.solar?.[1] || "", 140),
      sunset: clampText(context?.sunset || window.CodexState?.sunsetTime || "", 20),
      intention: intentionState?.value ? clampText(intentionState.value, 80) : "",
      link: buildDeepLink(isoDate || effectiveISO)
    };
  }

  function fromCodexState() {
    const codex = window.CodexState || {};
    const isoDate = safeISO(codex.isoDate || getTodayISO());
    const intentionState = window.CodexMemory && typeof window.CodexMemory.getIntention === "function"
      ? window.CodexMemory.getIntention(isoDate)
      : null;

    return {
      source: "homepage",
      isoDate,
      effectiveISO: isoDate,
      isSelectedDate: false,
      shareButtonLabel: "Share Today",
      readableDate: toTitleDate(isoDate),
      moonNumber: Number(codex.moonNumber || 1),
      moonName: getMoonName(codex.moonNumber, codex.moonName),
      moonDay: codex.moonDay || null,
      yearDay: codex.yearDay || null,
      weekGate: clampText(codex.weekGate || "Week Gate", 56),
      phaseName: clampText(codex.phaseName || "Moon phase", 48),
      phaseIllumination: typeof codex.phaseIllumination === "number"
        ? Math.max(0, Math.min(100, Math.round(codex.phaseIllumination * 100)))
        : null,
      shabbatState: clampText(codex.shabbatLabel || "Ordinary Day", 56),
      shabbatCode: clampText(codex.shabbatState || "ordinary", 24),
      movement: clampText(codex.dailyMovement || "Notice what is moving, then record one clear line.", 220),
      mirrorLine: "",
      sunset: clampText(codex.sunsetTime || "", 20),
      intention: intentionState?.value ? clampText(intentionState.value, 80) : "",
      link: buildDeepLink(isoDate)
    };
  }

  function deriveShareState() {
    return fromEquinoxEngine() || fromMoonEngine() || fromCodexState();
  }

  function textOf(id) {
    const node = document.getElementById(id);
    return node ? String(node.textContent || "").trim() : "";
  }

  function valueOf(id) {
    const node = document.getElementById(id);
    return node ? String(node.value || "").trim() : "";
  }

  function selectedMoonDate() {
    const fromInput = safeISO(valueOf("datePick"));
    return fromInput || safeISO(deriveShareState()?.isoDate) || getTodayISO();
  }

  function selectedMoodsTab(sourceId) {
    const bySource = {
      today: "todayPanel",
      "daily-mirror": "mirrorPanel",
      "daily-flow": "flowPanel",
      shabbat: "shabbatPanel",
      "daily-witness": "witnessPanel",
      "year-map": "yearPanel",
      "generated-seal": "codexPanel"
    };
    return bySource[sourceId] || "todayPanel";
  }

  function buildMoonsLink(sourceId, readingVersion = "mirror-reading/2.0.0", displayMode = "standard") {
    const date = selectedMoonDate();
    const tz = valueOf("tzPick") || (() => {
      try { return localStorage.getItem("sof_moons_tz_v2") || Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
    })();
    const boundaryMode = valueOf("boundaryMode") || (() => {
      try { return localStorage.getItem("sof_moons_boundary_v1") || "sunset"; } catch { return "sunset"; }
    })();
    const sunset = valueOf("sunsetInput") || (() => {
      try { return localStorage.getItem("sof_moons_sunset_v1") || ""; } catch { return ""; }
    })();

    if (window.RemnantShareUrl?.buildPermanentLink) {
      return window.RemnantShareUrl.buildPermanentLink({
        baseUrl: "./moons.html",
        date,
        timeZone: tz,
        boundaryMode,
        manualSunset: sunset,
        selectedTab: selectedMoodsTab(sourceId),
        readingVersion,
        displayMode,
        source: sourceId
      });
    }
    return buildDeepLink(date);
  }

  function normalizeForShare(value, max = 1200) {
    const text = String(value || "").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function mirrorPayload() {
    const title = textOf("mirrorTitle") || "Daily Mirror";
    const full = normalizeForShare(textOf("mirrorOutput"), 6000);
    const opening = /The Opening\s+([\s\S]*?)\n\nMoon Gate/i.exec(full)?.[1] || "";
    const witnessQuestion = /Witness Questions\s+1\.\s*([^\n]+)/i.exec(full)?.[1] || "";
    const closing = /Closing Seal\s+([\s\S]*?)$/i.exec(full)?.[1] || "";
    const practice = textOf("mirrorAction") || "";
    const signal = normalizeForShare([
      `☲ Daily Mirror · ${title}`,
      opening || textOf("mirrorSignal"),
      practice ? `Practice: ${practice}` : "",
      witnessQuestion ? `Witness Question: ${witnessQuestion}` : "",
      closing ? `Closing Seal: ${closing.split("\n")[0]}` : "",
      "reading version: mirror-reading/2.0.0"
    ].filter(Boolean).join("\n"), 900);

    return {
      title: "Daily Mirror",
      signal,
      standard: normalizeForShare([
        `☲ Daily Mirror`,
        `Daily Gate summary: ${title}`,
        opening ? `Opening: ${opening}` : "",
        practice ? `Practice: ${practice}` : "",
        witnessQuestion ? `Witness Question: ${witnessQuestion}` : "",
        closing ? `Closing Seal: ${closing}` : "",
        "reading version: mirror-reading/2.0.0"
      ].filter(Boolean).join("\n\n"), 2500),
      full: full || signal,
      link: buildMoonsLink("daily-mirror", "mirror-reading/2.0.0", "standard")
    };
  }

  function dailyFlowPayload() {
    const movement = textOf("ritualLine");
    const stateLine = textOf("meterGroundText") || textOf("meterFieldText") || "Observe";
    const practicalAction = (() => {
      const nodes = Array.from(document.querySelectorAll(".practice-card .practice-list div"));
      const action = nodes.find(node => /Action/i.test(node.textContent || ""));
      return normalizeForShare(action?.textContent || "", 180);
    })();
    const signal = normalizeForShare([
      "☲ Daily Flow",
      movement,
      `State: ${stateLine}`,
      practicalAction ? `Practical action: ${practicalAction}` : ""
    ].filter(Boolean).join("\n"), 800);

    return {
      title: "Daily Flow",
      signal,
      standard: normalizeForShare([
        "☲ Daily Flow",
        `Current movement: ${movement || "Read · Witness · Ground"}`,
        `Preparation / Action / Rest state: ${stateLine}`,
        practicalAction ? `Practical action: ${practicalAction}` : ""
      ].filter(Boolean).join("\n\n"), 2200),
      full: normalizeForShare([
        "☲ Daily Flow — Full Scroll",
        movement,
        `Coherence: ${textOf("meterCoherenceText")}`,
        `Body: ${textOf("meterBodyText")}`,
        `Signal: ${textOf("meterSignalText")}`,
        `Field: ${textOf("meterFieldText")}`,
        `Grounding: ${textOf("meterGroundText")}`,
        practicalAction ? `Practical action: ${practicalAction}` : ""
      ].filter(Boolean).join("\n"), 3800),
      link: buildMoonsLink("daily-flow")
    };
  }

  function shabbatPayload() {
    const shabbatState = textOf("shabbatState") || "Shabbat state unavailable";
    const stage = /prep|prepare/i.test(shabbatState)
      ? "Prepare"
      : /return/i.test(shabbatState)
        ? "Return"
        : /shabbat|ceas/i.test(shabbatState)
          ? "Cease"
          : /rest/i.test(shabbatState)
            ? "Rest"
            : "Witness";
    const practice = normalizeForShare(textOf("shabbatInstruction"), 220);
    const signal = `☲ Shabbat · ${shabbatState}\nStage: ${stage}\nPractice: ${practice}`;

    return {
      title: "Shabbat",
      signal,
      standard: normalizeForShare([
        `☲ Shabbat state: ${shabbatState}`,
        `Stage: ${stage}`,
        practice ? `Concise practice: ${practice}` : ""
      ].filter(Boolean).join("\n\n"), 1800),
      full: normalizeForShare([
        `☲ Shabbat`,
        `State: ${shabbatState}`,
        `Window: ${textOf("shabbatWindow")}`,
        `Moon Position: ${textOf("shabbatMoonPosition")}`,
        `Stage: ${stage}`,
        practice ? `Practice: ${practice}` : ""
      ].filter(Boolean).join("\n"), 2500),
      link: buildMoonsLink("shabbat")
    };
  }

  function witnessPayload() {
    const selected = normalizeForShare(window.getSelection?.().toString() || "", 3000);
    const warning = "Privacy warning: share only selected text. Private local logs are never included automatically.";
    const fallback = selected || "Select text in Daily Witness before sharing.";
    return {
      title: "Daily Witness",
      signal: fallback,
      standard: `${warning}\n\n${fallback}`,
      full: `${warning}\n\n${fallback}`,
      link: buildMoonsLink("daily-witness"),
      warning,
      requiresSelection: true,
      hasSelection: Boolean(selected)
    };
  }

  function yearMapPayload() {
    const date = selectedMoonDate();
    const moon = textOf("moonName");
    const moonDay = textOf("dayInMoon");
    const weekGate = textOf("weekGate");
    const archetype = textOf("dayArchetype");
    const signal = `☲ Year Map · ${date}\n${moon} · Day ${moonDay}\n${weekGate}`;
    return {
      title: "Year Map",
      signal,
      standard: normalizeForShare([
        `☲ Year Map selected date: ${date}`,
        `Moon: ${moon}`,
        `Day: ${moonDay}`,
        `Week Gate: ${weekGate}`,
        `Archetype: ${archetype}`
      ].join("\n"), 2000),
      full: normalizeForShare(textOf("outsideInfo") + "\n\n" + signal, 2800),
      link: buildMoonsLink("year-map", "year-map/1.0.0")
    };
  }

  function todayPayload() {
    const shareState = deriveShareState();
    const pkgSignal = buildDescriptionPackage(shareState, "compact");
    const pkgStandard = buildDescriptionPackage(shareState, "standard");
    const pkgFull = buildDescriptionPackage(shareState, "professional");
    return {
      title: shareState.isSelectedDate ? "Selected Day" : "Today",
      signal: normalizeForShare([
        `☲ Pattern date: ${shareState.isoDate}`,
        `Moon and day: ${shareState.moonName} · Day ${shareState.moonDay || "Outside"}`,
        `Week Gate: ${shareState.weekGate}`,
        `Archetype: ${shareState.movement}`,
        `Daily emphasis: ${pkgSignal.description}`
      ].join("\n"), 1200),
      standard: pkgStandard.completePost,
      full: pkgFull.completePost,
      link: buildMoonsLink("today", "mirror-reading/2.0.0", state.currentMode || "standard")
    };
  }

  function generatedSealPayload() {
    const seal = normalizeForShare(textOf("sealBody"), 5000);
    return {
      title: "Generated Seal",
      signal: normalizeForShare(seal.split("\n").slice(0, 7).join("\n"), 1200),
      standard: seal,
      full: seal,
      link: buildMoonsLink("generated-seal", "seal/1.0.0")
    };
  }

  function equinoxPassagePayload() {
    const share = fromEquinoxEngine();
    const record = share?.equinoxRecord;
    const link = share?.link || window.RemnantShareUrl?.buildEquinoxShareLink?.({
      baseUrl: "./equinox-passage.html",
      selectedYear: record?.selectedYear,
      timeZone: record?.timeZone,
      boundaryMode: record?.boundaryMode,
      manualSunset: record?.manualSunset,
      displayMode: "standard",
      datasetVersion: record?.schemaVersion || "equinox-passage/1.0.0",
      source: "equinox-passage"
    }) || `${window.location.origin}${window.location.pathname}`;
    const summary = record
      ? [
        `☲ Equinox Passage ${record.selectedYear}`,
        `Equinox Gate UTC: ${record.equinox.utcInstant}`,
        `Local: ${record.equinox.localInstant} ${record.timeZone}`,
        `Pattern: ${record.patternPosition.moonName || "Outside Gate"}${record.patternPosition.day ? ` · Day ${record.patternPosition.day}` : ""}`,
        `Passage: ${record.passage.totalDays.toFixed(3)} days`,
        `Source: ${record.equinox.source} · ±${record.equinox.precisionSeconds}s`
      ].join("\n")
      : "Open an Equinox Passage record first.";
    return {
      title: "Equinox Passage",
      signal: summary,
      standard: summary,
      full: record ? JSON.stringify(record, null, 2) : summary,
      link
    };
  }

  function oracleQuickSealPayload() {
    const quick = normalizeForShare(textOf("quickSeal"), 2400)
      .split("\n")
      .filter(line => !/(name|birth|date of birth|birth time|profile)/i.test(line))
      .join("\n")
      .trim();
    return {
      title: "Oracle Quick Seal",
      signal: quick || "Run a quick seal reading first.",
      standard: quick || "Run a quick seal reading first.",
      full: quick || "Run a quick seal reading first.",
      link: window.RemnantShareUrl?.buildOracleShareLink
        ? window.RemnantShareUrl.buildOracleShareLink({
          baseUrl: "./genesis-oracle.html",
          timeZone: valueOf("inTZ"),
          boundaryMode: valueOf("inBoundary"),
          sunsetTime: valueOf("inSunset"),
          view: "quick",
          oracleVersion: "genesis-oracle/2.0.0",
          source: "oracle-quick-seal"
        })
        : `${window.location.origin}${window.location.pathname}`
    };
  }

  function oracleDailyMirrorPayload() {
    const mirror = normalizeForShare(document.getElementById("todayTransit")?.textContent || "", 4200)
      .split("\n")
      .filter(line => !/(name|birth|date of birth|birth time|profile)/i.test(line))
      .join("\n")
      .trim();
    return {
      title: "Oracle Birth Signature × Today",
      signal: mirror.split("\n").slice(0, 8).join("\n"),
      standard: mirror || "Run a reading to generate the symbolic daily mirror.",
      full: mirror || "Run a reading to generate the symbolic daily mirror.",
      link: window.RemnantShareUrl?.buildOracleShareLink
        ? window.RemnantShareUrl.buildOracleShareLink({
          baseUrl: "./genesis-oracle.html",
          timeZone: valueOf("inTZ"),
          boundaryMode: valueOf("inBoundary"),
          sunsetTime: valueOf("inSunset"),
          view: "daily",
          oracleVersion: "genesis-oracle/2.0.0",
          source: "oracle-daily-mirror"
        })
        : `${window.location.origin}${window.location.pathname}`
    };
  }

  function oracleGeneratedSealPayload() {
    const alt = normalizeForShare(textOf("sealAlt"), 1500);
    return {
      title: "Generated Seal",
      signal: alt || "Generated Seal visualization",
      standard: alt || "Generated Seal visualization",
      full: alt || "Generated Seal visualization",
      link: window.RemnantShareUrl?.buildOracleShareLink
        ? window.RemnantShareUrl.buildOracleShareLink({
          baseUrl: "./genesis-oracle.html",
          timeZone: valueOf("inTZ"),
          boundaryMode: valueOf("inBoundary"),
          sunsetTime: valueOf("inSunset"),
          view: "full",
          oracleVersion: "genesis-oracle/2.0.0",
          source: "oracle-generated-seal"
        })
        : `${window.location.origin}${window.location.pathname}`
    };
  }

  function buildSourcePayload(sourceId) {
    const normalized = sourceId || "today";
    const builders = {
      today: todayPayload,
      "daily-mirror": mirrorPayload,
      "daily-flow": dailyFlowPayload,
      shabbat: shabbatPayload,
      "daily-witness": witnessPayload,
      "year-map": yearMapPayload,
      "generated-seal": generatedSealPayload,
      "equinox-passage": equinoxPassagePayload,
      "oracle-quick-seal": oracleQuickSealPayload,
      "oracle-daily-mirror": oracleDailyMirrorPayload,
      "oracle-generated-seal": oracleGeneratedSealPayload
    };
    const builder = builders[normalized] || todayPayload;
    return {
      sourceId: normalized,
      ...builder()
    };
  }

  function statusText(message) {
    const node = state.modal?.querySelector("[data-share-day-status]");
    if (node) node.textContent = message || "";
  }

  function announceLengthWarning(chars, mode) {
    const warn = state.modal?.querySelector("[data-share-day-length-warning]");
    if (!warn) return;
    const limits = DESCRIPTION_MODES[mode] || DESCRIPTION_MODES.standard;
    if (chars > limits.max + 120) {
      warn.textContent = `${limits.label} posts usually read best below ${limits.max} characters before link and hashtags.`;
    } else {
      warn.textContent = "";
    }
  }

  function updateCharacterCount() {
    const textArea = state.modal?.querySelector("[data-share-day-text]");
    const countEl = state.modal?.querySelector("[data-share-day-char-count]");
    if (!textArea || !countEl) return;
    const chars = textArea.value.length;
    countEl.textContent = `${chars} characters`;
    announceLengthWarning(chars, state.currentMode);
  }

  function updateCaptionPreview() {
    if (!state.modal || !state.currentPackage) return;

    const textArea = state.modal.querySelector("[data-share-day-text]");
    const linkNode = state.modal.querySelector("[data-share-day-active-link]");
    const tagNode = state.modal.querySelector("[data-share-day-active-hashtags]");
    const modeNode = state.modal.querySelector("[data-share-day-active-mode]");
    const completeNode = state.modal.querySelector("[data-share-day-complete-preview]");

    const captionText = textArea ? textArea.value : state.currentPackage.description;
    const completePost = buildCompletePost(
      captionText,
      state.currentPackage.link,
      state.currentPackage.hashtags,
      state.captionOptions.includeLink,
      state.captionOptions.includeHashtags
    );

    if (modeNode) modeNode.textContent = DESCRIPTION_MODES[state.currentMode]?.label || "Standard";
    if (linkNode) linkNode.textContent = state.captionOptions.includeLink && state.currentPackage.link ? state.currentPackage.link : "Hidden";
    if (tagNode) tagNode.textContent = state.captionOptions.includeHashtags && state.currentPackage.hashtags.length
      ? state.currentPackage.hashtags.join(" ")
      : "Hidden";
    if (completeNode) completeNode.textContent = completePost;

    updateCharacterCount();
  }

  function regeneratePackage(forceResetCaption = false) {
    if (!state.currentShareState || !state.modal) return;
    state.currentSourcePayload = buildSourcePayload(state.currentSourceId);
    const payload = state.currentSourcePayload;
    if (!payload) return;
    const modeText = state.currentMode === "compact"
      ? payload.signal
      : state.currentMode === "professional"
        ? payload.full
        : payload.standard;
    state.currentPackage = {
      mode: state.currentMode,
      description: modeText || payload.standard || payload.signal || "",
      link: payload.link || state.currentShareState.link,
      hashtags: state.currentMode === "compact" ? CORE_HASHTAGS.slice(0, 3) : buildHashtags(state.currentShareState, "standard"),
      completePost: buildCompletePost(
        modeText || payload.standard || payload.signal || "",
        payload.link || state.currentShareState.link,
        state.currentMode === "compact" ? CORE_HASHTAGS.slice(0, 3) : buildHashtags(state.currentShareState, "standard"),
        state.captionOptions.includeLink,
        state.captionOptions.includeHashtags
      )
    };

    const textArea = state.modal.querySelector("[data-share-day-text]");
    if (textArea && (forceResetCaption || !state.userEditedCaption)) {
      textArea.value = state.currentPackage.description;
      state.defaultCaption = state.currentPackage.description;
      state.userEditedCaption = false;
    }

    updateCaptionPreview();
  }

  function drawCenteredWrappedText(ctx, text, centerX, startY, maxWidth, lineHeight, maxLines) {
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let current = "";

    for (let i = 0; i < words.length; i += 1) {
      const next = current ? `${current} ${words[i]}` : words[i];
      if (ctx.measureText(next).width <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = words[i];
      }
      if (lines.length >= maxLines) break;
    }
    if (current && lines.length < maxLines) lines.push(current);

    lines.slice(0, maxLines).forEach((line, index) => {
      ctx.fillText(line, centerX, startY + index * lineHeight);
    });

    return lines.length;
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let current = "";

    for (let i = 0; i < words.length; i += 1) {
      const next = current ? `${current} ${words[i]}` : words[i];
      if (ctx.measureText(next).width <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = words[i];
      }
      if (lines.length >= maxLines) break;
    }
    if (current && lines.length < maxLines) lines.push(current);

    lines.slice(0, maxLines).forEach((line, index) => {
      ctx.fillText(line, x, y + (index * lineHeight));
    });

    return lines.length;
  }

  async function loadArtwork(moonNumber) {
    const src = MOON_ARTWORK[moonNumber];
    if (!src) return null;
    if (state.artworkCache.has(src)) return state.artworkCache.get(src);

    const image = new Image();
    image.decoding = "async";
    image.loading = "eager";

    const promise = new Promise(resolve => {
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });

    state.artworkCache.set(src, promise);
    return promise;
  }

  function drawBackground(ctx, width, height, theme) {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, theme.atmosphere[0]);
    grad.addColorStop(1, theme.atmosphere[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(243, 201, 122, 0.38)";
    ctx.lineWidth = Math.max(3, width * 0.004);
    ctx.strokeRect(width * 0.03, height * 0.03, width * 0.94, height * 0.94);

    ctx.strokeStyle = "rgba(122, 243, 255, 0.25)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 7; i += 1) {
      const y = height * (0.14 + i * 0.11);
      ctx.beginPath();
      ctx.moveTo(width * 0.08, y);
      ctx.lineTo(width * 0.92, y);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    for (let i = 0; i < 36; i += 1) {
      const sx = (i * 97) % width;
      const sy = (i * 151) % height;
      ctx.beginPath();
      ctx.arc(sx, sy, i % 4 === 0 ? 1.8 : 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  async function renderCard(shareState, format, options) {
    const dims = CANVAS_DIMS[format] || CANVAS_DIMS.square;
    const canvas = document.createElement("canvas");
    canvas.width = dims.width;
    canvas.height = dims.height;
    const ctx = canvas.getContext("2d", { alpha: false });
    const theme = getMoonTheme(shareState.moonNumber);
    drawBackground(ctx, dims.width, dims.height, theme);

    // Pre-calculate footer geometry so content can respect the reserved area.
    // Border inner bottom = height * (1 - 0.03); leave 48 px above it for safety.
    const borderSafeBottom = dims.height * (1 - 0.03) - 48;
    const brandFontPx   = Math.round(dims.width * 0.027);
    const ctxFontPx     = Math.round(dims.width * 0.022);
    const FOOTER_GAP    = 28; // px between footer lines (≥ 24 required)
    const brandY        = borderSafeBottom;
    const contextY      = brandY - brandFontPx - FOOTER_GAP;
    const footerTop     = contextY - ctxFontPx - 12; // top edge of reserved footer area

    const artwork = await loadArtwork(shareState.moonNumber);
    if (artwork) {
      const size = Math.min(dims.width, dims.height) * (format === "story" ? 0.42 : 0.34);
      const x = (dims.width - size) / 2;
      const y = format === "story" ? dims.height * 0.2 : dims.height * 0.18;
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.drawImage(artwork, x, y, size, size);
      ctx.restore();
    }

    const medallionSize = Math.min(dims.width, dims.height) * 0.26;
    const medallionY = format === "story" ? dims.height * 0.28 : dims.height * 0.27;
    ctx.save();
    const glow = ctx.createRadialGradient(dims.width / 2, medallionY, medallionSize * 0.2, dims.width / 2, medallionY, medallionSize * 0.9);
    glow.addColorStop(0, `${theme.accent}88`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(dims.width / 2, medallionY, medallionSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f3c97a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(dims.width / 2, medallionY, medallionSize * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = theme.accent;
    ctx.textAlign = "center";
    ctx.font = `700 ${Math.round(medallionSize * 0.45)}px Georgia, serif`;
    ctx.fillText(theme.symbol, dims.width / 2, medallionY + medallionSize * 0.17);
    ctx.restore();

    const left = dims.width * 0.1;
    const textMax = dims.width * 0.8;
    let y = format === "story" ? dims.height * 0.5 : dims.height * 0.51;

    ctx.textAlign = "center";
    ctx.fillStyle = "#f3c97a";
    ctx.font = `700 ${Math.round(dims.width * 0.045)}px system-ui, -apple-system, Segoe UI, sans-serif`;
    ctx.fillText("REMNANT 13 MOONS", dims.width / 2, y);

    y += dims.height * 0.045;
    ctx.fillStyle = theme.accent;
    ctx.font = `700 ${Math.round(dims.width * 0.038)}px system-ui, -apple-system, Segoe UI, sans-serif`;
    ctx.fillText((shareState.moonName || "Living Day").toUpperCase(), dims.width / 2, y);

    y += dims.height * 0.05;
    ctx.fillStyle = "#f4f1e8";
    ctx.font = `600 ${Math.round(dims.width * 0.031)}px system-ui, -apple-system, Segoe UI, sans-serif`;
    const dayLine = shareState.moonNumber && shareState.moonDay
      ? `Moon ${shareState.moonNumber} · Day ${shareState.moonDay}/28`
      : `Moon ${shareState.moonNumber || "—"}`;
    ctx.fillText(dayLine, dims.width / 2, y);

    y += dims.height * 0.037;
    const gateLine = shareState.yearDay
      ? `Day ${shareState.yearDay}/364 · ${shareState.weekGate || "Week Gate"}`
      : shareState.weekGate || "Day Out of Time";
    ctx.fillText(clampText(gateLine, 64), dims.width / 2, y);

    if (options.includePhase && shareState.phaseName) {
      y += dims.height * 0.055;
      ctx.fillStyle = "#7af3ff";
      ctx.font = `600 ${Math.round(dims.width * 0.028)}px system-ui, -apple-system, Segoe UI, sans-serif`;
      const phaseLine = shareState.phaseIllumination === null
        ? `${shareState.phaseName}`
        : `${shareState.phaseName} · ${shareState.phaseIllumination}% illuminated`;
      ctx.fillText(clampText(phaseLine, 64), dims.width / 2, y);
    }

    y += dims.height * 0.05;
    ctx.fillStyle = "#f3c97a";
    ctx.font = `700 ${Math.round(dims.width * 0.025)}px system-ui, -apple-system, Segoe UI, sans-serif`;
    ctx.fillText(clampText(shareState.shabbatState || "Ordinary Day", 48), dims.width / 2, y);

    // Sunset line moves to the footer context — removed from content body.

    if (options.includeMovement && shareState.movement) {
      y += dims.height * 0.065;
      ctx.fillStyle = "#f4f1e8";
      ctx.font = `700 ${Math.round(dims.width * 0.025)}px system-ui, -apple-system, Segoe UI, sans-serif`;
      ctx.fillText("TODAY'S MOVEMENT", dims.width / 2, y);

      y += dims.height * 0.03;
      ctx.fillStyle = "#f4f1e8";
      ctx.font = `500 ${Math.round(dims.width * 0.026)}px system-ui, -apple-system, Segoe UI, sans-serif`;
      // Square: max 2 lines; Story: max 4 lines — keeps content above the footer area.
      const maxMovLines = format === "story" ? 4 : 2;
      const movLines = drawCenteredWrappedText(ctx, clampText(shareState.movement, 180), dims.width / 2, y, textMax, dims.height * 0.03, maxMovLines);
      y += movLines * dims.height * 0.03;
      ctx.textAlign = "center";
    }

    // Mirror line: only draw if it fits above the reserved footer area.
    if (shareState.mirrorLine) {
      const nextY = y + dims.height * 0.03;
      if (nextY <= footerTop - 16) {
        y = nextY;
        ctx.fillStyle = "#7af3ff";
        ctx.font = `500 ${Math.round(dims.width * 0.022)}px system-ui, -apple-system, Segoe UI, sans-serif`;
        ctx.fillText(clampText(shareState.mirrorLine, 84), dims.width / 2, y);
      }
    }

    // --- Footer ---
    // Optional context line: shabbatState · Sunset HH:MM PM
    // Drawn only when content y hasn't overflowed into the footer area.
    // Raw Gregorian date removed per design spec.
    const footerParts = [];
    if (shareState.shabbatState) footerParts.push(clampText(shareState.shabbatState, 32));
    if (options.includeSunset && shareState.sunset) footerParts.push(`Sunset ${shareState.sunset}`);
    const footerContextLine = footerParts.join(" · ");

    if (footerContextLine && y <= footerTop - 16) {
      ctx.fillStyle = "#d6deea";
      ctx.font = `500 ${ctxFontPx}px system-ui, -apple-system, Segoe UI, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(footerContextLine, dims.width / 2, contextY);
    }

    // Brand line is always the final, lowest text — inside the gold border.
    ctx.fillStyle = "#f3c97a";
    ctx.font = `700 ${brandFontPx}px system-ui, -apple-system, Segoe UI, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(BRAND_LINE, dims.width / 2, brandY);

    return canvas;
  }

  function cacheKey(shareState, format) {
    return [
      format,
      shareState.isoDate,
      shareState.moonNumber,
      Number(state.options.includePhase),
      Number(state.options.includeMovement),
      Number(state.options.includeSunset)
    ].join("|");
  }

  async function getRenderedCanvas(shareState, format) {
    const key = cacheKey(shareState, format);
    if (state.cache.has(key)) return state.cache.get(key);
    const canvas = await renderCard(shareState, format, state.options);
    state.cache.set(key, canvas);
    return canvas;
  }

  async function renderPreview() {
    if (!state.modal || !state.currentShareState) return;
    const previewHost = state.modal.querySelector("[data-share-day-preview]");
    if (!previewHost) return;

    previewHost.setAttribute("data-loading", "true");
    statusText("Rendering image…");

    try {
      const canvas = await getRenderedCanvas(state.currentShareState, state.currentFormat);
      previewHost.innerHTML = "";
      canvas.className = "share-day-preview-canvas";
      canvas.setAttribute("aria-label", `${CANVAS_DIMS[state.currentFormat].label} share preview`);
      previewHost.appendChild(canvas);
      statusText("Preview ready.");
    } catch {
      statusText("Could not render this share card. Try again.");
    } finally {
      previewHost.removeAttribute("data-loading");
    }
  }

  async function toBlob(canvas) {
    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), "image/png");
    });
  }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    state.objectUrls.add(url);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    window.setTimeout(() => {
      URL.revokeObjectURL(url);
      state.objectUrls.delete(url);
    }, 1200);
  }

  function clearObjectUrls() {
    state.objectUrls.forEach(url => URL.revokeObjectURL(url));
    state.objectUrls.clear();
  }

  async function downloadFormat(format) {
    if (!state.currentShareState) return;
    const canvas = await getRenderedCanvas(state.currentShareState, format);
    const blob = await toBlob(canvas);
    if (!blob) return;
    const filename = `remnant-13-moons-${state.currentShareState.isoDate || "day"}-${format}.png`;
    downloadBlob(blob, filename);

    const eventName = format === "square" ? "share_day_download_square" : "share_day_download_story";
    track(eventName, { format, method: "download" });
    recordShareAction(eventName, state.currentShareState, {
      format,
      method: "download",
      status: "image downloaded"
    });
    statusText(`${CANVAS_DIMS[format].label} image downloaded.`);
  }

  function getCurrentCompletePost() {
    const textArea = state.modal?.querySelector("[data-share-day-text]");
    const caption = textArea ? textArea.value : state.currentPackage?.description || "";
    return buildCompletePost(
      caption,
      state.currentPackage?.link || "",
      state.currentPackage?.hashtags || [],
      state.captionOptions.includeLink,
      state.captionOptions.includeHashtags
    );
  }

  async function copyText(value) {
    if (!value) return false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {}
    }

    const temp = document.createElement("textarea");
    temp.value = value;
    temp.setAttribute("readonly", "");
    temp.style.position = "fixed";
    temp.style.opacity = "0";
    document.body.appendChild(temp);
    temp.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(temp);
    return ok;
  }

  function buildNativeSharePlan(nav, file, shareData) {
    if (!(nav && typeof nav.share === "function")) return { method: "unavailable" };
    if (!(file && typeof nav.canShare === "function")) return { method: "text-link" };

    const withFile = { ...shareData, files: [file] };
    if (nav.canShare(withFile)) return { method: "file-text-link", data: withFile };
    if (nav.canShare({ files: [file] })) return { method: "file-only", data: { files: [file], title: shareData.title } };
    return { method: "text-link", data: shareData };
  }

  async function nativeShare() {
    if (!state.currentShareState || !state.currentPackage) return;
    const payload = state.currentSourcePayload || buildSourcePayload(state.currentSourceId);
    if (payload?.requiresSelection && !payload?.hasSelection) {
      statusText(payload.warning || "Select text before sharing.");
      return;
    }
    const caption = state.modal?.querySelector("[data-share-day-text]")?.value || payload?.standard || state.currentPackage.description;
    const completePost = payload?.full || getCurrentCompletePost();
    const shareData = {
      title: payload?.title ? `Scroll of Fire · ${payload.title}` : `Remnant 13 Moons · ${state.currentShareState.moonName}`,
      text: caption,
      url: payload?.link || state.currentPackage.link || state.currentShareState.link
    };

    if (!(navigator && typeof navigator.share === "function")) {
      statusText("Native sharing is not available here. Download the image and attach it manually.");
      return;
    }

    try {
      const canvas = await getRenderedCanvas(state.currentShareState, state.currentFormat);
      const blob = await toBlob(canvas);
      const file = blob
        ? new File([blob], `remnant-13-moons-${state.currentShareState.isoDate || "day"}.png`, { type: "image/png" })
        : null;

      const plan = buildNativeSharePlan(navigator, file, shareData);

      if (plan.method === "file-only") {
        await copyText(completePost);
        if (window.RemnantShare?.nativeShare) await window.RemnantShare.nativeShare(plan.data);
        else await navigator.share(plan.data);
        statusText("The image is ready to share. The caption has also been copied in case the selected app does not include it automatically.");
      } else if (plan.method === "file-text-link") {
        if (window.RemnantShare?.nativeShare) await window.RemnantShare.nativeShare(plan.data);
        else await navigator.share(plan.data);
        statusText("Native share opened.");
      } else if (plan.method === "text-link") {
        if (window.RemnantShare?.nativeShare) await window.RemnantShare.nativeShare(shareData);
        else await navigator.share(shareData);
        statusText("Native share opened. Download image to attach manually if needed.");
      } else {
        statusText("Native sharing is not available here. Download the image and attach it manually.");
        return;
      }

      track("share_day_native_open", { format: state.currentFormat, method: plan.method });
      recordShareAction("share_day_native_open", state.currentShareState, {
        format: state.currentFormat,
        method: plan.method,
        status: "share opened"
      });
    } catch (error) {
      if (error && error.name === "AbortError") {
        statusText("Native share canceled.");
      } else {
        statusText("Unable to open native share. Download image and attach manually.");
      }
    }
  }

  function setButtonLabels(shareState) {
    document.querySelectorAll("[data-share-day-open]").forEach(button => {
      if (!(button instanceof HTMLElement)) return;
      const sourceId = button.getAttribute("data-share-source-id");
      if (sourceId && sourceId !== "today") return;
      const source = button.getAttribute("data-share-source") || "";
      if (source === "moons" || source === "signal") {
        button.textContent = shareState.shareButtonLabel;
      } else {
        button.textContent = "Share Today";
      }
    });
  }

  function applyInert() {
    state.inertedNodes = [];
    if (!state.modal || !("inert" in HTMLElement.prototype)) return;

    Array.from(document.body.children).forEach(node => {
      if (node === state.modal) return;
      if (!(node instanceof HTMLElement)) return;
      state.inertedNodes.push({ node, inert: node.inert });
      node.inert = true;
    });
  }

  function restoreInert() {
    state.inertedNodes.forEach(entry => {
      entry.node.inert = entry.inert;
    });
    state.inertedNodes = [];
  }

  function closeModal() {
    if (!state.modal) return;
    state.modal.hidden = true;
    document.body.classList.remove("share-day-modal-open");
    restoreInert();
    clearObjectUrls();
    state.cache.clear();
    if (state.trigger && typeof state.trigger.focus === "function") state.trigger.focus();
  }

  function trapFocus(event) {
    if (event.key !== "Tab" || !state.modal || state.modal.hidden) return;
    const focusables = Array.from(state.modal.querySelectorAll("button,[href],input,textarea,[tabindex]:not([tabindex='-1'])"))
      .filter(el => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden"));
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function openModal(trigger, sourceId = "today") {
    state.currentShareState = deriveShareState();
    state.currentSourceId = sourceId || "today";
    state.currentSourcePayload = buildSourcePayload(state.currentSourceId);
    setButtonLabels(state.currentShareState);
    state.trigger = trigger || null;

    if (!state.modal) createModal();
    if (!state.modal) return;

    state.currentFormat = "square";
    state.currentMode = "standard";
    state.captionOptions = {
      includeCalendar: true,
      includeReflection: true,
      includeLink: true,
      includeHashtags: true,
      includeIntention: false
    };
    state.userEditedCaption = false;

    const title = state.modal.querySelector("[data-share-day-title]");
    if (title) {
      title.textContent = state.currentSourcePayload?.title
        ? `Share · ${state.currentSourcePayload.title}`
        : (state.currentShareState.isSelectedDate ? "Share This Day" : "Share Today");
    }

    const dateLabel = state.modal.querySelector("[data-share-day-date]");
    if (dateLabel) {
      dateLabel.textContent = state.currentShareState.readableDate || state.currentShareState.isoDate || "";
    }

    state.modal.querySelectorAll("[data-share-day-mode]").forEach(btn => {
      const mode = btn.getAttribute("data-share-day-mode") || "standard";
      btn.setAttribute("aria-selected", String(mode === "standard"));
    });

    ["includeCalendar", "includeReflection", "includeLink", "includeHashtags", "includeIntention"].forEach(key => {
      const input = state.modal.querySelector(`[data-caption-opt="${key}"]`);
      if (input) input.checked = !!state.captionOptions[key];
    });

    regeneratePackage(true);

    state.modal.hidden = false;
    document.body.classList.add("share-day-modal-open");
    applyInert();
    await renderPreview();

    const firstBtn = state.modal.querySelector("[data-share-day-close], [data-share-day-native]");
    if (firstBtn) firstBtn.focus();

    track("share_day_open", { format: state.currentFormat, method: "open" });
    recordShareAction("share_day_open", state.currentShareState, {
      format: state.currentFormat,
      method: "open",
      status: "share opened"
    });
  }

  function createModal() {
    const modal = document.createElement("section");
    modal.className = "share-day-modal";
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "false");
    modal.innerHTML = `
      <div class="share-day-backdrop" data-share-day-close></div>
      <div class="share-day-dialog" role="dialog" aria-modal="true" aria-labelledby="shareDayTitle">
        <header class="share-day-head">
          <div>
            <p class="share-day-kicker">REMNANT 13 MOONS</p>
            <h2 id="shareDayTitle" data-share-day-title>Share Today</h2>
            <p class="share-day-date" data-share-day-date></p>
          </div>
          <button type="button" class="share-day-close" data-share-day-close>Close</button>
        </header>

        <div class="share-day-format" role="tablist" aria-label="Share image format">
          <button type="button" data-share-day-format="square" aria-selected="true">Square 1080×1080</button>
          <button type="button" data-share-day-format="portrait" aria-selected="false">Portrait 1080×1350</button>
          <button type="button" data-share-day-format="story" aria-selected="false">Story 1080×1920</button>
        </div>

        <div class="share-day-format share-day-mode" role="tablist" aria-label="Description mode">
          <button type="button" data-share-day-mode="compact" aria-selected="false">Compact</button>
          <button type="button" data-share-day-mode="standard" aria-selected="true">Standard</button>
          <button type="button" data-share-day-mode="professional" aria-selected="false">Professional</button>
        </div>

        <div class="share-day-preview-wrap" data-share-day-preview data-loading="true"></div>

        <fieldset class="share-day-options">
          <legend>Image options</legend>
          <label><input type="checkbox" data-share-opt="phase" checked> Visible lunar phase</label>
          <label><input type="checkbox" data-share-opt="movement" checked> Today’s movement</label>
          <label><input type="checkbox" data-share-opt="sunset"> Sunset boundary</label>
        </fieldset>

        <fieldset class="share-day-options">
          <legend>Caption options</legend>
          <label><input type="checkbox" data-caption-opt="includeCalendar" checked> Include calendar details</label>
          <label><input type="checkbox" data-caption-opt="includeReflection" checked> Include reflection</label>
          <label><input type="checkbox" data-caption-opt="includeLink" checked> Include link</label>
          <label><input type="checkbox" data-caption-opt="includeHashtags" checked> Include hashtags</label>
          <label><input type="checkbox" data-caption-opt="includeIntention"> Include selected intention</label>
        </fieldset>

        <label class="share-day-text-label" for="shareDayText">Editable social description</label>
        <textarea id="shareDayText" class="share-day-text" data-share-day-text aria-describedby="shareDayCharacterCount"></textarea>
        <p id="shareDayCharacterCount" class="share-day-meta" data-share-day-char-count aria-live="polite"></p>
        <p class="share-day-meta share-day-warning" data-share-day-length-warning aria-live="polite"></p>
        <p class="share-day-meta"><strong>Active mode:</strong> <span data-share-day-active-mode>Standard</span></p>
        <p class="share-day-meta"><strong>Active link:</strong> <span data-share-day-active-link></span></p>
        <p class="share-day-meta"><strong>Selected hashtags:</strong> <span data-share-day-active-hashtags></span></p>
        <label class="share-day-text-label" for="shareDayCompletePreview">Complete post preview</label>
        <pre id="shareDayCompletePreview" class="share-day-complete-preview" data-share-day-complete-preview></pre>

        <div class="share-day-actions">
          <button type="button" data-share-day-copy="signal">Copy Signal</button>
          <button type="button" data-share-day-copy="standard">Copy Standard</button>
          <button type="button" data-share-day-copy="full">Copy Full Scroll</button>
          <button type="button" data-share-day-native>Native Share</button>
          <button type="button" data-share-day-copy="link">Copy Permanent Link</button>
          <button type="button" data-share-day-download="square">Generate Share Image · Square</button>
          <button type="button" data-share-day-download="portrait">Generate Share Image · Portrait</button>
          <button type="button" data-share-day-download="story">Generate Share Image · Story</button>
          <button type="button" data-share-day-restore>Restore Default Text</button>
          <button type="button" data-share-day-close>Close</button>
        </div>

        <details class="share-day-mobile-menu" data-share-day-mobile-menu>
          <summary>Share menu</summary>
          <div class="share-day-mobile-group">
            <strong>Share text</strong>
            <button type="button" data-share-day-copy="signal">Copy Signal</button>
            <button type="button" data-share-day-copy="standard">Copy Standard</button>
            <button type="button" data-share-day-copy="full">Copy Full Scroll</button>
            <button type="button" data-share-day-native>Native Share</button>
          </div>
          <div class="share-day-mobile-group">
            <strong>Share image</strong>
            <button type="button" data-share-day-download="square">Square</button>
            <button type="button" data-share-day-download="portrait">Portrait</button>
            <button type="button" data-share-day-download="story">Story</button>
          </div>
          <div class="share-day-mobile-group">
            <strong>Copy link</strong>
            <button type="button" data-share-day-copy="link">Copy Permanent Link</button>
          </div>
          <div class="share-day-mobile-group">
            <strong>Export</strong>
            <button type="button" data-share-day-copy="full">Copy Full Scroll</button>
          </div>
        </details>

        <p class="share-day-status" role="status" aria-live="polite" data-share-day-status></p>
      </div>
    `;

    modal.addEventListener("click", event => {
      const close = event.target.closest("[data-share-day-close]");
      if (close) {
        closeModal();
        return;
      }

      const formatBtn = event.target.closest("[data-share-day-format]");
      if (formatBtn) {
        state.currentFormat = formatBtn.getAttribute("data-share-day-format") || "square";
        modal.querySelectorAll("[data-share-day-format]").forEach(btn => {
          btn.setAttribute("aria-selected", String(btn === formatBtn));
        });
        renderPreview();
        return;
      }

      const modeBtn = event.target.closest("[data-share-day-mode]");
      if (modeBtn) {
        state.currentMode = modeBtn.getAttribute("data-share-day-mode") || "standard";
        modal.querySelectorAll("[data-share-day-mode]").forEach(btn => {
          btn.setAttribute("aria-selected", String(btn === modeBtn));
        });
        regeneratePackage(true);
        return;
      }

      const dl = event.target.closest("[data-share-day-download]");
      if (dl) {
        downloadFormat(dl.getAttribute("data-share-day-download"));
        return;
      }

      const restore = event.target.closest("[data-share-day-restore]");
      if (restore) {
        state.userEditedCaption = false;
        regeneratePackage(true);
        statusText("Default caption restored.");
        return;
      }

      const copy = event.target.closest("[data-share-day-copy]");
      if (copy) {
        const mode = copy.getAttribute("data-share-day-copy");
        const payload = state.currentSourcePayload || buildSourcePayload(state.currentSourceId);
        if (payload?.requiresSelection && !payload?.hasSelection) {
          statusText(payload.warning || "Select text before sharing.");
          return;
        }
        const link = payload?.link || state.currentPackage?.link || state.currentShareState?.link || "";
        const tags = state.currentPackage?.hashtags || CORE_HASHTAGS.slice(0, 3);

        if (mode === "signal") {
          const text = payload?.signal || state.currentPackage?.description || "";
          const copyAction = window.RemnantShare?.copySignal
            ? window.RemnantShare.copySignal(text, link)
            : copyText(text);
          Promise.resolve(copyAction).then(() => statusText("Signal copied."));
        } else if (mode === "standard") {
          const text = payload?.standard || state.currentPackage?.description || "";
          const copyAction = window.RemnantShare?.copyStandard
            ? window.RemnantShare.copyStandard(text, link, tags)
            : copyText(text);
          Promise.resolve(copyAction).then(() => statusText("Standard copied."));
        } else if (mode === "full") {
          const text = payload?.full || getCurrentCompletePost();
          const copyAction = window.RemnantShare?.copyFullScroll
            ? window.RemnantShare.copyFullScroll(text, link, tags)
            : copyText(text);
          Promise.resolve(copyAction).then(() => statusText("Full Scroll copied."));
        } else {
          const copyAction = window.RemnantShare?.copyPermanentLink
            ? window.RemnantShare.copyPermanentLink(link)
            : copyText(link);
          Promise.resolve(copyAction).then(() => statusText("Permanent link copied."));
        }
        return;
      }

      if (event.target.closest("[data-share-day-native]")) {
        nativeShare();
      }
    });

    modal.addEventListener("change", event => {
      const opt = event.target.closest("[data-share-opt]");
      if (opt) {
        const type = opt.getAttribute("data-share-opt");
        if (type === "phase") state.options.includePhase = opt.checked;
        if (type === "movement") state.options.includeMovement = opt.checked;
        if (type === "sunset") state.options.includeSunset = opt.checked;
        state.cache.clear();
        renderPreview();
        return;
      }

      const capOpt = event.target.closest("[data-caption-opt]");
      if (capOpt) {
        const key = capOpt.getAttribute("data-caption-opt");
        if (key in state.captionOptions) state.captionOptions[key] = !!capOpt.checked;
        regeneratePackage(true);
      }
    });

    modal.addEventListener("input", event => {
      if (!event.target.closest("[data-share-day-text]")) return;
      state.userEditedCaption = true;
      updateCaptionPreview();
    });

    document.addEventListener("keydown", event => {
      if (!state.modal || state.modal.hidden) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeModal();
        return;
      }
      trapFocus(event);
    });

    document.body.appendChild(modal);
    state.modal = modal;
  }

  function setupButtons() {
    document.addEventListener("click", event => {
      const trigger = event.target.closest("[data-share-day-open],[data-remnant-share-open]");
      if (!trigger) return;
      event.preventDefault();
      const sourceId =
        trigger.getAttribute("data-share-source-id") ||
        trigger.getAttribute("data-remnant-share-source") ||
        trigger.getAttribute("data-share-source") ||
        "today";
      const normalizedSource = sourceId === "moons" || sourceId === "signal" || sourceId === "homepage"
        ? "today"
        : sourceId;
      openModal(trigger, normalizedSource);
    });
  }

  function setupMoonListener() {
    document.addEventListener("sof:moon-render", event => {
      state.lastDetail = event.detail || null;
      const shareState = deriveShareState();
      setButtonLabels(shareState);
    });

    document.addEventListener("sof:equinox-render", event => {
      state.lastDetail = event.detail || null;
      const shareState = deriveShareState();
      setButtonLabels(shareState);
    });

    document.addEventListener("codexstatechange", () => {
      const shareState = deriveShareState();
      setButtonLabels(shareState);
    });
  }

  function setup() {
    setupButtons();
    setupMoonListener();
    setButtonLabels(deriveShareState());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup, { once: true });
  } else {
    setup();
  }

  window.CodexShareDay = {
    deriveShareState,
    buildDailyText,
    buildDeepLink,
    buildSourcePayload,
    getMoonTheme,
    buildDescriptionPackage,
    buildHashtags,
    _test: {
      clampText,
      toTitleDate,
      safeISO,
      MOON_THEMES,
      CANVAS_DIMS,
      DESCRIPTION_MODES,
      buildOpeningHook,
      buildReflection,
      buildCompletePost,
      buildNativeSharePlan,
      buildSourcePayload,
      isDayOutOfTime,
      normalizeShabbatCode,
      isNewMoonTransition,
      CORE_HASHTAGS
    }
  };
})();
