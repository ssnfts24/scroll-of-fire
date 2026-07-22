# Remnant Phase 1.1 — Profile Stabilization Report

**Date:** 2026-07-22  
**PR:** #61 — Remnant Phase 1.1: Stabilize Oracle Profiles and Daily Mirror  
**Status:** In Review (draft)

---

## Storage Key Audit

| Key | Owner | Type | Notes |
|-----|-------|------|-------|
| `sofGenesisProfilesV2` | `OracleProfileRepository` | Active / primary | All Oracle 2.0 profiles. Read and written exclusively via repository. |
| `sofGenesisProfiles` | `OracleProfileRepository` (read-only) | Legacy / migration source | Pre-2.0 records discovered on initialize. Repository reads; UI does not write. |
| `sofGenesisLegacyImports` | `OracleProfileRepository` | Persistence key for imported legacy | Imported legacy records that must survive reload. Written by `importProfiles()`. |

**Removed:** `GenesisOracleStorage` is no longer called directly by UI code (`genesis-oracle.js`). It remains available as a lower-level adapter but all UI paths use `OracleProfileRepository`.

---

## Root Cause of Missing Profiles

Profiles were missing from Mirror Through My Seal due to two compounding bugs:

1. **Direct `GenesisOracleStorage.readProfiles()` calls in UI code** bypassed `OracleProfileRepository` state. `runCompare()`, `refreshLegacySelector()`, and fallback branches in save/import all read storage directly, producing a split state where some UI views saw profiles and others did not.

2. **`_readRaw` swallowed parse errors silently**, returning `[]` on malformed JSON. This caused the repository to enter the `"empty"` state rather than `"error"`, hiding the failure from both the user and the Mirror's retry path.

---

## Changes Made

### `docs/assets/js/oracle/oracle-profile-repository.js`

- **`_readRaw`** now returns `{ ok, data }` or `{ ok: false, error: { code, message, storageKey } }`. Codes: `STORAGE_UNAVAILABLE`, `PARSE_ERROR`, `INVALID_FORMAT`.
- **`_writeRaw`** now returns `{ ok }` or `{ ok: false, error: { code, message, storageKey } }`. Codes: `STORAGE_UNAVAILABLE`, `QUOTA_EXCEEDED`, `WRITE_DENIED`, `WRITE_NOT_VERIFIED`. Includes read-after-write verification.
- **`initialize()`** propagates `_readRaw` failures directly to `{ status: "error", error: { code, message, storageKey } }` — no longer swallowed.
- **`saveProfile()`** propagates `_writeRaw` failures; throws if write fails so callers can report the error accurately. Sets status to `"error"`. Adds `birthTimeLayer` and `schemaVersion: 1` to every stored record.
- **`importProfiles()`** persists imported legacy records to `STORAGE_KEY_LEGACY_IMPORTS` so they survive page reload.
- **`_toLegacyWrapper()`** computes a stable deterministic ID using a djb2-style hash of `name|birthDate|birthTime` — no `Math.random()`.
- **`initialize()`** reads `STORAGE_KEY_LEGACY_IMPORTS` and merges those records alongside `STORAGE_KEY_LEGACY`.
- Exports `STORAGE_KEY_LEGACY_IMPORTS` and `SCHEMA_VERSION` on the frozen API object.

### `docs/assets/js/genesis-oracle.js`

- **All direct `GenesisOracleStorage` calls removed.** If `OracleProfileRepository` is unavailable, functions return gracefully with a status message rather than falling back to the old adapter.
- **`runCompare()`** now reads profiles via `repo.getProfile(idA)` / `repo.getProfile(idB)` using stable profile IDs.
- **`renderProfiles()`** comparison selectors now set `option.value = profile.id` (stable ID) instead of `String(index)` (array position).
- **`_buildProfilePickerItem()`** replaced `li.innerHTML = \`...\`` with explicit DOM element creation. Name, birth date, moon name, day, and version label are all assigned via `textContent`. No user-supplied value is ever interpolated into an HTML string.
- **`recalcLegacy()`**, **save profile handler**, **both import handlers**, **`refreshLegacySelector()`**, and **`GenesisOracle.readProfiles`** all use repository exclusively.

### `docs/service-worker.js`

- Added `"./assets/js/oracle/oracle-profile-repository.js"` to `optionalPaths` so it is cached during PWA install. Ensures PWA does not continue serving an old controller that reads profiles independently after an update.

### `docs/assets/js/moons-version.js`

- Incremented to `2026.07.22.3` (from `2026.07.22.2`). Forces service-worker cache bust and ensures previously installed PWAs receive:
  - the new `oracle-profile-repository.js`
  - the updated `genesis-oracle.js`
  - the updated `genesis-oracle.html`
  - the updated CSS

### `docs/genesis-oracle.html`

- All asset version query strings updated to `?v=20260722-3`.

---

## Migration Behaviour

