/*
 * Paths from Here — the Garden of Paths panel (recommendation
 * Q-04, approved by Aaron Nov 22, 2026; program §D1).
 *
 * A quiet panel that stands at the foot of a page and answers two
 * questions from the record: where does this page's own writing
 * lead ("Paths from here"), and which pages point back to it
 * ("Who points here"). The trails are counted at build time from
 * the pages as they stand (scripts/build-link-graph.mjs) and ship
 * as one static file — a path is shown only because a page's own
 * content links to it. The standing doors every page carries (the
 * travel bar, the footer) are not trails and are never listed.
 *
 * The panel only adds. If the graph cannot be read, or this page
 * has no trails, the slot stays hidden and the page is exactly as
 * it was — no dead end is created and nothing is taken away.
 */
(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.CodexPathsFromHere = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* --------------------------- pure core ---------------------------- */

  /* The graph's key for a page, from its URL path: directories
   * resolve to their index, the way the site itself serves them. */
  function pageKeyFromPath(pathname) {
    let p = String(pathname || "").replace(/^\//, "");
    if (!p) return "index.html";
    if (p.endsWith("/")) p += "index.html";
    return p;
  }

  /* A link from one page of the graph to another, written the way
   * the standing page must speak it. */
  function relHref(fromPage, toPath) {
    const fromDir = fromPage.includes("/")
      ? fromPage.slice(0, fromPage.lastIndexOf("/") + 1)
      : "";
    if (toPath.startsWith(fromDir)) return toPath.slice(fromDir.length);
    const depth = fromDir ? fromDir.split("/").filter(Boolean).length : 0;
    return "../".repeat(depth) + toPath;
  }

  const AREA_NAMES = {
    "scroll-scripture": "Scroll & Scripture",
    evidence: "Evidence",
    systems: "Systems",
    "living-time": "Living Time",
    artifacts: "Artifacts",
    archive: "Archive",
    codex: "The Codex"
  };

  function areaName(area) {
    return AREA_NAMES[area] || "The Codex";
  }

  /* Outgoing trails grouped by the country they lead to, groups in
   * the order the page first points there. */
  function groupByArea(links) {
    const groups = [];
    const byArea = new Map();
    for (const link of links || []) {
      const name = areaName(link.area);
      if (!byArea.has(name)) {
        byArea.set(name, []);
        groups.push({ name, links: byArea.get(name) });
      }
      byArea.get(name).push(link);
    }
    return groups;
  }

  /* ------------------------- browser wiring ------------------------- */

  function renderSlot(slot, graph) {
    const pageKey = slot.getAttribute("data-paths-page") || pageKeyFromPath(window.location.pathname);
    const entry = graph?.pages?.[pageKey];

    if (!entry || (!entry.out?.length && !entry.in?.length)) {
      slot.hidden = true;
      return;
    }

    slot.innerHTML = "";
    slot.hidden = false;

    const heading = document.createElement("h2");
    heading.className = "paths__heading";
    heading.textContent = "Paths from here";
    slot.append(heading);

    const note = document.createElement("p");
    note.className = "paths__note";
    note.textContent =
      "Trails counted from the pages' own words — where this page leads, and what leads back to it.";
    slot.append(note);

    const makeList = (links, fromPage) => {
      const list = document.createElement("ul");
      list.className = "paths__list";
      for (const link of links) {
        const item = document.createElement("li");
        const a = document.createElement("a");
        a.href = relHref(fromPage, link.path);
        a.textContent = link.title;
        item.append(a);
        list.append(item);
      }
      return list;
    };

    if (entry.out?.length) {
      const outBlock = document.createElement("div");
      outBlock.className = "paths__block";
      const groups = groupByArea(entry.out);
      for (const group of groups) {
        if (groups.length > 1) {
          const g = document.createElement("h3");
          g.className = "paths__group";
          g.textContent = group.name;
          outBlock.append(g);
        }
        outBlock.append(makeList(group.links, pageKey));
      }
      if (entry.outTotal > entry.out.length) {
        const more = document.createElement("p");
        more.className = "paths__more";
        more.textContent = `…and ${entry.outTotal - entry.out.length} more paths in the page itself.`;
        outBlock.append(more);
      }
      slot.append(outBlock);
    }

    if (entry.in?.length) {
      const inBlock = document.createElement("div");
      inBlock.className = "paths__block";
      const h = document.createElement("h3");
      h.className = "paths__group";
      h.textContent = "Who points here";
      inBlock.append(h);
      inBlock.append(makeList(entry.in, pageKey));
      if (entry.inTotal > entry.in.length) {
        const more = document.createElement("p");
        more.className = "paths__more";
        more.textContent = `…and ${entry.inTotal - entry.in.length} more pages point here.`;
        inBlock.append(more);
      }
      slot.append(inBlock);
    }
  }

  async function init() {
    const slots = document.querySelectorAll("[data-paths-from-here]");
    if (!slots.length) return;

    const cache = new Map();
    for (const slot of slots) {
      const src = slot.getAttribute("data-paths-src") || "assets/data/link-graph.json";
      try {
        if (!cache.has(src)) {
          cache.set(src, fetch(src).then((r) => (r.ok ? r.json() : null)));
        }
        const graph = await cache.get(src);
        if (graph) renderSlot(slot, graph);
      } catch {
        /* the panel is an addition, never a duty — the page stands as it was */
      }
    }
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => void init());
    } else {
      void init();
    }
  }

  return { pageKeyFromPath, relHref, areaName, groupByArea };
});
