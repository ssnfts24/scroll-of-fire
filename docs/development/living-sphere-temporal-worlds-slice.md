# Living Sphere — Temporal Worlds, first slice

**Status:** built on Aaron's commission (Nov 22, 2026: "Do whatever
is best. Add in anything that can be tracked already including
whatever for farming etc."), as a stacked PR on Phase B
(`phase-b/day-world-slice`, PR #244). Not merged. The slice lives
entirely in the Phase B presentation adapter
(`docs/assets/js/sphere-day-world-adapter.js` + its own sheet,
loaded by `docs/assets/js/sphere-companion-layer.js`). No R1.7
protected file is touched; the day world's truth still comes from
the one planner record through the day-zoom module, and the one
temporal authority (SOFTemporalCursor) gains depth — no second
date state, no forked selection.

## The three binding constraints

Aaron accepted these with the commission; they governed the design.

1. **Data honesty.** The lived record is Year 1 (alignment year
   2026) and young. The multitude shows that truthfully: the lived
   year lit and real, other years calendar-true shells, dim and
   labelled as the road ahead, never dressed with content they
   don't hold. Patterns are shown for what the record actually
   contains — a kind with no records lights nothing and says so.
2. **Entry, not inside-a-ball.** The keeper passes *through* the
   day bubble's membrane (a visible threshold) and the day world
   opens *in front of* them — the Phase B plinth world, unchanged
   inside. The keeper is never placed inside a sphere looking out
   at a shell.
3. **Phone reality.** The far view stays schematic — a line of
   year-shells, each a glyph (one wireframe bead, one 364-point
   day ring, one 13-point moon-tick ring, one label sprite), never
   a scene. Only the entered year/day is ever fully built. The
   Galaxy A16 is the budget: shells cost a handful of draw calls
   per year, and the line is built only while its stage is on
   screen.

## What was built

### A. Day entry — the membrane

The day world now stands inside a faint bubble (a translucent
sphere around the Phase B world, visible at every day stage).
Crossing between Living Day and Immersive Day — in either
direction — passes the bubble's skin: a brief veil sweep across
the stage and a pulse of light on the bubble itself.
Reduced-motion keepers get a plain fade. Zooming back out crosses
outward and restores the prior stage exactly, as Phase B already
guaranteed. The orientation chip now carries a depth crumb at all
times — **Years · Year · Moon · Day · Inside the day** — with the
current depth lit. Every Phase B action survives: inspector
writes go through CodexLivingPlanner only, prev/next day,
back-to-year.

### B. The years line

One stage beyond Year View (camera distance ≥ 4.45, hold to
4.25): a line of year-shells across the front of the view. The
line's group turns with the camera's azimuth, so the beads always
stand across the frame's front, clear of the instrument's own
silhouette. Range: **Year 1 (alignment year 2026) through the
current year, plus the road ahead bounded at current + 2** —
extended to include the year the keeper is standing in when they
have travelled further. The lived year (the alignment year
containing today) stands lit in ivory with the words "the year
you keep"; later years stand dim, labelled "the road ahead".

**Same-day alignment.** When a day is selected, its counterpart
in every shell is ringed. Years where that day holds records show
its symbol (and a count where several stand); years where it
doesn't show the bare ring. The chip reads the alignment aloud:
"Pattern Day 262 down the line — 2026: 🌱 (1) · 2027: bare ·
2028: bare."

**Entering a shell** routes through the cursor by the selection
bridge's own verified civil-date route and flies back to Year
View distance; the Sphere then shows that year in full. A year
with an empty record lands with the chip saying so: "2027 — the
calendar is real; nothing is recorded there yet."

**The ledger boundary (found while building, handled honestly).**
The Sphere face clamps every cursor year to the alignment
ledger's study range — `AlignmentLedgerData.listSupportedYears()`,
currently **2014–2027** (`docs/assets/js/alignment/alignment-version.js`).
A shell beyond that range (2028 today) therefore cannot be
entered truthfully: the face would silently stand the keeper in
2027 instead. The slice reads the range live and refuses plainly:
the pick sets the chip's notice — "2028 — its calendar is real,
but the alignment ledger studies 2014–2027, so the face cannot
stand in 2028 yet. Its record still counts in Patterns." — and
the cursor does not move. When the ledger's data grows, entry
grows with it; no code change is needed. Patterns (below) still
count and light those years, because the record is real even
where the face cannot yet stand.

### C. Pattern tracking

A **Patterns** door stands beside the rebuild dock (a sibling
row in the dock's own visual language — never a sixth dock
button). Its panel offers:

- **Kinds**, grouped for humans, Farm & Home first (Aaron named
  farming): Farm & home (planting 🌱, growing 🌱, farming 🌾,
  watering 💧, harvest 🌾, livestock 🐄, seasonal ☀, maintenance
  🔧), Home & family, Work & craft, Study & witness, People &
  occasions. Every kind shows its count of days across the years
  on the line. A group header lights the whole group.
- **Standings**: Any standing / Open / Completed / Overdue,
  from the scheduling surface's own fields.
- Picking a kind lights every day holding it — on the faced year
  (a symbol field over the disc at the record layer's own marker
  positions, each day ringed, wearing its kind's symbol in its
  kind's colour) and down the years line (lit marks on each
  shell). The result line shows the count **labelled as a
  count**: "watering — 1 day holds it (1 record — a count of
  days, nothing more claimed). Days holding the same kind are
  the same kind, not the same thing." Lit days are listed as
  doors; entering one goes through the cursor (with the same
  ledger-range honesty as shell entry).
