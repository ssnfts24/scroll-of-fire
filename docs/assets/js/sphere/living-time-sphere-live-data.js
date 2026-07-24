(() => {
  "use strict";

  const DEFAULT_TIME_ZONE = "America/Los_Angeles";
  const DEFAULT_BOUNDARY = "sunset";
  const DEFAULT_SUNSET = "18:00";
  const MIN_RECURRENCE_SCORE = 0.45;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function resolveDate(value) {
    if (!value) return new Date();
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  function resolveOptions(opts = {}) {
    return {
      asOf: resolveDate(opts.asOf),
      timeZone: opts.timeZone || DEFAULT_TIME_ZONE,
      boundaryMode: opts.boundaryMode || DEFAULT_BOUNDARY,
      manualSunset: opts.manualSunset || DEFAULT_SUNSET,
    };
  }

  function resolveSelectedYear(now) {
    if (!globalThis.AlignmentLedgerData?.listSupportedYears) return now.getUTCFullYear();
    const supported = globalThis.AlignmentLedgerData.listSupportedYears();
    if (!supported.length) return now.getUTCFullYear();
    const year = now.getUTCFullYear();
    return supported.includes(year) ? year : supported[supported.length - 1];
  }

  function resolveTodayModel(options, selectedYear) {
    if (!globalThis.LivingTimeSphereModel?.buildTodayModel) return null;
    return globalThis.LivingTimeSphereModel.buildTodayModel({
      year: selectedYear,
      timeZone: options.timeZone,
      boundaryMode: options.boundaryMode,
      manualSunset: options.manualSunset,
      asOf: options.asOf,
    });
  }

  function resolveYearModel(options, selectedYear) {
    if (!globalThis.LivingTimeSphereModel?.buildYearModel) return null;
    return globalThis.LivingTimeSphereModel.buildYearModel({
      year: selectedYear,
      timeZone: options.timeZone,
      boundaryMode: options.boundaryMode,
      manualSunset: options.manualSunset,
    });
  }

  function resolvePatternPosition(todayModel) {
    const tp = todayModel?.todayPatternPosition || {};
    return {
      moon: tp.moon ?? null,
      moonName: tp.moonName || "",
      day: tp.day ?? null,
      dayOfPatternYear: tp.dayOfPatternYear ?? null,
      weekGate: Array.isArray(tp.dayArchetype) ? tp.dayArchetype[0] : (tp.dayArchetype || null),
      civilDate: tp.civilDate || "",
      effectiveDate: tp.effectiveDate || "",
      afterBoundary: tp.afterBoundary ?? false,
      isDayOutOfTime: !!tp.isDayOutOfTime,
      isDeepTimeDay: !!tp.isDeepTimeDay,
      patternYear: tp.patternYear ?? null,
    };
  }

  function resolveLunarState(todayModel, pattern) {
    const codex = globalThis.CodexState || {};
    if (codex.phaseName) {
      const illumination = typeof codex.phaseIllumination === "number"
        ? Number((codex.phaseIllumination * 100).toFixed(1))
        : null;
      return {
        phaseName: codex.phaseName,
        illuminationPercent: illumination,
        source: "CodexState",
        angle: todayModel?.lunarAngle ?? null,
      };
    }

    const calendar = globalThis.SOFCalendar;
    const dateKey = pattern.effectiveDate || pattern.civilDate;
    if (calendar?.getMoonPhase && dateKey) {
      try {
        const phase = calendar.getMoonPhase(dateKey);
        return {
          phaseName: phase?.name || "Moon phase unavailable",
          illuminationPercent: typeof phase?.illumination === "number"
            ? Number((phase.illumination * 100).toFixed(1))
            : null,
          source: "SOFCalendar",
          angle: todayModel?.lunarAngle ?? null,
        };
      } catch {
        // Ignore and fall through to the alignment record fallback.
      }
    }

    const fallback = todayModel?.sourceRecord?.equinox?.lunarLayer || {};
    return {
      phaseName: fallback.phaseName || "Lunar reference unavailable",
      illuminationPercent: fallback.illuminationPercent ?? null,
      source: "AlignmentLedgerData",
      angle: todayModel?.lunarAngle ?? null,
    };
  }

  function resolveSolarGate(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const gates = [
      { name: "Capricorn", element: "Earth", copy: "Structure, duty, mountain path" },
      { name: "Aquarius", element: "Air", copy: "Signal, systems, future current" },
      { name: "Pisces", element: "Water", copy: "Dream, compassion, unseen waters" },
      { name: "Aries", element: "Fire", copy: "Spark, courage, first motion" },
      { name: "Taurus", element: "Earth", copy: "Body, garden, provision" },
      { name: "Gemini", element: "Air", copy: "Word, exchange, twin signal" },
      { name: "Cancer", element: "Water", copy: "Home, memory, protection" },
      { name: "Leo", element: "Fire", copy: "Heart, courage, solar witness" },
      { name: "Virgo", element: "Earth", copy: "Order, craft, refinement" },
      { name: "Libra", element: "Air", copy: "Balance, justice, relation" },
      { name: "Scorpio", element: "Water", copy: "Depth, shadow, transformation" },
      { name: "Sagittarius", element: "Fire", copy: "Arrow, journey, higher aim" },
    ];

    if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return gates[1];
    if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return gates[2];
    if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return gates[3];
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return gates[4];
    if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return gates[5];
    if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return gates[6];
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return gates[7];
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return gates[8];
    if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return gates[9];
    if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return gates[10];
    if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return gates[11];
    return gates[0];
  }

  function resolveSeason(date) {
    const year = date.getUTCFullYear();
    const points = [
      { key: "march-equinox", label: "March Equinox", start: Date.UTC(year, 2, 20) },
      { key: "june-solstice", label: "June Solstice", start: Date.UTC(year, 5, 20) },
      { key: "september-equinox", label: "September Equinox", start: Date.UTC(year, 8, 22) },
      { key: "december-solstice", label: "December Solstice", start: Date.UTC(year, 11, 21) },
      { key: "march-equinox-next", label: "March Equinox", start: Date.UTC(year + 1, 2, 20) },
    ];

    let active = points[0];
    let next = points[1];
    const now = date.getTime();
    for (let index = 0; index < points.length - 1; index += 1) {
      const current = points[index];
      const following = points[index + 1];
      if (now >= current.start && now < following.start) {
        active = current;
        next = following;
        break;
      }
      if (now < points[0].start) {
        active = { key: "december-solstice-prev", label: "December Solstice", start: Date.UTC(year - 1, 11, 21) };
        next = points[0];
      }
    }

    const span = Math.max(next.start - active.start, 1);
    const progress = clamp((now - active.start) / span, 0, 1);
    return {
      key: active.key,
      label: active.label,
      nextLabel: next.label,
      progress: Number(progress.toFixed(4)),
    };
  }

  function resolvePassageStatus(options, selectedYear) {
    if (!globalThis.EquinoxPassageEngine?.buildRecord) return null;
    try {
      const record = globalThis.EquinoxPassageEngine.buildRecord({
        selectedYear,
        timeZone: options.timeZone,
        boundaryMode: options.boundaryMode,
        manualSunset: options.manualSunset,
        asOf: options.asOf,
      });
      const normalized = record?.canonicalRecord?.normalizedValues || record?.normalizedValues || {};
      return {
        active: normalized.isInPassage ?? false,
        elapsed: normalized.passageElapsedDays ?? null,
        remaining: normalized.passageRemainingDays ?? null,
        progress: normalized.passageProgress ?? null,
      };
    } catch {
      return null;
    }
  }

  function resolveWitnessSummary() {
    const memory = globalThis.CodexMemory?.getState?.() || null;
    const recentWitness = memory?.recentWitness || null;
    return {
      label: recentWitness?.label || "No witness saved in this browser yet.",
      date: recentWitness?.date || "",
      count: Array.isArray(memory?.currentCycle?.witnessedDays) ? memory.currentCycle.witnessedDays.length : 0,
      source: memory ? "CodexMemory" : "none",
    };
  }

  function resolveEnvironment() {
    const touch = typeof window !== "undefined" && (
      "ontouchstart" in window ||
      (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0)
    );
    const standalone = typeof window !== "undefined" && (
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      typeof navigator !== "undefined" && navigator.standalone === true
    );
    return {
      online: typeof navigator !== "undefined" ? navigator.onLine !== false : true,
      reducedMotion: typeof window !== "undefined" ? !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches : false,
      touch,
      standalone,
      deviceMemoryGb: typeof navigator !== "undefined" && navigator.deviceMemory ? navigator.deviceMemory : null,
    };
  }

  function resolveHistory(selectedYear, options) {
    let previous = null;
    let recurrences = [];

    if (globalThis.AlignmentComparison?.compareToPrevious && selectedYear > 2014) {
      try {
        previous = globalThis.AlignmentComparison.compareToPrevious(selectedYear, options);
      } catch {
        previous = null;
      }
    }

    if (globalThis.AlignmentRecurrence?.findRecurrences) {
      try {
        recurrences = globalThis.AlignmentRecurrence
          .findRecurrences(selectedYear, { ...options, minimumScore: MIN_RECURRENCE_SCORE })
          .slice(0, 3);
      } catch {
        recurrences = [];
      }
    }

    return {
      previous,
      recurrences,
    };
  }

  function buildWitnessLink(snapshot) {
    if (globalThis.SOFWitness?.buildWitnessLink) {
      return globalThis.SOFWitness.buildWitnessLink({
        tool: "Living Time Sphere",
        tag: "living-time-sphere",
        result: snapshot?.pattern?.moon != null
          ? `Moon ${snapshot.pattern.moon} Day ${snapshot.pattern.day}`
          : "Outside counted year",
      });
    }
    return "./ledger.html";
  }

  function buildMiniLinks(snapshot) {
    const year = snapshot?.year || resolveSelectedYear(new Date());
    return Object.freeze({
      sphere: `./living-time-sphere.html?view=today&year=${year}`,
      alignment: `./alignment-ledger.html?year=${year}`,
      moons: "./moons.html",
      mirror: "./moons.html",
      oracle: "./genesis-oracle.html",
      witness: buildWitnessLink(snapshot),
    });
  }

  function getSnapshot(opts = {}) {
    const options = resolveOptions(opts);
    const selectedYear = resolveSelectedYear(options.asOf);
    const todayModel = resolveTodayModel(options, selectedYear);
    const yearModel = resolveYearModel(options, selectedYear);
    const pattern = resolvePatternPosition(todayModel);
    const effectiveDate = pattern.effectiveDate ? new Date(`${pattern.effectiveDate}T12:00:00Z`) : options.asOf;
    const solarGate = resolveSolarGate(effectiveDate);
    const season = resolveSeason(effectiveDate);
    const passageStatus = resolvePassageStatus(options, selectedYear);
    const witness = resolveWitnessSummary();
    const environment = resolveEnvironment();
    const history = resolveHistory(selectedYear, options);
    const alignment = yearModel?.sourceRecord || globalThis.AlignmentLedgerData?.getRecord?.({
      year: selectedYear,
      timeZone: options.timeZone,
      boundaryMode: options.boundaryMode,
      manualSunset: options.manualSunset,
    }) || null;
    const links = buildMiniLinks({ year: selectedYear, pattern });

    const snapshot = {
      instant: options.asOf.toISOString(),
      timeZone: options.timeZone,
      boundaryMode: options.boundaryMode,
      manualSunset: options.manualSunset,
      year: selectedYear,
      todayModel,
      yearModel,
      pattern,
      lunar: resolveLunarState(todayModel, pattern),
      solar: {
        gate: solarGate.name,
        element: solarGate.element,
        copy: solarGate.copy,
        season,
        angle: todayModel?.solarSeasonAngle ?? null,
      },
      passage: {
        durationDays: alignment?.offsets?.equinoxToYearGateDays ?? null,
        durationHours: alignment?.offsets?.equinoxToYearGateDays != null
          ? Number((alignment.offsets.equinoxToYearGateDays * 24).toFixed(1))
          : null,
        active: passageStatus?.active ?? false,
        elapsed: passageStatus?.elapsed ?? null,
        remaining: passageStatus?.remaining ?? null,
        progress: passageStatus?.progress ?? null,
      },
      alignment: {
        year: selectedYear,
        equinoxInstant: alignment?.equinox?.utcInstant || "",
        equinoxMoon: alignment?.equinox?.patternPosition?.moon ?? null,
        equinoxDay: alignment?.equinox?.patternPosition?.day ?? null,
      },
      history,
      witness,
      environment,
      links,
    };

    return Object.freeze(snapshot);
  }

  globalThis.LivingTimeSphereLiveData = Object.freeze({
    getSnapshot,
    buildMiniLinks,
    buildWitnessLink,
  });
})();
