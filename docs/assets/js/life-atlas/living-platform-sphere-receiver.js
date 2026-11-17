/** Living Phone ↔ Sphere paired receiver. Explicit per-session receiving approval. */
(function (root, factory) {
  let Contract = root.LivingPlatformContract;
  let Bridge = root.CodexLifeAtlasPlatformBridge;
  if (typeof module === "object" && module.exports) {
    Contract = require("./living-platform-contract.js");
    Bridge = require("./life-atlas-platform-bridge.js");
    module.exports = factory(root, Contract, Bridge, false);
    return;
  }
  root.LivingPlatformSphereReceiver = factory(root, Contract, Bridge, true);
})(typeof globalThis !== "undefined" ? globalThis : this, function (root, Contract, Bridge, autoBoot) {
  "use strict";
  const VERSION = "0.3.1";
  const TOKEN_RE = /^[A-Za-z0-9_-]{20,160}$/;
  const WRITE_SCOPE = "life_atlas.write";
  const state = {moduleId:"apl-cor",enabled:false,recordIds:[],count:0,paired:false};

  function reportModuleStatus(status, detail = null) {
    try {
      root.LivingModuleBootstrap?.ensureRegistered?.();
      root.LivingProjectionBus?.setModuleStatus?.("apl-cor", status, detail);
    } catch (_) {}
  }

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function parsePairingFragment(hash = root.location?.hash || "") {
    const raw = String(hash || "").replace(/^#/, "");
    if (!raw) return null;
    const params = new URLSearchParams(raw);
    const token = String(params.get("lp-pair") || "");
    const port = Number(params.get("lp-port"));
    if (!TOKEN_RE.test(token) || !Number.isInteger(port) || port < 1024 || port > 65535) return null;
    return {token,port};
  }

  function stripPairingFragment() {
    try {
      if (!root.history?.replaceState || !root.location) return;
      root.history.replaceState(null, "", root.location.pathname + root.location.search);
    } catch (_) {}
  }

  function patternCoordinates(civilDate, calendar = root.PatternCalendar) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(civilDate || ""))) throw new Error("Living Phone temporal record has no valid civil date.");
    if (!calendar?.fromCivilDate) throw new Error("Pattern Calendar authority is unavailable.");
    const mapped = calendar.fromCivilDate({date:new Date(`${civilDate}T12:00:00Z`),timeZone:"UTC",boundaryMode:"midnight"});
    const patternYear = mapped.anchorDate instanceof Date ? mapped.anchorDate.getUTCFullYear() : Number(String(civilDate).slice(0,4));
    const patternDay = Number(mapped.dayOfPatternYear);
    if (!Number.isFinite(patternDay)) throw new Error("Pattern Calendar did not resolve a pattern day.");
    return {patternYear,moon:Number(mapped.moon),moonDay:Number(mapped.day),patternDay,week:Number(mapped.weekOfYear),outsideDay:!mapped.insideCountedYear,boundaryMode:"midnight",timezone:"UTC"};
  }

  function mapEnvelopeTemporal(envelope, calendar = root.PatternCalendar) {
    Contract?.requireValidEnvelope?.(envelope);
    const mapped = clone(envelope);
    mapped.records = mapped.records.map(record => {
      const next = clone(record);
      const temporal = next.lifeRecord?.temporal || {};
      if (!Number.isFinite(Number(temporal.patternDay))) next.lifeRecord.temporal = {...temporal,...patternCoordinates(temporal.civilDate, calendar)};
      return next;
    });
    return mapped;
  }

  async function fetchEnvelope(pair, options = {}) {
    const fetchFn = options.fetchFn || root.fetch;
    if (typeof fetchFn !== "function") throw new Error("Browser fetch is unavailable.");
    const limit = Math.max(1, Math.min(Number(options.limit || 50), 50));
    const url = `http://127.0.0.1:${pair.port}/api/bridge/apl-cor/life-atlas-envelope?limit=${limit}`;
    const response = await fetchFn(url,{method:"GET",mode:"cors",cache:"no-store",headers:{"X-Living-Phone-Pairing":pair.token}});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Living Phone bridge returned ${response.status}`);
    return data;
  }

  function currentLens() { return Object.freeze({moduleId:state.moduleId,enabled:state.enabled,recordIds:state.recordIds.slice(),count:state.count,private:true,provenanceClass:"derived_fact"}); }

  function setLensEnabled(enabled) {
    state.enabled = Boolean(enabled) && state.count > 0;
    root.dispatchEvent?.(new CustomEvent("sof:living-platform-lens-change",{detail:currentLens()}));
    renderCompactStatus();
    return currentLens();
  }

  const LensApi = Object.freeze({current:currentLens,setEnabled:setLensEnabled});
  root.LivingPlatformSphereLens = LensApi;

  function ensureStyle() {
    if (!root.document || root.document.getElementById("living-platform-sphere-lens-style")) return;
    const style = root.document.createElement("style");
    style.id = "living-platform-sphere-lens-style";
    style.textContent = `.lp-sphere-pair{position:fixed;z-index:9999;left:max(12px,env(safe-area-inset-left));right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));margin:auto;max-width:32rem;padding:1rem;border:1px solid rgba(246,213,106,.46);border-radius:1rem;background:rgba(7,11,16,.96);color:#f5f1df;box-shadow:0 14px 44px rgba(0,0,0,.42);font:500 14px/1.45 system-ui,sans-serif}.lp-sphere-pair strong{display:block;font-size:1rem;margin-bottom:.3rem}.lp-sphere-pair p{margin:.35rem 0 .85rem;opacity:.84}.lp-sphere-pair .actions{display:flex;gap:.55rem;flex-wrap:wrap}.lp-sphere-pair button{min-height:2.7rem;padding:.6rem .85rem;border-radius:.75rem;border:1px solid rgba(246,213,106,.45);background:rgba(246,213,106,.1);color:inherit;font:inherit;font-weight:750}.lp-sphere-pair.compact{left:auto;right:max(12px,env(safe-area-inset-right));max-width:min(19rem,calc(100vw - 24px));padding:.65rem .75rem}.lp-sphere-pair.compact p{display:none}.lp-sphere-pair.compact strong{font-size:.84rem;margin:0}`;
    root.document.head?.appendChild(style);
  }

  function statusElement() {
    if (!root.document) return null;
    ensureStyle();
    let el = root.document.getElementById("living-platform-sphere-pair");
    if (!el) { el=root.document.createElement("aside"); el.id="living-platform-sphere-pair"; el.className="lp-sphere-pair"; root.document.body?.appendChild(el); }
    return el;
  }

  function renderCompactStatus(message = null) {
    const el=statusElement(); if (!el || state.count<=0) return;
    el.className="lp-sphere-pair compact";
    el.innerHTML=`<strong>APL C.O.R. · ${state.count} private temporal record${state.count===1?"":"s"}</strong><p>${message||"Derived Case Counsel projection only."}</p><div class="actions"><button type="button" data-lp-lens-toggle>${state.enabled?"Legal lens: on":"Legal lens: off"}</button></div>`;
    el.querySelector("[data-lp-lens-toggle]")?.addEventListener("click",()=>setLensEnabled(!state.enabled));
  }

  function renderApproval() {
    const el=statusElement(); if (!el) return Promise.resolve(false);
    el.className="lp-sphere-pair";
    el.innerHTML=`<strong>Connect APL C.O.R. to this private Life Atlas?</strong><p>This imports only permission-scoped <em>derived Case Counsel timeline</em> records. No evidence files or legal database are copied. The imported records remain private and do not become independent evidence.</p><div class="actions"><button type="button" data-lp-approve>Approve private import</button><button type="button" data-lp-cancel>Cancel</button></div>`;
    return new Promise(resolve=>{el.querySelector("[data-lp-approve]")?.addEventListener("click",()=>resolve(true),{once:true});el.querySelector("[data-lp-cancel]")?.addEventListener("click",()=>{el.remove();resolve(false);},{once:true});});
  }

  async function importPairedEnvelope(pair, options = {}) {
    if (!Bridge?.importEnvelope) throw new Error("Life Atlas platform bridge is unavailable.");
    const raw=options.envelope||await fetchEnvelope(pair,options);
    const mapped=mapEnvelopeTemporal(raw,options.calendar||root.PatternCalendar);
    const report=await Bridge.importEnvelope(mapped,{repository:options.repository,grantedScopes:[WRITE_SCOPE]});
    state.paired=true; state.recordIds=report.imported.map(record=>record?.id).filter(Boolean); state.count=state.recordIds.length; state.enabled=state.count>0;
    reportModuleStatus("ready", { paired: true, imported: state.count });
    root.dispatchEvent?.(new CustomEvent("sof:life-atlas-records-changed",{detail:{source:"living-platform",moduleId:"apl-cor",imported:state.count}}));
    root.dispatchEvent?.(new CustomEvent("sof:living-platform-lens-change",{detail:currentLens()}));
    renderCompactStatus(); return report;
  }

  async function discoverExisting() {
    try {
      const repository=await root.CodexLifeAtlasRuntime?.ready;
      if (!repository?.query) return [];
      const records=await repository.query({tag:"apl-cor"});
      state.recordIds=records.map(r=>r?.id).filter(Boolean);
      state.count=state.recordIds.length;
      state.enabled=false;
      reportModuleStatus(state.count ? "ready" : "dormant", { paired: false, imported: state.count });
      if (state.count) renderCompactStatus();
      return records;
    } catch (_) {
      reportModuleStatus("unavailable", { reason: "life-atlas-runtime-unavailable" });
      return [];
    }
  }

  async function boot() {
    const pair=parsePairingFragment(); if (!pair) { void discoverExisting(); return; }
    stripPairingFragment(); const approved=await renderApproval(); if (!approved) return;
    try { const el=statusElement(); if (el) el.innerHTML="<strong>Connecting Living Phone…</strong><p>Validating the one-time bridge and mapping legal dates through the canonical Pattern Calendar.</p>"; await importPairedEnvelope(pair); }
    catch (error) { reportModuleStatus("error", { message: String(error?.message||error) }); const el=statusElement(); if (el) { el.className="lp-sphere-pair"; el.innerHTML=`<strong>Living Phone connection failed</strong><p>${String(error?.message||error)}</p>`; } }
  }

  const api=Object.freeze({VERSION,WRITE_SCOPE,parsePairingFragment,patternCoordinates,mapEnvelopeTemporal,fetchEnvelope,importPairedEnvelope,discoverExisting,lens:LensApi,boot});
  if (autoBoot) { if (root.document?.readyState==="loading") root.document.addEventListener("DOMContentLoaded",boot,{once:true}); else queueMicrotask(boot); }
  return api;
});
