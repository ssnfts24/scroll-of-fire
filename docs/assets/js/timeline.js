/* Historical timeline (docs/timeline.html).
 *
 * Renders two dated records from their single sources of truth:
 *  - the claim register (docs/scroll/evidence/claim-register.json):
 *    one entry per DATED source, placed by the source's publication
 *    date — never presented as the date of the events described;
 *  - the growth record (docs/assets/data/codex-updates.json):
 *    every recorded addition to the site, oldest first.
 *
 * Claims whose register entries carry no dated source are listed as
 * "not yet dated" and are never placed on the timeline. Claim titles
 * and evidence labels are rendered exactly as the register records
 * them; this page changes no claim and no status.
 */
(() => {
  "use strict";

  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };

  const link = (href, text, cls) => {
    const a = el("a", cls, text);
    a.href = href;
    return a;
  };

  /* "2025-05-21" -> "May 21, 2025"; "2020-03" -> "March 2020".
   * Month-precision dates stay month-precision: no day is invented. */
  const formatDate = (raw) => {
    const parts = String(raw).split("-");
    const year = parts[0];
    const month = MONTHS[Number(parts[1]) - 1] || "";
    if (parts.length >= 3) return `${month} ${Number(parts[2])}, ${year}`;
    return `${month} ${year}`;
  };

  const monthLabel = (raw) => {
    const parts = String(raw).split("-");
    return `${MONTHS[Number(parts[1]) - 1] || ""} ${parts[0]}`;
  };

  const fetchJson = async (path) => {
    const url = new URL(path, document.baseURI).href;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  };

  /* Group sorted entries under headings, preserving order. */
  const renderGroups = (container, entries, keyOf, labelOf, buildEntry) => {
    let currentKey = null;
    let list = null;
    for (const entry of entries) {
      const key = keyOf(entry);
      if (key !== currentKey) {
        currentKey = key;
        container.append(el("h3", "timeline-group", labelOf(entry)));
        list = el("div", "timeline-group-entries");
        container.append(list);
      }
      list.append(buildEntry(entry));
    }
  };

  const laneError = (container, countEl, message, href, hrefText) => {
    countEl.textContent = message;
    const p = el("p", "timeline-error", "The record could not be loaded here. ");
    p.append(link(href, hrefText), ".");
    container.append(p);
  };

  /* ------------------------------------------------ claims lane */
  const renderClaims = (register) => {
    const claims = Array.isArray(register) ? register : register.claims || [];
    const dated = [];
    const undated = [];
    for (const claim of claims) {
      const sources = (claim.sources || []).filter((s) => s && s.date);
      if (sources.length) {
        for (const source of sources) dated.push({ date: source.date, claim, source });
      } else {
        undated.push(claim);
      }
    }
    dated.sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const countEl = document.querySelector("[data-timeline-claims-count]");
    const lane = document.querySelector("[data-timeline-claims]");
    const claimCount = new Set(dated.map((d) => d.claim.id)).size;
    const years = dated.map((d) => String(d.date).slice(0, 4));
    countEl.textContent =
      `${dated.length} dated sources · ${claimCount} claims · ${years[0]}–${years[years.length - 1]}`;

    renderGroups(
      lane,
      dated,
      (d) => String(d.date).slice(0, 4),
      (d) => String(d.date).slice(0, 4),
      ({ date, claim, source }) => {
        const article = el("article", "timeline-entry");
        const head = el("p", "timeline-entry-head");
        const time = el("time", "timeline-date", formatDate(date));
        time.dateTime = date;
        head.append(time, " ");
        head.append(el("span", `timeline-status status-${claim.status}`, claim.statusLabel || claim.status));
        article.append(head);

        const claimLine = el("p", "timeline-claim");
        claimLine.append(link(`scroll/editorial.html#${claim.id}`, claim.title));
        claimLine.append(el("span", "timeline-claim-id", ` ${claim.id}`));
        article.append(claimLine);

        const sourceLine = el("p", "timeline-source");
        sourceLine.append("Source: ");
        if (source.url) {
          const a = link(source.url, source.title);
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          sourceLine.append(a);
        } else {
          sourceLine.append(source.title);
        }
        if (source.publisher) sourceLine.append(` — ${source.publisher}`);
        article.append(sourceLine);
        return article;
      }
    );

    /* Not-yet-dated claims: named, never placed. */
    const undatedList = document.querySelector("[data-timeline-undated]");
    for (const claim of undated) {
      const li = el("li", "timeline-undated-item");
      li.append(el("span", "timeline-claim-id", claim.id), " — ", claim.title, " ");
      li.append(el("span", `timeline-status status-${claim.status}`, claim.statusLabel || claim.status));
      undatedList.append(li);
    }
    const undatedCount = document.querySelector("[data-timeline-undated-count]");
    undatedCount.textContent =
      `The register holds ${claims.length} claims: ${claimCount} carry a dated source; ${undated.length} do not.`;
  };

  /* ------------------------------------------------ growth lane */
  const renderGrowth = (updates) => {
    const entries = [...updates].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const countEl = document.querySelector("[data-timeline-growth-count]");
    const lane = document.querySelector("[data-timeline-growth]");
    countEl.textContent =
      `${entries.length} additions · ${monthLabel(entries[0].date)} – ${monthLabel(entries[entries.length - 1].date)}`;

    renderGroups(
      lane,
      entries,
      (e) => String(e.date).slice(0, 7),
      (e) => monthLabel(e.date),
      (entry) => {
        const article = el("article", "timeline-entry");
        const head = el("p", "timeline-entry-head");
        const time = el("time", "timeline-date", formatDate(entry.date));
        time.dateTime = entry.date;
        head.append(time);
        if (entry.symbol) head.append(el("span", "timeline-symbol", entry.symbol));
        if (entry.type) head.append(el("span", "timeline-type", entry.type));
        article.append(head);

        const titleLine = el("p", "timeline-claim");
        if (entry.url) titleLine.append(link(entry.url, entry.title));
        else titleLine.append(entry.title);
        article.append(titleLine);

        if (entry.summary) article.append(el("p", "timeline-summary", entry.summary));
        return article;
      }
    );
  };

  /* ------------------------------------------------ load */
  const claimsCount = document.querySelector("[data-timeline-claims-count]");
  const claimsLane = document.querySelector("[data-timeline-claims]");
  fetchJson("scroll/evidence/claim-register.json")
    .then(renderClaims)
    .catch(() => laneError(
      claimsLane, claimsCount,
      "The claim register could not be loaded.",
      "scroll/editorial.html", "Read the claims in the Evidence Edition"
    ));

  const growthCount = document.querySelector("[data-timeline-growth-count]");
  const growthLane = document.querySelector("[data-timeline-growth]");
  fetchJson("assets/data/codex-updates.json")
    .then(renderGrowth)
    .catch(() => laneError(
      growthLane, growthCount,
      "The growth record could not be loaded.",
      "./", "See the latest additions on the homepage"
    ));
})();
