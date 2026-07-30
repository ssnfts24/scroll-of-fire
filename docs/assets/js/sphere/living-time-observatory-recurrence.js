(() => {
  "use strict";
  const clamp = n => Math.max(0, Math.min(1, Number(n) || 0));
  const circular = (a, b, span) => {
    if (a == null || b == null) return null;
    const d = Math.abs(Number(a) - Number(b));
    return Math.min(d, span - d) / (span / 2);
  };
  const tagScore = (a = [], b = []) => {
    const A = new Set(a), B = new Set(b);
    if (!A.size && !B.size) return null;
    const intersection = [...A].filter(x => B.has(x)).length;
    const union = new Set([...A, ...B]).size;
    return union ? intersection / union : 0;
  };

  function compare(a, b) {
    const signals = [];
    const add = (id, score, weight, detail) => { if (score != null) signals.push({ id, score: clamp(score), weight, detail }); };
    const patternDistance = circular(a?.pattern?.dayOf364, b?.pattern?.dayOf364, 364);
    add("pattern-day", patternDistance == null ? null : 1 - patternDistance, 0.30, "Pattern-day proximity");
    add("moon", a?.pattern?.moon && b?.pattern?.moon ? (a.pattern.moon === b.pattern.moon ? 1 : 0) : null, 0.10, "Same Pattern Moon");
    add("moon-day", a?.pattern?.moonDay && b?.pattern?.moonDay ? 1 - Math.min(Math.abs(a.pattern.moonDay - b.pattern.moonDay) / 27, 1) : null, 0.10, "Moon-day proximity");
    add("lunar", a?.astronomy?.lunarAge != null && b?.astronomy?.lunarAge != null ? 1 - (circular(a.astronomy.lunarAge, b.astronomy.lunarAge, 29.53059) || 0) : null, 0.15, "Lunar-age proximity");
    add("season", a?.astronomy?.seasonGate && b?.astronomy?.seasonGate ? (a.astronomy.seasonGate === b.astronomy.seasonGate ? 1 : 0.25) : null, 0.08, "Seasonal context");
    add("tags", tagScore(a?.witness?.tags, b?.witness?.tags), 0.17, "Shared witness tags");
    add("intention", a?.witness?.intention && b?.witness?.intention ? (a.witness.intention.toLowerCase() === b.witness.intention.toLowerCase() ? 1 : 0) : null, 0.10, "Shared intention");
    const totalWeight = signals.reduce((s, x) => s + x.weight, 0) || 1;
    const score = signals.reduce((s, x) => s + x.score * x.weight, 0) / totalWeight;
    const evidence = signals.filter(x => x.score >= 0.65).map(x => x.detail);
    return {
      score: Number(score.toFixed(4)),
      percent: Math.round(score * 100),
      confidence: signals.length >= 6 ? "comparative" : signals.length >= 3 ? "limited" : "insufficient",
      evidence,
      signals,
      classification: score >= .82 ? "strong similarity" : score >= .64 ? "notable similarity" : score >= .45 ? "partial similarity" : "low similarity",
      caveat: "Similarity is descriptive. It does not establish causation or prediction."
    };
  }

  function rank(target, records, limit = 8) {
    return (records || []).filter(r => r.recordId !== target?.recordId)
      .map(record => ({ record, comparison: compare(target, record) }))
      .sort((a,b) => b.comparison.score - a.comparison.score)
      .slice(0, limit);
  }

  function summarize(records) {
    const tagCounts = new Map();
    const moonCounts = new Map();
    for (const r of records || []) {
      (r.witness?.tags || []).forEach(t => tagCounts.set(t, (tagCounts.get(t) || 0) + 1));
      const m = r.pattern?.moon;
      if (m) moonCounts.set(m, (moonCounts.get(m) || 0) + 1);
    }
    return {
      count: records?.length || 0,
      topTags: [...tagCounts].sort((a,b) => b[1]-a[1]).slice(0, 8),
      topMoons: [...moonCounts].sort((a,b) => b[1]-a[1]).slice(0, 5)
    };
  }

  globalThis.LivingTimeObservatoryRecurrence = Object.freeze({ compare, rank, summarize });
})();
