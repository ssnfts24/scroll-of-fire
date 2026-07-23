(() => {
  "use strict";

  function assertDependencies() {
    const required = ["AlignmentLedgerData", "AlignmentVersion"];
    for (const name of required) {
      if (!globalThis[name]) throw new Error(`AlignmentExport: ${name} is unavailable`);
    }
  }

  // --- JSON exports ---

  function toRecordJSON(record) {
    return JSON.stringify(record, null, 2);
  }

  function toComparisonJSON(comparison) {
    return JSON.stringify(comparison, null, 2);
  }

  function toSphereModelJSON(sphereModel) {
    return JSON.stringify(sphereModel, null, 2);
  }

  // --- CSV helpers ---

  function csvRow(values) {
    return values.map(v => {
      const s = v == null ? "" : String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",");
  }

  function toHistoricalCSV(records) {
    const headers = [
      "year", "equinoxUtcInstant", "yearGateInstant",
      "passageDays", "passageHours",
      "equinoxMoon", "equinoxMoonName", "equinoxDay", "equinoxWeekGate",
      "lunarPhase", "lunarIllumination",
      "patternCyclePosition", "lunarCyclePosition"
    ];
    const rows = [csvRow(headers)];
    for (const rec of records) {
      const pos   = rec.equinox?.patternPosition || {};
      const lunar = rec.equinox?.lunarLayer       || {};
      const offs  = rec.offsets || {};
      rows.push(csvRow([
        rec.year,
        rec.equinox?.utcInstant || "",
        rec.yearGate?.instant   || "",
        offs.equinoxToYearGateDays || "",
        Number(((offs.equinoxToYearGateDays || 0) * 24).toFixed(4)),
        pos.moon     || "",
        pos.moonName || "",
        pos.day      || "",
        pos.weekGate || "",
        lunar.phaseName || "",
        lunar.illuminationPercent ?? "",
        rec.normalized?.patternCyclePosition ?? "",
        rec.normalized?.lunarCyclePosition   ?? ""
      ]));
    }
    return rows.join("\r\n");
  }

  function toRecurrenceCSV(recurrenceList) {
    const headers = [
      "targetYear", "comparedYear",
      "sameMoon", "sameMoonDay", "sameWeekGate", "sameArchetype",
      "passageDifferenceHours", "equinoxShiftHours",
      "lunarCycleDistance", "overallSimilarityScore"
    ];
    const rows = [csvRow(headers)];
    for (const r of recurrenceList) {
      rows.push(csvRow([
        r.targetYear ?? "", r.year ?? "",
        r.sameMoon, r.sameMoonDay, r.sameWeekGate, r.sameArchetype,
        r.passageDifferenceHours ?? "", r.equinoxShiftHours ?? "",
        r.lunarCycleDistance ?? "", r.overallSimilarityScore ?? ""
      ]));
    }
    return rows.join("\r\n");
  }

  // --- Readable text export ---

  function toReadableText(record) {
    const pos   = record.equinox?.patternPosition || {};
    const lunar = record.equinox?.lunarLayer       || {};
    const offs  = record.offsets || {};
    const lines = [
      `Alignment Ledger · ${record.year}`,
      `Schema: ${record.schemaVersion}`,
      "",
      `Equinox: ${record.equinox?.utcInstant || "—"} UTC`,
      `Year Gate: ${record.yearGate?.instant || "—"} UTC`,
      "",
      `Pattern position at equinox:`,
      `  Moon: ${pos.moon} (${pos.moonName})`,
      `  Day:  ${pos.day}`,
      `  Week Gate: ${pos.weekGate}`,
      `  Archetype: ${pos.archetype}`,
      "",
      `Passage length: ${offs.equinoxToYearGateDays} days (${Number(((offs.equinoxToYearGateDays || 0) * 24).toFixed(2))} hours)`,
      "",
      `Lunar phase at equinox: ${lunar.phaseName} (~${lunar.illuminationPercent ?? "?"}% illumination)`,
      `Lunar cycle position: ${record.normalized?.lunarCyclePosition ?? "—"}`,
      "",
      `Generated: ${record.generatedAt}`,
      `Note: Measurements are deterministic calculations. Recurrence does not imply causation.`
    ];
    return lines.join("\n");
  }

  function downloadBlob(content, filename, mimeType) {
    if (typeof document === "undefined") return;
    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportRecordJSON(record) {
    downloadBlob(toRecordJSON(record), `alignment-${record.year}.json`, "application/json");
  }

  function exportHistoricalCSV(records) {
    downloadBlob(toHistoricalCSV(records), "alignment-historical.csv", "text/csv");
  }

  function exportReadableText(record) {
    downloadBlob(toReadableText(record), `alignment-${record.year}.txt`, "text/plain");
  }

  globalThis.AlignmentExport = Object.freeze({
    toRecordJSON,
    toComparisonJSON,
    toSphereModelJSON,
    toHistoricalCSV,
    toRecurrenceCSV,
    toReadableText,
    downloadBlob,
    exportRecordJSON,
    exportHistoricalCSV,
    exportReadableText
  });
})();
