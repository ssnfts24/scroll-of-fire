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
 *   - The sphere UI honours selections that never move the cursor
 *     (a tap on the face lands in the UI's own state only). The
 *     selection bridge below routes those announced selections
 *     into the cursor through its public API, so the one authority
 *     stands and every reader agrees with the face. The adapter
 *     displays the cursor's selection only — never the UI's.
 *   - Gold is today's colour only. Important records (planner
 *     priority high / critical) take the ivory edge.
 *
 * Recurrence expansion and outside-day (Day Out of Time / Deep Time
 * Day) plan display are Phase C. An outside day is handled honestly:
 * the world does not bloom, and the orientation chip says why.
 *
 * Temporal Worlds slice (Aaron's commission, Nov 22, 2026: "Do
 * whatever is best. Add in anything that can be tracked already
 * including whatever for farming etc."), stacked on Phase B:
 *   - DAY ENTRY. The day world stands inside a faint bubble.
 *     Crossing from Living Day into Immersive Day passes the
 *     bubble's membrane — a brief, legible threshold (a veil sweep,
 *     a fade for reduced-motion keepers) — and the world opens in
 *     front of the keeper, exactly as Phase B built it. The keeper
 *     is never placed inside a sphere looking out at a shell.
 *   - THE YEARS LINE. One stage beyond Year View: the multitude as
 *     a line of schematic year-shells. The lived year stands lit;
 *     the road ahead stands dim and labelled as the road ahead —
 *     calendar-true shells holding no content they don't have.
 *     A selected day's counterpart is picked out in every shell,
 *     so the same Pattern Day reads down the line.
 *   - PATTERN TRACKING. A Patterns door beside the dock lights
 *     every day holding a chosen kind — on the faced year and down
 *     the years line — from the same one planner record, with the
 *     count shown and labelled as a count. Only documented ties
 *     are surfaced: a record's own stored recurrence, named as
 *     such. Same-kind days are lit and called "same kind", never
 *     drawn as threads.
 * The three binding constraints (data honesty, entry-not-inside,
 * phone reality) are recorded in the slice's build note:
 * docs/development/living-sphere-temporal-worlds-slice.md.
 */
