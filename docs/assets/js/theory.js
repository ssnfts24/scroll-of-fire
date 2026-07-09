/* =========================================================
   Scroll of Fire — Theory Page
   Codex of Reality · Living Theory
   File: assets/js/theory.js
   ========================================================= */

(function () {
  "use strict";

  const root = document.documentElement;
  const body = document.body;

  const qs = (selector, scope = document) => scope.querySelector(selector);
  const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const storageKey = "sof.theory.settings.v1";

  const settings = {
    mode: "explorer",
    carrier: "432",
    reduceMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches
  };

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
      Object.assign(settings, saved);
    } catch (_) {}
  }

  function saveSettings() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch (_) {}
  }

  function setYear() {
    const year = qs("#year");
    if (year) year.textContent = String(new Date().getFullYear());
  }

  function initMobileNav() {
    const toggle = qs("[data-nav-toggle]");
    const nav = qs("[data-site-nav]");

    if (!toggle || !nav) return;

    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      body.classList.toggle("nav-open", open);
    });

    nav.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (!link) return;

      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open navigation");
      body.classList.remove("nav-open");
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open navigation");
      body.classList.remove("nav-open");
    });
  }

  function initReadingModes() {
    const buttons = qsa("[data-mode]");
    if (!buttons.length) return;

    function applyMode(mode) {
      settings.mode = mode;
      body.setAttribute("data-reading-mode", mode);

      buttons.forEach((button) => {
        const active = button.dataset.mode === mode;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });

      saveSettings();
    }

    buttons.forEach((button) => {
      button.setAttribute("aria-pressed", button.classList.contains("active") ? "true" : "false");

      button.addEventListener("click", () => {
        applyMode(button.dataset.mode || "explorer");
      });
    });

    applyMode(settings.mode || "explorer");
  }

  function initScrollReveal() {
    const revealItems = qsa(
      ".section-shell, .card, .canon-card, .node, .codex-seal, .flow-ladder > div, .timeline-list article"
    );

    revealItems.forEach((item) => item.classList.add("reveal"));

    if (!("IntersectionObserver" in window) || settings.reduceMotion) {
      revealItems.forEach((item) => item.classList.add("active"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("active");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12 }
    );

    revealItems.forEach((item) => observer.observe(item));
  }

  function initSmoothAnchors() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a[href^='#']");
      if (!link) return;

      const hash = link.getAttribute("href");
      if (!hash || hash === "#") return;

      const target = qs(hash);
      if (!target) return;

      event.preventDefault();

      const header = qs(".site-header");
      const offset = header ? header.offsetHeight + 12 : 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;

      window.scrollTo({ top, behavior: settings.reduceMotion ? "auto" : "smooth" });
      history.pushState(null, "", hash);
    });
  }

  function initInteractiveEquation() {
    const buttons = qsa("[data-focus-term]");
    const cards = qsa("[data-term]");

    if (!buttons.length || !cards.length) return;

    function focusTerm(term) {
      cards.forEach((card) => {
        const active = card.dataset.term === term;
        card.classList.toggle("term-active", active);
        card.classList.toggle("term-dim", !active);
      });

      buttons.forEach((button) => {
        button.classList.toggle("active", button.dataset.focusTerm === term);
      });
    }

    function clearFocus() {
      cards.forEach((card) => {
        card.classList.remove("term-active", "term-dim");
      });

      buttons.forEach((button) => button.classList.remove("active"));
    }

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const term = button.dataset.focusTerm;
        const isActive = button.classList.contains("active");

        if (isActive) {
          clearFocus();
        } else {
          focusTerm(term);
        }
      });
    });
  }

  function initBackToTop() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "to-top btn";
    button.textContent = "↑";
    button.setAttribute("aria-label", "Back to top");
    document.body.appendChild(button);

    button.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: settings.reduceMotion ? "auto" : "smooth" });
    });

    window.addEventListener(
      "scroll",
      () => {
        button.classList.toggle("show", window.scrollY > 900);
      },
      { passive: true }
    );
  }

  function initCarrierTheme() {
    const carriers = (root.dataset.carriers || "432,528,369,144,963")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!carriers.length) return;

    function applyCarrier(value) {
      settings.carrier = value;
      carriers.forEach((carrier) => root.classList.remove(`carrier-${carrier}`));
      root.classList.add(`carrier-${value}`);
      saveSettings();
    }

    applyCarrier(settings.carrier || carriers[0]);
  }

  function init() {
    loadSettings();
    setYear();
    initMobileNav();
    initReadingModes();
    initScrollReveal();
    initSmoothAnchors();
    initInteractiveEquation();
    initBackToTop();
    initCarrierTheme();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* =========================================================
     Equation Tools
     ========================================================= */

  function copyText(text) {
    if (!text) return Promise.resolve(false);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    let success = false;
    try {
      success = document.execCommand("copy");
    } catch (_) {
      success = false;
    }

    document.body.removeChild(textarea);
    return Promise.resolve(success);
  }

  function flashButton(button, text = "Copied") {
    if (!button) return;
    const original = button.textContent;
    button.textContent = text;
    button.disabled = true;

    setTimeout(() => {
      button.textContent = original;
      button.disabled = false;
    }, 900);
  }

  function initEquationTools() {
    document.querySelectorAll(".equation-display, .eq, .eq-scroll").forEach((block, index) => {
      if (block.dataset.toolsReady === "true") return;
      block.dataset.toolsReady = "true";

      const wrapper = document.createElement("div");
      wrapper.className = "equation-tools";

      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = "chip";
      copyButton.textContent = "Copy";

      const collapseButton = document.createElement("button");
      collapseButton.type = "button";
      collapseButton.className = "chip";
      collapseButton.textContent = "Collapse";

      const linkButton = document.createElement("button");
      linkButton.type = "button";
      linkButton.className = "chip";
      linkButton.textContent = "Link";

      if (!block.id) block.id = `equation-${index + 1}`;

      copyButton.addEventListener("click", () => {
        copyText(block.innerText || block.textContent || "").then((ok) => {
          flashButton(copyButton, ok ? "Copied" : "Failed");
        });
      });

      collapseButton.addEventListener("click", () => {
        const collapsed = block.classList.toggle("collapsed");
        collapseButton.textContent = collapsed ? "Expand" : "Collapse";
      });

      linkButton.addEventListener("click", () => {
        const url = `${location.origin}${location.pathname}#${block.id}`;
        copyText(url).then((ok) => {
          if (ok) history.pushState(null, "", `#${block.id}`);
          flashButton(linkButton, ok ? "Link Copied" : "Failed");
        });
      });

      wrapper.append(copyButton, collapseButton, linkButton);
      block.insertAdjacentElement("afterend", wrapper);
    });
  }

  /* =========================================================
     Collapsible Chapters
     ========================================================= */

  function initCollapsibleCards() {
    document.querySelectorAll(".canon-card, .node").forEach((card, index) => {
      if (card.dataset.collapseReady === "true") return;
      card.dataset.collapseReady = "true";

      const content = card.querySelector("p");
      if (!content) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip read-more";
      button.textContent = "Expand";
      button.setAttribute("aria-expanded", "false");

      const extra = document.createElement("div");
      extra.className = "chapter-extra";
      extra.hidden = true;
      extra.innerHTML = `
        <p>
          This entry connects back to the larger Codex system through observation,
          practice, witness, and refinement.
        </p>
      `;

      button.addEventListener("click", () => {
        const open = extra.hidden;
        extra.hidden = !open;
        button.textContent = open ? "Collapse" : "Expand";
        button.setAttribute("aria-expanded", String(open));
      });

      card.append(extra, button);
    });
  }

  /* =========================================================
     Command Palette
     ========================================================= */

  function initCommandPalette() {
    const palette = document.createElement("div");
    palette.className = "command-palette";
    palette.hidden = true;
    palette.setAttribute("role", "dialog");
    palette.setAttribute("aria-modal", "true");
    palette.setAttribute("aria-label", "Command palette");

    palette.innerHTML = `
      <div class="command-panel">
        <input type="search" class="command-input" placeholder="Search the Codex..." aria-label="Search commands">
        <div class="command-results" role="listbox"></div>
      </div>
    `;

    document.body.appendChild(palette);

    const input = palette.querySelector(".command-input");
    const results = palette.querySelector(".command-results");

    const commands = [
      ["Home", "./"],
      ["Start Here", "start.html"],
      ["Theory", "theory.html"],
      ["13 Moons", "moons.html"],
      ["Covenant Caravan", "caravan.html"],
      ["Artifact Registry", "shop.html"],
      ["Systems Hub", "hub.html"],
      ["Daily Witness Ledger", "ledger.html"],
      ["Frequency Governance", "systems/frequencies.html"],
      ["Genesis Oracle", "genesis-oracle.html"],
      ["Downloads", "downloads.html"],
      ["Ethics", "ethics.html"],
      ["Glossary", "glossary.html"],
      ["Master Equation", "#master-equation"],
      ["Canon", "#canon"],
      ["Knowledge Graph", "#knowledge-graph"],
      ["Practice", "#applications"],
      ["Timeline", "#timeline"]
    ];

    function openPalette() {
      palette.hidden = false;
      input.value = "";
      render(commands);
      setTimeout(() => input.focus(), 0);
    }

    function closePalette() {
      palette.hidden = true;
    }

    function render(items) {
      results.innerHTML = items
        .slice(0, 12)
        .map(([label, href], index) => {
          return `<a role="option" data-index="${index}" href="${href}">${label}</a>`;
        })
        .join("");
    }

    function filter(value) {
      const query = value.trim().toLowerCase();
      if (!query) return commands;
      return commands.filter(([label]) => label.toLowerCase().includes(query));
    }

    document.addEventListener("keydown", (event) => {
      const meta = event.ctrlKey || event.metaKey;

      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openPalette();
      }

      if (event.key === "Escape" && !palette.hidden) {
        event.preventDefault();
        closePalette();
      }
    });

    input.addEventListener("input", () => {
      render(filter(input.value));
    });

    results.addEventListener("click", () => {
      closePalette();
    });

    palette.addEventListener("click", (event) => {
      if (event.target === palette) closePalette();
    });
  }

  /* =========================================================
     Page Search
     ========================================================= */

  function initPageSearch() {
    const host = document.createElement("section");
    host.className = "section-shell theory-search-shell";
    host.innerHTML = `
      <div class="theory-search">
        <label for="theory-search-input">Search this theory page</label>
        <input id="theory-search-input" type="search" placeholder="Try memory, witness, artifact, flow, ethics...">
        <div class="theory-search-results" aria-live="polite"></div>
      </div>
    `;

    const firstSection = document.querySelector("#reading-modes");
    if (firstSection) firstSection.insertAdjacentElement("beforebegin", host);

    const input = host.querySelector("input");
    const results = host.querySelector(".theory-search-results");

    const targets = Array.from(document.querySelectorAll("h1, h2, h3, .card, .canon-card, .node"))
      .map((el, index) => {
        if (!el.id) el.id = `search-target-${index + 1}`;
        return {
          id: el.id,
          title: (el.querySelector("h2,h3,strong") || el).textContent.trim(),
          text: el.textContent.trim()
        };
      });

    function render(query) {
      const q = query.trim().toLowerCase();
      if (!q) {
        results.innerHTML = "";
        return;
      }

      const matches = targets
        .filter((item) => item.text.toLowerCase().includes(q))
        .slice(0, 8);

      if (!matches.length) {
        results.innerHTML = `<p>No matches found.</p>`;
        return;
      }

      results.innerHTML = matches
        .map((item) => `<a href="#${item.id}">${item.title}</a>`)
        .join("");
    }

    input.addEventListener("input", () => render(input.value));

    document.addEventListener("keydown", (event) => {
      if (event.key === "/" && document.activeElement !== input) {
        event.preventDefault();
        input.focus();
      }
    });
  }

