(() => {
  "use strict";

  // Living Time Sphere UI — DOM orchestration layer.
  // Wires model, renderers, interaction, accessibility, export, and URL state together.
  // Phase 03: adds 3D renderer (WebGL/Three.js), quality mode, view-renderer selector,
  // and guided introduction.

  let _state = {
    year:          2026,
    viewMode:      "today",
    timeZone:      "America/Los_Angeles",
    boundaryMode:  "sunset",
    manualSunset:  "18:00",
    selectedDayOfYear: null,
    fieldRange:    "now",
    visibleLayers: { pattern: true, exactDays: true, weekGates: true, outsideDays: false, passage: true, lunar: true, solar: false, markers: true, recurrence: false, spiral: false, environment: false, connections: true },
    selectedMarker: null,
    useCanvas:     false,
    lowPower:      false,
    // Phase 03 additions
    rendererMode:  "auto",   // "auto" | "3d" | "svg" | "table" | "text"
    quality:       "auto",   // "auto" | "high" | "balanced" | "lowpower" | "svgonly"
    moonLabelMode: "contextual", // "contextual" | "all" | "selected" | "hidden"
    moonLabelDistance: "standard",
    dayLabelMode: "key",
    connectionMode: "contextual",
    motionMode: "still",
    active3d:      false,    // true when 3D renderer is active
    introShown:    false,
    _3dInitInProgress: false, // guard against concurrent 3D init calls
  };
  const MOON_LABEL_MODE_KEY = "lts-moon-label-mode";
  const DAY_MS = 24 * 60 * 60 * 1000;
  const SHABBAT_DAYS = new Set([2, 9, 16, 23]);
  const MOON_LOG_KEY = "sof_moon_logs_v3";
  const LEGACY_MOON_LOG_KEY = "sof_moon_logs_v2";
  const FIELD_RANGE_LABELS = Object.freeze({
    now: "Now",
    today: "Today",
    "pattern-week": "Pattern Week",
    "pattern-moon": "Pattern Moon",
    "pattern-year": "Pattern Year",
    historical: "Historical comparison",
  });

  // ── Dependency check ───────────────────────────────────────────────

  function safeInit() {
    const required = [
      "LivingTimeSphereModel", "LivingTimeSphereLayout",
      "LivingTimeSphereRendererSvg", "LivingTimeSphereInteraction",
      "LivingTimeSphereAccessibility", "LivingTimeSphereUrlState",
      "AlignmentLedgerData"
    ];
    return required.every(d => !!globalThis[d]);
  }

  // ── URL state ──────────────────────────────────────────────────────

  function applyUrlState() {
    if (typeof location === "undefined") return;
    const parsed = globalThis.LivingTimeSphereUrlState.parseSphereUrl(location.href);
    if (parsed.year)         _state.year         = parsed.year;
    if (parsed.viewMode)     _state.viewMode     = parsed.viewMode;
    if (parsed.timeZone)     _state.timeZone     = parsed.timeZone;
    if (parsed.boundaryMode) _state.boundaryMode = parsed.boundaryMode;
    if (parsed.manualSunset) _state.manualSunset = parsed.manualSunset;
    if (parsed.marker)       _state.selectedMarker = parsed.marker;
    if (parsed.renderer)     _state.rendererMode = parsed.renderer;
    if (parsed.quality)      _state.quality      = parsed.quality;
    if (parsed.connectionMode) _state.connectionMode = parsed.connectionMode;
    if (parsed.motionMode)     _state.motionMode = parsed.motionMode;
    if (parsed.moonLabelDistance) _state.moonLabelDistance = parsed.moonLabelDistance;
    if (parsed.dayLabelMode)   _state.dayLabelMode = parsed.dayLabelMode;
    if (parsed.layers) {
      for (const k of Object.keys(_state.visibleLayers)) _state.visibleLayers[k] = false;
      for (const l of parsed.layers) _state.visibleLayers[l] = true;
    }
    // Restore camera from URL (validated in url-state module)
    if ((parsed.cameraTheta != null || parsed.cameraDist != null) &&
        globalThis.LivingTimeSphereCamera) {
      globalThis.LivingTimeSphereCamera.setState({
        theta: parsed.cameraTheta,
        dist:  parsed.cameraDist
      });
    }
  }

  // ── Quality resolution ─────────────────────────────────────────────

  function resolveQualityPreset() {
    const mat = globalThis.LivingTimeSphereM;
    if (!mat) return null;
    const q = _state.quality;
    if (q === "svgonly" || _state.rendererMode === "svg" ||
        _state.rendererMode === "table" || _state.rendererMode === "text") return null;
    if (q !== "auto" && mat.QUALITY_PRESETS[q]) return mat.QUALITY_PRESETS[q];
    // Auto: detect capabilities
    const reducedMotion = typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const webglAvailable = !!(globalThis.LivingTimeSphereEffects?.detectWebGl?.());
    const mem  = (typeof navigator !== "undefined" && navigator.deviceMemory) || 4;
    const sw   = typeof window !== "undefined" ? window.innerWidth : 1024;
    return mat.resolveAutoPreset({ reducedMotion, deviceMemoryGb: mem, screenWidth: sw, webglAvailable });
  }

  // ── Renderer mode resolution ───────────────────────────────────────

  function shouldUse3d() {
    if (_state.rendererMode === "svg" || _state.rendererMode === "table" || _state.rendererMode === "text") return false;
    if (_state.quality === "svgonly") return false;
    if (!globalThis.LivingTimeSphereRenderer3d || !globalThis.LivingTimeSphereM || !globalThis.LivingTimeSphereEffects) return false;
    if (!globalThis.LivingTimeSphereEffects.detectWebGl()) return false;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches && _state.quality !== "high") return false;
    return _state.rendererMode === "3d" || _state.rendererMode === "auto";
  }

  // ── Container helpers ──────────────────────────────────────────────

  function getContainerSize(container) {
    if (typeof window === "undefined") return { w: 320, h: 320 };
    const rect = container.getBoundingClientRect();
    return { w: Math.max(rect.width  || 320, 100), h: Math.max(rect.height || 320, 100) };
  }

  function buildCurrentModel() {
    const opts = { year: _state.year, timeZone: _state.timeZone, boundaryMode: _state.boundaryMode, manualSunset: _state.manualSunset };
    const baseModel = (_state.viewMode === "today" || _state.viewMode === "pattern")
      ? globalThis.LivingTimeSphereModel.buildTodayModel(opts)
      : globalThis.LivingTimeSphereModel.buildYearModel(opts);
    return _decorateModel(baseModel);
  }

  function _readLocalSetting(key) {
    try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
  }

  function _writeLocalSetting(key, value) {
    try { globalThis.localStorage?.setItem(key, value); } catch { /* ignore */ }
  }

  function _resolveMoonLabelMode() {
    const stored = _readLocalSetting(MOON_LABEL_MODE_KEY);
    if (stored === "contextual" || stored === "all" || stored === "selected" || stored === "hidden") {
      return stored;
    }
    if (typeof window !== "undefined" && window.innerWidth < 640) return "contextual";
    return _state.moonLabelMode || "contextual";
  }

  function _resolveMoonLabelDistance() {
    if (typeof window !== "undefined" && window.innerWidth < 640) return "tight";
    return _state.moonLabelDistance || "standard";
  }

  function _pad(value) {
    return String(value).padStart(2, "0");
  }

  function _toIso(date) {
    return `${date.getUTCFullYear()}-${_pad(date.getUTCMonth() + 1)}-${_pad(date.getUTCDate())}`;
  }

  function _patternDateFromDayOfYear(year, dayOfYear) {
    const epoch = globalThis.PatternCalendar?.epochForYear?.(year);
    if (!epoch) return null;
    return new Date(epoch.getTime() + (Math.max(1, Math.min(364, dayOfYear || 1)) - 1) * DAY_MS);
  }

  function _currentSnapshot() {
    return globalThis.LivingTimeSphereLiveData?.getSnapshot?.({
      timeZone: _state.timeZone,
      boundaryMode: _state.boundaryMode,
      manualSunset: _state.manualSunset,
    }) || null;
  }

  function _resolveSelectedDayOfYear(baseModel) {
    const live = _currentSnapshot();
    const todayPatternYear = live?.pattern?.patternYear ?? baseModel?.todayPatternPosition?.patternYear ?? null;
    const todayDay = live?.pattern?.dayOfPatternYear ?? baseModel?.todayPatternPosition?.dayOfPatternYear ?? null;

    if (_state.selectedDayOfYear == null) {
      _state.selectedDayOfYear = todayPatternYear === _state.year && todayDay ? todayDay : 1;
    }

    if (todayPatternYear !== _state.year && _state.selectedDayOfYear === todayDay && _state.viewMode === "today") {
      _state.selectedDayOfYear = 1;
    }

    _state.selectedDayOfYear = Math.max(1, Math.min(364, Number(_state.selectedDayOfYear) || 1));
    return _state.selectedDayOfYear;
  }

  function _resolveSelectedPatternPosition(baseModel) {
    const dayOfYear = _resolveSelectedDayOfYear(baseModel);
    const effectiveDate = _patternDateFromDayOfYear(_state.year, dayOfYear);
    const selected = effectiveDate && globalThis.PatternCalendar?.fromCivilDate
      ? globalThis.PatternCalendar.fromCivilDate({
          date: _toIso(effectiveDate),
          timeZone: _state.timeZone,
          boundaryMode: "midnight",
          sunsetTime: _state.manualSunset,
        })
      : null;
    const dayArchetype = Array.isArray(selected?.dayArchetype) ? selected.dayArchetype : [selected?.dayArchetype || null, ""];
    const weekGate = selected?.weekOfMoon
      ? globalThis.PatternCalendarData?.weekGates?.[selected.weekOfMoon - 1] || null
      : null;
    const moonData = selected?.moon != null
      ? globalThis.PatternCalendarData?.moons?.[selected.moon - 1] || null
      : null;
    const phase = globalThis.SOFCalendar?.getMoonPhase?.(_toIso(effectiveDate)) || null;
    const live = _currentSnapshot();
    const isToday = selected?.patternYear === live?.pattern?.patternYear
      && selected?.dayOfPatternYear != null
      && selected.dayOfPatternYear === live?.pattern?.dayOfPatternYear;
    const solar = globalThis.LivingTimeSphereLiveData?.getSnapshot?.({
      asOf: effectiveDate,
      timeZone: _state.timeZone,
      boundaryMode: "midnight",
      manualSunset: _state.manualSunset,
    })?.solar || live?.solar || null;

    return selected ? {
      ...selected,
      effectiveDate: _toIso(effectiveDate),
      civilDate: _toIso(effectiveDate),
      dateObject: effectiveDate,
      weekGate,
      moonData,
      daySeal: dayArchetype[0] || "Unavailable",
      daySealMeaning: dayArchetype[1] || "Unavailable",
      shabbat: selected.day != null && SHABBAT_DAYS.has(selected.day),
      lunarPhase: phase ? phase.name : (isToday ? live?.lunar?.phaseName : null),
      lunarIllumination: phase && typeof phase.illumination === "number"
        ? Number((phase.illumination * 100).toFixed(1))
        : (isToday ? live?.lunar?.illuminationPercent ?? null : null),
      solar,
      isToday,
      witnessPrompt: moonData?.practice || dayArchetype[1] || "Observe the day and record what is actually there.",
      shortMirror: moonData?.essence || "Mirror summary unavailable for this day.",
    } : null;
  }

  function _decorateModel(baseModel) {
    const live = _currentSnapshot();
    const selected = _resolveSelectedPatternPosition(baseModel);
    const activeMoon = selected?.moon ?? live?.pattern?.moon ?? baseModel?.todayPatternPosition?.moon ?? baseModel?.sourceRecord?.equinox?.patternPosition?.moon ?? 1;
    return {
      ...baseModel,
      selectedPatternPosition: selected,
      todayPatternPosition: live?.todayModel?.todayPatternPosition || baseModel?.todayPatternPosition || null,
      moonSectors: Array.isArray(baseModel?.moonSectors)
        ? baseModel.moonSectors.map(sector => ({ ...sector, active: sector.moonNumber === activeMoon }))
        : [],
    };
  }

  function _selectedDaySummary(selected) {
    if (!selected?.moon) return "Selected — Unavailable";
    return `${selected.isToday ? "Today" : "Selected"} — Moon ${selected.moon} · Day ${selected.day} · Day ${selected.dayOfPatternYear}/364`;
  }

  function _escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function _titleCaseWords(value) {
    return String(value || "")
      .split(/\s+/)
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  function _pluralize(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function _formatLocalInstant(value) {
    if (!value) return "Not recorded";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "Not recorded";
    try {
      return date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return date.toISOString();
    }
  }

  function _formatFreshness(value, now) {
    if (!value) return "Not checked";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "Not checked";
    const diffMs = Math.max(0, (now instanceof Date ? now : new Date(now)).getTime() - date.getTime());
    const diffMinutes = Math.round(diffMs / 60000);
    if (diffMinutes <= 1) return "Just updated";
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 48) return `${diffHours} h ago`;
    return `${Math.round(diffHours / 24)} d ago`;
  }

  function _readLocalJson(key) {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function _readMoonLogs() {
    const current = _readLocalJson(MOON_LOG_KEY);
    if (Array.isArray(current)) return current;
    const legacy = _readLocalJson(LEGACY_MOON_LOG_KEY);
    return Array.isArray(legacy) ? legacy : [];
  }

  function _buildMoonsLink(selected, hash = "") {
    const params = new URLSearchParams();
    if (selected?.effectiveDate) params.set("date", selected.effectiveDate);
    if (_state.timeZone) params.set("tz", _state.timeZone);
    if (_state.boundaryMode) params.set("boundary", _state.boundaryMode);
    if (_state.manualSunset) params.set("sunset", _state.manualSunset);
    const query = params.toString();
    return `moons.html${query ? `?${query}` : ""}${hash}`;
  }

  function _buildAlignmentLink(mode = "recurrence") {
    if (globalThis.AlignmentUrlState?.buildAlignmentShareLink) {
      return globalThis.AlignmentUrlState.buildAlignmentShareLink({
        baseUrl: typeof location !== "undefined" ? `${location.origin}${location.pathname.replace("living-time-sphere.html", "alignment-ledger.html")}` : "https://codexofreality.org/alignment-ledger.html",
        year: _state.year,
        timeZone: _state.timeZone,
        boundaryMode: _state.boundaryMode,
        manualSunset: _state.manualSunset,
        mode,
        datasetVersion: globalThis.LivingTimeSphereVersion?.version,
      });
    }
    return `alignment-ledger.html?year=${encodeURIComponent(_state.year)}&mode=${encodeURIComponent(mode)}`;
  }

  function _syncLayerCheckboxes() {
    Object.keys(_state.visibleLayers).forEach(layer => {
      const cb = document.getElementById(`sphere-layer-${layer}`);
      if (cb) cb.checked = !!_state.visibleLayers[layer];
    });
  }

  function _mappedLayerVisible(layerId) {
    if (!layerId) return false;
    if (Array.isArray(layerId)) return layerId.some(item => _mappedLayerVisible(item));
    return !!_state.visibleLayers[layerId];
  }

  function _setMappedLayer(layerId, enabled) {
    if (!layerId) return;
    if (Array.isArray(layerId)) {
      layerId.forEach(item => _setMappedLayer(item, enabled));
      return;
    }
    if (Object.prototype.hasOwnProperty.call(_state.visibleLayers, layerId)) {
      _state.visibleLayers[layerId] = enabled;
    }
  }

  function _applyFieldRangePreset(range) {
    const live = _currentSnapshot();
    _state.fieldRange = FIELD_RANGE_LABELS[range] ? range : "now";
    switch (_state.fieldRange) {
      case "today":
      case "now":
        _state.viewMode = "today";
        if (live?.pattern?.patternYear === _state.year && live?.pattern?.dayOfPatternYear) {
          _state.selectedDayOfYear = live.pattern.dayOfPatternYear;
          _state.selectedMarker = "today";
        }
        _state.visibleLayers.pattern = true;
        _state.visibleLayers.exactDays = true;
        _state.visibleLayers.weekGates = true;
        _state.visibleLayers.passage = true;
        _state.visibleLayers.lunar = true;
        _state.visibleLayers.connections = true;
        break;
      case "pattern-week":
        _state.viewMode = "pattern";
        _state.visibleLayers.pattern = true;
        _state.visibleLayers.weekGates = true;
        _state.visibleLayers.exactDays = true;
        _state.visibleLayers.connections = true;
        break;
      case "pattern-moon":
        _state.viewMode = "pattern";
        _state.visibleLayers.pattern = true;
        _state.visibleLayers.exactDays = true;
        _state.visibleLayers.lunar = true;
        _state.visibleLayers.markers = true;
        break;
      case "pattern-year":
        _state.viewMode = "years";
        _state.visibleLayers.pattern = true;
        _state.visibleLayers.passage = true;
        _state.visibleLayers.lunar = true;
        _state.visibleLayers.spiral = true;
        break;
      case "historical":
        _state.viewMode = "years";
        _state.visibleLayers.pattern = true;
        _state.visibleLayers.passage = true;
        _state.visibleLayers.lunar = true;
        _state.visibleLayers.recurrence = true;
        _state.visibleLayers.spiral = true;
        _state.visibleLayers.connections = true;
        break;
      default:
        break;
    }
  }

  function _syncFieldRangeButtons() {
    Object.keys(FIELD_RANGE_LABELS).forEach(range => {
      const btn = document.getElementById(`sphere-field-range-${range}`);
      if (btn) btn.setAttribute("aria-pressed", range === _state.fieldRange ? "true" : "false");
    });
  }

  function _resolveSavedObservation(selected) {
    const logs = _readMoonLogs();
    if (!logs.length) return null;
    const targetDate = selected?.effectiveDate || selected?.civilDate || "";
    return logs.find(entry => (entry?.effectiveDate || entry?.date) === targetDate)
      || (selected?.isToday ? logs[0] : null);
  }

  function _buildFieldLayerSnapshot(selected, model) {
    const live = _currentSnapshot();
    const now = new Date(live?.instant || Date.now());
    const yearRecord = model?.sourceRecord || live?.yearModel?.sourceRecord || null;
    const memory = globalThis.CodexMemory?.getState?.() || null;
    const observation = _resolveSavedObservation(selected);
    const witnessCount = Number(live?.witness?.count || 0);
    const recurrence = Array.isArray(live?.history?.recurrences) ? live.history.recurrences[0] : null;
    const providerConfigured = false;
    const environmentSource = providerConfigured ? "Live environment provider" : "No provider configured";
    const daylightState = selected?.afterBoundary
      ? `After ${_state.boundaryMode === "midnight" ? "midnight" : "boundary"}`
      : `Before ${_state.boundaryMode === "midnight" ? "midnight" : "boundary"}`;
    const bodySignalValue = [observation?.body, observation?.emotion].filter(Boolean).join(" · ");
    const patternTagValue = memory?.dailyIntention?.value
      ? _titleCaseWords(memory.dailyIntention.value)
      : (observation?.signs || "").trim();
    const recurrenceMissing = [];
    if (!providerConfigured) recurrenceMissing.push("weather");
    if (!witnessCount) recurrenceMissing.push("witness records");
    const recurrenceCompared = [
      "Pattern position",
      "Equinox angle",
      "Passage duration",
      "lunar state",
    ];
    const basePatternRelation = selected?.moon != null
      ? `Selected Pattern Day: Moon ${selected.moon} · Day ${selected.day}`
      : "Selected Pattern Day is outside the counted year";
    const historicalAvailability = recurrence
      ? `${recurrence.year} · ${Math.round(recurrence.overallSimilarityScore * 100)}%`
      : "Not available";
    const selectedWeek = selected?.weekOfMoon || (selected?.day ? Math.floor((selected.day - 1) / 7) + 1 : null);
    const personalFieldCount = [bodySignalValue, patternTagValue].filter(Boolean).length;
    const summaryItems = ["Pattern", "Lunar", "Passage", "Local boundary"];
    if (personalFieldCount) summaryItems.push(`${personalFieldCount} personal ${personalFieldCount === 1 ? "field" : "fields"}`);
    if (providerConfigured) summaryItems.push("Environment");

    const fields = [
      {
        id: "weather",
        label: "Weather",
        value: selected?.isToday ? "Not checked" : "Unavailable for this selected day",
        status: "Not checked",
        source: environmentSource,
        timestamp: "",
        freshness: "Not checked",
        availability: providerConfigured
          ? "Live provider is available."
          : "No provider is configured, so weather cannot be checked here.",
        relation: selected?.isToday
          ? "Current live field for the selected Pattern Day."
          : "Live weather is current-only and is not stored for non-current Pattern Days.",
        layerId: "environment",
        sphereLabel: "Environmental shell",
        visibleOnSphere: _mappedLayerVisible("environment"),
        comparison: "Not available",
        hierarchy: "Conditional",
      },
      {
        id: "temperature",
        label: "Temperature",
        value: selected?.isToday ? "Unavailable" : "Unavailable for this selected day",
        status: "Unavailable",
        source: environmentSource,
        timestamp: "",
        freshness: "Not checked",
        availability: "Temperature requires a live environment provider.",
        relation: selected?.isToday ? "Would apply to the selected Pattern Day now." : "No historical environment provider is configured.",
        layerId: "environment",
        sphereLabel: "Environmental intensity",
        visibleOnSphere: _mappedLayerVisible("environment"),
        comparison: "Not available",
        hierarchy: "Conditional",
      },
      {
        id: "wind",
        label: "Wind",
        value: selected?.isToday ? "Unavailable" : "Unavailable for this selected day",
        status: "Unavailable",
        source: environmentSource,
        timestamp: "",
        freshness: "Not checked",
        availability: "Wind requires a live environment provider.",
        relation: selected?.isToday ? "Would apply to the selected Pattern Day now." : "No historical environment provider is configured.",
        layerId: "environment",
        sphereLabel: "Directional stream",
        visibleOnSphere: _mappedLayerVisible("environment"),
        comparison: "Not available",
        hierarchy: "Conditional",
      },
      {
        id: "cloud",
        label: "Cloud",
        value: selected?.isToday ? "Unavailable" : "Unavailable for this selected day",
        status: "Unavailable",
        source: environmentSource,
        timestamp: "",
        freshness: "Not checked",
        availability: "Cloud cover requires a live environment provider.",
        relation: selected?.isToday ? "Would apply to the selected Pattern Day now." : "No historical environment provider is configured.",
        layerId: "environment",
        sphereLabel: "Atmospheric veil",
        visibleOnSphere: _mappedLayerVisible("environment"),
        comparison: "Not available",
        hierarchy: "Conditional",
      },
      {
        id: "pattern-moon",
        label: "Pattern Moon",
        value: selected?.moon != null ? `Moon ${selected.moon} · ${selected.moonName || "Unnamed"}` : "Outside counted year",
        status: "Calculated",
        source: "PatternCalendar",
        timestamp: live?.instant || "",
        freshness: "Current calculation",
        availability: "Always available from the calendar engine.",
        relation: basePatternRelation,
        layerId: "pattern",
        sphereLabel: "Pattern structure",
        visibleOnSphere: _mappedLayerVisible("pattern"),
        comparison: historicalAvailability,
        hierarchy: "Always available",
      },
      {
        id: "pattern-day",
        label: "Pattern Day",
        value: selected?.day != null ? `Day ${selected.day}${selected?.dayOfPatternYear != null ? ` · ${selected.dayOfPatternYear}/364` : ""}` : "Outside counted year",
        status: "Calculated",
        source: "PatternCalendar",
        timestamp: live?.instant || "",
        freshness: "Current calculation",
        availability: "Always available from the calendar engine.",
        relation: basePatternRelation,
        layerId: ["pattern", "exactDays"],
        sphereLabel: "Selected Pattern Day field",
        visibleOnSphere: _mappedLayerVisible(["pattern", "exactDays"]),
        comparison: historicalAvailability,
        hierarchy: "Always available",
      },
      {
        id: "week-gate",
        label: "Week Gate",
        value: selected?.weekGate?.[0] || "Unavailable",
        status: "Calculated",
        source: "PatternCalendarData",
        timestamp: live?.instant || "",
        freshness: "Current calculation",
        availability: "Always available from Pattern week mapping.",
        relation: selectedWeek ? `Week ${selectedWeek} of the selected Pattern Moon.` : basePatternRelation,
        layerId: "weekGates",
        sphereLabel: "Pattern structure",
        visibleOnSphere: _mappedLayerVisible("weekGates"),
        comparison: historicalAvailability,
        hierarchy: "Always available",
      },
      {
        id: "archetype",
        label: "Archetype",
        value: selected?.daySeal || "Unavailable",
        status: "Calculated",
        source: "PatternCalendarData",
        timestamp: live?.instant || "",
        freshness: "Current calculation",
        availability: "Always available from the canonical day archetype table.",
        relation: basePatternRelation,
        layerId: "pattern",
        sphereLabel: "Selected Pattern Day field",
        visibleOnSphere: _mappedLayerVisible("pattern"),
        comparison: historicalAvailability,
        hierarchy: "Always available",
      },
      {
        id: "tone",
        label: "Tone",
        value: selected?.daySeal || "Unavailable",
        status: "Calculated",
        source: "AlignmentLedgerData symbolic tone mapping",
        timestamp: live?.instant || "",
        freshness: "Current calculation",
        availability: "Always available as a symbolic layer tied to the selected Pattern Day.",
        relation: basePatternRelation,
        layerId: "connections",
        sphereLabel: "Selected Pattern Day field",
        visibleOnSphere: _mappedLayerVisible("connections"),
        comparison: historicalAvailability,
        hierarchy: "Always available",
      },
      {
        id: "sunset",
        label: _state.manualSunset === "18:00" ? "Sunset boundary" : "Local sunset",
        value: _state.manualSunset === "18:00"
          ? `Manual fallback · ${_state.manualSunset}`
          : `${_state.manualSunset || "18:00"}`,
        status: "Calculated",
        source: _state.manualSunset === "18:00" ? "Manual fallback" : "Configured boundary",
        timestamp: live?.instant || "",
        freshness: "Current calculation",
        availability: "Always available from the current boundary configuration.",
        relation: selected?.afterBoundary
          ? "The selected Pattern Day has already crossed the configured boundary."
          : "The selected Pattern Day has not yet crossed the configured boundary.",
        layerId: "solar",
        sphereLabel: "Local solar marker",
        visibleOnSphere: _mappedLayerVisible("solar"),
        comparison: "Not available",
        hierarchy: "Always available",
      },
      {
        id: "moon-phase",
        label: "Moon phase",
        value: selected?.lunarPhase || live?.lunar?.phaseName || "Unavailable",
        status: "Calculated",
        source: live?.lunar?.source || "AstronomySources.lunar",
        timestamp: live?.instant || "",
        freshness: "Current calculation",
        availability: "Always available from the astronomy dataset.",
        relation: basePatternRelation,
        layerId: "lunar",
        sphereLabel: "Lunar Position",
        visibleOnSphere: _mappedLayerVisible("lunar"),
        comparison: historicalAvailability,
        hierarchy: "Always available",
      },
      {
        id: "lunar-illumination",
        label: "Lunar illumination",
        value: selected?.lunarIllumination != null ? `${selected.lunarIllumination}%` : (live?.lunar?.illuminationPercent != null ? `${live.lunar.illuminationPercent}%` : "Unavailable"),
        status: "Calculated",
        source: live?.lunar?.source || "AstronomySources.lunar",
        timestamp: live?.instant || "",
        freshness: "Current calculation",
        availability: "Always available from the astronomy dataset.",
        relation: basePatternRelation,
        layerId: "lunar",
        sphereLabel: "Lunar Position",
        visibleOnSphere: _mappedLayerVisible("lunar"),
        comparison: historicalAvailability,
        hierarchy: "Always available",
      },
      {
        id: "passage",
        label: "Equinox Passage",
        value: live?.passage?.active
          ? `Active · ${live.passage.elapsed != null ? `${Number((live.passage.elapsed * 24).toFixed(1))} h elapsed` : "in progress"}`
          : `Inactive · ${live?.passage?.durationHours != null ? `${live.passage.durationHours} h span` : "duration unavailable"}`,
        status: "Calculated",
        source: "EquinoxPassageEngine",
        timestamp: yearRecord?.equinox?.utcInstant || live?.instant || "",
        freshness: "Canonical dataset",
        availability: "Always available from canonical Passage data.",
        relation: `Selected year ${_state.year} Passage state.`,
        layerId: "passage",
        sphereLabel: "Passage arc",
        visibleOnSphere: _mappedLayerVisible("passage"),
        comparison: historicalAvailability,
        hierarchy: "Always available",
      },
      {
        id: "solar-gate",
        label: "Nearest solar gate",
        value: selected?.solar?.gate ? `${selected.solar.gate} · ${selected.solar.element || "—"}` : "Unavailable",
        status: "Calculated",
        source: "LivingTimeSphereLiveData seasonal gate lookup",
        timestamp: live?.instant || "",
        freshness: "Current calculation",
        availability: "Always available from deterministic solar context lookup.",
        relation: basePatternRelation,
        layerId: "solar",
        sphereLabel: "Local solar marker",
        visibleOnSphere: _mappedLayerVisible("solar"),
        comparison: historicalAvailability,
        hierarchy: "Always available",
      },
      {
        id: "daylight-state",
        label: "Daylight state",
        value: daylightState,
        status: "Calculated",
        source: _state.boundaryMode === "midnight" ? "Midnight boundary" : "Configured sunset boundary",
        timestamp: live?.instant || "",
        freshness: "Current calculation",
        availability: "Always available from boundary state.",
        relation: basePatternRelation,
        layerId: "solar",
        sphereLabel: "Local solar marker",
        visibleOnSphere: _mappedLayerVisible("solar"),
        comparison: "Not available",
        hierarchy: "Always available",
      },
      {
        id: "boundary",
        label: "Configured boundary",
        value: _state.boundaryMode === "midnight" ? "Midnight boundary" : `Sunset boundary · ${_state.manualSunset || "18:00"}`,
        status: "Calculated",
        source: "Living Time Sphere settings",
        timestamp: live?.instant || "",
        freshness: "Current calculation",
        availability: "Always available from current Observatory settings.",
        relation: basePatternRelation,
        layerId: "markers",
        sphereLabel: "Boundary marker",
        visibleOnSphere: _mappedLayerVisible("markers"),
        comparison: "Not available",
        hierarchy: "Always available",
      },
      {
        id: "cached-environment",
        label: "Cached environment timestamp",
        value: live?.instant ? _formatLocalInstant(live.instant) : "No cached environment snapshot",
        status: "Cached",
        source: "LivingTimeSphereLiveData snapshot",
        timestamp: live?.instant || "",
        freshness: _formatFreshness(live?.instant, now),
        availability: "Always available as the current snapshot timestamp.",
        relation: "Indicates when this field layer snapshot was assembled.",
        layerId: "environment",
        sphereLabel: "Environmental shell",
        visibleOnSphere: _mappedLayerVisible("environment"),
        comparison: "Not available",
        hierarchy: "Always available",
      },
      {
        id: "kp",
        label: "Kp",
        value: "Unavailable",
        status: "Unavailable",
        source: "No geomagnetic provider configured",
        timestamp: "",
        freshness: "Not checked",
        availability: "Kp is conditional on a geomagnetic provider.",
        relation: selected?.isToday ? "Would apply to the current selected Pattern Day." : "Historical Kp is not available in this Observatory.",
        layerId: "environment",
        sphereLabel: "Geomagnetic shell",
        visibleOnSphere: _mappedLayerVisible("environment"),
        comparison: "Not available",
        hierarchy: "Conditional",
      },
      {
        id: "body-signal",
        label: "Body signal",
        value: bodySignalValue || "No body signal recorded",
        status: bodySignalValue ? "User logged" : "Unavailable",
        source: bodySignalValue ? "Local witness log" : "No body signal recorded",
        timestamp: observation?.saved || observation?.date || "",
        freshness: bodySignalValue ? _formatFreshness(observation?.saved || observation?.date, now) : "Not checked",
        availability: bodySignalValue
          ? "Saved local observation is available."
          : "No body signal has been recorded for this Pattern Day in local storage.",
        relation: selected?.effectiveDate
          ? `Matches local observation for ${selected.effectiveDate}.`
          : "No selected Pattern Day date is available.",
        layerId: "connections",
        sphereLabel: "Local personal field",
        visibleOnSphere: _mappedLayerVisible("connections"),
        comparison: witnessCount ? `${_pluralize(witnessCount, "saved record", "saved records")}` : "Not available",
        hierarchy: "Always available",
        actionHref: _buildMoonsLink(selected, "#bodyInput"),
        actionLabel: "Record Body Signal",
      },
      {
        id: "pattern-tag",
        label: "Pattern tag",
        value: patternTagValue || "No Pattern tag recorded",
        status: patternTagValue ? "User logged" : "Unavailable",
        source: memory?.dailyIntention?.value
          ? "CodexMemory intention"
          : (patternTagValue ? "Local witness log" : "No Pattern tag recorded"),
        timestamp: memory?.dailyIntention?.selectedAt || observation?.saved || "",
        freshness: patternTagValue ? _formatFreshness(memory?.dailyIntention?.selectedAt || observation?.saved, now) : "Not checked",
        availability: patternTagValue
          ? "Saved Pattern tag is available."
          : "No Pattern tag has been saved for this Pattern Day in local storage.",
        relation: basePatternRelation,
        layerId: "connections",
        sphereLabel: "Selected Pattern Day field",
        visibleOnSphere: _mappedLayerVisible("connections"),
        comparison: historicalAvailability,
        hierarchy: "Always available",
        actionHref: _buildMoonsLink(selected, "#signsInput"),
        actionLabel: "Add Pattern Tag",
      },
      {
        id: "witness",
        label: "Witness",
        value: `${_pluralize(witnessCount, "saved record", "saved records")}${live?.witness?.label && witnessCount ? ` · ${live.witness.label}` : ""}`,
        status: witnessCount ? "User logged" : "Unavailable",
        source: live?.witness?.source === "CodexMemory" ? "Local browser witness storage" : "Witness storage unavailable",
        timestamp: live?.witness?.date || "",
        freshness: live?.witness?.date ? _formatFreshness(live.witness.date, now) : "Not checked",
        availability: witnessCount
          ? "Saved witness records are available in this browser."
          : "No local witness records are saved yet in this browser.",
        relation: basePatternRelation,
        layerId: "connections",
        sphereLabel: "Witness constellation",
        visibleOnSphere: _mappedLayerVisible("connections"),
        comparison: witnessCount ? `${_pluralize(witnessCount, "local witness", "local witnesses")}` : "Not available",
        hierarchy: "Always available",
        actionHref: live?.links?.witness || "./ledger.html",
        actionLabel: "Record Observation",
      },
      {
        id: "recurrence",
        label: "Recurrence",
        value: recurrence
          ? `${recurrence.year} · ${Math.round(recurrence.overallSimilarityScore * 100)}%`
          : "No supported recurrence above threshold",
        status: recurrence ? "Calculated" : "Unavailable",
        source: "AlignmentRecurrence",
        timestamp: live?.instant || "",
        freshness: "Canonical dataset",
        availability: recurrence
          ? "Historical comparison exists in the supported study range."
          : "No recurrence currently clears the supported similarity threshold.",
        relation: `Compares selected year ${_state.year} across the 2014–2026 study range.`,
        layerId: "recurrence",
        sphereLabel: "Historical connection line",
        visibleOnSphere: _mappedLayerVisible("recurrence"),
        comparison: recurrence
          ? `Compared dimensions: ${recurrenceCompared.join(", ")}${recurrenceMissing.length ? ` · Missing: ${recurrenceMissing.join(", ")}` : ""}`
          : "Not available",
        hierarchy: "Conditional",
        comparedDimensions: recurrenceCompared,
        missingDimensions: recurrenceMissing,
        actionHref: _buildAlignmentLink("recurrence"),
        actionLabel: "Open comparison",
      },
    ];

    const activeConnectionCount = fields.filter(field => field.visibleOnSphere && field.status !== "Unavailable" && field.status !== "Not checked").length;

    return {
      rangeLabel: FIELD_RANGE_LABELS[_state.fieldRange] || FIELD_RANGE_LABELS.now,
      summaryItems,
      fields,
      activeConnectionCount,
      livingContext: {
        witness: `${_pluralize(witnessCount, "saved record", "saved records")}${live?.witness?.label && witnessCount ? ` · ${live.witness.label}` : ""}`,
        environment: `${live?.environment?.online === false ? "Offline" : "Online"} · ${providerConfigured ? "live provider active" : "live provider unavailable"}`,
        recurrence: recurrence
          ? `Closest supported recurrence: ${recurrence.year} · ${Math.round(recurrence.overallSimilarityScore * 100)}%`
          : "Closest supported recurrence: Not available",
        selectedPatternPosition: selected?.moon != null ? `Moon ${selected.moon} · Day ${selected.day}` : "Outside counted year",
        solarContext: selected?.solar?.gate ? `${selected.solar.gate} · ${selected.solar.element || "—"}` : "Unavailable",
        lunarContext: selected?.lunarPhase || live?.lunar?.phaseName || "Unavailable",
        fieldConnections: `${activeConnectionCount} active`,
      },
      sources: {
        patternEngineVersion: globalThis.PatternCalendarVersion?.version || "pattern-calendar/1.0.0",
        astronomyDatasetVersion: globalThis.AstronomySources?.sourceMetadata?.datasetVersion || globalThis.AstronomyVersion?.version || "astronomy/1.0.0",
        environmentProvider: environmentSource,
        lastEnvironmentUpdate: live?.instant || "",
        sunsetSource: _state.manualSunset === "18:00" ? "Manual fallback" : "Configured local boundary",
        lunarCalculationSource: globalThis.AstronomySources?.sources?.lunar?.label || live?.lunar?.source || "Lunar calculation unavailable",
        witnessStorageState: live?.witness?.source === "CodexMemory" ? `Local browser storage · ${_pluralize(witnessCount, "record", "records")}` : "Local browser storage unavailable",
        recurrenceDatasetRange: (() => {
          const years = globalThis.AlignmentLedgerData?.listSupportedYears?.() || [];
          return years.length ? `${years[0]}–${years[years.length - 1]}` : "Unavailable";
        })(),
      },
      providerConfigured,
    };
  }

  function _fieldLayerSnapshot(selected, model) {
    return _buildFieldLayerSnapshot(selected, model);
  }

  // ── Render dispatch ────────────────────────────────────────────────

  function renderSphere(container) {
    if (!container) return;

    // Show/hide data table and text summary views
    _updateAlternateViews();
    _syncModeButtons();
    _syncFieldRangeButtons();
    _syncLayerCheckboxes();

    const model    = buildCurrentModel();
    const spiral   = globalThis.LivingTimeSphereModel.buildSpiral({ timeZone: _state.timeZone, boundaryMode: _state.boundaryMode, manualSunset: _state.manualSunset });

    if (_state.rendererMode === "table" || _state.rendererMode === "text") {
      // Hide 3D / SVG canvas; show alternate view
      _teardown3d();
      container.style.display = "none";
      _updateRendererLabel(_state.rendererMode === "table" ? "Data Table" : "Text Summary");
      updateAccessibleText(model, spiral);
      updateDetails(model);
      _updateTodayDiagnostics(model);
      _updateModeSummary(model);
      _updateWhatAmISeeing(_state.viewMode);
      _updateStateStrip(_state.viewMode, model);
      return;
    }
    container.style.display = "";

    const { w, h } = getContainerSize(container);
    const dpr      = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
    const layout   = globalThis.LivingTimeSphereLayout.resolveLayout({ containerWidth: w, containerHeight: h, devicePixelRatio: dpr });

    if (shouldUse3d()) {
      _render3d(container, model, spiral);
    } else {
      _teardown3d();
      _renderSvgFallback(container, model, spiral, layout);
    }

    updateAccessibleText(model, spiral);
    updateDetails(model);
    _updateTodayDiagnostics(model);
    _updateModeSummary(model);
    _updateWhatAmISeeing(_state.viewMode);
    _updateStateStrip(_state.viewMode, model);
  }

  async function _render3d(container, model, spiral) {
    const preset = resolveQualityPreset();
    if (!preset) { _teardown3d(); return; }

    const renderer = globalThis.LivingTimeSphereRenderer3d;

    if (!renderer.isInitialized()) {
      // Prevent concurrent init: if one is already in progress (either in this module
      // or inside the renderer itself), skip and leave the in-progress call to finish.
      if (_state._3dInitInProgress || renderer.isInitializing?.()) return;
      _state._3dInitInProgress = true;

      // Remove any existing SVG / canvas content before inserting 3D canvas.
      container.innerHTML = "";
      _updateRendererLabel("Loading 3D renderer…");

      const reducedMotion = typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

      let result;
      try {
        result = await renderer.init({
          container,
          model,
          spiral,
          quality:       preset,
          selectedYear:  _state.year,
          visibleLayers: _state.visibleLayers,
          viewMode:      _state.viewMode,
          moonLabelMode: _state.moonLabelMode,
          moonLabelDistance: _state.moonLabelDistance,
          dayLabelMode: _state.dayLabelMode,
          connectionRegistry: globalThis.LivingTimeSphereConnections?.buildRegistry?.({ model, spiral, state: _state }) || [],
          motionMode: _state.motionMode,
          reducedMotion,
          onYearSelect: year => {
            _state.year = year;
            _state.viewMode = "passage";
            _setModeDefaultLayers("passage");
            _setModeDefaultSelectedMarker("passage");
            _syncModeButtons();
            _syncYearSelect(year);
            globalThis.LivingTimeSphereAccessibility?.announce?.(`Year ${year} selected. Passage view.`);
            renderSphere(container);
          },
          onMarkerSelect: marker => {
            if (!marker) return;
            if (marker.type === "day" && marker.dayOfPatternYear) {
              _state.selectedDayOfYear = marker.dayOfPatternYear;
              _state.selectedMarker = `day-${marker.dayOfPatternYear}`;
              globalThis.LivingTimeSphereAccessibility?.announce?.(`Selected Pattern Moon ${marker.moon}, Day ${marker.day}, Day ${marker.dayOfPatternYear} of 364.`);
              if (_state.viewMode === "years") {
                _state.viewMode = "pattern";
                _setModeDefaultLayers("pattern");
                _syncModeButtons();
              }
              renderSphere(container);
              return;
            }
            if (marker.type === "moon" && marker.moon) {
              const day = Math.max(1, Math.min(28, marker.day || 1));
              _state.selectedDayOfYear = (marker.moon - 1) * 28 + day;
              _state.selectedMarker = `moon-${marker.moon}`;
              globalThis.LivingTimeSphereAccessibility?.announce?.(`Selected Pattern Moon ${marker.moon}, Day ${day}.`);
              renderSphere(container);
              return;
            }
            _state.selectedMarker = marker?.type === "year" ? `eq-${marker.year}` : (marker?.type || null);
            renderSphere(container);
          }
        });
      } catch (err) {
        result = { success: false, reason: "init-exception", detail: String(err) };
      } finally {
        _state._3dInitInProgress = false;
      }

      if (!result || !result.success) {
        // Fall back to SVG.
        _state.active3d = false;
        const reason = result?.reason || "WebGL unavailable";
        const detail = result?.detail ? ` (${result.detail})` : "";
        const statusText = `SVG fallback — ${reason}${detail}`;
        _updateRendererLabel(statusText);
        // Sync the renderer selector so it accurately reflects the active renderer.
        _syncRendererSelect("svg");
        // Show the fallback warning row with Retry button.
        _showRendererFallbackWarning(reason, detail);
        // Remove any stale canvas element left by a failed init.
        const staleCanvas = container.querySelector(".living-time-sphere-3d-canvas");
        if (staleCanvas) staleCanvas.remove();
        const layout = globalThis.LivingTimeSphereLayout.resolveLayout({
          containerWidth:  container.offsetWidth  || 320,
          containerHeight: container.offsetHeight || 320,
          devicePixelRatio: (typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1)
        });
        _renderSvgFallback(container, model, spiral, layout);
        _updateInteractBar();
        _updateTodayDiagnostics(model);
        return;
      }
      _state.active3d = true;
      _updateRendererLabel("WebGL 3D active");
      _hideRendererFallbackWarning();
      _updateInteractBar();
      _updateRendererDiagnostics();
    } else {
      renderer.refresh(
        model,
        spiral,
        _state.year,
        _state.visibleLayers,
        _state.viewMode,
        _state.moonLabelMode,
        _state.moonLabelDistance,
        _state.dayLabelMode,
        globalThis.LivingTimeSphereConnections?.buildRegistry?.({ model, spiral, state: _state }) || [],
        _state.motionMode
      );
      renderer.setMode(_state.viewMode);
    }
  }

  function _teardown3d() {
    if (_state.active3d && globalThis.LivingTimeSphereRenderer3d?.isInitialized?.()) {
      globalThis.LivingTimeSphereRenderer3d.teardown();
    }
    _state.active3d = false;
    _state._3dInitInProgress = false;
    _updateInteractBar();
  }

  function _renderSvgFallback(container, model, spiral, layout) {
    // Canvas fallback
    if (_state.useCanvas && globalThis.LivingTimeSphereRendererCanvas?.isCanvasSupported?.()) {
      let canvas = container.querySelector(".living-time-sphere-canvas");
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.className = "living-time-sphere-canvas";
        container.innerHTML = "";
        container.appendChild(canvas);
      }
      const ok = globalThis.LivingTimeSphereRendererCanvas.renderCanvas({ canvas, model, spiral, layout, visibleLayers: _state.visibleLayers, selectedYear: _state.year });
      if (ok) { _updateRendererLabel("Canvas fallback"); }
      else _renderSvgOnly(container, model, spiral, layout);
    } else {
      _renderSvgOnly(container, model, spiral, layout);
    }
  }

  function _renderSvgOnly(container, model, spiral, layout) {
    _updateRendererLabel(_state.rendererMode === "svg" ? "Accessible SVG" : "SVG fallback");
    globalThis.LivingTimeSphereRendererSvg.renderInto(container, {
      model, spiral, layout,
      visibleLayers: _state.visibleLayers,
      selectedYear:  _state.year,
      viewMode:      _state.viewMode,
      moonLabelMode: _state.moonLabelMode,
      moonLabelDistance: _state.moonLabelDistance,
      dayLabelMode: _state.dayLabelMode,
      connectionRegistry: globalThis.LivingTimeSphereConnections?.buildRegistry?.({ model, spiral, state: _state }) || []
    });
  }

  // Keep the mobile interact bar in sync with the 3D renderer state.
  // The bar (and its "Exit Interaction" button) should only be active when
  // a real 3D canvas is running. In SVG mode it should stay hidden.
  function _updateInteractBar() {
    const bar         = document.querySelector(".sphere-interact-bar");
    const interactBtn = document.getElementById("sphere-interact-btn");
    const endBtn      = document.getElementById("sphere-interact-end-btn");
    const hintOff     = document.getElementById("sphere-hint-off");
    const hintOn      = document.getElementById("sphere-hint-on");
    if (!bar) return;
    // Show/hide the whole bar based on whether 3D is active.
    bar.style.display = _state.active3d ? "" : "none";
    // Always reset to the "Interact" state when the bar is re-shown.
    if (interactBtn) interactBtn.style.display = "";
    if (endBtn)      endBtn.style.display      = "none";
    if (hintOff)     hintOff.style.display     = "";
    if (hintOn)      hintOn.style.display      = "none";
  }

  function _updateAlternateViews() {
    // Reveal data table section
    const tableSection = document.getElementById("sphere-data-table-section");
    if (tableSection) tableSection.style.display = _state.rendererMode === "table" ? "" : "none";

    // Reveal text summary section
    const textSection  = document.getElementById("sphere-text-summary-section");
    if (textSection)  textSection.style.display  = _state.rendererMode === "text"  ? "" : "none";
  }

  // ── Renderer status label ──────────────────────────────────────────

  function _updateRendererLabel(status) {
    const el = document.getElementById("sphere-renderer-label");
    if (el) el.textContent = status;
  }

  // Sync the renderer <select> to reflect the actual active renderer.
  function _syncRendererSelect(activeRenderer) {
    const sel = document.getElementById("sphere-renderer-select");
    if (sel) sel.value = activeRenderer;
    _state.rendererMode = activeRenderer;
  }

  // Show the fallback warning banner with Retry / Switch-to-SVG buttons.
  function _showRendererFallbackWarning(reason, detail) {
    const el = document.getElementById("sphere-renderer-fallback-warning");
    if (!el) return;
    const reasonEl = el.querySelector(".sphere-fallback-reason");
    if (reasonEl) reasonEl.textContent = `3D unavailable — using SVG (${reason}${detail})`;
    // Populate inline diagnostics inside the collapsible details block.
    const r3d = globalThis.LivingTimeSphereRenderer3d;
    const diag = r3d?.getDiagnostics?.() || {};
    const _set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val || "—"; };
    _set("sphere-diag-local-url-warn",      diag.localModuleUrl || r3d?.THREE_LOCAL_REL || "—");
    _set("sphere-diag-last-error-warn",     diag.lastInitError ? `${diag.lastInitError.reason}: ${diag.lastInitError.detail || ""}` : (detail || "—"));
    _set("sphere-diag-module-source-warn",  diag.moduleSource || "none");
    _set("sphere-diag-webgl-warn",          diag.webglAvailable ? "available" : "unavailable");
    _set("sphere-diag-webgl2-warn",         diag.webgl2Available ? "available" : "unavailable");
    el.hidden = false;
  }

  function _hideRendererFallbackWarning() {
    const el = document.getElementById("sphere-renderer-fallback-warning");
    if (el) el.hidden = true;
  }

  // Update the renderer diagnostics panel (hidden by default; shown in Technical view).
  function _updateRendererDiagnostics() {
    const panel = document.getElementById("sphere-renderer-diagnostics");
    if (!panel) return;
    const r3d = globalThis.LivingTimeSphereRenderer3d;
    if (!r3d) return;
    const diag = r3d.getDiagnostics?.() || {};
    const rows = {
      "sphere-diag-requested":    "3d",
      "sphere-diag-active":       _state.active3d ? "WebGL 3D active" : (_state.rendererMode === "svg" ? "Accessible SVG" : "SVG fallback"),
      "sphere-diag-fallback":     _state.active3d ? "none" : (diag.lastInitError?.reason || "none"),
      "sphere-diag-webgl":        diag.webglAvailable ? "available" : "unavailable",
      "sphere-diag-webgl2":       diag.webgl2Available ? "available" : "unavailable",
      "sphere-diag-lib-version":  diag.threeVersion || r3d.THREE_VERSION || "—",
      "sphere-diag-module-source": diag.moduleSource || "none",
      "sphere-diag-local-url":    diag.localModuleUrl || r3d.THREE_LOCAL_REL || "—",
      "sphere-diag-canvas-size":  diag.canvasWidth && diag.canvasHeight ? `${diag.canvasWidth} × ${diag.canvasHeight}` : "—",
      "sphere-diag-dpr":          String(diag.devicePixelRatio || "—"),
      "sphere-diag-quality":      _state.quality,
      "sphere-diag-last-error":   diag.lastInitError ? `${diag.lastInitError.reason}: ${diag.lastInitError.detail || ""}` : "none",
    };
    for (const [id, val] of Object.entries(rows)) {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    }
  }

  // Update the Today diagnostics panel with the current model's today position.
  function _updateTodayDiagnostics(model) {
    const panel = document.getElementById("sphere-today-diagnostics");
    if (!panel) return;
    const tp = model?.todayPatternPosition;
    const rows = {
      "sphere-diag-today-civil":    tp?.civilDate     || "—",
      "sphere-diag-today-effective": tp?.effectiveDate || "—",
      "sphere-diag-today-tz":       _state.timeZone   || "—",
      "sphere-diag-today-boundary": _state.boundaryMode || "—",
      "sphere-diag-today-sunset":   _state.manualSunset || "—",
      "sphere-diag-today-position": tp?.moon != null
        ? `Moon ${tp.moon} · Day ${tp.day} · Day ${tp.dayOfPatternYear}/364`
        : (tp?.isDayOutOfTime ? "Day Out of Time" : (tp?.isDeepTimeDay ? "Deep Time Day" : "—")),
      "sphere-diag-today-angle":    model?.currentPatternAngle != null ? `${model.currentPatternAngle.toFixed(2)}°` : "—",
      "sphere-diag-today-source":   "PatternCalendar.fromCivilDate",
    };
    for (const [id, val] of Object.entries(rows)) {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    }
  }

  function _setModeDefaultLayers(mode) {
    if (mode === "today") {
      _state.visibleLayers.exactDays = true;
      _state.visibleLayers.weekGates = true;
      _state.visibleLayers.connections = true;
      _state.visibleLayers.spiral = false;
      _state.visibleLayers.recurrence = false;
      _state.visibleLayers.solar = false;
    } else if (mode === "pattern") {
      _state.visibleLayers.exactDays = true;
      _state.visibleLayers.weekGates = true;
      _state.visibleLayers.connections = true;
      _state.visibleLayers.spiral = false;
      _state.visibleLayers.recurrence = false;
    } else if (mode === "years") {
      _state.visibleLayers.exactDays = false;
      _state.visibleLayers.weekGates = false;
      _state.visibleLayers.connections = true;
      _state.visibleLayers.spiral = true;
    } else if (mode === "passage") {
      _state.visibleLayers.exactDays = true;
      _state.visibleLayers.weekGates = true;
      _state.visibleLayers.connections = true;
      _state.visibleLayers.spiral = false;
    }
    Object.keys(_state.visibleLayers).forEach(layer => {
      const cb = document.getElementById(`sphere-layer-${layer}`);
      if (cb) cb.checked = _state.visibleLayers[layer];
    });
  }

  function _updateModeSummary(model) {
    const el = document.getElementById("sphere-mode-summary");
    if (!el) return;
    const mode = _state.viewMode;
    const selected = model?.selectedPatternPosition || _resolveSelectedPatternPosition(model);
    const selectedLabel = selected?.moon != null
      ? `Moon ${selected.moon} · Day ${selected.day} · Day ${selected.dayOfPatternYear}/364`
      : "Unavailable";
    if (mode === "today") {
      el.textContent = _selectedDaySummary(selected);
    } else if (mode === "passage") {
      const tp = model?.sourceRecord?.equinox?.patternPosition || {};
      el.textContent = `${model?.year || "—"} Equinox Passage · Moon ${tp.moon || "—"} · Day ${tp.day || "—"} → Year Gate · ${selectedLabel}`;
    } else if (mode === "years") {
      el.textContent = `2014–2026 Alignment Spiral · Year ${_state.year} · ${selectedLabel}`;
    } else if (mode === "pattern") {
      el.textContent = `13 Moons × 28 Days · ${selectedLabel}`;
    }
  }

  function _updateWhatAmISeeing(mode) {
    const el = document.getElementById("sphere-what-am-i-seeing-body");
    if (!el) return;
    const selected = _resolveSelectedPatternPosition(buildCurrentModel());
    const texts = {
      today:   `This view places the active Pattern day inside the fixed 13 × 28 calendar. The bright marker highlights ${selected?.moon != null ? `Moon ${selected.moon} Day ${selected.day}` : "the selected day"}, and the lunar marker remains independent of the Pattern ring.`,
      passage: "This view shows the distance between the March Equinox and Moon 1 Day 1 for the selected year. The passage arc, Year Gate, and selected day stay aligned to the same calendar engine.",
      years:   "This view compares the Equinox position and Passage duration across 2014–2026. Tap a year marker to inspect that year, while the selected day stays readable in the detail panel.",
      pattern: "This view shows the full 13 × 28 geometry. Day dots mark all 364 counted days, Shabbat gates, the selected day, and today without leaving the current visual system."
    };
    el.textContent = texts[mode] || "";
  }

  function _updateStateStrip(viewMode, model) {
    const strips = [
      document.getElementById("sphere-state-strip"),
      document.getElementById("sphere-current-status"),
    ].filter(Boolean);
    if (!strips.length) return;
    const year = _state.year || 2026;
    const selected = model?.selectedPatternPosition || _resolveSelectedPatternPosition(model);
    let text = "";
    if (viewMode === "today" && model) {
      text = _selectedDaySummary(selected);
    } else if (viewMode === "passage" && model) {
      const rec = model.sourceRecord;
      const startMoon = rec?.equinox?.patternPosition?.moon ?? "";
      const startDay  = rec?.equinox?.patternPosition?.day  ?? "";
      const selectedLabel = selected?.moon != null ? `Selected Moon ${selected.moon} Day ${selected.day}` : "Selected day unavailable";
      text = `${year} Passage · Moon ${startMoon} Day ${startDay} → Moon 1 Day 1 · ${selectedLabel}`;
    } else if (viewMode === "years") {
      const selectedLabel = selected?.moon != null ? `Moon ${selected.moon} · Day ${selected.day}` : "No day selected";
      text = `Alignment Spiral · 2014–2026 · Year ${year} · ${selectedLabel}`;
    } else if (viewMode === "pattern") {
      text = selected?.moon != null
        ? `13 Moons × 28 Days · Moon ${selected.moon} · Day ${selected.day} · Day ${selected.dayOfPatternYear}/364`
        : "13 Moons × 28 Days";
    }
    strips.forEach(strip => { strip.textContent = text; });
  }

  function _setModeDefaultSelectedMarker(mode) {
    if (mode === "today") _state.selectedMarker = "today";
    else if (mode === "passage") _state.selectedMarker = `eq-${_state.year}`;
    else if (mode === "years") _state.selectedMarker = `year-${_state.year}`;
    else if (mode === "pattern") _state.selectedMarker = "today";
  }

  function _syncModeButtons() {
    document.querySelectorAll("[id^='sphere-mode-']").forEach(b => b.setAttribute("aria-pressed", "false"));
    const active = document.getElementById(`sphere-mode-${_state.viewMode}`);
    if (active) active.setAttribute("aria-pressed", "true");
  }

  function _syncYearSelect(year) {
    const sel = document.getElementById("sphere-year-select");
    if (sel) sel.value = String(year);
  }

  // ── Accessible text ────────────────────────────────────────────────

  function updateAccessibleText(model, spiral) {
    const acc = globalThis.LivingTimeSphereAccessibility;
    let desc = "";
    if (_state.viewMode === "today")   desc = acc.buildTodayDescription(model);
    else if (_state.viewMode === "passage") desc = acc.buildPassageDescription(model);
    else if (_state.viewMode === "years")   desc = acc.buildSpiralDescription(spiral);
    else                                    desc = acc.buildYearDescription({ model });
    acc.populateTextModel("sphere-text-model", desc);
  }

  function updateDetails(model) {
    const el = document.getElementById("sphere-details");
    if (!el || !model) return;
    const selected = model.selectedPatternPosition || _resolveSelectedPatternPosition(model);
    const yearRecord = model.sourceRecord || {};
    const yearPos = yearRecord?.equinox?.patternPosition || {};
    const offs = yearRecord?.offsets || {};
    const field = _fieldLayerSnapshot(selected, model);
    const selectedLabel = selected?.moon != null ? `Moon ${selected.moon} · ${selected.moonName || "Unavailable"} · Day ${selected.day}` : "Unavailable";
    const day364 = selected?.dayOfPatternYear != null ? `Day ${selected.dayOfPatternYear}/364` : "Unavailable — selected day is outside the counted year.";
    const patternAngle = selected?.dayOfPatternYear != null
      ? `${globalThis.LivingTimeSphereModel.patternAngleForDayOfYear(selected.dayOfPatternYear).toFixed(1)}°`
      : "Unavailable";
    const shabbatLabel = selected?.moon == null
      ? "Unavailable — outside counted day set."
      : selected.shabbat
        ? "Shabbat Gate · Active"
        : `Common day · next Shabbat on Moon Day ${[2, 9, 16, 23].find(day => day > selected.day) || 2}`;
    const solarLabel = selected?.solar?.gate
      ? `${selected.solar.gate} · ${selected.solar.element || "—"}`
      : "Unavailable — solar layer not loaded for this date.";
    const seasonLabel = selected?.solar?.season?.label
      ? `${selected.solar.season.label} · ${Math.round((selected.solar.season.progress || 0) * 100)}%`
      : "Unavailable — seasonal progress not loaded.";
    const yearSummary = _state.viewMode === "years"
      ? `<div class="sphere-details-section">
          <h4 class="sphere-details-subheading">Year layer</h4>
          <dl class="sphere-details-grid">
            <dt>Selected year</dt><dd>${_escapeHtml(_state.year)}</dd>
            <dt>Equinox Gate</dt><dd>Moon ${_escapeHtml(yearPos.moon || "—")} · Day ${_escapeHtml(yearPos.day || "—")}</dd>
            <dt>Year Gate</dt><dd>Moon 1 · Day 1 · April 17, 2026 anchor</dd>
            <dt>Passage span</dt><dd>${_escapeHtml(Number(((offs.equinoxToYearGateDays || 0) * 24).toFixed(1)))} hours</dd>
            <dt>Equinox angle</dt><dd>${_escapeHtml(model.passageStartAngle?.toFixed(1) || "Unavailable")}°</dd>
          </dl>
        </div>`
      : "";

    const renderFieldCard = item => {
      const comparedDimensions = Array.isArray(item.comparedDimensions) && item.comparedDimensions.length
        ? `<li>${item.comparedDimensions.map(value => _escapeHtml(value)).join("</li><li>")}</li>`
        : "";
      const missingDimensions = Array.isArray(item.missingDimensions) && item.missingDimensions.length
        ? `<li>${item.missingDimensions.map(value => _escapeHtml(value)).join("</li><li>")}</li>`
        : "";
      const actionLink = item.actionHref && item.actionLabel
        ? `<a class="sphere-field-link" href="${_escapeHtml(item.actionHref)}">${_escapeHtml(item.actionLabel)}</a>`
        : "";
      const canToggle = !!item.layerId && item.status !== "Unavailable" && item.status !== "Not checked";
      const toggleLabel = canToggle
        ? `${item.visibleOnSphere ? "Hide on Sphere" : "Show on Sphere"}`
        : "Not available on Sphere";
      const toggleDisabled = canToggle ? "" : " disabled";
      return `<article class="sphere-field-card${item.hierarchy === "Always available" ? " is-core" : " is-conditional"}">
          <div class="sphere-field-head">
            <div>
              <h5 class="sphere-field-title">${_escapeHtml(item.label)}</h5>
              <p class="sphere-field-value">${_escapeHtml(item.value)}</p>
            </div>
            <div class="sphere-field-badges">
              <span class="sphere-status-chip sphere-status-${_escapeHtml(item.status.toLowerCase().replace(/\s+/g, "-"))}">${_escapeHtml(item.status)}</span>
              <span class="sphere-availability-chip">${_escapeHtml(item.hierarchy)}</span>
            </div>
          </div>
          <div class="sphere-field-meta">
            <div><span>Status</span><strong>${_escapeHtml(item.status)}</strong></div>
            <div><span>Source</span><strong>${_escapeHtml(item.source)}</strong></div>
            <div><span>Timestamp</span><strong>${_escapeHtml(item.timestamp ? _formatLocalInstant(item.timestamp) : "Not recorded")}</strong></div>
            <div><span>Freshness</span><strong>${_escapeHtml(item.freshness)}</strong></div>
            <div><span>Availability</span><strong>${_escapeHtml(item.availability)}</strong></div>
            <div><span>Pattern relation</span><strong>${_escapeHtml(item.relation)}</strong></div>
            <div><span>Sphere layer</span><strong>${_escapeHtml(item.sphereLabel)} · ${item.visibleOnSphere ? "On" : "Off"}</strong></div>
            <div><span>Historical comparison</span><strong>${_escapeHtml(item.comparison)}</strong></div>
          </div>
          <div class="sphere-field-actions">
            <button class="sphere-btn sphere-btn-sm" type="button" data-field-layer="${_escapeHtml(item.id)}"${toggleDisabled}>${_escapeHtml(toggleLabel)}</button>
            ${actionLink}
          </div>
          ${(comparedDimensions || missingDimensions) ? `<details class="sphere-field-details">
            <summary>Comparison details</summary>
            ${comparedDimensions ? `<div><strong>Compared dimensions</strong><ul class="sphere-inline-list">${comparedDimensions}</ul></div>` : ""}
            ${missingDimensions ? `<div><strong>Missing dimensions</strong><ul class="sphere-inline-list">${missingDimensions}</ul></div>` : ""}
          </details>` : ""}
        </article>`;
    };

    const fieldCards = field.fields.map(renderFieldCard).join("");
    const livingContextEntries = [
      ["Witness", field.livingContext.witness],
      ["Environment", field.livingContext.environment],
      ["Recurrence", field.livingContext.recurrence],
      ["Selected Pattern position", field.livingContext.selectedPatternPosition],
      ["Solar context", field.livingContext.solarContext],
      ["Lunar context", field.livingContext.lunarContext],
      ["Field connections", field.livingContext.fieldConnections],
    ].map(([label, value]) => `<dt>${_escapeHtml(label)}</dt><dd>${_escapeHtml(value)}</dd>`).join("");
    const sourcesEntries = [
      ["Pattern engine version", field.sources.patternEngineVersion],
      ["Astronomy dataset version", field.sources.astronomyDatasetVersion],
      ["Environment provider", field.sources.environmentProvider],
      ["Last environment update", field.sources.lastEnvironmentUpdate ? _formatLocalInstant(field.sources.lastEnvironmentUpdate) : "Not recorded"],
      ["Sunset source", field.sources.sunsetSource],
      ["Lunar calculation source", field.sources.lunarCalculationSource],
      ["Witness storage state", field.sources.witnessStorageState],
      ["Recurrence dataset range", field.sources.recurrenceDatasetRange],
    ].map(([label, value]) => `<dt>${_escapeHtml(label)}</dt><dd>${_escapeHtml(value)}</dd>`).join("");
    const refreshDisabled = field.providerConfigured ? "" : " disabled";
    const refreshHelp = field.providerConfigured
      ? "Live provider ready."
      : "Live data becomes available after a weather or geomagnetic provider is configured.";

    el.innerHTML = `
      <h3 class="sphere-details-heading">${_escapeHtml(_selectedDaySummary(selected))}</h3>
      <div class="sphere-details-section">
        <h4 class="sphere-details-subheading">Selected Day</h4>
        <dl class="sphere-details-grid">
          <dt>Pattern</dt><dd>${_escapeHtml(selectedLabel)}</dd>
          <dt>Day of 364</dt><dd>${_escapeHtml(day364)}</dd>
          <dt>Pattern angle</dt><dd>${_escapeHtml(patternAngle)}</dd>
          <dt>Pattern date</dt><dd>${_escapeHtml(selected?.effectiveDate || "Unavailable — date conversion failed.")}</dd>
          <dt>Day Seal</dt><dd>${_escapeHtml(selected?.daySeal || "Unavailable")} <span class="sphere-inline-note">${_escapeHtml(selected?.daySealMeaning || "")}</span></dd>
          <dt>Week Gate</dt><dd>${_escapeHtml(selected?.weekGate?.[0] || "Unavailable — week gate missing.")}</dd>
          <dt>Shabbat Gate</dt><dd>${_escapeHtml(shabbatLabel)}</dd>
          <dt>Lunar phase</dt><dd>${_escapeHtml(selected?.lunarPhase || "Unavailable — moon phase service not loaded.")}${selected?.lunarIllumination != null ? ` · ${_escapeHtml(selected.lunarIllumination)}%` : ""}</dd>
          <dt>Solar gate</dt><dd>${_escapeHtml(solarLabel)}</dd>
          <dt>Season gate</dt><dd>${_escapeHtml(seasonLabel)}</dd>
          <dt>Mirror summary</dt><dd>${_escapeHtml(selected?.shortMirror || "Unavailable — no mirror summary stored for this day.")}</dd>
          <dt>Witness prompt</dt><dd>${_escapeHtml(selected?.witnessPrompt || "Observe the day and record what is actually there.")}</dd>
        </dl>
      </div>
      <div class="sphere-details-section">
        <h4 class="sphere-details-subheading">Field Layer</h4>
        <div class="sphere-field-summary">
          <div>
            <p class="sphere-field-summary-label">Active Fields</p>
            <div class="sphere-field-summary-list">${field.summaryItems.map(item => `<span class="sphere-field-summary-pill">${_escapeHtml(item)}</span>`).join("")}</div>
          </div>
          <div class="sphere-actions sphere-actions-compact">
            <button class="sphere-btn sphere-btn-sm" type="button" data-sphere-action="open-field-map">Open Field Map</button>
            <button class="sphere-btn sphere-btn-sm" type="button" data-sphere-action="show-fields">Show on Sphere</button>
            <a class="sphere-btn sphere-btn-sm" href="${_escapeHtml(_buildAlignmentLink("recurrence"))}">Compare Fields</a>
          </div>
        </div>
        <p class="sphere-field-range-note">Range · ${_escapeHtml(field.rangeLabel)}</p>
        <div class="sphere-field-cards">${fieldCards}</div>
        <details class="sphere-field-disclosure">
          <summary>Sources and freshness</summary>
          <dl class="sphere-details-grid sphere-details-grid-tight">${sourcesEntries}</dl>
        </details>
        <div class="sphere-actions sphere-field-footer-actions">
          <button class="sphere-btn" type="button" data-sphere-action="refresh-live"${refreshDisabled}>Refresh Live Fields</button>
          <a class="sphere-btn" href="${_escapeHtml((field.fields.find(item => item.id === "witness")?.actionHref) || "./ledger.html")}">Record Observation</a>
          <button class="sphere-btn" type="button" data-sphere-action="open-field-map">Open Field Map</button>
          <button class="sphere-btn sphere-btn-primary" type="button" data-sphere-action="show-fields">Show Fields on Sphere</button>
          <a class="sphere-btn" href="${_escapeHtml(_buildAlignmentLink("recurrence"))}">Compare Historical Fields</a>
        </div>
        <p class="sphere-field-note">${_escapeHtml(refreshHelp)}</p>
      </div>
      ${yearSummary}
      <div class="sphere-details-section">
        <h4 class="sphere-details-subheading">Living context</h4>
        <dl class="sphere-details-grid">${livingContextEntries}</dl>
      </div>
      <p class="sphere-core-note"><strong>Pattern Core</strong> — the fixed center reflects the same 13 × 28 calendar engine used by Today, Passage, Years, and Pattern views.</p>`;

    el.querySelectorAll("[data-field-layer]").forEach(button => {
      button.addEventListener("click", () => {
        const id = button.getAttribute("data-field-layer");
        const item = field.fields.find(entry => entry.id === id);
        if (!item?.layerId) return;
        _setMappedLayer(item.layerId, !_mappedLayerVisible(item.layerId));
        _syncLayerCheckboxes();
        renderSphere(document.getElementById("sphere-container"));
      });
    });

    el.querySelectorAll("[data-sphere-action]").forEach(button => {
      button.addEventListener("click", () => {
        const action = button.getAttribute("data-sphere-action");
        if (action === "show-fields") {
          field.fields.forEach(item => {
            if (item.layerId && item.status !== "Unavailable" && item.status !== "Not checked") {
              _setMappedLayer(item.layerId, true);
            }
          });
          _syncLayerCheckboxes();
          renderSphere(document.getElementById("sphere-container"));
        } else if (action === "open-field-map") {
          const wrapper = document.getElementById("sphere-container");
          if (wrapper?.scrollIntoView) wrapper.scrollIntoView({ behavior: "smooth", block: "center" });
        } else if (action === "refresh-live" && field.providerConfigured) {
          renderSphere(document.getElementById("sphere-container"));
        }
      });
    });

    const openMoons = document.getElementById("sphere-day-open-moons");
    if (openMoons && selected?.effectiveDate) {
      openMoons.href = _buildMoonsLink(selected);
    }
  }

  // ── Control wiring ─────────────────────────────────────────────────

  function wireControls(container) {
    const syncDaySelectors = () => {
      const moonSel = document.getElementById("sphere-select-moon");
      const daySel = document.getElementById("sphere-select-day");
      if (!moonSel || !daySel) return;
      if (!moonSel.options.length) {
        moonSel.innerHTML = Array.from({ length: 13 }, (_, index) => `<option value="${index + 1}">Moon ${index + 1}</option>`).join("");
      }
      if (!daySel.options.length) {
        daySel.innerHTML = Array.from({ length: 28 }, (_, index) => `<option value="${index + 1}">Day ${index + 1}</option>`).join("");
      }
      const model = buildCurrentModel();
      const selected = model.selectedPatternPosition || _resolveSelectedPatternPosition(model);
      moonSel.value = String(selected?.moon || 1);
      daySel.value = String(selected?.day || 1);
    };

    const shiftSelectedDay = delta => {
      _state.selectedDayOfYear = Math.max(1, Math.min(364, (_state.selectedDayOfYear ?? _resolveSelectedDayOfYear(buildCurrentModel())) + delta));
      _state.selectedMarker = `day-${_state.selectedDayOfYear}`;
      renderSphere(container);
      syncDaySelectors();
    };

    const shiftSelectedMoon = delta => {
      const model = buildCurrentModel();
      const selected = model.selectedPatternPosition || _resolveSelectedPatternPosition(model);
      const currentMoon = selected?.moon || 1;
      const currentDay = selected?.day || 1;
      const nextMoon = ((currentMoon - 1 + delta + 13) % 13) + 1;
      _state.selectedDayOfYear = (nextMoon - 1) * 28 + currentDay;
      _state.selectedMarker = `moon-${nextMoon}`;
      renderSphere(container);
      syncDaySelectors();
    };

    // View mode buttons.
    ["today", "passage", "years", "pattern"].forEach(mode => {
      const btn = document.getElementById(`sphere-mode-${mode}`);
      if (!btn) return;
      btn.addEventListener("click", () => {
        _state.viewMode = mode;
        _setModeDefaultLayers(mode);
        _setModeDefaultSelectedMarker(mode);
        _syncModeButtons();
        if (_state.active3d) globalThis.LivingTimeSphereRenderer3d?.setMode(mode);
        renderSphere(container);
      });
    });

    // Year select.
    const yearSelect = document.getElementById("sphere-year-select");
    if (yearSelect) {
      const years = globalThis.AlignmentLedgerData.listSupportedYears();
      yearSelect.innerHTML = years.map(y => `<option value="${y}"${y === _state.year ? " selected" : ""}>${y}</option>`).join("");
      yearSelect.addEventListener("change", () => {
        const y = Number(yearSelect.value);
        if (y) {
          _state.year = y;
          if (_state.viewMode === "today" && _currentSnapshot()?.pattern?.patternYear !== y) {
            _state.selectedDayOfYear = 1;
          }
          renderSphere(container);
        }
      });
    }

    Object.keys(FIELD_RANGE_LABELS).forEach(range => {
      const btn = document.getElementById(`sphere-field-range-${range}`);
      if (!btn) return;
      btn.addEventListener("click", () => {
        _applyFieldRangePreset(range);
        _syncFieldRangeButtons();
        _syncModeButtons();
        _syncLayerCheckboxes();
        renderSphere(container);
      });
    });
    _syncFieldRangeButtons();

    [
      ["sphere-prev-day", () => shiftSelectedDay(-1)],
      ["sphere-next-day", () => shiftSelectedDay(1)],
      ["sphere-prev-moon", () => shiftSelectedMoon(-1)],
      ["sphere-next-moon", () => shiftSelectedMoon(1)],
    ].forEach(([id, handler]) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener("click", handler);
    });

    const moonSelect = document.getElementById("sphere-select-moon");
    const daySelect = document.getElementById("sphere-select-day");
    if (moonSelect) {
      moonSelect.addEventListener("change", () => {
        const moon = Math.max(1, Math.min(13, Number(moonSelect.value) || 1));
        const day = Math.max(1, Math.min(28, Number(daySelect?.value) || 1));
        _state.selectedDayOfYear = (moon - 1) * 28 + day;
        _state.selectedMarker = `moon-${moon}`;
        renderSphere(container);
      });
    }
    if (daySelect) {
      daySelect.addEventListener("change", () => {
        const moon = Math.max(1, Math.min(13, Number(moonSelect?.value) || 1));
        const day = Math.max(1, Math.min(28, Number(daySelect.value) || 1));
        _state.selectedDayOfYear = (moon - 1) * 28 + day;
        _state.selectedMarker = `day-${_state.selectedDayOfYear}`;
        renderSphere(container);
      });
    }
    syncDaySelectors();

    // Layer toggles.
    Object.keys(_state.visibleLayers).forEach(layer => {
      const cb = document.getElementById(`sphere-layer-${layer}`);
      if (!cb) return;
      cb.checked = _state.visibleLayers[layer];
      cb.addEventListener("change", () => {
        _state.visibleLayers[layer] = cb.checked;
        renderSphere(container);
      });
    });

    // Reset view.
    const resetBtn = document.getElementById("sphere-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (_state.active3d) {
          globalThis.LivingTimeSphereRenderer3d?.resetView();
          globalThis.LivingTimeSphereAnimation?.markDirty?.();
        } else {
          globalThis.LivingTimeSphereInteraction.resetView(container);
          renderSphere(container);
        }
      });
    }

    // Copy link.
    const copyBtn = document.getElementById("sphere-copy-link");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        const camState = globalThis.LivingTimeSphereCamera?.getState?.() || {};
        const link = globalThis.LivingTimeSphereUrlState.buildSphereUrl({
          year:          _state.year,
          viewMode:      _state.viewMode,
          layers:        Object.entries(_state.visibleLayers).filter(([, v]) => v).map(([k]) => k),
          timeZone:      _state.timeZone,
          boundaryMode:  _state.boundaryMode,
          manualSunset:  _state.manualSunset,
          datasetVersion: globalThis.LivingTimeSphereVersion?.version,
          renderer:      _state.active3d ? "3d" : "svg",
          quality:       _state.quality,
          connectionMode:_state.connectionMode,
          motionMode:    _state.motionMode,
          moonLabelDistance: _state.moonLabelDistance,
          dayLabelMode:  _state.dayLabelMode,
          cameraTheta:   camState.theta,
          cameraDist:    camState.dist,
        });
        navigator.clipboard?.writeText(link).catch(() => {});
        copyBtn.textContent = "Link copied";
        setTimeout(() => { copyBtn.textContent = "Copy Link"; }, 2000);
      });
    }

    // Export PNG.
    const pngBtn = document.getElementById("sphere-export-png");
    if (pngBtn && globalThis.LivingTimeSphereExport) {
      pngBtn.addEventListener("click", () => {
        if (_state.active3d && globalThis.LivingTimeSphereRenderer3d?.exportPng) {
          const dataUrl = globalThis.LivingTimeSphereRenderer3d.exportPng({ format: "square" });
          if (dataUrl) {
            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = `living-time-sphere-${_state.year}-3d.png`;
            a.click();
            return;
          }
        }
        globalThis.LivingTimeSphereExport.exportPng({ svgContainer: container, format: "square", year: _state.year, viewMode: _state.viewMode });
      });
    }

    // Renderer selector (3D / SVG / Table / Text)
    const rendererSelect = document.getElementById("sphere-renderer-select");
    if (rendererSelect) {
      rendererSelect.value = _state.rendererMode;
      rendererSelect.addEventListener("change", () => {
        const prev = _state.rendererMode;
        _state.rendererMode = rendererSelect.value || "auto";
        if (prev !== _state.rendererMode && (prev === "3d" || prev === "auto") && _state.active3d) {
          _teardown3d();
        }
        renderSphere(container);
      });
    }

    // Quality selector.
    const qualitySelect = document.getElementById("sphere-quality-select");
    if (qualitySelect) {
      qualitySelect.value = _state.quality;
      qualitySelect.addEventListener("change", () => {
        _state.quality = qualitySelect.value || "auto";
        if (_state.quality === "svgonly" && _state.active3d) {
          _teardown3d();
          renderSphere(container);
          return;
        }
        if (_state.active3d && globalThis.LivingTimeSphereRenderer3d?.isInitialized?.()) {
          const preset = resolveQualityPreset();
          if (preset) {
            globalThis.LivingTimeSphereRenderer3d.setQuality(preset);
          } else {
            _teardown3d();
            renderSphere(container);
          }
        } else {
          renderSphere(container);
        }
      });
    }

    const moonLabelMode = document.getElementById("sphere-moon-label-mode");
    if (moonLabelMode) {
      moonLabelMode.value = _state.moonLabelMode;
      moonLabelMode.addEventListener("change", () => {
        _state.moonLabelMode = moonLabelMode.value || "contextual";
        _writeLocalSetting(MOON_LABEL_MODE_KEY, _state.moonLabelMode);
        renderSphere(container);
      });
    }

    const moonLabelDistance = document.getElementById("sphere-moon-label-distance");
    if (moonLabelDistance) {
      moonLabelDistance.value = _state.moonLabelDistance;
      moonLabelDistance.addEventListener("change", () => {
        _state.moonLabelDistance = moonLabelDistance.value || "standard";
        renderSphere(container);
      });
    }

    const dayLabelMode = document.getElementById("sphere-day-label-mode");
    if (dayLabelMode) {
      dayLabelMode.value = _state.dayLabelMode;
      dayLabelMode.addEventListener("change", () => {
        _state.dayLabelMode = dayLabelMode.value || "key";
        renderSphere(container);
      });
    }

    const connectionMode = document.getElementById("sphere-connection-mode");
    if (connectionMode) {
      connectionMode.value = _state.connectionMode;
      connectionMode.addEventListener("change", () => {
        _state.connectionMode = connectionMode.value || "contextual";
        renderSphere(container);
      });
    }

    const motionMode = document.getElementById("sphere-motion-mode");
    if (motionMode) {
      motionMode.value = _state.motionMode;
      motionMode.addEventListener("change", () => {
        _state.motionMode = motionMode.value || "still";
        if (_state.active3d && globalThis.LivingTimeSphereRenderer3d?.isInitialized?.()) {
          globalThis.LivingTimeSphereRenderer3d.setQuality(resolveQualityPreset());
        }
        renderSphere(container);
      });
    }

    // "Interact with Sphere" button for small screens.
    // Only active in 3D mode — _updateInteractBar() hides the bar in SVG mode.
    const interactBtn = document.getElementById("sphere-interact-btn");
    if (interactBtn) {
      const endBtn   = document.getElementById("sphere-interact-end-btn");
      const hintOff  = document.getElementById("sphere-hint-off");
      const hintOn   = document.getElementById("sphere-hint-on");

      function _setInteractOff() {
        interactBtn.style.display = "";
        if (endBtn)    endBtn.style.display    = "none";
        if (hintOff)   hintOff.style.display   = "";
        if (hintOn)    hintOn.style.display     = "none";
      }
      function _setInteractOn() {
        interactBtn.style.display = "none";
        if (endBtn)    endBtn.style.display     = "";
        if (hintOff)   hintOff.style.display    = "none";
        if (hintOn)    hintOn.style.display      = "";
      }

      // Initialise to "off" state
      if (endBtn) endBtn.style.display = "none";

      interactBtn.addEventListener("click", () => {
        if (!_state.active3d) return;
        _setInteractOn();
      });
      if (endBtn) {
        endBtn.addEventListener("click", () => {
          _setInteractOff();
          container.dispatchEvent(new CustomEvent("sphere:interact-end", { bubbles: false }));
        });
      }
      // Listen for interact events from 3D renderer.
      container.addEventListener("sphere:interact-start", () => {
        if (!_state.active3d) return;
        _setInteractOn();
      });
      container.addEventListener("sphere:interact-end", () => {
        _setInteractOff();
      });
    }

    // Guided introduction.
    _wireIntro(container);

    // Camera preset buttons.
    ["reset", "focus", "pattern", "passage", "years"].forEach(cmd => {
      const btn = document.getElementById(`sphere-cam-${cmd}`);
      if (!btn) return;
      btn.addEventListener("click", () => {
        if (!_state.active3d) return;
        switch (cmd) {
          case "reset":   globalThis.LivingTimeSphereRenderer3d?.resetView(); break;
          case "pattern": globalThis.LivingTimeSphereRenderer3d?.setMode("pattern"); break;
          case "passage": globalThis.LivingTimeSphereRenderer3d?.setMode("passage"); break;
          case "years":   globalThis.LivingTimeSphereRenderer3d?.setMode("years"); break;
          default: break;
        }
        globalThis.LivingTimeSphereAnimation?.markDirty?.();
      });
    });

    // Sphere year-select events (from marker clicks).
    container.addEventListener("sphere:year-select", e => {
      const y = e.detail?.year;
      if (!y) return;
      _state.year = y;
      _state.viewMode = "passage";
      _syncYearSelect(y);
      globalThis.LivingTimeSphereAccessibility.announce(`Year ${y} selected. Switching to Passage view.`);
      renderSphere(container);
    });

    container.addEventListener("sphere:marker-select", e => {
      const marker = e.detail;
      if (!marker) return;
      if (marker.type === "day" && marker.dayOfPatternYear) {
        _state.selectedDayOfYear = marker.dayOfPatternYear;
        _state.selectedMarker = `day-${marker.dayOfPatternYear}`;
        globalThis.LivingTimeSphereAccessibility?.announce?.(`Selected Pattern Moon ${marker.moon}, Day ${marker.day}, Day ${marker.dayOfPatternYear} of 364.`);
        const moonSelect = document.getElementById("sphere-select-moon");
        const daySelect = document.getElementById("sphere-select-day");
        if (moonSelect) moonSelect.value = String(marker.moon || 1);
        if (daySelect) daySelect.value = String(marker.day || 1);
        renderSphere(container);
      } else if (marker.type === "moon" && marker.moon) {
        _state.selectedDayOfYear = (marker.moon - 1) * 28 + Math.max(1, Math.min(28, marker.day || 1));
        _state.selectedMarker = `moon-${marker.moon}`;
        globalThis.LivingTimeSphereAccessibility?.announce?.(`Selected Pattern Moon ${marker.moon}, Day ${Math.max(1, Math.min(28, marker.day || 1))}.`);
        const moonSelect = document.getElementById("sphere-select-moon");
        const daySelect = document.getElementById("sphere-select-day");
        if (moonSelect) moonSelect.value = String(marker.moon);
        if (daySelect) daySelect.value = String(Math.max(1, Math.min(28, marker.day || 1)));
        renderSphere(container);
      }
    });

    // ── Retry 3D / Clear cache / Switch to SVG ──────────────────────

    const retry3dBtn = document.getElementById("sphere-retry-3d");
    if (retry3dBtn) {
      retry3dBtn.addEventListener("click", async () => {
        // Dispose any partial state, reset renderer mode, attempt fresh init.
        if (globalThis.LivingTimeSphereRenderer3d?.isInitialized?.()) {
          globalThis.LivingTimeSphereRenderer3d.teardown();
        }
        _state.active3d = false;
        _state._3dInitInProgress = false;
        _state.rendererMode = "3d";
        const sel = document.getElementById("sphere-renderer-select");
        if (sel) sel.value = "3d";
        _updateRendererLabel("Retrying 3D renderer…");
        _hideRendererFallbackWarning();
        renderSphere(container);
      });
    }

    const clearCacheBtn = document.getElementById("sphere-clear-renderer-cache");
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener("click", async () => {
        if (typeof caches !== "undefined") {
          const keys = await caches.keys();
          for (const k of keys) await caches.delete(k);
          clearCacheBtn.textContent = "Cache cleared — reloading…";
          setTimeout(() => location.reload(), 800);
        } else {
          clearCacheBtn.textContent = "No cache API";
        }
      });
    }

    const switchSvgBtn = document.getElementById("sphere-switch-svg");
    if (switchSvgBtn) {
      switchSvgBtn.addEventListener("click", () => {
        if (globalThis.LivingTimeSphereRenderer3d?.isInitialized?.()) {
          globalThis.LivingTimeSphereRenderer3d.teardown();
        }
        _state.active3d = false;
        _state._3dInitInProgress = false;
        _state.rendererMode = "svg";
        const sel = document.getElementById("sphere-renderer-select");
        if (sel) sel.value = "svg";
        _hideRendererFallbackWarning();
        renderSphere(container);
      });
    }
  }

  // ── Guided introduction ───────────────────────────────────────────

  const INTRO_STEPS = [
    { title: "Pattern Time — fixed center",  body: "The 13 Moon Pattern structure remains fixed at the center. It does not move." },
    { title: "The Equinox moves",            body: "The March Equinox occurs at a different Pattern position each year. Astronomical cycles travel around fixed Pattern Time." },
    { title: "The Equinox Passage",          body: "The Passage arc connects the Equinox Gate to Moon 1 Day 1. Its length is the Equinox offset — measured in hours." },
    { title: "The lunar orbit",              body: "The lunar cycle moves independently around the Pattern ring. At the Equinox moment, the Moon occupies a distinct phase." },
    { title: "13 years of records",          body: "Annual markers from 2014–2026 form a 13-year spiral. Each year shares a different Passage length and lunar relationship." },
    { title: "The Alignment Ledger",         body: "The Ledger measures recurrence — when years share pattern alignments — without claiming causation." },
  ];

  let _introStep = 0;

  function _wireIntro(container) {
    const introEl    = document.getElementById("sphere-intro");
    if (!introEl) return;

    const replayBtn  = document.getElementById("sphere-intro-replay");
    const skipBtn    = document.getElementById("sphere-intro-skip");
    const nextBtn    = document.getElementById("sphere-intro-next");
    const titleEl    = document.getElementById("sphere-intro-title");
    const bodyEl     = document.getElementById("sphere-intro-body");
    const stepEl     = document.getElementById("sphere-intro-step");

    // Show intro only if not dismissed this session and 3D is active
    function maybeShowIntro() {
      const dismissed = globalThis.LivingTimeSphereAnimation?.isIntroDismissed?.() ?? true;
      if (!dismissed && _state.active3d && !_state.introShown) {
        _state.introShown = true;
        _introStep = 0;
        _showIntroStep(titleEl, bodyEl, stepEl);
        introEl.hidden = false;
      }
    }

    function _showIntroStep(titleEl, bodyEl, stepEl) {
      const step = INTRO_STEPS[_introStep];
      if (!step) return;
      if (titleEl) titleEl.textContent = step.title;
      if (bodyEl)  bodyEl.textContent  = step.body;
      if (stepEl)  stepEl.textContent  = `${_introStep + 1} / ${INTRO_STEPS.length}`;
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        _introStep++;
        if (_introStep >= INTRO_STEPS.length) {
          introEl.hidden = true;
          globalThis.LivingTimeSphereAnimation?.dismissIntro?.();
        } else {
          _showIntroStep(titleEl, bodyEl, stepEl);
          if (nextBtn && _introStep === INTRO_STEPS.length - 1) nextBtn.textContent = "Finish";
        }
      });
    }

    if (skipBtn) {
      skipBtn.addEventListener("click", () => {
        introEl.hidden = true;
        globalThis.LivingTimeSphereAnimation?.dismissIntro?.();
      });
    }

    if (replayBtn) {
      replayBtn.addEventListener("click", () => {
        _state.introShown = false;
        globalThis.LivingTimeSphereAnimation?.resetIntroForSession?.();
        _introStep = 0;
        _showIntroStep(titleEl, bodyEl, stepEl);
        if (nextBtn) nextBtn.textContent = "Next";
        introEl.hidden = false;
      });
    }

    // Show after 3D init (delayed slightly)
    setTimeout(maybeShowIntro, 800);
  }

  // ── Interaction wiring (SVG fallback) ─────────────────────────────

  function wireInteraction(container) {
    globalThis.LivingTimeSphereInteraction.init(container, {
      onRotate: () => { if (!_state.active3d) renderSphere(container); },
      onZoom:   () => { if (!_state.active3d) renderSphere(container); },
      onReset:  () => { if (!_state.active3d) renderSphere(container); }
    });
  }

  // ── Init ──────────────────────────────────────────────────────────

  function init() {
    if (!safeInit()) {
      console.warn("LivingTimeSphereUi: not all dependencies available");
      return;
    }
    applyUrlState();
    _state.moonLabelMode = _resolveMoonLabelMode();
    _state.moonLabelDistance = _resolveMoonLabelDistance();

    const container = document.getElementById("sphere-container");
    if (!container) return;

    // Auto-open Sphere Settings panel on non-mobile viewports.
    const settingsGroup = document.querySelector(".sphere-settings-group");
    if (settingsGroup && window.innerWidth >= 600) {
      settingsGroup.open = true;
    }
    _setModeDefaultLayers(_state.viewMode);
    if (!_state.selectedMarker) _setModeDefaultSelectedMarker(_state.viewMode);
    _syncModeButtons();

    // Hide the interact bar immediately — it will be shown only after
    // 3D init succeeds.  This prevents the "Exit Interaction" ghost state.
    _updateInteractBar();

    wireControls(container);
    wireInteraction(container);

    // Defer first render by one animation frame so the container has a
    // stable, non-zero bounding rect before 3D dimensions are measured.
    requestAnimationFrame(() => {
      renderSphere(container);
    });

    // Re-render on resize (debounced).
    let resizeTimer;
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => {
        // Skip resize re-renders while 3D is still initializing — a
        // mid-init resize would start a second concurrent init call.
        if (_state._3dInitInProgress) return;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (!_state.active3d) renderSphere(container);
        }, 150);
      }).observe(container);
    }
  }

  globalThis.LivingTimeSphereUi = Object.freeze({
    init,
    getState: () => Object.assign({}, _state),
    renderSphere: (container) => renderSphere(container || document.getElementById("sphere-container")),
  });
})();
