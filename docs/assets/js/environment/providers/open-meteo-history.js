(() => {
  "use strict";

  const HISTORICAL_FORECAST_START = "2022-01-01";
  const ARCHIVE_START = "1940-01-01";

  const HOURLY = Object.freeze([
    "temperature_2m",
    "apparent_temperature",
    "relative_humidity_2m",
    "dew_point_2m",
    "precipitation",
    "cloud_cover",
    "cloud_cover_low",
    "cloud_cover_mid",
    "cloud_cover_high",
    "pressure_msl",
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m",
    "shortwave_radiation"
  ]);

  const DAILY = Object.freeze([
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_sum",
    "sunrise",
    "sunset"
  ]);

  const cache = new Map();

  function isoDate(value) {
    const text = String(value || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
  }

  function placeCoords(place) {
    const latitude = Number(place?.latitude ?? place?.lat);
    const longitude = Number(place?.longitude ?? place?.lon ?? place?.lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return { latitude, longitude };
  }

  function nearestHourIndex(times, preferredHour = 12) {
    if (!Array.isArray(times) || !times.length) return 0;

    let bestIndex = 0;
    let bestDelta = Infinity;

    times.forEach((value, index) => {
      const match = String(value || "").match(/T(\d{2}):/);
      const hour = match ? Number(match[1]) : 12;
      const delta = Math.abs(hour - preferredHour);

      if (delta < bestDelta) {
        bestDelta = delta;
        bestIndex = index;
      }
    });

    return bestIndex;
  }

  function at(array, index) {
    return Array.isArray(array) ? array[index] ?? null : null;
  }

  function first(array) {
    return Array.isArray(array) ? array[0] ?? null : array ?? null;
  }

  async function getHistoricalSnapshot({
    place,
    date,
    preferredHour = 12,
    force = false,
    signal
  } = {}) {
    const day = isoDate(date);
    const coords = placeCoords(place);

    if (!day || !coords) {
      return {
        status: "unavailable",
        reason: !day ? "invalid-date" : "location-not-set",
        providerConfigured: !!coords,
        date: day
      };
    }

    if (day < ARCHIVE_START) {
      return {
        status: "unsupported",
        reason: "before-weather-record",
        providerConfigured: true,
        supportedFrom: ARCHIVE_START,
        date: day,
        provider: "Open-Meteo Historical Weather"
      };
    }

    const recent = day >= HISTORICAL_FORECAST_START;
    const provider = recent
      ? "Open-Meteo Historical Forecast"
      : "Open-Meteo Historical Weather / ERA5";

    const baseUrl = recent
      ? "https://historical-forecast-api.open-meteo.com/v1/forecast"
      : "https://archive-api.open-meteo.com/v1/archive";

    const key = [
      recent ? "forecast-history" : "era5",
      coords.latitude.toFixed(4),
      coords.longitude.toFixed(4),
      day,
      preferredHour
    ].join("|");

    if (!force && cache.has(key)) return cache.get(key);

    const params = new URLSearchParams({
      latitude: String(coords.latitude),
      longitude: String(coords.longitude),
      start_date: day,
      end_date: day,
      hourly: HOURLY.join(","),
      daily: DAILY.join(","),
      temperature_unit: "celsius",
      wind_speed_unit: "kmh",
      precipitation_unit: "mm",
      timezone: "auto"
    });

    const response = await fetch(`${baseUrl}?${params.toString()}`, {
      signal,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`${provider} HTTP ${response.status}`);
    }

    const data = await response.json();
    const hourly = data?.hourly || {};
    const daily = data?.daily || {};
    const index = nearestHourIndex(hourly.time, preferredHour);

    const snapshot = {
      status: "available",
      providerConfigured: true,
      provider,
      source: provider,
      provenance: provider,
      dataset: recent ? "historical-forecast" : "era5-reanalysis",
      date: day,
      sampledAt: at(hourly.time, index),
      latitude: data?.latitude ?? coords.latitude,
      longitude: data?.longitude ?? coords.longitude,
      timezone: data?.timezone || place?.timezone || "auto",
      units: {
        temperature: "celsius",
        wind: "kmh",
        precipitation: "mm"
      },
      current: {
        temperature: at(hourly.temperature_2m, index),
        apparentTemperature: at(hourly.apparent_temperature, index),
        humidity: at(hourly.relative_humidity_2m, index),
        dewPoint: at(hourly.dew_point_2m, index),
        precipitation: at(hourly.precipitation, index),
        cloudCover: at(hourly.cloud_cover, index),
        cloudCoverLow: at(hourly.cloud_cover_low, index),
        cloudCoverMid: at(hourly.cloud_cover_mid, index),
        cloudCoverHigh: at(hourly.cloud_cover_high, index),
        pressure: at(hourly.pressure_msl, index),
        windSpeed: at(hourly.wind_speed_10m, index),
        windDirection: at(hourly.wind_direction_10m, index),
        windGust: at(hourly.wind_gusts_10m, index),
        solarRadiation: at(hourly.shortwave_radiation, index)
      },
      daily: {
        tempMax: first(daily.temperature_2m_max),
        tempMin: first(daily.temperature_2m_min),
        precipSum: first(daily.precipitation_sum),
        sunrise: first(daily.sunrise),
        sunset: first(daily.sunset)
      },
      fetchedAt: new Date().toISOString()
    };

    cache.set(key, snapshot);
    return snapshot;
  }

  globalThis.OpenMeteoHistoryProvider = Object.freeze({
    ARCHIVE_START,
    HISTORICAL_FORECAST_START,
    HOURLY,
    DAILY,
    getHistoricalSnapshot
  });
})();
