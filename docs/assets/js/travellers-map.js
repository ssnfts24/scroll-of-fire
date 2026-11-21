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
 */
(function () {
  "use strict";

  async function init() {
    const regionsHost = document.getElementById("map-regions");
    const roadHost = document.getElementById("map-road");
    const pendingHost = document.getElementById("map-pending");
    if (!regionsHost && !roadHost && !pendingHost) return;

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
        if (chapter.episode) {
          const filmed = document.createElement("p");
          filmed.className = "map-episode";
          filmed.textContent = "Episode filmed — the animated telling stands on its page.";
          body.appendChild(filmed);
        }
        card.appendChild(body);
        regionsHost.appendChild(card);
      }
    }

    if (roadHost) {
      roadHost.replaceChildren();
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
        if (chapter.episode) {
          item.appendChild(document.createTextNode(" Episode filmed."));
        }
        roadHost.appendChild(item);
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { void init(); });
  } else {
    void init();
  }
})();
