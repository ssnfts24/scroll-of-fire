/* ========================================================================
   Scroll of Fire — 13 Moons / Living Clock Engine
   File: assets/js/moons.js
   Version: v4.1 Remnant (2025-10-27)
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

  /* ------------------------ Global State Hub ------------------------------ */
  const STATE = {
    tz: "UTC",
    hour: new Date().getHours(),
    selISO: null,
    illum: 0,
    sunAngle: 0,
    ringDashNow: 0, ringDashTarget: 0, lastTween: 0,
    animOn: true,
  };

  /* ---------------------------- IDs / Refs -------------------------------- */
  const refs = {
    tzPick: $("#tzPick"),
    datePick: $("#datePick"),
    hourScrub: $("#hourScrub"),
    nowDate: $("#nowDate"), nowClock: $("#nowClock"), nowTZ: $("#nowTZ"),
    moonName: $("#moonName"), moonEss: $("#moonEssence"), dayInMoon: $("#dayInMoon"),
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
    calTZMeta: $("#calTZMeta"), calYearMeta: $("#calYearMeta"),
    astroWheel: $("#astroWheel"), astroStamp: $("#astroStamp"), astroTZ: $("#astroTZ"), astroSource: $("#astroSource"),
    planetChips: $("#planetChips"), aspBody: $("#aspBody"),
    shareLink: $("#shareLink"), btnToday: $("#btnToday"), prevDay: $("#prevDay"), nextDay: $("#nextDay"),
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
    const epoch = Date.UTC(2000, 0, 6, 18, 14); // known new moon
    const days = (d - epoch) / 86400000;
    const frac = (days % syn + syn) % syn; // 0..syn
    const illum = 0.5 * (1 - Math.cos(2 * Math.PI * frac / syn)); // 0..1
    const angle = 2 * Math.PI * frac / syn; // sun→moon angle
    return { illum, angle, age: frac };
  }

  function drawMoon(ctx, illum, angle) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    ctx.clearRect(0, 0, W, H);
    const r = Math.min(W, H) * 0.42, cx = W / 2, cy = H / 2;

    // backdrop
    const g = ctx.createRadialGradient(cx, cy, r*0.2, cx, cy, r*1.2);
    g.addColorStop(0, "rgba(255,255,255,0.07)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r*1.15, 0, Math.PI*2); ctx.fill();

    // dark disk
    ctx.fillStyle = "#0b0f16";
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();

    // lit part
    const k = clamp(illum, 0, 1);
    const dx = Math.cos(angle) * r;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k < 0.5 ? -1 : 1, 1); // waxing/waning flip
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

  /* ---------------------------- UI Populate ------------------------------- */
  function populateTZ() {
    const sel = refs.tzPick;
    if (!sel) return;
    const seen = new Set(COMMON_TZ);
    const sys = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    seen.add(sys);
    sel.innerHTML = [...seen].sort().map(z => `<option value="${z}">${z}</option>`).join("");
    const saved = localStorage.getItem(TZ_KEY);
    sel.value = saved || sys;
    STATE.tz = sel.value;
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
    refs.nextMoonInfo.textContent = `Next: ${next.name} starts ${fmtDate(next.start, tz)}.`;
  }

  function quoteFor(moon, day){
    const q = QUOTES[(moon + day) % QUOTES.length];
    return q;
  }

  /* ------------------------------ Kin (opt) ------------------------------- */
  function kinOf(d, tz, opts) {
    if (!opts) return null;
    const epoch = utcTrunc(new Date(opts.epoch + "T00:00:00Z"));
    let days = Math.floor((utcTrunc(dateInTZ(d, tz)) - epoch) / 86400000);
    if (opts.skipLeap) {
      for (let y = epoch.getUTCFullYear(); y <= d.getUTCFullYear(); y++) {
        if (isLeapYear(y)) {
          const feb29 = new Date(Date.UTC(y, 1, 29));
          if (d >= feb29 && epoch <= feb29) days -= 1;
        }
      }
    }
    if (opts.skipDOOT) {
      for (let y = epoch.getUTCFullYear(); y <= d.getUTCFullYear(); y++) {
        const doot = new Date(Date.UTC(y, 6, 25));
        if (d >= doot) days -= 1;
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
    const body = [
      "BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Scroll of Fire//13 Moons//EN"
    ];
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
    const perim = 316; // pathLength
    const seg = perim * (day / 28);
    STATE.ringDashTarget = `${seg} ${perim}`;
    if (!STATE.ringDashNow) STATE.ringDashNow = `0 ${perim}`;
    if (refs.ringArcMini) refs.ringArcMini.setAttribute("stroke-dasharray", `${seg/2} 163`);
  }

  function tweenRing(ts) {
    if (!refs.ringArc || prefersReduced()) return;
    if (!STATE.lastTween) STATE.lastTween = ts;
    const dt = clamp((ts - STATE.lastTween)/400, 0, 1);
    const a = refs.ringArc.getAttribute("stroke-dasharray") || "0 316";
    const [cur] = a.split(" ").map(parseFloat);
    const [tar] = STATE.ringDashTarget.split(" ").map(parseFloat);
    const next = cur + (tar - cur) * (dt*0.9);
    refs.ringArc.setAttribute("stroke-dasharray", `${next} 316`);
    STATE.lastTween = ts;
    requestAnimationFrame(tweenRing);
  }

  function recompute() {
    const base = new Date();
    const d = STATE.selISO ? new Date(STATE.selISO) : base;
    const dt = dateInTZ(d, STATE.tz, STATE.hour);

    // Now line
    refs.nowDate && (refs.nowDate.textContent = fmtDate(dt, STATE.tz));
    refs.nowClock && (refs.nowClock.textContent = fmtTime(dt, STATE.tz));
    refs.nowTZ && (refs.nowTZ.textContent = STATE.tz);

    // 13×28
    const info = calc13Moon(dt, STATE.tz);
    if (info.special) {
      refs.moonLine && (refs.moonLine.textContent = info.special);
      refs.dootWarn && (refs.dootWarn.style.display = "block");
      refs.dayInMoon && (refs.dayInMoon.textContent = "—");
      refs.yearSpan && (refs.yearSpan.textContent = info.year);
      populateYearMap(startOfYear13(dt, STATE.tz), STATE.tz);
      return;
    }
    refs.dootWarn && (refs.dootWarn.style.display = "none");
    const name = MOONS[info.moon-1], ess = MOON_ESSENCE[info.moon-1];
    refs.moonName && (refs.moonName.textContent = name);
    refs.moonEss && (refs.moonEssence.textContent = ess);
    refs.dayInMoon && (refs.dayInMoon.textContent = info.day);
    refs.moonLine && (refs.moonLine.textContent = `${name} — Day ${info.day} of 28`);
    refs.yearSpan && (refs.yearSpan.textContent = info.year);
    refs.mbName && (refs.mbName.textContent = name);
    refs.mbEssence && (refs.mbEssence.textContent = ess);
    refs.mbDay && (refs.mbDay.textContent = `${info.day}/28`);
    refs.mbYear && (refs.mbYear.textContent = info.year);
    populateWeekDots(info.day);
    recolorByMoon(info.moon);
    setRingTargets(info.day);
    requestAnimationFrame(tweenRing);
    populateYearMap(startOfYear13(dt, STATE.tz), STATE.tz);

    // Numerology (simple)
    const sum = (info.moon + info.day) % 9 || 9;
    refs.numLine && (refs.numLine.textContent = `Σ(moon,day) → ${sum}`);
    refs.numMeta && (refs.numMeta.textContent = `Tone bias ~ ${(info.moon%13)||13}, Week ${(Math.ceil(info.day/7))}`);
    refs.energyQuote && (refs.energyQuote.textContent = quoteFor(info.moon, info.day));

    // Phase canvas
    const { illum, angle, age } = moonPhase(dt);
    STATE.illum = illum; STATE.sunAngle = angle;
    if (refs.simMoon) {
      const ctx = refs.simMoon.getContext("2d", {alpha:false});
      drawMoon(ctx, illum, angle);
    }
    const pct = Math.round(illum*100);
    refs.phaseLine && (refs.phaseLine.textContent = `Illumination ${pct}% · Age ${age.toFixed(1)} d`);
    refs.phaseMeta && (refs.phaseMeta.textContent = illum<.03?"New Moon":illum>.97?"Full Moon":angle<Math.PI?"Waxing":"Waning");

    // Astro placeholders
    refs.astroStamp && (refs.astroStamp.textContent = fmtDate(dt, STATE.tz));
    refs.astroTZ && (refs.astroTZ.textContent = STATE.tz);
    refs.astroSource && (refs.astroSource.textContent = (window.__EPHEMERIS__ ? "Ephemeris feed" : "—"));
  }

  /* --------------------------- Events / Wiring ---------------------------- */
  function wire() {
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
    });

    // Date
    on(refs.datePick, "change", e => {
      const v = e.target.value;
      if (validDateStr(v)) STATE.selISO = `${v}T00:00:00Z`;
      recompute();
    });

    // Hour
    on(refs.hourScrub, "input", e => {
      STATE.hour = parseInt(e.target.value, 10);
      recompute();
    });

    // Today / Prev / Next
    on(refs.btnToday, "click", () => {
      STATE.selISO = null;
      if (refs.datePick) refs.datePick.value = "";
      recompute();
    });
    on(refs.prevDay, "click", () => nudgeDay(-1));
    on(refs.nextDay, "click", () => nudgeDay(1));
    on(document, "keydown", (ev)=>{
      if (["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)) return;
      if (ev.key==="ArrowUp") { nudgeDay(1); }
      if (ev.key==="ArrowDown") { nudgeDay(-1); }
      if (ev.key==="ArrowLeft") { STATE.hour = clamp(STATE.hour-1,0,23); refs.hourScrub && (refs.hourScrub.value=STATE.hour); recompute(); }
      if (ev.key==="ArrowRight"){ STATE.hour = clamp(STATE.hour+1,0,23); refs.hourScrub && (refs.hourScrub.value=STATE.hour); recompute(); }
      if (ev.key.toLowerCase()==="t"){ STATE.selISO=null; refs.datePick && (refs.datePick.value=""); recompute(); }
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

    // Share link
    on(refs.shareLink, "click", ()=>{
      const u = new URL(location.href);
      if (STATE.selISO) u.searchParams.set("d", STATE.selISO.slice(0,10));
      u.searchParams.set("tz", STATE.tz);
      u.searchParams.set("h", String(STATE.hour));
      navigator.clipboard && navigator.clipboard.writeText(u.toString());
      refs.shareLink.textContent = "Copied ✓";
      setTimeout(()=>refs.shareLink.textContent="Copy Link",1200);
    });

    // ICS
    const refreshICS = () => {
      const anchor = startOfYear13(STATE.selISO?new Date(STATE.selISO):new Date(), STATE.tz);
      const blob = buildICS(anchor, STATE.tz);
      const url = URL.createObjectURL(blob);
      refs.dlICS && (refs.dlICS.href = url);
      refs.dlICS && (refs.dlICS.download = `13-moons-${anchor.getUTCFullYear()}-${anchor.getUTCFullYear()+1}.ics`);
    };
    on(refs.regenICS, "click", refreshICS);

    // Kin
    const updateKin = () => {
      if (!refs.kinOn || !refs.kinOn.checked) { refs.kinBadge.textContent="Kin —"; refs.kinLine.textContent="—"; return; }
      const opts = {
        epoch: refs.kinEpoch.value,
        skipLeap: refs.kinSkipLeap.checked,
        skipDOOT: refs.kinSkipDOOT.checked
      };
      const k = kinOf(STATE.selISO?new Date(STATE.selISO):new Date(), STATE.tz, opts);
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
      const key = `${NOTES_KEY}:${STATE.tz}:${(refs.datePick && refs.datePick.value)||"today"}`;
      localStorage.setItem(key, refs.noteText.value||"");
      refs.saveNote.textContent="Saved ✓";
      setTimeout(()=>refs.saveNote.textContent="Save note",1000);
    });

    // Deep link restore
    const q = new URLSearchParams(location.search);
    const qd = q.get("d"), qtz = q.get("tz"), qh = q.get("h");
    if (qd && validDateStr(qd)) { STATE.selISO = `${qd}T00:00:00Z`; refs.datePick && (refs.datePick.value = qd); }
    if (qtz) { STATE.tz = qtz; refs.tzPick && (refs.tzPick.value = qtz); }
    if (qh != null) { STATE.hour = clamp(parseInt(qh,10),0,23); refs.hourScrub && (refs.hourScrub.value = STATE.hour); }

    // Initial compute + ICS + Kin
    recompute();
    refreshICS();
    updateKin();

    // Clock tick (only time string; keep heavy ops light)
    setInterval(()=>{ refs.nowClock && (refs.nowClock.textContent = fmtTime(dateInTZ(new Date(), STATE.tz), STATE.tz)); }, 1000);
  }

  function nudgeDay(delta) {
    const base = STATE.selISO ? new Date(STATE.selISO) : dateInTZ(new Date(), STATE.tz);
    const next = addDaysSkippingSpecials(base, delta, STATE.tz);
    const iso = `${next.getUTCFullYear()}-${pad(next.getUTCMonth()+1)}-${pad(next.getUTCDate())}T00:00:00Z`;
    STATE.selISO = iso;
    refs.datePick && (refs.datePick.value = iso.slice(0,10));
    recompute();
  }

  // Start
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
