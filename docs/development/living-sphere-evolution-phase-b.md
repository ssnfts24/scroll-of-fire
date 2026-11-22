# Living Sphere Evolution — Phase B: the Day World vertical slice

Status: built on branch `phase-b/day-world-slice`, PR open for Aaron's
review. **Not merged.** Phase A (architecture + visual style guide)
governs this build; the Evolution directive governs the programme.

## What was built

One new presentation adapter —
`docs/assets/js/sphere-day-world-adapter.js` with its own sheet
`docs/assets/css/sphere-day-world-adapter.css` — registered with the
existing extension host, loaded by one loader block in
`docs/assets/js/sphere-companion-layer.js` (the same pattern the Farm
overlay uses). **No R1.7 protected file is touched**: the adapter
lives outside the protected directories, asks the camera and renderer
through their public surfaces, and only presents.

The slice, end to end:

- The selected day (today by default) grows its world from its **true
  ring position** — the calendar cell's own angle and radial factor,
  read the same way the renderer's record extension reads them. The
  day never moves; neighbours are not touched.
- Zoom is one continuous move through the semantic bands: Year View →
  Moon View → Day Approach → Living Day → Immersive Day. The world is
  absent at Moon distance, swells through Approach (bloom 0.12 → 0.45),
  and stands full in the Living band. Stage changes ride the camera's
  own live distance, with hysteresis on the Living/Immersive split.
- **Framing:** the kernel's focus holds the camera target at the
  sphere's centre, which leaves the rim's day world below the frame
  at Living distance. On entering a day stage, the adapter asks the
  camera — through its public `moveTo`, never by writing camera
  state — to shift its target partway toward the day (further at
  Immersive), once per entry; a keeper who orbits away is never
  fought. On leaving the day stages, a target the adapter moved is
  returned to the centre, so the year comes back untouched.
- In the Living Day: the bronze **plinth** (bare and honest when the
  day is empty), the brass **day-clock arc** carrying timed records at
  their hours, the front **terrace** holding untimed records, the
  label totem, and one **ember light** on the rim when anything
  standing is overdue. Gold appears only for today: the rim state
  light and the now bead. Important records (planner priority high /
  critical) wear the **ivory edge**.
- Record kinds render as the Phase A object vocabulary — work bench,
  signal post (reminder), gathering ring (family), planting bed
  (farm; watering adds its droplet, harvest its pale frame), gate pair
  (travel), reading stand (study), stacked blocks (creative), archive
  tablet (notes), stone ring (practice), marker post (events) — all
  read from the **one planner record** through the day-zoom module's
  own `buildDayView`, so the world and the Day Details panel cannot
  disagree. A cap of 14 individual objects gathers overflow into
  timed/untimed cluster stands.
- Interaction stays inside the Sphere: tap an object → the compact
  **inspector** names it and offers what the record supports —
  Complete / Postpone to tomorrow / Remove — written **only** through
  `CodexLivingPlanner` (`completePlan` / `updatePlan` / `removePlan`),
  after which the records-changed event rebuilds every projection.
  Tap the plinth → the day inspector (counts, the honest empty line,
  and the existing Schedule door). Previous/next day travel and
  "Back to the year" ride the orientation chip.
- An **outside day** (Day Out of Time / Deep Time Day) grows no world
  — it has no ring position — and the chip says so plainly. Recurrence
  expansion and outside-day plan display remain Phase C, untouched.

## Verification

