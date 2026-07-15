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
  }

  function renderSignalBar(state) {
    document.querySelectorAll("[data-living-signal-root]").forEach(function (root) {
      const items = [];

      // Primary moon indicator: Moon name · Day/28 · Phase
      if (state.moon && state.moon.moon && state.moon.day) {
        let moonLabel = "☾ Moon " + state.moon.moon;
        if (state.moon.moonName) moonLabel += " · " + state.moon.moonName;
        moonLabel += " · Day " + state.moon.day + "/28";
        if (state.moon.phase) moonLabel += " · " + state.moon.phase;
        items.push({ text: moonLabel, href: "./moons.html" });
      }

      items.push({ text: state.daypart + " Field · " + state.localTime });

      if (state.witnessCount) {
        items.push({ text: "Ξ " + state.witnessCount + " witness records", href: "./ledger.html" });
      }

      if (state.lastGate && state.lastGate.title) {
        items.push({ text: "Last: " + state.lastGate.title, href: state.lastGate.href });
      }

      if (state.recentUpdates.length) {
        items.push({ text: "▲ " + state.recentUpdates.length + " recent updates" });
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

    setText("[data-codex-today-title]", state.moon && state.moon.moon ? "Moon " + state.moon.moon + " · Day " + state.moon.day : "Today in the Codex");
    setText("[data-codex-today-layer]", state.symbolicLayer || "Witness the present field.");
    setText("[data-codex-today-phase]", state.moon?.phase || "Moon phase becomes visible inside the 13 Moons gate.");
    setText("[data-codex-today-prompt]", state.witnessPrompt || TODAY_PANEL_FALLBACK);
    setText("[data-codex-today-breath]", state.breathingPattern);
    setText("[data-codex-today-action]", state.recommendedAction.label + " → " + state.systemConnection);

    const openToday = document.querySelector("[data-codex-open-today]");
    if (openToday) {
      openToday.setAttribute("href", "./moons.html?date=" + encodeURIComponent(state.isoDate));
    }

    const continuePanel = document.querySelector("[data-codex-continue-panel]");
    if (continuePanel) {
      if (state.lastGate && state.lastGate.href && state.lastGate.title) {
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
      } else {
        continuePanel.hidden = true;
      }
    }

    renderActivityFeed(state.recentUpdates);
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

  function setup() {
    refresh();
    scheduleRefresh();
    setupMoonListener();
    setupPathReset();
    setupLifecycle();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();
