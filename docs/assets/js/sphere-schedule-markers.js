/*
 * Schedule markers on the Calendar Atlas grid — Aaron's ruling,
 * Thu Nov 26, 2026, 22:57 PST: "For the scheduling. There is a
 * grid down below the day numbers. That can hold a good amount
 * of small emoji like holographic markers resembling whatever
 * it is you are scheduling. There can be multiple emoji for a
 * day if multiple things are scheduled. Would have to be small
 * and detailed in a way someone can see them."
 *
 * What this layer does, and all it does:
 *
 *   1. Under the day number of every day cell in the Calendar
 *      Atlas grid (#calendar-atlas-grid, rendered by the
 *      protected calendar workbench), it stands one small
 *      holographic marker per thing the keeper has scheduled
 *      on that day — as many as the day holds, wrapping in a
 *      tidy row. A day with nothing scheduled shows nothing.
 *
 *   2. It frees the Calendar Atlas popup (#calendar-atlas-modal)
 *      from the rebuilt page's translated day sheet. In the
 *      rebuilt DOM the modal sits inside
 *      aside.sphere-sidebar.sphere-sheet, which carries a
 *      transform — and a transformed ancestor becomes the
 *      containing block for fixed descendants, so the modal's
 *      own position:fixed inset:0 anchored to the sheet
 *      (translated ~730px down) instead of the viewport, and
 *      the dialog opened with its top at ~815px on an 844px
 *      screen: off the screen, as Aaron found. Moving the
 *      modal to <body> — where its stylesheet always assumed
 *      it lived — restores the fit its CSS already describes.
 *      The workbench finds the modal by id; nothing else about
 *      it changes.
 *
 * The data is the keeper's own Living Planner record, read
 * through the same public road the workbench itself reads
 * (CodexLivingPlanner.plansForYear). This layer is READ-ONLY:
 * it creates, alters, and deletes no record, writes no storage,
 * and keeps no store of its own. Only the keeper's own device
 * ever sees their markers; a visitor with no record sees the
 * grid exactly as the workbench renders it.
 *
 * No protected file is touched: the workbench renders the
 * cells, this layer decorates them, and the modal move is a
 * DOM relocation by this companion module — the protected
 * page and its stylesheets stand as they were.
 */
