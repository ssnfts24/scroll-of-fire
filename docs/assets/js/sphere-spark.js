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
      <p class="sphere-spark-talk-privacy">Replies are named as they come: from your record on this device, or through the talking door. Your notes are never sent, and this conversation is not kept when the page closes. Scheduling is proposed first and written only on your yes. Try “Call the hall Thursday at 10am”, “what's on Friday”, “make me a schedule”, or “show me Moon 9”.</p>
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

    /* ── Scheduling, handled on this device ───────────────────
     * Upgraded Nov 24, 2026, under Aaron's rulings of the day:
     * the Spark parses with the pure core (spark-schedule-core),
     * shows the keeper a PROPOSAL, and writes only on the
     * keeper's yes — through the one planner path, verified
     * before it says done. Voice and typing are one road: a
     * proposal made to a keeper who came by voice is read aloud,
     * and a spoken "yes — set it" settles it like the card's
     * button. Pure view commands ("show me…") execute at once:
     * they change nothing stored, and the keeper can grab the
     * Sphere back at any moment. In child mode none of the
     * scheduling family runs at all. Design:
     * spark-scheduling-design-2026-11-24.md. */

    function scheduleToday() {
      const summary = todaySummary();
      if (!summary || summary.dayOfPatternYear == null) return null;
      return {
        patternDay: summary.dayOfPatternYear,
        anchorYear: anchorYearForCivil(summary.civilDate),
        civilDate: summary.civilDate || null,
      };
    }

    function announceRecordsChanged(action, id) {
      const detail = { source: "sphere-spark-schedule", action, id: id || null };
      try { window.dispatchEvent(new CustomEvent("sof:life-atlas-records-changed", { detail })); } catch { /* one door is enough */ }
      try { document.dispatchEvent(new CustomEvent("sof:life-atlas-records-changed", { detail })); } catch { /* the record stands either way */ }
    }

    const Sched = () => window.SparkScheduleCore || null;
    const SCHED_SOURCE = "From your record, on this device";
    const CHILD_SCHEDULE_LINE =
      "For a young keeper, schedules stay with the grown keepers — I do not set, move, or read out the planner here. Ask me about your days, your Spark, and the story so far.";

    function schedCtx() {
      const t = scheduleToday();
      if (!t || !t.civilDate) return null;
      return { todayCivil: t.civilDate, todayPatternDay: t.patternDay, todayAnchorYear: t.anchorYear };
    }
    function stampOf(cmd) {
      return {
        civilDate: cmd.civilDate, patternDay: cmd.patternDay, anchorYear: cmd.anchorYear,
        patternYear: cmd.anchorYear, moon: cmd.moon, day: cmd.day,
        outsideDay: cmd.patternDay > 364,
      };
    }
    // The legacy parser's answer, in the core's shape — used only
    // if the core failed to load, so the road never dead-ends.
    function legacyIntent(cmd) {
      if (!cmd) return null;
      if (cmd.invalid) return { kind: "invalid", message: cmd.invalid };
      if (cmd.needsDay) return { kind: "schedule", needsDay: true, title: cmd.title, category: cmd.category };
      if (cmd.action === "schedule") return { kind: "schedule", title: cmd.title, category: cmd.category, stamp: stampOf(cmd), time: null, partOfDay: null };
      if (cmd.action === "unschedule") return { kind: "unschedule", title: cmd.title, stamp: stampOf(cmd) };
      return null;
    }
    function parseIntent(text) {
      const ctx = schedCtx();
      if (!ctx) return null;
      const core = Sched();
      if (core) return core.parseScheduleRequest(text, ctx) || core.parseShowCommand(text, ctx);
      return legacyIntent(parseScheduleCommand(text, scheduleToday()));
    }

    function reply(text) {
      const line = addLine("spark", text, SCHED_SOURCE);
      if (voiceToggle.checked || viaMic) speak(text);
      return line;
    }
    function plannerReady() {
      const planner = window.CodexLivingPlanner;
      return planner && planner.createPlan && planner.allPlans ? planner : null;
    }
    async function readTimeline() {
      const core = Sched();
      const planner = plannerReady();
      if (!core || !planner) return null;
      const plans = await planner.allPlans();
      return core.buildTimeline(plans || [], schedCtx().todayCivil);
    }
    function matchTitle(entries, wanted) {
      const w = String(wanted || "").trim().toLowerCase();
      if (!w) return [];
      return entries.filter((e) => {
        const t = String(e.title || "").trim().toLowerCase();
        return t === w || t.includes(w) || w.includes(t);
      });
    }

    /* ── Proposals: nothing is written before the keeper's yes ── */

    let pendingProposal = null;
    function settleProposal(yes) {
      const pending = pendingProposal;
      if (!pending) return false;
      pendingProposal = null;
      pending.settle(yes);
      return true;
    }
    // opts: { heading, body, confirmLabel, items?: [{label, sub}],
    //         chips?: { label, options: [{label, value}], selected,
    //                  onPick(value) },
    //         onConfirm(keptItems|null, chipValue), onCancel? }
    // Chips are the ease pass's one-tap answers inside a card:
    // they adjust the proposal (a time, a day) and never settle
    // it — the yes below stays the only road to a write.
    function propose(opts) {
      if (pendingProposal) settleProposal(false);
      const card = document.createElement("div");
      card.className = "sphere-spark-proposal";
      const head = document.createElement("p");
      head.className = "sphere-spark-proposal-head";
      head.textContent = opts.heading;
      card.appendChild(head);
      if (opts.body) {
        const body = document.createElement("p");
        body.className = "sphere-spark-proposal-body";
        body.textContent = opts.body;
        card.appendChild(body);
      }
      let chipValue = opts.chips ? opts.chips.selected : undefined;
      if (opts.chips && Array.isArray(opts.chips.options) && opts.chips.options.length) {
        const chipRow = document.createElement("div");
        chipRow.className = "sphere-spark-proposal-chips";
        chipRow.setAttribute("role", "group");
        chipRow.setAttribute("aria-label", opts.chips.label || "Choose");
        const chipBtns = [];
        for (const opt of opts.chips.options) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "sphere-spark-proposal-chip";
          b.textContent = opt.label;
          const isSel = opt.value === chipValue;
          b.classList.toggle("is-selected", isSel);
          b.setAttribute("aria-pressed", String(isSel));
          b.addEventListener("click", () => {
            chipValue = opt.value;
            for (const x of chipBtns) {
              const on = x === b;
              x.classList.toggle("is-selected", on);
              x.setAttribute("aria-pressed", String(on));
            }
            if (opts.chips.onPick) opts.chips.onPick(opt.value);
          });
          chipBtns.push(b);
          chipRow.appendChild(b);
        }
        card.appendChild(chipRow);
      }
      const kept = (opts.items || []).map(() => true);
      if (opts.items && opts.items.length) {
        const list = document.createElement("ul");
        list.className = "sphere-spark-proposal-items";
        opts.items.forEach((item, i) => {
          const li = document.createElement("li");
          const label = document.createElement("span");
          label.textContent = item.label;
          li.appendChild(label);
          if (item.sub) {
            const sub = document.createElement("small");
            sub.textContent = item.sub;
            li.appendChild(sub);
          }
          const drop = document.createElement("button");
          drop.type = "button";
          drop.className = "sphere-spark-proposal-drop";
          drop.textContent = "✕";
          drop.setAttribute("aria-label", `Strike “${item.label}” from the proposal`);
          drop.addEventListener("click", () => {
            kept[i] = !kept[i];
            li.classList.toggle("is-struck", !kept[i]);
            drop.setAttribute("aria-pressed", String(!kept[i]));
          });
          li.appendChild(drop);
          list.appendChild(li);
        });
        card.appendChild(list);
      }
      const row = document.createElement("div");
      row.className = "sphere-spark-proposal-row";
      const yesBtn = document.createElement("button");
      yesBtn.type = "button";
      yesBtn.className = "sphere-spark-proposal-yes";
      yesBtn.textContent = opts.confirmLabel || "Set it";
      const noBtn = document.createElement("button");
      noBtn.type = "button";
      noBtn.className = "sphere-spark-proposal-no";
      noBtn.textContent = "Not now";
      row.append(yesBtn, noBtn);
      card.appendChild(row);
      log.appendChild(card);
      log.scrollTop = log.scrollHeight;

      let settled = false;
      const settle = (yes) => {
        if (settled) return;
        settled = true;
        if (pendingProposal && pendingProposal.settle === settle) pendingProposal = null;
        yesBtn.disabled = true;
        noBtn.disabled = true;
        card.classList.add("is-settled");
        card.classList.add(yes ? "is-kept" : "is-passed");
        if (yes) {
          const keptItems = opts.items ? opts.items.filter((_, i) => kept[i]) : null;
          Promise.resolve(opts.onConfirm(keptItems, chipValue)).catch(() => {
            reply("Your planner would not take that just now — nothing was written. Tell me again in a moment.");
          });
        } else if (opts.onCancel) opts.onCancel();
        else reply("Left unset, then — nothing was written. It stands ready whenever you name it again.");
      };
      pendingProposal = { settle };
      yesBtn.addEventListener("click", () => settle(true));
      noBtn.addEventListener("click", () => settle(false));
      if (voiceToggle.checked || viaMic) {
        speak(`${opts.heading} ${opts.body || ""}`.trim());
      }
      return card;
    }
    function addActionLine(text, buttonLabel, fn) {
      const line = addLine("spark", text, SCHED_SOURCE);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sphere-spark-undo";
      btn.textContent = buttonLabel;
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try { await fn(); } catch { reply("That would not go back just now — the record stands as it is."); }
      });
      line.appendChild(btn);
      log.scrollTop = log.scrollHeight;
      return line;
    }
    // One-tap answers under a Spark line (the ease pass): the
    // common next steps as buttons, so the keeper taps instead
    // of composing a sentence. A chip only ever asks or adjusts
    // — anything that writes still goes through a proposal.
    // once: the row spends itself on the first tap (a day choice
    // for one named thing); without it the row stays live (the
    // greeting's standing offers).
    function addChips(lineEl, chips, once) {
      const row = document.createElement("span");
      row.className = "sphere-spark-chips";
      for (const chip of chips) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sphere-spark-chip";
        btn.textContent = chip.label;
        btn.addEventListener("click", () => {
          if (once) row.querySelectorAll("button").forEach((b) => { b.disabled = true; });
          chip.onPick();
        });
        row.appendChild(btn);
      }
      lineEl.appendChild(row);
      log.scrollTop = log.scrollHeight;
      return row;
    }

    /* ── The writes, each behind a proposal, each verified ───── */

    async function writeSchedule(intent) {
      const planner = plannerReady();
      const symbol = SCHEDULE_SYMBOLS[intent.category] || "●";
      const saved = await planner.createPlan({
        title: intent.title,
        category: intent.category,
        date: intent.stamp.civilDate,
        time: intent.time || undefined,
        allDay: !intent.time,
        notes: intent.partOfDay
          ? `Set by telling your Spark on the Sphere page — in the ${intent.partOfDay}, no clock time set.`
          : "Set by telling your Spark on the Sphere page.",
      });
      const standing = saved && planner.getPlan ? await planner.getPlan(saved.id) : null;
      if (!standing) throw new Error("the write did not stand");
      announceRecordsChanged("create", saved.id);
      soundContext("line", companion, record, intent.title);
      reply(`Done — “${intent.title}” stands on ${Sched().restateDay(intent.stamp)}${intent.time ? ` at ${Sched().timeWords(intent.time)}` : ""}. Its ${symbol} beacon now stands on that day on the Sphere; tap the day to see it in Day Details.`);
      try { window.SphereRebuild?.showDay?.({ moon: intent.stamp.moon, day: intent.stamp.day, patternDay: intent.stamp.patternDay, civilDate: intent.stamp.civilDate }); } catch { /* the mark stands without the jump */ }
    }

    async function proposeSchedule(intent) {
      const core = Sched();
      if (intent.needsDay) {
        // The ease pass: the day is one tap away, not a second
        // sentence in the grammar. Typing a day still works.
        const line = reply(`I can set “${intent.title}” — which day? Tap one, or name any day.`);
        const ctx = schedCtx();
        if (ctx) {
          const dayChip = (label, date) => ({
            label,
            onPick: () => proposeSchedule({
              kind: "schedule", title: intent.title, category: intent.category,
              stamp: core.stampForCivil(date), time: null, partOfDay: null,
            }),
          });
          addChips(line, [
            dayChip("Today", ctx.todayCivil),
            dayChip("Tomorrow", core.addDays(ctx.todayCivil, 1)),
            dayChip(core.civilWords(core.addDays(ctx.todayCivil, 2)).split(",")[0], core.addDays(ctx.todayCivil, 2)),
          ], true);
        }
        return;
      }
      const planner = plannerReady();
      if (!planner) { reply("Your planner is still waking up on this page — give it a moment and tell me again, and I will set it."); return; }
      const timeline = await readTimeline();
      const dupe = timeline && timeline.find((e) => e.civilDate === intent.stamp.civilDate
        && e.state !== "done"
        && String(e.title).trim().toLowerCase() === intent.title.toLowerCase());
      if (dupe) {
        reply(`“${intent.title}” already stands on ${core.dayWords(intent.stamp)} — I have not set it twice. Its beacon is on that day on the Sphere.`);
        return;
      }
      // The card's heading carries the whole restatement, so the
      // keeper reads one line, not two. The time is adjustable
      // by chip before the yes — the chips tune this proposal's
      // own intent, a part of day named in words stays words
      // until the keeper taps a clock time, and the yes remains
      // the only road to the write.
      const headText = () => `“${intent.title}” — ${core.restateDay(intent.stamp)}${intent.time ? ` at ${core.timeWords(intent.time)}` : ""}${intent.partOfDay ? `, in the ${intent.partOfDay}` : ""}`;
      const slotOptions = [
        { label: "Morning 8", value: core.SLOT_TIMES.morning },
        { label: "Midday 12", value: core.SLOT_TIMES.midday },
        { label: "Afternoon 3", value: core.SLOT_TIMES.afternoon },
        { label: "Evening 7", value: core.SLOT_TIMES.evening },
      ].filter((o) => o.value !== intent.time);
      const options = [
        ...(intent.time ? [{ label: core.timeWords(intent.time), value: intent.time }] : []),
        ...slotOptions,
        { label: "All day", value: "allday" },
      ];
      let cardEl = null;
      cardEl = propose({
        heading: headText(),
        body: "Nothing is written until you say yes.",
        confirmLabel: "Set it",
        chips: {
          label: "Time of day",
          options,
          selected: intent.time || null,
          onPick: (value) => {
            if (value === "allday") { intent.time = null; intent.partOfDay = null; }
            else { intent.time = value; intent.partOfDay = null; }
            const head = cardEl && cardEl.querySelector(".sphere-spark-proposal-head");
            if (head) head.textContent = headText();
          },
        },
        onConfirm: () => writeSchedule(intent),
      });
    }

    async function proposeUnschedule(intent) {
      const core = Sched();
      const timeline = await readTimeline();
      if (!timeline) { reply("Your planner is still waking up on this page — give it a moment and tell me again."); return; }
      let matches = matchTitle(timeline, intent.title);
      if (intent.stamp) matches = matches.filter((e) => e.civilDate === intent.stamp.civilDate);
      matches = matches.filter((e) => e.state !== "done");
      if (!matches.length) {
        const standing = intent.stamp
          ? timeline.filter((e) => e.civilDate === intent.stamp.civilDate).map((e) => e.title)
          : [];
        reply(standing.length
          ? `Nothing named “${intent.title}” stands on ${core.dayWords(intent.stamp)}. That day holds: ${standing.join("; ")}. Name one of those and I will propose taking it off.`
          : `Nothing named “${intent.title}” stands in your record, so there is nothing to take off.`);
        return;
      }
      const planner = plannerReady();
      propose({
        heading: matches.length === 1 ? `Take off “${matches[0].title}”?` : "Take these off?",
        body: matches.map((e) => `“${e.title}” — ${core.restateDay(e.stamp)}`).join("; ") + ". It can be put back with Undo.",
        confirmLabel: "Take it off",
        onConfirm: async () => {
          const removedShapes = [];
          for (const match of matches) {
            const full = planner.getPlan ? await planner.getPlan(match.id) : null;
            const line = core.planLine(full) || match;
            removedShapes.push({
              title: line.title, category: line.category, date: line.civilDate,
              time: line.time, allDay: line.allDay,
            });
            await planner.removePlan(match.id);
            announceRecordsChanged("delete", match.id);
          }
          addActionLine(
            `Taken off — ${matches.map((e) => `“${e.title}”`).join(", ")} no longer stands, and its beacon is gone from the Sphere. `,
            "Undo — put it back",
            async () => {
              for (const shape of removedShapes) {
                const back = await planner.createPlan({
                  title: shape.title, category: shape.category, date: shape.date,
                  time: shape.time || undefined, allDay: shape.allDay,
                  notes: "Put back by your Spark, at your word.",
                });
                announceRecordsChanged("create", back && back.id);
              }
              reply("Put back — it stands in your record again, beacon and all.");
            });
        },
      });
    }

    async function proposeComplete(intent) {
      const core = Sched();
      const timeline = await readTimeline();
      if (!timeline) { reply("Your planner is still waking up on this page — give it a moment and tell me again."); return; }
      const matches = matchTitle(timeline, intent.title).filter((e) => e.state !== "done");
      if (!matches.length) { reply(`Nothing named “${intent.title}” stands unfinished in your record.`); return; }
      const match = matches[0];
      const planner = plannerReady();
      propose({
        heading: `Mark “${match.title}” done?`,
        body: `${core.restateDay(match.stamp)} — done counts as a witnessed touch of its day.`,
        confirmLabel: "Mark done",
        onConfirm: async () => {
          await planner.completePlan(match.id);
          const after = planner.getPlan ? await planner.getPlan(match.id) : null;
          const done = after && window.CodexLifeAtlasScheduling?.isCompleted
            ? window.CodexLifeAtlasScheduling.isCompleted(after) : Boolean(after);
          if (!done) throw new Error("completion did not stand");
          announceRecordsChanged("update", match.id);
          try {
            const parts = match.civilDate.split("-").map(Number);
            window.CodexMemory?.recordWitness?.({
              date: new Date(parts[0], parts[1] - 1, parts[2]),
              label: `Completed: ${match.title}`,
            });
          } catch { /* the completion stands without the witness write */ }
          soundContext("day", companion, record, match.title);
          reply(`Done — “${match.title}” is complete, its beacon folds to a check on ${core.dayWords(match.stamp)}, and the day stands witnessed.`);
        },
      });
    }

    async function proposeMove(intent) {
      const core = Sched();
      const timeline = await readTimeline();
      if (!timeline) { reply("Your planner is still waking up on this page — give it a moment and tell me again."); return; }
      const matches = matchTitle(timeline, intent.title).filter((e) => e.state !== "done");
      if (!matches.length) { reply(`Nothing named “${intent.title}” stands in your record to move.`); return; }
      const match = matches[0];
      const planner = plannerReady();
      propose({
        heading: `Move “${match.title}”?`,
        body: `From ${core.restateDay(match.stamp)} to ${core.restateDay(intent.stamp)}.`,
        confirmLabel: "Move it",
        onConfirm: async () => {
          await planner.updatePlan(match.id, { date: intent.stamp.civilDate });
          const after = planner.getPlan ? await planner.getPlan(match.id) : null;
          const line = after ? core.planLine(after) : null;
          if (!line || line.civilDate !== intent.stamp.civilDate) throw new Error("the move did not stand");
          announceRecordsChanged("update", match.id);
          reply(`Moved — “${match.title}” now stands on ${core.restateDay(intent.stamp)}, and its beacon moved with it.`);
          try { window.SphereRebuild?.showDay?.({ moon: intent.stamp.moon, day: intent.stamp.day, patternDay: intent.stamp.patternDay, civilDate: intent.stamp.civilDate }); } catch { /* the move stands without the jump */ }
        },
      });
    }

    /* ── Asking: answers computed from the timeline ──────────── */

    const KEYWORD_SIGNALS = {
      garden: /garden|water|plant|harvest|bed|soil|seed|sow/i,
      family: /family|meal|together|dinner|supper/i,
      quiet: /quiet|read|still|witness|prayer/i,
      "deep work": /work|write|build|study|make|forge/i,
      rest: /rest|sleep|fallow/i,
    };

    async function answerAsk(intent) {
      const core = Sched();
      const timeline = await readTimeline();
      if (!timeline) { reply("Your planner is still waking up on this page — give it a moment and ask me again."); return; }
      const entryLine = (e) => `“${e.title}”${e.time ? ` at ${core.timeWords(e.time)}` : ""}${e.state === "overdue" ? " (overdue)" : e.state === "done" ? " (done)" : ""}`;
      if (intent.ask === "day") {
        const entries = timeline.filter((e) => e.civilDate === intent.stamp.civilDate);
        if (!entries.length) {
          let line = `Nothing stands on ${core.restateDay(intent.stamp)} — the day is open.`;
          const weekdayCounts = {};
          for (const e of timeline) {
            const wd = core.weekdayOf(e.civilDate);
            if (wd != null) weekdayCounts[wd] = (weekdayCounts[wd] || 0) + 1;
          }
          const askedWd = core.weekdayOf(intent.stamp.civilDate);
          if (askedWd != null && (weekdayCounts[askedWd] || 0) >= 2) {
            line += ` You often set things on ${core.civilWords(intent.stamp.civilDate).split(",")[0]}s — tell me what belongs here and I will propose it.`;
          }
          reply(line);
          return;
        }
        reply(`On ${core.restateDay(intent.stamp)}: ${entries.map(entryLine).join("; ")}.`);
        return;
      }
      if (intent.ask === "next") {
        const next = timeline.find((e) => e.state === "today" || e.state === "upcoming");
        reply(next
          ? `Next standing in your record: ${entryLine(next)} — ${core.restateDay(next.stamp)}.`
          : "Nothing stands ahead in your record — the days in front of you are unwritten.");
        return;
      }
      if (intent.ask === "overdue") {
        const overdue = timeline.filter((e) => e.state === "overdue");
        reply(overdue.length
          ? `Overdue, waiting on you: ${overdue.slice(0, 4).map((e) => `${entryLine(e)} — ${core.restateDay(e.stamp)}`).join("; ")}${overdue.length > 4 ? `; and ${overdue.length - 4} more` : ""}. Say “mark … done” or “move … to Friday” and I will propose it.`
          : "Nothing is overdue — every standing thing is today or ahead of you.");
        return;
      }
      // The week ahead.
      const ctx = schedCtx();
      const week = timeline.filter((e) => e.civilDate >= ctx.todayCivil && e.civilDate <= core.addDays(ctx.todayCivil, 6));
      if (!week.length) { reply("The week ahead is open — nothing stands in it yet. Say “make me a schedule” and I will compose one from your record."); return; }
      const byDay = new Map();
      for (const e of week) {
        if (!byDay.has(e.civilDate)) byDay.set(e.civilDate, []);
        byDay.get(e.civilDate).push(e);
      }
      const parts = [...byDay.entries()].map(([date, entries]) =>
        `${core.restateDay(entries[0].stamp)}: ${entries.map(entryLine).join("; ")}`);
      reply(`Your week: ${parts.join(" · ")}`);
    }

    /* ── Generative scheduling: proposals in full ────────────── */

    async function proposeGenerated(intent) {
      const core = Sched();
      const planner = plannerReady();
      if (!planner) { reply("Your planner is still waking up on this page — give it a moment and ask me again."); return; }
      const plans = await planner.allPlans();
      const timeline = core.buildTimeline(plans || [], schedCtx().todayCivil);
      const titles = [...new Set(timeline.filter((e) => e.state !== "done").map((e) => e.title))].slice(-10);
      const play = playSummary(record, stamp());
      const keywordKnown = intent.keyword
        ? timeline.some((e) => KEYWORD_SIGNALS[intent.keyword] && KEYWORD_SIGNALS[intent.keyword].test(`${e.title} ${e.category}`))
        : undefined;
      const gen = core.generateSchedule({
        titles,
        planCount: timeline.length,
        practiceDays: Array.isArray(record.practiceDays) ? record.practiceDays.length : 0,
        usualDaypart: play.usualDaypart || null,
        keywordKnown,
      }, {
        mode: intent.mode, keyword: intent.keyword, stamp: intent.stamp,
        rng: core.rngFrom(`${intent.stamp.civilDate}:${titles.length}:${timeline.length}`),
      });
      if (!gen.items.length) { reply("I could not compose a plan from what stands — tell me one thing the day should hold and I will build around it."); return; }
      propose({
        heading: gen.starter
          ? `A starter plan for ${core.restateDay(intent.stamp)} — your record is young here; every piece says where it came from and why:`
          : `A plan for ${core.restateDay(intent.stamp)} — every piece says where it came from:`,
        items: gen.items.map((item) => ({
          label: `${core.timeWords(item.time)} — ${item.title}`,
          sub: `${item.sourceLine}${item.why ? ` · ${item.why}` : ""}`,
          item,
        })),
        confirmLabel: "Set the whole plan",
        onConfirm: async (keptItems) => {
          const kept = (keptItems || []).map((row) => row.item).filter(Boolean);
          if (!kept.length) { reply("Every piece was struck — nothing was written. Tell me what the day should hold instead."); return; }
          let landed = 0;
          for (const item of kept) {
            const saved = await planner.createPlan({
              title: item.title,
              category: item.source === "record" ? "task" : "practice",
              date: intent.stamp.civilDate,
              time: item.time,
              allDay: false,
              notes: `Proposed by your Spark and set on your yes (${item.sourceLine}). ${item.why || ""}`.trim(),
            });
            if (saved && saved.id) { landed += 1; announceRecordsChanged("create", saved.id); }
          }
          soundContext("line", companion, record, intent.stamp.civilDate);
          reply(landed === kept.length
            ? `Set — ${landed} piece${landed === 1 ? "" : "s"} stand on ${core.restateDay(intent.stamp)}, each with its beacon. Strike any of them by name whenever you like.`
            : `Partly set — ${landed} of ${kept.length} pieces stand on ${core.restateDay(intent.stamp)}. The rest would not write just now; ask me again for those.`);
          try { window.SphereRebuild?.showDay?.({ moon: intent.stamp.moon, day: intent.stamp.day, patternDay: intent.stamp.patternDay, civilDate: intent.stamp.civilDate }); } catch { /* the plan stands without the jump */ }
        },
      });
    }

    /* ── View commands: the Spark's hands on the Sphere ────────
     * Pure view commands execute at once — they change nothing
     * stored — through the Sphere's public projection surface
     * only (SphereSparkControl, the companion layer's control;
     * the SphereRebuild action set behind it). Every trip is
     * announced, and the keeper can grab the Sphere back at any
     * moment with their own hand. */

    async function runShowCommand(cmd) {
      const core = Sched();
      const C = window.SphereSparkControl || null;
      const R = window.SphereRebuild || null;
      const goDay = (stamp) => {
        if (C && C.goCivil) C.goCivil(stamp.civilDate);
        else if (R && R.showDay) R.showDay({ moon: stamp.moon, day: stamp.day, patternDay: stamp.patternDay, civilDate: stamp.civilDate });
      };
      switch (cmd.action) {
        case "invalid": reply(cmd.message); return;
        case "today": {
          if (C && C.goToday) C.goToday(); else if (R && R.goToday) R.goToday();
          const t = stamp();
          reply(`Taking you to today — Moon ${t.moon} · Day ${t.day}, Pattern Day ${t.patternDay}.`);
          return;
        }
        case "day": {
          goDay(cmd.stamp);
          reply(`Taking you to ${core.restateDay(cmd.stamp)}.`);
          if (cmd.open && R && R.openDayWorld) window.setTimeout(() => { try { R.openDayWorld(); } catch { /* the day stands selected */ } }, 450);
          return;
        }
        case "moon": {
          if (C && C.goMoon) C.goMoon(cmd.moon);
          else goDay(core.stampForCivil(core.civilDateForPatternDay(schedCtx().todayAnchorYear, (cmd.moon - 1) * 28 + 1)));
          reply(`Taking you to Moon ${cmd.moon} of this year.`);
          return;
        }
        case "year": {
          if (C && C.goYear) C.goYear();
          reply("The whole year, then — every Moon in one view.");
          return;
        }
        case "openDay": if (R && R.openDayWorld) R.openDayWorld(); reply("Opening the day that stands selected."); return;
        case "openFarm": if (R && R.openFarm) R.openFarm(); reply("Opening the farm."); return;
        case "openDeepTime": if (R && R.openDeepTime) R.openDeepTime(); reply("Opening deep time."); return;
        case "freeze": if (R && R.freeze) R.freeze(); reply("Holding the Sphere still. Say “wake” when you want it moving again."); return;
        case "wake": if (R && R.wake) R.wake(); reply("The Sphere moves again."); return;
        case "nextScheduled": {
          const timeline = await readTimeline();
          const next = timeline && timeline.find((e) => e.state === "today" || e.state === "upcoming");
          if (!next) { reply("Nothing stands ahead in your record to take you to."); return; }
          goDay(next.stamp);
          reply(`Taking you to your next marked day — “${next.title}”, ${core.restateDay(next.stamp)}.`);
          return;
        }
        case "overdueFirst": {
          const timeline = await readTimeline();
          const first = timeline && timeline.find((e) => e.state === "overdue");
          if (!first) { reply("Nothing is overdue — there is no waiting day to take you to."); return; }
          goDay(first.stamp);
          reply(`Taking you to the day that has waited longest — “${first.title}”, ${core.restateDay(first.stamp)}.`);
          return;
        }
        case "dayLine": {
          const coord = window.SOFCurrentTemporalCoordinate || null;
          const ctx = schedCtx();
          const basePd = coord && coord.dayOfPatternYear != null ? Number(coord.dayOfPatternYear) : ctx.todayPatternDay;
          const baseAnchor = coord && coord.patternYear != null ? Number(coord.patternYear)
            : coord && coord.civilDate ? anchorYearForCivil(coord.civilDate) : ctx.todayAnchorYear;
          const targetAnchor = baseAnchor + cmd.years;
          const civil = core.civilDateForPatternDay(targetAnchor, basePd);
          const target = civil ? core.stampForCivil(civil) : null;
          if (!target) { reply("The day-line would not resolve that year from here."); return; }
          goDay(target);
          reply(`Following the day-line ${cmd.years > 0 ? "forward" : "back"} ${Math.abs(cmd.years)} year${Math.abs(cmd.years) === 1 ? "" : "s"} — the same Pattern day, ${core.restateDay(target)}. Your own hand can take you back whenever you like.`);
          return;
        }
        case "layer": {
          if (C && C.setLayer && C.setLayer(cmd.slot, cmd.on)) {
            reply(`The ${cmd.slot} layer is ${cmd.on ? "on" : "off"} — turned by your word, and the switch itself stands where it always did if you want it by hand.`);
          } else {
            reply("That layer answers to the instrument's own switches on this page — I drive the view, the days, and the Moons by word, and I will not reach past the switches.");
          }
          return;
        }
        default: return;
      }
    }

    async function handleIntent(intent) {
      if (!intent) return false;
      if (intent.action && !intent.kind) { await runShowCommand(intent); return true; }
      switch (intent.kind) {
        case "invalid": reply(intent.message); return true;
        case "schedule": await proposeSchedule(intent); return true;
        case "unschedule": await proposeUnschedule(intent); return true;
        case "complete": await proposeComplete(intent); return true;
        case "move": await proposeMove(intent); return true;
        case "ask": await answerAsk(intent); return true;
        case "generate": await proposeGenerated(intent); return true;
        default: return false;
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
      line += " Ask me what's on a day, tell me what to set and when, or tap one of these:";
      const greetingLine = addLine("spark", line, "From your record, on this device");
      // The ease pass: the common first steps stand as taps on
      // the greeting itself, so a keeper who does not yet know
      // the words is never stuck composing a first sentence.
      addChips(greetingLine, [
        { label: "What's on today", onPick: () => ask("what's on today") },
        { label: "What's next", onPick: () => ask("what's next") },
        { label: "Make me a schedule", onPick: () => ask("make me a schedule") },
        {
          label: "Set something…",
          onPick: () => {
            input.placeholder = "e.g. Call the hall Thursday at 10am";
            input.focus();
          },
        },
      ], false);
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

      // A pending proposal settles by word as by button — a
      // spoken "yes, set it" is the keeper's yes (Nov 24, 2026).
      if (pendingProposal) {
        if (/^(yes|yeah|yep|set it|do it|ok|okay|sure|go ahead)\b/i.test(clean)) { settleProposal(true); viaMic = false; return; }
        if (/^(no|not now|never mind|cancel|discard|leave it)\b/i.test(clean)) { settleProposal(false); viaMic = false; return; }
      }

      // Scheduling is the record's own work: parsed and kept on
      // this device, never sent through the talking door. In
      // child mode the scheduling family does not run at all —
      // nothing is scheduled, moved, or read out (the gate stands
      // before the branch, Nov 24, 2026). Pure view commands
      // still run: they are the Sphere's own face, and they
      // change nothing stored.
      const intent = parseIntent(clean);
      if (intent) {
        if (intent.kind && childModeFor(window.localStorage, record && record.seed)) {
          reply(CHILD_SCHEDULE_LINE);
          viaMic = false;
          return;
        }
        if (await handleIntent(intent)) { viaMic = false; return; }
      }

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
    // The ease pass's gate for the schedule layer: the timeline
    // rail's one-tap completion must know child mode, and the
    // marker layer keeps no store of its own — so the panel,
    // which already reads the flag the house way, publishes this
    // one question. The rail fails closed without it: no gate,
    // no Done buttons.
    window.SphereSparkScheduleGate = {
      childMode: () => childModeFor(window.localStorage, (readRecord() || {}).seed),
    };
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
