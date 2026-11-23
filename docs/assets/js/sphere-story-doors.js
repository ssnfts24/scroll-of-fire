/**
 * The Story on the Sphere — day→story doors on the companion
 * layer (Unified Story Expansion step d, Nov 23, 2026; audit C7
 * fixes the method).
 *
 * When a day of one of the thirteen Moons is on show, this panel
 * offers the episodes of that Moon: each by its distinguisher
 * marks (name · land · token — never a number), with a door into
 * the Episode Library at its anchor and a door to its own page.
 * The matching is at Moon granularity, because that is what the
 * record supports: the spine marks each chapter with its Moon,
 * and no chapter is placed on a single day the record does not
 * name. Moons whose movements are not yet written (Deep Mirror,
 * Completion Seal) are told plainly as standing empty for now.
 *
 * The method is the companion layer's own: this module is set on
 * the page by sphere-companion-layer.js's loader, reads only the
 * page's public state strip — the same readout the guide bar
 * mirrors and the share composes from — and the one story spine
 * (assets/data/codex-story.json). It writes nothing, keeps no
 * calendar of its own, and touches no cursor, no bus and no
 * protected file: selection still flows through
 * SOFTemporalCursor → PatternCalendar → Canonical Living State →
 * LivingProjectionBus, exactly as before. The panel also carries
 * the planned episodes whose home is this page — the Day World's
 * own Inside the Day episodes, and The Ladder of Scales of The
 * Living Circuit — as planned only: no player, nothing to play
 * yet.
 *
 * The pure half (the readout parse and the spine shaping) carries
 * no DOM dependency and is unit-tested at the data level.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }

  root.SphereStoryDoors = api;
  api.mount(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* The state strip's own grammar — the same forms the companion
   * layer's share parses ("Moon 8 · Day 25 · Day 221/364"). */
  function parseReadout(text) {
    const t = String(text || "");
    const full = t.match(/Moon (\d{1,2}) · Day (\d{1,2}) · Day (\d{1,3})\/364/);
    if (full) return { moon: Number(full[1]), day: Number(full[2]), patternDay: Number(full[3]) };
    const part = t.match(/Moon (\d{1,2}) · Day (\d{1,2})/);
    if (part) return { moon: Number(part[1]), day: Number(part[2]), patternDay: null };
    return null;
  }

  /* A chapter is filmed when it carries its episode — or when it
   * is the opening chapter, whose film is the spine's
   * openingFilm. The Library and the Map apply the same rule. */
  function isFilmed(story, chapter) {
    return !!chapter.episode ||
      !!(story && story.openingFilm && story.openingFilm.chapterId === chapter.id);
  }

  /* The episodes standing in a Moon: every chapter the spine
   * marks with that Moon's Set A name, shaped for the panel —
   * marks and doors only, never a film path: this surface offers
   * doors, it does not play. */
  function offersForMoon(story, moonName) {
    if (!story || !moonName) return [];
    return (story.chapters || [])
      .filter(c => c.mark && c.mark.moonName === moonName)
      .map(c => ({
        id: c.id,
        title: c.title,
        land: c.mark.land,
        token: c.mark.token,
        page: c.page,
        filmed: isFilmed(story, c),
        libraryHref: `episodes.html#ep-${c.id}`
      }));
  }

  /* The planned episodes whose home is the Sphere page itself,
   * from the spine's planned register — carried here because the
   * page is protected and this layer is its sanctioned surface. */
  function plannedForSphere(story) {
    if (!story) return [];
    const seriesName = id =>
      ((story.series || []).find(s => s.id === id) || {}).name || "";
    return (story.planned || [])
      .filter(p => p.page === "living-time-sphere.html")
      .map(p => ({
        id: p.id,
        title: p.title,
        seriesName: seriesName(p.series),
        land: p.land,
        status: p.status,
        libraryHref: `episodes.html#planned-${p.id}`
      }));
  }

  function mount(root) {
    const document = root.document;
    if (!document) return;
    const wrap = document.querySelector(".sphere-canvas-wrap");
    const strip = document.getElementById("sphere-state-strip");
    if (!wrap || !strip) return;

    const panel = document.createElement("section");
    panel.className = "sphere-story-doors";
    panel.setAttribute("aria-label", "The story of the Moon on show");
    const heading = document.createElement("h2");
    heading.className = "ssd-title";
    heading.textContent = "The story on this Moon";
    panel.appendChild(heading);
    const body = document.createElement("div");
    body.className = "ssd-body";
    panel.appendChild(body);
    /* Below the stage column, in the page's own flow — the stage
     * and its guide bar keep their exact places. */
    wrap.after(panel);

    let story = null;
    let lastText = null;

    function moonNames() {
      const names = root.PatternCalendarData && root.PatternCalendarData.moonNames;
      return Array.isArray(names) && names.length === 13 ? names : null;
    }

    function line(text, className) {
      const p = document.createElement("p");
      p.className = className || "ssd-line";
      p.textContent = text;
      return p;
    }

    function render() {
      const text = (strip.textContent || "").trim().replace(/\s+/g, " ");
      if (text === lastText && story) return;
      lastText = text;
      body.replaceChildren();
      if (!story) {
        body.appendChild(line("The story is gathering…"));
        return;
      }
      const coord = parseReadout(text);
      const names = moonNames();
      const moonName = coord && names ? names[coord.moon - 1] : null;
      if (moonName) {
        body.appendChild(line(
          `Moon ${coord.moon} · ${moonName} is on show. The episodes of this Moon:`,
          "ssd-moon"
        ));
        const offers = offersForMoon(story, moonName);
        if (offers.length) {
          const list = document.createElement("ul");
          list.className = "ssd-list";
          for (const offer of offers) {
            const item = document.createElement("li");
            const name = document.createElement("strong");
            name.textContent = offer.title;
            item.append(name, document.createTextNode(
              ` — ${offer.land} · ${offer.token}. `
            ));
            const watch = document.createElement("a");
            watch.href = offer.libraryHref;
            watch.textContent = "Watch in the Episode Library";
            item.append(watch, document.createTextNode(" · "));
            const page = document.createElement("a");
            page.href = offer.page;
            page.textContent = "Its own page";
            item.appendChild(page);
            list.appendChild(item);
          }
          body.appendChild(list);
        } else {
          body.appendChild(line(
            "No episode of the road stands in this Moon yet — its movement is still being written."
          ));
        }
      } else {
        body.appendChild(line(
          "The day on show stands outside the thirteen Moons, or the Sphere is still aligning. When a Moon's days are on show, its episodes stand here."
        ));
      }
      for (const planned of plannedForSphere(story)) {
        const p = document.createElement("p");
        p.className = "ssd-planned";
        p.append(document.createTextNode(
          `Planned for this place: ${planned.title}` +
          (planned.seriesName ? ` — ${planned.seriesName}` : "") +
          `. ${planned.status === "scripted" ? "Scripted in full" : "Planned"} — not yet filmed; nothing to play yet. `
        ));
        const shelf = document.createElement("a");
        shelf.href = planned.libraryHref;
        shelf.textContent = "The Library's planned shelf";
        p.appendChild(shelf);
        body.appendChild(p);
      }
    }

    new root.MutationObserver(render).observe(strip, {
      childList: true, subtree: true, characterData: true
    });

    try {
      root.fetch("assets/data/codex-story.json")
        .then(response => (response && response.ok ? response.json() : null))
        .then(data => { story = data; lastText = null; render(); })
        .catch(() => { /* the panel rests quiet without the spine */ });
    } catch { /* the panel rests quiet without the spine */ }
    render();
  }

  return { parseReadout, isFilmed, offersForMoon, plannedForSphere, mount };
});
