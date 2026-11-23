(() => {
  "use strict";

/*
 * Homepage Live Sphere — the actual Living Time Sphere, in the hero.
 *
 * Aaron's ask was simple: the real Sphere on the homepage, with easy
 * controls. So this module does not draw a sphere of its own. When the
 * hero approaches the viewport it loads the Observatory's own sphere
 * stack — the same modules, in the same order, that
 * docs/living-time-sphere.html loads — and mounts the genuine Living
 * Time Sphere into the hero stage through LivingTimeSphere.mount(),
 * the same public mount the Moons page uses for its embedded sphere.
 * No Observatory file is edited; the stack is only read.
 *
 * What the visitor gets is the Sphere itself: the 364 day numerals as
 * the surface, the thirteen Moons with their glass labels, the week
 * gates, and today held in gold — rendered by the Observatory's own
 * renderer, lit by its own materials, turning at its own drift.
 *
 * The hero keeps the small control set from the first build: drag to
 * turn (the renderer's own pointer handling), a Pause/Resume rotation
 * button (the mount's motion mode, the same switch the Observatory's
 * motion control flips), a Today button (the renderer's own
 * focusPatternDay, called the way the Observatory's Today control
 * calls it), and the door into the Observatory.
 *
 * Honesty rules, unchanged: the caption coordinate and the sphere's
 * today both resolve from PatternCalendar.fromCivilDate at the
 * midnight boundary in the visitor's own timezone. Until the mount is
 * live the static hero art shows exactly as before, and it stays for
 * no-JS, reduced-motion, and no-WebGL visitors.
 *
 * The opening view is the Observatory's settled view — distance 2.25,
 * phi 0.78, today in front. The shared camera module trims the
 * distance to 1.9 on phone-width viewports, which crops the disc
 * inside the hero frame, so when this mount reports the 3D renderer
 * live the hero eases the camera to 2.25 / 0.78, the same framing
 * the Today button restores. And because the page's 3D renderer is
 * a singleton shared with the homepage's instrument mount lower
 * down, a hero whose first 3D attempt loses that race (or times out
 * on a slow phone) retries the upgrade whenever the hero comes back
 * into view, instead of keeping the flat SVG face for the whole
 * visit. The stack load starts immediately for the same reason:
 * on a slow phone the load is the long pole, and the renderer goes
 * to whichever homepage mount asks first.
 *
 * The pure calendar core below (HomepageSphereCore) is pure math over
 * PatternCalendar + LivingTimeSphereCalendarGeometry — no DOM, no
 * WebGL — and stays exported for the test suite.
 */

  // ── Observatory constants (mirrored data, see header) ─────────────
  const PATTERN_RING = 0.7; // LivingTimeSphereM.SIZES.patternRing
  const MOON_LANE_FACTOR = 0.8; // renderer MOON_IDENTITY_LANE_FACTOR
  const MOON_BODY = Math.max(0.044, PATTERN_RING * 0.078); // MOON_IDENTITY_BODY_*
  const TODAY_RADIUS = 0.038; // SIZES.todayRadius
  const TODAY_HALO = 0.0513; // SIZES.todayHalo (slim cap — no ringed planet)
  const TODAY_HALO_TUBE = 0.005; // SIZES.todayHaloTube
  const COLOR_TODAY = 0xffd700; // COLORS.today
  const COLOR_YEAR_GATE = 0x64ffb4; // COLORS.yearGate
  const COLOR_RING = 0x334466; // COLORS.patternRing
  const COLOR_WEEK_GATE = 0x6699aa; // COLORS.weekGate
  // Renderer MOON_IDENTITY_COLORS, verbatim (mineral lunar tints).
  const MOON_COLORS = Object.freeze([
    0x89a7a1, 0x879fb2, 0x978da8, 0xaaa486, 0xb8a77d,
    0xae8378, 0x8ca087, 0x82a3a4, 0x918ba4, 0xad9276,
    0x859cad, 0x809b92, 0xad907e
  ]);
  const DAY_COLOR = 0x5f7186;
  const DAY_EDGE_COLOR = 0x9db8cc;

  const SPIN_SPEED = 0.05; // rad/s — a full turn in about two minutes
  const CAMERA_DISTANCE = 3.35;
  const PHI_DEFAULT = 1.12;
  const PHI_MIN = 0.6;
  const PHI_MAX = 1.45;

  // ── Pure core (exercised by tests/homepage-sphere.test.js) ────────

  // The renderer's own polar mapping, verbatim: angle degrees,
  // clockwise from top, onto the XZ plane (y = 0).
  function angleToXZ(angleDeg, radius) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: radius * Math.cos(rad), z: radius * Math.sin(rad) };
  }

  function todayISOInZone(timeZone, now = new Date()) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(now);
      const get = (type) => (parts.find((p) => p.type === type) || {}).value;
      const y = get("year");
      const m = get("month");
      const d = get("day");
      if (y && m && d) return `${y}-${m}-${d}`;
    } catch {
      /* fall through to the UTC ISO date */
    }
    return now.toISOString().slice(0, 10);
  }

  // Today's Pattern coordinate through the site's own calendar path —
  // the identical call living-entry.js makes for the entry overlay.
  function resolveToday(calendar, now = new Date(), timeZone) {
    if (!calendar || typeof calendar.fromCivilDate !== "function") return null;
    const zone =
      timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    try {
      const mapped = calendar.fromCivilDate({
        date: todayISOInZone(zone, now),
        timeZone: zone,
        boundaryMode: "midnight"
      });
      return mapped || null;
    } catch {
      return null;
    }
  }

  function coordinateText(summary) {
    if (!summary) return null;
    if (summary.insideCountedYear) {
      return `Moon ${summary.moon} · Day ${summary.day} · Pattern Day ${summary.dayOfPatternYear}`;
    }
    if (summary.isDayOutOfTime) return "Day Out of Time · the year turns";
    return null;
  }

  // Build the hero model purely from the Observatory's calendar
  // geometry: 364 day cells, 13 Moon bodies, today's marker, Year Gate.
  function buildModel(geometry, summary) {
    if (!geometry || typeof geometry.calendarCell !== "function") return null;
    const days = [];
    for (let day = 1; day <= 364; day += 1) {
      const cell = geometry.calendarCell(day);
      const radius = PATTERN_RING * cell.radialFactor;
      const { x, z } = angleToXZ(cell.angle, radius);
      days.push(Object.freeze({
        day,
        moon: cell.moon,
        moonDay: cell.moonDay,
        week: cell.week,
        angle: cell.angle,
        x, y: 0, z,
        anchor: [1, 7, 14, 21, 28].includes(cell.moonDay),
        moonEdge: cell.moonDay === 1 || cell.moonDay === 28
      }));
    }
    const moons = [];
    for (let moon = 1; moon <= 13; moon += 1) {
      const address = geometry.moonAddress(moon);
      const radius = PATTERN_RING * MOON_LANE_FACTOR;
      const { x, z } = angleToXZ(address.centerAngle, radius);
      moons.push(Object.freeze({
        moon,
        angle: address.centerAngle,
        x, y: 0, z,
        color: MOON_COLORS[moon - 1]
      }));
    }
    let today = null;
    if (summary && summary.insideCountedYear) {
      const cell = geometry.calendarCell(summary.dayOfPatternYear);
      const radius = PATTERN_RING * cell.radialFactor;
      const { x, z } = angleToXZ(cell.angle, radius);
      today = Object.freeze({
        day: summary.dayOfPatternYear,
        moon: summary.moon,
        moonDay: summary.day,
        angle: cell.angle,
        x, y: 0, z
      });
    }
    let gate = null;
    if (summary && typeof geometry.yearGate === "function") {
      const yg = geometry.yearGate(summary.patternYear);
      const seam = yg && yg.intercalary && yg.intercalary[0];
      if (seam) {
        const radius = PATTERN_RING * 1.44;
        const { x, z } = angleToXZ(seam.angle, radius);
        gate = Object.freeze({ angle: seam.angle, x, y: 0, z, leap: !!yg.leap });
      }
    }
    return Object.freeze({ days: Object.freeze(days), moons: Object.freeze(moons), today, gate });
  }

  // World rotation (about Y) that brings a calendar angle to face the
  // camera, which sits on the +Z axis. Derived from angleToXZ: a point
  // at angle θ sits at azimuth (θ − 90°); rotation Y by R moves its
  // azimuth to (θ − 90° − R); facing the camera means azimuth +90°.
  function facingRotationY(angleDeg) {
    return (angleDeg * Math.PI) / 180 - Math.PI;
  }

  const core = Object.freeze({
    angleToXZ,
    todayISOInZone,
    resolveToday,
    coordinateText,
    buildModel,
    facingRotationY,
    constants: Object.freeze({
      PATTERN_RING,
      MOON_LANE_FACTOR,
      MOON_BODY,
      TODAY_RADIUS,
      TODAY_HALO,
      TODAY_HALO_TUBE,
      MOON_COLORS
    })
  });
  globalThis.HomepageSphereCore = core;

  // ── Browser boot ──────────────────────────────────────────────────

  const root = document.querySelector("[data-homepage-sphere]");
  if (!root) return;

  const stage = root.querySelector("[data-hs-stage]");
  const fallbackArt = root.querySelector("[data-hs-fallback]");
  const coordinateEl = root.querySelector("[data-hs-coordinate]");
  const toggleBtn = root.querySelector("[data-hs-toggle]");
  const todayBtn = root.querySelector("[data-hs-today]");
  const hintEl = root.querySelector("[data-hs-hint]");
  const activateBtn = root.querySelector("[data-hs-activate]");
  const releaseBtn = root.querySelector("[data-hs-release]");
  const contextEl = root.querySelector("[data-hs-context]");
  const doorLink = root.querySelector("[data-hs-door]");

  const summary = resolveToday(globalThis.PatternCalendar);
  const text = coordinateText(summary);
  if (coordinateEl && text) coordinateEl.textContent = text;
  if (stage && summary && summary.insideCountedYear) {
    stage.setAttribute(
      "aria-label",
      `The Living Time Sphere. Today is Moon ${summary.moon}, Day ${summary.day}, ` +
        `Pattern Day ${summary.dayOfPatternYear} of 364 — shown in gold. Drag to turn it.`
    );
  }

  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function webglAvailable() {
    try {
      const probe = document.createElement("canvas");
      return !!(
        window.WebGLRenderingContext &&
        (probe.getContext("webgl2") || probe.getContext("webgl"))
      );
    } catch {
      return false;
    }
  }

  if (!stage || !summary || reduceMotion || !webglAvailable()) {
    // Static art stays. No error text, no broken canvas — the hero is
    // exactly what it was before this module existed.
    return;
  }

  // ── The Observatory stack, loaded read-only ───────────────────────
  //
  // The 3D renderer imports its own three.js from the vendored path
  // below; the homepage never loads it directly.
  const THREE_MODULE_PATH = "assets/vendor/three/three.module.min.js";
  void THREE_MODULE_PATH;

  // [script, global it defines] — the sphere page's own load order,
  // minus its page chrome (site.js, the Observatory UI, the share
  // tools) and the Life Atlas record extensions the hero does not use.
  // The astronomy, equinox and alignment groups are not decoration:
  // the sphere's model builds its year records from the alignment
  // ledger, which runs on the equinox engines. Entries whose global
  // the homepage already has are skipped.
  const SPHERE_STACK = [
    ["assets/js/calendar/pattern-calendar-version.js", "PatternCalendarVersion"],
    ["assets/js/calendar/pattern-calendar-data.js", "PatternCalendarData"],
    ["assets/js/calendar/pattern-calendar-format.js", "PatternCalendarFormat"],
    ["assets/js/calendar/pattern-calendar-boundary.js", "PatternCalendarBoundary"],
    ["assets/js/calendar/pattern-calendar.js", "PatternCalendar"],
    ["assets/js/codex-state.js", "CodexStateModule"],
    ["assets/js/astronomy/astronomy-version.js", "AstronomyVersion"],
    ["assets/js/astronomy/astronomy-sources.js", "AstronomySources"],
    ["assets/js/astronomy/timezone-tools.js", "TimeZoneTools"],
    ["assets/js/astronomy/equinox-reference-data.js", "EquinoxReferenceData"],
    ["assets/js/astronomy/lunar-at-equinox.js", "LunarAtEquinox"],
    ["assets/js/astronomy/equinox-engine.js", "EquinoxEngine"],
    ["assets/js/equinox/equinox-passage-format.js", "EquinoxPassageFormat"],
    ["assets/js/equinox/equinox-passage-engine.js", "EquinoxPassageEngine"],
    ["assets/js/equinox/equinox-passage-data.js", "EquinoxPassageData"],
    ["assets/js/alignment/alignment-version.js", "AlignmentVersion"],
    ["assets/js/alignment/alignment-ledger-engine.js", "AlignmentLedgerEngine"],
    ["assets/js/alignment/alignment-ledger-data.js", "AlignmentLedgerData"],
    ["assets/js/alignment/alignment-comparison.js", "AlignmentComparison"],
    ["assets/js/alignment/alignment-recurrence.js", "AlignmentRecurrence"],
    ["assets/js/alignment/alignment-offsets.js", "AlignmentOffsets"],
    ["assets/js/alignment/alignment-signature.js", "AlignmentSignature"],
    ["assets/js/alignment/alignment-export.js", "AlignmentExport"],
    ["assets/js/alignment/alignment-url-state.js", "AlignmentUrlState"],
    ["assets/js/sphere/living-time-sphere-version.js", "LivingTimeSphereVersion"],
    ["assets/js/sphere/living-time-sphere-model.js", "LivingTimeSphereModel"],
    ["assets/js/sphere/living-time-sphere-calendar-geometry.js", "LivingTimeSphereCalendarGeometry"],
    ["assets/js/sphere/living-time-sphere-temporal.js", "LivingTimeSphereTemporal"],
    ["assets/js/sphere/living-time-sphere-state.js", "LivingTimeSphereState"],
    ["assets/js/sphere/living-time-sphere-semantic-zoom.js", "LivingTimeSphereSemanticZoom"],
    ["assets/js/sphere/living-time-sphere-day-zoom.js", "LivingTimeSphereDayZoom"],
    ["assets/js/sphere/living-time-sphere-layout.js", "LivingTimeSphereLayout"],
    ["assets/js/sphere/living-time-sphere-connections.js", "LivingTimeSphereConnections"],
    ["assets/js/sphere/living-time-sphere-renderer-svg.js", "LivingTimeSphereRendererSvg"],
    ["assets/js/sphere/living-time-sphere-renderer-canvas.js", "LivingTimeSphereRendererCanvas"],
    ["assets/js/sphere/observatory-capability-manager.js", "ObservatoryCapabilityManager"],
    ["assets/js/sphere/living-time-sphere-materials.js", "LivingTimeSphereM"],
    ["assets/js/sphere/living-time-sphere-effects.js", "LivingTimeSphereEffects"],
    ["assets/js/sphere/living-time-sphere-camera.js", "LivingTimeSphereCamera"],
    ["assets/js/sphere/living-time-sphere-animation.js", "LivingTimeSphereAnimation"],
    ["assets/js/sphere/living-time-sphere-planetary-positions.js", "LivingTimePlanetaryPositions"],
    ["assets/js/sphere/living-time-sphere-label-manager.js", "LivingTimeSphereLabelManager"],
    ["assets/js/sphere/living-time-sphere-extension-host.js", "LivingTimeSphereExtensionHost"],
    ["assets/js/sphere/living-time-sphere-temporal-legibility.js", "LivingTimeSphereTemporalLegibility"],
    ["assets/js/sphere/living-time-sphere-temporal-strata.js", "LivingTimeSphereTemporalStrata"],
    ["assets/js/sphere/living-time-sphere-renderer-3d.js", "LivingTimeSphereRenderer3d"],
    ["assets/js/sphere/living-time-sphere-live-data.js", "LivingTimeSphereLiveData"],
    ["assets/js/sphere/living-time-sphere-interaction.js", "LivingTimeSphereInteraction"],
    ["assets/js/sphere/living-time-sphere-accessibility.js", "LivingTimeSphereAccessibility"],
    ["assets/js/sphere/living-time-sphere-export.js", "LivingTimeSphereExport"],
    ["assets/js/environment/environment-state.js", "SofEnvironmentState"],
    ["assets/js/sphere/living-time-sphere-mount.js", "LivingTimeSphere"],
    ["assets/js/sphere/living-time-sphere-today.js", "LivingTimeSphereTodayCard"],
    ["assets/js/sphere/living-time-sphere-metrics.js", "LivingTimeSphereMetrics"]
  ];

  // Just the sphere: the calendar disc, its Moons, week gates, and the
  // solar/lunar markers — none of the Observatory's panels or layers
  // that need the full instrument around them.
  const HERO_VISIBLE_LAYERS = Object.freeze({
    pattern: true,
    exactDays: true,
    weekGates: true,
    lunar: true,
    solar: true,
    markers: true,
    outsideDays: false,
    planets: false,
    passage: false,
    connections: false,
    environment: false,
    spiral: false,
    recurrence: false,
    witness: false,
    personal: false
  });

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src;
      el.async = false;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(el);
    });
  }

  async function loadSphereStack() {
    for (const [src, globalName] of SPHERE_STACK) {
      if (globalName && globalThis[globalName]) continue;
      try {
        await loadScript(src);
      } catch {
        /* One missing module must not sink the rest — the sphere
           page's own deferred tags behave the same way. The readiness
           check below and the mount's own dependency assertions
           decide whether the sphere can run. */
      }
    }
    return !!(
      globalThis.LivingTimeSphere &&
      typeof globalThis.LivingTimeSphere.mount === "function" &&
      globalThis.LivingTimeSphereModel &&
      globalThis.LivingTimeSphereLayout &&
      globalThis.LivingTimeSphereRendererSvg &&
      globalThis.LivingTimeSphereLiveData &&
      globalThis.LivingTimeSphereState &&
      globalThis.AlignmentLedgerData
    );
  }

  function visitorTimeZone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
    } catch {
      return "America/Los_Angeles";
    }
  }

  // Start loading the stack now, not when the hero is first seen:
  // the hero asks for the page's single 3D renderer from the top of
  // the page, and the instrument mount lower down loads the same
  // modules, skipping whatever is already present.
  const stackPromise = loadSphereStack();

  // ── Mounting the real Sphere ──────────────────────────────────────

  let booted = false;
  let mountHandle = null;
  let rotationOn = true;
  let mountedPatternDay = summary.dayOfPatternYear;

  // ── The opening view ──────────────────────────────────────────────
  //
  // The Observatory's settled opening is distance 2.25 at phi 0.78
  // (LivingTimeSphereCamera's "today" position). Its phone rule trims
  // the distance to 1.9 on narrow viewports, which crops the disc
  // inside the hero frame — so once this mount holds the 3D renderer,
  // the hero eases the camera to the settled framing, unless the
  // visitor has already taken the camera themselves.
  const SETTLED_DISTANCE = 2.25;
  const SETTLED_PHI = 0.78;
  let heroRenderer = null; // last renderer this mount reported
  let openingSettled = false;
  let visitorTookCamera = false;
  let fallbackRetries = 0;

  if (stage) {
    stage.addEventListener("pointerdown", () => { visitorTookCamera = true; }, { passive: true });
    stage.addEventListener("keydown", () => { visitorTookCamera = true; });
  }

  function settleOpeningView() {
    if (openingSettled || visitorTookCamera) return;
    const cam = globalThis.LivingTimeSphereCamera;
    if (!cam || typeof cam.moveTo !== "function") return;
    openingSettled = true;
    try {
      cam.moveTo({
        dist: SETTLED_DISTANCE,
        phi: SETTLED_PHI,
        animated: true,
        durationMs: 900,
        nowMs: performance.now()
      });
    } catch {
      /* the sphere keeps the mount's own framing */
    }
  }

  function onHeroRendererChange(payload) {
    if (!payload) return;
    if (payload.activeRenderer) heroRenderer = payload.activeRenderer;
    if (payload.activeRenderer === "3d") {
      // Settle a frame later, from the live camera, so the ease
      // starts wherever the mount's own opening transition reached.
      requestAnimationFrame(() => settleOpeningView());
    }
  }

  function stayFallback() {
    root.dataset.state = "fallback";
    delete root.dataset.hsMode;
    if (stage) stage.hidden = true;
    if (fallbackArt) fallbackArt.hidden = false;
    if (hintEl) hintEl.hidden = true;
    if (toggleBtn) toggleBtn.hidden = true;
    if (todayBtn) todayBtn.hidden = true;
    if (activateBtn) activateBtn.hidden = true;
    if (releaseBtn) releaseBtn.hidden = true;
    if (contextEl) contextEl.hidden = true;
  }

  function showLive() {
    root.dataset.state = "live";
    if (fallbackArt) fallbackArt.hidden = true;
    if (stage) stage.hidden = false;
    if (toggleBtn) toggleBtn.hidden = false;
    if (todayBtn) todayBtn.hidden = false;
    setSphereMode("ambient");
  }

  // ── Ambient / interactive modes (Directive 02) ──────────────
  //
  // Ambient is the environment: the Sphere turns quietly behind
  // the words and the stage takes no pointers, so reading and
  // scrolling pass over it untouched. Interactive is the visitor's
  // own act — the Explore button, or the keyboard reaching the
  // stage — and hands the stage its pointers, its hint, and the
  // selected-day context. Done, Escape, or scrolling away returns
  // the Sphere to the room.
  let sphereMode = "ambient";
  let contextTimer = null;

  function setSphereMode(mode) {
    sphereMode = mode;
    root.dataset.hsMode = mode;
    const interactive = mode === "interactive";
    if (activateBtn) activateBtn.hidden = interactive;
    if (releaseBtn) releaseBtn.hidden = !interactive;
    if (hintEl) {
      hintEl.hidden = !interactive;
      if (interactive) hintEl.textContent = "Drag to turn · arrow keys choose a day";
    }
    if (contextEl) contextEl.hidden = !interactive;
    if (interactive) {
      refreshSphereContext();
      if (!contextTimer) {
        contextTimer = window.setInterval(refreshSphereContext, 700);
      }
    } else if (contextTimer) {
      window.clearInterval(contextTimer);
      contextTimer = null;
    }
  }

  function selectedDayFromMount() {
    try {
      const s =
        mountHandle && typeof mountHandle.getState === "function"
          ? mountHandle.getState()
          : null;
      const day = s && (s.selectedDay || s.selectedDayOfYear);
      const n = Number(day);
      return Number.isFinite(n) && n >= 1 && n <= 364 ? n : null;
    } catch {
      return null;
    }
  }

  // The Observatory's own deep-link contract (its URL state
  // module): marker=day-<N> selects the day, marker=today returns
  // to today, cam_t / cam_d carry the camera. The door is re-aimed
  // from the hero mount's live selection, so the day and the view
  // the visitor found here are the day and view that open there.
  function refreshSphereContext() {
    // The mount opens facing today and reports a selectedDay once
    // the visitor chooses one; until then the day being faced is
    // today itself, which is also what the caption already states.
    const day =
      selectedDayFromMount() ||
      (summary && summary.insideCountedYear ? summary.dayOfPatternYear : null);
    if (contextEl && day) {
      const geometry = globalThis.LivingTimeSphereCalendarGeometry;
      const cell =
        geometry && typeof geometry.calendarCell === "function"
          ? geometry.calendarCell(day)
          : null;
      if (cell) {
        const isToday =
          summary && summary.insideCountedYear && day === summary.dayOfPatternYear;
        contextEl.textContent =
          `You are looking at Moon ${cell.moon} · Day ${cell.moonDay} · ` +
          `Pattern Day ${day}${isToday ? " — today" : ""}`;
      }
    }
    if (doorLink) {
      if (!day) {
        doorLink.href = "./living-time-sphere.html";
      } else {
        const params = new URLSearchParams();
        const isToday =
          summary && summary.insideCountedYear && day === summary.dayOfPatternYear;
        params.set("marker", isToday ? "today" : `day-${day}`);
        try {
          const cam = globalThis.LivingTimeSphereCamera;
          const cs = cam && typeof cam.getState === "function" ? cam.getState() : null;
          if (cs && Number.isFinite(Number(cs.theta))) {
            params.set("cam_t", Number(cs.theta).toFixed(4));
          }
          if (cs && Number.isFinite(Number(cs.dist))) {
            params.set("cam_d", Number(cs.dist).toFixed(4));
          }
        } catch {
          /* the day alone still carries */
        }
        doorLink.href = `./living-time-sphere.html?${params.toString()}`;
      }
    }
  }

  async function boot() {
    if (booted) return;
    booted = true;
    try {
      const ready = await stackPromise;
      if (!ready) {
        stayFallback();
        return;
      }
      // The stage must have its size before the mount measures it, so
      // the live state is shown first; the mount draws its own SVG
      // baseline into the stage immediately, then brings up the 3D
      // renderer — the same sequence the Observatory page runs.
      showLive();
      mountHandle = globalThis.LivingTimeSphere.mount({
        container: stage,
        runtimeProfile: "instrument",
        mode: "today",
        state: {
          // The sphere's today must be the caption's today: the
          // visitor's own timezone at the midnight boundary. (The
          // stack's defaults are America/Los_Angeles and sunset.)
          timeZone: visitorTimeZone(),
          boundaryMode: "midnight",
          motionMode: "drift",
          moonLabelMode: "essential",
          dayLabelMode: "key",
          connectionMode: "selected"
        },
        visibleLayers: { ...HERO_VISIBLE_LAYERS },
        onRendererChange: onHeroRendererChange
      });
      if (!mountHandle) stayFallback();
    } catch {
      stayFallback();
    }
  }

  // ── The small control set ─────────────────────────────────────────

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      if (!mountHandle) return;
      rotationOn = !rotationOn;
      try {
        mountHandle.refresh({ motionMode: rotationOn ? "drift" : "still" });
      } catch {
        /* the sphere keeps its last state */
      }
      toggleBtn.setAttribute("aria-pressed", String(!rotationOn));
      toggleBtn.textContent = rotationOn ? "Pause rotation" : "Resume rotation";
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener("click", () => {
      const now = resolveToday(globalThis.PatternCalendar);
      const day = now && now.insideCountedYear ? now.dayOfPatternYear : null;
      const renderer = globalThis.LivingTimeSphereRenderer3d;
      if (!day || !renderer || typeof renderer.focusPatternDay !== "function") return;
      // The Observatory's own Today control calls focusPatternDay the
      // same way — twice, so the swing lands even mid-settle.
      renderer.focusPatternDay(day, { distance: 2.25, animated: true });
      window.setTimeout(() => {
        if (mountHandle) {
          renderer.focusPatternDay(day, { distance: 2.25, animated: true });
        }
      }, 700);
    });
  }

  // ── Taking and returning the instrument ─────────────────────

  if (activateBtn) {
    activateBtn.addEventListener("click", () => {
      setSphereMode("interactive");
      if (stage) {
        try {
          stage.focus({ preventScroll: true });
        } catch {
          stage.focus();
        }
      }
    });
  }

  if (releaseBtn) {
    releaseBtn.addEventListener("click", () => {
      setSphereMode("ambient");
      if (activateBtn) activateBtn.focus();
    });
  }

  if (stage) {
    // The keyboard reaching the stage is an intentional act too.
    stage.addEventListener("focusin", () => {
      if (root.dataset.state === "live" && sphereMode !== "interactive") {
        setSphereMode("interactive");
      }
    });
    stage.addEventListener("pointerup", refreshSphereContext);
    stage.addEventListener("keyup", refreshSphereContext);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sphereMode === "interactive") {
      setSphereMode("ambient");
      if (activateBtn) activateBtn.focus();
    }
  });

  if (doorLink) {
    // Re-aim the door at the moment it is used, so the freshest
    // selection is the one that travels.
    doorLink.addEventListener("click", refreshSphereContext);
    doorLink.addEventListener("focus", refreshSphereContext);
  }

  // Scrolling away hands the Sphere back to the room: no visitor
  // returns to a hero that still holds their scroll.
  if (typeof IntersectionObserver === "function") {
    const modeIo = new IntersectionObserver(
      (entries) => {
        if (
          sphereMode === "interactive" &&
          entries.some((entry) => !entry.isIntersecting)
        ) {
          setSphereMode("ambient");
        }
      },
      { threshold: 0 }
    );
    modeIo.observe(root);
  }

  // If the tab sits open across midnight, the caption and the sphere
  // move to the new day together when the visitor comes back to it.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden || !mountHandle) return;
    const now = resolveToday(globalThis.PatternCalendar);
    if (!now || now.dayOfPatternYear === mountedPatternDay) return;
    mountedPatternDay = now.dayOfPatternYear;
    const nextText = coordinateText(now);
    if (coordinateEl && nextText) coordinateEl.textContent = nextText;
    try {
      mountHandle.refresh({});
    } catch {
      /* keep the last frame */
    }
  });

  // The 3D renderer is a singleton behind the mount; release it when
  // the page goes away so nothing outlives the hero.
  window.addEventListener("pagehide", () => {
    if (mountHandle) {
      try {
        mountHandle.teardown();
      } catch {
        /* nothing to release */
      }
      mountHandle = null;
    }
  });

  if (typeof IntersectionObserver === "function") {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          io.disconnect();
          void boot();
        }
      },
      { rootMargin: "240px" }
    );
    io.observe(root);

    // If the first 3D attempt fell back to the flat SVG face — the
    // page's single 3D renderer was busy with the instrument mount,
    // or the init timed out on a slow phone — retry the upgrade each
    // time the hero comes back into view, a few times at most. The
    // mount guards repeat attempts itself; this only re-asks.
    const retryIo = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        if (heroRenderer === "3d") {
          retryIo.disconnect();
          return;
        }
        if (!mountHandle) return;
        if (fallbackRetries >= 6) {
          retryIo.disconnect();
          return;
        }
        fallbackRetries += 1;
        try {
          mountHandle.activate();
        } catch {
          /* the mount keeps its SVG face */
        }
      },
      { rootMargin: "240px" }
    );
    retryIo.observe(root);
  } else {
    void boot();
  }
})();
