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
    return null;
  }

  const ACTION_NAMES = ["goToday", "showDay", "openDayWorld", "openDeepTime", "openFarm", "freeze", "wake", "speakDay"];

  const api = { VERSION, AGENT_URL, planNotesFor, classifyLocal, ACTION_NAMES };
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
        <span class="sphere-spark-art" aria-hidden="true">${Core.renderSVG(companion, { stage: stage.index })}</span>
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

    // The orbit: a slow circuit of the stage with depth, so the
    // Spark reads as a companion on the instrument, not a widget.
    if (!reducedMotion) {
      let raf = 0;
      let visible = true;
      if ("IntersectionObserver" in window) {
        new IntersectionObserver((entries) => { visible = entries[0]?.isIntersecting !== false; }, { threshold: 0.02 }).observe(wrap);
      }
      const orbit = (now) => {
        raf = requestAnimationFrame(orbit);
        if (document.hidden || !visible) return;
        const w = wrap.clientWidth, h = wrap.clientHeight;
        if (!w || !h) return;
        const angle = (now / 26000) * Math.PI * 2 + 0.8;
        const rx = w * 0.36, ry = h * 0.30;
        const x = w / 2 + Math.cos(angle) * rx;
        const y = h * 0.46 + Math.sin(angle) * ry;
        const depth = (Math.sin(angle) + 1) / 2; // 0 behind, 1 in front
        holder.style.transform = `translate(${Math.round(x - 34)}px, ${Math.round(y - 34)}px) scale(${(0.82 + depth * 0.33).toFixed(3)})`;
        holder.style.opacity = String(0.72 + depth * 0.28);
        holder.style.zIndex = depth > 0.5 ? "7" : "3";
      };
      raf = requestAnimationFrame(orbit);
      holder.dataset.orbiting = "1";
      // Keep the loop honest when the holder leaves the page.
      new MutationObserver(() => { if (!document.contains(holder)) cancelAnimationFrame(raf); }).observe(document.body, { childList: true, subtree: true });
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
        <span class="sphere-spark-talk-art" aria-hidden="true">${Core.renderSVG(companion, { stage: stage.index })}</span>
        <div>
          <h2 class="sphere-spark-talk-title">${name}</h2>
          <p class="sphere-spark-talk-stage">${companion.kindName || companion.kind || "Spark"} · ${stage.name}${growth ? ` · voice: ${growth.name}` : ""}${presence ? ` · ${presence.name}` : ""}</p>
        </div>
      </div>
      <p class="sphere-spark-talk-privacy">Two ways of answering, named on every reply: from your record on this device, or through the talking door. Your record's summary — ${name}'s name, your days and practices, today's coordinate — travels with your words only while you are in this conversation. Your notes are never sent, and nothing of this conversation is kept when the page closes.</p>
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
      addLine("keeper", clean);
      input.value = "";

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

  function boot() {
    if (!Core) return;
    const record = readRecord();
    const companion = record ? Core.generate(record.seed) : null;
    if (record && companion) buildPresence(record, companion);
    buildTalkPanel(record, companion);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(typeof globalThis !== "undefined" ? globalThis : this);
