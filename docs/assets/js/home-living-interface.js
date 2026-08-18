(() => {
  "use strict";

  const STATE = {
    timer: 0,
    wired: false,
    lastSnapshot: null
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function text(id, value, fallback = "—") {
    const node = byId(id);
    if (!node) return;
    node.textContent =
      value == null || value === ""
        ? fallback
        : String(value);
  }

  function safeCall(fn, fallback = null) {
    try {
      return typeof fn === "function"
        ? fn()
        : fallback;
    } catch {
      return fallback;
    }
  }

  function formatClock(date) {
    try {
      return new Intl.DateTimeFormat(
        undefined,
        {
          hour: "numeric",
          minute: "2-digit"
        }
      ).format(date);
    } catch {
      return date.toLocaleTimeString();
    }
  }

  function formatCivil(date) {
    try {
      return new Intl.DateTimeFormat(
        undefined,
        {
          weekday: "short",
          month: "short",
          day: "numeric"
        }
      ).format(date);
    } catch {
      return date.toLocaleDateString();
    }
  }

  function snapshot() {
    return (
      safeCall(
        () =>
          globalThis
            .LivingTimeSphereLiveData
            ?.getSnapshot?.()
      )
      || null
    );
  }

  function codexState() {
    return (
      safeCall(
        () =>
          globalThis
            .CodexState
            ?.getState?.()
      )
      || null
    );
  }

  function memoryState() {
    return (
      safeCall(
        () =>
          globalThis
            .CodexMemory
            ?.getState?.()
      )
      || null
    );
  }

  function sevenDay() {
    return (
      safeCall(
        () =>
          globalThis
            .CodexMemory
            ?.getSevenDaySummary?.()
      )
      || []
    );
  }

  function changesSinceVisit() {
    return (
      safeCall(
        () =>
          globalThis
            .CodexMemory
            ?.getChangesSinceLastVisit?.(
              codexState()
              || {}
            )
      )
      || []
    );
  }

  function renderClock() {
    const now = new Date();

    text(
      "home-live-clock",
      `${formatClock(now)} · ${formatCivil(now)}`
    );
  }

  function renderTemporal() {
    const snap =
      snapshot();

    if (!snap) {
      renderClock();
      return;
    }

    STATE.lastSnapshot =
      snap;

    const pattern =
      snap.pattern
      || {};

    const solar =
      snap.solar
      || {};

    const lunar =
      snap.lunar
      || {};

    const passage =
      snap.passage
      || {};

    renderClock();

    text(
      "home-live-pattern",
      pattern.moon != null
        ? `Moon ${pattern.moon} · Day ${pattern.day}`
        : "Pattern threshold"
    );

    text(
      "home-live-pattern-sub",
      pattern.dayOfPatternYear != null
        ? `Day ${pattern.dayOfPatternYear}/364`
        : "Outside counted Pattern"
    );

    text(
      "home-live-gate",
      solar.gate
      || solar.season?.label
      || "Solar field"
    );

    text(
      "home-live-gate-sub",
      solar.element
        ? solar.element
        : "Seasonal position"
    );

    text(
      "home-live-lunar",
      lunar.phaseName
      || "Lunar field"
    );

    text(
      "home-live-lunar-sub",
      Number.isFinite(
        lunar.illumination
      )
        ? `${Math.round(
            lunar.illumination
            * 100
          )}% illuminated`
        : "Current phase"
    );

    text(
      "home-live-boundary",
      snap.boundaryMode
        ? String(
            snap.boundaryMode
          )
        : "Local boundary"
    );

    text(
      "home-live-boundary-sub",
      snap.timeZone
      || "Local timezone"
    );

    const passageSummary =
      passage.active
        ? (
            Number.isFinite(
              passage.progress
            )
              ? `Passage active · ${Math.round(
                  passage.progress
                  * 100
                )}%`
              : "Passage active"
          )
        : "Pattern field stable";

    text(
      "home-live-field-status",
      passageSummary
    );

    text(
      "home-live-field-detail",
      pattern.dayOfPatternYear != null
        ? `Current coordinate: Pattern Day ${pattern.dayOfPatternYear}.`
        : "Current coordinate sits outside the regular 364-day Pattern."
    );

    document
      .querySelector(
        "[data-home-live-root]"
      )
      ?.setAttribute(
        "data-pattern-moon",
        pattern.moon != null
          ? String(
              pattern.moon
            )
          : ""
      );
  }

  function renderMemory() {
    const memory =
      memoryState();

    const week =
      sevenDay();

    const changed =
      changesSinceVisit();

    const witnessedDays =
      Array.isArray(
        week
      )
        ? week.filter(
            entry =>
              !!(
                entry?.witnessed
                || entry?.hasWitness
                || entry?.witness
              )
          ).length
        : 0;

    const intention =
      memory?.intention?.value
      || memory?.intention
      || "";

    const practice =
      memory?.unfinishedPractice
      || memory?.practice
      || null;

    const recentActions =
      Array.isArray(
        memory?.recentActions
      )
        ? memory.recentActions.length
        : 0;

    text(
      "home-continuity-witnesses",
      witnessedDays
    );

    text(
      "home-continuity-actions",
      recentActions
    );

    text(
      "home-continuity-changes",
      Array.isArray(
        changed
      )
        ? changed.length
        : 0
    );

    const title =
      practice?.title
      || (
        intention
          ? `Intention: ${intention}`
          : "Your local path is ready."
      );

    text(
      "home-continuity-title",
      title
    );

    let summary =
      "Stored only in this browser.";

    if (
      Array.isArray(
        changed
      )
      && changed.length
    ) {
      summary =
        `${changed.length} change${changed.length === 1 ? "" : "s"} since your last visit.`;
    } else if (
      witnessedDays
    ) {
      summary =
        `${witnessedDays} witnessed day${witnessedDays === 1 ? "" : "s"} in your recent 7-day path.`;
    }

    text(
      "home-continuity-summary",
      summary
    );
  }

  function syncSphereStatus() {
    const status =
      safeCall(
        () =>
          globalThis
            .HomeObservatoryInstrument
            ?.getStatus?.()
      );

    if (!status) {
      return;
    }

    text(
      "home-live-renderer",
      status.renderer === "3d"
        ? "Live 3D"
        : (
            status.phase === "loading"
              ? "Loading"
              : "Accessible"
          )
    );

    text(
      "home-live-renderer-detail",
      status.detail
      || "Shared temporal instrument"
    );
  }

  function render() {
    renderTemporal();
    renderMemory();
    syncSphereStatus();
  }

  function beginClock() {
    if (STATE.timer) {
      clearInterval(
        STATE.timer
      );
    }

    STATE.timer =
      window.setInterval(
        renderClock,
        30000
      );
  }

  function wire() {
    if (STATE.wired) return;
    STATE.wired = true;

    const rerender =
      () => render();

    document.addEventListener(
      "codexstatechange",
      rerender
    );

    document.addEventListener(
      "codexmemorychange",
      rerender
    );

    document.addEventListener(
      "sof:moon-render",
      rerender
    );

    window.addEventListener(
      globalThis
        .SofEnvironmentState
        ?.EVENT_NAME
        || "sof:environment-change",
      rerender
    );

    document.addEventListener(
      "visibilitychange",
      () => {
        if (
          !document.hidden
        ) {
          render();
        }
      }
    );

    window.addEventListener(
      "pageshow",
      render
    );

    window.addEventListener(
      "pagehide",
      () => {
        if (
          STATE.timer
        ) {
          clearInterval(
            STATE.timer
          );
          STATE.timer = 0;
        }
      },
      {
        once:
          true
      }
    );
  }

  function bootstrap() {
    const root =
      document.querySelector(
        "[data-home-live-root]"
      );

    if (!root) return;

    wire();
    render();
    beginClock();

    /*
     * The Sphere itself is intentionally lazy. Poll only the tiny status/
     * snapshot bridge for a few seconds while its dependencies wake up.
     */
    let attempts = 0;

    const wake =
      window.setInterval(
        () => {
          attempts += 1;
          render();

          if (
            (
              globalThis
                .LivingTimeSphereLiveData
                ?.getSnapshot
              && globalThis
                .HomeObservatoryInstrument
                ?.getStatus
            )
            || attempts >= 20
          ) {
            clearInterval(
              wake
            );
          }
        },
        500
      );
  }

  globalThis
    .HomeLivingInterface =
    Object.freeze({
      bootstrap,
      render,
      getSnapshot() {
        return (
          STATE.lastSnapshot
          || snapshot()
        );
      }
    });
})();

/* =====================================================================
 * Phase IVF-D/E — temporal navigation + projection continuity
 * ===================================================================== */
(() => {
  "use strict";

  let depthTimer = 0;
  let navigationWired = false;

  function api() {
    return globalThis
      .HomeObservatoryInstrument
      || null;
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

  function state() {
    try {
      return api()
        ?.getMountState?.()
        || null;
    } catch {
      return null;
    }
  }

  function setText(
    id,
    value
  ) {
    const node =
      document.getElementById(id);

    if (!node) return;

    node.textContent =
      value == null
        ? "—"
        : String(value);
  }

  function normalizeDay(
    value
  ) {
    const day =
      Math.trunc(
        Number(value)
      );

    if (
      !Number.isFinite(day)
    ) {
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

  function moonForDay(
    day
  ) {
    const normalized =
      normalizeDay(day);

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

  function moonDayForDay(
    day
  ) {
    const normalized =
      normalizeDay(day);

    if (!normalized) {
      return null;
    }

    return (
      (
        normalized
        - 1
      )
      % 28
    )
    + 1;
  }

  function selection() {
    const current =
      state()
      || {};

    const live =
      liveSnapshot();

    const liveDay =
      normalizeDay(
        live?.pattern
          ?.dayOfPatternYear
      );

    const selectedDay =
      normalizeDay(
        current.selectedDay
        || liveDay
      );

    const selectedMoon =
      Number(
        current.selectedMoon
      )
      || moonForDay(
        selectedDay
      );

    const selectedYear =
      Number(
        current.selectedYear
        || live?.year
        || new Date().getFullYear()
      );

    return {
      selectedDay,
      selectedMoon,
      selectedYear,
      moonDay:
        moonDayForDay(
          selectedDay
        ),
      liveDay,
      live:
        !!selectedDay
        && !!liveDay
        && selectedDay === liveDay
        && selectedYear
          === Number(
            live?.year
            || selectedYear
          )
    };
  }

  function buildSelectedQuery(
    base,
    {
      hash = ""
    } = {}
  ) {
    const selected =
      selection();

    try {
      const url =
        new URL(
          base,
          document.baseURI
        );

      if (
        selected.selectedYear
      ) {
        url.searchParams.set(
          "year",
          selected.selectedYear
        );
      }

      if (
        selected.selectedDay
      ) {
        url.searchParams.set(
          "marker",
          `day-${selected.selectedDay}`
        );

        url.searchParams.set(
          "selectedDay",
          selected.selectedDay
        );
      }

      if (
        selected.selectedMoon
      ) {
        url.searchParams.set(
          "selectedMoon",
          selected.selectedMoon
        );
      }

      url.searchParams.set(
        "source",
        "home"
      );

      if (
        hash
      ) {
        url.hash =
          hash;
      }

      return (
        url.pathname
        + url.search
        + url.hash
      );
    } catch {
      return base;
    }
  }

  function updateProjectionLinks() {
    const selected =
      selection();

    const sphere =
      document.querySelector(
        '[data-home-projection="sphere"]'
      );

    if (sphere) {
      sphere.href =
        buildSelectedQuery(
          "./living-time-sphere.html"
        );
    }

    const timeline =
      document.querySelector(
        '[data-home-projection="timeline"]'
      );

    if (timeline) {
      timeline.href =
        buildSelectedQuery(
          "./living-time-sphere.html",
          {
            hash:
              "calendar-atlas"
          }
        );
    }

    const atlas =
      document.querySelector(
        '[data-home-projection="atlas"]'
      );

    if (atlas) {
      atlas.href =
        buildSelectedQuery(
          "./living-time-sphere.html",
          {
            hash:
              "observatory-console"
          }
        );
    }

    const network =
      document.querySelector(
        '[data-home-projection="network"]'
      );

    if (network) {
      network.href =
        buildSelectedQuery(
          "./living-time-sphere.html",
          {
            hash:
              "observatory-console"
          }
        );
    }

    const calendar =
      document.querySelector(
        '[data-home-projection="calendar"]'
      );

    if (
      calendar
      && selected.selectedDay
    ) {
      try {
        const url =
          new URL(
            "./moons.html",
            document.baseURI
          );

        url.searchParams.set(
          "source",
          "home"
        );

        url.searchParams.set(
          "patternDay",
          selected.selectedDay
        );

        calendar.href =
          url.pathname
          + url.search;
      } catch {}
    }

    const ledger =
      document.querySelector(
        '[data-home-projection="ledger"]'
      );

    if (
      ledger
      && selected.selectedDay
    ) {
      try {
        const url =
          new URL(
            "./ledger.html",
            document.baseURI
          );

        url.searchParams.set(
          "source",
          "home"
        );

        url.searchParams.set(
          "patternDay",
          selected.selectedDay
        );

        ledger.href =
          url.pathname
          + url.search;
      } catch {}
    }

    const atlasContext =
      document.getElementById(
        "home-context-atlas-link"
      );

    if (atlasContext) {
      atlasContext.href =
        buildSelectedQuery(
          "./living-time-sphere.html",
          {
            hash:
              "observatory-console"
          }
        );
    }
  }

  function renderSelection() {
    const selected =
      selection();

    const scrubber =
      document.querySelector(
        "[data-home-pattern-scrubber]"
      );

    if (
      scrubber
      && selected.selectedDay
    ) {
      scrubber.value =
        String(
          selected.selectedDay
        );
    }

    if (
      !selected.selectedDay
    ) {
      setText(
        "home-time-navigation-value",
        "Threshold"
      );

      return;
    }

    const label =
      selected.live
        ? "Live Pattern coordinate"
        : "Exploring Pattern time";

    const value =
      `Moon ${selected.selectedMoon} · Day ${selected.moonDay} · ${selected.selectedDay}/364`;

    setText(
      "home-time-navigation-label",
      label
    );

    setText(
      "home-time-navigation-value",
      value
    );

    setText(
      "home-context-coordinate",
      selected.live
        ? `Live Today · ${value}`
        : value
    );

    setText(
      "home-context-coordinate-detail",
      selected.live
        ? "The Sphere is aligned to the current live Pattern coordinate."
        : `Exploring ${selected.selectedYear} while preserving the same canonical Pattern coordinate system.`
    );

    document
      .querySelector(
        "[data-home-live-root]"
      )
      ?.setAttribute(
        "data-home-temporal-mode",
        selected.live
          ? "live"
          : "exploring"
      );

    updateProjectionLinks();
  }

  function semanticBand() {
    try {
      const diagnostics =
        api()
          ?.getRendererDiagnostics?.()
        || {};

      return (
        diagnostics.semanticBand
        || diagnostics.currentSemanticBand
        || diagnostics.semanticZoomBand
        || "medium"
      );
    } catch {
      return "medium";
    }
  }

  function renderDepth() {
    const band =
      String(
        semanticBand()
        || "medium"
      ).toLowerCase();

    const root =
      document.querySelector(
        "[data-home-live-root]"
      );

    root?.setAttribute(
      "data-home-semantic-depth",
      band
    );

    const labels = {
      far:
        [
          "Far · Cycle",
          "Major temporal structure is emphasized."
        ],

      medium:
        [
          "Medium · Calendar",
          "Moons, seasonal anchors, and selected Pattern context are emphasized."
        ],

      near:
        [
          "Near · Day",
          "Day-scale gates and nearby temporal relationships become more important."
        ],

      detail:
        [
          "Detail · Records",
          "The full Observatory can expose event, record, media, and relationship context here."
        ]
    };

    const [
      title,
      detail
    ] =
      labels[band]
      || labels.medium;

    setText(
      "home-context-depth",
      title
    );

    setText(
      "home-context-depth-detail",
      detail
    );
  }

  function navigateTo(
    day
  ) {
    const normalized =
      normalizeDay(day);

    if (!normalized) {
      return;
    }

    api()
      ?.selectPatternDay?.(
        normalized
      );

    window.requestAnimationFrame(
      () => {
        renderSelection();
        renderDepth();
      }
    );
  }

  function wireNavigation() {
    if (
      navigationWired
    ) {
      return;
    }

    navigationWired =
      true;

    document.addEventListener(
      "click",
      event => {
        const shift =
          event.target
            ?.closest?.(
              "[data-home-time-shift]"
            );

        if (shift) {
          const delta =
            Number(
              shift.getAttribute(
                "data-home-time-shift"
              )
            );

          api()
            ?.shiftPatternDay?.(
              delta
            );

          window.requestAnimationFrame(
            renderSelection
          );

          return;
        }

        const today =
          event.target
            ?.closest?.(
              "[data-home-time-today]"
            );

        if (today) {
          api()
            ?.returnToday?.();

          window.requestAnimationFrame(
            renderSelection
          );
        }
      }
    );

    const scrubber =
      document.querySelector(
        "[data-home-pattern-scrubber]"
      );

    scrubber?.addEventListener(
      "input",
      () => {
        const day =
          normalizeDay(
            scrubber.value
          );

        if (!day) return;

        const moon =
          moonForDay(
            day
          );

        const moonDay =
          moonDayForDay(
            day
          );

        setText(
          "home-time-navigation-label",
          "Preview Pattern coordinate"
        );

        setText(
          "home-time-navigation-value",
          `Moon ${moon} · Day ${moonDay} · ${day}/364`
        );
      }
    );

    scrubber?.addEventListener(
      "change",
      () => {
        navigateTo(
          scrubber.value
        );
      }
    );

    document.addEventListener(
      "sof:home-temporal-selection",
      () => {
        renderSelection();
        renderDepth();
      }
    );
  }

  function bootstrapDepth() {
    wireNavigation();

    renderSelection();
    renderDepth();

    if (
      depthTimer
    ) {
      clearInterval(
        depthTimer
      );
    }

    /*
     * Low-rate semantic diagnostic sampling only.
     * No geometry work and no new animation loop.
     */
    depthTimer =
      window.setInterval(
        () => {
          if (
            document.hidden
          ) {
            return;
          }

          renderDepth();
        },
        900
      );

    window.addEventListener(
      "pagehide",
      () => {
        if (
          depthTimer
        ) {
          clearInterval(
            depthTimer
          );

          depthTimer = 0;
        }
      },
      {
        once:
          true
      }
    );
  }

  document.addEventListener(
    "DOMContentLoaded",
    bootstrapDepth
  );
})();

/* =====================================================================
 * Phase IVF-F/G — deferred Life Atlas context
 * ===================================================================== */
(() => {
  "use strict";

  const LIFE_ATLAS_MODULES = Object.freeze([
    "assets/js/life-atlas/life-atlas-schema.js",
    "assets/js/life-atlas/life-atlas-repository.js",
    "assets/js/life-atlas/life-atlas-indexeddb.js",
    "assets/js/life-atlas/life-atlas-runtime.js"
  ]);

  let bootPromise = null;
  let observer = null;
  let records = [];
  let lastSelectionKey = "";

  function byId(id) {
    return document.getElementById(id);
  }

  function text(id, value) {
    const node = byId(id);
    if (!node) return;

    node.textContent =
      value == null
        ? "—"
        : String(value);
  }

  function currentSelection() {
    const state =
      globalThis
        .HomeObservatoryInstrument
        ?.getMountState?.()
      || {};

    const live =
      globalThis
        .LivingTimeSphereLiveData
        ?.getSnapshot?.()
      || {};

    const selectedDay =
      Number(
        state.selectedDay
        || live?.pattern
          ?.dayOfPatternYear
      )
      || null;

    const selectedYear =
      Number(
        state.selectedYear
        || live?.year
        || new Date().getFullYear()
      )
      || null;

    const liveDay =
      Number(
        live?.pattern
          ?.dayOfPatternYear
      )
      || null;

    const liveYear =
      Number(
        live?.year
      )
      || selectedYear;

    return {
      selectedDay,
      selectedYear,
      liveDay,
      liveYear
    };
  }

  function absolutePatternCoordinate(
    year,
    day
  ) {
    if (
      !Number.isFinite(
        Number(year)
      )
      || !Number.isFinite(
        Number(day)
      )
    ) {
      return null;
    }

    return (
      Number(year)
      * 364
      + Number(day)
    );
  }

  function recordYear(record) {
    return Number(
      record?.temporal
        ?.patternYear
      || record?.temporal
        ?.year
      || record?.patternYear
      || record?.year
    )
    || null;
  }

  function recordDay(record) {
    return Number(
      record?.temporal
        ?.patternDay
      || record?.temporal
        ?.dayOfPatternYear
      || record?.patternDay
    )
    || null;
  }

  function temporalRelation(
    record,
    selection
  ) {
    const year =
      recordYear(
        record
      );

    const day =
      recordDay(
        record
      );

    const recordCoordinate =
      absolutePatternCoordinate(
        year,
        day
      );

    const selectedCoordinate =
      absolutePatternCoordinate(
        selection.selectedYear,
        selection.selectedDay
      );

    if (
      recordCoordinate == null
      || selectedCoordinate == null
    ) {
      return "unknown";
    }

    if (
      recordCoordinate
      === selectedCoordinate
    ) {
      return "selected";
    }

    return recordCoordinate
      < selectedCoordinate
        ? "past"
        : "future";
  }

  function distanceFromSelection(
    record,
    selection
  ) {
    const rc =
      absolutePatternCoordinate(
        recordYear(record),
        recordDay(record)
      );

    const sc =
      absolutePatternCoordinate(
        selection.selectedYear,
        selection.selectedDay
      );

    if (
      rc == null
      || sc == null
    ) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.abs(
      rc - sc
    );
  }

  function privacyLabel(record) {
    const visibility =
      String(
        record?.visibility
        || "private"
      ).toLowerCase();

    return visibility === "private"
      ? "Local only"
      : visibility;
  }

  function titleFor(record) {
    return (
      record?.title
      || record?.summary
      || record?.type
      || "Life Atlas record"
    );
  }

  function createNearbyCard(
    record,
    relation
  ) {
    const card =
      document.createElement(
        "article"
      );

    card.className =
      "home-life-atlas-record";

    card.dataset.temporalState =
      relation;

    const title =
      document.createElement(
        "strong"
      );

    title.textContent =
      titleFor(
        record
      );

    const meta =
      document.createElement(
        "span"
      );

    const year =
      recordYear(
        record
      );

    const day =
      recordDay(
        record
      );

    meta.textContent =
      [
        relation,
        year
          ? `Year ${year}`
          : null,
        day
          ? `Pattern ${day}`
          : null,
        privacyLabel(
          record
        )
      ]
        .filter(Boolean)
        .join(" · ");

    card.append(
      title,
      meta
    );

    return card;
  }

  function renderAtlasContext() {
    const host =
      byId(
        "home-life-atlas-nearby"
      );

    const list =
      byId(
        "home-life-atlas-nearby-list"
      );

    if (
      !host
      || !list
    ) {
      return;
    }

    const selection =
      currentSelection();

    const key =
      [
        selection.selectedYear,
        selection.selectedDay,
        records.length
      ].join("|");

    if (
      key === lastSelectionKey
    ) {
      return;
    }

    lastSelectionKey =
      key;

    const counts = {
      past: 0,
      selected: 0,
      future: 0
    };

    const nearby =
      [];

    for (
      const record
      of records
    ) {
      const relation =
        temporalRelation(
          record,
          selection
        );

      if (
        relation in counts
      ) {
        counts[
          relation
        ] += 1;
      }

      const distance =
        distanceFromSelection(
          record,
          selection
        );

      if (
        Number.isFinite(
          distance
        )
        && distance <= 28
      ) {
        nearby.push({
          record,
          relation,
          distance
        });
      }
    }

    nearby.sort(
      (
        a,
        b
      ) =>
        a.distance
        - b.distance
        || String(
          titleFor(a.record)
        ).localeCompare(
          String(
            titleFor(b.record)
          )
        )
    );

    text(
      "home-atlas-past-count",
      counts.past
    );

    text(
      "home-atlas-selected-count",
      counts.selected
    );

    text(
      "home-atlas-future-count",
      counts.future
    );

    text(
      "home-context-records",
      records.length
        ? `${records.length} local record${records.length === 1 ? "" : "s"}`
        : "No Life Atlas records yet"
    );

    if (
      !records.length
    ) {
      text(
        "home-context-records-detail",
        "The Life Atlas is ready. Import or create records in the Observatory when you want this temporal field to carry personal history."
      );

      host.hidden =
        true;

      list.replaceChildren();

      return;
    }

    text(
      "home-context-records-detail",
      counts.selected
        ? `${counts.selected} record${counts.selected === 1 ? "" : "s"} occupy the selected Pattern coordinate.`
        : "No record occupies this exact coordinate; nearby context remains available."
    );

    list.replaceChildren();

    for (
      const item
      of nearby.slice(
        0,
        5
      )
    ) {
      list.appendChild(
        createNearbyCard(
          item.record,
          item.relation
        )
      );
    }

    host.hidden =
      !list.childElementCount;
  }

  function loadScript(src) {
    return new Promise(
      (
        resolve,
        reject
      ) => {
        const existing =
          Array.from(
            document.scripts
          ).find(
            script =>
              script.src
              && script.src.endsWith(
                src.replace(
                  /^\.?\//,
                  ""
                )
              )
          );

        if (
          existing
        ) {
          resolve();
          return;
        }

        const script =
          document.createElement(
            "script"
          );

        script.src =
          src;

        script.defer =
          true;

        script.dataset.homeDeferredLifeAtlas =
          "true";

        script.addEventListener(
          "load",
          resolve,
          {
            once: true
          }
        );

        script.addEventListener(
          "error",
          () =>
            reject(
              new Error(
                `Unable to load ${src}`
              )
            ),
          {
            once: true
          }
        );

        document.head.appendChild(
          script
        );
      }
    );
  }

  async function ensureLifeAtlas() {
    if (
      globalThis
        .CodexLifeAtlasRuntime
        ?.records
    ) {
      return globalThis
        .CodexLifeAtlasRuntime;
    }

    if (
      bootPromise
    ) {
      return bootPromise;
    }

    bootPromise =
      (
        async () => {
          for (
            const src
            of LIFE_ATLAS_MODULES
          ) {
            await loadScript(
              src
            );
          }

          const runtime =
            globalThis
              .CodexLifeAtlasRuntime;

          if (
            !runtime
          ) {
            throw new Error(
              "Life Atlas runtime did not initialize."
            );
          }

          if (
            runtime.ready
          ) {
            await runtime.ready;
          }

          return runtime;
        }
      )();

    return bootPromise;
  }

  async function refreshRecords() {
    try {
      text(
        "home-context-records",
        "Loading local Life Atlas…"
      );

      const runtime =
        await ensureLifeAtlas();

      records =
        await runtime.records();

      if (
        !Array.isArray(
          records
        )
      ) {
        records = [];
      }

      lastSelectionKey =
        "";

      renderAtlasContext();
    } catch (error) {
      text(
        "home-context-records",
        "Life Atlas unavailable"
      );

      text(
        "home-context-records-detail",
        "The homepage stayed functional without loading personal record context."
      );

      console.warn(
        "[HomeLivingInterface] Life Atlas context unavailable.",
        error
      );
    }
  }

  function bootstrapAtlasContext() {
    const host =
      document.querySelector(
        "[data-home-life-atlas]"
      );

    if (
      !host
    ) {
      return;
    }

    const begin =
      () => {
        observer?.disconnect?.();
        observer = null;

        void refreshRecords();
      };

    if (
      !(
        "IntersectionObserver"
        in window
      )
    ) {
      begin();
      return;
    }

    observer =
      new IntersectionObserver(
        entries => {
          if (
            entries.some(
              entry =>
                entry.isIntersecting
            )
          ) {
            begin();
          }
        },
        {
          rootMargin:
            "500px 0px",
          threshold:
            0.01
        }
      );

    observer.observe(
      host
    );

    window.addEventListener(
      "sof:life-atlas-records-changed",
      refreshRecords
    );

    document.addEventListener(
      "sof:home-temporal-selection",
      () => {
        lastSelectionKey =
          "";

        renderAtlasContext();
      }
    );

    window.addEventListener(
      "pagehide",
      () => {
        observer?.disconnect?.();
        observer = null;
      },
      {
        once: true
      }
    );
  }

  document.addEventListener(
    "DOMContentLoaded",
    bootstrapAtlasContext
  );
})();
