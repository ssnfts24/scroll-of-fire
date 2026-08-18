# Living Interface Architecture V4

**Project:** Scroll of Fire / Codex of Reality  
**Target branch:** `codex/living-interface-architecture-v4-2026-08-18`  
**Purpose:** Advance the homepage, Living Time Sphere, 13 Moons calendar, and Life Atlas into one coherent, local-first, high-performance temporal operating system.

---

## 1. Guiding Objective

The Codex should evolve from a collection of pages and tools into one living interface where time, people, places, events, media, artifacts, observations, patterns, plans, and relationships share a canonical world model.

The interface should remain simple at first glance and become progressively more powerful as the user moves closer, zooms deeper, or requests more context.

The central design rule is:

> Greater complexity must produce greater clarity, not greater confusion.

---

## 2. Canonical Architecture

### 2.1 Canonical temporal state

There should be one authoritative temporal state shared by the homepage sphere, Living Time Observatory, Calendar Atlas, timeline, map, ledger, and future projections.

It should own:

- selected date
- selected year
- current/today state
- Moon/day position
- week/gate position
- timezone
- day-boundary mode
- selected historical reference
- comparison range
- semantic zoom level
- active temporal focus
- playback state

Views may render this state differently, but they should not redefine it.

### 2.2 Canonical Life Atlas model

The Life Atlas should be the underlying record system for:

- Event
- Entity / Person
- Place
- Media
- Artifact
- Observation
- Relation
- Temporal
- Environment
- Task
- Project
- Provenance

Every durable record should have:

- stable ID
- created/modified timestamps
- temporal placement
- provenance
- privacy state
- confidence/truth state
- relationships
- projection compatibility

---

## 3. Development Order

### Phase A — Stabilize and map the current system

1. Inventory all sphere-related scripts and styles.
2. Map homepage sphere dependencies.
3. Map full Observatory dependencies.
4. Identify duplicate temporal state.
5. Identify duplicate camera state.
6. Identify duplicate label logic.
7. Identify duplicate renderer logic.
8. Add tests before moving ownership between modules.
9. Document the shared interface contract.
10. Preserve all current working behavior during refactor.

Deliverable: a stable dependency map and shared-state contract.

---

## 4. Homepage Living Interface

The homepage sphere should remain lightweight but share the same temporal truth as the full Observatory.

### Required behavior

- fast first render
- correct today state
- shared temporal engine
- shared astronomical anchors
- touch-safe orbit
- controlled zoom
- selection
- proximity labels
- link into full Observatory
- no duplicate independent calendar logic
- no viewport-height layout gaps
- no hidden sections consuming space

### Homepage performance budget

The homepage must not instantiate every Observatory subsystem immediately.

Use progressive loading:

1. basic sphere geometry
2. today marker
3. Moon / week / year-gate geometry
4. labels
5. optional astronomy
6. deeper interactive features only after user engagement

---

## 5. Semantic Zoom

The sphere should behave recursively.

### Hierarchy

Century / Multi-year  
→ Year  
→ Moon  
→ Week / Gate  
→ Day  
→ Hours  
→ Time Blocks  
→ Events  
→ Records  
→ Media / Relationships / Provenance

Every level needs:

- entry threshold
- exit threshold
- visible-object policy
- label policy
- interaction policy
- camera policy
- density budget

### Transition rules

Zooming should not merely enlarge geometry.

It should change the meaning and granularity of the interface.

Example:

- far: year structure and major anchors
- medium: Moons, gates, seasons
- near: dates and selected patterns
- close: events and records
- very close: media, notes, relationships, provenance

---

## 6. Intelligent Labels

Labels should appear based on relevance rather than all at once.

### Visibility score inputs

- camera distance
- semantic zoom level
- selected state
- today state
- layer visibility
- historical importance
- event importance
- screen-space collision
- active task
- user preference

### Label tiers

**Tier 0:** year gate, today, equinoxes, solstices  
**Tier 1:** Moon labels, week gates, selected comparison years  
**Tier 2:** dates, major events  
**Tier 3:** event names, people, places  
**Tier 4:** notes, media, provenance, relationships

---

## 7. Onion-Layer Historical Architecture

Historical comparison should be a first-class geometry system.

### Core model

- selected year = primary shell
- neighboring years = adjacent strata
- distant years = simplified strata
- radial separation = chronological separation
- selected year retains full detail
- comparison years adapt detail based on distance and span

### Supported ranges

