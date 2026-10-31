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

  function renderCoverage(edition, container) {
    const addressedHeading = element("h3", "", "Substantively addressed in this reading");
    const addressed = element("ul", "editorial-coverage-list");
    for (const item of edition.coverageInventory.addressedTopics) {
      const row = element("li");
      const chapter = element("a", "", item.topic);
      chapter.href = `#${item.sectionId}`;
      row.append(chapter, " · Original lines ");
      item.sourceLines.forEach((line, index) => {
        if (index) row.append(", ");
        row.append(sourceLink(edition.sourceCommit, line, line, String(line)));
      });
      addressed.append(row);
    }

    const archiveHeading = element("h3", "", "Retained in the archive; not substantively revised here");
    const archiveOnly = element("ul", "editorial-coverage-list");
    for (const item of edition.coverageInventory.archiveOnlyTopics) {
      const row = element("li");
      row.append(element("span", "", item.topic), " · ");
      row.append(sourceLink(edition.sourceCommit, item.lineStart, item.lineEnd,
        `Original lines ${item.lineStart}–${item.lineEnd}`));
      archiveOnly.append(row);
    }
    container.append(
      element("p", "", edition.coverageInventory.archiveOnlyNote),
      addressedHeading, addressed, archiveHeading, archiveOnly
    );
  }

  function renderSections(edition, container, claimById) {
    for (const section of edition.sections) {
      const article = element("section", "editorial-section");
      article.id = section.id;
      article.append(element("p", "eyebrow", section.classification));
      article.append(element("h2", "", section.heading));
      for (const paragraph of section.paragraphs ?? [section.text]) {
        article.append(element("p", "editorial-copy", paragraph));
      }
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
          if (!claim) throw new Error(`${section.id}: unknown claim ID ${id}.`);
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

  function renderSources(claim) {
    const list = element("ul", "evidence-source-list");
    for (const source of claim.sources) {
      const item = element("li");
      const link = element("a", "", source.title);
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      item.append(link, ` — ${source.publisher}, ${source.date}. `);
      if (source.sourceType) item.append(element("span", "source-type", `${source.sourceType}. `));
      item.append(element("span", "", source.establishes));
      if (source.limits) item.append(" ", element("em", "", `Limit: ${source.limits}`));
      item.append(element("span", "source-inspection", ` Source page not independently inspected in this session.`));
      list.append(item);
    }
    if (!claim.sources.length) {
      list.append(element("li", "unverified-note", `${claim.sourceReviewStatusDescription} ${claim.establishes}`));
    }
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
      body.append(element("p", "evidence-classification",
        `${claim.evidenceStatus} · ${claim.evidenceStatusDescription}`));
      body.append(element("p", "source-review-status",
        `Source review: ${claim.sourceReviewStatusDescription}`));
      body.append(element("h3", "", "Original statement"));
      for (const statement of claim.originalStatements) {
        const quote = element("blockquote", "original-quote", statement.text);
        const cite = element("p", "editorial-source-links");
        cite.append(`${statement.occurrence} · `, sourceLink(register.sourceCommit,
          statement.lineStart, statement.lineEnd,
          `Original lines ${statement.lineStart}–${statement.lineEnd}`));
        body.append(quote, cite);
      }
      body.append(element("h3", "", claim.sources.length
        ? "What the cited records are listed to support"
        : "Current record status (no source citation attached)"));
      body.append(element("p", "", claim.establishes));
      body.append(element("h3", "", "What remains disputed or unverified"));
      body.append(element("p", "", claim.unverified));
      if (claim.contradictoryEvidence.length) {
        body.append(element("h3", "", "Contradictory or qualifying evidence"));
        body.append(element("p", "", claim.contradictoryEvidence));
      }
      body.append(element("h3", "", "Sources"));
      body.append(renderSources(claim));
      body.append(element("h3", "", "Editorial change"));
      body.append(element("p", "", claim.editorialChange));
      details.append(body);
      container.append(details);
    }
  }

  async function render() {
    const originals = document.querySelector("[data-editorial-originals]");
    const coverage = document.querySelector("[data-editorial-coverage]");
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
      renderCoverage(edition, coverage);
      renderSections(edition, reading, claimById);
      renderClaims(register, claims);
      const revealClaimFromHash = () =>
        window.ScrollEditorialNavigation.revealClaimFromHash(location, document, window);
      revealClaimFromHash();
      window.addEventListener("hashchange", revealClaimFromHash);
    } catch (error) {
      console.error("Editorial edition could not be loaded:", error);
      const message = element("p", "notice is-error",
        `The editorial materials could not be loaded: ${error.message}`);
      originals?.append(message);
      coverage?.replaceChildren();
      reading?.replaceChildren();
      claims?.replaceChildren();
    }
  }

  document.addEventListener("DOMContentLoaded", render);
})();
