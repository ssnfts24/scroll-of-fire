/* Scroll of Fire — Theory Tools + Secondary Navigation */
(function () {
  "use strict";

  const body = document.body;
  const root = document.documentElement;
  const siteApi = window.ScrollOfFire || {};

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const STORAGE_KEY = "sof.theory.settings.v3";
  const THEORY_NAV_QUERY = "(max-width: 900px)";
  const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
  const THEORY_SECTION_FILES = new Set([
    "artifact-theory.html",
    "bibliography.html",
    "canon.html",
    "delta-framework.html",
    "ethics.html",
    "frequency-governance.html",
    "glossary.html",
    "living-technology.html",
    "master-equation.html",
    "memory.html",
    "notation.html",
    "operators.html",
    "theory.html",
    "thirteen-moons.html",
    "unified-field.html",
    "witness.html"
  ]);
  const EQUATION_FILE_PATTERN = /^eq(?:\d{2}|04b)\.html$/i;
  const COMMAND_BODY_CLASS = "command-open";
  const THEORY_NAV_OPEN_CLASS = "is-theory-nav-open";

  const settings = {
    mode: body?.dataset.readingMode || "explorer",
    carrier: "432"
  };

  function loadSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (stored && typeof stored === "object") {
        Object.assign(settings, stored);
      }
    } catch (_) {}
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (_) {}
  }

  function prefersReducedMotion() {
    if (typeof siteApi.prefersReducedMotion === "function") {
      return siteApi.prefersReducedMotion();
    }

    return window.matchMedia?.(REDUCED_MOTION_QUERY).matches === true;
  }

  function flashButton(button, text, duration = 900) {
    if (typeof siteApi.flashButton === "function") {
      siteApi.flashButton(button, text, duration);
      return;
    }

    if (!(button instanceof HTMLElement)) return;
    const original = button.textContent;
    button.textContent = text;
    window.setTimeout(() => {
      button.textContent = original;
    }, duration);
  }

  async function copyText(value) {
    if (typeof siteApi.copyText === "function") {
      return siteApi.copyText(value);
    }

    const text = String(value || "").trim();
    if (!text) return false;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}

    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.left = "-9999px";
    field.style.top = "0";
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
    if (typeof siteApi.getFocusable === "function") {
      return siteApi.getFocusable(container);
    }

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
    ).filter(element => {
      return !element.hidden && element.getAttribute("aria-hidden") !== "true" && element.offsetParent !== null;
    });
  }

  function syncDocumentLock() {
    if (typeof siteApi.syncDocumentLock === "function") {
      siteApi.syncDocumentLock();
      return;
    }

    const shouldLock =
      body.classList.contains(COMMAND_BODY_CLASS) ||
      document.querySelector("[data-theory-nav].is-theory-nav-open") !== null;

    root.style.overflow = shouldLock ? "hidden" : "";
  }

  function getPageBasePath() {
    const path = window.location.pathname;
    if (path.includes("/theory/")) {
      return "../";
    }
    return "./";
  }

  function resolveCodexPath(path) {
    if (typeof siteApi.resolveFromCodexRoot === "function") {
      return siteApi.resolveFromCodexRoot(path);
    }

    if (
      !path ||
      path.startsWith("http://") ||
      path.startsWith("https://") ||
      path.startsWith("mailto:") ||
      path.startsWith("tel:") ||
      path.startsWith("#") ||
      path.startsWith("/")
    ) {
      return path;
    }

    return `${getPageBasePath()}${path}`;
  }

  function isIgnoredHref(href) {
    return (
      !href ||
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("sms:") ||
      href.startsWith("javascript:") ||
      href.startsWith("vbscript:") ||
      href.startsWith("data:")
    );
  }

  function normalizeTheoryLink(path) {
    let clean = String(path || "").trim();

    if (!clean) return clean;

    clean = clean.replace(/^\.?\//, "").replace(/^docs\//i, "");
    const lowerClean = clean.toLowerCase();

    if (clean.startsWith("theory/") || clean.startsWith("assets/")) {
      return clean;
    }

    if (lowerClean === "theory.html") {
      return "theory.html";
    }

    if (lowerClean === "frequencies.html") {
      return "systems/frequencies.html";
    }

    if (lowerClean === "dpcs/shop.html") {
      return "shop.html";
    }

    if (clean.startsWith("equations/")) {
      return `theory/${clean}`;
    }

    if (EQUATION_FILE_PATTERN.test(clean)) {
      return `theory/equations/${clean.toLowerCase()}`;
    }

    if (THEORY_SECTION_FILES.has(lowerClean)) {
      return `theory/${lowerClean}`;
    }

    return clean;
  }

  function normalizeTheoryLinks() {
    const path = window.location.pathname.toLowerCase();
    const isTheoryPage = path.includes("/theory/") || path.endsWith("/theory.html");

    if (!isTheoryPage) return;

    $$("a[href]").forEach(anchor => {
      const href = anchor.getAttribute("href");
      if (isIgnoredHref(href) || href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//") || href.startsWith("/")) {
        return;
      }

      const parts = String(href).match(/^([^?#]*)(.*)$/);
      const originalPath = parts?.[1] || "";
      const suffix = parts?.[2] || "";
      const normalizedPath = normalizeTheoryLink(originalPath);

      if (!normalizedPath || normalizedPath === originalPath) return;
      anchor.setAttribute("href", `${normalizedPath}${suffix}`);
    });
  }

  function theoryNavigation() {
    const wrapper = $("[data-theory-nav]");
    const button = $("[data-theory-nav-toggle]", wrapper || document);
    const panel = $("[data-theory-nav-panel]", wrapper || document);

    if (!wrapper || !button || !panel) return;

    const media = window.matchMedia(THEORY_NAV_QUERY);
    let returnFocus = null;

    function isOpen() {
      return wrapper.classList.contains(THEORY_NAV_OPEN_CLASS);
    }

    function setOpen(open) {
      const mobileOpen = open && media.matches;

      wrapper.classList.toggle(THEORY_NAV_OPEN_CLASS, mobileOpen);
      button.setAttribute("aria-expanded", String(mobileOpen));
      button.setAttribute("aria-label", mobileOpen ? "Close Theory navigation" : "Open Theory navigation");

      if (media.matches) {
        panel.setAttribute("aria-hidden", String(!mobileOpen));
      } else {
        panel.removeAttribute("aria-hidden");
      }

      syncDocumentLock();
    }

    function openNav() {
      if (!media.matches || isOpen()) return;
      returnFocus = document.activeElement;
      setOpen(true);

      const firstItem = getFocusable(panel)[0];
      if (firstItem) {
        requestAnimationFrame(() => {
          firstItem.focus({ preventScroll: true });
        });
      }
    }

    function closeNav({ restoreFocus = false } = {}) {
      const wasOpen = isOpen();
      setOpen(false);

      if (wasOpen && restoreFocus) {
        const focusTarget = returnFocus instanceof HTMLElement ? returnFocus : button;
        requestAnimationFrame(() => {
          focusTarget.focus({ preventScroll: true });
        });
      }

      returnFocus = null;
    }

    function trapFocus(event) {
      if (event.key !== "Tab" || !media.matches || !isOpen()) return;

      const focusable = getFocusable(panel);
      if (!focusable.length) {
        event.preventDefault();
        button.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    }

    button.addEventListener("click", () => {
      if (isOpen()) {
        closeNav({ restoreFocus: true });
      } else {
        openNav();
      }
    });

    panel.addEventListener("click", event => {
      if (event.target.closest("a[href]") && media.matches) {
        closeNav();
      }
    });

    document.addEventListener("click", event => {
      if (!media.matches || !isOpen()) return;
      if (wrapper.contains(event.target)) return;
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
        panel.removeAttribute("aria-hidden");
      } else {
        setOpen(false);
      }
    }

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleViewportChange);
    } else if (typeof media.addListener === "function") {
      media.addListener(handleViewportChange);
    }

    if (media.matches) {
      setOpen(false);
    } else {
      panel.removeAttribute("aria-hidden");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "Open Theory navigation");
    }
  }

  function readingModes() {
    const buttons = $$('[data-mode]');
    if (!buttons.length) return;

    function apply(mode) {
      const nextMode = mode || 'explorer';
      settings.mode = nextMode;
      body.dataset.readingMode = nextMode;

      buttons.forEach(button => {
        const active = button.dataset.mode === nextMode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });

      saveSettings();
    }

    buttons.forEach(button => {
      button.addEventListener('click', () => {
        apply(button.dataset.mode);
      });
    });

    apply(settings.mode);
  }

  function equationTools() {
    $$('.equation-display').forEach((equation, index) => {
      if (equation.dataset.ready === 'true') return;

      equation.dataset.ready = 'true';

      if (!equation.id) {
        equation.id = `equation-${index + 1}`;
      }

      const tools = document.createElement('div');
      tools.className = 'equation-tools';
      tools.setAttribute('aria-label', 'Equation tools');
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

      const copyButton = $('[data-copy]', tools);
      const collapseButton = $('[data-collapse]', tools);
      const linkButton = $('[data-link]', tools);

      copyButton?.addEventListener('click', async event => {
        const copied = await copyText(equation.innerText.trim());
        flashButton(event.currentTarget, copied ? 'Copied' : 'Copy failed');
      });

      collapseButton?.addEventListener('click', event => {
        const collapsed = equation.classList.toggle('collapsed');
        event.currentTarget.textContent = collapsed ? 'Expand' : 'Collapse';
        event.currentTarget.setAttribute('aria-expanded', String(!collapsed));
      });

      linkButton?.addEventListener('click', async event => {
        const url = new URL(window.location.href);
        url.hash = equation.id;

        const copied = await copyText(url.toString());
        history.replaceState(null, '', `#${equation.id}`);
        flashButton(event.currentTarget, copied ? 'Copied' : 'Linked');
      });
    });
  }

  function canonChapters() {
    $$('.equation-chapter').forEach(card => {
      if (card.dataset.chapterReady === 'true') return;
      card.dataset.chapterReady = 'true';

      const equation = $('.equation-display', card);
      if (!equation) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip chapter-toggle';
      button.textContent = 'Focus';
      button.setAttribute('aria-pressed', 'false');

      card.appendChild(button);

      button.addEventListener('click', () => {
        const focused = card.classList.toggle('chapter-focused');
        button.textContent = focused ? 'Unfocus' : 'Focus';
        button.setAttribute('aria-pressed', String(focused));

        if (focused) {
          card.scrollIntoView({
            block: 'start',
            behavior: prefersReducedMotion() ? 'auto' : 'smooth'
          });
        }
      });
    });
  }

  function masterEquationFocus() {
    const buttons = $$('[data-focus-term]');
    const cards = $$('[data-term]');
    if (!buttons.length || !cards.length) return;

    function clearFocus() {
      buttons.forEach(button => {
        button.classList.remove('active');
        button.setAttribute('aria-pressed', 'false');
      });

      cards.forEach(card => {
        card.classList.remove('term-active', 'term-dim');
      });
    }

    buttons.forEach(button => {
      button.setAttribute('aria-pressed', 'false');

      button.addEventListener('click', () => {
        const term = button.dataset.focusTerm;
        const wasActive = button.classList.contains('active');

        clearFocus();
        if (wasActive) return;

        button.classList.add('active');
        button.setAttribute('aria-pressed', 'true');

        cards.forEach(card => {
          const match = card.dataset.term === term;
          card.classList.toggle('term-active', match);
          card.classList.toggle('term-dim', !match);
        });
      });
    });
  }

  function searchCanon() {
    const canon = $('#canon');
    if (!canon || canon.dataset.searchReady === 'true') return;

    const chapters = $$('.equation-chapter', canon);
    if (!chapters.length) return;

    canon.dataset.searchReady = 'true';

    const search = document.createElement('div');
    search.className = 'canon-search';
    search.innerHTML = `
      <label for="canon-search-input">Search Canon 0–17</label>
      <input
        id="canon-search-input"
        type="search"
        inputmode="search"
        autocomplete="off"
        placeholder="Search equation, witness, memory, ethics, carrier..."
      >
      <p class="canon-search-status" role="status" aria-live="polite"></p>
    `;

    const sectionHeading = canon.querySelector('.section-heading');
    if (sectionHeading) {
      sectionHeading.after(search);
    } else {
      canon.prepend(search);
    }

    const input = $('#canon-search-input', search);
    const status = $('.canon-search-status', search);
    if (!input) return;

    function filterCanon() {
      const query = input.value.trim().toLowerCase();
      let visible = 0;

      chapters.forEach(chapter => {
        const match = !query || chapter.innerText.toLowerCase().includes(query);
        chapter.hidden = !match;
        if (match) visible += 1;
      });

      if (status) {
        status.textContent = query ? `${visible} Canon entr${visible === 1 ? 'y' : 'ies'} shown.` : '';
      }
    }

    input.addEventListener('input', filterCanon);
    input.addEventListener('search', filterCanon);
  }

  function commandPalette() {
    if ($('.command-palette')) return;

    const palette = document.createElement('div');
    palette.className = 'command-palette';
    palette.hidden = true;
    palette.setAttribute('role', 'dialog');
    palette.setAttribute('aria-modal', 'true');
    palette.setAttribute('aria-label', 'Search the Codex');
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

    const input = $('input', palette);
    const results = $('.command-results', palette);
    if (!input || !results) return;

    let returnFocus = null;

    const commands = [
      ['Home', ''],
      ['Start', 'start.html'],
      ['Theory Hub', 'theory.html'],
      ['Canon 0–17', 'theory/canon.html#canon'],
      ['Master Equation', 'theory/master-equation.html'],
      ['Unified Field', 'theory/unified-field.html'],
      ['Delta Framework', 'theory/delta-framework.html'],
      ['Living Operators', 'theory/operators.html'],
      ['Witness Theory', 'theory/witness.html'],
      ['Memory Theory', 'theory/memory.html'],
      ['Ethics', 'theory/ethics.html'],
      ['13 Moons Theory', 'theory/thirteen-moons.html'],
      ['Frequency Governance', 'theory/frequency-governance.html'],
      ['Living Technology', 'theory/living-technology.html'],
      ['Artifact Theory', 'theory/artifact-theory.html'],
      ['Glossary', 'theory/glossary.html'],
      ['Notation', 'theory/notation.html'],
      ['Bibliography', 'theory/bibliography.html'],
      ['Equation 0 — Foundational Field', 'theory/equations/eq00.html'],
      ['Equation 1 — Source and Operators', 'theory/equations/eq01.html'],
      ['Equation 2 — Witness', 'theory/equations/eq02.html'],
      ['Equation 3 — Harmonic Gate', 'theory/equations/eq03.html'],
      ['Equation 4 — Language', 'theory/equations/eq04.html'],
      ['Equation 4b — Semantic Gradient', 'theory/equations/eq04b.html'],
      ['Equation 5 — Remnant', 'theory/equations/eq05.html'],
      ['Equation 6 — Type-7 Field', 'theory/equations/eq06.html'],
      ['Equation 7 — Copeland Comparator', 'theory/equations/eq07.html'],
      ['Equation 8 — Goodwin Comparator', 'theory/equations/eq08.html'],
      ['Equation 9 — Ethical Law', 'theory/equations/eq09.html'],
      ['Equation 10 — Inverse Resonance Ladder', 'theory/equations/eq10.html'],
      ['Equation 11 — Projection Frame', 'theory/equations/eq11.html'],
      ['Equation 12 — Causal Lattice', 'theory/equations/eq12.html'],
      ['Equation 13 — Coherence', 'theory/equations/eq13.html'],
      ['Equation 14 — Update Rule', 'theory/equations/eq14.html'],
      ['Equation 15 — Learning Kernel', 'theory/equations/eq15.html'],
      ['Equation 16 — Memory Window', 'theory/equations/eq16.html'],
      ['Equation 17 — Voice Carriers', 'theory/equations/eq17.html'],
      ['13 Moons', 'moons.html'],
      ['Frequency Console', 'systems/frequencies.html'],
      ['Artifact Registry', 'shop.html'],
      ['Ledger', 'ledger.html'],
      ['Covenant Caravan', 'covenant-caravan.html']
    ];

    function render(query = '') {
      const normalized = query.trim().toLowerCase();
      const filtered = commands.filter(([label]) => label.toLowerCase().includes(normalized));

      if (!filtered.length) {
        results.innerHTML = '<p class="command-empty">No matching Codex entry.</p>';
        return;
      }

      results.innerHTML = filtered
        .slice(0, 12)
        .map(([label, href]) => {
          const resolvedHref = href ? resolveCodexPath(href) : resolveCodexPath('./');
          return `<a href="${resolvedHref}">${label}</a>`;
        })
        .join('');
    }

    function openPalette() {
      returnFocus = document.activeElement;
      palette.hidden = false;
      body.classList.add(COMMAND_BODY_CLASS);
      syncDocumentLock();
      input.value = '';
      render();
      requestAnimationFrame(() => {
        input.focus({ preventScroll: true });
      });
    }

    function closePalette({ restoreFocus = true } = {}) {
      if (palette.hidden) return;

      palette.hidden = true;
      body.classList.remove(COMMAND_BODY_CLASS);
      syncDocumentLock();

      if (restoreFocus && returnFocus instanceof HTMLElement) {
        requestAnimationFrame(() => {
          returnFocus.focus({ preventScroll: true });
        });
      }

      returnFocus = null;
    }

    function trapPaletteFocus(event) {
      if (event.key !== 'Tab' || palette.hidden) return;

      const focusable = getFocusable(palette);
      if (!focusable.length) {
        event.preventDefault();
        input.focus();
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

    document.addEventListener('keydown', event => {
      const activeElement = document.activeElement;
      const activeTag = activeElement?.tagName || '';
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag) || activeElement?.isContentEditable === true;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (palette.hidden) {
          openPalette();
        } else {
          closePalette();
        }
        return;
      }

      if (event.key === 'Escape' && !palette.hidden) {
        event.preventDefault();
        closePalette();
        return;
      }

      if (event.key === '/' && !isTyping && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        openPalette();
        return;
      }

      trapPaletteFocus(event);
    });

    input.addEventListener('input', () => {
      render(input.value);
    });

    palette.addEventListener('click', event => {
      if (event.target === palette) {
        closePalette();
      }
    });

    results.addEventListener('click', event => {
      if (event.target.closest('a')) {
        closePalette({ restoreFocus: false });
      }
    });
  }

  function revealOnScroll() {
    const items = $$('.section-shell, .card, .canon-card, .moon-card, .graph-card');
    if (!items.length) return;

    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      items.forEach(element => {
        element.classList.add('active');
      });
      return;
    }

    items.forEach(element => {
      element.classList.add('reveal');
    });

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('active');
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: '0px 0px -8% 0px',
        threshold: 0.08
      }
    );

    items.forEach(element => {
      observer.observe(element);
    });
  }

  function smoothAnchors() {
    document.addEventListener('click', event => {
      const anchor = event.target.closest("a[href^='#']");
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;

      let target;

      try {
        target = document.querySelector(href);
      } catch (_) {
        return;
      }

      if (!target) return;

      event.preventDefault();

      const offset = $('.site-header')?.offsetHeight || 72;
      const top = target.getBoundingClientRect().top + window.scrollY - offset - 12;

      window.scrollTo({
        top: Math.max(0, top),
        behavior: prefersReducedMotion() ? 'auto' : 'smooth'
      });

      history.replaceState(null, '', href);

      const hadTabindex = target.hasAttribute('tabindex');
      if (!hadTabindex) {
        target.setAttribute('tabindex', '-1');
      }

      requestAnimationFrame(() => {
        target.focus({ preventScroll: true });

        if (!hadTabindex) {
          target.addEventListener(
            'blur',
            () => {
              target.removeAttribute('tabindex');
            },
            { once: true }
          );
        }
      });
    });
  }

  function backToTop() {
    if ($('.to-top')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'to-top btn';
    button.textContent = '↑';
    button.setAttribute('aria-label', 'Back to top');

    document.body.appendChild(button);

    button.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth'
      });
    });

    function updateVisibility() {
      button.classList.toggle('show', window.scrollY > 900);
    }

    window.addEventListener('scroll', updateVisibility, { passive: true });
    updateVisibility();
  }

  function revealHashTarget() {
    if (!window.location.hash) return;

    let target;
    try {
      target = document.querySelector(window.location.hash);
    } catch (_) {
      return;
    }

    if (!target) return;

    const hiddenChapter = target.closest('.equation-chapter[hidden]');
    if (hiddenChapter) {
      hiddenChapter.hidden = false;
    }

    requestAnimationFrame(() => {
      const offset = $('.site-header')?.offsetHeight || 72;
      const top = target.getBoundingClientRect().top + window.scrollY - offset - 12;

      window.scrollTo({
        top: Math.max(0, top),
        behavior: 'auto'
      });
    });
  }

  function boot() {
    loadSettings();
    normalizeTheoryLinks();
    theoryNavigation();
    readingModes();
    equationTools();
    canonChapters();
    masterEquationFocus();
    searchCanon();
    commandPalette();
    revealOnScroll();
    smoothAnchors();
    backToTop();
    revealHashTarget();
    syncDocumentLock();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
