(() => {
  "use strict";

  // Alignment Signature — categorizes measurements without claiming causation.
  // Clearly distinguishes: direct measurement, normalized coordinate, symbolic mapping,
  // human observation, hypothesis.

  function build(record) {
    if (!record || !record.equinox) throw new Error("AlignmentSignature: invalid record");

    const pos   = record.equinox.patternPosition || {};
    const lunar = record.equinox.lunarLayer       || {};
    const offs  = record.offsets                   || {};

    return Object.freeze({
      schemaVersion: record.schemaVersion || "alignment-ledger/1.0.0",
      year: record.year,
      entries: [
        {
          type: "direct-measurement",
          label: "Pattern Calendar position at equinox instant",
          value: pos.moon != null
            ? `Moon ${pos.moon} (${pos.moonName}), Day ${pos.day}`
            : "Outside 364-day count"
        },
        {
          type: "direct-measurement",
          label: "Passage duration",
          value: `${Number((offs.equinoxToYearGateDays || 0).toFixed(4))} days (${Number(((offs.equinoxToYearGateDays || 0) * 24).toFixed(2))} hours)`
        },
        {
          type: "direct-measurement",
          label: "Equinox UTC instant",
          value: record.equinox.utcInstant || "—"
        },
        {
          type: "direct-measurement",
          label: "Year Gate instant (Moon 1 Day 1)",
          value: record.yearGate?.instant || "—"
        },
        {
          type: "direct-measurement",
          label: "Approximate lunar phase at equinox",
          value: lunar.phaseName
            ? `${lunar.phaseName} at ~${lunar.illuminationPercent ?? "?"}% illumination`
            : "Lunar data unavailable"
        },
        {
          type: "symbolic-mapping",
          label: "Week Gate at equinox",
          value: pos.weekGate || "Outside Gate",
          note: "Week Gate is a Pattern Calendar symbolic layer, not an astronomical measurement."
        },
        {
          type: "symbolic-mapping",
          label: "Archetype at equinox",
          value: pos.archetype || "—",
          note: "Archetype is a Pattern Calendar named quality, not an astronomical measurement."
        },
        {
          type: "normalized-coordinate",
          label: "Pattern cycle position (0–1)",
          value: record.normalized?.patternCyclePosition ?? null
        },
        {
          type: "normalized-coordinate",
          label: "Lunar cycle position (0–1)",
          value: record.normalized?.lunarCyclePosition ?? null
        },
        {
          type: "normalized-coordinate",
          label: "Passage length position (0–1)",
          value: record.normalized?.passageLengthPosition ?? null
        },
        {
          type: "hypothesis-boundary",
          label: "No causation claim",
          value: "Recurrence in these measurements does not prove that pattern cycles cause astronomical events or personal outcomes."
        }
      ]
    });
  }

  function accessibleText(record) {
    const sig = build(record);
    return sig.entries
      .filter(e => e.type !== "hypothesis-boundary")
      .map(e => `${e.label}: ${e.value}${e.note ? ` (${e.note})` : ""}`)
      .join("\n");
  }

  globalThis.AlignmentSignature = Object.freeze({ build, accessibleText });
})();
