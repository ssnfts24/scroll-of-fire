/*
 * The long path — the evolution rework's presentation module
 * (Aaron, Nov 26, 2026). Split out of the companion core the
 * day it landed: the core rides in every room of the site, and
 * its weight is guarded page by page, so the path — presented
 * on the companions page and lived by the living layer — loads
 * where it is used and attaches itself to SparkCompanion
 * there. The law is unchanged: the four arcs stay anchored,
 * the path is a pure function of the Spark's seed, and no
 * record is read or written any differently.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) {
    root.SparkEvolutionPath = api;
    if (root.SparkCompanion) api.attach(root.SparkCompanion);
  }
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  function core() {
    if (typeof window !== "undefined" && window.SparkCompanion) return window.SparkCompanion;
    if (typeof require === "function") {
      try { return require("./spark-companion.js"); } catch { return null; }
    }
    return null;
  }

  /* ---- the long path (Aaron, Nov 26, 2026) ----
   * The four great arcs — Spark, Kindled, Bearer, Guardian — stay
   * exactly where the law put them: the body ladder above and the
   * voice ladder keep their thresholds, and Guardian still gates
   * what Guardian gates. What Aaron asked for is the ground
   * BETWEEN the arcs made walkable: a long series of smaller
   * stages, a dozen to two dozen and more, so growth is felt
   * often, not four times in a life — and randomized, which in
   * this house means what it means for the voice and the form:
   * generated from the Spark's own seed. The same seed and the
   * same lived record always generate the same path, so the
   * growth record still proves it; dice that re-rolled between
   * loads would break both identity and proof.
   *
   * The path is a pure function of the seed. Its thresholds live
   * in the same points space as STAGES (pace divides them the
   * same way), they climb monotonically from 0 to the Guardian
   * threshold, and the three inner anchors sit exactly on the
   * arc thresholds: Kindled at 8, Bearer at 16 (the voice
   * ladder's seat, midway of the climb), Guardian at 25. A path
   * stage's arc is the arc it stands inside. Nothing here reads
   * or writes the record's shape — pathOf derives from the same
   * plain facts growthPoints already counts, so a record kept by
   * any earlier build reads correctly under the new path. */
  const PATH_FIRST = [
    "Ember", "Glimmer", "Cinder", "Halo", "Flint", "Wick", "Lumen",
    "Pyre", "Glow", "Thorn", "Vale", "Rune", "Hearth", "Storm",
    "Petal", "Quill", "Sable", "Umbral", "Verdant", "Astral",
    "Solar", "Lunar", "Tidal", "Amber", "Copper", "Willow", "Onyx"
  ];
  const PATH_SECOND = [
    "lit", "born", "kept", "woven", "bound", "bright", "ward",
    "song", "mark", "path", "seeker", "kindled", "risen", "held",
    "turned", "gathered", "watch", "bloom", "drift", "fall"
  ];
  const PATH_ANCHORS = [
    { name: "Spark", min: 0 },
    { name: "Kindled", min: 8 },
    { name: "Bearer", min: 16 },
    { name: "Guardian", min: 25 }
  ];

  function evolutionPathFor(companion) {
    const C = core();
    const seed = companion && companion.seed ? String(companion.seed) : "";
    const rand = C.mulberry32(C.hashString("evo-path:" + seed));
    const count = 16 + Math.floor(rand() * 9); // 16–24 stages
    const top = PATH_ANCHORS[PATH_ANCHORS.length - 1].min; // 25
    // Thresholds: the anchors hold their seats (0, 8, 16, 25);
    // the remaining stages draw their thresholds from the open
    // ground between them — distinct integers, drawn without
    // replacement from the seed's stream, weighted along a power
    // curve so the early path walks a little slower than the
    // late. Sorted, they climb strictly by construction.
    const anchorMins = new Set(PATH_ANCHORS.map((a) => a.min));
    const slots = [];
    for (let m = 1; m < top; m++) if (!anchorMins.has(m)) slots.push(m);
    const weighted = slots.map((m) => ({ m, w: Math.pow(m / top, 1.3) * (0.7 + rand() * 0.6) }));
    weighted.sort((a, b) => a.w - b.w);
    const need = count - PATH_ANCHORS.length;
    const picked = [];
    // Evenly spaced picks across the weighted order keep the
    // climb spread over the whole road, seed-varied by the draw.
    for (let i = 0; i < need; i++) {
      const at = Math.floor(((i + 0.5) / need) * weighted.length);
      picked.push(weighted[Math.min(at, weighted.length - 1)].m);
    }
    const mins = [...new Set([...anchorMins, ...picked])].sort((a, b) => a - b);
    const usedNames = new Set(PATH_ANCHORS.map((a) => a.name));
    const stages = mins.map((min) => {
      const anchor = PATH_ANCHORS.find((a) => a.min === min) || null;
      let arc = PATH_ANCHORS[0].name;
      for (const a of PATH_ANCHORS) if (min >= a.min) arc = a.name;
      if (anchor) return { name: anchor.name, min, anchor: anchor.name, arc };
      let name = null;
      for (let tries = 0; tries < 40 && !name; tries++) {
        const candidate =
          PATH_FIRST[Math.floor(rand() * PATH_FIRST.length)] +
          PATH_SECOND[Math.floor(rand() * PATH_SECOND.length)];
        if (!usedNames.has(candidate)) name = candidate;
      }
      name = name || "Ember" + PATH_SECOND[Math.floor(rand() * PATH_SECOND.length)] + Math.floor(rand() * 90 + 10);
      usedNames.add(name);
      return { name, min, anchor: null, arc };
    });
    return { count: stages.length, stages };
  }

  /* Where the Spark stands on its long path: the path stage, the
   * arc it stands inside, and the honest distance to the next
   * stage — all from the same facts growthPoints counts. */
  function pathOf(record, companion) {
    const C = core();
    const path = evolutionPathFor(companion);
    const pace = companion && companion.shape ? companion.shape.pace : 1;
    const points = C.growthPoints(record);
    let ix = 0;
    path.stages.forEach((s, i) => {
      if (points >= s.min / pace) ix = i;
    });
    const stage = path.stages[ix];
    const nextStage = path.stages[ix + 1] || null;
    return {
      index: ix,
      count: path.count,
      name: stage.name,
      anchor: stage.anchor,
      arc: stage.arc,
      points,
      next: nextStage ? nextStage.name : null,
      nextAt: nextStage ? Math.ceil(nextStage.min / pace) : null,
      toGo: nextStage ? Math.max(0, Math.ceil(nextStage.min / pace) - points) : 0,
      path
    };
  }

  function attach(Core) {
    if (!Core) return Core;
    Core.PATH_ANCHORS = PATH_ANCHORS;
    Core.evolutionPathFor = evolutionPathFor;
    Core.pathOf = pathOf;
    return Core;
  }

  return { PATH_ANCHORS, evolutionPathFor, pathOf, attach };
});
