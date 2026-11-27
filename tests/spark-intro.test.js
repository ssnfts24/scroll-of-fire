/*
 * The Spark's tours (Aaron, Nov 26, 2026 — corrected in his
 * own words at 16:13, after the first build put a guide's
 * walk before the meeting and he could not follow the
 * report). The flow pinned here, in the order a visitor
 * meets it:
 *   1. First page, first time: the visitor is offered to
 *      ADOPT a Spark. The meeting is that offer. No tour —
 *      and no guide Spark — stands before it.
 *   2. After adopting, the keeper's OWN Spark arrives
 *      animated and OFFERS a tour; one tap gives a QUICK
 *      tour (six short stops, skippable).
 *   3. Each page has a guided tour by the Spark — the
 *      Sphere stage included, riding the overlay alone so
 *      no protected Sphere file is touched. The Spark
 *      offers; the keeper's tap starts; the Tour button
 *      calls any tour back.
 *   4. At different stops the Spark animates differently,
 *      demonstrating what it does: speaks, points, travels,
 *      delights, breathes, kindles, hums.
 * And then the deeper correction (17:04): "without all the
 * pop up windows… the actual spark to just come up in a
 * way and start with all that — or the spark moves around
 * the screen in certain ways and brings you to things…"
 * So there is no tour window at all, and the meeting
 * stands unboxed too: the Spark itself leaves its corner,
 * travels the page with its words beside it, the page
 * scrolls with it, a tap on the Spark goes on, and
 * wandering off ends the walk. The standing fences hold:
 * the tour never creates or alters a Spark record; what
 * is coming is labelled as coming, never as live; the
 * words are on screen; and the meeting's moment still
 * fits the visible screen (Aaron's A16, Nov 26, 2026).
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const intro = read("docs/assets/js/spark-intro.js");
const introCss = read("docs/assets/css/spark-intro.css");
const presence = read("docs/assets/js/spark-presence.js");

test("adoption comes first: there is no tour and no guide before the meeting", () => {
  assert.ok(!/guideCompanion/.test(intro), "no guide Spark is generated");
  assert.ok(!/guide Spark/.test(intro), "no guide walk stands in the module");
  assert.ok(!/Walk with the guide/.test(intro), "no invitation to walk with a guide");
  /* a visitor with no record gets nothing from this module
   * but the watch for the meeting completing */
  assert.match(intro, /if \(!record\) \{\s*\/\* A visitor: no tour/);
  assert.match(intro, /watchForAdoption/);
  /* the meeting itself — the presence's pop-up — is the
   * adoption offer, and it still stands on first arrival */
  assert.match(presence, /else renderEncounter\(companion, seed, today\)/);
});

