"use strict";

/*
 * The Codex World Engine — one engine, built once, for every
 * land (Codex World design, Nov 20, 2026, §5: "One engine,
 * built once").
 *
 * This module is the generic machinery Their Home
 * (spark-home-world.js, PR #205) proved on the companions page,
 * extracted as a SIBLING the World Gate — and every later land —
 * consumes:
 *
 *   - the sky: the phase from the visitor's own hour and the
 *     season from today's Pattern Day, read live and read-only
 *     through the canonical pipeline (SOFTemporalCursor →
 *     PatternCalendar). The maths is the same maths Their Home
 *     keeps; tests pin the two implementations to each other so
 *     the engine can never quietly drift from the proof.
 *   - lazy boot: a scene stands only when its place nears the
 *     screen (IntersectionObserver, the Their Home pattern).
 *   - the performance ladder: pixel ratio capped at 1.75,
 *     stepping down to 1.25, then 1.0, when frames run slow —
 *     down only, never up; the render loop pauses when the
 *     place is off-screen or the tab is hidden; reduced motion
 *     gets one still render; sizing follows a ResizeObserver.
 *   - the flat decision: the plain-site preference (a keeper's
 *     own switch, kept on their device), reduced motion,
 *     save-data, and a missing WebGL each serve the flat twin —
 *     a first-class equal, never an apology (design §4.2).
 *   - small decoration primitives the lands share: a Lambert
 *     material, the radial glow sprite, the drifting motes
 *     (pollen by day, fireflies by night), and a deterministic
 *     hash so a scene scatters the same way on every visit.
 *   - camera & touch: the drag-orbit, wheel-zoom, tap-detect
 *     Their Home's camera uses, parameterised for any scene.
 *
 * Their Home does NOT consume this engine: its module is the
 * protected proof, byte-stable, and its behaviour is pinned by
 * its own tests. The engine is the extraction the design's
 * Phase 1 calls for, standing beside it; lands built from here
 * on consume the engine. Behaviour preservation outranked
 * elegance — that is stated here so no one "tidies" it later.
 *
 * The pure half carries no DOM dependency and is unit-tested.
 * The engine reads the calendar and the keeper's preferences;
 * it writes nothing but the plain-site preference itself, at
 * the keeper's own hand.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.CodexWorldEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {

  const VERSION = "world-engine/1.0.0";

  /* ------------------------------ sky ------------------------------ */

  /* The day in four phases, from the visitor's own hour.
   * The same boundaries Their Home keeps (spark-home-world.js). */
  function phaseForHour(hour) {
    const h = Number(hour);
    if (!Number.isFinite(h)) return "day";
    if (h >= 5 && h < 7.5) return "dawn";
    if (h >= 7.5 && h < 17) return "day";
    if (h >= 17 && h < 20) return "dusk";
    return "night";
  }

  /* The counted year in four quarters from the Year Gate —
   * the same count Their Home keeps. A day outside the count
   * (the Day Out of Time) reads winter, the year's last breath. */
  function seasonForPatternDay(patternDay) {
    const pd = Number(patternDay);
    if (!Number.isFinite(pd) || pd < 1) return "winter";
    if (pd <= 91) return "spring";
    if (pd <= 182) return "summer";
    if (pd <= 273) return "autumn";
    return "winter";
  }

  const PHASE_NAMES = { dawn: "Dawn", day: "Daytime", dusk: "Dusk", night: "Night" };
  const SEASON_NAMES = { spring: "Spring", summer: "Summer", autumn: "Autumn", winter: "Winter" };

  function todayLineFor(today) {
    if (!today) return "Today, in Living Time";
    if (today.isDayOutOfTime) return "Today is the Day Out of Time";
    if (today.isDeepTimeDay) return "Today is the Deep Time Day";
    if (today.moon != null && today.day != null) {
      return `Moon ${today.moon} · Day ${today.day} · Pattern Day ${today.dayOfPatternYear}`;
    }
    return "Today, in Living Time";
  }

  /* The sky over any land: phase, season, and today's line,
   * composed from the visitor's hour and today's canonical
   * conversion. Read-only; nothing here computes a date the
   * canonical pipeline has not already given. */
  function skyFor(input = {}) {
    const today = input.today || null;
    const phase = phaseForHour(input.hour);
    const season = seasonForPatternDay(today ? today.dayOfPatternYear : null);
    return {
      phase,
      season,
      phaseName: PHASE_NAMES[phase],
      seasonName: SEASON_NAMES[season],
      todayLine: todayLineFor(today),
      line: `${PHASE_NAMES[phase]} · ${SEASON_NAMES[season]} of the Pattern year — ${todayLineFor(today)}`
    };
  }

  /* The scene palettes, in the family's colours — the same
   * light Their Home stands in, so lands rhyme. */
  const PHASE_LIGHT = {
    night: { bg: 0x0a1128, hemiSky: 0x36466a, hemiGround: 0x191411, hemi: 0.55, dir: 0x9db8ff, dirI: 0.3, stars: 0.95, body: 0x8fa8d8, bodyPos: [-9, 11, -14] },
    dawn: { bg: 0xbb8a68, hemiSky: 0xd8a37a, hemiGround: 0x3a2c22, hemi: 0.75, dir: 0xffb37a, dirI: 0.7, stars: 0.25, body: 0xffc98a, bodyPos: [13, 3.5, -6] },
    day: { bg: 0x9ec7e8, hemiSky: 0xcfe6ff, hemiGround: 0x4a5a3a, hemi: 1.0, dir: 0xfff2d8, dirI: 0.95, stars: 0, body: 0xffe9a8, bodyPos: [8, 13, -4] },
    dusk: { bg: 0x7a5570, hemiSky: 0xb98a7a, hemiGround: 0x2e2118, hemi: 0.7, dir: 0xff9a5e, dirI: 0.55, stars: 0.45, body: 0xffa26a, bodyPos: [-13, 3, -6] }
  };
  const SEASON_GROUND = { spring: 0x4d7f3e, summer: 0x59873c, autumn: 0x7d6c38, winter: 0xa8bcc2 };

  /* --------------------------- flat decision --------------------------- */

  const PLAIN_KEY = "sof.world.plain.v1";

  /* The flat decision, pure: given the signals, should this
   * visitor be served the flat twin? Each reason is named so a
   * land can say honestly which face it is standing in. */
  function flatDecision(env = {}) {
    if (env.plain) return { flat: true, reason: "plain" };
    if (env.webgl === false) return { flat: true, reason: "no-webgl" };
    if (env.reducedMotion) return { flat: true, reason: "reduced-motion" };
    if (env.saveData) return { flat: true, reason: "save-data" };
    return { flat: false, reason: null };
  }

  /* ------------------------------ helpers ------------------------------ */

  /* Deterministic scatter: the same text hashes to the same
   * fraction on every visit, so a scene is composed, not
   * re-rolled — the same hash Their Home scatters by. */
  function hash01(text) {
    let h = 0x811c9dc5;
    const s = String(text);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return ((h >>> 0) % 10000) / 10000;
  }

  return {
    VERSION,
    PLAIN_KEY,
    PHASE_NAMES,
    SEASON_NAMES,
    PHASE_LIGHT,
    SEASON_GROUND,
    phaseForHour,
    seasonForPatternDay,
    todayLineFor,
    skyFor,
    flatDecision,
    hash01
  };
});

