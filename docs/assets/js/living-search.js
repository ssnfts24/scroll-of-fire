"use strict";

/*
 * Living Search — interface.
 *
 * One controller powers both the full search page (docs/search.html)
 * and the overlay opened from any content page by the launcher
 * (Ctrl+K, Cmd+K, or "/"). It lazy-loads the sealed index shards built
 * by scripts/build-search-index.mjs: the manifest and the Pages shard
 * first, the remaining areas in the background, so the first paint
 * stays small and results widen as shards arrive.
 *
 * Memory (recent searches, recently opened results) is kept by
 * living-search-memory.js in localStorage on this device only.
 */
(function () {
  const core = window.LivingSearchCore;
  const memoryModule = window.LivingSearchMemory;
  if (!core || !memoryModule) return;
  const memory = memoryModule.createMemory();

  const scriptUrl = [...document.scripts].find(script => /living-search\.js(?:\?|$)/.test(script.src))?.src || "";
  const searchRoot = scriptUrl ? new URL("../search/", scriptUrl).href : "assets/search/";
  const AREA_LABELS = { pages: "Page", scrolls: "Scroll", atlas: "Atlas", lexicon: "Lexicon", claims: "Claim" };
  const AREA_ORDER = ["pages", "scrolls", "atlas", "lexicon", "claims"];
  const PATHWAYS = [
    { t: "Enter the Scroll Library", u: "scroll/", d: "The full manuscript, in eight shelves" },
    { t: "Search the Scroll text", u: "scroll/search.html", d: "The dedicated full-text search inside the Scroll Library" },
    { t: "Hebrew Lexicon", u: "scroll/lexicon.html", d: "911 Hebrew forms and where they occur" },
    { t: "The Claim Register", u: "scroll/editorial.html", d: "21 claims, each with its evidence status" },
    { t: "13 Moons", u: "moons.html", d: "The Pattern Calendar year" },
    { t: "Living Time Sphere", u: "living-time-sphere.html", d: "The Living Time Observatory" },
    { t: "Codex Atlas", u: "codex-atlas.html", d: "Every published resource, mapped" }
  ];

  const state = {
    manifest: null,
    index: core.createIndex(),
    loaded: new Set(),
    loading: new Map(),
    runId: 0
  };

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.json();
  }

  function ensureShard(area) {
    if (state.loaded.has(area)) return Promise.resolve();
    if (state.loading.has(area)) return state.loading.get(area);
    const shard = state.manifest.shards[area];
    const promise = fetchJson(searchRoot + shard.file).then(payload => {
      core.addDocuments(state.index, payload.docs);
      state.loaded.add(area);
      state.loading.delete(area);
    }).catch(error => {
      state.loading.delete(area);
      throw error;
    });
    state.loading.set(area, promise);
    return promise;
  }

  async function loadManifest() {
    if (!state.manifest) state.manifest = await fetchJson(`${searchRoot}manifest.json`);
    return state.manifest;
  }

  async function loadInitial(onProgress) {
    await loadManifest();
    await ensureShard("pages");
    onProgress && onProgress();
    const rest = ["atlas", "claims", "lexicon", "scrolls"];
    const idle = window.requestIdleCallback || (fn => setTimeout(fn, 60));
    idle(async () => {
      for (const area of rest) {
        try { await ensureShard(area); } catch { /* a failed shard narrows results; the status line says so */ }
        onProgress && onProgress();
      }
    });
  }

  const esc = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function highlight(text, query) {
    const tokens = new Set(core.tokenize(query));
    if (!tokens.size) return esc(text);
    return String(text ?? "").split(/(\s+)/).map(part => {
      if (/^\s+$/.test(part) || !part) return part;
      const normalized = core.normalize(part);
      const hit = tokens.has(normalized) || [...tokens].some(token => token.length >= 2 && normalized.startsWith(token));
      return hit ? `<mark>${esc(part)}</mark>` : esc(part);
    }).join("");
  }

  function snippetHtml(doc, query) {
    const { text, ranges } = core.snippetFor(doc, query);
    if (!ranges.length) return esc(text);
    let out = "";
    let cursor = 0;
    for (const [start, end] of ranges) {
      out += esc(text.slice(cursor, start)) + `<mark>${esc(text.slice(start, end))}</mark>`;
      cursor = end;
    }
    return out + esc(text.slice(cursor));
  }

  function buildUI(container, { overlay = false } = {}) {
    container.innerHTML = `
      <form class="ls-form" role="search">
        <label class="ls-label" for="${overlay ? "ls-q-overlay" : "ls-q-page"}">Search the whole Codex</label>
        <div class="ls-input-row">
          <input class="ls-input" id="${overlay ? "ls-q-overlay" : "ls-q-page"}" type="search" autocomplete="off"
            placeholder="Try “resonance”, “orphan trains”, or בראשית…" aria-label="Search the whole Codex">
          ${overlay ? '<button class="ls-close" type="button" aria-label="Close search">✕</button>' : ""}
        </div>
        <div class="ls-chips" role="group" aria-label="Filter by area">
          <button type="button" class="ls-chip is-active" data-area="">All</button>
          ${AREA_ORDER.map(area => `<button type="button" class="ls-chip" data-area="${area}">${AREA_LABELS[area]}s</button>`).join("")}
        </div>
        <p class="ls-status" role="status" aria-live="polite"></p>
      </form>
      <div class="ls-home"></div>
      <ol class="ls-results"></ol>
      <div class="ls-empty" hidden></div>`;
    const input = container.querySelector(".ls-input");
    const chips = [...container.querySelectorAll(".ls-chip")];
    const status = container.querySelector(".ls-status");
    const home = container.querySelector(".ls-home");
    const resultsList = container.querySelector(".ls-results");
    const emptyBox = container.querySelector(".ls-empty");
    let activeArea = "";
    let activeIndex = -1;
    let timer = null;

    function statusLine(extra = "") {
      if (!state.manifest) { status.textContent = "Gathering the index…"; return; }
      const names = AREA_ORDER.map(area => state.loaded.has(area)
        ? `${AREA_LABELS[area]}s ${state.manifest.counts[area]}`
        : `${AREA_LABELS[area]}s …`);
      status.textContent = `${extra}Index: ${names.join(" · ")}`.trim();
    }

    function renderHome() {
      const recents = memory.getRecents();
      const visits = memory.getVisits();
      const parts = [];
      if (recents.length) {
        parts.push(`<section class="ls-home-block"><h3>Your recent searches</h3><div class="ls-recent-chips">${
          recents.map(query => `<button type="button" class="ls-recent" data-query="${esc(query)}">${esc(query)}</button>`).join("")
        }</div></section>`);
      }
      if (visits.length) {
        parts.push(`<section class="ls-home-block"><h3>Pick up where you left off</h3><ul class="ls-visits">${
          visits.map(visit => `<li><a href="${esc(visit.u)}"><span class="ls-badge">${esc(AREA_LABELS[visit.a] || "Page")}</span> ${esc(visit.t)}</a></li>`).join("")
        }</ul></section>`);
      }
      parts.push(`<section class="ls-home-block"><h3>Pathways</h3><ul class="ls-pathways">${
        PATHWAYS.map(path => `<li><a href="${esc(path.u)}"><strong>${esc(path.t)}</strong><span>${esc(path.d)}</span></a></li>`).join("")
      }</ul></section>`);
      parts.push(`<p class="ls-memory-note">This search remembers your recent searches and the results you opened — <strong>only on this device, in this browser</strong>. Nothing is sent anywhere. ${
        recents.length || visits.length ? '<button type="button" class="ls-clear">Clear this memory</button>' : ""
      }</p>`);
      home.innerHTML = parts.join("");
      home.querySelectorAll(".ls-recent").forEach(button => button.addEventListener("click", () => {
        input.value = button.dataset.query;
        run(true);
        input.focus();
      }));
      home.querySelector(".ls-clear")?.addEventListener("click", () => { memory.clearAll(); renderHome(); });
      home.querySelectorAll(".ls-visits a, .ls-pathways a").forEach(link => link.addEventListener("click", () => {
        const item = [...PATHWAYS, ...visits].find(entry => entry.u === link.getAttribute("href"));
        if (item) memory.addVisit({ t: item.t, u: item.u, a: item.a || "pages" });
      }));
    }

    function setActive(next) {
      const items = [...resultsList.querySelectorAll(".ls-result")];
      if (!items.length) { activeIndex = -1; return; }
      activeIndex = (next + items.length) % items.length;
      items.forEach((item, i) => {
        item.classList.toggle("is-active", i === activeIndex);
        if (i === activeIndex) item.scrollIntoView({ block: "nearest" });
      });
    }

    async function run(record = false) {
      const query = input.value.trim();
      const id = ++state.runId;
      if (!query) {
        resultsList.innerHTML = "";
        emptyBox.hidden = true;
        home.hidden = false;
        renderHome();
        statusLine();
        return;
      }
      home.hidden = true;
      if (record) memory.addRecent(query);
      try {
        await loadManifest();
        const wanted = activeArea ? [activeArea] : AREA_ORDER;
        await Promise.all(wanted.map(area => ensureShard(area).catch(() => null)));
      } catch { /* fall through with whatever is loaded */ }
      if (id !== state.runId) return;
      const { results, total, unresolved } = core.search(state.index, query, {
        areas: activeArea ? [activeArea] : null,
        limit: 40
      });
      activeIndex = -1;
      if (!results.length) {
        resultsList.innerHTML = "";
        const suggestions = [...new Set(unresolved.flatMap(token => core.suggestTerms(state.index, token)))].slice(0, 5);
        emptyBox.innerHTML = `<p>No results for “${esc(query)}”${activeArea ? ` in ${AREA_LABELS[activeArea]}s` : ""}.</p>${
          suggestions.length ? `<p>Nearest terms in the index: ${suggestions.map(term =>
            `<button type="button" class="ls-recent" data-query="${esc(term)}">${esc(term)}</button>`).join(" ")}</p>` : ""
        }<p>Try fewer words, Hebrew letters without vowel marks, or a transliteration such as “bereshit”.</p>`;
        emptyBox.hidden = false;
        emptyBox.querySelectorAll(".ls-recent").forEach(button => button.addEventListener("click", () => {
          input.value = button.dataset.query;
          run(true);
        }));
        statusLine("No results. ");
        return;
      }
      emptyBox.hidden = true;
      resultsList.innerHTML = results.map(({ doc }) => `
        <li class="ls-result" data-area="${esc(doc.a)}">
          <a class="ls-result-link" href="${esc(doc.u)}">
            <span class="ls-badge">${esc(AREA_LABELS[doc.a] || doc.a)}</span>
            <span class="ls-result-title">${highlight(doc.t, query)}</span>
            ${doc.x ? `<span class="ls-result-note">${esc(doc.x)}</span>` : ""}
            <span class="ls-result-snippet">${snippetHtml(doc, query)}</span>
          </a>
        </li>`).join("");
      statusLine(`${total} result${total === 1 ? "" : "s"}. `);
    }

    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => run(false), 120);
    });
    input.addEventListener("keydown", event => {
      if (event.key === "ArrowDown") { event.preventDefault(); setActive(activeIndex + 1); }
      else if (event.key === "ArrowUp") { event.preventDefault(); setActive(activeIndex - 1); }
      else if (event.key === "Enter") {
        const items = [...resultsList.querySelectorAll(".ls-result-link")];
        if (activeIndex >= 0 && items[activeIndex]) { event.preventDefault(); items[activeIndex].click(); }
        else run(true);
      }
    });
    container.querySelector(".ls-form").addEventListener("submit", event => { event.preventDefault(); run(true); });
    chips.forEach(chip => chip.addEventListener("click", () => {
      chips.forEach(other => other.classList.toggle("is-active", other === chip));
      activeArea = chip.dataset.area || "";
      if (input.value.trim()) run(false);
    }));
    resultsList.addEventListener("click", event => {
      const link = event.target.closest(".ls-result-link");
      if (!link) return;
      const item = link.closest(".ls-result");
      const title = link.querySelector(".ls-result-title")?.textContent || link.href;
      memory.addVisit({ t: title, u: link.getAttribute("href"), a: item?.dataset.area || "" });
      if (input.value.trim()) memory.addRecent(input.value.trim());
    });
    resultsList.addEventListener("mousemove", event => {
      const item = event.target.closest(".ls-result");
      if (!item) return;
      const items = [...resultsList.querySelectorAll(".ls-result")];
      const index = items.indexOf(item);
      if (index !== activeIndex) setActive(index);
    });

    loadInitial(() => { statusLine(); if (!input.value.trim()) renderHome(); }).catch(() => {
      status.textContent = "The search index could not be loaded. The Atlas and Search the Scroll Library remain available from the navigation.";
    });
    renderHome();
    return { input, run, focus: () => input.focus() };
  }

  /* ---------------- overlay ---------------- */
  let overlay = null;
  let overlayUI = null;
  let lastFocus = null;

  function open(initialQuery) {
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "ls-overlay";
      overlay.hidden = true;
      overlay.innerHTML = `<div class="ls-panel" role="dialog" aria-modal="true" aria-label="Search the Codex"><div class="ls-mount"></div></div>`;
      document.body.appendChild(overlay);
      overlayUI = buildUI(overlay.querySelector(".ls-mount"), { overlay: true });
      overlay.querySelector(".ls-close").addEventListener("click", close);
      overlay.addEventListener("mousedown", event => { if (event.target === overlay) close(); });
      overlay.addEventListener("keydown", event => { if (event.key === "Escape") close(); });
    }
    lastFocus = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add("ls-open");
    if (typeof initialQuery === "string" && initialQuery) {
      overlayUI.input.value = initialQuery;
      overlayUI.run(true);
    }
    overlayUI.focus();
  }

  function close() {
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove("ls-open");
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  window.LivingSearchUI = { open, close };

  /* ---------------- page mode ---------------- */
  const pageMount = document.getElementById("living-search-app");
  if (pageMount) {
    const ui = buildUI(pageMount, { overlay: false });
    const query = new URLSearchParams(location.search).get("q");
    if (query) {
      ui.input.value = query;
      ui.run(false);
    }
    ui.focus();
  }
})();
