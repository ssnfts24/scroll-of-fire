# Codex of Reality — Living Time / Life Atlas Master Site Plan

Date: 2026-08-17
Status: active architecture directive

## Core definition

The Codex should behave as one coherent instrument rather than a collection of pages.

The central idea is simple: a calendar should not only answer **what day is it?** It should help a person locate **where they are in time, what has been recorded, what is present, what is planned, what repeats, what changes, and what their own life has placed into that structure**.

The 13 × 28 Pattern is the stable coordinate anatomy. Astronomy, civil calendars, environment, witness records, scheduled events, media, relationships, projects, places, historical evidence, and future intentions are layers projected around that coordinate system. No layer is allowed to silently change the meaning of another.

The design language should therefore distinguish three temporal states everywhere:

- **Past / Record** — things that happened, were measured, were logged, or are historically sourced.
- **Present / Being** — the selected live state and observations available now.
- **Future / Possibility** — schedules, intentions, tasks, scenarios, planned events, and forecasts with explicit provenance. Future geometry is never presented as prophecy or certainty.

This becomes the conceptual spine of the entire site.

## One model, many projections

The Life Atlas remains the canonical model. Pages are projections of that model:

- **Today / 13 Moons** — immediate daily orientation.
- **Living Time Sphere** — spatial temporal projection.
- **Calendar Atlas** — planning, scheduling, recurring events, tasks, appointments, availability.
- **Timeline** — chronological life/history projection.
- **Ledger** — witness and evidence projection.
- **Map** — place/environment/journey projection.
- **Network** — people, relationships, projects, entities, and provenance.
- **Alignment Ledger** — historical astronomical comparison and recurrence study.
- **Genesis Oracle** — symbolic reflection projection, explicitly separated from measured evidence.

Every projection must share the same temporal cursor. Changing the selected instant in one projection should describe the same instant everywhere else.

## The Living Time Sphere

### Stable core

The 13 Moons remain geometrically stable at the center. Moon 1–13 and Day 1–364 are coordinates, not animated decoration.

### Temporal strata

Years are thin membranes around the Pattern core. The selected year is the active membrane. Past years move inward. Future/planning years can move outward. A span can scale from 13 to 200 years without changing the central coordinate system.

At small spans, individual years are visible. At large spans, visual density is governed by level of detail while all analytical years remain available to selection and calculation.

### Pattern corridors

Selecting a Pattern day creates a corridor through all visible year membranes. Selecting a Moon creates a wider Moon-sector corridor. This allows the eye to compare the same Pattern coordinate through historical layers rather than looking at unrelated loops.

The first corridor implementation is included in the 2026-08-17 patch.

### Trajectory registry

Astronomical or historical paths must be registered by type and provenance. Initial trajectory classes:

- March equinox
- September equinox
- June solstice
- December solstice
- Year Gate
- Passage start/end
- lunar state where supported
- environment measurements where historically supported
- user-selected event series

Structural guide lines and evidence trajectories must never share the same visual semantics.

### Semantic zoom

The sphere should eventually move continuously through:

**centuries → years → Moon → week/gate → day → hours → events/media/relationships**

Zoom does not merely enlarge geometry. It changes the semantic level of the interface while preserving the same selected time.

## A reality-state interface

Every major temporal surface should answer five questions without making the user decode the graphics:

1. **Where am I?** — selected Pattern coordinate, civil date, year, timezone, boundary.
2. **What state is this?** — past, present, or future/planning.
3. **What is structural?** — Pattern, calendar boundaries, coordinate guides.
4. **What is observed or sourced?** — astronomy, environment, historical records, provenance.
5. **What belongs to me?** — witness records, events, media, people, projects, intentions.

The 2026-08-17 patch adds the first `Reality State` panel to the Temporal Lens.

## Calendar Atlas requirements

The calendar layer should become a serious planner, not a novelty calendar. Required capabilities:

- day/week/month/13-Moon/year views
- civil and Pattern date shown together without conflating them
- events with start/end/timezone
- recurring events
- tasks and due dates
- reminders/alarms
- appointments and attendee-ready schema
- availability blocks
- projects and milestones
- journeys/travel
- notes and media
- location
- relationship/entity links
- provenance
- privacy state
- planned vs completed vs cancelled states

Scheduled future objects should appear on the Sphere as planning markers, clearly separate from observed historical objects.

## Personal Life Atlas

The calendar becomes profound when the person can see their own life in it.

The local-first Atlas should support records such as:

- birth and family milestones
- moves and places lived
- work history
- relationships
- creations and projects
- trips and journeys
- photographs/video/audio
- witness observations
- health/body signals only when the user intentionally records them
- artifacts made or acquired
- goals and intentions
- major decisions
- scheduled future events

The system should allow a person to ask questions such as:

- What was happening in my life the last time I was at this Pattern position?
- Which places, people, or projects recur around the same season or Moon?
- How has my environment changed across years?
- What did I plan, what actually happened, and what changed?
- Which patterns are real records and which are only interpretations?

These questions should be answered descriptively, with provenance, not as claims of causation.

## History Atlas

The same architecture can hold public history when sources are available. Historical data should enter as external records with explicit provenance and confidence.

A user could select a year, Moon, day corridor, location, or phenomenon and compare:

