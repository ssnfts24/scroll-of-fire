const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

/*
 * Unified Story Expansion steps (c) and (d) — Nov 23, 2026.
 *
 * What is pinned here:
 *   - step (c): the Traveller's Map carries the whole road from
 *     the one spine — every chapter in the road list, every
 *     filmed episode (the sixteen, plus the opening chapter via
 *     openingFilm) with a door into the Episode Library at its
 *     anchor, distinguisher marks on the map's face, relations
 *     named from the spine, and the planned register standing as
 *     its own shelf, grouped by series, with no player anywhere;
 *   - the Living Circuit's five planned episodes each stand on
 *     their destination surface as planned only: a story-layer
 *     planned slot on the T-7's page, in the Lab and at the
 *     Sound Observatory; the map's own planned shelf for the
 *     map's episode; the Sphere's companion layer for the
 *     Ladder of Scales;
 *   - step (d): the Sphere's day→story doors shape the spine at
 *     Moon granularity — every chapter offered exactly once
 *     across the thirteen Moons, the unwritten Moons (Deep
 *     Mirror, Completion Seal) honestly empty, doors addressed
 *     to the Library's anchors, and no film path ever carried
 *     by an offer (the surface offers doors; it does not play);
 *   - fences: the planned render path of the story layer builds
 *     no player and stamps no find; the protected Sphere page
 *     itself is untouched (the doors ride the companion layer's
 *     loader, like the farm and the Day World before them); the
 *     parked game is never named in anything this build touched.
 */

const repoRoot = path.resolve(__dirname, "..");
const docsRoot = path.join(repoRoot, "docs");
const read = rel => fs.readFileSync(path.join(repoRoot, rel), "utf8");
const story = JSON.parse(read("docs/assets/data/codex-story.json"));

function moonNames() {
  const context = vm.createContext({ console });
  context.globalThis = context;
  vm.runInContext(read("docs/assets/js/calendar/pattern-calendar-data.js"), context, {
    filename: "pattern-calendar-data.js"
  });
  return context.PatternCalendarData.moonNames;
}

/* --------------------- step (c): the map --------------------- */

test("the map's helpers: every chapter of the road is filmed or carried, from the spine alone", () => {
  const Map = require("../docs/assets/js/travellers-map.js");
  const filmed = story.chapters.filter(c => Map.isFilmed(story, c));
  assert.equal(filmed.length, 17, "all seventeen chapters count as filmed — sixteen episodes plus the opening film");
  for (const chapter of story.chapters) {
    const marks = Map.marksLine(chapter);
    assert.ok(marks.includes(chapter.mark.land), `${chapter.id}: marks name its land`);
    assert.ok(marks.includes(chapter.mark.moonName), `${chapter.id}: marks name its Moon`);
    assert.ok(marks.includes(chapter.mark.token), `${chapter.id}: marks name its token`);
    assert.equal(Map.libraryHref(chapter), `episodes.html#ep-${chapter.id}`);
  }
  const groups = Map.plannedGroups(story);
  const grouped = groups.flatMap(g => g.entries);
  assert.equal(grouped.length, story.planned.length, "the planned groups cover the whole register");
  const circuit = groups.find(g => g.series.id === "the-living-circuit");
  assert.ok(circuit, "the Living Circuit stands among the map's planned groups");
  assert.equal(circuit.entries.length, 5, "with its five episodes");
});

/* A minimal DOM the map module can draw into, so completeness is
 * proven on the rendered lists themselves, not on intentions. */
class FakeEl {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.className = "";
    this._text = "";
    this.parentNode = null;
    this.attributes = {};
    this.classList = {
      add: (...names) => {
        this.className = [this.className, ...names].filter(Boolean).join(" ");
      }
    };
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return name in this.attributes ? this.attributes[name] : null; }
  hasAttribute(name) { return name in this.attributes; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() {
    return this._text + this.children.map(c => c.textContent || "").join("");
  }
  append(...nodes) {
    for (const node of nodes) {
      if (node && typeof node === "object") node.parentNode = this;
      this.children.push(node);
    }
  }
  appendChild(node) { this.append(node); return node; }
  replaceChildren(...nodes) { this.children = []; this._text = ""; this.append(...nodes); }
}