- **Documented ties only.** A record's own stored recurrence is
  surfaced as "↻ Repeating, as recorded", with the panel stating
  what it is: a record that repeats carries its recurrence
  written on itself; lighting those days draws no ties between
  separate records. No threads are drawn anywhere in this slice
  (see "Not tracked" below).

### A found bug, fixed in this slice

Phase B's `todayRelation` compared the cursor's alignment year
(2026) against `PatternCalendar.fromCivilDate`'s ordinal
patternYear (1 for the 2026 cycle), so "today" never matched:
the state light never wore today's gold, the now bead never
stood, and same-year overdue never fired. The fix derives the
alignment year from the summary's anchor date — the planner's
own derivation, documented in its `patternContext`. The new
browser harness proves the now bead stands for today. This is
the one behaviour change to Phase B's own surface, and it is a
repair toward Phase B's documented design, not a redesign.

## The trackable inventory (evidenced from the code)

Everything the Patterns view covers, and where it lives:

- **Category** — `payload.planner.category`, falling back to the
  record's subtype (`life-atlas-planner.js` writes it;
  `life-atlas-record-sphere-extension.js` reads it the same way).
  36 categories carry symbols in the record layer's
  `SYMBOL_BY_CATEGORY`: task ✓, event ●, reminder ⚑, project ◆,
  travel ✈, milestone ★, practice ✦, growing 🌱, farming 🌾,
  planting 🌱, harvest 🌾, watering 💧, livestock 🐄, maintenance
  🔧, seasonal ☀, meeting 👥, school 🎓, health ❤, finance 💰,
  observation ◉, home ⌂, family ♡, pets 🐾, food 🍽, shopping 🛒,
  vehicle 🚗, construction 🏗, coding 💻, writing ✎, research 🔬,
  creative 🎨, cleaning 🧹, appointment ✚, community ◎, camping
  ⛺, fieldwork 🥾. The adapter mirrors the table and the colour
  palette so the Patterns view can never disagree with the face;
  unit tests pin the groups covering the table exactly once.
- **Symbol** — an explicit `payload.planner.symbol` wins (≠
  "auto", ≤ 4 chars); a workflow stamp names its own
  (`codex-of-reality` → ✎, `living-phone` → ☎); otherwise the
  category's symbol; fallback ●. Mirrored exactly from
  `plannerSymbol()` in the record extension.
