(() => {
  "use strict";

  const EVENT_NAME = "sof:environment-change";

  const CLASSIFICATIONS = Object.freeze({
    LOCATION_NOT_SET: "LOCATION NOT SET",
    LOADING_WEATHER: "LOADING WEATHER",
    LIVE_WEATHER: "LIVE WEATHER",
    FORECAST: "FORECAST",
    HISTORICAL_FORECAST: "HISTORICAL FORECAST",
    REANALYSIS: "REANALYSIS",
    CACHED: "CACHED",
    OFFLINE: "OFFLINE",
    UNAVAILABLE: "UNAVAILABLE",
    ERROR: "ERROR",
  });

  const EMPTY_STATE = Object.freeze({
    status: "unavailable",
    reason: "location-not-set",
    classification: CLASSIFICATIONS.LOCATION_NOT_SET,
    providerConfigured: false,
    place: null,
    current: null,
    hourly: [],
    daily: [],
    airQuality: null,
    spaceWeather: null,
    fetchedAt: null,
    stale: false,
    provenance: "none",
  });

  let _state = EMPTY_STATE;
  const _subscribers = new Set();

  function _toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeEnvironmentState(input = {}) {
    const source = input || {};
    const current = source.current && typeof source.current === "object" ? { ...source.current } : null;
    const daily = source.daily && typeof source.daily === "object" ? { ...source.daily } : {};
    const normalized = {
      status: typeof source.status === "string" ? source.status : "unavailable",
      reason: typeof source.reason === "string" ? source.reason : "none",
      classification: source.classification || CLASSIFICATIONS.UNAVAILABLE,
      providerConfigured: !!source.providerConfigured,
      place: source.place && typeof source.place === "object" ? { ...source.place } : null,
      current,
      hourly: _toArray(source.hourly),
      daily: daily && typeof daily === "object" ? daily : {},
      airQuality: source.airQuality && typeof source.airQuality === "object" ? { ...source.airQuality } : null,
      spaceWeather: source.spaceWeather && typeof source.spaceWeather === "object" ? { ...source.spaceWeather } : null,
      fetchedAt: source.fetchedAt || source.updatedAt || null,
      stale: !!source.stale,
      provenance: source.provenance || source.provider || "none",
    };
    return Object.freeze(normalized);
  }

  function emitEnvironmentChange(state) {
    if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
    window.dispatchEvent(new CustomEvent(EVENT_NAME, {
      detail: {
        place: state.place,
        classification: state.classification,
        current: state.current,
        hourly: state.hourly,
        daily: state.daily,
        airQuality: state.airQuality,
        spaceWeather: state.spaceWeather,
        provenance: state.provenance,
        state,
      }
    }));
  }

  function setEnvironmentState(nextState) {
    _state = normalizeEnvironmentState(nextState);
    emitEnvironmentChange(_state);
    _subscribers.forEach(fn => { try { fn(_state); } catch {} });
    return _state;
  }

  function subscribe(fn, { immediate = true } = {}) {
    if (typeof fn !== "function") return () => {};
    _subscribers.add(fn);
    if (immediate) { try { fn(getEnvironmentState()); } catch {} }
    return () => _subscribers.delete(fn);
  }

  function getEnvironmentState() {
    return _state || EMPTY_STATE;
  }

  globalThis.SofEnvironmentState = Object.freeze({
    EVENT_NAME,
    CLASSIFICATIONS,
    EMPTY_STATE,
    normalizeEnvironmentState,
    setEnvironmentState,
    getEnvironmentState,
    emitEnvironmentChange,
    subscribe,
  });
})();
