(() => {
  "use strict";

  const VERSION = "1.0.0";
  const SYSTEMS = Object.freeze([
    { id: "living-time", name: "Living Time Observatory", href: "living-time-sphere.html", domain: "Time", role: "Coordinate civil, Pattern, lunar, solar, seasonal, witness, and historical context.", inputs: ["civil time", "Pattern date", "astronomy", "location", "witness records"], outputs: ["Sphere state", "seasonal ledger", "recurrence field", "portable records"] },
    { id: "thirteen-moons", name: "13 Moons Calendar", href: "moons.html", domain: "Time", role: "Operate the 13 × 28 counted-year framework and its intercalary days.", inputs: ["civil date", "timezone", "boundary"], outputs: ["Moon", "Moon Day", "day of 364", "week gate"] },
    { id: "equinox", name: "Equinox Passage", href: "equinox-passage.html", domain: "Astronomy", role: "Measure the relationship between the March equinox and the Year Gate.", inputs: ["equinox instant", "Pattern conversion"], outputs: ["Passage duration", "gate offsets", "annual comparison"] },
    { id: "alignment", name: "Alignment Ledger", href: "alignment-ledger.html", domain: "Research", role: "Preserve sourced annual comparisons, offsets, signatures, and recurrence evidence.", inputs: ["seasonal events", "Pattern positions", "lunar context"], outputs: ["signatures", "comparisons", "exports"] },
    { id: "oracle", name: "Genesis Oracle", href: "genesis-oracle.html", domain: "Personal", role: "Generate deterministic personal Pattern readings with explicit input and version state.", inputs: ["name", "birth date", "timezone", "boundary"], outputs: ["Seal", "development path", "technical reading"] },
    { id: "witness", name: "Witness System", href: "systems/witness.html", domain: "Memory", role: "Separate observation, interpretation, claim type, uncertainty, and provenance.", inputs: ["observation", "context", "claim class"], outputs: ["witness records", "evidence trail"] },
    { id: "frequency", name: "Frequency Governance", href: "systems/frequencies.html", domain: "Practice", role: "Provide transparent sound-session presets, carriers, timing, and session records.", inputs: ["intention", "carrier", "beat", "duration"], outputs: ["session state", "practice record"] },
    { id: "artifacts", name: "Artifact Registry", href: "ledger.html", domain: "Provenance", role: "Track physical artifacts, custody, state, media, story, and verification history.", inputs: ["artifact identity", "materials", "events"], outputs: ["registry entry", "provenance chain"] },
    { id: "caravan", name: "Covenant Caravan", href: "covenant-caravan.html", domain: "Logistics", role: "Coordinate mobile resilience, route knowledge, skills, animals, resources, and community nodes.", inputs: ["route", "skills", "resources", "weather", "nodes"], outputs: ["readiness", "route plan", "portable economy"] },
    { id: "recoder", name: "Reality Recoder", href: "systems/recoder.html", domain: "Practice", role: "Translate observation into intentional language, corrective action, and review.", inputs: ["current frame", "language", "desired correction"], outputs: ["action sequence", "review record"] },
    { id: "mind-renewal", name: "Mind Renewal", href: "systems/mind-renewal.html", domain: "Practice", role: "Support reflective pattern interruption without disguising personal interpretation as fact.", inputs: ["thought pattern", "context", "chosen response"], outputs: ["renewal practice", "witness entry"] },
    { id: "theory", name: "Codex Theory", href: "theory.html", domain: "Knowledge", role: "Hold equations, operators, claims, limitations, ethics, and research pathways.", inputs: ["definitions", "formalism", "sources", "critique"], outputs: ["canonical theory", "version history"] },
    { id: "archive", name: "Systems Archive", href: "systems/archive.html", domain: "Memory", role: "Maintain durable system documents, versions, changes, and recoverable exports.", inputs: ["documents", "versions", "change records"], outputs: ["archive", "recovery path"] },
    { id: "lab", name: "Remnant Lab", href: "lab.html", domain: "Research", role: "Turn open questions into bounded experiments, protocols, measurements, and review.", inputs: ["question", "protocol", "observations"], outputs: ["study record", "results", "limitations"] }
  ]);

  const EDGES = Object.freeze([
    ["thirteen-moons", "living-time", "provides Pattern coordinates"],
    ["equinox", "living-time", "provides seasonal gate"],
    ["alignment", "living-time", "provides annual comparison"],
    ["witness", "living-time", "provides personal observations"],
    ["living-time", "oracle", "provides current Pattern context"],
    ["living-time", "caravan", "provides seasonal and route context"],
    ["witness", "lab", "provides research observations"],
    ["lab", "theory", "tests claims"],
    ["artifacts", "archive", "preserves provenance"],
    ["frequency", "witness", "records practice outcomes"],
    ["recoder", "witness", "records corrective action"],
    ["mind-renewal", "witness", "records reflective practice"],
    ["archive", "living-time", "provides historical records"]
  ].map(([from, to, relation]) => Object.freeze({ from, to, relation })));

  function storageCount(keys) {
    for (const key of keys) {
      try {
        const value = JSON.parse(localStorage.getItem(key) || "null");
        if (Array.isArray(value)) return value.length;
        if (value && typeof value === "object") return Object.keys(value).length;
      } catch (_) {}
    }
    return 0;
  }

  function liveStatus() {
    return Object.freeze({
      generatedAt: new Date().toISOString(),
      records: storageCount(["sof.observatory.records.v2", "sof_observatory_records_v2", "livingTimeObservatoryRecords"]),
      quests: storageCount(["sof.observatory.quests.v1", "sof_observatory_quests_v1"]),
      oracleProfiles: storageCount(["sof.genesisOracle.profiles.v2", "genesisOracleProfiles"]),
      artifacts: storageCount(["sof.artifacts.v1", "artifactRegistry"]),
      online: navigator.onLine,
      storageAvailable: (() => { try { localStorage.setItem("__sof_test", "1"); localStorage.removeItem("__sof_test"); return true; } catch (_) { return false; } })()
    });
  }

  globalThis.CodexSystemRegistry = Object.freeze({ version: VERSION, systems: SYSTEMS, edges: EDGES, liveStatus });
})();
