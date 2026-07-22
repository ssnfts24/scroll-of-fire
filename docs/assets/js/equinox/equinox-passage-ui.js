(() => {
  "use strict";

  const state = {
    currentRecord: null,
    currentDataset: [],
    currentShareState: null
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function text(id, value) {
    const node = byId(id);
    if (node) node.textContent = value;
  }

  function html(id, value) {
    const node = byId(id);
    if (node) node.innerHTML = value;
  }

  function inputValue(id, fallback = "") {
    return byId(id)?.value || fallback;
  }

  function selectedOptionsFromPage() {
    return {
      selectedYear: Number(inputValue("equinoxYear", new Date().getUTCFullYear())),
      timeZone: inputValue("equinoxTimeZone", globalThis.AstronomyVersion.defaultStudyTimeZone),
      boundaryMode: inputValue("equinoxBoundaryMode", globalThis.AstronomyVersion.defaultBoundaryMode),
      manualSunset: inputValue("equinoxManualSunset", globalThis.AstronomyVersion.defaultSunset)
    };
  }

  function currentShareState() {
    return state.currentShareState;
  }

  function buildShareState(record) {
    const link = globalThis.RemnantShareUrl?.buildEquinoxShareLink
      ? globalThis.RemnantShareUrl.buildEquinoxShareLink({
        baseUrl: "./equinox-passage.html",
        selectedYear: record.selectedYear,
        timeZone: record.timeZone,
        boundaryMode: record.boundaryMode,
        manualSunset: record.manualSunset || "",
        displayMode: "standard",
        datasetVersion: record.schemaVersion,
        source: "equinox-passage"
      })
      : `${location.origin}${location.pathname}`;
    return {
      source: "equinox-passage",
      isoDate: record.equinox.civilDate,
      effectiveISO: record.patternPosition.effectiveDate,
      isSelectedDate: true,
      shareButtonLabel: "Share Equinox Passage",
      readableDate: `${record.selectedYear} Equinox Passage`,
      moonNumber: record.patternPosition.moon || 13,
      moonName: record.patternPosition.moonName || "Outside Gate",
      moonDay: record.patternPosition.day,
      yearDay: record.patternPosition.dayOfPatternYear,
      weekGate: record.patternPosition.weekGate,
      phaseName: record.lunarLayer.phaseName,
      phaseIllumination: record.lunarLayer.illuminationPercent,
      shabbatState: record.passage.state,
      shabbatCode: record.passage.state,
      movement: `Passage progress ${globalThis.EquinoxPassageFormat.percent(record.passage.progress)} with ${globalThis.EquinoxPassageFormat.durationText(record.passage.remainingMilliseconds)} remaining.`,
      mirrorLine: record.annualSignature.symbolic,
      sunset: record.manualSunset || "",
      intention: "",
      link,
      equinoxRecord: record
    };
  }

  function renderRecord(record) {
    state.currentRecord = record;
    state.currentShareState = buildShareState(record);
    text("equinoxHeroTitle", `Equinox Passage ${record.selectedYear}`);
    text("equinoxHeroSummary", `The sky moves; the Pattern remains stable. ${record.equinox.utcInstant} marks the Equinox Gate in UTC.`);
    text("equinoxGateUtc", record.equinox.utcInstant);
    text("equinoxGateLocal", `${record.equinox.localInstant} ${record.timeZone}`);
    text("equinoxGateCivil", record.equinox.civilDate);
    text("equinoxGatePrecision", `${globalThis.EquinoxPassageFormat.precisionLabel(record.equinox.precisionSeconds)} · ${record.equinox.status}`);
    text("equinoxPatternPosition", `${record.patternPosition.moonName || "Outside Gate"}${record.patternPosition.day ? ` · Day ${record.patternPosition.day}` : ""}`);
    text("equinoxPatternMeta", `Pattern Year ${record.patternPosition.patternYear} · Day ${record.patternPosition.dayOfPatternYear || "Outside"}/364 · ${record.patternPosition.weekGate} · ${record.patternPosition.archetype}`);
    text("equinoxPassageDuration", globalThis.EquinoxPassageFormat.durationText(record.passage.totalMilliseconds));
    text("equinoxPassageRemaining", globalThis.EquinoxPassageFormat.durationText(record.passage.remainingMilliseconds));
    text("equinoxPassageElapsed", globalThis.EquinoxPassageFormat.durationText(record.passage.elapsedMilliseconds));
    text("equinoxPassageProgress", globalThis.EquinoxPassageFormat.percent(record.passage.progress));
    text("equinoxPassageWindow", `${record.equinox.utcInstant} → ${record.passage.endInstant}`);
    text("equinoxTimelineAccessible", `Equinox Gate at ${record.equinox.utcInstant}. Current progress ${globalThis.EquinoxPassageFormat.percent(record.passage.progress)}. Moon 1 Day 1 begins at ${record.passage.endInstant}.`);
    text("equinoxLunar", `${record.lunarLayer.phaseName} · ${record.lunarLayer.illuminationPercent}% illuminated`);
    text("equinoxMethods", `${record.equinox.source} validated with ${record.equinox.validationDeltaSeconds}s difference against the bundled cross-check. Lunar values are approximate and clearly labeled.`);
    text("equinoxCalculated", record.annualSignature.calculated);
    text("equinoxAstronomical", record.annualSignature.astronomical);
    text("equinoxSymbolic", record.annualSignature.symbolic);
    text("equinoxObservational", record.annualSignature.observational);
    const fill = byId("equinoxTimelineFill");
    if (fill) fill.style.width = `${(record.passage.progress * 100).toFixed(1)}%`;
    document.dispatchEvent(new CustomEvent("sof:equinox-render", { detail: { record } }));
  }

  function renderHistory(dataset) {
    state.currentDataset = dataset;
    const rows = dataset.map(record => `
      <tr>
        <td>${record.selectedYear}</td>
        <td>${record.equinox.utcInstant}</td>
        <td>${record.patternPosition.moonName || "Outside Gate"}${record.patternPosition.day ? ` · Day ${record.patternPosition.day}` : ""}</td>
        <td>${globalThis.EquinoxPassageFormat.compactDuration(record.passage.totalMilliseconds)}</td>
        <td>${record.lunarLayer.phaseName}</td>
        <td>${record.boundaryMode}</td>
        <td>${record.equinox.source}</td>
        <td>${record.equinox.precisionSeconds}s</td>
      </tr>`).join("");
    html("equinoxHistoryBody", rows);
  }

  function renderComparison(dataset) {
    const firstYear = Number(inputValue("equinoxCompareA", dataset[0]?.selectedYear || 2014));
    const secondYear = Number(inputValue("equinoxCompareB", dataset[dataset.length - 1]?.selectedYear || 2026));
    const first = dataset.find(item => item.selectedYear === firstYear);
    const second = dataset.find(item => item.selectedYear === secondYear);
    if (!first || !second) return;
    const comparison = globalThis.EquinoxPassageEngine.compareYears(first, second);
    text("equinoxCompareSummary", `${firstYear} → ${secondYear}`);
    text("equinoxCompareDuration", globalThis.EquinoxPassageFormat.durationText(Math.abs(comparison.durationDifferenceMilliseconds)));
    text("equinoxComparePattern", comparison.patternPositionDifference);
    text("equinoxCompareLunar", comparison.lunarPhaseDifference);
    text("equinoxCompareShift", `${comparison.equinoxShiftSeconds} seconds`);
    text("equinoxCompareNotes", comparison.recurrenceNotes);
  }

  function renderCompactCard(record) {
    if (!byId("equinoxCompactCard")) return;
    text("equinoxCompactGate", `${record.selectedYear} · ${record.equinox.localInstant} ${record.timeZone}`);
    text("equinoxCompactPattern", `${record.patternPosition.moonName || "Outside Gate"}${record.patternPosition.day ? ` · Day ${record.patternPosition.day}` : ""}`);
    text("equinoxCompactStatus", record.passage.state === "active-passage"
      ? `Equinox Passage active · ${globalThis.EquinoxPassageFormat.durationText(record.passage.remainingMilliseconds)} remaining`
      : record.passage.state === "before-passage"
        ? `Next Equinox Gate · ${record.equinox.localInstant}`
        : `Most recent Passage · ${globalThis.EquinoxPassageFormat.durationText(record.passage.totalMilliseconds)}`);
    text("equinoxCompactLinkText", "Open Equinox Passage");
  }

  function pickCompactYear(timeZone, boundaryMode, manualSunset) {
    const now = new Date();
    const localYear = globalThis.TimeZoneTools.formatParts(now, timeZone).year;
    const supported = globalThis.EquinoxPassageData.listYears();
    const current = supported.includes(localYear) ? localYear : supported[supported.length - 1];
    const record = globalThis.EquinoxPassageEngine.buildRecord({ selectedYear: current, timeZone, boundaryMode, manualSunset, asOf: now });
    if (record.passage.state === "after-passage" && supported.includes(current + 1)) {
      return globalThis.EquinoxPassageEngine.buildRecord({ selectedYear: current + 1, timeZone, boundaryMode, manualSunset, asOf: now });
    }
    return record;
  }

  function renderAll() {
    const options = selectedOptionsFromPage();
    const record = globalThis.EquinoxPassageEngine.buildRecord(options);
    const dataset = globalThis.EquinoxPassageData.buildHistoricalDataset(options);
    renderRecord(record);
    renderHistory(dataset);
    renderComparison(dataset);
    renderCompactCard(pickCompactYear(options.timeZone, options.boundaryMode, options.manualSunset));
  }

  function wireExports() {
    const jsonBtn = byId("equinoxExportJson");
    const csvBtn = byId("equinoxExportCsv");
    const textBtn = byId("equinoxExportText");
    const imageBtn = byId("equinoxExportImage");
    const nativeBtn = byId("equinoxNativeShare");
    const signalBtn = byId("equinoxCopySignal");
    const standardBtn = byId("equinoxCopyStandard");
    const fullBtn = byId("equinoxCopyFull");
    const linkBtn = byId("equinoxCopyLink");
    const saveBtn = byId("equinoxSaveLocal");

    if (jsonBtn) jsonBtn.addEventListener("click", () => globalThis.EquinoxPassageExport.downloadText(`equinox-passage-${state.currentRecord.selectedYear}.json`, globalThis.EquinoxPassageExport.annualJson(state.currentRecord), "application/json"));
    if (csvBtn) csvBtn.addEventListener("click", () => globalThis.EquinoxPassageExport.downloadText("equinox-passage-2014-2026.csv", globalThis.EquinoxPassageExport.historicalCsv(state.currentDataset), "text/csv"));
    if (textBtn) textBtn.addEventListener("click", () => globalThis.EquinoxPassageExport.downloadText(`equinox-passage-${state.currentRecord.selectedYear}.txt`, globalThis.EquinoxPassageExport.readableText(state.currentRecord)));
    if (imageBtn) imageBtn.addEventListener("click", () => {
      const canvas = globalThis.EquinoxPassageExport.renderShareImageCanvas(state.currentRecord);
      if (!canvas) return;
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `equinox-passage-${state.currentRecord.selectedYear}.png`;
      link.click();
    });
    if (nativeBtn) nativeBtn.addEventListener("click", async () => {
      const payload = { title: `Equinox Passage ${state.currentRecord.selectedYear}`, text: globalThis.EquinoxPassageExport.readableText(state.currentRecord), url: state.currentShareState.link };
      try { await globalThis.RemnantShare.nativeShare(payload); } catch {}
    });
    if (signalBtn) signalBtn.addEventListener("click", () => globalThis.RemnantShare.copySignal(`Equinox Passage ${state.currentRecord.selectedYear}\n${state.currentRecord.equinox.utcInstant}\n${state.currentRecord.patternPosition.moonName || "Outside Gate"}`, state.currentShareState.link));
    if (standardBtn) standardBtn.addEventListener("click", () => globalThis.RemnantShare.copyStandard(globalThis.EquinoxPassageExport.readableText(state.currentRecord), state.currentShareState.link, ["#EquinoxPassage", "#CodexOfReality"]));
    if (fullBtn) fullBtn.addEventListener("click", () => globalThis.RemnantShare.copyFullScroll(globalThis.EquinoxPassageExport.annualJson(state.currentRecord), state.currentShareState.link, ["#EquinoxPassage", "#CodexOfReality"]));
    if (linkBtn) linkBtn.addEventListener("click", () => globalThis.RemnantShare.copyPermanentLink(state.currentShareState.link));
    if (saveBtn) saveBtn.addEventListener("click", () => {
      const note = inputValue("equinoxObservationNote", "");
      globalThis.EquinoxPassageStorage.save(state.currentRecord, note);
      text("equinoxLocalSaveStatus", "Saved locally on this device.");
    });
  }

  function wireControls() {
    ["equinoxYear", "equinoxTimeZone", "equinoxBoundaryMode", "equinoxManualSunset", "equinoxCompareA", "equinoxCompareB"].forEach(id => {
      const node = byId(id);
      if (!node) return;
      node.addEventListener("change", renderAll);
    });
  }

  function populateSelectors() {
    const years = globalThis.EquinoxPassageData.listYears();
    const yearSelect = byId("equinoxYear");
    const compareA = byId("equinoxCompareA");
    const compareB = byId("equinoxCompareB");
    [yearSelect, compareA, compareB].forEach(select => {
      if (!select) return;
      select.innerHTML = years.map(year => `<option value="${year}">${year}</option>`).join("");
    });
    if (yearSelect) yearSelect.value = String(Math.min(Math.max(new Date().getUTCFullYear(), years[0]), years[years.length - 1]));
    if (compareA) compareA.value = String(years[0]);
    if (compareB) compareB.value = String(years[years.length - 1]);
    const tzSelect = byId("equinoxTimeZone");
    if (tzSelect) {
      const options = [Intl.DateTimeFormat().resolvedOptions().timeZone || globalThis.AstronomyVersion.defaultStudyTimeZone, "America/Los_Angeles", "America/New_York", "UTC"];
      const unique = options.filter((value, index) => value && options.indexOf(value) === index);
      tzSelect.innerHTML = unique.map(zone => `<option value="${zone}">${zone}</option>`).join("");
      tzSelect.value = globalThis.AstronomyVersion.defaultStudyTimeZone;
    }
    const boundary = byId("equinoxBoundaryMode");
    if (boundary) boundary.value = globalThis.AstronomyVersion.defaultBoundaryMode;
    const sunset = byId("equinoxManualSunset");
    if (sunset) sunset.value = globalThis.AstronomyVersion.defaultSunset;
  }

  function boot() {
    if (!document.body) return;
    if (!globalThis.EquinoxPassageEngine) return;
    populateSelectors();
    wireControls();
    wireExports();
    renderAll();
    document.addEventListener("sof:moon-render", () => {
      if (byId("equinoxCompactCard")) renderCompactCard(pickCompactYear(
        globalThis.ScrollOfFireMoons?.selectedTimezone?.() || globalThis.AstronomyVersion.defaultStudyTimeZone,
        byId("boundaryMode")?.value || globalThis.AstronomyVersion.defaultBoundaryMode,
        byId("sunsetInput")?.value || globalThis.AstronomyVersion.defaultSunset
      ));
    });
    globalThis.ScrollOfFireEquinoxPassage = Object.freeze({
      render: renderAll,
      currentRecord: () => state.currentRecord,
      currentShareState,
      historicalDataset: () => state.currentDataset
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
