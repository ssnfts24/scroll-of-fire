(() => {
  "use strict";

  /*
   * Sphere preview options (R2 rework).
   *
   * One small settings store for the reworked sphere, persisted on
   * this device only (localStorage). Every option defaults to the
   * sphere's current, doctrine-true behaviour; the visitor flips a
   * switch and the sphere answers immediately, so the choices can be
   * judged in the hand, not in the abstract.
   *
   *   labelMode    "fit" — Moon names: show what fits, no overlaps
   *                (the Sphere page rebuild's default, Nov 20, 2026:
   *                the audit's F5 — clustered Moon names at the top
   *                of the ring — is answered by the placement
   *                engine's fit mode standing as the default).
   *                "always" — Moon names: always show all (the
   *                B7.55/B7.57 persistent-identity doctrine), one
   *                flip away in the options panel for any keeper
   *                who prefers every name at any cost.
   *   zoomFeel     "current" — selecting a day leaves the camera be.
   *                "deep" — selecting a day flies the camera in close
   *                to that day, while the page's existing "Zoom Into
   *                This Day" panel (the day-zoom module, untouched by
   *                this rework) fills with the day's records.
   *   skyIntensity "full" — weather sky at full strength.
   *                "calm" — weather sky softened.
   *   governor     true — the adaptive-quality governor is on: when
   *                frames run long it sheds cloud density, then pixel
   *                ratio, then floating labels and effects, and gives
   *                them back as the device recovers.
   *                false — quality behaves exactly as today.
   */

  const VERSION = "living-time-sphere-options/1.0.0";
  const STORAGE_KEY = "lts-r2-options";

  const DEFAULTS = Object.freeze({
    labelMode: "fit",
    zoomFeel: "current",
    skyIntensity: "full",
    governor: true
  });

  function normalize(raw) {
    const value = raw && typeof raw === "object" ? raw : {};
    return {
      labelMode: value.labelMode === "always" ? "always" : "fit",
      zoomFeel: value.zoomFeel === "deep" ? "deep" : "current",
      skyIntensity: value.skyIntensity === "calm" ? "calm" : "full",
      governor: value.governor !== false
    };
  }

  function load() {
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      return normalize(raw ? JSON.parse(raw) : null);
    } catch {
      return { ...DEFAULTS };
    }
  }

  let current = load();
  const listeners = new Set();

  function persist() {
    try {
      globalThis.localStorage?.setItem(
        STORAGE_KEY,
        JSON.stringify(current)
      );
    } catch { /* private mode — settings live for the session only */ }
  }

  function syncGovernor() {
    try {
      globalThis.LivingTimeSphereQualityGovernor?.setEnabled?.(
        current.governor
      );
    } catch { /* governor module absent — nothing to sync */ }
  }

  function get() {
    return { ...current };
  }

  function set(patch) {
    const next = normalize({ ...current, ...(patch || {}) });
    const changed =
      next.labelMode !== current.labelMode
      || next.zoomFeel !== current.zoomFeel
      || next.skyIntensity !== current.skyIntensity
      || next.governor !== current.governor;
    current = next;
    persist();
    syncGovernor();
    if (!changed) return get();
    for (const listener of listeners) {
      try { listener(get()); } catch { /* listener errors stay local */ }
    }
    try {
      globalThis.dispatchEvent?.(
        new CustomEvent("lts:options-change", { detail: get() })
      );
    } catch { /* older engines — listeners above still fired */ }
    try {
      globalThis.LivingTimeSphereAnimation?.markDirty?.();
      globalThis.LivingTimeSphereRenderer3d?.requestSingleRender?.();
    } catch { /* sphere not mounted — settings apply on next load */ }
    return get();
  }

  function onChange(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  syncGovernor();

  /* ── Deep zoom: selecting a day flies the camera in close ─────── */

  let lastFlownDay = null;
  let sawFirstCursorChange = false;
  let flyTimer = null;

  function patternDayFrom(source) {
    // The canonical day lives on the temporal coordinate, not on the
    // cursor snapshot's top level.
    return Number(
      source?.coordinate?.remnant13Moons?.patternDay
      ?? source?.patternDay
    );
  }

  function onCursorChange(event) {
    if (current.zoomFeel !== "deep") return;
    // The first cursor event after load is the opening state, not a
    // selection — never hijack the sphere's designed first frame.
    if (!sawFirstCursorChange) {
      sawFirstCursorChange = true;
      return;
    }
    const day = patternDayFrom(
      event?.detail || globalThis.SOFTemporalCursor?.getState?.()
    );
    if (!Number.isFinite(day) || day < 1 || day > 364) return;
    if (day === lastFlownDay) return;
    if (flyTimer) clearTimeout(flyTimer);
    flyTimer = setTimeout(() => {
      flyTimer = null;
      if (current.zoomFeel !== "deep") return;
      const renderer = globalThis.LivingTimeSphereRenderer3d;
      if (!renderer?.isInitialized?.()) return;
      lastFlownDay = day;
      renderer.focusPatternDay?.(day, {
        distance: 1.25,
        animated: true
      });
    }, 300);
  }

  try {
    globalThis.addEventListener?.(
      "sof:temporal-cursor-change",
      onCursorChange
    );
  } catch { /* no window events — deep zoom simply stays off */ }

  /* ── Options panel ────────────────────────────────────────────── */

  const FIELDS = Object.freeze([
    Object.freeze({
      key: "labelMode",
      label: "Moon names",
      choices: Object.freeze([
        ["always", "Always show all"],
        ["fit", "Show what fits"]
      ])
    }),
    Object.freeze({
      key: "zoomFeel",
      label: "Tapping a day",
      choices: Object.freeze([
        ["current", "Stays where it is"],
        ["deep", "Flies in close"]
      ])
    }),
    Object.freeze({
      key: "skyIntensity",
      label: "Sky and weather",
      choices: Object.freeze([
        ["full", "Full"],
        ["calm", "Calm"]
      ])
    }),
    Object.freeze({
      key: "governor",
      label: "Smoothness helper",
      choices: Object.freeze([
        ["on", "On — eases quality to stay smooth"],
        ["off", "Off — fixed, as today"]
      ])
    })
  ]);

  function fieldValue(key) {
    if (key === "governor") return current.governor ? "on" : "off";
    return current[key];
  }

  function applyField(key, value) {
    if (key === "governor") {
      set({ governor: value === "on" });
      return;
    }
    set({ [key]: value });
  }

  function buildPanel(container) {
    if (!container || container.dataset.r2OptionsBuilt === "true") {
      return;
    }
    container.dataset.r2OptionsBuilt = "true";

    const intro = document.createElement("p");
    intro.className = "sphere-r2-options-note";
    intro.textContent =
      "New in this preview. Flip a switch and watch the sphere answer — nothing here is final until you say so.";
    container.appendChild(intro);

    for (const field of FIELDS) {
      const row = document.createElement("div");
      row.className = "sphere-renderer-row";

      const label = document.createElement("label");
      label.className = "sphere-control-label";
      label.textContent = field.label;
      const selectId = `sphere-r2-option-${field.key}`;
      label.htmlFor = selectId;

      const select = document.createElement("select");
      select.id = selectId;
      select.className = "sphere-control-select";
      select.setAttribute("aria-label", field.label);
      for (const [value, text] of field.choices) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = text;
        select.appendChild(option);
      }
      select.value = fieldValue(field.key);
      select.addEventListener("change", () => {
        applyField(field.key, select.value);
      });

      row.appendChild(label);
      row.appendChild(select);
      container.appendChild(row);
    }

    onChange(() => {
      for (const field of FIELDS) {
        const select = container.querySelector(
          `#sphere-r2-option-${field.key}`
        );
        if (select) select.value = fieldValue(field.key);
      }
    });
  }

  function mountPanel() {
    buildPanel(document.getElementById("sphere-r2-options"));
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", mountPanel, {
        once: true
      });
    } else {
      mountPanel();
    }
  }

  globalThis.LivingTimeSphereOptions = Object.freeze({
    VERSION,
    DEFAULTS,
    get,
    set,
    onChange
  });
})();
