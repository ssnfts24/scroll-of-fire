/*
 * Living Time Sphere — Day World Adapter.
 *
 * Phase B of the Living Sphere Evolution programme (Aaron's word,
 * Nov 22, 2026: "Start phase B"). The vertical slice: the selected
 * day's world, built inside the Sphere at the day's true ring
 * position, presented by ONE adapter module that only presents.
 *
 * The contract, per the Phase A architecture:
 *   - The R1.7 kernel is untouched. This module registers with the
 *     existing extension host and consumes the same context surface
 *     as the Temporal Strata and Life Atlas record extensions.
 *   - The temporal authority stays SOFTemporalCursor →
 *     PatternCalendar. The day view is the day-zoom module's own
 *     buildDayView, fed with the ONE planner record
 *     (CodexLivingPlanner), so the world and the Day Details panel
 *     can never disagree about what a day holds.
 *   - Writes go through CodexLivingPlanner only (completePlan /
 *     updatePlan / removePlan) — the existing planner write path.
 *   - Gold is today's colour only. Important records (planner
 *     priority high / critical) take the ivory edge.
 *
 * Recurrence expansion and outside-day (Day Out of Time / Deep Time
 * Day) plan display are Phase C. An outside day is handled honestly:
 * the world does not bloom, and the orientation chip says why.
 */
