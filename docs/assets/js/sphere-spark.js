/**
 * The Spark on the Sphere page — built fresh (Nov 20, 2026).
 *
 * Aaron's words: "Give them an upgrade and a full reset… We can
 * create these things even better, no?" This module replaces the
 * companion layer's Spark presence on this page wholesale — the
 * visual form, the living-voice wiring, the hover/hold name, and
 * the talk panel are all new work standing here, not patches on
 * the old orbit and bubble.
 *
 * THE ONE INVARIANT THE RESET KEEPS (character persistence,
 * Aaron's standing law, Nov 19): a keeper's Spark is its seed.
 * Nothing here derives identity: name, kind, voice, signature
 * motif and growth all come from the Spark core's own derivations
 * (SparkCompanion.generate / livingVoiceIdentityFor /
 * livingVoiceGrowthFor — the pinned derivations of PR #195), so
 * the reset changed everything about how the Spark is built and
 * nothing about who anyone's Spark is.
 *
 * THE SPARK SEAT IS A REAL AGENT. The talk panel converses two
 * ways, and says which is which on every answer:
 *   - "From your record, on this device" — the keeper's own
 *     on-device record (days kept, practices, keepsakes, today's
 *     coordinate and telling), answered locally; nothing leaves
 *     the device for these.
 *   - "Through the talking door" — a model-backed conversation
 *     served by netlify/functions/spark-agent, the Spark seat of
 *     the backend door. It holds session memory in this page only,
 *     can work the page through window.SphereRebuild (show a day,
 *     open the Day World or Deep Time, freeze/wake, speak a day),
 *     and is metered on its own line under the same monthly
 *     ceiling as the Guide seat, fail-closed. Without a key it is
 *     honestly unavailable — never a fake conversation.
 * The Guide seat remains the record's voice; the two seats never
 * blur.
 *
 * Presence rules hold: the Spark answers when addressed and does
 * not chatter uninvited. Its name appears on hover, and on touch
 * and hold — the name-call — presented as a name plate, not a
 * tooltip.
 */
