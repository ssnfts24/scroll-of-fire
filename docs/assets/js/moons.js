/* Scroll of Fire — 13 Moons JS */

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

  function daysBetween(a, b) {
    const ms = startOfDay(b) - startOfDay(a);
    return Math.round(ms / 86400000);
  }

  function remnantYearStart(date) {
    const y = date.getFullYear();
    const candidate = new Date(y, 6, 26);
    return date >= candidate ? candidate : new Date(y - 1, 6, 26);
  }

  function isLeapDay(date) {
    return date.getMonth() === 1 && date.getDate() === 29;
  }

  function isDayOutOfTime(date) {
    return date.getMonth() === 6 && date.getDate() === 25;
  }

  function skippedLeapDaysBetween(start, date) {
    let count = 0;
    for (let d = new Date(start); d < startOfDay(date); d = addDays(d, 1)) {
      if (isLeapDay(d)) count++;
    }
    return count;
  }

  function moonInfo(date) {
    if (isDayOutOfTime(date)) {
      return {
        doot: true,
        moon: null,
        moonIndex: 0,
        dayInMoon: 0,
        dayOfYear: 365,
        yearStart: remnantYearStart(date)
      };
    }

    if (isLeapDay(date)) {
      return {
        leap: true,
        moon: null,
        moonIndex: 0,
        dayInMoon: 0,
        dayOfYear: null,
        yearStart: remnantYearStart(date)
      };
    }

    const start = remnantYearStart(date);
    let day = daysBetween(start, date) - skippedLeapDaysBetween(start, date);

    if (day < 0) day = 0;
    if (day > 363) day = 363;

    const moonIndex = Math.floor(day / 28) + 1;
    const dayInMoon = (day % 28) + 1;
    const moon = MOONS[moonIndex - 1];

    return {
      doot: false,
      leap: false,
      moon,
      moonIndex,
      dayInMoon,
      dayOfYear: day + 1,
      yearStart: start
    };
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

  function clearThemeClasses() {
    document.body.className = document.body.className
      .split(" ")
      .filter((c) => !/^theme-moon-/.test(c) && !/^daytone-/.test(c) && c !== "theme-doot")
      .join(" ");
  }

  function paintRing(info) {
    const arc = $("moonArc");
    if (!arc) return;

    if (info.doot || info.leap) {
      arc.style.strokeDashoffset = 0;
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
      if (!info.doot && !info.leap && i === info.dayInMoon) {
        dot.className = "is-today";
      }
      dot.title = `Day ${i}`;
      box.appendChild(dot);
    }
  }

  function paintRemnantCalendar(info) {
    const box = $("remCal");
    if (!box) return;

    if (info.doot) {
      box.innerHTML = `<div class="r-doot">Day Out of Time · July 25</div>`;
      return;
    }

    if (info.leap) {
      box.innerHTML = `<div class="r-doot">Leap Day · outside the 13×28 count</div>`;
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
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);
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
      const d = new Date(y, m, day);
      const cell = document.createElement("div");
      cell.className = "g-day";
      if (isoDate(d) === isoDate(date)) cell.classList.add("is-today");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = String(day);
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
      let s = addDays(start, i * 28);
      let e = addDays(s, 27);

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

    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.7);
    bg.addColorStop(0, "#111827");
    bg.addColorStop(1, "#05070d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 70; i++) {
      const x = (i * 73) % w;
      const y = (i * 41) % h;
      ctx.fillStyle = "rgba(255,255,255,.45)";
      ctx.fillRect(x, y, 1.2, 1.2);
    }

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#d8d6cc";
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    const shadowWidth = r * 2 * Math.abs(0.5 - illum);
    const shadowX = age < 14.765 ? cx - shadowWidth / 2 : cx + shadowWidth / 2;

    ctx.fillStyle = "rgba(5,7,13,.78)";
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.ellipse(shadowX, cy, Math.max(5, shadowWidth), r, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.globalCompositeOperation = "source-over";

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(122,243,255,.7)";
    ctx.lineWidth = 3;
    ctx.stroke();

    setText("phaseMeta", `${name} · ${(illum * 100).toFixed(0)}% illuminated`);
    setText("phaseLine", `${name} · age ${age.toFixed(1)} days`);
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

    const stars = Array.from({ length: 120 }, (_, i) => ({
      x: (i * 97) % innerWidth,
      y: (i * 53) % innerHeight,
      r: ((i % 3) + 1) * 0.45,
      a: 0.25 + (i % 7) / 12
    }));

    function draw() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      stars.forEach((s, i) => {
        ctx.globalAlpha = s.a + Math.sin(Date.now() / 900 + i) * 0.15;
        ctx.fillStyle = "#ffffff";
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

    select.innerHTML = zones
      .map((z) => `<option value="${z}">${z}</option>`)
      .join("");

    select.value = state.tz;
  }

  function paint() {
    const info = moonInfo(state.date);

    clearThemeClasses();

    if (info.doot) {
      document.body.classList.add("theme-doot");
    } else if (!info.leap) {
      document.body.classList.add(`theme-moon-${info.moonIndex}`);
      document.body.classList.add(`daytone-${info.dayInMoon}`);
    }

    setText("nowDate", fmtDate(state.date));
    setText("nowTZ", state.tz);
    setText("nowClock", new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: state.tz
    }).format(new Date()));

    if (info.doot) {
      setText("moonLine", "Day Out of Time · July 25");
      setText("moonName", "Day Out of Time");
      setText("moonEssence", "Release · Reset · Prepare");
      setText("dayInMoon", "∞");
      setText("yearSpan", `Year began ${fmtDate(info.yearStart)}`);
    } else if (info.leap) {
      setText("moonLine", "Leap Day · outside the 13×28 count");
      setText("moonName", "Leap Day");
      setText("moonEssence", "Pause · Adjust");
      setText("dayInMoon", "↺");
      setText("yearSpan", `Year began ${fmtDate(info.yearStart)}`);
    } else {
      setText("moonLine", `Moon ${info.moonIndex} · Day ${info.dayInMoon}/28`);
      setText("moonName", `${info.moon.idx}. ${info.moon.name}`);
      setText("moonEssence", info.moon.essence);
      setText("dayInMoon", info.dayInMoon);
      setText("yearSpan", `Day ${info.dayOfYear} · Year began ${fmtDate(info.yearStart)}`);
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

    const datePick = $("datePick");
    if (datePick) {
      datePick.addEventListener("change", () => {
        if (datePick.value) {
          state.date = fromISO(datePick.value);
          paint();
        }
      });
    }

    const tzPick = $("tzPick");
    if (tzPick) {
      tzPick.addEventListener("change", () => {
        state.tz = tzPick.value || TZ_DEFAULT;
        paint();
      });
    }

    const today = $("btnToday");
    if (today) {
      today.addEventListener("click", () => {
        state.date = new Date();
        paint();
      });
    }

    const prev = $("prevDay");
    if (prev) {
      prev.addEventListener("click", () => {
        state.date = addDays(state.date, -1);
        paint();
      });
    }

    const next = $("nextDay");
    if (next) {
      next.addEventListener("click", () => {
        state.date = addDays(state.date, 1);
        paint();
      });
    }

    const reset = $("resetTZ");
    if (reset) {
      reset.addEventListener("click", () => {
        state.tz = TZ_DEFAULT;
        if ($("tzPick")) $("tzPick").value = TZ_DEFAULT;
        paint();
      });
    }

    const share = $("shareLink");
    if (share) {
      share.addEventListener("click", async () => {
        const url = new URL(location.href);
        url.searchParams.set("date", isoDate(state.date));
        url.searchParams.set("tz", state.tz);

        try {
          await navigator.clipboard.writeText(url.toString());
          share.textContent = "Copied ✓";
          setTimeout(() => (share.textContent = "Copy Link"), 1200);
        } catch {
          share.textContent = "Copy failed";
          setTimeout(() => (share.textContent = "Copy Link"), 1200);
        }
      });
    }

    const params = new URLSearchParams(location.search);
    if (params.get("date")) {
      state.date = fromISO(params.get("date"));
    }

    if (params.get("tz")) {
      state.tz = params.get("tz");
    }

    paint();
    setInterval(paint, 1000);
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