(function (global) {
  "use strict";

  /* ---------------------------------------------------------------
   * The marker choice — pure, and pinned by tests.
   *
   * Order, most specific first:
   *   1. The keeper's own symbol, when the record carries a real
   *      emoji (the planner's symbol picker offers emoji; its
   *      geometric defaults do not count — they fall through).
   *   2. A plain word in the item's own title (moon → 🌙,
   *      fix → 🔧, plant → 🌱…).
   *   3. The item's kind (category), from the planner's own
   *      category list.
   *   4. One sensible default: ✨.
   * --------------------------------------------------------------- */

  var MAX_MARKERS = 10;
  var DEFAULT_MARKER = "✨";

  var PICTOGRAPH = /\p{Extended_Pictographic}/u;

  function recordSymbol(record) {
    var planner = (record && record.payload && record.payload.planner) || {};
    var symbol = planner.symbol || (record && record.payload && record.payload.symbol) || "";
    return String(symbol || "").trim();
  }

  function recordCategory(record) {
    var planner = (record && record.payload && record.payload.planner) || {};
    return String(planner.category || (record && record.subtype) || "event").toLowerCase();
  }

  var CATEGORY_MARKERS = Object.freeze({
    task: "✅", event: "📅", reminder: "⏰", growing: "🌿",
    farming: "🚜", planting: "🌱", harvest: "🌾", watering: "💧",
    livestock: "🐄", maintenance: "🔧", seasonal: "🍂", practice: "🧘",
    project: "📐", meeting: "👥", school: "🎓", health: "❤️",
    finance: "💰", observation: "🔭", home: "🏠", family: "👪",
    pets: "🐾", food: "🍽️", shopping: "🛒", vehicle: "🚗",
    construction: "🏗️", coding: "💻", writing: "✍️", research: "🔬",
    creative: "🎨", cleaning: "🧹", appointment: "📋", community: "🤝",
    camping: "⛺", fieldwork: "🥾", travel: "✈️", milestone: "⭐"
  });

  /* Plain words a keeper actually writes, matched on word
   * boundaries against the item's own title. */
  var TITLE_MARKERS = Object.freeze([
    [/\bmoons?\b/, "🌙"],
    [/\bstars?\b/, "⭐"],
    [/\bsun\b|sunrise|sunset/, "☀️"],
    [/\b(rain|storm|weather)\b/, "🌦️"],
    [/\b(leaves|leaf)\b/, "🍃"],
    [/\b(books?|read|reading|story|stories)\b/, "📖"],
    [/\b(plants?|planting|seeds?|sow|sowing)\b/, "🌱"],
    [/\bgarden(ing)?\b/, "🌿"],
    [/\btrees?|orchard\b/, "🌳"],
    [/\bharvest\b/, "🌾"],
    [/\bwater(ing)?\b/, "💧"],
    [/\bfire\b|bonfire\b/, "🔥"],
    [/\b(fix|repair|tools?|build|mend)\b/, "🔧"],
    [/\bheart\b/, "❤️"],
    [/\b(doctors?|dentist|clinic|health)\b/, "🩺"],
    [/\bwrite|writing|journal\b/, "✍️"],
    [/\bmusic|songs?|sing\b/, "🎵"],
    [/\b(art|paint|painting|draw|drawing)\b/, "🎨"],
    [/\b(cook|cooking|bake|baking|meal|dinner|lunch|breakfast|food)\b/, "🍳"],
    [/\b(birthday|cake)\b/, "🎂"],
    [/\b(party|celebration|celebrate)\b/, "🎉"],
    [/\bcandle\b|memorial\b/, "🕯️"],
    [/\b(money|pay|bills?|bank|budget|finance)\b/, "💰"],
    [/\b(cars?|truck|drive|driving|oil change)\b/, "🚗"],
    [/\b(call|phone)\b/, "📞"],
    [/\b(mail|letter|message)\b/, "✉️"],
    [/\b(photo|photos|picture|pictures)\b/, "📷"],
    [/\b(video|film|movie)\b/, "🎥"],
    [/\b(school|class|learn|learning|study|lesson)\b/, "🎓"],
    [/\b(meet|meeting|visit|visiting)\b/, "👥"],
    [/\b(travel|trip|flight|fly|drive home)\b/, "✈️"],
    [/\bcamp(ing)?\b/, "⛺"],
    [/\bfish(ing)?\b/, "🎣"],
    [/\b(hike|hiking|walk|walking|fieldwork)\b/, "🥾"],
    [/\b(shop|shopping|store|buy|groceries|errands?)\b/, "🛒"],
    [/\b(package|delivery|deliver)\b/, "📦"],
    [/\b(dogs?|pupp(y|ies))\b/, "🐶"],
    [/\bcats?\b/, "🐱"],
    [/\b(chickens?|hens?|eggs?)\b/, "🐓"],
    [/\b(cows?|cattle|goats?|livestock)\b/, "🐄"],
    [/\b(bees?|hives?|honey)\b/, "🐝"],
    [/\b(clean|cleaning|laundry|dishes)\b/, "🧹"],
    [/\b(code|coding|computer|website|app)\b/, "💻"],
    [/\bwork\b/, "💼"]
  ]);

  function markerForRecord(record) {
    var symbol = recordSymbol(record);
    if (symbol && PICTOGRAPH.test(symbol)) return symbol;

    var title = String((record && record.title) || "").toLowerCase();
    if (title) {
      for (var i = 0; i < TITLE_MARKERS.length; i++) {
        if (TITLE_MARKERS[i][0].test(title)) return TITLE_MARKERS[i][1];
      }
    }

    return CATEGORY_MARKERS[recordCategory(record)] || DEFAULT_MARKER;
  }

  /* One day's markers: one per scheduled thing, up to
   * MAX_MARKERS standing, the rest gathered into the overflow
   * count (the row stays small enough to read). */
  function markersForDay(records) {
    var list = Array.isArray(records) ? records : [];
    var shown = list.slice(0, MAX_MARKERS).map(function (record) {
      return {
        emoji: markerForRecord(record),
        title: String((record && record.title) || "Planned item")
      };
    });
    return { markers: shown, overflow: Math.max(0, list.length - MAX_MARKERS) };
  }

  /* Group a year's planner records by pattern day. Records
   * whose temporal coordinate names another year, or no day,
   * never land on this grid. */
  function groupPlansByDay(records, year) {
    var byDay = new Map();
    (Array.isArray(records) ? records : []).forEach(function (record) {
      var temporal = (record && record.temporal) || {};
      if (Number(temporal.patternYear) !== Number(year)) return;
      var day = Number(temporal.patternDay);
      if (!Number.isFinite(day) || day < 1 || day > 364) return;
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(record);
    });
    return byDay;
  }

  var core = Object.freeze({
    MAX_MARKERS: MAX_MARKERS,
    DEFAULT_MARKER: DEFAULT_MARKER,
    CATEGORY_MARKERS: CATEGORY_MARKERS,
    markerForRecord: markerForRecord,
    markersForDay: markersForDay,
    groupPlansByDay: groupPlansByDay
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = core;
  }
  global.SphereScheduleMarkers = core;

  /* ---------------------------------------------------------------
   * Browser layer — decoration and the modal freeing. Guarded so
   * importing this file in a test run touches no DOM.
   * --------------------------------------------------------------- */
  if (typeof document === "undefined" || typeof window === "undefined") return;

  var recordsByYear = new Map(); /* year -> Promise<records[]> */
  var groupsByKey = new Map();   /* "year:day" -> records[] */
  var decorateQueued = false;

  function currentYear() {
    try {
      var year = Number(global.LivingTimeSphereUi?.getState?.()?.year);
      if (Number.isFinite(year) && year > 0) return year;
    } catch (error) { /* fall through to the civil year */ }
    return new Date().getFullYear();
  }

  function loadYear(year) {
    if (!recordsByYear.has(year)) {
      var api = global.CodexLivingPlanner;
      var promise = (async function () {
        if (!api || typeof api.plansForYear !== "function") return [];
        try {
          var records = await api.plansForYear(year);
          return Array.isArray(records) ? records : [];
        } catch (error) {
          return [];
        }
      })();
      recordsByYear.set(year, promise);
      promise.then(function (records) {
        groupPlansByDay(records, year).forEach(function (list, day) {
          groupsByKey.set(year + ":" + day, list);
        });
        queueDecorate();
      });
    }
    return recordsByYear.get(year);
  }

  function keyForCell(cell) {
    if (cell.dataset.calendarDay) {
      var day = Number(cell.dataset.calendarDay);
      if (Number.isFinite(day)) return currentYear() + ":" + day;
      return null;
    }
    if (cell.dataset.calendarCivil) {
      var resolved = null;
      try {
        resolved = global.LivingTimeCalendarWorkbench?.resolveCivilDate?.(cell.dataset.calendarCivil);
      } catch (error) { resolved = null; }
      if (resolved && resolved.inside && Number.isFinite(Number(resolved.dayOfPatternYear))) {
        var year = Number(resolved.alignmentYear || resolved.selectedYear);
        if (Number.isFinite(year) && year > 0) {
          loadYear(year);
          return year + ":" + Number(resolved.dayOfPatternYear);
        }
      }
    }
    return null;
  }

  function decorateCell(cell) {
    var key = keyForCell(cell);
    var existing = cell.querySelector(":scope > .sched-markers");
    var records = key ? groupsByKey.get(key) : null;

    if (!records || !records.length) {
      if (existing) existing.remove();
      return;
    }

    var built = markersForDay(records);
    /* Leave an already-correct row standing: this layer's own
     * writes are what the grid observer watches, and rebuilding
     * an unchanged row would keep the observer (and the layout)
     * busy forever. */
    var signature = key + "|" + built.markers.map(function (m) { return m.emoji; }).join("") + "|" + built.overflow;
    if (existing && existing.dataset.sig === signature) return;

    var row = document.createElement("span");
    row.className = "sched-markers";
    row.dataset.sig = signature;
    row.setAttribute("aria-hidden", "true");
    built.markers.forEach(function (marker) {
      var chip = document.createElement("span");
      chip.className = "sched-marker";
      chip.title = marker.title;
      chip.textContent = marker.emoji;
      row.appendChild(chip);
    });
    if (built.overflow > 0) {
      var more = document.createElement("span");
      more.className = "sched-marker sched-marker--more";
      more.title = built.overflow + " more scheduled";
      more.textContent = "+" + built.overflow;
      row.appendChild(more);
    }

    if (existing) existing.replaceWith(row);
    else {
      var number = cell.querySelector(":scope > strong");
      if (number) number.after(row);
      else cell.prepend(row);
    }
  }

  function decorate() {
    var grid = document.getElementById("calendar-atlas-grid");
    if (!grid) return;
    loadYear(currentYear());
    grid.querySelectorAll(".calendar-day-cell").forEach(decorateCell);
  }

  function queueDecorate() {
    if (decorateQueued) return;
    decorateQueued = true;
    setTimeout(function () {
      decorateQueued = false;
      decorate();
    }, 60);
  }

  /* The Atlas popup, freed: see the header. The move is a plain
   * appendChild relocation — the node, its children, and every
   * listener travel with it; the workbench addresses it by id. */
  function freeAtlasModal() {
    var modal = document.getElementById("calendar-atlas-modal");
    if (modal && modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }
  }

  function boot() {
    freeAtlasModal();
    /* If the keeper's tap lands before this layer, the capture
     * listener frees the modal on the way in, before the
     * workbench's own open handler runs. */
    document.addEventListener("click", function (event) {
      if (event.target && event.target.id === "calendar-atlas-open") freeAtlasModal();
    }, true);

    var grid = document.getElementById("calendar-atlas-grid");
    if (grid) {
      new MutationObserver(queueDecorate).observe(grid, { childList: true, subtree: true });
    }
    window.addEventListener("livingtime:ready", queueDecorate);
    window.addEventListener("livingtime:selectionchange", queueDecorate);
    document.addEventListener("sof:life-atlas-records-changed", function () {
      recordsByYear.clear();
      groupsByKey.clear();
      queueDecorate();
    });
    queueDecorate();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
