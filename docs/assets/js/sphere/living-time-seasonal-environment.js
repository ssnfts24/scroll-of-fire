(() => {
  "use strict";
  const VERSION = "2.0.0";
  const DAY = 86400000;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const clean=(v,n=180)=>String(v??"").trim().slice(0,n);
  const seasonFor = (date, latitude=47.6) => {
    const d = new Date(date || Date.now());
    const y=d.getUTCFullYear();
    const starts={march:new Date(Date.UTC(y,2,20,9)),june:new Date(Date.UTC(y,5,21,3)),september:new Date(Date.UTC(y,8,22,19)),december:new Date(Date.UTC(y,11,21,15))};
    const t=d.getTime(); const north=Number(latitude)>=0;
    let key, start, end;
    if(t<starts.march){key="december";start=new Date(Date.UTC(y-1,11,21,15));end=starts.march}
    else if(t<starts.june){key="march";start=starts.march;end=starts.june}
    else if(t<starts.september){key="june";start=starts.june;end=starts.september}
    else if(t<starts.december){key="september";start=starts.september;end=starts.december}
    else {key="december";start=starts.december;end=new Date(Date.UTC(y+1,2,20,9))}
    const northNames={march:"Spring",june:"Summer",september:"Autumn",december:"Winter"};
    const southNames={march:"Autumn",june:"Winter",september:"Spring",december:"Summer"};
    const progress=clamp((t-start.getTime())/(end.getTime()-start.getTime()),0,1);
    const doy=Math.floor((Date.UTC(y,d.getUTCMonth(),d.getUTCDate())-Date.UTC(y,0,1))/DAY)+1;
    const solarApprox=((doy-80)/365.2422*360+360)%360;
    return {hemisphere:north?"northern":"southern", season:(north?northNames:southNames)[key], gate:key, progress, dayOfSeason:Math.floor((t-start.getTime())/DAY)+1, seasonLengthDays:Math.round((end-start)/DAY), solarLongitudeApprox:Number(solarApprox.toFixed(3)), start:start.toISOString(), end:end.toISOString(), method:"approximate civil-season model", version:VERSION};
  };
  function daylightEstimate(date, latitude){
    const d=new Date(date||Date.now()); const lat=clamp(Number(latitude)||0,-66,66)*Math.PI/180;
    const n=Math.floor((d-Date.UTC(d.getUTCFullYear(),0,0))/DAY); const dec=23.44*Math.sin((2*Math.PI/365)*(n-81))*Math.PI/180;
    const h=Math.acos(clamp(-Math.tan(lat)*Math.tan(dec),-1,1));
    return Number((24*h/Math.PI).toFixed(2));
  }
  async function requestLocation(){
    if(!navigator.geolocation) throw new Error("Geolocation is unavailable on this device.");
    return await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(p=>resolve({latitude:Number(p.coords.latitude.toFixed(5)),longitude:Number(p.coords.longitude.toFixed(5)),accuracyMeters:Math.round(p.coords.accuracy),capturedAt:new Date().toISOString(),source:"device-geolocation"}),e=>reject(new Error(e.message||"Location permission was not granted.")),{enableHighAccuracy:false,timeout:12000,maximumAge:900000}));
  }
  function enrich({instant,location,manual={}}={}){
    const latitude=location?.latitude ?? manual.latitude ?? 47.6;
    const seasonal=seasonFor(instant,latitude);
    return {seasonal:{...seasonal, daylightHoursEstimate:daylightEstimate(instant,latitude)}, location: location?{...location}:null, conditions:{temperatureC:Number.isFinite(Number(manual.temperatureC))?Number(manual.temperatureC):null, humidityPercent:Number.isFinite(Number(manual.humidityPercent))?Number(manual.humidityPercent):null, pressureHpa:Number.isFinite(Number(manual.pressureHpa))?Number(manual.pressureHpa):null, cloudCoverPercent:Number.isFinite(Number(manual.cloudCoverPercent))?Number(manual.cloudCoverPercent):null, windKph:Number.isFinite(Number(manual.windKph))?Number(manual.windKph):null, precipitationMm:Number.isFinite(Number(manual.precipitationMm))?Number(manual.precipitationMm):null, airQualityIndex:Number.isFinite(Number(manual.airQualityIndex))?Number(manual.airQualityIndex):null, sky:clean(manual.sky,80)||null, fieldNotes:clean(manual.fieldNotes,1500)||null, source:manual.source||"manual-observation"}, provenance:{module:"LivingTimeSeasonalEnvironment",version:VERSION,calculatedAt:new Date().toISOString(),liveWeather:false}};
  }
  globalThis.LivingTimeSeasonalEnvironment=Object.freeze({VERSION,seasonFor,daylightEstimate,requestLocation,enrich});
})();
