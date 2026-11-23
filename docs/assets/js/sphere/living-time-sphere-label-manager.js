(() => {
  "use strict";

  const MIN_OFFSET = 8;
  const MAX_OFFSET = 16;
  const STAGE_PADDING = 10;
  // A calendar-face day plate may never overlap its neighbours:
  // its diameter is capped at this fraction of the plate's own
  // nearest-neighbour pitch, measured across ALL composed plates
  // per layout pass (see the plate pitch cap pass in update()).
  const PLATE_PITCH_CAP_FRACTION = 0.8;
  // Repair pass (Aaron, Nov 22, 2026, 18:12 — "a multitude of
  // things wrong here on mobile now"): a CONTEXT Moon whose whole
  // projected grid pitch falls below this floor is not readable
  // as plates at all — it collapses to its week anchors instead
  // of rendering a solid micro-disc block (his top-down shot:
  // Moon 1's 28 numerals fused into one blob). The faced and
  // selected Moons are exempt — they are the subject being read.
  const PLATE_PITCH_FLOOR_PX = 16;

  function circularMoonDistance(a, b) {
    const d = Math.abs(Number(a) - Number(b)) % 13;
    return Math.min(d, 13 - d);
  }

  /*
   * Median nearest-neighbour anchor distance per Moon, measured
   * over the pass's projected candidates (the whole disclosed
   * grid, before the gate thins it). Moons with too few anchors
   * on stage to judge return no entry — the floor never fires on
   * a guess.
   */
  function moonGridPitches(candidates) {
    const byMoon = new Map();
    for (const candidate of candidates || []) {
      const target = candidate?.target;
      if (!target || target.kind !== "pattern-day-number") continue;
      const moon = Number(target.moon || 0);
      if (!moon) continue;
      if (!byMoon.has(moon)) byMoon.set(moon, []);
      byMoon.get(moon).push(candidate);
    }
    const pitches = new Map();
    for (const [moon, list] of byMoon) {
      if (list.length < 5) continue;
      const nearest = [];
      for (let i = 0; i < list.length; i++) {
        let nn = Infinity;
        for (let j = 0; j < list.length; j++) {
          if (i === j) continue;
          const d = Math.hypot(
            list[i].anchorX - list[j].anchorX,
            list[i].anchorY - list[j].anchorY
          );
          if (d < nn) nn = d;
        }
        if (Number.isFinite(nn)) nearest.push(nn);
      }
      if (nearest.length < 5) continue;
      nearest.sort((a, b) => a - b);
      pitches.set(moon, nearest[Math.floor(nearest.length / 2)]);
    }
    return pitches;
  }

  /*
   * The graded disclosure verdict for one context day. Pure: the
   * caller supplies the regime facts. Returns false when the day
   * must not disclose under the discipline — the faced centre
   * Moon and the selected Moon always pass (they are the
   * subject); scheduled days always pass (a plan is information,
   * not texture); distance ≥ 2 keeps week anchors only; the
   * immediate neighbours keep their sparse anchors; a Moon under
   * the pitch floor keeps week anchors whatever its distance.
   */
  function contextDisciplineAllows({
    moon,
    moonDay,
    scheduled = false,
    centreMoon = null,
    selectedMoon = null,
    pitch = null,
    active = false
  } = {}) {
    if (!active) return true;
    const centre = Number(centreMoon || 0);
    if (!centre) return true;
    const m = Number(moon || 0);
    if (!m || m === centre || m === Number(selectedMoon || 0)) return true;
    if (scheduled) return true;
    const day = Number(moonDay || 0);
    const weekAnchor = day === 1 || day === 7 || day === 14 || day === 21 || day === 28;
    if (pitch != null && pitch < PLATE_PITCH_FLOOR_PX) return weekAnchor;
    const distance = circularMoonDistance(m, centre);
    if (distance >= 2) return weekAnchor;
    if (distance === 1) return day === 1 || day === 14 || day === 28;
    return true;
  }
  const SEMANTIC_TARGET_CAP = 96;

  /*
   * Absolute emergency ceilings retained for compatibility and safety.
   * Actual visible budgets are now resolved by runtime profile + semantic
   * zoom band below.
   */
  const SEMANTIC_DESKTOP_LABEL_CAP = 10;
  const SEMANTIC_MOBILE_LABEL_CAP = 5;

  /*
   * Semantic composition policy
   *
   * ambient:
   *   background context only — no floating semantic cards
   *
   * instrument:
   *   concise embedded instrument — selected state + one/few useful anchors
   *
   * observatory:
   *   analytical workspace — progressively reveals more information as the
   *   camera approaches the geometry
   */
  const SEMANTIC_PROFILE_BUDGETS = Object.freeze({
    ambient: Object.freeze({
      mobile: Object.freeze({
        far: 0,
        medium: 0,
        near: 0,
        detail: 0
      }),
      desktop: Object.freeze({
        far: 0,
        medium: 0,
        near: 0,
        detail: 0
      })
    }),

    instrument: Object.freeze({
      mobile: Object.freeze({
        far: 1,
        medium: 2,
        near: 2,
        detail: 2
      }),
      desktop: Object.freeze({
        far: 2,
        medium: 3,
        near: 4,
        detail: 4
      })
    }),

    observatory: Object.freeze({
      mobile: Object.freeze({
        far: 1,
        medium: 2,
        near: 3,
        detail: 4
      }),
      desktop: Object.freeze({
        far: 2,
        medium: 4,
        near: 6,
        detail: 8
      })
    })
  });

  function normalizeRuntimeProfile(value) {
    const profile =
      String(
        value
        || ""
      )
        .trim()
        .toLowerCase();

    if (
      profile === "ambient"
      || profile === "instrument"
      || profile === "observatory"
    ) {
      return profile;
    }

    return "observatory";
  }

  function runtimeProfileFromStage(stage) {
    const direct =
      stage?.dataset
        ?.ltsRuntimeProfile;

    if (direct) {
      return normalizeRuntimeProfile(
        direct
      );
    }

    const owner =
      stage?.closest?.(
        "[data-lts-runtime-profile]"
      );

    return normalizeRuntimeProfile(
      owner?.dataset
        ?.ltsRuntimeProfile
    );
  }

  function isCompactSurface() {
    const narrow =
      typeof window !== "undefined"
      && Number(
        window.innerWidth
      ) < 600;

    let coarse = false;

    try {
      coarse =
        typeof window !== "undefined"
        && (
          window.matchMedia?.(
            "(pointer: coarse)"
          )?.matches
          || window.matchMedia?.(
            "(hover: none)"
          )?.matches
        );
    } catch {
      coarse = false;
    }

    return !!(
      narrow
      || coarse
    );
  }

  function resolveSemanticBudget({
    runtimeProfile = "observatory",
    mobile = false,
    semanticBand = "medium"
  } = {}) {
    const profile =
      normalizeRuntimeProfile(
        runtimeProfile
      );

    const mode =
      mobile
        ? "mobile"
        : "desktop";

    const requestedBand =
      String(
        semanticBand
        || "medium"
      )
        .trim()
        .toLowerCase();

    const band =
      [
        "far",
        "medium",
        "near",
        "detail"
      ].includes(
        requestedBand
      )
        ? requestedBand
        : "medium";

    const configured =
      SEMANTIC_PROFILE_BUDGETS[
        profile
      ][
        mode
      ][
        band
      ];

    const absoluteCap =
      mobile
        ? SEMANTIC_MOBILE_LABEL_CAP
        : SEMANTIC_DESKTOP_LABEL_CAP;

    const base = Math.max(
      0,
      Math.min(
        absoluteCap,
        Number(
          configured
        )
        || 0
      )
    );

    /*
     * R2 — the adaptive-quality governor (Living Strata Phase F) may
     * tighten the floating-label budget while a device is struggling.
     * Governor absent or off, the scale is 1 and the historic budget
     * is returned untouched.
     */
    const governorScale = Number(
      globalThis
        .LivingTimeSphereQualityGovernor
        ?.semanticScale
        ?.()
    );

    return (
      Number.isFinite(governorScale)
      && governorScale > 0
      && governorScale < 1
    )
      ? Math.floor(base * governorScale)
      : base;
  }

  function semanticTargetGroup(
    target
  ) {
    const kind =
      String(
        target?.kind
        || ""
      ).toLowerCase();

    if (
      kind === "pattern-day"
      || kind === "selected-day"
    ) {
      return "temporal-selection";
    }

    if (
      kind === "year"
    ) {
      return "historical";
    }

    if (
      kind === "astronomy"
      || kind === "gate"
      || kind === "passage"
      || kind === "week-gate"
    ) {
      return "alignment";
    }

    if (
      kind === "lunar"
      || kind === "solar"
      || kind === "solar-anchor"
    ) {
      return "celestial";
    }

    if (
      kind === "moon"
    ) {
      return "calendar";
    }

    if (
      kind.startsWith("living-plan")
      || kind.includes(
        "record"
      )
      || kind.includes(
        "life"
      )
      || kind.includes(
        "atlas"
      )
    ) {
      return "records";
    }

    return kind
      || "other";
  }

  /*
   * Select semantic cards for information diversity instead of simply taking
   * the first N candidates.
   *
   * Candidates have already been sorted by pinned, selected, priority,
   * distance and stable id. This compositor preserves that ordering while
   * preferring a different semantic information class until the useful
   * classes are exhausted.
   */
  function composeSemanticCandidates(
    candidates,
    {
      budget = 0
    } = {}
  ) {
    const limit =
      Math.max(
        0,
        Math.trunc(
          Number(
            budget
          )
          || 0
        )
      );

    if (
      !Array.isArray(
        candidates
      )
      || !limit
    ) {
      return [];
    }

    const remaining =
      candidates.slice();

    const chosen = [];
    const representedGroups =
      new Set();

    while (
      remaining.length
      && chosen.length < limit
    ) {
      let index =
        remaining.findIndex(
          candidate => {
            const group =
              semanticTargetGroup(
                candidate?.target
              );

            return (
              !representedGroups.has(
                group
              )
            );
          }
        );

      if (
        index < 0
      ) {
        index = 0;
      }

      const [
        candidate
      ] =
        remaining.splice(
          index,
          1
        );

      if (
        !candidate
      ) {
        continue;
      }

      chosen.push(
        candidate
      );

      representedGroups.add(
        semanticTargetGroup(
          candidate.target
        )
      );
    }

    return chosen;
  }

  /*
   * Calibrate camera-to-object proximity against the existing semantic zoom.
   * The original Phase IIIE distances were too conservative on phones: an
   * object could look close without crossing the raw Euclidean threshold.
   */
  const SEMANTIC_BAND_DISTANCE_MULTIPLIERS = Object.freeze({
    far: 0.95,
    medium: 1.25,
    near: 1.60,
    detail: 2.15
  });
  const SEMANTIC_MOBILE_DISTANCE_MULTIPLIER = 1.10;

  // B7.38 — semantic targets are stable objects while the camera moves. Cache
  // normalization so a 260-day imported work calendar does not rebuild the same
  // frozen metadata objects 15 times per second during rotation.
  const _semanticNormalizeCache = new WeakMap();

  // B7.42 — temporal glide Moon aperture.
  // Hold the readable calendar neighborhood until another Moon becomes
  // decisively more camera-facing. This prevents early label popping.
  let _calendarGlideFrontMoon = null;


  function normalizeSemanticTarget(target) {
    if (!target || typeof target !== "object") return null;
    const cached = _semanticNormalizeCache.get(target);
    if (cached) return cached;
    const id = String(target.id || "").trim();
    const label = String(target.label || "").trim();
    const worldX = Number(target.worldX ?? target.position?.x);
    const worldY = Number(target.worldY ?? target.position?.y);
    const worldZ = Number(target.worldZ ?? target.position?.z);
    if (!id || !label || ![worldX, worldY, worldZ].every(Number.isFinite)) return null;
    const showDistance = Math.max(0.05, Number(target.showDistance) || 2.2);
    const resetDistance = Math.max(showDistance + 0.08, Number(target.resetDistance) || (showDistance + 0.42));
    const normalized = Object.freeze({
      id,
      label,
      detail: target.detail == null ? "" : String(target.detail),
      kind: String(target.kind || "object"),
      worldX, worldY, worldZ,
      priority: Number.isFinite(Number(target.priority)) ? Number(target.priority) : 40,
      showDistance,
      resetDistance,
      detailDistance: Math.max(0.05, Number(target.detailDistance) || showDistance * 0.72),
      pinned: !!target.pinned,
      selected: !!target.selected,
      moon: Number.isFinite(Number(target.moon)) ? Number(target.moon) : null,
      enabled: target.enabled !== false,
      leader: target.leader === true || String(target.kind || "").toLowerCase().startsWith("living-plan"),
      interactive: target.interactive === true,
      symbol: target.symbol == null ? null : String(target.symbol).slice(0, 4),
      workflow: target.workflow == null ? null : String(target.workflow),
      // B7.47.1 — day numerals historically exposed `scheduleCount` while
      // planner summaries exposed `dayScheduleCount`. Normalize both into one
      // field so scheduled dates retain their symbol/count after normalization.
      dayScheduleCount: Number.isFinite(Number(target.dayScheduleCount ?? target.scheduleCount))
        ? Math.max(0, Number(target.dayScheduleCount ?? target.scheduleCount))
        : 0,
      recordId: target.recordId == null ? null : String(target.recordId),
      patternYear: Number.isFinite(Number(target.patternYear)) ? Number(target.patternYear) : null,
      patternDay: Number.isFinite(Number(target.patternDay)) ? Number(target.patternDay) : null,
      category: target.category == null ? null : String(target.category),
      schedule: target.schedule && typeof target.schedule === "object" ? target.schedule : null,
      patternSignature: target.patternSignature == null ? null : String(target.patternSignature),
      statusLabel: target.statusLabel == null ? null : String(target.statusLabel),
      haloOffset: Number.isFinite(Number(target.haloOffset)) ? Math.max(8, Number(target.haloOffset)) : null,
      haloLane: target.haloLane == null ? null : String(target.haloLane),
      haloRank: Number.isFinite(Number(target.haloRank)) ? Math.max(0, Number(target.haloRank)) : null,
      railLocked: target.railLocked === true,
      // B7.8 — preserve canonical calendar-rail metadata through normalization.
      // B7.7 created these fields in the renderer but normalizeSemanticTarget
      // dropped them, so railLabelVisible() saw moonDay=0 and hid every
      // numeral. These are display/identity fields only; they never own math.
      moonDay: Number.isFinite(Number(target.moonDay)) ? Number(target.moonDay) : null,
      dayOfPatternYear: Number.isFinite(Number(target.dayOfPatternYear)) ? Number(target.dayOfPatternYear) : null,
      // Visibility pass (Nov 22, 2026) — the same dropped-field bug
      // B7.8 fixed for moonDay: the renderer has always carried
      // calendarFace (and now today) on the day targets, but this
      // normalizer dropped both, so the entire calendar-face style
      // stack keyed on [data-calendar-face="true"] never matched and
      // the day numerals fell back to the quiet-rail engraving.
      // Display/identity fields only; they never own math.
      calendarFace: target.calendarFace === true,
      today: target.today === true,
      quietRail: target.quietRail === true,
      gateDay: target.gateDay === true,
      intercalary: target.intercalary === true,
      leapIntercalary: target.leapIntercalary === true
    });
    _semanticNormalizeCache.set(target, normalized);
    return normalized;
  }

  function resolveProximityEnvelope(
    target,
    {
      band = "medium",
      mobile = false
    } = {}
  ) {
    const normalized = normalizeSemanticTarget(target);
    if (!normalized) return null;

    const requestedBand = String(band || "").toLowerCase();
    const bandKey = Object.prototype.hasOwnProperty.call(
      SEMANTIC_BAND_DISTANCE_MULTIPLIERS,
      requestedBand
    )
      ? requestedBand
      : "medium";

    const multiplier =
      SEMANTIC_BAND_DISTANCE_MULTIPLIERS[bandKey]
      * (mobile ? SEMANTIC_MOBILE_DISTANCE_MULTIPLIER : 1);

    let showDistance = normalized.showDistance * multiplier;

    if (normalized.pinned || normalized.selected) {
      showDistance = Math.max(
        showDistance,
        mobile ? 3.25 : 3.0
      );
    }

    const resetDistance = Math.max(
      normalized.resetDistance * multiplier,
      showDistance + 0.42
    );

    const detailDistance = Math.min(
      showDistance,
      Math.max(
        0.05,
        normalized.detailDistance * multiplier
      )
    );

    return Object.freeze({
      ...normalized,
      showDistance,
      resetDistance,
      detailDistance,
      semanticBand: bandKey,
      proximityMultiplier: multiplier
    });
  }

  function createProximityState() {
    const dismissed = new Set();
    function dismiss(id) {
      const key = String(id || "");
      if (!key) return false;
      dismissed.add(key);
      return true;
    }
    function resolve(target, distance) {
      const normalized = normalizeSemanticTarget(target);
      const d = Number(distance);
      if (!normalized || !Number.isFinite(d) || normalized.enabled === false) {
        return Object.freeze({ visible: false, dismissed: false, reset: false });
      }
      let reset = false;
      if (d > normalized.resetDistance && dismissed.has(normalized.id)) {
        dismissed.delete(normalized.id);
        reset = true;
      }
      const isDismissed = dismissed.has(normalized.id);
      return Object.freeze({
        visible: !isDismissed && d <= normalized.showDistance,
        dismissed: isDismissed,
        reset
      });
    }
    function clear() { dismissed.clear(); }
    function snapshot() { return Object.freeze(Array.from(dismissed)); }
    return Object.freeze({ dismiss, resolve, clear, snapshot });
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function normalizeRect(rect, referenceRect) {
    if (!rect || !referenceRect) return null;
    if (Number.isFinite(rect.x) && Number.isFinite(rect.y) && Number.isFinite(rect.w) && Number.isFinite(rect.h)) {
      return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
    }
    if (Number.isFinite(rect.left) && Number.isFinite(rect.top) && Number.isFinite(rect.width) && Number.isFinite(rect.height)) {
      return {
        x: rect.left - referenceRect.left,
        y: rect.top - referenceRect.top,
        w: rect.width,
        h: rect.height,
      };
    }
    return null;
  }

  function cameraSignature(camera) {
    if (!camera?.matrixWorld?.elements) return "none";
    const p = camera.position || { x: 0, y: 0, z: 0 };
    const m = camera.matrixWorld.elements;
    return [
      p.x.toFixed(4), p.y.toFixed(4), p.z.toFixed(4),
      m[0].toFixed(4), m[5].toFixed(4), m[10].toFixed(4)
    ].join("|");
  }

  function buildLabelSet({
    labelMode,
    selectedMoon,
    todayMoon,
    equinoxMoon,
    mobile,
    showAllMobileLabels,
    runtimeProfile = "observatory"
  }) {
    const profile =
      normalizeRuntimeProfile(
        runtimeProfile
      );

    if (
      labelMode === "none"
      || labelMode === "hidden"
      || profile === "ambient"
    ) {
      return new Set();
    }

    if (
      labelMode === "all"
      || profile === "observatory"
    ) {
      /*
       * B7.55 — Moon identity is persistent in the full Observatory.
       * Back-facing/off-screen anchors are still naturally rejected later,
       * but selection no longer decides which Moon names exist.
       */
      return new Set(
        Array.from(
          {
            length: 13
          },
          (
            _,
            i
          ) =>
            i + 1
        )
      );
    }

    /*
     * Embedded instruments should never begin with the Moon 1 / Moon 13
     * pile-up seen on physical phones requesting Desktop site.
     */
    if (
      profile === "instrument"
      && mobile
      && !showAllMobileLabels
    ) {
      return new Set(
        [
          selectedMoon
          || todayMoon
        ].filter(
          Boolean
        )
      );
    }

    if (
      mobile
      && !showAllMobileLabels
    ) {
      return new Set(
        [
          selectedMoon,
          todayMoon,
          equinoxMoon,
          1,
          13
        ].filter(
          Boolean
        )
      );
    }

    if (
      labelMode === "essential"
      || labelMode === "selected"
    ) {
      return new Set(
        selectedMoon
          ? [
              selectedMoon
            ]
          : []
      );
    }

    if (
      profile === "instrument"
    ) {
      return new Set(
        [
          selectedMoon,
          todayMoon
        ].filter(
          Boolean
        )
      );
    }

    return new Set(
      [
        selectedMoon,
        todayMoon,
        equinoxMoon,
        1,
        13
      ].filter(
        Boolean
      )
    );
  }

  function priorityForMoon(moon, { selectedMoon, todayMoon, selectedDayMoon, equinoxMoon }) {
    if (moon === selectedMoon) return 100;
    if (moon === todayMoon) return 96;
    if (moon === selectedDayMoon) return 94;
    if (moon === 1 || moon === 13 || moon === equinoxMoon) return 72;
    return 36;
  }

  function createManager() {
    let _stageEl = null;
    let _labelContainer = null;
    let _labelEls = [];
    let _connectorEl = null;
    let _dirty = true;
    let _lastSignature = "";
    let _semanticContainer = null;
    let _semanticLeaderSvg = null;
    const _semanticEls = new Map();
    const _semanticLeaderEls = new Map();
    const _proximityState = createProximityState();
    /*
     * Anchor tracking (repair pass, Nov 22, 2026). The renderer
     * re-runs this manager's full layout at most twice a second
     * outside a gesture (its 500 ms label cadence) and ~10× a
     * second inside one, while the 3D scene moves every frame —
     * so between layouts the plates stood where a stale camera
     * had put them: grids detached from their Moons, heaped over
     * neighbours, then popped into place ("the days are sticky;
     * they are not coming in and going how they should"). The
     * full pass remains the only authority on WHAT shows (gate,
     * sizes, opacity); between passes, this loop re-projects the
     * anchors the pass already chose and shifts each label by
     * the anchor's own screen delta — transform only, no layout,
     * no disclosure decisions. When the camera is still the loop
     * writes nothing, and after ~2 s of stillness it sleeps until
     * the next layout pass wakes it.
     */
    let _tracked = [];
    let _trackCtx = null;
    let _trackRaf = 0;
    let _trackIdleFrames = 0;
    let _trackLastSig = "";
    const _trackVec = { current: null };

    function _hideLabel(el) {
      if (!el) return;
      el.style.display = "none";
      el.classList.remove("is-selected", "is-front", "is-quiet");
    }

    function _hideConnector() {
      if (!_connectorEl) return;
      _connectorEl.style.display = "none";
      _connectorEl.style.opacity = "0";
    }

    function init({ stageEl, labelContainer, labelEls, connectorEl }) {
      _stageEl = stageEl || null;
      _labelContainer = labelContainer || null;
      _labelEls = Array.isArray(labelEls) ? labelEls : [];
      _connectorEl = connectorEl || null;
      _dirty = true;
      _lastSignature = "";
      _hideConnector();
      _labelEls.forEach(_hideLabel);
      if (_labelContainer && typeof document !== "undefined") {
        _semanticContainer = _labelContainer.querySelector?.(".sphere-semantic-label-layer") || null;
        if (!_semanticContainer) {
          _semanticContainer = document.createElement("div");
          _semanticContainer.className = "sphere-semantic-label-layer";
          _semanticContainer.setAttribute("aria-label", "Nearby sphere information");
          _labelContainer.appendChild(_semanticContainer);
        }
        _semanticLeaderSvg = _labelContainer.querySelector?.(".sphere-semantic-leader-layer") || null;
        if (!_semanticLeaderSvg) {
          _semanticLeaderSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          _semanticLeaderSvg.setAttribute("class", "sphere-semantic-leader-layer");
          _semanticLeaderSvg.setAttribute("aria-hidden", "true");
          _labelContainer.insertBefore(_semanticLeaderSvg, _semanticContainer);
        }
      }
    }

    function markDirty() {
      _dirty = true;
    }

    function _trackSignature(camera) {
      const m = camera?.matrixWorld?.elements;
      const p = camera?.position;
      if (!m || !p) return "";
      return [
        p.x.toFixed(3), p.y.toFixed(3), p.z.toFixed(3),
        m[0].toFixed(3), m[5].toFixed(3), m[10].toFixed(3)
      ].join("|");
    }

    function _trackFrame() {
      _trackRaf = 0;
      const ctx = _trackCtx;
      if (!ctx || !_tracked.length) return;
      const { camera, three, offsetX, offsetY, stageW, stageH } = ctx;
      const sig = _trackSignature(camera);
      if (sig && sig === _trackLastSig) {
        _trackIdleFrames += 1;
        if (_trackIdleFrames < 120) {
          _trackRaf = requestAnimationFrame(_trackFrame);
        }
        return;
      }
      _trackLastSig = sig;
      _trackIdleFrames = 0;
      if (!_trackVec.current && three?.Vector3) {
        _trackVec.current = new three.Vector3();
      }
      const vec = _trackVec.current;
      if (vec) {
        for (const entry of _tracked) {
          if (!entry.el || entry.el.style.display === "none") continue;
          vec.set(entry.world[0], entry.world[1], entry.world[2]).project(camera);
          if (vec.z < -1 || vec.z > 1) {
            entry.sx = null;
            entry.sy = null;
            continue;
          }
          const sx = offsetX + (((vec.x + 1) / 2) * stageW);
          const sy = offsetY + (((-vec.y + 1) / 2) * stageH);
          entry.sx = sx;
          entry.sy = sy;
          entry.dx = sx - entry.baseX;
          entry.dy = sy - entry.baseY;
        }
        /*
         * Size tracking: positions ride the anchors every frame,
         * but a plate's pitch cap is measured at layout time —
         * during a fast swing a grid can compress well inside one
         * pass cadence, and capped-at-the-old-pitch discs would
         * overlap until the next pass. Each frame, re-measure
         * every plate's nearest tracked neighbour at CURRENT
         * positions and shrink (never grow) its scale by the
         * pitch ratio, so the 0.8× law holds at current geometry,
         * not just at pass geometry.
         */
        const plateEntries = _tracked.filter(
          entry => entry.kind === "plate" && entry.sx != null && entry.el?.style.display !== "none"
        );
        for (const entry of plateEntries) {
          let nn = Infinity;
          for (const other of plateEntries) {
            if (other === entry) continue;
            const d = Math.hypot(entry.sx - other.sx, entry.sy - other.sy);
            if (d < nn) nn = d;
          }
          entry.shrink =
            entry.passNN && Number.isFinite(nn)
              ? Math.min(1, nn / entry.passNN)
              : 1;
        }
        for (const entry of _tracked) {
          if (!entry.el || entry.el.style.display === "none" || entry.sx == null) continue;
          const dx = entry.dx || 0;
          const dy = entry.dy || 0;
          const shrink = entry.kind === "plate" ? (entry.shrink ?? 1) : 1;
          if (
            Math.abs(dx - (entry.writtenDx || 0)) < 0.05
            && Math.abs(dy - (entry.writtenDy || 0)) < 0.05
            && Math.abs(shrink - (entry.writtenShrink ?? 1)) < 0.01
          ) continue;
          entry.writtenDx = dx;
          entry.writtenDy = dy;
          entry.writtenShrink = shrink;
          if (entry.kind === "connector") continue;
          if (entry.kind === "plate" && entry.baseScale != null) {
            entry.el.style.transform =
              `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) translate(-50%, -50%) scale(${(entry.baseScale * shrink).toFixed(3)})`;
          } else {
            entry.el.style.transform =
              `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) ${entry.transformTail}`;
          }
        }
        // The selected Moon's connector joins its pill to its
        // anchor: its start rides the anchor, its end rides the
        // pill, so the line stays joined while both are moving.
        for (const entry of _tracked) {
          if (entry.kind !== "connector" || !entry.el) continue;
          const pill = entry.pillEntry;
          const sx = entry.baseSx + (entry.dx || 0);
          const sy = entry.baseSy + (entry.dy || 0);
          const ex = entry.baseEx + (pill?.dx || 0);
          const ey = entry.baseEy + (pill?.dy || 0);
          const ddx = ex - sx;
          const ddy = ey - sy;
          const len = Math.hypot(ddx, ddy);
          if (len <= 10) {
            entry.el.style.display = "none";
            continue;
          }
          entry.el.style.display = "";
          entry.el.style.left = `${sx}px`;
          entry.el.style.top = `${sy}px`;
          entry.el.style.width = `${len}px`;
          entry.el.style.transform = `rotate(${Math.atan2(ddy, ddx)}rad)`;
        }
      }
      _trackRaf = requestAnimationFrame(_trackFrame);
    }

    function _ensureTrackLoop() {
      if (_trackRaf) return;
      if (typeof requestAnimationFrame !== "function") return;
      if (!_tracked.length || !_trackCtx) return;
      _trackIdleFrames = 0;
      _trackRaf = requestAnimationFrame(_trackFrame);
    }

    function _hideSemanticLeader(id) {
      const path = _semanticLeaderEls.get(id);
      if (path) path.style.display = "none";
    }

    function _updateSemanticLeader(target, candidate, chosen) {
      if (!_semanticLeaderSvg || !target?.leader || !chosen) {
        _hideSemanticLeader(target?.id);
        return;
      }
      let path = _semanticLeaderEls.get(target.id) || null;
      if (!path && typeof document !== "undefined") {
        path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("class", "sphere-semantic-leader");
        path.dataset.semanticId = target.id;
        _semanticLeaderSvg.appendChild(path);
        _semanticLeaderEls.set(target.id, path);
      }
      if (!path) return;
      const ax = candidate.anchorX;
      const ay = candidate.anchorY;
      const cx = chosen.left + chosen.box.w / 2;
      const cy = chosen.top + chosen.box.h / 2;
      const vx = cx - ax;
      const vy = cy - ay;
      const len = Math.hypot(vx, vy) || 1;
      const ux = vx / len;
      const uy = vy / len;
      const elbowDistance = Math.min(Math.max(len * 0.42, 18), 58);
      const ex = ax + ux * elbowDistance;
      const ey = ay + uy * elbowDistance;
      const edgeX = cx - ux * Math.min(chosen.box.w * 0.34, 28);
      const edgeY = cy - uy * Math.min(chosen.box.h * 0.34, 16);
      path.setAttribute("d", `M ${ax.toFixed(1)} ${ay.toFixed(1)} L ${ex.toFixed(1)} ${ey.toFixed(1)} L ${edgeX.toFixed(1)} ${edgeY.toFixed(1)}`);
      path.dataset.semanticKind = target.kind;
      path.style.display = "";
    }

    function update({
      camera,
      three,
      anchors,
      model,
      labelMode,
      selectedPatternPosition,
      showAllMobileLabels,
      todayMarkerPosition,
      selectedMarkerPosition,
      viewMode,
      stageEl,
      visibleLayersKey,
      protectedRects,
      semanticTargets = [],
      // B7.42.1 — explicit disclosure mode from renderer.
      dayLabelMode = "key",

      // B7.45 — same camera window used by schedule symbols.
      calendarDisclosure = null,

      semanticBand = "medium",

      // B7.60 — overhead (top-view) gate from renderer camera elevation.
      cameraOverhead = false,
      interactionLite = false
    }) {
      const stage = stageEl || _stageEl;
      if (!stage || !_labelEls?.length || !camera || !three || !Array.isArray(anchors)) return false;
      const stageRect = stage.getBoundingClientRect();
      if (!stageRect?.width || !stageRect?.height) return false;
      const containerRect = _labelContainer?.getBoundingClientRect?.() || stageRect;
      const offsetX = stageRect.left - containerRect.left;
      const offsetY = stageRect.top - containerRect.top;
      camera.updateMatrixWorld?.(true);
      const blockedRects = Array.isArray(protectedRects)
        ? protectedRects.map(entry => normalizeRect(entry, containerRect)).filter(Boolean)
        : [];
      /*
       * Repair pass (Nov 22, 2026): the Play pill is stage chrome
       * the renderer's protected rects do not cover — on Aaron's
       * phone the selected-year card slid under it and its text
       * was clipped mid-sentence. Treat the pill's box as blocked
       * ground for Moon pills and cards alike, looked up per
       * stage so each mounted Sphere respects its own wrap.
       */
      try {
        const playBar = stage?.closest?.(".sphere-canvas-wrap")?.querySelector?.(".sphere-play-bar");
        const playRect = playBar?.getBoundingClientRect?.();
        if (playRect && playRect.width > 0 && playRect.height > 0) {
          const normalizedPlay = normalizeRect(playRect, containerRect);
          if (normalizedPlay) blockedRects.push(normalizedPlay);
        }
      } catch {
        /* chrome lookup is best-effort */
      }

      const todayMoon = model?.todayPatternPosition?.moon || null;
      const selectedMoon = selectedPatternPosition?.moon || todayMoon || model?.sourceRecord?.equinox?.patternPosition?.moon || 1;
      const selectedDayMoon = selectedPatternPosition?.moon || null;
      const equinoxMoon = model?.sourceRecord?.equinox?.patternPosition?.moon || null;
      const mobile =
        isCompactSurface();

      const runtimeProfile =
        runtimeProfileFromStage(
          stage
        );

      const showSet =
        buildLabelSet({
          labelMode,
          selectedMoon,
          todayMoon,
          equinoxMoon,
          mobile,
          showAllMobileLabels:
            !!showAllMobileLabels
            || labelMode === "all",
          runtimeProfile
        });

      const signature = [
        stageRect.width,
        stageRect.height,
        labelMode,
        viewMode,
        selectedMoon,
        selectedDayMoon,
        todayMoon,
        equinoxMoon,
        mobile ? "m" : "d",
        runtimeProfile,
        showAllMobileLabels ? "show" : "compact",
        visibleLayersKey || "",
        Array.isArray(semanticTargets) ? semanticTargets.length : 0,
        String(semanticBand || "medium"),
        cameraOverhead ? "overhead" : "tilted",
        // R2 — the preview options are part of placement identity: a
        // flipped switch must re-place, not wait for the camera to move.
        globalThis.LivingTimeSphereOptions?.get?.()?.labelMode || "always",
        `gov${globalThis.LivingTimeSphereQualityGovernor?.tier?.() ?? 0}`,
        cameraSignature(camera)
      ].join("::");

      if (!_dirty && signature === _lastSignature) {
        // Even when the layout itself is unchanged, a camera that
        // started moving again needs the tracking loop awake.
        _ensureTrackLoop();
        return false;
      }
      _dirty = false;
      _lastSignature = signature;
      // A fresh layout pass re-decides every position: the
      // tracking registrations from the previous pass expire
      // here and are rebuilt below from this pass's placements.
      _tracked = [];
      _trackCtx = {
        camera,
        three,
        offsetX: stageRect.left - containerRect.left,
        offsetY: stageRect.top - containerRect.top,
        stageW: stageRect.width,
        stageH: stageRect.height
      };
      _trackLastSig = "";

      const THREE = three;
      const centerVec = new THREE.Vector3(0, 0, 0).project(camera);
      const centerX = offsetX + (((centerVec.x + 1) / 2) * stageRect.width);
      const centerY = offsetY + (((-centerVec.y + 1) / 2) * stageRect.height);
      const camPos = camera.position || new THREE.Vector3();
      const camForward = new THREE.Vector3();
      camera.getWorldDirection?.(camForward);
      const projVec = new THREE.Vector3();
      const worldVec = new THREE.Vector3();
      const camSpace = new THREE.Vector3();
      const placedRects = [];
      const candidates = [];

      // Visibility pass (Nov 22, 2026) — mirror the semantic band
      // onto the label layer itself, so the calendar-face plates
      // can size to the band's grid pitch (the stylesheet keys
      // plate size on this attribute). Written only on change.
      if (_semanticContainer) {
        const bandKey = String(semanticBand || "medium").toLowerCase();
        if (_semanticContainer.dataset.band !== bandKey) {
          _semanticContainer.dataset.band = bandKey;
        }
      }

      /*
       * Semantic cards should orbit the instrument rather than carpet its
       * central inspection zone. Selected/pinned targets can still fall back
       * into this region if there is genuinely nowhere else to place them.
       */
      const semanticBlockedRects =
        blockedRects.slice();

      const coreWidth =
        stageRect.width
        * (
          mobile
            ? 0.44
            : 0.36
        );

      const coreHeight =
        stageRect.height
        * (
          mobile
            ? 0.42
            : 0.36
        );

      semanticBlockedRects.push({
        x:
          offsetX
          + (
            stageRect.width
            - coreWidth
          )
          / 2,

        y:
          offsetY
          + (
            stageRect.height
            - coreHeight
          )
          / 2,

        w:
          coreWidth,

        h:
          coreHeight
      });

      _hideConnector();
      _labelEls.forEach(_hideLabel);

      for (let i = 0; i < anchors.length; i += 1) {
        const anchor = anchors[i];
        const moon = anchor?.moon;
        const el = _labelEls[i];
        if (!el || !showSet.has(moon)) continue;
        const isSelectedMoon = moon === selectedMoon;

        worldVec.set(anchor.worldX, anchor.worldY, anchor.worldZ);
        projVec.copy(worldVec).project(camera);
        camSpace.copy(worldVec).applyMatrix4(camera.matrixWorldInverse);

        if (camSpace.z > 0 && !isSelectedMoon) continue;
        if ((projVec.z < -1 || projVec.z > 1) && !isSelectedMoon) continue;

        const anchorX = offsetX + (((projVec.x + 1) / 2) * stageRect.width);
        const anchorY = offsetY + (((-projVec.y + 1) / 2) * stageRect.height);

        if ((anchorX < offsetX - 40 || anchorY < offsetY - 40 || anchorX > offsetX + stageRect.width + 40 || anchorY > offsetY + stageRect.height + 40) && !isSelectedMoon) continue;

        const toPoint = worldVec.clone().sub(camPos).normalize();
        const frontness = clamp((camForward.dot(toPoint) + 1) * 0.5, 0, 1);
        if (frontness < 0.06 && !isSelectedMoon) continue;

        const dxCenter = anchorX - centerX;
        const dyCenter = anchorY - centerY;
        const radialLen = Math.hypot(dxCenter, dyCenter) || 1;
        const rx = dxCenter / radialLen;
        const ry = dyCenter / radialLen;
        const priority = priorityForMoon(moon, { selectedMoon, todayMoon, selectedDayMoon, equinoxMoon });
        const outward = clamp(MIN_OFFSET + (priority >= 90 ? 10 : priority >= 70 ? 6 : 0), MIN_OFFSET, MAX_OFFSET);

        candidates.push({
          moon,
          el,
          priority,
          frontness,
          selected: moon === selectedMoon,
          quiet: moon !== selectedMoon && moon !== todayMoon,
          anchorX,
          anchorY,
          worldX: anchor.worldX,
          worldY: anchor.worldY,
          worldZ: anchor.worldZ,
          targetX: anchorX + rx * outward,
          targetY: anchorY + ry * outward
        });
      }

      candidates.sort((a, b) => b.priority - a.priority || b.frontness - a.frontness);

      let selectedTarget = null;
      // R2 — placed Moon labels, kept for the placement-governance
      // post-pass below (fit mode only).
      const moonPlacements = [];
      for (const candidate of candidates) {
        const { el, targetX, targetY, selected, quiet, frontness } = candidate;
        el.style.display = "";
        const w = el.offsetWidth || 62;
        const h = el.offsetHeight || 22;
        const attempts = [
          { x: targetX, y: targetY },
          { x: targetX + (selected ? 26 : 18), y: targetY },
          { x: targetX - (selected ? 26 : 18), y: targetY },
          { x: targetX, y: targetY - (selected ? 24 : 16) },
          { x: targetX, y: targetY + (selected ? 24 : 16) },
        ];
        let left = null;
        let top = null;
        let rectBox = null;
        let collides = true;
        for (const attempt of attempts) {
          const nextLeft = clamp(attempt.x - w / 2, offsetX + STAGE_PADDING, Math.max(offsetX + STAGE_PADDING, offsetX + stageRect.width - w - STAGE_PADDING));
          const nextTop = clamp(attempt.y - h / 2, offsetY + STAGE_PADDING, Math.max(offsetY + STAGE_PADDING, offsetY + stageRect.height - h - STAGE_PADDING));
          const nextRectBox = { x: nextLeft, y: nextTop, w, h };
          const collidesPlaced = placedRects.some(prev => rectsOverlap(nextRectBox, prev));
          const collidesBlocked = blockedRects.some(blocked => rectsOverlap(nextRectBox, blocked));
          if (!collidesPlaced && !collidesBlocked) {
            left = nextLeft;
            top = nextTop;
            rectBox = nextRectBox;
            collides = false;
            break;
          }
        }
        if (
          collides
          && !selected
          && runtimeProfile !== "observatory"
        ) {
          _hideLabel(el);
          continue;
        }

        if (
          collides
          && !selected
          && runtimeProfile === "observatory"
        ) {
          left = clamp(
            targetX - w / 2,
            offsetX + STAGE_PADDING,
            Math.max(
              offsetX + STAGE_PADDING,
              offsetX
                + stageRect.width
                - w
                - STAGE_PADDING
            )
          );

          top = clamp(
            targetY - h / 2,
            offsetY + STAGE_PADDING,
            Math.max(
              offsetY + STAGE_PADDING,
              offsetY
                + stageRect.height
                - h
                - STAGE_PADDING
            )
          );

          rectBox = {
            x: left,
            y: top,
            w,
            h
          };

          collides = false;
        }
        if (left == null || top == null || !rectBox) {
          left = clamp(targetX - w / 2, offsetX + STAGE_PADDING, Math.max(offsetX + STAGE_PADDING, offsetX + stageRect.width - w - STAGE_PADDING));
          top = clamp(targetY - h / 2, offsetY + STAGE_PADDING, Math.max(offsetY + STAGE_PADDING, offsetY + stageRect.height - h - STAGE_PADDING));
          rectBox = { x: left, y: top, w, h };
        }

        placedRects.push(rectBox);
        moonPlacements.push({
          moon: candidate.moon,
          priority: candidate.priority,
          selected,
          el,
          rect: rectBox,
          anchorX: candidate.anchorX,
          anchorY: candidate.anchorY,
          world: [candidate.worldX, candidate.worldY, candidate.worldZ],
          transformTail: `translateZ(0) scale(${selected ? 1.03 : frontness > 0.7 ? 1 : 0.96})`
        });
        const clampDistance = Math.hypot((left + w / 2) - targetX, (top + h / 2) - targetY);
        const opacity = clamp((0.45 + frontness * 0.6) - clampDistance * 0.02, selected ? 0.9 : 0.2, 1);
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        el.style.opacity = String(opacity);
        el.style.transform = `translateZ(0) scale(${selected ? 1.03 : frontness > 0.7 ? 1 : 0.96})`;
        el.style.fontSize = selected ? "0.84rem" : candidate.priority >= 70 ? "0.74rem" : "0.68rem";
        el.style.fontWeight = selected ? "700" : candidate.priority >= 70 ? "600" : "500";
        el.classList.toggle("is-selected", selected);
        el.classList.toggle("is-front", frontness > 0.72);
        el.classList.toggle("is-quiet", quiet);

        if (selected) {
          selectedTarget = {
            centerX: left + w / 2,
            centerY: top + h / 2,
            anchorX: candidate.anchorX,
            anchorY: candidate.anchorY,
            displaced: clampDistance > 6 || Math.hypot((left + w / 2) - candidate.anchorX, (top + h / 2) - candidate.anchorY) > 20,
            opacity
          };
        }
      }

      /*
       * R2 — Moon-name placement governance (opt-in "fit" mode).
       *
       * The placement loop above honours the B7.55/B7.57 persistent-
       * identity doctrine: in the observatory profile a colliding Moon
       * name is force-placed, so on a small screen names can stack.
       * When the visitor chooses "Show what fits", the pure placement
       * engine resolves those stacks here: shift what can shift, hide
       * what cannot, never hide the selected Moon. In the default
       * "always" mode this block does not run and placement is exactly
       * the historic behaviour.
       */
      if (
        globalThis.LivingTimeSphereOptions?.get?.()?.labelMode === "fit"
        && globalThis.LivingTimeSphereLabelPlacement
          ?.resolveMoonLabelOverlaps
      ) {
        const { results } =
          globalThis.LivingTimeSphereLabelPlacement
            .resolveMoonLabelOverlaps(
              moonPlacements.map(placed => ({
                id: placed.moon,
                priority: placed.priority,
                selected: placed.selected,
                rect: placed.rect
              })),
              {
                mode: "fit",
                // Visibility pass: a real breathing gap (4px, not
                // the engine's 2px floor) so resolved names read as
                // separate pills instead of a touching crowd.
                pad: 4,
                blocked: blockedRects,
                bounds: {
                  minX: offsetX + STAGE_PADDING,
                  minY: offsetY + STAGE_PADDING,
                  maxX: offsetX + stageRect.width - STAGE_PADDING,
                  maxY: offsetY + stageRect.height - STAGE_PADDING
                }
              }
            );
        const byMoon = new Map(
          moonPlacements.map(placed => [placed.moon, placed])
        );
        for (const result of results) {
          const placed = byMoon.get(result.id);
          if (!placed) continue;
          if (!result.visible) {
            _hideLabel(placed.el);
            const ix = placedRects.indexOf(placed.rect);
            if (ix >= 0) placedRects.splice(ix, 1);
          } else if (result.moved) {
            placed.el.style.left = `${placed.rect.x}px`;
            placed.el.style.top = `${placed.rect.y}px`;
            if (placed.selected && selectedTarget) {
              selectedTarget.centerX =
                placed.rect.x + placed.rect.w / 2;
              selectedTarget.centerY =
                placed.rect.y + placed.rect.h / 2;
              selectedTarget.displaced = true;
            }
          }
        }
      }

      // Anchor tracking registrations for the Moon pills placed
      // above (repair pass, Nov 22, 2026): each pill's entry rides
      // its Moon anchor between layout passes — see _trackFrame.
      for (const placed of moonPlacements) {
        if (placed.el.style.display === "none") continue;
        if (!Array.isArray(placed.world) || !placed.world.every(Number.isFinite)) continue;
        const entry = {
          el: placed.el,
          kind: "pill",
          world: placed.world,
          baseX: placed.anchorX,
          baseY: placed.anchorY,
          transformTail: placed.transformTail,
          dx: 0,
          dy: 0
        };
        placed.trackEntry = entry;
        _tracked.push(entry);
      }

      // Semantic proximity labels share the same projected overlay and collision
      // budget as Moon labels. Camera movement drives them; no hover loop is used.
      // B7.7 — never apply the floating semantic-card ceiling to the
      // canonical calendar rail. The old pre-normalization slice truncated the
      // 364-day rail after roughly the first quarter of the year, which is why
      // day numerals bunched into one arc in the mobile view. Rail annotations
      // are normalized in full; only non-rail semantic cards are capped.
      const rawSemanticTargets = Array.isArray(semanticTargets) ? semanticTargets : [];
      const rawRailTargets = rawSemanticTargets.filter(target =>
        (target?.kind === "pattern-day-number" || target?.kind === "intercalary-day-number")
        && target?.railLocked === true
      );
      const rawScheduleTargets = rawSemanticTargets.filter(target =>
        target?.kind === "living-plan-summary"
      );
      const rawCardTargets = rawSemanticTargets.filter(target =>
        target?.kind !== "living-plan-summary"
        && !((target?.kind === "pattern-day-number" || target?.kind === "intercalary-day-number")
          && target?.railLocked === true)
      );
      const normalizedTargets = [
        ...rawRailTargets.map(normalizeSemanticTarget).filter(Boolean),
        // Schedule summaries are one-per-day (max 364), not one-per-record. Keep
        // the complete year eligible so every Moon can reveal its own schedule.
        ...rawScheduleTargets.map(normalizeSemanticTarget).filter(Boolean),
        ...rawCardTargets.slice(0, SEMANTIC_TARGET_CAP).map(normalizeSemanticTarget).filter(Boolean)
      ];
      const semanticCandidates = [];
      /*
       * PERF (Sphere deep-fix, Nov 22, 2026) — the camera-space centre
       * depth is constant across this whole pass, but it was recomputed
       * with a fresh Vector3 allocation for every candidate (hundreds
       * per pass, several passes a second while turning). Hoisted: one
       * allocation per update, same value.
       */
      const centerCamSpaceZ =
        new THREE.Vector3(0, 0, 0)
          .applyMatrix4(camera.matrixWorldInverse)
          .z;
      for (const target of normalizedTargets) {
        const effectiveTarget = resolveProximityEnvelope(
          target,
          {
            band: semanticBand,
            mobile
          }
        );

        if (!effectiveTarget) continue;

        worldVec.set(
          effectiveTarget.worldX,
          effectiveTarget.worldY,
          effectiveTarget.worldZ
        );

        const distance = worldVec.distanceTo(camPos);
        const isDayRail = (effectiveTarget.kind === "pattern-day-number" || effectiveTarget.kind === "intercalary-day-number") && effectiveTarget.railLocked;
        const state = isDayRail
          ? { visible: true }
          : _proximityState.resolve(
              effectiveTarget,
              distance
            );

        if (!state.visible) continue;
        projVec.copy(worldVec).project(camera);
        camSpace.copy(worldVec).applyMatrix4(camera.matrixWorldInverse);
        if (camSpace.z > 0 || projVec.z < -1 || projVec.z > 1) continue;
        const anchorX = offsetX + (((projVec.x + 1) / 2) * stageRect.width);
        const anchorY = offsetY + (((-projVec.y + 1) / 2) * stageRect.height);
        if (anchorX < offsetX - 36 || anchorY < offsetY - 36 || anchorX > offsetX + stageRect.width + 36 || anchorY > offsetY + stageRect.height + 36) continue;
        semanticCandidates.push({
          target: effectiveTarget,
          distance,
          anchorX,
          anchorY,
          cameraZ: camSpace.z,
          frontDepth: camSpace.z - centerCamSpaceZ
        });
      }
      semanticCandidates.sort((a, b) =>
        Number(b.target.pinned) - Number(a.target.pinned)
        || Number(b.target.selected) - Number(a.target.selected)
        || b.target.priority - a.target.priority
        || a.distance - b.distance
        || a.target.id.localeCompare(b.target.id)
      );
      const semanticBudget =
        resolveSemanticBudget({
          runtimeProfile,
          mobile,
          semanticBand
        });

      // B7.45 — dates consume the renderer's SAME camera calendar
      // window as scheduled symbols. There is no second Moon-selection system.
      const suppliedMoons =
        Array.isArray(
          calendarDisclosure?.moons
        )
          ? calendarDisclosure.moons
              .map(Number)
              .filter(
                moon =>
                  moon >= 1
                  && moon <= 13
              )
          : [];

      let frontMoon =
        Number(
          calendarDisclosure
            ?.centerMoon
        )
        || null;

      /*
       * Defensive fallback only.
       * Normal 3D operation always receives renderer calendarDisclosure.
       */
      if (!frontMoon) {
        let bestDepth =
          -Infinity;

        for (
          const candidate
          of semanticCandidates
        ) {
          if (
            candidate?.target?.kind !==
            "pattern-day-number"
          ) {
            continue;
          }

          const depth =
            Number(
              candidate.frontDepth
            );

          if (
            Number.isFinite(depth)
            && depth > bestDepth
          ) {
            bestDepth = depth;
            frontMoon =
              Number(
                candidate.target.moon
                || 0
              )
              || null;
          }
        }
      }

      const sharedMoonWindow =
        new Set(
          suppliedMoons.length
            ? suppliedMoons
            : (
                frontMoon
                  ? [frontMoon]
                  : []
              )
        );

      /*
       * B7.55 — CAMERA CALENDAR APERTURE
       *
       * The user's red-line concept is a screen-space window rather than a
       * hard Moon switch. The center ~54% of the instrument is fully readable;
       * days fade through the next ~24% and disappear before the side walls.
       *
       * Because renderer calendarDisclosure keeps the adjacent Moon available,
       * rotating left/right makes the leaving dates dissipate while dates from
       * the incoming Moon progressively appear through this same aperture.
       */
      const railApertureOpacity =
        candidate => {
          const target =
            candidate?.target
            || null;

          if (
            target?.selected
            || target?.pinned
          ) {
            return 1;
          }

          /*
           * FACED MOON EXEMPTION (Aaron, Nov 22, 2026 — Sphere deep-fix,
           * from his phone: Moon 13 centred on his screen with none of
           * its days showing). The aperture is a window for CONTEXT
           * Moons: it quiets the days a keeper is not looking at. Lab
           * measurement showed the fixed ±39% X window also strangles
           * the faced Moon itself: the closer the keeper moves toward
           * a Moon, the wider its 4×7 day grid grows on screen, so at
           * dist 2.55 the faced Moon 13 kept 11 of 28 numerals while
           * its neighbour kept 28, and at dist 2.0 it kept 3. The
           * faced (disclosure-centre) Moon's numerals therefore do
           * not pass through the X window at all. Neighbours still do;
           * the clutter law is unchanged for every Moon but the one
           * being faced. (Evolution directive stage names: this is
           * what makes Moon View legible.)
           */
          if (
            target?.kind === "pattern-day-number"
            && frontMoon
            && Number(
              target.moon
              || 0
            ) === frontMoon
          ) {
            return 1;
          }

          const anchorX =
            Number(
              candidate?.anchorX
            );

          if (
            !Number.isFinite(
              anchorX
            )
          ) {
            return 0;
          }

          const distanceFromCenter =
            Math.abs(
              anchorX
              - centerX
            );

          const fullRadius =
            stageRect.width
            * 0.27;

          const outerRadius =
            stageRect.width
            * 0.39;

          if (
            distanceFromCenter
            <= fullRadius
          ) {
            return 1;
          }

          if (
            distanceFromCenter
            >= outerRadius
          ) {
            return 0;
          }

          const t =
            clamp(
              (
                outerRadius
                - distanceFromCenter
              )
              / Math.max(
                  1,
                  outerRadius
                    - fullRadius
                ),
              0,
              1
            );

          // smoothstep: no hard "pop" at either red-line boundary.
          return (
            t
            * t
            * (
              3
              - 2
              * t
            )
          );
        };

      /*
       * B7.57 — semantic zoom LOD for calendar numerals.
       */
      /*
       * B7.58.2 — TRUE SEMANTIC-ZOOM CALENDAR DISCLOSURE
       *
       * Far: no raw day numerals. Selection survives as cards/markers and
       * scheduled information survives as compact schedule symbols.
       * Medium: scheduled/selected context stays stronger; ordinary days soften.
       * Near/detail: full canonical rail.
       */
      const railZoomOpacity =
        candidate => {
          const target =
            candidate?.target
            || null;

          const band =
            String(
              semanticBand
              || "medium"
            ).toLowerCase();

          const scheduled =
            Number(
              target?.dayScheduleCount
              ?? target?.scheduleCount
              ?? 0
            ) > 0
            || !!target?.symbol;

          if (
            target?.selected
            || target?.pinned
          ) {
            return 1;
          }

          /*
           * B7.59.2A — FAR CALENDAR SKELETON
           * A distant Sphere keeps enough date structure to remain legible.
           * railLabelVisible performs the sparse 1/7/14/21/28 gate; this
           * function only supplies the softer distance opacity.
           */
          if (band === "far") {
            return scheduled
              ? 0.84
              : 0.58;
          }

          if (band === "medium") {
            /*
             * FACED MOON AT MOON VIEW (Aaron, Nov 22, 2026) — the
             * medium-band softening below is for context days. The
             * faced Moon's numerals read at full strength: at 0.56
             * over the moving face they washed toward the ~0.3 floor
             * the lab measured on the surviving numerals of a
             * strangled Moon, which is not legible.
             */
            if (
              target?.kind === "pattern-day-number"
              && frontMoon
              && Number(
                target.moon
                || 0
              ) === frontMoon
            ) {
              return 1;
            }

            return scheduled
              ? 0.84
              : 0.56;
          }

          return 1;
        };

      const railLabelVisible =
        candidate => {
          const target =
            candidate?.target
            || null;

          const zoomOpacity =
            railZoomOpacity(
              candidate
            );

          if (
            zoomOpacity
            <= 0.025
          ) {
            return false;
          }

          const band =
            String(
              semanticBand
              || "medium"
            ).toLowerCase();

          const revealAll =
            String(
              dayLabelMode
              || "key"
            )
              .toLowerCase()
            === "all";

          // B7.60 — overhead reuses the far skeleton gate below: the
          // X-only aperture is a tilted-view window and cannot thin the
          // rail once the camera is near top-down.
          const overhead = !!cameraOverhead;

          const apertureOpacity =
            railApertureOpacity(
              candidate
            );

          if (
            target?.kind ===
            "intercalary-day-number"
          ) {
            if (revealAll && !overhead) return true;

            return (
              sharedMoonWindow
                .has(13)
              && apertureOpacity
                > 0.025
              && band !== "far"
              && !overhead
            );
          }

          if (
            target?.kind !==
            "pattern-day-number"
          ) {
            return false;
          }

          const moon =
            Number(
              target.moon
              || 0
            );

          const moonDay =
            Number(
              target.moonDay
              || 0
            );

          if (
            !moon
            || !moonDay
          ) {
            return false;
          }

          if (
            target.selected
            || target.pinned
          ) {
            return true;
          }

          if (revealAll && !overhead) {
            return true;
          }

          /*
           * B7.59.2A — keep a readable four-week skeleton at far distance.
           * Front Moon: 1, 7, 14, 21, 28.
           * Immediate neighbor Moon(s): 1, 14, 28.
           * Scheduled days also survive. The physical calendarCell never moves.
           *
           * B7.60 — the same skeleton is the overhead rule: near top-down,
           * day numerals collapse to these week anchors of the disclosure
           * Moons, plus selected/pinned days (already returned above).
           * No label moves; only visibility is governed.
           */
          if (band === "far" || overhead) {
            const centerMoon =
              Number(
                calendarDisclosure?.centerMoon
                || 0
              );

            const rawMoonDistance =
              centerMoon
                ? Math.abs(moon - centerMoon)
                : 0;

            const moonDistance =
              centerMoon
                ? Math.min(
                    rawMoonDistance,
                    13 - rawMoonDistance
                  )
                : 0;

            const farFrontAnchor =
              moonDay === 1
              || moonDay === 7
              || moonDay === 14
              || moonDay === 21
              || moonDay === 28;

            const farNeighborAnchor =
              moonDay === 1
              || moonDay === 14
              || moonDay === 28;

            const scheduled =
              Number(
                target?.dayScheduleCount
                ?? target?.scheduleCount
                ?? 0
              ) > 0
              || !!target?.symbol;

            /*
             * FACED MOON AT YEAR VIEW (Aaron, Nov 22, 2026 — Sphere
             * deep-fix). The B7.59.2A skeleton thinned even the faced
             * Moon to its five week anchors, so at the phone's resting
             * (far-band) distance the Moon a keeper had turned to face
             * showed five numbers and no more — and the game's "find
             * this day" could name a day the face did not show. The
             * faced Moon now discloses its whole 4×7 face at Year
             * View too: structural is true for every one of its days.
             * Neighbours keep the sparse skeleton exactly as before,
             * and the overhead branch below is untouched (it keys to
             * the SELECTED Moon, B7.60.3, not the disclosure centre).
             */
            const structural =
              !centerMoon
                ? farFrontAnchor
                : (
                    moonDistance === 0
                      ? true
                      : moonDistance === 1
                        ? farNeighborAnchor
                        : false
                  );

            /*
             * B7.60.1 — overhead window. Near top-down, the shared Moon
             * window and the X-only aperture are both derived from
             * tilted-view disclosure geometry and degenerate together:
             * the window can name Moons whose anchors the aperture then
             * zeroes, so the skeleton came out empty and no day numeral
             * rendered overhead at all. Overhead, the window is the
             * disclosure centerMoon's circular neighborhood instead —
             * front Moon plus immediate neighbors, the same Moons
             * `structural` already grades — and the aperture passes for
             * the structural/scheduled candidates inside it. (With no
             * centerMoon, moonDistance is 0 throughout and `structural`
             * keeps its every-Moon front-anchor fallback.) Tilted and
             * far-band behavior below is exactly as before.
             */
            if (overhead) {
              /*
               * B7.60.3 — the overhead skeleton is keyed to the SELECTED
               * Moon, not the camera-azimuth disclosure center. Measured
               * in a real browser (Playwright/Chromium lab, PR #89): in
               * settled Top View the disclosure center follows the camera
               * azimuth (theta = π faces Moon 1), so the B7.60.1 window
               * painted Moon 1 + Moon 2 anchors while the selected Moon
               * showed no anchors at all — a skeleton, but on the wrong
               * Moon. Overhead the whole ring is visible and the day
               * structure the viewer needs is the selected Moon's: its
               * week anchors, its circular neighbors' sparse anchors,
               * selected/pinned days (returned above), and scheduled
               * days inside that window. The far-band branch below keeps
               * the disclosure center; tilted behavior is unchanged.
               */
              const selectedCenter =
                Number(
                  selectedMoon
                  || 0
                );

              const selectedRawDistance =
                selectedCenter
                  ? Math.abs(moon - selectedCenter)
                  : 0;

              const selectedDistance =
                selectedCenter
                  ? Math.min(
                      selectedRawDistance,
                      13 - selectedRawDistance
                    )
                  : 0;

              const selectedStructural =
                !selectedCenter
                  ? farFrontAnchor
                  : (
                      selectedDistance === 0
                        ? farFrontAnchor
                        : selectedDistance === 1
                          ? farNeighborAnchor
                          : false
                    );

              return (
                selectedDistance <= 1
                && (
                  selectedStructural
                  || scheduled
                )
              );
            }

            return (
              sharedMoonWindow
                .has(moon)
              && apertureOpacity
                > 0.025
              && (
                structural
                || scheduled
              )
            );
          }

          if (
            !sharedMoonWindow
              .has(moon)
          ) {
            return false;
          }

          /*
           * Populate ALL canonical days which physically enter the aperture.
           * No selected-Moon gate, no week-anchor-only gate.
           */
          return (
            apertureOpacity
            > 0.025
          );
        };

      /*
       * B7.60.2 — record the gate's verdict per candidate in this update.
       * The render pass below consults this map — never the camera flag
       * alone — before granting a rail numeral the overhead aperture
       * exemption. B7.60.1 keyed that exemption on cameraOverhead only,
       * on the assumption that every numeral reaching the render pass
       * had passed railLabelVisible. The composed pipeline does not
       * guarantee that: the render pass paints the composed set of the
       * most recent evaluation, evaluations are throttled, and a
       * mid-transition evaluation (camera not yet overhead) composes
       * the full tilted rail through this same path. A verdict recorded
       * here is the only exemption ticket the render pass honors.
       */
      const railGateVerdicts =
        new Map();

      const dayRailCandidates =
        semanticCandidates.filter(
          candidate => {
            if (
              !(
                candidate?.target?.kind ===
                  "pattern-day-number"
                || candidate?.target?.kind ===
                  "intercalary-day-number"
              )
              || !candidate?.target?.railLocked
            ) {
              return false;
            }

            const gateVisible =
              railLabelVisible(
                candidate
              );

            railGateVerdicts.set(
              candidate,
              gateVisible
            );

            return gateVisible;
          }
        );

      /*
       * Repair pass (Nov 22, 2026) — graded disclosure discipline.
       * Aaron's top-down shot: every Moon's full 28-grid disclosed
       * at once, grids colliding across Moon borders and one Moon
       * fused into a micro-disc block. The gate's skeleton covers
       * the far band and the overhead view, but Reveal All's gate
       * branch bypasses the skeleton entirely whenever the camera
       * is not overhead — at year distance that is the whole year
       * at once. In the far band and under Reveal All, context
       * Moons now disclose by graded distance from the disclosure
       * centre (full grid at the centre, sparse anchors next
       * door, week anchors beyond), and any context Moon whose
       * projected grid pitch falls under the readability floor
       * collapses to its week anchors instead of micro-plates.
       * The faced centre Moon
       * and the selected Moon keep every exemption they already
       * had; scheduled days always show. Denied candidates leave
       * the rail here and their railGateVerdicts entry is set
       * false, so the render pass honours the verdict exactly
       * like a gate verdict (B7.60.2).
       */
      {
        const disciplineCentreMoon =
          Number(calendarDisclosure?.centerMoon || frontMoon || 0) || null;
        // The regimes where the gate itself has no skeleton: the
        // far band, and Reveal All — whose gate branch returns
        // true for every day when not overhead, bypassing the far
        // skeleton entirely (the full-year collapse in Aaron's
        // shot). Camera elevation is deliberately NOT a trigger:
        // B7.60.2 pins that a mid-transition composition must not
        // be re-gated by a raw geometry reading — the gate's
        // verdicts and the renderer's overhead flag are the
        // authority, and in ordinary tilted Moon View the
        // aperture governs density, as the deep-fix left it.
        const disciplineActive =
          semanticBand === "far"
          || String(dayLabelMode || "").toLowerCase() === "all";
        if (disciplineActive && disciplineCentreMoon) {
          const disciplinePitches = moonGridPitches(semanticCandidates);
          for (let i = dayRailCandidates.length - 1; i >= 0; i -= 1) {
            const candidate = dayRailCandidates[i];
            if (candidate.target.kind !== "pattern-day-number") continue;
            const allows = contextDisciplineAllows({
              moon: candidate.target.moon,
              moonDay: candidate.target.moonDay,
              scheduled: Boolean(candidate.target.dayScheduleCount > 0 || candidate.target.count > 0),
              centreMoon: disciplineCentreMoon,
              selectedMoon,
              pitch: disciplinePitches.get(Number(candidate.target.moon || 0)) ?? null,
              active: true
            });
            if (!allows) {
              railGateVerdicts.set(candidate, false);
              dayRailCandidates.splice(i, 1);
            }
          }
        }
      }

      const nonRailSemanticCandidates = semanticCandidates.filter(candidate =>
        !((candidate?.target?.kind === "pattern-day-number" || candidate?.target?.kind === "intercalary-day-number") && candidate?.target?.railLocked)
      );
      // B7.48 — no floating semantic-card composition while the camera is moving.
      // Dates remain DOM annotations and scheduled symbols remain in the single GPU
      // atlas; cards return once the 90 ms settle pass runs.
      const cardCandidates = interactionLite ? [] : nonRailSemanticCandidates;
      const composedSemanticCandidates = [
        ...dayRailCandidates,
        ...composeSemanticCandidates(
          cardCandidates,
          { budget: semanticBudget }
        )
      ];

      // Plate pitch caps (Nov 22, 2026 — PR #243 follow-up, from
      // Aaron's phone: "The days are clustering together and not
      // rendering properly"). The band ladder in sphere-armillary.css
      // sizes a day plate from the zoom band alone, but the grid's
      // on-screen pitch is set by the stage's aspect and the grid
      // plane's tilt, not by the band: measured in the lab, the
      // A16's aspect (412×915) serves the medium band's 1.3rem
      // plates onto a ~20px Moon View pitch (9 intersecting pairs),
      // and at the 390×844 opening distance the faced Moon's labels
      // stand ~10px apart under 0.68rem chips (7 intersecting
      // pairs). The law this pass establishes: a plate may never
      // overlap its neighbours. Group this pass's calendar-face
      // day plates by Moon, measure each plate's nearest-neighbour
      // anchor distance inside its own Moon's grid, and cap the
      // plate at PLATE_PITCH_CAP_FRACTION of that distance. Two
      // capped neighbours then always leave a fifth of their pitch
      // clear between disc edges — per Moon, per pass, at any
      // aspect — because each disc's diameter is bounded by 0.8×
      // a distance no greater than the pair's own separation. The
      // selected day's Day Approach growth (the standalone `scale`
      // in sphere-armillary.css: 1.3 approach, 1.55 living /
      // immersive) is divided out of its cap, so the growth cannot
      // break the law at close zoom either.
      //
      // Repair pass (Nov 22, 2026, 18:12): the neighbour search is
      // no longer grouped by Moon. Aaron's top-down shot showed
      // grids colliding ACROSS Moon borders — two adjacent Moons'
      // edge days can stand closer than any pair inside one grid,
      // and the per-Moon grouping never measured them against
      // each other. The law is now global: every plate's nearest
      // neighbour is searched across ALL composed calendar-face
      // plates, so each disc is bounded by 0.8× a distance no
      // greater than ANY pair's separation, same Moon or not.
      const plateCapPlates = [];
      for (const candidate of composedSemanticCandidates) {
        const plateTarget = candidate?.target;
        if (
          !plateTarget
          || plateTarget.kind !== "pattern-day-number"
          || !plateTarget.calendarFace
        ) continue;
        plateCapPlates.push(candidate);
      }
      if (plateCapPlates.length > 1) {
        const zoomStage = String(_stageEl?.dataset?.zoomStage || "").toLowerCase();
        const selectedGrowth =
          zoomStage === "approach"
            ? 1.3
            : (zoomStage === "living" || zoomStage === "immersive")
              ? 1.55
              : 1;
        for (const candidate of plateCapPlates) {
          let nearest = Infinity;
          for (const other of plateCapPlates) {
            if (other === candidate) continue;
            const d = Math.hypot(
              candidate.anchorX - other.anchorX,
              candidate.anchorY - other.anchorY
            );
            if (d < nearest) nearest = d;
          }
          if (!Number.isFinite(nearest) || nearest <= 0) continue;
          let cap = nearest * PLATE_PITCH_CAP_FRACTION;
          if (candidate.target.selected && selectedGrowth > 1) cap /= selectedGrowth;
          candidate._plateCapPx = cap;
        }
      }

      const activeSemanticIds =
        new Set();

      // This pass's composed day-plate boxes, kept for the
      // Moon-pill protection post-pass below.
      const plateRects = [];

      for (
        const candidate
        of composedSemanticCandidates
      ) {
        const target = candidate.target;
        let el = _semanticEls.get(target.id) || null;
        if (!el && _semanticContainer && typeof document !== "undefined") {
          el = document.createElement("div");
          el.className = "sphere-semantic-label";
          el.dataset.semanticId = target.id;
          const body = document.createElement("span");
          body.className = "sphere-semantic-label-body";
          const status = document.createElement("span");
          status.className = "sphere-semantic-label-status";
          const title = document.createElement("strong");
          title.className = "sphere-semantic-label-title";
          const detail = document.createElement("small");
          detail.className = "sphere-semantic-label-detail";
          body.append(status, title, detail);
          const edit = document.createElement("button");
          edit.type = "button";
          edit.className = "sphere-semantic-label-edit";
          edit.textContent = "Edit";
          edit.hidden = true;
          edit.addEventListener("click", event => {
            const current = el?._semanticTarget || null;
            if (current?.kind !== "living-plan" || !current.recordId) return;
            event.preventDefault();
            event.stopPropagation();
            document.dispatchEvent(new CustomEvent("sof:living-plan-selected", {
              detail: {
                recordId: current.recordId,
                title: current.label,
                category: current.category,
                temporal: { patternYear: current.patternYear, patternDay: current.patternDay },
                schedule: current.schedule,
                source: "sphere-halo-edit",
                edit: true
              }
            }));
          });
          /*
           * B7.58 — explicit selected-day scheduling.
           * Reuse the existing Living Planner; do not duplicate planner logic.
           */
          const scheduleDay =
            document.createElement("button");

          scheduleDay.type =
            "button";

          scheduleDay.className =
            "sphere-semantic-label-schedule";

          scheduleDay.textContent =
            "+ Schedule";

          scheduleDay.hidden =
            true;

          scheduleDay.setAttribute(
            "aria-label",
            "Schedule something on selected day"
          );

          scheduleDay.addEventListener(
            "click",
            event => {
              const current =
                el?._semanticTarget
                || null;

              const scheduleable =
                current?.id ===
                  "selected-day"
                || (
                  current?.kind ===
                    "moon"
                  && current?.selected
                );

              if (!scheduleable) {
                return;
              }

              event.preventDefault();
              event.stopPropagation();

              const cursor =
                globalThis
                  .SOFTemporalCursor
                || null;

              const selectedDate =
                cursor?.getDate?.()
                || null;

              const coordinate =
                cursor
                  ?.getCoordinate?.()
                  ?.remnant13Moons
                || null;

              const selectedCivilDate =
                selectedDate
                  instanceof Date
                && !Number.isNaN(
                  selectedDate.getTime()
                )
                  ? [
                      String(
                        selectedDate
                          .getFullYear()
                      ).padStart(4, "0"),
                      String(
                        selectedDate
                          .getMonth()
                        + 1
                      ).padStart(2, "0"),
                      String(
                        selectedDate
                          .getDate()
                      ).padStart(2, "0")
                    ].join("-")
                  : null;

              const moon =
                Number(
                  coordinate?.moon
                  ?? current?.moon
                )
                || null;

              const moonDay =
                Number(
                  coordinate?.moonDay
                  ?? current?.moonDay
                )
                || null;

              const patternDay =
                Number(
                  coordinate?.patternDay
                  ?? current?.dayOfPatternYear
                  ?? current?.patternDay
                )
                || null;

              const request = {
                source:
                  "sphere-selected-day-card",
                selectedCivilDate,
                pattern: {
                  moon,
                  day:
                    moonDay,
                  dayOfPatternYear:
                    patternDay
                }
              };

              globalThis
                .__SOF_PENDING_SCHEDULE_DAY__ =
                  request;

              document.dispatchEvent(
                new CustomEvent(
                  "sof:sphere-schedule-selected-day",
                  {
                    detail:
                      request
                  }
                )
              );

              const plannerOpen =
                document.getElementById(
                  "living-planner-open"
                );

              if (!plannerOpen) {
                return;
              }

              plannerOpen.click();

              const applySelectedDay =
                () => {
                  const dateInput =
                    document.getElementById(
                      "living-planner-date"
                    );

                  if (
                    dateInput
                    && selectedCivilDate
                  ) {
                    dateInput.value =
                      selectedCivilDate;

                    dateInput.dispatchEvent(
                      new Event(
                        "input",
                        {
                          bubbles:
                            true
                        }
                      )
                    );

                    dateInput.dispatchEvent(
                      new Event(
                        "change",
                        {
                          bubbles:
                            true
                        }
                      )
                    );
                  }

                  const patternText =
                    [
                      moon
                        ? `Moon ${moon}`
                        : null,
                      moonDay
                        ? `Day ${moonDay}`
                        : null,
                      patternDay
                        ? `${patternDay}/364`
                        : null
                    ]
                      .filter(Boolean)
                      .join(" · ");

                  if (patternText) {
                    const context =
                      document
                        .getElementById(
                          "living-planner-context"
                        );

                    const readout =
                      document
                        .getElementById(
                          "living-planner-pattern-readout"
                        );

                    if (context) {
                      context.textContent =
                        patternText;
                    }

                    if (readout) {
                      readout.textContent =
                        patternText;
                    }
                  }
                };

              applySelectedDay();

              requestAnimationFrame(
                applySelectedDay
              );

              setTimeout(
                applySelectedDay,
                48
              );
            }
          );

          const close = document.createElement("button");
          close.type = "button";
          close.className = "sphere-semantic-label-close";
          close.textContent = "×";
          close.setAttribute("aria-label", `Hide ${target.label} label until you move away`);
          close.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            _proximityState.dismiss(target.id);
            el.style.display = "none";
            _dirty = true;
          });
          body.addEventListener("click", event => {
            const current = el?._semanticTarget || null;
            if (!current?.interactive) return;
            event.preventDefault();
            event.stopPropagation();
            if ((current.kind === "living-plan" || current.kind === "living-plan-summary") && current.recordId) {
              document.dispatchEvent(new CustomEvent("sof:living-plan-selected", {
                detail: {
                  recordId: current.recordId,
                  title: current.label,
                  category: current.category,
                  temporal: {
                    patternYear: current.patternYear,
                    patternDay: current.patternDay
                  },
                  schedule: current.schedule,
                  source: "sphere-halo",
                  edit: false
                }
              }));
            }
          });
          el.append(body, edit, scheduleDay, close);
          _semanticContainer.appendChild(el);
          _semanticEls.set(target.id, el);
        }
        if (!el) continue;
        activeSemanticIds.add(target.id);
        el._semanticTarget = target;
        const scheduleDayEl =
          el.querySelector?.(
            ".sphere-semantic-label-schedule"
          );

        if (scheduleDayEl) {
          const scheduleableSelectedDay =
            target.id ===
              "selected-day"
            || (
              target.kind ===
                "moon"
              && target.selected
            );

          scheduleDayEl.hidden =
            !scheduleableSelectedDay;

          scheduleDayEl.setAttribute(
            "aria-label",
            target.moon
              ? `Schedule something on Moon ${target.moon} selected day`
              : "Schedule something on selected day"
          );
        }

        const editEl = el.querySelector?.(".sphere-semantic-label-edit");
        if (editEl) editEl.hidden = !(target.kind === "living-plan" && target.recordId);
        const statusEl = el.querySelector?.(".sphere-semantic-label-status");
        const titleEl = el.querySelector?.(".sphere-semantic-label-title");
        const detailEl = el.querySelector?.(".sphere-semantic-label-detail");
        if (statusEl) {
          const statusText = target.statusLabel || "";
          statusEl.textContent = `${target.symbol ? `${target.symbol} ` : ""}${statusText}`.trim();
          statusEl.style.display = statusText || target.symbol ? "" : "none";
        }
        if (titleEl) titleEl.textContent = target.label;
        if (detailEl) {
          detailEl.textContent = target.detail;
          detailEl.style.display = target.detail && (target.pinned || candidate.distance <= target.detailDistance) ? "" : "none";
        }
        const closeEl = el.querySelector?.(".sphere-semantic-label-close");
        closeEl?.setAttribute?.("aria-label", `Hide ${target.label} label until you move away`);
        el.classList.toggle("is-pinned", target.pinned);
        el.classList.toggle("is-selected", target.selected);
        el.classList.toggle("is-interactive", target.interactive);
        el.dataset.semanticKind = target.kind;
        if (target.calendarFace) el.dataset.calendarFace = "true"; else delete el.dataset.calendarFace;
        if (target.today) el.dataset.today = "true"; else delete el.dataset.today;
        if (target.quietRail) el.dataset.quietRail = "true"; else delete el.dataset.quietRail;
        if (target.gateDay) el.dataset.gateDay = "true"; else delete el.dataset.gateDay;
        if (target.intercalary) el.dataset.intercalary = "true"; else delete el.dataset.intercalary;
        if (target.leapIntercalary) el.dataset.leapIntercalary = "true"; else delete el.dataset.leapIntercalary;
        if (target.haloLane) el.dataset.haloLane = target.haloLane;
        else delete el.dataset.haloLane;
        if (target.haloRank != null) el.dataset.haloRank = String(target.haloRank);
        else delete el.dataset.haloRank;
        if (target.category) el.dataset.plannerCategory = target.category;
        if (target.symbol) el.dataset.planSymbol = target.symbol; else delete el.dataset.planSymbol;
        if (target.workflow) el.dataset.planWorkflow = target.workflow; else delete el.dataset.planWorkflow;
        if (target.dayScheduleCount) el.dataset.scheduleCount = String(target.dayScheduleCount); else delete el.dataset.scheduleCount;
        if (target.dayScheduleCount) el.dataset.hasSchedule = "true"; else delete el.dataset.hasSchedule;
        // Visibility pass: the count badge (the ::before cue in the
        // calendar-face stack) rides only when a day holds more
        // than one thing — one thing is the symbol's own statement.
        if (target.dayScheduleCount > 1) el.dataset.scheduleMulti = "true"; else delete el.dataset.scheduleMulti;
        if (target.patternSignature) el.dataset.patternSignature = target.patternSignature;
        el.style.display = "";
        // Plate pitch cap application (the cap pass above, over
        // composedSemanticCandidates): bound this day plate's box
        // by its measured cap, the numeral scaling with the plate.
        // A previous pass's cap is cleared first and the natural
        // size re-measured under the stylesheet alone, so the cap
        // releases as the keeper zooms in — it never ratchets.
        // Inline !important is required: the band ladder's sizes
        // are stylesheet !important. The reads below (w / h) then
        // see the capped box, so placedRects respect it too.
        if (target.kind === "pattern-day-number" && target.calendarFace) {
          el.style.removeProperty("width");
          el.style.removeProperty("height");
          el.style.removeProperty("min-width");
          el.style.removeProperty("min-height");
          if (titleEl) titleEl.style.removeProperty("font-size");
          delete el.dataset.plateCapped;
          const plateCap = candidate._plateCapPx;
          // The marks decision in the rail render below works
          // from the plate's natural and (possibly capped) disc
          // sizes (repair pass §7 remainder).
          const naturalW = el.offsetWidth || 0;
          const naturalH = el.offsetHeight || 0;
          const natural = Math.max(naturalW, naturalH);
          candidate._plateNaturalPx = natural;
          candidate._plateDiscPx =
            Number.isFinite(plateCap) && plateCap > 0
              ? Math.min(natural, plateCap)
              : natural;
          if (Number.isFinite(plateCap) && plateCap > 0) {
            if (natural > plateCap) {
              const cappedW = Math.min(naturalW, plateCap);
              const cappedH = Math.min(naturalH, plateCap);
              el.style.setProperty("width", `${cappedW.toFixed(1)}px`, "important");
              el.style.setProperty("height", `${cappedH.toFixed(1)}px`, "important");
              el.style.setProperty("min-width", `${cappedW.toFixed(1)}px`, "important");
              el.style.setProperty("min-height", `${cappedH.toFixed(1)}px`, "important");
              el.dataset.plateCapped = "true";
              if (titleEl) {
                const naturalFont = parseFloat(getComputedStyle(titleEl).fontSize) || 0;
                if (naturalFont > 0) {
                  titleEl.style.setProperty(
                    "font-size",
                    `${(naturalFont * (plateCap / natural)).toFixed(2)}px`,
                    "important"
                  );
                }
              }
            }
          }
        }
        const w = el.offsetWidth || 132;
        const h = el.offsetHeight || 40;
        const radialX =
          candidate.anchorX
          - centerX;

        const radialY =
          candidate.anchorY
          - centerY;

        const radialLength =
          Math.hypot(
            radialX,
            radialY
          )
          || 1;

        const radialUnitX =
          radialX
          / radialLength;

        const radialUnitY =
          radialY
          / radialLength;

        // B7.6: a rail numeral is already anchored at its final world-space
        // radius. Do not add a second screen-space radial offset and do not
        // clamp it to the viewport — either operation changes the apparent
        // calendar angle and makes numbers bunch at the edges.
        const fixedRail =
          (target.kind === "pattern-day-number" || target.kind === "intercalary-day-number")
          && target.railLocked;

        if (fixedRail) {
          if (target.kind === "pattern-day-number") {
            const targetMoon = Number(target.moon || 0);

            if (targetMoon === frontMoon) {
              el.dataset.glideRole = "center";
            } else if (sharedMoonWindow.has(targetMoon)) {
              el.dataset.glideRole = "neighbor";
            } else {
              delete el.dataset.glideRole;
            }
          } else {
            delete el.dataset.glideRole;
          }

          const railX =
            interactionLite
              ? Math.round(
                  candidate.anchorX * 2
                ) / 2
              : candidate.anchorX;

          const railY =
            interactionLite
              ? Math.round(
                  candidate.anchorY * 2
                ) / 2
              : candidate.anchorY;

          el.style.left =
            `${railX}px`;

          el.style.top =
            `${railY}px`;

          // Sphere page rebuild (Nov 20, 2026) — the audit's F3:
          // a placed rail numeral is real estate the floating
          // cards must respect. Register its box so a card placed
          // later in this pass cannot sit on top of the numbers.
          placedRects.push({
            x: railX - w / 2,
            y: railY - h / 2,
            w,
            h
          });

          plateRects.push({
            x: railX - w / 2,
            y: railY - h / 2,
            w,
            h,
            el,
            target
          });
          /*
           * B7.60.2 — overhead, the X-only aperture passes ONLY for a
           * numeral the gate itself passed in this update (recorded in
           * railGateVerdicts where the rail filter ran). B7.60.1 granted
           * the exemption from cameraOverhead alone, asserting every
           * numeral reaching this pass was a skeleton survivor or a
           * selected/pinned day; that invariant belongs to the gate, not
           * to this pass, and a stale or ungated composition must never
           * be able to spend it. A candidate without a passing verdict
           * keeps the real aperture, exactly as tilted.
           */
          const apertureOpacity =
            cameraOverhead
            && railGateVerdicts.get(
              candidate
            ) === true
              ? 1
              : railApertureOpacity(
                  candidate
                );

          const isCenterRail =
            Number(
              target.moon
              || 0
            )
            === Number(
              frontMoon
              || 0
            );

          const baseOpacity =
            isCenterRail
              ? 0.98
              : 0.84;

          const visualOpacity =
            target.selected
            || target.pinned
              ? 1
              : Math.max(
                  0.04,
                  apertureOpacity
                    * railZoomOpacity(
                        candidate
                      )
                    * baseOpacity
                );

          const apertureScale =
            target.selected
            || target.pinned
              ? 1
              : (
                  0.86
                  + apertureOpacity
                  * 0.07
                  + railZoomOpacity(
                      candidate
                    )
                  * 0.07
                );

          el.style.transform =
            `translate(-50%, -50%) scale(${apertureScale.toFixed(3)})`;

          // Anchor tracking (repair pass, Nov 22, 2026): this
          // plate rides its world anchor between layout passes,
          // and its size tracks the live pitch (see _trackFrame).
          _tracked.push({
            el,
            kind: "plate",
            world: [target.worldX, target.worldY, target.worldZ],
            baseX: railX,
            baseY: railY,
            baseScale: apertureScale,
            passNN: candidate._plateCapPx
              ? candidate._plateCapPx / PLATE_PITCH_CAP_FRACTION
              : null,
            transformTail: `translate(-50%, -50%) scale(${apertureScale.toFixed(3)})`,
            dx: 0,
            dy: 0
          });

          el.style.opacity =
            String(
              visualOpacity
            );

          el.dataset.apertureOpacity =
            apertureOpacity.toFixed(3);

          if (
            String(
              semanticBand
              || "medium"
            ).toLowerCase()
            === "far"
            || cameraOverhead
          ) {
            el.dataset.farSkeleton =
              "true";
          } else {
            delete el.dataset.farSkeleton;
          }

          /*
           * §7 remainder (repair pass, Nov 22, 2026): the plate's
           * marks — the schedule chip hanging below the disc and
           * the count badge at its top-right — are pseudo-elements
           * sized in rem; the pitch cap never reached them, so at
           * the opening's ~10px pitches an unscaled chip still
           * touched the plate below and an unscaled badge the
           * plate above (lab, seeded: 3 chip + 2 badge
           * intersections at the opening, 7 + 4 under Reveal
           * All). The rule, decided per plate from its own
           * measured geometry: both marks scale with the plate's
           * cap ratio (--plate-mark-scale, set in
           * sphere-armillary.css). The chip hangs only when its
           * scaled overhang fits the clear gap to the nearest
           * neighbour; when it fits inside the disc instead it
           * tucks onto the disc's lower edge; when it fits
           * nowhere it is suppressed for this pass. The badge
           * stands only when its scaled box clears the nearest
           * neighbour's disc on both axes. A suppressed mark
           * returns on the next closer pass — it waits, it never
           * touches. Distances here are layout px against the
           * screen-space pitch, which is conservative: the
           * aperture scale only ever shrinks the painted marker.
           */
          delete el.dataset.markTuck;
          delete el.dataset.markChip;
          delete el.dataset.markBadge;
          if (typeof el.style.removeProperty === "function") {
            el.style.removeProperty("--plate-mark-scale");
          }
          {
            const discPx = candidate._plateDiscPx || 0;
            const naturalPx = candidate._plateNaturalPx || 0;
            const pitchPx = candidate._plateCapPx
              ? candidate._plateCapPx / PLATE_PITCH_CAP_FRACTION
              : 0;
            if (discPx > 0 && naturalPx > 0 && pitchPx > 0) {
              const markScale = discPx / naturalPx;
              if (markScale < 1 && typeof el.style.setProperty === "function") {
                el.style.setProperty("--plate-mark-scale", markScale.toFixed(3));
              }
              let remPx = 16;
              try {
                remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
              } catch {
                /* rem default above */
              }
              const farBand =
                String(semanticBand || "medium").toLowerCase() === "far";
              const neighbourRadius = 0.4 * pitchPx;
              if (target.dayScheduleCount > 0) {
                const chipH = (farBand ? 0.78 : 0.95) * remPx * markScale;
                const chipOverhang =
                  chipH - (farBand ? 0.16 : 0.22) * remPx * markScale;
                const chipBottom = discPx / 2 + chipOverhang;
                let hangs =
                  chipBottom + neighbourRadius <= pitchPx;
                if (hangs) {
                  // The nearest neighbour may sit on a diagonal
                  // below, not directly underneath: its centre is
                  // pitchPx away at 45°, and the chip's box must
                  // clear its disc there too.
                  const diag = pitchPx / Math.SQRT2;
                  const diagDx = Math.max(0, diag - chipH / 2);
                  const diagDy = Math.max(0, diag - chipBottom);
                  if (Math.hypot(diagDx, diagDy) < neighbourRadius) {
                    hangs = false;
                  }
                }
                if (!hangs) {
                  if (chipH <= discPx) {
                    el.dataset.markTuck = "true";
                  } else {
                    el.dataset.markChip = "off";
                  }
                }
              }
              if (target.dayScheduleCount > 1) {
                const badgeH = (farBand ? 0.66 : 0.78) * remPx * markScale;
                const badgeOut = (farBand ? 0.26 : 0.34) * remPx * markScale;
                const topReach = discPx / 2 + badgeOut;
                const vertGap = pitchPx - topReach;
                const boxLeft = topReach - badgeH;
                let distAbove;
                if (vertGap >= 0) {
                  distAbove = Math.hypot(Math.max(boxLeft, 0), vertGap);
                } else if (pitchPx >= topReach - badgeH) {
                  distAbove = Math.max(boxLeft, 0);
                } else {
                  distAbove = Math.hypot(Math.max(boxLeft, 0), -vertGap);
                }
                // The badge must clear the plate above (the
                // hypot distance to its box) and the plate to
                // the side. The side test uses the horizontal
                // gap alone (vertGap): the composed grid shears,
                // so the side neighbour's centre can sit inside
                // the badge's vertical span — measured in the
                // lab, Moon 8 Day 10's neighbour stands at
                // (+20.6, −6.2) from it, inside the span, and
                // grazed the un-margined test by ~0.5px. Both
                // tests carry a half-pixel margin over the
                // largest disc the cap law allows the neighbour.
                // (A 45°-diagonal test was tried and removed: it
                // double-counts — a lattice whose diagonal
                // neighbour sits at the pitch has its axis
                // neighbours closer still — and it suppressed
                // the badge at every distance, erasing the count
                // cue entirely.)
                if (
                  distAbove < neighbourRadius + 0.5
                  || vertGap < neighbourRadius + 0.5
                ) {
                  el.dataset.markBadge = "off";
                }
              }
            }
          }

          _hideSemanticLeader(target.id);
          continue;
        }

        // Floating semantic cards may move outward and participate in collision
        // placement. Calendar rail numerals never enter this path.
        el.style.transform = "";
        const selectedMoonCard =
          target.kind === "moon"
          && target.selected;

        const semanticOutward =
          selectedMoonCard
            ? (
                mobile
                  ? 34
                  : 46
              )
            : (
                target.haloOffset != null
                  ? target.haloOffset
                  : (
                      mobile
                        ? 62
                        : 82
                    )
              );

        const outwardX =
          candidate.anchorX
          + radialUnitX
          * semanticOutward;

        const outwardY =
          candidate.anchorY
          + radialUnitY
          * semanticOutward;

        // Sphere page rebuild (Nov 20, 2026) — the audit's F3
        // collision rule: after the anchor's own outward spot,
        // cards prefer the stage's empty corners before they try
        // the ring's neighbourhood. Candidates are already sorted
        // selected-first, so the selection card claims its ground
        // and the Today card yields to it.
        const cornerAttempts = [
          { x: offsetX + STAGE_PADDING, y: offsetY + STAGE_PADDING },
          { x: offsetX + stageRect.width - w - STAGE_PADDING, y: offsetY + STAGE_PADDING },
          { x: offsetX + STAGE_PADDING, y: offsetY + stageRect.height - h - STAGE_PADDING },
          { x: offsetX + stageRect.width - w - STAGE_PADDING, y: offsetY + stageRect.height - h - STAGE_PADDING }
        ];

        const attempts = [
          {
            x:
              outwardX
              - w
              / 2,
            y:
              outwardY
              - h
              / 2
          },

          ...cornerAttempts,

          {
            x:
              candidate.anchorX
              + 16,
            y:
              candidate.anchorY
              - h
              - 12
          },

          {
            x:
              candidate.anchorX
              + 16,
            y:
              candidate.anchorY
              + 12
          },

          {
            x:
              candidate.anchorX
              - w
              - 16,
            y:
              candidate.anchorY
              - h
              - 12
          },

          {
            x:
              candidate.anchorX
              - w
              - 16,
            y:
              candidate.anchorY
              + 12
          }
        ];
        let chosen = null;
        for (const attempt of attempts) {
          const left = clamp(attempt.x, offsetX + STAGE_PADDING, Math.max(offsetX + STAGE_PADDING, offsetX + stageRect.width - w - STAGE_PADDING));
          const top = clamp(attempt.y, offsetY + STAGE_PADDING, Math.max(offsetY + STAGE_PADDING, offsetY + stageRect.height - h - STAGE_PADDING));
          const box = { x: left, y: top, w, h };
          const collides =
            placedRects.some(
              prev =>
                rectsOverlap(
                  box,
                  prev
                )
            )
            || (target.kind === "living-plan" ? blockedRects : semanticBlockedRects).some(
              prev =>
                rectsOverlap(
                  box,
                  prev
                )
            );
          if (!collides) { chosen = { left, top, box }; break; }
        }
        if (!chosen && !(target.pinned || target.selected)) {
          el.style.display = "none";
          activeSemanticIds.delete(target.id);
          continue;
        }
        if (!chosen) {
          // Sphere page rebuild (Nov 20, 2026) — F3: a pinned or
          // selected card is never hidden, but its last resort is
          // a free corner, not the anchor's ground on the ring.
          // Only when every corner is also taken does it stand at
          // the anchor, as before.
          for (const corner of cornerAttempts) {
            const left = clamp(corner.x, offsetX + STAGE_PADDING, Math.max(offsetX + STAGE_PADDING, offsetX + stageRect.width - w - STAGE_PADDING));
            const top = clamp(corner.y, offsetY + STAGE_PADDING, Math.max(offsetY + STAGE_PADDING, offsetY + stageRect.height - h - STAGE_PADDING));
            const box = { x: left, y: top, w, h };
            const collides =
              placedRects.some(prev => rectsOverlap(box, prev))
              || (target.kind === "living-plan" ? blockedRects : semanticBlockedRects).some(prev => rectsOverlap(box, prev));
            if (!collides) { chosen = { left, top, box }; break; }
          }
        }
        if (!chosen) {
          const left = clamp(candidate.anchorX + 12, offsetX + STAGE_PADDING, Math.max(offsetX + STAGE_PADDING, offsetX + stageRect.width - w - STAGE_PADDING));
          const top = clamp(candidate.anchorY - h - 10, offsetY + STAGE_PADDING, Math.max(offsetY + STAGE_PADDING, offsetY + stageRect.height - h - STAGE_PADDING));
          chosen = { left, top, box: { x: left, y: top, w, h } };
        }
        placedRects.push(chosen.box);
        el.style.left = `${chosen.left}px`;
        el.style.top = `${chosen.top}px`;
        el.style.opacity = "1";
        _updateSemanticLeader(target, candidate, chosen);
        if (target.moon && _labelEls[target.moon - 1]) _hideLabel(_labelEls[target.moon - 1]);
      }
      for (const [id, el] of _semanticEls.entries()) {
        if (!activeSemanticIds.has(id)) {
          el.style.display = "none";
          _hideSemanticLeader(id);
        }
      }

      const marker = todayMarkerPosition;
      const selectedMarker = selectedMarkerPosition || marker || null;
      /*
       * Repair pass (Nov 22, 2026) — Moon pills stand clear of the
       * plates. The protected stylesheet stacks the semantic layer
       * (z-index 11) over the Moon-pill layer (z-index 3), so
       * wherever a plate lands on a pill the pill is buried —
       * Aaron's shots show "Moon 4", "Moon 10" and "Moon 3"
       * clipped by day plates. The label layer cannot restack
       * those layers from here, so it protects the pills
       * geometrically: first try to move the pill clear of every
       * plate (bounded shifts, stage-clamped, respecting the same
       * blocked ground as placement); if no clear ground exists,
       * fade the plates standing on it for this pass — never the
       * selected or pinned day, and never a plate of the pill's
       * own Moon (the faced Moon's name stands among its own days
       * by design). The selected Moon's pill is protected first.
       */
      if (plateRects.length && moonPlacements.length) {
        const protectedPills = [...moonPlacements].sort(
          (a, b) => (Number(b.selected) - Number(a.selected)) || (b.priority - a.priority)
        );
        for (const placed of protectedPills) {
          if (placed.el.style.display === "none") continue;
          const pw = placed.rect.w;
          const ph = placed.rect.h;
          let px = parseFloat(placed.el.style.left);
          let py = parseFloat(placed.el.style.top);
          if (!Number.isFinite(px) || !Number.isFinite(py)) {
            px = placed.rect.x;
            py = placed.rect.y;
          }
          const paddedBox = (x, y) => ({ x: x - 2, y: y - 2, w: pw + 4, h: ph + 4 });
          const blockers = plateRects.filter(pr => rectsOverlap(paddedBox(px, py), pr));
          if (!blockers.length) continue;
          const pcx = px + pw / 2;
          const pcy = py + ph / 2;
          const radialLen = Math.hypot(pcx - centerX, pcy - centerY) || 1;
          const ux = (pcx - centerX) / radialLen;
          const uy = (pcy - centerY) / radialLen;
          const shifts = [];
          for (const step of [8, 16, 24, 32, 40, 48]) shifts.push([ux * step, uy * step]);
          for (const step of [12, 24, 36]) {
            shifts.push([-uy * step, ux * step]);
            shifts.push([uy * step, -ux * step]);
          }
          for (const step of [12, 24]) shifts.push([-ux * step, -uy * step]);
          let moved = false;
          for (const [shiftX, shiftY] of shifts) {
            const nx = clamp(
              pcx + shiftX - pw / 2,
              offsetX + STAGE_PADDING,
              Math.max(offsetX + STAGE_PADDING, offsetX + stageRect.width - pw - STAGE_PADDING)
            );
            const ny = clamp(
              pcy + shiftY - ph / 2,
              offsetY + STAGE_PADDING,
              Math.max(offsetY + STAGE_PADDING, offsetY + stageRect.height - ph - STAGE_PADDING)
            );
            const box = paddedBox(nx, ny);
            if (plateRects.some(pr => rectsOverlap(box, pr))) continue;
            if (blockedRects.some(br => rectsOverlap(box, br))) continue;
            if (placedRects.some(pr => pr !== placed.rect && rectsOverlap(box, pr))) continue;
            px = nx;
            py = ny;
            moved = true;
            break;
          }
          if (moved) {
            placed.el.style.left = `${px}px`;
            placed.el.style.top = `${py}px`;
            placed.rect.x = px;
            placed.rect.y = py;
            if (placed.selected && selectedTarget) {
              selectedTarget.centerX = px + pw / 2;
              selectedTarget.centerY = py + ph / 2;
              selectedTarget.displaced = true;
            }
            continue;
          }
          for (const pr of blockers) {
            if (pr.target?.selected || pr.target?.pinned) continue;
            if (Number(pr.target?.moon || 0) === Number(placed.moon || 0)) continue;
            pr.el.style.opacity = "0";
            pr.el.dataset.pillProtected = "true";
          }
        }
      }

      if (_connectorEl && selectedTarget?.displaced) {
        let sx = selectedTarget.anchorX;
        let sy = selectedTarget.anchorY;
        if (selectedMarker && selectedMarker.x != null && selectedMarker.y != null && selectedMarker.z != null) {
          projVec.set(selectedMarker.x, selectedMarker.y, selectedMarker.z).project(camera);
          sx = offsetX + (((projVec.x + 1) / 2) * stageRect.width);
          sy = offsetY + (((-projVec.y + 1) / 2) * stageRect.height);
        }
        const ex = selectedTarget.centerX;
        const ey = selectedTarget.centerY;
        const dx = ex - sx;
        const dy = ey - sy;
        const len = Math.hypot(dx, dy);
        if (len > 10) {
          _connectorEl.style.display = "";
          _connectorEl.style.left = `${sx}px`;
          _connectorEl.style.top = `${sy}px`;
          _connectorEl.style.width = `${len}px`;
          _connectorEl.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
          _connectorEl.style.opacity = String(Math.min(0.78, selectedTarget.opacity * 0.8));
          // The connector rides with its anchor and its pill
          // between layout passes (repair pass, Nov 22, 2026).
          const selectedPlacement = moonPlacements.find(p => p.selected) || null;
          const connectorWorld =
            selectedMarker && selectedMarker.x != null
              ? [selectedMarker.x, selectedMarker.y, selectedMarker.z]
              : selectedPlacement?.world;
          if (Array.isArray(connectorWorld) && connectorWorld.every(Number.isFinite)) {
            _tracked.push({
              el: _connectorEl,
              kind: "connector",
              world: connectorWorld,
              baseX: sx,
              baseY: sy,
              baseSx: sx,
              baseSy: sy,
              baseEx: ex,
              baseEy: ey,
              pillEntry: selectedPlacement?.trackEntry || null,
              transformTail: "",
              dx: 0,
              dy: 0
            });
          }
        }
      }

      _ensureTrackLoop();
      return true;
    }

    function dispose() {
      if (_trackRaf && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(_trackRaf);
      }
      _trackRaf = 0;
      _tracked = [];
      _trackCtx = null;
      _proximityState.clear();
      for (const el of _semanticEls.values()) el?.remove?.();
      _semanticEls.clear();
      for (const path of _semanticLeaderEls.values()) path?.remove?.();
      _semanticLeaderEls.clear();
      _semanticLeaderSvg?.remove?.();
      _semanticLeaderSvg = null;
      _semanticContainer?.remove?.();
      _semanticContainer = null;
      _stageEl = null;
      _labelContainer = null;
      _labelEls = [];
      _connectorEl = null;
      _dirty = true;
      _lastSignature = "";
    }

    return Object.freeze({ init, update, markDirty, dispose, dismissSemantic: _proximityState.dismiss, semanticDismissals: _proximityState.snapshot });
  }

  globalThis.LivingTimeSphereLabelManager = Object.freeze({
    createManager,
    constants: Object.freeze({
      MIN_OFFSET,
      MAX_OFFSET,
      STAGE_PADDING,
      SEMANTIC_TARGET_CAP,
      SEMANTIC_DESKTOP_LABEL_CAP,
      SEMANTIC_MOBILE_LABEL_CAP,
      SEMANTIC_PROFILE_BUDGETS,
      SEMANTIC_BAND_DISTANCE_MULTIPLIERS,
      SEMANTIC_MOBILE_DISTANCE_MULTIPLIER
    }),
    _internals: Object.freeze({
      buildLabelSet,
      priorityForMoon,
      rectsOverlap,
      clamp,
      normalizeSemanticTarget,
      resolveProximityEnvelope,
      createProximityState,
      normalizeRuntimeProfile,
      runtimeProfileFromStage,
      isCompactSurface,
      resolveSemanticBudget,
      semanticTargetGroup,
      composeSemanticCandidates,
      circularMoonDistance,
      moonGridPitches,
      contextDisciplineAllows,
      PLATE_PITCH_FLOOR_PX
    })
  });
})();