/* ===========================================================
   Reading Modes
=========================================================== */

function initReadingModes() {

    const buttons = document.querySelectorAll("[data-reading-mode]");

    if (!buttons.length) return;

    const modes = [
        "reader",
        "student",
        "researcher",
        "builder"
    ];

    const saved = localStorage.getItem("codex-reading-mode");

    if (saved && modes.includes(saved)) {
        document.documentElement.dataset.mode = saved;
        activate(saved);
    }

    buttons.forEach(button => {

        button.addEventListener("click", () => {

            const mode = button.dataset.readingMode;

            if (!modes.includes(mode)) return;

            document.documentElement.dataset.mode = mode;

            localStorage.setItem(
                "codex-reading-mode",
                mode
            );

            activate(mode);

        });

    });

    function activate(mode){

        buttons.forEach(btn=>{
            btn.classList.remove("active");
        });

        document
            .querySelector(`[data-reading-mode="${mode}"]`)
            ?.classList.add("active");

    }

}

/* ===========================================================
   Timeline Builder
=========================================================== */

function initTimeline(){

    const timeline = document.querySelector(".timeline");

    if(!timeline) return;

    const cards = timeline.querySelectorAll(".timeline-card");

    const observer = new IntersectionObserver(entries=>{

        entries.forEach(entry=>{

            if(entry.isIntersecting){

                entry.target.classList.add("visible");

            }

        });

    },{
        threshold:.2
    });

    cards.forEach(card=>observer.observe(card));

}

