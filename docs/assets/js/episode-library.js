/**
 * The Episode Library (docs/episodes.html).
 *
 * One room for the whole story's films. Everything on the page
 * is rendered from the single story spine,
 * docs/assets/data/codex-story.json — the same data the story
 * layer, the Traveller's Map and the watch machinery read. This
 * module keeps no episode table of its own.
 *
 * The doors:
 *   WATCH    — the films in walking order, playable in place.
 *              Each stands inside the exact figure contract the
 *              watch machinery observes (a figure.story-episode
 *              inside a [data-story-slot] named by chapter id),
 *              so a watch here is a watch anywhere: it rides
 *              spark-activities.js untouched, ≥90% truly played
 *              plus the player's own ended event, and a page
 *              open never counts.
 *   EXPLORE  — the same films gathered by land, and the story's
 *              series named with their doors.
 *   CONTINUE — the keeper's place, read back from the one Life
 *              Atlas record through the same resolver and the
 *              same fold the watch machinery uses. Local only.
 *
 * The headline feature (the vision trailer) is static page
 * furniture, placed by Aaron's ruling of November 23, 2026 —
 * it is not story data, not an episode, and it is never wired
 * to the watch machinery: no token, no place in the order.
 *
 * Planned and scripted episodes render from the spine's
 * `planned` register, on their own shelf, with no player —
 * there is nothing to play yet, and the page says so.
 */