function collectHrefs(el, out = []) {
  if (el.href) out.push(el.href);
  for (const child of el.children || []) collectHrefs(child, out);
  return out;
}

function collectByClass(el, className, out = []) {
  if (el.className === className) out.push(el);
  for (const child of el.children || []) collectByClass(child, className, out);
  return out;
}

async function renderMap() {
  const createdTags = [];
  const hosts = {};
  for (const id of ["map-regions", "map-road", "map-pending", "map-planned", "map-pending-count"]) {
    hosts[id] = new FakeEl("div");
  }
  const documentStub = {
    readyState: "complete",
    getElementById: id => hosts[id] || null,
    createElement: tag => { createdTags.push(tag); return new FakeEl(tag); },
    createTextNode: text => ({ nodeType: 3, textContent: String(text) }),
    addEventListener: () => {}
  };
  const context = vm.createContext({
    console,
    document: documentStub,
    fetch: async () => ({ ok: true, json: async () => story }),
    module: { exports: {} },
    exports: {}
  });
  context.globalThis = context;
  vm.runInContext(read("docs/assets/js/travellers-map.js"), context, { filename: "travellers-map.js" });
  for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve));
  return { hosts, createdTags };
}

test("the rendered map: the road list carries all seventeen, each filmed episode with its Library door", async () => {
  const { hosts, createdTags } = await renderMap();
  const Map = require("../docs/assets/js/travellers-map.js");
  const road = hosts["map-road"];
  assert.equal(road.children.length, 17, "the road list carries every chapter");
  story.chapters.forEach((chapter, i) => {
    const hrefs = collectHrefs(road.children[i]);
    assert.ok(hrefs.includes(chapter.page), `${chapter.id}: the road links to its own page`);
    if (Map.isFilmed(story, chapter)) {
      assert.ok(hrefs.includes(`episodes.html#ep-${chapter.id}`),
        `${chapter.id}: the road doors into the Library at its anchor`);
    }
    assert.ok(road.children[i].textContent.includes(chapter.mark.moonName),
      `${chapter.id}: the road shows its Moon mark`);
  });
  const withScenes = story.chapters.filter(c => c.scene);
  assert.equal(hosts["map-regions"].children.length, withScenes.length,
    "the lands are exactly the chapters carrying scenes");
  assert.ok(!createdTags.includes("video"), "the map builds no player, anywhere");
});

test("the rendered map: the planned shelf carries the whole register, grouped, with no player", async () => {
  const { hosts } = await renderMap();
  const cards = collectByClass(hosts["map-planned"], "map-planned-card");
  assert.equal(cards.length, story.planned.length, "every planned episode stands on the map's shelf");
  const circuitTitles = ["The Conduit in the Hand", "Sixteen Locks", "The Earth's Heartbeat",
    "The Lattice Under the Land", "The Ladder of Scales"];
  for (const title of circuitTitles) {
    const card = cards.find(c => c.textContent.includes(title));
    assert.ok(card, `${title} stands on the map's planned shelf`);
    assert.ok(card.textContent.includes("not yet filmed"), `${title} is marked plainly as not yet filmed`);
  }
  for (const entry of story.planned) {
    const card = cards.find(c => c.id === `map-planned-${entry.id}`);
    assert.ok(card, `${entry.id} carries its planned card`);
    const hrefs = collectHrefs(card);
    assert.ok(hrefs.includes(entry.page), `${entry.id}: the card names the page it will belong to`);
    assert.ok(hrefs.includes(`episodes.html#planned-${entry.id}`),
      `${entry.id}: the card doors to the Library's planned shelf`);
  }
  const mapHtml = read("docs/map.html");
  assert.ok(mapHtml.includes('id="map-planned"'), "the map page carries the planned shelf's host");
  assert.ok(mapHtml.includes("The Lattice Under the Land"),
    "the map names its own planned episode — the Lattice's placement is this page itself");
});