/* ============================ browser half ============================ */
(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const Engine = window.CodexWorldEngine;
  if (!Engine) return;

  function assetUrl(rel) {
    const base = document.querySelector("base");
    try {
      return new URL(rel, base ? base.href : document.baseURI).href;
    } catch {
      return rel;
    }
  }

  function loadScript(rel) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = assetUrl(rel);
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`could not load ${rel}`));
      document.head.appendChild(s);
    });
  }

  /* Today's canonical conversion, read-only, through the one
   * temporal authority — the same read Their Home makes. */
  function todayCoordinate() {
    if (window.SOFTemporalCursor && typeof window.SOFTemporalCursor.resolvePosition === "function") {
      try {
        const pos = window.SOFTemporalCursor.resolvePosition(new Date());
        if (pos) return pos;
      } catch { /* fall through */ }
    }
    if (window.PatternCalendar) return window.PatternCalendar.fromCivilDate({ date: new Date() });
    return null;
  }

  function webglAvailable() {
    try {
      const canvas = document.createElement("canvas");
      return Boolean(window.WebGLRenderingContext && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
    } catch {
      return false;
    }
  }

  function plainPreferred() {
    try {
      return window.localStorage.getItem(Engine.PLAIN_KEY) === "1";
    } catch {
      return false;
    }
  }

  function setPlainPreferred(on) {
    try {
      if (on) window.localStorage.setItem(Engine.PLAIN_KEY, "1");
      else window.localStorage.removeItem(Engine.PLAIN_KEY);
    } catch { /* a preference that cannot be kept is simply not kept */ }
  }

  /* The flat decision for this visitor, from live signals. */
  function currentFlatDecision() {
    return Engine.flatDecision({
      plain: plainPreferred(),
      webgl: webglAvailable(),
      reducedMotion: Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches),
      saveData: Boolean(navigator.connection && navigator.connection.saveData)
    });
  }

  /* Lazy boot: run fn once, when el nears the screen — the
   * Their Home pattern (240px root margin), with an honest
   * fallback where IntersectionObserver is not to be had. */
  function bootWhenNear(el, fn, rootMargin = "240px") {
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      void fn();
      return;
    }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        io.disconnect();
        void fn();
      }
    }, { rootMargin });
    io.observe(el);
  }

  /* ------------------------- decoration primitives ------------------------- */

  function lambert(THREE, color, opts) {
    return new THREE.MeshLambertMaterial({ color, ...(opts || {}) });
  }

  /* The soft radial glow Their Home gives its Spark, as a
   * sprite any land can hang on a light. */
  function glowSprite(THREE, cssColor, scale = 2.4, opacity = 0.55) {
    const cnv = document.createElement("canvas");
    cnv.width = cnv.height = 128;
    const ctx = cnv.getContext("2d");
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, cssColor);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cnv), transparent: true, opacity, depthWrite: false
    }));
    sprite.scale.set(scale, scale, 1);
    return sprite;
  }

  /* Drifting motes — pollen by day, fireflies by night — the
   * same drift Their Home's air carries. */
  function motes(THREE, { count = 44, spread = 22, height = 2.6, color = 0xfff6d8, size = 0.13 } = {}) {
    const geo = new THREE.BufferGeometry();
    const base = [];
    const pts = [];
    for (let i = 0; i < count; i++) {
      const x = (Engine.hash01(`mote-x-${i}`) - 0.5) * spread;
      const y = 0.4 + Engine.hash01(`mote-y-${i}`) * height;
      const z = (Engine.hash01(`mote-z-${i}`) - 0.5) * spread;
      base.push([x, y, z]);
      pts.push(x, y, z);
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({
      color, size, transparent: true, opacity: 0.8
    }));
    return {
      points,
      update(t) {
        const attr = geo.getAttribute("position");
        for (let i = 0; i < count; i++) {
          const [bx, by, bz] = base[i];
          attr.setXYZ(i,
            bx + Math.sin(t * 0.24 + i * 1.7) * 0.7,
            by + Math.sin(t * 0.5 + i * 2.3) * 0.3,
            bz + Math.cos(t * 0.19 + i) * 0.7);
        }
        attr.needsUpdate = true;
      }
    };
  }

  /* ----------------------------- camera & touch ----------------------------- */

  /* Drag to orbit, wheel to zoom, tap to choose — the camera
   * Their Home's keeper already knows, parameterised. */
  function orbit(THREE, el, camera, opts = {}) {
    const target = new THREE.Vector3(...(opts.target || [0, 0, 0]));
    let azimuth = opts.azimuth != null ? opts.azimuth : 0.55;
    let polar = opts.polar != null ? opts.polar : 1.03;
    let radius = opts.radius != null ? opts.radius : 14.5;
    const minPolar = opts.minPolar != null ? opts.minPolar : 0.62;
    const maxPolar = opts.maxPolar != null ? opts.maxPolar : 1.32;
    const minRadius = opts.minRadius != null ? opts.minRadius : 9;
    const maxRadius = opts.maxRadius != null ? opts.maxRadius : 21;
    let lastTouch = 0;
    function place() {
      camera.position.set(
        target.x + radius * Math.sin(polar) * Math.sin(azimuth),
        target.y + radius * Math.cos(polar),
        target.z + radius * Math.sin(polar) * Math.cos(azimuth)
      );
      camera.lookAt(target);
    }
    place();
    let downAt = null;
    el.style.touchAction = "none";
    el.addEventListener("pointerdown", e => {
      downAt = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now() };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", e => {
      if (!downAt) return;
      const dx = e.clientX - downAt.lx;
      const dy = e.clientY - downAt.ly;
      downAt.lx = e.clientX;
      downAt.ly = e.clientY;
      if (Math.abs(e.clientX - downAt.x) + Math.abs(e.clientY - downAt.y) > 7) downAt.moved = true;
      if (!downAt.moved) return;
      azimuth -= dx * 0.0052;
      polar = Math.min(maxPolar, Math.max(minPolar, polar - dy * 0.004));
      lastTouch = performance.now();
      place();
      if (opts.onMove) opts.onMove();
    });
    el.addEventListener("pointerup", e => {
      const wasTap = downAt && !downAt.moved && performance.now() - downAt.t < 450;
      const at = { x: e.clientX, y: e.clientY };
      downAt = null;
      lastTouch = performance.now();
      if (wasTap && opts.onTap) opts.onTap(at);
    });
    el.addEventListener("wheel", e => {
      e.preventDefault();
      radius = Math.min(maxRadius, Math.max(minRadius, radius + Math.sign(e.deltaY) * 1.2));
      lastTouch = performance.now();
      place();
      if (opts.onMove) opts.onMove();
    }, { passive: false });
    return {
      place,
      idleSpin(dt) {
        if (performance.now() - lastTouch > 6000) {
          azimuth += dt * 0.018;
          place();
        }
      },
      get lastTouch() { return lastTouch; }
    };
  }

  /* ------------------------------- scene mount ------------------------------- */

  /* Mount a scene in a stage element under the performance
   * ladder. build(THREE, ctx) composes the scene and may
   * return { tick(dt, t), dispose() }. ctx carries the scene,
   * the camera, and requestRender() for still-mode redraws.
   * Resolves to a handle; rejects when WebGL or the engine is
   * not to be had, so the caller can stand the still face. */
  async function mountScene({ stageEl, build }) {
    const THREE = await import(assetUrl("assets/vendor/three/three.module.min.js"));
    const W = stageEl.clientWidth || 640;
    const H = stageEl.clientHeight || 400;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(W, H);
    stageEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, W / H, 0.1, 200);
    const reducedMotion = Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    let built = null;
    let disposed = false;
    let visible = true;
    const renderOnce = () => renderer.render(scene, camera);
    const ctx = { THREE, scene, camera, renderer, stageEl, reducedMotion, requestRender: renderOnce };
    built = build(THREE, ctx) || {};

    const io = new IntersectionObserver(entries => {
      visible = entries.some(en => en.isIntersecting);
    }, { threshold: 0.05 });
    io.observe(stageEl);

    new ResizeObserver(() => {
      const w = stageEl.clientWidth || W;
      const h = stageEl.clientHeight || H;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (reducedMotion) renderOnce();
    }).observe(stageEl);

    const clock = new THREE.Clock();
    let frames = 0;
    let slowTime = 0;
    let prLevel = 0;
    function tick() {
      if (disposed) return;
      requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      if (built.tick) built.tick(dt, t);
      renderer.render(scene, camera);
      /* step the quality down on a slow device, never up */
      frames += 1;
      slowTime += dt;
      if (frames >= 150 && prLevel < 2) {
        const avg = slowTime / frames;
        if (avg > 0.027) {
          prLevel += 1;
          renderer.setPixelRatio(prLevel === 1 ? 1.25 : 1);
        }
        frames = 0;
        slowTime = 0;
      }
    }
    if (reducedMotion) {
      renderOnce();
    } else {
      tick();
    }
    return {
      dispose() {
        disposed = true;
        io.disconnect();
        if (built.dispose) built.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      }
    };
  }

  Object.assign(Engine, {
    assetUrl,
    loadScript,
    todayCoordinate,
    webglAvailable,
    plainPreferred,
    setPlainPreferred,
    currentFlatDecision,
    bootWhenNear,
    lambert,
    glowSprite,
    motes,
    orbit,
    mountScene
  });
})();
