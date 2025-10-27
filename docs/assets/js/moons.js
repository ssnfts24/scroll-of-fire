...,6,18,14,0); const ageDays = ((d.getTime() - epoch) / 86400000); const frac = ((ageDays % syn) + syn) % syn / syn; const illum = (1 - Math.cos(2 * Math.PI * frac)) / 2; const phases = [ { n: "New Moon",        r: [0.00, 0.03] }, { n: "Waxing Crescent", r: [0.03, 0.22] }, { n: "First Quarter",   r: [0.22, 0.28] }, { n: "Waxing Gibbous",  r: [0.28, 0.47] }, { n: "Full Moon",       r: [0.47, 0.53] }, { n: "Waning Gibbous",  r: [0.53, 0.72] }, { n: "Last Quarter",    r: [0.72, 0.78] }, { n: "Waning Crescent", r: [0.78, 0.97] }, { n: "New Moon",        r: [0.97, 1.01] }, ]; const phase = (phases.find(p => frac >= p.r[0] && frac < p.r[1]) || {}).n || "—"; return { phase, ageDays, illum, frac }; }

/* -------- DPR-aware canvas + activity ring + phase accents ------------- */ let ctx = null, DPR = 1, CW = 0, CH = 0; function sizeCanvas() { const c = refs.simMoon; if (!c) return; DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1)); const rect = c.getBoundingClientRect(); const w = Math.max(300, Math.round(rect.width || 280)); const h = Math.max(220, Math.round(rect.height || rect.width * 0.6)); CW = w; CH = h; c.width = Math.round(w * DPR); c.height = Math.round(h * DPR); c.style.width = w + "px"; c.style.height = h + "px"; ctx = c.getContext("2d"); if (ctx) ctx.setTransform(DPR, 0, 0, DPR, 0, 0); } if (refs.simMoon) { sizeCanvas(); STATE.roMoon = ("ResizeObserver" in window) ? new ResizeObserver(sizeCanvas) : null; STATE.roMoon && STATE.roMoon.observe(refs.simMoon); on(window, "resize", sizeCanvas, { passive: true }); }

let pointerX = 0, pointerY = 0, parallax = 0; if (refs.simMoon) { on(refs.simMoon, "pointermove", e => { const r = refs.simMoon.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5; const y = (e.clientY - r.top) / r.height - 0.5; pointerX = clamp(x * 2, -1, 1); pointerY = clamp(y * 2, -1, 1); parallax = 1; }, { passive: true }); on(refs.simMoon, "pointerleave", () => { parallax = 0; }, { passive: true }); }

// Deterministic particles per moon (for the glow ring) function seededRand(seed) { let x = Math.imul(seed ^ 0x6d2b79f5, 1); return () => ((x = Math.imul(x ^ (x >>> 15), 1 | x)) >>> 0) / 4294967295; } let activity = { particles: [], mode: "magnetic" }; function buildActivityForMoon(mIdx) { const rand = seededRand(0xBEEF ^ mIdx); const count = 24 + Math.floor(rand() * 22); const spinDir = (mIdx % 2 === 0) ? 1 : -1; const modes = ["magnetic","lunar","electric","self","overtone","rhythmic","resonant","galactic","solar","planetary","spectral","crystal","cosmic"]; activity.mode = modes[(mIdx - 1) % modes.length]; activity.particles = Array.from({ length: count }, (_, i) => { const base = (i / count) * Math.PI * 2; return { a: base + rand() * 0.6,         // angle r: 1.15 + rand() * 0.25,        // radius factor s: (0.18 + rand() * 0.22) * spinDir, // speed z: 0.6 + rand() * 0.6,          // brightness j: rand() * 0.04 + 0.01         // jitter }; }); } function drawActivity(cx, cy, R, t) { if (!ctx || prefersReduced()) return; ctx.save(); ctx.translate(cx, cy); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, R * 1.45, 0, Math.PI * 2); ctx.stroke();

activity.particles.forEach(p => {
  const a = p.a + t * 0.0008 * p.s + Math.sin(t * 0.001 + p.a * 3) * p.j;
  const rr = R * p.r * (1 + 0.02 * Math.sin(t * 0.0012 + p.a * 5));
  const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
  ctx.beginPath();
  ctx.fillStyle = "rgba(255,255,255," + (0.05 + p.z * 0.15) + ")";
  ctx.arc(x, y, 2.2 + p.z * 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.strokeStyle = "rgba(199,233,255," + (0.12 + p.z * 0.18) + ")";
  ctx.lineWidth = 1;
  ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(a) * 6, y - Math.sin(a) * 6); ctx.stroke();
});

