"use strict";

const editorialNavigation = (() => {
  function revealClaimFromHash(location, document, window) {
    let id;
    try {
      id = decodeURIComponent(location.hash.slice(1));
    } catch {
      return false;
    }
    if (!id) return false;
    const target = document.getElementById(id);
    if (!target) return false;
    const record = target.matches("details.evidence-record")
      ? target
      : target.closest("details.evidence-record");
    if (!record) return false;
    record.open = true;
    window.requestAnimationFrame(() => {
      record.scrollIntoView({ block: "start" });
      record.querySelector("summary")?.focus({ preventScroll: true });
    });
    return true;
  }

  return { revealClaimFromHash };
})();

if (typeof module === "object" && module.exports) module.exports = editorialNavigation;
if (typeof window !== "undefined") window.ScrollEditorialNavigation = editorialNavigation;
