/** Codex Life Atlas — normalization, deduplication and review-safe ingestion. */
(function (root, factory) {
  let Schema = root.CodexLifeAtlasSchema;
  if (typeof module === "object" && module.exports) { Schema = require("./life-atlas-schema.js"); module.exports = factory(Schema); return; }
  root.CodexLifeAtlasIngestion = factory(Schema);
})(typeof globalThis !== "undefined" ? globalThis : this, function (Schema) {
  "use strict";
  if (!Schema) throw new Error("CodexLifeAtlasSchema is required.");
  const VERSION = "1.1.0";

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
  const CALENDAR_CATEGORIES = Object.freeze(new Set([
    "event","task","reminder","growing","farming","planting","harvest","watering","livestock","maintenance",
    "seasonal","practice","project","meeting","school","health","finance","observation","home","family","pets",
    "food","shopping","vehicle","construction","coding","writing","research","creative","cleaning","appointment",
    "community","camping","fieldwork","travel","milestone"
  ]));
  const CALENDAR_CATEGORY_ALIASES = Object.freeze({
    grow: "growing", garden: "growing", gardening: "growing", plant: "planting", irrigate: "watering",
    irrigation: "watering", animal: "livestock", animals: "livestock", repair: "maintenance", upkeep: "maintenance",
    work: "project", development: "coding", code: "coding", study: "school", learning: "school",
    medical: "health", money: "finance", budget: "finance", trip: "travel", journey: "travel", observe: "observation"
  });
  const CALENDAR_SYMBOLS = Object.freeze({
    event:"◆", task:"✓", reminder:"⚑", growing:"🌿", farming:"🌱", planting:"🌱", harvest:"🌾", watering:"💧",
    livestock:"🐄", maintenance:"🔧", seasonal:"☀", practice:"✦", project:"◆", meeting:"👥", school:"🎓", health:"❤",
    finance:"💰", observation:"◉", home:"⌂", family:"♡", pets:"🐾", food:"🍽", shopping:"🛒", vehicle:"🚗",
    construction:"🏗", coding:"💻", writing:"✎", research:"🔬", creative:"🎨", cleaning:"🧹", appointment:"✚",
    community:"◎", camping:"⛺", fieldwork:"🥾", travel:"✈", milestone:"★"
  });
  const SCHEDULE_KIND = Object.freeze({
    task:"task", reminder:"reminder", watering:"task", maintenance:"task", home:"task", food:"task", shopping:"task",
    vehicle:"task", coding:"task", writing:"task", cleaning:"task", health:"reminder", finance:"reminder",
    growing:"practice", farming:"practice", planting:"practice", livestock:"practice", seasonal:"practice", practice:"practice",
    research:"practice", creative:"practice", project:"milestone", construction:"milestone", milestone:"milestone",
    travel:"travel", camping:"travel"
  });
  function normalizeCalendarCategory(value) {
    const raw = String(value || "").trim().toLowerCase().replace(/[ _]+/g, "-");
    const compact = raw.replace(/-/g, "");
    if (CALENDAR_CATEGORIES.has(raw)) return raw;
    if (CALENDAR_CATEGORIES.has(compact)) return compact;
    return CALENDAR_CATEGORY_ALIASES[raw] || CALENDAR_CATEGORY_ALIASES[compact] || null;
  }
  function inferCalendarCategory(candidate) {
    const payload = candidate?.payload || {};
    for (const value of [payload.category, payload.workflowKind]) {
      const normalized = normalizeCalendarCategory(value);
      if (normalized) return normalized;
    }
    const categoryTokens = String(payload.categories || "").split(",").map(value => value.trim());
    for (const token of categoryTokens) {
      const normalized = normalizeCalendarCategory(token);
      if (normalized) return normalized;
    }
    const title = String(candidate?.title || "").toLowerCase();
    const keywordMap = [
      ["watering",/water|irrigat/],["harvest",/harvest/],["planting",/plant|seed/],["farming",/farm|soil|compost|pollinat/],
      ["livestock",/livestock|animal care|cattle|chicken|horse/],["maintenance",/maintenan|repair|upkeep|tools/],
      ["meeting",/meeting|review/],["school",/school|study|learn/],["health",/health|medical|movement/],["finance",/financ|budget|cost|resource/],
      ["travel",/travel|trip|route/],["coding",/code|coding|develop/],["writing",/writing|document/],["research",/research/]
    ];
    for (const [category, regex] of keywordMap) if (regex.test(title)) return category;
    return "event";
  }
  function firstGrapheme(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    try {
      if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
        return new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)[Symbol.iterator]().next().value?.segment || null;
      }
    } catch (_) {}
    return Array.from(text)[0] || null;
  }
  function inferCalendarSymbol(candidate, category, workflow) {
    const explicit = String(candidate?.payload?.symbol || "").trim();
    const generic = new Set(["", "auto", "●", "•", "○"]);
    if (!generic.has(explicit.toLowerCase())) return explicit.slice(0, 12);
    const leading = firstGrapheme(candidate?.title);
    if (leading && !generic.has(String(leading).toLowerCase()) && !/^[A-Za-z0-9]$/.test(leading)) return leading.slice(0, 12);
    if (workflow === "living-phone") return "☎";
    if (workflow === "codex-of-reality") return "✎";
    return CALENDAR_SYMBOLS[category] || "◆";
  }
  function calendarPatternOverride(candidate, computed = {}) {
    const moon = Number(candidate?.payload?.patternMoon);
    const moonDay = Number(candidate?.payload?.patternMoonDay);
    if (!Number.isFinite(moon) || moon < 1 || moon > 13 || !Number.isFinite(moonDay) || moonDay < 1 || moonDay > 28) return computed;
    return { ...computed, moon, moonDay, patternDay: ((moon - 1) * 28) + moonDay, week: Math.ceil((((moon - 1) * 28) + moonDay) / 7), outsideDay: false };
  }
  function toRecord(candidate, options = {}) {
    const fp = fingerprint(candidate);
    const instant = candidate.instant || null;
    const pattern = calendarPatternOverride(candidate, patternForInstant(instant, options.patternCalendar));
    const locationKnown = Number.isFinite(candidate.latitude) && Number.isFinite(candidate.longitude);
    const isCalendar = candidate.sourceType === "calendar-ics";
    const allDay = isCalendar && candidate.payload?.allDay === true;
    const startDate = candidate.payload?.startDate || civilDate(instant);
    const workflow = String(candidate.payload?.workflow || "").trim().toLowerCase() || null;
    const workflowKind = String(candidate.payload?.workflowKind || "").trim().toLowerCase() || null;
    const plannerCategory = isCalendar ? inferCalendarCategory(candidate) : null;
    const plannerSymbol = isCalendar ? inferCalendarSymbol(candidate, plannerCategory, workflow) : null;
    const schedule = isCalendar ? {
      version: "1.0.0",
      kind: SCHEDULE_KIND[plannerCategory] || "event",
      status: "planned",
      priority: "normal",
      allDay,
      timezone: allDay ? null : "UTC",
      start: allDay ? null : instant,
      end: allDay ? null : (candidate.end || null),
      startDate: allDay ? startDate : null,
      endDate: allDay ? (candidate.payload?.endDate || startDate) : null,
      durationMinutes: null,
      recurrence: { frequency: "none", interval: 1, byWeekday: [], byMonthDay: [], count: null, until: null, rawRRule: null },
      reminders: [], attendees: [], availability: "busy",
      locationId: null, locationLabel: candidate.placeLabel || null,
      completedAt: null,
      external: { provider: "ics", calendarId: null, eventId: candidate.sourceId || null, syncToken: null }
    } : null;
    const payload = {
      ...(candidate.payload || {}),
      importPath: candidate.sourcePath || null,
      importFingerprint: fp,
      reviewState: "unreviewed"
    };
    if (isCalendar) {
      payload.schedule = schedule;
      payload.planner = {
        version: "1.0.0",
        category: plannerCategory,
        symbol: plannerSymbol,
        intention: candidate.summary || "",
        seasonalWindow: null,
        outcome: null,
        workflow,
        workflowKind,
        importedCategory: candidate.payload?.category || null
      };
    }
    return Schema.createLifeRecord({
      id: `import:${candidate.sourceType || "archive"}:${fp}`,
      type: candidate.type || "event",
      subtype: isCalendar ? plannerCategory : (candidate.sourceType || "archive"),
      title: candidate.title || "Imported record",
      summary: candidate.summary || "",
      temporal: { instant, start: allDay ? null : instant, end: candidate.end || null, civilDate: startDate, timezone: allDay ? null : "UTC", boundaryMode: "midnight", ...pattern },
      spatial: { latitude: locationKnown ? candidate.latitude : null, longitude: locationKnown ? candidate.longitude : null, placeLabel: candidate.placeLabel || null, precision: locationKnown ? "exact" : candidate.placeLabel ? "region" : "unknown" },
      tags: ["life-atlas-import", candidate.sourceType || "archive", ...(isCalendar ? ["living-planner", "calendar-import", plannerCategory] : []), ...(workflow ? ["workflow", workflow] : [])],
      provenance: { sourceType: candidate.sourceType || "archive", sourceId: candidate.sourceId || candidate.sourcePath || fp, source: isCalendar ? "calendar-import" : undefined, importedAt: new Date().toISOString(), confidence: Math.max(0, Math.min(1, Number(candidate.confidence) || 0.5)) },
      privacy: { visibility: "private", containsPersonalData: true, shareAllowed: false },
      payload
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
