# Codex Life Atlas Architecture

Status: Foundation Specification
Project: Scroll of Fire / Codex of Reality
Branch family: `feat/codex-life-atlas-*`
Architecture generation: 1
Established: 2026-08-16

---

# 1. Vision

The Codex of Reality is evolving from a collection of pages and instruments
into a unified temporal observatory capable of representing a person's lived
experience across time.

The central system is the:

# CODEX LIFE ATLAS

The Life Atlas is a local-first temporal knowledge system that can eventually
represent:

- days
- moments
- memories
- witnesses
- intentions
- practices
- journeys
- places
- people
- relationships
- artifacts
- projects
- discoveries
- calendar coordinates
- astronomical conditions
- environmental conditions
- photographs
- video
- audio
- documents
- links
- notes
- recurring patterns
- milestones
- life eras
- future plans

The goal is not simply to make a larger calendar.

The goal is to create an instrument through which time, memory, environment,
pattern, and lived experience can be explored together.

The Life Atlas must remain useful even if every symbolic interpretation is
removed.

Measured data, calculated data, personal records, and interpretive layers must
remain distinguishable.

---

# 2. Core Architectural Rule

## The Life Atlas is the model.
## The Sphere is a projection of the model.

The Living Time Sphere must never become the database.

The Sphere is one visualization of a deeper temporal model.

Other projections include:

- Calendar Atlas
- Timeline
- Map
- Network
- Ledger
- Archive
- Today view
- Year Map
- Life Map
- media browser
- recurrence explorer
- future planning view

All projections consume shared canonical records.

No projection should invent its own competing date, calendar, astronomy, or
identity calculations.

---

# 3. Existing Authorities

Existing canonical systems remain authoritative until deliberately migrated.

These include:

- PatternCalendar
- temporal-coordinate-engine
- temporal-cursor-controller
- Calendar Atlas
- Living Time Sphere model
- Alignment Ledger
- CodexState
- CodexMemory
- Genesis Oracle profile repository
- Witness Ledger
- environment state
- astronomy engines
- location command
- PWA infrastructure

Life Atlas must integrate these systems rather than silently duplicate them.

---

# 4. Canonical Life Record

Every Life Atlas record uses a common envelope.

Conceptual schema:

