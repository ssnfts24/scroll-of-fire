/**
 * Spark tips — the Spark speaks up, sparingly, when the record
 * earns it (Aaron's ruling, Nov 23, 2026; the Sphere charter,
 * "the one-instrument law").
 *
 * A tip is a small, earned noticing — "frost tonight; you could
 * cover the beds" is the charter's model — composed ONLY from
 * the keeper's own record on this device: the Pattern Garden's
 * fold of the Life Atlas, and the keeper's own kept practice.
 * No network calls, no invented facts, no tip without a named
 * record source. A tip that cannot say where it came from does
 * not fire.
 *
 * Before any tip is composed into words, the fence screen runs
 * over it — the same fenced ground the keeper mind screens for
 * (court and legal matters, family, Aaron's private details,
 * speaking as Aaron). A tip whose own words walk that ground
 * never fires. This module carries its own copy of the fence
 * patterns, pinned to the keeper mind's by test — the same
 * convention the mind and the door already keep between them.
 *
 * The keeper's terms, as ruled:
 *   - a soft two-note chime first, tuned to A=432 — the Codex's
 *     own tuning — when the keeper's mode allows sound;
 *   - quiet by default: nothing interrupts a page; a tip waits
 *     inside the Spark's seat until the keeper comes to it, and
 *     at most one uninvited tip is offered per session;
 *   - the keeper chooses how tips arrive — chime first, words
 *     only, spoken aloud (the browser's own speech, on this
 *     device), or quiet always — and the choice persists;
 *   - any kind of tip can be dismissed forever, and that
 *     dismissal persists on this device;
 *   - the chime honours reduced-motion and quiet settings: a
 *     keeper who asks for less motion gets the words silently.
 *
 * The layer rides the seat the way the keeper mind does:
 * SparkAgentSeat.attach, lazy-loaded by the seat the first
 * time the panel opens. If this module cannot load, the seat
 * keeps answering exactly as it did before.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SparkTips = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function () {
    "use strict";

    const VERSION = "spark-tips/1.0.0";
    const SETTINGS_KEY = "sof.spark.tips.v1";
    const MODES = ["chime", "text", "voice", "off"];

    /* ------------------------- the fence ------------------------- */

    /* Router rule 1's patterns, mirrored from the keeper mind so
     * the screen runs before a tip exists — pinned to
     * SparkKeeperMind.fenceCheck by test, the same convention the
     * mind and the door keep between their copies. */
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

    /* ------------------------ settings --------------------------- */

    function blankSettings() {
      return { version: 1, mode: "chime", dismissedKinds: [] };
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
        if (MODES.includes(parsed.mode)) settings.mode = parsed.mode;
        if (Array.isArray(parsed.dismissedKinds)) {
          settings.dismissedKinds = [...new Set(
            parsed.dismissedKinds.filter((k) => typeof k === "string" && k)
          )];
        }
      } catch { /* a damaged setting falls back to the quiet default */ }
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

    /* Dismissing a kind is forever, until the keeper changes
     * their own settings file — nothing here undismisses. */
    function dismissKind(settings, kind) {
      const next = {
        version: 1,
        mode: settings && MODES.includes(settings.mode) ? settings.mode : "chime",
        dismissedKinds: [...new Set([
          ...((settings && settings.dismissedKinds) || []),
          ...(kind ? [String(kind)] : [])
        ])]
      };
      return next;
    }

    /* ---------------------- composing tips ----------------------- */

    /**
     * composeTips(sources) — the pure composer.
     * sources: {
     *   garden: PatternGarden fold ({ beds: [{ name, plantings:
     *     [{ cropName, canHarvest, goneToSeed, harvested }],
     *     returnable: [...] }] }) | null,
     *   unfinishedPractice: string | null
     * }
     * Every returned tip carries the record it came from in
     * `source`; a candidate that cannot name its source, or
     * whose words trip the fence, is dropped here — before any
     * presentation exists.
     */
    function composeTips(sources) {
      const s = sources || {};
      const tips = [];
      const beds = s.garden && Array.isArray(s.garden.beds) ? s.garden.beds : [];

      for (const bed of beds) {
        if (!bed || !bed.name) continue;
        for (const p of bed.plantings || []) {
          if (!p || !p.cropName || p.harvested) continue;
          if (p.canHarvest) {
            tips.push({
              kind: "harvest",
              text: `Your ${p.cropName} in ${bed.name} stands ready to harvest — you could gather it today.`,
              source: "Pattern Garden record"
            });
          }
        }
      }
      for (const bed of beds) {
        if (!bed || !bed.name) continue;
        if (Array.isArray(bed.returnable) && bed.returnable.length) {
          tips.push({
            kind: "return",
            text: `A keepsake from last year can return in ${bed.name} this Moon — you could bring it back to the bed.`,
            source: "Pattern Garden record"
          });
        }
      }
      for (const bed of beds) {
        if (!bed || !bed.name) continue;
        for (const p of bed.plantings || []) {
          if (!p || !p.cropName || p.harvested) continue;
          if (p.goneToSeed) {
            tips.push({
              kind: "seed",
              text: `Your ${p.cropName} in ${bed.name} has gone to seed — you could gather the seed for next year.`,
              source: "Pattern Garden record"
            });
          }
        }
      }
      if (s.unfinishedPractice) {
        tips.push({
          kind: "practice",
          text: `Your practice “${s.unfinishedPractice}” waits unfinished — you could pick it up today.`,
          source: "your record on this device"
        });
      }

      return tips.filter((tip) =>
        tip.text && tip.source && !fenceCheck(tip.text) && !fenceCheck(tip.source)
      );
    }

    /* The keeper's settings gate every presentation: quiet-always
     * shows nothing, and a dismissed kind never returns. */
    function presentableTips(tips, settings) {
      if (!settings || settings.mode === "off") return [];
      const dismissed = new Set(settings.dismissedKinds || []);
      return (Array.isArray(tips) ? tips : []).filter((tip) => !dismissed.has(tip.kind));
    }

    /* The chime sounds only when the keeper's mode carries sound
     * and the moment allows it: reduced motion asks for stillness,
     * and a hidden page is not a moment to be heard in. */
    function shouldChime(settings, env) {
      if (!settings || (settings.mode !== "chime" && settings.mode !== "voice")) return false;
      if (!env || env.reducedMotion || env.hidden) return false;
      return true;
    }

    function shouldSpeak(settings) {
      return Boolean(settings) && settings.mode === "voice";
    }

    /* --------------------- browser enhancer ---------------------- */

    const STYLE_TEXT = `
.spark-tips { margin-top: 0.75rem; border-top: 1px solid rgba(148, 184, 255, 0.18); padding-top: 0.6rem; }
.spark-tips-line { margin: 0 0 0.25rem; }
.spark-tips-source { margin: 0 0 0.45rem; font-size: 0.78rem; opacity: 0.72; }
.spark-tips-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
.spark-tips-actions button, .spark-tips-actions select { font: inherit; font-size: 0.8rem; }
`;

    function injectStyles() {
      if (document.querySelector("[data-spark-tips-styles]")) return;
      const style = document.createElement("style");
      style.setAttribute("data-spark-tips-styles", "");
      style.textContent = STYLE_TEXT;
      document.head.appendChild(style);
    }

    function resolveRepository() {
      try {
        const Repository = window.CodexLifeAtlasRepository;
        if (!Repository) return null;
        if (typeof Repository.createPersistentRepository === "function") return Repository.createPersistentRepository();
        if (typeof Repository.createRepository === "function") return Repository.createRepository();
      } catch { /* the Atlas simply isn't on this page */ }
      return null;
    }

    /* The same read-only gathering the keeper mind performs:
     * the garden's fold of the Atlas, and the keeper's own
     * kept memory. Nothing here writes, and nothing leaves
     * the device. */
    async function gatherSources(storage) {
      const codexMemory = (() => {
        try {
          const raw = storage.getItem("sof.codexMemory.v1");
          return raw ? JSON.parse(raw) : null;
        } catch { return null; }
      })();
      let garden = null;
      const repository = resolveRepository();
      if (repository) {
        try {
          const Garden = typeof PatternGarden !== "undefined" ? PatternGarden : null;
          if (Garden && typeof Garden.foldGarden === "function") {
            const all = await repository.query({});
            const keptDates = [...new Set((all || []).map((r) => r && r.temporal && r.temporal.civilDate).filter(Boolean))];
            const fold = Garden.foldGarden({ records: all || [], keptDates });
            if (fold && Array.isArray(fold.beds)) garden = fold;
          }
        } catch { garden = null; }
      }
      return {
        garden,
        unfinishedPractice: codexMemory && codexMemory.unfinishedPractice
          ? codexMemory.unfinishedPractice.title || null
          : null
      };
    }

    function playChime() {
      try {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return;
        const ctx = playChime.ctx || (playChime.ctx = new AudioCtor());
        if (ctx.state === "suspended") void ctx.resume();
        const notes = [432, 648]; // A=432, the Codex's tuning: root, then its fifth
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          const start = ctx.currentTime + i * 0.22;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.07, start + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);
          osc.connect(gain).connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.4);
        });
      } catch { /* a chime that cannot sound is simply silence */ }
    }

    function speakTip(text) {
      try {
        const synth = window.speechSynthesis;
        if (!synth) return;
        synth.cancel();
        synth.speak(new SpeechSynthesisUtterance(text));
      } catch { /* speech is an offering, never a requirement */ }
    }

    function enhanceSeat(api) {
      if (!api || !api.panel || api.panel.dataset.sparkTips === "1") return;
      api.panel.dataset.sparkTips = "1";
      injectStyles();

      const storage = window.localStorage;
      let settings = loadSettings(storage);
      const persist = () => saveSettings(storage, settings);

      const box = document.createElement("div");
      box.className = "spark-tips";
      box.hidden = true;
      if (api.formEl && api.formEl.parentNode === api.panel) {
        api.panel.insertBefore(box, api.formEl);
      } else {
        api.panel.appendChild(box);
      }

      let candidates = null;   // gathered once per page, from the record
      let queue = [];          // presentable tips not yet shown
      let offered = false;     // the session's one uninvited offer
      let engaged = false;     // the keeper asked for more

      function clearBox() {
        box.textContent = "";
        box.hidden = true;
      }

      function present(tip) {
        box.textContent = "";
        box.hidden = false;

        const line = document.createElement("p");
        line.className = "spark-tips-line";
        line.textContent = `Hey — ${tip.text}`;
        box.appendChild(line);

        const source = document.createElement("p");
        source.className = "spark-tips-source";
        source.textContent = `From ${tip.source}.`;
        box.appendChild(source);

        const actions = document.createElement("div");
        actions.className = "spark-tips-actions";

        if (queue.length) {
          const more = document.createElement("button");
          more.type = "button";
          more.textContent = "Another tip";
          more.addEventListener("click", () => {
            engaged = true;
            present(queue.shift());
          });
          actions.appendChild(more);
        }

        const never = document.createElement("button");
        never.type = "button";
        never.textContent = "Never this kind again";
        never.addEventListener("click", () => {
          settings = dismissKind(settings, tip.kind);
          persist();
          queue = presentableTips(queue, settings);
          if (queue.length) present(queue.shift());
          else clearBox();
        });
        actions.appendChild(never);

        const modeLabel = document.createElement("label");
        modeLabel.textContent = "Tips arrive: ";
        const mode = document.createElement("select");
        mode.setAttribute("aria-label", "How Spark tips arrive");
        for (const [value, label] of [
          ["chime", "chime first"],
          ["text", "words only"],
          ["voice", "spoken aloud"],
          ["off", "quiet — never"]
        ]) {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = label;
          if (settings.mode === value) option.selected = true;
          mode.appendChild(option);
        }
        mode.addEventListener("change", () => {
          settings = { ...settings, mode: mode.value };
          persist();
          if (settings.mode === "off") clearBox();
        });
        modeLabel.appendChild(mode);
        actions.appendChild(modeLabel);
        box.appendChild(actions);

        const env = {
          reducedMotion: typeof window.matchMedia === "function"
            && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          hidden: document.hidden
        };
        if (shouldChime(settings, env)) playChime();
        if (shouldSpeak(settings)) speakTip(tip.text);
      }

      async function maybeOffer() {
        if (api.panel.hidden) return;
        if (offered && !engaged) return; // one uninvited tip per session
        if (settings.mode === "off") return;
        if (!candidates) {
          const sources = await gatherSources(storage);
          candidates = composeTips(sources);
          queue = presentableTips(candidates, settings);
        }
        if (!queue.length) return;
        offered = true;
        present(queue.shift());
      }

      /* The tip waits for the keeper: it is offered when the
       * seat's panel opens, never over a page uninvited. */
      const observer = new MutationObserver(() => { void maybeOffer(); });
      observer.observe(api.panel, { attributes: true, attributeFilter: ["hidden"] });
      void maybeOffer();
    }

    if (typeof document !== "undefined" && globalThis.SparkAgentSeat && typeof globalThis.SparkAgentSeat.attach === "function") {
      globalThis.SparkAgentSeat.attach(enhanceSeat);
    }

    return {
      VERSION,
      SETTINGS_KEY,
      fenceCheck,
      blankSettings,
      loadSettings,
      saveSettings,
      dismissKind,
      composeTips,
      presentableTips,
      shouldChime,
      shouldSpeak
    };
  }
);
