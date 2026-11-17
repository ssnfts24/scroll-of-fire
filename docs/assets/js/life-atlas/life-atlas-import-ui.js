/** Life Atlas Import Center UI — Android-safe selection, ZIP inspection, local parsing + explicit commit. */
(function (root) {
  "use strict";
  const state = { candidates: [], files: [], analyzing: false, diagnostics: null, backupRecords: [], backupRejected: 0 };
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[ch]);
  function setStatus(text, tone = "") { const el = $("life-atlas-import-status"); if (!el) return; el.textContent = text; el.dataset.tone = tone; }

  function renderPreview(summary = null) {
    const host = $("life-atlas-import-preview"); if (!host) return;
    if (!summary) { host.innerHTML = '<p class="sphere-methods">Select an export or ZIP. Codex identifies supported data locally, then stages records for review before anything is saved.</p>'; return; }
    const sources = Object.entries(summary.sources || {}).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `<span><b>${v}</b> ${escapeHtml(k)}</span>`).join("");
    const samples = (summary.samples || []).slice(0, 4).map(c => `<li><strong>${escapeHtml(c.title || c.sourceType || "Record")}</strong><small>${escapeHtml((c.instant || "undated").slice(0,10))}${c.placeLabel ? ` · ${escapeHtml(c.placeLabel)}` : ""}</small></li>`).join("");
    const archiveNote = summary.archiveEntries ? `<p class="life-atlas-archive-note">ZIP inspection: <b>${summary.archiveEntries}</b> entries · <b>${summary.archiveCandidates}</b> candidate data files${summary.archiveSkipped ? ` · ${summary.archiveSkipped} skipped by safety limits` : ""}.</p>` : "";
    const backupNote = summary.backup ? `<p class="life-atlas-archive-note">Life Atlas backup: <b>${summary.backup}</b> full records staged for restore with their original ids${summary.backupRejected ? ` · ${summary.backupRejected} invalid record(s) will be skipped` : ""}.</p>` : "";
    host.innerHTML = `<div class="life-atlas-import-metrics"><span><b>${summary.files}</b> selected</span><span><b>${summary.candidates}</b> records</span><span><b>${summary.located}</b> located</span><span><b>${summary.dated}</b> dated</span></div><div class="life-atlas-source-chips">${sources || '<span>No recognizable records</span>'}</div>${backupNote}${archiveNote}${samples ? `<div class="life-atlas-stage-samples"><p>Staged preview</p><ul>${samples}</ul></div>` : ""}`;
  }

  async function parseVirtualFile(virtual, sources) {
    const backup = root.CodexLifeAtlasExport ? root.CodexLifeAtlasExport.parseBackup(virtual.text) : null;
    if (backup) {
      state.backupRecords.push(...backup.records);
      state.backupRejected += backup.rejected.length;
      sources["life-atlas-backup"] = (sources["life-atlas-backup"] || 0) + backup.records.length;
      return backup.records.length;
    }
    const parsed = root.CodexLifeAtlasImporters.parseText({ text: virtual.text, filename: virtual.name });
    state.candidates.push(...parsed.candidates.map(c => ({ ...c, importFile: virtual.importFile || virtual.name, importEntry: virtual.archiveEntry ? virtual.name : null })));
    sources[parsed.sourceType] = (sources[parsed.sourceType] || 0) + parsed.candidates.length;
    return parsed.candidates.length;
  }

  async function analyze(files) {
    if (!root.CodexLifeAtlasImporters) return setStatus("Importer module unavailable.", "error");
    if (!files?.length) return;
    state.analyzing = true; state.candidates = []; state.backupRecords = []; state.backupRejected = 0; state.files = [...files];
    const commit = $("life-atlas-import-commit"); if (commit) commit.disabled = true;
    setStatus(`Inspecting ${state.files.length} selected file${state.files.length === 1 ? "" : "s"} locally…`, "working");
    const sources = {}; let located = 0; let dated = 0; let failures = 0; let archiveEntries = 0; let archiveCandidates = 0; let archiveSkipped = 0;

    for (const file of state.files) {
      try {
        const isZip = root.CodexLifeAtlasZip && (file.name.toLowerCase().endsWith(".zip") || await root.CodexLifeAtlasZip.isZipBlob(file));
        if (isZip) {
          setStatus(`Reading archive directory · ${file.name}…`, "working");
          const extracted = await root.CodexLifeAtlasZip.extractCandidateTexts(file);
          archiveEntries += extracted.entries.length;
          archiveCandidates += extracted.candidateEntries;
          archiveSkipped += extracted.skippedLarge + extracted.skippedUnsupported;
          for (const virtual of extracted.files) {
            try { await parseVirtualFile({ ...virtual, importFile: file.name }, sources); }
            catch (error) { failures += 1; console.warn("Life Atlas ZIP entry skipped", virtual.name, error); }
          }
          continue;
        }
        if (file.size > root.CodexLifeAtlasImporters.MAX_TEXT_BYTES) { failures += 1; console.warn("Life Atlas file over text safety limit", file.name); continue; }
        await parseVirtualFile({ name: file.name, text: await file.text(), importFile: file.name }, sources);
      } catch (error) { failures += 1; console.warn("Life Atlas import analysis failed", file.name, error); }
    }

    state.candidates.forEach(c => { if ((Number.isFinite(c.latitude) && Number.isFinite(c.longitude)) || c.placeLabel) located += 1; if (c.instant) dated += 1; });
    const summary = { files: state.files.length, candidates: state.candidates.length, located, dated, sources, samples: state.candidates, archiveEntries, archiveCandidates, archiveSkipped, backup: state.backupRecords.length, backupRejected: state.backupRejected };
    state.diagnostics = summary; renderPreview(summary);
    if (commit) commit.disabled = state.candidates.length === 0 && state.backupRecords.length === 0;
    if (state.backupRecords.length && !state.candidates.length) setStatus(`${state.backupRecords.length} backup records staged for restore. Nothing has been saved yet.${failures ? ` ${failures} item(s) were skipped.` : ""}`, "ready");
    else if (state.candidates.length) setStatus(`${state.candidates.length} records staged for review. Nothing has been saved yet.${failures ? ` ${failures} item(s) were skipped.` : ""}`, "ready");
    else if (archiveEntries && archiveCandidates === 0) setStatus("ZIP opened successfully, but no supported data files were recognized inside it.", "warning");
    else setStatus(`No recognizable records found.${failures ? ` ${failures} file or archive item(s) could not be parsed.` : ""}`, "warning");
    state.analyzing = false;
  }

  async function commit() {
    if ((!state.candidates.length && !state.backupRecords.length) || !root.CodexLifeAtlasRuntime) return;
    if (state.candidates.length && !root.CodexLifeAtlasIngestion) return;
    const button = $("life-atlas-import-commit"); if (button) button.disabled = true;
    setStatus("Saving private Life Atlas records…", "working");
    try {
      const repository = await root.CodexLifeAtlasRuntime.ready;
      const parts = [];
      if (state.backupRecords.length) {
        const restored = await repository.importRecords(state.backupRecords);
        parts.push(`Restored ${restored.imported.length} backup records · ${restored.rejected.length + state.backupRejected} rejected`);
        state.backupRecords = []; state.backupRejected = 0;
        root.dispatchEvent?.(new CustomEvent("sof:life-atlas-records-changed", { detail: restored }));
      }
      if (state.candidates.length) {
        const report = await root.CodexLifeAtlasIngestion.ingestCandidates(state.candidates, { repository, patternCalendar: root.PatternCalendar });
        parts.push(`Saved ${report.accepted} private records · ${report.duplicates} duplicates skipped · ${report.rejected} rejected. Review state remains unreviewed.`);
        root.dispatchEvent?.(new CustomEvent("sof:life-atlas-records-changed", { detail: report }));
      }
      setStatus(parts.join(" · "), "success");
      const count = $("life-atlas-record-count"); if (count) count.textContent = String(await repository.count());
    } catch (error) { setStatus(`Import failed: ${error.message}`, "error"); if (button) button.disabled = false; }
  }

  async function exportBackup() {
    const button = $("life-atlas-export-backup");
    if (!root.CodexLifeAtlasExport || !root.CodexLifeAtlasRuntime) return setStatus("Export module unavailable.", "error");
    if (button) button.disabled = true;
    setStatus("Preparing your Life Atlas backup…", "working");
    try {
      const repository = await root.CodexLifeAtlasRuntime.ready;
      const records = await repository.exportRecords();
      if (!records.length) { setStatus("No Life Atlas records to back up yet. Import records first, then download a backup."); return; }
      const result = root.CodexLifeAtlasExport.downloadBackup(records);
      setStatus(`Downloaded ${result.filename} — ${records.length} records backed up. This file contains your private records; store it somewhere safe. Restore it any time by selecting it with the file picker above.`, "success");
    } catch (error) { setStatus(`Backup failed: ${error.message}`, "error"); }
    finally { if (button) button.disabled = false; }
  }

  async function refreshCount() { try { const count = $("life-atlas-record-count"); if (count) count.textContent = String(await root.CodexLifeAtlasRuntime.ready.then(r => r.count())); } catch (_) {} }
  function bindDropzone(zone, input) {
    if (!zone || !input) return;
    ["dragenter","dragover"].forEach(type => zone.addEventListener(type, e => { e.preventDefault(); zone.classList.add("is-dragging"); }));
    ["dragleave","drop"].forEach(type => zone.addEventListener(type, e => { e.preventDefault(); zone.classList.remove("is-dragging"); }));
    zone.addEventListener("drop", e => { const files = e.dataTransfer?.files; if (files?.length) analyze(files); });
  }
  function bind() {
    const input = $("life-atlas-import-files"); const commitBtn = $("life-atlas-import-commit"); const clearBtn = $("life-atlas-import-clear"); const exportBtn = $("life-atlas-export-backup");
    input?.addEventListener("change", () => analyze(input.files || []));
    commitBtn?.addEventListener("click", commit);
    exportBtn?.addEventListener("click", exportBackup);
    clearBtn?.addEventListener("click", () => { state.candidates=[]; state.backupRecords=[]; state.backupRejected=0; state.files=[]; state.diagnostics=null; if(input) input.value=""; if(commitBtn) commitBtn.disabled=true; renderPreview(); setStatus("Staging cleared. Saved Life Atlas records were not changed."); });
    bindDropzone($("life-atlas-file-dropzone"), input);
    renderPreview(); refreshCount();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true }); else bind();
})(typeof globalThis !== "undefined" ? globalThis : this);
