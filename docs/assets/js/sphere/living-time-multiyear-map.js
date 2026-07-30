(() => {
  "use strict";

  const VERSION = "3.0.0";
  const DEFAULT_SPAN = 200;
  const MAX_VISIBLE_LINKS = 2200;
  const MAX_VISIBLE_NODES = 6000;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const yearOf = record => Number(record.pattern?.patternYear || new Date(record.instant).getFullYear());
  const dayOf = record => clamp(Number(record.pattern?.dayOf364 || record.pattern?.dayOfPatternYear) || 1, 1, 364);

  function relationReasons(a, b) {
    const reasons = [];
    if (a.pattern?.moon === b.pattern?.moon) reasons.push("same Moon");
    if ((a.pattern?.moonDay || a.pattern?.day) === (b.pattern?.moonDay || b.pattern?.day)) reasons.push("same Moon Day");
    const aTags = new Set(a.witness?.tags || []);
    const sharedTags = (b.witness?.tags || []).filter(tag => aTags.has(tag));
    if (sharedTags.length) reasons.push(`tags: ${sharedTags.slice(0, 3).join(", ")}`);
    if (a.entities?.placeId && a.entities.placeId === b.entities?.placeId) reasons.push("same place");
    if (a.entities?.artifactIds?.some(id => (b.entities?.artifactIds || []).includes(id))) reasons.push("shared artifact");
    if (a.environment?.seasonal?.season && a.environment.seasonal.season === b.environment?.seasonal?.season) reasons.push("same season");
    return reasons;
  }

  function ranges(records, { endYear = new Date().getFullYear(), span = DEFAULT_SPAN } = {}) {
    const boundedSpan = clamp(Number(span) || DEFAULT_SPAN, 10, 1000);
    const minRecordYear = records.length ? Math.min(...records.map(yearOf).filter(Number.isFinite)) : endYear - boundedSpan + 1;
    const start = Math.min(endYear - boundedSpan + 1, minRecordYear);
    return { start, end: endYear, span: endYear - start + 1 };
  }

  function indexRecords(points) {
    const indexes = new Map();
    const add = (key, index) => {
      if (!key) return;
      if (!indexes.has(key)) indexes.set(key, []);
      indexes.get(key).push(index);
    };
    points.forEach((point, index) => {
      const r = point.record;
      add(`moon:${r.pattern?.moon}`, index);
      add(`day:${r.pattern?.moonDay || r.pattern?.day}`, index);
      add(`place:${r.entities?.placeId || ""}`, index);
      add(`season:${r.environment?.seasonal?.season || ""}`, index);
      (r.witness?.tags || []).slice(0, 12).forEach(tag => add(`tag:${tag}`, index));
      (r.entities?.artifactIds || []).slice(0, 12).forEach(id => add(`artifact:${id}`, index));
    });
    return indexes;
  }

  function candidatePairs(points, limit = MAX_VISIBLE_LINKS) {
    const indexes = indexRecords(points);
    const seen = new Set();
    const pairs = [];
    for (const members of indexes.values()) {
      if (members.length < 2) continue;
      const capped = members.slice(0, 150);
      for (let a = 0; a < capped.length; a += 1) {
        for (let b = a + 1; b < capped.length; b += 1) {
          const left = Math.min(capped[a], capped[b]);
          const right = Math.max(capped[a], capped[b]);
          const key = `${left}:${right}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const reasons = relationReasons(points[left].record, points[right].record);
          if (reasons.length) pairs.push({ left, right, reasons });
          if (pairs.length >= limit) return pairs;
        }
      }
    }
    return pairs;
  }

  function buildRenderablePoints(records, range, xYear, yDay, maxNodes = MAX_VISIBLE_NODES) {
    const raw = records.map(record => ({ record, x: xYear(yearOf(record)), y: yDay(dayOf(record)), count: 1, aggregated: false }));
    if (raw.length <= maxNodes) return { points: raw, aggregated: false, sourceCount: raw.length };

    const xBins = Math.max(16, Math.min(range.span, Math.round(Math.sqrt(maxNodes * range.span / 364))));
    const yBins = Math.max(12, Math.floor(maxNodes / xBins));
    const cells = new Map();
    for (const point of raw) {
      const yearRatio = (yearOf(point.record) - range.start) / Math.max(1, range.end - range.start);
      const dayRatio = (dayOf(point.record) - 1) / 363;
      const bx = Math.max(0, Math.min(xBins - 1, Math.floor(yearRatio * xBins)));
      const by = Math.max(0, Math.min(yBins - 1, Math.floor(dayRatio * yBins)));
      const key = `${bx}:${by}`;
      let cell = cells.get(key);
      if (!cell) { cell = { records: [], xTotal: 0, yTotal: 0, years: [], days: [] }; cells.set(key, cell); }
      cell.records.push(point.record); cell.xTotal += point.x; cell.yTotal += point.y;
      cell.years.push(yearOf(point.record)); cell.days.push(dayOf(point.record));
    }
    const points = [...cells.values()].map(cell => ({
      record: cell.records[0],
      records: cell.records,
      x: cell.xTotal / cell.records.length,
      y: cell.yTotal / cell.records.length,
      count: cell.records.length,
      aggregated: true,
      yearMin: Math.min(...cell.years), yearMax: Math.max(...cell.years),
      dayMin: Math.min(...cell.days), dayMax: Math.max(...cell.days)
    }));
    return { points, aggregated: true, sourceCount: raw.length };
  }

  function tickStep(span) {
    if (span <= 60) return 5;
    if (span <= 220) return 10;
    if (span <= 520) return 25;
    return 50;
  }

  function render(container, records, options = {}) {
    if (!container) return;
    const range = ranges(records, options);
    const width = Math.max(960, Math.min(5200, range.span * (range.span > 500 ? 3.2 : 7.5)));
    const height = 590;
    const margin = { left: 64, right: 34, top: 56, bottom: 66 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const xYear = year => margin.left + ((year - range.start) / (range.end - range.start || 1)) * plotWidth;
    const yDay = day => margin.top + ((day - 1) / 363) * plotHeight;
    const colors = { Spring: "#78d6a4", Summer: "#f6c85f", Autumn: "#e89b5b", Winter: "#8eb8e8" };

    let svg = `<svg class="obs-century-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${range.span}-year Living Time map from ${range.start} to ${range.end}"><defs><filter id="obsGlow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><linearGradient id="obsCenturyBg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#070f18"/><stop offset="1" stop-color="#171018"/></linearGradient></defs><rect width="${width}" height="${height}" rx="24" fill="url(#obsCenturyBg)"/>`;

    [1, 92, 183, 274, 364].forEach((day, index) => {
      const y = yDay(day);
      svg += `<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" class="obs-century-grid major"/><text x="12" y="${y + 4}" class="obs-century-axis">${["Year Gate", "Q2", "Midyear", "Q4", "Year End"][index]}</text>`;
    });

    const step = tickStep(range.span);
    for (let year = Math.ceil(range.start / step) * step; year <= range.end; year += step) {
      const x = xYear(year);
      svg += `<line x1="${x}" y1="${margin.top}" x2="${x}" y2="${height - margin.bottom}" class="obs-century-grid"/><text x="${x}" y="${height - 25}" text-anchor="middle" class="obs-century-axis">${year}</text>`;
    }

    [[1, 91, "Spring"], [92, 182, "Summer"], [183, 273, "Autumn"], [274, 364, "Winter"]].forEach(([start, end, name]) => {
      svg += `<rect x="${margin.left}" y="${yDay(start)}" width="${plotWidth}" height="${yDay(end) - yDay(start)}" fill="${colors[name]}" opacity=".035"/>`;
    });

    const renderSet = buildRenderablePoints(records, range, xYear, yDay, Number(options.maxNodes) || MAX_VISIBLE_NODES);
    const points = renderSet.points;
    let renderedLinks = 0;
    if (options.connections !== false && !renderSet.aggregated) {
      const pairs = candidatePairs(points, Number(options.maxLinks) || MAX_VISIBLE_LINKS);
      for (const pair of pairs) {
        const a = points[pair.left];
        const b = points[pair.right];
        const strong = pair.reasons.length >= 2;
        svg += `<path d="M${a.x},${a.y} C${(a.x + b.x) / 2},${a.y - 24} ${(a.x + b.x) / 2},${b.y + 24} ${b.x},${b.y}" class="obs-century-link ${strong ? "strong" : ""}"><title>${esc(pair.reasons.join(" · "))}</title></path>`;
        renderedLinks += 1;
      }
    }

    points.forEach(point => {
      const { record, x, y } = point;
      const season = record.environment?.seasonal?.season || "";
      const color = colors[season] || "#f6c85f";
      const radius = point.aggregated ? Math.min(18, 5 + Math.log2(point.count + 1) * 2.2) : 7;
      const title = point.aggregated
        ? `${point.count} records · years ${point.yearMin}–${point.yearMax} · Pattern days ${point.dayMin}–${point.dayMax}`
        : `${yearOf(record)} · Day ${dayOf(record)} · ${record.witness?.observation || "Witness"}`;
      svg += `<g class="obs-century-node${point.aggregated ? " is-cluster" : ""}" data-record-id="${esc(record.recordId)}" data-record-count="${point.count}" tabindex="0"><circle cx="${x}" cy="${y}" r="${radius}" fill="${color}" filter="url(#obsGlow)"/><circle cx="${x}" cy="${y}" r="${radius + 7}" fill="transparent" stroke="${color}" opacity=".2"/>${point.aggregated ? `<text x="${x}" y="${y + 4}" text-anchor="middle" class="obs-century-cluster-count">${point.count}</text>` : ""}<title>${esc(title)}</title></g>`;
    });

    const densityNote = renderSet.aggregated ? ` · ${points.length} density clusters` : "";
    svg += `<text x="${margin.left}" y="30" class="obs-century-title">Living Time Field · ${range.start}—${range.end}</text><text x="${width - margin.right}" y="30" text-anchor="end" class="obs-century-meta">${records.length} records${densityNote} · ${renderedLinks} visible links · ${range.span} years</text><desc>${renderSet.aggregated ? `Large archive summarized into ${points.length} spatial clusters. Narrow the time range or filters to inspect individual records.` : `All ${records.length} records shown individually.`}</desc></svg>`;
    container.innerHTML = svg;
    container.dataset.startYear = range.start;
    container.dataset.endYear = range.end;
    container.dataset.visibleLinks = String(renderedLinks);
  }

  globalThis.LivingTimeMultiYearMap = Object.freeze({ VERSION, DEFAULT_SPAN, MAX_VISIBLE_LINKS, MAX_VISIBLE_NODES, render, ranges, relationReasons, candidatePairs, buildRenderablePoints });
})();
