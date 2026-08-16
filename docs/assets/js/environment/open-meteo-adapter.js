(() => {
  "use strict";

  const PLACES_KEY = "sof.environment.places.v1";
  const ACTIVE_PLACE_KEY = "sof.environment.activePlace.v1";
  const UNITS_KEY = "sof.environment.units.v1";
  const LEGACY_COORDS_KEY = "sof.environment.location.v1";
  const SNAPSHOT_KEY = "sof.environment.snapshot.v2";
  const DEFAULT_CURRENT_TTL_MS = 15 * 60 * 1000;
  const SEARCH_TIMEOUT_MS = 12000;

  let _lastResult = null;
  let _inFlight = null;
  let _inFlightKey = "";
  let _inFlightController = null;
  let _refreshGeneration = 0;
  let _sessionActivePlace = null;
  const _memoryStore = new Map();

  function _storageForKey(key) {
    try {
      // Place and weather continuity must survive navigation between the
      // homepage, calendar, and full Observatory. Keep all canonical
      // environment state in localStorage; memory remains the safe fallback.
      return globalThis.localStorage || null;
    } catch {
      return null;
    }
  }

  function safeRead(key) {
    try {
      const storage = _storageForKey(key);
      const raw = storage?.getItem?.(key) || _memoryStore.get(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      const raw = _memoryStore.get(key);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    }
  }

  function safeWrite(key, value) {
    try {
      const serialized = JSON.stringify(value);
      const storage = _storageForKey(key);
      storage?.setItem?.(key, serialized);
      // Mirror to sessionStorage for compatibility with existing tabs and
      // older builds while localStorage provides cross-page continuity.
      if (globalThis.sessionStorage && globalThis.sessionStorage !== storage) {
        globalThis.sessionStorage.setItem?.(key, serialized);
      }
      _memoryStore.set(key, serialized);
      return true;
    } catch {
      return false;
    }
  }

  function safeRemove(key) {
    try { globalThis.localStorage?.removeItem?.(key); } catch {}
    try { globalThis.sessionStorage?.removeItem?.(key); } catch {}
    _memoryStore.delete(key);
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function ageLabel(updatedAt) {
    if (!updatedAt) return "No data";
    const t = new Date(updatedAt).getTime();
    if (!Number.isFinite(t)) return "Unknown";
    const minutes = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (minutes <= 1) return "Just updated";
    return `${minutes} min ago`;
  }

  function normalizePlace(place) {
    const provider = globalThis.OpenMeteoForecastProvider;
    if (provider?.normalizePlace) return provider.normalizePlace(place);
    if (!place) return null;
    const latitude = Number(place.latitude);
    const longitude = Number(place.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {
      name: String(place.name || place.label || "Selected location"),
      region: place.region || null,
      country: place.country || null,
      timezone: place.timezone || null,
      latitude,
      longitude,
      source: place.source || place.mode || "manual"
    };
  }

  function locationLabel(place) {
    if (!place) return "Location not set";
    const bits = [place.name, place.region, place.country].filter(Boolean);
    if (bits.length) return bits.join(", ");
    return `${place.latitude.toFixed(3)}, ${place.longitude.toFixed(3)}`;
  }

  function placeKey(place) {
    if (!place || !Number.isFinite(Number(place.latitude)) || !Number.isFinite(Number(place.longitude))) return "none";
    return `${Number(place.latitude).toFixed(4)},${Number(place.longitude).toFixed(4)}`;
  }

  function freshCachedSnapshot(place) {
    const cached = safeRead(SNAPSHOT_KEY);
    if (!cached?.current || !cached?.place || placeKey(cached.place) !== placeKey(place) || cached.stale) return null;
    const updatedAt = new Date(cached.updatedAt || cached.fetchedAt || 0).getTime();
    if (!Number.isFinite(updatedAt)) return null;
    const providerTtl = Number(globalThis.OpenMeteoForecastProvider?.CURRENT_TTL_MS);
    const ttl = Number.isFinite(providerTtl) && providerTtl > 0 ? providerTtl : DEFAULT_CURRENT_TTL_MS;
    return Date.now() - updatedAt <= ttl ? cached : null;
  }

  function readPlaces() {
    const places = safeRead(PLACES_KEY);
    return Array.isArray(places) ? places.filter(Boolean) : [];
  }

  function writePlaces(places) {
    safeWrite(PLACES_KEY, places.slice(0, 20));
  }

  function readActivePlace() {
    if (_sessionActivePlace) return _sessionActivePlace;
    let place = normalizePlace(safeRead(ACTIVE_PLACE_KEY));
    if (place) return place;
    const legacy = normalizePlace(safeRead(LEGACY_COORDS_KEY));
    if (legacy) {
      setActivePlace(legacy);
      return legacy;
    }
    return null;
  }

  function listPlaces() {
    return readPlaces();
  }

  function savePlace(place) {
    const normalized = normalizePlace(place);
    if (!normalized) return null;
    const places = readPlaces();
    const key = `${normalized.latitude.toFixed(4)},${normalized.longitude.toFixed(4)}`;
    const deduped = [
      normalized,
      ...places.filter(item => `${Number(item.latitude).toFixed(4)},${Number(item.longitude).toFixed(4)}` !== key)
    ];
    writePlaces(deduped);
    return normalized;
  }

  function setActivePlace(place) {
    const normalized = savePlace(place);
    if (!normalized) return null;
    _sessionActivePlace = normalized;
    safeWrite(ACTIVE_PLACE_KEY, normalized);
    return normalized;
  }

  function getActivePlace() {
    return readActivePlace();
  }

  function setUnits(units) {
    const next = {
      temperature: units?.temperature === "fahrenheit" ? "fahrenheit" : "celsius",
      wind: units?.wind === "mph" ? "mph" : "kmh"
    };
    safeWrite(UNITS_KEY, next);
    return next;
  }

  function getUnits() {
    return safeRead(UNITS_KEY) || { temperature: "celsius", wind: "kmh" };
  }

  function mapSnapshot(result, place, { persist = true } = {}) {
    const classifications = globalThis.SofEnvironmentState?.CLASSIFICATIONS;
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    if (!result?.snapshot) {
      return {
        status: result?.errorMessage ? "error" : "unavailable",
        reason: place ? "provider-error" : "location-not-set",
        classification: !place
          ? (classifications?.LOCATION_NOT_SET || "LOCATION NOT SET")
          : (result?.errorMessage
              ? (classifications?.ERROR || "ERROR")
              : (classifications?.UNAVAILABLE || "UNAVAILABLE")),
        providerConfigured: !!place,
        statusLabel: place ? (result?.errorMessage || "Unavailable") : "Location required",
        source: "Open-Meteo",
        place,
        updatedAt: "",
        freshness: { stale: true, label: "No data", ageMinutes: null },
        current: null,
        hourly: null,
        daily: null,
        environmental: null,
        stale: true,
        errorMessage: result?.errorMessage || "",
        provenance: "open-meteo-adapter"
      };
    }

    const snap = result.snapshot;
    const updatedAt = snap.fetchedAt;
    const ageMinutes = result.ageMinutes;
    const stale = !!result.stale;
    const current = snap.current || {};
    const daily = snap.daily || {};

    const mapped = {
      status: stale ? (offline ? "offline" : "cached") : "available",
      reason: stale ? (offline ? "offline" : "stale-cache") : "live",
      classification: stale
        ? (offline ? (classifications?.OFFLINE || "OFFLINE") : (classifications?.CACHED || "CACHED"))
        : (classifications?.LIVE_WEATHER || "LIVE WEATHER"),
      provider: snap.provider,
      providerConfigured: !!place,
      statusLabel: stale ? "Cached snapshot" : "Live observation",
      source: snap.providerUrl || "https://api.open-meteo.com/v1/forecast",
      place,
      updatedAt,
      freshness: {
        stale,
        ageMinutes,
        label: ageLabel(updatedAt)
      },
      stale,
      staleReason: result.staleReason || "",
      errorMessage: result.errorMessage || "",
      current: {
        temperature: current.temperature_2m,
        apparentTemperature: current.apparent_temperature,
        humidity: current.relative_humidity_2m,
        dewPoint: current.dew_point_2m,
        precipitation: current.precipitation,
        rain: current.rain,
        snowfall: current.snowfall,
        weatherCode: current.weather_code,
        condition: current.condition,
        cloudCover: current.cloud_cover,
        pressure: current.pressure_msl,
        windSpeed: current.wind_speed_10m,
        windDirection: current.wind_direction_10m,
        windGust: current.wind_gusts_10m,
        solarRadiation: current.shortwave_radiation,
        isDay: current.is_day
      },
      hourly: snap.hourly,
      daily: {
        ...daily,
        sunrise: daily.sunrise,
        sunset: daily.sunset,
        daylightDurationSeconds: daily.daylight_duration,
        sunshineDurationSeconds: daily.sunshine_duration,
        tempMax: Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max[0] : daily.temperature_2m_max,
        tempMin: Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min[0] : daily.temperature_2m_min,
        precipProbability: Array.isArray(daily.precipitation_probability_max) ? daily.precipitation_probability_max[0] : daily.precipitation_probability_max,
        precipSum: Array.isArray(daily.precipitation_sum) ? daily.precipitation_sum[0] : daily.precipitation_sum,
        uvMax: Array.isArray(daily.uv_index_max) ? daily.uv_index_max[0] : daily.uv_index_max,
      },
      environmental: {
        locationName: locationLabel(place),
        condition: current.condition,
        provider: snap.provider,
        updateAgeMinutes: ageMinutes
      },
      provenance: "open-meteo-adapter"
    };

    if (persist) safeWrite(SNAPSHOT_KEY, mapped);
    return mapped;
  }

  function requestRefresh(options = {}) {
    const provider = globalThis.OpenMeteoForecastProvider;
    if (!provider?.getForecastSnapshot) {
      return Promise.resolve(mapSnapshot({ errorMessage: "Open-Meteo provider module unavailable." }, readActivePlace()));
    }

    const override = normalizePlace(options.coords || options.place);
    const place = override || readActivePlace();
    if (!place) {
      const empty = mapSnapshot({ errorMessage: "Location required." }, null);
      globalThis.SofEnvironmentState?.setEnvironmentState?.(empty);
      return Promise.resolve(empty);
    }

    const requestKey = placeKey(place);
    if (_inFlight && _inFlightKey === requestKey) return _inFlight;

    if (!options.force) {
      const cached = freshCachedSnapshot(place);
      if (cached) return Promise.resolve(cached);
    }

    // Force and background requests for the same coordinates deliberately share
    // one operation. The in-flight promise is installed before LOADING_WEATHER is
    // announced so a synchronous environment-change listener cannot recursively
    // start the same request and lock the main thread.
    const generation = ++_refreshGeneration;
    if (_inFlightController && _inFlightKey !== requestKey) {
      try { _inFlightController.abort(); } catch {}
    }
    const controller = new AbortController();
    const externalSignal = options.signal;
    const onExternalAbort = () => controller.abort();
    if (externalSignal?.aborted) controller.abort();
    else externalSignal?.addEventListener?.("abort", onExternalAbort, { once: true });

    _inFlightKey = requestKey;
    _inFlightController = controller;

    const task = Promise.resolve().then(async () => {
      if (generation === _refreshGeneration) {
        globalThis.SofEnvironmentState?.setEnvironmentState?.({
          status: "loading",
          reason: "request-refresh",
          classification: globalThis.SofEnvironmentState?.CLASSIFICATIONS?.LOADING_WEATHER || "LOADING WEATHER",
          providerConfigured: true,
          place,
          current: null,
          hourly: [],
          daily: [],
          airQuality: null,
          spaceWeather: null,
          fetchedAt: null,
          stale: false,
          provenance: "open-meteo-adapter",
        });
      }

      const result = await provider.getForecastSnapshot({
        place,
        force: !!options.force,
        signal: controller.signal
      });
      const isCurrent = generation === _refreshGeneration;
      if (isCurrent) _lastResult = result;
      const mapped = mapSnapshot(result, place, { persist: isCurrent });
      if (isCurrent) {
        globalThis.SofEnvironmentState?.setEnvironmentState?.(mapped);
      }
      return mapped;
    }).catch(error => {
      const isCurrent = generation === _refreshGeneration;
      const mapped = mapSnapshot(
        { errorMessage: String(error?.message || error || "Environmental request failed.") },
        place,
        { persist: isCurrent }
      );
      if (isCurrent) {
        globalThis.SofEnvironmentState?.setEnvironmentState?.(mapped);
      }
      return mapped;
    }).finally(() => {
      externalSignal?.removeEventListener?.("abort", onExternalAbort);
      if (generation === _refreshGeneration) {
        _inFlight = null;
        _inFlightKey = "";
        _inFlightController = null;
      }
    });

    _inFlight = task;
    return task;
  }

  function getSnapshot() {
    const place = readActivePlace();
    const cached = safeRead(SNAPSHOT_KEY);
    if (place && cached?.place && placeKey(cached.place) === placeKey(place)) return cached;
    return mapSnapshot(place ? _lastResult : null, place);
  }

  function bootstrapEnvironmentState({ refresh = true } = {}) {
    const cached = safeRead(SNAPSHOT_KEY);
    const place = readActivePlace();
    if (cached && place && cached?.place && placeKey(cached.place) === placeKey(place)) {
      const hydrated = { ...cached, place, providerConfigured: true };
      globalThis.SofEnvironmentState?.setEnvironmentState?.(hydrated);
      if (refresh) requestRefresh({ force: false }).catch(() => {});
      return hydrated;
    }
    const empty = mapSnapshot(null, place);
    globalThis.SofEnvironmentState?.setEnvironmentState?.(empty);
    if (place && refresh) requestRefresh({ force: false }).catch(() => {});
    return empty;
  }

  function validLatLon(latitude, longitude) {
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return {
      latitude: clamp(lat, -90, 90),
      longitude: clamp(lon, -180, 180)
    };
  }

  function setManualCoordinates(latitude, longitude, name = "Manual coordinates") {
    const value = validLatLon(latitude, longitude);
    if (!value) return false;
    const place = {
      name: String(name || "Manual coordinates"),
      latitude: value.latitude,
      longitude: value.longitude,
      source: "manual"
    };
    return !!setActivePlace(place);
  }

  async function requestDeviceLocation() {
    if (!("geolocation" in navigator)) {
      throw new Error("Geolocation is unavailable on this device.");
    }
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 5 * 60 * 1000,
      });
    });
    const place = {
      name: "Device location",
      latitude: Number(position.coords.latitude),
      longitude: Number(position.coords.longitude),
      source: "device"
    };
    const normalized = normalizePlace(place);
    if (!normalized) return false;
    setActivePlace(normalized);
    return true;
  }

  async function searchCity(query, signal) {
    const q = String(query || "").trim();
    if (!q) return [];
    const params = new URLSearchParams({
      name: q,
      count: "8",
      language: "en",
      format: "json"
    });
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener?.("abort", onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener?.("abort", onAbort);
    }
    if (!response.ok) {
      throw new Error(`Place search failed (${response.status}).`);
    }
    const payload = await response.json();
    const rows = Array.isArray(payload?.results) ? payload.results : [];
    return rows.map(row => ({
      name: row.name || "Unknown place",
      region: row.admin1 || row.admin2 || null,
      country: row.country || null,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      timezone: row.timezone || null,
      source: "search"
    })).filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
  }

  function continueWithoutLocation() {
    ++_refreshGeneration;
    try { _inFlightController?.abort?.(); } catch {}
    _inFlight = null;
    _inFlightKey = "";
    _inFlightController = null;
    safeRemove(ACTIVE_PLACE_KEY);
    safeRemove(LEGACY_COORDS_KEY);
    safeRemove(SNAPSHOT_KEY);
    _sessionActivePlace = null;
    globalThis.SofEnvironmentState?.setEnvironmentState?.({
      status: "unavailable",
      reason: "location-not-set",
      classification: globalThis.SofEnvironmentState?.CLASSIFICATIONS?.LOCATION_NOT_SET || "LOCATION NOT SET",
      providerConfigured: false,
      place: null,
      current: null,
      hourly: [],
      daily: [],
      airQuality: null,
      spaceWeather: null,
      fetchedAt: null,
      stale: false,
      provenance: "open-meteo-adapter",
    });
    return { mode: "none", label: "No location selected" };
  }

  function getLocationState() {
    const place = readActivePlace();
    if (!place) return { mode: "none", label: "Location not set" };
    return {
      mode: place.source || "manual",
      label: locationLabel(place),
      ...place
    };
  }


  globalThis.OpenMeteoAdapter = Object.freeze({
    requestRefresh,
    getSnapshot,
    setManualCoordinates,
    requestDeviceLocation,
    searchCity,
    continueWithoutLocation,
    getLocationState,
    setActivePlace,
    getActivePlace,
    savePlace,
    listPlaces,
    getUnits,
    setUnits,
    bootstrapEnvironmentState,
    keys: Object.freeze({
      places: PLACES_KEY,
      activePlace: ACTIVE_PLACE_KEY,
      units: UNITS_KEY
    })
  });

  if (typeof document !== "undefined" && document) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bootstrapEnvironmentState, { once: true });
    } else {
      bootstrapEnvironmentState();
    }
  }
})();
