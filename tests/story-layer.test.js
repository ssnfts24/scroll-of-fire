const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repoRoot = path.resolve(__dirname, "..");
const docsRoot = path.join(repoRoot, "docs");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

/* One shared realm for the calendar, the trail and the thread —
 * the house pattern (cf. pattern-garden's loadBundle): the
 * calendar's coerceDate uses instanceof Date, which only holds
 * inside a single realm, exactly as in the browser. */
function loadWorld() {
  const context = vm.createContext({ console, module: { exports: {} }, exports: {} });
  context.globalThis = context;
  for (const file of [
    "pattern-calendar-version.js",
    "pattern-calendar-data.js",
    "pattern-calendar-format.js",
    "pattern-calendar-boundary.js",
    "pattern-calendar.js"
  ]) {
    vm.runInContext(read(`docs/assets/js/calendar/${file}`), context, { filename: file });
  }
  vm.runInContext(read("docs/assets/js/living-trail.js"), context, { filename: "living-trail.js" });
  vm.runInContext(read("docs/assets/js/year-thread.js"), context, { filename: "year-thread.js" });
  return {
    PatternCalendar: context.PatternCalendar,
    LivingTrail: context.LivingTrail,
    YearThread: context.YearThread
  };
}

const story = JSON.parse(read("docs/assets/data/codex-story.json"));

test("the spine: chapters are numbered in walking order, each on a real page that carries its slot", () => {
  assert.equal(story.title, "The Traveller's Road");
  assert.ok(story.note.includes("plainly a story"), "the spine states the fence on its face");
  story.chapters.forEach((chapter, i) => {
    assert.equal(chapter.n, i + 1, "chapters number in walking order");
    assert.ok(chapter.beat && chapter.title && chapter.place, `chapter ${chapter.n} carries a beat, a title and a place`);
    assert.ok(Array.isArray(chapter.text) && chapter.text.length >= 3, `chapter ${chapter.n} carries its own lines`);
    const page = fs.readFileSync(path.join(docsRoot, chapter.page), "utf8");
    if (chapter.page === "living-time-sphere.html") {
      // The Day World room is built late; its slot is set by the
      // armillary layer beside the day-door scene.
      const layer = read("docs/assets/js/sphere-armillary.js");
      assert.ok(layer.includes(`data-story-chapter", "${chapter.id}"`), "the Sphere's chapter slot is set in the Day World room");
    } else {
      assert.ok(
        page.includes(`data-story-chapter="${chapter.id}"`),
        `${chapter.page} carries the slot for its own chapter (${chapter.id})`
      );
    }
    assert.ok(page.includes("story-layer.js"), `${chapter.page} loads the story layer`);
  });
});

test("the story never speaks as Aaron and never borrows the record's language", () => {
  const banned = ["according to the record", "the evidence shows", "Aaron says", "I, Aaron", "verified finding"];
  for (const chapter of story.chapters) {
    const text = [chapter.beat, ...chapter.text].join(" ");
    for (const phrase of banned) {
      assert.ok(!text.toLowerCase().includes(phrase), `chapter ${chapter.n} keeps the story/record fence (${phrase})`);
    }
  }
});

test("the pending list names every unfitted page, and only unfitted pages", () => {
  const fitted = new Set(story.chapters.map(c => c.page));
  const excluded = new Set(["404.html", "offline.html", "caravan.html"]);
  const all = [];
  (function walk(dir, prefix) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (prefix === "" && ["scroll", "scripture", "assets"].includes(entry.name)) continue;
        walk(path.join(dir, entry.name), prefix + entry.name + "/");
      } else if (entry.name.endsWith(".html")) {
        all.push(prefix + entry.name);
      }
    }
  })(docsRoot, "");
  const pending = new Set(story.pending.map(p => p.page));
  for (const page of all) {
    if (fitted.has(page) || excluded.has(page)) {
      assert.ok(!pending.has(page), `${page} is fitted or utility — it must not sit in the pending list`);
    } else {
      assert.ok(pending.has(page), `${page} must be named as pending until its own chapter is written`);
    }
  }
  for (const page of pending) {
    assert.ok(all.includes(page), `pending names a real page: ${page}`);
  }
});

