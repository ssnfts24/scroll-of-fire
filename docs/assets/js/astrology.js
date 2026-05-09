/* Scroll of Fire — Astrology Correspondence Layer
   Reads the selected Gregorian date only.
   Does NOT overwrite the 13-Moon calendar engine.
*/
(function () {
  "use strict";

  const SIGNS = [
    { name: "Capricorn", element: "Earth", copy: "Discipline, structure, mountain path." },
    { name: "Aquarius", element: "Air", copy: "Signal, vision, living network." },
    { name: "Pisces", element: "Water", copy: "Dream, mercy, deep current." },
    { name: "Aries", element: "Fire", copy: "Ignition, courage, first flame." },
    { name: "Taurus", element: "Earth", copy: "Body, garden, faithful ground." },
    { name: "Gemini", element: "Air", copy: "Word, exchange, double witness." },
    { name: "Cancer", element: "Water", copy: "Home, memory, sacred shelter." },
    { name: "Leo", element: "Fire", copy: "Heart, radiance, royal courage." },
    { name: "Virgo", element: "Earth", copy: "Order, repair, clean vessel." },
    { name: "Libra", element: "Air", copy: "Balance, justice, measured scales." },
    { name: "Scorpio", element: "Water", copy: "Depth, hidden truth, transformation." },
    { name: "Sagittarius", element: "Fire", copy: "Arrow, pilgrimage, higher law." }
  ];

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    const panel = document.querySelector("[data-astrology-panel]");
    if (!panel) return;

    render();

    const datePick = document.getElementById("datePick");
    if (datePick) {
      datePick.addEventListener("change", render);
    }

    ["btnToday", "prevDay", "nextDay"].forEach(function (id) {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener("click", function () {
        setTimeout(render, 60);
      });
    });

    panel.classList.add("is-loaded");
  }

  function render() {
    const date = getCurrentDate();
    const sign = solarSign(date);
    const moonLine = document.getElementById("moonLine");
    const moonText = moonLine ? moonLine.textContent.trim() : "13-Moon Cadence";

    set("[data-solar-gate]", sign.name);
    set("[data-solar-copy]", sign.copy);
    set("[data-elemental-tone]", sign.element);
    set("[data-elemental-copy]", elementalCopy(sign.element));
    set("[data-moon-reflection]", moonText || "13-Moon Cadence");
    set("[data-moon-reflection-copy]", "Reflection follows the active Remnant Moon date from the main calendar engine.");
    set("[data-astro-status]", "Astrology correspondence loaded without changing the 13-Moon date engine.");
  }

  function getCurrentDate() {
    const input = document.getElementById("datePick");
    if (input && input.value) {
      const parts = input.value.split("-").map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
    }
    return new Date();
  }

  function solarSign(date) {
    const m = date.getMonth() + 1;
    const d = date.getDate();

    if ((m === 12 && d >= 22) || (m === 1 && d <= 19)) return SIGNS[0];
    if ((m === 1 && d >= 20) || (m === 2 && d <= 18)) return SIGNS[1];
    if ((m === 2 && d >= 19) || (m === 3 && d <= 20)) return SIGNS[2];
    if ((m === 3 && d >= 21) || (m === 4 && d <= 19)) return SIGNS[3];
    if ((m === 4 && d >= 20) || (m === 5 && d <= 20)) return SIGNS[4];
    if ((m === 5 && d >= 21) || (m === 6 && d <= 20)) return SIGNS[5];
    if ((m === 6 && d >= 21) || (m === 7 && d <= 22)) return SIGNS[6];
    if ((m === 7 && d >= 23) || (m === 8 && d <= 22)) return SIGNS[7];
    if ((m === 8 && d >= 23) || (m === 9 && d <= 22)) return SIGNS[8];
    if ((m === 9 && d >= 23) || (m === 10 && d <= 22)) return SIGNS[9];
    if ((m === 10 && d >= 23) || (m === 11 && d <= 21)) return SIGNS[10];
    return SIGNS[11];
  }

  function elementalCopy(element) {
    return {
      Fire: "Action, courage, ignition, and visible transformation.",
      Water: "Memory, mercy, intuition, cleansing, and emotional truth.",
      Earth: "Body, order, patience, stewardship, and grounded repair.",
      Air: "Word, signal, breath, learning, and clear exchange."
    }[element] || "Symbolic correspondence.";
  }

  function set(selector, text) {
    const el = document.querySelector(selector);
    if (el) el.textContent = text;
  }
})();