- 2 years
- 5 years
- 10 years
- 25 years
- 50 years
- 100 years
- 200 years

### LOD strategy

1–3 years: high detail  
4–10 years: moderate detail  
11–25 years: simplified labels  
26–50 years: anchor geometry  
51–100 years: trails and major markers  
101–200 years: aggregated/sampled structures

Never render 200 fully detailed years simultaneously.

---

## 8. Historical Comparison Modes

### Strata

Separate years radially like onion layers.

### Overlay

Align matching temporal positions for direct comparison.

### Spiral

Place years along a larger chronological spiral.

### Ghost

Display selected comparison years as subdued reference geometry.

### Difference

Show only deviations from a reference year.

### Alignment

Focus on astronomical and calendar anchors.

---

## 9. Astronomical Analysis Layer

Historical astronomy should become analytical, not decorative.

Potential anchors:

- March equinox
- June solstice
- September equinox
- December solstice
- lunar phases
- perigee / apogee when supported
- sunrise / sunset
- daylight duration
- solar declination
- lunar declination
- year gate
- Codex passages / alignment markers

### Historical trails

Provide optional trails for:

- equinox drift
- solstice drift
- year-gate movement
- selected date
- Moon start
- recurrence patterns

---

## 10. Temporal Alignment Plane

Add an optional reference plane through the sphere.

It can expose:

- equinox axis
- solstice axis
- year-gate axis
- selected-day radial
- angular offsets
- reference-year origin
- chronological displacement

The plane should allow users to understand measurable differences rather than relying only on visual impressions.

---

## 11. Object Interaction Contract

All sphere objects should eventually follow one interaction model.

### Tap

Select.

### Second tap / inspect

Open detail inspector.

### Long press

Open context actions.

### Drag

Move only in edit mode.

### Pinch

Semantic zoom.

### Orbit gesture

Rotate camera.

### Swipe

Temporal navigation where appropriate.

---

## 12. Edit Mode

Separate exploration from modification.

### Explore mode

Safe browsing with no accidental edits.

### Edit mode

Allows:

- move
- reschedule
- relocate
- rename
- attach media
- edit relationships
- change visibility
- duplicate
- archive
- delete

Destructive operations should support confirmation and ideally undo.

---

## 13. Unified Inspector

One adaptive inspector should support:

- Day
- Moon
- Event
- Person
- Place
- Artifact
- Media
- Astronomical marker
- Historical year
- Comparison result
- Relationship
- Pattern

The inspector should expose record-specific actions while maintaining consistent layout and navigation.

---

## 14. Calendar Expansion

The 13 Moons interface should continue toward a complete calendar operating system.

Target capabilities:

- scheduled events
- recurring events
- tasks
- reminders
- appointments
- attendees
- invitations
- availability
- all-day events
- multi-day events
- time zones
- sunset boundary handling
- conflict detection
- drag scheduling
- recurrence editing
- search
- saved views
- future/planned layer

All scheduled records should be visible across compatible projections.

---

## 15. Past / Present / Future Semantics

Records should explicitly distinguish:

- historical
- current
- planned
- projected
- symbolic

The interface should make these states visually distinguishable.

---

## 16. Provenance and Truth States

Every important record should be able to explain where it came from.

### Provenance examples

- user-created
- imported calendar
- imported social data
- uploaded media
- astronomical calculation
- inferred location
- manually corrected
- Codex-generated
- public/shared dataset

### Truth-state examples

- observed
- measured
- recorded
- reported
- inferred
- interpreted
- symbolic
- planned
- predicted
- disputed
- unknown

Symbolic interpretation must remain distinct from measured/calculated temporal truth.

---

## 17. Media Architecture

Prepare the Life Atlas for:

- photos
- videos
- audio
- documents
- scans
- voice notes

Each media object should preserve:

- capture time
- original time
- location
- source
- related event
- related people
- privacy state
- provenance

---

## 18. Location Architecture

Location records should distinguish:

- live position
- explicit check-in
- event location
- media location
- imported historical location
- inferred location
- approximate location

Location certainty should be visible.

---

## 19. External Import Pipeline

External integrations should use adapters.

External Source  
→ Raw Import  
→ Normalization  
→ Deduplication  
→ Identity Resolution  
→ Temporal Mapping  
→ Location Mapping  
→ Provenance Assignment  
→ Life Atlas Record

Never let imported data silently overwrite local records.

---

## 20. Identity Resolution

A single person may appear from multiple sources.

