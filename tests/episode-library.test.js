const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

/*
 * The Episode Library (docs/episodes.html) and the spine
 * extension it stands on — Unified Story Expansion steps (a)
 * and (b), built to the audit of November 23, 2026.
 *
 * What is pinned here:
 *   - the extended spine is the single source: every chapter
 *     carries its series, synopsis, relations and distinguisher
 *     fields (mark / hum / skill) folded in from the watch
 *     machinery's table;
 *   - the F5/C13 gap is closed: spark-activities derives its
 *     episode table from the spine (deriveEpisodes), adopts it
 *     through useStoryData, and the frozen fallback is pinned
 *     identical to the derivation so the two cannot drift;
 *   - chapter 1's home film is represented as the seventeenth
 *     film (openingFilm) WITHOUT becoming a spine episode (F1);
 *   - planned and scripted episodes live in their own register,
 *     outside the episode contract, and carry no film paths;
 *   - the Library page: three doors, direct links, the captions
 *     honesty line, the vision trailer as headline FEATURE —
 *     never an episode, never in the spine, never wired to the
 *     watch machinery (F4) — and progress that rides
 *     spark-activities.js only (no second tracker, no local
 *     watched store in the library module);
 *   - the parked game is never named in any file this build
 *     touched.
 */

const repoRoot = path.resolve(__dirname, "..");
const docsRoot = path.join(repoRoot, "docs");
const read = rel => fs.readFileSync(path.join(repoRoot, rel), "utf8");
const story = JSON.parse(read("docs/assets/data/codex-story.json"));

function freshActivities() {
  const modulePath = require.resolve("../docs/assets/js/spark-activities.js");
  delete require.cache[modulePath];
  return require(modulePath);
}

/* ------------------------- the spine ------------------------- */

test("every chapter carries its series, synopsis, marks, hum, skill and relations", () => {
  const seriesIds = new Set(story.series.map(s => s.id));
  for (const ch of story.chapters) {
    assert.ok(seriesIds.has(ch.series), `${ch.id} names a registered series`);
    assert.ok(ch.synopsis && ch.synopsis.length > 10, `${ch.id} carries a synopsis`);
    assert.ok(ch.mark && ch.mark.land && ch.mark.moonName && ch.mark.token,
      `${ch.id} carries its distinguisher mark (land, Moon, token)`);
    assert.ok(ch.hum && ch.hum.rootHz > 0 && ch.hum.scale && Array.isArray(ch.hum.motifHz),
      `${ch.id} carries its hum`);
    assert.ok("skill" in ch, `${ch.id} carries a skill field (null where the curriculum names none)`);
    assert.ok(Array.isArray(ch.relations), `${ch.id} carries relations`);
    for (const rel of ch.relations) {
      assert.ok(story.chapters.some(c => c.id === rel.id), `${ch.id} relates to a real chapter: ${rel.id}`);
      assert.ok(["same-land", "thread", "crosses"].includes(rel.kind), `${ch.id} relation kind is known: ${rel.kind}`);
    }
    /* The distinguisher stays nested: the Sphere's story marks
     * read top-level patternDay/moon, and a chapter must never
     * grow those (the armillary pin). */
    assert.ok(!("patternDay" in ch) && !("moon" in ch), `${ch.id} carries no top-level patternDay/moon`);
  }
});

test("the series register names the Living Circuit, registered by the bible amendment", () => {
  const lc = story.series.find(s => s.id === "the-living-circuit");
  assert.ok(lc, "the Living Circuit is registered");
  assert.equal(lc.status, "planned");
  const nr = story.series.find(s => s.id === "the-night-road");
  assert.equal(nr.status, "scripted");
  const ids = story.series.map(s => s.id);
  assert.equal(new Set(ids).size, ids.length, "series ids are unique");
});

test("the planned register: no film paths, Night Road scripted, Living Circuit five and planned", () => {
  const seriesIds = new Set(story.series.map(s => s.id));
  for (const entry of story.planned) {
    assert.ok(seriesIds.has(entry.series), `${entry.id} names a registered series`);
    assert.ok(!("film" in entry) && !("poster" in entry) && !("episode" in entry),
      `${entry.id} stands outside the episode contract — no film, no poster, no episode object`);
    assert.ok(fs.existsSync(path.join(docsRoot, entry.page)), `${entry.id} names a real destination page: ${entry.page}`);
  }
  const nightRoad = story.planned.filter(p => p.series === "the-night-road");
  assert.equal(nightRoad.length, 6, "the Night Road's six episodes are registered");
  assert.ok(nightRoad.every(p => p.status === "scripted"), "the Night Road stands as scripted, not filmed");
  const circuit = story.planned.filter(p => p.series === "the-living-circuit");
  assert.equal(circuit.length, 5, "the Living Circuit has its five episodes");
  assert.ok(circuit.every(p => p.status === "planned"), "the Living Circuit stands as planned, not filmed");
  const byTitle = Object.fromEntries(circuit.map(p => [p.title, p.page]));
  assert.equal(byTitle["The Conduit in the Hand"], "systems/t-7.html");
  assert.equal(byTitle["Sixteen Locks"], "lab.html");
  assert.equal(byTitle["The Earth's Heartbeat"], "systems/frequencies.html");
  assert.equal(byTitle["The Lattice Under the Land"], "map.html");
  assert.equal(byTitle["The Ladder of Scales"], "living-time-sphere.html");
});

