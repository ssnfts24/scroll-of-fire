"use strict";

/* Claims Atlas: renders docs/scroll/evidence/claim-register.json as a
   filterable atlas. Every word shown comes from the register itself —
   nothing is invented here. Cards link to the claim's full record on
   the Evidence Edition (scroll/editorial.html#<claim-id>), where the
   hash opens that claim's record. */

(function () {
  const REGISTER_URL = "scroll/evidence/claim-register.json";
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

  function renderClaims(register, list, count, empty, filters) {
    const query = (filters.q.value || "").trim().toLowerCase();
    const wanted = filters.status.value || "";
    let shown = 0;
    list.replaceChildren();
    for (const claim of register.claims) {
      if (wanted && claim.status !== wanted) continue;
      const haystack = `${claim.id} ${claim.title} ${claim.classification}`.toLowerCase();
      if (query && !haystack.includes(query)) continue;
      shown += 1;
      const item = element("li", "atlas-card");
      item.dataset.status = claim.status;
      const heading = element("h3");
      const link = element("a", "atlas-card-title", claim.title);
      link.href = `${EDITORIAL_URL}#${encodeURIComponent(claim.id)}`;
      heading.append(link);
      item.append(heading);
      const meta = element("p", "atlas-meta");
      meta.append(
        element("span", "atlas-badge", humanize(claim.status)),
        element("span", "", claim.id),
        element("span", "", claim.classification)
      );
      item.append(meta);
      item.append(element("p", "", claim.statusLabel));
      item.append(element("p", "", claim.evidenceStatusDescription));
      const related = element("p", "atlas-related");
      const sources = claim.sources ? claim.sources.length : 0;
      related.append(
        element("strong", "", "Full record: "),
        (() => {
          const record = element("a", "", "Evidence Edition");
          record.href = `${EDITORIAL_URL}#${encodeURIComponent(claim.id)}`;
          return record;
        })(),
        ` · ${sources} cited source${sources === 1 ? "" : "s"}. Source review: ${claim.sourceReviewStatusDescription}`
      );
      item.append(related);
      list.append(item);
    }
    count.textContent = `${register.claims.length} claims · ${shown} shown`;
    empty.hidden = shown !== 0;
  }

  function buildStatusFilter(register, select) {
    const counts = new Map();
    for (const claim of register.claims) {
      counts.set(claim.status, (counts.get(claim.status) || 0) + 1);
    }
    const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    for (const [status, n] of ordered) {
      const option = element("option", "", `${humanize(status)} (${n})`);
      option.value = status;
      select.append(option);
    }
  }

  async function render() {
    const list = document.querySelector("[data-claims-list]");
    const count = document.querySelector("[data-claims-count]");
    const empty = document.querySelector("[data-claims-empty]");
    const form = document.querySelector("[data-claims-filters]");
    const guide = document.querySelector("[data-claims-guide]");
    if (!list || !count) return;
    try {
      const response = await fetch(REGISTER_URL);
      if (!response.ok) throw new Error(`Claim register could not be loaded (${response.status}).`);
      const register = await response.json();
      if (!Array.isArray(register.claims)) throw new Error("Claim register has no claims list.");
      const filters = {
        q: form.querySelector('input[name="q"]'),
        status: form.querySelector('select[name="status"]')
      };
      buildStatusFilter(register, filters.status);
      renderGuide(register.evidenceStatusGuide || {}, guide);
      const update = () => renderClaims(register, list, count, empty, filters);
      form.addEventListener("input", update);
      form.addEventListener("submit", event => event.preventDefault());
      form.hidden = false;
      update();
    } catch (error) {
      console.error("Claims Atlas could not be loaded:", error);
      count.textContent = "The register could not be loaded.";
      const note = element("p", "notice is-error",
        `The claims could not be loaded: ${error.message} The complete register is available on the Evidence Edition.`);
      list.replaceChildren(note);
    }
  }

  document.addEventListener("DOMContentLoaded", render);
})();
