(() => {
  "use strict";

  const EPOCH_YEAR = 2026;
  const EPOCH_MONTH = 4;
  const EPOCH_DAY = 17;

  function epochForYear(year) {
    return new Date(Date.UTC(year, EPOCH_MONTH - 1, EPOCH_DAY, 12, 0, 0));
  }

  function windowForEffectiveDate(effectiveDate) {
    const tentative = epochForYear(effectiveDate.getUTCFullYear());
    const yearStart = effectiveDate < tentative ? epochForYear(effectiveDate.getUTCFullYear() - 1) : tentative;
    const nextYearStart = epochForYear(yearStart.getUTCFullYear() + 1);
    const windowLength = PatternCalendarBoundary.dayDiff(nextYearStart, yearStart);
    return { yearStart, nextYearStart, windowLength };
  }

  function insideCountedYear(diff) {
    return diff >= 0 && diff < 364;
  }

  function toSummary(boundaryContext, conversion) {
    return {
      calendarVersion: PatternCalendarVersion.version,
      civilDate: PatternCalendarFormat.toISODateKey(PatternCalendarBoundary.datePartsInTimeZone(boundaryContext.civilDate, "UTC")),
      effectiveDate: PatternCalendarFormat.toISODateKey(PatternCalendarBoundary.datePartsInTimeZone(boundaryContext.effectiveDate, "UTC")),
      patternYear: conversion.patternYear,
      insideCountedYear: conversion.inside,
      moon: conversion.moon,
      moonName: conversion.moonName,
      day: conversion.day,
      dayOfPatternYear: conversion.dayOfPatternYear,
      weekOfMoon: conversion.weekOfMoon,
      weekOfYear: conversion.weekOfYear,
      dayArchetype: conversion.dayArchetype,
      civilWeekday: boundaryContext.civilWeekday,
      boundaryMode: boundaryContext.boundaryMode,
      isDayOutOfTime: conversion.isDayOutOfTime,
      isDeepTimeDay: conversion.isDeepTimeDay
    };
  }

  function convertEffectiveDate(effectiveDate) {
    const { yearStart, nextYearStart, windowLength } = windowForEffectiveDate(effectiveDate);
    const diff = PatternCalendarBoundary.dayDiff(effectiveDate, yearStart);
    const inside = insideCountedYear(diff);
    const basePatternYear = yearStart.getUTCFullYear() - EPOCH_YEAR + 1;

    if (inside) {
      const moon = Math.floor(diff / 28) + 1;
      const day = (diff % 28) + 1;
      const dayOfPatternYear = diff + 1;
      const weekOfMoon = Math.floor((day - 1) / 7) + 1;
      const weekOfYear = Math.floor(diff / 7) + 1;
      const dayArchetype = PatternCalendarData.dayArchetypes[day - 1] || null;

      return {
        inside,
        patternYear: basePatternYear,
        moon,
        moonName: PatternCalendarData.moons[moon - 1]?.name || null,
        day,
        dayOfPatternYear,
        weekOfMoon,
        weekOfYear,
        dayArchetype,
        isDayOutOfTime: false,
        isDeepTimeDay: false,
        intercalaryIndex: 0,
        anchorDate: yearStart,
        nextAnchorDate: nextYearStart,
        windowLength
      };
    }

    const intercalaryIndex = diff - 364 + 1;
    const isLeapWindow = windowLength === 366;

    return {
      inside,
      patternYear: basePatternYear,
      moon: null,
      moonName: intercalaryIndex === 2 ? PatternCalendarData.deepTimeDayName : PatternCalendarData.dayOutOfTimeName,
      day: null,
      dayOfPatternYear: null,
      weekOfMoon: null,
      weekOfYear: null,
      dayArchetype: [
        intercalaryIndex === 2 ? PatternCalendarData.deepTimeDayName : PatternCalendarData.dayOutOfTimeName,
        intercalaryIndex === 2
          ? "Additional leap-year intercalary day outside the 364-day count."
          : "Intercalary day outside the 364-day count."
      ],
      isDayOutOfTime: intercalaryIndex === 1,
      isDeepTimeDay: isLeapWindow && intercalaryIndex === 2,
      intercalaryIndex,
      anchorDate: yearStart,
      nextAnchorDate: nextYearStart,
      windowLength
    };
  }

  function fromCivilDate({ date, timeZone = "UTC", boundaryMode = "midnight", sunsetTime = "18:00" } = {}) {
    const normalizedMode = ["sunset", "manual", "midnight"].includes(boundaryMode) ? boundaryMode : "midnight";
    const now = PatternCalendarFormat.coerceDate(date);
    const boundary = PatternCalendarBoundary.resolveBoundary({
      now,
      timeZone,
      mode: normalizedMode,
      sunsetTime
    });

    const conversion = convertEffectiveDate(boundary.effectiveDate);
    const summary = toSummary(boundary, conversion);

    return {
      ...summary,
      civilDateObject: new Date(boundary.civilDate),
      effectiveDateObject: new Date(boundary.effectiveDate),
      timeZone: boundary.timeZone,
      sunsetTime: boundary.sunsetTime,
      afterBoundary: boundary.afterBoundary,
      intercalaryIndex: conversion.intercalaryIndex,
      anchorDate: new Date(conversion.anchorDate),
      nextAnchorDate: new Date(conversion.nextAnchorDate),
      countedYearLength: conversion.windowLength,
      conversionMode: "fixed-epoch-arithmetic"
    };
  }

  globalThis.PatternCalendar = Object.freeze({
    fromCivilDate,
    epochForYear,
    convertEffectiveDate,
    constants: Object.freeze({
      moonsPerYear: 13,
      daysPerMoon: 28,
      countedDaysPerYear: 364,
      weeksPerMoon: 4,
      daysPerWeek: 7
    })
  });
})();
