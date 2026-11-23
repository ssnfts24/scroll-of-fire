/**
 * The Story Layer — one continuous story, told a piece at a time
 * across the whole site (Aaron, Nov 20, 2026).
 *
 * The spine lives in ONE place: docs/assets/data/codex-story.json
 * — the living text. Each fitted page carries an empty slot that
 * names its chapter (`<div data-story-slot data-story-chapter=
 * "the-gate-at-first-light">`); this module reads the spine,
 * renders the chapter that belongs to the page into its slot,
 * and stamps the find into the keeper's trail (LivingTrail), so
 * the Traveller's Map can show which chapters a keeper has found.
 *
 * Fitting is per page, by hand, to the page's own subject — there
 * is no template piece and no filler: a page with no slot simply
 * has no chapter yet, and the spine names it as pending.
 *
 * Fences, standing: the story is plainly a story — every chapter
 * renders under a label saying so. It makes no claims, cites no
 * evidence, and never speaks as Aaron. On Scripture and Evidence
 * surfaces a chapter travels as plain words only: a chapter whose
 * data carries a scene is never rendered with it there (the
 * fitted slot declares `data-story-plain` on such pages, and the
 * scene is dropped).
 *
 * Episodes: a chapter the spine marks with an `episode` carries
 * its animated telling — a short film in the story's cartoon
 * language, narrated from the chapter's own words. The film
 * renders inside the chapter's slot, above the written chapter,
 * which stands beneath it as the episode's guide card — folded
 * shut by default in a native details element, at Aaron's word
 * (Nov 23, 2026), and opened by its summary row; the words stay
 * complete in the page, only the presentation folds. The film
 * is poster-first and lazy (preload="none", the house film
 * pattern): nothing heavy loads until the keeper presses play.
 * On plain surfaces the episode is dropped with the scene, by
 * the same fence.
 *
 * Planned episodes: a page can also carry a planned slot
 * (`data-story-planned`), rendered from the spine's planned
 * register as words only — the episode named, its series and
 * land, and the plain state that it is not yet filmed. The same
 * register feeds the Episode Library's planned shelf and the
 * Traveller's Map, so a planned episode is described one way
 * everywhere it stands.
 */
