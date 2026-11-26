/**
 * Manifest Spark — the Spark leads the Manifest Practice sitting.
 *
 * Direction: Aaron, Nov 25, 2026 voice call — the Manifest Practice
 * (teach.html, the Remnant Visual Exercise) "needs to be very
 * interactive as well" and "your Spark should play into this somehow."
 * Settled shape, four roles for the Spark:
 *
 *   1. OPENS the sitting and speaks the keeper's intention back
 *      (in the Spark's panel line — its text voice on this page).
 *   2. IS the moving light in the visual field: a guide light on an
 *      overlay above the trace canvas. The keeper follows it with
 *      touch and breath; following settles the sitting, and the
 *      console's field answers — it calms and leans toward the touch
 *      through the window hooks below, and the carrier tone glides
 *      gently toward the sitting's home carrier as settle rises.
 *   3. PLAYS THE ECHO: the Echo Duet from the Spark's play design
 *      (SparkCompanion.echoFor — the Spark sounds a pattern of pads,
 *      the keeper answers on the pads).
 *   4. WITNESSES THE SEAL: when the session seals into the Life Atlas
 *      (manifest-practice.js owns the record), the Spark's witness
 *      line names the coordinate and the resting place of the record.
 *
 * Learning, under proposal discipline: sealed sessions remember how
 * long settling took (payload.manifestPractice.spark). From two or
 * more settled sittings, the Spark PROPOSES the carrier + visual mode
 * that settled this keeper fastest. Nothing is applied until the
 * keeper taps "Use the Spark's suggestion" — the proposal renders,
 * the keeper decides, exactly like the site's scheduling proposals.
 *
 * The live session is exposed to the console the same way the seed
 * already is: window.__sofManifestSession() (read by
 * manifest-practice.js at seal time, so duration is real, never
 * invented), window.__sofManifestSettle() and
 * window.__sofManifestTouch() (read by the console's draw loop).
 *
 * Fences: child mode (the mirrored signal from spark-app-bridge.js)
 * silences all audio and the duet stays visual; nothing typed here
 * leaves the device — there is no network path in this module at all;
 * the Spark is named, "the Spark", or "it" — never "she"; guidance
 * copy invites, it never lists absences; reduced motion stills the
 * light. Ξ remains the console's estimate, captioned as such.
 *
 * The pure functions (settleStep, lightPosition, echoPatternFor,
 * matchEcho, suggestSettling, glideStep, openingLine, witnessLine,
 * childModeHere) carry no DOM dependency and are unit-tested in
 * tests/manifest-spark.test.js.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.CodexManifestSpark = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function () {
    "use strict";

    const VERSION = "manifest-spark/1.0.0";

    const SETTLE_TARGET = 0.8;
    const SETTLE_SUSTAIN_SECONDS = 3;
    const MIN_OBSERVATIONS = 2;
    const GLIDE_MAX_TRAVEL_HZ = 36;

    const XI_CAPTION =
      "Ξ is the console's coherence estimate — the console's own number, not a measurement of you.";

    const SPARK_STORAGE_KEY = "sof.spark.v1";
    const MEMORY_KEY = "sof.spark.memory.v1";

    /* ------------------------- pure helpers ------------------------- */

    function clamp01(value) {
      const n = Number(value);
      if (!Number.isFinite(n)) return 0;
      return Math.max(0, Math.min(1, n));
    }

    function finiteOrNull(value) {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }

    function cleanText(value, max = 1000) {
      if (typeof value !== "string") return "";
      return value.replace(/\s+/g, " ").trim().slice(0, max);
    }

    /**
     * One step of the settle dynamics. Settle rises while the keeper
     * follows the light (touch near it) and while breath pacing runs;
     * it eases back slowly otherwise. Deterministic — the same inputs
     * always give the same next value.
     */
    function settleStep(settle, input = {}) {
      const dt = Math.max(0, Math.min(5, Number(input.dtSeconds) || 0));
      let next = clamp01(settle);

      const rising =
        (input.following ? 0.055 : 0) + (input.breathing ? 0.035 : 0);

      if (rising > 0) {
        next += rising * dt;
      } else {
        next -= 0.018 * dt;
      }

      return clamp01(next);
    }

    /**
     * The guide light's position, normalized 0..1 across the field.
     * A slow lissajous the keeper can follow with a finger or a gaze;
     * reduced motion parks it at the centre.
     */
    function lightPosition(tSeconds, { reducedMotion = false } = {}) {
      if (reducedMotion) return { x: 0.5, y: 0.5 };

      const t = Math.max(0, Number(tSeconds) || 0);

      return {
        x: 0.5 + 0.32 * Math.sin(t * 0.11),
        y: 0.5 + 0.28 * Math.sin(t * 0.073 + 1.3)
      };
    }

    /* A tiny deterministic hash + RNG for the day-seeded echo used
       when this device holds no Spark record yet. */
    function hashString(text) {
      let h = 2166136261;
      const s = String(text || "");

      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
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

    /**
     * The Echo Duet pattern for a round. With a Spark companion, the
     * pattern is the Spark's own (SparkCompanion.echoFor — seed-born
     * pads and steps). Without one, the pattern is dealt from the
     * Pattern Day itself: same day, same echo, for every keeper.
     */
    function echoPatternFor({ companion = null, patternDay = null, round = 1 } = {}, sparkCompanion = null) {
      const r = Math.max(1, Math.floor(round) || 1);
      const Core =
        sparkCompanion ||
        (typeof globalThis !== "undefined" ? globalThis.SparkCompanion : null);

      if (companion && Core && typeof Core.echoFor === "function") {
        const echo = Core.echoFor({ companion, round: r });
        if (echo && Array.isArray(echo.steps) && echo.steps.length) {
          return { pads: echo.pads, steps: echo.steps, round: r, source: "spark" };
        }
      }

      const ratios = [1, 1.122, 1.335, 1.587];
      const pads = ratios.map((ratio, i) => ({
        note: Math.round(432 * ratio),
        color: `hsl(${190 + i * 38} 72% 62%)`
      }));

      const rand = mulberry32(hashString(`teach-echo:${patternDay ?? "outside"}:${r}`));
      const length = Math.min(9, 2 + r);
      const steps = [];

      for (let i = 0; i < length; i++) steps.push(Math.floor(rand() * 4));

      return { pads, steps, round: r, source: "day" };
    }

    /**
     * Score the keeper's answer against the pattern. Taps are matched
     * as a strict sequence — the duet is a listening game — and the
     * result says how much of the pattern was answered truly.
     */
    function matchEcho(pattern, taps) {
      const steps = Array.isArray(pattern?.steps) ? pattern.steps : [];
      const answers = Array.isArray(taps) ? taps : [];

      let matched = 0;

      while (
        matched < steps.length &&
        matched < answers.length &&
        answers[matched] === steps[matched]
      ) {
        matched += 1;
      }

      return {
        matched,
        total: steps.length,
        complete: steps.length > 0 && matched === steps.length,
        failedAt: matched < steps.length && matched < answers.length ? matched : null
      };
    }

    /**
     * The learning proposal. Reads sealed practice sessions (the
     * manifest-practice record shape) and, where a carrier + visual
     * mode pairing has settled the keeper in at least
     * MIN_OBSERVATIONS sittings, proposes the pairing with the lowest
     * mean time-to-settle. Pure: it proposes; it never applies.
     */
    function suggestSettling(records = []) {
      const groups = new Map();

      for (const record of Array.isArray(records) ? records : []) {
        if (!record || record.subtype !== "practice-session") continue;

        const mp = record.payload?.manifestPractice;
        const spark = mp?.spark;

        if (!mp || !spark) continue;

        /* An unsettled sitting stores null — Number(null) would read
           it as "settled in 0 seconds" and poison the proposal. */
        const seconds =
          spark.secondsToSettle == null
            ? null
            : finiteOrNull(spark.secondsToSettle);
        if (seconds === null || seconds < 0) continue;

        const carrier = (Array.isArray(mp.carriersHz) ? mp.carriersHz : [])
          .map(finiteOrNull)
          .filter(value => value !== null && value > 0)
          .sort((a, b) => a - b)[0];

        if (carrier === undefined) continue;

        const modeValue =
          mp.visualMode && typeof mp.visualMode === "object"
            ? cleanText(mp.visualMode.value || "", 40)
            : "";
        const modeLabel =
          mp.visualMode && typeof mp.visualMode === "object"
            ? cleanText(mp.visualMode.label || "", 80)
            : "";

        const key = `${carrier}|${modeValue}`;

        if (!groups.has(key)) {
          groups.set(key, {
            carrierHz: carrier,
            visualModeValue: modeValue || null,
            visualModeLabel: modeLabel || null,
            totalSeconds: 0,
            sessions: 0
          });
        }

        const group = groups.get(key);
        group.totalSeconds += seconds;
        group.sessions += 1;
      }

      let best = null;

      for (const group of groups.values()) {
        if (group.sessions < MIN_OBSERVATIONS) continue;

        const mean = group.totalSeconds / group.sessions;

        if (
          !best ||
          mean < best.meanSecondsToSettle ||
          (mean === best.meanSecondsToSettle && group.sessions > best.sessions)
        ) {
          best = { ...group, meanSecondsToSettle: Math.round(mean) };
        }
      }

      if (!best) return null;

      return {
        carrierHz: best.carrierHz,
        visualModeValue: best.visualModeValue,
        visualModeLabel: best.visualModeLabel,
        sessions: best.sessions,
        meanSecondsToSettle: best.meanSecondsToSettle
      };
    }

    /**
     * One glide step for the carrier tone as settle rises: the tone
     * eases toward the sitting's home carrier, a few Hz at a time,
     * only once the keeper is genuinely settling. The caller bounds
     * total travel (GLIDE_MAX_TRAVEL_HZ) across the sitting.
     */
    function glideStep(currentHz, homeHz, settle) {
      const current = finiteOrNull(currentHz);
      const home = finiteOrNull(homeHz);

      if (current === null || home === null) return null;
      if (clamp01(settle) < 0.35) return null;

      const diff = home - current;
      if (Math.abs(diff) <= 1) return null;

      return current + Math.max(-3, Math.min(3, diff));
    }

    function sparkDisplayName(name) {
      const clean = cleanText(name || "", 80);
      return clean || "The Spark";
    }

    /** The Spark opens the sitting and speaks the intention back. */
    function openingLine({ sparkName = "", intention = "" } = {}) {
      const name = sparkDisplayName(sparkName);
      const line = cleanText(intention, 1000);

      if (line) {
        return (
          `${name} holds your intention with you: \u201C${line}\u201D ` +
          "Follow the light in the field, breathe with it, and seal when the sitting feels complete."
        );
      }

      return (
        `${name} is here to lead the sitting. ` +
        "Write your intention line above, and the Spark will speak it back and carry the light for you."
      );
    }

    /** The Spark witnesses the seal into the record. */
    function witnessLine({ sparkName = "", coordinateLabel = "", sessionKind = "" } = {}) {
      const name = sparkDisplayName(sparkName);
      const coordinate = cleanText(coordinateLabel, 200) || "today's coordinate";
      const kind = cleanText(sessionKind, 40) || "practice";

      return (
        `${name} witnessed the seal — ${coordinate} · ${kind}. ` +
        "The session rests in your Life Atlas, and its day carries the marker on the 13 Moons calendar and in the Sphere's day view."
      );
    }

    /** The proposal, in the Spark's voice. The keeper decides. */
    function proposalLine({ sparkName = "", suggestion = null } = {}) {
      if (!suggestion) return "";

      const name = sparkDisplayName(sparkName);
      const mode = suggestion.visualModeLabel
        ? ` with the ${suggestion.visualModeLabel} field`
        : "";

      return (
        `${name} has watched your sittings settle. ` +
        `Your fastest settling came at ${suggestion.carrierHz} Hz${mode} — ` +
        `about ${suggestion.meanSecondsToSettle} seconds across ${suggestion.sessions} sittings. ` +
        "Begin this sitting there? The choice stays yours."
      );
    }

    /**
     * The child-mode signal, mirrored from spark-app-bridge.js: the
     * Sphere core's answer first, then the keeper-memory mirror.
     */
    function childModeHere(storage, seed, sphereCore = null) {
      const Core =
        sphereCore ||
        (typeof globalThis !== "undefined" ? globalThis.SphereSparkCore : null);

      if (Core && typeof Core.childModeFor === "function" && storage) {
        try {
          return Boolean(Core.childModeFor(storage, seed));
        } catch {
          /* fall through to the mirror */
        }
      }

      if (!storage) return false;

      try {
        const clean = typeof seed === "string" ? seed.trim() : "";
        let raw = clean ? storage.getItem(`${MEMORY_KEY}:${clean}`) : null;
        if (!raw) raw = storage.getItem(MEMORY_KEY);
        if (!raw) return false;

        const parsed = JSON.parse(raw);
        return Boolean(parsed && parsed.childMode === true);
      } catch {
        return false;
      }
    }

    /* ------------------------- browser layer ------------------------- */

    function initBrowser() {
      if (typeof document === "undefined") return;

      const panel = document.getElementById("mpSparkPanel");
      if (!panel) return;

      const $ = id => document.getElementById(id);

      const els = {
        line: $("mpSparkLine"),
        begin: $("mpSparkBegin"),
        settleRead: $("mpSettleRead"),
        proposal: $("mpProposal"),
        proposalText: $("mpProposalText"),
        proposalUse: $("mpProposalUse"),
        proposalDismiss: $("mpProposalDismiss"),
        echo: $("mpEcho"),
        echoPads: $("mpEchoPads"),
        echoStatus: $("mpEchoStatus"),
        echoPlay: $("mpEchoPlay"),
        witness: $("mpWitnessLine"),
        guide: $("mpGuide"),
        trace: $("trace")
      };

      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      /* The keeper's Spark, when this device holds its record. */
      let sparkRecord = null;
      let companion = null;

      try {
        const raw = window.localStorage.getItem(SPARK_STORAGE_KEY);
        if (raw) sparkRecord = JSON.parse(raw);
      } catch {
        sparkRecord = null;
      }

      const Core =
        typeof globalThis !== "undefined" ? globalThis.SparkCompanion : null;

      if (sparkRecord?.seed && Core && typeof Core.generate === "function") {
        try {
          companion = Core.generate(sparkRecord.seed);
        } catch {
          companion = null;
        }
      }

      const sparkName =
        Core && typeof Core.displayName === "function"
          ? Core.displayName(sparkRecord, companion)
          : companion?.name || "";

      const childMode = childModeHere(
        window.localStorage,
        sparkRecord?.seed || null
      );

      /* ------------------------- session state ------------------------- */

      const session = {
        active: false,
        startedAt: 0,
        settle: 0,
        settlePeak: 0,
        settleSustain: 0,
        secondsToSettle: null,
        echoRounds: 0,
        ledBySpark: false,
        homeCarrierHz: null,
        glideTravelHz: 0,
        touch: { x: 0.5, y: 0.5, active: false, lastMoveAt: 0, speed: 0 },
        lastTickAt: 0
      };

      window.__sofManifestSession = () => ({
        active: session.active,
        durationSeconds: session.startedAt
          ? Math.max(
              0,
              Math.round(
                ((session.sealedAt || Date.now()) - session.startedAt) / 1000
              )
            )
          : null,
        settlePeak: Math.round(session.settlePeak * 100) / 100,
        secondsToSettle: session.secondsToSettle,
        echoRounds: session.echoRounds,
        ledBySpark: session.ledBySpark
      });

      window.__sofManifestSettle = () => (session.active ? session.settle : 0);

      window.__sofManifestTouch = () => ({
        x: session.touch.x,
        y: session.touch.y,
        active: session.active && session.touch.active
      });

      /* ------------------------- echo duet ------------------------- */

      let echo = null;
      let echoTaps = [];
      let echoPlaying = false;

      function currentPatternDay() {
        try {
          const temporal =
            globalThis.CodexManifestPractice?.coordinateForInstant?.(new Date());
          return temporal?.patternDay ?? null;
        } catch {
          return null;
        }
      }

      function renderEchoPads() {
        if (!els.echoPads || !echo) return;

        els.echoPads.replaceChildren();

        echo.pads.forEach((pad, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "mp-echo-pad";
          button.style.setProperty("--mp-pad", pad.color || "#7af3ff");
          button.textContent = `${pad.note} Hz`;
          button.setAttribute(
            "aria-label",
            `Echo pad ${index + 1}, ${pad.note} hertz`
          );
          button.addEventListener("click", () => answerPad(index, button));
          els.echoPads.appendChild(button);
        });
      }

      let audioCtx = null;

      function chirp(noteHz) {
        if (childMode) return;

        try {
          audioCtx =
            audioCtx ||
            new (window.AudioContext || window.webkitAudioContext)();

          if (audioCtx.state === "suspended") void audioCtx.resume();

          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          const now = audioCtx.currentTime;

          osc.frequency.value = noteHz;
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

          osc.connect(gain).connect(audioCtx.destination);
          osc.start(now);
          osc.stop(now + 0.55);
        } catch {
          /* The duet stays visual when audio is unavailable. */
        }
      }

      function flashPad(index, onMs = 420) {
        const button = els.echoPads?.children?.[index];
        if (!button) return;

        button.classList.add("is-lit");
        window.setTimeout(
          () => button.classList.remove("is-lit"),
          reducedMotion ? onMs * 1.6 : onMs
        );
      }

      function playPattern() {
        if (!echo || echoPlaying) return;

        echoPlaying = true;
        echoTaps = [];

        if (els.echoStatus) {
          els.echoStatus.textContent =
            "Listen — the Spark sounds the pattern…";
        }

        echo.steps.forEach((padIndex, i) => {
          window.setTimeout(
            () => {
              flashPad(padIndex);
              if (echo.pads[padIndex]) chirp(echo.pads[padIndex].note);

              if (i === echo.steps.length - 1) {
                echoPlaying = false;
                if (els.echoStatus) {
                  els.echoStatus.textContent =
                    "Your turn — answer on the pads.";
                }
              }
            },
            500 + i * (reducedMotion ? 900 : 620)
          );
        });
      }

      function startEchoRound(round) {
        echo = echoPatternFor({
          companion,
          patternDay: currentPatternDay(),
          round
        });
        echoTaps = [];
        renderEchoPads();

        if (els.echo) els.echo.hidden = false;

        playPattern();
      }

      function answerPad(index, button) {
        if (!echo || echoPlaying || !session.active) return;

        flashPad(index, 240);
        if (echo.pads[index]) chirp(echo.pads[index].note);

        echoTaps.push(index);
        const result = matchEcho(echo, echoTaps);

        if (result.complete) {
          session.echoRounds += 1;
          session.settle = clamp01(session.settle + 0.12);

          if (els.echoStatus) {
            els.echoStatus.textContent =
              `Round answered true — ${session.echoRounds} round${session.echoRounds === 1 ? "" : "s"} echoed. ` +
              "The Spark sounds a longer pattern when you are ready.";
          }

          window.setTimeout(() => startEchoRound(echo.round + 1), 1400);
          return;
        }

        if (result.failedAt !== null) {
          echoTaps = [];
          if (els.echoStatus) {
            els.echoStatus.textContent =
              "That path wandered — hear the pattern again and answer once more.";
          }
        }
      }

      /* ------------------------- guide light ------------------------- */

      const guideCtx = els.guide?.getContext?.("2d") || null;
      let rafId = 0;

      function fitGuide() {
        if (!els.guide || !els.trace) return;

        const rect = els.trace.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        els.guide.width = Math.max(320, Math.floor(rect.width * dpr));
        els.guide.height = Math.max(320, Math.floor(rect.height * dpr));
        guideCtx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      function drawGuide(nowMs) {
        if (!guideCtx || !els.guide || !els.trace) return;

        const w = els.trace.clientWidth || 600;
        const h = els.trace.clientHeight || 420;

        guideCtx.clearRect(0, 0, w, h);

        if (session.active) {
          const t = (nowMs - session.startedAt) / 1000;
          const pos = lightPosition(t, { reducedMotion });
          const x = pos.x * w;
          const y = pos.y * h;
          const radius = 14 + 26 * session.settle;

          const glow = guideCtx.createRadialGradient(x, y, 2, x, y, radius * 2.6);
          const hue = Number.isFinite(companion?.hue) ? companion.hue : 190;

          glow.addColorStop(0, `hsla(${hue}, 90%, 78%, ${0.55 + 0.3 * session.settle})`);
          glow.addColorStop(0.35, `hsla(${hue}, 85%, 62%, ${0.28 + 0.2 * session.settle})`);
          glow.addColorStop(1, "hsla(0, 0%, 0%, 0)");

          guideCtx.fillStyle = glow;
          guideCtx.beginPath();
          guideCtx.arc(x, y, radius * 2.6, 0, Math.PI * 2);
          guideCtx.fill();

          guideCtx.fillStyle = "rgba(255, 252, 240, 0.95)";
          guideCtx.beginPath();
          guideCtx.arc(x, y, Math.max(4, radius * 0.32), 0, Math.PI * 2);
          guideCtx.fill();

          session.light = pos;
        }

        if (session.touch.active) {
          const tx = session.touch.x * w;
          const ty = session.touch.y * h;

          guideCtx.strokeStyle = "rgba(244, 241, 232, 0.35)";
          guideCtx.lineWidth = 1.5;
          guideCtx.beginPath();
          guideCtx.arc(tx, ty, 16, 0, Math.PI * 2);
          guideCtx.stroke();
        }

        rafId = window.requestAnimationFrame(drawGuide);
      }

      /* Pointer following: touch and mouse both move the visual —
         the console leans toward the touch through __sofManifestTouch,
         and settle grows while the keeper stays near the light. */
      function onPointer(event) {
        if (!els.trace) return;

        const rect = els.trace.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        const now = performance.now();
        const dt = Math.max(1, now - (session.touch.lastMoveAt || now)) / 1000;

        session.touch.speed =
          Math.hypot(x - session.touch.x, y - session.touch.y) / dt;
        session.touch.x = Math.max(0, Math.min(1, x));
        session.touch.y = Math.max(0, Math.min(1, y));
        session.touch.active = true;
        session.touch.lastMoveAt = now;
      }

      /* ------------------------- settle loop ------------------------- */

      let settleTimer = 0;
      let glideTimer = 0;

      function breathIsPacing() {
        const hud = document.getElementById("hudBreath");
        const text = hud?.textContent || "";
        return /Breath:\s*(In|Hold|Out|Seal|Look)/.test(text);
      }

      function tickSettle() {
        if (!session.active) return;

        const now = performance.now();
        const dt = Math.min(2, (now - (session.lastTickAt || now)) / 1000);
        session.lastTickAt = now;

        let following = false;

        if (session.light && session.touch.active) {
          const distance = Math.hypot(
            session.touch.x - session.light.x,
            session.touch.y - session.light.y
          );
          following = distance < 0.16 && session.touch.speed < 1.4;
        }

        session.settle = settleStep(session.settle, {
          following,
          breathing: breathIsPacing(),
          dtSeconds: dt
        });
        session.settlePeak = Math.max(session.settlePeak, session.settle);

        if (session.settle >= SETTLE_TARGET) {
          session.settleSustain += dt;

          if (
            session.secondsToSettle === null &&
            session.settleSustain >= SETTLE_SUSTAIN_SECONDS
          ) {
            session.secondsToSettle = Math.round(
              (Date.now() - session.startedAt) / 1000
            );
          }
        } else {
          session.settleSustain = 0;
        }

        if (els.settleRead) {
          els.settleRead.textContent =
            `Settle: ${Math.round(session.settle * 100)}%` +
            (session.secondsToSettle !== null
              ? ` · settled in ${session.secondsToSettle}s`
              : "");
        }
      }

      /* The carrier glides toward the sitting's home carrier as the
         keeper settles — the tone settles with them. Bounded: small
         steps, and never more than GLIDE_MAX_TRAVEL_HZ in a sitting. */
      function tickGlide() {
        if (!session.active || session.homeCarrierHz === null) return;

        const toneNow = document.getElementById("toneNow");
        if (!/active/i.test(toneNow?.textContent || "")) return;

        const input = document.getElementById("freqInput");
        const slider = document.getElementById("freqSlider");
        const current = Number(input?.value || slider?.value);

        const next = glideStep(current, session.homeCarrierHz, session.settle);
        if (next === null) return;
        if (Math.abs(session.glideTravelHz + (next - current)) > GLIDE_MAX_TRAVEL_HZ) return;

        session.glideTravelHz += next - current;

        for (const el of [input, slider]) {
          if (!el) continue;
          el.value = String(Math.round(next));
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }

        document.getElementById("playFreq")?.click();
      }

      /* ------------------------- begin / witness ------------------------- */

      function beginSitting() {
        session.active = true;
        session.startedAt = Date.now();
        session.sealedAt = 0;
        session.settle = 0;
        session.settlePeak = 0;
        session.settleSustain = 0;
        session.secondsToSettle = null;
        session.echoRounds = 0;
        session.ledBySpark = true;
        session.glideTravelHz = 0;
        session.lastTickAt = performance.now();

        const freqInput = document.getElementById("freqInput");
        session.homeCarrierHz =
          finiteOrNull(Number(freqInput?.value)) || 432;

        const intention =
          document.getElementById("rmnLine")?.value || "";

        if (els.line) {
          els.line.textContent = openingLine({ sparkName, intention });
        }

        if (els.begin) {
          els.begin.textContent = "The sitting is open — the Spark is leading";
          els.begin.disabled = true;
        }

        if (els.witness) els.witness.textContent = "";

        startEchoRound(1);

        clearInterval(settleTimer);
        settleTimer = window.setInterval(tickSettle, 250);
        clearInterval(glideTimer);
        glideTimer = window.setInterval(tickGlide, 3000);
      }

      function endSitting() {
        session.active = false;
        session.sealedAt = Date.now();
        clearInterval(settleTimer);
        clearInterval(glideTimer);

        if (els.begin) {
          els.begin.textContent = "Begin the sitting with the Spark";
          els.begin.disabled = false;
        }
      }

      function onRecordsChanged(event) {
        const detail = event?.detail || {};
        if (detail.source !== "manifest-practice") return;
        if (!session.ledBySpark && !session.startedAt) return;

        const Practice = globalThis.CodexManifestPractice;
        let coordinate = "";

        try {
          const temporal = Practice?.coordinateForInstant?.(new Date());
          coordinate = temporal ? Practice.coordinateLabel(temporal) : "";
        } catch {
          coordinate = "";
        }

        if (els.witness) {
          els.witness.textContent = witnessLine({
            sparkName,
            coordinateLabel: coordinate,
            sessionKind:
              document.getElementById("mpKind")?.value || "practice"
          });
        }

        endSitting();
      }

      /* ------------------------- proposal ------------------------- */

      async function loadProposal() {
        const Helpers = globalThis.CodexRecordHelpers;
        if (!Helpers?.createRepositoryResolver) return;

        let records = [];

        try {
          const repository = await Helpers.createRepositoryResolver()();
          if (!repository) return;
          records = await repository.query({ subtype: "practice-session" });
        } catch {
          return;
        }

        const suggestion = suggestSettling(records);
        if (!suggestion || !els.proposal || !els.proposalText) return;

        els.proposalText.textContent = proposalLine({ sparkName, suggestion });
        els.proposal.hidden = false;

        els.proposalUse?.addEventListener(
          "click",
          () => {
            /* The keeper said yes — only now are settings applied. */
            const freqInput = document.getElementById("freqInput");
            const freqSlider = document.getElementById("freqSlider");

            for (const el of [freqInput, freqSlider]) {
              if (!el) continue;
              el.value = String(suggestion.carrierHz);
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
            }

            if (suggestion.visualModeValue) {
              const visMode = document.getElementById("visMode");
              if (visMode) {
                visMode.value = suggestion.visualModeValue;
                visMode.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }

            els.proposal.hidden = true;

            if (els.line) {
              els.line.textContent =
                "The sitting opens with the Spark's suggestion — " +
                `${suggestion.carrierHz} Hz${suggestion.visualModeLabel ? `, ${suggestion.visualModeLabel} field` : ""}. ` +
                "Change anything you like; the console is yours.";
            }
          },
          { once: true }
        );

        els.proposalDismiss?.addEventListener(
          "click",
          () => {
            els.proposal.hidden = true;
          },
          { once: true }
        );
      }

      /* ------------------------- wiring ------------------------- */

      if (els.line) {
        els.line.textContent = openingLine({
          sparkName,
          intention: document.getElementById("rmnLine")?.value || ""
        });
      }

      els.begin?.addEventListener("click", beginSitting);
      els.echoPlay?.addEventListener("click", playPattern);

      if (els.trace) {
        els.trace.addEventListener("pointermove", onPointer, { passive: true });
        els.trace.addEventListener("pointerdown", onPointer, { passive: true });
        els.trace.addEventListener("pointerleave", () => {
          session.touch.active = false;
        });
      }

      document.addEventListener("sof:life-atlas-records-changed", onRecordsChanged);
      window.addEventListener("sof:life-atlas-records-changed", onRecordsChanged);

      fitGuide();
      window.addEventListener("resize", fitGuide, { passive: true });

      rafId = window.requestAnimationFrame(drawGuide);

      void loadProposal();

      window.addEventListener(
        "pagehide",
        () => {
          cancelAnimationFrame(rafId);
          clearInterval(settleTimer);
          clearInterval(glideTimer);
        },
        { once: true }
      );
    }

    if (typeof document !== "undefined") {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initBrowser, { once: true });
      } else {
        initBrowser();
      }
    }

    return Object.freeze({
      VERSION,

      SETTLE_TARGET,
      MIN_OBSERVATIONS,
      GLIDE_MAX_TRAVEL_HZ,
      XI_CAPTION,
      SPARK_STORAGE_KEY,

      settleStep,
      lightPosition,
      echoPatternFor,
      matchEcho,
      suggestSettling,
      glideStep,
      openingLine,
      witnessLine,
      proposalLine,
      childModeHere
    });
  }
);