test("the Show me without a Spark leads back to the meeting, never to a tour", () => {
  assert.match(intro, /function bringMeeting/);
  assert.match(intro, /spark-ember/);
  assert.match(intro, /companions\.html#spark-meet/);
  assert.match(intro, /if \(!record\) \{ bringMeeting\(\); return; \}/);
});

test("after adopting, the keeper's own Spark offers the tour before it gives it", () => {
  assert.match(intro, /function offerIntroTour/);
  assert.match(intro, /Shall I show you what I can do\?/);
  /* the offer is animated: the roaming Spark's figure
   * wears the Spark's own gait */
  assert.match(intro, /data-gait="\$\{gait\}"/);
  assert.match(introCss, /spark-roam-figure\[data-gait="hop"\]/);
  /* the offer is shown once — offered is marked when shown */
  assert.match(intro, /writeIntroFlags\(\{ offered: true \}\)/);
  /* and it is the adoption watcher that owes it */
  assert.match(intro, /offerIntroTour\(record\)/);
});

test("the quick tour is quick: six stops, each a thing the Spark does, each animated its own way", () => {
  assert.match(intro, /This is my voice/);
  assert.match(intro, /You are standing in Moon/);
  assert.match(intro, /sphereSceneSVG/);
  assert.match(intro, /Cards are found by doing the work/);
  assert.match(intro, /Their Home, and the Hearth/);
  for (const anim of ["speak", "point", "travel", "delight", "breathe", "kindle"]) {
    assert.ok(intro.includes(`anim: "${anim}"`), `the quick tour has an ${anim} stop`);
    assert.match(introCss, new RegExp(`anim-${anim}`), `the ${anim} animation exists`);
  }
  /* no Skip button: the keeper wanders off, or lets the
   * Spark rest, and the walk is over */
  assert.match(intro, /wander off/);
  assert.match(intro, /aria-live="polite"/); // the words are on screen
});

test("the tour never writes the Spark record — the meeting is not its business", () => {
  assert.ok(!/setItem\(Core\.STORAGE_KEY/.test(intro), "no write to sof.spark.v1");
  assert.ok(!/newRecord|recordFromPassport/.test(intro), "no mint machinery");
});

test("the road ahead is labelled honestly: on its way, never live", () => {
  for (const name of ["Spark. Living Day", "SPARK! Wake the World", "PayBack"]) {
    assert.ok(intro.includes(name), name + " is named");
  }
  const roadScene = intro.slice(intro.indexOf("Down the road"));
  assert.match(roadScene, /on its way/);
  assert.ok(!/now live|is live|download now/i.test(roadScene));
});

test("every main room has its guided tour — the Sphere stage among them", () => {
  for (const page of [
    "companions.html", "living-time-sphere.html", "garden.html",
    "card-album.html", "episodes.html", "shop.html", "moons.html",
    "practices.html", "hub.html", "teach.html", "codex-atlas.html",
    "equinox-passage.html", "timeline.html"
  ]) {
    assert.ok(intro.includes(`"${page}"`), `a written tour stands for ${page}`);
  }
  /* rooms without a written tour get one from their own
   * headings — every room the Spark walks can be toured */
  assert.match(intro, /function fallbackStops/);
  /* one seen/rest mark per page, in the module's own store */
  assert.match(intro, /sof\.spark\.tours\.v1/);
  assert.match(intro, /function writeTourMark/);
  /* the Spark offers; the keeper's tap starts it; a "not
   * now" rests that room's offer */
  assert.match(intro, /function offerPageTour/);
  assert.match(intro, /PAGE_REST_MS/);
  /* and the Tour button calls any tour back, at any time */
  assert.match(intro, /spark-tour-launcher/);
  assert.match(intro, /function startPageTour/);
});

test("page tours point at the room itself: targets scroll into view and wear the ring of light", () => {
  assert.match(intro, /scrollIntoView/);
  assert.match(intro, /spark-tour-spot/);
  assert.match(introCss, /\.spark-tour-spot/);
});

test("the Sphere's tour rides the overlay alone — no protected file carries or is edited for it", () => {
  const spherePage = read("docs/living-time-sphere.html");
  assert.ok(!spherePage.includes("spark-intro"), "the protected Sphere page does not reference the tour");
  /* the presence — which the Sphere page already loads —
   * brings the tour to every page it walks, ungated */
  const loadIntroBody = presence.slice(presence.indexOf("function loadIntro"));
  assert.ok(!loadIntroBody.slice(0, 600).includes("spark-intro-show"),
    "the tour no longer waits for a Show me button to exist");
  assert.ok(presence.includes("spark-intro.js?v=20261126-3"), "the presence loads the tour everywhere it walks");
  assert.ok(presence.includes("spark-intro.css?v=20261126-3"), "the tour styles ride with it");
  /* the album page, which carries no presence, loads its
   * tour the same lazy way from its own module */
  const album = read("docs/assets/js/codex-card-album.js");
  assert.ok(album.includes("spark-intro.js?v=20261126-3"), "the album loads its room's tour lazily");
  assert.ok(album.includes("spark-intro.css?v=20261126-3"), "the tour styles ride with it");
});

test("the homepage and companions keep their Show me — and their pinned stacks stay whole", () => {
  const index = read("docs/index.html");
  assert.ok(index.includes('id="spark-intro-show"'), "the homepage carries the Show me");
  assert.ok(!index.includes("spark-intro.js"), "the homepage's pinned script stack stays whole — the tour rides in lazily");
  const companions = read("docs/companions.html");
  assert.ok(companions.includes('id="spark-intro-show"'), "the companions page carries the Show me");
  assert.ok(!companions.includes("spark-intro.js"), "the companions page's first load stays lean");
  const pageJs = read("docs/assets/js/spark-companions-page.js");
  assert.ok(pageJs.includes("spark-intro.js?v=20261126-3"), "the tour rides in lazily behind the meeting (the diet)");
  assert.ok(pageJs.includes("spark-intro.css?v=20261126-3"), "the tour styles ride with it");
});

test("the tour reads the day in the calendar's own fields — and lights the Sphere's day", () => {
  /* PatternCalendar.fromCivilDate returns { moon, day,
   * dayOfPatternYear } — the first build read moonIndex /
   * dayOfMoon off it and the day scene said "Moon undefined"
   * while the Sphere scene lit nothing. */
  assert.ok(!/today\.moonIndex|today\.dayOfMoon/.test(intro), "no fields the calendar never returns");
  assert.match(intro, /Moon \$\{today\.moon\} · Day \$\{today\.day\}/);
  assert.match(intro, /sphereSceneSVG\(today && today\.day \? today\.day : 1\)/);
});

test("no tour ever stacks over the meeting", () => {
  /* The meeting owns the screen while it stands (Nov 19,
   * 2026): a manual start puts it aside by its own
   * "Not now" — the Spark waits as an ember — and waits out
   * a meeting that is mid-celebration. */
  assert.match(intro, /yieldToMeeting/);
  assert.match(intro, /spark-encounter-later/);
  assert.match(intro, /is-celebrating/);
  assert.match(intro, /spark-roam-open/);
  assert.match(introCss, /body\.spark-roam-open \.spark-presence/);
  assert.match(introCss, /body\.spark-roam-open \.spark-ember-host/);
  assert.match(introCss, /body\.spark-roam-open \.spark-tour-launcher/);
});

test("the marks stay honest: an old single mark still reads as the keeper's walk seen", () => {
  assert.match(intro, /raw\.keeper \|\| raw\.seen/);
  assert.match(intro, /sof\.spark\.intro\.v1/);
  assert.match(intro, /writeIntroFlags\(\{ keeper: true \}\)/);
});

test("the Spark travels the page — movement is part of the demonstration", () => {
  assert.match(intro, /function placeRoam/);
  assert.match(intro, /cornerPoint/, "it rises from, and glides home to, its corner");
  assert.match(introCss, /transition: transform 0\.95s/);
  assert.match(introCss, /prefers-reduced-motion/);
});

test("no pop-up windows: the tour is the Spark itself, loose on the page", () => {
  /* Aaron, Nov 26, 2026, 17:04: "All that should be done
   * without all the pop up windows though. I wanted the
   * actual spark to just come up in a way and start with
   * all that — or the spark moves around the screen in
   * certain ways and brings you to things in a way where
   * it can even scroll through the pages…" */
  assert.ok(!intro.includes("spark-tour-card"), "no tour card stands");
  assert.ok(!intro.includes("spark-page-tour"), "no docked page-tour card stands");
  assert.ok(!intro.includes('role="dialog"'), "the walk is no modal dialog");
  assert.ok(!introCss.includes(".spark-tour {"), "no overlay window styles remain");
  assert.ok(!introCss.includes(".spark-page-tour"), "no docked card styles remain");
  /* the Spark itself, loose: fixed to the screen, gliding,
   * catching no taps but its own — the page stays live */
  assert.match(intro, /spark-roam/, "the Spark roams");
  assert.match(introCss, /\.spark-roam \{[^}]*position: fixed/);
  assert.match(introCss, /\.spark-roam \{[^}]*pointer-events: none/);
  /* its words travel beside it, in light and shadow */
  assert.match(introCss, /\.spark-roam-speech \{[^}]*text-shadow/);
  /* the pacing is the keeper's, without buttons: tap the
   * Spark to go on; the instruction travels with it */
  assert.match(intro, /figureBtn\.addEventListener\("click", advance\)/);
  assert.match(intro, /Tap me to go on/);
  assert.match(intro, /Tap me, and I'll go home\./);
  /* and the walk never traps: scrolling away ends it, a
   * touch elsewhere ends it, and letting it rest ends it */
  assert.match(intro, /addEventListener\("scroll"/);
  assert.match(intro, /scrolled away|turned back to the page/);
  assert.match(intro, /ROAM_REST_MS/);
  /* the page scrolls with the Spark to the thing it shows */
  assert.match(intro, /scrollIntoView/);
});

test("the meeting stands unboxed too — and its moment still fits the screen", () => {
  /* The first offer sheds the window with the rest (17:04):
   * the Spark comes up at the corner and speaks beside
   * itself, its choices as tappable words. The naming field
   * stays a field — a keeper has to type somewhere. The
   * screen-fit discipline of Aaron's A16 ruling holds: the
   * moment is capped in dvh, its words scroll within their
   * measure, and its choices stay pinned in reach. */
  const companionCss = read("docs/assets/css/spark-companion.css");
  assert.match(companionCss, /\.spark-encounter \{[^}]*background: transparent/, "no card behind the Spark");
  assert.match(companionCss, /\.spark-encounter \{[^}]*max-height: min\(calc\(100dvh - 96px\), 760px\)/);
  assert.match(companionCss, /\.spark-encounter-words \{[^}]*overflow-y: auto/);
  assert.match(companionCss, /\.spark-encounter-actions \{[^}]*position: sticky/);
  assert.match(companionCss, /\.spark-encounter-words p,[^}]*text-shadow/, "its words carry their legibility with them");
  assert.match(companionCss, /\.spark-encounter-adopt \{[^}]*background: none/, "the adopt is a word, not a pill");
  assert.match(companionCss, /\.spark-encounter-adopt \{[^}]*text-decoration: underline/);
});