if (["resonant","solar","cosmic"].includes(activity.mode)) {
  ctx.strokeStyle = "rgba(243,201,122,0.16)";
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 3; k++) { const s = R * (1.1 + k * 0.12); ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.stroke(); }
} else if (["electric","galactic"].includes(activity.mode)) {
  const sides = activity.mode === "electric" ? 3 : 6;
  const rad = R * 1.35;
  const angle = t * 0.0006;
  ctx.strokeStyle = "rgba(122,243,255,0.14)";
  ctx.beginPath();
  for (let i = 0; i <= sides; i++) {
    const a = angle + i * (Math.PI * 2 / sides);
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}
ctx.restore();

}

function setGradientStops(defId, c1, c2) { const grad = document.getElementById(defId); if (!grad) return; const stops = grad.querySelectorAll("stop"); if (stops[0]) stops[0].setAttribute("stop-color", c1); if (stops[1]) stops[1].setAttribute("stop-color", c2); } function mixHex(a, b, t) { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255; const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255; const rr = Math.round(ar + (br - ar) * t), gg = Math.round(ag + (bg - ag) * t), bb2 = Math.round(ab + (bb - ab) * t); return #${((1 << 24) + (rr << 16) + (gg << 8) + bb2).toString(16).slice(1)}; } function applyPhaseAccent(illum) { const cold = "#7af3ff", warm = "#f3c97a"; const t = clamp(illum, 0, 1); const c1 = mixHex(cold, warm, t * 0.7); const c2 = mixHex(warm, cold, (1 - t) * 0.7); setGradientStops("rg", c1, c2); setGradientStops("mbGrad", c1, c2); const root = document.documentElement; root.style.setProperty("--moon-accent", c1); root.style.setProperty("--moon-accent-2", c2); document.dispatchEvent(new Event("sof:accent-change")); } function drawMoonSim(illum, sunAngle, tBreath) { if (!ctx) return; ctx.clearRect(0, 0, CW, CH); const g = ctx.createLinearGradient(0, 0, 0, CH); g.addColorStop(0, "#0a0e15"); g.addColorStop(1, "#06080d"); ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);

const offX = parallax ? pointerX * 8 : 0;
const offY = parallax ? pointerY * 6 : 0;
const cx = CW / 2 + offX, cy = CH / 2 + offY;
const R = Math.min(CW, CH) * 0.32 * (1 + 0.015 * Math.sin(tBreath * 0.0016));
const sx = cx + Math.cos(sunAngle) * R * 1.7;
const sy = cy - Math.sin(sunAngle) * R * 1.7;

ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
const body = ctx.createRadialGradient(cx, cy - R * 0.65, R * 0.2, cx, cy, R * 1.05);
body.addColorStop(0, "#1a2130"); body.addColorStop(1, "#0e131c");
ctx.fillStyle = body; ctx.fill();

const k = 2 * illum - 1;
const rx = R * Math.abs(k), ry = R;
ctx.save(); ctx.translate(cx, cy); ctx.rotate(-sunAngle);
ctx.beginPath();
if (k >= 0) { ctx.ellipse(0, 0, rx, ry, 0, Math.PI / 2, -Math.PI / 2, true); ctx.arc(0, 0, R, -Math.PI / 2, Math.PI / 2, false); }
else { ctx.ellipse(0, 0, rx, ry, 0, -Math.PI / 2, Math.PI / 2, true); ctx.arc(0, 0, R, Math.PI / 2, -Math.PI / 2, false); }
const glow = ctx.createLinearGradient(-R, 0, R, 0);
glow.addColorStop(0, "#7af3ff33"); glow.addColorStop(1, "#f3c97a33");
ctx.fillStyle = glow; ctx.fill();
ctx.globalCompositeOperation = "lighter";
ctx.beginPath(); ctx.arc(0, 0, R * 1.01, 0, Math.PI * 2); ctx.strokeStyle = "#7af3ff22"; ctx.lineWidth = 2; ctx.stroke();
ctx.globalCompositeOperation = "source-over";
ctx.restore();

drawActivity(cx, cy, R, tBreath);
ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fillStyle = "#f3c97a"; ctx.fill();

}

/* -------------------- Numerology + Kin + ICS helpers -------------------- */ const sumDigits = n => String(n).split("").reduce((a, b) => a + (+b || 0), 0); function reduceNum(n) { while (n > 9 && n !== 11 && n !== 22 && n !== 33) { n = sumDigits(n); } return n; } function numerology(d, tz) { const dt = dateInTZ(d, tz); const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, day = dt.getUTCDate(); const total = reduceNum(sumDigits(y) + sumDigits(m) + sumDigits(day)); const monthN = reduceNum(sumDigits(y) + sumDigits(m)); const dayN = reduceNum(sumDigits(day)); return { total, monthN, dayN }; } function kinFromDate(selUTC, rules) { const { epochUTC, skipLeapDay, skipDOOT, tz } = rules; let count = Math.floor((utcTrunc(selUTC) - utcTrunc(epochUTC)) / 86400000); const start = utcTrunc(epochUTC), end = utcTrunc(selUTC); for (let d = new Date(start); d < end; d = new Date(d.getTime() + 86400000)) { const isLeap = isLeapDayUTC(d); const doot = isDOOT(d, tz); if ((isLeap && skipLeapDay) || (doot && skipDOOT)) count -= 1; } const kin = ((count % 260) + 260) % 260 + 1; const tone = ((kin - 1) % 13) + 1; const seal = SEALS[(kin - 1) % 20]; return { kin, tone, seal }; }

