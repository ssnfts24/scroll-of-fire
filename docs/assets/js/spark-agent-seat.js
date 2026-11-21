/**
 * The Spark agent seat, site-wide (Aaron's items, Nov 20, 2026).
 *
 * The Sphere has its own seat beside the instrument (sphere-
 * spark.js). This is the same seat for every other page the
 * Spark travels to: a keeper who has met their Spark can talk
 * with it anywhere on the site.
 *
 * Two voices, honestly labelled:
 *   - On-device answers, instant and free: today's Pattern
 *     coordinate, the keeper's days with their Spark, who the
 *     Spark is, the story chapters found — and place-aware
 *     answers about the very page the keeper is standing on
 *     (its title, its subject, its story chapter when it has
 *     one). These come from the record on this device and the
 *     canonical calendar, never from a guess.
 *   - The talking door: the same Spark seat the Sphere uses
 *     (/.netlify/functions/spark-agent), metered on its own
 *     line under the shared ceiling, fail-closed. When the door
 *     is shut — no key, ceiling reached, or this copy of the
 *     site cannot reach it — the seat says so plainly and the
 *     on-device answers keep working. The Codex Guide's seat is
 *     a different seat and is untouched by this module.
 *
 * The seat appears only when a Spark lives on this device; the
 * meeting itself belongs to the presence layer. The pure local
 * brain (answerLocally) is unit-tested in
 * tests/spark-agent-seat.test.js.
 *
 * Phase 1 of the Spark intelligence design (Nov 20, 2026) rides
 * on this seat without changing its shape: the first time a
 * keeper opens the panel, the seat lazy-loads the keeper mind
 * (spark-keeper-mind.js) — the router, the briefing, the memory
 * the Spark keeps on this device — which attaches through
 * SparkAgentSeat.attach and takes over the asking when it is
 * present. If the mind cannot load, the seat keeps answering
 * exactly as it did before: local brain first, then the door.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SparkAgentSeat = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function () {
    "use strict";

    const VERSION = "spark-agent-seat/1.1.0";
    const AGENT_URL = "/.netlify/functions/spark-agent";

    /* Phase 1 attach point: enhancers (the keeper mind) register
     * here and are applied to every seat already built and every
     * seat built later. An enhancer receives the seat's public
     * surface (panel, log, say, the door, the record) and may set
     * an ask handler that takes over the asking. */
    const enhancers = [];
    const builtApis = [];
    function attach(fn) {
      if (typeof fn !== "function") return;
      enhancers.push(fn);
      for (const api of builtApis) {
        try { fn(api); } catch { /* an enhancer never breaks the seat */ }
      }
    }

    /* ---------------- the local brain (pure) ------------------ */

    /**
     * ctx: {
     *   spark: { name, kindName, stageName } | null,
     *   daysTogether: number | null,
     *   today: { moon, moonDay, patternDay, moonName, civilDate } | null,
     *   page: { title, subject, chapterTitle } (place-aware),
     *   chaptersFound: number | null,
     *   chaptersTotal: number | null
     * }
     * Returns a string answer, or null when the question is
     * beyond the on-device brain (the door's work, if it is open).
     */
    function answerLocally(question, ctx) {
      const q = String(question || "").toLowerCase();
      if (!q.trim()) return null;
      const spark = ctx.spark || null;
      const name = spark ? spark.name : "your Spark";

      if (/\b(where am i|this page|what page|what is this place|where are we)\b/.test(q)) {
        const bits = [`You are standing on “${ctx.page.title}.”`];
        if (ctx.page.subject) bits.push(ctx.page.subject);
        if (ctx.page.chapterTitle) {
          bits.push(`The Traveller's Road has a chapter here: “${ctx.page.chapterTitle}.”`);
        }
        return bits.join(" ");
      }
      if (/\b(what day is it|today|what moon|pattern day)\b/.test(q) && ctx.today) {
        const t = ctx.today;
        return t.patternDay
          ? `Today is ${t.civilDate} — Moon ${t.moon}${t.moonName ? ` (${t.moonName})` : ""} · Day ${t.moonDay} · Pattern Day ${t.patternDay}, by the canonical calendar.`
          : `Today is ${t.civilDate} — the Day Out of Time, outside the 364-day count.`;
      }
      if (/\b(your name|who are you|what are you)\b/.test(q) && spark) {
        return `I am ${spark.name}, a ${spark.kindName} Spark, at the ${spark.stageName} stage. I was born of the day we met, from a seed that makes me exactly who I am — no update will ever change that.`;
      }
      if (/\b(how long|days together|how many days)\b/.test(q)) {
        if (ctx.daysTogether == null) return null;
        return `We have kept ${ctx.daysTogether} distinct day${ctx.daysTogether === 1 ? "" : "s"} together, counted from your record on this device.`;
      }
      if (/\b(story|chapter|traveller|traveler)\b/.test(q) && ctx.chaptersFound != null) {
        const total = ctx.chaptersTotal ? ` of its ${ctx.chaptersTotal} chapters` : " chapters";
        return `The Traveller's Road runs through the whole site, a chapter on each fitted page. You have found ${ctx.chaptersFound}${total} so far — the Traveller's Map shows the road and the days you found them, each stamped with its Pattern day.`;
      }
      if (/\b(help|what can you do|what can you answer)\b/.test(q)) {
        return `${name} can answer some things right here on your device: what day it is, where you are standing on the site, how many days we have kept together, and how the Traveller's Road is going. Anything deeper goes through the talking door when it is open — the seat will tell you honestly when it is not.`;
      }
      return null;
    }

    /* ------------------- browser seat ------------------------- */

    function readRecord(Core) {
      if (!Core?.STORAGE_KEY) return null;
      try {
        const raw = window.localStorage.getItem(Core.STORAGE_KEY);
        const record = raw ? JSON.parse(raw) : null;
        if (!record || !Core.parseSeed(record.seed)) return null;
        return record;
      } catch { return null; }
    }

    function pageContext() {
      const title = (document.title || "This page").replace(/\s*[—|·].*$/, "").trim() || "This page";
      const subject = document.querySelector('meta[name="description"]')?.content || "";
      const chapterTitle = document.querySelector(".story-chapter .story-title")?.textContent || null;
      return { title, subject, chapterTitle, path: location.pathname };
    }

    function todayContext() {
      const cal = typeof PatternCalendar !== "undefined" ? PatternCalendar : null;
      if (!cal?.fromCivilDate) return null;
      try {
        const s = cal.fromCivilDate({ date: new Date() });
        return {
          moon: s.moon ?? null,
          moonDay: s.day ?? null,
          patternDay: s.dayOfPatternYear ?? null,
          moonName: s.moonName ?? null,
          civilDate: s.civilDate ?? null
        };
      } catch { return null; }
    }

    function buildSeat(Core, record, companion) {
      if (document.querySelector("[data-spark-seat]")) return;
      const name = Core.displayName(record, companion);
      const stage = Core.stageOf(record, companion);
      const growth = Core.livingVoiceGrowthFor ? Core.livingVoiceGrowthFor({ record, companion }) : null;

      const host = document.createElement("div");
      host.className = "spark-seat";
      host.setAttribute("data-spark-seat", "");

      const button = document.createElement("button");
      button.type = "button";
      button.className = "spark-seat-button";
      button.textContent = `Talk with ${name}`;
      button.setAttribute("aria-expanded", "false");

      const panel = document.createElement("section");
      panel.className = "spark-seat-panel";
      panel.hidden = true;
      panel.setAttribute("aria-label", `Talk with ${name}`);

      const head = document.createElement("p");
      head.className = "spark-seat-head";
      head.textContent = `${name} · ${companion.kindName || companion.kind || "Spark"} · ${stage.name}`;
      panel.appendChild(head);

      const meter = document.createElement("p");
      meter.className = "spark-seat-meter";
      meter.textContent = "Checking the talking door…";
      panel.appendChild(meter);

      const log = document.createElement("div");
      log.className = "spark-seat-log";
      log.setAttribute("aria-live", "polite");
      panel.appendChild(log);

      const form = document.createElement("div");
      form.className = "spark-seat-form";
      const input = document.createElement("input");
      input.type = "text";
      input.className = "spark-seat-input";
      input.placeholder = `Ask ${name}…`;
      input.setAttribute("aria-label", `Ask ${name}`);
      const send = document.createElement("button");
      send.type = "button";
      send.className = "spark-seat-send";
      send.textContent = "Ask";
      form.append(input, send);
      panel.appendChild(form);

      host.append(button, panel);
      document.body.appendChild(host);

      const history = [];
      let doorState = "unknown"; // unknown | open | unavailable | ceiling
      let doorStatus = { tightening: "open", notice: "", meter: null };
      let askHandler = null;

      function say(who, text) {
        const p = document.createElement("p");
        p.className = who === "keeper"
          ? "spark-seat-line is-keeper"
          : who === "status"
            ? "spark-seat-line is-status"
            : "spark-seat-line is-spark";
        p.textContent = text;
        log.appendChild(p);
        log.scrollTop = log.scrollHeight;
      }

      function localCtx() {
        const trail = typeof LivingTrail !== "undefined" ? LivingTrail.load() : null;
        return {
          spark: { name, kindName: companion.kindName || companion.kind || "Spark", stageName: stage.name },
          daysTogether: growth ? growth.daysTogether : null,
          today: todayContext(),
          page: pageContext(),
          chaptersFound: trail ? Object.keys(trail.finds || {}).length : null,
          chaptersTotal: null
        };
      }

      async function checkDoor() {
        try {
          const res = await fetch(AGENT_URL, { method: "GET" });
          if (!res.ok) throw new Error("door");
          const status = await res.json();
          const m = status.meter || {};
          doorStatus = {
            tightening: status.tightening || (status.talkingEnabled === false ? "closed" : "open"),
            notice: status.notice || "",
            meter: m
          };
          if (status.talkingEnabled === false) {
            doorState = "ceiling";
            meter.textContent = status.notice || "The talking door is closed for now — the month's talking ceiling is reached. On-device answers still work.";
          } else {
            doorState = "open";
            const tighteningNote = doorStatus.tightening === "shortening" || doorStatus.tightening === "reserving"
              ? " The month's meter is climbing, so briefings run shorter and deep thinking is saved for what clearly needs it."
              : "";
            meter.textContent = `The talking door is open. This month: the Guide has used $${Number(m.guideUsd || 0).toFixed(2)} and Sparks $${Number(m.sparkUsd || 0).toFixed(2)} of the $${Number(m.ceilingUsd || 20).toFixed(0)} ceiling, shared.${tighteningNote}`;
          }
        } catch {
          doorState = "unavailable";
          doorStatus = { tightening: "open", notice: "", meter: null };
          meter.textContent = "The talking door is not reachable from here right now. On-device answers still work — ask about today, this page, or our days together.";
        }
      }

      /* One door call, shared by the seat's own asking and by the
       * keeper mind's flow: the visit's history and the page's
       * context ride along; a briefing and a tier ride only when
       * the mind supplies them. */
      async function askDoor({ userText, briefing, tier }) {
        const res = await fetch(AGENT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...history, { role: "user", content: userText }],
            context: {
              spark: { name, kind: companion.kindName || companion.kind || "Spark", stage: stage.name },
              today: todayContext(),
              page: pageContext(),
              ...(briefing ? { briefing } : {})
            },
            ...(tier ? { tier } : {})
          })
        });
        if (!res.ok) throw new Error("door");
        const data = await res.json();
        const reply = String(data.reply || data.text || "").trim();
        if (data.mode === "agent" && reply) {
          history.push({ role: "user", content: userText }, { role: "assistant", content: reply });
        }
        return data;
      }

      async function ask() {
        const clean = input.value.trim();
        if (!clean) return;
        input.value = "";
        say("keeper", clean);
        /* The keeper mind, when it has attached, takes the asking
         * from here — router, briefing, memory and all. If it
         * declines or stumbles, the seat's own answers carry on. */
        if (askHandler) {
          try {
            if (await askHandler(clean)) return;
          } catch { /* the seat's own path answers instead */ }
        }
        const local = answerLocally(clean, localCtx());
        if (local) { say("spark", local); return; }
        if (doorState === "unknown") await checkDoor();
        if (doorState !== "open") {
          say("spark", doorState === "ceiling"
            ? "That one needs the talking door, and the door is closed for now — the month's ceiling is reached. I can still answer about today, this page, our days together, and the story."
            : "That one needs the talking door, and I cannot reach it from here right now. I can still answer about today, this page, our days together, and the story.");
          return;
        }
        try {
          const data = await askDoor({ userText: clean });
          const reply = String(data.reply || data.text || "").trim();
          if (!reply) throw new Error("door");
          say("spark", reply);
        } catch {
          doorState = "unavailable";
          say("spark", "The talking door did not answer just now. Nothing was lost — ask me something I can answer on this device, or try the door again later.");
        }
      }

      /* The keeper mind is lazy: it loads the first time the
       * panel opens, from beside this script, at the same cache
       * stamp — so no page carries its weight for a keeper who
       * never opens the talk panel. If it cannot load, the seat
       * simply keeps its own answers (fail down, honestly). */
      let mindRequested = false;
      function ensureMind() {
        if (mindRequested || typeof SparkKeeperMind !== "undefined") return;
        mindRequested = true;
        const tag = document.querySelector('script[src*="spark-agent-seat.js"]');
        if (!tag) return;
        const script = document.createElement("script");
        script.src = tag.getAttribute("src").replace(/spark-agent-seat\.js/, "spark-keeper-mind.js");
        script.defer = true;
        document.head.appendChild(script);
      }

      button.addEventListener("click", () => {
        const opening = panel.hidden;
        panel.hidden = !opening;
        button.setAttribute("aria-expanded", String(opening));
        if (opening) {
          ensureMind();
          if (!log.childElementCount) {
            say("spark", `Here I am — ${name}, on this page with you. Ask me about today, about where you are standing, or anything deeper if the door is open.`);
          }
          if (doorState === "unknown") void checkDoor();
          input.focus();
        }
      });
      send.addEventListener("click", () => { void ask(); });
      input.addEventListener("keydown", event => {
        if (event.key === "Enter") { event.preventDefault(); void ask(); }
      });

      /* The seat's public surface, for the keeper mind. */
      const seatApi = {
        panel,
        log,
        formEl: form,
        input,
        name,
        record,
        companion,
        core: Core,
        say,
        localCtx,
        todayStamp: todayContext,
        seatAnswerLocally: (question) => answerLocally(question, localCtx()),
        askDoor,
        getDoorStatus: () => ({
          known: doorState !== "unknown",
          doorOpen: doorState === "open",
          tightening: doorStatus.tightening,
          notice: doorStatus.notice
        }),
        refreshDoor: checkDoor,
        setAskHandler: (fn) => { askHandler = typeof fn === "function" ? fn : null; },
        history
      };
      builtApis.push(seatApi);
      for (const fn of enhancers) {
        try { fn(seatApi); } catch { /* an enhancer never breaks the seat */ }
      }
    }

    function init() {
      if (typeof document === "undefined") return;
      const Core = typeof SparkCompanion !== "undefined" ? SparkCompanion : null;
      if (!Core) return;
      const record = readRecord(Core);
      if (!record) return; // no Spark on this device yet — the meeting is the presence's work
      const companion = Core.generate ? Core.generate(record.seed) : null;
      if (!companion) return;
      buildSeat(Core, record, companion);
    }

    if (typeof document !== "undefined") {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
      } else {
        init();
      }
    }

    return { VERSION, answerLocally, attach };
  }
);
