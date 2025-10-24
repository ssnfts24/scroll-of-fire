/*! Astrology Panel · Lite Provider (Sun+Moon) · v1.0
   - Accurate-ish Sun & Moon longitudes (Meeus-lite series), sign/degree/speed
   - SVG zodiac wheel with pointers
   - Sun↔Moon aspects (orb: 6° default)
   - Pluggable providers: swap in a full ephemeris without changing the UI code
   - No external requests. Timezone-aware via system/selected tz (if present)
*/
(function(){
  "use strict";

  // ---------- Tiny math kit ----------
  const TAU = Math.PI*2;
  const deg2rad = d => d*(Math.PI/180);
  const rad2deg = r => r*(180/Math.PI);
  const norm360 = d => ((d%360)+360)%360;
  const sin = x => Math.sin(deg2rad(x));
  const cos = x => Math.cos(deg2rad(x));

  // Julian Day (UT) from Date
  function toJulian(dateUTC){
    const a = Math.floor((14-(dateUTC.getUTCMonth()+1))/12);
    const y = dateUTC.getUTCFullYear()+4800-a;
    const m = (dateUTC.getUTCMonth()+1)+12*a-3;
    const JDN = dateUTC.getUTCDate() + Math.floor((153*m+2)/5) + 365*y + Math.floor(y/4) - Math.floor(y/100) + Math.floor(y/400) - 32045;
    const frac = (dateUTC.getUTCHours()-12)/24 + dateUTC.getUTCMinutes()/1440 + dateUTC.getUTCSeconds()/86400 + dateUTC.getUTCMilliseconds()/86400000;
    return JDN + frac;
  }

  // Convert local date (or tzPick value if present) to a UTC Date reflecting that zone
  function currentZonedDate(){
    const tzSel = document.getElementById("tzPick");
    const base = new Date();
    const tz = tzSel && tzSel.value ? tzSel.value : Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Build ISO for that TZ using Intl (no libs)
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false
    }).formatToParts(base).reduce((o,p)=> (o[p.type]=p.value,o),{});
    // YYYY-MM-DDTHH:mm:ss in that zone, then parse as if it's UTC by appending 'Z'
    const iso = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`;
    return new Date(iso);
  }

  // ---------- Zodiac helpers ----------
  const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
  function degToSign(d){
    const lon = norm360(d);
    const idx = Math.floor(lon/30);
    const degIn = lon - idx*30;
    const whole = Math.floor(degIn);
    const min = Math.round((degIn - whole)*60);
    return { sign: SIGNS[idx], idx, deg: whole, min };
  }

  // ---------- Sun & Moon (Meeus-lite) ----------
  // Sun ecliptic longitude (geocentric apparent, low-precision)
  function sunLongitudeJD(JD){
    const T = (JD - 2451545.0)/36525;
    const L0 = norm360(280.46646 + 36000.76983*T + 0.0003032*T*T);
    const M  = norm360(357.52911 + 35999.05029*T - 0.0001537*T*T);
    const C  = (1.914602 - 0.004817*T - 0.000014*T*T)*sin(M)
             + (0.019993 - 0.000101*T)*sin(2*M)
             + 0.000289*sin(3*M);
    const trueLong = L0 + C;
    // nutation/aberration small correction (few arcmin) – good enough to omit here
    return norm360(trueLong);
  }

  // Moon ecliptic longitude (very short series; <~0.5–1° typical)
  function moonLongitudeJD(JD){
    const D = JD - 2451545.0;
    const L0 = norm360(218.3164477 + 13.17639648*D);         // Moon's mean longitude
    const Mm = norm360(134.9633964 + 13.06499295*D);         // Moon's mean anomaly
    const Ms = norm360(357.5291092 + 0.98560028*D);          // Sun's mean anomaly
    const F  = norm360(93.2720950  + 13.22935024*D);         // Moon's argument of latitude
    const Dm = norm360(297.8501921 + 12.19074912*D);         // Mean elongation of the Moon
    // Very reduced series (Meeus chapters 47/49 inspired)
    let lon = L0
      + 6.289 * sin(Mm)
      + 1.274 * sin(2*Dm - Mm)
      + 0.658 * sin(2*Dm)
      + 0.214 * sin(2*Mm)
      + 0.11  * sin(Dm)
      - 0.186 * sin(Ms)
      - 0.114 * sin(2*F);
    return norm360(lon);
  }

  // Speed (deg/day) via small delta
  function speedDegPerDay(fn, JD){
    const dt = 0.5; // half day
    const a = fn(JD - dt), b = fn(JD + dt);
    let d = b - a; if (d > 180) d -= 360; if (d < -180) d += 360;
    return d / (2*dt);
  }

  // ---------- Aspect detection ----------
  const ASPECTS = [
    { key:"conj",  name:"Conjunction",  angle:  0, orb:6 },
    { key:"sext",  name:"Sextile",      angle: 60, orb:4 },
    { key:"square",name:"Square",       angle: 90, orb:5 },
    { key:"trine", name:"Trine",        angle:120, orb:5 },
    { key:"oppo",  name:"Opposition",   angle:180, orb:6 }
  ];
  function findAspect(a, b){
    const diff = Math.abs(norm360(a-b));
    const dist = Math.min(diff, 360-diff);
    for (const asp of ASPECTS){
      if (Math.abs(dist - asp.angle) <= asp.orb){
        return { ...asp, delta: +(dist - asp.angle).toFixed(2) };
      }
    }
    return null;
  }

  // ---------- Providers ----------
  const Providers = {
    // Lite: Sun + Moon only (sign, degree, speed)
    lite: function computeLite(dateUTC){
      const JD = toJulian(dateUTC);
      const sunLon  = sunLongitudeJD(JD);
      const moonLon = moonLongitudeJD(JD);
      const sunSpd  = speedDegPerDay(sunLongitudeJD, JD);
      const moonSpd = speedDegPerDay(moonLongitudeJD, JD);
      return {
        datetime: dateUTC.toISOString(),
        bodies: {
          Sun:  { lon:sunLon,  speed:sunSpd  },
          Moon: { lon:moonLon, speed:moonSpd }
        }
      };
    },

    // Example adapter: pass in a JSON object shaped like:
    // { bodies: { Sun:{lon,speed}, Moon:{lon,speed}, Mercury:{lon,speed}, ... } }
    // so you can plug Swiss Ephemeris or JPL output and reuse the same UI code.
    fromJSON: (obj)=> obj
  };

  // ---------- UI painting ----------
  function formatDeg(lon){
    const {sign, deg, min} = degToSign(lon);
    const pad = n => String(n).padStart(2,"0");
    return { text:`${deg}°${pad(min)}′ ${sign}`, sign, deg, min };
  }

  function setText(sel, txt){ const el = typeof sel==="string" ? document.querySelector(sel) : sel; if(el) el.textContent = txt; }
  function q(sel){ return document.querySelector(sel); }

  // Fill planet chip
  function paintChip(root, bodyName, lon){
    const el = root.querySelector(`.pl-${bodyName.toLowerCase()} .sg`);
    if (!el) return;
    const fmt = formatDeg(lon);
    el.textContent = `${fmt.text}`;
  }

  // Fill ephemeris row
  function paintEphemerisRow(table, body, lon, speed){
    const tbody = table.tBodies[0] || table.appendChild(document.createElement("tbody"));
    let row = [...tbody.rows].find(r => r.firstChild && r.firstChild.textContent.trim().toLowerCase()===body.toLowerCase());
    if (!row){
      row = tbody.insertRow(-1);
      ["","", "","", ""].forEach(()=> row.insertCell(-1));
      row.cells[0].textContent = body;
      row.cells[4].className = "meta";
      row.cells[2].className = "deg";
    }
    const fmt = formatDeg(lon);
    row.cells[1].textContent = fmt.sign;
    row.cells[2].textContent = `${fmt.deg}°${String(fmt.min).padStart(2,"0")}′`;
    row.cells[3].textContent = `${speed>=0?"+":""}${speed.toFixed(2)}°/d`;
    row.cells[4].textContent = body==="Moon" ? "—fast mover" : "—";
  }

  // Draw simple zodiac wheel SVG into #zodiacWheel
  function paintWheel(container, bodies){
    if (!container) return;
    const size = Math.min(container.clientWidth||320, 520);
    const r = Math.floor(size/2)-18;
    const cx = Math.floor(size/2), cy = cx;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.setAttribute("width", size); svg.setAttribute("height", size);

    const bg = document.createElementNS(svgNS, "circle");
    bg.setAttribute("cx", cx); bg.setAttribute("cy", cy); bg.setAttribute("r", r);
    bg.setAttribute("fill", "none"); bg.setAttribute("stroke", "var(--line)"); bg.setAttribute("stroke-width", "1.5");
    svg.appendChild(bg);

    // 12 signs
    for (let i=0;i<12;i++){
      const a0 = deg2rad(i*30-90), a1 = deg2rad((i+1)*30-90);
      const x0 = cx + r*Math.cos(a0), y0 = cy + r*Math.sin(a0);
      const x1 = cx + r*Math.cos(a1), y1 = cy + r*Math.sin(a1);
      const tick = document.createElementNS(svgNS, "line");
      tick.setAttribute("x1", x0); tick.setAttribute("y1", y0);
      tick.setAttribute("x2", x1); tick.setAttribute("y2", y1);
      tick.setAttribute("stroke", "var(--line)"); tick.setAttribute("stroke-width", ".8");
      svg.appendChild(tick);

      // sign label
      const mid = deg2rad((i*30+15)-90);
      const lx = cx + (r-18)*Math.cos(mid), ly = cy + (r-18)*Math.sin(mid);
      const t = document.createElementNS(svgNS, "text");
      t.setAttribute("x", lx); t.setAttribute("y", ly);
      t.setAttribute("text-anchor","middle"); t.setAttribute("dominant-baseline","central");
      t.setAttribute("font-size","10"); t.setAttribute("fill","var(--muted)");
      t.textContent = SIGNS[i][0]; // initial
      svg.appendChild(t);
    }

    // pointers
    function pointer(angleDeg, colorVar){
      const a = deg2rad(angleDeg-90);
      const x = cx + (r-6)*Math.cos(a), y = cy + (r-6)*Math.sin(a);
      const p = document.createElementNS(svgNS, "circle");
      p.setAttribute("cx", x); p.setAttribute("cy", y); p.setAttribute("r", 4.2);
      p.setAttribute("fill", colorVar);
      p.setAttribute("filter","drop-shadow(0 0 6px color-mix(in srgb, var(--moon-accent) 35%, transparent))");
      return p;
    }

    if (bodies.Sun)  svg.appendChild(pointer(bodies.Sun.lon, "url(#mbGrad)"));
    if (bodies.Moon) svg.appendChild(pointer(bodies.Moon.lon, "url(#mbGrad)"));

    container.innerHTML = "";
    container.appendChild(svg);
  }

  // Paint aspects line
  function paintAspects(root, bodies){
    const el = root.querySelector("#aspects");
    if (!el || !bodies.Sun || !bodies.Moon) return;
    const asp = findAspect(bodies.Sun.lon, bodies.Moon.lon);
    // Reset labels
    el.querySelectorAll(".aspect").forEach(a=>{
      const base = a.className.replace(/\s+is-on/g,"");
      a.className = base;
      a.textContent = a.textContent.replace(/ —.*/," —");
    });
    if (asp){
      const t = el.querySelector(`.aspect--${asp.key}`);
      if (t){ t.className += " is-on"; t.textContent = `${t.textContent.trim()} Δ ${Math.abs(asp.delta)}°`; }
    }
  }

  // Main init
  function initAstrologyPanel(provider="lite"){
    const root = q('article.card.col-12.shine') || document; // rough scope
    const wheel = q("#zodiacWheel");
    const table = q("#ephem");
    const chipsRoot = q("#planetChips");
    if (!q("#astro-head")) return; // panel not present

    // pull a date that respects selected TZ if available
    const dateUTC = currentZonedDate();

    // compute
    const pack = Providers[provider] ? Providers[provider](dateUTC) : Providers.lite(dateUTC);
    const bodies = pack.bodies || {};

    // paint chips
    if (chipsRoot){
      if (bodies.Sun)  paintChip(chipsRoot, "Sun",  bodies.Sun.lon);
      if (bodies.Moon) paintChip(chipsRoot, "Moon", bodies.Moon.lon);
    }
    // ephemeris rows
    if (table){
      if (bodies.Sun)  paintEphemerisRow(table, "Sun",  bodies.Sun.lon,  bodies.Sun.speed ?? 0.9856);
      if (bodies.Moon) paintEphemerisRow(table, "Moon", bodies.Moon.lon, bodies.Moon.speed ?? 13.176);
    }
    // wheel + aspects
    paintWheel(wheel, bodies);
    paintAspects(document, bodies);
  }

  // Repaint when TZ/date/hour change (hooks exist in your page)
  function bindLiveRefresh(){
    const ids = ["tzPick","datePick","hourScrub"];
    ids.forEach(id=>{
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", ()=> initAstrologyPanel("lite"), {passive:true});
      if (el) el.addEventListener("change", ()=> initAstrologyPanel("lite"), {passive:true});
    });
    // Also repaint when your app fires accent changes (cosmetic only)
    document.addEventListener("sof:accent-change", ()=> initAstrologyPanel("lite"));
  }

  // Autostart
  window.addEventListener("DOMContentLoaded", ()=>{
    initAstrologyPanel("lite");
    bindLiveRefresh();
  });

  // Expose adapters
  window.SOFAstro = {
    init: initAstrologyPanel,
    // Use this to paint with your own data:
    // SOFAstro.init('json', myPack) → see below wrapper
    useJSON(pack){
      if (!pack || !pack.bodies) return;
      // temporarily replace call
      const stored = { ...pack };
      const original = Providers.lite;
      Providers.lite = ()=> Providers.fromJSON(stored);
      initAstrologyPanel("lite");
      Providers.lite = original;
    }
  };
})();