(function () {
  "use strict";

  const STORY_URL = "assets/data/codex-story.json";

  function pageBase() {
    /* The story data lives at the site root's assets/data; pages
     * at depth carry a <base> or a known prefix — resolve against
     * the document's own base the way the house modules do. */
    const base = document.querySelector("base");
    return base ? base.href : document.baseURI;
  }

  function storyUrl() {
    try {
      return new URL(STORY_URL, pageBase()).href;
    } catch {
      return STORY_URL;
    }
  }

  function chapterById(story, id) {
    return (story?.chapters || []).find(c => c.id === id) || null;
  }

  function assetUrl(path) {
    /* Spine asset paths (scenes, episode films and posters) are
     * site-root relative; resolve them the way the story data
     * itself is resolved. */
    try {
      return new URL(path, pageBase()).href;
    } catch {
      return path;
    }
  }

  /* Spark Activities (slice 1 — watching): the activities module
   * is lazy-loaded the first time an episode renders on a page,
   * the house pattern for heavy stacks (Their Home loads the
   * garden the same way). It observes the rendered player itself;
   * loading it here, once, keeps every fitted page's standing
   * weight budget intact and touches no page's markup. */
  let activitiesRequested = false;
  let loadedStory = null;
  /* The spine is the watch machinery's single source (audit
   * F5/C13): the layer already loads the spine, so when the
   * activities module arrives it is handed the story it should
   * read its episode marks from. If the handover ever fails, the
   * module's own fallback table stands — the story and the
   * earning both survive it. */
  function handStoryToActivities() {
    const acts = typeof SparkActivities !== "undefined" ? SparkActivities : null;
    if (acts && loadedStory && typeof acts.useStoryData === "function") {
      try { acts.useStoryData(loadedStory); } catch { /* the fallback table stands */ }
    }
  }
  function ensureActivities() {
    if (activitiesRequested) return;
    activitiesRequested = true;
    const script = document.createElement("script");
    script.src = assetUrl("assets/js/spark-activities.js");
    script.onload = () => handStoryToActivities();
    script.onerror = () => { /* the story stands without the earning */ };
    document.head.appendChild(script);
  }

  function renderChapter(slot, story, chapter) {
    const plain = slot.hasAttribute("data-story-plain");
    slot.classList.add("story-chapter");
    slot.replaceChildren();

    const eyebrow = document.createElement("p");
    eyebrow.className = "story-eyebrow";
    eyebrow.textContent = `${story.title} · Chapter ${chapter.n}`;
    slot.appendChild(eyebrow);

    const title = document.createElement("h2");
    title.className = "story-title";
    title.textContent = chapter.title;
    slot.appendChild(title);

    if (chapter.scene && !plain) {
      /* Framed with the page's cartoon scene where one exists:
       * the fitted pages already carry the scene as their own
       * figure, so the story does not duplicate it — the frame
       * note points at it instead. */
      const frame = document.createElement("p");
      frame.className = "story-frame-note";
      frame.textContent = "Told beside this page's cartoon scene, above.";
      slot.appendChild(frame);
    }

    if (chapter.episode && !plain) {
      /* The chapter's animated telling, where one has been
       * filmed: poster-first and lazy — nothing heavy loads
       * until the keeper presses play. The written chapter
       * below is its guide card. */
      const figure = document.createElement("figure");
      figure.className = "story-episode";
      const video = document.createElement("video");
      video.controls = true;
      video.preload = "none";
      video.playsInline = true;
      video.width = 1280;
      video.height = 720;
      video.poster = assetUrl(chapter.episode.poster);
      video.src = assetUrl(chapter.episode.film);
      video.setAttribute(
        "aria-label",
        `Video: ${story.title}, Chapter ${chapter.n} — ${chapter.title}, the animated episode`
      );
      const caption = document.createElement("figcaption");
      caption.textContent =
        chapter.episode.label ||
        `Episode ${chapter.n} — the animated telling of this chapter. The written chapter below is its guide card.`;
      figure.append(video, caption);
      slot.appendChild(figure);
      ensureActivities();
    }

    /* The written chapter stands folded under its film (Aaron,
     * Nov 23, 2026: "These details should at very least be closed
     * and expandable to open"). Where a chapter carries its
     * episode, the beat and the full text render inside a native
     * details element — closed by default, opened by the summary
     * row, working with no JavaScript at all. The words themselves
     * are complete and unchanged in the page: only the
     * presentation folds, so the Library's reading-companion
     * promise and the search index keep the whole chapter. On
     * plain surfaces, and for the one chapter whose film lives on
     * the home page rather than in its slot, the text stands open
     * as it always has — the fold belongs to the guide card under
     * a film. */
    const foldText = !!(chapter.episode && !plain);
    const textHost = foldText ? document.createElement("details") : slot;
    if (foldText) {
      textHost.className = "story-chapter-text";
      const summary = document.createElement("summary");
      summary.className = "story-chapter-summary";
      summary.textContent = `Read the written chapter — ${chapter.title}`;
      textHost.appendChild(summary);
      slot.appendChild(textHost);
    }

    if (chapter.beat) {
      const beat = document.createElement("p");
      beat.className = "story-beat";
      beat.textContent = chapter.beat;
      textHost.appendChild(beat);
    }

    for (const para of chapter.text || []) {
      const p = document.createElement("p");
      p.className = "story-text";
      p.textContent = para;
      textHost.appendChild(p);
    }

    const foot = document.createElement("p");
    foot.className = "story-foot";
    const trail = typeof LivingTrail !== "undefined" ? LivingTrail : null;
    const found = trail ? trail.findFor(trail.load(), chapter.id) : null;
    foot.append(
      document.createTextNode(
        "A story, told alongside the record — not part of it." +
          (found && found.patternDay
            ? ` First found here: Moon ${found.moon} · Day ${found.moonDay} · Pattern Day ${found.patternDay}. It is kept in your trail, on this device. `
            : " It is kept in your trail, on this device. ")
      )
    );
    try {
      const mapLink = document.createElement("a");
      mapLink.href = new URL("../../map.html", storyUrl()).href;
      mapLink.textContent = "The Traveller's Map shows the whole road →";
      foot.appendChild(mapLink);
    } catch { /* the label stands without the link */ }
    slot.appendChild(foot);
  }

  /* Planned episodes: a page the story is travelling toward can
   * carry a slot naming a planned episode (`<div data-story-planned=
   * "lc-sixteen-locks">`), rendered from the spine's planned
   * register — the same register the Episode Library's planned
   * shelf reads, so the two can never disagree. A planned card is
   * words only: no film, no player, nothing to play yet, and no
   * find is stamped into the trail — the keeper has met a promise,
   * not a chapter. */
  function plannedById(story, id) {
    return (story?.planned || []).find(p => p.id === id) || null;
  }

  function seriesById(story, id) {
    return (story?.series || []).find(s => s.id === id) || null;
  }

  function renderPlanned(slot, story, entry) {
    slot.classList.add("story-planned");
    slot.replaceChildren();

    const series = seriesById(story, entry.series);
    const eyebrow = document.createElement("p");
    eyebrow.className = "story-eyebrow";
    eyebrow.textContent = `${series ? series.name : story.title} · planned for this page`;
    slot.appendChild(eyebrow);

    const title = document.createElement("h2");
    title.className = "story-title";
    title.textContent = entry.title;
    slot.appendChild(title);

    const state = document.createElement("p");
    state.className = "story-planned-state";
    state.textContent = entry.status === "scripted"
      ? "Scripted in full — not yet filmed. There is nothing to play yet."
      : "Planned — not yet filmed. There is nothing to play yet.";
    slot.appendChild(state);

    if (entry.land) {
      const meta = document.createElement("p");
      meta.className = "story-planned-meta";
      meta.textContent = `${entry.land} · the episode this page will carry when its season comes.`;
      slot.appendChild(meta);
    }

    if (entry.note) {
      const note = document.createElement("p");
      note.className = "story-planned-note";
      note.textContent = entry.note;
      slot.appendChild(note);
    }

    if (entry.source) {
      const source = document.createElement("p");
      source.className = "story-planned-source";
      source.textContent = `From the author's own work: ${entry.source}.`;
      slot.appendChild(source);
    }

    const foot = document.createElement("p");
    foot.className = "story-foot";
    foot.append(
      document.createTextNode("A story, told alongside the record — not part of it. ")
    );
    try {
      const libLink = document.createElement("a");
      libLink.href = new URL(`../../episodes.html#planned-${entry.id}`, storyUrl()).href;
      libLink.textContent = "It stands on the Episode Library's planned shelf →";
      foot.appendChild(libLink);
    } catch { /* the label stands without the link */ }
    slot.appendChild(foot);
  }

  let storyPromise = null;
  function loadStory() {
    if (!storyPromise) {
      storyPromise = (async () => {
        try {
          const response = await fetch(storyUrl());
          if (response.ok) return await response.json();
        } catch { /* the story is a courtesy; the page stands without it */ }
        return null;
      })();
    }
    return storyPromise;
  }

  const done = new WeakSet();
  async function fillSlot(slot) {
    if (done.has(slot)) return;
    const chapterId = slot.getAttribute("data-story-chapter");
    if (!chapterId) return;
    done.add(slot);
    const story = await loadStory();
    if (!story) return;
    loadedStory = story;
    const chapter = chapterById(story, chapterId);
    if (!chapter) return;

    /* Stamp the find BEFORE rendering, so the chapter's own
     * footer can say when it was first found. */
    const trail = typeof LivingTrail !== "undefined" ? LivingTrail : null;
    if (trail) {
      try {
        trail.recordFind(chapter.id);
        /* The trail changed: anything drawing from it (the Year
         * Thread) re-reads and re-renders. */
        document.dispatchEvent(new CustomEvent("sof:trail-changed"));
      } catch { /* the trail is the keeper's; silence is honest */ }
    }
    renderChapter(slot, story, chapter);
    handStoryToActivities();
  }

  const plannedDone = new WeakSet();
  async function fillPlannedSlot(slot) {
    if (plannedDone.has(slot)) return;
    const plannedId = slot.getAttribute("data-story-planned");
    if (!plannedId) return;
    plannedDone.add(slot);
    const story = await loadStory();
    if (!story) return;
    const entry = plannedById(story, plannedId);
    if (!entry) return;
    renderPlanned(slot, story, entry);
  }

  function init() {
    document.querySelectorAll("[data-story-slot]").forEach(slot => { void fillSlot(slot); });
    document.querySelectorAll("[data-story-planned]").forEach(slot => { void fillPlannedSlot(slot); });
    /* Some fitted rooms are built late (the Sphere's Day World
     * sheet): a slot that arrives after load is filled when it
     * lands. */
    new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.("[data-story-slot]")) void fillSlot(node);
          node.querySelectorAll?.("[data-story-slot]").forEach(slot => { void fillSlot(slot); });
          if (node.matches?.("[data-story-planned]")) void fillPlannedSlot(node);
          node.querySelectorAll?.("[data-story-planned]").forEach(slot => { void fillPlannedSlot(slot); });
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
