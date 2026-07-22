(() => {
  "use strict";

  function annualJson(record) {
    return JSON.stringify(record, null, 2);
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
      "precision_seconds",
      "validation_delta_seconds"
    ];
    const lines = [header.join(",")];
    records.forEach(record => {
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
        record.equinox.precisionSeconds,
        record.equinox.validationDeltaSeconds
      ].join(","));
    });
    return lines.join("\n");
  }

  function readableText(record) {
    return [
      `Equinox Passage — ${record.selectedYear}`,
      `Equinox Gate (UTC): ${record.equinox.utcInstant}`,
      `Selected local time (${record.timeZone}): ${record.equinox.localInstant}`,
      `Pattern position: ${record.patternPosition.moonName || "Outside Gate"}${record.patternPosition.day ? ` · Day ${record.patternPosition.day}` : ""}`,
      `Week Gate: ${record.patternPosition.weekGate}`,
      `Passage duration: ${globalThis.EquinoxPassageFormat.durationText(record.passage.totalMilliseconds)}`,
      `Lunar condition: ${record.lunarLayer.phaseName} · ${record.lunarLayer.illuminationPercent}% illuminated`,
      `Source: ${record.equinox.source} (${globalThis.EquinoxPassageFormat.precisionLabel(record.equinox.precisionSeconds)})`,
      `Schema: ${record.schemaVersion}`
    ].join("\n");
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
    ctx.fillText(`Equinox Passage ${record.selectedYear}`, 90, 130);
    ctx.font = "24px sans-serif";
    const lines = [
      `Equinox Gate UTC: ${record.equinox.utcInstant}`,
      `Local: ${record.equinox.localInstant} ${record.timeZone}`,
      `Pattern: ${record.patternPosition.moonName || "Outside Gate"}${record.patternPosition.day ? ` · Day ${record.patternPosition.day}` : ""}`,
      `Passage: ${globalThis.EquinoxPassageFormat.durationText(record.passage.totalMilliseconds)}`,
      `Source: ${record.equinox.source}`,
      `Precision: ${globalThis.EquinoxPassageFormat.precisionLabel(record.equinox.precisionSeconds)}`,
      `CodexOfReality.org`,
      `${record.schemaVersion}`
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
