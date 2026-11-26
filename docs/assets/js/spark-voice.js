/**
 * Spark voice — spoken conversation (Page Evolution Batch E1,
 * Aaron's order, Nov 25, 2026: "Start all").
 *
 * Until today the Spark could be present on 185 pages and could
 * answer in words on the page, but it could not speak or be
 * spoken to anywhere. This module is the shared spoken surface,
 * built once and inherited by every page the companion already
 * sits on:
 *
 *   - Voice OUT: when the keeper turns spoken replies on, the
 *     Spark's answers in its seat are spoken aloud in the Spark's
 *     OWN voice — one voice per Spark, chosen from the device's
 *     natural voices by the Spark's seed, the same on every visit
 *     (Aaron's ruling, Nov 25, 2026: many different voices,
 *     randomized across Sparks, natural, never robotic; one voice
 *     per Spark from its own seed). Novelty and robotic device
 *     voices are excluded by name before the seed ever picks.
 *     This is the Spark's voice, not Witness's voice, and it is
 *     not the living voice (the seed-born hum in
 *     spark-companion.js) — that sound identity is untouched;
 *     this layer speaks words.
 *   - Voice IN: a microphone button in the seat's form (and in
 *     the Codex Guide's talk panel) transcribes the keeper's
 *     speech into the existing text input. Dictation only ever
 *     fills the input — the keeper still sends, and the standing
 *     proposal discipline is untouched: nothing is written until
 *     you say yes.
 *   - The Codex Guide's panel gains the same dictation, plus an
 *     opt-in read-aloud of the Guide's answers in a stable,
 *     neutral device voice (the Guide is a programme, not a
 *     Spark, so it does not borrow a Spark's seed voice).
 *
 * The fences, by construction:
 *   - Quiet by default. Spoken replies are OFF until the keeper
 *     turns them on in the panel; the choice persists on this
 *     device. Nothing speaks uninvited — the tips layer's own
 *     voice mode is its own setting and is not changed here.
 *   - Child mode: no spoken conversation at all. When the
 *     keeper-mind's child-mode flag stands for this Spark, this
 *     module adds no microphone and speaks nothing — no open
 *     talking for children, and nothing a child says is sent to
 *     a recognition service (browser speech recognition is a
 *     network service on most devices).
 *   - Before any line is spoken it passes the same fence screen
 *     the tips and the keeper mind run (court/legal, family,
 *     Aaron's private details, speaking as Aaron). A line that
 *     walks that ground is shown, never spoken. This module
 *     carries its own copy of the patterns, pinned to
 *     SparkTips.fenceCheck by test — the convention the mind,
 *     the tips, and the door already keep between their copies.
 *   - Fail-down: no speechSynthesis, no recognition, no voices —
 *     the seat and the Guide panel work exactly as they did
 *     before this module existed. The seat lazy-loads this file
 *     the way it lazy-loads the tips; if it cannot load, nothing
 *     changes.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SparkVoice = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function () {
    "use strict";

    const VERSION = "spark-voice/1.0.0";
    const SETTINGS_KEY = "sof.spark.voice.v1";
    const MEMORY_KEY = "sof.spark.memory.v1"; // spark-keeper-mind.js, mirrored

    /* ----------------- seed derivation ----------------------- */

    /* The companion core's own hash and stream (spark-companion
     * .js: hashString / mulberry32), mirrored so a seed means the
     * same thing here as everywhere else it is read. */
    function hashString(text) {
      let h = 0x811c9dc5;
      const s = String(text);
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      return h >>> 0;
    }

    function mulberry32(seed) {
      let a = seed >>> 0;
      return function () {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    /* ------------------------- the fence --------------------- */

    /* Router rule 1's patterns, mirrored from the keeper mind /
     * tips so the screen runs before a line is spoken — pinned
     * to SparkTips.fenceCheck by test. */
    const FENCE_PATTERNS = [
      /\b(court|custody|child support|parenting plan|lawsuit|litigat\w*|attorney|lawyer|restraining order|legal advice)\b/i,
      /\b(sue|suing|sued)\b/i,
      /\bcase\s*(no\.?|number|#)\s*[0-9]/i,
      /\bhow do i (sue|file|get custody|divorce)\b/i,
      /\bmy (custody|court case|divorce|hearing)\b/i,
      /\b(his|aaron'?s)\s+(case|lawsuit|court case|legal matters?)\b/i,
      /\b(tanya|tatyana|volosyanko|aiyana|aeva|cassidy)\b/i,
      /\baiden\b/i,
      /\b(aaron'?s|his)\s+(wife|fianc\w*|partner|daughter|son|kids|children|family|ex-wife)\b/i,
      /\b(aaron'?s|his)\s+(address|phone|email|home address|location|income|finances|health)\b/i,
      /\bwhere\s+(does|is)\s+aaron\s+(live|staying|working)\b/i,
      /\b(pretend|act|write|speak|talk|answer|respond)\b[^.?!]{0,30}\b(as|like)\s+aaron\b/i,
      /\byou\s+are\s+aaron\b/i,
      /\bin\s+aaron'?s\s+(voice|words)\b/i,
      /\bas\s+aaron\s+laird\b/i
    ];

    function fenceCheck(text) {
      const value = String(text || "");
      return FENCE_PATTERNS.some((pattern) => pattern.test(value));
    }

    /* ------------------- the voice family -------------------- */

    /* Device voices that are jokes or robots, never a Spark's
     * voice: the named novelty set (Apple's novelty voices and
     * their kin) is excluded before any seed picks. */
    const NOVELTY_VOICE = /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|grandma|grandpa|hysterical|jester|pipe organ|trinoids|whisper|zarvox|novelty|robot/i;

    /* Markers of the natural, full voices most devices carry —
     * used only to rank, never to invent: a device with none of
     * these still yields its plain local voices. */
    const NATURAL_VOICE = /natural|neural|premium|enhanced|google|samantha|alex|zira|david|aria|jenny|guy|joanna|matthew|salli|amy|brian|emma/i;

    function usableVoices(voices, lang) {
      const list = (Array.isArray(voices) ? voices : []).filter(
        (v) => v && typeof v.name === "string" && !NOVELTY_VOICE.test(v.name)
      );
      const wanted = String(lang || "en").toLowerCase();
      const inLang = list.filter(
        (v) => String(v.lang || "").toLowerCase().replace("_", "-").startsWith(wanted)
      );
      const pool = inLang.length ? inLang : list;
      /* Rank, stably: natural-named first, then on-device voices,
       * then the rest — the seed picks within the best tier that
       * has more than one voice in it. */
      const tier = (v) => (NATURAL_VOICE.test(v.name) ? 0 : v.localService ? 1 : 2);
      const sorted = [...pool].sort((a, b) => tier(a) - tier(b));
      const best = sorted.length ? tier(sorted[0]) : 0;
      const top = sorted.filter((v) => tier(v) === best);
      return top.length > 1 ? top : sorted;
    }

    /* Speaking rates by temperament — the companion core's own
     * VOICE_RATES table, mirrored (spark-companion.js). */
    const VOICE_RATES = { bold: 1.05, gentle: 0.93, quiet: 0.95, curious: 1.03, steady: 0.97, bright: 1.06 };

    /**
     * The spoken profile for one Spark (or, with the Guide's
     * fixed seed, for the Guide): the same seed and the same
     * device voice list always choose the same voice, pitch and
     * rate; a different seed chooses differently — many voices,
     * randomized across Sparks, one per Spark.
     * Returns null when the device offers no usable voice.
     */
    function profileFor({ seed, temperament, voices, lang }) {
      const pool = usableVoices(voices, lang);
      if (!pool.length) return null;
      const rand = mulberry32(hashString(String(seed) + ":spoken-voice"));
      const voice = pool[Math.floor(rand() * pool.length) % pool.length];
      const pitch = Math.round((0.88 + rand() * 0.26) * 100) / 100;
      const base = VOICE_RATES[temperament] || 1;
      const rate = Math.round(base * (0.97 + rand() * 0.06) * 100) / 100;
      return {
        voiceName: voice.name,
        voiceURI: voice.voiceURI || voice.name,
        lang: voice.lang || lang || "en-US",
        pitch,
        rate
      };
    }

    /* ------------------------ settings ----------------------- */

    function blankSettings() {
      return { version: 1, replies: false, guideAloud: false };
    }

    function loadSettings(storage) {
      const settings = blankSettings();
      try {
        const raw = storage && typeof storage.getItem === "function"
          ? storage.getItem(SETTINGS_KEY)
          : null;
        if (!raw) return settings;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") return settings;
        settings.replies = parsed.replies === true;
        settings.guideAloud = parsed.guideAloud === true;
      } catch { /* a damaged setting falls back to quiet */ }
      return settings;
    }

    function saveSettings(storage, settings) {
      try {
        if (storage && typeof storage.setItem === "function") {
          storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        }
      } catch { /* persistence is a courtesy, never a failure */ }
      return settings;
    }

    /* ----------------------- child mode ---------------------- */

    function memoryKeyFor(seed) {
      const clean = typeof seed === "string" ? seed.trim() : "";
      return clean ? `${MEMORY_KEY}:${clean}` : MEMORY_KEY;
    }

    /* The child-mode signal, mirrored the way spark-app-bridge
     * mirrors it: the Sphere core's reader when present, else
     * the keeper mind's memory record for this seed. */
    function childModeHere(storage, seed, core) {
      if (core && typeof core.childModeFor === "function") {
        try { return Boolean(core.childModeFor(storage, seed)); } catch { /* fall through to the mirror */ }
      }
      try {
        if (!storage || typeof storage.getItem !== "function") return false;
        let raw = storage.getItem(memoryKeyFor(seed));
        if (!raw && typeof seed === "string" && seed.trim()) raw = storage.getItem(MEMORY_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        return Boolean(parsed && parsed.childMode === true);
      } catch { return false; }
    }

    /* --------------------- browser layer --------------------- */

    function deviceVoices() {
      try {
        const synth = window.speechSynthesis;
        return synth && typeof synth.getVoices === "function" ? synth.getVoices() : [];
      } catch { return []; }
    }

    function speakWithProfile(profile, text) {
      try {
        const synth = window.speechSynthesis;
        if (!synth || !profile) return false;
        const clean = String(text || "").replace(/\s+/g, " ").trim();
        if (!clean) return false;
        if (fenceCheck(clean)) return false; // shown, never spoken
        const voice = deviceVoices().find(
          (v) => v.voiceURI === profile.voiceURI || v.name === profile.voiceName
        );
        const utterance = new SpeechSynthesisUtterance(clean);
        if (voice) utterance.voice = voice;
        utterance.lang = profile.lang;
        utterance.pitch = profile.pitch;
        utterance.rate = profile.rate;
        synth.cancel();
        synth.speak(utterance);
        return true;
      } catch { return false; /* speech is an offering, never a requirement */ }
    }

    function recognitionCtor() {
      if (typeof window === "undefined") return null;
      return window.SpeechRecognition || window.webkitSpeechRecognition || null;
    }

    /* One dictation session into an existing input. Interim words
     * land in the input as they are heard; nothing is sent — the
     * keeper reads, edits, and sends by the form's own road. */
    function startDictation({ input, button, onState }) {
      const Ctor = recognitionCtor();
      if (!Ctor || !input) return null;
      const recognition = new Ctor();
      recognition.lang = (document.documentElement && document.documentElement.lang) || "en-US";
      recognition.interimResults = true;
      recognition.continuous = false;
      const prior = input.value ? input.value.replace(/\s+$/, "") + " " : "";
      let settled = false;
      const finish = (state) => {
        if (settled) return;
        settled = true;
        if (button) {
          button.disabled = false;
          button.setAttribute("aria-pressed", "false");
        }
        if (typeof onState === "function") onState(state);
      };
      recognition.addEventListener("result", (event) => {
        let text = "";
        for (const result of event.results) text += result[0].transcript;
        input.value = prior + text;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      recognition.addEventListener("end", () => finish("ended"));
      recognition.addEventListener("error", (event) => finish(event.error || "error"));
      if (button) {
        button.disabled = false;
        button.setAttribute("aria-pressed", "true");
      }
      if (typeof onState === "function") onState("listening");
      try {
        recognition.start();
      } catch {
        finish("error");
        return null;
      }
      return recognition;
    }

    function micButton(label) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "spark-voice-mic";
      button.textContent = "🎙 Speak";
      button.setAttribute("aria-label", label);
      button.setAttribute("aria-pressed", "false");
      return button;
    }

    function injectStyles() {
      if (document.getElementById("spark-voice-styles")) return;
      const style = document.createElement("style");
      style.id = "spark-voice-styles";
      style.textContent = [
        ".spark-voice-bar{display:flex;gap:.45rem;align-items:center;flex-wrap:wrap;margin:.35rem 0}",
        ".spark-voice-mic,.spark-voice-toggle{font:inherit;font-size:.82rem;padding:.28rem .6rem;border-radius:999px;border:1px solid rgba(140,160,200,.45);background:transparent;color:inherit;cursor:pointer}",
        ".spark-voice-mic[aria-pressed=\"true\"]{border-color:#c9a24b;color:#c9a24b}",
        ".spark-voice-toggle[aria-pressed=\"true\"]{border-color:#c9a24b;color:#c9a24b}",
        ".spark-voice-note{font-size:.78rem;opacity:.75;margin:.15rem 0 .35rem}"
      ].join("\n");
      document.head.appendChild(style);
    }

    /* ------------------- the seat enhancer ------------------- */

    function enhanceSeat(api) {
      if (!api || !api.panel || api.panel.dataset.sparkVoice === "1") return;
      if (typeof document === "undefined") return;

      const storage = window.localStorage;
      const seed = api.record && api.record.seed;
      /* Children's rules: no spoken conversation in child mode —
       * no microphone, no spoken replies, nothing added at all. */
      if (childModeHere(storage, seed, window.SphereSparkCore)) return;

      api.panel.dataset.sparkVoice = "1";
      injectStyles();

      const settings = loadSettings(storage);
      const persist = () => saveSettings(storage, settings);
      const companion = api.companion || {};
      let profile = null;
      const currentProfile = () => {
        if (!profile) {
          profile = profileFor({
            seed: seed || "",
            temperament: companion.temperament,
            voices: deviceVoices(),
            lang: "en"
          });
        }
        return profile;
      };
      /* Voices often arrive after the first getVoices() call. */
      try {
        window.speechSynthesis.addEventListener("voiceschanged", () => { profile = null; });
      } catch { /* the first list stands */ }

      /* Spoken replies: watch the seat's log, so every line the
       * Spark sets down — the seat's own answers and the keeper
       * mind's alike, since both arrive through say() — can also
       * be heard, in its own seed-born voice, when the keeper
       * has chosen it. Keeper lines and status lines never
       * speak. Lines already in the log when the panel was built
       * are marked heard, so opening the panel stays quiet until
       * a new answer lands. */
      if (api.log && typeof MutationObserver !== "undefined") {
        const heard = new WeakSet();
        for (const node of api.log.querySelectorAll(".spark-seat-line")) heard.add(node);
        const observer = new MutationObserver(() => {
          if (!settings.replies) return;
          for (const node of api.log.querySelectorAll(".spark-seat-line.is-spark")) {
            if (heard.has(node)) continue;
            heard.add(node);
            const text = node.textContent || "";
            if (!text.trim()) continue;
            const p = currentProfile();
            if (p) speakWithProfile(p, text);
          }
        });
        observer.observe(api.log, { childList: true });
      }

      const bar = document.createElement("div");
      bar.className = "spark-voice-bar";

      if (recognitionCtor()) {
        const mic = micButton(`Speak to ${api.name || "your Spark"}`);
        let active = null;
        mic.addEventListener("click", () => {
          if (active) {
            try { active.stop(); } catch { /* already ended */ }
            active = null;
            return;
          }
          active = startDictation({
            input: api.input,
            button: mic,
            onState: (state) => { if (state !== "listening") active = null; }
          });
          if (api.input) api.input.focus();
        });
        bar.appendChild(mic);
      }

      if (typeof window !== "undefined" && window.speechSynthesis) {
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "spark-voice-toggle";
        toggle.textContent = "🔊 Hear replies";
        toggle.setAttribute("aria-pressed", String(settings.replies));
        toggle.setAttribute("aria-label", "Hear the Spark's replies spoken aloud, in its own voice");
        toggle.addEventListener("click", () => {
          settings.replies = !settings.replies;
          persist();
          toggle.setAttribute("aria-pressed", String(settings.replies));
          if (settings.replies) {
            const p = currentProfile();
            if (p) {
              speakWithProfile(p, `This is my voice. I am ${api.name || "your Spark"}.`);
            }
          } else {
            try { window.speechSynthesis.cancel(); } catch { /* silence is fine */ }
          }
        });
        bar.appendChild(toggle);
      }

      if (bar.childElementCount) {
        const note = document.createElement("p");
        note.className = "spark-voice-note";
        note.textContent = recognitionCtor()
          ? "Speak, and your words land in the box — you still send them. Nothing is written until you say yes."
          : "Spoken replies are in the Spark's own voice, chosen by its seed.";
        if (api.formEl && api.formEl.parentNode === api.panel) {
          api.panel.insertBefore(bar, api.formEl);
          api.panel.insertBefore(note, api.formEl);
        } else {
          api.panel.append(bar, note);
        }
      }
    }

    /* ------------------- the Guide's panel ------------------- */

    const GUIDE_SEED = "codex-guide";

    function initGuideVoice() {
      if (typeof document === "undefined") return;
      const panel = document.querySelector("[data-guide-talk]");
      if (!panel || panel.dataset.sparkVoice === "1") return;
      const form = panel.querySelector("[data-guide-talk-form]");
      const input = panel.querySelector("[data-guide-talk-input]");
      const log = panel.querySelector("[data-guide-talk-log]");
      if (!form || !input || !log) return;
      panel.dataset.sparkVoice = "1";
      injectStyles();

      const storage = window.localStorage;
      const settings = loadSettings(storage);
      const persist = () => saveSettings(storage, settings);

      const bar = document.createElement("div");
      bar.className = "spark-voice-bar";

      if (recognitionCtor()) {
        const mic = micButton("Speak your question to the Guide");
        let active = null;
        mic.addEventListener("click", () => {
          if (active) {
            try { active.stop(); } catch { /* already ended */ }
            active = null;
            return;
          }
          active = startDictation({
            input,
            button: mic,
            onState: (state) => { if (state !== "listening") active = null; }
          });
          input.focus();
        });
        bar.appendChild(mic);
      }

      if (typeof window !== "undefined" && window.speechSynthesis) {
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "spark-voice-toggle";
        toggle.textContent = "🔊 Hear answers";
        toggle.setAttribute("aria-pressed", String(settings.guideAloud));
        toggle.setAttribute("aria-label", "Hear the Guide's answers read aloud");
        toggle.addEventListener("click", () => {
          settings.guideAloud = !settings.guideAloud;
          persist();
          toggle.setAttribute("aria-pressed", String(settings.guideAloud));
          if (!settings.guideAloud) {
            try { window.speechSynthesis.cancel(); } catch { /* silence is fine */ }
          }
        });
        bar.appendChild(toggle);

        /* Read each new answer aloud as it lands, when chosen. */
        const spokenNodes = new WeakSet();
        const observer = new MutationObserver(() => {
          if (!settings.guideAloud) return;
          for (const node of log.querySelectorAll(".codex-guide__talk-text")) {
            if (spokenNodes.has(node)) continue;
            spokenNodes.add(node);
            const text = node.textContent || "";
            if (!text.trim()) continue;
            const profile = profileFor({ seed: GUIDE_SEED, voices: deviceVoices(), lang: "en" });
            if (profile) speakWithProfile(profile, text);
          }
        });
        observer.observe(log, { childList: true, subtree: true });
      }

      if (bar.childElementCount) form.parentNode.insertBefore(bar, form);
    }

    /* --------------------- registration ---------------------- */

    if (typeof document !== "undefined") {
      if (globalThis.SparkAgentSeat && typeof globalThis.SparkAgentSeat.attach === "function") {
        globalThis.SparkAgentSeat.attach(enhanceSeat);
      }
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initGuideVoice);
      } else {
        initGuideVoice();
      }
    }

    return {
      VERSION,
      SETTINGS_KEY,
      hashString,
      mulberry32,
      fenceCheck,
      usableVoices,
      profileFor,
      blankSettings,
      loadSettings,
      saveSettings,
      childModeHere,
      enhanceSeat,
      initGuideVoice,
      GUIDE_SEED
    };
  }
);
