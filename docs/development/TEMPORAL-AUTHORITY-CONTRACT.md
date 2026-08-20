# Temporal Authority Contract — Phase A.2

**Project:** Scroll of Fire / Codex of Reality <br>
**Branch:** `codex/living-interface-architecture-v4-2026-08-18`

## Purpose

Formalize the authority boundaries already present in the working system so future work removes competing authority without collapsing useful separation between controllers, projections, persistence, renderers, and analytical state.

## Canonical temporal authority

### AUTHORITATIVE — `SOFTemporalCursor`

File: `docs/assets/js/calendar/temporal-cursor-controller.js`

`SOFTemporalCursor` is the canonical cross-projection authority for the currently selected temporal instant / civil-date coordinate.

Canonical events:
- `sof:temporal-cursor-change`
- `sof:temporal-cursor-ready`
- `sof:temporal-cursor-lock-change`

Other interfaces may request cursor changes. They should not establish a second canonical selected date.

## Sphere state

### CONTROLLER / PRESENTATION — `LivingTimeSphereState`

File: `docs/assets/js/sphere/living-time-sphere-state.js`

Sphere state may own analytical and presentation state such as selected analytical year, comparison year, visible layers, view mode, renderer preference, quality, motion, labels, connection mode, historical range, and selected marker.

`selectedYear` is not necessarily a second temporal instant. It may represent the analytical year shell, comparison year, or nearest supported astronomical/alignment year.

## Full Sphere UI

### CONTROLLER / BRIDGE

File: `docs/assets/js/sphere/living-time-sphere-ui.js`

The full Observatory UI may request cursor changes and translate cursor state into sphere presentation state. The existing `_applyTemporalCursorToSphere()` and `_wireTemporalCursorBridge()` are the intended synchronization path.

It should not create independent temporal truth when `SOFTemporalCursor` is available.

## Calendar Workbench

### CONTROLLER

File: `docs/assets/js/sphere/living-time-calendar-workbench.js`

The Calendar Workbench may request date selection through `SOFTemporalCursor`. Workbench-local UI state may remain local.

## Homepage Living Interface

### CONTROLLER + PROJECTION

File: `docs/assets/js/home-living-interface.js`

The homepage may display canonical selection, request Previous / Today / Next navigation, preserve temporal coordinates in projection links, emit homepage presentation events, and display Life Atlas records relative to selection.

`sof:home-temporal-selection` is a domain/presentation event, not a replacement for the canonical cursor event bus.

## Homepage Observatory Instrument

### ADAPTER / MOUNT CONTROLLER

File: `docs/assets/js/home-observatory-instrument.js`

This owns lazy mounting, viewport lifecycle, homepage renderer activation, runtime status, and homepage performance profile. It does not own canonical time.

## Life Atlas temporal bridge

### ADAPTER

File: `docs/assets/js/life-atlas/life-atlas-temporal-bridge.js`

This is the canonical integration path between Life Atlas and `SOFTemporalCursor`. It may observe cursor changes, expose temporal context, build projection context, and emit Life Atlas temporal notifications.

It must not introduce another source of temporal truth.

## Life Atlas world model / builder / scene graph

### DERIVED MODEL

These transform canonical temporal and record data into spatial worlds. They may own scene nodes, semantic hierarchy, spatial positions, visibility windows, relationships, and semantic expansion state.

They must not replace `SOFTemporalCursor`.

## Life Atlas world navigation

### SPATIAL NAVIGATION CONTROLLER

World navigation may own spatial focus, breadcrumbs, fly-through state, camera targets, and semantic world depth.

Spatial focus is not automatically canonical temporal selection. Selecting a concrete temporal node may deliberately request a cursor change through a bridge.

## Life Atlas persistence

### PERSISTENCE

The repository and IndexedDB own durable records and temporal fields attached to records. They do not own the active selected date.

## Life Atlas projections

### PROJECTION

Projection adapters transform records for sphere, timeline, map, ledger, network, calendar, and context views. They should not mutate records or own temporal truth.

## Scheduling

### RECORD MUTATION, NOT TEMPORAL AUTHORITY

