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
  root.CodexLifeAtlasRuntime = Runtime;
})(typeof globalThis !== "undefined" ? globalThis : this);
