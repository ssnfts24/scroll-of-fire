(function(){
  "use strict";
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const on = (t,e,f,o)=>t&&t.addEventListener(e,f,o);
  const haptic = (ms=12)=>{ try{ navigator.vibrate && navigator.vibrate(ms); }catch{} };
  const yr=$("#yr"); if(yr) yr.textContent=String(new Date().getFullYear());

  /* ---------------- Tabs + Coach mode ---------------- */
  $$(".pill").forEach(btn=>{
    on(btn,"click",()=>{
      $$(".pill").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const id = "tab-"+btn.dataset.tab;
      $$(".tab").forEach(t=>t.classList.remove("active"));
      $("#"+id).classList.add("active");
    });
  });
  on($("#coach"),"change", e=>document.body.classList.toggle("coach-on", e.target.checked));

  /* ---------------- Ring Timer ---------------- */
  const phases = ["𝓘 Intention","𝓛 Light","𝓒 Consciousness","𝓢 Source"];
  let tId=0, running=false, round=0, phase=-1, left=0;
  const ringFg=$("#ringFg"), ringPhase=$("#ringPhase"), ringCount=$("#ringCount");
  const secInput=$("#phaseSec"), roundsInput=$("#rounds");
  function nextPhase(){
    phase=(phase+1)%phases.length; if(phase===0){ round++; if(round>(+roundsInput.value||3)) return stop(); }
    ringPhase.textContent = `${phases[phase]}`;
    left = clamp(+secInput.value||12,3,120);
    setRing(0); ringCount.textContent = `${left}s  •  Round ${round||1}/${roundsInput.value}`;
    haptic();
  }
  function tick(){
    if(!running) return;
    left--; const p=(1-(left/ (clamp(+secInput.value||12,3,120))))*100; setRing(p);
    ringCount.textContent = `${left}s  •  Round ${round}/${roundsInput.value}`;
    if(left<=0) nextPhase();
  }
  function setRing(pct){ ringFg.style.strokeDashoffset = String(100-pct); }
  function start(){ if(running) return; running=true; round=0; phase=-1; nextPhase(); tId=setInterval(tick,1000); }
  function stop(){ running=false; clearInterval(tId); ringPhase.textContent="Paused"; ringCount.textContent="—"; setRing(0); }
  on($("#startTimer"),"click",start); on($("#stopTimer"),"click",stop);

  /* ---------------- Voice Gate Lab (WebAudio) ---------------- */
  let ac, mic, analyser, dataTime, dataFreq, rafId=0, runningMic=false;
  const wave=$("#wave"), fft=$("#fft"), nearKey=$("#nearKey");
  const W=wave.width, H=wave.height; const W2=fft.width, H2=fft.height;
  const wctx=wave.getContext("2d"), fctx=fft.getContext("2d");
  const KEYS=[{n:"369",hz:369},{n:"432",hz:432},{n:"528",hz:528}];

  async function micStart(){
    if(runningMic) return;
    ac = new (window.AudioContext||window.webkitAudioContext)();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation:true, noiseSuppression:true } });
    mic = ac.createMediaStreamSource(stream);
    analyser = ac.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.85;
    dataTime = new Uint8Array(analyser.fftSize); dataFreq = new Uint8Array(analyser.frequencyBinCount);
    mic.connect(analyser); runningMic=true; drawAudio();
  }
  function micStop(){ runningMic=false; cancelAnimationFrame(rafId); try{ ac && ac.close(); }catch{} nearKey.textContent="—"; }
  on($("#micStart"),"click",()=>micStart().catch(()=>alert("Microphone permission denied.")));
  on($("#micStop"),"click",micStop);

  function drawAudio(){
    if(!runningMic) return;
    rafId = requestAnimationFrame(drawAudio);
    // waveform
    analyser.getByteTimeDomainData(dataTime);
    wctx.clearRect(0,0,W,H); wctx.beginPath(); wctx.moveTo(0,H/2);
    for(let i=0;i<dataTime.length;i++){ const x=i/dataTime.length*W; const y=(dataTime[i]/255)*H; wctx.lineTo(x,y); }
    wctx.strokeStyle="rgba(122,243,255,.9)"; wctx.lineWidth=1.5; wctx.stroke();

    // spectrum
    analyser.getByteFrequencyData(dataFreq);
    fctx.clearRect(0,0,W2,H2);
    for(let i=0;i<dataFreq.length;i++){
      const x=i/dataFreq.length*W2; const y=H2-(dataFreq[i]/255)*H2;
      fctx.fillStyle="rgba(243,201,122,.6)"; fctx.fillRect(x,y, W2/dataFreq.length*1.2, H2-y);
    }
    // peak detection
    const idx = maxIndex(dataFreq); const freq = idx * ac.sampleRate / analyser.fftSize;
    highlightKeys(freq);
  }
  function maxIndex(arr){ let m=-1, mi=0; for(let i=0;i<arr.length;i++){ if(arr[i]>m){m=arr[i]; mi=i;} } return mi; }
  function highlightKeys(freq){
    const best = KEYS.map(k=>({k, diff:Math.abs(k.hz - freq)})).sort((a,b)=>a.diff-b.diff)[0];
    const within = best && best.diff < 15; // ~±15 Hz tolerance for humming
    nearKey.textContent = within ? `Near ${best.k.n} Hz carrier → try it today` : `Fundamental ~ ${freq.toFixed(0)} Hz`;
    nearKey.style.color = within ? "#7af3ff" : "#b8b3a6";
  }

  /* ---------------- Phrase Tuner Pro ---------------- */
  const lane=$("#chipLane"); const phraseIn=$("#phraseIn");
  const NEG=/\b(no|not|don['’]?t|cant|can['’]?t|won['’]?t|never|nothing|nobody|isn['’]?t|aren['’]?t|shouldn['’]?t|couldn['’]?t|wouldn['’]?t|didn['’]?t|doesn['’]?t|haven['’]?t|hasn['’]?t|without)\b/gi;
  on($("#btnTuned"),"click",()=>{
    const negs=(phraseIn.value.match(NEG)||[]).length;
    $("#negCount").textContent=String(negs);
    let s = phraseIn.value;
    s = s.replace(/\b(don['’]?t be late)\b/ig,"arrive on time");
    s = s.replace(/\b(don['’]?t worry)\b/ig,"stay calm");
    s = s.replace(/\bno confusion\b/ig,"be clear");
    s = s.replace(/\bnot ([a-z]{3,})/ig,"choose $1 differently");
    $("#phraseOut").innerHTML = s.replace(NEG,m=>`<mark>${m}</mark>`);
    buildChips(phraseIn.value);
    updateSemScore();
  });
  on($("#btnClearPhrase"),"click",()=>{ phraseIn.value=""; lane.innerHTML=""; $("#phraseOut").textContent="—"; $("#negCount").textContent="0"; $("#semScore").textContent="Semantic weight: —"; });

  function buildChips(text){
    lane.innerHTML="";
    const toks = (text||"").split(/\s+/).filter(Boolean).slice(0,16);
    toks.forEach(tok=>{
      const chip=document.createElement("button");
      chip.className="chip"; chip.setAttribute("type","button");
      chip.textContent=tok;
      chip.dataset.w = /^(truth|love|clear|deliver|listen|thank|heal|build|learn|give|serve)$/i.test(tok) ? "0.20" :
                       /^(not|don|won|can|never|no)$/i.test(tok) ? "0.05" : "0.10";
      const span=document.createElement("span"); span.className="w"; span.textContent=chip.dataset.w;
      chip.appendChild(span);
      on(chip,"click",()=>cycleWeight(chip));
      lane.appendChild(chip);
    });
  }
  function cycleWeight(chip){
    const steps=[0.05,0.10,0.20,0.30]; let w=+chip.dataset.w||0.10;
    const i=(steps.indexOf(w)+1)%steps.length; w=steps[i]; chip.dataset.w=w.toFixed(2);
    chip.querySelector(".w").textContent=chip.dataset.w; updateSemScore();
  }
  function updateSemScore(){
    const chips=$$(".chip",lane); if(!chips.length){ $("#semScore").textContent="Semantic weight: —"; return; }
    const total=[...chips].reduce((acc,c)=>acc+Number(c.dataset.w||0),0);
    $("#semScore").textContent = `Semantic weight: ${total.toFixed(2)}  (↑ = clearer emphasis)`;
  }

  /* ---------------- Coherence Desk ---------------- */
  const xiHistKey="codex:xi:hist"; const MAXH=10;
  on($("#btnXi"),"click",()=>{
    const h=clamp(+$("#hDotI").value,0,1); const v=Math.max(0,+$("#mVar").value);
    const xi=h/(1+v); $("#outXi").textContent=`Ξ = ${xi.toFixed(3)}`;
    drawSpark(pushXi(xi));
    if($("#autoLogXi").checked){ appendLatestXiToLedger(xi); }
  });
  on($("#btnHalfLife"),"click",()=>{
    const tau=Math.max(1,+$("#tauDays").value||10);
    const lambda=1/tau; const half=Math.log(2)/lambda;
    $("#outHalfLife").innerHTML=`λ = ${lambda.toFixed(3)} day⁻¹, t½ ≈ ${half.toFixed(2)} days`;
  });
  function pushXi(x){
    const arr=loadJSON(xiHistKey,[]); arr.push(+x); if(arr.length>MAXH) arr.shift(); saveJSON(xiHistKey,arr); return arr;
  }
  function drawSpark(vals){
    const c=$("#xiSpark"); const ctx=c.getContext("2d");
    ctx.clearRect(0,0,c.width,c.height);
    if(!vals.length) return;
    const max=Math.max(...vals,1); const min=Math.min(...vals,0);
    ctx.beginPath(); ctx.moveTo(0, c.height - norm(vals[0]) * c.height);
    for(let i=1;i<vals.length;i++){ const x=i/(vals.length-1)*c.width; const y=c.height - norm(vals[i]) * c.height; ctx.lineTo(x,y); }
    ctx.strokeStyle="rgba(122,243,255,.9)"; ctx.lineWidth=2; ctx.stroke();
    function norm(v){ return (v-min)/(max-min||1); }
  }
  drawSpark(loadJSON(xiHistKey,[]));

  /* ---------------- Ledger + Streak + Badges ---------------- */
  const K="codex:ledger:v2"; const KS="codex:streak:v1";
  const tb=$("#ledgerTable tbody");
  on($("#btnAddEntry"),"click",()=>{
    const row = {
      date: today(),
      intention: $("#entryIntention").value.trim(),
      carrier: $("#entryCarrier").value.trim(),
      quality: $("#entryQuality").value.trim(),
      tags: $("#entryTags").value.trim(),
      witness: $("#entryWitness").value.trim()
    };
    if(!row.intention) return alert("Add an intention line.");
    const d=loadJSON(K,[]); d.push(row); saveJSON(K,d);
    bumpStreak(); paintLedger(); paintStreak(); unlockBadges();
    $("#entryIntention").value=""; $("#entryCarrier").value=""; $("#entryQuality").value="";
    $("#entryTags").value=""; $("#entryWitness").value="";
  });

  on($("#btnExport"),"click",()=>{
    const blob=new Blob([JSON.stringify(loadJSON(K,[]),null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a");
    a.href=url; a.download="codex_ledger.json"; a.click(); setTimeout(()=>URL.revokeObjectURL(url),500);
  });
  on($("#btnImport"),"click",()=>$("#fileImport").click());
  on($("#fileImport"),"change",e=>{
    const f=e.target.files?.[0]; if(!f) return; const rd=new FileReader();
    rd.onload=()=>{ try{ const d=JSON.parse(String(rd.result||"[]")); if(Array.isArray(d)){ saveJSON(K,d); paintLedger(); paintStreak(); unlockBadges(); } }catch{ alert("Invalid file."); } };
    rd.readAsText(f);
  });
  on($("#ledgerFilter"),"input",()=>paintLedger());

  function appendLatestXiToLedger(xi){
    const d=loadJSON(K,[]); if(!d.length) return;
    const last=d[d.length-1]; if(!last.xi) last.xi=[]; last.xi.push(+xi); saveJSON(K,d); paintLedger(false);
  }

  function paintLedger(scroll=true){
    const q=($("#ledgerFilter").value||"").toLowerCase();
    const d=loadJSON(K,[]);
    tb.innerHTML="";
    d.slice().reverse().forEach((r,idx)=>{
      if(q && !(r.intention.toLowerCase().includes(q) || r.witness.toLowerCase().includes(q) || (r.tags||"").toLowerCase().includes(q))) return;
      const tr=document.createElement("tr");
      tr.innerHTML = `
        <td>${escape(r.date)}</td>
        <td>${escape(r.intention)}</td>
        <td>${escape(r.carrier||"—")}</td>
        <td>${escape(r.quality||"—")}${r.xi?`<br><span class="meta">Ξ avg ${(avg(r.xi)).toFixed(2)}</span>`:""}</td>
        <td>${escape(r.tags||"—")}</td>
        <td>${escape(r.witness||"—")}</td>
        <td><button class="ghost del" data-i="${d.length-1-idx}">Delete</button></td>`;
      tb.appendChild(tr);
    });
    $$(".del",tb).forEach(btn=>on(btn,"click",()=>{
      const i=+btn.dataset.i; const arr=loadJSON(K,[]); arr.splice(i,1); saveJSON(K,arr); paintLedger(false);
    }));
    if(scroll) $("#tab-ledger").scrollIntoView({behavior:"smooth", block:"start"});
  }

  function bumpStreak(){
    const s=loadJSON(KS,{last:"",count:0}); const t=today();
    if(s.last===t) return; const y=yesterday();
    s.count = (s.last===y)? s.count+1 : 1; s.last=t; saveJSON(KS,s);
  }
  function paintStreak(){
    const s=loadJSON(KS,{last:"",count:0}); $("#streakDays").textContent=String(s.count||0);
  }
  function unlockBadges(){
    const n=loadJSON(KS,{count:0}).count||0;
    setBadge("#badge7", n>=7); setBadge("#badge33", n>=33); setBadge("#badge144", n>=144);
  }
  function setBadge(sel, lit){ const el=$(sel); if(!el) return; el.classList.toggle("unlit", !lit); }

  paintLedger(false); paintStreak(); unlockBadges();

  /* ---------------- Utilities ---------------- */
  function clamp(x,min,max){ return Math.max(min, Math.min(max, x)); }
  function saveJSON(k,v){ localStorage.setItem(k, JSON.stringify(v)); }
  function loadJSON(k,fallback){ try{ return JSON.parse(localStorage.getItem(k)||JSON.stringify(fallback)); }catch{ return fallback; } }
  function avg(a){ return a.reduce((s,x)=>s+x,0)/Math.max(1,a.length); }
  function today(){ return new Date().toISOString().slice(0,10); }
  function yesterday(){ const d=new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); }
  function escape(s){ return String(s||"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m])); }
})();
