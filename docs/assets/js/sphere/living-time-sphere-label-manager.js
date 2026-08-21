(() => {
  "use strict";

  const MIN_OFFSET = 8;
  const MAX_OFFSET = 16;
  const STAGE_PADDING = 10;
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

    return Math.max(
      0,
      Math.min(
        absoluteCap,
        Number(
          configured
        )
        || 0
      )
    );
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
        cameraSignature(camera)
      ].join("::");

      if (!_dirty && signature === _lastSignature) return false;
      _dirty = false;
      _lastSignature = signature;

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
          targetX: anchorX + rx * outward,
          targetY: anchorY + ry * outward
        });
      }

      candidates.sort((a, b) => b.priority - a.priority || b.frontness - a.frontness);

      let selectedTarget = null;
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
        const centerCamSpace = new THREE.Vector3(0, 0, 0).applyMatrix4(camera.matrixWorldInverse);
        semanticCandidates.push({
          target: effectiveTarget,
          distance,
          anchorX,
          anchorY,
          cameraZ: camSpace.z,
          frontDepth: camSpace.z - centerCamSpace.z
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

          const apertureOpacity =
            railApertureOpacity(
              candidate
            );

          if (
            target?.kind ===
            "intercalary-day-number"
          ) {
            if (revealAll) return true;

            return (
              sharedMoonWindow
                .has(13)
              && apertureOpacity
                > 0.025
              && band !== "far"
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

          if (revealAll) {
            return true;
          }

          /*
           * B7.59.2A — keep a readable four-week skeleton at far distance.
           * Front Moon: 1, 7, 14, 21, 28.
           * Immediate neighbor Moon(s): 1, 14, 28.
           * Scheduled days also survive. The physical calendarCell never moves.
           */
          if (band === "far") {
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

            const structural =
              !centerMoon
                ? farFrontAnchor
                : (
                    moonDistance === 0
                      ? farFrontAnchor
                      : moonDistance === 1
                        ? farNeighborAnchor
                        : false
                  );

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

      const dayRailCandidates =
        semanticCandidates.filter(
          candidate =>
            (
              candidate?.target?.kind ===
                "pattern-day-number"
              || candidate?.target?.kind ===
                "intercalary-day-number"
            )
            && candidate?.target?.railLocked
            && railLabelVisible(
              candidate
            )
        );

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

      const activeSemanticIds =
        new Set();

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
        if (target.patternSignature) el.dataset.patternSignature = target.patternSignature;
        el.style.display = "";
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
          const apertureOpacity =
            railApertureOpacity(
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
          ) {
            el.dataset.farSkeleton =
              "true";
          } else {
            delete el.dataset.farSkeleton;
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
        }
      }

      return true;
    }

    function dispose() {
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
      composeSemanticCandidates
    })
  });
})();
