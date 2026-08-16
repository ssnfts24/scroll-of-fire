(() => {
  "use strict";

  const CURRENT_TTL_MS = 15 * 60 * 1000;
  const HOURLY_TTL_MS = 30 * 60 * 1000;
  const DAILY_TTL_MS = 2 * 60 * 60 * 1000;
  const REQUEST_TIMEOUT_MS = 15000;
  const CACHE_KEY = "sof.environment.openmeteo.forecast.cache.v1";
  const LAST_SUCCESS_KEY = "sof.environment.openmeteo.last-success.v1";

  const inFlight = new Map();

  const CURRENT_FIELDS = [
    "temperature_2m",
    "apparent_temperature",
    "relative_humidity_2m",
    "dew_point_2m",
    "precipitation",
    "rain",
    "snowfall",
    "weather_code",
    "cloud_cover",
    "pressure_msl",
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m",
    "shortwave_radiation",
    "is_day"
  ];

  const HOURLY_FIELDS = [
    "temperature_2m",
    "apparent_temperature",
    "relative_humidity_2m",
    "precipitation_probability",
    "precipitation",
    "weather_code",
    "pressure_msl",
    "cloud_cover",
    "cloud_cover_low",
    "cloud_cover_mid",
    "cloud_cover_high",
    "visibility",
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m",
    "shortwave_radiation",
    "uv_index"
  ];

  const DAILY_FIELDS = [
    "weather_code",
    "sunrise",
    "sunset",
    "daylight_duration",
    "sunshine_duration",
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_probability_max",
    "precipitation_sum",
    "wind_speed_10m_max",
    "wind_gusts_10m_max",
    "uv_index_max"
  ];

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

  function nowMs() {
    return Date.now();
  }

  function ageMs(value) {
    const t = new Date(value || 0).getTime();
    if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
    return Math.max(0, nowMs() - t);
  }

  function placeKey(place) {
    if (!place || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) return "none";
    return `${Number(place.latitude).toFixed(4)},${Number(place.longitude).toFixed(4)}`;
  }

  function normalizePlace(place) {
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

  function summarizeCondition(code) {
    const map = {
      0: "Clear",
      1: "Mainly clear",
      2: "Partly cloudy",
      3: "Overcast",
      45: "Fog",
      48: "Rime fog",
      51: "Light drizzle",
      53: "Drizzle",
      55: "Heavy drizzle",
      61: "Light rain",
      63: "Rain",
      65: "Heavy rain",
      71: "Light snow",
      73: "Snow",
      75: "Heavy snow",
      80: "Rain showers",
      81: "Heavy showers",
      82: "Violent showers",
      95: "Thunderstorm"
    };
    return map[Number(code)] || "Condition unavailable";
  }

  function normalizeForecastPayload(payload, place) {
    const current = payload?.current || {};
    const hourly = payload?.hourly || {};
    const daily = payload?.daily || {};
    const first = value => Array.isArray(value) ? value[0] : null;
    const fetchedAt = new Date().toISOString();

    return {
      provider: "Open-Meteo",
      providerUrl: "https://api.open-meteo.com/v1/forecast",
      fetchedAt,
      place,
      current: {
        time: current.time || null,
        temperature_2m: current.temperature_2m ?? null,
        apparent_temperature: current.apparent_temperature ?? null,
        relative_humidity_2m: current.relative_humidity_2m ?? null,
        dew_point_2m: current.dew_point_2m ?? null,
        precipitation: current.precipitation ?? null,
        rain: current.rain ?? null,
        snowfall: current.snowfall ?? null,
        weather_code: current.weather_code ?? null,
        cloud_cover: current.cloud_cover ?? null,
        pressure_msl: current.pressure_msl ?? null,
        wind_speed_10m: current.wind_speed_10m ?? null,
        wind_direction_10m: current.wind_direction_10m ?? null,
        wind_gusts_10m: current.wind_gusts_10m ?? null,
        shortwave_radiation: current.shortwave_radiation ?? null,
        is_day: current.is_day ?? null,
        condition: summarizeCondition(current.weather_code)
      },
      hourly: {
        time: Array.isArray(hourly.time) ? hourly.time : [],
        ...Object.fromEntries(HOURLY_FIELDS.map(field => [field, Array.isArray(hourly[field]) ? hourly[field] : []]))
      },
      daily: {
        time: Array.isArray(daily.time) ? daily.time : [],
        ...Object.fromEntries(DAILY_FIELDS.map(field => [field, Array.isArray(daily[field]) ? daily[field] : []])),
        sunrise: first(daily.sunrise),
        sunset: first(daily.sunset),
        daylight_duration: first(daily.daylight_duration),
        sunshine_duration: first(daily.sunshine_duration)
      },
      cacheMeta: {
        currentFetchedAt: fetchedAt,
        hourlyFetchedAt: fetchedAt,
        dailyFetchedAt: fetchedAt
      }
    };
  }

  function requestParams(place) {
    const params = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      timezone: "auto",
      current: CURRENT_FIELDS.join(","),
      hourly: HOURLY_FIELDS.join(","),
      daily: DAILY_FIELDS.join(",")
    });
    return params;
  }

  async function fetchForecast(place, signal) {
    const params = requestParams(place);
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
      cache: "no-store",
      signal
    });
    if (!response.ok) {
      throw new Error(`Open-Meteo forecast request failed (${response.status}).`);
    }
    const json = await response.json();
    return normalizeForecastPayload(json, place);
  }

  function readCache(place) {
    const cache = safeRead(CACHE_KEY);
    if (!cache || cache.placeKey !== placeKey(place) || !cache.snapshot) return null;
    return cache.snapshot;
  }

  function writeCache(place, snapshot) {
    safeWrite(CACHE_KEY, {
      placeKey: placeKey(place),
      snapshot
    });
  }

  function segmentFreshness(snapshot) {
    const currentFresh = ageMs(snapshot?.cacheMeta?.currentFetchedAt) <= CURRENT_TTL_MS;
    const hourlyFresh = ageMs(snapshot?.cacheMeta?.hourlyFetchedAt) <= HOURLY_TTL_MS;
    const dailyFresh = ageMs(snapshot?.cacheMeta?.dailyFetchedAt) <= DAILY_TTL_MS;
    return {
      currentFresh,
      hourlyFresh,
      dailyFresh,
      allFresh: currentFresh && hourlyFresh && dailyFresh
    };
  }

  function buildResult(snapshot, { stale = false, staleReason = "", error = null } = {}) {
    const updatedAt = snapshot?.fetchedAt || "";
    const ageMinutes = Number.isFinite(new Date(updatedAt).getTime())
      ? Math.max(0, Math.round((Date.now() - new Date(updatedAt).getTime()) / 60000))
      : null;
    return {
      ok: !!snapshot,
      stale,
      staleReason,
      errorMessage: error ? String(error.message || error) : "",
      snapshot: snapshot || null,
      updatedAt,
      ageMinutes,
      provider: "Open-Meteo"
    };
  }

  async function getForecastSnapshot({ place, force = false, signal } = {}) {
    const normalizedPlace = normalizePlace(place);
    if (!normalizedPlace) return buildResult(null, { error: new Error("Location is not set.") });

    const cache = readCache(normalizedPlace);
    if (!force && cache) {
      const fresh = segmentFreshness(cache);
      if (fresh.allFresh) return buildResult(cache);
    }

    const key = placeKey(normalizedPlace);
    if (!force && inFlight.has(key)) {
      return inFlight.get(key);
    }

    const promise = (async () => {
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      signal?.addEventListener?.("abort", onAbort, { once: true });
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const fresh = await fetchForecast(normalizedPlace, controller.signal);
        writeCache(normalizedPlace, fresh);
        safeWrite(LAST_SUCCESS_KEY, fresh);
        return buildResult(fresh);
      } catch (error) {
        const lastSuccess = safeRead(LAST_SUCCESS_KEY);
        const staleCache = cache || (placeKey(lastSuccess?.place) === key ? lastSuccess : null);
        if (staleCache) {
          return buildResult(staleCache, {
            stale: true,
            staleReason: "Using last successful environmental snapshot.",
            error
          });
        }
        return buildResult(null, { error });
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener?.("abort", onAbort);
      }
    })();

    inFlight.set(key, promise);
    try {
      return await promise;
    } finally {
      inFlight.delete(key);
    }
  }

  function getCachedForecastSnapshot(place) {
    const normalizedPlace = normalizePlace(place);
    if (!normalizedPlace) return buildResult(null, { error: new Error("Location is not set.") });
    const lastSuccess = safeRead(LAST_SUCCESS_KEY);
    const cache = readCache(normalizedPlace) || (placeKey(lastSuccess?.place) === placeKey(normalizedPlace) ? lastSuccess : null);
    if (!cache) return buildResult(null, { error: new Error("No cached environmental snapshot.") });
    const fresh = segmentFreshness(cache);
    return buildResult(cache, {
      stale: !fresh.allFresh,
      staleReason: fresh.allFresh ? "" : "Cached snapshot age exceeded preferred freshness windows."
    });
  }

  globalThis.OpenMeteoForecastProvider = Object.freeze({
    CURRENT_TTL_MS,
    HOURLY_TTL_MS,
    DAILY_TTL_MS,
    REQUEST_TIMEOUT_MS,
    CURRENT_FIELDS,
    HOURLY_FIELDS,
    DAILY_FIELDS,
    normalizePlace,
    getForecastSnapshot,
    getCachedForecastSnapshot,
    _internals: Object.freeze({ placeKey, normalizeForecastPayload, requestParams, segmentFreshness })
  });
})();
