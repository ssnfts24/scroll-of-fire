(function () {
  "use strict";

  function renderMoonBars() {
    if (!window.SOFCalendar) return;

    const bars = document.querySelectorAll("[data-moon-bar]");
    if (!bars.length) return;

    const q = new URLSearchParams(location.search);
    const tz = q.get("tz") || window.SOFCalendar.getTZ();
    const date = q.get("date") || q.get("d") || window.SOFCalendar.todayISO(tz);
    const pos = window.SOFCalendar.get13Moon(date, tz);

    bars.forEach(bar => {
      const day = bar.querySelector("[data-moon-day]");
      const moon = bar.querySelector("[data-moon-name]");
      const tone = bar.querySelector("[data-moon-tone]");
      const link = bar.querySelector("[data-moon-link]");
      const ring = bar.querySelector("[data-moon-ring]");

      if (day) day.textContent = pos.isDayOutOfTime ? "—" : `${pos.day}/28`;
      if (moon) moon.textContent = pos.isDayOutOfTime ? "Day Out of Time" : `${pos.moonName} Moon`;
      if (tone) tone.textContent = pos.isDayOutOfTime ? "Pause · Threshold" : `Tone ${pos.tone} · ${pos.toneName}`;
      if (link) link.href = `moons.html?date=${encodeURIComponent(date)}&tz=${encodeURIComponent(tz)}`;

      if (ring && !pos.isDayOutOfTime) {
        ring.style.setProperty("--moon-progress", `${Math.round((pos.day / 28) * 100)}%`);
        ring.setAttribute("aria-label", pos.label);
      }
    });

    window.dispatchEvent(new CustomEvent("sof:calendar-sync", { detail: pos }));
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", renderMoonBars)
    : renderMoonBars();

  window.SOFRenderMoonBars = renderMoonBars;
})();