/* ------------- the written chapter, folded (Aaron) ------------- */

/* Aaron's added scope, Nov 23, 2026: the episode's written
 * chapter stood open under its film and took over the page
 * (shop.html on his phone). "These details should at very least
 * be closed and expandable to open." The fold lives in the story
 * layer's one renderer, so every destination page gets it at
 * once; this renders the Registry Stall's real slot in a minimal
 * DOM and pins the result. */
async function renderChapterSlot(chapterId) {
  const slot = new FakeEl("div");
  slot.setAttribute("data-story-slot", "");
  slot.setAttribute("data-story-chapter", chapterId);
  const documentStub = {
    readyState: "complete",
    baseURI: "http://localhost/",
    body: new FakeEl("body"),
    head: new FakeEl("head"),
    querySelector: () => null,
    querySelectorAll: sel => (sel === "[data-story-slot]" ? [slot] : []),
    createElement: tag => new FakeEl(tag),
    createTextNode: text => ({ nodeType: 3, textContent: String(text) }),
    addEventListener: () => {},
    dispatchEvent: () => true
  };
  class ObserverStub { observe() {} }
  const context = vm.createContext({
    console,
    document: documentStub,
    fetch: async () => ({ ok: true, json: async () => story }),
    MutationObserver: ObserverStub,
    URL,
    module: { exports: {} },
    exports: {}
  });
  context.globalThis = context;
  vm.runInContext(read("docs/assets/js/story-layer.js"), context, { filename: "story-layer.js" });
  for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve));
  return slot;
}

test("the written chapter renders folded shut under its film, the whole text present", async () => {
  const chapter = story.chapters.find(c => c.id === "the-registry-stall");
  const slot = await renderChapterSlot(chapter.id);
  const figure = slot.children.find(el => el.className === "story-episode");
  assert.ok(figure, "the episode's film stands in the slot");
  const fold = slot.children.find(el => el.className === "story-chapter-text");
  assert.ok(fold, "the written chapter stands in a fold");
  assert.equal(fold.tagName, "DETAILS", "the fold is a native details element — it works with no JavaScript");
  assert.ok(!fold.hasAttribute("open"), "the fold is closed by default");
  assert.ok(slot.children.indexOf(figure) < slot.children.indexOf(fold),
    "the fold stands under the film");
  const summary = fold.children.find(el => el.tagName === "SUMMARY");
  assert.ok(summary, "the fold carries its summary row");
  assert.equal(summary.textContent, `Read the written chapter — ${chapter.title}`,
    "the summary row names the chapter and invites the read");
  assert.ok(fold.textContent.includes(chapter.beat), "the chapter's beat is inside the fold");
  for (const para of chapter.text) {
    assert.ok(fold.textContent.includes(para), "the chapter's full text is present inside the fold, unchanged");
  }
  const foot = slot.children.find(el => el.className === "story-foot");
  assert.ok(foot, "the story's label stands outside the fold, on the chapter's face");
  assert.ok(!fold.children.includes(foot), "the label is not folded away");
});

/* ----------------- the planned placements ----------------- */

test("the Living Circuit's five stand on their pages as planned only, through the story layer", () => {
  const layer = read("docs/assets/js/story-layer.js");
  assert.ok(layer.includes("data-story-planned"), "the story layer renders planned slots");
  const plannedPath = layer.slice(layer.indexOf("function renderPlanned"), layer.indexOf("let storyPromise"));
  assert.ok(!plannedPath.includes("video"), "the planned render builds no player");
  assert.ok(!plannedPath.includes("recordFind"), "the planned render stamps no find");
  assert.ok(plannedPath.includes("not yet filmed"), "the planned card states its state plainly");

  const placements = {
    "systems/t-7.html": "lc-the-conduit-in-the-hand",
    "lab.html": "lc-sixteen-locks",
    "systems/frequencies.html": "lc-the-earths-heartbeat"
  };
  for (const [page, id] of Object.entries(placements)) {
    const html = read(`docs/${page}`);
    assert.ok(html.includes(`data-story-planned="${id}"`), `${page} carries the planned slot for ${id}`);
    assert.ok(html.includes("story-layer.js"), `${page} loads the story layer`);
    assert.ok(html.includes("story-layer.css"), `${page} carries the story layer's dress`);
  }
  /* The remaining two placements are the map's shelf (above) and
   * the Sphere's companion layer (below) — every one of the five
   * is placed, each on the surface its page allows. */
  const circuit = story.planned.filter(p => p.series === "the-living-circuit");
  const placedPages = new Set([...Object.keys(placements), "map.html", "living-time-sphere.html"]);
  for (const entry of circuit) {
    assert.ok(placedPages.has(entry.page), `${entry.id} has its placement on ${entry.page}`);
  }
});