test("chapter 1's home film is the seventeenth film — represented, never a spine episode (F1)", () => {
  const ch1 = story.chapters.find(c => c.n === 1);
  assert.ok(!("episode" in ch1), "chapter 1 still carries no episode object");
  const opening = story.openingFilm;
  assert.ok(opening, "the opening film is represented at the spine's top level");
  assert.equal(opening.chapterId, ch1.id);
  assert.ok(fs.existsSync(path.join(docsRoot, opening.film)), "the opening film exists");
  assert.ok(fs.existsSync(path.join(docsRoot, opening.poster)), "the opening poster exists");
  const episodeFilms = story.chapters.filter(c => c.episode).map(c => c.episode.film);
  assert.equal(episodeFilms.length, 16, "sixteen chapters carry episodes");
  assert.ok(!episodeFilms.includes(opening.film), "the home film is no chapter's episode");
  assert.equal(new Set([...episodeFilms, opening.film]).size, 17, "seventeen distinct films in one place");
});

test("every claimed film and poster exists, and no story film is orphaned", () => {
  const referenced = new Set([story.openingFilm.film]);
  for (const ch of story.chapters) {
    if (!ch.episode) continue;
    referenced.add(ch.episode.film);
    assert.ok(fs.existsSync(path.join(docsRoot, ch.episode.film)), `${ch.id} film exists`);
    assert.ok(fs.existsSync(path.join(docsRoot, ch.episode.poster)), `${ch.id} poster exists`);
  }
  const mediaDir = path.join(docsRoot, "assets/media");
  for (const name of fs.readdirSync(mediaDir)) {
    if (/^story-episode-\d+.*\.mp4$/.test(name) || name === "codex-cartoon-clip.mp4") {
      assert.ok(referenced.has(`assets/media/${name}`), `no orphan story film: ${name}`);
    }
  }
});

/* --------------------- the F5/C13 closure --------------------- */

test("deriveEpisodes folds the spine into exactly the frozen fallback table", () => {
  const Activities = freshActivities();
  const derived = Activities.deriveEpisodes(story);
  assert.ok(Array.isArray(derived), "the spine derives");
  assert.deepEqual(derived, Activities.EPISODES,
    "the spine now carries everything the frozen table held — the two cannot drift");
});

test("useStoryData adopts the spine's table; a malformed spine leaves the fallback standing", () => {
  const Activities = freshActivities();
  const altered = JSON.parse(JSON.stringify(story));
  altered.chapters[0].mark.token = "a corrected token";
  assert.equal(Activities.useStoryData(altered), true, "a well-formed spine is adopted");
  assert.equal(Activities.episodeByChapterId(altered.chapters[0].id).token, "a corrected token",
    "the watch machinery reads the spine's values, not a second copy");
  assert.equal(Activities.useStoryData(null), false);
  assert.equal(Activities.useStoryData({ chapters: [{ id: "x" }] }), false);
  assert.equal(Activities.episodeByChapterId(altered.chapters[0].id).token, "a corrected token",
    "a refused spine changes nothing");
});

test("the story layer hands its loaded spine to the watch machinery", () => {
  const layer = read("docs/assets/js/story-layer.js");
  assert.ok(layer.includes("useStoryData"), "the layer hands the story over (F5/C13)");
  assert.ok(layer.includes("assets/js/spark-activities.js"), "the lazy-load stands");
});

/* ------------------------- the Library ------------------------- */

const page = read("docs/episodes.html");
const libraryJs = read("docs/assets/js/episode-library.js");

test("the Library page stands with its three doors as equals", () => {
  for (const door of ["#watch", "#explore", "#continue"]) {
    assert.ok(page.includes(`href="${door}"`), `the ${door} door stands`);
  }
  assert.ok(page.includes('id="watch"') && page.includes('id="explore"') && page.includes('id="continue"'),
    "all three door targets stand");
  assert.ok(page.includes('id="ep-' ) === false, "cards are rendered from the spine, not hand-written");
  assert.ok(page.includes("episode-library.js"), "the library module is loaded");
  assert.ok(!page.includes("story-layer.js"), "the library renders its own cards — the story layer is not loaded here");
  assert.ok(!/<script[^>]+spark-activities\.js/.test(page),
    "the watch machinery is lazy-loaded by the module, never carried statically");
});

test("the Library says plainly that captions are not yet available", () => {
  assert.ok(page.includes("Captions are not yet available"), "the captions honesty line stands");
  assert.ok(page.includes("reading companion"), "the written chapter is named as the reading companion");
});

