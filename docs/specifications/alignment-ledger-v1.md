# Alignment Ledger — Specification v1

## Version

`alignment-ledger/1.0.0`

## Purpose

The Alignment Ledger records how the moving March equinox meets the fixed Pattern Calendar each year. It produces deterministic, transparent measurements from 2014 through 2026. It does not claim that measured recurrences prove causation or destiny.

## Study range

Initial range: 2014–2026 (13 years). The architecture supports extension without rewriting the engine.

## Data model

Each annual record contains:

```json
{
  "schemaVersion": "alignment-ledger/1.0.0",
  "year": 2026,
  "equinox": {
    "utcInstant": "ISO-8601 UTC string",
    "patternPosition": { "moon": 13, "moonName": "Completion Seal", "day": 2, "dayOfPatternYear": 366, "weekGate": "...", "archetype": "..." },
    "lunarLayer": { "phaseName": "Waxing Crescent", "illuminationPercent": 12, "cyclePosition": 0.08 },
    "source": {}
  },
  "yearGate": {
    "instant": "ISO-8601 UTC string — April 17 00:00 UTC",
    "patternPosition": { "moon": 1, "moonName": "Seed Flame", "day": 1, "dayOfPatternYear": 1 }
  },
  "offsets": {
    "equinoxToYearGateMilliseconds": 0,
    "equinoxToYearGateDays": 0,
    "patternDayOffset": 0,
    "moonOffset": 0,
    "dayWithinMoonOffset": 0,
    "weekGateOffset": 0,
    "toneOffset": 0,
    "lunarCycleOffset": 0
  },
  "normalized": {
    "patternCyclePosition": 0,
    "equinoxCyclePosition": 0,
    "lunarCyclePosition": 0,
    "passageLengthPosition": 0
  },
  "signature": {},
  "sources": [],
  "generatedAt": "ISO-8601 timestamp"
}
```

## Year Gate definition

The Year Gate is Moon 1 · Day 1 of the Pattern Calendar = April 17 00:00 UTC each year.
This is derived from the Pattern Calendar epoch: April 17, 2026 = Moon 1 · Day 1.

## Passage

The Passage is the interval from the March equinox UTC instant to the Year Gate (April 17 00:00 UTC). Typical duration: 26–30 days.

## Normalized coordinates

All normalized values are in [0, 1]:

| Field | Derivation |
|---|---|
| `patternCyclePosition` | (dayOfPatternYear − 1) / 364 |
| `equinoxCyclePosition` | (equinoxMonth × 31 + equinoxDay) / 366 |
| `lunarCyclePosition` | synodic cycle position from known new moon epoch |
| `passageLengthPosition` | equinoxToYearGateDays / 40, clamped to [0, 1] |

## Measurement taxonomy

Records clearly distinguish:

- **direct-measurement** — calculated from timestamps and calendar definitions
- **normalized-coordinate** — scaled [0, 1] value derived from measurements
- **symbolic-mapping** — Pattern Calendar named layer (Week Gate, Archetype)
- **hypothesis-boundary** — explicit statement that recurrence ≠ causation

## Recurrence scoring

Nine dimensions, each scored 0–1:

1. Same Pattern Moon (boolean)
2. Same Moon Day (boolean)
3. Same Week Gate (boolean)
4. Same Archetype (boolean)
5. Same Tone (boolean)
6. Close Passage duration (continuous, tolerance: 6 hours)
7. Close equinox UTC time (continuous, tolerance: 6 hours)
8. Close lunar cycle position (continuous, tolerance: 0.05)
9. Close normalized sphere position (continuous, tolerance: 0.05)

`overallSimilarityScore` = unweighted average of all 9 scores (0–1).

Tolerances are configurable. The score and its components are fully exposed. No unexplained index is produced.

## Source data precision

- Equinox instants: whole-second UTC from janmr.com, validated against bazica.
- Maximum measured deviation: 2.057 seconds (2022).
- Lunar phase: approximate synodic calculation (known new moon 2000-01-06T18:14:00Z, period 29.530588853 days).
- Year Gate: defined date (April 17 00:00 UTC), not measured.

## Files

| File | Responsibility |
|---|---|
| `alignment-version.js` | Version constants, study range |
| `alignment-ledger-engine.js` | Builds annual records (no DOM) |
| `alignment-ledger-data.js` | In-memory cache layer |
| `alignment-comparison.js` | Year-to-year comparison |
| `alignment-recurrence.js` | Recurrence scoring |
| `alignment-offsets.js` | Offset extraction helpers |
| `alignment-signature.js` | Typed entry list |
| `alignment-export.js` | JSON, CSV, text exports |
| `alignment-url-state.js` | URL parameter round-trip |
| `alignment-ui.js` | DOM orchestration |

## Invariants

- All canonical records are deterministic: same inputs → same output.
- No live current-time state in canonical records.
- No DOM access in the engine layer.
- `generatedAt` field is a static build timestamp, not dynamic.
- No private Oracle or witness data in any exported record.
