(() => {
  "use strict";

  const NOAA_KP =
    "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";

  const NOAA_KP_FORECAST =
    "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json";

  const NOAA_SCALES =
    "https://services.swpc.noaa.gov/products/noaa-scales.json";

  const GFZ_ENDPOINT =
    "https://kp.gfz.de/app/json/";

  const GFZ_START = "1932-01-01";
  const CACHE_MS = 5 * 60 * 1000;

  let currentCache = null;

  function numeric(value) {
    const n = Number.parseFloat(String(value ?? "").replace(/[^\d.+-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function rowObjects(data) {
    if (!Array.isArray(data) || !data.length) return [];

    if (
      Array.isArray(data[0])
      && data[0].every(value => typeof value === "string")
    ) {
      const headers = data[0];

      return data.slice(1).map(row =>
        Object.fromEntries(
          headers.map((header, index) => [header, row?.[index]])
        )
      );
    }

    return data.filter(value => value && typeof value === "object");
  }

  function firstNumeric(obj, names) {
    for (const name of names) {
      const direct = numeric(obj?.[name]);
      if (direct != null) return direct;

      const lowerName = String(name).toLowerCase();

      for (const [key, value] of Object.entries(obj || {})) {
        if (String(key).toLowerCase() === lowerName) {
          const n = numeric(value);
          if (n != null) return n;
        }
      }
    }

    return null;
  }

  function parseKpProduct(data) {
    const parsed = rowObjects(data)
      .map(row => ({
        time:
          row.time_tag
          || row.time
          || row.timestamp
          || row.TimeTag
          || null,
        kp: firstNumeric(row, ["Kp", "kp", "estimated_kp"]),
        sourceRow: row
      }))
      .filter(item => item.kp != null);

    return parsed.length ? parsed[parsed.length - 1] : null;
  }

  function parseForecast(data) {
    return rowObjects(data)
      .map(row => ({
        time:
          row.time_tag
          || row.time
          || row.timestamp
          || null,
        kp: firstNumeric(row, ["Kp", "kp", "predicted_kp"]),
        sourceRow: row
      }))
      .filter(item => item.kp != null);
  }

  function findScale(data, key) {
    const scan = value => {
      if (!value) return null;

      if (Array.isArray(value)) {
        for (const item of value) {
          const found = scan(item);
          if (found != null) return found;
        }
        return null;
      }

      if (typeof value !== "object") return null;

      for (const [name, child] of Object.entries(value)) {
        if (String(name).toUpperCase() === key) {
          if (typeof child === "object" && child) {
            return (
              numeric(child.Scale)
              ?? numeric(child.scale)
              ?? numeric(child.value)
            );
          }
          return numeric(child);
        }
      }

      for (const child of Object.values(value)) {
        const found = scan(child);
        if (found != null) return found;
      }

      return null;
    };

    return scan(data);
  }

  function kpLevel(kp) {
    const value = numeric(kp);

    if (value == null) return "unknown";
    if (value < 2) return "quiet";
    if (value < 4) return "unsettled";
    if (value < 5) return "active";
    if (value < 6) return "minor-storm";
    if (value < 7) return "moderate-storm";
    if (value < 8) return "strong-storm";
    if (value < 9) return "severe-storm";
    return "extreme-storm";
  }

  async function fetchJson(url, signal) {
    const response = await fetch(url, {
      signal,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Space weather HTTP ${response.status}`);
    }

    return response.json();
  }

  async function gfzForDay(date, signal) {
    const day = String(date || "").slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return {
        status: "unavailable",
        reason: "invalid-date"
      };
    }

    if (day < GFZ_START) {
      return {
        status: "unsupported",
        reason: "before-kp-record",
        supportedFrom: GFZ_START,
        date: day,
        provider: "GFZ Kp"
      };
    }

    const params = new URLSearchParams({
      start: `${day}T00:00:00Z`,
      end: `${day}T23:59:59Z`,
      index: "Kp"
    });

    const response = await fetch(`${GFZ_ENDPOINT}?${params.toString()}`, {
      signal,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`GFZ Kp HTTP ${response.status}`);
    }

    const data = await response.json();

    const values =
      data?.Kp
      || data?.kp
      || data?.value
      || data?.values
      || [];

    const times =
      data?.datetime
      || data?.time
      || data?.times
      || [];

    const statuses =
      data?.status
      || [];

    const parsed = (
      Array.isArray(values)
        ? values
        : [values]
    )
      .map(numeric)
      .filter(value => value != null);

    if (!parsed.length) {
      return {
        status: "unavailable",
        reason: "no-kp-values",
        date: day,
        provider: "GFZ Kp"
      };
    }

    const kpMax = Math.max(...parsed);
    const kpMean =
      parsed.reduce((sum, value) => sum + value, 0)
      / parsed.length;

    return {
      status: "available",
      provider: "GFZ Kp",
      source: "GFZ Helmholtz Centre for Geosciences",
      provenance: "GFZ Kp",
      date: day,
      kp: parsed[parsed.length - 1],
      kpMax,
      kpMean,
      level: kpLevel(kpMax),
      times,
      statuses,
      fetchedAt: new Date().toISOString()
    };
  }

  async function getCurrent({ force = false, signal } = {}) {
    if (
      !force
      && currentCache
      && Date.now() - currentCache.cachedAt < CACHE_MS
    ) {
      return currentCache.value;
    }

    const [kpResult, forecastResult, scalesResult] =
      await Promise.allSettled([
        fetchJson(NOAA_KP, signal),
        fetchJson(NOAA_KP_FORECAST, signal),
        fetchJson(NOAA_SCALES, signal)
      ]);

    const latest =
      kpResult.status === "fulfilled"
        ? parseKpProduct(kpResult.value)
        : null;

    const forecast =
      forecastResult.status === "fulfilled"
        ? parseForecast(forecastResult.value)
        : [];

    const scales =
      scalesResult.status === "fulfilled"
        ? {
            G: findScale(scalesResult.value, "G"),
            S: findScale(scalesResult.value, "S"),
            R: findScale(scalesResult.value, "R")
          }
        : { G: null, S: null, R: null };

    let value = null;

    if (latest?.kp != null) {
      value = {
        status: "available",
        provider: "NOAA SWPC",
        source: "NOAA Space Weather Prediction Center",
        provenance: "NOAA SWPC",
        kp: latest.kp,
        level: kpLevel(latest.kp),
        observedAt: latest.time,
        forecast,
        scales,
        fetchedAt: new Date().toISOString()
      };
    } else {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const fallback = await gfzForDay(today, signal);

        value = {
          ...fallback,
          provider: "GFZ Kp",
          scales,
          forecast
        };
      } catch (error) {
        value = {
          status: "unavailable",
          provider: "NOAA SWPC / GFZ",
          reason: String(error?.message || error),
          kp: null,
          scales,
          forecast
        };
      }
    }

    currentCache = {
      cachedAt: Date.now(),
      value
    };

    return value;
  }

  async function getForDate({ date, signal } = {}) {
    const day = String(date || "").slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    if (day === today) {
      return getCurrent({ signal });
    }

    return gfzForDay(day, signal);
  }

  globalThis.SofSpaceWeatherProvider = Object.freeze({
    NOAA_KP,
    NOAA_KP_FORECAST,
    NOAA_SCALES,
    GFZ_ENDPOINT,
    GFZ_START,
    kpLevel,
    getCurrent,
    getForDate
  });
})();
