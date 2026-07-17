# Living Codex — Phase 2: Codex Memory

**Status:** Complete  
**Production site:** https://codexofreality.org  
**Implemented:** July 2026

---

## What Was Implemented

Phase 2 adds safe local continuity between visits. Every time a visitor returns to the Codex, the site can display a useful continuation of their previous activity — without accounts, remote storage, or invasive tracking.

All Phase 2 data is stored locally in the visitor's browser using `localStorage`. It is never transmitted or shared.

---

## Files Created

| File | Purpose |
|------|---------|
| `docs/assets/js/codex-memory.js` | Shared Codex Memory module (`window.CodexMemory`) |
| `docs/assets/css/codex-memory.css` | Phase 2 UI styles |
| `tests/living-codex-phase2.test.js` | Phase 2 focused tests |
| `docs/LIVING-CODEX-PHASE-2.md` | This document |

---

## Files Modified

| File | Change |
|------|--------|
| `docs/index.html` | Added codex-memory.css, codex-memory.js; upgraded Continue Your Path panel with dismiss, practice row, since-visit section, 7-day markers, intention selector, memory privacy controls |
| `docs/assets/js/living-codex.js` | Extended `saveReturnState()`, `renderHomeState()`, and `setup()` to call Phase 2 functions; added `renderPhase2ContinuePanel()`, `renderPhase2SevenDay()`, `renderPhase2IntentionSelector()`, `setupPhase2IntentionPicker()`, `setupPhase2MemoryControls()` |
| `docs/assets/js/frequency-governance.js` | Added CodexMemory hooks to `saveJournal()` and `loadPath()` |
| `docs/ledger.html` | Added codex-memory.js; extended `addEntry()` to call `CodexMemory.recordWitness()` |
| `docs/moons.html` | Added codex-memory.js, codex-memory.css; added memory continuity card to Today panel |
| `docs/systems/frequencies.html` | Added codex-memory.js |

---

## Storage Schema

### Key

```
sof.codexMemory.v1
```

### Memory Version

```
SCHEMA_VER = 1
```

### Stored Object Shape

```json
{
  "version": 1,
  "createdAt": "<ISO 8601>",
  "updatedAt": "<ISO 8601>",
  "lastVisitAt": "<ISO 8601>",
  "lastPage": {
    "title": "Witness Ledger",
    "path": "./ledger.html",
    "chamber": "Witness Ledger"
  },
  "dailyIntention": {
    "value": "build",
    "selectedAt": "<ISO 8601>",
    "calendarDate": "2026-07-17",
    "moonNumber": 4,
    "moonDay": 7
  },
  "unfinishedPractice": {
    "id": "sof-abc123-xyz",
    "title": "Stone Witness Flow",
    "sourcePage": "./moons.html",
    "relatedMoon": 4,
    "relatedIntention": "build",
    "startedAt": "<ISO 8601>",
    "status": "started",
    "stepNumber": null,
    "completedAt": null
  },
  "recentWitness": {
    "id": "sof-def456-abc",
    "date": "<ISO 8601>",
    "label": "Stone Witness Day 4",
    "moonNumber": 4,
    "moonName": "Stone Witness",
    "moonDay": 7,
    "pagePath": "./ledger.html"
  },
  "recentFrequency": {
    "presetName": "Calm Path",
    "carrier": "432 Hz",
    "startedAt": "<ISO 8601>",
    "completedAt": null,
    "sourceUrl": "https://codexofreality.org/systems/frequencies.html",
    "relatedIntention": "restore",
    "moonNumber": 4,
    "moonName": "Stone Witness"
  },
  "recentMoonReading": null,
  "currentCycle": {
    "moonNumber": 4,
    "moonDay": 7,
    "witnessedDays": ["2026-07-14", "2026-07-15", "2026-07-17"],
    "lastWitnessedDate": "2026-07-17"
  },
  "preferences": {
    "signalExpanded": false,
    "resumeDismissedUntil": ""
  },
  "recentActions": [
    {
      "type": "visit",
      "label": "Witness Ledger",
      "path": "./ledger.html",
      "timestamp": "<ISO 8601>",
      "meta": { "chamber": "Witness Ledger" }
    }
  ]
}
```

---

## Custom Events

| Event | When fired | `detail` |
|-------|-----------|---------|
| `codexmemorychange` | After any `window.CodexMemory` state change | `{ state }` or `{ reset: true }` |

---

## Public API — `window.CodexMemory`

| Method | Description |
|--------|-------------|
| `getState()` | Returns a copy of the full memory state |
| `update(partialState)` | Merge partial state into memory |
| `recordVisit(data)` | Record a meaningful page visit |
| `recordAction(data)` | Record a user action (duplicate-aware) |
| `getResumePath()` | Best continuation suggestion or `null` |
| `clearSessionMemory()` | Clear last-page data only |
| `exportMemory()` | Return full state as exportable object |
| `importMemory(data)` | Import compatible memory |
| `setIntention(value)` | Set daily intention |
| `getIntention()` | Get intention with `isPriorDay` flag |
| `clearIntention()` | Clear intention only |
| `startPractice(data)` | Start or resume a practice |
| `updatePracticeStatus(status)` | Update practice status |
| `clearPractice()` | Clear practice only |
| `recordWitness(data)` | Record lightweight witness reference |
| `recordFrequency(data)` | Record lightweight frequency reference |
| `getSevenDaySummary()` | Seven-entry array of daily activity markers |
| `getChangesSinceLastVisit(cs)` | Verified list of changes since last visit |
| `dismissResumeToday()` | Hide Continue Your Path until tomorrow |
| `isResumeDismissed()` | Whether the panel should be hidden |
| `resetAll()` | Reset all Phase 2 memory |
| `syncCycle(cs)` | Update stored cycle state from CodexState |

