(() => {
  "use strict";

  function assertDependencies() {
    if (!globalThis.AlignmentLedgerData) throw new Error("AlignmentComparison: AlignmentLedgerData is unavailable");
  }

  function diff(a, b) {
    return typeof a === "number" && typeof b === "number" ? a - b : null;
  }

  function compareTwo(yearA, yearB, { timeZone, boundaryMode, manualSunset } = {}) {
    assertDependencies();
    const opts = { timeZone, boundaryMode, manualSunset };
    const recA = globalThis.AlignmentLedgerData.getRecord({ year: yearA, ...opts });
    const recB = globalThis.AlignmentLedgerData.getRecord({ year: yearB, ...opts });

    if (!recA || !recB) throw new Error(`AlignmentComparison: could not load records for ${yearA} and ${yearB}`);

    const passageMsDiff  = diff(recB.offsets.equinoxToYearGateMilliseconds, recA.offsets.equinoxToYearGateMilliseconds);
    const passageDayDiff = passageMsDiff != null ? Number((passageMsDiff / 86400000).toFixed(6)) : null;
    const passageHrDiff  = passageMsDiff != null ? Number((passageMsDiff / 3600000).toFixed(4))  : null;

    const equinoxMsA  = new Date(recA.equinox.utcInstant).getTime();
    const equinoxMsB  = new Date(recB.equinox.utcInstant).getTime();
    const equinoxShiftMs    = equinoxMsB - equinoxMsA;
    const equinoxShiftHours = Number((equinoxShiftMs / 3600000).toFixed(4));

    const normalizedMovement = {
      patternCyclePosition:  diff(recB.normalized.patternCyclePosition,  recA.normalized.patternCyclePosition),
      equinoxCyclePosition:  diff(recB.normalized.equinoxCyclePosition,  recA.normalized.equinoxCyclePosition),
      lunarCyclePosition:    diff(recB.normalized.lunarCyclePosition,     recA.normalized.lunarCyclePosition),
      passageLengthPosition: diff(recB.normalized.passageLengthPosition,  recA.normalized.passageLengthPosition)
    };

    const similarities = [];
    const differences  = [];

    if (recA.equinox.patternPosition?.moon === recB.equinox.patternPosition?.moon) {
      similarities.push(`Both equinoxes fall in Moon ${recA.equinox.patternPosition.moon} (${recA.equinox.patternPosition.moonName})`);
    } else {
      differences.push(`Equinox Moon: ${yearA} = Moon ${recA.equinox.patternPosition?.moon}, ${yearB} = Moon ${recB.equinox.patternPosition?.moon}`);
    }

    if (recA.equinox.patternPosition?.weekGate === recB.equinox.patternPosition?.weekGate) {
      similarities.push(`Both equinoxes share Week Gate: ${recA.equinox.patternPosition.weekGate}`);
    } else {
      differences.push(`Week Gate: ${yearA} = ${recA.equinox.patternPosition?.weekGate}, ${yearB} = ${recB.equinox.patternPosition?.weekGate}`);
    }

    if (recA.signature.lunarPhase === recB.signature.lunarPhase) {
      similarities.push(`Both share the same lunar phase at equinox: ${recA.signature.lunarPhase}`);
    } else {
      differences.push(`Lunar phase: ${yearA} = ${recA.signature.lunarPhase}, ${yearB} = ${recB.signature.lunarPhase}`);
    }

    return Object.freeze({
      schemaVersion: globalThis.AlignmentVersion?.alignmentLedgerVersion || "alignment-ledger/1.0.0",
      yearA,
      yearB,
      passageDurationDiff: {
        milliseconds: passageMsDiff,
        days:         passageDayDiff,
        hours:        passageHrDiff
      },
      equinoxUtcShiftHours:  equinoxShiftHours,
      normalizedMovement,
      similarities,
      differences,
      movementDirection: passageDayDiff == null ? "unknown" : passageDayDiff > 0 ? "longer" : passageDayDiff < 0 ? "shorter" : "same",
      sourcePrecisionNote: "Passage duration derived from canonical equinox instant and fixed Year Gate date. Precision limited by equinox data resolution."
    });
  }

  function compareToPrevious(year, opts = {}) {
    return compareTwo(year - 1, year, opts);
  }

  function compareRange(years, opts = {}) {
    if (!Array.isArray(years) || years.length < 2) throw new Error("AlignmentComparison.compareRange: need at least 2 years");
    const results = [];
    for (let i = 1; i < years.length; i++) {
      results.push(compareTwo(years[i - 1], years[i], opts));
    }
    return results;
  }

  function compareFullStudy(opts = {}) {
    assertDependencies();
    const years = globalThis.AlignmentLedgerData.listSupportedYears();
    return compareRange(years, opts);
  }

  globalThis.AlignmentComparison = Object.freeze({
    compareTwo,
    compareToPrevious,
    compareRange,
    compareFullStudy
  });
})();
