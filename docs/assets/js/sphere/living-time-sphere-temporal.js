(() => {
  "use strict";

  // Renderer-neutral temporal navigation for the 13 x 28 Pattern calendar.
  // This module owns date-selection math so every control, renderer, URL, and
  // future calendar lens agrees about what "Today" and a relative day mean.

  const PATTERN_DAYS = 364;
  const DAYS_PER_MOON = 28;
  const MOONS = 13;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const VERSION = "living-time-temporal/1.0.0";

  function _finiteInteger(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number) : null;
  }

  function clampDay(value) {
    const day = _finiteInteger(value);
    return Math.max(1, Math.min(PATTERN_DAYS, day || 1));
  }

  function wrapDay(value) {
    const resolved = _finiteInteger(value);
    const day = resolved == null ? 1 : resolved;
    return ((day - 1) % PATTERN_DAYS + PATTERN_DAYS) % PATTERN_DAYS + 1;
  }

  function stepDay(day, delta, { wrap = true } = {}) {
    const next = clampDay(day) + (_finiteInteger(delta) || 0);
    return wrap ? wrapDay(next) : clampDay(next);
  }

  function moonDayForPatternDay(value) {
    const dayOfPatternYear = clampDay(value);
    return Object.freeze({
      dayOfPatternYear,
      moon: Math.floor((dayOfPatternYear - 1) / DAYS_PER_MOON) + 1,
      day: ((dayOfPatternYear - 1) % DAYS_PER_MOON) + 1,
      week: Math.floor((((dayOfPatternYear - 1) % DAYS_PER_MOON)) / 7) + 1,
      dayOfWeek: ((dayOfPatternYear - 1) % 7) + 1,
    });
  }

  function patternWindow(value) {
    const position = moonDayForPatternDay(value);
    const moonStart = (position.moon - 1) * DAYS_PER_MOON + 1;
    const weekStart = moonStart + (position.week - 1) * 7;
    return Object.freeze({
      ...position,
      moonStart,
      moonEnd: moonStart + DAYS_PER_MOON - 1,
      weekStart,
      weekEnd: weekStart + 6,
    });
  }

  function patternAngleForDay(value) {
    const day = clampDay(value);
    const shared = globalThis.LivingTimeSphereModel?.patternAngleForDayOfYear;
    return typeof shared === "function"
      ? Number(shared(day))
      : Number((((day - 0.5) / PATTERN_DAYS) * 360).toFixed(6));
  }

  function shortestAngleDelta(startAngle, endAngle) {
    return ((Number(endAngle) - Number(startAngle) + 540) % 360) - 180;
  }

  function comparisonArcSamples(selectedDay, todayDay, { minimumSegments = 18, maximumSegments = 64 } = {}) {
    const startAngle = patternAngleForDay(selectedDay);
    const endAngle = patternAngleForDay(todayDay);
    const deltaAngle = shortestAngleDelta(startAngle, endAngle);
    const segments = Math.max(minimumSegments, Math.min(maximumSegments, Math.ceil(Math.abs(deltaAngle) / 4)));
    const samples = Array.from({ length: segments + 1 }, (_, index) => {
      const progress = index / segments;
      const lift = Math.sin(progress * Math.PI);
      return Object.freeze({
        progress,
        angle: startAngle + deltaAngle * progress,
        radiusScale: 1.012 + lift * 0.045,
        lift,
      });
    });
    return Object.freeze({ startAngle, endAngle, deltaAngle, segments, samples: Object.freeze(samples) });
  }

  function stepWithinScope(day, delta, scope = "pattern-year") {
    const current = clampDay(day);
    const amount = _finiteInteger(delta) || 0;
    if (scope === "pattern-moon" || scope === "pattern-week") {
      const window = patternWindow(current);
      const start = scope === "pattern-week" ? window.weekStart : window.moonStart;
      const end = scope === "pattern-week" ? window.weekEnd : window.moonEnd;
      const size = end - start + 1;
      return ((current - start + amount) % size + size) % size + start;
    }
    return stepDay(current, amount, { wrap: true });
  }

  function _normalizeYears(values) {
    return [...new Set((Array.isArray(values) ? values : [])
      .map(_finiteInteger)
      .filter(Number.isFinite))].sort((a, b) => a - b);
  }

  function _nearestSupportedYear(requested, supportedYears, fallbackYear) {
    const years = _normalizeYears(supportedYears);
    if (!years.length) return _finiteInteger(requested) || _finiteInteger(fallbackYear) || new Date().getUTCFullYear();
    const target = _finiteInteger(requested);
    if (target != null && years.includes(target)) return target;
    const fallback = _finiteInteger(fallbackYear);
    if (fallback != null && years.includes(fallback)) return fallback;
    if (target == null) return years[years.length - 1];
    return years.reduce((best, year) => Math.abs(year - target) < Math.abs(best - target) ? year : best, years[0]);
  }

  function resolveTodayTarget({ snapshot, fallbackPosition, supportedYears, fallbackYear } = {}) {
    const position = snapshot?.pattern || fallbackPosition || snapshot?.todayModel?.todayPatternPosition || null;
    const rawDay = _finiteInteger(position?.dayOfPatternYear);
    if (rawDay == null || rawDay < 1 || rawDay > PATTERN_DAYS) return null;
    const patternYear = _finiteInteger(position?.patternYear) || _finiteInteger(snapshot?.year) || _finiteInteger(fallbackYear);
    const selectedYear = _nearestSupportedYear(patternYear, supportedYears, snapshot?.year ?? fallbackYear);
    const moonDay = moonDayForPatternDay(rawDay);
    return Object.freeze({
      ...moonDay,
      year: selectedYear,
      patternYear,
      marker: "today",
      civilDate: position?.civilDate || "",
      effectiveDate: position?.effectiveDate || position?.civilDate || "",
      exactYearMatch: patternYear == null || patternYear === selectedYear,
    });
  }

  function _isoDayNumber(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : Math.round(date.getTime() / DAY_MS);
  }

  function compareToToday(selected, today) {
    const selectedDay = _finiteInteger(selected?.dayOfPatternYear);
    const todayDay = _finiteInteger(today?.dayOfPatternYear);
    if (selectedDay == null || todayDay == null) return null;
    const normalizedSelected = clampDay(selectedDay);
    const normalizedToday = clampDay(todayDay);
    const forwardDays = (normalizedSelected - normalizedToday + PATTERN_DAYS) % PATTERN_DAYS;
    const backwardDays = (normalizedToday - normalizedSelected + PATTERN_DAYS) % PATTERN_DAYS;
    const shortestSignedDays = forwardDays === 0 ? 0 : (forwardDays <= backwardDays ? forwardDays : -backwardDays);
    const selectedPosition = moonDayForPatternDay(normalizedSelected);
    const todayPosition = moonDayForPatternDay(normalizedToday);
    const selectedIsoDay = _isoDayNumber(selected?.effectiveDate || selected?.civilDate);
    const todayIsoDay = _isoDayNumber(today?.effectiveDate || today?.civilDate);
    const civilDayDelta = selectedIsoDay != null && todayIsoDay != null ? selectedIsoDay - todayIsoDay : null;
    const samePatternDay = normalizedSelected === normalizedToday;
    const isLiveToday = selected?.isToday === true || (samePatternDay && civilDayDelta === 0);
    const relationshipLabel = isLiveToday
      ? "Live Today"
      : civilDayDelta != null
        ? `${Math.abs(civilDayDelta)} civil ${Math.abs(civilDayDelta) === 1 ? "day" : "days"} ${civilDayDelta > 0 ? "ahead" : "behind"}`
        : `${Math.abs(shortestSignedDays)} Pattern ${Math.abs(shortestSignedDays) === 1 ? "day" : "days"} ${shortestSignedDays > 0 ? "forward" : "back"}`;

    return Object.freeze({
      selectedDay: normalizedSelected,
      todayDay: normalizedToday,
      forwardDays,
      backwardDays,
      shortestSignedDays,
      civilDayDelta,
      samePatternDay,
      isLiveToday,
      sameMoon: selectedPosition.moon === todayPosition.moon,
      sameWeek: selectedPosition.moon === todayPosition.moon && selectedPosition.week === todayPosition.week,
      selectedMoon: selectedPosition.moon,
      selectedMoonDay: selectedPosition.day,
      todayMoon: todayPosition.moon,
      todayMoonDay: todayPosition.day,
      angleDelta: Number((shortestSignedDays * (360 / PATTERN_DAYS)).toFixed(3)),
      relationshipLabel,
    });
  }

  globalThis.LivingTimeSphereTemporal = Object.freeze({
    version: VERSION,
    PATTERN_DAYS,
    DAYS_PER_MOON,
    MOONS,
    clampDay,
    wrapDay,
    stepDay,
    moonDayForPatternDay,
    patternWindow,
    patternAngleForDay,
    shortestAngleDelta,
    comparisonArcSamples,
    stepWithinScope,
    resolveTodayTarget,
    compareToToday,
  });
})();