/* ===========================================================
   Knowledge Graph
=========================================================== */

function initKnowledgeGraph(){

    const graph = document.querySelector("#knowledge-graph");

    if(!graph) return;

    const nodes = graph.querySelectorAll(".node");

    nodes.forEach(node=>{

        node.addEventListener("mouseenter",()=>{

            const group=node.dataset.group;

            nodes.forEach(other=>{

                other.classList.toggle(
                    "highlight",
                    other.dataset.group===group
                );

            });

        });

        node.addEventListener("mouseleave",()=>{

            nodes.forEach(other=>{

                other.classList.remove("highlight");

            });

        });

    });

}

/* ===========================================================
   Canon Progress
=========================================================== */

function initCanonProgress(){

    const progress=document.querySelector(".canon-progress");

    if(!progress) return;

    const sections=[
        ...document.querySelectorAll("section[id]")
    ];

    window.addEventListener("scroll",()=>{

        let current=0;

        sections.forEach(section=>{

            if(window.scrollY>
                section.offsetTop-200){

                current++;

            }

        });

        const percent=Math.min(
            100,
            (current/sections.length)*100
        );

        progress.style.width=`${percent}%`;

    });

}

/* ===========================================================
   Equation Expansion
=========================================================== */

function initEquationExpansion(){

    document
    .querySelectorAll(".equation-card")
    .forEach(card=>{

        const button=card.querySelector(".expand-equation");

        const body=card.querySelector(".equation-body");

        if(!button||!body) return;

        button.addEventListener("click",()=>{

            const open=card.classList.toggle("expanded");

            body.hidden=!open;

            button.textContent=open
                ? "Collapse"
                : "Expand";

        });

    });

}