(function (global) {
  "use strict";

  const ID = "living-time-sphere-day-world";
  const VERSION = "0.1.0-phase-b";

  /* ── Visual constants (Phase A visual style guide) ───────────── */

  const PLINTH_WORLD_RADIUS = 0.17; // scene units at full bloom
  const ARC_RADIUS = 0.78;          // plinth units
  const ARC_Z = -0.18;              // toward the approaching keeper
  const PLINTH_TOP = 0.06;          // plinth units
  const MAX_SINGLES = 14;           // individual objects before clusters
  const LABEL_CAP = 8;

  const COLOURS = Object.freeze({
    plinth: 0x3a2c1c,
    plinthEdge: 0x2a1f13,
    brass: 0xb08d4f,
    todayGold: 0xe8b64c,
    ivory: 0xf2ead8,
    silverBlue: 0xa9c6de,
    farmGreen: 0x7fb069,
    harvestGold: 0xc9a227,
    ember: 0xd96f4e,
    stone: 0x8a8378,
    wood: 0x9a7b52,
    paper: 0xe6ddc8,
    terracotta: 0xc97b4a,
    water: 0x7fb2d9,
  });

  const STAGES = Object.freeze(["year", "moon", "approach", "living", "immersive"]);

  /* ── Pure helpers (unit-tested) ──────────────────────────────── */

  function clamp01(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.min(1, Math.max(0, n));
  }

  /*
   * The five zoom stages from camera distance. Bands per the
   * semantic-zoom module: far ≥ 3.25, medium 2.35–3.25,
   * near 1.62–2.35, detail < 1.62. Detail splits at 1.35 into
   * Living Day (upper) and Immersive Day (lower), with ±0.05
   * hysteresis so the split never flickers mid-flight.
   */
  function stageForDistance(distance, previousStage) {
    const d = Number(distance);
    if (!Number.isFinite(d)) return previousStage || "year";
    if (d >= 3.25) return "year";
    if (d >= 2.35) return "moon";
    if (d >= 1.62) return "approach";
    if (previousStage === "immersive") return d < 1.40 ? "immersive" : "living";
    if (previousStage === "living") return d < 1.30 ? "immersive" : "living";
    return d < 1.35 ? "immersive" : "living";
  }

  /*
   * Bloom: how far the day world has grown, 0..1. Nothing shows at
   * Moon View distance or beyond; the world swells through Day
   * Approach and stands full through the Living Day band.
   */
  function bloomForDistance(distance) {
    const d = Number(distance);
    if (!Number.isFinite(d)) return 0;
    if (d >= 2.35) return 0;
    if (d >= 1.62) return 0.12 + ((2.35 - d) / (2.35 - 1.62)) * 0.33;
    if (d >= 1.05) return 0.45 + ((1.62 - d) / (1.62 - 1.05)) * 0.55;
    return 1;
  }

  /*
   * The day's true ring position, from its calendar cell — the same
   * reading the renderer's own record extension uses: the pattern
   * ring radius (0.70) times the cell's radial factor, at the cell's
   * angle. The day never moves; the world grows from here.
   */
  function anchorForCell(cell, patternRingRadius) {
    if (!cell || !Number.isFinite(Number(cell.angle))) return null;
    const ring = Number.isFinite(Number(patternRingRadius)) ? Number(patternRingRadius) : 0.70;
    const radialFactor = Number.isFinite(Number(cell.radialFactor)) ? Number(cell.radialFactor) : 1.298;
    const radius = ring * radialFactor;
    const rad = (Number(cell.angle) * Math.PI) / 180;
    return {
      angle: Number(cell.angle),
      radius,
      position: {
        x: Math.sin(rad) * radius,
        y: 0.035,
        z: -Math.cos(rad) * radius,
      },
    };
  }

  /* A point on the day-clock arc for an hour of day (0..24). */
  function arcPoint(hour) {
    const t = Math.min(24, Math.max(0, Number(hour) || 0)) / 24;
    const theta = Math.PI * (1 - t);
    return {
      x: ARC_RADIUS * Math.cos(theta),
      y: PLINTH_TOP + ARC_RADIUS * Math.sin(theta),
      z: ARC_Z,
    };
  }

  function hourFromIso(iso) {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  }

  /* The next civil date (YYYY-MM-DD) n days after an ISO civil date. */
  function shiftCivilDate(civilDate, days) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(civilDate || ""));
    if (!match) return null;
    const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
      + (Number(days) || 0) * 86400000;
    const date = new Date(ms);
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }

  /*
   * Planner category → the Phase A object vocabulary. The brief's
   * eight named kinds (work, family, farm, travel, study, creative,
   * notes, reminder) lead; the planner's remaining categories fold
   * into the nearest designed object rather than inventing new ones.
   */
  const KIND_BY_CATEGORY = Object.freeze({
    task: "work", maintenance: "work", home: "work", cleaning: "work",
    shopping: "work", food: "work", vehicle: "work",
    reminder: "reminder", health: "reminder", finance: "reminder", pets: "reminder",
    family: "family", meeting: "family", community: "family",
    planting: "farm", growing: "farm", farming: "farm", watering: "farm",
    harvest: "farm", livestock: "farm", seasonal: "farm",
    travel: "travel", camping: "travel",
    research: "study", school: "study",
    creative: "creative", coding: "creative", project: "creative", construction: "creative",
    observation: "notes", writing: "notes", fieldwork: "notes",
    practice: "practice",
    event: "marker", appointment: "marker", milestone: "creative",
  });

  const KIND_LABELS = Object.freeze({
    work: "Work",
    family: "Family & gathering",
    farm: "Farm & garden",
    travel: "Travel",
    study: "Study",
    creative: "Creative work",
    notes: "Notes & witness",
    reminder: "Reminder",
    practice: "Practice",
    marker: "On the day",
  });

  function kindForCategory(category) {
    return KIND_BY_CATEGORY[String(category || "").toLowerCase()] || "marker";
  }

  /*
   * Build the world's items from the day view's entries — the same
   * entries the Day Details panel lists. Nothing is invented: an
   * entry becomes an object, with its hour, its standing, and the
   * planner's own priority read through the scheduling surface.
   */
  function buildWorldItems(entries, recordsById, scheduling, today) {
    const items = [];
    for (const entry of Array.isArray(entries) ? entries : []) {
      if (!entry || entry.practice) continue;
      const record = recordsById?.get?.(entry.id) || null;
      const schedule = record && scheduling?.getSchedule
        ? scheduling.getSchedule(record)
        : null;
      const priority = String(schedule?.priority || "normal").toLowerCase();
      const timed = !entry.allDay && entry.start != null;
      const hour = timed ? hourFromIso(entry.start) : null;
      const endHour = timed && entry.end ? hourFromIso(entry.end) : null;
      let overdue = false;
      if (!entry.completed && today) {
        if (today.patternDay != null) {
          // Day-granular comparison happens via the caller-supplied
          // dayRelation: -1 past, 0 same day, 1 future.
          if (today.dayRelation < 0) overdue = true;
          else if (today.dayRelation === 0 && timed) {
            const due = endHour != null ? endHour : hour;
            if (due != null && Number.isFinite(Number(today.nowHour)) && due < Number(today.nowHour)) {
              overdue = true;
            }
          }
        }
      }
      items.push({
        id: entry.id,
        title: entry.title,
        category: String(entry.type || record?.subtype || "event"),
        kind: kindForCategory(entry.type || record?.subtype),
        timed,
        hour,
        endHour,
        timeLabel: entry.timeLabel || (timed ? "" : "No set time"),
        summary: entry.summary || "",
        status: entry.status || null,
        completed: Boolean(entry.completed),
        important: priority === "high" || priority === "critical",
        overdue,
        civilDate: record?.temporal?.civilDate || null,
      });
    }
    items.sort((a, b) => {
      if (a.timed && b.timed) return a.hour - b.hour;
      if (a.timed) return -1;
      if (b.timed) return 1;
      return a.title.localeCompare(b.title);
    });
    return items;
  }

  /*
   * The clutter cap: at most MAX_SINGLES individual objects stand;
   * the rest gather into one timed cluster (on the arc, at the
   * median overflow hour) and one untimed cluster (on the terrace).
   */
  function groupItems(items) {
    const list = Array.isArray(items) ? items : [];
    if (list.length <= MAX_SINGLES) {
      return { singles: list.slice(), timedCluster: [], untimedCluster: [] };
    }
    const singles = list.slice(0, MAX_SINGLES);
    const overflow = list.slice(MAX_SINGLES);
    return {
      singles,
      timedCluster: overflow.filter((item) => item.timed),
      untimedCluster: overflow.filter((item) => !item.timed),
    };
  }

  function standingLineFor(stage, view, itemCount) {
    if (!view) return "";
    if (view.isOutsideCount) return "This day stands outside the count.";
    if (stage === "approach") {
      return itemCount > 0
        ? `${itemCount} ${itemCount === 1 ? "thing stands" : "things stand"} on this day.`
        : "Nothing stands on this day yet.";
    }
    if (stage === "immersive") return "In this day — the year is behind you.";
    return "Inside this Moon — the year is around you.";
  }

  const api = {
    ID,
    VERSION,
    COLOURS,
    STAGES,
    MAX_SINGLES,
    LABEL_CAP,
    clamp01,
    stageForDistance,
    bloomForDistance,
    anchorForCell,
    arcPoint,
    hourFromIso,
    shiftCivilDate,
    kindForCategory,
    KIND_LABELS,
    buildWorldItems,
    groupItems,
    standingLineFor,
  };

  global.LivingTimeSphereDayWorldAdapter = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  /* ── Browser runtime ─────────────────────────────────────────── */

  if (typeof document === "undefined" || !global.LivingTimeSphereExtensionHost) {
    return;
  }

  const reducedMotionQuery = typeof matchMedia === "function"
    ? matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };

  const state = {
    group: null,
    scene: null,
    hitProxies: [],
    risers: [],
    hourPosts: [],
    nowBead: null,
    emberLight: null,
    dome: null,
    itemsById: new Map(),
    view: null,
    selection: null,
    items: [],
    grouped: { singles: [], timedCluster: [], untimedCluster: [] },
    outside: false,
    unavailable: false,
    worldKey: "",
    buildGeneration: 0,
    rebuildInFlight: false,
    lastHealCheckMs: 0,
    frameNudgePending: false,
    framedByAdapter: false,
    restoreCentrePending: false,
    anchorPosition: null,
    recordsVersion: 0,
    yearCache: { year: null, records: null },
    bloom: 0,
    stage: "year",
    lastContext: null,
    lastFrameMs: 0,
    inspector: { mode: "closed", itemId: null, cluster: null, confirmRemoveUntil: 0 },
    dom: null,
  };

  /* ── Small DOM helpers ── */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function ensureDom() {
    if (state.dom) return state.dom;
    const shell = document.querySelector(".sphere-instrument-shell")
      || document.getElementById("sphere-container")?.parentElement
      || document.body;

    const chip = el("div", "dw-chip");
    chip.hidden = true;
    chip.setAttribute("role", "group");
    chip.setAttribute("aria-label", "Day world orientation");
    const chipMain = el("div", "dw-chip-main");
    const chipTitle = el("strong", "dw-chip-title");
    const chipLine = el("span", "dw-chip-line");
    chipMain.append(chipTitle, chipLine);
    const chipNav = el("div", "dw-chip-nav");
    const prev = el("button", "dw-chip-btn", "‹");
    prev.type = "button";
    prev.setAttribute("aria-label", "Previous day");
    prev.dataset.dwPrev = "";
    const next = el("button", "dw-chip-btn", "›");
    next.type = "button";
    next.setAttribute("aria-label", "Next day");
    next.dataset.dwNext = "";
    const back = el("button", "dw-chip-btn dw-chip-back", "Back to the year");
    back.type = "button";
    back.dataset.dwBack = "";
    chipNav.append(prev, next, back);
    chip.append(chipMain, chipNav);
    shell.appendChild(chip);

    const inspector = el("section", "dw-inspector");
    inspector.hidden = true;
    inspector.setAttribute("role", "dialog");
    inspector.setAttribute("aria-label", "Day world inspector");
    const head = el("header", "dw-ins-head");
    const kind = el("span", "dw-ins-kind");
    const close = el("button", "dw-ins-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close inspector");
    head.append(kind, close);
    const title = el("h3", "dw-ins-title");
    const line = el("p", "dw-ins-line");
    const sub = el("p", "dw-ins-sub");
    const list = el("div", "dw-ins-list");
    const actions = el("div", "dw-ins-actions");
    inspector.append(head, title, line, sub, list, actions);
    document.body.appendChild(inspector);

    prev.addEventListener("click", () => moveDay(-1));
    next.addEventListener("click", () => moveDay(1));
    back.addEventListener("click", () => backToYear());
    close.addEventListener("click", () => closeInspector());

    // The rooms sheet and the inspector never stand open together.
    const roomsObserver = new MutationObserver(() => {
      if (document.documentElement.classList.contains("armillary-rooms-open")) {
        closeInspector();
      }
    });
    roomsObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    state.roomsObserver = roomsObserver;

    state.dom = { chip, chipTitle, chipLine, back, inspector, kind, title, line, sub, list, actions };
    return state.dom;
  }

  /* ── Planner reads and writes (the one record) ── */

  async function recordsForYear(patternYear) {
    if (state.yearCache.year === patternYear && state.yearCache.records) {
      return state.yearCache.records;
    }
    const versionAtFetch = state.recordsVersion;
    const planner = global.CodexLivingPlanner;
    let records = [];
    if (planner?.plansForYear) {
      records = await planner.plansForYear(patternYear);
    } else if (global.CodexLifeAtlas?.listRecords) {
      records = await global.CodexLifeAtlas.listRecords();
    }
    const list = Array.isArray(records) ? records : [];
    // A records-changed landing mid-fetch makes this snapshot stale
    // before it arrives; cache it only if the record still stands.
    if (state.recordsVersion === versionAtFetch) {
      state.yearCache = { year: patternYear, records: list };
    }
    return list;
  }

  function dispatchRecordsChanged(source) {
    state.recordsVersion += 1;
    state.yearCache = { year: null, records: null };
    global.dispatchEvent(new CustomEvent("sof:life-atlas-records-changed", {
      detail: { source },
    }));
  }

  async function plannerWrite(action, item) {
    const planner = global.CodexLivingPlanner;
    if (!planner || !item?.id) return false;
    try {
      if (action === "complete") {
        await planner.completePlan(item.id);
      } else if (action === "remove") {
        await planner.removePlan(item.id);
      } else if (action === "postpone") {
        const nextDate = shiftCivilDate(item.civilDate, 1);
        if (!nextDate) return false;
        await planner.updatePlan(item.id, { date: nextDate });
      } else {
        return false;
      }
    } catch {
      return false;
    }
    dispatchRecordsChanged("day-world-adapter");
    return true;
  }

  /* ── Selection and day relation ── */

  function currentSelection() {
    const dz = global.LivingTimeSphereDayZoom;
    const cursor = global.SOFTemporalCursor;
    if (!dz?.selectionFromCursor || !cursor) return null;
    try {
      return dz.selectionFromCursor(cursor);
    } catch {
      return null;
    }
  }

  /*
   * Where the selected day stands against today, from the one
   * temporal authority (PatternCalendar.fromCivilDate — the same
   * call the Sphere model makes for its today position).
   * dayRelation: -1 the selected day is past, 0 it is today,
   * 1 it is ahead; null when either side is outside the count.
   */
  function todayRelation(selection) {
    const pc = global.PatternCalendar;
    const now = new Date();
    const nowHour = now.getHours() + now.getMinutes() / 60;
    let today = null;
    try {
      today = pc?.fromCivilDate ? pc.fromCivilDate({ date: now }) : null;
    } catch { today = null; }
    const todayDay = today?.dayOfPatternYear ?? null;
    const todayYear = today?.patternYear ?? null;
    let dayRelation = null;
    if (selection && Number.isInteger(todayDay) && Number.isInteger(selection.patternDay)) {
      if (todayYear !== selection.patternYear) {
        dayRelation = selection.patternYear < todayYear ? -1 : 1;
      } else if (selection.patternDay === todayDay) {
        dayRelation = 0;
      } else {
        dayRelation = selection.patternDay < todayDay ? -1 : 1;
      }
    }
    return {
      patternDay: todayDay,
      patternYear: todayYear,
      dayRelation,
      nowHour,
      isToday: dayRelation === 0,
    };
  }

  /* ── THREE building ── */

  function disposeObject(rootObject) {
    rootObject?.traverse?.((node) => {
      if (node.geometry?.dispose) node.geometry.dispose();
      const materials = Array.isArray(node.material) ? node.material : (node.material ? [node.material] : []);
      for (const material of materials) {
        for (const key of Object.keys(material)) {
          if (material[key]?.isTexture) material[key].dispose();
        }
        material.dispose?.();
      }
    });
  }

  function mat(THREE, colour, options = {}) {
    return new THREE.MeshStandardMaterial({
      color: colour,
      roughness: options.roughness ?? 0.82,
      metalness: options.metalness ?? 0.08,
      flatShading: options.flatShading ?? true,
      transparent: Boolean(options.transparent),
      opacity: options.opacity ?? 1,
      emissive: options.emissive ?? 0x000000,
      emissiveIntensity: options.emissiveIntensity ?? 1,
    });
  }

  function box(THREE, w, h, d, material, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    return mesh;
  }

  function cyl(THREE, rTop, rBottom, h, material, x = 0, y = 0, z = 0, segments = 10) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material);
    mesh.position.set(x, y, z);
    return mesh;
  }

  /* Object builders: one designed object per record kind. Each
   * returns a group standing on y=0 (its base), facing -Z (front). */
  const BUILDERS = {
    work(THREE, m) {
      const g = new THREE.Group();
      g.add(box(THREE, 0.16, 0.02, 0.09, m.wood, 0, 0.09, 0));
      g.add(box(THREE, 0.02, 0.09, 0.07, m.dark, -0.06, 0.045, 0));
      g.add(box(THREE, 0.02, 0.09, 0.07, m.dark, 0.06, 0.045, 0));
      g.add(box(THREE, 0.05, 0.03, 0.05, m.brass, 0.03, 0.115, 0));
      return g;
    },
    reminder(THREE, m) {
      const g = new THREE.Group();
      g.add(cyl(THREE, 0.008, 0.012, 0.16, m.dark, 0, 0.08, 0));
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.026, 10, 8),
        mat(THREE, COLOURS.ivory, { emissive: 0xf2ead8, emissiveIntensity: 0.55, flatShading: false })
      );
      lamp.position.set(0, 0.175, 0);
      lamp.name = "dw-lamp";
      g.add(lamp);
      return g;
    },
    family(THREE, m) {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.008, 6, 20), m.brass);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.012;
      g.add(ring);
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * Math.PI * 2;
        g.add(cyl(THREE, 0.016, 0.016, 0.035, m.wood, Math.cos(a) * 0.055, 0.018, Math.sin(a) * 0.055));
      }
      return g;
    },
    farm(THREE, m, item) {
      const g = new THREE.Group();
      g.add(box(THREE, 0.15, 0.035, 0.09, m.soil, 0, 0.018, 0));
      for (let i = 0; i < 3; i += 1) {
        const sprout = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.05, 6), m.leaf);
        sprout.position.set(-0.045 + i * 0.045, 0.06, 0);
        g.add(sprout);
      }
      if (item.category === "watering") {
        const drop = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), m.water);
        drop.position.set(0, 0.13, 0);
        drop.scale.y = 1.35;
        g.add(drop);
      }
      if (item.category === "harvest") {
        const frame = new THREE.Group();
        const fm = mat(THREE, COLOURS.harvestGold, { roughness: 0.5, metalness: 0.35 });
        frame.add(box(THREE, 0.17, 0.008, 0.008, fm, 0, 0.1, -0.05));
        frame.add(box(THREE, 0.17, 0.008, 0.008, fm, 0, 0.1, 0.05));
        frame.add(box(THREE, 0.008, 0.008, 0.108, fm, -0.085, 0.1, 0));
        frame.add(box(THREE, 0.008, 0.008, 0.108, fm, 0.085, 0.1, 0));
        g.add(frame);
      }
      return g;
    },
    travel(THREE, m) {
      const g = new THREE.Group();
      g.add(box(THREE, 0.018, 0.15, 0.018, m.wood, -0.055, 0.075, 0));
      g.add(box(THREE, 0.018, 0.15, 0.018, m.wood, 0.055, 0.075, 0));
      g.add(box(THREE, 0.14, 0.018, 0.024, m.brass, 0, 0.155, 0));
      return g;
    },
    study(THREE, m) {
      const g = new THREE.Group();
      g.add(cyl(THREE, 0.01, 0.014, 0.09, m.dark, 0, 0.045, 0));
      const board = box(THREE, 0.11, 0.075, 0.012, m.paper, 0, 0.115, 0);
      board.rotation.x = -0.5;
      g.add(board);
      return g;
    },
    creative(THREE, m, item) {
      const g = new THREE.Group();
      g.add(box(THREE, 0.09, 0.045, 0.09, m.terracotta, 0, 0.023, 0));
      g.add(box(THREE, 0.07, 0.04, 0.07, m.wood, 0.008, 0.065, 0));
      if (item.category === "milestone") {
        g.add(box(THREE, 0.045, 0.09, 0.045, m.brass, -0.005, 0.13, 0));
      } else {
        const top = box(THREE, 0.05, 0.035, 0.05, m.paper, -0.006, 0.1, 0);
        top.rotation.y = 0.4;
        g.add(top);
      }
      return g;
    },
    notes(THREE, m) {
      const g = new THREE.Group();
      const tablet = box(THREE, 0.085, 0.12, 0.012, m.paper, 0, 0.065, 0);
      tablet.rotation.x = -0.16;
      g.add(tablet);
      g.add(box(THREE, 0.1, 0.015, 0.03, m.dark, 0, 0.008, 0.01));
      return g;
    },
    practice(THREE, m) {
      const g = new THREE.Group();
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.02), m.stone);
        stone.position.set(Math.cos(a) * 0.055, 0.018, Math.sin(a) * 0.055);
        g.add(stone);
      }
      return g;
    },
    marker(THREE, m) {
      const g = new THREE.Group();
      g.add(cyl(THREE, 0.007, 0.01, 0.13, m.dark, 0, 0.065, 0));
      g.add(box(THREE, 0.05, 0.03, 0.006, m.brass, 0.028, 0.115, 0));
      return g;
    },
  };

  function buildObject(THREE, mats, item) {
    const builder = BUILDERS[item.kind] || BUILDERS.marker;
    const group = builder(THREE, mats, item);
    if (item.important) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.085, 0.1, 24),
        mat(THREE, COLOURS.ivory, { emissive: 0xf2ead8, emissiveIntensity: 0.25, flatShading: false })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.004;
      group.add(ring);
    }
    if (item.completed) {
      const cap = cyl(THREE, 0.05, 0.055, 0.012, mats.stone, 0, 0.19, 0, 12);
      cap.name = "dw-cap";
      group.add(cap);
      group.traverse((node) => {
        if (node.isMesh && node.material?.color && node.name !== "dw-lamp") {
          node.material = node.material.clone();
          node.material.color.multiplyScalar(0.6);
        }
      });
    }
    return group;
  }

  function hitProxy(THREE, x, y, z, radius, height, data) {
    const proxy = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    proxy.position.set(x, y, z);
    proxy.userData.dayWorld = data;
    return proxy;
  }

  function buildWorld(context, selection, view, items, today) {
    const THREE = context.THREE || global.THREE;
    if (!THREE || !context.scene) return;
    clearWorld();

    const geometry = global.LivingTimeSphereCalendarGeometry;
    const cell = geometry?.calendarDisplayCell?.(selection.patternDay)
      || geometry?.calendarCell?.(selection.patternDay);
    const anchor = anchorForCell(cell, global.LivingTimeSphereM?.SIZES?.patternRing);
    if (!anchor) {
      state.outside = true;
      return;
    }

    state.anchorPosition = anchor.position;
    const group = new THREE.Group();
    group.name = "living-time-sphere-day-world";
    group.position.set(anchor.position.x, anchor.position.y, anchor.position.z);
    group.lookAt(0, anchor.position.y, 0);
    group.scale.setScalar(0.0001);
    group.visible = false;

    const mats = {
      dark: mat(THREE, COLOURS.plinthEdge),
      wood: mat(THREE, COLOURS.wood),
      brass: mat(THREE, COLOURS.brass, { roughness: 0.45, metalness: 0.4 }),
      soil: mat(THREE, 0x2e2015),
      leaf: mat(THREE, COLOURS.farmGreen),
      water: mat(THREE, COLOURS.water, { roughness: 0.3 }),
      paper: mat(THREE, COLOURS.paper),
      stone: mat(THREE, COLOURS.stone),
      terracotta: mat(THREE, COLOURS.terracotta),
    };

    // The plinth: foundation, present even when the day is empty.
    // A faint warm emissive keeps the specified dark bronze reading
    // as bronze under the scene's key light, not as a void.
    const plinth = cyl(THREE, 1.0, 1.06, PLINTH_TOP, mat(THREE, COLOURS.plinth, {
      roughness: 0.9, emissive: 0x201409, emissiveIntensity: 1,
    }), 0, PLINTH_TOP / 2, 0, 48);
    plinth.name = "dw-plinth";
    group.add(plinth);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.014, 8, 64), mats.brass);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = PLINTH_TOP;
    group.add(rim);
    for (let k = 0; k < 24; k += 1) {
      const a = (k / 24) * Math.PI * 2;
      const long = k % 6 === 0;
      const tick = box(THREE, 0.008, 0.012, long ? 0.05 : 0.028, mats.brass,
        Math.cos(a) * 0.97, PLINTH_TOP + 0.004, Math.sin(a) * 0.97);
      tick.rotation.y = -a;
      group.add(tick);
    }

    // State light: gold only when this world is today.
    const stateLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 10, 8),
      mat(THREE, today.isToday ? COLOURS.todayGold : COLOURS.ivory, {
        emissive: today.isToday ? COLOURS.todayGold : COLOURS.ivory,
        emissiveIntensity: today.isToday ? 0.8 : 0.35,
        flatShading: false,
      })
    );
    stateLight.position.set(0, PLINTH_TOP + 0.02, -1.0);
    group.add(stateLight);

    // The day-clock arc.
    const arc = new THREE.Mesh(new THREE.TorusGeometry(ARC_RADIUS, 0.02, 8, 64, Math.PI), mats.brass);
    arc.position.set(0, PLINTH_TOP, ARC_Z);
    group.add(arc);
    state.hourPosts = [];
    for (const hour of [6, 9, 12, 15, 18]) {
      const point = arcPoint(hour);
      const post = cyl(THREE, 0.006, 0.006, 0.05, mats.brass, point.x, point.y + 0.02, ARC_Z, 6);
      post.visible = false;
      state.hourPosts.push(post);
      group.add(post);
    }

    // Label totem: geometry at the back-left; its words ride the chip.
    const totem = new THREE.Group();
    totem.add(cyl(THREE, 0.012, 0.016, 0.3, mats.dark, 0, 0.15, 0));
    totem.add(box(THREE, 0.16, 0.1, 0.014, mats.paper, 0, 0.3, 0));
    totem.position.set(-0.8, PLINTH_TOP, 0.5);
    totem.rotation.y = 0.5;
    group.add(totem);

    // Atmosphere dome: only when the live-data surface actually
    // carries an environment reading. Nothing is manufactured.
    state.dome = null;
    const snapshot = global.LivingTimeSphereLiveData?.getSnapshot?.();
    const environment = snapshot?.environment || snapshot?.weather || null;
    if (environment) {
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(1.04, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshBasicMaterial({
          color: environment.tint || 0x8fb6d9,
          transparent: true,
          opacity: 0.08,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      dome.position.y = PLINTH_TOP;
      group.add(dome);
      state.dome = dome;
    }

    // Records as objects.
    const grouped = groupItems(items);
    state.grouped = grouped;
    state.itemsById = new Map(items.map((item) => [item.id, item]));
    state.risers = [];
    const proxies = [];
    let riseIndex = 0;
    const addObject = (objectGroup, x, y, z, data) => {
      objectGroup.position.set(x, y, z);
      group.add(objectGroup);
      const proxy = hitProxy(THREE, x, y + 0.12, z, 0.115, 0.36, data);
      group.add(proxy);
      proxies.push(proxy);
      if (!reducedMotionQuery.matches) {
        state.risers.push({ object: objectGroup, baseY: y, delay: riseIndex * 40, startedAt: performance.now() });
        objectGroup.position.y = y - 0.06;
      }
      riseIndex += 1;
    };

    for (const item of grouped.singles) {
      const objectGroup = buildObject(THREE, mats, item);
      if (item.timed && item.hour != null) {
        const point = arcPoint(item.hour);
        addObject(objectGroup, point.x, point.y, ARC_Z, { kind: "record", id: item.id });
      } else {
        const idx = grouped.singles.filter((s) => !s.timed).indexOf(item);
        const row = idx >= 5 ? 1 : 0;
        const col = idx % 5;
        const x = -0.52 + col * 0.26;
        const z = row === 0 ? -0.52 : -0.28;
        addObject(objectGroup, x, PLINTH_TOP, z, { kind: "record", id: item.id });
      }
    }
    const addCluster = (clusterItems, x, y, z, clusterKind) => {
      if (!clusterItems.length) return;
      const stand = new THREE.Group();
      stand.add(box(THREE, 0.16, 0.03, 0.1, mats.wood, 0, 0.015, 0));
      clusterItems.slice(0, 4).forEach((item, i) => {
        const mini = box(THREE, 0.05, 0.04 + (i % 2) * 0.02, 0.05,
          mat(THREE, COLOURS.paper), -0.05 + (i % 2) * 0.1, 0.05 + Math.floor(i / 2) * 0.03, 0);
        stand.add(mini);
      });
      addObject(stand, x, y, z, { kind: "cluster", cluster: clusterKind, ids: clusterItems.map((i) => i.id) });
    };
    if (grouped.timedCluster.length) {
      const hours = grouped.timedCluster.map((i) => i.hour ?? 12).sort((a, b) => a - b);
      const median = hours[Math.floor(hours.length / 2)];
      const point = arcPoint(median);
      addCluster(grouped.timedCluster, point.x, point.y, ARC_Z, "timed");
    }
    if (grouped.untimedCluster.length) {
      addCluster(grouped.untimedCluster, 0.55, PLINTH_TOP, -0.3, "untimed");
    }

    // Now bead: today only, from the keeper's own clock.
    state.nowBead = null;
    if (today.isToday && today.nowHour != null) {
      const point = arcPoint(today.nowHour);
      const bead = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 10, 8),
        mat(THREE, COLOURS.todayGold, { emissive: COLOURS.todayGold, emissiveIntensity: 0.9, flatShading: false })
      );
      bead.position.set(point.x, point.y, ARC_Z);
      group.add(bead);
      state.nowBead = bead;
    }

    // One ember light when anything standing is overdue. Never a
    // fill, never flashing.
    state.emberLight = null;
    if (items.some((item) => item.overdue)) {
      const ember = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 8, 8),
        mat(THREE, COLOURS.ember, { emissive: COLOURS.ember, emissiveIntensity: 0.7, flatShading: false })
      );
      ember.position.set(-0.25, PLINTH_TOP + 0.02, -0.97);
      group.add(ember);
      state.emberLight = ember;
    }

    // The plinth itself is tappable: it opens the day inspector.
    const plinthProxy = hitProxy(THREE, 0, 0.1, 0, 0.95, 0.2, { kind: "plinth" });
    plinthProxy.name = "dw-plinth-proxy";
    group.add(plinthProxy);
    proxies.push(plinthProxy);

    state.hitProxies = proxies;
    state.group = group;
    context.scene.add(group);
  }

  function clearWorld() {
    if (state.group) {
      state.group.parent?.remove?.(state.group);
      disposeObject(state.group);
      state.group = null;
    }
    state.hitProxies = [];
    state.risers = [];
    state.hourPosts = [];
    state.nowBead = null;
    state.emberLight = null;
    state.dome = null;
  }

  async function rebuild(context, force = false) {
    const selection = currentSelection();
    const dz = global.LivingTimeSphereDayZoom;
    if (!selection || !dz) {
      state.unavailable = true;
      updateChip();
      return;
    }
    state.unavailable = false;
    const previousDay = state.selection?.patternDay;
    state.selection = selection;

    if (selection.isOutsideCount || !Number.isInteger(selection.patternDay)) {
      const key = `outside:${selection.patternYear}:${selection.civilDate}:${state.recordsVersion}`;
      if (!force && key === state.worldKey) return;
      state.worldKey = key;
      state.outside = true;
      state.view = null;
      state.items = [];
      clearWorld();
      closeInspector();
      updateChip();
      return;
    }
    state.outside = false;

    const key = `${selection.patternYear}:${selection.patternDay}:${state.recordsVersion}`;
    if (!force && key === state.worldKey) return;
    state.worldKey = key;

    // Generation guard, claimed only once this rebuild has committed
    // to building: rebuilds interleave freely (mount, cursor events,
    // record changes), and an early-return rebuild must not
    // assassinate the in-flight rebuild doing the same work. Only
    // the newest committed rebuild may write the world; an older one
    // that resolves late abandons its snapshot.
    const generation = ++state.buildGeneration;
    const records = await recordsForYear(selection.patternYear);
    if (generation !== state.buildGeneration) return;
    if (previousDay !== selection.patternDay
      && (state.stage === "living" || state.stage === "immersive")) {
      // Travelled to another day while inside the world: ask the
      // camera to frame the new day once its flight settles.
      state.frameNudgePending = true;
    }
    // The selection may have moved while records loaded.
    const fresh = currentSelection();
    if (!fresh || fresh.patternDay !== selection.patternDay || fresh.patternYear !== selection.patternYear) {
      state.worldKey = "";
      return;
    }
    const dayRecords = dz.recordsForDay(records, selection);
    const view = dz.buildDayView({
      selection,
      records: dayRecords,
      scheduling: global.CodexLifeAtlasScheduling,
    });
    const recordsById = new Map(dayRecords.map((record) => [record.id, record]));
    const today = todayRelation(selection);
    const items = buildWorldItems(view.entries, recordsById, global.CodexLifeAtlasScheduling, today);
    state.view = view;
    state.items = items;
    if (context?.scene) buildWorld(context, selection, view, items, today);
    updateChip();
  }

  /* ── Chip and inspector ── */

  function dayTitle(view, selection) {
    if (!view && !selection) return "The selected day";
    if (view?.isDayOutOfTime) return "Day Out of Time";
    if (view?.isYearGate) return "Year Gate";
    const moon = view?.moon ?? selection?.moon;
    const moonDay = view?.moonDay ?? selection?.moonDay;
    const patternDay = view?.patternDay ?? selection?.patternDay;
    return `Moon ${moon} · Day ${moonDay} · Pattern Day ${patternDay}`;
  }

  function updateChip() {
    const dom = ensureDom();
    const stage = state.stage;
    const show = !state.unavailable
      && (stage === "approach" || stage === "living" || stage === "immersive");
    dom.chip.hidden = !show;
    if (!show) return;
    if (state.outside) {
      dom.chipTitle.textContent = "Outside the count";
      dom.chipLine.textContent = "This day stands outside the 364. Its world opens with a later phase.";
      dom.back.hidden = false;
      return;
    }
    dom.chipTitle.textContent = dayTitle(state.view, state.selection);
    dom.chipLine.textContent = standingLineFor(stage, state.view || state.selection, state.items.length);
    dom.back.hidden = !(stage === "living" || stage === "immersive");
  }

  function closeInspector() {
    state.inspector = { mode: "closed", itemId: null, cluster: null, confirmRemoveUntil: 0 };
    if (state.dom) state.dom.inspector.hidden = true;
  }

  function openDayInspector() {
    const dom = ensureDom();
    const view = state.view;
    const items = state.items;
    state.inspector = { mode: "day", itemId: null, cluster: null, confirmRemoveUntil: 0 };
    dom.kind.textContent = "The day itself";
    dom.title.textContent = dayTitle(view, state.selection);
    if (state.outside) {
      dom.line.textContent = "This day stands outside the count of 364.";
      dom.sub.textContent = "Plans for outside days join the Sphere in a later phase. Nothing is hidden — there is no ring position to grow a world from yet.";
    } else if (!items.length) {
      dom.line.textContent = "Nothing stands on this day yet — the + below can plant the first thing.";
      dom.sub.textContent = "An empty day is an honest day: a bare foundation, nothing invented.";
    } else {
      const timed = items.filter((i) => i.timed).length;
      dom.line.textContent = `${items.length} ${items.length === 1 ? "thing stands" : "things stand"} here — ${timed} on the clock arc, ${items.length - timed} with no set time.`;
      dom.sub.textContent = items.some((i) => i.overdue)
        ? "One ember light burns on the rim: something standing here is overdue."
        : "Tap any object to see what it is and what can be done with it.";
    }
    dom.list.replaceChildren();
    dom.actions.replaceChildren();
    if (!state.outside) {
      const schedule = el("button", "dw-ins-btn", "Schedule on this day");
      schedule.type = "button";
      schedule.addEventListener("click", () => {
        closeInspector();
        document.querySelector("[data-sphere-rebuild-schedule]")?.click();
      });
      dom.actions.appendChild(schedule);
    }
    dom.inspector.hidden = false;
  }

  function openClusterInspector(clusterKind, ids) {
    const dom = ensureDom();
    const items = (ids || []).map((id) => state.itemsById.get(id)).filter(Boolean);
    state.inspector = { mode: "cluster", itemId: null, cluster: clusterKind, confirmRemoveUntil: 0 };
    dom.kind.textContent = clusterKind === "timed" ? "More on the arc" : "More with no set time";
    dom.title.textContent = `${items.length} more ${items.length === 1 ? "thing" : "things"} stand here`;
    dom.line.textContent = "The day is full, so these gather on one stand. Tap one to open it.";
    dom.sub.textContent = "";
    dom.list.replaceChildren();
    for (const item of items.slice(0, LABEL_CAP + 8)) {
      const row = el("button", "dw-ins-row", `${item.timed ? `${item.timeLabel} · ` : ""}${item.title}`);
      row.type = "button";
      row.addEventListener("click", () => openRecordInspector(item.id));
      dom.list.appendChild(row);
    }
    dom.actions.replaceChildren();
    dom.inspector.hidden = false;
  }

  function openRecordInspector(itemId) {
    const dom = ensureDom();
    const item = state.itemsById.get(itemId);
    if (!item) return;
    state.inspector = { mode: "record", itemId, cluster: null, confirmRemoveUntil: 0 };
    dom.kind.textContent = KIND_LABELS[item.kind] || "On the day";
    dom.title.textContent = item.title;
    dom.line.textContent = item.timed ? `At ${item.timeLabel}` : "No set time — it stands on the terrace.";
    const standing = item.completed
      ? "Completed. Its cap has settled and its light is dimmed."
      : item.overdue
        ? "Overdue — it still stands, waiting."
        : (item.status ? `Standing · ${item.status}` : "Standing on this day.");
    dom.sub.textContent = item.important ? `${standing} An important one — it wears the ivory edge.` : standing;
    dom.list.replaceChildren();
    dom.actions.replaceChildren();
    if (!item.completed) {
      const complete = el("button", "dw-ins-btn", "Complete");
      complete.type = "button";
      complete.addEventListener("click", async () => {
        if (await plannerWrite("complete", item)) closeInspector();
      });
      const postpone = el("button", "dw-ins-btn", "Postpone to tomorrow");
      postpone.type = "button";
      postpone.addEventListener("click", async () => {
        if (await plannerWrite("postpone", item)) closeInspector();
      });
      dom.actions.append(complete, postpone);
    }
    const remove = el("button", "dw-ins-btn dw-ins-btn-danger", "Remove");
    remove.type = "button";
    remove.addEventListener("click", async () => {
      const now = Date.now();
      if (now > state.inspector.confirmRemoveUntil) {
        state.inspector.confirmRemoveUntil = now + 3000;
        remove.textContent = "Tap again to remove";
        return;
      }
      if (await plannerWrite("remove", item)) closeInspector();
    });
    dom.actions.appendChild(remove);
    dom.inspector.hidden = false;
  }

  /* ── Travel inside the world ── */

  function focusSelectedDay(distance) {
    const selection = state.selection || currentSelection();
    const renderer = global.LivingTimeSphereRenderer3d;
    if (!selection || !renderer?.focusPatternDay || !Number.isInteger(selection.patternDay)) return;
    renderer.focusPatternDay(selection.patternDay, {
      distance,
      animated: !reducedMotionQuery.matches,
    });
  }

  function moveDay(delta) {
    const cursor = global.SOFTemporalCursor;
    if (!cursor?.moveDays) return;
    const camera = global.LivingTimeSphereCamera;
    const dist = camera?.getState?.()?.dist;
    const keep = Number.isFinite(dist) ? Math.min(2.2, Math.max(1.1, dist)) : 1.5;
    cursor.moveDays(delta, { source: "day-world-adapter" });
    // The cursor event rebuilds the world; reframe on the new day at
    // the same depth so travel stays inside the world.
    state.frameNudgePending = true;
    requestAnimationFrame(() => focusSelectedDay(keep));
  }

  /*
   * Framing. The kernel's focus keeps the camera's target at the
   * sphere's centre — right for reading the whole calendar, but at
   * Living Day distance the selected day's rim position falls far
   * below the frame. On entering the Living or Immersive stage (and
   * on travelling to another day inside the world), the adapter
   * asks the camera — through its own public moveTo, never by
   * writing camera state — to shift its target partway toward the
   * day, once the arrival flight has settled. One ask per entry:
   * if the keeper then orbits elsewhere, the camera is theirs. On
   * leaving the day stages, a target the adapter moved is returned
   * to the centre, so zooming back out restores the untouched year.
   */
  function maybeFrameWorld(context) {
    const camera = global.LivingTimeSphereCamera;
    if (!camera?.moveTo || !state.group || !state.anchorPosition) return;
    if (camera.isAnimating?.()) return;
    if (context.interactionActive) return; // the keeper's hand is on it
    const THREE = context.THREE || global.THREE;
    if (!THREE || !context.camera) return;
    const projected = new THREE.Vector3();
    state.group.getWorldPosition(projected);
    projected.project(context.camera);
    state.frameNudgePending = false;
    if (Number.isFinite(projected.y) && Math.abs(projected.y) <= 0.9) return;
    const anchor = state.anchorPosition;
    const phi = camera.getState?.()?.phi;
    // The deeper the stage, the further the target travels toward
    // the day: at Immersive distance a centre-held camera leaves
    // the rim further off-axis, not less.
    const factor = state.stage === "immersive" ? 0.78 : 0.55;
    camera.moveTo({
      targetX: anchor.x * factor,
      targetY: 0.04,
      targetZ: anchor.z * factor,
      phi: Number.isFinite(phi) ? Math.min(1.25, Math.max(0.95, phi)) : 1.1,
      animated: !reducedMotionQuery.matches,
      durationMs: 550,
    });
    state.framedByAdapter = true;
  }

  function maybeRestoreCentre() {
    if (!state.framedByAdapter) return;
    const camera = global.LivingTimeSphereCamera;
    if (!camera?.moveTo) return;
    // Never hijack a flight the keeper (or the focus surface) is
    // already flying: a moveTo here would replace its transition
    // and strand the zoom mid-way. Defer until the camera settles;
    // render consumes the pending restore.
    if (camera.isAnimating?.()) {
      state.restoreCentrePending = true;
      return;
    }
    state.framedByAdapter = false;
    state.restoreCentrePending = false;
    camera.moveTo({
      targetX: 0,
      targetY: 0,
      targetZ: 0,
      animated: !reducedMotionQuery.matches,
      durationMs: 450,
    });
  }

  function backToYear() {
    closeInspector();
    const selection = state.selection || currentSelection();
    if (selection && Number.isInteger(selection.patternDay)) {
      focusSelectedDay(3.45);
      return;
    }
    // Outside days have no ring position to focus; pull the camera
    // straight back to Year View distance instead.
    global.LivingTimeSphereCamera?.moveTo?.({
      dist: 3.45,
      animated: !reducedMotionQuery.matches,
    });
  }

  /* ── Extension ── */

  const extension = {
    id: ID,

    async mount(context) {
      state.lastContext = context;
      ensureDom();
      await rebuild(context, true);
    },

    async update(context) {
      state.lastContext = context;
      await rebuild(context);
    },

    render(context) {
      state.lastContext = context;
      // The live distance comes from the camera itself. The semantic
      // zoom state's distance is stamped at band transitions, not
      // live — a world keyed to it would freeze mid-zoom.
      const cameraDist = global.LivingTimeSphereCamera?.getState?.()?.dist;
      const distance = Number.isFinite(cameraDist)
        ? cameraDist
        : (context.semanticZoomState?.distance
          ?? (context.camera?.position ? context.camera.position.length() : null));
      const stage = stageForDistance(distance, state.stage);
      const target = state.outside || state.unavailable ? 0 : bloomForDistance(distance);
      const now = performance.now();
      const dt = state.lastFrameMs ? now - state.lastFrameMs : 16;
      state.lastFrameMs = now;
      if (reducedMotionQuery.matches || context.motionMode === "still") {
        state.bloom = target;
      } else {
        const step = 1 - Math.exp(-dt / 140);
        state.bloom += (target - state.bloom) * step;
        if (Math.abs(target - state.bloom) < 0.002) state.bloom = target;
        // The renderer draws on demand; while the bloom is still
        // travelling, ask for the next frame so an instant camera
        // jump (keyboard, programmatic focus) cannot strand the
        // world mid-growth on a sleeping frame stream.
        if (state.bloom !== target) {
          if (typeof context.requestRender === "function") context.requestRender();
          else global.LivingTimeSphereAnimation?.markDirty?.();
        }
      }
      if (state.group) {
        const scale = Math.max(0.0001, state.bloom * PLINTH_WORLD_RADIUS);
        state.group.scale.setScalar(scale);
        state.group.visible = state.bloom > 0.01;
        // Risers: objects settle up into place, staggered.
        for (const riser of state.risers) {
          const elapsed = now - riser.startedAt - riser.delay;
          if (elapsed < 0) continue;
          const t = clamp01(elapsed / 300);
          const eased = 1 - Math.pow(1 - t, 3);
          riser.object.position.y = riser.baseY - 0.06 * (1 - eased);
        }
        if (state.risers.length && state.risers.every((r) => now - r.startedAt - r.delay > 300)) {
          state.risers = [];
        }
        const immersive = stage === "immersive";
        for (const post of state.hourPosts) post.visible = immersive;
      }
      if (stage !== state.stage) {
        const wasInDay = state.stage === "living" || state.stage === "immersive";
        const isInDay = stage === "living" || stage === "immersive";
        state.stage = stage;
        if (isInDay) state.frameNudgePending = true;
        if (!isInDay && wasInDay) maybeRestoreCentre();
        updateChip();
      }
      if (state.frameNudgePending
        && (state.stage === "living" || state.stage === "immersive")) {
        maybeFrameWorld(context);
      }
      if (state.restoreCentrePending
        && !(state.stage === "living" || state.stage === "immersive")) {
        maybeRestoreCentre();
      }
      // Self-heal: if the standing world no longer matches the
      // selection and record the keeper is looking at (a rebuild
      // was missed or landed stale), rebuild. Checked against the
      // live cursor, throttled — frames flow with any interaction,
      // so the next touch or zoom restores agreement.
      if (now - (state.lastHealCheckMs || 0) > 1500) {
        state.lastHealCheckMs = now;
        const live = currentSelection();
        if (live && !live.isOutsideCount && Number.isInteger(live.patternDay)) {
          const expectedKey = `${live.patternYear}:${live.patternDay}:${state.recordsVersion}`;
          if (state.worldKey !== expectedKey && !state.rebuildInFlight) {
            state.rebuildInFlight = true;
            void rebuild(context).finally(() => { state.rebuildInFlight = false; });
          }
        }
      }
    },

    pick(context) {
      if (!state.group || !state.group.visible) return null;
      if (!(state.stage === "living" || state.stage === "immersive" || state.bloom >= 0.6)) return null;
      const raycaster = context.raycaster;
      if (!raycaster?.intersectObjects) return null;
      const hits = raycaster.intersectObjects(state.hitProxies, false);
      if (!hits.length) return null;
      // The plinth proxy encloses the terrace objects, so its wall is
      // often the nearest hit. A record or cluster hit anywhere along
      // the ray outranks the plinth; the plinth answers only when
      // nothing standing was touched.
      const hit = hits.find((candidate) => candidate.object.userData.dayWorld?.kind !== "plinth")
        || hits[0];
      const data = hit.object.userData.dayWorld;
      if (!data) return null;
      // World position from the matrix itself — no THREE handle
      // needed, so a pick can never fail on a missing global.
      const elements = hit.object.matrixWorld?.elements;
      const worldPosition = elements
        ? { x: elements[12], y: elements[13], z: elements[14] }
        : { x: 0, y: 0, z: 0 };
      if (data.kind === "record") {
        const item = state.itemsById.get(data.id);
        openRecordInspector(data.id);
        return {
          handled: true,
          type: "day-world-record",
          label: item ? item.title : "Record",
          position: { x: worldPosition.x, y: worldPosition.y, z: worldPosition.z },
          temporal: {
            patternYear: state.selection?.patternYear,
            patternDay: state.selection?.patternDay,
          },
          payload: { recordId: data.id },
        };
      }
      if (data.kind === "cluster") {
        openClusterInspector(data.cluster, data.ids);
        return {
          handled: true,
          type: "day-world-cluster",
          label: data.cluster === "timed" ? "More on the arc" : "More with no set time",
          position: { x: worldPosition.x, y: worldPosition.y, z: worldPosition.z },
          temporal: {
            patternYear: state.selection?.patternYear,
            patternDay: state.selection?.patternDay,
          },
          payload: { cluster: data.cluster },
        };
      }
      openDayInspector();
      return {
        handled: true,
        type: "day-world-plinth",
        label: dayTitle(state.view, state.selection),
        position: { x: worldPosition.x, y: worldPosition.y, z: worldPosition.z },
        temporal: {
          patternYear: state.selection?.patternYear,
          patternDay: state.selection?.patternDay,
        },
        payload: {},
      };
    },

    dispose() {
      clearWorld();
      state.roomsObserver?.disconnect?.();
      state.roomsObserver = null;
      state.dom?.chip?.remove?.();
      state.dom?.inspector?.remove?.();
      state.dom = null;
    },
  };

  global.LivingTimeSphereExtensionHost.register(extension);

  global.addEventListener("sof:life-atlas-records-changed", (event) => {
    if (event?.detail?.source === "day-world-adapter") {
      // Our own write already bumped the version in
      // dispatchRecordsChanged; rebuild against the fresh record.
      if (state.lastContext) void rebuild(state.lastContext, true);
      return;
    }
    state.recordsVersion += 1;
    state.yearCache = { year: null, records: null };
    if (state.lastContext) void rebuild(state.lastContext);
  });
  global.addEventListener("sof:temporal-cursor-change", () => {
    if (state.lastContext) void rebuild(state.lastContext);
  });
  // The cursor is established in the page's first deferred phase,
  // which can land after this adapter mounts. Its ready event is
  // the signal to build the first world.
  global.addEventListener("sof:temporal-cursor-ready", () => {
    if (state.lastContext) void rebuild(state.lastContext, true);
  });
  document.addEventListener("sof:sphere-deferred-tools-ready", () => {
    if (state.lastContext) void rebuild(state.lastContext, true);
  });
  global.addEventListener("sof:selected-date-change", () => {
    if (state.lastContext) void rebuild(state.lastContext);
  });

  api._state = state;
  api._extension = extension;
})(typeof globalThis !== "undefined" ? globalThis : this);
