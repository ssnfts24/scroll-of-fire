(() => {
  "use strict";

  // AlignmentUI — DOM-dependent orchestration for the Alignment Ledger page.
  // Depends on: AlignmentLedgerData, AlignmentComparison, AlignmentRecurrence,
  //             AlignmentOffsets, AlignmentSignature, AlignmentExport, AlignmentUrlState,
  //             LivingTimeSphereUi (optional).

  let _state = {
    year:         2026,
    compareYear:  2025,
    timeZone:     "America/Los_Angeles",
    boundaryMode: "sunset",
    manualSunset: "18:00",
    mode:         "ledger"
  };

  function safeInit() {
    const deps = ["AlignmentLedgerData", "AlignmentComparison", "AlignmentRecurrence",
                  "AlignmentOffsets", "AlignmentSignature", "AlignmentExport", "AlignmentUrlState"];
    return deps.every(d => !!globalThis[d]);
  }

  function applyUrlState() {
    if (typeof location === "undefined") return;
    const parsed = globalThis.AlignmentUrlState.parseAlignmentShareLink(location.href);
    if (parsed.year        != null) _state.year        = parsed.year;
    if (parsed.compareYear != null) _state.compareYear = parsed.compareYear;
    if (parsed.timeZone)            _state.timeZone    = parsed.timeZone;
    if (parsed.boundaryMode)        _state.boundaryMode = parsed.boundaryMode;
    if (parsed.manualSunset)        _state.manualSunset = parsed.manualSunset;
    if (parsed.mode)                _state.mode        = parsed.mode;
  }

  function currentRecord() {
    return globalThis.AlignmentLedgerData.getRecord({
      year:         _state.year,
      timeZone:     _state.timeZone,
      boundaryMode: _state.boundaryMode,
      manualSunset: _state.manualSunset
    });
  }

  function renderRecord(record) {
    const el = document.getElementById("al-record");
    if (!el) return;
    const pos   = record.equinox?.patternPosition || {};
    const lunar = record.equinox?.lunarLayer       || {};
    const offs  = record.offsets || {};
    el.innerHTML = `
      <h2 class="al-year-heading">${record.year} Alignment Record</h2>
      <dl class="al-record-grid">
        <dt>Equinox (UTC)</dt><dd>${record.equinox?.utcInstant || "—"}</dd>
        <dt>Year Gate</dt><dd>${record.yearGate?.instant || "—"}</dd>
        <dt>Passage length</dt><dd>${Number(((offs.equinoxToYearGateDays || 0) * 24).toFixed(2))} hours (${Number((offs.equinoxToYearGateDays || 0).toFixed(4))} days)</dd>
        <dt>Pattern Moon</dt><dd>${pos.moon != null ? `Moon ${pos.moon} — ${pos.moonName}` : "Outside 364-day count"}</dd>
        <dt>Pattern Day</dt><dd>${pos.day || "—"}</dd>
        <dt>Week Gate</dt><dd>${pos.weekGate || "—"}</dd>
        <dt>Archetype</dt><dd>${pos.archetype || "—"}</dd>
        <dt>Lunar phase</dt><dd>${lunar.phaseName || "—"}${lunar.illuminationPercent != null ? ` · ~${lunar.illuminationPercent}%` : ""}</dd>
      </dl>`;
  }

  function renderComparison(yearA, yearB) {
    const el = document.getElementById("al-comparison");
    if (!el) return;
    try {
      const cmp = globalThis.AlignmentComparison.compareTwo(yearA, yearB, {
        timeZone:     _state.timeZone,
        boundaryMode: _state.boundaryMode,
        manualSunset: _state.manualSunset
      });
      const direction = cmp.movementDirection === "longer" ? "↑ longer" : cmp.movementDirection === "shorter" ? "↓ shorter" : "= same";
      el.innerHTML = `
        <h3 class="al-cmp-heading">${yearA} vs ${yearB}</h3>
        <dl class="al-cmp-grid">
          <dt>Passage duration change</dt><dd>${cmp.passageDurationDiff.hours != null ? `${Number(cmp.passageDurationDiff.hours).toFixed(2)} hours ${direction}` : "—"}</dd>
          <dt>Equinox UTC shift</dt><dd>${cmp.equinoxUtcShiftHours.toFixed(2)} hours</dd>
        </dl>
        <p class="al-cmp-similarities"><strong>Similarities:</strong> ${cmp.similarities.join("; ") || "None identified"}</p>
        <p class="al-cmp-differences"><strong>Differences:</strong> ${cmp.differences.join("; ") || "None identified"}</p>
        <p class="al-precision-note">${cmp.sourcePrecisionNote}</p>`;
    } catch (e) {
      el.innerHTML = `<p class="al-error">Comparison unavailable: ${e.message}</p>`;
    }
  }

  function renderRecurrence(year) {
    const el = document.getElementById("al-recurrence");
    if (!el) return;
    try {
      const results = globalThis.AlignmentRecurrence.findRecurrences(year, {
        timeZone:     _state.timeZone,
        boundaryMode: _state.boundaryMode,
        manualSunset: _state.manualSunset,
        minimumScore: 0.2
      });
      if (!results.length) {
        el.innerHTML = `<p>No years exceed the minimum recurrence threshold (score ≥ 0.20).</p>`;
        return;
      }
      const rows = results.map(r => `<tr>
        <td>${r.year}</td>
        <td>${r.overallSimilarityScore.toFixed(2)}</td>
        <td>${r.sameMoon ? "✓" : "—"}</td>
        <td>${r.sameMoonDay ? "✓" : "—"}</td>
        <td>${r.sameWeekGate ? "✓" : "—"}</td>
        <td>${r.passageDifferenceHours.toFixed(1)} h</td>
        <td>${r.lunarCycleDistance.toFixed(3)}</td>
      </tr>`).join("");
      el.innerHTML = `
        <table class="al-recurrence-table" role="table" aria-label="Recurrence scores for ${year}">
          <caption>Recurrence dimensions compared to ${year}. Score is unweighted average of 9 dimensions (0–1).</caption>
          <thead><tr><th>Year</th><th>Score</th><th>Same Moon</th><th>Same Day</th><th>Same Gate</th><th>Passage Δ</th><th>Lunar Δ</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="al-recurrence-note">${results[0]?.scoreExplanation || ""}</p>`;
    } catch (e) {
      el.innerHTML = `<p class="al-error">Recurrence unavailable: ${e.message}</p>`;
    }
  }

  function renderHistoricalTable() {
    const el = document.getElementById("al-historical-table");
    if (!el) return;
    try {
      const records = globalThis.AlignmentLedgerData.getAllRecords({
        timeZone:     _state.timeZone,
        boundaryMode: _state.boundaryMode,
        manualSunset: _state.manualSunset
      });
      const rows = records.map(rec => {
        const pos  = rec.equinox?.patternPosition || {};
        const offs = rec.offsets || {};
        return `<tr>
          <td><button class="al-year-btn" data-year="${rec.year}">${rec.year}</button></td>
          <td>${pos.moon != null ? `Moon ${pos.moon}` : "—"}</td>
          <td>${pos.day || "—"}</td>
          <td>${Number(((offs.equinoxToYearGateDays || 0) * 24).toFixed(1))} h</td>
          <td>${rec.equinox?.lunarLayer?.phaseName || "—"}</td>
        </tr>`;
      }).join("");
      el.innerHTML = `
        <table class="al-historical-table" role="table" aria-label="Historical alignment records 2014–2026">
          <caption>Alignment measurements 2014–2026. Select a year to load its full record.</caption>
          <thead><tr><th>Year</th><th>Moon</th><th>Day</th><th>Passage (h)</th><th>Lunar phase</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
      el.querySelectorAll(".al-year-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const y = Number(btn.dataset.year);
          if (y) { _state.year = y; refresh(); }
        });
      });
    } catch (e) {
      el.innerHTML = `<p class="al-error">Historical table unavailable: ${e.message}</p>`;
    }
  }

  function renderSpiralSummary() {
    const el = document.getElementById("al-spiral");
    if (!el || !globalThis.LivingTimeSphereModel) return;
    try {
      const spiral = globalThis.LivingTimeSphereModel.buildSpiral({
        timeZone:     _state.timeZone,
        boundaryMode: _state.boundaryMode,
        manualSunset: _state.manualSunset
      });
      const items = spiral.years.map(y => {
        const label = y.year === _state.year ? `<strong>${y.year}</strong>` : String(y.year);
        return `<li>${label} — angle ${y.yearSpiralAngle.toFixed(1)}°, depth ${y.yearSpiralRadius.toFixed(3)}</li>`;
      }).join("");
      el.innerHTML = `<ol class="al-spiral-list" aria-label="13-year spiral">${items}</ol>`;
    } catch (e) {
      el.innerHTML = `<p class="al-error">Spiral unavailable: ${e.message}</p>`;
    }
  }

  function wireExportButtons(record) {
    const jsonBtn = document.getElementById("al-export-json");
    const csvBtn  = document.getElementById("al-export-csv");
    const txtBtn  = document.getElementById("al-export-txt");
    if (jsonBtn) jsonBtn.onclick = () => globalThis.AlignmentExport.exportRecordJSON(record);
    if (csvBtn)  csvBtn.onclick  = () => {
      const recs = globalThis.AlignmentLedgerData.getAllRecords({
        timeZone: _state.timeZone, boundaryMode: _state.boundaryMode, manualSunset: _state.manualSunset
      });
      globalThis.AlignmentExport.exportHistoricalCSV(recs);
    };
    if (txtBtn)  txtBtn.onclick  = () => globalThis.AlignmentExport.exportReadableText(record);
  }

  function wireCopyLink() {
    const btn = document.getElementById("al-copy-link");
    if (!btn) return;
    btn.onclick = () => {
      const link = globalThis.AlignmentUrlState.buildAlignmentShareLink({
        baseUrl:      typeof location !== "undefined" ? location.href.split("?")[0] : "",
        year:         _state.year,
        compareYear:  _state.compareYear,
        timeZone:     _state.timeZone,
        boundaryMode: _state.boundaryMode,
        manualSunset: _state.manualSunset,
        mode:         _state.mode,
        datasetVersion: globalThis.AlignmentVersion?.alignmentLedgerVersion
      });
      navigator.clipboard?.writeText(link).catch(() => {});
      btn.textContent = "Link copied";
      setTimeout(() => { btn.textContent = "Copy Link"; }, 2000);
    };
  }

  function refresh() {
    if (!safeInit()) return;
    try {
      const record = currentRecord();
      renderRecord(record);
      renderComparison(_state.compareYear, _state.year);
      renderRecurrence(_state.year);
      renderHistoricalTable();
      renderSpiralSummary();
      wireExportButtons(record);
      wireCopyLink();
      const yearSelect = document.getElementById("al-year-select");
      if (yearSelect) yearSelect.value = String(_state.year);
    } catch (e) {
      const err = document.getElementById("al-record");
      if (err) err.innerHTML = `<p class="al-error">Error: ${e.message}</p>`;
    }
  }

  function init() {
    if (!safeInit()) {
      console.warn("AlignmentUI: not all dependencies available");
      return;
    }
    applyUrlState();

    const yearSelect = document.getElementById("al-year-select");
    if (yearSelect) {
      const years = globalThis.AlignmentLedgerData.listSupportedYears();
      yearSelect.innerHTML = years.map(y => `<option value="${y}"${y === _state.year ? " selected" : ""}>${y}</option>`).join("");
      yearSelect.addEventListener("change", () => {
        const y = Number(yearSelect.value);
        if (y) { _state.year = y; refresh(); }
      });
    }

    const cmpSelect = document.getElementById("al-compare-select");
    if (cmpSelect) {
      const years = globalThis.AlignmentLedgerData.listSupportedYears();
      cmpSelect.innerHTML = years.map(y => `<option value="${y}"${y === _state.compareYear ? " selected" : ""}>${y}</option>`).join("");
      cmpSelect.addEventListener("change", () => {
        const y = Number(cmpSelect.value);
        if (y) { _state.compareYear = y; refresh(); }
      });
    }

    refresh();
  }

  globalThis.AlignmentUI = Object.freeze({ init, refresh, getState: () => Object.assign({}, _state) });
})();