- sourced historical events
- astronomical positions
- climate/environment datasets
- cultural records
- personal/family records
- projects or institutional records

Personal and public history must remain separable through privacy and provenance controls.

## Evidence and interpretation boundary

Every record should carry a truth/provenance class. Recommended user-facing vocabulary:

- **Observed** — directly measured or recorded.
- **Sourced** — imported from an identified source.
- **Calculated** — derived deterministically from a documented method.
- **User Record** — entered by the user.
- **Planned** — future intent or schedule.
- **Forecast** — future estimate from a named provider/model.
- **Symbolic** — interpretive or reflective layer.
- **Inferred** — system-generated relationship or recurrence score.

Symbolic reflection is valuable, but it must not visually masquerade as astronomy, weather, or historical evidence.

## Site-wide information architecture

The current site should progressively converge around five understandable gateways:

### Today

13 Moons, Today Sphere, Witness Ledger, immediate reflection, live fields.

### Atlas

Living Time Sphere, Calendar Atlas, Timeline, Map, Alignment Ledger, historical comparison.

### Explore

Theory, Canon, Genesis Oracle, Glossary, Systems Archive, whitepapers.

### Build

Frequency Governance, Living Technology, Remnant Lab, tools, experiments, projects.

### Participate

Witness, Covenant Caravan, Artifact Registry, Circle, public research/contribution when sharing architecture is ready.

The existing URLs do not need to be broken to accomplish this. Navigation can be progressively relabeled and grouped while preserving compatibility.

## Visual language

The entire site should use the same visual grammar:

- Pattern / structural coordinates: cyan-green family.
- Selected/present state: warm gold.
- Past/history/record: quiet blue-gray.
- Future/planning/possibility: teal-green distinct from live evidence.
- Measured/calculated evidence: brighter gold/amber point or trajectory.
- Symbolic reflection: violet or another explicitly separate family.
- Private/user-owned data: visually marked with privacy state, never silently published.

Color alone must never carry meaning; labels, shapes, line styles, and accessibility text must reinforce it.

## Mobile-first interaction

The phone is a primary instrument, not a reduced desktop view.

- one-finger drag = orbit
- pinch = zoom / semantic scale
- tap = select
- horizontal temporal scrub = day/week/Moon movement
- long press = inspect/provenance
- bottom-sheet inspector rather than giant fixed desktop panels
- progressive disclosure for technical controls
- GPU budgets adapt to device tier
- no mode should require Play to initialize geometry

## Reliability rules

1. The first complete scene must be visible without user interaction.
2. Any state arriving while Three.js initializes must be queued and committed after initialization.
3. Play animates the temporal cursor; it never acts as an initialization trigger.
4. Location/weather failures cannot freeze the calendar.
5. Heavy layers cannot destroy the selected Pattern geometry.
6. Renderer fallback must preserve data access.
7. Every deployed HTML page and local reference remains audit-clean.
8. Every feature receives deterministic tests where practical.
9. Service-worker/cache versioning must be bumped for changed runtime assets.
10. Public-facing future geometry must be labeled planning/forecast/possibility according to provenance.

## Build sequence

### Phase 1 — First-frame reliability and temporal semantics

Included now:

- extension initial-sync before interaction
- queued refreshes during async 3D initialization
- Living Strata enabled declaratively on first load
- balanced past/present/future shell window
- distinct past and future shell semantics
- selected Pattern day corridor across year shells
- selected Moon corridor boundaries
- Reality State panel
- cache-busted runtime assets
- regression tests

### Phase 2 — Shell interaction

- raycast year membranes
- tap shell to select year
- peel/scrub through time depth
- selected shell inspector
- mobile haptic-friendly selection behavior where supported

### Phase 3 — Comparison engine

- A/B years
- reference year pin
- difference-only view
- recurrence scoring with explanation
- nearest-match highlighting
- confidence and provenance panel
- equinox/solstice trajectory registry

### Phase 4 — Semantic zoom

- year → Moon → week → day
- day → hour/time block
- event/media/entity detail
- camera presets derived from semantic level rather than isolated buttons

### Phase 5 — Calendar Atlas completion

- recurring schedules
- tasks/reminders
- event editing
- timeline synchronization
- future planning projection on Sphere
- import/export adapters

### Phase 6 — Personal Life Atlas

- media
- people/relationships
- projects
- places/journeys
- artifact records
- witness integration
- search
- Life Atlas inspector across every projection

### Phase 7 — Historical/public Atlas

- sourced public datasets
- provenance browser
- compare personal/public layers without mixing ownership
- optional aggregate/public research architecture

### Phase 8 — Site-wide consolidation

- unified navigation vocabulary
- consistent component hierarchy
- page-level purpose statements
- standardized provenance/truth labels
- performance and accessibility pass across all routes
- PWA/offline reliability pass
- SEO/schema pass after information architecture settles

## Definition of success

A person opens the Codex and can understand the current day immediately. They can move backward and see record. They can move forward and see plans and possibilities without being told the future is known. They can zoom outward and see years as layers. They can zoom inward and find a day, an event, a photograph, a person, a place, or a witness record. They can compare without confusing recurrence with causation. They can distinguish measured reality from symbolic reflection. They can use the same system as a calendar, planner, personal archive, historical viewer, and research instrument.

The result should feel less like a website containing a calendar and more like a coherent **temporal atlas of lived reality**.