test("the trail stamps finds with the canonical Pattern coordinate", () => {
  const { LivingTrail: trail } = loadWorld();
  const at = new Date(Date.UTC(2026, 10, 20, 12)); // Nov 20, 2026 → PD 218, Moon 8 Day 22
  const stamp = trail.stampFor(at);
  assert.equal(stamp.patternDay, 218);
  assert.equal(stamp.patternYear, 2026, "the stamp's year is the anchor's civil year");
  const stamped = trail.recordFindIn(trail.emptyTrail(), "the-gate-at-first-light", stamp);
  const find = trail.findFor(stamped, "the-gate-at-first-light");
  assert.equal(find.patternDay, 218);
  assert.equal(find.moon, 8);
  assert.equal(find.moonDay, 22);
  assert.equal(find.civilDate, "2026-11-20");
  const restamped = trail.recordFindIn(stamped, "the-gate-at-first-light", trail.stampFor(new Date(Date.UTC(2026, 10, 21, 12))));
  assert.equal(trail.findFor(restamped, "the-gate-at-first-light").patternDay, 218, "the first find stands");
  assert.deepEqual([...trail.daysForYear(stamped, 2026)], [218], "a find also ties its day onto the trail");
});

test("the year thread model: today, knots and find-days from the trail alone", () => {
  const { LivingTrail: trailApi, YearThread } = loadWorld();

  let trail = trailApi.emptyTrail();
  trail = trailApi.recordDayIn(trail, trailApi.stampFor(new Date(Date.UTC(2026, 10, 18, 12))));
  trail = trailApi.recordDayIn(trail, trailApi.stampFor(new Date(Date.UTC(2026, 10, 19, 12))));
  trail = trailApi.recordFindIn(trail, "a-friend-for-the-road", trailApi.stampFor(new Date(Date.UTC(2026, 10, 20, 12))));
  const stamp = trailApi.stampFor(new Date(Date.UTC(2026, 10, 20, 12)));
  const model = YearThread.threadModel(trail, stamp);
  assert.equal(model.today, 218);
  assert.equal(model.moon, 8);
  assert.deepEqual([...model.stoodDays], [216, 217, 218]);
  assert.deepEqual([...model.findDays], [218]);
});

test("episodes: a filmed chapter carries its episode in the spine, under the contract the layer and the map honour", () => {
  const filmed = story.chapters.filter(c => c.episode);
  assert.deepEqual(
    filmed.map(c => c.n),
    [2, 3, 4, 5],
    "exactly the episodes produced are filmed — chapter 2, the pattern-setter, and Series One Batch 1 (chapters 3, 4, 5); chapter 1 carries no episode contract and the rest land as they are filmed"
  );
  for (const chapter of filmed) {
    const { film, poster, duration } = chapter.episode;
    assert.ok(film.startsWith("assets/media/") && film.endsWith(".mp4"), `chapter ${chapter.n}'s episode names its film`);
    assert.ok(fs.existsSync(path.join(docsRoot, film)), `chapter ${chapter.n}'s film stands in the media folder`);
    assert.ok(fs.existsSync(path.join(docsRoot, poster)), `chapter ${chapter.n}'s poster stands in the media folder`);
    assert.ok(/^\d+:\d{2}$/.test(duration), `chapter ${chapter.n}'s episode states its length`);
    assert.equal(
      chapter.episode.label,
      `Episode ${chapter.n} — the animated telling of this chapter. The written chapter below is its guide card.`,
      `chapter ${chapter.n}'s episode carries the label in the pattern-setter's form`
    );
  }
  assert.ok(!story.chapters[0].episode, "chapter 1 carries no episode contract");
  const layer = read("docs/assets/js/story-layer.js");
  assert.ok(layer.includes("chapter.episode && !plain"), "the episode drops on plain surfaces, by the same fence as the scene");
  assert.ok(layer.includes("story-episode") && layer.includes('preload = "none"'), "the layer renders the episode poster-first and lazy");
  const map = read("docs/assets/js/travellers-map.js");
  assert.ok(map.includes("chapter.episode"), "the map reflects which chapters are filmed");
});

test("the map page and the fitted pages carry the layer honestly", () => {
  const map = fs.readFileSync(path.join(docsRoot, "map.html"), "utf8");
  assert.ok(map.includes("The Traveller's Map"), "the map page stands");
  assert.ok(map.includes('id="map-regions"') && map.includes('id="map-road"') && map.includes('id="map-pending"'),
    "the map carries lands, road and the named pending pages");
  assert.ok(map.includes("data-year-thread"), "the Year Thread stands on the map");
  assert.ok(map.includes("travellers-map.js") && map.includes("year-thread.js"), "the map loads its modules");

  const layer = read("docs/assets/js/story-layer.js");
  assert.ok(layer.includes("A story, told alongside the record"), "every chapter renders under the story label");
  assert.ok(layer.includes("data-story-plain"), "the plain-words-only fence for Scripture/Evidence surfaces is built into the layer");

  const index = fs.readFileSync(path.join(docsRoot, "index.html"), "utf8");
  assert.ok(index.includes("data-year-thread"), "the Year Thread stands on the home page too");
  assert.ok(index.includes('data-story-chapter="the-gate-at-first-light"'), "the home page opens the story");
});
