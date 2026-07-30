(() => {
  "use strict";
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const DRAFT_KEY = "sof.observatory.participation.draft.v1";
  const PREF_KEY = "sof.observatory.participation.prefs.v1";

  function safeParse(raw, fallback={}) { try { return JSON.parse(raw) ?? fallback; } catch { return fallback; } }
  function loadPrefs(){ return safeParse(localStorage.getItem(PREF_KEY), {}); }
  function savePrefs(next){ localStorage.setItem(PREF_KEY, JSON.stringify({...loadPrefs(), ...next})); }
  function announce(msg){ const n=$("#observatory-status"); if(n){n.textContent=msg;n.dataset.kind="ok";} }

  function contextSummary(){
    const p=$("#obs-current-pattern")?.textContent?.trim();
    const s=$("#obs-current-season")?.textContent?.trim();
    const l=$("#obs-current-lunar")?.textContent?.trim();
    return [p,s,l].filter(v=>v&&v!=="—").join(" · ");
  }

  function saveDraft(){
    const form=$("#observatory-witness-form"); if(!form) return;
    const fd=new FormData(form), data={};
    for(const [k,v] of fd.entries()) if(k!=="locationJson") data[k]=v;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({savedAt:new Date().toISOString(), data}));
    const state=$("#obs-draft-state"); if(state) state.textContent="Draft saved";
  }

  function restoreDraft(){
    const form=$("#observatory-witness-form"); if(!form) return;
    const draft=safeParse(localStorage.getItem(DRAFT_KEY), null); if(!draft?.data) return;
    Object.entries(draft.data).forEach(([k,v])=>{ const el=form.elements.namedItem(k); if(el && !el.value) el.value=v; });
    const state=$("#obs-draft-state"); if(state) state.textContent="Draft restored";
  }

  function clearDraft(){ localStorage.removeItem(DRAFT_KEY); const state=$("#obs-draft-state"); if(state) state.textContent=""; }

  function inferTags(text){
    const rules={
      weather:["rain","wind","storm","cloud","sun","snow","heat","cold","weather"],
      family:["family","child","daughter","son","mother","father","partner"],
      work:["work","job","crew","floor","project","client"],
      body:["sleep","energy","stress","pain","body","tired"],
      pattern:["pattern","repeat","again","coincidence","synchronicity"],
      nature:["tree","animal","bird","water","soil","plant","moon","sky"],
      travel:["road","travel","camp","route","caravan","drive"]
    };
    const low=String(text||"").toLowerCase();
    return Object.entries(rules).filter(([,words])=>words.some(w=>low.includes(w))).map(([tag])=>tag);
  }

  function applySmartTags(){
    const obs=$("#obs-observation"), tags=$("#obs-tags"); if(!obs||!tags) return;
    const existing=tags.value.split(",").map(s=>s.trim()).filter(Boolean);
    const inferred=inferTags(obs.value);
    tags.value=[...new Set([...existing,...inferred])].join(", ");
  }

  function setParticipationMode(mode){
    const consoleEl=$("#observatory-console"); if(!consoleEl) return;
    consoleEl.dataset.participationMode=mode;
    savePrefs({mode});
    $$("[data-participation-mode]").forEach(b=>b.setAttribute("aria-pressed", String(b.dataset.participationMode===mode)));
    const details=$("#obs-deeper-fields"); if(details) details.open=mode==="deep";
  }

  function choosePrompt(text, intention){
    const obs=$("#obs-observation"), intent=$("#obs-intention");
    if(obs && !obs.value) obs.placeholder=text;
    if(intent && intention && !intent.value) intent.value=intention;
    obs?.focus({preventScroll:false});
  }

  function quickSave(kind){
    const form=$("#observatory-witness-form"); if(!form) return;
    const obs=$("#obs-observation");
    if(!obs?.value.trim()){
      choosePrompt(kind==="moment"?"What stands out right now?":"What changed since your last witness?", kind==="moment"?"Notice":"Reflect");
      announce("Add one clear observation. The Observatory will carry the rest of the context.");
      return;
    }
    applySmartTags();
    form.requestSubmit();
  }

  function bind(){
    const form=$("#observatory-witness-form"); if(!form) return;
    restoreDraft();
    form.addEventListener("input", ()=>{ clearTimeout(bind._t); bind._t=setTimeout(saveDraft,350); });
    form.addEventListener("submit", ()=>setTimeout(clearDraft,0));
    $("#obs-observation")?.addEventListener("blur", applySmartTags);
    $$("[data-participation-mode]").forEach(btn=>btn.addEventListener("click",()=>setParticipationMode(btn.dataset.participationMode)));
    $$("[data-obs-prompt]").forEach(btn=>btn.addEventListener("click",()=>choosePrompt(btn.dataset.obsPrompt, btn.dataset.obsIntention)));
    $("#obs-quick-save")?.addEventListener("click",()=>quickSave("moment"));
    $("#obs-reflection-save")?.addEventListener("click",()=>quickSave("reflection"));
    $("#obs-skip-location")?.addEventListener("click",()=>{ savePrefs({locationPrompt:false}); announce("Location remains off. You can enable it whenever it adds value."); });
    const mode=loadPrefs().mode || "simple"; setParticipationMode(mode);
    const ctx=$("#obs-auto-context"); if(ctx) ctx.textContent=contextSummary() || "Current Living Time context will be attached automatically.";
    addEventListener("observatory:record-saved",()=>{ clearDraft(); setParticipationMode("simple"); });
  }
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",bind,{once:true}):bind();
})();
