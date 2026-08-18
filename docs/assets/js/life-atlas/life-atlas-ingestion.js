/** Codex Life Atlas — normalization, deduplication and review-safe ingestion. */
(function (root, factory) {
  let Schema = root.CodexLifeAtlasSchema;
  if (typeof module === "object" && module.exports) { Schema = require("./life-atlas-schema.js"); module.exports = factory(Schema); return; }
  root.CodexLifeAtlasIngestion = factory(Schema);
})(typeof globalThis !== "undefined" ? globalThis : this, function (Schema) {
  "use strict";
  if (!Schema) throw new Error("CodexLifeAtlasSchema is required.");
  const VERSION = "1.0.0";

  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, "0");
  }
  function civilDate(instant) { return instant ? new Date(instant).toISOString().slice(0, 10) : null; }
  function patternForInstant(instant, patternCalendar) {
    if (!instant || !patternCalendar?.fromCivilDate) return {};
    try {
      const mapped = patternCalendar.fromCivilDate({ date: new Date(instant), timeZone: "UTC", boundaryMode: "midnight" });
      const anchorYear = mapped.anchorDate instanceof Date ? mapped.anchorDate.getUTCFullYear() : new Date(instant).getUTCFullYear();
      return { patternYear: anchorYear, moon: mapped.moon, moonDay: mapped.day, patternDay: mapped.dayOfPatternYear, week: mapped.weekOfYear, outsideDay: !mapped.insideCountedYear };
    } catch (_) { return {}; }
  }
  function fingerprint(candidate) {
    return hash([candidate.sourceType, candidate.sourceId || "", candidate.instant || "", candidate.title || "", candidate.placeLabel || "", candidate.latitude ?? "", candidate.longitude ?? ""].join("|"));
  }
  function toRecord(candidate, options = {}) {
    const fp = fingerprint(candidate);
    const instant = candidate.instant || null;
    const pattern = patternForInstant(instant, options.patternCalendar);
    const locationKnown = Number.isFinite(candidate.latitude) && Number.isFinite(candidate.longitude);
    return Schema.createLifeRecord({
      id: `import:${candidate.sourceType || "archive"}:${fp}`,
      type: candidate.type || "event",
      subtype: candidate.sourceType || "archive",
      title: candidate.title || "Imported record",
      summary: candidate.summary || "",
      temporal: { instant, start: instant, end: candidate.end || null, civilDate: civilDate(instant), timezone: "UTC", boundaryMode: "midnight", ...pattern },
      spatial: { latitude: locationKnown ? candidate.latitude : null, longitude: locationKnown ? candidate.longitude : null, placeLabel: candidate.placeLabel || null, precision: locationKnown ? "exact" : candidate.placeLabel ? "region" : "unknown" },
      tags: ["life-atlas-import", candidate.sourceType || "archive"],
      provenance: { sourceType: candidate.sourceType || "archive", sourceId: candidate.sourceId || candidate.sourcePath || fp, importedAt: new Date().toISOString(), confidence: Math.max(0, Math.min(1, Number(candidate.confidence) || 0.5)) },
      privacy: { visibility: "private", containsPersonalData: true, shareAllowed: false },
      payload: { ...(candidate.payload || {}), importPath: candidate.sourcePath || null, importFingerprint: fp, reviewState: "unreviewed" }
    });
  }

  async function ingestCandidates(candidates, { repository, patternCalendar = null, dryRun = false } = {}) {
    if (!repository || typeof repository.put !== "function") throw new Error("Life Atlas repository is required.");
    const report = { total: candidates.length, accepted: 0, duplicates: 0, rejected: 0, byType: {}, bySource: {}, records: [] };
    for (const candidate of candidates) {
      try {
        const record = toRecord(candidate, { patternCalendar });
        const existing = await repository.get(record.id);
        if (existing) { report.duplicates += 1; continue; }
        report.accepted += 1;
        report.byType[record.type] = (report.byType[record.type] || 0) + 1;
        report.bySource[record.subtype] = (report.bySource[record.subtype] || 0) + 1;
        report.records.push(record);
        if (!dryRun) await repository.put(record);
      } catch (_) { report.rejected += 1; }
    }
    return report;
  }

  return Object.freeze({ VERSION, fingerprint, patternForInstant, toRecord, ingestCandidates });
});
