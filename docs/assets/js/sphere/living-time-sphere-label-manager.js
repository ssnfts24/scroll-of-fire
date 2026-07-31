(() => {
  "use strict";

  const MIN_OFFSET = 12;
  const MAX_OFFSET = 24;
  const STAGE_PADDING = 8;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
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

  function buildLabelSet({ labelMode, selectedMoon, todayMoon, equinoxMoon, mobile, showAllMobileLabels }) {
    if (labelMode === "hidden") return new Set();
    if (mobile && !showAllMobileLabels) {
      return new Set([todayMoon, selectedMoon, 1, 13].filter(Boolean));
    }
    if (labelMode === "selected") return new Set(selectedMoon ? [selectedMoon] : []);
    if (labelMode === "all") return new Set(Array.from({ length: 13 }, (_, i) => i + 1));
    return new Set([selectedMoon, todayMoon, equinoxMoon, 1, 13].filter(Boolean));
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
    }

    function markDirty() {
      _dirty = true;
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
      viewMode,
      stageEl,
      visibleLayersKey
    }) {
      const stage = stageEl || _stageEl;
      if (!stage || !_labelEls?.length || !camera || !three || !Array.isArray(anchors)) return false;
      const rect = stage.getBoundingClientRect();
      if (!rect?.width || !rect?.height) return false;

      const todayMoon = model?.todayPatternPosition?.moon || null;
      const selectedMoon = selectedPatternPosition?.moon || todayMoon || model?.sourceRecord?.equinox?.patternPosition?.moon || 1;
      const selectedDayMoon = selectedPatternPosition?.moon || null;
      const equinoxMoon = model?.sourceRecord?.equinox?.patternPosition?.moon || null;
      const mobile = typeof window !== "undefined" ? window.innerWidth < 600 : false;
      const showSet = buildLabelSet({ labelMode, selectedMoon, todayMoon, equinoxMoon, mobile, showAllMobileLabels: !!showAllMobileLabels || labelMode === "all" });
      const signature = [
        rect.width,
        rect.height,
        labelMode,
        viewMode,
        selectedMoon,
        selectedDayMoon,
        todayMoon,
        equinoxMoon,
        mobile ? "m" : "d",
        showAllMobileLabels ? "show" : "compact",
        visibleLayersKey || "",
        cameraSignature(camera)
      ].join("::");

      if (!_dirty && signature === _lastSignature) return false;
      _dirty = false;
      _lastSignature = signature;

      const THREE = three;
      const centerVec = new THREE.Vector3(0, 0, 0).project(camera);
      const centerX = ((centerVec.x + 1) / 2) * rect.width;
      const centerY = ((-centerVec.y + 1) / 2) * rect.height;
      const camPos = camera.position || new THREE.Vector3();
      const camForward = new THREE.Vector3();
      camera.getWorldDirection?.(camForward);
      const projVec = new THREE.Vector3();
      const worldVec = new THREE.Vector3();
      const camSpace = new THREE.Vector3();
      const placedRects = [];
      const candidates = [];

      _hideConnector();
      _labelEls.forEach(_hideLabel);

      for (let i = 0; i < anchors.length; i += 1) {
        const anchor = anchors[i];
        const moon = anchor?.moon;
        const el = _labelEls[i];
        if (!el || !showSet.has(moon)) continue;

        worldVec.set(anchor.worldX, anchor.worldY, anchor.worldZ);
        projVec.copy(worldVec).project(camera);
        camSpace.copy(worldVec).applyMatrix4(camera.matrixWorldInverse);

        if (camSpace.z > 0) continue;
        if (projVec.z < -1 || projVec.z > 1) continue;

        const anchorX = ((projVec.x + 1) / 2) * rect.width;
        const anchorY = ((-projVec.y + 1) / 2) * rect.height;

        if (anchorX < -40 || anchorY < -40 || anchorX > rect.width + 40 || anchorY > rect.height + 40) continue;

        const toPoint = worldVec.clone().sub(camPos).normalize();
        const frontness = clamp((camForward.dot(toPoint) + 1) * 0.5, 0, 1);
        if (frontness < 0.06) continue;

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

        const left = clamp(targetX - w / 2, STAGE_PADDING, rect.width - w - STAGE_PADDING);
        const top = clamp(targetY - h / 2, STAGE_PADDING, rect.height - h - STAGE_PADDING);
        const rectBox = { x: left, y: top, w, h };

        let collides = false;
        for (const prev of placedRects) {
          if (rectsOverlap(rectBox, prev)) {
            collides = true;
            break;
          }
        }
        if (collides && !selected) {
          _hideLabel(el);
          continue;
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

      const marker = todayMarkerPosition;
      if (_connectorEl && selectedTarget?.displaced) {
        let sx = selectedTarget.anchorX;
        let sy = selectedTarget.anchorY;
        if (marker && marker.x != null && marker.y != null && marker.z != null) {
          projVec.set(marker.x, marker.y, marker.z).project(camera);
          sx = ((projVec.x + 1) / 2) * rect.width;
          sy = ((-projVec.y + 1) / 2) * rect.height;
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

    return Object.freeze({ init, update, markDirty });
  }

  globalThis.LivingTimeSphereLabelManager = Object.freeze({
    createManager,
    constants: Object.freeze({ MIN_OFFSET, MAX_OFFSET, STAGE_PADDING }),
    _internals: Object.freeze({ buildLabelSet, priorityForMoon, rectsOverlap, clamp })
  });
})();
