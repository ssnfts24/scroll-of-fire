(() => {
  "use strict";

  const PREF_KEY = "sof.observatory.questions.prefs.v1";
  const STATE_KEY = "sof.observatory.questions.state.v1";
  const QUEST_KEY = "sof.observatory.quests.v1";
  const CUSTOM_KEY = "sof.observatory.questions.custom.v1";
  const HISTORY_KEY = "sof.observatory.questions.history.v1";
  const DAY = 86400000;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const uid = (prefix = "Q") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const safeParse = (raw, fallback) => { try { return JSON.parse(raw) ?? fallback; } catch { return fallback; } };
  const load = (key, fallback) => safeParse(localStorage.getItem(key), fallback);
  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const nowIso = () => new Date().toISOString();
  const dayKey = (date = new Date()) => date.toISOString().slice(0, 10);
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  const LEVELS = Object.freeze({
    off:      { label: "Off", dailyLimit: 0, minGapHours: 24 },
    light:    { label: "Light", dailyLimit: 1, minGapHours: 12 },
    balanced: { label: "Balanced", dailyLimit: 2, minGapHours: 6 },
    active:   { label: "Active", dailyLimit: 3, minGapHours: 3 },
    deep:     { label: "Deep", dailyLimit: 5, minGapHours: 1 }
  });

  const DEFAULT_CATEGORIES = ["awareness","direction","wellbeing","relationships","work","environment","patterns","gratitude"];

  // Questions intentionally use neutral wording. They invite observation without diagnosing,
  // predicting, or presuming that a Pattern-Time or environmental relationship is causal.
  const BANK = Object.freeze([
    // Awareness
    ["awareness","What stands out most clearly right now?","notice"],
    ["awareness","What changed since your last visit?","change"],
    ["awareness","What are you noticing that you might normally overlook?","notice"],
    ["awareness","What feels settled, and what still feels unfinished?","reflection"],
    ["awareness","What is taking up the most attention today?","attention"],
    ["awareness","What happened that is worth preserving accurately?","witness"],
    ["awareness","What detail would your future self be glad you recorded?","memory"],
    ["awareness","What is different from what you expected?","change"],
    ["awareness","What feels simple when you stop trying to solve everything at once?","clarity"],
    ["awareness","What are the observable facts before interpretation is added?","observation"],
    ["awareness","What question keeps returning today?","question"],
    ["awareness","What deserves a second look?","reflection"],

    // Direction
    ["direction","What is the next useful action you can actually complete?","action"],
    ["direction","What matters most before the day ends?","priority"],
    ["direction","What can be made clearer, smaller, or more workable?","clarity"],
    ["direction","What are you moving toward right now?","direction"],
    ["direction","What should you stop carrying into the next cycle?","release"],
    ["direction","What commitment needs a visible next step?","commitment"],
    ["direction","What would meaningful progress look like today?","progress"],
    ["direction","What choice would reduce confusion rather than add to it?","decision"],
    ["direction","What needs preparation before action?","prepare"],
    ["direction","What should be protected while you move forward?","protect"],
    ["direction","What can wait without causing harm?","priority"],
    ["direction","What outcome are you hoping for, and what is within your control?","outcome"],

    // Wellbeing — observational, not medical
    ["wellbeing","How would you describe your energy without judging it?","energy"],
    ["wellbeing","What helped you feel more steady today?","stability"],
    ["wellbeing","What has been draining your attention or energy?","energy"],
    ["wellbeing","What kind of rest would be genuinely restorative?","rest"],
    ["wellbeing","What is your body asking you to notice?","body"],
    ["wellbeing","What made breathing, thinking, or moving feel easier?","ease"],
    ["wellbeing","What conditions supported better focus?","focus"],
    ["wellbeing","What boundary would make today more manageable?","boundary"],
    ["wellbeing","What small act of care is realistic right now?","care"],
    ["wellbeing","What was your sleep like, and what else may have influenced today?","sleep"],
    ["wellbeing","When did you feel most present today?","presence"],
    ["wellbeing","What helped stress decrease, even slightly?","stress"],

    // Relationships
    ["relationships","Who affected your day, and how?","relationship"],
    ["relationships","What communication became clearer or more confused?","communication"],
    ["relationships","What agreement needs to be remembered?","agreement"],
    ["relationships","Where did you feel supported?","support"],
    ["relationships","Where might a calm follow-up prevent misunderstanding?","communication"],
    ["relationships","What did someone do that deserves acknowledgment?","gratitude"],
    ["relationships","What boundary was respected or crossed?","boundary"],
    ["relationships","What would accurate listening require here?","listening"],
    ["relationships","What part of the situation can you describe without assuming intent?","observation"],
    ["relationships","What needs repair, clarification, or release?","repair"],
    ["relationships","Who might need a direct but respectful answer?","communication"],
    ["relationships","What pattern in communication is worth tracking over time?","pattern"],

    // Work and making
    ["work","What did you build, fix, learn, or complete?","work"],
    ["work","What slowed the work down?","obstacle"],
    ["work","What part of the process worked especially well?","process"],
    ["work","What mistake taught you something useful?","learning"],
    ["work","What should be documented before it is forgotten?","documentation"],
    ["work","What resource, tool, or information is missing?","resource"],
    ["work","What task is creating more friction than value?","friction"],
    ["work","What could be automated, templated, or simplified?","system"],
    ["work","What did quality require today?","quality"],
    ["work","What should tomorrow begin with?","prepare"],
    ["work","What progress is real even if the project is unfinished?","progress"],
    ["work","What decision should be recorded with its reasoning?","decision"],

    // Environment and season
    ["environment","What is the sky doing, and how is it affecting the day?","weather"],
    ["environment","What seasonal change is becoming noticeable?","season"],
    ["environment","What changed in light, temperature, wind, or moisture?","environment"],
    ["environment","What did you notice in plants, water, soil, or animals?","nature"],
    ["environment","How usable or difficult did the outdoor conditions feel?","environment"],
    ["environment","What local condition should be compared again later?","measurement"],
    ["environment","What environmental detail may explain part of today without proving causation?","context"],
    ["environment","What place felt especially active, calm, damaged, or restored?","place"],
    ["environment","What resource condition changed: water, shelter, food, energy, or access?","resource"],
    ["environment","What would be useful to measure rather than estimate next time?","measurement"],
    ["environment","How did daylight or darkness shape your routine?","daylight"],
    ["environment","What recurring weather condition is worth tracking?","weather"],

    // Patterns and research discipline
    ["patterns","What seems to be repeating, and how many examples do you actually have?","pattern"],
    ["patterns","What is similar to an earlier event, and what is importantly different?","comparison"],
    ["patterns","What alternative explanation should remain visible?","uncertainty"],
    ["patterns","Is this observation, interpretation, symbolism, or measurement?","classification"],
    ["patterns","What information would make this pattern easier to evaluate?","evidence"],
    ["patterns","What did you expect, and what actually occurred?","outcome"],
    ["patterns","What result would challenge your current interpretation?","correction"],
    ["patterns","What relationship appears meaningful personally even if it is not yet measurable?","meaning"],
    ["patterns","What coincidence became more coherent after being recorded?","synchronicity"],
    ["patterns","What data may be missing from this comparison?","evidence"],
    ["patterns","What changed after the same action was repeated?","experiment"],
    ["patterns","What should remain unresolved rather than forced into an answer?","uncertainty"],

    // Gratitude and continuity
    ["gratitude","What is one thing worth appreciating without pretending everything is easy?","gratitude"],
    ["gratitude","What resource, person, place, or ability helped today?","gratitude"],
    ["gratitude","What did you preserve, protect, or carry forward?","continuity"],
    ["gratitude","What beauty did you notice?","beauty"],
    ["gratitude","What ordinary thing proved valuable today?","gratitude"],
    ["gratitude","What did someone teach you directly or indirectly?","learning"],
    ["gratitude","What worked that you do not want to take for granted?","gratitude"],
    ["gratitude","What memory deserves to remain connected to this day?","memory"],
    ["gratitude","What became possible because someone participated?","participation"],
    ["gratitude","What part of today should be carried into tomorrow?","continuity"],
    ["gratitude","What did you receive, and what might you return?","reciprocity"],
    ["gratitude","What small sign of improvement is worth recording?","progress"],

    // Family and practical life
    ["family","What did your family need most today?","family"],
    ["family","What routine helped the household work better?","routine"],
    ["family","What moment with a child or elder should be remembered?","family"],
    ["family","What family responsibility needs clearer coordination?","coordination"],
    ["family","What made home or shelter feel more stable?","stability"],
    ["family","What practical need should be prepared for next?","prepare"],
    ["family","What did you learn about someone you care for?","relationship"],
    ["family","Where could expectations be made clearer?","communication"],
    ["family","What helped reduce conflict or confusion?","repair"],
    ["family","What shared experience strengthened connection?","connection"],
    ["family","What promise or plan should the family be able to find later?","documentation"],
    ["family","What would make the next transition easier for everyone involved?","prepare"],
    ["family","What skill could be practiced together instead of handled by one person?","learning"],
    ["family","What sign of safety, trust, or stability became visible today?","stability"],

    // Projects and quests
    ["projects","What milestone moved forward?","project"],
    ["projects","What is the project asking you to learn next?","learning"],
    ["projects","What dependency is blocking the next stage?","dependency"],
    ["projects","What should be tested before expanding further?","experiment"],
    ["projects","What feature adds real value rather than complexity?","design"],
    ["projects","What part of the vision now has a concrete form?","becoming"],
    ["projects","What feedback changed your understanding?","feedback"],
    ["projects","What needs an owner, date, or definition of done?","coordination"],
    ["projects","What should be removed to protect coherence?","simplify"],
    ["projects","What can be shared now, even if the larger work continues?","publish"],
    ["projects","What assumption should be tested before more time or money is committed?","experiment"],
    ["projects","What data should this system preserve so future versions remain comparable?","provenance"],
    ["projects","What control would help a new participant understand the system without instruction?","usability"],
    ["projects","What integration would connect this project to the rest of the Codex instead of duplicating it?","integration"]
  ].map((q, i) => Object.freeze({ id:`bank-${String(i+1).padStart(3,"0")}`, category:q[0], text:q[1], intention:q[2] })));

  function defaults() {
    return {
      enabled: true,
      level: "light",
      categories: DEFAULT_CATEGORIES,
      quietStart: "21:30",
      quietEnd: "07:30",
      askOnOpen: true,
      showReason: true,
      allowQuestPriority: true,
      privacyReminder: true
    };
  }

  function prefs() { return { ...defaults(), ...load(PREF_KEY, {}) }; }
  function setPrefs(patch) { const next = { ...prefs(), ...patch }; save(PREF_KEY, next); return next; }
  function state() { return load(STATE_KEY, { day:dayKey(), shownToday:0, lastShownAt:null, snoozedUntil:null, currentId:null }); }
  function setState(patch) { const current = state(); const today = dayKey(); const normalized = current.day === today ? current : { day:today, shownToday:0, lastShownAt:null, snoozedUntil:null, currentId:null }; const next={...normalized,...patch}; save(STATE_KEY,next); return next; }
  function history() { return load(HISTORY_KEY, []); }
  function addHistory(entry) { const next=[entry,...history()].slice(0,1000); save(HISTORY_KEY,next); }
  function quests() { return load(QUEST_KEY, []); }
  function saveQuests(items) { save(QUEST_KEY, items.slice(0,250)); dispatchEvent(new CustomEvent("observatory:quests-changed")); }
  function customQuestions() { return load(CUSTOM_KEY, []); }

  function minutes(time) { const [h,m]=String(time||"00:00").split(":").map(Number); return h*60+m; }
  function inQuietHours(date, p) {
    const current=date.getHours()*60+date.getMinutes(), start=minutes(p.quietStart), end=minutes(p.quietEnd);
    return start === end ? false : start < end ? current >= start && current < end : current >= start || current < end;
  }

  function currentPattern() {
    try { return globalThis.LivingTimeObservatoryRecords?.snapshot?.().pattern || {}; } catch { return {}; }
  }

  function dueQuest(q, now = new Date()) {
    if (!q.enabled) return false;
    const last = q.lastCompletedAt ? new Date(q.lastCompletedAt) : null;
    const created = q.createdAt ? new Date(q.createdAt) : now;
    const base = last || created;
    if (q.schedule === "daily") return !last || dayKey(last) !== dayKey(now);
    if (q.schedule === "weekly") return now - base >= 7*DAY;
    if (q.schedule === "monthly") return !last || last.getFullYear() !== now.getFullYear() || last.getMonth() !== now.getMonth();
    if (q.schedule === "interval") return now - base >= Math.max(1, Number(q.intervalDays)||1)*DAY;
    if (q.schedule === "moonDay") {
      const pd = currentPattern().moonDay;
      return Number(pd) === Number(q.moonDay) && (!last || dayKey(last) !== dayKey(now));
    }
    return true;
  }

  function availableQuestions() {
    const p=prefs();
    const allowed=new Set(p.categories || DEFAULT_CATEGORIES);
    return [...BANK, ...customQuestions()].filter(q => allowed.has(q.category) || q.custom);
  }

  function scoreQuestion(q, recentIds, context) {
    let score=Math.random()*2;
    if (!recentIds.includes(q.id)) score += 4;
    if (q.category === "environment" && context.season) score += 1.5;
    if (q.category === "patterns" && context.recordCount >= 2) score += 2;
    if (q.category === "direction" && new Date().getHours() < 12) score += 1;
    if (q.category === "gratitude" && new Date().getHours() >= 17) score += 1;
    return score;
  }

  function chooseQuestion() {
    const p=prefs();
    const due=quests().filter(q=>dueQuest(q)).sort((a,b)=>(b.priority||0)-(a.priority||0));
    if (p.allowQuestPriority && due.length) {
      const q=due[0]; return { id:q.id, text:q.question, category:"quest", intention:q.intention||"quest", questId:q.id, reason:`Your recurring quest “${q.title}” is due.` };
    }
    const recent=history().slice(0,25).map(h=>h.questionId);
    const snap=globalThis.LivingTimeObservatoryRecords?.snapshot?.() || {};
    const context={season:snap.environment?.seasonal?.season, recordCount:globalThis.LivingTimeObservatoryRecords?.list?.().length||0};
    const ranked=availableQuestions().map(q=>({q,score:scoreQuestion(q,recent,context)})).sort((a,b)=>b.score-a.score);
    const q=ranked[0]?.q || BANK[0];
    const reasons=[];
    if(q.category==="environment"&&context.season) reasons.push(`${context.season} context`);
    if(q.category==="patterns"&&context.recordCount>=2) reasons.push("you have records available for comparison");
    if(!reasons.length) reasons.push("it has not been asked recently");
    return {...q,reason:`Suggested because ${reasons.join(" and ")}.`};
  }

  function mayAsk({force=false}={}) {
    const p=prefs(), s=state(), cfg=LEVELS[p.level] || LEVELS.light, now=new Date();
    if(force) return true;
    if(!p.enabled || p.level==="off" || !p.askOnOpen || inQuietHours(now,p)) return false;
    if(s.snoozedUntil && Date.now() < new Date(s.snoozedUntil).getTime()) return false;
    if(s.shownToday >= cfg.dailyLimit) return false;
    if(s.lastShownAt && Date.now()-new Date(s.lastShownAt).getTime() < cfg.minGapHours*3600000) return false;
    return true;
  }

  function renderQuestion(question) {
    const shell=$("#obs-question-shell"); if(!shell) return;
    shell.hidden=false;
    shell.dataset.questionId=question.id;
    shell.dataset.questId=question.questId||"";
    $("#obs-question-category").textContent=question.category === "quest" ? "Recurring Quest" : question.category;
    $("#obs-question-text").textContent=question.text;
    $("#obs-question-reason").textContent=prefs().showReason ? question.reason : "";
    $("#obs-question-answer").value="";
    $("#obs-question-answer").placeholder="A sentence is enough.";
    setState({currentId:question.id,lastShownAt:nowIso(),shownToday:state().shownToday+1});
    addHistory({questionId:question.id,shownAt:nowIso(),action:"shown"});
  }

  function hideQuestion() { const shell=$("#obs-question-shell"); if(shell) shell.hidden=true; setState({currentId:null}); }
  function announce(msg,kind="ok") { const node=$("#observatory-status"); if(node){node.textContent=msg;node.dataset.kind=kind;} }

  function answerQuestion() {
    const shell=$("#obs-question-shell"), answer=$("#obs-question-answer")?.value.trim();
    if(!shell||!answer){announce("A short answer is enough, or you can skip this question.","error");return;}
    const questionId=shell.dataset.questionId, questId=shell.dataset.questId;
    const question=[...BANK,...customQuestions()].find(q=>q.id===questionId);
    const quest=quests().find(q=>q.id===questId);
    const form=$("#observatory-witness-form");
    if(form){
      const obs=form.elements.namedItem("observation"), intent=form.elements.namedItem("intention"), tags=form.elements.namedItem("tags");
      if(obs) obs.value=answer;
      if(intent && !intent.value) intent.value=quest?.intention || question?.intention || "check-in";
      if(tags){ const existing=String(tags.value||"").split(",").map(v=>v.trim()).filter(Boolean); tags.value=[...new Set([...existing,"guided-question",questId?"quest":"check-in",question?.category].filter(Boolean))].join(", "); }
      form.requestSubmit();
    }
    if(questId){ const next=quests().map(q=>q.id===questId?{...q,lastCompletedAt:nowIso(),completionCount:(q.completionCount||0)+1}:q); saveQuests(next); }
    addHistory({questionId,questId:questId||null,answeredAt:nowIso(),action:"answered"});
    hideQuestion();
    announce(questId?"Quest response preserved.":"Check-in preserved with the current Observatory context.");
  }

  function skipQuestion() { const id=$("#obs-question-shell")?.dataset.questionId; addHistory({questionId:id,at:nowIso(),action:"skipped"}); hideQuestion(); announce("Skipped. The Observatory will choose a different question later."); }
  function snoozeQuestion(hours=4) { const id=$("#obs-question-shell")?.dataset.questionId; setState({snoozedUntil:new Date(Date.now()+hours*3600000).toISOString(),currentId:null}); addHistory({questionId:id,at:nowIso(),action:"snoozed"}); hideQuestion(); announce(`Check-ins snoozed for ${hours} hours.`); }

  function createQuest(data) {
    const question=String(data.question||"").trim(), title=String(data.title||question.slice(0,50)||"Personal quest").trim();
    if(!question) throw new Error("Add a question for this quest.");
    const q={id:uid("QUEST"),title,question,intention:String(data.intention||"quest").trim(),schedule:data.schedule||"daily",intervalDays:Math.max(1,Number(data.intervalDays)||1),moonDay:Math.min(28,Math.max(1,Number(data.moonDay)||1)),priority:Number(data.priority)||1,enabled:true,createdAt:nowIso(),lastCompletedAt:null,completionCount:0};
    saveQuests([q,...quests()]); return q;
  }

  function renderQuestList() {
    const node=$("#obs-quest-list"); if(!node) return;
    const items=quests();
    node.innerHTML=items.length?items.map(q=>`<article class="obs-quest-card" data-quest-id="${escapeHtml(q.id)}"><div><small>${escapeHtml(q.schedule==="interval"?`Every ${q.intervalDays} days`:q.schedule==="moonDay"?`Moon Day ${q.moonDay}`:q.schedule)}</small><strong>${escapeHtml(q.title)}</strong><p>${escapeHtml(q.question)}</p></div><div class="obs-quest-actions"><button type="button" data-quest-ask>Ask now</button><button type="button" data-quest-toggle>${q.enabled?"Pause":"Resume"}</button><button type="button" data-quest-delete>Delete</button></div></article>`).join(""):`<div class="obs-empty"><strong>No personal quests yet.</strong><span>Create a repeating question for a habit, project, relationship, study, or responsibility.</span></div>`;
    node.querySelectorAll("[data-quest-ask]").forEach(b=>b.addEventListener("click",()=>{const q=items.find(x=>x.id===b.closest("[data-quest-id]").dataset.questId);if(q){renderQuestion({id:q.id,text:q.question,category:"quest",intention:q.intention,questId:q.id,reason:`You chose to open “${q.title}”.`});$("#obs-question-shell")?.scrollIntoView({behavior:"smooth",block:"center"});}}));
    node.querySelectorAll("[data-quest-toggle]").forEach(b=>b.addEventListener("click",()=>{const id=b.closest("[data-quest-id]").dataset.questId;saveQuests(items.map(q=>q.id===id?{...q,enabled:!q.enabled}:q));renderQuestList();}));
    node.querySelectorAll("[data-quest-delete]").forEach(b=>b.addEventListener("click",()=>{const id=b.closest("[data-quest-id]").dataset.questId;if(confirm("Delete this recurring quest?")){saveQuests(items.filter(q=>q.id!==id));renderQuestList();}}));
  }

  function renderSettings() {
    const p=prefs();
    const level=$("#obs-question-level"); if(level) level.value=p.level;
    const enabled=$("#obs-question-enabled"); if(enabled) enabled.checked=p.enabled;
    const ask=$("#obs-question-on-open"); if(ask) ask.checked=p.askOnOpen;
    const reason=$("#obs-question-show-reason"); if(reason) reason.checked=p.showReason;
    const qs=$("#obs-question-quiet-start"); if(qs) qs.value=p.quietStart;
    const qe=$("#obs-question-quiet-end"); if(qe) qe.value=p.quietEnd;
    $$('[data-question-category]').forEach(cb=>cb.checked=(p.categories||[]).includes(cb.value));
  }

  function bindSettings() {
    const saveBtn=$("#obs-question-save-settings");
    saveBtn?.addEventListener("click",()=>{
      const categories=$$('[data-question-category]:checked').map(cb=>cb.value);
      setPrefs({enabled:$("#obs-question-enabled").checked,level:$("#obs-question-level").value,askOnOpen:$("#obs-question-on-open").checked,showReason:$("#obs-question-show-reason").checked,quietStart:$("#obs-question-quiet-start").value,quietEnd:$("#obs-question-quiet-end").value,categories:categories.length?categories:DEFAULT_CATEGORIES});
      announce("Question preferences saved locally.");
    });
    $("#obs-question-ask-now")?.addEventListener("click",()=>renderQuestion(chooseQuestion()));
    $("#obs-question-answer-save")?.addEventListener("click",answerQuestion);
    $("#obs-question-skip")?.addEventListener("click",skipQuestion);
    $("#obs-question-snooze")?.addEventListener("click",()=>snoozeQuestion(4));
    $("#obs-question-close")?.addEventListener("click",hideQuestion);
    $("#obs-question-answer")?.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter")answerQuestion();});
    $("#obs-quest-form")?.addEventListener("submit",e=>{e.preventDefault();const fd=new FormData(e.currentTarget);try{createQuest(Object.fromEntries(fd.entries()));e.currentTarget.reset();renderQuestList();announce("Recurring quest created.");}catch(err){announce(err.message,"error");}});
    addEventListener("observatory:quests-changed",renderQuestList);
  }

  function init() {
    renderSettings(); renderQuestList(); bindSettings();
    setTimeout(()=>{ if(mayAsk()) renderQuestion(chooseQuestion()); }, 900);
  }

  globalThis.LivingTimeQuestionQuests=Object.freeze({BANK,LEVELS,prefs,setPrefs,quests,createQuest,chooseQuestion,renderQuestion,mayAsk});
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init,{once:true}):init();
})();
