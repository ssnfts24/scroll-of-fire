/* Scroll of Fire — Shared Daily-State Module
   File: docs/assets/js/codex-state.js
   Phase: 1 — Living Day

   Derives the current living day state from window.SOFCalendar (calendar-cor.js).
   Does NOT duplicate date/lunar logic — all calculations delegate to SOFCalendar.

   Sets:   window.CodexState (merged object)
   Event:  "codexstatechange" on document
   Cache:  localStorage key "sof.codexState.v1" (non-sensitive fields only)
   Classes: body.codex-moon-XX, body.theme-moon-X (compatible with themes.moons.css)
*/

(function () {
  "use strict";

  var STORAGE_KEY = "sof.codexState.v1";
  var EVENT_NAME = "codexstatechange";

  /* ------------------------------------------------------------------ */
  /* Static mapping data                                                  */
  /* These mirror the arrays in moons.js but are kept here so            */
  /* codex-state.js works independently of the 13 Moons app bundle.      */
  /* ------------------------------------------------------------------ */

  var WEEK_GATES = [
    ["Week 1 · Ignition", "Begin, gather signal, establish the first witness."],
    ["Week 2 · Formation", "Shape the pattern through body, speech, and daily structure."],
    ["Week 3 · Testing", "Watch pressure, resistance, correction, and refinement."],
    ["Week 4 · Sealing", "Harvest the lesson, close loops, and prepare the next moon."]
  ];

  /* 28 archetypes, one per day within the moon (index = day - 1) */
  var DAY_ARCHETYPES = [
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

  /* Suggested Codex page per moon (index = moon number - 1) */
  var MOON_PATHS = [
    { label: "Open 13 Moons", url: "./moons.html" },                     // 1 Seed Flame
    { label: "Open Witness Ledger", url: "./ledger.html" },               // 2 Root Waters
    { label: "Read Theory", url: "./theory.html" },                       // 3 Breath Gate
    { label: "Open Witness Ledger", url: "./ledger.html" },               // 4 Stone Witness
    { label: "Open Invoke", url: "./invoke.html" },                       // 5 Living Word
    { label: "Open Witness System", url: "./systems/witness.html" },      // 6 Fire Trial
    { label: "Open Systems Hub", url: "./hub.html" },                     // 7 Crown Balance
    { label: "Open Genesis Oracle", url: "./genesis-oracle.html" },       // 8 Deep Mirror
    { label: "Open Witness Ledger", url: "./ledger.html" },               // 9 Return Path
    { label: "Open Mind Renewal", url: "./systems/mind-renewal.html" },   // 10 Builder's Hand
    { label: "Read Theory", url: "./theory.html" },                       // 11 Star Remembrance
    { label: "Open Frequencies", url: "./systems/frequencies.html" },     // 12 River of Signs
    { label: "Open Witness Ledger", url: "./ledger.html" }                // 13 Completion Seal
  ];

  /* Shabbat day overrides for suggested path */
  var SHABBAT_PATHS = {
    preparation: { label: "Open Witness Ledger", url: "./ledger.html" },
    active:      { label: "Read Theory",         url: "./theory.html" },
    return:      { label: "Open Witness Ledger", url: "./ledger.html" }
  };

  /* Suggested Frequency Governance preset per moon (index = moon number - 1) */
  /* Presets correspond to existing sequences in frequency-governance.js        */
  var MOON_FREQS = [
    "Remnant Path · 144 Hz",   // 1  Seed Flame
    "Calm Path · 432 Hz",      // 2  Root Waters
    "Focus Path · 369 Hz",     // 3  Breath Gate
    "Restore Path · 174 Hz",   // 4  Stone Witness
    "Create Path · 528 Hz",    // 5  Living Word
    "Lift Loop · 417 Hz",      // 6  Fire Trial
    "T7 Field · 963 Hz",       // 7  Crown Balance
    "Dream Gate · 396 Hz",     // 8  Deep Mirror
    "Restore Path · 285 Hz",   // 9  Return Path
    "Focus Path · 741 Hz",     // 10 Builder's Hand
    "Remnant Path · 852 Hz",   // 11 Star Remembrance
    "Calm Path · 639 Hz",      // 12 River of Signs
    "Remnant Path · 111 Hz"    // 13 Completion Seal
  ];

  /* ------------------------------------------------------------------ */
  /* Helpers                                                              */
  /* ------------------------------------------------------------------ */

  function safeRead(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function safeWrite(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (_) { return false; }
  }

  /* Shabbat state derived from weekday of the effective date.           */
  /* Mirrors the logic in moons.js shabbatInfo() without importing it.  */
  function computeShabbatState(date) {
    var weekday = (date instanceof Date ? date : new Date()).getDay();
    if (weekday === 5) return { code: "preparation", label: "Preparation Gate" };
    if (weekday === 6) return { code: "active",      label: "Shabbat · Rest" };
    if (weekday === 0) return { code: "return",      label: "Return Gate" };
    return { code: "ordinary", label: "Ordinary Day" };
  }

  /* ------------------------------------------------------------------ */
  /* Core state computation — delegates all calendar maths to SOFCalendar */
  /* ------------------------------------------------------------------ */

  function computeState() {
    var cal = window.SOFCalendar;
    if (!cal || typeof cal.get13Moon !== "function") return null;

    var now = new Date();
    var tz  = cal.getTZ();
    var iso = cal.todayISO(tz);

    var moonData = cal.get13Moon(iso, tz);
    var phase    = (typeof cal.getMoonPhase === "function") ? cal.getMoonPhase(iso) : null;
    var shabbat  = computeShabbatState(now);

    var inside     = moonData && !moonData.isDayOutOfTime;
    var moonNumber = inside ? moonData.moon : null;
    var moonName   = moonData ? moonData.moonName  : "Outside Count";
    var moonEssence= moonData ? moonData.moonEssence : "";
    var moonDay    = inside ? moonData.day  : null;
    var yearDay    = inside ? moonData.dayIndex + 1 : null;
    var weekNumber = moonDay ? Math.floor((moonDay - 1) / 7) + 1 : null;
    var weekGate   = weekNumber ? WEEK_GATES[weekNumber - 1][0] : "";
    var weekGateDesc = weekNumber ? WEEK_GATES[weekNumber - 1][1] : "";

    /* Daily movement — deterministic: same moon-day always → same text */
    var archetype      = moonDay ? DAY_ARCHETYPES[moonDay - 1] : null;
    var movementCategory = archetype ? archetype[0] : "";
    var dailyMovement  = archetype
      ? archetype[1]
      : "Notice what is moving, breathe once with attention, and record one clear line.";

    /* Suggested Codex destination */
    var suggestedPath;
    if (shabbat.code !== "ordinary" && SHABBAT_PATHS[shabbat.code]) {
      suggestedPath = SHABBAT_PATHS[shabbat.code];
    } else if (moonNumber) {
      suggestedPath = MOON_PATHS[moonNumber - 1];
    } else {
      suggestedPath = { label: "Open 13 Moons", url: "./moons.html" };
    }

    /* Suggested frequency preset (text only — deep-link not yet supported) */
    var suggestedFrequency = moonNumber ? MOON_FREQS[moonNumber - 1] : "";

    /* Sunset / boundary status — read from SOFCalendar config             */
    var fallbackSunset = (cal.CONFIG && cal.CONFIG.fallbackSunset) || "18:00";
    var boundaryMode   = (cal.CONFIG && cal.CONFIG.dayBoundary)    || "sunset";

    return {
      version:           1,
      generatedAt:       now.toISOString(),
      timezone:          tz,
      boundaryMode:      boundaryMode,
      isoDate:           iso,
      moonNumber:        moonNumber,
      moonName:          moonName,
      moonEssence:       moonEssence,
      moonDay:           moonDay,
      yearDay:           yearDay,
      weekNumber:        weekNumber,
      weekGate:          weekGate,
      weekGateDesc:      weekGateDesc,
      phaseName:         phase ? phase.name          : "",
      phaseIllumination: phase ? phase.illumination  : null,
      sunsetTime:        fallbackSunset,
      boundaryStatus:    boundaryMode === "sunset" ? "Sunset boundary active" : "Midnight boundary",
      shabbatState:      shabbat.code,
      shabbatLabel:      shabbat.label,
      dailyMovement:     dailyMovement,
      movementCategory:  movementCategory,
      suggestedPath:     suggestedPath.label,
      suggestedPathUrl:  suggestedPath.url,
      suggestedFrequency: suggestedFrequency
    };
  }

  /* ------------------------------------------------------------------ */
  /* Body class management                                                */
  /* ------------------------------------------------------------------ */

  function applyBodyClasses(state) {
    /* Remove stale moon classes */
    Array.from(document.body.classList).forEach(function (c) {
      if (/^codex-moon-\d+$/.test(c) || /^theme-moon-\d+$/.test(c)) {
        document.body.classList.remove(c);
      }
    });

    if (state.moonNumber) {
      var padded = String(state.moonNumber).padStart(2, "0");
      /* codex-moon-01..13  — used by living-day.css and Phase 2 site-wide bar */
      document.body.classList.add("codex-moon-" + padded);
      /* theme-moon-1..13   — activates existing atmosphere in themes.moons.css */
      document.body.classList.add("theme-moon-" + state.moonNumber);
    }

    document.body.dataset.shabbatState = state.shabbatState;
    if (state.moonDay) {
      document.body.dataset.moonDay = state.moonDay;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Publish and cache                                                    */
  /* ------------------------------------------------------------------ */

  function publishState(state) {
    /* Merge into any state object already set by living-codex.js         */
    window.CodexState = Object.assign(window.CodexState || {}, state);
    document.dispatchEvent(
      new CustomEvent(EVENT_NAME, { detail: window.CodexState, bubbles: false })
    );
  }

  function cacheState(state) {
    /* Cache only non-sensitive, non-personally-identifying fields */
    var safe = {
      version:    state.version,
      isoDate:    state.isoDate,
      moonNumber: state.moonNumber,
      moonName:   state.moonName,
      moonDay:    state.moonDay,
      yearDay:    state.yearDay,
      weekGate:   state.weekGate,
      phaseName:  state.phaseName,
      shabbatState: state.shabbatState
    };
    safeWrite(STORAGE_KEY, JSON.stringify(safe));
  }

  /* ------------------------------------------------------------------ */
  /* Initialise                                                           */
  /* ------------------------------------------------------------------ */

  function setup() {
    var state = computeState();
    if (!state) return;
    applyBodyClasses(state);
    publishState(state);
    cacheState(state);
  }

  /* Run once immediately; SOFCalendar is loaded synchronously before this
     script because calendar-cor.js precedes codex-state.js in HTML.     */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }

  /* Re-emit when living-codex.js emits sof:codex-state (after async
     moon-catalog fetch), so the codexstatechange event stays fresh.     */
  document.addEventListener("sof:codex-state", function () {
    var state = computeState();
    if (!state) return;
    applyBodyClasses(state);
    publishState(state);
  });

  /* Expose minimal public API for tests and Phase 2 */
  window.CodexStateModule = {
    computeState:      computeState,
    applyBodyClasses:  applyBodyClasses,
    WEEK_GATES:        WEEK_GATES,
    DAY_ARCHETYPES:    DAY_ARCHETYPES
  };
})();
