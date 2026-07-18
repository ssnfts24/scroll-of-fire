(() => {
  "use strict";

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));

  const LOG_KEY = "sof_moon_logs_v3";
  const LEGACY_LOG_KEY = "sof_moon_logs_v2";
  const TZ_KEY = "sof_moons_tz_v2";
  const BOUNDARY_KEY = "sof_moons_boundary_v1";
  const SUNSET_KEY = "sof_moons_sunset_v1";
  const LOCATION_KEY = "sof_moons_location_v1";

  const DEFAULT_CONFIG = {
    dayBoundary: "sunset",
    fallbackSunset: "18:00",
    anchorOverrides: {
      2026: "2026-04-17"
    },
    shabbat: {
      enabled: true,
      begins: "Friday sunset",
      ends: "Saturday sunset / nightfall",
      moonDays: [2, 9, 16, 23],
      preparationDay: 1,
      returnDay: 3,
      preserveContinuousWeekThroughYearGate: true
    }
  };

  const suppliedConfig = window.SOF_MOONS_CONFIG || {};
  const CONFIG = {
    ...DEFAULT_CONFIG,
    ...suppliedConfig,
    anchorOverrides: {
      ...DEFAULT_CONFIG.anchorOverrides,
      ...(suppliedConfig.anchorOverrides || {})
    },
    shabbat: {
      ...DEFAULT_CONFIG.shabbat,
      ...(suppliedConfig.shabbat || {})
    }
  };

  const MOONS = [
    { idx: 1, name: "Seed Flame", element: "Fire", freq: "144 Hz", essence: "Beginning, ignition, first witness", practice: "Start clean. Speak the first word. Mark the seed." },
    { idx: 2, name: "Root Waters", element: "Water", freq: "432 Hz", essence: "Memory, cleansing, emotional ground", practice: "Cleanse memory. Listen to dreams. Watch emotional weather." },
    { idx: 3, name: "Breath Gate", element: "Air", freq: "369 Hz", essence: "Word, air, signal, exchange", practice: "Guard speech. Track repeated words. Breathe before response." },
    { idx: 4, name: "Stone Witness", element: "Earth", freq: "174 Hz", essence: "Body, structure, faithful record", practice: "Build structure. Repair the physical. Record what happened." },
    { idx: 5, name: "Living Word", element: "Aether", freq: "528 Hz", essence: "Speech, vow, creative command", practice: "Speak with care. Create through ordered language." },
    { idx: 6, name: "Fire Trial", element: "Fire", freq: "417 Hz", essence: "Testing, courage, purification", practice: "Let false things burn. Choose courage without rushing." },
    { idx: 7, name: "Crown Balance", element: "Aether", freq: "963 Hz", essence: "Completion, justice, centered rule", practice: "Weigh the pattern. Balance mercy, truth, and consequence." },
    { idx: 8, name: "Deep Mirror", element: "Water", freq: "396 Hz", essence: "Reflection, hidden pattern, inner waters", practice: "Look beneath the surface. Journal before judging." },
    { idx: 9, name: "Return Path", element: "Earth", freq: "285 Hz", essence: "Restoration, repentance, spiral home", practice: "Correct course. Repair one broken loop." },
    { idx: 10, name: "Builder’s Hand", element: "Earth", freq: "741 Hz", essence: "Craft, repair, stewardship", practice: "Build, fix, organize, and make the invisible useful." },
    { idx: 11, name: "Star Remembrance", element: "Air", freq: "852 Hz", essence: "Inheritance, names, celestial memory", practice: "Remember names, lineage, signs, and the long story." },
    { idx: 12, name: "River of Signs", element: "Water", freq: "639 Hz", essence: "Movement, omens, living flow", practice: "Track timing. Move with wisdom. Do not force the river." },
    { idx: 13, name: "Completion Seal", element: "Aether", freq: "111 Hz", essence: "Harvest, sealing, preparation for reset", practice: "Close the loop. Harvest the lesson. Prepare the reset." }
  ];

  const DAY_ARCHETYPES = [
    ["Spark", "First ignition. Start, name, begin."],
    ["Witness", "Record what is actually there."],
    ["Breath", "Speak, listen, exchange."],
    ["Root", "Ground the body and home."],
    ["Water", "Feel, cleanse, remember."],
    ["Stone", "Build structure and boundary."],
    ["Fire", "Test, purify, choose courage."],
    ["Gate", "Make a decision or cross a threshold."],
    ["Mirror", "Reflect before reacting."],
    ["Hand", "Repair, craft, serve."],
    ["Voice", "Say the true thing cleanly."],
    ["River", "Move, adapt, follow flow."],
    ["Star", "Remember inheritance and direction."],
    ["Balance", "Weigh, measure, judge fairly."],
    ["Seed", "Plant the next pattern."],
    ["Trial", "Face resistance without panic."],
    ["Mercy", "Release what can be released."],
    ["Sword", "Cut the false attachment."],
    ["Oil", "Consecrate the ordinary."],
    ["Bread", "Receive provision and share it."],
    ["Watch", "Stay awake to timing."],
    ["Return", "Correct course."],
    ["Crown", "Govern the self first."],
    ["Lamp", "Bring light to one dark corner."],
    ["Name", "Recover identity and purpose."],
    ["Field", "Observe relationships."],
    ["Seal", "Close what is complete."],
    ["Rest", "Prepare the reset."]
  ];

  const WEEK_GATES = [
    ["Week 1 · Ignition", "Begin, gather signal, establish the first witness."],
    ["Week 2 · Formation", "Shape the pattern through body, speech, and daily structure."],
    ["Week 3 · Testing", "Watch pressure, resistance, correction, and refinement."],
    ["Week 4 · Sealing", "Harvest the lesson, close loops, and prepare the next moon."]
  ];

  const TZONES = [
    Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles",
    "America/Los_Angeles",
    "America/Denver",
    "America/Chicago",
    "America/New_York",
    "UTC"
  ].filter((value, index, all) => value && all.indexOf(value) === index);

  const params = new URLSearchParams(location.search);
  let selectedTZ = params.get("tz") || safeGet(TZ_KEY) || TZONES[0];
  let selectedDate = fromISO(params.get("date")) || todayInTimeZone(selectedTZ);
  let lastContext = null;

  function safeGet(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function safeRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  }

  function text(id, value) {
    const node = $("#" + id);
    if (node) node.textContent = value;
  }

  function val(id) {
    const node = $("#" + id);
    return node ? node.value || "" : "";
  }

  function setValue(id, value) {
    const node = $("#" + id);
    if (node) node.value = value;
  }

  function on(id, event, handler) {
    const node = $("#" + id);
    if (node) node.addEventListener(event, handler);
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function scrollBehavior() {
    return prefersReducedMotion() ? "auto" : "smooth";
  }

  function pad(number) {
    return String(number).padStart(2, "0");
  }

  function toISO(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function fromISO(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function addDays(date, amount) {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    next.setHours(12, 0, 0, 0);
    return next;
  }

  function dayDiff(a, b) {
    const A = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const B = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.floor((A - B) / 86400000);
  }

  function datePartsInTimeZone(date, timeZone) {
    // Use hour12: false as the primary approach for widest Safari compatibility.
    // hourCycle:"h23" is equivalent for "en-US" but has narrower support in older Safari.
    let parts;
    try {
      parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }).formatToParts(date);
    } catch {
      // Fallback: use UTC if the timezone string is invalid
      parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }).formatToParts(date);
    }

    const result = {};
    parts.forEach(part => {
      if (part.type !== "literal") {
        // hour12: false can return "24" for midnight in some locales; normalise to 0
        const val = Number(part.value);
        result[part.type] = (part.type === "hour" && val === 24) ? 0 : val;
      }
    });
    return result;
  }

  function todayInTimeZone(timeZone) {
    const parts = datePartsInTimeZone(new Date(), timeZone);
    return new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0);
  }

  function formatDateOnly(date, options = {}) {
    const safeDate = new Date(Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      12,
      0,
      0
    ));

    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      ...options
    }).format(safeDate);
  }

  function fmtShort(date) {
    return formatDateOnly(date, {
      weekday: undefined,
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }

  function parseClock(value) {
    const match = /^(\d{2}):(\d{2})$/.exec(value || "");
    if (!match) return { hour: 18, minute: 0, minutes: 1080 };

    const hour = Math.max(0, Math.min(23, Number(match[1])));
    const minute = Math.max(0, Math.min(59, Number(match[2])));
    return { hour, minute, minutes: hour * 60 + minute };
  }

  function boundaryMode() {
    const control = $("#boundaryMode");
    return control?.value || params.get("boundary") || safeGet(BOUNDARY_KEY) || CONFIG.dayBoundary;
  }

  function sunsetValue() {
    const control = $("#sunsetInput");
    return control?.value || params.get("sunset") || safeGet(SUNSET_KEY) || CONFIG.fallbackSunset;
  }

  function effectiveContext() {
    const mode = boundaryMode();
    const sunset = sunsetValue();
    const sunsetClock = parseClock(sunset);
    const now = new Date();
    const zoneNow = datePartsInTimeZone(now, selectedTZ);
    const currentZoneISO = `${zoneNow.year}-${pad(zoneNow.month)}-${pad(zoneNow.day)}`;
    const selectedISO = toISO(selectedDate);
    const isToday = selectedISO === currentZoneISO;
    const nowMinutes = zoneNow.hour * 60 + zoneNow.minute;

    const afterBoundary =
      mode !== "midnight" &&
      isToday &&
      nowMinutes >= sunsetClock.minutes;

    const effectiveDate = afterBoundary ? addDays(selectedDate, 1) : new Date(selectedDate);
    const info = remnantInfo(effectiveDate);
    const shabbat = shabbatInfo(effectiveDate, info);

    return {
      civilDate: new Date(selectedDate),
      civilISO: selectedISO,
      effectiveDate,
      effectiveISO: toISO(effectiveDate),
      mode,
      modeLabel:
        mode === "midnight"
          ? "Midnight"
          : mode === "manual"
            ? "Manual Sunset"
            : "Local Sunset",
      sunset,
      afterBoundary,
      isToday,
      nowMinutes,
      info,
      shabbat
    };
  }

  function moonAge(date) {
    const synodic = 29.530588853;
    const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
    const time = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
    const days = (time - knownNewMoon) / 86400000;
    return ((days % synodic) + synodic) % synodic;
  }

  function nearestNewMoonAfter(date) {
    let cursor = new Date(date);

    for (let i = 0; i < 40; i++) {
      const age = moonAge(cursor);
      const nextAge = moonAge(addDays(cursor, 1));

      if (age > 28.5 || nextAge < age) return addDays(cursor, 1);
      cursor = addDays(cursor, 1);
    }

    return cursor;
  }

  function anchorForYear(year) {
    const override = fromISO(CONFIG.anchorOverrides[year]);
    return override || nearestNewMoonAfter(new Date(year, 2, 20, 12, 0, 0));
  }

  function yearAnchorFor(date) {
    const year = date.getFullYear();
    const candidate = anchorForYear(year);
    return date < candidate ? anchorForYear(year - 1) : candidate;
  }

  function remnantInfo(date) {
    const anchor = yearAnchorFor(date);
    const diff = dayDiff(date, anchor);
    const cycleDays = 13 * 28;
    const inside = diff >= 0 && diff < cycleDays;
    const moonIndex = inside ? Math.floor(diff / 28) : 12;
    const dayInMoon = inside ? (diff % 28) + 1 : null;
    const moon = MOONS[moonIndex];

    return {
      anchor,
      diff,
      inside,
      moon,
      moonIndex,
      dayInMoon,
      dayOfYear: diff + 1,
      outsideDay: inside ? 0 : Math.max(1, diff - cycleDays + 1),
      yearEnd: addDays(anchor, cycleDays - 1),
      countedWeeks: 52,
      continuousWeekIndex: Math.floor(diff / 7) + 1
    };
  }

  function shabbatInfo(effectiveDate, info = remnantInfo(effectiveDate)) {
    const weekday = effectiveDate.getDay();
    const moonDays = new Set(CONFIG.shabbat.moonDays || [2, 9, 16, 23]);
    const alignedMoonDay = Boolean(info.inside && moonDays.has(info.dayInMoon));

    let state = "Ordinary Week Gate";
    let code = "ordinary";
    let instruction = "Work with measure. Prepare for the next appointed stop.";

    if (weekday === 5) {
      state = "Preparation Gate";
      code = "preparation";
      instruction = "Finish what is necessary. Prepare the household. Do not carry avoidable disorder into rest.";
    } else if (weekday === 6) {
      state = "Shabbat · Ceasing and Rest";
      code = "active";
      instruction = "Stop forcing. Guard the household. Share food. Rest, pray, review, and restore.";
    } else if (weekday === 0) {
      state = "Return Gate";
      code = "return";
      instruction = "Preserve the lesson and return to work through one deliberate next step.";
    }

    return {
      enabled: CONFIG.shabbat.enabled,
      state,
      code,
      instruction,
      alignedMoonDay,
      moonPosition: info.inside
        ? alignedMoonDay
          ? `Aligned · Moon Day ${info.dayInMoon}`
          : `Moon Day ${info.dayInMoon}`
        : "Outside counted cycle",
      window: `${CONFIG.shabbat.begins} → ${CONFIG.shabbat.ends}`,
      moonDays: [...moonDays],
      weekday
    };
  }

  function phaseName(age) {
    if (age < 1.2 || age > 28.3) return "New Moon";
    if (age < 6.4) return "Waxing Crescent";
    if (age < 8.4) return "First Quarter";
    if (age < 13.8) return "Waxing Gibbous";
    if (age < 16.2) return "Full Moon";
    if (age < 21.6) return "Waning Gibbous";
    if (age < 23.6) return "Last Quarter";
    return "Waning Crescent";
  }

  function illumination(age) {
    return (1 - Math.cos((age / 29.530588853) * Math.PI * 2)) / 2;
  }

  function solarGate(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const gates = [
      ["Capricorn", "Earth", "Structure, duty, mountain path"],
      ["Aquarius", "Air", "Signal, systems, future current"],
      ["Pisces", "Water", "Dream, compassion, unseen waters"],
      ["Aries", "Fire", "Spark, courage, first motion"],
      ["Taurus", "Earth", "Body, garden, provision"],
      ["Gemini", "Air", "Word, exchange, twin signal"],
      ["Cancer", "Water", "Home, memory, protection"],
      ["Leo", "Fire", "Heart, courage, solar witness"],
      ["Virgo", "Earth", "Order, craft, refinement"],
      ["Libra", "Air", "Balance, justice, relation"],
      ["Scorpio", "Water", "Depth, shadow, transformation"],
      ["Sagittarius", "Fire", "Arrow, journey, higher aim"]
    ];

    const cut = [20, 19, 20, 20, 21, 21, 22, 22, 22, 23, 22, 21];
    const index = day < cut[month - 1] ? (month + 10) % 12 : (month + 11) % 12;
    return gates[index];
  }

  function logs() {
    try {
      const current = JSON.parse(safeGet(LOG_KEY) || "null");
      if (Array.isArray(current)) return current;

      const legacy = JSON.parse(safeGet(LEGACY_LOG_KEY) || "[]");
      if (Array.isArray(legacy)) {
        saveLogs(legacy);
        return legacy;
      }
    } catch {}

    return [];
  }

  function saveLogs(list) {
    safeSet(LOG_KEY, JSON.stringify(list.slice(0, 300)));
  }

  function drawMoon(age) {
    const canvas = $("#simMoon");
    if (!canvas) return;

    const context = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.34;
    const lit = illumination(age);
    const waxing = age < 14.765;

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#05070d";
    context.fillRect(0, 0, width, height);

    const glow = context.createRadialGradient(centerX, centerY, 5, centerX, centerY, radius * 2.3);
    glow.addColorStop(0, "rgba(122,243,255,.22)");
    glow.addColorStop(.5, "rgba(243,201,122,.10)");
    glow.addColorStop(1, "rgba(0,0,0,0)");

    context.fillStyle = glow;
    context.beginPath();
    context.arc(centerX, centerY, radius * 2.2, 0, Math.PI * 2);
    context.fill();

    context.save();
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.clip();

    context.fillStyle = "#121722";
    context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);

    context.fillStyle = "#f4f1e8";
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fill();

    const shadowWidth = radius * 2 * Math.abs(1 - lit * 2);
    context.fillStyle = "#121722";
    context.beginPath();

    if (lit < .5) {
      context.rect(centerX - radius, centerY - radius, radius * 2, radius * 2);

      if (waxing) {
        context.ellipse(centerX + radius, centerY, radius - shadowWidth / 2, radius, 0, Math.PI / 2, Math.PI * 1.5, true);
      } else {
        context.ellipse(centerX - radius, centerY, radius - shadowWidth / 2, radius, 0, -Math.PI / 2, Math.PI / 2, true);
      }

      context.fill("evenodd");
    } else {
      if (waxing) {
        context.ellipse(centerX - radius, centerY, shadowWidth / 2, radius, 0, -Math.PI / 2, Math.PI / 2, true);
      } else {
        context.ellipse(centerX + radius, centerY, shadowWidth / 2, radius, 0, Math.PI / 2, Math.PI * 1.5, true);
      }

      context.fill();
    }

    context.restore();

    context.strokeStyle = "rgba(243,201,122,.55)";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.stroke();

    context.fillStyle = "rgba(244,241,232,.92)";
    context.font = "800 15px Inter, system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText(`${phaseName(age)} · ${Math.round(lit * 100)}%`, centerX, 28);
  }

  function buildSeal(context, age, solar, dayArch, week) {
    const info = context.info;
    const phase = phaseName(age);
    const lit = Math.round(illumination(age) * 100);
    const title = info.inside
      ? `Moon ${info.moon.idx} · Day ${info.dayInMoon} — ${info.moon.name}`
      : `Outside Count — ${info.moon.name}`;

    const civilLine = context.civilISO === context.effectiveISO
      ? formatDateOnly(context.effectiveDate)
      : `${formatDateOnly(context.civilDate)} · after ${context.sunset}, effective ${formatDateOnly(context.effectiveDate)}`;

    const body =
`☲ REMNANT DAILY SEAL ☲

${civilLine}
${title}

Day Boundary:
${context.modeLabel} · ${context.sunset}

Shabbat Gate:
${context.shabbat.state}
${context.shabbat.instruction}

Moon Essence:
${info.moon.essence}

Practice:
${info.moon.practice}

Day Archetype:
${dayArch[0]} — ${dayArch[1]}

Week Gate:
${week[0]} — ${week[1]}

Visible Moon:
${phase} · ${lit}% illuminated

Solar Gate:
${solar[0]} · ${solar[1]}
${solar[2]}

Carrier Tone:
${info.moon.freq} · ${info.moon.element}

Seal:
Observe first.
Record clearly.
Interpret slowly.
Repair one thing.
Carry the witness forward.`;

    text("sealTitle", title);
    text("sealBody", body);

    text("promptBody",
`1. What did my body reveal before my mind explained it?

2. What repeated today: number, word, mood, place, person, animal, weather, or timing?

3. What needs repair, not reaction?

4. What is the one clean action I can take?

5. What should be sealed and released before the next day?`);

    return body;
  }

  function buildWitness() {
    const context = lastContext || effectiveContext();
    const info = context.info;
    const age = moonAge(context.effectiveDate);
    const solar = solarGate(context.effectiveDate);
    const dayArch = info.inside
      ? DAY_ARCHETYPES[info.dayInMoon - 1]
      : ["Outside Count", "Reset, reflection, year threshold."];

    const markedShabbat = val("shabbatInput");
    const shabbatLine = markedShabbat && markedShabbat !== "Not marked"
      ? markedShabbat
      : context.shabbat.state;

    const output =
`Civil Date: ${formatDateOnly(context.civilDate)}
Effective Remnant Date: ${formatDateOnly(context.effectiveDate)}
Day Boundary: ${context.modeLabel} · ${context.sunset}
Shabbat State: ${shabbatLine}
Shabbat Alignment: ${context.shabbat.moonPosition}
Remnant Moon: ${info.moon.name}
Moon Day: ${info.inside ? `${info.dayInMoon}/28` : `Outside Count · Day ${info.outsideDay}`}
Year Day: ${info.inside ? `${info.dayOfYear}/364` : "Outside counted cycle"}
Visible Moon Phase: ${phaseName(age)} · ${Math.round(illumination(age) * 100)}%
Solar Gate: ${solar[0]} · ${solar[1]}
Day Archetype: ${dayArch[0]}
Carrier Tone: ${info.moon.freq}
Element: ${info.moon.element}
Earth Hum / Kp Status: ${val("kpInput") || "Unknown / not checked"}

Sleep: ${val("sleepInput")}
Dreams: ${val("dreamInput")}
Body Signal: ${val("bodyInput")}
Emotional Weather: ${val("emotionInput")}
Repeated Signs: ${val("signsInput")}
Technology / Animal / Weather Notes: ${val("fieldInput")}

Action / Lesson:
${val("lessonInput")}

Witness:
Record first. Interpret later. Compare across 3, 7, 14, and 28 days.`;

    text("witnessOutput", output);
    return output;
  }

  function updateBoundaryPresentation(context) {
    document.documentElement.dataset.dayBoundary = context.mode;
    document.body.dataset.remnantBoundary = context.mode;
    document.body.dataset.shabbatState = context.shabbat.code;

    text("statBoundary", context.modeLabel);
    text("statShabbat", context.shabbat.state);
    text("shabbatState", context.shabbat.state);
    text("shabbatWindow", context.shabbat.window);
    text("shabbatMoonPosition", context.shabbat.moonPosition);
    text("shabbatInstruction", context.shabbat.instruction);

    const shabbatInput = $("#shabbatInput");
    if (shabbatInput && shabbatInput.value === "Not marked") {
      if (context.shabbat.code === "preparation") shabbatInput.value = "Preparation Gate";
      if (context.shabbat.code === "active") shabbatInput.value = "Shabbat · Ceasing and Rest";
      if (context.shabbat.code === "return") shabbatInput.value = "Return Gate";
    }

    const boundaryStatus = $("#boundaryStatus");
    if (boundaryStatus) {
      if (context.mode === "midnight") {
        boundaryStatus.textContent = "Midnight mode is active. Shabbat still begins at Friday sunset, so this mode does not fully align the calendar day with Shabbat.";
      } else if (context.afterBoundary) {
        boundaryStatus.textContent = `${context.modeLabel} passed at ${context.sunset}. The effective Remnant date is now ${context.effectiveISO}.`;
      } else {
        boundaryStatus.textContent = `${context.modeLabel} is set for ${context.sunset}. The Remnant day advances when that boundary is reached.`;
      }
    }
  }

  function setCalendarState(state, message) {
    const card = document.querySelector(".today-calendar-summary");
    if (!card) return;
    card.classList.remove("is-loading", "is-ready", "has-error");
    card.classList.add(state);
    if (state === "has-error") {
      let errNode = card.querySelector(".calendar-error-msg");
      if (!errNode) {
        errNode = document.createElement("p");
        errNode.className = "calendar-error-msg";
        errNode.setAttribute("role", "alert");
        card.appendChild(errNode);
      }
      errNode.textContent = message || "Calendar unavailable. Previous, Today, and Next still work.";
    } else {
      const errNode = card.querySelector(".calendar-error-msg");
      if (errNode) errNode.remove();
    }
    // Announce ready state once for accessibility
    if (state === "is-ready") {
      const live = document.getElementById("appStatusLive");
      if (live && live.textContent === "Loading calendar…") live.textContent = "";
    }
  }

  function render() {
    let context;
    try {
      context = effectiveContext();
    } catch (err) {
      console.error("13 Moons: failed to compute effective context", err);
      setCalendarState("has-error", "Calendar data unavailable. Check your timezone settings.");
      return;
    }
    lastContext = context;

    const info = context.info;
    const age = moonAge(context.effectiveDate);
    const lit = illumination(age);
    const phase = phaseName(age);
    const solar = solarGate(context.effectiveDate);
    const dayArch = info.inside
      ? DAY_ARCHETYPES[info.dayInMoon - 1]
      : ["Outside Count", "Reset, reflection, year threshold."];
    const week = info.inside
      ? WEEK_GATES[Math.floor((info.dayInMoon - 1) / 7)]
      : ["Outside Gate", "Days beyond the 364-counted cycle."];

    const selectedNotice = $("#todaySelectedNotice");
    const deterministicMovement = dayArch?.[1] || window.CodexState?.dailyMovement;
    const movementText = deterministicMovement || "Open today's full reading to view the current movement.";
    const patternCount = detectPatterns(logs()).count;

    setValue("datePick", toISO(selectedDate));
    text("shareDayBtn", context.isToday ? "Share Today" : "Share This Day");
    text("heroShareBtn", context.isToday ? "✦ Share Today" : "✦ Share This Day");
    text("heroMovement", movementText);
    if (selectedNotice) {
      if (context.isToday) {
        selectedNotice.hidden = true;
        selectedNotice.textContent = "";
      } else {
        selectedNotice.hidden = false;
        selectedNotice.textContent = `Viewing selected date ${formatDateOnly(context.civilDate)}.`;
      }
    }
    text("nowDate", formatDateOnly(context.civilDate));
    text("nowTZ", `${selectedTZ} · ${context.modeLabel}`);
    updateBoundaryPresentation(context);

    text("moonName", info.moon.name);
    text("moonEssence", info.moon.essence);
    text(
      "moonLine",
      info.inside
        ? `Moon ${info.moon.idx} · Day ${info.dayInMoon}/28 · Day ${info.dayOfYear}/364`
        : `Outside Count · Day ${info.outsideDay} after Completion Seal`
    );
    text("yearSpan", `Anchor: ${fmtShort(info.anchor)} · Counted year ends: ${fmtShort(info.yearEnd)}`);
    text(
      "moonPractice",
      info.inside
        ? info.moon.practice
        : "Review, repair, clear the ledger, preserve the weekly count, and prepare the next anchor."
    );

    text("commandMoon", info.moon.name);
    text(
      "commandLine",
      info.inside
        ? `Moon ${info.moon.idx} · Day ${info.dayInMoon}/28 · ${info.moon.element} · ${info.moon.freq}`
        : `Outside Count · ${info.moon.name}`
    );
    text("statMoonDay", info.inside ? `${info.dayInMoon}/28` : "Outside");
    text("statPhase", phase);
    text("statSolar", solar[0]);
    text("statField", (val("kpInput") || "Unknown").split("·")[0].trim());
    text("statLogs", logs().length);
    text("statPatterns", patternCount);
    const patternsCard = $("#statPatternsCard");
    if (patternsCard) {
      patternsCard.hidden = patternCount === 0 && window.matchMedia("(max-width: 760px)").matches;
    }

    text("dayInMoon", info.inside ? info.dayInMoon : "⊙");
    text("moonLength", info.inside ? "/28" : "reset");

    const progress = info.inside ? info.dayInMoon / 28 : 1;
    const arc = $("#moonArc");
    if (arc) arc.style.strokeDashoffset = String(314 - 314 * progress);

    const weekDots = $("#weekDots");
    if (weekDots) {
      const shabbatDays = new Set(CONFIG.shabbat.moonDays);

      weekDots.innerHTML = Array.from({ length: 28 }, (_, index) => {
        const number = index + 1;
        const classes = ["dot"];

        if (info.inside && number < info.dayInMoon) classes.push("done");
        if (info.inside && number === info.dayInMoon) classes.push("today");
        if (shabbatDays.has(number)) classes.push("shabbat");
        if ([1, 8, 15, 22].includes(number)) classes.push("preparation");

        const label = shabbatDays.has(number)
          ? `Day ${number} · Shabbat`
          : `Day ${number}`;

        return `<span class="${classes.join(" ")}" title="${label}" aria-label="${label}"></span>`;
      }).join("");
    }

    text("phaseLine", `${phase} · ${Math.round(lit * 100)}% illuminated`);
    text("phaseMeta", `Approximate lunar age: ${age.toFixed(2)} days.`);
    drawMoon(age);

    text("dayArchetype", dayArch[0]);
    text("dayArchetypeCopy", dayArch[1]);
    text("weekGate", week[0]);
    text("weekGateCopy", week[1]);
    text("solarGate", `${solar[0]} · ${solar[1]}`);
    text("skyMirrorCopy", solar[2]);
    renderTodaySummary(context, phase, lit, week, movementText);

    renderClockOnly();
    renderRemnantCalendar(context);
    renderGregorian(context);
    renderYearMap(info);
    buildSeal(context, age, solar, dayArch, week);
    buildWitness();
    renderSaved();
    renderTimeline();

    document.dispatchEvent(new CustomEvent("sof:moon-render", {
      detail: {
        date: new Date(context.civilDate),
        civilDate: new Date(context.civilDate),
        civilISO: context.civilISO,
        effectiveDate: new Date(context.effectiveDate),
        effectiveISO: context.effectiveISO,
        timezone: selectedTZ,
        boundary: {
          mode: context.mode,
          label: context.modeLabel,
          sunset: context.sunset,
          afterBoundary: context.afterBoundary
        },
        shabbat: context.shabbat,
        info,
        moonAge: age,
        phase,
        illumination: lit,
        solar,
        dayArch,
        week,
        logs: logs(),
        patterns: detectPatterns(logs())
      }
    }));
    setCalendarState("is-ready");
  }

  function renderTodaySummary(context, phase, lit, week, movementText) {
    text("todaySummaryTitle", formatDateOnly(context.civilDate, {
      year: undefined,
      month: undefined,
      day: undefined,
      weekday: "long"
    }));
    const selectedDateLine = formatDateOnly(context.civilDate, {
      weekday: undefined,
      month: "long",
      day: "numeric",
      year: "numeric"
    });
    text(
      "todaySummaryDate",
      context.isToday ? selectedDateLine : `${selectedDateLine} · Selected date view`
    );

    const info = context.info;
    text(
      "todaySummaryMoonLine",
      info.inside
        ? `Moon ${info.moon.idx} · Day ${info.dayInMoon}/28 · Day ${info.dayOfYear}/364`
        : "Outside Count · Completion Seal"
    );
    text("todaySummaryMoonDay", info.inside ? String(info.dayInMoon) : "⊙");
    text("todaySummaryMoonProgress", info.inside ? `Day ${info.dayInMoon} of 28` : "Outside Count");
    text("todaySummaryMoonName", `Moon ${info.moon.idx} · ${info.moon.name}`);

    const weekNumber = info.inside ? Math.floor((info.dayInMoon - 1) / 7) + 1 : null;
    const weekName = week[0]?.split("·")[1]?.trim() || week[0] || "Outside Gate";
    text(
      "todaySummaryWeek",
      weekNumber ? `Week ${weekNumber} · ${weekName}` : "Outside Gate"
    );
    text("todaySummaryPhase", `${phase} · ${Math.round(lit * 100)}% illuminated`);
    text("todaySummaryBoundary", context.shabbat.state);
    text("todaySummaryShabbat", info.inside ? `Day ${info.dayOfYear}/364` : "Outside Count");
    text("heroMovement", movementText);

    const grid = $("#todaySummaryMoonGrid");
    if (!grid) return;

    const shabbatDays = new Set(CONFIG.shabbat.moonDays);
    const preparationDay = Number(CONFIG.shabbat.preparationDay);
    const returnDay = Number(CONFIG.shabbat.returnDay);
    const selectedDay = info.inside ? info.dayInMoon : null;

    const nowInfo = remnantInfo(todayInTimeZone(selectedTZ));
    const realCurrentDay =
      nowInfo.inside && nowInfo.moon.idx === info.moon.idx ? nowInfo.dayInMoon : null;

    const logDays = new Set(
      logs()
        .filter(entry => entry && entry.moon === info.moon.name)
        .map(entry => Number(entry.moonDay))
        .filter(day => Number.isInteger(day) && day >= 1 && day <= 28)
    );

    grid.innerHTML = Array.from({ length: 28 }, (_, index) => {
      const day = index + 1;
      const classes = ["today-summary-grid-day"];
      const labels = [`Day ${day}`];

      if (selectedDay === day) {
        classes.push("selected");
        labels.push("selected");
      }
      if (realCurrentDay === day) {
        classes.push("today");
        labels.push("today");
      }
      if (shabbatDays.has(day)) {
        classes.push("shabbat");
        labels.push("Shabbat");
      }
      if (day === preparationDay) {
        classes.push("preparation");
        labels.push("Preparation");
      }
      if (day === returnDay) {
        classes.push("return");
        labels.push("Return");
      }
      if (logDays.has(day)) {
        classes.push("has-log");
        labels.push("Witness log");
      }

      const note =
        shabbatDays.has(day) ? "Shabbat"
          : day === preparationDay ? "Prep"
            : day === returnDay ? "Return"
              : logDays.has(day) ? "Log"
                : "";

      return `<button type="button" class="${classes.join(" ")}" data-moon-day="${day}" aria-label="${labels.join(" · ")}" ${selectedDay === day ? 'aria-current="date"' : ""}>
        <strong>${day}</strong>
        <small>${note || "Moon Day"}</small>
      </button>`;
    }).join("");
  }

  function renderRemnantCalendar(context) {
    const remCal = $("#remCal");
    if (!remCal) return;

    const info = context.info;
    const shabbatDays = new Set(CONFIG.shabbat.moonDays);

    remCal.innerHTML = Array.from({ length: 28 }, (_, index) => {
      const number = index + 1;
      const classes = ["calDay"];
      const archetype = DAY_ARCHETYPES[index];

      if (info.inside && number === info.dayInMoon) classes.push("today");
      if (shabbatDays.has(number)) classes.push("shabbat");
      if ([1, 8, 15, 22].includes(number)) classes.push("preparation");

      return `<div class="${classes.join(" ")}">
        <strong>${number}</strong>
        <span>${archetype[0]}</span>
        ${shabbatDays.has(number) ? `<span class="shabbat-mark">שבת</span>` : ""}
        <br>
        <small class="meta">${archetype[1]}</small>
      </div>`;
    }).join("");
  }

  function renderGregorian(context) {
    const gregCal = $("#gregCal");
    if (!gregCal) return;

    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const first = new Date(year, month, 1, 12, 0, 0);
    const last = new Date(year, month + 1, 0, 12, 0, 0);
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    let html = names.map(name => `<div class="weekday">${name}</div>`).join("");

    for (let index = 0; index < first.getDay(); index++) {
      html += `<div class="g-pad"></div>`;
    }

    for (let day = 1; day <= last.getDate(); day++) {
      const current = new Date(year, month, day, 12, 0, 0);
      const info = remnantInfo(current);
      const classes = ["gregDay"];

      if (toISO(current) === context.civilISO) classes.push("today");
      if (toISO(current) === context.effectiveISO && context.afterBoundary) classes.push("effective");
      if (current.getDay() === 6) classes.push("shabbat");
      if (current.getDay() === 5) classes.push("preparation");

      html += `<div class="${classes.join(" ")}">
        <strong>${day}</strong>
        <span>${info.inside ? `M${info.moon.idx} · D${info.dayInMoon}` : "Outside"}</span>
        ${current.getDay() === 6 ? `<span class="shabbat-mark">שבת</span>` : ""}
        <br>
        <small class="meta">${info.moon.name}</small>
      </div>`;
    }

    gregCal.innerHTML = html;
  }

  function renderYearMap(info) {
    text(
      "outsideInfo",
      `Counted cycle: ${fmtShort(info.anchor)} through ${fmtShort(info.yearEnd)} · 364 days · 52 complete weeks · outside days begin ${fmtShort(addDays(info.yearEnd, 1))}`
    );

    const body = $("#yearMapBody");
    if (!body) return;

    body.innerHTML = MOONS.map((moon, index) => {
      const start = addDays(info.anchor, index * 28);
      const end = addDays(start, 27);

      return `<tr>
        <td>Moon ${moon.idx}</td>
        <td>${moon.name}</td>
        <td>${moon.essence}</td>
        <td>${moon.element}</td>
        <td>${moon.freq}</td>
        <td>${fmtShort(start)}</td>
        <td>${fmtShort(end)}</td>
        <td>${moon.practice}</td>
      </tr>`;
    }).join("");
  }

  function saveLog() {
    const context = lastContext || effectiveContext();
    const list = logs();

    list.unshift({
      date: context.civilISO,
      effectiveDate: context.effectiveISO,
      moon: context.info.moon.name,
      moonDay: context.info.dayInMoon,
      text: buildWitness(),
      saved: new Date().toISOString(),
      timezone: selectedTZ,
      boundary: context.mode,
      sunset: context.sunset,
      shabbat: context.shabbat.state,
      kp: val("kpInput"),
      signs: val("signsInput"),
      body: val("bodyInput"),
      dreams: val("dreamInput"),
      emotion: val("emotionInput")
    });

    saveLogs(list);
    renderSaved();
    renderTimeline();
    toast("Witness saved");

    document.dispatchEvent(new CustomEvent("sof:witness-saved", {
      detail: { logs: logs(), context }
    }));
  }

  function renderSaved() {
    const list = logs();
    text("statLogs", list.length);

    const savedList = $("#savedList");
    if (!savedList) return;

    savedList.innerHTML = list.length
      ? list.map((entry, index) => `
        <article class="savedEntry">
          <strong>${escapeHTML(entry.effectiveDate || entry.date)} · ${escapeHTML(entry.moon || "Remnant Log")}</strong>
          <p class="meta">${escapeHTML(entry.shabbat || "")}${entry.shabbat ? " · " : ""}Saved ${new Date(entry.saved).toLocaleString()}</p>
          <pre class="fine">${escapeHTML(entry.text)}</pre>
          <button class="lab-btn ghost copySaved" data-i="${index}" type="button">Copy</button>
        </article>
      `).join("")
      : `<p class="meta">No saved logs yet.</p>`;

    $$(".copySaved").forEach(button => {
      button.addEventListener("click", () => {
        const item = list[Number(button.dataset.i)];
        if (navigator.clipboard) navigator.clipboard.writeText(item.text);
        toast("Copied");
      });
    });
  }

  function detectPatterns(list) {
    const joined = list
      .slice(0, 28)
      .map(entry => [
        entry.signs,
        entry.body,
        entry.dreams,
        entry.emotion,
        entry.kp,
        entry.shabbat
      ].join(" "))
      .join(" ")
      .toLowerCase();

    const terms = joined.match(/\b[0-9]{2,4}\b|\b[a-z]{4,}\b/g) || [];
    const skip = new Set([
      "unknown", "checked", "field", "moon", "body", "dreams", "sleep",
      "weather", "signal", "with", "from", "this", "that", "have"
    ]);
    const counts = {};

    terms.forEach(term => {
      if (skip.has(term)) return;
      counts[term] = (counts[term] || 0) + 1;
    });

    const top = Object.entries(counts)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    return { count: top.length, top };
  }

  function renderTimeline() {
    const list = logs();
    const patterns = detectPatterns(list);
    text("statPatterns", patterns.count);

    const alerts = $("#patternAlerts");
    if (alerts) {
      alerts.innerHTML = patterns.top.length
        ? patterns.top.map(([term, count]) => `
          <article class="mini pattern-memory-card">
            <h3>${escapeHTML(term)}</h3>
            <p class="meta">Repeated ${count} times in recent logs.</p>
          </article>
        `).join("")
        : `<p class="meta">No repeated patterns detected yet. Save more daily logs.</p>`;
    }

    const timeline = $("#timelineList");
    if (timeline) {
      timeline.innerHTML = list.length
        ? list.slice(0, 28).map(entry => `
          <article class="savedEntry">
            <strong>${escapeHTML(entry.effectiveDate || entry.date)} · ${escapeHTML(entry.moon || "Log")}</strong>
            <p class="meta">${escapeHTML([
              entry.shabbat,
              entry.kp,
              entry.signs,
              entry.body
            ].filter(Boolean).join(" · "))}</p>
          </article>
        `).join("")
        : `<p class="meta">No timeline yet.</p>`;
    }
  }

  function escapeHTML(value) {
    return String(value || "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[character]));
  }

  function renderClockOnly() {
    text("nowClock", new Intl.DateTimeFormat("en-US", {
      timeZone: selectedTZ,
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    }).format(new Date()));
  }

  function normalizeDegrees(value) {
    let result = value % 360;
    if (result < 0) result += 360;
    return result;
  }

  function dayOfYear(date) {
    return Math.floor(
      (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
       Date.UTC(date.getFullYear(), 0, 0)) / 86400000
    );
  }

  function calculateSunsetUTC(date, latitude, longitude) {
    const zenith = 90.833;
    const N = dayOfYear(date);
    const lngHour = longitude / 15;
    const t = N + ((18 - lngHour) / 24);
    const M = (0.9856 * t) - 3.289;

    let L = M +
      (1.916 * Math.sin(M * Math.PI / 180)) +
      (0.020 * Math.sin(2 * M * Math.PI / 180)) +
      282.634;
    L = normalizeDegrees(L);

    let RA = Math.atan(0.91764 * Math.tan(L * Math.PI / 180)) * 180 / Math.PI;
    RA = normalizeDegrees(RA);

    const Lquadrant = Math.floor(L / 90) * 90;
    const RAquadrant = Math.floor(RA / 90) * 90;
    RA = (RA + (Lquadrant - RAquadrant)) / 15;

    const sinDec = 0.39782 * Math.sin(L * Math.PI / 180);
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosH =
      (Math.cos(zenith * Math.PI / 180) -
       (sinDec * Math.sin(latitude * Math.PI / 180))) /
      (cosDec * Math.cos(latitude * Math.PI / 180));

    if (cosH > 1 || cosH < -1) return null;

    let H = Math.acos(cosH) * 180 / Math.PI;
    H /= 15;

    const T = H + RA - (0.06571 * t) - 6.622;
    const rawUT = T - lngHour;
    const dayOffset = Math.floor(rawUT / 24);
    const UT = rawUT - (dayOffset * 24);

    const wholeHour = Math.floor(UT);
    const wholeMinute = Math.floor((UT - wholeHour) * 60);
    const seconds = Math.round((((UT - wholeHour) * 60) - wholeMinute) * 60);

    return new Date(Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + dayOffset,
      wholeHour,
      wholeMinute,
      seconds
    ));
  }

  function calculateSunset(date, latitude, longitude, timeZone = selectedTZ) {
    const utc = calculateSunsetUTC(date, latitude, longitude);
    if (!utc) return null;

    let parts;
    try {
      parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).formatToParts(utc);
    } catch {
      parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).formatToParts(utc);
    }

    const values = {};
    parts.forEach(part => {
      if (part.type !== "literal") {
        const val = part.value;
        // Normalise "24" → "00" for midnight
        values[part.type] = val === "24" ? "00" : val;
      }
    });

    return {
      date: utc,
      time: `${values.hour}:${values.minute}`,
      latitude,
      longitude,
      timeZone
    };
  }

  function savedLocation() {
    try {
      const parsed = JSON.parse(safeGet(LOCATION_KEY) || "null");
      if (
        parsed &&
        Number.isFinite(parsed.latitude) &&
        Number.isFinite(parsed.longitude)
      ) {
        return parsed;
      }
    } catch {}

    return null;
  }

  function refreshCalculatedSunset({ emit = false } = {}) {
    const location = savedLocation();
    if (!location || boundaryMode() === "midnight") return null;

    const result = calculateSunset(
      selectedDate,
      location.latitude,
      location.longitude,
      selectedTZ
    );

    if (!result) return null;

    setValue("sunsetInput", result.time);
    safeSet(SUNSET_KEY, result.time);

    if (emit) {
      document.dispatchEvent(new CustomEvent("sof:sunset-calculated", {
        detail: {
          ...result,
          civilISO: toISO(selectedDate)
        }
      }));
    }

    return result;
  }

  function drawSky() {
    const canvas = $("#skyBg");
    if (!canvas) return;

    const context = canvas.getContext("2d");
    let stars = [];
    let frame = null;

    function fit() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;

      stars = Array.from({ length: 160 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.6 + .25,
        a: Math.random() * Math.PI * 2
      }));
    }

    function paintStatic() {
      context.clearRect(0, 0, canvas.width, canvas.height);

      stars.forEach(star => {
        context.fillStyle = "rgba(244,241,232,.18)";
        context.beginPath();
        context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        context.fill();
      });
    }

    function loop() {
      context.clearRect(0, 0, canvas.width, canvas.height);

      stars.forEach(star => {
        star.a += .012;
        context.fillStyle = `rgba(244,241,232,${.16 + Math.sin(star.a) * .12})`;
        context.beginPath();
        context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        context.fill();
      });

      frame = requestAnimationFrame(loop);
    }

    fit();
    addEventListener("resize", fit, { passive: true });

    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      paintStatic();
    } else {
      loop();
    }

    addEventListener("beforeunload", () => {
      if (frame) cancelAnimationFrame(frame);
    });
  }

  function setupTabs() {
    const panels = new Set($$(".tabPanel").map(panel => panel.id));
    const mobileMore = $("[data-mobile-more]");
    const mobileMoreSummary = mobileMore?.querySelector("summary");

    function closeMobileMore() {
      if (mobileMore?.open) {
        mobileMore.open = false;
      }
    }

    function keepActiveNavInView(id, behavior) {
      const activeTab = $$(".tab").find(tab => tab.dataset.tab === id);
      const activeMobileTab = $$("[data-mobile-tab]").find(link => link.dataset.mobileTab === id);
      const options = {
        behavior: behavior || scrollBehavior(),
        block: "nearest",
        inline: "center"
      };

      activeTab?.scrollIntoView(options);
      activeMobileTab?.scrollIntoView(options);
    }

    function requestedTab() {
      const queryTab = new URLSearchParams(location.search).get("tab");
      const hashTab = location.hash.replace(/^#/, "");
      return [queryTab, hashTab].find(id => panels.has(id)) || "todayPanel";
    }

    function activateTab(id, options = {}) {
      if (!panels.has(id)) id = "todayPanel";
      const { updateHistory = false, scroll = false } = options;

      $$(".tab").forEach(tab => {
        const active = tab.dataset.tab === id;
        tab.classList.toggle("active", active);
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-selected", String(active));
        tab.setAttribute("tabindex", active ? "0" : "-1");
      });

      $$(".tabPanel").forEach(panel => {
        const active = panel.id === id;
        panel.classList.toggle("active", active);
        panel.hidden = !active;
        panel.setAttribute("role", "tabpanel");
      });

      $$("[data-mobile-tab]").forEach(link => {
        const active = link.dataset.mobileTab === id;
        link.classList.toggle("active", active);
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });

      if (mobileMore) {
        const moreHasActiveChild = !!mobileMore.querySelector(
          `[data-mobile-tab="${id}"]`
        );

        mobileMore.classList.toggle(
          "has-active-child",
          moreHasActiveChild
        );
      }

      keepActiveNavInView(id, updateHistory || scroll ? scrollBehavior() : "auto");
      closeMobileMore();

      safeSet("sof_moons_last_tab_v1", id);
      if (updateHistory) {
        const url = new URL(location.href);
        url.searchParams.set("tab", id);
        url.hash = "";
        history.pushState({ moonsTab: id }, "", url);
      }
      if (scroll) $("#" + id)?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    }

    $(".tabs")?.setAttribute("role", "tablist");
    $$(".tab").forEach(button => {
      button.addEventListener("click", () => {
        const id = button.dataset.tab;
        if (!id) return;
        activateTab(id, { updateHistory: true });
      });
    });

    document.addEventListener("sof:activate-tab", event => {
      activateTab(event.detail?.id, {
        updateHistory: event.detail?.updateHistory !== false,
        scroll: event.detail?.scroll !== false
      });
    });

    mobileMore?.addEventListener("toggle", () => {
      mobileMoreSummary?.setAttribute(
        "aria-expanded",
        String(mobileMore.open)
      );
    });

    document.addEventListener("click", event => {
      if (mobileMore?.open && !mobileMore.contains(event.target)) {
        closeMobileMore();
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && mobileMore?.open) {
        closeMobileMore();
        mobileMoreSummary?.focus();
      }
    });

    addEventListener("popstate", event => {
      activateTab(event.state?.moonsTab || requestedTab());
    });

    const initial = requestedTab();
    activateTab(initial);
    const initialUrl = new URL(location.href);
    initialUrl.searchParams.set("tab", initial);
    initialUrl.hash = "";
    history.replaceState({ moonsTab: initial }, "", initialUrl);
  }

  function setupBoundaryControls() {
    const boundary = params.get("boundary") || safeGet(BOUNDARY_KEY) || CONFIG.dayBoundary;
    const sunset = params.get("sunset") || safeGet(SUNSET_KEY) || CONFIG.fallbackSunset;

    setValue("boundaryMode", boundary);
    setValue("sunsetInput", sunset);

    on("boundaryMode", "change", event => {
      safeSet(BOUNDARY_KEY, event.target.value);

      if (event.target.value === "sunset") {
        refreshCalculatedSunset();
      }

      render();
    });

    on("sunsetInput", "change", event => {
      safeSet(SUNSET_KEY, event.target.value || CONFIG.fallbackSunset);
      render();
    });

    document.addEventListener("sof:request-sunset", event => {
      const latitude = Number(event.detail?.latitude);
      const longitude = Number(event.detail?.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        toast("Location could not be read.");
        return;
      }

      safeSet(LOCATION_KEY, JSON.stringify({
        latitude,
        longitude,
        savedAt: new Date().toISOString()
      }));

      const result = calculateSunset(selectedDate, latitude, longitude, selectedTZ);

      if (!result) {
        toast("Sunset is unavailable for this place and date.");
        return;
      }

      setValue("sunsetInput", result.time);
      safeSet(SUNSET_KEY, result.time);
      safeSet(BOUNDARY_KEY, "sunset");
      setValue("boundaryMode", "sunset");

      document.dispatchEvent(new CustomEvent("sof:sunset-calculated", {
        detail: {
          ...result,
          civilISO: toISO(selectedDate)
        }
      }));

      render();
    });
  }

  function setup() {
    // Mark the Today Calendar as loading immediately so users see a clean state
    // rather than a field of unexplained em dashes.
    const calCard = document.querySelector(".today-calendar-summary");
    if (calCard) {
      calCard.classList.add("is-loading");
      calCard.setAttribute("aria-live", "polite");
    }
    const live = document.getElementById("appStatusLive");
    if (live) live.textContent = "Loading calendar…";

    text("yr", new Date().getFullYear());

    const timezonePick = $("#tzPick");
    if (timezonePick) {
      timezonePick.innerHTML = TZONES
        .map(timezone => `<option value="${timezone}">${timezone}</option>`)
        .join("");
      timezonePick.value = selectedTZ;
    }

    setupTabs();
    setupBoundaryControls();
    refreshCalculatedSunset();

    setValue("datePick", toISO(selectedDate));

    function setSelectedDay(nextDate) {
      selectedDate = nextDate;
      refreshCalculatedSunset();
      render();
    }

    function shiftDay(amount) {
      setSelectedDay(addDays(selectedDate, amount));
    }

    on("tzPick", "change", event => {
      selectedTZ = event.target.value;
      safeSet(TZ_KEY, selectedTZ);
      refreshCalculatedSunset();
      render();
    });

    on("datePick", "change", event => {
      setSelectedDay(fromISO(event.target.value) || todayInTimeZone(selectedTZ));
    });

    on("btnToday", "click", () => {
      setSelectedDay(todayInTimeZone(selectedTZ));
    });

    on("prevDay", "click", () => {
      shiftDay(-1);
    });

    on("nextDay", "click", () => {
      shiftDay(1);
    });

    on("summaryToday", "click", () => {
      setSelectedDay(todayInTimeZone(selectedTZ));
    });

    on("summaryPrevDay", "click", () => {
      shiftDay(-1);
    });

    on("summaryNextDay", "click", () => {
      shiftDay(1);
    });

    $("#todaySummaryMoonGrid")?.addEventListener("click", event => {
      const origin = event.target;
      if (!(origin instanceof Element)) return;
      const target = origin.closest("[data-moon-day]");
      if (!target) return;

      const day = Number(target.dataset.moonDay);
      if (!Number.isInteger(day)) return;

      const context = lastContext || effectiveContext();
      if (!context.info.inside) return;

      shiftDay(day - context.info.dayInMoon);
    });

    on("shareLink", "click", () => {
      const url = new URL(location.href);
      url.searchParams.set("date", toISO(selectedDate));
      url.searchParams.set("tz", selectedTZ);
      url.searchParams.set("boundary", boundaryMode());
      url.searchParams.set("sunset", sunsetValue());

      if (navigator.clipboard) navigator.clipboard.writeText(url.toString());
      toast("Link copied");
    });

    [
      "sleepInput",
      "bodyInput",
      "dreamInput",
      "emotionInput",
      "signsInput",
      "fieldInput",
      "lessonInput"
    ].forEach(id => {
      on(id, "input", buildWitness);
    });

    on("shabbatInput", "change", buildWitness);

    on("kpInput", "change", () => {
      buildWitness();
      render();
    });

    on("buildWitness", "click", buildWitness);

    on("copyWitness", "click", () => {
      if (navigator.clipboard) navigator.clipboard.writeText(buildWitness());
      toast("Witness copied");
    });

    on("saveWitness", "click", saveLog);

    on("clearWitness", "click", () => {
      [
        "sleepInput",
        "bodyInput",
        "dreamInput",
        "emotionInput",
        "signsInput",
        "fieldInput",
        "lessonInput"
      ].forEach(id => setValue(id, ""));

      const kp = $("#kpInput");
      if (kp) kp.selectedIndex = 0;

      const shabbat = $("#shabbatInput");
      if (shabbat) shabbat.selectedIndex = 0;

      buildWitness();
      toast("Cleared");
    });

    on("copySeal", "click", () => {
      const seal = $("#sealBody");
      if (seal && navigator.clipboard) navigator.clipboard.writeText(seal.textContent);
      toast("Seal copied");
    });

    on("copyAllLogs", "click", () => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(
          logs().map(entry => entry.text).join("\n\n---\n\n")
        );
      }

      toast("All logs copied");
    });

    on("exportLogs", "click", () => {
      const blob = new Blob(
        [JSON.stringify(logs(), null, 2)],
        { type: "application/json" }
      );

      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(blob);
      anchor.download = "remnant-moon-logs.json";
      anchor.click();

      setTimeout(() => URL.revokeObjectURL(anchor.href), 800);
    });

    on("importLogs", "click", () => {
      const input = $("#importLogsFile");
      if (input) input.click();
    });

    on("importLogsFile", "change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const data = JSON.parse(await file.text());
        if (!Array.isArray(data)) throw new Error("Invalid log file");

        saveLogs(data.concat(logs()));
        render();
        toast("Logs imported");
      } catch {
        toast("Import failed");
      }

      event.target.value = "";
    });

    on("clearAllLogs", "click", () => {
      if (!confirm("Clear all saved moon logs from this browser?")) return;
      safeRemove(LOG_KEY);
      safeRemove(LEGACY_LOG_KEY);
      render();
      toast("Logs cleared");
    });

    render();
    setInterval(renderClockOnly, 1000);
    setInterval(() => {
      if (toISO(selectedDate) === toISO(todayInTimeZone(selectedTZ))) render();
    }, 30000);

    drawSky();

    window.ScrollOfFireMoons = {
      render,
      logs,
      remnantInfo: date => remnantInfo(date || effectiveContext().effectiveDate),
      shabbatInfo: date => shabbatInfo(date || effectiveContext().effectiveDate),
      selectedDate: () => new Date(selectedDate),
      selectedCivilDate: () => new Date(selectedDate),
      effectiveDate: () => new Date((lastContext || effectiveContext()).effectiveDate),
      selectedTimezone: () => selectedTZ,
      effectiveContext: () => ({ ...(lastContext || effectiveContext()) }),
      calculateSunset,
      detectPatterns
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
