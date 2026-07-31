(() => {
  "use strict";

  const DEPENDENCIES = [
    "assets/js/astronomy/astronomy-version.js",
    "assets/js/astronomy/astronomy-sources.js",
    "assets/js/astronomy/timezone-tools.js",
    "assets/js/astronomy/equinox-reference-data.js",
    "assets/js/astronomy/lunar-at-equinox.js",
    "assets/js/astronomy/equinox-engine.js",
    "assets/js/equinox/equinox-passage-format.js",
    "assets/js/equinox/equinox-passage-engine.js",
    "assets/js/equinox/equinox-passage-data.js",
    "assets/js/alignment/alignment-version.js",
    "assets/js/alignment/alignment-ledger-engine.js",
    "assets/js/alignment/alignment-ledger-data.js",
    "assets/js/alignment/alignment-comparison.js",
    "assets/js/alignment/alignment-recurrence.js",
    "assets/js/alignment/alignment-offsets.js",
    "assets/js/alignment/alignment-signature.js",
    "assets/js/sphere/living-time-sphere-version.js",
    "assets/js/sphere/living-time-sphere-model.js",
    "assets/js/sphere/living-time-sphere-state.js",
    "assets/js/sphere/living-time-sphere-layout.js",
    "assets/js/sphere/living-time-sphere-connections.js",
    "assets/js/sphere/living-time-sphere-renderer-svg.js",
    "assets/js/sphere/living-time-sphere-renderer-canvas.js",
    "assets/js/sphere/living-time-sphere-live-data.js",
    "assets/js/sphere/living-time-sphere-mount.js",
    "assets/js/sphere/living-time-sphere-today.js",
    "assets/js/environment/open-meteo-adapter.js"
  ];

  let loadingPromise = null;
  let activeRoot = null;
  let activeMount = null;
  let fxRaf = 0;
  let fxVisible = false;
  let observer = null;
  let refreshTimer = 0;

  function resolveUrl(path) {
    try { return new URL(path, document.baseURI).toString(); }
    catch { return path; }
  }

  function loadScript(path) {
    const src = resolveUrl(path);
    const existing = Array.from(document.scripts).find(s => s.src === src);
    if (existing) {
      if (existing.dataset.loaded === "true") return Promise.resolve();
      return new Promise(resolve => existing.addEventListener("load", resolve, { once: true }));
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.defer = true;
      script.src = src;
      script.onload = () => { script.dataset.loaded = "true"; resolve(); };
      script.onerror = () => reject(new Error(`Failed loading ${path}`));
      document.head.appendChild(script);
    });
  }

  async function ensureDependencies() {
    if (loadingPromise) return loadingPromise;
    loadingPromise = DEPENDENCIES.reduce((chain, src) => chain.then(() => loadScript(src)), Promise.resolve());
    return loadingPromise;
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function readQuestCount() {
    const keys = [
      "sof.question-quests.v1",
      "sof_question_quests_v1",
      "sof.questionQuests.v1"
    ];
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.filter(item => item && item.paused !== true).length;
      } catch {
        // ignore
      }
    }
    return 0;
  }

  function formatTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function formatDaylight(seconds) {
    if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return "—";
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return `${h}h ${String(m).padStart(2, "0")}m`;
  }

  function weatherSummary(weather) {
    if (!weather) return "Unavailable";
    if (!weather.providerConfigured) return "Provider not set";
    if (!weather.current) return weather.statusLabel || "Unavailable";
    const temp = typeof weather.current.temperature === "number" ? `${Math.round(weather.current.temperature)}°C` : null;
    const cloud = typeof weather.current.cloudCover === "number" ? `${Math.round(weather.current.cloudCover)}% cloud` : null;
    const wind = typeof weather.current.windSpeed === "number" ? `${Math.round(weather.current.windSpeed)} km/h` : null;
    return [temp, cloud, wind].filter(Boolean).join(" · ") || weather.statusLabel || "Unavailable";
  }

  function updateExtraTelemetry(root) {
    const snapshot = globalThis.LivingTimeSphereLiveData?.getSnapshot?.() || null;
    if (!snapshot) return;
    setText("home-sphere-civil-date", snapshot.pattern?.civilDate || "—");
    setText("home-sphere-selected-day", snapshot.pattern?.dayOfPatternYear ? `Day ${snapshot.pattern.dayOfPatternYear}/364` : "Outside count");
    setText("home-sphere-quest-count", String(readQuestCount()));
    setText("home-sphere-today-witness", String(snapshot.witness?.count ?? 0));

    const weather = snapshot.weather || null;
    setText("home-sphere-weather", weatherSummary(weather));
    setText("home-sphere-sunrise", formatTime(weather?.daily?.sunrise));
    setText("home-sphere-sunset", formatTime(weather?.daily?.sunset));
    setText("home-sphere-daylight", formatDaylight(weather?.daily?.daylightDurationSeconds));

    const pattern = snapshot.pattern?.moon != null
      ? `Moon ${snapshot.pattern.moon} Day ${snapshot.pattern.day} · ${snapshot.lunar?.phaseName || "Lunar state"}`
      : "Outside counted year";
    const history = Array.isArray(snapshot.history?.recurrences) && snapshot.history.recurrences[0]
      ? `Closest recurrence ${snapshot.history.recurrences[0].year} · ${Math.round(snapshot.history.recurrences[0].overallSimilarityScore * 100)}%`
      : "No close recurrence in supported range";
    const passage = snapshot.passage?.active
      ? `Passage active · ${snapshot.passage.elapsed != null ? `${Number((snapshot.passage.elapsed * 24).toFixed(1))} h elapsed` : "in progress"}`
      : "Passage inactive";

    setText("home-sphere-drawer-pattern", `${pattern}. Solar: ${snapshot.solar?.gate || "—"} (${snapshot.solar?.element || "—"}).`);
    setText("home-sphere-drawer-history", `${passage}. ${history}.`);

    if (weather?.providerConfigured && weather?.freshness?.stale) {
      const weatherNode = document.getElementById("home-sphere-weather");
      if (weatherNode && !/stale/i.test(weatherNode.textContent || "")) {
        weatherNode.textContent = `${weatherNode.textContent} · stale`;
      }
    }

    const openLink = document.getElementById("home-sphere-today-open-link");
    if (openLink && globalThis.LivingTimeSphereTodayCard?.buildLink) {
      openLink.href = globalThis.LivingTimeSphereTodayCard.buildLink({
        year: snapshot.year,
        timeZone: snapshot.timeZone,
        boundaryMode: snapshot.boundaryMode,
        manualSunset: snapshot.manualSunset,
        source: "home",
        viewMode: "today",
        layers: ["pattern", "lunar", "solar", "passage", "markers"]
      });
    }
  }

  function stopFx() {
    if (fxRaf) cancelAnimationFrame(fxRaf);
    fxRaf = 0;
  }

  function drawFx(canvas) {
    if (!canvas || !fxVisible) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const t = performance.now() * (reduced ? 0 : 0.0002);
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 8, w * 0.5, h * 0.5, Math.max(w, h) * 0.55);
    g.addColorStop(0, "rgba(20, 220, 255, 0.12)");
    g.addColorStop(0.55, "rgba(251, 191, 36, 0.05)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    if (!reduced) {
      ctx.strokeStyle = "rgba(122,243,255,0.2)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i += 1) {
        const r = ((Math.min(w, h) * 0.2) + (i * 24) + (Math.sin(t * 8 + i) * 2));
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    fxRaf = requestAnimationFrame(() => drawFx(canvas));
  }

  async function refreshWeather(force = false) {
    try {
      if (!globalThis.OpenMeteoAdapter?.requestRefresh) return;
      await globalThis.OpenMeteoAdapter.requestRefresh({ force });
    } catch {
      // ignore fetch errors and keep cached snapshot
    }
  }

  async function initInstrument(root) {
    await ensureDependencies();
    await refreshWeather(false);

    const preview = root.querySelector("#home-sphere-today-preview");
    if (preview && globalThis.LivingTimeSphere?.mount && !preview.__livingTimeSphereMount) {
      preview.__livingTimeSphereMount = globalThis.LivingTimeSphere.mount({
        container: preview,
        compact: true,
        renderer: "svg",
        mode: "today",
        visibleLayers: { pattern: true, exactDays: true, weekGates: true, lunar: true, solar: true, passage: true, markers: true, connections: true }
      });
      activeMount = preview.__livingTimeSphereMount;
    }

    if (globalThis.LivingTimeSphereTodayCard?.renderInteractive) {
      globalThis.LivingTimeSphereTodayCard.renderInteractive(root, {
        idPrefix: "home-",
        source: "home",
        viewMode: "today",
        render: "interactive"
      });
      globalThis.LivingTimeSphereTodayCard.wireInteractive(root, {
        idPrefix: "home-",
        source: "home",
        viewMode: "today",
      });
      globalThis.LivingTimeSphereTodayCard.attachAutoUpdate(root, {
        idPrefix: "home-",
        source: "home",
        viewMode: "today",
        render: "interactive"
      });
    }

    updateExtraTelemetry(root);

    const canvas = root.querySelector("#home-sphere-fx");
    if (canvas) {
      fxVisible = true;
      drawFx(canvas);
    }

    if (!refreshTimer) {
      refreshTimer = window.setInterval(async () => {
        if (!fxVisible) return;
        await refreshWeather(false);
        updateExtraTelemetry(root);
      }, 300000);
    }
  }

  function deactivateInstrument() {
    fxVisible = false;
    stopFx();
    if (activeMount?.teardown) activeMount.teardown();
    activeMount = null;
  }

  async function activateInstrument(root) {
    activeRoot = root;
    await initInstrument(root);
    if (document.hidden) {
      fxVisible = false;
      stopFx();
    }
  }

  function bootstrap() {
    const root = document.querySelector("[data-home-sphere-root]");
    if (!root) return;

    const onVisibility = () => {
      if (document.hidden) {
        fxVisible = false;
        stopFx();
      } else if (activeRoot) {
        fxVisible = true;
        drawFx(activeRoot.querySelector("#home-sphere-fx"));
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    if (!("IntersectionObserver" in window)) {
      activateInstrument(root);
      return;
    }

    observer = new IntersectionObserver(async (entries) => {
      const visible = entries[0]?.isIntersecting;
      if (visible) {
        await activateInstrument(root);
      } else {
        deactivateInstrument();
      }
    }, { rootMargin: "180px", threshold: 0.12 });

    observer.observe(root);
  }

  globalThis.HomeObservatoryInstrument = Object.freeze({
    bootstrap,
  });
})();
