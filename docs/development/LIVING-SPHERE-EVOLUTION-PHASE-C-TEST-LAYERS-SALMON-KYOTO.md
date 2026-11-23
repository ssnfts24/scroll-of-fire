# Living Sphere Evolution — Phase C: Test Layers, Salmon + Kyoto

**What this is:** the build note for the first test-layer tranche after the Sky — the two recorded series Aaron approved as proving layers on November 23, 2026 (charter §3f–g: *"Sky (built) → Salmon + Kyoto → census families → his-own kinds"*), built to the layer programme's expansion (§1 machinery, §5 Water, §6 Living) and the test-layer census (§4.2, §5.1, §12, §15). It states what was ingested and re-confirmed, what stands on the face, the laws the wiring obeys, and what was held back and why.

**Independence:** one branch off main (`dd02f747`) and one pull request. It changes **no R1.7 protected file**. The one existing file it edits is `docs/assets/js/sphere-companion-layer.js` (a loader block, in the farm and sky loaders' pattern). It is independent of PR #246 (the sky engine): the two meet only in the compare budget, which this module enforces from its side by watching the sky readout line's standing, exactly as the sky layer itself does.

---

## 1. The packs

Each series ships as one packed day-index file, fetched only when a keeper first switches that layer on (lazy, per the capacity law; ≤ 2 MB per file).

### 1.1 Salmon — `docs/assets/data/sphere-test-salmon-bonneville.json` (607,050 bytes)

Built by `scripts/build-salmon-bonneville.py` from **Columbia River DART, Columbia Basin Research, University of Washington — Adult Passage Daily Counts**, one CSV per calendar year from DART's own query endpoint, read 2026-11-23. The counts are the **U.S. Army Corps of Engineers'** counts at Bonneville Dam, cited as DART asks.

Re-confirmed at ingestion (the census's ◐ discipline):

- **Span: 1939–2026 — one year shorter than the census's "from 1938."** DART labels the Bonneville project "[1938]" — 1938 was the dam's first counting year — but its daily-count query serves no 1938 rows (the year list begins at 1939; a 1938 query redirects away empty). The pack's span is the span as published, and the difference is recorded here and in the pack, not smoothed over.
- **Four adult runs**, as DART's columns name them: Chinook (`Chin`), steelhead (`Stlhd`, the total — the wild column is a subset and is not double-counted), sockeye (`Sock`), coho (`Coho`). Jacks are immature fish and are excluded; shad, lamprey, bull trout, chum and pink are outside this tranche's commission.
- **Counted days:** Chinook 23,303 · steelhead 25,769 · sockeye 9,232 · coho 5,815. A day enters the pack only where DART prints a number (a counted zero is a record). An empty cell — no count made or reported, above all outside the counting season in the early decades — stays an absence, and the layer draws it as a gap, never as a zero.
- **Coho were not separately counted before 1980** (DART's Coho column is empty for every day of 1939–1979; the first counted coho day falls in 1980). The pack holds coho 1980–2026; the earlier years are gaps and are drawn as gaps.
- **Negative daily values stand as published.** They are the counters' own corrections (fish counted back downstream); the pack does not launder them into zeroes. The season curve clamps a negative day to the baseline visually; every readout speaks the published number.
- **Day-index:** each civil date converts to (shell year, Pattern Day slot) by the canonical PatternCalendar arithmetic — the window opens April 17; counted days are slots 1–364, then the Day Out of Time (365) and, in a 366-day window, the Deep Time Day (366). Totals are per shell year, summed from the packed days, and are named as the Sphere's year (April to April) wherever the layer speaks them; they are not DART's calendar-year totals and are never presented as such.
- **Spot verification:** DART's published table for Sept 1, 2023 reads Chinook 41,510 and steelhead 3,092; the pack carries exactly those numbers at that day-index, pinned in tests.

### 1.2 Kyoto — `docs/assets/data/sphere-test-kyoto-blossom.json` (20,445 bytes)

Built by `scripts/build-kyoto-blossom.py` from two routes to the same published dataset, read 2026-11-23:

- **Yasuyuki Aono's own workbook** (`KyotoFullFlower7.xls`, "Full-flowering dates of Japanese cherry (Prunus jamasakura) at Kyoto, Japan", latest version Jun. 12, 2012; the file's metadata names AONO as author), distributed from his page at Osaka Prefecture University. The university server did not answer on the day; the file was read from the Internet Archive's snapshot of the same URL (2025-04-25). Its sources are the city's diaries and records, through Taguchi (1939), Sekiguchi (1969), Aono & Omoto (1994), Aono & Kazui (2008), Aono & Saito (2010), Aono (2011, 2012). Aono's table ends at 2015.
- **Our World in Data's republication** of the same dataset ("Date of the peak cherry tree blossom in Kyoto", **CC BY 4.0**), which continues the series from Aono and his successor Genki Katata. The pack takes **2016–2026** from OWID.

Re-confirmed at ingestion:

- **838 recorded years, 812–2026, with 377 years carrying no record** — the census's figures exactly. Aono's workbook holds 827 recorded years (812–2015); OWID's continuation adds 11 (2016–2026). Years with no surviving record are absent from the pack and drawn as gaps.
- **1923: Aono's workbook says day 97 (April 7); OWID's current grapher CSV says 98.** Two independent cleaned copies of the OWID series agree with Aono (97). The pack carries **97** — the compiler's own hand outranks a copyist's slip — and the discrepancy is recorded here and in the generator, not hidden.
- **The extremes stand as the census said:** earliest bloom March 25, 2023 (day 84); latest May 4, 1323 (day 124). Aono's day-of-year and his calendar date agree under proleptic Gregorian arithmetic for all 838 years (zero mismatches at ingestion).
- Each record stores the published day-of-year and calendar date, plus its (shell year, Pattern Day slot) so the face can speak the bloom in the Sphere's own count ("Pattern Day 347 of the year that opened April 17, 2025" for 2026's bloom).

## 2. What stands on the face

A new overlay module, `docs/assets/js/sphere-test-layers.js` (`CodexSphereTestLayers`), loaded by the companion layer and seated in the caption deck under the sky dome — the farm and sky layers' pattern. It follows the selected day through the same cursor events and globals the sky and farm modules use, and holds no clock of its own.

- **Switches in place**, in the deck: "Salmon — Columbia River" and "Kyoto blossoms", with the rule printed beside them. **Default OFF** — nothing test is drawn until a keeper turns it on.
- **Tag law.** While a layer stands, its source tag stands with it, on its face: salmon names the dam, the counters and DART; Kyoto names Aono, the university and OWID (CC BY).
- **Salmon** renders the selected shell year's **season curve of beads** — one bead per counted day, the selected day ruled by a dashed guide — with a **species sub-switch** (Chinook / Steelhead / Sockeye / Coho) that belongs to the layer's own switch, per §1.1. The readout is one plain sentence: the day's count and that year's April-to-April total, or the honest gap sentence.
- **Kyoto** renders the **millennium thread**: one bead per recorded year across 812–2026, thread segments only between records a single year apart — the thread breaks where the record breaks, and the breaks are the drawing's honesty. The selected year is ringed; its readout gives the bloom's date and its Pattern Day.
- **The day-line** stands under each view: the same day in the years −30, −20, −10, −5, −1, +1, as beads over a plain-word list. Filled bead = a record, with its count or date; open bead = a named gap ("no count recorded" / "no record survives"); open dashed bead = the future.
- **The +1 asymmetry, exactly.** These are recorded layers: they stop at today. Any bead past today stands open and labelled **"no record; the year is not kept yet"** — including the +1 bead from the present year, verified live in the browser checks below.
- **The compare budget (§1.2).** At most two test layers stand at once, and **the sky dome counts toward the two, as built**. Lighting a third sets the least-recently-lit of this module's layers down and says so on the panel in plain words; if the sky ring comes on over two lit test layers, the same set-down happens from this side (the ring is the armillary's switch, not this module's). A stencil would ride the separate backdrop slot; neither of these layers is a stencil.
- **Colour law.** Salmon stands in the Water family's deep blue; Kyoto in the Living family's green. Neither touches gold — gold is the keeper's own record alone.
- **Texture law.** Both views are schematic — beads, a curve, a thread. There is no day-world entry for a test day; full entry stays reserved for the keeper's own days.

## 3. Proof

- `tests/sphere-test-layers.test.js` — six tests: the calendar fixtures land on their Pattern Days (PD 92 / 152 / 221, the Day Out of Time at 365, the Deep Time Day at 366 in the leap window); slot↔civil conversion both ways; the compare-budget decision incl. the sky counting; salmon bead states against the real pack (Sept 1, 2023 pinned to DART's published 41,510 / 3,092; a winter gap; the +1 future bead; pre-1980 coho gaps); Kyoto bead states (2023's earliest bloom, 1923 as Aono wrote it, 813 as a gap, 2027 as the future bead); pack shape — spans, species order, every total the sum of its days, every slot inside the window, and both packs inside the 2 MB law.
- Browser exercise (local serve of this branch, headless Chromium at 412×915): the panel stands with both switches and rests OFF; Salmon lights with its tag, 219 beads on the 2026 shell's curve, the four-run sub-switch re-rendering per run, and the +1 line reading "2027 — no record; the year is not kept yet"; Kyoto lights with 839 circles (838 records + the selection ring) and the readout "Full bloom in 2026: March 29 — recorded… Pattern Day 347 of the year that opened April 17, 2025"; switching off returns the deck to rest; no page errors from the module.
- The budget, exercised against the live sky: on the page as it stands the sky readout is visible, so the sky already holds one of the two standings. Salmon lights beside it (two standing); lighting Kyoto then **sets Salmon down on its own**, and the panel says so in plain words — "Only two test layers stand at once — Salmon was set down." — leaving sky + Kyoto standing. The budget holds exactly as §1.2 orders it, from this module's side of the fence.

## 4. Held back, and why

- **No beads inside the 3D scene.** As with the sky build, the scene's axes are Pattern geometry with no per-layer frame for recorded series; drawing these series into the 3D shells is the pattern-graph programme's work (charter §3, the years line at scale), not this tranche's. The caption-deck form is the sky dome's proven seat.
- **Streamflow and the rest of the Water family** (flood marks, snowpack, tides) are not in this build — the census's Water section is larger than its proving layer, and §5's order is salmon first.
- **The farm stencil's backdrop slot** is untouched: no stencil ships in this tranche, so the slot's machinery waits for its first real stencil rather than being built empty.
- **Re-ingestion is manual.** The generators are committed and documented; nothing here fetches at runtime, and DART's and OWID's files will move under the packs in time. A refresh is a deliberate, reviewed act — the record's honesty includes its read date, which stands in each pack.
- **App parity** is a later step on Aaron's word, as with the sky engine: the packs are plain JSON and the module's helpers are DOM-free, but Spark. Living Day is unchanged by this build.

## 5. The next tranche

Per the expansion's order: the **census families** next (Sun, Climate, Earth, Human Calendars as their own ingestions, each re-confirmed at ingestion the way these two were), then **his-own kinds** (Body, People, Place, Work, Study — the keeper's own record families), then Other Keepers, Deep Time and Sound. Each lands the same way this one did: one PR, preview-first, its growth-record entry riding in the same change.
