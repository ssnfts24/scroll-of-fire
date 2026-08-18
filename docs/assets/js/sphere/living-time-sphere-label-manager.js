(() => {
  "use strict";

  const MIN_OFFSET = 8;
  const MAX_OFFSET = 16;
  const STAGE_PADDING = 10;
  const SEMANTIC_STATE_PRIORITY = Object.freeze({
    ambient: 100,
    proximity: 200,
    pinned: 300,
  });

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

  function semanticStatePriority(state) {
    const key = String(state || "ambient").toLowerCase();
    return SEMANTIC_STATE_PRIORITY[key] || SEMANTIC_STATE_PRIORITY.ambient;
  }

  function normalizeSemanticCandidate(candidate) {
    if (!candidate || typeof candidate !== "object") return null;
    const world = candidate.worldPosition || null;
    const x = Number(world?.x);
    const y = Number(world?.y);
    const z = Number(world?.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
    const state = semanticStatePriority(candidate.state) >= SEMANTIC_STATE_PRIORITY.pinned
      ? "pinned"
      : semanticStatePriority(candidate.state) >= SEMANTIC_STATE_PRIORITY.proximity
        ? "proximity"
        : "ambient";
    return {
      id: String(candidate.id || ""),
      type: candidate.type || "semantic",
      semanticRole: candidate.semanticRole || candidate.type || "semantic",
      title: String(candidate.title || candidate.label || candidate.id || "").trim(),
      subtitle: candidate.subtitle == null ? "" : String(candidate.subtitle).trim(),
      detail: candidate.detail == null ? "" : String(candidate.detail).trim(),
      worldPosition: { x, y, z },
      priority: Number.isFinite(Number(candidate.priority)) ? Number(candidate.priority) : 0,
      state,
      pinned: !!candidate.pinned || state === "pinned",
      selected: !!candidate.selected,
      dismissible: !!candidate.dismissible,
      sourceObject: candidate.sourceObject || null,
      metadata: candidate.metadata && typeof candidate.metadata === "object" ? { ...candidate.metadata } : {},
    };
  }

  function escapeHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function semanticCandidateMarkup(candidate) {
    if (!candidate) return "";
    const lines = [candidate.title || candidate.id];
    if (candidate.subtitle) lines.push(candidate.subtitle);
    if (candidate.detail && (candidate.state === "pinned" || candidate.selected)) lines.push(candidate.detail);
    return lines
      .filter(Boolean)
      .map((line, index) => `<span data-line="${index}">${escapeHtml(line)}</span>`)
      .join("");
  }

  function buildLabelSet({ labelMode, selectedMoon, todayMoon, equinoxMoon, mobile, showAllMobileLabels }) {
    if (labelMode === "none" || labelMode === "hidden") return new Set();
    if (mobile && !showAllMobileLabels) {
      return new Set([todayMoon, selectedMoon, 1, 13, equinoxMoon].filter(Boolean));
    }
    if (labelMode === "essential" || labelMode === "selected") return new Set(selectedMoon ? [selectedMoon] : []);
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
    let _semanticLabelContainer = null;
    let _semanticLabelMap = new Map();
    let _dirty = true;
    let _lastSignature = "";
    let _semanticDirty = true;
    let _lastSemanticSignature = "";

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

    function _hideSemanticLabel(el) {
      if (!el) return;
      el.style.display = "none";
      el.classList.remove("is-selected", "is-front", "is-quiet");
    }

    function _ensureSemanticLabel(candidate) {
      if (!_semanticLabelContainer || !candidate?.id) return null;
      let el = _semanticLabelMap.get(candidate.id) || null;
      if (!el) {
        el = document.createElement("span");
        el.className = "sphere-moon-label sphere-semantic-label";
        el.dataset.semanticId = candidate.id;
        el.style.position = "absolute";
        el.style.display = "none";
        el.style.pointerEvents = "none";
        el.style.whiteSpace = "normal";
        el.style.maxWidth = "13rem";
        el.style.lineHeight = "1.2";
        el.style.padding = "0.28rem 0.48rem";
        el.style.borderRadius = "0.72rem";
        el.style.zIndex = "4";
        _semanticLabelContainer.appendChild(el);
        _semanticLabelMap.set(candidate.id, el);
      }
      const markup = semanticCandidateMarkup(candidate);
      if (el.dataset.semanticMarkup !== markup) {
        el.innerHTML = markup;
        el.dataset.semanticMarkup = markup;
      }
      return el;
    }

    function init({ stageEl, labelContainer, labelEls, connectorEl }) {
      _stageEl = stageEl || null;
      _labelContainer = labelContainer || null;
      _labelEls = Array.isArray(labelEls) ? labelEls : [];
      _connectorEl = connectorEl || null;
      _semanticLabelContainer = labelContainer || null;
      _dirty = true;
      _lastSignature = "";
      _semanticDirty = true;
      _lastSemanticSignature = "";
      _hideConnector();
      _labelEls.forEach(_hideLabel);
      _semanticLabelMap.forEach(_hideSemanticLabel);
    }

    function markDirty() {
      _dirty = true;
      _semanticDirty = true;
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
      protectedRects
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
      const mobile = typeof window !== "undefined" ? window.innerWidth < 600 : false;
      const showSet = buildLabelSet({ labelMode, selectedMoon, todayMoon, equinoxMoon, mobile, showAllMobileLabels: !!showAllMobileLabels || labelMode === "all" });
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
        showAllMobileLabels ? "show" : "compact",
        visibleLayersKey || "",
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
        if (collides && !selected) {
          _hideLabel(el);
          continue;
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

    function updateSemantic({
      camera,
      three,
      candidates,
      stageEl,
      protectedRects
    }) {
      const stage = stageEl || _stageEl;
      if (!stage || !_semanticLabelContainer || !camera || !three || !Array.isArray(candidates)) return false;
      const stageRect = stage.getBoundingClientRect();
      if (!stageRect?.width || !stageRect?.height) return false;
      const containerRect = _semanticLabelContainer.getBoundingClientRect?.() || stageRect;
      const offsetX = stageRect.left - containerRect.left;
      const offsetY = stageRect.top - containerRect.top;
      camera.updateMatrixWorld?.(true);
      const blockedRects = Array.isArray(protectedRects)
        ? protectedRects.map(entry => normalizeRect(entry, containerRect)).filter(Boolean)
        : [];
      const normalized = candidates
        .map(normalizeSemanticCandidate)
        .filter(candidate => candidate && candidate.id);
      const signature = [
        stageRect.width,
        stageRect.height,
        cameraSignature(camera),
        normalized.map(candidate => [
          candidate.id,
          candidate.state,
          candidate.priority,
          candidate.selected ? 1 : 0,
          candidate.title,
          candidate.subtitle,
          candidate.detail,
          candidate.worldPosition.x.toFixed(4),
          candidate.worldPosition.y.toFixed(4),
          candidate.worldPosition.z.toFixed(4)
        ].join("|")).join("::")
      ].join("##");
      if (!_semanticDirty && signature === _lastSemanticSignature) return false;
      _semanticDirty = false;
      _lastSemanticSignature = signature;

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
      const usedIds = new Set();
      const visibleCandidates = [];

      _semanticLabelMap.forEach(_hideSemanticLabel);

      for (const candidate of normalized) {
        const pinned = candidate.state === "pinned" || candidate.pinned || candidate.selected;
        worldVec.set(candidate.worldPosition.x, candidate.worldPosition.y, candidate.worldPosition.z);
        projVec.copy(worldVec).project(camera);
        camSpace.copy(worldVec).applyMatrix4(camera.matrixWorldInverse);
        const projectedValid = Number.isFinite(projVec.x) && Number.isFinite(projVec.y) && Number.isFinite(projVec.z);
        if (!projectedValid) continue;
        const anchorX = offsetX + (((projVec.x + 1) / 2) * stageRect.width);
        const anchorY = offsetY + (((-projVec.y + 1) / 2) * stageRect.height);
        const toPoint = worldVec.clone().sub(camPos).normalize();
        const frontness = clamp((camForward.dot(toPoint) + 1) * 0.5, 0, 1);
        if (!pinned) {
          if (camSpace.z > 0) continue;
          if (projVec.z < -1 || projVec.z > 1) continue;
          if (frontness < (candidate.state === "ambient" ? 0.08 : 0.04)) continue;
          if (anchorX < offsetX - 56 || anchorY < offsetY - 56 || anchorX > offsetX + stageRect.width + 56 || anchorY > offsetY + stageRect.height + 56) continue;
        }
        const dxCenter = anchorX - centerX;
        const dyCenter = anchorY - centerY;
        const radialLen = Math.hypot(dxCenter, dyCenter) || 1;
        const rx = radialLen > 0 ? dxCenter / radialLen : 0;
        const ry = radialLen > 0 ? dyCenter / radialLen : -1;
        const stateWeight = semanticStatePriority(candidate.state);
        const outward = clamp(
          MIN_OFFSET + (stateWeight >= SEMANTIC_STATE_PRIORITY.pinned ? 14 : stateWeight >= SEMANTIC_STATE_PRIORITY.proximity ? 10 : 5),
          MIN_OFFSET,
          24
        );
        visibleCandidates.push({
          ...candidate,
          pinned,
          frontness,
          anchorX,
          anchorY,
          targetX: anchorX + rx * outward,
          targetY: anchorY + ry * outward,
          sortPriority: stateWeight + candidate.priority + (candidate.selected ? 30 : 0),
        });
      }

      visibleCandidates.sort((a, b) => b.sortPriority - a.sortPriority || b.frontness - a.frontness);

      for (const candidate of visibleCandidates) {
        const el = _ensureSemanticLabel(candidate);
        if (!el) continue;
        usedIds.add(candidate.id);
        el.style.display = "";
        const w = Math.max(el.offsetWidth || 96, candidate.state === "ambient" ? 72 : 92);
        const h = Math.max(el.offsetHeight || 24, candidate.state === "pinned" ? 42 : 24);
        const major = candidate.pinned || candidate.selected;
        const attempts = [
          { x: candidate.targetX, y: candidate.targetY },
          { x: candidate.targetX + (major ? 30 : 20), y: candidate.targetY },
          { x: candidate.targetX - (major ? 30 : 20), y: candidate.targetY },
          { x: candidate.targetX, y: candidate.targetY - (major ? 26 : 18) },
          { x: candidate.targetX, y: candidate.targetY + (major ? 26 : 18) },
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
        if (collides && !major) {
          _hideSemanticLabel(el);
          continue;
        }
        if (left == null || top == null || !rectBox) {
          left = clamp(candidate.targetX - w / 2, offsetX + STAGE_PADDING, Math.max(offsetX + STAGE_PADDING, offsetX + stageRect.width - w - STAGE_PADDING));
          top = clamp(candidate.targetY - h / 2, offsetY + STAGE_PADDING, Math.max(offsetY + STAGE_PADDING, offsetY + stageRect.height - h - STAGE_PADDING));
          rectBox = { x: left, y: top, w, h };
        }
        placedRects.push(rectBox);
        const clampDistance = Math.hypot((left + w / 2) - candidate.targetX, (top + h / 2) - candidate.targetY);
        const opacity = clamp(
          (candidate.state === "pinned" ? 0.92 : candidate.state === "proximity" ? 0.68 : 0.48)
            + candidate.frontness * 0.28
            - clampDistance * 0.015,
          candidate.state === "ambient" ? 0.28 : 0.5,
          1
        );
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        el.style.opacity = String(opacity);
        el.style.transform = `translateZ(0) scale(${major ? 1.02 : candidate.state === "ambient" ? 0.97 : 1})`;
        el.style.fontSize = candidate.state === "pinned" ? "0.78rem" : candidate.state === "proximity" ? "0.73rem" : "0.68rem";
        el.style.fontWeight = candidate.state === "pinned" ? "700" : candidate.state === "proximity" ? "600" : "500";
        el.style.color = candidate.state === "pinned" ? "#fff1c2" : candidate.state === "proximity" ? "rgba(214, 241, 235, 0.96)" : "rgba(186, 225, 216, 0.9)";
        el.style.background = candidate.state === "pinned"
          ? "rgba(52, 36, 10, 0.84)"
          : candidate.state === "proximity"
            ? "rgba(10, 22, 26, 0.78)"
            : "rgba(6, 10, 20, 0.54)";
        el.style.borderColor = candidate.state === "pinned"
          ? "rgba(251, 191, 36, 0.45)"
          : candidate.state === "proximity"
            ? "rgba(120, 220, 200, 0.26)"
            : "rgba(100, 200, 180, 0.12)";
        el.classList.toggle("is-selected", major);
        el.classList.toggle("is-front", candidate.frontness > 0.72);
        el.classList.toggle("is-quiet", candidate.state === "ambient" && !major);
      }

      _semanticLabelMap.forEach((el, id) => {
        if (!usedIds.has(id)) _hideSemanticLabel(el);
      });
      return true;
    }

    return Object.freeze({ init, update, updateSemantic, markDirty });
  }

  globalThis.LivingTimeSphereLabelManager = Object.freeze({
    createManager,
    constants: Object.freeze({ MIN_OFFSET, MAX_OFFSET, STAGE_PADDING }),
    _internals: Object.freeze({
      buildLabelSet,
      priorityForMoon,
      rectsOverlap,
      clamp,
      semanticStatePriority,
      normalizeSemanticCandidate,
      semanticCandidateMarkup,
    })
  });
})();
