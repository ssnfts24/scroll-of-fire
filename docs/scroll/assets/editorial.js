"use strict";

(() => {
  const read = async path => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`${path} (${response.status})`);
    return response.json();
  };
  const element = (tag, className, text) => {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
  };
  const sourceUrl = (commit, line) =>
    `https://github.com/ssnfts24/scroll-of-fire/blob/${commit}/Full_Scroll_Unsealed#L${line}`;
  const sourceLink = (commit, lineStart, lineEnd, label) => {
    const link = element("a", "source-link", label ?? `Original lines ${lineStart}–${lineEnd}`);
    link.href = sourceUrl(commit, lineStart);
    link.target = "_blank";
    link.rel = "noreferrer";
    return link;
  };

  function renderOriginals(edition, container) {
    const list = element("ul", "editorial-occurrence-list");
    for (const occurrence of edition.originalOccurrences) {
      const item = element("li");
      item.append(
        element("strong", "", occurrence.label),
        " · ",
        sourceLink(edition.sourceCommit, occurrence.lineStart, occurrence.lineEnd,
          `Original lines ${occurrence.lineStart}–${occurrence.lineEnd}`)
      );
      list.append(item);
    }
    container.append(element("p", "", edition.editorialNote), list);
  }

  function renderSections(edition, container, claimById) {
    for (const section of edition.sections) {
      const article = element("section", "editorial-section");
      article.id = section.id;
      article.append(element("p", "eyebrow", section.classification));
      article.append(element("h2", "", section.heading));
      article.append(element("p", "editorial-copy", section.text));
      const refs = element("p", "editorial-source-links");
      for (const line of [...new Set(section.sourceLines)].sort((a, b) => a - b)) {
        const link = sourceLink(edition.sourceCommit, line, line, `Original line ${line}`);
        refs.append(link, " ");
      }
      if (refs.childNodes.length) article.append(refs);
      if (section.claimIds.length) {
        const claimLinks = element("p", "editorial-claim-links");
        claimLinks.append("Evidence records: ");
        section.claimIds.forEach((id, index) => {
          const claim = claimById.get(id);
          if (!claim) return;
          if (index) claimLinks.append(" · ");
          const link = element("a", "", `${id} — ${claim.title}`);
          link.href = `#${id}`;
          claimLinks.append(link);
        });
        article.append(claimLinks);
      }
      container.append(article);
    }
  }

  function renderSources(claim, commit) {
    const list = element("ul", "evidence-source-list");
    for (const source of claim.sources) {
      const item = element("li");
      const link = element("a", "", source.title);
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      item.append(link, ` — ${source.publisher}, ${source.date}. `);
      item.append(element("span", "", source.establishes));
      if (source.limits) item.append(" ", element("em", "", `Limit: ${source.limits}`));
      list.append(item);
    }
    if (!claim.sources.length) list.append(element("li", "unverified-note", "No independently verified source is attached to this record yet."));
    return list;
  }

  function renderClaims(register, container) {
    for (const claim of register.claims) {
      const details = element("details", "evidence-record");
      details.id = claim.id;
      const summary = element("summary");
      summary.append(
        element("span", "claim-id", claim.id),
        element("strong", "", claim.title),
        element("span", `claim-status status-${claim.status}`, claim.statusLabel)
      );
      details.append(summary);
      const body = element("div", "evidence-record-body");
      body.append(element("p", "evidence-classification", `${claim.classification} · ${claim.statusLabel}`));
      body.append(element("h3", "", "Original statement"));
      for (const statement of claim.originalStatements) {
        const quote = element("blockquote", "original-quote", statement.text);
        const cite = element("p", "editorial-source-links");
        cite.append(`${statement.occurrence} · `, sourceLink(register.sourceCommit,
          statement.lineStart, statement.lineEnd,
          `Original lines ${statement.lineStart}–${statement.lineEnd}`));
        body.append(quote, cite);
      }
      body.append(element("h3", "", "What the cited evidence establishes"));
      body.append(element("p", "", claim.establishes));
      body.append(element("h3", "", "What remains disputed or unverified"));
      body.append(element("p", "", claim.unverified));
      if (claim.contradictoryEvidence.length) {
        body.append(element("h3", "", "Contradictory or qualifying evidence"));
        body.append(element("p", "", claim.contradictoryEvidence));
      }
      body.append(element("h3", "", "Sources"));
      body.append(renderSources(claim, register.sourceCommit));
      body.append(element("h3", "", "Editorial change"));
      body.append(element("p", "", claim.editorialChange));
      details.append(body);
      container.append(details);
    }
  }

  async function render() {
    const originals = document.querySelector("[data-editorial-originals]");
    const reading = document.querySelector("[data-editorial-reading]");
    const claims = document.querySelector("[data-claim-list]");
    try {
      const [edition, register] = await Promise.all([
        read("data/editorial-edition.json"),
        read("evidence/claim-register.json")
      ]);
      if (edition.sourceSha256 !== register.sourceSha256 ||
          edition.sourceCommit !== register.sourceCommit) {
        throw new Error("Editorial and evidence source provenance does not match.");
      }
      const claimById = new Map(register.claims.map(claim => [claim.id, claim]));
      renderOriginals(edition, originals);
      renderSections(edition, reading, claimById);
      renderClaims(register, claims);
      const hash = decodeURIComponent(location.hash.slice(1));
      if (hash) document.getElementById(hash)?.setAttribute("open", "");
    } catch (error) {
      console.error("Editorial edition could not be loaded:", error);
      const message = element("p", "notice is-error",
        `The editorial materials could not be loaded: ${error.message}`);
      originals?.append(message);
      reading?.replaceChildren();
      claims?.replaceChildren();
    }
  }

  document.addEventListener("DOMContentLoaded", render);
})();
