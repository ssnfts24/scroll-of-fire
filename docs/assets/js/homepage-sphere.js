(() => {
  "use strict";

  /*
   * Homepage Live Sphere — the actual Living Time Sphere in the homepage
   * hero. Just the sphere: no observatory panels, no readouts, no label
   * flood. Calm rotation, drag to turn, pause/play, a Today swing, and a
   * door into the full Observatory.
   *
   * Data honesty: this module contains NO calendar math of its own.
   * Today's coordinate comes from PatternCalendar.fromCivilDate — the
   * same call the entry overlay makes (visitor timezone, midnight
   * boundary). Every day and Moon position comes from the Observatory's
   * own LivingTimeSphereCalendarGeometry (calendarCell / moonAddress /
   * yearGate), loaded read-only. The rendering below is new, lightweight
   * code written for the hero; the geometry, sizes and colours it draws
   * are the Observatory's own (LivingTimeSphereM SIZES/COLORS and the
   * renderer's moon identity lane, mirrored as constants here because
   * the materials module is part of the protected sphere stack and is
   * not loaded on the homepage).
   *
   * R1.7: no protected file is edited by this feature. The calendar
   * geometry module is loaded, never modified.
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
  const geometry = globalThis.LivingTimeSphereCalendarGeometry;
  const model = buildModel(geometry, summary);

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

  if (!stage || !model || reduceMotion || !webglAvailable()) {
    // Static art stays. No error text, no broken canvas — the hero is
    // exactly what it was before this module existed.
    return;
  }

  const threeUrl = new URL(
    "assets/vendor/three/three.module.min.js",
    document.baseURI
  ).href;

  import(threeUrl)
    .then((THREE) => {
      try {
        init(THREE);
      } catch {
        stayFallback();
      }
    })
    .catch(stayFallback);

  function stayFallback() {
    root.dataset.state = "fallback";
    if (stage) stage.hidden = true;
    if (fallbackArt) fallbackArt.hidden = false;
  }

  function init(THREE) {
    const canvas = document.createElement("canvas");
    canvas.className = "homepage-sphere-canvas";
    canvas.setAttribute("aria-hidden", "true");
    stage.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "low-power"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);

    const world = new THREE.Group();
    scene.add(world);

    // The stone globe — quiet, teal-rimmed, lit warm from above.
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(0.86, 48, 32),
      new THREE.ShaderMaterial({
        uniforms: {
          cStone: { value: new THREE.Color(0x131c28) },
          cStoneLight: { value: new THREE.Color(0x2b3f52) },
          cRim: { value: new THREE.Color(0x64c8b4) },
          cWarm: { value: new THREE.Color(0xf3c97a) }
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vNormal = normalize(normalMatrix * normal);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform vec3 cStone;
          uniform vec3 cStoneLight;
          uniform vec3 cRim;
          uniform vec3 cWarm;
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            vec3 n = normalize(vNormal);
            float ndv = abs(dot(n, vView));
            float fres = pow(1.0 - ndv, 2.8);
            vec3 lightDir = normalize(vec3(0.45, 0.75, 0.6));
            float diffuse = max(dot(n, lightDir), 0.0);
            vec3 col = mix(cStone, cStoneLight, diffuse * 0.85);
            col += cWarm * pow(max(dot(n, normalize(vec3(-0.3, 0.9, 0.35))), 0.0), 3.0) * 0.10;
            col += cRim * fres * 0.55;
            gl_FragColor = vec4(col, 1.0);
          }`
      })
    );
    world.add(globe);

    // A breath of atmosphere just outside the stone.
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 48, 32),
      new THREE.ShaderMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { cRim: { value: new THREE.Color(0x3d8f83) } },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vNormal = normalize(normalMatrix * normal);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform vec3 cRim;
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 3.5);
            gl_FragColor = vec4(cRim, rim * 0.35);
          }`
      })
    );
    world.add(atmosphere);

    // Calendar band rings — the inner and outer edges of the readable
    // calendar face, at the Observatory's own radial factors.
    function ringLine(radius, color, opacity) {
      const pts = [];
      for (let i = 0; i <= 128; i += 1) {
        const a = (i / 128) * Math.PI * 2;
        pts.push(new THREE.Vector3(radius * Math.cos(a), 0, radius * Math.sin(a)));
      }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
      );
      return line;
    }
    world.add(ringLine(PATTERN_RING * 1.298, COLOR_RING, 0.55));
    world.add(ringLine(PATTERN_RING * 1.44, COLOR_RING, 0.35));
    world.add(ringLine(PATTERN_RING * MOON_LANE_FACTOR, 0x2a3050, 0.6));

    // The 364 days — one point field, from calendarCell positions.
    const todayDay = model.today ? model.today.day : -1;
    const dayPositions = [];
    const dayColors = [];
    const anchorPositions = [];
    const cDay = new THREE.Color(DAY_COLOR);
    const cEdge = new THREE.Color(DAY_EDGE_COLOR);
    const cGate = new THREE.Color(COLOR_WEEK_GATE);
    for (const d of model.days) {
      if (d.day === todayDay) continue; // today is drawn as the gold marker
      if (d.anchor) {
        anchorPositions.push(d.x, d.y, d.z);
      } else {
        dayPositions.push(d.x, d.y, d.z);
        const c = d.moonEdge ? cEdge : cDay;
        dayColors.push(c.r, c.g, c.b);
      }
    }
    const dayGeo = new THREE.BufferGeometry();
    dayGeo.setAttribute("position", new THREE.Float32BufferAttribute(dayPositions, 3));
    dayGeo.setAttribute("color", new THREE.Float32BufferAttribute(dayColors, 3));
    world.add(new THREE.Points(dayGeo, new THREE.PointsMaterial({
      size: 0.02, vertexColors: true, sizeAttenuation: true,
      transparent: true, opacity: 0.9, depthWrite: false
    })));
    const anchorGeo = new THREE.BufferGeometry();
    anchorGeo.setAttribute("position", new THREE.Float32BufferAttribute(anchorPositions, 3));
    world.add(new THREE.Points(anchorGeo, new THREE.PointsMaterial({
      color: COLOR_WEEK_GATE, size: 0.034, sizeAttenuation: true,
      transparent: true, opacity: 0.95, depthWrite: false
    })));

    // The 13 Moons — mineral bodies on their identity lane.
    const moonGeo = new THREE.SphereGeometry(MOON_BODY, 20, 14);
    for (const m of model.moons) {
      const isTodayMoon = model.today && m.moon === model.today.moon;
      const mesh = new THREE.Mesh(moonGeo, new THREE.MeshStandardMaterial({
        color: m.color,
        roughness: 0.85,
        metalness: 0.05,
        emissive: isTodayMoon ? 0x4a3010 : 0x000000,
        emissiveIntensity: isTodayMoon ? 0.9 : 0
      }));
      mesh.position.set(m.x, m.y, m.z);
      world.add(mesh);
    }
    scene.add(new THREE.AmbientLight(0x8fa3b8, 0.85));
    const keyLight = new THREE.DirectionalLight(0xffe2b0, 1.6);
    keyLight.position.set(2.5, 3.5, 2.0);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x64c8b4, 0.5);
    fillLight.position.set(-3, -1, -2);
    scene.add(fillLight);

    // Today — gold body, one slim halo, a soft glow. The Observatory's
    // own marker sizes, so the pair can never read as a ringed planet.
    let glow = null;
    if (model.today) {
      const t = model.today;
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(TODAY_RADIUS, 18, 14),
        new THREE.MeshBasicMaterial({ color: COLOR_TODAY })
      );
      body.position.set(t.x, t.y, t.z);
      world.add(body);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(TODAY_HALO, TODAY_HALO_TUBE, 10, 40),
        new THREE.MeshBasicMaterial({ color: COLOR_TODAY })
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.copy(body.position);
      world.add(halo);
      glow = new THREE.Mesh(
        new THREE.SphereGeometry(TODAY_RADIUS * 1.8, 18, 14),
        new THREE.MeshBasicMaterial({
          color: 0xffe060, transparent: true, opacity: 0.13,
          blending: THREE.AdditiveBlending, depthWrite: false
        })
      );
      glow.position.copy(body.position);
      world.add(glow);
    }

    // The Year Gate seam — a small green diamond where the year turns.
    if (model.gate) {
      const gateMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.03),
        new THREE.MeshBasicMaterial({ color: COLOR_YEAR_GATE })
      );
      gateMesh.position.set(model.gate.x, model.gate.y, model.gate.z);
      world.add(gateMesh);
    }

    // A quiet star field, standing still behind the turning sphere.
    const starPositions = [];
    let seed = 1234567;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 420; i += 1) {
      const u = rand() * 2 - 1;
      const a = rand() * Math.PI * 2;
      const r = 5.0 * Math.sqrt(1 - u * u);
      starPositions.push(r * Math.cos(a), 5.0 * u, r * Math.sin(a));
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.035, sizeAttenuation: true,
      transparent: true, opacity: 0.5, depthWrite: false
    })));

    // ── State, controls, motion ─────────────────────────────────────
    let spinning = true;
    let dragging = false;
    let swing = null;
    let phi = PHI_DEFAULT;
    let phiTarget = PHI_DEFAULT;
    const startOffset = model.today ? -0.32 : 0;
    let rotY = model.today ? facingRotationY(model.today.angle) + startOffset : 0;
    let rotYTarget = rotY;

    function swingToToday() {
      if (!model.today) return;
      const dest = facingRotationY(model.today.angle);
      const turns = Math.round((rotY - dest) / (Math.PI * 2));
      swing = { from: rotY, to: dest + turns * Math.PI * 2, t: 0 };
    }

    if (toggleBtn) {
      toggleBtn.hidden = false;
      toggleBtn.addEventListener("click", () => {
        spinning = !spinning;
        toggleBtn.textContent = spinning ? "Pause rotation" : "Play rotation";
        toggleBtn.setAttribute("aria-pressed", spinning ? "false" : "true");
      });
    }
    if (todayBtn) {
      todayBtn.hidden = !model.today;
      todayBtn.addEventListener("click", swingToToday);
    }
    if (hintEl) hintEl.hidden = false;

    let lastX = 0;
    let lastY = 0;
    canvas.style.touchAction = "pan-y";
    canvas.addEventListener("pointerdown", (event) => {
      dragging = true;
      swing = null;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      rotYTarget += dx * 0.0055;
      phiTarget = Math.max(PHI_MIN, Math.min(PHI_MAX, phiTarget + dy * 0.0035));
    });
    const endDrag = () => { dragging = false; };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);

    stage.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") { rotYTarget -= 0.3; swing = null; event.preventDefault(); }
      else if (event.key === "ArrowRight") { rotYTarget += 0.3; swing = null; event.preventDefault(); }
      else if (event.key === "ArrowUp") { phiTarget = Math.max(PHI_MIN, phiTarget - 0.08); event.preventDefault(); }
      else if (event.key === "ArrowDown") { phiTarget = Math.min(PHI_MAX, phiTarget + 0.08); event.preventDefault(); }
    });

    // Go live: swap the static art for the sphere.
    root.dataset.state = "live";
    stage.hidden = false;
    if (fallbackArt) fallbackArt.hidden = true;

    let visible = true;
    let tabVisible = !document.hidden;
    if (typeof IntersectionObserver === "function") {
      new IntersectionObserver((entries) => {
        visible = entries.some((e) => e.isIntersecting);
      }, { threshold: 0.05 }).observe(stage);
    }
    document.addEventListener("visibilitychange", () => {
      tabVisible = !document.hidden;
    });

    function resize() {
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(resize).observe(stage);
    }
    window.addEventListener("resize", resize);
    resize();

    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    let last = performance.now();
    function frame(now) {
      requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible || !tabVisible) return;
      if (swing) {
        swing.t += dt / 1.25;
        const k = easeInOut(Math.min(1, swing.t));
        rotY = swing.from + (swing.to - swing.from) * k;
        rotYTarget = rotY;
        if (swing.t >= 1) swing = null;
      } else {
        if (spinning && !dragging) rotYTarget += dt * SPIN_SPEED;
        let delta = (rotYTarget - rotY) % (Math.PI * 2);
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;
        rotY += delta * Math.min(1, dt * 8);
      }
      phi += (phiTarget - phi) * Math.min(1, dt * 8);
      world.rotation.y = rotY;
      if (glow) {
        const pulse = 1 + Math.sin(now / 1400) * 0.07;
        glow.scale.setScalar(pulse);
      }
      camera.position.set(
        0,
        CAMERA_DISTANCE * Math.cos(phi),
        CAMERA_DISTANCE * Math.sin(phi)
      );
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }
})();