/* --------------------- step (d): the Sphere --------------------- */

test("the Sphere doors parse the state strip's own grammar", () => {
  const Doors = require("../docs/assets/js/sphere-story-doors.js");
  assert.deepEqual(Doors.parseReadout("Moon 8 · Day 25 · Day 221/364"),
    { moon: 8, day: 25, patternDay: 221 });
  assert.deepEqual(Doors.parseReadout("Moon 3 · Day 4"), { moon: 3, day: 4, patternDay: null });
  assert.equal(Doors.parseReadout("the Sphere aligning…"), null);
  assert.equal(Doors.parseReadout(""), null);
});

test("the Sphere doors: every chapter is offered exactly once, at Moon granularity", () => {
  const Doors = require("../docs/assets/js/sphere-story-doors.js");
  const names = moonNames();
  assert.equal(names.length, 13, "the calendar names thirteen Moons");
  for (const chapter of story.chapters) {
    assert.ok(names.includes(chapter.mark.moonName),
      `${chapter.id}: its Moon mark is spelled as the calendar spells it — the calendar governs names`);
  }
  const offered = [];
  for (const name of names) {
    for (const offer of Doors.offersForMoon(story, name)) offered.push(offer.id);
  }
  assert.equal(offered.length, 17, "the thirteen Moons between them offer the whole road");
  assert.deepEqual([...offered].sort(), story.chapters.map(c => c.id).sort(),
    "each chapter is offered under its own Moon, once");
  assert.deepEqual(Doors.offersForMoon(story, "Deep Mirror"), [],
    "Moon 8's movement is not yet written — the offer is honestly empty");
  assert.deepEqual(Doors.offersForMoon(story, "Completion Seal"), [],
    "Moon 13's movement is not yet written — the offer is honestly empty");
  const dayDoor = Doors.offersForMoon(story, "Breath Gate");
  assert.deepEqual(dayDoor.map(o => o.id), ["through-the-day-door"],
    "the Day Door stands under Breath Gate, the Moon of its own chapter");
  for (const name of names) {
    for (const offer of Doors.offersForMoon(story, name)) {
      assert.equal(offer.libraryHref, `episodes.html#ep-${offer.id}`,
        `${offer.id}: the door leads to the Library at its anchor`);
      assert.equal(offer.filmed, true, `${offer.id}: offered as filmed`);
      assert.ok(!("film" in offer) && !("n" in offer),
        `${offer.id}: an offer carries marks and doors only — no film path, no number`);
    }
  }
});

test("the Sphere doors carry the Ladder of Scales as planned, and ride the companion layer only", () => {
  const Doors = require("../docs/assets/js/sphere-story-doors.js");
  const planned = Doors.plannedForSphere(story);
  const expected = story.planned.filter(p => p.page === "living-time-sphere.html");
  assert.equal(planned.length, expected.length,
    "every planned episode whose home is the Sphere page is carried — the Day World's four and the Ladder of Scales");
  const ladder = planned.find(p => p.id === "lc-the-ladder-of-scales");
  assert.ok(ladder, "the Living Circuit's Ladder of Scales stands among them");
  assert.equal(ladder.seriesName, "The Living Circuit");
  assert.equal(ladder.libraryHref, "episodes.html#planned-lc-the-ladder-of-scales");

  const companion = read("docs/assets/js/sphere-companion-layer.js");
  assert.ok(companion.includes("sphere-story-doors.js"), "the companion layer loads the doors module");
  assert.ok(companion.includes("data-sphere-story-doors"), "the loader is guarded, in the house pattern");
  const spherePage = read("docs/living-time-sphere.html");
  assert.ok(!spherePage.includes("sphere-story-doors"),
    "the protected Sphere page itself is untouched — the loader is the route");
  const doors = read("docs/assets/js/sphere-story-doors.js");
  assert.ok(doors.includes("sphere-state-strip"), "the doors read the page's public state strip");
  assert.ok(!doors.includes("recordFind") && !doors.includes("localStorage"),
    "the doors write nothing and keep no store of their own");
});