test("the vision trailer headlines as a FEATURE — never an episode, never in the spine (F4)", () => {
  assert.ok(page.includes("codex-vision-trailer-v2.mp4"), "the trailer film is placed");
  assert.ok(page.includes('poster="assets/media/codex-vision-trailer-v2-poster.webp"'), "poster-first");
  assert.ok(page.includes('preload="none"'), "lazy by the house pattern");
  assert.ok(fs.existsSync(path.join(docsRoot, "assets/media/codex-vision-trailer-v2.mp4")), "the film file stands in the repo");
  assert.ok(fs.existsSync(path.join(docsRoot, "assets/media/codex-vision-trailer-v2-poster.webp")), "the poster stands in the repo");
  assert.ok(!JSON.stringify(story).includes("codex-vision-trailer"), "the trailer is nowhere in the spine");
  const feature = page.slice(page.indexOf("library-feature"), page.indexOf('id="continue"'));
  assert.ok(!feature.includes("data-story-slot"), "the feature is never wired as an episode");
  assert.ok(feature.includes("Feature presentation"), "it is presented as a feature");
});

test("cards ride the watch machinery's own figure contract; progress is read, never re-tracked", () => {
  assert.ok(libraryJs.includes('"story-episode"') || libraryJs.includes("'story-episode'") || libraryJs.includes("story-episode"),
    "the figures carry the story-episode class the machinery observes");
  assert.ok(libraryJs.includes("data-story-slot") && libraryJs.includes("data-story-chapter"),
    "each card stands in a named story slot, by chapter id");
  assert.ok(libraryJs.includes("useStoryData"), "the module hands the spine to the watch machinery");
  assert.ok(libraryJs.includes("foldWatches") && libraryJs.includes("createRepositoryResolver"),
    "Continue reads the keeper's place through the same fold and resolver");
  assert.ok(!libraryJs.includes("localStorage"), "the library keeps no watched store of its own");
  assert.ok(!libraryJs.includes("createWatchTracker"), "the coverage tracker is never rebuilt here");
});

test("planned and scripted episodes render apart, with no player", () => {
  assert.ok(page.includes('id="planned"'), "the planned shelf stands apart on the page");
  assert.ok(libraryJs.includes("planned"), "the shelf renders from the spine's planned register");
  const plannedRender = libraryJs.slice(libraryJs.indexOf("renderPlanned"));
  assert.ok(!plannedRender.includes("episodeFigure("), "no planned entry is ever given a player");
});

test("the white paper no longer describes the trailer as awaiting approval", () => {
  const paper = read("docs/codex-white-paper.html");
  assert.ok(!paper.includes("first six clips generated"), "the six-clips line is gone");
  assert.ok(!paper.includes("gated on the author's approval of the script"), "the approval gate line is gone");
  assert.ok(paper.includes("Episode Library"), "the paper names the trailer's placed home");
});

test("the growth record carries the Library at index 31, under the pinned head", () => {
  const updates = JSON.parse(read("docs/assets/data/codex-updates.json"));
  assert.equal(updates[0].title, "The Sphere's shining days were made true and light", "the pinned head stands");
  assert.equal(updates[31].url, "./episodes.html", "the Library entry stands at index 31 (the Sphere's breathing entry landed above it in PR #267, the one-story entry above that in PR #270, the Sphere details entry above that in PR #272, the Free the Spark rename entry above that, the site-wide metadata entry above that, the Genesis profile entry above that, the Spark fence entry above that, the Spark inhabitant entry above that, the Spark keeper's-ways entry above that, the Spark tricks entry above that, the Spark home entry above that, the Spark seasons entry above that, the Spark road entry above that, the Sphere app-mode entry above that, the Witness tending entry above that, the sky rule entry above that, the stale-lines entry above that, the mobile-shape entry above that, the accounts entry above that, the stage entry above that, the arrival entry above that, and the one-redesign entry above that, and the shop-shelf entry above that, and the Spark scheduling entry above that, and the sphere-performance entry above that, and the honesty entry above that, and the theory-doorway-merges entry above that, and the ease entry above that, and the home-merges entry above that, and the sphere-upgrade entry above that)");
  assert.equal(updates[31].date, "2026-11-23");
  const index = read("docs/index.html");
  const growth = index.slice(index.indexOf("data-le-growth"), index.indexOf("</ul>", index.indexOf("data-le-growth")));
  assert.ok(growth.includes("Talking with the Spark grew easier: fewer sentences, more taps"), "the homepage panel mirrors the newest entries (the sphere-performance entry aged off the panel's newest four at the home-merges landing, as the scheduling entry did at the ease landing)");
  assert.ok(growth.includes("Four theory doorways folded into the pages they govern"), "the homepage panel mirrors the newest entries (the honesty entry aged off the door's newest four at the sphere-upgrade landing, as the sphere-performance entry did at the home-merges landing)");
  assert.equal((growth.match(/<li>/g) || []).length, 4, "the panel mirrors the newest four");
});

test("the parked game is never named in anything this build touched", () => {
  const touched = [
    "docs/episodes.html",
    "docs/assets/js/episode-library.js",
    "docs/assets/css/episode-library.css",
    "docs/assets/data/codex-story.json",
    "docs/assets/js/spark-activities.js",
    "docs/assets/js/story-layer.js"
  ];
  for (const rel of touched) {
    assert.ok(!/noods/i.test(read(rel)), `${rel} never names the parked game`);
  }
});
