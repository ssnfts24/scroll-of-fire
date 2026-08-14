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

  function mountMetrics(root=document) { root.querySelectorAll(SELECTOR).forEach(makeExpandable); }

  function mountAppBar() {
    const page = document.body;
    if (!page || document.querySelector(".living-app-dock")) return;
    const isMoons = /moons\.html$/.test(location.pathname);
    if (!isMoons) return;
    const dock = document.createElement("nav");
    dock.className = "living-app-dock";
    dock.setAttribute("aria-label", "Living Time app navigation");
    dock.innerHTML = `
      <a href="./moons.html#todayPanel" data-app-tab="today">Today</a>
      <a href="./living-time-sphere.html?view=today" data-app-tab="sphere">Sphere</a>
      <button type="button" data-app-tab="weather">Weather</button>
      <button type="button" data-app-tab="layers">Layers</button>
      <a href="./ledger.html" data-app-tab="records">Records</a>`;
    document.body.appendChild(dock);
    document.body.classList.add("has-living-app-dock");
    dock.querySelector("[data-app-tab='weather']")?.addEventListener("click", () => {
      document.querySelector("[data-sof-location-command], .sphere-field-section, #sphere-field-layer")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    dock.querySelector("[data-app-tab='layers']")?.addEventListener("click", () => {
      const settings = document.querySelector("#sphere-settings, details:has(#sphere-layers), .sphere-settings");
      if (settings?.tagName === "DETAILS") settings.open = true;
      settings?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function syncEnvironmentBadges(state) {
    const place = state?.place;
    document.querySelectorAll("[data-shared-environment-badge]").forEach(el => {
      el.textContent = place ? `${place.name || "Active place"} · ${state.classification || state.status}` : "Location not set";
      el.dataset.state = state?.status || "unavailable";
    });
  }

  function init() {
    mountMetrics();
    mountAppBar();
    globalThis.SofEnvironmentState?.subscribe?.(syncEnvironmentBadges);
    const observer = new MutationObserver(() => mountMetrics());
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
  globalThis.LivingTimeAppEnhancements = Object.freeze({ mountMetrics, mountAppBar });
})();
