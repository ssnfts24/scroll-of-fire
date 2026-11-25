/**
 * Downloads archive loader (Page Evolution Batch E4,
 * Nov 25, 2026).
 *
 * The full integrity archive — every file, every SHA-256 seal —
 * was 161 KB of the downloads page's 175 KB, shipped to every
 * visitor for a door most never open. It now lives as its own
 * fragment (assets/data/downloads-archive.html), and this
 * loader fetches it the first time the archive door opens and
 * sets it into the door's mount. A failed fetch leaves the
 * door's plain link standing; without JavaScript the link is
 * the road. The seals themselves are unchanged — only their
 * ride to the page moved behind the door they describe.
 */
(function () {
  "use strict";

  function init() {
    const door = document.querySelector("details.archive-door");
    if (!door) return;
    const mount = door.querySelector("[data-archive-mount]");
    if (!mount) return;
    let state = "idle";

    function load(after) {
      if (state === "done") {
        if (after) after();
        return;
      }
      if (state !== "idle") return;
      state = "pending";
      fetch("assets/data/downloads-archive.html")
        .then((res) => (res.ok ? res.text() : Promise.reject(new Error("archive"))))
        .then((html) => {
          const doc = new DOMParser().parseFromString(html, "text/html");
          mount.replaceChildren(...doc.body.childNodes);
          const fallback = door.querySelector(".archive-fallback");
          if (fallback) fallback.remove();
          state = "done";
          if (after) after();
        })
        .catch(() => {
          state = "idle"; // the plain link inside the door stays the road
        });
    }

    door.addEventListener("toggle", () => {
      if (door.open) load();
    });

    /* Deep links struck before the archive moved behind its
     * door (downloads.html#3_Living_Technology and its kin)
     * still land where they meant: the door opens, the archive
     * loads, and the named folder opens and scrolls into view. */
    const hash = decodeURIComponent(location.hash.slice(1));
    if (/^(root-|[1-7]_)/.test(hash)) {
      door.open = true;
      load(() => {
        const target = document.getElementById(hash);
        if (target) {
          target.open = true;
          target.scrollIntoView();
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
