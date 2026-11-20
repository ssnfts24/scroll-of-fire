/**
 * The Year Thread (Aaron, Nov 20, 2026) — today's place in the
 * year, and the keeper's Pattern-stamped trail through it.
 *
 * Any page carrying `<div data-year-thread>` gets the thread: a
 * single line of the year — 364 days in thirteen Moons — with
 * today standing in gold, the days the keeper has stood on (the
 * Living Trail) tied as knots, and the days a story chapter was
 * found tied brighter. Under it, one plain line says where today
 * stands. Everything is read from the trail and the canonical
 * calendar (PatternCalendar, through LivingTrail's stamp); the
 * thread keeps no clock and no record of its own.
 *
 * The model (threadModel) is pure and unit-tested in
 * tests/story-layer.test.js.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.YearThread = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function () {
    "use strict";

    const VERSION = "year-thread/1.0.0";

    function threadModel(trail, stamp) {
      if (!stamp || !stamp.patternYear) return null;
      const anchorYear = stamp.patternYear;
      const stood = new Set(
        (trail && trail.days && trail.days[String(anchorYear)]) || []
      );
      const finds = new Set();
      for (const find of Object.values((trail && trail.finds) || {})) {
        if (find && find.patternYear === anchorYear && find.patternDay) {
          finds.add(find.patternDay);
          stood.add(find.patternDay);
        }
      }
      return {
        anchorYear,
        today: stamp.outsideDay ? null : stamp.patternDay,
        moon: stamp.moon ?? null,
        moonDay: stamp.moonDay ?? null,
        outsideDay: Boolean(stamp.outsideDay),
        stoodDays: [...stood].filter(d => d >= 1 && d <= 364).sort((a, b) => a - b),
        findDays: [...finds].sort((a, b) => a - b)
      };
    }

    function draw(canvas, model) {
      const dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
      const width = canvas.clientWidth || 600;
      const height = 54;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      const midY = 30;
      const pad = 8;
      const span = width - pad * 2;
      const x = day => pad + ((day - 0.5) / 364) * span;

      /* The thread itself, moon by moon: thirteen segments, a
       * slightly longer tick at each Moon's first day. */
      ctx.strokeStyle = "rgba(212,175,55,0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pad, midY);
      ctx.lineTo(width - pad, midY);
      ctx.stroke();
      ctx.lineWidth = 1;
      for (let moon = 0; moon < 13; moon += 1) {
        const day = moon * 28 + 1;
        ctx.strokeStyle = "rgba(212,175,55,0.8)";
        ctx.beginPath();
        ctx.moveTo(x(day), midY - 8);
        ctx.lineTo(x(day), midY + 8);
        ctx.stroke();
      }

      /* Knots: the days the keeper stood on. */
      for (const day of model.stoodDays) {
        ctx.fillStyle = "#c9a227";
        ctx.beginPath();
        ctx.arc(x(day), midY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      /* Finds burn brighter. */
      for (const day of model.findDays) {
        ctx.fillStyle = "#ffe9a8";
        ctx.beginPath();
        ctx.arc(x(day), midY, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      /* Today stands in gold, with its Moon named under the line. */
      if (model.today) {
        ctx.fillStyle = "#ffd34d";
        ctx.strokeStyle = "#fff3c4";
        ctx.beginPath();
        ctx.arc(x(model.today), midY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(255,233,168,0.95)";
        ctx.font = "11px Georgia, serif";
        ctx.textAlign = "center";
        ctx.fillText(
          `Moon ${model.moon}`,
          Math.min(width - 30, Math.max(30, x(model.today))),
          midY + 24
        );
      }
    }

    function render(host) {
      const trailApi = typeof LivingTrail !== "undefined" ? LivingTrail : null;
      if (!trailApi) return;
      const stamp = trailApi.stampFor();
      const model = threadModel(trailApi.load(), stamp);
      host.classList.add("year-thread");
      host.replaceChildren();
      const canvas = document.createElement("canvas");
      canvas.setAttribute("role", "img");
      canvas.setAttribute(
        "aria-label",
        model
          ? `The year thread: day ${model.today ?? "—"} of 364, with ${model.stoodDays.length} days standing in your trail.`
          : "The year thread."
      );
      host.appendChild(canvas);
      const line = document.createElement("p");
      line.className = "year-thread-line";
      if (!model) {
        line.textContent = "The year thread could not be read — the calendar is unavailable on this page.";
      } else if (model.outsideDay) {
        line.textContent =
          `The Day Out of Time — the year stands still today, outside the 364 days. ${model.stoodDays.length} day${model.stoodDays.length === 1 ? "" : "s"} of the year stand in your trail.`;
      } else {
        line.textContent =
          `Day ${model.today} of 364 · Moon ${model.moon} · Day ${model.moonDay} — you stand here. ` +
          `${model.stoodDays.length} day${model.stoodDays.length === 1 ? "" : "s"} of this year stand in your trail` +
          (model.findDays.length
            ? `, ${model.findDays.length} of them the day a chapter of the Traveller's Road was found.`
            : ".");
      }
      host.appendChild(line);
      if (model) draw(canvas, model);
    }

    function init() {
      if (typeof document === "undefined") return;
      document.querySelectorAll("[data-year-thread]").forEach(host => render(host));
    }

    if (typeof document !== "undefined") {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
      } else {
        init();
      }
      /* A find recorded after the first render (the story layer
       * stamps asynchronously) re-draws the thread from the
       * trail as it now stands. */
      document.addEventListener("sof:trail-changed", init);
    }

    return { VERSION, threadModel, render };
  }
);
