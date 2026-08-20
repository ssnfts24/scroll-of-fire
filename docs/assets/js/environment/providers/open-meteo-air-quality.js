(() => {
  "use strict";

  const ENDPOINT = "https://air-quality-api.open-meteo.com/v1/air-quality";
  const CACHE_MS = 10 * 60 * 1000;

  const CURRENT_FIELDS = Object.freeze([
    "us_aqi",
    "european_aqi",
    "pm2_5",
    "pm10",
    "ozone",
    "nitrogen_dioxide",
    "carbon_monoxide",
    "aerosol_optical_depth",
    "dust",
    "uv_index"
  ]);

  const cache = new Map();

  function coords(place) {
    const latitude = Number(place?.latitude ?? place?.lat);
    const longitude = Number(place?.longitude ?? place?.lon ?? place?.lng);

    return Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { latitude, longitude }
      : null;
  }

  async function getCurrent({ place, force = false, signal } = {}) {
    const point = coords(place);

    if (!point) {
      return {
        status: "unavailable",
        reason: "location-not-set",
        providerConfigured: false
      };
    }

    const key = `${point.latitude.toFixed(4)}|${point.longitude.toFixed(4)}`;
    const cached = cache.get(key);

    if (!force && cached && Date.now() - cached.cachedAt < CACHE_MS) {
      return cached.value;
    }

    const params = new URLSearchParams({
      latitude: String(point.latitude),
      longitude: String(point.longitude),
      current: CURRENT_FIELDS.join(","),
      timezone: "auto"
    });

    const response = await fetch(`${ENDPOINT}?${params.toString()}`, {
      signal,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo Air Quality HTTP ${response.status}`);
    }

    const data = await response.json();
    const current = data?.current || {};

    const value = {
      status: "available",
      providerConfigured: true,
      provider: "Open-Meteo Air Quality",
      source: "Open-Meteo Air Quality",
      provenance: "Open-Meteo CAMS",
      fetchedAt: new Date().toISOString(),
      observedAt: current.time || null,
      current: {
        usAqi: current.us_aqi ?? null,
        europeanAqi: current.european_aqi ?? null,
        pm25: current.pm2_5 ?? null,
        pm10: current.pm10 ?? null,
        ozone: current.ozone ?? null,
        nitrogenDioxide: current.nitrogen_dioxide ?? null,
        carbonMonoxide: current.carbon_monoxide ?? null,
        aerosolOpticalDepth: current.aerosol_optical_depth ?? null,
        dust: current.dust ?? null,
        uvIndex: current.uv_index ?? null
      }
    };

    cache.set(key, {
      cachedAt: Date.now(),
      value
    });

    return value;
  }

  globalThis.OpenMeteoAirQualityProvider = Object.freeze({
    ENDPOINT,
    CURRENT_FIELDS,
    getCurrent
  });
})();
