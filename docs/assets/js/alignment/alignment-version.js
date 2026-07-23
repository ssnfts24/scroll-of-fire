(() => {
  "use strict";

  const ALIGNMENT_LEDGER_VERSION = "alignment-ledger/1.0.0";
  const SPHERE_VERSION = "living-time-sphere/1.0.0";

  const STUDY_RANGE = Object.freeze({ start: 2014, end: 2026 });

  const VERSION_BLOCK = Object.freeze({
    alignmentLedgerVersion: ALIGNMENT_LEDGER_VERSION,
    sphereVersion: SPHERE_VERSION,
    equinoxPassageVersion: "equinox-passage/1.0.0",
    calendarVersion: "pattern-calendar/1.0.0"
  });

  globalThis.AlignmentVersion = Object.freeze({
    alignmentLedgerVersion: ALIGNMENT_LEDGER_VERSION,
    sphereVersion: SPHERE_VERSION,
    studyRange: STUDY_RANGE,
    versionBlock: VERSION_BLOCK
  });
})();
