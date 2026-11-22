# Living Sphere Evolution — Phase A: Visual Specification

**What this is:** the look of the Living Sphere evolution, specified precisely enough to build from — the companion to the Phase A architecture document (`LIVING-SPHERE-EVOLUTION-PHASE-A-ARCHITECTURE.md`), which maps the systems and the plan. This document covers: the day markers, the five zoom stages (with annotated sketches — *drawings in words, not builds*), the Living Day's foundation, the record objects, colour and light, motion, and the phone and desktop layouts.

**Standing rules inherited, not reinvented:** gold is reserved for *today* (the site's existing visual-language rule); every mark belongs to exactly one honesty house — **Counted** (from the calendar or the keeper's record), **Measured** (from the sky/environment record), or **Story** (from the Traveller's Road) — and the houses never blend; at most Pattern + 4 rings stand on the full instrument; plain words first, technical terms only when asked. Colours and sizes below start from the values already in the code (the materials constants and the armillary dressing) so the evolution looks like the same instrument, grown — not a new one.

**A note on measurements:** sizes for 3D objects are given in *plinth units* — the Living Day's foundation disc has radius 1.0, and everything in the world is sized against it. Screen sizes are given in pixels at a 390 px-wide phone unless stated.

---

## 1. Colour and light — the palette of the instrument

The Sphere's established palette carries through unchanged: deep night ground (`#0a0a14` family), brass (`#daa45b`) for the instrument's metal, warm wood tones for the armillary band, near-white numerals with a dark halo (PR #234's legibility pass). The day world adds no new hue families; it assigns the existing ones work:

| Role | Colour | Used for |
|---|---|---|
| Today | Gold `#e8b64c` (existing today colour) | Today marker, the "now" bead, nothing else |
| Selected | Warm brass-white rim light | The selected day's node and plinth rim |
| Counted (calendar + keeper's record) | Warm ivory `#f2ead8` objects on dark bronze | Record objects, arc, terrace |
| Measured (sky/environment) | Cool silver-blue `#a9c6de` | Atmosphere tint, sky-fed lines, Deep Time |
| Story | Violet `#9a7fd4` | Story marks and threads only |
| Farm record | Living green `#7fb069` accent | Beds, farm furnishing |
| Warning (overdue) | Restrained ember `#d96f4e` | One rim light per overdue object; never a fill |
| Demonstration | Pale outline, no fill | Introduction-tour objects, always labelled |

**Lighting of a day world:** one key light from the Sphere's core direction (so the world is lit as part of the instrument, not by a stage lamp), one soft rim from behind the arc, and the atmosphere tint over both. Shadows: a single soft contact shadow under each object — no shadow maps beyond the plinth. At the lowest quality tier, lighting flattens to two tones and the world remains readable.

## 2. The day node — a day as architecture

Today a day is a point of light (`THREE.Points`) plus a floating numeral pill. The redesign makes the day a small piece of the instrument's architecture at every distance, without moving it one fraction from its true coordinate:

- **The node:** at the day's display position stands a low, faceted stud — a short cylinder (the *day stud*) whose top face carries the numeral. At Year and Moon distances the stud reads as a bead of light on the ring; the numeral is the existing DOM pill, unchanged in position logic, resting on the stud.
- **Typography of the numeral:** the PR #234 floor is the minimum — 0.74 rem on phones (0.8 rem desktop), weight 820, near-white with a dark halo, inside a pill at least 25 × 25 px. At Day Approach and below, the faced Moon's numerals grow to 0.85 rem and the selected day's numeral to 1.0 rem in a tablet (below). Numerals are never rotated to face away; the existing rail-locked placement (numerals stay at their anchors) stands.
- **The six states** (restrained — one treatment each, combinable only as noted):

| State | Treatment |
|---|---|
| Ordinary | Ivory stud, soft top light, numeral at standard weight |
| Today | Gold stud and gold halo ring lying flat around it; the numeral pill takes the gold edge. Gold appears nowhere else on any day |
| Selected | The stud rises slightly (×1.15 height) and takes the brass-white rim; a thin selection ring stands around its base |
| Has records | The PR #234 mark stands under the numeral (one glyph, the day's primary kind, holographic cyan on dark) — unchanged. At Moon View and below, a faint warm under-glow joins it, strength by count (1–2 soft, 3+ stronger, capped) |
| Important or overdue | Important (priority): a fine gold-*free* ivory edge-line on the stud — priority never borrows today's gold. Overdue: the ember rim light on the stud's base, steady, not flashing |
| Calendar boundary | Year Gate and the outside days (Day Out of Time, Deep Time Day) keep their existing special geometry (the teal Year Gate octahedron family); their studs are teal-edged so the boundary reads as structure, not decoration |

- **Selection honesty:** the touch target is the mathematical day cell (the existing picking already resolves a tap to the exact day even when its numeral is hidden) with a minimum effective radius — at detail stages, taps resolve to the nearest day within a finger radius (~22 px) and the chosen day *announces itself* (its tablet rises) so a near-miss is visible, never silent. Camera motion never re-picks: selection changes on tap-up only, as today.

## 3. The five zoom stages — annotated sketches

*These are drawings in words. Each describes the 390 px phone view at that stage; the desktop view is the same composition, wider. Nothing here is a build or a screenshot.*

### Stage 1 — Year View (far band)
> The whole armillary fills the screen, tilted so the ring's face catches the light. Thirteen Moon name pills ride the ring; the faced ones read clearly, the far side's are quiet. One gold point burns on the ring — today — with its flat halo. A smaller brass ring marks the selected day. Here and there under a numeral, a tiny cyan glyph says *something stands on this day*. The dock rests at the bottom: Today · Schedule · Day Details · Your Spark · More. Top-left, a small chip: the year, and "13 Moons · 364 days + the days outside the count." Nothing moves but the slow drift and the held light.

### Stage 2 — Moon View (medium band)
> The camera has come closer; one Moon's sector fills the lower two-thirds. Its 28 day studs stand in their four week-lanes like beads on four rails, numerals up on the key days (1, 7, 14, 21, 28) and on every marked day; the faced Moon's full set is guaranteed as the keeper centres it. Two days carry cyan glyphs; one glows warm underneath — three things stand there. Neighbouring Moons soften at the frame's edges, their names still readable. The orientation chip now reads: "Moon 8 · the year is around you."

### Stage 3 — Day Approach (near band)
> One day has been chosen and the camera has flown to it (the existing focus move). Its stud has grown into a low plinth — a dark bronze disc, rim lit brass-white — sitting exactly where the day always sits; the ring curves away on both sides, neighbouring days ghosted to half-light but still placed, still named. On the plinth's rim, faint hour ticks have appeared. If the day holds records, their marks stand as small silhouettes at the plinth's edge, not yet furnished. The chip reads: "Moon 8 · Day 22 · Pattern Day 218 — approaching." A "Back to the year" line sits under it.

### Stage 4 — Living Day (detail, upper)
> The plinth is now a small observatory floor, a third of the screen wide. Over its back half rises the day-clock arc — a brass half-ring on two feet — and on it, at their hours, stand the day's timed things: a workstation block at the morning quarter, a reading stand near the crown. Across the front, lower and flatter, the untimed terrace holds an archive tablet and a planting bed with its green edge. The rest of the Sphere is a ghost calendar behind glass — visible, placed, quiet. At the bottom, above the dock, the inspector sheet rests at its low stop: the day's list in words, the same things, in the same order. The chip: "Moon 8 · Day 22 — you are in this day."

### Stage 5 — Immersive Day (detail, lower)
> Closer still. The arc's hour numbers (6 · 9 · 12 · 15 · 18) stand on small posts. The workstation block is furniture now: bench, notch, a flat cap ready to settle when the work is done. Labels ride each object — name first, time under it — appearing as the keeper nears or taps. From the planting bed, one fine green thread runs off the plinth's edge toward the ring: its next watering, three days on, and the thread's far end glows faintly where that day sits in the ghosted calendar. The sky over the plinth has the evening's silver-blue in it because the record says evening is coming — for today only; a future day's sky stays neutral. The inspector is one tap away, not in the way.

## 4. The Living Day foundation — fixed parts

All dimensions in plinth units (plinth radius = 1.0). The world group is anchored at the day's display coordinate and blooms per §6's growth curve; at full bloom on a phone the plinth spans roughly 55–65% of the stage width.

| Part | Form | Dimensions | Material / colour |
|---|---|---|---|
| Plinth | Shallow cylinder, faceted rim (28 facets — one per day of a Moon, a quiet rhyme, never labelled as such) | Radius 1.0, height 0.06 | Dark bronze `#3a2c1c`, top face near-black ivory-lit |
| Rim ring | Flat ring on the plinth's edge, carrying hour ticks (24) and the state light | Outer 1.0, inner 0.94 | Brass; state light per §2 (selected brass-white, today gold) |
| Day-clock arc | Half-ring (180°) standing over the back half, on two feet at the rim | Radius 0.78, tube 0.022, crown height ~0.78 | Brass; hour posts at 6/9/12/15/18 at Immersive only |
| Untimed terrace | A flattened shelf segment across the front chord | Chord at −0.45 from centre, depth 0.3, height 0.03 | Darker bronze than the plinth top; rim engraved "No set time" in the label typeface |
| Label totem | A slim standing tablet at the plinth's back-left, carrying "Moon 8 · Day 22" and the Pattern Day | 0.1 wide, 0.3 tall | Ivory on bronze; this is the world's own name-plate, always present |
| Atmosphere dome | A very subtle transparent dome over the plinth | Radius 1.02, height 0.5 | Tint only (silver-blue Measured, or daypart warmth for today); invisible when the record has nothing to say |
| Now bead (today only) | A small gold sphere riding the rim/arc at the current time | Radius 0.03 | Gold — the one moving part a past or future day never has |

**Empty days:** plinth, rim, arc, terrace, and totem stand; no objects; the inspector carries the day's telling and the one line "Nothing stands on this day yet — the + below can plant the first thing," with the scheduling action right there. The arc stands bare without apology; a quiet day looks quiet.

## 5. The record objects — one family, built from a shared kit

Every object is assembled from the kit's shared forms (block, post, bed, stand, tablet, ring, gate-pair) with kind-specific assembly and accent. No object is an emoji or an icon font; on-face glyphs remain only as the small numeral marks they already are. Standard object footprint ≈ 0.16 plinth units; height 0.12–0.3 by kind and standing. Labels: a chip above the object — name in 13 px ivory, time/kind in 11 px muted — shown at Immersive, on selection at Living Day, never for all objects at once beyond the cap of 8.

| Kind | Assembly | Accent | States |
|---|---|---|---|
| Task / work | Bench block with a tool notch cut across its top | Ivory/bronze | Done: flat cap settles, light dims 40%. Overdue: ember rim |
| Reminder | Slim post (0.05 × 0.3) with a bead at its head | Bead ivory, resting | Due/overdue: bead lit (steady ember if overdue, soft ivory pulse if due today — pulse only, 2 s period, off under reduced motion) |
| Family / gathering | Ring of small posts (one per named attendee, min 3, max 8) around a centre stone | Warm ivory, centre stone warm-lit | Past: posts dim, stone stays warm (a kept memory, not a dead one) |
| Planting | Bed: framed box with soil top | Green edge | Watering due: a blue droplet post stands at the bed's corner. Harvest: a golden frame (not today's gold — a paler harvest gold `#c9a227`, distinguished by being a frame, not a light) stands over the bed |
| Travel | Two gate posts + a catenary line between | Silver-blue line | Multi-day: the line leaves the plinth toward the destination day (a thread, §7) |
| Study / scripture | Reading stand: two angled slabs open like a book, light slit between | Warm light slit | Session done: the book closes (slabs flatten), slit dims |
| Project / creative | Stacked blocks, count by standing (1–4) | Ivory, top block brass-edged | Milestone: a column (taller, 0.45) with the brass edge. Completed project: the stack takes a flat cap like a finished wall |
| Note / observation | Upright tablet | Quiet ivory; observatory tablets in cooler grey-ivory, labelled as the observatory's | — |
| Practice | Low ring of 7 small stones | Element accent of the Spark's kind is *not* used here — practice keeps the record's own colour: soft green-ivory | Session done: one stone in the ring lights |

**Placement:** timed objects stand on the arc by time — angle on the half-ring: 00:00 at the left foot, 12:00 at the crown, 24:00 at the right foot, linear between. Colliding times stagger along the arc's radius (inner/outer step of 0.09). Untimed objects stand on the terrace in record order, left to right. Cluster stands (past 14 objects at Living Day): one object per kind at its kind's home position (arc for timed kinds, terrace for untimed) with a count bead; they unfold at Immersive. At Immersive every object is individually selectable; minimum effective tap size 36 px on screen, resolved by nearest-object.

## 6. Motion language

Motion is the instrument's manners: weighted, eased, never bouncy, never sudden.

- **Camera travel** uses the camera's existing moves (620 ms focus flight). Stage changes ride that travel; nothing cross-fades between stages — the world is *arrived at*, not switched to.
- **The bloom:** the world group's scale follows camera distance continuously between the near band's floor (plinth at cell scale, ~0.05) and Living Day (full 1.0), on an ease-in-out curve (`cubic-bezier(0.22, 1, 0.36, 1)`), anchored at the day's coordinate; neighbours ghost over the same range (opacity to 0.35 at Living Day, 0.2 at Immersive) using the renderer's existing per-band opacity machinery where possible.
- **Object emergence:** on entering Living Day, objects rise 0.06 units and fade in, staggered 40 ms apart in arc order (morning first), total ≤ 500 ms. On completion, a cap settles over 250 ms. On postponement (Phase C), the object lifts, travels the thread to its new day if that day is visible, else fades and the confirmation names the new day in words.
- **Threads** draw in over 400 ms (a line growing), never pop.
- **Reduced motion:** no travel, no bloom animation, no pulses — stages change by 150 ms fades at their thresholds, and every state is still reachable. Freeze/Wake stills everything, as today. The still (2D/SVG) surface is unaffected.

## 7. Connections — how threads look

Threads exist only at Immersive, only when asked (a "Show connections" line in the inspector; per-object from its row). A thread is a fine (1.5 px) line from the object, leaving the plinth's edge toward the related day's position in the ghosted calendar, ending in a small ring on that day. Colour by kind of tie: green for a garden lifecycle, ivory for a project path, silver-blue for last-cycle/same-day-other-year, violet never (Story threads belong to the Story ring, not to records). Every thread carries its one-line explanation in the inspector when selected — the line names the evidence ("Same bed — from the garden record"), and a thread that cannot be explained in one honest line is not drawn. Cap: 6 threads at once.

## 8. The orientation cue and the inspector — layouts

**Orientation chip** (all stages from Day Approach down; a simpler year chip at Year/Moon): top-left over the stage, below the skyline strip. Two lines, plain words: line one — "Moon 8 · Day 22 · Pattern Day 218"; line two, smaller — the standing line ("Inside Moon 8 — the year is around you" / at Immersive: "In this day — the year is behind you"). Under it, a text button: "Back to the year." It never overlaps the Moon labels' safe zone (it sits in the stage's top-left margin the label manager already treats as blocked).

**Phone (390 px):** stage full-bleed as today; dock at the bottom (Today · Schedule · Day Details · Your Spark · More) unchanged. At Living Day and below, the inspector is a bottom sheet over the stage's lower third (max 38 dvh at its low stop, draggable to 60 dvh), the world visible above it; the sheet is the existing day-zoom panel restyled to the instrument (bronze ground, ivory type), not a new component. Object labels ride above the sheet's top edge.

**Desktop (≥ 900 px):** the inspector takes the right rail (width min(34 rem, 44 vw) — the rooms sheet's own measure), the stage narrows around the world, and the world stays centred in the remaining space. The rooms sheet and the inspector never stand open together; opening one folds the other.

**Landscape phones:** the inspector becomes a right-side sheet (44 vw), the world keeps the left; the dock stays at the bottom with its safe-area padding, as today.

**First-visit composition (Year View):** the hierarchy a stranger meets, in order: (1) the instrument itself; (2) the chip naming what it is — "A living calendar: 13 Moons of 28 days, turning around today" (the line the page already carries); (3) gold = today, findable in under two seconds; (4) the selected-day ring; (5) marked days' glyphs; (6) the dock's five plain words. Ring/layer explanations live one tap deeper, on the ring controls themselves — each ring's row carries its one-line charter ("Kept Days — your own record, kept on this device") in the existing charter pattern.

## 9. What this specification deliberately does not do

It does not restyle the rest of the site, the rooms' contents, or the Spark's panel beyond the inspector docking; it does not move a single day from its coordinate; it introduces no new hue family and no new typeface (labels and chips use the page's existing label face and sizes, with the floors set in §2); and its sketches are targets for Phase B's real screenshots to be judged against — per the directive, static pictures never substitute for the working thing.
