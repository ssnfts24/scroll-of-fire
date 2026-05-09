(function () {
  "use strict";

  const MOON_NAMES = [
    "Moon 1 · Seed Flame",
    "Moon 2 · Root Waters",
    "Moon 3 · Breath Gate",
    "Moon 4 · Stone Witness",
    "Moon 5 · Living Word",
    "Moon 6 · Fire Trial",
    "Moon 7 · Crown Balance",
    "Moon 8 · Deep Mirror",
    "Moon 9 · Return Path",
    "Moon 10 · Builder’s Hand",
    "Moon 11 · Star Remembrance",
    "Moon 12 · River of Signs",
    "Moon 13 · Completion Seal"
  ];

  const WEEK_NAMES = ["Week 1 · East", "Week 2 · South", "Week 3 · West", "Week 4 · North"];

  const SIGNS = [
    ["Capricorn", "Earth", "Discipline, structure, mountain path."],
    ["Aquarius", "Air", "Signal, vision, living network."],
    ["Pisces", "Water", "Dream, mercy, deep current."],
    ["Aries", "Fire", "Ignition, courage, first flame."],
    ["Taurus", "Earth", "Body, garden, faithful ground."],
    ["Gemini", "Air", "Word, exchange, double witness."],
    ["Cancer", "Water", "Home, memory, sacred shelter."],
    ["Leo", "Fire", "Heart, radiance, royal courage."],
    ["Virgo", "Earth", "Order, repair, clean vessel."],
    ["Libra", "Air", "Balance, justice, measured scales."],
    ["Scorpio", "Water", "Depth, hidden truth, transformation."],
    ["Sagittarius", "Fire", "Arrow, pilgrimage, higher law."]
  ];

  const PHASES = [
    ["New Moon", "Seed, silence, hidden beginning.", "●"],
    ["Waxing Crescent", "First light returning.", "◔"],
    ["First Quarter", "Decision, pressure, action.", "◐"],
    ["Waxing Gibbous", "Refinement before fullness.", "◕"],
    ["Full Moon", "Revelation, mirror, fullness.", "○"],
    ["Waning Gibbous", "Sharing the light received.", "◕"],
    ["Last Quarter", "Release, correction, clearing.", "◐"],
    ["Waning Crescent", "Rest, surrender, reset.", "◔"]
  ];

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    const dateInput = document.querySelector("[data-date-picker]");
    const params = new URLSearchParams(location.search);
    const fromUrl = params.get("date");

    let activeDate = fromUrl ? parseDate(fromUrl) : new Date();

    if (dateInput) {
      dateInput.value = toInputDate(activeDate);
      dateInput.addEventListener("change", function () {
        activeDate = parseDate(dateInput.value);
        render(activeDate);
      });
    }

    bind("[data-today]", function () {
      activeDate = new Date();
      if (dateInput) dateInput.value = toInputDate(activeDate);
      render(activeDate);
    });

    bind("[data-prev-day]", function () {
      activeDate.setDate(activeDate.getDate() - 1);
      if (dateInput) dateInput.value = toInputDate(activeDate);
      render(activeDate);
    });

    bind("[data-next-day]", function () {
      activeDate.setDate(activeDate.getDate() + 1);
      if (dateInput) dateInput.value = toInputDate(activeDate);
      render(activeDate);
    });

    bind("[data-copy-link]", function () {
      const url = new URL(location.href);
      url.searchParams.set("date", toInputDate(activeDate));
      navigator.clipboard?.writeText(url.toString());
    });

    render(activeDate);
  }

  function render(date) {
    const rem = getRemnantDate(date);
    const phase = getMoonPhase(date);
    const sign = getSolarSign(date);

    set("[data-gregorian-date]", date.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
    set("[data-timezone]", Intl.DateTimeFormat().resolvedOptions().timeZone || "Local");
    set("[data-remnant-date]", rem.outside ? "Outside Count · Reset Gate" : `${rem.moonName}, Day ${rem.day}`);
    set("[data-week-name]", rem.outside ? "Outside counted weeks" : WEEK_NAMES[rem.week - 1]);
    set("[data-moon-title]", rem.outside ? "Outside Count · Reset Gate" : rem.moonName);
    set("[data-moon-subtitle]", rem.outside ? "Intercalary space after the 13 counted moons." : `Day ${rem.day} of 28 · ${WEEK_NAMES[rem.week - 1]}`);
    set("[data-day-number]", rem.outside ? "—" : rem.day);

    set("[data-phase-name]", phase[0]);
    set("[data-phase-copy]", phase[1]);
    set("[data-phase-orb]", phase[2]);

    set("[data-solar-gate]", sign[0]);
    set("[data-solar-copy]", sign[2]);
    set("[data-elemental-tone]", sign[1]);
    set("[data-elemental-copy]", elementalCopy(sign[1]));
    set("[data-moon-reflection]", rem.outside ? "Reset Mirror" : `Moon ${rem.moon}`);
    set("[data-moon-reflection-copy]", rem.outside ? "Pause, review, and prepare the next cycle." : `${rem.moonName} · Day ${rem.day}.`);

    renderMoonGrid(rem);
    renderGregorianGrid(date);
    renderYearMap(date);

    const status = document.querySelector("[data-astro-status]");
    if (status) status.textContent = "Astrology correspondence loaded.";
  }

  function getRemnantDate(date) {
    const yearStart = getYearStart(date.getFullYear());
    let start = yearStart;

    if (date < yearStart) start = getYearStart(date.getFullYear() - 1);

    const dayIndex = Math.floor((stripTime(date) - stripTime(start)) / 86400000);

    if (dayIndex >= 364) {
      return { outside: true, dayIndex, start };
    }

    const moon = Math.floor(dayIndex / 28) + 1;
    const day = (dayIndex % 28) + 1;
    const week = Math.floor((day - 1) / 7) + 1;

    return {
      outside: false,
      start,
      dayIndex,
      moon,
      day,
      week,
      moonName: MOON_NAMES[moon - 1]
    };
  }

  function getYearStart(year) {
    return new Date(year, 2, 21);
  }

  function getMoonPhase(date) {
    const knownNewMoon = new Date(Date.UTC(2000, 0, 6, 18, 14));
    const diff = (date.getTime() - knownNewMoon.getTime()) / 86400000;
    const lunarAge = ((diff % 29.530588853) + 29.530588853) % 29.530588853;
    const index = Math.floor((lunarAge / 29.530588853) * 8) % 8;
    return PHASES[index];
  }

  function getSolarSign(date) {
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

  function renderMoonGrid(rem) {
    const el = document.querySelector("[data-moon-grid]");
    if (!el) return;

    el.innerHTML = "";

    for (let i = 1; i <= 28; i++) {
      const cell = document.createElement("div");
      cell.className = "moon-day";
      if (!rem.outside && i === rem.day) cell.classList.add("is-active");
      cell.textContent = i;
      el.appendChild(cell);
    }
  }

  function renderGregorianGrid(date) {
    const el = document.querySelector("[data-gregorian-grid]");
    if (!el) return;

    const year = date.getFullYear();
    const month = date.getMonth();
    const last = new Date(year, month + 1, 0).getDate();

    el.innerHTML = "";

    for (let d = 1; d <= last; d++) {
      const current = new Date(year, month, d);
      const rem = getRemnantDate(current);
      const cell = document.createElement("div");
      cell.className = "greg-day";
      if (d === date.getDate()) cell.classList.add("is-active");
      cell.innerHTML = `<strong>${d}</strong><span>${rem.outside ? "Outside" : `M${rem.moon} D${rem.day}`}</span>`;
      el.appendChild(cell);
    }
  }

  function renderYearMap(date) {
    const el = document.querySelector("[data-year-map]");
    if (!el) return;

    const rem = getRemnantDate(date);
    const start = rem.start || getYearStart(date.getFullYear());

    el.innerHTML = "";

    for (let i = 0; i < 13; i++) {
      const s = new Date(start);
      s.setDate(start.getDate() + i * 28);
      const e = new Date(s);
      e.setDate(s.getDate() + 27);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${MOON_NAMES[i]}</td>
        <td>${shortDate(s)}</td>
        <td>${shortDate(e)}</td>
      `;
      el.appendChild(tr);
    }
  }

  function elementalCopy(element) {
    return {
      Fire: "Action, courage, ignition, and visible transformation.",
      Water: "Memory, mercy, intuition, cleansing, and emotional truth.",
      Earth: "Body, order, patience, stewardship, and grounded repair.",
      Air: "Word, signal, breath, learning, and clear exchange."
    }[element] || "Aetheric correspondence.";
  }

  function bind(selector, fn) {
    const el = document.querySelector(selector);
    if (el) el.addEventListener("click", fn);
  }

  function set(selector, text) {
    const el = document.querySelector(selector);
    if (el) el.textContent = text;
  }

  function parseDate(value) {
    if (!value) return new Date();
    const parts = value.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function toInputDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function stripTime(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function shortDate(date) {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
})();
