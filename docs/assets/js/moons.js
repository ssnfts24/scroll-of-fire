/* ========================================================================
   Scroll of Fire — 13 Moons / Living Clock Engine
   File: assets/js/moons.js
   Version: v4.3 Remnant (2025-11-01)
   - Mini-moonbar sync (stroke dash parity)
   - Share Card (PNG) generator with graceful fallbacks
   - Practice prompts per moon + week
   - Kin wiring (opts) + DOOT/Leap clarity
   - Safe a11y/key handling; mobile/sticky compat
   ======================================================================== */
(function () {
  "use strict";

  /* --------------------------- Tiny Utils -------------------------------- */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const on = (t, e, f, o) => t && t.addEventListener(e, f, o);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pad = n => String(n).padStart(2, "0");
  const prefersReduced = () => (typeof matchMedia === "function") && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const safe = fn => { try { return fn(); } catch (e) { console.warn("[Moons]", e); } };
  const lerp = (a,b,t)=>a+(b-a)*t;

  /* ------------------------ Global State Hub ------------------------------ */
  const STATE = {
    tz: "UTC",
    hour: new Date().getHours(),
    selISO: null,
    illum: 0,
    sunAngle: 0,
    ringDashTarget: "0 316",
    lastTweenTs: 0,
    lastRingValue: 0,
    rafRing: 0,
    tickTimer: 0,
    icsURL: null,
    hidden: document.visibilityState === "hidden",
    dpr: Math.max(1, Math.round(window.devicePixelRatio || 1))
  };

  /* ---------------------------- IDs / Refs -------------------------------- */
  const refs = {
    tzPick: $("#tzPick"),
    datePick: $("#datePick"),
    hourScrub: $("#hourScrub"),
    nowDate: $("#nowDate"), nowClock: $("#nowClock"), nowTZ: $("#nowTZ"),
    moonName: $("#moonName"), moonEssence: $("#moonEssence"), dayInMoon: $("#dayInMoon"),
    moonChip: $("#moonChip"), moonLine: $("#moonLine"),
    yearSpan: $("#yearSpan"), dootWarn: $("#dootWarn"),
    ringArc: $("#moonArc"), ringArcMini: $("#moonArcMini"),
    weekDots: $("#weekDots"),
    numLine: $("#numLine"), numMeta: $("#numMeta"), energyQuote: $("#energyQuote"),
    phaseLine: $("#phaseLine"), phaseMeta: $("#phaseMeta"),
    mbName: $("#mbName"), mbEssence: $("#mbEssence"), mbDay: $("#mbDay"), mbYear: $("#mbYear"),
    skyBg: $("#skyBg"), simMoon: $("#simMoon"),
    yearMap: $("#yearMap tbody"), nextMoonInfo: $("#nextMoonInfo"),
    mbShareBtn: $("#btnShareImage"),
    openSeal: $("#openSeal"), openSealHeader: $("#openSealHeader"),
    jumpMoon: $("#jumpMoon"),
    dlICS: $("#dlICS"), regenICS: $("#regenICS"),
    kinOn: $("#kinOn"), kinEpoch: $("#kinEpoch"), kinSkipLeap: $("#kinSkipLeap"), kinSkipDOOT: $("#kinSkipDOOT"),
    kinBadge: $("#kinBadge"), kinLine: $("#kinLine"),
    practiceList: $("#practiceList"), noteText: $("#noteText"), saveNote: $("#btnSaveNote"),
    astroWheel: $("#astroWheel"), astroStamp: $("#astroStamp"), astroTZ: $("#astroTZ"), astroSource: $("#astroSource"),
    planetChips: $("#planetChips"), aspBody: $("#aspBody"),
    shareLink: $("#shareLink"), btnToday: $("#btnToday"), prevDay: $("#prevDay"), nextDay: $("#nextDay")
  };

  /* ---------------------------- Constants --------------------------------- */
  const MOONS = ["Magnetic","Lunar","Electric","Self-Existing","Overtone","Rhythmic","Resonant","Galactic","Solar","Planetary","Spectral","Crystal","Cosmic"];
  const MOON_ESSENCE = ["Attract purpose","Stabilize challenge","Activate service","Define form","Empower radiance","Balance equality","Channel inspiration","Harmonize integrity","Pulse intention","Perfect manifestation","Dissolve release","Dedicate cooperation","Endure presence"];
  const QUOTES = [
    "“Teach us to number our days, that we may apply our hearts unto wisdom.” — Psalm 90:12",
    "“For everything there is a season…” — Ecclesiastes 3:1",
    "“The light shines in the darkness…” — John 1:5",
    "“In quietness and trust is your strength.” — Isaiah 30:15",
    "“He heals the brokenhearted…” — Psalm 147:3"
  ];
  const COMMON_TZ = ["UTC","America/Los_Angeles","America/Denver","America/Chicago","America/New_York","Europe/London","Europe/Berlin","Europe/Helsinki","Africa/Johannesburg","Asia/Dubai","Asia/Kolkata","Asia/Shanghai","Asia/Tokyo","Australia/Sydney"];
  const TZ_KEY = "sof_moons_tz";
  const NOTES_KEY = "sof_moon_notes";

  /* --------------------------- Date / TZ Helpers -------------------------- */
  function dateInTZ(baseDate, tz, overrideHour) {
    try {
      const opts = { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" };
      const parts = new Intl.DateTimeFormat("en-CA", opts).formatToParts(baseDate);
      const m = Object.fromEntries(parts.map(p => [p.type, p.value]));
      const h = (overrideHour == null ? m.hour : pad(overrideHour));
      return new Date(`${m.year}-${m.month}-${m.day}T${h}:${m.minute}:${m.second}Z`);
    } catch {
      const d = new Date(baseDate);
      if (overrideHour != null) d.setUTCHours(overrideHour, 0, 0, 0);
      return d;
    }
  }
  const fmtDate = (d, tz) => safe(() => new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeZone: tz }).format(d))
    || new Intl.DateTimeFormat(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: tz }).format(d);
  const fmtShort = (d, tz) => safe(() => new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit", timeZone: tz }).format(d));
  const fmtTime = (d, tz) => safe(() => new Intl.DateTimeFormat(undefined, { timeStyle: "medium", timeZone: tz }).format(d))
    || new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: tz }).format(d);
  const utcTrunc = d => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const validDateStr = s => /^\d{4}-\d{2}-\d{2}$/.test(s);

  /* ---------------------------- 13-Moon Math ------------------------------ */
  const isLeapYear = y => (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
  const isLeapDayUTC = d => d.getUTCMonth() === 1 && d.getUTCDate() === 29;
  const isDOOT = (d, tz) => { const dt = dateInTZ(d, tz); return (dt.getUTCMonth() === 6 && dt.getUTCDate() === 25); };

  function startOfYear13(d, tz) {
    const dt = dateInTZ(d, tz);
    const y = dt.getUTCFullYear();
    const anchorThis = new Date(Date.UTC(y, 6, 26));
    const anchorPrev = new Date(Date.UTC(y - 1, 6, 26));
    return dt >= anchorThis ? anchorThis : anchorPrev;
  }

  function addDaysSkippingSpecials(start, n, tz) {
    let d = new Date(start); let moved = 0;
    const step = Math.sign(n) || 1;
    while (moved !== n) {
      d = new Date(d.getTime() + step * 86400000);
      if (isDOOT(d, tz) || isLeapDayUTC(d)) continue;
      moved += step;
    }
    return d;
  }

  function dayIndexSinceStart(d, tz) {
    const start = utcTrunc(startOfYear13(d, tz));
    const dt = utcTrunc(dateInTZ(d, tz));
    let days = Math.floor((dt - start) / 86400000);
    const doot = new Date(Date.UTC(start.getUTCFullYear() + 1, 6, 25));
    if (dt >= doot) days -= 1;
    for (let y = start.getUTCFullYear(); y <= dt.getUTCFullYear(); y++) {
      if (isLeapYear(y)) {
        const feb29 = new Date(Date.UTC(y, 1, 29));
        if (dt >= feb29 && start <= feb29) days -= 1;
      }
    }
    return days; // 0..363
  }

  function calc13Moon(d, tz) {
    if (isDOOT(d, tz)) {
      const s = startOfYear13(d, tz).getUTCFullYear();
      return { special: "Day Out of Time", year: `${s}/${s + 1}` };
    }
    if (isLeapDayUTC(dateInTZ(d, tz))) {
      const s = startOfYear13(d, tz).getUTCFullYear();
      return { special: "Leap Day", year: `${s}/${s + 1}` };
    }
    const idx = dayIndexSinceStart(d, tz);
    const moon = Math.floor(idx / 28) + 1;
    const day = (idx % 28) + 1;
    const s = startOfYear13(d, tz).getUTCFullYear();
    return { special: null, moon, day, year: `${s}/${s + 1}` };
  }

  function yearMoonSpans(anchor, tz) {
    const spans = []; let curStart = utcTrunc(anchor);
    for (let m = 1; m <= 13; m++) {
      const start = curStart;
      const end = utcTrunc(addDaysSkippingSpecials(start, 27, tz));
      spans.push({ m, name: MOONS[m - 1], essence: MOON_ESSENCE[m - 1], start, end });
      curStart = utcTrunc(addDaysSkippingSpecials(end, 1, tz));
    }
    return spans;
  }

  /* ------------------------- Moon Phase + Canvas -------------------------- */
  function moonPhase(d) {
    const syn = 29.530588853;
    const epoch = Date.UTC(2000, 0, 6, 18, 14);
    const days = (d - epoch) / 86400000;
    const frac = (days % syn + syn) % syn;
    const illum = 0.5 * (1 - Math.cos(2 * Math.PI * frac / syn));
    const angle = 2 * Math.PI * frac / syn;
    return { illum, angle, age: frac };
  }

  function sizeCanvasToDisplay(canvas, dpr = STATE.dpr) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
    }
  }

  function drawMoon(ctx, illum) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.clearRect(0, 0, W, H);
    const r = Math.min(W, H) * 0.42, cx = W / 2, cy = H / 2;

    // backdrop glow
    const g = ctx.createRadialGradient(cx, cy, r*0.2, cx, cy, r*1.2);
    g.addColorStop(0, "rgba(255,255,255,0.07)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r*1.15, 0, Math.PI*2); ctx.fill();

    // dark disk
    ctx.fillStyle = "#0b0f16";
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();

    // lit crescent/shape
    const k = clamp(illum, 0, 1);
    const flip = (k < 0.5) ? -1 : 1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(flip, 1);
    ctx.beginPath();
    ctx.arc(0, 0, r, -Math.PI/2, Math.PI/2, false);
    ctx.ellipse(0,0,r, Math.abs(r*(1-2*Math.abs(k-0.5))*2), 0, Math.PI/2, -Math.PI/2, true);
    ctx.closePath();
    ctx.fillStyle = "#cfd6e6";
    ctx.shadowColor = "rgba(255,255,255,.25)";
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.restore();

    // rim
    ctx.strokeStyle = "rgba(255,255,255,.08)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
  }

  /* -------------------------- Practice Prompts ---------------------------- */
  const PRACTICE = {
    weekTitles: ["Seed","Flow","Build","Crown"],
    byMoon(m){
      const e = MOON_ESSENCE[m-1] || "";
      return [
        `Name one action today to ${e.toLowerCase()}.`,
        "What must be released to keep rhythm?",
        "Where does service become joy (not duty)?",
        "Record one omen/sign you noticed."
      ];
    }
  };

  function populatePractices(moon, day){
    if (!refs.practiceList) return;
    const wk = Math.ceil(day/7);
    const items = PRACTICE.byMoon(moon);
    refs.practiceList.innerHTML = items.map((t,i)=>(
      `<li><b>${PRACTICE.weekTitles[wk-1] || "Week"}</b> — ${t}</li>`
    )).join("");
  }

  /* ------------------------------ Kin (opt) ------------------------------- */
  function kinOf(d, tz, opts) {
    if (!opts) return null;
    const base = dateInTZ(d, tz);
    const epoch = utcTrunc(new Date(opts.epoch + "T00:00:00Z"));
    let days = Math.floor((utcTrunc(base) - epoch) / 86400000);

    if (opts.skipLeap) {
      const y0 = epoch.getUTCFullYear();
      const y1 = base.getUTCFullYear();
      for (let y = y0; y <= y1; y++) {
        if (isLeapYear(y)) {
          const feb29 = new Date(Date.UTC(y, 1, 29));
          if (base >= feb29 && epoch <= feb29) days -= 1;
        }
      }
    }
    if (opts.skipDOOT) {
      const y0 = epoch.getUTCFullYear();
      const y1 = base.getUTCFullYear();
      for (let y = y0; y <= y1; y++) {
        const doot = new Date(Date.UTC(y, 6, 25));
        if (base >= doot) days -= 1;
      }
    }

    const kin = ((days % 260) + 260) % 260 + 1;
    const tones = ["Mag","Lun","Ele","Self","Over","Rhyth","Res","Gal","Sol","Plan","Spec","Crys","Cos"];
    const seals = ["Dragon","Wind","Night","Seed","Serpent","Worldbridger","Hand","Star","Moon","Dog","Monkey","Human","Skywalker","Wizard","Eagle","Warrior","Earth","Mirror","Storm","Sun"];
    const tone = (kin-1)%13 + 1, seal = (kin-1)%20;
    return { kin, tone, toneName: tones[tone-1], seal: seals[seal] };
  }

  /* ------------------------------- .ICS ----------------------------------- */
  function buildICS(anchor, tz) {
    const spans = yearMoonSpans(anchor, tz);
    const dt = s => new Date(s.getTime() - s.getTimezoneOffset()*60000).toISOString().replace(/[-:]/g,"").replace(/\.\d+Z/,"Z");
    const body = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Scroll of Fire//13 Moons//EN"];
    spans.forEach(s=>{
      body.push("BEGIN:VEVENT",
        `UID:${s.m}-${Date.now()}@scroll-of-fire`,
        `DTSTAMP:${dt(new Date())}`,
        `DTSTART:${dt(s.start)}`,
        `DTEND:${dt(addDaysSkippingSpecials(s.end,1,tz))}`,
        `SUMMARY:${s.m}. ${s.name} — ${s.essence}`,
        "END:VEVENT");
    });
    body.push("END:VCALENDAR");
    return new Blob([body.join("\r\n")], {type:"text/calendar"});
  }

  function refreshICS() {
    const anchorSrc = STATE.selISO ? new Date(STATE.selISO) : new Date();
    const anchor = startOfYear13(anchorSrc, STATE.tz);
    if (STATE.icsURL) { URL.revokeObjectURL(STATE.icsURL); STATE.icsURL = null; }
    const blob = buildICS(anchor, STATE.tz);
    const url = URL.createObjectURL(blob);
    STATE.icsURL = url;
    if (refs.dlICS) {
      refs.dlICS.href = url;
      refs.dlICS.download = `13-moons-${anchor.getUTCFullYear()}-${anchor.getUTCFullYear()+1}.ics`;
    }
  }

  /* --------------------------- Main Recompute ----------------------------- */
  const MOON_ACCENTS = [
    ["#7af3ff","#f3c97a"],["#a7d0ff","#ffd48a"],["#8df6cd","#ffe28a"],["#95b8ff","#e8c6ff"],
    ["#ffd47a","#c9a9ff"],["#9ef0ff","#ffd2b0"],["#a0ffde","#fff07a"],["#bac4ff","#a0ffe8"],
    ["#fff07a","#a0e0ff"],["#c8ff8a","#9ed0ff"],["#ffc7a0","#a7b1ca"],["#d6b8ff","#9bf0c7"],
    ["#f3c97a","#7af3ff"]
  ];

  function recolorByMoon(moon) {
    const root = document.documentElement;
    const pair = MOON_ACCENTS[(moon-1)%MOON_ACCENTS.length];
    root.style.setProperty("--moon-accent", pair[0]);
    root.style.setProperty("--moon-accent-2", pair[1]);
    document.dispatchEvent(new CustomEvent("sof:phase", {detail:{moon}}));
  }

  function setRingTargets(day) {
    const perim = 316;
    const seg = perim * (day / 28);
    STATE.ringDashTarget = `${seg} ${perim}`;
    STATE.lastRingValue = Math.max(0, Math.min(perim, parseFloat((refs.ringArc && refs.ringArc.getAttribute("stroke-dasharray")||"0 316").split(" ")[0]) || 0));
    if (refs.ringArcMini) refs.ringArcMini.setAttribute("stroke-dasharray", `${(seg/316)*163} 163`);
  }

  function tweenRing(ts) {
    if (!refs.ringArc) return;
    if (STATE.hidden || prefersReduced()) return;
    if (!STATE.lastTweenTs) STATE.lastTweenTs = ts;
    const perim = 316;
    const dt = clamp((ts - STATE.lastTweenTs)/420, 0, 1);
    const target = parseFloat(STATE.ringDashTarget.split(" ")[0]) || 0;
    const next = lerp(STATE.lastRingValue, target, dt*0.9);
    refs.ringArc.setAttribute("stroke-dasharray", `${next} ${perim}`);
    STATE.lastRingValue = next;
    STATE.lastTweenTs = ts;
    STATE.rafRing = requestAnimationFrame(tweenRing);
  }

  function stopRingTween() {
    if (STATE.rafRing) cancelAnimationFrame(STATE.rafRing);
    STATE.rafRing = 0;
    STATE.lastTweenTs = 0;
  }

  function populateYearMap(anchor, tz) {
    if (!refs.yearMap) return;
    const spans = yearMoonSpans(anchor, tz);
    refs.yearMap.innerHTML = spans.map(s => {
      return `<tr>
        <td>${s.m}</td>
        <td><span class="pill k">${s.name}</span></td>
        <td>${s.essence}</td>
        <td class="mono">${fmtShort(s.start, tz)}</td>
        <td class="mono">${fmtShort(s.end, tz)}</td>
      </tr>`;
    }).join("");
    const next = spans.find(x => x.start > anchor) || spans[0];
    if (refs.nextMoonInfo) refs.nextMoonInfo.textContent = `Next: ${next.name} starts ${fmtDate(next.start, tz)}.`;
  }

  function populateWeekDots(day) {
    if (!refs.weekDots) return;
    const w = Math.ceil(day / 7), pos = (day - 1) % 7 + 1;
    const dots = [];
    for (let i=1;i<=4;i++){
      dots.push(`<div class="weekcell ${i===w?'is-week':''}" data-week="${i}">
        ${[...Array(7)].map((_,d)=>`<span class="dot ${i===w && d+1===pos?'is-now':''}"></span>`).join("")}
      </div>`);
    }
    refs.weekDots.innerHTML = dots.join("");
  }

  function quoteFor(moon, day){
    if (!QUOTES.length) return "";
    const idx = ((moon + day) % QUOTES.length + QUOTES.length) % QUOTES.length;
    return QUOTES[idx];
  }

  function recompute() {
    const base = new Date();
    const d = STATE.selISO ? new Date(STATE.selISO) : base;
    const dt = dateInTZ(d, STATE.tz, STATE.hour);

    // Now line
    if (refs.nowDate) refs.nowDate.textContent = fmtDate(dt, STATE.tz);
    if (refs.nowClock) refs.nowClock.textContent = fmtTime(dt, STATE.tz);
    if (refs.nowTZ) refs.nowTZ.textContent = STATE.tz;

    // 13×28 mapping
    const info = calc13Moon(dt, STATE.tz);
    if (info.special) {
      if (refs.moonLine) refs.moonLine.textContent = info.special;
      if (refs.dootWarn) refs.dootWarn.style.display = "block";
      if (refs.dayInMoon) refs.dayInMoon.textContent = "—";
      if (refs.yearSpan) refs.yearSpan.textContent = info.year;
      if (refs.moonName) refs.moonName.textContent = "—";
      if (refs.moonEssence) refs.moonEssence.textContent = "—";
      if (refs.mbName) refs.mbName.textContent = "—";
      if (refs.mbEssence) refs.mbEssence.textContent = "—";
      if (refs.mbDay) refs.mbDay.textContent = "—";
      if (refs.mbYear) refs.mbYear.textContent = info.year;
      if (refs.ringArc) refs.ringArc.setAttribute("stroke-dasharray","0 316");
      if (refs.ringArcMini) refs.ringArcMini.setAttribute("stroke-dasharray","0 163");
      populateYearMap(startOfYear13(dt, STATE.tz), STATE.tz);
      stopRingTween();
      return;
    }

    if (refs.dootWarn) refs.dootWarn.style.display = "none";
    const name = MOONS[info.moon-1], ess = MOON_ESSENCE[info.moon-1];

    if (refs.moonName) refs.moonName.textContent = name;
    if (refs.moonEssence) refs.moonEssence.textContent = ess;
    if (refs.dayInMoon) refs.dayInMoon.textContent = info.day;
    if (refs.moonLine) refs.moonLine.textContent = `${name} — Day ${info.day} of 28`;
    if (refs.yearSpan) refs.yearSpan.textContent = info.year;
    if (refs.mbName) refs.mbName.textContent = name;
    if (refs.mbEssence) refs.mbEssence.textContent = ess;
    if (refs.mbDay) refs.mbDay.textContent = `${info.day}/28`;
    if (refs.mbYear) refs.mbYear.textContent = info.year;

    populateWeekDots(info.day);
    populatePractices(info.moon, info.day);
    recolorByMoon(info.moon);
    setRingTargets(info.day);
    stopRingTween();
    STATE.rafRing = requestAnimationFrame(tweenRing);
    populateYearMap(startOfYear13(dt, STATE.tz), STATE.tz);

    // Numerology
    const sum = (info.moon + info.day) % 9 || 9;
    if (refs.numLine) refs.numLine.textContent = `Σ(moon,day) → ${sum}`;
    if (refs.numMeta) refs.numMeta.textContent = `Tone bias ~ ${(info.moon%13)||13}, Week ${Math.ceil(info.day/7)}`;
    if (refs.energyQuote) refs.energyQuote.textContent = quoteFor(info.moon, info.day);

    // Phase canvas
    const { illum, age } = moonPhase(dt);
    STATE.illum = illum;
    if (refs.simMoon) {
      sizeCanvasToDisplay(refs.simMoon, STATE.dpr);
      const ctx = refs.simMoon.getContext("2d", {alpha:false});
      drawMoon(ctx, illum);
    }
    const pct = Math.round(illum*100);
    if (refs.phaseLine) refs.phaseLine.textContent = `Illumination ${pct}% · Age ${age.toFixed(1)} d`;
    if (refs.phaseMeta) refs.phaseMeta.textContent = illum<.03?"New Moon":illum>.97?"Full Moon":(illum<0.5?"Waxing":"Waning");

    // Astro placeholders
    if (refs.astroStamp) refs.astroStamp.textContent = fmtDate(dt, STATE.tz);
    if (refs.astroTZ) refs.astroTZ.textContent = STATE.tz;
    if (refs.astroSource) refs.astroSource.textContent = (window.__EPHEMERIS__ ? "Ephemeris feed" : "—");
    if (window.__EPHEMERIS__ && refs.planetChips) {
      // minimal fill: expects { planet: {pos:"00° Sign"}, ... }
      $$(".pos", refs.planetChips).forEach(el=>{
        const k = el.dataset.pos; if (window.__EPHEMERIS__[k]) el.textContent = window.__EPHEMERIS__[k].pos || "—";
      });
      $$(".sign", refs.planetChips).forEach(el=>{
        const k = el.dataset.sign; if (window.__EPHEMERIS__[k]) el.textContent = window.__EPHEMERIS__[k].sign || "—";
      });
    }
  }

  /* ------------------------------ Share Card ------------------------------ */
  async function makeShareCard() {
    const W=1200, H=630;
    const c = document.createElement("canvas"); c.width=W; c.height=H;
    const ctx = c.getContext("2d");
    // bg
    const g = ctx.createLinearGradient(0,0,W,H);
    const ca = getComputedStyle(document.documentElement);
    const a = ca.getPropertyValue("--moon-accent").trim() || "#7af3ff";
    const b = ca.getPropertyValue("--moon-accent-2").trim() || "#f3c97a";
    g.addColorStop(0, a); g.addColorStop(1, b);
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    // dark overlay
    ctx.fillStyle = "rgba(10,14,21,.80)"; ctx.fillRect(20,20,W-40,H-40);

    // title + data
    ctx.fillStyle = "#eaf6ff";
    ctx.font = "900 56px Inter, system-ui, sans-serif";
    const name = refs.moonName?.textContent || "—";
    ctx.fillText(`Remnant 13 Moons — ${name}`, 60, 130);

    ctx.font = "600 30px Inter, system-ui, sans-serif";
    const line1 = refs.moonLine?.textContent || "";
    const line2 = `${refs.nowDate?.textContent || ""} · ${STATE.tz}`;
    ctx.fillText(line1, 60, 190);
    ctx.fillText(line2, 60, 230);

    // moon disc
    const mC = document.createElement("canvas"); mC.width=400; mC.height=400;
    drawMoon(mC.getContext("2d"), STATE.illum);
    ctx.drawImage(mC, W-60-400, H/2-200);

    // seal
    ctx.font = "900 28px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#cfe1ff"; ctx.fillText("⟡ יהוה · Scroll of Fire", 60, H-60);

    const blob = await new Promise(res=> c.toBlob(res, "image/png", 0.95));
    if (!blob) return;
    const url = URL.createObjectURL(blob);

    // share if possible
    const file = new File([blob], "remnant-13-moons.png", {type:"image/png"});
    if (navigator.canShare && navigator.canShare({files:[file]})) {
      try { await navigator.share({files:[file], title:"Remnant 13 Moons"}); URL.revokeObjectURL(url); return; } catch {}
    }
    // else: download
    const aEl = document.createElement("a");
    aEl.href = url; aEl.download = "remnant-13-moons.png";
    document.body.appendChild(aEl); aEl.click(); aEl.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
  }

  /* --------------------------- Events / Wiring ---------------------------- */
  function populateTZ() {
    const sel = refs.tzPick;
    if (!sel) return;
    const seen = new Set(COMMON_TZ);
    const sys = (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    seen.add(sys);
    sel.innerHTML = [...seen].sort().map(z => `<option value="${z}">${z}</option>`).join("");
    const saved = localStorage.getItem(TZ_KEY);
    sel.value = saved || sys;
    STATE.tz = sel.value;
  }

  function wire() {
    document.body.classList.add("page-moons");
    populateTZ();

    // Date input initial
    if (refs.datePick) {
      const d = dateInTZ(new Date(), STATE.tz);
      refs.datePick.value = `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
    }
    if (refs.hourScrub) refs.hourScrub.value = String(STATE.hour);

    // TZ
    on(refs.tzPick, "change", e => {
      STATE.tz = e.target.value;
      localStorage.setItem(TZ_KEY, STATE.tz);
      recompute();
      refreshICS();
    });

    // Date
    on(refs.datePick, "change", e => {
      const v = e.target.value;
      if (validDateStr(v)) STATE.selISO = `${v}T00:00:00Z`;
      recompute();
    });

    // Hour
    on(refs.hourScrub, "input", e => {
      STATE.hour = clamp(parseInt(e.target.value, 10),0,23);
      recompute();
    });

    // Today / Prev / Next + Keys
    on(refs.btnToday, "click", () => {
      STATE.selISO = null;
      if (refs.datePick) refs.datePick.value = "";
      recompute();
    });
    on(refs.prevDay, "click", () => nudgeDay(-1));
    on(refs.nextDay, "click", () => nudgeDay(1));
    on(document, "keydown", (ev)=>{
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (["INPUT","TEXTAREA","SELECT"].includes(tag)) return;
      if (ev.key==="ArrowUp") { nudgeDay(1); }
      if (ev.key==="ArrowDown") { nudgeDay(-1); }
      if (ev.key==="ArrowLeft") { STATE.hour = clamp(STATE.hour-1,0,23); if (refs.hourScrub) refs.hourScrub.value=STATE.hour; recompute(); }
      if (ev.key==="ArrowRight"){ STATE.hour = clamp(STATE.hour+1,0,23); if (refs.hourScrub) refs.hourScrub.value=STATE.hour; recompute(); }
      if (ev.key.toLowerCase()==="t"){ STATE.selISO=null; if (refs.datePick) refs.datePick.value=""; recompute(); }
    });

    // Jump to moon
    on(refs.jumpMoon, "change", e=>{
      const m = parseInt(e.target.value,10); if(!m) return;
      const start = startOfYear13(new Date(), STATE.tz);
      const target = addDaysSkippingSpecials(start, (m-1)*28, STATE.tz);
      STATE.selISO = `${target.getUTCFullYear()}-${pad(target.getUTCMonth()+1)}-${pad(target.getUTCDate())}T00:00:00Z`;
      if (refs.datePick) refs.datePick.value = STATE.selISO.slice(0,10);
      recompute();
    });

    // Share deep link
    on(refs.shareLink, "click", async ()=>{
      const u = new URL(location.href);
      if (STATE.selISO) u.searchParams.set("d", STATE.selISO.slice(0,10));
      u.searchParams.set("tz", STATE.tz);
      u.searchParams.set("h", String(STATE.hour));
      const urlStr = u.toString();
      try {
        await (navigator.clipboard && navigator.clipboard.writeText(urlStr));
        if (refs.shareLink) { const old = refs.shareLink.textContent; refs.shareLink.textContent = "Copied ✓"; setTimeout(()=>refs.shareLink.textContent=old||"Copy Link",1200); }
      } catch {
        alert(urlStr);
      }
    });

    // Share card (PNG)
    on(refs.mbShareBtn, "click", makeShareCard);

    // ICS
    on(refs.regenICS, "click", refreshICS);

    // Kin
    const updateKin = () => {
      if (!refs.kinBadge || !refs.kinLine) return;
      if (!refs.kinOn || !refs.kinOn.checked) { refs.kinBadge.textContent="Kin —"; refs.kinLine.textContent="—"; return; }
      const opts = {
        epoch: refs.kinEpoch && refs.kinEpoch.value,
        skipLeap: !!(refs.kinSkipLeap && refs.kinSkipLeap.checked),
        skipDOOT: !!(refs.kinSkipDOOT && refs.kinSkipDOOT.checked)
      };
      if (!opts.epoch) { refs.kinBadge.textContent="Kin —"; refs.kinLine.textContent="—"; return; }
      const base = STATE.selISO?new Date(STATE.selISO):new Date();
      const k = kinOf(base, STATE.tz, opts);
      if (!k) return;
      refs.kinBadge.textContent = `Kin ${k.kin}`;
      refs.kinLine.textContent = `${k.toneName} · ${k.seal}`;
    };
    ["change","input"].forEach(ev=>{
      on(refs.kinOn, ev, updateKin);
      on(refs.kinEpoch, ev, updateKin);
      on(refs.kinSkipLeap, ev, updateKin);
      on(refs.kinSkipDOOT, ev, updateKin);
    });

    // Notes
    on(refs.saveNote, "click", ()=>{
      if (!refs.noteText) return;
      const key = `${NOTES_KEY}:${STATE.tz}:${(refs.datePick && refs.datePick.value)||"today"}`;
      localStorage.setItem(key, refs.noteText.value||"");
      const old = refs.saveNote && refs.saveNote.textContent;
      if (refs.saveNote) { refs.saveNote.textContent="Saved ✓"; setTimeout(()=>{ if (refs.saveNote) refs.saveNote.textContent=old||"Save note"; }, 1000); }
    });

    // Deep link restore
    const q = new URLSearchParams(location.search);
    const qd = q.get("d"), qtz = q.get("tz"), qh = q.get("h");
    if (qd && validDateStr(qd)) { STATE.selISO = `${qd}T00:00:00Z`; if (refs.datePick) refs.datePick.value = qd; }
    if (qtz) { STATE.tz = qtz; if (refs.tzPick) refs.tzPick.value = qtz; }
    if (qh != null) { STATE.hour = clamp(parseInt(qh,10),0,23); if (refs.hourScrub) refs.hourScrub.value = STATE.hour; }

    // Visibility / DPR / Resize
    on(document, "visibilitychange", ()=>{
      STATE.hidden = (document.visibilityState === "hidden");
      if (STATE.hidden) {
        stopRingTween();
      } else {
        if (refs.simMoon) sizeCanvasToDisplay(refs.simMoon, STATE.dpr);
        recompute();
        STATE.rafRing = requestAnimationFrame(tweenRing);
      }
    });
    on(window, "resize", ()=>{
      STATE.dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
      if (refs.simMoon) sizeCanvasToDisplay(refs.simMoon, STATE.dpr);
      recompute();
    });

    // Initial compute + ICS + clock tick
    recompute();
    refreshICS();
    STATE.tickTimer = window.setInterval(()=> {
      if (!refs.nowClock) return;
      refs.nowClock.textContent = fmtTime(dateInTZ(new Date(), STATE.tz), STATE.tz);
    }, 1000);

    if (!prefersReduced()) {
      stopRingTween();
      STATE.rafRing = requestAnimationFrame(tweenRing);
    }
  }

  function nudgeDay(delta) {
    const base = STATE.selISO ? new Date(STATE.selISO) : dateInTZ(new Date(), STATE.tz);
    const next = addDaysSkippingSpecials(base, delta, STATE.tz);
    const iso = `${next.getUTCFullYear()}-${pad(next.getUTCMonth()+1)}-${pad(next.getUTCDate())}T00:00:00Z`;
    STATE.selISO = iso;
    if (refs.datePick) refs.datePick.value = iso.slice(0,10);
    recompute();
  }

  // Start / Cleanup
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }

  window.addEventListener("beforeunload", ()=>{
    if (STATE.tickTimer) clearInterval(STATE.tickTimer);
    stopRingTween();
    if (STATE.icsURL) URL.revokeObjectURL(STATE.icsURL);
  });
})();