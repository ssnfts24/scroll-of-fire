(function () {
  "use strict";

  const siteApi = window.ScrollOfFire || {};
  const calendar = window.SOFCalendar || {};

  const STORAGE = {
    lastVisit: "sof.codex.last-visit.v1",
    lastGate: "sof.codex.last-gate.v1",
    ledger: "scroll_of_fire_witness_ledger_v3",
    moonLogs: "sof_moon_logs_v3",
    caravanNotes: "covenant-caravan.notes",
    theorySettings: "sof.theory.settings.v3",
    frequencyJournal: "sof_frequency_governance_journal_v2",
    moonTimezone: "sof_moons_tz_v2",
    moonBoundary: "sof_moons_boundary_v1"
  };

  const GATES = {
    "/moons.html": { label: "13 Moons", href: "./moons.html" },
    "/ledger.html": { label: "Witness Ledger", href: "./ledger.html" },
    "/hub.html": { label: "Systems Hub", href: "./hub.html" },
    "/shop.html": { label: "Artifact Registry", href: "./shop.html" },
    "/covenant-caravan.html": { label: "Covenant Caravan", href: "./covenant-caravan.html" },
    "/theory.html": { label: "Theory / Canon", href: "./theory.html" },
    "/systems/frequencies.html": { label: "Frequency Governance", href: "./systems/frequencies.html" }
  };

  const DAYPART_COPY = {
    Dawn: {
      eyebrow: "Dawn Signal · The field is opening.",
      guidance: "Begin with breath, intention, and today’s moon.",
      actionLabel: "Open Today",
      actionHref: "./moons.html",
      signal: "Opening Field"
    },
    Day: {
      eyebrow: "Day Signal · The field is active.",
      guidance: "Build, record, and move one pattern into form.",
      actionLabel: "Open the Hub",
      actionHref: "./hub.html",
      signal: "Active Field"
    },
    Dusk: {
      eyebrow: "Dusk Signal · The field is settling.",
      guidance: "Review what changed and record the witness.",
      actionLabel: "Record Witness",
      actionHref: "./ledger.html",
      signal: "Witness Field"
    },
    Night: {
      eyebrow: "Night Signal · The field is quiet.",
      guidance: "Return, reflect, and preserve what the day revealed.",
      actionLabel: "Return to Theory",
      actionHref: "./theory.html",
      signal: "Quiet Field"
    }
  };

  const DEFAULT_BREATH = "Inhale 4 · Hold 2 · Exhale 6 · Return";
  const TODAY_PANEL_FALLBACK = "Notice what is moving, breathe once with attention, and record one clear line.";

  let moonCatalog = [];
  let recentUpdates = [];
  let moonRenderDetail = null;
  let refreshTimer = null;

  function normalizePath(path) {
    if (typeof siteApi.normalizePath === "function") {
      return siteApi.normalizePath(path);
    }

    let normalized = String(path || "")
      .split("#")[0]
      .split("?")[0]
      .replace(/\/+$/g, "")
      .replace(/\/+/g, "/");

    if (normalized.startsWith("/scroll-of-fire")) {
      normalized = normalized.replace(/^\/scroll-of-fire/, "");
    }

    return normalized || "/";
  }

  function safeReadJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function safeWriteJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function safeReadString(key) {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function safeWriteString(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (_) {
      return false;
    }
  }

  function prefersReducedMotion() {
    if (typeof siteApi.prefersReducedMotion === "function") {
      return siteApi.prefersReducedMotion();
    }

    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  }

  function getNow() {
    return new Date();
  }

  function getDaypart(now) {
    if (typeof calendar.daypart === "function") {
      return calendar.daypart(now);
    }

    const hour = (now || getNow()).getHours();
    if (hour >= 5 && hour < 10) return "Dawn";
    if (hour >= 10 && hour < 17) return "Day";
    if (hour >= 17 && hour < 21) return "Dusk";
    return "Night";
  }

  function getCurrentPath() {
    return normalizePath(window.location.pathname);
  }

  function getCurrentGate() {
    const path = getCurrentPath();
    const known = GATES[path];

    if (!known) return null;

    return {
      path: path,
      label: known.label,
      title: known.label,
      href: known.href,
      timestamp: new Date().toISOString()
    };
  }

  function readGateRecord() {
    const record = safeReadJSON(STORAGE.lastGate, null);
    if (!record || typeof record !== "object") return null;
    if (!record.path || !record.title) return null;
    return record;
  }

  function readLastVisit() {
    const value = safeReadString(STORAGE.lastVisit);
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatTime(now) {
    if (typeof calendar.formatLocalTime === "function") {
      return calendar.formatLocalTime(now);
    }

    return new Intl.DateTimeFormat([], {
      hour: "numeric",
      minute: "2-digit"
    }).format(now || getNow());
  }

  function formatRelativeDate(date) {
    if (!(date instanceof Date)) return "";

    const now = getNow();
    const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startThen = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((startNow - startThen) / 86400000);

    if (diffDays === 0) return "earlier today";
    if (diffDays === 1) return "yesterday";
    if (diffDays > 1 && diffDays < 7) return diffDays + " days ago";

    return new Intl.DateTimeFormat([], {
      month: "short",
      day: "numeric",
      year: date.getFullYear() === now.getFullYear() ? undefined : "numeric"
    }).format(date);
  }

  function todayISO() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof calendar.todayISO === "function") {
      return calendar.todayISO(tz);
    }

    const now = getNow();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("-");
  }

  function getMoonCycle() {
    if (moonRenderDetail && moonRenderDetail.info) {
      const detail = moonRenderDetail;
      return {
        iso: detail.effectiveISO || detail.civilISO || todayISO(),
        moon: detail.info.inside ? detail.info.moon.idx : null,
        moonName: detail.info.moon?.name || "Outside Count",
        moonEssence: detail.info.moon?.essence || "Outside counted cycle",
        day: detail.info.dayInMoon,
        week: detail.info.dayInMoon ? Math.floor((detail.info.dayInMoon - 1) / 7) + 1 : null,
        toneName: detail.dayArch?.[0] || detail.week?.[0] || "Witness",
        label: detail.info.inside
          ? "Moon " + detail.info.moon.idx + " · Day " + detail.info.dayInMoon
          : detail.info.moon?.name || "Outside Count"
      };
    }

    if (typeof calendar.get13Moon === "function") {
      return calendar.get13Moon(todayISO(), Intl.DateTimeFormat().resolvedOptions().timeZone);
    }

    return null;
  }

  function getMoonPhase() {
    if (moonRenderDetail && typeof moonRenderDetail.phase === "string") {
      return {
        name: moonRenderDetail.phase,
        illumination: moonRenderDetail.illumination
      };
    }

    if (typeof calendar.getMoonPhase === "function") {
      return calendar.getMoonPhase(todayISO());
    }

    return null;
  }

  function getMoonCatalogEntry(moonCycle) {
    if (!moonCycle || !moonCycle.moon) return null;
    return moonCatalog.find(function (entry) {
      return Number(entry.idx) === Number(moonCycle.moon);
    }) || null;
  }

  function getWitnessSummary() {
    const ledger = safeReadJSON(STORAGE.ledger, []);
    const moonLogs = safeReadJSON(STORAGE.moonLogs, []);
    const caravanNotes = safeReadJSON(STORAGE.caravanNotes, []);
    const frequencyJournal = safeReadJSON(STORAGE.frequencyJournal, []);

    return {
      ledger: Array.isArray(ledger) ? ledger.length : 0,
      moonLogs: Array.isArray(moonLogs) ? moonLogs.length : 0,
      caravanNotes: Array.isArray(caravanNotes) ? caravanNotes.length : 0,
      frequencyJournal: Array.isArray(frequencyJournal) ? frequencyJournal.length : 0,
      total:
        (Array.isArray(ledger) ? ledger.length : 0) +
        (Array.isArray(moonLogs) ? moonLogs.length : 0) +
        (Array.isArray(caravanNotes) ? caravanNotes.length : 0) +
        (Array.isArray(frequencyJournal) ? frequencyJournal.length : 0)
    };
  }

  function getPreferences() {
    return {
      theory: safeReadJSON(STORAGE.theorySettings, null),
      moonTimezone: safeReadString(STORAGE.moonTimezone),
      moonBoundary: safeReadString(STORAGE.moonBoundary)
    };
  }

  function getRecentUpdatesSummary() {
    return recentUpdates.slice(0, 5);
  }

  function getHomeAction(daypart) {
    return DAYPART_COPY[daypart] || DAYPART_COPY.Day;
  }

  function getWitnessPrompt(moonCycle, moonEntry) {
    if (moonEntry && Array.isArray(moonEntry.practice) && moonEntry.practice.length) {
      const index = moonCycle && typeof moonCycle.day === "number" ? (moonCycle.day - 1) % moonEntry.practice.length : 0;
      return moonEntry.practice[index];
    }

    return TODAY_PANEL_FALLBACK;
  }

  function getSystemConnection(state) {
    if (state.daypart === "Dawn") return "13 Moons → Ledger";
    if (state.daypart === "Day") return "Hub → Frequency → Ledger";
    if (state.daypart === "Dusk") return "Artifacts → Ledger";
    return "Theory → Ledger";
  }

  function buildState() {
    const now = getNow();
    const daypart = getDaypart(now);
    const moonCycle = getMoonCycle();
    const moonEntry = getMoonCatalogEntry(moonCycle);
    const phase = getMoonPhase();
    const witness = getWitnessSummary();
    const currentGate = getCurrentGate();
    const lastGate = readGateRecord();
    const lastVisit = readLastVisit();
    const action = getHomeAction(daypart);

    return {
      now: now,
      isoDate: todayISO(),
      localTime: formatTime(now),
      daypart: daypart,
      moon: moonCycle
        ? {
            moon: moonCycle.moon,
            moonName: moonEntry?.name || moonCycle.moonName,
            moonEssence: moonEntry?.essence || moonCycle.moonEssence,
            day: moonCycle.day,
            week: moonCycle.week,
            toneName: moonCycle.toneName,
            label: moonCycle.label,
            phase: phase?.name || null,
            illumination: typeof phase?.illumination === "number" ? phase.illumination : null
          }
        : null,
      currentGate: currentGate,
      lastGate: lastGate,
      lastVisit: lastVisit,
      witnessCount: witness.total,
      witnessBreakdown: witness,
      recentUpdates: getRecentUpdatesSummary(),
      motionAllowed: !prefersReducedMotion(),
      preferences: getPreferences(),
      symbolicLayer: moonEntry?.essence || moonCycle?.moonEssence || null,
      witnessPrompt: getWitnessPrompt(moonCycle, moonEntry),
      breathingPattern: DEFAULT_BREATH,
      recommendedAction: {
        label: action.actionLabel,
        href: action.actionHref
      },
      signalLabel: action.signal,
      systemConnection: getSystemConnection({ daypart: daypart })
    };
  }

  function exposeState(state) {
    window.CodexState = state;
    document.dispatchEvent(
      new CustomEvent("sof:codex-state", {
        detail: state
      })
    );
  }

  function saveReturnState(state) {
    safeWriteString(STORAGE.lastVisit, state.now.toISOString());
    if (state.currentGate) {
      safeWriteJSON(STORAGE.lastGate, {
        path: state.currentGate.path,
        title: state.currentGate.title,
        label: state.currentGate.label,
        href: state.currentGate.href,
        timestamp: state.now.toISOString()
      });
    }

    /* Phase 2 — record visit in CodexMemory */
    if (window.CodexMemory && typeof window.CodexMemory.recordVisit === "function") {
      try {
        const gate = state.currentGate;
        if (gate && gate.path) {
          window.CodexMemory.recordVisit({
            title:   gate.title || gate.label,
            path:    gate.href  || gate.path,
            chamber: gate.label || gate.title
          });
        } else {
          window.CodexMemory.update({ lastVisitAt: state.now.toISOString() });
        }
      } catch (_) {}
    }
  }

  function renderSignalBar(state) {
    document.querySelectorAll("[data-living-signal-root]").forEach(function (root) {
      const items = [];
      const ext = window.CodexState || {};

      // Compact living day line: ☾ Moon Name · Day X/28 | Phase | Gate | Field
      const moonNum  = (state.moon && state.moon.moon) || ext.moonNumber;
      const moonDay  = (state.moon && state.moon.day)  || ext.moonDay;
      const moonNameText = (state.moon && state.moon.moonName) || ext.moonName || "";
      const phaseText    = (state.moon && state.moon.phase)    || ext.phaseName || "";
      const weekGateText = ext.weekGate || "";
      const freqText     = ext.suggestedFrequency ? ext.suggestedFrequency.split(" · ")[1] || ext.suggestedFrequency : "";

      if (moonNum && moonDay) {
        let compact = "☾ " + moonNameText + " · Day " + moonDay + "/28";
        if (phaseText)    compact += " | " + phaseText;
        if (weekGateText) compact += " | " + weekGateText;
        if (freqText)     compact += " | Field: " + freqText;
        items.push({ text: compact, href: "./moons.html" });
      } else {
        // Fallback when moon data not yet ready
        if (state.moon && state.moon.moon && state.moon.day) {
          let moonLabel = "☾ Moon " + state.moon.moon;
          if (state.moon.moonName) moonLabel += " · " + state.moon.moonName;
          moonLabel += " · Day " + state.moon.day + "/28";
          if (state.moon.phase) moonLabel += " | " + state.moon.phase;
          items.push({ text: moonLabel, href: "./moons.html" });
        }
      }

      items.push({ text: state.daypart + " · " + state.localTime });

      if (state.witnessCount) {
        items.push({ text: "Ξ " + state.witnessCount + " records", href: "./ledger.html" });
      }

      if (state.lastGate && state.lastGate.title) {
        items.push({ text: "Last: " + state.lastGate.title, href: state.lastGate.href });
      }

      root.innerHTML = items
        .map(function (item) {
          if (item.href) {
            return '<li class="living-signal-item"><a class="living-signal-link" href="' + escapeAttribute(item.href) + '">' + escapeHTML(item.text) + "</a></li>";
          }
          return '<li class="living-signal-item">' + escapeHTML(item.text) + "</li>";
        })
        .join("");
    });
  }

  function renderHomeState(state) {
    const root = document.documentElement;
    if (!root || !root.classList.contains("home-page")) return;

    root.setAttribute("data-codex-daypart", state.daypart.toLowerCase());
    root.setAttribute("data-codex-motion", state.motionAllowed ? "on" : "off");
    if (!state.lastVisit) {
      root.setAttribute("data-codex-first-visit", "true");
    }

    const daypartCopy = getHomeAction(state.daypart);
    setText("[data-home-eyebrow]", daypartCopy.eyebrow);
    setText("[data-home-guidance]", daypartCopy.guidance);
    setText("[data-home-signal]", state.signalLabel + " · " + state.systemConnection);
    setText("[data-home-notice]", state.lastVisit ? "Last visit: " + formatRelativeDate(state.lastVisit) + "." : "First return in this browser. Begin with Start Here or open Today.");

    const heroAction = document.querySelector("[data-home-action]");
    if (heroAction) {
      heroAction.textContent = daypartCopy.actionLabel;
      heroAction.setAttribute("href", daypartCopy.actionHref);
    }

    const moonName = (state.moon && state.moon.moonName) || "";
    setText("[data-codex-today-title]", state.moon && state.moon.moon
      ? "Moon " + state.moon.moon + " · " + (moonName || "Day " + state.moon.day)
      : "Today in the Codex");
    setText("[data-codex-today-layer]", state.symbolicLayer || "Witness the present field.");
    setText("[data-codex-today-phase]", state.moon?.phase || "Moon phase becomes visible inside the 13 Moons gate.");
    setText("[data-codex-today-prompt]", state.witnessPrompt || TODAY_PANEL_FALLBACK);
    setText("[data-codex-today-breath]", state.breathingPattern);
    setText("[data-codex-today-action]", state.recommendedAction.label + " → " + state.systemConnection);

    const openToday = document.querySelector("[data-codex-open-today]");
    if (openToday) {
      openToday.setAttribute("href", "./moons.html?date=" + encodeURIComponent(state.isoDate));
    }

    // --- Living Day: calendar summary and extended fields from codex-state.js ---
    const ext = window.CodexState || {};
    const moonNum = (state.moon && state.moon.moon) || ext.moonNumber;
    const moonDay = (state.moon && state.moon.day)  || ext.moonDay;
    const yearDay = ext.yearDay || null;
    const weekGate = ext.weekGate || null;
    const shabbatLabel = ext.shabbatLabel || null;
    const shabbatCode = ext.shabbatState || null;
    const dailyMovement = ext.dailyMovement || null;
    const suggestedPath = ext.suggestedPath || null;
    const suggestedPathUrl = ext.suggestedPathUrl || null;
    const suggestedFrequency = ext.suggestedFrequency || null;

    const calSummary = document.querySelector("[data-codex-calendar-summary]");
    if (calSummary && moonNum) {
      calSummary.hidden = false;
      setText("[data-codex-moon-label]", "Moon " + moonNum + " · Day " + (moonDay || "—") + "/28");
      if (yearDay) setText("[data-codex-year-label]", "Day " + yearDay + "/364");
      if (weekGate) setText("[data-codex-week-gate]", weekGate);
    }

    // Shabbat state row (only show when not ordinary)
    const shabbatRow = document.querySelector("[data-codex-shabbat-row]");
    if (shabbatRow && shabbatCode && shabbatCode !== "ordinary" && shabbatLabel) {
      shabbatRow.hidden = false;
      setText("[data-codex-shabbat-label]", shabbatLabel);
    }

    // Daily movement row
    const movementRow = document.querySelector("[data-codex-movement-row]");
    if (movementRow && dailyMovement) {
      movementRow.hidden = false;
      setText("[data-codex-daily-movement]", dailyMovement);
    }

    // Suggested gate section
    const suggestedSection = document.querySelector("[data-codex-suggested]");
    if (suggestedSection && suggestedPath && suggestedPathUrl) {
      suggestedSection.hidden = false;

      const suggestedLink = document.querySelector("[data-codex-suggested-link]");
      if (suggestedLink) {
        suggestedLink.textContent = suggestedPath;
        suggestedLink.setAttribute("href", suggestedPathUrl);
      }

      if (suggestedFrequency) {
        setText("[data-codex-suggested-freq]", suggestedFrequency);
        const freqRow = document.querySelector("[data-codex-freq-row]");
        if (freqRow) freqRow.hidden = false;
      }

      const gateBtn = document.querySelector("[data-codex-gate-btn]");
      if (gateBtn) {
        gateBtn.setAttribute("href", suggestedPathUrl);
        const shortLabel = suggestedPath.replace(/^Open\s+/, "").replace(/^Read\s+/, "");
        gateBtn.textContent = "Open " + shortLabel;
        gateBtn.hidden = false;
      }

      const freqBtn = document.querySelector("[data-codex-freq-btn]");
      if (freqBtn && suggestedFrequency) {
        freqBtn.hidden = false;
      }
    }

    const continuePanel = document.querySelector("[data-codex-continue-panel]");
    if (continuePanel) {
      if (state.lastGate && state.lastGate.href && state.lastGate.title) {
        /* Phase 2 will render this panel; only set defaults if CodexMemory is absent */
        if (!window.CodexMemory) {
          continuePanel.hidden = false;
          setText("[data-codex-last-gate-title]", state.lastGate.title);
          setText(
            "[data-codex-last-gate-time]",
            state.lastGate.timestamp ? "Stored " + formatRelativeDate(new Date(state.lastGate.timestamp)) + "." : "Stored locally in this browser."
          );
          const returnLink = continuePanel.querySelector("[data-codex-return-link]");
          if (returnLink) {
            returnLink.setAttribute("href", state.lastGate.href);
            returnLink.textContent = "Return to " + state.lastGate.title;
          }
        }
      } else if (!window.CodexMemory) {
        continuePanel.hidden = true;
      }
    }

    renderActivityFeed(state.recentUpdates);
    renderYourCodexPanel(state);
    renderPhase2All(); /* Phase 2 */
  }

  function renderYourCodexPanel(state) {
    const panel = document.querySelector("[data-your-codex-panel]");
    if (!panel) return;

    const witness = state.witnessBreakdown || {};
    const total = state.witnessCount || 0;

    setText("[data-your-codex-count]", String(total));
    setText("[data-your-codex-moonlogs]", String(witness.moonLogs || 0));
    setText("[data-your-codex-freq]", String(witness.frequencyJournal || 0));

    // Last entry time from ledger
    try {
      const ledger = JSON.parse(localStorage.getItem(STORAGE.ledger) || "[]");
      if (Array.isArray(ledger) && ledger.length) {
        const latest = ledger[0];
        if (latest && latest.date) {
          const d = new Date(latest.date);
          setText("[data-your-codex-last]", formatRelativeDate(d) || d.toLocaleDateString());
        } else {
          setText("[data-your-codex-last]", "Entries exist.");
        }
      } else {
        setText("[data-your-codex-last]", "No entries yet.");
      }
    } catch (_) {
      setText("[data-your-codex-last]", "No entries yet.");
    }

    if (total > 0) {
      setText("[data-your-codex-heading]", total + (total === 1 ? " Witness Recorded" : " Witnesses Recorded"));
      setText("[data-your-codex-summary]", "Your local Codex is active. Open the Ledger to review or add entries.");
    }

    // Export all Codex data
    const exportBtn = panel.querySelector("[data-your-codex-export]");
    if (exportBtn && !exportBtn._sofExportBound) {
      exportBtn._sofExportBound = true;
      exportBtn.addEventListener("click", function () {
        const allData = {};
        try {
          Object.entries(STORAGE).forEach(function (pair) {
            const key = pair[0], storageKey = pair[1];
            try {
              const val = localStorage.getItem(storageKey);
              if (val !== null) allData[key] = JSON.parse(val);
            } catch (_) {
              try { allData[key] = localStorage.getItem(storageKey); } catch (_) {}
            }
          });
        } catch (_) {}

        const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "scroll-of-fire-codex-" + todayISO() + ".json";
        a.click();
        URL.revokeObjectURL(a.href);
      });
    }

    // Clear all Codex data
    const clearBtn = panel.querySelector("[data-your-codex-clear]");
    if (clearBtn && !clearBtn._sofClearBound) {
      clearBtn._sofClearBound = true;
      clearBtn.addEventListener("click", function () {
        const confirmed = window.confirm(
          "Clear all local Codex data from this browser?\n\nThis removes your witness entries, moon logs, frequency sessions, and saved paths. This cannot be undone unless you have an export."
        );
        if (!confirmed) return;
        try {
          Object.values(STORAGE).forEach(function (key) {
            localStorage.removeItem(key);
          });
        } catch (_) {}
        refresh();
      });
    }

    /* Phase 2 — memory controls */
    setupPhase2MemoryControls(panel);
  }

  /* ------------------------------------------------------------------ */
  /* Phase 2 — Codex Memory rendering                                    */
  /* ------------------------------------------------------------------ */

  function setupPhase2MemoryControls(panel) {
    if (!panel || !window.CodexMemory) return;

    /* View memory */
    const viewBtn = panel.querySelector("[data-memory-view]");
    if (viewBtn && !viewBtn._sofBound) {
      viewBtn._sofBound = true;
      viewBtn.addEventListener("click", function () {
        const statusEl = panel.querySelector("[data-codex-memory-status]");
        if (!statusEl) return;
        const isVisible = statusEl.classList.contains("is-visible");
        if (isVisible) {
          statusEl.classList.remove("is-visible");
          viewBtn.textContent = "View Memory";
          return;
        }
        const mem = window.CodexMemory.getState();
        const summary = [
          "Storage key: " + window.CodexMemory.storageKey,
          "Version: " + mem.version,
          "Last visit: " + (mem.lastVisitAt || "none"),
          "Last page: " + (mem.lastPage && mem.lastPage.title ? mem.lastPage.title : "none"),
          "Intention: " + (mem.dailyIntention ? mem.dailyIntention.value : "none"),
          "Practice: " + (mem.unfinishedPractice ? mem.unfinishedPractice.title + " [" + mem.unfinishedPractice.status + "]" : "none"),
          "Recent witness: " + (mem.recentWitness ? mem.recentWitness.label : "none"),
          "Recent frequency: " + (mem.recentFrequency ? mem.recentFrequency.presetName : "none"),
          "Witnessed days (this cycle): " + mem.currentCycle.witnessedDays.length,
          "Recent actions: " + mem.recentActions.length,
          "Storage available: " + window.CodexMemory.storageAvailable()
        ].join("\n");
        statusEl.innerHTML = "<pre>" + escapeHTML(summary) + "</pre>";
        statusEl.classList.add("is-visible");
        viewBtn.textContent = "Hide Memory";
      });
    }

    /* Export Phase 2 memory */
    const exportBtn = panel.querySelector("[data-memory-export]");
    if (exportBtn && !exportBtn._sofBound) {
      exportBtn._sofBound = true;
      exportBtn.addEventListener("click", function () {
        const data = window.CodexMemory.exportMemory();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "codex-memory-" + todayISO() + ".json";
        a.click();
        URL.revokeObjectURL(a.href);
      });
    }

    /* Import Phase 2 memory */
    const importBtn = panel.querySelector("[data-memory-import]");
    const importFile = panel.querySelector("[data-memory-import-file]");
    if (importBtn && importFile && !importBtn._sofBound) {
      importBtn._sofBound = true;
      importBtn.addEventListener("click", function () { importFile.click(); });
      importFile.addEventListener("change", async function () {
        const file = importFile.files && importFile.files[0];
        if (!file) return;
        try {
          const data = JSON.parse(await file.text());
          const ok = window.CodexMemory.importMemory(data);
          window.alert(ok ? "Codex Memory imported." : "Import failed: incompatible format.");
          if (ok) renderPhase2ContinuePanel();
        } catch (_) {
          window.alert("Import failed: could not parse the file.");
        }
        importFile.value = "";
      });
    }

    /* Clear intention only */
    const clearIntBtn = panel.querySelector("[data-memory-clear-intention]");
    if (clearIntBtn && !clearIntBtn._sofBound) {
      clearIntBtn._sofBound = true;
      clearIntBtn.addEventListener("click", function () {
        if (!window.confirm("Clear your saved intention? This will not affect witness logs or saved readings.")) return;
        window.CodexMemory.clearIntention();
        renderPhase2IntentionSelector();
      });
    }

    /* Clear practice only */
    const clearPracBtn = panel.querySelector("[data-memory-clear-practice]");
    if (clearPracBtn && !clearPracBtn._sofBound) {
      clearPracBtn._sofBound = true;
      clearPracBtn.addEventListener("click", function () {
        if (!window.confirm("Clear the unfinished practice? This will not affect witness logs or saved readings.")) return;
        window.CodexMemory.clearPractice();
        renderPhase2ContinuePanel();
      });
    }

    /* Reset all Phase 2 memory */
    const resetBtn = panel.querySelector("[data-memory-reset]");
    if (resetBtn && !resetBtn._sofBound) {
      resetBtn._sofBound = true;
      resetBtn.addEventListener("click", function () {
        if (!window.confirm(
          "Reset all Phase 2 Codex Memory?\n\nThis clears:\n" +
          "· Daily intention\n· Unfinished practice\n· Recent witness reference\n" +
          "· Recent frequency reference\n· Visited pages\n· 7-day activity\n\n" +
          "Your witness ledger entries, moon logs, and saved readings are NOT affected."
        )) return;
        window.CodexMemory.resetAll();
        renderPhase2ContinuePanel();
        renderPhase2IntentionSelector();
      });
    }
  }

  function renderPhase2ContinuePanel() {
    if (!window.CodexMemory) return;

    const mem = window.CodexMemory.getState();
    const continuePanel = document.querySelector("[data-codex-continue-panel]");
    if (!continuePanel) return;

    /* Dismiss state */
    if (window.CodexMemory.isResumeDismissed()) {
      continuePanel.hidden = true;
      return;
    }

    const resume = window.CodexMemory.getResumePath();
    const hasLastGate = readGateRecord();
    const hasAnyMemory = resume || (mem.lastVisitAt && (
      mem.dailyIntention || mem.unfinishedPractice || mem.recentWitness || mem.recentFrequency
    ));

    /* Show panel only when there is confirmed stored activity */
    if (!hasAnyMemory && !hasLastGate) {
      continuePanel.hidden = true;
      return;
    }

    continuePanel.hidden = false;

    /* Heading — use memory-aware text */
    const titleEl = continuePanel.querySelector("[data-codex-last-gate-title]");
    if (titleEl) {
      const lastPage = mem.lastPage;
      if (resume && resume.type === "practice") {
        titleEl.textContent = "Your practice is unfinished.";
      } else if (lastPage && lastPage.title) {
        titleEl.textContent = "Welcome back. You were last in " + lastPage.title + ".";
      } else if (hasLastGate) {
        titleEl.textContent = hasLastGate.title
          ? "Welcome back. You were last in " + hasLastGate.title + "."
          : "Welcome back.";
      } else {
        titleEl.textContent = "Welcome back.";
      }
    }

    /* Time */
    const timeEl = continuePanel.querySelector("[data-codex-last-gate-time]");
    if (timeEl) {
      const lastVisit = mem.lastVisitAt ? new Date(mem.lastVisitAt) : (hasLastGate && hasLastGate.timestamp ? new Date(hasLastGate.timestamp) : null);
      timeEl.textContent = lastVisit ? "Last visit: " + formatRelativeDate(lastVisit) + "." : "Stored locally in this browser.";
    }

    /* Unfinished practice row */
    const practiceRow = continuePanel.querySelector("[data-codex-practice-row]");
    const p = mem.unfinishedPractice;
    if (practiceRow) {
      const isActive = p && (p.status === "started" || p.status === "paused");
      practiceRow.hidden = !isActive;
      if (isActive) {
        setText("[data-codex-practice-title]", p.title);
        const contLink = practiceRow.querySelector("[data-codex-practice-continue]");
        if (contLink && p.sourcePage) {
          contLink.setAttribute("href", safeHref(p.sourcePage));
        }
        bindOnce(practiceRow.querySelector("[data-codex-practice-complete]"), "click", function () {
          window.CodexMemory.updatePracticeStatus("completed");
          renderPhase2ContinuePanel();
        });
        bindOnce(practiceRow.querySelector("[data-codex-practice-dismiss]"), "click", function () {
          window.CodexMemory.updatePracticeStatus("dismissed");
          renderPhase2ContinuePanel();
        });
      }
    }

    /* Return link */
    const returnLink = continuePanel.querySelector("[data-codex-return-link]");
    if (returnLink) {
      const href = (resume && resume.href) || (hasLastGate && hasLastGate.href) || "./hub.html";
      const label = (resume && ("Return to " + resume.label)) ||
        (hasLastGate && hasLastGate.title ? "Return to " + hasLastGate.title : "Return");
      returnLink.setAttribute("href", safeHref(href));
      returnLink.textContent = label;
    }

    /* What changed since last visit */
    const sinceEl = continuePanel.querySelector("[data-codex-since-visit]");
    const sinceList = continuePanel.querySelector("[data-codex-since-visit-list]");
    if (sinceEl && sinceList && mem.lastVisitAt) {
      const changes = window.CodexMemory.getChangesSinceLastVisit(window.CodexState || {});
      if (changes.length) {
        sinceEl.hidden = false;
        sinceList.innerHTML = changes.map(function (c) {
          return "<li>" + escapeHTML(c) + "</li>";
        }).join("");
      } else {
        sinceEl.hidden = true;
      }
    }

    /* 7-day summary */
    renderPhase2SevenDay(continuePanel);

    /* Dismiss button */
    const dismissBtn = continuePanel.querySelector("[data-codex-resume-dismiss]");
    bindOnce(dismissBtn, "click", function () {
      window.CodexMemory.dismissResumeToday();
      continuePanel.hidden = true;
    });
  }

  function renderPhase2SevenDay(container) {
    if (!window.CodexMemory) return;
    const wrapper = container && container.querySelector("[data-codex-seven-day]");
    const markersEl = container && container.querySelector("[data-codex-seven-day-markers]");
    const altEl = container && container.querySelector("[data-codex-seven-day-alt]");
    if (!wrapper || !markersEl) return;

    const summary = window.CodexMemory.getSevenDaySummary();
    const activeDays = summary.filter(function (d) { return d.hasActivity; }).length;

    if (activeDays === 0) {
      wrapper.hidden = true;
      return;
    }

    wrapper.hidden = false;

    const today = new Date();
    const DAY_ABBR = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

    markersEl.innerHTML = summary.map(function (day, i) {
      const d = new Date(day.isoDate + "T12:00:00");
      const abbr = DAY_ABBR[d.getDay()];
      const isToday = i === summary.length - 1;

      /* Build pip indicators */
      var pips = "";
      if (day.hasIntention)  pips += '<span class="day-pip" data-type="intention" title="Intention"></span>';
      if (day.hasWitness)    pips += '<span class="day-pip" data-type="witness"   title="Witness"></span>';
      if (day.hasFrequency)  pips += '<span class="day-pip" data-type="frequency" title="Frequency"></span>';
      if (day.hasPractice)   pips += '<span class="day-pip" data-type="practice"  title="Practice"></span>';
      if (!pips)             pips += '<span class="day-pip" title="No activity"></span>';

      /* Dot symbol */
      const fullActivity = day.hasWitness && day.hasIntention;
      const dotState = fullActivity ? "full" : (day.hasActivity ? "partial" : "none");
      const dotSymbol = dotState === "full" ? "●" : (dotState === "partial" ? "◐" : "○");

      return [
        '<div class="codex-seven-day-marker' + (isToday ? " is-today" : "") + '"',
        ' role="gridcell" aria-label="' + escapeAttribute(d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) + (day.hasActivity ? ": activity recorded" : ": no activity")) + '">',
        '<span class="day-label">' + escapeHTML(abbr) + "</span>",
        '<span class="day-dot" data-state="' + dotState + '" aria-hidden="true">' + dotSymbol + "</span>",
        '<span class="day-pips" aria-hidden="true">' + pips + "</span>",
        "</div>"
      ].join("");
    }).join("");

    if (altEl) {
      altEl.textContent = activeDays + " of the last 7 days " +
        (activeDays === 1 ? "contains" : "contain") + " saved activity.";
    }
  }

  function renderPhase2IntentionSelector() {
    if (!window.CodexMemory) return;

    const row = document.querySelector("[data-codex-intention-row]");
    if (!row) return;

    const intent = window.CodexMemory.getIntention();
    const displayEl = row.querySelector("[data-codex-intention-display]");
    const valueEl   = row.querySelector("[data-codex-intention-value]");
    const priorEl   = row.querySelector("[data-codex-intention-prior]");
    const picker    = row.querySelector("[data-codex-intention-picker]");

    /* Update display */
    if (displayEl && valueEl) {
      if (intent) {
        displayEl.hidden = false;
        valueEl.textContent = intent.value.charAt(0).toUpperCase() + intent.value.slice(1);
        if (priorEl) priorEl.hidden = !intent.isPriorDay;
      } else {
        displayEl.hidden = true;
      }
    }

    /* Update picker buttons */
    if (picker) {
      picker.querySelectorAll("button[data-intention]").forEach(function (btn) {
        const active = intent && btn.dataset.intention === intent.value;
        btn.setAttribute("aria-pressed", active ? "true" : "false");
        btn.classList.toggle("is-active", !!active);
      });
    }
  }

  function setupPhase2IntentionPicker() {
    const row = document.querySelector("[data-codex-intention-row]");
    if (!row || !window.CodexMemory) return;

    row.addEventListener("click", function (event) {
      const btn = event.target.closest("button[data-intention]");
      if (btn) {
        window.CodexMemory.setIntention(btn.dataset.intention);
        renderPhase2IntentionSelector();
        return;
      }
      const clearBtn = event.target.closest("[data-codex-intention-clear]");
      if (clearBtn) {
        window.CodexMemory.clearIntention();
        renderPhase2IntentionSelector();
      }
    });
  }

  function bindOnce(el, event, fn) {
    if (!el || el._sofBound2) return;
    el._sofBound2 = true;
    el.addEventListener(event, fn);
  }

  function renderPhase2All() {
    renderPhase2ContinuePanel();
    renderPhase2IntentionSelector();
  }

  function renderActivityFeed(updates) {
    const list = document.querySelector("[data-codex-activity-list]");
    const empty = document.querySelector("[data-codex-activity-empty]");
    if (!list) return;

    if (!updates.length) {
      list.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;

    list.innerHTML = updates.slice(0, 5).map(function (item) {
      const href = item.url || "./hub.html";
      const symbol = item.symbol || "☲";
      const type = item.type || "update";
      const summary = item.summary || "";
      return [
        '<li class="codex-activity-item">',
        '  <a class="codex-activity-link" href="' + escapeAttribute(href) + '">',
        '    <span class="codex-activity-symbol" aria-hidden="true">' + escapeHTML(symbol) + "</span>",
        '    <span class="codex-activity-body">',
        '      <span class="codex-activity-meta">' + escapeHTML(formatUpdateDate(item.date) + " · " + typeLabel(type)) + "</span>",
        '      <strong>' + escapeHTML(item.title || "Codex update") + "</strong>",
        '      <span>' + escapeHTML(summary) + "</span>",
        "    </span>",
        "  </a>",
        "</li>"
      ].join("");
    }).join("");
  }

  function formatUpdateDate(date) {
    if (!date) return "Undated";
    const value = new Date(date + "T12:00:00");
    if (Number.isNaN(value.getTime())) return String(date);
    return new Intl.DateTimeFormat([], {
      month: "short",
      day: "numeric",
      year: value.getFullYear() === new Date().getFullYear() ? undefined : "numeric"
    }).format(value);
  }

  function typeLabel(type) {
    return String(type || "update")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, function (letter) {
        return letter.toUpperCase();
      });
  }

  function setText(selector, value) {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  }

  function safeHref(url) {
    /* Parse the URL to strip any dangerous scheme such as javascript: or data: */
    try {
      var parsed = new URL(String(url || ""), "https://codexofreality.org/");
      if (parsed.origin === "https://codexofreality.org") {
        return parsed.pathname + parsed.search + parsed.hash;
      }
    } catch (_) {}
    return "./";
  }

  function escapeHTML(value) {
    return String(value || "").replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[char];
    });
  }

  function escapeAttribute(value) {
    return escapeHTML(value).replace(/`/g, "&#096;");
  }

  async function loadMoonCatalog() {
    if (moonCatalog.length) return moonCatalog;

    try {
      const response = await fetch(new URL("assets/data/moons.json", document.baseURI).href, {
        credentials: "same-origin"
      });
      if (!response.ok) return moonCatalog;
      const data = await response.json();
      moonCatalog = Array.isArray(data) ? data : [];
    } catch (_) {}

    return moonCatalog;
  }

  async function loadRecentUpdates() {
    try {
      const response = await fetch(new URL("assets/data/codex-updates.json", document.baseURI).href, {
        credentials: "same-origin"
      });
      if (!response.ok) {
        recentUpdates = [];
        return recentUpdates;
      }

      const data = await response.json();
      recentUpdates = Array.isArray(data)
        ? data
            .filter(function (item) {
              return item && item.date && item.title;
            })
            .sort(function (a, b) {
              return String(b.date).localeCompare(String(a.date));
            })
        : [];
    } catch (_) {
      recentUpdates = [];
    }

    return recentUpdates;
  }

  async function refresh() {
    await Promise.all([loadMoonCatalog(), loadRecentUpdates()]);
    const state = buildState();
    exposeState(state);
    renderSignalBar(state);
    renderHomeState(state);
    saveReturnState(state);
    return state;
  }

  function scheduleRefresh() {
    if (refreshTimer) return;
    refreshTimer = window.setInterval(refresh, 60000);
  }

  function setupMoonListener() {
    document.addEventListener("sof:moon-render", function (event) {
      moonRenderDetail = event.detail || null;
      refresh();
    });
  }

  function setupPathReset() {
    document.addEventListener("click", function (event) {
      const button = event.target.closest("[data-codex-clear-path]");
      if (!button) return;
      event.preventDefault();
      try {
        localStorage.removeItem(STORAGE.lastGate);
      } catch (_) {}
      refresh();
    });
  }

  function setupLifecycle() {
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) refresh();
    });

    window.addEventListener("pageshow", function () {
      refresh();
    });
  }

  function renderLivingDayPanel() {
    const panel = document.querySelector("[data-living-day-content]");
    if (!panel) return;

    const ext = window.CodexState || {};

    let html = "";

    if (ext.moonNumber && ext.moonName) {
      html += '<p class="ld-moon-heading">' + escapeHTML(ext.moonName) + "</p>";
      const dayLine = "Moon " + ext.moonNumber + " · Day " + (ext.moonDay || "—") + "/28"
        + (ext.yearDay ? " · Day " + ext.yearDay + "/364" : "");
      html += '<p class="ld-moon-line">' + escapeHTML(dayLine) + "</p>";
      if (ext.weekGate) {
        html += '<p class="ld-gate">' + escapeHTML(ext.weekGate) + "</p>";
      }
      if (ext.phaseName) {
        html += '<p class="ld-phase">' + escapeHTML(ext.phaseName) + "</p>";
      }
      if (ext.shabbatState && ext.shabbatState !== "ordinary" && ext.shabbatLabel) {
        html += '<p class="ld-shabbat">' + escapeHTML(ext.shabbatLabel) + "</p>";
      }
    } else {
      html += '<p class="ld-moon-line">Calculating today\'s moon state…</p>';
    }

    if (ext.dailyMovement) {
      html += '<p class="ld-movement"><strong>Today\'s movement:</strong> ' + escapeHTML(ext.dailyMovement) + "</p>";
    }

    if (ext.suggestedPath && ext.suggestedPathUrl) {
      html += '<p class="ld-suggested"><strong>Suggested gate:</strong> <a href="' + escapeAttribute(ext.suggestedPathUrl) + '">' + escapeHTML(ext.suggestedPath) + "</a></p>";
    }

    if (ext.suggestedFrequency) {
      html += '<p class="ld-freq"><strong>Suggested field:</strong> ' + escapeHTML(ext.suggestedFrequency) + "</p>";
    }

    html += '<p class="ld-moons-link"><a href="./moons.html">Open 13 Moons →</a></p>';

    panel.innerHTML = html;
  }

  function setupLivingDayPanel() {
    document.addEventListener("click", function (event) {
      const toggle = event.target.closest("[data-living-day-toggle]");
      const close  = event.target.closest("[data-living-day-close]");
      const panel  = document.querySelector("[data-living-day-panel]");

      if (toggle && panel) {
        const isExpanded = toggle.getAttribute("aria-expanded") === "true";
        const willExpand = !isExpanded;
        toggle.setAttribute("aria-expanded", String(willExpand));
        panel.hidden = !willExpand;
        if (willExpand) {
          renderLivingDayPanel();
          /* Move focus into panel for keyboard users */
          const firstFocusable = panel.querySelector("a[href], button");
          if (firstFocusable) firstFocusable.focus();
        }
        return;
      }

      if (close && panel) {
        panel.hidden = true;
        const toggle2 = document.querySelector("[data-living-day-toggle]");
        if (toggle2) {
          toggle2.setAttribute("aria-expanded", "false");
          toggle2.focus();
        }
      }
    });

    /* Close panel on Escape */
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      const panel = document.querySelector("[data-living-day-panel]");
      if (!panel || panel.hidden) return;
      panel.hidden = true;
      const toggle = document.querySelector("[data-living-day-toggle]");
      if (toggle) {
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });

    /* Re-render panel content when codex state refreshes */
    document.addEventListener("codexstatechange", function () {
      const panel = document.querySelector("[data-living-day-panel]");
      if (panel && !panel.hidden) renderLivingDayPanel();
    });
  }

  function setupActivityToggle() {
    document.addEventListener("click", function (event) {
      const toggle = event.target.closest("[data-codex-activity-toggle]");
      if (!toggle) return;
      const content = document.querySelector("[data-codex-activity-content]");
      if (!content) return;
      const isExpanded = toggle.getAttribute("aria-expanded") === "true";
      const willExpand = !isExpanded;
      toggle.setAttribute("aria-expanded", String(willExpand));
      content.hidden = !willExpand;
    });
  }

  function setup() {
    refresh();
    scheduleRefresh();
    setupMoonListener();
    setupPathReset();
    setupLifecycle();
    setupLivingDayPanel();
    setupActivityToggle();
    setupPhase2IntentionPicker(); /* Phase 2 */

    /* Phase 2 — re-render on memory changes */
    document.addEventListener("codexmemorychange", function () {
      renderPhase2ContinuePanel();
      renderPhase2IntentionSelector();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