Support:

- canonical person IDs
- aliases
- platform identities
- contact identities
- manual merges
- reversible merge decisions
- merge history

---

## 21. Deduplication

Potential duplicates should be detected using:

- timestamp
- location
- participants
- title similarity
- external IDs
- media hashes
- neighboring records

Low-confidence duplicates should be suggested, not automatically merged.

---

## 22. Pattern Engine

Create a reusable pattern-query system.

Possible pattern classes:

- recurrence
- seasonal repetition
- location repetition
- relationship recurrence
- personal routines
- project cadence
- astronomical alignment
- artifact cycles

Every detected pattern should expose:

- supporting records
- dates
- query definition
- threshold
- exclusions
- confidence
- time span

---

## 23. Search and Command Interface

Unified search should eventually support:

- dates
- people
- places
- events
- artifacts
- projects
- media
- observations
- patterns

Future command examples:

- Go to April 17, 2026
- Compare 2026 with 2036
- Show every March equinox for 100 years
- Show events involving this person
- Show where I was during this Moon
- Show recurring patterns
- Return to today

Natural-language control should be an adapter over stable application commands, not the source of truth.

---

## 24. Saved Views

Saved views may preserve:

- date
- year
- projection
- active layers
- camera
- historical range
- label level
- location
- filters
- semantic zoom

Shareable URLs should preserve compatible state where privacy allows.

---

## 25. Performance Architecture

Mobile remains the primary performance target.

Track:

- first meaningful render
- JS payload
- object count
- label count
- DOM nodes
- frame time
- GPU pressure
- background jobs
- historical span complexity

### Render governor

Inputs:

- device capability
- frame rate
- object count
- active layers
- screen size
- semantic zoom

Outputs:

- geometry density
- effects quality
- label count
- historical sampling
- trail resolution

---

## 26. Incremental Rendering

Render progressively:

1. structural sphere
2. current temporal geometry
3. current labels
4. astronomy
5. historical layers
6. Life Atlas records
7. secondary effects

The first useful frame must not wait for all optional systems.

---

## 27. Workers and Cancellation

Heavy tasks should move toward Web Workers where useful:

- historical calculations
- recurrence expansion
- astronomy batches
- pattern scans
- clustering
- import normalization

Every expensive task should be cancellable or supersedable.

Old async work must never overwrite newer state.

---

## 28. Layer Lifecycle

Formalize layer lifecycle states:

- registered
- inactive
- requested
- loading
- active
- suspended
- failed
- disposed

Turning a layer off should release unnecessary resources.

---

## 29. Freeze Prevention

Stress-test:

- rapid layer toggling
- repeated date changes
- camera motion while layers load
- changing historical spans
- location changes
- background/foreground browser transitions
- repeated Today actions
- rapid semantic zoom changes

A feature is incomplete if it only works during slow sequential interaction.

---

## 30. Mobile Gesture Arbitration

Create one gesture arbiter that distinguishes:

- tap
- long press
- drag
- orbit
- pinch
- page scroll
- horizontal temporal swipe

The sphere must not trap normal page scrolling unnecessarily.

---

## 31. Accessibility

Provide non-3D access to all critical information.

Support:

- keyboard navigation
- reduced motion
- screen-reader summaries
- accessible inspector
- focus management
- touch target sizing
- high-contrast compatibility

---

## 32. URL State

Serializable state should include where appropriate:

- date
- year
- view
- projection
- layers
- marker
- comparison range
- timezone
- boundary
- semantic zoom
- camera preset

Use:

- schema versioning
- validation
- migration
- graceful fallback

One malformed URL value must never prevent the Observatory from loading.

---

## 33. Local-First Storage

Continue toward IndexedDB-backed Life Atlas storage.

Requirements:

- schema versions
- migrations
- transactions
- backup/export
- offline operation
- quota handling
- deterministic IDs where appropriate

---

## 34. Privacy

Privacy should exist at the record level.

Possible visibility states:

- private
- household
- trusted group
- selected share
- public
- aggregate-only

Imported data should default conservatively.

---

## 35. Collective Research Layer

Long-term shared use can support:

- citizen science
- community documentation
- environmental observation
- local history
- public resource mapping
- project coordination
- schools
- researchers
- public agencies
- nonprofits

Requirements:

- consent
- provenance
- methodology
- confidence
- privacy
- aggregation
- auditability

---

## 36. Artifact Registry Integration

Artifacts should become Life Atlas entities with links to:

