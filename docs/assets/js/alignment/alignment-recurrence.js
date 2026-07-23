(() => {
  "use strict";

  // Tolerances for recurrence dimension matching.
  // These are configurable and documented — not magic numbers.
  const DEFAULT_TOLERANCES = Object.freeze({
    passageDurationHours:  6.0,   // passage durations within 6 hours are "close"
    equinoxTimeHours:      6.0,   // equinox UTC time shift within 6 hours
    lunarCycleDistance:    0.05,  // normalized 0–1 lunar cycle, within 5%
    normalizedSpherePos:   0.05   // normalized 0–1 pattern cycle, within 5%
  });

  function assertDependencies() {
    if (!globalThis.AlignmentLedgerData) throw new Error("AlignmentRecurrence: AlignmentLedgerData is unavailable");
  }

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  function scoreDimensions(recA, recB, tolerances) {
    const tol = Object.assign({}, DEFAULT_TOLERANCES, tolerances);

    const sameMoon    = recA.equinox.patternPosition?.moon === recB.equinox.patternPosition?.moon;
    const sameMoonDay = recA.equinox.patternPosition?.day  === recB.equinox.patternPosition?.day;
    const sameWeekGate = recA.equinox.patternPosition?.weekGate === recB.equinox.patternPosition?.weekGate;
    const sameArchetype = recA.equinox.patternPosition?.archetype === recB.equinox.patternPosition?.archetype;
    const sameTone    = recA.equinox.patternPosition?.tone === recB.equinox.patternPosition?.tone && recA.equinox.patternPosition?.tone != null;

    const passageDiffMs   = Math.abs((recB.offsets.equinoxToYearGateMilliseconds || 0) - (recA.offsets.equinoxToYearGateMilliseconds || 0));
    const passageDiffHours = passageDiffMs / 3600000;
    const closePassageDuration = passageDiffHours <= tol.passageDurationHours;

    const equinoxMsA   = new Date(recA.equinox.utcInstant).getTime();
    const equinoxMsB   = new Date(recB.equinox.utcInstant).getTime();
    const equinoxShiftHours = Math.abs((equinoxMsB - equinoxMsA) / 3600000);
    const closeEquinoxTime  = equinoxShiftHours <= tol.equinoxTimeHours;

    const lunarDist    = Math.abs((recB.normalized.lunarCyclePosition || 0) - (recA.normalized.lunarCyclePosition || 0));
    const closeLunar   = lunarDist <= tol.lunarCycleDistance;

    const sphereDist   = Math.abs((recB.normalized.patternCyclePosition || 0) - (recA.normalized.patternCyclePosition || 0));
    const closeSphere  = sphereDist <= tol.normalizedSpherePos;

    // Individual dimension scores (0 or 1 for boolean, 0–1 for continuous)
    const scores = {
      sameMoon:        sameMoon    ? 1 : 0,
      sameMoonDay:     sameMoonDay ? 1 : 0,
      sameWeekGate:    sameWeekGate ? 1 : 0,
      sameArchetype:   sameArchetype ? 1 : 0,
      sameTone:        sameTone    ? 1 : 0,
      closePassage:    closePassageDuration ? clamp(1 - passageDiffHours / (tol.passageDurationHours * 2), 0, 1) : 0,
      closeEquinox:    closeEquinoxTime     ? clamp(1 - equinoxShiftHours / (tol.equinoxTimeHours * 2), 0, 1) : 0,
      closeLunar:      closeLunar           ? clamp(1 - lunarDist / (tol.lunarCycleDistance * 2), 0, 1) : 0,
      closeSpherePos:  closeSphere          ? clamp(1 - sphereDist / (tol.normalizedSpherePos * 2), 0, 1) : 0
    };

    // Weighted average — weights are equal (1/9 each)
    const scoreValues = Object.values(scores);
    const overallSimilarityScore = Number((scoreValues.reduce((s, v) => s + v, 0) / scoreValues.length).toFixed(4));

    return {
      sameMoon,
      sameMoonDay,
      sameWeekGate,
      sameArchetype,
      sameTone,
      closePassageDuration,
      passageDifferenceHours: Number(passageDiffHours.toFixed(4)),
      closeEquinoxTime,
      equinoxShiftHours: Number(equinoxShiftHours.toFixed(4)),
      closeLunar,
      lunarCycleDistance: Number(lunarDist.toFixed(6)),
      closeSpherePos: closeSphere,
      normalizedSphereDistance: Number(sphereDist.toFixed(6)),
      dimensionScores: scores,
      overallSimilarityScore,
      tolerancesApplied: tol,
      scoreExplanation: "overallSimilarityScore is the unweighted average of 9 boolean and continuous dimension scores. A score of 1.0 means all measured dimensions match within tolerance. No mystical significance is claimed."
    };
  }

  function findRecurrences(year, { timeZone, boundaryMode, manualSunset, tolerances, minimumScore = 0.3 } = {}) {
    assertDependencies();
    const opts = { timeZone, boundaryMode, manualSunset };
    const target = globalThis.AlignmentLedgerData.getRecord({ year, ...opts });
    const allYears = globalThis.AlignmentLedgerData.listSupportedYears().filter(y => y !== year);

    return allYears.map(otherYear => {
      const other = globalThis.AlignmentLedgerData.getRecord({ year: otherYear, ...opts });
      const dims = scoreDimensions(target, other, tolerances);
      return { year: otherYear, ...dims };
    }).filter(r => r.overallSimilarityScore >= minimumScore)
      .sort((a, b) => b.overallSimilarityScore - a.overallSimilarityScore);
  }

  function buildFullRecurrenceMatrix({ timeZone, boundaryMode, manualSunset, tolerances } = {}) {
    assertDependencies();
    const years = globalThis.AlignmentLedgerData.listSupportedYears();
    const opts  = { timeZone, boundaryMode, manualSunset };
    const matrix = [];

    for (let i = 0; i < years.length; i++) {
      for (let j = i + 1; j < years.length; j++) {
        const recA = globalThis.AlignmentLedgerData.getRecord({ year: years[i], ...opts });
        const recB = globalThis.AlignmentLedgerData.getRecord({ year: years[j], ...opts });
        const dims = scoreDimensions(recA, recB, tolerances);
        matrix.push({ yearA: years[i], yearB: years[j], ...dims });
      }
    }

    return matrix;
  }

  globalThis.AlignmentRecurrence = Object.freeze({
    findRecurrences,
    buildFullRecurrenceMatrix,
    scoreDimensions,
    DEFAULT_TOLERANCES
  });
})();