Scheduling may create or update temporal fields on records. That does not make scheduling the owner of the active temporal cursor.

## Temporal Strata

### DERIVED ANALYTICAL STATE

File: `docs/assets/js/sphere/living-time-sphere-temporal-strata.js`

Temporal Strata may own span, direction, strata mode, depth, evidence-only mode, chronology, trajectory, and year-gate display. It computes analytical historical windows without becoming canonical time authority.

## Semantic zoom

### DERIVED VIEW STATE

Semantic zoom controls information density and depth. Camera movement or semantic-band changes must not silently alter the canonical temporal cursor.

## Camera

### PRESENTATION CONTROLLER

Camera state may own orbit, distance, target, presets, transitions, and framing. Camera movement must not silently rewrite temporal selection.

## Renderers

### PROJECTION ONLY

SVG, Canvas, and 3D renderers consume model/state. Renderer-local caches such as selected year are not authority.

## Label manager

### DERIVED PRESENTATION

Labels may depend on selection, camera, semantic zoom, importance, collision, layers, and Today state. Labels never own selection truth.

## Today

### COMMAND / TRANSACTION

Today resolves a canonical target and updates dependent presentation state coherently. It should converge on canonical cursor state rather than bypass it.

## URL state

### SERIALIZATION / RESTORATION ADAPTER

URL restore should apply canonical temporal selection through the canonical controller, then restore sphere presentation, historical comparison, camera, and layer state separately.

Malformed presentation parameters must not corrupt canonical time.

## Storage boundaries

Different storage systems may remain because they serve different domains:

- `CodexState` — lightweight cross-page state
- `CodexMemory` — personal continuity / witness memory
- Life Atlas IndexedDB — durable structured life records
- Observatory Workspace — workspace drafts and preferences
- Sphere local storage — presentation preferences
- Environment storage — provider/location/unit preferences

The goal is not one giant database. The goal is one authority per concept.

## Event vocabulary

Canonical temporal events:
- `sof:temporal-cursor-change`
- `sof:temporal-cursor-ready`
- `sof:temporal-cursor-lock-change`

Projection/domain events may include:
- `sof:home-temporal-selection`
- `sof:life-atlas-temporal-change`
- `living-time:strata-change`
- `sphere:year-select`
- `sphere:marker-select`
- `livingtime:selectionchange`
- `livingtime:layerschange`

Domain events should not become competing canonical date buses.

## Preferred flow

User interaction <br>
→ controller <br>
→ `SOFTemporalCursor` when canonical temporal selection changes <br>
→ canonical cursor event <br>
→ Sphere / Calendar / Life Atlas / Homepage adapters <br>
→ derived models and projection state <br>
→ renderer / labels / camera

Historical analytical controls may instead update Sphere analytical state and Temporal Strata without changing canonical time until the user explicitly selects a concrete temporal point.

## Prohibited flow

Avoid:
- renderer → canonical date mutation
- camera distance → canonical date mutation
- Life Atlas projection → independent selected instant
- homepage local state → permanent cursor drift
- historical range → canonical instant mutation
- imported record date → silent active-cursor change

## Phase A.2 implementation priorities

1. Add automated authority-contract tests.
2. Confirm homepage navigation converges on the shared cursor when available.
3. Confirm Sphere cursor bridge cannot create feedback loops.
4. Confirm Life Atlas bridge ignores stale/reentrant cursor events.
5. Keep analytical `selectedYear` distinct from canonical selected instant.
6. Document URL restore order.
7. Add diagnostics for canonical cursor, sphere analytical year, marker, semantic zoom band, camera state, strata range, and Life Atlas spatial focus.
8. Stress-test rapid Previous / Today / Next.
9. Stress-test Calendar → Sphere → Life Atlas synchronization.
10. Stress-test historical exploration while canonical selection remains stable.

## Non-negotiable invariant

The system may have many derived representations of time.

It should have only one canonical temporal cursor.

Everything else is a controller asking to change it, an adapter translating it, derived analytical state, spatial focus, projection, renderer, or persistence attached to records.
