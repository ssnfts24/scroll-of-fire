"use strict";

(() => {
  const C = window.ScrollCommon;
  const { N, node } = C;
  const tabs = ["scriptures", "entities", "repeated", "years"];
  const tabButtons = [...document.querySelectorAll("[data-tab]")];
  const panels = Object.fromEntries(tabs.map(tab => [tab, document.querySelector(`[data-panel="${tab}"]`)]));
  const statusEl = document.querySelector("[data-atlas-status]");
  const params = new URLSearchParams(location.search);
  const loaded = new Set();
  let sections = null;
  let tables = null;

  const loadSections = () => C.loadJson("search/sections.json").then(value => {
    if (!sections) { sections = value; tables = C.tables(value); }
    return value;
  });

  function badge(type, label) { return node("span", `badge badge-${type}`, label); }

  function segmentItem(segmentId) {
    const info = tables.byId(segmentId);
    const li = node("li", "atlas-segment");
    if (!info) { li.textContent = segmentId; return li; }
    const link = node("a", "", info.page.title === info.section.title ? info.section.title : `${info.page.title} · ${info.section.title}`);
    link.href = info.href;
    li.append(link, node("small", "", ` · ${info.section.shelf.title} · `), C.sourceAnchor(info.sourceUrl, C.lineLabel(info.lineStart, info.lineEnd)));
    return li;
  }

  function fillList(list, ids, limit = 25) {
    ids.slice(0, limit).forEach(id => list.append(segmentItem(id)));
    if (ids.length > limit) {
      const row = node("li", "atlas-more");
      const more = node("button", "ghost-button", `Show all ${ids.length} passages`);
      more.type = "button";
      more.addEventListener("click", () => { row.remove(); ids.slice(limit).forEach(id => list.append(segmentItem(id))); });
      row.append(more);
      list.append(row);
    }
  }

  function lazyDetails(summaryChildren, fill, id) {
    const details = node("details", "atlas-details");
    if (id) details.id = id;
    const summary = node("summary");
    summary.append(...summaryChildren);
    details.append(summary);
    let filled = false;
    const ensure = () => { if (!filled && details.open) { filled = true; details.append(fill()); } };
    details.addEventListener("toggle", ensure);
    details.ensure = ensure;
    return details;
  }

  function filterBox(label, onInput) {
    const wrap = node("div", "atlas-filter");
    const id = `filter-${Math.random().toString(36).slice(2, 8)}`;
    const labelEl = node("label", "", label);
    labelEl.htmlFor = id;
    const field = node("input");
    field.type = "search";
    field.id = id;
    field.autocomplete = "off";
    field.addEventListener("input", () => onInput(field.value));
    wrap.append(labelEl, field);
    return wrap;
  }

  function lazyList(container, items, build, pageSize = 40) {
    let shown = 0;
    const more = node("button", "ghost-button", "Show more");
    more.type = "button";
    const draw = () => {
      items.slice(shown, shown + pageSize).forEach(item => container.insertBefore(build(item), more));
      shown = Math.min(items.length, shown + pageSize);
      more.hidden = shown >= items.length;
      more.textContent = `Show more (${items.length - shown} remaining)`;
    };
    more.addEventListener("click", draw);
    container.append(more);
    draw();
  }

  /* ---------- scripture ---------- */
  async function buildScriptures() {
    const [data] = await Promise.all([C.loadJson("search/atlas/scriptures.json"), loadSections()]);
    const panel = panels.scriptures;
    const intro = node("p", "atlas-note", data.note);
    const genesisBlock = node("section", "atlas-block");
    genesisBlock.append(node("h2", "", "Genesis 1–50 in the manuscript"));
    genesisBlock.append(node("p", "atlas-note", "All fifty chapters are presented in the reading edition. These are the manuscript’s own chapters, which paraphrase or group verses; they are not counted as citations."));
    const grid = node("div", "chapter-grid atlas-chapters");
    for (const entry of sections.genesis) {
      const link = node("a", "chapter-link", String(entry.chapter));
      link.href = C.readerHref(entry.sectionId, entry.segmentId);
      link.setAttribute("aria-label", `Genesis chapter ${entry.chapter}`);
      grid.append(link);
    }
    genesisBlock.append(grid);
    const refsBlock = node("section", "atlas-block");
    refsBlock.append(node("h2", "", `Scripture named in the text (${data.count} references)`));
    const holder = node("div", "atlas-groups");
    const byBook = new Map();
    for (const ref of data.references) {
      if (!byBook.has(ref.book)) byBook.set(ref.book, []);
      byBook.get(ref.book).push(ref);
    }
    const bookNodes = [];
    for (const [book, refs] of byBook) {
      const total = refs.reduce((sum, ref) => sum + ref.segments.length, 0);
      const group = lazyDetails([node("strong", "", book), node("span", "atlas-count", ` ${refs.length} reference${refs.length === 1 ? "" : "s"} · ${total} passage${total === 1 ? "" : "s"}`)], () => {
        const wrapper = node("div", "atlas-inner");
        for (const ref of refs) {
          const detail = lazyDetails([badge("citation", "Direct citation"), node("strong", "", ` ${ref.ref}`), node("span", "atlas-count", ` ${ref.segments.length} passage${ref.segments.length === 1 ? "" : "s"}`)], () => {
            const list = node("ul", "atlas-list");
            fillList(list, ref.segments);
            return list;
          }, `ref-${N.normalize(ref.ref).replace(/ /g, "-")}`);
          detail.dataset.ref = ref.ref;
          wrapper.append(detail);
        }
        return wrapper;
      });
      group.dataset.book = book;
      bookNodes.push(group);
    }
    holder.append(...bookNodes);
    refsBlock.append(filterBox("Filter references (for example “Revelation 18”)", value => {
      const q = N.normalize(value);
      for (const group of bookNodes) group.hidden = Boolean(q) && !N.normalize(group.dataset.book).includes(q.split(" ")[0]) && !N.normalize(group.dataset.book + " " + [...byBook.get(group.dataset.book)].map(ref => ref.ref).join(" ")).includes(q);
    }), holder);
    panel.append(intro, genesisBlock, refsBlock);
    const wanted = params.get("ref");
    if (wanted) {
      const book = bookNodes.find(group => wanted.startsWith(group.dataset.book));
      if (book) {
        book.open = true;
        book.ensure();
        const target = [...book.querySelectorAll("[data-ref]")].find(item => item.dataset.ref === wanted);
        if (target) { target.open = true; target.ensure(); target.scrollIntoView({ block: "center" }); }
      }
    }
  }

  /* ---------- entities ---------- */
  async function buildEntities() {
    const [data] = await Promise.all([C.loadJson("search/atlas/entities.json"), loadSections()]);
    const panel = panels.entities;
    panel.append(node("p", "atlas-note", data.note));
    const typeLabels = { person: "People", place: "Places", subject: "Subjects" };
    const container = node("div", "atlas-groups");
    const nodes = data.entities.map(entity => {
      const details = lazyDetails([badge("subject", "Shared subject"), node("strong", "", ` ${entity.label}`), node("span", "atlas-count", ` ${typeLabels[entity.type] ?? entity.type} · ${entity.segments.length} passage${entity.segments.length === 1 ? "" : "s"}`)], () => {
        const wrap = node("div", "atlas-inner");
        wrap.append(node("p", "atlas-note", `Matched by name: ${entity.aliases.join(", ")}. Mentions are listed in reading order; appearing together does not establish a connection.`));
        const list = node("ul", "atlas-list");
        fillList(list, entity.segments);
        wrap.append(list);
        return wrap;
      }, entity.id);
      details.dataset.type = entity.type;
      details.dataset.label = N.normalize(`${entity.label} ${entity.aliases.join(" ")}`);
      return details;
    });
    container.append(...nodes);
    const typeBar = node("fieldset", "shelf-filters");
    typeBar.append(node("legend", "", "Type"));
    let type = "";
    let text = "";
    const apply = () => nodes.forEach(item => { item.hidden = (type && item.dataset.type !== type) || (text && !item.dataset.label.includes(text)); });
    for (const [value, label] of [["", "All"], ["person", "People"], ["place", "Places"], ["subject", "Subjects"]]) {
      const chip = node("button", "chip", label);
      chip.type = "button";
      chip.setAttribute("aria-pressed", String(value === ""));
      chip.addEventListener("click", () => { type = value; typeBar.querySelectorAll("button").forEach(button => button.setAttribute("aria-pressed", String(button === chip))); apply(); });
      typeBar.append(chip);
    }
    panel.append(typeBar, filterBox("Filter by name", value => { text = N.normalize(value); apply(); }), container);
    const wanted = params.get("entity");
    const target = wanted && nodes.find(item => item.id === wanted);
    if (target) { target.open = true; target.ensure(); target.scrollIntoView({ block: "center" }); }
  }

  /* ---------- repeated passages ---------- */
  async function buildRepeated() {
    const [data] = await Promise.all([C.loadJson("search/atlas/repeated.json"), loadSections()]);
    const panel = panels.repeated;
    panel.append(node("p", "atlas-note", data.note));
    const headingBlock = node("section", "atlas-block");
    headingBlock.append(node("h2", "", `Headings that occur more than once (${data.headingGroups.length})`));
    const headingList = node("div", "atlas-groups");
    const headingNodes = [];
    const makeHeading = group => {
      const details = lazyDetails([badge("repeat", "Repeated passage"), node("strong", "", ` ${group.title}`), node("span", "atlas-count", ` ${group.sectionIds.length} occurrences`)], () => {
        const list = node("ol", "atlas-list");
        group.sectionIds.forEach((id, index) => {
          const row = tables.rows.find(item => item.id === id);
          const li = node("li", "atlas-segment");
          const link = node("a", "", `Occurrence ${index + 1}`);
          link.href = C.readerHref(id, sections.segIds[sections.segSection.indexOf(tables.rows.indexOf(row))] ?? id);
          li.append(link, node("small", "", ` · ${row.shelf.title} · `), C.sourceAnchor(`${sections.sourceUrl}#L${row.line}`, `Original line ${row.line}`));
          list.append(li);
        });
        return list;
      });
      details.dataset.label = N.normalize(group.title);
      return details;
    };
    headingBlock.append(filterBox("Filter repeated headings", value => {
      const q = N.normalize(value);
      headingNodes.forEach(item => { item.hidden = Boolean(q) && !item.dataset.label.includes(q); });
    }), headingList);
    lazyList(headingList, data.headingGroups, group => { const item = makeHeading(group); headingNodes.push(item); return item; });
    const textBlock = node("section", "atlas-block");
    textBlock.append(node("h2", "", `Identical passages repeated in the original (${data.identicalTextGroups.length})`));
    const textList = node("div", "atlas-groups");
    textBlock.append(textList);
    lazyList(textList, data.identicalTextGroups, group => lazyDetails([badge("repeat", "Repeated passage"), node("span", "atlas-excerpt", ` ${group.excerpt.replace(/\s+/g, " ").slice(0, 110)}…`), node("span", "atlas-count", ` ${group.segmentIds.length} occurrences`)], () => {
      const list = node("ol", "atlas-list");
      group.segmentIds.forEach(id => list.append(segmentItem(id)));
      return list;
    }));
    panel.append(headingBlock, textBlock);
  }

  /* ---------- years ---------- */
  async function buildYears() {
    const [data] = await Promise.all([C.loadJson("search/atlas/years.json"), loadSections()]);
    const panel = panels.years;
    panel.append(node("p", "atlas-note", data.note));
    const decades = new Map();
    for (const item of data.years) {
      const decade = Math.floor(item.year / 10) * 10;
      if (!decades.has(decade)) decades.set(decade, []);
      decades.get(decade).push(item);
    }
    const container = node("div", "atlas-groups");
    for (const [decade, years] of decades) {
      const total = years.reduce((sum, item) => sum + item.segments.length, 0);
      container.append(lazyDetails([node("strong", "", `${decade}s`), node("span", "atlas-count", ` ${years.length} year${years.length === 1 ? "" : "s"} · ${total} mention${total === 1 ? "" : "s"}`)], () => {
        const inner = node("div", "atlas-inner");
        for (const item of years) {
          inner.append(lazyDetails([badge("subject", "Shared subject"), node("strong", "", ` ${item.year}`), node("span", "atlas-count", ` ${item.segments.length} passage${item.segments.length === 1 ? "" : "s"}`)], () => {
            const list = node("ul", "atlas-list");
            fillList(list, item.segments, 15);
            return list;
          }));
        }
        return inner;
      }));
    }
    panel.append(container);
  }

  const builders = { scriptures: buildScriptures, entities: buildEntities, repeated: buildRepeated, years: buildYears };

  async function activate(tab, { push = false } = {}) {
    for (const button of tabButtons) {
      const on = button.dataset.tab === tab;
      button.setAttribute("aria-selected", String(on));
      button.tabIndex = on ? 0 : -1;
      panels[button.dataset.tab].hidden = !on;
    }
    if (push && location.hash !== `#${tab}`) history.pushState(null, "", `${location.pathname}${location.search}#${tab}`);
    if (loaded.has(tab)) return;
    loaded.add(tab);
    statusEl.textContent = "Loading…";
    try {
      await builders[tab]();
      statusEl.textContent = "";
    } catch (error) {
      console.error(error);
      loaded.delete(tab);
      statusEl.classList.add("is-error");
      statusEl.textContent = "This view could not be loaded. Check your connection, then choose the tab again.";
    }
  }

  tabButtons.forEach(button => {
    button.addEventListener("click", () => activate(button.dataset.tab, { push: true }));
    button.addEventListener("keydown", event => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      const index = tabButtons.indexOf(button);
      const next = tabButtons[(index + (event.key === "ArrowRight" ? 1 : -1) + tabButtons.length) % tabButtons.length];
      next.focus();
      activate(next.dataset.tab, { push: true });
    });
  });
  const hashTab = location.hash.slice(1);
  const initial = params.get("entity") ? "entities" : params.get("ref") ? "scriptures" : (tabs.includes(hashTab) ? hashTab : "scriptures");
  window.addEventListener("popstate", () => activate(tabs.includes(location.hash.slice(1)) ? location.hash.slice(1) : "scriptures"));
  activate(initial);
})();
