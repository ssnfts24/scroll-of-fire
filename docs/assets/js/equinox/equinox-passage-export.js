(() => {
  "use strict";

  function canonicalOf(record) {
    return record?.canonicalRecord || record;
  }

  function liveOf(record) {
    return record?.liveState || null;
  }

  function annualJson(record) {
    return `${JSON.stringify(canonicalOf(record), null, 2)}\n`;
  }

  function historicalCsv(records) {
    const header = [
      "year",
      "equinox_utc_instant",
      "time_zone",
      "local_instant",
      "local_civil_date",
      "boundary_mode",
      "manual_sunset",
      "pattern_year",
      "moon",
      "moon_name",
      "moon_day",
      "day_of_364",
      "week_gate",
      "archetype",
      "lunar_phase",
      "lunar_illumination_percent",
      "passage_end_utc_instant",
      "passage_total_milliseconds",
      "passage_total_days",
      "source",
      "timestamp_resolution_seconds",
      "validation_tolerance_seconds",
      "validation_delta_seconds",
      "maximum_measured_deviation_seconds",
      "maximum_deviation_year",
      "source_integrity_status"
    ];
    const lines = [header.join(",")];
    records.forEach(entry => {
      const record = canonicalOf(entry);
      lines.push([
        record.selectedYear,
        record.equinox.utcInstant,
        record.timeZone,
        record.equinox.localInstant,
        record.equinox.civilDate,
        record.boundaryMode,
        record.manualSunset || "",
        record.patternPosition.patternYear,
        record.patternPosition.moon || "",
        csvValue(record.patternPosition.moonName || ""),
        record.patternPosition.day || "",
        record.patternPosition.dayOfPatternYear || "",
        csvValue(record.patternPosition.weekGate),
        csvValue(record.patternPosition.archetype),
        csvValue(record.lunarLayer.phaseName),
        record.lunarLayer.illuminationPercent,
        record.passage.endInstant,
        record.passage.totalMilliseconds,
        record.passage.totalDays,
        csvValue(record.equinox.source),
        record.equinox.timestampResolutionSeconds,
        record.equinox.validationToleranceSeconds,
        globalThis.EquinoxPassageFormat.fixedSeconds(record.equinox.validationDeltaSeconds),
        globalThis.EquinoxPassageFormat.fixedSeconds(record.equinox.maximumMeasuredDeviationSeconds),
        record.equinox.maximumDeviationYear,
        csvValue(record.equinox.sourceIntegrityStatus)
      ].join(","));
    });
    return `${lines.join("\n")}\n`;
  }

  function readableText(record) {
    const canonical = canonicalOf(record);
    const liveState = liveOf(record);
    const lines = [
      `Equinox Passage — ${canonical.selectedYear}`,
      `Equinox Gate (UTC): ${canonical.equinox.utcInstant}`,
      `Selected local time (${canonical.timeZone}): ${canonical.equinox.localInstant}`,
      `Pattern position: ${canonical.patternPosition.moonName || "Outside Gate"}${canonical.patternPosition.day ? ` · Day ${canonical.patternPosition.day}` : ""}`,
      `Week Gate: ${canonical.patternPosition.weekGate}`,
      `Passage duration: ${globalThis.EquinoxPassageFormat.durationText(canonical.passage.totalMilliseconds)}`,
      `Lunar condition at the equinox instant: approximately ${canonical.lunarLayer.phaseName} · ${canonical.lunarLayer.illuminationPercent}% illuminated`,
      `Timestamp resolution: ${globalThis.EquinoxPassageFormat.resolutionLabel(canonical.equinox.timestampResolutionSeconds)}`,
      `Validation tolerance: ${globalThis.EquinoxPassageFormat.resolutionLabel(canonical.equinox.validationToleranceSeconds)}`,
      `Maximum measured deviation: ${globalThis.EquinoxPassageFormat.fixedSeconds(canonical.equinox.maximumMeasuredDeviationSeconds)} seconds (${canonical.equinox.maximumDeviationYear})`,
      `Source integrity: ${canonical.equinox.sourceIntegrityStatus}`,
      `Schema: ${canonical.schemaVersion}`
    ];
    if (liveState) {
      lines.push(`Current status: ${liveState.status}`);
      lines.push(`Elapsed: ${globalThis.EquinoxPassageFormat.durationText(liveState.elapsedMilliseconds)}`);
      lines.push(`Remaining: ${globalThis.EquinoxPassageFormat.durationText(liveState.remainingMilliseconds)}`);
      lines.push(`Progress: ${globalThis.EquinoxPassageFormat.percent(liveState.progress)}`);
    }
    return lines.join("\n");
  }

  function csvValue(value) {
    const text = String(value || "");
    return `"${text.replace(/"/g, '""')}"`;
  }

  function downloadText(filename, content, type = "text/plain") {
    if (!globalThis.document) return false;
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  }

  function renderShareImageCanvas(record, options = {}) {
    if (!globalThis.document) return null;
    const canonical = canonicalOf(record);
    const liveState = liveOf(record);
    const width = options.width || 1080;
    const height = options.height || 1080;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#05070d";
    ctx.fillRect(0, 0, width, height);
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#13243d");
    gradient.addColorStop(1, "#05070d");
    ctx.fillStyle = gradient;
    ctx.fillRect(40, 40, width - 80, height - 80);
    ctx.strokeStyle = "#d7b768";
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 40, width - 80, height - 80);
    ctx.fillStyle = "#f6f1dc";
    ctx.font = "600 34px sans-serif";
    ctx.fillText(`Equinox Passage ${canonical.selectedYear}`, 90, 130);
    ctx.font = "24px sans-serif";
    const lines = [
      `Equinox Gate UTC: ${canonical.equinox.utcInstant}`,
      `Local: ${canonical.equinox.localInstant} ${canonical.timeZone}`,
      `Pattern: ${canonical.patternPosition.moonName || "Outside Gate"}${canonical.patternPosition.day ? ` · Day ${canonical.patternPosition.day}` : ""}`,
      `Passage: ${globalThis.EquinoxPassageFormat.durationText(canonical.passage.totalMilliseconds)}`,
      `Timestamp resolution: ${globalThis.EquinoxPassageFormat.resolutionLabel(canonical.equinox.timestampResolutionSeconds)}`,
      `Validation tolerance: ${globalThis.EquinoxPassageFormat.resolutionLabel(canonical.equinox.validationToleranceSeconds)}`,
      `Max deviation: ${globalThis.EquinoxPassageFormat.fixedSeconds(canonical.equinox.maximumMeasuredDeviationSeconds)}s (${canonical.equinox.maximumDeviationYear})`,
      liveState ? `Status: ${liveState.status} · ${globalThis.EquinoxPassageFormat.percent(liveState.progress)}` : "CodexOfReality.org"
    ];
    lines.forEach((line, index) => ctx.fillText(line, 90, 220 + index * 72));
    return canvas;
  }

  globalThis.EquinoxPassageExport = Object.freeze({
    annualJson,
    historicalCsv,
    readableText,
    downloadText,
    renderShareImageCanvas
  });
})();
