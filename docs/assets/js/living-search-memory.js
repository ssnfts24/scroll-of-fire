"use strict";

/*
 * Living Search — memory, kept on the visitor's device only.
 *
 * Recents and "pick up where you left off" visits live in localStorage
 * under versioned keys. Nothing is transmitted anywhere: there is no
 * network code in this file, and the search page states the contract in
 * plain words. Storage may be unavailable (private windows, disabled
 * storage); every operation then degrades to a no-op and the search
 * itself keeps working.
 *
 * The same file runs in the browser and in Node tests, where a storage
 * stub stands in for localStorage.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LivingSearchMemory = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const RECENTS_KEY = "sof.livingSearch.recents.v1";
  const VISITS_KEY = "sof.livingSearch.visits.v1";
  const MAX_RECENTS = 12;
  const MAX_VISITS = 12;

  function defaultStorage() {
    try {
      return typeof localStorage !== "undefined" ? localStorage : null;
    } catch {
      return null;
    }
  }

  function createMemory(storage = defaultStorage()) {
    function read(key) {
      if (!storage) return [];
      try {
        const value = JSON.parse(storage.getItem(key) || "[]");
        return Array.isArray(value) ? value : [];
      } catch {
        return [];
      }
    }
    function write(key, value) {
      if (!storage) return false;
      try {
        storage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    }
    const fold = text => String(text ?? "").trim().toLocaleLowerCase("en");

    return {
      available: Boolean(storage),
      getRecents() {
        return read(RECENTS_KEY).filter(item => typeof item === "string");
      },
      addRecent(query) {
        const text = String(query ?? "").trim();
        if (!text) return this.getRecents();
        const rest = this.getRecents().filter(item => fold(item) !== fold(text));
        const next = [text, ...rest].slice(0, MAX_RECENTS);
        write(RECENTS_KEY, next);
        return next;
      },
      getVisits() {
        return read(VISITS_KEY).filter(item => item && typeof item.u === "string" && typeof item.t === "string");
      },
      addVisit(visit) {
        if (!visit || typeof visit.u !== "string" || !visit.u || typeof visit.t !== "string" || !visit.t) return this.getVisits();
        const entry = { t: visit.t, u: visit.u, a: typeof visit.a === "string" ? visit.a : "" };
        const rest = this.getVisits().filter(item => item.u !== entry.u);
        const next = [entry, ...rest].slice(0, MAX_VISITS);
        write(VISITS_KEY, next);
        return next;
      },
      clearAll() {
        if (!storage) return;
        try {
          storage.removeItem(RECENTS_KEY);
          storage.removeItem(VISITS_KEY);
        } catch { /* storage unavailable: nothing to clear */ }
      },
      keys: { recents: RECENTS_KEY, visits: VISITS_KEY },
      limits: { recents: MAX_RECENTS, visits: MAX_VISITS }
    };
  }

  return { createMemory, RECENTS_KEY, VISITS_KEY, MAX_RECENTS, MAX_VISITS };
});