(function () {
  "use strict";

  const STATUS_WORDS = {
    filmed: "Filmed",
    outlined: "Outlined in the bible",
    planned: "Planned",
    scripted: "Scripted in full",
    deferred: "Deferred by name",
    named: "Named only"
  };
  const RELATION_WORDS = {
    "same-land": "the same land",
    "thread": "a thread of the story runs between them",
    "crosses": "their roads cross"
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function assetUrl(path) {
    try {
      return new URL(path, document.baseURI).href;
    } catch {
      return path;
    }
  }

  function marksLine(chapter) {
    const m = chapter.mark || {};
    return `of ${m.land}, under ${m.moonName}, ${m.token}`;
  }

  function episodeFigure(film, poster, label, ariaLabel) {
    const figure = el("figure", "story-episode");
    const video = document.createElement("video");
    video.controls = true;
    video.preload = "none";
    video.playsInline = true;
    video.width = 1280;
    video.height = 720;
    video.poster = assetUrl(poster);
    video.src = assetUrl(film);
    video.setAttribute("aria-label", ariaLabel);
    const caption = el("figcaption", null, label);
    figure.append(video, caption);
    return figure;
  }

  function chapterById(story, id) {
    return (story.chapters || []).find(c => c.id === id) || null;
  }

  function renderCard(story, chapter, filmSource, nextChapter) {
    const card = el("article", "episode-card");
    card.setAttribute("data-story-slot", "");
    card.setAttribute("data-story-chapter", chapter.id);
    card.id = `ep-${chapter.id}`;

    card.appendChild(el("h3", "episode-card-title", chapter.title));
    card.appendChild(el("p", "episode-marks", marksLine(chapter)));
    card.appendChild(episodeFigure(
      filmSource.film,
      filmSource.poster,
      filmSource.label,
      `Video: ${chapter.title}, an episode of ${story.title}`
    ));
    if (filmSource.note) card.appendChild(el("p", "episode-note", filmSource.note));
    if (chapter.synopsis) card.appendChild(el("p", "episode-synopsis", chapter.synopsis));

    if (chapter.hum) {
      const hum = el("p", "episode-hum",
        `Its hum: ${chapter.hum.rootHz} Hz, ${chapter.hum.scale}.`);
      if (chapter.hum.note) hum.append(` ${chapter.hum.note}`);
      card.appendChild(hum);
    }
    if (chapter.skill) {
      card.appendChild(el("p", "episode-skill",
        `It teaches the Waymaker skill ${chapter.skill.name}. ` +
        `Watching it through marks that skill met, and brings its token home.`));
    }
    const relations = (chapter.relations || []).filter(r => chapterById(story, r.id));
    if (relations.length) {
      const rel = el("p", "episode-relations", "Kin on the road: ");
      relations.forEach((r, i) => {
        if (i) rel.append(", ");
        const a = el("a", null, chapterById(story, r.id).title);
        a.href = `#ep-${r.id}`;
        rel.append(a, ` (${RELATION_WORDS[r.kind] || r.kind})`);
      });
      rel.append(".");
      card.appendChild(rel);
    }
    const links = el("p", "episode-links");
    const pageLink = el("a", null, "Its own page — the written chapter in full, and the room it belongs to");
    pageLink.href = assetUrl(chapter.page);
    links.appendChild(pageLink);
    card.appendChild(links);

    const next = el("p", "episode-next");
    if (nextChapter) {
      next.append("Next on the road: ");
      const a = el("a", null, nextChapter.title);
      a.href = `#ep-${nextChapter.id}`;
      next.appendChild(a);
      next.append(" — when this film ends, the walk goes on there.");
    } else {
      next.textContent = "The road rests here, for now — the shelf of what is coming stands below.";
    }
    card.appendChild(next);
    return card;
  }

  function renderWatch(story) {
    const shelf = document.getElementById("episode-shelf");
    shelf.replaceChildren();
    const chapters = story.chapters || [];
    const playable = chapters.filter(c => c.episode || (story.openingFilm && c.id === story.openingFilm.chapterId));
    playable.forEach((chapter, i) => {
      const next = playable[i + 1] || null;
      if (chapter.episode) {
        shelf.appendChild(renderCard(story, chapter, {
          film: chapter.episode.film,
          poster: chapter.episode.poster,
          label: chapter.episode.label
        }, next));
      } else {
        shelf.appendChild(renderCard(story, chapter, {
          film: story.openingFilm.film,
          poster: story.openingFilm.poster,
          label: "The opening film of the road — it lives on the home page, the story's front gate, and plays here as the library's first entry.",
          note: "This film opens the story at the front gate; it is counted with the road's films, and a true watch of it counts the same as any other."
        }, next));
      }
    });
  }

  function renderExplore(story) {
    const landsHost = document.getElementById("explore-lands");
    landsHost.replaceChildren();
    const byLand = new Map();
    for (const ch of story.chapters || []) {
      const land = (ch.mark || {}).land || ch.place;
      if (!byLand.has(land)) byLand.set(land, []);
      byLand.get(land).push(ch);
    }
    for (const [land, chapters] of byLand) {
      const block = el("div", "explore-land");
      block.appendChild(el("h4", null, land.replace(/^the /, "The ")));
      const list = el("ul", "explore-episodes");
      for (const ch of chapters) {
        const li = el("li");
        const a = el("a", null, ch.title);
        a.href = `#ep-${ch.id}`;
        li.append(a, ` — under ${ch.mark.moonName}, ${ch.mark.token}. `);
        const page = el("a", null, "Its page");
        page.href = assetUrl(ch.page);
        li.append("(", page, ")");
        list.appendChild(li);
      }
      block.appendChild(list);
      landsHost.appendChild(block);
    }

    const seriesHost = document.getElementById("explore-series");
    seriesHost.replaceChildren();
    for (const s of story.series || []) {
      const block = el("div", "explore-series-entry");
      block.appendChild(el("h4", null, s.name));
      block.appendChild(el("p", "series-status", STATUS_WORDS[s.status] || s.status));
      if (s.note) block.appendChild(el("p", "series-note", s.note));
      const p = el("p", "series-door");
      if (s.id === "the-travellers-road") {
        const a = el("a", null, "Watch the series — the shelf above");
        a.href = "#watch";
        p.appendChild(a);
      } else if (s.page) {
        const a = el("a", null, "Its door — the page it belongs to");
        a.href = assetUrl(s.page);
        p.appendChild(a);
      }
      if (p.childNodes.length) block.appendChild(p);
      seriesHost.appendChild(block);
    }
  }

  function renderPlanned(story) {
    const host = document.getElementById("planned-shelf");
    host.replaceChildren();
    const seriesById = new Map((story.series || []).map(s => [s.id, s]));
    const groups = new Map();
    for (const entry of story.planned || []) {
      if (!groups.has(entry.series)) groups.set(entry.series, []);
      groups.get(entry.series).push(entry);
    }
    for (const s of story.series || []) {
      const entries = groups.get(s.id);
      if (!entries) continue;
      const group = el("div", "planned-group");
      group.appendChild(el("h3", null, s.name));
      if (s.note) group.appendChild(el("p", "series-note", s.note));
      for (const entry of entries) {
        const card = el("article", "planned-card");
        card.id = `planned-${entry.id}`;
        card.appendChild(el("h4", null, entry.title));
        const meta = el("p", "planned-meta",
          `${STATUS_WORDS[entry.status] || entry.status} · ${entry.land} · not yet filmed — nothing to play yet. `);
        const a = el("a", null, "The page it will belong to");
        a.href = assetUrl(entry.page);
        meta.appendChild(a);
        card.appendChild(meta);
        if (entry.note) card.appendChild(el("p", "planned-note", entry.note));
        if (entry.source) card.appendChild(el("p", "planned-source", `From the author's own work: ${entry.source}.`));
        group.appendChild(card);
      }
      host.appendChild(group);
    }
  }

  /* --------------------- the watch machinery --------------------- */

  let activitiesRequested = false;
  function ensureActivities(story) {
    if (activitiesRequested) return;
    activitiesRequested = true;
    const script = document.createElement("script");
    script.src = assetUrl("assets/js/spark-activities.js");
    script.onload = () => {
      const acts = typeof SparkActivities !== "undefined" ? SparkActivities : null;
      if (acts && typeof acts.useStoryData === "function") {
        try { acts.useStoryData(story); } catch { /* the fallback table stands */ }
      }
      void fillContinue(story);
    };
    script.onerror = () => { void fillContinue(story); };
    document.head.appendChild(script);
  }

  async function resolveRepository() {
    const Helpers = typeof CodexRecordHelpers !== "undefined" ? CodexRecordHelpers : null;
    if (Helpers && Helpers.createRepositoryResolver) {
      try {
        const repository = await Helpers.createRepositoryResolver()();
        if (repository) return repository;
      } catch { /* fall through to the runtime */ }
    }
    const Runtime = typeof CodexLifeAtlasRuntime !== "undefined" ? CodexLifeAtlasRuntime : null;
    if (Runtime && Runtime.ready) {
      try { return await Runtime.ready; } catch { return null; }
    }
    return null;
  }

  async function fillContinue(story) {
    const line = document.getElementById("continue-line");
    const action = document.getElementById("continue-action");
    const doorLine = document.getElementById("continue-door-line");
    const fallback = () => {
      line.textContent = "Your place is kept by the watch record on this device; it could not be read just now. The road itself stands open below.";
    };
    const acts = typeof SparkActivities !== "undefined" ? SparkActivities : null;
    if (!acts || typeof acts.foldWatches !== "function") { fallback(); return; }
    let records = null;
    try {
      const repository = await resolveRepository();
      if (repository) records = await repository.query({});
    } catch { /* the fallback line stands */ }
    if (!records) { fallback(); return; }

    const fold = acts.foldWatches(records);
    const watched = new Set(fold.tokens.map(t => t.episodeId));
    const chapters = story.chapters || [];
    const next = chapters.find(c => !watched.has(c.id));
    action.replaceChildren();
    if (!fold.tokens.length) {
      line.textContent = "Nothing has been watched through yet on this device. The road opens at the Gate, in first light.";
      const a = el("a", null, "Begin at The Gate at First Light");
      a.href = `#ep-${chapters[0].id}`;
      action.appendChild(a);
      if (doorLine) doorLine.textContent = "The road opens at the Gate — nothing watched yet on this device.";
      return;
    }
    if (next) {
      line.textContent =
        `${fold.tokens.length} ${fold.tokens.length === 1 ? "token is" : "tokens are"} home on this device. ` +
        `The road waits at ${next.title}.`;
      const a = el("a", null, `Continue at ${next.title}`);
      a.href = `#ep-${next.id}`;
      action.appendChild(a);
      if (doorLine) doorLine.textContent = `The road waits at ${next.title}.`;
    } else {
      line.textContent = "Every film on the road has been watched through on this device. The tokens stand in Their Home's story corner, and the Spark carries their hums.";
      if (doorLine) doorLine.textContent = "The whole road stands watched on this device.";
    }
  }

  /* ------------------------------ init ------------------------------ */

  async function init() {
    let story = null;
    try {
      const response = await fetch(assetUrl("assets/data/codex-story.json"));
      if (response.ok) story = await response.json();
    } catch { /* the fallback lines below stand */ }
    if (!story) {
      for (const id of ["episode-shelf", "explore-lands", "explore-series", "planned-shelf"]) {
        const host = document.getElementById(id);
        if (host) host.replaceChildren(el("p", null,
          "The library could not read the story just now. The films still play on their own pages, and the Traveller's Map shows the whole road."));
      }
      const line = document.getElementById("continue-line");
      if (line) line.textContent = "Your place is kept by the watch record on this device; the story could not be read just now.";
      return;
    }
    renderWatch(story);
    renderExplore(story);
    renderPlanned(story);
    ensureActivities(story);
    if (location.hash && location.hash.length > 1) {
      const target = document.getElementById(location.hash.slice(1));
      if (target) target.scrollIntoView();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { void init(); });
  } else {
    void init();
  }
})();
