(() => {
  "use strict";
  const VERSION = "living-time-sphere-everyday/1.0.0-b731";
  const MODE_KEY = "sof.living-time.emphasis.v1";

  const PRESETS = Object.freeze({
    calendar: "everydayCalendar",
    planning: "planningFocus",
    celestial: "celestialContext",
    seasons: "seasonalEnvironment"
  });

  function state() {
    return globalThis.LivingTimeSphereUi?.getState?.() || {};
  }

  function selectedDay() {
    return Math.max(1, Math.min(364, Number(state().selectedDayOfYear || 1)));
  }

  function select(day, source) {
    const normalized = ((Math.round(Number(day) || 1) - 1) % 364 + 364) % 364 + 1;
    globalThis.LivingTimeSphereUi?.selectDay?.(normalized, { source, focus: true, focusDistance: 1.82 });
  }

  function setEmphasis(name, { announce = true } = {}) {
    const preset = PRESETS[name] || PRESETS.calendar;
    const ok = globalThis.LivingTimeSphereUi?.applyLayerPreset?.(preset);
    if (!ok) return false;
    try { localStorage.setItem(MODE_KEY, name); } catch (_) {}
    document.querySelectorAll("[data-sphere-emphasis]").forEach(button => {
      const active = button.dataset.sphereEmphasis === name;
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.classList.toggle("is-active", active);
    });
    const status = document.getElementById("sphere-emphasis-status");
    if (status && announce) {
      const labels = {
        calendar: "Calendar emphasis: dates, Moons, week structure, Today and annual gates.",
        planning: "Planning emphasis: calendar and scheduled activity with celestial clutter reduced.",
        celestial: "Celestial emphasis: lunar, solar, planetary and Passage context around the calendar.",
        seasons: "Season emphasis: location, daylight, solar quarters and environment context."
      };
      status.textContent = labels[name] || labels.calendar;
    }
    return true;
  }

  function restoreEmphasis() {
    let name = "calendar";
    try { name = localStorage.getItem(MODE_KEY) || name; } catch (_) {}
    if (!PRESETS[name]) name = "calendar";
    document.querySelectorAll("[data-sphere-emphasis]").forEach(button => {
      const active = button.dataset.sphereEmphasis === name;
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.classList.toggle("is-active", active);
    });
  }

  function bind() {
    document.querySelectorAll("[data-sphere-emphasis]").forEach(button => {
      button.addEventListener("click", () => setEmphasis(button.dataset.sphereEmphasis));
    });
    document.getElementById("sphere-day-prev")?.addEventListener("click", () => select(selectedDay() - 1, "everyday-prev-day"));
    document.getElementById("sphere-day-next")?.addEventListener("click", () => select(selectedDay() + 1, "everyday-next-day"));
    document.getElementById("sphere-moon-prev")?.addEventListener("click", () => select(selectedDay() - 28, "everyday-prev-moon"));
    document.getElementById("sphere-moon-next")?.addEventListener("click", () => select(selectedDay() + 28, "everyday-next-moon"));
    document.getElementById("sphere-everyday-today")?.addEventListener("click", () => globalThis.LivingTimeSphereUi?.returnToToday?.({ source: "everyday-toolbar" }));
    restoreEmphasis();
  }

  globalThis.LivingTimeSphereEveryday = Object.freeze({ VERSION, PRESETS, setEmphasis, select });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();
})();
