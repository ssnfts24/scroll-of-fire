/* Scroll of Fire — Theory Interactive Codex
   Shared behavior for:
   - docs/theory.html
   - docs/theory/*.html
   - docs/theory/equations/eq00.html through eq17.html

   Requires the shared selectors used across the Theory / Canon pages:
   [data-nav-toggle], [data-site-nav], [data-mode], .equation-display,
   .equation-chapter, [data-focus-term], [data-term], and #canon.
*/

(function () {
  "use strict";

  const body = document.body;
  const root = document.documentElement;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) =>
    Array.from(scope.querySelectorAll(selector));
  const STORAGE_KEY = "sof.theory.settings.v2";
  const MOBILE_NAV_QUERY = "(max-width: 900px)";
  const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

  const settings = {
    mode: body?.dataset.readingMode || "explorer",
    carrier: "432"
  };

  /* ------------------------------------------------------------------
     Utilities
  ------------------------------------------------------------------ */

  function loadSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

      if (stored && typeof stored === "object") {
        Object.assign(settings, stored);
      }
    } catch (_) {
      // Keep defaults if storage is unavailable or malformed.
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (_) {
      // Storage may be unavailable in private or restricted contexts.
    }
  }

  function prefersReducedMotion() {
    return window.matchMedia?.(REDUCED_MOTION_QUERY).matches === true;
  }

  function setYear() {
    const year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());
  }
  function flash(button, text, duration = 900) {
    if (!(button instanceof HTMLElement)) return;

    const original = button.textContent;
    button.textContent = text;

    window.setTimeout(() => {
      button.textContent = original;
    }, duration);
  }

  async function copyText(value) {
    const text = String(value || "");
    if (!text) return false;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {
      // Use the fallback below.
    }

    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.top = "0";
    field.style.left = "-9999px";
    field.style.opacity = "0";

    document.body.appendChild(field);
    field.focus();
    field.select();
    field.setSelectionRange(0, field.value.length);

    let copied = false;

    try {
      copied = document.execCommand("copy");
    } catch (_) {
      copied = false;
    }

    field.remove();
    return copied;
  }

  function getFocusable(container) {
    if (!container) return [];

    return $$(
      [
        'a[href]:not([tabindex="-1"])',
        'button:not([disabled]):not([tabindex="-1"])',
        'input:not([disabled]):not([tabindex="-1"])',
        'select:not([disabled]):not([tabindex="-1"])',
        'textarea:not([disabled]):not([tabindex="-1"])',
        '[tabindex]:not([tabindex="-1"])'
      ].join(","),
      container
    ).filter(element => !element.hidden && element.offsetParent !== null);
  }

  /* ------------------------------------------------------------------
     Mobile navigation
  ------------------------------------------------------------------ */

  function mobileNav() {
    const button = $("[data-nav-toggle]");
    const nav = $("[data-site-nav]");

    if (!button || !nav) return;

    const media = window.matchMedia(MOBILE_NAV_QUERY);
    const OPEN_CLASS = "open";
    const BODY_CLASS = "nav-open";

    let returnFocus = null;

    function isOpen() {
      return nav.classList.contains(OPEN_CLASS);
    }

    function updateState(open) {
      nav.classList.toggle(OPEN_CLASS, open);
      button.classList.toggle("active", open);
      body.classList.toggle(BODY_CLASS, open && media.matches);

      button.setAttribute("aria-expanded", String(open));
      button.setAttribute(
        "aria-label",
        open ? "Close navigation" : "Open navigation"
      );

      nav.setAttribute("aria-hidden", String(media.matches && !open));

      root.style.overflow = open && media.matches ? "hidden" : "";
    }

    function openNav() {
      if (!media.matches || isOpen()) return;

      returnFocus = document.activeElement;
      updateState(true);

      const firstItem = getFocusable(nav)[0];

      if (firstItem) {
        requestAnimationFrame(() => {
          firstItem.focus({ preventScroll: true });
        });
      }
    }

    function closeNav({ restoreFocus = false } = {}) {
      const wasOpen = isOpen();
      updateState(false);

      if (wasOpen && restoreFocus) {
        const target =
          returnFocus instanceof HTMLElement ? returnFocus : button;

        requestAnimationFrame(() => {
          target.focus({ preventScroll: true });
        });
      }

      returnFocus = null;
    }

    function toggleNav() {
      if (isOpen()) {
        closeNav({ restoreFocus: true });
      } else {
        openNav();
      }
    }

    function trapFocus(event) {
      if (
        event.key !== "Tab" ||
        !media.matches ||
        !isOpen()
      ) {
        return;
      }

      const focusable = getFocusable(nav);

      if (!focusable.length) {
        event.preventDefault();
        button.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    button.addEventListener("click", toggleNav);

    nav.addEventListener("click", event => {
      if (event.target.closest("a") && media.matches) {
        closeNav();
      }
    });

    document.addEventListener("click", event => {
      if (!media.matches || !isOpen()) return;
      if (button.contains(event.target) || nav.contains(event.target)) return;

      closeNav();
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && isOpen()) {
        event.preventDefault();
        closeNav({ restoreFocus: true });
        return;
      }

      trapFocus(event);
    });

    function handleViewportChange() {
      if (!media.matches) {
        closeNav();
        nav.removeAttribute("aria-hidden");
      } else {
        updateState(false);
      }
    }

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleViewportChange);
    } else if (typeof media.addListener === "function") {
      media.addListener(handleViewportChange);
    }
    if (media.matches) {
      updateState(false);
    } else {
      nav.removeAttribute("aria-hidden");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "Open navigation");
    }
  }

  /* ------------------------------------------------------------------
     Reading modes
  ------------------------------------------------------------------ */

  function readingModes() {
    const buttons = $$("[data-mode]");
    if (!buttons.length) return;

    function apply(mode) {
      const nextMode = mode || "explorer";

      settings.mode = nextMode;
      body.dataset.readingMode = nextMode;

      buttons.forEach(button => {
        const active = button.dataset.mode === nextMode;

        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });

      saveSettings();
    }

    buttons.forEach(button => {
      button.addEventListener("click", () => {
        apply(button.dataset.mode);
      });
    });

    apply(settings.mode);
  }
  /* ------------------------------------------------------------------
     Equation tools
  ------------------------------------------------------------------ */

  function equationTools() {
    $$(".equation-display").forEach((equation, index) => {
      if (equation.dataset.ready === "true") return;

      equation.dataset.ready = "true";

      if (!equation.id) {
        equation.id = `equation-${index + 1}`;
      }

      const tools = document.createElement("div");
      tools.className = "equation-tools";
      tools.setAttribute("aria-label", "Equation tools");
      tools.innerHTML = `
        <button type="button" class="chip" data-copy>Copy</button>
        <button
          type="button"
          class="chip"
          data-collapse
          aria-expanded="true"
          aria-controls="${equation.id}"
        >Collapse</button>
        <button type="button" class="chip" data-link>Link</button>
      `;

      equation.after(tools);

      const copyButton = $("[data-copy]", tools);
      const collapseButton = $("[data-collapse]", tools);
      const linkButton = $("[data-link]", tools);

      copyButton?.addEventListener("click", async event => {
        const copied = await copyText(equation.innerText.trim());
        flash(event.currentTarget, copied ? "Copied" : "Copy failed");
      });

      collapseButton?.addEventListener("click", event => {
        const collapsed = equation.classList.toggle("collapsed");

        event.currentTarget.textContent =
          collapsed ? "Expand" : "Collapse";

        event.currentTarget.setAttribute(
          "aria-expanded",
          String(!collapsed)
        );
      });

      linkButton?.addEventListener("click", async event => {
        const url = new URL(window.location.href);
        url.hash = equation.id;

        const copied = await copyText(url.toString());

        history.replaceState(null, "", `#${equation.id}`);
        flash(event.currentTarget, copied ? "Copied" : "Linked");
      });
    });
  }

  /* ------------------------------------------------------------------
     Canon chapter focus
  ------------------------------------------------------------------ */

  function canonChapters() {
    $$(".equation-chapter").forEach(card => {
      if (card.dataset.chapterReady === "true") return;

      card.dataset.chapterReady = "true";

      const equation = $(".equation-display", card);
      if (!equation) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip chapter-toggle";
      button.textContent = "Focus";
      button.setAttribute("aria-pressed", "false");

      card.appendChild(button);

      button.addEventListener("click", () => {
        const focused = card.classList.toggle("chapter-focused");

        button.textContent = focused ? "Unfocus" : "Focus";
        button.setAttribute("aria-pressed", String(focused));

        if (focused) {
          card.scrollIntoView({
            block: "start",
            behavior: prefersReducedMotion() ? "auto" : "smooth"
          });
        }
      });
    });
  }

  /* ------------------------------------------------------------------
     Master Equation term focus
  ------------------------------------------------------------------ */
  function masterEquationFocus() {
    const buttons = $$("[data-focus-term]");
    const cards = $$("[data-term]");

    if (!buttons.length || !cards.length) return;

    function clearFocus() {
      buttons.forEach(button => {
        button.classList.remove("active");
        button.setAttribute("aria-pressed", "false");
      });

      cards.forEach(card => {
        card.classList.remove("term-active", "term-dim");
      });
    }

    buttons.forEach(button => {
      button.setAttribute("aria-pressed", "false");

      button.addEventListener("click", () => {
        const term = button.dataset.focusTerm;
        const wasActive = button.classList.contains("active");

        clearFocus();

        if (wasActive) return;

        button.classList.add("active");
        button.setAttribute("aria-pressed", "true");

        cards.forEach(card => {
          const match = card.dataset.term === term;

          card.classList.toggle("term-active", match);
          card.classList.toggle("term-dim", !match);
        });
      });
    });
  }

  /* ------------------------------------------------------------------
     Canon search
  ------------------------------------------------------------------ */

  function searchCanon() {
    const canon = $("#canon");

    if (
      !canon ||
      canon.dataset.searchReady === "true"
    ) {
      return;
    }

    const chapters = $$(".equation-chapter", canon);
    if (!chapters.length) return;

    canon.dataset.searchReady = "true";

    const search = document.createElement("div");
    search.className = "canon-search";
    search.innerHTML = `
      <label for="canon-search-input">Search Canon 0–17</label>
      <input
        id="canon-search-input"
        type="search"
        inputmode="search"
        autocomplete="off"
        placeholder="Search equation, witness, memory, ethics, carrier..."
      >
      <p
        class="canon-search-status"
        role="status"
        aria-live="polite"
      ></p>
    `;

    canon.querySelector(".section-heading")?.after(search);

    const input = $("#canon-search-input", search);
    const status = $(".canon-search-status", search);

    function filterCanon() {
      const query = input.value.trim().toLowerCase();
      let visible = 0;

      chapters.forEach(chapter => {
        const match =
          !query ||
          chapter.innerText.toLowerCase().includes(query);

        chapter.hidden = !match;

        if (match) visible += 1;
      });

      if (status) {
        status.textContent = query
          ? `${visible} Canon entr${visible === 1 ? "y" : "ies"} shown.`
          : "";
      }
    }

    input.addEventListener("input", filterCanon);
    input.addEventListener("search", filterCanon);
  }

  /* ------------------------------------------------------------------
     Command palette
  ------------------------------------------------------------------ */

  function commandPalette() {
    if ($(".command-palette")) return;

    const palette = document.createElement("div");
    palette.className = "command-palette";
    palette.hidden = true;
    palette.setAttribute("role", "dialog");
    palette.setAttribute("aria-modal", "true");
    palette.setAttribute("aria-label", "Search the Codex");
    palette.innerHTML = `
      <div class="command-panel">
        <input
          type="search"
          autocomplete="off"
          placeholder="Search Codex..."
          aria-label="Command search"
        >
        <div class="command-results"></div>
      </div>
    `;

    document.body.appendChild(palette);

    const input = $("input", palette);
    const results = $(".command-results", palette);

    let returnFocus = null;

    const commands = [
      ["Home", "./"],
      ["Start", "start.html"],
      ["Theory Hub", "theory.html"],
      ["Canon 0–17", "theory/canon.html#canon"],
      ["Master Equation", "theory/master-equation.html"],
      ["Unified Field", "theory/unified-field.html"],
      ["Delta Framework", "theory/delta-framework.html"],
      ["Living Operators", "theory/operators.html"],
      ["Witness Theory", "theory/witness.html"],
      ["Memory Theory", "theory/memory.html"],
      ["Ethics", "theory/ethics.html"],
      ["13 Moons Theory", "theory/thirteen-moons.html"],
      ["Frequency Governance", "theory/frequency-governance.html"],
      ["Living Technology", "theory/living-technology.html"],
      ["Artifact Theory", "theory/artifact-theory.html"],
      ["Glossary", "theory/glossary.html"],
      ["Notation", "theory/notation.html"],
      ["Bibliography", "theory/bibliography.html"],
      ["Equation 0 — Foundational Field", "theory/equations/eq00.html"],
      ["Equation 1 — Source and Operators", "theory/equations/eq01.html"],
      ["Equation 2 — Witness", "theory/equations/eq02.html"],
      ["Equation 3 — Harmonic Gate", "theory/equations/eq03.html"],
      ["Equation 4 — Language", "theory/equations/eq04.html"],
      ["Equation 4b — Semantic Gradient", "theory/equations/eq04b.html"],
      ["Equation 5 — Remnant", "theory/equations/eq05.html"],
      ["Equation 6 — Type-7 Field", "theory/equations/eq06.html"],
      ["Equation 7 — Copeland Comparator", "theory/equations/eq07.html"],
      ["Equation 8 — Goodwin Comparator", "theory/equations/eq08.html"],
      ["Equation 9 — Ethical Law", "theory/equations/eq09.html"],
      ["Equation 10 — Inverse Resonance Ladder", "theory/equations/eq10.html"],
      ["Equation 11 — Projection Frame", "theory/equations/eq11.html"],
      ["Equation 12 — Causal Lattice", "theory/equations/eq12.html"],
      ["Equation 13 — Coherence", "theory/equations/eq13.html"],
      ["Equation 14 — Update Rule", "theory/equations/eq14.html"],
      ["Equation 15 — Learning Kernel", "theory/equations/eq15.html"],
      ["Equation 16 — Memory Window", "theory/equations/eq16.html"],
      ["Equation 17 — Voice Carriers", "theory/equations/eq17.html"],
      ["13 Moons", "moons.html"],
      ["Frequency Console", "systems/frequencies.html"],
      ["Artifact Registry", "shop.html"],
      ["Ledger", "ledger.html"],
      ["Caravan", "caravan.html"]
    ];

    function render(query = "") {
      const normalized = query.trim().toLowerCase();

      const filtered = commands.filter(([label]) =>
        label.toLowerCase().includes(normalized)
      );

      if (!filtered.length) {
        results.innerHTML =
          '<p class="command-empty">No matching Codex entry.</p>';
        return;
      }

      results.innerHTML = filtered
        .slice(0, 12)
        .map(([label, href]) => `<a href="${href}">${label}</a>`)
        .join("");
    }

    function openPalette() {
      returnFocus = document.activeElement;

      palette.hidden = false;
      body.classList.add("command-open");
      root.style.overflow = "hidden";

      input.value = "";
      render();

      requestAnimationFrame(() => input.focus());
    }

    function closePalette({ restoreFocus = true } = {}) {
      if (palette.hidden) return;

      palette.hidden = true;
      body.classList.remove("command-open");

      if (!body.classList.contains("nav-open")) {
        root.style.overflow = "";
      }

      if (
        restoreFocus &&
        returnFocus instanceof HTMLElement
      ) {
        requestAnimationFrame(() => {
          returnFocus.focus({ preventScroll: true });
        });
      }

      returnFocus = null;
    }

    function trapPaletteFocus(event) {
      if (event.key !== "Tab" || palette.hidden) return;

      const focusable = getFocusable(palette);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", event => {
      const activeTag = document.activeElement?.tagName || "";
      const isTyping =
        ["INPUT", "TEXTAREA", "SELECT"].includes(activeTag) ||
        document.activeElement?.isContentEditable === true;

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();

        if (palette.hidden) {
          openPalette();
        } else {
          closePalette();
        }

        return;
      }

      if (event.key === "Escape" && !palette.hidden) {
        event.preventDefault();
        closePalette();
        return;
      }

      if (
        event.key === "/" &&
        !isTyping &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        openPalette();
        return;
      }

      trapPaletteFocus(event);
    });

    input.addEventListener("input", () => render(input.value));

    palette.addEventListener("click", event => {
      if (event.target === palette) {
        closePalette();
      }
    });

    results.addEventListener("click", event => {
      if (event.target.closest("a")) {
        closePalette({ restoreFocus: false });
      }
    });
  }
  /* ------------------------------------------------------------------
     Reveal on scroll
  ------------------------------------------------------------------ */

  function revealOnScroll() {
    const items = $$(
      ".section-shell, .card, .canon-card, .moon-card, .graph-card"
    );

    if (!items.length) return;

    if (
      prefersReducedMotion() ||
      !("IntersectionObserver" in window)
    ) {
      items.forEach(element => element.classList.add("active"));
      return;
    }

    items.forEach(element => element.classList.add("reveal"));
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;

          entry.target.classList.add("active");
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -8% 0px",
        threshold: 0.08
      }
    );

    items.forEach(element => observer.observe(element));
  }

  /* ------------------------------------------------------------------
     Smooth same-page anchors
  ------------------------------------------------------------------ */

  function smoothAnchors() {
    document.addEventListener("click", event => {
      const anchor = event.target.closest("a[href^='#']");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href === "#") return;

      let target;

      try {
        target = document.querySelector(href);
      } catch (_) {
        return;
      }

      if (!target) return;

      event.preventDefault();
      const offset = $(".site-header")?.offsetHeight || 72;
      const top =
        target.getBoundingClientRect().top +
        window.scrollY -
        offset -
        12;

      window.scrollTo({
        top: Math.max(0, top),
        behavior: prefersReducedMotion() ? "auto" : "smooth"
      });

      history.replaceState(null, "", href);

      const hadTabindex = target.hasAttribute("tabindex");

      if (!hadTabindex) {
        target.setAttribute("tabindex", "-1");
      }

      requestAnimationFrame(() => {
        target.focus({ preventScroll: true });

        if (!hadTabindex) {
          target.addEventListener(
            "blur",
            () => target.removeAttribute("tabindex"),
            { once: true }
          );
        }
      });
    });
  }

  /* ------------------------------------------------------------------
     Back to top
  ------------------------------------------------------------------ */

  function backToTop() {
    if ($(".to-top")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "to-top btn";
    button.textContent = "↑";
    button.setAttribute("aria-label", "Back to top");

    document.body.appendChild(button);

    button.addEventListener("click", () => {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion() ? "auto" : "smooth"
      });
    });

    function updateVisibility() {
      button.classList.toggle("show", window.scrollY > 900);
    }

    window.addEventListener("scroll", updateVisibility, {
      passive: true
    });

    updateVisibility();
  }

  /* ------------------------------------------------------------------
     Boot
  ------------------------------------------------------------------ */

  function boot() {
    loadSettings();
    setYear();
    mobileNav();
    readingModes();
    equationTools();
    canonChapters();
    masterEquationFocus();
    searchCanon();
    commandPalette();
    revealOnScroll();
    smoothAnchors();
    backToTop();

    console.info("Scroll of Fire — Theory active");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, {
      once: true
    });
  } else {
    boot();
  }
})();
