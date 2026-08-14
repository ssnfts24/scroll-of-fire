(() => {
  "use strict";

  const SELECTOR = ".home-living-sphere__telemetry li, .today-summary-stat, .sphere-today-grid > dt";
  const DETAILS = {
    "Moon": "The active 28-day Moon sector in the Pattern Calendar.",
    "Moon Day": "The exact day within the active 28-day Moon.",
    "Day of 364": "The selected position inside the 364 counted Pattern days.",
    "Pattern Year": "The Pattern year anchored at Moon 1 Day 1.",
    "Civil Date": "The civil-calendar date used to calculate this Pattern state.",
    "Lunar Phase": "The astronomical Moon phase, separate from the Pattern Moon.",
    "Solar": "The current solar-sign and elemental context used by this interface.",
    "Seasonal Gate": "Progress through the current equinox-to-solstice seasonal quarter.",
    "Passage": "Relationship between the March equinox and the Pattern Year Gate.",
    "Sunrise": "Local sunrise for the active place and selected live date.",
    "Sunset": "Local sunset for the active place and selected live date.",
    "Daylight": "The total local daylight duration for the selected live date.",
    "Weather": "Current or selected-time environmental conditions from the active provider.",
    "Witness Count": "Private local witness records currently available on this device.",
    "Active Quests": "Recurring personal quests that are active and not paused.",
    "Selected Day": "The Pattern day currently being inspected. It may differ from Today."
  };

  function labelFor(node) {
    return node.querySelector?.("strong, .label")?.textContent?.trim() || node.textContent.trim().split(/\n/)[0];
  }

  function makeExpandable(node) {
    if (node.dataset.appExpandable === "true") return;
    node.dataset.appExpandable = "true";
    const label = labelFor(node);
    const detail = document.createElement("span");
    detail.className = "living-metric-detail";
    detail.textContent = DETAILS[label] || "Open this metric in the Observatory for calculation, source, history, and Sphere-layer controls.";
    node.appendChild(detail);
    if (!node.hasAttribute("tabindex")) node.tabIndex = 0;
    node.setAttribute("aria-expanded", "false");
    const toggle = () => {
      const root = node.closest(".home-living-sphere__telemetry, .today-summary-stats, .sphere-today-grid") || document;
      root.querySelectorAll("[data-app-expandable='true'].is-expanded").forEach(other => {
        if (other !== node) { other.classList.remove("is-expanded"); other.setAttribute("aria-expanded", "false"); }
      });
      const next = !node.classList.contains("is-expanded");
      node.classList.toggle("is-expanded", next);
      node.setAttribute("aria-expanded", String(next));
    };
    node.addEventListener("click", toggle);
    node.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); }
      if (event.key === "Escape") { node.classList.remove("is-expanded"); node.setAttribute("aria-expanded", "false"); }
    });
  }

  function mountMetrics(root = document) {
    root.querySelectorAll(SELECTOR).forEach(makeExpandable);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => mountMetrics(), { once: true });
  else mountMetrics();

  globalThis.LivingTimeSphereMetrics = Object.freeze({ mountMetrics });
})();

