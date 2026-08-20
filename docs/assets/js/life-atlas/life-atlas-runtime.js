/** Browser bootstrap for the local-first Life Atlas repository. */
(function (root) {
  "use strict";
  const Runtime = { VERSION: "1.0.0", repository: null, ready: null };
  Runtime.ready = (async () => {
    const Indexed = root.CodexLifeAtlasIndexedDb;
    const Repo = root.CodexLifeAtlasRepository;
    if (!Indexed || !Repo) throw new Error("Life Atlas persistence modules are unavailable.");
    let adapter;
    try { adapter = Indexed.createRecordAdapter(); await adapter.size(); }
    catch (_) { adapter = Repo.createMemoryAdapter(); }
    Runtime.repository = Repo.createRepository({ adapter });
    root.dispatchEvent?.(new CustomEvent("sof:life-atlas-ready", { detail: { persistent: adapter !== null } }));
    return Runtime.repository;
  })();
  Runtime.count = async () => (await Runtime.ready).count();
  Runtime.records = async () => (await Runtime.ready).all();
  Runtime.recordsForYear = async year => {
    const y = Number(year);
    return Number.isFinite(y) ? (await Runtime.ready).query({ patternYear: y }) : [];
  };
  Runtime.recordsForYears = async years => {
    const unique = [...new Set((Array.isArray(years) ? years : []).map(Number).filter(Number.isFinite))];
    const groups = await Promise.all(unique.map(year => Runtime.recordsForYear(year)));
    const merged = new Map();
    for (const group of groups) for (const record of group || []) if (record?.id) merged.set(record.id, record);
    return [...merged.values()];
  };
  root.CodexLifeAtlasRuntime = Runtime;
})(typeof globalThis !== "undefined" ? globalThis : this);
