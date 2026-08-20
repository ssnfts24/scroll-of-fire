(() => {
  "use strict";

  const VERSION = "1.0.0";

  let records = [];
  let recordsByDay = new Map();
  let recordsByMoon = new Map();
  let refreshTimer = 0;
  let observer = null;

  const GLYPHS = Object.freeze({
    task: "✓", event: "●", reminder: "⚑", growing: "🌱", farming: "🌾", planting: "🌱",
    harvest: "🌾", watering: "💧", livestock: "🐄", maintenance: "🔧", seasonal: "☀",
    practice: "✦", project: "◆", meeting: "👥", school: "🎓", health: "❤", finance: "💰",
    travel: "✈", milestone: "★", observation: "◉", home: "⌂", family: "♡", pets: "🐾",
    food: "🍽", shopping: "🛒", vehicle: "🚗", construction: "🏗", coding: "💻",
    writing: "✎", research: "🔬", creative: "🎨", cleaning: "🧹", appointment: "✚",
    community: "◎", camping: "⛺", fieldwork: "🥾"
  });

  function planner() {
    return globalThis.CodexLivingPlanner || null;
  }

  function category(record) {
    return String(
      record?.payload?.planner?.category
      || record?.subtype
      || "event"
    ).toLowerCase();
  }

  function currentYear() {
    const state =
      globalThis.LivingTimeSphereUi
        ?.getState?.();

    const select =
      document.getElementById(
        "sphere-year-select"
      );

    return Number(
      state?.year
      || select?.value
      || new Date().getFullYear()
    );
  }

  function _dayKey(year, day) { return `${Number(year)}:${Number(day)}`; }
  function _moonKey(year, moon) { return `${Number(year)}:${Number(moon)}`; }

  function _rebuildRecordIndexes() {
    recordsByDay = new Map();
    recordsByMoon = new Map();
    for (const record of records) {
      const year = Number(record?.temporal?.patternYear);
      const day = Number(record?.temporal?.patternDay);
      if (!Number.isFinite(year) || !Number.isFinite(day) || day < 1 || day > 364) continue;
      const moon = Math.floor((day - 1) / 28) + 1;
      const dayKey = _dayKey(year, day);
      const moonKey = _moonKey(year, moon);
      if (!recordsByDay.has(dayKey)) recordsByDay.set(dayKey, []);
      if (!recordsByMoon.has(moonKey)) recordsByMoon.set(moonKey, []);
      recordsByDay.get(dayKey).push(record);
      recordsByMoon.get(moonKey).push(record);
    }
  }

  function recordsForDay(year, day) {
    return recordsByDay.get(_dayKey(year, day)) || [];
  }

  function recordsForMoon(year, moon) {
    return recordsByMoon.get(_moonKey(year, moon)) || [];
  }

  function planSchedule(record) {
    return globalThis.CodexLifeAtlasScheduling?.getSchedule?.(record) || null;
  }

  function planTime(record) {
    const schedule = planSchedule(record);
    if (!schedule || schedule.allDay || !schedule.start) return "";
    try {
      return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" })
        .format(new Date(schedule.start));
    } catch {
      return "";
    }
  }

  function marker(record) {
    const type = category(record);
    const explicit = String(record?.payload?.planner?.symbol || "").trim();
    const symbol = explicit && explicit !== "auto"
      ? explicit.slice(0, 4)
      : (GLYPHS[type] || "●");

    const node =
      document.createElement("span");

    node.className =
      `calendar-plan-marker calendar-plan-marker--${type}`;

    node.dataset.planId =
      record.id || "";

    node.dataset.planCategory =
      type;

    node.textContent =
      symbol;

    node.title =
      record.title
      ? `${record.title} · ${type}`
      : type;

    node.setAttribute(
      "aria-hidden",
      "true"
    );

    return node;
  }

  function decorateDayCell(cell, year) {
    const day =
      Number(
        cell.dataset.calendarDay
      );

    if (!Number.isFinite(day))
      return;

    const matching =
      recordsForDay(year, day);

    const existing =
      cell.querySelector(
        ":scope > .calendar-plan-markers"
      );

    if (!matching.length) {
      existing?.remove();
      cell.classList.remove(
        "has-living-plans"
      );
      cell.removeAttribute(
        "data-plan-count"
      );
      return;
    }

    cell.classList.add(
      "has-living-plans"
    );

    cell.dataset.planCount =
      String(matching.length);

    const signature =
      matching
        .map(record =>
          `${record.id}:${category(record)}`
        )
        .join("|");

    if (
      existing?.dataset.signature
      === signature
    ) {
      return;
    }

    const host =
      existing
      || document.createElement("span");

    host.className =
      "calendar-plan-markers";

    host.dataset.signature =
      signature;

    host.replaceChildren();

    matching
      .slice(0, 4)
      .forEach(record =>
        host.appendChild(
          marker(record)
        )
      );

    if (matching.length > 4) {
      const more =
        document.createElement("span");

      more.className =
        "calendar-plan-marker calendar-plan-marker--more";

      more.textContent =
        `+${matching.length - 4}`;

      more.setAttribute(
        "aria-hidden",
        "true"
      );

      host.appendChild(more);
    }

    if (!existing)
      cell.appendChild(host);

    const titles =
      matching
        .map(record =>
          record.title || category(record)
        )
        .slice(0, 5)
        .join(", ");

    const original =
      cell.dataset.baseAriaLabel
      || cell.getAttribute("aria-label")
      || "";

    if (!cell.dataset.baseAriaLabel) {
      cell.dataset.baseAriaLabel =
        original;
    }

    cell.setAttribute(
      "aria-label",
      `${cell.dataset.baseAriaLabel}, ${matching.length} planned ${matching.length === 1 ? "item" : "items"}: ${titles}`
    );
  }

  function decorateMoonCell(cell, year) {
    const targetDay =
      Number(
        cell.dataset.calendarDay
      );

    if (!Number.isFinite(targetDay))
      return;

    const moon =
      Math.floor(
        (targetDay - 1) / 28
      ) + 1;

    const matching =
      recordsForMoon(year, moon);

    let badge =
      cell.querySelector(
        ":scope > .calendar-plan-count"
      );

    if (!matching.length) {
      badge?.remove();
      cell.classList.remove(
        "has-living-plans"
      );
      return;
    }

    cell.classList.add(
      "has-living-plans"
    );

    if (!badge) {
      badge =
        document.createElement("span");

      badge.className =
        "calendar-plan-count";

      badge.setAttribute(
        "aria-hidden",
        "true"
      );

      cell.appendChild(badge);
    }

    badge.textContent =
      String(matching.length);

    badge.title =
      `${matching.length} planned ${matching.length === 1 ? "item" : "items"}`;
  }

  function decorateTodayMoonMap() {
    document.querySelectorAll("#todaySummaryMoonGrid [data-pattern-year][data-pattern-day]").forEach(cell => {
      const year = Number(cell.dataset.patternYear);
      const day = Number(cell.dataset.patternDay);
      if (!Number.isFinite(year) || !Number.isFinite(day)) return;
      decorateDayCellNative(cell, recordsForDay(year, day));
    });
  }

  function decorateNativeCalendars() {
    decorateTodayMoonMap();

    document.querySelectorAll("#remCal [data-pattern-year][data-pattern-day]").forEach(cell => {
      const year = Number(cell.dataset.patternYear);
      const day = Number(cell.dataset.patternDay);
      if (!Number.isFinite(year) || !Number.isFinite(day)) return;
      decorateDayCellNative(cell, recordsForDay(year, day));
    });

    document.querySelectorAll("#gregCal [data-pattern-year][data-pattern-day]").forEach(cell => {
      const year = Number(cell.dataset.patternYear);
      const day = Number(cell.dataset.patternDay);
      if (!Number.isFinite(year) || !Number.isFinite(day)) return;
      decorateDayCellNative(cell, recordsForDay(year, day));
    });
  }

  function decorateDayCellNative(cell, matching) {
    const existing = cell.querySelector(":scope > .calendar-plan-markers");
    const existingList = cell.querySelector(":scope > .calendar-plan-inline-list");
    if (!matching.length) {
      existing?.remove();
      existingList?.remove();
      cell.classList.remove("has-living-plans");
      cell.removeAttribute("data-plan-count");
      return;
    }
    cell.classList.add("has-living-plans");
    cell.dataset.planCount = String(matching.length);
    const signature = matching.map(record => `${record.id}:${category(record)}:${record.title || ""}:${planTime(record)}`).join("|");
    if (existing?.dataset.signature === signature && existingList?.dataset.signature === signature) return;

    const host = existing || document.createElement("span");
    host.className = "calendar-plan-markers";
    host.dataset.signature = signature;
    host.replaceChildren();
    matching.slice(0, 4).forEach(record => host.appendChild(marker(record)));
    if (matching.length > 4) {
      const more = document.createElement("span");
      more.className = "calendar-plan-marker calendar-plan-marker--more";
      more.textContent = `+${matching.length - 4}`;
      more.setAttribute("aria-hidden", "true");
      host.appendChild(more);
    }
    if (!existing) cell.appendChild(host);

    const list = existingList || document.createElement("span");
    list.className = "calendar-plan-inline-list";
    list.dataset.signature = signature;
    list.replaceChildren();
    matching.slice(0, 2).forEach(record => {
      const row = document.createElement("span");
      row.className = `calendar-plan-inline calendar-plan-inline--${category(record)}`;
      row.dataset.planId = record.id || "";
      const when = planTime(record);
      row.textContent = `${when ? `${when} · ` : ""}${record.title || category(record)}`;
      row.title = record.title || category(record);
      list.appendChild(row);
    });
    if (matching.length > 2) {
      const more = document.createElement("span");
      more.className = "calendar-plan-inline calendar-plan-inline--more";
      more.textContent = `+${matching.length - 2} more`;
      list.appendChild(more);
    }
    if (!existingList) cell.appendChild(list);

    cell.title = matching.slice(0, 5).map(record => record.title || category(record)).join(", ");
  }

  function decorate() {
    decorateNativeCalendars();

    const grid =
      document.getElementById(
        "calendar-atlas-grid"
      );

    if (!grid) return;

    const year =
      currentYear();

    grid
      .querySelectorAll(
        ".calendar-day-cell[data-calendar-day]"
      )
      .forEach(cell =>
        decorateDayCell(cell, year)
      );

    grid
      .querySelectorAll(
        ".calendar-moon-cell[data-calendar-day]"
      )
      .forEach(cell =>
        decorateMoonCell(cell, year)
      );
  }

  async function refresh() {
    const api =
      planner();

    if (!api?.allPlans && !api?.plansForYear)
      return;

    try {
      const year = currentYear();
      records = api?.plansForYear
        ? await api.plansForYear(year)
        : await api.allPlans();

      _rebuildRecordIndexes();
      decorate();
    } catch (error) {
      console.warn(
        "[LifeAtlasCalendarProjection] Unable to read planner records.",
        error
      );
    }
  }

  function scheduleRefresh() {
    clearTimeout(
      refreshTimer
    );

    refreshTimer =
      setTimeout(
        refresh,
        30
      );
  }

  function observeCalendar() {
    const grids = [
      document.getElementById("calendar-atlas-grid"),
      document.getElementById("todaySummaryMoonGrid"),
      document.getElementById("remCal"),
      document.getElementById("gregCal")
    ].filter(Boolean);

    if (!grids.length || observer) return;

    observer =
      new MutationObserver(
        mutations => {
          const externalMutation =
            mutations.some(mutation => {
              const target =
                mutation.target;

              return !(
                target instanceof Element
                && (
                  target.closest(
                    ".calendar-plan-markers"
                  )
                  || target.classList?.contains(
                    "calendar-plan-count"
                  )
                )
              );
            });

          if (externalMutation)
            scheduleRefresh();
        }
      );

    grids.forEach(grid => observer.observe(
      grid,
      { childList: true, subtree: true }
    ));
  }

  function init() {
    observeCalendar();
    scheduleRefresh();

    window.addEventListener(
      "livingtime:ready",
      scheduleRefresh
    );

    window.addEventListener(
      "livingtime:selectionchange",
      scheduleRefresh
    );

    document.addEventListener(
      "sof:life-atlas-records-changed",
      scheduleRefresh
    );

    window.addEventListener(
      "pagehide",
      () => {
        observer?.disconnect();
        observer = null;
        clearTimeout(
          refreshTimer
        );
      },
      { once: true }
    );
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }

  globalThis
    .LifeAtlasCalendarProjection =
      Object.freeze({
        VERSION,
        refresh
      });
})();
