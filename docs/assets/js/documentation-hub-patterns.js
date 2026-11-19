"use strict";

/* Documentation Hub — the evidentiary pattern layer.
   Aaron's direction (Nov 18, 2026): the evidence should be visible the way
   the Sphere makes time visible — patterns at a glance, with symbols and
   meaning — not only a packed list.

   Everything on this view is computed at load from the hub's own data file
   (assets/data/documentation-hub.json): the timeline positions come from
   each entry's documented dates, the kinds from each entry's id and title,
   the stacks from shared years, the threads from names that recur across
   entries. Nothing here is hand-placed.

   Two channels, kept apart on purpose:
   - the SYMBOL says what kind of thing an entry is (a fire, a fair, a
     court record…);
   - the SHADING says how well it is proven (documented record, allegation
     or testimony, disputed interpretation).
   A pattern built on allegations can never look like one built on documents.

   Honesty rule, enforced in the wording: a pattern here is a documented
   correlation (records that overlap or share a name) unless an entry's own
   record states more. Overlap is never dressed as coordination or cause. */

(function () {
  const HUB_URL = "assets/data/documentation-hub.json";
  const SVG_NS = "http://www.w3.org/2000/svg";

  /* ---------- symbols: one glyph per kind of evidence ---------- */
  const KINDS = {
    "map-change": {
      label: "Map change",
      meaning: "A map or territory label changing over time.",
      glyph: '<path d="M3 5l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 3v14"/><path d="M15 5v14"/><path d="M16.2 8.2l2.1 2.1M18.3 8.2l-2.1 2.1"/>'
    },
    "fire": {
      label: "Fire",
      meaning: "A documented fire.",
      glyph: '<path d="M12 3c.8 3.2-2.6 4.4-2.6 7.2a2.6 2.6 0 0 0 5.2 0c0-.9-.4-1.7-.4-1.7s2.6 1.3 2.6 4A4.9 4.9 0 0 1 12 20.9a4.9 4.9 0 0 1-4.9-4.9C7.1 11.9 10.4 9.6 12 3z"/>'
    },
    "fair": {
      label: "World's fair",
      meaning: "A world's fair or exposition — most were built temporary, then demolished.",
      glyph: '<circle cx="12" cy="10" r="6"/><path d="M12 4v12M6 10h12M7.8 5.8l8.4 8.4M16.2 5.8l-8.4 8.4"/><path d="M7 21l5-5.2L17 21"/>'
    },
    "star-fort": {
      label: "Star fort",
      meaning: "A star fort — the bastion shape built against cannon fire.",
      glyph: '<path d="M12 2.5l2.1 5.3 5.4-2.4-2.4 5.1 4.4 1.5-4.4 1.5 2.4 5.1-5.4-2.4L12 21.5l-2.1-5.3-5.4 2.4 2.4-5.1L2.5 12l4.4-1.5-2.4-5.1 5.4 2.4z"/>'
    },
    "tunnel": {
      label: "Tunnel",
      meaning: "A documented tunnel or underground work.",
      glyph: '<path d="M4 21v-8a8 8 0 0 1 16 0v8"/><path d="M8.5 21v-5a3.5 3.5 0 0 1 7 0v5"/><path d="M2 21h20"/>'
    },
    "institution": {
      label: "Institution",
      meaning: "An institution — an asylum, a residential school, a state school.",
      glyph: '<path d="M3.5 10L12 4l8.5 6"/><path d="M5 10v10M19 10v10M9 20v-6M12 20v-6M15 20v-6"/><path d="M3 20h18"/>'
    },
    "orphan-movement": {
      label: "Orphan movement",
      meaning: "Children moved by an organized scheme — the orphan trains and their kin around the world.",
      glyph: '<circle cx="7" cy="5" r="2"/><path d="M7 7.5V13M7 9.8L4.6 12M7 9.8l2.4 2.2M7 13l-1.8 6.5M7 13l2.6 6"/><path d="M14.5 18.5H20M17.5 15.8l2.7 2.7-2.7 2.7"/>'
    },
    "ancient": {
      label: "Ancient / text",
      meaning: "An ancient structure, or a text — dated by its own kind of record.",
      glyph: '<path d="M4 4.5h16"/><path d="M6.5 4.5V8h11V4.5"/><path d="M10.8 8v11.5M13.2 8v11.5"/><path d="M8.5 19.5h7"/>'
    },
    "program": {
      label: "Government program",
      meaning: "A government program or act — a program, an order, a bill, an official operation.",
      glyph: '<path d="M7 3h7l4 4v13.5H7z"/><path d="M14 3v4h4"/><circle cx="12" cy="13.5" r="2.4"/><path d="M12 11.8v3.4M10.3 13.5h3.4"/>'
    },
    "court": {
      label: "Court record",
      meaning: "A court record — a case, a plea, a ruling, a settlement, a penalty.",
      glyph: '<path d="M12 3v17M8 20.5h8"/><path d="M12 6H5.5M12 6h6.5"/><path d="M5.5 6L3 11.5a3 3 0 0 0 5 0z"/><path d="M18.5 6L16 11.5a3 3 0 0 0 5 0z"/>'
    },
    "energy": {
      label: "Energy / invention",
      meaning: "Energy and invention — patents, power, experiments.",
      glyph: '<path d="M13 2.5L5.2 13.2h4.9L9 21.5l7.8-10.7h-4.9z"/>'
    },
    "artifact": {
      label: "Artifact",
      meaning: "A physical artifact standing in the record.",
      glyph: '<rect x="9.8" y="3" width="4.4" height="18" rx="2.2"/><path d="M9.8 8h4.4M9.8 12h4.4M9.8 16h4.4"/>'
    },
    "record": {
      label: "Document / finding",
      meaning: "A document or a finding — a report, a release, a log, a review.",
      glyph: '<path d="M6 3h12v18H6z"/><path d="M9.2 8h5.6M9.2 12h5.6M9.2 16h3.4"/>'
    }
  };
  const TRACK_ORDER = ["map-change", "fire", "fair", "star-fort", "tunnel", "institution", "orphan-movement", "ancient", "program", "court", "energy", "artifact", "record"];

  /* Grade shading: how well a thing is proven. Never merged with symbols. */
  const GRADE_STYLE = {
    "documented-event-with-cited-record": { cls: "g-doc", label: "Documented record", key: "Solid teal, gold ring — the event stands on a cited record." },
    "documented-allegation-or-testimony": { cls: "g-all", label: "Allegation / testimony", key: "Hollow, dashed ring — documented as stated by a filing or a witness, not as fact." },
    "disputed-interpretation": { cls: "g-dis", label: "Disputed interpretation", key: "Stone, dashed ring — the reading of the record is disputed." }
  };
  const GRADE_FALLBACK = { cls: "g-dis", label: "Graded in the register", key: "See the entry's grade in the list below." };

  /* ---------- deriving position and kind from the data ---------- */

  /* An entry's span is read out of its own documented dates: the earliest
     and latest years the entry itself names. "BCE" spans go negative;
     century phrases ("16th–17th centuries") open out; an entry whose dates
     call its origin undated is not placed on the scale at all. */
  function parseSpan(dates) {
    const text = dates || "";
    if (/undated/i.test(text)) return { span: null, deep: true };
    const bce = text.match(/(\d{3,5})\s*[–-]\s*(\d{3,5})\s*BCE/);
    if (bce) return { span: [-Number(bce[1]), -Number(bce[2])], deep: true };
    const anchors = [];
    const centuries = text.match(/(\d{1,2})(?:st|nd|rd|th)\s*[–-]\s*(\d{1,2})(?:st|nd|rd|th)\s*centur/);
    if (centuries) anchors.push((Number(centuries[1]) - 1) * 100, Number(centuries[2]) * 100 - 1);
    for (const m of text.matchAll(/\b(1[4-9]\d\d|20\d\d)s\b/g)) anchors.push(Number(m[1]));
    for (const m of text.matchAll(/\b(1[4-9]\d\d|20\d\d)\b/g)) anchors.push(Number(m[1]));
    if (!anchors.length) return { span: null, deep: true };
    const span = [Math.min(...anchors), Math.max(...anchors)];
    return { span, deep: span[0] < 1500 };
  }

  /* Kind is read off the entry's own id and title — the register's id
     scheme already sorts the evidence (OLD-FIRE-…, TES-…, EPS-…), and the
     title names the shape of the record (a plea, a ruling, a fire). */
  function kindOf(entry) {
    const id = entry.id;
    const title = entry.title.toLowerCase();
    if (title.includes("fire") || id.includes("FIRE")) return "fire";
    if (id.includes("STARFORT") || title.includes("star fort") || title.includes("bastion")) return "star-fort";
    if (id.includes("FAIR") || title.includes("exposition") || title.includes("world's columbian")) return "fair";
    if (id.includes("TUNNEL") || title.includes("tunnel") || title.includes("underground") || title.includes("catacomb")) return "tunnel";
    if (id.includes("MAP") || title.includes("tartary")) return "map-change";
    if (/asylum|kirkbride|state school|residential|boarding school/.test(title)) return "institution";
    if (entry.domain === "orphan-trains") return "orphan-movement";
    if (id.includes("ANCIENT") || title.includes("göbekli")) return "ancient";
    if (entry.domain === "bench") return "artifact";
    if (/\bv\.\s|guilty plea|conviction|convicted|ruling|judgment|judgement|settlement|indictment|consent (order|decree|judgement)|deferred prosecution|penalty|chapter 11/.test(title)) return "court";
    if (/finding|unsealing|flight logs|release and/.test(title)) return "record";
    if (entry.domain === "tesla") return /patent|power|transmission|tower|experiment|lighting/.test(title) ? "energy" : "record";
    if (entry.domain === "government") return "program";
    return "record";
  }

  function yearLabel(year) {
    if (year === null || year === undefined) return "Undated";
    if (year < 0) return `${Math.abs(year).toLocaleString("en-US")} BCE`;
    return String(year);
  }

  /* ---------- small builders ---------- */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }
  function svgEl(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs || {})) node.setAttribute(key, value);
    return node;
  }
  function glyphSvg(kind, gradeCls, size) {
    const svg = svgEl("svg", { viewBox: "0 0 24 24", class: `hubp-glyph ${gradeCls}`, width: size, height: size, "aria-hidden": "true" });
    svg.innerHTML = KINDS[kind].glyph;
    return svg;
  }
  function disc(entry, size) {
    const wrap = el("span", `hubp-disc ${entry.gradeStyle.cls}`);
    wrap.append(glyphSvg(entry.kind, entry.gradeStyle.cls, size || 15));
    return wrap;
  }

  /* ---------- the shared detail / reading panel ---------- */
  let detailBox = null;
  function showReading(title, chipLabel, chipCls, steps, closer) {
    if (!detailBox) return;
    detailBox.replaceChildren();
    const head = el("div", "hubp-detail-head");
    head.append(el("h3", "", title));
    if (chipLabel) head.append(el("span", `hubp-chip-label ${chipCls}`, chipLabel));
    detailBox.append(head);
    const list = el("ol", "hubp-steps");
    for (const step of steps) {
      const item = el("li", "hubp-step");
      item.append(disc(step.entry, 15));
      const body = el("div", "hubp-step-body");
      const btn = el("button", "hubp-step-title", step.entry.title);
      btn.type = "button";
      btn.addEventListener("click", () => applyFilter([step.entry.id], step.entry.title));
      body.append(el("span", "hubp-step-year", step.yearText), btn);
      list.append(item);
    }
    detailBox.append(list);
    if (closer) detailBox.append(el("p", "hubp-closer", closer));
    detailBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function showEntry(entry) {
    if (!detailBox) return;
    detailBox.replaceChildren();
    const head = el("div", "hubp-detail-head");
    head.append(disc(entry, 20), el("h3", "", entry.title));
    head.append(el("span", `hubp-chip-label ${entry.gradeStyle.cls}`, entry.gradeStyle.label));
    detailBox.append(head);
    detailBox.append(el("p", "hubp-detail-meta", `${KINDS[entry.kind].label} · ${entry.dates}`));
    detailBox.append(el("p", "", entry.statement));
    if (entry.shows) {
      const shows = el("p", "hubp-detail-note");
      shows.append(el("strong", "", "What the record shows: "), document.createTextNode(entry.shows));
      detailBox.append(shows);
    }
    const row = el("p", "hubp-detail-row");
    const toList = el("button", "hubp-btn", "Show this entry in the list");
    toList.type = "button";
    toList.addEventListener("click", () => applyFilter([entry.id], entry.title));
    row.append(toList);
    for (const source of entry.sources || []) {
      const link = el("a", "hubp-btn hubp-btn-link", source.name);
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener";
      row.append(link);
    }
    detailBox.append(row);
    detailBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /* ---------- filtering the list below ---------- */
  let chip = null, chipLabel = null;
  function applyFilter(ids, label) {
    window.SOFHubEntryFilter = new Set(ids);
    if (chip && chipLabel) {
      chipLabel.textContent = label;
      chip.hidden = false;
    }
    const form = document.querySelector("[data-hub-filters]");
    if (form) form.dispatchEvent(new Event("input", { bubbles: true }));
    const count = document.querySelector("[data-hub-count]");
    if (count) count.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function clearFilter() {
    window.SOFHubEntryFilter = null;
    if (chip) chip.hidden = true;
    const form = document.querySelector("[data-hub-filters]");
    if (form) form.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /* ---------- the chart: kinds as tracks, years as the scale ---------- */
  const AXIS_START = 1500, AXIS_END = 2030;
  function buildChart(entries, mount) {
    const dated = entries.filter(e => e.span && !e.deep);
    const deep = entries.filter(e => e.deep);
    const kindsPresent = TRACK_ORDER.filter(kind => entries.some(e => e.kind === kind));
    const LABEL_W = 118, DEEP_W = 56, PLOT_W = 716, AXIS_H = 30, TRACK_H = 47;
    const width = LABEL_W + DEEP_W + PLOT_W + 8;
    const height = AXIS_H + kindsPresent.length * TRACK_H + 10;
    const x0 = LABEL_W + DEEP_W;
    const x = year => x0 + ((year - AXIS_START) / (AXIS_END - AXIS_START)) * PLOT_W;
    const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, class: "hubp-chart", role: "img", "aria-label": "Layered timeline of the hub's dated entries, 1500 to today, one track per kind of evidence" });
    for (let year = AXIS_START; year <= AXIS_END; year += 50) {
      svg.append(svgEl("line", { x1: x(year), y1: AXIS_H - 8, x2: x(year), y2: height - 6, class: "hubp-grid" }));
      const t = svgEl("text", { x: x(year) - 11, y: 16, class: "hubp-year" });
      t.textContent = year;
      svg.append(t);
    }
    const deepHead = svgEl("text", { x: LABEL_W + 4, y: 16, class: "hubp-year" });
    deepHead.textContent = "earlier";
    svg.append(deepHead);
    svg.append(svgEl("line", { x1: x0 - 3, y1: AXIS_H - 8, x2: x0 - 3, y2: height - 6, class: "hubp-grid hubp-grid-deep" }));
    /* collision buckets: same track, same few years -> stagger the discs */
    const buckets = new Map();
    const placed = [...dated, ...deep].sort((a, b) => (a.span ? a.span[0] : -99999) - (b.span ? b.span[0] : -99999));
    for (const entry of placed) {
      const trackIdx = kindsPresent.indexOf(entry.kind);
      if (trackIdx < 0) continue;
      const cy = AXIS_H + trackIdx * TRACK_H + TRACK_H / 2;
      const cx = entry.deep ? LABEL_W + DEEP_W / 2 : x(Math.max(AXIS_START, Math.min(AXIS_END, entry.span[0])));
      const bucketKey = `${entry.kind}|${Math.round(cx / 16)}`;
      const n = buckets.get(bucketKey) || 0;
      buckets.set(bucketKey, n + 1);
      const dy = [0, -13, 13, -7, 7][n % 5];
      const g = svgEl("g", { class: `hubp-dot ${entry.gradeStyle.cls}`, tabindex: "0", role: "button", "aria-label": `${entry.title} — ${entry.dates}` });
      g.append(svgEl("circle", { cx, cy: cy + dy, r: 13.5, class: "hubp-discface" }));
      const glyph = svgEl("g", { transform: `translate(${cx - 8.5}, ${cy + dy - 8.5}) scale(0.708)`, class: "hubp-glyphwrap" });
      glyph.innerHTML = KINDS[entry.kind].glyph;
      g.append(glyph);
      const title = svgEl("title", {});
      title.textContent = `${entry.title} — ${entry.dates}`;
      g.append(title);
      g.addEventListener("click", () => showEntry(entry));
      g.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); showEntry(entry); } });
      svg.append(g);
    }
    kindsPresent.forEach((kind, i) => {
      const cy = AXIS_H + i * TRACK_H + TRACK_H / 2;
      const label = svgEl("text", { x: LABEL_W - 8, y: cy + 4, class: "hubp-track", "text-anchor": "end" });
      label.textContent = KINDS[kind].label;
      svg.append(label);
      svg.append(svgEl("line", { x1: LABEL_W, y1: AXIS_H + i * TRACK_H + TRACK_H, x2: width - 4, y2: AXIS_H + i * TRACK_H + TRACK_H, class: "hubp-trackline" }));
    });
    mount.replaceChildren(svg);
  }

  /* ---------- stacks: where the record piles into the same years ---------- */
  function sequenceSteps(members) {
    return members.map(entry => ({
      entry,
      yearText: entry.span ? (entry.span[1] !== entry.span[0] ? `${yearLabel(entry.span[0])}–${yearLabel(entry.span[1])}` : yearLabel(entry.span[0])) : "Undated origin"
    }));
  }
  function patternCard(title, chipText, chipCls, members, closer, note) {
    const card = el("article", "hubp-card");
    const head = el("div", "hubp-card-head");
    head.append(el("h4", "", title));
    if (chipText) head.append(el("span", `hubp-chip-label ${chipCls}`, chipText));
    card.append(head);
    const discs = el("div", "hubp-card-discs");
    for (const entry of members.slice(0, 14)) discs.append(disc(entry, 14));
    if (members.length > 14) discs.append(el("span", "hubp-more", `+${members.length - 14}`));
    card.append(discs);
    if (note) card.append(el("p", "hubp-card-note", note));
    const btn = el("button", "hubp-btn", `Read in order · show the ${members.length} entries`);
    btn.type = "button";
    btn.addEventListener("click", () => {
      applyFilter(members.map(e => e.id), title);
      showReading(title, chipText, chipCls, sequenceSteps(members), closer);
    });
    card.append(btn);
    return card;
  }
  function buildStacks(entries, mount) {
    const frag = document.createDocumentFragment();
    /* the great overlap: entries whose documented span touches 1850–1930 */
    const overlap = entries.filter(e => e.span && e.span[0] <= 1930 && e.span[1] >= 1850)
      .sort((a, b) => a.span[0] - b.span[0]);
    if (overlap.length >= 5) {
      const card = el("article", "hubp-card hubp-card-wide");
      const head = el("div", "hubp-card-head");
      head.append(el("h4", "", "1850–1930 — the sorting-and-rebuilding decades"));
      head.append(el("span", "hubp-chip-label g-doc", "Documented correlation"));
      card.append(head);
      card.append(el("p", "hubp-card-note",
        `${overlap.length} of the hub's entries stand in these eighty years — fires, fairs, children moved, institutions built — across ${new Set(overlap.map(e => e.kind)).size} kinds of evidence. The records overlap in time; that overlap is what is documented. Coordination is not.`));
      const bars = el("div", "hubp-bars", "");
      const byDecade = new Map();
      for (const e of overlap) {
        if (e.span[0] < 1850 || e.span[0] > 1929) continue;
        const d = Math.floor(e.span[0] / 10) * 10;
        byDecade.set(d, (byDecade.get(d) || 0) + 1);
      }
      const max = Math.max(...byDecade.values(), 1);
      for (let d = 1850; d <= 1920; d += 10) {
        const n = byDecade.get(d) || 0;
        const bar = el("button", "hubp-bar");
        bar.type = "button";
        bar.title = `${d}s — ${n} entries begin`;
        bar.append(el("span", "hubp-bar-fill", ""));
        bar.firstChild.style.height = `${Math.max(8, (n / max) * 100)}%`;
        bar.append(el("span", "hubp-bar-n", String(n)), el("span", "hubp-bar-x", `${d}s`));
        bar.addEventListener("click", () => {
          const members = overlap.filter(e => e.span[0] >= d && e.span[0] < d + 10);
          applyFilter(members.map(e => e.id), `the ${d}s stack`);
          showReading(`The ${d}s`, "Documented correlation", "g-doc", sequenceSteps(members),
            "These records share a decade. Read in order they show what the record holds, in the order it happened; a shared decade is a correlation, not a cause.");
        });
        bars.append(bar);
      }
      card.append(bars);
      const btn = el("button", "hubp-btn", `Read the whole window in order · ${overlap.length} entries`);
      btn.type = "button";
      btn.addEventListener("click", () => {
        applyFilter(overlap.map(e => e.id), "1850–1930 — the sorting-and-rebuilding decades");
        showReading("1850–1930 — the sorting-and-rebuilding decades", "Documented correlation", "g-doc", sequenceSteps(overlap),
          "Read in order: this is the shape of the overlap, entry by entry. One thread inside it runs late — Australia's child migration peaks after the Second World War, a generation after the US trains ended. A relay across decades, not one synchronized moment. The overlap is documented; coordination beyond it is not.");
      });
      card.append(btn);
      frag.append(card);
    }
    /* same-year stacks */
    const byYear = new Map();
    for (const e of entries) {
      if (!e.span || e.span[0] < 0) continue;
      if (!byYear.has(e.span[0])) byYear.set(e.span[0], []);
      byYear.get(e.span[0]).push(e);
    }
    const stacks = [...byYear.entries()].filter(([, v]) => v.length >= 3).sort((a, b) => a[0] - b[0]);
    for (const [year, members] of stacks) {
      const note = year === 1871
        ? "Three fire records share this year — two of them the same night. Coordination was checked: see “Checked — and it did not hold” below."
        : null;
      frag.append(patternCard(
        `${year} — ${members.length} records share one year`,
        "Documented correlation", "g-doc", members,
        "These records share a year. Where they share more than the year, their own texts say so; otherwise they coincide — no order or connection between them is documented.",
        note));
    }
    mount.replaceChildren(frag);
  }

  /* ---------- threads: one name running through many records ---------- */
  const THREAD_DEFS = [
    { name: "The FBI", fields: "all", re: /\bFBI\b/, closer: "One bureau runs through each of these records. That the same institution appears is documented; what connects the entries beyond that is not claimed here." },
    { name: "The CIA", fields: "all", re: /\bCIA\b/, closer: "One agency runs through each of these records. That the same institution appears is documented; what connects the entries beyond that is not claimed here." },
    { name: "Children's Aid Society", fields: "all", re: /children's aid/i, closer: "One society runs from the first train to the last records. The thread is the institution's own documented life, read in order." },
    { name: "Built, then demolished", fields: "all", re: /demolish/i, closer: "Each of these was raised to stand for a season and then taken down — the record says so, entry by entry. Read in order, the shape repeats: build, show, demolish." },
    { name: "The guilty plea", fields: "all", re: /guilty plea/i, closer: "Different companies, different decades — one legal shape repeats: a plea, negotiated and entered in court. The repetition is documented; a common cause is not claimed." },
    { name: "One place: Chicago", fields: "head", re: /chicago/i, closer: "One place, read in order: the fire came first, the fair rose on the rebuilt city, the tunnels went under it. That order is the record's own — each step dated by its source." },
    { name: "One place: San Francisco", fields: "head", re: /san francisco/i, closer: "One place, read in order. Sharing a place is what this thread claims — and, here, the record's own sequence: fire, then the fair on the rebuilt city, then the open-air tests over the bay." },
    { name: "One place: New York", fields: "head", re: /new york/i, closer: "One place, read in order. Sharing a place is all this thread claims." },
    { name: "One place: Seattle", fields: "head", re: /seattle/i, closer: "One place, read in order — from the underground the fire left behind to the city's present record. Sharing a place is all this thread claims." }
  ];
  function buildThreads(entries, mount) {
    const frag = document.createDocumentFragment();
    const found = [];
    for (const def of THREAD_DEFS) {
      const members = entries.filter(e => {
        const text = def.fields === "all" ? `${e.title} ${e.statement} ${e.shows}` : `${e.title} ${e.statement}`;
        return def.re.test(text) && e.span;
      }).sort((a, b) => a.span[0] - b.span[0]);
      if (members.length >= 3) found.push({ def, members });
    }
    found.sort((a, b) => b.members.length - a.members.length);
    for (const { def, members } of found.slice(0, 9)) {
      frag.append(patternCard(def.name, "Thread — one name through the record", "g-thr", members, def.closer, null));
    }
    mount.replaceChildren(frag);
  }

  /* ---------- checked patterns: what the record refused ---------- */
  function buildChecked(hub, entries, mount) {
    const byId = new Map(entries.map(e => [e.id, e]));
    const frag = document.createDocumentFragment();
    for (const pattern of hub.checkedPatterns || []) {
      const members = (pattern.entryIds || []).map(id => byId.get(id)).filter(Boolean)
        .sort((a, b) => (a.span ? a.span[0] : 0) - (b.span ? b.span[0] : 0));
      const card = el("article", "hubp-card hubp-card-checked");
      const head = el("div", "hubp-card-head");
      head.append(el("h4", "", pattern.name));
      head.append(el("span", "hubp-chip-label g-dis", pattern.verdict));
      card.append(head);
      card.append(el("p", "hubp-card-note", pattern.note));
      if (members.length) {
        const btn = el("button", "hubp-btn", `See the ${members.length} ${members.length === 1 ? "entry" : "entries"} it was checked against`);
        btn.type = "button";
        btn.addEventListener("click", () => {
          applyFilter(members.map(e => e.id), pattern.name);
          showReading(pattern.name, pattern.verdict, "g-dis", sequenceSteps(members),
            "This pattern was tested against the entries above and the record did not carry it. It is kept here, labeled, so the checking stays visible.");
        });
        card.append(btn);
      }
      frag.append(card);
    }
    mount.replaceChildren(frag);
  }

  /* ---------- legend ---------- */
  function buildLegend(entries, mount) {
    const present = TRACK_ORDER.filter(kind => entries.some(e => e.kind === kind));
    const wrap = el("div", "hubp-legend-grid");
    for (const kind of present) {
      const item = el("div", "hubp-legend-item");
      const discWrap = el("span", "hubp-disc g-doc");
      discWrap.append(glyphSvg(kind, "g-doc", 16));
      item.append(discWrap, el("span", "", ""));
      item.lastChild.append(el("strong", "", KINDS[kind].label), document.createTextNode(` — ${KINDS[kind].meaning}`));
      wrap.append(item);
    }
    mount.append(wrap);
    const shades = el("div", "hubp-shades");
    for (const style of Object.values(GRADE_STYLE)) {
      const item = el("div", "hubp-legend-item");
      item.append(el("span", `hubp-disc ${style.cls}`), el("span", "", ""));
      item.lastChild.append(el("strong", "", style.label), document.createTextNode(` — ${style.key}`));
      shades.append(item);
    }
    mount.append(shades);
  }

  /* ---------- load ---------- */
  async function load() {
    const chartMount = document.querySelector("[data-hubp-chart]");
    if (!chartMount) return;
    detailBox = document.querySelector("[data-hubp-detail]");
    chip = document.querySelector("[data-hubp-chip]");
    chipLabel = document.querySelector("[data-hubp-chip-label]");
    const clearBtn = document.querySelector("[data-hubp-chip-clear]");
    if (clearBtn) clearBtn.addEventListener("click", clearFilter);
    try {
      const response = await fetch(HUB_URL);
      if (!response.ok) throw new Error(`Hub data could not be loaded (${response.status}).`);
      const hub = await response.json();
      const entries = hub.entries.map(entry => {
        const { span, deep } = parseSpan(entry.dates);
        return { ...entry, span, deep, kind: kindOf(entry), gradeStyle: GRADE_STYLE[entry.grade] || GRADE_FALLBACK };
      });
      const legendMount = document.querySelector("[data-hubp-legend]");
      if (legendMount) buildLegend(entries, legendMount);
      buildChart(entries, chartMount);
      const stacksMount = document.querySelector("[data-hubp-stacks]");
      if (stacksMount) buildStacks(entries, stacksMount);
      const threadsMount = document.querySelector("[data-hubp-threads]");
      if (threadsMount) buildThreads(entries, threadsMount);
      const checkedMount = document.querySelector("[data-hubp-checked]");
      if (checkedMount) buildChecked(hub, entries, checkedMount);
      const countLine = document.querySelector("[data-hubp-count]");
      if (countLine) {
        const onScale = entries.filter(e => e.span && !e.deep).length;
        const deep = entries.filter(e => e.deep).length;
        countLine.textContent = `${entries.length} documented entries stand behind this view · ${onScale} placed by their dates on the year scale · ${deep} in the “earlier” margin, where dates run out or fall before 1500.`;
      }
    } catch (error) {
      console.error("Documentation Hub pattern view could not be loaded:", error);
      chartMount.textContent = "The pattern view could not be loaded. The full list below still stands.";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
