"use strict";

/*
 * Living Search — launcher.
 *
 * Included with a single <script> line on content pages. It adds a
 * Search button to the shared navigation (or a floating button where a
 * page has no nav), binds Ctrl+K / Cmd+K and "/" to open search, and
 * loads the real interface (styles, engine, memory, UI) only on first
 * use — pages pay nothing for search until a reader asks for it.
 */
(function () {
  if (window.__livingSearchLauncher) return;
  window.__livingSearchLauncher = true;

  const scriptUrl = [...document.scripts].find(script => /living-search-launcher\.js(?:\?|$)/.test(script.src))?.src || "";
  const jsRoot = scriptUrl ? new URL("./", scriptUrl).href : "assets/js/";
  const cssUrl = scriptUrl ? new URL("../css/living-search.css", scriptUrl).href : "assets/css/living-search.css";
  let loading = null;

  function loadUi() {
    if (window.LivingSearchUI) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-living-search-css]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = cssUrl;
        link.dataset.livingSearchCss = "";
        document.head.appendChild(link);
      }
      const files = ["living-search-core.js", "living-search-memory.js", "living-search.js"];
      let chain = Promise.resolve();
      for (const file of files) {
        chain = chain.then(() => new Promise((res, rej) => {
          const script = document.createElement("script");
          script.src = jsRoot + file;
          script.onload = res;
          script.onerror = rej;
          document.head.appendChild(script);
        }));
      }
      chain.then(resolve, reject);
    });
    return loading;
  }

  async function openSearch() {
    try {
      await loadUi();
      window.LivingSearchUI.open();
    } catch {
      /* If the interface cannot load, the dedicated search page is one tap away. */
      location.href = new URL("../../search.html", scriptUrl || location.href).href;
    }
  }

  function addButton() {
    const nav = document.querySelector("[data-site-nav]");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "living-search-open";
    button.innerHTML = 'Search <kbd aria-hidden="true">Ctrl K</kbd>';
    button.setAttribute("aria-label", "Search the whole site (Control K)");
    button.addEventListener("click", openSearch);
    if (nav) {
      button.classList.add("living-search-open--nav");
      nav.appendChild(button);
    } else {
      button.classList.add("living-search-open--floating");
      document.body.appendChild(button);
    }
  }

  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase("en") === "k") {
      event.preventDefault();
      openSearch();
      return;
    }
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const target = event.target;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      if (!typing) {
        event.preventDefault();
        openSearch();
      }
    }
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addButton);
  else addButton();
})();
