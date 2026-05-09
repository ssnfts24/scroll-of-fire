/* Scroll of Fire — Shared front-end helpers */
(function () {
  "use strict";

  document.documentElement.classList.add("js-ready");

  document.addEventListener("DOMContentLoaded", function () {
    markActiveNav();
    enableCopyButtons();
  });

  function markActiveNav() {
    const current = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll("a[href]").forEach(function (a) {
      const href = a.getAttribute("href");
      if (!href) return;

      const clean = href.split("#")[0].split("?")[0];
      if (clean === current) {
        a.setAttribute("aria-current", "page");
      }
    });
  }

  function enableCopyButtons() {
    document.querySelectorAll("[data-copy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const target = document.querySelector(btn.getAttribute("data-copy"));
        if (!target) return;
        navigator.clipboard?.writeText(target.textContent.trim());
      });
    });
  }
})();
