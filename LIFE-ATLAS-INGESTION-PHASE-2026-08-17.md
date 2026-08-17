# Codex Life Atlas — Historical Ingestion + Temporal Projection Phase

## Purpose
Turn the Living Time Observatory from a calendar visualization into a local-first temporal atlas capable of receiving a person's own historical records and projecting them into the same Pattern-time geometry used by the Sphere.

## Core rule
One fact is stored once; every view is a projection. Calendar, Sphere, Timeline, Map, Ledger and future Network views must not maintain competing copies of the same event.

## Epistemic separation
The product must visibly distinguish:
- observed/imported source evidence
- user-confirmed corrections
- inferred groupings or probable places
- calculated astronomical/calendar values
- forecasts
- future plans/intentions
- symbolic/Codex interpretations

No inference may silently overwrite imported source evidence.

## Privacy and security defaults
- Imports are parsed locally in the browser.
- Imported LifeRecords begin `private`, `containsPersonalData=true`, `shareAllowed=false`.
- Social archive JavaScript is parsed as JSON after removing assignment wrappers; it is never executed.
- Large text files are capped at 24 MB per file in this mobile-first phase to reduce browser crashes.
- Duplicate records use deterministic source/timestamp/content fingerprints.
- Imported items begin `reviewState=unreviewed`.

## Implemented in this phase
1. Local Life Atlas runtime backed by IndexedDB with memory fallback.
2. Import adapters for `.ics`, JSON/JS archive files and CSV.
3. Heuristic recognition for X, Meta, TikTok and Google-location style exports.
4. Normalization into canonical LifeRecords with time, place, provenance, confidence and privacy.
5. Pattern coordinate conversion for dated records.
6. Explicit staging before commit: analysis never automatically saves.
7. Duplicate-safe commit into the local repository.
8. Sphere projection of imported records onto visible year membranes at their Pattern-day angle.
9. Selected Pattern-day records receive stronger markers.
10. Record markers are pickable in WebGL and identify their source record.
11. Offline service-worker awareness for the new modules.

## Deliberately not implemented yet
- Direct OAuth social account connections. These require platform-specific application registration, permissions, terms review and token security.
- ZIP decompression in-browser. Users can extract a social archive and select its JSON/JS/CSV files in this phase.
- Photo EXIF extraction. This should be a separate streaming/media worker so tens of thousands of photos do not freeze mobile browsers.
- Person recognition/face recognition.
- Automatic publication or sharing.
- Automatic event merging without review.

## Required next phases
### Phase B — Reconciliation Engine
Cluster records by temporal proximity, coordinate/place proximity and source relationship. Produce proposals such as “possible journey” rather than facts. Users can Confirm, Split, Merge or Reject.

### Phase C — Media Index
Stream photo/video metadata; extract timestamps, original filenames, dimensions and EXIF GPS when present. Store media handles/references separately from LifeRecord metadata. Generate thumbnails lazily.

### Phase D — Timeline + Map
Two additional projections of the same records. Map must fuzz or hide location according to privacy precision. Timeline must support semantic zoom from lifetime to day/hour.

### Phase E — Temporal Laboratory
A/B years, same Pattern coordinate across decades, tolerances, density envelopes, equinox/solstice tracks, recurrence queries, and provenance-aware comparison.

### Phase F — Connected Accounts
OAuth adapters should land behind a provider boundary and feed the same ingestion pipeline. Tokens must never be embedded in the static GitHub Pages client. Use a secure backend/token broker where a provider requires secrets or refresh-token custody.

## Performance constraints
The Sphere must not render one permanent object for every imported record. Current projection caps visible markers by quality tier. Later builds should add clustering/density fields, instanced geometry and viewport/semantic-zoom filtering.

## Design principle
Simple at first glance; deep on demand. The user should be able to answer “what day is it?” instantly, then progressively reveal “what happened here before?”, “where was I?”, “what was happening around me?”, and “what future plans occupy this coordinate?” without confusing possibility with evidence.
