(() => {
  "use strict";

  // The homepage uses the same model and renderer stack as the full Observatory.
  // Dependencies are lazy but execute in strict order so dependants never race.
  const REQUIRED_DEPENDENCIES = [
    "assets/js/calendar/pattern-calendar-version.js",
    "assets/js/calendar/pattern-calendar-data.js",
    "assets/js/calendar/pattern-calendar-format.js",
    "assets/js/calendar/pattern-calendar-boundary.js",
    "assets/js/calendar/pattern-calendar.js",
    "assets/js/calendar/temporal-coordinate-engine.js",
    "assets/js/calendar/temporal-cursor-controller.js",
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
    "assets/js/sphere/observatory-capability-manager.js",
    "assets/js/sphere/living-time-sphere-model.js",
    "assets/js/sphere/living-time-sphere-state.js",
    "assets/js/sphere/living-time-sphere-semantic-zoom.js",
    "assets/js/sphere/living-time-sphere-layout.js",
    "assets/js/sphere/living-time-sphere-connections.js",
    "assets/js/sphere/living-time-sphere-renderer-svg.js",
    "assets/js/sphere/living-time-sphere-renderer-canvas.js",
    "assets/js/sphere/living-time-sphere-materials.js",
    "assets/js/sphere/living-time-sphere-effects.js",
    "assets/js/sphere/living-time-sphere-camera.js",
    "assets/js/sphere/living-time-sphere-animation.js",
    "assets/js/sphere/living-time-sphere-label-manager.js",
    "assets/js/sphere/living-time-sphere-renderer-3d.js",
    "assets/js/sphere/living-time-sphere-live-data.js",
    "assets/js/sphere/living-time-sphere-mount.js",
    "assets/js/sphere/living-time-sphere-today.js"
  ];

  const OPTIONAL_ENVIRONMENT_DEPENDENCIES = [
    "assets/js/environment/environment-state.js",
    "assets/js/environment/providers/open-meteo-forecast.js",
    "assets/js/environment/open-meteo-adapter.js"
  ];

  let loadingPromise = null;
  let bootPromise = null;
  let activeRoot = null;
  let activeMount = null;
  let viewportObserver = null;
  let fxRaf = 0;
  let fxVisible = false;
  let listenersWired = false;
  let lastStatus = Object.freeze({ phase: "idle", renderer: null, detail: "Waiting to enter view" });

  function resolveUrl(path) {
    try { return new URL(path, document.baseURI).toString(); }
    catch { return path; }
  }

  function loadScript(path) {
    const src = resolveUrl(path);
    const existing = Array.from(document.scripts).find(script => script.src === src);
    if (existing?.dataset.loaded === "true") return Promise.resolve();
    if (existing && document.readyState !== "loading") {
      existing.dataset.loaded = "true";
      return Promise.resolve();
    }
    if (existing) {
      return new Promise((resolve, reject) => {
        existing.addEventListener("load", () => {
          existing.dataset.loaded = "true";
          resolve();
        }, { once: true });
        existing.addEventListener("error", () => reject(new Error(`Failed loading ${path}`)), { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.async = false;
      script.src = src;
      script.dataset.homeSphereDependency = "true";
      script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        resolve();
      }, { once: true });
      script.addEventListener("error", () => reject(new Error(`Failed loading ${path}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  async function ensureDependencies() {
    if (loadingPromise) return loadingPromise;
    loadingPromise = (async () => {
      for (const path of REQUIRED_DEPENDENCIES) await loadScript(path);
      const optional = await Promise.allSettled(OPTIONAL_ENVIRONMENT_DEPENDENCIES.map(loadScript));
      optional.filter(result => result.status === "rejected").forEach(result => {
        console.warn("[HomeObservatoryInstrument] Optional environment dependency failed:", result.reason);
      });
      if (!globalThis.LivingTimeSphere?.mount || !globalThis.LivingTimeSphereLiveData?.getSnapshot) {
        throw new Error("The canonical Sphere mount did not become available.");
      }
    })().catch(error => {
      loadingPromise = null;
      throw error;
    });
    return loadingPromise;
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value == null || value === "" ? "—" : String(value);
  }

  function setStatus(root, phase, renderer, detail) {
    lastStatus = Object.freeze({ phase, renderer: renderer || null, detail: detail || "" });
    const stage = root?.querySelector("[data-home-sphere-stage]");
    const status = root?.querySelector("#home-sphere-render-state");
    stage?.classList.toggle("has-renderer-3d", renderer === "3d");
    stage?.classList.toggle("has-renderer-fallback", renderer === "svg" && phase !== "loading");
    if (status) status.textContent = detail || (renderer === "3d" ? "Live 3D sphere" : "Accessible sphere");
  }

  function formatPassage(snapshot) {
    const passage = snapshot?.passage;
    if (!passage) return "Passage unavailable";
    if (passage.active) {
      if (Number.isFinite(passage.progress)) return `Active · ${Math.round(passage.progress * 100)}%`;
      return "Passage active";
    }
    return "Passage at rest";
  }

  function updateTelemetry(root, suppliedSnapshot) {
    const snapshot = suppliedSnapshot || globalThis.LivingTimeSphereLiveData?.getSnapshot?.() || null;
    if (!snapshot) return;
    const pattern = snapshot.pattern || {};
    const lunar = snapshot.lunar || {};
    const solar = snapshot.solar || {};
    const patternText = pattern.moon != null
      ? `Moon ${pattern.moon} · Day ${pattern.day} · ${pattern.dayOfPatternYear}/364`
      : "Outside counted Pattern";
    const lunarText = lunar.phaseName
      ? `${lunar.phaseName}${Number.isFinite(lunar.illumination) ? ` · ${Math.round(lunar.illumination * 100)}%` : ""}`
      : "Lunar state unavailable";
    const solarText = solar.gate
      ? `${solar.gate}${solar.element ? ` · ${solar.element}` : ""}`
      : (solar.season?.label || "Solar state unavailable");
    const passageText = formatPassage(snapshot);

    setText("home-sphere-today-pattern", patternText);
    setText("home-sphere-today-lunar", lunarText);
    setText("home-sphere-today-solar", solarText);
    setText("home-sphere-today-passage", passageText);
    setText("home-sphere-today-witness", snapshot.witness?.label || "Witness data remains private in this browser.");

    const accessible = root.querySelector("#home-sphere-today-accessible");
    if (accessible) accessible.textContent = [patternText, lunarText, solarText, passageText].join(". ");
    const preview = root.querySelector("#home-sphere-today-preview");
    preview?.setAttribute("aria-label", `Living Time Sphere. ${patternText}. ${lunarText}. ${solarText}. ${passageText}.`);

    const link = root.querySelector("#home-sphere-today-open-link");
    if (link && globalThis.LivingTimeSphereTodayCard?.buildLink) {
      link.href = globalThis.LivingTimeSphereTodayCard.buildLink({
        year: snapshot.year,
        timeZone: snapshot.timeZone,
        boundaryMode: snapshot.boundaryMode,
        manualSunset: snapshot.manualSunset,
        source: "home",
        viewMode: "today",
        layers: ["pattern", "lunar", "solar", "passage", "markers", "spiral", "recurrence", "connections"]
      });
    }
  }

  function stopFx() {
    if (fxRaf) cancelAnimationFrame(fxRaf);
    fxRaf = 0;
  }

  function drawFx(canvas) {
    if (!canvas || !fxVisible) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    const glow = context.createRadialGradient(width / 2, height / 2, width * 0.04, width / 2, height / 2, width * 0.52);
    glow.addColorStop(0, "rgba(122,243,255,.1)");
    glow.addColorStop(0.55, "rgba(251,191,36,.035)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
    if (!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      fxRaf = requestAnimationFrame(() => drawFx(canvas));
    }
  }

  function rendererChanged(root, event) {
    const renderer = event?.activeRenderer || event?.renderer || null;
    const phase = event?.phase || (renderer === "3d" ? "ready" : "fallback");
    if (renderer === "3d") {
      setStatus(root, phase, "3d", "Live 3D sphere");
    } else if (phase === "loading" || phase === "upgrading") {
      setStatus(root, "loading", "svg", "Accessible sphere · upgrading to 3D");
    } else {
      const reason = event?.reason === "WEBGL_UNAVAILABLE" ? "WebGL unavailable" : "Device-safe renderer";
      setStatus(root, "ready", "svg", `Accessible sphere · ${reason}`);
    }
    root.querySelector("#home-sphere-today-preview")?.setAttribute("aria-busy", "false");
  }

  async function mountInstrument(root) {
    if (activeMount) return activeMount;
    setStatus(root, "loading", null, "Loading sphere engine");
    await ensureDependencies();
    const preview = root.querySelector("#home-sphere-today-preview");
    if (!preview) throw new Error("Homepage Sphere container is missing.");

    const mounted = globalThis.LivingTimeSphere.mount({
      container: preview,
      runtimeProfile: "instrument",
      compact: true,
      renderer: "auto",
      quality: "auto",
      mode: "today",
      initTimeoutMs: 10000,
      visibleLayers: {
        pattern: true,
        exactDays: true,
        weekGates: true,
        outsideDays: true,
        lunar: true,
        solar: true,
        passage: true,
        markers: true,
        spiral: true,
        recurrence: true,
        environment: false,
        witness: false,
        personal: false,
        connections: true
      },
      state: {
        dayLabelMode: "selected",
        moonLabelMode: "essential",
        connectionMode: "selected",
        motionMode: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "reduced" : "full"
      },
      onStateChange(payload) { updateTelemetry(root, payload?.snapshot); },
      onRendererChange(payload) { rendererChanged(root, payload); }
    });
    if (!mounted) throw new Error("The shared Sphere mount rejected the homepage container.");
    activeMount = mounted;
    preview.__livingTimeSphereMount = mounted;
    preview.setAttribute("aria-busy", "false");
    updateTelemetry(root);
    setStatus(root, "upgrading", "svg", "Accessible sphere · upgrading to 3D");
    mounted.activate?.();
    return mounted;
  }

  function wireListeners(root) {
    if (listenersWired) return;
    listenersWired = true;
    const refresh = () => {
      if (!activeMount) return;
      activeMount.refresh?.({});
      updateTelemetry(root);
    };
    window.addEventListener(globalThis.SofEnvironmentState?.EVENT_NAME || "sof:environment-change", refresh);
    document.addEventListener("visibilitychange", () => {
      fxVisible = !document.hidden && !!activeRoot;
      if (fxVisible) drawFx(root.querySelector("#home-sphere-fx"));
      else stopFx();
    });
    window.addEventListener("pagehide", () => {
      stopFx();
      viewportObserver?.disconnect?.();
      activeMount?.teardown?.();
      activeMount = null;
    }, { once: true });
  }

  async function activate(root) {
    activeRoot = root;
    fxVisible = !document.hidden;
    if (fxVisible && !fxRaf) drawFx(root.querySelector("#home-sphere-fx"));
    if (!bootPromise) {
      bootPromise = mountInstrument(root).catch(error => {
        bootPromise = null;
        setStatus(root, "error", "svg", "Sphere unavailable · open Observatory");
        root.querySelector("#home-sphere-today-preview")?.setAttribute("aria-busy", "false");
        console.error("[HomeObservatoryInstrument]", error);
        throw error;
      });
    }
    return bootPromise;
  }

  function bootstrap() {
    const root = document.querySelector("[data-home-sphere-root]");
    if (!root || viewportObserver) return;
    wireListeners(root);
    if (!("IntersectionObserver" in window)) {
      activate(root).catch(() => {});
      return;
    }
    viewportObserver = new IntersectionObserver(entries => {
      const visible = entries.some(entry => entry.isIntersecting);
      if (visible) {
        activeMount?.activate?.();
        activate(root).catch(() => {});
      } else {
        fxVisible = false;
        stopFx();
        activeMount?.suspend?.();
      }
    }, { rootMargin: "320px 0px", threshold: 0.01 });
    viewportObserver.observe(root);
  }

  function getMountState() {
    try {
      return activeMount?.getState?.() || null;
    } catch {
      return null;
    }
  }

  function getRendererDiagnostics() {
    try {
      return globalThis
        .LivingTimeSphereRenderer3d
        ?.getDiagnostics?.()
        || null;
    } catch {
      return null;
    }
  }

  function liveSnapshot() {
    try {
      return globalThis
        .LivingTimeSphereLiveData
        ?.getSnapshot?.()
        || null;
    } catch {
      return null;
    }
  }

  function normalizePatternDay(value) {
    const day =
      Math.trunc(
        Number(value)
      );

    if (!Number.isFinite(day)) {
      return null;
    }

    return Math.max(
      1,
      Math.min(
        364,
        day
      )
    );
  }

  function moonForPatternDay(day) {
    const normalized =
      normalizePatternDay(day);

    if (!normalized) {
      return null;
    }

    return Math.floor(
      (
        normalized
        - 1
      )
      / 28
    )
    + 1;
  }

  function patternDateForSelection(
    year,
    day
  ) {
    const selectedDay =
      normalizePatternDay(day);

    const epoch =
      globalThis.PatternCalendar
        ?.epochForYear?.(
          Number(year)
        );

    if (
      !selectedDay ||
      !(epoch instanceof Date) ||
      Number.isNaN(epoch.getTime())
    ) {
      return null;
    }

    return new Date(
      epoch.getTime()
      + (selectedDay - 1) * 86400000
    );
  }

  function canonicalSelection(
    snapshot,
    fallback = {}
  ) {
    const remnant =
      snapshot?.coordinate
        ?.remnant13Moons;

    const selectedDay =
      normalizePatternDay(
        remnant?.patternDay
        || fallback.selectedDay
      );

    const selectedYear =
      Number(
        remnant?.patternYear
        || fallback.selectedYear
      );

    const selectedMoon =
      Number(
        remnant?.moon
        || fallback.selectedMoon
        || moonForPatternDay(
          selectedDay
        )
      );

    return {
      selectedDay,
      selectedYear,
      selectedMoon,
      cursorRevision:
        Number(snapshot?.revision) || 0,
      canonicalIso:
        snapshot?.iso || null
    };
  }

  function emitTemporalSelection(
    detail
  ) {
    try {
      document.dispatchEvent(
        new CustomEvent(
          "sof:home-temporal-selection",
          {
            detail:
              Object.freeze(
                {
                  ...detail
                }
              )
          }
        )
      );
    } catch {}
  }

  function selectPatternDay(
    requestedDay,
    {
      source =
        "home-control"
    } = {}
  ) {
    if (!activeMount) {
      return false;
    }

    const selectedDay =
      normalizePatternDay(
        requestedDay
      );

    if (!selectedDay) {
      return false;
    }

    const current =
      getMountState()
      || {};

    const snap =
      liveSnapshot();

    const requestedYear =
      Number(
        current.selectedYear
        || snap?.year
        || new Date().getFullYear()
      );

    const requestedMoon =
      moonForPatternDay(
        selectedDay
      );

    const targetDate =
      patternDateForSelection(
        requestedYear,
        selectedDay
      );

    const cursor =
      globalThis.SOFTemporalCursor;

    let resolved = {
      selectedYear:
        requestedYear,
      selectedDay,
      selectedMoon:
        requestedMoon,
      cursorRevision: 0,
      canonicalIso: null
    };

    if (
      cursor?.setDate &&
      targetDate instanceof Date &&
      !Number.isNaN(
        targetDate.getTime()
      )
    ) {
      const cursorSnapshot =
        cursor.setDate(
          targetDate,
          {
            source,
            reason:
              "home-pattern-day"
          }
        );

      resolved =
        canonicalSelection(
          cursorSnapshot,
          resolved
        );
    }

    if (!resolved.selectedDay) {
      return false;
    }

    activeMount.refresh?.({
      selectedYear:
        resolved.selectedYear,
      selectedDay:
        resolved.selectedDay,
      selectedMoon:
        resolved.selectedMoon,
      selectedMarker:
        `day-${resolved.selectedDay}`
    });

    updateTelemetry(
      activeRoot
      || document.querySelector(
        "[data-home-sphere-root]"
      )
    );

    emitTemporalSelection({
      ...resolved,
      source,
      live:
        Number(
          snap?.pattern
            ?.dayOfPatternYear
        )
        === resolved.selectedDay
        &&
        Number(
          snap?.pattern?.patternYear
          || snap?.year
        )
        === Number(
          resolved.selectedYear
        )
    });

    return true;
  }

  function shiftPatternDay(
    delta
  ) {
    if (!activeMount) {
      return false;
    }

    const current =
      getMountState()
      || {};

    const snap =
      liveSnapshot();

    const startingDay =
      normalizePatternDay(
        current.selectedDay
        || snap?.pattern
          ?.dayOfPatternYear
        || 1
      )
      || 1;

    const shift =
      Math.trunc(
        Number(delta)
        || 0
      );

    const selectedDay =
      (
        (
          startingDay
          - 1
          + shift
        )
        % 364
        + 364
      )
      % 364
      + 1;

    return selectPatternDay(
      selectedDay,
      {
        source:
          shift < 0
            ? "home-previous"
            : "home-next"
      }
    );
  }

  function returnToday() {
    if (!activeMount) {
      return false;
    }

    const snap =
      liveSnapshot();

    const cursor =
      globalThis.SOFTemporalCursor;

    const cursorSnapshot =
      cursor?.today?.({
        source:
          "home-today",
        reason:
          "home-today"
      })
      || null;

    const fallbackDay =
      normalizePatternDay(
        snap?.pattern
          ?.dayOfPatternYear
      );

    const fallback = {
      selectedDay:
        fallbackDay,
      selectedYear:
        Number(
          snap?.pattern?.patternYear
          || snap?.year
          || new Date().getFullYear()
        ),
      selectedMoon:
        moonForPatternDay(
          fallbackDay
        )
    };

    const resolved =
      canonicalSelection(
        cursorSnapshot,
        fallback
      );

    if (!resolved.selectedDay) {
      activeMount.refresh?.({
        mode:
          "today"
      });

      emitTemporalSelection({
        source:
          "home-today",
        live:
          true,
        cursorRevision:
          resolved.cursorRevision,
        canonicalIso:
          resolved.canonicalIso
      });

      return true;
    }

    activeMount.refresh?.({
      mode:
        "today",
      selectedYear:
        resolved.selectedYear,
      selectedDay:
        resolved.selectedDay,
      selectedMoon:
        resolved.selectedMoon,
      selectedMarker:
        `day-${resolved.selectedDay}`
    });

    updateTelemetry(
      activeRoot
      || document.querySelector(
        "[data-home-sphere-root]"
      ),
      snap
    );

    emitTemporalSelection({
      ...resolved,
      source:
        "home-today",
      live:
        true
    });

    return true;
  }

  globalThis.HomeObservatoryInstrument = Object.freeze({
    bootstrap,

    retry() {
      const root =
        activeRoot
        || document.querySelector(
          "[data-home-sphere-root]"
        );

      return root
        ? activate(root)
        : Promise.resolve(null);
    },

    getStatus() {
      return lastStatus;
    },

    getMountState,

    getRendererDiagnostics,

    selectPatternDay,

    shiftPatternDay,

    returnToday
  });
})();
