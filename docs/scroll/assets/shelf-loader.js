/**
 * Shelf loader (Page Evolution Batch E4, Nov 25, 2026).
 *
 * The library index used to ship every shelf's full reader list
 * inside the page — 1,989 links, most of its 303 KB — for
 * shelves most visitors never open. The lists now live as
 * fragments beside the library's data, one per shelf, and this
 * loader fetches a shelf's list the first time the shelf opens
 * and sets it into the shelf's mount. A shelf that was fetched
 * once is never fetched again; a failed fetch leaves the
 * shelf's own plain link standing, so the list is one tap away
 * either way. Without JavaScript nothing here runs and the
 * plain link is the road — the weight is shed, the way is not.
 */
(function () {
  "use strict";

  function loadShelf(details) {
    if (details.dataset.shelfLoaded) return;
    const src = details.getAttribute("data-shelf-src");
    const mount = details.querySelector("[data-shelf-mount]");
    if (!src || !mount) return;
    details.dataset.shelfLoaded = "pending";
    fetch(src)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error("shelf"))))
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const list = doc.querySelector("[data-shelf-list]");
        if (!list) throw new Error("shelf");
        mount.replaceWith(list);
        const fallback = details.querySelector(".shelf-fallback");
        if (fallback) fallback.remove();
        details.dataset.shelfLoaded = "done";
      })
      .catch(() => {
        /* The plain link inside the shelf stays the road. */
        delete details.dataset.shelfLoaded;
      });
  }

  function init() {
    for (const details of document.querySelectorAll("details.index-shelf[data-shelf-src]")) {
      details.addEventListener("toggle", () => {
        if (details.open) loadShelf(details);
      });
      if (details.open) loadShelf(details);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