/* ------------------------- fences ------------------------- */

test("the growth record carries this build at index 37, under the one-navigation entry, the scripture entry, the root-refashions entry, the mint entry, the one-statement entry, the Nov 25 Witness tending entry, the app-bridge entry, the small-refashions entry, the Remnant-fold entry, the sphere-upgrade entry, the home-merges entry, the ease entry, the theory-merges entry, the honesty entry, the sphere-performance entry, the pinned head, the shop-shelf entry, the arrival entry, the front-door entry, the stage entry, the accounts entry, the mobile-shape entry, the stale-lines entry, the sky rule entry, the Witness tending entry, the Sphere app-mode entry, the Spark road entry, the Spark seasons entry, the Spark home entry, the Spark tricks entry, the Spark keeper's-ways entry, the Spark inhabitant entry, the Spark fence entry, the Genesis entry, the metadata entry, and the rename entry", () => {
  const updates = JSON.parse(read("docs/assets/data/codex-updates.json"));
  assert.equal(updates[0].title, "One navigation: the second menu is folded away", "the one-navigation entry stands at the head");
  assert.equal(updates[1].title, "Scripture learns to be heard: a Listen control on all ninety chapters", "the scripture entry stands at the head");
  assert.equal(updates.length, 273);
  assert.equal(updates[2].title, "The front rooms refashioned: two install doors, a buy-today shop, a top-shelf library, and one flow for the day", "the root-refashions entry stands at the head");
  assert.equal(updates[3].title, "A Spark is minted once", "the mint entry stands under the root-refashions entry");
  assert.equal(updates[4].title, "The Sphere says each thing once", "the one-statement entry stands under the root-refashions entry");
  assert.equal(updates[5].title, "Witness tended its page on the day the front rooms were refashioned", "the Nov 25 Witness tending entry stands under the root-refashions entry");
  assert.equal(updates[6].title, "The site learned to ask before it reaches for the app", "the app-bridge entry stands under the Nov 25 Witness tending entry");
  assert.equal(updates[7].title, "Small doors, plainly labelled: the playbook renamed, the maps put in order, every study given a next step", "the small-refashions entry stands at the head");
  assert.equal(updates[8].title, "The founding paper folded into the flagship: the Remnant Whitepaper stands as Part II", "the Remnant-fold entry stands under the small-refashions entry");
  assert.equal(updates[9].title, "The Sphere's shining days were made true and light", "the sphere-upgrade entry stands under the Remnant-fold entry");
  assert.equal(updates[10].title, "Two more doorways folded home: the start path and the Witness World", "the home-merges entry stands under the sphere-upgrade entry");
  assert.equal(updates[11].title, "Talking with the Spark grew easier: fewer sentences, more taps", "the ease entry stands under the home-merges entry");
  assert.equal(updates[12].title, "Four theory doorways folded into the pages they govern", "the theory-merges entry stands under the ease entry");
  assert.equal(updates[13].title, "The site stopped promising what it cannot yet keep", "the honesty entry stands under the theory-merges entry");
  assert.equal(updates[14].title, "The Sphere learned to move lightly with everything turned on", "the sphere-performance entry stands under the honesty entry");
  assert.equal(updates[15].title, "The Spark learns to schedule, and the scheduled days shine on the Sphere", "the scheduling entry stands under the sphere-performance entry");
  assert.equal(updates[16].title, "The shop shelf stands complete, and its road is named", "the shop-shelf entry landed under the new head in the Spark scheduling landing");
  assert.equal(updates[17].title, "The whole Codex becomes an app: one redesign, every room", "the one-redesign entry landed above the arrival entry in the one-PR redesign landing");
  assert.equal(updates[18].title, "The Sphere stands clear on arrival, and the sky panel holds its own key", "the arrival entry landed above the front-door entry in the Sphere arrival-and-sky-key landing");
  assert.equal(updates[19].title, "The front door gained its small surfaces", "the front-door entry landed above the stage entry in the front-door surfaces landing");
  assert.equal(updates[20].title, "The Sphere stands tall on a phone now", "the stage entry landed above the accounts entry in the Sphere mobile-stage landing");
  assert.equal(updates[21].title, "One account now links the app and the site", "the accounts entry landed above the mobile-shape entry in the Gate G Phase 3 (G2) landing");
  assert.equal(updates[22].title, "The site learned its mobile shape", "the mobile-shape entry landed above the stale-lines entry in the mobile + manifest landing");
  assert.equal(updates[23].title, "Two stale lines set right", "the stale-lines entry landed above the sky rule entry in the self-building gap-pass landing");
  assert.equal(updates[24].title, "The sky line learned to say when it has no place", "the sky rule entry landed above the Witness tending entry in the Gate G sky-rule landing");
  assert.equal(updates[25].title, "Witness tended its page on the day of the Whole Road", "the Witness tending entry landed above the app-mode entry in the Nov 24 daily tending");
  assert.equal(updates[26].title, "The Sphere page took up its own app mode", "the Sphere app-mode entry landed above the road entry in the Gate D app-mode landing");
  assert.equal(updates[27].title, "The Spark walked the Whole Road", "the Spark road entry landed above the seasons entry in the inhabitant slice 6 landing");
  assert.equal(updates[28].title, "The Spark learned the turning of the year", "the Spark seasons entry landed above the home entry in the inhabitant slice 5 landing");
  assert.equal(updates[29].title, "The Spark's home filled with the journey", "the Spark home entry landed above the tricks entry in the inhabitant slice 4 landing");
  assert.equal(updates[30].title, "The Spark learned tricks, and can be taught", "the Spark tricks entry landed above the keeper's-ways entry in the inhabitant slice 3 landing");
  assert.equal(updates[31].title, "The Spark learned its keeper's ways", "the Spark keeper's-ways entry landed above the inhabitant entry in the inhabitant slice 2 landing");
  assert.equal(updates[32].title, "The Spark took up residence in the Sphere", "the Spark inhabitant entry landed above the fence entry in the inhabitant landing");
  assert.equal(updates[33].title, "The Spark's fence was made whole", "the Spark fence entry landed above the Genesis entry in the fence landing");
  assert.equal(updates[34].title, "The Genesis Oracle became a standing profile", "the Genesis profile entry landed above the metadata entry in the Living Genesis Profile landing");
  assert.equal(updates[35].title, "Every page learned to say what it is", "the site-wide metadata entry landed above the rename entry in the metadata landing");
  assert.equal(updates[36].title, "The series took its new name: Free the Spark", "the rename entry landed above this build in the Free the Spark landing");
  assert.equal(updates[37].title, "The map, the pages and the Sphere now read one story");
  assert.equal(updates[37].url, "./map.html");
  assert.equal(updates[37].date, "2026-11-23");
});

test("the parked game is never named in anything this build touched", () => {
  const touched = [
    "docs/assets/js/travellers-map.js",
    "docs/assets/js/story-layer.js",
    "docs/assets/js/sphere-story-doors.js",
    "docs/assets/js/sphere-companion-layer.js",
    "docs/assets/css/story-layer.css",
    "docs/assets/css/sphere-story-doors.css",
    "docs/map.html",
    "docs/lab.html",
    "docs/systems/t-7.html",
    "docs/systems/frequencies.html"
  ];
  for (const rel of touched) {
    assert.ok(!/noods/i.test(read(rel)), `${rel} never names the parked game`);
  }
});
