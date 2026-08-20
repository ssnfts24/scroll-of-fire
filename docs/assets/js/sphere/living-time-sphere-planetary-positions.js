(() => {
  "use strict";
  const DEG = Math.PI / 180;
  const DAY_MS = 86400000;
  const PLANETS = Object.freeze([
    { id: "mercury", name: "Mercury", glyph: "☿", size: 0.018 },
    { id: "venus", name: "Venus", glyph: "♀", size: 0.021 },
    { id: "mars", name: "Mars", glyph: "♂", size: 0.020 },
    { id: "jupiter", name: "Jupiter", glyph: "♃", size: 0.024 },
    { id: "saturn", name: "Saturn", glyph: "♄", size: 0.023 },
    { id: "uranus", name: "Uranus", glyph: "♅", size: 0.021 },
    { id: "neptune", name: "Neptune", glyph: "♆", size: 0.021 }
  ]);
  function normDeg(v) { return ((Number(v || 0) % 360) + 360) % 360; }
  function jd(date) { return 2440587.5 + date.getTime() / DAY_MS; }
  function days(date) { return jd(date) - 2451543.5; }
  function elements(id, d) {
    const e = {
      mercury:{N:48.3313+3.24587e-5*d,i:7.0047+5e-8*d,w:29.1241+1.01444e-5*d,a:.387098,e:.205635+5.59e-10*d,M:168.6562+4.0923344368*d},
      venus:{N:76.6799+2.46590e-5*d,i:3.3946+2.75e-8*d,w:54.8910+1.38374e-5*d,a:.72333,e:.006773-1.302e-9*d,M:48.0052+1.6021302244*d},
      mars:{N:49.5574+2.11081e-5*d,i:1.8497-1.78e-8*d,w:286.5016+2.92961e-5*d,a:1.523688,e:.093405+2.516e-9*d,M:18.6021+.5240207766*d},
      jupiter:{N:100.4542+2.76854e-5*d,i:1.3030-1.557e-7*d,w:273.8777+1.64505e-5*d,a:5.20256,e:.048498+4.469e-9*d,M:19.8950+.0830853001*d},
      saturn:{N:113.6634+2.38980e-5*d,i:2.4886-1.081e-7*d,w:339.3939+2.97661e-5*d,a:9.55475,e:.055546-9.499e-9*d,M:316.9670+.0334442282*d},
      uranus:{N:74.0005+1.3978e-5*d,i:.7733+1.9e-8*d,w:96.6612+3.0565e-5*d,a:19.18171-1.55e-8*d,e:.047318+7.45e-9*d,M:142.5905+.011725806*d},
      neptune:{N:131.7806+3.0173e-5*d,i:1.77-2.55e-7*d,w:272.8461-6.027e-6*d,a:30.05826+3.313e-8*d,e:.008606+2.15e-9*d,M:260.2471+.005995147*d}
    }[id];
    return e ? {...e,N:normDeg(e.N),i:normDeg(e.i),w:normDeg(e.w),M:normDeg(e.M)} : null;
  }
  function eccentric(Mdeg,e) {
    const M=Mdeg*DEG; let E=M+e*Math.sin(M)*(1+e*Math.cos(M));
    for(let n=0;n<8;n++){const q=(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));E-=q;if(Math.abs(q)<1e-9)break;} return E;
  }
  function helio(el){
    const E=eccentric(el.M,el.e),xv=el.a*(Math.cos(E)-el.e),yv=el.a*Math.sqrt(1-el.e*el.e)*Math.sin(E),v=Math.atan2(yv,xv),r=Math.hypot(xv,yv),N=el.N*DEG,i=el.i*DEG,vw=v+el.w*DEG;
    return {x:r*(Math.cos(N)*Math.cos(vw)-Math.sin(N)*Math.sin(vw)*Math.cos(i)),y:r*(Math.sin(N)*Math.cos(vw)+Math.cos(N)*Math.sin(vw)*Math.cos(i)),z:r*Math.sin(vw)*Math.sin(i)};
  }
  function sun(d){
    const w=normDeg(282.9404+4.70935e-5*d),e=.016709-1.151e-9*d,M=normDeg(356.0470+.9856002585*d),E=eccentric(M,e),xv=Math.cos(E)-e,yv=Math.sqrt(1-e*e)*Math.sin(E),v=Math.atan2(yv,xv),r=Math.hypot(xv,yv),lon=v+w*DEG;
    return {x:r*Math.cos(lon),y:r*Math.sin(lon)};
  }
  function calculatePlanet(id,date){
    const raw=globalThis.__EPHEMERIS__?.placements?.[id];
    if(Number.isFinite(Number(raw))) return {longitude:normDeg(Number(raw)),latitude:0,distance:null,source:"ephemeris-override"};
    const d=days(date),el=elements(id,d); if(!el)return null; const h=helio(el),s=sun(d),x=h.x+s.x,y=h.y+s.y,z=h.z;
    return {longitude:normDeg(Math.atan2(y,x)/DEG),latitude:Math.atan2(z,Math.hypot(x,y))/DEG,distance:Math.hypot(x,y,z),source:"low-precision-orbital-elements"};
  }
  function calculate(input){const date=input instanceof Date?new Date(input):new Date(input||Date.now());if(Number.isNaN(date.getTime()))return[];return PLANETS.map(p=>({...p,...calculatePlanet(p.id,date),date:date.toISOString()}));}
  globalThis.LivingTimePlanetaryPositions=Object.freeze({planets:PLANETS,calculate,calculatePlanet,normDeg,sourceMetadata:Object.freeze({method:"low-precision geocentric ecliptic longitude",precision:"visual-context only",ephemerisOverride:"window.__EPHEMERIS__.placements"})});
})();
