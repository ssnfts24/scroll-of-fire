<script>
/*! Astrology Panel · v3.0 (Sun–Saturn, no APIs)
    - Sun/Moon: Meeus-lite
    - Mercury–Saturn: Schlyter low-precision (heliocentric → geocentric, J2000)
    - Retrograde, DMS formatting, sign names/glyphs
    - Paints modern UI: chips [data-pos]/[data-sign], sacred wheel #astroWheel [data-dot], aspects #aspBody
    - Live updates on tz/date/hour; resizes wheel
    - Escape hatches: window.SOFAstro.render(..), .compute(..), .demo(..)
*/
(function(){
  "use strict";

  /* ───────────────────────── Core math & helpers ───────────────────────── */

  const PI=Math.PI, TAU=2*PI, RAD=PI/180, DEG=180/PI;
  const sin=d=>Math.sin(d*RAD), cos=d=>Math.cos(d*RAD), atan2d=(y,x)=>Math.atan2(y,x)*DEG;
  const norm360 = d => ((d%360)+360)%360;
  const clamp = (v,a,b)=>Math.min(b,Math.max(a,v));
  const pad2 = n => String(n).padStart(2,"0");

  // Julian Day from a UTC Date (Meeus)
  function toJD(dUTC){
    const a = Math.floor((14-(dUTC.getUTCMonth()+1))/12);
    const y = dUTC.getUTCFullYear()+4800-a;
    const m = (dUTC.getUTCMonth()+1)+12*a-3;
    const JDN = dUTC.getUTCDate()+Math.floor((153*m+2)/5)+365*y+Math.floor(y/4)-Math.floor(y/100)+Math.floor(y/400)-32045;
    const frac=(dUTC.getUTCHours()-12)/24 + dUTC.getUTCMinutes()/1440 + dUTC.getUTCSeconds()/86400 + dUTC.getUTCMilliseconds()/86400000;
    return JDN+frac;
  }

  // Build a UTC Date from UI’s TZ/date/hour, else now
  function currentZonedUTC(){
    const tzSel=document.getElementById("tzPick");
    const datePick=document.getElementById("datePick");
    const hourScrub=document.getElementById("hourScrub");
    const base=new Date();
    const tz = tzSel?.value || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    // chosen calendar day (or today in tz)
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})
      .formatToParts(base).reduce((o,p)=>(o[p.type]=p.value,o),{});

    const y = (datePick?.value?.slice(0,4)) || parts.year;
    const M = (datePick?.value?.slice(5,7)) || parts.month;
    const d = (datePick?.value?.slice(8,10))|| parts.day;
    const h = (hourScrub?.value ?? parts.hour);

    // synthesize a UTC string that represents wall time in tz
    return new Date(`${y}-${M}-${d}T${pad2(h)}:${parts.minute}:${parts.second}Z`);
  }

  /* ───────────────────────── Sun & Moon (Meeus-lite) ───────────────────── */

  function sunLonJD(JD){
    const T=(JD-2451545)/36525;
    const L0=norm360(280.46646+36000.76983*T+0.0003032*T*T);
    const M =norm360(357.52911+35999.05029*T-0.0001537*T*T);
    const C =(1.914602-0.004817*T-0.000014*T*T)*sin(M)
           +(0.019993-0.000101*T)*sin(2*M)
           +0.000289*sin(3*M);
    // apparent longitude (lite): ignore aberration & nutation → good enough for UI
    return norm360(L0+C);
  }

  function moonLonJD(JD){
    const D = JD - 2451545.0;
    const L0= norm360(218.3164477 + 13.17639648*D);
    const Mm= norm360(134.9633964 + 13.06499295*D);
    const Ms= norm360(357.5291092 + 0.98560028*D);
    const F = norm360(93.2720950  + 13.22935024*D);
    const Dm= norm360(297.8501921 + 12.19074912*D);

    let lon = L0
      +6.289 * sin(Mm)
      +1.274 * sin(2*Dm - Mm)
      +0.658 * sin(2*Dm)
      +0.214 * sin(2*Mm)
      +0.11  * sin(Dm)
      -0.186 * sin(Ms)
      -0.114 * sin(2*F);
    return norm360(lon);
  }

  // central-difference speed (deg/day) for a lon fn
  function speedDegPerDay(fn, JD){
    const h=0.5; let a=fn(JD-h), b=fn(JD+h);
    let d=b-a; if(d>180)d-=360; if(d<-180)d+=360;
    return d/(2*h);
  }

  /* ───────────── Mercury–Saturn: Schlyter elements → helio XYZ → geo lon ─ */

  const ELEM = {
    Mercury: { N:48.3313, Nd:3.24587E-5,  i:7.0047,  id:5.00E-8,   w:29.1241,  wd:1.01444E-5, a:0.387098, ad:0, e:0.205635, ed:5.59E-10,   M:168.6562, Md:4.0923344368 },
    Venus:   { N:76.6799, Nd:2.46590E-5,  i:3.3946,  id:2.75E-8,   w:54.8910,  wd:1.38374E-5, a:0.723330, ad:0, e:0.006773, ed:-1.30E-9,  M:48.0052,  Md:1.6021302244 },
    Earth:   { N:0,       Nd:0,           i:0,       id:0,         w:282.9404, wd:4.70935E-5, a:1.000000, ad:0, e:0.016709, ed:-1.151E-9, M:356.0470, Md:0.9856002585 },
    Mars:    { N:49.5574, Nd:2.11081E-5,  i:1.8497,  id:-1.78E-8,  w:286.5016, wd:2.92961E-5, a:1.523688, ad:0, e:0.093405, ed:2.516E-9,  M:18.6021,  Md:0.5240207766 },
    Jupiter: { N:100.4542,Nd:2.76854E-5,  i:1.3030,  id:-1.55E-8,  w:273.8777, wd:1.64505E-5, a:5.20256,  ad:0, e:0.048498, ed:4.469E-9,  M:19.8950,  Md:0.0830853001 },
    Saturn:  { N:113.6634,Nd:2.38980E-5,  i:2.4886,  id:-1.081E-7, w:339.3939, wd:2.97661E-5, a:9.55475,  ad:0, e:0.055546, ed:-9.499E-9, M:316.9670, Md:0.0334442282 }
  };

  function keplerE(Mdeg, e){
    // Newton for E with a good seed (radians)
    const M = Mdeg*RAD;
    let E = (e < 0.8 ? M + e*Math.sin(M) : PI); // seed
    for(let k=0;k<10;k++){
      const f  = E - e*Math.sin(E) - M;
      const fp = 1 - e*Math.cos(E);
      const dE = f/fp;
      E -= dE;
      if(Math.abs(dE) < 1e-12) break;
    }
    return E;
  }

  function helioXYZ(body, d){ // d = days since J2000.0
    const el=ELEM[body];
    const N=(el.N + el.Nd*d)*RAD;
    const i=(el.i + el.id*d)*RAD;
    const w=(el.w + el.wd*d)*RAD;
    const a= el.a + el.ad*d;
    const e= el.e + el.ed*d;
    const M= norm360(el.M + el.Md*d);
    const E= keplerE(M, e);

    const xv = a*(Math.cos(E) - e);
    const yv = a*(Math.sqrt(1-e*e) * Math.sin(E));
    const v  = Math.atan2(yv, xv); // true anomaly (rad)
    const r  = Math.sqrt(xv*xv + yv*yv);

    // ecliptic heliocentric
    const x = r*( Math.cos(N)*Math.cos(v+w) - Math.sin(N)*Math.sin(v+w)*Math.cos(i) );
    const y = r*( Math.sin(N)*Math.cos(v+w) + Math.cos(N)*Math.sin(v+w)*Math.cos(i) );
    const z = r*( Math.sin(v+w)*Math.sin(i) );

    return {x,y,z,r, v:v*DEG, lon:norm360(atan2d(y,x))};
  }

  function planetGeoLon(body, JD){
    const d = JD - 2451543.5;
    const p = helioXYZ(body, d);
    const e = helioXYZ("Earth", d);
    // geocentric vector P - E  (ignore light-time/nutation → UI-grade)
    const X=p.x - e.x, Y=p.y - e.y; // Z not used for ecliptic lon
    return norm360(atan2d(Y, X));
  }

  function retrograde(body, JD){
    const h=1;
    let a=planetGeoLon(body, JD-h), b=planetGeoLon(body, JD+h);
    let d=b-a; if(d>180)d-=360; if(d<-180)d+=360;
    return d<0;
  }

  /* ───────────────────────── Aspects & formatting ──────────────────────── */

  const ASPECTS = [
    {key:"conj",  name:"Conjunction", angle:  0, orb:6},
    {key:"sext",  name:"Sextile",     angle: 60, orb:4},
    {key:"square",name:"Square",      angle: 90, orb:5},
    {key:"trine", name:"Trine",       angle:120, orb:5},
    {key:"oppo",  name:"Opposition",  angle:180, orb:6}
  ];
  function aspectBetween(a,b){
    const d=Math.abs(norm360(a-b));
    const dist=Math.min(d,360-d);
    for(const asp of ASPECTS){
      const delta = dist - asp.angle;
      if (Math.abs(delta) <= asp.orb) return {...asp, delta:+delta.toFixed(2)};
    }
    return null;
  }

  const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
  const GLYPH = ["\u2648","\u2649","\u264A","\u264B","\u264C","\u264D","\u264E","\u264F","\u2650","\u2651","\u2652","\u2653"];

  function toDMS(lon){
    const L=norm360(lon), s=Math.floor(L/30), d=L - s*30;
    const deg=Math.floor(d), min=Math.round((d-deg)*60);
    return {sign:SIGNS[s], glyph:GLYPH[s], idx:s, deg, min};
  }

  /* ───────────────────────── Rendering (modern UI) ─────────────────────── */

  // Static wheel scaffolding (houses + labels)
  function buildWheel(){
    const svg=document.getElementById('astroWheel');
    if(!svg) return;
    const gH=document.getElementById('houseLines');
    const gS=document.getElementById('signLabels');
    if(!gH||!gS) return;

    const bb = svg.viewBox.baseVal;
    const cx = bb ? bb.width/2 : 180;
    const cy = bb ? bb.height/2: 180;
    const R  = 145;

    gH.innerHTML=''; gS.innerHTML='';
    for(let i=0;i<12;i++){
      const a=-PI/2 + i*(TAU/12);
      const x = cx + Math.cos(a)*R;
      const y = cy + Math.sin(a)*R;
      const x2= cx + Math.cos(a)*(R-16);
      const y2= cy + Math.sin(a)*(R-16);
      gH.insertAdjacentHTML('beforeend', `<line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}"></line>`);
    }
    for(let i=0;i<12;i++){
      const a=-PI/2 + (i+0.5)*(TAU/12);
      const x=cx+Math.cos(a)*(R-26);
      const y=cy+Math.sin(a)*(R-26)+3;
      gS.insertAdjacentHTML('beforeend', `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}">${GLYPH[i]}</text>`);
    }
  }

  function posForLon(lon){
    const svg=document.getElementById('astroWheel');
    const bb = svg?.viewBox?.baseVal || {width:360,height:360};
    const cx=bb.width/2, cy=bb.height/2, R=145;
    const a = (-90 + lon) * RAD; // Aries 0° at top
    return { x: cx + Math.cos(a)*R, y: cy + Math.sin(a)*R };
  }

  function paintChips(planets){
    const keys = Object.keys(planets);
    for(const k of keys){
      const p = planets[k];
      const dms = toDMS(p.lon);
      document.querySelector(`.pos[data-pos="${k}"]`)
        ?.replaceChildren(document.createTextNode(`${dms.deg}°${pad2(dms.min)}′`));
      document.querySelector(`.sign[data-sign="${k}"]`)
        ?.replaceChildren(document.createTextNode(dms.sign));
    }
  }

  function paintWheelDots(planets){
    for (const k of Object.keys(planets)){
      const p = planets[k];
      const dot=document.querySelector(`[data-dot="${k}"]`);
      if (!dot || typeof p.lon!=="number") continue;
      const xy=posForLon(p.lon);
      dot.setAttribute('cx', xy.x.toFixed(1));
      dot.setAttribute('cy', xy.y.toFixed(1));
    }
  }

  function paintAspectsTable(planets){
    const body=document.getElementById('aspBody'); if(!body) return;
    body.innerHTML='';
    const entries = ["sun","moon","mercury","venus","mars","jupiter","saturn"];
    for(let i=0;i<entries.length;i++){
      for(let j=i+1;j<entries.length;j++){
        const a=entries[i], b=entries[j];
        const pa=planets[a], pb=planets[b];
        if(!pa||!pb) continue;
        const asp=aspectBetween(pa.lon, pb.lon);
        if(!asp) continue;
        const pair = `${titleCase(a)} ${symbolFor(asp.key)} ${titleCase(b)}`;
        body.insertAdjacentHTML('beforeend',
          `<tr><td>${pair}</td><td>${asp.name}</td><td>${Math.abs(asp.delta)}°</td></tr>`);
      }
    }
  }

  function titleCase(s){ return s ? s[0].toUpperCase()+s.slice(1) : s; }
  function symbolFor(key){
    if(key==="conj") return "☌";
    if(key==="sext") return "✶";
    if(key==="square") return "□";
    if(key==="trine") return "△";
    if(key==="oppo") return "☍";
    return "·";
    }

  function setStampMeta(context){
    const {tz, iso, source} = context;
    const stamp = iso.slice(0,16).replace('T',' ');
    const elStamp = document.getElementById('astroStamp');
    const elTZ    = document.getElementById('astroTZ');
    const elSrc   = document.getElementById('astroSource');
    if(elStamp) elStamp.textContent = stamp;
    if(elTZ)    elTZ.textContent    = tz || "UTC";
    if(elSrc)   elSrc.textContent   = source || "In-browser";
  }

  /* ───────────────────────── Compute pack (Sun–Saturn) ─────────────────── */

  function computePack(dateUTC){
    const JD=toJD(dateUTC);
    const bodies={};

    bodies.sun  = { lon: sunLonJD(JD),  speed: speedDegPerDay(sunLonJD, JD) };
    bodies.moon = { lon: moonLonJD(JD), speed: speedDegPerDay(moonLonJD, JD) };

    // classical planets
    ["Mercury","Venus","Mars","Jupiter","Saturn"].forEach(name=>{
      const lon  = planetGeoLon(name, JD);
      const lon2 = planetGeoLon(name, JD+0.5);
      let d = lon2-lon; if(d>180)d-=360; if(d<-180)d+=360;
      const speed = d/0.5;
      bodies[name.toLowerCase()] = { lon, speed, retro: retrograde(name, JD) };
    });

    return bodies;
  }

  /* ───────────────────────── Controller: update cycle ──────────────────── */

  let lastPaintKey = "";

  function updateAll(){
    // build time context from UI
    const tz = document.getElementById('tzPick')?.value || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const dUTC = currentZonedUTC();
    const iso  = new Date(dUTC).toISOString();

    // compute
    const bodies = computePack(dUTC);

    // avoid redundant repaints (minute granularity)
    const key = iso.slice(0,16) + "|" + tz;
    if (key === lastPaintKey) return;
    lastPaintKey = key;

    // render
    setStampMeta({tz, iso, source:"In-browser"});
    paintChips(bodies);
    paintWheelDots(bodies);
    paintAspectsTable(bodies);
  }

  function bindLive(){
    ["tzPick","datePick","hourScrub"].forEach(id=>{
      const el=document.getElementById(id);
      el?.addEventListener("change", updateAll, {passive:true});
      if(id==="hourScrub") el?.addEventListener("input", updateAll, {passive:true});
    });
    // resize wheel → recompute dot locations from same data
    window.addEventListener("resize", ()=>{ lastPaintKey=""; updateAll(); }, {passive:true});
    // periodic refresh (in case time is “now”)
    setInterval(()=>{ lastPaintKey=""; updateAll(); }, 60*1000);
  }

  /* ───────────────────────── Public escape hatches ─────────────────────── */

  // Accept an external payload and paint it to the current UI schema
  function renderExternal(data={}){
    const planets = data.planets || {};
    setStampMeta({
      tz: data.tz || "UTC",
      iso: data.stamp ? data.stamp.replace(' ','T') : new Date().toISOString(),
      source: data.source || "External"
    });
    // coerce longitudes
    for(const k of Object.keys(planets)){
      if (typeof planets[k].lon === "number"){
        planets[k].lon = norm360(planets[k].lon);
      } else {
        const v = parseFloat(planets[k].lon);
        if (Number.isFinite(v)) planets[k].lon = norm360(v);
      }
    }
    paintChips(planets);
    paintWheelDots(planets);
    const aspBody=document.getElementById('aspBody');
    if (aspBody){
      aspBody.innerHTML='';
      (data.aspects||[]).forEach(a=>{
        aspBody.insertAdjacentHTML('beforeend', `<tr><td>${a.pair}</td><td>${a.kind}</td><td>${a.orb}</td></tr>`);
      });
    }
  }

  function demoPayload(){
    return {
      tz:"UTC",
      iso:new Date().toISOString(),
      planets:{
        sun:{lon:227.24}, moon:{lon:262.74},
        mercury:{lon:218.10}, venus:{lon:205.90},
        mars:{lon:16.60}, jupiter:{lon:60.10}, saturn:{lon:347.80}
      }
    };
  }

  // Expose a small API
  window.SOFAstro = {
    compute(dateLike){ return computePack(dateLike instanceof Date ? dateLike : new Date(dateLike)); },
    render(pack){ renderExternal(pack||{}); },
    demo(){ const d=demoPayload(); renderExternal({tz:"Demo", stamp:d.iso.replace('T',' ').slice(0,16), source:"Demo", planets:d.planets, aspects:[]}); }
  };

  /* ───────────────────────── Boot ───────────────────────── */

  document.addEventListener("DOMContentLoaded", ()=>{
    buildWheel();      // once
    updateAll();       // initial paint
    bindLive();        // live controls
  });

})();
</script>