- **Workflow** — `payload.planner.workflow`.
- **Schedule fields** — via `CodexLifeAtlasScheduling.getSchedule`
  (`docs/assets/js/life-atlas/life-atlas-scheduling.js`): kind,
  status (planned / tentative / confirmed / in-progress /
  completed / cancelled), priority (low / normal / high /
  critical — high and critical are the day world's "important"),
  allDay, start/end, durationMinutes, recurrence { frequency:
  none/daily/weekly/monthly/yearly/custom, interval, byWeekday,
  byMonthDay, count, until }, reminders, attendees, location,
  completedAt. Completion is `isCompleted()` (status completed
  or completedAt set). Overdue follows the day world's own rule:
  a standing record on a past day, or past its end hour today.
- **Day position** — `temporal.patternYear` (the alignment year)
  and `temporal.patternDay` stamped by the planner from
  PatternCalendar; records are fetched per year by
  `plansForYear` / `plansForYears`.
- **Day marks on the face** — the record layer's per-day primary
  symbol + count (its GPU symbol field) already show what a day
  holds; the Patterns overlay takes its positions from the same
  calendar geometry (`calendarDisplayCell` angle +
  `scheduleRadialFactor`), so lit days sit exactly where the
  face already puts them.

## What is NOT tracked, and why

- **The farm reference dataset** (`farm-western-wa.json` —
  counties, planting windows, teaching guides) is a reference
  book, not the keeper's record. It is not tracked, not lit, and
  the panel says so on its face.
- **Relations between records.** A relations module exists
  (`life-atlas-relations.js`: 16 relation types and a repository
  factory, consumed by `life-atlas-query.js` through an injected
  instance) — but no live relations instance is wired into the
  Sphere page session, so there is no documented-relation source
  to draw from. Drawing threads without one would manufacture
  relations. The one documented tie the records carry themselves
  — a record's stored recurrence — is surfaced, named as itself.
  Recurrence *expansion* (standing a recurring record on each of
  its days) remains Phase C, as Phase B already recorded.
- **Non-planner Atlas records** (imported history and other
  record kinds) carry no planner category or symbol; the pattern
  inventory is the planner record's. They are not pattern-tracked
  in this slice.
- **Nothing is manufactured**: no weather, no invented records,
  no demo data in the keeper's views. Empty states are honest in
  the panel, on the line, and in the chip.

## Proof

- Unit: `tests/sphere-temporal-worlds.test.js` (stage machine's
  years band, depth names, bounded range, group coverage of the
  inventory, the mirrored symbol rule, pattern index + lit-day
  filtering for kinds/standings/recurrences, source guards) plus
  the Phase B adapter suite, unchanged in behaviour except the
  companion loader's cache-bust version pin (-2 → -3).
- Browser: `tests/sphere-temporal-worlds-browser.test.js` drives
  the real page in headless Chromium and proves (i) entry through
  the membrane both ways, with the world and its records standing
  inside and today's now bead lit; (ii) the years line — shells
  for exactly the bounded range, the lived year distinguished,
  the road ahead marked, counterparts picked out down the line
  (symbol where records stand, bare ring where they don't), an
  empty supported year entered with its honest notice, and a
  beyond-range year refused plainly with the cursor unmoved;
  (iii) pattern lighting — watering lights exactly its seeded
  day, the Farm & home group lights exactly the seeded farm days
  (planting, watering, harvest among them), counts labelled as
  counts, the overlay standing on the faced year, and the same
  lighting counted per shell down the line; (iv) a kind with no
  records (travel) lights nothing and says so.
- Phone-width screenshots (390 × 844, the lab's identical tree):
  the entry threshold (the production veil held at its
  mid-passage pose for the photograph), inside the day, the years
  line with Pattern Day 262 aligned, the Patterns panel with the
  farm group lit, and the farm pattern lit down the line.
- Full `npm run validate` green on the branch.

## Performance notes

- Each year-shell is two point clouds (364 day marks + 13 moon
  ticks), one wireframe icosahedron, one label sprite, and —
  only when a day is selected — one ring and at most one symbol
  sprite; pattern-lit marks add one small point cloud per shell
  that holds any. Three shells (2026–2028) ≈ a dozen draw calls.
  The line is built only while the years stage is on screen and
  disposed with the adapter.
- The pattern overlay on the faced year is two point clouds
  total (rings + symbols in one atlas), regardless of how many
  days are lit.
- The pattern index is one `plansForYears` read over the line's
  years, cached against the records version.

## Stacking and rollback

This branch stacks on `phase-b/day-world-slice` (PR #244) and
must land after it; if #243 lands first, #244 rebases, and this
branch rebases on #244 in turn (shared files are the growth
record and the generated seals, regenerated at landing per the
standing plan). Rollback is closing this PR: the stacked base is
untouched, and no protected file changed anywhere in the slice.
