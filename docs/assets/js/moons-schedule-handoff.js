(() => {
  "use strict";

  // The 13 Moons page Sphere has no planner of its own. The label manager's
  // "+ Schedule" tap dispatches sof:sphere-schedule-selected-day and then
  // looks for #living-planner-open, which exists only on the Observatory
  // page — so on the 13 Moons page the tap opened onto nothing. Catch it
  // here and hand the visitor to the Observatory with the same day named:
  // the Sphere page reads ?marker=day-N on load and selects that day, where
  // the same + Schedule button opens the planner on it. This mirrors the
  // homepage hand-off (PR #118, home-observatory-instrument.js) exactly —
  // same event, same marker, same destination.
  function normalizePatternDay(value) {
    const day = Math.trunc(Number(value));
    if (!Number.isFinite(day)) return null;
    return Math.max(1, Math.min(364, day));
  }

  document.addEventListener("sof:sphere-schedule-selected-day", (event) => {
    const patternDay = normalizePatternDay(event?.detail?.pattern?.dayOfPatternYear);
    const params = new URLSearchParams();
    if (patternDay) params.set("marker", `day-${patternDay}`);
    const query = params.toString();
    window.location.assign(`living-time-sphere.html${query ? `?${query}` : ""}#living-planner`);
  });
})();