- `tests/living-time-sphere-day-world-adapter.test.js` — the pure
  logic: stage machine + hysteresis, bloom curve, ring anchor, arc
  geometry, category→object vocabulary, world items from day-view
  entries (timed/untimed/standing/overdue derivation), the clutter
  cap, and source guards (planner-only writes; no IndexedDB, no
  record-store writes; gold confined to today's light and bead).
- `tests/sphere-day-world-browser.test.js` — the slice in a real
  browser at phone width: seed the planner through its own create
  path, zoom continuously in and back out, objects match the record,
  the world stands at the day's true ring position, inspector
  Complete and Postpone land in the one planner record, an empty day
  shows the bare foundation and the honest empty line, and Today /
  Day Details still work with the inspector never standing open
  beside the rooms sheet.
- Full `npm run validate` green on the branch (1,993 pass, 0 fail,
  site audit PASS). In this environment the two Chromium browser
  tests skip for want of a `/usr/bin` Chromium — the same standing
  behaviour as the repo's own Sphere Focus browser test. With a
  Chromium supplied, the Day World browser test passes standalone
  and paired with the Focus test, and the Focus test passes
  standalone and in-suite; the one combination that strains this
  1.5-core box is both Chromium suites inside a single saturated
  parallel run, where the Focus test's 20-second evaluate timeout
  can lapse under load that has nothing to do with the page.

## Honest limits of the slice

- **Neighbours do not ghost.** Fading neighbouring days is renderer
  territory (protected); the kernel's own day-node opacity at the
  detail band is the only recession in Phase B. The visual spec's
  ghosting arrives with Phase D's justified-exception review.
- **The inspector is the adapter's own sheet**, fed by the same
  `buildDayView` as the Day Details panel. Docking the panel itself
  into the world is Phase D shell consolidation.
- **Practice / Manifest records are not in the slice.** The world
  reads the planner bucket only; the panel's merged practice records
  join in Phase C.
- **Atmosphere carries no manufactured weather.** The dome appears
  only when the live-data surface actually carries an environment
  reading; otherwise it stays invisible.
- **Labels on objects ride the tap** (the renderer's floating label
  and the inspector), not floating chips — the label layer is the
  deep-fix run's ground and was not touched.
- **The adapter follows the canonical cursor — including where the
  page's own Today path does not.** The sphere UI's return-to-today
  works through the UI's own selection state; in the harness the
  canonical cursor does not move with it (the R1.7 manifest already
  records this authority seam as a known open question). The world
  reads the cursor, exactly as the Day Details panel does, so the
  two can never disagree; reconciling the UI's today path with the
  cursor is kernel ground and was not touched.

## Performance

The adapter adds one small module (~46 KB unminified) and one sheet
(~4 KB), loaded dynamically by the companion layer — the Sphere
page's static weight budget is unchanged. The world is one THREE
group of low-segment primitives (a full day stays under ~10k
triangles), rebuilt only on selection or record change, and scaled
to invisibility outside the Approach band. No new per-frame work
beyond the bloom ease, which asks for frames only while travelling.

## Rollback

The slice is one branch and one PR. Rollback = close the PR, or
revert its single merge commit if ever merged: the change set is the
adapter module, its sheet, one loader block in the companion layer,
two test files, this note, and one growth-record entry. No data
migration exists to unwind — the adapter writes only through the
planner's existing paths, and records written by its inspector are
ordinary planner records.

## Addendum — the day box follows the keeper's selection (Nov 22, 2026)

Aaron tested the preview on his Galaxy A16 and reported: "when I
select a new day that box doesn't change" — the chip still named
Moon 8 · Day 21 while the face and the page's own readout stood on
Pattern Day 262 — and the stage's centred Play pill painted over
the chip's title. Both defects were reproduced and measured in the
lab at phone width before any change.

**Root cause of the stale box.** The sphere UI honours selections
that never move the canonical cursor: a tap on a day numeral of the
3D face calls the UI's public `selectDay`, marker picks and the
calendar workbench do the same, and all of them settle in the UI
module's own `_state.selectedDayOfYear` through its selection
flush, which emits no cursor event. The cursor — the one authority
the chip, the day world, and the Day Details panel read — never
hears about those selections. The paths that DO move the cursor
(sidebar arrows, moon/day selects, the scrubber, the step buttons,
quick jump) all go through the UI's own cursor bridge. Repairing
the tap paths at their source means editing
`living-time-sphere-ui.js`, which is R1.7-protected; that decision
is Aaron's, and this addendum is the record of what is needed
there: route the flush-only selection paths (face taps, marker
picks, public `selectDay`, playback steps, the Today return)
through the module's existing `_setCursorFromPatternDay`, the way
its other controls already are.

**The fix, in the adapter (no protected file touched).** A
selection bridge in `sphere-day-world-adapter.js`:

- Every honoured selection change ends in the UI's selection
  flush, which announces the settled day through
  `livingtime:selectionchange`. The bridge routes each
  announcement into the cursor through its public API — the
  cursor's own `setPatternDay` within the same pattern year, and
  a verified civil date (the calendar's `epochForYear` + day − 1,
  checked against the coordinate engine's own decomposition
  before the move) across years. Announcements that merely echo
  the cursor decide to "none" in the router, so the bridge cannot
  loop, and the chip keeps reading the cursor alone — it never
  reads the UI's selection.
- Temporal playback's steps are not routed one by one (the lens
  playing over the face is not a settled selection). A backstop in
  the adapter's render heal watches the UI's public state: when
  its honoured day has changed and then held still — playback
  stopped, a keeper signal seen, the cursor inside the count —
  it routes that resting day too. This also covers the one
  honoured path that announces nothing at all: returning to Today
  through a view-mode switch (the flush variant of Today is
  covered by the announcement route). The heal never moves a
  cursor that stands outside the count.
- A selection announced before the cursor exists is held and
  handed to the cursor at its ready event — the same
  latest-intent-wins rule the UI's own bridge keeps.

**The Play pill.** The pill (`.sphere-play-bar`, top-centre of the
canvas wrap) and the chip (top-left of the instrument shell) share
the stage's top edge; at 390px the pill's box (x 166–224) sat
inside the title's (x 21–253) and `elementsFromPoint` showed the
pill topmost over the title's middle. In the adapter's own sheet,
stages up to 900px now drop the chip beneath the pill (the bar's
0.5rem offset + the pill's 40px + a gap); wider stages keep the
top margin, where the pill's centre clears the chip's reach.

**Proof.** Unit tests pin the route decision and the verified
civil-date conversion (including a UTC+13 correction and
fail-closed cases). A new browser harness test drives the keeper's
own paths at phone width — the renderer's exact `selectDay` call
and the `sphere:marker-select` event — and asserts the cursor,
the chip's title and contents line, and the day world all stand
on the selected day (262 with its seeded record, then the empty
271), that the chip's own travel still moves the one cursor, and
that the pill neither intersects nor covers the title. Full
`npm run validate` green; the browser tests pass with a Chromium
supplied (they skip in this machine's standard gate, as before).
Branch seals remain main's landing seal, per SEALS-AT-LANDING.
