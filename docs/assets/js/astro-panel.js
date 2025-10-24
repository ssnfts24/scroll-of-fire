/*! Astrology Panel · Lite Provider v2.1 (Sun–Saturn) — no APIs
    - Sun/Moon: Meeus-lite
    - Mercury–Saturn: Schlyter low-precision heliocentric → geocentric (J2000)
    - Sign glyphs + retrograde + aspect line (Sun↔Moon)
    - Live repaint on tz/date/hour
*/
(function(){
  "use strict";

  // ---------- math & utils ----------
  const PI = Math.PI, TAU = 2*PI, RAD = PI/180;
  const sin = d => Math.sin(d*RAD), cos = d => Math.cos(d*RAD), atan2=(y,x)=>Math.atan2(y,x)/RAD;
  const norm360 = d => ((d%360)+360)%360;
  const toJD = (dUTC)=>{ // Julian Day (UT)
    const a = Math.floor((14-(dUTC.getUTCMonth()+1))/12);
    const y = dUTC.getUTCFullYear()+4800-a;
    const m = (dUTC.getUTCMonth()+1)+12*a-3;
    const JDN = dUTC.getUTCDate()+Math.floor((153*m+2)/5)+365*y+Math.floor(y/4)-Math.floor(y/100)+Math.floor(y/400)-32045;
    const frac=(dUTC.getUTCHours()-12)/24+dUTC.getUTCMinutes()/1440+dUTC.getUTCSeconds()/86400+dUTC.getUTCMilliseconds()/86400000;
    return JDN+frac;
  };
  function currentZonedUTC(){
    const tzSel=document.getElementById("tzPick");
    const base=new Date();
    const tz = tzSel?.value || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const p=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})
      .formatToParts(base).reduce((o,p)=>(o[p.type]=p.value,o),{});
    return new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
  }

  // ---------- Sun / Moon ----------
  function sunLonJD(JD){
    const T=(JD-2451545)/36525;
    const L0=norm360(280.46646+36000.76983*T+0.0003032*T*T);
    const M =norm360(357.52911+35999.05029*T-0.0001537*T*T);
    const C =(1.914602-0.004817*T-0.000014*T*T)*sin(M)
           +(0.019993-0.000101*T)*sin(2*M)
           +0.000289*sin(3*M);
    return norm360(L0+C);
  }
  function moonLonJD(JD){
    const D=JD-2451545.0;
    const L0=norm360(218.3164477+13.17639648*D);
    const Mm=norm360(134.9633964+13.06499295*D);
    const Ms=norm360(357.5291092+0.98560028*D);
    const F =norm360(93.2720950 +13.22935024*D);
    const Dm=norm360(297.8501921+12.19074912*D);
    let lon=L0
      +6.289*sin(Mm)
      +1.274*sin(2*Dm-Mm)
      +0.658*sin(2*Dm)
      +0.214*sin(2*Mm)
      +0.11 *sin(Dm)
      -0.186*sin(Ms)
      -0.114*sin(2*F);
    return norm360(lon);
  }
  function speed(fn, JD){
    const h=0.5; let a=fn(JD-h), b=fn(JD+h);
    let d=b-a; if(d>180)d-=360; if(d<-180)d+=360;
    return d/(2*h);
  }

  // ---------- Schlyter low-precision planets (helioc → geo ecliptic J2000) ----------
  // orbital elements at epoch with small daily rates
  const ELEM = {
    Mercury: { N:48.3313, Nd: 3.24587E-5, i:7.0047,  id: 5.00E-8,  w:29.1241,  wd: 1.01444E-5, a:0.387098, ad:0,   e:0.205635, ed: 5.59E-10, M:168.6562, Md:4.0923344368 },
    Venus:   { N:76.6799, Nd: 2.46590E-5, i:3.3946,  id: 2.75E-8,  w:54.8910,  wd: 1.38374E-5, a:0.723330, ad:0,   e:0.006773, ed:-1.30E-9,  M: 48.0052, Md:1.6021302244 },
    Earth:   { N: 0.0,    Nd: 0,          i:0.0,     id: 0,        w:282.9404, wd: 4.70935E-5, a:1.000000, ad:0,   e:0.016709, ed:-1.151E-9, M:356.0470, Md:0.9856002585 },
    Mars:    { N:49.5574, Nd: 2.11081E-5, i:1.8497,  id:-1.78E-8,  w:286.5016, wd: 2.92961E-5, a:1.523688, ad:0,   e:0.093405, ed: 2.516E-9, M: 18.6021, Md:0.5240207766 },
    Jupiter: { N:100.4542,Nd: 2.76854E-5, i:1.3030,  id:-1.55E-8,  w:273.8777, wd: 1.64505E-5, a:5.20256,  ad:0,   e:0.048498, ed: 4.469E-9, M: 19.8950, Md:0.0830853001 },
    Saturn:  { N:113.6634,Nd: 2.38980E-5, i:2.4886,  id:-1.081E-7, w:339.3939, wd: 2.97661E-5, a:9.55475,  ad:0,   e:0.055546, ed:-9.499E-9, M:316.9670, Md:0.0334442282 }
  };
  function kepler(M,e){
    // solve E from M for small/medium e
    let E = (M + (e<0.8 ? e*Math.sin(M*RAD) : PI)) ; // rad seed
    for(let k=0;k<10;k++){
      const dE = (E - e*Math.sin(E) - M*RAD) / (1 - e*Math.cos(E));
      E -= dE; if (Math.abs(dE) < 1e-12) break;
    }
    return E;
  }
  function helioXYZ(body, d) {
    const el=ELEM[body];
    const N=(el.N + el.Nd*d) * RAD;
    const i=(el.i + el.id*d) * RAD;
    const w=(el.w + el.wd*d) * RAD;
    const a= el.a + el.ad*d;
    const e= el.e + el.ed*d;
    const M= norm360(el.M + el.Md*d);
    const E= kepler(M, e);
    const xv= a*(Math.cos(E) - e);
    const yv= a*(Math.sqrt(1-e*e) * Math.sin(E));
    const v = Math.atan2(yv, xv); // true anomaly (rad)
    const r = Math.sqrt(xv*xv + yv*yv);
    // position in ecliptic coordinates (heliocentric)
    const x = r*( Math.cos(N)*Math.cos(v+w) - Math.sin(N)*Math.sin(v+w)*Math.cos(i) );
    const y = r*( Math.sin(N)*Math.cos(v+w) + Math.cos(N)*Math.sin(v+w)*Math.cos(i) );
    const z = r*( Math.sin(v+w)*Math.sin(i) );
    return {x,y,z,r, v:v/RAD, lon: norm360( atan2(y,x) ) };
  }
  function planetGeoLon(body, JD){
    // days since J2000.0
    const d = JD - 2451543.5;
    const p = helioXYZ(body, d);
    const e = helioXYZ("Earth", d);

    // geocentric vector: planet - earth
    const X = p.x - e.x, Y = p.y - e.y, Z = p.z - e.z;
    // longitude (ignore light-time and nutation for lite panel)
    const lon = norm360( atan2(Y, X) );
    return lon;
  }

  // retrograde: central difference of geocentric longitude
  function retrograde(body, JD){
    const h=1;
    let a=planetGeoLon(body, JD-h), b=planetGeoLon(body, JD+h);
    let d=b-a; if(d>180)d-=360; if(d<-180)d+=360;
    return d<0;
  }

  // ---------- Aspects ----------
  const ASPECTS = [
    {key:"conj", name:"Conjunction", angle:0,   orb:6},
    {key:"sext", name:"Sextile",     angle:60,  orb:4},
    {key:"square",name:"Square",     angle:90,  orb:5},
    {key:"trine", name:"Trine",      angle:120, orb:5},
    {key:"oppo",  name:"Opposition", angle:180, orb:6}
  ];
  function findAspect(a,b){
    const d=Math.abs(norm360(a-b)); const dist=Math.min(d,360-d);
    for(const asp of ASPECTS){
      const delta = dist - asp.angle;
      if(Math.abs(delta) <= asp.orb) return {...asp, delta:+delta.toFixed(2)};
    }
    return null;
  }

  // ---------- formatting ----------
  const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
  const GLYPH = ["\u2648","\u2649","\u264A","\u264B","\u264C","\u264D","\u264E","\u264F","\u2650","\u2651","\u2652","\u2653"];
  function toSign(lon){
    const L=norm360(lon), s=Math.floor(L/30), d=L - s*30;
    const deg=Math.floor(d), min=Math.round((d-deg)*60);
    return {sign:SIGNS[s], glyph:GLYPH[s], idx:s, deg, min};
  }
  const pad2=n=>String(n).padStart(2,"0");

  // ---------- paint helpers ----------
  const q = s => document.querySelector(s);
  const set = (sel, txt)=>{ const el=typeof sel==="string"?q(sel):sel; if(el) el.textContent=txt; };

  function paintChip(root, body, lon, isRetro){
    const row = root.querySelector(`.pl-${body.toLowerCase()}`);
    if(!row) return;
    const slot = row.querySelector(".sg");
    const rt = row.querySelector(".rt");
    const S = toSign(lon);
    slot.textContent = `${S.deg}°${pad2(S.min)}′ ${S.sign}`;
    if(rt){ rt.innerHTML = isRetro ? "&larr;R" : "&rarr;"; rt.setAttribute("title", isRetro?"Retrograde":"Direct"); }
  }

  function paintEphem(table, body, lon, spd, isRetro){
    if(!table) return;
    const tb = table.tBodies[0] || table.appendChild(document.createElement("tbody"));
    let row = [...tb.rows].find(r => r.dataset.body===body);
    if(!row){
      row=tb.insertRow(-1); row.dataset.body=body;
      ["Name","Sign","Deg","Speed","Notes"].forEach(()=>row.insertCell(-1));
      row.cells[0].textContent=body; row.cells[4].className="meta"; row.cells[2].className="deg";
    }
    const s=toSign(lon);
    row.cells[1].textContent=s.sign;
    row.cells[2].textContent=`${s.deg}°${pad2(s.min)}′`;
    row.cells[3].textContent=`${spd>=0?"+":""}${spd.toFixed(2)}°/d`;
    row.cells[4].textContent=isRetro?"retrograde":"—";
  }

  function paintWheel(container, bodies){
    if(!container) return;
    const size=Math.max(260, Math.min(container.clientWidth||340, 520));
    const r=size/2-16, cx=size/2, cy=size/2;
    const NS="http://www.w3.org/2000/svg";
    const svg=document.createElementNS(NS,"svg");
    svg.setAttribute("viewBox",`0 0 ${size} ${size}`); svg.setAttribute("width",size); svg.setAttribute("height",size);

    // ring background
    const ring=document.createElementNS(NS,"circle");
    ring.setAttribute("cx",cx); ring.setAttribute("cy",cy); ring.setAttribute("r",r);
    ring.setAttribute("fill","none"); ring.setAttribute("stroke","var(--line)"); ring.setAttribute("stroke-width","1.2");
    svg.appendChild(ring);

    // 12 wedges
    for(let i=0;i<12;i++){
      const start=(i*30-90)*RAD, mid=((i*30+15)-90)*RAD;
      const x1=cx + r*Math.cos(start), y1=cy + r*Math.sin(start);
      const tick=document.createElementNS(NS,"line");
      tick.setAttribute("x1",x1); tick.setAttribute("y1",y1);
      tick.setAttribute("x2",cx + r*Math.cos(start+30*RAD)); tick.setAttribute("y2",cy + r*Math.sin(start+30*RAD));
      tick.setAttribute("stroke","var(--line)"); tick.setAttribute("stroke-width",".6"); tick.setAttribute("opacity",".6");
      svg.appendChild(tick);
      // glyph
      const gx=cx + (r-18)*Math.cos(mid), gy=cy + (r-18)*Math.sin(mid);
      const t=document.createElementNS(NS,"text");
      t.setAttribute("x",gx); t.setAttribute("y",gy);
      t.setAttribute("text-anchor","middle"); t.setAttribute("dominant-baseline","central");
      t.setAttribute("font-size","12"); t.setAttribute("fill","var(--muted)");
      t.textContent=GLYPH[i];
      svg.appendChild(t);
    }

    // helper to place a dot & label
    function place(name, lon, fill){
      const a=(lon-90)*RAD;
      const x=cx + (r-8)*Math.cos(a), y=cy + (r-8)*Math.sin(a);
      const p=document.createElementNS(NS,"circle");
      p.setAttribute("cx",x); p.setAttribute("cy",y); p.setAttribute("r",4.2);
      p.setAttribute("fill",fill); svg.appendChild(p);
      const s=document.createElementNS(NS,"title"); s.textContent=`${name}`; p.appendChild(s);
    }

    if(bodies.Sun)  place("Sun",  bodies.Sun.lon,  "url(#mbGrad)");
    if(bodies.Moon) place("Moon", bodies.Moon.lon, "url(#mbGrad)");
    if(bodies.Mercury) place("Mercury", bodies.Mercury.lon, "url(#mbGrad)");
    if(bodies.Venus)   place("Venus",   bodies.Venus.lon,   "url(#mbGrad)");
    if(bodies.Mars)    place("Mars",    bodies.Mars.lon,    "url(#mbGrad)");
    if(bodies.Jupiter) place("Jupiter", bodies.Jupiter.lon, "url(#mbGrad)");
    if(bodies.Saturn)  place("Saturn",  bodies.Saturn.lon,  "url(#mbGrad)");

    // Sun–Moon aspect line
    if(bodies.Sun && bodies.Moon){
      const aS=(bodies.Sun.lon-90)*RAD, aM=(bodies.Moon.lon-90)*RAD;
      const x1=cx + (r-10)*Math.cos(aS), y1=cy + (r-10)*Math.sin(aS);
      const x2=cx + (r-10)*Math.cos(aM), y2=cy + (r-10)*Math.sin(aM);
      const L=document.createElementNS(NS,"line");
      L.setAttribute("x1",x1);L.setAttribute("y1",y1);L.setAttribute("x2",x2);L.setAttribute("y2",y2);
      L.setAttribute("stroke","color-mix(in srgb, var(--moon-accent) 50%, var(--accent-2))");
      L.setAttribute("stroke-width","1.2"); L.setAttribute("opacity",".9");
      svg.appendChild(L);
    }

    container.innerHTML=""; container.appendChild(svg);
  }

  function paintAspects(bodies){
    const root=document; const box=root.querySelector("#aspects"); if(!box||!bodies.Sun||!bodies.Moon) return;
    // reset
    box.querySelectorAll(".aspect").forEach(el=>{
      el.classList.remove("is-on");
      el.textContent = el.textContent.replace(/ Δ.*$/," —");
    });
    const asp=findAspect(bodies.Sun.lon,bodies.Moon.lon);
    if(asp){
      const el=box.querySelector(`.aspect--${asp.key}`);
      if(el){ el.classList.add("is-on"); el.textContent = `${el.textContent.split("—")[0].trim()} Δ ${Math.abs(asp.delta)}°`; }
    }
  }

  // ---------- main compute + paint ----------
  function computePack(dateUTC){
    const JD=toJD(dateUTC);
    const bodies={};

    bodies.Sun  = { lon: sunLonJD(JD),   speed: speed(sunLonJD, JD) };
    bodies.Moon = { lon: moonLonJD(JD),  speed: speed(moonLonJD, JD) };

    // classical planets
    ["Mercury","Venus","Mars","Jupiter","Saturn"].forEach(name=>{
      const lon = planetGeoLon(name, JD);
      const lon2= planetGeoLon(name, JD+0.5);
      let d=lon2-lon; if(d>180)d-=360; if(d<-180)d+=360;
      bodies[name]={ lon, speed:d/0.5, retro: retrograde(name, JD) };
    });

    return { datetime: dateUTC.toISOString(), bodies };
  }

  function paintAll(providerData){
    const chips = q("#planetChips");
    const wheel = q("#zodiacWheel");
    const ephem = q("#ephem");
    const B = providerData.bodies;

    // chips
    if(chips){
      [["Sun"],["Moon"],["Mercury"],["Venus"],["Mars"],["Jupiter"],["Saturn"]].forEach(([name])=>{
        if(B[name]) paintChip(chips, name, B[name].lon, B[name].retro);
      });
    }
    // ephemeris
    if(ephem){
      Object.keys(B).forEach(k=>{
        paintEphem(ephem, k, B[k].lon, B[k].speed ?? 0, !!B[k].retro);
      });
    }
    // wheel + aspects
    paintWheel(wheel, B);
    paintAspects(B);
  }

  function init(){
    const head = document.getElementById("astro-head");
    if(!head) return; // panel not present
    const dateUTC = currentZonedUTC();
    paintAll(computePack(dateUTC));
  }

  function bindLive(){
    ["tzPick","datePick","hourScrub"].forEach(id=>{
      const el=document.getElementById(id);
      if(el){
        const fn=()=>init();
        el.addEventListener("input", fn, {passive:true});
        el.addEventListener("change", fn, {passive:true});
      }
    });
    window.addEventListener("resize", ()=>init(), {passive:true});
  }

  window.addEventListener("DOMContentLoaded", ()=>{ init(); bindLive(); });

  // expose escape hatch for future high-precision data
  window.SOFAstro = {
    paintJSON(pack){ if(pack && pack.bodies) paintAll(pack); },
    recompute: init
  };
})();





