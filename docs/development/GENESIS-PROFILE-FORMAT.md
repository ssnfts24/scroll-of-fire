# Genesis Profile Format — the Living Genesis Profile record

**Status:** Canonical. This document specifies the saved Genesis Oracle
profile format precisely, so every surface that reads or writes it — the
online Oracle today, the Spark. Living Day app's Gate C import next —
builds against the same record.

**Named by:** Aaron's direction, Nov 23, 2026 — the online Genesis Oracle
works the same way as the app's Living Genesis Profile: create the profile
once, save it permanently, and the whole Codex recognizes it. You do not
re-run the Oracle to see your own information.

**Canonical writer/reader:** `docs/assets/js/oracle/oracle-profile-repository.js`
(`OracleProfileRepository`). On the Oracle page, all modules go through the
repository; no module reads the storage keys directly. One sanctioned
exception: the Sphere's companion layer (`sphere-genesis-layer.js`) reads
the profile array read-only to find the designated profile, because the
Sphere page does not load the Oracle stack.

## Storage

Profiles live in the keeper's browser `localStorage`, on the origin that
served the page. They are never transmitted anywhere. Storage is per
site-address: profiles saved on `codexofreality.org` do not appear on a
preview or mirror address (the Oracle page says so where it matters).

| Key | Contents |
| --- | --- |
| `sofGenesisProfilesV2` | JSON array of Oracle 2.0 profile records (below), newest first, capped at 80. |
| `sofGenesisProfiles` | Legacy (pre-2.0) flat records, kept unchanged. Read and wrapped in memory; never overwritten by 2.0 code. |
| `sofGenesisLegacyImports` | Legacy records that arrived by import, persisted so they survive reload. Same flat legacy shape. |

## The Oracle 2.0 profile record

```jsonc
{
  "id": "profile-<epoch-ms>-<suffix>",   // stable, unique per record
  "schemaVersion": 1,
  "calendarVersion": "pattern-calendar/…",  // engine that produced `calculated`
  "oracleVersion": "genesis-oracle/2.0.0",  // engine that produced `calculated`
  "createdAt": "<ISO 8601>",
  "myGenesis": true,                     // OPTIONAL — see "My Genesis"
  "input": { … },                        // the keeper's declared inputs
  "calculated": { … },                   // deterministic engine outputs
  "interpretation": { … },               // the composed reading + methods
  // Optional provenance, present only on derived entries:
  "migratedFromLegacyId": "legacy-…",
  "originalLegacyRecord": { … },
  "migrationTimestamp": "<ISO 8601>",
  "recalculatedFromId": "profile-…",
  "originalProfileRecord": { … },
  "recalculationTimestamp": "<ISO 8601>"
}
```

### `input` — the original inputs, kept as their own thing

Written once from the reading's declared inputs and never edited by any
recalculation:

| Field | Meaning |
| --- | --- |
| `name` | Full name as entered (may be empty). |
| `birthDate` | Civil date of birth, `YYYY-MM-DD`. This is the keeper's **civil birthday** fact, retained as itself — distinct from the Pattern birth position in `calculated`. |
| `birthTime` | Birth time `HH:MM`, or `""` when not provided. |
| `timeKnown` | Boolean — whether `birthTime` was actually provided. |
| `timeZone` | IANA time zone the birth moment was read in. |
| `boundaryMode` | `"midnight"`, `"sunset"`, or `"manual"`. |
| `sunsetTime` | `HH:MM` used when the boundary mode needs it. |

### `calculated` — what the engine produced from those inputs

Produced by `GenesisOracleEngine.run` under the record's stamped
`calendarVersion` / `oracleVersion`, via the one canonical Pattern
Calendar (`PatternCalendar.fromCivilDate`) — there is no second clock.

