/* Scroll of Fire — Optional Ephemeris Painter
   Safe helper. Does not block the 13-Moon astrology panel.
*/
(function () {
  "use strict";

  if (!window.__EPHEMERIS__) return;

  const eph = window.__EPHEMERIS__;
  const placements = eph.placements || {};
  const signs = eph.signs || {};

  function normDeg(value) {
    if (!Number.isFinite(value)) return null;
    let d = value % 360;
    if (d < 0) d += 360;
    return d;
  }

  function paintChips() {
    Object.entries(placements).forEach(function ([id, raw]) {
      const deg = normDeg(raw);
      const posEl = document.querySelector(`[data-pos="${id}"]`);
      const signEl = document.querySelector(`[data-sign="${id}"]`);

      if (posEl) posEl.textContent = deg === null ? "—" : `${Math.round(deg * 10) / 10}°`;
      if (signEl) signEl.textContent = signs[id] || "—";
    });
  }

  function paintWheel() {
    const wheel = document.querySelector("#astroWheel");
    if (!wheel) return;

    const dots = wheel.querySelectorAll("[data-dot]");
    const radius = 150;
    const centerX = 180;
    const centerY = 180;

    dots.forEach(function (node) {
      const id = node.getAttribute("data-dot");
      const deg = normDeg(placements[id]);
      if (deg === null) return;

      const rad = (deg - 90) * Math.PI / 180;
      node.setAttribute("cx", (centerX + radius * Math.cos(rad)).toFixed(2));
      node.setAttribute("cy", (centerY + radius * Math.sin(rad)).toFixed(2));
      node.setAttribute("data-deg", deg.toFixed(2));
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    try {
      paintChips();
      paintWheel();
    } catch (err) {
      console.warn("[astro-panel] optional ephemeris paint failed:", err);
    }
  });
})();
