"use strict";

(() => {
  const dataUrl = new URL("data/library.json", document.baseURI);
  const segmentUrl = new URL("data/reader-segments.json", document.baseURI);
  const page = document.querySelector("[data-reading]");
  const passageTarget = document.querySelector("[data-passage]");
  const params = new URLSearchParams(location.search);
  const selectedId = params.get("section");
  const textScaleKey = "sof-scroll-text-scale";
  const themeKey = "sof-scroll-theme";

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function sourceLink(url, line, label = `Original line ${line}`) {
    const link = node("a", "source-link", label);
    link.href = url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.setAttribute("aria-label", `${label} in the original manuscript, opens in a new tab`);
    return link;
  }

  function renderSegment(segment) {
    const isHeading = segment.kind === "heading";
    const content = node(isHeading ? "h2" : "p", isHeading ? "passage-heading" : "passage-text");
    content.id = segment.id;
    content.tabIndex = -1;
    content.dir = "auto";
    content.classList.add("passage");
    content.textContent = segment.text;
    const wrapper = node("div", `passage-block${isHeading ? " passage-block-heading" : ""}`);
    wrapper.dataset.sectionId = segment.sectionId;
    wrapper.dataset.lineStart = segment.lineStart;
    wrapper.dataset.lineEnd = segment.lineEnd;
    const sourceLabel = segment.lineStart === segment.lineEnd
      ? `Original line ${segment.lineStart}`
      : `Original lines ${segment.lineStart}–${segment.lineEnd}`;
    wrapper.append(content, sourceLink(segment.sourceUrl, segment.lineStart, sourceLabel));
    return wrapper;
  }

  function sectionLink(section, label = section.title) {
    const anchor = section.segmentIds[0] ?? "reading";
    const link = node("a", "toc-link");
    link.href = `reader.html?section=${encodeURIComponent(section.id)}#${encodeURIComponent(anchor)}`;
    const title = node("span", "", label);
    const line = node("small", "", `Line ${section.line}`);
    link.append(title, line);
    return link;
  }

  function setting(key, fallback, min, max, next) {
    const stored = Number(localStorage.getItem(key));
    const current = Number.isFinite(stored) && stored >= min && stored <= max ? stored : fallback;
    const value = next(current);
    localStorage.setItem(key, String(value));
    return value;
  }

  function applyTheme() {
    const theme = localStorage.getItem(themeKey);
    if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
    else document.documentElement.dataset.theme = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    const button = document.querySelector("[data-theme-toggle]");
    if (button) button.textContent = document.documentElement.dataset.theme === "dark" ? "Light theme" : "Dark theme";
  }

  function render(data, segmentData) {
    const sections = data.sections;
    const requested = sections.find(section => section.id === selectedId) ?? sections[0];
    const selected = sections.find(section => section.id === requested.readerTargetId) ?? requested;
    if (!selected) throw new Error("The reading edition has no sections.");
    const shelf = data.shelves.find(item => item.id === selected.shelf);
    const duplicateGroup = data.duplicateGroups.find(group => group.sectionIds.includes(requested.id));
    const navigableSections = sections.filter(section => section.readerTargetId === section.id);
    const currentIndex = navigableSections.findIndex(section => section.id === selected.id);
    const chapterPage = selected.type === "genesis-chapter";
    const visibleSectionIds = new Set([
      selected.id,
      ...sections.filter(section => section.readerTargetId === selected.id).map(section => section.id)
    ]);
    const visibleSegments = segmentData.segments.filter(segment =>
      chapterPage ? segment.genesisChapter === selected.label : visibleSectionIds.has(segment.sectionId));

    document.title = `${requested.title} — Scroll of Fire Library`;
    document.querySelector("[data-current-title]").textContent = requested.title;
    const shelfLink = document.querySelector("[data-shelf-link]");
    shelfLink.href = `./#shelf-${requested.shelf}`;
    shelfLink.textContent = shelf?.title ?? "Library";
    document.querySelector("[data-toc-count]").textContent = `${navigableSections.length} passages`;

    const navigation = document.querySelector("[data-toc-nav]");
    navigation.replaceChildren();
    for (const shelfItem of data.shelves) {
      const sectionGroup = sections.filter(section => section.shelf === shelfItem.id);
      if (!sectionGroup.length) continue;
      const group = node("details", "toc-shelf");
      if (shelfItem.id === selected.shelf) group.open = true;
      const summary = node("summary", "", `${shelfItem.title} · ${sectionGroup.length}`);
      const list = node("div", "toc-list");
      for (const section of sectionGroup) {
        const link = sectionLink(section);
        if (section.id === requested.id || section.id === selected.id) link.setAttribute("aria-current", "location");
        list.append(link);
      }
      group.append(summary, list);
      navigation.append(group);
    }

    const heading = node("h1", "reader-title", requested.title);
    const titleSegment = segmentData.segments.find(segment =>
      segment.id === requested.segmentIds[0] &&
      segment.kind === "heading" &&
      segment.text.trim() === requested.title.trim());
    heading.id = titleSegment?.id ?? "passage-title";
    const eyebrow = node("p", "eyebrow", `${shelf?.title ?? "Library"} · Source passage`);
    const topSource = sourceLink(requested.sourceUrl, requested.line, `View original at line ${requested.line} ↗`);
    const sourceMeta = node("div", "source-context");
    sourceMeta.append(topSource);
    if (duplicateGroup) {
      const occurrences = node("div", "duplicate-occurrences");
      occurrences.append(node("strong", "", `This heading appears ${duplicateGroup.sectionIds.length} times in the original:`));
      const links = node("div", "occurrence-list");
      duplicateGroup.sectionIds.forEach((id, index) => {
        const section = sections.find(item => item.id === id);
        const link = sectionLink(section, `Occurrence ${index + 1} · line ${section.line}`);
        if (id === requested.id) link.setAttribute("aria-current", "location");
        links.append(link);
      });
      occurrences.append(links);
      sourceMeta.append(occurrences);
    }
    const lede = node("p", "reader-lede", "Presented from the preserved manuscript. The original wording and sequence remain intact; editorial grouping is navigational only.");
    passageTarget.replaceChildren();
    page.querySelector(".eyebrow")?.remove();
    page.querySelector(".reader-title")?.remove();
    page.querySelector(".reader-lede")?.remove();
    page.querySelector(".source-context")?.remove();
    page.insertBefore(eyebrow, passageTarget);
    page.insertBefore(heading, passageTarget);
    page.insertBefore(sourceMeta, passageTarget);
    page.insertBefore(lede, passageTarget);

    for (const segment of visibleSegments) {
      if (segment.sectionId === requested.id && segment.kind === "heading" &&
          segment.text.trim() === requested.title.trim()) continue;
      passageTarget.append(renderSegment(segment));
    }
    if (!visibleSegments.some(segment => segment.text.trim())) {
      const message = node("p", "empty-passage", "This structural heading has no independent text. Its source location remains available above.");
      passageTarget.append(message);
    }

    const originalLink = sourceLink(data.edition.sourceUrl, 1, "Open frozen original manuscript ↗");
    originalLink.classList.add("archive-source-link");
    const archiveLink = node("a", "archive-source-link", "Download archival edition ↗");
    archiveLink.href = data.edition.archiveUrl;
    archiveLink.download = "Full_Scroll_Unsealed.txt";
    sourceMeta.append(originalLink, archiveLink);

    function setAdjacent(selector, index, label) {
      const link = document.querySelector(selector);
      const adjacent = navigableSections[index];
      if (!adjacent) {
        link.textContent = label;
        link.removeAttribute("href");
        link.setAttribute("aria-disabled", "true");
        return;
      }
      link.href = sectionLinkUrl(adjacent);
      link.textContent = label.includes("Previous") ? `← ${adjacent.title}` : `${adjacent.title} →`;
      link.setAttribute("aria-label", `${label.replace(/[←→]/g, "").trim()}: ${adjacent.title}`);
    }
    setAdjacent("[data-previous]", currentIndex - 1, "← Previous passage");
    setAdjacent("[data-next]", currentIndex + 1, "Next passage →");

    const baseScale = Number(localStorage.getItem(textScaleKey));
    document.documentElement.style.setProperty("--reading-scale", String(Number.isFinite(baseScale) && baseScale >= 0.9 && baseScale <= 1.3 ? baseScale : 1));
    document.querySelector("[data-font='smaller']").addEventListener("click", () => {
      setting(textScaleKey, 1, 0.9, 1.3, value => Math.max(0.9, Math.round((value - 0.1) * 10) / 10));
      document.documentElement.style.setProperty("--reading-scale", localStorage.getItem(textScaleKey));
    });
    document.querySelector("[data-font='larger']").addEventListener("click", () => {
      setting(textScaleKey, 1, 0.9, 1.3, value => Math.min(1.3, Math.round((value + 0.1) * 10) / 10));
      document.documentElement.style.setProperty("--reading-scale", localStorage.getItem(textScaleKey));
    });
    document.querySelector("[data-theme-toggle]").addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      localStorage.setItem(themeKey, next);
      applyTheme();
    });
    applyTheme();

    if (location.hash) {
      requestAnimationFrame(() => {
        const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (!target) return;
        const mastheadHeight = document.querySelector(".reader-masthead")?.getBoundingClientRect().height ?? 0;
        const top = target.getBoundingClientRect().top + window.scrollY - mastheadHeight - 16;
        window.scrollTo(0, Math.max(0, top));
      });
    }

    function sectionLinkUrl(section) {
      const anchor = section.segmentIds[0] ?? "reading";
      return `reader.html?section=${encodeURIComponent(section.id)}#${encodeURIComponent(anchor)}`;
    }
  }

  Promise.all([dataUrl, segmentUrl].map(url =>
    fetch(url).then(response => {
      if (!response.ok) throw new Error(`Reader data request failed for ${url.pathname} (${response.status}).`);
      return response.json();
    })))
    .then(([data, segmentData]) => render(data, segmentData))
    .catch(error => {
      const heading = page.querySelector("h1");
      if (heading) heading.textContent = "This passage could not be opened.";
      const message = node("p", "reader-error", error.message);
      passageTarget.replaceChildren(message);
      console.error("Scroll reader failed:", error);
    });
})();
