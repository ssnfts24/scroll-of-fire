"use strict";

(() => {
  const C = window.ScrollCommon;
  const { N, node } = C;
  const listEl = document.querySelector("[data-lex-list]");
  const detailEl = document.querySelector("[data-lex-detail]");
  const input = document.querySelector("[data-lex-input]");
  const form = document.querySelector("[data-lex-form]");
  const clearButton = document.querySelector("[data-lex-clear]");
  const statusEl = document.querySelector("[data-lex-status]");
  const moreButton = document.querySelector("[data-lex-more]");
  const lettersEl = document.querySelector("[data-letters]");
  const scopeEl = document.querySelector("[data-lex-scope]");
  const PAGE = 50;
  const state = { q: "", letter: "", page: "", term: "", shown: PAGE };
  let entries = [];
  let sections = null;
  let tables = null;
  let pageIds = null;

  const loadSections = () => C.loadJson("search/sections.json").then(value => {
    if (!sections) { sections = value; tables = C.tables(value); }
    return value;
  });
  const detailFile = entry => `search/lexicon/entries-${C.hexOf([...N.normalize(entry.c)][0] ?? "x")}.json`;
  const hebrewNode = (tag, className, text) => {
    const element = node(tag, className, text);
    element.lang = "he";
    element.dir = "rtl";
    return element;
  };

  function setStatus(text, error) {
    statusEl.classList.toggle("is-error", Boolean(error));
    statusEl.textContent = text;
  }

  function buildLetters() {
    const letters = [...new Set(entries.map(entry => [...entry.s][0]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he"));
    const all = node("button", "chip", "All");
    all.type = "button";
    all.dataset.letter = "";
    lettersEl.append(all);
    for (const letter of letters) {
      const chip = hebrewNode("button", "chip chip-hebrew", letter);
      chip.type = "button";
      chip.dataset.letter = letter;
      chip.setAttribute("aria-label", `Forms starting with ${letter}`);
      lettersEl.append(chip);
    }
    lettersEl.addEventListener("click", event => {
      const chip = event.target.closest("[data-letter]");
      if (!chip) return;
      state.letter = chip.dataset.letter;
      state.shown = PAGE;
      render();
      syncUrl(true);
    });
  }

  function filtered() {
    let list = entries.map(entry => ({ entry, via: null }));
    if (state.q.trim()) list = C.matchLexicon(entries, state.q, 5000);
    if (state.letter) list = list.filter(item => item.entry.s.startsWith(state.letter));
    if (state.page && pageIds) list = list.filter(item => pageIds.has(item.entry.id));
    return list;
  }

  function listItem({ entry, via }) {
    const li = node("li", "lexicon-item");
    const link = node("a", "lexicon-link");
    link.href = `lexicon.html?term=${encodeURIComponent(entry.id)}`;
    if (entry.id === state.term) link.setAttribute("aria-current", "true");
    link.append(hebrewNode("span", "hebrew-form", entry.f[0]));
    const meta = node("span", "lexicon-meta", [
      `${entry.n}×`,
      entry.a.length ? `“${entry.a[0]}”` : null,
      entry.f.length > 1 ? `${entry.f.length} spellings` : null,
      via && via !== "Hebrew spelling" ? via : null
    ].filter(Boolean).join(" · "));
    link.append(meta);
    link.addEventListener("click", event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      state.term = entry.id;
      syncUrl(true);
      render();
      showDetail(true);
    });
    li.append(link);
    return li;
  }

  function render() {
    const list = filtered();
    listEl.replaceChildren(...list.slice(0, state.shown).map(listItem));
    moreButton.hidden = list.length <= state.shown;
    moreButton.textContent = `Show more forms (${list.length - state.shown} remaining)`;
    clearButton.hidden = !input.value && !state.letter && !state.page;
    for (const chip of lettersEl.querySelectorAll("[data-letter]")) chip.setAttribute("aria-pressed", String(chip.dataset.letter === state.letter));
    scopeEl.hidden = !state.page;
    if (list.length) {
      setStatus(`${list.length} Hebrew form${list.length === 1 ? "" : "s"}${state.q ? ` matching “${state.q}”` : ""}. Showing ${Math.min(list.length, state.shown)}.`);
    } else {
      setStatus(state.q
        ? `No Hebrew forms match “${state.q}”. Try Hebrew letters (vowel marks optional) or the author’s transliteration, for example “Nachash”. Forms the author did not transliterate can only be found by their Hebrew letters.`
        : "No forms match these filters.");
    }
  }

  function syncUrl(push) {
    const params = new URLSearchParams();
    if (state.term) params.set("term", state.term);
    if (state.q) params.set("q", state.q);
    if (state.letter) params.set("letter", state.letter);
    if (state.page) params.set("page", state.page);
    const url = `${location.pathname}${params.toString() ? `?${params}` : ""}`;
    if (url !== `${location.pathname}${location.search}`) history[push ? "pushState" : "replaceState"](null, "", url);
  }

  const noteKinds = {
    "author-root-note": ["Author’s root note", "The manuscript states this root or gloss itself. It is the author’s interpretation, quoted verbatim."],
    "author-word-pair": ["Author’s transliteration and gloss", "Quoted verbatim from the manuscript."],
    "author-phrase-pair": ["Author’s phrase gloss", "This note is attached to a whole phrase containing the word; it does not necessarily define this word alone."]
  };

  function section(title, ...children) {
    const wrap = node("section", "lex-section");
    wrap.append(node("h3", "", title), ...children);
    return wrap;
  }

  async function showDetail(focus) {
    const entry = entries.find(item => item.id === state.term);
    if (!entry) {
      detailEl.replaceChildren(node("p", "empty-passage", "Choose a Hebrew form to see its spelling, the author’s notes, and every occurrence."));
      return;
    }
    detailEl.replaceChildren(node("p", "empty-passage", "Loading entry…"));
    try {
      const [, bucket] = await Promise.all([loadSections(), C.loadJson(detailFile(entry))]);
      const detail = bucket[entry.id];
      if (state.term !== entry.id) return;
      const out = [];
      out.push(node("p", "eyebrow", `Hebrew lexicon · ${entry.n} occurrence${entry.n === 1 ? "" : "s"}`));
      const title = hebrewNode("h2", "lex-title", entry.f[0]);
      title.tabIndex = -1;
      out.push(title);

      const spelling = node("ul", "lex-forms");
      for (const [form, count] of detail.forms) {
        const li = node("li");
        li.append(hebrewNode("span", "hebrew-form", form), node("small", "", ` ×${count}`));
        spelling.append(li);
      }
      out.push(section("Literal Hebrew spelling",
        node("p", "", "Pointed forms exactly as written in the manuscript:"), spelling,
        node("p", "lex-fact", ""),
      ));
      out[out.length - 1].lastChild.replaceChildren("Consonantal skeleton (vowel marks removed, final letters folded): ", hebrewNode("strong", "", entry.c));

      const translit = [];
      if (entry.a.length) translit.push(node("p", "", `As the author wrote it: ${entry.a.join("; ")}.`));
      else translit.push(node("p", "", "The manuscript gives no transliteration for this form on its own."));
      if (entry.p.length) translit.push(node("p", "", `In author-glossed phrases: ${entry.p.join("; ")}.`));
      translit.push(node("p", "lex-fact", `Automatic consonant-only romanization: ${entry.r} (not a pronunciation guide).`));
      out.push(section("Transliteration", ...translit));

      const rootNotes = detail.notes.filter(note => note.kind === "author-root-note");
      out.push(section("Grammatical root",
        node("p", "", rootNotes.length
          ? "The manuscript states a root for this form (shown below under the author’s notes). No independent morphological analysis has been added."
          : "No root is stated for this form in the manuscript, and none has been added here. This phase does not infer morphology.")));

      const external = node("a", "", "Look this word up on Sefaria (external)");
      external.href = `https://www.sefaria.org/search?q=${encodeURIComponent(entry.c)}`;
      external.target = "_blank";
      external.rel = "noreferrer noopener";
      const glossary = node("a", "", "Codex glossary");
      glossary.href = "../glossary.html";
      out.push(section("Lexical definition",
        node("p", "", "This edition adds no independent dictionary definition. Meanings the author gives appear below as the author’s own."),
        (() => { const p = node("p", "lex-fact"); p.append(external, " · See also the ", glossary, "."); return p; })()));

      const notes = node("div", "lex-notes");
      if (!detail.notes.length) notes.append(node("p", "", "The manuscript contains no gloss or root note attached to this form."));
      const seen = new Set();
      const unique = detail.notes.filter(note => { const key = `${note.line}|${note.context}`; if (seen.has(key)) return false; seen.add(key); return true; });
      const noteLimit = 12;
      const makeNote = note => {
        const info = tables.byId(note.segmentId);
        const box = node("blockquote", "lex-note");
        const [label, caution] = noteKinds[note.kind];
        box.append(node("span", "badge badge-author", label));
        const quote = node("p", "lex-quote", note.context);
        quote.dir = "auto";
        box.append(quote, node("small", "", caution));
        const links = node("p", "lex-links");
        const open = node("a", "", "Open in reader");
        open.href = info.href;
        links.append(open, " · ", C.sourceAnchor(info.sourceUrl, `Original line ${note.line} ↗`));
        box.append(links);
        return box;
      };
      unique.slice(0, noteLimit).forEach(note => notes.append(makeNote(note)));
      if (unique.length > noteLimit) {
        const more = node("button", "ghost-button", `Show ${unique.length - noteLimit} more notes`);
        more.type = "button";
        more.addEventListener("click", () => { unique.slice(noteLimit).forEach(note => notes.insertBefore(makeNote(note), more)); more.remove(); });
        notes.append(more);
      }
      out.push(section("The author’s notes and interpretation", notes));

      const where = node("div", "lex-where");
      if (entry.g.length) {
        const chapters = node("p", "lex-chapters");
        chapters.append("Genesis chapters: ");
        entry.g.forEach(chapter => {
          const g = sections.genesis[chapter - 1];
          const link = node("a", "chip chip-small", String(chapter));
          link.href = C.readerHref(g.sectionId, g.segmentId);
          link.setAttribute("aria-label", `Genesis chapter ${chapter}`);
          chapters.append(link, " ");
        });
        where.append(chapters);
      }
      const list = node("ol", "lex-occurrences");
      const makeOccurrence = ([line, segmentId]) => {
        const li = node("li");
        const info = segmentId ? tables.byId(segmentId) : null;
        if (info) {
          const link = node("a", "", `${info.page.title}${info.chapter ? "" : ""}`);
          link.href = info.href;
          li.append(link, node("small", "", ` · ${info.section.shelf.title} · `), C.sourceAnchor(info.sourceUrl.replace(/#L\d+$/, `#L${line}`), `Original line ${line} ↗`));
        } else li.append(`Original line ${line}`);
        return li;
      };
      const firstBatch = 40;
      detail.occurrences.slice(0, firstBatch).forEach(item => list.append(makeOccurrence(item)));
      where.append(list);
      if (detail.occurrences.length > firstBatch) {
        const more = node("button", "ghost-button", `Show all ${detail.occurrences.length} occurrences`);
        more.type = "button";
        more.addEventListener("click", () => { detail.occurrences.slice(firstBatch).forEach(item => list.append(makeOccurrence(item))); more.remove(); });
        where.append(more);
      }
      out.push(section(`Every occurrence in the original (${detail.lines.length} source lines)`, where));
      detailEl.replaceChildren(...out);
      document.title = `${entry.f[0]} — Hebrew lexicon — Scroll of Fire Library`;
      if (focus) { title.focus({ preventScroll: true }); detailEl.scrollIntoView({ block: "start" }); }
    } catch (error) {
      console.error(error);
      detailEl.replaceChildren(node("p", "reader-error", "This entry could not be loaded. Check your connection and try again."));
    }
  }

  async function loadPageFilter() {
    if (!state.page) { pageIds = null; return; }
    await loadSections();
    const row = sections.sections.find(item => item[0] === state.page);
    scopeEl.replaceChildren(`Showing Hebrew forms in: ${row ? row[1] : "one passage"} `);
    const remove = node("button", "ghost-button", "Show all forms");
    remove.type = "button";
    remove.addEventListener("click", () => { state.page = ""; pageIds = null; scopeEl.hidden = true; syncUrl(true); render(); });
    scopeEl.append(remove);
    const buckets = await Promise.all([...new Set(entries.map(detailFile))].map(file => C.loadJson(file)));
    pageIds = new Set();
    for (const bucket of buckets) {
      for (const [id, detail] of Object.entries(bucket)) {
        if (detail.occurrences.some(([, segmentId]) => segmentId && tables.byId(segmentId)?.page.id === state.page)) pageIds.add(id);
      }
    }
  }

  function readUrl() {
    const params = new URLSearchParams(location.search);
    state.q = params.get("q") ?? "";
    state.letter = params.get("letter") ?? "";
    state.page = /^section-[\w-]+$/.test(params.get("page") ?? "") ? params.get("page") : "";
    state.term = params.get("term") ?? "";
    state.shown = PAGE;
    input.value = state.q;
  }

  async function refresh(focus) {
    await loadPageFilter().catch(console.error);
    render();
    await showDetail(focus);
  }

  form.addEventListener("submit", event => { event.preventDefault(); state.q = input.value; state.shown = PAGE; render(); syncUrl(true); });
  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.q = input.value; state.shown = PAGE; render(); syncUrl(false); }, 200);
  });
  clearButton.addEventListener("click", () => { input.value = ""; state.q = ""; state.letter = ""; state.page = ""; pageIds = null; render(); syncUrl(true); input.focus(); });
  moreButton.addEventListener("click", () => { state.shown += PAGE; render(); });
  window.addEventListener("popstate", () => { readUrl(); refresh(false); });

  C.loadJson("search/lexicon/lexicon-index.json").then(index => {
    entries = index.entries;
    buildLetters();
    readUrl();
    return refresh(false);
  }).catch(error => {
    console.error(error);
    setStatus("The Hebrew lexicon could not be loaded. Check your connection and reload the page.", true);
  });
})();
