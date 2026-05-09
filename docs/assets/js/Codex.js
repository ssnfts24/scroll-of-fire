(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);

  const navToggle = $("[data-nav-toggle]");
  const nav = $("[data-site-nav]");

  if (navToggle && nav) {
    navToggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    });

    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        nav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.setAttribute("aria-label", "Open navigation");
      }
    });
  }

  document.documentElement.classList.add("js-ready");
})();
