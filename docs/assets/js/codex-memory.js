/* Scroll of Fire — Codex Memory Module
   File: docs/assets/js/codex-memory.js
   Phase: 2 — Codex Memory

   Provides safe local continuity between visits.
   All data stays in this browser. No remote storage. No account required.

   Exposes:  window.CodexMemory
   Key:      localStorage "sof.codexMemory.v1"
   Event:    "codexmemorychange" on document

   Works independently — does not require codex-state.js or living-codex.js to load first.
   Designed to be loaded early in the page so other modules can call it safely.
*/

(function () {
  "use strict";

  var STORAGE_KEY  = "sof.codexMemory.v1";
  var EVENT_NAME   = "codexmemorychange";
  var SCHEMA_VER   = 1;
  var MAX_ACTIONS  = 20;    /* rolling recent-actions window          */
  var DEBOUNCE_MS  = 800;   /* minimum ms between storage writes      */

  /* Intention vocabulary — must match the UI option values */
  var VALID_INTENTIONS = [
    "ground", "understand", "build", "restore", "speak",
    "witness", "prepare", "rest", "return", "complete"
  ];

  /* Practice statuses */
  var PRACTICE_STATUSES = ["started", "paused", "completed", "dismissed"];

  /* ------------------------------------------------------------------ */
  /* Storage helpers — fail gracefully when localStorage is unavailable  */
  /* ------------------------------------------------------------------ */

  function storageAvailable() {
    try {
      localStorage.setItem("__sof_test__", "1");
      localStorage.removeItem("__sof_test__");
      return true;
    } catch (_) {
      return false;
    }
  }

  var _storageOk = storageAvailable();

  function rawRead() {
    if (!_storageOk) return null;
    try { return localStorage.getItem(STORAGE_KEY); } catch (_) { return null; }
  }

  function rawWrite(value) {
    if (!_storageOk) return false;
    try { localStorage.setItem(STORAGE_KEY, value); return true; } catch (_) { return false; }
  }

  /* ------------------------------------------------------------------ */
  /* Default / blank state                                               */
  /* ------------------------------------------------------------------ */

  function blankState() {
    return {
      version:       SCHEMA_VER,
      createdAt:     new Date().toISOString(),
      updatedAt:     new Date().toISOString(),
      lastVisitAt:   "",
      lastPage: {
        title:   "",
        path:    "",
        chamber: ""
      },
      dailyIntention:   null,       /* { value, selectedAt, calendarDate, moonNumber, moonDay } */
      unfinishedPractice: null,     /* { id, title, sourcePage, relatedMoon, relatedIntention,
                                         startedAt, status, stepNumber, completedAt } */
      recentWitness:    null,       /* { id, date, label, moonNumber, moonName, moonDay, pagePath } */
      recentFrequency:  null,       /* { presetName, carrier, startedAt, completedAt,
                                         sourceUrl, relatedIntention, moonNumber, moonName } */
      recentMoonReading: null,      /* { date, moonNumber, moonName, moonDay, pagePath } */
      currentCycle: {
        moonNumber:      null,
        moonDay:         null,
        witnessedDays:   [],        /* ISO date strings */
        lastWitnessedDate: ""
      },
      preferences: {
        signalExpanded:       false,
        resumeDismissedUntil: ""   /* ISO date: skip panel until this date */
      },
      recentActions: []  /* [{ type, label, path, timestamp, meta }] */
    };
  }

  /* ------------------------------------------------------------------ */
  /* Validation — recover from malformed stored data                     */
  /* ------------------------------------------------------------------ */

  function isNonEmptyString(v) {
    return typeof v === "string" && v.length > 0;
  }

  function isISODate(v) {
    if (typeof v !== "string" || !v) return false;
    var d = new Date(v);
    return !isNaN(d.getTime());
  }

  function clampArray(arr, max) {
    return Array.isArray(arr) ? arr.slice(0, max) : [];
  }

  function validateIntention(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (!isNonEmptyString(obj.value)) return null;
    if (VALID_INTENTIONS.indexOf(obj.value.toLowerCase()) === -1) return null;
    return {
      value:        obj.value.toLowerCase(),
      selectedAt:   isISODate(obj.selectedAt) ? obj.selectedAt : new Date().toISOString(),
      calendarDate: isNonEmptyString(obj.calendarDate) ? obj.calendarDate : "",
      moonNumber:   typeof obj.moonNumber === "number" ? obj.moonNumber : null,
      moonDay:      typeof obj.moonDay    === "number" ? obj.moonDay    : null
    };
  }

  function validatePractice(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (!isNonEmptyString(obj.id)) return null;
    if (!isNonEmptyString(obj.title)) return null;
    if (PRACTICE_STATUSES.indexOf(obj.status) === -1) return null;
    return {
      id:                obj.id,
      title:             String(obj.title).slice(0, 120),
      sourcePage:        isNonEmptyString(obj.sourcePage) ? obj.sourcePage : "",
      relatedMoon:       typeof obj.relatedMoon === "number" ? obj.relatedMoon : null,
      relatedIntention:  isNonEmptyString(obj.relatedIntention) ? obj.relatedIntention : null,
      startedAt:         isISODate(obj.startedAt) ? obj.startedAt : new Date().toISOString(),
      status:            obj.status,
      stepNumber:        typeof obj.stepNumber === "number" ? obj.stepNumber : null,
      completedAt:       isISODate(obj.completedAt) ? obj.completedAt : null
    };
  }

  function validateWitness(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (!isNonEmptyString(obj.date)) return null;
    return {
      id:         isNonEmptyString(obj.id) ? obj.id : "",
      date:       obj.date,
      label:      isNonEmptyString(obj.label) ? String(obj.label).slice(0, 100) : "Witness entry",
      moonNumber: typeof obj.moonNumber === "number" ? obj.moonNumber : null,
      moonName:   isNonEmptyString(obj.moonName)   ? obj.moonName   : "",
      moonDay:    typeof obj.moonDay === "number"   ? obj.moonDay    : null,
      pagePath:   isNonEmptyString(obj.pagePath)    ? obj.pagePath   : ""
    };
  }

  function validateFrequency(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (!isNonEmptyString(obj.presetName)) return null;
    return {
      presetName:       obj.presetName,
      carrier:          isNonEmptyString(obj.carrier) ? obj.carrier : "",
      startedAt:        isISODate(obj.startedAt) ? obj.startedAt : new Date().toISOString(),
      completedAt:      isISODate(obj.completedAt) ? obj.completedAt : null,
      sourceUrl:        isNonEmptyString(obj.sourceUrl) ? obj.sourceUrl : "",
      relatedIntention: isNonEmptyString(obj.relatedIntention) ? obj.relatedIntention : null,
      moonNumber:       typeof obj.moonNumber === "number" ? obj.moonNumber : null,
      moonName:         isNonEmptyString(obj.moonName)   ? obj.moonName   : ""
    };
  }

  function validateAction(obj) {
    if (!obj || typeof obj !== "object") return null;
    if (!isNonEmptyString(obj.type)) return null;
    return {
      type:      obj.type,
      label:     isNonEmptyString(obj.label) ? String(obj.label).slice(0, 80) : obj.type,
      path:      isNonEmptyString(obj.path)  ? obj.path  : "",
      timestamp: isISODate(obj.timestamp) ? obj.timestamp : new Date().toISOString(),
      meta:      (obj.meta && typeof obj.meta === "object") ? obj.meta : {}
    };
  }

  function validateState(raw) {
    if (!raw || typeof raw !== "object" || raw.version !== SCHEMA_VER) {
      return blankState();
    }

    var blank = blankState();

    var lastPage = raw.lastPage || {};
    var currentCycle = raw.currentCycle || {};
    var preferences  = raw.preferences  || {};

    return {
      version:    SCHEMA_VER,
      createdAt:  isISODate(raw.createdAt)  ? raw.createdAt  : blank.createdAt,
      updatedAt:  isISODate(raw.updatedAt)  ? raw.updatedAt  : blank.updatedAt,
      lastVisitAt: isISODate(raw.lastVisitAt) ? raw.lastVisitAt : "",
      lastPage: {
        title:   isNonEmptyString(lastPage.title)   ? String(lastPage.title).slice(0, 80)   : "",
        path:    isNonEmptyString(lastPage.path)    ? lastPage.path    : "",
        chamber: isNonEmptyString(lastPage.chamber) ? lastPage.chamber : ""
      },
      dailyIntention:    validateIntention(raw.dailyIntention),
      unfinishedPractice: validatePractice(raw.unfinishedPractice),
      recentWitness:     validateWitness(raw.recentWitness),
      recentFrequency:   validateFrequency(raw.recentFrequency),
      recentMoonReading: (raw.recentMoonReading && typeof raw.recentMoonReading === "object")
        ? {
            date:       raw.recentMoonReading.date       || "",
            moonNumber: raw.recentMoonReading.moonNumber || null,
            moonName:   raw.recentMoonReading.moonName   || "",
            moonDay:    raw.recentMoonReading.moonDay    || null,
            pagePath:   raw.recentMoonReading.pagePath   || ""
          }
        : null,
      currentCycle: {
        moonNumber:    typeof currentCycle.moonNumber === "number" ? currentCycle.moonNumber : null,
        moonDay:       typeof currentCycle.moonDay    === "number" ? currentCycle.moonDay    : null,
        witnessedDays: clampArray(
          Array.isArray(currentCycle.witnessedDays)
            ? currentCycle.witnessedDays.filter(function (d) { return isNonEmptyString(d); })
            : [],
          365
        ),
        lastWitnessedDate: isNonEmptyString(currentCycle.lastWitnessedDate)
          ? currentCycle.lastWitnessedDate
          : ""
      },
      preferences: {
        signalExpanded:       !!preferences.signalExpanded,
        resumeDismissedUntil: isISODate(preferences.resumeDismissedUntil)
          ? preferences.resumeDismissedUntil
          : ""
      },
      recentActions: clampArray(
        Array.isArray(raw.recentActions)
          ? raw.recentActions.map(validateAction).filter(Boolean)
          : [],
        MAX_ACTIONS
      )
    };
  }

  /* ------------------------------------------------------------------ */
  /* Load / save                                                          */
  /* ------------------------------------------------------------------ */

  var _state = null;

  function load() {
    var raw = rawRead();
    if (!raw) {
      _state = blankState();
      return;
    }
    try {
      _state = validateState(JSON.parse(raw));
    } catch (_) {
      _state = blankState();
    }
  }

  var _writeTimer = null;

  function save() {
    if (!_state) return;
    _state.updatedAt = new Date().toISOString();

    if (_writeTimer) return; /* debounce */
    _writeTimer = setTimeout(function () {
      _writeTimer = null;
      if (!_state) return;
      rawWrite(JSON.stringify(_state));
    }, DEBOUNCE_MS);
  }

  function saveImmediate() {
    if (_writeTimer) { clearTimeout(_writeTimer); _writeTimer = null; }
    if (!_state) return;
    _state.updatedAt = new Date().toISOString();
    rawWrite(JSON.stringify(_state));
  }

  /* ------------------------------------------------------------------ */
  /* Event emission                                                       */
  /* ------------------------------------------------------------------ */

  function emit(detail) {
    try {
      document.dispatchEvent(
        new CustomEvent(EVENT_NAME, {
          detail: detail || { state: _state },
          bubbles: false
        })
      );
    } catch (_) {}
  }

  /* ------------------------------------------------------------------ */
  /* Internal helpers                                                     */
  /* ------------------------------------------------------------------ */

  function todayISO() {
    var now = new Date();
    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0")
    ].join("-");
  }

  function generateId() {
    return "sof-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                           */
  /* ------------------------------------------------------------------ */

  var CodexMemory = {

    version: SCHEMA_VER,

    /** Return a shallow copy of the current memory state. */
    getState: function () {
      if (!_state) load();
      return JSON.parse(JSON.stringify(_state));
    },

    /** Merge partialState into memory. Only known top-level keys are accepted. */
    update: function (partialState) {
      if (!_state) load();
      if (!partialState || typeof partialState !== "object") return;

      var allowed = [
        "lastPage", "dailyIntention", "unfinishedPractice",
        "recentWitness", "recentFrequency", "recentMoonReading",
        "currentCycle", "preferences", "lastVisitAt"
      ];

      allowed.forEach(function (key) {
        if (!(key in partialState)) return;
        if (
          key === "lastPage" || key === "currentCycle" ||
          key === "preferences"
        ) {
          /* Shallow-merge sub-objects */
          _state[key] = Object.assign({}, _state[key] || {}, partialState[key]);
        } else {
          _state[key] = partialState[key];
        }
      });

      save();
      emit();
    },

    /**
     * Record that the visitor arrived at a page.
     * data = { title, path, chamber }
     */
    recordVisit: function (data) {
      if (!_state) load();
      if (!data || typeof data !== "object") return;

      var now = new Date().toISOString();
      _state.lastVisitAt = now;
      _state.lastPage = {
        title:   isNonEmptyString(data.title)   ? String(data.title).slice(0, 80)   : "",
        path:    isNonEmptyString(data.path)     ? data.path     : "",
        chamber: isNonEmptyString(data.chamber)  ? data.chamber  : ""
      };

      CodexMemory.recordAction({
        type:      "visit",
        label:     data.title || data.chamber || data.path,
        path:      data.path || "",
        timestamp: now,
        meta:      { chamber: data.chamber || "" }
      });

      save();
      emit();
    },

    /**
     * Record a meaningful user action.
     * data = { type, label, path, timestamp?, meta? }
     * Duplicate-aware: skips if same type+path occurred within 60 s.
     */
    recordAction: function (data) {
      if (!_state) load();
      var action = validateAction(
        Object.assign({ timestamp: new Date().toISOString() }, data || {})
      );
      if (!action) return;

      /* Deduplicate: skip if last action has same type+path within 60 s */
      var last = _state.recentActions[0];
      if (last && last.type === action.type && last.path === action.path) {
        var diff = new Date(action.timestamp) - new Date(last.timestamp);
        if (diff < 60000) return;
      }

      _state.recentActions.unshift(action);
      _state.recentActions = _state.recentActions.slice(0, MAX_ACTIONS);
      save();
    },

    /**
     * Returns the best path to offer as a "Continue Your Path" suggestion.
     * Returns null when nothing useful is stored.
     */
    getResumePath: function () {
      if (!_state) load();

      var results = [];

      /* Unfinished practice takes priority */
      var p = _state.unfinishedPractice;
      if (p && p.status === "started" || p && p.status === "paused") {
        results.push({
          type:    "practice",
          label:   p.title,
          href:    p.sourcePage || "",
          meta:    p
        });
      }

      /* Most recent witness */
      var w = _state.recentWitness;
      if (w && w.pagePath) {
        results.push({
          type:  "witness",
          label: w.label || "Witness entry",
          href:  w.pagePath,
          meta:  w
        });
      }

      /* Most recent frequency session */
      var f = _state.recentFrequency;
      if (f && f.sourceUrl) {
        results.push({
          type:  "frequency",
          label: f.presetName + (f.carrier ? " · " + f.carrier : ""),
          href:  f.sourceUrl,
          meta:  f
        });
      }

      /* Last meaningful page */
      var lp = _state.lastPage;
      if (lp && lp.path) {
        results.push({
          type:    "page",
          label:   lp.title || lp.chamber || lp.path,
          href:    lp.path,
          meta:    lp
        });
      }

      return results.length ? results[0] : null;
    },

    /** Clear per-session transient data (does not clear intentions or cycle data). */
    clearSessionMemory: function () {
      if (!_state) load();
      _state.lastPage = { title: "", path: "", chamber: "" };
      saveImmediate();
      emit();
    },

    /** Export full memory as a plain object (safe to JSON.stringify). */
    exportMemory: function () {
      if (!_state) load();
      return JSON.parse(JSON.stringify(_state));
    },

    /**
     * Import compatible memory. Validates before merging.
     * Does not overwrite existing cycle data if the import is older.
     */
    importMemory: function (data) {
      if (!data || typeof data !== "object") return false;
      try {
        var imported = validateState(data);
        /* Keep the more-recent updatedAt */
        var existingUpdated = new Date(_state ? _state.updatedAt : 0);
        var importedUpdated = new Date(imported.updatedAt);
        if (importedUpdated > existingUpdated) {
          _state = imported;
        } else {
          /* Merge selectively — keep newer cycle and witnessed days */
          _state.dailyIntention    = _state.dailyIntention    || imported.dailyIntention;
          _state.unfinishedPractice= _state.unfinishedPractice|| imported.unfinishedPractice;
          _state.recentWitness     = _state.recentWitness     || imported.recentWitness;
          _state.recentFrequency   = _state.recentFrequency   || imported.recentFrequency;
        }
        saveImmediate();
        emit();
        return true;
      } catch (_) {
        return false;
      }
    },

    /* ---- Intention helpers ---- */

    /**
     * Set the daily intention.
     * value must be in VALID_INTENTIONS (or null to clear).
     * Returns the stored intention object or null.
     */
    setIntention: function (value) {
      if (!_state) load();

      if (!value) {
        _state.dailyIntention = null;
        save();
        emit();
        return null;
      }

      var normalized = String(value).toLowerCase();
      if (VALID_INTENTIONS.indexOf(normalized) === -1) return null;

      var cs = window.CodexState || {};
      _state.dailyIntention = {
        value:        normalized,
        selectedAt:   new Date().toISOString(),
        calendarDate: todayISO(),
        moonNumber:   typeof cs.moonNumber === "number" ? cs.moonNumber : null,
        moonDay:      typeof cs.moonDay    === "number" ? cs.moonDay    : null
      };

      CodexMemory.recordAction({
        type:  "intention",
        label: "Intention: " + normalized,
        path:  window.location ? window.location.pathname : ""
      });

      save();
      emit();
      return _state.dailyIntention;
    },

    /**
     * Get the current intention.
     * If it belongs to a previous calendar day, it is returned with isPriorDay: true.
     */
    getIntention: function () {
      if (!_state) load();
      var intent = _state.dailyIntention;
      if (!intent) return null;

      var today = todayISO();
      return Object.assign({}, intent, {
        isPriorDay: intent.calendarDate !== today
      });
    },

    /* ---- Practice helpers ---- */

    /**
     * Start or resume a practice.
     * data = { title, sourcePage, relatedMoon, relatedIntention }
     */
    startPractice: function (data) {
      if (!_state) load();
      if (!data || !data.title) return null;

      var existing = _state.unfinishedPractice;
      /* Only create a new one if there is no active practice or the existing one is done */
      if (
        existing &&
        (existing.status === "started" || existing.status === "paused")
      ) {
        /* Resume existing */
        existing.status = "started";
        save();
        emit();
        return existing;
      }

      var cs = window.CodexState || {};
      var practice = {
        id:               generateId(),
        title:            String(data.title).slice(0, 120),
        sourcePage:       isNonEmptyString(data.sourcePage) ? data.sourcePage : (window.location ? window.location.pathname : ""),
        relatedMoon:      typeof data.relatedMoon === "number" ? data.relatedMoon
          : (typeof cs.moonNumber === "number" ? cs.moonNumber : null),
        relatedIntention: isNonEmptyString(data.relatedIntention)
          ? data.relatedIntention
          : (_state.dailyIntention ? _state.dailyIntention.value : null),
        startedAt:        new Date().toISOString(),
        status:           "started",
        stepNumber:       null,
        completedAt:      null
      };

      _state.unfinishedPractice = practice;
      CodexMemory.recordAction({
        type:  "practice-start",
        label: practice.title,
        path:  practice.sourcePage
      });

      save();
      emit();
      return practice;
    },

    /**
     * Update the status of the current practice.
     * status = "paused" | "completed" | "dismissed"
     */
    updatePracticeStatus: function (status, stepNumber) {
      if (!_state) load();
      var p = _state.unfinishedPractice;
      if (!p) return false;
      if (PRACTICE_STATUSES.indexOf(status) === -1) return false;

      p.status = status;
      if (typeof stepNumber === "number") p.stepNumber = stepNumber;
      if (status === "completed") {
        p.completedAt = new Date().toISOString();
        /* Mark current calendar day as witnessed-by-practice */
        var today = todayISO();
        if (_state.currentCycle.witnessedDays.indexOf(today) === -1) {
          _state.currentCycle.witnessedDays.push(today);
          _state.currentCycle.witnessedDays = _state.currentCycle.witnessedDays.slice(-365);
        }
      }

      CodexMemory.recordAction({
        type:  "practice-" + status,
        label: p.title,
        path:  p.sourcePage || ""
      });

      save();
      emit();
      return true;
    },

    /* ---- Witness helpers ---- */

    /**
     * Record a lightweight reference to a witness entry.
     * data = { id?, date, label, moonNumber?, moonName?, moonDay?, pagePath? }
     */
    recordWitness: function (data) {
      if (!_state) load();
      if (!data || !data.date) return;

      var cs = window.CodexState || {};
      var witness = {
        id:         isNonEmptyString(data.id) ? data.id : generateId(),
        date:       data.date,
        label:      isNonEmptyString(data.label) ? String(data.label).slice(0, 100) : "Witness entry",
        moonNumber: typeof data.moonNumber === "number" ? data.moonNumber
          : (typeof cs.moonNumber === "number" ? cs.moonNumber : null),
        moonName:   isNonEmptyString(data.moonName)  ? data.moonName  : (cs.moonName || ""),
        moonDay:    typeof data.moonDay === "number"  ? data.moonDay   : (typeof cs.moonDay === "number" ? cs.moonDay : null),
        pagePath:   isNonEmptyString(data.pagePath)   ? data.pagePath  : (window.location ? window.location.pathname : "")
      };

      _state.recentWitness = witness;

      /* Mark day as witnessed in cycle */
      var isoDate = data.date.split("T")[0] || todayISO();
      if (_state.currentCycle.witnessedDays.indexOf(isoDate) === -1) {
        _state.currentCycle.witnessedDays.push(isoDate);
        _state.currentCycle.witnessedDays = _state.currentCycle.witnessedDays.slice(-365);
      }
      _state.currentCycle.lastWitnessedDate = isoDate;

      CodexMemory.recordAction({
        type:  "witness",
        label: witness.label,
        path:  witness.pagePath
      });

      saveImmediate();
      emit();
    },

    /* ---- Frequency helpers ---- */

    /**
     * Record a lightweight reference to a frequency session.
     * data = { presetName, carrier?, startedAt?, sourceUrl?, relatedIntention?, moonNumber?, moonName? }
     */
    recordFrequency: function (data) {
      if (!_state) load();
      if (!data || !data.presetName) return;

      var cs = window.CodexState || {};
      var freq = {
        presetName:       data.presetName,
        carrier:          isNonEmptyString(data.carrier) ? data.carrier : "",
        startedAt:        isISODate(data.startedAt) ? data.startedAt : new Date().toISOString(),
        completedAt:      isISODate(data.completedAt) ? data.completedAt : null,
        sourceUrl:        isNonEmptyString(data.sourceUrl)
          ? data.sourceUrl
          : (window.location ? window.location.href : ""),
        relatedIntention: isNonEmptyString(data.relatedIntention)
          ? data.relatedIntention
          : (_state.dailyIntention ? _state.dailyIntention.value : null),
        moonNumber: typeof data.moonNumber === "number" ? data.moonNumber
          : (typeof cs.moonNumber === "number" ? cs.moonNumber : null),
        moonName:   isNonEmptyString(data.moonName) ? data.moonName : (cs.moonName || "")
      };

      _state.recentFrequency = freq;

      CodexMemory.recordAction({
        type:  "frequency",
        label: freq.presetName + (freq.carrier ? " · " + freq.carrier : ""),
        path:  freq.sourceUrl
      });

      save();
      emit();
    },

    /* ---- 7-day path summary ---- */

    /**
     * Returns an array of 7 objects (oldest first, today last) each with:
     * { isoDate, hasIntention, hasWitness, hasFrequency, hasPractice, hasActivity }
     */
    getSevenDaySummary: function () {
      if (!_state) load();

      var today    = new Date();
      var summary  = [];
      var actions  = _state.recentActions;
      var witnessed = _state.currentCycle.witnessedDays;
      var intentDate = _state.dailyIntention ? _state.dailyIntention.calendarDate : null;

      for (var i = 6; i >= 0; i--) {
        var d = new Date(today);
        d.setDate(d.getDate() - i);
        var iso = [
          d.getFullYear(),
          String(d.getMonth() + 1).padStart(2, "0"),
          String(d.getDate()).padStart(2, "0")
        ].join("-");

        var dayActions = actions.filter(function (a) {
          return a.timestamp && a.timestamp.slice(0, 10) === iso;
        });

        summary.push({
          isoDate:       iso,
          hasIntention:  intentDate === iso ||
            dayActions.some(function (a) { return a.type === "intention"; }),
          hasWitness:    witnessed.indexOf(iso) !== -1 ||
            dayActions.some(function (a) { return a.type === "witness"; }),
          hasFrequency:  dayActions.some(function (a) { return a.type === "frequency"; }),
          hasPractice:   dayActions.some(function (a) {
            return a.type === "practice-completed" || a.type === "practice-start";
          }),
          hasActivity:   dayActions.length > 0
        });
      }

      return summary;
    },

    /* ---- "What changed since your last visit" ---- */

    /**
     * Returns a list of verified change strings based on stored state vs current state.
     * Returns [] when nothing meaningful changed.
     * currentCodexState = window.CodexState (or partial equivalent)
     */
    getChangesSinceLastVisit: function (currentCodexState) {
      if (!_state) load();

      var changes = [];
      var lastVisit = _state.lastVisitAt ? new Date(_state.lastVisitAt) : null;
      if (!lastVisit) return changes;

      var cs = currentCodexState || window.CodexState || {};
      var lp = _state.lastPage || {};

      /* Moon day change */
      var prevMoonDay = _state.currentCycle.moonDay;
      var currMoonDay = typeof cs.moonDay === "number" ? cs.moonDay : null;
      if (prevMoonDay && currMoonDay && prevMoonDay !== currMoonDay) {
        changes.push(
          "The Codex moved from Day " + prevMoonDay + " to Day " + currMoonDay + "."
        );
      }

      /* Moon change */
      var prevMoon = _state.currentCycle.moonNumber;
      var currMoon = typeof cs.moonNumber === "number" ? cs.moonNumber : null;
      if (prevMoon && currMoon && prevMoon !== currMoon) {
        changes.push(
          "The active Moon changed from Moon " + prevMoon + " to Moon " + currMoon +
          (cs.moonName ? " · " + cs.moonName : "") + "."
        );
      }

      /* Unfinished practice still pending */
      var p = _state.unfinishedPractice;
      if (p && (p.status === "started" || p.status === "paused")) {
        var isBefore = new Date(p.startedAt) < lastVisit;
        if (isBefore) {
          changes.push("Your " + p.title + " practice is still unfinished.");
        }
      }

      /* Shabbat state changed */
      var prevShabbat = lp && lp.shabbatState;
      var currShabbat = cs.shabbatState;
      if (prevShabbat && currShabbat && prevShabbat !== currShabbat && currShabbat !== "ordinary") {
        changes.push("Day state is now: " + (cs.shabbatLabel || currShabbat) + ".");
      }

      return changes;
    },

    /* ---- Clearing helpers ---- */

    /** Clear only the daily intention. */
    clearIntention: function () {
      if (!_state) load();
      _state.dailyIntention = null;
      saveImmediate();
      emit();
    },

    /** Clear only the unfinished practice. */
    clearPractice: function () {
      if (!_state) load();
      _state.unfinishedPractice = null;
      saveImmediate();
      emit();
    },

    /** Clear the continue-path resume-dismissed preference. */
    clearDismissedUntil: function () {
      if (!_state) load();
      _state.preferences.resumeDismissedUntil = "";
      saveImmediate();
      emit();
    },

    /**
     * Reset all Phase 2 memory.
     * Does NOT touch witness ledger, moon logs, frequency journal, or other system keys.
     */
    resetAll: function () {
      _state = blankState();
      saveImmediate();
      emit({ reset: true });
    },

    /* ---- Preference helpers ---- */

    setSignalExpanded: function (expanded) {
      if (!_state) load();
      _state.preferences.signalExpanded = !!expanded;
      save();
    },

    setResumeDismissedUntil: function (isoDate) {
      if (!_state) load();
      _state.preferences.resumeDismissedUntil = isISODate(isoDate) ? isoDate : "";
      save();
    },

    /** Dismiss the Continue Your Path panel for the rest of today. */
    dismissResumeToday: function () {
      var tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      CodexMemory.setResumeDismissedUntil(tomorrow.toISOString());
      emit();
    },

    /** Returns true when the resume panel should be hidden. */
    isResumeDismissed: function () {
      if (!_state) load();
      var until = _state.preferences.resumeDismissedUntil;
      if (!until) return false;
      return new Date() < new Date(until);
    },

    /* ---- Cycle state update ---- */

    /** Update stored moon cycle state from CodexState. Call when codexstatechange fires. */
    syncCycle: function (cs) {
      if (!_state) load();
      cs = cs || window.CodexState || {};
      var changed = false;

      if (typeof cs.moonNumber === "number" && cs.moonNumber !== _state.currentCycle.moonNumber) {
        _state.currentCycle.moonNumber = cs.moonNumber;
        changed = true;
      }
      if (typeof cs.moonDay === "number" && cs.moonDay !== _state.currentCycle.moonDay) {
        _state.currentCycle.moonDay = cs.moonDay;
        changed = true;
      }
      if (changed) save();
    },

    /* ---- Utilities ---- */

    storageAvailable: function () { return _storageOk; },
    validIntentions:  VALID_INTENTIONS,
    maxActions:       MAX_ACTIONS,
    storageKey:       STORAGE_KEY,
    eventName:        EVENT_NAME
  };

  /* ------------------------------------------------------------------ */
  /* Auto-init                                                            */
  /* ------------------------------------------------------------------ */

  load();

  /* Sync cycle state whenever codexstatechange fires */
  document.addEventListener("codexstatechange", function (event) {
    CodexMemory.syncCycle((event && event.detail) || window.CodexState || {});
  });

  /* Also sync on sof:codex-state (from living-codex.js) */
  document.addEventListener("sof:codex-state", function (event) {
    CodexMemory.syncCycle((event && event.detail) || window.CodexState || {});
  });

  /* Expose publicly */
  window.CodexMemory = CodexMemory;

})();