- Legacy records in `sofGenesisProfiles` are discovered on `initialize()` and wrapped into in-memory `legacyProfiles[]`. They are **not** moved or deleted from their original key.
- Imported legacy records (via `importProfiles()`) are additionally persisted to `sofGenesisLegacyImports` so they survive reload. Deduplication by deterministic ID prevents duplicates.
- `migrateLegacyProfile(id)` runs Oracle 2.0 recalculation and saves a new v2 profile with `migratedFromLegacyId` and `originalLegacyRecord` metadata.

---

## Import Persistence

Imported legacy profiles now write to `sofGenesisLegacyImports`. On next `initialize()`, this key is merged with the standard legacy key before deduplication. The same deterministic fingerprint ensures the same physical record produces the same ID regardless of import path.

---

## Error Behaviour

The repository state machine now reaches `"error"` for:

| Condition | `error.code` |
|-----------|-------------|
| `localStorage` unavailable | `STORAGE_UNAVAILABLE` |
| Malformed JSON in V2 key | `PARSE_ERROR` |
| Stored value is not an array | `INVALID_FORMAT` |
| Write fails (storage full) | `QUOTA_EXCEEDED` |
| Write fails (policy/security) | `WRITE_DENIED` |
| Write not verifiable | `WRITE_NOT_VERIFIED` |

In all error cases the `error` object carries `{ code, message, storageKey }`. The Mirror's retry button becomes visible whenever `status === "error"`.

---

## Security Treatment

`_buildProfilePickerItem()` in `genesis-oracle.js` no longer uses template-literal innerHTML to render profile name, birth date, moon name, day, or version label. Each value is assigned via `element.textContent`. This prevents XSS from any imported profile that contains `<img>`, `<script>`, quotes, ampersands, or Unicode direction controls.

---

## Tests Added

**File:** `tests/oracle-profile-stabilization.test.js` — 31 tests covering:

1. Repository-only access (no direct `GenesisOracleStorage` in UI)
2. Both storage keys read on initialize
3. Malformed JSON → `"error"` state with `{ code, message, storageKey }`
4. Non-array stored data → `INVALID_FORMAT` error
5. `localStorage` unavailable → `STORAGE_UNAVAILABLE` error
6. Quota exceeded on write → `QUOTA_EXCEEDED` + throws
7. Write denied → `WRITE_DENIED` + throws
8. Deterministic legacy IDs (same record → same ID across isolated VMs)
9. Legacy ID stability (five repeated loads produce identical ID)
10. Imported legacy profiles persist after reload (via `STORAGE_KEY_LEGACY_IMPORTS`)
11. `selectProfile` stores stable ID not array index
12. `getSelectedProfile` returns correct profile after selection
13. `runCompare` uses `repo.getProfile` not `GenesisOracleStorage`
14. Comparison selectors use `profile.id` not `String(index)`
15. `saveProfile` preserves `birthTimeLayer`
16. `saveProfile` adds `schemaVersion: 1`
17. No personalized output before selection
18. Personalized output after selection
19. Profile deletion clears selection
20. Non-selected profile deletion preserves selection
21. Legacy discovery from `sofGenesisProfiles`
22. Deduplication across legacy and import keys
23. Subscriber pattern emits on state change
24. Re-initialization picks up externally written profiles (cross-tab simulation)
25. `_buildProfilePickerItem` does not use `innerHTML` with user data
26. User values not interpolated into `innerHTML` (XSS audit)
27. Read-after-write verification confirms storage persistence
28. Service worker caches `oracle-profile-repository.js`
29. `genesis-oracle.html` loads `oracle-profile-repository.js`
30. Origin isolation notice present
31. Production hostname referenced in origin check

---

## Service-Worker Cache Version

Incremented: `2026.07.22.2` → `2026.07.22.3`

Cache names affected:
- `sof-13-moons-core-2026.07.22.3`
- `sof-13-moons-runtime-2026.07.22.3`
- `sof-13-moons-images-2026.07.22.3`

Old caches (`*-2026.07.22.2`) are deleted on `activate`. Previously installed PWAs will receive the updated controller, repository, and HTML on next service-worker activation.

---

## CI / CodeQL / Gate Results

| Gate | Result |
|------|--------|
| Canonical repository | **PASS** |
| Production-profile discovery | **PASS** |
| Legacy discovery | **PASS** |
| Imported legacy persistence | **PASS** |
| Storage error visibility | **PASS** |
| Secure imported rendering | **PASS** |
| General Mirror separation | **PASS** |
| Mirror Through My Seal | **PASS** |
| Personalized-share state | **PASS** |
| Tests (231 total, 31 new) | **PASS** |
| CI | Pending |
| PWA cache update | **PASS** |
| Android / iPhone / installed PWA | **REQUIRES OWNER DEVICE TEST** |

> Do not merge while any software gate is FAIL. Android, iPhone, and installed PWA validation must be completed by the repository owner on physical devices.
