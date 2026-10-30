"use strict";

/* Shared helpers for the Scroll library tool pages (search, lexicon, atlas). */
(() => {
  const N = window.ScrollSearchNormalize;
  const themeKey = "sof-scroll-theme";
  const textScaleKey = "sof-scroll-text-scale";
  const base = new URL("../", document.currentScript ? document.currentScript.src : location.href);
  const root = new URL("../", base);

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function applyTheme() {
    const stored = localStorage.getItem(themeKey);
    const theme = stored === "light" || stored === "dark" ? stored : (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.dataset.theme = theme;
    const button = document.querySelector("[data-theme-toggle]");
    if (button) button.textContent = theme === "dark" ? "Light theme" : "Dark theme";
    const scale = Number(localStorage.getItem(textScaleKey));
    if (Number.isFinite(scale) && scale >= 0.9 && scale <= 1.3) document.documentElement.style.setProperty("--reading-scale", String(scale));
  }

  function bindTheme() {
    applyTheme();
    document.querySelector("[data-theme-toggle]")?.addEventListener("click", () => {
      localStorage.setItem(themeKey, document.documentElement.dataset.theme === "dark" ? "light" : "dark");
      applyTheme();
    });
  }

  const cache = new Map();
  function loadJson(relativePath) {
    if (!cache.has(relativePath)) {
      const request = fetch(new URL(relativePath, base)).then(response => {
        if (!response.ok) throw new Error(`Could not load ${relativePath} (HTTP ${response.status}).`);
        return response.json();
      });
      request.catch(() => cache.delete(relativePath));
      cache.set(relativePath, request);
    }
    return cache.get(relativePath);
  }

  const hexOf = text => [...text].map(char => char.codePointAt(0).toString(16).padStart(4, "0")).join("");
  const readerHref = (sectionId, segmentId) =>
    `reader.html?section=${encodeURIComponent(sectionId)}#${encodeURIComponent(segmentId)}`;

  /* Sections table helpers built from search/sections.json */
  function tables(data) {
    const rows = data.sections.map(row => ({ id: row[0], title: row[1], shelf: data.shelves[row[2]], line: row[3], page: row[4], chapter: row[5] }));
    const ordinals = new Map(data.segIds.map((id, index) => [id, index]));
    function describe(ordinal) {
      const section = rows[data.segSection[ordinal]];
      return {
        ordinal,
        id: data.segIds[ordinal],
        section,
        page: rows[section.page],
        lineStart: data.segStart[ordinal],
        lineEnd: data.segEnd[ordinal],
        chapter: data.segChapter[ordinal],
        href: readerHref(section.id, data.segIds[ordinal]),
        sourceUrl: `${data.sourceUrl}#L${data.segStart[ordinal]}`
      };
    }
    return { rows, ordinals, describe, byId: id => (ordinals.has(id) ? describe(ordinals.get(id)) : null) };
  }

  const PARTICLES = ["ו", "ה", "ב", "כ", "ל", "מ", "ש"];

  /*
   * Lexicon matching. Hebrew queries match the consonantal skeleton (with
   * optional single-letter prefix particles). Latin queries match the author's
   * own transliterations, then the documented transliteration-variant key.
   */
  function matchLexicon(entries, query, limit = 40) {
    const q = N.normalize(query).replace(/ /g, "");
    if (!q) return [];
    const scored = [];
    if (N.hasHebrew(query)) {
      for (const entry of entries) {
        let rank = -1;
        if (entry.s === q) rank = 0;
        else if (entry.s.startsWith(q)) rank = 1;
        else if (entry.s.length === q.length + 1 && PARTICLES.includes(entry.s[0]) && entry.s.slice(1) === q) rank = 2;
        else if (q.length >= 3 && entry.s.includes(q)) rank = 3;
        if (rank >= 0) scored.push({ entry, rank, via: "Hebrew spelling" });
      }
    } else {
      const key = N.transliterationKey(query);
      for (const entry of entries) {
        const names = [...entry.a, ...entry.p].map(name => N.normalize(name).replace(/ /g, ""));
        let rank = -1;
        let via = "Author’s transliteration";
        if (names.includes(q)) rank = 0;
        else if (names.some(name => name.startsWith(q))) rank = 1;
        else if (q.length >= 3 && names.some(name => name.includes(q))) rank = 2;
        else if (key.length >= 3 && entry.k.includes(key)) { rank = 3; via = "Transliteration variant"; }
        if (rank >= 0) scored.push({ entry, rank, via });
      }
    }
    scored.sort((a, b) => a.rank - b.rank || b.entry.n - a.entry.n || a.entry.c.localeCompare(b.entry.c, "he"));
    return scored.slice(0, limit);
  }

  function sourceAnchor(url, label) {
    const link = node("a", "source-link", label);
    link.href = url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.setAttribute("aria-label", `${label} in the original manuscript, opens in a new tab`);
    return link;
  }

  function lineLabel(start, end) {
    return start === end ? `Original line ${start}` : `Original lines ${start}–${end}`;
  }

  window.ScrollCommon = { N, node, loadJson, hexOf, readerHref, tables, matchLexicon, sourceAnchor, lineLabel, root, base, PARTICLES };
  document.addEventListener("DOMContentLoaded", bindTheme);
})();
