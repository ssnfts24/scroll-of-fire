/** Life Atlas record projection for the Living Time Sphere. */
(function (root) {
  "use strict";
  const ID = "life-atlas-records";
  const state = { group: null, records: [], key: "", loading: false, context: null };
  function dispose(group) { if (!group) return; while (group.children.length) { const c = group.children.pop(); c.geometry?.dispose?.(); c.material?.dispose?.(); } group.parent?.remove?.(group); }
  function colorFor(type, phase, THREE) {
    const hex = phase === "future" ? 0x64d8c7 : phase === "present" ? 0xf6d56a : type === "media" ? 0xb69cff : type === "journey" || type === "place" ? 0x7fc6e8 : 0x91a9bd;
    return new THREE.Color(hex);
  }
  function yearWindow(context) {
    const T = root.LivingTimeSphereTemporalStrata; const selected = Number(context.selectedYear || context.model?.year || new Date().getFullYear());
    return T?.yearWindow ? T.yearWindow(selected, T.state.span, T.state.direction) : { start: selected - 12, end: selected + 12, reference: selected, count: 25, years: [] };
  }
  function patternAngle(record) { const day = Number(record.temporal?.patternDay); return Number.isFinite(day) ? ((day - .5) / 364) * Math.PI * 2 : null; }
  function build(context) {
    dispose(state.group); const THREE = context.THREE; if (!THREE || !context.scene) return;
    const group = new THREE.Group(); group.name = "life-atlas-records"; state.group = group;
    const window = yearWindow(context); const T = root.LivingTimeSphereTemporalStrata; const refYear = Number(window.reference);
    const selectedDay = Number(context.model?.selectedPatternPosition?.dayOfPatternYear || context.model?.todayPatternPosition?.dayOfPatternYear);

    /*
     * Share the same semantic temporal resolution as the
     * Living Onion.
     *
     * Records should never appear to float against a year
     * membrane that semantic zoom has intentionally suppressed.
     */
    const legibility =
      root.LivingTimeSphereTemporalLegibility;

    const semanticBand =
      context.semanticZoomState?.band
      || "medium";

    const legibilityPlan =
      legibility?.resolve
        ? legibility.resolve({
            window,
            selectedYear:
              refYear,
            band:
              semanticBand,
            tier:
              context.tier
              || "high"
          })
        : null;

    const visibleYears =
      legibilityPlan
        ? new Set(
            legibilityPlan.visibleYears
          )
        : null;

    const visible = state.records.filter(r => {
      const y =
        Number(
          r.temporal?.patternYear
        );

      const day =
        Number(
          r.temporal?.patternDay
        );

      return (
        Number.isFinite(y)
        && y >= window.start
        && y <= window.end
        && Number.isFinite(day)
        && (
          !visibleYears
          || visibleYears.has(y)
        )
      );
    });

    const limit =
      legibility?.recordBudget
        ? legibility.recordBudget({
            tier:
              context.tier
              || "high",
            band:
              semanticBand
          })
        : (
            context.tier === "low"
              ? 220
              : context.tier === "medium"
                ? 500
                : 900
          );
    visible.slice(-limit).forEach(record => {
      const angle = patternAngle(record); const year = Number(record.temporal.patternYear); if (angle == null) return;
      const radius = T?.radiusForYear ? T.radiusForYear(year, window, T.state.depth) : 1.24;
      const phase = year < refYear ? "past" : year > refYear ? "future" : "present";
      const sameDay = Number(record.temporal.patternDay) === selectedDay;
      const size = sameDay ? .026 : .014;
      const geometry = new THREE.SphereGeometry(size, context.tier === "low" ? 5 : 7, context.tier === "low" ? 4 : 6);
      const material = new THREE.MeshBasicMaterial({ color: colorFor(record.type, phase, THREE), transparent: true, opacity: sameDay ? .95 : .56, depthWrite: false });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(Math.sin(angle) * radius, sameDay ? .035 : 0, -Math.cos(angle) * radius);
      mesh.userData = { extension: ID, type: "life-atlas-record", recordId: record.id, recordType: record.type, title: record.title, year, patternDay: record.temporal.patternDay, interactionTarget: record.id };
      group.add(mesh);
    });
    context.scene.add(group);
  }
  function semanticTargets() {
    if (!state.group) return [];
    return (state.group.children || []).slice(-24).map(object => {
      const data = object?.userData || {};
      const record = state.records.find(item => item.id === data.recordId);
      if (!record || !object?.position) return null;
      const privacy = String(record.privacy?.visibility || record.privacy?.scope || "private").toLowerCase();
      const privateRecord = privacy !== "public" && privacy !== "shared";
      return {
        id: `life-atlas-${record.id}`,
        label: privateRecord ? "Private Life Atlas record" : (record.title || `${record.type} record`),
        detail: `${record.type || "record"} · ${record.temporal?.patternYear || "year unavailable"}`,
        kind: "life-atlas-record",
        worldX: object.position.x,
        worldY: object.position.y,
        worldZ: object.position.z,
        priority: 64,
        showDistance: 1.95,
        resetDistance: 2.35
      };
    }).filter(Boolean);
  }

  async function load(context) {
    if (state.loading || !root.CodexLifeAtlasRuntime) return; state.loading = true;
    try { state.records = await root.CodexLifeAtlasRuntime.records(); state.key = ""; build(context); context.requestRender?.(); } catch (_) {} finally { state.loading = false; }
  }
  const extension = {
    id: ID,
    metadata: { version: "1.0.0", purpose: "project private Life Atlas records into temporal year membranes" },
    mount(context) { state.context = context; void load(context); root.addEventListener?.("sof:life-atlas-records-changed", () => state.context && load(state.context)); },
    update(context) { state.context = context; const T = root.LivingTimeSphereTemporalStrata; const key = [context.selectedYear, context.model?.selectedPatternPosition?.dayOfPatternYear, T?.state?.span, T?.state?.direction, T?.state?.depth, state.records.length, context.tier, context.semanticZoomState?.band || "medium"].join("|"); if (key !== state.key) { state.key = key; build(context); } },
    semanticTargets() { return semanticTargets(); },
    pick(context) {
      if (!state.group || !context.raycaster) return null;
      const hits = context.raycaster.intersectObjects(state.group.children || [], false);
      if (!hits.length) return null;
      const object = hits[0].object;
      const data = object.userData || {};
      const record = state.records.find(item => item.id === data.recordId);
      if (!record) return null;
      return {
        handled: true,
        type: "life-atlas-record",
        label: record.title || `${record.type} record`,
        position: { x: object.position.x, y: object.position.y, z: object.position.z },
        recordId: record.id,
        recordType: record.type,
        title: record.title,
        summary: record.summary,
        temporal: record.temporal,
        spatial: record.spatial,
        provenance: record.provenance,
        privacy: record.privacy
      };
    },
    dispose() { dispose(state.group); state.group = null; state.records = []; }
  };
  root.LivingTimeSphereExtensionHost?.register?.(extension);
  root.LifeAtlasRecordSphereExtension = Object.freeze({ id: ID, extension });
})(typeof globalThis !== "undefined" ? globalThis : this);