- maker
- materials
- creation date
- place
- owner
- sale
- gift
- photos
- related experiment
- story
- valuation
- provenance
- privacy

Artifact records should be projectable into:

- Registry
- Sphere
- Timeline
- Map
- Ledger
- Network

---

## 37. Genesis Oracle Boundary

The Genesis Oracle may consume canonical temporal information but should not redefine it.

Maintain an architectural boundary between:

- measured/calculated time
- symbolic interpretation

This should be reflected in both data schemas and UI.

---

## 38. Environmental Context

Environmental providers may enrich records with:

- weather
- sunrise
- sunset
- temperature
- precipitation
- daylight duration
- Moon illumination
- seasonal context

Providers remain replaceable adapters.

---

## 39. Camera Intelligence

Camera movement should become semantic.

Selecting:

- year → frame year shell
- Moon → frame Moon
- day → approach day
- event → reveal event detail
- comparison → frame relevant strata

Respect reduced-motion preferences.

Future camera bookmarks:

- Today
- Whole Year
- Equinox Axis
- Year Gate
- Historical Stack
- Pattern View
- Life Atlas
- Moon Focus

---

## 40. Visual Grammar

Create consistent meanings for:

- today
- selected
- historical
- planned
- projected
- symbolic
- astronomical
- imported
- uncertain
- public/shared
- reference year
- comparison year

Visual effects should carry semantic meaning, not exist only for decoration.

---

## 41. Density Management

Use:

- clustering
- aggregation
- semantic filtering
- importance scoring
- zoom-based disclosure
- collision avoidance
- temporal bucketing

The interface should become more legible as data volume increases.

---

## 42. Diagnostics

Add optional developer diagnostics for:

- temporal cursor
- selected object
- projection
- renderer
- active layers
- object counts
- label counts
- render time
- async jobs
- storage version
- URL schema
- current LOD
- worker activity

---

## 43. Error Isolation

Optional subsystem failure must not kill the application.

Examples:

- weather fails → sphere continues
- astronomy enhancement fails → calendar continues
- comparison fails → current year remains
- external import fails → local data remains
- one layer fails → others remain usable

---

## 44. Testing Strategy

Expand tests by subsystem:

- canonical temporal state
- URL state
- semantic zoom
- comparison ranges
- label manager
- historical strata
- astronomical trails
- layer lifecycle
- gesture arbitration
- storage migrations
- recurrence
- imports
- deduplication
- privacy
- accessibility
- homepage synchronization
- Observatory synchronization

### Visual regression targets

- small Android portrait
- large Android portrait
- iPhone-sized viewport
- tablet
- desktop
- landscape
- standalone PWA
- browser with dynamic address bar

Critical pages:

- homepage top
- homepage sphere
- Core Gates
- Participation
- Governing Documents
- Observatory default
- dense historical comparison
- inspector

---

## 45. Immediate Coding Sequence

The next implementation work should follow this order:

1. Repository architecture audit.
2. Homepage sphere dependency map.
3. Observatory dependency map.
4. Canonical temporal-state ownership map.
5. Duplicate-state detection.
6. Shared interface contract.
7. Tests protecting current behavior.
8. Label/proximity improvements.
9. Semantic zoom state machine.
10. Historical year-strata model.
11. Adaptive 200-year LOD.
12. Equinox/solstice historical trails.
13. Alignment-plane prototype.
14. Unified inspector.
15. Gesture arbiter.
16. Render-budget diagnostics.
17. Stress testing.
18. Life Atlas projection expansion.
19. Editing/manipulation.
20. Calendar scheduling expansion.
21. Import framework.
22. Pattern intelligence.
23. Collective research/sharing architecture.

---

## 46. Definition of Success

A user should be able to begin with:

**Where am I in time?**

Then move outward:

**How does this moment relate to the year?**

Then historically:

**How does this year relate to other years?**

Then inward:

**What happened here?**

Then relationally:

**Who, what, where, and why connects to this moment?**

Then analytically:

**Has this pattern happened before?**

Then prospectively:

**What is planned next?**

All of this should occur without switching between incompatible models of time.

---

## 47. Core Principle

The sphere should not merely display information around a globe.

It should become a navigable projection of a coherent temporal world model.

The calendar should not merely count days.

It should become an interface for navigating lived time.

The Life Atlas should not merely store records.

It should preserve relationships between moments, places, people, artifacts, observations, plans, media, and evidence.

The entire Codex should feel like one living system.
