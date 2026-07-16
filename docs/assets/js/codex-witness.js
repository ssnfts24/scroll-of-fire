/* Scroll of Fire — Shared "Record in Witness Ledger" action
   File: docs/assets/js/codex-witness.js

   Provides a shared buildWitnessLink() that returns a URL to ledger.html
   with contextual prefill parameters derived from CodexState and the page.

   Usage in HTML (inserted by codex-witness.js automatically):
     <a href="..." data-witness-link>Record in Witness Ledger</a>

   Or call window.SOFWitness.buildWitnessLink(context) directly.

   Phase 8 — Connect all tools to the Witness Ledger.
*/

(function () {
  "use strict";

  const BASE_LEDGER = "./ledger.html";

  function escapeParam(val) {
    return encodeURIComponent(String(val || ""));
  }

  /**
   * Builds a ledger URL prefilled with context from the current page and CodexState.
   * @param {object} [extra] — optional extra context fields
   */
  function buildWitnessLink(extra) {
    const state = window.CodexState || {};
    const parts = [];

    // Current date and moon
    if (state.isoDate) {
      parts.push(state.isoDate);
    }

    if (state.moon && state.moon.moonName && state.moon.day) {
      parts.push("Moon " + state.moon.moon + " · " + state.moon.moonName + " · Day " + state.moon.day);
    }

    if (state.moon && state.moon.phase) {
      parts.push(state.moon.phase);
    }

    // Page context
    const pageTitle = (extra && extra.pageTitle) || document.title.split(" — ")[0].trim();
    if (pageTitle) {
      parts.push("Page: " + pageTitle);
    }

    // Tool context
    if (extra && extra.tool) {
      parts.push("Tool: " + extra.tool);
    }

    if (extra && extra.preset) {
      parts.push("Preset: " + extra.preset);
    }

    if (extra && extra.question) {
      parts.push("Question: " + extra.question);
    }

    if (extra && extra.result) {
      parts.push("Result: " + extra.result);
    }

    // Witness prompt
    if (state.witnessPrompt) {
      parts.push("Prompt: " + state.witnessPrompt);
    }

    const noteParts = parts.join("\n");

    // Tags
    const tagParts = [];
    if (state.moon && state.moon.moonName) tagParts.push(state.moon.moonName.toLowerCase().replace(/\s+/g, "-"));
    if (extra && extra.tag) tagParts.push(extra.tag);

    const pagePath = window.location.pathname.split("/").pop().replace(".html", "");
    if (pagePath && pagePath !== "index") tagParts.push(pagePath);

    const url = new URL(BASE_LEDGER, document.baseURI);
    url.searchParams.set("note", noteParts);
    if (tagParts.length) url.searchParams.set("tags", tagParts.join(", "));

    return url.href;
  }

  /**
   * Renders all [data-witness-link] anchors with a contextual ledger URL.
   */
  function renderWitnessLinks() {
    document.querySelectorAll("[data-witness-link]").forEach(function (el) {
      const extra = {
        pageTitle: el.closest("[data-witness-context]")?.dataset.witnessContext || null,
        tool: el.dataset.witnessTool || null,
        preset: el.dataset.witnessPreset || null,
        question: el.dataset.witnessQuestion || null,
        result: el.dataset.witnessResult || null,
        tag: el.dataset.witnessTag || null,
      };
      if (el.tagName === "A") {
        el.setAttribute("href", buildWitnessLink(extra));
      }
    });
  }

  function init() {
    // Render on initial load and whenever CodexState is refreshed
    renderWitnessLinks();

    document.addEventListener("sof:codex-state", function () {
      renderWitnessLinks();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Public API
  window.SOFWitness = {
    buildWitnessLink: buildWitnessLink,
    renderWitnessLinks: renderWitnessLinks,
  };
})();
