"use strict";

/* Documentation Hub: renders two data files as one filterable hub.
   - docs/assets/data/documentation-hub.json — documented entries by domain,
     each tied to a named source that was opened and read.
   - docs/scroll/evidence/claim-register.json — the Codex's own 21-claim
     register, rendered under its own domain and deep-linking to each
     claim's full record on the Evidence Edition.
   Nothing is invented here: every word shown comes from one of the two
   data files. Grades are the register's evidence-status keys, and the
   guide at the foot of the page is the register's own wording. */

(function () {
  const HUB_URL = "assets/data/documentation-hub.json";
  const REGISTER_URL = "scroll/evidence/claim-register.json";

  /* The pattern layer (documentation-hub-patterns.js) reads the same hub
     data file. Both scripts share one fetch through this promise, so the
     file is downloaded once per page; each reader clones the response
     before reading it, so both keep their own error handling. */
  function sharedHubResponse() {
    if (!window.__codexHubResponse) {
      window.__codexHubResponse = fetch(HUB_URL);
    }
    return window.__codexHubResponse.then(response => response.clone());
  }
  const EDITORIAL_URL = "scroll/editorial.html";

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function humanize(status) {
    return status.replace(/-/g, " ");
  }

  function hubEntries(hub) {
    return hub.entries.map(entry => ({
      id: entry.id,
      domain: entry.domain,
      title: entry.title,
      statement: entry.statement,
      grade: entry.grade,
      dates: entry.dates,
      shows: entry.shows,
      sources: entry.sources || [],
      kind: "hub"
    }));
  }

  function registerEntries(register) {
    return register.claims.map(claim => ({
      id: claim.id,
      domain: "register",
      title: claim.title,
      statement: claim.statusLabel,
      grade: claim.evidenceStatus,
      dates: null,
      shows: claim.evidenceStatusDescription,
      sources: claim.sources || [],
      classification: claim.classification,
      sourceReview: claim.sourceReviewStatusDescription,
      kind: "register"
    }));
  }

  function renderCard(entry) {
    const item = element("li", "atlas-card");
    item.dataset.grade = entry.grade;
    item.dataset.domain = entry.domain;
    const heading = element("h3");
    if (entry.kind === "register") {
      const link = element("a", "atlas-card-title", entry.title);
      link.href = `${EDITORIAL_URL}#${encodeURIComponent(entry.id)}`;
      heading.append(link);
    } else {
      heading.append(element("span", "atlas-card-title", entry.title));
    }
    item.append(heading);
    const meta = element("p", "atlas-meta");
    meta.append(
      element("span", "atlas-badge", humanize(entry.grade)),
      element("span", "", entry.id)
    );
    if (entry.dates) meta.append(element("span", "", entry.dates));
    if (entry.classification) meta.append(element("span", "", entry.classification));
    item.append(meta);
    item.append(element("p", "", entry.statement));
    if (entry.shows) {
      const shows = element("p", "atlas-note");
      shows.append(element("strong", "", "What the record shows: "));
      shows.append(document.createTextNode(entry.shows));
      item.append(shows);
    }
    const related = element("p", "atlas-related");
    if (entry.kind === "register") {
      related.append(element("strong", "", "Full record: "));
      const record = element("a", "", "Evidence Edition");
      record.href = `${EDITORIAL_URL}#${encodeURIComponent(entry.id)}`;
      related.append(
        record,
        ` · ${entry.sources.length} cited source${entry.sources.length === 1 ? "" : "s"}. Source review: ${entry.sourceReview}`
      );
    } else if (entry.sources.length) {
      related.append(element("strong", "", entry.sources.length === 1 ? "Source: " : "Sources: "));
      entry.sources.forEach((source, index) => {
        if (index) related.append(" · ");
        const link = element("a", "", source.name);
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener";
        related.append(link);
      });
    }
    item.append(related);
    return item;
  }

  function render(hub, register, sections, count, empty, filters) {
    const query = (filters.q.value || "").trim().toLowerCase();
    const wantedDomain = filters.domain.value || "";
    const wantedGrade = filters.grade.value || "";
    /* The pattern view (documentation-hub-patterns.js) can narrow the list
       to one exact set of entries: a stack, a thread, a checked pattern. */
    const idFilter = window.SOFHubEntryFilter instanceof Set ? window.SOFHubEntryFilter : null;
    const entries = [...hubEntries(hub), ...registerEntries(register)];
    let shown = 0;
    sections.replaceChildren();
    for (const domain of hub.domains) {
      const inDomain = entries.filter(entry => {
        if (idFilter && !idFilter.has(entry.id)) return false;
        if (entry.domain !== domain.id) return false;
        if (wantedDomain && entry.domain !== wantedDomain) return false;
        if (wantedGrade && entry.grade !== wantedGrade) return false;
        if (query) {
          const haystack = `${entry.id} ${entry.title} ${entry.statement}`.toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      });
      if (!inDomain.length) continue;
      shown += inDomain.length;
      const section = element("section", "atlas-area");
      section.setAttribute("aria-label", domain.label);
      section.append(element("h2", "", domain.label));
      section.append(element("p", "", domain.blurb));
      const list = element("ul", "atlas-list");
      for (const entry of inDomain) list.append(renderCard(entry));
      section.append(list);
      sections.append(section);
    }
    count.textContent = `${entries.length} entries · ${shown} shown`;
    empty.hidden = shown !== 0;
  }

  function buildFilter(entries, select, key, label) {
    const counts = new Map();
    for (const entry of entries) counts.set(entry[key], (counts.get(entry[key]) || 0) + 1);
    const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    for (const [value, n] of ordered) {
      const option = element("option", "", `${label(value)} (${n})`);
      option.value = value;
      select.append(option);
    }
  }

  function renderGuide(guide, container) {
    if (!container) return;
    const list = element("ul", "atlas-list");
    for (const [key, text] of Object.entries(guide)) {
      const item = element("li", "atlas-card");
      const title = element("h3");
      title.append(element("span", "atlas-card-title", humanize(key)));
      item.append(title);
      item.append(element("p", "", text));
      list.append(item);
    }
    container.replaceChildren(list);
  }

  async function load() {
    const sections = document.querySelector("[data-hub-sections]");
    const count = document.querySelector("[data-hub-count]");
    const empty = document.querySelector("[data-hub-empty]");
    const form = document.querySelector("[data-hub-filters]");
    const guide = document.querySelector("[data-hub-guide]");
    if (!sections || !count) return;
    try {
      const [hubResponse, registerResponse] = await Promise.all([sharedHubResponse(), fetch(REGISTER_URL)]);
      if (!hubResponse.ok) throw new Error(`Documentation hub data could not be loaded (${hubResponse.status}).`);
      if (!registerResponse.ok) throw new Error(`Claim register could not be loaded (${registerResponse.status}).`);
      const hub = await hubResponse.json();
      const register = await registerResponse.json();
      if (!Array.isArray(hub.entries) || !Array.isArray(register.claims)) {
        throw new Error("Hub data has no entries list.");
      }
      const all = [...hubEntries(hub), ...registerEntries(register)];
      const domainLabels = new Map(hub.domains.map(domain => [domain.id, domain.label]));
      const filters = {
        q: form.querySelector('input[name="q"]'),
        domain: form.querySelector('select[name="domain"]'),
        grade: form.querySelector('select[name="grade"]')
      };
      buildFilter(all, filters.domain, "domain", value => domainLabels.get(value) || value);
      buildFilter(all, filters.grade, "grade", humanize);
      renderGuide(register.evidenceStatusGuide || {}, guide);
      const update = () => render(hub, register, sections, count, empty, filters);
      form.addEventListener("input", update);
      form.addEventListener("submit", event => event.preventDefault());
      form.hidden = false;
      update();
    } catch (error) {
      console.error("Documentation Hub could not be loaded:", error);
      count.textContent = "The hub could not be loaded. The register stands on the Evidence Edition.";
      if (empty) empty.hidden = false;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