/* ===========================================================
   Canon Cards
=========================================================== */

function initCanonCards(){

    document
    .querySelectorAll(".canon-card")
    .forEach(card=>{

        card.addEventListener("click",()=>{

            card.classList.toggle("open");

        });

    });

}

/* ===========================================================
   Daily Reflection Generator
=========================================================== */

function initReflection(){

    const output=document.querySelector("#reflection-output");

    const button=document.querySelector("#generate-reflection");

    if(!output||!button) return;

    const prompts=[

        "What truth remained after everything unnecessary fell away?",

        "What repeated today that deserves witnessing?",

        "Where did coherence increase?",

        "What should be carried into tomorrow?",

        "What deserves to become part of the Remnant?"

    ];

    button.addEventListener("click",()=>{

        const choice=
            prompts[
                Math.floor(
                    Math.random()*prompts.length
                )
            ];

        output.textContent=choice;

    });

}

/* ===========================================================
   Smooth Anchor Navigation
=========================================================== */

function initAnchors(){

    document
    .querySelectorAll('a[href^="#"]')
    .forEach(anchor=>{

        anchor.addEventListener("click",e=>{

            const id=anchor.getAttribute("href");

            if(id==="#"||id.length<2) return;

            const target=document.querySelector(id);

            if(!target) return;

            e.preventDefault();

            target.scrollIntoView({

                behavior:"smooth",

                block:"start"

            });

            history.replaceState(
                null,
                "",
                id
            );

        });

    });

}

/* ===========================================================
   Ambient Effects
=========================================================== */

