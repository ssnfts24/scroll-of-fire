(() => {
  "use strict";

  const SELECTED_EVENT = "sof:environment-selection-change";
  const CURRENT_REFRESH_MS = 10 * 60 * 1000;
  const selectedCache = new Map();

  let currentInFlight = null;
  let selectedInFlight = null;
  let lastCurrentRefresh = 0;
  let selectedSnapshot = null;
  let started = false;

  function state() {
    return globalThis.SofEnvironmentState
      ?.getEnvironmentState?.()
      || null;
  }

  function place() {
    return (
      globalThis.OpenMeteoAdapter
        ?.getActivePlace?.()
      || state()?.place
      || null
    );
  }

  function isoDate(value) {
    const text = String(value || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
  }

  function sameAugmentation(base, airQuality, spaceWeather) {
    return (
      (base?.airQuality?.fetchedAt || null)
        === (airQuality?.fetchedAt || null)
      && (base?.spaceWeather?.fetchedAt || null)
        === (spaceWeather?.fetchedAt || null)
    );
  }

  async function refreshCurrent({ force = false } = {}) {
    const activePlace = place();

    if (!activePlace) {
      return {
        status: "unavailable",
        reason: "location-not-set"
      };
    }

    if (
      !force
      && Date.now() - lastCurrentRefresh < CURRENT_REFRESH_MS
    ) {
      return state();
    }

    if (currentInFlight) return currentInFlight;

    currentInFlight = (async () => {
      const [airResult, spaceResult] =
        await Promise.allSettled([
          globalThis.OpenMeteoAirQualityProvider
            ?.getCurrent?.({
              place: activePlace,
              force
            }),
          globalThis.SofSpaceWeatherProvider
            ?.getCurrent?.({
              force
            })
        ]);

      const airQuality =
        airResult.status === "fulfilled"
          ? airResult.value
          : {
              status: "unavailable",
              provider: "Open-Meteo Air Quality",
              reason: String(airResult.reason || "request-failed")
            };

      const spaceWeather =
        spaceResult.status === "fulfilled"
          ? spaceResult.value
          : {
              status: "unavailable",
              provider: "NOAA SWPC / GFZ",
              reason: String(spaceResult.reason || "request-failed")
            };

      const base = state();

      lastCurrentRefresh = Date.now();

      if (
        base
        && !sameAugmentation(
          base,
          airQuality,
          spaceWeather
        )
      ) {
        globalThis.SofEnvironmentState
          ?.setEnvironmentState?.({
            ...base,
            airQuality,
            spaceWeather,
            provenance: [
              base.provenance || base.provider || "weather",
              airQuality?.provider,
              spaceWeather?.provider
            ].filter(Boolean).join(" + ")
          });
      }

      return {
        ...(state() || base || {}),
        airQuality,
        spaceWeather
      };
    })();

    try {
      return await currentInFlight;
    } finally {
      currentInFlight = null;
    }
  }

  async function requestSelected({
    date,
    force = false,
    preferredHour = 12
  } = {}) {
    const day = isoDate(date);
    const activePlace = place();

    if (!day) return null;

    const today = new Date().toISOString().slice(0, 10);

    if (day === today) {
      await refreshCurrent({ force });

      selectedSnapshot = {
        date: day,
        kind: "current",
        weather: state(),
        airQuality: state()?.airQuality || null,
        spaceWeather: state()?.spaceWeather || null
      };

      window.dispatchEvent(
        new CustomEvent(SELECTED_EVENT, {
          detail: selectedSnapshot
        })
      );

      return selectedSnapshot;
    }

    const key = [
      day,
      activePlace?.latitude ?? activePlace?.lat ?? "x",
      activePlace?.longitude ?? activePlace?.lon ?? activePlace?.lng ?? "x",
      preferredHour
    ].join("|");

    if (!force && selectedCache.has(key)) {
      selectedSnapshot = selectedCache.get(key);
      return selectedSnapshot;
    }

    if (selectedInFlight) return selectedInFlight;

    selectedInFlight = (async () => {
      const [weatherResult, kpResult] =
        await Promise.allSettled([
          activePlace
            ? globalThis.OpenMeteoHistoryProvider
                ?.getHistoricalSnapshot?.({
                  place: activePlace,
                  date: day,
                  preferredHour,
                  force
                })
            : Promise.resolve({
                status: "unavailable",
                reason: "location-not-set"
              }),
          globalThis.SofSpaceWeatherProvider
            ?.getForDate?.({
              date: day
            })
        ]);

      const weather =
        weatherResult.status === "fulfilled"
          ? weatherResult.value
          : {
              status: "unavailable",
              reason: String(weatherResult.reason || "request-failed")
            };

      const spaceWeather =
        kpResult.status === "fulfilled"
          ? kpResult.value
          : {
              status: "unavailable",
              reason: String(kpResult.reason || "request-failed")
            };

      const value = {
        date: day,
        kind: "historical",
        weather,
        airQuality: null,
        spaceWeather,
        fetchedAt: new Date().toISOString()
      };

      selectedCache.set(key, value);
      selectedSnapshot = value;

      window.dispatchEvent(
        new CustomEvent(SELECTED_EVENT, {
          detail: value
        })
      );

      return value;
    })();

    try {
      return await selectedInFlight;
    } finally {
      selectedInFlight = null;
    }
  }

  function getSelectedSnapshot(date = null) {
    if (!date) return selectedSnapshot;

    const day = isoDate(date);

    return selectedSnapshot?.date === day
      ? selectedSnapshot
      : null;
  }

  function start() {
    if (started) return;
    started = true;

    const schedule = () => {
      setTimeout(
        () => refreshCurrent().catch(() => {}),
        0
      );
    };

    window.addEventListener(
      "sof:location-changed",
      schedule
    );

    window.addEventListener(
      globalThis.SofEnvironmentState?.EVENT_NAME
        || "sof:environment-change",
      () => {
        const current = state();

        if (
          current?.place
          && (
            !current.airQuality
            || !current.spaceWeather
          )
        ) {
          schedule();
        }
      }
    );

    if (place()) schedule();

    setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshCurrent().catch(() => {});
      }
    }, CURRENT_REFRESH_MS);
  }

  globalThis.SofEnvironmentAuthority = Object.freeze({
    SELECTED_EVENT,
    refreshCurrent,
    requestSelected,
    getSelectedSnapshot,
    start
  });

  start();
})();
