# The Evolution Opening — how the Sphere grew, told on the Sphere

**Ordered:** Aaron, Nov 23, 2026, in his own words: *"the first time
they go and they look at the sphere page it shows the calendars the
13 moons then it starts to show the sphere how it used to look when
it first started evolving. Like when I first had that the working
prototype, then it evolves into the sphere it is now. And then the
spark appeared. And then that spark gives the tour and all that the
intro and all that stuff."* — "Build it."

**Form:** one PR, preview-first, not merged. The opening rides the
companion layer exactly as the Phase B day world did: a loader stub
in `docs/assets/js/sphere-companion-layer.js` (the only hook) sets
one stylesheet and one module on the page. **No R1.7 protected file
is touched** — the page, the sphere stack, the temporal authority,
and the sphere stylesheet are all byte-identical to main. The
opening is a guest: it presents, reads the page's own public
records, and at the very end — only at the visitor's tap — presses
the guide bar's own Today button, the page's public control.

## The four stages

1. **The Calendars.** The 13 Moons as their flat calendar form: a
   13 × 28 grid built at show time from `PatternCalendarData`'s
   moon names, with today's cell marked from `PatternCalendar`'s
   own conversion of the real date. 364 cells; today flagged
   exactly once.
2. **The First Sphere.** The Sphere as it actually looked in its
   first build. Evidence: the Sphere was born in PR #63, first
   commit `eb9afbc5` (July 23, 2026) — a flat SVG instrument: a
   dark disc, thirteen numbered wedges, a pattern ring, a dashed
   solar axis, a teal year spiral, the gold Equinox Passage arc,
   a lavender lunar marker, gate markers, a centre point. That
   build was run again for this work and its face captured; the
   portrait in this module is drawn again from that build's own
   drawing code — `living-time-sphere-renderer-svg.js` and
   `living-time-sphere-layout.js` at `eb9afbc5` (the layout file
   is byte-identical on main today) — same ring fractions, same
   elements, same colours. Its live positions (today's moon lit,
   the equinox and passage, the lunar marker, the spiral and the
   annual markers) come from the page's own Alignment Ledger, the
   same source the first build's model read. **What the ledger
   cannot place is omitted, never guessed.** The stage labels
   itself a portrait drawn from the first build's code, with the
   date. (The preserved baseline `d2c42a1` predates the Sphere —
   at that commit the calendar still lived on the Moons page —
   so the first Sphere, not the baseline, is the honest "first
   working prototype" of the Sphere itself.)
3. **The Sphere Now.** The overlay steps aside (its scrim fades,
   its card settles to a caption) and the visitor is standing in
   front of the real, live Sphere — the instrument itself, not a
   picture of it. No second canvas, no second date authority.
4. **The Spark Appears.** The Spark gives the intro in four short
   beats: meeting, turning and diving, the rings in one breath,
   and the keeping of a day — teach-by-doing, ending on the offer
   "Take me to today", which closes the opening and presses the
   guide bar's Today button. When a companion record stands on
   the device, the Spark shown is the keeper's own, drawn by the
   Spark core's own renderer and named; otherwise the plain orb
   of light. The Spark then steps back: the opening removes
   itself and the page is the visitor's, with the real Spark seat
   where it always stands.

## The fences

- **First visit only.** A local flag (`sof.sphere.evolutionOpening.v1`)
  is set when the opening closes, by any path. A session flag
  keeps it from re-standing within a session. A visitor who
  arrives at a shared view (a `marker` or `year` in the URL) is
  never met by the opening, and the flag is left unset for them.
  One subtlety, found in testing: the Sphere keeps its own state
  in the address bar as it works — its UI writes the current
  year and the selected marker there on its own — so the opening
  cannot judge a visit by the live address, or it would mistake
  the instrument's bookkeeping for a shared link and never stand
  at all. The loader therefore catches the URL the visitor
  arrived with, in the moment the companion layer first runs
  (before the instrument's first writing), and the opening
  judges the visit by that caught URL alone.
- **Labelled a demonstration** on its face, the whole time, per
  the Evolution directive's introduction law.
- **Skippable at every stage** (Skip, Escape, arrow keys to walk).
- **Replayable** from the guide bar's new door, "See how it grew".
- **Reduced motion** gets stills and the same words (a class from
  the media query, transitions off, instant stage changes).
- **Record-sourced copy.** Anything the opening says about today
  is computed at show time from PatternCalendar; the Spark's
  beats say only what the page itself does. No performed warmth,
  no invented noticing.
- **Every existing action stands.** Today, Schedule, Day Details,
  the Spark, Play, Farm & Home, Deep Time, camera views, settings,
  the Atlas, fullscreen, Freeze/Wake — none is touched; the
  opening is an overlay that removes itself.

## Held back, and why

- **The flame wrap** (approved blend design, Nov 23) is not drawn
  on the tour's Spark: the seat's current renderer has no wrap
  layer yet, and the opening uses the Spark exactly as it
  currently appears. When the wrap lands in the seat, the tour's
  figure — drawn by the same renderer — takes it on with no
  change here.
- **No attempt to re-run the 2026 build as the stage.** The
  portrait is a drawing from the old code, not the old page
  embedded: the old page carries an old shell whose actions no
  longer match the site, and embedding it would put a second,
  stale instrument in front of the visitor. The drawing is
  faithful to the face; the label says what it is.

## Weight

Two new files, loaded only on the Sphere page through the
companion layer: `sphere-evolution-opening.js` (30,591 bytes) and
`sphere-evolution-opening.css` (7,307 bytes) — 37,898 bytes in
all. No images, no video, no new requests beyond those two. The
calendar grid and the portrait are DOM/SVG drawn at show time.

## Landing order

This branch was built off main `90c0e9e6` and has since taken in
main by merge as the day's landings proceeded (PRs #247 and #250,
then #243 and #244 — the first two pieces of the Sphere stack —
each with its own reconciliation; the growth record carries every
landing's entries as a union, this one on top, 216 entries in all,
and the companion layer carries both this loader and the day
world's, side by side). The rest of the Sphere stack —
#245, then #246 — lands first, each on Aaron's word;
this PR's loader stub sits in the same companion-layer file the
stack's later pieces also touch, so it should land **after** the
stack, rebased onto whatever the companion layer looks like then.
That order is Aaron's to set; it is flagged here, not decided.
