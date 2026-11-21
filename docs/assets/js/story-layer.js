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
 * which stands beneath it as the episode's guide card. The film
 * is poster-first and lazy (preload="none", the house film
 * pattern): nothing heavy loads until the keeper presses play.
 * On plain surfaces the episode is dropped with the scene, by
 * the same fence.
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
    }

    if (chapter.beat) {
      const beat = document.createElement("p");
      beat.className = "story-beat";
      beat.textContent = chapter.beat;
      slot.appendChild(beat);
    }

    for (const para of chapter.text || []) {
      const p = document.createElement("p");
      p.className = "story-text";
      p.textContent = para;
      slot.appendChild(p);
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
  }

  function init() {
    document.querySelectorAll("[data-story-slot]").forEach(slot => { void fillSlot(slot); });
    /* Some fitted rooms are built late (the Sphere's Day World
     * sheet): a slot that arrives after load is filled when it
     * lands. */
    new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches?.("[data-story-slot]")) void fillSlot(node);
          node.querySelectorAll?.("[data-story-slot]").forEach(slot => { void fillSlot(slot); });
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
