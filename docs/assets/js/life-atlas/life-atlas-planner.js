(() => {
  "use strict";

  const VERSION = "1.1.0";

  let repository = null;
  let initialized = false;
  let allPlansCache = null;
  let allPlansPromise = null;
  const plansByYearCache = new Map();

  const TYPE_MAP = Object.freeze({
    event:       { recordType: "event",   scheduleKind: "event" },
    task:        { recordType: "event",   scheduleKind: "task" },
    reminder:    { recordType: "event",   scheduleKind: "reminder" },
    growing:     { recordType: "project", scheduleKind: "practice" },
    farming:     { recordType: "project", scheduleKind: "practice" },
    planting:    { recordType: "project", scheduleKind: "practice" },
    harvest:     { recordType: "event",   scheduleKind: "event" },
    watering:    { recordType: "task",    scheduleKind: "task" },
    livestock:   { recordType: "project", scheduleKind: "practice" },
    maintenance: { recordType: "event",   scheduleKind: "task" },
    seasonal:    { recordType: "event",   scheduleKind: "practice" },
    practice:    { recordType: "event",   scheduleKind: "practice" },
    project:     { recordType: "project", scheduleKind: "milestone" },
    meeting:     { recordType: "event",   scheduleKind: "event" },
    school:      { recordType: "event",   scheduleKind: "event" },
    health:      { recordType: "event",   scheduleKind: "reminder" },
    finance:     { recordType: "event",   scheduleKind: "reminder" },
    observation: { recordType: "note",    scheduleKind: "event" },
    home:        { recordType: "event",   scheduleKind: "task" },
    family:      { recordType: "event",   scheduleKind: "event" },
    pets:        { recordType: "event",   scheduleKind: "reminder" },
    food:        { recordType: "event",   scheduleKind: "task" },
    shopping:    { recordType: "event",   scheduleKind: "task" },
    vehicle:     { recordType: "project", scheduleKind: "task" },
    construction:{ recordType: "project", scheduleKind: "milestone" },
    coding:      { recordType: "project", scheduleKind: "task" },
    writing:     { recordType: "note",    scheduleKind: "task" },
    research:    { recordType: "note",    scheduleKind: "practice" },
    creative:    { recordType: "project", scheduleKind: "practice" },
    cleaning:    { recordType: "event",   scheduleKind: "task" },
    appointment: { recordType: "event",   scheduleKind: "event" },
    community:   { recordType: "event",   scheduleKind: "event" },
    camping:     { recordType: "journey", scheduleKind: "travel" },
    fieldwork:   { recordType: "note",    scheduleKind: "event" },
    travel:      { recordType: "journey", scheduleKind: "travel" },
    milestone:   { recordType: "milestone", scheduleKind: "milestone" }
  });

  const DEFAULT_SYMBOL_BY_CATEGORY = Object.freeze({
    event:"◆", task:"✓", reminder:"⚑", growing:"🌿", farming:"🌱", planting:"🌱", harvest:"🌾", watering:"💧",
    livestock:"🐄", maintenance:"🔧", seasonal:"☀", practice:"✦", project:"◆", meeting:"👥", school:"🎓", health:"❤",
    finance:"💰", observation:"◉", home:"⌂", family:"♡", pets:"🐾", food:"🍽", shopping:"🛒", vehicle:"🚗",
    construction:"🏗", coding:"💻", writing:"✎", research:"🔬", creative:"🎨", cleaning:"🧹", appointment:"✚",
    community:"◎", camping:"⛺", fieldwork:"🥾", travel:"✈", milestone:"★"
  });
  function invalidatePlanCaches() {
    allPlansCache = null;
    allPlansPromise = null;
    plansByYearCache.clear();
  }
  function importedCategory(record) {
    const payload = record?.payload || {};
    const planner = payload.planner || {};
    const values = [planner.importedCategory, payload.category, payload.workflowKind, ...(String(payload.categories || "").split(","))];
    for (const value of values) {
      const key = String(value || "").trim().toLowerCase().replace(/[ _-]+/g, "");
      const match = Object.keys(TYPE_MAP).find(category => category.replace(/[ _-]+/g, "") === key);
      if (match) return match;
      const aliases = { grow:"growing", garden:"growing", gardening:"growing", plant:"planting", irrigate:"watering", irrigation:"watering", animal:"livestock", animals:"livestock", repair:"maintenance", upkeep:"maintenance", study:"school", learning:"school", medical:"health", money:"finance", budget:"finance", trip:"travel", journey:"travel", development:"coding", code:"coding" };
      if (aliases[key]) return aliases[key];
    }
    return planner.category || record?.subtype || "event";
  }
  function firstGrapheme(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    try {
      if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") return new Intl.Segmenter(undefined, { granularity:"grapheme" }).segment(text)[Symbol.iterator]().next().value?.segment || null;
    } catch (_) {}
    return Array.from(text)[0] || null;
  }
  function repairImportedPlannerMetadata(record) {
    const imported = record?.provenance?.source === "calendar-import" || record?.tags?.includes?.("calendar-import");
    if (!imported || !record?.payload?.planner) return record;
    const category = importedCategory(record);
    const workflow = String(record.payload.planner.workflow || record.payload.workflow || "").trim().toLowerCase();
    const existing = String(record.payload.planner.symbol || record.payload.symbol || "").trim();
    const generic = new Set(["", "auto", "●", "•", "○"]);
    let symbol = !generic.has(existing.toLowerCase()) ? existing : null;
    const leading = firstGrapheme(record.title);
    if (!symbol && leading && !generic.has(String(leading).toLowerCase()) && !/^[A-Za-z0-9]$/.test(leading)) symbol = leading;
    if (!symbol && workflow === "living-phone") symbol = "☎";
    if (!symbol && workflow === "codex-of-reality") symbol = "✎";
    if (!symbol) symbol = DEFAULT_SYMBOL_BY_CATEGORY[category] || "◆";
    const currentCategory = String(record.payload.planner.category || "event").toLowerCase();
    if (currentCategory === category && existing === symbol) return record;
    return {
      ...record,
      subtype: category,
      tags: [...new Set([...(record.tags || []), category])],
      payload: {
        ...(record.payload || {}),
        planner: { ...(record.payload.planner || {}), category, symbol, metadataRepair: "calendar-import-fidelity-v1" }
      },
      provenance: { ...(record.provenance || {}), metadataRepair: "calendar-import-fidelity-v1", updatedAt: new Date().toISOString() }
    };
  }
  function sortPlans(records) {
    return records.sort((a, b) => {
      const sa = globalThis.CodexLifeAtlasScheduling?.getSchedule?.(a);
      const sb = globalThis.CodexLifeAtlasScheduling?.getSchedule?.(b);
      const ta = Date.parse(sa?.start || `${sa?.startDate || "9999-12-31"}T00:00:00`) || Infinity;
      const tb = Date.parse(sb?.start || `${sb?.startDate || "9999-12-31"}T00:00:00`) || Infinity;
      return ta - tb;
    });
  }
  const deferredRepairWrites = new Map();
  let deferredRepairHandle = null;

  function schedulePlannerRepairPersistence(records, repo) {
    for (const record of records || []) {
      if (record?.id) deferredRepairWrites.set(record.id, record);
    }
    if (!deferredRepairWrites.size || deferredRepairHandle != null) return;

    const flush = async () => {
      deferredRepairHandle = null;
      const batch = [...deferredRepairWrites.values()];
      deferredRepairWrites.clear();
      for (const record of batch) {
        try { await repo.put(record); } catch (error) {
          console.warn("[LivingPlanner] Deferred metadata repair could not be persisted.", error);
        }
      }
    };

    if (typeof globalThis.requestIdleCallback === "function") {
      deferredRepairHandle = globalThis.requestIdleCallback(() => void flush(), { timeout: 6000 });
    } else {
      deferredRepairHandle = globalThis.setTimeout?.(() => void flush(), 1400) ?? null;
      if (deferredRepairHandle == null) void flush();
    }
  }

  async function normalizeLoadedPlans(records, repo) {
    const repaired = [];
    const changed = [];
    for (const record of records || []) {
      if (!record?.tags?.includes?.("living-planner") || !globalThis.CodexLifeAtlasScheduling?.isScheduled?.(record)) continue;
      let next = repairPlannerTemporal(record);
      next = repairImportedPlannerMetadata(next);
      if (next !== record) changed.push(next);
      repaired.push(next);
    }
    // B7.49 first-paint rule: repairs affect this render immediately, but the
    // IndexedDB writeback waits for browser idle time instead of blocking the
    // schedule/symbol field behind dozens of small write transactions.
    if (changed.length) schedulePlannerRepairPersistence(changed, repo);
    return sortPlans(repaired);
  }

  function dependencies() {
    return {
      Schema: globalThis.CodexLifeAtlasSchema,
      Repository: globalThis.CodexLifeAtlasRepository,
      Scheduling: globalThis.CodexLifeAtlasScheduling
    };
  }

  function ensureRepository() {
    if (repository) return repository;

    const { Repository } = dependencies();

    if (!Repository?.createPersistentRepository) {
      throw new Error("Life Atlas repository is unavailable.");
    }

    repository = Repository.createPersistentRepository();
    return repository;
  }

  function clean(value, max = 4000) {
    return String(value ?? "").trim().slice(0, max);
  }

  function tags(value) {
    return [...new Set(
      String(value || "")
        .split(",")
        .map(v => v.trim().toLowerCase())
        .filter(Boolean)
    )].slice(0, 30);
  }

  function timezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
      return null;
    }
  }

  function patternContext(civilDate = null) {
    const snap =
      globalThis.LivingTimeSphereLiveData?.getSnapshot?.() || {};

    const livePattern = snap.pattern || {};
    const timeZone = snap.timeZone || timezone() || "UTC";
    const boundaryMode = snap.boundaryMode || "midnight";
    const sunsetTime = snap.sunsetTime || snap.sunset || "18:00";

    let mapped = null;

    if (
      civilDate &&
      globalThis.PatternCalendar?.fromCivilDate
    ) {
      try {
        const date = new Date(`${civilDate}T12:00:00`);

        if (!Number.isNaN(date.getTime())) {
          // PatternCalendar.fromCivilDate expects an options object, not a Date.
          // Life Atlas uses the civil anchor year (2026, 2027, …) as
          // temporal.patternYear because the sphere/calendar strata are keyed
          // by those alignment years. PatternCalendar's internal ordinal
          // patternYear (1, 2, …) is therefore intentionally not persisted.
          mapped = globalThis.PatternCalendar.fromCivilDate({
            date,
            timeZone,
            boundaryMode,
            sunsetTime
          });
        }
      } catch (error) {
        console.warn(
          "[LivingPlanner] Pattern date mapping failed.",
          error
        );
      }
    }

    const mappedAlignmentYear =
      mapped?.anchorDate instanceof Date
        ? mapped.anchorDate.getUTCFullYear()
        : null;

    const liveAlignmentYear =
      Number(snap.year) ||
      (livePattern.anchorDate
        ? new Date(livePattern.anchorDate).getUTCFullYear()
        : null);

    return {
      patternYear:
        Number(
          mappedAlignmentYear ??
          liveAlignmentYear
        ) || null,

      moon:
        Number(
          mapped?.moon ??
          livePattern.moon
        ) || null,

      moonDay:
        Number(
          mapped?.day ??
          mapped?.moonDay ??
          livePattern.day
        ) || null,

      patternDay:
        Number(
          mapped?.dayOfPatternYear ??
          mapped?.patternDay ??
          livePattern.dayOfPatternYear
        ) || null,

      week:
        Number(
          mapped?.weekOfYear ??
          livePattern.weekOfYear
        ) || null,

      outsideDay:
        mapped
          ? !mapped.insideCountedYear
          : Boolean(livePattern.outsideDay),

      civilDate:
        civilDate ||
        mapped?.civilDate ||
        livePattern.civilDate ||
        null,

      boundaryMode,
      timezone: timeZone
    };
  }

  function civilDateForRecord(record) {
    const schedule =
      globalThis.CodexLifeAtlasScheduling
        ?.getSchedule?.(record);

    return (
      schedule?.startDate
      || schedule?.start?.slice?.(0, 10)
      || record?.temporal?.civilDate
      || null
    );
  }

  function repairPlannerTemporal(record) {
    const civilDate = civilDateForRecord(record);
    if (!civilDate) return record;

    const mapped = patternContext(civilDate);
    if (!mapped.patternYear || !mapped.patternDay) return record;

    const temporal = record.temporal || {};
    const alreadyCanonical =
      Number(temporal.patternYear) === Number(mapped.patternYear)
      && Number(temporal.patternDay) === Number(mapped.patternDay)
      && Number(temporal.moon) === Number(mapped.moon)
      && Number(temporal.moonDay) === Number(mapped.moonDay);

    if (alreadyCanonical) return record;

    return {
      ...record,
      temporal: {
        ...temporal,
        timezone: mapped.timezone,
        boundaryMode: mapped.boundaryMode,
        civilDate: mapped.civilDate,
        patternYear: mapped.patternYear,
        moon: mapped.moon,
        moonDay: mapped.moonDay,
        patternDay: mapped.patternDay,
        week: mapped.week,
        outsideDay: mapped.outsideDay
      },
      provenance: {
        ...(record.provenance || {}),
        temporalRepair: "living-planner-alignment-year-v1",
        updatedAt: new Date().toISOString()
      }
    };
  }

  function localDateTimeIso(date, time) {
    if (!date) return null;

    const value =
      time
        ? `${date}T${time}:00`
        : `${date}T12:00:00`;

    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime())
      ? null
      : parsed.toISOString();
  }

  function recurrenceFromInput(input = {}) {
    const frequency =
      ["none", "daily", "weekly", "monthly", "yearly", "custom"]
        .includes(input.frequency)
        ? input.frequency
        : "none";

    return {
      frequency,
      interval:
        Math.max(1, Math.trunc(Number(input.interval) || 1)),
      byWeekday:
        Array.isArray(input.byWeekday)
          ? input.byWeekday
          : [],
      byMonthDay:
        Array.isArray(input.byMonthDay)
          ? input.byMonthDay
          : [],
      count:
        Number(input.count) > 0
          ? Math.trunc(Number(input.count))
          : null,
      until:
        input.until || null
    };
  }

  function scheduleFromInput(input = {}) {
    const allDay = input.allDay !== false;

    const start =
      allDay
        ? null
        : localDateTimeIso(input.date, input.time);

    return {
      kind: input.scheduleKind || "event",
      status: input.status || "planned",
      priority: input.priority || "normal",
      allDay,
      timezone: timezone(),

      start,
      startDate:
        allDay
          ? input.date
          : null,

      endDate:
        allDay
          ? (input.endDate || input.date)
          : null,

      recurrence:
        recurrenceFromInput(input.recurrence),

      reminders:
        input.reminderMinutes != null
          ? [{
              offsetMinutes:
                -Math.abs(Number(input.reminderMinutes) || 0),
              method: "notification",
              enabled: true,
              label: "Living Planner reminder"
            }]
          : [],

      locationLabel:
        clean(input.location, 180) || null
    };
  }

  async function createPlan(input = {}) {
    const {
      Scheduling
    } = dependencies();

    if (!Scheduling?.attachSchedule) {
      throw new Error("Life Atlas scheduling engine is unavailable.");
    }

    const category =
      TYPE_MAP[input.category]
        ? input.category
        : "event";

    const mapping = TYPE_MAP[category];
    const context = patternContext(input.date || null);

    const schedule = scheduleFromInput({
      ...input,
      scheduleKind: mapping.scheduleKind
    });

    const recordInput = {
      type: mapping.recordType,
      subtype: category,

      title:
        clean(input.title, 160),

      summary:
        clean(input.notes, 4000),

      tags: [
        "living-planner",
        category,
        ...tags(input.tags)
      ],

      temporal: {
        timezone: context.timezone,
        boundaryMode: context.boundaryMode,
        civilDate: context.civilDate,
        patternYear: context.patternYear,
        moon: context.moon,
        moonDay: context.moonDay,
        patternDay: context.patternDay,
        week: context.week,
        outsideDay: context.outsideDay
      },

      spatial: {
        placeId:
          clean(input.location, 180) || null
      },

      privacy: {
        visibility: "private",
        containsPersonalData: false,
        shareAllowed: false
      },

      provenance: {
        source: "living-planner",
        calculationAuthority: "CodexLifeAtlasScheduling"
      },

      payload: {
        planner: {
          version: VERSION,
          category,
          symbol:
            clean(input.symbol, 12) || null,
          intention:
            clean(input.intention, 1000),
          seasonalWindow:
            clean(input.seasonalWindow, 180) || null,
          outcome: null
        }
      }
    };

    const record =
      Scheduling.attachSchedule(
        recordInput,
        schedule
      );

    const saved = await ensureRepository().put(record);
    invalidatePlanCaches();
    return saved;
  }

  async function plansForYear(patternYear) {
    const year = Number(patternYear);
    if (!Number.isFinite(year)) return [];
    if (plansByYearCache.has(year)) return (await plansByYearCache.get(year)).slice();
    const promise = (async () => {
      const repo = ensureRepository();
      const records = await repo.query({ patternYear: year });
      return normalizeLoadedPlans(records, repo);
    })();
    plansByYearCache.set(year, promise);
    try {
      const result = await promise;
      plansByYearCache.set(year, Promise.resolve(result));
      return result.slice();
    } catch (error) {
      plansByYearCache.delete(year);
      throw error;
    }
  }

  async function plansForYears(years = []) {
    const unique = [...new Set((Array.isArray(years) ? years : []).map(Number).filter(Number.isFinite))];
    const groups = await Promise.all(unique.map(plansForYear));
    const merged = new Map();
    for (const group of groups) for (const record of group || []) if (record?.id) merged.set(record.id, record);
    return sortPlans([...merged.values()]);
  }

  async function upcomingPlans({ year = null, years = 2, limit = 32 } = {}) {
    const baseYear = Number(year) || Number(globalThis.LivingTimeSphereLiveData?.getSnapshot?.()?.year) || new Date().getFullYear();
    const span = Math.max(1, Math.min(4, Number(years) || 2));
    const records = await plansForYears(Array.from({ length: span }, (_, index) => baseYear + index));
    return records.filter(record => !globalThis.CodexLifeAtlasScheduling?.isCompleted?.(record)).slice(0, Math.max(1, Math.min(200, Number(limit) || 32)));
  }

  async function getPlan(id) {
    if (!id) return null;
    const record = await ensureRepository().get(id);
    if (!record || !record.tags?.includes?.("living-planner")) return null;
    return record;
  }

  async function allPlans() {
    if (allPlansCache) return allPlansCache.slice();
    if (allPlansPromise) return (await allPlansPromise).slice();
    allPlansPromise = (async () => {
      const repo = ensureRepository();
      const all = await repo.all();
      const result = await normalizeLoadedPlans(all, repo);
      allPlansCache = result;
      allPlansPromise = null;
      return result;
    })();
    try {
      return (await allPlansPromise).slice();
    } catch (error) {
      allPlansPromise = null;
      throw error;
    }
  }

  async function removePlan(id) {
    const removed = await ensureRepository().remove(id);
    if (removed) invalidatePlanCaches();
    return removed;
  }

  async function completePlan(id) {
    const repo = ensureRepository();
    const record = await repo.get(id);

    if (!record) return null;

    const Scheduling =
      globalThis.CodexLifeAtlasScheduling;

    const schedule =
      Scheduling?.getSchedule?.(record);

    if (!schedule) return null;

    const completed =
      Scheduling.attachSchedule(
        {
          ...record,
          payload: {
            ...(record.payload || {}),
            planner: {
              ...(record.payload?.planner || {}),
              outcome:
                record.payload?.planner?.outcome || null
            }
          }
        },
        {
          ...schedule,
          status: "completed",
          completedAt:
            new Date().toISOString()
        }
      );

    const saved = await repo.put(completed);
    invalidatePlanCaches();
    return saved;
  }

  async function updatePlan(id, input = {}) {
    const existing =
      await ensureRepository().get(id);

    if (!existing) {
      throw new Error("Plan was not found.");
    }

    const oldSchedule =
      globalThis.CodexLifeAtlasScheduling
        ?.getSchedule?.(existing);

    const replacement =
      await createPlan({
        category:
          input.category ||
          existing.subtype,
        title:
          input.title ||
          existing.title,
        notes:
          input.notes ??
          existing.summary,
        symbol:
          input.symbol ??
          existing.payload?.planner?.symbol ??
          null,
        intention:
          input.intention ??
          existing.payload?.planner?.intention,
        date:
          input.date ||
          oldSchedule?.startDate ||
          oldSchedule?.start?.slice(0, 10),
        time:
          input.time ||
          (oldSchedule?.start
            ? new Date(oldSchedule.start)
                .toTimeString()
                .slice(0, 5)
            : ""),
        allDay:
          input.allDay ??
          oldSchedule?.allDay,
        priority:
          input.priority ||
          oldSchedule?.priority,
        recurrence:
          input.recurrence ||
          oldSchedule?.recurrence,
        location:
          input.location ||
          oldSchedule?.locationLabel,
        tags:
          input.tags ||
          existing.tags
            ?.filter(tag =>
              tag !== "living-planner" &&
              tag !== existing.subtype
            )
            .join(",")
      });

    await ensureRepository().remove(replacement.id);

    const saved = await ensureRepository().put({
      ...replacement,
      id: existing.id,
      provenance: {
        ...existing.provenance,
        updatedAt:
          new Date().toISOString()
      }
    });
    invalidatePlanCaches();
    return saved;
  }

  function init() {
    if (initialized) return true;

    const {
      Schema,
      Repository,
      Scheduling
    } = dependencies();

    if (
      !Schema ||
      !Repository ||
      !Scheduling
    ) {
      console.warn(
        "[LivingPlanner] Life Atlas dependencies unavailable."
      );
      return false;
    }

    try {
      ensureRepository();
      initialized = true;
      globalThis.addEventListener?.("sof:life-atlas-records-changed", event => {
        if (event?.detail?.source !== "living-planner") invalidatePlanCaches();
      });
      return true;
    } catch (error) {
      console.warn(
        "[LivingPlanner] Initialization failed.",
        error
      );
      return false;
    }
  }

  globalThis.CodexLivingPlanner =
    Object.freeze({
      VERSION,
      TYPE_MAP,
      init,
      createPlan,
      updatePlan,
      removePlan,
      completePlan,
      getPlan,
      plansForYear,
      plansForYears,
      upcomingPlans,
      allPlans
    });
})();