function icsEscape(s) { return String(s).replace(/([,;])/g, "\$1").replace(/\n/g, "\n"); } function makeICS(spans, tz, titleYear) { const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Scroll of Fire//13 Moon//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"]; spans.forEach((s, i) => { const uid = sof-13moon-${titleYear}-${i + 1}@scroll-of-fire; const dtStart = dateInTZ(s.start, tz); const dtEnd = new Date(s.end.getTime() + 86400000); const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, ""); lines.push( "BEGIN:VEVENT", UID:${uid}, SUMMARY:${icsEscape(#${s.m} ${s.name} Moon — ${s.essence})}, DTSTART;VALUE=DATE:${fmt(dtStart)}, DTEND;VALUE=DATE:${fmt(dtEnd)}, DESCRIPTION:${icsEscape(13-Moon: ${s.name} (${s.m}) • ${s.essence} • TZ ${tz})}, "END:VEVENT" ); }); lines.push("END:VCALENDAR"); return lines.join("\r\n"); }

/* -------------------- Year map + Calendars (no jank) -------------------- */ function withNoJank(fn) { const y = window.scrollY; fn(); requestAnimationFrame(() => window.scrollTo(0, y)); }

function buildYearMap() { const tbody = refs.yearMap; if (!tbody) return; const tz = STATE.tz; const sel = STATE.selISO ? new Date(${STATE.selISO}T${pad(STATE.hour)}:00:00Z) : dateInTZ(new Date(), tz, STATE.hour); const anchor = startOfYear13(sel, tz); const spans = yearMoonSpans(anchor, tz); const todayStr = dateInTZ(sel, tz).toISOString().slice(0, 10); withNoJank(() => { tbody.innerHTML = spans.map(s => { const sStr = dateInTZ(s.start, tz).toISOString().slice(0, 10); const eStr = dateInTZ(s.end, tz).toISOString().slice(0, 10); const isNow = todayStr >= sStr && todayStr <= eStr; return <tr class="${isNow ? 'is-today' : ''}"> <td>${s.m}</td> <td><span class="tag">${s.name}</span></td> <td class="meta">${s.essence}</td> <td>${fmtDate(dateInTZ(s.start, tz), tz)}</td> <td>${fmtDate(dateInTZ(s.end, tz), tz)}</td> </tr>; }).join(""); }); if (refs.nextMoonInfo) { const m13 = calc13Moon(sel, tz); if (!m13.special) { const next = spans[m13.moon] || null; refs.nextMoonInfo.textContent = next ? Next: ${next.name} Moon starts ${fmtDate(dateInTZ(next.start, tz), tz)} : This is the Cosmic Moon. New Year begins ${fmtDate(dateInTZ(new Date(Date.UTC(anchor.getUTCFullYear() + 1, 6, 26)), tz), tz)}; } else { refs.nextMoonInfo.textContent = New Year begins ${fmtDate(dateInTZ(new Date(Date.UTC(startOfYear13(sel, tz).getUTCFullYear() + 1, 6, 26)), tz), tz)}; } } if (refs.dlICS) { const ics = makeICS(spans, tz, ${anchor.getUTCFullYear()}/${anchor.getUTCFullYear() + 1}); const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" }); const url = URL.createObjectURL(blob); if (refs.dlICS.dataset._url) URL.revokeObjectURL(refs.dlICS.dataset._url); refs.dlICS.href = url; refs.dlICS.dataset._url = url; refs.dlICS.download = 13-moon-${anchor.getUTCFullYear()}-${anchor.getUTCFullYear() + 1}.ics; } if (refs.calTZMeta) refs.calTZMeta.textContent = tz; if (refs.calYearMeta) { const y = startOfYear13(sel, tz).getUTCFullYear(); refs.calYearMeta.textContent = ${y}/${y + 1}; } // Rebuild the per-month calendars if exposed by the page (provided by calendars module) if (typeof window.buildCalendars === "function") window.buildCalendars(); }

/* ------------------------ Sky background animation ---------------------- */ (function initSky() { const c = refs.skyBg; if (!c) return; const RM = prefersReduced(); const k = c.getContext("2d"); if (!k) return; function size() { c.width = innerWidth; c.height = Math.max(320, Math.round(innerHeight * 0.45)); } size(); on(window, "resize", size, { passive: true }); const stars = Array.from({ length: 150 }, () => ({ x: Math.random() * c.width, y: Math.random() * c.height, r: Math.random() * 1.2 + 0.3, p: Math.random() * Math.PI * 2, s: 0.006 + Math.random() * 0.012 })); let tail = null, lastStarTime = 0, rafId = 0, visible = true; function maybeShoot(t) { if (RM) return; if (t - lastStarTime < 9000 + Math.random() * 6000) return; lastStarTime = t; tail = { x: Math.random() * c.width * 0.6 + c.width * 0.2, y: c.height * 0.12 + Math.random() * c.height * 0.2, vx: -3 - Math.random() * 2, vy: 1 + Math.random() * 1.5, life: 0 }; } function tick(ts) { k.clearRect(0, 0, c.width, c.height); const bg = k.createLinearGradient(0, 0, 0, c.height); bg.addColorStop(0, "#05060b"); bg.addColorStop(1, "#0b0e14"); k.fillStyle = bg; k.fillRect(0, 0, c.width, c.height); if (!RM) { const g = k.createLinearGradient(0, 0, c.width, 0); g.addColorStop(0, "rgba(122,243,255,0.085)"); g.addColorStop(0.5, "rgba(243,201,122,0.05)"); g.addColorStop(1, "rgba(177,140,255,0.085)"); k.fillStyle = g; const y = 40 + Math.sin(ts * 0.0005) * 16; k.beginPath(); k.moveTo(0, y + 8); for (let x = 0; x <= c.width; x += 18) { const yy = y + Math.sin((ts * 0.001) + x * 0.01) * 8; k.lineTo(x, yy); } k.lineTo(c.width, 0); k.lineTo(0, 0); k.closePath(); k.fill(); } stars.forEach(s => { const a = (Math.sin(s.p + ts * s.s) * 0.5 + 0.5) * 0.9 + 0.1; k.globalAlpha = a; k.beginPath(); k.arc(s.x, s.y, s.r, 0, Math.PI * 2); k.fillStyle = "#cfe9ff"; k.fill(); }); k.globalAlpha = 1; maybeShoot(ts); if (tail) { k.globalCompositeOperation = 'lighter'; k.strokeStyle = '#cfe9ff'; k.lineWidth = 1.2; k.beginPath(); k.moveTo(tail.x, tail.y); k.lineTo(tail.x - tail.vx * 12, tail.y - tail.vy * 12); k.stroke(); k.globalCompositeOperation = 'source-over'; tail.x += tail.vx; tail.y += tail.vy; tail.life++; if (tail.life > 60) tail = null; } rafId = requestAnimationFrame(tick); } STATE.roSky = ("IntersectionObserver" in window) ? new IntersectionObserver(([e]) => { const on = e && e.isIntersecting; if (on) { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(tick); } }) : null; STATE.roSky && STATE.roSky.observe(c); let hidden = false; on(document, "visibilitychange", () => { hidden = document.hidden; if (!hidden) { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(tick); } }); rafId = requestAnimationFrame(tick); })();

/* --------------------------- URL read/write ----------------------------- */ function readURL() { let u; try { u = new URL(location.href); } catch { return; } const d = u.searchParams.get("d"); const z = u.searchParams.get("tz"); const h = u.searchParams.get("t"); if (z && refs.tzPick) { refs.tzPick.value = z; safe(() => localStorage.setItem(TZ_KEY, z)); STATE.tz = z; } const tz = STATE.tz || (refs.tzPick && refs.tzPick.value) || "UTC"; if (refs.datePick) { if (d && validDateStr(d)) { refs.datePick.value = d; STATE.selISO = d; } else { const iso = dateInTZ(new Date(), tz).toISOString().slice(0, 10); refs.datePick.value = iso; STATE.selISO = iso; } } if (refs.hourScrub) { const curHour = new Date().getHours(); refs.hourScrub.value = (h != null && !Number.isNaN(+h)) ? clamp(+h, 0, 23) : curHour; STATE.hour = +refs.hourScrub.value; } } function writeURL() { let u; try { u = new URL(location.href); } catch { return; } if (refs.datePick && validDateStr(refs.datePick.value)) { u.searchParams.set("d", refs.datePick.value); STATE.selISO = refs.datePick.value; } if (refs.tzPick) { u.searchParams.set("tz", refs.tzPick.value); STATE.tz = refs.tzPick.value; } if (refs.hourScrub) { u.searchParams.set("t", refs.hourScrub.value); STATE.hour = +refs.hourScrub.value; } history.replaceState(null, "", u); }

/* ------------------------------ Notes ----------------------------------- */ function loadNote(key) { try { const all = JSON.parse(localStorage.getItem(NOTES_KEY) || "{}"); return all[key] || ""; } catch { return ""; } } function saveNote(key, val) { try { const all = JSON.parse(localStorage.getItem(NOTES_KEY) || "{}"); all[key] = val; localStorage.setItem(NOTES_KEY, JSON.stringify(all)); } catch {} }

/* ------------------------------ Update UI ------------------------------- */ function setRingDash(el, len, total) { if (el) el.setAttribute("stroke-dasharray", ${Math.round(len)} ${Math.max(0, total - Math.round(len))}); } function tweenRing(ts) { const ring = refs.ringArc; if (!ring) return; if (STATE.lastTween === 0) STATE.lastTween = ts; const dt = clamp((ts - STATE.lastTween) / 500, 0, 1); STATE.lastTween = ts; const t = prefersReduced() ? 1 : ease(dt); STATE.ringDashNow = STATE.ringDashNow + (STATE.ringDashTarget - STATE.ringDashNow) * t; setRingDash(ring, STATE.ringDashNow, 316); if (refs.ringArcMini) setRingDash(refs.ringArcMini, STATE.ringDashNow * (163 / 316), 163); if (Math.abs(STATE.ringDashNow - STATE.ringDashTarget) > 0.5) requestAnimationFrame(tweenRing); }

function updateAll(forceTween = false) { const tz = STATE.tz || (refs.tzPick && refs.tzPick.value) || "UTC"; const base = new Date(); const wall = dateInTZ(base, tz, STATE.hour);

if (refs.nowDate) {
  const long = fmtDate(wall, tz);
  const short = fmtShort(wall, tz) || long;
  refs.nowDate.textContent = long;
  refs.nowDate.setAttribute("data-short", short);
}
if (refs.nowClock) refs.nowClock.textContent = fmtTime(base, tz);
if (refs.nowTZ) refs.nowTZ.textContent = tz;

const selStr = STATE.selISO || dateInTZ(new Date(), tz).toISOString().slice(0, 10);
const sel = new Date(`${selStr}T${pad(STATE.hour)}:00:00Z`);

const m13 = calc13Moon(sel, tz);
if (refs.yearSpan) refs.yearSpan.textContent = m13.year;
if (refs.dootWarn) refs.dootWarn.style.display = m13.special ? "block" : "none";

if (m13.special) {
  refs.moonName && (refs.moonName.textContent = m13.special);
  refs.moonEss && (refs.moonEss.textContent = "Outside the 13×28 count");
  refs.dayInMoon && (refs.dayInMoon.textContent = "—");
  STATE.ringDashTarget = 0;
  refs.moonLine && (refs.moonLine.textContent = m13.special);
  refs.moonChip && refs.moonChip.removeAttribute("data-idx");
  if (refs.weekDots) { [...refs.weekDots.children].forEach(n => n.classList.remove("on")); refs.weekDots.setAttribute("aria-label", "No week/day (special)"); }
} else {
  const idx = m13.moon - 1;
  refs.moonName && (refs.moonName.textContent = `${MOONS[idx]} Moon (${m13.moon})`);
  refs.moonEss && (refs.moonEss.textContent = MOON_ESSENCE[idx]);
  if (refs.moonChip) { refs.moonChip.setAttribute("data-idx", String(m13.moon)); refs.moonChip.title = `${MOONS[idx]} — ${MOON_ESSENCE[idx]}`; }
  refs.dayInMoon && (refs.dayInMoon.textContent = String(m13.day));
  STATE.ringDashTarget = Math.round(316 * (m13.day / 28));
  refs.moonLine && (refs.moonLine.textContent = `You are in ${MOONS[idx]} Moon — Day ${m13.day} of 28`);
  if (refs.weekDots) {
    const week = Math.floor((m13.day - 1) / 7) + 1, dow = ((m13.day - 1) % 7) + 1;
    const nodes = [...refs.weekDots.children]; nodes.forEach(n => n.classList.remove("on"));
    const dotIndex = (week - 1) * 7 + (dow - 1); if (nodes[dotIndex]) nodes[dotIndex].classList.add("on");
    refs.weekDots.setAttribute("aria-label", `Week ${week}, Day ${dow} (1–7)`);
  }
  if (STATE.moonIdx !== m13.moon) { STATE.moonIdx = m13.moon; buildActivityForMoon(STATE.moonIdx); }
  refs.mbName && (refs.mbName.innerHTML = `<b>${MOONS[idx]}</b>`);
  refs.mbEssence && (refs.mbEssence.textContent = MOON_ESSENCE[idx]);
  refs.mbDay && (refs.mbDay.textContent = `${m13.day}/28`);
  refs.mbYear && (refs.mbYear.textContent = m13.year);
}

if (refs.ringArc) {
  if (forceTween || Math.abs(STATE.ringDashNow - STATE.ringDashTarget) > 2) {
    requestAnimationFrame(ts => { STATE.lastTween = ts; requestAnimationFrame(tweenRing); });
  } else {
    setRingDash(refs.ringArc, STATE.ringDashTarget, 316);
    if (refs.ringArcMini) setRingDash(refs.ringArcMini, STATE.ringDashTarget * (163 / 316), 163);
    STATE.ringDashNow = STATE.ringDashTarget;
  }
}

const nu = numerology(sel, tz);
refs.numLine && (refs.numLine.textContent = `Universal ${nu.total}`);
refs.numMeta && (refs.numMeta.textContent = `Month tone ${nu.monthN} • Day tone ${nu.dayN}`);
const qIdx = Math.abs(sel.getUTCFullYear() * 372 + (sel.getUTCMonth() + 1) * 31 + sel.getUTCDate()) % QUOTES.length;
refs.energyQuote && (refs.energyQuote.textContent = QUOTES[qIdx]);

const ph = moonPhase(dateInTZ(sel, tz, STATE.hour));
refs.phaseLine && (refs.phaseLine.textContent = `${ph.phase}`);
refs.phaseMeta && (refs.phaseMeta.textContent = `Age ≈ ${ph.ageDays.toFixed(1)} d • Illum ≈ ${(ph.illum * 100).toFixed(0)}%`);
applyPhaseAccent(ph.illum);
STATE.illum = ph.illum;
STATE.sunAngle = (STATE.hour / 24) * Math.PI * 2;

buildYearMap();

// Kin (optional)
if (refs.kinOn && refs.kinOn.checked) {
  const epochISO = (refs.kinEpoch && refs.kinEpoch.value) || "1987-07-26";
  const rules = {
    epochUTC: new Date(epochISO + "T00:00:00Z"),
    skipLeapDay: !!(refs.kinSkipLeap && refs.kinSkipLeap.checked),
    skipDOOT: !!(refs.kinSkipDOOT && refs.kinSkipDOOT.checked),
    tz
  };
  const k = kinFromDate(sel, rules);
  refs.kinBadge && (refs.kinBadge.textContent = `Kin ${k.kin} • Tone ${k.tone}`);
  refs.kinLine && (refs.kinLine.textContent = `${k.seal} • epoch ${epochISO}${rules.skipLeapDay ? " • −Leap" : ""}${rules.skipDOOT ? " • −DOOT" : ""}`);
} else {
  refs.kinBadge && (refs.kinBadge.textContent = "Kin —");
  refs.kinLine && (refs.kinLine.textContent = "—");
}

// Notes (keyed by year/moon/day)
if (refs.noteText) {
  const key = `Y${m13.year}|M${m13.special ? 0 : m13.moon}|D${m13.special ? 0 : m13.day}`;
  refs.noteText.value = loadNote(key);
  refs.saveNote && (refs.saveNote.onclick = () => saveNote(key, refs.noteText.value));
}

}

/* -------------------------- Animation driver ---------------------------- */ let raf = 0, animVisible = true, docHidden = false; function loop(ts) { if (!animVisible || docHidden) { raf = requestAnimationFrame(loop); return; } drawMoonSim(STATE.illum, STATE.sunAngle, ts); raf = requestAnimationFrame(loop); } const simIO = ("IntersectionObserver" in window && refs.simMoon) ? new IntersectionObserver(([e]) => { animVisible = !!(e && e.isIntersecting); }) : null; simIO && simIO.observe(refs.simMoon); on(document, "visibilitychange", () => { docHidden = document.hidden; }); raf = requestAnimationFrame(loop);

/* ------------------------------ Controls -------------------------------- */ // Populate TZ select (function initTZ() { const saved = safe(() => localStorage.getItem(TZ_KEY)) || safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone) || "UTC"; STATE.tz = saved; if (refs.tzPick) { let all = COMMON_TZ.slice(0); try { if (Intl.supportedValuesOf) { const full = Intl.supportedValuesOf("timeZone"); if (Array.isArray(full) && full.length) all = Array.from(new Set([...COMMON_TZ, ...full])); } } catch {} refs.tzPick.innerHTML = all.map(z => <option value="${z}">${z}</option>).join(""); refs.tzPick.value = all.includes(saved) ? saved : "UTC"; on(refs.tzPick, "change", () => { safe(() => localStorage.setItem(TZ_KEY, refs.tzPick.value)); writeURL(); updateAll(true); }, { passive: true }); } })();

// Buttons / inputs on(refs.btnToday, "click", () => { const tz = STATE.tz || "UTC"; const t = dateInTZ(new Date(), tz); if (refs.datePick) refs.datePick.value = t.toISOString().slice(0, 10); if (refs.hourScrub) refs.hourScrub.value = new Date().getHours(); STATE.selISO = refs.datePick ? refs.datePick.value : null; STATE.hour = +refs.hourScrub.value || new Date().getHours(); writeURL(); updateAll(true); }); on(refs.prevDay, "click", () => { if (!refs.datePick || !validDateStr(refs.datePick.value)) return; const d = new Date(refs.datePick.value + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - 1); refs.datePick.value = d.toISOString().slice(0, 10); writeURL(); updateAll(true); }); on(refs.nextDay, "click", () => { if (!refs.datePick || !validDateStr(refs.datePick.value)) return; const d = new Date(refs.datePick.value + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); refs.datePick.value = d.toISOString().slice(0, 10); writeURL(); updateAll(true); }); on(refs.shareLink, "click", () => { writeURL(); safe(() => navigator.clipboard.writeText(location.href)); const t = document.createElement("div"); t.className = "toast"; t.textContent = "Link copied"; document.body.appendChild(t); requestAnimationFrame(() => t.style.opacity = 1); setTimeout(() => { t.style.opacity = 0; setTimeout(() => t.remove(), 250); }, 1800); }); on(refs.datePick, "change", () => { STATE.selISO = refs.datePick.value; writeURL(); updateAll(true); }, { passive: true }); on(refs.hourScrub, "input", () => { STATE.hour = +refs.hourScrub.value; writeURL(); updateAll(true); }, { passive: true }); on(refs.hourScrub, "wheel", (e) => { e.preventDefault(); const dir = Math.sign(e.deltaY); const v = clamp((+refs.hourScrub.value || 0) + dir, 0, 23); refs.hourScrub.value = v; STATE.hour = v; writeURL(); updateAll(true); }, { passive: false });

on(document, "keydown", (e) => { if (e.altKey || e.metaKey || e.ctrlKey) return; if (e.key === "ArrowLeft" || e.key === "ArrowRight") { const delta = e.key === "ArrowRight" ? 1 : -1; if (refs.hourScrub) { const v = clamp((+refs.hourScrub.value || 0) + delta, 0, 23); refs.hourScrub.value = v; STATE.hour = v; writeURL(); updateAll(true); } e.preventDefault(); } else if (e.key === "ArrowUp" || e.key === "ArrowDown") { if (!refs.datePick || !validDateStr(refs.datePick.value)) return; const d = new Date(refs.datePick.value + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + (e.key === "ArrowUp" ? 1 : -1)); refs.datePick.value = d.toISOString().slice(0, 10); STATE.selISO = refs.datePick.value; writeURL(); updateAll(true); e.preventDefault(); } });

// Jump to moon on(refs.jumpMoon, "change", () => { const v = +refs.jumpMoon.value || 0; if (!v) return; const tz = STATE.tz || "UTC"; const anchor = startOfYear13(dateInTZ(new Date(), tz, STATE.hour), tz); let start = new Date(anchor); for (let i = 1; i < v; i++) start = addDaysSkippingSpecials(start, 28, tz); if (refs.datePick) { refs.datePick.value = dateInTZ(start, tz).toISOString().slice(0, 10); STATE.selISO = refs.datePick.value; writeURL(); updateAll(true); } }, { passive: true });

// Prev/Next moon controls in calendar section (if present, calendars module will also wire) on(refs.prevMoon, "click", () => { const tz = STATE.tz || "UTC"; if (!refs.datePick) return; let d = new Date(${(refs.datePick.value || dateInTZ(new Date(), tz).toISOString().slice(0, 10))}T00:00:00Z); for (let i = 0; i < 28; i++) d = addDaysSkippingSpecials(d, -1, tz); refs.datePick.value = d.toISOString().slice(0, 10); STATE.selISO = refs.datePick.value; writeURL(); updateAll(true); }, { passive: true }); on(refs.nextMoon, "click", () => { const tz = STATE.tz || "UTC"; if (!refs.datePick) return; let d = new Date(${(refs.datePick.value || dateInTZ(new Date(), tz).toISOString().slice(0, 10))}T00:00:00Z); for (let i = 0; i < 28; i++) d = addDaysSkippingSpecials(d, 1, tz); refs.datePick.value = d.toISOString().slice(0, 10); STATE.selISO = refs.datePick.value; writeURL(); updateAll(true); }, { passive: true });

// Kin toggles [refs.kinOn, refs.kinEpoch, refs.kinSkipLeap, refs.kinSkipDOOT].forEach(el => on(el, "change", () => updateAll(true), { passive: true }));

// Open Birth Seal — deep link with params function sealURL() { const u = new URL((refs.openSeal && refs.openSeal.getAttribute("href")) || "genesis-oracle.html", location.href); if (STATE.selISO) u.searchParams.set("d", STATE.selISO); if (STATE.tz) u.searchParams.set("tz", STATE.tz); if (Number.isFinite(STATE.hour)) u.searchParams.set("t", String(STATE.hour)); return u.toString(); } if (refs.openSeal) on(refs.openSeal, "click", (e) => { refs.openSeal.setAttribute("href", sealURL()); }, { passive: true }); if (refs.openSealHeader) on(refs.openSealHeader, "click", (e) => { refs.openSealHeader.setAttribute("href", sealURL()); }, { passive: true });

// Mini moonbar share card hook (placeholder trigger) on(refs.mbShareBtn, "click", () => { // Intentional stub: generate share image in a future module. const t = document.createElement("div"); t.className = "toast"; t.textContent = "Share card generator coming online…"; document.body.appendChild(t); requestAnimationFrame(() => t.style.opacity = 1); setTimeout(() => { t.style.opacity = 0; setTimeout(() => t.remove(), 250); }, 1500); });

// Clock tick (live only when selected date == today in TZ) setInterval(() => { if (refs.nowClock && STATE.tz) refs.nowClock.textContent = fmtTime(new Date(), STATE.tz); if (!STATE.tz || !refs.datePick) return; const tz = STATE.tz; const today = dateInTZ(new Date(), tz).toISOString().slice(0, 10); if (refs.datePick.value === today) { updateAll(); } }, 1000);

/* ------------------------------ Astro stub ------------------------------ */ (function astroInit() { if (refs.astroTZ) refs.astroTZ.textContent = STATE.tz || "UTC"; if (refs.astroSource) refs.astroSource.textContent = "Local ephemeris (stub)"; if (refs.astroStamp) refs.astroStamp.textContent = new Date().toISOString().slice(0, 16).replace("T", " "); // Wheel grid (houses / signs) simple scaffold const wheel = refs.astroWheel; if (!wheel) return; const houseLines = wheel.querySelector("#houseLines"); const signLabels = wheel.querySelector("#signLabels"); if (houseLines && !houseLines.childElementCount) { for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const x = 180 + Math.cos(a) * 150, y = 180 + Math.sin(a) * 150; const l = document.createElementNS("http://www.w3.org/2000/svg", "line"); l.setAttribute("x1", "180"); l.setAttribute("y1", "180"); l.setAttribute("x2", String(x)); l.setAttribute("y2", String(y)); houseLines.appendChild(l); } } const SIGNS = ["♈︎","♉︎","♊︎","♋︎","♌︎","♍︎","♎︎","♏︎","♐︎","♑︎","♒︎","♓︎"]; if (signLabels && !signLabels.childElementCount) { for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 - Math.PI / 2; const x = 180 + Math.cos(a) * 135, y = 180 + Math.sin(a) * 135 + 4; const t = document.createElementNS("http://www.w3.org/2000/svg", "text"); t.setAttribute("x", String(x)); t.setAttribute("y", String(y)); t.textContent = SIGNS[i]; signLabels.appendChild(t); } } })();

/* ------------------------------- Boot ----------------------------------- */ (function boot() { try { // Guard footer year const y = $("#yr"); y && (y.textContent = new Date().getFullYear());

// Build week dots if missing
  if (refs.weekDots && !refs.weekDots.children.length) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 28; i++) { const d = document.createElement("i"); d.className = "dot"; d.setAttribute("aria-hidden", "true"); frag.appendChild(d); }
    refs.weekDots.appendChild(frag);
  }
  readURL();
  // If tzPick had no options (early boot), populate minimal list
  if (refs.tzPick && !refs.tzPick.options.length) {
    refs.tzPick.innerHTML = COMMON_TZ.map(z => `<option value="${z}">${z}</option>`).join("");
    refs.tzPick.value = STATE.tz || "UTC";
  }
  // Initial activity ring (default to current moon once computed)
  buildActivityForMoon(STATE.moonIdx || 1);
  updateAll(true);
  buildYearMap();
} catch (e) {
  console.error("Init failed:", e);
  const n = document.createElement("div");
  n.style.cssText = "position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:99999;background:#230b0b;color:#ffd7d7;border:1px solid #712828;padding:8px 10px;border-radius:10px;font:600 13px/1.3 Inter";
  n.textContent = "Moons: init failed — see console";
  document.body.appendChild(n);
}

})();

/* ------------------------------ Exports --------------------------------- */ window.sof_core = { dateInTZ, fmtDate, fmtShort, fmtTime, pad, startOfYear13, yearMoonSpans, addDaysSkippingSpecials, validDateStr, writeURL, updateAll };

})();
