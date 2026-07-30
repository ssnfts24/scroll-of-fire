(() => {
  "use strict";
  const $ = id => document.getElementById(id);

  function formatPattern(pattern) {
    if (!pattern) return "Pattern unavailable";
    if (pattern.isDayOutOfTime || pattern.isDeepTimeDay) return pattern.moonName;
    return `M${pattern.moon} ${pattern.moonName || ""} · D${pattern.day} · ${pattern.dayOfPatternYear}/364`;
  }

  function render() {
    const shell = $("moons-deep-time-events");
    if (!shell || !globalThis.DeepTimeSeasonalLedger) return;
    const year = Math.max(1000, Math.min(3000, Number($("moons-deep-time-year")?.value) || new Date().getUTCFullYear()));
    $("moons-deep-time-year").value = String(year);
    const annual = globalThis.DeepTimeSeasonalLedger.buildYear(year);
    shell.innerHTML = annual.events.map(event => `<article class="moons-deep-event">
      <span>${event.label}</span>
      <strong>${new Date(event.utcInstant).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</strong>
      <p>${formatPattern(event.pattern)}</p>
      <small data-confidence="${event.status}">${event.statusLabel} · ±${event.uncertaintyMinutes}m</small>
    </article>`).join("");
    const link = $("moons-deep-time-open");
    if (link) link.href = `living-time-sphere.html?mode=years&year=${encodeURIComponent(year)}&source=moons-deep-time`;
    const method = $("moons-deep-time-method");
    if (method) method.textContent = `${year >= 2014 && year <= 2026 ? "Stored March-equinox references are preferred where available; other events are computed." : "Seasonal events are computed and explicitly labeled with uncertainty."}`;
  }

  function init() {
    if (!$("moons-deep-time-console")) return;
    $("moons-deep-time-year").value = String(new Date().getUTCFullYear());
    $("moons-deep-time-year").addEventListener("change", render);
    $("moons-deep-time-prev").addEventListener("click", () => { $("moons-deep-time-year").value = String(Math.max(1000, Number($("moons-deep-time-year").value) - 1)); render(); });
    $("moons-deep-time-next").addEventListener("click", () => { $("moons-deep-time-year").value = String(Math.min(3000, Number($("moons-deep-time-year").value) + 1)); render(); });
    $("moons-deep-time-now").addEventListener("click", () => { $("moons-deep-time-year").value = String(new Date().getUTCFullYear()); render(); });
    render();
  }

  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
  globalThis.MoonsDeepTimeConsole = Object.freeze({ init, render });
})();
