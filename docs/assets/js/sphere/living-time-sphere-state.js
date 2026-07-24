(() => {
  "use strict";

  const DEFAULT_TIME_ZONE = "America/Los_Angeles";
  const DEFAULT_BOUNDARY_MODE = "sunset";
  const DEFAULT_SUNSET = "18:00";
  const DEFAULT_RENDERER = "auto";
  const DEFAULT_QUALITY = "auto";
  const DEFAULT_MODE = "today";
  const DEFAULT_CONNECTION_MODE = "contextual";
  const DEFAULT_MOTION_MODE = "still";
  const DEFAULT_CAMERA_PRESET = "reset";
  const DEFAULT_MOON_LABEL_DISTANCE = "standard";
  const DEFAULT_MOON_LABEL_MODE = "contextual";
  const DEFAULT_DAY_LABEL_MODE = "key";

  const VALID_MODES = Object.freeze(["today", "pattern", "passage", "years"]);
  const VALID_RENDERERS = Object.freeze(["auto", "3d", "svg", "table", "text"]);
  const VALID_CONNECTION_MODES = Object.freeze(["off", "selected", "contextual", "full", "custom"]);
  const VALID_MOTION_MODES = Object.freeze(["still", "drift", "reduced"]);
  const VALID_CAMERA_PRESETS = Object.freeze(["reset", "top", "tilted", "edge", "focus", "overview", "detail", "spiral"]);
  const VALID_MOON_LABEL_MODES = Object.freeze(["contextual", "all", "selected", "hidden"]);
  const VALID_MOON_LABEL_DISTANCES = Object.freeze(["tight", "standard", "wide"]);
  const VALID_DAY_LABEL_MODES = Object.freeze(["key", "all", "selected", "hidden"]);

  const LAYER_REGISTRY = Object.freeze({
    pattern:     Object.freeze({ id: "pattern",     group: "Pattern",     label: "Pattern structure", public: true,  compactDefault: true }),
    exactDays:   Object.freeze({ id: "exactDays",   group: "Pattern",     label: "Exact days",        public: true,  compactDefault: true }),
    weekGates:   Object.freeze({ id: "weekGates",   group: "Pattern",     label: "Week Gates",        public: true,  compactDefault: true }),
    outsideDays: Object.freeze({ id: "outsideDays", group: "Pattern",     label: "Outside days",      public: true,  compactDefault: false }),
    lunar:       Object.freeze({ id: "lunar",       group: "Lunar",       label: "Lunar Position",    public: true,  compactDefault: true }),
    solar:       Object.freeze({ id: "solar",       group: "Solar",       label: "Solar",             public: true,  compactDefault: true }),
    passage:     Object.freeze({ id: "passage",     group: "Passage",     label: "Passage",           public: true,  compactDefault: true }),
    markers:     Object.freeze({ id: "markers",     group: "Historical",  label: "Annual markers",    public: true,  compactDefault: true }),
    spiral:      Object.freeze({ id: "spiral",      group: "Historical",  label: "Alignment Spiral",  public: true,  compactDefault: false }),
    recurrence:  Object.freeze({ id: "recurrence",  group: "Recurrence",  label: "Recurrence",        public: true,  compactDefault: false }),
    environment: Object.freeze({ id: "environment", group: "Environment", label: "Environment",       public: true,  compactDefault: false }),
    witness:     Object.freeze({ id: "witness",     group: "Witness",     label: "Witness",           public: false, compactDefault: false }),
    personal:    Object.freeze({ id: "personal",    group: "Personal",    label: "Personal",          public: false, compactDefault: false }),
    connections: Object.freeze({ id: "connections", group: "Connections", label: "Connections",       public: true,  compactDefault: true }),
  });

  const BASE_VISIBLE_LAYERS = Object.freeze({
    pattern: true,
    exactDays: true,
    weekGates: true,
    outsideDays: false,
    lunar: true,
    solar: false,
    passage: true,
    markers: true,
    spiral: false,
    recurrence: false,
    environment: false,
    witness: false,
    personal: false,
    connections: true,
  });

  const MODE_LAYER_DEFAULTS = Object.freeze({
    today: Object.freeze({
      pattern: true, exactDays: true, weekGates: true, outsideDays: false,
      lunar: true, solar: true, passage: true, markers: true,
      spiral: false, recurrence: false, environment: false, witness: false, personal: false, connections: true,
    }),
    pattern: Object.freeze({
      pattern: true, exactDays: true, weekGates: true, outsideDays: true,
      lunar: true, solar: true, passage: false, markers: true,
      spiral: false, recurrence: false, environment: false, witness: false, personal: false, connections: true,
    }),
    passage: Object.freeze({
      pattern: true, exactDays: true, weekGates: true, outsideDays: false,
      lunar: true, solar: true, passage: true, markers: true,
      spiral: false, recurrence: false, environment: false, witness: false, personal: false, connections: true,
    }),
    years: Object.freeze({
      pattern: true, exactDays: false, weekGates: false, outsideDays: false,
      lunar: false, solar: true, passage: true, markers: true,
      spiral: true, recurrence: true, environment: false, witness: false, personal: false, connections: true,
    }),
  });

  function _pick(value, valid, fallback) {
    return valid.includes(value) ? value : fallback;
  }

  function _cloneLayers(input) {
    const out = { ...BASE_VISIBLE_LAYERS };
    const source = input || {};
    Object.keys(LAYER_REGISTRY).forEach(key => {
      if (typeof source[key] === "boolean") out[key] = source[key];
    });
    return out;
  }

  function modeLayerDefaults(mode, compact) {
    const base = _cloneLayers(MODE_LAYER_DEFAULTS[_pick(mode, VALID_MODES, DEFAULT_MODE)]);
    if (compact) {
      base.spiral = false;
      base.recurrence = false;
      base.environment = false;
      base.witness = false;
      base.personal = false;
    }
    return base;
  }

  function createState(overrides = {}) {
    const compact = !!overrides.compact;
    const mode = _pick(overrides.mode, VALID_MODES, DEFAULT_MODE);
    const liveYear = new Date().getUTCFullYear();
    return Object.freeze({
      instant: overrides.instant || null,
      civilDate: overrides.civilDate || null,
      effectiveDate: overrides.effectiveDate || null,
      timeZone: overrides.timeZone || DEFAULT_TIME_ZONE,
      location: overrides.location || null,
      boundaryMode: overrides.boundaryMode || DEFAULT_BOUNDARY_MODE,
      manualSunset: overrides.manualSunset || DEFAULT_SUNSET,
      patternPosition: overrides.patternPosition || null,
      selectedDay: Number(overrides.selectedDay || overrides.selectedDayOfYear || 0) || null,
      selectedMoon: Number(overrides.selectedMoon || 0) || null,
      selectedYear: Number(overrides.selectedYear || overrides.year || liveYear) || liveYear,
      comparisonYear: Number(overrides.comparisonYear || 0) || null,
      mode,
      selectedMarker: overrides.selectedMarker || null,
      visibleLayers: _cloneLayers(overrides.visibleLayers || modeLayerDefaults(mode, compact)),
      connectionMode: _pick(overrides.connectionMode, VALID_CONNECTION_MODES, DEFAULT_CONNECTION_MODE),
      renderer: _pick(overrides.renderer, VALID_RENDERERS, DEFAULT_RENDERER),
      quality: overrides.quality || DEFAULT_QUALITY,
      motionMode: _pick(overrides.motionMode, VALID_MOTION_MODES, DEFAULT_MOTION_MODE),
      cameraPreset: _pick(overrides.cameraPreset, VALID_CAMERA_PRESETS, DEFAULT_CAMERA_PRESET),
      zoom: typeof overrides.zoom === "number" ? overrides.zoom : null,
      datasetVersion: overrides.datasetVersion || null,
      astronomicalState: overrides.astronomicalState || null,
      environmentalState: overrides.environmentalState || null,
      witnessState: overrides.witnessState || null,
      moonLabelMode: _pick(overrides.moonLabelMode, VALID_MOON_LABEL_MODES, DEFAULT_MOON_LABEL_MODE),
      moonLabelDistance: _pick(overrides.moonLabelDistance, VALID_MOON_LABEL_DISTANCES, DEFAULT_MOON_LABEL_DISTANCE),
      dayLabelMode: _pick(overrides.dayLabelMode, VALID_DAY_LABEL_MODES, DEFAULT_DAY_LABEL_MODE),
      compact,
    });
  }

  function mergeState(state, patch = {}) {
    const base = state ? { ...state, visibleLayers: _cloneLayers(state.visibleLayers) } : {};
    if (patch.visibleLayers) {
      base.visibleLayers = _cloneLayers({ ...base.visibleLayers, ...patch.visibleLayers });
    }
    return createState({ ...base, ...patch, visibleLayers: base.visibleLayers });
  }

  function toPublicUrlState(state) {
    const src = state || createState();
    const layers = Object.keys(src.visibleLayers || {}).filter(key => src.visibleLayers[key] && LAYER_REGISTRY[key]?.public !== false);
    return {
      year: src.selectedYear,
      viewMode: src.mode,
      layers,
      timeZone: src.timeZone,
      boundaryMode: src.boundaryMode,
      manualSunset: src.manualSunset,
      marker: src.selectedMarker,
      renderer: src.renderer === "auto" ? null : src.renderer,
      quality: src.quality,
      connectionMode: src.connectionMode,
      cameraPreset: src.cameraPreset,
      zoom: src.zoom,
      datasetVersion: src.datasetVersion,
    };
  }

  globalThis.LivingTimeSphereState = Object.freeze({
    LAYER_REGISTRY,
    BASE_VISIBLE_LAYERS,
    MODE_LAYER_DEFAULTS,
    VALID_MODES,
    VALID_RENDERERS,
    VALID_CONNECTION_MODES,
    VALID_MOTION_MODES,
    VALID_CAMERA_PRESETS,
    VALID_MOON_LABEL_MODES,
    VALID_MOON_LABEL_DISTANCES,
    VALID_DAY_LABEL_MODES,
    createState,
    mergeState,
    modeLayerDefaults,
    toPublicUrlState,
  });
})();