<script>
(() => {
  const TWO_PI=Math.PI*2, cx=180, cy=180, R=145;

  // Build the static wheel (houses + sign labels)
  function buildWheel(){
    const gH=document.getElementById('houseLines');
    const gS=document.getElementById('signLabels');
    if(!gH||!gS) return;
    gH.innerHTML=''; gS.innerHTML='';
    for(let i=0;i<12;i++){
      const a=-Math.PI/2 + i*(TWO_PI/12);
      const x=cx+Math.cos(a)*R, y=cy+Math.sin(a)*R;
      const x2=cx+Math.cos(a)*(R-16), y2=cy+Math.sin(a)*(R-16);
      gH.insertAdjacentHTML('beforeend', `<line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}"></line>`);
    }
    const signs=['A','T','G','C','L','V','L','S','C','P','A','P']; // Aries..Pisces initials
    for(let i=0;i<12;i++){
      const a=-Math.PI/2 + (i+0.5)*(TWO_PI/12);
      const x=cx+Math.cos(a)*(R-26), y=cy+Math.sin(a)*(R-26)+3;
      gS.insertAdjacentHTML('beforeend', `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}">${signs[i]}</text>`);
    }
  }
  const posForLon = lon => {
    const a = (-90 + lon) * Math.PI/180; // 0° Aries at top
    return { x: cx + Math.cos(a)*R, y: cy + Math.sin(a)*R };
  };

  // Call this from your ephemeris code
  window.renderAstro = (data={}) => {
    if (data.stamp)  document.getElementById('astroStamp').textContent = data.stamp;
    if (data.tz)     document.getElementById('astroTZ').textContent    = data.tz;
    if (data.source) document.getElementById('astroSource').textContent= data.source;

    const P = data.planets || {};
    Object.keys(P).forEach(k=>{
      const p=P[k];
      document.querySelector(`.pos[data-pos="${k}"]`)?.replaceChildren(document.createTextNode(p.text||'—'));
      document.querySelector(`.sign[data-sign="${k}"]`)?.replaceChildren(document.createTextNode(p.sign||'—'));
      const dot=document.querySelector(`[data-dot="${k}"]`);
      if(dot && typeof p.lon==='number'){ const xy=posForLon(p.lon); dot.setAttribute('cx',xy.x.toFixed(1)); dot.setAttribute('cy',xy.y.toFixed(1)); }
    });

    const body=document.getElementById('aspBody'); if(body){
      body.innerHTML='';
      (data.aspects||[]).forEach(a=> body.insertAdjacentHTML('beforeend', `<tr><td>${a.pair}</td><td>${a.kind}</td><td>${a.orb}</td></tr>`));
    }
  };

  document.addEventListener('DOMContentLoaded', buildWheel);
})();
</script>



renderAstro({
  tz:'America/Los_Angeles',
  stamp:'2025-10-24 08:00',
  source:'Swiss Ephemeris',
  planets:{ sun:{lon:227.24,text:'1°14′',sign:'Scorpio'}, moon:{lon:262.74,text:'2°44′',sign:'Sagittarius'} },
  aspects:[ {pair:'Sun △ Moon',kind:'Trine',orb:'1°12′'} ]
});
