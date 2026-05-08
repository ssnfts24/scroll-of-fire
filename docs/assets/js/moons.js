/* Scroll of Fire — 13 Moons JS
   Fixed: counted 13×28 dates, leap-day skip, Day Out of Time, year-map spans
*/

(function () {
  "use strict";

  const MOONS = window.__MOONS__ || [
    { idx: 1, name: "Magnetic", essence: "Unify · Purpose" },
    { idx: 2, name: "Lunar", essence: "Polarize · Challenge" },
    { idx: 3, name: "Electric", essence: "Activate · Service" },
    { idx: 4, name: "Self-Existing", essence: "Define · Form" },
    { idx: 5, name: "Overtone", essence: "Empower · Radiance" },
    { idx: 6, name: "Rhythmic", essence: "Organize · Equality" },
    { idx: 7, name: "Resonant", essence: "Channel · Attunement" },
    { idx: 8, name: "Galactic", essence: "Harmonize · Integrity" },
    { idx: 9, name: "Solar", essence: "Pulse · Intention" },
    { idx: 10, name: "Planetary", essence: "Perfect · Manifestation" },
    { idx: 11, name: "Spectral", essence: "Dissolve · Liberation" },
    { idx: 12, name: "Crystal", essence: "Dedicate · Cooperation" },
    { idx: 13, name: "Cosmic", essence: "Endure · Presence" }
  ];

  const $ = (id) => document.getElementById(id);
  const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const TZ_DEFAULT = "America/Los_Angeles";

  let state = {
    date: new Date(),
    tz: TZ_DEFAULT
  };

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function isoDate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function fromISO(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function sameDate(a, b) {
    return isoDate(a) === isoDate(b);
  }

  function fmtDate(date) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric"
    }).format(date);
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function isLeapDay(date) {
    return date.getMonth() === 1 && date.getDate() === 29;
  }

  function isDayOutOfTime(date) {
    return date.getMonth() === 6 && date.getDate() === 25;
  }

  function isCountedDay(date) {
    return !isLeapDay(date) && !isDayOutOfTime(date);
  }

  function remnantYearStart(date) {
    const y = date.getFullYear();
    const startThisYear = new Date(y, 6, 26, 12);
    return date >= startThisYear
      ? startThisYear
      : new Date(y - 1, 6, 26, 12);
  }

  function countedDaysSince(start, date) {
    let count = 0;
    for (let d = startOfDay(start); d < startOfDay(date); d = addDays(d, 1)) {
      if (isCountedDay(d)) count++;
    }
    return count;
  }

  function dateForCountedDay(yearStart, countedIndex) {
    let count = 0;
    for (let d = startOfDay(yearStart); ; d = addDays(d, 1)) {
      if (isCountedDay(d)) {
        if (count === countedIndex) return d;
        count++;
      }
    }
  }

  function moonInfo(date) {
    const yearStart = remnantYearStart(date);

    if (isDayOutOfTime(date)) {
      return {
        special: "doot",
        label: "Day Out of Time",
        detail: "July 25 · outside the 13×28 count",
        yearStart
      };
    }

    if (isLeapDay(date)) {
      return {
        special: "leap",
        label: "Leap Day",
        detail: "Feb 29 · skipped in the 13×28 count",
        yearStart
      };
    }

    const counted = countedDaysSince(yearStart, date);
    const moonIndex = Math.floor(counted / 28) + 1;
    const dayInMoon = (counted % 28) + 1;
    const moon = MOONS[moonIndex - 1];

    return {
      special: null,
      yearStart,
      counted,
      dayOfYear: counted + 1,
      moonIndex,
      dayInMoon,
      moon
    };
  }

  function paintRing(info) {
    const arc = $("moonArc");
    if (!arc) return;

    if (info.special) {
      arc.style.strokeDashoffset = "0";
      return;
    }

    const circumference = 316;
    const progress = info.dayInMoon / 28;
    arc.style.strokeDashoffset = String(circumference * (1 - progress));
  }

  function paintWeekDots(info) {
    const box = $("weekDots");
    if (!box) return;

    box.innerHTML = "";

    for (let i = 1; i <= 28; i++) {
      const dot = document.createElement("span");
      if (!info.special && i === info.dayInMoon) dot.className = "is-today";
      dot.title = `Moon day ${i}`;
      box.appendChild(dot);
    }
  }

  function paintRemnantCalendar(info) {
    const box = $("remCal");
    if (!box) return;

    if (info.special) {
      box.innerHTML = `<div class="r-doot">${info.label}<br><span>${info.detail}</span></div>`;
      return;
    }

    const grid = document.createElement("div");
    grid.className = "r-grid";

    ["1", "2", "3", "4", "5", "6", "7"].forEach((x) => {
      const lbl = document.createElement("div");
      lbl.className = "r-lbl";
      lbl.textContent = x;
      grid.appendChild(lbl);
    });

    for (let day = 1; day <= 28; day++) {
      const cell = document.createElement("div");
      cell.className = "r-day";
      if (day === info.dayInMoon) cell.classList.add("is-today");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = String(day);

      const targetCountedIndex = (info.moonIndex - 1) * 28 + (day - 1);
      btn.addEventListener("click", () => {
        state.date = dateForCountedDay(info.yearStart, targetCountedIndex);
        paint();
      });

      cell.appendChild(btn);
      grid.appendChild(cell);
    }

    box.innerHTML = "";
    box.appendChild(grid);
  }

  function paintGregorianCalendar(date) {
    const box = $("gregCal");
    if (!box) return;

    const y = date.getFullYear();
    const m = date.getMonth();
    const first = new Date(y, m, 1, 12);
    const last = new Date(y, m + 1, 0, 12);
    const startPad = first.getDay();

    const grid = document.createElement("div");
    grid.className = "g-grid";

    WEEK.forEach((x) => {
      const lbl = document.createElement("div");
      lbl.className = "g-lbl";
      lbl.textContent = x;
      grid.appendChild(lbl);
    });

    for (let i = 0; i < startPad; i++) {
      const padCell = document.createElement("div");
      padCell.className = "g-pad";
      grid.appendChild(padCell);
    }

    for (let day = 1; day <= last.getDate(); day++) {
      const d = new Date(y, m, day, 12);
      const info = moonInfo(d);

      const cell = document.createElement("div");
      cell.className = "g-day";

      if (sameDate(d, date)) cell.classList.add("is-today");
      if (info.special === "doot") cell.classList.add("is-doot");
      if (info.special === "leap") cell.classList.add("is-leap");

      const btn = document.createElement("button");
      btn.type = "button";

      if (info.special) {
        btn.innerHTML = `${day}<small>${info.special === "doot" ? "DOOT" : "LEAP"}</small>`;
        btn.title = info.detail;
      } else {
        btn.innerHTML = `${day}<small>M${info.moonIndex}·D${info.dayInMoon}</small>`;
        btn.title = `Moon ${info.moonIndex}, Day ${info.dayInMoon}`;
      }

      btn.addEventListener("click", () => {
        state.date = new Date(d);
        paint();
      });

      cell.appendChild(btn);
      grid.appendChild(cell);
    }

    box.innerHTML = "";
    box.appendChild(grid);
  }

  function paintYearMap(date) {
    const tbody =
      $("yearMapBody") ||
      document.querySelector("#yearMap tbody") ||
      document.querySelector(".year-map tbody");

    if (!tbody) return;

    const start = remnantYearStart(date);
    tbody.innerHTML = "";

    MOONS.forEach((moon, i) => {
      const startIndex = i * 28;
      const endIndex = startIndex + 27;

      const s = dateForCountedDay(start, startIndex);
      const e = dateForCountedDay(start, endIndex);

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${moon.idx}</td>
        <td>${moon.name}</td>
        <td>${moon.essence}</td>
        <td>${fmtDate(s)}</td>
        <td>${fmtDate(e)}</td>
      `;
      tbody.appendChild(row);
    });
  }

  function moonPhaseAge(date) {
    const knownNewMoon = new Date(Date.UTC(2000, 0, 6, 18, 14));
    const synodic = 29.530588853;
    const days = (date.getTime() - knownNewMoon.getTime()) / 86400000;
    return ((days % synodic) + synodic) % synodic;
  }

  function phaseName(age) {
    if (age < 1.85) return "New Moon";
    if (age < 5.54) return "Waxing Crescent";
    if (age < 9.23) return "First Quarter";
    if (age < 12.92) return "Waxing Gibbous";
    if (age < 16.61) return "Full Moon";
    if (age < 20.3) return "Waning Gibbous";
    if (age < 23.99) return "Last Quarter";
    if (age < 27.68) return "Waning Crescent";
    return "New Moon";
  }

  function paintMoonCanvas(date) {
    const c = $("simMoon");
    if (!c) return;

    const ctx = c.getContext("2d");
    const w = c.width;
    const h = c.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.35;

    const age = moonPhaseAge(date);
    const illum = 0.5 * (1 - Math.cos((2 * Math.PI * age) / 29.530588853));
    const name = phaseName(age);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#05070d";
    ctx.fillRect(0, 0, w, h);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#d8d6cc";
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    const phase = age / 29.530588853;
    const offset = Math.cos(phase * Math.PI * 2) * r;

    ctx.fillStyle = "rgba(5,7,13,.78)";
    ctx.beginPath();
    ctx.ellipse(cx + offset, cy, r, r, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(122,243,255,.7)";
    ctx.lineWidth = 3;
    ctx.stroke();

    setText("phaseMeta", `${name} · ${(illum * 100).toFixed(0)}% illuminated`);
  }

  function paintSky() {
    const c = $("skyBg");
    if (!c) return;

    const ctx = c.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      c.width = Math.floor(innerWidth * dpr);
      c.height = Math.floor(innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize);

    const stars = Array.from({ length: 110 }, (_, i) => ({
      x: (i * 97) % innerWidth,
      y: (i * 53) % innerHeight,
      r: ((i % 3) + 1) * 0.45,
      a: 0.25 + (i % 7) / 12
    }));

    function draw() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      stars.forEach((s, i) => {
        ctx.globalAlpha = s.a + Math.sin(Date.now() / 900 + i) * 0.15;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    }

    draw();
  }

  function populateTimezones() {
    const select = $("tzPick");
    if (!select) return;

    const zones = [
      "America/Los_Angeles",
      "America/Denver",
      "America/Chicago",
      "America/New_York",
      "UTC"
    ];

    select.innerHTML = zones.map((z) => `<option value="${z}">${z}</option>`).join("");
    select.value = state.tz;
  }

  function paint() {
    const info = moonInfo(state.date);

    setText("nowDate", fmtDate(state.date));
    setText("nowTZ", state.tz);

    if (info.special) {
      setText("moonLine", `${info.label} · ${info.detail}`);
      setText("moonName", info.label);
      setText("moonEssence", info.detail);
      setText("dayInMoon", info.special === "doot" ? "∞" : "↺");
      setText("yearSpan", `Year began ${fmtDate(info.yearStart)}`);
    } else {
      setText("moonLine", `Moon ${info.moonIndex} · Day ${info.dayInMoon}/28 · ${info.moon.name}`);
      setText("moonName", `${info.moon.idx}. ${info.moon.name}`);
      setText("moonEssence", info.moon.essence);
      setText("dayInMoon", info.dayInMoon);
      setText("yearSpan", `Day ${info.dayOfYear}/364 · Year began ${fmtDate(info.yearStart)}`);
    }

    const datePick = $("datePick");
    if (datePick) datePick.value = isoDate(state.date);

    paintRing(info);
    paintWeekDots(info);
    paintRemnantCalendar(info);
    paintGregorianCalendar(state.date);
    paintYearMap(state.date);
    paintMoonCanvas(state.date);
  }

  function bind() {
    populateTimezones();

    $("datePick")?.addEventListener("change", (e) => {
      if (e.target.value) {
        state.date = fromISO(e.target.value);
        paint();
      }
    });

    $("tzPick")?.addEventListener("change", (e) => {
      state.tz = e.target.value || TZ_DEFAULT;
      paint();
    });

    $("btnToday")?.addEventListener("click", () => {
      state.date = new Date();
      paint();
    });

    $("prevDay")?.addEventListener("click", () => {
      state.date = addDays(state.date, -1);
      paint();
    });

    $("nextDay")?.addEventListener("click", () => {
      state.date = addDays(state.date, 1);
      paint();
    });

    $("shareLink")?.addEventListener("click", async () => {
      const url = new URL(location.href);
      url.searchParams.set("date", isoDate(state.date));
      url.searchParams.set("tz", state.tz);

      try {
        await navigator.clipboard.writeText(url.toString());
        $("shareLink").textContent = "Copied ✓";
        setTimeout(() => ($("shareLink").textContent = "Copy Link"), 1200);
      } catch {
        $("shareLink").textContent = "Copy failed";
      }
    });

    const params = new URLSearchParams(location.search);
    if (params.get("date")) state.date = fromISO(params.get("date"));
    if (params.get("tz")) state.tz = params.get("tz");

    paint();
  }

  document.addEventListener("DOMContentLoaded", () => {
    try {
      paintSky();
      bind();
    } catch (err) {
      const b = $("errorBanner");
      if (b) {
        b.textContent = `Engine error: ${err.message}`;
        b.classList.add("show");
      }
      console.error(err);
    }
  });
})();
