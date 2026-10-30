"use strict";

(() => {
  const C = window.ScrollCommon;
  const { N, node } = C;
  const form = document.querySelector("[data-search-form]");
  const input = document.querySelector("[data-search-input]");
  const clearButton = document.querySelector("[data-search-clear]");
  const statusEl = document.querySelector("[data-status]");
  const resultsEl = document.querySelector("[data-results]");
  const moreButton = document.querySelector("[data-more]");
  const quickEl = document.querySelector("[data-quick]");
  const scopeEl = document.querySelector("[data-scope]");
  const chips = [...document.querySelectorAll("[data-shelf]")];
  const PAGE_SIZE = 10;
  const CHUNK_SIZE = 40;

  const state = { q: "", shelf: "", page: "", shown: PAGE_SIZE };
  let runId = 0;
  let current = null;
  let data = null;
  let tables = null;

  const loadSections = () => C.loadJson("search/sections.json").then(value => {
    if (!data) {
      data = value;
      tables = C.tables(value);
    }
    return value;
  });
  const shardUrl = key => `search/index/ix-${C.hexOf(key)}.json`;
  const textUrl = chunk => `search/text/t-${String(chunk).padStart(3, "0")}.json`;

  function parseQuery(raw) {
    const trimmed = raw.trim();
    const quoted = /^["“„](.+?)["”]$/.exec(trimmed);
    const tokens = N.tokenize(quoted ? quoted[1] : trimmed);
    return { raw: trimmed, tokens, phrase: Boolean(quoted) && tokens.length > 1, normalized: tokens.join(" ") };
  }

  const allowPrefix = token => (N.hasHebrew(token) ? [...token].length >= 2 : token.length >= 3);

  function tokenMatcher(token) {
    const prefix = allowPrefix(token);
    const hebrew = N.hasHebrew(token);
    return value => {
      if (value === token) return 1;
      if (prefix && value.startsWith(token)) return 0.6;
      if (hebrew && [...token].length >= 2 && C.PARTICLES.some(particle => value === particle + token)) return 0.8;
      return 0;
    };
  }

  async function postingsFor(token) {
    const keys = new Set();
    const chars = [...token];
    keys.add(chars.slice(0, 2).join(""));
    if (N.hasHebrew(token) && chars.length >= 2) for (const particle of C.PARTICLES) keys.add(particle + chars[0]);
    const available = new Set(data.shards);
    const matcher = tokenMatcher(token);
    const found = new Map();
    await Promise.all([...keys].filter(key => available.has(key)).map(async key => {
      const shard = await C.loadJson(shardUrl(key));
      for (const [indexToken, posting] of Object.entries(shard)) {
        const weight = matcher(indexToken);
        if (!weight) continue;
        let ordinal = 0;
        posting.d.forEach((delta, i) => {
          ordinal += delta;
          const score = weight * (1 + Math.log(posting.f[i]));
          found.set(ordinal, (found.get(ordinal) ?? 0) + score);
        });
      }
    }));
    const idf = Math.log(1 + data.segIds.length / Math.max(1, found.size));
    for (const [ordinal, score] of found) found.set(ordinal, score * idf);
    return found;
  }

  async function exactTokenPostings(token) {
    const key = [...token].slice(0, 2).join("");
    if (!data.shards.includes(key)) return new Map();
    const shard = await C.loadJson(shardUrl(key));
    const posting = shard[token];
    if (!posting) return new Map();
    const found = new Map();
    let ordinal = 0;
    posting.d.forEach((delta, index) => {
      ordinal += delta;
      let position = 0;
      const positions = posting.p[index].map(positionDelta => {
        position += positionDelta;
        return position;
      });
      found.set(ordinal, { positions, frequency: posting.f[index] });
    });
    return found;
  }

  async function exactPhrasePostings(query) {
    const perToken = await Promise.all(query.tokens.map(exactTokenPostings));
    if (perToken.some(posting => !posting.size)) return new Map();
    const idfs = perToken.map(posting => Math.log(1 + data.segIds.length / posting.size));
    const result = new Map();
    const positionsByToken = perToken.map(posting => new Map(
      [...posting].map(([ordinal, value]) => [ordinal, new Set(value.positions)])
    ));
    for (const [ordinal, first] of perToken[0]) {
      if (perToken.slice(1).some(posting => !posting.has(ordinal))) continue;
      const positionSets = positionsByToken.slice(1).map(posting => posting.get(ordinal));
      const phraseHit = first.positions.some(position =>
        positionSets.every((positions, offset) => positions.has(position + offset + 1))
      );
      if (!phraseHit) continue;
      const score = perToken.reduce((total, posting, index) =>
        total + (1 + Math.log(posting.get(ordinal).frequency)) * idfs[index], 0);
      result.set(ordinal, score * 2.5);
    }
    return result;
  }

  async function runSearch(query) {
    await loadSections();
    if (query.phrase) return { combined: await exactPhrasePostings(query), partial: false };
    const perToken = await Promise.all(query.tokens.map(postingsFor));
    let combined = new Map();
    let partial = false;
    const [first, ...rest] = perToken;
    for (const [ordinal, score] of first ?? []) {
      let total = score;
      if (rest.every(map => map.has(ordinal) && (total += map.get(ordinal), true))) combined.set(ordinal, total);
    }
    if (!combined.size && perToken.length > 1 && !query.phrase) {
      partial = true;
      for (const map of perToken) for (const [ordinal, score] of map) combined.set(ordinal, (combined.get(ordinal) ?? 0) + score);
    }
    return { combined, partial };
  }

  const shelfOf = ordinal => data.sections[data.segSection[ordinal]][2];
  const pageIdOf = ordinal => data.sections[data.sections[data.segSection[ordinal]][4]][0];

  async function fetchTexts(ordinals) {
    const chunks = [...new Set(ordinals.map(ordinal => Math.floor(ordinal / CHUNK_SIZE)))];
    const loaded = new Map(await Promise.all(chunks.map(async chunk => [chunk, await C.loadJson(textUrl(chunk))])));
    return ordinal => loaded.get(Math.floor(ordinal / CHUNK_SIZE))[ordinal % CHUNK_SIZE];
  }

  async function loadPage(from, to, id) {
    const entries = current.results.slice(from, to);
    if (!entries.length) return;
    const textOf = await fetchTexts(entries.map(entry => entry.ordinal));
    if (id !== runId || !current || current.id !== id) return;
    for (const entry of entries) entry.text = textOf(entry.ordinal);
  }

  function wordsOf(text) {
    const words = [];
    for (const match of text.matchAll(/[\p{L}\p{N}\p{M}]+/gu)) {
      words.push({ start: match.index, end: match.index + match[0].length, norm: N.normalize(match[0]) });
    }
    return words;
  }

  function buildExcerpt(text, query) {
    const matchers = query.tokens.map(tokenMatcher);
    const words = wordsOf(text);
    const hit = word => matchers.some(matcher => matcher(word.norm));
    let anchor = -1;
    if (query.tokens.length > 1) {
      for (let i = 0; i + query.tokens.length <= words.length && anchor < 0; i += 1) {
        if (query.tokens.every((_, k) => matchers[k](words[i + k].norm))) anchor = i;
      }
    }
    if (anchor < 0) anchor = words.findIndex(hit);
    const focus = anchor < 0 ? 0 : words[anchor].start;
    let start = Math.max(0, focus - 110);
    if (start > 0) {
      const space = text.slice(start, start + 30).search(/\s/);
      if (space >= 0) start += space + 1;
    }
    const end = Math.min(text.length, start + 320);
    const fragment = document.createDocumentFragment();
    if (start > 0) fragment.append("… ");
    let cursor = start;
    for (const word of words) {
      if (word.end <= start || word.start >= end || !hit(word)) continue;
      const from = Math.max(word.start, start);
      fragment.append(text.slice(cursor, from).replace(/\s+/g, " "));
      fragment.append(node("mark", "", text.slice(from, Math.min(word.end, end))));
      cursor = Math.min(word.end, end);
    }
    fragment.append(text.slice(cursor, end).replace(/\s+/g, " "));
    if (end < text.length) fragment.append(" …");
    return fragment;
  }

  function resultItem(entry, query) {
    const d = tables.describe(entry.ordinal);
    const item = node("li", "result");
    const meta = node("div", "result-meta");
    meta.append(node("span", "badge badge-shelf", d.section.shelf.title));
    if (d.chapter) meta.append(node("span", "result-chapter", `Genesis ${d.chapter}`));
    if (entry.phrase) meta.append(node("span", "result-chapter", "Exact phrase"));
    const heading = node("h3", "result-heading");
    const title = node("a", "result-title", d.page.title === d.section.title ? d.section.title : `${d.page.title} · ${d.section.title}`);
    title.href = d.href;
    heading.append(title);
    const excerpt = node("p", "result-excerpt");
    excerpt.dir = "auto";
    excerpt.append(buildExcerpt(entry.text, query));
    const source = node("p", "result-source");
    source.append(node("span", "", `Reading edition: ${d.page.title} · passage ${d.id.replace("segment-line-", "")}`));
    source.append(C.sourceAnchor(d.sourceUrl, C.lineLabel(d.lineStart, d.lineEnd)));
    item.append(meta, heading, excerpt, source);
    return item;
  }

  function renderResults() {
    resultsEl.replaceChildren();
    moreButton.disabled = false;
    if (!current) return;
    for (const entry of current.results.slice(0, state.shown)) resultsEl.append(resultItem(entry, current.query));
    moreButton.hidden = current.results.length <= state.shown;
    moreButton.textContent = `Show more results (${Math.min(PAGE_SIZE, current.results.length - state.shown)} of ${current.results.length - state.shown} remaining)`;
  }

  function setStatus(message, error) {
    statusEl.replaceChildren();
    statusEl.append(message);
    statusEl.classList.toggle("is-error", Boolean(error));
  }

  function updateChips(counts) {
    for (const chip of chips) {
      const id = chip.dataset.shelf;
      const base = chip.dataset.label ?? (chip.dataset.label = chip.textContent);
      chip.textContent = counts && id ? `${base} (${counts.get(id) ?? 0})` : (counts && !id ? `${base} (${[...counts.values()].reduce((a, b) => a + b, 0)})` : base);
      chip.setAttribute("aria-pressed", String(id === state.shelf));
    }
  }

  function syncUrl(push) {
    const params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    if (state.shelf) params.set("shelf", state.shelf);
    if (state.page) params.set("page", state.page);
    const url = `${location.pathname}${params.toString() ? `?${params}` : ""}`;
    if (url !== `${location.pathname}${location.search}`) history[push ? "pushState" : "replaceState"](null, "", url);
  }

  function reset() {
    runId += 1;
    current = null;
    resultsEl.replaceChildren();
    quickEl.hidden = true;
    quickEl.replaceChildren();
    moreButton.hidden = true;
    updateChips(null);
    clearButton.hidden = !input.value;
    setStatus("Enter a word or phrase to search. Press / to focus the search box.");
  }

  async function execute({ push = false } = {}) {
    const id = ++runId;
    const query = parseQuery(state.q);
    clearButton.hidden = !input.value;
    updateChips(null);
    if (!query.tokens.length) { reset(); syncUrl(push); return; }
    syncUrl(push);
    setStatus("Searching the manuscript…");
    try {
      await loadSections();
      const { combined, partial } = await runSearch(query);
      if (id !== runId) return;
      const shelfIds = data.shelves.map(shelf => shelf.id);
      const counts = new Map();
      let candidates = [...combined.entries()].map(([ordinal, score]) => ({ ordinal, score }));
      for (const candidate of candidates) {
        const shelfId = shelfIds[shelfOf(candidate.ordinal)];
        counts.set(shelfId, (counts.get(shelfId) ?? 0) + 1);
      }
      if (state.shelf) candidates = candidates.filter(c => shelfIds[shelfOf(c.ordinal)] === state.shelf);
      if (state.page) candidates = candidates.filter(c => pageIdOf(c.ordinal) === state.page);
      const qn = query.normalized;
      candidates = candidates.map(candidate => {
        const section = data.sections[data.segSection[candidate.ordinal]];
        const titleHit = N.normalize(section[1]).includes(qn);
        return { ...candidate, phrase: query.phrase, score: candidate.score * (titleHit ? 1.3 : 1) };
      });
      candidates.sort((a, b) => b.score - a.score || a.ordinal - b.ordinal);
      current = { id, query, results: candidates, partial, counts };
      state.shown = Math.min(PAGE_SIZE, candidates.length);
      await loadPage(0, state.shown, id);
      if (id !== runId) return;
      updateChips(query.phrase ? null : counts);
      renderResults();
      describeStatus(query, candidates, partial, counts);
      renderQuick(query, id);
    } catch (error) {
      if (id !== runId) return;
      console.error("Scroll search failed:", error);
      resultsEl.replaceChildren();
      statusEl.classList.add("is-error");
      statusEl.replaceChildren("Search data could not be loaded. Check your connection, then ");
      const retry = node("button", "ghost-button", "try again");
      retry.type = "button";
      retry.addEventListener("click", () => execute());
      statusEl.append(retry, ". You can still ", Object.assign(node("a", "", "browse every source section"), { href: "./#full-index" }), ".");
    }
  }

  function describeStatus(query, results, partial, counts) {
    statusEl.classList.remove("is-error");
    const shelfTitle = state.shelf ? data.shelves.find(shelf => shelf.id === state.shelf)?.title : null;
    const scope = [shelfTitle ? `the ${shelfTitle} shelf` : null, state.page ? "this passage" : null].filter(Boolean).join(" and ");
    if (!results.length) {
      const other = [...counts.entries()].filter(([, count]) => count).map(([id, count]) => `${data.shelves.find(shelf => shelf.id === id).title} (${count})`);
      const message = node("span", "", "");
      message.append(`No passages match “${query.raw}”${scope ? ` in ${scope}` : ""}. `);
      if ((state.shelf || state.page) && other.length) message.append(`Matches exist elsewhere: ${other.join(", ")}. Try “All shelves”. `);
      else message.append("Try fewer or different words, check the spelling, or search without quotation marks. Hebrew can be typed with or without vowel marks. ");
      message.append(Object.assign(node("a", "", "Browse every source section"), { href: "./#full-index" }), ".");
      statusEl.replaceChildren(message);
      return;
    }
    const shown = Math.min(state.shown, results.length);
    const lead = partial ? "No passage contains every word; showing passages with some of them. " : "";
    statusEl.replaceChildren(`${lead}${results.length} passage${results.length === 1 ? "" : "s"} match “${query.raw}”${scope ? ` in ${scope}` : ""}. Showing ${shown}.`);
  }

  /* ---------- related quick matches: Genesis, scripture, subjects, Hebrew lexicon ---------- */
  const bookAliases = { rev: "revelation", isa: "isaiah", ps: "psalms", psalm: "psalms", matt: "matthew", rom: "romans", dan: "daniel", jer: "jeremiah", ezek: "ezekiel", exod: "exodus", ex: "exodus", deut: "deuteronomy", heb: "hebrews", gen: "genesis", cor: "corinthians" };

  function quickCard(kind, title, bodyNodes, href) {
    const card = node("article", "quick-card");
    card.append(node("p", "eyebrow", kind));
    const heading = node("h3", "", "");
    if (href) { const link = node("a", "", title); link.href = href; heading.append(link); } else heading.textContent = title;
    card.append(heading, ...bodyNodes);
    return card;
  }

  async function renderQuick(query, id) {
    const cards = [];
    const genesis = /^\s*(?:genesis|gen)\.?\s*(?:chapter\s*|ch\.?\s*)?(\d{1,2})(?:\s*:\s*\d{1,3})?\s*$/i.exec(query.raw);
    if (genesis && Number(genesis[1]) >= 1 && Number(genesis[1]) <= 50) {
      const entry = data.genesis[Number(genesis[1]) - 1];
      const info = tables.byId(entry.segmentId);
      const note = node("p", "", "Opens the manuscript’s Genesis chapter as presented in the reading edition. Verse-level boundaries are not marked in the preserved text.");
      const source = C.sourceAnchor(info.sourceUrl, C.lineLabel(info.lineStart, info.lineStart));
      cards.push(quickCard("Genesis chapter", `Genesis ${entry.chapter} — open chapter`, [note, source], C.readerHref(entry.sectionId, entry.segmentId)));
    }
    const tokens = query.tokens.map(token => bookAliases[token] ?? token);
    const looksLikeRef = tokens.length >= 2 && /^\d+$/.test(tokens[tokens.length - 1]);
    const pending = [];
    if (looksLikeRef) {
      pending.push(C.loadJson("search/atlas/scriptures.json").then(atlas => {
        const matches = atlas.references.filter(ref => {
          const refTokens = N.tokenize(ref.ref);
          return tokens.length <= refTokens.length && tokens.every((token, i) => refTokens[i] === token);
        }).slice(0, 8);
        if (!matches.length) return;
        const list = node("ul", "quick-list");
        for (const ref of matches) {
          const li = node("li");
          li.append(`${ref.ref}: `);
          ref.segments.slice(0, 3).forEach((segmentId, index) => {
            const info = tables.byId(segmentId);
            const link = node("a", "", `line ${info.lineStart}`);
            link.href = info.href;
            if (index) li.append(", ");
            li.append(link);
          });
          if (ref.segments.length > 3) li.append(` (+${ref.segments.length - 3} more)`);
          list.append(li);
        }
        cards.push(quickCard("Direct citation", "Cited in the manuscript", [node("p", "", "These references are named in the text. A citation shows what the author cites, not independent verification."), list]));
      }).catch(() => {}));
    }
    pending.push(C.loadJson("search/atlas/entity-index.json").then(index => {
      const q = query.normalized;
      const hits = index.entities.filter(entity => [entity.label, ...entity.aliases].some(name => {
        const n = N.normalize(name);
        return n === q || (q.length >= 3 && n.startsWith(q));
      })).slice(0, 4);
      if (!hits.length) return;
      const list = node("ul", "quick-list");
      for (const entity of hits) {
        const li = node("li");
        const link = node("a", "", entity.label);
        link.href = `atlas.html?entity=${encodeURIComponent(entity.id)}#entities`;
        li.append(link, ` — ${entity.type}, ${entity.count} passages`);
        list.append(li);
      }
      cards.push(quickCard("Shared subject", "In the reference atlas", [node("p", "", "A shared name or subject is a navigation aid, not proof of a historical or causal connection."), list]));
    }).catch(() => {}));
    pending.push(C.loadJson("search/lexicon/lexicon-index.json").then(index => {
      const matches = C.matchLexicon(index.entries, query.raw, 5);
      if (!matches.length) return;
      const list = node("ul", "quick-list");
      for (const { entry, via } of matches) {
        const li = node("li");
        const link = node("a", "hebrew-inline", entry.f[0]);
        link.lang = "he";
        link.dir = "rtl";
        link.href = `lexicon.html?term=${encodeURIComponent(entry.id)}`;
        li.append(link, ` — ${entry.n} occurrence${entry.n === 1 ? "" : "s"}${entry.a.length ? ` · author’s transliteration: ${entry.a.join(", ")}` : ""} · ${via}`);
        list.append(li);
      }
      cards.push(quickCard("Hebrew lexicon", "Hebrew forms matching your search", [list]));
    }).catch(() => {}));
    await Promise.all(pending);
    if (id !== runId) return;
    quickEl.replaceChildren(...cards);
    quickEl.hidden = !cards.length;
  }

  /* ---------- controls ---------- */
  form.addEventListener("submit", event => {
    event.preventDefault();
    clearTimeout(timer);
    state.q = input.value;
    state.shown = PAGE_SIZE;
    execute({ push: true });
  });
  let timer = null;
  input.addEventListener("input", () => {
    runId += 1;
    clearButton.hidden = !input.value;
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.q = input.value;
      state.shown = PAGE_SIZE;
      if (N.tokenize(state.q).length) execute();
      else { reset(); syncUrl(false); }
    }, 300);
  });
  clearButton.addEventListener("click", () => {
    clearTimeout(timer);
    runId += 1;
    input.value = "";
    state.q = "";
    state.page = "";
    reset();
    renderScope();
    syncUrl(true);
    input.focus();
  });
  for (const chip of chips) {
    chip.addEventListener("click", () => {
      state.shelf = chip.dataset.shelf;
      state.shown = PAGE_SIZE;
      for (const other of chips) other.setAttribute("aria-pressed", String(other === chip));
      execute({ push: true });
    });
  }
  moreButton.addEventListener("click", async () => {
    const previous = state.shown;
    const next = Math.min(current.results.length, state.shown + PAGE_SIZE);
    const id = current.id;
    moreButton.disabled = true;
    moreButton.textContent = "Loading more results…";
    try {
      await loadPage(previous, next, id);
      if (!current || current.id !== id || id !== runId) return;
      state.shown = next;
      renderResults();
      describeStatus(current.query, current.results, current.partial, current.counts);
      resultsEl.children[previous]?.querySelector("a")?.focus();
    } catch (error) {
      if (!current || current.id !== id || id !== runId) return;
      console.error("Could not load additional search results:", error);
      statusEl.classList.add("is-error");
      statusEl.textContent = "More results could not be loaded. Activate “Retry loading more results” to try again.";
      moreButton.textContent = "Retry loading more results";
    } finally {
      if (current?.id === id && id === runId) moreButton.disabled = false;
    }
  });
  input.addEventListener("keydown", event => {
    if (event.key === "ArrowDown") {
      const first = resultsEl.querySelector(".result-title");
      if (first) { event.preventDefault(); first.focus(); }
    } else if (event.key === "Escape" && input.value) {
      input.value = "";
      input.dispatchEvent(new Event("input"));
    }
  });
  resultsEl.addEventListener("keydown", event => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const links = [...resultsEl.querySelectorAll(".result-title")];
    const index = links.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    if (event.key === "ArrowUp" && index === 0) input.focus();
    else links[Math.max(0, Math.min(links.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))].focus();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !/^(input|textarea|select)$/i.test(document.activeElement?.tagName ?? "")) {
      event.preventDefault();
      input.focus();
      input.select();
    }
  });

  async function renderScope() {
    scopeEl.hidden = !state.page;
    scopeEl.replaceChildren();
    if (!state.page) return;
    try {
      await loadSections();
      const row = data.sections.find(section => section[0] === state.page);
      scopeEl.append(`Searching within: ${row ? row[1] : "one passage"} `);
      const remove = node("button", "ghost-button", "Search everywhere");
      remove.type = "button";
      remove.addEventListener("click", () => { state.page = ""; renderScope(); execute({ push: true }); });
      scopeEl.append(remove);
    } catch { scopeEl.hidden = true; }
  }

  function readUrl() {
    const params = new URLSearchParams(location.search);
    state.q = params.get("q") ?? "";
    const shelf = params.get("shelf") ?? "";
    state.shelf = chips.some(chip => chip.dataset.shelf === shelf) ? shelf : "";
    state.page = /^section-[\w-]+$/.test(params.get("page") ?? "") ? params.get("page") : "";
    state.shown = PAGE_SIZE;
    input.value = state.q;
    for (const chip of chips) chip.setAttribute("aria-pressed", String(chip.dataset.shelf === state.shelf));
  }

  window.addEventListener("popstate", () => { readUrl(); renderScope(); execute(); });
  readUrl();
  renderScope();
  if (state.q) execute();
  else clearButton.hidden = true;
})();