```text
LifeRecord
  id
  schemaVersion
  type
  subtype
  title
  summary

  temporal
    instant
    start
    end
    timezone
    boundaryMode
    civilDate
    patternYear
    moon
    moonDay
    patternDay
    week
    weekGate
    outsideDay

  spatial
    latitude
    longitude
    altitude
    placeId
    placeLabel
    precision

  relations[]
  tags[]

  provenance
    sourceType
    sourceId
    createdAt
    updatedAt
    importedAt
    confidence
    calculationAuthority

  privacy
    visibility
    containsPersonalData
    shareAllowed

  payload

---

# 5. Initial Record Types

The architecture must support at minimum:

- witness
- memory
- intention
- practice
- milestone
- journey
- place
- person
- relationship
- artifact
- project
- event
- observation
- astronomical-event
- environmental-observation
- calendar-marker
- note
- media
- document
- link
- frequency-session
- oracle-reading
- quest
- plan

Additional record types must be extensible without database redesign.

---

# 6. Temporal Coordinate

Every temporal record should be capable of carrying multiple synchronized
coordinates.

Civil:
- ISO date/time
- timezone
- UTC instant

Pattern Calendar:
- Pattern year
- Moon 1-13
- Moon Day 1-28
- Pattern Day 1-364
- Week 1-4
- Week Gate
- Day Out of Time
- Deep Time Day where applicable

Astronomical:
- solar season
- equinox/solstice relation
- lunar phase
- lunar illumination
- lunar age
- sunrise
- sunset
- moonrise
- moonset

Environmental where available:
- temperature
- conditions
- wind
- pressure
- cloud cover
- daylight

The canonical temporal engine remains the authority.

---

# 7. Local-First Life Store

Life Atlas personal data must be local-first.

Target browser storage:

IndexedDB

Do not expand localStorage into the primary Life Atlas database.

localStorage may continue to hold:

- lightweight preferences
- feature flags
- selected state
- small compatibility state

IndexedDB should eventually hold:

- life records
- entities
- relationships
- media metadata
- indexes
- migrations
- attachment references
- import metadata

Proposed logical stores:

records
entities
relations
media
indexes
settings
migrations

---

# 8. Privacy

Privacy is architectural, not cosmetic.

Default personal Life Atlas records:

PRIVATE / LOCAL ONLY

A share operation must never automatically include:

- witness bodies
- private notes
- personal media
- exact location
- private relationships
- birth information
- imported personal data

Sharing must use explicit projections or sanitized share payloads.

Existing privacy guardrails must remain intact.

---

# 9. Provenance and Truth Layers

Every displayed datum should eventually be classifiable as one of:

- MEASURED
- CALCULATED
- IMPORTED
- USER-RECORDED
- INFERRED
- SYMBOLIC
- INTERPRETIVE
- APPROXIMATE

The interface should make these distinctions inspectable.

Symbolic interpretation must not masquerade as measured astronomy or physical
observation.

---

# 10. Media Architecture

Life Atlas should be designed for media compatibility from generation one,
even before full binary media storage is implemented.

Media records may represent:

- image
- video
- audio
- document
- external URL
- generated artifact
- thumbnail
- transcript

Initial implementation may store metadata and references only.

Future implementations may support:

- File System Access API where available
- IndexedDB blobs
- imported archive packages
- thumbnails
- media timelines
- geotag extraction
- timestamp extraction
- captions
- transcripts
- media clusters

Media must never be required for the core temporal model to function.


---

# 11. Relationship Graph

Records may connect to other records.

Examples:

- person -> journey
- journey -> place
- place -> photograph
- photograph -> day
- day -> witness
- witness -> artifact
- artifact -> project
- project -> milestone
- milestone -> person

Relations should use explicit edges rather than deeply nested duplicated data.

Conceptual relation:

Relation
  id
  fromId
  toId
  type
  createdAt
  metadata

Possible relation types:

- occurred-at
- occurred-on
- involves
- created
- witnessed
- related-to
- inspired-by
- part-of
- before
- after
- during
- revisits
- resembles
- supports
- contradicts

---

# 12. Life Timeline

The Timeline is a primary Life Atlas projection.

It should eventually support:

- hour
- day
- week
- Moon
- year
- multi-year
- whole-life scales

Timeline entries can include:

- memories
- witness records
- photographs
- videos
- journeys
- projects
- people
- artifacts
- astronomical events
- Pattern Calendar gates
- milestones

Semantic zoom must control density.

Zooming outward should cluster information rather than simply drawing
everything smaller.

---

# 13. Living Time Sphere

The Sphere should evolve into a living temporal observatory.

Potential visual layers include:

CALENDAR
- 13 Moon sectors
- 364 exact day positions
- week gates
- outside days
- selected day
- Today
- temporal cursor

SOLAR
- equinoxes
- solstices
- solar season
- daylight
- sunrise/sunset relation

LUNAR
- phase
- illumination
- lunar age
- moonrise/moonset
- lunar markers

ENVIRONMENT
- weather
- temperature
- cloud state
- wind
- daylight state

LIFE
- witnesses
- memories
- milestones
- journeys
- artifacts
- projects
- people
- media

RELATION
- connections
- recurrence
- selected-to-Today
- entity relationships

HISTORY
- year spiral
- historical alignment
- life-year rings
- eras

FUTURE
- plans
- quests
- intentions
- projected milestones

The renderer must not draw all information simultaneously.

Semantic zoom, layer controls, clustering, selection, and performance budgets
are mandatory.

---

# 14. Sphere Interaction

Target interaction vocabulary:

Tap:
select temporal object

Swipe:
move through neighboring days or temporal coordinates

Drag:
rotate sphere

Pinch:
zoom

Two-finger twist:
camera/orientation rotation where supported

Long press:
inspect or open action menu

Double tap:
focus selected coordinate

Today:
return through canonical Today transaction

Timeline scrub:
move temporal cursor

Play:
animate temporal movement

All interactions must preserve vertical page scrolling on mobile.

---

# 15. Semantic Zoom

The observatory must become more detailed as the user approaches information.

Example bands:

FAR
- year
- seasons
- major gates
- life eras

MID
- Moons
- major events
- journeys
- milestones

NEAR
- weeks
- records
- people
- media clusters

DETAIL
- individual days
- exact records
- media
- witness information

FOCUS
- selected record
- relationships
- provenance
- contextual measurements

Existing semantic zoom architecture should be extended rather than replaced.

---

# 16. Life-Year Rings

The existing historical spiral may eventually become capable of representing
personal years.

Possible structure:

center/current shell:
current Pattern year

outer/inner historical shells:
prior years

Life events may appear at their corresponding temporal coordinates.

This permits visual comparison of:

- same Pattern coordinate across years
- recurring locations
- recurring people
- recurring activities
- seasonal behavior
- project cycles
- major life eras

No claim of causation should be generated from visual recurrence alone.

---

# 17. Recurrence Engine

Life Atlas may identify repeatable structural similarities.

Potential dimensions:

- calendar coordinate
- season
- lunar phase
- location
- people
- tags
- project
- activity
- environmental conditions
- user-defined classifications

Every recurrence result should expose why it matched.

Example:

Similarity: 0.78

Shared context:
- Moon 4
- Week 2
- same location region
- same project
- similar lunar phase

Recurrence is exploratory evidence, not proof of causal relationships.

---

# 18. Life Map

Spatial projection should eventually support:

- visited places
- journeys
- routes
- media locations
- witness locations
- artifacts
- recurring regions
- astronomical/environment context

Exact coordinates remain private unless explicitly shared.


---

# 19. People and Relationship Layer

Life Atlas should support people as first-class entities without turning the
system into a social network.

A person record may contain:

- display name
- relationship
- optional notes
- first-known date
- last interaction date
- associated places
- associated journeys
- associated projects
- associated memories
- associated witnesses
- associated media
- tags

People should be connected through the relationship graph rather than copied
into every record.

Privacy defaults must be strict.

Personal information about another person must not become publicly shareable
merely because it exists in the local Atlas.

---

# 20. Projects and Creations

Projects should be capable of developing through time.

Examples:

- Codex of Reality
- research
- artifacts
- books
- experiments
- construction
- travel
- creative work

A project may connect:

Project
  -> milestones
  -> sessions
  -> places
  -> people
  -> media
  -> documents
  -> artifacts
  -> witnesses
  -> temporal coordinates

This allows Life Atlas to answer questions such as:

- When did this project begin?
- What happened during its development?
- Where was I working on it?
- What records are connected to it?
- What changed between milestones?
- Which other projects overlap with it?

Project state should remain user-defined and inspectable.

---

# 21. Journey Model

A journey is more than a collection of GPS points.

Conceptual structure:

Journey
  id
  title
  start
  end
  status
  origin
  destination
  waypoints[]
  people[]
  records[]
  media[]
  projects[]
  notes[]
  temporalContext
  spatialContext

Possible statuses:

- planned
- active
- paused
- completed
- archived

Journeys may range from:

- a walk
- a day trip
- camping
- a road trip
- multi-state travel
- long-duration travel
- historical movement

Route precision must be privacy-aware.

---

# 22. Artifact Layer

Physical creations may exist as Life Atlas entities.

An artifact can connect to:

- creation date
- completion date
- materials
- creator
- project
- location
- photographs
- witness records
- registry identifier
- shop record
- story
- provenance

The Atlas should reuse the existing artifact registry where possible.

It must not silently create a second conflicting artifact authority.

---

# 23. Witness Integration

Witness records are direct observations or user-created records.

Life Atlas should reference the existing Witness Ledger rather than replace it.

A witness may become visible in:

- Timeline
- Sphere
- Map
- project history
- journey history
- recurrence exploration
- day inspection

Witness content remains subject to its own privacy rules.

Private witness text must never leak into:

- public URLs
- default share text
- analytics
- public exports

---

# 24. Genesis Oracle Integration

Genesis Oracle profiles may optionally contribute symbolic context.

This integration must remain separate from measured temporal or astronomical
data.

Possible links:

Person
  -> Oracle profile reference

Day
  -> Daily Mirror reference

Relationship
  -> symbolic comparison reference

Oracle-derived information must be labeled as symbolic interpretation.

It must never be represented as measured astronomical fact.

Life Atlas should consume the existing Genesis Oracle profile repository rather
than create another profile storage system.

---

# 25. Astronomy Layer

Astronomical data should remain inspectable and source-aware.

Potential fields include:

SOLAR
- sunrise
- sunset
- solar noon
- day length
- solar altitude
- solar azimuth
- equinox
- solstice

LUNAR
- phase
- illumination
- lunar age
- moonrise
- moonset
- altitude
- azimuth

SKY
- twilight
- selected astronomical events
- future extensible celestial observations

Every value should distinguish:

- measured
- externally sourced
- calculated
- interpolated
- approximate

Astronomy must not depend on Life Atlas personal records.

---

# 26. Environment Layer

Life Atlas may associate environmental context with temporal coordinates.

Potential data:

- weather condition
- temperature
- apparent temperature
- precipitation
- cloud cover
- wind
- humidity
- pressure
- daylight state

Existing environment state and weather-provider architecture should remain the
authority.

Environment data must be optional.

Failure to obtain weather must never prevent:

- calendar operation
- Sphere rendering
- record creation
- Timeline use
- offline startup

---

# 27. Search and Discovery

Life Atlas should eventually provide unified local search.

Searchable concepts may include:

- dates
- Pattern dates
- people
- places
- journeys
- projects
- artifacts
- witnesses
- media
- tags
- notes

Examples:

"Moon 4 Day 14"

"things I created in 2026"

"records from this place"

"journeys connected to this project"

"photographs from Moon 7"

"days similar to this one"

"what happened here last year"

Search should return references to canonical records rather than duplicate
objects.

Search must work without requiring cloud services.

---


# 28. Import Architecture

Life Atlas should support controlled import without allowing imported data to
silently become canonical truth.

Potential import sources:

- Life Atlas JSON
- Life Atlas archive packages
- iCalendar
- CSV
- GPX
- GeoJSON
- media metadata
- Witness exports
- existing Codex records

Import pipeline:

source
  -> parse
  -> validate
  -> normalize
  -> preview
  -> conflict detection
  -> user confirmation
  -> canonical record creation
  -> provenance attachment

Imported records must preserve their source.

Invalid records should be rejected or quarantined rather than partially
accepted without explanation.

---

# 29. Export Architecture

Users must be able to leave with their data.

Potential export formats:

- canonical JSON
- portable archive package
- CSV where appropriate
- iCalendar
- GeoJSON
- GPX
- readable text summaries

Exports should distinguish:

- complete private archive
- selected records
- public/share-safe export

Private information must never enter a public export merely because it exists
in the same canonical record.

---

# 30. Offline-First Operation

Life Atlas should remain useful without connectivity.

Core offline capabilities should eventually include:

- calendar navigation
- Sphere navigation
- Timeline
- record creation
- record editing
- local search
- saved places
- projects
- journeys
- witnesses
- cached astronomy where available
- export

Network-dependent features must degrade independently.

Examples:

weather unavailable
  != calendar unavailable

map tiles unavailable
  != journey records unavailable

remote media unavailable
  != Timeline unavailable

No optional network service may become a hard dependency for the Atlas.

---

# 31. Storage Architecture

Initial storage should remain local-first.

Recommended progression:

Phase A:
existing localStorage repositories where already authoritative

Phase B:
IndexedDB Life Atlas store

Phase C:
optional media/blob storage

Phase D:
optional encrypted synchronization architecture

Conceptual IndexedDB stores:

records
relations
tags
places
media
imports
settings
searchIndex

Large media should not be serialized into ordinary localStorage.

Storage migrations must be versioned.

A failed migration must not silently destroy prior data.

---

# 32. Performance Budgets

Life Atlas must remain usable on constrained mobile devices.

The system should assume that some users have:

- limited RAM
- low GPU capability
- WebGL1 only
- high device pixel ratio
- unstable browser lifecycle
- background tab eviction
- poor network connectivity

Performance rules:

- never render every record simultaneously
- cluster dense data
- virtualize long lists
- lazily load media
- lazily load nonessential engines
- cache stable geometry
- batch renderer mutations
- avoid full Sphere rebuilds for day changes
- cap pixel ratio through capability management
- stop animation when nothing changes
- respect reduced motion
- release GPU resources on teardown

The Life Atlas data layer must remain usable even if 3D rendering is refused.

---

# 33. Renderer Independence

Life Atlas is not a WebGL application.

It is a data and temporal system that may use WebGL as one projection.

Required presentation tiers:

1. 3D Sphere
2. SVG visualization
3. Data Table
4. Text/accessibility representation

The canonical model must survive renderer changes.

No renderer may become calculation authority.

---

# 34. Mobile Interaction Requirements

Mobile is a primary platform.

Required behavior:

- page scrolling remains available
- one-finger Sphere gestures must not trap the page
- touch targets remain usable
- controls fit narrow screens
- dense controls collapse progressively
- orientation changes recover safely
- renderer initialization waits for valid dimensions
- browser lifecycle restoration does not duplicate render surfaces

Swipe-through-time should be deliberate.

A horizontal day gesture must not accidentally trigger during ordinary vertical
page scrolling.

Gesture interpretation should consider:

- movement direction
- movement threshold
- velocity
- active control
- renderer state

---

# 35. Accessibility

Every major Life Atlas function should have a nonvisual path.

Requirements:

- semantic controls
- keyboard navigation where applicable
- screen-reader descriptions
- text representation of selected temporal state
- reduced-motion support
- adequate control labels
- no information encoded only by color
- accessible Timeline summaries
- accessible relationship descriptions

A user should be able to inspect the meaning of the Sphere without seeing the
Sphere.

---

# 36. Share Architecture

Sharing should create deliberate snapshots, not expose the private Atlas.

Possible share targets:

- selected day
- selected journey
- selected project
- selected artifact
- selected public witness
- selected map region
- selected recurrence result

Share generation must pass through a privacy filter.

Default share payloads should exclude:

- private notes
- precise private coordinates
- personal profile inputs
- private witness text
- hidden people
- local storage identifiers

Public URLs should encode state necessary to reconstruct the public view, not
private record bodies.

---

# 37. Provenance Interface

Users should be able to inspect where important information came from.

Example provenance labels:

CALCULATED
Pattern Calendar
Canonical temporal engine

MEASURED
Device or observation source

PROVIDER
Weather or external data provider

IMPORTED
Named file or archive

USER
Manual entry

SYMBOLIC
Genesis Oracle or interpretive layer

APPROXIMATE
Interpolated or estimated value

The interface should avoid presenting these categories as equivalent forms of
evidence.

---

# 38. Truth and Interpretation Boundary

Life Atlas may contain multiple kinds of knowledge.

They must remain distinguishable.

Examples:

Civil date:
calendar fact

Pattern coordinate:
canonical Codex calculation

Sunset:
calculated/provider astronomical value

Weather:
provider observation or forecast

Witness:
user observation

Memory:
user-authored recollection

Oracle:
symbolic interpretation

Recurrence:
algorithmic similarity

The Atlas may place these beside one another.

It must not silently convert correlation, memory, symbolism, or recurrence into
scientific causation.

---

# 39. Migration Strategy

Existing systems must migrate incrementally.

Do not begin by rewriting:

- Pattern Calendar
- Calendar Atlas
- Living Time Sphere
- Witness Ledger
- Genesis Oracle
- environment system
- astronomy engines
- PWA infrastructure

Instead:

Step 1:
define LifeRecord and Relation contracts

Step 2:
build local repository

Step 3:
create adapters for existing authorities

Step 4:
build Timeline projection

Step 5:
connect records to Calendar Atlas

Step 6:
connect records to Sphere

Step 7:
add Map projection

Step 8:
add search and recurrence

Step 9:
add media indexing

Step 10:
evaluate optional synchronization

Every step should remain independently testable.

---

# 40. Implementation Phases

PHASE 1 — FOUNDATION

- architecture specification
- canonical schemas
- Life Atlas repository
- relation repository
- privacy model
- provenance model
- tests

PHASE 2 — TEMPORAL ATLAS

- Timeline
- day inspection
- Calendar Atlas integration
- temporal search
- selected-date synchronization

PHASE 3 — LIFE RECORDS

- memories
- people
- places
- projects
- journeys
- artifacts
- Witness adapters

PHASE 4 — SPHERE INTEGRATION

- Life layer
- record clustering
- semantic zoom
- day swipe
- selected-record focus
- year/life rings

PHASE 5 — MAP

- places
- journeys
- routes
- privacy-aware spatial visualization

PHASE 6 — MEDIA

- metadata references
- thumbnails
- local media indexing where supported
- temporal and spatial media clustering

PHASE 7 — DISCOVERY

- unified search
- recurrence
- relationship exploration
- cross-year comparison

PHASE 8 — PORTABILITY

- archive import/export
- backup
- recovery
- migration tools

PHASE 9 — OPTIONAL SYNC

Only after the local-first architecture is mature.

---

# 41. Testing Strategy

Tests should cover at minimum:

SCHEMA
- validation
- migrations
- malformed records
- privacy flags
- provenance

TEMPORAL
- timezone boundaries
- sunset/manual/midnight boundaries
- Pattern year rollover
- outside days
- selected instant authority

RELATIONS
- creation
- deletion
- deduplication
- invalid references

STORAGE
- persistence
- migrations
- quota failures
- corrupted data
- import conflicts

PRIVACY
- share filtering
- export filtering
- coordinate redaction
- witness protection
- profile protection

RENDERING
- 3D
- SVG
- table
- text
- semantic zoom
- clustering

MOBILE
- swipe
- vertical scroll
- resize
- orientation
- lifecycle recovery

PERFORMANCE
- large record sets
- dense days
- large relationship graphs
- repeated temporal navigation
- renderer teardown/remount

---

# 42. Guardrails

Life Atlas implementation must not:

- fork canonical calendar math
- create another Today authority
- duplicate Genesis profile storage
- duplicate Witness storage
- require WebGL
- require weather
- require network access
- expose private coordinates by default
- place private data into URLs
- rebuild the entire Sphere for every temporal movement
- render unbounded record counts
- make symbolic interpretation appear measured
- claim recurrence proves causation
- silently discard user records during migration

---

# 43. Definition of Done

The Life Atlas foundation is complete when:

1. A canonical LifeRecord schema exists.

2. A canonical Relation schema exists.

3. Records can represent temporal, spatial, relational, provenance, privacy,
   and payload information.

4. Storage is versioned and local-first.

5. Existing Codex systems can be referenced through adapters without
   duplicating their calculation or storage authority.

6. A single selected temporal instant can synchronize Calendar Atlas,
   Timeline, and Living Time Sphere.

7. Today continues to resolve through the canonical Today transaction.

8. Private records cannot leak into public URLs or default share payloads.

9. The system remains functional without weather, network access, or WebGL.

10. Large datasets have explicit clustering, virtualization, or semantic-zoom
    strategies.

11. Mobile vertical scrolling remains usable while Sphere interaction is
    enabled.

12. All major Sphere information has an accessible text or data
    representation.

13. Import preserves provenance.

14. Export provides a portable path out of the system.

15. Tests cover temporal boundaries, privacy, storage migration, relations,
    rendering tiers, and constrained-device behavior.

16. Existing repository tests continue to pass.

17. `npm run audit` continues to pass.

18. The architecture can grow toward a whole-life temporal atlas without
    requiring another rewrite of the canonical calendar engine.

---

# 44. Immediate Engineering Target

The first implementation PR after this architecture specification should be
small enough to audit completely.

Build:

- `life-atlas-schema.js`
- `life-atlas-repository.js`
- `life-atlas-relations.js`
- unit tests
- architecture documentation

Do not add the full visual interface in the foundation PR.

The repository layer should prove that one canonical record can connect:

a civil instant
  -> Pattern coordinate
  -> place
  -> project
  -> witness reference
  -> media reference
  -> provenance
  -> privacy

without duplicating the authorities that already exist.

Once that foundation is stable, the Timeline becomes the first major visual
projection.

---

# 45. Long-Term Direction

The intended result is not simply a calendar containing more features.

It is a navigable model of lived time.

A user should eventually be able to move through:

when
where
who
what
what was created
what was witnessed
what the environment was doing
what the sky was doing
what projects were developing
what journeys were underway
what records connect
what appears to recur

from multiple synchronized views.

Calendar Atlas answers:

"When is this?"

Timeline answers:

"What happened around this?"

Map answers:

"Where did this occur?"

Relationship Graph answers:

"What connects to this?"

Living Time Sphere answers:

"Where does this sit inside the larger temporal structure?"

Together these projections form the Codex Life Atlas.