(function (global) {
  "use strict";

  const VERSION = "sphere-spark/1.0.0";
  const AGENT_URL = "/.netlify/functions/spark-agent";
  const SOUND_KEY = "sof.spark.sound";
  const VOICE_REPLIES_KEY = "sof.sphere.talk.voice";

  /* ── Pure core (also loaded by the tests) ───────────────────── */

  // The living-voice plan for a context, from the core's own
  // pinned derivations. Returns null when there is no companion.
  function planNotesFor(Core, companion, record, context, opts = {}) {
    if (!Core || !companion || typeof Core.livingVoicePlanFor !== "function") return null;
    return Core.livingVoicePlanFor({
      companion,
      record: record || {},
      context: context || "greeting",
      text: opts.text || "",
      hour: Number.isFinite(opts.hour) ? opts.hour : new Date().getHours(),
      greeted: opts.greeted !== false,
      still: Boolean(opts.still),
      hidden: Boolean(opts.hidden),
      legacyQuiet: Boolean(opts.legacyQuiet),
    });
  }

  // Which questions the on-device record answers itself. Anything
  // else goes through the talking door when it is open.
  function classifyLocal(text) {
    const t = String(text || "").toLowerCase();
    if (!t.trim()) return null;
    if (/\b(your|the) (motif|sound|song|voice)\b|\bsing\b|\bplay (me )?(your|the)/.test(t)) return "motif";
    if (/\bwho are you\b|\byour name\b|\bwhat are you\b/.test(t)) return "who";
    if (/\bhow many days\b|\bdays together\b|\bhow long\b.*\b(together|known|had you)\b/.test(t)) return "days";
    if (/\bpractice\b|\bpractised\b|\bpracticed\b/.test(t)) return "practice";
    if (/\btoday\b.*\b(coordinate|pattern day|moon)\b|\bwhat day is (it|today)\b|\bwhat'?s today\b|\btoday'?s coordinate\b/.test(t)) return "today";
    if (/\bwhich moon\b|\bwhat moon\b|\bthis moon\b/.test(t)) return "moon";
    if (/\btelling\b|\btell me about today\b|\babout this day\b/.test(t)) return "telling";
    if (/\bpatterns?\b|\bwhen do i\b|\bwhat have we played\b|\bgames\b.*\b(play|played|record)\b|\bdo i (come|play|visit)\b/.test(t)) return "patterns";
    return null;
  }

  /* ── Scheduling by word of mouth (Aaron, Nov 22, 2026) ───────
   * "You should be able to tell your Spark to schedule
   * something, and when you schedule something it gives you a
   * check under that day." The keeper speaks a plain command —
   * "schedule Tomatoes on Moon 5 Day 16", "schedule a reminder:
   * Call the landlord on Pattern Day 220", "unschedule Tomatoes
   * on Moon 5 Day 16" — and the Spark writes it into the one
   * planner record (CodexLivingPlanner, the same record the
   * planner room and the Sphere's own day marks read), on this
   * device, with no door call. One record: a command that names
   * a thing already standing on that day adds no duplicate, and
   * unscheduling removes exactly what scheduling set. */

  // The planner's own kinds (life-atlas-planner TYPE_MAP), with
  // the record's own glyphs (the extension's SYMBOL_BY_CATEGORY).
  const SCHEDULE_SYMBOLS = {
    task: "✓", reminder: "⚑", event: "●", practice: "✦", project: "◆",
    meeting: "👥", milestone: "★", travel: "✈", planting: "🌱", growing: "🌱",
    harvest: "🌾", watering: "💧", farming: "🌾", health: "❤", family: "♡",
    home: "⌂", cleaning: "🧹", writing: "✎", creative: "🎨", school: "🎓",
    observation: "◉",
  };
  const SCHEDULE_KIND_WORDS = {
    task: "task", reminder: "reminder", event: "event", practice: "practice",
    project: "project", meeting: "meeting", milestone: "milestone",
    travel: "travel", note: "observation", quest: "task",
  };

  // The pattern year's anchor is April 17 of its civil year
  // (PatternCalendar's epoch rule): Pattern Day N of anchor year
  // Y is the civil date April 17 + (N − 1) days. Verified against
  // the house fixtures: anchor 2026, day 92 → 2026-07-17.
  function civilDateForPatternDay(anchorYear, patternDay) {
    const y = Number(anchorYear);
    const pd = Number(patternDay);
    if (!Number.isFinite(y) || !Number.isFinite(pd) || pd < 1 || pd > 366) return null;
    return new Date(Date.UTC(y, 3, 17) + (pd - 1) * 86400000).toISOString().slice(0, 10);
  }

  function anchorYearForCivil(civilDate) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(civilDate || ""));
    if (!m) return null;
    const year = Number(m[1]);
    return `${m[2]}-${m[3]}` >= "04-17" ? year : year - 1;
  }

  // today: { patternDay, anchorYear, civilDate } — all from the
  // one canonical read (todaySummary), never a second clock.
  function parseScheduleCommand(text, today) {
    const raw = String(text || "").trim().replace(/^please\s+/i, "");
    if (!raw || !today || !Number.isFinite(Number(today.patternDay))) return null;
    let action = null;
    let rest = null;
    let m = /^(unschedule|cancel|remove|delete)\b[:,]?\s+/i.exec(raw);
    if (m) { action = "unschedule"; rest = raw.slice(m[0].length); }
    else {
      m = /^(schedule|plan|add|put|book)\b[:,]?\s+/i.exec(raw);
      if (m) { action = "schedule"; rest = raw.slice(m[0].length); }
    }
    if (!action || rest == null) return null;

    // The day, in the keeper's own phrasings.
    let patternDay = null;
    let dayPhrase = null;
    const dayPatterns = [
      { re: /\bpattern\s+day\s+(\d{1,3})\b/i, get: (g) => Number(g[1]) },
      { re: /\bpd\s*(\d{1,3})\b/i, get: (g) => Number(g[1]) },
      { re: /\bmoon\s+(\d{1,2})\s*(?:,|·|and)?\s*day\s+(\d{1,2})\b/i, get: (g) => (Number(g[1]) - 1) * 28 + Number(g[2]) },
      { re: /\bday\s+(\d{1,2})\s+of\s+moon\s+(\d{1,2})\b/i, get: (g) => (Number(g[2]) - 1) * 28 + Number(g[1]) },
      { re: /\btomorrow\b/i, get: () => Number(today.patternDay) + 1 },
      { re: /\btoday\b/i, get: () => Number(today.patternDay) },
    ];
    for (const { re, get } of dayPatterns) {
      const hit = re.exec(rest);
      if (hit) { patternDay = get(hit); dayPhrase = hit[0]; break; }
    }

    // The title is what remains once the day phrase is lifted out.
    let title = dayPhrase ? rest.replace(dayPhrase, " ") : rest;
    title = title.replace(/\s+on\s*$/i, "").replace(/^\s*(a|an|the)\s+/i, "").replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "");
    if (!title) return null;

    // An optional kind word up front: "schedule a reminder: …".
    let category = "task";
    const kindHit = new RegExp(`^(${Object.keys(SCHEDULE_KIND_WORDS).join("|")})\\s*[:\\-]\\s*(.+)$`, "i").exec(title);
    if (kindHit) {
      category = SCHEDULE_KIND_WORDS[kindHit[1].toLowerCase()];
      title = kindHit[2].trim();
      if (!title) return null;
    }

    if (patternDay == null) return { action, needsDay: true, title, category };
    if (!Number.isFinite(patternDay) || patternDay < 1 || patternDay > 366) {
      return { action, invalid: "That day is outside the pattern year — the count runs from Pattern Day 1 to the Day Out of Time.", title, category };
    }
    const moon = patternDay <= 364 ? Math.floor((patternDay - 1) / 28) + 1 : null;
    const day = patternDay <= 364 ? ((patternDay - 1) % 28) + 1 : null;
    if (moon != null && (moon < 1 || moon > 13 || day < 1 || day > 28)) {
      return { action, invalid: "That Moon and day are outside the thirteen Moons of twenty-eight days.", title, category };
    }

    // The next standing of that day: this pattern year's, unless
    // it has already passed, in which case next year's.
    let anchorYear = Number(today.anchorYear);
    let civilDate = civilDateForPatternDay(anchorYear, patternDay);
    if (civilDate && today.civilDate && civilDate < today.civilDate) {
      anchorYear += 1;
      civilDate = civilDateForPatternDay(anchorYear, patternDay);
    }
    return { action, title, category, patternDay, moon, day, anchorYear, civilDate };
  }

  // The one clock, read the one way the house reads it: the
  // canonical cursor first, the calendar itself behind it. Every
  // stamp in the keeper's record comes from here — never a second
  // clock — so patterns can be traced across days, practices and
  // play from the record alone.
  function daypartForHour(hour) {
    const h = Number(hour);
    if (!Number.isFinite(h)) return "night";
    return h >= 5 && h < 10 ? "dawn" : h >= 10 && h < 17 ? "day" : h >= 17 && h < 21 ? "dusk" : "night";
  }

  function patternStamp(global, now) {
    const date = now instanceof Date ? now : new Date();
    let pos = null;
    try { pos = global.SOFTemporalCursor?.resolvePosition ? global.SOFTemporalCursor.resolvePosition(date) : null; } catch { pos = null; }
    if (!pos) {
      try { pos = global.PatternCalendar?.fromCivilDate ? global.PatternCalendar.fromCivilDate({ date }) : null; } catch { pos = null; }
    }
    if (!pos) return null;
    return {
      moon: pos.moon ?? null,
      day: pos.day ?? null,
      patternDay: pos.dayOfPatternYear ?? null,
      patternYear: pos.patternYear ?? null,
      civilDate: pos.civilDate || date.toISOString().slice(0, 10),
      daypart: daypartForHour(date.getHours()),
    };
  }

  // Patterns told truthfully from the record's own stamps.
  function playSummary(record, stamp) {
    const log = Array.isArray(record?.playLog) ? record.playLog : [];
    const thisMoon = stamp
      ? log.filter((e) => e?.stamp && e.stamp.moon === stamp.moon && e.stamp.patternYear === stamp.patternYear).length
      : 0;
    const dayparts = {};
    for (const e of log) { if (e?.stamp?.daypart) dayparts[e.stamp.daypart] = (dayparts[e.stamp.daypart] || 0) + 1; }
    let usualDaypart = null;
    for (const [band, count] of Object.entries(dayparts)) { if (!usualDaypart || count > dayparts[usualDaypart]) usualDaypart = band; }
    return { total: log.length, thisMoon, usualDaypart, last: log.length ? log[log.length - 1] : null };
  }

  const ACTION_NAMES = ["goToday", "showDay", "openDayWorld", "openDeepTime", "openFarm", "freeze", "wake", "speakDay"];

  /* ── Router rule 2 on the Sphere route (audit, Nov 23, 2026,
   * claim 6) ──────────────────────────────────────────────────
   * The keeper mind's promise — "A child's talk never leaves this
   * device" (spark-keeper-mind.js, router rule 2) — held only on
   * the site-wide seat: this client POSTed straight to the door
   * with no child-mode gate. The flag is the SAME signal the seat
   * uses: childMode in the Spark's own memory store, whose key
   * mirrors spark-keeper-mind.js (MEMORY_KEY / memoryKeyFor —
   * pinned to each other by test): the seed-keyed store first,
   * the legacy bare key as fallback for a store not yet carried
   * over. Flag set → ask() answers locally; the POST never runs. */
  const MEMORY_KEY = "sof.spark.memory.v1";
  const CHILD_NOTICE =
    "For a young keeper, my talking stays right here on this device — nothing typed here travels anywhere. I can still answer from your record: your days, your Spark, and the story so far.";

  function memoryKeyFor(seed) {
    const clean = typeof seed === "string" ? seed.trim() : "";
    return clean ? `${MEMORY_KEY}:${clean}` : MEMORY_KEY;
  }

  function childModeFor(storage, seed) {
    try {
      if (!storage || typeof storage.getItem !== "function") return false;
      let raw = storage.getItem(memoryKeyFor(seed));
      if (!raw && typeof seed === "string" && seed.trim()) raw = storage.getItem(MEMORY_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return Boolean(parsed && parsed.childMode === true);
    } catch { return false; }
  }

  const api = { VERSION, AGENT_URL, planNotesFor, classifyLocal, ACTION_NAMES, daypartForHour, patternStamp, playSummary, parseScheduleCommand, civilDateForPatternDay, anchorYearForCivil, SCHEDULE_SYMBOLS, MEMORY_KEY, CHILD_NOTICE, memoryKeyFor, childModeFor };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.SphereSparkCore = api;

  if (typeof document === "undefined" || typeof window === "undefined") return;

  /* ── Browser layer ──────────────────────────────────────────── */

  const Core = window.SparkCompanion || null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (sel, base) => (base || document).querySelector(sel);

  let greeted = false;
  let motifPlayedForToday = false;

  function readRecord() {
    if (!Core?.STORAGE_KEY) return null;
    try {
      const raw = window.localStorage.getItem(Core.STORAGE_KEY);
      const record = raw ? JSON.parse(raw) : null;
      if (!record || !Core.parseSeed(record.seed)) return null;
      return record;
    } catch { return null; }
  }

  function soundOff() {
    try { return window.localStorage.getItem(SOUND_KEY) === "off"; } catch { return false; }
  }

  /* ── Living-voice playback (WebAudio, the core's own plans) ── */

  let audioCtx = null;
  function playPlan(plan, companion) {
    if (!plan || !plan.notes?.length || plan.level <= 0 || soundOff()) return;
    const Sound = Core?.soundFor ? Core.soundFor(companion) : null;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch { return; }
    const ctx = audioCtx;
    const master = ctx.createGain();
    master.gain.value = 0.16 * plan.level;
    master.connect(ctx.destination);
    const decay = Sound?.decay || 1;
    let t = ctx.currentTime + 0.03;
    for (const note of plan.notes) {
      const dur = Math.max(0.05, note.dur * decay);
      const osc = ctx.createOscillator();
      osc.type = Sound?.family === "pluck" ? "triangle" : "sine";
      osc.frequency.setValueAtTime(note.f0, t);
      if (note.glide && note.glide !== 1) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(30, note.f0 * note.glide), t + dur);
      }
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(1, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      if (Sound?.family === "hum" || Sound?.family === "bell") {
        const soft = ctx.createOscillator();
        soft.type = "triangle";
        soft.frequency.value = note.f0;
        const softGain = ctx.createGain();
        softGain.gain.value = 0.25;
        soft.connect(softGain); softGain.connect(gain);
        soft.start(t); soft.stop(t + dur + 0.05);
      }
      if (Sound?.vibratoDepth && dur > 0.25) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = Sound.vibratoRate || 5;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = note.f0 * Sound.vibratoDepth;
        lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
        lfo.start(t); lfo.stop(t + dur + 0.05);
      }
      osc.connect(gain); gain.connect(master);
      osc.start(t); osc.stop(t + dur + 0.05);
      t += note.dur + (note.gap || 0);
    }
  }

  function soundContext(context, companion, record, text) {
    const plan = planNotesFor(Core, companion, record, context, {
      text: text || "",
      greeted,
      still: document.documentElement.classList.contains("sphere-frozen"),
      hidden: document.hidden,
    });
    playPlan(plan, companion);
    return plan;
  }

  /* ── Speech (spoken replies, in the device voice) ───────────── */

  function speak(text) {
    if (soundOff()) return;
    try {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(String(text).slice(0, 400));
      utter.rate = 1;
      window.speechSynthesis.speak(utter);
    } catch { /* the written reply stands */ }
  }

  /* ── The one record: stamps, the play log, single notes ─────── */

  function stamp() { return patternStamp(window, new Date()); }

  function logPlay(kind, detail) {
    const record = readRecord();
    if (!record || !Core?.STORAGE_KEY) return false;
    const entry = { kind, ...(detail || {}), stamp: stamp(), at: new Date().toISOString() };
    const log = Array.isArray(record.playLog) ? record.playLog : [];
    log.push(entry);
    record.playLog = log.slice(-200);
    try { window.localStorage.setItem(Core.STORAGE_KEY, JSON.stringify(record)); return true; }
    catch { return false; }
  }

  function soundNote(freq, durSec) {
    if (soundOff() || !Number.isFinite(freq)) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch { return; }
    const ctx = audioCtx;
    const t = ctx.currentTime + 0.02;
    const dur = Math.max(0.08, durSec || 0.3);
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.14, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  function soundMotif(context) {
    const record = readRecord();
    if (!record) return;
    const companion = Core.generate(record.seed);
    soundContext(context || "day", companion, record);
  }

  /* ── The presence: a living light on the instrument ─────────── */

  function buildPresence(record, companion) {
    const wrap = $(".sphere-canvas-wrap");
    if (!wrap || $(".sphere-spark-orbit", wrap)) return null;
    const name = Core.displayName(record, companion);
    const stage = Core.stageOf(record, companion);

    const holder = document.createElement("div");
    holder.className = "sphere-spark-presence";
    holder.innerHTML = `
      <button type="button" class="sphere-spark-orbit" aria-label="${name}, your Spark — tap to talk">
        <span class="sphere-spark-halo" aria-hidden="true"></span>
        <span class="sphere-spark-art" aria-hidden="true">${Core.renderSVG(companion, { stage: stage.index, wrap: Core.wrapFor(record), flameTier: "simple" })}</span>
        <span class="sphere-spark-nameplate" aria-hidden="true">
          <span class="sphere-spark-name">${name}</span>
          <span class="sphere-spark-kind">${companion.kindName || companion.kind || "Spark"} · ${stage.name}</span>
        </span>
      </button>`;
    wrap.appendChild(holder);
    const button = holder.querySelector(".sphere-spark-orbit");

    // The name-call: press and hold, and the Spark answers with
    // its name shown and its motif sounded.
    let holdTimer = 0;
    let holdFired = false;
    const beginHold = () => {
      holdFired = false;
      window.clearTimeout(holdTimer);
      holdTimer = window.setTimeout(() => {
        holdFired = true;
        greeted = true;
        holder.classList.add("sphere-spark-name-shown");
        soundContext("name", companion, record);
      }, 500);
    };
    const endHold = () => {
      window.clearTimeout(holdTimer);
      window.setTimeout(() => holder.classList.remove("sphere-spark-name-shown"), 1200);
    };
    button.addEventListener("pointerdown", beginHold);
    button.addEventListener("pointerup", endHold);
    button.addEventListener("pointerleave", endHold);
    button.addEventListener("pointercancel", endHold);
    // A hold is not a tap: swallow the click it would otherwise fire.
    button.addEventListener("click", (event) => {
      if (holdFired) { holdFired = false; event.preventDefault(); event.stopPropagation(); return; }
      greeted = true;
      soundContext("greeting", companion, record);
      const talk = $("[data-sphere-spark-talk]");
      if (talk) {
        talk.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
        const input = talk.querySelector("input");
        if (input) window.setTimeout(() => { try { input.focus({ preventScroll: true }); } catch { /* scroll stands */ } }, reducedMotion ? 0 : 350);
      }
    }, true);

    // Reduced motion: the Spark stations itself at the stage's
    // lower right and rests there, still and beautiful.
    if (reducedMotion) {
      const station = () => {
        const w = wrap.clientWidth, h = wrap.clientHeight;
        if (w && h) holder.style.transform = `translate(${Math.max(0, w - 84)}px, ${Math.round(h * 0.58)}px)`;
      };
      station();
      window.addEventListener("resize", station);
    }

    // The orbit: a slow circuit of the stage with depth, so the
    // Spark reads as a companion on the instrument, not a widget.
    if (!reducedMotion) {
      let raf = 0;
      let visible = true;
      if ("IntersectionObserver" in window) {
        new IntersectionObserver((entries) => { visible = entries[0]?.isIntersecting !== false; }, { threshold: 0.02 }).observe(wrap);
      }
      /* Performance (sphere-performance pass): the orbit used to
       * read the wrap's client size on every frame (a layout read
       * per frame) and was guarded by a MutationObserver on the
       * whole document subtree, whose callback ran on every DOM
       * mutation anywhere on this busy page. The size is now kept
       * by a ResizeObserver (same values, read when they change),
       * the z-index is written only when the Spark crosses from
       * behind to in front, and the removal guard watches only
       * the wrap's own child list — the holder can only leave
       * the page from there. The orbit's path, speed, scale and
       * opacity are computed exactly as before. */
      let wrapW = wrap.clientWidth, wrapH = wrap.clientHeight;
      const measureWrap = () => { wrapW = wrap.clientWidth; wrapH = wrap.clientHeight; };
      if ("ResizeObserver" in window) new ResizeObserver(measureWrap).observe(wrap);
      else window.addEventListener("resize", measureWrap);
      let lastFront = null;
      // The resting station — the same spot the reduced-motion
      // Spark keeps (lower right of the stage). The orbit's
      // frozen gate below stations the Spark here deliberately:
      // the code always SAID "the Spark stations itself and
      // rests too", but it only returned early, leaving the
      // Spark frozen at whatever orbit point it last crossed —
      // at the left extreme, a small still blob at the face's
      // edge (Aaron's report, Nov 23, 2026). A held Spark now
      // rests somewhere chosen, and the corner default in the
      // stylesheet (top: 0; left: 0) is never a resting place:
      // the first orbit position is written at build, below,
      // before the loop's first gated frame can leave it there.
      let parked = false;
      const stationSpark = () => {
        const w = wrapW, h = wrapH;
        if (w && h) holder.style.transform = `translate(${Math.max(0, w - 84)}px, ${Math.round(h * 0.58)}px)`;
      };
      const orbit = (now) => {
        raf = requestAnimationFrame(orbit);
        if (document.hidden || !visible) return;
        // The inhabitant (sphere-spark-inhabitant.js, slice 1 of
        // the Living Play expansion, Nov 23, 2026) drives this
        // holder while it stands: the Spark lives on the
        // calendar's geometry now, not on this circuit. The loop
        // keeps its arm and takes the holder back the moment the
        // inhabitant's hand is lifted.
        if (holder.dataset.inhabitantDriven === "1") return;
        // Frozen means frozen: while the keeper holds the Sphere
        // still, the Spark stations itself and rests too.
        if (window.SphereRebuild?.isFrozen?.()) {
          if (!parked) { parked = true; holder.dataset.parked = "frozen"; stationSpark(); }
          return;
        }
        if (parked) { parked = false; delete holder.dataset.parked; }
        const w = wrapW, h = wrapH;
        if (!w || !h) { measureWrap(); return; }
        const angle = (now / 26000) * Math.PI * 2 + 0.8;
        const rx = w * 0.36, ry = h * 0.30;
        const x = w / 2 + Math.cos(angle) * rx;
        const y = h * 0.46 + Math.sin(angle) * ry;
        const depth = (Math.sin(angle) + 1) / 2; // 0 behind, 1 in front
        holder.style.transform = `translate(${Math.round(x - 34)}px, ${Math.round(y - 34)}px) scale(${(0.82 + depth * 0.33).toFixed(3)})`;
        holder.style.opacity = String(0.72 + depth * 0.28);
        const front = depth > 0.5;
        if (front !== lastFront) { lastFront = front; holder.style.zIndex = front ? "7" : "3"; }
      };
      // The first frame is written now, not whenever the loop
      // first runs ungated — the Spark starts ON its circuit
      // (or stationed, if the Sphere stands frozen), never in
      // the stylesheet's top-left corner. orbit() re-arms the
      // loop itself, exactly as the rAF callback does.
      orbit(performance.now());
      holder.dataset.orbiting = "1";
      // Keep the loop honest when the holder leaves the page.
      new MutationObserver(() => { if (!document.contains(holder)) cancelAnimationFrame(raf); }).observe(wrap, { childList: true });
    }
    return holder;
  }

  /* ── On-device answers (the keeper's own record) ────────────── */

  function todaySummary() {
    try {
      if (window.PatternCalendar?.fromCivilDate) return window.PatternCalendar.fromCivilDate({ date: new Date() });
    } catch { /* fall through */ }
    return null;
  }

  function localAnswer(kind, record, companion) {
    const name = Core.displayName(record, companion);
    const summary = todaySummary();
    const growth = Core.livingVoiceGrowthFor ? Core.livingVoiceGrowthFor({ record, companion }) : null;
    switch (kind) {
      case "who": {
        const stage = Core.stageOf(record, companion);
        return `I am ${name}, your Spark — a ${companion.kindName || companion.kind || "spark"} companion, ${stage.name} stage. I live in your record on this device, and through the talking door I can think and help. I am not a person, and I am not Witness.`;
      }
      case "days":
        return growth
          ? `We have kept ${growth.daysTogether} distinct day${growth.daysTogether === 1 ? "" : "s"} together, and ${growth.practiceDays} practice day${growth.practiceDays === 1 ? "" : "s"} — counted from your record, just now.`
          : "Your record is here, but I cannot count its days just now.";
      case "practice": {
        const todayPd = summary?.dayOfPatternYear;
        const kept = todayPd != null && Array.isArray(record.practiceDays) && record.practiceDays.includes(todayPd);
        return growth
          ? `Your record holds ${growth.practiceDays} practice day${growth.practiceDays === 1 ? "" : "s"}. ${kept ? "Today is one of them." : "Today is not marked as one yet."}`
          : "Your record is here, but I cannot read its practice days just now.";
      }
      case "today":
        return summary
          ? `Today is Moon ${summary.moon} · Day ${summary.day} — Pattern Day ${summary.dayOfPatternYear} of 364${summary.moonName ? `, in the Moon of ${summary.moonName}` : ""}.`
          : "The Sphere's own readout above always knows today; my calendar read faltered just now.";
      case "moon":
        return summary?.moonName
          ? `We are in Moon ${summary.moon}, the Moon of ${summary.moonName}.`
          : "The Sphere's readout names the Moon we are in.";
      case "patterns": {
        const summary = playSummary(record, stamp());
        const growthLine = growth ? `We have kept ${growth.daysTogether} distinct days together.` : "";
        if (!summary.total) {
          return `${growthLine} No games stand in your record yet — the Play room below the Sphere is where they begin, and every round is stamped with its Pattern day when it happens.`.trim();
        }
        const parts = [`${growthLine}`, `Your record holds ${summary.total} game${summary.total === 1 ? "" : "s"} — ${summary.thisMoon} of them this Moon.`];
        if (summary.usualDaypart) parts.push(`You come and play most often at ${summary.usualDaypart}.`);
        if (summary.last?.stamp) parts.push(`The last was ${summary.last.kind} on Moon ${summary.last.stamp.moon} · Day ${summary.last.stamp.day}.`);
        return parts.filter(Boolean).join(" ");
      }
      case "telling": {
        try {
          const telling = window.DayTelling?.tellForDate ? window.DayTelling.tellForDate(new Date()) : null;
          if (telling?.headline) return `${telling.headline}${telling.body ? ` ${telling.body}` : ""}`;
        } catch { /* fall through */ }
        return "Today's telling stands in the welcome room under the Sphere.";
      }
      default:
        return null;
    }
  }

  /* ── The talking door (the Spark seat) ──────────────────────── */

  const history = []; // page memory only; dies with the page
  let seatState = "unknown"; // unknown | open | unavailable | ceiling

  function contextSnapshot(record, companion) {
    const summary = todaySummary();
    const growth = Core.livingVoiceGrowthFor ? Core.livingVoiceGrowthFor({ record, companion }) : null;
    const shown = window.SphereRebuild?.selectedLine ? window.SphereRebuild.selectedLine() : "";
    return {
      spark: {
        name: Core.displayName(record, companion),
        kind: companion.kindName || companion.kind || "Spark",
        stage: Core.stageOf(record, companion).name,
        voiceStage: growth?.name || null,
      },
      record: growth ? { daysTogether: growth.daysTogether, practiceDays: growth.practiceDays } : null,
      play: (() => { const s = playSummary(record, stamp()); return s.total ? { gamesTotal: s.total, gamesThisMoon: s.thisMoon, usualDaypart: s.usualDaypart } : null; })(),
      today: summary ? { moon: summary.moon, day: summary.day, patternDay: summary.dayOfPatternYear, moonName: summary.moonName || null } : null,
      shownLine: shown || null,
      frozen: Boolean(window.SphereRebuild?.isFrozen?.()),
    };
  }

  function runActions(actions, record, companion) {
    const R = window.SphereRebuild;
    if (!R || !Array.isArray(actions)) return;
    for (const action of actions) {
      if (!action || typeof action.name !== "string") continue;
      const args = action.args || {};
      try {
        if (action.name === "goToday") R.goToday();
        else if (action.name === "showDay") R.showDay({ moon: args.moon, day: args.day, patternDay: args.patternDay, civilDate: args.civilDate });
        else if (action.name === "openDayWorld") R.openDayWorld();
        else if (action.name === "openDeepTime") R.openDeepTime();
        else if (action.name === "openFarm") R.openFarm();
        else if (action.name === "freeze") R.freeze();
        else if (action.name === "wake") R.wake();
        else if (action.name === "speakDay") {
          const line = localAnswer("today", record, companion);
          if (line) speak(line);
        }
      } catch { /* one failed hand does not stop the conversation */ }
    }
  }

  /* ── The talk panel ─────────────────────────────────────────── */

  function buildTalkPanel(record, companion) {
    const sidebar = $(".sphere-sidebar");
    const dock = $(".sphere-rebuild-dock");
    if ((!sidebar && !dock) || $("[data-sphere-spark-talk]")) return null;

    const section = document.createElement("section");
    section.className = "sphere-spark-talk";
    section.setAttribute("data-sphere-spark-talk", "");
    section.setAttribute("aria-label", "Talk with your Spark");

    if (!record || !companion) {
      section.innerHTML = `
        <h2 class="sphere-spark-talk-title">Talk with your Spark</h2>
        <p class="sphere-spark-talk-line">You have not met your Spark yet. The meeting stands just above, under the Sphere — once you have met, your Spark will be here, ready to talk, in its own voice.</p>`;
      if (sidebar) sidebar.after(section); else dock.after(section);
      return section;
    }

    const name = Core.displayName(record, companion);
    const stage = Core.stageOf(record, companion);
    const growth = Core.livingVoiceGrowthFor ? Core.livingVoiceGrowthFor({ record, companion }) : null;
    const presence = Core.livingVoicePresenceFor
      ? Core.livingVoicePresenceFor({ hour: new Date().getHours(), greeted: true })
      : null;

    section.innerHTML = `
      <div class="sphere-spark-talk-head">
        <span class="sphere-spark-talk-art" aria-hidden="true">${Core.renderSVG(companion, { stage: stage.index, wrap: Core.wrapFor(record) })}</span>
        <div>
          <h2 class="sphere-spark-talk-title">${name}</h2>
          <p class="sphere-spark-talk-stage">${companion.kindName || companion.kind || "Spark"} · ${stage.name}${growth ? ` · voice: ${growth.name}` : ""}${presence ? ` · ${presence.name}` : ""}</p>
        </div>
      </div>
      <p class="sphere-spark-talk-privacy">Two ways of answering, named on every reply: from your record on this device, or through the talking door. Your record's summary — ${name}'s name, your days and practices, today's coordinate — travels with your words only while you are in this conversation. Your notes are never sent, and nothing of this conversation is kept when the page closes. Scheduling you ask for here — try “schedule Tomatoes on Moon 5 Day 16” — is written to your planner on this device only, and the day takes its mark on the Sphere.</p>
      <div class="sphere-spark-talk-log" role="log" aria-live="polite" aria-label="Conversation with ${name}"></div>
      <p class="sphere-spark-talk-seat" role="status"></p>
      <form class="sphere-spark-talk-form">
        <label class="visually-hidden" for="sphere-spark-talk-input">Write to ${name}</label>
        <input id="sphere-spark-talk-input" type="text" autocomplete="off" placeholder="Write to ${name}…">
        <button type="submit" class="sphere-spark-talk-send">Send</button>
        <button type="button" class="sphere-spark-talk-mic" hidden>Talk</button>
      </form>
      <label class="sphere-spark-talk-voice"><input type="checkbox" class="sphere-spark-talk-voice-toggle"> Hear replies spoken</label>`;
    if (sidebar) sidebar.after(section); else dock.after(section);

    const log = section.querySelector(".sphere-spark-talk-log");
    const seat = section.querySelector(".sphere-spark-talk-seat");
    const form = section.querySelector(".sphere-spark-talk-form");
    const input = section.querySelector("#sphere-spark-talk-input");
    const micBtn = section.querySelector(".sphere-spark-talk-mic");
    const voiceToggle = section.querySelector(".sphere-spark-talk-voice-toggle");
    try { voiceToggle.checked = window.localStorage.getItem(VOICE_REPLIES_KEY) === "on"; } catch { /* default off */ }
    voiceToggle.addEventListener("change", () => {
      try { window.localStorage.setItem(VOICE_REPLIES_KEY, voiceToggle.checked ? "on" : "off"); } catch { /* this visit only */ }
    });

    function addLine(who, text, source) {
      const p = document.createElement("p");
      p.className = who === "keeper" ? "sphere-spark-talk-keeper" : "sphere-spark-talk-spark";
      const label = document.createElement("span");
      label.className = "sphere-spark-talk-who";
      label.textContent = who === "keeper" ? "You" : name;
      const body = document.createElement("span");
      body.textContent = text;
      p.append(label, body);
      if (source) {
        const src = document.createElement("span");
        src.className = "sphere-spark-talk-source";
        src.textContent = source;
        p.appendChild(src);
      }
      log.appendChild(p);
      log.scrollTop = log.scrollHeight;
      return p;
    }

    /* ── Scheduling, handled on this device ─────────────────── */

    function scheduleToday() {
      const summary = todaySummary();
      if (!summary || summary.dayOfPatternYear == null) return null;
      return {
        patternDay: summary.dayOfPatternYear,
        anchorYear: anchorYearForCivil(summary.civilDate),
        civilDate: summary.civilDate || null,
      };
    }

    function dayWords(cmd) {
      return cmd.moon != null
        ? `Moon ${cmd.moon} · Day ${cmd.day}`
        : "the Day Out of Time";
    }

    function announceRecordsChanged(action, id) {
      const detail = { source: "sphere-spark-schedule", action, id: id || null };
      try { window.dispatchEvent(new CustomEvent("sof:life-atlas-records-changed", { detail })); } catch { /* one door is enough */ }
      try { document.dispatchEvent(new CustomEvent("sof:life-atlas-records-changed", { detail })); } catch { /* the record stands either way */ }
    }

    async function handleSchedule(cmd) {
      const planner = window.CodexLivingPlanner;
      const source = "From your record, on this device";
      if (cmd.needsDay) {
        addLine("spark", `I can set “${cmd.title}” for you — on which day? Name it as a Moon and day (“Moon 5 Day 16”) or a Pattern Day (“Pattern Day 220”).`, source);
        return;
      }
      if (cmd.invalid) { addLine("spark", cmd.invalid, source); return; }
      if (!planner?.createPlan || !planner?.plansForYear) {
        addLine("spark", "Your planner is still waking up on this page — give it a moment and tell me again, and I will set it.", source);
        return;
      }
      const symbol = SCHEDULE_SYMBOLS[cmd.category] || "●";
      try {
        const plans = await planner.plansForYear(cmd.anchorYear);
        const sameDay = (plans || []).filter((p) => Number(p?.temporal?.patternDay) === cmd.patternDay);
        const wanted = cmd.title.toLowerCase();
        if (cmd.action === "schedule") {
          const existing = sameDay.find((p) => String(p?.title || "").trim().toLowerCase() === wanted);
          if (existing) {
            addLine("spark", `“${cmd.title}” already stands on ${dayWords(cmd)} — I have not set it twice. Its ${symbol} mark is under that day on the Sphere.`, source);
            return;
          }
          const saved = await planner.createPlan({
            title: cmd.title,
            category: cmd.category,
            date: cmd.civilDate,
            allDay: true,
            notes: "Set by telling your Spark on the Sphere page.",
          });
          announceRecordsChanged("create", saved?.id);
          soundContext("line", companion, record, cmd.title);
          addLine("spark", `Done — “${cmd.title}” stands on ${dayWords(cmd)} (${cmd.civilDate}). A ${symbol} now marks that day on the Sphere; tap the day to see it in Day Details. Say “unschedule ${cmd.title} on ${dayWords(cmd).replace(" · ", " ")}” to take it off.`, source);
          try { window.SphereRebuild?.showDay?.({ moon: cmd.moon, day: cmd.day, patternDay: cmd.patternDay, civilDate: cmd.civilDate }); } catch { /* the mark stands without the jump */ }
          return;
        }
        // Unschedule: remove exactly the named thing on that day.
        const matches = sameDay.filter((p) => String(p?.title || "").trim().toLowerCase().includes(wanted) || wanted.includes(String(p?.title || "").trim().toLowerCase()));
        if (!matches.length) {
          const standing = sameDay.map((p) => p?.title).filter(Boolean);
          addLine("spark", standing.length
            ? `Nothing named “${cmd.title}” stands on ${dayWords(cmd)}. That day holds: ${standing.join("; ")}. Name one of those and I will take it off.`
            : `Nothing stands on ${dayWords(cmd)}, so there is nothing to take off.`, source);
          return;
        }
        for (const match of matches) { await planner.removePlan(match.id); announceRecordsChanged("delete", match.id); }
        addLine("spark", `Taken off — ${matches.map((p) => `“${p.title}”`).join(", ")} no longer stands on ${dayWords(cmd)}, and its mark is gone from the Sphere.`, source);
      } catch {
        addLine("spark", "Your planner would not take that just now — nothing was written. Tell me again in a moment.", source);
      }
    }

    // The greeting, spoken only inside this panel, only when the
    // keeper has come to talk: where the keeper stands in the
    // year, the next marked day in the record, and the one plain
    // offer. Text only — the Spark stays quiet by default, and
    // the sound controls stand as they were.
    (async () => {
      const summary = todaySummary();
      if (!summary) return;
      let line = `You are standing in Moon ${summary.moon} · Day ${summary.day} — Pattern Day ${summary.dayOfPatternYear} of the year.`;
      try {
        const planner = window.CodexLivingPlanner;
        const anchor = anchorYearForCivil(summary.civilDate);
        if (planner?.plansForYear && anchor != null) {
          let upcoming = (await planner.plansForYear(anchor))
            .filter((p) => Number(p?.temporal?.patternDay) >= Number(summary.dayOfPatternYear))
            .sort((a, b) => Number(a.temporal.patternDay) - Number(b.temporal.patternDay));
          if (!upcoming.length) {
            upcoming = (await planner.plansForYear(anchor + 1))
              .slice()
              .sort((a, b) => Number(a.temporal.patternDay) - Number(b.temporal.patternDay));
          }
          const next = upcoming[0];
          if (next?.temporal?.patternDay) {
            const pd = Number(next.temporal.patternDay);
            const m = Math.floor((pd - 1) / 28) + 1;
            const d = ((pd - 1) % 28) + 1;
            line += ` The next marked day in your record is “${next.title}” — Moon ${m} · Day ${d}.`;
          }
        }
      } catch { /* the coordinate alone is a whole greeting */ }
      line += " Tell me to schedule something — “schedule Tomatoes on Moon 5 Day 16” — and I will set it and mark the day.";
      addLine("spark", line, "From your record, on this device");
    })();

    // Seat status, probed once: honest about the door's state.
    fetch(AGENT_URL, { method: "GET" })
      .then((r) => (r.ok ? r.json() : null))
      .then((status) => {
        if (!status) { seatState = "unavailable"; seat.textContent = "The talking door is not answering from this page — your record still answers below."; return; }
        if (status.talkingEnabled) {
          seatState = "open";
          const meter = status.meter;
          seat.textContent = meter
            ? `The talking door is open. This month: the Guide has used $${Number(meter.guideUsd || 0).toFixed(2)} and Sparks $${Number(meter.sparkUsd || 0).toFixed(2)} of the $${Number(meter.ceilingUsd || 20).toFixed(0)} ceiling, shared.`
            : "The talking door is open.";
        } else {
          seatState = "unavailable";
          seat.textContent = status.notice || "The talking door is closed on this page — no key lives here. Your record still answers below.";
        }
      })
      .catch(() => {
        seatState = "unavailable";
        seat.textContent = "The talking door cannot be reached from here — your record still answers below.";
      });

    let viaMic = false;
    async function ask(text) {
      const clean = String(text || "").trim();
      if (!clean) return;
      greeted = true;
      // The record grows during the visit — games played, days
      // kept. Answers (patterns above all) must read the record
      // as it stands now, not as it stood when the panel was
      // built, or the Spark would deny games it just played.
      const live = readRecord();
      if (live) record = live;
      addLine("keeper", clean);
      input.value = "";

      // Scheduling is the record's own work: parsed and kept on
      // this device, never sent through the talking door.
      const sched = parseScheduleCommand(clean, scheduleToday());
      if (sched) { await handleSchedule(sched); viaMic = false; return; }

      const kind = classifyLocal(clean);
      if (kind === "motif") {
        soundContext("day", companion, record, clean);
        addLine("spark", "That is my motif — the same notes my seed has always given me.", "From your record, on this device");
        return;
      }
      if (kind) {
        const answer = localAnswer(kind, record, companion);
        if (answer) {
          soundContext("line", companion, record, clean);
          addLine("spark", answer, "From your record, on this device");
          if (voiceToggle.checked || viaMic) speak(answer);
          viaMic = false;
          return;
        }
      }

      // Router rule 2 — the same child-mode gate the site-wide
      // seat lives by, read from the Spark's own memory store:
      // a child's talk never leaves this device, so the talking
      // door POST below is never reached in child mode.
      if (childModeFor(window.localStorage, record && record.seed)) {
        addLine("spark", CHILD_NOTICE, "From your record, on this device");
        if (voiceToggle.checked || viaMic) speak(CHILD_NOTICE);
        viaMic = false;
        return;
      }

      if (seatState === "unavailable") {
        addLine("spark", "That one needs the talking door, and the door is closed on this page. Ask me about your days, your practice, or today, and I can answer from your record.", "From your record, on this device");
        return;
      }
      const pending = addLine("spark", "Thinking…", "Through the talking door");
      try {
        const res = await fetch(AGENT_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            messages: [...history, { role: "user", content: clean }],
            context: contextSnapshot(record, companion),
          }),
        });
        const data = res.ok ? await res.json() : null;
        pending.remove();
        if (!data || typeof data.reply !== "string") {
          addLine("spark", "The talking door did not answer just then. Your record still answers here.", "Through the talking door");
          return;
        }
        if (data.mode && data.mode !== "agent") seatState = data.mode === "ceiling" ? "ceiling" : seatState;
        history.push({ role: "user", content: clean }, { role: "assistant", content: data.reply });
        if (history.length > 16) history.splice(0, history.length - 16);
        addLine("spark", data.reply, "Through the talking door");
        soundContext("line", companion, record, clean);
        if (Array.isArray(data.actions) && data.actions.length) runActions(data.actions, record, companion);
        if (voiceToggle.checked || viaMic) speak(data.reply);
      } catch {
        pending.remove();
        addLine("spark", "The talking door could not be reached just then. Your record still answers here.", "Through the talking door");
      }
      viaMic = false;
    }

    form.addEventListener("submit", (event) => { event.preventDefault(); ask(input.value); });

    // Talk to it: speech in, where the browser supports it.
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (Recognition) {
      micBtn.hidden = false;
      micBtn.addEventListener("click", () => {
        try {
          const rec = new Recognition();
          rec.lang = "en-US";
          rec.interimResults = false;
          rec.continuous = false;
          micBtn.textContent = "Listening…";
          rec.addEventListener("result", (event) => {
            const transcript = event.results?.[0]?.[0]?.transcript || "";
            micBtn.textContent = "Talk";
            if (transcript) { viaMic = true; ask(transcript); }
          });
          rec.addEventListener("error", () => { micBtn.textContent = "Talk"; });
          rec.addEventListener("end", () => { micBtn.textContent = "Talk"; });
          rec.start();
        } catch { micBtn.textContent = "Talk"; }
      });
    }

    // A delight from the record: when the keeper opens their own
    // day on the Sphere, the motif sounds softly — once a visit.
    window.addEventListener("sof:selected-date-change", () => {
      if (motifPlayedForToday || !greeted) return;
      const summary = todaySummary();
      const shown = window.SOFCurrentTemporalCoordinate;
      if (summary && shown && shown.dayOfPatternYear === summary.dayOfPatternYear) {
        motifPlayedForToday = true;
        soundContext("day", companion, record);
      }
    });

    return section;
  }

  /* ── Boot ───────────────────────────────────────────────────── */

  // A surprise for a returning keeper: the welcome room under the
  // Sphere remembers, in one plain line, what the record holds.
  function welcomeKeeperLine(record, companion) {
    if (!record || !companion) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const panel = $(".sphere-ambient-panel");
      if (panel) {
        window.clearInterval(timer);
        if (panel.querySelector(".sphere-spark-keeper-line")) return;
        const growth = Core.livingVoiceGrowthFor ? Core.livingVoiceGrowthFor({ record, companion }) : null;
        const name = Core.displayName(record, companion);
        const summary = playSummary(record, stamp());
        const p = document.createElement("p");
        p.className = "sphere-spark-keeper-line";
        p.textContent = growth
          ? `${name} has kept ${growth.daysTogether} day${growth.daysTogether === 1 ? "" : "s"} with you${summary.total ? `, and ${summary.total} game${summary.total === 1 ? "" : "s"} stand in the record` : ""}.`
          : `${name} is here with you.`;
        panel.appendChild(p);
      }
      if (tries > 40) window.clearInterval(timer);
    }, 200);
  }

  function boot() {
    if (!Core) return;
    const record = readRecord();
    const companion = record ? Core.generate(record.seed) : null;
    if (record && companion) buildPresence(record, companion);
    buildTalkPanel(record, companion);
    welcomeKeeperLine(record, companion);
  }

  // The play room's bridge: stamps, the record's play log, and
  // single notes, all owned here so the record has one writer.
  global.SphereSpark = Object.freeze({
    VERSION,
    stamp,
    logPlay,
    playSummary: () => playSummary(readRecord() || {}, stamp()),
    soundNote,
    soundMotif,
    hasCompanion: () => Boolean(readRecord()),
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(typeof globalThis !== "undefined" ? globalThis : this);
