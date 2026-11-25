/**
 * The Traveller's Map — the explorable cartoon map of the whole
 * site (Aaron's three ideas, Nov 20, 2026), and the story layer's
 * home surface.
 *
 * The map is drawn from the story spine (codex-story.json): every
 * chapter with a cartoon scene stands as a land, pictured by its
 * scene; every chapter stands in the road list with its beat; and
 * the pages whose chapters are not yet written are named as the
 * road that goes on — never padded with a generic piece. The
 * keeper's own progress is read from their trail (LivingTrail):
 * a found chapter carries the Pattern stamp of the day it was
 * found; the rest wait, unfound, in the order of the road.
 *
 * One spine, three readers (Unified Story Expansion step c,
 * Nov 23, 2026): the map now carries the whole road the way the
 * Episode Library does — every episode told apart by its
 * distinguisher marks (land · Moon · token, never a number on
 * the map's own face), a door from each filmed episode into the
 * Library at its anchor, its kin on the road named from the
 * spine's relations, and the spine's planned register standing
 * as its own shelf, grouped by series: planned episodes on the
 * pages they will belong to, with no player and nothing to play
 * yet. No episode data is hand-carried here; the helpers below
 * shape the spine and are unit-tested at the data level.
 */
(function () {
  "use strict";

  const RELATION_WORDS = {
    "same-land": "the same land",
    "thread": "a thread of the story runs between them",
    "crosses": "their roads cross"
  };

  const STATUS_WORDS = {
    planned: "Planned",
    scripted: "Scripted in full"
  };

  /* A chapter is filmed when it carries its episode — or when it
   * is the opening chapter, whose film is the spine's openingFilm
   * (the seventeenth film, F1: represented, never a spine
   * episode). The Library applies the same rule. */
  function isFilmed(story, chapter) {
    return !!chapter.episode ||
      !!(story && story.openingFilm && story.openingFilm.chapterId === chapter.id);
  }

  function marksLine(chapter) {
    const mark = chapter.mark || {};
    return [mark.land, mark.moonName, mark.token].filter(Boolean).join(" · ");
  }

  function libraryHref(chapter) {
    return `episodes.html#ep-${chapter.id}`;
  }

  function plannedHref(entry) {
    return `episodes.html#planned-${entry.id}`;
  }

  /* The planned register, grouped by series in the register's own
   * order — the same grouping the Library's planned shelf draws. */
  function plannedGroups(story) {
    const groups = new Map();
    for (const entry of (story && story.planned) || []) {
      if (!groups.has(entry.series)) groups.set(entry.series, []);
      groups.get(entry.series).push(entry);
    }
    return ((story && story.series) || [])
      .filter(s => groups.has(s.id))
      .map(s => ({ series: s, entries: groups.get(s.id) }));
  }

  const api = { isFilmed, marksLine, libraryHref, plannedHref, plannedGroups };
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.TravellersMap = api;
  }

  async function init() {
    const regionsHost = document.getElementById("map-regions");
    const roadHost = document.getElementById("map-road");
    const pendingHost = document.getElementById("map-pending");
    const plannedHost = document.getElementById("map-planned");
    if (!regionsHost && !roadHost && !pendingHost && !plannedHost) return;

    let story = null;
    try {
      const response = await fetch("assets/data/codex-story.json");
      if (response.ok) story = await response.json();
    } catch { /* the map is a courtesy; the page says so below */ }
    if (!story) {
      if (roadHost) roadHost.innerHTML = "<p>The map could not be read just now. The road itself is unchanged.</p>";
      return;
    }

    const trail = typeof LivingTrail !== "undefined" ? LivingTrail.load() : { finds: {} };
    const foundOf = id =>
      typeof LivingTrail !== "undefined" ? LivingTrail.findFor(trail, id) : null;

    if (regionsHost) {
      regionsHost.replaceChildren();
      for (const chapter of story.chapters) {
        if (!chapter.scene) continue;
        const card = document.createElement("article");
        card.className = "map-region";
        const img = document.createElement("img");
        img.src = chapter.scene;
        img.width = 1200;
        img.height = 675;
        img.loading = "lazy";
        img.decoding = "async";
        img.alt = `Cartoon scene: the land of ${chapter.place}, from the Traveller's Road.`;
        card.appendChild(img);
        const body = document.createElement("div");
        body.className = "map-region-body";
        const h = document.createElement("h3");
        const link = document.createElement("a");
        link.href = chapter.page;
        link.textContent = chapter.place;
        h.appendChild(link);
        body.appendChild(h);
        const beat = document.createElement("p");
        beat.textContent = `Chapter ${chapter.n} — ${chapter.title}. ${chapter.beat}`;
        body.appendChild(beat);
        const found = foundOf(chapter.id);
        const state = document.createElement("p");
        if (found && found.patternDay) {
          state.className = "map-found";
          state.textContent = `Found — Moon ${found.moon} · Day ${found.moonDay} · Pattern Day ${found.patternDay}.`;
        } else {
          state.className = "map-unfound";
          state.textContent = "Not yet found. The chapter waits on its own page.";
        }
        body.appendChild(state);
        const marks = marksLine(chapter);
        if (marks) {
          const marksEl = document.createElement("p");
          marksEl.className = "map-marks";
          marksEl.textContent = marks;
          body.appendChild(marksEl);
        }
        if (isFilmed(story, chapter)) {
          const filmed = document.createElement("p");
          filmed.className = "map-episode";
          /* Batch E6 (Nov 25, 2026): the land names its episode —
           * by name, Moon and token, the canon's own telling-apart
           * (never by number alone). */
          const mark = chapter.mark || {};
          const told = [chapter.title, mark.moonName, mark.token].filter(Boolean).join(" · ");
          filmed.append(document.createTextNode(`Its episode: ${told} — `));
          const watch = document.createElement("a");
          watch.href = libraryHref(chapter);
          watch.textContent = "watch it in the Episode Library";
          filmed.append(watch, document.createTextNode(", or on its own page."));
          body.appendChild(filmed);
        }
        card.appendChild(body);
        regionsHost.appendChild(card);
      }
    }

    if (roadHost) {
      roadHost.replaceChildren();
      const chapterById = id => story.chapters.find(c => c.id === id) || null;
      for (const chapter of story.chapters) {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = chapter.page;
        link.textContent = `Chapter ${chapter.n} — ${chapter.title}`;
        item.append(link, document.createTextNode(` (${chapter.place}): ${chapter.beat} `));
        const found = foundOf(chapter.id);
        const state = document.createElement("span");
        state.className = found ? "map-found" : "map-unfound";
        state.textContent = found
          ? `Found · Pattern Day ${found.patternDay}.`
          : "Not yet found.";
        item.appendChild(state);
        const marks = marksLine(chapter);
        if (marks) {
          const marksEl = document.createElement("span");
          marksEl.className = "map-marks";
          marksEl.textContent = ` ${marks}.`;
          item.appendChild(marksEl);
        }
        if (isFilmed(story, chapter)) {
          item.appendChild(document.createTextNode(" Episode filmed — "));
          const watch = document.createElement("a");
          watch.href = libraryHref(chapter);
          watch.textContent = "in the Episode Library";
          item.appendChild(watch);
          item.appendChild(document.createTextNode("."));
        }
        const relations = (chapter.relations || []).filter(r => chapterById(r.id));
        if (relations.length) {
          const rel = document.createElement("span");
          rel.className = "map-relations";
          rel.append(document.createTextNode(" Kin on the road: "));
          relations.forEach((r, i) => {
            if (i) rel.append(document.createTextNode(", "));
            const a = document.createElement("a");
            a.href = libraryHref(chapterById(r.id));
            a.textContent = chapterById(r.id).title;
            rel.append(a, document.createTextNode(` (${RELATION_WORDS[r.kind] || r.kind})`));
          });
          rel.append(document.createTextNode("."));
          item.appendChild(rel);
        }
        roadHost.appendChild(item);
      }
    }

    if (plannedHost) {
      plannedHost.replaceChildren();
      for (const { series, entries } of plannedGroups(story)) {
        const group = document.createElement("div");
        group.className = "map-planned-group";
        const h = document.createElement("h3");
        h.textContent = series.name;
        group.appendChild(h);
        for (const entry of entries) {
          const card = document.createElement("article");
          card.className = "map-planned-card";
          card.id = `map-planned-${entry.id}`;
          const title = document.createElement("h4");
          title.textContent = entry.title;
          card.appendChild(title);
          const meta = document.createElement("p");
          meta.className = "map-planned-meta";
          meta.append(document.createTextNode(
            `${STATUS_WORDS[entry.status] || entry.status} · ${entry.land} · not yet filmed — nothing to play yet. `
          ));
          const pageLink = document.createElement("a");
          pageLink.href = entry.page;
          pageLink.textContent = "The page it will belong to";
          meta.append(pageLink, document.createTextNode(" · "));
          const shelfLink = document.createElement("a");
          shelfLink.href = plannedHref(entry);
          shelfLink.textContent = "On the Library's planned shelf";
          meta.appendChild(shelfLink);
          card.appendChild(meta);
          if (entry.note) {
            const note = document.createElement("p");
            note.className = "map-planned-note";
            note.textContent = entry.note;
            card.appendChild(note);
          }
          group.appendChild(card);
        }
        plannedHost.appendChild(group);
      }
    }

    if (pendingHost) {
      pendingHost.replaceChildren();
      for (const entry of story.pending || []) {
        const item = document.createElement("li");
        item.textContent = entry.page;
        pendingHost.appendChild(item);
      }
      const count = document.getElementById("map-pending-count");
      if (count) {
        count.textContent = `${(story.pending || []).length} pages wait for their chapters. Each will be written for its own page and fitted to it — no generic pieces, no filler. The fitting continues as the standing program until the whole site is done.`;
      }
    }
  }

  if (typeof document !== "undefined" && document.getElementById) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => { void init(); });
    } else {
      void init();
    }
  }
})();
