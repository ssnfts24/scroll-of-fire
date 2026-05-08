/* Scroll of Fire — Remnant 13 Moons Engine
   System:
   - Year begins at first New Moon after Spring Equinox
   - 13 fixed moons of 28 days each
   - Remaining days after Moon 13 are outside the counted cycle
   - Visible lunar phase is shown separately
*/

(function () {
  "use strict";

  const MOONS = window.__MOONS__ || [];
  const $ = (id) => document.getElementById(id);

  const TZ_DEFAULT = "America/Los_Angeles";
  const SYNODIC_MONTH = 29.530588853;
  const DAY_MS = 86400000;
  const YEAR_COUNTED_DAYS = 13 * 28;
  const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

  const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  let state = {
    date: new Date(),
    tz: TZ_DEFAULT
  };

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function localNoon(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  }

  function isoDate(date) {
    const d = localNoon(date);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function fromISO(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }

  function addDays(date, n) {
    const d = localNoon(date);
    d.setDate(d.getDate() + n);
    return localNoon(d);
  }

  function daysBetween(a, b) {
    return Math.floor((localNoon(b) - localNoon(a)) / DAY_MS);
  }

  function sameDate(a, b) {
    return isoDate(a) === isoDate(b);
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function fmtDate(date) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(date);
  }

  function springEquinoxDate(year) {
    return new Date(year, 2, 20, 12, 0, 0);
  }

  function approximateNewMoonAfter(date) {
    const target = localNoon(date).getTime();
    const synodicMs = SYNODIC_MONTH * DAY_MS;
    const cycles = Math.ceil((target - KNOWN_NEW_MOON) / synodicMs);
    return localNoon(new Date(KNOWN_NEW_MOON + cycles * synodicMs));
  }

  function remnantYearStart(date) {
    const y = date.getFullYear();
    const startThisYear = approximateNewMoonAfter(springEquinoxDate(y));
    return localNoon(date) >= startThisYear
      ? startThisYear
      : approximateNewMoonAfter(springEquinoxDate(y - 1));
  }

  function nextRemnantYearStart(date) {
    const start = remnantYearStart(date);
    return approximateNewMoonAfter(springEquinoxDate(start.getFullYear() + 1));
  }

  function remnantInfo(date) {
    const yearStart = remnantYearStart(date);
    const nextYearStart = nextRemnantYearStart(date);
    const counted = daysBetween(yearStart, date);
    const remainingYearDays = daysBetween(yearStart, nextYearStart) - YEAR_COUNTED_DAYS;

    if (counted < 0) {
      return {
        special: "before",
        label: "Before Remnant Year",
        detail: "This date falls before the year anchor.",
        yearStart,
        nextYearStart
      };
    }

    if (counted >= YEAR_COUNTED_DAYS) {
      return {
        special: "outside",
        label: "Outside Count",
        detail: `Intercalary / reset span after Moon 13. Extra days this year: ${Math.max(0, remainingYearDays)}.`,
        yearStart,
        nextYearStart,
        counted,
        dayOfYear: counted + 1
      };
    }

    const moonIndex = Math.floor(counted / 28) + 1;
    const dayInMoon = (counted % 28) + 1;
    const moon = MOONS[moonIndex - 1];

    return {
      special: null,
      yearStart,
      nextYearStart,
      counted,
      dayOfYear: counted + 1,
      moonIndex,
      dayInMoon,
      moon,
      moonStart: addDays(yearStart, (moonIndex - 1) * 28),
      moonEnd: addDays(yearStart, moonIndex * 28 - 1),
      extraDays: Math.max(0, remainingYearDays)
    };
  }

  function dateForMoonDay(yearStart, moonIndex, dayInMoon) {
    return addDays(yearStart, (moonIndex - 1) * 28 + (dayInMoon - 1));
  }

  function paintRing(info) {
    const arc = $("moonArc");
    if (!arc) return;

    const circumference = 316;

    if (info.special) {
      arc.style.strokeDashoffset = "0";
      return;
    }

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
      box.innerHTML = `
        <div class="r-doot">
          ${info.label}
          <span>${info.detail}</span>
        </div>
      `;
      return;
    }

    const grid = document.createElement("div");
    grid.className = "r-grid";

    ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"].forEach((x) => {
      const lbl = document.createElement("div");
      lbl.className = "r-lbl";
      lbl.textContent = x;
      grid.appendChild(lbl);
    });

    for (let week = 0; week < 4; week++) {
      for (let day = 1; day <= 7; day++) {
        const moonDay = week * 7 + day;

        const cell = document.createElement("div");
        cell.className = "r-day";
        if (moonDay === info.dayInMoon) cell.classList.add("is-today");

        const btn = document.createElement("button");
        btn.type = "button";
        btn.innerHTML = `<b>${moonDay}</b><small>W${week + 1} · D${day}</small>`;

        btn.addEventListener("click", () => {
          state.date = dateForMoonDay(info.yearStart, info.moonIndex, moonDay);
          paint();
        });

        cell.appendChild(btn);
        grid.appendChild(cell);
      }
    }

    box.innerHTML = "";
    box.appendChild(grid);
  }

  function paintGregorianCalendar(date) {
    const box = $("gregCal");
    if (!box) return;

    const y = date.getFullYear();
    const m = date.getMonth();
    const first = new Date(y, m, 1, 12, 0, 0);
    const last = new Date(y, m + 1, 0, 12, 0, 0);

    const grid = document.createElement("div");
    grid.className = "g-grid";

    WEEK.forEach((x) => {
      const lbl = document.createElement("div");
      lbl.className = "g-lbl";
      lbl.textContent = x;
      grid.appendChild(lbl);
    });

    for (let i = 0; i < first.getDay(); i++) {
      const pad = document.createElement("div");
      pad.className = "g-pad";
      grid.appendChild(pad);
    }

    for (let day = 1; day <= last.getDate(); day++) {
      const d = new Date(y, m, day, 12, 0, 0);
      const info = remnantInfo(d);

      const cell = document.createElement("div");
      cell.className = "g-day";

      if (sameDate(d, date)) cell.classList.add("is-today");
      if (info.special === "outside") cell.classList.add("is-outside");

      const btn = document.createElement("button");
      btn.type = "button";

      if (info.special) {
        btn.innerHTML = `<b>${day}</b><small>OUT</small>`;
        btn.title = info.detail;
      } else {
        btn.innerHTML = `<b>${day}</b><small>M${info.moonIndex} · D${info.dayInMoon}</small>`;
        btn.title = `Moon ${info.moonIndex}, Day ${info.dayInMoon}`;
      }

      btn.addEventListener("click", () => {
        state.date = d;
        paint();
      });

      cell.appendChild(btn);
      grid.appendChild(cell);
    }

    box.innerHTML = "";
    box.appendChild(grid);
  }

  function paintYearMap(date) {
    const tbody = $("yearMapBody");
    if (!tbody) return;

    const start = remnantYearStart(date);
    const next = nextRemnantYearStart(date);
    const yearLength = daysBetween(start, next);
    const extraDays = Math.max(0, yearLength - YEAR_COUNTED_DAYS);

    tbody.innerHTML = "";

    MOONS.forEach((moon, i) => {
      const s = addDays(start, i * 28);
      const e = addDays(start, i * 28 + 27);

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

    setText(
      "outsideInfo",
      `Year anchor: ${fmtDate(start)} · Next anchor: ${fmtDate(next)} · Outside-count days after Moon 13: ${extraDays}`
    );
  }

  function moonPhaseAge(date) {
    const days = (localNoon(date).getTime() - KNOWN_NEW_MOON) / DAY_MS;
    return ((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
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
    const illum = 0.5 * (1 - Math.cos((2 * Math.PI * age) / SYNODIC_MONTH));
    const name = phaseName(age);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#05070d";
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = "rgba(255,255,255,.35)";
      ctx.fillRect((i * 73) % w, (i * 41) % h, 1.2, 1.2);
    }

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#d8d6cc";
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    const offset = Math.cos((age / SYNODIC_MONTH) * Math.PI * 2) * r;
    ctx.fillStyle = "rgba(5,7,13,.78)";
    ctx.beginPath();
    ctx.ellipse(cx + offset, cy, r, r, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    ctx.strokeStyle = "rgba(122,243,255,.75)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    setText("phaseLine", `${name} · age ${age.toFixed(1)} days`);
    setText("phaseMeta", `${(illum * 100).toFixed(0)}% illuminated`);
  }

  function paintSky() {
    const c = $("skyBg");
    if (!c) return;

    const ctx = c.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      c.width = innerWidth * dpr;
      c.height = innerHeight * dpr;
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
    const info = remnantInfo(state.date);

    setText("nowDate", fmtDate(state.date));
    setText("nowTZ", state.tz);
    setText("nowClock", new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: state.tz
    }).format(new Date()));

    if (info.special) {
      setText("moonName", info.label);
      setText("moonEssence", info.detail);
      setText("moonLine", info.detail);
      setText("dayInMoon", "∞");
      setText("moonLength", "/OUT");
      setText("yearSpan", `Year anchor: ${fmtDate(info.yearStart)}`);
    } else {
      setText("moonName", `${info.moon.idx}. ${info.moon.name}`);
      setText("moonEssence", info.moon.essence);
      setText("moonLine", `Moon ${info.moonIndex} · Day ${info.dayInMoon}/28`);
      setText("dayInMoon", info.dayInMoon);
      setText("moonLength", "/28");
      setText("yearSpan", `Day ${info.dayOfYear}/364 · Anchor: ${fmtDate(info.yearStart)}`);
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
        setTimeout(() => ($("shareLink").textContent = "Copy Link"), 1200);
      }
    });

    const params = new URLSearchParams(location.search);
    if (params.get("date")) state.date = fromISO(params.get("date"));
    if (params.get("tz")) state.tz = params.get("tz");

    paint();
    setInterval(paint, 1000);
  }

  document.addEventListener("DOMContentLoaded", () => {
    try {
      setText("yr", new Date().getFullYear());
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