(function (global) {
  "use strict";

  const ID = "living-time-sphere-day-world";
  const VERSION = "0.2.0-temporal-worlds";

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

  const STAGES = Object.freeze(["years", "year", "moon", "approach", "living", "immersive"]);

  /* ── Temporal Worlds constants ───────────────────────────────── */

  // The years line lives beyond Year View. Enter at 4.45, hold to
  // 4.25 — a small hysteresis so the line never flickers at its edge.
  const YEARS_STAGE_MIN = 4.45;
  const YEARS_STAGE_HOLD = 4.25;
  // The lived calendar's first alignment year: Pattern Year 2026,
  // anchored April 17, 2026 (PatternCalendar's epoch year; the
  // coordinate engine's "Anchor 2026 = Pattern Year 2026").
  const EPOCH_ALIGNMENT_YEAR = 2026;
  // The road ahead is bounded: the current year plus two.
  const YEARS_AHEAD = 2;
  // Year-shell layout: a line of beads across the front of the
  // Sphere, in the years group's own frame — the group turns with
  // the camera's azimuth (see render), so the line always stands
  // across the view's front, clear of the instrument's silhouette
  // (outer rings reach ~1.35; the line stands at ~2.0 out).
  const SHELL_RADIUS = 0.29;
  const SHELL_SPACING = 0.8;
  const SHELL_LINE_Y = -0.35;
  const SHELL_LINE_Z = 2.0;

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
    if (previousStage === "years") {
      if (d >= YEARS_STAGE_HOLD) return "years";
    } else if (d >= YEARS_STAGE_MIN) {
      return "years";
    }
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

  /*
   * The selection bridge's decision, kept pure so it is
   * unit-tested. The sphere UI honours selections that never move
   * the canonical cursor (a tap on the face is the common one);
   * the bridge routes the ANNOUNCED selection into the cursor so
   * every reader — this chip, the day world, Day Details — keeps
   * reading the one authority. The chip itself never reads the
   * UI's selection; this decision only ever moves the cursor.
   *
   *   announced: { patternYear, patternDay } — the day the UI
   *     has just honoured (its selectionchange announcement, or
   *     its public state read by the render heal).
   *   current: the cursor's selection (selectionFromCursor), or
   *     null when the cursor cannot be read.
   *
   * Returns one of:
   *   { action: "none" }        — invalid target, or the cursor
   *                               already stands there.
   *   { action: "pattern-day", day } — same pattern year: the
   *                               cursor's own setPatternDay is
   *                               exact civil-day arithmetic.
   *   { action: "civil-date", year, day } — another pattern
   *                               year, or the cursor stands
   *                               outside the count: move by
   *                               civil date, verified first.
   */
  function routeDecision(announced, current) {
    const day = Number(announced?.patternDay);
    if (!Number.isInteger(day) || day < 1 || day > 364) return { action: "none" };
    // A missing year is not year 0: Number(null) would say it is.
    const year = announced?.patternYear == null ? NaN : Number(announced.patternYear);
    const hasYear = Number.isInteger(year);
    if (current && !current.isOutsideCount && Number.isInteger(current.patternDay)) {
      if (current.patternDay === day && (!hasYear || current.patternYear === year)) {
        return { action: "none" };
      }
      if (!hasYear || current.patternYear === year) {
        return { action: "pattern-day", day };
      }
    }
    if (hasYear) return { action: "civil-date", year, day };
    return { action: "none" };
  }

  /*
   * The civil date of a Pattern day — the same date the sphere
   * UI's own cursor bridge computes: the pattern year's epoch
   * (PatternCalendar.epochForYear, April 17) plus day − 1 days.
   * The candidate is verified against the coordinate engine's own
   * decomposition before the cursor is ever asked to move: in a
   * timezone far ahead of UTC the UTC-noon epoch lands on the next
   * local day, so one bounded correction by the reported day
   * difference is allowed; anything else fails closed (null) and
   * the cursor keeps its truth.
   */
  function civilDateForPatternDay(patternYear, patternDay, deps = {}) {
    const epochForYear = deps.epochForYear;
    const remnantFromDate = deps.remnantFromDate;
    if (typeof epochForYear !== "function") return null;
    const epoch = epochForYear(patternYear);
    if (!(epoch instanceof Date) || Number.isNaN(epoch.getTime())) return null;
    let candidate = new Date(epoch.getTime() + (patternDay - 1) * 86400000);
    if (typeof remnantFromDate !== "function") return candidate;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let remnant = null;
      try {
        remnant = remnantFromDate(candidate);
      } catch {
        return null;
      }
      if (!remnant) return null;
      if (remnant.patternYear === patternYear && remnant.patternDay === patternDay) {
        return candidate;
      }
      if (remnant.patternYear === patternYear && Number.isInteger(remnant.patternDay)) {
        candidate = new Date(candidate.getTime() + (patternDay - remnant.patternDay) * 86400000);
        continue;
      }
      return null;
    }
    return null;
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

  /* ── Depth names (the chip's crumb) ──────────────────────────── */

  const DEPTH_CRUMBS = Object.freeze(["Years", "Year", "Moon", "Day", "Inside the day"]);

  function depthNameForStage(stage) {
    if (stage === "years") return "Years";
    if (stage === "year") return "Year";
    if (stage === "moon") return "Moon";
    if (stage === "immersive") return "Inside the day";
    return "Day"; // Day Approach and Living Day are both "at the day"
  }

  /* ── The years line's range ──────────────────────────────────── */

  /*
   * Year 1 of the lived calendar (alignment year 2026) through the
   * current year, plus the road ahead bounded at current + 2. When
   * the keeper has travelled to a later year, their year is on the
   * line too. Years are alignment years — the same year numbers
   * the records and the cursor carry.
   */
  function yearsLineRange(todayYear, cursorYear) {
    const first = EPOCH_ALIGNMENT_YEAR;
    const base = Number.isInteger(todayYear) ? todayYear : first;
    let last = Math.max(base + YEARS_AHEAD, first + YEARS_AHEAD);
    if (Number.isInteger(cursorYear)) last = Math.max(last, cursorYear);
    const years = [];
    for (let year = first; year <= last; year += 1) years.push(year);
    return years;
  }

  /* ── The trackable inventory ─────────────────────────────────── */

  /*
   * What the keeper's records already carry, evidenced from the
   * record layer itself (life-atlas-record-sphere-extension.js —
   * R1.7 protected, read here, never imported): a planner record's
   * category (payload.planner.category, falling back to subtype),
   * its symbol (an explicit payload.planner.symbol wins; a workflow
   * stamp names its own; otherwise the category's symbol below),
   * its workflow, and — through CodexLifeAtlasScheduling — its
   * status, priority, times, completion, and stored recurrence.
   * The tables below mirror the record layer's own so the Patterns
   * view can never disagree with the face about what a day holds.
   */
  const SYMBOL_BY_CATEGORY = Object.freeze({
    task: "✓", event: "●", reminder: "⚑", project: "◆", travel: "✈",
    milestone: "★", practice: "✦", growing: "🌱", farming: "🌾", planting: "🌱",
    harvest: "🌾", watering: "💧", livestock: "🐄", maintenance: "🔧", seasonal: "☀",
    meeting: "👥", school: "🎓", health: "❤", finance: "💰", observation: "◉",
    home: "⌂", family: "♡", pets: "🐾", food: "🍽", shopping: "🛒",
    vehicle: "🚗", construction: "🏗", coding: "💻", writing: "✎", research: "🔬",
    creative: "🎨", cleaning: "🧹", appointment: "✚", community: "◎",
    camping: "⛺", fieldwork: "🥾",
  });

  /* The record layer's own colour per category (its colorFor
   * palette), so a lit day glows in the colour the face already
   * gives its kind. */
  const COLOUR_BY_CATEGORY = Object.freeze({
    task: 0x7fd7ff, event: 0xf6d56a, reminder: 0xff9f80, project: 0x65d7c5,
    travel: 0x80b8ff, milestone: 0xffcf6e, practice: 0xc4a7ff, growing: 0x78e08f,
    farming: 0x8ccf72, planting: 0x6edb8b, harvest: 0xe6bd63, watering: 0x70b7e8,
    livestock: 0xc8a77c, maintenance: 0xb7c2cc, seasonal: 0xb9df72, meeting: 0xb6a5ff,
    school: 0x86b7ff, health: 0xff8f9d, finance: 0xe4c46b, observation: 0xd6d6d6,
    home: 0xf0c878, family: 0xffa9bb, pets: 0xcaa67f, food: 0xf0b76e,
    shopping: 0xc9b4ff, vehicle: 0x8ebde8, construction: 0xe0b56d, coding: 0x79d7eb,
    writing: 0xe7d293, research: 0xa9c6ff, creative: 0xd7a6ff, cleaning: 0x9fded8,
    appointment: 0xff9ca8, community: 0x9ac8ff, camping: 0x93cf8d, fieldwork: 0x9fd4ad,
  });

  const KIND_NAMES = Object.freeze({
    task: "Tasks", event: "Events", reminder: "Reminders", project: "Projects",
    travel: "Travel", milestone: "Milestones", practice: "Practice",
    growing: "Growing", farming: "Farming", planting: "Planting",
    harvest: "Harvest", watering: "Watering", livestock: "Livestock",
    maintenance: "Maintenance", seasonal: "Seasonal", meeting: "Meetings",
    school: "School & learning", health: "Health", finance: "Finance",
    observation: "Observations", home: "Home", family: "Family", pets: "Animal care",
    food: "Food & meals", shopping: "Shopping & errands", vehicle: "Vehicle",
    construction: "Building & construction", coding: "Coding", writing: "Writing",
    research: "Research", creative: "Creative work", cleaning: "Cleaning",
    appointment: "Appointments", community: "Community", camping: "Camping",
    fieldwork: "Field work",
  });

  /*
   * Kinds grouped for humans. Farm & Home stands first — Aaron
   * named farming himself. Every category in SYMBOL_BY_CATEGORY
   * appears in exactly one group; the unit tests hold that line.
   */
  const PATTERN_GROUPS = Object.freeze([
    Object.freeze({
      id: "farm-home", label: "Farm & home",
      categories: Object.freeze(["planting", "growing", "farming", "watering", "harvest", "livestock", "seasonal", "maintenance"]),
    }),
    Object.freeze({
      id: "home-family", label: "Home & family",
      categories: Object.freeze(["home", "family", "pets", "food", "cleaning", "shopping", "vehicle"]),
    }),
    Object.freeze({
      id: "work-craft", label: "Work & craft",
      categories: Object.freeze(["task", "project", "coding", "construction", "creative", "finance"]),
    }),
    Object.freeze({
      id: "study-witness", label: "Study & witness",
      categories: Object.freeze(["school", "research", "writing", "observation", "fieldwork", "practice"]),
    }),
    Object.freeze({
      id: "people-occasions", label: "People & occasions",
      categories: Object.freeze(["meeting", "community", "appointment", "health", "reminder", "milestone", "travel", "camping", "event"]),
    }),
  ]);

  function categoryForRecord(record) {
    return String(
      record?.payload?.planner?.category || record?.subtype || "event"
    ).toLowerCase();
  }

  function workflowForRecord(record) {
    return String(record?.payload?.planner?.workflow || "").toLowerCase();
  }

  /* The record layer's own symbol rule, mirrored exactly. */
  function symbolForRecord(record) {
    const explicit = String(record?.payload?.planner?.symbol || "").trim();
    if (explicit && explicit !== "auto") return explicit.slice(0, 4);
    const workflow = workflowForRecord(record);
    if (workflow === "codex-of-reality") return "✎";
    if (workflow === "living-phone") return "☎";
    return SYMBOL_BY_CATEGORY[categoryForRecord(record)] || "●";
  }

  function isPlannerRecord(record) {
    return Boolean(
      record?.tags?.includes?.("living-planner")
      || record?.provenance?.source === "living-planner"
      || record?.payload?.planner
    );
  }

  /*
   * One pattern entry from one record. Completion and recurrence
   * come from the scheduling surface; overdue follows the day
   * world's own rule (a standing record on a past day, or past its
   * end hour today). `today` is { patternYear, patternDay, nowHour }
   * in ALIGNMENT years — the years the records carry.
   */
  function patternEntryForRecord(record, scheduling, today) {
    if (!record || !isPlannerRecord(record)) return null;
    const year = Number(record.temporal?.patternYear);
    const day = Number(record.temporal?.patternDay);
    if (!Number.isInteger(year) || !Number.isInteger(day) || day < 1 || day > 364) return null;
    const schedule = scheduling?.getSchedule ? scheduling.getSchedule(record) : null;
    const completed = scheduling?.isCompleted
      ? Boolean(scheduling.isCompleted(record))
      : Boolean(schedule?.status === "completed" || schedule?.completedAt);
    let overdue = false;
    if (!completed && today && Number.isInteger(today.patternDay)) {
      if (year < today.patternYear || (year === today.patternYear && day < today.patternDay)) {
        overdue = true;
      } else if (year === today.patternYear && day === today.patternDay && schedule && !schedule.allDay) {
        const endIso = schedule.end || schedule.start;
        const due = endIso ? hourFromIso(endIso) : null;
        if (due != null && Number.isFinite(Number(today.nowHour)) && due < Number(today.nowHour)) {
          overdue = true;
        }
      }
    }
    const priority = String(schedule?.priority || "normal").toLowerCase();
    const frequency = String(schedule?.recurrence?.frequency || "none").toLowerCase();
    return {
      id: record.id || null,
      title: String(record.title || "Living Plan"),
      year,
      day,
      category: categoryForRecord(record),
      symbol: symbolForRecord(record),
      completed,
      overdue,
      important: priority === "high" || priority === "critical",
      status: schedule?.status || null,
      recurrence: frequency !== "none"
        ? { frequency, interval: Math.max(1, Number(schedule.recurrence.interval) || 1) }
        : null,
    };
  }

  /*
   * The pattern index over a set of years: byDay maps "year:day"
   * to the entries standing there. Built from the ONE planner
   * record (plansForYear per year) — nothing else is tracked.
   */
  function buildPatternIndex(records, scheduling, today) {
    const byDay = new Map();
    for (const record of Array.isArray(records) ? records : []) {
      const entry = patternEntryForRecord(record, scheduling, today);
      if (!entry) continue;
      const key = `${entry.year}:${entry.day}`;
      const bucket = byDay.get(key) || [];
      bucket.push(entry);
      byDay.set(key, bucket);
    }
    return { byDay };
  }

  function entryMatchesFilter(entry, filter) {
    if (!entry) return false;
    if (filter?.categories && !filter.categories.has(entry.category)) return false;
    if (filter?.recurringOnly && !entry.recurrence) return false;
    const standing = filter?.standing || "any";
    if (standing === "open" && entry.completed) return false;
    if (standing === "completed" && !entry.completed) return false;
    if (standing === "overdue" && !entry.overdue) return false;
    return true;
  }

  /*
   * The lit days for a filter: every day holding at least one
   * matching entry, with the matching count (a count of records,
   * labelled as a count wherever it is shown), the primary symbol,
   * and the kind colour of the first matching entry.
   */
  function litDaysFor(index, filter) {
    const lit = [];
    if (!index?.byDay) return lit;
    for (const entries of index.byDay.values()) {
      const matching = entries.filter((entry) => entryMatchesFilter(entry, filter));
      if (!matching.length) continue;
      const first = matching[0];
      lit.push({
        year: first.year,
        day: first.day,
        count: matching.length,
        primarySymbol: first.symbol,
        symbols: [...new Set(matching.map((entry) => entry.symbol))],
        colour: COLOUR_BY_CATEGORY[first.category] ?? 0xf6d56a,
        entries: matching,
      });
    }
    lit.sort((a, b) => (a.year - b.year) || (a.day - b.day));
    return lit;
  }

  /* Days holding a kind, counted per category across the index —
   * the panel's per-kind day counts. */
  function dayCountsByCategory(index) {
    const counts = new Map();
    if (!index?.byDay) return counts;
    for (const entries of index.byDay.values()) {
      const seen = new Set();
      for (const entry of entries) {
        if (seen.has(entry.category)) continue;
        seen.add(entry.category);
        counts.set(entry.category, (counts.get(entry.category) || 0) + 1);
      }
    }
    return counts;
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
    routeDecision,
    civilDateForPatternDay,
    depthNameForStage,
    DEPTH_CRUMBS,
    yearsLineRange,
    EPOCH_ALIGNMENT_YEAR,
    YEARS_AHEAD,
    SYMBOL_BY_CATEGORY,
    COLOUR_BY_CATEGORY,
    KIND_NAMES,
    PATTERN_GROUPS,
    categoryForRecord,
    workflowForRecord,
    symbolForRecord,
    isPlannerRecord,
    patternEntryForRecord,
    buildPatternIndex,
    entryMatchesFilter,
    litDaysFor,
    dayCountsByCategory,
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
    foldedStrata: null,        // { year, patternDay, card } while the year card is folded into the chip
    strataFoldDismissedFor: null, // "year:patternDay" the keeper dismissed — not re-folded for that selection
    worldKey: "",
    buildGeneration: 0,
    rebuildInFlight: false,
    lastHealCheckMs: 0,
    frameNudgePending: false,
    framedByAdapter: false,
    restoreCentrePending: false,
    anchorPosition: null,
    recordsVersion: 0,
    bridge: {
      pending: null,       // a selection announced before the cursor existed
      signalAt: 0,         // last keeper-selection signal (performance clock)
      cursorReadyAt: 0,    // when the cursor first stood up for us
      lastUiSelection: null, // last UI selection the render heal observed
      uiStableHeals: 0,    // consecutive heals that saw it unchanged
    },
    yearCache: { year: null, records: null },
    bloom: 0,
    stage: "year",
    lastContext: null,
    lastFrameMs: 0,
    inspector: { mode: "closed", itemId: null, cluster: null, confirmRemoveUntil: 0 },
    dom: null,
    /* Temporal Worlds slice state. */
    bubble: null,
    membrane: { lastCrossAt: 0, direction: null },
    notice: null,
    years: { group: null, shells: [], proxies: [], builtKey: "", fade: 0 },
    patterns: {
      open: false,
      filter: { categories: null, standing: "any", recurringOnly: false, label: null },
      index: null,
      indexKey: "",
      lit: [],
      overlayGroup: null,
      overlayKey: "",
      loading: false,
    },
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
    const crumb = el("div", "dw-chip-crumb");
    crumb.setAttribute("aria-label", "Depth");
    const crumbSteps = DEPTH_CRUMBS.map((name) => {
      const step = el("span", "dw-chip-crumb-step", name);
      step.dataset.dwDepth = name;
      crumb.appendChild(step);
      return step;
    });
    const chipTitle = el("strong", "dw-chip-title");
    const chipLine = el("span", "dw-chip-line");
    // The folded year line (Nov 25, 2026): when the temporal
    // strata's selected-year card stands over the face, its one
    // fact — the selected day carried into the selected year —
    // is stated here, inside the day presentation, and the
    // floating card folds away (see foldDayPresentation). Its
    // close button rides along: dismissing here dismisses the
    // card through the card's own close control.
    const chipYear = el("span", "dw-chip-year");
    chipYear.hidden = true;
    const chipYearText = el("span", "dw-chip-year-text");
    const chipYearClose = el("button", "dw-chip-year-close", "×");
    chipYearClose.type = "button";
    chipYearClose.setAttribute("aria-label", "Hide the year line");
    chipYearClose.addEventListener("click", () => {
      const folded = state.foldedStrata;
      if (folded) {
        state.strataFoldDismissedFor = `${folded.year}:${folded.patternDay}`;
        folded.card?.querySelector?.(".sphere-semantic-label-close")?.click?.();
      }
      clearStrataFold(ensureDom());
    });
    chipYear.append(chipYearText, chipYearClose);
    chipMain.append(crumb, chipTitle, chipLine, chipYear);
    // The fold rule lives in a style element the adapter owns,
    // so the label manager's own rendering is never edited —
    // the rule names the one card being folded, and only while
    // it is folded.
    const foldStyle = document.createElement("style");
    foldStyle.id = "dw-strata-fold-style";
    document.head?.appendChild(foldStyle);
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

    // The membrane veil: the day bubble's skin passing the keeper
    // on the way in or out of a day. A sibling of the canvas, under
    // the chip; pointer-transparent, brief, and a plain fade when
    // the keeper prefers reduced motion.
    const membrane = el("div", "dw-membrane");
    membrane.setAttribute("aria-hidden", "true");
    shell.appendChild(membrane);

    // The Patterns door: beside the rebuild dock, in its visual
    // language, never inside it (the dock's five doors are the
    // page's own count). The panel it opens is the adapter's.
    //
    // The row is homed directly before the dock — and kept
    // homed through the boot (sphere experience pass, Nov 27,
    // 2026). The rebuild layer creates the dock on its own
    // clock: when this pass ran first, the row fell back to
    // the instrument shell, whose block flow sets it at the
    // stage's top band, where the Play pill and the
    // selected-day card painted over it and its centre took
    // the pill's taps (hit-tested at 360/390/430: the door's
    // centre returned the Play pill, overlaps 0.73–1.00).
    // The adapter's sheet also gives the row the dock's own
    // flex order, so in the page's flex column it stands in
    // the dock's group, directly before it at the stage's
    // foot. The watcher below re-homes the row whenever the
    // dock arrives or settles elsewhere, and stands down
    // once the row has stood home across three checks.
    const doorRow = el("div", "dw-door-row");
    const patternsDoor = el("button", "dw-door-btn", "Patterns");
    patternsDoor.type = "button";
    patternsDoor.setAttribute("aria-expanded", "false");
    patternsDoor.setAttribute("aria-label", "Patterns — light the days that hold a kind");
    doorRow.appendChild(patternsDoor);
    const homeDoorRow = () => {
      const dockNow = document.querySelector(".sphere-rebuild-dock");
      if (dockNow?.parentElement) {
        if (doorRow.parentElement !== dockNow.parentElement || doorRow.nextSibling !== dockNow) {
          dockNow.parentElement.insertBefore(doorRow, dockNow);
        }
        return doorRow.nextSibling === dockNow;
      }
      if (doorRow.parentElement !== shell) shell.appendChild(doorRow);
      return false;
    };
    homeDoorRow();
    let doorTries = 0;
    let doorStands = 0;
    const doorWatch = window.setInterval(() => {
      doorTries += 1;
      if (homeDoorRow()) doorStands += 1;
      else doorStands = 0;
      if (doorStands >= 3 || doorTries > 60) window.clearInterval(doorWatch);
    }, 500);
    patternsDoor.addEventListener("click", () => {
      if (state.patterns.open) closePatterns();
      else void openPatterns();
    });

    const patternsPanel = el("section", "dw-patterns");
    patternsPanel.hidden = true;
    patternsPanel.setAttribute("role", "dialog");
    patternsPanel.setAttribute("aria-label", "Patterns — what the record holds");
    const pHead = el("header", "dw-ins-head");
    const pKind = el("span", "dw-ins-kind", "Patterns");
    const pClose = el("button", "dw-ins-close", "×");
    pClose.type = "button";
    pClose.setAttribute("aria-label", "Close patterns");
    pHead.append(pKind, pClose);
    const pIntro = el("p", "dw-ins-sub",
      "Pick a kind and every day holding it lights — on the year you face and down the years line. "
      + "Only your own planner record is tracked; the farm reference book is not.");
    const pStanding = el("div", "dw-pattern-standing");
    const pGroups = el("div", "dw-pattern-groups");
    const pResult = el("p", "dw-pattern-result");
    const pDays = el("div", "dw-ins-list");
    const pActions = el("div", "dw-ins-actions");
    patternsPanel.append(pHead, pIntro, pStanding, pGroups, pResult, pDays, pActions);
    document.body.appendChild(patternsPanel);
    pClose.addEventListener("click", () => closePatterns());

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

    // The rooms sheet and the adapter's panels never stand open
    // together.
    const roomsObserver = new MutationObserver(() => {
      if (document.documentElement.classList.contains("armillary-rooms-open")) {
        closeInspector();
        closePatterns();
      }
    });
    roomsObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    state.roomsObserver = roomsObserver;

    state.dom = {
      chip, chipTitle, chipLine, chipYear, chipYearText, foldStyle, back, crumbSteps, membrane,
      patternsDoor, patternsPanel, pStanding, pGroups, pResult, pDays, pActions, doorRow,
      inspector, kind, title, line, sub, list, actions,
    };
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
   * Route an announced selection into the canonical cursor through
   * its own public API — never around it. The sphere UI honours
   * selections that do not move the cursor (face taps land in the
   * UI's own state only); left unrouted, the cursor's readers —
   * this adapter, the Day Details panel — keep showing the old
   * day while the face shows the new one. Routing the selection
   * through the cursor keeps ONE temporal authority: after the
   * move, the cursor-change the cursor itself emits rebuilds this
   * world and every other reader from the same coordinate.
   */
  function routeAnnouncedSelection(announced) {
    const cursor = global.SOFTemporalCursor;
    if (!cursor) {
      // The cursor is established in the page's first deferred
      // phase and can land after a keeper's first selection (the
      // same race the UI bridge's pending handoff guards). Keep
      // the latest intent; the cursor-ready listener routes it.
      state.bridge.pending = announced;
      return false;
    }
    const decision = routeDecision(announced, currentSelection());
    if (decision.action === "none") return true;
    const options = {
      source: "day-world-selection-bridge",
      reason: "keeper-selection",
    };
    try {
      if (decision.action === "pattern-day" && typeof cursor.setPatternDay === "function") {
        cursor.setPatternDay(decision.day, options);
      } else if (decision.action === "civil-date" && typeof cursor.setDate === "function") {
        const date = civilDateForPatternDay(decision.year, decision.day, {
          epochForYear: global.PatternCalendar?.epochForYear,
          remnantFromDate: global.SOFTemporalCoordinate?.remnant13MoonsFromDate,
        });
        if (!date) return false;
        cursor.setDate(date, options);
      } else {
        return false;
      }
    } catch {
      return false;
    }
    return true;
  }

  /*
   * Where the selected day stands against today, from the one
   * temporal authority (PatternCalendar.fromCivilDate — the same
   * call the Sphere model makes for its today position).
   * dayRelation: -1 the selected day is past, 0 it is today,
   * 1 it is ahead; null when either side is outside the count.
   */
  /*
   * Today's place, in the years the records carry. PatternCalendar
   * reports its own ordinal patternYear (1 for the 2026 cycle);
   * the records and the cursor carry the ALIGNMENT year — the
   * anchor date's civil year (2026). The planner derives it the
   * same way (its patternContext reads the anchor date's year, and
   * says why in its own comment). Reading the ordinal instead
   * never matched the cursor's year, so "today" never lit — the
   * state light, the now bead, and same-year overdue all silently
   * missed. Fixed in the Temporal Worlds slice, with the
   * planner's own derivation.
   */
  function todayAlignment(now = new Date()) {
    const pc = global.PatternCalendar;
    let today = null;
    try {
      today = pc?.fromCivilDate ? pc.fromCivilDate({ date: now }) : null;
    } catch { today = null; }
    if (!today) return null;
    const alignmentYear = today.anchorDate instanceof Date
      ? today.anchorDate.getUTCFullYear()
      : today.patternYear;
    return {
      patternYear: Number.isInteger(alignmentYear) ? alignmentYear : null,
      patternDay: today.dayOfPatternYear ?? null,
      nowHour: now.getHours() + now.getMinutes() / 60,
    };
  }

  function todayRelation(selection) {
    const now = new Date();
    const aligned = todayAlignment(now);
    const nowHour = aligned?.nowHour ?? (now.getHours() + now.getMinutes() / 60);
    const todayDay = aligned?.patternDay ?? null;
    const todayYear = aligned?.patternYear ?? null;
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

    // The day bubble: the faint skin the keeper passes through on
    // the way into the day. It stands around the world at every
    // day stage; crossing its membrane (Living ↔ Immersive) plays
    // the threshold — the veil sweep in the DOM and a pulse here.
    const bubble = new THREE.Mesh(
      new THREE.SphereGeometry(1.24, 24, 16),
      new THREE.MeshBasicMaterial({
        color: COLOURS.silverBlue,
        transparent: true,
        opacity: 0.055,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    bubble.position.y = PLINTH_TOP + 0.12;
    bubble.renderOrder = 30;
    group.add(bubble);
    state.bubble = bubble;

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
    state.bubble = null;
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

  function updateCrumb(dom, stage) {
    const current = depthNameForStage(stage);
    for (const step of dom.crumbSteps || []) {
      step.classList.toggle("dw-chip-crumb-now", step.dataset.dwDepth === current);
    }
  }

  /*
   * The fold (Nov 25, 2026 — Aaron, from his phone: the same
   * day stated three times over the Sphere, the Sphere itself
   * behind the furniture). At the day stages the chip and the
   * day-zoom panel both present the selected day, and the
   * temporal strata's selected-year card repeats its Pattern
   * Day a third time. Each fact stands once:
   *
   * - While the day-zoom panel is visible in the same view, it
   *   is the day's statement (civil date, full coordinates, the
   *   day's records), and the chip's title folds away — the
   *   chip keeps its depth crumb, its standing line, and its
   *   step controls. When the panel is not in view, the chip's
   *   title stands as the day's statement, exactly as before.
   * - While the strata's selected-year card stands, its one
   *   fact moves into the chip as the year line, and the card
   *   folds away under a rule in the adapter's own style
   *   element (the label manager's rendering is never edited).
   *   Dismissing the year line dismisses the card through the
   *   card's own close control, and it is not re-folded for
   *   that selection.
   */
  function clearStrataFold(dom) {
    if (dom.foldStyle) dom.foldStyle.textContent = "";
    if (dom.chipYear) dom.chipYear.hidden = true;
    state.foldedStrata = null;
  }

  function foldDayPresentation(dom) {
    const panel = document.getElementById("sphere-day-zoom-panel");
    let panelVisible = false;
    if (panel) {
      const style = getComputedStyle(panel);
      const rect = panel.getBoundingClientRect();
      panelVisible = style.display !== "none" && style.visibility !== "hidden"
        && rect.width > 0 && rect.height > 0
        && rect.bottom > 0 && rect.top < (window.innerHeight || 0);
    }
    dom.chipTitle.hidden = panelVisible;

    const year = state.selection?.patternYear;
    const patternDay = state.selection?.patternDay;
    if (!Number.isInteger(year) || !Number.isInteger(patternDay)
      || state.strataFoldDismissedFor === `${year}:${patternDay}`) {
      clearStrataFold(dom);
      return;
    }
    const card = document.querySelector(
      `.sphere-semantic-label[data-semantic-id="strata-year-${year}"]`
    );
    if (!card) {
      clearStrataFold(dom);
      return;
    }
    state.foldedStrata = { year, patternDay, card };
    dom.chipYearText.textContent = `Pattern Day ${patternDay} · the same day in ${year}`;
    dom.chipYear.hidden = false;
    if (dom.foldStyle) {
      dom.foldStyle.textContent =
        `.sphere-semantic-label[data-semantic-id="strata-year-${year}"]{display:none!important}`;
    }
  }

  function updateChip() {
    const dom = ensureDom();
    const stage = state.stage;
    // A landed notice (an entered year with an empty record) shows
    // on the year stages until it expires — the chip is the
    // adapter's one voice, and an honest empty year must say so.
    const noticeLive = state.notice && performance.now() < state.notice.expiresAt
      && (stage === "year" || stage === "moon" || stage === "years");
    const show = !state.unavailable
      && (stage === "approach" || stage === "living" || stage === "immersive"
        || stage === "years" || noticeLive);
    dom.chip.hidden = !show;
    if (!show) {
      dom.chipTitle.hidden = false;
      clearStrataFold(dom);
      return;
    }
    dom.chip.dataset.dwStage = stage;
    updateCrumb(dom, stage);
    const prevBtn = dom.chip.querySelector("[data-dw-prev]");
    const nextBtn = dom.chip.querySelector("[data-dw-next]");
    if (stage === "years") {
      if (prevBtn) prevBtn.hidden = true;
      if (nextBtn) nextBtn.hidden = true;
      dom.back.hidden = false;
      dom.back.textContent = "Into the year";
      dom.chipTitle.textContent = yearsChipTitle();
      dom.chipLine.textContent = noticeLive ? state.notice.text : yearsChipLine();
      dom.chipTitle.hidden = false;
      clearStrataFold(dom);
      return;
    }
    if (prevBtn) prevBtn.hidden = false;
    if (nextBtn) nextBtn.hidden = false;
    dom.back.textContent = "Back to the year";
    if (noticeLive) {
      dom.chipTitle.textContent = dayTitle(state.view, state.selection);
      dom.chipLine.textContent = state.notice.text;
      dom.back.hidden = false;
      foldDayPresentation(dom);
      return;
    }
    if (state.outside) {
      dom.chipTitle.textContent = "Outside the count";
      dom.chipLine.textContent = "This day stands outside the 364. Its world opens with a later phase.";
      dom.back.hidden = false;
      foldDayPresentation(dom);
      return;
    }
    dom.chipTitle.textContent = dayTitle(state.view, state.selection);
    dom.chipLine.textContent = standingLineFor(stage, state.view || state.selection, state.items.length);
    dom.back.hidden = !(stage === "living" || stage === "immersive");
    foldDayPresentation(dom);
  }

  function yearsChipTitle() {
    const range = state.years.shells.length
      ? state.years.shells.map((shell) => shell.year)
      : yearsLineRange(todayAlignment()?.patternYear ?? null, state.selection?.patternYear ?? null);
    return `The years — ${range.join(" · ")}`;
  }

  /*
   * The same-day readout down the line: for the selected Pattern
   * Day, which years hold something on it and which stand bare.
   * Read from the pattern index (the one planner record) when it
   * has been built; until then, a plain standing line.
   */
  function yearsChipLine() {
    const selection = state.selection;
    const index = state.patterns.index;
    if (!selection || !Number.isInteger(selection.patternDay) || !index) {
      return "The lived year stands lit. The road ahead is the calendar, unrecorded.";
    }
    const day = selection.patternDay;
    const parts = [];
    for (const shell of state.years.shells) {
      const entries = index.byDay.get(`${shell.year}:${day}`) || [];
      if (!entries.length) {
        parts.push(`${shell.year}: bare`);
      } else {
        const symbols = [...new Set(entries.map((entry) => entry.symbol))].join(" ");
        parts.push(`${shell.year}: ${symbols} (${entries.length})`);
      }
    }
    return parts.length
      ? `Pattern Day ${day} down the line — ${parts.join(" · ")}`
      : "The lived year stands lit. The road ahead is the calendar, unrecorded.";
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
    if (state.stage === "years") {
      // From the years line, "back" means stepping into the year
      // the keeper is standing in.
      const year = state.selection?.patternYear ?? todayAlignment()?.patternYear;
      if (Number.isInteger(year)) void enterYear(year);
      return;
    }
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

  /* ── The membrane (day entry) ── */

  /*
   * Crossing between Living Day and Immersive Day passes the day
   * bubble's skin. The threshold is brief and legible: a veil
   * sweep across the stage and a pulse on the bubble itself.
   * Reduced-motion keepers get a plain fade. The world on the far
   * side is Phase B's world, unchanged, standing in front of the
   * keeper — never a shell the keeper is placed inside.
   */
  function playMembrane(direction) {
    state.membrane.lastCrossAt = performance.now();
    state.membrane.direction = direction;
    const veil = state.dom?.membrane;
    if (!veil) return;
    veil.classList.remove("dw-membrane--in", "dw-membrane--out", "dw-membrane--fade");
    void veil.offsetWidth;
    veil.classList.add(reducedMotionQuery.matches
      ? "dw-membrane--fade"
      : (direction === "in" ? "dw-membrane--in" : "dw-membrane--out"));
    setTimeout(() => {
      veil.classList.remove("dw-membrane--in", "dw-membrane--out", "dw-membrane--fade");
    }, 800);
  }

  /* ── The years line ── */

  function clearYearsLine() {
    const years = state.years;
    if (years.group && state.scene) state.scene.remove(years.group);
    if (years.group) disposeObject(years.group);
    years.group = null;
    years.shells = [];
    years.proxies = [];
    years.builtKey = "";
  }

  function shellWordFor(year, todayYear, cursorYear) {
    if (year === todayYear) return "the year you keep";
    if (year === cursorYear) return "you are standing here";
    if (Number.isInteger(todayYear) && year > todayYear) return "the road ahead";
    return "";
  }

  function makeTextSprite(THREE, lines) {
    // The year's plaque (visual sweep, Nov 23, 2026): the numeral
    // used to float bare on the wireframe — the shell's own lines
    // showed through the glyphs and the word beneath was too small
    // to read at phone size. The label now stands on a small dark
    // plaque in the day world's own material language (the dw-chip's
    // near-black ground, a thin brass edge), the year is larger,
    // and the word beneath it is drawn at a size a phone can read.
    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = 152;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 384, 152);
    const plaque = { x: 10, y: 10, w: 364, h: 132, r: 26 };
    ctx.beginPath();
    ctx.roundRect(plaque.x, plaque.y, plaque.w, plaque.h, plaque.r);
    ctx.fillStyle = "rgba(12, 8, 5, 0.85)";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(218, 164, 91, 0.55)";
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(242, 234, 216, 0.98)";
    ctx.font = "600 62px Georgia, serif";
    ctx.fillText(lines[0] || "", 192, lines[1] ? 68 : 92);
    if (lines[1]) {
      ctx.fillStyle = "rgba(230, 189, 123, 0.98)";
      ctx.font = "32px Georgia, serif";
      ctx.fillText(lines[1], 192, 116);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture, transparent: true, depthWrite: false,
    }));
    sprite.scale.set(0.74, 0.293, 1);
    return sprite;
  }

  function makeSymbolSprite(THREE, symbol, count) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 128, 128);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "76px serif";
    ctx.fillText(symbol, 64, 66);
    if (count > 1) {
      ctx.font = "700 42px sans-serif";
      ctx.fillStyle = "#d8a45b";
      ctx.fillText(String(count), 102, 104);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture, transparent: true, depthWrite: false,
    }));
    sprite.scale.set(0.13, 0.13, 1);
    return sprite;
  }

  function yearsBuildKey(range) {
    const litSig = state.patterns.lit.map((lit) => `${lit.year}:${lit.day}`).join(",");
    return [
      range.join(","),
      state.selection?.patternYear ?? "",
      state.selection?.patternDay ?? "",
      state.recordsVersion,
      state.patterns.indexKey,
      litSig,
    ].join("|");
  }

  /*
   * The multitude, schematic: one shell per year — a wire bead
   * carrying its 364 day marks as a ring of points and its 13 moon
   * ticks — standing in a line under the Sphere. A shell is a
   * glyph, not a scene: two point clouds and a wireframe per year,
   * no per-shell world. The lived year stands lit; the road ahead
   * stands dim. Only the entered year is ever fully built — by the
   * Sphere itself, through the cursor.
   */
  function buildYearsLine(context) {
    const THREE = context.THREE || global.THREE;
    if (!THREE || !context.scene) return;
    clearYearsLine();
    state.scene = context.scene;
    const todayYear = todayAlignment()?.patternYear ?? null;
    const cursorYear = state.selection?.patternYear ?? null;
    const range = yearsLineRange(todayYear, cursorYear);
    const geometryApi = global.LivingTimeSphereCalendarGeometry;
    const angleForDay = (day) => {
      const cell = geometryApi?.calendarCell?.(day);
      const degrees = Number(cell?.angle ?? ((day - 0.5) / 364) * 360);
      return (Number.isFinite(degrees) ? degrees : 0) * Math.PI / 180;
    };
    const selectedDay = state.selection?.patternDay;
    const index = state.patterns.index;
    const litByYear = new Map();
    for (const lit of state.patterns.lit) {
      const bucket = litByYear.get(lit.year) || [];
      bucket.push(lit);
      litByYear.set(lit.year, bucket);
    }
    const group = new THREE.Group();
    group.name = "living-time-sphere-years-line";
    const mid = (range.length - 1) / 2;
    const shells = [];
    const proxies = [];
    range.forEach((year, i) => {
      const lived = year === todayYear;
      const ahead = Number.isInteger(todayYear) && year > todayYear;
      const shell = new THREE.Group();
      shell.position.set(
        (i - mid) * SHELL_SPACING,
        SHELL_LINE_Y,
        SHELL_LINE_Z - Math.abs(i - mid) * 0.06
      );
      const wire = new THREE.Mesh(
        new THREE.IcosahedronGeometry(SHELL_RADIUS, 1),
        new THREE.MeshBasicMaterial({
          color: lived ? 0xf2ead8 : 0x8fb6d9,
          wireframe: true,
          transparent: true,
          opacity: lived ? 0.55 : (ahead ? 0.2 : 0.34),
          depthWrite: false,
        })
      );
      shell.add(wire);
      const dayPositions = new Float32Array(364 * 3);
      const tickPositions = [];
      for (let day = 1; day <= 364; day += 1) {
        const angle = angleForDay(day);
        const px = Math.sin(angle) * SHELL_RADIUS;
        const pz = -Math.cos(angle) * SHELL_RADIUS;
        dayPositions[(day - 1) * 3] = px;
        dayPositions[(day - 1) * 3 + 1] = 0;
        dayPositions[(day - 1) * 3 + 2] = pz;
        if ((day - 1) % 28 === 0) tickPositions.push(px, 0.02, pz);
      }
      const dayGeometry = new THREE.BufferGeometry();
      dayGeometry.setAttribute("position", new THREE.BufferAttribute(dayPositions, 3));
      shell.add(new THREE.Points(dayGeometry, new THREE.PointsMaterial({
        color: 0x8fb6d9, size: 0.014, transparent: true,
        opacity: lived ? 0.85 : 0.5, depthWrite: false,
      })));
      const tickGeometry = new THREE.BufferGeometry();
      tickGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(tickPositions), 3));
      shell.add(new THREE.Points(tickGeometry, new THREE.PointsMaterial({
        color: 0xf2ead8, size: 0.03, transparent: true, opacity: 0.8, depthWrite: false,
      })));
      // The selected day's counterpart in this year: ringed, and
      // wearing its symbol when the day holds records here — the
      // bare ring when it doesn't.
      let counterpart = null;
      if (Number.isInteger(selectedDay)) {
        const angle = angleForDay(selectedDay);
        const px = Math.sin(angle) * SHELL_RADIUS;
        const pz = -Math.cos(angle) * SHELL_RADIUS;
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.032, 0.048, 24),
          new THREE.MeshBasicMaterial({
            color: 0xf2ead8, transparent: true, opacity: 0.95,
            side: THREE.DoubleSide, depthWrite: false,
          })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(px, 0.012, pz);
        shell.add(ring);
        const entries = index?.byDay.get(`${year}:${selectedDay}`) || [];
        if (entries.length) {
          const symbolSprite = makeSymbolSprite(THREE, entries[0].symbol, entries.length);
          symbolSprite.position.set(px, 0.1, pz);
          shell.add(symbolSprite);
        }
        counterpart = {
          day: selectedDay,
          hasRecords: entries.length > 0,
          symbol: entries[0]?.symbol || null,
          count: entries.length,
        };
      }
      // Pattern-lit days on this shell: brighter marks in the
      // kind's own colour.
      const litHere = litByYear.get(year) || [];
      if (litHere.length) {
        const positions = new Float32Array(litHere.length * 3);
        const colours = new Float32Array(litHere.length * 3);
        litHere.forEach((lit, j) => {
          const angle = angleForDay(lit.day);
          positions[j * 3] = Math.sin(angle) * SHELL_RADIUS;
          positions[j * 3 + 1] = 0.016;
          positions[j * 3 + 2] = -Math.cos(angle) * SHELL_RADIUS;
          const colour = new THREE.Color(lit.colour);
          colours[j * 3] = colour.r;
          colours[j * 3 + 1] = colour.g;
          colours[j * 3 + 2] = colour.b;
        });
        const litGeometry = new THREE.BufferGeometry();
        litGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        litGeometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
        shell.add(new THREE.Points(litGeometry, new THREE.PointsMaterial({
          size: 0.045, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false,
        })));
      }
      const label = makeTextSprite(THREE, [String(year), shellWordFor(year, todayYear, cursorYear)]);
      label.position.set(0, SHELL_RADIUS + 0.31, 0);
      shell.add(label);
      const proxy = new THREE.Mesh(
        new THREE.SphereGeometry(SHELL_RADIUS + 0.09, 10, 8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      proxy.userData.yearsLine = { kind: "year-shell", year };
      shell.add(proxy);
      proxies.push(proxy);
      group.add(shell);
      const supported = supportedYearRange();
      shells.push({
        year, lived, ahead,
        standingHere: year === cursorYear,
        enterable: !supported || (year >= supported.min && year <= supported.max),
        counterpart,
        litCount: litHere.length,
        group: shell,
      });
    });
    group.visible = false;
    context.scene.add(group);
    state.years.group = group;
    state.years.shells = shells;
    state.years.proxies = proxies;
    state.years.builtKey = yearsBuildKey(range);
  }

  function ensureYearsLine(context) {
    const range = yearsLineRange(
      todayAlignment()?.patternYear ?? null,
      state.selection?.patternYear ?? null
    );
    if (!state.years.group || state.years.builtKey !== yearsBuildKey(range)) {
      buildYearsLine(context);
    }
  }

  /*
   * The years the Sphere's face can stand in: the alignment
   * ledger's study range (AlignmentLedgerData — 2014–2027 in the
   * current data), which the sphere UI clamps every cursor year
   * to. The calendar's arithmetic runs further, and the record
   * can hold those years — but the face cannot stand there yet,
   * and this slice will not pretend otherwise. Read live, so when
   * the ledger's range grows, entry grows with it.
   */
  function supportedYearRange() {
    try {
      const years = global.AlignmentLedgerData?.listSupportedYears?.();
      if (!Array.isArray(years) || !years.length) return null;
      const clean = years.map(Number).filter(Number.isFinite);
      if (!clean.length) return null;
      return { min: Math.min(...clean), max: Math.max(...clean) };
    } catch {
      return null;
    }
  }

  function beyondRangeNotice(year, supported) {
    return {
      text: `${year} — its calendar is real, but the alignment ledger studies `
        + `${supported.min}–${supported.max}, so the face cannot stand in ${year} yet. `
        + "Its record still counts in Patterns.",
      expiresAt: performance.now() + 15000,
    };
  }

  /*
   * Entering a year: the cursor moves (the one temporal
   * authority — the selection bridge's own verified route), the
   * camera flies back to Year View distance, and the Sphere shows
   * that year in full. A year whose record is empty says so. A
   * year beyond the ledger's study range is not entered — the
   * face would clamp it to a different year, and landing
   * somewhere other than where the keeper pointed is a lie.
   */
  async function enterYear(year) {
    if (!Number.isInteger(year)) return;
    const supported = supportedYearRange();
    if (supported && (year < supported.min || year > supported.max)) {
      state.notice = beyondRangeNotice(year, supported);
      updateChip();
      return;
    }
    const selection = state.selection || currentSelection();
    const today = todayAlignment();
    const day = selection && Number.isInteger(selection.patternDay)
      ? selection.patternDay
      : (today?.patternDay || 1);
    const records = await recordsForYear(year);
    routeAnnouncedSelection({ patternDay: day, patternYear: year });
    global.LivingTimeSphereRenderer3d?.focusPatternDay?.(day, {
      distance: 3.45,
      animated: !reducedMotionQuery.matches,
    });
    state.notice = records.length
      ? null
      : {
          text: `${year} — the calendar is real; nothing is recorded there yet.`,
          expiresAt: performance.now() + 15000,
        };
    updateChip();
  }

  /* ── Pattern tracking ── */

  function patternYears() {
    const years = new Set(yearsLineRange(
      todayAlignment()?.patternYear ?? null,
      state.selection?.patternYear ?? null
    ));
    if (Number.isInteger(state.selection?.patternYear)) years.add(state.selection.patternYear);
    return [...years].sort((a, b) => a - b);
  }

  /*
   * The pattern index over the years on the line, from the ONE
   * planner record (plansForYears). Cached against the records
   * version, the year set, and today's place (overdue depends on
   * it). Nothing else is read; nothing is manufactured.
   */
  async function ensurePatternIndex() {
    const planner = global.CodexLivingPlanner;
    if (!planner?.plansForYears || state.patterns.loading) return state.patterns.index;
    const today = todayAlignment();
    const years = patternYears();
    const key = `${state.recordsVersion}|${years.join(",")}|${today?.patternYear}:${today?.patternDay}`;
    if (state.patterns.index && state.patterns.indexKey === key) return state.patterns.index;
    state.patterns.loading = true;
    try {
      const records = await planner.plansForYears(years);
      state.patterns.index = buildPatternIndex(records, global.CodexLifeAtlasScheduling, today);
      state.patterns.indexKey = key;
      state.years.builtKey = "";
      refreshPatternLighting();
      if (state.patterns.open) renderPatternsPanel();
      updateChip();
    } catch {
      // The index keeps its last honest state; the panel says the
      // record could not be read when it has nothing.
    } finally {
      state.patterns.loading = false;
    }
    return state.patterns.index;
  }

  function refreshPatternLighting() {
    const patterns = state.patterns;
    patterns.lit = patterns.index ? litDaysFor(patterns.index, patterns.filter) : [];
    patterns.overlayKey = ""; // force the overlay to re-read the lit set
    if (state.lastContext) buildPatternOverlay(state.lastContext);
    state.years.builtKey = "";
    if (patterns.open) renderPatternResult();
    updateChip();
  }

  function clearPatternOverlay() {
    if (state.patterns.overlayGroup && state.scene) {
      state.scene.remove(state.patterns.overlayGroup);
    }
    if (state.patterns.overlayGroup) disposeObject(state.patterns.overlayGroup);
    state.patterns.overlayGroup = null;
    state.patterns.overlayKey = "";
  }

  /*
   * The lit days on the faced year: a symbol field over the disc
   * at the record layer's own marker positions, each day ringed
   * and wearing its kind's symbol in its kind's colour — the same
   * atlas-points pattern the record extension renders with, one
   * tile per symbol plus a ring tile.
   */
  function buildPatternOverlay(context) {
    const THREE = context.THREE || global.THREE;
    if (!THREE || !context.scene) return;
    const cursorYear = state.selection?.patternYear;
    const litHere = state.patterns.lit.filter((lit) => lit.year === cursorYear);
    const key = `${cursorYear}|${litHere.map((lit) => `${lit.day}:${lit.primarySymbol}:${lit.count}`).join(",")}`;
    if (state.patterns.overlayGroup && state.patterns.overlayKey === key) return;
    clearPatternOverlay();
    if (!litHere.length) return;
    const geometryApi = global.LivingTimeSphereCalendarGeometry;
    if (!geometryApi?.calendarCell) return;
    const patternRing = Number(geometryApi.getPatternRingRadius?.()) || 0.70;
    const symbols = [...new Set(litHere.map((lit) => lit.primarySymbol))];
    const tile = 96;
    const columns = symbols.length + 1; // the last tile is the ring
    const canvas = document.createElement("canvas");
    canvas.width = tile * columns;
    canvas.height = tile;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = "62px serif";
    symbols.forEach((symbol, i) => {
      ctx.fillText(symbol, tile * i + tile / 2, tile / 2 + 4);
    });
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(tile * symbols.length + tile / 2, tile / 2, 33, 0, Math.PI * 2);
    ctx.stroke();
    const texture = new THREE.CanvasTexture(canvas);
    const pixelRatio = context.renderer?.getPixelRatio?.() || global.devicePixelRatio || 1;
    const makePoints = (symbolIndexFor, size) => {
      const count = litHere.length;
      const positions = new Float32Array(count * 3);
      const colours = new Float32Array(count * 3);
      const indices = new Float32Array(count);
      litHere.forEach((lit, i) => {
        const cell = geometryApi.calendarDisplayCell?.(lit.day) || geometryApi.calendarCell(lit.day);
        const angle = Number(cell?.angle ?? 0) * Math.PI / 180;
        const radial = Number(cell?.scheduleRadialFactor ?? cell?.radialFactor ?? 1);
        const radius = patternRing * radial;
        positions[i * 3] = Math.sin(angle) * radius;
        positions[i * 3 + 1] = 0.05;
        positions[i * 3 + 2] = -Math.cos(angle) * radius;
        const colour = new THREE.Color(symbolIndexFor.ring ? 0xf2ead8 : lit.colour);
        colours[i * 3] = colour.r;
        colours[i * 3 + 1] = colour.g;
        colours[i * 3 + 2] = colour.b;
        indices[i] = symbolIndexFor.ring ? symbols.length : symbols.indexOf(lit.primarySymbol);
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("aColor", new THREE.BufferAttribute(colours, 3));
      geometry.setAttribute("aSymbolIndex", new THREE.BufferAttribute(indices, 1));
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uAtlas: { value: texture },
          uColumns: { value: columns },
          uPixelRatio: { value: pixelRatio },
          uPointSize: { value: size },
          uOpacity: { value: 0.95 },
        },
        vertexShader: `
          attribute vec3 aColor;
          attribute float aSymbolIndex;
          uniform float uPixelRatio;
          uniform float uPointSize;
          varying vec3 vColor;
          varying float vSymbolIndex;
          void main() {
            vColor = aColor;
            vSymbolIndex = aSymbolIndex;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = uPointSize * uPixelRatio;
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          uniform sampler2D uAtlas;
          uniform float uColumns;
          uniform float uOpacity;
          varying vec3 vColor;
          varying float vSymbolIndex;
          void main() {
            float column = mod(vSymbolIndex, uColumns);
            vec2 uv = vec2((column + gl_PointCoord.x) / uColumns, gl_PointCoord.y);
            vec4 texel = texture2D(uAtlas, uv);
            float alpha = texel.a * uOpacity;
            if (alpha < 0.03) discard;
            gl_FragColor = vec4(vColor, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
      });
      const points = new THREE.Points(geometry, material);
      points.renderOrder = 19;
      points.frustumCulled = false;
      return points;
    };
    const group = new THREE.Group();
    group.name = "living-time-sphere-pattern-overlay";
    group.add(makePoints({ ring: true }, 46));
    group.add(makePoints({ ring: false }, 30));
    context.scene.add(group);
    state.scene = context.scene;
    state.patterns.overlayGroup = group;
    state.patterns.overlayKey = key;
  }

  function enterPatternDay(year, day) {
    const supported = supportedYearRange();
    if (supported && (year < supported.min || year > supported.max)) {
      state.notice = beyondRangeNotice(year, supported);
      closePatterns();
      updateChip();
      return;
    }
    routeAnnouncedSelection({ patternDay: day, patternYear: year });
    global.LivingTimeSphereRenderer3d?.focusPatternDay?.(day, {
      distance: 1.45,
      animated: !reducedMotionQuery.matches,
    });
    closePatterns();
  }

  function setPatternFilter(patch) {
    Object.assign(state.patterns.filter, patch);
    refreshPatternLighting();
    renderPatternsPanel();
  }

  function renderPatternResult() {
    const dom = ensureDom();
    const { filter, lit } = state.patterns;
    dom.pDays.replaceChildren();
    dom.pActions.replaceChildren();
    const yearsButton = el("button", "dw-ins-btn", "Stand on the years line");
    yearsButton.type = "button";
    yearsButton.addEventListener("click", () => {
      closePatterns();
      global.LivingTimeSphereCamera?.moveTo?.({
        dist: 5.2,
        animated: !reducedMotionQuery.matches,
        durationMs: 700,
      });
    });
    const clearButton = el("button", "dw-ins-btn", "Clear the lighting");
    clearButton.type = "button";
    clearButton.addEventListener("click", () => {
      setPatternFilter({ categories: null, recurringOnly: false, label: null });
    });
    dom.pActions.append(yearsButton, clearButton);
    if (!filter.label) {
      dom.pResult.textContent = "Nothing is lit yet. Pick a kind above and its days will light — here, on the Sphere, and down the years line.";
      return;
    }
    if (!lit.length) {
      dom.pResult.textContent = `No days hold ${filter.label} in the years on the line. Nothing is lit, because nothing is recorded.`;
      return;
    }
    const totalRecords = lit.reduce((sum, litDay) => sum + litDay.count, 0);
    dom.pResult.textContent = `${filter.label} — ${lit.length} ${lit.length === 1 ? "day holds" : "days hold"} it `
      + `(${totalRecords} ${totalRecords === 1 ? "record" : "records"} — a count of days, nothing more claimed). `
      + "Days holding the same kind are the same kind, not the same thing.";
    for (const litDay of lit.slice(0, 24)) {
      const moon = Math.floor((litDay.day - 1) / 28) + 1;
      const moonDay = ((litDay.day - 1) % 28) + 1;
      const row = el("button", "dw-ins-row",
        `${litDay.primarySymbol} ${litDay.year} · Moon ${moon} · Day ${moonDay} — ${litDay.entries[0].title}`
        + (litDay.count > 1 ? ` (+${litDay.count - 1} more)` : ""));
      row.type = "button";
      row.addEventListener("click", () => enterPatternDay(litDay.year, litDay.day));
      dom.pDays.appendChild(row);
    }
    if (lit.length > 24) {
      dom.pDays.appendChild(el("p", "dw-ins-sub", `…and ${lit.length - 24} more days.`));
    }
  }

  function renderPatternsPanel() {
    const dom = ensureDom();
    const index = state.patterns.index;
    dom.pStanding.replaceChildren();
    for (const [value, label] of [
      ["any", "Any standing"], ["open", "Open"], ["completed", "Completed"], ["overdue", "Overdue"],
    ]) {
      const button = el("button", "dw-pattern-standing-btn", label);
      button.type = "button";
      button.setAttribute("aria-pressed", String(state.patterns.filter.standing === value));
      button.addEventListener("click", () => {
        state.patterns.filter.standing = value;
        refreshPatternLighting();
        renderPatternsPanel();
      });
      dom.pStanding.appendChild(button);
    }
    dom.pGroups.replaceChildren();
    if (!index) {
      dom.pGroups.appendChild(el("p", "dw-ins-sub",
        state.patterns.loading ? "Reading the record…" : "The record could not be read just now."));
      renderPatternResult();
      return;
    }
    const counts = dayCountsByCategory(index);
    const activeCategories = state.patterns.filter.categories;
    for (const group of PATTERN_GROUPS) {
      const head = el("div", "dw-pattern-group-head");
      const groupActive = activeCategories
        && group.categories.every((category) => activeCategories.has(category))
        && activeCategories.size === group.categories.length;
      const allButton = el("button", "dw-pattern-kind dw-pattern-kind-all", `${group.label} — all`);
      allButton.type = "button";
      allButton.setAttribute("aria-pressed", String(Boolean(groupActive)));
      allButton.addEventListener("click", () => {
        setPatternFilter({
          categories: new Set(group.categories),
          recurringOnly: false,
          label: `all of ${group.label.toLowerCase()}`,
        });
      });
      head.appendChild(allButton);
      dom.pGroups.appendChild(head);
      for (const category of group.categories) {
        const days = counts.get(category) || 0;
        const row = el("button", "dw-pattern-kind",
          `${SYMBOL_BY_CATEGORY[category]} ${KIND_NAMES[category]} — ${days} ${days === 1 ? "day" : "days"}`);
        row.type = "button";
        if (!days) row.classList.add("dw-pattern-kind-empty");
        row.setAttribute("aria-pressed", String(Boolean(
          activeCategories && activeCategories.size === 1 && activeCategories.has(category)
        )));
        row.addEventListener("click", () => {
          setPatternFilter({
            categories: new Set([category]),
            recurringOnly: false,
            label: KIND_NAMES[category].toLowerCase(),
          });
        });
        dom.pGroups.appendChild(row);
      }
    }
    // Documented ties: a record's own stored recurrence, named as
    // what it is. Nothing else is drawn as a tie — no live
    // relations source is wired into the Sphere session, and
    // drawing one would manufacture it (see the build note).
    const tiesHead = el("div", "dw-pattern-group-head");
    tiesHead.appendChild(el("span", "dw-pattern-ties-note",
      "Documented ties — a record that repeats carries its recurrence written on itself. "
      + "Lighting those days shows where recorded recurrences stand; it draws no ties between separate records."));
    dom.pGroups.appendChild(tiesHead);
    let recurringDays = 0;
    for (const entries of index.byDay.values()) {
      if (entries.some((entry) => entry.recurrence)) recurringDays += 1;
    }
    const recurringRow = el("button", "dw-pattern-kind",
      `↻ Repeating, as recorded — ${recurringDays} ${recurringDays === 1 ? "day" : "days"}`);
    recurringRow.type = "button";
    if (!recurringDays) recurringRow.classList.add("dw-pattern-kind-empty");
    recurringRow.setAttribute("aria-pressed", String(state.patterns.filter.recurringOnly));
    recurringRow.addEventListener("click", () => {
      setPatternFilter({
        categories: null,
        recurringOnly: true,
        label: "a recorded recurrence",
      });
    });
    dom.pGroups.appendChild(recurringRow);
    renderPatternResult();
  }

  async function openPatterns() {
    const dom = ensureDom();
    closeInspector();
    state.patterns.open = true;
    dom.patternsPanel.hidden = false;
    dom.patternsDoor.setAttribute("aria-expanded", "true");
    renderPatternsPanel();
    await ensurePatternIndex();
  }

  function closePatterns() {
    state.patterns.open = false;
    if (state.dom) {
      state.dom.patternsPanel.hidden = true;
      state.dom.patternsDoor.setAttribute("aria-expanded", "false");
    }
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
        // The bubble breathes with the crossing: a pulse of light
        // on its skin for a breath after the membrane is passed.
        if (state.bubble) {
          const sinceCross = now - state.membrane.lastCrossAt;
          const pulse = sinceCross >= 0 && sinceCross < 650 ? 1 - sinceCross / 650 : 0;
          state.bubble.material.opacity = 0.055 + 0.17 * pulse;
          if (pulse > 0) {
            if (typeof context.requestRender === "function") context.requestRender();
            else global.LivingTimeSphereAnimation?.markDirty?.();
          }
        }
      }
      if (stage !== state.stage) {
        const wasInDay = state.stage === "living" || state.stage === "immersive";
        const isInDay = stage === "living" || stage === "immersive";
        // The membrane: Living ↔ Immersive is the day bubble's
        // skin passing the keeper, in or out.
        if (state.stage === "living" && stage === "immersive") playMembrane("in");
        if (state.stage === "immersive" && stage === "living") playMembrane("out");
        state.stage = stage;
        if (isInDay) state.frameNudgePending = true;
        if (!isInDay && wasInDay) maybeRestoreCentre();
        if (stage === "years") void ensurePatternIndex();
        updateChip();
      }
      // The years line: built only while it can be seen, faded at
      // its stage edge, a schematic — never a second scene.
      {
        const targetFade = stage === "years" ? 1 : 0;
        const years = state.years;
        if (reducedMotionQuery.matches || context.motionMode === "still") {
          years.fade = targetFade;
        } else if (years.fade !== targetFade) {
          const step = 1 - Math.exp(-dt / 160);
          years.fade += (targetFade - years.fade) * step;
          if (Math.abs(targetFade - years.fade) < 0.01) years.fade = targetFade;
          if (typeof context.requestRender === "function") context.requestRender();
          else global.LivingTimeSphereAnimation?.markDirty?.();
        }
        if (stage === "years") ensureYearsLine(context);
        if (years.group) {
          // The line keeps the view's front: the group turns with
          // the camera's azimuth, so the beads always stand across
          // the front of the frame, never behind the instrument.
          const theta = global.LivingTimeSphereCamera?.getState?.()?.theta;
          if (Number.isFinite(theta)) years.group.rotation.y = theta;
          years.group.visible = years.fade > 0.01;
          if (years.group.visible) {
            years.group.traverse((node) => {
              if (!node.material || !("opacity" in node.material)) return;
              if (node.userData.baseOpacity == null) {
                node.userData.baseOpacity = node.material.opacity;
              }
              node.material.opacity = node.userData.baseOpacity * years.fade;
            });
          }
        }
      }
      // The pattern overlay follows the lit set and the faced year.
      if (state.patterns.index) buildPatternOverlay(context);
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
        // Selection bridge backstop. The selectionchange listener
        // routes announced selections at once, but a few honoured
        // paths announce nothing (returning to Today through a
        // view-mode switch changes the UI's day silently), and
        // temporal playback's steps are deliberately not routed
        // one by one. The heal watches the UI's PUBLIC state: when
        // its honoured day has changed since the last look and
        // then held still — playback stopped, cursor standing
        // inside the count, and a keeper signal seen since the
        // cursor stood up — route that day into the cursor too.
        // The heal displays nothing; the chip keeps reading the
        // cursor alone.
        const bridge = state.bridge;
        if (live && bridge.cursorReadyAt === 0) {
          bridge.cursorReadyAt = now;
        }
        const uiState = global.LivingTimeSphereUi?.getState?.();
        if (uiState) {
          const uiDay = Number(uiState.selectedDayOfYear);
          const uiYear = Number(uiState.year);
          if (Number.isInteger(uiDay) && uiDay >= 1 && uiDay <= 364 && Number.isInteger(uiYear)) {
            if (!bridge.lastUiSelection
              || bridge.lastUiSelection.day !== uiDay
              || bridge.lastUiSelection.year !== uiYear) {
              if (bridge.lastUiSelection) bridge.signalAt = now;
              bridge.lastUiSelection = { day: uiDay, year: uiYear };
              bridge.uiStableHeals = 0;
            } else {
              bridge.uiStableHeals += 1;
              if (bridge.uiStableHeals >= 1
                && bridge.signalAt > 0
                && bridge.cursorReadyAt > 0
                && !uiState.temporalPlaybackActive
                && live
                && !live.isOutsideCount
                && Number.isInteger(live.patternDay)
                && (live.patternDay !== uiDay || live.patternYear !== uiYear)) {
                routeAnnouncedSelection({ patternDay: uiDay, patternYear: uiYear });
              }
            }
          }
        }
      }
    },

    pick(context) {
      // On the years line, a touched shell is entered: the cursor
      // moves to that year and the Sphere builds it in full.
      if (state.stage === "years" && state.years.proxies.length) {
        const raycaster = context.raycaster;
        if (raycaster?.intersectObjects) {
          const shellHits = raycaster.intersectObjects(state.years.proxies, false);
          if (shellHits.length) {
            const year = shellHits[0].object.userData.yearsLine?.year;
            if (Number.isInteger(year)) {
              void enterYear(year);
              const elements = shellHits[0].object.matrixWorld?.elements;
              return {
                handled: true,
                type: "years-line-enter",
                label: `Year ${year}`,
                position: elements
                  ? { x: elements[12], y: elements[13], z: elements[14] }
                  : { x: 0, y: 0, z: 0 },
                temporal: {
                  patternYear: year,
                  patternDay: state.selection?.patternDay,
                },
                payload: { year },
              };
            }
          }
        }
      }
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
      clearYearsLine();
      clearPatternOverlay();
      state.roomsObserver?.disconnect?.();
      state.roomsObserver = null;
      state.dom?.chip?.remove?.();
      state.dom?.inspector?.remove?.();
      state.dom?.membrane?.remove?.();
      state.dom?.patternsPanel?.remove?.();
      state.dom?.doorRow?.remove?.();
      state.dom = null;
    },
  };

  global.LivingTimeSphereExtensionHost.register(extension);

  global.addEventListener("sof:life-atlas-records-changed", (event) => {
    const ownWrite = event?.detail?.source === "day-world-adapter";
    if (!ownWrite) {
      state.recordsVersion += 1;
      state.yearCache = { year: null, records: null };
    }
    // The pattern index is keyed to the records version; a change
    // anywhere retires it, and an open panel re-reads the record.
    // (Our own write already bumped the version in
    // dispatchRecordsChanged.)
    state.patterns.index = null;
    state.patterns.indexKey = "";
    state.years.builtKey = "";
    if (state.patterns.open) void ensurePatternIndex();
    if (state.lastContext) void rebuild(state.lastContext, ownWrite);
  });
  global.addEventListener("sof:temporal-cursor-change", () => {
    if (state.lastContext) void rebuild(state.lastContext);
  });
  // The cursor is established in the page's first deferred phase,
  // which can land after this adapter mounts. Its ready event is
  // the signal to build the first world.
  global.addEventListener("sof:temporal-cursor-ready", () => {
    state.bridge.cursorReadyAt = performance.now();
    // A selection announced before the cursor existed is handed
    // to it now — the keeper's latest intent wins, the same rule
    // the sphere UI's own cursor bridge keeps.
    if (state.bridge.pending) {
      const pending = state.bridge.pending;
      state.bridge.pending = null;
      routeAnnouncedSelection(pending);
    }
    if (state.lastContext) void rebuild(state.lastContext, true);
  });
  // The selection bridge. Every honoured selection change in the
  // sphere UI ends in its selection flush, which announces the day
  // it settled on through livingtime:selectionchange — face taps,
  // marker picks, the public selectDay the workbench and renderer
  // call, history restores. Route each announcement into the
  // canonical cursor so the cursor's readers agree with the face.
  // Announcements that merely echo the cursor (its own bridge
  // applying a cursor move to the UI) decide to "none" inside the
  // router, so this cannot loop. Temporal playback is the one
  // skip: its steps are the lens playing over the face, not a
  // settled selection — the render heal routes the day playback
  // comes to rest on.
  global.addEventListener("livingtime:selectionchange", (event) => {
    const detail = event?.detail || {};
    if (detail.source === "temporal-playback") return;
    const day = Number(detail.selectedDayOfYear);
    if (!Number.isInteger(day) || day < 1 || day > 364) return;
    const year = Number(detail.year);
    state.bridge.signalAt = performance.now();
    routeAnnouncedSelection({
      patternDay: day,
      patternYear: Number.isInteger(year) ? year : null,
    });
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
