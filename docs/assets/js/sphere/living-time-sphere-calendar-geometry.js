(() => {
  "use strict";

  // Authoritative readable-calendar topology for the Living Time Sphere.
  // Astronomy and historical strata may move independently; the Pattern
  // calendar does not. Every counted day belongs to exactly one of 13 Moons,
  // every Moon owns four complete 7-day weeks, and intercalary days live in
  // the Year Gate seam outside the 364-day week count.
  const MOONS = 13;
  const DAYS_PER_MOON = 28;
  const WEEKS_PER_MOON = 4;
  const DAYS_PER_WEEK = 7;
  const PATTERN_DAYS = MOONS * DAYS_PER_MOON;
  const SECTOR_SWEEP = 360 / MOONS;
  const DAY_SWEEP = 360 / PATTERN_DAYS;

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n) || lo));
  const normalizeAngle = (deg) => ((Number(deg) % 360) + 360) % 360;

  function dayOfPatternYear(moonNumber, moonDay) {
    const moon = Math.round(clamp(moonNumber, 1, MOONS));
    const day = Math.round(clamp(moonDay, 1, DAYS_PER_MOON));
    return ((moon - 1) * DAYS_PER_MOON) + day;
  }

  function dayAddress(dayNumber) {
    const dayOfYear = Math.round(clamp(dayNumber, 1, PATTERN_DAYS));
    const moon = Math.floor((dayOfYear - 1) / DAYS_PER_MOON) + 1;
    const moonDay = ((dayOfYear - 1) % DAYS_PER_MOON) + 1;
    const week = Math.floor((moonDay - 1) / DAYS_PER_WEEK) + 1;
    const weekday = ((moonDay - 1) % DAYS_PER_WEEK) + 1;
    return Object.freeze({
      dayOfPatternYear: dayOfYear,
      moon,
      moonDay,
      week,
      weekday,
      weekStart: ((week - 1) * DAYS_PER_WEEK) + 1,
      weekEnd: week * DAYS_PER_WEEK,
      moonStart: moonDay === 1,
      moonEnd: moonDay === DAYS_PER_MOON,
      weekBoundary: weekday === DAYS_PER_WEEK,
      angle: normalizeAngle(((dayOfYear - 0.5) / PATTERN_DAYS) * 360),
    });
  }

  function moonAddress(moonNumber) {
    const moon = Math.round(clamp(moonNumber, 1, MOONS));
    const sectorStart = (moon - 1) * SECTOR_SWEEP;
    const sectorEnd = moon * SECTOR_SWEEP;
    const weeks = Array.from({ length: WEEKS_PER_MOON }, (_, i) => {
      const week = i + 1;
      const startDay = i * DAYS_PER_WEEK + 1;
      const endDay = startDay + DAYS_PER_WEEK - 1;
      const startPatternDay = dayOfPatternYear(moon, startDay);
      const endPatternDay = dayOfPatternYear(moon, endDay);
      return Object.freeze({
        week,
        startDay,
        endDay,
        startPatternDay,
        endPatternDay,
        startAngle: normalizeAngle(((startPatternDay - 1) / PATTERN_DAYS) * 360),
        endAngle: normalizeAngle((endPatternDay / PATTERN_DAYS) * 360),
        centerAngle: normalizeAngle((((startPatternDay - 1) + DAYS_PER_WEEK / 2) / PATTERN_DAYS) * 360),
        label: `${startDay}–${endDay}`,
      });
    });
    return Object.freeze({
      moon,
      sectorStart,
      sectorEnd,
      centerAngle: normalizeAngle(sectorStart + SECTOR_SWEEP / 2),
      firstPatternDay: dayOfPatternYear(moon, 1),
      lastPatternDay: dayOfPatternYear(moon, DAYS_PER_MOON),
      weeks: Object.freeze(weeks),
    });
  }

  function isLeapPatternWindow(selectedYear) {
    const year = Number(selectedYear);
    if (!Number.isFinite(year)) return false;
    const start = Date.UTC(year, 3, 17, 12, 0, 0);
    const end = Date.UTC(year + 1, 3, 17, 12, 0, 0);
    return Math.round((end - start) / 86400000) === 366;
  }

  function yearGate(selectedYear) {
    const leap = isLeapPatternWindow(selectedYear);
    const intercalary = [
      Object.freeze({
        id: "day-out-of-time",
        shortLabel: "OOT",
        label: "Day Out of Time",
        ordinal: 1,
        angle: 359.35,
        radialLane: 1,
        leap: false,
      }),
    ];
    if (leap) {
      intercalary.push(Object.freeze({
        id: "leap-day-out-of-time",
        shortLabel: "Leap OOT",
        label: "Leap Day Out of Time",
        ordinal: 2,
        angle: 0.65,
        radialLane: 2,
        leap: true,
      }));
    }
    return Object.freeze({
      leap,
      after: Object.freeze({ moon: 13, day: 28, patternDay: 364 }),
      before: Object.freeze({ moon: 1, day: 1, patternDay: 1 }),
      intercalary: Object.freeze(intercalary),
    });
  }

  // Calendar text density is deliberately separated from geometry. All 364
  // day ticks remain permanent chronology. The readable day-number surface is
  // a 13 × 4 × 7 polar matrix: Moon = angular sector, week = radial lane,
  // weekday = angular column. This is intentionally distinct from the
  // astronomical 364-day chronology so a phone can display a real 28-day Moon
  // without compressing 28 glyphs into ~27.7 degrees of a single circumference.
  function calendarCell(dayNumber) {
    const address = dayAddress(dayNumber);
    const moonMeta = moonAddress(address.moon);
    const margin = SECTOR_SWEEP * 0.055;
    const usable = SECTOR_SWEEP - margin * 2;
    const columnT = (address.weekday - 0.5) / DAYS_PER_WEEK;
    const angle = normalizeAngle(moonMeta.sectorStart + margin + usable * columnT);
    return Object.freeze({
      ...address,
      angle,
      canonicalAngle: address.angle,
      radialLane: address.week,
      radialFactor: 1.30 + (address.week - 1) * 0.085,
      sectorStart: moonMeta.sectorStart,
      sectorEnd: moonMeta.sectorEnd,
    });
  }

  // Structural matrix geometry and readable-number geometry deliberately share
  // one address again. Astronomy continues to use canonicalAngle/dayAddress.
  function calendarMatrixCell(dayNumber) {
    return calendarCell(dayNumber);
  }

  // Deterministic pointer selection for the readable polar matrix. The entire
  // calendar cell remains selectable even when its numeral is hidden by LOD.
  function nearestCalendarCell(angle, radialFactor, options = {}) {
    const a = normalizeAngle(angle);
    const r = Number(radialFactor);
    if (!Number.isFinite(r)) return null;
    const maxDistance = Number.isFinite(Number(options.maxDistance))
      ? Number(options.maxDistance)
      : 0.115;
    let best = null;
    let bestDistance = Infinity;
    for (let day = 1; day <= PATTERN_DAYS; day += 1) {
      const cell = calendarCell(day);
      const deltaDegRaw = Math.abs(normalizeAngle(a - cell.angle));
      const deltaDeg = Math.min(deltaDegRaw, 360 - deltaDegRaw);
      const angularDistance = (deltaDeg * Math.PI / 180) * cell.radialFactor;
      const radialDistance = Math.abs(r - cell.radialFactor);
      const distance = Math.hypot(angularDistance, radialDistance);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = cell;
      }
    }
    if (!best || bestDistance > maxDistance) return null;
    return Object.freeze({ ...best, hitDistance: bestDistance });
  }

  // B7.19 — adaptive disclosure without changing geometry. Zoomed-out views
  // show no day numerals. As a Moon comes to the front, its week anchors appear;
  // near/detail reveals all 28 days for the front Moon. The selected Moon keeps
  // orientation anchors if it is not currently frontmost. Explicitly selected
  // days remain visible so selection never appears to vanish.
  function numeralPolicy({
    moon,
    moonDay,
    selectedMoon,
    band = "medium",
    selected = false,
    frontRank = null,
    focusScore = null,
    focusEligible = null,
  } = {}) {
    const m = Math.round(Number(moon) || 0);
    const d = Math.round(Number(moonDay) || 0);
    const focus = Math.round(Number(selectedMoon) || 0);
    const depth = String(band || "medium").toLowerCase();
    const rank = Number.isFinite(Number(frontRank)) ? Number(frontRank) : null;
    const score = Number.isFinite(Number(focusScore)) ? Number(focusScore) : null;
    if (m < 1 || m > MOONS || d < 1 || d > DAYS_PER_MOON) return false;

    const isSelectedDay = !!selected;
    const isSelectedMoon = m === focus;
    const isFront = rank === 0;
    const isNeighbor = rank === 1;
    const anchors = d === 1 || d === 7 || d === 14 || d === 21 || d === 28;
    const sparse = d === 1 || d === 14 || d === 28;

    /*
     * B7.20 — camera-local disclosure. A selected Moon is not permission for
     * its 28 numerals to remain painted on the screen forever. Full numerals
     * belong only to the Moon the camera is actually approaching. The selected
     * day itself remains available as a single orientation anchor.
     *
     * `focusEligible` is supplied by the label manager from projected screen
     * proximity. The score fallback keeps the geometry helper deterministic in
     * isolation/tests while avoiding the old selected-Moon stickiness.
     */
    const eligible = focusEligible == null
      ? (score == null ? isFront : score <= (depth === "medium" ? 0.70 : depth === "near" ? 0.82 : 0.92))
      : !!focusEligible;

    if (depth === "far" || depth === "overview") return isSelectedDay;
    if (!eligible) return isSelectedDay;
    /*
     * B7.24 — begin disclosing the calendar sooner. At medium distance the
     * front Moon now reveals alternating day numbers plus the structural week
     * anchors. This gives an approaching user a readable sense of the 28-day
     * field before the near band, while the B7.23 screen-space governor still
     * prevents a wall of overlapping numerals. Near/detail continues to reveal
     * the complete 1..28 face.
     */
    const approachingDay = anchors || (d % 2 === 1) || d === 4 || d === 10 || d === 18 || d === 24;
    // B7.27 — start the calendar reveal a little earlier while preserving the
    // screen-space label governor. A front Moon exposes a few additional
    // wayfinding days before the near band instead of waiting until the user
    // is almost on top of it.
    if (depth === "medium") return isSelectedDay || (isFront && approachingDay) || (isNeighbor && anchors && score != null && score <= 0.56) || (isSelectedMoon && isFront && sparse);
    if (depth === "near") return isSelectedDay || isFront || (isNeighbor && anchors && score != null && score <= 0.72);
    return isSelectedDay || isFront;
  }

  function dayBoundary(dayNumber) {
    const address = dayAddress(dayNumber);
    return Object.freeze({
      ...address,
      moonBoundary: address.moonDay === 1 || address.moonDay === DAYS_PER_MOON,
      weekStart: address.weekday === 1,
      weekEnd: address.weekday === DAYS_PER_WEEK,
      strong: address.moonDay === 1 || address.moonDay === DAYS_PER_MOON,
    });
  }

  // Gives multiple scheduled items on one day deterministic, non-overlapping
  // lanes without changing their canonical day angle.
  function plannerLane(index, count) {
    const total = Math.max(1, Math.round(Number(count) || 1));
    const i = Math.max(0, Math.min(total - 1, Math.round(Number(index) || 0)));
    return Object.freeze({
      index: i,
      count: total,
      radialOffset: Math.min(i, 5) * 0.027,
      verticalOffset: Math.min(i, 5) * 0.009,
      overflow: Math.max(0, total - 6),
    });
  }

  globalThis.LivingTimeSphereCalendarGeometry = Object.freeze({
    MOONS,
    DAYS_PER_MOON,
    WEEKS_PER_MOON,
    DAYS_PER_WEEK,
    PATTERN_DAYS,
    SECTOR_SWEEP,
    DAY_SWEEP,
    dayOfPatternYear,
    dayAddress,
    moonAddress,
    isLeapPatternWindow,
    yearGate,
    calendarCell,
    calendarMatrixCell,
    nearestCalendarCell,
    numeralPolicy,
    dayBoundary,
    plannerLane,
  });
})();
