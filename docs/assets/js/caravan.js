/* ==========================================================
   Scroll of Fire — Covenant Caravan
   Living Journey Engine
   Aaron Paul Laird • CodexOfReality.org
   ========================================================== */

(() => {
  "use strict";

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

  const STORAGE = {
    phase: "covenant-caravan.phase",
    notes: "covenant-caravan.notes",
    progress: "covenant-caravan.progress"
  };

  /* ----------------------------------------------------------
     Mobile Navigation
  ---------------------------------------------------------- */

  const navToggle = $(".nav-toggle");
  const navMenu = $("#navMenu");

  if (navToggle && navMenu) {
    const closeMenu = () => {
      navMenu.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-open");
    };

    const openMenu = () => {
      navMenu.classList.add("open");
      navToggle.setAttribute("aria-expanded", "true");
      document.body.classList.add("nav-open");
    };

    navToggle.addEventListener("click", () => {
      navMenu.classList.contains("open") ? closeMenu() : openMenu();
    });

    $$("a", navMenu).forEach((link) => link.addEventListener("click", closeMenu));

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });
  }

  /* ----------------------------------------------------------
     Journey Phase Engine
  ---------------------------------------------------------- */

  const tabs = $$(".phase-tab");
  const panels = $$(".phase-panel");
  const progressBar = $(".journey-progress-bar");
  const progressText = $(".journey-progress-text");

  function setPanelState(activeId, focus = false) {
    tabs.forEach((tab) => {
      const active = tab.dataset.phase === activeId;

      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.setAttribute("tabindex", active ? "0" : "-1");

      if (focus && active) tab.focus();
    });

    panels.forEach((panel) => {
      const active = panel.id === activeId;

      panel.classList.toggle("active", active);
      panel.hidden = !active;
    });

    localStorage.setItem(STORAGE.phase, activeId);
    history.replaceState(null, "", `#${activeId}`);

    updateProgress(activeId);
  }

  function updateProgress(activeId) {
    const index = tabs.findIndex((tab) => tab.dataset.phase === activeId);
    if (index < 0) return;

    const percent = Math.round(((index + 1) / tabs.length) * 100);

    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressText) progressText.textContent = `Phase ${index + 1} of ${tabs.length} · ${percent}% aligned`;
  }

  if (tabs.length && panels.length) {
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => {
        setPanelState(tab.dataset.phase, true);
      });

      tab.addEventListener("keydown", (e) => {
        let next = index;

        if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % tabs.length;
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + tabs.length) % tabs.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = tabs.length - 1;
        else return;

        e.preventDefault();
        setPanelState(tabs[next].dataset.phase, true);
      });
    });

    const hash = location.hash.replace("#", "");
    const saved = localStorage.getItem(STORAGE.phase);

    const initial =
      tabs.find((tab) => tab.dataset.phase === hash)?.dataset.phase ||
      tabs.find((tab) => tab.dataset.phase === saved)?.dataset.phase ||
      tabs[0].dataset.phase;

    setPanelState(initial);
  }

  /* ----------------------------------------------------------
     Witness Log / Field Notes
  ---------------------------------------------------------- */

  const noteInput = $("#witnessNote");
  const noteSave = $("#saveWitnessNote");
  const noteClear = $("#clearWitnessNotes");
  const noteList = $("#witnessNotesList");

  function getNotes() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE.notes)) || [];
    } catch {
      return [];
    }
  }

  function saveNotes(notes) {
    localStorage.setItem(STORAGE.notes, JSON.stringify(notes));
  }

  function renderNotes() {
    if (!noteList) return;

    const notes = getNotes();

    noteList.innerHTML = "";

    if (!notes.length) {
      noteList.innerHTML = `<p class="muted">No witness notes recorded yet.</p>`;
      return;
    }

    notes
      .slice()
      .reverse()
      .forEach((note) => {
        const item = document.createElement("article");
        item.className = "witness-note";
        item.innerHTML = `
          <time datetime="${note.date}">${new Date(note.date).toLocaleString()}</time>
          <p>${escapeHTML(note.text)}</p>
        `;
        noteList.appendChild(item);
      });
  }

  if (noteInput && noteSave) {
    noteSave.addEventListener("click", () => {
      const text = noteInput.value.trim();
      if (!text) return;

      const notes = getNotes();

      notes.push({
        text,
        date: new Date().toISOString()
      });

      saveNotes(notes);

      noteInput.value = "";
      renderNotes();
    });
  }

  if (noteClear) {
    noteClear.addEventListener("click", () => {
      localStorage.removeItem(STORAGE.notes);
      renderNotes();
    });
  }

  renderNotes();

  /* ----------------------------------------------------------
     Checklist / Progress Memory
  ---------------------------------------------------------- */

  const checks = $$("[data-caravan-check]");

  function getProgress() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE.progress)) || {};
    } catch {
      return {};
    }
  }

  function saveProgress(progress) {
    localStorage.setItem(STORAGE.progress, JSON.stringify(progress));
  }

  if (checks.length) {
    const progress = getProgress();

    checks.forEach((check) => {
      const key = check.dataset.caravanCheck;

      check.checked = Boolean(progress[key]);

      check.addEventListener("change", () => {
        progress[key] = check.checked;
        saveProgress(progress);
      });
    });
  }

  /* ----------------------------------------------------------
     Daily Caravan Seal
  ---------------------------------------------------------- */

  const seal = $("#dailyCaravanSeal");

  if (seal) {
    const seals = [
      "Gather the tools. Name the road.",
      "Travel light. Carry what carries meaning.",
      "The craft feeds the caravan.",
      "The family is the first shelter.",
      "Water, fire, food, rest. Then movement.",
      "No road is holy without discipline.",
      "Build slowly enough to survive the journey."
    ];

    const day = new Date().getDay();
    seal.textContent = seals[day];
  }

  /* ----------------------------------------------------------
     Utility
  ---------------------------------------------------------- */

  function escapeHTML(value) {
    return value.replace(/[&<>"']/g, (char) => {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[char];
    });
  }
})();
