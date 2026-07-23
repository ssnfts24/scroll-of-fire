(() => {
  "use strict";

  const state = {
    currentRecord: null,
    currentDataset: [],
    currentShareState: null,
    currentDisplayMode: "standard",
    currentDatasetVersion: "equinox-passage/1.0.0",
    currentUrlIssues: []
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

  function setValue(id, value) {
    const node = byId(id);
    if (node && value != null) node.value = String(value);
  }

  function safeBoundaryMode(boundaryMode) {
    return ["midnight", "sunset", "manual"].includes(boundaryMode) ? boundaryMode : globalThis.AstronomyVersion.defaultBoundaryMode;
  }

  function safeDisplayMode(displayMode) {
    return ["standard", "signal", "full"].includes(displayMode) ? displayMode : "standard";
  }

  function supportedYears() {
    return globalThis.EquinoxPassageData.listYears();
  }

  function defaultYear() {
    const years = supportedYears();
    return Math.min(Math.max(new Date().getUTCFullYear(), years[0]), years[years.length - 1]);
  }

  function currentShareState() {
    return state.currentShareState;
  }

  function buildCanonicalUrl({
    selectedYear,
    timeZone,
    boundaryMode,
    manualSunset,
    displayMode,
    datasetVersion,
    compareYearA,
    compareYearB,
    baseUrl,
    source
  }) {
    return globalThis.RemnantShareUrl?.buildEquinoxShareLink
      ? globalThis.RemnantShareUrl.buildEquinoxShareLink({
        baseUrl: baseUrl || "./equinox-passage.html",
        selectedYear,
        timeZone,
        boundaryMode,
        manualSunset,
        displayMode,
        datasetVersion,
        compareYearA,
        compareYearB,
        source: source || "equinox-passage"
      })
      : `${location.origin}${location.pathname}`;
  }

  function selectedOptionsFromPage() {
    return {
      selectedYear: Number(inputValue("equinoxYear", defaultYear())),
      timeZone: inputValue("equinoxTimeZone", globalThis.AstronomyVersion.defaultStudyTimeZone),
      boundaryMode: inputValue("equinoxBoundaryMode", globalThis.AstronomyVersion.defaultBoundaryMode),
      manualSunset: inputValue("equinoxManualSunset", globalThis.AstronomyVersion.defaultSunset),
      compareYearA: Number(inputValue("equinoxCompareA", supportedYears()[0])),
      compareYearB: Number(inputValue("equinoxCompareB", supportedYears()[supportedYears().length - 1])),
      displayMode: state.currentDisplayMode,
      datasetVersion: state.currentDatasetVersion
    };
  }

  function parseUrlState(urlLike = location.href) {
    const issues = [];
    const parsed = globalThis.RemnantShareUrl?.parseEquinoxShareLink
      ? globalThis.RemnantShareUrl.parseEquinoxShareLink(urlLike)
      : {};
    const years = supportedYears();
    const minYear = years[0];
    const maxYear = years[years.length - 1];
    const supportedDatasetVersion = globalThis.EquinoxReferenceData?.metadata?.schemaVersion || "equinox-passage/1.0.0";
    const output = {
      selectedYear: defaultYear(),
      timeZone: globalThis.AstronomyVersion.defaultStudyTimeZone,
      boundaryMode: globalThis.AstronomyVersion.defaultBoundaryMode,
      manualSunset: globalThis.AstronomyVersion.defaultSunset,
      displayMode: "standard",
      datasetVersion: supportedDatasetVersion,
      compareYearA: minYear,
      compareYearB: maxYear,
      issues
    };

    if (parsed.selectedYear) {
      const numeric = Number(parsed.selectedYear);
      if (years.includes(numeric)) output.selectedYear = numeric;
      else issues.push(`Year ${parsed.selectedYear} is not available; using ${output.selectedYear}.`);
    }

    if (parsed.timeZone) {
      const safeZone = globalThis.TimeZoneTools.safeTimeZone(parsed.timeZone);
      if (safeZone === "UTC" && parsed.timeZone !== "UTC") issues.push(`Timezone ${parsed.timeZone} is unsupported; using UTC.`);
      output.timeZone = safeZone;
    }

    if (parsed.boundaryMode) {
      if (["midnight", "sunset", "manual"].includes(parsed.boundaryMode)) output.boundaryMode = parsed.boundaryMode;
      else issues.push(`Boundary ${parsed.boundaryMode} is invalid; using ${output.boundaryMode}.`);
    }

    if (parsed.manualSunset) {
      output.manualSunset = parsed.manualSunset;
    } else {
      let hasSunset = false;
      try {
        hasSunset = new URL(urlLike, location.href).searchParams.has("sunset");
      } catch {}
      if (hasSunset) issues.push(`Manual sunset must use HH:MM; using ${output.manualSunset}.`);
    }

    if (parsed.displayMode) output.displayMode = safeDisplayMode(parsed.displayMode);
    if (parsed.displayMode && output.displayMode !== parsed.displayMode) issues.push(`Display mode ${parsed.displayMode} is invalid; using ${output.displayMode}.`);

    if (parsed.datasetVersion) {
      if (parsed.datasetVersion === supportedDatasetVersion) output.datasetVersion = parsed.datasetVersion;
      else issues.push(`Dataset ${parsed.datasetVersion} is unknown; using ${supportedDatasetVersion}.`);
    }

    if (parsed.compareYearA) {
      const numeric = Number(parsed.compareYearA);
      if (years.includes(numeric)) output.compareYearA = numeric;
      else issues.push(`Compare year ${parsed.compareYearA} is invalid; using ${output.compareYearA}.`);
    }

    if (parsed.compareYearB) {
      const numeric = Number(parsed.compareYearB);
      if (years.includes(numeric)) output.compareYearB = numeric;
      else issues.push(`Compare year ${parsed.compareYearB} is invalid; using ${output.compareYearB}.`);
    }

    return output;
  }

  function applyInitialStateToControls(initialState) {
    setValue("equinoxYear", initialState.selectedYear);
    setValue("equinoxTimeZone", initialState.timeZone);
    setValue("equinoxBoundaryMode", initialState.boundaryMode);
    setValue("equinoxManualSunset", initialState.manualSunset);
    setValue("equinoxCompareA", initialState.compareYearA);
    setValue("equinoxCompareB", initialState.compareYearB);
    state.currentDisplayMode = initialState.displayMode;
    state.currentDatasetVersion = initialState.datasetVersion;
    state.currentUrlIssues = initialState.issues.slice();
    text("equinoxUrlStatus", initialState.issues.length ? initialState.issues.join(" ") : "Permanent link restored.");
  }

  function buildShareState(record) {
    const canonical = record.canonicalRecord;
    const liveState = record.liveState;
    const compareYearA = Number(inputValue("equinoxCompareA", supportedYears()[0]));
    const compareYearB = Number(inputValue("equinoxCompareB", supportedYears()[supportedYears().length - 1]));
    const link = buildCanonicalUrl({
      selectedYear: canonical.selectedYear,
      timeZone: canonical.timeZone,
      boundaryMode: canonical.boundaryMode,
      manualSunset: canonical.manualSunset || "",
      displayMode: state.currentDisplayMode,
      datasetVersion: state.currentDatasetVersion,
      compareYearA,
      compareYearB
    });
    return {
      source: "equinox-passage",
      isoDate: canonical.equinox.civilDate,
      effectiveISO: canonical.patternPosition.effectiveDate,
      isSelectedDate: true,
      shareButtonLabel: "Share Equinox Passage",
      readableDate: `${canonical.selectedYear} Equinox Passage`,
      moonNumber: canonical.patternPosition.moon || 13,
      moonName: canonical.patternPosition.moonName || "Outside Gate",
      moonDay: canonical.patternPosition.day,
      yearDay: canonical.patternPosition.dayOfPatternYear,
      weekGate: canonical.patternPosition.weekGate,
      phaseName: canonical.lunarLayer.phaseName,
      phaseIllumination: canonical.lunarLayer.illuminationPercent,
      shabbatState: liveState.status,
      shabbatCode: liveState.status,
      movement: `Passage progress ${globalThis.EquinoxPassageFormat.percent(liveState.progress)} with ${globalThis.EquinoxPassageFormat.durationText(liveState.remainingMilliseconds)} remaining.`,
      mirrorLine: canonical.annualSignature.symbolic,
      sunset: canonical.manualSunset || "",
      intention: "",
      link,
      equinoxRecord: record
    };
  }

  function renderBoundaryExplanation() {
    const explanation = "In sunset or manual-sunset mode, Moon 1 Day 1 begins at the selected sunset boundary on the preceding civil evening. The astronomical equinox instant itself never changes; only its effective Pattern-date mapping and Passage end boundary may change.";
    const example = "Example: in America/Los_Angeles for 2026, sunset/manual 18:00 ends at 2026-04-17T01:00:00Z, while midnight ends at 2026-04-17T07:00:00Z, because the civil-day boundary changed by six hours after daylight-saving adjustment; the equinox timestamp itself did not move.";
    text("equinoxBoundaryExplanation", `${explanation} ${example}`);
    text("equinoxPassageBoundaryNote", example);
    text("equinoxMethodsBoundaryNote", `${explanation} ${example}`);
  }

  function renderRecord(record) {
    const canonical = record.canonicalRecord;
    const liveState = record.liveState;
    state.currentRecord = record;
    state.currentShareState = buildShareState(record);
    text("equinoxHeroTitle", `Equinox Passage ${canonical.selectedYear}`);
    text("equinoxHeroSummary", `The sky moves; the Pattern remains stable. ${canonical.equinox.utcInstant} marks the Equinox Gate in UTC.`);
    text("equinoxGateUtc", canonical.equinox.utcInstant);
    text("equinoxGateLocal", `${canonical.equinox.localInstant} ${canonical.timeZone}`);
    text("equinoxGateCivil", canonical.equinox.civilDate);
    text("equinoxGatePrecision", `Timestamp resolution: ${globalThis.EquinoxPassageFormat.resolutionLabel(canonical.equinox.timestampResolutionSeconds)} · Validation tolerance: ${globalThis.EquinoxPassageFormat.resolutionLabel(canonical.equinox.validationToleranceSeconds)}`);
    text("equinoxPatternPosition", `${canonical.patternPosition.moonName || "Outside Gate"}${canonical.patternPosition.day ? ` · Day ${canonical.patternPosition.day}` : ""}`);
    text("equinoxPatternMeta", `Pattern Year ${canonical.patternPosition.patternYear} · Day ${canonical.patternPosition.dayOfPatternYear || "Outside"}/364 · ${canonical.patternPosition.weekGate} · ${canonical.patternPosition.archetype}`);
    text("equinoxPassageDuration", globalThis.EquinoxPassageFormat.durationText(canonical.passage.totalMilliseconds));
    text("equinoxPassageRemaining", globalThis.EquinoxPassageFormat.durationText(liveState.remainingMilliseconds));
    text("equinoxPassageElapsed", globalThis.EquinoxPassageFormat.durationText(liveState.elapsedMilliseconds));
    text("equinoxPassageProgress", globalThis.EquinoxPassageFormat.percent(liveState.progress));
    text("equinoxPassageWindow", `${canonical.equinox.utcInstant} → ${canonical.passage.endInstant}`);
    text("equinoxTimelineAccessible", `Equinox Gate at ${canonical.equinox.utcInstant}. Current progress ${globalThis.EquinoxPassageFormat.percent(liveState.progress)}. Moon 1 Day 1 begins at ${canonical.passage.endInstant}.`);
    text("equinoxLunar", `Approximate ${canonical.lunarLayer.phaseName} · approximately ${canonical.lunarLayer.illuminationPercent}% illuminated at the equinox instant`);
    text("equinoxMethods", `${canonical.equinox.source} copied into this repository with ${globalThis.EquinoxPassageFormat.resolutionLabel(canonical.equinox.timestampResolutionSeconds)} resolution, validated against an independent table with yearly deltas up to ${globalThis.EquinoxPassageFormat.fixedSeconds(canonical.equinox.maximumMeasuredDeviationSeconds)} seconds in ${canonical.equinox.maximumDeviationYear}. Source integrity is ${canonical.equinox.sourceIntegrityStatus}; exact Skyfield and JPL kernel details remain ${canonical.equinox.skyfieldVersion === "unknown" ? "unknown" : "verified"}.`);
    text("equinoxCalculated", canonical.annualSignature.calculated);
    text("equinoxAstronomical", canonical.annualSignature.astronomical);
    text("equinoxSymbolic", canonical.annualSignature.symbolic);
    text("equinoxObservational", canonical.annualSignature.observational);
    const fill = byId("equinoxTimelineFill");
    if (fill) fill.style.width = `${(liveState.progress * 100).toFixed(1)}%`;
    renderBoundaryExplanation();
    document.dispatchEvent(new CustomEvent("sof:equinox-render", { detail: { record } }));
  }

  function renderHistory(dataset) {
    state.currentDataset = dataset;
    const rows = dataset.map(entry => {
      const record = entry.canonicalRecord;
      return `
      <tr>
        <td>${record.selectedYear}</td>
        <td>${record.equinox.utcInstant}</td>
        <td>${record.patternPosition.moonName || "Outside Gate"}${record.patternPosition.day ? ` · Day ${record.patternPosition.day}` : ""}</td>
        <td>${globalThis.EquinoxPassageFormat.compactDuration(record.passage.totalMilliseconds)}</td>
        <td>${record.lunarLayer.phaseName}</td>
        <td>${record.boundaryMode}</td>
        <td>${record.equinox.source}</td>
        <td>${globalThis.EquinoxPassageFormat.resolutionLabel(record.equinox.timestampResolutionSeconds)}</td>
      </tr>`;
    }).join("");
    html("equinoxHistoryBody", rows);
  }

  function renderComparison(dataset) {
    const firstYear = Number(inputValue("equinoxCompareA", dataset[0]?.canonicalRecord?.selectedYear || supportedYears()[0]));
    const secondYear = Number(inputValue("equinoxCompareB", dataset[dataset.length - 1]?.canonicalRecord?.selectedYear || supportedYears()[supportedYears().length - 1]));
    const first = dataset.find(item => item.canonicalRecord.selectedYear === firstYear);
    const second = dataset.find(item => item.canonicalRecord.selectedYear === secondYear);
    if (!first || !second) return;
    const comparison = globalThis.EquinoxPassageEngine.compareYears(first, second);
    text("equinoxCompareSummary", `${firstYear} → ${secondYear}`);
    text("equinoxCompareDuration", globalThis.EquinoxPassageFormat.durationText(Math.abs(comparison.durationDifferenceMilliseconds)));
    text("equinoxComparePattern", comparison.patternPositionDifference);
    text("equinoxCompareLunar", comparison.lunarPhaseDifference);
    text("equinoxCompareShift", `${comparison.equinoxShiftSeconds} seconds`);
    text("equinoxCompareNotes", comparison.recurrenceNotes);
  }

  function renderCompactCard(record, options = {}) {
    if (!byId("equinoxCompactCard")) return;
    const canonical = record.canonicalRecord;
    const liveState = record.liveState;
    const link = buildCanonicalUrl({
      selectedYear: canonical.selectedYear,
      timeZone: canonical.timeZone,
      boundaryMode: canonical.boundaryMode,
      manualSunset: canonical.manualSunset || "",
      displayMode: options.displayMode || state.currentDisplayMode,
      datasetVersion: options.datasetVersion || state.currentDatasetVersion,
      compareYearA: options.compareYearA,
      compareYearB: options.compareYearB,
      source: "equinox-passage"
    });
    text("equinoxCompactGate", `${canonical.selectedYear} · ${canonical.equinox.localInstant} ${canonical.timeZone}`);
    text("equinoxCompactPattern", `${canonical.patternPosition.moonName || "Outside Gate"}${canonical.patternPosition.day ? ` · Day ${canonical.patternPosition.day}` : ""}`);
    text("equinoxCompactStatus", liveState.status === "active-passage"
      ? `Equinox Passage active · ${globalThis.EquinoxPassageFormat.durationText(liveState.remainingMilliseconds)} remaining`
      : liveState.status === "before-passage"
        ? `Next Equinox Gate · ${canonical.equinox.localInstant}`
        : `Most recent Passage · ${globalThis.EquinoxPassageFormat.durationText(canonical.passage.totalMilliseconds)}`);
    const linkNode = byId("equinoxCompactLinkText");
    if (linkNode) {
      linkNode.textContent = "Open Equinox Passage";
      linkNode.setAttribute("href", link);
    }
  }

  function pickCompactYear(timeZone, boundaryMode, manualSunset) {
    const now = new Date();
    const localYear = globalThis.TimeZoneTools.formatParts(now, timeZone).year;
    const supported = supportedYears();
    const current = supported.includes(localYear) ? localYear : supported[supported.length - 1];
    const record = globalThis.EquinoxPassageEngine.buildRecord({ selectedYear: current, timeZone, boundaryMode, manualSunset, asOf: now });
    if (record.liveState.status === "after-passage" && supported.includes(current + 1)) {
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
    renderCompactCard(pickCompactYear(options.timeZone, options.boundaryMode, options.manualSunset), {
      displayMode: options.displayMode,
      datasetVersion: options.datasetVersion,
      compareYearA: options.compareYearA,
      compareYearB: options.compareYearB
    });
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

    if (jsonBtn) jsonBtn.addEventListener("click", () => globalThis.EquinoxPassageExport.downloadText(`equinox-passage-${state.currentRecord.canonicalRecord.selectedYear}.json`, globalThis.EquinoxPassageExport.annualJson(state.currentRecord), "application/json"));
    if (csvBtn) csvBtn.addEventListener("click", () => globalThis.EquinoxPassageExport.downloadText("equinox-passage-2014-2026.csv", globalThis.EquinoxPassageExport.historicalCsv(state.currentDataset), "text/csv"));
    if (textBtn) textBtn.addEventListener("click", () => globalThis.EquinoxPassageExport.downloadText(`equinox-passage-${state.currentRecord.canonicalRecord.selectedYear}.txt`, globalThis.EquinoxPassageExport.readableText(state.currentRecord)));
    if (imageBtn) imageBtn.addEventListener("click", () => {
      const canvas = globalThis.EquinoxPassageExport.renderShareImageCanvas(state.currentRecord);
      if (!canvas) return;
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `equinox-passage-${state.currentRecord.canonicalRecord.selectedYear}.png`;
      link.click();
    });
    if (nativeBtn) nativeBtn.addEventListener("click", async () => {
      const payload = { title: `Equinox Passage ${state.currentRecord.canonicalRecord.selectedYear}`, text: globalThis.EquinoxPassageExport.readableText(state.currentRecord), url: state.currentShareState.link };
      try { await globalThis.RemnantShare.nativeShare(payload); } catch {}
    });
    if (signalBtn) signalBtn.addEventListener("click", () => globalThis.RemnantShare.copySignal(`Equinox Passage ${state.currentRecord.canonicalRecord.selectedYear}\n${state.currentRecord.canonicalRecord.equinox.utcInstant}\n${state.currentRecord.canonicalRecord.patternPosition.moonName || "Outside Gate"}`, state.currentShareState.link));
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
    const years = supportedYears();
    const yearSelect = byId("equinoxYear");
    const compareA = byId("equinoxCompareA");
    const compareB = byId("equinoxCompareB");
    [yearSelect, compareA, compareB].forEach(select => {
      if (!select) return;
      select.innerHTML = years.map(year => `<option value="${year}">${year}</option>`).join("");
    });
    if (yearSelect) yearSelect.value = String(defaultYear());
    if (compareA) compareA.value = String(years[0]);
    if (compareB) compareB.value = String(years[years.length - 1]);
    const tzSelect = byId("equinoxTimeZone");
    if (tzSelect) {
      const options = [Intl.DateTimeFormat().resolvedOptions().timeZone || globalThis.AstronomyVersion.defaultStudyTimeZone, "America/Los_Angeles", "America/New_York", "UTC"];
      const unique = options.filter((value, index) => value && options.indexOf(value) === index);
      tzSelect.innerHTML = unique.map(zone => `<option value="${zone}">${zone}</option>`).join("");
      if (!unique.includes(globalThis.AstronomyVersion.defaultStudyTimeZone)) {
        tzSelect.innerHTML += `<option value="${globalThis.AstronomyVersion.defaultStudyTimeZone}">${globalThis.AstronomyVersion.defaultStudyTimeZone}</option>`;
      }
      tzSelect.value = globalThis.AstronomyVersion.defaultStudyTimeZone;
    }
    const boundary = byId("equinoxBoundaryMode");
    if (boundary) boundary.value = globalThis.AstronomyVersion.defaultBoundaryMode;
    const sunset = byId("equinoxManualSunset");
    if (sunset) sunset.value = globalThis.AstronomyVersion.defaultSunset;
  }

  function renderCompactCardFromMoons() {
    if (!byId("equinoxCompactCard")) return;
    const timeZone = globalThis.ScrollOfFireMoons?.selectedTimezone?.() || globalThis.AstronomyVersion.defaultStudyTimeZone;
    const boundaryMode = safeBoundaryMode(byId("boundaryMode")?.value || globalThis.AstronomyVersion.defaultBoundaryMode);
    const manualSunset = byId("sunsetInput")?.value || globalThis.AstronomyVersion.defaultSunset;
    renderCompactCard(pickCompactYear(timeZone, boundaryMode, manualSunset), {
      displayMode: state.currentDisplayMode,
      datasetVersion: state.currentDatasetVersion
    });
  }

  function boot() {
    if (!document.body) return;
    if (!globalThis.EquinoxPassageEngine) return;
    const fullPage = Boolean(byId("equinoxYear"));
    if (fullPage) {
      populateSelectors();
      applyInitialStateToControls(parseUrlState(location.href));
      wireControls();
      wireExports();
      renderAll();
    }
    renderCompactCardFromMoons();
    document.addEventListener("sof:moon-render", renderCompactCardFromMoons);
    globalThis.ScrollOfFireEquinoxPassage = Object.freeze({
      render: renderAll,
      currentRecord: () => state.currentRecord,
      currentShareState,
      historicalDataset: () => state.currentDataset,
      parseUrlState,
      buildCanonicalUrl
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
