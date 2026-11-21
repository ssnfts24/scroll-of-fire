"use strict";

/*
 * The World Gate — the Traveller's Map become the world's map
 * in fact (Codex World design, Nov 20, 2026, Phase 1).
 *
 * map.html has always drawn the site as lands on one road.
 * The Gate makes the drawing true: a raised relief of the
 * thirteen lands on the Atlas Room's long table, under today's
 * sky, drawn from the site catalog (world-lands.js, generated
 * by scripts/build-world-lands.mjs) so the map can never drift
 * from the site. Tap a land on the relief and you travel to
 * its page. The Sphere is not a land: it turns above the
 * table as the sky's sign, and looking up is one tap to it.
 *
 * The Gate is three layers, like every land (design §2):
 *   - the Place: the relief, stood by the shared World Engine
 *     (world-engine.js) — lazy, laddered, pausing off-screen.
 *   - the Porch: plain words that render first and never wait
 *     on 3D — every land named with its character and its one
 *     clear next step, as ordinary links.
 *   - the Reading Room: the map page's own content below —
 *     the lands by their cartoon scenes, the road in walking
 *     order, the road that goes on — preserved whole.
 *
 * And the flat twin (§4.2): the same lands, the same words,
 * the same order, the same next steps, with no scene at all —
 * served automatically when WebGL is absent, when reduced
 * motion is set, when the connection asks to save data, or
 * when a keeper flips the plain-site switch (which sticks, on
 * their device). The Porch list and the flat list are rendered
 * from one projection of one model, so the twin cannot drift
 * from the face. Nothing at the Gate is gated: every land's
 * door stands open from the first visit.
 *
 * First walk (§3.4): a first-time keeper is led — Gate →
 * Clearing → today's land, the calendar choosing — by a
 * guidance line on the Porch. A returning keeper (their trail
 * or their Spark's record says they have walked before) is
 * not led again; the line stands down. Today's land follows
 * the world's own count: Moon N opens land N in the design's
 * table order, and the still days — the Day Out of Time, the
 * Deep Time Day — open the Gate itself.
 *
 * The pure half carries no DOM dependency and is unit-tested
 * in tests/world-gate.test.js. The Gate writes nothing but
 * the keeper's own guidance dismissal, on their own device.
 */
(function (root, factory) {
  const Engine = typeof module === "object" && module.exports
    ? require("./world-engine.js")
    : root.CodexWorldEngine;
  const LandsData = typeof module === "object" && module.exports
    ? require("./world-lands.js")
    : root.CodexWorldLands;
  const api = factory(Engine, LandsData);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.CodexWorldGate = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Engine, LandsData) {

  const VERSION = "world-gate/1.0.0";
  const GUIDE_KEY = "sof.world-gate.v1";

  /* Today's land, by the world's own count: Moon N opens
   * land N in the design's table order. The still days stand
   * at the Gate — the year's hinge is the gate's own day. */
  function todaysLandFor(today, lands) {
    const list = Array.isArray(lands) ? lands : [];
    const gate = list.find(l => l.id === "gate") || list[0] || null;
    if (!today || today.isDayOutOfTime || today.isDeepTimeDay) return gate;
    const m = Number(today.moon);
    if (Number.isFinite(m) && m >= 1 && m <= list.length) return list[m - 1];
    return gate;
  }

  function buildModel(input = {}) {
    const data = input.data || LandsData || { lands: [] };
    const lands = Array.isArray(data.lands) ? data.lands : [];
    const today = input.today || null;
    const sky = Engine
      ? Engine.skyFor({ today, hour: input.hour })
      : { phase: "day", season: "winter", phaseName: "Daytime", seasonName: "Winter", todayLine: "Today, in Living Time", line: "Today, in Living Time" };
    const todaysLand = todaysLandFor(today, lands);
    const returning = Boolean(input.returning);
    const guideDismissed = Boolean(input.guideDismissed);
    return {
      version: VERSION,
      sky,
      today,
      lands,
      todaysLand,
      guidance: {
        show: !returning && !guideDismissed && Boolean(todaysLand),
        todaysLandId: todaysLand ? todaysLand.id : null,
        line: todaysLand
          ? `Your first walk: begin here at the Gate, meet your Spark in the Clearing, then follow today to ${todaysLand.name}.`
          : ""
      }
    };
  }

  /* One projection of the model, three faces: the Porch list,
   * the flat twin's list, and the relief's spoken lines are all
   * rendered from these rows, so the faces cannot drift. */
  function landEntries(model) {
    const lands = model && Array.isArray(model.lands) ? model.lands : [];
    return lands.map(land => ({
      id: land.id,
      name: land.name,
      character: land.character,
      door: land.door,
      doorLabel: land.doorLabel,
      nextLabel: land.nextStep ? land.nextStep.label : "",
      nextHref: land.nextStep ? land.nextStep.href : land.door,
      say: `${land.name}. ${land.character}`,
      color: land.color || "#9a8a72",
      isToday: Boolean(model.todaysLand && model.todaysLand.id === land.id)
    }));
  }

  return {
    VERSION,
    GUIDE_KEY,
    todaysLandFor,
    buildModel,
    landEntries,
    /* The three faces, named for what they are — one source. */
    porchEntries: landEntries,
    flatEntries: landEntries,
    sceneEntries: landEntries
  };
});

