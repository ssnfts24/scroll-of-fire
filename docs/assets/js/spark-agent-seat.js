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

    const VERSION = "spark-agent-seat/1.0.0";
    const AGENT_URL = "/.netlify/functions/spark-agent";

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

      function say(who, text) {
        const p = document.createElement("p");
        p.className = who === "keeper" ? "spark-seat-line is-keeper" : "spark-seat-line is-spark";
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
          if (status.available === false || status.ceilingReached) {
            doorState = "ceiling";
            meter.textContent = "The talking door is closed for now — the month's talking ceiling is reached. On-device answers still work.";
          } else {
            doorState = "open";
            meter.textContent = `The talking door is open. This month: the Guide has used $${Number(m.guideUsd || 0).toFixed(2)} and Sparks $${Number(m.sparkUsd || 0).toFixed(2)} of the $${Number(m.ceilingUsd || 20).toFixed(0)} ceiling, shared.`;
          }
        } catch {
          doorState = "unavailable";
          meter.textContent = "The talking door is not reachable from here right now. On-device answers still work — ask about today, this page, or our days together.";
        }
      }

      async function ask() {
        const clean = input.value.trim();
        if (!clean) return;
        input.value = "";
        say("keeper", clean);
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
          const res = await fetch(AGENT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [...history, { role: "user", content: clean }],
              context: {
                spark: { name, kind: companion.kindName || companion.kind || "Spark", stage: stage.name },
                today: todayContext(),
                page: pageContext()
              }
            })
          });
          if (!res.ok) throw new Error("door");
          const data = await res.json();
          const reply = String(data.reply || data.text || "").trim();
          if (!reply) throw new Error("door");
          history.push({ role: "user", content: clean }, { role: "assistant", content: reply });
          say("spark", reply);
        } catch {
          doorState = "unavailable";
          say("spark", "The talking door did not answer just now. Nothing was lost — ask me something I can answer on this device, or try the door again later.");
        }
      }

      button.addEventListener("click", () => {
        const opening = panel.hidden;
        panel.hidden = !opening;
        button.setAttribute("aria-expanded", String(opening));
        if (opening) {
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

    return { VERSION, answerLocally };
  }
);
