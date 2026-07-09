/* Scroll of Fire — Theory Interactive Codex */

(function () {
  "use strict";

  const body = document.body;
  const root = document.documentElement;

  const $ = (s, scope = document) => scope.querySelector(s);
  const $$ = (s, scope = document) => Array.from(scope.querySelectorAll(s));

  const STORE = "sof.theory.settings.v2";

  const settings = {
    mode: "explorer",
    carrier: "432"
  };

  function loadSettings() {
    try {
      Object.assign(settings, JSON.parse(localStorage.getItem(STORE) || "{}"));
    } catch (_) {}
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORE, JSON.stringify(settings));
    } catch (_) {}
  }

  function copyText(text) {
    return navigator.clipboard?.writeText(text).catch(() => false);
  }

  function setYear() {
    const year = $("#year");
    if (year) year.textContent = new Date().getFullYear();
  }

  function mobileNav() {
    const btn = $("[data-nav-toggle]");
    const nav = $("[data-site-nav]");
    if (!btn || !nav) return;

    btn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(open));
    });
  }

  function readingModes() {
    const buttons = $$("[data-mode]");
    if (!buttons.length) return;

    function apply(mode) {
      settings.mode = mode;
      body.dataset.readingMode = mode;

      buttons.forEach(btn => {
        const active = btn.dataset.mode === mode;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", String(active));
      });

      saveSettings();
    }

    buttons.forEach(btn => {
      btn.addEventListener("click", () => apply(btn.dataset.mode));
    });

    apply(settings.mode || "explorer");
  }

  function equationTools() {
    $$(".equation-display").forEach((eq, i) => {
      if (eq.dataset.ready) return;
      eq.dataset.ready = "true";

      if (!eq.id) eq.id = `equation-${i + 1}`;

      const tools = document.createElement("div");
      tools.className = "equation-tools";
      tools.innerHTML = `
        <button type="button" class="chip" data-copy>Copy</button>
        <button type="button" class="chip" data-collapse>Collapse</button>
        <button type="button" class="chip" data-link>Link</button>
      `;

      eq.after(tools);

      tools.querySelector("[data-copy]").addEventListener("click", e => {
        copyText(eq.innerText.trim());
        flash(e.target, "Copied");
      });

      tools.querySelector("[data-collapse]").addEventListener("click", e => {
        const collapsed = eq.classList.toggle("collapsed");
        e.target.textContent = collapsed ? "Expand" : "Collapse";
      });

      tools.querySelector("[data-link]").addEventListener("click", e => {
        const url = `${location.origin}${location.pathname}#${eq.id}`;
        copyText(url);
        history.replaceState(null, "", `#${eq.id}`);
        flash(e.target, "Copied");
      });
    });
  }

  function canonChapters() {
    $$(".equation-chapter").forEach(card => {
      if (card.dataset.chapterReady) return;
      card.dataset.chapterReady = "true";

      const equation = $(".equation-display", card);
      if (!equation) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip chapter-toggle";
      btn.textContent = "Focus";
      btn.setAttribute("aria-expanded", "true");

      card.appendChild(btn);

      btn.addEventListener("click", () => {
        card.classList.toggle("chapter-focused");
        const focused = card.classList.contains("chapter-focused");
        btn.textContent = focused ? "Unfocus" : "Focus";
      });
    });
  }

  function masterEquationFocus() {
    const buttons = $$("[data-focus-term]");
    const cards = $$("[data-term]");
    if (!buttons.length || !cards.length) return;

    buttons.forEach(btn => {
      btn.addEventListener("click", () => {
        const term = btn.dataset.focusTerm;
        const active = btn.classList.toggle("active");

        buttons.forEach(b => {
          if (b !== btn) b.classList.remove("active");
        });

        cards.forEach(card => {
          if (!active) {
            card.classList.remove("term-active", "term-dim");
            return;
          }

          const match = card.dataset.term === term;
          card.classList.toggle("term-active", match);
          card.classList.toggle("term-dim", !match);
        });
      });
    });
  }

  function searchCanon() {
    const canon = $("#canon");
    if (!canon) return;

    const search = document.createElement("div");
    search.className = "canon-search";
    search.innerHTML = `
      <label for="canon-search-input">Search Canon 0–17</label>
      <input id="canon-search-input" type="search" placeholder="Search equation, witness, memory, ethics, carrier...">
    `;

    canon.querySelector(".section-heading")?.after(search);

    const input = $("#canon-search-input");
    const chapters = $$(".equation-chapter");

    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();

      chapters.forEach(chapter => {
        const hit = chapter.innerText.toLowerCase().includes(q);
        chapter.hidden = q && !hit;
      });
    });
  }

  function commandPalette() {
    const palette = document.createElement("div");
    palette.className = "command-palette";
    palette.hidden = true;
    palette.innerHTML = `
      <div class="command-panel">
        <input type="search" placeholder="Search Codex..." aria-label="Command search">
        <div class="command-results"></div>
      </div>
    `;
    document.body.appendChild(palette);

    const input = $("input", palette);
    const results = $(".command-results", palette);

    const commands = [
      ["Home", "./"],
      ["Start", "start.html"],
      ["Theory", "theory.html"],
      ["Master Equation", "#master-equation"],
      ["Full Master Form", "#full-master-equation"],
      ["Canon 0–17", "#canon"],
      ["13 Moons", "moons.html"],
      ["Frequency", "systems/frequencies.html"],
      ["Artifacts", "shop.html"],
      ["Ledger", "ledger.html"],
      ["Caravan", "caravan.html"]
    ];

    function render(q = "") {
      const filtered = commands.filter(([label]) =>
        label.toLowerCase().includes(q.toLowerCase())
      );

      results.innerHTML = filtered
        .slice(0, 10)
        .map(([label, href]) => `<a href="${href}">${label}</a>`)
        .join("");
    }

    function open() {
      palette.hidden = false;
      input.value = "";
      render();
      setTimeout(() => input.focus(), 0);
    }

    function close() {
      palette.hidden = true;
    }

    document.addEventListener("keydown", e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        open();
      }

      if (e.key === "Escape") close();

      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
        e.preventDefault();
        open();
      }
    });

    input.addEventListener("input", () => render(input.value));
    palette.addEventListener("click", e => {
      if (e.target === palette) close();
    });
    results.addEventListener("click", close);
  }

  function revealOnScroll() {
    const items = $$(".section-shell, .card, .canon-card, .moon-card, .graph-card");

    if (!("IntersectionObserver" in window)) {
      items.forEach(el => el.classList.add("active"));
      return;
    }

    items.forEach(el => el.classList.add("reveal"));

    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("active");
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12 });

    items.forEach(el => obs.observe(el));
  }

  function smoothAnchors() {
    document.addEventListener("click", e => {
      const a = e.target.closest("a[href^='#']");
      if (!a) return;

      const target = $(a.getAttribute("href"));
      if (!target) return;

      e.preventDefault();

      const offset = $(".site-header")?.offsetHeight || 72;
      const top = target.getBoundingClientRect().top + scrollY - offset - 12;

      scrollTo({ top, behavior: "smooth" });
      history.replaceState(null, "", a.getAttribute("href"));
    });
  }

  function backToTop() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "to-top btn";
    btn.textContent = "↑";
    btn.setAttribute("aria-label", "Back to top");
    document.body.appendChild(btn);

    btn.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));

    addEventListener("scroll", () => {
      btn.classList.toggle("show", scrollY > 900);
    }, { passive: true });
  }

  function flash(btn, text) {
    const old = btn.textContent;
    btn.textContent = text;
    setTimeout(() => (btn.textContent = old), 900);
  }

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
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