function initAmbientEffects() {

    const body = document.body;

    let lastScroll = 0;

    window.addEventListener("scroll", () => {

        const current = window.scrollY;

        const delta = Math.abs(current - lastScroll);

        if (delta > 4) {

            body.style.setProperty(
                "--scroll-energy",
                Math.min(current / 4000, 1)
            );

        }

        lastScroll = current;

    });

}

/* ===========================================================
   Reading Time Estimate
=========================================================== */

function initReadingTime() {

    const container = document.querySelector("main");

    const output = document.querySelector("#reading-time");

    if (!container || !output) return;

    const words = container.innerText
        .trim()
        .split(/\s+/).length;

    const minutes = Math.max(
        1,
        Math.round(words / 220)
    );

    output.textContent = `${minutes} min read`;

}

/* ===========================================================
   Keyboard Shortcuts
=========================================================== */

function initKeyboardShortcuts() {

    document.addEventListener("keydown", e => {

        if (
            e.target.matches(
                "input, textarea"
            )
        ) return;

        switch (e.key.toLowerCase()) {

            case "h":
                location.href = "./";
                break;

            case "t":
                location.href = "#top";
                break;

            case "m":
                document
                    .querySelector("#master-equation")
                    ?.scrollIntoView({
                        behavior: "smooth"
                    });
                break;

            case "g":
                document
                    .querySelector("#knowledge-graph")
                    ?.scrollIntoView({
                        behavior: "smooth"
                    });
                break;

            case "c":
                document
                    .querySelector("#canon")
                    ?.scrollIntoView({
                        behavior: "smooth"
                    });
                break;

            case "?":
                toggleKeyboardHelp();
                break;

        }

    });

}

function toggleKeyboardHelp() {

    let help = document.querySelector("#keyboard-help");

    if (!help) {

        help = document.createElement("dialog");

        help.id = "keyboard-help";

        help.innerHTML = `

<h2>Keyboard Shortcuts</h2>

<ul>

<li><strong>H</strong> Home</li>

<li><strong>M</strong> Master Equation</li>

<li><strong>C</strong> Canon</li>

<li><strong>G</strong> Knowledge Graph</li>

<li><strong>T</strong> Top of page</li>

<li><strong>/</strong> Search</li>

<li><strong>Ctrl/Cmd + K</strong> Command Palette</li>

</ul>

<form method="dialog">

<button>Close</button>

</form>

`;

        document.body.appendChild(help);

    }

    help.showModal();

}

/* ===========================================================
   Footer Metadata
=========================================================== */

function initFooter() {

    const year = document.querySelector("#footer-year");

    if (year) {

        year.textContent =
            new Date().getFullYear();

    }

    const updated = document.querySelector("#last-updated");

    if (updated) {

        updated.textContent =
            new Date().toLocaleDateString();

    }

}

/* ===========================================================
   Performance
=========================================================== */

function initPerformance() {

    if ("requestIdleCallback" in window) {

        requestIdleCallback(() => {

            document.body.classList.add(
                "idle-ready"
            );

        });

    }

}

/* ===========================================================
   Resize Handling
=========================================================== */

function initResizeWatcher() {

    let timeout;

    window.addEventListener("resize", () => {

        clearTimeout(timeout);

        timeout = setTimeout(() => {

            document.body.classList.add(
                "resized"
            );

            setTimeout(() => {

                document.body.classList.remove(
                    "resized"
                );

            }, 300);

        }, 100);

    });

}

/* ===========================================================
   Scroll Position Restore
=========================================================== */

function initScrollRestore() {

    if ("scrollRestoration" in history) {

        history.scrollRestoration = "manual";

    }

}

/* ===========================================================
   Startup
=========================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initNavigation();

        initSearch();

        initEquationTools();

        initCollapsibleCards();

        initCommandPalette();

        initPageSearch();

        initReadingModes();

        initTimeline();

        initKnowledgeGraph();

        initCanonProgress();

        initEquationExpansion();

        initCanonCards();

        initReflection();

        initAnchors();

        initAmbientEffects();

        initReadingTime();

        initKeyboardShortcuts();

        initFooter();

        initPerformance();

        initResizeWatcher();

        initScrollRestore();

        console.info(
            "%cScroll of Fire — Theory Loaded",
            "color:#79d6ff;font-weight:bold;"
        );

    }
);