| Field | Contents |
| --- | --- |
| `patternPosition` | `patternYear`, `moonNumber` (1–13 or null outside), `moonName`, `dayInMoon` (1–28 or null), `dayOfPatternYear`, `patternWeekNumber`, `weekGate {title, meaning}`, `dayArchetype {name, meaning}` or null, `civilWeekday`, `boundaryMode`, `outsideDayStatus {outsideCountedYear, isDayOutOfTime, isDeepTimeDay, intercalaryIndex}`, and the normalized `input` the position was derived with. |
| `coreSignature` | `moonKey`, `dayKey`, `weekGate`, `tone` (1–13), `toneProfile`, `resonantSum`, `element {moonElement, dayElement, relationship, explanation}`, `carrier {…, hz, reduction}`, `livingLaw`, `flamePath`, `primaryArchetype`, `supportingArchetype`, `challengeArchetype`, `returnPractice`, `derivation` (the formulas, as text). |
| `nameSignature` | The name-code outputs (Latin-Pythagorean, A1–Z26, Hebrew, covenant seal, vowel/consonant totals, initials code, full-name reduction, dominant number, missing numbers). `fullNameReduction` feeds the Seal derivation. |
| `birthTimeLayer` | The birth-time gate reading, plus `timezone` and `source` (`"provided-local-time"` or `"time-unknown"`). |
| `relationships` | `nameToBirthResonance`, `elementRelationship`. |

### `interpretation`

| Field | Contents |
| --- | --- |
| `reading` | The composed reading object, including `quickSeal` (the one-line Seal text), `foundation`, `naturalGift`, `tension`, `developmentPath`, `witnessPractice`, `practicalAction`. |
| `methods` | The methods record: normalization notes, the calendar result, formulas used, name-code values, relationship rules, tone/resonant analysis, version stamps, and the calculated/symbolic/reflective distinctions. |

### The Seal of Becoming

The seal is not stored as an image; it is **derived deterministically**
from the signature wherever it is shown, by the derivation in
`genesis-oracle.js` (`buildSealSvg`), ported verbatim by the Sphere's
Genesis layer: moon, day, tone, carrier Hz, and `fullNameReduction`
shape the figure; the label reads `M<moon> · D<day> · T<tone>` (or
`Outside · T<tone>` for a birth outside the counted year). Same record,
same seal, on every surface.

## My Genesis

- At most one record in `sofGenesisProfilesV2` carries `"myGenesis": true`:
  the keeper's own standing Genesis profile — the one the Oracle page
  opens on, the Daily Mirror reads through by default, and the Sphere
  highlights.
- The flag lives **on the record**, so it persists across visits and
  travels with export/import.
- Designation moves only through `OracleProfileRepository.setMyGenesis(id)`
  (which clears the flag everywhere else), with one exception: the
  **first-save rule** — when the very first Oracle 2.0 profile is saved
  and none is designated, that profile is designated. Later saves never
  take the designation silently.
- Deleting the designated profile leaves **none** designated; nothing is
  auto-promoted.
- Import rule: a standing designation on this device outranks an imported
  one. If a kept profile already carries the flag, imported flags are
  stripped; otherwise the first imported flag is kept and the rest
  stripped.
- Legacy records cannot hold the designation; recalculate one first.

## Recalculation never overwrites

- A stored reading stands exactly as saved, under its stamped versions,
  forever. Opening a profile renders `calculated` + `interpretation`
  from the record — it does not re-run the engine over the birth inputs.
- The only day-dependent pieces — the Daily Mirror and the current-day
  transit — are computed fresh when a reading opens, because they belong
  to today; they are never written back into the record.
- Recalculating (a legacy profile via `migrateLegacyProfile`, or a 2.0
  profile via `recalculateProfile`) produces a **new entry**, marked with
  its provenance fields and carrying the original record inside it. The
  original entry is not modified. The Genesis designation does not
  transfer to the recalculation on its own.

## Import / export

- Export is the JSON array of records (one profile or all), exactly as
  stored. Import accepts that array (merging by default), validates each
  record's shape (versions, `createdAt`, `input`, `calculated`,
  `interpretation` present), wraps legacy-shaped records as legacy, and
  applies the My Genesis import rule above.
- The app (Spark. Living Day, Gate C) imports this same array format;
  automatic website↔phone synchronization is future Gate G work and does
  not exist yet.

## Versioning

- `schemaVersion: 1` is the record schema. New optional fields (as
  `myGenesis` was, Nov 23, 2026) are additive and do not bump the schema;
  readers ignore fields they do not know.
- Readings are stamped with the producing `oracleVersion`
  (`genesis-oracle/2.0.0`) and `calendarVersion`. A profile saved under
  an older version stays readable and stands as saved; the Oracle page
  says plainly when a newer Oracle is current.
