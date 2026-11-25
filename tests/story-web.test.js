/**
 * The story web, finished weaving — Page Evolution Batch E6
 * (Nov 25, 2026).
 *
 * Three weaves: the biography gains its story door (one episode
 * matched to it, labelled as story); the Map's lands name their
 * episodes by name, Moon and token; and every episode in the
 * Library gains its watch-and-do study strip — the school's
 * second way in — with the doings drawn from the story bible's
 * own curriculum table, never invented here. The v4 film swap
 * is NOT in this batch: it lands only on Aaron's word after
 * his watch.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const docs = path.join(__dirname, "..", "docs");
const read = (rel) => fs.readFileSync(path.join(docs, rel), "utf8");
const spine = JSON.parse(read("assets/data/codex-story.json"));

test("the biography's story door: one episode, matched and labelled as story", () => {
  const page = read("about-aaron.html");
  assert.ok(page.includes('id="story-door"'), "the door stands");
  assert.ok(page.includes("Story — the Traveller's Road"), "the door is labelled as story");
  assert.ok(page.replace(/\s+/g, " ").includes("The Traveller is a figure of the story, not a claim about the man"), "record and story are kept apart on its face");
  const gate = spine.chapters.find((c) => c.id === "the-gate-at-first-light");
  assert.ok(gate, "the matched chapter stands in the spine");
  assert.equal(gate.mark.moonName, "Seed Flame");
  assert.equal(gate.mark.token, "the lantern's spark");
  assert.ok(page.includes("The Gate at First Light"), "the door names the episode");
  assert.ok(page.includes('href="./episodes.html#watch"'), "the door opens onto the Library's Watch shelf, where the episode stands first (its card id is rendered by the Library's own script, so the door aims at the shelf that stands in the static page)");
  assert.ok(page.includes('href="./map.html"'), "the door names the whole road");
});

test("the watch-and-do strip: a doing for every skill the spine teaches, from the bible's table", () => {
  const library = read("assets/js/episode-library.js");
  assert.ok(library.includes("studyStrip(chapter)"), "every card renders its strip");
  assert.ok(library.includes("Watch — then do: "), "the strip speaks its name");
  assert.ok(library.includes("Watch — then sit with its beat: "), "skill-less chapters get their beat, not an invented practice");
  const table = library.match(/const KEEPER_PRACTICES = \{([\s\S]*?)\n  \};/);
  assert.ok(table, "the practices table stands in the open");
  const covered = new Set([...table[1].matchAll(/(\d+): "/g)].map((m) => Number(m[1])));
  const taught = new Set(spine.chapters.filter((c) => c.skill).map((c) => c.skill.n));
  assert.ok(taught.size >= 10, "the spine teaches at least ten skills");
  for (const n of taught) assert.ok(covered.has(n), `skill ${n} has its keeper's practice`);
  for (const practice of ["Walk one day whole, slowly.", "The evening review", "Pin a claim to its days", "Return to a place or a book a second time, on purpose."]) {
    assert.ok(table[1].includes(practice), `the bible's own words stand: ${practice}`);
  }
});

test("the Map's lands name their episodes by name, Moon and token", () => {
  const map = read("assets/js/travellers-map.js");
  assert.ok(map.includes("Its episode: "), "the land names its episode");
  assert.ok(map.includes("mark.moonName") && map.includes("mark.token"), "named by Moon and token, the canon's telling-apart");
  for (const chapter of spine.chapters) {
    assert.ok(chapter.mark && chapter.mark.land && chapter.mark.moonName && chapter.mark.token,
      `${chapter.id} carries the marks its land names it by`);
  }
});

test("the film swap is not in this batch: the Library still serves its standing cuts", () => {
  const films = new Set(spine.chapters.filter((c) => c.episode).map((c) => c.episode.film));
  assert.ok(films.size >= 16, "the standing episode films stand");
  for (const film of films) assert.ok(!/v4/i.test(film), `no v4 file rides the spine: ${film}`);
});