---

## Recorded Action Types

| Type | When |
|------|------|
| `visit` | Meaningful page visit (deduplicated within 60 s) |
| `intention` | Daily intention selected or changed |
| `practice-start` | Practice started |
| `practice-paused` | Practice paused |
| `practice-completed` | Practice completed |
| `practice-dismissed` | Practice dismissed |
| `witness` | Witness entry recorded |
| `frequency` | Frequency session started or saved |

---

## History Limits

| Item | Limit |
|------|-------|
| `recentActions` | 20 entries (rolling window) |
| `currentCycle.witnessedDays` | 365 dates |

---

## Integration with 13 Moons

- `codex-memory.js` is loaded on `docs/moons.html`
- A compact memory continuity card (`#moonsMemoryCard`) appears in the Today panel
- The card shows: current intention, unfinished practice, recent witness, recent frequency, witnessed-day count
- The card is hidden for first-time visitors or when no memory exists
- The card re-renders on `codexmemorychange`
- No existing 13 Moons app logic was modified

---

## Integration with Witness Ledger

- `codex-memory.js` is loaded on `docs/ledger.html`
- When `addEntry()` is called (user saves a witness), it calls `CodexMemory.recordWitness()`
- Only a lightweight reference is stored: date, label (truncated to 100 chars), moon state, page path
- The full note text is NOT duplicated into CodexMemory
- The existing `scroll_of_fire_witness_ledger_v3` key is untouched

---

## Integration with Frequency Governance

- `codex-memory.js` is loaded on `docs/systems/frequencies.html`
- When a path is loaded (`loadPath`), a frequency reference is recorded via `CodexMemory.recordFrequency()`
- When a witness is saved (`saveJournal`), an updated reference with completion time is recorded
- Raw audio data is never stored
- Auto-play on return is never triggered — the visitor must manually start audio (preserving iPhone audio handling)
- The existing `sof_frequency_governance_journal_v2` key is untouched

---

## Privacy Controls

The homepage "Your Codex" panel includes Phase 2 memory controls:

| Control | Action |
|---------|--------|
| View Memory | Display summary of stored memory (local only) |
| Export Memory | Download `codex-memory-<date>.json` |
| Import Memory | Merge compatible export file |
| Clear Intention | Remove daily intention only |
| Clear Practice | Remove unfinished practice only |
| Reset Phase 2 Memory | Clear all Phase 2 data |

Before resetting, the UI explains what will be removed and requires a confirm dialog.

The "Continue Your Path" panel has a "Dismiss" button that hides it for the rest of the day.

---

## Export / Import Format

The export is the raw JSON state object (schema version 1). The import function validates the schema version before merging. If the import is newer than the current state, it replaces the state. If older, it fills in gaps only.

---

## Fallback Behavior

- When `localStorage` is unavailable, `CodexMemory.storageAvailable()` returns `false`
- All operations degrade gracefully — no errors thrown
- The Continue Your Path panel stays hidden when there is no memory
- The intention selector still renders (selections are not persisted)
- The 7-day summary shows no active days
- The site remains fully usable without JavaScript

---

## Known Limitations

- `recordWitness` generates a local ID when none exists — this is not synced to the ledger entry's actual hash
- `getChangesSinceLastVisit` only reports changes that can be derived from stored state — it does not fetch external data
- The 7-day markers use `recentActions` timestamps; actions recorded before Phase 2 is deployed will not appear
- The frequency integration records when `loadPath` is called; if the user does not actually play audio (e.g. audio is blocked), the session is still recorded as started
- The moons.html continuity card uses inline script for simplicity; a future phase could move this to a dedicated module

---

## Migration Guidance

Phase 2 introduces one new localStorage key: `sof.codexMemory.v1`. No existing keys are modified or removed.

When upgrading to Phase 3:
- Increment `SCHEMA_VER` to 2
- Add a `migrate(oldState)` function that maps v1 → v2
- Call `migrate()` in the `load()` path before storing the validated state
- Document the migration in a Phase 3 document

---

## Boundaries Between Phase 2 and Later Phases

Phase 2 is limited to local continuity. It does not implement:

- ❌ Phase 3: Responsive environment / visual constellation  
- ❌ Phase 5: Public activity-feed system  
- ❌ Phase 7: Personal constellation  
- ❌ User accounts or remote storage  
- ❌ External analytics  
- ❌ Cross-device sync  

The `recentActions` array provides the data foundation for future phases but is kept limited to 20 entries to avoid unbounded growth.
