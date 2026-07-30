(() => {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtDate = iso => { try { return new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(iso)); } catch { return iso || "—"; } };

  function announce(message, kind = "ok") {
    const node = $("#observatory-status");
    if (!node) return;
    node.textContent = message;
    node.dataset.kind = kind;
  }

  function renderCurrent() {
    const R = globalThis.LivingTimeObservatoryRecords;
    const snap = R.snapshot();
    const p = snap.pattern, a = snap.astronomy;
    const set = (id, value) => { const el = $(id); if (el) el.textContent = value ?? "—"; };
    set("#obs-current-pattern", p.outsideDay ? "Outside Day" : `Moon ${p.moon || "—"} · Day ${p.moonDay || "—"}`);
    set("#obs-current-day", p.dayOf364 ? `${p.dayOf364} / 364` : "—");
    set("#obs-current-lunar", [a.lunarPhase, a.illumination != null ? `${Math.round(a.illumination)}%` : null].filter(Boolean).join(" · ") || "—");
    set("#obs-current-passage", a.passage?.active ? `${Math.round((a.passage.progress || 0) * 100)}% active` : "Outside active Passage");
    set("#obs-current-source", snap.provenance.calculated ? "Canonical live engines" : "Fallback snapshot");
    set("#obs-current-version", snap.provenance.sphereVersion || snap.provenance.schemaVersion);
    set("#obs-current-season", snap.environment?.seasonal ? `${snap.environment.seasonal.season} · ${Math.round((snap.environment.seasonal.progress||0)*100)}%` : "—");
    set("#obs-current-daylight", snap.environment?.seasonal?.daylightHoursEstimate != null ? `${snap.environment.seasonal.daylightHoursEstimate} hours est.` : "—");
  }

  function renderArchive() {
    const R = globalThis.LivingTimeObservatoryRecords;
    const Rec = globalThis.LivingTimeObservatoryRecurrence;
    const records = R.list();
    const summary = Rec.summarize(records);
    const count = $("#obs-record-count"); if (count) count.textContent = String(summary.count);
    const tags = $("#obs-top-tags");
    if (tags) tags.innerHTML = summary.topTags.length ? summary.topTags.map(([t,n]) => `<span>${esc(t)} <b>${n}</b></span>`).join("") : `<em>No repeated tags yet.</em>`;
    const list = $("#obs-record-list");
    if (!list) return;
    if (!records.length) {
      list.innerHTML = `<div class="obs-empty"><strong>No witness records yet.</strong><span>Your first record will be anchored to the current Pattern and astronomical state.</span></div>`;
      renderRecurrence(null, []);
      return;
    }
    list.innerHTML = records.slice(0, 20).map((r, i) => `
      <article class="obs-record-card ${i===0?"is-current":""}" data-record-id="${esc(r.recordId)}">
        <div class="obs-record-heading"><div><small>${esc(fmtDate(r.instant))}</small><strong>${r.pattern?.outsideDay ? "Outside Day" : `Moon ${esc(r.pattern?.moon || "—")} · Day ${esc(r.pattern?.moonDay || "—")}`}</strong></div><span>${esc(r.privacy?.visibility || "private")}</span></div>
        <p>${esc(r.witness?.observation || r.witness?.intention || "Witness record")}</p>
        <div class="obs-record-tags">${(r.witness?.tags || []).map(t=>`<i>${esc(t)}</i>`).join("")}</div>
        <div class="obs-record-actions"><button type="button" data-obs-compare>Compare</button><button type="button" data-obs-delete>Delete</button></div>
      </article>`).join("");
    list.querySelectorAll("[data-obs-delete]").forEach(btn => btn.addEventListener("click", () => {
      const id = btn.closest("[data-record-id]").dataset.recordId;
      if (confirm("Delete this local Observatory record?")) { R.remove(id); renderArchive(); announce("Record deleted."); }
    }));
    list.querySelectorAll("[data-obs-compare]").forEach(btn => btn.addEventListener("click", () => {
      const id = btn.closest("[data-record-id]").dataset.recordId;
      const target = records.find(r => r.recordId === id);
      renderRecurrence(target, Rec.rank(target, records));
      $("#observatory-recurrence")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    renderRecurrence(records[0], Rec.rank(records[0], records));
    renderCentury(records);
  }

  function renderRecurrence(target, ranked) {
    const panel = $("#obs-recurrence-results");
    if (!panel) return;
    if (!target || !ranked.length) {
      panel.innerHTML = `<div class="obs-empty"><strong>Recurrence requires at least two records.</strong><span>The system compares Pattern position, lunar state, season, tags, and intention without claiming causation.</span></div>`;
      return;
    }
    panel.innerHTML = ranked.map(({record,comparison}) => `
      <article class="obs-recurrence-card">
        <div class="obs-score-ring" style="--score:${comparison.percent}"><strong>${comparison.percent}%</strong><span>${esc(comparison.confidence)}</span></div>
        <div><small>${esc(fmtDate(record.instant))}</small><h4>${esc(comparison.classification)}</h4><p>${esc(comparison.evidence.join(" · ") || "Limited comparable evidence")}</p><em>${esc(comparison.caveat)}</em></div>
      </article>`).join("");
  }


  function renderCentury(records) {
    const map = $("#obs-century-map"); if (!map || !globalThis.LivingTimeMultiYearMap) return;
    const end = Number($("#obs-century-end")?.value) || new Date().getFullYear();
    const span = Number($("#obs-century-span")?.value) || 200;
    const connections = $("#obs-century-lines")?.checked !== false;
    globalThis.LivingTimeMultiYearMap.render(map, records, { endYear:end, span, connections });
  }

  function bindForm() {
    const form = $("#observatory-witness-form");
    if (!form) return;
    form.addEventListener("submit", event => {
      event.preventDefault();
      const fd = new FormData(form);
      try {
        const record = globalThis.LivingTimeObservatoryRecords.createRecord({
          witness: {
            intention: fd.get("intention"), observation: fd.get("observation"), interpretation: fd.get("interpretation"),
            uncertainty: fd.get("uncertainty"), action: fd.get("action"), outcome: fd.get("outcome"), tags: fd.get("tags")
          },
          personal: { energy: fd.get("energy"), stress: fd.get("stress"), focus: fd.get("focus") },
          claim: { type: fd.get("claimType"), statement: fd.get("interpretation") || fd.get("observation") },
          entities: { placeId: fd.get("placeId") },
          environment: { location: (()=>{try{return JSON.parse(fd.get("locationJson")||"null")}catch{return null}})(), conditions: { temperatureC: fd.get("temperatureC"), humidityPercent: fd.get("humidityPercent"), cloudCoverPercent: fd.get("cloudCoverPercent"), windKph: fd.get("windKph"), fieldNotes: fd.get("fieldNotes") } },
          privacy: { visibility: fd.get("visibility") }
        });
        globalThis.LivingTimeObservatoryRecords.save(record);
        form.reset();
        renderArchive(); renderCurrent();
        announce("Witness preserved with its current Pattern, astronomical, and provenance context.");
      } catch (error) { announce(error.message || "The witness could not be saved.", "error"); }
    });
    $("#obs-capture-location")?.addEventListener("click", async () => { try { const loc = await globalThis.LivingTimeSeasonalEnvironment.requestLocation(); $("#obs-location-json").value = JSON.stringify(loc); announce(`Location captured to about ${loc.accuracyMeters} m accuracy.`); } catch(error) { announce(error.message, "error"); } });
    ["#obs-century-end","#obs-century-span","#obs-century-lines"].forEach(id=>$(id)?.addEventListener("change",()=>renderCentury(globalThis.LivingTimeObservatoryRecords.list())));
    const endInput=$("#obs-century-end"); if(endInput&&!endInput.value)endInput.value=String(new Date().getFullYear());
    $("#obs-export")?.addEventListener("click", () => globalThis.LivingTimeObservatoryRecords.download());
    $("#obs-import")?.addEventListener("click", () => $("#obs-import-file")?.click());
    $("#obs-import-file")?.addEventListener("change", async event => {
      const file = event.target.files?.[0]; if (!file) return;
      try { const result = await globalThis.LivingTimeObservatoryRecords.importBundle(file); renderArchive(); announce(`Imported ${result.accepted} of ${result.total} records.`); }
      catch (error) { announce(error.message || "Import failed.", "error"); }
      event.target.value = "";
    });
  }

  function init() {
    if (!globalThis.LivingTimeObservatoryRecords || !globalThis.LivingTimeObservatoryRecurrence) return;
    renderCurrent(); renderArchive(); bindForm();
    addEventListener("observatory:record-saved", renderArchive);
    addEventListener("observatory:records-changed", renderArchive);
    setInterval(renderCurrent, 60000);
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init, { once: true }) : init();
})();