/* ============================ browser half ============================ */
(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const Gate = window.CodexWorldGate;
  const Engine = window.CodexWorldEngine;
  const LandsData = window.CodexWorldLands;
  if (!Gate || !LandsData) return;

  const $ = (sel, host) => (host || document).querySelector(sel);

  function isReturning() {
    try {
      if (window.LivingTrail) {
        const trail = window.LivingTrail.load();
        if (trail && trail.finds && Object.keys(trail.finds).length > 0) return true;
      }
    } catch { /* an unreadable trail is not proof of a first walk — fall through to the Spark */ }
    try {
      const key = window.SparkCompanion && window.SparkCompanion.STORAGE_KEY;
      if (key && window.localStorage.getItem(key)) return true;
    } catch { /* silence is honest */ }
    return false;
  }

  function guideDismissed() {
    try {
      const raw = window.localStorage.getItem(Gate.GUIDE_KEY);
      return Boolean(raw && JSON.parse(raw).guideDismissed);
    } catch {
      return false;
    }
  }

  function dismissGuide() {
    try {
      window.localStorage.setItem(Gate.GUIDE_KEY, JSON.stringify({ guideDismissed: true }));
    } catch { /* a dismissal that cannot be kept is simply not kept */ }
  }

  function renderLandsList(host, model) {
    if (!host) return;
    host.replaceChildren();
    for (const entry of Gate.landEntries(model)) {
      const li = document.createElement("li");
      li.className = "world-gate-land" + (entry.isToday ? " is-today" : "");
      const h = document.createElement("h4");
      const door = document.createElement("a");
      door.href = entry.door;
      door.textContent = entry.name;
      h.appendChild(door);
      if (entry.isToday) {
        const mark = document.createElement("span");
        mark.className = "world-gate-today-mark";
        mark.textContent = " — today's land";
        h.appendChild(mark);
      }
      const character = document.createElement("p");
      character.textContent = entry.character;
      const step = document.createElement("p");
      step.className = "world-gate-next";
      step.append("Next step: ");
      const stepLink = document.createElement("a");
      stepLink.href = entry.nextHref;
      stepLink.textContent = entry.nextLabel;
      step.appendChild(stepLink);
      li.append(h, character, step);
      host.appendChild(li);
    }
  }

  function renderGuidance(host, model) {
    if (!host) return;
    if (!model.guidance.show) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    host.replaceChildren();
    const text = document.createElement("span");
    text.textContent = model.guidance.line + " ";
    const begin = document.createElement("a");
    begin.href = "companions.html";
    begin.textContent = "Begin in the Clearing";
    const today = document.createElement("a");
    today.href = model.todaysLand.door;
    today.textContent = `Go to ${model.todaysLand.name}`;
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "world-gate-dismiss";
    dismiss.textContent = "I know the road";
    dismiss.addEventListener("click", () => {
      dismissGuide();
      host.hidden = true;
    });
    host.append(text, begin, document.createTextNode(" · "), today, document.createTextNode(" "), dismiss);
  }

  /* ------------------------------ the relief ------------------------------ */

  function buildRelief(THREE, ctx, model, travel) {
    const { scene, camera } = ctx;
    const phase = Engine.PHASE_LIGHT[model.sky.phase] || Engine.PHASE_LIGHT.day;
    scene.background = new THREE.Color(phase.bg);
    scene.add(new THREE.HemisphereLight(phase.hemiSky, phase.hemiGround, phase.hemi));
    const dir = new THREE.DirectionalLight(phase.dir, phase.dirI);
    dir.position.set(6, 12, 4);
    scene.add(dir);

    const lam = (color, opts) => Engine.lambert(THREE, color, opts);
    const pickables = [];
    function pickable(obj, data) {
      obj.userData.gate = data;
      pickables.push(obj);
    }

    /* The Atlas Room's long table, and the relief upon it. */
    const table = new THREE.Mesh(new THREE.CylinderGeometry(15.6, 16.4, 1.1, 40), lam(0x6b4a2f));
    table.position.y = -0.58;
    scene.add(table);
    const relief = new THREE.Mesh(
      new THREE.CircleGeometry(14.6, 40),
      lam(Engine.SEASON_GROUND[model.sky.season] || 0x7d6c38)
    );
    relief.rotation.x = -Math.PI / 2;
    relief.position.y = 0.0;
    scene.add(relief);

    /* The sky's sign at the centre: a small turning sphere
     * with its ring — a sign of the Sphere, never the
     * instrument itself. Tapping it looks up. */
    const skySign = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(1.05, 20, 14),
      new THREE.MeshBasicMaterial({ color: phase.body })
    );
    skySign.add(body);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.65, 0.045, 8, 40),
      new THREE.MeshBasicMaterial({ color: phase.body })
    );
    ring.rotation.x = Math.PI / 2.6;
    skySign.add(ring);
    const glow = Engine.glowSprite(THREE, "#ffe9a8", 5.2, 0.4);
    skySign.add(glow);
    skySign.position.set(0, 2.6, 0);
    pickable(skySign, {
      say: "The Sphere — the sky over the whole world. It is not a land; you look up to it.",
      door: "living-time-sphere.html",
      label: "Look up — the Sphere"
    });
    scene.add(skySign);

    /* Stars, where the phase carries them. */
    if (phase.stars > 0) {
      const starGeo = new THREE.BufferGeometry();
      const pts = [];
      for (let i = 0; i < 90; i++) {
        const a = Engine.hash01(`gate-star-a-${i}`) * Math.PI * 2;
        const e = 0.3 + Engine.hash01(`gate-star-e-${i}`) * 1.1;
        const r = 46;
        pts.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
      }
      starGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
        color: 0xdfe8ff, size: 0.55, transparent: true, opacity: phase.stars
      }));
      scene.add(stars);
    }

    /* The thirteen lands around the Wheel's ring — each a
     * raised place in its own colour, today's land lit by a
     * beam of its own light. Nothing stands here that the
     * catalog does not name: the lands are the catalog's. */
    const entries = Gate.sceneEntries(model);
    const beams = [];
    entries.forEach((entry, i) => {
      const angle = -Math.PI / 2 + (i / entries.length) * Math.PI * 2;
      const radius = 10.6;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const group = new THREE.Group();
      const colour = new THREE.Color(entry.color);
      const h = 0.55 + Engine.hash01(`gate-h-${entry.id}`) * 0.55;
      const mound = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.85, h, 7), lam(colour.getHex()));
      mound.position.y = h / 2;
      group.add(mound);
      const lighter = colour.clone().offsetHSL(0, 0, 0.13).getHex();
      let marker;
      switch (i % 4) {
        case 0: marker = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 6), lam(lighter)); marker.position.y = h + 0.5; break;
        case 1: marker = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.95, 0.62), lam(lighter)); marker.position.y = h + 0.48; break;
        case 2: marker = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), lam(lighter)); marker.position.y = h + 0.42; break;
        default: marker = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.15, 6), lam(lighter)); marker.position.y = h + 0.58; break;
      }
      group.add(marker);
      if (entry.isToday) {
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.085, 0.085, 8, 6),
          new THREE.MeshBasicMaterial({ color: colour.getHex(), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        beam.position.y = h + 4;
        group.add(beam);
        beams.push(beam);
        const halo = Engine.glowSprite(THREE, "#ffffff", 3.4, 0.35);
        halo.position.y = h + 0.6;
        group.add(halo);
      }
      group.position.set(x, 0, z);
      pickable(group, { say: entry.say, door: entry.door, label: `Travel to ${entry.name}` });
      scene.add(group);
    });

    /* Motes over the table — pollen by day, fireflies by night. */
    const motes = Engine.motes(THREE, {
      count: 36,
      spread: 24,
      height: 3.2,
      color: model.sky.phase === "day" || model.sky.phase === "dawn" ? 0xfff6d8 : 0xffca7a
    });
    motes.points.position.y = 0.4;
    scene.add(motes.points);

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const controls = Engine.orbit(THREE, ctx.renderer.domElement, camera, {
      target: [0, 0.7, 0],
      radius: 22.5,
      azimuth: 0.55,
      polar: 0.98,
      minRadius: 12,
      maxRadius: 27,
      onMove: ctx.reducedMotion ? ctx.requestRender : null,
      onTap: at => {
        const rect = ctx.renderer.domElement.getBoundingClientRect();
        ndc.set(((at.x - rect.left) / rect.width) * 2 - 1, -((at.y - rect.top) / rect.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        const hits = ray.intersectObjects(pickables, true);
        for (const hit of hits) {
          let node = hit.object;
          while (node && !node.userData.gate) node = node.parent;
          if (node) {
            travel(node.userData.gate);
            break;
          }
        }
      }
    });

    return {
      tick(dt, t) {
        skySign.rotation.y = t * 0.12;
        ring.rotation.z = t * 0.05;
        for (const beam of beams) {
          beam.material.opacity = 0.32 + Math.sin(t * 1.6) * 0.1;
        }
        motes.update(t);
        controls.idleSpin(dt);
      }
    };
  }

  /* ------------------------------- the faces ------------------------------- */

  function init() {
    const section = document.getElementById("world-gate");
    if (!section) return;
    const stageEl = $("#world-gate-stage", section);
    const stageNote = $("#world-gate-stage-note", section);
    const readout = $("#world-gate-readout", section);
    const travelLink = $("#world-gate-travel", section);
    const flatBlock = $("#world-gate-flat", section);
    const faceNote = $("#world-gate-face-note", section);
    const toggle = $("#world-gate-plain-toggle", section);

    const today = Engine ? Engine.todayCoordinate() : null;
    const now = new Date();
    const model = Gate.buildModel({
      today,
      hour: now.getHours() + now.getMinutes() / 60,
      returning: isReturning(),
      guideDismissed: guideDismissed()
    });

    /* Words first: the Porch and the flat twin render before
     * any 3D is even attempted. */
    renderLandsList($("#world-gate-lands", section), model);
    renderLandsList($("#world-gate-flat-lands", section), model);
    renderGuidance($("#world-gate-guidance", section), model);
    const skyLine = $("#world-gate-sky-line", section);
    if (skyLine) skyLine.textContent = model.sky.line + ".";
    if (stageNote) {
      stageNote.textContent = model.todaysLand
        ? `The Gate rests in its still face here. ${model.sky.line}. Today's land is ${model.todaysLand.name} — every land is listed whole below, in plain words.`
        : "The Gate rests in its still face here. Every land is listed whole below, in plain words.";
    }

    const say = text => { if (readout && text) readout.textContent = text; };
    say(`${model.sky.line}. The relief is waking — drag to look around it, tap a land to travel.`);
    function travel(gateData) {
      say(gateData.say);
      if (travelLink) {
        travelLink.href = gateData.door;
        travelLink.textContent = gateData.label;
      }
      window.location.href = gateData.door;
    }

    let sceneHandle = null;
    let sceneBooting = false;
    let sceneWanted = false;
    let nearFired = false;

    async function startScene() {
      if (sceneHandle || sceneBooting || !stageEl) return;
      sceneBooting = true;
      try {
        sceneHandle = await Engine.mountScene({
          stageEl,
          build: (THREE, ctx) => buildRelief(THREE, ctx, model, travel)
        });
        section.classList.add("is-live");
      } catch {
        sceneHandle = null;
        applyFace(true); /* the engine would not stand: the flat face carries the Gate */
      } finally {
        sceneBooting = false;
      }
    }

    const FLAT_LINES = {
      plain: "You are reading the plain Gate — your own switch, kept on this device. The lands are the same; only the scene rests.",
      "no-webgl": "This device could not stand the 3D Gate, so the Gate rests in its flat face — the same lands, the same words, the same next steps.",
      "reduced-motion": "Your device asks for reduced motion, so the Gate rests in its flat face — the same lands, the same words, the same next steps.",
      "save-data": "Your connection asks to save data, so the Gate rests in its flat face — the same lands, the same words, the same next steps."
    };

    function applyFace(forceFlat = false) {
      const decision = Engine.currentFlatDecision();
      const flat = forceFlat || decision.flat;
      if (toggle) {
        toggle.textContent = Engine.plainPreferred() ? "Walk the 3D Gate instead" : "Read the plain Gate instead";
      }
      if (flat) {
        sceneWanted = false;
        if (sceneHandle) {
          sceneHandle.dispose();
          sceneHandle = null;
        }
        section.classList.remove("is-live");
        section.classList.add("is-flat");
        if (stageEl) stageEl.hidden = true;
        if (stageNote) stageNote.hidden = false;
        if (flatBlock) flatBlock.hidden = false;
        if (faceNote) faceNote.textContent = FLAT_LINES[decision.reason] || FLAT_LINES["no-webgl"];
        say("The Gate in plain words — every land below, each with its next step.");
        return;
      }
      section.classList.remove("is-flat");
      if (stageEl) stageEl.hidden = false;
      if (stageNote) stageNote.hidden = true;
      if (flatBlock) flatBlock.hidden = true;
      if (faceNote) faceNote.textContent = "";
      sceneWanted = true;
      /* If the Gate already neared the screen once, stand the
       * scene again without waiting for a second approach. */
      if (nearFired) void startScene();
    }

    if (toggle) {
      toggle.addEventListener("click", () => {
        if (!Engine) return;
        Engine.setPlainPreferred(!Engine.plainPreferred());
        applyFace(false);
      });
    }

    if (!Engine) {
      /* Words stand even if the engine never loads: the flat
       * face is the Gate, and it is already rendered above. */
      if (flatBlock) flatBlock.hidden = false;
      if (stageEl) stageEl.hidden = true;
      if (stageNote) stageNote.hidden = false;
      say("The Gate in plain words — every land below, each with its next step.");
      return;
    }
    applyFace(false);
    if (stageEl) {
      Engine.bootWhenNear(stageEl, () => {
        nearFired = true;
        if (sceneWanted) void startScene();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
