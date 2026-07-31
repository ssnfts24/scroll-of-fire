(() => {
  "use strict";

  const CACHE_KEY = "sof.environment.openmeteo.cache.v1";
  const COORDS_KEY = "sof.environment.location.v1";
  const FRESH_MS = 15 * 60 * 1000;

  function safeRead(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function safeWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function ageMinutes(updatedAt) {
    if (!updatedAt) return null;
    const t = new Date(updatedAt).getTime();
    if (!Number.isFinite(t)) return null;
    return Math.max(0, Math.round((Date.now() - t) / 60000));
  }

  function resolveCoordinates(override) {
    if (override && Number.isFinite(override.latitude) && Number.isFinite(override.longitude)) {
      return {
        latitude: Number(override.latitude),
        longitude: Number(override.longitude),
        label: override.label || "Manual coordinates",
        mode: override.mode || "manual"
      };
    }
    const saved = safeRead(COORDS_KEY);
    if (saved && Number.isFinite(saved.latitude) && Number.isFinite(saved.longitude)) return saved;
    return null;
  }

  function mapResponse(payload, coords) {
    const current = payload?.current || {};
    const daily = payload?.daily || {};
    const first = field => Array.isArray(field) ? field[0] : null;

    return {
      provider: "Open-Meteo",
      providerConfigured: true,
      coordinates: coords,
      updatedAt: nowIso(),
      dataClass: "live observation",
      source: "https://open-meteo.com/",
      current: {
        temperature: current.temperature_2m ?? null,
        apparentTemperature: current.apparent_temperature ?? null,
        humidity: current.relative_humidity_2m ?? null,
        dewPoint: current.dew_point_2m ?? null,
        cloudCover: current.cloud_cover ?? null,
        pressure: current.pressure_msl ?? null,
        windSpeed: current.wind_speed_10m ?? null,
        windDirection: current.wind_direction_10m ?? null,
        windGust: current.wind_gusts_10m ?? null,
        precipitation: current.precipitation ?? null,
        weatherCode: current.weather_code ?? null,
        visibility: current.visibility ?? null,
        solarRadiation: current.shortwave_radiation ?? null,
        uv: current.uv_index ?? null,
        isDay: current.is_day ?? null,
      },
      daily: {
        sunrise: first(daily.sunrise),
        sunset: first(daily.sunset),
        daylightDurationSeconds: first(daily.daylight_duration),
        tempMax: first(daily.temperature_2m_max),
        tempMin: first(daily.temperature_2m_min),
        precipProbability: first(daily.precipitation_probability_max),
        uvMax: first(daily.uv_index_max),
        windSpeed: first(daily.wind_speed_10m_max),
      },
      field: {
        soilTemperature: current.soil_temperature_0cm ?? null,
        soilMoisture: current.soil_moisture_0_to_1cm ?? null,
        evapotranspiration: first(daily.et0_fao_evapotranspiration),
        shortwaveRadiation: first(daily.shortwave_radiation_sum),
      }
    };
  }

  function addFreshness(snapshot) {
    if (!snapshot) {
      return {
        providerConfigured: false,
        statusLabel: "Location required",
        freshness: { stale: true, ageMinutes: null, label: "No data" },
      };
    }
    const age = ageMinutes(snapshot.updatedAt);
    const stale = age == null ? true : age > 30;
    return {
      ...snapshot,
      freshness: {
        stale,
        ageMinutes: age,
        label: age == null ? "Unknown" : (age <= 1 ? "Just updated" : `${age} min ago`)
      },
      statusLabel: stale ? "Cached snapshot" : "Live observation",
    };
  }

  async function fetchSnapshot(coords) {
    const params = new URLSearchParams({
      latitude: String(coords.latitude),
      longitude: String(coords.longitude),
      current: [
        "temperature_2m",
        "apparent_temperature",
        "relative_humidity_2m",
        "dew_point_2m",
        "cloud_cover",
        "pressure_msl",
        "wind_speed_10m",
        "wind_direction_10m",
        "wind_gusts_10m",
        "precipitation",
        "weather_code",
        "visibility",
        "shortwave_radiation",
        "uv_index",
        "is_day",
        "soil_temperature_0cm",
        "soil_moisture_0_to_1cm"
      ].join(","),
      daily: [
        "sunrise",
        "sunset",
        "daylight_duration",
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_probability_max",
        "uv_index_max",
        "wind_speed_10m_max",
        "et0_fao_evapotranspiration",
        "shortwave_radiation_sum"
      ].join(","),
      timezone: "auto"
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
    const json = await response.json();
    return mapResponse(json, coords);
  }

  async function requestRefresh(options = {}) {
    const coords = resolveCoordinates(options.coords);
    if (!coords) return addFreshness(null);
    const existing = safeRead(CACHE_KEY);
    const age = ageMinutes(existing?.updatedAt);
    if (!options.force && existing && age != null && age < 10) {
      return addFreshness(existing);
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return addFreshness(existing || null);
    }
    try {
      const fresh = await fetchSnapshot(coords);
      safeWrite(CACHE_KEY, fresh);
      return addFreshness(fresh);
    } catch {
      return addFreshness(existing || null);
    }
  }

  function getSnapshot() {
    return addFreshness(safeRead(CACHE_KEY));
  }

  function setManualCoordinates(latitude, longitude, label = "Manual coordinates") {
    const coords = {
      latitude: Number(latitude),
      longitude: Number(longitude),
      label,
      mode: "manual"
    };
    if (!Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) return false;
    safeWrite(COORDS_KEY, coords);
    return true;
  }

  async function requestDeviceLocation() {
    if (!("geolocation" in navigator)) return null;
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 5 * 60 * 1000,
      });
    });
    const coords = {
      latitude: Number(position.coords.latitude),
      longitude: Number(position.coords.longitude),
      label: "Device location",
      mode: "device"
    };
    safeWrite(COORDS_KEY, coords);
    return coords;
  }

  async function searchCity(query) {
    const q = String(query || "").trim();
    if (!q) return [];
    const params = new URLSearchParams({
      name: q,
      count: "8",
      language: "en",
      format: "json"
    });
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) return [];
    const json = await response.json();
    return Array.isArray(json?.results) ? json.results.map(item => ({
      name: [item.name, item.admin1, item.country].filter(Boolean).join(", "),
      latitude: item.latitude,
      longitude: item.longitude,
      timezone: item.timezone || null,
      mode: "city"
    })) : [];
  }

  function continueWithoutLocation() {
    safeWrite(COORDS_KEY, { mode: "none", label: "No location selected" });
  }

  function getLocationState() {
    return resolveCoordinates() || safeRead(COORDS_KEY) || { mode: "none", label: "No location selected" };
  }

  globalThis.OpenMeteoAdapter = Object.freeze({
    requestRefresh,
    getSnapshot,
    setManualCoordinates,
    requestDeviceLocation,
    searchCity,
    continueWithoutLocation,
    getLocationState,
  });
})();
